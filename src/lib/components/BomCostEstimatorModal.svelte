<script>
  import { createEventDispatcher } from 'svelte'
  import { components, wires } from '$lib/store/diagram.js'
  import { generateGerberRS274X } from '$lib/engine/pcb-engine.js'

  export let show = false
  export let projectName = 'CircuitCraft_Project'

  const dispatch = createEventDispatcher()

  // ── Fabrication Configuration State ──
  let batchQty = 10
  let pcbLayers = 2
  let pcbThickness = '1.6' // mm
  let solderMaskColor = 'green' // green, black, blue, red, white, purple
  let surfaceFinish = 'HASL' // HASL, ENIG
  let copperWeight = '1oz'
  let includeSmtAssembly = true
  let currency = 'IDR' // 'IDR' | 'USD'
  const USD_TO_IDR = 15850

  // ── Footprint & Component Catalog Mapping ──
  const FOOTPRINT_DEFAULTS = {
    resistor: { footprint: 'R0805', lcsc: 'C17414', priceUsd: 0.003, desc: 'SMD Resistor 0805 1% 1/8W' },
    capacitor: { footprint: 'C0805', lcsc: 'C15849', priceUsd: 0.005, desc: 'SMD MLCC Capacitor 0805 50V' },
    led: { footprint: 'LED0805', lcsc: 'C84256', priceUsd: 0.012, desc: 'SMD LED 0805 Indicator' },
    diode: { footprint: 'SOD-123', lcsc: 'C81598', priceUsd: 0.02, desc: 'Schottky Diode 1A 40V' },
    transistor: { footprint: 'SOT-23', lcsc: 'C2144', priceUsd: 0.025, desc: 'NPN Transistor SOT-23' },
    esp32: { footprint: 'MODULE-38P', lcsc: 'C2834375', priceUsd: 3.20, desc: 'ESP32-WROOM-32D 4MB Flash MCU' },
    esp32s3: { footprint: 'MODULE-44P', lcsc: 'C2934560', priceUsd: 3.85, desc: 'ESP32-S3-WROOM-1 N16R8 Dual Core' },
    arduino_uno: { footprint: 'DIP-28', lcsc: 'C14877', priceUsd: 2.10, desc: 'ATmega328P-PU 8-bit MCU' },
    arduino_nano: { footprint: 'MODULE-30P', lcsc: 'C45612', priceUsd: 2.30, desc: 'ATmega328P Nano Module' },
    arduino_mega: { footprint: 'QFP-100', lcsc: 'C14881', priceUsd: 6.50, desc: 'ATmega2560-16AU MCU' },
    rpi_pico: { footprint: 'MODULE-40P', lcsc: 'C20401', priceUsd: 3.90, desc: 'RP2040 Dual ARM Cortex-M0+' },
    oled: { footprint: 'HDR-1X4', lcsc: 'C53491', priceUsd: 1.80, desc: '0.96 inch I2C OLED Display 128x64' },
    lcd: { footprint: 'HDR-1X16', lcsc: 'C39481', priceUsd: 2.40, desc: '16x2 Character LCD HD44780' },
    sensor: { footprint: 'HDR-1X4', lcsc: 'C29384', priceUsd: 1.10, desc: 'Digital Sensor Module' },
    buzzer: { footprint: 'BUZZER-9MM', lcsc: 'C95831', priceUsd: 0.15, desc: 'Active 5V Buzzer' },
    relay: { footprint: 'RELAY-5V-SPDT', lcsc: 'C37592', priceUsd: 0.45, desc: 'Songle 5V Miniature Relay' },
    optocoupler: { footprint: 'DIP-4', lcsc: 'C3182', priceUsd: 0.08, desc: 'PC817 Optocoupler Isolator' },
    regulator: { footprint: 'TO-220', lcsc: 'C3472', priceUsd: 0.22, desc: 'LM7805 5V 1.5A Voltage Regulator' },
    buck_converter: { footprint: 'MODULE-LM2596', lcsc: 'C48291', priceUsd: 0.75, desc: 'LM2596 DC-DC Step Down Module' }
  }

  // ── Reactive BOM Generation ──
  $: bomList = generateBom($components)
  $: bomTotalParts = bomList.reduce((acc, row) => acc + row.qty, 0)
  $: bomUniqueItems = bomList.length

  // Calculate pricing
  $: costSummary = calculateFabCost(bomList, batchQty, pcbLayers, surfaceFinish, includeSmtAssembly)

  function detectCategory(comp) {
    const name = (comp.name || comp.type || comp.id || '').toLowerCase()
    if (name.includes('esp32-s3') || name.includes('n16r8')) return 'esp32s3'
    if (name.includes('esp32')) return 'esp32'
    if (name.includes('nano')) return 'arduino_nano'
    if (name.includes('mega')) return 'arduino_mega'
    if (name.includes('uno')) return 'arduino_uno'
    if (name.includes('pico') || name.includes('rp2040')) return 'rpi_pico'
    if (name.includes('oled') || name.includes('ssd1306')) return 'oled'
    if (name.includes('lcd')) return 'lcd'
    if (name.includes('res') || name.startsWith('r-') || name.startsWith('r_')) return 'resistor'
    if (name.includes('cap') || name.startsWith('c-') || name.startsWith('c_')) return 'capacitor'
    if (name.includes('led')) return 'led'
    if (name.includes('diode')) return 'diode'
    if (name.includes('buzz')) return 'buzzer'
    if (name.includes('relay')) return 'relay'
    if (name.includes('opto') || name.includes('pc817')) return 'optocoupler'
    if (name.includes('lm2596') || name.includes('buck') || name.includes('step-down')) return 'buck_converter'
    if (name.includes('7805') || name.includes('regulator')) return 'regulator'
    return 'sensor'
  }

  function generateBom(comps) {
    if (!comps || comps.length === 0) return []

    // Map component objects by grouping
    const groupMap = new Map()

    comps.forEach((c, idx) => {
      const cat = detectCategory(c)
      const def = FOOTPRINT_DEFAULTS[cat] || FOOTPRINT_DEFAULTS.sensor
      const val = c.value || c.label || c.name || 'Generic'
      const key = `${c.name || c.id}_${val}_${def.footprint}`

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          id: `ITEM-${groupMap.size + 1}`,
          category: cat,
          name: c.name || c.id || 'Component',
          value: val,
          footprint: def.footprint,
          lcsc: def.lcsc,
          description: def.desc,
          unitPriceUsd: def.priceUsd,
          designators: [],
          qty: 0
        })
      }

      const item = groupMap.get(key)
      const desig = c.designator || `${(c.name || 'U').substring(0, 3).toUpperCase()}${idx + 1}`
      item.designators.push(desig)
      item.qty += 1
    })

    return Array.from(groupMap.values())
  }

  function calculateFabCost(items, qty, layers, finish, smt) {
    // Standard JLCPCB base estimation
    // 5-10 pcs 2-layer PCB base is ~$2.00 to $4.00
    let pcbBaseUsd = 2.0
    if (qty > 10 && qty <= 30) pcbBaseUsd = 6.0
    else if (qty > 30 && qty <= 50) pcbBaseUsd = 12.0
    else if (qty > 50) pcbBaseUsd = 22.0

    if (layers === 4) pcbBaseUsd *= 3.5
    if (finish === 'ENIG') pcbBaseUsd += 18.0 // Gold finish setup fee

    // Component parts cost for the whole batch
    const partsPerUnitUsd = items.reduce((acc, row) => acc + (row.unitPriceUsd * row.qty), 0)
    const totalPartsCostUsd = partsPerUnitUsd * qty

    // SMT Assembly cost estimation
    let smtSetupFeeUsd = smt ? 8.0 : 0
    let smtPerBoardUsd = smt ? (items.length * 0.015 * qty) : 0
    let stencilFeeUsd = smt ? 6.0 : 0
    const totalSmtCostUsd = smtSetupFeeUsd + smtPerBoardUsd + stencilFeeUsd

    const grandTotalUsd = pcbBaseUsd + totalPartsCostUsd + totalSmtCostUsd
    const unitPriceUsd = qty > 0 ? (grandTotalUsd / qty) : 0

    return {
      pcbBaseUsd,
      partsPerUnitUsd,
      totalPartsCostUsd,
      smtSetupFeeUsd,
      smtPerBoardUsd,
      stencilFeeUsd,
      totalSmtCostUsd,
      grandTotalUsd,
      unitPriceUsd,
      grandTotalIdr: Math.round(grandTotalUsd * USD_TO_IDR),
      unitPriceIdr: Math.round(unitPriceUsd * USD_TO_IDR)
    }
  }

  function formatPrice(usdVal, idrVal) {
    if (currency === 'IDR') {
      return `Rp ${(idrVal || Math.round(usdVal * USD_TO_IDR)).toLocaleString('id-ID')}`
    }
    return `$ ${(usdVal).toFixed(2)}`
  }

  // ── Exporters ──
  function exportJlcpcbBom() {
    const header = 'Comment,Designator,Footprint,LCSC Part #,Description\r\n'
    const rows = bomList.map(item => {
      const comment = `"${(item.value || item.name).replace(/"/g, '""')}"`
      const desigs = `"${item.designators.join(',')}"`
      const fp = `"${item.footprint}"`
      const lcsc = `"${item.lcsc}"`
      const desc = `"${item.description}"`
      return `${comment},${desigs},${fp},${lcsc},${desc}`
    }).join('\r\n')

    const csvContent = header + rows
    downloadFile(csvContent, `${projectName}_JLCPCB_BOM.csv`, 'text/csv;charset=utf-8')
  }

  function exportCplPickAndPlace() {
    // Generate CPL centroid table
    const header = 'Designator,Val,Package,Mid X,Mid Y,Rotation,Layer\r\n'
    let xOffset = 25.0
    let yOffset = 20.0
    const rows = []

    bomList.forEach((item, itemIdx) => {
      item.designators.forEach((desig, desigIdx) => {
        const posX = (xOffset + (itemIdx * 12) + (desigIdx * 8)).toFixed(2) + 'mm'
        const posY = (yOffset + (itemIdx * 8)).toFixed(2) + 'mm'
        const rot = '0.0'
        const layer = 'Top'
        rows.push(`"${desig}","${item.value}","${item.footprint}","${posX}","${posY}","${rot}","${layer}"`)
      })
    })

    const csvContent = header + rows.join('\r\n')
    downloadFile(csvContent, `${projectName}_JLCPCB_CPL.csv`, 'text/csv;charset=utf-8')
  }

  function exportMarkdownReport() {
    let md = `# Bill of Materials & Cost Estimation Report: ${projectName}\n\n`
    md += `*Generated by CircuitCraft EDA Suite on ${new Date().toLocaleDateString('id-ID')}*\n\n`
    md += `### 1. Ringkasan Desain & Fabrikasi\n`
    md += `- **Jumlah Papan (Batch Qty)**: ${batchQty} pcs\n`
    md += `- **Layer PCB**: ${pcbLayers}-Layer FR-4 (${pcbThickness} mm)\n`
    md += `- **Solder Mask**: ${solderMaskColor.toUpperCase()}\n`
    md += `- **Surface Finish**: ${surfaceFinish}\n`
    md += `- **SMT Assembly**: ${includeSmtAssembly ? 'Aktif (Komponen Dirakit Mesin)' : 'Hanya PCB Polos'}\n`
    md += `- **Total Biaya Batch**: ${formatPrice(costSummary.grandTotalUsd, costSummary.grandTotalIdr)}\n`
    md += `- **Biaya Satuan per Papan**: ${formatPrice(costSummary.unitPriceUsd, costSummary.unitPriceIdr)}\n\n`

    md += `### 2. Daftar Komponen (BOM Table)\n\n`
    md += `| Item | Komponen / Value | Qty | Designators | Footprint | LCSC Part # | Harga Satuan |\n`
    md += `| :--- | :--- | :---: | :--- | :--- | :--- | :---: |\n`

    bomList.forEach((row, i) => {
      md += `| ${i + 1} | ${row.name} (${row.value}) | ${row.qty} | ${row.designators.join(', ')} | ${row.footprint} | ${row.lcsc} | $${row.unitPriceUsd.toFixed(3)} |\n`
    })

    md += `\n---\n*Semua part kompatibel dengan standar JLCPCB SMT Parts Library & LCSC Electronics.*`

    downloadFile(md, `${projectName}_BOM_Report.md`, 'text/markdown;charset=utf-8')
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function close() {
    show = false
    dispatch('close')
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="bom-backdrop" on:click={close}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
    <div class="bom-modal" on:click|stopPropagation role="dialog" aria-label="Maker BOM & Cost Estimator Studio" tabindex="-1">
      <!-- Modal Header -->
      <div class="bom-head">
        <div class="bom-title-wrap">
          <span class="bom-badge-icon">📋</span>
          <div>
            <h2 class="bom-title">Maker BOM Studio & Fabrication Cost Estimator</h2>
            <p class="bom-subtitle">Kalkulator Kebutuhan Suku Cadang, Footprint CAD & Estimasi Fabrikasi JLCPCB</p>
          </div>
        </div>

        <div class="bom-head-actions">
          <!-- Currency Toggle -->
          <div class="cur-toggle">
            <button class="cur-btn" class:cur-active={currency==='IDR'} on:click={() => currency = 'IDR'}>IDR (Rp)</button>
            <button class="cur-btn" class:cur-active={currency==='USD'} on:click={() => currency = 'USD'}>USD ($)</button>
          </div>
          <button class="bom-close-btn" on:click={close} title="Tutup Studio BOM">✕</button>
        </div>
      </div>

      <!-- Quick Metrics Bar -->
      <div class="bom-metrics-bar">
        <div class="metric-card">
          <span class="m-lbl">TOTAL KOMPONEN</span>
          <span class="m-val">{bomTotalParts} <small class="m-unit">pcs</small></span>
        </div>
        <div class="metric-card">
          <span class="m-lbl">JENIS KOMPONEN UNIK</span>
          <span class="m-val">{bomUniqueItems} <small class="m-unit">item</small></span>
        </div>
        <div class="metric-card metric-hl">
          <span class="m-lbl">ESTIMASI TOTAL BATCH ({batchQty} PCS)</span>
          <span class="m-val">{formatPrice(costSummary.grandTotalUsd, costSummary.grandTotalIdr)}</span>
        </div>
        <div class="metric-card">
          <span class="m-lbl">BIAYA PER SATUAN PAPAN</span>
          <span class="m-val m-accent">{formatPrice(costSummary.unitPriceUsd, costSummary.unitPriceIdr)}</span>
        </div>
      </div>

      <!-- Modal Main Grid -->
      <div class="bom-body">
        <!-- LEFT: Fab Options Config -->
        <aside class="bom-config-col">
          <h3 class="col-sec-title">⚙️ Konfigurasi Fabrikasi</h3>

          <div class="cfg-group">
            <label class="cfg-label" for="bom-batch-qty">Jumlah Papan Jadi (Batch Qty):</label>
            <div class="qty-pill-row">
              {#each [5, 10, 30, 50, 100] as q}
                <button class="qty-pill" class:qty-active={batchQty === q} on:click={() => batchQty = q}>
                  {q} pcs
                </button>
              {/each}
            </div>
          </div>

          <div class="cfg-group">
            <label class="cfg-label" for="bom-layers">Lapisan Tembaga (Layers):</label>
            <div class="qty-pill-row">
              <button class="qty-pill" class:qty-active={pcbLayers === 2} on:click={() => pcbLayers = 2}>2-Layer</button>
              <button class="qty-pill" class:qty-active={pcbLayers === 4} on:click={() => pcbLayers = 4}>4-Layer (Multilayer)</button>
            </div>
          </div>

          <div class="cfg-group">
            <label class="cfg-label" for="bom-solder-mask">Warna Solder Mask:</label>
            <div class="color-picker-row">
              <button class="mask-color-btn color-green" class:mask-active={solderMaskColor==='green'} on:click={() => solderMaskColor='green'} title="Hijau Standar"></button>
              <button class="mask-color-btn color-black" class:mask-active={solderMaskColor==='black'} on:click={() => solderMaskColor='black'} title="Matte Black"></button>
              <button class="mask-color-btn color-blue" class:mask-active={solderMaskColor==='blue'} on:click={() => solderMaskColor='blue'} title="Biru Royal"></button>
              <button class="mask-color-btn color-red" class:mask-active={solderMaskColor==='red'} on:click={() => solderMaskColor='red'} title="Merah Ruby"></button>
              <button class="mask-color-btn color-purple" class:mask-active={solderMaskColor==='purple'} on:click={() => solderMaskColor='purple'} title="Ungu OSHPark"></button>
            </div>
          </div>

          <div class="cfg-group">
            <label class="cfg-label" for="bom-finish">Pelapisan Pad (Surface Finish):</label>
            <select bind:value={surfaceFinish} class="cfg-select" id="bom-finish">
              <option value="HASL">HASL with Lead (Ekonomis)</option>
              <option value="HASL_LF">Lead-Free HASL (Ramah Lingkungan)</option>
              <option value="ENIG">ENIG Gold Emas (High-Reliability)</option>
            </select>
          </div>

          <div class="cfg-group">
            <label class="cfg-chk-row">
              <input type="checkbox" bind:checked={includeSmtAssembly} class="cfg-chk" />
              <span>Sertakan SMT Assembly Mesin JLCPCB</span>
            </label>
            <p class="cfg-hint">Mesin pick & place akan menyolder komponen SMD otomatis ke papan sirkuit Anda.</p>
          </div>

          <div class="cost-breakdown-box">
            <h4 class="cb-title">Rincian Estimasi Biaya</h4>
            <div class="cb-row">
              <span>Manufaktur Papan PCB:</span>
              <span>{formatPrice(costSummary.pcbBaseUsd)}</span>
            </div>
            <div class="cb-row">
              <span>Komponen ({batchQty} set):</span>
              <span>{formatPrice(costSummary.totalPartsCostUsd)}</span>
            </div>
            {#if includeSmtAssembly}
              <div class="cb-row">
                <span>Setup Mesin SMT:</span>
                <span>{formatPrice(costSummary.smtSetupFeeUsd)}</span>
              </div>
              <div class="cb-row">
                <span>Biaya Stencil & Solder:</span>
                <span>{formatPrice(costSummary.stencilFeeUsd)}</span>
              </div>
            {/if}
            <div class="cb-divider"></div>
            <div class="cb-row cb-grand">
              <span>Total Estimasi:</span>
              <span class="cb-val-hl">{formatPrice(costSummary.grandTotalUsd, costSummary.grandTotalIdr)}</span>
            </div>
          </div>
        </aside>

        <!-- RIGHT: Interactive BOM Table -->
        <main class="bom-table-col">
          <div class="table-top-bar">
            <span class="tbl-count-tag">Menampilkan {bomList.length} Entri Part</span>
            <div class="tbl-quick-actions">
              <button class="tbl-btn" on:click={exportJlcpcbBom} title="Download JLCPCB BOM CSV">
                <span>📥 Unduh BOM (CSV)</span>
              </button>
              <button class="tbl-btn" on:click={exportCplPickAndPlace} title="Download CPL Centroid Koordinat">
                <span>📍 Unduh CPL (Pick & Place)</span>
              </button>
              <button class="tbl-btn" on:click={exportMarkdownReport} title="Download Laporan Markdown">
                <span>📄 Laporan Markdown</span>
              </button>
            </div>
          </div>

          <div class="table-wrap">
            <table class="bom-table">
              <thead>
                <tr>
                  <th style="width: 45px;">#</th>
                  <th>Komponen & Nilai</th>
                  <th style="width: 60px;">Qty</th>
                  <th>Designator</th>
                  <th>Footprint CAD</th>
                  <th>LCSC Part #</th>
                  <th style="text-align: right;">Est. Satuan</th>
                </tr>
              </thead>
              <tbody>
                {#if bomList.length === 0}
                  <tr>
                    <td colspan="7" class="empty-cell">
                      <div class="empty-state">
                        <span class="empty-icon">💡</span>
                        <p>Belum ada komponen di dalam diagram skematik.</p>
                        <small>Tambahkan komponen dari panel EELib di sebelah kiri untuk menghasilkan daftar BOM.</small>
                      </div>
                    </td>
                  </tr>
                {:else}
                  {#each bomList as row, idx}
                    <tr class="bom-row">
                      <td class="cell-idx">{idx + 1}</td>
                      <td class="cell-comp">
                        <div class="comp-title">{row.name}</div>
                        <div class="comp-val">{row.value}</div>
                      </td>
                      <td class="cell-qty"><span class="qty-badge">{row.qty}</span></td>
                      <td class="cell-desig">
                        <div class="desig-tags">
                          {#each row.designators as d}
                            <span class="d-tag">{d}</span>
                          {/each}
                        </div>
                      </td>
                      <td class="cell-fp">
                        <input type="text" bind:value={row.footprint} class="tbl-input fp-input" title="Ubah footprint" />
                      </td>
                      <td class="cell-lcsc">
                        <input type="text" bind:value={row.lcsc} class="tbl-input lcsc-input" title="Ubah nomor part LCSC" />
                      </td>
                      <td class="cell-price" style="text-align: right;">
                        {formatPrice(row.unitPriceUsd)}
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <!-- Modal Footer -->
      <div class="bom-footer">
        <div class="footer-note">
          <span class="note-bullet">✓</span>
          <span>Semua komponen dipetakan otomatis sesuai standar manufaktur industri JLCPCB & LCSC Electronics.</span>
        </div>
        <div class="footer-btn-group">
          <button class="f-btn f-btn-sec" on:click={close}>Tutup</button>
          <button class="f-btn f-btn-pri" on:click={exportJlcpcbBom}>
            📦 Ekspor Paket Fabrikasi JLCPCB
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .bom-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(3, 7, 18, 0.85);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: fadeIn .18s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .bom-modal {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 12px;
    width: 1140px;
    max-width: 96vw;
    height: 680px;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  /* ── Header ── */
  .bom-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: #0b0f19;
    border-bottom: 1px solid #1e293b;
  }
  .bom-title-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .bom-badge-icon {
    font-size: 24px;
    line-height: 1;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.3);
    padding: 8px;
    border-radius: 8px;
  }
  .bom-title {
    font-size: 15px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 2px 0;
    letter-spacing: -0.2px;
  }
  .bom-subtitle {
    font-size: 11px;
    color: #94a3b8;
    margin: 0;
  }
  .bom-head-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .cur-toggle {
    display: inline-flex;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 2px;
  }
  .cur-btn {
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all .12s;
  }
  .cur-btn.cur-active {
    background: #0284c7;
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);
  }
  .bom-close-btn {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: all .12s;
  }
  .bom-close-btn:hover {
    color: #ffffff;
    background: #1e293b;
  }

  /* ── Metrics Bar ── */
  .bom-metrics-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    padding: 10px 20px;
    background: #0a0e1a;
    border-bottom: 1px solid #1e293b;
  }
  .metric-card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 8px 14px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .metric-hl {
    background: rgba(14, 165, 233, 0.08);
    border-color: rgba(56, 189, 248, 0.3);
  }
  .m-lbl {
    font-size: 9.5px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.8px;
    margin-bottom: 2px;
  }
  .m-val {
    font-size: 16px;
    font-weight: 800;
    color: #f1f5f9;
  }
  .m-unit {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 500;
  }
  .m-accent {
    color: #38bdf8;
  }

  /* ── Body Grid ── */
  .bom-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* Left Config Column */
  .bom-config-col {
    width: 320px;
    background: #0b0f19;
    border-right: 1px solid #1e293b;
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex-shrink: 0;
  }
  .col-sec-title {
    font-size: 12px;
    font-weight: 800;
    color: #38bdf8;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .cfg-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cfg-label {
    font-size: 11px;
    font-weight: 600;
    color: #cbd5e1;
  }
  .qty-pill-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .qty-pill {
    flex: 1;
    min-width: 50px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 6px 8px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all .12s;
    text-align: center;
  }
  .qty-pill:hover {
    background: #273549;
    color: #ffffff;
  }
  .qty-pill.qty-active {
    background: #0284c7;
    border-color: #38bdf8;
    color: #ffffff;
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);
  }

  .color-picker-row {
    display: flex;
    gap: 8px;
  }
  .mask-color-btn {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all .15s;
  }
  .mask-color-btn:hover {
    transform: scale(1.15);
  }
  .mask-color-btn.mask-active {
    border-color: #ffffff;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
  }
  .color-green { background: #15803d; }
  .color-black { background: #1e293b; }
  .color-blue { background: #1d4ed8; }
  .color-red { background: #b91c1c; }
  .color-purple { background: #7e22ce; }

  .cfg-select {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #f1f5f9;
    padding: 7px 10px;
    font-size: 11.5px;
    outline: none;
    cursor: pointer;
  }
  .cfg-select:focus {
    border-color: #38bdf8;
  }

  .cfg-chk-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    font-weight: 600;
    color: #e2e8f0;
    cursor: pointer;
  }
  .cfg-chk {
    accent-color: #0284c7;
    cursor: pointer;
  }
  .cfg-hint {
    font-size: 10px;
    color: #64748b;
    margin: 2px 0 0 20px;
    line-height: 1.4;
  }

  .cost-breakdown-box {
    margin-top: auto;
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 12px;
  }
  .cb-title {
    font-size: 10.5px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin: 0 0 8px 0;
  }
  .cb-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #cbd5e1;
    margin-bottom: 5px;
  }
  .cb-divider {
    height: 1px;
    background: #1e293b;
    margin: 8px 0;
  }
  .cb-grand {
    font-weight: 700;
    font-size: 12.5px;
    color: #ffffff;
    margin-bottom: 0;
  }
  .cb-val-hl {
    color: #38bdf8;
  }

  /* Right Table Column */
  .bom-table-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #0f172a;
  }
  .table-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid #1e293b;
    background: #0b0f19;
  }
  .tbl-count-tag {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
  }
  .tbl-quick-actions {
    display: flex;
    gap: 8px;
  }
  .tbl-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 5px;
    border: 1px solid #334155;
    background: #1e293b;
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all .12s;
  }
  .tbl-btn:hover {
    background: #273549;
    border-color: #38bdf8;
    color: #ffffff;
  }

  .table-wrap {
    flex: 1;
    overflow: auto;
  }
  .bom-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
    text-align: left;
  }
  .bom-table th {
    position: sticky;
    top: 0;
    background: #101626;
    color: #94a3b8;
    font-weight: 700;
    padding: 10px 12px;
    border-bottom: 1px solid #1e293b;
    z-index: 10;
  }
  .bom-table td {
    padding: 8px 12px;
    border-bottom: 1px solid #1e293b;
    color: #cbd5e1;
    vertical-align: middle;
  }
  .bom-row:hover {
    background: rgba(30, 41, 59, 0.4);
  }
  .cell-idx {
    color: #64748b;
    font-weight: 700;
  }
  .comp-title {
    font-weight: 700;
    color: #f1f5f9;
  }
  .comp-val {
    font-size: 10.5px;
    color: #38bdf8;
  }
  .qty-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    background: #1e293b;
    color: #f8fafc;
    font-weight: 700;
    font-size: 11px;
  }
  .desig-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-width: 180px;
  }
  .d-tag {
    font-family: monospace;
    font-size: 10px;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid #334155;
    padding: 1px 5px;
    border-radius: 3px;
    color: #cbd5e1;
  }
  .tbl-input {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #f1f5f9;
    padding: 4px 6px;
    font-size: 11px;
    font-family: monospace;
    width: 90px;
  }
  .tbl-input:focus {
    border-color: #38bdf8;
    outline: none;
  }
  .lcsc-input {
    width: 85px;
    color: #4ade80;
  }
  .cell-price {
    font-weight: 700;
    color: #f8fafc;
  }

  .empty-cell {
    padding: 40px 20px;
    text-align: center;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #64748b;
  }
  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
  .empty-state p {
    color: #cbd5e1;
    font-weight: 600;
    margin: 0 0 4px 0;
  }
  .empty-state small {
    color: #64748b;
  }

  /* ── Footer ── */
  .bom-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: #0b0f19;
    border-top: 1px solid #1e293b;
  }
  .footer-note {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #94a3b8;
  }
  .note-bullet {
    color: #4ade80;
    font-weight: 800;
  }
  .footer-btn-group {
    display: flex;
    gap: 10px;
  }
  .f-btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all .15s;
  }
  .f-btn-sec {
    background: #1e293b;
    border: 1px solid #334155;
    color: #cbd5e1;
  }
  .f-btn-sec:hover {
    background: #273549;
    color: #ffffff;
  }
  .f-btn-pri {
    background: #0284c7;
    border: 1px solid #0369a1;
    color: #ffffff;
    box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4);
  }
  .f-btn-pri:hover {
    background: #0369a1;
    box-shadow: 0 4px 16px rgba(2, 132, 199, 0.6);
  }

  @media (max-width: 900px) {
    .bom-body {
      flex-direction: column;
    }
    .bom-config-col {
      width: 100%;
      height: 220px;
      border-right: none;
      border-bottom: 1px solid #1e293b;
    }
    .bom-metrics-bar {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
