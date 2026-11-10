/**
 * Web Microcontroller & Circuit Logic Simulator — Virtual Piezo Buzzer
 * Generates interactive audio tone via Web Audio API when voltage is applied across pins.
 */

class VirtualBuzzer {
  constructor(id = "buzzer1", x = 340, y = 140) {
    this.id = id;
    this.type = "BUZZER";
    this.x = x;
    this.y = y;
    this.width = 60;
    this.height = 60;
    this.isPlaying = false;
    this.engine = null;

    // Pins: Positive (+) and Negative/GND (-)
    this.pins = [
      { id: "anode", name: "+", type: "ANODE", xOffset: 16, yOffset: 52 },
      { id: "cathode", name: "-", type: "CATHODE", xOffset: 44, yOffset: 52 }
    ];

    // Audio Context (lazy initialized on first user interaction)
    this._audioCtx = null;
    this._osc = null;
    this._gain = null;
  }

  getPins() {
    return this.pins;
  }

  getPinPos(pinId) {
    const pin = this.pins.find(p => p.id === pinId);
    if (!pin) return { x: this.x, y: this.y };
    return { x: this.x + pin.xOffset, y: this.y + pin.yOffset };
  }

  _initAudio() {
    if (this._audioCtx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this._audioCtx = new AudioCtx();
      this._gain = this._audioCtx.createGain();
      this._gain.gain.setValueAtTime(0, this._audioCtx.currentTime);
      this._gain.connect(this._audioCtx.destination);

      this._osc = this._audioCtx.createOscillator();
      this._osc.type = "square";
      this._osc.frequency.setValueAtTime(1200, this._audioCtx.currentTime);
      this._osc.connect(this._gain);
      this._osc.start();
    } catch (e) {
      console.warn("Web Audio API not supported or blocked:", e);
    }
  }

  _startSound(volume = 0.08) {
    this._initAudio();
    if (!this._gain || !this._audioCtx) return;
    try {
      if (this._audioCtx.state === "suspended") {
        this._audioCtx.resume();
      }
      this._gain.gain.cancelScheduledValues(this._audioCtx.currentTime);
      this._gain.gain.setValueAtTime(volume, this._audioCtx.currentTime);
    } catch {}
  }

  _stopSound() {
    if (!this._gain || !this._audioCtx) return;
    try {
      this._gain.gain.cancelScheduledValues(this._audioCtx.currentTime);
      this._gain.gain.setValueAtTime(0, this._audioCtx.currentTime);
    } catch {}
  }

  onTick() {
    if (!this.engine) return;
    const anodeState = this.engine.getNetState(this.id, "anode");
    const cathodeState = this.engine.getNetState(this.id, "cathode");

    const vAnode = anodeState.voltage || 0;
    const vCathode = cathodeState.voltage || 0;
    const vDiff = vAnode - vCathode;

    // Trigger threshold >= 1.5V
    if (vDiff >= 1.5) {
      this.isPlaying = true;
      this._startSound(0.08);
    } else {
      if (this.isPlaying) {
        this.isPlaying = false;
        this._stopSound();
      }
    }
  }

  reset() {
    this.isPlaying = false;
    this._stopSound();
  }

  serialize() {
    return { id: this.id, type: this.type, x: this.x, y: this.y };
  }
}

window.VirtualBuzzer = VirtualBuzzer;

