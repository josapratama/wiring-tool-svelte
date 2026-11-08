/**
 * Pin Definition Code Generator
 * Converts diagram connections to ready-to-use C/C++ (Arduino/ESP-IDF) and MicroPython headers.
 */
import { MCU_PINS } from '$lib/data/mcu-pins.js'

function sanitizeName(str) {
  return str
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function extractGpioNum(pinId, pinLabel, pinNum) {
  if (pinNum && /^\d+$/.test(String(pinNum).trim())) {
    return String(pinNum).trim()
  }
  // Try matching G8, IO8, D8, GPIO8
  const m = String(pinLabel || pinId).match(/(?:GPIO|IO|D|G)?(\d+)/i)
  if (m && m[1]) return m[1]
  return String(pinLabel || pinId)
}

export function generatePinCode(components = [], wires = [], projectName = 'WiringDiagram') {
  const mcus = components.filter(c => c.isMCU)
  const compMap = new Map(components.map(c => [c.instanceId, c]))

  if (!mcus.length) {
    return {
      cpp: '// Tidak ada komponen MCU (ESP32 / Arduino / RPi) yang ditemukan di diagram.',
      python: '# Tidak ada komponen MCU (ESP32 / Arduino / RPi) yang ditemukan di diagram.',
      sketch: '// Tambahkan MCU (ESP32 / Arduino) ke kanvas untuk men-generate kode firmware.'
    }
  }

  const sections = []

  mcus.forEach(mcu => {
    const mcuPins = MCU_PINS[mcu.id]
    const allMcuPins = mcuPins ? [...(mcuPins.left || []), ...(mcuPins.right || [])] : []
    const mcuPinMap = new Map(allMcuPins.map(p => [p.id, p]))

    const mcuConnections = []

    wires.forEach(w => {
      let mcuPinId = null
      let otherCompId = null
      let otherPinId = null

      if (w.fromComp === mcu.instanceId) {
        mcuPinId = w.fromPin
        otherCompId = w.toComp
        otherPinId = w.toPin
      } else if (w.toComp === mcu.instanceId) {
        mcuPinId = w.toPin
        otherCompId = w.fromComp
        otherPinId = w.fromPin
      }

      if (!mcuPinId || !otherCompId) return

      const otherComp = compMap.get(otherCompId)
      if (!otherComp) return

      const mcuPin = mcuPinMap.get(mcuPinId) || { id: mcuPinId, label: mcuPinId }
      const gpioVal = extractGpioNum(mcuPin.id, mcuPin.label, mcuPin.num)

      // Skip non-GPIO pins like GND, 5V, 3V3, EN
      const pinType = mcuPin.type || ''
      if (pinType === 'gnd' || pinType === 'power' || mcuPin.id === 'EN') return

      const compBase = sanitizeName(otherComp.label || otherComp.name || otherComp.id)
      const pinBase = sanitizeName(otherPinId)
      const macroName = `PIN_${compBase}_${pinBase}`

      mcuConnections.push({
        macroName,
        gpioVal,
        compLabel: otherComp.label || otherComp.name,
        pinLabel: otherPinId,
        mcuPinLabel: mcuPin.label || mcuPin.id,
        wireLabel: w.label || ''
      })
    })

    sections.push({
      mcuName: mcu.label || mcu.name || mcu.id,
      connections: mcuConnections
    })
  })

  // 1. Generate C / C++ header
  let cpp = `// =============================================================================\n`
  cpp += `// Auto-generated Pin Definitions\n`
  cpp += `// Project: ${projectName}\n`
  cpp += `// Date: ${new Date().toLocaleString()}\n`
  cpp += `// Tool: WiringTool Svelte\n`
  cpp += `// =============================================================================\n\n`
  cpp += `#pragma once\n\n`

  sections.forEach(sec => {
    cpp += `// ─────────────────────────────────────────────────────────────────────────────\n`
    cpp += `// Target MCU: ${sec.mcuName}\n`
    cpp += `// ─────────────────────────────────────────────────────────────────────────────\n`
    if (!sec.connections.length) {
      cpp += `// (Belum ada pin GPIO yang terhubung ke modul eksternal)\n\n`
      return
    }
    sec.connections.forEach(c => {
      const comment = c.wireLabel ? ` // ${c.compLabel} (${c.pinLabel}) [Net: ${c.wireLabel}]` : ` // ${c.compLabel} (${c.pinLabel})`
      cpp += `#define ${c.macroName.padEnd(28)} ${c.gpioVal.padEnd(4)}${comment}\n`
    })
    cpp += `\n`
  })

  // 2. Generate Python / MicroPython
  let py = `# =============================================================================\n`
  py += `# Auto-generated Pin Definitions for MicroPython / CircuitPython\n`
  py += `# Project: ${projectName}\n`
  py += `# Date: ${new Date().toLocaleString()}\n`
  py += `# Tool: WiringTool Svelte\n`
  py += `# =============================================================================\n\n`
  py += `from machine import Pin\n\n`

  sections.forEach(sec => {
    py += `# --- Target MCU: ${sec.mcuName} ---\n`
    if (!sec.connections.length) {
      py += `# (Belum ada pin GPIO yang terhubung ke modul eksternal)\n\n`
      return
    }
    sec.connections.forEach(c => {
      const comment = c.wireLabel ? ` # ${c.compLabel} (${c.pinLabel}) [Net: ${c.wireLabel}]` : ` # ${c.compLabel} (${c.pinLabel})`
      py += `${c.macroName.padEnd(28)} = ${c.gpioVal.padEnd(4)}${comment}\n`
    })
    py += `\n`
  })

  // 3. Generate Complete Arduino Sketch (.ino)
  let sketch = `// =============================================================================\n`
  sketch += `// Ready-to-Run Arduino / ESP32 Firmware Sketch\n`
  sketch += `// Project: ${projectName}\n`
  sketch += `// Date: ${new Date().toLocaleString()}\n`
  sketch += `// =============================================================================\n\n`

  sections.forEach(sec => {
    sec.connections.forEach(c => {
      sketch += `const int ${c.macroName} = ${c.gpioVal}; // ${c.compLabel} (${c.pinLabel})\n`
    })
  })

  sketch += `\nvoid setup() {\n`
  sketch += `  Serial.begin(115200);\n`
  sketch += `  delay(500);\n`
  sketch += `  Serial.println("${projectName} Initialized!");\n\n`

  sections.forEach(sec => {
    sec.connections.forEach(c => {
      const isInput =
        c.compLabel.toLowerCase().includes('btn') ||
        c.compLabel.toLowerCase().includes('button') ||
        c.compLabel.toLowerCase().includes('sensor') ||
        c.compLabel.toLowerCase().includes('switch') ||
        c.pinLabel.toLowerCase().includes('in')
      const mode = isInput ? 'INPUT_PULLUP' : 'OUTPUT'
      sketch += `  pinMode(${c.macroName}, ${mode});\n`
    })
  })
  sketch += `}\n\n`
  sketch += `void loop() {\n`
  sketch += `  Serial.println("[Heartbeat] System running...");\n`

  const firstOutput = sections[0]?.connections.find(c =>
    c.compLabel.toLowerCase().includes('led') ||
    c.compLabel.toLowerCase().includes('buzzer') ||
    c.compLabel.toLowerCase().includes('relay')
  )

  if (firstOutput) {
    sketch += `  digitalWrite(${firstOutput.macroName}, HIGH);\n`
    sketch += `  delay(1000);\n`
    sketch += `  digitalWrite(${firstOutput.macroName}, LOW);\n`
    sketch += `  delay(1000);\n`
  } else {
    sketch += `  delay(1000);\n`
  }
  sketch += `}\n`

  return { cpp, python: py, sketch }
}

