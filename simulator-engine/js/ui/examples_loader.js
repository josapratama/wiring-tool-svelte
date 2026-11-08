/**
 * Web Microcontroller & Circuit Logic Simulator — Preloaded Circuit Examples & Arduino Code
 */

const CIRCUIT_EXAMPLES = {
  blink: {
    title: "1. Hello Blink LED (GPIO 2)",
    code: `// ==========================================
// 💡 Contoh 1: Blink LED pada ESP32-S3
// ==========================================
const int LED_PIN = 2; // Pin GPIO 2 terhubung ke Anode LED

void setup() {
  Serial.begin(115200);
  Serial.println("ESP32-S3 System Booted!");
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  Serial.println("LED ON");
  digitalWrite(LED_PIN, HIGH);
  delay(1000); // 1 detik menyala

  Serial.println("LED OFF");
  digitalWrite(LED_PIN, LOW);
  delay(1000); // 1 detik padam
}
`,
    setup: (engine) => {
      engine.reset();
      engine.components.clear();
      engine.wires = [];

      const mcu = new VirtualMCU("mcu1", "ESP32-S3", 80, 80);
      const led = new VirtualLED("led1", "red", 320, 140);
      engine.addComponent(mcu);
      engine.addComponent(led);

      // Wire: GPIO2 -> LED Anode (+), GND -> LED Cathode (-)
      engine.addWire("mcu1", "D2", "led1", "anode", "#00f0ff");
      engine.addWire("mcu1", "GND_1", "led1", "cathode", "#000000");
      return mcu;
    }
  },

  button_pullup: {
    title: "2. Push Button Interaktif (Input Pullup)",
    code: `// ==========================================
// 🔘 Contoh 2: Push Button + LED Aktif
// ==========================================
const int BUTTON_PIN = 4; // GPIO 4 (Input Pullup)
const int LED_PIN = 2;    // GPIO 2 (LED Hijau)

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("Tekan tombol switch pada canvas!");
}

void loop() {
  int buttonState = digitalRead(BUTTON_PIN);

  // Tombol ditekan = LOW (karena terhubung ke GND)
  if (buttonState == LOW) {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("Tombol DITEKAN! -> LED Menyala");
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(100);
}
`,
    setup: (engine) => {
      engine.reset();
      engine.components.clear();
      engine.wires = [];

      const mcu = new VirtualMCU("mcu1", "ESP32-S3", 80, 80);
      const led = new VirtualLED("led1", "green", 340, 120);
      const btn = new VirtualButton("btn1", 340, 220);
      engine.addComponent(mcu);
      engine.addComponent(led);
      engine.addComponent(btn);

      // Wires
      engine.addWire("mcu1", "D2", "led1", "anode", "#10b981");
      engine.addWire("mcu1", "GND_1", "led1", "cathode", "#000000");

      // Button: GPIO 4 to Pin 1, Pin 2 to GND
      engine.addWire("mcu1", "D4", "btn1", "pin1", "#f59e0b");
      engine.addWire("mcu1", "GND_1", "btn1", "pin2", "#000000");
      return mcu;
    }
  },

  potentiometer_pwm: {
    title: "3. Potensiometer ADC dengan PWM Dimmer",
    code: `// ==========================================
// 🎛️ Contoh 3: Analog Read ADC & PWM Dimmer
// ==========================================
const int POT_PIN = 32; // ADC Pin (GPIO 32)
const int LED_PIN = 2;  // PWM Pin (GPIO 2)

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("Putar knob potensiometer pada canvas!");
}

void loop() {
  // Baca nilai analog ADC (0 - 4095)
  int sensorValue = analogRead(POT_PIN);

  // Konversi ke rentang PWM (0 - 255)
  int brightness = map(sensorValue, 0, 4095, 0, 255);
  analogWrite(LED_PIN, brightness);

  Serial.print("ADC: ");
  Serial.print(sensorValue);
  Serial.print(" -> PWM: ");
  Serial.println(brightness);

  delay(150);
}
`,
    setup: (engine) => {
      engine.reset();
      engine.components.clear();
      engine.wires = [];

      const mcu = new VirtualMCU("mcu1", "ESP32-S3", 80, 80);
      const led = new VirtualLED("led1", "yellow", 350, 100);
      const pot = new VirtualPotentiometer("pot1", 340, 210);
      engine.addComponent(mcu);
      engine.addComponent(led);
      engine.addComponent(pot);

      // LED Wire
      engine.addWire("mcu1", "D2", "led1", "anode", "#f59e0b");
      engine.addWire("mcu1", "GND_1", "led1", "cathode", "#000000");

      // Potentiometer Wires (VCC, OUT -> GPIO32, GND)
      engine.addWire("mcu1", "VIN", "pot1", "vcc", "#ef4444");
      engine.addWire("mcu1", "D32", "pot1", "sig", "#00f0ff");
      engine.addWire("mcu1", "GND_2", "pot1", "gnd", "#000000");
      return mcu;
    }
  },

  oled_counter: {
    title: "4. Display Grafis OLED SSD1306 (I2C)",
    code: `// ==========================================
// 📺 Contoh 4: Grafis OLED SSD1306 (I2C)
// ==========================================
int counter = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("OLED SSD1306 Display Initialized");
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 5);
  display.println("ESP32-S3 SYSTEM");
  display.println("NetPulse Sentry");
  display.display();
  delay(1000);
}

void loop() {
  counter++;
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 5);
  display.println("MONITOR AKTIF");
  display.print("Count: ");
  display.println(counter);
  display.println("Status: NORMAL OK");
  display.display();

  Serial.print("Display Frame: ");
  Serial.println(counter);

  delay(500);
}
`,
    setup: (engine) => {
      engine.reset();
      engine.components.clear();
      engine.wires = [];

      const mcu = new VirtualMCU("mcu1", "ESP32-S3", 80, 80);
      const oled = new VirtualOledSSD1306("oled1", 330, 80);
      engine.addComponent(mcu);
      engine.addComponent(oled);

      // I2C Wires (SDA 21, SCL 22, VCC, GND)
      engine.addWire("mcu1", "D21", "oled1", "sda", "#00f0ff");
      engine.addWire("mcu1", "D22", "oled1", "scl", "#f59e0b");
      engine.addWire("mcu1", "VIN", "oled1", "vcc", "#ef4444");
      engine.addWire("mcu1", "GND_2", "oled1", "gnd", "#000000");
      return mcu;
    }
  },

  logic_and_gate: {
    title: "5. Gerbang Logika Digital (74HC08 AND Gate)",
    code: `// ==========================================
// ⚡ Contoh 5: Simulasi Gerbang Logika Digital
// ==========================================
// Gerbang AND: Output HIGH hanya jika Input A & Input B keduanya HIGH.
// Tekan kedua tombol pada canvas secara bersamaan untuk menyalakan LED!

void setup() {
  Serial.begin(115200);
  Serial.println("Simulasi Gerbang Logika AND Aktif!");
  Serial.println("Tekan kedua push button bersamaan!");
}

void loop() {
  // Loop memonitor status
  delay(500);
}
`,
    setup: (engine) => {
      engine.reset();
      engine.components.clear();
      engine.wires = [];

      const btnA = new VirtualButton("btnA", 80, 100);
      const btnB = new VirtualButton("btnB", 80, 200);
      const gate = new VirtualLogicGate("gate1", "AND", 240, 140);
      const led = new VirtualLED("led1", "red", 380, 130);

      // Power rail
      const mcu = new VirtualMCU("mcu1", "ESP32-S3", -180, 80); // off-screen or for VCC/GND
      engine.addComponent(mcu);
      engine.addComponent(btnA);
      engine.addComponent(btnB);
      engine.addComponent(gate);
      engine.addComponent(led);

      // Wire Buttons to VCC
      engine.addWire("mcu1", "3V3", "btnA", "pin1", "#ef4444");
      engine.addWire("mcu1", "3V3", "btnB", "pin1", "#ef4444");

      // Wire Buttons to AND Gate Inputs
      engine.addWire("btnA", "pin2", "gate1", "inA", "#00f0ff");
      engine.addWire("btnB", "pin2", "gate1", "inB", "#f59e0b");

      // Gate output to LED
      engine.addWire("gate1", "out", "led1", "anode", "#10b981");
      engine.addWire("mcu1", "GND_1", "led1", "cathode", "#000000");

      return mcu;
    }
  }
};

window.CIRCUIT_EXAMPLES = CIRCUIT_EXAMPLES;

