/**
 * Semantic & Indonesian Language Keyword Map for Electronic Components
 */
export const SEMANTIC_TAGS = {
  // Sensors & Environment
  suhu: ['dht11', 'dht22', 'bmp280', 'bme280', 'aht10', 'ds18b20'],
  panas: ['dht11', 'dht22', 'bmp280', 'bme280', 'aht10', 'ds18b20'],
  temp: ['dht11', 'dht22', 'bmp280', 'bme280', 'aht10', 'ds18b20'],
  temperature: ['dht11', 'dht22', 'bmp280', 'bme280', 'aht10', 'ds18b20'],
  lembab: ['dht11', 'dht22', 'bme280', 'aht10'],
  kelembapan: ['dht11', 'dht22', 'bme280', 'aht10'],
  humidity: ['dht11', 'dht22', 'bme280', 'aht10'],
  tekanan: ['bmp280', 'bme280'],
  barometer: ['bmp280', 'bme280'],
  jarak: ['ultrasonic', 'hcsr04'],
  sonar: ['ultrasonic', 'hcsr04'],
  ultrasonik: ['ultrasonic', 'hcsr04'],
  cahaya: ['bh1750', 'ldr'],
  terang: ['bh1750', 'ldr'],
  gelap: ['bh1750', 'ldr'],
  gerak: ['mpu-6050', 'pir'],
  kemiringan: ['mpu-6050'],
  giroskop: ['mpu-6050'],
  gyro: ['mpu-6050'],
  akselerometer: ['mpu-6050'],
  kompas: ['hmc5883l', 'mpu-6050'],
  jam: ['ds3231', 'rtc'],
  waktu: ['ds3231', 'rtc'],
  rtc: ['ds3231'],

  // Displays & Indicators
  layar: ['oled', 'lcd', 'ssd1306', 'display'],
  screen: ['oled', 'lcd', 'ssd1306', 'display'],
  monitor: ['oled', 'lcd', 'ssd1306', 'display'],
  tampilan: ['oled', 'lcd', 'ssd1306', 'display'],
  lampu: ['led', 'neopixel', 'ws2812'],
  kelap: ['led', 'neopixel', 'ws2812'],
  kedip: ['led', 'neopixel', 'ws2812'],
  warna: ['neopixel', 'ws2812', 'rgb'],
  suara: ['buzzer', 'piezo', 'speaker'],
  bunyi: ['buzzer', 'piezo', 'speaker'],
  alarm: ['buzzer', 'piezo', 'speaker'],

  // Actuators & Motors
  motor: ['servo', 'motor_driver', 'l298n', 'stepper'],
  dinamo: ['servo', 'motor_driver', 'l298n'],
  roda: ['servo', 'motor_driver', 'l298n'],
  sudut: ['servo'],
  derajat: ['servo'],
  penggerak: ['servo', 'motor_driver', 'l298n'],
  relai: ['relay'],
  relay: ['relay'],

  // Inputs, Switches & Passives
  saklar: ['push-button', 'switch', 'toggle', 'dip-switch'],
  tombol: ['push-button', 'switch', 'toggle'],
  pencet: ['push-button'],
  putar: ['potentiometer', 'potensio'],
  potensio: ['potentiometer'],
  volume: ['potentiometer'],
  tahanan: ['resistor'],
  hambatan: ['resistor'],
  kapasitor: ['capacitor'],
  elco: ['capacitor'],

  // Power & MCUs
  daya: ['battery', 'power', 'regulator', 'vcc', '5v', '3v3', '12v'],
  baterai: ['battery'],
  aki: ['battery'],
  cas: ['tp4056', 'battery'],
  charger: ['tp4056'],
  tegangan: ['ads1115', 'ina219', 'regulator'],
  arus: ['ina219', 'current'],
  otak: ['esp32', 'arduino', 'pico', 'mcu'],
  mikro: ['esp32', 'arduino', 'pico', 'mcu'],
  chip: ['esp32', 'arduino', 'pico', 'mcu'],
  wifi: ['esp32', 'esp32s3', 'nodemcu'],
  bluetooth: ['esp32', 'esp32s3']
};

/**
 * Checks if a component matches search query string via direct text or semantic Indonesian tags
 */
export function matchComponentSemantic(item, query) {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();
  const name = (item.name || item.label || '').toLowerCase();
  const desc = (item.desc || '').toLowerCase();
  const id = (item.id || '').toLowerCase();

  // 1. Direct text match
  if (name.includes(q) || desc.includes(q) || id.includes(q)) {
    return true;
  }

  // 2. Exact semantic dictionary lookup
  const matchedTargetIds = SEMANTIC_TAGS[q];
  if (matchedTargetIds) {
    if (matchedTargetIds.some(target => id.includes(target) || name.includes(target))) {
      return true;
    }
  }

  // 3. Partial keyword lookup (e.g. user typed "suhu udara")
  for (const [tagKey, targets] of Object.entries(SEMANTIC_TAGS)) {
    if (q.includes(tagKey) || tagKey.includes(q)) {
      if (targets.some(target => id.includes(target) || name.includes(target))) {
        return true;
      }
    }
  }

  return false;
}
