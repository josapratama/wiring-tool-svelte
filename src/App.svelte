<script>
  import Canvas          from '$lib/components/Canvas.svelte'
  import PcbLayoutView   from '$lib/components/PcbLayoutView.svelte'
  import Sidebar         from '$lib/components/Sidebar.svelte'
  import PropertiesPanel from '$lib/components/PropertiesPanel.svelte'
  import ERCModal        from '$lib/components/ERCModal.svelte'
  import CodeGenModal    from '$lib/components/CodeGenModal.svelte'
  import WokwiModal      from '$lib/components/WokwiModal.svelte'
  import QuickPaletteModal from '$lib/components/QuickPaletteModal.svelte'
  import DialogModal     from '$lib/components/DialogModal.svelte'
  import Pcb3dViewerModal from '$lib/components/Pcb3dViewerModal.svelte'
  import SerialMonitorModal from '$lib/components/SerialMonitorModal.svelte'
  import BomCostEstimatorModal from '$lib/components/BomCostEstimatorModal.svelte'

  // ── Decomposed Sub-Components & Services ─────────────────────────────────
  import CadHeader from '$lib/components/header/CadHeader.svelte'
  import SchematicToolbar from '$lib/components/toolbar/SchematicToolbar.svelte'
  import StatsModal from '$lib/components/modals/StatsModal.svelte'
  import HelpModal from '$lib/components/modals/HelpModal.svelte'
  import VersionHistoryModal from '$lib/components/modals/VersionHistoryModal.svelte'
  import CustomComponentModal from '$lib/components/CustomComponentModal.svelte'
  import {
    exportDiagramSvg,
    exportDiagramPng,
    exportNetlistCsv,
    generateShareLink,
    downloadFile,
    exportFabricationDocPack
  } from '$lib/services/export-service.js'

  import { showAlert, showConfirm } from '$lib/store/dialog.js'
  import { TEMPLATES }   from '$lib/store/templates.js'
  import {
    loadDiagram, clearDiagram, getDiagram, getNetlist,
    activeTool, undo, redo, pushHistory,
    selection, multiSelection, routingMode,
    components as compsStore, wires as wiresStore,
    copperTraces as tracesStore, pcbVias as viasStore, pcbBoardConfig as boardConfigStore,
    duplicateComponent, duplicateComponents, rotateComponent, rotateComponents,
    flipComponentX, flipComponentY, flipComponents,
    edaGridType, showDrawingSheet, showPowerFlow, sheetConfig, updateSheetConfig,
    removeComponent, removeComponents,
    removeWire, removeLabel,
    getAutoSave, clearAutoSave, initAutoSave,
    renderMode, toggleRenderMode, activeEditorView, setActiveEditorView,
    is3dViewerOpen, isSerialMonitorOpen
  } from '$lib/store/diagram.js'
  import { runERC }      from '$lib/engine/erc.js'
  import { generatePinCode } from '$lib/engine/codegen.js'
  import { generateWokwiDiagram } from '$lib/engine/wokwi.js'
  import { onMount }     from 'svelte'

  // ── State Variables ───────────────────────────────────────────────────────
  let canvasRef = {}
  let projectName = 'ESP32-S3 FI Diagnostic'
  let isLightMode = false
  let activeColor = '#ef4444'

  // Modals state
  let showERCModal = false
  let showCodeGenModal = false
  let showWokwiModal = false
  let showQuickPalette = false
  let showBomModal = false
  let showStats = false
  let showShortcuts = false
  let showSnapshotModal = false
  let showCustomCompModal = false

  // Layout sidebars & status flash
  let showLeftSidebar = true
  let showRightSidebar = true
  let flashMsg = ''

  function flash(msg) {
    flashMsg = msg
    setTimeout(() => { if (flashMsg === msg) flashMsg = '' }, 2800)
  }

  function toggleLeftSidebar() { showLeftSidebar = !showLeftSidebar }
  function toggleRightSidebar() { showRightSidebar = !showRightSidebar }

  // ── CAD Quick Actions ─────────────────────────────────────────────────────
  function setTool(id) {
    activeTool.set(id)
    if (id !== 'wire') canvasRef.cancelWire?.()
  }

  function pickColor(c) {
    activeColor = c
    canvasRef.setWireColor?.(c)
  }

  function placeGND() {
    canvasRef.quickPlaceComponent?.('gnd-flag')
    flash('Net Flag GND diletakkan (⏚) ✓')
  }

  function placeVCC(id = 'vcc-flag') {
    canvasRef.quickPlaceComponent?.(id)
    flash('Power Port diletakkan (▲) ✓')
  }

  function selectAll() {
    multiSelection.set($compsStore.map(c => ({ id: c.instanceId, type: 'component' })))
    flash(`Semua komponen dipilih (${$compsStore.length})`)
  }

  function doRotate(deg = 90) {
    const ms = $multiSelection
    if (ms.length > 1) {
      rotateComponents(ms.filter(s => s.type === 'component').map(s => s.id), deg)
    } else if ($selection?.type === 'component') {
      rotateComponent($selection.id, deg)
    }
  }

  function doFlipX() {
    const ms = $multiSelection
    if (ms.length > 1) {
      flipComponents(ms.filter(s => s.type === 'component').map(s => s.id), 'x')
    } else if ($selection?.type === 'component') {
      flipComponentX($selection.id)
    }
    flash('Flip Horizontal (X) ✓')
  }

  function doFlipY() {
    const ms = $multiSelection
    if (ms.length > 1) {
      flipComponents(ms.filter(s => s.type === 'component').map(s => s.id), 'y')
    } else if ($selection?.type === 'component') {
      flipComponentY($selection.id)
    }
    flash('Flip Vertical (Y) ✓')
  }

  function doDelete() {
    const ms = $multiSelection
    if (ms.length > 1) {
      removeComponents(ms.filter(s => s.type === 'component').map(s => s.id))
      return
    }
    const s = $selection
    if (!s) return
    if (s.type === 'component') removeComponent(s.id)
    else if (s.type === 'wire') removeWire(s.id)
    else if (s.type === 'label') removeLabel(s.id)
  }

  function toggleTheme() {
    isLightMode = !isLightMode
    try { localStorage.setItem('wiretool_theme', isLightMode ? 'light' : 'dark') } catch {}
    flash(isLightMode ? '☀️ Light Mode diaktifkan' : '🌙 Dark Mode diaktifkan')
  }

  // Reactive ERC analysis
  $: ercResult = runERC($compsStore, $wiresStore)

  // ── Import / Export Utilities ─────────────────────────────────────────────
  function exportJSON() {
    const data = { ...getDiagram(), project: projectName, savedAt: new Date().toISOString() }
    downloadFile(JSON.stringify(data, null, 2), (projectName || 'wiring') + '.json', 'application/json')
    flash('JSON exported ✓')
  }

  function importJSON() {
    pickFile('.json', text => {
      try {
        const d = JSON.parse(text)
        if (d.project) projectName = d.project
        loadDiagram(d)
        setTimeout(() => canvasRef.fitView?.(), 120)
        flash('Imported ✓')
      } catch {
        showAlert({
          title: 'Format Tidak Valid',
          message: 'File JSON diagram tidak dapat dibaca atau formatnya rusak.',
          icon: '⚠️'
        })
      }
    })
  }

  function pickFile(accept, cb) {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = accept
    inp.onchange = e => {
      const f = e.target.files[0]
      if (!f) return
      const r = new FileReader()
      r.onload = ev => cb(ev.target.result)
      r.readAsText(f)
    }
    inp.click()
  }

  function exportSVG() {
    const svg = document.querySelector('.canvas-wrap svg') || document.querySelector('.pcb-svg')
    if (!svg) return
    const file = exportDiagramSvg(svg, projectName, isLightMode)
    if (file) flash(`SVG exported (${file}) ✓`)
  }

  function exportPNG() {
    const svg = document.querySelector('.canvas-wrap svg') || document.querySelector('.pcb-svg')
    if (!svg) return
    exportDiagramPng(svg, projectName, isLightMode, (err, file) => {
      if (err) flash('⚠ Failed to export PNG', '#f87171')
      else flash(`PNG exported (${file}) ✓`)
    })
  }

  function exportNetlist() {
    const nets = getNetlist()
    if (!nets || !nets.length) { flash('⚠ Belum ada koneksi', '#f59e0b'); return }
    const file = exportNetlistCsv(nets, projectName)
    if (file) flash(`Netlist exported (${nets.length} nets) ✓`)
  }

  function exportBOM() {
    showBomModal = true
    flash('📋 Membuka Maker BOM Studio & Cost Estimator...')
  }

  async function shareDiagramLink() {
    try {
      const url = await generateShareLink(projectName, $compsStore, $wiresStore, $sheetConfig)
      if (url) {
        await navigator.clipboard.writeText(url)
        flash('Tautan diagram berhasil disalin ke clipboard! 🔗')
      }
    } catch {
      flash('Gagal menyalin tautan diagram', '#f87171')
    }
  }

  function printDiagram() {
    window.print()
  }

  function triggerPcbExport() {
    if ($activeEditorView !== 'pcb') setActiveEditorView('pcb')
    setTimeout(() => {
      const pcbExportBtn = document.querySelector('.pcb-btn-export')
      if (pcbExportBtn) pcbExportBtn.click()
    }, 120)
  }

  function triggerPcbInspector() {
    if ($activeEditorView !== 'pcb') setActiveEditorView('pcb')
    setTimeout(() => {
      const inspectorBtn = document.querySelector('.pcb-btn-inspector')
      if (inspectorBtn) inspectorBtn.click()
    }, 120)
  }

  function openSimulatorLab() {
    try {
      const pinCode = generatePinCode($compsStore, $wiresStore, projectName)
      const wokwiObj = generateWokwiDiagram($compsStore, $wiresStore, projectName)
      const data = {
        project: projectName,
        code: pinCode.sketch || pinCode.cpp,
        wokwi: wokwiObj
      }
      localStorage.setItem('simulator_launch_data', JSON.stringify(data))
    } catch (e) {
      console.warn('Failed to save simulator launch data:', e)
    }
    window.open('./simulator/index.html', '_blank')
    flash('⚡ Membuka Virtual MCU Simulator Lab...')
  }

  function handleExportDocPack() {
    exportFabricationDocPack({
      projectName,
      components: $compsStore,
      wires: $wiresStore,
      sheetConfig: $sheetConfig,
      pcbBoardConfig: $boardConfigStore,
      copperTraces: $tracesStore,
      vias: $viasStore
    })
    flash('📑 Membuka Dokumen Fabrikasi Lengkap (PDF Pack)...')
  }

  // ── Ribbon Menus & Export Handlers ─────────────────────────────────────────
  function handleMenuAction(actionEvent) {
    const action = typeof actionEvent === 'object' && actionEvent !== null ? (actionEvent.name || actionEvent.id || actionEvent) : actionEvent
    const payload = typeof actionEvent === 'object' && actionEvent !== null ? actionEvent.payload : null

    switch (action) {
      case 'new':
      case 'new-diagram': handleClearDiagram(); break
      case 'open':
      case 'open-json': importJSON(); break
      case 'save':
      case 'save-json': exportJSON(); break
      case 'open-snapshots': showSnapshotModal = true; break
      case 'export-doc-pack': handleExportDocPack(); break
      case 'open-custom-comp': showCustomCompModal = true; break
      case 'open-bom':
      case 'export-bom': exportBOM(); break
      case 'open-wokwi-modal':
      case 'wokwi': showWokwiModal = true; break
      case 'export-json': exportJSON(); break
      case 'export-svg': exportSVG(); break
      case 'export-png': exportPNG(); break
      case 'export-csv':
      case 'export-netlist': exportNetlist(); break
      case 'clear-diagram': handleClearDiagram(); break
      case 'print': printDiagram(); break
      case 'share':
      case 'share-link': shareDiagramLink(); break
      case 'undo': undo(); break
      case 'redo': redo(); break
      case 'select-all': selectAll(); break
      case 'delete': doDelete(); break
      case 'rotate': doRotate(payload || 90); break
      case 'flip-x': doFlipX(); break
      case 'flip-y': doFlipY(); break
      case 'place-wire':
      case 'tool-wire': setTool('wire'); break
      case 'place-label':
      case 'tool-label': setTool('label'); break
      case 'place-gnd': placeGND(); break
      case 'place-vcc': placeVCC(payload || 'vcc-flag'); break
      case 'place-quick':
      case 'open-quick-palette': showQuickPalette = true; break
      case 'fit-view': canvasRef.fitView?.(); break
      case 'zoom-in': canvasRef.zoomIn?.(); break
      case 'zoom-out': canvasRef.zoomOut?.(); break
      case 'toggle-grid': canvasRef.toggleGrid?.(); break
      case 'toggle-sheet': canvasRef.toggleSheet?.(); break
      case 'toggle-theme': toggleTheme(); break
      case 'toggle-minimap': canvasRef.toggleMinimap?.(); break
      case 'toggle-left-sidebar': toggleLeftSidebar(); break
      case 'toggle-right-sidebar': toggleRightSidebar(); break
      case 'open-erc':
      case 'run-erc': showERCModal = true; break
      case 'open-codegen':
      case 'run-codegen': showCodeGenModal = true; break
      case 'open-simulator':
      case 'run-simulator': openSimulatorLab(); break
      case 'open-3d':
      case 'open-3d-view': is3dViewerOpen.set(true); break
      case 'open-serial':
      case 'open-serial-monitor': isSerialMonitorOpen.set(true); break
      case 'pcb-inspector':
      case 'open-pcb-inspector': triggerPcbInspector(); break
      case 'shortcuts':
      case 'open-help': showShortcuts = true; break
      case 'circuit-stats':
      case 'open-stats': showStats = true; break
      case 'about':
        showAlert({
          title: 'EasyEDA Web Schematic',
          message: 'Aplikasi schematic CAD berbasis web yang dilengkapi dengan Dot Grid, Drawing Sheet CAD, EELib, Design Manager (Net & Part inspector), rotasi & flip komponen, serta export Netlist & BOM.',
          icon: '✨'
        })
        break
    }
  }

  function handleExportAction(type) {
    switch (type) {
      case 'pcb-export':
      case 'gerber-zip': triggerPcbExport(); break
      case 'json': exportJSON(); break
      case 'svg': exportSVG(); break
      case 'png': exportPNG(); break
      case 'csv':
      case 'netlist': exportNetlist(); break
      case 'bom': exportBOM(); break
      case 'doc-pack': handleExportDocPack(); break
      case 'wokwi': showWokwiModal = true; break
      case 'share':
      case 'share-link': shareDiagramLink(); break
      case 'print': printDiagram(); break
    }
  }

  // ── Statistics Calculation ────────────────────────────────────────────────
  $: statsData = (() => {
    const cs = $compsStore
    const ws = $wiresStore
    const byTheme = {}
    cs.forEach(c => { byTheme[c.theme ?? 'other'] = (byTheme[c.theme ?? 'other'] ?? 0) + 1 })
    const usedPinKeys = new Set(ws.map(w => w.fromComp + '::' + w.fromPin).concat(ws.map(w => w.toComp + '::' + w.toPin)))
    let totalPins = 0, connectedPins = 0
    cs.forEach(c => {
      const pins = c.isMCU
        ? [...(c.mcuPinsData?.left ?? []), ...(c.mcuPinsData?.right ?? [])]
        : (c.pins ?? [])
      totalPins += pins.length
      pins.forEach(p => { if (usedPinKeys.has(c.instanceId + '::' + p.id)) connectedPins++ })
    })
    return { total: cs.length, wires: ws.length, byTheme, totalPins, connectedPins }
  })()

  // ── Keyboard Shortcuts Handler ────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return

    // Quick palette: Ctrl+K or /
    if ((e.ctrlKey && (e.key === 'k' || e.key === 'K')) || e.key === '/') {
      e.preventDefault()
      showQuickPalette = true
      return
    }

    // Toggle shortcut overlay
    if (e.key === '?') { showShortcuts = !showShortcuts; return }
    if (e.key === 'Escape') {
      showShortcuts = false
      showStats = false
      showERCModal = false
      showCodeGenModal = false
      showWokwiModal = false
      showQuickPalette = false
    }

    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { undo(); return }
    if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { redo(); return }

    if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault()
      selectAll()
      return
    }

    if ((e.key === 'F' || e.key === 'f') && e.shiftKey) {
      canvasRef.zoomToSelection?.()
      return
    }

    if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      doFlipX()
      return
    }

    if ((e.key === 'y' || e.key === 'Y') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      doFlipY()
      return
    }

    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      placeVCC()
      return
    }

    if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      if (e.shiftKey) placeGND()
      else canvasRef.toggleGrid?.()
      return
    }

    if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      doRotate(e.shiftKey ? -90 : 90)
      return
    }

    if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault()
      const ms = $multiSelection
      if (ms.length > 1) {
        duplicateComponents(ms.filter(s => s.type === 'component').map(s => s.id))
      } else if ($selection?.type === 'component') {
        duplicateComponent($selection.id)
      }
      return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      doDelete()
      return
    }

    const MAP = { v: 'select', V: 'select', w: 'wire', W: 'wire', l: 'label', L: 'label', t: 'label', T: 'label' }
    if (MAP[e.key]) { setTool(MAP[e.key]); return }
    if (e.key === 'Escape') { setTool('select'); return }
    if ((e.key === 'f' || e.key === 'F') && !e.shiftKey) canvasRef.fitView?.()
    if (e.key === 'm' || e.key === 'M') canvasRef.toggleMinimap?.()
  }

  function handleDrop(compId, cx, cy) { canvasRef.handleDrop?.(compId, cx, cy) }

  // ── Template Loader ───────────────────────────────────────────────────────
  async function loadTemplate(key) {
    const t = TEMPLATES[key]
    if (!t) return
    const cs = $compsStore
    if (cs.length > 0) {
      const ok = await showConfirm({
        title: 'Muat Template Baru?',
        message: `Buka template "${t.label}"?\nDiagram kerja saat ini akan digantikan.`,
        confirmText: 'Muat Template',
        cancelText: 'Batal',
        icon: '📋'
      })
      if (!ok) return
    }
    loadDiagram({ components: t.components, wires: t.wires, labels: [] })
    projectName = t.label
    setTimeout(() => canvasRef.fitView?.(), 150)
  }

  async function handleClearDiagram() {
    const ok = await showConfirm({
      title: 'Kosongkan Seluruh Diagram?',
      message: 'Semua komponen dan kabel di kanvas saat ini akan dihapus bersih.',
      confirmText: 'Ya, Kosongkan',
      cancelText: 'Batal',
      danger: true,
      icon: '🗑️'
    })
    if (ok) {
      pushHistory()
      clearDiagram()
      flash('Diagram dikosongkan ✓')
    }
  }

  // ── Lifecycle & Auto-Save ─────────────────────────────────────────────────
  onMount(async () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      showLeftSidebar = false
      showRightSidebar = false
    }

    try {
      const savedTheme = localStorage.getItem('wiretool_theme')
      if (savedTheme === 'light') isLightMode = true
    } catch {}

    // Check shared URL hash
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#data=')) {
      try {
        const b64 = window.location.hash.slice(6)
        const jsonStr = decodeURIComponent(escape(atob(b64)))
        const parsed = JSON.parse(jsonStr)
        if (parsed.components && parsed.wires) {
          if (parsed.project) projectName = parsed.project
          loadDiagram(parsed)
          if (parsed.sheetConfig) updateSheetConfig(parsed.sheetConfig)
          clearAutoSave()
          initAutoSave()
          setTimeout(() => canvasRef.fitView?.(), 150)
          flash('Diagram berhasil dimuat dari link bersama 🔗')
          return
        }
      } catch (err) {
        console.error('Failed to parse share link:', err)
      }
    }

    const saved = getAutoSave()
    if (saved && saved.components?.length) {
      const ok = await showConfirm({
        title: 'Pulihkan Diagram Otomatis?',
        message: `Ditemukan diagram tersimpan otomatis (${saved.components.length} komponen, ${saved.wires?.length ?? 0} kabel).\nApakah Anda ingin memulihkan diagram sesi terakhir ini?`,
        confirmText: 'Pulihkan Diagram',
        cancelText: 'Abaikan (Mulai Baru)',
        icon: '💾'
      })
      if (ok) {
        if (saved.project) projectName = saved.project
        loadDiagram(saved)
        clearAutoSave()
        initAutoSave()
        setTimeout(() => canvasRef.fitView?.(), 150)
        return
      } else {
        clearAutoSave()
      }
    }
    initAutoSave()
    loadTemplate('esp32s3-fi')
  })
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="app" class:light-app={isLightMode}>
  <!-- CAD HEADER: EasyEDA MENU RIBBON & ACTIONS -->
  <CadHeader
    bind:projectName
    activeEditorView={$activeEditorView}
    renderMode={$renderMode}
    {ercResult}
    {showLeftSidebar}
    {showRightSidebar}
    {isLightMode}
    {flashMsg}
    on:toggle-left-sidebar={toggleLeftSidebar}
    on:toggle-right-sidebar={toggleRightSidebar}
    on:switch-view={e => setActiveEditorView(e.detail)}
    on:toggle-render-mode={toggleRenderMode}
    on:menu-action={e => handleMenuAction(e.detail)}
    on:export-action={e => handleExportAction(e.detail)}
    on:open-quick-palette={() => showQuickPalette = true}
    on:open-erc={() => showERCModal = true}
    on:open-codegen={() => showCodeGenModal = true}
    on:open-simulator={openSimulatorLab}
    on:open-serial={() => isSerialMonitorOpen.set(true)}
    on:open-pcb-inspector={triggerPcbInspector}
  />

  <div class="body">
    <!-- LEFT SIDEBAR (EELib & DESIGN MANAGER) -->
    {#if showLeftSidebar && $activeEditorView === 'wiring'}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div class="drawer-backdrop left-bd" on:click={() => showLeftSidebar = false}></div>
      <div class="sidebar-wrapper left-wrap">
        <div class="mobile-sidebar-head">
          <span>📦 Library & Manager</span>
          <button class="drawer-close-btn" on:click={() => showLeftSidebar = false}>✕</button>
        </div>
        <Sidebar onDrop={handleDrop} onFocusComp={(id) => canvasRef.panToComponent?.(id)}/>
      </div>
    {/if}

    <!-- CANVAS COLUMN -->
    <div class="canvas-col">
      <!-- TIER 2: CAD ACTION TOOLSTRIP (Schematic Mode) -->
      {#if $activeEditorView === 'wiring'}
        <SchematicToolbar
          curTool={$activeTool}
          routingMode={$routingMode}
          {activeColor}
          edaGridType={$edaGridType}
          showDrawingSheet={$showDrawingSheet}
          showPowerFlow={$showPowerFlow}
          {isLightMode}
          on:set-tool={e => setTool(e.detail)}
          on:place-gnd={placeGND}
          on:place-vcc={e => placeVCC(e.detail)}
          on:set-routing-mode={e => routingMode.set(e.detail)}
          on:change-color={e => pickColor(e.detail)}
          on:rotate={e => doRotate(e.detail)}
          on:flip-x={doFlipX}
          on:flip-y={doFlipY}
          on:toggle-grid={() => canvasRef.toggleGrid?.()}
          on:toggle-sheet={() => canvasRef.toggleSheet?.()}
          on:toggle-probe={() => showPowerFlow.update(v => !v)}
          on:share-link={shareDiagramLink}
          on:toggle-minimap={() => canvasRef.toggleMinimap?.()}
          on:toggle-theme={toggleTheme}
          on:undo={undo}
          on:redo={redo}
          on:fit-view={() => canvasRef.fitView?.()}
          on:zoom-in={() => canvasRef.zoomIn?.()}
          on:zoom-out={() => canvasRef.zoomOut?.()}
        />
      {/if}

      <!-- CANVAS OR PCB STUDIO -->
      {#if $activeEditorView === 'pcb'}
        <PcbLayoutView />
      {:else}
        <Canvas bind:api={canvasRef} {isLightMode} {projectName}/>
      {/if}
    </div>

    <!-- RIGHT SIDEBAR (PROPERTIES & TEMPLATES) -->
    {#if showRightSidebar && $activeEditorView === 'wiring'}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div class="drawer-backdrop right-bd" on:click={() => showRightSidebar = false}></div>
      <aside class="rsb sidebar-wrapper right-wrap">
        <div class="rsb-head">
          <span>Properties</span>
          <button class="drawer-close-btn" on:click={() => showRightSidebar = false}>✕</button>
        </div>
        <PropertiesPanel/>

        <!-- Templates -->
        <div class="tpls">
          <div class="tpls-title">Quick Templates</div>
          {#each Object.entries(TEMPLATES) as [key, t]}
            <button class="tpl-btn" on:click={() => loadTemplate(key)}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          {/each}
        </div>
      </aside>
    {/if}
  </div>

  <!-- Feature Modals -->
  <StatsModal bind:show={showStats} {statsData} on:close={() => showStats = false} />
  <HelpModal bind:show={showShortcuts} on:close={() => showShortcuts = false} />

  <ERCModal
    bind:show={showERCModal}
    {ercResult}
    on:selectwire={e => {
      selection.set({ id: e.detail, type: 'wire' })
      showERCModal = false
    }}
    on:selectcomp={e => {
      selection.set({ id: e.detail, type: 'component' })
      showERCModal = false
    }}
  />

  <CodeGenModal
    bind:show={showCodeGenModal}
    components={$compsStore}
    wires={$wiresStore}
    {projectName}
  />

  <WokwiModal
    bind:show={showWokwiModal}
    components={$compsStore}
    wires={$wiresStore}
    {projectName}
  />

  <QuickPaletteModal
    bind:show={showQuickPalette}
    canvasCenter={canvasRef.getViewCenter?.() || { x: 400, y: 300 }}
    on:added={() => flash('Komponen ditambahkan ke kanvas ✓')}
  />

  <DialogModal />

  {#if $is3dViewerOpen}
    <Pcb3dViewerModal onClose={() => is3dViewerOpen.set(false)} />
  {/if}

  {#if $isSerialMonitorOpen}
    <SerialMonitorModal onClose={() => isSerialMonitorOpen.set(false)} />
  {/if}

  <BomCostEstimatorModal bind:show={showBomModal} {projectName} />

  <!-- 📜 Project Version History & Snapshots Modal -->
  <VersionHistoryModal
    bind:show={showSnapshotModal}
    {projectName}
    on:restored={e => flash(`Proyek berhasil dipulihkan ke: ${e.detail} ✓`)}
  />

  <!-- 🛠️ Custom Component Builder (EELib Studio) Modal -->
  <CustomComponentModal
    bind:show={showCustomCompModal}
    on:created={() => flash('Komponen kustom baru berhasil disimpan ke EELib ✓')}
  />
</div>

<style>
  :global(*,*::before,*::after){ box-sizing:border-box; margin:0; padding:0; }
  :global(html,body){ height:100%; overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    font-size:13px; background:#0b0f19; color:#f1f5f9; }
  :global(*){ scrollbar-width:thin; scrollbar-color:#374151 transparent; }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: #0b0f19;
  }

  /* ── Body Layout ── */
  .body {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  .canvas-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  /* ── Sidebar Wrappers ── */
  .sidebar-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .mobile-sidebar-head {
    display: none;
  }
  .drawer-close-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 15px;
    cursor: pointer;
    padding: 4px 8px;
  }
  .drawer-close-btn:hover {
    color: #fff;
  }
  .drawer-backdrop {
    display: none;
  }

  /* ── Right sidebar ── */
  .rsb {
    width: 260px;
    flex-shrink: 0;
    background: #0f172a;
    border-left: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .rsb-head {
    padding: 10px 12px;
    border-bottom: 1px solid #1e293b;
    font: 700 11px/1 sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #38bdf8;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .tpls {
    border-top: 1px solid #1e293b;
    padding: 10px;
    flex-shrink: 0;
  }
  .tpls-title {
    font: 700 10px/1 sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #94a3b8;
    margin-bottom: 6px;
  }
  .tpl-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 9px;
    margin-bottom: 4px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 5px;
    color: #cbd5e1;
    cursor: pointer;
    font-size: 11.5px;
    text-align: left;
    transition: all .1s;
  }
  .tpl-btn:hover {
    background: #273549;
    border-color: #38bdf8;
    color: #fff;
  }

  /* ── LIGHT MODE OVERRIDES ── */
  .app.light-app {
    background: #f8fafc;
    color: #0f172a;
  }
  .app.light-app .rsb {
    background: #ffffff;
    border-left-color: #e2e8f0;
  }
  .app.light-app .rsb-head {
    border-bottom-color: #e2e8f0;
    color: #0284c7;
  }
  .app.light-app .tpls {
    border-top-color: #e2e8f0;
  }
  .app.light-app .tpl-btn {
    background: #f8fafc;
    border-color: #e2e8f0;
    color: #334155;
  }
  .app.light-app .tpl-btn:hover {
    background: #f1f5f9;
    border-color: #0284c7;
  }

  /* ── RESPONSIVE MEDIA QUERIES ── */
  @media (max-width: 1023px) {
    .drawer-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(2px);
      z-index: 90;
    }
    .sidebar-wrapper.left-wrap {
      position: fixed;
      left: 0;
      top: 46px;
      bottom: 0;
      z-index: 95;
      width: 250px;
      background: #0f172a;
      box-shadow: 4px 0 24px rgba(0,0,0,0.7);
      animation: slide-right .18s ease-out;
    }
    .sidebar-wrapper.right-wrap {
      position: fixed;
      right: 0;
      top: 46px;
      bottom: 0;
      z-index: 95;
      width: 280px;
      background: #0f172a;
      box-shadow: -4px 0 24px rgba(0,0,0,0.7);
      animation: slide-left .18s ease-out;
    }
    .mobile-sidebar-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid #1e293b;
      font-weight: 700;
      font-size: 12px;
      color: #38bdf8;
      background: #0b0f19;
    }
    .app.light-app .sidebar-wrapper.left-wrap,
    .app.light-app .sidebar-wrapper.right-wrap {
      background: #ffffff;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    }
    .app.light-app .mobile-sidebar-head {
      background: #ffffff;
      border-bottom-color: #e2e8f0;
      color: #0284c7;
    }
    @keyframes slide-right { from{transform:translateX(-100%)} to{transform:translateX(0)} }
    @keyframes slide-left { from{transform:translateX(100%)} to{transform:translateX(0)} }
  }

  /* ── PRINT & PDF EXPORT STYLES ── */
  @media print {
    :global(body), .app {
      background: #ffffff !important;
      color: #000000 !important;
    }
    .sidebar-wrapper,
    .drawer-backdrop,
    :global(.cad-header),
    :global(.toolbar),
    :global(.minimap-container),
    :global(.dialog-backdrop) {
      display: none !important;
    }
    .canvas-col,
    :global(.canvas-wrap) {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: #ffffff !important;
    }
    :global(#grid-bg) {
      display: none !important;
    }
    @page {
      size: landscape;
      margin: 0;
    }
  }
</style>