<script>
  import { createEventDispatcher } from 'svelte'

  export let show = false
  const dispatch = createEventDispatcher()

  function selectExport(type) {
    dispatch('export', type)
  }

  function close() {
    show = false
    dispatch('close')
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="pcb-modal-backdrop" on:click={close}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
    <div class="pcb-modal-box" on:click|stopPropagation role="dialog" aria-label="Ekspor Fabrikasi PCB" tabindex="-1">
      <div class="pcb-modal-head">
        <div class="pcb-modal-title">
          <span>📦</span>
          <span>Ekspor Fabrikasi PCB (Gerber RS-274X & CAD)</span>
        </div>
        <button on:click={close} class="pcb-modal-close">✕</button>
      </div>

      <div class="pcb-modal-body">
        <p class="pcb-modal-desc">
          Pilih format file fabrikasi standar industri untuk memproduksi papan sirkuit Anda di pabrik JLCPCB, PCBWay, OSHPark, atau EasyEDA:
        </p>

        <!-- Option 1: Gerber ZIP -->
        <div class="pcb-export-option pcb-export-option-pri">
          <div class="pcb-opt-icon">🏭</div>
          <div class="pcb-opt-content">
            <h4 class="pcb-opt-title">Paket Gerber RS-274X & Excellon Drill (ZIP)</h4>
            <p class="pcb-opt-desc">
              Arsip file lengkap (.GTL, .GBL, .GTS, .GBS, .GTO, .GBO, .DRL, .GKO) standar JLCPCB & PCBWay.
            </p>
            <button on:click={() => selectExport('gerber-zip')} class="pcb-btn pcb-btn-pri pcb-opt-btn">
              <span>Unduh Arsip Gerber RS-274X (.zip)</span>
            </button>
          </div>
        </div>

        <!-- Option 2: EasyEDA PCB -->
        <div class="pcb-export-option">
          <div class="pcb-opt-icon">⚡</div>
          <div class="pcb-opt-content">
            <h4 class="pcb-opt-title">Dokumen EasyEDA PCB Layout (.json)</h4>
            <p class="pcb-opt-desc">
              Format native EasyEDA CAD untuk diimpor dan diedit kembali di EasyEDA Editor online/desktop.
            </p>
            <button on:click={() => selectExport('easyeda-json')} class="pcb-btn pcb-opt-btn">
              <span>Unduh EasyEDA PCB (.json)</span>
            </button>
          </div>
        </div>

        <!-- Option 3: SVG Masks -->
        <div class="pcb-export-option">
          <div class="pcb-opt-icon">📐</div>
          <div class="pcb-opt-content">
            <h4 class="pcb-opt-title">Masker Cetak SVG (DIY Etching & Toner Transfer)</h4>
            <p class="pcb-opt-desc">
              Vektor hitam-putih resolusi tinggi 1:1 untuk cetak PCB mandiri (DIY sablon / transfer pcb).
            </p>
            <div class="pcb-export-btn-row">
              <button on:click={() => selectExport('svg-top')} class="pcb-btn pcb-opt-btn">Top Layer (F.Cu)</button>
              <button on:click={() => selectExport('svg-bottom')} class="pcb-btn pcb-opt-btn">Bottom Layer (B.Cu)</button>
            </div>
          </div>
        </div>
      </div>

      <div class="pcb-modal-footer">
        <button on:click={close} class="pcb-btn">Tutup</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .pcb-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .pcb-modal-box {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 10px;
    width: 640px;
    max-width: 95vw;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
  }
  .pcb-modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: #0b0f19;
    border-bottom: 1px solid #1e293b;
  }
  .pcb-modal-title {
    font-size: 13px;
    font-weight: 700;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pcb-modal-close {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
  }
  .pcb-modal-close:hover { color: #f1f5f9; }
  .pcb-modal-body {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 70vh;
    overflow-y: auto;
  }
  .pcb-modal-desc {
    font-size: 11.5px;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }
  .pcb-export-option {
    display: flex;
    gap: 12px;
    background: #0b0f19;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 12px 14px;
  }
  .pcb-export-option-pri {
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.05);
  }
  .pcb-opt-icon { font-size: 24px; line-height: 1; }
  .pcb-opt-content { flex: 1; }
  .pcb-opt-title { font-size: 12px; font-weight: 700; color: #f1f5f9; margin: 0 0 3px 0; }
  .pcb-opt-desc { font-size: 10.5px; color: #94a3b8; line-height: 1.4; margin: 0 0 8px 0; }
  .pcb-export-btn-row { display: flex; gap: 8px; }

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
  .pcb-btn-pri {
    background: #059669;
    border-color: #10b981;
    color: #ffffff;
    font-weight: 700;
  }
  .pcb-btn-pri:hover { background: #10b981; }

  .pcb-modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 10px 18px;
    background: #0b0f19;
    border-top: 1px solid #1e293b;
  }
</style>
