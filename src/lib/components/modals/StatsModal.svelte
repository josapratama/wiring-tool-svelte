<script>
  import { createEventDispatcher } from 'svelte'

  export let show = false
  export let statsData = {
    total: 0,
    wires: 0,
    totalPins: 0,
    connectedPins: 0,
    byTheme: {}
  }

  const dispatch = createEventDispatcher()
  const THEME_COLORS = {
    mcu: '#4f9cf9',
    sensor: '#4ade80',
    power: '#f87171',
    display: '#a78bfa',
    comms: '#60a5fa',
    output: '#f97316',
    passive: '#94a3b8',
    switch: '#facc15'
  }

  function close() {
    show = false
    dispatch('close')
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay-backdrop" on:click={close}>
    <!-- svelte-ignore a11y-interactive-supports-focus -->
    <div class="overlay-box" on:click|stopPropagation role="dialog" aria-label="Diagram statistics" tabindex="-1">
      <div class="ov-head">
        <span>📊 Diagram Statistics</span>
        <button class="ov-close" on:click={close}>✕</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-val">{statsData.total}</span>
          <span class="stat-lbl">Components</span>
        </div>
        <div class="stat-card">
          <span class="stat-val">{statsData.wires}</span>
          <span class="stat-lbl">Wires</span>
        </div>
        <div class="stat-card">
          <span class="stat-val">{statsData.connectedPins}</span>
          <span class="stat-lbl">Connected Pins</span>
        </div>
        <div class="stat-card">
          <span class="stat-val" class:warn={statsData.totalPins - statsData.connectedPins > 0}>
            {statsData.totalPins - statsData.connectedPins}
          </span>
          <span class="stat-lbl">Unconnected</span>
        </div>
      </div>

      <div class="ov-sub">By Category</div>
      <div class="theme-list">
        {#each Object.entries(statsData.byTheme) as [theme, count]}
          <div class="theme-row">
            <span class="theme-dot" style="background:{THEME_COLORS[theme] ?? '#94a3b8'}"></span>
            <span class="theme-name">{theme}</span>
            <span class="theme-count">{count}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay-backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); z-index: 8000;
    backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;
  }
  .overlay-box {
    background: #0f172a; border: 1px solid #334155; border-radius: 10px;
    padding: 20px; min-width: 320px; max-width: 480px; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
  }
  .ov-head {
    font: 700 14px/1 sans-serif; color: #38bdf8; margin-bottom: 16px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .ov-close {
    background: none; border: none; color: #64748b; cursor: pointer; font-size: 15px;
  }
  .ov-close:hover { color: #f1f5f9; }
  .ov-sub {
    font: 700 10px/1 sans-serif; text-transform: uppercase; letter-spacing: 1px;
    color: #64748b; margin: 14px 0 8px;
  }
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 4px; }
  .stat-card {
    background: #030712; border: 1px solid #1f2937; border-radius: 6px;
    padding: 12px; text-align: center;
  }
  .stat-val { display: block; font: 700 24px/1 sans-serif; color: #38bdf8; margin-bottom: 4px; }
  .stat-val.warn { color: #f87171; }
  .stat-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; }
  .theme-list { display: flex; flex-direction: column; gap: 5px; }
  .theme-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .theme-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .theme-name { flex: 1; color: #94a3b8; text-transform: capitalize; }
  .theme-count { color: #38bdf8; font-weight: 700; }
</style>

