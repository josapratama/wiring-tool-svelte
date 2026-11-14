<script>
  import { createEventDispatcher } from 'svelte'

  export let show = false
  const dispatch = createEventDispatcher()

  function close() {
    show = false
    dispatch('close')
  }

  // ── Tab Navigation ────────────────────────────────────────────────────────
  let activeTab = 'led' // 'led' | 'vdiv' | 'trace'

  // ── 1. LED Resistor Calculator State ──────────────────────────────────────
  let ledVcc = 5.0
  let ledVf = 2.0
  let ledIfMa = 15.0
  let ledColorPreset = 'red' // 'red', 'green', 'blue', 'yellow', 'white', 'custom'

  const LED_PRESETS = {
    red:    { name: 'Merah (Standard Red)', vf: 1.9 },
    green:  { name: 'Hijau (Standard Green)', vf: 2.2 },
    yellow: { name: 'Kuning (Amber/Yellow)', vf: 2.1 },
    blue:   { name: 'Biru (High-Bright Blue)', vf: 3.2 },
    white:  { name: 'Putih (Bright White)', vf: 3.2 },
    custom: { name: 'Kustom V_f (Manual)', vf: 2.0 }
  }

  function handleLedColorChange(key) {
    ledColorPreset = key
    if (key !== 'custom' && LED_PRESETS[key]) {
      ledVf = LED_PRESETS[key].vf
    }
  }

  // Standard E12 resistor series
  const E12_BASE = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]
  function findNearestE12(targetOhms) {
    if (targetOhms <= 0) return 0
    const decade = Math.pow(10, Math.floor(Math.log10(targetOhms)))
    const normalized = targetOhms / decade
    let closest = E12_BASE[0]
    let minDiff = Math.abs(normalized - closest)
    for (const val of E12_BASE) {
      const diff = Math.abs(normalized - val)
      if (diff < minDiff) {
        minDiff = diff
        closest = val
      }
    }
    return Math.round(closest * decade)
  }

  $: ledCalculations = (() => {
    const vDrop = ledVcc - ledVf
    if (vDrop <= 0 || ledIfMa <= 0) {
      return { ok: false, msg: 'Tegangan V_cc harus lebih tinggi dari tegangan maju LED (V_f).' }
    }
    const currentA = ledIfMa / 1000
    const rExactOhms = vDrop / currentA
    const rE12Ohms = findNearestE12(rExactOhms)
    const powerMw = currentA * currentA * rE12Ohms * 1000
    let powerRating = '1/8 Watt (125 mW)'
    if (powerMw > 250) powerRating = '1/2 Watt (500 mW)'
    else if (powerMw > 125) powerRating = '1/4 Watt (250 mW)'

    return {
      ok: true,
      vDrop: vDrop.toFixed(2),
      rExactOhms: Math.round(rExactOhms),
      rE12Ohms,
      powerMw: Math.round(powerMw),
      powerRating
    }
  })()

  // ── 2. Voltage Divider Calculator State ───────────────────────────────────
  let vdivVin = 12.0
  let vdivR1 = 10000 // 10k
  let vdivR2 = 3300  // 3.3k

  $: vdivResult = (() => {
    const rTotal = vdivR1 + vdivR2
    if (rTotal <= 0) return { vout: 0, currentMa: 0, powerMw: 0, isEspSafe: true }
    const vout = (vdivVin * vdivR2) / rTotal
    const currentMa = (vdivVin / rTotal) * 1000
    const powerMw = (vdivVin * (currentMa / 1000)) * 1000
    const isEspSafe = vout <= 3.35

    return {
      vout: Number(vout.toFixed(3)),
      currentMa: Number(currentMa.toFixed(3)),
      powerMw: Number(powerMw.toFixed(1)),
      isEspSafe
    }
  })()

  // ── 3. PCB Trace Width (IPC-2152) Calculator State ─────────────────────────
  let traceCurrentA = 1.0
  let traceCopperOz = 1.0 // 1 oz = 35um, 2 oz = 70um
  let traceTempRise = 10.0 // deg C rise

  $: traceResult = (() => {
    const i = Math.max(0.05, traceCurrentA)
    const dT = Math.max(1, traceTempRise)
    // IPC-2152 empirical formula approximation for external microstrip
    // Area (sq mils) = (I / (k * (dT^0.44)))^(1 / 0.725)
    // k = 0.048 for external layers, 0.024 for internal
    const kExt = 0.048
    const kInt = 0.024

    const areaExtSqMils = Math.pow(i / (kExt * Math.pow(dT, 0.44)), 1 / 0.725)
    const areaIntSqMils = Math.pow(i / (kInt * Math.pow(dT, 0.44)), 1 / 0.725)

    const thicknessMils = traceCopperOz * 1.378 // 1 oz = 1.378 mils

    const widthExtMils = areaExtSqMils / thicknessMils
    const widthIntMils = areaIntSqMils / thicknessMils

    const widthExtMm = widthExtMils * 0.0254
    const widthIntMm = widthIntMils * 0.0254

    return {
      extMm: Number(Math.max(0.2, widthExtMm).toFixed(2)),
      extMil: Number(Math.max(8, widthExtMils).toFixed(1)),
      intMm: Number(Math.max(0.3, widthIntMm).toFixed(2)),
      intMil: Number(Math.max(12, widthIntMils).toFixed(1))
    }
  })()
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="calc-modal-backdrop" on:click={close}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
    <div class="calc-modal-box" on:click|stopPropagation role="dialog" aria-label="Kalkulator Teknik Elektronika" tabindex="-1">
      <div class="calc-modal-head">
        <div class="calc-modal-title">
          <span>🧮</span>
          <span>Kalkulator Teknik Elektronika & Desain PCB</span>
        </div>
        <button on:click={close} class="calc-modal-close" aria-label="Tutup">✕</button>
      </div>

      <!-- Tab Buttons -->
      <div class="calc-tabs">
        <button
          class="calc-tab-btn"
          class:tab-active={activeTab === 'led'}
          on:click={() => (activeTab = 'led')}
        >
          💡 LED Resistor
        </button>
        <button
          class="calc-tab-btn"
          class:tab-active={activeTab === 'vdiv'}
          on:click={() => (activeTab = 'vdiv')}
        >
          ⚡ Pembagi Tegangan (Voltage Divider)
        </button>
        <button
          class="calc-tab-btn"
          class:tab-active={activeTab === 'trace'}
          on:click={() => (activeTab = 'trace')}
        >
          📐 Lebar Jalur PCB (IPC-2152)
        </button>
      </div>

      <div class="calc-modal-body">
        {#if activeTab === 'led'}
          <!-- LED Resistor Calculator -->
          <div class="calc-section">
            <p class="calc-desc">
              Hitung nilai resistor pembatas arus ideal agar LED menyala terang tanpa terbakar, serta temukan nilai resistor standar <strong>E12/E24</strong> terdekat.
            </p>

            <div class="calc-grid">
              <div class="calc-field">
                <label for="led-vcc">Tegangan Sumber (V_cc)</label>
                <div class="input-unit">
                  <input id="led-vcc" type="number" step="0.1" bind:value={ledVcc} />
                  <span>Volt</span>
                </div>
                <div class="quick-pill-row">
                  <button type="button" class="quick-pill" on:click={() => (ledVcc = 3.3)}>3.3V (ESP32)</button>
                  <button type="button" class="quick-pill" on:click={() => (ledVcc = 5.0)}>5.0V (Uno/USB)</button>
                  <button type="button" class="quick-pill" on:click={() => (ledVcc = 12.0)}>12.0V (Aki)</button>
                </div>
              </div>

              <div class="calc-field">
                <label for="led-color">Warna LED & Tegangan Maju (V_f)</label>
                <select id="led-color" bind:value={ledColorPreset} on:change={(e) => handleLedColorChange(e.target.value)}>
                  {#each Object.entries(LED_PRESETS) as [k, item]}
                    <option value={k}>{item.name} ({item.vf}V)</option>
                  {/each}
                </select>
                {#if ledColorPreset === 'custom'}
                  <div class="input-unit" style="margin-top: 6px;">
                    <input type="number" step="0.1" bind:value={ledVf} />
                    <span>Volt</span>
                  </div>
                {/if}
              </div>

              <div class="calc-field">
                <label for="led-if">Target Arus LED (I_f)</label>
                <div class="input-unit">
                  <input id="led-if" type="number" step="1" bind:value={ledIfMa} />
                  <span>mA</span>
                </div>
                <div class="quick-pill-row">
                  <button type="button" class="quick-pill" on:click={() => (ledIfMa = 5)}>5 mA (Hemat)</button>
                  <button type="button" class="quick-pill" on:click={() => (ledIfMa = 15)}>15 mA (Standar)</button>
                  <button type="button" class="quick-pill" on:click={() => (ledIfMa = 20)}>20 mA (Maksimal)</button>
                </div>
              </div>
            </div>

            <!-- LED Result Card -->
            {#if ledCalculations.ok}
              <div class="calc-result-card">
                <div class="calc-res-item res-highlight">
                  <span class="res-lbl">Resistor Standar E12 Terdekat:</span>
                  <span class="res-val">{ledCalculations.rE12Ohms} Ω</span>
                </div>
                <div class="res-detail-grid">
                  <div>Kalkulasi Eksak: <strong>{ledCalculations.rExactOhms} Ω</strong></div>
                  <div>Drop Tegangan di Resistor: <strong>{ledCalculations.vDrop} V</strong></div>
                  <div>Disipasi Daya: <strong>{ledCalculations.powerMw} mW</strong></div>
                  <div>Rating Daya Minimum: <strong>{ledCalculations.powerRating}</strong></div>
                </div>
              </div>
            {:else}
              <div class="calc-error-banner">⚠️ {ledCalculations.msg}</div>
            {/if}
          </div>

        {:else if activeTab === 'vdiv'}
          <!-- Voltage Divider Calculator -->
          <div class="calc-section">
            <p class="calc-desc">
              Rancang rangkaian pembagi tegangan 2 resistor untuk sensor analog atau konversi sinyal input ke level ADC mikrokontroler (3.3V).
            </p>

            <div class="calc-grid">
              <div class="calc-field">
                <label for="vdiv-vin">Tegangan Input (V_in)</label>
                <div class="input-unit">
                  <input id="vdiv-vin" type="number" step="0.1" bind:value={vdivVin} />
                  <span>Volt</span>
                </div>
              </div>
              <div class="calc-field">
                <label for="vdiv-r1">Resistor Atas (R1)</label>
                <div class="input-unit">
                  <input id="vdiv-r1" type="number" step="100" bind:value={vdivR1} />
                  <span>Ω</span>
                </div>
              </div>
              <div class="calc-field">
                <label for="vdiv-r2">Resistor Bawah (R2)</label>
                <div class="input-unit">
                  <input id="vdiv-r2" type="number" step="100" bind:value={vdivR2} />
                  <span>Ω</span>
                </div>
              </div>
            </div>

            <!-- Voltage Divider Result Card -->
            <div class="calc-result-card">
              <div class="calc-res-item res-highlight">
                <span class="res-lbl">Tegangan Output (V_out):</span>
                <span class="res-val">{vdivResult.vout} V</span>
              </div>
              {#if !vdivResult.isEspSafe}
                <div class="calc-warn-banner">
                  ⚠️ <strong>Peringatan!</strong> Tegangan V_out ({vdivResult.vout}V) melebihi batas aman ADC 3.3V ESP32/RP2040. Perbesar nilai R1 atau perkecil R2 untuk mencegah kerusakan mikrokontroler!
                </div>
              {:else}
                <div class="calc-safe-banner">
                  ✓ <strong>Aman untuk MCU 3.3V</strong> (V_out &le; 3.3V)
                </div>
              {/if}
              <div class="res-detail-grid">
                <div>Arus Diam (Quiescent): <strong>{vdivResult.currentMa} mA</strong></div>
                <div>Konsumsi Daya Rangkaian: <strong>{vdivResult.powerMw} mW</strong></div>
                <div>Impedansi Output: <strong>{Math.round((vdivR1 * vdivR2) / (vdivR1 + vdivR2))} Ω</strong></div>
              </div>
            </div>
          </div>

        {:else if activeTab === 'trace'}
          <!-- PCB Trace Width Calculator -->
          <div class="calc-section">
            <p class="calc-desc">
              Kalkulator lebar jalur tembaga PCB berdasarkan standar <strong>IPC-2152</strong> untuk mencegah jalur terbakar atau mengalami panas berlebih.
            </p>

            <div class="calc-grid">
              <div class="calc-field">
                <label for="trace-i">Arus Maksimum (Ampere)</label>
                <div class="input-unit">
                  <input id="trace-i" type="number" step="0.1" bind:value={traceCurrentA} />
                  <span>Ampere</span>
                </div>
              </div>
              <div class="calc-field">
                <label for="trace-oz">Ketebalan Tembaga (Copper Weight)</label>
                <select id="trace-oz" bind:value={traceCopperOz}>
                  <option value={1.0}>1.0 oz (35 µm - Standar Pabrik)</option>
                  <option value={2.0}>2.0 oz (70 µm - High Current)</option>
                </select>
              </div>
              <div class="calc-field">
                <label for="trace-dt">Kenaikan Suhu Maksimal (&Delta;T)</label>
                <div class="input-unit">
                  <input id="trace-dt" type="number" step="1" bind:value={traceTempRise} />
                  <span>°C</span>
                </div>
              </div>
            </div>

            <!-- Trace Result Card -->
            <div class="calc-result-card">
              <div class="calc-res-item res-highlight">
                <span class="res-lbl">Lebar Jalur Layer Luar (Top/Bottom Cu):</span>
                <span class="res-val">{traceResult.extMm} mm <small>({traceResult.extMil} mil)</small></span>
              </div>
              <div class="calc-res-item" style="margin-top: 8px;">
                <span class="res-lbl">Lebar Jalur Layer Dalam (Internal Cu):</span>
                <span class="res-val" style="color:#f59e0b;">{traceResult.intMm} mm <small>({traceResult.intMil} mil)</small></span>
              </div>
              <div class="res-detail-grid" style="margin-top: 12px;">
                <div>Preset Rekomendasi di CircuitCraft: <strong>{traceResult.extMm <= 0.4 ? '0.40 mm' : traceResult.extMm <= 0.8 ? '0.80 mm' : '1.20 mm'}</strong></div>
                <div>Ketebalan Tembaga: <strong>{traceCopperOz * 35} µm</strong></div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="calc-modal-foot">
        <button on:click={close} class="calc-btn calc-btn-close">Tutup</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .calc-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .calc-modal-box {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    width: 100%;
    max-width: 620px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    color: #f1f5f9;
    overflow: hidden;
  }

  .calc-modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
  }

  .calc-modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    color: #38bdf8;
  }

  .calc-modal-close {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 16px;
    cursor: pointer;
  }
  .calc-modal-close:hover { color: #ffffff; }

  .calc-tabs {
    display: flex;
    background: #111827;
    border-bottom: 1px solid #1e293b;
  }

  .calc-tab-btn {
    flex: 1;
    padding: 10px 12px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .calc-tab-btn:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.03);
  }

  .calc-tab-btn.tab-active {
    color: #38bdf8;
    border-bottom-color: #38bdf8;
    background: rgba(56, 189, 248, 0.08);
  }

  .calc-modal-body {
    padding: 20px;
  }

  .calc-desc {
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .calc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }

  .calc-field label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: #cbd5e1;
    margin-bottom: 6px;
  }

  .input-unit {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-unit input, .calc-field select {
    width: 100%;
    padding: 8px 10px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #ffffff;
    font-size: 13px;
    font-family: inherit;
  }

  .input-unit span {
    position: absolute;
    right: 10px;
    font-size: 11px;
    color: #64748b;
    pointer-events: none;
  }

  .quick-pill-row {
    display: flex;
    gap: 4px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .quick-pill {
    background: #1e293b;
    border: 1px solid #334155;
    color: #94a3b8;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
  }
  .quick-pill:hover {
    color: #38bdf8;
    border-color: #0284c7;
  }

  .calc-result-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 16px;
  }

  .calc-res-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .res-highlight {
    border-bottom: 1px solid #334155;
    padding-bottom: 12px;
    margin-bottom: 12px;
  }

  .res-lbl {
    font-size: 13px;
    color: #cbd5e1;
    font-weight: 600;
  }

  .res-val {
    font-size: 20px;
    font-weight: 800;
    color: #10b981;
    font-family: monospace;
  }

  .res-val small {
    font-size: 12px;
    color: #94a3b8;
    font-weight: normal;
  }

  .res-detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 11px;
    color: #94a3b8;
  }

  .res-detail-grid strong {
    color: #f1f5f9;
  }

  .calc-warn-banner {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid #ef4444;
    color: #fca5a5;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11px;
    margin: 10px 0;
    line-height: 1.4;
  }

  .calc-safe-banner {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid #10b981;
    color: #6ee7b7;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    margin: 8px 0;
  }

  .calc-error-banner {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid #ef4444;
    color: #fca5a5;
    padding: 10px;
    border-radius: 6px;
    font-size: 12px;
  }

  .calc-modal-foot {
    padding: 12px 20px;
    background: #1e293b;
    border-top: 1px solid #334155;
    display: flex;
    justify-content: flex-end;
  }

  .calc-btn {
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }

  .calc-btn-close {
    background: #334155;
    color: #ffffff;
  }
  .calc-btn-close:hover { background: #475569; }
</style>
