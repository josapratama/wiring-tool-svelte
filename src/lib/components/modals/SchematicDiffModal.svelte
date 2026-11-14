<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import { components, wires, labels, sheetConfig, loadDiagram, pushHistory } from '$lib/store/diagram.js'
  import { showConfirm } from '$lib/store/dialog.js'

  export let show = false
  export let projectName = 'CircuitCraft_Project'
  export let initialSnapshotId = null

  const dispatch = createEventDispatcher()
  let snapshots = []
  let selectedSnapId = null
  let activeTab = 'all' // 'all' | 'components' | 'wires'
  let copied = false

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
    if (initialSnapshotId && snapshots.some(s => s.id === initialSnapshotId)) {
      selectedSnapId = initialSnapshotId
    } else if (snapshots.length > 0 && !selectedSnapId) {
      selectedSnapId = snapshots[0].id
    }
  }

  // ── Resolve Selected Baseline Snapshot ────────────────────────────────────
  $: selectedSnap = snapshots.find(s => s.id === selectedSnapId) ?? null

  // ── Compute Schematic Diff ────────────────────────────────────────────────
  $: diffResult = (() => {
    if (!selectedSnap || !selectedSnap.data) {
      return {
        hasBaseline: false,
        addedComps: [],
        removedComps: [],
        modifiedComps: [],
        addedWires: [],
        removedWires: [],
        totalChanges: 0
      }
    }

    const baseComps = selectedSnap.data.components ?? []
    const curComps = $components ?? []
    const baseWires = selectedSnap.data.wires ?? []
    const curWires = $wires ?? []

    // 1. Component Diff
    const baseCompMap = new Map(baseComps.map(c => [c.instanceId, c]))
    const curCompMap = new Map(curComps.map(c => [c.instanceId, c]))

    const addedComps = curComps.filter(c => !baseCompMap.has(c.instanceId))
    const removedComps = baseComps.filter(c => !curCompMap.has(c.instanceId))
    const modifiedComps = []

    curComps.forEach(c => {
      const base = baseCompMap.get(c.instanceId)
      if (!base) return
      const changes = []
      if ((base.label || '') !== (c.label || '')) changes.push(`Nama/Label: "${base.label}" ➔ "${c.label}"`)
      if (Math.round(base.x) !== Math.round(c.x) || Math.round(base.y) !== Math.round(c.y)) {
        changes.push(`Posisi: (${Math.round(base.x)}, ${Math.round(base.y)}) ➔ (${Math.round(c.x)}, ${Math.round(c.y)})`)
      }
      if ((base.rotation || 0) !== (c.rotation || 0)) changes.push(`Rotasi: ${base.rotation || 0}° ➔ ${c.rotation || 0}°`)
      if (changes.length > 0) {
        modifiedComps.push({ comp: c, base, changes })
      }
    })

    // 2. Wire Connection Diff (Pin-to-Pin Signature)
    const wireSig = (w) => {
      const p1 = `${w.fromComp}:${w.fromPin}`
      const p2 = `${w.toComp}:${w.toPin}`
      return [p1, p2].sort().join(' <--> ')
    }

    const baseWireSigs = new Map(baseWires.map(w => [wireSig(w), w]))
    const curWireSigs = new Map(curWires.map(w => [wireSig(w), w]))

    const addedWires = curWires.filter(w => !baseWireSigs.has(wireSig(w)))
    const removedWires = baseWires.filter(w => !curWireSigs.has(wireSig(w)))

    const totalChanges = addedComps.length + removedComps.length + modifiedComps.length + addedWires.length + removedWires.length

    return {
      hasBaseline: true,
      addedComps,
      removedComps,
      modifiedComps,
      addedWires,
      removedWires,
      totalChanges
    }
  })()

  function getCompName(instanceId, isCurrent = true) {
    const list = isCurrent ? $components : (selectedSnap?.data?.components ?? [])
    const found = list.find(c => c.instanceId === instanceId)
    return found ? (found.label || found.name || found.id) : instanceId
  }

  async function restoreSelected() {
    if (!selectedSnap) return
    const ok = await showConfirm({
      title: 'Pulihkan ke Snapshot Baseline Ini?',
      message: `Kembalikan diagram aktif ke versi "${selectedSnap.tag}" (${selectedSnap.compCount} komponen, ${selectedSnap.wireCount} kabel)?`,
      confirmText: 'Ya, Revert ke Versi Ini',
      cancelText: 'Batal',
      icon: '↩'
    })
    if (!ok) return
    pushHistory()
    loadDiagram(selectedSnap.data)
    dispatch('restored', selectedSnap.tag)
    show = false
  }

  function copyDiffSummary() {
    if (!diffResult.hasBaseline) return
    let md = `# Ringkasan Revisi: ${projectName}\n`
    md += `Perbandingan: Snapshot [${selectedSnap.tag}] vs Diagram Aktif Saat Ini\n`
    md += `Tanggal Baseline: ${new Date(selectedSnap.timestamp).toLocaleString()}\n\n`
    md += `## Total Perubahan: ${diffResult.totalChanges}\n`
    md += `- Komponen Baru: +${diffResult.addedComps.length}\n`
    md += `- Komponen Terhapus: -${diffResult.removedComps.length}\n`
    md += `- Komponen Dimodifikasi: ~${diffResult.modifiedComps.length}\n`
    md += `- Jalur Kabel Baru: +${diffResult.addedWires.length}\n`
    md += `- Jalur Kabel Terputus: -${diffResult.removedWires.length}\n\n`

    if (diffResult.addedComps.length > 0) {
      md += `### Komponen Baru Ditambahkan (+):\n`
      diffResult.addedComps.forEach(c => md += `- ${c.label || c.id} (Tipe: ${c.id})\n`)
      md += `\n`
    }
    if (diffResult.removedComps.length > 0) {
      md += `### Komponen Dihapus (-):\n`
      diffResult.removedComps.forEach(c => md += `- ${c.label || c.id} (Tipe: ${c.id})\n`)
      md += `\n`
    }
    if (diffResult.addedWires.length > 0) {
      md += `### Kabel Baru Dihubungkan (+):\n`
      diffResult.addedWires.forEach(w => {
        md += `- ${getCompName(w.fromComp)}:${w.fromPin} ──▶ ${getCompName(w.toComp)}:${w.toPin} [${w.color}]\n`
      })
      md += `\n`
    }

    navigator.clipboard.writeText(md)
    copied = true
    setTimeout(() => copied = false, 2000)
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="diff-backdrop" on:click={() => show = false}>
    <div class="diff-modal" on:click|stopPropagation role="dialog" aria-label="Schematic Revision Diff" tabindex="-1">
      <!-- Modal Header -->
      <div class="diff-head">
        <div class="head-left">
          <span class="icon">🔍</span>
          <div>
            <h2 class="title">Schematic Revision Diff & Visual Snapshot Comparison</h2>
            <p class="subtitle">Bandingkan perbedaan struktural antara versi snapshot dengan diagram sirkuit aktif</p>
          </div>
        </div>
        <button class="btn-close" on:click={() => show = false}>✕</button>
      </div>

      <!-- Baseline Selector Toolbar -->
      <div class="diff-toolbar">
        <div class="selector-group">
          <span class="toolbar-lbl">Bandingkan dengan Baseline:</span>
          {#if snapshots.length === 0}
            <span class="no-snap-hint">Belum ada snapshot tersimpan. Buat snapshot revisi terlebih dahulu di menu Version History.</span>
          {:else}
            <select bind:value={selectedSnapId} class="snap-select">
              {#each snapshots as s}
                <option value={s.id}>
                  {s.tag} — {new Date(s.timestamp).toLocaleDateString()} ({s.compCount} parts, {s.wireCount} wires)
                </option>
              {/each}
            </select>
          {/if}
        </div>

        {#if selectedSnap}
          <div class="toolbar-actions">
            <button class="btn-copy" on:click={copyDiffSummary}>
              {copied ? '✓ Ringkasan Disalin!' : '📋 Salin Changelog MD'}
            </button>
            <button class="btn-revert" on:click={restoreSelected} title="Pulihkan kanvas ke versi snapshot ini">
              ↩ Revert ke Versi Ini
            </button>
          </div>
        {/if}
      </div>

      {#if !selectedSnap}
        <div class="diff-empty-state">
          <span class="empty-icon">📁</span>
          <h3>Pilih atau Buat Snapshot Revisi</h3>
          <p>Fitur diff memerlukan minimal satu snapshot untuk dijadikan acuan baseline perbandingan skematik.</p>
        </div>
      {:else}
        <!-- Summary Metric Cards -->
        <div class="diff-cards">
          <div class="metric-card added">
            <div class="card-val">+{diffResult.addedComps.length}</div>
            <div class="card-lbl">Komponen Baru</div>
          </div>
          <div class="metric-card removed">
            <div class="card-val">-{diffResult.removedComps.length}</div>
            <div class="card-lbl">Komponen Dihapus</div>
          </div>
          <div class="metric-card modified">
            <div class="card-val">~{diffResult.modifiedComps.length}</div>
            <div class="card-lbl">Dimodifikasi</div>
          </div>
          <div class="metric-card wire-added">
            <div class="card-val">+{diffResult.addedWires.length}</div>
            <div class="card-lbl">Kabel Baru</div>
          </div>
          <div class="metric-card wire-removed">
            <div class="card-val">-{diffResult.removedWires.length}</div>
            <div class="card-lbl">Kabel Terputus</div>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div class="diff-tabs">
          <button class="tab-btn" class:active={activeTab === 'all'} on:click={() => activeTab = 'all'}>
            Semua Perubahan ({diffResult.totalChanges})
          </button>
          <button class="tab-btn" class:active={activeTab === 'components'} on:click={() => activeTab = 'components'}>
            Komponen ({diffResult.addedComps.length + diffResult.removedComps.length + diffResult.modifiedComps.length})
          </button>
          <button class="tab-btn" class:active={activeTab === 'wires'} on:click={() => activeTab = 'wires'}>
            Jalur Kabel ({diffResult.addedWires.length + diffResult.removedWires.length})
          </button>
        </div>

        <!-- Diff List Container -->
        <div class="diff-content">
          {#if diffResult.totalChanges === 0}
            <div class="identical-box">
              <span class="id-icon">✨</span>
              <h4>Tidak Ada Perbedaan Ditemukan</h4>
              <p>Diagram sirkuit saat ini 100% identik dengan baseline snapshot <strong>{selectedSnap.tag}</strong>.</p>
            </div>
          {:else}
            <!-- Component Changes -->
            {#if activeTab === 'all' || activeTab === 'components'}
              <!-- Added Components -->
              {#each diffResult.addedComps as c}
                <div class="diff-item item-added">
                  <span class="diff-badge badge-add">+ Tambah Part</span>
                  <div class="diff-desc">
                    <strong>{c.label || c.id}</strong> (Tipe: {c.id})
                    <span class="coord">Pos: ({Math.round(c.x)}, {Math.round(c.y)})</span>
                  </div>
                </div>
              {/each}

              <!-- Removed Components -->
              {#each diffResult.removedComps as c}
                <div class="diff-item item-removed">
                  <span class="diff-badge badge-del">- Hapus Part</span>
                  <div class="diff-desc">
                    <strong>{c.label || c.id}</strong> (Tipe: {c.id})
                    <span class="coord">Dihapus dari skematik aktif</span>
                  </div>
                </div>
              {/each}

              <!-- Modified Components -->
              {#each diffResult.modifiedComps as m}
                <div class="diff-item item-mod">
                  <span class="diff-badge badge-mod">~ Modifikasi</span>
                  <div class="diff-desc">
                    <strong>{m.comp.label || m.comp.id}</strong>
                    <ul class="change-list">
                      {#each m.changes as ch}
                        <li>{ch}</li>
                      {/each}
                    </ul>
                  </div>
                </div>
              {/each}
            {/if}

            <!-- Wire Changes -->
            {#if activeTab === 'all' || activeTab === 'wires'}
              <!-- Added Wires -->
              {#each diffResult.addedWires as w}
                <div class="diff-item item-added">
                  <span class="diff-badge badge-add">+ Sambungan Baru</span>
                  <div class="diff-desc font-mono">
                    {getCompName(w.fromComp)}:<strong>{w.fromPin}</strong> ──▶ {getCompName(w.toComp)}:<strong>{w.toPin}</strong>
                    <span class="wire-pill" style="border-color:{w.color}; color:{w.color}">net: {w.label || w.color}</span>
                  </div>
                </div>
              {/each}

              <!-- Removed Wires -->
              {#each diffResult.removedWires as w}
                <div class="diff-item item-removed">
                  <span class="diff-badge badge-del">- Sambungan Terputus</span>
                  <div class="diff-desc font-mono">
                    {getCompName(w.fromComp, false)}:<strong>{w.fromPin}</strong> ──▶ {getCompName(w.toComp, false)}:<strong>{w.toPin}</strong>
                    <span class="coord">Terhubung di baseline {selectedSnap.tag}</span>
                  </div>
                </div>
              {/each}
            {/if}
          {/if}
        </div>
      {/if}

      <!-- Modal Footer -->
      <div class="diff-foot">
        <span class="foot-hint">💡 Perubahan dihitung real-time terhadap state kanvas saat ini.</span>
        <button class="btn-close-modal" on:click={() => show = false}>Tutup</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .diff-backdrop {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(2, 6, 23, 0.75); backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .diff-modal {
    background: #0b1120; border: 1px solid #1e293b; border-radius: 14px;
    width: 100%; max-width: 900px; max-height: 85vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7);
  }
  .diff-head {
    padding: 14px 20px; background: #0f172a; border-bottom: 1px solid #1e293b;
    display: flex; align-items: center; justify-content: space-between;
  }
  .head-left { display: flex; align-items: center; gap: 12px; }
  .icon { font-size: 24px; }
  .title { font-size: 15px; font-weight: 700; color: #f8fafc; margin: 0; }
  .subtitle { font-size: 11px; color: #94a3b8; margin: 2px 0 0 0; }
  .btn-close {
    background: transparent; border: none; color: #94a3b8; font-size: 18px;
    cursor: pointer; width: 32px; height: 32px; border-radius: 6px;
  }
  .btn-close:hover { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

  /* Toolbar */
  .diff-toolbar {
    padding: 10px 20px; background: #080d1a; border-bottom: 1px solid #1e293b;
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  .selector-group { display: flex; align-items: center; gap: 10px; }
  .toolbar-lbl { font-size: 11px; font-weight: 600; color: #cbd5e1; }
  .snap-select {
    background: #0f172a; border: 1px solid #334155; border-radius: 6px;
    color: #f8fafc; font-size: 12px; padding: 5px 10px; outline: none;
  }
  .no-snap-hint { font-size: 11px; color: #f59e0b; }
  .toolbar-actions { display: flex; align-items: center; gap: 8px; }
  .btn-copy {
    background: #1e293b; border: 1px solid #334155; color: #cbd5e1;
    font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer;
  }
  .btn-copy:hover { background: #334155; color: #fff; }
  .btn-revert {
    background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5;
    font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer;
  }
  .btn-revert:hover { background: #ef4444; color: #fff; }

  /* Metric Cards */
  .diff-cards {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;
    padding: 14px 20px; background: #0c1427; border-bottom: 1px solid #1e293b;
  }
  .metric-card {
    background: #0f172a; border: 1px solid #1e293b; border-radius: 8px;
    padding: 10px; text-align: center;
  }
  .card-val { font-size: 18px; font-weight: 800; }
  .card-lbl { font-size: 10px; color: #94a3b8; font-weight: 600; margin-top: 2px; }
  .metric-card.added .card-val { color: #4ade80; }
  .metric-card.removed .card-val { color: #f87171; }
  .metric-card.modified .card-val { color: #facc15; }
  .metric-card.wire-added .card-val { color: #38bdf8; }
  .metric-card.wire-removed .card-val { color: #fb923c; }

  /* Tabs */
  .diff-tabs {
    display: flex; gap: 6px; padding: 8px 20px; background: #080d1a; border-bottom: 1px solid #1e293b;
  }
  .tab-btn {
    background: transparent; border: 1px solid transparent; color: #94a3b8;
    font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 6px; cursor: pointer;
  }
  .tab-btn:hover { color: #fff; background: #1e293b; }
  .tab-btn.active { background: #0284c7; color: #fff; border-color: #38bdf8; }

  /* Content List */
  .diff-content {
    flex: 1; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 8px;
  }
  .diff-item {
    display: flex; align-items: flex-start; gap: 12px; padding: 10px 14px;
    border-radius: 8px; font-size: 12px; border: 1px solid transparent;
  }
  .item-added { background: rgba(34, 197, 94, 0.08); border-color: rgba(34, 197, 94, 0.25); color: #f0fdf4; }
  .item-removed { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.25); color: #fef2f2; }
  .item-mod { background: rgba(234, 179, 8, 0.08); border-color: rgba(234, 179, 8, 0.25); color: #fefce8; }
  .diff-badge {
    font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; white-space: nowrap;
  }
  .badge-add { background: #166534; color: #4ade80; }
  .badge-del { background: #991b1b; color: #fca5a5; }
  .badge-mod { background: #854d0e; color: #fde047; }
  .diff-desc { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .coord { font-size: 11px; color: #94a3b8; }
  .wire-pill {
    display: inline-block; font-size: 10px; border: 1px solid; border-radius: 4px;
    padding: 1px 6px; margin-top: 4px; width: fit-content;
  }
  .change-list { margin: 4px 0 0 16px; padding: 0; font-size: 11px; color: #cbd5e1; }

  .identical-box, .diff-empty-state {
    text-align: center; padding: 40px 20px; color: #94a3b8;
  }
  .id-icon, .empty-icon { font-size: 36px; display: block; margin-bottom: 8px; }
  .identical-box h4, .diff-empty-state h3 { color: #f8fafc; margin: 0 0 4px 0; }

  /* Footer */
  .diff-foot {
    padding: 12px 20px; background: #0f172a; border-top: 1px solid #1e293b;
    display: flex; align-items: center; justify-content: space-between;
  }
  .foot-hint { font-size: 11px; color: #64748b; }
  .btn-close-modal {
    background: #1e293b; border: 1px solid #334155; color: #fff;
    font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px; cursor: pointer;
  }
  .btn-close-modal:hover { background: #334155; }
</style>
