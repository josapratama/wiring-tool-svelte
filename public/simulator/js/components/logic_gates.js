/**
 * Web Microcontroller & Circuit Logic Simulator — Virtual Digital Logic Gates (74HC Series)
 */

class VirtualLogicGate {
  constructor(id = "gate1", gateType = "AND", x = 250, y = 150) {
    this.id = id;
    this.type = "LOGIC_GATE";
    this.gateType = gateType; // AND, OR, NOT, XOR, NAND, NOR
    this.x = x;
    this.y = y;
    this.width = 80;
    this.height = 70;
    this.engine = null;

    this.initPins();
  }

  initPins() {
    if (this.gateType === "NOT") {
      this.pins = [
        { id: "inA", name: "A", side: "left", xOffset: 0, yOffset: 35 },
        { id: "out", name: "Y", side: "right", xOffset: 80, yOffset: 35 }
      ];
    } else {
      this.pins = [
        { id: "inA", name: "A", side: "left", xOffset: 0, yOffset: 22 },
        { id: "inB", name: "B", side: "left", xOffset: 0, yOffset: 48 },
        { id: "out", name: "Y", side: "right", xOffset: 80, yOffset: 35 }
      ];
    }
  }

  getPins() {
    return this.pins;
  }

  getPinPos(pinId) {
    const pin = this.pins.find(p => p.id === pinId);
    return { x: this.x + (pin ? pin.xOffset : 0), y: this.y + (pin ? pin.yOffset : 0) };
  }

  getPinState(pinId) {
    if (pinId !== "out" || !this.engine) return null;

    const inA = this.engine.getNetState(this.id, "inA");
    const valA = (inA.voltage > 1.2 || inA.logic === 1) ? 1 : 0;

    let result = 0;
    if (this.gateType === "NOT") {
      result = valA ? 0 : 1;
    } else {
      const inB = this.engine.getNetState(this.id, "inB");
      const valB = (inB.voltage > 1.2 || inB.logic === 1) ? 1 : 0;

      switch (this.gateType) {
        case "AND": result = valA && valB ? 1 : 0; break;
        case "OR":  result = valA || valB ? 1 : 0; break;
        case "XOR": result = valA !== valB ? 1 : 0; break;
        case "NAND": result = !(valA && valB) ? 1 : 0; break;
        case "NOR":  result = !(valA || valB) ? 1 : 0; break;
      }
    }

    return {
      type: "LOGIC_OUT",
      mode: "OUTPUT",
      logic: result,
      voltage: result ? 3.3 : 0.0
    };
  }

  serialize() {
    return { id: this.id, type: this.type, gateType: this.gateType, x: this.x, y: this.y };
  }
}

window.VirtualLogicGate = VirtualLogicGate;

