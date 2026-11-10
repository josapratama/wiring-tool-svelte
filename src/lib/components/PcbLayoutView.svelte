<script>
  /**
   * PcbLayoutView.svelte — Interactive PCB Layout CAD Editor & Exporter
   * 
   * Features:
   * - Interactive millimeter-accurate PCB canvas with pan, zoom, and grid snap
   * - Automatic Schematic-to-PCB synchronization (Ratsnest Air-Wire solver)
   * - Component footprint placement, drag-and-drop, and 90-degree rotation
   * - Interactive Copper Trace Router (Top Layer Red & Bottom Layer Blue with 45-degree angle snap)
   * - Real-time Trace Width selection (0.25mm, 0.40mm, 0.80mm, 1.20mm)
   * - Via placement connecting Top and Bottom copper layers
   * - Integrated Design Rule Check (DRC) and Unrouted Net Auditor
   * - Gerber RS-274X, Excellon Drill, EasyEDA JSON, and 1:1 DIY Etching Mask Exporters
   * - Fully responsive UI with pure scoped CSS, collapsible inspector, and mobile HUD
   */

  import { onMount, createEventDispatcher } from 'svelte'
  import {
    components as compsStore,
    wires as wiresStore,
    copperTraces as copperTracesStore,
    pcbVias as pcbViasStore,
    pcbBoardConfig,
    updatePcbBoardConfig,
    batchAddTracesAndVias,
    activeDrcHighlight,
    setDrcHighlight,
    clearDrcHighlight,
    is3dViewerOpen,
    activeEditorView,
    addCopperTrace,
    removeCopperTrace,
    clearCopperTraces,
    addPcbVia,
    removePcbVia,
    clearPcbVias,
    pushHistory
  } from '$lib/store/diagram.js'

  import {
    mm2px, px2mm, snapToPcbGrid, snapTo45Degrees,
    getFootprintForComponent, generateRatsnestLines, runPcbDrcCheck,
    generateGerberRS274X, exportToEasyEDAJson, generateDiyEtchingSvg,
    autoRoutePcbNets, generateCopperPourSvgPath, estimatePcbBOMCost
  } from '$lib/engine/pcb-engine.js'

  const dispatch = createEventDispatcher()

  // ── PCB Board & Viewport State ──────────────────────────────────────────────
  let boardWidthMm = 100
  let boardHeightMm = 80
  let gridStepMm = 2.54 // standard 100 mil grid (switchable to 1.27mm / 0.5mm)
  let cornerRadiusMm = 3
  let mountingHoles = true
  let showCopperPour = false

  // ── Auto-Router & Fab Estimator State ───────────────────────────────────────
  let isAutoRouting = false
  let autoRouteFeedback = ''
  let bomCostEstimate = { pcbFabCostUsd: 2, componentsCostUsd: 0, totalCostUsd: 2, areaCm2: 80, leadTimeDays: '2-3 Hari Kerja' }
  $: bomCostEstimate = estimatePcbBOMCost({ widthMm: boardWidthMm, heightMm: boardHeightMm }, pcbComponents)
  let activeHighlight = null
  $: activeHighlight = $activeDrcHighlight
  
  let zoom = 2.5 // scale factor (screen px per mm)
  let panX = 140
  let panY = 70
  let isPanning = false
  let panStartX = 0
  let panStartY = 0

  // ── PCB Tools & Layers ──────────────────────────────────────────────────────
  let activeTool = 'select' // 'select' | 'route' | 'via'
  let activeLayer = 'top' // 'top' (F.Cu - Red) | 'bottom' (B.Cu - Blue)
  let activeTraceWidth = 0.40 // mm (0.25, 0.40, 0.80, 1.20)

  // ── PCB Layout Data (Connected to Global Store) ──────────────────────────────
  let pcbComponents = []
  $: copperTraces = $copperTracesStore
  $: vias = $pcbViasStore
  let selectedCompId = null
  let selectedTraceId = null

  // ── Active Interactive Routing State ────────────────────────────────────────
  let routingStart = null // { pad, compId, xMm, yMm, netId }
  let routingCurrent = null // { xMm, yMm }

  // ── Ratsnest & Netlist State ────────────────────────────────────────────────
  let ratsnestLines = []
  let drcResults = { ok: true, unroutedCount: 0, totalNets: 0 }
  let showRatsnest = true
  let showSilkscreen = true
  let showTopCopper = true
  let showBottomCopper = true

  // ── Inspector & Modal State ─────────────────────────────────────────────────
  let showInspector = true
  let showExportModal = false
  let exportSuccessMsg = ''

  // ── Synchronize Components from Schematic ───────────────────────────────────
  $: {
    const rawComps = $compsStore
    const rawWires = $wiresStore
    const existingMap = new Map(pcbComponents.map(c => [c.instanceId, c]))
    
    let defaultCol = 15
    let defaultRow = 15

    pcbComponents = rawComps.map((sc, idx) => {
      const existing = existingMap.get(sc.instanceId)
      const fp = getFootprintForComponent(sc)

      if (existing) {
        return {
          ...sc,
          xMm: existing.xMm,
          yMm: existing.yMm,
          rotation: existing.rotation || 0,
          footprint: fp
        }
      }

      // Auto-arrange newly added components in an orderly grid
      const compObj = {
        ...sc,
        xMm: defaultCol,
        yMm: defaultRow,
        rotation: 0,
        footprint: fp
      }

      defaultCol += (fp.widthMm || 20) + 12
      if (defaultCol > boardWidthMm - 20) {
        defaultCol = 15
        defaultRow += 28
      }

      return compObj
    })

    // Recompute ratsnest air-wires
    updateRatsnest()
  }

  // Reactive trigger for ratsnest when copper traces, vias, or board size change
  $: if (copperTraces || vias || boardWidthMm || boardHeightMm) {
    updateRatsnest()
  }

  function updateRatsnest() {
    ratsnestLines = generateRatsnestLines(pcbComponents, $wiresStore, copperTraces)
    drcResults = runPcbDrcCheck(
      { widthMm: boardWidthMm, heightMm: boardHeightMm },
      pcbComponents,
      copperTraces,
      vias,
      $wiresStore
    )
  }

  // ── Viewport Canvas Pan & Zoom Handlers ─────────────────────────────────────
  function handleWheel(e) {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.6), 9.0)
    
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    panX = mouseX - (mouseX - panX) * (newZoom / zoom)
    panY = mouseY - (mouseY - panY) * (newZoom / zoom)
    zoom = newZoom
  }

  function startPan(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && e.shiftKey)) {
      isPanning = true
      panStartX = e.clientX - panX
      panStartY = e.clientY - panY
    }
  }

  function onMouseMove(e) {
    if (isPanning) {
      panX = e.clientX - panStartX
      panY = e.clientY - panStartY
      return
    }

    // Interactive routing cursor position
    if (activeTool === 'route' && routingStart) {
      const rect = e.currentTarget.getBoundingClientRect()
      const rawX = (e.clientX - rect.left - panX) / zoom
      const rawY = (e.clientY - rect.top - panY) / zoom
      
      const snapped = snapTo45Degrees(
        routingStart.xMm,
        routingStart.yMm,
        snapToPcbGrid(rawX, gridStepMm),
        snapToPcbGrid(rawY, gridStepMm)
      )
      routingCurrent = snapped
    }
  }

  function stopPan() {
    isPanning = false
  }

  function resetView() {
    zoom = 2.5
    panX = 140
    panY = 70
  }

  function fitToBoard() {
    zoom = 3.0
    panX = 100
    panY = 50
  }

  // ── Footprint Dragging ──────────────────────────────────────────────────────
  let draggingComp = null
  let dragOffsetMm = { x: 0, y: 0 }

  function startDragComp(e, comp) {
    if (activeTool !== 'select') return
    e.stopPropagation()
    pushHistory()
    selectedCompId = comp.instanceId
    selectedTraceId = null

    const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect()
    const mouseXmm = (e.clientX - rect.left - panX) / zoom
    const mouseYmm = (e.clientY - rect.top - panY) / zoom

    draggingComp = comp
    dragOffsetMm = {
      x: mouseXmm - comp.xMm,
      y: mouseYmm - comp.yMm
    }
  }

  function onBoardPointerMove(e) {
    if (draggingComp) {
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseXmm = (e.clientX - rect.left - panX) / zoom
      const mouseYmm = (e.clientY - rect.top - panY) / zoom

      const newX = snapToPcbGrid(mouseXmm - dragOffsetMm.x, gridStepMm)
      const newY = snapToPcbGrid(mouseYmm - dragOffsetMm.y, gridStepMm)

      // Keep within board outline
      draggingComp.xMm = Math.max(5, Math.min(boardWidthMm - 5, newX))
      draggingComp.yMm = Math.max(5, Math.min(boardHeightMm - 5, newY))
      
      pcbComponents = [...pcbComponents]
      updateRatsnest()
    }
  }

  function onBoardPointerUp() {
    if (draggingComp) {
      draggingComp = null
      updateRatsnest()
    }
  }

  function rotateSelectedComponent(deg = 90) {
    if (!selectedCompId) {
      if (pcbComponents.length > 0) {
        selectedCompId = pcbComponents[0].instanceId
      } else {
        return
      }
    }
    const comp = pcbComponents.find(c => c.instanceId === selectedCompId)
    if (comp) {
      pushHistory()
      comp.rotation = ((comp.rotation || 0) + deg) % 360
      pcbComponents = [...pcbComponents]
      updateRatsnest()
    }
  }

  // ── Interactive Copper Trace Routing ────────────────────────────────────────
  function handlePadClick(e, comp, pad, padXmm, padYmm) {
    e.stopPropagation()

    if (activeTool === 'route') {
      if (!routingStart) {
        // Start a new copper trace from this pad
        routingStart = {
          compId: comp.instanceId,
          padNum: pad.num,
          xMm: padXmm,
          yMm: padYmm
        }
        routingCurrent = { xMm: padXmm, yMm: padYmm }
      } else {
        // Complete the trace segment to this destination pad
        if (routingStart.xMm !== padXmm || routingStart.yMm !== padYmm) {
          addCopperTrace({
            layer: activeLayer,
            x1: routingStart.xMm,
            y1: routingStart.yMm,
            x2: padXmm,
            y2: padYmm,
            widthMm: activeTraceWidth
          })
        }
        routingStart = null
        routingCurrent = null
      }
    } else if (activeTool === 'select') {
      selectedCompId = comp.instanceId
      selectedTraceId = null
    }
  }

  function handleCanvasClick(e) {
    if (activeTool === 'via') {
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseSvgX = (e.clientX - rect.left - panX) / zoom
      const mouseSvgY = (e.clientY - rect.top - panY) / zoom
      const mmX = snapToPcbGrid(mouseSvgX, gridStepMm)
      const mmY = snapToPcbGrid(mouseSvgY, gridStepMm)

      if (mmX >= 0 && mmX <= boardWidthMm && mmY >= 0 && mmY <= boardHeightMm) {
        addPcbVia({
          xMm: mmX,
          yMm: mmY,
          outerMm: 0.8,
          drillMm: 0.45
        })

        if (routingStart) {
          addCopperTrace({
            layer: activeLayer,
            x1: routingStart.xMm,
            y1: routingStart.yMm,
            x2: mmX,
            y2: mmY,
            widthMm: activeTraceWidth
          })
          activeLayer = activeLayer === 'top' ? 'bottom' : 'top'
          routingStart = { xMm: mmX, yMm: mmY }
          routingCurrent = { xMm: mmX, yMm: mmY }
        }
      }
      return
    }

    if (activeTool === 'route' && routingStart && routingCurrent) {
      // Place an intermediate corner waypoint
      addCopperTrace({
        layer: activeLayer,
        x1: routingStart.xMm,
        y1: routingStart.yMm,
        x2: routingCurrent.xMm,
        y2: routingCurrent.yMm,
        widthMm: activeTraceWidth
      })
      routingStart = { ...routingCurrent }
    } else {
      selectedCompId = null
      selectedTraceId = null
      routingStart = null
      routingCurrent = null
    }
  }

  function handleCanvasContextMenu(e) {
    if (routingStart) {
      e.preventDefault()
      routingStart = null
      routingCurrent = null
    }
  }

  function deleteSelectedTrace() {
    if (selectedTraceId) {
      removeCopperTrace(selectedTraceId)
      removePcbVia(selectedTraceId)
      selectedTraceId = null
    }
  }

  function clearAllTraces() {
    if (confirm("Hapus semua jalur tembaga (copper traces) dan via pada PCB ini?")) {
      clearCopperTraces()
      clearPcbVias()
    }
  }

  // ── Gerber & Export Triggers ────────────────────────────────────────────────
  function triggerGerberDownload() {
    const gerbers = generateGerberRS274X({ widthMm: boardWidthMm, heightMm: boardHeightMm }, pcbComponents, copperTraces, vias)
    for (const [filename, content] of Object.entries(gerbers)) {
      downloadFile(filename, content, "text/plain")
    }
    exportSuccessMsg = "Gerber RS-274X berhasil di-generate! File siap dikirim ke JLCPCB / PCBWay."
  }

  function triggerEasyEdaExport() {
    const jsonDoc = exportToEasyEDAJson({ widthMm: boardWidthMm, heightMm: boardHeightMm }, pcbComponents, copperTraces, vias)
    downloadFile("easyeda_pcb_project.json", JSON.stringify(jsonDoc, null, 2), "application/json")
    exportSuccessMsg = "File EasyEDA Source JSON berhasil diunduh! Siap dibuka di EasyEDA Editor."
  }

  function triggerEtchingSvgExport(layer = 'bottom', inverted = false) {
    const svgStr = generateDiyEtchingSvg({ widthMm: boardWidthMm, heightMm: boardHeightMm }, pcbComponents, copperTraces, layer, inverted, vias)
    downloadFile(`pcb_diy_etching_${layer}.svg`, svgStr, "image/svg+xml")
    exportSuccessMsg = "Masker SVG 1:1 Skala Riil berhasil diunduh untuk metode sablon / setrika PCB!"
  }

  // ── ⚡ 2-Layer Auto-Router Engine Trigger ────────────────────────────────────
  function triggerAutoRouter() {
    isAutoRouting = true
    autoRouteFeedback = ''
    setTimeout(() => {
      const res = autoRoutePcbNets(
        { widthMm: boardWidthMm, heightMm: boardHeightMm },
        pcbComponents,
        $wiresStore,
        copperTraces,
        vias,
        { traceWidthMm: activeTraceWidth }
      )
      if (res.newTraces.length > 0 || res.newVias.length > 0) {
        batchAddTracesAndVias(res.newTraces, res.newVias)
        autoRouteFeedback = `⚡ Auto-Router: Berhasil menghubungkan ${res.routedCount} jalur tembaga (${res.newTraces.length} segmen, ${res.newVias.length} via)!`
      } else {
        autoRouteFeedback = 'Auto-Router: Tidak ada jalur yang perlu dihubungkan atau semua netlist sudah terhubung sempurna.'
      }
      isAutoRouting = false
      setTimeout(() => { autoRouteFeedback = '' }, 6000)
    }, 200)
  }

  // ── Interactive DRC Highlight Marker Navigator ─────────────────────────────
  function highlightDrcIssue(issue) {
    if (issue && issue.item) {
      const x = issue.item.xMm ?? issue.item.x1 ?? (boardWidthMm / 2)
      const y = issue.item.yMm ?? issue.item.y1 ?? (boardHeightMm / 2)
      setDrcHighlight({ xMm: x, yMm: y, code: issue.code, message: issue.message })
      // Pan camera smoothly to center coordinate
      panX = 360 - x * zoom
      panY = 220 - y * zoom
    }
  }

  function downloadFile(name, content, mime) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function returnToWiringView() {
    activeEditorView.set('wiring')
  }

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      routingStart = null
      routingCurrent = null
      selectedCompId = null
      selectedTraceId = null
    } else if (e.key === 'r' || e.key === 'R') {
      rotateSelectedComponent(90)
    } else if (e.key === 'v' || e.key === 'V') {
      activeTool = 'select'
    } else if (e.key === 'x' || e.key === 'X') {
      activeTool = 'route'
    } else if (e.key === 'o' || e.key === 'O') {
      activeTool = 'via'
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelectedTrace()
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      showInspector = false
    }
  })
</script>

<svelte:window on:keydown={onKeyDown} />

<!-- Main PCB Studio Container -->
<div class="pcb-studio">
  
  <!-- 1. Top Ribbon Toolbar -->
  <header class="pcb-ribbon">
    <div class="pcb-ribbon-left">
      <!-- Back to Schematic button -->
      <button on:click={returnToWiringView} class="pcb-btn pcb-btn-back" title="Kembali ke Mode Skematik Kabel">
        <span class="pcb-icon">←</span>
        <span class="pcb-btn-text">Skematik</span>
      </button>

      <div class="pcb-sep"></div>

      <!-- Studio Badge -->
      <div class="pcb-title-wrap">
        <span class="pcb-title-icon">🟩</span>
        <span class="pcb-title-text">PCB Studio</span>
      </div>
    </div>

    <!-- Active Tool Group -->
    <div class="pcb-ribbon-center">
      <div class="pcb-tool-group">
        <button
          class="pcb-tool-btn"
          class:pcb-tool-active={activeTool === 'select'}
          on:click={() => activeTool = 'select'}
          title="Select & Geser Komponen (Shortcut: V)"
        >
          <span>↖</span>
          <span class="pcb-tool-lbl">Select</span>
        </button>

        <button
          class="pcb-tool-btn pcb-tool-route"
          class:pcb-tool-active={activeTool === 'route'}
          on:click={() => activeTool = 'route'}
          title="Tarik Jalur Tembaga / Route Trace 45° (Shortcut: X)"
        >
          <span>⚡</span>
          <span class="pcb-tool-lbl">Route</span>
        </button>

        <button
          class="pcb-tool-btn"
          class:pcb-tool-active={activeTool === 'via'}
          on:click={() => activeTool = 'via'}
          title="Letakkan Via Lubang Tembus (Shortcut: O)"
        >
          <span>◎</span>
          <span class="pcb-tool-lbl">Via</span>
        </button>
      </div>

      <div class="pcb-sep"></div>

      <!-- Layer Toggle (Top F.Cu vs Bottom B.Cu) -->
      <div class="pcb-layer-group">
        <button
          class="pcb-layer-btn pcb-layer-top"
          class:pcb-layer-active={activeLayer === 'top'}
          on:click={() => activeLayer = 'top'}
          title="Top Copper Layer (F.Cu - Merah)"
        >
          <span class="pcb-layer-dot pcb-dot-top"></span>
          <span>Top (F.Cu)</span>
        </button>

        <button
          class="pcb-layer-btn pcb-layer-bottom"
          class:pcb-layer-active={activeLayer === 'bottom'}
          on:click={() => activeLayer = 'bottom'}
          title="Bottom Copper Layer (B.Cu - Biru)"
        >
          <span class="pcb-layer-dot pcb-dot-bottom"></span>
          <span>Bottom (B.Cu)</span>
        </button>
      </div>

      <!-- Trace Width Selector -->
      <div class="pcb-select-wrap" title="Ketebalan Jalur Tembaga">
        <span class="pcb-select-label">Lebar:</span>
        <select bind:value={activeTraceWidth} class="pcb-select">
          <option value={0.25}>0.25 mm (Sinyal)</option>
          <option value={0.40}>0.40 mm (Standar)</option>
          <option value={0.80}>0.80 mm (Daya)</option>
          <option value={1.20}>1.20 mm (GND)</option>
        </select>
      </div>

      <!-- Grid Snap Selector -->
      <div class="pcb-select-wrap" title="Ukuran Grid Snapping CAD">
        <span class="pcb-select-label">Grid:</span>
        <select bind:value={gridStepMm} class="pcb-select">
          <option value={2.54}>2.54 mm</option>
          <option value={1.27}>1.27 mm</option>
          <option value={0.635}>0.64 mm</option>
        </select>
      </div>

      <!-- ⚡ Auto-Router Button -->
      <button
        on:click={triggerAutoRouter}
        class="pcb-btn pcb-btn-autoroute"
        class:is-loading={isAutoRouting}
        disabled={isAutoRouting}
        title="Otomatis Hubungkan Semua Netlist yang Belum Terhubung (A* 2-Layer Router)"
      >
        <span>{isAutoRouting ? '⏳' : '⚡'}</span>
        <span class="pcb-btn-text">{isAutoRouting ? 'Routing...' : 'Auto-Route'}</span>
      </button>
    </div>

    <!-- Right Actions -->
    <div class="pcb-ribbon-right">
      <!-- 🪐 3D View Button -->
      <button on:click={() => is3dViewerOpen.set(true)} class="pcb-btn pcb-btn-3d" title="Buka Studio 3D PCB Visualizer WebGL">
        <span>🪐</span>
        <span class="pcb-btn-text">3D View</span>
      </button>

      <!-- Rotate button -->
      <button on:click={() => rotateSelectedComponent(90)} class="pcb-btn" title="Putar Komponen Terpilih 90° (Shortcut: R)">
        <span>↻</span>
        <span class="pcb-btn-text">Putar</span>
      </button>

      <!-- Toggle Inspector -->
      <button
        on:click={() => showInspector = !showInspector}
        class="pcb-btn pcb-btn-inspector"
        class:pcb-btn-active={showInspector}
        title="Buka / Tutup Panel Inspektur PCB"
      >
        <span>⚙</span>
        <span class="pcb-btn-text">Inspector</span>
      </button>

      <!-- Export Button -->
      <button on:click={() => showExportModal = true} class="pcb-btn pcb-btn-export" title="Ekspor Gerber, EasyEDA JSON, dan Masker Cetak">
        <span>📦</span>
        <span class="pcb-btn-text">Ekspor Fabrikasi</span>
      </button>
    </div>
  </header>

  <!-- 2. Main Workspace Body (Canvas + Properties Panel) -->
  <div class="pcb-body">

    <!-- Interactive SVG PCB Canvas Container -->
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="pcb-canvas-area"
      on:wheel={handleWheel}
      on:mousedown={startPan}
      on:mousemove={onMouseMove}
      on:mouseup={stopPan}
      on:click={handleCanvasClick}
      on:contextmenu={handleCanvasContextMenu}
    >
      <!-- Canvas SVG Surface -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <svg
        class="pcb-svg"
        on:pointermove={onBoardPointerMove}
        on:pointerup={onBoardPointerUp}
      >
        <defs>
          <!-- PCB Grid Pattern -->
          <pattern id="pcb-grid-pattern" width={gridStepMm * zoom} height={gridStepMm * zoom} patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.75" fill="#334155" opacity="0.65" />
          </pattern>
        </defs>

        <!-- World Transform Container -->
        <g transform="translate({panX}, {panY}) scale({zoom})">
          
          <!-- Background Grid Area -->
          <rect x="-100" y="-100" width={boardWidthMm + 200} height={boardHeightMm + 200} fill="url(#pcb-grid-pattern)" pointer-events="none" />

          <!-- A. The Physical PCB Board (Green Soldermask) -->
          <g id="pcb-board">
            <!-- Green Board Substrate -->
            <rect
              x="0"
              y="0"
              width={boardWidthMm}
              height={boardHeightMm}
              rx={cornerRadiusMm}
              ry={cornerRadiusMm}
              fill="#062e17"
              stroke="#eab308"
              stroke-width="0.35"
              filter="drop-shadow(0 12px 28px rgba(0,0,0,0.8))"
            />

            <!-- 4 Corner M3 Mounting Holes -->
            {#if mountingHoles}
              <g id="pcb-mounting-holes">
                {#each [
                  { cx: 4, cy: 4 },
                  { cx: boardWidthMm - 4, cy: 4 },
                  { cx: boardWidthMm - 4, cy: boardHeightMm - 4 },
                  { cx: 4, cy: boardHeightMm - 4 }
                ] as h}
                  <circle cx={h.cx} cy={h.cy} r="3.2" fill="none" stroke="#f59e0b" stroke-width="0.7" />
                  <circle cx={h.cx} cy={h.cy} r="1.6" fill="#030712" stroke="#eab308" stroke-width="0.2" />
                {/each}
              </g>
            {/if}
            
            <!-- Silkscreen Header Title -->
            {#if showSilkscreen}
              <text x="5" y="7" font-size="2.4" font-family="monospace" font-weight="bold" fill="#ffffff" opacity="0.8">
                CIRCUIT-CRAFT PCB v1.0 — {boardWidthMm}x{boardHeightMm}mm (FR-4)
              </text>
            {/if}
          </g>

          <!-- Ground Plane / Copper Pour (GND Zone Polygon Fill) -->
          {#if showCopperPour}
            <path
              d={generateCopperPourSvgPath({ widthMm: boardWidthMm, heightMm: boardHeightMm }, cornerRadiusMm)}
              fill="rgba(37, 99, 235, 0.16)"
              stroke="#38bdf8"
              stroke-width="0.35"
              stroke-dasharray="1 1"
              pointer-events="none"
            />
          {/if}

          <!-- B. Ratsnest Air-Wires (Dashed Yellow Connectivity Guides) -->
          {#if showRatsnest}
            <g id="ratsnest-layer" stroke="#facc15" stroke-width="0.22" stroke-dasharray="0.8, 0.8" opacity="0.85" pointer-events="none">
              {#each ratsnestLines as r}
                <line x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
              {/each}
            </g>
          {/if}

          <!-- C. Copper Traces (Bottom Layer B.Cu - Blue) -->
          {#if showBottomCopper}
            <g id="bottom-copper-layer">
              {#each copperTraces.filter(t => t.layer === 'bottom') as trace}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <line
                  x1={trace.x1} y1={trace.y1} x2={trace.x2} y2={trace.y2}
                  stroke={selectedTraceId === trace.id ? '#60a5fa' : '#2563eb'}
                  stroke-width={trace.widthMm}
                  stroke-linecap="round"
                  on:click={(e) => { e.stopPropagation(); selectedTraceId = trace.id; selectedCompId = null }}
                  class="pcb-trace"
                />
              {/each}
            </g>
          {/if}

          <!-- D. Copper Traces (Top Layer F.Cu - Red) -->
          {#if showTopCopper}
            <g id="top-copper-layer">
              {#each copperTraces.filter(t => t.layer === 'top') as trace}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <line
                  x1={trace.x1} y1={trace.y1} x2={trace.x2} y2={trace.y2}
                  stroke={selectedTraceId === trace.id ? '#f87171' : '#dc2626'}
                  stroke-width={trace.widthMm}
                  stroke-linecap="round"
                  on:click={(e) => { e.stopPropagation(); selectedTraceId = trace.id; selectedCompId = null }}
                  class="pcb-trace"
                />
              {/each}
            </g>
          {/if}

          <!-- E. Plated Through-Hole Vias (Connecting Top & Bottom Layers) -->
          <g id="vias-layer">
            {#each vias as via (via.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <g
                class="pcb-via"
                on:click={(e) => { e.stopPropagation(); selectedTraceId = via.id; selectedCompId = null; }}
              >
                <!-- Annular copper ring -->
                <circle
                  cx={via.xMm} cy={via.yMm}
                  r={(via.outerMm || 0.8) / 2}
                  fill={selectedTraceId === via.id ? "#38bdf8" : "#f59e0b"}
                  stroke="#d97706"
                  stroke-width="0.08"
                />
                <!-- Drill hole through substrate -->
                <circle
                  cx={via.xMm} cy={via.yMm}
                  r={(via.drillMm || 0.45) / 2}
                  fill="#090d16"
                />
              </g>
            {/each}
          </g>

          <!-- F. Active In-Progress Routing Line -->
          {#if routingStart && routingCurrent}
            <line
              x1={routingStart.xMm} y1={routingStart.yMm} x2={routingCurrent.xMm} y2={routingCurrent.yMm}
              stroke={activeLayer === 'top' ? '#f43f5e' : '#38bdf8'}
              stroke-width={activeTraceWidth}
              stroke-dasharray="0.6, 0.4"
              stroke-linecap="round"
              pointer-events="none"
            />
          {/if}

          <!-- F. Component Footprints (Silkscreen + Through-hole / SMD Pads) -->
          <g id="components-layer">
            {#each pcbComponents as comp (comp.instanceId)}
              {@const fp = comp.footprint || getFootprintForComponent(comp)}
              {@const isSel = selectedCompId === comp.instanceId}
              
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <g
                transform="translate({comp.xMm}, {comp.yMm}) rotate({comp.rotation || 0})"
                on:mousedown={(e) => startDragComp(e, comp)}
                class="pcb-comp-group"
              >
                <!-- Selection Highlight Bounding Box -->
                {#if isSel}
                  <rect
                    x={-fp.widthMm / 2 - 1.5}
                    y={-fp.heightMm / 2 - 1.5}
                    width={fp.widthMm + 3}
                    height={fp.heightMm + 3}
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="#38bdf8"
                    stroke-width="0.35"
                    stroke-dasharray="1.2, 0.8"
                  />
                {/if}

                <!-- Silkscreen Geometry (White outline & component markings) -->
                {#if showSilkscreen}
                  <g stroke="#ffffff" stroke-width="0.22" fill="none" opacity="0.88" pointer-events="none">
                    {#each (fp.silkscreen || []) as s}
                      {#if s.type === 'rect'}
                        <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r || 0} />
                      {:else if s.type === 'circle'}
                        <circle cx={s.cx} cy={s.cy} r={s.r} />
                      {:else if s.type === 'line'}
                        <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
                      {:else if s.type === 'text'}
                        <text x={s.x} y={s.y} font-size={s.size} text-anchor="middle" fill="#ffffff" font-family="monospace">
                          {s.text}
                        </text>
                      {/if}
                    {/each}
                    <!-- Reference Label -->
                    <text x="0" y={fp.heightMm / 2 + 2.5} font-size="1.8" text-anchor="middle" fill="#facc15" font-family="monospace" font-weight="bold">
                      {comp.label || comp.name}
                    </text>
                  </g>
                {/if}

                <!-- Pads (Annular Copper Rings with Drill Hole) -->
                {#each fp.pads as pad}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <g
                    class="pcb-pad-group"
                    on:click={(e) => handlePadClick(e, comp, pad, comp.xMm + pad.x, comp.yMm + pad.y)}
                  >
                    <!-- Copper Pad (Gold / Solder finish) -->
                    {#if pad.shape === 'rect'}
                      <rect
                        x={pad.x - pad.sizeMm / 2}
                        y={pad.y - pad.sizeMm / 2}
                        width={pad.sizeMm}
                        height={pad.sizeMm}
                        rx="0.1"
                        fill="#fbbf24"
                        stroke="#d97706"
                        stroke-width="0.15"
                      />
                    {:else}
                      <circle
                        cx={pad.x}
                        cy={pad.y}
                        r={pad.sizeMm / 2}
                        fill="#fbbf24"
                        stroke="#d97706"
                        stroke-width="0.15"
                      />
                    {/if}

                    <!-- Drill Hole (Dark Center) -->
                    {#if pad.drillMm}
                      <circle
                        cx={pad.x}
                        cy={pad.y}
                        r={pad.drillMm / 2}
                        fill="#03160b"
                        pointer-events="none"
                      />
                    {/if}

                    <!-- Pin Number Tooltip -->
                    <title>{comp.label || comp.name}: Pin {pad.num || pad.name}</title>
                  </g>
                {/each}

              </g>
            {/each}
          </g>

          <!-- E. DRC Active Highlight Target Pulsing Marker -->
          {#if activeHighlight}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <g id="drc-highlight-target" on:click={() => clearDrcHighlight()} class="drc-pulsing-marker" cursor="pointer">
              <circle cx={activeHighlight.xMm} cy={activeHighlight.yMm} r="5" fill="none" stroke="#ef4444" stroke-width="0.7" stroke-dasharray="1 1" />
              <circle cx={activeHighlight.xMm} cy={activeHighlight.yMm} r="1.5" fill="#ef4444" />
              <rect x={activeHighlight.xMm + 2} y={activeHighlight.yMm - 6} width="22" height="5" rx="1" fill="#0f172a" stroke="#ef4444" stroke-width="0.3" />
              <text x={activeHighlight.xMm + 4} y={activeHighlight.yMm - 2.5} font-size="2.4" font-family="monospace" font-weight="bold" fill="#fca5a5">
                {activeHighlight.code}
              </text>
            </g>
          {/if}

        </g>
      </svg>

      <!-- Auto-Router Feedback Notification Toast -->
      {#if autoRouteFeedback}
        <div class="pcb-feedback-toast">
          <span>{autoRouteFeedback}</span>
        </div>
      {/if}

      <!-- Bottom-Left HUD: DRC Status, Zoom, and Fit View -->
      <div class="pcb-hud pcb-hud-bottom-left">
        <div class="pcb-drc-status">
          <span class="pcb-status-dot" class:pcb-dot-ok={drcResults.ok} class:pcb-dot-warn={!drcResults.ok}></span>
          <span class="pcb-status-text">
            {drcResults.ok ? 'DRC: 100% Terhubung' : `Belum Terhubung: ${drcResults.unroutedCount} jalur`}
          </span>
        </div>
        <span class="pcb-hud-sep">•</span>
        <span class="pcb-hud-zoom font-mono">Zoom: {Math.round(zoom * 30)}%</span>
        <span class="pcb-hud-sep">•</span>
        <button on:click={fitToBoard} class="pcb-link-btn">Fit Board</button>
        <span class="pcb-hud-sep">•</span>
        <button on:click={resetView} class="pcb-link-btn">Reset</button>
      </div>

      <!-- Bottom-Center Routing Guide Hint -->
      {#if activeTool === 'route'}
        <div class="pcb-hud pcb-hud-center">
          <span class="pcb-route-tip">
            {#if !routingStart}
              ⚡ Klik pad komponen untuk mulai menarik jalur tembaga
            {:else}
              📍 Klik titik belokan (45°) atau klik pad target untuk menyelesaikan
            {/if}
          </span>
        </div>
      {/if}

      <!-- Top-Right HUD: Layer Visibility Switches -->
      <div class="pcb-hud pcb-hud-top-right">
        <label class="pcb-toggle-row">
          <input type="checkbox" bind:checked={showRatsnest} class="pcb-chk" />
          <span class="pcb-toggle-lbl">Garis Pandu (Ratsnest)</span>
        </label>
        <label class="pcb-toggle-row">
          <input type="checkbox" bind:checked={showSilkscreen} class="pcb-chk" />
          <span class="pcb-toggle-lbl">Silkscreen Putih</span>
        </label>
        <label class="pcb-toggle-row pcb-toggle-top">
          <input type="checkbox" bind:checked={showTopCopper} class="pcb-chk" />
          <span class="pcb-toggle-lbl">Top Copper (F.Cu)</span>
        </label>
        <label class="pcb-toggle-row pcb-toggle-bottom">
          <input type="checkbox" bind:checked={showBottomCopper} class="pcb-chk" />
          <span class="pcb-toggle-lbl">Bottom Copper (B.Cu)</span>
        </label>
      </div>

    </div>

    <!-- Right Sidebar Inspector Panel -->
    {#if showInspector}
      <aside class="pcb-inspector">
        <!-- Panel Header -->
        <div class="pcb-insp-head">
          <span class="pcb-insp-title">Inspector PCB</span>
          <button class="pcb-close-btn" on:click={() => showInspector = false}>✕</button>
        </div>

        <!-- Section 1: Board Dimensions -->
        <div class="pcb-card">
          <h4 class="pcb-card-title">Dimensi Papan PCB</h4>
          <p class="pcb-card-desc">Ukuran fisik papan substrat FR-4 (mm).</p>
          <div class="pcb-form-grid">
            <div class="pcb-field">
              <label for="board-w" class="pcb-field-lbl">Lebar (mm)</label>
              <input id="board-w" type="number" bind:value={boardWidthMm} min="30" max="350" class="pcb-input font-mono" />
            </div>
            <div class="pcb-field">
              <label for="board-h" class="pcb-field-lbl">Panjang (mm)</label>
              <input id="board-h" type="number" bind:value={boardHeightMm} min="30" max="350" class="pcb-input font-mono" />
            </div>
          </div>
          <div class="pcb-form-grid" style="margin-top: 8px;">
            <div class="pcb-field">
              <label for="board-r" class="pcb-field-lbl">Radius Sudut (mm)</label>
              <input id="board-r" type="number" bind:value={cornerRadiusMm} min="0" max="15" class="pcb-input font-mono" />
            </div>
            <div class="pcb-field">
              <label for="board-m" class="pcb-field-lbl">Lubang Baut M3</label>
              <label class="pcb-toggle-row" style="margin-top: 6px;">
                <input id="board-m" type="checkbox" bind:checked={mountingHoles} class="pcb-chk" />
                <span class="pcb-toggle-lbl" style="font-size: 11px;">Aktif (4 Sudut)</span>
              </label>
            </div>
          </div>
          <label class="pcb-toggle-row" style="margin-top: 8px;">
            <input type="checkbox" bind:checked={showCopperPour} class="pcb-chk" />
            <span class="pcb-toggle-lbl" style="font-size: 11px; font-weight: 600; color: #38bdf8;">
              ⚡ Ground Plane (Poligon Tembaga)
            </span>
          </label>
        </div>

        <!-- Section 2: Selected Component -->
        <div class="pcb-card">
          <h4 class="pcb-card-title">Komponen Terpilih</h4>
          {#if selectedCompId}
            {@const sel = pcbComponents.find(c => c.instanceId === selectedCompId)}
            <div class="pcb-selected-box">
              <div class="pcb-sel-name">{sel?.label || sel?.name}</div>
              <div class="pcb-sel-meta">Footprint: {sel?.footprint?.name || 'Standard'}</div>
              <div class="pcb-sel-meta">Rotasi: {sel?.rotation || 0}° | Posisi: X={sel?.xMm}mm Y={sel?.yMm}mm</div>
              <button on:click={() => rotateSelectedComponent(90)} class="pcb-btn pcb-btn-full">
                <span>↻</span>
                <span>Putar 90° (R)</span>
              </button>
            </div>
          {:else}
            <div class="pcb-empty-hint">
              Klik komponen di atas kanvas PCB untuk mengatur posisi dan rotasi.
            </div>
          {/if}
        </div>

        <!-- Section 3: Copper Traces Management -->
        <div class="pcb-card">
          <h4 class="pcb-card-title">Jalur Tembaga & Via</h4>
          <div class="pcb-stat-row">
            <span>Total Segmen Jalur:</span>
            <span class="pcb-stat-val">{copperTraces.length} segmen</span>
          </div>
          <div class="pcb-stat-row">
            <span>Total Through-hole Via:</span>
            <span class="pcb-stat-val">{vias.length} via</span>
          </div>
          {#if selectedTraceId}
            <button on:click={deleteSelectedTrace} class="pcb-btn pcb-btn-danger pcb-btn-full" style="margin-bottom: 8px;">
              <span>🗑</span>
              <span>Hapus Elemen Terpilih (Del)</span>
            </button>
          {/if}
          <button on:click={clearAllTraces} class="pcb-btn pcb-btn-full">
            <span>🧹</span>
            <span>Bersihkan Semua Jalur & Via</span>
          </button>
        </div>

        <!-- Section 3.5: DRC (Design Rule Check) Real-Time Audit -->
        <div class="pcb-card">
          <div class="pcb-drc-header">
            <h4 class="pcb-card-title">Aturan Desain (DRC CAD)</h4>
            <span class="pcb-badge" class:pcb-badge-ok={drcResults.ok && drcResults.clean} class:pcb-badge-warn={!drcResults.ok || !drcResults.clean}>
              {drcResults.ok && drcResults.clean ? '✓ Passed' : `${(drcResults.errors?.length || 0) + (drcResults.warnings?.length || 0)} Isu`}
            </span>
          </div>
          <p class="pcb-card-desc">Audit real-time standar pabrikasi JLCPCB / PCBWay.</p>
          
          {#if drcResults.errors && drcResults.errors.length > 0}
            <div class="pcb-drc-list pcb-drc-errors">
              {#each drcResults.errors as err}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div class="pcb-drc-item pcb-drc-err pcb-drc-clickable" on:click={() => highlightDrcIssue(err)} title="Klik untuk melompat ke lokasi koordinat masalah di kanvas">
                  <span class="pcb-drc-icon">🚫</span>
                  <div class="pcb-drc-msg">
                    <strong>{err.code}</strong>: {err.message}
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if drcResults.warnings && drcResults.warnings.length > 0}
            <div class="pcb-drc-list pcb-drc-warnings">
              {#each drcResults.warnings as warn}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div class="pcb-drc-item pcb-drc-warn pcb-drc-clickable" on:click={() => highlightDrcIssue(warn)} title="Klik untuk melompat ke lokasi koordinat masalah di kanvas">
                  <span class="pcb-drc-icon">⚠️</span>
                  <div class="pcb-drc-msg">
                    <strong>{warn.code}</strong>: {warn.message}
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if drcResults.clean}
            <div class="pcb-drc-clean-box">
              <span class="pcb-clean-icon">🛡️</span>
              <div>Semua jalur tembaga, via, dan footprint pad memenuhi aturan manufaktur. Siap diekspor!</div>
            </div>
          {/if}
        </div>

        <!-- Section 3.8: Maker Cost & Fab Estimator -->
        <div class="pcb-card">
          <div class="pcb-drc-header">
            <h4 class="pcb-card-title">Estimasi Biaya Manufaktur</h4>
            <span class="pcb-badge pcb-badge-ok font-mono">~${bomCostEstimate.totalCostUsd} USD</span>
          </div>
          <p class="pcb-card-desc">Estimasi order prototipe 5 keping PCB (JLCPCB) + komponen.</p>
          <div class="pcb-stat-row">
            <span>Luas Substrat FR-4:</span>
            <span class="pcb-stat-val">{bomCostEstimate.areaCm2} cm²</span>
          </div>
          <div class="pcb-stat-row">
            <span>Cetak PCB (5 keping):</span>
            <span class="pcb-stat-val">${bomCostEstimate.pcbFabCostUsd} USD</span>
          </div>
          <div class="pcb-stat-row">
            <span>Komponen BOM:</span>
            <span class="pcb-stat-val">${bomCostEstimate.componentsCostUsd} USD</span>
          </div>
          <div class="pcb-stat-row">
            <span>Waktu Fabrikasi:</span>
            <span class="pcb-stat-val" style="color: #38bdf8;">{bomCostEstimate.leadTimeDays}</span>
          </div>
        </div>

        <!-- Section 4: Export Action -->
        <div class="pcb-card pcb-card-action">
          <button on:click={() => showExportModal = true} class="pcb-btn pcb-btn-export pcb-btn-full pcb-btn-lg">
            <span>📦</span>
            <span>Ekspor Gerber & EasyEDA</span>
          </button>
        </div>
      </aside>
    {/if}

  </div>

  <!-- 3. Export Modal -->
  {#if showExportModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="pcb-modal-backdrop" on:click={() => showExportModal = false}>
      <div class="pcb-modal-box" on:click|stopPropagation>
        
        <!-- Modal Header -->
        <div class="pcb-modal-head">
          <div class="pcb-modal-title-group">
            <span class="pcb-modal-icon">📦</span>
            <div>
              <h3 class="pcb-modal-title">Ekspor Produksi PCB</h3>
              <p class="pcb-modal-desc">Pilih format industri untuk pabrikasi atau cetak DIY skala 1:1.</p>
            </div>
          </div>
          <button on:click={() => showExportModal = false} class="pcb-modal-close" aria-label="Tutup Modal">✕</button>
        </div>

        <!-- Notification Alert -->
        {#if exportSuccessMsg}
          <div class="pcb-alert-success">
            <span>✓</span>
            <span>{exportSuccessMsg}</span>
          </div>
        {/if}

        <!-- Cards Group -->
        <div class="pcb-export-cards">
          <!-- Card 1: Gerber RS-274X -->
          <div class="pcb-export-card">
            <div class="pcb-card-head">
              <span class="pcb-card-label">Paket Gerber RS-274X + Excellon</span>
              <span class="pcb-card-tag pcb-tag-green">Pabrik PCB</span>
            </div>
            <p class="pcb-card-text">
              Standar industri untuk pesanan di JLCPCB, PCBWay, dsb. Mencakup Top Copper (.gtl), Bottom (.gbl), Outline (.gko), dan Drill (.drl).
            </p>
            <button on:click={triggerGerberDownload} class="pcb-btn pcb-btn-primary pcb-btn-full">
              <span>⬇</span>
              <span>Unduh File Gerber (.gtl, .gbl, .drl)</span>
            </button>
          </div>

          <!-- Card 2: EasyEDA Source JSON -->
          <div class="pcb-export-card">
            <div class="pcb-card-head">
              <span class="pcb-card-label">EasyEDA Standard Project</span>
              <span class="pcb-card-tag pcb-tag-blue">JSON</span>
            </div>
            <p class="pcb-card-text">
              Format kompatibel langsung dengan EasyEDA Web / Desktop Editor. Siap diimpor dan diedit ulang kapan saja.
            </p>
            <button on:click={triggerEasyEdaExport} class="pcb-btn pcb-btn-secondary pcb-btn-full">
              <span>📄</span>
              <span>Unduh Format EasyEDA (.json)</span>
            </button>
          </div>

          <!-- Card 3: DIY Etching SVG -->
          <div class="pcb-export-card">
            <div class="pcb-card-head">
              <span class="pcb-card-label">Masker Cetak Sablon / Setrika DIY</span>
              <span class="pcb-card-tag pcb-tag-amber">Skala 1:1</span>
            </div>
            <p class="pcb-card-text">
              File vektor SVG hitam-putih skala 1:1 milimeter presisi untuk metode setrika toner transfer atau sablon feriklorida ($FeCl_3$).
            </p>
            <div class="pcb-export-btn-row">
              <button on:click={() => triggerEtchingSvgExport('bottom', false)} class="pcb-btn pcb-btn-full">
                <span>Jalur Normal (B.Cu)</span>
              </button>
              <button on:click={() => triggerEtchingSvgExport('bottom', true)} class="pcb-btn pcb-btn-full">
                <span>Inverted (Negatif)</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  {/if}

</div>

<style>
  /* ── Core Studio Container ── */
  .pcb-studio {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: #090d16;
    color: #e2e8f0;
    user-select: none;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }

  /* ── Ribbon Toolbar ── */
  .pcb-ribbon {
    height: 44px;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    gap: 8px;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    z-index: 30;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .pcb-ribbon::-webkit-scrollbar { display: none; }

  .pcb-ribbon-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .pcb-ribbon-center {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .pcb-ribbon-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .pcb-sep {
    width: 1px;
    height: 20px;
    background: #1e293b;
  }

  /* Title & Badges */
  .pcb-title-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pcb-title-text {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.2px;
  }

  /* Buttons */
  .pcb-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 5px 10px;
    background: #1e293b;
    color: #cbd5e1;
    border: 1px solid #334155;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .pcb-btn:hover {
    background: #334155;
    color: #ffffff;
    border-color: #475569;
  }
  .pcb-btn-active {
    background: #0369a1;
    color: #ffffff;
    border-color: #38bdf8;
  }
  .pcb-btn-back {
    background: #1e293b;
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.3);
  }
  .pcb-btn-back:hover {
    background: #0284c7;
    color: #ffffff;
    border-color: #0284c7;
  }
  .pcb-btn-export {
    background: #059669;
    color: #ffffff;
    border-color: #10b981;
    box-shadow: 0 2px 6px rgba(5, 150, 105, 0.3);
  }
  .pcb-btn-export:hover {
    background: #10b981;
  }
  .pcb-btn-primary {
    background: #059669;
    color: #ffffff;
    border-color: #10b981;
  }
  .pcb-btn-primary:hover {
    background: #10b981;
  }
  .pcb-btn-secondary {
    background: #0284c7;
    color: #ffffff;
    border-color: #38bdf8;
  }
  .pcb-btn-secondary:hover {
    background: #0369a1;
  }
  .pcb-btn-danger {
    background: rgba(225, 29, 72, 0.2);
    color: #f43f5e;
    border-color: rgba(225, 29, 72, 0.4);
  }
  .pcb-btn-danger:hover {
    background: #e11d48;
    color: #ffffff;
  }
  .pcb-btn-full {
    width: 100%;
  }
  .pcb-btn-lg {
    padding: 8px 12px;
    font-size: 12px;
  }

  /* Tool Buttons */
  .pcb-tool-group {
    display: flex;
    align-items: center;
    background: #090d16;
    border: 1px solid #1e293b;
    border-radius: 7px;
    padding: 2px;
    gap: 2px;
  }
  .pcb-tool-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: transparent;
    color: #94a3b8;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
  }
  .pcb-tool-btn:hover {
    background: #1e293b;
    color: #ffffff;
  }
  .pcb-tool-btn.pcb-tool-active {
    background: #0284c7;
    color: #ffffff;
    border-color: #38bdf8;
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.35);
  }
  .pcb-tool-route.pcb-tool-active {
    background: #059669;
    border-color: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.35);
  }

  /* Layers Toggle Group */
  .pcb-layer-group {
    display: flex;
    align-items: center;
    background: #090d16;
    border: 1px solid #1e293b;
    border-radius: 7px;
    padding: 2px;
    gap: 2px;
  }
  .pcb-layer-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: transparent;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.12s;
  }
  .pcb-layer-top {
    color: #f87171;
  }
  .pcb-layer-bottom {
    color: #60a5fa;
  }
  .pcb-layer-btn:hover {
    background: #1e293b;
  }
  .pcb-layer-top.pcb-layer-active {
    background: #dc2626;
    color: #ffffff;
    box-shadow: 0 0 8px rgba(220, 38, 38, 0.4);
  }
  .pcb-layer-bottom.pcb-layer-active {
    background: #2563eb;
    color: #ffffff;
    box-shadow: 0 0 8px rgba(37, 99, 235, 0.4);
  }
  .pcb-layer-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .pcb-dot-top { background: #f87171; }
  .pcb-dot-bottom { background: #60a5fa; }
  .pcb-layer-active .pcb-layer-dot { background: #ffffff; }

  /* Dropdown Selects */
  .pcb-select-wrap {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #94a3b8;
  }
  .pcb-select-label {
    font-weight: 600;
  }
  .pcb-select {
    background: #090d16;
    border: 1px solid #334155;
    border-radius: 5px;
    color: #f1f5f9;
    font-size: 11px;
    padding: 3px 6px;
    outline: none;
    cursor: pointer;
    max-width: 115px;
  }
  .pcb-select:focus {
    border-color: #38bdf8;
  }

  .pcb-via {
    cursor: pointer;
  }
  .pcb-via:hover circle:first-child {
    stroke: #38bdf8;
    stroke-width: 0.15;
  }

  /* ── Body & Canvas ── */
  .pcb-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .pcb-canvas-area {
    flex: 1;
    position: relative;
    background: #060911;
    overflow: hidden;
    cursor: crosshair;
  }

  .pcb-svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .pcb-comp-group {
    cursor: grab;
  }
  .pcb-comp-group:active {
    cursor: grabbing;
  }
  .pcb-pad-group {
    cursor: pointer;
  }
  .pcb-pad-group:hover circle, .pcb-pad-group:hover rect {
    filter: brightness(1.3);
  }
  .pcb-trace {
    cursor: pointer;
    transition: stroke 0.1s;
  }
  .pcb-trace:hover {
    filter: brightness(1.4);
  }

  /* ── Floating HUD Elements ── */
  .pcb-hud {
    position: absolute;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(51, 65, 85, 0.8);
    border-radius: 9px;
    padding: 6px 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    z-index: 10;
  }

  .pcb-hud-bottom-left {
    bottom: 12px;
    left: 12px;
  }

  .pcb-hud-center {
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(5, 150, 105, 0.9);
    border-color: #10b981;
    color: #ffffff;
    font-weight: 600;
    box-shadow: 0 0 16px rgba(16, 185, 129, 0.4);
  }

  .pcb-hud-top-right {
    top: 12px;
    right: 12px;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 8px 12px;
  }

  .pcb-hud-sep {
    color: #475569;
  }
  .pcb-hud-zoom {
    color: #94a3b8;
  }

  .pcb-drc-status {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pcb-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .pcb-dot-ok {
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
  }
  .pcb-dot-warn {
    background: #f59e0b;
    box-shadow: 0 0 6px #f59e0b;
    animation: pcb-pulse 1.2s infinite;
  }
  @keyframes pcb-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  .pcb-status-text {
    font-weight: 700;
    color: #f1f5f9;
  }

  .pcb-link-btn {
    background: none;
    border: none;
    color: #38bdf8;
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 600;
    padding: 0;
  }
  .pcb-link-btn:hover {
    text-decoration: underline;
  }

  .pcb-toggle-row {
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    font-size: 11px;
    color: #cbd5e1;
  }
  .pcb-toggle-row:hover {
    color: #ffffff;
  }
  .pcb-toggle-top { color: #f87171; }
  .pcb-toggle-bottom { color: #60a5fa; }
  .pcb-chk {
    cursor: pointer;
    accent-color: #0284c7;
  }

  /* ── Right Inspector Panel ── */
  .pcb-inspector {
    width: 270px;
    background: #0f172a;
    border-left: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 12px;
    overflow-y: auto;
    flex-shrink: 0;
    z-index: 20;
  }

  .pcb-insp-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid #1e293b;
  }
  .pcb-insp-title {
    font-size: 12px;
    font-weight: 700;
    color: #38bdf8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .pcb-close-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 13px;
    cursor: pointer;
  }
  .pcb-close-btn:hover {
    color: #ffffff;
  }

  .pcb-card {
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pcb-card-title {
    font-size: 11.5px;
    font-weight: 700;
    color: #f1f5f9;
  }
  .pcb-card-desc {
    font-size: 10px;
    color: #94a3b8;
    margin-bottom: 4px;
  }

  .pcb-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .pcb-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .pcb-field-lbl {
    font-size: 10px;
    color: #94a3b8;
  }
  .pcb-input {
    background: #090d16;
    border: 1px solid #334155;
    border-radius: 5px;
    padding: 4px 6px;
    color: #f1f5f9;
    font-size: 11px;
  }
  .pcb-input:focus {
    border-color: #38bdf8;
    outline: none;
  }

  .pcb-selected-box {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 8px;
  }
  .pcb-sel-name {
    font-weight: 700;
    color: #38bdf8;
    font-size: 12px;
  }
  .pcb-sel-meta {
    font-size: 10.5px;
    color: #94a3b8;
  }

  .pcb-empty-hint {
    font-size: 10.5px;
    color: #64748b;
    font-style: italic;
    text-align: center;
    padding: 8px 4px;
  }

  .pcb-stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 6px;
  }
  .pcb-stat-val {
    color: #ffffff;
    font-weight: 700;
    font-family: monospace;
  }

  /* ── DRC Inspector Section ── */
  .pcb-drc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .pcb-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .pcb-badge-ok {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.4);
  }
  .pcb-badge-warn {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.4);
  }
  .pcb-drc-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
    max-height: 180px;
    overflow-y: auto;
  }
  .pcb-drc-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 11px;
    padding: 6px 8px;
    border-radius: 6px;
    line-height: 1.35;
  }
  .pcb-drc-err {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }
  .pcb-drc-warn {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fde68a;
  }
  .pcb-drc-icon {
    font-size: 13px;
    flex-shrink: 0;
  }
  .pcb-drc-msg {
    flex: 1;
  }
  .pcb-drc-clean-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #a7f3d0;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 11px;
    margin-top: 8px;
    line-height: 1.35;
  }
  .pcb-clean-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .pcb-drc-clickable {
    cursor: pointer;
    transition: transform 0.1s ease, border-color 0.1s ease;
  }
  .pcb-drc-clickable:hover {
    transform: translateX(3px);
    border-color: #f59e0b;
  }

  /* ── Auto-Router & 3D Buttons ── */
  .pcb-btn-autoroute {
    background: linear-gradient(135deg, #1e3a8a, #2563eb);
    border: 1px solid #3b82f6;
    color: #ffffff;
    font-weight: 700;
  }
  .pcb-btn-autoroute:hover {
    background: linear-gradient(135deg, #2563eb, #3b82f6);
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
  }
  .pcb-btn-autoroute.is-loading {
    opacity: 0.7;
    cursor: wait;
  }
  .pcb-btn-3d {
    background: #1e293b;
    border: 1px solid #475569;
    color: #e2e8f0;
  }
  .pcb-btn-3d:hover {
    background: #334155;
    border-color: #94a3b8;
    color: #ffffff;
    box-shadow: 0 0 10px rgba(148, 163, 184, 0.2);
  }

  /* ── Auto-Router Feedback Toast ── */
  .pcb-feedback-toast {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid #3b82f6;
    color: #93c5fd;
    padding: 8px 18px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
    z-index: 100;
    animation: pcb-toast-pop 0.2s ease-out;
  }
  @keyframes pcb-toast-pop {
    from { opacity: 0; transform: translate(-50%, -10px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  /* ── DRC Target Pulsing Marker ── */
  .drc-pulsing-marker {
    animation: drc-pulse 1s infinite alternate;
  }
  @keyframes drc-pulse {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0.6; transform: scale(1.08); }
  }

  .pcb-card-action {
    margin-top: auto;
    background: transparent;
    border: none;
    padding: 0;
  }

  /* ── Export Modal ── */
  .pcb-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }
  .pcb-modal-box {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 14px;
    width: 100%;
    max-width: 480px;
    padding: 20px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: pcb-pop 0.15s ease-out;
  }
  @keyframes pcb-pop {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }

  .pcb-modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1px solid #1e293b;
  }
  .pcb-modal-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pcb-modal-icon {
    font-size: 20px;
  }
  .pcb-modal-title {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
  }
  .pcb-modal-desc {
    font-size: 11px;
    color: #94a3b8;
  }
  .pcb-modal-close {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 16px;
    cursor: pointer;
  }
  .pcb-modal-close:hover {
    color: #ffffff;
  }

  .pcb-alert-success {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    border-radius: 8px;
    padding: 8px 12px;
    color: #34d399;
    font-size: 11.5px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pcb-export-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .pcb-export-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 9px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.12s;
  }
  .pcb-export-card:hover {
    border-color: #38bdf8;
  }

  .pcb-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .pcb-card-label {
    font-weight: 700;
    font-size: 12px;
    color: #ffffff;
  }
  .pcb-card-tag {
    font-size: 9.5px;
    font-family: monospace;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
  }
  .pcb-tag-green {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .pcb-tag-blue {
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }
  .pcb-tag-amber {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .pcb-card-text {
    font-size: 10.5px;
    color: #94a3b8;
    line-height: 1.4;
    margin-bottom: 4px;
  }
  .pcb-export-btn-row {
    display: flex;
    gap: 8px;
  }

  /* ── Responsive Styling ── */
  @media (max-width: 1023px) {
    .pcb-inspector {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      box-shadow: -6px 0 24px rgba(0, 0, 0, 0.7);
    }
  }

  @media (max-width: 768px) {
    .pcb-ribbon {
      padding: 0 8px;
      gap: 6px;
    }
    .pcb-btn-text, .pcb-title-text, .pcb-select-label {
      display: none;
    }
    .pcb-hud-top-right {
      display: none;
    }
  }
</style>
