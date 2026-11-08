# ⚡ Web Microcontroller & Circuit Logic Simulator ("Mini-Wokwi / TinkerCAD")

[![Platform: Web & Raspberry Pi](https://img.shields.io/badge/Platform-Web%20%7C%20Raspberry%20Pi-blue.svg)]()
[![Stack: HTML5 Canvas + Pure JS + Nginx](https://img.shields.io/badge/Stack-Canvas%20%2B%20Vanilla%20JS%20%2B%20Nginx-brightgreen.svg)]()
[![Engine: Nodal Circuit & C++ Interpreter](https://img.shields.io/badge/Engine-Interactive%20Simulation-orange.svg)]()

Simulator mikrokontroler interaktif dan rangkaian elektronika digital berbasis web ("Mini-Wokwi / TinkerCAD Clone") yang dapat menjalankan kode Arduino C++ secara langsung di peramban, menyelesaikan hukum rangkaian listrik (*Kirchhoff's Nodal Solver*), dan menggerakkan komponen periferal secara real-time.

---

## 🌟 Fitur Utama

1. **Virtual Microcontroller Core (ESP32-S3 & Arduino Uno):**
   - Mendukung pin digital GPIO (`INPUT`, `OUTPUT`, `INPUT_PULLUP`), PWM duty cycle (0-255), ADC analog reading 12-bit (0-4095), dan protokol bus I2C (SDA 21, SCL 22).
   - Virtual Serial UART: Mengirim log dari `Serial.print()` & `Serial.println()` langsung ke jendela Serial Monitor.
2. **Koleksi Periferal Interaktif Lengkap:**
   - **LED (Merah, Hijau, Biru, Kuning):** Dilengkapi efek pendaran cahaya dinamis (*radiant glow*) saat tegangan maju dialirkan.
   - **Push Button:** Tombol sakelar taktil interaktif yang dapat diklik langsung pada canvas.
   - **Potensiometer:** Knob putar interaktif untuk mengatur tegangan variabel ($0.0V - 3.3V$) ke pin ADC.
   - **OLED Display SSD1306 (128x64):** Layar monokrom grafis yang digerakkan oleh kueri I2C virtual (`display.print()`, `display.display()`).
   - **Piezo Buzzer:** Menghasilkan nada suara frekuensi $2.4\text{ kHz}$ melalui Web Audio API saat dialiri arus listrik.
   - **Gerbang Logika Digital (74HC Series):** Gerbang AND, OR, NOT, XOR, NAND, dan NOR untuk simulasi gerbang logika dan rangkaian digital (*Half/Full Adder, Flip-Flop*).
3. **Sistem Pengkabelan Interaktif (*Interactive Wiring*):**
   - Tarik garis kurva Bezier antar pin komponen untuk menghubungkan rangkaian secara dinamis.
   - Penentuan warna kabel otomatis (Hitam untuk GND, Merah untuk VCC/3.3V/5V, Cyan untuk sinyal data).
4. **Virtual Arduino C++ Code Runner:**
   - Menjalankan fungsi `setup()` dan `loop()` secara non-blocking tanpa membuat browser *freeze* (*cooperative async scheduler*).
   - Mendukung fungsi standar Arduino: `pinMode`, `digitalWrite`, `digitalRead`, `analogRead`, `analogWrite`, `delay`, `millis`, `map`, `constrain`, `random`.
5. **Template Contoh Rangkaian Siap Pakai:**
   - 💡 *1. Hello Blink LED (GPIO 2)*
   - 🔘 *2. Push Button Interaktif (Input Pullup)*
   - 🎛️ *3. Potensiometer ADC & PWM Dimmer*
   - 📺 *4. Display Grafis OLED SSD1306 (I2C)*
   - ⚡ *5. Gerbang Logika Digital (74HC08 AND Gate)*
6. **Ekspor & Impor Rangkaian:**
   - Simpan struktur rangkaian komponen dan pengkabelan dalam format JSON standar.

---

## 🚀 Cara Menjalankan

### Opsi 1: Menjalankan Langsung di Browser
Cukup buka berkas [`index.html`](index.html) di browser favorit Anda, atau jalankan server lokal sederhana:
```bash
cd "project/micro-simulator"
python -m http.server 8095
```
Buka peramban di: **`http://localhost:8095`**.

### Opsi 2: Menjalankan via Docker di MiniVPS
```bash
cd "project/micro-simulator"
docker compose up -d --build
```
Aplikasi akan online dan dapat diakses di port `8095`.

