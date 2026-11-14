/**
 * Web Microcontroller & Circuit Logic Simulator — Virtual HC-SR04 Ultrasonic Distance Sensor
 */

class VirtualHCSR04 {
  constructor(id = "sonar1", x = 320, y = 200) {
    this.id = id;
    this.type = "HCSR04";
    this.x = x;
    this.y = y;
    this.width = 110;
    this.height = 70;
    this.distanceCm = 25; // 2 cm to 400 cm interactive range
    this.engine = null;

    // Pins: VCC (5V), TRIG, ECHO, GND
    this.pins = [
      { id: "vcc",  name: "VCC",  type: "VCC",  xOffset: 20, yOffset: 65 },
      { id: "trig", name: "TRIG", type: "IN",   xOffset: 43, yOffset: 65 },
      { id: "echo", name: "ECHO", type: "OUT",  xOffset: 67, yOffset: 65 },
      { id: "gnd",  name: "GND",  type: "GND",  xOffset: 90, yOffset: 65 }
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

  setDistance(cm) {
    this.distanceCm = Math.max(2, Math.min(400, Math.round(cm)));
  }

  getEchoDurationUs() {
    // Standard physics formula: duration (us) = distance (cm) * 58.2
    return Math.round(this.distanceCm * 58.2);
  }

  onTick() {
    // Engine updates
  }

  reset() {
    this.distanceCm = 25;
  }

  serialize() {
    return { id: this.id, type: this.type, x: this.x, y: this.y, distanceCm: this.distanceCm };
  }
}

window.VirtualHCSR04 = VirtualHCSR04;
