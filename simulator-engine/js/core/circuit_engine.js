/**
 * Web Microcontroller & Circuit Logic Simulator — Circuit Engine & Nodal Solver
 */

class CircuitEngine {
  constructor() {
    this.components = new Map(); // id -> Component
    this.wires = [];             // { id, fromComp, fromPin, toComp, toPin, color }
    this.nets = new Map();       // netId -> Set of { compId, pinId }
    this.isRunning = false;
    this.simSpeed = 1.0;
    this.clockMs = 0;
    this._interval = null;
    this.onTickCallbacks = new Set();
    this.onStateChangeCallbacks = new Set();
  }

  addComponent(component) {
    this.components.set(component.id, component);
    component.engine = this;
    this.rebuildNets();
    this.notifyStateChange();
    return component;
  }

  removeComponent(id) {
    this.components.delete(id);
    this.wires = this.wires.filter(w => w.fromComp !== id && w.toComp !== id);
    this.rebuildNets();
    this.notifyStateChange();
  }

  addWire(fromComp, fromPin, toComp, toPin, color = "#00f0ff") {
    // Avoid duplicate wires between same pins
    const exists = this.wires.some(
      w => (w.fromComp === fromComp && w.fromPin === fromPin && w.toComp === toComp && w.toPin === toPin) ||
           (w.fromComp === toComp && w.fromPin === toPin && w.toComp === fromComp && w.toPin === fromPin)
    );
    if (exists) return null;

    const wire = {
      id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fromComp,
      fromPin,
      toComp,
      toPin,
      color
    };
    this.wires.push(wire);
    this.rebuildNets();
    this.notifyStateChange();
    return wire;
  }

  removeWire(id) {
    this.wires = this.wires.filter(w => w.id !== id);
    this.rebuildNets();
    this.notifyStateChange();
  }

  /**
   * Rebuilds electrical equivalence nets using Union-Find algorithm.
   */
  rebuildNets() {
    this.nets.clear();
    const pinKey = (c, p) => `${c}:${p}`;
    const parent = new Map();

    const find = (i) => {
      if (!parent.has(i)) parent.set(i, i);
      if (parent.get(i) === i) return i;
      const root = find(parent.get(i));
      parent.set(i, root);
      return root;
    };

    const union = (i, j) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) parent.set(rootI, rootJ);
    };

    // Register all pins
    for (const comp of this.components.values()) {
      for (const pin of comp.getPins()) {
        const k = pinKey(comp.id, pin.id);
        find(k);
      }
    }

    // Connect wires
    for (const w of this.wires) {
      union(pinKey(w.fromComp, w.fromPin), pinKey(w.toComp, w.toPin));
    }

    // Group pins by their root net
    for (const comp of this.components.values()) {
      for (const pin of comp.getPins()) {
        const k = pinKey(comp.id, pin.id);
        const root = find(k);
        if (!this.nets.has(root)) {
          this.nets.set(root, []);
        }
        this.nets.get(root).push({ compId: comp.id, pinId: pin.id });
      }
    }
  }

  /**
   * Resolves voltage and logic level for a net.
   * Priority: Direct VCC / GND > Output Pin > High-Z Pullup > Floating
   */
  getNetState(compId, pinId) {
    const pinKey = `${compId}:${pinId}`;
    let targetNet = null;

    for (const [netId, pins] of this.nets.entries()) {
      if (pins.some(p => p.compId === compId && p.pinId === pinId)) {
        targetNet = pins;
        break;
      }
    }

    if (!targetNet) return { voltage: 0, logic: 0, state: "floating" };

    let highestVoltage = 0;
    let isGnd = false;
    let isVcc = false;
    let outputPin = null;
    let pullup = false;

    for (const p of targetNet) {
      const c = this.components.get(p.compId);
      if (!c) continue;
      const pState = c.getPinState ? c.getPinState(p.pinId) : null;
      if (!pState) continue;

      if (pState.type === "GND") isGnd = true;
      if (pState.type === "VCC") { isVcc = true; highestVoltage = pState.voltage || 3.3; }
      if (pState.mode === "OUTPUT") {
        outputPin = pState;
        highestVoltage = Math.max(highestVoltage, pState.voltage || (pState.logic ? 3.3 : 0));
      }
      if (pState.mode === "INPUT_PULLUP") pullup = true;
    }

    if (isGnd && isVcc) {
      return { voltage: 0, logic: 0, state: "short_circuit" };
    }
    if (isGnd) return { voltage: 0.0, logic: 0, state: "GND" };
    if (isVcc) return { voltage: highestVoltage, logic: 1, state: "VCC" };
    if (outputPin) {
      return {
        voltage: outputPin.voltage || (outputPin.logic ? 3.3 : 0.0),
        logic: outputPin.logic ? 1 : 0,
        state: "DRIVEN"
      };
    }
    if (pullup) {
      return { voltage: 3.3, logic: 1, state: "PULLUP" };
    }

    return { voltage: 0.0, logic: 0, state: "FLOATING" };
  }

  step(dtMs = 20) {
    this.clockMs += dtMs;
    // Step all components
    for (const comp of this.components.values()) {
      if (comp.onTick) comp.onTick(dtMs, this.clockMs);
    }
    for (const cb of this.onTickCallbacks) {
      cb(this.clockMs, dtMs);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const intervalMs = 20;
    this._interval = setInterval(() => {
      this.step(intervalMs * this.simSpeed);
    }, intervalMs);
    this.notifyStateChange();
  }

  stop() {
    this.isRunning = false;
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this.notifyStateChange();
  }

  reset() {
    this.stop();
    this.clockMs = 0;
    for (const comp of this.components.values()) {
      if (comp.reset) comp.reset();
    }
    this.notifyStateChange();
  }

  notifyStateChange() {
    for (const cb of this.onStateChangeCallbacks) {
      cb();
    }
  }

  exportJson() {
    const comps = Array.from(this.components.values()).map(c => c.serialize ? c.serialize() : { id: c.id, type: c.type, x: c.x, y: c.y });
    return JSON.stringify({ components: comps, wires: this.wires }, null, 2);
  }

  importJson(jsonStr) {
    this.reset();
    this.components.clear();
    this.wires = [];
    const data = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
    // Loaded components will be re-instantiated via ComponentFactory
    return data;
  }
}

window.CircuitEngine = CircuitEngine;

