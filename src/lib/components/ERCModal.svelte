<script>
  import { createEventDispatcher } from 'svelte'

  export let show = false
  export let ercResult = { errors: [], warnings: [], info: [], totalCount: 0 }

  const dispatch = createEventDispatcher()

  function selectIssue(issue) {
    if (issue.wireId) {
      dispatch('selectwire', issue.wireId)
    } else if (issue.compA) {
      dispatch('selectcomp', issue.compA)
    }
    show = false
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={() => show = false}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
    <div class="modal-box" on:click|stopPropagation role="dialog" aria-label="Electrical Rules Check" tabindex="-1">
      <div class="modal-head">
        <div class="head-title">
          <span>⚡ Electrical Rules Check (ERC)</span>
          <span class="badge" class:badge-err={ercResult.errors.length > 0} class:badge-warn={ercResult.warnings.length > 0 && !ercResult.errors.length} class:badge-ok={ercResult.totalCount === 0}>
            {ercResult.totalCount === 0 ? '✓ All Clear' : `${ercResult.totalCount} issues`}
          </span>
        </div>
        <button class="btn-close" on:click={() => show = false}>✕</button>
      </div>

      <div class="modal-body">
        {#if ercResult.totalCount === 0}
          <div class="clean-state">
            <span class="clean-icon">🛡️</span>
            <h3>Rangkaian Bersih (Tidak Ditemukan Isu)</h3>
            <p>Tidak ada korsleting, voltage mismatch 5V/3.3V, ataupun konflik pin UART terdeteksi.</p>
          </div>
        {:else}
          <!-- Error items (Critical) -->
          {#each ercResult.errors as err}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="issue-card card-err" on:click={() => selectIssue(err)}>
              <div class="issue-top">
                <span class="issue-icon">🚨 BAHAYA</span>
                <span class="issue-title">{err.title}</span>
                <span class="jump-hint">Klik untuk sorot →</span>
              </div>
              <p class="issue-desc">{err.desc}</p>
            </div>
          {/each}

          <!-- Warning items -->
          {#each ercResult.warnings as warn}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="issue-card card-warn" on:click={() => selectIssue(warn)}>
              <div class="issue-top">
                <span class="issue-icon">⚠️ PERINGATAN</span>
                <span class="issue-title">{warn.title}</span>
                <span class="jump-hint">Klik untuk sorot →</span>
              </div>
              <p class="issue-desc">{warn.desc}</p>
            </div>
          {/each}

          <!-- Info items -->
          {#each ercResult.info as inf}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="issue-card card-info" on:click={() => selectIssue(inf)}>
              <div class="issue-top">
                <span class="issue-icon">ℹ️ INFO</span>
                <span class="issue-title">{inf.title}</span>
                <span class="jump-hint">Klik untuk sorot →</span>
              </div>
              <p class="issue-desc">{inf.desc}</p>
            </div>
          {/each}
        {/if}
      </div>

      <div class="modal-footer">
        <span class="footer-tip">💡 Tips: Klik pada kartu isu untuk langsung menyorot kabel/komponen di kanvas.</span>
        <button class="btn-done" on:click={() => show = false}>Tutup</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .modal-box {
    background: #14142b; border: 1px solid #353565; border-radius: 10px;
    width: 650px; max-width: 95vw; max-height: 85vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 16px 40px rgba(0,0,0,0.85);
  }
  .modal-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid #252545;
  }
  .head-title {
    display: flex; align-items: center; gap: 10px;
    font: 700 15px -apple-system, sans-serif; color: #facc15;
  }
  .badge {
    font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: 700;
  }
  .badge-err { background: #451010; color: #f87171; border: 1px solid #ef4444; }
  .badge-warn { background: #3b2a05; color: #fbbf24; border: 1px solid #f59e0b; }
  .badge-ok { background: #064e3b; color: #34d399; border: 1px solid #10b981; }

  .btn-close {
    background: transparent; border: none; color: #8888aa;
    font-size: 16px; cursor: pointer; padding: 4px;
  }
  .btn-close:hover { color: #fff; }
  .modal-body {
    padding: 18px; display: flex; flex-direction: column; gap: 12px;
    overflow-y: auto; flex: 1;
  }
  .clean-state {
    text-align: center; padding: 35px 20px; color: #8888aa;
  }
  .clean-icon { font-size: 42px; display: block; margin-bottom: 10px; }
  .clean-state h3 { color: #34d399; font-size: 16px; margin: 0 0 6px; }
  .clean-state p { font-size: 12px; color: #a0a0c0; margin: 0; }

  .issue-card {
    background: #1a1a35; border-radius: 7px; padding: 12px 14px;
    cursor: pointer; transition: all 0.15s;
  }
  .issue-card:hover { transform: translateX(3px); filter: brightness(1.15); }
  .card-err { border-left: 4px solid #ef4444; border: 1px solid #4a1515; border-left-width: 4px; }
  .card-warn { border-left: 4px solid #f59e0b; border: 1px solid #4a3510; border-left-width: 4px; }
  .card-info { border-left: 4px solid #60a5fa; border: 1px solid #1a254a; border-left-width: 4px; }

  .issue-top {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 6px; font-size: 11px;
  }
  .issue-icon {
    font-weight: 800; letter-spacing: 0.5px;
  }
  .card-err .issue-icon { color: #f87171; }
  .card-warn .issue-icon { color: #fbbf24; }
  .card-info .issue-icon { color: #60a5fa; }
  .issue-title { font-weight: 700; color: #fff; font-size: 13px; margin-left: 8px; flex: 1; }
  .jump-hint { color: #707095; font-size: 10px; }
  .issue-desc { margin: 0; font-size: 12px; color: #c0c0e0; line-height: 1.45; }

  .modal-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 18px; border-top: 1px solid #252545; background: #101024;
  }
  .footer-tip { font-size: 11px; color: #707095; }
  .btn-done {
    background: #252550; border: 1px solid #3b82f6; border-radius: 5px;
    padding: 6px 16px; color: #fff; font-weight: 600; cursor: pointer; font-size: 12px;
  }
  .btn-done:hover { background: #303070; }
</style>

