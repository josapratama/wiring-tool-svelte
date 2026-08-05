<script>
  /**
   * CompNode v2 — bug fixes:
   *  #1: scale passed as prop (no window.__wtScale hack)
   *  #2: mcuPinSpacing() from geometry (unified formula)
   */
  import { createEventDispatcher } from 'svelte'
  import { MCU_PINS }         from '$lib/data/mcu-pins.js'
  import { pinColor }         from '$lib/data/pin-colors.js'
  import { TITLE_H, PIN_R, mcuPinSpacing } from '$lib/engine/geometry.js'
  import { activeTool, selection, pushHistory,
           updateComponent, removeComponent } from '$lib/store/diagram.js'

  export let comp
  export let selected  = false
  export let inMultiSel = false
  export let scale     = 1      // BUG FIX #1: passed from Canvas
  export let usedPins  = new Set()  // Feature #5: set of connected pin IDs

  const dispatch = createEventDispatcher()

  const THEMES = {
    mcu:     { body:'#0a1628', title:'#1a3a6a', border:'#4f9cf9' },
    sensor:  { body:'#091a0e', title:'#123520', border:'#4ade80' },
    power:   { body:'#1a0808', title:'#4a1010', border:'#f87171' },
    display: { body:'#100820', title:'#2a1558', border:'#a78bfa' },
    passive: { body:'#0e0e1e', title:'#1c1c38', border:'#94a3b8' },
    switch:  { body:'#131205', title:'#353005', border:'#facc15' },
    comms:   { body:'#041320', title:'#082640', border:'#60a5fa' },
    output:  { body:'#180c04', title:'#381808', border:'#f97316' },
  }
  $: theme = THEMES[comp.theme] ?? THEMES.passive

  // BUG FIX #2: unified spacing from geometry.js
  $: mcuData   = comp.isMCU ? (MCU_PINS[comp.id] ?? null) : null
  $: leftPins  = mcuData?.left  ?? []
  $: rightPins = mcuData?.right ?? []
  $: pinCount  = Math.max(leftPins.length, rightPins.length)
  $: sp        = mcuPinSpacing(comp.height, pinCount)   // ← same as geometry.js

  function pinY(i) { return TITLE_H + 10 + i * sp }

  // ── Drag (BUG FIX #1: use prop `scale` not window hack) ──
  let dragging = false, startX = 0, startY = 0, origX = 0, origY = 0

  function onMouseDown(e) {
    if (e.button !== 0) return
    if (e.target.dataset?.pin) {
      if ($activeTool === 'wire') {
        dispatch('pinclick', { comp, pinId: e.target.dataset.pin })
        e.stopPropagation(); return
      }
    }
    if ($activeTool === 'delete') {
      removeComponent(comp.instanceId); e.stopPropagation(); return
    }
    if ($activeTool !== 'select') return
    // Shift-click = add/remove from multiSelection
    dispatch('selectnode', { comp, shift: e.shiftKey })
    dragging = true
    startX = e.clientX; startY = e.clientY
    origX  = comp.x;    origY  = comp.y
    // BUG FIX #1: notify Canvas of drag-start so origins can be snapshotted
    dispatch('dragstart', { instanceId: comp.instanceId })
    e.stopPropagation()
  }

  function onMouseMove(e) {
    if (!dragging) return
    const dx = (e.clientX - startX) / scale   // BUG FIX #1: use prop
    const dy = (e.clientY - startY) / scale
    const G = 20
    const nx = Math.round((origX + dx) / G) * G
    const ny = Math.round((origY + dy) / G) * G
    if (nx !== comp.x || ny !== comp.y) {
      // BUG FIX #1: send nx/ny (absolute) instead of dx/dy (stale delta)
      dispatch('dragged', { instanceId: comp.instanceId, nx, ny })
      updateComponent(comp.instanceId, { x: nx, y: ny })
    }
  }

  function onMouseUp() { dragging = false }

  // Feature #3: double-click on title bar → inline rename
  function onDblClick(e) {
    if ($activeTool !== 'select') return
    const titleArea = e.target.closest ? e.target.closest('.comp-node') : null
    if (titleArea) {
      dispatch('dblclick', { comp })
      e.stopPropagation()
    }
  }

  $: isHighlighted = selected || inMultiSel
  $: strokeColor   = selected ? '#4f9cf9' : inMultiSel ? '#a78bfa' : theme.border
  $: strokeWidth   = isHighlighted ? 3 : 2
</script>

<svelte:window on:mousemove={onMouseMove} on:mouseup={onMouseUp}/>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<g
  class="comp-node"
  class:highlighted={isHighlighted}
  transform="translate({comp.x},{comp.y})"
  on:mousedown={onMouseDown}
  on:dblclick={onDblClick}
  on:contextmenu={(e) => { dispatch('contextmenu', { comp, e }); e.preventDefault(); e.stopPropagation() }}
  role="button" tabindex="0" aria-label={comp.label}
>
  <!-- Shadow when selected -->
  {#if isHighlighted}
    <rect width={comp.width} height={comp.height} rx="7" ry="7"
      fill="none" stroke={strokeColor} stroke-width="8" opacity="0.15"/>
  {/if}

  <!-- Body -->
  <rect class="comp-body" width={comp.width} height={comp.height} rx="6" ry="6"
    fill={theme.body} stroke={strokeColor} stroke-width={strokeWidth}/>

  <!-- Title bar -->
  <rect x="1" y="1" width={comp.width - 2} height={TITLE_H - 4}
    rx="5" ry="5" fill={theme.title}/>

  <!-- Label -->
  <text x={comp.width/2} y={TITLE_H/2 + 1} class="comp-label"
    dominant-baseline="central" text-anchor="middle">{comp.label}</text>

  <!-- Sub-label -->
  <text x={comp.width/2} y={TITLE_H - 6} class="comp-sublabel"
    text-anchor="middle">{comp.id}</text>

  <!-- Divider -->
  <line x1="1" y1={TITLE_H} x2={comp.width - 1} y2={TITLE_H}
    stroke={theme.border} stroke-width="1" opacity="0.4"/>

  <!-- MCU pins -->
  {#if mcuData}
    {#each leftPins as pin, i}
      {@const py  = pinY(i)}
      {@const col = pinColor(pin.type)}
      {@const used = usedPins.has(pin.id)}
      <circle class="pin-dot" cx={0} cy={py} r={PIN_R}
        fill={col} stroke={used ? '#fff' : '#0d0d1a'} stroke-width={used ? 2.5 : 1.5}
        data-pin={pin.id} data-comp={comp.instanceId}>
        <title>GPIO{pin.num} — {pin.label} ({pin.type}){used ? ' ✓ connected' : ''}</title>
      </circle>
      <text x={-PIN_R - 3} y={py + 4} class="pin-num" text-anchor="end">{pin.num}</text>
      <text x={PIN_R + 10} y={py + 4} class="pin-label">{pin.label}</text>
      <circle cx={comp.width * 0.48} cy={py} r="2.5" fill={col} opacity="0.35" pointer-events="none"/>
    {/each}
    {#each rightPins as pin, i}
      {@const py  = pinY(i)}
      {@const col = pinColor(pin.type)}
      {@const used = usedPins.has(pin.id)}
      <circle class="pin-dot" cx={comp.width} cy={py} r={PIN_R}
        fill={col} stroke={used ? '#fff' : '#0d0d1a'} stroke-width={used ? 2.5 : 1.5}
        data-pin={pin.id} data-comp={comp.instanceId}>
        <title>GPIO{pin.num} — {pin.label} ({pin.type}){used ? ' ✓ connected' : ''}</title>
      </circle>
      <text x={comp.width + PIN_R + 3} y={py + 4} class="pin-num">{pin.num}</text>
      <text x={comp.width - PIN_R - 10} y={py + 4} class="pin-label" text-anchor="end">{pin.label}</text>
      <circle cx={comp.width * 0.52} cy={py} r="2.5" fill={col} opacity="0.35" pointer-events="none"/>
    {/each}
  {:else}
    {#each (comp.pins ?? []) as pin}
      {@const col = pinColor(pin.type)}
      {@const used = usedPins.has(pin.id)}
      {@const W = comp.width}
      {@const H = comp.height}
      {@const cx = pin.side==='left' ? 0 : pin.side==='right' ? W : W*pin.pos}
      {@const cy = pin.side==='top'  ? 0 : pin.side==='bottom'? H
                   : TITLE_H + (H - TITLE_H) * pin.pos}
      <circle class="pin-dot" cx={cx} cy={cy} r={PIN_R}
        fill={col} stroke={used ? '#fff' : '#0d0d1a'} stroke-width={used ? 2.5 : 1.5}
        data-pin={pin.id} data-comp={comp.instanceId}>
        <title>{pin.label} ({pin.type}){used ? ' ✓ connected' : ''}</title>
      </circle>
      {#if pin.side==='left'}
        <rect x="0" y={cy-3} width="4" height="6" fill={col} opacity="0.6" pointer-events="none"/>
        <text x={PIN_R+8} y={cy+4} class="pin-label">{pin.label}</text>
      {:else if pin.side==='right'}
        <rect x={W-4} y={cy-3} width="4" height="6" fill={col} opacity="0.6" pointer-events="none"/>
        <text x={W-PIN_R-8} y={cy+4} class="pin-label" text-anchor="end">{pin.label}</text>
      {:else if pin.side==='top'}
        <rect x={cx-3} y="0" width="6" height="4" fill={col} opacity="0.6" pointer-events="none"/>
        <text x={cx} y={PIN_R+16} class="pin-label" text-anchor="middle">{pin.label}</text>
      {:else}
        <rect x={cx-3} y={H-4} width="6" height="4" fill={col} opacity="0.6" pointer-events="none"/>
        <text x={cx} y={H-PIN_R-6} class="pin-label" text-anchor="middle">{pin.label}</text>
      {/if}
    {/each}
    {#if comp.props}
      {#each Object.entries(comp.props) as [k,v], i}
        <text x={comp.width/2} y={TITLE_H+22+i*16} class="comp-prop" text-anchor="middle">{k}: {v}</text>
      {/each}
    {/if}
  {/if}
</g>

<style>
  .comp-node { cursor:pointer; user-select:none; }
  .comp-body { transition:filter 0.1s; }
  .comp-node:hover .comp-body { filter:brightness(1.18); }
  .comp-label  { font:700 13px/1 -apple-system,sans-serif; fill:#fff; pointer-events:none; }
  .comp-sublabel { font:10px/1 'Consolas',monospace; fill:rgba(255,255,255,0.4); pointer-events:none; }
  .pin-label   { font:600 11px/1 'Consolas','Courier New',monospace; fill:#dde2f0; pointer-events:none; }
  .pin-num     { font:9px/1 'Consolas',monospace; fill:#505080; pointer-events:none; }
  .comp-prop   { font:11px/1 'Consolas',monospace; fill:#8888aa; pointer-events:none; }
  .pin-dot     { cursor:crosshair; transition:r 0.12s; }
  .pin-dot:hover { r:10; stroke:#fff !important; stroke-width:2 !important; }
</style>
