<script>
  /** Feature 8: Right-click context menu */
  import { createEventDispatcher } from 'svelte'

  export let x    = 0
  export let y    = 0
  export let type = null   // 'component' | 'wire' | 'canvas' | null

  const dispatch = createEventDispatcher()

  function act(action) { dispatch('action', action); dispatch('close') }
</script>

<svelte:window
  on:mousedown={() => dispatch('close')}
  on:keydown={(e) => e.key==='Escape' && dispatch('close')}
/>

{#if type}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="menu"
    style="left:{x}px; top:{y}px"
    tabindex="-1"
    role="menu"
    on:mousedown|stopPropagation={() => {}}
  >
    {#if type === 'component'}
      <button class="item" on:click={() => act('rotate')}     role="menuitem">🔄  Rotate 90° <kbd>R</kbd></button>
      <button class="item" on:click={() => act('rename')}     role="menuitem">✏️  Rename</button>
      <button class="item" on:click={() => act('duplicate')}  role="menuitem">📋  Duplicate <kbd>Ctrl+D</kbd></button>
      <div class="divider"></div>
      <button class="item" on:click={() => act('connections')} role="menuitem">🔗  Show Connections</button>
      <div class="divider"></div>
      <button class="item danger" on:click={() => act('delete')} role="menuitem">🗑  Delete <kbd>Del</kbd></button>

    {:else if type === 'wire'}
      <button class="item" on:click={() => act('editLabel')}  role="menuitem">✏️  Edit Label</button>
      <button class="item" on:click={() => act('wireColor')}  role="menuitem">🎨  Change Color</button>
      <div class="divider"></div>
      <button class="item danger" on:click={() => act('delete')} role="menuitem">🗑  Delete <kbd>Del</kbd></button>

    {:else}
      <button class="item" on:click={() => act('addLabel')}   role="menuitem">📝  Add Label <kbd>L</kbd></button>
      <button class="item" on:click={() => act('clearSel')}   role="menuitem">🧹  Clear Selection <kbd>Esc</kbd></button>
      <div class="divider"></div>
      <button class="item" on:click={() => act('fitView')}    role="menuitem">🔍  Fit View <kbd>F</kbd></button>
      <button class="item" on:click={() => act('toggleGrid')} role="menuitem">⊞  Toggle Grid <kbd>G</kbd></button>
    {/if}
  </div>
{/if}

<style>
  .menu {
    position: fixed; z-index: 9000;
    background: #1a1a35; border: 1px solid #353565;
    border-radius: 8px; padding: 4px;
    min-width: 195px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.75);
    font-size: 12px;
  }
  .item {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 7px 12px; border: none; border-radius: 5px;
    background: transparent; color: #c0c0e0; cursor: pointer;
    text-align: left; transition: background 0.1s; gap: 4px;
  }
  .item:hover { background: #252550; color: #fff; }
  .item.danger { color: #f87171; }
  .item.danger:hover { background: #3a1010; }
  .divider { height: 1px; background: #252545; margin: 3px 4px; }
  kbd {
    margin-left: auto; font-size: 10px; color: #505070;
    background: #0d0d1a; border: 1px solid #353555;
    border-radius: 3px; padding: 1px 5px;
  }
</style>
