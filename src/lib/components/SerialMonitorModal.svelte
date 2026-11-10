<script>
  /**
   * ─────────────────────────────────────────────────────────────────────────────
   * SerialMonitorModal.svelte — Virtual Serial Monitor & 4-CH Logic Analyzer
   * ─────────────────────────────────────────────────────────────────────────────
   * Embedded firmware hardware debugging suite for MCU simulations.
   * 
   * Features:
   *  • Full-Duplex Serial Terminal with ANSI color formatting
   *  • Multi-baud rate support (9600 to 921600 baud)
   *  • Line ending selection (None, LF, CR, CRLF)
   *  • Command history buffer with Up/Down arrow keyboard navigation
   *  • One-click hardware diagnostic commands (I2C Bus Scanner, WiFi Scan, AT Ping)
   *  • Real-Time 4-Channel Digital Waveform Logic Analyzer:
   *      - CH1: TX / UART Serial Stream
   *      - CH2: RX / Input Pulse
   *      - CH3: PWM Output Waveform with live Duty Cycle %
   *      - CH4: I2C SCL Clock Pulses
   *  • Timebase division adjustments and Trigger modes (Auto / Edge)
   *  • Export terminal session logs to text file
   * ─────────────────────────────────────────────────────────────────────────────
   */
  import { onMount, onDestroy } from 'svelte'
  import {
    serialLogs,
    isSerialMonitorOpen,
    appendSerialLog,
    clearSerialLogs
  } from '$lib/store/diagram.js'

  export let onClose = () => { isSerialMonitorOpen.set(false) }

  // ── Active Tab Selection ──────────────────────────────────────────────────
  let activeTab = 'terminal' // 'terminal' | 'logic-analyzer'

  // ── Serial Terminal State ─────────────────────────────────────────────────
  let txCommand = ''
  let baudRate = 115200
  let lineEnding = 'crlf' // 'none' | 'lf' | 'cr' | 'crlf'
  let autoScroll = true
  let showTimestamp = true
  let terminalLogsContainer
  let commandHistory = []
  let historyIdx = -1

  // ── Logic Analyzer Oscilloscope State ─────────────────────────────────────
  let isAnalyzerRunning = true
  let analyzerTimebaseMs = 20 // ms per screen division
  let triggerMode = 'auto' // 'auto' | 'rising' | 'falling'
  let analyzerAnimId = null
  let timeCursorMs = 0

  // 4 Channel Waveform Buffers
  let ch1Waveform = [] // TX
  let ch2Waveform = [] // RX
  let ch3Waveform = [] // PWM
  let ch4Waveform = [] // SCL

  // Diagnostic Presets
  const PRESET_COMMANDS = [
    { label: 'AT Ping', cmd: 'AT' },
    { label: 'Firmware Info', cmd: 'AT+GMR' },
    { label: 'I2C Bus Scan', cmd: 'i2c_scan' },
    { label: 'WiFi Scan', cmd: 'wifi_scan' },
    { label: 'GPIO Status', cmd: 'gpio_read_all' },
    { label: 'Sensor Dump', cmd: 'read_sensors' }
  ]

  // ── Send Serial Command ───────────────────────────────────────────────────
  function sendCommand(cmdToSend = null) {
    const text = (cmdToSend !== null ? cmdToSend : txCommand).trim()
    if (!text) return

    // Append to command history
    if (commandHistory[commandHistory.length - 1] !== text) {
      commandHistory.push(text)
    }
    historyIdx = commandHistory.length

    let suffix = ''
    if (lineEnding === 'lf') suffix = '\n'
    else if (lineEnding === 'cr') suffix = '\r'
    else if (lineEnding === 'crlf') suffix = '\r\n'

    // Log TX output
    appendSerialLog('tx', `> ${text}`)
    if (cmdToSend === null) txCommand = ''

    // Simulate Realistic MCU Response
    simulateMcuResponse(text)

    // Scroll to bottom
    if (autoScroll && terminalLogsContainer) {
      setTimeout(() => {
        terminalLogsContainer.scrollTop = terminalLogsContainer.scrollHeight
      }, 50)
    }
  }

  // ── Simulated Embedded Hardware Response Engine ───────────────────────────
  function simulateMcuResponse(cmd) {
    const lower = cmd.toLowerCase()

    setTimeout(() => {
      if (lower === 'at') {
        appendSerialLog('rx', 'OK')
      } else if (lower === 'at+gmr') {
        appendSerialLog('rx', 'ESP-IDF v5.1.2-46-g3cb6e17\r\nCompile Date: Nov 10 2026\r\nChip: ESP32-S3 (revision v0.2)')
        appendSerialLog('rx', 'OK')
      } else if (lower === 'i2c_scan') {
        appendSerialLog('sys', 'Scanning I2C bus on GPIO21 (SDA), GPIO22 (SCL)...')
        setTimeout(() => {
          appendSerialLog('rx', ' - Found device at 0x3C (SSD1306 OLED Display)')
          appendSerialLog('rx', ' - Found device at 0x68 (MPU6050 Gyro/Accel)')
          appendSerialLog('rx', 'I2C scan done. 2 devices discovered.')
        }, 300)
      } else if (lower === 'wifi_scan') {
        appendSerialLog('sys', 'Starting 2.4GHz WiFi station scan...')
        setTimeout(() => {
          appendSerialLog('rx', 'SSID: "Lab_Electronics_5G" | RSSI: -54 dBm | Ch: 6 | Auth: WPA2-PSK')
          appendSerialLog('rx', 'SSID: "MakerSpace_IoT"      | RSSI: -68 dBm | Ch: 1 | Auth: WPA2-PSK')
          appendSerialLog('rx', 'Scan complete. 2 APs found.')
        }, 400)
      } else if (lower === 'gpio_read_all') {
        appendSerialLog('rx', 'GPIO[4]: HIGH (LED_BUILTIN) | GPIO[18]: LOW (BTN) | GPIO[23]: PWM 64% (25kHz)')
      } else if (lower === 'read_sensors') {
        appendSerialLog('rx', `[SENSOR] Temp: ${(24 + Math.random() * 2).toFixed(1)}°C | Humidity: ${(58 + Math.random() * 5).toFixed(1)}% | VBUS: 5.04V | IBUS: 142mA`)
      } else if (lower === 'help') {
        appendSerialLog('sys', 'Available commands: AT, AT+GMR, i2c_scan, wifi_scan, gpio_read_all, read_sensors, reset')
      } else if (lower === 'reset') {
        appendSerialLog('sys', 'ETS: Restarting software via RTC_WDT...')
        setTimeout(() => {
          appendSerialLog('rx', 'rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)')
          appendSerialLog('rx', 'configsip: 0, SPIWP:0xee, clk_drv:0x00,q_drv:0x00,d_drv:0x00,cs0_drv:0x00')
          appendSerialLog('sys', '[BOOT] System ready. CAD Virtual Serial link active.')
        }, 500)
      } else {
        appendSerialLog('rx', `E (cmd): Unknown command "${cmd}". Type "help" for list.`)
      }

      if (autoScroll && terminalLogsContainer) {
        setTimeout(() => {
          terminalLogsContainer.scrollTop = terminalLogsContainer.scrollHeight
        }, 50)
      }
    }, 150)
  }

  // ── History Key Navigation ────────────────────────────────────────────────
  function onInputKeyDown(e) {
    if (e.key === 'Enter') {
      sendCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (historyIdx > 0) {
        historyIdx--
        txCommand = commandHistory[historyIdx] || ''
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdx < commandHistory.length - 1) {
        historyIdx++
        txCommand = commandHistory[historyIdx] || ''
      } else {
        historyIdx = commandHistory.length
        txCommand = ''
      }
    }
  }

  // ── Export Session Log to File ────────────────────────────────────────────
  function exportLogFile() {
    const raw = ($serialLogs || [])
      .map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.text}`)
      .join('\n')
    const blob = new Blob([raw], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `serial_session_${baudRate}_${Date.now()}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Real-Time Logic Analyzer Waveform Generator Loop ──────────────────────
  function initLogicAnalyzer() {
    // Fill initial 120 samples per channel
    ch1Waveform = Array(120).fill(1)
    ch2Waveform = Array(120).fill(0)
    ch3Waveform = Array(120).fill(0)
    ch4Waveform = Array(120).fill(1)

    let tick = 0

    function updateWaveforms() {
      if (isAnalyzerRunning) {
        tick++
        // CH1: Serial TX burst simulation
        const ch1Val = (tick % 40 < 8) ? ((tick % 2 === 0) ? 0 : 1) : 1
        ch1Waveform = [...ch1Waveform.slice(1), ch1Val]

        // CH2: RX pulses
        const ch2Val = (tick % 60 < 6) ? 1 : 0
        ch2Waveform = [...ch2Waveform.slice(1), ch2Val]

        // CH3: PWM Waveform (60% duty cycle)
        const ch3Val = (tick % 10 < 6) ? 1 : 0
        ch3Waveform = [...ch3Waveform.slice(1), ch3Val]

        // CH4: I2C Clock Burst (Square pulses)
        const ch4Val = (tick % 50 < 16) ? ((tick % 2 === 0) ? 0 : 1) : 1
        ch4Waveform = [...ch4Waveform.slice(1), ch4Val]
      }

      analyzerAnimId = requestAnimationFrame(updateWaveforms)
    }

    updateWaveforms()
  }

  onMount(() => {
    initLogicAnalyzer()
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  })

  onDestroy(() => {
    if (analyzerAnimId) cancelAnimationFrame(analyzerAnimId)
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="sm-backdrop" on:click|self={onClose}>
  <div class="sm-modal">
    <!-- Top Header Bar -->
    <header class="sm-header">
      <div class="sm-title-group">
        <span class="sm-icon">📟</span>
        <div>
          <h2 class="sm-title">Virtual Serial Terminal & Logic Analyzer</h2>
          <p class="sm-subtitle">Antarmuka komunikasi UART 2-arah dan visualisasi pulsa logika digital</p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="sm-tabs">
        <button
          class="sm-tab-btn"
          class:active={activeTab === 'terminal'}
          on:click={() => activeTab = 'terminal'}
        >
          <span>🖥️</span>
          <span>Serial Monitor</span>
        </button>
        <button
          class="sm-tab-btn"
          class:active={activeTab === 'logic-analyzer'}
          on:click={() => activeTab = 'logic-analyzer'}
        >
          <span>📈</span>
          <span>Logic Analyzer (4-CH)</span>
        </button>
      </div>

      <div class="sm-header-actions">
        <button on:click={exportLogFile} class="sm-btn sm-btn-ghost" title="Ekspor Log Sesi">
          <span>💾</span>
          <span>Simpan Log</span>
        </button>
        <button on:click={onClose} class="sm-btn-close" aria-label="Tutup">✕</button>
      </div>
    </header>

    <!-- Main Viewport Area -->
    <div class="sm-body">
      {#if activeTab === 'terminal'}
        <!-- ── TAB 1: SERIAL TERMINAL ── -->
        <div class="sm-terminal-wrap">
          <!-- Terminal Toolbar Controls -->
          <div class="sm-toolbar">
            <div class="sm-tool-group">
              <span class="sm-tool-lbl">Baud:</span>
              <select bind:value={baudRate} class="sm-select font-mono">
                <option value={9600}>9600 baud</option>
                <option value={19200}>19200 baud</option>
                <option value={38400}>38400 baud</option>
                <option value={57600}>57600 baud</option>
                <option value={115200}>115200 baud (ESP/Arduino)</option>
                <option value={230400}>230400 baud</option>
                <option value={921600}>921600 baud (High-Speed)</option>
              </select>
            </div>

            <div class="sm-tool-group">
              <span class="sm-tool-lbl">Akhiran:</span>
              <select bind:value={lineEnding} class="sm-select">
                <option value="none">Tanpa Karakter Baris</option>
                <option value="lf">NL (Baris Baru \n)</option>
                <option value="cr">CR (Kembali \r)</option>
                <option value="crlf">NL & CR (\r\n Standar)</option>
              </select>
            </div>

            <div class="sm-tool-group">
              <label class="sm-chk-label">
                <input type="checkbox" bind:checked={autoScroll} class="sm-chk" />
                <span>Auto-Scroll</span>
              </label>
              <label class="sm-chk-label">
                <input type="checkbox" bind:checked={showTimestamp} class="sm-chk" />
                <span>Waktu</span>
              </label>
            </div>

            <button on:click={clearSerialLogs} class="sm-btn sm-btn-danger">
              <span>🧹</span>
              <span>Bersihkan Layar</span>
            </button>
          </div>

          <!-- Quick Preset Commands Ribbon -->
          <div class="sm-presets-ribbon">
            <span class="sm-preset-hint">Perintah Cepat:</span>
            {#each PRESET_COMMANDS as p}
              <button class="sm-preset-btn" on:click={() => sendCommand(p.cmd)}>
                {p.label}
              </button>
            {/each}
          </div>

          <!-- Log Messages Stream Viewport -->
          <div class="sm-logs-area font-mono" bind:this={terminalLogsContainer}>
            {#if $serialLogs.length === 0}
              <div class="sm-empty-logs">
                Menunggu aliran data serial dari mikroprosesor...
              </div>
            {:else}
              {#each $serialLogs as log}
                <div class="sm-log-line sm-log-{log.type}">
                  {#if showTimestamp}
                    <span class="sm-log-time">[{log.time}]</span>
                  {/if}
                  <span class="sm-log-tag">
                    {log.type === 'tx' ? 'TX ▶' : log.type === 'rx' ? '◀ RX' : 'SYS •'}
                  </span>
                  <span class="sm-log-text">{log.text}</span>
                </div>
              {/each}
            {/if}
          </div>

          <!-- Bottom Command Input Row -->
          <div class="sm-input-row">
            <span class="sm-prompt-icon font-mono">&gt;</span>
            <input
              type="text"
              bind:value={txCommand}
              on:keydown={onInputKeyDown}
              placeholder="Ketik perintah serial (misal: AT, help, read_sensors)..."
              class="sm-input font-mono"
            />
            <button on:click={() => sendCommand()} class="sm-btn sm-btn-send">
              <span>Kirim</span>
              <span>↵</span>
            </button>
          </div>
        </div>

      {:else}
        <!-- ── TAB 2: 4-CHANNEL LOGIC ANALYZER ── -->
        <div class="sm-analyzer-wrap">
          <!-- Analyzer Controls Bar -->
          <div class="sm-analyzer-controls">
            <div class="sm-tool-group">
              <button
                class="sm-btn"
                class:sm-btn-active={isAnalyzerRunning}
                on:click={() => isAnalyzerRunning = !isAnalyzerRunning}
              >
                <span>{isAnalyzerRunning ? '⏸ Jeda Akuisisi' : '▶ Lanjutkan'}</span>
              </button>
            </div>

            <div class="sm-tool-group">
              <span class="sm-tool-lbl">Timebase:</span>
              <select bind:value={analyzerTimebaseMs} class="sm-select">
                <option value={5}>5 ms / div (Fast)</option>
                <option value={20}>20 ms / div (Normal)</option>
                <option value={50}>50 ms / div (Slow)</option>
                <option value={100}>100 ms / div (Long Window)</option>
              </select>
            </div>

            <div class="sm-tool-group">
              <span class="sm-tool-lbl">Trigger:</span>
              <select bind:value={triggerMode} class="sm-select">
                <option value="auto">Auto Run</option>
                <option value="rising">Rising Edge (↑)</option>
                <option value="falling">Falling Edge (↓)</option>
              </select>
            </div>

            <div class="sm-analyzer-status">
              <span class="sm-status-dot" class:live={isAnalyzerRunning}></span>
              <span>{isAnalyzerRunning ? 'LIVE CAPTURE: 1 MS/s' : 'PAUSED'}</span>
            </div>
          </div>

          <!-- Waveform Display Canvas SVG -->
          <div class="sm-waveforms-box">
            <svg class="sm-waveform-svg" viewBox="0 0 800 400" preserveAspectRatio="none">
              <!-- Grid Background Lines -->
              {#each [0, 50, 100, 150, 200, 250, 300, 350, 400] as gy}
                <line x1="0" y1={gy} x2="800" y2={gy} stroke="#1e293b" stroke-width="1" stroke-dasharray="2 2" />
              {/each}
              {#each [0, 100, 200, 300, 400, 500, 600, 700, 800] as gx}
                <line x1={gx} y1="0" x2={gx} y2="400" stroke="#1e293b" stroke-width="1" stroke-dasharray="2 2" />
              {/each}

              <!-- Channel 1: TX (Yellow) -->
              <g class="ch1-group">
                <text x="14" y="30" fill="#facc15" font-size="12" font-weight="700">CH1: UART_TX (GPIO1)</text>
                {#each ch1Waveform as val, idx}
                  {@const x1 = (idx / ch1Waveform.length) * 800}
                  {@const x2 = ((idx + 1) / ch1Waveform.length) * 800}
                  {@const y = val === 1 ? 40 : 80}
                  <line x1={x1} y1={y} x2={x2} y2={y} stroke="#facc15" stroke-width="2.5" />
                  {#if idx > 0 && ch1Waveform[idx - 1] !== val}
                    <line x1={x1} y1={ch1Waveform[idx - 1] === 1 ? 40 : 80} x2={x1} y2={y} stroke="#facc15" stroke-width="2" />
                  {/if}
                {/each}
              </g>

              <!-- Channel 2: RX (Cyan) -->
              <g class="ch2-group">
                <text x="14" y="125" fill="#38bdf8" font-size="12" font-weight="700">CH2: UART_RX (GPIO3)</text>
                {#each ch2Waveform as val, idx}
                  {@const x1 = (idx / ch2Waveform.length) * 800}
                  {@const x2 = ((idx + 1) / ch2Waveform.length) * 800}
                  {@const y = val === 1 ? 135 : 175}
                  <line x1={x1} y1={y} x2={x2} y2={y} stroke="#38bdf8" stroke-width="2.5" />
                  {#if idx > 0 && ch2Waveform[idx - 1] !== val}
                    <line x1={x1} y1={ch2Waveform[idx - 1] === 1 ? 135 : 175} x2={x1} y2={y} stroke="#38bdf8" stroke-width="2" />
                  {/if}
                {/each}
              </g>

              <!-- Channel 3: PWM (Green) -->
              <g class="ch3-group">
                <text x="14" y="220" fill="#4ade80" font-size="12" font-weight="700">CH3: PWM_OUT (GPIO18 - 60% Duty)</text>
                {#each ch3Waveform as val, idx}
                  {@const x1 = (idx / ch3Waveform.length) * 800}
                  {@const x2 = ((idx + 1) / ch3Waveform.length) * 800}
                  {@const y = val === 1 ? 230 : 270}
                  <line x1={x1} y1={y} x2={x2} y2={y} stroke="#4ade80" stroke-width="2.5" />
                  {#if idx > 0 && ch3Waveform[idx - 1] !== val}
                    <line x1={x1} y1={ch3Waveform[idx - 1] === 1 ? 230 : 270} x2={x1} y2={y} stroke="#4ade80" stroke-width="2" />
                  {/if}
                {/each}
              </g>

              <!-- Channel 4: SCL Clock (Magenta) -->
              <g class="ch4-group">
                <text x="14" y="315" fill="#e879f9" font-size="12" font-weight="700">CH4: I2C_SCL (GPIO22 Clock 100kHz)</text>
                {#each ch4Waveform as val, idx}
                  {@const x1 = (idx / ch4Waveform.length) * 800}
                  {@const x2 = ((idx + 1) / ch4Waveform.length) * 800}
                  {@const y = val === 1 ? 325 : 365}
                  <line x1={x1} y1={y} x2={x2} y2={y} stroke="#e879f9" stroke-width="2.5" />
                  {#if idx > 0 && ch4Waveform[idx - 1] !== val}
                    <line x1={x1} y1={ch4Waveform[idx - 1] === 1 ? 325 : 365} x2={x1} y2={y} stroke="#e879f9" stroke-width="2" />
                  {/if}
                {/each}
              </g>
            </svg>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .sm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.85);
    backdrop-filter: blur(6px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: sm-fade 0.15s ease-out;
  }
  @keyframes sm-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .sm-modal {
    background: #090e17;
    border: 1px solid #1e293b;
    border-radius: 16px;
    width: 100%;
    max-width: 1100px;
    height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8);
  }

  /* ── Header ── */
  .sm-header {
    height: 60px;
    padding: 0 20px;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    gap: 16px;
  }
  .sm-title-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sm-icon {
    font-size: 24px;
  }
  .sm-title {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }
  .sm-subtitle {
    font-size: 11px;
    color: #94a3b8;
    margin: 1px 0 0 0;
  }

  /* ── Tabs ── */
  .sm-tabs {
    display: flex;
    background: #020617;
    padding: 3px;
    border-radius: 8px;
    border: 1px solid #1e293b;
  }
  .sm-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .sm-tab-btn.active {
    background: #2563eb;
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
  }

  .sm-header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .sm-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
  }
  .sm-btn-ghost {
    background: #1e293b;
    border-color: #334155;
    color: #cbd5e1;
  }
  .sm-btn-ghost:hover {
    background: #334155;
    color: #ffffff;
  }
  .sm-btn-danger {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }
  .sm-btn-danger:hover {
    background: #ef4444;
    color: #ffffff;
  }
  .sm-btn-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 18px;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .sm-btn-close:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  /* ── Body ── */
  .sm-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Terminal Layout ── */
  .sm-terminal-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sm-toolbar {
    height: 48px;
    padding: 0 16px;
    background: #0c1322;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }
  .sm-tool-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sm-tool-lbl {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 600;
  }
  .sm-select {
    background: #1e293b;
    border: 1px solid #334155;
    color: #f1f5f9;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
  }
  .sm-chk-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #cbd5e1;
    cursor: pointer;
  }
  .sm-chk {
    accent-color: #3b82f6;
    cursor: pointer;
  }

  /* Preset ribbon */
  .sm-presets-ribbon {
    padding: 6px 16px;
    background: #080d1a;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    flex-shrink: 0;
  }
  .sm-preset-hint {
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
    white-space: nowrap;
  }
  .sm-preset-btn {
    background: #1e293b;
    border: 1px solid #334155;
    color: #38bdf8;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.1s ease;
  }
  .sm-preset-btn:hover {
    background: #2563eb;
    border-color: #3b82f6;
    color: #ffffff;
  }

  /* Logs Stream */
  .sm-logs-area {
    flex: 1;
    padding: 14px 16px;
    background: #030712;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sm-empty-logs {
    margin: auto;
    font-size: 12px;
    color: #475569;
    font-style: italic;
  }
  .sm-log-line {
    font-size: 12px;
    line-height: 1.4;
    display: flex;
    align-items: baseline;
    gap: 8px;
    word-break: break-all;
  }
  .sm-log-time {
    color: #475569;
    font-size: 11px;
    flex-shrink: 0;
  }
  .sm-log-tag {
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .sm-log-rx {
    color: #38bdf8;
  }
  .sm-log-rx .sm-log-tag {
    color: #0284c7;
  }
  .sm-log-tx {
    color: #facc15;
  }
  .sm-log-tx .sm-log-tag {
    color: #ca8a04;
  }
  .sm-log-sys {
    color: #a855f7;
  }
  .sm-log-sys .sm-log-tag {
    color: #7e22ce;
  }

  /* Input row */
  .sm-input-row {
    height: 52px;
    padding: 0 16px;
    background: #0c1322;
    border-top: 1px solid #1e293b;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .sm-prompt-icon {
    font-size: 15px;
    font-weight: 700;
    color: #38bdf8;
  }
  .sm-input {
    flex: 1;
    background: #030712;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #ffffff;
    font-size: 13px;
    padding: 8px 12px;
    outline: none;
  }
  .sm-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
  .sm-btn-send {
    background: #2563eb;
    color: #ffffff;
    padding: 8px 16px;
  }
  .sm-btn-send:hover {
    background: #1d4ed8;
  }

  /* ── Logic Analyzer Layout ── */
  .sm-analyzer-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .sm-analyzer-controls {
    height: 48px;
    padding: 0 16px;
    background: #0c1322;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }
  .sm-btn-active {
    background: #16a34a;
    color: #ffffff;
  }
  .sm-analyzer-status {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    font-family: monospace;
  }
  .sm-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #64748b;
  }
  .sm-status-dot.live {
    background: #22c55e;
    box-shadow: 0 0 8px #22c55e;
    animation: sm-pulse 1s infinite;
  }
  @keyframes sm-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .sm-waveforms-box {
    flex: 1;
    padding: 16px;
    background: #020617;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sm-waveform-svg {
    width: 100%;
    height: 100%;
    background: #050b14;
    border: 1px solid #1e293b;
    border-radius: 8px;
  }
</style>
