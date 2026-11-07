<script>
  import { generateWokwiDiagram } from '$lib/engine/wokwi.js'

  export let show = false
  export let components = []
  export let wires = []
  export let projectName = 'WiringProject'

  let copied = false

  $: wokwiObj = generateWokwiDiagram(components, wires, projectName)
  $: jsonStr = JSON.stringify(wokwiObj, null, 2)

  function copyJson() {
    navigator.clipboard.writeText(jsonStr)
    copied = true
    setTimeout(() => copied = false, 2000)
  }

  function downloadJson() {
    const filename = `${(projectName || 'diagram').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_wokwi.json`
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function openWokwi() {
    window.open('https://wokwi.com', '_blank')
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={() => show = false}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
    <div class="modal-box" on:click|stopPropagation role="dialog" aria-label="Wokwi Simulator Export" tabindex="-1">
      <div class="modal-head">
        <div class="head-left">
          <span class="icon">🚀</span>
          <span class="title">Export to Wokwi Simulator</span>
          <span class="badge">{wokwiObj.parts.length} parts · {wokwiObj.connections.length} wires</span>
        </div>
        <button class="btn-close" on:click={() => show = false}>✕</button>
      </div>

      <div class="modal-intro">
        <p>File <code>diagram.json</code> ini sesuai dengan spesifikasi simulasi online <strong>Wokwi Simulator</strong>. Anda dapat mengimpor file ini langsung atau copy JSON ke tab diagram di Wokwi untuk menguji kode ESP32 / Arduino.</p>
      </div>

      <div class="code-container">
        <pre class="code-block"><code>{jsonStr}</code></pre>
      </div>

      <div class="modal-footer">
        <div class="footer-left">
          <button class="btn-secondary" on:click={openWokwi}>🌐 Buka Wokwi.com ↗</button>
        </div>
        <div class="footer-actions">
          <button class="btn-action" on:click={downloadJson}>💾 Download diagram.json</button>
          <button class="btn-action btn-pri" on:click={copyJson}>
            {copied ? '✓ Tersalin ke Clipboard!' : '📋 Copy JSON'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px); z-index: 1000;
    display: flex; align-items: center; justify-content: center;
  }
  .modal-box {
    width: 680px; max-width: 92vw; max-height: 85vh;
    background: #13132a; border: 1.5px solid #252545; border-radius: 8px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7); display: flex; flex-direction: column;
    overflow: hidden; animation: pop-in 0.15s ease-out;
  }
  @keyframes pop-in {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }
  .modal-head {
    height: 48px; border-bottom: 1.5px solid #252545; display: flex;
    align-items: center; justify-content: space-between; padding: 0 16px;
    background: #181834; flex-shrink: 0;
  }
  .head-left { display: flex; align-items: center; gap: 8px; }
  .icon { font-size: 16px; }
  .title { font-weight: 700; font-size: 14px; color: #f1f5f9; }
  .badge {
    background: #1e1e40; color: #a78bfa; font-size: 11px;
    padding: 2px 8px; border-radius: 12px; border: 1px solid #353565;
  }
  .btn-close {
    background: none; border: none; color: #94a3b8; font-size: 16px;
    cursor: pointer; padding: 4px 8px; border-radius: 4px;
  }
  .btn-close:hover { background: #252545; color: #fff; }
  .modal-intro {
    padding: 10px 16px; background: rgba(99, 102, 241, 0.08); border-bottom: 1px solid #252545;
    font-size: 12px; color: #94a3b8; line-height: 1.5;
  }
  .modal-intro strong { color: #a5b4fc; }
  .modal-intro code {
    background: #1e1e40; padding: 2px 6px; border-radius: 3px;
    color: #4ade80; font-family: 'Consolas', monospace;
  }
  .code-container {
    flex: 1; overflow-y: auto; background: #0a0a16; padding: 14px;
    border-bottom: 1px solid #252545; max-height: 50vh;
  }
  .code-block {
    margin: 0; font-family: 'Consolas', 'Courier New', monospace;
    font-size: 12px; color: #e2e8f0; line-height: 1.5;
  }
  .modal-footer {
    height: 52px; display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px; background: #181834; flex-shrink: 0;
  }
  .btn-secondary {
    background: transparent; border: 1px solid #353565; color: #94a3b8;
    padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;
    transition: all 0.12s;
  }
  .btn-secondary:hover { background: #22224a; color: #fff; border-color: #6366f1; }
  .footer-actions { display: flex; gap: 8px; }
  .btn-action {
    background: #1e1e40; border: 1px solid #353565; color: #e2e8f0;
    padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.12s;
  }
  .btn-action:hover { background: #2a2a5a; border-color: #60a5fa; }
  .btn-pri { background: #4f9cf9; border-color: #2563eb; color: #fff; }
  .btn-pri:hover { background: #2563eb; }
</style>

