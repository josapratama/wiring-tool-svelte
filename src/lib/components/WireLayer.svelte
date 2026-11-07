<script>
  /**
   * WireLayer v3:
   *  - All user-drawn wires are rendered clearly with selection, styling, and hover
   *  - Wire labels placed on the longest segment (less overlap)
   *  - Label collision detection: stagger overlapping labels vertically
   *  - Junction dots at T-intersections
   *  - Full data-wire-id for context menu & selection hit-testing
   */
  import { pinPos, routeWire, routePreview, pathMidpoint, labelPos } from '$lib/engine/geometry.js'
  import { wires, components as componentsStore, selection, activeTool, removeWire, routingMode } from '$lib/store/diagram.js'

  export let components = null
  export let previewData        = null
  export let wireColor          = '#ef4444'
  export let snapTargetPin      = null
  export let highlightedWireIds = new Set()

  $: currentComponents = components || $componentsStore

  $: normalWires = (() => {
    const cs = currentComponents
    const ws = $wires
    const rm = $routingMode
    if (!cs || !ws) return []
    return ws.map((w, i) => {
      const fc = cs.find(c => c.instanceId === w.fromComp)
      const tc = cs.find(c => c.instanceId === w.toComp)
      if (!fc || !tc) return null
      const p1 = pinPos(fc)(w.fromPin)
      const p2 = pinPos(tc)(w.toPin)
      if (!p1 || !p2) return null
      const { d, pts } = routeWire(p1, p2, i, w.routingMode || rm)
      const mid  = pathMidpoint(pts)
      const lpos = labelPos(pts)
      return { d, pts, p1, p2, mid, lpos, wire: w }
    }).filter(Boolean)
  })()

  $: labeledWires = (() => {
    const labeled = normalWires.filter(r => r.wire.label)
    const placed = []
    return labeled.map(r => {
      const lx = r.lpos.x, ly = r.lpos.y
      const nearby = placed.filter(p => Math.hypot(p.x - lx, p.y - ly) < 28)
      const slot   = nearby.length
      const dy     = slot === 0 ? 0 : (slot % 2 === 1 ? 1 : -1) * Math.ceil(slot / 2) * 14
      placed.push({ x: lx, y: ly + dy })
      return { ...r, labelX: lx, labelY: ly + dy }
    })
  })()

  $: junctions = computeJunctions(normalWires)

  function computeJunctions(rw) {
    const jpts = []
    for (let i = 0; i < rw.length; i++) {
      const ri = rw[i]
      const { p2, wire } = ri
      for (let j = 0; j < rw.length; j++) {
        if (i === j) continue
        if (rw[j].wire.fromComp === wire.toComp && rw[j].wire.fromPin === wire.toPin) {
          jpts.push({ x: p2.x, y: p2.y, color: wire.color ?? '#4f9cf9' })
        }
      }
    }
    return jpts
  }

  $: previewPath = (() => {
    if (!previewData) return null
    const p1 = pinPos(previewData.fromComp)(previewData.fromPinId)
    if (!p1) return null
    return routePreview(p1, previewData.cursorX, previewData.cursorY, $routingMode)
  })()

  function handleClick(w, e) {
    if ($activeTool === 'delete') { removeWire(w.id); return }
    selection.set({ id: w.id, type: 'wire' })
    e.stopPropagation()
  }

  $: snapComp  = snapTargetPin?.comp
  $: snapPinId = snapTargetPin?.pinId
</script>

<!-- Preview wire -->
{#if previewPath}
  <path d={previewPath} stroke={wireColor} stroke-width="2.5" fill="none"
    stroke-dasharray="8,4" opacity="0.9" pointer-events="none"/>
{/if}

<!-- Snap target highlight -->
{#if snapTargetPin}
  {@const sp = pinPos(snapComp)(snapPinId)}
  {#if sp}
    <circle cx={sp.x} cy={sp.y} r="12" fill="none"
      stroke="#4ade80" stroke-width="2" stroke-dasharray="4,3" opacity="0.9"
      pointer-events="none"/>
    <circle cx={sp.x} cy={sp.y} r="6" fill="#4ade80" opacity="0.4" pointer-events="none"/>
  {/if}
{/if}

<!-- Wires -->
{#each normalWires as { d, p1, p2, wire } (wire.id)}
  {@const sel = $selection?.id === wire.id && $selection?.type === 'wire'}
  {@const highlighted = highlightedWireIds.has(wire.id)}
  {@const col = wire.color ?? '#4f9cf9'}
  <!-- svelte-ignore a11y-interactive-supports-focus -->
  <g class="wire-grp" data-wire-id={wire.id} role="button" tabindex="0"
    aria-label="wire {wire.label || wire.id}"
    on:click={(e) => handleClick(wire, e)}
    on:contextmenu={(e) => { e.preventDefault(); e.stopPropagation(); handleClick(wire, e) }}
    on:keydown={(e) => e.key === 'Delete' && removeWire(wire.id)}
  >
    <!-- Hit area -->
    <path {d} stroke="transparent" stroke-width="16" fill="none"/>
    <!-- Wire -->
    <path {d} stroke={col} stroke-width={sel ? 4 : highlighted ? 3.5 : 2.5} fill="none"
      opacity={highlighted ? 1 : sel ? 1 : 0.85}
      filter={sel ? `drop-shadow(0 0 6px ${col})` : highlighted ? `drop-shadow(0 0 5px ${col})` : undefined}/>
    <!-- Endpoints -->
    <circle cx={p1.x} cy={p1.y} r="4" fill={col} pointer-events="none"/>
    <circle cx={p2.x} cy={p2.y} r="4" fill={col} pointer-events="none"/>
  </g>
{/each}

<!-- Wire labels — rendered on top, after all wires, with collision offset -->
{#each labeledWires as { wire, labelX, labelY } (wire.id)}
  {@const col = wire.color ?? '#4f9cf9'}
  {@const bw = wire.label.length * 6.5 + 14}
  <g pointer-events="none">
    <rect x={labelX - bw/2} y={labelY - 9} width={bw} height={18} rx="4"
      fill="#0f0f1e" stroke={col} stroke-width="1.2"/>
    <text x={labelX} y={labelY + 1} dominant-baseline="central" text-anchor="middle"
      fill={col} style="font:700 11px 'Consolas',monospace">{wire.label}</text>
  </g>
{/each}

<!-- Junction dots -->
{#each junctions as j}
  <circle cx={j.x} cy={j.y} r="5" fill={j.color} pointer-events="none" opacity="0.9"/>
{/each}

<style>
  .wire-grp { cursor:pointer; }
  .wire-grp:hover path:nth-child(2) { stroke-width:4.5; }
</style>
