/**
 * Web Microcontroller & Circuit Logic Simulator — Virtual Push Button & Potentiometer
 */

class VirtualButton {
  constructor(id = "btn1", x = 320, y = 240) {
    this.id = id;
    this.type = "BUTTON";
    this.x = x;
    this.y = y;
    this.width = 60;
    this.height = 60;
    this.isPressed = false;
    this.engine = null;

    this.pins = [
      { id: "pin1", name: "1", xOffset: 12, yOffset: 55 },
      { id: "pin2", name: "2", xOffset: 48, yOffset: 55 }
    ];
  }

  getPins() {
    return this.pins;
  }

  getPinPos(pinId) {
    const pin = this.pins.find(p => p.id === pinId);
    return { x: this.x + (pin ? pin.xOffset : 0), y: this.y + (pin ? pin.yOffset : 0) };
  }

  getPinState(pinId) {
    if (!this.isPressed || !this.engine) return null;
    // When pressed, pin1 and pin2 are connected together (conductive bridge)
    const otherPinId = pinId === "pin1" ? "pin2" : "pin1";
    const otherState = this.engine.getNetState(this.id, otherPinId);
    return {
      type: "SWITCH_CLOSED",
      voltage: otherState.voltage,
      logic: otherState.logic
    };
  }

  press() {
    this.isPressed = true;
    if (this.engine) {
      this.engine.rebuildNets();
      this.engine.notifyStateChange();
    }
  }

  release() {
    this.isPressed = false;
    if (this.engine) {
      this.engine.rebuildNets();
      this.engine.notifyStateChange();
    }
  }

  reset() {
    this.isPressed = false;
  }

  serialize() {
    return { id: this.id, type: this.type, x: this.x, y: this.y };
  }
}

class VirtualPotentiometer {
  constructor(id = "pot1", x = 420, y = 140) {
    this.id = id;
    this.type = "POTENTIOMETER";
    this.x = x;
    this.y = y;
    this.width = 70;
    this.height = 80;
    this.ratio = 0.5; // 0.0 to 1.0 (50% center)
    this.engine = null;

    this.pins = [
      { id: "vcc", name: "VCC", type: "VCC", xOffset: 15, yOffset: 75 },
      { id: "sig", name: "OUT", type: "SIG", xOffset: 35, yOffset: 75 },
      { id: "gnd", name: "GND", type: "GND", xOffset: 55, yOffset: 75 }
    ];
  }

  getPins() {
    return this.pins;
  }

  getPinPos(pinId) {
    const pin = this.pins.find(p => p.id === pinId);
    return { x: this.x + (pin ? pin.xOffset : 0), y: this.y + (pin ? pin.yOffset : 0) };
  }

  getPinState(pinId) {
    if (pinId === "sig") {
      // Voltage divider: 0 to 3.3V based on knob ratio
      const v = this.ratio * 3.3;
      return {
        type: "ANALOG_OUTPUT",
        voltage: v,
        logic: v > 1.65 ? 1 : 0,
        mode: "OUTPUT"
      };
    }
    return null;
  }

  setRatio(val) {
    this.ratio = Math.max(0.0, Math.min(1.0, val));
    if (this.engine) this.engine.notifyStateChange();
  }

  reset() {
    this.ratio = 0.5;
  }

  serialize() {
    return { id: this.id, type: this.type, ratio: this.ratio, x: this.x, y: this.y };
  }
}

window.VirtualButton = VirtualButton;
window.VirtualPotentiometer = VirtualPotentiometer;

