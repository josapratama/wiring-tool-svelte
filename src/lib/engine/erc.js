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
      // Allow voltage divider or buck converter connections
      const isDivider = fc.id?.includes('divider') || tc.id?.includes('divider') ||
                        fc.id?.includes('buck') || tc.id?.includes('buck')
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

  const errors = issues.filter(i => i.level === 'error')
  const warnings = issues.filter(i => i.level === 'warning')
  const info = issues.filter(i => i.level === 'info')

  return {
    issues,
    errors,
    warnings,
    info,
    totalCount: issues.length,
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok'
  }
}

