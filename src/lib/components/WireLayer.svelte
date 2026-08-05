<script>
  /**
   * WireLayer v3:
   *  - GND pins get a ground symbol (▼) instead of a long wire
   *  - Wire labels placed on the longest segment (less overlap)
   *  - Label collision detection: stagger overlapping labels vertically
   *  - Junction dots at T-intersections
   */
  import { pinPos, routeWire, routePreview, pathMidpoint, labelPos } from '$lib/engine/geometry.js'
  import { wires, components, selection, activeTool, removeWire } from '$lib/store/diagram.js'

  export let previewData        = null
  export let wireColor          = '#ef4444'
  export let snapTargetPin      = null
  export let highlightedWireIds = new Set()

  // Power pin IDs that get a symbol in CompNode — suppress wire between two power-net pins
  // (e.g. +5V wire from buck to OLED VCC is replaced by matching power net labels)
  const POWER_NET_IDS = new Set([
    'VCC','V5','V5_L','V3V3','P3V3_1','P3V3_17','VSYS','VBUS','V30',
    '+5V','3V3','3.3V','5V',
  ])

  // Pin IDs/types considered GND
  const GND_IDS = new Set(['GND', 'GND1', 'GND2', 'VSS', 'AGND', 'DGND',
    'GND_L','GND_R','GND_2','GND_6','GND_9','GND_14','GND_20','GND_25',
    'GND_30','GND_34','GND_39','GND1','GND2','GND3','GND4','GND5','GND6','GND7','GND8'])

  function pinType(comp, pinId) {
    if (!comp) return null
    const pin = (comp.pins ?? []).find(p => p.id === pinId)
    return pin?.type ?? null
  }

  function isPowerNetWire(w) {
    // Suppress ALL wires where both ends are 'power' type pins.
    // Power net symbols on each pin already convey the connection — no wire needed.
    const fc = getComp(w.fromComp), tc = getComp(w.toComp)
    if (!fc || !tc) return false
    const ft = pinType(fc, w.fromPin)
    const tt = pinType(tc, w.toPin)
    return ft === 'power' && tt === 'power'
  }

  function isGndWire(w) {
    const fc = getComp(w.fromComp), tc = getComp(w.toComp)
    if (!fc || !tc) return false
    const fp = (fc.pins ?? []).find(p => p.id === w.fromPin)
    const tp = (tc.pins ?? []).find(p => p.id === w.toPin)
    const fIsGnd = fp ? fp.type === 'gnd' : GND_IDS.has(w.fromPin)
    const tIsGnd = tp ? tp.type === 'gnd' : GND_IDS.has(w.toPin)
    return fIsGnd && tIsGnd
  }

  function getComp(id) { return $components.find(c => c.instanceId === id) }

  $: resolvedWires = $wires.map((w, i) => {
    const fc = getComp(w.fromComp), tc = getComp(w.toComp)
    if (!fc || !tc) return null
    const p1 = pinPos(fc)(w.fromPin)
    const p2 = pinPos(tc)(w.toPin)
    if (!p1 || !p2) return null
    // Suppress GND and power-net wires — symbols on pins replace them
    if (isGndWire(w) || isPowerNetWire(w)) return { suppressed: true, wire: w }
    const { d, pts } = routeWire(p1, p2, i)
    const mid  = pathMidpoint(pts)
    const lpos = labelPos(pts)
    return { d, pts, p1, p2, mid, lpos, wire: w }
  }).filter(Boolean)

  $: normalWires = resolvedWires.filter(r => !r.suppressed)

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

<!-- GND wires — suppressed (GND symbol already shown on each component pin) -->
<!-- They remain in the store so they appear in Netlist/BOM exports -->

<!-- Normal wires -->
{#each normalWires as { d, p1, p2, wire } (wire.id)}
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
  .gnd-grp { cursor:pointer; }
</style>
