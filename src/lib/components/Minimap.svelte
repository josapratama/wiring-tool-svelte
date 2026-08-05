<script>
  /**
   * Minimap — Feature 7
   * Shows bird's-eye view of all components + current viewport.
   * Click to pan canvas.
   * BUG FIX: use createEventDispatcher instead of manual bubbling dispatchEvent
   * (display:contents wrapper was unreliable cross-browser)
   */
  import { createEventDispatcher } from 'svelte'
  import { components } from '$lib/store/diagram.js'
  import { pinColor }   from '$lib/data/pin-colors.js'

  export let vx     = 0
  export let vy     = 0
  export let vscale = 1
  export let cw     = 800
  export let ch     = 600

  const dispatch = createEventDispatcher()
  const W = 180, H = 120

  $: bounds = (() => {
    const cs = $components
    if (!cs.length) return { x:0, y:0, w:800, h:600 }
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity
    cs.forEach(c => {
      minX=Math.min(minX,c.x); minY=Math.min(minY,c.y)
      maxX=Math.max(maxX,c.x+c.width); maxY=Math.max(maxY,c.y+c.height)
    })
    const pad = 60
    return { x:minX-pad, y:minY-pad, w:(maxX-minX)+pad*2, h:(maxY-minY)+pad*2 }
  })()

  $: ms = Math.min(W / bounds.w, H / bounds.h)

  function wx(x) { return (x - bounds.x) * ms }
  function wy(y) { return (y - bounds.y) * ms }

  $: vpX  = wx(-vx / vscale)
  $: vpY  = wy(-vy / vscale)
  $: vpW  = (cw / vscale) * ms
  $: vpH  = (ch / vscale) * ms

  function onClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const wx2 = mx / ms + bounds.x
    const wy2 = my / ms + bounds.y
    // BUG FIX: use Svelte createEventDispatcher instead of manual DOM bubbling
    dispatch('minipan', { wx: wx2, wy: wy2 })
  }

  const THEME_BORDER = {
    mcu:'#4f9cf9', sensor:'#4ade80', power:'#f87171', display:'#a78bfa',
    passive:'#94a3b8', switch:'#facc15', comms:'#60a5fa', output:'#f97316'
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="minimap" role="img" aria-label="Diagram overview" on:click={onClick}>
  <svg width={W} height={H} xmlns="http://www.w3.org/2000/svg">
    <!-- Components as mini rectangles -->
    {#each $components as comp}
      {@const x = wx(comp.x)}
      {@const y = wy(comp.y)}
      {@const w = comp.width  * ms}
      {@const h = comp.height * ms}
      {@const bc = THEME_BORDER[comp.theme] ?? '#94a3b8'}
      <rect x={x} y={y} width={Math.max(w,3)} height={Math.max(h,3)}
        rx="1.5" fill={bc} fill-opacity="0.18" stroke={bc} stroke-width="1"/>
    {/each}

    <!-- Viewport rectangle -->
    <rect x={vpX} y={vpY} width={Math.max(vpW,4)} height={Math.max(vpH,4)}
      rx="2" fill="rgba(79,156,249,0.08)"
      stroke="#4f9cf9" stroke-width="1.5" stroke-dasharray="3,2"/>
  </svg>
  <div class="label">MAP</div>
</div>

<style>
  .minimap {
    position: absolute; bottom: 34px; left: 8px;
    width: 180px; height: 120px;
    background: rgba(13,13,26,0.88); border: 1px solid #353565;
    border-radius: 6px; overflow: hidden; cursor: crosshair;
    box-shadow: 0 2px 10px rgba(0,0,0,0.6);
  }
  .minimap svg { display: block; }
  .label {
    position: absolute; top: 3px; right: 5px;
    font: 700 9px 'Consolas', monospace; color: #353565; letter-spacing:1px;
  }
</style>
