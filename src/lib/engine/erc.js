/**
 * Electrical Rules Check (ERC) Engine
 * Analyzes diagram connections for voltage mismatches, short-circuits,
 * UART direction conflicts, and missing power connections.
 */
import { MCU_PINS } from '$lib/data/mcu-pins.js'

const GND_IDENTIFIERS = new Set([
  'gnd', 'vss', 'agnd', 'dgnd', '0v', 'ground', '−', '-', 'k'
])

const POWER_IDENTIFIERS = {
  '12v': 12,
  '5v': 5,
  'vcc': 5,
  'vbus': 5,
  'vsys': 5,
  'out+': 5,
  'in+': 12,
  '3.3v': 3.3,
  '3v3': 3.3,
  '+': 5
}

// Known default 7-bit I2C device addresses
export const I2C_DEVICE_PROFILES = {
  'oled-ssd1306': { addr: '0x3C', alt: '0x3D', name: 'OLED SSD1306' },
  'lcd-16x2':     { addr: '0x27', alt: '0x3F', name: 'LCD 16x2 I2C Backpack' },
  'mpu-6050':     { addr: '0x68', alt: '0x69', name: 'MPU-6050 6-DOF IMU' },
  'bmp280':       { addr: '0x76', alt: '0x77', name: 'BMP280 Barometer' },
  'bme280':       { addr: '0x76', alt: '0x77', name: 'BME280 Temp/Humid/Press' },
  'ads1115':      { addr: '0x48', alt: '0x49 - 0x4B', name: 'ADS1115 16-bit ADC' },
  'ds3231':       { addr: '0x68', alt: null, name: 'DS3231 High-Precision RTC' },
  'bh1750':       { addr: '0x23', alt: '0x5C', name: 'BH1750 Ambient Light' },
  'ina219':       { addr: '0x40', alt: '0x41 - 0x45', name: 'INA219 Current/Power Monitor' },
  'mcp23017':     { addr: '0x20', alt: '0x21 - 0x27', name: 'MCP23017 16-bit I/O Expander' },
  'aht10':        { addr: '0x38', alt: null, name: 'AHT10 / AHT20 Temp & Humidity' }
}

// Estimated current draw ratings (mA) for power budget calculations
export const COMPONENT_CURRENT_RATINGS = [
  { pattern: /esp32s3/i,       name: 'ESP32-S3 DevKit',      peakMa: 260, idleMa: 80,  voltage: 3.3 },
  { pattern: /esp32/i,         name: 'ESP32 DevKit',         peakMa: 240, idleMa: 75,  voltage: 3.3 },
  { pattern: /uno/i,           name: 'Arduino Uno R3',       peakMa: 60,  idleMa: 45,  voltage: 5.0 },
  { pattern: /nano/i,          name: 'Arduino Nano',         peakMa: 55,  idleMa: 40,  voltage: 5.0 },
  { pattern: /mega/i,          name: 'Arduino Mega 2560',    peakMa: 80,  idleMa: 65,  voltage: 5.0 },
  { pattern: /rpi4|pi\s*4/i,   name: 'Raspberry Pi 4',       peakMa: 1200,idleMa: 600, voltage: 5.0 },
  { pattern: /pico|rp2040/i,   name: 'Raspberry Pi Pico',    peakMa: 50,  idleMa: 25,  voltage: 3.3 },
  { pattern: /ssd1306|oled/i,  name: 'OLED SSD1306 128x64',  peakMa: 25,  idleMa: 10,  voltage: 3.3 },
  { pattern: /lcd/i,           name: 'LCD 16x2 Backlight',   peakMa: 35,  idleMa: 15,  voltage: 5.0 },
  { pattern: /relay/i,         name: 'Modul Relai 5V',       peakMa: 75,  idleMa: 5,   voltage: 5.0 },
  { pattern: /servo/i,         name: 'Micro Servo (SG90)',   peakMa: 550, idleMa: 15,  voltage: 5.0 },
  { pattern: /buzzer|piezo/i,  name: 'Piezo Buzzer',         peakMa: 30,  idleMa: 0,   voltage: 5.0 },
  { pattern: /hcsr04|ultrasonic/i, name: 'Sensor Ultrasonik HC-SR04', peakMa: 15, idleMa: 2, voltage: 5.0 },
  { pattern: /neopixel|ws2812/i, name: 'WS2812B RGB LED',    peakMa: 60,  idleMa: 1,   voltage: 5.0 },
  { pattern: /dht/i,           name: 'Sensor DHT',           peakMa: 2.5, idleMa: 0.1, voltage: 3.3 },
  { pattern: /mpu/i,           name: 'Sensor IMU (MPU6050)', peakMa: 4,   idleMa: 0.5, voltage: 3.3 },
  { pattern: /bmp|bme/i,       name: 'Sensor Barometer',     peakMa: 3,   idleMa: 0.2, voltage: 3.3 },
  { pattern: /led/i,           name: 'LED Indikator',        peakMa: 15,  idleMa: 0,   voltage: 3.3 },
  { pattern: /l298n|motor\s*driver/i, name: 'Driver Motor L298N', peakMa: 1200, idleMa: 35, voltage: 12.0 },
  { pattern: /potentiometer|potensio/i, name: 'Potensiometer 10k', peakMa: 0.5, idleMa: 0.5, voltage: 3.3 }
]

export function calculatePowerBudget(components = []) {
  let totalPeakMa = 0
  let totalIdleMa = 0
  const breakdown = []

  components.forEach(c => {
    if (c.theme === 'passive' && !c.id?.includes('led')) return
    const id = (c.id || '').toLowerCase()
    const name = (c.name || '').toLowerCase()
    const target = id + ' ' + name

    const rating = COMPONENT_CURRENT_RATINGS.find(r => r.pattern.test(target))
    if (rating) {
      totalPeakMa += rating.peakMa
      totalIdleMa += rating.idleMa
      breakdown.push({
        label: c.label || c.id,
        name: rating.name,
        peakMa: rating.peakMa,
        idleMa: rating.idleMa,
        voltage: rating.voltage
      })
    }
  })

  const limitMa = 500 // Standar port USB 2.0 / LDO DevKit
  let status = 'ok'
  let warningMessage = null

  if (totalPeakMa > 800) {
    status = 'danger'
    warningMessage = `Arus puncak rangkaian (${Math.round(totalPeakMa)} mA) sangat tinggi! Regulator LDO onboard akan mengalami panas berlebih (thermal throttling) dan mikrokontroler rentan restart. Wajib gunakan catu daya eksternal (External 5V/12V Power Supply).`
  } else if (totalPeakMa > limitMa) {
    status = 'warning'
    warningMessage = `Arus puncak rangkaian (${Math.round(totalPeakMa)} mA) melebihi batas aman port USB 2.0 standar (${limitMa} mA). Disarankan menyalakan modul daya eksternal terutama saat WiFi atau motor/relai aktif.`
  }

  return {
    totalPeakMa: Math.round(totalPeakMa),
    totalIdleMa: Math.round(totalIdleMa),
    limitMa,
    status,
    warningMessage,
    breakdown
  }
}

export function normalizePin(comp, pinId) {
  if (!comp) return null
  let pin = null
  if (comp.isMCU && MCU_PINS[comp.id]) {
    const all = [...(MCU_PINS[comp.id].left ?? []), ...(MCU_PINS[comp.id].right ?? [])]
    pin = all.find(p => p.id === pinId)
  }
  if (!pin) {
    pin = (comp.pins ?? []).find(p => p.id === pinId)
  }
  if (!pin) return { id: pinId, label: pinId, type: 'passive', voltage: null }

  const idLower = (pin.id || '').toLowerCase()
  const labelLower = (pin.label || '').toLowerCase()

  // Detect GND
  const isGnd = pin.type === 'gnd' ||
    GND_IDENTIFIERS.has(idLower) ||
    GND_IDENTIFIERS.has(labelLower)

  // Detect Voltage
  let voltage = null
  if (labelLower.includes('12v')) voltage = 12
  else if (labelLower.includes('5v')) voltage = 5
  else if (labelLower.includes('3.3v') || labelLower.includes('3v3')) voltage = 3.3
  else if (pin.type === 'power') {
    voltage = POWER_IDENTIFIERS[idLower] ?? (comp.id?.includes('12v') ? 12 : 5)
  }

  // Detect UART RX vs TX
  let uartRole = null
  if (pin.type === 'uart' || labelLower.includes('tx') || labelLower.includes('rx')) {
    if (labelLower.includes('tx') || idLower.includes('tx')) uartRole = 'TX'
    else if (labelLower.includes('rx') || idLower.includes('rx')) uartRole = 'RX'
  }

  return {
    ...pin,
    isGnd,
    voltage,
    uartRole,
    compLabel: comp.label || comp.id
  }
}

/**
 * Discovers compatible target pins when dragging a wire from sourcePin.
 * Returns a Set of keys: `${targetCompInstanceId}::${targetPinId}`
 */
export function findCompatiblePins(sourceComp, sourcePinId, allComponents = []) {
  if (!sourceComp || !sourcePinId) return new Set()
  const src = normalizePin(sourceComp, sourcePinId)
  if (!src) return new Set()

  const compatibleKeys = new Set()
  const srcLabel = (src.label || src.id || '').toUpperCase()

  allComponents.forEach(comp => {
    if (comp.instanceId === sourceComp.instanceId) return

    const pins = comp.isMCU && MCU_PINS[comp.id]
      ? [...(MCU_PINS[comp.id].left || []), ...(MCU_PINS[comp.id].right || [])]
      : (comp.pins || [])

    pins.forEach(p => {
      const target = normalizePin(comp, p.id)
      if (!target) return
      const tgtLabel = (target.label || target.id || '').toUpperCase()
      const key = `${comp.instanceId}::${p.id}`

      // Rule 1: GND connects to GND
      if (src.isGnd) {
        if (target.isGnd) compatibleKeys.add(key)
        return
      }

      // Rule 2: Power connects to Power / VCC / matching voltage
      if (src.voltage != null || src.type === 'power') {
        if (target.isGnd) return // short
        if (target.type === 'power' || target.voltage != null || target.type === 'passive') {
          if (!src.voltage || !target.voltage || Math.abs(src.voltage - target.voltage) < 0.5) {
            compatibleKeys.add(key)
          }
        }
        return
      }

      // Rule 3: UART TX connects to RX, RX connects to TX
      if (src.uartRole === 'TX') {
        if (target.uartRole === 'RX' || tgtLabel.includes('RX')) compatibleKeys.add(key)
        return
      }
      if (src.uartRole === 'RX') {
        if (target.uartRole === 'TX' || tgtLabel.includes('TX')) compatibleKeys.add(key)
        return
      }

      // Rule 4: I2C (SDA -> SDA, SCL -> SCL)
      if (srcLabel.includes('SDA') || (src.type === 'i2c' && srcLabel.includes('SDA'))) {
        if (tgtLabel.includes('SDA') || target.type === 'i2c') compatibleKeys.add(key)
        return
      }
      if (srcLabel.includes('SCL') || (src.type === 'i2c' && srcLabel.includes('SCL'))) {
        if (tgtLabel.includes('SCL') || target.type === 'i2c') compatibleKeys.add(key)
        return
      }

      // Rule 5: SPI (MOSI -> MOSI, MISO -> MISO, SCK -> SCK, CS -> CS)
      if (srcLabel.includes('MOSI') || srcLabel.includes('SDI') || srcLabel.includes('SI')) {
        if (tgtLabel.includes('MOSI') || tgtLabel.includes('SDI') || tgtLabel.includes('SI') || target.type === 'spi') compatibleKeys.add(key)
        return
      }
      if (srcLabel.includes('MISO') || srcLabel.includes('SDO') || srcLabel.includes('SO')) {
        if (tgtLabel.includes('MISO') || tgtLabel.includes('SDO') || tgtLabel.includes('SO') || target.type === 'spi') compatibleKeys.add(key)
        return
      }
      if (srcLabel.includes('SCK') || srcLabel.includes('CLK')) {
        if (tgtLabel.includes('SCK') || tgtLabel.includes('CLK') || target.type === 'spi') compatibleKeys.add(key)
        return
      }
      if (srcLabel.includes('CS') || srcLabel.includes('SS')) {
        if (tgtLabel.includes('CS') || tgtLabel.includes('SS') || target.type === 'spi' || target.type === 'digital') compatibleKeys.add(key)
        return
      }

      // Rule 6: General Digital / Analog / GPIO
      if (!target.isGnd && target.type !== 'power') {
        if (src.type === 'analog' && (target.type === 'analog' || target.type === 'passive')) {
          compatibleKeys.add(key)
        } else if (src.type === 'digital' || src.type === 'gpio' || src.type === 'pwm') {
          if (target.type === 'digital' || target.type === 'gpio' || target.type === 'pwm' || target.type === 'passive') {
            compatibleKeys.add(key)
          }
        } else if (src.type === 'passive' || target.type === 'passive') {
          compatibleKeys.add(key)
        }
      }
    })
  })

  return compatibleKeys
}

/**
 * Runs ERC rules across components and wires.
 * Returns { errors: [], warnings: [], info: [], totalCount: N }
 */
export function runERC(components = [], wires = []) {
  const compMap = new Map(components.map(c => [c.instanceId, c]))
  const issues = []

  // 1. Connection-level checks
  wires.forEach((wire, idx) => {
    const fc = compMap.get(wire.fromComp)
    const tc = compMap.get(wire.toComp)
    if (!fc || !tc) return

    const p1 = normalizePin(fc, wire.fromPin)
    const p2 = normalizePin(tc, wire.toPin)
    if (!p1 || !p2) return

    // --- RULE A: Short Circuit (Power directly to GND) ---
    if ((p1.isGnd && (p2.type === 'power' || p2.voltage != null)) ||
        (p2.isGnd && (p1.type === 'power' || p1.voltage != null))) {
      issues.push({
        id: `erc_short_${wire.id}`,
        level: 'error',
        title: 'Short Circuit / Korsleting Terdeteksi',
        desc: `Pin daya ${p1.isGnd ? p2.compLabel + '.' + p2.label : p1.compLabel + '.' + p1.label} terhubung langsung ke GND (${p1.isGnd ? p1.compLabel + '.' + p1.label : p2.compLabel + '.' + p2.label}). Sirkuit berisiko terbakar!`,
        wireId: wire.id,
        compA: fc.instanceId,
        compB: tc.instanceId
      })
    }

    // --- RULE B: Voltage Mismatch (e.g. 5V or 12V into 3.3V) ---
    if (p1.voltage != null && p2.voltage != null && p1.voltage !== p2.voltage) {
      // Allow voltage divider, buck converter, or level shifter connections
      const isDivider = fc.id?.includes('divider') || tc.id?.includes('divider') ||
                        fc.id?.includes('buck') || tc.id?.includes('buck') ||
                        fc.id?.includes('shifter') || tc.id?.includes('shifter')
      if (!isDivider) {
        issues.push({
          id: `erc_volt_${wire.id}`,
          level: 'warning',
          title: 'Tegangan Berbeda (Voltage Mismatch)',
          desc: `Tegangan ${p1.voltage}V (${p1.compLabel}.${p1.label}) terhubung ke ${p2.voltage}V (${p2.compLabel}.${p2.label}). Pin 3.3V dapat rusak jika terkena 5V/12V tanpa logic level converter.`,
          wireId: wire.id,
          compA: fc.instanceId,
          compB: tc.instanceId
        })
      }
    }

    // --- RULE C: UART Direction (TX to TX, RX to RX) ---
    if (p1.uartRole && p2.uartRole && p1.uartRole === p2.uartRole) {
      issues.push({
        id: `erc_uart_${wire.id}`,
        level: 'warning',
        title: 'Konflik Jalur UART',
        desc: `Jalur UART ${p1.uartRole} (${p1.compLabel}.${p1.label}) terhubung ke sesama ${p2.uartRole} (${p2.compLabel}.${p2.label}). Jalur UART seharusnya bersilangan (TX ke RX, RX ke TX).`,
        wireId: wire.id,
        compA: fc.instanceId,
        compB: tc.instanceId
      })
    }

    // --- RULE D: Digital Output Contention ---
    if (p1.type === 'output' && p2.type === 'output') {
      issues.push({
        id: `erc_output_${wire.id}`,
        level: 'warning',
        title: 'Konflik Driver Output',
        desc: `Kedua pin bertindak sebagai Output (${p1.compLabel}.${p1.label} & ${p2.compLabel}.${p2.label}). Potensi tabrakan sinyal (bus contention).`,
        wireId: wire.id,
        compA: fc.instanceId,
        compB: tc.instanceId
      })
    }

    // --- RULE E: 3.3V GPIO to 5V Signal Hazard (Missing Level Shifter) ---
    const isMcu33 = (c) => {
      const id = (c.id || '').toLowerCase()
      return id.includes('esp32') || id.includes('pico') || id.includes('rp2040') || id.includes('stm32') || id.includes('nano33')
    }
    const is5vSource = (c, p) => {
      const id = (c.id || '').toLowerCase()
      return (id.includes('uno') || id.includes('nano') || id.includes('5v') || p.voltage === 5) && !id.includes('divider') && !id.includes('shifter')
    }

    if ((isMcu33(fc) && is5vSource(tc, p2)) || (isMcu33(tc) && is5vSource(fc, p1))) {
      const mcuComp = isMcu33(fc) ? fc : tc
      const mcuPin = isMcu33(fc) ? p1 : p2
      const srcComp = isMcu33(fc) ? tc : fc
      const srcPin = isMcu33(fc) ? p2 : p1

      if (mcuPin.type !== 'power' && !mcuPin.isGnd && srcPin.type !== 'power' && !srcPin.isGnd) {
        issues.push({
          id: `erc_level_shifter_${wire.id}`,
          level: 'warning',
          title: '⚠️ Bahaya Tegangan Logika (3.3V vs 5V)',
          desc: `Pin GPIO ${mcuComp.label || mcuComp.id}.${mcuPin.label} (toleransi 3.3V) terhubung langsung ke pin sinyal 5V ${srcComp.label || srcComp.id}.${srcPin.label}. Rekomendasi: Pasang Logic Level Converter 5V→3.3V atau Voltage Divider (1kΩ/2kΩ) agar pin mikrokontroler tidak rusak/terbakar.`,
          wireId: wire.id,
          compA: fc.instanceId,
          compB: tc.instanceId
        })
      }
    }
  })

  // 2. Component-level checks (Missing GND / Power for active components)
  components.forEach(c => {
    if (c.theme === 'passive' || c.theme === 'switch') return
    const connectedWires = wires.filter(w => w.fromComp === c.instanceId || w.toComp === c.instanceId)
    if (connectedWires.length === 0) return // Skip completely unplaced/idle components

    const usedPins = new Set()
    connectedWires.forEach(w => {
      if (w.fromComp === c.instanceId) usedPins.add(w.fromPin)
      if (w.toComp === c.instanceId) usedPins.add(w.toPin)
    })

    // Check if component has a GND pin defined
    let hasGndPin = false
    let hasGndConnected = false
    const checkPins = c.isMCU && MCU_PINS[c.id]
      ? [...(MCU_PINS[c.id].left ?? []), ...(MCU_PINS[c.id].right ?? [])]
      : (c.pins ?? [])

    checkPins.forEach(p => {
      const norm = normalizePin(c, p.id)
      if (norm.isGnd) {
        hasGndPin = true
        if (usedPins.has(p.id)) hasGndConnected = true
      }
    })

    if (hasGndPin && !hasGndConnected) {
      issues.push({
        id: `erc_nognd_${c.instanceId}`,
        level: 'info',
        title: 'Pin GND Belum Terhubung',
        desc: `Komponen "${c.label || c.id}" belum memiliki kabel ground (GND) yang tersambung. Sirkuit membutuhkan referensi ground bersama.`,
        compA: c.instanceId
      })
    }
  })

  // 3. I2C Bus Address Collision Checks
  // Build net clusters for SDA and SCL pins
  const sdaNets = []
  const sclNets = []

  function findOrAddToNet(nets, pA, pB) {
    let found = nets.find(net => net.has(pA) || net.has(pB))
    if (!found) {
      found = new Set()
      nets.push(found)
    }
    found.add(pA)
    found.add(pB)
  }

  wires.forEach(w => {
    const fc = compMap.get(w.fromComp)
    const tc = compMap.get(w.toComp)
    if (!fc || !tc) return

    const p1 = normalizePin(fc, w.fromPin)
    const p2 = normalizePin(tc, w.toPin)
    if (!p1 || !p2) return

    const l1 = (p1.label || p1.id || '').toUpperCase()
    const l2 = (p2.label || p2.id || '').toUpperCase()

    if (l1.includes('SDA') || l2.includes('SDA')) {
      findOrAddToNet(sdaNets, `${w.fromComp}`, `${w.toComp}`)
    }
    if (l1.includes('SCL') || l2.includes('SCL')) {
      findOrAddToNet(sclNets, `${w.fromComp}`, `${w.toComp}`)
    }
  })

  // Merge overlapping nets
  function mergeNets(nets) {
    let merged = true
    while (merged) {
      merged = false
      for (let i = 0; i < nets.length; i++) {
        for (let j = i + 1; j < nets.length; j++) {
          const intersect = [...nets[i]].some(x => nets[j].has(x))
          if (intersect) {
            nets[j].forEach(x => nets[i].add(x))
            nets.splice(j, 1)
            merged = true
            break
          }
        }
        if (merged) break
      }
    }
    return nets
  }

  const mergedSda = mergeNets(sdaNets)

  mergedSda.forEach((compSet, netIdx) => {
    const addrMap = new Map() // addr -> list of comp instances
    compSet.forEach(instId => {
      const comp = compMap.get(instId)
      if (!comp || comp.isMCU) return
      const cid = (comp.id || '').toLowerCase()
      for (const [key, profile] of Object.entries(I2C_DEVICE_PROFILES)) {
        if (cid.includes(key)) {
          if (!addrMap.has(profile.addr)) addrMap.set(profile.addr, [])
          addrMap.get(profile.addr).push({ comp, profile })
          break
        }
      }
    })

    addrMap.forEach((devices, addr) => {
      if (devices.length > 1) {
        const names = devices.map(d => `"${d.comp.label || d.comp.id}"`).join(' dan ')
        const alt = devices[0].profile.alt ? ` (misal: ${devices[0].profile.alt})` : ''
        issues.push({
          id: `erc_i2c_conflict_${netIdx}_${addr}`,
          level: 'error',
          title: `Konflik Alamat I2C Bus Terdeteksi (${addr})`,
          desc: `Komponen ${names} terhubung pada bus I2C yang sama dan memakai alamat default identik (${addr}). Komunikasi I2C akan gagal karena tabrakan ACK/NACK. Rekomendasi: Ubah pin jumper ADDR ke alamat alternatif${alt} atau pasang I2C Multiplexer TCA9548A.`,
          compA: devices[0].comp.instanceId,
          compB: devices[1].comp.instanceId
        })
      }
    })
  })

  // 4. Power Budget Analysis
  const powerBudget = calculatePowerBudget(components)
  if (powerBudget.warningMessage) {
    issues.push({
      id: 'erc_power_budget_warning',
      level: powerBudget.status === 'danger' ? 'error' : 'warning',
      title: '⚠️ Kelebihan Beban Arus (Power Budget Deficit)',
      desc: powerBudget.warningMessage
    })
  }

  const errors = issues.filter(i => i.level === 'error')
  const warnings = issues.filter(i => i.level === 'warning')
  const info = issues.filter(i => i.level === 'info')

  return {
    issues,
    errors,
    warnings,
    info,
    powerBudget,
    totalCount: issues.length,
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok'
  }
}

