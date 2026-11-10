<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import { components, wires, labels, sheetConfig, loadDiagram, pushHistory } from '$lib/store/diagram.js'
  import { showConfirm, showPrompt } from '$lib/store/dialog.js'

  export let show = false
  export let projectName = 'CircuitCraft_Project'

  const dispatch = createEventDispatcher()
  let snapshots = []

  function getStorageKey() {
    return `wiretool_snapshots_${projectName || 'default'}`
  }

  function loadSnapshots() {
    try {
      const raw = localStorage.getItem(getStorageKey())
      snapshots = raw ? JSON.parse(raw) : []
    } catch {
      snapshots = []
    }
  }

  $: if (show) {
    loadSnapshots()
  }

  async function createSnapshot() {
    const defaultTag = `Rev ${snapshots.length + 1}.0`
    const note = await showPrompt({
      title: 'Simpan Snapshot Revisi Baru',
      message: 'Masukkan nama atau catatan revisi untuk snapshot ini:',
      defaultValue: defaultTag,
      placeholder: 'Contoh: Rev 1.2 - Selesai Wiring Sensor...',
      icon: '📸'
    })

    if (note === null) return

    const newSnapshot = {
      id: 'snap-' + Date.now(),
      tag: note.trim() || defaultTag,
      timestamp: new Date().toISOString(),
      compCount: $components.length,
      wireCount: $wires.length,
      data: {
        project: projectName,
        components: $components,
        wires: $wires,
        labels: $labels,
        sheetConfig: $sheetConfig
      }
    }

    snapshots = [newSnapshot, ...snapshots]
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(snapshots))
    } catch (err) {
      console.warn('Failed to save snapshot:', err)
    }
  }

  async function restoreSnapshot(snap) {
    const ok = await showConfirm({
      title: 'Pulihkan Snapshot Revisi?',
      message: `Pulihkan proyek ke "${snap.tag}" (${snap.compCount} komponen, ${snap.wireCount} kabel)?\nDiagram kanvas saat ini akan digantikan.`,
      confirmText: 'Ya, Pulihkan Versi Ini',
      cancelText: 'Batal',
      icon: '↩'
    })

    if (!ok) return

    pushHistory()
    loadDiagram(snap.data)
    dispatch('restored', snap.tag)
    show = false
  }

  async function deleteSnapshot(id) {
    const ok = await showConfirm({
      title: 'Hapus Snapshot?',
      message: 'Snapshot revisi ini akan dihapus permanen.',
      confirmText: 'Hapus',
      cancelText: 'Batal',
      danger: true,
      icon: '🗑️'
    })

    if (!ok) return

    snapshots = snapshots.filter(s => s.id !== id)
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(snapshots))
    } catch {}
  }

  function formatTime(isoStr) {
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    } catch {
      return isoStr
    }
  }

  function close() {
    show = false
    dispatch('close')
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={close}>
    <div class="modal-card" on:click|stopPropagation role="dialog" aria-label="Version history snapshots" tabindex="-1">
      <div class="modal-head">
        <div class="head-title">
          <span class="head-icon">📜</span>
          <div>
            <h3>Riwayat Versi & Snapshot Proyek</h3>
            <p class="head-desc">Simpan checkpoint revisi dan pulihkan kapan saja tanpa kehilangan pekerjaan.</p>
          </div>
        </div>
        <button class="close-btn" on:click={close}>✕</button>
      </div>

      <div class="action-bar">
        <button class="btn btn-pri" on:click={createSnapshot}>
          <span>📸</span>
          <span>Ambil Snapshot Revisi Baru</span>
        </button>
        <span class="snap-count">{snapshots.length} Snapshot Tersimpan</span>
      </div>

      <div class="snapshot-list">
        {#if snapshots.length === 0}
          <div class="empty-box">
            <span class="empty-icon">📂</span>
            <div class="empty-txt">Belum ada snapshot tersimpan untuk proyek ini.</div>
            <p class="empty-sub">Klik tombol "Ambil Snapshot Revisi Baru" di atas untuk menyimpan titik riwayat desain Anda.</p>
          </div>
        {:else}
          {#each snapshots as snap (snap.id)}
            <div class="snap-item">
              <div class="snap-info">
                <div class="snap-title-row">
                  <span class="snap-badge">REV</span>
                  <span class="snap-tag">{snap.tag}</span>
                  <span class="snap-time">{formatTime(snap.timestamp)}</span>
                </div>
                <div class="snap-meta">
                  <span>🧩 {snap.compCount} Komponen</span>
                  <span>•</span>
                  <span>⚡ {snap.wireCount} Kabel / Net</span>
                </div>
              </div>
              <div class="snap-actions">
                <button class="btn btn-restore" on:click={() => restoreSnapshot(snap)} title="Pulihkan kanvas ke versi ini">
                  <span>↩</span>
                  <span>Pulihkan</span>
                </button>
                <button class="btn-del" on:click={() => deleteSnapshot(snap.id)} title="Hapus snapshot">
                  🗑️
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <div class="modal-footer">
        <span class="footer-note">💡 Tip: Snapshot disimpan aman di penyimpanan lokal (LocalStorage) browser Anda.</span>
        <button class="btn btn-sec" on:click={close}>Tutup</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(5px); z-index: 9500;
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .modal-card {
    background: #0f172a; border: 1px solid #334155; border-radius: 12px;
    width: 100%; max-width: 580px; max-height: 85vh;
    display: flex; flex-direction: column;
    box-shadow: 0 24px 60px rgba(0,0,0,0.85); animation: pop .12s ease-out;
  }
  @keyframes pop {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }
  .modal-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid #1e293b;
  }
  .head-title { display: flex; align-items: center; gap: 12px; }
  .head-icon { font-size: 22px; }
  .head-title h3 { font-size: 15px; font-weight: 700; color: #f8fafc; }
  .head-desc { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .close-btn { background: none; border: none; color: #94a3b8; font-size: 15px; cursor: pointer; padding: 4px; }
  .close-btn:hover { color: #fff; }

  .action-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 18px; background: rgba(30, 41, 59, 0.4); border-bottom: 1px solid #1e293b;
  }
  .snap-count { font-size: 11px; color: #94a3b8; font-weight: 600; }

  .snapshot-list {
    flex: 1; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px;
  }
  .empty-box {
    text-align: center; padding: 36px 16px; color: #64748b;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
  }
  .empty-icon { font-size: 32px; opacity: 0.7; }
  .empty-txt { font-weight: 600; font-size: 13px; color: #94a3b8; }
  .empty-sub { font-size: 11px; max-width: 340px; }

  .snap-item {
    background: #1e293b; border: 1px solid #334155; border-radius: 8px;
    padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;
    transition: all .12s;
  }
  .snap-item:hover { border-color: #38bdf8; background: #243247; }
  .snap-info { display: flex; flex-direction: column; gap: 4px; }
  .snap-title-row { display: flex; align-items: center; gap: 8px; }
  .snap-badge {
    background: #0284c7; color: #fff; font-size: 9px; font-weight: 800;
    padding: 1px 5px; border-radius: 3px; font-family: monospace;
  }
  .snap-tag { font-size: 13px; font-weight: 700; color: #ffffff; }
  .snap-time { font-size: 11px; color: #94a3b8; }
  .snap-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #cbd5e1; }

  .snap-actions { display: flex; align-items: center; gap: 8px; }

  .btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
    border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;
    border: 1px solid transparent; transition: all .12s;
  }
  .btn-pri { background: #0284c7; color: #fff; border-color: #0369a1; }
  .btn-pri:hover { background: #0369a1; }
  .btn-restore { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); }
  .btn-restore:hover { background: #0284c7; color: #fff; border-color: #0284c7; }
  .btn-sec { background: #1e293b; color: #cbd5e1; border-color: #334155; }
  .btn-sec:hover { background: #334155; color: #fff; }
  .btn-del {
    background: none; border: none; font-size: 14px; cursor: pointer; opacity: 0.6; padding: 4px;
  }
  .btn-del:hover { opacity: 1; transform: scale(1.1); }

  .modal-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 18px; border-top: 1px solid #1e293b; background: rgba(15, 23, 42, 0.8);
  }
  .footer-note { font-size: 10.5px; color: #64748b; }
</style>