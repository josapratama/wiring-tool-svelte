<script>
  import { onMount } from 'svelte'
  import { CATEGORIES, getCustomComponents, deleteCustomComponent } from '$lib/data/components-db.js'
  import CustomComponentModal from './CustomComponentModal.svelte'
  import { showConfirm } from '../store/dialog.js'
  import {
    components, wires, selection, multiSelection,
    rotateComponent, removeComponent,
    setHighlightedNet, clearHighlightedNet, activeHighlightedNet,
    getDiscoveredNets, getUsedPins
  } from '$lib/store/diagram.js'

  export let onDrop  // callback(compId, clientX, clientY)
  export let onFocusComp = () => {} // callback(instanceId)

  let activeTab = 'eelib' // 'eelib' | 'manager'
  let searchQ = ''
  let collapsed = {}
  let customComponents = []
  let showModal = false

  function refreshCustom() {
    customComponents = getCustomComponents()
  }

  onMount(refreshCustom)

  function toggle(id) { collapsed = { ...collapsed, [id]: !collapsed[id] } }

  function filtered(items) {
    if (!searchQ) return items
    return items.filter(i => (i.name || i.label || '').toLowerCase().includes(searchQ.toLowerCase()))
  }

  function highlight(name) {
    if (!searchQ) return name
    const idx = name.toLowerCase().indexOf(searchQ.toLowerCase())
    if (idx < 0) return name
    return name.slice(0, idx)
      + '<mark>' + name.slice(idx, idx + searchQ.length) + '</mark>'
      + name.slice(idx + searchQ.length)
  }

  function startDrag(e, compId) {
    e.dataTransfer.setData('comp-id', compId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  async function handleDeleteCustom(e, id) {
    e.stopPropagation()
    const ok = await showConfirm({
      title: 'Hapus Komponen Kustom?',
      message: 'Komponen kustom ini akan dihapus dari library lokal browser Anda.',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      danger: true,
      icon: '🗑️'
    })
    if (ok) {
      customComponents = deleteCustomComponent(id)
    }
  }

  // ── Design Manager Reactive State ──────────────────────
  $: discoveredNets = ($wires, $components, getDiscoveredNets())
  $: filteredNets = searchQ
    ? discoveredNets.filter(n => n.name.toLowerCase().includes(searchQ.toLowerCase()))
    : discoveredNets

  $: filteredParts = searchQ
    ? $components.filter(c => (c.label || c.id || '').toLowerCase().includes(searchQ.toLowerCase()))
    : $components

  function selectPart(c) {
    selection.set({ id: c.instanceId, type: 'component' })
    multiSelection.set([{ id: c.instanceId, type: 'component' }])
    onFocusComp(c.instanceId)
  }

  function toggleNet(net) {
    if ($activeHighlightedNet === net.name) {
      clearHighlightedNet()
    } else {
      setHighlightedNet(net.name, net.wireIds)
    }
  }
</script>

<aside class="sidebar">
  <!-- Top Dock Tabs (EasyEDA style) -->
  <div class="dock-tabs">
    <button class="dock-tab" class:tab-active={activeTab === 'eelib'} on:click={() => activeTab = 'eelib'}>
      📦 EELib
    </button>
    <button class="dock-tab" class:tab-active={activeTab === 'manager'} on:click={() => activeTab = 'manager'}>
      🌲 Design Manager
      {#if $components.length > 0}
        <span class="tab-badge">{$components.length}</span>
      {/if}
    </button>
  </div>

  <div class="sidebar-head">
    <div class="head-top">
      <span class="sidebar-title">{activeTab === 'eelib' ? 'Components' : 'Tree Manager'}</span>
      {#if activeTab === 'eelib'}
        <button class="btn-new-custom" on:click={() => showModal = true} title="Create Custom Component">
          + Custom
        </button>
      {:else}
        <span class="cad-badge">CAD Netlist</span>
      {/if}
    </div>
    <input
      class="search"
      bind:value={searchQ}
      placeholder={activeTab === 'eelib' ? "Cari komponen..." : "Cari part atau net..."}
      aria-label="Search items"
    />
  </div>

  <div class="library">
    {#if activeTab === 'eelib'}
      <!-- TAB 1: EELib COMPONENT LIBRARY -->
      <!-- Custom Components Section -->
      {#if customComponents.length > 0}
        {@const filteredCustom = filtered(customComponents)}
        {#if filteredCustom.length > 0}
          <div class="category">
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="cat-header custom-cat" on:click={() => toggle('custom')}>
              <span>⭐</span>
              <span>Custom ({filteredCustom.length})</span>
              <span class="arrow" class:collapsed={collapsed['custom']}>▾</span>
            </div>

            {#if !collapsed['custom']}
              <div class="items">
                {#each filteredCustom as item (item.id)}
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
                  <div
                    class="comp-item custom-item"
                    draggable="true"
                    title={item.desc ?? item.name}
                    on:dragstart={(e) => startDrag(e, item.id)}
                    on:dblclick={() => onDrop(item.id, null, null)}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => e.key==='Enter' && onDrop(item.id, null, null)}
                  >
                    <span class="comp-icon">✨</span>
                    <div class="comp-text">
                      <span class="comp-name">{@html highlight(item.name || item.id)}</span>
                    </div>
                    <button class="btn-add-mini" on:click|stopPropagation={() => onDrop(item.id, null, null)} title="Pasang ke kanvas">+</button>
                    <button class="btn-del-mini" on:click={(e) => handleDeleteCustom(e, item.id)} title="Delete">✕</button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      {/if}

      <!-- Standard Categories -->
      {#each CATEGORIES as cat (cat.id)}
        {@const items = filtered(cat.items)}
        {#if items.length > 0}
          <div class="category">
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="cat-header" on:click={() => toggle(cat.id)}>
              <span class="cat-icon-badge">{cat.icon}</span>
              <span class="cat-title">{cat.label}</span>
              <span class="cat-count">({items.length})</span>
              <span class="arrow" class:collapsed={collapsed[cat.id]}>▾</span>
            </div>

            {#if !collapsed[cat.id]}
              <div class="items">
                {#each items as item (item.id)}
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
                  <div
                    class="comp-item"
                    class:port-item={cat.id === 'ports'}
                    draggable="true"
                    title={item.desc ?? item.name}
                    on:dragstart={(e) => startDrag(e, item.id)}
                    on:dblclick={() => onDrop(item.id, null, null)}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => e.key==='Enter' && onDrop(item.id, null, null)}
                  >
                    <span class="comp-icon">{cat.icon}</span>
                    <div class="comp-text">
                      <span class="comp-name">{@html highlight(item.name)}</span>
                      {#if item.desc}
                        <span class="comp-desc">{item.desc}</span>
                      {/if}
                    </div>
                    <button class="btn-add-mini" on:click|stopPropagation={() => onDrop(item.id, null, null)} title="Pasang ke kanvas">
                      +
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    {:else}
      <!-- TAB 2: DESIGN MANAGER (PARTS & NETS TREE) -->
      <!-- Highlighted Net Status Pill -->
      {#if $activeHighlightedNet}
        <div class="active-highlight-box">
          <div class="active-net-info">
            <span class="glow-dot">✦</span>
            <span class="active-net-text">Net: <strong>{$activeHighlightedNet}</strong></span>
          </div>
          <button class="btn-clear-net" on:click={clearHighlightedNet} title="Hapus sorot kabel">
            Batal Sorot
          </button>
        </div>
      {/if}

      <!-- Section: Parts / Components Tree -->
      <div class="manager-section">
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="section-header" on:click={() => toggle('mgr-parts')}>
          <span class="section-icon">📦</span>
          <span class="section-title">Parts / Komponen</span>
          <span class="cat-count">({filteredParts.length})</span>
          <span class="arrow" class:collapsed={collapsed['mgr-parts']}>▾</span>
        </div>

        {#if !collapsed['mgr-parts']}
          {#if filteredParts.length === 0}
            <div class="empty-hint">Tidak ada komponen pada kanvas.</div>
          {:else}
            <div class="tree-list">
              {#each filteredParts as c (c.instanceId)}
                {@const isSel = $selection?.id === c.instanceId}
                {@const used = getUsedPins(c.instanceId).size}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="part-row" class:row-selected={isSel} on:click={() => selectPart(c)}>
                  <div class="part-badge" style="border-color:{c.theme === 'mcu' ? '#38bdf8' : c.theme === 'sensor' ? '#4ade80' : c.theme === 'power' ? '#f87171' : '#94a3b8'}">
                    {c.theme ? c.theme.slice(0,3).toUpperCase() : 'PAR'}
                  </div>
                  <div class="part-info">
                    <span class="part-label">{c.label}</span>
                    <span class="part-sub">{c.id} • {used} pins</span>
                  </div>
                  <div class="part-actions" on:click|stopPropagation>
                    <button class="act-btn" on:click={() => selectPart(c)} title="Fokuskan ke kanvas">🎯</button>
                    <button class="act-btn" on:click={() => rotateComponent(c.instanceId, 90)} title="Putar 90°">↻</button>
                    <button class="act-btn act-del" on:click={() => removeComponent(c.instanceId)} title="Hapus">✕</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <!-- Section: Nets Tree -->
      <div class="manager-section">
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="section-header" on:click={() => toggle('mgr-nets')}>
          <span class="section-icon">⚡</span>
          <span class="section-title">Nets & Connections</span>
          <span class="cat-count">({filteredNets.length})</span>
          <span class="arrow" class:collapsed={collapsed['mgr-nets']}>▾</span>
        </div>

        {#if !collapsed['mgr-nets']}
          {#if filteredNets.length === 0}
            <div class="empty-hint">Belum ada net / jalur kabel. Tarik kabel antar pin untuk membuat net.</div>
          {:else}
            <div class="tree-list">
              {#each filteredNets as net (net.name)}
                {@const isNetActive = $activeHighlightedNet === net.name}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div
                  class="net-row"
                  class:net-active={isNetActive}
                  on:click={() => toggleNet(net)}
                  title="Klik untuk menyorot jalur net {net.name} di kanvas"
                >
                  <span class="net-dot" style="background:{net.color}"></span>
                  <div class="net-info">
                    <span class="net-name">{net.name}</span>
                    <span class="net-pins">{net.pinCount} pins • {net.connections.length} segmen</span>
                  </div>
                  <button class="btn-net-highlight" class:highlight-active={isNetActive}>
                    {isNetActive ? '✦ ON' : 'Sorot'}
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</aside>

<!-- Modal for creating new custom component -->
<CustomComponentModal bind:show={showModal} on:created={refreshCustom}/>

<style>
  .sidebar {
    width: 240px; flex-shrink: 0; background: #111827;
    border-right: 1px solid #1f2937; display: flex; flex-direction: column;
    overflow: hidden; height: 100%;
  }

  /* Dock Tabs */
  .dock-tabs {
    display: flex; background: #0b0f19; border-bottom: 1px solid #1f2937;
  }
  .dock-tab {
    flex: 1; padding: 10px 8px; font-size: 11px; font-weight: 700;
    color: #94a3b8; background: transparent; border: none; cursor: pointer;
    border-bottom: 2px solid transparent; transition: all 0.15s;
    display: flex; align-items: center; justify-content: center; gap: 5px;
  }
  .dock-tab:hover { color: #f8fafc; background: rgba(255,255,255,0.02); }
  .dock-tab.tab-active {
    color: #38bdf8; border-bottom-color: #38bdf8; background: #111827;
  }
  .tab-badge {
    background: #0284c7; color: #fff; font-size: 9px; padding: 1px 5px;
    border-radius: 999px;
  }

  .sidebar-head {
    padding: 10px 12px;
    border-bottom: 1px solid #1f2937;
    display: flex; flex-direction: column; gap: 8px; background: #0f172a;
  }
  .head-top {
    display: flex; align-items: center; justify-content: space-between;
  }
  .sidebar-title {
    font: 700 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-transform: uppercase; letter-spacing: 0.8px; color: #38bdf8;
  }
  .cad-badge {
    font-size: 9px; font-weight: 700; color: #4ade80;
    background: rgba(74, 222, 128, 0.12); border: 1px solid rgba(74, 222, 128, 0.3);
    padding: 2px 6px; border-radius: 4px;
  }
  .btn-new-custom {
    background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3);
    border-radius: 4px; padding: 4px 8px; color: #38bdf8; font-size: 10px;
    font-weight: 700; cursor: pointer; transition: all 0.15s;
  }
  .btn-new-custom:hover { background: #0284c7; color: #fff; border-color: #0284c7; }
  .search {
    background: #030712; border: 1px solid #374151; border-radius: 6px;
    padding: 6px 10px; color: #f9fafb; font-size: 12px; outline: none;
    transition: all 0.15s;
  }
  .search:focus { border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }
  .search::placeholder { color: #6b7280; }

  .library { flex: 1; overflow-y: auto; padding: 8px 6px; }
  .library::-webkit-scrollbar { width: 4px; }
  .library::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }

  .category { margin-bottom: 8px; }
  .cat-header {
    display: flex; align-items: center; gap: 6px;
    font: 700 11px/1 -apple-system, sans-serif;
    color: #94a3b8; padding: 6px 8px; border-radius: 4px;
    cursor: pointer; user-select: none; margin-bottom: 3px;
    transition: all 0.12s;
  }
  .cat-header:hover { color: #f8fafc; background: #1e293b; }
  .cat-icon-badge { font-size: 13px; }
  .cat-title { font-weight: 600; flex: 1; }
  .cat-count { font-size: 10px; color: #64748b; font-weight: 500; }
  .custom-cat { color: #facc15; }
  .arrow { font-size: 10px; transition: transform 0.2s; color: #64748b; }
  .arrow.collapsed { transform: rotate(-90deg); }

  .items { display: flex; flex-direction: column; gap: 3px; }
  .comp-item {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 8px; border-radius: 6px;
    background: #1e293b; border: 1px solid rgba(255, 255, 255, 0.05);
    cursor: grab; user-select: none;
    transition: all 0.12s; position: relative;
  }
  .comp-item:hover {
    background: #273549; border-color: #38bdf8;
    transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  }
  .custom-item { border-left: 3px solid #facc15; }
  .port-item { border-left: 3px solid #ef4444; }
  .comp-item:active { cursor: grabbing; }
  .comp-icon { font-size: 14px; flex-shrink: 0; width: 18px; text-align: center; }
  .comp-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .comp-name { font-size: 11.5px; font-weight: 500; color: #e2e8f0; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .comp-desc { font-size: 9.5px; color: #94a3b8; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
  :global(.comp-name mark) {
    background: #38bdf8; color: #000; border-radius: 2px; padding: 0 2px; font-weight: 700;
  }
  .btn-add-mini {
    background: #0f172a; border: 1px solid #334155; color: #38bdf8;
    cursor: pointer; font-size: 13px; font-weight: 700; width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px; opacity: 0.7; transition: all 0.12s; flex-shrink: 0;
  }
  .btn-add-mini:hover, .comp-item:hover .btn-add-mini { opacity: 1; background: #0284c7; color: #fff; border-color: #0284c7; }
  .btn-del-mini {
    background: transparent; border: none; color: #64748b;
    cursor: pointer; font-size: 10px; padding: 2px 4px; border-radius: 3px; flex-shrink: 0;
  }
  .btn-del-mini:hover { color: #f87171; background: #371717; }

  /* ── Design Manager Styles ── */
  .manager-section { margin-bottom: 12px; }
  .section-header {
    display: flex; align-items: center; gap: 6px;
    font: 700 11px/1 -apple-system, sans-serif;
    color: #e2e8f0; padding: 6px 8px; border-radius: 4px;
    background: #1e293b; cursor: pointer; user-select: none; margin-bottom: 5px;
  }
  .section-icon { font-size: 13px; }
  .section-title { flex: 1; font-weight: 600; }
  .tree-list { display: flex; flex-direction: column; gap: 3px; padding-left: 2px; }
  .empty-hint { font-size: 11px; color: #64748b; padding: 8px 10px; font-style: italic; }

  .part-row {
    display: flex; align-items: center; gap: 8px; padding: 6px 8px;
    border-radius: 5px; background: #172033; border: 1px solid rgba(255,255,255,0.04);
    cursor: pointer; transition: all 0.12s;
  }
  .part-row:hover { background: #1e2c45; border-color: #38bdf8; }
  .part-row.row-selected { background: #0c4a6e; border-color: #38bdf8; }
  .part-badge {
    font-size: 8.5px; font-weight: 800; padding: 1px 4px; border-radius: 3px;
    border: 1px solid #38bdf8; color: #94a3b8; font-family: monospace;
  }
  .part-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .part-label { font-size: 11px; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .part-sub { font-size: 9.5px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .part-actions { display: flex; align-items: center; gap: 3px; }
  .act-btn {
    background: #0f172a; border: 1px solid #334155; color: #cbd5e1;
    font-size: 10px; border-radius: 3px; padding: 2px 4px; cursor: pointer;
  }
  .act-btn:hover { background: #0284c7; color: #fff; border-color: #0284c7; }
  .act-del:hover { background: #ef4444; color: #fff; border-color: #ef4444; }

  /* Nets Rows */
  .net-row {
    display: flex; align-items: center; gap: 8px; padding: 6px 8px;
    border-radius: 5px; background: #172033; border: 1px solid rgba(255,255,255,0.04);
    cursor: pointer; transition: all 0.12s;
  }
  .net-row:hover { background: #1e2c45; border-color: #38bdf8; }
  .net-row.net-active {
    background: #1e1b4b; border-color: #818cf8; box-shadow: 0 0 10px rgba(129, 140, 248, 0.25);
  }
  .net-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .net-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .net-name { font-size: 11.5px; font-weight: 700; color: #f8fafc; font-family: monospace; }
  .net-pins { font-size: 9.5px; color: #94a3b8; }
  .btn-net-highlight {
    font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 3px;
    border: 1px solid #334155; background: #0f172a; color: #94a3b8; cursor: pointer;
  }
  .btn-net-highlight:hover { background: #38bdf8; color: #000; border-color: #38bdf8; }
  .btn-net-highlight.highlight-active {
    background: #4ade80; color: #000; border-color: #4ade80;
  }

  /* Active Net Highlight Banner */
  .active-highlight-box {
    display: flex; align-items: center; justify-content: space-between;
    background: #312e81; border: 1px solid #6366f1; border-radius: 6px;
    padding: 6px 8px; margin-bottom: 8px;
  }
  .active-net-info { display: flex; align-items: center; gap: 5px; }
  .glow-dot { color: #a5b4fc; font-size: 12px; }
  .active-net-text { font-size: 11px; color: #e0e7ff; }
  .btn-clear-net {
    font-size: 9.5px; font-weight: 700; background: #4338ca; border: 1px solid #818cf8;
    color: #fff; border-radius: 3px; padding: 2px 6px; cursor: pointer;
  }
  .btn-clear-net:hover { background: #ef4444; border-color: #ef4444; }

  /* ── Light Mode Integration ── */
  :global(.light-app) .sidebar {
    background: #f8fafc;
    border-right-color: #e2e8f0;
  }
  :global(.light-app) .dock-tabs {
    background: #e2e8f0; border-bottom-color: #cbd5e1;
  }
  :global(.light-app) .dock-tab {
    color: #64748b;
  }
  :global(.light-app) .dock-tab.tab-active {
    background: #ffffff; color: #0284c7; border-bottom-color: #0284c7;
  }
  :global(.light-app) .sidebar-head {
    background: #ffffff;
    border-bottom-color: #e2e8f0;
  }
  :global(.light-app) .sidebar-title {
    color: #0284c7;
  }
  :global(.light-app) .search {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #0f172a;
  }
  :global(.light-app) .search::placeholder {
    color: #94a3b8;
  }
  :global(.light-app) .cat-header {
    color: #475569;
  }
  :global(.light-app) .cat-header:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
  :global(.light-app) .comp-item {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  :global(.light-app) .comp-item:hover {
    background: #f0f9ff;
    border-color: #38bdf8;
    box-shadow: 0 2px 8px rgba(2, 132, 199, 0.12);
  }
  :global(.light-app) .comp-name {
    color: #0f172a;
  }
  :global(.light-app) .comp-desc {
    color: #64748b;
  }
  :global(.light-app) .btn-add-mini {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #0284c7;
  }
  :global(.light-app) .btn-add-mini:hover {
    background: #0284c7;
    color: #ffffff;
    border-color: #0284c7;
  }
  :global(.light-app) .section-header {
    background: #f1f5f9; color: #1e293b;
  }
  :global(.light-app) .part-row, :global(.light-app) .net-row {
    background: #ffffff; border-color: #e2e8f0;
  }
  :global(.light-app) .part-row:hover, :global(.light-app) .net-row:hover {
    background: #f0f9ff; border-color: #38bdf8;
  }
  :global(.light-app) .part-label { color: #0f172a; }
  :global(.light-app) .net-name { color: #0f172a; }
  :global(.light-app) .net-row.net-active {
    background: #e0e7ff; border-color: #6366f1;
  }
  :global(.light-app) .library::-webkit-scrollbar-thumb {
    background: #cbd5e1;
  }
</style>
