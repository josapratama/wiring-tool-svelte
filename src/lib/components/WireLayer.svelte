<script>
  /**
   * WireLayer v2 — bug fixes + features:
   *  #5: label at true path midpoint (pathMidpoint)
   *  #6: wire-index fan-out to reduce overlap
   *  Feature 5: junction dots at T-intersections
   */
  import { pinPos, routeWire, routePreview, pathMidpoint } from '$lib/engine/geometry.js'
  import { wires, components, selection, activeTool, removeWire } from '$lib/store/diagram.js'

  export let previewData   = null
  export let wireColor     = '#ef4444'
  export let snapTargetPin = null   // { comp, pinId } — highlighted snap target
  export let highlightedWireIds = new Set()  // Feature #2: connection highlight

  function getComp(id) { return $components.find(c => c.instanceId === id) }

  $: resolvedWires = $wires.map((w, i) => {
    const fc = getComp(w.fromComp), tc = getComp(w.toComp)
    if (!fc || !tc) return null
    const p1 = pinPos(fc)(w.fromPin)
    const p2 = pinPos(tc)(w.toPin)
    if (!p1 || !p2) return null
    const { d, pts } = routeWire(p1, p2, i)       // FIX #6: pass index
    const mid = pathMidpoint(pts)                   // FIX #5: true midpoint
    return { d, pts, p1, p2, mid, wire: w }
  }).filter(Boolean)

  // Feature 5: collect junction points (wire endpoint on another wire)
  $: junctions = computeJunctions(resolvedWires)

  function computeJunctions(rw) {
    const jpts = []
    for (let i = 0; i < rw.length; i++) {
      const { p2, wire } = rw[i]
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
    return routePreview(p1, previewData.cursorX, previewData.cursorY)
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

<!-- All wires -->
{#each resolvedWires as { d, p1, p2, mid, wire } (wire.id)}
  {@const sel = $selection?.id === wire.id && $selection?.type === 'wire'}
  {@const highlighted = highlightedWireIds.has(wire.id)}
  {@const col = wire.color ?? '#4f9cf9'}
  <!-- svelte-ignore a11y-interactive-supports-focus -->
  <g class="wire-grp" role="button" tabindex="0"
    aria-label="wire {wire.label || wire.id}"
    on:click={(e) => handleClick(wire, e)}
    on:contextmenu={(e) => { e.preventDefault(); e.stopPropagation(); handleClick(wire, e) }}
    on:keydown={(e) => e.key === 'Delete' && removeWire(wire.id)}
  >
    <!-- Hit area -->
    <path {d} stroke="transparent" stroke-width="16" fill="none"/>
    <!-- Wire — thicker + glow when part of highlighted connection -->
    <path {d} stroke={col} stroke-width={sel ? 4 : highlighted ? 3.5 : 2.5} fill="none"
      opacity={highlighted ? 1 : sel ? 1 : 0.85}
      filter={sel ? `drop-shadow(0 0 6px ${col})` : highlighted ? `drop-shadow(0 0 5px ${col})` : undefined}/>
    <!-- Endpoints -->
    <circle cx={p1.x} cy={p1.y} r="4" fill={col} pointer-events="none"/>
    <circle cx={p2.x} cy={p2.y} r="4" fill={col} pointer-events="none"/>

    <!-- BUG FIX #5: label at true path midpoint -->
    {#if wire.label}
      {@const bw = wire.label.length * 6.5 + 14}
      <rect x={mid.x - bw/2} y={mid.y - 9} width={bw} height={18} rx="4"
        fill="#0f0f1e" stroke={col} stroke-width="1.2"/>
      <text x={mid.x} y={mid.y + 1} dominant-baseline="central" text-anchor="middle"
        fill={col} pointer-events="none"
        style="font:700 11px 'Consolas',monospace">{wire.label}</text>
    {/if}
  </g>
{/each}

<!-- Feature 5: junction dots -->
{#each junctions as j}
  <circle cx={j.x} cy={j.y} r="5" fill={j.color} pointer-events="none" opacity="0.9"/>
{/each}

<style>
  .wire-grp { cursor:pointer; }
  .wire-grp:hover path:nth-child(2) { stroke-width:4.5; }
</style>
