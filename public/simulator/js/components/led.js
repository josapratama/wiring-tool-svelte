/**
 * Web Microcontroller & Circuit Logic Simulator — Virtual LED
 */

class VirtualLED {
  constructor(id = "led1", color = "red", x = 320, y = 140) {
    this.id = id;
    this.type = "LED";
    this.color = color;
    this.x = x;
    this.y = y;
    this.width = 50;
    this.height = 70;
    this.brightness = 0; // 0 to 1
    this.engine = null;

    // Pins: Anode (+) and Cathode (-)
    this.pins = [
      { id: "anode", name: "+", type: "ANODE", xOffset: 15, yOffset: 65 },
      { id: "cathode", name: "-", type: "CATHODE", xOffset: 35, yOffset: 65 }
    ];
  }

  getPins() {
    return this.pins;
  }

  getPinPos(pinId) {
    const pin = this.pins.find(p => p.id === pinId);
    if (!pin) return { x: this.x, y: this.y };
    return { x: this.x + pin.xOffset, y: this.y + pin.yOffset };
  }

  onTick() {
    if (!this.engine) return;
    const anodeState = this.engine.getNetState(this.id, "anode");
    const cathodeState = this.engine.getNetState(this.id, "cathode");

    const vAnode = anodeState.voltage || 0;
    const vCathode = cathodeState.voltage || 0;
    const vDiff = vAnode - vCathode;

    // Forward voltage threshold ~1.8V
    if (vDiff >= 1.5) {
      this.brightness = Math.min(1.0, (vDiff - 1.5) / 1.5);
    } else {
      this.brightness = 0;
    }
  }

  reset() {
    this.brightness = 0;
  }

  getColorHex() {
    switch (this.color) {
      case "green": return "#10b981";
      case "blue": return "#00f0ff";
      case "yellow": return "#f59e0b";
      default: return "#ef4444"; // red
    }
  }

  serialize() {
    return { id: this.id, type: this.type, color: this.color, x: this.x, y: this.y };
  }
}

window.VirtualLED = VirtualLED;

