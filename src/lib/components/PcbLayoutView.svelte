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
    ripUpNetTraces,
    activeHighlightedNet,
    getDiscoveredNets,
    addPcbVia,
    removePcbVia,
    clearPcbVias,
    pushHistory
  } from '$lib/store/diagram.js'

  import {
    mm2px, px2mm, snapToPcbGrid, snapTo45Degrees,
    getFootprintForComponent, generateRatsnestLines, runPcbDrcCheck,
    generateGerberRS274X, exportToEasyEDAJson, generateDiyEtchingSvg,
    autoRoutePcbNets, generateCopperPourSvgPath, estimatePcbBOMCost,
    generatePcbTeardrops, generatePickAndPlaceCplCsv, generateEnclosureStl,
    generateThermalReliefs, buildPcbNetlist, getCompPadAliases
  } from '$lib/engine/pcb-engine.js'

  import PcbRibbon from './pcb/PcbRibbon.svelte'
  import PcbInspector from './pcb/PcbInspector.svelte'
  import PcbExportModal from './pcb/PcbExportModal.svelte'

  const dispatch = createEventDispatcher()

  // ── PCB Board & Viewport State ──────────────────────────────────────────────
  let boardWidthMm = 100
  let boardHeightMm = 80
  let gridStepMm = 2.54 // standard 100 mil grid (switchable to 1.27mm / 0.5mm)
  let cornerRadiusMm = 3
  let mountingHoles = true
  let showCopperPour = false
  let enableTeardrops = true

  // ── CAD Measuring Ruler & Custom Silkscreen State ───────────────────────────
  let pcbDimensions = [] // { id, x1, y1, x2, y2, distMm, dx, dy }
  let rulerStart = null
  let rulerCurrent = null

  let customSilkscreenTexts = [
    { id: 'txt-1', text: 'VER 1.0', xMm: 12, yMm: 72, layer: 'top', sizeMm: 2.0, rotation: 0 },
    { id: 'txt-2', text: 'JLCPCB / PCBWay', xMm: 80, yMm: 72, layer: 'top', sizeMm: 1.6, rotation: 0 }
  ]
  let selectedTextId = null

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
  let activeTool = 'select' // 'select' | 'route' | 'via' | 'ruler' | 'text'
  let activeLayer = 'top' // 'top' (F.Cu - Red) | 'bottom' (B.Cu - Blue)
  let activeTraceWidth = 0.40 // mm (0.25, 0.40, 0.80, 1.20)

  // ── PCB Layout Data (Connected to Global Store) ──────────────────────────────
  let pcbComponents = []
  $: copperTraces = $copperTracesStore
  $: vias = $pcbViasStore
  $: thermalReliefs = showCopperPour ? generateThermalReliefs(pcbComponents, vias) : []
  let selectedCompId = null
  let selectedTraceId = null
  $: selectedCompObj = pcbComponents.find(c => c.instanceId === selectedCompId) || null

  $: teardrops = enableTeardrops ? generatePcbTeardrops(copperTraces, pcbComponents, vias) : []

  function handleRipUpNet(netId) {
    if (!netId) return
    ripUpNetTraces(netId)
    autoRouteFeedback = `⚡ Jalur Net "${netId}" berhasil dihapus (rip-up).`
    setTimeout(() => { if (autoRouteFeedback.includes(netId)) autoRouteFeedback = '' }, 3000)
  }

  function handleExportModalAction(e) {
    const type = e.detail
    if (type === 'gerber-zip') triggerGerberDownload()
    else if (type === 'easyeda-json') triggerEasyEdaExport()
    else if (type === 'svg-top') triggerEtchingSvgExport('top', false)
    else if (type === 'svg-bottom') triggerEtchingSvgExport('bottom', false)
    else if (type === 'cpl-csv') triggerCplExport()
    else if (type === 'enclosure-stl') triggerEnclosureStlExport()
  }

  function triggerCplExport() {
    const csvContent = generatePickAndPlaceCplCsv({ widthMm: boardWidthMm, heightMm: boardHeightMm }, pcbComponents)
    downloadFile('JLCPCB_PickAndPlace_CPL.csv', csvContent, 'text/csv;charset=utf-8')
    exportSuccessMsg = 'File CPL Centroid (Pick & Place) berhasil diunduh untuk perakitan SMT JLCPCB / PCBWay!'
  }

  function triggerEnclosureStlExport() {
    const stlContent = generateEnclosureStl({ widthMm: boardWidthMm, heightMm: boardHeightMm })
    downloadFile('circuit_craft_enclosure_box.stl', stlContent, 'model/stl')
    exportSuccessMsg = 'File 3D Enclosure Casing (.stl) berhasil diunduh! Siap dicetak dengan 3D Printer.'
  }

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
    
    let curX = 6
    let curY = 6
    let rowMaxH = 0
    const margin = 3

    pcbComponents = rawComps.map((sc) => {
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

      const w = fp.widthMm || 20
      const h = fp.heightMm || 20

      if (curX + w + margin > boardWidthMm - margin && curX > 6) {
        curX = 6
        curY += rowMaxH + 6
        rowMaxH = 0
      }

      const compObj = {
        ...sc,
        xMm: Number((curX + w / 2).toFixed(2)),
        yMm: Number((curY + h / 2).toFixed(2)),
        rotation: 0,
        footprint: fp
      }

      curX += w + 6
      if (h > rowMaxH) rowMaxH = h

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

    // Interactive routing cursor position with magnetic pad snap
    if (activeTool === 'route') {
      const rect = e.currentTarget.getBoundingClientRect()
      const rawX = (e.clientX - rect.left - panX) / zoom
      const rawY = (e.clientY - rect.top - panY) / zoom

      // Detect pad magnetic snap
      const nearPad = findSnapPad(rawX, rawY, 3.5)
      snappedPad = nearPad

      if (routingStart) {
        if (nearPad) {
          routingCurrent = { xMm: nearPad.xMm, yMm: nearPad.yMm }
        } else {
          const snapped = snapTo45Degrees(
            routingStart.xMm,
            routingStart.yMm,
            snapToPcbGrid(rawX, gridStepMm),
            snapToPcbGrid(rawY, gridStepMm)
          )
          routingCurrent = snapped
        }
      }
    }

    // Interactive CAD ruler measurement preview
    if (activeTool === 'ruler' && rulerStart) {
      const rect = e.currentTarget.getBoundingClientRect()
      const rawX = (e.clientX - rect.left - panX) / zoom
      const rawY = (e.clientY - rect.top - panY) / zoom
      rulerCurrent = {
        xMm: Number(snapToPcbGrid(rawX, gridStepMm).toFixed(2)),
        yMm: Number(snapToPcbGrid(rawY, gridStepMm).toFixed(2))
      }
    }
  }

  function stopPan() {
    isPanning = false
  }

  let canvasAreaEl

  function fitToBoard() {
    if (canvasAreaEl) {
      const rect = canvasAreaEl.getBoundingClientRect()
      const w = rect.width || 800
      const h = rect.height || 600
      const padding = 50
      const fitZoom = Math.max(1.0, Math.min(5.5, Math.min((w - padding * 2) / boardWidthMm, (h - padding * 2) / boardHeightMm)))
      zoom = Number(fitZoom.toFixed(2))
      panX = Math.round((w - boardWidthMm * zoom) / 2)
      panY = Math.round((h - boardHeightMm * zoom) / 2)
    } else {
      zoom = 2.8
      panX = 120
      panY = 60
    }
  }

  function resetView() {
    fitToBoard()
  }

  function autoArrangeComponents() {
    pushHistory()
    let curX = 6
    let curY = 6
    let rowMaxH = 0
    const margin = 3

    pcbComponents.forEach((comp) => {
      const fp = comp.footprint || getFootprintForComponent(comp)
      const isRotated90 = (comp.rotation || 0) % 180 !== 0
      const w = isRotated90 ? (fp.heightMm || 20) : (fp.widthMm || 20)
      const h = isRotated90 ? (fp.widthMm || 20) : (fp.heightMm || 20)

      if (curX + w + margin > boardWidthMm - margin && curX > 6) {
        curX = 6
        curY += rowMaxH + 6
        rowMaxH = 0
      }

      comp.xMm = Number((curX + w / 2).toFixed(2))
      comp.yMm = Number((curY + h / 2).toFixed(2))

      curX += w + 6
      if (h > rowMaxH) rowMaxH = h
    })

    if (curY + rowMaxH + margin > boardHeightMm) {
      boardHeightMm = Math.ceil((curY + rowMaxH + margin + 10) / 10) * 10
    }

    pcbComponents = [...pcbComponents]
    updateRatsnest()
    fitToBoard()
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

      const fp = draggingComp.footprint || getFootprintForComponent(draggingComp)
      const isRotated90 = (draggingComp.rotation || 0) % 180 !== 0
      const boundW = isRotated90 ? (fp.heightMm || 20) : (fp.widthMm || 20)
      const boundH = isRotated90 ? (fp.widthMm || 20) : (fp.heightMm || 20)
      const halfW = boundW / 2
      const halfH = boundH / 2
      const margin = 2

      // Keep strictly within physical board outline
      draggingComp.xMm = Math.max(halfW + margin, Math.min(boardWidthMm - halfW - margin, newX))
      draggingComp.yMm = Math.max(halfH + margin, Math.min(boardHeightMm - halfH - margin, newY))
      
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

  // ── Pad Coordinate & Net Discovery Helpers ─────────────────────────────────
  let snappedPad = null

  function getPadWorldPos(comp, pad) {
    const rot = comp.rotation || 0
    const rad = (rot * Math.PI) / 180
    const cosR = Math.cos(rad)
    const sinR = Math.sin(rad)
    return {
      x: Number((comp.xMm + (pad.x * cosR - pad.y * sinR)).toFixed(2)),
      y: Number((comp.yMm + (pad.x * sinR + pad.y * cosR)).toFixed(2))
    }
  }

  function getPadNetId(comp, pad, padIndex = 0) {
    try {
      const { pinToNetMap, dsu } = buildPcbNetlist(pcbComponents, $wiresStore)
      const aliases = getCompPadAliases(comp, pad, padIndex)
      for (const alias of aliases) {
        const key = `${comp.instanceId}:${alias}`
        if (pinToNetMap.has(key)) return pinToNetMap.get(key)
        if (dsu.parent.has(key)) {
          const root = dsu.find(key)
          if (root) return pinToNetMap.get(root) || `NET_${root}`
        }
      }
    } catch (err) {
      console.warn('getPadNetId error:', err)
    }
    return null
  }

  function findSnapPad(worldX, worldY, maxDistMm = 3.5) {
    let closest = null
    let minDist = maxDistMm

    for (const comp of pcbComponents) {
      const fp = comp.footprint || getFootprintForComponent(comp)
      if (!fp || !fp.pads) continue
      const rot = comp.rotation || 0
      const rad = (rot * Math.PI) / 180
      const cosR = Math.cos(rad)
      const sinR = Math.sin(rad)

      for (let idx = 0; idx < fp.pads.length; idx++) {
        const pad = fp.pads[idx]
        const wx = comp.xMm + (pad.x * cosR - pad.y * sinR)
        const wy = comp.yMm + (pad.x * sinR + pad.y * cosR)
        const d = Math.hypot(worldX - wx, worldY - wy)
        if (d < minDist) {
          minDist = d
          closest = {
            comp,
            pad,
            padIndex: idx,
            xMm: Number(wx.toFixed(2)),
            yMm: Number(wy.toFixed(2))
          }
        }
      }
    }
    return closest
  }

  // ── Interactive Copper Trace Routing ────────────────────────────────────────
  function handlePadClick(e, comp, pad, padXmm, padYmm, padIndex = 0) {
    if (e && e.stopPropagation) e.stopPropagation()

    if (activeTool === 'route') {
      const padNet = getPadNetId(comp, pad, padIndex)

      if (!routingStart) {
        // Start a new copper trace from this pad
        routingStart = {
          compId: comp.instanceId,
          padNum: pad.num,
          xMm: padXmm,
          yMm: padYmm,
          netId: padNet
        }
        routingCurrent = { xMm: padXmm, yMm: padYmm }
        if (padNet) activeHighlightedNet.set(padNet)
      } else {
        // Complete the trace segment to this destination pad
        if (routingStart.xMm !== padXmm || routingStart.yMm !== padYmm) {
          addCopperTrace({
            layer: activeLayer,
            x1: routingStart.xMm,
            y1: routingStart.yMm,
            x2: padXmm,
            y2: padYmm,
            widthMm: activeTraceWidth,
            netId: routingStart.netId || padNet
          })
        }
        routingStart = null
        routingCurrent = null
        snappedPad = null
        updateRatsnest()
      }
    } else if (activeTool === 'select') {
      selectedCompId = comp.instanceId
      selectedTraceId = null
      const padNet = getPadNetId(comp, pad, padIndex)
      if (padNet) activeHighlightedNet.set(padNet)
    }
  }

  function handleCanvasClick(e) {
    if (activeTool === 'ruler') {
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseSvgX = (e.clientX - rect.left - panX) / zoom
      const mouseSvgY = (e.clientY - rect.top - panY) / zoom
      const mmX = Number(snapToPcbGrid(mouseSvgX, gridStepMm).toFixed(2))
      const mmY = Number(snapToPcbGrid(mouseSvgY, gridStepMm).toFixed(2))

      if (!rulerStart) {
        rulerStart = { xMm: mmX, yMm: mmY }
        rulerCurrent = { xMm: mmX, yMm: mmY }
      } else {
        const dist = Math.hypot(mmX - rulerStart.xMm, mmY - rulerStart.yMm)
        if (dist >= 0.5) {
          pcbDimensions = [
            ...pcbDimensions,
            {
              id: 'dim-' + Date.now(),
              x1: rulerStart.xMm,
              y1: rulerStart.yMm,
              x2: mmX,
              y2: mmY,
              distMm: Number(dist.toFixed(2)),
              dx: Number(Math.abs(mmX - rulerStart.xMm).toFixed(2)),
              dy: Number(Math.abs(mmY - rulerStart.yMm).toFixed(2))
            }
          ]
        }
        rulerStart = null
        rulerCurrent = null
      }
      return
    }

    if (activeTool === 'text') {
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseSvgX = (e.clientX - rect.left - panX) / zoom
      const mouseSvgY = (e.clientY - rect.top - panY) / zoom
      const mmX = Number(snapToPcbGrid(mouseSvgX, gridStepMm).toFixed(2))
      const mmY = Number(snapToPcbGrid(mouseSvgY, gridStepMm).toFixed(2))

      const defaultText = prompt('Masukkan teks silkscreen untuk PCB:', 'GND / TX / RX')
      if (defaultText && defaultText.trim()) {
        customSilkscreenTexts = [
          ...customSilkscreenTexts,
          {
            id: 'txt-' + Date.now(),
            text: defaultText.trim(),
            xMm: mmX,
            yMm: mmY,
            layer: activeLayer,
            sizeMm: 2.0,
            rotation: 0
          }
        ]
      }
      return
    }

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

    if (activeTool === 'route') {
      // If cursor is near a pad, treat click as clicking that pad!
      if (snappedPad) {
        handlePadClick(e, snappedPad.comp, snappedPad.pad, snappedPad.xMm, snappedPad.yMm, snappedPad.padIndex)
        return
      }

      if (routingStart && routingCurrent) {
        // Place an intermediate corner waypoint
        addCopperTrace({
          layer: activeLayer,
          x1: routingStart.xMm,
          y1: routingStart.yMm,
          x2: routingCurrent.xMm,
          y2: routingCurrent.yMm,
          widthMm: activeTraceWidth,
          netId: routingStart.netId
        })
        routingStart = { ...routingCurrent, netId: routingStart.netId }
        updateRatsnest()
        return
      }
    } else {
      selectedCompId = null
      selectedTraceId = null
      activeHighlightedNet.set(null)
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
  
  <!-- 1. Modular Top Ribbon Toolbar -->
  <PcbRibbon
    {activeTool}
    {activeLayer}
    {activeTraceWidth}
    {gridStepMm}
    {isAutoRouting}
    {showInspector}
    on:back={returnToWiringView}
    on:tool-change={e => activeTool = e.detail}
    on:layer-change={e => activeLayer = e.detail}
    on:trace-width-change={e => activeTraceWidth = e.detail}
    on:grid-step-change={e => gridStepMm = e.detail}
    on:autoroute={triggerAutoRouter}
    on:open-3d={() => is3dViewerOpen.set(true)}
    on:rotate-selected={() => rotateSelectedComponent(90)}
    on:toggle-inspector={() => showInspector = !showInspector}
    on:open-export={() => showExportModal = true}
  />

  <!-- 2. Main Workspace Body (Canvas + Properties Panel) -->
  <div class="pcb-body">

    <!-- Interactive SVG PCB Canvas Container -->
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      bind:this={canvasAreaEl}
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
          <!-- Keepout Hatching Pattern -->
          <pattern id="pcb-keepout-pattern" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="4" stroke="#ef4444" stroke-width="0.8" opacity="0.6" />
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
            <!-- Thermal Relief Spokes for Ground Pads -->
            <g id="thermal-reliefs-layer">
              {#each thermalReliefs as tr (tr.id)}
                <circle cx={tr.x} cy={tr.y} r={tr.radius + tr.gap} fill="none" stroke="#062e17" stroke-width={tr.gap} pointer-events="none" />
                <line x1={tr.x - tr.radius - tr.gap} y1={tr.y} x2={tr.x + tr.radius + tr.gap} y2={tr.y} stroke="#38bdf8" stroke-width={tr.spokeW} pointer-events="none" />
                <line x1={tr.x} y1={tr.y - tr.radius - tr.gap} x2={tr.x} y2={tr.y + tr.radius + tr.gap} stroke="#38bdf8" stroke-width={tr.spokeW} pointer-events="none" />
              {/each}
            </g>
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
              <!-- Teardrops Fillets on Bottom Layer -->
              {#each teardrops.filter(td => td.layer === 'bottom') as td (td.id)}
                <polygon
                  points={td.points}
                  fill={$activeHighlightedNet && td.netId === $activeHighlightedNet ? '#38bdf8' : '#2563eb'}
                  opacity="0.95"
                  pointer-events="none"
                />
              {/each}

              {#each copperTraces.filter(t => t.layer === 'bottom') as trace}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <line
                  x1={trace.x1} y1={trace.y1} x2={trace.x2} y2={trace.y2}
                  stroke={selectedTraceId === trace.id ? '#60a5fa' : ($activeHighlightedNet && trace.netId === $activeHighlightedNet) ? '#38bdf8' : '#2563eb'}
                  stroke-width={trace.widthMm}
                  stroke-linecap="round"
                  on:click={(e) => {
                    e.stopPropagation()
                    selectedTraceId = trace.id
                    selectedCompId = null
                    if (trace.netId) activeHighlightedNet.set(trace.netId)
                  }}
                  class="pcb-trace"
                  class:pcb-trace-highlight={$activeHighlightedNet && trace.netId === $activeHighlightedNet}
                />
              {/each}
            </g>
          {/if}

          <!-- D. Copper Traces (Top Layer F.Cu - Red) -->
          {#if showTopCopper}
            <g id="top-copper-layer">
              <!-- Teardrops Fillets on Top Layer -->
              {#each teardrops.filter(td => td.layer === 'top') as td (td.id)}
                <polygon
                  points={td.points}
                  fill={$activeHighlightedNet && td.netId === $activeHighlightedNet ? '#38bdf8' : '#dc2626'}
                  opacity="0.95"
                  pointer-events="none"
                />
              {/each}

              {#each copperTraces.filter(t => t.layer === 'top') as trace}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <line
                  x1={trace.x1} y1={trace.y1} x2={trace.x2} y2={trace.y2}
                  stroke={selectedTraceId === trace.id ? '#f87171' : ($activeHighlightedNet && trace.netId === $activeHighlightedNet) ? '#38bdf8' : '#dc2626'}
                  stroke-width={trace.widthMm}
                  stroke-linecap="round"
                  on:click={(e) => {
                    e.stopPropagation()
                    selectedTraceId = trace.id
                    selectedCompId = null
                    if (trace.netId) activeHighlightedNet.set(trace.netId)
                  }}
                  class="pcb-trace"
                  class:pcb-trace-highlight={$activeHighlightedNet && trace.netId === $activeHighlightedNet}
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

                <!-- Keepout Area (RF Antenna / High Voltage Isolation) -->
                {#if fp.keepout}
                  <rect
                    x={fp.keepout.x}
                    y={fp.keepout.y}
                    width={fp.keepout.w}
                    height={fp.keepout.h}
                    fill="url(#pcb-keepout-pattern)"
                    stroke="#ef4444"
                    stroke-width="0.3"
                    stroke-dasharray="0.8, 0.6"
                    pointer-events="none"
                  />
                  <text
                    x={fp.keepout.x + fp.keepout.w / 2}
                    y={fp.keepout.y + fp.keepout.h / 2 + 0.4}
                    font-size="1.2"
                    font-family="monospace"
                    font-weight="bold"
                    fill="#f87171"
                    text-anchor="middle"
                    pointer-events="none"
                  >
                    KEEPOUT
                  </text>
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
                {#each fp.pads as pad, idx}
                  {@const worldPos = getPadWorldPos(comp, pad)}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <g
                    class="pcb-pad-group"
                    on:click={(e) => handlePadClick(e, comp, pad, worldPos.x, worldPos.y, idx)}
                  >
                    <!-- Generous Invisible Click & Snap Area -->
                    <circle
                      cx={pad.x}
                      cy={pad.y}
                      r={Math.max(3.2, (pad.sizeMm || 1.8) * 1.4)}
                      fill="transparent"
                      pointer-events="all"
                      cursor="crosshair"
                    />

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

          <!-- Magnetic Pad Snap Target Halo -->
          {#if activeTool === 'route' && snappedPad}
            <g id="magnetic-pad-snap" pointer-events="none">
              <circle
                cx={snappedPad.xMm}
                cy={snappedPad.yMm}
                r="3.5"
                fill="rgba(74, 222, 128, 0.2)"
                stroke="#4ade80"
                stroke-width="0.5"
                stroke-dasharray="1 0.6"
              />
              <circle cx={snappedPad.xMm} cy={snappedPad.yMm} r="1.0" fill="#4ade80" />
            </g>
          {/if}
          {#if showSilkscreen}
            <g id="custom-silkscreen-layer">
              {#each customSilkscreenTexts as st (st.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <g
                  transform="translate({st.xMm}, {st.yMm}) rotate({st.rotation || 0})"
                  class="pcb-silk-text"
                  role="button"
                  tabindex="0"
                  on:click={(e) => { e.stopPropagation(); selectedTextId = st.id }}
                >
                  <text
                    x="0" y="0"
                    font-size={st.sizeMm || 2.0}
                    font-family="monospace"
                    font-weight="bold"
                    fill={st.layer === 'bottom' ? '#93c5fd' : '#ffffff'}
                    text-anchor="middle"
                    stroke={selectedTextId === st.id ? '#38bdf8' : 'none'}
                    stroke-width={selectedTextId === st.id ? '0.3' : '0'}
                    cursor="pointer"
                  >
                    {st.text}
                  </text>
                </g>
              {/each}
            </g>
          {/if}

          <!-- CAD Dimension Ruler Annotations Layer -->
          <g id="cad-dimensions-layer">
            {#each pcbDimensions as dim (dim.id)}
              {@const midX = (dim.x1 + dim.x2) / 2}
              {@const midY = (dim.y1 + dim.y2) / 2}
              <g class="pcb-dimension-item">
                <line x1={dim.x1} y1={dim.y1} x2={dim.x2} y2={dim.y2} stroke="#38bdf8" stroke-width="0.3" stroke-dasharray="1,0.6" />
                <circle cx={dim.x1} cy={dim.y1} r="0.8" fill="#38bdf8" />
                <circle cx={dim.x2} cy={dim.y2} r="0.8" fill="#38bdf8" />
                <rect x={midX - 12} y={midY - 2.5} width="24" height="5" rx="1.2" fill="#0f172a" stroke="#38bdf8" stroke-width="0.3" />
                <text x={midX} y={midY + 0.9} font-size="1.8" font-family="monospace" font-weight="bold" fill="#38bdf8" text-anchor="middle">
                  ↔ {dim.distMm}mm
                </text>
              </g>
            {/each}

            <!-- Live Measuring Preview -->
            {#if activeTool === 'ruler' && rulerStart && rulerCurrent}
              {@const curDist = Math.hypot(rulerCurrent.xMm - rulerStart.xMm, rulerCurrent.yMm - rulerStart.yMm)}
              {@const curMidX = (rulerStart.xMm + rulerCurrent.xMm) / 2}
              {@const curMidY = (rulerStart.yMm + rulerCurrent.yMm) / 2}
              <g class="pcb-ruler-preview">
                <line x1={rulerStart.xMm} y1={rulerStart.yMm} x2={rulerCurrent.xMm} y2={rulerCurrent.yMm} stroke="#f59e0b" stroke-width="0.4" stroke-dasharray="1.2,0.8" />
                <circle cx={rulerStart.xMm} cy={rulerStart.yMm} r="1.0" fill="#f59e0b" />
                <circle cx={rulerCurrent.xMm} cy={rulerCurrent.yMm} r="1.0" fill="#f59e0b" />
                <rect x={curMidX - 14} y={curMidY - 3} width="28" height="6" rx="1.5" fill="#1e293b" stroke="#f59e0b" stroke-width="0.4" />
                <text x={curMidX} y={curMidY + 1.2} font-size="2.0" font-family="monospace" font-weight="bold" fill="#facc15" text-anchor="middle">
                  📏 {curDist.toFixed(2)} mm
                </text>
              </g>
            {/if}
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
      <PcbInspector
        bind:boardWidthMm
        bind:boardHeightMm
        bind:cornerRadiusMm
        bind:includeMountHoles={mountingHoles}
        bind:showCopperPour
        bind:enableTeardrops
        activeHighlightedNet={$activeHighlightedNet}
        selectedComp={selectedCompObj}
        {selectedTraceId}
        copperTracesCount={copperTraces.length}
        viasCount={vias.length}
        dimensionsCount={pcbDimensions.length}
        customTextsCount={customSilkscreenTexts.length}
        {drcResults}
        {bomCostEstimate}
        on:close={() => showInspector = false}
        on:rotate-component={() => rotateSelectedComponent(90)}
        on:delete-selected-trace={deleteSelectedTrace}
        on:clear-all-traces={clearAllTraces}
        on:clear-dimensions={() => pcbDimensions = []}
        on:clear-texts={() => customSilkscreenTexts = []}
        on:rip-up-net={e => handleRipUpNet(e.detail)}
        on:toggle-teardrops={e => enableTeardrops = e.detail}
        on:auto-arrange={autoArrangeComponents}
        on:highlight-drc={e => highlightDrcIssue(e.detail)}
        on:open-export={() => showExportModal = true}
      />
    {/if}

  </div>

  <!-- 3. Export Modal -->
  <PcbExportModal
    bind:show={showExportModal}
    on:export={handleExportModalAction}
  />

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

  :global(.pcb-trace-highlight) {
    stroke: #38bdf8 !important;
    filter: drop-shadow(0 0 5px #38bdf8);
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

  /* ── Responsive Styling ── */
  @media (max-width: 768px) {
    .pcb-hud-top-right {
      display: none;
    }
  }
</style>
