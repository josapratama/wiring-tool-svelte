<script>
  /**
   * Canvas v2 — all bugs fixed, all features implemented:
   * Bug fixes: #1 scale prop, #2 unified formula, #3 dup wire,
   *            #4 history reset, #5 path midpoint, #6 alt+pan
   * Features: multi-select, duplicate, auto-label, snap-to-pin,
   *           minimap, context menu, arrow nudge
   */
  import { onMount } from 'svelte'
  import CompNode    from './CompNode.svelte'
  import WireLayer   from './WireLayer.svelte'
  import Minimap     from './Minimap.svelte'
  import ContextMenu from './ContextMenu.svelte'

  import {
    components, wires, labels, selection, multiSelection, activeTool,
    addComponent, addWire, addLabel, removeLabel, removeWire, removeComponent,
    updateLabel, updateComponent, updateWire, duplicateComponent, pushHistory,
    rotateComponent, rotateComponents,
    getConnectedWireIds, getUsedPins
  } from '$lib/store/diagram.js'

  import { findCompDef }                     from '$lib/data/components-db.js'
  import { pinPos, snap, nearestPin, allPinPositions } from '$lib/engine/geometry.js'
  import { findCompatiblePins }              from '$lib/engine/erc.js'

  // ── Public API exposed to parent via bind:api ─────────
  // Parent does: <Canvas bind:api={canvasRef}/>
  // then calls:  canvasRef?.fitView()
  export let api = {}
  export let isLightMode = false

  $: Object.assign(api, {
    fitView, zoomIn, zoomOut, zoomToSelection,
    toggleGrid, toggleMinimap,
    handleDrop, setWireColor, cancelWire,
    selectWire, selectComponent, getViewCenter
  })

  function getViewCenter() {
    return {
      x: Math.round((canvasW / 2 - vx) / vscale),
      y: Math.round((canvasH / 2 - vy) / vscale)
    }
  }

  // ── Viewport ──────────────────────────────────────────
  let vx = 0, vy = 0, vscale = 1
  let zoomPct = 100
  let svgEl, containerEl

  // Safe viewport setters — prevent NaN from propagating into SVG attributes
  function setViewport(x, y, s) {
    vx     = isFinite(x) ? x : 0
    vy     = isFinite(y) ? y : 0
    vscale = isFinite(s) && s > 0 ? s : 1
    zoomPct = Math.round(vscale * 100)
  }

  // ── BUG FIX #4: canvasW/H reactive via ResizeObserver ──
  let canvasW = 800, canvasH = 600
  let _ro = null
  function attachResizeObserver(el) {
    if (!el) return
    if (_ro) _ro.disconnect()
    _ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvasW = entry.contentRect.width
        canvasH = entry.contentRect.height
      }
    })
    _ro.observe(el)
    canvasW = el.offsetWidth
    canvasH = el.offsetHeight
  }
  $: if (containerEl) attachResizeObserver(containerEl)

  // ── Wire drawing ──────────────────────────────────────
  let wireStart    = null   // { comp, pinId }
  let wireColor    = '#ef4444'
  let cursorWorld  = { x: 0, y: 0 }
  let snapTarget   = null   // { comp, pinId, pos } — Feature 4

  $: previewData = wireStart
    ? { fromComp: wireStart.comp, fromPinId: wireStart.pinId,
        cursorX: snapTarget ? snapTarget.pos.x : cursorWorld.x,
        cursorY: snapTarget ? snapTarget.pos.y : cursorWorld.y }
    : null

  $: compatiblePins = wireStart ? findCompatiblePins(wireStart.comp, wireStart.pinId, $components) : null
  $: activeWireSourceKey = wireStart ? `${wireStart.comp.instanceId}::${wireStart.pinId}` : null

  // Auto-label map — Feature 3
  const AUTO_LABELS = {
    SDA:'SDA', SCL:'SCL', MOSI:'MOSI', MISO:'MISO', SCK:'SCK',
    CS:'CS', TX:'TX', RX:'RX', TX0:'TX', RX0:'RX',
    VCC:'VCC', GND:'GND', '+':'VCC', '-':'GND',
    G1:'Batt', G2:'TPS', G3:'Temp', G4:'MIL', G5:'STR',
    G6:'IGN', G7:'INJ', G14:'Buzzer', G16:'K-RX', G17:'K-TX',
    G35:'MOSI', G36:'SCK', G37:'MISO', G38:'CS',
    DATA:'DATA', SIG:'Signal', IN:'IN', OUT:'OUT',
    TRIG:'TRIG', ECHO:'ECHO',
  }

  function autoLabel(fromPin, toPin) {
    return AUTO_LABELS[fromPin] ?? AUTO_LABELS[toPin] ?? fromPin ?? ''
  }

  // ── Pan (Bug Fix #6: early return prevents selection) ──
  let panning = false, panStart = null

  function onMouseDown(e) {
    // BUG FIX #6: handle pan FIRST, return before tool logic
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panning = true
      panStart = { x: e.clientX - vx, y: e.clientY - vy }
      // Attach move/up to window so panning works even when mouse leaves canvas
      window.addEventListener('mousemove', onWindowMouseMove)
      window.addEventListener('mouseup',   onWindowMouseUp)
      e.preventDefault()
      e.stopPropagation()
      return  // ← critical: prevents selection/label logic
    }

    if (e.button === 2) return  // right-click handled by contextmenu

    if (e.button === 0) {
      const onBg = e.target === svgEl || e.target.id === 'grid-bg' || e.target === containerEl
      if (!onBg) return

      if ($activeTool === 'label') {
        const w = s2w(e.clientX, e.clientY)
        pushHistory()
        const lbl = addLabel({ text:'Label', x:snap(w.x), y:snap(w.y), fontSize:14, color:'#facc15' })
        selection.set({ id:lbl.id, type:'label' })
        return
      }

      if ($activeTool === 'select') {
        // Start rubber-band selection
        const w = s2w(e.clientX, e.clientY)
        selBox = { sx: w.x, sy: w.y, ex: w.x, ey: w.y, active: true }
        if (!e.shiftKey) { selection.set(null); multiSelection.set([]) }
        return
      }

      if ($activeTool === 'wire') {
        wireStart = null  // cancel if clicking empty space
      }
    }
  }

  // ── Rubber-band selection box (Feature 1) ─────────────
  let selBox = null   // { sx,sy,ex,ey,active }

  $: selRect = selBox ? {
    x: Math.min(selBox.sx, selBox.ex),
    y: Math.min(selBox.sy, selBox.ey),
    w: Math.abs(selBox.ex - selBox.sx),
    h: Math.abs(selBox.ey - selBox.sy),
  } : null

  function finishRubberBand() {
    if (!selBox || !selBox.active) { selBox = null; return }
    const r = selRect
    if (r.w > 4 && r.h > 4) {
      const hit = $components.filter(c =>
        c.x < r.x + r.w && c.x + c.width  > r.x &&
        c.y < r.y + r.h && c.y + c.height > r.y
      )
      multiSelection.set(hit.map(c => ({ id: c.instanceId, type:'component' })))
      if (hit.length === 1) selection.set({ id:hit[0].instanceId, type:'component' })
    }
    selBox = null
  }

  // ── Mouse move ────────────────────────────────────────
  let statusX = 0, statusY = 0

  function onMouseMove(e) {
    if (panning) return  // panning handled by onWindowMouseMove

    const w = s2w(e.clientX, e.clientY)
    cursorWorld = w
    statusX = Math.round(w.x); statusY = Math.round(w.y)

    // Rubber-band update
    if (selBox?.active) {
      selBox = { ...selBox, ex: w.x, ey: w.y }
      return
    }

    // Feature 4: snap-to-pin while drawing wire
    if (wireStart) {
      const near = nearestPin($components, w.x, w.y, 32,
        wireStart.comp.instanceId, wireStart.pinId)
      snapTarget = near ?? null
    } else {
      snapTarget = null
    }
  }

  function onMouseUp(e) {
    if (panning) return  // handled by onWindowMouseUp
    if (selBox?.active) finishRubberBand()
  }

  // Window-level mouse move — only active during pan to track mouse outside canvas
  function onWindowMouseMove(e) {
    if (!panning || !panStart) return
    const nx = e.clientX - panStart.x
    const ny = e.clientY - panStart.y
    if (isFinite(nx) && isFinite(ny)) { vx = nx; vy = ny }
  }

  // BUG FIX #3: reset selBox if mouse leaves the window
  function onWindowMouseUp() {
    if (panning) {
      panning = false
      panStart = null
      window.removeEventListener('mousemove', onWindowMouseMove)
      window.removeEventListener('mouseup',   onWindowMouseUp)
    }
    if (selBox?.active) { selBox = null }
  }

  // ── Wheel zoom ────────────────────────────────────────
  function onWheel(e) {
    e.preventDefault()
    const rect = containerEl.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const f  = e.deltaY < 0 ? 1.1 : 0.909
    const ns = Math.min(4, Math.max(0.12, vscale * f))
    if (!isFinite(ns) || ns <= 0) return
    setViewport(
      mx - (mx - vx) * (ns / vscale),
      my - (my - vy) * (ns / vscale),
      ns
    )
  }

  // ── Coordinate helpers ────────────────────────────────
  function s2w(sx, sy) {
    const r = containerEl?.getBoundingClientRect() ?? { left:0, top:0 }
    return { x:(sx - r.left - vx)/vscale, y:(sy - r.top - vy)/vscale }
  }

  // ── Zoom ──────────────────────────────────────────────
  function zoomIn()  { zoomBy(1.2)   }
  function zoomOut() { zoomBy(0.833) }
  export function fitView() {
    const cs = $components
    if (!cs.length) { setViewport(120, 60, 1); return }
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity
    cs.forEach(c => {
      minX=Math.min(minX,c.x); minY=Math.min(minY,c.y)
      maxX=Math.max(maxX,c.x+c.width); maxY=Math.max(maxY,c.y+c.height)
    })
    if (!containerEl) return
    const cw = containerEl.offsetWidth  || canvasW
    const ch = containerEl.offsetHeight || canvasH
    if (!cw || !ch) return   // not rendered yet
    const pad=80
    const sw = maxX - minX + 1
    const sh = maxY - minY + 1
    if (sw <= 0 || sh <= 0) return
    const s = Math.min(2, Math.max(0.15, Math.min((cw-pad*2)/sw, (ch-pad*2)/sh)))
    setViewport(
      (cw - (maxX + minX) * s) / 2,
      (ch - (maxY + minY) * s) / 2,
      s
    )
  }

  function zoomBy(f) {
    if (!containerEl) return
    const cw = containerEl.offsetWidth  || canvasW
    const ch = containerEl.offsetHeight || canvasH
    if (!cw || !ch) return
    const ns = Math.min(4, Math.max(0.12, vscale * f))
    if (!isFinite(ns) || ns <= 0) return
    setViewport(
      cw/2 - (cw/2 - vx) * (ns / vscale),
      ch/2 - (ch/2 - vy) * (ns / vscale),
      ns
    )
  }

  // ── Grid ──────────────────────────────────────────────
  let showGrid = true
  function toggleGrid() { showGrid = !showGrid }

  // ── Minimap ───────────────────────────────────────────
  let showMinimap = true
  function toggleMinimap() { showMinimap = !showMinimap }

  function onMinipan(e) {
    const { wx, wy } = e.detail
    if (!isFinite(wx) || !isFinite(wy)) return
    vx = canvasW/2 - wx * vscale
    vy = canvasH/2 - wy * vscale
  }

  // ── Drop from sidebar ─────────────────────────────────
  function handleDrop(compId, clientX, clientY) {
    const def = findCompDef(compId); if (!def) return
    let wx2, wy2
    if (clientX != null) {
      const w = s2w(clientX, clientY)
      wx2 = snap(w.x - (def.width ?? 120)/2)
      wy2 = snap(w.y - (def.height > 0 ? def.height/2 : 60))
    } else {
      wx2 = snap(120 + Math.random()*80)
      wy2 = snap(100 + Math.random()*80)
    }
    pushHistory()
    addComponent({ ...def, x:wx2, y:wy2 })
  }

  function setWireColor(c) { wireColor = c }

  // ── Pin click → wire (Feature 3: auto-label) ──────────
  function onPinClick({ detail: { comp, pinId } }) {
    if ($activeTool !== 'wire') return
    if (!wireStart) {
      wireStart = { comp, pinId }
    } else {
      const sameComp = wireStart.comp.instanceId === comp.instanceId
      const samePin  = wireStart.pinId === pinId
      if (sameComp && samePin) { wireStart = null; return }

      pushHistory()
      const label = autoLabel(wireStart.pinId, pinId)   // Feature 3
      const result = addWire({
        fromComp: wireStart.comp.instanceId, fromPin: wireStart.pinId,
        toComp:   comp.instanceId,           toPin:   pinId,
        color: wireColor, label
      })

      if (result?.duplicate) {
        flashStatus('⚠ Wire already exists between these pins', '#f59e0b')
      }
      wireStart = null; snapTarget = null
    }
  }

  // ── Multi-select node click (Feature 1) ───────────────
  function onSelectNode({ detail: { comp, shift } }) {
    if (shift) {
      const ms  = $multiSelection
      const idx = ms.findIndex(s => s.id === comp.instanceId)
      if (idx >= 0) {
        multiSelection.set(ms.filter((_,i) => i !== idx))
      } else {
        multiSelection.set([...ms, { id:comp.instanceId, type:'component' }])
      }
    } else {
      selection.set({ id:comp.instanceId, type:'component' })
      multiSelection.set([])
    }
  }

  // ── Multi-drag (Feature 1) ────────────────────────────
  // BUG FIX #1: track origins at drag-start to avoid double-move
  let multiDragOrigins = {}

  function onNodeDragStart({ detail: { instanceId } }) {
    // Snapshot world positions of all selected nodes at drag-start
    const ms = $multiSelection
    if (ms.length <= 1) return
    multiDragOrigins = {}
    ms.forEach(s => {
      const c = $components.find(c => c.instanceId === s.id)
      if (c) multiDragOrigins[s.id] = { x: c.x, y: c.y }
    })
  }

  function onNodeDragged({ detail: { instanceId, nx, ny } }) {
    // instanceId was already moved by CompNode; move the others by same world delta
    const ms = $multiSelection
    if (ms.length <= 1) return
    if (!ms.find(s => s.id === instanceId)) return
    const origin = multiDragOrigins[instanceId]
    if (!origin) return
    // Compute the actual delta from origin
    const dx = nx - origin.x
    const dy = ny - origin.y
    ms.forEach(s => {
      if (s.id === instanceId) return  // already moved by CompNode itself
      const orig = multiDragOrigins[s.id]
      if (!orig) return
      updateComponent(s.id, { x: snap(orig.x + dx), y: snap(orig.y + dy) })
    })
  }

  // ── Context menu (Feature 8) ──────────────────────────
  let ctxMenu = null   // { x, y, type, target }

  function onCompContextMenu({ detail: { comp, e } }) {
    ctxMenu = { x: e.clientX, y: e.clientY, type:'component', target: comp }
  }

  function onCanvasContextMenu(e) {
    e.preventDefault()
    // Check if right-clicking a wire
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const wireEl = el?.closest('[data-wire-id]') ?? el?.closest('.wire-grp')
    if (wireEl) {
      const wireId = wireEl.dataset.wireId
      const wire   = $wires.find(w => w.id === wireId)
      if (wire) { ctxMenu = { x:e.clientX, y:e.clientY, type:'wire', target:wire }; return }
    }
    ctxMenu = { x: e.clientX, y: e.clientY, type:'canvas', target: null }
  }

  function onCtxAction(e) {
    const action = e.detail
    const saved  = ctxMenu          // save before clearing
    ctxMenu = null

    if (!saved) return
    const t = saved.target

    if (action === 'rotate' && t?.instanceId) {
      rotateComponent(t.instanceId, 90)
    }
    if (action === 'delete') {
      if (t?.instanceId) removeComponent(t.instanceId)
      else if (t?.id)    removeWire(t.id)
    }
    if (action === 'duplicate' && t?.instanceId) {
      duplicateComponent(t.instanceId)
    }
    if (action === 'rename' && t?.instanceId) {
      const newLabel = prompt('Rename component:', t.label)
      if (newLabel !== null) updateComponent(t.instanceId, { label: newLabel })
    }
    if (action === 'editLabel' && t?.id) {
      const newLabel = prompt('Wire label:', t.label ?? '')
      if (newLabel !== null) updateWire(t.id, { label: newLabel })
    }
    if (action === 'fitView')    fitView()
    if (action === 'toggleGrid') toggleGrid()
    if (action === 'addLabel')   activeTool.set('label')
    if (action === 'clearSel') {
      selection.set(null); multiSelection.set([])
    }
    if (action === 'connections' && t?.instanceId) {
      const conns = $wires.filter(w => w.fromComp===t.instanceId||w.toComp===t.instanceId)
      alert(`${conns.length} connection(s):\n` +
        conns.map(w=>`  ${w.fromPin} → ${w.toPin} (${w.label||'no label'})`).join('\n'))
    }
    // BUG FIX #2: handle wireColor action
    if (action === 'wireColor' && t?.id) {
      // Select the wire first so PropertiesPanel shows the color picker
      selection.set({ id: t.id, type: 'wire' })
    }
  }

  // ── Cancel wire ───────────────────────────────────────
  function cancelWire() { wireStart = null; snapTarget = null }

  // ── Net Highlighting & Connection Glow ──────────────────
  $: highlightedWireIds = (() => {
    const ws = $wires
    const ids = new Set()
    const selWireId = $selection?.type === 'wire' ? $selection.id : null
    const selCompId = $selection?.type === 'component' ? $selection.id : null

    if (selWireId) {
      ids.add(selWireId)
      const selWire = ws.find(w => w.id === selWireId)
      if (selWire) {
        ws.forEach(w => {
          if ((w.fromComp === selWire.fromComp && w.fromPin === selWire.fromPin) ||
              (w.toComp === selWire.fromComp && w.toPin === selWire.fromPin) ||
              (w.fromComp === selWire.toComp && w.fromPin === selWire.toPin) ||
              (w.toComp === selWire.toComp && w.toPin === selWire.toPin)) {
            ids.add(w.id)
          }
        })
      }
    } else if (selCompId) {
      ws.forEach(w => {
        if (w.fromComp === selCompId || w.toComp === selCompId) {
          ids.add(w.id)
        }
      })
    }

    if (wireStart) {
      ws.forEach(w => {
        if ((w.fromComp === wireStart.comp.instanceId && w.fromPin === wireStart.pinId) ||
            (w.toComp === wireStart.comp.instanceId && w.toPin === wireStart.pinId)) {
          ids.add(w.id)
        }
      })
    }
    return ids
  })()

  export function selectWire(id) {
    selection.set({ id, type: 'wire' })
    const w = $wires.find(wire => wire.id === id)
    if (w) {
      const fc = $components.find(c => c.instanceId === w.fromComp)
      if (fc && containerEl) {
        const cw = containerEl.offsetWidth || canvasW
        const ch = containerEl.offsetHeight || canvasH
        setViewport(cw / 2 - fc.x * vscale, ch / 2 - fc.y * vscale, vscale)
      }
    }
  }

  export function selectComponent(id) {
    selection.set({ id, type: 'component' })
    const c = $components.find(comp => comp.instanceId === id)
    if (c && containerEl) {
      const cw = containerEl.offsetWidth || canvasW
      const ch = containerEl.offsetHeight || canvasH
      setViewport(cw / 2 - (c.x + c.width / 2) * vscale, ch / 2 - (c.y + c.height / 2) * vscale, vscale)
    }
  }

  // ── Feature #5: Used pins per component ───────────────
  // Passed to CompNode as a Set of used pinIds
  function usedPinsFor(instanceId) { return getUsedPins(instanceId) }

  // ── Feature #3: Inline rename ─────────────────────────
  // BUG FIX: store instanceId + component ref so position recomputes
  // reactively with vx/vy/vscale instead of computing once at click time
  let inlineEditId = null  // instanceId

  $: inlineEdit = (() => {
    if (!inlineEditId) return null
    const comp = $components.find(c => c.instanceId === inlineEditId)
    if (!comp) { inlineEditId = null; return null }
    const cpx = comp.x * vscale + vx
    const cpy = comp.y * vscale + vy
    return {
      instanceId: comp.instanceId,
      x: cpx + (comp.width * vscale) / 2,
      y: cpy + 20 * vscale,
      w: comp.width * vscale,
      label: comp.label
    }
  })()

  // Separate mutable label for the input (can't bind to $: derived directly)
  let inlineLabel = ''
  // BUG FIX: sync inlineLabel when a new inline edit session opens
  let _prevInlineEditId = null
  $: if (inlineEditId && inlineEditId !== _prevInlineEditId) {
    const comp = $components.find(c => c.instanceId === inlineEditId)
    if (comp) inlineLabel = comp.label
    _prevInlineEditId = inlineEditId
  }
  $: if (!inlineEditId) _prevInlineEditId = null

  function onNodeDblClick({ detail: { comp } }) {
    inlineLabel = comp.label
    inlineEditId = comp.instanceId
  }

  function commitInlineEdit() {
    if (!inlineEditId) return
    const val = inlineLabel?.trim()
    if (val) updateComponent(inlineEditId, { label: val })
    inlineEditId = null
  }

  // ── Feature #10: Zoom to selection (Shift+F) ──────────
  function zoomToSelection() {
    const ids = new Set()
    if ($selection?.type === 'component') ids.add($selection.id)
    $multiSelection.forEach(s => { if (s.type === 'component') ids.add(s.id) })
    const cs = $components.filter(c => ids.has(c.instanceId))
    if (!cs.length) { fitView(); return }
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity
    cs.forEach(c => {
      minX=Math.min(minX,c.x); minY=Math.min(minY,c.y)
      maxX=Math.max(maxX,c.x+c.width); maxY=Math.max(maxY,c.y+c.height)
    })
    if (!containerEl) return
    const cw = containerEl.offsetWidth  || canvasW
    const ch = containerEl.offsetHeight || canvasH
    if (!cw || !ch) return
    const pad=80
    const sw = maxX - minX + 1, sh = maxY - minY + 1
    if (sw <= 0 || sh <= 0) return
    const s = Math.min(2, Math.max(0.15, Math.min((cw-pad*2)/sw, (ch-pad*2)/sh)))
    setViewport(
      (cw - (maxX + minX) * s) / 2,
      (ch - (maxY + minY) * s) / 2,
      s
    )
  }

  // ── SVG drag/drop ─────────────────────────────────────
  function onDragOver(e) { e.preventDefault() }
  function onDrop(e) {
    e.preventDefault()
    const id = e.dataTransfer.getData('comp-id')
    if (id) handleDrop(id, e.clientX, e.clientY)
  }

  // ── Status ────────────────────────────────────────────
  $: compCount  = $components.length
  $: wireCount  = $wires.length
  $: multiCount = $multiSelection.length
  $: selInfo    = multiCount > 1
    ? `${multiCount} selected`
    : wireStart
    ? 'Click a pin to connect — Esc to cancel'
    : ''

  let statusFlash = ''
  function flashStatus(msg, color = '#4ade80') {
    statusFlash = msg
    statusFlashColor = color
    setTimeout(() => { if (statusFlash === msg) statusFlash = '' }, 3000)
  }
  let statusFlashColor = '#4ade80'

  // ── Keyboard (canvas-level) ───────────────────────────
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') return
    if (e.key === 'Escape') { wireStart = null; snapTarget = null; selection.set(null); multiSelection.set([]) }

    // Feature 9: arrow nudge
    const NUDGE = e.shiftKey ? 5 : 20
    const dirs  = { ArrowLeft:[-NUDGE,0], ArrowRight:[NUDGE,0], ArrowUp:[0,-NUDGE], ArrowDown:[0,NUDGE] }
    if (dirs[e.key]) {
      e.preventDefault()
      const [dx, dy] = dirs[e.key]
      // BUG FIX: build a unified set to avoid double-moving a component
      // that is both in $selection and $multiSelection
      const toMove = new Set()
      if ($selection?.type === 'component') toMove.add($selection.id)
      $multiSelection.forEach(s => { if (s.type === 'component') toMove.add(s.id) })
      toMove.forEach(id => {
        const c = $components.find(c => c.instanceId === id)
        if (c) updateComponent(c.instanceId, { x: c.x+dx, y: c.y+dy })
      })
    }
  }

  onMount(() => {
    // bind:this is guaranteed set before onMount in Svelte 5 legacy mode.
    // We still guard with a check just in case.
    if (!containerEl) {
      console.error('[Canvas] containerEl not ready in onMount')
      return
    }

    containerEl.addEventListener('wheel',       onWheel,            { passive: false })
    containerEl.addEventListener('mousedown',   onMouseDown,        { passive: false })
    containerEl.addEventListener('mousemove',   onMouseMove,        { passive: true  })
    containerEl.addEventListener('mouseup',     onMouseUp,          { passive: true  })
    containerEl.addEventListener('contextmenu', onCanvasContextMenu)
    containerEl.addEventListener('dragover',    onDragOver)
    containerEl.addEventListener('drop',        onDrop)

    setTimeout(fitView, 150)

    // Svelte calls the returned function on component destroy
    return () => {
      containerEl.removeEventListener('wheel',       onWheel)
      containerEl.removeEventListener('mousedown',   onMouseDown)
      containerEl.removeEventListener('mousemove',   onMouseMove)
      containerEl.removeEventListener('mouseup',     onMouseUp)
      containerEl.removeEventListener('contextmenu', onCanvasContextMenu)
      containerEl.removeEventListener('dragover',    onDragOver)
      containerEl.removeEventListener('drop',        onDrop)
    }
  })
  // ── Touch Gestures (Mobile/Tablet Pan & Pinch-Zoom) ─────────
  let touchPanStart = null
  let touchStartDist = 0
  let touchStartScale = 1
  let touchStartCenter = { x: 0, y: 0 }

  function onTouchStart(e) {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      touchPanStart = { x: t.clientX - vx, y: t.clientY - vy }
    } else if (e.touches.length === 2) {
      touchPanStart = null
      const t1 = e.touches[0], t2 = e.touches[1]
      touchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      touchStartScale = vscale
      const rect = containerEl?.getBoundingClientRect() ?? { left: 0, top: 0 }
      touchStartCenter = {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top
      }
    }
  }

  function onTouchMove(e) {
    if (e.touches.length === 1 && touchPanStart) {
      const t = e.touches[0]
      const nx = t.clientX - touchPanStart.x
      const ny = t.clientY - touchPanStart.y
      if (isFinite(nx) && isFinite(ny)) {
        vx = nx; vy = ny
      }
    } else if (e.touches.length === 2 && touchStartDist > 0) {
      e.preventDefault()
      const t1 = e.touches[0], t2 = e.touches[1]
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const factor = dist / touchStartDist
      const ns = Math.min(4, Math.max(0.12, touchStartScale * factor))
      if (isFinite(ns) && ns > 0) {
        setViewport(
          touchStartCenter.x - (touchStartCenter.x - vx) * (ns / vscale),
          touchStartCenter.y - (touchStartCenter.y - vy) * (ns / vscale),
          ns
        )
      }
    }
  }

  function onTouchEnd() {
    touchPanStart = null
    touchStartDist = 0
  }

  // ── Safe viewport values for SVG (guard against NaN) ─────────
  $: svgVx     = isFinite(vx)     ? vx     : 0
  $: svgVy     = isFinite(vy)     ? vy     : 0
  $: svgVscale = isFinite(vscale) && vscale > 0 ? vscale : 1
</script>

<!-- Svelte 5: onkeydown / onmouseup (no colon) -->
<svelte:window onkeydown={onKeyDown} onmouseup={onWindowMouseUp}/>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="canvas-wrap"
  bind:this={containerEl}
  role="application"
  aria-label="Wiring diagram canvas"
  on:touchstart={onTouchStart}
  on:touchmove={onTouchMove}
  on:touchend={onTouchEnd}
>
  <svg
    bind:this={svgEl}
    width="100%" height="100%"
    xmlns="http://www.w3.org/2000/svg"
    class:cur-cross={$activeTool==='wire'}
    class:cur-text={$activeTool==='label'}
    class:cur-del={$activeTool==='delete'}
  >
    <defs>
      <pattern id="grid-sm" width="20" height="20" patternUnits="userSpaceOnUse"
        patternTransform="translate({svgVx},{svgVy}) scale({svgVscale})">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1c1c38" stroke-width="0.5"/>
      </pattern>
      <pattern id="grid-lg" width="100" height="100" patternUnits="userSpaceOnUse"
        patternTransform="translate({svgVx},{svgVy}) scale({svgVscale})">
        <rect width="100" height="100" fill="url(#grid-sm)"/>
        <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#28284a" stroke-width="1"/>
      </pattern>
      <pattern id="grid-sm-light" width="20" height="20" patternUnits="userSpaceOnUse"
        patternTransform="translate({svgVx},{svgVy}) scale({svgVscale})">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.5"/>
      </pattern>
      <pattern id="grid-light" width="100" height="100" patternUnits="userSpaceOnUse"
        patternTransform="translate({svgVx},{svgVy}) scale({svgVscale})">
        <rect width="100" height="100" fill="url(#grid-sm-light)"/>
        <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#cbd5e1" stroke-width="1"/>
      </pattern>
      <filter id="sel-glow">
        <feGaussianBlur stdDeviation="4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <!-- Background -->
    {#if showGrid}
      <rect id="grid-bg" width="100%" height="100%" fill={isLightMode ? 'url(#grid-light)' : 'url(#grid-lg)'}/>
    {:else}
      <rect id="grid-bg" width="100%" height="100%" fill={isLightMode ? '#ffffff' : '#0d0d1a'}/>
    {/if}

    <g transform="translate({svgVx},{svgVy}) scale({svgVscale})">
      <!-- Wires layer -->
      <WireLayer {previewData} {wireColor} snapTargetPin={snapTarget} {highlightedWireIds}/>

      <!-- Labels -->
      {#each $labels as lbl (lbl.id)}
        {@const sel = $selection?.id === lbl.id}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <text
          x={lbl.x} y={lbl.y}
          font-size={lbl.fontSize ?? 14}
          fill={lbl.color ?? '#facc15'}
          font-weight="600"
          font-family="-apple-system, sans-serif"
          class="lbl-node"
          class:lbl-sel={sel}
          on:mousedown={(e) => {
            if ($activeTool==='delete') { removeLabel(lbl.id); return }
            selection.set({ id:lbl.id, type:'label' })
            e.stopPropagation()
            // Feature: drag label directly on canvas
            if ($activeTool === 'select') {
              const startX = e.clientX, startY = e.clientY
              const origX = lbl.x, origY = lbl.y
              let moved = false
              function onLblMove(me) {
                const dx = (me.clientX - startX) / vscale
                const dy = (me.clientY - startY) / vscale
                if (!moved && Math.hypot(dx, dy) > 3) { pushHistory(); moved = true }
                if (moved) updateLabel(lbl.id, { x: snap(origX + dx), y: snap(origY + dy) })
              }
              function onLblUp() {
                window.removeEventListener('mousemove', onLblMove)
                window.removeEventListener('mouseup', onLblUp)
              }
              window.addEventListener('mousemove', onLblMove)
              window.addEventListener('mouseup', onLblUp)
            }
          }}
          role="button" tabindex="0"
        >{lbl.text}</text>
      {/each}

      <!-- Components -->
      {#each $components as comp (comp.instanceId)}
        <CompNode
          {comp}
          scale={svgVscale}
          {isLightMode}
          {compatiblePins}
          {activeWireSourceKey}
          selected={$selection?.id === comp.instanceId && $selection?.type === 'component'}
          inMultiSel={$multiSelection.some(s => s.id === comp.instanceId)}
          usedPins={usedPinsFor(comp.instanceId)}
          on:pinclick={onPinClick}
          on:selectnode={onSelectNode}
          on:dragstart={onNodeDragStart}
          on:dragged={onNodeDragged}
          on:dblclick={onNodeDblClick}
          on:contextmenu={onCompContextMenu}
        />
      {/each}

      <!-- Feature 1: rubber-band selection box -->
      {#if selRect && selBox?.active && selRect.w > 2}
        <rect
          x={selRect.x} y={selRect.y}
          width={selRect.w} height={selRect.h}
          fill="rgba(79,156,249,0.06)"
          stroke="#4f9cf9" stroke-width={1/svgVscale}
          stroke-dasharray="{4/svgVscale},{3/svgVscale}"
          pointer-events="none"
        />
      {/if}
    </g>
  </svg>

  <!-- Status bar -->
  <div class="status-bar">
    <span class="s-coords">X: {statusX},  Y: {statusY}</span>
    <span>Components: {compCount} | Wires: {wireCount}</span>
    {#if selInfo}
      <span class="s-hint">{selInfo}</span>
    {/if}
    {#if statusFlash}
      <span class="s-flash" style="color:{statusFlashColor}">{statusFlash}</span>
    {/if}
  </div>

  <!-- Zoom badge -->
  <div class="zoom-badge">{zoomPct}%</div>

  <!-- Feature 7: Minimap -->
  {#if showMinimap}
    <Minimap {vx} {vy} {vscale} cw={canvasW} ch={canvasH} on:minipan={onMinipan}/>
  {/if}

  <!-- Feature 8: Context menu -->
  {#if ctxMenu}
    <ContextMenu
      x={ctxMenu.x} y={ctxMenu.y} type={ctxMenu.type}
      on:action={onCtxAction}
      on:close={() => ctxMenu = null}
    />
  {/if}

  <!-- Feature #3: Inline rename overlay -->
  {#if inlineEdit}
    <!-- svelte-ignore a11y-autofocus -->
    <input
      class="inline-edit"
      style="left:{inlineEdit.x}px; top:{inlineEdit.y}px; width:{inlineEdit.w}px; transform:translateX(-50%)"
      bind:value={inlineLabel}
      autofocus
      on:blur={commitInlineEdit}
      on:keydown={(e) => {
        if (e.key === 'Enter') commitInlineEdit()
        if (e.key === 'Escape') { inlineEditId = null }
        e.stopPropagation()
      }}
    />
  {/if}
</div>

<style>
  .canvas-wrap {
    flex:1; position:relative; overflow:hidden; background:#0d0d1a;
    display:flex; flex-direction:column; cursor:default;
  }
  svg { flex:1; display:block; width:100%; height:100%; }
  .cur-cross { cursor:crosshair; }
  .cur-text  { cursor:text; }
  .cur-del   { cursor:not-allowed; }

  .lbl-node { cursor:move; user-select:none; }
  .lbl-node:hover { opacity:0.8; }
  .lbl-sel  { filter:drop-shadow(0 0 5px #facc15); }

  .status-bar {
    height:26px; background:#13132a; border-top:1px solid #252545;
    display:flex; align-items:center; padding:0 12px; gap:18px;
    font-size:11px; color:#505078; flex-shrink:0; overflow:hidden;
  }
  .s-coords { min-width:120px; }
  .s-hint   { color:#4ade80; font-weight:600; margin-left:auto; }
  .s-flash  { font-weight:600; margin-left:auto; }

  .zoom-badge {
    position:absolute; bottom:34px; right:10px;
    background:rgba(13,13,26,0.88); border:1px solid #353565;
    border-radius:4px; padding:2px 8px; font-size:11px; color:#9090b8;
    pointer-events:none;
  }

  .inline-edit {
    position:absolute; z-index:500;
    background:#1a1a40; border:2px solid #4f9cf9; border-radius:5px;
    color:#fff; font:700 13px -apple-system,sans-serif;
    padding:4px 8px; outline:none; text-align:center;
  }
</style>
