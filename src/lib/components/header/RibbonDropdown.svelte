<script>
  import { createEventDispatcher } from 'svelte'

  export let activeMenu = null // 'file' | 'edit' | 'place' | 'view' | 'design' | 'help'
  const dispatch = createEventDispatcher()

  function triggerAction(actionName, payload = null) {
    dispatch('action', { name: actionName, payload })
    activeMenu = null
  }
</script>

{#if activeMenu}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="ribbon-dropdown" on:click|stopPropagation>
    {#if activeMenu === 'file'}
      <button class="rdd-item" on:click={() => triggerAction('new-diagram')}>
        <span class="rdd-icon">📄</span> Proyek Baru <span class="rdd-key">Ctrl+N</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('open-json')}>
        <span class="rdd-icon">📂</span> Buka File JSON <span class="rdd-key">Ctrl+O</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('save-json')}>
        <span class="rdd-icon">💾</span> Simpan File JSON <span class="rdd-key">Ctrl+S</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('open-snapshots')}>
        <span class="rdd-icon">📜</span> Riwayat Versi & Snapshot
      </button>
      <button class="rdd-item" on:click={() => triggerAction('export-doc-pack')}>
        <span class="rdd-icon">📑</span> Dokumen Fabrikasi Lengkap (PDF)
      </button>
      <div class="rdd-divider"></div>
      <button class="rdd-item" on:click={() => triggerAction('export-png')}>
        <span class="rdd-icon">🖼</span> Ekspor Gambar (PNG)
      </button>
      <button class="rdd-item" on:click={() => triggerAction('export-svg')}>
        <span class="rdd-icon">📐</span> Ekspor Vektor (SVG)
      </button>
      <button class="rdd-item" on:click={() => triggerAction('export-netlist')}>
        <span class="rdd-icon">🔌</span> Ekspor Netlist (CSV)
      </button>
      <button class="rdd-item" on:click={() => triggerAction('open-bom')}>
        <span class="rdd-icon">📋</span> Maker BOM & Biaya Fabrikasi
      </button>
      <button class="rdd-item" on:click={() => triggerAction('open-wokwi-modal')}>
        <span class="rdd-icon">🚀</span> Wokwi Simulation JSON
      </button>
      <div class="rdd-divider"></div>
      <button class="rdd-item rdd-danger" on:click={() => triggerAction('clear-diagram')}>
        <span class="rdd-icon">🗑️</span> Kosongkan Seluruh Diagram
      </button>

    {:else if activeMenu === 'edit'}
      <button class="rdd-item" on:click={() => triggerAction('undo')}>
        <span class="rdd-icon">↩</span> Undo <span class="rdd-key">Ctrl+Z</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('redo')}>
        <span class="rdd-icon">↪</span> Redo <span class="rdd-key">Ctrl+Y</span>
      </button>
      <div class="rdd-divider"></div>
      <button class="rdd-item" on:click={() => triggerAction('select-all')}>
        <span class="rdd-icon">⬚</span> Select All <span class="rdd-key">Ctrl+A</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('rotate', 90)}>
        <span class="rdd-icon">↻</span> Rotate 90° <span class="rdd-key">R</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('flip-x')}>
        <span class="rdd-icon">⇆</span> Flip Horizontal <span class="rdd-key">X</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('flip-y')}>
        <span class="rdd-icon">⇅</span> Flip Vertical <span class="rdd-key">Y</span>
      </button>
      <div class="rdd-divider"></div>
      <button class="rdd-item rdd-danger" on:click={() => triggerAction('delete')}>
        <span class="rdd-icon">🗑️</span> Delete <span class="rdd-key">Del</span>
      </button>

    {:else if activeMenu === 'place'}
      <button class="rdd-item" on:click={() => triggerAction('tool-wire')}>
        <span class="rdd-icon">⚡</span> Wire <span class="rdd-key">W</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('place-gnd')}>
        <span class="rdd-icon">⏚</span> Net Port GND <span class="rdd-key">Shift+G</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('place-vcc', 'vcc-flag')}>
        <span class="rdd-icon">▲</span> Net Port VCC (+5V) <span class="rdd-key">P</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('place-vcc', 'v33-flag')}>
        <span class="rdd-icon">▲</span> Net Port +3.3V
      </button>
      <button class="rdd-item" on:click={() => triggerAction('place-vcc', 'v12-flag')}>
        <span class="rdd-icon">▲</span> Net Port +12V
      </button>
      <div class="rdd-divider"></div>
      <button class="rdd-item" on:click={() => triggerAction('tool-label')}>
        <span class="rdd-icon">T</span> Text / Net Label <span class="rdd-key">T</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('open-quick-palette')}>
        <span class="rdd-icon">🔍</span> Cari & Tambah Komponen <span class="rdd-key">Ctrl+K</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('open-custom-comp')}>
        <span class="rdd-icon">🛠️</span> Buat Komponen Kustom (EELib)
      </button>

    {:else if activeMenu === 'view'}
      <button class="rdd-item" on:click={() => triggerAction('toggle-left-sidebar')}>
        <span class="rdd-icon">📦</span> Toggle EELib Sidebar
      </button>
      <button class="rdd-item" on:click={() => triggerAction('toggle-right-sidebar')}>
        <span class="rdd-icon">⚙️</span> Toggle Inspector Panel
      </button>
      <div class="rdd-divider"></div>
      <button class="rdd-item" on:click={() => triggerAction('fit-view')}>
        <span class="rdd-icon">🔍</span> Fit View to Board <span class="rdd-key">F</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('toggle-grid')}>
        <span class="rdd-icon">∷</span> Ganti Grid (Dots/Lines/Off) <span class="rdd-key">G</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('toggle-minimap')}>
        <span class="rdd-icon">🗺</span> Toggle Minimap Radar <span class="rdd-key">M</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('toggle-theme')}>
        <span class="rdd-icon">🌓</span> Ganti Tema (Light/Dark)
      </button>

    {:else if activeMenu === 'design'}
      <button class="rdd-item" on:click={() => triggerAction('open-erc')}>
        <span class="rdd-icon">⚡</span> Electrical Rules Check (ERC)
      </button>
      <button class="rdd-item" on:click={() => triggerAction('open-codegen')}>
        <span class="rdd-icon">💻</span> Auto Pin-Code & Firmware Studio
      </button>
      <button class="rdd-item" on:click={() => triggerAction('open-simulator')}>
        <span class="rdd-icon">⚡</span> Virtual MCU Simulator Lab
      </button>
      <button class="rdd-item" on:click={() => triggerAction('open-3d-view')}>
        <span class="rdd-icon">🪐</span> 3D PCB Visualizer WebGL
      </button>
      <button class="rdd-item" on:click={() => triggerAction('open-serial-monitor')}>
        <span class="rdd-icon">📟</span> Virtual Serial Terminal & Analyzer
      </button>

    {:else if activeMenu === 'help'}
      <button class="rdd-item" on:click={() => triggerAction('open-help')}>
        <span class="rdd-icon">❓</span> Daftar Pintasan Keyboard <span class="rdd-key">?</span>
      </button>
      <button class="rdd-item" on:click={() => triggerAction('open-stats')}>
        <span class="rdd-icon">📊</span> Statistik Komponen & Diagram
      </button>
    {/if}
  </div>
{/if}

<style>
  .ribbon-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 235px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 7px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.06);
    padding: 5px;
    z-index: 99999 !important;
    display: flex;
    flex-direction: column;
    gap: 2px;
    animation: pop-down 0.12s ease-out;
  }
  @keyframes pop-down {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .rdd-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: #f1f5f9;
    font-size: 11.5px;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
    width: 100%;
  }
  .rdd-item:hover {
    background: #1e293b;
    color: #38bdf8;
  }
  .rdd-icon {
    font-size: 13px;
    width: 18px;
    text-align: center;
    flex-shrink: 0;
  }
  .rdd-key {
    margin-left: auto;
    font-size: 10px;
    color: #64748b;
    font-family: monospace;
  }
  .rdd-divider {
    height: 1px;
    background: #1e293b;
    margin: 3px 0;
  }
  .rdd-danger:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }
</style>

