<script>
  import { createEventDispatcher } from 'svelte'
  import { pcbBoardConfig, components, copperTraces, pcbVias } from '$lib/store/diagram.js'
  import { generateDiyEtchingSvg, getFootprintForComponent } from '$lib/engine/pcb-engine.js'

  export let show = false
  export let projectName = 'PCB_Project'

  const dispatch = createEventDispatcher()

  let selectedLayer = 'bottom' // 'bottom' | 'top' | 'all'
  let polaritas = 'positive' // 'positive' (Black on White for Toner Transfer) | 'negative' (White on Black for Dry Film)
  let autoMirror = true
  let showRuler = true
  let showDrillGuide = true

  // Derive PCB components with footprint data
  $: pcbComponents = $components.map((c, i) => {
    const xMm = c.pcbX !== undefined ? c.pcbX : (c.x || 100) * 0.264583
    const yMm = c.pcbY !== undefined ? c.pcbY : (c.y || 100) * 0.264583
    const fp = getFootprintForComponent(c)
    return {
      ...c,
      xMm: Number(xMm.toFixed(2)),
      yMm: Number(yMm.toFixed(2)),
      footprint: fp
    }
  })

  // Generate Etching Mask SVG String
  $: rawSvg = generateDiyEtchingSvg(
    $pcbBoardConfig,
    pcbComponents,
    $copperTraces,
    selectedLayer,
    polaritas === 'positive', // inverted: true means black traces on white bg
    $pcbVias
  )

  // Apply Mirror & Calibration Marks if requested
  $: finalSvg = (() => {
    const w = $pcbBoardConfig.widthMm || 100
    const h = $pcbBoardConfig.heightMm || 80
    const shouldMirror = autoMirror && (selectedLayer === 'bottom')

    let svg = rawSvg
    if (shouldMirror) {
      // Wrap content in SVG horizontal flip matrix around width
      svg = svg.replace(
        '<g id="copper-traces"',
        `<g id="mirror-wrap" transform="translate(${w}, 0) scale(-1, 1)">\n  <g id="copper-traces"`
      ).replace(
        '</g>\n</svg>',
        '</g>\n  </g>\n</svg>'
      )
    }

    // Add calibration marks and metadata
    if (showRuler) {
      const rulerG = `
  <!-- Calibration Ruler Marks (10mm, 20mm, 50mm) -->
  <g id="calibration-ruler" stroke="${polaritas === 'positive' ? '#000000' : '#ffffff'}" stroke-width="0.3">
    <line x1="2" y1="${h - 2}" x2="52" y2="${h - 2}" />
    <line x1="2" y1="${h - 4}" x2="2" y2="${h - 2}" />
    <line x1="12" y1="${h - 3.5}" x2="12" y2="${h - 2}" />
    <line x1="22" y1="${h - 3.5}" x2="22" y2="${h - 2}" />
    <line x1="32" y1="${h - 3.5}" x2="32" y2="${h - 2}" />
    <line x1="42" y1="${h - 3.5}" x2="42" y2="${h - 2}" />
    <line x1="52" y1="${h - 4}" x2="52" y2="${h - 2}" />
    <text x="2" y="${h - 5}" font-size="2" fill="${polaritas === 'positive' ? '#000000' : '#ffffff'}" font-family="sans-serif">50mm CALIBRATION RULER (100% SCALE)</text>
    <text x="${w - 38}" y="${h - 5}" font-size="2" fill="${polaritas === 'positive' ? '#000000' : '#ffffff'}" font-family="sans-serif">${projectName} [${selectedLayer.toUpperCase()}${shouldMirror ? ' MIRROR' : ''}]</text>
  </g>
`
      svg = svg.replace('</svg>', `${rulerG}\n</svg>`)
    }

    return svg
  })()

  function downloadSvg() {
    const filename = `${(projectName || 'pcb').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_etching_${selectedLayer}.svg`
    const blob = new Blob([finalSvg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function printMask() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${projectName} - 1:1 PCB Etching Mask</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              font-family: sans-serif;
            }
            .print-hint {
              font-size: 10px;
              color: #666;
              margin-bottom: 8px;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-hint no-print">⚠️ PENTING: Pada dialog printer, pastikan "Scale" diset ke <strong>100% (Actual Size / Do not scale)</strong> agar ukuran PCB presisi 1:1!</div>
          <div style="display:inline-block; border: 1px dashed #999;">
            ${finalSvg}
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          <\/script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={() => show = false}>
    <div class="modal-card" on:click|stopPropagation role="dialog" aria-label="DIY PCB Etching Studio" tabindex="-1">
      <div class="modal-head">
        <div class="head-left">
          <span class="icon">🖨️</span>
          <div>
            <h2 class="title">DIY PCB Etching & Toner Transfer Mask Studio</h2>
            <p class="subtitle">Buat masker cetak 1:1 skala presisi untuk setrika toner transfer atau dry-film FeCl3</p>
          </div>
        </div>
        <button class="btn-close" on:click={() => show = false}>✕</button>
      </div>

      <!-- Controls Strip -->
      <div class="control-strip">
        <div class="group">
          <span class="lbl">Layer Tembaga:</span>
          <select bind:value={selectedLayer} class="etch-select">
            <option value="bottom">Bottom Copper (B.Cu)</option>
            <option value="top">Top Copper (F.Cu)</option>
            <option value="all">Semua Layer (Top + Bottom)</option>
          </select>
        </div>

        <div class="group">
          <span class="lbl">Tipe Masker:</span>
          <select bind:value={polaritas} class="etch-select">
            <option value="positive">Toner Transfer (Jalur Hitam / Dasar Putih)</option>
            <option value="negative">Dry Film Photoresist (Jalur Putih / Dasar Hitam)</option>
          </select>
        </div>

        <div class="group-checks">
          <label class="chk-label" title="Otomatis mirror horizontal pada Bottom Layer untuk transfer setrika">
            <input type="checkbox" bind:checked={autoMirror} />
            <span>Mirror (Setrika)</span>
          </label>
          <label class="chk-label" title="Sertakan penggaris kalibrasi 50mm untuk verifikasi cetak">
            <input type="checkbox" bind:checked={showRuler} />
            <span>Mistar 50mm</span>
          </label>
        </div>
      </div>

      <!-- Preview Viewport -->
      <div class="preview-area">
        <div class="svg-container">
          {@html finalSvg}
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="modal-foot">
        <div class="foot-info">
          <span>📐 Dimensi Board: {$pcbBoardConfig.widthMm} × {$pcbBoardConfig.heightMm} mm</span>
          <span class="scale-badge">100% Skala Presisi 1:1</span>
        </div>
        <div class="foot-actions">
          <button class="btn btn-sec" on:click={downloadSvg}>
            <span>💾</span>
            <span>Unduh Masker SVG</span>
          </button>
          <button class="btn btn-pri" on:click={printMask}>
            <span>🖨️</span>
            <span>Cetak 1:1 (Print Dialog)</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(2, 6, 23, 0.8); backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .modal-card {
    background: #090e17; border: 1px solid #1e293b; border-radius: 14px;
    width: 100%; max-width: 960px; max-height: 88vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8);
  }
  .modal-head {
    padding: 14px 20px; background: #0f172a; border-bottom: 1px solid #1e293b;
    display: flex; align-items: center; justify-content: space-between;
  }
  .head-left { display: flex; align-items: center; gap: 12px; }
  .icon { font-size: 24px; }
  .title { font-size: 15px; font-weight: 700; color: #f8fafc; margin: 0; }
  .subtitle { font-size: 11px; color: #94a3b8; margin: 2px 0 0 0; }
  .btn-close {
    background: transparent; border: none; color: #94a3b8; font-size: 18px;
    cursor: pointer; width: 32px; height: 32px; border-radius: 6px;
  }
  .btn-close:hover { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

  /* Control Strip */
  .control-strip {
    padding: 12px 20px; background: #0c1427; border-bottom: 1px solid #1e293b;
    display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  }
  .group { display: flex; align-items: center; gap: 8px; }
  .lbl { font-size: 11px; font-weight: 600; color: #94a3b8; }
  .etch-select {
    background: #0f172a; border: 1px solid #334155; border-radius: 6px;
    color: #f8fafc; font-size: 12px; padding: 5px 10px; outline: none;
  }
  .group-checks { display: flex; align-items: center; gap: 14px; }
  .chk-label {
    display: flex; align-items: center; gap: 6px; font-size: 11px; color: #cbd5e1; cursor: pointer;
  }

  /* Preview Viewport */
  .preview-area {
    flex: 1; overflow: auto; padding: 24px; background: #020617;
    display: flex; align-items: center; justify-content: center;
  }
  .svg-container {
    background: #ffffff; padding: 12px; border-radius: 6px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); border: 1px solid #334155;
    max-width: 100%; max-height: 52vh; overflow: auto;
  }
  :global(.svg-container svg) {
    display: block; max-width: 100%; height: auto;
  }

  /* Footer */
  .modal-foot {
    padding: 12px 20px; background: #0f172a; border-top: 1px solid #1e293b;
    display: flex; align-items: center; justify-content: space-between;
  }
  .foot-info { display: flex; align-items: center; gap: 12px; font-size: 11px; color: #94a3b8; }
  .scale-badge {
    background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 2px 8px; border-radius: 4px; font-weight: 700;
  }
  .foot-actions { display: flex; align-items: center; gap: 10px; }
  .btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px;
    border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;
    border: 1px solid transparent; transition: all 0.15s ease;
  }
  .btn-sec { background: #1e293b; border-color: #334155; color: #f8fafc; }
  .btn-sec:hover { background: #334155; border-color: #475569; }
  .btn-pri { background: #0284c7; color: #ffffff; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4); }
  .btn-pri:hover { background: #0369a1; }
</style>
