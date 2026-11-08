/**
 * Web Microcontroller & Circuit Logic Simulator — Virtual MCU Core (ESP32-S3 / Arduino Uno)
 */

class VirtualMCU {
  constructor(id = "mcu1", type = "ESP32-S3", x = 100, y = 100) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = 160;
    this.height = 280;
    this.engine = null;

    // GPIO States
    this.pinModes = new Map();   // pinNumber -> "INPUT" | "OUTPUT" | "INPUT_PULLUP"
    this.pinOutputs = new Map(); // pinNumber -> 0 (LOW) or 1 (HIGH) or PWM duty (0-255)
    this.serialBuffer = "";
    this.onSerialOutput = null;  // callback(text)

    this.initPinDefinitions();
  }

  initPinDefinitions() {
    if (this.type === "ESP32-S3") {
      this.pins = [
        // Left side pins
        { id: "3V3", name: "3V3", type: "VCC", voltage: 3.3, side: "left", index: 0 },
        { id: "GND_1", name: "GND", type: "GND", voltage: 0.0, side: "left", index: 1 },
        { id: "D1", name: "G1", num: 1, type: "GPIO", side: "left", index: 2 },
        { id: "D2", name: "G2", num: 2, type: "GPIO", side: "left", index: 3 },
        { id: "D4", name: "G4", num: 4, type: "GPIO", side: "left", index: 4 },
        { id: "D5", name: "G5", num: 5, type: "GPIO", side: "left", index: 5 },
        { id: "D18", name: "G18", num: 18, type: "GPIO", side: "left", index: 6 },
        { id: "D19", name: "G19", num: 19, type: "GPIO", side: "left", index: 7 },

        // Right side pins
        { id: "VIN", name: "5V", type: "VCC", voltage: 5.0, side: "right", index: 0 },
        { id: "GND_2", name: "GND", type: "GND", voltage: 0.0, side: "right", index: 1 },
        { id: "D21", name: "SDA", num: 21, type: "I2C_SDA", side: "right", index: 2 },
        { id: "D22", name: "SCL", num: 22, type: "I2C_SCL", side: "right", index: 3 },
        { id: "D23", name: "G23", num: 23, type: "GPIO", side: "right", index: 4 },
        { id: "D25", name: "G25", num: 25, type: "GPIO", side: "right", index: 5 },
        { id: "D32", name: "A0", num: 32, type: "ADC", side: "right", index: 6 },
        { id: "D33", name: "A1", num: 33, type: "ADC", side: "right", index: 7 },
      ];
    } else {
      // Arduino Uno pinout
      this.pins = [
        { id: "5V", name: "5V", type: "VCC", voltage: 5.0, side: "left", index: 0 },
        { id: "GND", name: "GND", type: "GND", voltage: 0.0, side: "left", index: 1 },
        { id: "A0", name: "A0", num: 14, type: "ADC", side: "left", index: 2 },
        { id: "A1", name: "A1", num: 15, type: "ADC", side: "left", index: 3 },
        { id: "D2", name: "D2", num: 2, type: "GPIO", side: "right", index: 0 },
        { id: "D3", name: "D3~", num: 3, type: "GPIO", side: "right", index: 1 },
        { id: "D4", name: "D4", num: 4, type: "GPIO", side: "right", index: 2 },
        { id: "D13", name: "D13", num: 13, type: "GPIO", side: "right", index: 3 },
      ];
    }
  }

  getPins() {
    return this.pins;
  }

  getPinPos(pinId) {
    const pin = this.pins.find(p => p.id === pinId);
    if (!pin) return { x: this.x, y: this.y };
    const spacing = 28;
    const startY = this.y + 45;
    const y = startY + pin.index * spacing;
    const x = pin.side === "left" ? this.x : this.x + this.width;
    return { x, y };
  }

  getPinState(pinId) {
    const pin = this.pins.find(p => p.id === pinId);
    if (!pin) return null;

    if (pin.type === "VCC") return { type: "VCC", voltage: pin.voltage };
    if (pin.type === "GND") return { type: "GND", voltage: 0.0 };

    const mode = this.pinModes.get(pin.num) || "INPUT";
    const logic = this.pinOutputs.get(pin.num) || 0;

    return {
      type: "GPIO",
      pinNum: pin.num,
      mode,
      logic: logic > 0 ? 1 : 0,
      voltage: logic > 0 ? 3.3 : 0.0
    };
  }

  // ─── Arduino Standard API Execution ───

  _resolvePin(pinRef) {
    if (typeof pinRef === "number") {
      return this.pins.find(p => p.num === pinRef) || null;
    }
    const str = String(pinRef || "").trim();
    const direct = this.pins.find(p => p.id === str || p.name === str || String(p.num) === str);
    if (direct) return direct;
    const num = parseInt(str.replace(/\D/g, ""), 10);
    if (!isNaN(num)) {
      return this.pins.find(p => p.num === num) || null;
    }
    return null;
  }

  pinMode(pinNum, mode) {
    const p = this._resolvePin(pinNum);
    const key = p?.num ?? (typeof pinNum === "number" ? pinNum : parseInt(pinNum, 10) || pinNum);
    this.pinModes.set(key, mode);
    if (this.engine) this.engine.rebuildNets();
  }

  digitalWrite(pinNum, value) {
    const p = this._resolvePin(pinNum);
    const key = p?.num ?? (typeof pinNum === "number" ? pinNum : parseInt(pinNum, 10) || pinNum);
    this.pinOutputs.set(key, value ? 1 : 0);
    if (this.engine) this.engine.notifyStateChange();
  }

  digitalRead(pinNum) {
    const pinObj = this._resolvePin(pinNum);
    if (!pinObj || !this.engine) return 0;
    const netState = this.engine.getNetState(this.id, pinObj.id);
    return netState.voltage > 1.2 || netState.logic === 1 ? 1 : 0;
  }

  analogWrite(pinNum, duty) {
    const p = this._resolvePin(pinNum);
    const key = p?.num ?? (typeof pinNum === "number" ? pinNum : parseInt(pinNum, 10) || pinNum);
    this.pinOutputs.set(key, Math.max(0, Math.min(255, duty)));
    if (this.engine) this.engine.notifyStateChange();
  }

  analogRead(pinNum) {
    const pinObj = this._resolvePin(pinNum);
    if (!pinObj || !this.engine) return 0;
    const netState = this.engine.getNetState(this.id, pinObj.id);
    // ADC 12-bit (0-3.3V -> 0-4095)
    const ratio = Math.max(0.0, Math.min(1.0, (netState.voltage || 0.0) / 3.3));
    return Math.round(ratio * 4095);
  }

  serialPrint(text) {
    this.serialBuffer += text;
    if (this.onSerialOutput) {
      this.onSerialOutput(text);
    }
  }

  serialPrintln(text) {
    this.serialPrint(text + "\n");
  }

  reset() {
    this.pinModes.clear();
    this.pinOutputs.clear();
    this.serialBuffer = "";
  }

  serialize() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y
    };
  }
}

window.VirtualMCU = VirtualMCU;

