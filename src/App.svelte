<script>
  import Canvas          from '$lib/components/Canvas.svelte'
  import Sidebar         from '$lib/components/Sidebar.svelte'
  import PropertiesPanel from '$lib/components/PropertiesPanel.svelte'
  import ERCModal        from '$lib/components/ERCModal.svelte'
  import CodeGenModal    from '$lib/components/CodeGenModal.svelte'
  import WokwiModal      from '$lib/components/WokwiModal.svelte'
  import QuickPaletteModal from '$lib/components/QuickPaletteModal.svelte'

  import { TEMPLATES }   from '$lib/store/templates.js'
  import {
    loadDiagram, clearDiagram, getDiagram, getNetlist, getBOM,
    activeTool, undo, redo, pushHistory,
    selection, multiSelection, routingMode,
    components as compsStore, wires as wiresStore,
    duplicateComponent, duplicateComponents, rotateComponent, rotateComponents,
    removeComponent, removeComponents,
    removeWire, removeLabel,
    getAutoSave, clearAutoSave, initAutoSave
  } from '$lib/store/diagram.js'
  import { findCompDef } from '$lib/data/components-db.js'
  import { runERC }      from '$lib/engine/erc.js'
  import { onMount }     from 'svelte'

  let canvasRef = {}  // filled by Canvas via bind:api
  let projectName = 'ESP32-S3 FI Diagnostic'
  let isLightMode = false

  // Modals state
  let showERCModal = false
  let showCodeGenModal = false
  let showWokwiModal = false
  let showQuickPalette = false

  // Reactive ERC analysis
  $: ercResult = runERC($compsStore, $wiresStore)

  // ── Tools ─────────────────────────────────────────────
  const TOOLS = [
    { id:'select', icon:'▲', title:'Select  V'  },
    { id:'wire',   icon:'→', title:'Wire  W'    },
    { id:'label',  icon:'T', title:'Label  L'   },
    { id:'delete', icon:'🗑', title:'Delete mode' },
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
      } catch { alert('Invalid JSON file') }
    })
  }

  function toggleTheme() {
    isLightMode = !isLightMode
    try { localStorage.setItem('wiretool_theme', isLightMode ? 'light' : 'dark') } catch {}
    flash(isLightMode ? '☀️ Light Mode diaktifkan' : '🌙 Dark Mode diaktifkan')
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
  function loadTemplate(key) {
    const t = TEMPLATES[key]; if (!t) return
    // BUG FIX: confirm before overwriting unsaved work
    const cs = $compsStore
    if (cs.length > 0 && !confirm(`Load template "${t.label}"?\nThis will replace the current diagram.`)) return
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
    { key:'Ctrl+K / /',desc:'Cari & pasang komponen cepat' },
    { key:'V',        desc:'Select tool' },
    { key:'W',        desc:'Wire tool' },
    { key:'L',        desc:'Label tool' },
    { key:'R',        desc:'Rotate 90° (Shift = -90°)' },
    { key:'Del',      desc:'Delete selected' },
    { key:'F',        desc:'Fit view' },
    { key:'Shift+F',  desc:'Zoom to selection' },
    { key:'G',        desc:'Toggle grid' },
    { key:'M',        desc:'Toggle minimap' },
    { key:'Ctrl+Z',   desc:'Undo' },
    { key:'Ctrl+Y',   desc:'Redo' },
    { key:'Ctrl+D',   desc:'Duplicate' },
    { key:'Esc',      desc:'Cancel / deselect' },
    { key:'Arrows',   desc:'Nudge (Shift = fine)' },
    { key:'Scroll',   desc:'Zoom in/out' },
    { key:'Alt+Drag', desc:'Pan canvas' },
    { key:'?',        desc:'This overlay' },
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

    // Feature #8: toggle shortcut overlay
    if (e.key === '?') { showShortcuts = !showShortcuts; return }
    if (e.key === 'Escape') {
      showShortcuts = false
      showStats = false
      showERCModal = false
      showCodeGenModal = false
      showWokwiModal = false
      showQuickPalette = false
    }

    if (e.ctrlKey && e.key==='z') { undo(); return }
    if (e.ctrlKey && e.key==='y') { redo(); return }

    // Feature #10: Zoom to selection — Shift+F
    if ((e.key==='F' || e.key==='f') && e.shiftKey) {
      canvasRef.zoomToSelection?.(); return
    }

    // R / Shift+R: Rotate selected components
    if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      const deg = e.shiftKey ? -90 : 90
      const ms = $multiSelection
      if (ms.length > 1) {
        rotateComponents(ms.filter(s => s.type === 'component').map(s => s.id), deg)
      } else if ($selection?.type === 'component') {
        rotateComponent($selection.id, deg)
      }
      return
    }

    // Ctrl+D duplicate (single history snapshot)
    if (e.ctrlKey && e.key==='d') {
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
      const ms = $multiSelection
      if (ms.length > 1) {
        // BUG FIX #B1: batch delete — single history step
        removeComponents(ms.filter(s => s.type==='component').map(s => s.id))
        return
      }
      const s = $selection
      if (!s) return
      // BUG FIX #5: no manual pushHistory() — remove* functions call it internally
      if (s.type==='component') removeComponent(s.id)
      else if (s.type==='wire') removeWire(s.id)
      else if (s.type==='label') removeLabel(s.id)
      return
    }

    const MAP = { v:'select',V:'select',w:'wire',W:'wire',l:'label',L:'label' }
    if (MAP[e.key]) { setTool(MAP[e.key]); return }
    if (e.key==='Escape') { setTool('select'); return }
    if ((e.key==='f'||e.key==='F') && !e.shiftKey) canvasRef.fitView?.()
    if (e.key==='g'||e.key==='G') canvasRef.toggleGrid?.()
    if (e.key==='m'||e.key==='M') canvasRef.toggleMinimap?.()
  }

  function handleDrop(compId, cx, cy) { canvasRef.handleDrop?.(compId, cx, cy) }

  // ── Feature #9: Auto-save restore on mount ────────────
  onMount(() => {
    try {
      const savedTheme = localStorage.getItem('wiretool_theme')
      if (savedTheme === 'light') isLightMode = true
    } catch {}

    const saved = getAutoSave()
    if (saved && saved.components?.length) {
      const ok = confirm(`Auto-saved diagram found (${saved.components.length} components, ${saved.wires?.length ?? 0} wires).\nRestore it?`)
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

  $: curTool = $activeTool
</script>

<svelte:window on:keydown={onKeyDown}/>

<div class="app">
  <!-- HEADER ─────────────────────────────────────────── -->
  <header class="hdr">
    <div class="hdr-l">
      <div class="logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="7" height="14" rx="1.5" fill="#4f9cf9" stroke="#2176d9" stroke-width="1.5"/>
          <rect x="15" y="5" width="7" height="14" rx="1.5" fill="#f97316" stroke="#d94f21" stroke-width="1.5"/>
          <path d="M9 8.5h6M9 12h6M9 15.5h6" stroke="#4ade80" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>WireTool</span>
      </div>
      <span class="badge">v2.1</span>
    </div>

    <div class="hdr-c">
      <!-- svelte-ignore a11y-interactive-supports-focus -->
      <span
        class="proj-name"
        contenteditable="true"
        role="textbox"
        aria-label="Project name"
        on:blur={e => projectName = e.target.textContent.trim()}
        on:keydown={e => e.key==='Enter' && e.target.blur()}
      >{projectName}</span>
    </div>

    <div class="hdr-r">
      <button class="btn btn-search" on:click={() => showQuickPalette = true} title="Cari & Pasang Komponen (Ctrl+K atau /)">
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
      <button class="btn" on:click={() => showCodeGenModal = true} title="Generate C++ / Python pin headers">
        💻 Code
      </button>

      <!-- Wokwi simulator export -->
      <button class="btn" on:click={() => showWokwiModal = true} title="Export to Wokwi Simulator">
        🚀 Wokwi
      </button>

      <button class="btn"         on:click={importJSON}>↑ Import</button>
      <button class="btn"         on:click={exportJSON}>↓ JSON</button>
      <button class="btn"         on:click={exportSVG}>📐 SVG</button>
      <button class="btn btn-pri" on:click={exportPNG}>🖼 PNG</button>
      <button class="btn"         on:click={exportNetlist} title="Export Netlist CSV">🔌 Netlist</button>
      <button class="btn"         on:click={exportBOM} title="Export Bill of Materials CSV">📋 BOM</button>
      <button class="btn"         on:click={() => showStats = !showStats} title="Diagram Stats">📊</button>
      <button class="btn"         on:click={() => showShortcuts = !showShortcuts} title="Shortcuts (?)">⌨</button>
      <button class="btn"         on:click={() => { if(confirm('Clear diagram?')){ pushHistory(); clearDiagram() } }}>Clear</button>
      {#if flashMsg}<span class="flash">{flashMsg}</span>{/if}
    </div>
  </header>

  <div class="body">
    <!-- LEFT SIDEBAR ────────────────────────────────── -->
    <Sidebar onDrop={handleDrop}/>

    <!-- CANVAS COLUMN ───────────────────────────────── -->
    <div class="canvas-col">
      <!-- TOOLBAR -->
      <div class="toolbar">
        <!-- Tools -->
        <div class="tg">
          {#each TOOLS as t}
            <button class="tbtn" class:active={curTool===t.id}
              title={t.title} on:click={() => setTool(t.id)}>{t.icon}</button>
          {/each}
        </div>
        <!-- Routing Mode Toggle -->
        <div class="tg routing-tg">
          <span class="col-lbl">Style:</span>
          <button class="tbtn mode-btn" class:active={$routingMode === 'orthogonal'} on:click={() => routingMode.set('orthogonal')} title="Orthogonal 90° Manhattan style">⎶</button>
          <button class="tbtn mode-btn" class:active={$routingMode === 'curved'} on:click={() => routingMode.set('curved')} title="Smooth Bezier Curve">〰</button>
          <button class="tbtn mode-btn" class:active={$routingMode === 'direct'} on:click={() => routingMode.set('direct')} title="Straight Direct Line">╱</button>
        </div>
        <!-- Zoom -->
        <div class="tg">
          <button class="tbtn" on:click={() => canvasRef.zoomIn?.()}  title="Zoom In (+)">+</button>
          <button class="tbtn" on:click={() => canvasRef.zoomOut?.()}  title="Zoom Out (−)">−</button>
          <button class="tbtn" on:click={() => canvasRef.fitView?.()}  title="Fit (F)">Fit</button>
          <button class="tbtn" on:click={() => canvasRef.zoomToSelection?.()} title="Zoom to Selection (Shift+F)">⬚</button>
        </div>
        <!-- Toggles -->
        <div class="tg">
          <button class="tbtn" on:click={() => canvasRef.toggleGrid?.()}    title="Grid (G)">⊞</button>
          <button class="tbtn" on:click={() => canvasRef.toggleMinimap?.()} title="Minimap (M)">🗺</button>
          <button class="tbtn theme-toggle-btn" on:click={toggleTheme} title="Ganti Tema Kanvas (Light / Dark)">
            {isLightMode ? '☀️' : '🌙'}
          </button>
          <button class="tbtn" on:click={undo} title="Undo Ctrl+Z">↩</button>
          <button class="tbtn" on:click={redo} title="Redo Ctrl+Y">↪</button>
        </div>
        <!-- Wire colors -->
        <div class="tg wire-colors">
          <span class="col-lbl">Wire:</span>
          {#each WIRE_COLORS as wc}
            <button class="cdot" class:cdot-active={activeColor===wc.c}
              style="background:{wc.c}" title={wc.t}
              on:click={() => pickColor(wc.c)} aria-label={wc.t}></button>
          {/each}
          <input type="color" value={activeColor} title="Custom color" class="col-custom"
            on:input={e => pickColor(e.target.value)} aria-label="Custom wire color"/>
        </div>
        <!-- Shortcuts hint -->
        <div class="tg shortcuts-hint">
          <span>V W L Del F G M · Ctrl+K / · ? Shortcuts</span>
        </div>
      </div>

      <!-- CANVAS -->
      <Canvas bind:api={canvasRef} {isLightMode}/>
    </div>

    <!-- RIGHT SIDEBAR ───────────────────────────────── -->
    <aside class="rsb">
      <div class="rsb-head">Properties</div>
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
</div>

<style>
  :global(*,*::before,*::after){ box-sizing:border-box; margin:0; padding:0; }
  :global(html,body){ height:100%; overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:13px; background:#0d0d1a; color:#e8e8f5; }
  :global(*){ scrollbar-width:thin; scrollbar-color:#353565 transparent; }

  .app{ display:flex; flex-direction:column; height:100vh; overflow:hidden; }

  /* Header */
  .hdr{ height:50px; background:#13132a; border-bottom:2px solid #252545;
    display:flex; align-items:center; padding:0 14px; gap:10px;
    flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,0.5); }
  .hdr-l{ display:flex; align-items:center; gap:8px; min-width:150px; }
  .hdr-c{ flex:1; display:flex; justify-content:center; }
  .hdr-r{ display:flex; align-items:center; gap:6px; min-width:270px; justify-content:flex-end; }

  .logo{ display:flex; align-items:center; gap:7px; font-weight:800; font-size:16px; color:#4f9cf9; }
  .badge{ background:#1e1e40; color:#6060a0; font-size:10px;
    padding:2px 7px; border-radius:10px; border:1px solid #353565; }
  .proj-name{ font-size:15px; font-weight:700; color:#e8e8f5; outline:none;
    padding:4px 12px; border-radius:4px; border:1px solid transparent;
    min-width:200px; text-align:center; transition:border-color .15s; }
  .proj-name:focus{ border-color:#4f9cf9; background:#1a1a35; }

  .btn{ display:inline-flex; align-items:center; gap:4px; padding:6px 12px;
    border-radius:4px; border:1px solid #353565; cursor:pointer;
    font-size:12px; font-weight:600; background:transparent; color:#9090b8;
    transition:all .12s; }
  .btn:hover{ background:#22224a; color:#e8e8f5; border-color:#4f9cf9; }
  .btn-pri{ background:#4f9cf9; color:#fff; border-color:#2176d9; }
  .btn-pri:hover{ background:#2176d9; }
  .flash{ font-size:12px; color:#4ade80; font-weight:600; }

  .btn-search { background: #1a1a38; border-color: #3b3b70; color: #a5b4fc; }
  .btn-search:hover { background: #252555; color: #fff; border-color: #6366f1; }
  .shortcut-tag { font-size: 10px; background: #252545; padding: 1px 5px; border-radius: 3px; color: #94a3b8; }

  .btn-erc { display: inline-flex; align-items: center; gap: 6px; }
  .badge-erc { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; }
  .badge-erc-err { background: rgba(239, 68, 68, 0.25); color: #f87171; border: 1px solid #ef4444; }
  .badge-erc-warn { background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid #f59e0b; }
  .badge-erc-ok { background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid #4ade80; }

  .routing-tg { gap: 2px; }
  .mode-btn { font-size: 11px; font-weight: 600; padding: 4px 6px; }
  .theme-toggle-btn { font-size: 12px; font-weight: 600; }

  /* Body */
  .body{ display:flex; flex:1; overflow:hidden; }
  .canvas-col{ flex:1; display:flex; flex-direction:column; overflow:hidden; }

  /* Toolbar */
  .toolbar{ height:46px; background:#13132a; border-bottom:2px solid #252545;
    display:flex; align-items:center; padding:0 8px; gap:2px;
    flex-shrink:0; overflow-x:auto; }
  .tg{ display:flex; align-items:center; gap:3px; padding:0 7px;
    border-right:1px solid #252545; flex-shrink:0; }
  .tg:last-child{ border-right:none; }
  .tbtn{ background:transparent; border:1px solid transparent; border-radius:4px;
    color:#7070a0; padding:5px 7px; cursor:pointer; font-size:13px;
    min-width:28px; height:28px; display:flex; align-items:center; justify-content:center;
    transition:all .1s; }
  .tbtn:hover{ background:#22224a; color:#e8e8f5; border-color:#353565; }
  .tbtn.active{ background:#4f9cf9; color:#fff; border-color:#2176d9; }

  .wire-colors{ gap:5px; }
  .col-lbl{ font-size:11px; color:#505070; }
  .cdot{ width:20px; height:20px; border-radius:50%; border:2px solid transparent;
    cursor:pointer; transition:transform .1s; flex-shrink:0; }
  .cdot:hover{ transform:scale(1.2); }
  .cdot.cdot-active{ border-color:#fff; transform:scale(1.2); box-shadow:0 0 5px rgba(255,255,255,.3); }
  .col-custom{ width:22px; height:22px; border:none; border-radius:50%;
    cursor:pointer; padding:0; background:none; }

  .shortcuts-hint{ font-size:10px; color:#353555; white-space:nowrap; }

  /* Right sidebar */
  .rsb{ width:250px; flex-shrink:0; background:#13132a;
    border-left:2px solid #252545; display:flex; flex-direction:column; overflow:hidden; }
  .rsb-head{ padding:10px 12px; border-bottom:1px solid #252545;
    font:700 10px/1 sans-serif; text-transform:uppercase; letter-spacing:1px; color:#4f9cf9; flex-shrink:0; }

  .tpls{ border-top:1px solid #252545; padding:10px; flex-shrink:0; }
  .tpls-title{ font:700 10px/1 sans-serif; text-transform:uppercase; letter-spacing:1px;
    color:#4f9cf9; margin-bottom:7px; }
  .tpl-btn{ display:flex; align-items:center; gap:8px; width:100%;
    padding:8px 10px; margin-bottom:4px; background:#1a1a35;
    border:1px solid #252545; border-radius:4px; color:#9090b8;
    cursor:pointer; font-size:12px; text-align:left; transition:all .1s; }
  .tpl-btn:hover{ background:#22224a; border-color:#4f9cf9; color:#e8e8f5; }

  /* ── Overlay shared ── */
  .overlay-backdrop {
    position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:8000;
    display:flex; align-items:center; justify-content:center;
  }
  .overlay-box {
    background:#13132a; border:1px solid #353565; border-radius:10px;
    padding:20px; min-width:320px; max-width:480px; box-shadow:0 12px 40px rgba(0,0,0,0.8);
  }
  .ov-head {
    font:700 14px/1 sans-serif; color:#4f9cf9; margin-bottom:16px;
    display:flex; align-items:center; justify-content:space-between;
  }
  .ov-close {
    background:none; border:none; color:#505070; cursor:pointer; font-size:14px;
  }
  .ov-close:hover { color:#e8e8f5; }
  .ov-sub { font:700 10px/1 sans-serif; text-transform:uppercase; letter-spacing:1px;
    color:#353555; margin:14px 0 8px; }
  .ov-footer { margin-top:14px; font-size:11px; color:#353555; text-align:center; }

  /* ── Stats overlay ── */
  .stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:4px; }
  .stat-card { background:#0d0d1a; border:1px solid #252545; border-radius:6px;
    padding:12px; text-align:center; }
  .stat-val { display:block; font:700 24px/1 sans-serif; color:#4f9cf9; margin-bottom:4px; }
  .stat-val.warn { color:#f87171; }
  .stat-lbl { font-size:10px; color:#505070; text-transform:uppercase; letter-spacing:0.8px; }
  .theme-list { display:flex; flex-direction:column; gap:5px; }
  .theme-row { display:flex; align-items:center; gap:8px; font-size:12px; }
  .theme-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .theme-name { flex:1; color:#9090b8; text-transform:capitalize; }
  .theme-count { color:#4f9cf9; font-weight:700; }

  /* ── Shortcut overlay ── */
  .shortcut-grid { display:grid; grid-template-columns:auto 1fr; gap:6px 14px;
    align-items:center; }
  .sc-key { background:#0d0d1a; border:1px solid #353565; border-radius:4px;
    padding:3px 8px; font:600 11px 'Consolas',monospace; color:#4f9cf9;
    white-space:nowrap; }
  .sc-desc { font-size:12px; color:#9090b8; }
</style>
