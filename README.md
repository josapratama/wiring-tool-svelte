# wiring-tool-svelte

A browser-based electronics wiring diagram tool built with **Svelte 5** + **Vite**.

Draw connections between microcontrollers and peripherals visually — no backend required.

## Features

- 🧠 Component library: ESP32, Arduino, RPi, sensors, power, passive components
- 🔌 Wire routing with auto-label (SDA, SCL, MOSI, etc.)
- 🖱 Pan (Alt+drag / middle-click), scroll-to-zoom, fit view
- 🔲 Rubber-band multi-select, multi-drag, batch delete (single undo step)
- ✏️ Inline rename (double-click), label drag on canvas
- 🗺 Minimap with click-to-pan
- ↩ Undo / Redo (80-step history)
- 💾 Auto-save to localStorage with restore prompt
- 📐 Export: JSON · SVG · PNG · Netlist CSV · BOM CSV
- ⌨️ Keyboard shortcuts overlay (`?`)
- 📊 Diagram stats overlay
- 🎨 Wire color picker + quick colors
- 🔍 Snap-to-pin while drawing wires
- 🔁 Junction dots at T-intersections
- 📋 Quick Templates (ESP32-S3, ESP32, Arduino, RPi)

## Getting Started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

The output in `dist/` is fully static — open `dist/index.html` directly in a browser.

## Keyboard Shortcuts

| Key        | Action                   |
| ---------- | ------------------------ |
| `V`        | Select tool              |
| `W`        | Wire tool                |
| `L`        | Label tool               |
| `Del`      | Delete selected          |
| `F`        | Fit view                 |
| `Shift+F`  | Zoom to selection        |
| `G`        | Toggle grid              |
| `M`        | Toggle minimap           |
| `Ctrl+Z/Y` | Undo / Redo              |
| `Ctrl+D`   | Duplicate                |
| `Arrows`   | Nudge (Shift = fine 5px) |
| `Alt+Drag` | Pan canvas               |
| `?`        | Shortcut overlay         |

## Stack

- [Svelte 5](https://svelte.dev)
- [Vite 8](https://vitejs.dev)
- No external UI libraries — pure SVG canvas

## License

MIT
