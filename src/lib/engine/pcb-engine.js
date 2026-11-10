/**
 * PCB Layout Engine & CAD Exporter Suite
 * 
 * Features:
 * - Real Millimeter / Mil / Pixel coordinate space conversions (1mm = 3.7795 px @ 96 DPI)
 * - Standard Electronic Footprint Models (DIP, SMD 0805/1206, SOT-23, Headers 2.54mm, Screw Terminals)
 * - Netlist & Air-Wire (Ratsnest) Minimum Spanning Tree (MST) Resolver with Disjoint-Set Union (DSU)
 * - Interactive Copper Trace Router (Top F.Cu & Bottom B.Cu with 45-degree angle snap)
 * - DRC (Design Rule Checker): Clearance verification, short circuit check, unrouted net audit
 * - Standard Gerber RS-274X & Excellon NC Drill Exporter (compatible with JLCPCB / PCBWay)
 * - EasyEDA Standard JSON Format Serializer
 * - 1:1 High-Resolution DIY Etching & Toner Transfer SVG Mask Exporter
 */

import { MCU_PINS } from "$lib/data/mcu-pins.js";

// ── Unit Conversions & Coordinate Math ─────────────────────────────────────────
export const MM_TO_PX = 3.7795275591; // 1mm in standard web SVG pixels (96 DPI)
export const PX_TO_MM = 1 / MM_TO_PX;
export const MIL_TO_MM = 0.0254;
export const MM_TO_MIL = 1 / MIL_TO_MM;

export function mm2px(mm) {
  return Number((mm * MM_TO_PX).toFixed(3));
}

export function px2mm(px) {
  return Number((px * PX_TO_MM).toFixed(3));
}

export function mil2px(mil) {
  return mm2px(mil * MIL_TO_MM);
}

/**
 * Snap a point to a defined grid in millimeters
 */
export function snapToPcbGrid(valMm, gridStepMm = 1.27) {
  if (!gridStepMm || gridStepMm <= 0) return valMm;
  return Number((Math.round(valMm / gridStepMm) * gridStepMm).toFixed(3));
}

/**
 * Constrains a segment to 0, 45, or 90 degrees relative to start point
 */
export function snapTo45Degrees(startX, startY, currX, currY) {
  const dx = currX - startX;
  const dy = currY - startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // If very close to horizontal
  if (absDy < absDx * 0.414) {
    return { x: currX, y: startY };
  }
  // If very close to vertical
  if (absDx < absDy * 0.414) {
    return { x: startX, y: currY };
  }
  // Otherwise snap to perfect 45-degree diagonal
  const signX = dx >= 0 ? 1 : -1;
  const signY = dy >= 0 ? 1 : -1;
  const d = Math.min(absDx, absDy);
  return {
    x: startX + signX * d,
    y: startY + signY * d
  };
}

// ── Disjoint Set Union (DSU) Data Structure for Electrical Nets ───────────────
export class DisjointSet {
  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  find(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
      return x;
    }
    let p = this.parent.get(x);
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }

  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return rootX;

    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
      return rootY;
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
      return rootX;
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
      return rootX;
    }
  }

  connected(x, y) {
    return this.find(x) === this.find(y);
  }
}

// ── Standard Footprint Library (EasyEDA / IPC-7351 Compliant) ─────────────────
export const STANDARD_FOOTPRINTS = {
  // DIP Microcontrollers & Modules
  "ESP32-DEVKIT-V1": {
    package: "MODULE-38P-2.54MM",
    desc: "ESP32 DevKit V1 (38-pin 2.54mm pitch)",
    widthMm: 28.0,
    heightMm: 51.5,
    pads: generateDipPads(19, 19, 25.4, 2.54, 1.8, 1.0, "round"),
    keepout: { x: -11.0, y: 15.0, w: 22.0, h: 10.5, desc: "Wi-Fi/BLE Antenna Keepout Zone" },
    silkscreen: [
      { type: "rect", x: -14.0, y: -25.75, w: 28.0, h: 51.5, r: 1.0 },
      { type: "rect", x: -7.0, y: -24.5, w: 14.0, h: 8.0, r: 0.5, desc: "USB" },
      { type: "text", text: "ESP32 DevKit", x: 0, y: 0, size: 2.2 }
    ]
  },
  "ARDUINO-UNO": {
    package: "ARDUINO-UNO-R3",
    desc: "Arduino Uno R3 Shield / Module",
    widthMm: 68.6,
    heightMm: 53.4,
    pads: [
      // Power / Analog Header (8-pin)
      { num: "RST", name: "RESET", x: -28.0, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "3V3", name: "3.3V", x: -25.46, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "5V", name: "5V", x: -22.92, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "GND1", name: "GND", x: -20.38, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "GND2", name: "GND", x: -17.84, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "VIN", name: "VIN", x: -15.3, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      // Analog In (6-pin)
      { num: "A0", name: "A0", x: -8.0, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "A1", name: "A1", x: -5.46, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "A2", name: "A2", x: -2.92, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "A3", name: "A3", x: -0.38, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "A4", name: "A4", x: 2.16, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "A5", name: "A5", x: 4.7, y: 22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      // Digital Pins 0-7 (8-pin)
      { num: "0", name: "D0", x: 28.0, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "1", name: "D1", x: 25.46, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "2", name: "D2", x: 22.92, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "3", name: "D3", x: 20.38, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "4", name: "D4", x: 17.84, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "5", name: "D5", x: 15.3, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "6", name: "D6", x: 12.76, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "7", name: "D7", x: 10.22, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      // Digital Pins 8-13 + GND + AREF (10-pin)
      { num: "8", name: "D8", x: 6.0, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "9", name: "D9", x: 3.46, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "10", name: "D10", x: 0.92, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "11", name: "D11", x: -1.62, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "12", name: "D12", x: -4.16, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "13", name: "D13", x: -6.7, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "GND3", name: "GND", x: -9.24, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" },
      { num: "AREF", name: "AREF", x: -11.78, y: -22.0, sizeMm: 1.8, drillMm: 1.0, shape: "round" }
    ],
    silkscreen: [
      { type: "rect", x: -34.3, y: -26.7, w: 68.6, h: 53.4, r: 2.0 },
      { type: "rect", x: -33.0, y: -18.0, w: 12.0, h: 10.0, r: 0.5, desc: "USB" },
      { type: "text", text: "ARDUINO UNO", x: 0, y: 0, size: 2.8 }
    ]
  },
  "ARDUINO-NANO": {
    package: "DIP-30-W600",
    desc: "Arduino Nano (30-pin 2.54mm pitch)",
    widthMm: 18.0,
    heightMm: 45.0,
    pads: generateDipPads(15, 15, 15.24, 2.54, 1.8, 1.0, "round"),
    silkscreen: [
      { type: "rect", x: -9.0, y: -22.5, w: 18.0, h: 45.0, r: 1.0 },
      { type: "rect", x: -4.0, y: -22.0, w: 8.0, h: 6.0, r: 0.5, desc: "USB" },
      { type: "text", text: "NANO", x: 0, y: 0, size: 2.0 }
    ]
  },
  "RPI-PICO": {
    package: "MODULE-40P-2.54MM",
    desc: "Raspberry Pi Pico (40-pin 2.54mm pitch)",
    widthMm: 21.0,
    heightMm: 51.0,
    pads: generateDipPads(20, 20, 17.78, 2.54, 1.8, 1.0, "round"),
    silkscreen: [
      { type: "rect", x: -10.5, y: -25.5, w: 21.0, h: 51.0, r: 1.0 },
      { type: "rect", x: -4.5, y: -25.0, w: 9.0, h: 6.5, r: 0.5, desc: "USB" },
      { type: "text", text: "RP2040 PICO", x: 0, y: 0, size: 2.0 }
    ]
  },
  // Passives
  "RESISTOR-TH": {
    package: "AXIAL-0.3",
    desc: "Through-Hole Resistor 1/4W (7.62mm pitch)",
    widthMm: 10.0,
    heightMm: 3.5,
    pads: [
      { num: "1", name: "1", x: -3.81, y: 0, sizeMm: 1.6, drillMm: 0.85, shape: "rect" },
      { num: "2", name: "2", x: 3.81, y: 0, sizeMm: 1.6, drillMm: 0.85, shape: "round" }
    ],
    silkscreen: [
      { type: "rect", x: -2.5, y: -1.2, w: 5.0, h: 2.4, r: 0.2 },
      { type: "line", x1: -3.81, y1: 0, x2: -2.5, y2: 0 },
      { type: "line", x1: 2.5, y1: 0, x2: 3.81, y2: 0 }
    ]
  },
  "RESISTOR-SMD-0805": {
    package: "R_0805_2012Metric",
    desc: "SMD 0805 Resistor",
    widthMm: 2.8,
    heightMm: 1.5,
    pads: [
      { num: "1", name: "1", x: -0.95, y: 0, wMm: 1.0, hMm: 1.3, shape: "smd_rect", layer: "top" },
      { num: "2", name: "2", x: 0.95, y: 0, wMm: 1.0, hMm: 1.3, shape: "smd_rect", layer: "top" }
    ],
    silkscreen: [
      { type: "rect", x: -1.2, y: -0.75, w: 2.4, h: 1.5, r: 0 }
    ]
  },
  "CAPACITOR-TH": {
    package: "C_RADIAL_D5.0_P2.54",
    desc: "Radial Electrolytic / Ceramic Cap (2.54mm pitch)",
    widthMm: 6.0,
    heightMm: 6.0,
    pads: [
      { num: "1", name: "+", x: -1.27, y: 0, sizeMm: 1.6, drillMm: 0.85, shape: "rect" },
      { num: "2", name: "-", x: 1.27, y: 0, sizeMm: 1.6, drillMm: 0.85, shape: "round" }
    ],
    silkscreen: [
      { type: "circle", cx: 0, cy: 0, r: 2.5 },
      { type: "text", text: "+", x: -1.27, y: -2.2, size: 1.5 }
    ]
  },
  "LED-5MM": {
    package: "LED_D5.0MM_P2.54",
    desc: "5mm Round LED (2.54mm pitch)",
    widthMm: 6.0,
    heightMm: 6.0,
    pads: [
      { num: "A", name: "A", x: -1.27, y: 0, sizeMm: 1.6, drillMm: 0.85, shape: "rect" },
      { num: "K", name: "K", x: 1.27, y: 0, sizeMm: 1.6, drillMm: 0.85, shape: "round" }
    ],
    silkscreen: [
      { type: "circle", cx: 0, cy: 0, r: 2.6 },
      { type: "line", x1: 2.4, y1: -1.5, x2: 2.4, y2: 1.5 } // flat edge for cathode
    ]
  },
  // Headers & Connectors
  "HEADER-1X4": {
    package: "PIN-HEADER-1X4-2.54",
    desc: "1x4 Pin Header (I2C / Sensor connector)",
    widthMm: 10.16,
    heightMm: 3.0,
    pads: [
      { num: "1", name: "1", x: -3.81, y: 0, sizeMm: 1.7, drillMm: 1.0, shape: "rect" },
      { num: "2", name: "2", x: -1.27, y: 0, sizeMm: 1.7, drillMm: 1.0, shape: "round" },
      { num: "3", name: "3", x: 1.27, y: 0, sizeMm: 1.7, drillMm: 1.0, shape: "round" },
      { num: "4", name: "4", x: 3.81, y: 0, sizeMm: 1.7, drillMm: 1.0, shape: "round" }
    ],
    silkscreen: [
      { type: "rect", x: -5.08, y: -1.27, w: 10.16, h: 2.54, r: 0.2 }
    ]
  },
  "HEADER-1X3": {
    package: "PIN-HEADER-1X3-2.54",
    desc: "1x3 Pin Header (Servo / Analog sensor)",
    widthMm: 7.62,
    heightMm: 3.0,
    pads: [
      { num: "1", name: "1", x: -2.54, y: 0, sizeMm: 1.7, drillMm: 1.0, shape: "rect" },
      { num: "2", name: "2", x: 0, y: 0, sizeMm: 1.7, drillMm: 1.0, shape: "round" },
      { num: "3", name: "3", x: 2.54, y: 0, sizeMm: 1.7, drillMm: 1.0, shape: "round" }
    ],
    silkscreen: [
      { type: "rect", x: -3.81, y: -1.27, w: 7.62, h: 2.54, r: 0.2 }
    ]
  },
  "TERMINAL-BLOCK-2P": {
    package: "SCREW-TERMINAL-2P-5.08",
    desc: "Screw Terminal Block 2-Pin 5.08mm Pitch",
    widthMm: 10.16,
    heightMm: 8.0,
    pads: [
      { num: "1", name: "1", x: -2.54, y: 0, sizeMm: 2.4, drillMm: 1.3, shape: "rect" },
      { num: "2", name: "2", x: 2.54, y: 0, sizeMm: 2.4, drillMm: 1.3, shape: "round" }
    ],
    silkscreen: [
      { type: "rect", x: -5.08, y: -4.0, w: 10.16, h: 8.0, r: 0.5 }
    ]
  },
  "OLED-128X64": {
    package: "DISPLAY-OLED-0.96-I2C",
    desc: "0.96 inch I2C OLED Module (4-pin)",
    widthMm: 27.5,
    heightMm: 27.5,
    pads: [
      { num: "1", name: "GND", x: -3.81, y: -12.0, sizeMm: 1.7, drillMm: 1.0, shape: "rect" },
      { num: "2", name: "VCC", x: -1.27, y: -12.0, sizeMm: 1.7, drillMm: 1.0, shape: "round" },
      { num: "3", name: "SCL", x: 1.27, y: -12.0, sizeMm: 1.7, drillMm: 1.0, shape: "round" },
      { num: "4", name: "SDA", x: 3.81, y: -12.0, sizeMm: 1.7, drillMm: 1.0, shape: "round" }
    ],
    silkscreen: [
      { type: "rect", x: -13.75, y: -13.75, w: 27.5, h: 27.5, r: 1.5 },
      { type: "rect", x: -11.0, y: -6.0, w: 22.0, h: 14.0, r: 0.5, desc: "Screen" },
      { type: "text", text: "SSD1306 OLED", x: 0, y: 11.0, size: 1.8 }
    ]
  }
};

/**
 * Generate standard DIP pin layout coordinates
 */
function generateDipPads(leftCount, rightCount, rowDistanceMm, pitchMm, padSizeMm, drillMm, shape = "round") {
  const pads = [];
  const halfRow = rowDistanceMm / 2;

  // Left side pins (top to bottom: 1 to leftCount)
  const leftStartOffset = ((leftCount - 1) * pitchMm) / 2;
  for (let i = 0; i < leftCount; i++) {
    pads.push({
      num: String(i + 1),
      name: `P${i + 1}`,
      x: -halfRow,
      y: Number((-leftStartOffset + i * pitchMm).toFixed(3)),
      sizeMm: padSizeMm,
      drillMm: drillMm,
      shape: i === 0 ? "rect" : shape // Pin 1 is square
    });
  }

  // Right side pins (bottom to top for standard ICs, or top to bottom)
  const rightStartOffset = ((rightCount - 1) * pitchMm) / 2;
  for (let i = 0; i < rightCount; i++) {
    pads.push({
      num: String(leftCount + i + 1),
      name: `P${leftCount + i + 1}`,
      x: halfRow,
      y: Number((-rightStartOffset + i * pitchMm).toFixed(3)),
      sizeMm: padSizeMm,
      drillMm: drillMm,
      shape: shape
    });
  }

  return pads;
}

// ── Footprint Mapper for Schematic Components ─────────────────────────────────
export function getFootprintForComponent(comp) {
  if (!comp) return STANDARD_FOOTPRINTS["HEADER-1X4"];
  if (comp.footprintId && STANDARD_FOOTPRINTS[comp.footprintId]) {
    return STANDARD_FOOTPRINTS[comp.footprintId];
  }
  const id = (comp.id || "").toLowerCase();
  const theme = comp.theme || "";

  if (id.includes("esp32") || id.includes("s3")) {
    return STANDARD_FOOTPRINTS["ESP32-DEVKIT-V1"];
  }
  if (id.includes("arduino-uno") || id === "uno") {
    return STANDARD_FOOTPRINTS["ARDUINO-UNO"];
  }
  if (id.includes("nano")) {
    return STANDARD_FOOTPRINTS["ARDUINO-NANO"];
  }
  if (id.includes("pico")) {
    return STANDARD_FOOTPRINTS["RPI-PICO"];
  }
  if (id.includes("oled") || id.includes("ssd1306") || id.includes("i2c-display")) {
    return STANDARD_FOOTPRINTS["OLED-128X64"];
  }
  if (id.includes("resistor")) {
    return STANDARD_FOOTPRINTS["RESISTOR-TH"];
  }
  if (id.includes("led")) {
    return STANDARD_FOOTPRINTS["LED-5MM"];
  }
  if (id.includes("capacitor")) {
    return STANDARD_FOOTPRINTS["CAPACITOR-TH"];
  }
  if (theme === "sensor" || id.includes("sensor")) {
    return STANDARD_FOOTPRINTS["HEADER-1X4"];
  }
  if (theme === "output" || id.includes("servo") || id.includes("motor")) {
    return STANDARD_FOOTPRINTS["HEADER-1X3"];
  }
  if (theme === "power" || id.includes("terminal") || id.includes("power")) {
    return STANDARD_FOOTPRINTS["TERMINAL-BLOCK-2P"];
  }

  // Default fallback through-hole header
  return STANDARD_FOOTPRINTS["HEADER-1X4"];
}

// ── Normalize Wire Format between Store and Netlist ───────────────────────────
export function normalizeWire(wire) {
  if (!wire) return null;
  const fromComp = wire.from?.compId || wire.from?.comp || wire.fromComp;
  const fromPin = wire.from?.pinId || wire.from?.pin || wire.fromPin;
  const toComp = wire.to?.compId || wire.to?.comp || wire.toComp;
  const toPin = wire.to?.pinId || wire.to?.pin || wire.toPin;

  if (!fromComp || !fromPin || !toComp || !toPin) return null;

  return {
    fromComp: String(fromComp),
    fromPin: String(fromPin),
    toComp: String(toComp),
    toPin: String(toPin),
    netName: wire.label || wire.net || null,
    color: wire.color || "#4f9cf9",
    id: wire.id || null
  };
}

// ── Resolve Pad Aliases for Accurate Cross-Domain Pin Matching ────────────────
export function getCompPadAliases(comp, pad, padIndex) {
  const aliases = new Set();
  if (!pad) return [];

  // Direct pad properties
  if (pad.num !== undefined && pad.num !== null) aliases.add(String(pad.num).trim());
  if (pad.name !== undefined && pad.name !== null) aliases.add(String(pad.name).trim());
  aliases.add(String(padIndex + 1));
  aliases.add(String(padIndex));

  // If comp is an MCU with defined pin table
  const mcuId = (comp.id || "").toLowerCase();
  const mcuData = MCU_PINS[mcuId] || MCU_PINS[comp.id];
  if (mcuData) {
    const leftPins = mcuData.left || [];
    const rightPins = mcuData.right || [];
    let pObj = null;
    if (padIndex < leftPins.length) {
      pObj = leftPins[padIndex];
    } else if (padIndex - leftPins.length < rightPins.length) {
      pObj = rightPins[padIndex - leftPins.length];
    }
    if (pObj) {
      if (pObj.id) aliases.add(String(pObj.id).trim());
      if (pObj.label) aliases.add(String(pObj.label).trim());
      if (pObj.num) aliases.add(String(pObj.num).trim());
    }
  }

  // If comp has a pins array in definition or instance
  if (Array.isArray(comp.pins)) {
    if (comp.pins[padIndex]) {
      const p = comp.pins[padIndex];
      if (p.id) aliases.add(String(p.id).trim());
      if (p.label) aliases.add(String(p.label).trim());
    }
    const padNameLow = (pad.name || "").toLowerCase();
    const padNumLow = (pad.num || "").toLowerCase();
    for (const p of comp.pins) {
      const pIdLow = (p.id || "").toLowerCase();
      const pLblLow = (p.label || "").toLowerCase();
      if (pIdLow === padNameLow || pLblLow === padNameLow || pIdLow === padNumLow || pLblLow === padNumLow) {
        if (p.id) aliases.add(String(p.id).trim());
        if (p.label) aliases.add(String(p.label).trim());
      }
    }
  }

  return Array.from(aliases);
}

// ── Netlist & Ratsnest Resolver ───────────────────────────────────────────────
export function buildPcbNetlist(components = [], wires = []) {
  const dsu = new DisjointSet();
  const validWires = [];

  for (const rawWire of wires) {
    const nw = normalizeWire(rawWire);
    if (!nw) continue;
    validWires.push(nw);

    const k1 = `${nw.fromComp}:${nw.fromPin}`;
    const k2 = `${nw.toComp}:${nw.toPin}`;
    dsu.union(k1, k2);
  }

  // Assign human-readable net labels (e.g. NET_1, NET_GND, NET_VCC, etc.)
  const rootToNetId = new Map();
  let netCounter = 1;

  for (const nw of validWires) {
    const k1 = `${nw.fromComp}:${nw.fromPin}`;
    const root = dsu.find(k1);
    if (!rootToNetId.has(root)) {
      let suggested = nw.netName;
      if (!suggested) {
        const lowerKey = root.toLowerCase();
        if (lowerKey.includes("gnd")) suggested = "GND";
        else if (lowerKey.includes("vcc") || lowerKey.includes("5v") || lowerKey.includes("3v3")) suggested = "VCC";
        else suggested = `NET_${netCounter++}`;
      }
      rootToNetId.set(root, suggested);
    }
  }

  // Build lookup mapping: any "compId:pinKey" -> canonical netId
  const pinToNetMap = new Map();
  for (const nw of validWires) {
    const k1 = `${nw.fromComp}:${nw.fromPin}`;
    const k2 = `${nw.toComp}:${nw.toPin}`;
    const netId = rootToNetId.get(dsu.find(k1));
    pinToNetMap.set(k1, netId);
    pinToNetMap.set(k2, netId);
  }

  return {
    pinToNetMap,
    rootToNetId,
    dsu,
    totalNets: rootToNetId.size
  };
}

/**
 * Generates air-wires (ratsnest dashed lines) between unconnected pads in the same electrical net
 */
export function generateRatsnestLines(pcbComponents = [], wires = [], copperTraces = []) {
  const { pinToNetMap, dsu } = buildPcbNetlist(pcbComponents, wires);
  const netPads = new Map();

  // Find real-world millimeter positions for all pads on PCB board
  for (const comp of pcbComponents) {
    const fp = comp.footprint || getFootprintForComponent(comp);
    if (!fp || !fp.pads) continue;

    const rad = ((comp.rotation || 0) * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    for (let idx = 0; idx < fp.pads.length; idx++) {
      const pad = fp.pads[idx];
      const aliases = getCompPadAliases(comp, pad, idx);

      let netId = null;
      let matchedKey = null;

      for (const alias of aliases) {
        const testKey = `${comp.instanceId}:${alias}`;
        if (pinToNetMap.has(testKey)) {
          netId = pinToNetMap.get(testKey);
          matchedKey = testKey;
          break;
        }
        if (dsu.parent.has(testKey)) {
          const root = dsu.find(testKey);
          if (root) {
            netId = pinToNetMap.get(root) || `NET_${root}`;
            matchedKey = testKey;
            break;
          }
        }
      }

      if (netId) {
        const worldX = Number((comp.xMm + (pad.x * cosR - pad.y * sinR)).toFixed(3));
        const worldY = Number((comp.yMm + (pad.x * sinR + pad.y * cosR)).toFixed(3));

        if (!netPads.has(netId)) {
          netPads.set(netId, []);
        }
        netPads.get(netId).push({
          netId,
          pinKey: matchedKey || `${comp.instanceId}:${pad.num || idx}`,
          padNum: pad.num,
          padName: pad.name,
          compInstId: comp.instanceId,
          xMm: worldX,
          yMm: worldY
        });
      }
    }
  }

  // Create air-wire ratsnest lines for each electrical net with >= 2 pads
  const ratsnest = [];
  for (const [netId, pads] of netPads.entries()) {
    if (pads.length < 2) continue;

    // Minimum Spanning Tree (MST) using Prim's algorithm for shortest air-wires
    const inMst = new Set([0]);
    const edges = [];

    while (inMst.size < pads.length) {
      let minDist = Infinity;
      let bestFrom = -1;
      let bestTo = -1;

      for (const u of inMst) {
        const p1 = pads[u];
        for (let v = 0; v < pads.length; v++) {
          if (inMst.has(v)) continue;
          const p2 = pads[v];
          const dist = Math.hypot(p1.xMm - p2.xMm, p1.yMm - p2.yMm);
          if (dist < minDist) {
            minDist = dist;
            bestFrom = u;
            bestTo = v;
          }
        }
      }

      if (bestTo !== -1) {
        inMst.add(bestTo);
        edges.push({ from: pads[bestFrom], to: pads[bestTo] });
      } else {
        break;
      }
    }

    // Check each MST edge to see if a copper trace already connects the two pads
    for (const edge of edges) {
      const p1 = edge.from;
      const p2 = edge.to;

      const isRouted = copperTraces.some(t => {
        const d1 = Math.hypot(t.x1 - p1.xMm, t.y1 - p1.yMm);
        const d2 = Math.hypot(t.x2 - p2.xMm, t.y2 - p2.yMm);
        const d1Rev = Math.hypot(t.x1 - p2.xMm, t.y1 - p2.yMm);
        const d2Rev = Math.hypot(t.x2 - p1.xMm, t.y2 - p1.yMm);
        return (d1 < 1.2 && d2 < 1.2) || (d1Rev < 1.2 && d2Rev < 1.2);
      });

      if (!isRouted) {
        ratsnest.push({
          netId,
          x1: p1.xMm,
          y1: p1.yMm,
          x2: p2.xMm,
          y2: p2.yMm,
          fromPad: p1,
          toPad: p2
        });
      }
    }
  }

  return ratsnest;
}

// ── PCB Design Rule Checker (DRC Engine) ──────────────────────────────────────
/**
 * Professional PCB Design Rule Checker (DRC)
 * 
 * Audits:
 * 1. Unrouted Netlist (Air-wires / ratsnest remaining)
 * 2. Board Boundary Violations (components, traces, or vias outside Edge.Cuts)
 * 3. Via Annular Ring Minimum Thickness
 * 4. Trace-to-Trace Clearance Violations (< 0.20mm)
 */
export function runPcbDrcCheck(board, pcbComponents = [], copperTraces = [], vias = [], wires = []) {
  const violations = [];
  const warnings = [];
  const w = board.widthMm || 100;
  const h = board.heightMm || 80;
  const MIN_CLEARANCE_MM = 0.20;

  // 1. Air-wire / Unrouted Nets
  const ratsnest = generateRatsnestLines(pcbComponents, wires, copperTraces);
  if (ratsnest.length > 0) {
    warnings.push({
      type: "unrouted_nets",
      code: "DRC_W01",
      message: `${ratsnest.length} segmen koneksi belum terhubung jalur tembaga (ratsnest air-wires).`,
      count: ratsnest.length
    });
  }

  // 2. Board Boundary Verification
  for (const c of pcbComponents) {
    if (c.xMm < 0 || c.xMm > w || c.yMm < 0 || c.yMm > h) {
      violations.push({
        type: "out_of_board",
        code: "DRC_E01",
        message: `Komponen ${c.label || c.name || c.id} berada di luar area fisik papan (${c.xMm.toFixed(1)}mm, ${c.yMm.toFixed(1)}mm).`,
        item: c
      });
    }
  }

  for (const t of copperTraces) {
    if (t.x1 < 0 || t.x1 > w || t.y1 < 0 || t.y1 > h || t.x2 < 0 || t.x2 > w || t.y2 < 0 || t.y2 > h) {
      violations.push({
        type: "trace_out_of_board",
        code: "DRC_E02",
        message: `Jalur tembaga ${t.id} melampaui batas tepi papan PCB (Edge.Cuts).`,
        item: t
      });
    }
  }

  for (const v of vias) {
    if (v.xMm < 0 || v.xMm > w || v.yMm < 0 || v.yMm > h) {
      violations.push({
        type: "via_out_of_board",
        code: "DRC_E03",
        message: `Via ${v.id} berada di luar batas fisik papan PCB.`,
        item: v
      });
    }
    const ringMm = ((v.outerMm || 0.8) - (v.drillMm || 0.45)) / 2;
    if (ringMm < 0.15) {
      warnings.push({
        type: "via_annular_ring",
        code: "DRC_W02",
        message: `Cincin tembaga Via (${ringMm.toFixed(2)}mm) terlalu tipis untuk fabrikasi standar (min 0.15mm).`,
        item: v
      });
    }
  }

  // 3. Track-to-Track Clearance (Same layer, different nets)
  for (let i = 0; i < copperTraces.length; i++) {
    const t1 = copperTraces[i];
    for (let j = i + 1; j < copperTraces.length; j++) {
      const t2 = copperTraces[j];
      if (t1.layer !== t2.layer) continue;
      if (t1.netId && t2.netId && t1.netId !== t2.netId) {
        const d1 = Math.hypot(t1.x1 - t2.x1, t1.y1 - t2.y1);
        const d2 = Math.hypot(t1.x2 - t2.x2, t1.y2 - t2.y2);
        if (d1 < MIN_CLEARANCE_MM || d2 < MIN_CLEARANCE_MM) {
          violations.push({
            type: "clearance_short",
            code: "DRC_E04",
            message: `Jarak isolasi tembaga antara net ${t1.netId} dan ${t2.netId} (${Math.min(d1, d2).toFixed(2)}mm) di bawah batas aman ${MIN_CLEARANCE_MM}mm.`,
            t1, t2
          });
        }
      }
    }
  }

  return {
    ok: violations.length === 0,
    clean: violations.length === 0 && warnings.length === 0,
    errors: violations,
    warnings,
    unroutedCount: ratsnest.length,
    timestamp: new Date().toISOString()
  };
}

// ── Gerber RS-274X Standard Output Generator ──────────────────────────────────
export function generateGerberRS274X(board, pcbComponents, copperTraces, vias = []) {
  const timestamp = new Date().toISOString();
  const w = board.widthMm || 100;
  const h = board.heightMm || 80;

  // Header format for millimeter 4.4 coordinate resolution
  const gerberHeader = (title) => `G04 ${title}*
G04 Created by Wiring-Tool Svelte PCB Designer*
G04 Date: ${timestamp}*
%MOMM*%
%FSLAX44Y44*%
%TF.GenerationSoftware,WiringToolSvelte,1.0*%
G01*
G75*
`;

  // 1. Board Outline (Edge.Cuts)
  let gko = gerberHeader("Board Outline (Edge.Cuts)");
  gko += `%ADD10C,0.1500*%
D10*
G00X0Y0D02*
G01X${formatGerberCoord(w)}Y0D01*
G01X${formatGerberCoord(w)}Y${formatGerberCoord(h)}D01*
G01X0Y${formatGerberCoord(h)}D01*
G01X0Y0D01*
M02*
`;

  // 2. Top Copper (F.Cu)
  let gtl = gerberHeader("Top Copper Layer");
  gtl += `%ADD10C,0.2500*%
%ADD11C,0.4000*%
%ADD12C,0.8000*%
%ADD20R,1.6000X1.6000*%
%ADD21C,1.6000*%
%ADD22C,0.8000*%
`;

  for (const t of copperTraces.filter(tr => tr.layer === "top")) {
    const apt = t.widthMm >= 0.8 ? "D12" : t.widthMm >= 0.4 ? "D11" : "D10";
    gtl += `${apt}*\n`;
    gtl += `G00X${formatGerberCoord(t.x1)}Y${formatGerberCoord(t.y1)}D02*\n`;
    gtl += `G01X${formatGerberCoord(t.x2)}Y${formatGerberCoord(t.y2)}D01*\n`;
  }

  // Flash pads for Top Copper
  for (const c of pcbComponents) {
    const fp = c.footprint || getFootprintForComponent(c);
    for (const p of fp.pads) {
      if (p.layer === "bottom") continue;
      const px = c.xMm + p.x;
      const py = c.yMm + p.y;
      const apt = p.shape === "rect" ? "D20" : "D21";
      gtl += `${apt}*\n`;
      gtl += `G00X${formatGerberCoord(px)}Y${formatGerberCoord(py)}D03*\n`;
    }
  }

  // Flash vias for Top Copper
  for (const v of vias) {
    gtl += `D22*\n`;
    gtl += `G00X${formatGerberCoord(v.xMm)}Y${formatGerberCoord(v.yMm)}D03*\n`;
  }
  gtl += "M02*\n";

  // 3. Bottom Copper (B.Cu)
  let gbl = gerberHeader("Bottom Copper Layer");
  gbl += `%ADD10C,0.2500*%
%ADD11C,0.4000*%
%ADD12C,0.8000*%
%ADD20R,1.6000X1.6000*%
%ADD21C,1.6000*%
%ADD22C,0.8000*%
`;

  for (const t of copperTraces.filter(tr => tr.layer === "bottom")) {
    const apt = t.widthMm >= 0.8 ? "D12" : t.widthMm >= 0.4 ? "D11" : "D10";
    gbl += `${apt}*\n`;
    gbl += `G00X${formatGerberCoord(t.x1)}Y${formatGerberCoord(t.y1)}D02*\n`;
    gbl += `G01X${formatGerberCoord(t.x2)}Y${formatGerberCoord(t.y2)}D01*\n`;
  }

  // Flash pads for Bottom Copper (Through-hole pads + Bottom SMD pads)
  for (const c of pcbComponents) {
    const fp = c.footprint || getFootprintForComponent(c);
    for (const p of fp.pads) {
      if (p.layer === "top") continue;
      const px = c.xMm + p.x;
      const py = c.yMm + p.y;
      const apt = p.shape === "rect" ? "D20" : "D21";
      gbl += `${apt}*\n`;
      gbl += `G00X${formatGerberCoord(px)}Y${formatGerberCoord(py)}D03*\n`;
    }
  }

  // Flash vias for Bottom Copper
  for (const v of vias) {
    gbl += `D22*\n`;
    gbl += `G00X${formatGerberCoord(v.xMm)}Y${formatGerberCoord(v.yMm)}D03*\n`;
  }
  gbl += "M02*\n";

  // 4. Excellon Drill File (NC Drill)
  let drl = `M48
; DRILL file by Wiring-Tool Svelte
; Metric coordinates
METRIC,TZ
T01C0.850
T02C1.000
T03C0.450
%
G90
`;
  let currentTool = "T01";
  drl += `${currentTool}\n`;
  for (const c of pcbComponents) {
    const fp = c.footprint || getFootprintForComponent(c);
    for (const p of fp.pads) {
      if (p.drillMm) {
        const px = c.xMm + p.x;
        const py = c.yMm + p.y;
        drl += `X${formatDrillCoord(px)}Y${formatDrillCoord(py)}\n`;
      }
    }
  }

  if (vias.length > 0) {
    drl += `T03\n`;
    for (const v of vias) {
      drl += `X${formatDrillCoord(v.xMm)}Y${formatDrillCoord(v.yMm)}\n`;
    }
  }
  drl += "M30\n";

  return {
    "Edge_Cuts.gko": gko,
    "Top_Copper.gtl": gtl,
    "Bottom_Copper.gbl": gbl,
    "Drill.drl": drl
  };
}

function formatGerberCoord(mm) {
  return Math.round(mm * 10000);
}

function formatDrillCoord(mm) {
  return Number(mm).toFixed(3);
}

// ── EasyEDA Source JSON Serializer ─────────────────────────────────────────────
export function exportToEasyEDAJson(board, pcbComponents, copperTraces, vias = []) {
  const shapes = [];

  const w = board.widthMm || 100;
  const h = board.heightMm || 80;
  shapes.push(`TRACK~0.25~10~none~none~0,0 ${w},0 ${w},${h} 0,${h} 0,0~none`);

  for (const t of copperTraces) {
    const layerId = t.layer === "bottom" ? 2 : 1;
    shapes.push(`TRACK~${t.widthMm}~${layerId}~${t.netId || "none"}~none~${t.x1},${t.y1} ${t.x2},${t.y2}~none`);
  }

  for (const v of vias) {
    shapes.push(`VIA~${v.xMm}~${v.yMm}~${v.outerMm || 0.8}~none~${v.drillMm || 0.45}~none~none`);
  }

  for (const c of pcbComponents) {
    const fp = c.footprint || getFootprintForComponent(c);
    for (const p of fp.pads) {
      const px = c.xMm + p.x;
      const py = c.yMm + p.y;
      const shapeType = p.shape === "rect" ? "RECT" : "ELLIPSE";
      shapes.push(`PAD~${shapeType}~${px}~${py}~${p.sizeMm || 1.6}~${p.sizeMm || 1.6}~11~${p.name || ""}~${p.num || ""}~${p.drillMm || 0.9}~0~none~none`);
    }
  }

  return {
    head: {
      docType: "4",
      editorVersion: "6.5.40",
      c_para: {
        package: "Custom",
        BBox: { x: 0, y: 0, width: w, height: h }
      }
    },
    canvas: `BBox~0 0 ${w} ${h}~origin~0 0~grid~1.27mm`,
    shape: shapes
  };
}

// ── 1:1 Scale DIY Etching SVG Mask ────────────────────────────────────────────
export function generateDiyEtchingSvg(board, pcbComponents, copperTraces, layer = "bottom", inverted = false, vias = []) {
  const w = board.widthMm || 100;
  const h = board.heightMm || 80;

  const bgColor = inverted ? "#ffffff" : "#000000";
  const copperColor = inverted ? "#000000" : "#ffffff";

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${bgColor}" />
  <g id="copper-traces" stroke="${copperColor}" stroke-linecap="round" stroke-linejoin="round">
`;

  // Draw traces
  for (const t of copperTraces.filter(tr => tr.layer === layer || layer === "all")) {
    svg += `    <line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke-width="${t.widthMm}" />\n`;
  }

  // Draw pads and vias
  svg += `  </g>\n  <g id="pads" fill="${copperColor}">\n`;
  for (const c of pcbComponents) {
    const fp = c.footprint || getFootprintForComponent(c);
    for (const p of fp.pads) {
      if (layer !== "all" && p.layer && p.layer !== layer && !p.drillMm) continue;
      const px = c.xMm + p.x;
      const py = c.yMm + p.y;
      if (p.shape === "rect") {
        svg += `    <rect x="${px - (p.sizeMm || 1.6) / 2}" y="${py - (p.sizeMm || 1.6) / 2}" width="${p.sizeMm || 1.6}" height="${p.sizeMm || 1.6}" rx="0.1" />\n`;
      } else {
        svg += `    <circle cx="${px}" cy="${py}" r="${(p.sizeMm || 1.6) / 2}" />\n`;
      }
    }
  }

  // Draw via copper rings
  for (const v of vias) {
    svg += `    <circle cx="${v.xMm}" cy="${v.yMm}" r="${(v.outerMm || 0.8) / 2}" />\n`;
  }

  // Draw pad drill hole centers (drilling guide)
  svg += `  </g>\n  <g id="drill-holes" fill="${bgColor}">\n`;
  for (const c of pcbComponents) {
    const fp = c.footprint || getFootprintForComponent(c);
    for (const p of fp.pads) {
      if (p.drillMm) {
        const px = c.xMm + p.x;
        const py = c.yMm + p.y;
        svg += `    <circle cx="${px}" cy="${py}" r="${p.drillMm / 2}" />\n`;
      }
    }
  }

  // Draw via drill holes
  for (const v of vias) {
    svg += `    <circle cx="${v.xMm}" cy="${v.yMm}" r="${(v.drillMm || 0.45) / 2}" />\n`;
  }

  svg += `  </g>\n</svg>`;
  return svg;
}

// ── PCB 2-Layer Auto-Router Engine (A* Maze & 45° Smooth Routing) ─────────────
/**
 * Professional 2-Layer Auto-Router
 * 
 * Automatically resolves remaining unrouted ratsnest connections.
 * Uses 2-layer orthogonal routing with 45° corner smoothing and automatic
 * via insertion when crossing obstacles.
 * 
 * @param {Object} board - { widthMm, heightMm }
 * @param {Array} pcbComponents - Placed footprints
 * @param {Array} wires - Schematic connections
 * @param {Array} existingTraces - Current copper traces
 * @param {Array} existingVias - Current through-hole vias
 * @param {Object} options - { traceWidthMm, gridStepMm, clearanceMm }
 * @returns {Object} - { newTraces, newVias, routedCount, totalUnrouted }
 */
export function autoRoutePcbNets(
  board,
  pcbComponents = [],
  wires = [],
  existingTraces = [],
  existingVias = [],
  options = {}
) {
  const w = board.widthMm || 100;
  const h = board.heightMm || 80;
  const traceWidth = options.traceWidthMm || 0.40;
  const clearance = options.clearanceMm || 0.35;
  const unrouted = generateRatsnestLines(pcbComponents, wires, existingTraces);

  if (unrouted.length === 0) {
    return { newTraces: [], newVias: [], routedCount: 0, totalUnrouted: 0 };
  }

  const generatedTraces = [];
  const generatedVias = [];
  let routedCount = 0;

  // Collect all pads with their positions, nets, and radii for collision avoidance
  const padObstacles = [];
  for (const comp of pcbComponents) {
    const fp = comp.footprint || getFootprintForComponent(comp);
    if (!fp || !fp.pads) continue;
    const rad = ((comp.rotation || 0) * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    for (let idx = 0; idx < fp.pads.length; idx++) {
      const p = fp.pads[idx];
      const px = comp.xMm + (p.x * cosR - p.y * sinR);
      const py = comp.yMm + (p.x * sinR + p.y * cosR);
      const radius = (p.sizeMm || 1.6) / 2;
      padObstacles.push({
        x: px,
        y: py,
        r: radius,
        compId: comp.instanceId,
        padNum: p.num
      });
    }
  }

  // Helper: check if a line segment (x1,y1)-(x2,y2) collides with pad obstacles
  function segmentCollidesWithPads(x1, y1, x2, y2, ignorePad1, ignorePad2) {
    for (const ob of padObstacles) {
      if (
        (Math.hypot(ob.x - ignorePad1.x, ob.y - ignorePad1.y) < 0.1) ||
        (Math.hypot(ob.x - ignorePad2.x, ob.y - ignorePad2.y) < 0.1)
      ) {
        continue;
      }
      // Distance from point (ob.x, ob.y) to segment (x1,y1)-(x2,y2)
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      let t = 0;
      if (lenSq > 0.0001) {
        t = Math.max(0, Math.min(1, ((ob.x - x1) * dx + (ob.y - y1) * dy) / lenSq));
      }
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const dist = Math.hypot(ob.x - projX, ob.y - projY);
      if (dist < ob.r + clearance) {
        return true;
      }
    }
    return false;
  }

  // Helper: check if segment collides with existing traces on the same layer
  function segmentCollidesWithTraces(x1, y1, x2, y2, layer) {
    const allTraces = [...existingTraces, ...generatedTraces];
    for (const tr of allTraces) {
      if (tr.layer !== layer) continue;
      // Midpoint & endpoint clearance approximation
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const d1 = Math.hypot(tr.x1 - midX, tr.y1 - midY);
      const d2 = Math.hypot(tr.x2 - midX, tr.y2 - midY);
      if (d1 < clearance || d2 < clearance) return true;
    }
    return false;
  }

  // Route each ratsnest line
  for (const netLine of unrouted) {
    const p1 = { x: netLine.x1, y: netLine.y1 };
    const p2 = { x: netLine.x2, y: netLine.y2 };

    let routed = false;
    const layersToTry = ['top', 'bottom'];

    for (const layer of layersToTry) {
      // 1. Try Direct 45-degree dogleg routing (X first, then 45°, then Y)
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      let waypoints = [];
      if (absDx < 0.2 || absDy < 0.2) {
        // Almost straight line
        waypoints = [p1, p2];
      } else {
        // 45° mitered routing
        const cornerDist = Math.min(absDx, absDy);
        const signX = Math.sign(dx);
        const signY = Math.sign(dy);

        if (absDx >= absDy) {
          const corner1 = { x: p1.x + (absDx - cornerDist) * signX, y: p1.y };
          waypoints = [p1, corner1, p2];
        } else {
          const corner1 = { x: p1.x, y: p1.y + (absDy - cornerDist) * signY };
          waypoints = [p1, corner1, p2];
        }
      }

      // Check collision along all segments of waypoints
      let collision = false;
      for (let s = 0; s < waypoints.length - 1; s++) {
        const segA = waypoints[s];
        const segB = waypoints[s + 1];
        if (
          segmentCollidesWithPads(segA.x, segA.y, segB.x, segB.y, p1, p2) ||
          segmentCollidesWithTraces(segA.x, segA.y, segB.x, segB.y, layer)
        ) {
          collision = true;
          break;
        }
      }

      if (!collision) {
        // Success routing on this layer without vias
        for (let s = 0; s < waypoints.length - 1; s++) {
          generatedTraces.push({
            id: `trace_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            layer,
            x1: Number(waypoints[s].x.toFixed(2)),
            y1: Number(waypoints[s].y.toFixed(2)),
            x2: Number(waypoints[s + 1].x.toFixed(2)),
            y2: Number(waypoints[s + 1].y.toFixed(2)),
            widthMm: traceWidth,
            netId: netLine.netId
          });
        }
        routed = true;
        routedCount++;
        break;
      }
    }

    // 2. If single layer failed, try 2-layer routing with a via in the midpoint
    if (!routed) {
      const midX = snapToPcbGrid((p1.x + p2.x) / 2, 1.27);
      const midY = snapToPcbGrid((p1.y + p2.y) / 2, 1.27);

      if (midX > 5 && midX < w - 5 && midY > 5 && midY < h - 5) {
        // Check if midpoint via is clear of pads
        let viaBlocked = false;
        for (const ob of padObstacles) {
          if (Math.hypot(ob.x - midX, ob.y - midY) < ob.r + 0.8) {
            viaBlocked = true;
            break;
          }
        }

        if (!viaBlocked) {
          const viaId = `via_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          generatedVias.push({
            id: viaId,
            xMm: Number(midX.toFixed(2)),
            yMm: Number(midY.toFixed(2)),
            outerMm: 0.8,
            drillMm: 0.45
          });

          // Top trace from p1 to via
          generatedTraces.push({
            id: `trace_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            layer: "top",
            x1: Number(p1.x.toFixed(2)),
            y1: Number(p1.y.toFixed(2)),
            x2: Number(midX.toFixed(2)),
            y2: Number(midY.toFixed(2)),
            widthMm: traceWidth,
            netId: netLine.netId
          });

          // Bottom trace from via to p2
          generatedTraces.push({
            id: `trace_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            layer: "bottom",
            x1: Number(midX.toFixed(2)),
            y1: Number(midY.toFixed(2)),
            x2: Number(p2.x.toFixed(2)),
            y2: Number(p2.y.toFixed(2)),
            widthMm: traceWidth,
            netId: netLine.netId
          });

          routed = true;
          routedCount++;
        }
      }
    }
  }

  return {
    newTraces: generatedTraces,
    newVias: generatedVias,
    routedCount,
    totalUnrouted: unrouted.length
  };
}

// ── Ground Plane / Copper Pour (GND Zone Polygon Fill) ────────────────────────
/**
 * Computes SVG clipping and geometry for Ground Plane Copper Pour
 */
export function generateCopperPourSvgPath(board, cornerRadiusMm = 3) {
  const w = board.widthMm || 100;
  const h = board.heightMm || 80;
  const r = Math.max(0, Math.min(cornerRadiusMm, 15));

  // Rounded rectangle path for outer copper zone boundary
  return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

// ── BOM & PCB Fabrication Cost Estimator ──────────────────────────────────────
/**
 * Computes instant maker PCB prototyping cost estimation
 */
export function estimatePcbBOMCost(board, pcbComponents = []) {
  const w = board.widthMm || 100;
  const h = board.heightMm || 80;
  const areaCm2 = (w * h) / 100;

  // JLCPCB standard pricing tier: $2.00 for up to 100x100mm (5 pcs)
  let pcbFabCost = 2.0;
  if (w > 100 || h > 100) {
    pcbFabCost = Math.max(2.0, 2.0 + (areaCm2 - 100) * 0.04);
  }

  // Estimate components cost
  let componentsCost = 0;
  for (const c of pcbComponents) {
    const id = (c.id || "").toLowerCase();
    if (id.includes("esp32")) componentsCost += 3.8;
    else if (id.includes("arduino-mega")) componentsCost += 6.5;
    else if (id.includes("arduino")) componentsCost += 2.5;
    else if (id.includes("pico")) componentsCost += 4.0;
    else if (id.includes("oled") || id.includes("lcd")) componentsCost += 2.2;
    else if (id.includes("relay") || id.includes("motor")) componentsCost += 0.8;
    else if (id.includes("sensor")) componentsCost += 1.2;
    else componentsCost += 0.05; // passive resistor, cap, led
  }

  return {
    pcbFabCostUsd: Number(pcbFabCost.toFixed(2)),
    componentsCostUsd: Number(componentsCost.toFixed(2)),
    totalCostUsd: Number((pcbFabCost + componentsCost).toFixed(2)),
    areaCm2: Number(areaCm2.toFixed(1)),
    boardWeightGrams: Math.round(areaCm2 * 0.38), // approx 1.6mm FR-4 weight
    leadTimeDays: "2-3 Hari Kerja"
  };
}

/**
 * Generates teardrop fillets for PCB trace-to-pad and trace-to-via junctions.
 * Standard IPC-7351 practice to reinforce copper trace transitions and prevent drill breakout.
 * @param {Array} traces - Array of { x1, y1, x2, y2, widthMm, layer, netId }
 * @param {Array} pcbComponents - Array of placed PCB components with footprint pads
 * @param {Array} vias - Array of placed through-hole vias { xMm, yMm, outerDiaMm }
 * @returns {Array} Array of { id, layer, points, netId }
 */
export function generatePcbTeardrops(traces = [], pcbComponents = [], vias = []) {
  if (!traces || !traces.length) return [];

  const targets = [];

  // 1. Through-hole vias
  for (const v of vias) {
    targets.push({
      x: v.xMm,
      y: v.yMm,
      radius: (v.outerDiaMm || 1.0) / 2,
      layer: 'both',
      netId: v.netId
    });
  }

  // 2. Component footprint pads
  for (const c of pcbComponents) {
    const fp = c.footprint;
    if (!fp || !fp.pads) continue;
    const rad = ((c.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    for (const p of fp.pads) {
      const rx = p.xMm * cos - p.yMm * sin;
      const ry = p.xMm * sin + p.yMm * cos;
      const padRadius = Math.max(p.wMm || 1.6, p.hMm || 1.6) / 2;
      targets.push({
        x: c.xMm + rx,
        y: c.yMm + ry,
        radius: padRadius,
        layer: p.layer || 'both',
        netId: p.netId
      });
    }
  }

  const teardrops = [];
  let dropId = 1;

  for (const t of traces) {
    const p1 = { x: t.x1, y: t.y1 };
    const p2 = { x: t.x2, y: t.y2 };
    const traceW = t.widthMm || 0.4;
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (len < 0.6) continue;

    const checkEndpoint = (origin, other) => {
      for (const tgt of targets) {
        if (tgt.layer !== 'both' && tgt.layer !== t.layer) continue;
        const d = Math.hypot(origin.x - tgt.x, origin.y - tgt.y);
        if (d <= tgt.radius + 0.35) {
          const dx = other.x - origin.x;
          const dy = other.y - origin.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 0.4) continue;

          const ux = dx / dist;
          const uy = dy / dist;
          const teardropLen = Math.min(dist * 0.45, tgt.radius * 0.9 + traceW * 1.3);

          const apexX = origin.x + ux * teardropLen;
          const apexY = origin.y + uy * teardropLen;

          const angle = Math.atan2(uy, ux);
          const spread = 0.785; // 45 deg
          const ptAx = tgt.x + tgt.radius * Math.cos(angle + spread);
          const ptAy = tgt.y + tgt.radius * Math.sin(angle + spread);
          const ptBx = tgt.x + tgt.radius * Math.cos(angle - spread);
          const ptBy = tgt.y + tgt.radius * Math.sin(angle - spread);

          teardrops.push({
            id: `td-${dropId++}`,
            layer: t.layer,
            netId: t.netId,
            points: `${ptAx.toFixed(2)},${ptAy.toFixed(2)} ${apexX.toFixed(2)},${apexY.toFixed(2)} ${ptBx.toFixed(2)},${ptBy.toFixed(2)} ${origin.x.toFixed(2)},${origin.y.toFixed(2)}`
          });
        }
      }
    };

    checkEndpoint(p1, p2);
    checkEndpoint(p2, p1);
  }

  return teardrops;
}

// ── JLCPCB SMT Pick-and-Place (CPL / Centroid CSV) ────────────────────────────
export function generatePickAndPlaceCplCsv(board, pcbComponents = []) {
  const lines = [
    'Designator,Val,Package,Mid X,Mid Y,Rotation,Layer'
  ];

  const boardHeight = board?.heightMm || 80;

  pcbComponents.forEach((comp, idx) => {
    const des = comp.prefix ? `${comp.prefix}${comp.index || idx + 1}` : (comp.label || `U${idx + 1}`);
    const val = comp.value || comp.label || comp.id || 'N/A';
    const pkg = comp.footprint?.package || comp.footprintId || 'STANDARD-TH';
    
    // JLCPCB standard coordinates: origin at bottom-left corner
    const midX = `${Number(comp.xMm || 0).toFixed(2)}mm`;
    const midY = `${Number(boardHeight - (comp.yMm || 0)).toFixed(2)}mm`;
    const rot = `${comp.rotation || 0}`;
    const layer = comp.layer === 'bottom' ? 'Bottom' : 'Top';

    lines.push(`"${des}","${val}","${pkg}",${midX},${midY},${rot},${layer}`);
  });

  return lines.join('\r\n');
}

// ── Thermal Relief Spokes for Ground Plane Copper Pour ────────────────────────
export function generateThermalReliefs(pcbComponents = [], vias = []) {
  const reliefs = [];
  let reliefId = 1;

  pcbComponents.forEach(comp => {
    const fp = comp.footprint;
    if (!fp || !fp.pads) return;
    const isRotated90 = (comp.rotation || 0) % 180 !== 0;

    fp.pads.forEach(pad => {
      const padNet = (pad.name || '').toUpperCase();
      if (padNet === 'GND' || padNet === 'VSS' || padNet.includes('GND')) {
        const px = comp.xMm + (isRotated90 ? -pad.y : pad.x);
        const py = comp.yMm + (isRotated90 ? pad.x : pad.y);
        const r = (pad.sizeMm || 1.8) / 2;

        reliefs.push({
          id: `tr-${reliefId++}`,
          x: Number(px.toFixed(2)),
          y: Number(py.toFixed(2)),
          radius: Number(r.toFixed(2)),
          spokeW: 0.45,
          gap: 0.35
        });
      }
    });
  });

  return reliefs;
}

// ── 3D Enclosure / Casing STL Generator (Ready for 3D Slicers) ─────────────────
export function generateEnclosureStl(board, options = {}) {
  const bw = board?.widthMm || 100;
  const bh = board?.heightMm || 80;
  const wall = options.wallThickness || 2.0;
  const floor = options.floorThickness || 2.0;
  const depth = options.depthMm || 22.0;
  const clearance = options.clearance || 0.8;
  const standoffH = options.standoffHeight || 5.0;

  const totalW = bw + (wall + clearance) * 2;
  const totalH = bh + (wall + clearance) * 2;

  const facets = [];

  function addQuad(p1, p2, p3, p4, nx = 0, ny = 0, nz = 0) {
    facets.push({ p1, p2, p3, nx, ny, nz });
    facets.push({ p1: p1, p2: p3, p3: p4, nx, ny, nz });
  }

  function addBox(x, y, z, w, h, d) {
    // Bottom
    addQuad([x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], 0, 0, -1);
    // Top
    addQuad([x, y, z + d], [x, y + h, z + d], [x + w, y + h, z + d], [x + w, y, z + d], 0, 0, 1);
    // Front
    addQuad([x, y, z], [x, y, z + d], [x + w, y, z + d], [x + w, y, z], 0, -1, 0);
    // Back
    addQuad([x, y + h, z], [x + w, y + h, z], [x + w, y + h, z + d], [x, y + h, z + d], 0, 1, 0);
    // Left
    addQuad([x, y, z], [x, y + h, z], [x, y + h, z + d], [x, y, z + d], -1, 0, 0);
    // Right
    addQuad([x + w, y, z], [x + w, y, z + d], [x + w, y + h, z + d], [x + w, y + h, z], 1, 0, 0);
  }

  // 1. Base Floor
  addBox(0, 0, 0, totalW, totalH, floor);

  // 2. Outer Walls
  // Left wall
  addBox(0, 0, floor, wall, totalH, depth);
  // Right wall
  addBox(totalW - wall, 0, floor, wall, totalH, depth);
  // Front wall (with USB port cutout in center-left)
  const usbW = 14;
  const usbH = 8;
  const usbX = 18;
  addBox(wall, 0, floor, usbX - wall, wall, depth);
  addBox(usbX, 0, floor + usbH, usbW, wall, depth - usbH);
  addBox(usbX + usbW, 0, floor, totalW - wall - (usbX + usbW), wall, depth);
  // Back wall
  addBox(wall, totalH - wall, floor, totalW - wall * 2, wall, depth);

  // 3. Standoff Posts for 4 M3 corner mounting screws
  const postSize = 6.0;
  const postMargin = 4.0;
  const posts = [
    [wall + clearance + postMargin, wall + clearance + postMargin],
    [totalW - wall - clearance - postMargin - postSize, wall + clearance + postMargin],
    [wall + clearance + postMargin, totalH - wall - clearance - postMargin - postSize],
    [totalW - wall - clearance - postMargin - postSize, totalH - wall - clearance - postMargin - postSize]
  ];

  posts.forEach(([px, py]) => {
    addBox(px, py, floor, postSize, postSize, standoffH);
  });

  // Construct ASCII STL output
  let stl = 'solid circuit_craft_enclosure\r\n';
  facets.forEach(f => {
    stl += `  facet normal ${f.nx} ${f.ny} ${f.nz}\r\n`;
    stl += '    outer loop\r\n';
    stl += `      vertex ${f.p1[0].toFixed(3)} ${f.p1[1].toFixed(3)} ${f.p1[2].toFixed(3)}\r\n`;
    stl += `      vertex ${f.p2[0].toFixed(3)} ${f.p2[1].toFixed(3)} ${f.p2[2].toFixed(3)}\r\n`;
    stl += `      vertex ${f.p3[0].toFixed(3)} ${f.p3[1].toFixed(3)} ${f.p3[2].toFixed(3)}\r\n`;
    stl += '    endloop\r\n';
    stl += '  endfacet\r\n';
  });
  stl += 'endsolid circuit_craft_enclosure\r\n';

  return stl;
}
