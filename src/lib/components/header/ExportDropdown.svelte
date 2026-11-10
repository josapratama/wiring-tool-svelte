<script>
  import { createEventDispatcher } from 'svelte'

  export let show = false
  const dispatch = createEventDispatcher()

  function selectAction(type) {
    dispatch('action', type)
    show = false
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="export-dropdown" on:click|stopPropagation>
    <div class="dd-title">Pilih Format Ekspor</div>
    
    <button class="dd-item" on:click={() => selectAction('pcb-export')}>
      <span class="dd-icon">📦</span>
      <div class="dd-info">
        <span class="dd-label">Ekspor Fabrikasi PCB (Gerber RS-274X)</span>
        <span class="dd-desc">Arsip ZIP standar JLCPCB / PCBWay</span>
      </div>
    </button>

    <div class="dd-divider"></div>

    <button class="dd-item" on:click={() => selectAction('png')}>
      <span class="dd-icon">🖼</span>
      <div class="dd-info">
        <span class="dd-label">Gambar High-Res (PNG)</span>
        <span class="dd-desc">Untuk dokumentasi skema atau laporan</span>
      </div>
    </button>

    <button class="dd-item" on:click={() => selectAction('svg')}>
      <span class="dd-icon">📐</span>
      <div class="dd-info">
        <span class="dd-label">Vector Graphic (SVG)</span>
        <span class="dd-desc">Grafik vektor tajam tanpa pecah</span>
      </div>
    </button>

    <button class="dd-item" on:click={() => selectAction('json')}>
      <span class="dd-icon">💾</span>
      <div class="dd-info">
        <span class="dd-label">Diagram JSON (.json)</span>
        <span class="dd-desc">Simpan untuk diedit kembali nanti</span>
      </div>
    </button>

    <button class="dd-item" on:click={() => selectAction('doc-pack')}>
      <span class="dd-icon">📑</span>
      <div class="dd-info">
        <span class="dd-label">Dokumen Fabrikasi Lengkap (PDF Pack)</span>
        <span class="dd-desc">Cover, Skematik, PCB Layout & Tabel BOM</span>
      </div>
    </button>

    <button class="dd-item" on:click={() => selectAction('print')}>
      <span class="dd-icon">🖨</span>
      <div class="dd-info">
        <span class="dd-label">Cetak Skematik (Print PDF)</span>
        <span class="dd-desc">Cetak lembar skematik lanskap A4/A3</span>
      </div>
    </button>

    <button class="dd-item" on:click={() => selectAction('share')}>
      <span class="dd-icon">🔗</span>
      <div class="dd-info">
        <span class="dd-label">Bagikan Tautan Link Proyek</span>
        <span class="dd-desc">Salin URL instan untuk dibuka siapa saja</span>
      </div>
    </button>

    <button class="dd-item" on:click={() => selectAction('wokwi')}>
      <span class="dd-icon">🚀</span>
      <div class="dd-info">
        <span class="dd-label">Wokwi Simulator JSON</span>
        <span class="dd-desc">Jalankan simulasi langsung di browser</span>
      </div>
    </button>

    <div class="dd-divider"></div>

    <button class="dd-item" on:click={() => selectAction('netlist')}>
      <span class="dd-icon">🔌</span>
      <div class="dd-info">
        <span class="dd-label">Netlist Connections (CSV)</span>
        <span class="dd-desc">Daftar koneksi antar-pin dan kabel</span>
      </div>
    </button>

    <button class="dd-item" on:click={() => selectAction('bom')}>
      <span class="dd-icon">📋</span>
      <div class="dd-info">
        <span class="dd-label">Maker BOM & Fab Estimator</span>
        <span class="dd-desc">Kalkulator part JLCPCB, footprint & estimasi biaya</span>
      </div>
    </button>
  </div>
{/if}

<style>
  .export-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    width: 250px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.06);
    padding: 6px;
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
  .dd-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #64748b;
    padding: 6px 8px 4px;
  }
  .dd-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #f1f5f9;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
    width: 100%;
  }
  .dd-item:hover {
    background: #1e293b;
  }
  .dd-icon {
    font-size: 15px;
    width: 20px;
    text-align: center;
    flex-shrink: 0;
  }
  .dd-info {
    display: flex;
    flex-direction: column;
  }
  .dd-label {
    font-size: 11.5px;
    font-weight: 600;
    color: #e2e8f0;
  }
  .dd-desc {
    font-size: 10px;
    color: #94a3b8;
  }
  .dd-divider {
    height: 1px;
    background: #1e293b;
    margin: 4px 0;
  }
</style>

