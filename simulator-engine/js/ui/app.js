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

  // 4. Load initial example ("blink")
  loadExample("blink");

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

