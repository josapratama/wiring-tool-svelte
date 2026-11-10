<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'

  export let show = false
  const dispatch = createEventDispatcher()

  let canvasEl
  let animId = null
  let isRunning = true

  // Oscilloscope Settings
  let timebaseMs = 1.0 // ms/div (grid has 10 divisions = 10ms total)
  let ch1VoltsPerDiv = 1.0 // V/div (grid has 8 divisions = 8V total)
  let ch2VoltsPerDiv = 2.0
  let ch1OffsetV = 0.0
  let ch2OffsetV = 0.0
  let ch1WaveType = 'pwm' // 'pwm' | 'sine' | 'triangle' | 'uart'
  let ch2WaveType = 'rc_filter' // 'rc_filter' | 'sine' | 'noise'

  let ch1FreqHz = 1000
  let ch1DutyPct = 50
  let triggerLevelV = 1.65
  let triggerSlope = 'rising' // 'rising' | 'falling'

  // Measurements
  let ch1Vpp = 3.3
  let ch1Vrms = 2.33
  let ch2Vpp = 4.9
  let ch2Vrms = 3.46

  let phase = 0

  function close() {
    show = false
    dispatch('close')
  }

  function toggleRun() {
    isRunning = !isRunning
  }

  function downloadWaveformPng() {
    if (!canvasEl) return
    const link = document.createElement('a')
    link.download = `oscilloscope_capture_${Date.now()}.png`
    link.href = canvasEl.toDataURL('image/png')
    link.click()
  }

  function renderScope() {
    if (!canvasEl) return
    const ctx = canvasEl.getContext('2d')
    const w = canvasEl.width
    const h = canvasEl.height

    // Background
    ctx.fillStyle = '#060d17'
    ctx.fillRect(0, 0, w, h)

    // Draw Graticule (10 horizontal x 8 vertical divisions)
    const numDivX = 10
    const numDivY = 8
    const divW = w / numDivX
    const divH = h / numDivY

    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1

    for (let x = 0; x <= w; x += divW) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }

    for (let y = 0; y <= h; y += divH) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Center Crosshairs with tick marks
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1.2
    const midX = w / 2
    const midY = h / 2

    ctx.beginPath()
    ctx.moveTo(midX, 0)
    ctx.lineTo(midX, h)
    ctx.moveTo(0, midY)
    ctx.lineTo(w, midY)
    ctx.stroke()

    // Minor sub-ticks
    ctx.fillStyle = '#475569'
    for (let x = 0; x <= w; x += divW / 5) {
      ctx.fillRect(x - 0.5, midY - 3, 1, 6)
    }
    for (let y = 0; y <= h; y += divH / 5) {
      ctx.fillRect(midX - 3, y - 0.5, 6, 1)
    }

    // Advance phase if running
    if (isRunning) {
      const dt = 0.00005 * ch1FreqHz
      phase += dt
      if (phase > Math.PI * 2) phase -= Math.PI * 2
    }

    // Time scaling: total screen width corresponds to (numDivX * timebaseMs) in milliseconds
    const totalTimeMs = numDivX * timebaseMs
    const totalTimeSec = totalTimeMs / 1000

    // Render Channel 2 (Cyan #38bdf8)
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 2.2
    ctx.beginPath()

    for (let px = 0; px < w; px++) {
      const t = (px / w) * totalTimeSec + phase * (1 / (ch1FreqHz * 2 * Math.PI))
      let v = 0
      if (ch2WaveType === 'sine') {
        v = 2.5 * Math.sin(2 * Math.PI * ch1FreqHz * t + Math.PI / 2) + 2.5
      } else if (ch2WaveType === 'rc_filter') {
        // Simulated low-pass RC ripple of a PWM signal
        const rawPwm = (t * ch1FreqHz) % 1 < (ch1DutyPct / 100) ? 5.0 : 0.0
        v = 2.5 + 1.2 * Math.sin(2 * Math.PI * ch1FreqHz * t) + (Math.random() - 0.5) * 0.12
      } else {
        v = 2.5 + (Math.random() - 0.5) * 1.8
      }

      // Convert voltage to Y pixel (center is 0V or offset)
      const vDisplay = v + ch2OffsetV
      const py = midY - (vDisplay / ch2VoltsPerDiv) * divH

      if (px === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // Render Channel 1 (Yellow #facc15)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 2.4
    ctx.beginPath()

    for (let px = 0; px < w; px++) {
      const t = (px / w) * totalTimeSec + phase * (1 / (ch1FreqHz * 2 * Math.PI))
      let v = 0
      const cyclePos = (t * ch1FreqHz) % 1

      if (ch1WaveType === 'pwm') {
        v = cyclePos < (ch1DutyPct / 100) ? 3.3 : 0.0
      } else if (ch1WaveType === 'sine') {
        v = 1.65 * Math.sin(2 * Math.PI * ch1FreqHz * t) + 1.65
      } else if (ch1WaveType === 'triangle') {
        v = cyclePos < 0.5 ? cyclePos * 2 * 3.3 : (1 - cyclePos) * 2 * 3.3
      } else if (ch1WaveType === 'uart') {
        // Digital burst packet pattern
        const bit = Math.floor(cyclePos * 8)
        v = (bit % 2 === 0 || bit === 7) ? 3.3 : 0.0
      }

      const vDisplay = v + ch1OffsetV
      const py = midY - (vDisplay / ch1VoltsPerDiv) * divH

      if (px === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // Trigger Marker Level
    const trigY = midY - (triggerLevelV / ch1VoltsPerDiv) * divH
    if (trigY >= 0 && trigY <= h) {
      ctx.strokeStyle = '#f59e0b'
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(0, trigY)
      ctx.lineTo(w, trigY)
      ctx.stroke()
      ctx.setLineDash([])

      // Trigger arrow badge on left
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.moveTo(0, trigY - 4)
      ctx.lineTo(7, trigY)
      ctx.lineTo(0, trigY + 4)
      ctx.fill()
    }

    if (isRunning) {
      animId = requestAnimationFrame(renderScope)
    }
  }

  onMount(() => {
    if (canvasEl) {
      canvasEl.width = 720
      canvasEl.height = 400
      renderScope()
    }
  })

  onDestroy(() => {
    if (animId) cancelAnimationFrame(animId)
  })

  $: if (show && isRunning) {
    if (animId) cancelAnimationFrame(animId)
    setTimeout(() => { if (canvasEl) renderScope() }, 50)
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="scope-backdrop" on:click={close}>
    <div class="scope-modal" on:click|stopPropagation role="dialog" aria-label="Virtual Oscilloscope Lab" tabindex="-1">
      
      <!-- Header -->
      <div class="scope-head">
        <div class="scope-title">
          <span class="scope-icon">⚡</span>
          <span>OSKILOSKOP VIRTUAL 2-KANAL & SIGNAL GENERATOR</span>
        </div>
        <button on:click={close} class="scope-close">✕</button>
      </div>

      <!-- Main Body -->
      <div class="scope-body">
        
        <!-- Screen Canvas & Live Measurements -->
        <div class="scope-screen-col">
          <div class="canvas-wrap">
            <canvas bind:this={canvasEl}></canvas>
            
            <!-- Channel Badges on Screen -->
            <div class="screen-hud-top">
              <span class="hud-pill hud-ch1">CH1: {ch1VoltsPerDiv.toFixed(1)}V/div ({ch1WaveType.toUpperCase()})</span>
              <span class="hud-pill hud-ch2">CH2: {ch2VoltsPerDiv.toFixed(1)}V/div ({ch2WaveType.toUpperCase()})</span>
              <span class="hud-pill hud-tb">TB: {timebaseMs}ms/div</span>
              <span class="hud-pill hud-status" class:running={isRunning}>{isRunning ? '● RUNNING' : '❚❚ STOPPED'}</span>
            </div>

            <!-- Readout Measurements at Bottom of Screen -->
            <div class="screen-hud-bottom">
              <span>CH1 Vpp: <strong>{ch1Vpp.toFixed(2)}V</strong></span>
              <span>CH1 Vrms: <strong>{ch1Vrms.toFixed(2)}V</strong></span>
              <span>Freq: <strong>{(ch1FreqHz / 1000).toFixed(2)} kHz</strong></span>
              <span>Duty: <strong>{ch1DutyPct}%</strong></span>
              <span>CH2 Vpp: <strong>{ch2Vpp.toFixed(2)}V</strong></span>
            </div>
          </div>

          <!-- Bottom Playback Strip -->
          <div class="scope-action-strip">
            <button on:click={toggleRun} class="scope-btn" class:scope-btn-pri={!isRunning}>
              <span>{isRunning ? '⏸ Pause Sinyal' : '▶ Jalankan (Run)'}</span>
            </button>
            <button on:click={() => { phase = 0; if (!isRunning) renderScope() }} class="scope-btn">
              <span>Single Trigger</span>
            </button>
            <button on:click={downloadWaveformPng} class="scope-btn">
              <span>📷 Unduh Gambar Gelombang (.png)</span>
            </button>
          </div>
        </div>

        <!-- Right Controls Panel -->
        <div class="scope-controls-col">
          
          <!-- Channel 1 Settings -->
          <div class="ctrl-card ctrl-ch1">
            <h4 class="ctrl-title">CH1 (Kuning) — Sinyal Generator</h4>
            <div class="ctrl-row">
              <span class="ctrl-lbl">Bentuk Sinyal:</span>
              <select bind:value={ch1WaveType} class="ctrl-select">
                <option value="pwm">PWM Square Wave</option>
                <option value="sine">Analog Sine Wave</option>
                <option value="triangle">Triangle Wave (ADC)</option>
                <option value="uart">UART Serial Burst</option>
              </select>
            </div>
            <div class="ctrl-row">
              <span class="ctrl-lbl">Frekuensi: {ch1FreqHz} Hz</span>
              <input type="range" min="100" max="5000" step="100" bind:value={ch1FreqHz} class="ctrl-range" />
            </div>
            {#if ch1WaveType === 'pwm'}
              <div class="ctrl-row">
                <span class="ctrl-lbl">Duty Cycle: {ch1DutyPct}%</span>
                <input type="range" min="5" max="95" step="5" bind:value={ch1DutyPct} class="ctrl-range" />
              </div>
            {/if}
            <div class="ctrl-row">
              <span class="ctrl-lbl">Skala Tegangan (V/div):</span>
              <div class="btn-group">
                {#each [0.5, 1.0, 2.0, 5.0] as v}
                  <button class="pill-btn" class:active={ch1VoltsPerDiv === v} on:click={() => ch1VoltsPerDiv = v}>{v}V</button>
                {/each}
              </div>
            </div>
          </div>

          <!-- Channel 2 Settings -->
          <div class="ctrl-card ctrl-ch2">
            <h4 class="ctrl-title">CH2 (Cyan) — Response & Probe</h4>
            <div class="ctrl-row">
              <span class="ctrl-lbl">Sinyal Uji:</span>
              <select bind:value={ch2WaveType} class="ctrl-select">
                <option value="rc_filter">Filter RC Ripple (5V)</option>
                <option value="sine">Sine Phase-Shift 90°</option>
                <option value="noise">Power Rail Noise</option>
              </select>
            </div>
            <div class="ctrl-row">
              <span class="ctrl-lbl">Skala Tegangan (V/div):</span>
              <div class="btn-group">
                {#each [1.0, 2.0, 5.0] as v}
                  <button class="pill-btn" class:active={ch2VoltsPerDiv === v} on:click={() => ch2VoltsPerDiv = v}>{v}V</button>
                {/each}
              </div>
            </div>
          </div>

          <!-- Timebase Controls -->
          <div class="ctrl-card">
            <h4 class="ctrl-title">Timebase (Waktu per Divisi)</h4>
            <div class="btn-group">
              {#each [0.2, 0.5, 1.0, 2.0, 5.0] as tb}
                <button class="pill-btn" class:active={timebaseMs === tb} on:click={() => timebaseMs = tb}>{tb}ms</button>
              {/each}
            </div>
          </div>

        </div>

      </div>

      <!-- Footer -->
      <div class="scope-footer">
        <span class="footer-note">Laboratorium Analisis Bentuk Gelombang Sirkuit Real-time & Visualizer PWM</span>
        <button on:click={close} class="scope-btn">Tutup</button>
      </div>

    </div>
  </div>
{/if}

<style>
  .scope-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .scope-modal {
    background: #0b1120;
    border: 1px solid #1e293b;
    border-radius: 12px;
    width: 100%;
    max-width: 1100px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);
    overflow: hidden;
  }
  .scope-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    border-bottom: 1px solid #1e293b;
    background: rgba(15, 23, 42, 0.9);
  }
  .scope-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.5px;
    color: #38bdf8;
  }
  .scope-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 18px;
    cursor: pointer;
  }
  .scope-close:hover { color: #f87171; }
  .scope-body {
    display: flex;
    gap: 16px;
    padding: 16px;
  }
  .scope-screen-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .canvas-wrap {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid #1e293b;
    background: #060d17;
  }
  canvas {
    display: block;
    width: 100%;
    height: auto;
  }
  .screen-hud-top {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    gap: 8px;
    pointer-events: none;
  }
  .hud-pill {
    font-family: monospace;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .hud-ch1 { color: #facc15; border-color: rgba(250, 204, 21, 0.4); }
  .hud-ch2 { color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); }
  .hud-tb { color: #cbd5e1; }
  .hud-status { margin-left: auto; color: #f87171; }
  .hud-status.running { color: #4ade80; }
  .screen-hud-bottom {
    position: absolute;
    bottom: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: space-between;
    font-family: monospace;
    font-size: 10.5px;
    color: #94a3b8;
    background: rgba(15, 23, 42, 0.85);
    padding: 4px 8px;
    border-radius: 4px;
    pointer-events: none;
  }
  .screen-hud-bottom strong { color: #ffffff; }
  .scope-action-strip {
    display: flex;
    gap: 8px;
  }
  .scope-controls-col {
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .ctrl-card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ctrl-ch1 { border-left: 3px solid #facc15; }
  .ctrl-ch2 { border-left: 3px solid #38bdf8; }
  .ctrl-title {
    margin: 0;
    font-size: 11.5px;
    font-weight: 700;
    color: #f1f5f9;
  }
  .ctrl-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: #94a3b8;
  }
  .ctrl-select {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #f8fafc;
    padding: 5px 8px;
    font-size: 11px;
  }
  .ctrl-range {
    accent-color: #38bdf8;
  }
  .btn-group {
    display: flex;
    gap: 4px;
  }
  .pill-btn {
    flex: 1;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #94a3b8;
    padding: 4px 6px;
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.1s;
  }
  .pill-btn:hover { background: #334155; color: #fff; }
  .pill-btn.active { background: #0284c7; color: #fff; border-color: #38bdf8; }
  .scope-btn {
    padding: 7px 12px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #f1f5f9;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.1s;
  }
  .scope-btn:hover { background: #334155; }
  .scope-btn-pri { background: #0284c7; border-color: #38bdf8; color: #fff; }
  .scope-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 18px;
    border-top: 1px solid #1e293b;
    background: rgba(15, 23, 42, 0.9);
  }
  .footer-note { font-size: 11px; color: #64748b; }
</style>
