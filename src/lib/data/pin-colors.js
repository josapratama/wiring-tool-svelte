/** Canonical color for each pin type — used by renderer and legend */
export const PIN_COLORS = {
  power: "#ef4444",
  gnd: "#6b7280",
  digital: "#4ade80",
  analog: "#f59e0b",
  i2c: "#a78bfa",
  spi: "#60a5fa",
  uart: "#34d399",
  pwm: "#fb923c",
  special: "#facc15",
  usb: "#818cf8",
  passive: "#94a3b8",
  nc: "#374151",
};

export function pinColor(type) {
  return PIN_COLORS[type] ?? "#94a3b8";
}
