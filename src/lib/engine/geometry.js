/**
 * Pure geometry — no DOM, no Svelte.
 * Single source of truth for ALL pin position math.
 * Both CompNode.svelte and WireLayer use these same functions.
 */
import { MCU_PINS } from "$lib/data/mcu-pins.js";

export const TITLE_H = 40; // title bar height
export const PIN_R = 7; // pin dot radius
export const STUB_LEN = 36; // wire exit stub length
export const GRID = 20; // snap grid size

// ── BUG FIX #2: single formula used by BOTH renderer and router ──
export function mcuPinSpacing(height, pinCount) {
  if (pinCount <= 1) return 0;
  return (height - TITLE_H - 20) / (pinCount - 1);
}

export function mcuHeight(compId) {
  const pins = MCU_PINS[compId];
  if (!pins) return 300;
  const count = Math.max((pins.left ?? []).length, (pins.right ?? []).length);
  return count * 26 + TITLE_H + 20;
}

/** Compute world {x, y, side} of a pin on a component */
export function pinPos(comp) {
  return (pinId) => {
    const { x, y, width: W, height: H } = comp;
    if (comp.isMCU) {
      const pins = MCU_PINS[comp.id];
      if (!pins) return { x: x + W / 2, y: y + H / 2, side: "right" };
      const left = pins.left ?? [];
      const right = pins.right ?? [];
      const count = Math.max(left.length, right.length);
      const sp = mcuPinSpacing(H, count); // ← unified formula
      const li = left.findIndex((p) => p.id === pinId);
      if (li >= 0) return { x, y: y + TITLE_H + 10 + li * sp, side: "left" };
      const ri = right.findIndex((p) => p.id === pinId);
      if (ri >= 0)
        return { x: x + W, y: y + TITLE_H + 10 + ri * sp, side: "right" };
    }
    const pin = (comp.pins ?? []).find((p) => p.id === pinId);
    if (!pin) return { x: x + W / 2, y: y + H / 2, side: "right" };
    switch (pin.side) {
      case "left":
        return { x, y: y + TITLE_H + (H - TITLE_H) * pin.pos, side: "left" };
      case "right":
        return {
          x: x + W,
          y: y + TITLE_H + (H - TITLE_H) * pin.pos,
          side: "right",
        };
      case "top":
        return { x: x + W * pin.pos, y, side: "top" };
      case "bottom":
        return { x: x + W * pin.pos, y: y + H, side: "bottom" };
      default:
        return { x: x + W / 2, y: y + H / 2, side: "right" };
    }
  };
}

/** All pins of a component as { id, pos:{x,y,side} }[] */
export function allPinPositions(comp) {
  const result = [];
  if (comp.isMCU) {
    const pins = MCU_PINS[comp.id];
    if (!pins) return result;
    const get = pinPos(comp);
    [...(pins.left ?? []), ...(pins.right ?? [])].forEach((p) => {
      result.push({ id: p.id, pos: get(p.id) });
    });
  } else {
    const get = pinPos(comp);
    (comp.pins ?? []).forEach((p) => {
      result.push({ id: p.id, pos: get(p.id) });
    });
  }
  return result;
}

/** Exit stub: wire leaves pin perpendicular, optionally offset for fan-out */
function stub(p, offsetPx = 0) {
  switch (p.side) {
    case "left":
      return { x: p.x - STUB_LEN, y: p.y + offsetPx };
    case "right":
      return { x: p.x + STUB_LEN, y: p.y + offsetPx };
    case "top":
      return { x: p.x + offsetPx, y: p.y - STUB_LEN };
    case "bottom":
      return { x: p.x + offsetPx, y: p.y + STUB_LEN };
    default:
      return { x: p.x + STUB_LEN, y: p.y };
  }
}

/**
 * Orthogonal wire path.
 * wireIndex: offset index for fan-out (avoids overlap when multiple
 * wires leave adjacent pins on the same side)
 */
export function routeWire(p1, p2, wireIndex = 0) {
  const off = (wireIndex % 2 === 0 ? 1 : -1) * Math.floor(wireIndex / 2) * 10;
  const s1 = stub(p1, off);
  const s2 = stub(p2, off);
  const h1 = p1.side === "left" || p1.side === "right";
  const h2 = p2.side === "left" || p2.side === "right";
  const pts = [p1, s1];

  if (h1 && h2) {
    const my = (s1.y + s2.y) / 2;
    pts.push({ x: s1.x, y: my }, { x: s2.x, y: my });
  } else if (!h1 && !h2) {
    const mx = (s1.x + s2.x) / 2;
    pts.push({ x: mx, y: s1.y }, { x: mx, y: s2.y });
  } else if (h1) {
    pts.push({ x: s1.x, y: s2.y });
  } else {
    pts.push({ x: s2.x, y: s1.y });
  }
  pts.push(s2, p2);
  return { d: toPath(pts), pts };
}

/** Preview path (cursor to pin) */
export function routePreview(p1, cx, cy) {
  const s1 = stub(p1);
  const mx = (s1.x + cx) / 2;
  const pts = [p1, s1, { x: mx, y: s1.y }, { x: mx, y: cy }, { x: cx, y: cy }];
  return toPath(pts);
}

/** Midpoint along the actual path segments (for wire label) */
export function pathMidpoint(pts) {
  if (!pts || pts.length < 2) return { x: 0, y: 0 };
  let total = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segs.push({ len, from: pts[i - 1], to: pts[i] });
    total += len;
  }
  let remaining = total / 2;
  for (const seg of segs) {
    if (remaining <= seg.len) {
      const t = remaining / seg.len;
      return {
        x: seg.from.x + (seg.to.x - seg.from.x) * t,
        y: seg.from.y + (seg.to.y - seg.from.y) * t,
      };
    }
    remaining -= seg.len;
  }
  return pts[Math.floor(pts.length / 2)];
}

function toPath(pts) {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${r(p.x)} ${r(p.y)}`)
    .join(" ");
}

function r(n) {
  return Math.round(n * 10) / 10;
}

export function snap(v, g = GRID) {
  return Math.round(v / g) * g;
}

/** Nearest pin within maxDist world-px; returns { comp, pinId, pos } | null */
export function nearestPin(
  comps,
  wx,
  wy,
  maxDist = 30,
  excludeComp = null,
  excludePin = null,
) {
  let best = null,
    bestDist = maxDist;
  for (const comp of comps) {
    if (excludeComp && comp.instanceId === excludeComp) continue;
    const pins = allPinPositions(comp);
    for (const { id, pos } of pins) {
      if (excludePin && id === excludePin) continue;
      const d = Math.hypot(pos.x - wx, pos.y - wy);
      if (d < bestDist) {
        bestDist = d;
        best = { comp, pinId: id, pos };
      }
    }
  }
  return best;
}
