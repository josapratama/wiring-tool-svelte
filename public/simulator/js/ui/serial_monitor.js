/**
 * Web Microcontroller & Circuit Logic Simulator — Serial Monitor
 */

class SerialMonitor {
  constructor(containerId, inputId, baudId) {
    this.container = document.getElementById(containerId);
    this.input = document.getElementById(inputId);
    this.baudSelect = document.getElementById(baudId);
    this.buffer = [];
    this.maxLines = 500;
    this.autoScroll = true;

    if (this.input) {
      this.input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.sendInput();
      });
    }
  }

  append(text) {
    if (!this.container) return;
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    
    // Format text
    const span = document.createElement("div");
    span.className = "serial-line";
    span.innerHTML = `<span style="color:#64748b; font-size:10px;">[${timeStr}]</span> ${this.escapeHtml(text)}`;
    this.container.appendChild(span);

    if (this.autoScroll) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  clear() {
    if (this.container) this.container.innerHTML = "";
  }

  sendInput() {
    if (!this.input || !this.input.value.trim()) return;
    const text = this.input.value;
    this.append(`> ${text}`);
    this.input.value = "";
    // Pass to active MCU if registered
    if (window.activeMCU && window.activeMCU.onSerialInput) {
      window.activeMCU.onSerialInput(text);
    }
  }

  escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

window.SerialMonitor = SerialMonitor;

