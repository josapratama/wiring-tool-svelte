/**
 * Web Microcontroller & Circuit Logic Simulator — Virtual OLED SSD1306 (128x64) & Piezo Buzzer
 */

class VirtualOledSSD1306 {
  constructor(id = "oled1", x = 450, y = 100) {
    this.id = id;
    this.type = "OLED_SSD1306";
    this.x = x;
    this.y = y;
    this.width = 160;
    this.height = 110;
    this.engine = null;

    // Display buffer canvas (128 x 64 pixels)
    this.canvas = document.createElement("canvas");
    this.canvas.width = 128;
    this.canvas.height = 64;
    this.ctx = this.canvas.getContext("2d");
    this.cursorX = 0;
    this.cursorY = 0;
    this.textSize = 1;

    // Pin definitions (I2C: VCC, GND, SCL, SDA)
    this.pins = [
      { id: "gnd", name: "GND", type: "GND", xOffset: 35, yOffset: 10 },
      { id: "vcc", name: "VCC", type: "VCC", xOffset: 65, yOffset: 10 },
      { id: "scl", name: "SCL", type: "I2C_SCL", xOffset: 95, yOffset: 10 },
      { id: "sda", name: "SDA", type: "I2C_SDA", xOffset: 125, yOffset: 10 }
    ];

    this.clear();
  }

  getPins() {
    return this.pins;
  }

  getPinPos(pinId) {
    const pin = this.pins.find(p => p.id === pinId);
    return { x: this.x + (pin ? pin.xOffset : 0), y: this.y + (pin ? pin.yOffset : 0) };
  }

  clear() {
    this.ctx.fillStyle = "#050811";
    this.ctx.fillRect(0, 0, 128, 64);
    this.cursorX = 0;
    this.cursorY = 0;
  }

  drawText(text) {
    this.ctx.fillStyle = "#00f0ff";
    this.ctx.font = `${Math.max(8, this.textSize * 10)}px monospace`;
    
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (line) {
        this.ctx.fillText(line, this.cursorX, this.cursorY + (i + 1) * 12);
      }
    });
    this.cursorY += lines.length * 12;
  }

  refresh() {
    // Triggers canvas view repaint
    if (this.engine) this.engine.notifyStateChange();
  }

  reset() {
    this.clear();
  }

  serialize() {
    return { id: this.id, type: this.type, x: this.x, y: this.y };
  }
}

class VirtualBuzzer {
  constructor(id = "buzzer1", x = 400, y = 250) {
    this.id = id;
    this.type = "BUZZER";
    this.x = x;
    this.y = y;
    this.width = 60;
    this.height = 60;
    this.engine = null;
    this.isPlaying = false;
    this._audioCtx = null;
    this._osc = null;

    this.pins = [
      { id: "pos", name: "+", xOffset: 18, yOffset: 55 },
      { id: "neg", name: "-", xOffset: 42, yOffset: 55 }
    ];
  }

  getPins() {
    return this.pins;
  }

  getPinPos(pinId) {
    const pin = this.pins.find(p => p.id === pinId);
    return { x: this.x + (pin ? pin.xOffset : 0), y: this.y + (pin ? pin.yOffset : 0) };
  }

  onTick() {
    if (!this.engine) return;
    const posState = this.engine.getNetState(this.id, "pos");
    const negState = this.engine.getNetState(this.id, "neg");
    const vDiff = (posState.voltage || 0) - (negState.voltage || 0);

    if (vDiff >= 1.5) {
      if (!this.isPlaying) this.startSound();
    } else {
      if (this.isPlaying) this.stopSound();
    }
  }

  startSound() {
    try {
      if (!this._audioCtx) {
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this._audioCtx.state === "suspended") this._audioCtx.resume();
      this._osc = this._audioCtx.createOscillator();
      const gain = this._audioCtx.createGain();
      gain.gain.value = 0.08;
      this._osc.type = "square";
      this._osc.frequency.value = 2400; // 2.4 kHz piezo resonance
      this._osc.connect(gain);
      gain.connect(this._audioCtx.destination);
      this._osc.start();
      this.isPlaying = true;
    } catch (e) {}
  }

  stopSound() {
    if (this._osc) {
      try {
        this._osc.stop();
        this._osc.disconnect();
      } catch (e) {}
      this._osc = null;
    }
    this.isPlaying = false;
  }

  reset() {
    this.stopSound();
  }

  serialize() {
    return { id: this.id, type: this.type, x: this.x, y: this.y };
  }
}

window.VirtualOledSSD1306 = VirtualOledSSD1306;
window.VirtualBuzzer = VirtualBuzzer;

