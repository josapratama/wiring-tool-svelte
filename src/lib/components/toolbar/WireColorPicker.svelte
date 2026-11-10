<script>
  import { createEventDispatcher } from 'svelte'

  export let activeColor = '#22c55e'
  const dispatch = createEventDispatcher()

  let showPopover = false

  const WIRE_COLORS = [
    { c: '#22c55e', t: 'Signal (Hijau)' },
    { c: '#ef4444', t: 'Power +5V (Merah)' },
    { c: '#f97316', t: 'Power +3.3V (Oranye)' },
    { c: '#dc2626', t: 'Power +12V (Crimson)' },
    { c: '#1f2937', t: 'GND Ground (Hitam)' },
    { c: '#3b82f6', t: 'I2C SDA / SCL (Biru)' },
    { c: '#a855f7', t: 'SPI SCK/MOSI/MISO (Ungu)' },
    { c: '#eab308', t: 'UART TX / RX (Kuning)' },
    { c: '#06b6d4', t: 'Analog ADC (Cyan)' },
    { c: '#ffffff', t: 'Net Pasif (Putih)' }
  ]

  $: activeColorObj = WIRE_COLORS.find(w => w.c.toLowerCase() === activeColor.toLowerCase())

  function pickColor(c) {
    activeColor = c
    dispatch('change', c)
    showPopover = false
  }

  function handleCustomInput(e) {
    const val = e.target.value
    activeColor = val
    dispatch('change', val)
  }
</script>

<svelte:window on:click={() => showPopover = false} />

<div class="wire-color-tg dropdown-wrap">
  <button
    class="tbtn color-popover-btn"
    on:click|stopPropagation={() => showPopover = !showPopover}
    title="Pilih Warna Jalur Kabel"
  >
    <span class="cdot-active-preview" style="background:{activeColor}"></span>
    <span class="col-lbl-name">{activeColorObj ? activeColorObj.t : 'Wire'}</span>
    <span class="arrow-down-sm">▾</span>
  </button>

  {#if showPopover}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="color-popover" on:click|stopPropagation>
      <div class="color-popover-title">Preset Warna Jalur & Kabel</div>
      <div class="color-grid">
        {#each WIRE_COLORS as wc}
          <button
            class="color-chip"
            class:chip-selected={activeColor === wc.c}
            on:click={() => pickColor(wc.c)}
            title="{wc.t} ({wc.c})"
          >
            <span class="chip-dot" style="background:{wc.c}"></span>
            <span class="chip-label">{wc.t}</span>
          </button>
        {/each}
      </div>
      <div class="color-custom-row">
        <span class="color-custom-lbl">Warna Bebas:</span>
        <input
          type="color"
          value={activeColor}
          on:input={handleCustomInput}
          class="col-custom-inp"
          title="Custom color picker"
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .wire-color-tg { position: relative; }
  .color-popover-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid #334155;
    border-radius: 5px;
    background: #1e293b;
    color: #cbd5e1;
    cursor: pointer;
    font-size: 11.5px;
    height: 28px;
    transition: all 0.1s;
  }
  .color-popover-btn:hover {
    background: #273549;
    border-color: #475569;
    color: #fff;
  }
  .cdot-active-preview {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }
  .col-lbl-name {
    font-size: 11px;
    font-weight: 600;
    max-width: 70px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .arrow-down-sm { font-size: 9px; opacity: 0.7; }

  .color-popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    width: 240px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.06);
    padding: 10px;
    z-index: 99999 !important;
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: pop-down 0.12s ease-out;
  }
  @keyframes pop-down {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .color-popover-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #64748b;
  }
  .color-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
  }
  .color-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 7px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 5px;
    cursor: pointer;
    color: #cbd5e1;
    font-size: 11px;
    text-align: left;
    transition: all 0.1s;
  }
  .color-chip:hover {
    background: #273549;
    color: #fff;
    border-color: #475569;
  }
  .color-chip.chip-selected {
    border-color: #38bdf8;
    background: #0c4a6e;
    color: #fff;
    font-weight: 600;
  }
  .chip-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .chip-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 11px;
  }

  .color-custom-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    padding-top: 6px;
    border-top: 1px solid #1e293b;
    font-size: 11px;
    color: #94a3b8;
  }
  .col-custom-inp {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background: none;
  }

  @media (max-width: 1440px) {
    .col-lbl-name { display: none; }
  }
</style>

