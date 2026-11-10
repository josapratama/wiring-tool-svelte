<script>
  import { createEventDispatcher } from 'svelte'

  export let boardWidthMm = 100
  export let boardHeightMm = 80
  export let cornerRadiusMm = 3
  export let includeMountHoles = true
  export let showCopperPour = false
  export let selectedComp = null
  export let selectedTraceId = null
  export let copperTracesCount = 0
  export let viasCount = 0
  export let drcResults = { errors: [], warnings: [], ok: true, clean: true }
  export let bomCostEstimate = { totalCostUsd: 0, pcbFabCostUsd: 0, componentsCostUsd: 0, areaCm2: 0, leadTimeDays: '3-4 Hari' }

  const dispatch = createEventDispatcher()
</script>

<aside class="pcb-inspector">
  <div class="pcb-inspector-head">
    <div class="pcb-insp-title">
      <span>⚙</span>
      <span>INSPECTOR PCB</span>
    </div>
    <button on:click={() => dispatch('close')} class="pcb-insp-close" title="Tutup Inspector">✕</button>
  </div>

  <div class="pcb-inspector-body">
    <!-- Section 1: Board Dimensions -->
    <div class="pcb-card">
      <h4 class="pcb-card-title">Dimensi Papan PCB</h4>
      <p class="pcb-card-desc">Ukuran fisik papan substrat FR-4 (mm).</p>
      <div class="pcb-form-grid">
        <label class="pcb-field">
          <span class="pcb-field-lbl">Lebar (mm)</span>
          <input
            type="number"
            bind:value={boardWidthMm}
            on:input={() => dispatch('dimension-change', { width: boardWidthMm, height: boardHeightMm })}
            min="20"
            max="400"
            class="pcb-input"
          />
        </label>
        <label class="pcb-field">
          <span class="pcb-field-lbl">Panjang (mm)</span>
          <input
            type="number"
            bind:value={boardHeightMm}
            on:input={() => dispatch('dimension-change', { width: boardWidthMm, height: boardHeightMm })}
            min="20"
            max="400"
            class="pcb-input"
          />
        </label>
      </div>

      <div class="pcb-form-grid" style="margin-top: 8px;">
        <label class="pcb-field">
          <span class="pcb-field-lbl">Radius Sudut (mm)</span>
          <input type="number" bind:value={cornerRadiusMm} min="0" max="20" class="pcb-input" />
        </label>
        <div class="pcb-field">
          <span class="pcb-field-lbl">Lubang Baut M3</span>
          <label class="pcb-toggle-row">
            <input type="checkbox" bind:checked={includeMountHoles} class="pcb-chk" />
            <span class="pcb-toggle-lbl">Aktif (4 Sudut)</span>
          </label>
        </div>
      </div>

      <label class="pcb-toggle-row" style="margin-top: 8px;">
        <input type="checkbox" bind:checked={showCopperPour} class="pcb-chk" />
        <span class="pcb-toggle-lbl" style="font-size: 11px; font-weight: 600; color: #38bdf8;">
          ⚡ Ground Plane (Poligon Tembaga)
        </span>
      </label>
    </div>

    <!-- Section 2: Selected Component -->
    <div class="pcb-card">
      <h4 class="pcb-card-title">Komponen Terpilih</h4>
      {#if selectedComp}
        <div class="pcb-selected-box">
          <div class="pcb-sel-name">{selectedComp.label || selectedComp.name}</div>
          <div class="pcb-sel-meta">Footprint: {selectedComp.footprint?.name || 'Standard'}</div>
          <div class="pcb-sel-meta">Rotasi: {selectedComp.rotation || 0}° | Posisi: X={selectedComp.xMm}mm Y={selectedComp.yMm}mm</div>
          <button on:click={() => dispatch('rotate-component', 90)} class="pcb-btn pcb-btn-full">
            <span>↻</span>
            <span>Putar 90° (R)</span>
          </button>
        </div>
      {:else}
        <div class="pcb-empty-hint">
          Klik komponen di atas kanvas PCB untuk mengatur posisi dan rotasi.
        </div>
      {/if}
    </div>

    <!-- Section 3: Copper Traces Management -->
    <div class="pcb-card">
      <h4 class="pcb-card-title">Jalur Tembaga & Via</h4>
      <div class="pcb-stat-row">
        <span>Total Segmen Jalur:</span>
        <span class="pcb-stat-val">{copperTracesCount} segmen</span>
      </div>
      <div class="pcb-stat-row">
        <span>Total Through-hole Via:</span>
        <span class="pcb-stat-val">{viasCount} via</span>
      </div>
      {#if selectedTraceId}
        <button on:click={() => dispatch('delete-selected-trace')} class="pcb-btn pcb-btn-danger pcb-btn-full" style="margin-bottom: 8px;">
          <span>🗑</span>
          <span>Hapus Elemen Terpilih (Del)</span>
        </button>
      {/if}
      <button on:click={() => dispatch('clear-all-traces')} class="pcb-btn pcb-btn-full">
        <span>🧹</span>
        <span>Bersihkan Semua Jalur & Via</span>
      </button>
    </div>

    <!-- Section 4: DRC CAD Audit -->
    <div class="pcb-card">
      <div class="pcb-drc-header">
        <h4 class="pcb-card-title">Aturan Desain (DRC CAD)</h4>
        <span class="pcb-badge" class:pcb-badge-ok={drcResults.ok && drcResults.clean} class:pcb-badge-warn={!drcResults.ok || !drcResults.clean}>
          {drcResults.ok && drcResults.clean ? '✓ Passed' : `${(drcResults.errors?.length || 0) + (drcResults.warnings?.length || 0)} Isu`}
        </span>
      </div>
      <p class="pcb-card-desc">Audit real-time standar pabrikasi JLCPCB / PCBWay.</p>

      {#if drcResults.errors && drcResults.errors.length > 0}
        <div class="pcb-drc-list pcb-drc-errors">
          {#each drcResults.errors as err}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="pcb-drc-item pcb-drc-err pcb-drc-clickable" on:click={() => dispatch('highlight-drc', err)} title="Klik untuk melompat ke lokasi koordinat masalah di kanvas">
              <span class="pcb-drc-icon">🚫</span>
              <div class="pcb-drc-msg">
                <strong>{err.code}</strong>: {err.message}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if drcResults.warnings && drcResults.warnings.length > 0}
        <div class="pcb-drc-list pcb-drc-warnings">
          {#each drcResults.warnings as warn}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="pcb-drc-item pcb-drc-warn pcb-drc-clickable" on:click={() => dispatch('highlight-drc', warn)} title="Klik untuk melompat ke lokasi koordinat masalah di kanvas">
              <span class="pcb-drc-icon">⚠️</span>
              <div class="pcb-drc-msg">
                <strong>{warn.code}</strong>: {warn.message}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if drcResults.clean}
        <div class="pcb-drc-clean-box">
          <span class="pcb-clean-icon">🛡️</span>
          <div>Semua jalur tembaga, via, dan footprint pad memenuhi aturan manufaktur. Siap diekspor!</div>
        </div>
      {/if}
    </div>

    <!-- Section 5: Maker Cost Estimator -->
    <div class="pcb-card">
      <div class="pcb-drc-header">
        <h4 class="pcb-card-title">Estimasi Biaya Manufaktur</h4>
        <span class="pcb-badge pcb-badge-ok font-mono">~${bomCostEstimate.totalCostUsd} USD</span>
      </div>
      <p class="pcb-card-desc">Estimasi order prototipe 5 keping PCB (JLCPCB) + komponen.</p>
      <div class="pcb-stat-row">
        <span>Luas Substrat FR-4:</span>
        <span class="pcb-stat-val">{bomCostEstimate.areaCm2} cm²</span>
      </div>
      <div class="pcb-stat-row">
        <span>Cetak PCB (5 keping):</span>
        <span class="pcb-stat-val">${bomCostEstimate.pcbFabCostUsd} USD</span>
      </div>
      <div class="pcb-stat-row">
        <span>Komponen BOM:</span>
        <span class="pcb-stat-val">${bomCostEstimate.componentsCostUsd} USD</span>
      </div>
      <div class="pcb-stat-row">
        <span>Waktu Fabrikasi:</span>
        <span class="pcb-stat-val" style="color: #38bdf8;">{bomCostEstimate.leadTimeDays}</span>
      </div>
    </div>

    <!-- Section 6: Export Action Button -->
    <div class="pcb-card pcb-card-action">
      <button on:click={() => dispatch('open-export')} class="pcb-btn pcb-btn-export pcb-btn-full pcb-btn-lg">
        <span>📦</span>
        <span>Ekspor Gerber & EasyEDA</span>
      </button>
    </div>
  </div>
</aside>

<style>
  .pcb-inspector {
    width: 290px;
    background: #0b0f19;
    border-left: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    z-index: 45;
  }
  .pcb-inspector-head {
    height: 44px;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    flex-shrink: 0;
  }
  .pcb-insp-title {
    font-size: 11px;
    font-weight: 800;
    color: #38bdf8;
    letter-spacing: 0.8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pcb-insp-close {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 15px;
    cursor: pointer;
    padding: 4px;
  }
  .pcb-insp-close:hover { color: #f1f5f9; }
  .pcb-inspector-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .pcb-card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 12px;
  }
  .pcb-card-title {
    font-size: 11.5px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 2px 0;
  }
  .pcb-card-desc {
    font-size: 10px;
    color: #64748b;
    margin: 0 0 8px 0;
  }
  .pcb-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .pcb-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .pcb-field-lbl {
    font-size: 10px;
    color: #94a3b8;
    font-weight: 600;
  }
  .pcb-input {
    background: #0b0f19;
    border: 1px solid #334155;
    border-radius: 5px;
    color: #f1f5f9;
    padding: 4px 7px;
    font-size: 11.5px;
    font-weight: 600;
    outline: none;
    width: 100%;
  }
  .pcb-input:focus { border-color: #38bdf8; }

  .pcb-toggle-row {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  .pcb-toggle-lbl {
    font-size: 10.5px;
    color: #cbd5e1;
  }
  .pcb-chk {
    accent-color: #0284c7;
    cursor: pointer;
  }

  .pcb-selected-box {
    background: #0b0f19;
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 8px 10px;
  }
  .pcb-sel-name {
    font-size: 12px;
    font-weight: 700;
    color: #38bdf8;
    margin-bottom: 2px;
  }
  .pcb-sel-meta {
    font-size: 10px;
    color: #94a3b8;
    margin-bottom: 2px;
  }
  .pcb-empty-hint {
    font-size: 10.5px;
    color: #64748b;
    font-style: italic;
    line-height: 1.4;
    text-align: center;
    padding: 10px 4px;
  }

  .pcb-stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #cbd5e1;
    margin-bottom: 5px;
  }
  .pcb-stat-val {
    font-weight: 700;
    color: #f8fafc;
  }

  .pcb-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #334155;
    background: #1e293b;
    color: #cbd5e1;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
  }
  .pcb-btn:hover { background: #334155; color: #fff; }
  .pcb-btn-full { width: 100%; margin-top: 6px; }
  .pcb-btn-danger {
    background: #450a0a;
    border-color: #ef4444;
    color: #fca5a5;
  }
  .pcb-btn-danger:hover { background: #7f1d1d; color: #fff; }
  .pcb-btn-export {
    background: #065f46;
    border-color: #059669;
    color: #6ee7b7;
    font-weight: 700;
  }
  .pcb-btn-export:hover { background: #059669; color: #fff; }
  .pcb-btn-lg { padding: 9px 16px; font-size: 12px; }

  /* DRC Badges & List */
  .pcb-drc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .pcb-badge {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
  }
  .pcb-badge-ok { background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid #4ade80; }
  .pcb-badge-warn { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid #f59e0b; }
  .pcb-drc-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 6px;
  }
  .pcb-drc-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 5px;
    font-size: 10.5px;
    line-height: 1.35;
  }
  .pcb-drc-clickable {
    cursor: pointer;
    transition: all 0.12s;
  }
  .pcb-drc-clickable:hover {
    transform: translateX(2px);
    filter: brightness(1.15);
  }
  .pcb-drc-err { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; }
  .pcb-drc-warn { background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); color: #fde047; }
  .pcb-drc-clean-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 10.5px;
    color: #6ee7b7;
    margin-top: 6px;
  }
  .font-mono { font-family: monospace; }
</style>
