/**
 * Web Microcontroller & Circuit Logic Simulator — Virtual Arduino C++ Code Interpreter
 */

class CodeRunner {
  constructor(mcu, circuitEngine) {
    this.mcu = mcu;
    this.engine = circuitEngine;
    this.isRunning = false;
    this.isPaused = false;
    this.sourceCode = "";
    this._abortController = null;
    this.onStatusChange = null; // callback(statusText, isRunning)
    this.onError = null;        // callback(errMsg)
  }

  setSource(code) {
    this.sourceCode = code;
  }

  /**
   * Transpiles Arduino C++ code into asynchronous executable JavaScript.
   */
  transpile(cCode) {
    let js = cCode;

    // 1. Remove comments safely (preserving newlines)
    js = js.replace(/\/\*[\s\S]*?\*\//g, "");
    js = js.replace(/(^|[^:])\/\/.*$/gm, "$1");

    // 2. Strip preprocessor directives: #include, #pragma
    js = js.replace(/^\s*#\s*(?:include|pragma)\b.*$/gm, "");

    // 3. Transform #define NAME VALUE -> const NAME = VALUE;
    js = js.replace(/^\s*#\s*define\s+([A-Za-z0-9_]+)\s+([^/\r\n]+).*$/gm, (match, name, val) => {
      const cleanVal = val.trim();
      if (!cleanVal) return `/* #define ${name} */`;
      return `const ${name} = ${cleanVal};`;
    });
    js = js.replace(/^\s*#\s*define\s+([A-Za-z0-9_]+)\s*$/gm, "/* #define $1 */");

    // 4. Constants mapping
    js = js.replace(/\bOUTPUT\b/g, '"OUTPUT"');
    js = js.replace(/\bINPUT_PULLUP\b/g, '"INPUT_PULLUP"');
    js = js.replace(/\bINPUT\b/g, '"INPUT"');
    js = js.replace(/\bHIGH\b/g, "1");
    js = js.replace(/\bLOW\b/g, "0");

    // 5. C types with const: const int x -> const x
    js = js.replace(/\bconst\s+(?:int|float|double|char|byte|bool|boolean|long|unsigned\s+int|uint8_t|uint16_t|uint32_t|String)\s+([a-zA-Z0-9_]+)/g, "const $1");

    // 6. C types without const: int x -> let x
    js = js.replace(/\b(?:int|float|double|char|byte|bool|boolean|long|unsigned\s+int|uint8_t|uint16_t|uint32_t|String)\s+([a-zA-Z0-9_]+)/g, "let $1");

    // 7. Function definitions
    js = js.replace(/\bvoid\s+setup\s*\(\s*\)/g, "async function setup()");
    js = js.replace(/\bvoid\s+loop\s*\(\s*\)/g, "async function loop()");
    js = js.replace(/\b(?:void|int|bool|boolean|float|double|String)\s+([a-zA-Z0-9_]+)\s*\(/g, "async function $1(");

    // 8. Replace delay(ms) with await delay(ms)
    js = js.replace(/\bdelay\s*\(\s*([^)]+)\s*\)/g, "await delay($1)");

    return js;
  }

  async run() {
    if (this.isRunning) this.stop();
    this.isRunning = true;
    this.isPaused = false;
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    if (this.onStatusChange) this.onStatusChange("Compiling & Starting...", true);

    try {
      const transpiled = this.transpile(this.sourceCode);
      
      // Sandbox environment injected into code execution
      const sandbox = {
        pinMode: (pin, mode) => this.mcu.pinMode(pin, mode),
        digitalWrite: (pin, val) => this.mcu.digitalWrite(pin, val),
        digitalRead: (pin) => this.mcu.digitalRead(pin),
        analogWrite: (pin, val) => this.mcu.analogWrite(pin, val),
        analogRead: (pin) => this.mcu.analogRead(pin),
        delay: (ms) => {
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, ms);
            signal.addEventListener("abort", () => {
              clearTimeout(timeout);
              reject(new Error("ABORTED"));
            });
          });
        },
        millis: () => Math.round(this.engine.clockMs),
        micros: () => Math.round(this.engine.clockMs * 1000),
        map: (x, in_min, in_max, out_min, out_max) => (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min,
        constrain: (amt, low, high) => (amt < low ? low : amt > high ? high : amt),
        random: (min, max) => (max === undefined ? Math.floor(Math.random() * min) : Math.floor(Math.random() * (max - min) + min)),
        Serial: {
          begin: () => {},
          print: (t) => this.mcu.serialPrint(String(t)),
          println: (t = "") => this.mcu.serialPrintln(String(t)),
        },
        // Virtual I2C Display SSD1306 API
        display: {
          clearDisplay: () => {
            const oled = this.findOledDisplay();
            if (oled) oled.clear();
          },
          setTextSize: (s) => {
            const oled = this.findOledDisplay();
            if (oled) oled.textSize = s;
          },
          setCursor: (x, y) => {
            const oled = this.findOledDisplay();
            if (oled) { oled.cursorX = x; oled.cursorY = y; }
          },
          print: (t) => {
            const oled = this.findOledDisplay();
            if (oled) oled.drawText(String(t));
          },
          println: (t = "") => {
            const oled = this.findOledDisplay();
            if (oled) oled.drawText(String(t) + "\n");
          },
          display: () => {
            const oled = this.findOledDisplay();
            if (oled) oled.refresh();
          }
        }
      };

      // Wrap in sandbox runner
      const runnerFunc = new Function(
        "sandbox",
        `
        with (sandbox) {
          ${transpiled}
          return {
            setup: typeof setup === 'function' ? setup : async () => {},
            loop: typeof loop === 'function' ? loop : async () => {}
          };
        }
        `
      );

      const program = runnerFunc(sandbox);

      if (this.onStatusChange) this.onStatusChange("Running [setup()]", true);
      await program.setup();

      if (this.onStatusChange) this.onStatusChange("Running [loop()]", true);

      // Super-loop
      while (this.isRunning && !signal.aborted) {
        if (!this.isPaused) {
          await program.loop();
          // Yield execution to browser event loop
          await sandbox.delay(5);
        } else {
          await sandbox.delay(50);
        }
      }

    } catch (err) {
      if (err.message !== "ABORTED") {
        console.error("Simulation Runtime Error:", err);
        if (this.onError) this.onError(err.message);
        if (this.onStatusChange) this.onStatusChange(`Error: ${err.message}`, false);
      }
    } finally {
      this.isRunning = false;
    }
  }

  findOledDisplay() {
    for (const comp of this.engine.components.values()) {
      if (comp.type === "OLED_SSD1306") return comp;
    }
    return null;
  }

  stop() {
    this.isRunning = false;
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    if (this.onStatusChange) this.onStatusChange("Stopped", false);
  }

  pause() {
    this.isPaused = !this.isPaused;
    if (this.onStatusChange) {
      this.onStatusChange(this.isPaused ? "Paused" : "Running", this.isRunning);
    }
  }
}

window.CodeRunner = CodeRunner;

