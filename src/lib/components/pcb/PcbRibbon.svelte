<script>
  import { createEventDispatcher } from 'svelte'

  export let activeTool = 'select' // 'select' | 'route' | 'via'
  export let activeLayer = 'top' // 'top' | 'bottom'
  export let activeTraceWidth = 0.40
  export let gridStepMm = 2.54
  export let isAutoRouting = false
  export let showInspector = true

  const dispatch = createEventDispatcher()
</script>

<header class="pcb-ribbon">
  <div class="pcb-ribbon-left">
    <!-- Back to Schematic button -->
    <button on:click={() => dispatch('back')} class="pcb-btn pcb-btn-back" title="Kembali ke Mode Skematik Kabel">
      <span class="pcb-icon">←</span>
      <span class="pcb-btn-text">Skematik</span>
    </button>

    <div class="pcb-sep"></div>

    <!-- Studio Badge -->
    <div class="pcb-title-wrap">
      <span class="pcb-title-icon">🟩</span>
      <span class="pcb-title-text">PCB Studio</span>
    </div>
  </div>

  <!-- Active Tool Group -->
  <div class="pcb-ribbon-center">
    <div class="pcb-tool-group">
      <button
        class="pcb-tool-btn"
        class:pcb-tool-active={activeTool === 'select'}
        on:click={() => dispatch('tool-change', 'select')}
        title="Select & Geser Komponen (Shortcut: V)"
      >
        <span>↖</span>
        <span class="pcb-tool-lbl">Select</span>
      </button>

      <button
        class="pcb-tool-btn pcb-tool-route"
        class:pcb-tool-active={activeTool === 'route'}
        on:click={() => dispatch('tool-change', 'route')}
        title="Tarik Jalur Tembaga / Route Trace 45° (Shortcut: X)"
      >
        <span>⚡</span>
        <span class="pcb-tool-lbl">Route</span>
      </button>

      <button
        class="pcb-tool-btn"
        class:pcb-tool-active={activeTool === 'via'}
        on:click={() => dispatch('tool-change', 'via')}
        title="Pasang Plated Through-Hole Via (Top-ke-Bottom)"
      >
        <span>◎</span>
        <span class="pcb-tool-lbl">Via</span>
      </button>

      <button
        class="pcb-tool-btn"
        class:pcb-tool-active={activeTool === 'ruler'}
        on:click={() => dispatch('tool-change', 'ruler')}
        title="Alat Ukur Jarak CAD / Dimension Ruler mm (Shortcut: U)"
      >
        <span>📏</span>
        <span class="pcb-tool-lbl">Ukur</span>
      </button>

      <button
        class="pcb-tool-btn"
        class:pcb-tool-active={activeTool === 'text'}
        on:click={() => dispatch('tool-change', 'text')}
        title="Pasang Teks / Label Silkscreen di PCB (Top/Bottom)"
      >
        <span>🔤</span>
        <span class="pcb-tool-lbl">Teks Silk</span>
      </button>
    </div>

    <div class="pcb-sep"></div>

    <!-- Layer Toggle (Top F.Cu vs Bottom B.Cu) -->
    <div class="pcb-layer-group">
      <button
        class="pcb-layer-btn pcb-layer-top"
        class:pcb-layer-active={activeLayer === 'top'}
        on:click={() => dispatch('layer-change', 'top')}
        title="Top Copper Layer (F.Cu - Merah)"
      >
        <span class="pcb-layer-dot pcb-dot-top"></span>
        <span>Top</span>
      </button>

      <button
        class="pcb-layer-btn pcb-layer-bottom"
        class:pcb-layer-active={activeLayer === 'bottom'}
        on:click={() => dispatch('layer-change', 'bottom')}
        title="Bottom Copper Layer (B.Cu - Biru)"
      >
        <span class="pcb-layer-dot pcb-dot-bottom"></span>
        <span>Bottom</span>
      </button>
    </div>

    <!-- Trace Width Selector -->
    <div class="pcb-select-wrap" title="Ketebalan Jalur Tembaga">
      <span class="pcb-select-label">Lebar:</span>
      <select
        bind:value={activeTraceWidth}
        on:change={() => dispatch('trace-width-change', activeTraceWidth)}
        class="pcb-select"
      >
        <option value={0.25}>0.25 mm</option>
        <option value={0.40}>0.40 mm</option>
        <option value={0.80}>0.80 mm</option>
        <option value={1.20}>1.20 mm</option>
      </select>
    </div>

    <!-- Grid Snap Selector -->
    <div class="pcb-select-wrap" title="Ukuran Grid Snapping CAD">
      <span class="pcb-select-label">Grid:</span>
      <select
        bind:value={gridStepMm}
        on:change={() => dispatch('grid-step-change', gridStepMm)}
        class="pcb-select"
      >
        <option value={2.54}>2.54 mm</option>
        <option value={1.27}>1.27 mm</option>
        <option value={0.635}>0.64 mm</option>
      </select>
    </div>

    <!-- Auto-Router Button -->
    <button
      on:click={() => dispatch('autoroute')}
      class="pcb-btn pcb-btn-autoroute"
      class:is-loading={isAutoRouting}
      disabled={isAutoRouting}
      title="Otomatis Hubungkan Semua Netlist yang Belum Terhubung (A* 2-Layer Router)"
    >
      <span>{isAutoRouting ? '⏳' : '⚡'}</span>
      <span class="pcb-btn-text">{isAutoRouting ? 'Routing...' : 'Auto-Route'}</span>
    </button>
  </div>

  <!-- Right Actions -->
  <div class="pcb-ribbon-right">
    <!-- 3D View Button -->
    <button on:click={() => dispatch('open-3d')} class="pcb-btn pcb-btn-3d" title="Buka Studio 3D PCB Visualizer WebGL">
      <span>🪐</span>
      <span class="pcb-btn-text">3D View</span>
    </button>

    <!-- Rotate button -->
    <button on:click={() => dispatch('rotate-selected', 90)} class="pcb-btn" title="Putar Komponen Terpilih 90° (Shortcut: R)">
      <span>↻</span>
      <span class="pcb-btn-text">Putar</span>
    </button>

    <!-- Toggle Inspector -->
    <button
      on:click={() => dispatch('toggle-inspector')}
      class="pcb-btn pcb-btn-inspector"
      class:pcb-btn-active={showInspector}
      title="Buka / Tutup Panel Inspektur PCB"
    >
      <span>⚙</span>
      <span class="pcb-btn-text">Inspector</span>
    </button>

    <!-- Export Button -->
    <button on:click={() => dispatch('open-export')} class="pcb-btn pcb-btn-export" title="Ekspor Gerber, EasyEDA JSON, dan Masker Cetak">
      <span>📦</span>
      <span class="pcb-btn-text">Ekspor</span>
    </button>
  </div>
</header>

<style>
  .pcb-ribbon {
    height: 44px;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    gap: 8px;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    z-index: 50;
    position: relative;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .pcb-ribbon::-webkit-scrollbar { display: none; }

  .pcb-ribbon-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .pcb-ribbon-center {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .pcb-ribbon-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .pcb-sep {
    width: 1px;
    height: 20px;
    background: #1e293b;
  }
  .pcb-title-wrap {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 700;
    font-size: 12px;
    color: #e2e8f0;
  }

  .pcb-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 6px;
    border: 1px solid #334155;
    background: #1e293b;
    color: #cbd5e1;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
    user-select: none;
    white-space: nowrap;
  }
  .pcb-btn:hover {
    background: #334155;
    color: #ffffff;
    border-color: #475569;
  }
  .pcb-btn-back {
    background: #1e293b;
    color: #94a3b8;
  }
  .pcb-btn-3d {
    background: #172554;
    border-color: #1d4ed8;
    color: #93c5fd;
  }
  .pcb-btn-3d:hover {
    background: #1d4ed8;
    color: #ffffff;
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
  }
  .pcb-btn-inspector.pcb-btn-active {
    background: #0284c7;
    color: #ffffff;
    border-color: #38bdf8;
  }
  .pcb-btn-export {
    background: #065f46;
    border-color: #059669;
    color: #6ee7b7;
    font-weight: 700;
  }
  .pcb-btn-export:hover {
    background: #059669;
    color: #ffffff;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
  }
  .pcb-btn-autoroute {
    background: #2e1065;
    border-color: #7c3aed;
    color: #c4b5fd;
  }
  .pcb-btn-autoroute:hover {
    background: #6d28d9;
    color: #ffffff;
    box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
  }

  /* Tool Group */
  .pcb-tool-group {
    display: inline-flex;
    background: #0b0f19;
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
  }
  .pcb-tool-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: #94a3b8;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.1s;
  }
  .pcb-tool-btn:hover { color: #f1f5f9; background: #1e293b; }
  .pcb-tool-btn.pcb-tool-active {
    background: #0284c7;
    color: #ffffff;
    border-color: #38bdf8;
  }

  /* Layer Switcher */
  .pcb-layer-group {
    display: inline-flex;
    background: #0b0f19;
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
  }
  .pcb-layer-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.1s;
  }
  .pcb-layer-btn:hover { background: #1e293b; color: #ffffff; }
  .pcb-layer-btn.pcb-layer-active.pcb-layer-top {
    background: #b91c1c;
    border-color: #ef4444;
    color: #ffffff;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.35);
  }
  .pcb-layer-btn.pcb-layer-active.pcb-layer-bottom {
    background: #1d4ed8;
    border-color: #3b82f6;
    color: #ffffff;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.35);
  }
  .pcb-layer-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .pcb-dot-top { background: #ef4444; }
  .pcb-dot-bottom { background: #3b82f6; }

  /* Select Inputs */
  .pcb-select-wrap {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #0b0f19;
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 2px 6px;
  }
  .pcb-select-label {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 600;
  }
  .pcb-select {
    background: transparent;
    border: none;
    color: #f1f5f9;
    font-size: 11px;
    font-weight: 600;
    outline: none;
    cursor: pointer;
  }
  .pcb-select option {
    background: #0f172a;
    color: #f1f5f9;
  }

  @media (max-width: 1440px) {
    .pcb-ribbon { padding: 0 8px; gap: 5px; }
    .pcb-ribbon-center { gap: 4px; }
    .pcb-ribbon-right { gap: 4px; }
    .pcb-tool-lbl { display: none; }
    .pcb-title-text { display: none; }
    .pcb-select-label { display: none; }
    .pcb-btn { padding: 4px 8px; font-size: 11.5px; }
  }
  @media (max-width: 768px) {
    .pcb-btn-text, .pcb-title-text, .pcb-select-label { display: none; }
  }
</style>

