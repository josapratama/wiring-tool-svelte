<script>
  import { CATEGORIES } from '$lib/data/components-db.js'
  import { addComponent, pushHistory } from '$lib/store/diagram.js'
  import { createEventDispatcher, onMount } from 'svelte'

  export let show = false
  export let canvasCenter = { x: 400, y: 300 }

  const dispatch = createEventDispatcher()
  let searchInput = null
  let query = ''
  let selectedIndex = 0

  // Flatten all components from categories
  $: allItems = CATEGORIES.flatMap(cat =>
    (cat.items || []).map(item => ({
      ...item,
      categoryLabel: cat.label,
      categoryIcon: cat.icon
    }))
  )

  $: filtered = query.trim() === ''
    ? allItems.slice(0, 15)
    : allItems.filter(item => {
        const q = query.toLowerCase()
        return (item.name || '').toLowerCase().includes(q) ||
               (item.desc || '').toLowerCase().includes(q) ||
               (item.categoryLabel || '').toLowerCase().includes(q) ||
               (item.id || '').toLowerCase().includes(q)
      }).slice(0, 20)

  $: if (filtered.length > 0 && selectedIndex >= filtered.length) {
    selectedIndex = 0
  }

  function selectItem(item) {
    if (!item) return
    pushHistory()
    const comp = addComponent(item.id, canvasCenter.x - (item.width || 140) / 2, canvasCenter.y - (item.height || 100) / 2)
    dispatch('added', comp)
    show = false
  }

  function onKeyDown(e) {
    if (!show) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIndex = (selectedIndex + 1) % filtered.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) selectItem(filtered[selectedIndex])
    } else if (e.key === 'Escape') {
      show = false
    }
  }

  $: if (show && searchInput) {
    setTimeout(() => {
      searchInput?.focus()
      query = ''
      selectedIndex = 0
    }, 50)
  }
</script>

<svelte:window on:keydown={onKeyDown}/>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="palette-backdrop" on:click={() => show = false}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
    <div class="palette-box" on:click|stopPropagation role="dialog" aria-label="Quick Component Palette" tabindex="-1">
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input
          bind:this={searchInput}
          bind:value={query}
          placeholder="Cari komponen mikrokontroler, sensor, display, dll... (Tekan Enter untuk pasang)"
          class="search-input"
        />
        <kbd class="esc-badge">ESC</kbd>
      </div>

      <div class="results-list">
        {#if filtered.length === 0}
          <div class="empty-state">
            <span>Tidak ada komponen yang cocok dengan "{query}"</span>
          </div>
        {:else}
          {#each filtered as item, idx}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div
              class="result-item"
              class:selected={idx === selectedIndex}
              on:click={() => selectItem(item)}
              on:mouseenter={() => selectedIndex = idx}
            >
              <div class="item-left">
                <span class="cat-icon">{item.categoryIcon}</span>
                <div class="item-info">
                  <div class="item-name">
                    <span>{item.name}</span>
                    <span class="item-id">{item.id}</span>
                  </div>
                  <div class="item-desc">{item.desc || item.categoryLabel}</div>
                </div>
              </div>
              <div class="item-right">
                <span class="cat-badge">{item.categoryLabel}</span>
                <span class="enter-hint">↵ Pasang</span>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <div class="palette-footer">
        <span>Gunakan tombol <kbd>↑</kbd> <kbd>↓</kbd> untuk memilih, <kbd>Enter</kbd> untuk menambahkan ke canvas</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .palette-backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px); z-index: 1100;
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 12vh;
  }
  .palette-box {
    width: 620px; max-width: 92vw; background: #13132a;
    border: 1.5px solid #353565; border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
    display: flex; flex-direction: column; overflow: hidden;
    animation: drop-down 0.14s ease-out;
  }
  @keyframes drop-down {
    from { opacity: 0; transform: translateY(-12px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .search-bar {
    display: flex; align-items: center; gap: 10px; padding: 12px 16px;
    background: #181836; border-bottom: 1.5px solid #252545;
  }
  .search-icon { font-size: 16px; opacity: 0.7; }
  .search-input {
    flex: 1; background: transparent; border: none; outline: none;
    font-size: 14px; font-weight: 500; color: #f1f5f9;
  }
  .search-input::placeholder { color: #64748b; }
  .esc-badge {
    background: #252545; color: #94a3b8; font-size: 10px; font-family: monospace;
    padding: 2px 6px; border-radius: 4px; border: 1px solid #3b3b6b;
  }
  .results-list {
    max-height: 52vh; overflow-y: auto; padding: 6px;
  }
  .empty-state {
    padding: 24px; text-align: center; color: #64748b; font-size: 13px;
  }
  .result-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; border-radius: 6px; cursor: pointer;
    transition: background 0.1s;
  }
  .result-item:hover, .result-item.selected {
    background: #202048;
  }
  .result-item.selected .enter-hint {
    opacity: 1;
  }
  .item-left { display: flex; align-items: center; gap: 12px; }
  .cat-icon { font-size: 20px; }
  .item-info { display: flex; flex-direction: column; gap: 2px; }
  .item-name { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #f1f5f9; }
  .item-id { font-size: 10px; color: #64748b; font-family: monospace; background: #181836; padding: 1px 5px; border-radius: 3px; }
  .item-desc { font-size: 11px; color: #94a3b8; }
  .item-right { display: flex; align-items: center; gap: 8px; }
  .cat-badge {
    font-size: 10px; color: #818cf8; background: rgba(99, 102, 241, 0.12);
    padding: 2px 7px; border-radius: 10px; border: 1px solid rgba(99, 102, 241, 0.25);
  }
  .enter-hint {
    font-size: 11px; color: #4ade80; font-weight: 600; opacity: 0;
    transition: opacity 0.1s;
  }
  .palette-footer {
    height: 34px; background: #181836; border-top: 1px solid #252545;
    display: flex; align-items: center; padding: 0 16px; font-size: 11px; color: #64748b;
  }
  .palette-footer kbd {
    background: #252545; color: #cbd5e1; padding: 1px 4px; border-radius: 3px;
    font-size: 10px; font-family: monospace;
  }
</style>

