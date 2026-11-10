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
