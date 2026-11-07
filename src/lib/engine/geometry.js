/**
 * Pure geometry — no DOM, no Svelte.
 * Single source of truth for ALL pin position math.
 * Both CompNode.svelte and WireLayer use these same functions.
 */
import { MCU_PINS } from "$lib/data/mcu-pins.js";

export const TITLE_H = 40; // title bar height
export const PIN_R = 7; // pin dot radius
export const STUB_LEN = 40; // wire exit stub length
export const GRID = 20; // snap grid size

// ── Single formula used by BOTH renderer and router ──────────────────
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

// ── Pin world positions ───────────────────────────────────────────────

function rotateSide(side, deg) {
  const SIDES = ["top", "right", "bottom", "left"];
  const idx = SIDES.indexOf(side);
  if (idx < 0) return side;
  const steps = Math.round((((deg % 360) + 360) % 360) / 90);
  return SIDES[(idx + steps) % 4];
}

/** Returns a function (pinId) => {x, y, side} for the given component */
export function pinPos(comp) {
  return (pinId) => {
    const { x, y, width: W, height: H } = comp;
    let base = null;
    if (comp.isMCU) {
      const pins = MCU_PINS[comp.id];
      if (!pins) base = { x: x + W / 2, y: y + H / 2, side: "right" };
      else {
        const left = pins.left ?? [];
        const right = pins.right ?? [];
        const count = Math.max(left.length, right.length);
        const sp = mcuPinSpacing(H, count);
        const li = left.findIndex((p) => p.id === pinId);
        if (li >= 0) base = { x, y: y + TITLE_H + 10 + li * sp, side: "left" };
        else {
          const ri = right.findIndex((p) => p.id === pinId);
          if (ri >= 0)
            base = { x: x + W, y: y + TITLE_H + 10 + ri * sp, side: "right" };
        }
      }
    }
    if (!base) {
      const pin = (comp.pins ?? []).find((p) => p.id === pinId);
      if (!pin) base = { x: x + W / 2, y: y + H / 2, side: "right" };
      else {
        const pos = isFinite(pin.pos) ? pin.pos : 0.5;
        switch (pin.side) {
          case "left":
            base = { x, y: y + TITLE_H + (H - TITLE_H) * pos, side: "left" };
            break;
          case "right":
            base = {
              x: x + W,
              y: y + TITLE_H + (H - TITLE_H) * pos,
              side: "right",
            };
            break;
          case "top":
            base = { x: x + W * pos, y, side: "top" };
            break;
          case "bottom":
            base = { x: x + W * pos, y: y + H, side: "bottom" };
            break;
          default:
            base = { x: x + W / 2, y: y + H / 2, side: "right" };
        }
      }
    }

    const rot = Math.round((((comp.rotation ?? 0) % 360) + 360) % 360);
    if (rot === 0) return base;

    const cx = x + W / 2;
    const cy = y + H / 2;
    const rad = (rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = cx + (base.x - cx) * cos - (base.y - cy) * sin;
    const ry = cy + (base.x - cx) * sin + (base.y - cy) * cos;
    return {
      x: Math.round(rx * 10) / 10,
      y: Math.round(ry * 10) / 10,
      side: rotateSide(base.side, rot),
    };
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

// ── Wire routing ──────────────────────────────────────────────────────

/** Exit stub: wire leaves pin perpendicular */
function stub(p) {
  switch (p.side) {
    case "left":
      return { x: p.x - STUB_LEN, y: p.y };
    case "right":
      return { x: p.x + STUB_LEN, y: p.y };
    case "top":
      return { x: p.x, y: p.y - STUB_LEN };
    case "bottom":
      return { x: p.x, y: p.y + STUB_LEN };
    default:
      return { x: p.x + STUB_LEN, y: p.y };
  }
}

/**
 * Simple integer hash of a string — used to give each wire a stable,
 * unique lane offset based on its endpoint coords.
 */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Wire routing supporting Orthogonal (Manhattan), Curved (Bezier), and Direct.
 */
export function routeWire(p1, p2, wireIndex = 0, mode = "orthogonal") {
  if (mode === "direct") {
    const pts = [p1, p2];
    return { d: `M ${r(p1.x)} ${r(p1.y)} L ${r(p2.x)} ${r(p2.y)}`, pts };
  }

  const s1 = stub(p1);
  const s2 = stub(p2);

  if (mode === "curved") {
    // Smooth cubic bezier with pin stubs acting as tangent control handles
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const handleLen = Math.min(Math.max(dist * 0.45, 40), 160);

    const c1 = {
      x: p1.side === 'left' ? p1.x - handleLen : p1.side === 'right' ? p1.x + handleLen : p1.x,
      y: p1.side === 'top' ? p1.y - handleLen : p1.side === 'bottom' ? p1.y + handleLen : p1.y
    };
    const c2 = {
      x: p2.side === 'left' ? p2.x - handleLen : p2.side === 'right' ? p2.x + handleLen : p2.x,
      y: p2.side === 'top' ? p2.y - handleLen : p2.side === 'bottom' ? p2.y + handleLen : p2.y
    };

    // Sample bezier curve into points so pathMidpoint & labelPos place labels exactly on the curve
    const pts = [];
    const steps = 10;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      const tt = t * t, uu = u * u;
      const uuu = uu * u, ttt = tt * t;
      pts.push({
        x: uuu * p1.x + 3 * uu * t * c1.x + 3 * u * tt * c2.x + ttt * p2.x,
        y: uuu * p1.y + 3 * uu * t * c1.y + 3 * u * tt * c2.y + ttt * p2.y
      });
    }

    return {
      d: `M ${r(p1.x)} ${r(p1.y)} C ${r(c1.x)} ${r(c1.y)}, ${r(c2.x)} ${r(c2.y)}, ${r(p2.x)} ${r(p2.y)}`,
      pts
    };
  }

  // Orthogonal wire routing with lane fan-out
  const key = `${Math.round(p1.x)},${Math.round(p1.y)},${Math.round(p2.x)},${Math.round(p2.y)}`;
  const hashOff = (hashStr(key) % 4) * 12; // 0, 12, 24, 36 px bands
  const sign = wireIndex % 2 === 0 ? 1 : -1;
  const lane = sign * (Math.floor(wireIndex / 2) * 20 + hashOff);

  const h1 = p1.side === "left" || p1.side === "right";
  const h2 = p2.side === "left" || p2.side === "right";
  const pts = [p1, s1];

  if (h1 && h2) {
    // Both horizontal exits — meet at a shared Y lane
    const my = (s1.y + s2.y) / 2 + lane;
    pts.push({ x: s1.x, y: my }, { x: s2.x, y: my });
  } else if (!h1 && !h2) {
    // Both vertical exits — meet at a shared X lane
    const mx = (s1.x + s2.x) / 2 + lane;
    pts.push({ x: mx, y: s1.y }, { x: mx, y: s2.y });
  } else if (h1) {
    // p1 horizontal, p2 vertical — L-bend
    pts.push({ x: s1.x, y: s2.y });
  } else {
    // p1 vertical, p2 horizontal — L-bend
    pts.push({ x: s2.x, y: s1.y });
  }
  pts.push(s2, p2);
  return { d: toPath(pts), pts };
}

/** Preview path (cursor to pin) */
export function routePreview(p1, cx, cy, mode = "orthogonal") {
  if (mode === "direct") {
    return `M ${r(p1.x)} ${r(p1.y)} L ${r(cx)} ${r(cy)}`;
  }
  const s1 = stub(p1);
  if (mode === "curved") {
    return `M ${r(p1.x)} ${r(p1.y)} Q ${r(s1.x)} ${r(s1.y)}, ${r(cx)} ${r(cy)}`;
  }
  const mx = (s1.x + cx) / 2;
  const pts = [p1, s1, { x: mx, y: s1.y }, { x: mx, y: cy }, { x: cx, y: cy }];
  return toPath(pts);
}

// ── Label position helpers ────────────────────────────────────────────

/** True midpoint along the path segments */
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
  if (total === 0) return { x: pts[0].x, y: pts[0].y };
  let remaining = total / 2;
  for (const seg of segs) {
    if (remaining <= seg.len) {
      const t = seg.len === 0 ? 0 : remaining / seg.len;
      return {
        x: seg.from.x + (seg.to.x - seg.from.x) * t,
        y: seg.from.y + (seg.to.y - seg.from.y) * t,
      };
    }
    remaining -= seg.len;
  }
  return pts[Math.floor(pts.length / 2)];
}

/**
 * Midpoint of the LONGEST segment — best spot for a wire label
 * because long segments are less likely to overlap other elements.
 */
export function labelPos(pts) {
  if (!pts || pts.length < 2) return { x: 0, y: 0 };
  let best = { len: -1, from: pts[0], to: pts[1] };
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > best.len) best = { len, from: pts[i - 1], to: pts[i] };
  }
  return {
    x: (best.from.x + best.to.x) / 2,
    y: (best.from.y + best.to.y) / 2,
  };
}

// ── Utilities ─────────────────────────────────────────────────────────

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
