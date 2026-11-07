<script>
  import { onMount } from 'svelte'
  import { CATEGORIES, getCustomComponents, deleteCustomComponent } from '$lib/data/components-db.js'
  import CustomComponentModal from './CustomComponentModal.svelte'

  export let onDrop  // callback(compId, clientX, clientY)

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

  function handleDeleteCustom(e, id) {
    e.stopPropagation()
    if (confirm('Hapus komponen kustom ini dari library?')) {
      customComponents = deleteCustomComponent(id)
    }
  }
</script>

<aside class="sidebar">
  <div class="sidebar-head">
    <div class="head-top">
      <span class="sidebar-title">Components</span>
      <button class="btn-new-custom" on:click={() => showModal = true} title="Create Custom Component">
        + Custom
      </button>
    </div>
    <input
      class="search"
      bind:value={searchQ}
      placeholder="Search…"
      aria-label="Search components"
    />
  </div>

  <div class="library">
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
  </div>
</aside>

<!-- Modal for creating new custom component -->
<CustomComponentModal bind:show={showModal} on:created={refreshCustom}/>

<style>
  .sidebar {
    width: 220px; flex-shrink: 0; background: #111827;
    border-right: 1px solid #1f2937; display: flex; flex-direction: column;
    overflow: hidden; height: 100%;
  }
  .sidebar-head {
    padding: 12px 12px 10px;
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
</style>
