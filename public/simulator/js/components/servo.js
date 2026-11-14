/**
 * Web Microcontroller & Circuit Logic Simulator — Virtual Servo Motor (SG90 / Micro Servo)
 */

class VirtualServo {
  constructor(id = "servo1", x = 320, y = 200) {
    this.id = id;
    this.type = "SERVO";
    this.x = x;
    this.y = y;
    this.width = 90;
    this.height = 75;
    this.angle = 90; // Current angle in degrees (0 - 180)
    this.targetAngle = 90;
    this.engine = null;

    // Header Pins: GND, VCC (5V), Signal (PWM)
    this.pins = [
      { id: "gnd", name: "GND", type: "GND", xOffset: 20, yOffset: 70 },
      { id: "vcc", name: "5V",  type: "VCC", xOffset: 45, yOffset: 70 },
      { id: "sig", name: "SIG", type: "PWM", xOffset: 70, yOffset: 70 }
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

  write(angle) {
    this.targetAngle = Math.max(0, Math.min(180, Math.round(angle)));
  }

  read() {
    return Math.round(this.angle);
  }

  onTick() {
    if (!this.engine) return;

    // Smooth physical motion interpolation
    const diff = this.targetAngle - this.angle;
    if (Math.abs(diff) > 0.5) {
      this.angle += diff * 0.25;
    } else {
      this.angle = this.targetAngle;
    }

    // Also check if PWM signal pin is receiving analog duty cycle
    const sigState = this.engine.getNetState(this.id, "sig");
    if (sigState && typeof sigState.duty === "number" && sigState.duty > 0) {
      // Standard RC servo pulse: 1ms (0°) to 2ms (180°) out of 20ms period (5% to 10% duty)
      const pulseDuty = sigState.duty; // 0 to 255
      if (pulseDuty >= 10 && pulseDuty <= 35) {
        const mappedAngle = Math.round(((pulseDuty - 12) / (30 - 12)) * 180);
        this.targetAngle = Math.max(0, Math.min(180, mappedAngle));
      }
    }
  }

  reset() {
    this.angle = 90;
    this.targetAngle = 90;
  }

  serialize() {
    return { id: this.id, type: this.type, x: this.x, y: this.y, angle: this.angle };
  }
}

window.VirtualServo = VirtualServo;
