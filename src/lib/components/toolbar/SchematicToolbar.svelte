<script>
  import { createEventDispatcher } from 'svelte'
  import WireColorPicker from './WireColorPicker.svelte'

  export let curTool = 'select'
  export let routingMode = 'orthogonal' // 'orthogonal' | 'curved' | 'direct'
  export let activeColor = '#22c55e'
  export let edaGridType = 'dots'
  export let showDrawingSheet = true
  export let showPowerFlow = false
  export let isLightMode = false

  const dispatch = createEventDispatcher()

  const TOOLS = [
    { id: 'select', label: 'Select', icon: '⬚', title: 'Pilih & Geser Komponen (V / Esc)' },
    { id: 'wire',   label: 'Wire',   icon: '⚡', title: 'Tarik Kabel / Jalur Sirkuit (W)' },
    { id: 'label',  label: 'Label',  icon: 'T',  title: 'Pasang Teks / Label Net (T)' }
  ]
</script>

<div class="toolbar cad-action-strip" class:light-toolbar={isLightMode}>
  <!-- Tool Segment -->
  <div class="tg tool-group">
    {#each TOOLS as t}
      <button
        class="tbtn"
        class:active={curTool === t.id}
        title={t.title}
        on:click={() => dispatch('set-tool', t.id)}
      >
        <span class="tbtn-icon">{t.icon}</span>
        <span class="tbtn-txt">{t.label}</span>
      </button>
    {/each}
    <div class="tg-sep"></div>

    <!-- Quick Net Ports -->
    <button class="tbtn flag-btn" on:click={() => dispatch('place-gnd')} title="Pasang Ground Port (⏚ GND) [Shift+G]">
      <span class="tbtn-icon">⏚</span>
      <span class="tbtn-txt">GND</span>
    </button>
    <button class="tbtn flag-btn" on:click={() => dispatch('place-vcc', 'vcc-flag')} title="Pasang Power Port (▲ +5V) [P]">
      <span class="tbtn-icon">▲</span>
      <span class="tbtn-txt">VCC</span>
    </button>
  </div>

  <!-- Routing Mode -->
  <div class="tg routing-tg">
    <button
      class="tbtn mode-btn"
      class:active={routingMode === 'orthogonal'}
      on:click={() => dispatch('set-routing-mode', 'orthogonal')}
      title="Siku 90° (Orthogonal)"
    >
      <span>⎶</span> <span class="tbtn-txt">Siku</span>
    </button>
    <button
      class="tbtn mode-btn"
      class:active={routingMode === 'curved'}
      on:click={() => dispatch('set-routing-mode', 'curved')}
      title="Lengkung (Smooth Bezier)"
    >
      <span>〰</span> <span class="tbtn-txt">Lengkung</span>
    </button>
    <button
      class="tbtn mode-btn"
      class:active={routingMode === 'direct'}
      on:click={() => dispatch('set-routing-mode', 'direct')}
      title="Lurus (Direct)"
    >
      <span>╱</span> <span class="tbtn-txt">Lurus</span>
    </button>
  </div>

  <!-- Wire Color Picker -->
  <WireColorPicker
    {activeColor}
    on:change={e => dispatch('change-color', e.detail)}
  />

  <!-- Transforms (Rotate & Flip) -->
  <div class="tg transform-tg">
    <button class="tbtn" on:click={() => dispatch('rotate', 90)} title="Putar Komponen 90° (R)">
      <span>↻</span> <span class="tbtn-txt">Rotate</span>
    </button>
    <button class="tbtn" on:click={() => dispatch('flip-x')} title="Flip Horizontal (X)">
      <span>⇆</span> <span class="tbtn-txt">Flip X</span>
    </button>
    <button class="tbtn" on:click={() => dispatch('flip-y')} title="Flip Vertical (Y)">
      <span>⇅</span> <span class="tbtn-txt">Flip Y</span>
    </button>
  </div>

  <!-- Canvas Toggles -->
  <div class="tg toggles-group">
    <button class="tbtn" on:click={() => dispatch('toggle-grid')} title="Ganti Mode Grid (Dots / Lines / Off) [G]">
      <span>∷</span> <span class="tbtn-txt">{edaGridType.toUpperCase()}</span>
    </button>
    <button class="tbtn" class:active={showDrawingSheet} on:click={() => dispatch('toggle-sheet')} title="Tampilkan/Sembunyikan Bingkai Drawing Sheet CAD">
      <span>📄</span> <span class="tbtn-txt">Sheet</span>
    </button>
    <button class="tbtn probe-btn" class:probe-active={showPowerFlow} on:click={() => dispatch('toggle-probe')} title="Simulasi Aliran Arus / Voltage Probe">
      <span>⚡</span> <span class="tbtn-txt">Probe</span>
    </button>
    <button class="tbtn" on:click={() => dispatch('share-link')} title="Salin Tautan Proyek (Share Link) 🔗">
      <span>🔗</span> <span class="tbtn-txt">Share</span>
    </button>
    <button class="tbtn" on:click={() => dispatch('toggle-minimap')} title="Tampilkan/Sembunyikan Minimap (M)">
      🗺
    </button>
    <button class="tbtn theme-toggle-btn" on:click={() => dispatch('toggle-theme')} title="Ganti Tema (Light / Dark)">
      <span>{isLightMode ? '☀️' : '🌙'}</span>
      <span class="tbtn-txt">{isLightMode ? 'Light' : 'Dark'}</span>
    </button>
  </div>

  <!-- History & Zoom Controls -->
  <div class="tg zoom-group">
    <button class="tbtn" on:click={() => dispatch('undo')} title="Undo (Ctrl+Z)">↩</button>
    <button class="tbtn" on:click={() => dispatch('redo')} title="Redo (Ctrl+Y)">↪</button>
    <div class="tg-sep"></div>
    <button class="tbtn" on:click={() => dispatch('fit-view')} title="Fit View (F)">Fit</button>
    <button class="tbtn" on:click={() => dispatch('zoom-in')} title="Zoom In (+)">+</button>
    <button class="tbtn" on:click={() => dispatch('zoom-out')} title="Zoom Out (−)">−</button>
  </div>
</div>

<style>
  .toolbar {
    height: 44px;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    padding: 0 8px;
    gap: 4px;
    flex-shrink: 0;
    position: relative;
    z-index: 400;
    overflow: visible;
  }
  .tg {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 0 6px;
    border-right: 1px solid #1e293b;
    flex-shrink: 0;
  }
  .tg:last-child { border-right: none; }
  .tbtn {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 5px;
    color: #94a3b8;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    min-width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.1s;
  }
  .tbtn:hover {
    background: #1e293b;
    color: #f8fafc;
    border-color: #334155;
  }
  .tbtn.active {
    background: #0284c7;
    color: #fff;
    border-color: #38bdf8;
  }

  .flag-btn {
    background: rgba(56, 189, 248, 0.08);
    border-color: rgba(56, 189, 248, 0.25);
    color: #38bdf8;
  }
  .flag-btn:hover {
    background: #0284c7;
    color: #fff;
    border-color: #0284c7;
  }

  .routing-tg { gap: 2px; }
  .mode-btn { font-size: 11px; font-weight: 600; padding: 3px 7px; }
  .tg-sep { width: 1px; height: 16px; background: #334155; margin: 0 3px; }
  .tbtn-icon { font-size: 13px; line-height: 1; }
  .tbtn-txt { font-size: 11px; font-weight: 600; }

  .probe-btn.probe-active {
    background: rgba(34, 197, 94, 0.25) !important;
    color: #4ade80 !important;
    border-color: #22c55e !important;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
  }

  /* Light Theme */
  .toolbar.light-toolbar {
    background: #ffffff;
    border-bottom-color: #e2e8f0;
  }
  .light-toolbar .tg { border-right-color: #e2e8f0; }
  .light-toolbar .tbtn { color: #64748b; }
  .light-toolbar .tbtn:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #cbd5e1;
  }
  .light-toolbar .tbtn.active {
    background: #0284c7;
    color: #fff;
    border-color: #0284c7;
  }
  .light-toolbar .flag-btn {
    background: #e0f2fe;
    border-color: #bae6fd;
    color: #0284c7;
  }

  @media (max-width: 1440px) {
    .tbtn-txt { display: none; }
    .tbtn { padding: 4px 6px; }
    .tg { padding: 0 4px; gap: 2px; }
  }
</style>
