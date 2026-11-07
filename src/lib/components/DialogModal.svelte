<script>
  import { tick } from 'svelte'
  import { dialogState } from '../store/dialog.js'

  let inputEl = null
  let inputVal = ''

  // Keep local input in sync whenever prompt opens
  $: if ($dialogState.isOpen) {
    inputVal = $dialogState.inputValue || ''
    if ($dialogState.type === 'prompt') {
      tick().then(() => {
        if (inputEl) {
          inputEl.focus()
          inputEl.select()
        }
      })
    }
  }

  function handleConfirm() {
    if (!$dialogState.isOpen) return
    const resolve = $dialogState.resolve
    if (resolve) {
      if ($dialogState.type === 'prompt') {
        resolve(inputVal)
      } else {
        resolve(true)
      }
    }
    dialogState.update(s => ({ ...s, isOpen: false }))
  }

  function handleCancel() {
    if (!$dialogState.isOpen) return
    const resolve = $dialogState.resolve
    if (resolve) {
      if ($dialogState.type === 'prompt') {
        resolve(null)
      } else if ($dialogState.type === 'confirm') {
        resolve(false)
      } else {
        resolve(true)
      }
    }
    dialogState.update(s => ({ ...s, isOpen: false }))
  }

  function handleWindowKeydown(e) {
    if (!$dialogState.isOpen) return
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    } else if (e.key === 'Enter' && $dialogState.type !== 'alert') {
      // If pressing enter in prompt or confirm dialog
      if (e.target && e.target.tagName === 'BUTTON' && e.target.classList.contains('btn-cancel')) {
        return // allow cancelling if focused on cancel button
      }
      e.preventDefault()
      handleConfirm()
    }
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

{#if $dialogState.isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="dialog-backdrop" on:click={handleCancel}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
    <div
      class="dialog-box"
      class:dialog-danger={$dialogState.danger}
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
      aria-label={$dialogState.title}
      tabindex="-1"
    >
      <div class="dialog-header">
        <div class="dialog-title-wrap">
          <span class="dialog-icon">{$dialogState.icon || '💬'}</span>
          <h3 class="dialog-title">{$dialogState.title}</h3>
        </div>
        <button class="btn-close" on:click={handleCancel} title="Tutup (Esc)">✕</button>
      </div>

      <div class="dialog-body">
        {#if $dialogState.message}
          <div class="dialog-message">
            {#each $dialogState.message.split('\n') as line}
              {#if line.trim().startsWith('•')}
                <div class="bullet-line">{line.trim()}</div>
              {:else if line.trim()}
                <p>{line}</p>
              {/if}
            {/each}
          </div>
        {/if}

        {#if $dialogState.type === 'prompt'}
          <div class="dialog-input-wrap">
            <input
              bind:this={inputEl}
              bind:value={inputVal}
              type="text"
              class="dialog-input"
              placeholder={$dialogState.inputPlaceholder || 'Ketik di sini...'}
            />
          </div>
        {/if}
      </div>

      <div class="dialog-footer">
        {#if $dialogState.type === 'confirm' || $dialogState.type === 'prompt'}
          <button class="btn-cancel" on:click={handleCancel}>
            {$dialogState.cancelText || 'Batal'}
          </button>
          <button
            class="btn-confirm"
            class:btn-danger={$dialogState.danger}
            on:click={handleConfirm}
          >
            {$dialogState.confirmText || 'Lanjutkan'}
          </button>
        {:else}
          <button class="btn-confirm btn-ok" on:click={handleConfirm}>
            {$dialogState.confirmText || 'Mengerti'}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(15, 23, 42, 0.72);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: fadeIn 0.15s ease-out;
  }

  .dialog-box {
    width: 100%;
    max-width: 440px;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #f1f5f9;
    outline: none;
    animation: scaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-box.dialog-danger {
    border-color: rgba(239, 68, 68, 0.4);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .dialog-title-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .dialog-icon {
    font-size: 20px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .dialog-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #f8fafc;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 16px;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }
  .btn-close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
  }

  .dialog-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-height: 70vh;
    overflow-y: auto;
  }

  .dialog-message {
    font-size: 13.5px;
    line-height: 1.6;
    color: #cbd5e1;
  }

  .dialog-message p {
    margin: 0 0 8px 0;
  }
  .dialog-message p:last-child {
    margin-bottom: 0;
  }

  .bullet-line {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    padding: 6px 10px;
    margin-bottom: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    color: #38bdf8;
  }

  .dialog-input-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .dialog-input {
    width: 100%;
    padding: 10px 14px;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    color: #f8fafc;
    font-size: 14px;
    box-sizing: border-box;
    outline: none;
    transition: all 0.15s ease;
  }
  .dialog-input:focus {
    border-color: #38bdf8;
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
  }

  .dialog-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(15, 23, 42, 0.35);
  }

  .btn-cancel {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 13px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  .btn-confirm {
    padding: 8px 18px;
    background: linear-gradient(135deg, #0284c7, #2563eb);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
    transition: all 0.15s ease;
  }
  .btn-confirm:hover {
    background: linear-gradient(135deg, #0369a1, #1d4ed8);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45);
  }
  .btn-confirm.btn-danger {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.35);
  }
  .btn-confirm.btn-danger:hover {
    background: linear-gradient(135deg, #b91c1c, #991b1b);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.45);
  }
  .btn-ok {
    min-width: 90px;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Light theme integration */
  :global(.light-app) .dialog-box {
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.12);
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
    color: #0f172a;
  }
  :global(.light-app) .dialog-header {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    background: #f8fafc;
  }
  :global(.light-app) .dialog-title {
    color: #0f172a;
  }
  :global(.light-app) .dialog-message {
    color: #475569;
  }
  :global(.light-app) .bullet-line {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #0284c7;
  }
  :global(.light-app) .dialog-input {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #0f172a;
  }
  :global(.light-app) .dialog-footer {
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    background: #f8fafc;
  }
  :global(.light-app) .btn-cancel {
    background: #e2e8f0;
    border-color: #cbd5e1;
    color: #334155;
  }
  :global(.light-app) .btn-cancel:hover {
    background: #cbd5e1;
    color: #0f172a;
  }
  :global(.light-app) .btn-close {
    color: #64748b;
  }
  :global(.light-app) .btn-close:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
</style>
