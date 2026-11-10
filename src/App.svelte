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
  import { showAlert, showConfirm, showPrompt } from '$lib/store/dialog.js'

  import { TEMPLATES }   from '$lib/store/templates.js'
  import {
    loadDiagram, clearDiagram, getDiagram, getNetlist, getBOM,
    activeTool, undo, redo, pushHistory,
    selection, multiSelection, routingMode,
    components as compsStore, wires as wiresStore,
    duplicateComponent, duplicateComponents, rotateComponent, rotateComponents,
    flipComponentX, flipComponentY, flipComponents,
    edaGridType, showDrawingSheet, showPowerFlow, sheetConfig, updateSheetConfig,
    removeComponent, removeComponents,
    removeWire, removeLabel,
    getAutoSave, clearAutoSave, initAutoSave,
    renderMode, toggleRenderMode, activeEditorView, setActiveEditorView
  } from '$lib/store/diagram.js'
  import { findCompDef } from '$lib/data/components-db.js'
  import { runERC }      from '$lib/engine/erc.js'
  import { generatePinCode } from '$lib/engine/codegen.js'
  import { generateWokwiDiagram } from '$lib/engine/wokwi.js'
  import { onMount }     from 'svelte'

  let canvasRef = {}  // filled by Canvas via bind:api
  let projectName = 'ESP32-S3 FI Diagnostic'
  let isLightMode = false

  // Modals state
  let showERCModal = false
  let showCodeGenModal = false
  let showWokwiModal = false
  let showQuickPalette = false

  // Responsive sidebars & menus
  let showLeftSidebar = true
  let showRightSidebar = true
  let showExportMenu = false
  let showFileMenu = false
  let showColorPicker = false
  let activeRibbon = null // 'file' | 'edit' | 'place' | 'view' | 'design' | 'help' | null

  function toggleLeftSidebar() { showLeftSidebar = !showLeftSidebar }
  function toggleRightSidebar() { showRightSidebar = !showRightSidebar }
  function toggleRibbon(menu, e) {
    e?.stopPropagation()
    activeRibbon = activeRibbon === menu ? null : menu
    showExportMenu = false
    showColorPicker = false
  }
  function toggleExportMenu(e) {
    e?.stopPropagation()
    activeRibbon = null
    showFileMenu = false
    showColorPicker = false
    showExportMenu = !showExportMenu
  }
  function closeAllMenus() {
    activeRibbon = null
    showExportMenu = false
    showFileMenu = false
    showColorPicker = false
  }

  // ── EasyEDA CAD Quick Actions ─────────────────────────
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

  // Reactive ERC analysis
  $: ercResult = runERC($compsStore, $wiresStore)

  // ── Tools ─────────────────────────────────────────────
  const TOOLS = [
    { id:'select', icon:'▲', label:'Select', title:'Mode Pilih (V)' },
    { id:'wire',   icon:'⚡', label:'Wire',   title:'Tarik Kabel (W)' },
    { id:'label',  icon:'T', label:'Label',  title:'Teks Label (L)' },
  ]

  function setTool(id) {
    activeTool.set(id)
    if (id !== 'wire') canvasRef.cancelWire?.()
  }

  // ── Wire colors ───────────────────────────────────────
  const WIRE_COLORS = [
    { c:'#ef4444', t:'Power +12V'  },
    { c:'#374151', t:'GND'         },
    { c:'#4ade80', t:'Digital'     },
    { c:'#f59e0b', t:'Analog'      },
    { c:'#a78bfa', t:'I2C'         },
    { c:'#60a5fa', t:'SPI'         },
    { c:'#34d399', t:'UART'        },
    { c:'#fb923c', t:'PWM'         },
    { c:'#facc15', t:'Special'     },
    { c:'#818cf8', t:'USB'         },
  ]
  let activeColor = '#ef4444'
  $: activeColorObj = WIRE_COLORS.find(wc => wc.c.toLowerCase() === activeColor.toLowerCase()) || { c: activeColor, t: 'Custom' }
  function pickColor(c) { activeColor = c; canvasRef.setWireColor?.(c) }

  // ── Export / Import ───────────────────────────────────
  function exportJSON() {
    const data = { ...getDiagram(), project:projectName, savedAt:new Date().toISOString() }
    dl(JSON.stringify(data, null, 2), (projectName||'wiring')+'.json', 'application/json')
    flash('JSON exported ✓')
  }

  function importJSON() {
    pick('.json', text => {
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

  function toggleTheme() {
    isLightMode = !isLightMode
    try { localStorage.setItem('wiretool_theme', isLightMode ? 'light' : 'dark') } catch {}
    flash(isLightMode ? '☀️ Light Mode diaktifkan' : '🌙 Dark Mode diaktifkan')
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

  function exportPNG() {
    const svg = document.querySelector('.canvas-wrap svg')
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const clone = svg.cloneNode(true)
    const bg = isLightMode ? '#ffffff' : '#0d0d1a'
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', rect.width)
    clone.setAttribute('height', rect.height)
    clone.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
    clone.setAttribute('style', `background:${bg}`)

    const s = new XMLSerializer().serializeToString(clone)
    const can = document.createElement('canvas')
    const scale = 2
    can.width = rect.width * scale
    can.height = rect.height * scale
    const ctx = can.getContext('2d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, can.width, can.height)
    const img = new Image()
    const blob = new Blob([s], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      ctx.drawImage(img, 0, 0, can.width, can.height)
      dl(can.toDataURL('image/png'), (projectName || 'wiring') + '.png', null, true)
      URL.revokeObjectURL(url)
      flash('PNG exported ✓')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      flash('⚠ Failed to export PNG', '#f87171')
    }
    img.src = url
  }

  // Feature #1: Export SVG
  function exportSVG() {
    const svg = document.querySelector('.canvas-wrap svg')
    if (!svg) return
    const clone = svg.cloneNode(true)
    const bg = isLightMode ? '#ffffff' : '#0d0d1a'
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('style', `background:${bg}`)
    const s = new XMLSerializer().serializeToString(clone)
    dl(s, (projectName||'wiring')+'.svg', 'image/svg+xml')
    flash('SVG exported ✓')
  }

  // Feature #F1: Export Netlist as CSV
  function exportNetlist() {
    const nets = getNetlist()
    if (!nets.length) { flash('⚠ No connections yet', '#f59e0b'); return }
    const rows = [
      ['Net','Label','FromComp','FromPin','ToComp','ToPin','Color'],
      ...nets.map(n => [n.netId, n.label, n.from.compLabel, n.from.pinId, n.to.compLabel, n.to.pinId, n.color])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    dl(csv, (projectName||'wiring')+'-netlist.csv', 'text/csv')
    flash(`Netlist exported (${nets.length} nets) ✓`)
  }

  // Feature #F2: Export BOM as CSV
  function exportBOM() {
    const bom = getBOM()
    if (!bom.length) { flash('⚠ No components yet', '#f59e0b'); return }
    const rows = [
      ['Qty','ComponentID','Theme','Labels','Notes'],
      ...bom.map(b => [
        b.qty, b.id, b.theme,
        b.instances.map(i => i.label).join('; '),
        b.instances.map(i => i.notes).filter(Boolean).join('; ')
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    dl(csv, (projectName||'wiring')+'-bom.csv', 'text/csv')
    flash(`BOM exported (${bom.length} types) ✓`)
  }

  // Feature: Shareable URL via Hash
  async function shareDiagramLink() {
    try {
      const data = {
        project: projectName,
        components: $compsStore,
        wires: $wiresStore,
        sheetConfig: $sheetConfig
      }
      const jsonStr = JSON.stringify(data)
      const b64 = btoa(unescape(encodeURIComponent(jsonStr)))
      const url = new URL(window.location.href)
      url.hash = `data=${b64}`
      await navigator.clipboard.writeText(url.toString())
      flash('Tautan diagram berhasil disalin ke clipboard! 🔗')
    } catch (err) {
      flash('Gagal menyalin tautan diagram', '#f87171')
    }
  }

  // Feature: Print-to-PDF / Vector Print Export
  function printDiagram() {
    window.print()
  }

  function dl(content, name, mime, isHref=false) {
    const a = document.createElement('a')
    a.download = name
    if (isHref) {
      a.href = content
    } else {
      a.href = URL.createObjectURL(new Blob([content],{type:mime}))
    }
    a.click()
    if (!isHref) URL.revokeObjectURL(a.href)
  }

  function pick(accept, cb) {
    const inp = document.createElement('input')
    inp.type='file'; inp.accept=accept
    inp.onchange = e => {
      const f = e.target.files[0]; if (!f) return
      const r = new FileReader()
      r.onload = ev => cb(ev.target.result)
      r.readAsText(f)
    }
    inp.click()
  }

  // ── Templates ─────────────────────────────────────────
  async function loadTemplate(key) {
    const t = TEMPLATES[key]; if (!t) return
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
    loadDiagram({ components:t.components, wires:t.wires, labels:[] })
    projectName = t.label
    setTimeout(() => canvasRef.fitView?.(), 150)
  }

  // ── Flash ─────────────────────────────────────────────
  let flashMsg = ''
  function flash(msg) {
    flashMsg = msg
    setTimeout(() => { if (flashMsg===msg) flashMsg='' }, 2800)
  }

  // ── Feature #7: Diagram stats ─────────────────────────
  let showStats = false
  $: statsData = (() => {
    const cs = $compsStore
    const ws = $wiresStore
    const byTheme = {}
    cs.forEach(c => { byTheme[c.theme ?? 'other'] = (byTheme[c.theme ?? 'other'] ?? 0) + 1 })
    // Count unconnected pins
    const usedPinKeys = new Set(ws.map(w => w.fromComp+'::'+w.fromPin).concat(ws.map(w => w.toComp+'::'+w.toPin)))
    let totalPins = 0, connectedPins = 0
    cs.forEach(c => {
      const pins = c.isMCU
        ? [...(c.mcuPinsData?.left ?? []), ...(c.mcuPinsData?.right ?? [])]
        : (c.pins ?? [])
      totalPins += pins.length
      pins.forEach(p => { if (usedPinKeys.has(c.instanceId+'::'+p.id)) connectedPins++ })
    })
    return { total: cs.length, wires: ws.length, byTheme, totalPins, connectedPins }
  })()

  // ── Feature #8: Shortcut overlay ──────────────────────
  let showShortcuts = false
  const SHORTCUTS = [
    { key:'Ctrl+K / /',desc:'Cari & pasang komponen (EELib)' },
    { key:'V',        desc:'Select tool (Mode Pilih)' },
    { key:'W',        desc:'Wire tool (Tarik Jalur Kabel)' },
    { key:'T / L',    desc:'Text / Net Label' },
    { key:'P',        desc:'Pasang Power Port (▲ VCC)' },
    { key:'Shift+G',  desc:'Pasang Ground Port (⏚ GND)' },
    { key:'R',        desc:'Rotate 90° (Shift = -90°)' },
    { key:'X',        desc:'Flip Horizontal (Cermin Kiri-Kanan)' },
    { key:'Y',        desc:'Flip Vertical (Cermin Atas-Bawah)' },
    { key:'Ctrl+A',   desc:'Pilih Semua Komponen' },
    { key:'Del / BS', desc:'Hapus komponen atau kabel terpilih' },
    { key:'F',        desc:'Fit view ke seluruh skema' },
    { key:'Shift+F',  desc:'Zoom ke komponen terpilih' },
    { key:'G',        desc:'Ganti mode grid (Dots / Lines / Off)' },
    { key:'M',        desc:'Toggle minimap navigasi' },
    { key:'Ctrl+Z',   desc:'Undo aksi terakhir' },
    { key:'Ctrl+Y',   desc:'Redo' },
    { key:'Ctrl+D',   desc:'Duplikasi komponen' },
    { key:'Esc',      desc:'Batal / bersihkan seleksi' },
    { key:'Panah',    desc:'Nudge geser komponen (Shift = halus)' },
    { key:'Scroll',   desc:'Zoom in / out' },
    { key:'Alt+Drag', desc:'Pan geser kanvas bebas' },
    { key:'?',        desc:'Panduan shortcut ini' },
  ]

  // ── Keyboard (global) ─────────────────────────────────
  function onKeyDown(e) {
    if (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA' || e.target.isContentEditable) return

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
      closeAllMenus()
    }

    if (e.ctrlKey && (e.key==='z' || e.key==='Z')) { undo(); return }
    if (e.ctrlKey && (e.key==='y' || e.key==='Y')) { redo(); return }

    // Ctrl+A: Select All
    if (e.ctrlKey && (e.key==='a' || e.key==='A')) {
      e.preventDefault()
      selectAll()
      return
    }

    // Zoom to selection — Shift+F
    if ((e.key==='F' || e.key==='f') && e.shiftKey) {
      canvasRef.zoomToSelection?.(); return
    }

    // X: Flip Horizontal
    if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      doFlipX()
      return
    }

    // Y: Flip Vertical
    if ((e.key === 'y' || e.key === 'Y') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      doFlipY()
      return
    }

    // P: Place VCC port
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      placeVCC()
      return
    }

    // G / Shift+G: Place GND or toggle grid
    if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      if (e.shiftKey) {
        placeGND()
      } else {
        canvasRef.toggleGrid?.()
      }
      return
    }

    // R / Shift+R: Rotate selected components
    if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      doRotate(e.shiftKey ? -90 : 90)
      return
    }

    // Ctrl+D duplicate (single history snapshot)
    if (e.ctrlKey && (e.key==='d' || e.key==='D')) {
      e.preventDefault()
      const ms = $multiSelection
      if (ms.length > 1) {
        duplicateComponents(ms.filter(s => s.type==='component').map(s => s.id))
      } else if ($selection?.type === 'component') {
        duplicateComponent($selection.id)
      }
      return
    }

    // Delete selected
    if (e.key==='Delete' || e.key==='Backspace') {
      doDelete()
      return
    }

    const MAP = { v:'select',V:'select',w:'wire',W:'wire',l:'label',L:'label',t:'label',T:'label' }
    if (MAP[e.key]) { setTool(MAP[e.key]); return }
    if (e.key==='Escape') { setTool('select'); return }
    if ((e.key==='f'||e.key==='F') && !e.shiftKey) canvasRef.fitView?.()
    if (e.key==='m'||e.key==='M') canvasRef.toggleMinimap?.()
  }

  function handleDrop(compId, cx, cy) { canvasRef.handleDrop?.(compId, cx, cy) }

  // ── Feature #9: Auto-save restore on mount ────────────
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
        clearAutoSave()   // BUG FIX: clear if user declines, also prevents repeat
      }
    }
    initAutoSave()        // BUG FIX: enable auto-save only after this point
    loadTemplate('esp32s3-fi')
  })

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

  $: curTool = $activeTool
</script>

<svelte:window on:keydown={onKeyDown} on:click={closeAllMenus}/>

<div class="app" class:light-app={isLightMode}>
  <!-- CAD HEADER: TIER 1 - EasyEDA MENU RIBBON ─────────────── -->
  <header class="cad-header">
    <div class="cad-ribbon-left">
      <!-- Toggle Left Sidebar (EELib & Design Manager) -->
      <button class="nav-toggle-btn" on:click={toggleLeftSidebar} title="Buka/Tutup EELib & Design Manager" class:btn-active={showLeftSidebar}>
        📦 <span class="nav-toggle-lbl">EELib</span>
      </button>

      <div class="logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="7" height="14" rx="2" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5"/>
          <rect x="15" y="5" width="7" height="14" rx="2" fill="#f97316" stroke="#ea580c" stroke-width="1.5"/>
          <path d="M9 8.5h6M9 12h6M9 15.5h6" stroke="#4ade80" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="logo-text">EasyEDA</span>
      </div>
      <span class="cad-tag">{$activeEditorView === 'pcb' ? 'PCB' : 'SCH'}</span>

      <!-- Mode Switcher: Schematic & Wiring vs PCB Layout -->
      <div class="cad-mode-switcher">
        <button
          class="cad-mode-btn"
          class:cad-mode-active={$activeEditorView === 'wiring'}
          on:click={() => setActiveEditorView('wiring')}
          title="Buka Kanvas Perancangan Skematik & Wiring"
        >
          <span>🔌 Skematik</span>
        </button>
        <button
          class="cad-mode-btn cad-mode-pcb"
          class:cad-mode-active={$activeEditorView === 'pcb'}
          on:click={() => setActiveEditorView('pcb')}
          title="Buka Studio Tata Letak Papan PCB & Jalur Tembaga"
        >
          <span>🟩 PCB Layout</span>
        </button>
      </div>

      {#if $activeEditorView === 'wiring'}
        <button
          class="cad-render-btn"
          class:cad-render-active={$renderMode === 'realistic'}
          on:click={toggleRenderMode}
          title="Ubah tampilan komponen fisik realistis Wokwi atau simbol skematik"
        >
          <span>{$renderMode === 'realistic' ? '🎨 Wokwi Fisik' : '📐 Simbol'}</span>
        </button>
      {/if}

      <!-- Ribbon Menus -->
      <nav class="ribbon-menus">
        <!-- File Menu -->
        <div class="menu-item-wrap">
          <button class="menu-tab-btn" class:menu-open={activeRibbon==='file'} on:click={(e) => toggleRibbon('file', e)}>
            File ▾
          </button>
          {#if activeRibbon === 'file'}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="ribbon-dropdown" on:click|stopPropagation>
              <button class="rdd-item" on:click={() => { handleClearDiagram(); activeRibbon = null }}>
                <span class="rdd-icon">📄</span> New Schematic
              </button>
              <button class="rdd-item" on:click={() => { importJSON(); activeRibbon = null }}>
                <span class="rdd-icon">📥</span> Open / Import JSON...
              </button>
              <button class="rdd-item" on:click={() => { exportJSON(); activeRibbon = null }}>
                <span class="rdd-icon">💾</span> Save JSON Diagram
              </button>
              <button class="rdd-item" on:click={() => { shareDiagramLink(); activeRibbon = null }}>
                <span class="rdd-icon">🔗</span> Share Link (Tautan Proyek)
              </button>
              <button class="rdd-item" on:click={() => { printDiagram(); activeRibbon = null }}>
                <span class="rdd-icon">🖨</span> Print / PDF Export
              </button>
              <div class="rdd-divider"></div>
              <button class="rdd-item" on:click={() => { exportPNG(); activeRibbon = null }}>
                <span class="rdd-icon">🖼</span> Export PNG (Image)
              </button>
              <button class="rdd-item" on:click={() => { exportSVG(); activeRibbon = null }}>
                <span class="rdd-icon">📐</span> Export SVG (Vector)
              </button>
              <button class="rdd-item" on:click={() => { exportNetlist(); activeRibbon = null }}>
                <span class="rdd-icon">🔌</span> Export Netlist (CSV)
              </button>
              <button class="rdd-item" on:click={() => { exportBOM(); activeRibbon = null }}>
                <span class="rdd-icon">📋</span> Export BOM (CSV)
              </button>
              <button class="rdd-item" on:click={() => { showWokwiModal = true; activeRibbon = null }}>
                <span class="rdd-icon">🚀</span> Wokwi Simulation JSON
              </button>
              <div class="rdd-divider"></div>
              <button class="rdd-item rdd-danger" on:click={() => { handleClearDiagram(); activeRibbon = null }}>
                <span class="rdd-icon">🗑️</span> Kosongkan Seluruh Diagram
              </button>
            </div>
          {/if}
        </div>

        <!-- Edit Menu -->
        <div class="menu-item-wrap">
          <button class="menu-tab-btn" class:menu-open={activeRibbon==='edit'} on:click={(e) => toggleRibbon('edit', e)}>
            Edit ▾
          </button>
          {#if activeRibbon === 'edit'}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="ribbon-dropdown" on:click|stopPropagation>
              <button class="rdd-item" on:click={() => { undo(); activeRibbon = null }}>
                <span class="rdd-icon">↩</span> Undo <span class="rdd-key">Ctrl+Z</span>
              </button>
              <button class="rdd-item" on:click={() => { redo(); activeRibbon = null }}>
                <span class="rdd-icon">↪</span> Redo <span class="rdd-key">Ctrl+Y</span>
              </button>
              <div class="rdd-divider"></div>
              <button class="rdd-item" on:click={() => { selectAll(); activeRibbon = null }}>
                <span class="rdd-icon">⬚</span> Select All <span class="rdd-key">Ctrl+A</span>
              </button>
              <button class="rdd-item" on:click={() => { doRotate(90); activeRibbon = null }}>
                <span class="rdd-icon">↻</span> Rotate 90° <span class="rdd-key">R</span>
              </button>
              <button class="rdd-item" on:click={() => { doFlipX(); activeRibbon = null }}>
                <span class="rdd-icon">⇆</span> Flip Horizontal <span class="rdd-key">X</span>
              </button>
              <button class="rdd-item" on:click={() => { doFlipY(); activeRibbon = null }}>
                <span class="rdd-icon">⇅</span> Flip Vertical <span class="rdd-key">Y</span>
              </button>
              <div class="rdd-divider"></div>
              <button class="rdd-item rdd-danger" on:click={() => { doDelete(); activeRibbon = null }}>
                <span class="rdd-icon">🗑️</span> Delete <span class="rdd-key">Del</span>
              </button>
            </div>
          {/if}
        </div>

        <!-- Place Menu -->
        <div class="menu-item-wrap">
          <button class="menu-tab-btn" class:menu-open={activeRibbon==='place'} on:click={(e) => toggleRibbon('place', e)}>
            Place ▾
          </button>
          {#if activeRibbon === 'place'}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="ribbon-dropdown" on:click|stopPropagation>
              <button class="rdd-item" on:click={() => { setTool('wire'); activeRibbon = null }}>
                <span class="rdd-icon">⚡</span> Wire <span class="rdd-key">W</span>
              </button>
              <button class="rdd-item" on:click={() => { placeGND(); activeRibbon = null }}>
                <span class="rdd-icon">⏚</span> Net Port GND <span class="rdd-key">Shift+G</span>
              </button>
              <button class="rdd-item" on:click={() => { placeVCC('vcc-flag'); activeRibbon = null }}>
                <span class="rdd-icon">▲</span> Net Port VCC (+5V) <span class="rdd-key">P</span>
              </button>
              <button class="rdd-item" on:click={() => { placeVCC('v33-flag'); activeRibbon = null }}>
                <span class="rdd-icon">▲</span> Net Port +3.3V
              </button>
              <button class="rdd-item" on:click={() => { placeVCC('v12-flag'); activeRibbon = null }}>
                <span class="rdd-icon">▲</span> Net Port +12V
              </button>
              <div class="rdd-divider"></div>
              <button class="rdd-item" on:click={() => { setTool('label'); activeRibbon = null }}>
                <span class="rdd-icon">T</span> Text / Net Label <span class="rdd-key">T</span>
              </button>
              <button class="rdd-item" on:click={() => { showQuickPalette = true; activeRibbon = null }}>
                <span class="rdd-icon">🔍</span> Cari Komponen (EELib) <span class="rdd-key">Ctrl+K</span>
              </button>
            </div>
          {/if}
        </div>

        <!-- View Menu -->
        <div class="menu-item-wrap">
          <button class="menu-tab-btn" class:menu-open={activeRibbon==='view'} on:click={(e) => toggleRibbon('view', e)}>
            View ▾
          </button>
          {#if activeRibbon === 'view'}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="ribbon-dropdown" on:click|stopPropagation>
              <button class="rdd-item" on:click={() => { canvasRef.fitView?.(); activeRibbon = null }}>
                <span class="rdd-icon">⊡</span> Fit View <span class="rdd-key">F</span>
              </button>
              <button class="rdd-item" on:click={() => { canvasRef.zoomToSelection?.(); activeRibbon = null }}>
                <span class="rdd-icon">🔍</span> Zoom to Selection <span class="rdd-key">Shift+F</span>
              </button>
              <div class="rdd-divider"></div>
              <button class="rdd-item" on:click={() => { canvasRef.toggleGrid?.(); activeRibbon = null }}>
                <span class="rdd-icon">∷</span> Grid Mode: <strong>{$edaGridType.toUpperCase()}</strong> <span class="rdd-key">G</span>
              </button>
              <button class="rdd-item" on:click={() => { canvasRef.toggleSheet?.(); activeRibbon = null }}>
                <span class="rdd-icon">📄</span> Drawing Sheet Frame: <strong>{$showDrawingSheet ? 'ON' : 'OFF'}</strong>
              </button>
              <button class="rdd-item" on:click={() => { showPowerFlow.update(v => !v); activeRibbon = null }}>
                <span class="rdd-icon">⚡</span> Animated Power Flow: <strong>{$showPowerFlow ? 'ON' : 'OFF'}</strong>
              </button>
              <button class="rdd-item" on:click={() => { updateSheetConfig({ size: $sheetConfig.size === 'A4' ? 'A3' : 'A4' }); activeRibbon = null }}>
                <span class="rdd-icon">📐</span> Sheet Size: <strong>{$sheetConfig.size}</strong> (A4/A3)
              </button>
              <button class="rdd-item" on:click={() => { canvasRef.toggleMinimap?.(); activeRibbon = null }}>
                <span class="rdd-icon">🗺</span> Minimap <span class="rdd-key">M</span>
              </button>
              <div class="rdd-divider"></div>
              <button class="rdd-item" on:click={() => { toggleTheme(); activeRibbon = null }}>
                <span class="rdd-icon">{isLightMode ? '☀️' : '🌙'}</span> Mode Tema: <strong>{isLightMode ? 'Light' : 'Dark'}</strong>
              </button>
            </div>
          {/if}
        </div>

        <!-- Design Menu -->
        <div class="menu-item-wrap">
          <button class="menu-tab-btn" class:menu-open={activeRibbon==='design'} on:click={(e) => toggleRibbon('design', e)}>
            Design ▾
          </button>
          {#if activeRibbon === 'design'}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="ribbon-dropdown" on:click|stopPropagation>
              <button class="rdd-item" on:click={() => { showLeftSidebar = true; activeRibbon = null }}>
                <span class="rdd-icon">🌲</span> Design Manager (Parts & Nets)
              </button>
              <button class="rdd-item" on:click={() => { showERCModal = true; activeRibbon = null }}>
                <span class="rdd-icon">⚡</span> Run Electrical Rules Check (ERC)
              </button>
              <button class="rdd-item" on:click={() => { showCodeGenModal = true; activeRibbon = null }}>
                <span class="rdd-icon">💻</span> Generate Firmware Pin Code
              </button>
              <button class="rdd-item" on:click={() => { openSimulatorLab(); activeRibbon = null }}>
                <span class="rdd-icon">⚡</span> Buka Virtual MCU Simulator Lab
              </button>
              <button class="rdd-item" on:click={() => { showStats = true; activeRibbon = null }}>
                <span class="rdd-icon">📊</span> Diagram Statistics
              </button>
            </div>
          {/if}
        </div>

        <!-- Help Menu -->
        <div class="menu-item-wrap">
          <button class="menu-tab-btn" class:menu-open={activeRibbon==='help'} on:click={(e) => toggleRibbon('help', e)}>
            Help ▾
          </button>
          {#if activeRibbon === 'help'}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="ribbon-dropdown" on:click|stopPropagation>
              <button class="rdd-item" on:click={() => { showShortcuts = true; activeRibbon = null }}>
                <span class="rdd-icon">⌨</span> Keyboard Shortcuts <span class="rdd-key">?</span>
              </button>
              <button class="rdd-item" on:click={() => {
                showAlert({
                  title: 'EasyEDA Web Schematic',
                  message: 'Aplikasi schematic CAD berbasis web yang dilengkapi dengan Dot Grid, Drawing Sheet CAD, EELib, Design Manager (Net & Part inspector), rotasi & flip komponen, serta export Netlist & BOM.',
                  icon: '✨'
                });
                activeRibbon = null;
              }}>
                <span class="rdd-icon">ℹ️</span> Tentang Mode EasyEDA
              </button>
            </div>
          {/if}
        </div>
      </nav>
    </div>

    <!-- Center: Project Title -->
    <div class="cad-ribbon-center">
      <!-- svelte-ignore a11y-interactive-supports-focus -->
      <span
        class="proj-name"
        contenteditable="true"
        role="textbox"
        aria-label="Project name"
        title="Klik untuk mengubah nama proyek"
        on:blur={e => projectName = e.target.textContent.trim()}
        on:keydown={e => e.key==='Enter' && e.target.blur()}
      >{projectName}</span>
    </div>

    <!-- Right: Status, Code, Export, Properties -->
    <div class="cad-ribbon-right">
      <!-- Search Palette -->
      <button class="btn btn-search" on:click={() => showQuickPalette = true} title="Cari Komponen Cepat (Ctrl+K atau /)">
        🔍 <span class="shortcut-tag">Ctrl+K</span>
      </button>

      <!-- Realtime ERC status button -->
      <button class="btn btn-erc" on:click={() => showERCModal = true} title="Electrical Rules Check (ERC)">
        ⚡ ERC
        {#if ercResult.errors.length > 0}
          <span class="badge-erc badge-erc-err">🚨 {ercResult.errors.length}</span>
        {:else if ercResult.warnings.length > 0}
          <span class="badge-erc badge-erc-warn">⚠️ {ercResult.warnings.length}</span>
        {:else}
          <span class="badge-erc badge-erc-ok">✓ OK</span>
        {/if}
      </button>

      <!-- Code generator button -->
      <button class="btn btn-code" on:click={() => showCodeGenModal = true} title="Generate C++ / Python pin headers">
        💻 <span class="btn-text">Code</span>
      </button>

      <!-- Simulator Lab button -->
      <button class="btn btn-sim" on:click={openSimulatorLab} title="Buka Virtual MCU & Circuit Simulator Lab">
        ⚡ <span class="btn-text">Simulator</span>
      </button>

      <!-- Export Dropdown -->
      <div class="dropdown-wrap">
        <button class="btn btn-pri" on:click={toggleExportMenu} title="Export diagram to multiple formats">
          📤 <span class="btn-text">Export</span> <span class="arrow-down">▾</span>
        </button>

        {#if showExportMenu}
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div class="export-dropdown" on:click|stopPropagation>
            <div class="dd-title">Pilih Format Ekspor</div>
            <button class="dd-item" on:click={() => { exportPNG(); showExportMenu = false }}>
              <span class="dd-icon">🖼</span>
              <div class="dd-info">
                <span class="dd-label">Gambar High-Res (PNG)</span>
                <span class="dd-desc">Untuk dokumentasi skema atau laporan</span>
              </div>
            </button>
            <button class="dd-item" on:click={() => { exportSVG(); showExportMenu = false }}>
              <span class="dd-icon">📐</span>
              <div class="dd-info">
                <span class="dd-label">Vector Graphic (SVG)</span>
                <span class="dd-desc">Grafik vektor tajam tanpa pecah</span>
              </div>
            </button>
            <button class="dd-item" on:click={() => { exportJSON(); showExportMenu = false }}>
              <span class="dd-icon">💾</span>
              <div class="dd-info">
                <span class="dd-label">Diagram JSON (.json)</span>
                <span class="dd-desc">Simpan untuk diedit kembali nanti</span>
              </div>
            </button>
            <button class="dd-item" on:click={() => { printDiagram(); showExportMenu = false }}>
              <span class="dd-icon">🖨</span>
              <div class="dd-info">
                <span class="dd-label">Cetak / Print to PDF</span>
                <span class="dd-desc">Cetak layout skematik lanskap A4/A3</span>
              </div>
            </button>
            <button class="dd-item" on:click={() => { shareDiagramLink(); showExportMenu = false }}>
              <span class="dd-icon">🔗</span>
              <div class="dd-info">
                <span class="dd-label">Bagikan Tautan Link Proyek</span>
                <span class="dd-desc">Salin URL instan untuk dibuka siapa saja</span>
              </div>
            </button>
            <button class="dd-item" on:click={() => { showWokwiModal = true; showExportMenu = false }}>
              <span class="dd-icon">🚀</span>
              <div class="dd-info">
                <span class="dd-label">Wokwi Simulator JSON</span>
                <span class="dd-desc">Jalankan simulasi langsung di browser</span>
              </div>
            </button>
            <div class="dd-divider"></div>
            <button class="dd-item" on:click={() => { exportNetlist(); showExportMenu = false }}>
              <span class="dd-icon">🔌</span>
              <div class="dd-info">
                <span class="dd-label">Netlist Connections (CSV)</span>
                <span class="dd-desc">Daftar koneksi antar-pin dan kabel</span>
              </div>
            </button>
            <button class="dd-item" on:click={() => { exportBOM(); showExportMenu = false }}>
              <span class="dd-icon">📋</span>
              <div class="dd-info">
                <span class="dd-label">Bill of Materials (BOM)</span>
                <span class="dd-desc">Daftar kuantitas & spesifikasi part</span>
              </div>
            </button>
          </div>
        {/if}
      </div>

      <!-- Toggle Right Inspector Button -->
      <button class="nav-toggle-btn" on:click={toggleRightSidebar} title="Buka/Tutup Panel Properties" class:btn-active={showRightSidebar}>
        ⚙️ <span class="nav-toggle-lbl">Properties</span>
      </button>

      {#if flashMsg}<span class="flash">{flashMsg}</span>{/if}
    </div>
  </header>

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

    <!-- CANVAS COLUMN ───────────────────────────────── -->
    <div class="canvas-col">
      <!-- TIER 2: CAD ACTION TOOLSTRIP (Hanya tampil di mode Skematik) -->
      {#if $activeEditorView === 'wiring'}
        <div class="toolbar cad-action-strip">
          <!-- Tools & Net Ports Segment -->
          <div class="tg tool-group">
            {#each TOOLS as t}
              <button class="tbtn" class:active={curTool===t.id}
                title={t.title} on:click={() => setTool(t.id)}>
                <span class="tbtn-icon">{t.icon}</span>
                <span class="tbtn-txt">{t.label}</span>
              </button>
            {/each}
            <div class="tg-sep"></div>
            <!-- Quick Place Net Ports (Iconic EasyEDA features!) -->
            <button class="tbtn flag-btn" on:click={placeGND} title="Pasang Ground Port (⏚ GND) [Shift+G]">
              <span class="tbtn-icon">⏚</span>
              <span class="tbtn-txt">GND</span>
            </button>
            <button class="tbtn flag-btn" on:click={() => placeVCC('vcc-flag')} title="Pasang Power Port (▲ +5V) [P]">
              <span class="tbtn-icon">▲</span>
              <span class="tbtn-txt">VCC</span>
            </button>
          </div>

          <!-- Routing Mode Toggle -->
          <div class="tg routing-tg">
            <button class="tbtn mode-btn" class:active={$routingMode === 'orthogonal'} on:click={() => routingMode.set('orthogonal')} title="Siku 90° (Orthogonal)">
              <span>⎶</span> <span class="tbtn-txt">Siku</span>
            </button>
            <button class="tbtn mode-btn" class:active={$routingMode === 'curved'} on:click={() => routingMode.set('curved')} title="Lengkung (Smooth Bezier)">
              <span>〰</span> <span class="tbtn-txt">Lengkung</span>
            </button>
            <button class="tbtn mode-btn" class:active={$routingMode === 'direct'} on:click={() => routingMode.set('direct')} title="Lurus (Direct)">
              <span>╱</span> <span class="tbtn-txt">Lurus</span>
            </button>
          </div>

          <!-- Wire Color Popover -->
          <div class="tg wire-color-tg dropdown-wrap">
            <button class="tbtn color-popover-btn" on:click|stopPropagation={() => showColorPicker = !showColorPicker} title="Pilih Warna Kabel">
              <span class="cdot-active-preview" style="background:{activeColor}"></span>
              <span class="col-lbl-name">{activeColorObj ? activeColorObj.t : 'Wire'}</span>
              <span class="arrow-down-sm">▾</span>
            </button>

            {#if showColorPicker}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div class="color-popover" on:click|stopPropagation>
                <div class="color-popover-title">Preset Warna Jalur & Kabel</div>
                <div class="color-grid">
                  {#each WIRE_COLORS as wc}
                    <button
                      class="color-chip"
                      class:chip-selected={activeColor === wc.c}
                      on:click={() => { pickColor(wc.c); showColorPicker = false }}
                      title="{wc.t} ({wc.c})"
                    >
                      <span class="chip-dot" style="background:{wc.c}"></span>
                      <span class="chip-label">{wc.t}</span>
                    </button>
                  {/each}
                </div>
                <div class="color-custom-row">
                  <span class="color-custom-lbl">Warna Bebas:</span>
                  <input type="color" value={activeColor} on:input={e => pickColor(e.target.value)} class="col-custom-inp" title="Custom color picker" />
                </div>
              </div>
            {/if}
          </div>

          <!-- Orientation & Transforms Group (Rotate & Flip) -->
          <div class="tg transform-tg">
            <button class="tbtn" on:click={() => doRotate(90)} title="Putar Komponen 90° (R)">
              <span>↻</span> <span class="tbtn-txt">Rotate</span>
            </button>
            <button class="tbtn" on:click={doFlipX} title="Flip Horizontal (Cermin Kiri-Kanan) [X]">
              <span>⇆</span> <span class="tbtn-txt">Flip X</span>
            </button>
            <button class="tbtn" on:click={doFlipY} title="Flip Vertical (Cermin Atas-Bawah) [Y]">
              <span>⇅</span> <span class="tbtn-txt">Flip Y</span>
            </button>
          </div>

          <!-- Canvas View Controls (Grid & Sheet) -->
          <div class="tg toggles-group">
            <button class="tbtn" on:click={() => canvasRef.toggleGrid?.()} title="Ganti Mode Grid (Dots / Lines / Off) [G]">
              <span>∷</span> <span class="tbtn-txt">{$edaGridType.toUpperCase()}</span>
            </button>
            <button class="tbtn" class:active={$showDrawingSheet} on:click={() => canvasRef.toggleSheet?.()} title="Tampilkan/Sembunyikan Bingkai Drawing Sheet CAD">
              <span>📄</span> <span class="tbtn-txt">Sheet</span>
            </button>
            <button class="tbtn probe-btn" class:probe-active={$showPowerFlow} on:click={() => showPowerFlow.update(v => !v)} title="Simulasi Aliran Arus / Voltage Probe">
              <span>⚡</span> <span class="tbtn-txt">Probe</span>
            </button>
            <button class="tbtn" on:click={shareDiagramLink} title="Salin Tautan Proyek (Share Link) 🔗">
              <span>🔗</span> <span class="tbtn-txt">Share</span>
            </button>
            <button class="tbtn" on:click={() => canvasRef.toggleMinimap?.()} title="Tampilkan/Sembunyikan Minimap (M)">🗺</button>
            <button class="tbtn theme-toggle-btn" on:click={toggleTheme} title="Ganti Tema (Light / Dark)">
              <span>{isLightMode ? '☀️' : '🌙'}</span>
              <span class="tbtn-txt">{isLightMode ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          <!-- History & Zoom Controls -->
          <div class="tg zoom-group">
            <button class="tbtn" on:click={undo} title="Undo (Ctrl+Z)">↩</button>
            <button class="tbtn" on:click={redo} title="Redo (Ctrl+Y)">↪</button>
            <div class="tg-sep"></div>
            <button class="tbtn" on:click={() => canvasRef.fitView?.()} title="Fit View (F)">Fit</button>
            <button class="tbtn" on:click={() => canvasRef.zoomIn?.()} title="Zoom In (+)">+</button>
            <button class="tbtn" on:click={() => canvasRef.zoomOut?.()} title="Zoom Out (−)">−</button>
          </div>
        </div>
      {/if}

      <!-- CANVAS OR PCB STUDIO -->
      {#if $activeEditorView === 'pcb'}
        <PcbLayoutView />
      {:else}
        <Canvas bind:api={canvasRef} {isLightMode} {projectName}/>
      {/if}
    </div>

    <!-- RIGHT SIDEBAR (PROPERTIES & TEMPLATES) ──────── -->
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

  <!-- Feature #7: Diagram Stats Overlay ───────────────── -->
  {#if showStats}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="overlay-backdrop" on:click={() => showStats = false}>
      <!-- svelte-ignore a11y-interactive-supports-focus -->
      <div class="overlay-box" on:click|stopPropagation role="dialog" aria-label="Diagram statistics" tabindex="-1">
        <div class="ov-head">📊 Diagram Stats <button class="ov-close" on:click={() => showStats = false}>✕</button></div>
        <div class="stats-grid">
          <div class="stat-card"><span class="stat-val">{statsData.total}</span><span class="stat-lbl">Components</span></div>
          <div class="stat-card"><span class="stat-val">{statsData.wires}</span><span class="stat-lbl">Wires</span></div>
          <div class="stat-card"><span class="stat-val">{statsData.connectedPins}</span><span class="stat-lbl">Connected Pins</span></div>
          <div class="stat-card"><span class="stat-val" class:warn={statsData.totalPins - statsData.connectedPins > 0}>{statsData.totalPins - statsData.connectedPins}</span><span class="stat-lbl">Unconnected</span></div>
        </div>
        <div class="ov-sub">By Category</div>
        <div class="theme-list">
          {#each Object.entries(statsData.byTheme) as [theme, count]}
            <div class="theme-row">
              <span class="theme-dot" style="background:{({mcu:'#4f9cf9',sensor:'#4ade80',power:'#f87171',display:'#a78bfa',comms:'#60a5fa',output:'#f97316',passive:'#94a3b8',switch:'#facc15'})[theme]??'#94a3b8'}"></span>
              <span class="theme-name">{theme}</span>
              <span class="theme-count">{count}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Feature #8: Keyboard Shortcut Overlay ───────────── -->
  {#if showShortcuts}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="overlay-backdrop" on:click={() => showShortcuts = false}>
      <!-- svelte-ignore a11y-interactive-supports-focus -->
      <div class="overlay-box" on:click|stopPropagation role="dialog" aria-label="Keyboard shortcuts" tabindex="-1">
        <div class="ov-head">⌨ Keyboard Shortcuts <button class="ov-close" on:click={() => showShortcuts = false}>✕</button></div>
        <div class="shortcut-grid">
          {#each SHORTCUTS as sc}
            <kbd class="sc-key">{sc.key}</kbd>
            <span class="sc-desc">{sc.desc}</span>
          {/each}
        </div>
        <div class="ov-footer">Press <kbd class="sc-key">?</kbd> or <kbd class="sc-key">Esc</kbd> to close</div>
      </div>
    </div>
  {/if}

  <!-- Feature: Electrical Rules Check Modal -->
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

  <!-- Feature: Pin-Definition Code Generator Modal -->
  <CodeGenModal
    bind:show={showCodeGenModal}
    components={$compsStore}
    wires={$wiresStore}
    {projectName}
  />

  <!-- Feature: Wokwi Simulator Export Modal -->
  <WokwiModal
    bind:show={showWokwiModal}
    components={$compsStore}
    wires={$wiresStore}
    {projectName}
  />

  <!-- Feature: Quick Component Search Palette -->
  <QuickPaletteModal
    bind:show={showQuickPalette}
    canvasCenter={canvasRef.getViewCenter?.() || { x: 400, y: 300 }}
    on:added={() => flash('Komponen ditambahkan ke kanvas ✓')}
  />

  <!-- Global Sleek Dialog & Confirmation Modal (Replaces browser alert/confirm/prompt) -->
  <DialogModal />
</div>

<style>
  :global(*,*::before,*::after){ box-sizing:border-box; margin:0; padding:0; }
  :global(html,body){ height:100%; overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    font-size:13px; background:#0b0f19; color:#f1f5f9; }
  :global(*){ scrollbar-width:thin; scrollbar-color:#374151 transparent; }

  .app{ display:flex; flex-direction:column; height:100vh; overflow:hidden; background:#0b0f19; }

  /* ── EasyEDA CAD Header & Ribbon ── */
  .cad-header{ height:48px; background:#0f172a; border-bottom:1px solid #1e293b;
    display:flex; align-items:center; padding:0 10px; gap:8px;
    flex-shrink:0; box-shadow:0 1px 4px rgba(0,0,0,0.4); z-index:40; justify-content:space-between; }
  .cad-ribbon-left{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .cad-ribbon-center{ flex:1; display:flex; justify-content:center; min-width:0; }
  .cad-ribbon-right{ display:flex; align-items:center; gap:6px; justify-content:flex-end; flex-shrink:0; }

  .cad-tag{ background:#0284c7; color:#fff; font-size:9px; font-weight:800; padding:2px 6px;
    border-radius:3px; font-family:monospace; letter-spacing:0.5px; }

  /* ── CAD Mode Switcher & Realistic Toggle ── */
  .cad-mode-switcher {
    display: inline-flex;
    align-items: center;
    background: #090d16;
    border: 1px solid #1e293b;
    border-radius: 7px;
    padding: 2px;
    gap: 2px;
    margin-left: 6px;
  }
  .cad-mode-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: transparent;
    color: #94a3b8;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .cad-mode-btn:hover {
    background: #1e293b;
    color: #ffffff;
  }
  .cad-mode-btn.cad-mode-active {
    background: #0284c7;
    color: #ffffff;
    border-color: #38bdf8;
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
  }
  .cad-mode-pcb.cad-mode-active {
    background: #059669;
    border-color: #10b981;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
  }
  .cad-render-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border-radius: 6px;
    border: 1px solid #334155;
    background: #1e293b;
    color: #cbd5e1;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    margin-left: 4px;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .cad-render-btn:hover {
    background: #334155;
    color: #ffffff;
  }
  .cad-render-btn.cad-render-active {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border-color: rgba(245, 158, 11, 0.4);
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.25);
  }

  .ribbon-menus{ display:flex; align-items:center; gap:2px; margin-left:6px; }
  .menu-item-wrap{ position:relative; }
  .menu-tab-btn{ background:transparent; border:1px solid transparent; border-radius:4px;
    color:#cbd5e1; font-size:11.5px; font-weight:600; padding:5px 8px; cursor:pointer; transition:all .12s; }
  .menu-tab-btn:hover, .menu-tab-btn.menu-open{ background:#1e293b; color:#38bdf8; border-color:#334155; }

  .ribbon-dropdown{ position:absolute; top:calc(100% + 4px); left:0; width:230px;
    background:#0f172a; border:1px solid #334155; border-radius:7px;
    box-shadow:0 12px 32px rgba(0,0,0,0.7); padding:5px; z-index:1000;
    display:flex; flex-direction:column; gap:2px; animation:pop-down .12s ease-out; }
  .rdd-item{ display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:4px;
    border:none; background:transparent; color:#f1f5f9; font-size:11.5px; text-align:left; cursor:pointer;
    transition:background .1s; width:100%; }
  .rdd-item:hover{ background:#1e293b; color:#38bdf8; }
  .rdd-icon{ font-size:13px; width:18px; text-align:center; flex-shrink:0; }
  .rdd-key{ margin-left:auto; font-size:10px; color:#64748b; font-family:monospace; }
  .rdd-divider{ height:1px; background:#1e293b; margin:3px 0; }
  .rdd-danger:hover{ background:rgba(239,68,68,0.15); color:#f87171; }

  .flag-btn{ background:rgba(56,189,248,0.08); border-color:rgba(56,189,248,0.25); color:#38bdf8; }
  .flag-btn:hover{ background:#0284c7; color:#fff; border-color:#0284c7; }
  .transform-tg{ display:flex; align-items:center; gap:2px; }

  /* ── Brand Logo & Text ── */
  .logo{ display:flex; align-items:center; gap:7px; font-weight:800; font-size:15px; color:#38bdf8; }
  .logo-text{ letter-spacing:-0.3px; }

  .proj-name{ font-size:14px; font-weight:600; color:#f8fafc; outline:none;
    padding:4px 10px; border-radius:6px; border:1px solid transparent;
    max-width:280px; text-align:center; transition:all .15s;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .proj-name:hover{ background:#1e293b; border-color:#334155; }
  .proj-name:focus{ border-color:#38bdf8; background:#1e293b; box-shadow:0 0 0 2px rgba(56,189,248,0.2); }

  /* Buttons */
  .btn{ display:inline-flex; align-items:center; gap:5px; padding:6px 11px;
    border-radius:6px; border:1px solid #334155; cursor:pointer;
    font-size:12px; font-weight:600; background:#1e293b; color:#cbd5e1;
    transition:all .12s; white-space:nowrap; user-select:none; }
  .btn:hover{ background:#334155; color:#f8fafc; border-color:#475569; }
  .btn-pri{ background:#0284c7; color:#fff; border-color:#0369a1; }
  .btn-pri:hover{ background:#0369a1; }

  .nav-toggle-btn{ display:inline-flex; align-items:center; gap:5px; padding:6px 9px;
    border-radius:6px; border:1px solid #334155; cursor:pointer;
    font-size:12px; font-weight:600; background:#1e293b; color:#94a3b8;
    transition:all .12s; }
  .nav-toggle-btn:hover{ background:#334155; color:#f8fafc; }
  .nav-toggle-btn.btn-active{ background:#0369a1; color:#fff; border-color:#38bdf8; }

  .btn-search{ background:#1e1b4b; border-color:#3730a3; color:#a5b4fc; }
  .btn-search:hover{ background:#312e81; color:#fff; border-color:#6366f1; }
  .shortcut-tag{ font-size:10px; background:rgba(0,0,0,0.3); padding:1px 5px; border-radius:3px; color:#c7d2fe; }

  .btn-erc{ display:inline-flex; align-items:center; gap:6px; }
  .badge-erc{ font-size:10px; font-weight:700; padding:1px 6px; border-radius:10px; }
  .badge-erc-err{ background:rgba(239,68,68,0.2); color:#f87171; border:1px solid #ef4444; }
  .badge-erc-warn{ background:rgba(245,158,11,0.2); color:#fbbf24; border:1px solid #f59e0b; }
  .badge-erc-ok{ background:rgba(74,222,128,0.15); color:#4ade80; border:1px solid #4ade80; }

  .btn-code{ background:#1e293b; }
  .btn-sim{ background:#0e3a53; color:#38bdf8; border:1px solid #0284c7; }
  .btn-sim:hover{ background:#0284c7; color:#fff; box-shadow:0 0 12px rgba(56,189,248,0.4); }
  .flash{ font-size:12px; color:#4ade80; font-weight:600; animation:fade-in .15s; }

  /* ── Export Dropdown ── */
  .dropdown-wrap{ position:relative; }
  .arrow-down{ font-size:9px; opacity:0.8; }
  .export-dropdown{ position:absolute; right:0; top:calc(100% + 6px);
    width:250px; background:#0f172a; border:1px solid #334155; border-radius:8px;
    box-shadow:0 12px 32px rgba(0,0,0,0.6); padding:6px; z-index:100;
    display:flex; flex-direction:column; gap:2px; animation:pop-down .12s ease-out; }
  @keyframes pop-down{ from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  .dd-title{ font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px;
    color:#64748b; padding:6px 8px 4px; }
  .dd-item{ display:flex; align-items:center; gap:10px; padding:7px 8px; border-radius:6px;
    border:none; background:transparent; color:#f1f5f9; text-align:left; cursor:pointer;
    transition:background .1s; }
  .dd-item:hover{ background:#1e293b; }
  .dd-icon{ font-size:15px; width:20px; text-align:center; flex-shrink:0; }
  .dd-info{ display:flex; flex-direction:column; }
  .dd-label{ font-size:11.5px; font-weight:600; color:#e2e8f0; }
  .dd-desc{ font-size:10px; color:#94a3b8; }
  .dd-divider{ height:1px; background:#1e293b; margin:4px 0; }

  /* ── Body ── */
  .body{ display:flex; flex:1; overflow:hidden; position:relative; }
  .canvas-col{ flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }

  /* ── Sidebar Wrappers ── */
  .sidebar-wrapper{ height:100%; display:flex; flex-direction:column; }
  .mobile-sidebar-head{ display:none; }
  .drawer-close-btn{ background:none; border:none; color:#94a3b8; font-size:15px; cursor:pointer; padding:4px 8px; }
  .drawer-close-btn:hover{ color:#fff; }
  .drawer-backdrop{ display:none; }

  /* ── Toolbar ── */
  .toolbar{ height:44px; background:#0f172a; border-bottom:1px solid #1e293b;
    display:flex; align-items:center; padding:0 8px; gap:4px;
    flex-shrink:0; overflow-x:auto; }
  .toolbar::-webkit-scrollbar{ display:none; }
  .tg{ display:flex; align-items:center; gap:3px; padding:0 6px;
    border-right:1px solid #1e293b; flex-shrink:0; }
  .tg:last-child{ border-right:none; }
  .tbtn{ background:transparent; border:1px solid transparent; border-radius:5px;
    color:#94a3b8; padding:4px 8px; cursor:pointer; font-size:12px;
    min-width:28px; height:28px; display:flex; align-items:center; justify-content:center;
    gap:4px; transition:all .1s; }
  .tbtn:hover{ background:#1e293b; color:#f8fafc; border-color:#334155; }
  .tbtn.active{ background:#0284c7; color:#fff; border-color:#38bdf8; }

  .routing-tg{ gap:2px; }
  .mode-btn{ font-size:11px; font-weight:600; padding:3px 7px; }
  .theme-toggle-btn{ font-size:12px; }

  /* Wire Color Popover */
  .wire-color-tg{ position:relative; }
  .color-popover-btn{ display:flex; align-items:center; gap:6px; padding:4px 9px;
    border:1px solid #334155; border-radius:5px; background:#1e293b; color:#cbd5e1; cursor:pointer; }
  .color-popover-btn:hover{ background:#273549; border-color:#475569; color:#fff; }
  .cdot-active-preview{ width:12px; height:12px; border-radius:50%; box-shadow:0 0 4px rgba(255,255,255,0.3); flex-shrink:0; }
  .col-lbl-name{ font-size:11px; font-weight:600; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .arrow-down-sm{ font-size:9px; opacity:0.7; }

  .color-popover{ position:absolute; top:calc(100% + 6px); left:0; width:240px;
    background:#0f172a; border:1px solid #334155; border-radius:8px;
    box-shadow:0 12px 32px rgba(0,0,0,0.6); padding:10px; z-index:100;
    display:flex; flex-direction:column; gap:6px; animation:pop-down .12s ease-out; }
  .color-popover-title{ font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#64748b; }
  .color-grid{ display:grid; grid-template-columns:1fr 1fr; gap:5px; }
  .color-chip{ display:flex; align-items:center; gap:6px; padding:5px 7px;
    background:#1e293b; border:1px solid #334155; border-radius:5px;
    cursor:pointer; color:#cbd5e1; font-size:11px; text-align:left; transition:all .1s; }
  .color-chip:hover{ background:#273549; color:#fff; border-color:#475569; }
  .color-chip.chip-selected{ border-color:#38bdf8; background:#0c4a6e; color:#fff; font-weight:600; }
  .chip-dot{ width:11px; height:11px; border-radius:50%; flex-shrink:0; }
  .chip-label{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:11px; }

  .color-custom-row{ display:flex; align-items:center; justify-content:space-between;
    margin-top:4px; padding-top:6px; border-top:1px solid #1e293b; font-size:11px; color:#94a3b8; }
  .col-custom-inp{ width:24px; height:24px; border:none; border-radius:4px; cursor:pointer; background:none; }

  .tg-sep{ width:1px; height:16px; background:#334155; margin:0 3px; }
  .tbtn-icon{ font-size:13px; line-height:1; }
  .tbtn-txt{ font-size:11px; font-weight:600; }

  /* ── Right sidebar ── */
  .rsb{ width:260px; flex-shrink:0; background:#0f172a;
    border-left:1px solid #1e293b; display:flex; flex-direction:column; overflow:hidden; }
  .rsb-head{ padding:10px 12px; border-bottom:1px solid #1e293b;
    font:700 11px/1 sans-serif; text-transform:uppercase; letter-spacing:0.8px; color:#38bdf8;
    display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }

  .tpls{ border-top:1px solid #1e293b; padding:10px; flex-shrink:0; }
  .tpls-title{ font:700 10px/1 sans-serif; text-transform:uppercase; letter-spacing:0.8px;
    color:#94a3b8; margin-bottom:6px; }
  .tpl-btn{ display:flex; align-items:center; gap:8px; width:100%;
    padding:7px 9px; margin-bottom:4px; background:#1e293b;
    border:1px solid #334155; border-radius:5px; color:#cbd5e1;
    cursor:pointer; font-size:11.5px; text-align:left; transition:all .1s; }
  .tpl-btn:hover{ background:#273549; border-color:#38bdf8; color:#fff; }

  /* ── Overlays ── */
  .overlay-backdrop {
    position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:8000;
    backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center;
  }
  .overlay-box {
    background:#0f172a; border:1px solid #334155; border-radius:10px;
    padding:20px; min-width:320px; max-width:480px; box-shadow:0 16px 48px rgba(0,0,0,0.8);
  }
  .ov-head {
    font:700 14px/1 sans-serif; color:#38bdf8; margin-bottom:16px;
    display:flex; align-items:center; justify-content:space-between;
  }
  .ov-close {
    background:none; border:none; color:#64748b; cursor:pointer; font-size:15px;
  }
  .ov-close:hover { color:#f1f5f9; }
  .ov-sub { font:700 10px/1 sans-serif; text-transform:uppercase; letter-spacing:1px;
    color:#64748b; margin:14px 0 8px; }
  .ov-footer { margin-top:14px; font-size:11px; color:#64748b; text-align:center; }

  .stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:4px; }
  .stat-card { background:#030712; border:1px solid #1f2937; border-radius:6px;
    padding:12px; text-align:center; }
  .stat-val { display:block; font:700 24px/1 sans-serif; color:#38bdf8; margin-bottom:4px; }
  .stat-val.warn { color:#f87171; }
  .stat-lbl { font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.8px; }
  .theme-list { display:flex; flex-direction:column; gap:5px; }
  .theme-row { display:flex; align-items:center; gap:8px; font-size:12px; }
  .theme-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .theme-name { flex:1; color:#94a3b8; text-transform:capitalize; }
  .theme-count { color:#38bdf8; font-weight:700; }

  .shortcut-grid { display:grid; grid-template-columns:auto 1fr; gap:6px 14px; align-items:center; }
  .sc-key { background:#030712; border:1px solid #334155; border-radius:4px;
    padding:3px 8px; font:600 11px 'Consolas',monospace; color:#38bdf8; white-space:nowrap; }
  .sc-desc { font-size:12px; color:#cbd5e1; }

  /* ── LIGHT MODE OVERRIDES ── */
  .app.light-app { background: #f8fafc; color: #0f172a; }
  .app.light-app .cad-header { background: #ffffff; border-bottom-color: #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .app.light-app .menu-tab-btn { color: #334155; }
  .app.light-app .menu-tab-btn:hover, .app.light-app .menu-tab-btn.menu-open { background: #f1f5f9; color: #0284c7; border-color: #cbd5e1; }
  .app.light-app .ribbon-dropdown { background: #ffffff; border-color: #cbd5e1; box-shadow: 0 12px 32px rgba(0,0,0,0.12); }
  .app.light-app .rdd-item { color: #0f172a; }
  .app.light-app .rdd-item:hover { background: #f0f9ff; color: #0284c7; }
  .app.light-app .rdd-divider { background: #e2e8f0; }
  .app.light-app .rdd-key { color: #94a3b8; }
  .app.light-app .flag-btn { background: #e0f2fe; border-color: #bae6fd; color: #0284c7; }
  .app.light-app .logo { color: #0284c7; }
  .app.light-app .proj-name { color: #0f172a; }
  .app.light-app .proj-name:hover { background: #f1f5f9; border-color: #cbd5e1; }
  .app.light-app .proj-name:focus { background: #fff; border-color: #0284c7; }
  .app.light-app .btn { background: #f8fafc; border-color: #cbd5e1; color: #334155; }
  .app.light-app .btn:hover { background: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
  .app.light-app .btn-pri { background: #0284c7; color: #fff; border-color: #0369a1; }
  .app.light-app .nav-toggle-btn { background: #f8fafc; border-color: #cbd5e1; color: #475569; }
  .app.light-app .nav-toggle-btn.btn-active { background: #0284c7; color: #fff; }
  .app.light-app .toolbar { background: #ffffff; border-bottom-color: #e2e8f0; }
  .app.light-app .tg { border-right-color: #e2e8f0; }
  .app.light-app .tbtn { color: #64748b; }
  .app.light-app .tbtn:hover { background: #f1f5f9; color: #0f172a; border-color: #cbd5e1; }
  .app.light-app .tbtn.active { background: #0284c7; color: #fff; }
  .app.light-app .rsb { background: #ffffff; border-left-color: #e2e8f0; }
  .app.light-app .rsb-head { border-bottom-color: #e2e8f0; color: #0284c7; }
  .app.light-app .tpls { border-top-color: #e2e8f0; }
  .app.light-app .tpl-btn { background: #f8fafc; border-color: #e2e8f0; color: #334155; }
  .app.light-app .tpl-btn:hover { background: #f1f5f9; border-color: #0284c7; }
  .app.light-app .export-dropdown { background: #ffffff; border-color: #cbd5e1; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
  .app.light-app .dd-item:hover { background: #f1f5f9; }
  .app.light-app .dd-label { color: #0f172a; }
  .app.light-app .dd-divider { background: #e2e8f0; }
  .app.light-app .color-popover { background: #ffffff; border-color: #cbd5e1; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
  .app.light-app .color-chip { background: #f8fafc; border-color: #cbd5e1; color: #334155; }
  .app.light-app .color-chip:hover { background: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
  .app.light-app .color-chip.chip-selected { background: #e0f2fe; border-color: #0284c7; color: #0369a1; }
  .app.light-app .color-popover-btn { background: #f8fafc; border-color: #cbd5e1; color: #334155; }
  .app.light-app .color-custom-row { border-top-color: #e2e8f0; color: #64748b; }

  /* ── RESPONSIVE MEDIA QUERIES ── */
  @media (max-width: 1023px) {
    .drawer-backdrop {
      display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      backdrop-filter: blur(2px); z-index: 90;
    }
    .sidebar-wrapper.left-wrap {
      position: fixed; left: 0; top: 52px; bottom: 0; z-index: 95;
      width: 250px; background: #0f172a; box-shadow: 4px 0 24px rgba(0,0,0,0.7);
      animation: slide-right .18s ease-out;
    }
    .sidebar-wrapper.right-wrap {
      position: fixed; right: 0; top: 52px; bottom: 0; z-index: 95;
      width: 280px; background: #0f172a; box-shadow: -4px 0 24px rgba(0,0,0,0.7);
      animation: slide-left .18s ease-out;
    }
    .mobile-sidebar-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-bottom: 1px solid #1e293b;
      font-weight: 700; font-size: 12px; color: #38bdf8; background: #0b0f19;
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

  @media (max-width: 768px) {
    .cad-header { padding: 0 8px; gap: 6px; }
    .proj-name { max-width: 140px; font-size: 13px; }
    .nav-toggle-lbl, .btn-text { display: none; }
    .ribbon-menus { display: none; }
    .tbtn-txt, .col-lbl-name { display: none; }
  }

  @media (max-width: 480px) {
    .logo-text { display: none; }
    .btn-search { padding: 6px 7px; }
    .shortcut-tag { display: none; }
  }

  .probe-btn.probe-active {
    background: rgba(34, 197, 94, 0.25) !important;
    color: #4ade80 !important;
    border-color: #22c55e !important;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
  }

  /* ── PRINT & PDF EXPORT STYLES ── */
  @media print {
    :global(body), .app {
      background: #ffffff !important;
      color: #000000 !important;
    }
    .cad-header,
    .cad-action-strip,
    .sidebar-wrapper,
    .drawer-backdrop,
    .flash,
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
