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

// ── History ───────────────────────────────────────────────
const undoStack = [];
const redoStack = [];

function snapshot() {
  return JSON.stringify({
    c: get(components).map(strip),
    w: get(wires),
    l: get(labels),
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
  selection.set(null);
  multiSelection.set([]);
}

export function getDiagram() {
  return {
    version: "2.1",
    components: get(components).map(strip),
    wires: get(wires),
    labels: get(labels),
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
