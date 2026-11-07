/** Component library — all draggable component definitions */
export const CATEGORIES = [
  {
    id: "mcu",
    label: "Microcontrollers",
    icon: "🧠",
    items: [
      {
        id: "esp32-devkit",
        name: "ESP32 DevKit",
        theme: "mcu",
        isMCU: true,
        width: 220,
        height: 0,
        desc: "ESP32 DevKit V1 (38-pin)",
      },
      {
        id: "esp32s3-devkit",
        name: "ESP32-S3 N16R8",
        theme: "mcu",
        isMCU: true,
        width: 220,
        height: 0,
        desc: "ESP32-S3 DevKitC-1 N16R8",
      },
      {
        id: "arduino-uno",
        name: "Arduino Uno",
        theme: "mcu",
        isMCU: true,
        width: 220,
        height: 0,
        desc: "Arduino Uno R3 (ATmega328P)",
      },
      {
        id: "arduino-nano",
        name: "Arduino Nano",
        theme: "mcu",
        isMCU: true,
        width: 200,
        height: 0,
        desc: "Arduino Nano (ATmega328P)",
      },
      {
        id: "arduino-mega",
        name: "Arduino Mega",
        theme: "mcu",
        isMCU: true,
        width: 220,
        height: 0,
        desc: "Arduino Mega 2560",
      },
      {
        id: "rpi4",
        name: "Raspberry Pi 4",
        theme: "mcu",
        isMCU: true,
        width: 230,
        height: 0,
        desc: "RPi 4B (40-pin GPIO)",
      },
      {
        id: "rpi-pico",
        name: "RPi Pico",
        theme: "mcu",
        isMCU: true,
        width: 200,
        height: 0,
        desc: "RPi Pico (RP2040)",
      },
    ],
  },
  {
    id: "display",
    label: "Displays",
    icon: "🖥️",
    items: [
      {
        id: "oled-ssd1306",
        name: "OLED 128×64",
        theme: "display",
        width: 140,
        height: 120,
        desc: "SSD1306 I2C OLED",
        pins: [
          { id: "VCC", label: "VCC", side: "right", pos: 0.25, type: "power" },
          { id: "GND", label: "GND", side: "right", pos: 0.5, type: "gnd" },
          { id: "SCL", label: "SCL", side: "right", pos: 0.7, type: "i2c" },
          { id: "SDA", label: "SDA", side: "right", pos: 0.9, type: "i2c" },
        ],
      },
      {
        id: "lcd-16x2",
        name: "LCD 16×2",
        theme: "display",
        width: 160,
        height: 110,
        desc: "16x2 LCD HD44780",
        pins: [
          { id: "VSS", label: "GND", side: "left", pos: 0.2, type: "gnd" },
          { id: "VDD", label: "5V", side: "left", pos: 0.35, type: "power" },
          { id: "RS", label: "RS", side: "left", pos: 0.55, type: "digital" },
          { id: "EN", label: "EN", side: "left", pos: 0.65, type: "digital" },
          { id: "D4", label: "D4", side: "left", pos: 0.75, type: "digital" },
          { id: "D5", label: "D5", side: "left", pos: 0.8, type: "digital" },
          { id: "D6", label: "D6", side: "left", pos: 0.87, type: "digital" },
          { id: "D7", label: "D7", side: "left", pos: 0.93, type: "digital" },
        ],
      },
      {
        id: "oled-sh1106",
        name: "OLED SH1106 1.3\"",
        theme: "display",
        width: 140,
        height: 120,
        desc: "SH1106 1.3\" I2C 128x64 OLED",
        pins: [
          { id: "VCC", label: "VCC (3.3-5V)", side: "right", pos: 0.25, type: "power" },
          { id: "GND", label: "GND", side: "right", pos: 0.5, type: "gnd" },
          { id: "SCL", label: "SCL", side: "right", pos: 0.7, type: "i2c" },
          { id: "SDA", label: "SDA", side: "right", pos: 0.9, type: "i2c" },
        ],
      },
    ],
  },
  {
    id: "sensors",
    label: "Sensors",
    icon: "📡",
    items: [
      {
        id: "ntc-thermistor",
        name: "NTC Thermistor",
        theme: "sensor",
        width: 100,
        height: 90,
        desc: "NTC Temperature Sensor",
        pins: [
          { id: "1", label: "Pin 1", side: "left", pos: 0.35, type: "analog" },
          { id: "2", label: "Pin 2", side: "left", pos: 0.65, type: "gnd" },
        ],
      },
      {
        id: "tps-sensor",
        name: "TPS Sensor",
        theme: "sensor",
        width: 120,
        height: 100,
        desc: "Throttle Position Sensor 0-5V",
        pins: [
          {
            id: "VCC",
            label: "VCC (5V)",
            side: "left",
            pos: 0.25,
            type: "power",
          },
          { id: "GND", label: "GND", side: "left", pos: 0.55, type: "gnd" },
          {
            id: "SIG",
            label: "Signal",
            side: "right",
            pos: 0.5,
            type: "analog",
          },
        ],
      },
      {
        id: "dht22",
        name: "DHT22",
        theme: "sensor",
        width: 110,
        height: 100,
        desc: "Temp & Humidity Sensor",
        pins: [
          { id: "VCC", label: "VCC", side: "left", pos: 0.2, type: "power" },
          {
            id: "DATA",
            label: "DATA",
            side: "left",
            pos: 0.5,
            type: "digital",
          },
          { id: "GND", label: "GND", side: "left", pos: 0.85, type: "gnd" },
        ],
      },
      {
        id: "hc-sr04",
        name: "HC-SR04",
        theme: "sensor",
        width: 120,
        height: 100,
        desc: "Ultrasonic Distance Sensor",
        pins: [
          { id: "VCC", label: "VCC", side: "top", pos: 0.2, type: "power" },
          { id: "TRIG", label: "TRIG", side: "top", pos: 0.4, type: "digital" },
          {
            id: "ECHO",
            label: "ECHO",
            side: "top",
            pos: 0.65,
            type: "digital",
          },
          { id: "GND", label: "GND", side: "top", pos: 0.85, type: "gnd" },
        ],
      },
      {
        id: "bme280",
        name: "BME280 Sensor",
        theme: "sensor",
        width: 130,
        height: 140,
        desc: "Temp, Humidity & Pressure (I2C/SPI)",
        pins: [
          { id: "VIN", label: "VIN (3.3V)", side: "left", pos: 0.18, type: "power" },
          { id: "GND", label: "GND", side: "left", pos: 0.35, type: "gnd" },
          { id: "SCL", label: "SCL/SCK", side: "left", pos: 0.52, type: "i2c" },
          { id: "SDA", label: "SDA/MOSI", side: "left", pos: 0.7, type: "i2c" },
          { id: "CSB", label: "CSB", side: "right", pos: 0.35, type: "spi" },
          { id: "SDO", label: "SDO/MISO", side: "right", pos: 0.65, type: "spi" },
        ],
      },
      {
        id: "mpu6050",
        name: "MPU6050 6-DOF",
        theme: "sensor",
        width: 130,
        height: 150,
        desc: "3-Axis Gyro + Accelerometer (I2C)",
        pins: [
          { id: "VCC", label: "VCC (3.3-5V)", side: "left", pos: 0.16, type: "power" },
          { id: "GND", label: "GND", side: "left", pos: 0.32, type: "gnd" },
          { id: "SCL", label: "SCL", side: "left", pos: 0.5, type: "i2c" },
          { id: "SDA", label: "SDA", side: "left", pos: 0.68, type: "i2c" },
          { id: "XDA", label: "XDA", side: "right", pos: 0.25, type: "digital" },
          { id: "XCL", label: "XCL", side: "right", pos: 0.45, type: "digital" },
          { id: "AD0", label: "AD0", side: "right", pos: 0.65, type: "digital" },
          { id: "INT", label: "INT", side: "right", pos: 0.85, type: "digital" },
        ],
      },
      {
        id: "pir-hcsr501",
        name: "PIR HC-SR501",
        theme: "sensor",
        width: 120,
        height: 100,
        desc: "PIR Motion Detection Sensor",
        pins: [
          { id: "VCC", label: "VCC (5V)", side: "left", pos: 0.25, type: "power" },
          { id: "OUT", label: "OUT (3.3V)", side: "right", pos: 0.5, type: "digital" },
          { id: "GND", label: "GND", side: "left", pos: 0.75, type: "gnd" },
        ],
      },
    ],
  },
  {
    id: "power",
    label: "Power",
    icon: "🔋",
    items: [
      {
        id: "battery-12v",
        name: "Battery 12V",
        theme: "power",
        width: 130,
        height: 100,
        desc: "12V Lead-Acid Battery",
        pins: [
          { id: "+", label: "+12V", side: "left", pos: 0.35, type: "power" },
          { id: "-", label: "GND", side: "left", pos: 0.65, type: "gnd" },
        ],
      },
      {
        id: "buck-conv",
        name: "Buck Converter",
        theme: "power",
        width: 140,
        height: 110,
        desc: "DC-DC Buck (LM2596)",
        props: { voltage: "5V" },
        pins: [
          {
            id: "IN+",
            label: "IN+  12V",
            side: "left",
            pos: 0.3,
            type: "power",
          },
          {
            id: "IN-",
            label: "IN−  GND",
            side: "left",
            pos: 0.65,
            type: "gnd",
          },
          {
            id: "OUT+",
            label: "OUT+ 5V",
            side: "right",
            pos: 0.3,
            type: "power",
          },
          {
            id: "OUT-",
            label: "OUT− GND",
            side: "right",
            pos: 0.65,
            type: "gnd",
          },
        ],
      },
      {
        id: "fuse",
        name: "Fuse",
        theme: "power",
        width: 100,
        height: 70,
        desc: "Automotive Fuse",
        props: { rating: "1A" },
        pins: [
          { id: "1", label: "IN", side: "left", pos: 0.5, type: "power" },
          { id: "2", label: "OUT", side: "right", pos: 0.5, type: "power" },
        ],
      },
      {
        id: "lm7805",
        name: "LM7805 5V",
        theme: "power",
        width: 110,
        height: 80,
        desc: "5V Linear Regulator",
        pins: [
          { id: "IN", label: "IN", side: "left", pos: 0.5, type: "power" },
          { id: "GND", label: "GND", side: "bottom", pos: 0.5, type: "gnd" },
          { id: "OUT", label: "OUT", side: "right", pos: 0.5, type: "power" },
        ],
      },
    ],
  },
  {
    id: "passive",
    label: "Passive",
    icon: "⚡",
    items: [
      {
        id: "resistor",
        name: "Resistor",
        theme: "passive",
        width: 100,
        height: 70,
        desc: "Resistor",
        props: { value: "10kΩ" },
        pins: [
          { id: "1", label: "1", side: "left", pos: 0.5, type: "passive" },
          { id: "2", label: "2", side: "right", pos: 0.5, type: "passive" },
        ],
      },
      {
        id: "capacitor",
        name: "Capacitor",
        theme: "passive",
        width: 90,
        height: 70,
        desc: "Capacitor",
        props: { value: "100nF" },
        pins: [
          { id: "+", label: "+", side: "left", pos: 0.5, type: "passive" },
          { id: "-", label: "−", side: "right", pos: 0.5, type: "passive" },
        ],
      },
      {
        id: "led",
        name: "LED",
        theme: "passive",
        width: 90,
        height: 70,
        desc: "LED",
        pins: [
          { id: "A", label: "A (+)", side: "left", pos: 0.5, type: "power" },
          { id: "K", label: "K (−)", side: "right", pos: 0.5, type: "gnd" },
        ],
      },
      {
        id: "diode-1n4007",
        name: "1N4007",
        theme: "passive",
        width: 100,
        height: 70,
        desc: "Rectifier Diode",
        pins: [
          { id: "A", label: "A", side: "left", pos: 0.5, type: "passive" },
          { id: "K", label: "K", side: "right", pos: 0.5, type: "passive" },
        ],
      },
      {
        id: "zener",
        name: "Zener 3.3V",
        theme: "passive",
        width: 100,
        height: 70,
        desc: "Zener Diode",
        props: { voltage: "3.3V" },
        pins: [
          { id: "A", label: "A", side: "left", pos: 0.5, type: "passive" },
          { id: "K", label: "K", side: "right", pos: 0.5, type: "passive" },
        ],
      },
      {
        id: "tvs",
        name: "TVS 18V",
        theme: "passive",
        width: 100,
        height: 70,
        desc: "TVS Suppressor Diode",
        pins: [
          { id: "A", label: "A", side: "left", pos: 0.5, type: "passive" },
          { id: "K", label: "K", side: "right", pos: 0.5, type: "passive" },
        ],
      },
      {
        id: "vdivider",
        name: "Volt Divider",
        theme: "passive",
        width: 120,
        height: 110,
        desc: "Voltage Divider",
        props: { r1: "100kΩ", r2: "22kΩ" },
        pins: [
          { id: "IN", label: "IN", side: "left", pos: 0.25, type: "analog" },
          { id: "OUT", label: "OUT", side: "right", pos: 0.5, type: "analog" },
          { id: "GND", label: "GND", side: "bottom", pos: 0.5, type: "gnd" },
        ],
      },
    ],
  },
  {
    id: "switches",
    label: "Switches",
    icon: "🔘",
    items: [
      {
        id: "pushbutton",
        name: "Push Button",
        theme: "switch",
        width: 90,
        height: 80,
        desc: "Momentary Push Button",
        pins: [
          { id: "1", label: "1", side: "left", pos: 0.5, type: "digital" },
          { id: "2", label: "2", side: "right", pos: 0.5, type: "digital" },
        ],
      },
      {
        id: "relay",
        name: "5V Relay",
        theme: "switch",
        width: 130,
        height: 120,
        desc: "5V/12V Relay Module",
        pins: [
          { id: "VCC", label: "VCC", side: "top", pos: 0.25, type: "power" },
          { id: "GND", label: "GND", side: "top", pos: 0.5, type: "gnd" },
          { id: "IN", label: "IN", side: "top", pos: 0.75, type: "digital" },
          {
            id: "COM",
            label: "COM",
            side: "bottom",
            pos: 0.3,
            type: "passive",
          },
          { id: "NO", label: "NO", side: "bottom", pos: 0.55, type: "passive" },
          { id: "NC", label: "NC", side: "bottom", pos: 0.8, type: "passive" },
        ],
      },
    ],
  },
  {
    id: "comms",
    label: "Communication",
    icon: "📶",
    items: [
      {
        id: "opto-pc817",
        name: "Opto PC817",
        theme: "comms",
        width: 130,
        height: 110,
        desc: "PC817 Optocoupler",
        pins: [
          {
            id: "A",
            label: "Anode (+)",
            side: "left",
            pos: 0.3,
            type: "power",
          },
          {
            id: "K",
            label: "Cathode (−)",
            side: "left",
            pos: 0.65,
            type: "gnd",
          },
          {
            id: "C",
            label: "Collector",
            side: "right",
            pos: 0.3,
            type: "digital",
          },
          { id: "E", label: "Emitter", side: "right", pos: 0.65, type: "gnd" },
        ],
      },
      {
        id: "sd-card",
        name: "MicroSD",
        theme: "comms",
        width: 130,
        height: 130,
        desc: "MicroSD SPI Module",
        pins: [
          { id: "VCC", label: "VCC", side: "right", pos: 0.15, type: "power" },
          { id: "GND", label: "GND", side: "right", pos: 0.33, type: "gnd" },
          { id: "MOSI", label: "MOSI", side: "right", pos: 0.5, type: "spi" },
          { id: "MISO", label: "MISO", side: "right", pos: 0.67, type: "spi" },
          { id: "SCK", label: "SCK", side: "right", pos: 0.83, type: "spi" },
          { id: "CS", label: "CS", side: "bottom", pos: 0.5, type: "spi" },
        ],
      },
      {
        id: "mcp2515",
        name: "MCP2515 CAN",
        theme: "comms",
        width: 130,
        height: 130,
        desc: "CAN Bus Controller SPI",
        pins: [
          { id: "VCC", label: "VCC", side: "left", pos: 0.15, type: "power" },
          { id: "GND", label: "GND", side: "left", pos: 0.3, type: "gnd" },
          { id: "CS", label: "CS", side: "left", pos: 0.5, type: "spi" },
          { id: "SO", label: "MISO", side: "left", pos: 0.65, type: "spi" },
          { id: "SI", label: "MOSI", side: "right", pos: 0.35, type: "spi" },
          { id: "SCK", label: "SCK", side: "right", pos: 0.55, type: "spi" },
          {
            id: "INT",
            label: "INT",
            side: "right",
            pos: 0.72,
            type: "digital",
          },
          {
            id: "CANH",
            label: "CANH",
            side: "top",
            pos: 0.35,
            type: "passive",
          },
          {
            id: "CANL",
            label: "CANL",
            side: "top",
            pos: 0.65,
            type: "passive",
          },
        ],
      },
      {
        id: "kline",
        name: "K-Line IF",
        theme: "comms",
        width: 140,
        height: 110,
        desc: "ISO 9141 K-Line Transceiver",
        pins: [
          {
            id: "KLINE",
            label: "K-Line",
            side: "left",
            pos: 0.3,
            type: "passive",
          },
          { id: "VCC", label: "VCC", side: "top", pos: 0.5, type: "power" },
          { id: "RX", label: "RX→ESP", side: "right", pos: 0.35, type: "uart" },
          { id: "TX", label: "TX←ESP", side: "right", pos: 0.65, type: "uart" },
          { id: "GND", label: "GND", side: "bottom", pos: 0.5, type: "gnd" },
        ],
      },
      {
        id: "neo6m",
        name: "GPS NEO-6M",
        theme: "comms",
        width: 120,
        height: 100,
        desc: "NEO-6M GPS UART",
        pins: [
          { id: "VCC", label: "VCC", side: "left", pos: 0.2, type: "power" },
          { id: "GND", label: "GND", side: "left", pos: 0.5, type: "gnd" },
          { id: "TX", label: "TX", side: "left", pos: 0.75, type: "uart" },
          { id: "RX", label: "RX", side: "right", pos: 0.5, type: "uart" },
        ],
      },
      {
        id: "level-shifter-4ch",
        name: "Level Shifter 4CH",
        theme: "comms",
        width: 150,
        height: 160,
        desc: "4-Channel Bidirectional 3.3V ↔ 5V",
        pins: [
          { id: "HV", label: "HV (5V)", side: "left", pos: 0.12, type: "power" },
          { id: "GND_H", label: "GND", side: "left", pos: 0.26, type: "gnd" },
          { id: "HV1", label: "HV1", side: "left", pos: 0.42, type: "digital" },
          { id: "HV2", label: "HV2", side: "left", pos: 0.58, type: "digital" },
          { id: "HV3", label: "HV3", side: "left", pos: 0.74, type: "digital" },
          { id: "HV4", label: "HV4", side: "left", pos: 0.9, type: "digital" },
          { id: "LV", label: "LV (3.3V)", side: "right", pos: 0.12, type: "power" },
          { id: "GND_L", label: "GND", side: "right", pos: 0.26, type: "gnd" },
          { id: "LV1", label: "LV1", side: "right", pos: 0.42, type: "digital" },
          { id: "LV2", label: "LV2", side: "right", pos: 0.58, type: "digital" },
          { id: "LV3", label: "LV3", side: "right", pos: 0.74, type: "digital" },
          { id: "LV4", label: "LV4", side: "right", pos: 0.9, type: "digital" },
        ],
      },
    ],
  },
  {
    id: "transistors",
    label: "Transistors & ICs",
    icon: "🔬",
    items: [
      {
        id: "npn-2n2222",
        name: "NPN 2N2222",
        theme: "passive",
        width: 100,
        height: 100,
        desc: "NPN Transistor",
        pins: [
          { id: "B", label: "Base", side: "left", pos: 0.5, type: "digital" },
          {
            id: "C",
            label: "Collector",
            side: "top",
            pos: 0.5,
            type: "passive",
          },
          { id: "E", label: "Emitter", side: "bottom", pos: 0.5, type: "gnd" },
        ],
      },
    ],
  },
  {
    id: "output",
    label: "Output",
    icon: "🔊",
    items: [
      {
        id: "buzzer",
        name: "Buzzer",
        theme: "output",
        width: 100,
        height: 90,
        desc: "Piezo Buzzer",
        pins: [
          {
            id: "+",
            label: "+ Signal",
            side: "left",
            pos: 0.4,
            type: "digital",
          },
          { id: "-", label: "− GND", side: "bottom", pos: 0.5, type: "gnd" },
        ],
      },
    ],
  },
  {
    id: "ports",
    label: "Net Ports & Flags",
    icon: "🚩",
    items: [
      {
        id: "gnd-flag",
        name: "GND Port",
        theme: "power",
        isNetPort: true,
        width: 70,
        height: 60,
        desc: "Ground 0V Reference Flag (⏚)",
        pins: [
          { id: "GND", label: "GND", side: "top", pos: 0.5, type: "gnd" },
        ],
      },
      {
        id: "vcc-flag",
        name: "+5V Port",
        theme: "power",
        isNetPort: true,
        width: 70,
        height: 60,
        desc: "+5V Power Supply Flag (▲)",
        pins: [
          { id: "VCC", label: "+5V", side: "bottom", pos: 0.5, type: "power" },
        ],
      },
      {
        id: "v33-flag",
        name: "+3.3V Port",
        theme: "power",
        isNetPort: true,
        width: 70,
        height: 60,
        desc: "+3.3V Power Supply Flag (▲)",
        pins: [
          { id: "3V3", label: "+3.3V", side: "bottom", pos: 0.5, type: "power" },
        ],
      },
      {
        id: "v12-flag",
        name: "+12V Port",
        theme: "power",
        isNetPort: true,
        width: 70,
        height: 60,
        desc: "+12V Power Supply Flag (▲)",
        pins: [
          { id: "12V", label: "+12V", side: "bottom", pos: 0.5, type: "power" },
        ],
      },
    ],
  },
];

const CUSTOM_KEY = "wiretool_custom_components";

export function getCustomComponents() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CUSTOM_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function saveCustomComponent(comp) {
  try {
    const existing = getCustomComponents();
    const updated = [...existing.filter((c) => c.id !== comp.id), comp];
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
    return updated;
  } catch (_) {
    return [];
  }
}

export function deleteCustomComponent(id) {
  try {
    const existing = getCustomComponents();
    const updated = existing.filter((c) => c.id !== id);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
    return updated;
  } catch (_) {
    return [];
  }
}

export function findCompDef(id) {
  for (const cat of CATEGORIES) {
    const found = cat.items.find((i) => i.id === id);
    if (found) return JSON.parse(JSON.stringify(found));
  }
  const custom = getCustomComponents().find((i) => i.id === id);
  if (custom) return JSON.parse(JSON.stringify(custom));
  return null;
}
