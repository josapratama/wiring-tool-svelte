/**
 * Wokwi diagram.json Export Engine
 * Converts components and wires to the official Wokwi simulation diagram specification.
 */

const WOKWI_PART_MAP = {
  'esp32-devkit': 'wokwi-esp32-devkit-v1',
  'esp32s3-devkit': 'board-esp32-s3-devkitc-1',
  'arduino-uno': 'wokwi-arduino-uno',
  'arduino-nano': 'wokwi-arduino-nano',
  'arduino-mega': 'wokwi-arduino-mega',
  'rpi-pico': 'wokwi-pi-pico',
  'oled-ssd1306': 'wokwi-ssd1306',
  'oled-sh1106': 'wokwi-ssd1306',
  'lcd-16x2': 'wokwi-lcd1602',
  'dht22': 'wokwi-dht22',
  'hc-sr04': 'wokwi-hc-sr04',
  'mpu6050': 'wokwi-mpu6050',
  'bme280': 'wokwi-bme280',
  'resistor': 'wokwi-resistor',
  'led': 'wokwi-led',
  'pushbutton': 'wokwi-pushbutton',
  'buzzer': 'wokwi-buzzer',
  'relay': 'wokwi-relay-module',
  'ntc-thermistor': 'wokwi-ntc-temperature-sensor',
  'potentiometer': 'wokwi-potentiometer',
}

function cleanPartId(str) {
  return str.toLowerCase().replace(/[^a-z0-9_]/g, '_')
}

function normalizeWokwiPin(compId, pinId) {
  let pid = String(pinId || '').trim()

  // For ESP32 GPIOs: G15, IO15, GPIO15 -> 15
  if (/^G(?:PIO)?\d+$/i.test(pid)) {
    return pid.replace(/^G(?:PIO)?/i, '')
  }
  // For Arduino: D2..D13 -> 2..13, A0..A5 -> A0..A5
  if (/^D(\d+)$/i.test(pid)) {
    return pid.replace(/^D/i, '')
  }
  // Standard power names
  if (pid.toUpperCase() === 'V3V3' || pid.toUpperCase() === '3V3') return '3V3'
  if (pid.toUpperCase() === 'V5' || pid.toUpperCase() === '5V') return '5V'
  if (pid.toUpperCase() === 'VIN' || pid.toUpperCase() === 'VBUS') return 'VIN'
  if (pid.toUpperCase() === 'GND' || pid.toUpperCase() === 'VSS') return 'GND'

  // LED pins
  if (pid === 'A') return 'A'
  if (pid === 'K' || pid === '-') return 'C'

  return pid
}

function colorName(hex) {
  const map = {
    '#ef4444': 'red',
    '#374151': 'black',
    '#4ade80': 'green',
    '#f59e0b': 'orange',
    '#a78bfa': 'purple',
    '#60a5fa': 'blue',
    '#34d399': 'turquoise',
    '#fb923c': 'orange',
    '#facc15': 'yellow',
    '#818cf8': 'blue',
    '#ffffff': 'white',
  }
  return map[hex?.toLowerCase()] || hex || 'green'
}

export function generateWokwiDiagram(components = [], wires = [], projectName = 'WiringProject') {
  const partIdMap = new Map()
  const usedIds = new Set()

  const parts = components.map((c, i) => {
    let baseId = cleanPartId(c.label || c.id || `part_${i}`)
    if (baseId.length > 15) baseId = baseId.slice(0, 15)
    let finalId = baseId
    let count = 1
    while (usedIds.has(finalId)) {
      finalId = `${baseId}_${count++}`
    }
    usedIds.add(finalId)
    partIdMap.set(c.instanceId, finalId)

    const wokwiType = WOKWI_PART_MAP[c.id] || 'wokwi-custom-part'
    const attrs = {}

    if (c.props) {
      if (c.props.value) attrs.value = String(c.props.value)
    }

    return {
      type: wokwiType,
      id: finalId,
      top: Math.round(c.y || 0),
      left: Math.round(c.x || 0),
      attrs
    }
  })

  const connections = []
  wires.forEach(w => {
    const fromPart = partIdMap.get(w.fromComp)
    const toPart = partIdMap.get(w.toComp)
    if (!fromPart || !toPart) return

    const fromPin = normalizeWokwiPin(w.fromComp, w.fromPin)
    const toPin = normalizeWokwiPin(w.toComp, w.toPin)
    const col = colorName(w.color)

    connections.push([
      `${fromPart}:${fromPin}`,
      `${toPart}:${toPin}`,
      col,
      ['h0']
    ])
  })

  return {
    version: 1,
    author: 'Antigravity Wiring Tool',
    editor: 'wokwi',
    project: projectName,
    parts,
    connections,
    dependencies: {}
  }
}

