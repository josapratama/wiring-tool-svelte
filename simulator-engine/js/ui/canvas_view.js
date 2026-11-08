/**
 * Web Microcontroller & Circuit Logic Simulator — Canvas View & Interactive Wiring Renderer
 */

class CanvasView {
  constructor(canvasId, engine) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.engine = engine;
    
    // Viewport transform
    this.scale = 1.0;
    this.panX = 30;
    this.panY = 30;

    // Interaction states
    this.draggingComp = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.wiringStart = null; // { compId, pinId, x, y }
    this.mousePos = { x: 0, y: 0 };
    this.hoveredPin = null;  // { compId, pinId, x, y }
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    this.initEvents();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.startRenderLoop();
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.parentElement.clientWidth;
    this.canvas.height = this.canvas.parentElement.clientHeight;
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.panX) / this.scale,
      y: (sy - this.panY) / this.scale
    };
  }

  initEvents() {
    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
  }

  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = this.screenToWorld(sx, sy);

    // Pan with Middle Click or Alt/Space
    if (e.button === 1 || e.altKey || e.shiftKey) {
      this.isPanning = true;
      this.panStartX = sx - this.panX;
      this.panStartY = sy - this.panY;
      return;
    }

    // 1. Check if clicking on a pin (start wiring)
    const pinHit = this.findPinAt(w.x, w.y);
    if (pinHit) {
      this.wiringStart = pinHit;
      return;
    }

    // 2. Check if clicking on interactive component (e.g. Button or Potentiometer)
    const compHit = this.findComponentAt(w.x, w.y);
    if (compHit) {
      if (compHit.type === "BUTTON") {
        compHit.press();
      } else if (compHit.type === "POTENTIOMETER") {
        // Toggle/drag knob
        const relY = w.y - compHit.y;
        compHit.setRatio(1.0 - (relY / compHit.height));
      }
      this.draggingComp = compHit;
      this.dragOffsetX = w.x - compHit.x;
      this.dragOffsetY = w.y - compHit.y;
    }
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = this.screenToWorld(sx, sy);
    this.mousePos = w;

    if (this.isPanning) {
      this.panX = sx - this.panStartX;
      this.panY = sy - this.panStartY;
      return;
    }

    if (this.draggingComp && !this.wiringStart) {
      // Snap to 10px grid
      this.draggingComp.x = Math.round((w.x - this.dragOffsetX) / 10) * 10;
      this.draggingComp.y = Math.round((w.y - this.dragOffsetY) / 10) * 10;
      return;
    }

    // Update hovered pin
    this.hoveredPin = this.findPinAt(w.x, w.y);
  }

  onMouseUp() {
    if (this.isPanning) {
      this.isPanning = false;
    }

    if (this.wiringStart) {
      const pinEnd = this.findPinAt(this.mousePos.x, this.mousePos.y);
      if (pinEnd && (pinEnd.compId !== this.wiringStart.compId || pinEnd.pinId !== this.wiringStart.pinId)) {
        // Pick wire color based on pin type
        let color = "#00f0ff";
        if (this.wiringStart.pinId.includes("GND") || pinEnd.pinId.includes("GND") || pinEnd.pinId === "cathode") color = "#000000";
        else if (this.wiringStart.pinId.includes("3V3") || this.wiringStart.pinId.includes("5V") || pinEnd.pinId.includes("VCC")) color = "#ef4444";
        
        this.engine.addWire(
          this.wiringStart.compId,
          this.wiringStart.pinId,
          pinEnd.compId,
          pinEnd.pinId,
          color
        );
      }
      this.wiringStart = null;
    }

    if (this.draggingComp) {
      if (this.draggingComp.type === "BUTTON") {
        this.draggingComp.release();
      }
      this.draggingComp = null;
    }
  }

  onWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    this.scale = Math.max(0.4, Math.min(2.5, this.scale * zoomFactor));
  }

  findPinAt(wx, wy) {
    const hitRadius = 14;
    for (const comp of this.engine.components.values()) {
      for (const pin of comp.getPins()) {
        const pPos = comp.getPinPos(pin.id);
        const dist = Math.hypot(pPos.x - wx, pPos.y - wy);
        if (dist <= hitRadius) {
          return { compId: comp.id, pinId: pin.id, x: pPos.x, y: pPos.y, name: pin.name };
        }
      }
    }
    return null;
  }

  findComponentAt(wx, wy) {
    for (const comp of this.engine.components.values()) {
      if (
        wx >= comp.x &&
        wx <= comp.x + comp.width &&
        wy >= comp.y &&
        wy <= comp.y + comp.height
      ) {
        return comp;
      }
    }
    return null;
  }

  startRenderLoop() {
    const render = () => {
      this.draw();
      requestAnimationFrame(render);
    };
    render();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Apply pan & zoom
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, this.scale);

    // 1. Draw Breadboard Grid Dots
    this.drawGrid(ctx);

    // 2. Draw Wires
    this.drawWires(ctx);

    // 3. Draw Active Wire Dragging
    if (this.wiringStart) {
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(this.wiringStart.x, this.wiringStart.y);
      ctx.bezierCurveTo(
        this.wiringStart.x + 30,
        this.wiringStart.y,
        this.mousePos.x - 30,
        this.mousePos.y,
        this.mousePos.x,
        this.mousePos.y
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Draw Components
    for (const comp of this.engine.components.values()) {
      this.drawComponent(ctx, comp);
    }

    // 5. Draw Hovered Pin Glow
    if (this.hoveredPin) {
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.hoveredPin.x, this.hoveredPin.y, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Pin tooltip
      ctx.fillStyle = "rgba(10, 14, 23, 0.9)";
      ctx.fillRect(this.hoveredPin.x + 10, this.hoveredPin.y - 15, 60, 20);
      ctx.fillStyle = "#fff";
      ctx.font = "10px monospace";
      ctx.fillText(this.hoveredPin.name, this.hoveredPin.x + 16, this.hoveredPin.y - 2);
    }

    ctx.restore();
  }

  drawGrid(ctx) {
    const dotSpacing = 20;
    const bounds = 3000;
    ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
    for (let x = -bounds; x < bounds; x += dotSpacing) {
      for (let y = -bounds; y < bounds; y += dotSpacing) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
  }

  drawWires(ctx) {
    for (const wire of this.engine.wires) {
      const compA = this.engine.components.get(wire.fromComp);
      const compB = this.engine.components.get(wire.toComp);
      if (!compA || !compB) continue;

      const pA = compA.getPinPos(wire.fromPin);
      const pB = compB.getPinPos(wire.toPin);

      // Wire glow & line
      ctx.strokeStyle = wire.color || "#00f0ff";
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      const dx = (pB.x - pA.x) * 0.5;
      ctx.bezierCurveTo(pA.x + dx, pA.y, pB.x - dx, pB.y, pB.x, pB.y);
      ctx.stroke();

      // Pin terminals
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(pA.x, pA.y, 4, 0, Math.PI * 2);
      ctx.arc(pB.x, pB.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawComponent(ctx, comp) {
    ctx.save();
    ctx.translate(comp.x, comp.y);

    if (comp.type === "ESP32-S3" || comp.type === "ARDUINO_UNO") {
      this.drawMCU(ctx, comp);
    } else if (comp.type === "LED") {
      this.drawLED(ctx, comp);
    } else if (comp.type === "BUTTON") {
      this.drawButton(ctx, comp);
    } else if (comp.type === "POTENTIOMETER") {
      this.drawPot(ctx, comp);
    } else if (comp.type === "OLED_SSD1306") {
      this.drawOled(ctx, comp);
    } else if (comp.type === "BUZZER") {
      this.drawBuzzer(ctx, comp);
    } else if (comp.type === "LOGIC_GATE") {
      this.drawLogicGate(ctx, comp);
    }

    ctx.restore();
  }

  drawMCU(ctx, comp) {
    // PCB Body
    ctx.fillStyle = "#111827";
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 2;
    ctx.fillRect(0, 0, comp.width, comp.height);
    ctx.strokeRect(0, 0, comp.width, comp.height);

    // SoC Chip (ESP32-S3 / ATmega328P)
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(35, 60, 90, 110);
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(35, 60, 90, 110);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(comp.type, comp.width / 2, 115);

    // Draw Header Pins
    for (const pin of comp.getPins()) {
      const pPos = comp.getPinPos(pin.id);
      const relX = pPos.x - comp.x;
      const relY = pPos.y - comp.y;

      ctx.fillStyle = pin.type === "GND" ? "#1f2937" : pin.type === "VCC" ? "#ef4444" : "#f59e0b";
      ctx.beginPath();
      ctx.arc(relX, relY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Pin Labels
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px monospace";
      ctx.textAlign = pin.side === "left" ? "left" : "right";
      ctx.fillText(pin.name, pin.side === "left" ? relX + 8 : relX - 8, relY + 3);
    }
  }

  drawLED(ctx, comp) {
    // LED Dome
    const glowColor = comp.getColorHex();
    ctx.fillStyle = comp.brightness > 0.05 ? glowColor : "#374151";
    ctx.beginPath();
    ctx.arc(25, 25, 20, 0, Math.PI * 2);
    ctx.fill();

    // Radiant Glow
    if (comp.brightness > 0.05) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = comp.brightness * 25;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(25, 25, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Pins
    for (const pin of comp.getPins()) {
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(pin.xOffset - 2, 45, 4, 20);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(pin.xOffset, pin.yOffset, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawButton(ctx, comp) {
    // Base Case
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(5, 5, 50, 50);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 50, 50);

    // Tactile Switch Cap
    ctx.fillStyle = comp.isPressed ? "#ef4444" : "#3b82f6";
    ctx.beginPath();
    ctx.arc(30, 30, comp.isPressed ? 14 : 16, 0, Math.PI * 2);
    ctx.fill();

    // Pins
    for (const pin of comp.getPins()) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(pin.xOffset, pin.yOffset, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPot(ctx, comp) {
    // Body
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(5, 5, 60, 65);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(5, 5, 60, 65);

    // Rotary Knob
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(35, 32, 22, 0, Math.PI * 2);
    ctx.fill();

    // Dial Indicator Line
    const angle = (comp.ratio * 270 - 135) * (Math.PI / 180);
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(35, 32);
    ctx.lineTo(35 + Math.cos(angle) * 18, 32 + Math.sin(angle) * 18);
    ctx.stroke();

    // Value text
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(comp.ratio * 100)}%`, 35, 62);

    // Pins
    for (const pin of comp.getPins()) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(pin.xOffset, pin.yOffset, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawOled(ctx, comp) {
    // PCB Backplate
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, comp.width, comp.height);
    ctx.strokeStyle = "#38bdf8";
    ctx.strokeRect(0, 0, comp.width, comp.height);

    // 128x64 Active Display Glass
    ctx.drawImage(comp.canvas, 16, 30, 128, 64);

    // Pins at top
    for (const pin of comp.getPins()) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(pin.xOffset, pin.yOffset, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#64748b";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(pin.name, pin.xOffset, pin.yOffset + 12);
    }
  }

  drawBuzzer(ctx, comp) {
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(30, 30, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = comp.isPlaying ? "#f59e0b" : "#475569";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("BUZZER", 30, 33);

    for (const pin of comp.getPins()) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(pin.xOffset, pin.yOffset, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawLogicGate(ctx, comp) {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, comp.width, comp.height);
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, comp.width, comp.height);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(comp.gateType, comp.width / 2, 40);

    for (const pin of comp.getPins()) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(pin.xOffset, pin.yOffset, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px monospace";
      ctx.fillText(pin.name, pin.side === "left" ? pin.xOffset + 10 : pin.xOffset - 10, pin.yOffset + 3);
    }
  }
}

window.CanvasView = CanvasView;

