/**
 * Web Microcontroller & Circuit Logic Simulator — Virtual 5V Relay Module
 */

class VirtualRelay {
  constructor(id = "relay1", x = 320, y = 200) {
    this.id = id;
    this.type = "RELAY";
    this.x = x;
    this.y = y;
    this.width = 95;
    this.height = 80;
    this.isActive = false;      // True when coil is energized
    this.activeLow = true;       // Standard Arduino active-low relay module
    this.engine = null;

    // Control header pins (left) & Terminal block pins (right)
    this.pins = [
      { id: "vcc", name: "VCC", type: "VCC",    xOffset: 15, yOffset: 72 },
      { id: "gnd", name: "GND", type: "GND",    xOffset: 45, yOffset: 72 },
      { id: "in",  name: "IN",  type: "SIGNAL", xOffset: 75, yOffset: 72 },

      // High voltage contact pads (top terminals)
      { id: "no",  name: "NO",  type: "CONTACT", xOffset: 20, yOffset: 8 },
      { id: "com", name: "COM", type: "CONTACT", xOffset: 47, yOffset: 8 },
      { id: "nc",  name: "NC",  type: "CONTACT", xOffset: 75, yOffset: 8 }
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
    const vccState = this.engine.getNetState(this.id, "vcc");
    const inState  = this.engine.getNetState(this.id, "in");

    const vcc = vccState.voltage || 0;
    const vin = inState.voltage !== undefined ? inState.voltage : 5.0;

    // Relay needs power (>= 4.0V)
    if (vcc >= 4.0) {
      if (this.activeLow) {
        this.isActive = (vin < 1.5); // Triggered when pin is pulled LOW
      } else {
        this.isActive = (vin > 2.5); // Active HIGH
      }
    } else {
      this.isActive = false;
    }
  }

  reset() {
    this.isActive = false;
  }

  serialize() {
    return { id: this.id, type: this.type, x: this.x, y: this.y, isActive: this.isActive };
  }
}

window.VirtualRelay = VirtualRelay;
