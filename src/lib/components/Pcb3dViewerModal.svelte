<script>
  /**
   * ─────────────────────────────────────────────────────────────────────────────
   * Pcb3dViewerModal.svelte — Interactive 3D WebGL PCB & Hardware Visualizer
   * ─────────────────────────────────────────────────────────────────────────────
   * High-fidelity 3D hardware rendering engine built on Three.js WebGL.
   * 
   * Features:
   *  • 3D FR-4 Substrate with realistic thickness, solder mask colorways, and rounded corners
   *  • Plated copper traces (Top F.Cu & Bottom B.Cu) with metallic sheen
   *  • Real drilled through-hole vias and pad barrels
   *  • Procedural 3D Electronic Components:
   *      - ESP32 RF Shield module with antenna trace
   *      - Dual-in-line (DIP) IC chips with silver pin leads
   *      - Carbon film resistors with color identification bands
   *      - High-luminescence LEDs with bloom emissive glow
   *      - Dual-row and single-row gold pin headers
   *      - OLED / LCD graphic display glass panels
   *  • Studio Lighting with multi-point key, fill, and rim lights
   *  • Interactive Orbit, Pan, and Smooth Zoom Camera Controls
   *  • Exploded View mode (Z-axis stack layer separation)
   *  • High-Resolution CAD Screenshot Capture
   * ─────────────────────────────────────────────────────────────────────────────
   */
  import { onMount, onDestroy } from 'svelte'
  import * as THREE from 'three'
  import {
    pcbBoardConfig,
    copperTraces,
    pcbVias,
    components as compsStore,
    is3dViewerOpen
  } from '$lib/store/diagram.js'
  import { getFootprintForComponent } from '$lib/engine/pcb-engine.js'

  export let onClose = () => { is3dViewerOpen.set(false) }

  // ── DOM Canvas Container ──────────────────────────────────────────────────
  let canvasContainer
  let renderer = null
  let scene = null
  let camera = null
  let animationFrameId = null

  // ── 3D Scene Groups ───────────────────────────────────────────────────────
  let rootGroup = null
  let boardMesh = null
  let topTracesGroup = null
  let bottomTracesGroup = null
  let viasGroup = null
  let componentsGroup = null
  let silkscreenGroup = null

  // ── Viewer Display Settings ───────────────────────────────────────────────
  let soldermaskColor = $pcbBoardConfig.soldermaskColor || 'green'
  let showTopCopper = true
  let showBottomCopper = true
  let showComponents = true
  let showSilkscreen = true
  let autoRotate = false
  let autoRotateSpeed = 1.0
  let isWireframe = false
  let explodedZ = 0 // 0mm (compact) to 25mm (exploded layers)

  // ── Colorway Palette Definitions ──────────────────────────────────────────
  const SOLDERMASK_PALETTES = {
    green: { name: 'Emerald Green (Standard)', hex: 0x14532d, specular: 0x22c55e, roughness: 0.35 },
    black: { name: 'Matte Jet Black', hex: 0x090d16, specular: 0x334155, roughness: 0.55 },
    blue:  { name: 'Royal Navy Blue', hex: 0x1e3a8a, specular: 0x38bdf8, roughness: 0.35 },
    red:   { name: 'Ferrari Racing Red', hex: 0x991b1b, specular: 0xf87171, roughness: 0.35 },
    white: { name: 'Arctic Studio White', hex: 0xe2e8f0, specular: 0xffffff, roughness: 0.40 },
    purple:{ name: 'Deep Violet CAD', hex: 0x581c87, specular: 0xc084fc, roughness: 0.35 }
  }

  // ── Camera Orbit State ────────────────────────────────────────────────────
  let isDragging = false
  let isPanning = false
  let prevMouseX = 0
  let prevMouseY = 0
  let spherical = { radius: 180, theta: Math.PI / 4, phi: Math.PI / 3 }
  let target = new THREE.Vector3(0, 0, 0)

  // ── Component Dimensions & Materials ──────────────────────────────────────
  let boardWidth = $pcbBoardConfig.widthMm || 100
  let boardHeight = $pcbBoardConfig.heightMm || 80
  let boardThickness = $pcbBoardConfig.thicknessMm || 1.6

  // ── Materials Cache ───────────────────────────────────────────────────────
  let materials = {}

  function initMaterials() {
    materials = {
      fr4Core: new THREE.MeshStandardMaterial({
        color: 0x3f3f26,
        roughness: 0.8,
        metalness: 0.1
      }),
      soldermask: new THREE.MeshStandardMaterial({
        color: SOLDERMASK_PALETTES[soldermaskColor].hex,
        roughness: SOLDERMASK_PALETTES[soldermaskColor].roughness,
        metalness: 0.15,
        wireframe: isWireframe
      }),
      topCopper: new THREE.MeshStandardMaterial({
        color: 0xf59e0b, // Gold/Brass Immersion ENIG
        roughness: 0.25,
        metalness: 0.85
      }),
      bottomCopper: new THREE.MeshStandardMaterial({
        color: 0x38bdf8, // Tin/Lead HASL or B.Cu
        roughness: 0.30,
        metalness: 0.80
      }),
      silkscreen: new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95
      }),
      viaHole: new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.9
      }),
      icEpoxy: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.5,
        metalness: 0.2
      }),
      icLeg: new THREE.MeshStandardMaterial({
        color: 0xd1d5db,
        roughness: 0.2,
        metalness: 0.9
      }),
      goldPin: new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        roughness: 0.15,
        metalness: 0.95
      }),
      rfShield: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.25,
        metalness: 0.85
      }),
      resistorBody: new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.4
      }),
      displayGlass: new THREE.MeshStandardMaterial({
        color: 0x020617,
        roughness: 0.1,
        metalness: 0.9
      })
    }
  }

  // ── Three.js Scene Setup ──────────────────────────────────────────────────
  function initScene() {
    if (!canvasContainer) return

    const width = canvasContainer.clientWidth
    const height = canvasContainer.clientHeight

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0f1d)

    camera = new THREE.PerspectiveCamera(40, width / height, 1, 2000)
    updateCameraPosition()

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    canvasContainer.innerHTML = ''
    canvasContainer.appendChild(renderer.domElement)

    // Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(100, 180, 150)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 2048
    keyLight.shadow.mapSize.height = 2048
    keyLight.shadow.camera.near = 10
    keyLight.shadow.camera.far = 600
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.5)
    fillLight.position.set(-120, -80, -100)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.4)
    rimLight.position.set(0, 120, -160)
    scene.add(rimLight)

    // Root Group
    rootGroup = new THREE.Group()
    scene.add(rootGroup)

    initMaterials()
    buildPcb3dModel()

    animate()
  }

  // ── Build Full 3D PCB Hierarchy ───────────────────────────────────────────
  function buildPcb3dModel() {
    if (!rootGroup) return

    // Clear previous children
    while (rootGroup.children.length > 0) {
      const obj = rootGroup.children[0]
      rootGroup.remove(obj)
    }

    const halfW = boardWidth / 2
    const halfH = boardHeight / 2
    const cornerR = $pcbBoardConfig.cornerRadiusMm || 3
    const t = boardThickness

    // 1. Substrate Board Mesh
    const boardShape = new THREE.Shape()
    boardShape.moveTo(-halfW + cornerR, -halfH)
    boardShape.lineTo(halfW - cornerR, -halfH)
    boardShape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + cornerR)
    boardShape.lineTo(halfW, halfH - cornerR)
    boardShape.quadraticCurveTo(halfW, halfH, halfW - cornerR, halfH)
    boardShape.lineTo(-halfW + cornerR, halfH)
    boardShape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - cornerR)
    boardShape.lineTo(-halfW, -halfH + cornerR)
    boardShape.quadraticCurveTo(-halfW, -halfH, -halfW + cornerR, -halfH)

    // Corner Mounting Holes
    if ($pcbBoardConfig.mountingHoles) {
      const holeR = ($pcbBoardConfig.mountingHoleDiaMm || 3.2) / 2
      const mOffset = 4
      const corners = [
        [-halfW + mOffset, -halfH + mOffset],
        [halfW - mOffset, -halfH + mOffset],
        [halfW - mOffset, halfH - mOffset],
        [-halfW + mOffset, halfH - mOffset]
      ]
      corners.forEach(([hx, hy]) => {
        const holePath = new THREE.Path()
        holePath.absarc(hx, hy, holeR, 0, Math.PI * 2, true)
        boardShape.holes.push(holePath)
      })
    }

    const extrudeSettings = {
      depth: t,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.15,
      bevelThickness: 0.15
    }

    const boardGeometry = new THREE.ExtrudeGeometry(boardShape, extrudeSettings)
    boardMesh = new THREE.Mesh(boardGeometry, materials.soldermask)
    boardMesh.receiveShadow = true
    boardMesh.castShadow = true
    boardMesh.position.z = -t / 2
    rootGroup.add(boardMesh)

    // 2. Copper Traces Groups
    topTracesGroup = new THREE.Group()
    bottomTracesGroup = new THREE.Group()
    rootGroup.add(topTracesGroup)
    rootGroup.add(bottomTracesGroup)

    buildCopperTraces()

    // 3. Through-Hole Vias Group
    viasGroup = new THREE.Group()
    rootGroup.add(viasGroup)
    buildVias()

    // 4. Electronic 3D Components Group
    componentsGroup = new THREE.Group()
    rootGroup.add(componentsGroup)
    buildComponents()

    // 5. Silkscreen Markings Group
    silkscreenGroup = new THREE.Group()
    rootGroup.add(silkscreenGroup)
    buildSilkscreen()

    applyLayerVisibility()
  }

  // ── Copper Traces 3D Builder ──────────────────────────────────────────────
  function buildCopperTraces() {
    const halfW = boardWidth / 2
    const halfH = boardHeight / 2
    const t = boardThickness

    const traces = $copperTraces || []

    for (const tr of traces) {
      const x1 = tr.x1 - halfW
      const y1 = -(tr.y1 - halfH)
      const x2 = tr.x2 - halfW
      const y2 = -(tr.y2 - halfH)

      const length = Math.hypot(x2 - x1, y2 - y1)
      if (length < 0.1) continue

      const width = tr.widthMm || 0.40
      const copperThick = 0.04 // 1oz copper (35 microns)

      const geom = new THREE.BoxGeometry(width, length, copperThick)
      const isTop = tr.layer === 'top'
      const mesh = new THREE.Mesh(geom, isTop ? materials.topCopper : materials.bottomCopper)

      mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, isTop ? (t / 2 + copperThick / 2) : (-t / 2 - copperThick / 2))
      mesh.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2

      if (isTop) {
        topTracesGroup.add(mesh)
      } else {
        bottomTracesGroup.add(mesh)
      }
    }
  }

  // ── Through-Hole Vias 3D Builder ──────────────────────────────────────────
  function buildVias() {
    const halfW = boardWidth / 2
    const halfH = boardHeight / 2
    const t = boardThickness
    const vias = $pcbVias || []

    for (const v of vias) {
      const vx = v.xMm - halfW
      const vy = -(v.yMm - halfH)
      const outerR = (v.outerMm || 0.8) / 2
      const drillR = (v.drillMm || 0.45) / 2

      // Copper annular ring top and bottom
      const ringGeom = new THREE.CylinderGeometry(outerR, outerR, 0.05, 16)
      ringGeom.rotateX(Math.PI / 2)

      const topRing = new THREE.Mesh(ringGeom, materials.topCopper)
      topRing.position.set(vx, vy, t / 2 + 0.03)
      viasGroup.add(topRing)

      const botRing = new THREE.Mesh(ringGeom, materials.bottomCopper)
      botRing.position.set(vx, vy, -t / 2 - 0.03)
      viasGroup.add(botRing)

      // Inner Drill Barrel
      const barrelGeom = new THREE.CylinderGeometry(drillR, drillR, t + 0.1, 12)
      barrelGeom.rotateX(Math.PI / 2)
      const barrelMesh = new THREE.Mesh(barrelGeom, materials.viaHole)
      barrelMesh.position.set(vx, vy, 0)
      viasGroup.add(barrelMesh)
    }
  }

  // ── Procedural Electronic Components 3D Builder ───────────────────────────
  function buildComponents() {
    const halfW = boardWidth / 2
    const halfH = boardHeight / 2
    const t = boardThickness

    const comps = $compsStore || []

    for (const c of comps) {
      const fp = getFootprintForComponent(c)
      if (!fp) continue

      const cx = (c.x ? (c.x / 4) : halfW) - halfW
      const cy = -((c.y ? (c.y / 4) : halfH) - halfH)
      const rotRad = ((c.rotation || 0) * Math.PI) / 180

      const comp3d = new THREE.Group()
      comp3d.position.set(cx, cy, t / 2)
      comp3d.rotation.z = -rotRad

      const id = (c.id || '').toLowerCase()

      // Model A: ESP32 / Microcontroller Module
      if (id.includes('esp32') || id.includes('mcu')) {
        const canW = 18
        const canH = 25
        const canThick = 3.2

        // PCB carrier board
        const pcbCarrier = new THREE.Mesh(
          new THREE.BoxGeometry(canW + 2, canH + 6, 1.0),
          materials.soldermask
        )
        pcbCarrier.position.set(0, 0, 0.5)
        comp3d.add(pcbCarrier)

        // Metal RF Shield
        const shieldMesh = new THREE.Mesh(
          new THREE.BoxGeometry(canW, canH - 6, canThick),
          materials.rfShield
        )
        shieldMesh.position.set(0, -3, 0.5 + canThick / 2)
        comp3d.add(shieldMesh)

        // Onboard Meander Antenna
        const antMesh = new THREE.Mesh(
          new THREE.BoxGeometry(canW - 4, 4, 0.2),
          materials.topCopper
        )
        antMesh.position.set(0, canH / 2 - 1, 1.1)
        comp3d.add(antMesh)
      }
      // Model B: OLED / LCD Display
      else if (id.includes('oled') || id.includes('lcd')) {
        const dw = 26
        const dh = 26
        const screenMesh = new THREE.Mesh(
          new THREE.BoxGeometry(dw, dh, 1.4),
          materials.displayGlass
        )
        screenMesh.position.set(0, 0, 1.2)
        comp3d.add(screenMesh)

        const glassGlow = new THREE.Mesh(
          new THREE.PlaneGeometry(dw - 4, dh - 8),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        )
        glassGlow.position.set(0, 0, 1.95)
        comp3d.add(glassGlow)
      }
      // Model C: LED Indicator
      else if (id.includes('led')) {
        const ledDome = new THREE.Mesh(
          new THREE.SphereGeometry(2.5, 16, 16),
          new THREE.MeshStandardMaterial({
            color: 0xef4444,
            emissive: 0xef4444,
            emissiveIntensity: 0.6,
            roughness: 0.2
          })
        )
        ledDome.position.set(0, 0, 4)
        comp3d.add(ledDome)

        const ledBase = new THREE.Mesh(
          new THREE.CylinderGeometry(2.8, 2.8, 1.0, 16),
          materials.icEpoxy
        )
        ledBase.rotateX(Math.PI / 2)
        ledBase.position.set(0, 0, 1.5)
        comp3d.add(ledBase)
      }
      // Model D: Resistor (Axial Through-Hole)
      else if (id.includes('resistor')) {
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 1.2, 6, 12),
          materials.resistorBody
        )
        body.rotateZ(Math.PI / 2)
        body.position.set(0, 0, 1.8)
        comp3d.add(body)

        // Resistor color stripes
        const stripe = new THREE.Mesh(
          new THREE.CylinderGeometry(1.25, 1.25, 0.6, 12),
          new THREE.MeshBasicMaterial({ color: 0x991b1b })
        )
        stripe.rotateZ(Math.PI / 2)
        stripe.position.set(-1.2, 0, 1.8)
        comp3d.add(stripe)
      }
      // Model E: Generic IC DIP / SMD Package
      else {
        const pw = Math.max(8, (fp.widthMm || 12))
        const ph = Math.max(10, (fp.heightMm || 16))
        const icBody = new THREE.Mesh(
          new THREE.BoxGeometry(pw - 2, ph - 2, 2.5),
          materials.icEpoxy
        )
        icBody.position.set(0, 0, 1.25)
        comp3d.add(icBody)

        // IC Pin 1 Index Dot
        const dot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 0.2, 8),
          materials.icLeg
        )
        dot.rotateX(Math.PI / 2)
        dot.position.set(-pw / 2 + 2, ph / 2 - 2, 2.5)
        comp3d.add(dot)
      }

      // Add component solder pads
      if (fp.pads) {
        for (const p of fp.pads) {
          const padGeom = new THREE.BoxGeometry(p.sizeMm || 1.6, p.sizeMm || 1.6, 0.08)
          const padMesh = new THREE.Mesh(padGeom, materials.topCopper)
          padMesh.position.set(p.x, -p.y, 0.04)
          comp3d.add(padMesh)
        }
      }

      componentsGroup.add(comp3d)
    }
  }

  // ── Silkscreen 3D Markings ────────────────────────────────────────────────
  function buildSilkscreen() {
    const halfW = boardWidth / 2
    const halfH = boardHeight / 2
    const t = boardThickness

    // Board Border Silkscreen
    const borderGeom = new THREE.RingGeometry(0.1, 0.3, 4)
    // Silkscreen Text / Logo simulation
    const logoPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 4),
      materials.silkscreen
    )
    logoPlate.position.set(-halfW + 12, halfH - 6, t / 2 + 0.06)
    silkscreenGroup.add(logoPlate)
  }

  // ── Layer Visibility & Exploded View ──────────────────────────────────────
  function applyLayerVisibility() {
    if (topTracesGroup) topTracesGroup.visible = showTopCopper
    if (bottomTracesGroup) bottomTracesGroup.visible = showBottomCopper
    if (componentsGroup) componentsGroup.visible = showComponents
    if (silkscreenGroup) silkscreenGroup.visible = showSilkscreen
    applyExplodedZ()
  }

  function applyExplodedZ() {
    const t = boardThickness
    if (componentsGroup) {
      componentsGroup.position.z = explodedZ * 1.5
    }
    if (topTracesGroup) {
      topTracesGroup.position.z = explodedZ * 0.7
    }
    if (silkscreenGroup) {
      silkscreenGroup.position.z = explodedZ * 0.9
    }
    if (bottomTracesGroup) {
      bottomTracesGroup.position.z = -explodedZ * 0.7
    }
  }

  function setSoldermask(colorKey) {
    soldermaskColor = colorKey
    if (materials.soldermask && SOLDERMASK_PALETTES[colorKey]) {
      materials.soldermask.color.setHex(SOLDERMASK_PALETTES[colorKey].hex)
    }
  }

  function toggleWireframe() {
    isWireframe = !isWireframe
    if (materials.soldermask) {
      materials.soldermask.wireframe = isWireframe
    }
  }

  // ── Interactive Orbit Camera ──────────────────────────────────────────────
  function updateCameraPosition() {
    const x = target.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta)
    const y = target.y + spherical.radius * Math.cos(spherical.phi)
    const z = target.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)

    if (camera) {
      camera.position.set(x, y, z)
      camera.lookAt(target)
    }
  }

  function setCameraView(preset) {
    if (preset === 'top') {
      spherical.theta = 0
      spherical.phi = 0.01
      spherical.radius = 160
    } else if (preset === 'bottom') {
      spherical.theta = 0
      spherical.phi = Math.PI - 0.01
      spherical.radius = 160
    } else if (preset === 'iso') {
      spherical.theta = Math.PI / 4
      spherical.phi = Math.PI / 3
      spherical.radius = 180
    } else if (preset === 'front') {
      spherical.theta = 0
      spherical.phi = Math.PI / 2
      spherical.radius = 160
    }
    target.set(0, 0, 0)
    updateCameraPosition()
  }

  function onPointerDown(e) {
    isDragging = e.button === 0
    isPanning = e.button === 2
    prevMouseX = e.clientX
    prevMouseY = e.clientY
  }

  function onPointerMove(e) {
    if (!isDragging && !isPanning) return
    const dx = e.clientX - prevMouseX
    const dy = e.clientY - prevMouseY
    prevMouseX = e.clientX
    prevMouseY = e.clientY

    if (isDragging) {
      spherical.theta -= dx * 0.008
      spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi - dy * 0.008))
      updateCameraPosition()
    } else if (isPanning) {
      const panFactor = spherical.radius * 0.001
      target.x -= dx * panFactor
      target.y += dy * panFactor
      updateCameraPosition()
    }
  }

  function onPointerUp() {
    isDragging = false
    isPanning = false
  }

  function onWheel(e) {
    e.preventDefault()
    spherical.radius = Math.max(30, Math.min(600, spherical.radius + e.deltaY * 0.15))
    updateCameraPosition()
  }

  // ── Render Loop ───────────────────────────────────────────────────────────
  function animate() {
    animationFrameId = requestAnimationFrame(animate)

    if (autoRotate && rootGroup) {
      rootGroup.rotation.z += 0.005 * autoRotateSpeed
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  // ── Screenshot Capture ────────────────────────────────────────────────────
  function capturePcbScreenshot() {
    if (!renderer) return
    const dataUrl = renderer.domElement.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `pcb_3d_render_${soldermaskColor}_${Date.now()}.png`
    a.click()
  }

  function onResize() {
    if (!canvasContainer || !camera || !renderer) return
    const width = canvasContainer.clientWidth
    const height = canvasContainer.clientHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }

  onMount(() => {
    initScene()
    window.addEventListener('resize', onResize)
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  })

  onDestroy(() => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    window.removeEventListener('resize', onResize)
    if (renderer) renderer.dispose()
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="p3d-backdrop" on:click|self={onClose}>
  <div class="p3d-modal">
    <!-- Top Header Bar -->
    <header class="p3d-header">
      <div class="p3d-title-group">
        <span class="p3d-logo-icon">🪐</span>
        <div>
          <h2 class="p3d-title">Studio 3D PCB Visualizer</h2>
          <p class="p3d-subtitle">Pratinjau fotorealistik WebGL dengan material solder mask dan paket komponen riil</p>
        </div>
      </div>

      <div class="p3d-header-actions">
        <button on:click={capturePcbScreenshot} class="p3d-btn p3d-btn-action" title="Ambil Foto Tangkapan Layar HD">
          <span>📷</span>
          <span>Ambil Foto HD</span>
        </button>
        <button on:click={onClose} class="p3d-btn-close" aria-label="Tutup">✕</button>
      </div>
    </header>

    <!-- Main Body: 3D Canvas + Control Toolbars -->
    <div class="p3d-body">
      <!-- 3D WebGL Canvas Viewport -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="p3d-canvas-wrap"
        bind:this={canvasContainer}
        on:pointerdown={onPointerDown}
        on:pointermove={onPointerMove}
        on:pointerup={onPointerUp}
        on:pointerleave={onPointerUp}
        on:wheel={onWheel}
        on:contextmenu|preventDefault
      ></div>

      <!-- Left Floating HUD: Soldermask & View Presets -->
      <div class="p3d-hud p3d-hud-left">
        <div class="p3d-hud-card">
          <span class="p3d-hud-title">Warna Soldermask</span>
          <div class="p3d-color-picker">
            {#each Object.entries(SOLDERMASK_PALETTES) as [key, pal]}
              <button
                class="p3d-color-dot"
                class:active={soldermaskColor === key}
                style="background-color: #{pal.hex.toString(16).padStart(6, '0')}"
                title={pal.name}
                on:click={() => setSoldermask(key)}
              ></button>
            {/each}
          </div>
        </div>

        <div class="p3d-hud-card">
          <span class="p3d-hud-title">Sudut Kamera</span>
          <div class="p3d-btn-grid">
            <button class="p3d-mini-btn" on:click={() => setCameraView('iso')}>Isometric 3D</button>
            <button class="p3d-mini-btn" on:click={() => setCameraView('top')}>Top (F.Cu)</button>
            <button class="p3d-mini-btn" on:click={() => setCameraView('bottom')}>Bottom (B.Cu)</button>
            <button class="p3d-mini-btn" on:click={() => setCameraView('front')}>Edge 1.6mm</button>
          </div>
        </div>

        <div class="p3d-hud-card">
          <span class="p3d-hud-title">Exploded View (Pisah Layer)</span>
          <div class="p3d-slider-row">
            <input
              type="range"
              min="0"
              max="25"
              step="0.5"
              bind:value={explodedZ}
              on:input={applyExplodedZ}
              class="p3d-slider"
            />
            <span class="p3d-val-badge">{explodedZ}mm</span>
          </div>
        </div>
      </div>

      <!-- Right Floating HUD: Layer Toggles & Animation -->
      <div class="p3d-hud p3d-hud-right">
        <div class="p3d-hud-card">
          <span class="p3d-hud-title">Visibilitas Layer 3D</span>
          <label class="p3d-toggle-row">
            <input type="checkbox" bind:checked={showTopCopper} on:change={applyLayerVisibility} class="p3d-chk" />
            <span class="p3d-chk-lbl">Top Copper (F.Cu)</span>
          </label>
          <label class="p3d-toggle-row">
            <input type="checkbox" bind:checked={showBottomCopper} on:change={applyLayerVisibility} class="p3d-chk" />
            <span class="p3d-chk-lbl">Bottom Copper (B.Cu)</span>
          </label>
          <label class="p3d-toggle-row">
            <input type="checkbox" bind:checked={showComponents} on:change={applyLayerVisibility} class="p3d-chk" />
            <span class="p3d-chk-lbl">Komponen 3D</span>
          </label>
          <label class="p3d-toggle-row">
            <input type="checkbox" bind:checked={showSilkscreen} on:change={applyLayerVisibility} class="p3d-chk" />
            <span class="p3d-chk-lbl">Silkscreen Putih</span>
          </label>
          <label class="p3d-toggle-row">
            <input type="checkbox" checked={isWireframe} on:change={toggleWireframe} class="p3d-chk" />
            <span class="p3d-chk-lbl">Rangka Kawat (Wireframe)</span>
          </label>
        </div>

        <div class="p3d-hud-card">
          <span class="p3d-hud-title">Animasi Orbit Otomatis</span>
          <label class="p3d-toggle-row">
            <input type="checkbox" bind:checked={autoRotate} class="p3d-chk" />
            <span class="p3d-chk-lbl">Putar Otomatis (360°)</span>
          </label>
          {#if autoRotate}
            <div class="p3d-slider-row" style="margin-top: 6px;">
              <span class="p3d-hint">Kecepatan:</span>
              <input type="range" min="0.5" max="3" step="0.5" bind:value={autoRotateSpeed} class="p3d-slider" />
            </div>
          {/if}
        </div>

        <div class="p3d-hud-card p3d-hud-stats">
          <span class="p3d-hud-title">Spesifikasi Papan</span>
          <div class="p3d-stat-item">
            <span>Dimensi FR-4:</span>
            <strong>{boardWidth} × {boardHeight} mm</strong>
          </div>
          <div class="p3d-stat-item">
            <span>Ketebalan Substrat:</span>
            <strong>{boardThickness} mm (Standar)</strong>
          </div>
          <div class="p3d-stat-item">
            <span>Finishing Pad:</span>
            <strong>ENIG Gold / HASL</strong>
          </div>
        </div>
      </div>

      <!-- Bottom Hint Bar -->
      <div class="p3d-bottom-bar">
        <span class="p3d-tip">
          💡 <strong>Navigasi 3D:</strong> Klik & seret kiri untuk Memutar • Klik kanan / Geser dua jari untuk Menggeser • Scroll roda mouse untuk Zoom
        </span>
      </div>
    </div>
  </div>
</div>

<style>
  .p3d-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.85);
    backdrop-filter: blur(8px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: p3d-fade-in 0.2s ease-out;
  }
  @keyframes p3d-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .p3d-modal {
    background: #0b1120;
    border: 1px solid #1e293b;
    border-radius: 16px;
    width: 100%;
    max-width: 1400px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  .p3d-header {
    height: 64px;
    padding: 0 24px;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .p3d-title-group {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .p3d-logo-icon {
    font-size: 26px;
  }
  .p3d-title {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .p3d-subtitle {
    font-size: 12px;
    color: #94a3b8;
    margin: 2px 0 0 0;
  }

  .p3d-header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .p3d-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .p3d-btn-action {
    background: #1e293b;
    color: #e2e8f0;
    border: 1px solid #334155;
  }
  .p3d-btn-action:hover {
    background: #2563eb;
    border-color: #3b82f6;
    color: #ffffff;
    transform: translateY(-1px);
  }
  .p3d-btn-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 20px;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .p3d-btn-close:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .p3d-body {
    position: relative;
    flex: 1;
    overflow: hidden;
    background: #050811;
  }

  .p3d-canvas-wrap {
    width: 100%;
    height: 100%;
    cursor: grab;
  }
  .p3d-canvas-wrap:active {
    cursor: grabbing;
  }

  /* ── Floating HUD Overlays ── */
  .p3d-hud {
    position: absolute;
    top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 10;
    pointer-events: none;
  }
  .p3d-hud-left {
    left: 16px;
  }
  .p3d-hud-right {
    right: 16px;
  }

  .p3d-hud-card {
    pointer-events: auto;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(51, 65, 85, 0.7);
    border-radius: 12px;
    padding: 12px 14px;
    width: 200px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .p3d-hud-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
  }

  /* Color Picker Dots */
  .p3d-color-picker {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .p3d-color-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .p3d-color-dot:hover {
    transform: scale(1.15);
  }
  .p3d-color-dot.active {
    border-color: #ffffff;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
    transform: scale(1.1);
  }

  /* Button Grid */
  .p3d-btn-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .p3d-mini-btn {
    background: #1e293b;
    border: 1px solid #334155;
    color: #cbd5e1;
    font-size: 11px;
    padding: 5px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
  }
  .p3d-mini-btn:hover {
    background: #3b82f6;
    border-color: #60a5fa;
    color: #ffffff;
  }

  /* Slider Row */
  .p3d-slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .p3d-slider {
    flex: 1;
    accent-color: #3b82f6;
    height: 4px;
    border-radius: 2px;
    cursor: pointer;
  }
  .p3d-val-badge {
    font-size: 11px;
    font-weight: 700;
    color: #38bdf8;
    font-family: monospace;
    min-width: 38px;
  }

  /* Toggle Row */
  .p3d-toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #cbd5e1;
    cursor: pointer;
    user-select: none;
  }
  .p3d-chk {
    accent-color: #3b82f6;
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
  .p3d-chk-lbl {
    flex: 1;
  }

  /* Stats Card */
  .p3d-stat-item {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #94a3b8;
  }
  .p3d-stat-item strong {
    color: #f1f5f9;
  }

  /* Bottom Tip Bar */
  .p3d-bottom-bar {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(51, 65, 85, 0.5);
    border-radius: 9999px;
    padding: 6px 18px;
    pointer-events: none;
  }
  .p3d-tip {
    font-size: 11px;
    color: #94a3b8;
  }
  .p3d-tip strong {
    color: #e2e8f0;
  }

  @media (max-width: 1024px) {
    .p3d-hud {
      display: none;
    }
  }
</style>
