<script>
  import { createEventDispatcher } from 'svelte'
  import { CIRCUIT_SNIPPETS } from '$lib/data/circuit-snippets.js'

  export let show = false
  const dispatch = createEventDispatcher()

  let selectedSnippet = CIRCUIT_SNIPPETS[0]

  function close() {
    show = false
    dispatch('close')
  }

  function handleInsert(snippet) {
    dispatch('insert-snippet', snippet)
    close()
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="snp-modal-backdrop" on:click={close}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
    <div class="snp-modal-box" on:click|stopPropagation role="dialog" aria-label="Sub-Circuit Modular Snippets" tabindex="-1">
      <div class="snp-modal-head">
        <div class="snp-modal-title">
          <span>🧩</span>
          <span>Pustaka Modul Sub-Sirkuit Siap Pakai (Circuit Snippets)</span>
        </div>
        <button on:click={close} class="snp-modal-close" aria-label="Tutup">✕</button>
      </div>

      <div class="snp-modal-body">
        <p class="snp-desc">
          Sisipkan blok rangkaian standar industri (sub-circuit) langsung ke diagram Anda tanpa perlu menyusun komponen dan kabel satu per satu.
        </p>

        <div class="snp-layout">
          <!-- Snippet List -->
          <div class="snp-list">
            {#each CIRCUIT_SNIPPETS as s}
              <button
                class="snp-card-btn"
                class:card-active={selectedSnippet.id === s.id}
                on:click={() => (selectedSnippet = s)}
              >
                <span class="snp-card-icon">{s.icon}</span>
                <div class="snp-card-info">
                  <div class="snp-card-name">{s.name}</div>
                  <div class="snp-card-cat">{s.category} • {s.components.length} Komponen</div>
                </div>
              </button>
            {/each}
          </div>

          <!-- Preview & Action Panel -->
          <div class="snp-preview-pane">
            {#if selectedSnippet}
              <div class="snp-prev-head">
                <span class="snp-prev-icon">{selectedSnippet.icon}</span>
                <div>
                  <h3 class="snp-prev-title">{selectedSnippet.name}</h3>
                  <span class="snp-prev-badge">{selectedSnippet.category}</span>
                </div>
              </div>

              <p class="snp-prev-desc">{selectedSnippet.desc}</p>

              <div class="snp-comp-specs">
                <div class="spec-label">Daftar Komponen Termasuk:</div>
                <ul class="spec-ul">
                  {#each selectedSnippet.components as c}
                    <li>
                      <strong>{c.name}</strong> 
                      {#if c.props?.value}<span class="spec-val">({c.props.value})</span>{/if}
                    </li>
                  {/each}
                </ul>
                <div class="spec-label" style="margin-top: 10px;">Interkoneksi Kabel:</div>
                <div class="spec-count">{selectedSnippet.wires.length} kabel pre-routed terhubung otomatis</div>
              </div>

              <button on:click={() => handleInsert(selectedSnippet)} class="btn-insert-snp">
                <span>➕ Sisipkan ke Diagram Kanvas</span>
              </button>
            {/if}
          </div>
        </div>
      </div>

      <div class="snp-modal-foot">
        <button on:click={close} class="snp-btn-close">Batal</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .snp-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .snp-modal-box {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    width: 100%;
    max-width: 760px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    color: #f1f5f9;
    overflow: hidden;
  }

  .snp-modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
  }

  .snp-modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    color: #38bdf8;
  }

  .snp-modal-close {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 16px;
    cursor: pointer;
  }
  .snp-modal-close:hover { color: #ffffff; }

  .snp-modal-body {
    padding: 20px;
  }

  .snp-desc {
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 16px;
  }

  .snp-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 16px;
    min-height: 290px;
  }

  .snp-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    max-height: 320px;
    padding-right: 6px;
  }

  .snp-card-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #cbd5e1;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .snp-card-btn:hover {
    background: #253349;
    border-color: #38bdf8;
    color: #ffffff;
  }

  .snp-card-btn.card-active {
    background: rgba(56, 189, 248, 0.12);
    border-color: #38bdf8;
    color: #ffffff;
  }

  .snp-card-icon {
    font-size: 22px;
  }

  .snp-card-name {
    font-size: 13px;
    font-weight: 600;
  }

  .snp-card-cat {
    font-size: 10px;
    color: #64748b;
    margin-top: 2px;
  }

  .snp-preview-pane {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .snp-prev-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .snp-prev-icon {
    font-size: 32px;
  }

  .snp-prev-title {
    font-size: 16px;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .snp-prev-badge {
    display: inline-block;
    font-size: 10px;
    background: #0284c7;
    color: #ffffff;
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 4px;
    text-transform: uppercase;
    font-weight: 700;
  }

  .snp-prev-desc {
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.5;
    margin-bottom: 14px;
  }

  .snp-comp-specs {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .spec-label {
    font-size: 11px;
    font-weight: 700;
    color: #cbd5e1;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .spec-ul {
    list-style: square inside;
    font-size: 12px;
    color: #94a3b8;
    margin: 0;
    padding-left: 4px;
  }

  .spec-val {
    color: #10b981;
    font-family: monospace;
    font-weight: bold;
  }

  .spec-count {
    font-size: 11px;
    color: #38bdf8;
  }

  .btn-insert-snp {
    padding: 10px 18px;
    background: #0284c7;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .btn-insert-snp:hover { background: #0369a1; }

  .snp-modal-foot {
    padding: 12px 20px;
    background: #1e293b;
    border-top: 1px solid #334155;
    display: flex;
    justify-content: flex-end;
  }

  .snp-btn-close {
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 12px;
    background: #334155;
    color: #ffffff;
    border: none;
    cursor: pointer;
  }
  .snp-btn-close:hover { background: #475569; }
</style>
