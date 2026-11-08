# 🔌 Virtual Circuits Lab & Wiring Tool

A complete browser-based electronics design and MCU simulation suite built with **Svelte 5 + Vite** and pure client-side JavaScript.

---

## 🌟 Modules

```
wiring-tool-svelte/
├── src/                      # Svelte 5 Visual Schematic & Wiring Diagram Tool
├── simulator-engine/         # Pure Web Virtual MCU & Circuit Simulator (Wokwi Clone)
└── docker-compose.yml        # Multi-service container orchestration
```

### 1. Visual Wiring Diagram Tool (`/src`)
- **Built with**: Svelte 5 + Vite.
- **Component Library**: ESP32, Arduino Uno, Raspberry Pi, sensors, power modules, passive components.
- **Interactive Routing**: Auto-label wire routing (SDA, SCL, MOSI, MISO, PWM, VCC, GND).
- **Canvas Navigation**: Pan (Alt+drag), scroll-to-zoom, rubber-band multi-select, 80-step undo/redo.

### 2. Virtual MCU & Circuit Logic Simulator (`/simulator-engine`)
- **Built with**: Nodal electrical circuit solver with Union-Find net routing.
- **Virtual MCU**: Dual MCU support (ESP32-S3 and Arduino Uno) with 12-bit ADC, PWM, GPIO interrupt, and I2C/UART bus.
- **Interactive Components**: OLED SSD1306 (128x64 canvas), Piezo Buzzer (8-bit Web Audio API), 74HC Series Logic Gates (AND, OR, NOT, XOR, NAND, NOR), LEDs, Buttons, Potentiometers.
- **Real-Time C++ Transpiler**: Asynchronous non-blocking Arduino C++ runtime execution directly in the browser.

---

## 🚀 Quick Start

### Run with Docker Compose
```bash
docker compose up -d
```
- **Visual Wiring Tool**: `http://localhost:5174`
- **MCU Simulation Lab**: `http://localhost:8084`

### Run Locally with Node.js
```bash
# 1. Visual Wiring Tool
npm install
npm run dev

# 2. MCU Simulation Lab
npx serve simulator-engine -p 8084
```

---

## 📄 License
MIT
