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

  // GND symbol: three horizontal bars (standard schematic symbol)
  // Always points DOWNWARD regardless of pin side.
  function gndSymbol(cx, cy, side) {
    let ox = 0, oy = 0
    if (side === 'left')   ox = -14
    if (side === 'right')  ox =  14
    if (side === 'top')    oy = -14
    if (side === 'bottom') oy =  14
    const sx = cx + ox, sy = cy + oy
    return {
      stub: `M ${cx} ${cy} L ${sx} ${sy}`,
      bar1: `M ${sx - 10} ${sy}     L ${sx + 10} ${sy}`,
      bar2: `M ${sx -  6} ${sy + 5} L ${sx +  6} ${sy + 5}`,
      bar3: `M ${sx -  2} ${sy +10} L ${sx +  2} ${sy +10}`,
    }
  }

  // Power net label: a small flag showing the net name (+5V, +12V, +3.3V)
  // pointing AWAY from the component body — standard schematic power port symbol.
  //   left  pin  →  flag points left  (arrow tip on left)
  //   right pin  →  flag points right (arrow tip on right)
  //   top   pin  →  flag points up
  //   bottom pin →  flag points down
  const POWER_NETS = {
    // pin ID → net name
    'V5':'⊕5V', 'V5_L':'⊕5V', 'VCC':'⊕5V', 'VBUS':'⊕5V', 'VSYS':'⊕5V',
    'V3V3':'⊕3V3', 'V30':'⊕3V3', 'P3V3_1':'⊕3V3', 'P3V3_17':'⊕3V3',
    'OUT+':'⊕5V',   // buck converter output
  }

  // Label keyword → net name (checked if pin ID not found)
  const POWER_LABEL_NETS = [
    { re: /3\.3V|3V3/i,  net: '⊕3V3' },
    { re: /5V/i,         net: '⊕5V'  },
    { re: /12V/i,        net: '+12V' },
    { re: /\bVCC\b/i,    net: '⊕5V'  },
  ]

  function getPowerNet(pinId, pinLabel) {
    if (POWER_NETS[pinId]) return POWER_NETS[pinId]
    for (const { re, net } of POWER_LABEL_NETS) {
      if (re.test(pinLabel)) return net
    }
    return null
  }

  function powerSymbol(cx, cy, side, netName) {
    const tw  = netName.length * 6 + 8   // text box width
    const th  = 13                        // text box height
    const tip = 7                         // arrow tip length

    let path, tx, ty, anchor

    if (side === 'left') {
      // Arrow points left, box extends further left
      const bx = cx - tip - tw
      path = `M ${cx} ${cy} L ${cx-tip} ${cy-th/2} L ${bx} ${cy-th/2} L ${bx} ${cy+th/2} L ${cx-tip} ${cy+th/2} Z`
      tx = cx - tip - tw/2; ty = cy + 4; anchor = 'middle'
    } else if (side === 'right') {
      // Arrow points right, box extends further right
      const bx = cx + tip + tw
      path = `M ${cx} ${cy} L ${cx+tip} ${cy-th/2} L ${bx} ${cy-th/2} L ${bx} ${cy+th/2} L ${cx+tip} ${cy+th/2} Z`
      tx = cx + tip + tw/2; ty = cy + 4; anchor = 'middle'
    } else if (side === 'top') {
      const by = cy - tip - th
      path = `M ${cx} ${cy} L ${cx-th/2} ${cy-tip} L ${cx-tw/2} ${cy-tip} L ${cx-tw/2} ${by} L ${cx+tw/2} ${by} L ${cx+tw/2} ${cy-tip} L ${cx+th/2} ${cy-tip} Z`
      tx = cx; ty = by + th - 2; anchor = 'middle'
    } else {
      const by = cy + tip + th
      path = `M ${cx} ${cy} L ${cx-th/2} ${cy+tip} L ${cx-tw/2} ${cy+tip} L ${cx-tw/2} ${by} L ${cx+tw/2} ${by} L ${cx+tw/2} ${cy+tip} L ${cx+th/2} ${cy+tip} Z`
      tx = cx; ty = cy + tip + th - 2; anchor = 'middle'
    }
    return { path, tx, ty, anchor }
  }
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
      {@const py   = pinY(i)}
      {@const col  = pinColor(pin.type)}
      {@const used = usedPins.has(pin.id)}
      {@const isGnd   = pin.type === 'gnd'}
      {@const netName = getPowerNet(pin.id, pin.label)}
      {@const isPwr   = !isGnd && pin.type === 'power' && netName}
      <circle class="pin-dot" cx={0} cy={py} r={PIN_R}
        fill={col} stroke={used ? '#fff' : '#0d0d1a'} stroke-width={used ? 2.5 : 1.5}
        data-pin={pin.id} data-comp={comp.instanceId}>
        <title>GPIO{pin.num} — {pin.label} ({pin.type}){used ? ' ✓ connected' : ''}</title>
      </circle>
      {#if isGnd}
        {@const gs = gndSymbol(0, py, 'left')}
        <path d={gs.stub} stroke={col} stroke-width="1.5" fill="none" pointer-events="none"/>
        <path d={gs.bar1} stroke={col} stroke-width="2"   fill="none" pointer-events="none"/>
        <path d={gs.bar2} stroke={col} stroke-width="1.5" fill="none" pointer-events="none"/>
        <path d={gs.bar3} stroke={col} stroke-width="1"   fill="none" pointer-events="none"/>
      {:else if isPwr}
        {@const ps = powerSymbol(0, py, 'left', netName)}
        <path d={ps.path} fill="#1a0808" stroke={col} stroke-width="1.2" pointer-events="none"/>
        <text x={ps.tx} y={ps.ty} text-anchor={ps.anchor} class="pwr-label" fill={col}>{netName}</text>
      {:else}
        <text x={-PIN_R - 3} y={py + 4} class="pin-num" text-anchor="end">{pin.num}</text>
        <text x={PIN_R + 10} y={py + 4} class="pin-label">{pin.label}</text>
      {/if}
      <circle cx={comp.width * 0.48} cy={py} r="2.5" fill={col} opacity="0.35" pointer-events="none"/>
    {/each}
    {#each rightPins as pin, i}
      {@const py   = pinY(i)}
      {@const col  = pinColor(pin.type)}
      {@const used = usedPins.has(pin.id)}
      {@const isGnd   = pin.type === 'gnd'}
      {@const netName = getPowerNet(pin.id, pin.label)}
      {@const isPwr   = !isGnd && pin.type === 'power' && netName}
      <circle class="pin-dot" cx={comp.width} cy={py} r={PIN_R}
        fill={col} stroke={used ? '#fff' : '#0d0d1a'} stroke-width={used ? 2.5 : 1.5}
        data-pin={pin.id} data-comp={comp.instanceId}>
        <title>GPIO{pin.num} — {pin.label} ({pin.type}){used ? ' ✓ connected' : ''}</title>
      </circle>
      {#if isGnd}
        {@const gs = gndSymbol(comp.width, py, 'right')}
        <path d={gs.stub} stroke={col} stroke-width="1.5" fill="none" pointer-events="none"/>
        <path d={gs.bar1} stroke={col} stroke-width="2"   fill="none" pointer-events="none"/>
        <path d={gs.bar2} stroke={col} stroke-width="1.5" fill="none" pointer-events="none"/>
        <path d={gs.bar3} stroke={col} stroke-width="1"   fill="none" pointer-events="none"/>
      {:else if isPwr}
        {@const ps = powerSymbol(comp.width, py, 'right', netName)}
        <path d={ps.path} fill="#1a0808" stroke={col} stroke-width="1.2" pointer-events="none"/>
        <text x={ps.tx} y={ps.ty} text-anchor={ps.anchor} class="pwr-label" fill={col}>{netName}</text>
      {:else}
        <text x={comp.width + PIN_R + 3} y={py + 4} class="pin-num">{pin.num}</text>
        <text x={comp.width - PIN_R - 10} y={py + 4} class="pin-label" text-anchor="end">{pin.label}</text>
      {/if}
      <circle cx={comp.width * 0.52} cy={py} r="2.5" fill={col} opacity="0.35" pointer-events="none"/>
    {/each}
  {:else}
    {#each (comp.pins ?? []) as pin}
      {@const col    = pinColor(pin.type)}
      {@const used   = usedPins.has(pin.id)}
      {@const isGnd  = pin.type === 'gnd'}
      {@const netName = getPowerNet(pin.id, pin.label)}
      {@const isPwr  = !isGnd && pin.type === 'power' && netName}
      {@const W = comp.width}
      {@const H = comp.height}
      {@const cx = pin.side==='left' ? 0 : pin.side==='right' ? W : W*(isFinite(pin.pos) ? pin.pos : 0.5)}
      {@const cy = pin.side==='top'  ? 0 : pin.side==='bottom'? H
                   : TITLE_H + (H - TITLE_H) * (isFinite(pin.pos) ? pin.pos : 0.5)}
      <circle class="pin-dot" cx={cx} cy={cy} r={PIN_R}
        fill={col} stroke={used ? '#fff' : '#0d0d1a'} stroke-width={used ? 2.5 : 1.5}
        data-pin={pin.id} data-comp={comp.instanceId}>
        <title>{pin.label} ({pin.type}){used ? ' ✓ connected' : ''}</title>
      </circle>
      {#if isGnd}
        {@const gs = gndSymbol(cx, cy, pin.side)}
        <path d={gs.stub} stroke={col} stroke-width="1.5" fill="none" pointer-events="none"/>
        <path d={gs.bar1} stroke={col} stroke-width="2"   fill="none" pointer-events="none"/>
        <path d={gs.bar2} stroke={col} stroke-width="1.5" fill="none" pointer-events="none"/>
        <path d={gs.bar3} stroke={col} stroke-width="1"   fill="none" pointer-events="none"/>
      {:else if isPwr}
        {@const ps = powerSymbol(cx, cy, pin.side, netName)}
        <path d={ps.path} fill="#1a0808" stroke={col} stroke-width="1.2" pointer-events="none"/>
        <text x={ps.tx} y={ps.ty} text-anchor={ps.anchor} class="pwr-label" fill={col}>{netName}</text>
      {:else if pin.side==='left'}
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
  .gnd-label   { fill:#6b7280; opacity:0.7; }
  .pwr-label   { font:700 9px/1 'Consolas',monospace; pointer-events:none; }
</style>
