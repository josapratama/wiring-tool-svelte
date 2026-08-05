<script>
  import { CATEGORIES } from '$lib/data/components-db.js'

  export let onDrop  // callback(compId, clientX, clientY)

  let searchQ = ''
  let collapsed = {}

  function toggle(id) { collapsed = { ...collapsed, [id]: !collapsed[id] } }

  function filtered(items) {
    if (!searchQ) return items
    return items.filter(i => i.name.toLowerCase().includes(searchQ.toLowerCase()))
  }

  // Feature #6: highlight matching text
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
</script>

<aside class="sidebar">
  <div class="sidebar-head">
    <span class="sidebar-title">Components</span>
    <input
      class="search"
      bind:value={searchQ}
      placeholder="Search…"
      aria-label="Search components"
    />
  </div>

  <div class="library">
    {#each CATEGORIES as cat (cat.id)}
      {@const items = filtered(cat.items)}
      {#if items.length > 0}
        <div class="category">
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="cat-header" on:click={() => toggle(cat.id)}>
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
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
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
                  <span class="comp-name">{@html highlight(item.name)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</aside>

<style>
  .sidebar {
    width: 200px; flex-shrink: 0; background: #13132a;
    border-right: 2px solid #252545; display: flex; flex-direction: column;
    overflow: hidden;
  }
  .sidebar-head {
    padding: 10px 10px 8px;
    border-bottom: 1px solid #252545;
    display: flex; flex-direction: column; gap: 7px;
  }
  .sidebar-title {
    font: 700 10px/1 sans-serif; text-transform: uppercase;
    letter-spacing: 1px; color: #4f9cf9;
  }
  .search {
    background: #0d0d1a; border: 1px solid #353565; border-radius: 4px;
    padding: 5px 9px; color: #e8e8f5; font-size: 12px; outline: none;
    transition: border-color 0.15s;
  }
  .search:focus { border-color: #4f9cf9; }
  .search::placeholder { color: #404060; }

  .library { flex: 1; overflow-y: auto; padding: 6px 5px; }
  .library::-webkit-scrollbar { width: 4px; }
  .library::-webkit-scrollbar-thumb { background: #353565; border-radius: 2px; }

  .category { margin-bottom: 8px; }
  .cat-header {
    display: flex; align-items: center; gap: 6px;
    font: 700 10px/1 sans-serif; text-transform: uppercase; letter-spacing: 0.8px;
    color: #4f9cf9; padding: 4px 6px; border-bottom: 1px solid #1e1e3a;
    cursor: pointer; user-select: none; margin-bottom: 4px;
  }
  .cat-header:hover { color: #e8e8f5; }
  .arrow { margin-left: auto; font-size: 10px; transition: transform 0.2s; }
  .arrow.collapsed { transform: rotate(-90deg); }

  .items { display: flex; flex-direction: column; gap: 2px; }
  .comp-item {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 8px; border-radius: 4px;
    background: #1a1a35; border: 1px solid #252545;
    cursor: grab; user-select: none;
    transition: all 0.1s;
  }
  .comp-item:hover {
    background: #22224a; border-color: #4f9cf9;
    transform: translateX(2px); box-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }
  .comp-item:active { cursor: grabbing; }
  .comp-icon { font-size: 14px; flex-shrink: 0; width: 18px; text-align: center; }
  .comp-name { font-size: 11px; color: #9090b8; line-height: 1.3; }
  :global(.comp-name mark) {
    background: #4f9cf9; color: #fff; border-radius: 2px; padding: 0 1px;
  }
</style>
