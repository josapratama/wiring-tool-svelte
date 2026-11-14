<script>
  import { createEventDispatcher } from 'svelte'
  import { MCU_PINS } from '$lib/data/mcu-pins.js'

  export let show = false
  const dispatch = createEventDispatcher()

  let selectedMcuId = 'esp32s3-devkit'
  let filterType = 'all' // 'all' | 'power' | 'analog' | 'i2c' | 'spi' | 'uart' | 'special'
  let searchQ = ''

  const MCU_OPTIONS = [
    { id: 'esp32s3-devkit', name: 'ESP32-S3 DevKitC-1 N16R8', desc: 'Xtensa Dual-Core 240MHz + USB OTG / JTAG' },
    { id: 'esp32-devkit',   name: 'ESP32 DevKit V1 (38-pin)', desc: 'Wi-Fi & Bluetooth Dual-Core 240MHz' },
    { id: 'arduino-uno',    name: 'Arduino Uno R3',           desc: 'ATmega328P 16MHz 5V Architecture' },
    { id: 'arduino-nano',   name: 'Arduino Nano V3',          desc: 'ATmega328P Compact DIP-30 Package' },
    { id: 'arduino-mega',   name: 'Arduino Mega 2560',        desc: 'ATmega2560 54 Digital I/O + 16 Analog' },
    { id: 'rpi-pico',       name: 'Raspberry Pi Pico (RP2040)',desc: 'Dual ARM Cortex-M0+ 133MHz + 8 PIO' }
  ]

  const BOARD_NOTES = {
    'esp32s3-devkit': 'Pin IO19 dan IO20 terhubung ke Native USB D-/D+. Pin IO0 adalah strapping pin tombol BOOT.',
    'esp32-devkit': 'Pin ADC2 (IO0, 2, 4, 12, 13, 14, 15, 25, 26, 27) tidak dapat dibaca saat Wi-Fi menyala. Gunakan pin ADC1 (IO32-39). Pin IO0, 2, 12 adalah strapping pins.',
    'arduino-uno': 'Pin D0 (RX) dan D1 (TX) terhubung ke chip USB-Serial. Jangan gunakan untuk input sakelar saat upload kode.',
    'arduino-nano': 'Pin A6 dan A7 murni analog (tidak bisa digunakan sebagai digital I/O).',
    'arduino-mega': 'Memiliki 4 port hardware UART (Serial 0, 1, 2, 3) dan 16 pin analog input.',
    'rpi-pico': 'Level tegangan GPIO murni 3.3V! Tidak toleran 5V (5V-tolerant). Pin ADC adalah GP26, GP27, GP28.'
  }

  function close() {
    show = false
    dispatch('close')
  }

  $: currentPins = MCU_PINS[selectedMcuId] || { left: [], right: [] }

  function matchPin(p) {
    if (filterType !== 'all') {
      if (filterType === 'power' && p.type !== 'power' && p.type !== 'gnd') return false
      if (filterType === 'analog' && p.type !== 'analog') return false
      if (filterType === 'i2c' && p.type !== 'i2c') return false
      if (filterType === 'spi' && p.type !== 'spi') return false
      if (filterType === 'uart' && p.type !== 'uart') return false
      if (filterType === 'special' && p.type !== 'special') return false
    }
    if (searchQ) {
      const q = searchQ.toLowerCase()
      const text = `${p.label} ${p.num} ${p.id} ${p.type}`.toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  }

  function getPinBadgeClass(type) {
    switch (type) {
      case 'power': return 'badge-power'
      case 'gnd': return 'badge-gnd'
      case 'analog': return 'badge-analog'
      case 'i2c': return 'badge-i2c'
      case 'spi': return 'badge-spi'
      case 'uart': return 'badge-uart'
      case 'special': return 'badge-special'
      default: return 'badge-digital'
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="pinout-backdrop" on:click={close}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
    <div class="pinout-box" on:click|stopPropagation role="dialog" aria-label="Pinout Cheat Sheet" tabindex="-1">
      <div class="pinout-head">
        <div class="pinout-title">
          <span>📌</span>
          <span>Panduan Pinout & GPIO Cheat Sheet Mikrokontroler</span>
        </div>
        <button on:click={close} class="pinout-close" aria-label="Tutup">✕</button>
      </div>

      <div class="pinout-body">
        <!-- Top Toolbar: MCU Selector & Search -->
        <div class="pinout-controls">
          <div class="ctrl-group">
            <label for="mcu-select">Target Board:</label>
            <select id="mcu-select" bind:value={selectedMcuId}>
              {#each MCU_OPTIONS as opt}
                <option value={opt.id}>{opt.name}</option>
              {/each}
            </select>
          </div>

          <div class="ctrl-group" style="flex: 1;">
            <label for="pin-search">Cari Pin (contoh: ADC, SDA, TX, IO2):</label>
            <input id="pin-search" type="text" placeholder="Ketik nomor pin / fungsi..." bind:value={searchQ} />
          </div>
        </div>

        <!-- Filter Pills Row -->
        <div class="filter-pill-row">
          <button class="filter-pill" class:pill-active={filterType === 'all'} on:click={() => (filterType = 'all')}>Semua Pin</button>
          <button class="filter-pill" class:pill-active={filterType === 'power'} on:click={() => (filterType = 'power')}>⚡ Catu Daya (5V/3V3/GND)</button>
          <button class="filter-pill" class:pill-active={filterType === 'analog'} on:click={() => (filterType = 'analog')}>🎛️ ADC Analog</button>
          <button class="filter-pill" class:pill-active={filterType === 'i2c'} on:click={() => (filterType = 'i2c')}>📶 I2C Bus</button>
          <button class="filter-pill" class:pill-active={filterType === 'spi'} on:click={() => (filterType = 'spi')}>⚡ SPI Bus</button>
          <button class="filter-pill" class:pill-active={filterType === 'uart'} on:click={() => (filterType = 'uart')}>📡 UART Serial</button>
          <button class="filter-pill" class:pill-active={filterType === 'special'} on:click={() => (filterType = 'special')}>⚠️ Strapping / Boot</button>
        </div>

        <!-- Technical Advisory Note -->
        {#if BOARD_NOTES[selectedMcuId]}
          <div class="mcu-note-banner">
            <span class="note-icon">💡</span>
            <span class="note-text">{BOARD_NOTES[selectedMcuId]}</span>
          </div>
        {/if}

        <!-- Dual-Row Pinout Visual Board -->
        <div class="board-visual-wrap">
          <!-- Left Pins Column -->
          <div class="pins-col pins-left">
            {#each currentPins.left as p}
              {@const isMatch = matchPin(p)}
              <div class="pin-card" class:pin-dimmed={!isMatch} class:pin-highlight={isMatch && filterType !== 'all'}>
                <span class="pin-num">{p.num}</span>
                <span class="pin-label">{p.label}</span>
                <span class="pin-badge {getPinBadgeClass(p.type)}">{p.type}</span>
              </div>
            {/each}
          </div>

          <!-- Board Center Backbone Chip Illustration -->
          <div class="board-center-backbone">
            <div class="chip-rf-shield">
              <div class="chip-logo">MCU</div>
              <div class="chip-title">
                {MCU_OPTIONS.find(m => m.id === selectedMcuId)?.name || 'IC Module'}
              </div>
              <div class="chip-antenna"></div>
            </div>
          </div>

          <!-- Right Pins Column -->
          <div class="pins-col pins-right">
            {#each currentPins.right as p}
              {@const isMatch = matchPin(p)}
              <div class="pin-card" class:pin-dimmed={!isMatch} class:pin-highlight={isMatch && filterType !== 'all'}>
                <span class="pin-badge {getPinBadgeClass(p.type)}">{p.type}</span>
                <span class="pin-label">{p.label}</span>
                <span class="pin-num">{p.num}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="pinout-foot">
        <span class="foot-tip">Klik filter atau ketik di pencarian untuk menyorot fungsi pin yang dicari</span>
        <button on:click={close} class="btn-foot-close">Tutup</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .pinout-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(5px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .pinout-box {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    width: 100%;
    max-width: 860px;
    max-height: 90vh;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    color: #f1f5f9;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .pinout-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
  }

  .pinout-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    color: #38bdf8;
  }

  .pinout-close {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 16px;
    cursor: pointer;
  }
  .pinout-close:hover { color: #ffffff; }

  .pinout-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .pinout-controls {
    display: flex;
    gap: 14px;
    margin-bottom: 12px;
  }

  .ctrl-group label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 4px;
  }

  .ctrl-group select, .ctrl-group input {
    width: 100%;
    padding: 7px 10px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #f1f5f9;
    font-size: 12px;
  }

  .filter-pill-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .filter-pill {
    background: #1e293b;
    border: 1px solid #334155;
    color: #94a3b8;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .filter-pill:hover { color: #f1f5f9; border-color: #0284c7; }
  .filter-pill.pill-active {
    background: #0284c7;
    color: #ffffff;
    border-color: #38bdf8;
  }

  .mcu-note-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(2, 132, 199, 0.12);
    border: 1px solid #0284c7;
    color: #7dd3fc;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11.5px;
    margin-bottom: 14px;
    line-height: 1.4;
  }

  .board-visual-wrap {
    display: grid;
    grid-template-columns: 1fr 140px 1fr;
    gap: 8px;
    background: #0b0f19;
    border: 1.5px solid #1e293b;
    border-radius: 8px;
    padding: 12px;
  }

  .pins-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pin-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
    transition: all 0.15s ease;
  }

  .pins-left .pin-card {
    border-left: 3px solid #38bdf8;
  }

  .pins-right .pin-card {
    border-right: 3px solid #38bdf8;
  }

  .pin-dimmed {
    opacity: 0.25;
  }

  .pin-highlight {
    background: rgba(56, 189, 248, 0.18);
    border-color: #38bdf8;
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.3);
  }

  .pin-num {
    color: #64748b;
    font-size: 10px;
  }

  .pin-label {
    font-weight: 700;
    color: #f1f5f9;
  }

  .pin-badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
    font-weight: 700;
  }
  .badge-power { background: #991b1b; color: #fecaca; }
  .badge-gnd { background: #1e293b; color: #94a3b8; border: 1px solid #475569; }
  .badge-analog { background: #854d0e; color: #fef08a; }
  .badge-i2c { background: #065f46; color: #a7f3d0; }
  .badge-spi { background: #1e3a8a; color: #bfdbfe; }
  .badge-uart { background: #581c87; color: #e9d5ff; }
  .badge-special { background: #9a3412; color: #fed7aa; }
  .badge-digital { background: #334155; color: #cbd5e1; }

  .board-center-backbone {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #020617;
    border-radius: 6px;
    border: 1px dashed #334155;
    padding: 10px;
  }

  .chip-rf-shield {
    text-align: center;
  }

  .chip-logo {
    font-size: 20px;
    font-weight: 900;
    color: #64748b;
  }

  .chip-title {
    font-size: 10px;
    font-weight: 700;
    color: #38bdf8;
    margin-top: 4px;
    line-height: 1.2;
  }

  .chip-antenna {
    width: 24px;
    height: 10px;
    border-top: 2px solid #f59e0b;
    border-right: 2px solid #f59e0b;
    margin: 8px auto 0;
  }

  .pinout-foot {
    padding: 12px 20px;
    background: #1e293b;
    border-top: 1px solid #334155;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .foot-tip {
    font-size: 11px;
    color: #64748b;
  }

  .btn-foot-close {
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 12px;
    background: #334155;
    color: #ffffff;
    border: none;
    cursor: pointer;
  }
  .btn-foot-close:hover { background: #475569; }
</style>
