/**
 * Web Microcontroller & Circuit Logic Simulator — Serial Monitor & Waveform Plotter
 */

class SerialMonitor {
  constructor(containerId, inputId, baudId) {
    this.container = document.getElementById(containerId);
    this.input = document.getElementById(inputId);
    this.baudSelect = document.getElementById(baudId);
    this.buffer = [];
    this.maxLines = 500;
    this.autoScroll = true;

    // Plotter properties
    this.isPlotterMode = false;
    this.plotData = []; // Array of number arrays [ [ch0, ch1], ... ]
    this.maxPlotPoints = 120;
    this.plotColors = ["#00f0ff", "#fbbf24", "#ec4899", "#22c55e", "#a855f7"];
    this.plotCanvas = document.getElementById("serial-plotter-canvas");
    this.plotCtx = this.plotCanvas ? this.plotCanvas.getContext("2d") : null;

    if (this.input) {
      this.input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.sendInput();
      });
    }

    if (this.plotCanvas) {
      window.addEventListener("resize", () => {
        if (this.isPlotterMode) this.drawPlotter();
      });
    }
  }

  append(text) {
    // 1. Text terminal output
    if (this.container) {
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];
      const span = document.createElement("div");
      span.className = "serial-line";
      span.innerHTML = `<span style="color:#64748b; font-size:10px;">[${timeStr}]</span> ${this.escapeHtml(text)}`;
      this.container.appendChild(span);

      if (this.autoScroll) {
        this.container.scrollTop = this.container.scrollHeight;
      }
    }

    // 2. Plotter data parsing (extract pure numbers e.g. "123, 456" or "Analog: 512")
    const cleanText = text.replace(/\[\d+:\d+:\d+\]/g, ""); // strip timestamp
    const parts = cleanText.split(/[\s,;\t]+/).filter(Boolean);
    const nums = [];
    for (const p of parts) {
      const val = parseFloat(p);
      if (!isNaN(val) && isFinite(val)) {
        nums.push(val);
      }
    }

    if (nums.length > 0) {
      this.plotData.push(nums);
      if (this.plotData.length > this.maxPlotPoints) {
        this.plotData.shift();
      }
      if (this.isPlotterMode) {
        this.drawPlotter();
      }
    }
  }

  togglePlotter() {
    this.isPlotterMode = !this.isPlotterMode;
    const btn = document.getElementById("btn-toggle-plotter");

    if (this.isPlotterMode) {
      if (this.container) this.container.style.display = "none";
      if (this.plotCanvas) {
        this.plotCanvas.style.display = "block";
        this.plotCanvas.width = this.plotCanvas.parentElement.clientWidth || 360;
        this.plotCanvas.height = this.plotCanvas.parentElement.clientHeight - 40 || 160;
        this.drawPlotter();
      }
      if (btn) {
        btn.textContent = "📟 Terminal";
        btn.style.color = "#00f0ff";
      }
    } else {
      if (this.container) this.container.style.display = "block";
      if (this.plotCanvas) this.plotCanvas.style.display = "none";
      if (btn) {
        btn.textContent = "📈 Plotter";
        btn.style.color = "var(--text-muted)";
      }
    }
  }

  drawPlotter() {
    if (!this.plotCanvas || !this.plotCtx) return;
    const ctx = this.plotCtx;
    const w = (this.plotCanvas.width = this.plotCanvas.parentElement.clientWidth || 360);
    const h = (this.plotCanvas.height = this.plotCanvas.parentElement.clientHeight - 40 || 160);

    // Background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, w, h);

    if (this.plotData.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Menunggu data numerik Serial.println(val)...", w / 2, h / 2);
      return;
    }

    // Determine min & max across all channels
    let minVal = Infinity;
    let maxVal = -Infinity;
    let maxChannels = 1;

    for (const pt of this.plotData) {
      maxChannels = Math.max(maxChannels, pt.length);
      for (const v of pt) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }

    if (minVal === maxVal) {
      minVal -= 1;
      maxVal += 1;
    }

    // Grid lines (3 horizontal)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = 20 + ((h - 40) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();

      const labelVal = Math.round(maxVal - ((maxVal - minVal) / 4) * i);
      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(String(labelVal), 30, y + 3);
    }

    // Draw channels
    const padL = 35;
    const padR = 10;
    const padT = 20;
    const padB = 20;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const valToY = (v) => padT + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;

    for (let ch = 0; ch < maxChannels; ch++) {
      const color = this.plotColors[ch % this.plotColors.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let started = false;
      for (let i = 0; i < this.plotData.length; i++) {
        const pt = this.plotData[i];
        if (ch >= pt.length) continue;
        const x = padL + (i / Math.max(1, this.maxPlotPoints - 1)) * plotW;
        const y = valToY(pt[ch]);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Channel Legend on top
      const latestVal = this.plotData[this.plotData.length - 1][ch];
      ctx.fillStyle = color;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`Ch${ch + 1}: ${latestVal ?? "-"}`, padL + ch * 70, 12);
    }
  }

  clear() {
    if (this.container) this.container.innerHTML = "";
    this.plotData = [];
    if (this.isPlotterMode) this.drawPlotter();
  }

  sendInput() {
    if (!this.input || !this.input.value.trim()) return;
    const text = this.input.value;
    this.append(`> ${text}`);
    this.input.value = "";
    if (window.activeMCU && window.activeMCU.onSerialInput) {
      window.activeMCU.onSerialInput(text);
    }
  }

  escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

window.SerialMonitor = SerialMonitor;
