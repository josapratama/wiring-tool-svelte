<script>
  import { createEventDispatcher } from 'svelte'
  import RibbonDropdown from './RibbonDropdown.svelte'
  import ExportDropdown from './ExportDropdown.svelte'

  export let projectName = 'CircuitCraft_Diagram'
  export let activeEditorView = 'wiring' // 'wiring' | 'pcb'
  export let renderMode = 'realistic' // 'realistic' | 'symbol'
  export let ercResult = { errors: [], warnings: [], totalCount: 0 }
  export let showLeftSidebar = true
  export let showRightSidebar = true
  export let isLightMode = false
  export let flashMsg = ''

  const dispatch = createEventDispatcher()

  let activeRibbon = null
  let showExportMenu = false

  function toggleRibbon(menu, event) {
    if (event) event.stopPropagation()
    activeRibbon = activeRibbon === menu ? null : menu
    showExportMenu = false
  }

  function toggleExport(event) {
    if (event) event.stopPropagation()
    showExportMenu = !showExportMenu
    activeRibbon = null
  }

  export function closeAllDropdowns() {
    activeRibbon = null
    showExportMenu = false
  }

  function handleMenuAction(e) {
    dispatch('menu-action', e.detail)
    activeRibbon = null
  }

  function handleExportAction(e) {
    dispatch('export-action', e.detail)
    showExportMenu = false
  }
</script>

<svelte:window on:click={closeAllDropdowns} />

<header class="cad-header" class:light-cad-header={isLightMode}>
  <!-- Left Side: Brand Logo & Title & CAD Switcher -->
  <div class="cad-ribbon-left">
    <!-- Toggle Left Sidebar (EELib & Design Manager) -->
    <button
      class="nav-toggle-btn"
      class:btn-active={showLeftSidebar}
      on:click={() => dispatch('toggle-left-sidebar')}
      title="Buka/Tutup EELib & Design Manager"
    >
      📦 <span class="nav-toggle-lbl">EELib</span>
    </button>

    <div class="logo">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="7" height="14" rx="2" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5"/>
        <rect x="15" y="5" width="7" height="14" rx="2" fill="#f97316" stroke="#ea580c" stroke-width="1.5"/>
        <path d="M9 8.5h6M9 12h6M9 15.5h6" stroke="#4ade80" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="logo-text">EasyEDA</span>
    </div>
    <span class="cad-tag">{activeEditorView === 'pcb' ? 'PCB' : 'SCH'}</span>

    <!-- Project Title Input -->
    <div class="proj-name-wrap">
      <input
        class="proj-name"
        bind:value={projectName}
        title="Klik untuk mengubah nama proyek"
        aria-label="Nama Proyek"
      />
    </div>

    <!-- CAD Mode Switcher -->
    <div class="cad-mode-switch">
      <button
        class="cad-mode-btn"
        class:cad-mode-active={activeEditorView === 'wiring'}
        on:click={() => dispatch('switch-view', 'wiring')}
        title="Beralih ke Kanvas Skematik Kabel"
      >
        <span>📍 Skematik</span>
      </button>

      <button
        class="cad-mode-btn"
        class:cad-mode-active={activeEditorView === 'pcb'}
        on:click={() => dispatch('switch-view', 'pcb')}
        title="Beralih ke Studio Desain PCB Layout & Fabrikasi"
      >
        <span>🟩 PCB Layout</span>
      </button>
    </div>

    <!-- Realistic Wokwi vs Schematic Symbol Toggle (in Schematic mode) -->
    {#if activeEditorView === 'wiring'}
      <button
        class="cad-render-btn"
        class:cad-render-realistic={renderMode === 'realistic'}
        on:click={() => dispatch('toggle-render-mode')}
        title="Ubah tampilan komponen fisik realistis Wokwi atau simbol skematik"
      >
        <span>{renderMode === 'realistic' ? '🎨 Fisik' : '📐 Simbol'}</span>
      </button>
    {/if}

    <!-- Ribbon Tabs Menu -->
    <nav class="ribbon-menus">
      {#each ['file', 'edit', 'place', 'view', 'design', 'help'] as menuKey}
        <div class="menu-item-wrap">
          <button
            class="menu-tab-btn"
            class:menu-open={activeRibbon === menuKey}
            on:click={(e) => toggleRibbon(menuKey, e)}
          >
            {menuKey.charAt(0).toUpperCase() + menuKey.slice(1)} ▾
          </button>
          {#if activeRibbon === menuKey}
            <RibbonDropdown activeMenu={menuKey} on:action={handleMenuAction} />
          {/if}
        </div>
      {/each}
    </nav>
  </div>

  <!-- Right Side: Search, Health Badge, Code, Sim, Export, Inspector Toggle -->
  <div class="cad-ribbon-right">
    <!-- Quick Component Search -->
    <button class="btn btn-search" on:click={() => dispatch('open-quick-palette')} title="Cari & Pasang Komponen (Ctrl+K)">
      🔍 <span class="shortcut-tag">Ctrl+K</span>
    </button>

    {#if activeEditorView === 'wiring'}
      <!-- Electrical Rules Check Status -->
      <button class="btn btn-erc" on:click={() => dispatch('open-erc')} title="Electrical Rules Check (ERC)">
        🛡️ <span class="btn-text">ERC</span>
        <span
          class="badge-erc"
          class:badge-erc-err={ercResult.errors.length > 0}
          class:badge-erc-warn={ercResult.warnings.length > 0 && !ercResult.errors.length}
          class:badge-erc-ok={ercResult.totalCount === 0}
        >
          {ercResult.totalCount === 0 ? '✓ OK' : ercResult.totalCount}
        </span>
      </button>

      <!-- Code generator button -->
      <button class="btn btn-code" on:click={() => dispatch('open-codegen')} title="Generate C++ / Python pin headers">
        💻 <span class="btn-text">Code</span>
      </button>

      <!-- Simulator Lab button -->
      <button class="btn btn-sim" on:click={() => dispatch('open-simulator')} title="Buka Virtual MCU & Circuit Simulator Lab">
        ⚡ <span class="btn-text">Sim</span>
      </button>

      <!-- Virtual Serial Monitor button -->
      <button class="btn btn-serial" on:click={() => dispatch('open-serial')} title="Buka Virtual Serial Terminal & 4-CH Logic Analyzer">
        📟 <span class="btn-text">Serial</span>
      </button>
    {:else}
      <!-- PCB DRC Status button -->
      <button class="btn btn-erc" on:click={() => dispatch('open-pcb-inspector')} title="Buka DRC & Pengecekan Desain PCB">
        🛡️ <span class="btn-text">DRC</span>
        <span class="badge-erc badge-erc-ok">✓ CAD</span>
      </button>
    {/if}

    <!-- Export Dropdown -->
    <div class="dropdown-wrap">
      <button class="btn btn-pri" on:click={toggleExport} title="Export diagram & fabrikasi">
        📦 <span class="btn-text">Export</span> <span class="arrow-down">▾</span>
      </button>
      <ExportDropdown show={showExportMenu} on:action={handleExportAction} />
    </div>

    <!-- Toggle Right Inspector Button -->
    <button
      class="nav-toggle-btn"
      on:click={() => dispatch('toggle-right-sidebar')}
      title="Buka/Tutup Panel Properties"
      class:btn-active={showRightSidebar}
    >
      ⚙️ <span class="nav-toggle-lbl">Properties</span>
    </button>

    {#if flashMsg}
      <span class="flash">{flashMsg}</span>
    {/if}
  </div>
</header>

<style>
  .cad-header {
    height: 46px;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 6px;
    flex-shrink: 0;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    z-index: 500;
    justify-content: space-between;
    position: relative;
    overflow: visible !important;
  }
  .cad-ribbon-left {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 800;
    font-size: 14px;
    color: #38bdf8;
  }
  .cad-tag {
    background: #0284c7;
    color: #fff;
    font-size: 9px;
    font-weight: 800;
    padding: 2px 5px;
    border-radius: 3px;
    font-family: monospace;
    letter-spacing: 0.5px;
  }

  .proj-name-wrap {
    display: inline-flex;
    align-items: center;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 2px 7px;
    max-width: 130px;
    min-width: 70px;
  }
  .proj-name {
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
    outline: none;
    border: none;
    background: transparent;
    cursor: text;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
  .proj-name:hover { color: #38bdf8; }
  .proj-name:focus { color: #ffffff; }

  /* Mode Switcher */
  .cad-mode-switch {
    display: inline-flex;
    align-items: center;
    background: #020617;
    border: 1px solid #1e293b;
    border-radius: 7px;
    padding: 2px;
    gap: 2px;
    margin-left: 4px;
  }
  .cad-mode-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: transparent;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .cad-mode-btn:hover { color: #f8fafc; }
  .cad-mode-btn.cad-mode-active {
    background: #0284c7;
    color: #ffffff;
    box-shadow: 0 0 10px rgba(2, 132, 199, 0.5);
  }

  .cad-render-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid #334155;
    background: #1e293b;
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    margin-left: 2px;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .cad-render-btn:hover { background: #334155; color: #fff; }
  .cad-render-btn.cad-render-realistic {
    border-color: #f59e0b;
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.12);
  }

  /* Ribbon Menus */
  .ribbon-menus {
    display: flex;
    align-items: center;
    gap: 1px;
    margin-left: 4px;
  }
  .menu-item-wrap { position: relative; }
  .menu-tab-btn {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 6px;
    cursor: pointer;
    transition: all 0.12s;
  }
  .menu-tab-btn:hover, .menu-tab-btn.menu-open {
    background: #1e293b;
    color: #38bdf8;
    border-color: #334155;
  }

  /* Right Action Strip */
  .cad-ribbon-right {
    display: flex;
    align-items: center;
    gap: 5px;
    justify-content: flex-end;
    flex-shrink: 0;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #334155;
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 600;
    background: #1e293b;
    color: #cbd5e1;
    transition: all 0.12s;
    white-space: nowrap;
    user-select: none;
  }
  .btn:hover { background: #334155; color: #f8fafc; border-color: #475569; }
  .btn-pri { background: #0284c7; color: #fff; border-color: #0369a1; }
  .btn-pri:hover { background: #0369a1; }
  .btn-search { background: #1e1b4b; border-color: #3730a3; color: #a5b4fc; }
  .btn-search:hover { background: #312e81; color: #fff; border-color: #6366f1; }
  .shortcut-tag { font-size: 10px; background: rgba(0, 0, 0, 0.3); padding: 1px 5px; border-radius: 3px; color: #c7d2fe; }

  .badge-erc { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; }
  .badge-erc-err { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }
  .badge-erc-warn { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b; }
  .badge-erc-ok { background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid #4ade80; }

  .btn-sim { background: #0e3a53; color: #38bdf8; border: 1px solid #0284c7; }
  .btn-sim:hover { background: #0284c7; color: #fff; box-shadow: 0 0 12px rgba(56, 189, 248, 0.4); }
  .flash { font-size: 11.5px; color: #4ade80; font-weight: 600; white-space: nowrap; }

  .dropdown-wrap { position: relative; }
  .arrow-down { font-size: 9px; opacity: 0.8; }

  .nav-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #334155;
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 600;
    background: #1e293b;
    color: #94a3b8;
    transition: all 0.12s;
  }
  .nav-toggle-btn:hover { background: #334155; color: #f8fafc; }
  .nav-toggle-btn.btn-active { background: #0369a1; color: #fff; border-color: #38bdf8; }

  /* Light Theme */
  .cad-header.light-cad-header {
    background: #ffffff;
    border-bottom-color: #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }
  .light-cad-header .menu-tab-btn { color: #334155; }
  .light-cad-header .menu-tab-btn:hover,
  .light-cad-header .menu-tab-btn.menu-open {
    background: #f1f5f9;
    color: #0284c7;
    border-color: #cbd5e1;
  }
  .light-cad-header .proj-name-wrap {
    background: #f8fafc;
    border-color: #cbd5e1;
  }
  .light-cad-header .proj-name { color: #0f172a; }
  .light-cad-header .btn {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #334155;
  }
  .light-cad-header .btn:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #94a3b8;
  }
  .light-cad-header .btn-pri {
    background: #0284c7;
    color: #fff;
    border-color: #0369a1;
  }
  .light-cad-header .nav-toggle-btn {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #475569;
  }
  .light-cad-header .nav-toggle-btn.btn-active {
    background: #0284c7;
    color: #fff;
  }

  /* Responsive Rules */
  @media (max-width: 1440px) {
    .btn-text { display: none; }
    .shortcut-tag { display: none; }
    .proj-name-wrap { max-width: 95px; }
    .nav-toggle-lbl { display: none; }
  }
  @media (max-width: 768px) {
    .cad-header { padding: 0 8px; gap: 6px; }
    .ribbon-menus { display: none; }
  }
  @media (max-width: 480px) {
    .logo-text { display: none; }
  }
</style>
