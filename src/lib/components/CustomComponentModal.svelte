<script>
  import { createEventDispatcher } from 'svelte'
  import { saveCustomComponent } from '$lib/data/components-db.js'
  import { showAlert } from '../store/dialog.js'

  export let show = false

  const dispatch = createEventDispatcher()

  let name = ''
  let theme = 'sensor'
  let desc = ''
  let width = 140
  let height = 110

  const PIN_TYPES = ['digital', 'analog', 'power', 'gnd', 'i2c', 'spi', 'uart', 'passive']
  const SIDES = ['left', 'right', 'top', 'bottom']

  let pins = [
    { id: 'VCC', label: 'VCC', side: 'left', pos: 0.25, type: 'power' },
    { id: 'GND', label: 'GND', side: 'left', pos: 0.5,  type: 'gnd' },
    { id: 'OUT', label: 'OUT', side: 'right', pos: 0.5, type: 'digital' }
  ]

  function addPin() {
    pins = [
      ...pins,
      {
        id: `P${pins.length + 1}`,
        label: `P${pins.length + 1}`,
        side: 'right',
        pos: 0.5,
        type: 'digital'
      }
    ]
  }

  function removePin(idx) {
    pins = pins.filter((_, i) => i !== idx)
  }

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      showAlert({
        title: 'Nama Komponen Kosong',
        message: 'Silakan masukkan nama komponen kustom terlebih dahulu.',
        icon: '⚠️'
      })
      return
    }
    const id = 'custom-' + trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    // Auto-calculate pin positions per side to distribute evenly
    const bySide = { left: [], right: [], top: [], bottom: [] }
    pins.forEach((p, idx) => {
      bySide[p.side || 'right'].push(idx)
    })

    const finalPins = pins.map((p, idx) => {
      const sideList = bySide[p.side || 'right']
      const sideIdx = sideList.indexOf(idx)
      const count = sideList.length
      const autoPos = count <= 1 ? 0.5 : (sideIdx + 1) / (count + 1)
      return {
        id: (p.id || `P${idx+1}`).trim(),
        label: (p.label || p.id || `P${idx+1}`).trim(),
        side: p.side || 'right',
        pos: Math.round(autoPos * 100) / 100,
        type: p.type || 'digital'
      }
    })

    const newComp = {
      id,
      name: trimmed,
      theme,
      desc: desc.trim() || trimmed,
      width: Math.max(100, width),
      height: Math.max(70, height),
      isCustom: true,
      pins: finalPins
    }

    saveCustomComponent(newComp)
    dispatch('created', newComp)
    show = false

    // Reset form
    name = ''
    desc = ''
    pins = [
      { id: 'VCC', label: 'VCC', side: 'left', pos: 0.25, type: 'power' },
      { id: 'GND', label: 'GND', side: 'left', pos: 0.5,  type: 'gnd' },
      { id: 'OUT', label: 'OUT', side: 'right', pos: 0.5, type: 'digital' }
    ]
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={() => show = false}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
    <div class="modal-box" on:click|stopPropagation role="dialog" aria-label="Add custom component" tabindex="-1">
      <div class="modal-head">
        <span>➕ Add Custom Component</span>
        <button class="btn-close" on:click={() => show = false}>✕</button>
      </div>

      <div class="modal-body">
        <div class="form-row">
          <label class="form-group flex-2">
            <span>Component Name</span>
            <input bind:value={name} placeholder="e.g. BNO085 IMU / Custom Motor ESC"/>
          </label>
          <label class="form-group flex-1">
            <span>Category</span>
            <select bind:value={theme}>
              <option value="sensor">Sensor</option>
              <option value="mcu">Microcontroller</option>
              <option value="display">Display</option>
              <option value="comms">Communication</option>
              <option value="output">Output</option>
              <option value="power">Power</option>
              <option value="passive">Passive</option>
              <option value="switch">Switch</option>
            </select>
          </label>
        </div>

        <div class="form-row">
          <label class="form-group flex-2">
            <span>Description (Optional)</span>
            <input bind:value={desc} placeholder="Short notes / specs"/>
          </label>
          <label class="form-group flex-1">
            <span>Width (px)</span>
            <input type="number" bind:value={width} min="80" max="400"/>
          </label>
          <label class="form-group flex-1">
            <span>Height (px)</span>
            <input type="number" bind:value={height} min="60" max="600"/>
          </label>
        </div>

        <!-- Pins definition table -->
        <div class="pins-header">
          <span>Pins Configuration ({pins.length})</span>
          <button class="btn-add-pin" on:click={addPin}>+ Add Pin</button>
        </div>

        <div class="pins-table-wrap">
          <table class="pins-table">
            <thead>
              <tr>
                <th>Pin ID</th>
                <th>Label</th>
                <th>Type</th>
                <th>Side</th>
                <th style="width: 40px"></th>
              </tr>
            </thead>
            <tbody>
              {#each pins as p, i}
                <tr>
                  <td><input class="table-input" bind:value={p.id} placeholder="ID"/></td>
                  <td><input class="table-input" bind:value={p.label} placeholder="Label"/></td>
                  <td>
                    <select class="table-select" bind:value={p.type}>
                      {#each PIN_TYPES as pt}
                        <option value={pt}>{pt}</option>
                      {/each}
                    </select>
                  </td>
                  <td>
                    <select class="table-select" bind:value={p.side}>
                      {#each SIDES as s}
                        <option value={s}>{s}</option>
                      {/each}
                    </select>
                  </td>
                  <td>
                    <button class="btn-del-pin" on:click={() => removePin(i)} title="Hapus pin">✕</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => show = false}>Cancel</button>
        <button class="btn-save" on:click={handleSave}>Save Component to Library</button>
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
    width: 620px; max-width: 95vw; max-height: 90vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 16px 40px rgba(0,0,0,0.8);
  }
  .modal-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid #252545;
    font: 700 14px -apple-system, sans-serif; color: #4f9cf9;
  }
  .btn-close {
    background: transparent; border: none; color: #8888aa;
    font-size: 16px; cursor: pointer; padding: 4px;
  }
  .btn-close:hover { color: #fff; }
  .modal-body {
    padding: 18px; display: flex; flex-direction: column; gap: 14px;
    overflow-y: auto; flex: 1;
  }
  .form-row {
    display: flex; gap: 12px;
  }
  .flex-1 { flex: 1; }
  .flex-2 { flex: 2; }
  .form-group {
    display: flex; flex-direction: column; gap: 5px; font-size: 11px;
    color: #a0a0c0; font-weight: 600;
  }
  .form-group input, .form-group select {
    background: #0d0d1a; border: 1px solid #353565; border-radius: 5px;
    padding: 8px 10px; color: #fff; font-size: 12px; outline: none;
  }
  .form-group input:focus, .form-group select:focus {
    border-color: #4f9cf9;
  }
  .pins-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 6px; font-size: 12px; font-weight: 700; color: #e8e8f5;
  }
  .btn-add-pin {
    background: #252550; border: 1px solid #454580; border-radius: 4px;
    padding: 4px 10px; color: #4ade80; font-size: 11px; font-weight: 600; cursor: pointer;
  }
  .btn-add-pin:hover { background: #303065; }
  .pins-table-wrap {
    border: 1px solid #252545; border-radius: 6px; overflow: hidden;
    max-height: 220px; overflow-y: auto; background: #0d0d1a;
  }
  .pins-table {
    width: 100%; border-collapse: collapse; font-size: 12px;
  }
  .pins-table th {
    background: #1a1a35; padding: 7px 8px; text-align: left;
    color: #8888aa; font-weight: 600; font-size: 11px; border-bottom: 1px solid #252545;
  }
  .pins-table td {
    padding: 5px 8px; border-bottom: 1px solid #1a1a30;
  }
  .table-input, .table-select {
    width: 100%; background: #141428; border: 1px solid #2a2a45;
    border-radius: 4px; padding: 4px 6px; color: #e8e8f5; font-size: 11px; outline: none;
  }
  .table-input:focus, .table-select:focus { border-color: #4f9cf9; }
  .btn-del-pin {
    background: transparent; border: none; color: #f87171;
    cursor: pointer; font-size: 12px; padding: 2px 6px; border-radius: 3px;
  }
  .btn-del-pin:hover { background: #3a1010; }
  .modal-footer {
    display: flex; justify-content: flex-end; gap: 10px;
    padding: 12px 18px; border-top: 1px solid #252545; background: #101024;
  }
  .btn-cancel {
    background: transparent; border: 1px solid #353565; border-radius: 5px;
    padding: 7px 14px; color: #c0c0e0; cursor: pointer; font-size: 12px;
  }
  .btn-cancel:hover { background: #1a1a35; }
  .btn-save {
    background: #2563eb; border: 1px solid #3b82f6; border-radius: 5px;
    padding: 7px 16px; color: #fff; font-weight: 600; cursor: pointer; font-size: 12px;
  }
  .btn-save:hover { background: #1d4ed8; }
</style>

