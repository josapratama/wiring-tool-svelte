/**
 * Export and File Delivery Service
 * Pure utility functions for SVG, PNG, CSV, JSON, and Project Sharing.
 */

export function downloadFile(content, filename, mime, isDataUrl = false) {
  const a = document.createElement('a')
  a.download = filename
  if (isDataUrl) {
    a.href = content
  } else {
    a.href = URL.createObjectURL(new Blob([content], { type: mime }))
  }
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  if (!isDataUrl) URL.revokeObjectURL(a.href)
}

export function exportDiagramSvg(svgElement, projectName, isLightMode) {
  if (!svgElement) return null
  const clone = svgElement.cloneNode(true)
  const bg = isLightMode ? '#ffffff' : '#0d0d1a'
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('style', `background:${bg}`)
  const serializer = new XMLSerializer()
  const content = serializer.serializeToString(clone)
  const filename = `${projectName || 'wiring_diagram'}.svg`
  downloadFile(content, filename, 'image/svg+xml')
  return filename
}

export function exportDiagramPng(svgElement, projectName, isLightMode, callback) {
  if (!svgElement) return
  const rect = svgElement.getBoundingClientRect()
  const clone = svgElement.cloneNode(true)
  const bg = isLightMode ? '#ffffff' : '#0d0d1a'
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', rect.width)
  clone.setAttribute('height', rect.height)
  clone.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
  clone.setAttribute('style', `background:${bg}`)

  const s = new XMLSerializer().serializeToString(clone)
  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = rect.width * scale
  canvas.height = rect.height * scale
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const img = new Image()
  const blob = new Blob([s], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    const filename = `${projectName || 'wiring_diagram'}.png`
    downloadFile(dataUrl, filename, null, true)
    URL.revokeObjectURL(url)
    if (callback) callback(null, filename)
  }

  img.onerror = (err) => {
    URL.revokeObjectURL(url)
    if (callback) callback(err)
  }

  img.src = url
}

export function exportNetlistCsv(nets, projectName) {
  if (!nets || !nets.length) return null
  const rows = [
    ['Net', 'Label', 'FromComp', 'FromPin', 'ToComp', 'ToPin', 'Color'],
    ...nets.map(n => [
      n.netId,
      n.label || '',
      n.from?.compLabel || '',
      n.from?.pinId || '',
      n.to?.compLabel || '',
      n.to?.pinId || '',
      n.color || ''
    ])
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const filename = `${projectName || 'wiring'}-netlist.csv`
  downloadFile(csv, filename, 'text/csv')
  return filename
}

export async function generateShareLink(projectName, components, wires, sheetConfig) {
  const payload = {
    project: projectName,
    components,
    wires,
    sheetConfig
  }
  const jsonStr = JSON.stringify(payload)
  const b64 = btoa(unescape(encodeURIComponent(jsonStr)))
  const url = new URL(window.location.href)
  url.hash = `data=${b64}`
  await navigator.clipboard.writeText(url.toString())
  return url.toString()
}

/**
 * Generates an official multi-page Engineering & Fabrication Documentation Pack (PDF).
 * Includes Cover Sheet, Schematic Drawing Sheet, PCB Layout Maps, and Bill of Materials.
 */
export function exportFabricationDocPack({
  projectName = 'CircuitCraft_Design',
  components = [],
  wires = [],
  sheetConfig = {},
  pcbBoardConfig = {},
  copperTraces = [],
  vias = []
}) {
  const printWin = window.open('', '_blank')
  if (!printWin) {
    alert('Browser memblokir pop-up. Izinkan pop-up untuk mencetak Dokumen Fabrikasi PDF.')
    return false
  }

  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  // Count component categories
  const catCounts = {}
  components.forEach(c => {
    const th = c.theme || 'other'
    catCounts[th] = (catCounts[th] || 0) + 1
  })

  // Build BOM rows
  const bomMap = new Map()
  components.forEach(c => {
    const key = c.name || c.id
    if (!bomMap.has(key)) {
      bomMap.set(key, {
        name: c.name || c.id,
        desc: c.desc || c.label || '-',
        footprint: c.footprintId || c.footprint?.name || 'Standard DIP/SMD',
        designators: [c.label || c.name],
        count: 1
      })
    } else {
      const item = bomMap.get(key)
      item.count++
      item.designators.push(c.label || c.name)
    }
  })

  const bomRows = Array.from(bomMap.values()).map((item, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td><strong>${item.name}</strong></td>
      <td><code>${item.designators.join(', ')}</code></td>
      <td>${item.footprint}</td>
      <td style="text-align:center; font-weight:bold;">${item.count}</td>
      <td>${item.desc}</td>
    </tr>
  `).join('')

  // Grab schematic SVG
  const schSvg = document.querySelector('.canvas-wrap svg')
  let schSvgHtml = ''
  if (schSvg) {
    const clone = schSvg.cloneNode(true)
    clone.removeAttribute('width')
    clone.removeAttribute('height')
    clone.setAttribute('style', 'width:100%; height:100%; max-height:480px;')
    schSvgHtml = new XMLSerializer().serializeToString(clone)
  }

  // Grab PCB SVG
  const pcbSvg = document.querySelector('.pcb-svg')
  let pcbSvgHtml = ''
  if (pcbSvg) {
    const clonePcb = pcbSvg.cloneNode(true)
    clonePcb.removeAttribute('width')
    clonePcb.removeAttribute('height')
    clonePcb.setAttribute('style', 'width:100%; height:100%; max-height:480px;')
    pcbSvgHtml = new XMLSerializer().serializeToString(clonePcb)
  }

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>${projectName} — Fabrication Pack</title>
      <style>
        @page {
          size: landscape A4;
          margin: 12mm 15mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          line-height: 1.4;
          font-size: 12px;
        }
        .page {
          page-break-after: always;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 10px 0;
        }
        .page:last-child {
          page-break-after: avoid;
        }
        .doc-header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .doc-title {
          font-size: 20px;
          font-weight: 800;
          color: #0369a1;
          letter-spacing: -0.5px;
        }
        .doc-subtitle {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
        }
        .doc-meta {
          text-align: right;
          font-size: 11px;
          color: #475569;
        }
        .cover-box {
          border: 2px solid #0f172a;
          border-radius: 8px;
          padding: 30px;
          margin: auto 0;
          background: #f8fafc;
        }
        .cover-proj {
          font-size: 32px;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 8px;
        }
        .specs-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 24px;
        }
        .spec-card {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          border-radius: 6px;
          padding: 12px;
        }
        .spec-val {
          font-size: 18px;
          font-weight: 800;
          color: #0284c7;
        }
        .spec-lbl {
          font-size: 10px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 700;
          margin-top: 2px;
        }
        .drawing-frame {
          border: 1.5px solid #0f172a;
          border-radius: 6px;
          padding: 10px;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
        }
        table.bom-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 11px;
        }
        table.bom-table th, table.bom-table td {
          border: 1px solid #cbd5e1;
          padding: 7px 10px;
          text-align: left;
        }
        table.bom-table th {
          background: #f1f5f9;
          font-weight: 700;
          color: #1e293b;
        }
        .doc-footer {
          border-top: 1px solid #cbd5e1;
          padding-top: 8px;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <!-- Page 1: Engineering Cover Sheet -->
      <div class="page">
        <div class="doc-header">
          <div>
            <div class="doc-title">CircuitCraft EDA — Engineering Specification</div>
            <div class="doc-subtitle">Fabrication & Assembly Documentation Pack</div>
          </div>
          <div class="doc-meta">
            <div>Tanggal: <strong>${dateStr}</strong></div>
            <div>Format: <strong>IPC-D-325A Standard</strong></div>
          </div>
        </div>

        <div class="cover-box">
          <div class="doc-subtitle">Nama Proyek Perancangan:</div>
          <div class="cover-proj">${projectName}</div>
          <p style="color:#475569; font-size:13px; max-width:650px;">
            Dokumen fabrikasi resmi yang mencakup skematik kelistrikan lengkap, pemetaan net sinyal, tata letak papan sirkuit tercetak (PCB 2-Layer), serta daftar komponen bill of materials (BOM).
          </p>

          <div class="specs-grid">
            <div class="spec-card">
              <div class="spec-val">${components.length}</div>
              <div class="spec-lbl">Total Komponen</div>
            </div>
            <div class="spec-card">
              <div class="spec-val">${wires.length}</div>
              <div class="spec-lbl">Total Net & Kabel</div>
            </div>
            <div class="spec-card">
              <div class="spec-val">${pcbBoardConfig.widthMm || 100} × ${pcbBoardConfig.heightMm || 80} mm</div>
              <div class="spec-lbl">Dimensi PCB FR-4</div>
            </div>
            <div class="spec-card">
              <div class="spec-val">${copperTraces.length} / ${vias.length}</div>
              <div class="spec-lbl">Jalur Tembaga / Via</div>
            </div>
          </div>
        </div>

        <div class="doc-footer">
          <span>CircuitCraft Professional EDA Engine</span>
          <span>Lembar 1 dari 4 (Cover Sheet)</span>
        </div>
      </div>

      <!-- Page 2: Schematic Vector Diagram -->
      <div class="page">
        <div class="doc-header">
          <div>
            <div class="doc-title">Lembar Skematik Sirkuit</div>
            <div class="doc-subtitle">${projectName} — Schematic View</div>
          </div>
          <div class="doc-meta">
            <div>Skema Ukuran: <strong>${sheetConfig.size || 'A4'} Lanskap</strong></div>
          </div>
        </div>

        <div class="drawing-frame">
          ${schSvgHtml || '<div style="color:#94a3b8; font-style:italic;">Diagram skematik kosong atau tidak tersedia.</div>'}
        </div>

        <div class="doc-footer">
          <span>Periksa aturan ERC sebelum pengiriman fabrikasi</span>
          <span>Lembar 2 dari 4 (Schematic Diagram)</span>
        </div>
      </div>

      <!-- Page 3: PCB Layout & Copper Traces -->
      <div class="page">
        <div class="doc-header">
          <div>
            <div class="doc-title">Tata Letak Papan PCB (Top & Bottom)</div>
            <div class="doc-subtitle">${projectName} — 2-Layer Copper Substrate</div>
          </div>
          <div class="doc-meta">
            <div>Ketebalan Substrat: <strong>1.6 mm FR-4 (1 oz Cu)</strong></div>
          </div>
        </div>

        <div class="drawing-frame" style="background: #0b0f19;">
          ${pcbSvgHtml || '<div style="color:#94a3b8; font-style:italic;">Kanvas PCB kosong. Buka mode PCB Studio untuk merender layout.</div>'}
        </div>

        <div class="doc-footer">
          <span>Merah = F.Cu (Top Layer) | Biru = B.Cu (Bottom Layer) | Emas = Pad | Hijau = Solder Mask</span>
          <span>Lembar 3 dari 4 (PCB Layout)</span>
        </div>
      </div>

      <!-- Page 4: Bill of Materials (BOM) Table -->
      <div class="page">
        <div class="doc-header">
          <div>
            <div class="doc-title">Bill of Materials (BOM) & Parts List</div>
            <div class="doc-subtitle">${projectName} — Komponen & Footprint Manufaktur</div>
          </div>
          <div class="doc-meta">
            <div>Total Item Unik: <strong>${bomMap.size} Jenis</strong></div>
          </div>
        </div>

        <table class="bom-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align:center;">#</th>
              <th>Nama Komponen</th>
              <th>Designator / Label</th>
              <th>Footprint / Package</th>
              <th style="width: 60px; text-align:center;">Qty</th>
              <th>Deskripsi / Part Spec</th>
            </tr>
          </thead>
          <tbody>
            ${bomRows}
          </tbody>
        </table>

        <div class="doc-footer">
          <span>Standar Penamaan BOM sesuai standar JLCPCB SMT Assembly</span>
          <span>Lembar 4 dari 4 (Parts List)</span>
        </div>
      </div>

      <script>
        window.addEventListener('load', () => {
          setTimeout(() => {
            window.print();
          }, 350);
        });
      </script>
    </body>
    </html>
  `

  printWin.document.open()
  printWin.document.write(html)
  printWin.document.close()
  return true
}

