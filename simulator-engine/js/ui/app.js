/**
 * Web Microcontroller & Circuit Logic Simulator — Main UI Application Controller
 */

let circuitEngine = null;
let canvasView = null;
let serialMonitor = null;
let codeRunner = null;
let activeMCU = null;

function initSimulator() {
  // 1. Initialize Circuit Engine
  circuitEngine = new CircuitEngine();

  // 2. Initialize Canvas Viewport
  canvasView = new CanvasView("circuit-canvas", circuitEngine);

  // 3. Initialize Serial Monitor
  serialMonitor = new SerialMonitor("serial-output", "serial-input-box", "serial-baud");

  // 4. Check for diagram launch data from Visual Wiring Tool
  const customLaunch = (() => {
    try {
      const raw = localStorage.getItem("simulator_launch_data");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  if (customLaunch && customLaunch.code) {
    CIRCUIT_EXAMPLES.custom = {
      title: `⚡ Proyek: ${customLaunch.project || "Dari Wiring Designer"}`,
      code: customLaunch.code,
      setup: (engine) => {
        engine.reset();
        engine.components.clear();
        engine.wires = [];
        const mcu = new VirtualMCU("mcu1", "ESP32-S3", 80, 80);
        engine.addComponent(mcu);

        if (customLaunch.wokwi && Array.isArray(customLaunch.wokwi.parts)) {
          let offsetX = 340,
            offsetY = 90;
          customLaunch.wokwi.parts.forEach((p, idx) => {
            if (
              p.type &&
              (p.type.includes("esp32") || p.type.includes("arduino"))
            )
              return;
            let comp = null;
            if (p.type.includes("led"))
              comp = new VirtualLED(`led_${idx}`, "red", offsetX, offsetY);
            else if (p.type.includes("pushbutton"))
              comp = new VirtualButton(`btn_${idx}`, offsetX, offsetY);
            else if (p.type.includes("buzzer"))
              comp = new VirtualBuzzer(`buzzer_${idx}`, offsetX, offsetY);
            else if (p.type.includes("potentiometer"))
              comp = new VirtualPotentiometer(`pot_${idx}`, offsetX, offsetY);
            else if (p.type.includes("ssd1306"))
              comp = new VirtualOledSSD1306(`oled_${idx}`, offsetX, offsetY);
            if (comp) {
              engine.addComponent(comp);
              offsetY += 95;
              if (offsetY > 380) {
                offsetY = 90;
                offsetX += 130;
              }
            }
          });
        } else {
          const led = new VirtualLED("led1", "green", 340, 140);
          engine.addComponent(led);
          engine.addWire("mcu1", "D2", "led1", "anode", "#10b981");
          engine.addWire("mcu1", "GND_1", "led1", "cathode", "#000000");
        }
        return mcu;
      },
    };

    const sel = document.getElementById("example-selector");
    if (sel) {
      const opt = document.createElement("option");
      opt.value = "custom";
      opt.textContent = `⚡ 0. ${customLaunch.project || "Rangkaian dari Wiring Tool"}`;
      sel.insertBefore(opt, sel.firstChild);
      sel.value = "custom";
    }
    loadExample("custom");
  } else {
    // Load initial example ("blink")
    loadExample("blink");
  }

  // Hook Serial output to monitor
  activeMCU.onSerialOutput = (text) => {
    serialMonitor.append(text);
  };
  window.activeMCU = activeMCU;

  // 5. Initialize Code Runner
  codeRunner = new CodeRunner(activeMCU, circuitEngine);
  codeRunner.onStatusChange = (status, isRunning) => {
    document.getElementById("status-text").innerText = status;
    const runBtn = document.getElementById("btn-run-sim");
    if (runBtn) {
      runBtn.innerText = isRunning ? "⏸ Jeda" : "▶ Jalankan";
    }
  };
  codeRunner.onError = (err) => {
    serialMonitor.append(`[ERROR] ${err}`);
  };

  // Sync textarea code
  const codeEditor = document.getElementById("code-editor-textarea");
  if (codeEditor) {
    codeEditor.value = CIRCUIT_EXAMPLES.blink.code;
  }
}

function loadExample(key) {
  const ex = CIRCUIT_EXAMPLES[key];
  if (!ex) return;

  if (codeRunner) codeRunner.stop();
  if (circuitEngine) circuitEngine.stop();

  activeMCU = ex.setup(circuitEngine);
  activeMCU.onSerialOutput = (text) => serialMonitor.append(text);
  window.activeMCU = activeMCU;

  if (codeRunner) {
    codeRunner.mcu = activeMCU;
  }

  const editor = document.getElementById("code-editor-textarea");
  if (editor) editor.value = ex.code;
  if (serialMonitor) serialMonitor.clear();

  document.getElementById("status-text").innerText = `Loaded: ${ex.title}`;
}

function toggleRun() {
  if (!codeRunner) return;
  const editor = document.getElementById("code-editor-textarea");
  codeRunner.setSource(editor.value);

  if (!codeRunner.isRunning) {
    circuitEngine.start();
    codeRunner.run();
  } else {
    codeRunner.pause();
  }
}

function stopSimulation() {
  if (codeRunner) codeRunner.stop();
  if (circuitEngine) circuitEngine.stop();
  document.getElementById("status-text").innerText = "Simulation Stopped";
  const runBtn = document.getElementById("btn-run-sim");
  if (runBtn) runBtn.innerText = "▶ Jalankan";
}

function resetSimulation() {
  stopSimulation();
  if (circuitEngine) circuitEngine.reset();
  if (serialMonitor) serialMonitor.clear();
  document.getElementById("status-text").innerText = "Circuit Reset to Initial State";
}

function stepSimulation() {
  if (circuitEngine) circuitEngine.step(20);
}

// ─── Component Factory Adders ───
let compCounter = 1;

function addComponent(type) {
  const id = `${type.toLowerCase()}_${Date.now().toString(36).substring(4)}`;
  const centerX = (-canvasView.panX + canvasView.canvas.width / 2) / canvasView.scale;
  const centerY = (-canvasView.panY + canvasView.canvas.height / 2) / canvasView.scale;

  let comp = null;
  switch (type) {
    case "LED_RED": comp = new VirtualLED(id, "red", centerX, centerY); break;
    case "LED_GREEN": comp = new VirtualLED(id, "green", centerX, centerY); break;
    case "LED_BLUE": comp = new VirtualLED(id, "blue", centerX, centerY); break;
    case "BUTTON": comp = new VirtualButton(id, centerX, centerY); break;
    case "POTENTIOMETER": comp = new VirtualPotentiometer(id, centerX, centerY); break;
    case "OLED": comp = new VirtualOledSSD1306(id, centerX, centerY); break;
    case "BUZZER": comp = new VirtualBuzzer(id, centerX, centerY); break;
    case "GATE_AND": comp = new VirtualLogicGate(id, "AND", centerX, centerY); break;
    case "GATE_OR": comp = new VirtualLogicGate(id, "OR", centerX, centerY); break;
    case "GATE_NOT": comp = new VirtualLogicGate(id, "NOT", centerX, centerY); break;
  }

  if (comp) {
    circuitEngine.addComponent(comp);
  }
}

function setSimSpeed(speed) {
  if (circuitEngine) {
    circuitEngine.simSpeed = parseFloat(speed);
  }
}

function exportCircuit() {
  const json = circuitEngine.exportJson();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `circuit-${Date.now()}.json`;
  a.click();
}

window.addEventListener("DOMContentLoaded", initSimulator);

