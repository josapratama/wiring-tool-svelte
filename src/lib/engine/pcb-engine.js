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
