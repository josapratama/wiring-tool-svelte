/**
 * Svelte store — single source of truth.
 * Bug fixes:
 *  #4 — loadDiagram clears history instead of pushing to it
 *  #3 — duplicate wire check via addWire
 *  #B1 — multi-delete uses single pushHistory (not N steps)
 *  #B2 — auto-save race condition fixed with _initialized flag
 *  #B3 — projectName included in getDiagram / autosave
 * Features:
 *  #9  — auto-save to localStorage
 *  #F1 — export netlist (pin-to-pin connections)
 *  #F2 — export BOM (bill of materials)
 *  #F3 — removeComponents (batch delete, single history step)
 */
import { writable, get } from "svelte/store";
import { findCompDef } from "$lib/data/components-db.js";
import { MCU_PINS } from "$lib/data/mcu-pins.js";
import { mcuHeight } from "$lib/engine/geometry.js";

// ── Core state ────────────────────────────────────────────
export const components = writable([]);
export const wires = writable([]);
export const labels = writable([]);
export const selection = writable(null); // { id, type }
export const multiSelection = writable([]); // [{ id, type }]
export const activeTool = writable("select");
export const routingMode = writable("orthogonal"); // 'orthogonal' | 'curved' | 'direct'
export const edaGridType = writable("dots"); // 'dots' | 'lines' | 'off'
export const showDrawingSheet = writable(true);
export const showPowerFlow = writable(false);
export const highlightedWireIds = writable(new Set());
export const activeHighlightedNet = writable(null);

// ── Multi-Mode & PCB Studio Extensions ─────────────────────────
export const renderMode = writable("realistic"); // 'realistic' (Wokwi) | 'schematic' (Symbol Blocks)
export const activeEditorView = writable("wiring"); // 'wiring' | 'pcb'
export const pcbBoardConfig = writable({
  widthMm: 100,
  heightMm: 80,
  thicknessMm: 1.6,
  layerCount: 2,
  gridStepMm: 2.54
});
export const copperTraces = writable([]);
export const pcbVias = writable([]);
export const activePcbLayer = writable("top"); // 'top' (F.Cu) | 'bottom' (B.Cu)
export const activeTraceWidthMm = writable(0.40); // 0.25, 0.40, 0.80, 1.20

export function setRenderMode(mode) {
  renderMode.set(mode === "schematic" ? "schematic" : "realistic");
}

export function toggleRenderMode() {
  renderMode.update(m => m === "realistic" ? "schematic" : "realistic");
}

export function setActiveEditorView(view) {
  activeEditorView.set(view === "pcb" ? "pcb" : "wiring");
}

export function addCopperTrace(trace) {
  pushHistory();
  const t = {
    id: trace.id || `trace_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...trace
  };
  copperTraces.update(traces => [...traces, t]);
  return t;
}

export function removeCopperTrace(traceId) {
  pushHistory();
  copperTraces.update(traces => traces.filter(t => t.id !== traceId));
}

export function clearCopperTraces() {
  pushHistory();
  copperTraces.set([]);
}

export function addPcbVia(via) {
  pushHistory();
  const v = {
    id: via.id || `via_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    outerMm: via.outerMm || 0.8,
    drillMm: via.drillMm || 0.45,
    ...via
  };
  pcbVias.update(vs => [...vs, v]);
  return v;
}

export function removePcbVia(viaId) {
  pushHistory();
  pcbVias.update(vs => vs.filter(v => v.id !== viaId));
}

export function clearPcbVias() {
  pushHistory();
  pcbVias.set([]);
}

export const sheetConfig = writable({
  title: "ESP32-S3 FI Diagnostic",
  engineer: "Electronics Eng",
  company: "EasyEDA CAD",
  date: new Date().toISOString().slice(0, 10),
  rev: "1.0",
  sheet: "1 / 1",
  size: "A3", // 'A4' | 'A3'
});

export function updateSheetConfig(patch) {
  sheetConfig.update((cfg) => ({ ...cfg, ...patch }));
}

// ── History ───────────────────────────────────────────────
const undoStack = [];
const redoStack = [];

function snapshot() {
  return JSON.stringify({
    c: get(components).map(strip),
    w: get(wires),
    l: get(labels),
    t: get(copperTraces),
    v: get(pcbVias),
    b: get(pcbBoardConfig),
  });
}

export function pushHistory() {
  undoStack.push(snapshot());
  redoStack.length = 0;
  if (undoStack.length > 80) undoStack.shift();
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(JSON.parse(undoStack.pop()));
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(JSON.parse(redoStack.pop()));
}

function restore(snap) {
  components.set((snap.c ?? []).map(attach));
  wires.set(snap.w ?? []);
  labels.set(snap.l ?? []);
  if (snap.t) copperTraces.set(snap.t);
  if (snap.v) pcbVias.set(snap.v);
  if (snap.b) pcbBoardConfig.set(snap.b);
  selection.set(null);
  multiSelection.set([]);
}

function strip(c) {
  const { mcuPinsData: _, ...r } = c;
  return r;
}

/** Ensure all numeric fields are valid — prevents NaN in SVG attributes.
 *  Also merges canonical pin `type` from components-db so old saved data
 *  with missing pin types is always fixed on load. */
function sanitize(c) {
  const def = c.id ? (findCompDef(c.id) ?? {}) : {};
  // Merge pin types from canonical definition
  let pins = c.pins ?? def.pins ?? [];
  if (pins.length && def.pins?.length) {
    const defMap = Object.fromEntries(def.pins.map((p) => [p.id, p]));
    pins = pins.map((p) => ({
      ...defMap[p.id], // canonical base
      ...p, // instance overrides
      type: p.type ?? defMap[p.id]?.type ?? "passive", // always have type
    }));
  }
  return {
    ...c,
    pins,
    x: isFinite(c.x) ? c.x : 100,
    y: isFinite(c.y) ? c.y : 100,
    width: isFinite(c.width) && c.width > 0 ? c.width : (def.width ?? 160),
    height:
      isFinite(c.height) && c.height > 0
        ? c.height
        : c.isMCU
          ? mcuHeight(c.id)
          : (def.height ?? 100),
  };
}

function attach(c) {
  const s = sanitize(c);
  if (s.isMCU && MCU_PINS[s.id]) return { ...s, mcuPinsData: MCU_PINS[s.id] };
  return s;
}

let _seq = 0;
export function uid(p) {
  return `${p}_${Date.now()}_${++_seq}`;
}

// ── Components ────────────────────────────────────────────
export function addComponent(partial) {
  const base = partial.id ? (findCompDef(partial.id) ?? partial) : partial;
  const comp = {
    ...base,
    instanceId: partial.instanceId ?? uid("c"),
    x: partial.x ?? 100,
    y: partial.y ?? 100,
    label: partial.label ?? base.name ?? partial.id,
    notes: partial.notes ?? "",
    props: { ...(base.props ?? {}), ...(partial.props ?? {}) },
    width: partial.width ?? base.width ?? 160,
    height:
      partial.height > 0
        ? partial.height
        : base.isMCU
          ? mcuHeight(base.id)
          : (base.height ?? 100),
  };
  if (comp.isMCU && MCU_PINS[comp.id]) comp.mcuPinsData = MCU_PINS[comp.id];
  components.update((cs) => [...cs, comp]);
  return comp;
}

export function updateComponent(id, patch) {
  components.update((cs) =>
    cs.map((c) => (c.instanceId === id ? { ...c, ...patch } : c)),
  );
}

export function rotateComponent(id, deg = 90) {
  pushHistory();
  components.update((cs) =>
    cs.map((c) => {
      if (c.instanceId === id) {
        const nextRot = (((c.rotation || 0) + deg) % 360 + 360) % 360;
        return { ...c, rotation: nextRot };
      }
      return c;
    }),
  );
}

export function rotateComponents(ids, deg = 90) {
  if (!ids?.length) return;
  pushHistory();
  const set = new Set(ids);
  components.update((cs) =>
    cs.map((c) => {
      if (set.has(c.instanceId)) {
        const nextRot = (((c.rotation || 0) + deg) % 360 + 360) % 360;
        return { ...c, rotation: nextRot };
      }
      return c;
    }),
  );
}

export function flipComponentX(id) {
  pushHistory();
  components.update((cs) =>
    cs.map((c) => (c.instanceId === id ? { ...c, flipX: !c.flipX } : c)),
  );
}

export function flipComponentY(id) {
  pushHistory();
  components.update((cs) =>
    cs.map((c) => (c.instanceId === id ? { ...c, flipY: !c.flipY } : c)),
  );
}

export function flipComponents(ids, axis = "x") {
  if (!ids?.length) return;
  pushHistory();
  const set = new Set(ids);
  components.update((cs) =>
    cs.map((c) => {
      if (set.has(c.instanceId)) {
        return axis === "x" ? { ...c, flipX: !c.flipX } : { ...c, flipY: !c.flipY };
      }
      return c;
    }),
  );
}

// ── Feature: Alignment & Distribution Tools ─────────────────
export function alignComponents(ids, mode = "left") {
  if (!ids || ids.length < 2) return;
  pushHistory();
  const set = new Set(ids);
  const cs = get(components);
  const targets = cs.filter((c) => set.has(c.instanceId));
  if (targets.length < 2) return;

  const GRID = 20;
  const snapVal = (v) => Math.round(v / GRID) * GRID;

  let refX = 0;
  let refY = 0;

  if (mode === "left") {
    refX = Math.min(...targets.map((c) => c.x));
  } else if (mode === "right") {
    refX = Math.max(...targets.map((c) => c.x + c.width));
  } else if (mode === "top") {
    refY = Math.min(...targets.map((c) => c.y));
  } else if (mode === "bottom") {
    refY = Math.max(...targets.map((c) => c.y + c.height));
  } else if (mode === "centerH") {
    const avgX = targets.reduce((acc, c) => acc + c.x + c.width / 2, 0) / targets.length;
    refX = avgX;
  } else if (mode === "centerV") {
    const avgY = targets.reduce((acc, c) => acc + c.y + c.height / 2, 0) / targets.length;
    refY = avgY;
  }

  components.update((all) =>
    all.map((c) => {
      if (!set.has(c.instanceId)) return c;
      if (mode === "left") return { ...c, x: snapVal(refX) };
      if (mode === "right") return { ...c, x: snapVal(refX - c.width) };
      if (mode === "top") return { ...c, y: snapVal(refY) };
      if (mode === "bottom") return { ...c, y: snapVal(refY - c.height) };
      if (mode === "centerH") return { ...c, x: snapVal(refX - c.width / 2) };
      if (mode === "centerV") return { ...c, y: snapVal(refY - c.height / 2) };
      return c;
    }),
  );
}

export function distributeComponents(ids, axis = "h") {
  if (!ids || ids.length < 3) return;
  pushHistory();
  const set = new Set(ids);
  const cs = get(components);
  const targets = cs.filter((c) => set.has(c.instanceId));
  if (targets.length < 3) return;

  const GRID = 20;
  const snapVal = (v) => Math.round(v / GRID) * GRID;

  if (axis === "h") {
    const sorted = [...targets].sort((a, b) => a.x - b.x);
    const minX = sorted[0].x;
    const maxX = sorted[sorted.length - 1].x;
    const step = (maxX - minX) / (sorted.length - 1);
    const map = new Map();
    sorted.forEach((c, idx) => {
      map.set(c.instanceId, snapVal(minX + idx * step));
    });
    components.update((all) =>
      all.map((c) => (map.has(c.instanceId) ? { ...c, x: map.get(c.instanceId) } : c)),
    );
  } else {
    const sorted = [...targets].sort((a, b) => a.y - b.y);
    const minY = sorted[0].y;
    const maxY = sorted[sorted.length - 1].y;
    const step = (maxY - minY) / (sorted.length - 1);
    const map = new Map();
    sorted.forEach((c, idx) => {
      map.set(c.instanceId, snapVal(minY + idx * step));
    });
    components.update((all) =>
      all.map((c) => (map.has(c.instanceId) ? { ...c, y: map.get(c.instanceId) } : c)),
    );
  }
}

export function removeComponent(id) {
  pushHistory();
  components.update((cs) => cs.filter((c) => c.instanceId !== id));
  wires.update((ws) => ws.filter((w) => w.fromComp !== id && w.toComp !== id));
  selection.set(null);
  multiSelection.update((ms) => ms.filter((s) => s.id !== id));
}

/** BUG FIX #B1: batch delete — single history step, no N pushHistory calls */
export function removeComponents(ids) {
  const set = new Set(ids);
  pushHistory();
  components.update((cs) => cs.filter((c) => !set.has(c.instanceId)));
  wires.update((ws) =>
    ws.filter((w) => !set.has(w.fromComp) && !set.has(w.toComp)),
  );
  selection.set(null);
  multiSelection.set([]);
}

export function duplicateComponent(id) {
  pushHistory();
  const comp = get(components).find((c) => c.instanceId === id);
  if (!comp) return;
  return addComponent({
    ...strip(comp),
    instanceId: undefined,
    x: comp.x + 40,
    y: comp.y + 40,
  });
}

export function duplicateComponents(ids) {
  if (!ids?.length) return [];
  pushHistory();
  const cs = get(components);
  const created = [];
  ids.forEach((id) => {
    const comp = cs.find((c) => c.instanceId === id);
    if (comp) {
      created.push(
        addComponent({
          ...strip(comp),
          instanceId: undefined,
          x: comp.x + 40,
          y: comp.y + 40,
        }),
      );
    }
  });
  return created;
}

// ── Wires ─────────────────────────────────────────────────
export function addWire(wire) {
  // BUG FIX #3: prevent duplicate wires
  const existing = get(wires);
  const dup = existing.find(
    (w) =>
      (w.fromComp === wire.fromComp &&
        w.fromPin === wire.fromPin &&
        w.toComp === wire.toComp &&
        w.toPin === wire.toPin) ||
      (w.fromComp === wire.toComp &&
        w.fromPin === wire.toPin &&
        w.toComp === wire.fromComp &&
        w.toPin === wire.fromPin),
  );
  if (dup) return { duplicate: true, existing: dup };
  const w = { ...wire, id: wire.id ?? uid("w") };
  wires.update((ws) => [...ws, w]);
  return w;
}

export function updateWire(id, patch) {
  wires.update((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
}

export function removeWire(id) {
  pushHistory();
  wires.update((ws) => ws.filter((w) => w.id !== id));
  selection.set(null);
}

// ── Labels ────────────────────────────────────────────────
export function addLabel(lbl) {
  const l = { ...lbl, id: lbl.id ?? uid("l") };
  labels.update((ls) => [...ls, l]);
  return l;
}

export function updateLabel(id, patch) {
  labels.update((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
}

export function removeLabel(id) {
  pushHistory();
  labels.update((ls) => ls.filter((l) => l.id !== id));
  selection.set(null);
}

// ── Diagram ────────────────────────────────────────────────
export function clearDiagram() {
  pushHistory();
  components.set([]);
  wires.set([]);
  labels.set([]);
  selection.set(null);
  multiSelection.set([]);
}

export function loadDiagram(data) {
  // BUG FIX #4: reset history on load, don't push to it
  undoStack.length = 0;
  redoStack.length = 0;
  components.set((data.components ?? []).map(attach));
  wires.set(data.wires ?? []);
  labels.set(data.labels ?? []);
  if (data.copperTraces) copperTraces.set(data.copperTraces);
  if (data.pcbVias || data.vias) pcbVias.set(data.pcbVias ?? data.vias ?? []);
  if (data.pcbBoardConfig) pcbBoardConfig.set(data.pcbBoardConfig);
  selection.set(null);
  multiSelection.set([]);
}

export function getDiagram() {
  return {
    version: "2.1",
    components: get(components).map(strip),
    wires: get(wires),
    labels: get(labels),
    copperTraces: get(copperTraces),
    pcbVias: get(pcbVias),
    pcbBoardConfig: get(pcbBoardConfig),
  };
}

// ── Feature #9: Auto-save to localStorage ─────────────────
const LS_KEY = "wiretool_autosave";
let _autoSaveTimer = null;
// BUG FIX #B2: prevent auto-save from firing before restore prompt
let _initialized = false;

function scheduleAutoSave() {
  if (!_initialized) return;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(getDiagram()));
    } catch (_) {}
  }, 1500);
}

export function initAutoSave() {
  _initialized = true;
}

/** Subscribe all stores to trigger auto-save on change */
components.subscribe(scheduleAutoSave);
wires.subscribe(scheduleAutoSave);
labels.subscribe(scheduleAutoSave);
copperTraces.subscribe(scheduleAutoSave);
pcbVias.subscribe(scheduleAutoSave);
pcbBoardConfig.subscribe(scheduleAutoSave);

export function getAutoSave() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function clearAutoSave() {
  localStorage.removeItem(LS_KEY);
}

// ── Feature #2: Connected wire IDs for a component ────────
export function getConnectedWireIds(instanceId) {
  return get(wires)
    .filter((w) => w.fromComp === instanceId || w.toComp === instanceId)
    .map((w) => w.id);
}

// ── Feature #5: Used pin IDs for a component ──────────────
export function getUsedPins(instanceId) {
  const result = new Set();
  get(wires).forEach((w) => {
    if (w.fromComp === instanceId) result.add(w.fromPin);
    if (w.toComp === instanceId) result.add(w.toPin);
  });
  return result;
}

// ── Feature #F1: Export Netlist ───────────────────────────
/**
 * Returns an array of net objects describing each wire connection:
 * { netId, label, from: {compLabel, compId, pinId}, to: {compLabel, compId, pinId}, color }
 */
export function getNetlist() {
  const cs = get(components);
  const ws = get(wires);
  const compMap = Object.fromEntries(cs.map((c) => [c.instanceId, c]));
  return ws.map((w, i) => {
    const fc = compMap[w.fromComp];
    const tc = compMap[w.toComp];
    return {
      netId: i + 1,
      label: w.label || `Net${i + 1}`,
      color: w.color ?? "#4f9cf9",
      from: {
        compLabel: fc?.label ?? w.fromComp,
        compId: w.fromComp,
        pinId: w.fromPin,
      },
      to: {
        compLabel: tc?.label ?? w.toComp,
        compId: w.toComp,
        pinId: w.toPin,
      },
    };
  });
}

// ── Feature #F2: Export BOM ───────────────────────────────
/**
 * Returns an array of BOM rows: { qty, id, label, theme, notes, props }
 * Identical component IDs are grouped; instances listed separately.
 */
export function getBOM() {
  const cs = get(components);
  const grouped = {};
  cs.forEach((c) => {
    const key = c.id;
    if (!grouped[key]) {
      grouped[key] = { id: c.id, theme: c.theme ?? "passive", instances: [] };
    }
    grouped[key].instances.push({
      label: c.label,
      instanceId: c.instanceId,
      notes: c.notes ?? "",
      props: c.props ?? {},
    });
  });
  return Object.values(grouped).map((g) => ({
    qty: g.instances.length,
    id: g.id,
    theme: g.theme,
    instances: g.instances,
  }));
}

// ── Feature: EasyEDA Net Highlighting & Discovered Nets ─────────
export function setHighlightedNet(netName, wireIds = []) {
  activeHighlightedNet.set(netName);
  highlightedWireIds.set(new Set(wireIds));
}

export function clearHighlightedNet() {
  activeHighlightedNet.set(null);
  highlightedWireIds.set(new Set());
}

export function getDiscoveredNets() {
  const cs = get(components);
  const ws = get(wires);
  const compMap = Object.fromEntries(cs.map((c) => [c.instanceId, c]));

  const netsMap = new Map();

  ws.forEach((w, idx) => {
    const fc = compMap[w.fromComp];
    const tc = compMap[w.toComp];

    // Net Unification: match Net Ports or shared labels
    let netName = w.label?.trim();
    if (!netName) {
      if (fc?.id === "gnd-flag" || tc?.id === "gnd-flag") netName = "GND";
      else if (fc?.id === "vcc-flag" || tc?.id === "vcc-flag") netName = "+5V";
      else if (fc?.id === "v33-flag" || tc?.id === "v33-flag") netName = "+3.3V";
      else if (fc?.id === "v12-flag" || tc?.id === "v12-flag") netName = "+12V";
      else netName = `Net${idx + 1}`;
    }

    const netColor =
      w.color ||
      (netName === "GND"
        ? "#64748b"
        : netName === "+5V"
        ? "#ef4444"
        : netName === "+3.3V"
        ? "#f59e0b"
        : netName === "+12V"
        ? "#dc2626"
        : "#4f9cf9");

    if (!netsMap.has(netName)) {
      netsMap.set(netName, {
        name: netName,
        color: netColor,
        wireIds: [],
        pins: new Set(),
        connections: [],
      });
    }

    const net = netsMap.get(netName);
    net.wireIds.push(w.id);
    if (fc) {
      net.pins.add(`${fc.label || fc.id}:${w.fromPin}`);
    }
    if (tc) {
      net.pins.add(`${tc.label || tc.id}:${w.toPin}`);
    }
    net.connections.push({
      wireId: w.id,
      from: fc?.label ?? w.fromComp,
      fromPin: w.fromPin,
      to: tc?.label ?? w.toComp,
      toPin: w.toPin,
      color: w.color || "#4f9cf9",
    });
  });

  return Array.from(netsMap.values()).map((n) => ({
    ...n,
    pinCount: n.pins.size,
    pinList: Array.from(n.pins),
  }));
}
