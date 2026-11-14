<script>
  import { createEventDispatcher } from 'svelte'

  export let show = false
  export let gerbers = {}
  export let boardWidthMm = 100
  export let boardHeightMm = 80

  const dispatch = createEventDispatcher()

  let selectedLayer = 'Top_Copper.gtl'

  $: layerKeys = Object.keys(gerbers)
  $: activeContent = gerbers[selectedLayer] || '(Pilih layer untuk melihat raw gerber data)'

  function close() {
    show = false
    dispatch('close')
  }

  function handleDownloadZip() {
    dispatch('download-zip')
    close()
  }

  function copyCode() {
    navigator.clipboard.writeText(activeContent)
    dispatch('flash', `Raw data layer ${selectedLayer} disalin ke clipboard ✓`)
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="gbr-modal-backdrop" on:click={close}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
    <div class="gbr-modal-box" on:click|stopPropagation role="dialog" aria-label="Inspeksi Gerber RS-274X" tabindex="-1">
      <div class="gbr-modal-head">
        <div class="gbr-modal-title">
          <span>🔬</span>
          <span>Inspektur Layer Gerber RS-274X & Drill</span>
          <span class="dim-badge">{boardWidthMm} × {boardHeightMm} mm</span>
        </div>
        <button on:click={close} class="gbr-modal-close" aria-label="Tutup">✕</button>
      </div>

      <div class="gbr-modal-body">
        <div class="gbr-layout">
          <!-- Layer Selector Sidebar -->
          <div class="gbr-layer-list">
            <div class="gbr-sec-title">Daftar Layer Fabrikasi ({layerKeys.length}):</div>
            {#each layerKeys as key}
              <button
                class="gbr-layer-btn"
                class:layer-active={selectedLayer === key}
                on:click={() => (selectedLayer = key)}
              >
                <span class="layer-dot" class:dot-copper={key.includes('Copper')} class:dot-silk={key.includes('Silkscreen')} class:dot-mask={key.includes('Soldermask')} class:dot-drill={key.includes('Drill')} class:dot-edge={key.includes('Edge')}></span>
                <span class="layer-name">{key}</span>
              </button>
            {/each}
          </div>

          <!-- Code / Stream Preview Panel -->
          <div class="gbr-preview-pane">
            <div class="gbr-pane-head">
              <span class="active-filename">📄 {selectedLayer}</span>
              <button on:click={copyCode} class="btn-copy-code" title="Salin kode Gerber">
                📋 Salin Kode
              </button>
            </div>
            <pre class="gbr-code-view"><code>{activeContent}</code></pre>
          </div>
        </div>
      </div>

      <div class="gbr-modal-foot">
        <button on:click={close} class="gbr-btn gbr-btn-sec">Tutup</button>
        <button on:click={handleDownloadZip} class="gbr-btn gbr-btn-pri">
          📦 Unduh Arsip Gerber (.ZIP)
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .gbr-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .gbr-modal-box {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    width: 100%;
    max-width: 820px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    color: #f1f5f9;
    overflow: hidden;
  }

  .gbr-modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
  }

  .gbr-modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    color: #38bdf8;
  }

  .dim-badge {
    font-size: 11px;
    font-family: monospace;
    background: #334155;
    color: #cbd5e1;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 6px;
  }

  .gbr-modal-close {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 16px;
    cursor: pointer;
  }
  .gbr-modal-close:hover { color: #ffffff; }

  .gbr-modal-body {
    padding: 18px;
  }

  .gbr-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 16px;
    height: 380px;
  }

  .gbr-layer-list {
    background: #0b0f19;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
  }

  .gbr-sec-title {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .gbr-layer-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #cbd5e1;
    font-size: 12px;
    font-family: monospace;
    text-align: left;
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .gbr-layer-btn:hover { background: #334155; color: #ffffff; }
  .gbr-layer-btn.layer-active {
    background: rgba(56, 189, 248, 0.15);
    border-color: #38bdf8;
    color: #38bdf8;
    font-weight: 700;
  }

  .layer-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-copper { background: #f59e0b; }
  .dot-silk { background: #ffffff; }
  .dot-mask { background: #10b981; }
  .dot-drill { background: #ec4899; }
  .dot-edge { background: #38bdf8; }

  .gbr-preview-pane {
    background: #0b0f19;
    border: 1px solid #1e293b;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .gbr-pane-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 14px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
    font-size: 12px;
    font-family: monospace;
  }

  .active-filename {
    color: #38bdf8;
    font-weight: 700;
  }

  .btn-copy-code {
    background: #334155;
    border: none;
    color: #f1f5f9;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  .btn-copy-code:hover { background: #475569; }

  .gbr-code-view {
    flex: 1;
    padding: 12px;
    margin: 0;
    overflow: auto;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.4;
    color: #94a3b8;
    white-space: pre;
    background: #060911;
  }

  .gbr-modal-foot {
    padding: 12px 20px;
    background: #1e293b;
    border-top: 1px solid #334155;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .gbr-btn {
    padding: 7px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }
  .gbr-btn-sec { background: #334155; color: #ffffff; }
  .gbr-btn-sec:hover { background: #475569; }
  .gbr-btn-pri { background: #0284c7; color: #ffffff; }
  .gbr-btn-pri:hover { background: #0369a1; }
</style>
