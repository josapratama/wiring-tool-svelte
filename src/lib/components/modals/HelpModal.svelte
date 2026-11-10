<script>
  import { createEventDispatcher } from 'svelte'

  export let show = false
  const dispatch = createEventDispatcher()

  const SHORTCUTS = [
    { key: 'Ctrl + Z',       desc: 'Undo aksi terakhir' },
    { key: 'Ctrl + Y',       desc: 'Redo aksi sebelumnya' },
    { key: 'Ctrl + S',       desc: 'Simpan diagram ke file JSON' },
    { key: 'Ctrl + O',       desc: 'Buka / muat diagram JSON' },
    { key: 'Ctrl + K',       desc: 'Buka palet pencarian cepat komponen' },
    { key: 'R',              desc: 'Putar komponen 90 derajat searah jarum jam' },
    { key: 'X',              desc: 'Flip horizontal (cermin sumbu X)' },
    { key: 'Y',              desc: 'Flip vertical (cermin sumbu Y)' },
    { key: 'W',              desc: 'Mode Wire (Tarik jalur kabel baru)' },
    { key: 'T',              desc: 'Mode Label (Tambah teks anotasi)' },
    { key: 'G',              desc: 'Ganti mode grid (Dots / Lines / Off)' },
    { key: 'M',              desc: 'Tampilkan / sembunyikan radar minimap' },
    { key: 'F',              desc: 'Fit view (Pusatkan kanvas ke seluruh komponen)' },
    { key: 'Shift + G',      desc: 'Pasang Net Port GND instan' },
    { key: 'P',              desc: 'Pasang Net Port VCC (+5V) instan' },
    { key: 'Delete / Backsp',desc: 'Hapus kabel atau komponen yang dipilih' },
    { key: 'Esc',            desc: 'Batalkan penarikan kabel / tutup modal' },
    { key: '?',              desc: 'Buka jendela bantuan shortcut ini' }
  ]

  function close() {
    show = false
    dispatch('close')
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay-backdrop" on:click={close}>
    <!-- svelte-ignore a11y-interactive-supports-focus -->
    <div class="overlay-box" on:click|stopPropagation role="dialog" aria-label="Keyboard shortcuts" tabindex="-1">
      <div class="ov-head">
        <span>⌨ Keyboard Shortcuts</span>
        <button class="ov-close" on:click={close}>✕</button>
      </div>

      <div class="shortcut-grid">
        {#each SHORTCUTS as sc}
          <kbd class="sc-key">{sc.key}</kbd>
          <span class="sc-desc">{sc.desc}</span>
        {/each}
      </div>

      <div class="ov-footer">Tekan <kbd class="sc-key">?</kbd> atau <kbd class="sc-key">Esc</kbd> untuk menutup</div>
    </div>
  </div>
{/if}

<style>
  .overlay-backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); z-index: 8000;
    backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;
  }
  .overlay-box {
    background: #0f172a; border: 1px solid #334155; border-radius: 10px;
    padding: 20px; min-width: 360px; max-width: 520px; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
  }
  .ov-head {
    font: 700 14px/1 sans-serif; color: #38bdf8; margin-bottom: 16px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .ov-close {
    background: none; border: none; color: #64748b; cursor: pointer; font-size: 15px;
  }
  .ov-close:hover { color: #f1f5f9; }
  .shortcut-grid {
    display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; align-items: center;
    max-height: 60vh; overflow-y: auto; padding-right: 4px;
  }
  .sc-key {
    background: #030712; border: 1px solid #334155; border-radius: 4px;
    padding: 3px 8px; font: 600 11px 'Consolas', monospace; color: #38bdf8; white-space: nowrap;
  }
  .sc-desc { font-size: 11.5px; color: #cbd5e1; }
  .ov-footer { margin-top: 14px; font-size: 11px; color: #64748b; text-align: center; }
</style>

