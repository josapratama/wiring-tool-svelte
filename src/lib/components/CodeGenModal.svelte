<script>
  import { generatePinCode } from '$lib/engine/codegen.js'

  export let show = false
  export let components = []
  export let wires = []
  export let projectName = 'WiringDiagram'

  let activeTab = 'sketch' // 'sketch' | 'cpp' | 'python'
  let copied = false

  $: codeResult = generatePinCode(components, wires, projectName)
  $: activeCode = activeTab === 'sketch'
    ? (codeResult.sketch || codeResult.cpp)
    : activeTab === 'cpp'
    ? codeResult.cpp
    : codeResult.python

  function copyCode() {
    navigator.clipboard.writeText(activeCode)
    copied = true
    setTimeout(() => copied = false, 2000)
  }

  function downloadCode() {
    const ext = activeTab === 'sketch' ? 'ino' : activeTab === 'cpp' ? 'h' : 'py'
    const mime = activeTab === 'python' ? 'text/x-python' : 'text/x-c'
    const filename = (projectName || 'sketch').toLowerCase().replace(/[^a-z0-9]+/g, '_') + `.${ext}`
    const blob = new Blob([activeCode], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function launchInSimulator() {
    try {
      const data = {
        project: projectName,
        code: codeResult.sketch || codeResult.cpp,
      }
      localStorage.setItem('simulator_launch_data', JSON.stringify(data))
    } catch {}
    window.open('./simulator/index.html', '_blank')
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={() => show = false}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions a11y-interactive-supports-focus -->
    <div class="modal-box" on:click|stopPropagation role="dialog" aria-label="Auto Pin Definitions Generator" tabindex="-1">
      <div class="modal-head">
        <div class="head-left">
          <span>💻 Auto Pin-Definition & Firmware Generator</span>
        </div>
        <button class="btn-close" on:click={() => show = false}>✕</button>
      </div>

      <div class="modal-tabs">
        <button class="tab-btn" class:active={activeTab==='sketch'} on:click={() => activeTab = 'sketch'}>
          <span>Arduino Sketch (.ino)</span>
        </button>
        <button class="tab-btn" class:active={activeTab==='cpp'} on:click={() => activeTab = 'cpp'}>
          <span>C / C++ Header (pins.h)</span>
        </button>
        <button class="tab-btn" class:active={activeTab==='python'} on:click={() => activeTab = 'python'}>
          <span>MicroPython (pins.py)</span>
        </button>
      </div>

      <div class="code-container">
        <pre class="code-block"><code>{activeCode}</code></pre>
      </div>

      <div class="modal-footer">
        <div class="footer-left">
          <button class="btn-sim-lab" on:click={launchInSimulator} title="Jalankan kode ini langsung di Virtual MCU Lab">
            ⚡ Simulasikan di Virtual MCU Lab →
          </button>
        </div>
        <div class="footer-actions">
          <button class="btn-action" on:click={downloadCode}>💾 Download File</button>
          <button class="btn-action btn-pri" on:click={copyCode}>
            {copied ? '✓ Copied to Clipboard!' : '📋 Copy Code'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .modal-box {
    background: #14142b; border: 1px solid #353565; border-radius: 10px;
    width: 720px; max-width: 95vw; height: 560px; max-height: 90vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 16px 40px rgba(0,0,0,0.85);
  }
  .modal-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid #252545;
    font: 700 14px -apple-system, sans-serif; color: #4ade80;
  }
  .btn-close {
    background: transparent; border: none; color: #8888aa;
    font-size: 16px; cursor: pointer; padding: 4px;
  }
  .btn-close:hover { color: #fff; }

  .modal-tabs {
    display: flex; background: #0f0f20; border-bottom: 1px solid #252545;
  }
  .tab-btn {
    flex: 1; padding: 10px 14px; background: transparent; border: none;
    color: #8888aa; font-size: 12px; font-weight: 600; cursor: pointer;
    border-bottom: 2px solid transparent; transition: all 0.15s;
  }
  .tab-btn:hover { color: #e8e8f5; background: #161630; }
  .tab-btn.active { color: #4ade80; border-bottom-color: #4ade80; background: #14142b; }

  .code-container {
    flex: 1; overflow: auto; background: #0a0a14; padding: 16px;
  }
  .code-block {
    margin: 0; font-family: 'Consolas', 'Courier New', monospace;
    font-size: 12px; line-height: 1.6; color: #e2e8f0; white-space: pre;
  }

  .modal-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 18px; border-top: 1px solid #252545; background: #101024;
  }
  .btn-sim-lab {
    background: #0f172a; border: 1.5px solid #00f0ff; color: #00f0ff;
    padding: 7px 14px; border-radius: 6px; font-size: 11px; font-weight: 700;
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
  }
  .btn-sim-lab:hover {
    background: #00f0ff; color: #0f172a; box-shadow: 0 0 16px rgba(0, 240, 255, 0.5);
  }
  .footer-actions { display: flex; gap: 10px; }
  .btn-action {
    background: #1e1e38; border: 1px solid #353565; border-radius: 5px;
    padding: 7px 14px; color: #c0c0e0; cursor: pointer; font-size: 12px; font-weight: 600;
    transition: all 0.15s;
  }
  .btn-action:hover { background: #252550; color: #fff; }
  .btn-pri {
    background: #15803d; border-color: #22c55e; color: #fff;
  }
  .btn-pri:hover { background: #16a34a; }
</style>

