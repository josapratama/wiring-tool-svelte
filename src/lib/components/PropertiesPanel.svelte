<script>
  /**
   * PropertiesPanel v2
   * - Multi-select summary view
   * - Wire color change from context
   * - Notes field
   */
  import { selection, multiSelection, components, wires, labels, routingMode,
           updateComponent, updateWire, updateLabel,
           removeComponent, removeComponents, removeWire, removeLabel,
           duplicateComponent, duplicateComponents, rotateComponent, rotateComponents,
           flipComponents, alignComponents, distributeComponents, pushHistory } from '$lib/store/diagram.js'
  import { PIN_COLORS } from '$lib/data/pin-colors.js'
  import { MCU_PINS }   from '$lib/data/mcu-pins.js'

  // ── Resolve current item from stores ──────────────────
  $: item = (() => {
    if (!$selection) return null
    if ($selection.type === 'component') return $components.find(c => c.instanceId === $selection.id) ?? null
    if ($selection.type === 'wire')      return $wires.find(w => w.id === $selection.id) ?? null
    if ($selection.type === 'label')     return $labels.find(l => l.id === $selection.id) ?? null
    return null
  })()

  $: multiItems = $multiSelection.length > 1
    ? $multiSelection.map(s => $components.find(c => c.instanceId === s.id)).filter(Boolean)
    : []

  // ── Pin list helper ────────────────────────────────────
  function pins(comp) {
    if (comp.isMCU && MCU_PINS[comp.id]) {
      return [...(MCU_PINS[comp.id].left ?? []), ...(MCU_PINS[comp.id].right ?? [])]
    }
    return comp.pins ?? []
  }

  // ── Wire connections count ─────────────────────────────
  function connCount(instanceId) {
    return $wires.filter(w => w.fromComp === instanceId || w.toComp === instanceId).length
  }

  // ── Inline rename ─────────────────────────────────────
  function handleRename(e) {
    if (!item?.instanceId) return
    updateComponent(item.instanceId, { label: e.target.value })
  }
</script>

<div class="panel">

  <!-- ── MULTI-SELECT SUMMARY ───────────────────────────── -->
  {#if multiItems.length > 1}
    <div class="section-title">Multi-Select ({multiItems.length})</div>

    <div class="multi-list">
      {#each multiItems as c}
        <div class="multi-row">
          <span class="multi-dot" style="background:{({mcu:'#4f9cf9',sensor:'#4ade80',power:'#f87171',display:'#a78bfa',comms:'#60a5fa',output:'#f97316',passive:'#94a3b8',switch:'#facc15'})[c.theme]??'#94a3b8'}"></span>
          <span class="multi-name">{c.label}</span>
          <span class="multi-id">{c.id}</span>
        </div>
      {/each}
    </div>

    <div class="multi-actions">
      <button class="btn-act" on:click={() => {
        rotateComponents(multiItems.map(c => c.instanceId), 90)
      }}>🔄 Rotate All</button>
      <button class="btn-act" on:click={() => {
        duplicateComponents(multiItems.map(c => c.instanceId))
      }}>📋 Duplicate All</button>
      <button class="btn-act danger" on:click={() => {
        // BUG FIX #B1: single history step for batch delete
        removeComponents(multiItems.map(c => c.instanceId))
      }}>🗑 Delete All</button>
    </div>

    <div class="section-title" style="margin-top:10px">Alignment</div>
    <div class="align-grid">
      <button class="btn-act" on:click={() => alignComponents(multiItems.map(c => c.instanceId), 'left')} title="Align Left">⬅ Left</button>
      <button class="btn-act" on:click={() => alignComponents(multiItems.map(c => c.instanceId), 'centerH')} title="Center Horizontal">↔ Center H</button>
      <button class="btn-act" on:click={() => alignComponents(multiItems.map(c => c.instanceId), 'right')} title="Align Right">➡ Right</button>
      <button class="btn-act" on:click={() => alignComponents(multiItems.map(c => c.instanceId), 'top')} title="Align Top">⬆ Top</button>
      <button class="btn-act" on:click={() => alignComponents(multiItems.map(c => c.instanceId), 'centerV')} title="Center Vertical">↕ Center V</button>
      <button class="btn-act" on:click={() => alignComponents(multiItems.map(c => c.instanceId), 'bottom')} title="Align Bottom">⬇ Bottom</button>
    </div>

    {#if multiItems.length >= 3}
      <div class="section-title" style="margin-top:8px">Distribution</div>
      <div class="dist-row">
        <button class="btn-act" style="flex:1" on:click={() => distributeComponents(multiItems.map(c => c.instanceId), 'h')} title="Distribute Horizontally">↔ Distribute H</button>
        <button class="btn-act" style="flex:1" on:click={() => distributeComponents(multiItems.map(c => c.instanceId), 'v')} title="Distribute Vertically">↕ Distribute V</button>
      </div>
    {/if}

    <!-- ── EMPTY STATE + LEGEND ───────────────────────────── -->
  {:else if !item}
    <div class="empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2a2a50" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <circle cx="12" cy="16" r="0.5" fill="#2a2a50"/>
      </svg>
      <p>Select a component or wire<br/>to edit its properties</p>
    </div>

    <div class="legend">
      <div class="legend-title">Pin Type Colors</div>
      <div class="legend-grid">
        {#each Object.entries(PIN_COLORS) as [type, color]}
          <div class="legend-row">
            <span class="ldot" style="background:{color}"></span>
            <span>{type}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- ── COMPONENT PROPERTIES ───────────────────────────── -->
  {:else if $selection.type === 'component' && item}
    <div class="section-title">
      Component
      <span class="conn-badge">{connCount(item.instanceId)} wires</span>
    </div>

    <label class="field">
      <span>Label</span>
      <input value={item.label ?? ''} on:change={handleRename}/>
    </label>

    <div class="row2">
      <label class="field">
        <span>X</span>
        <input type="number" value={Math.round(item.x)}
          on:change={e => updateComponent(item.instanceId, { x: +e.target.value })}/>
      </label>
      <label class="field">
        <span>Y</span>
        <input type="number" value={Math.round(item.y)}
          on:change={e => updateComponent(item.instanceId, { y: +e.target.value })}/>
      </label>
    </div>

    <div class="row2">
      <label class="field">
        <span>Width</span>
        <input type="number" value={item.width}
          on:change={e => updateComponent(item.instanceId, { width: +e.target.value })}/>
      </label>
      <label class="field">
        <span>Height</span>
        <input type="number" value={item.height}
          on:change={e => updateComponent(item.instanceId, { height: +e.target.value })}/>
      </label>
    </div>

    <label class="field">
      <span>Notes</span>
      <input value={item.notes ?? ''}
        on:change={e => updateComponent(item.instanceId, { notes: e.target.value })}/>
    </label>

    {#if item.props && Object.keys(item.props).length > 0}
      <div class="section-title" style="margin-top:10px">Values</div>
      {#each Object.entries(item.props) as [k, v]}
        <label class="field">
          <span>{k}</span>
          <input value={v}
            on:change={e => updateComponent(item.instanceId,
              { props: { ...item.props, [k]: e.target.value } })}/>
        </label>
      {/each}
    {/if}

    <!-- Pin table -->
    <div class="section-title" style="margin-top:10px">
      Pins ({pins(item).length})
    </div>
    <div class="pin-wrap">
      <table class="pin-table">
        <thead><tr><th>ID</th><th>Label</th><th>Type</th><th>Side</th></tr></thead>
        <tbody>
          {#each pins(item) as p}
            <tr>
              <td style="font-family:monospace;color:#e8e8f5">{p.id}</td>
              <td>{p.label}</td>
              <td><span style="color:{PIN_COLORS[p.type]??'#94a3b8'};font-size:10px;font-weight:600">{p.type}</span></td>
              <td style="color:#505070">{p.side ?? 'L/R'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="action-row">
      <button class="btn-act" on:click={() => rotateComponent(item.instanceId, 90)} title="Rotate component 90° (R)">
        🔄 Rotate
      </button>
      <button class="btn-act" on:click={() => duplicateComponent(item.instanceId)}>
        📋 Duplicate
      </button>
      <button class="btn-act danger" on:click={() => removeComponent(item.instanceId)}>
        🗑 Delete
      </button>
    </div>

    <div class="action-row" style="margin-top:6px">
      <button class="btn-act" style="flex:1" on:click={() => flipComponents([item.instanceId], 'x')} title="Flip Horizontal (X)">
        ↔ Flip X
      </button>
      <button class="btn-act" style="flex:1" on:click={() => flipComponents([item.instanceId], 'y')} title="Flip Vertical (Y)">
        ↕ Flip Y
      </button>
    </div>

    <!-- ── WIRE PROPERTIES ─────────────────────────────────── -->
  {:else if $selection.type === 'wire' && item}
    <div class="section-title">Wire</div>

    <label class="field">
      <span>Label</span>
      <input value={item.label ?? ''}
        on:change={e => updateWire(item.id, { label: e.target.value })}/>
    </label>

    <label class="field">
      <span>Color</span>
      <input type="color" value={item.color ?? '#4f9cf9'}
        on:input={e => updateWire(item.id, { color: e.target.value })}/>
    </label>

    <label class="field">
      <span>Style</span>
      <select value={item.routingMode ?? $routingMode}
        on:change={e => updateWire(item.id, { routingMode: e.target.value })}>
        <option value="orthogonal">Orthogonal 90°</option>
        <option value="curved">Curved Bezier</option>
        <option value="direct">Direct Line</option>
      </select>
    </label>

    <div class="section-title" style="margin-top:10px">Quick Colors</div>
    <div class="quick-colors">
      {#each ['#ef4444','#4ade80','#60a5fa','#a78bfa','#f59e0b','#34d399','#fb923c','#facc15'] as col}
        <button
          class="qcol"
          style="background:{col}"
          class:qcol-active={item.color === col}
          on:click={() => updateWire(item.id, { color: col })}
          title={col}
          aria-label={col}
        ></button>
      {/each}
    </div>

    <div class="section-title" style="margin-top:10px">Connection</div>
    {@const fc = $components.find(c => c.instanceId === item.fromComp)}
    {@const tc = $components.find(c => c.instanceId === item.toComp)}
    <div class="conn-info">
      <div class="conn-row">
        <span class="conn-lbl">From</span>
        <span class="conn-val">{fc?.label || item.fromComp}</span>
        <span class="conn-pin">→ {item.fromPin}</span>
      </div>
      <div class="conn-row">
        <span class="conn-lbl">To</span>
        <span class="conn-val">{tc?.label || item.toComp}</span>
        <span class="conn-pin">→ {item.toPin}</span>
      </div>
    </div>

    {#if item.userOffset}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding:4px 6px;background:#1e293b;border-radius:4px">
        <span style="font-size:11px;color:#94a3b8">Offset: {item.userOffset}px</span>
        <button class="btn-act" style="padding:2px 8px;font-size:11px" on:click={() => updateWire(item.id, { userOffset: 0 })}>Reset Offset</button>
      </div>
    {/if}

    <button class="btn-act danger" style="width:100%;margin-top:10px"
      on:click={() => removeWire(item.id)}>
      🗑 Delete Wire
    </button>

    <!-- ── LABEL PROPERTIES ────────────────────────────────── -->
  {:else if $selection.type === 'label' && item}
    <div class="section-title">Text Label</div>

    <label class="field">
      <span>Text</span>
      <input value={item.text}
        on:change={e => updateLabel(item.id, { text: e.target.value })}/>
    </label>
    <label class="field">
      <span>Font Size</span>
      <input type="number" value={item.fontSize ?? 14}
        on:change={e => updateLabel(item.id, { fontSize: +e.target.value })}/>
    </label>
    <label class="field">
      <span>Color</span>
      <input type="color" value={item.color ?? '#facc15'}
        on:input={e => updateLabel(item.id, { color: e.target.value })}/>
    </label>

    <button class="btn-act danger" style="width:100%;margin-top:10px"
      on:click={() => removeLabel(item.id)}>
      🗑 Delete
    </button>
  {/if}
</div>

<style>
  .panel {
    display: flex; flex-direction: column; gap: 4px;
    padding: 12px; overflow-y: auto; flex: 1; background: #0f172a;
  }
  .panel::-webkit-scrollbar { width: 4px; }
  .panel::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }

  .section-title {
    font: 700 11px/1 -apple-system, sans-serif; text-transform: uppercase; letter-spacing: 0.8px;
    color: #38bdf8; border-bottom: 1px solid #1e293b;
    padding-bottom: 5px; margin: 8px 0 6px;
    display: flex; align-items: center; gap: 6px;
  }
  .conn-badge {
    margin-left: auto; font: 600 10px sans-serif;
    color: #4ade80; text-transform: none; letter-spacing: 0;
  }

  .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
  .field span { font-size: 11px; font-weight: 500; color: #94a3b8; }
  .field input, .field select {
    background: #030712; border: 1px solid #374151; border-radius: 6px;
    padding: 6px 9px; color: #f8fafc; font-size: 12px; outline: none; width: 100%;
    transition: all 0.15s;
  }
  .field input:focus, .field select:focus {
    border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
  }
  .field input[type="color"] { height: 34px; padding: 2px; cursor: pointer; }

  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }

  .quick-colors { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
  .qcol {
    width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent;
    cursor: pointer; transition: transform 0.1s;
  }
  .qcol:hover { transform: scale(1.2); }
  .qcol.qcol-active { border-color: #fff; transform: scale(1.15); box-shadow: 0 0 6px rgba(255,255,255,0.4); }

  .conn-info { font-size: 11px; margin-bottom: 6px; }
  .conn-row { display: flex; align-items: center; gap: 6px; padding: 4px 0;
    border-bottom: 1px solid #1e293b; }
  .conn-lbl { color: #64748b; min-width: 32px; font-weight: 700; font-size: 10px; text-transform: uppercase; }
  .conn-val { color: #cbd5e1; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
  .conn-pin { color: #38bdf8; font-weight: 700; font-family: monospace; white-space: nowrap; }

  .action-row { display: flex; gap: 6px; margin-top: 10px; }
  .btn-act {
    flex: 1; padding: 7px 8px; border-radius: 6px; border: 1px solid #334155;
    background: #1e293b; color: #cbd5e1; cursor: pointer; font-size: 11px;
    font-weight: 600; transition: all 0.12s; text-align: center;
  }
  .btn-act:hover { background: #334155; color: #fff; border-color: #38bdf8; }
  .btn-act.danger { color: #f87171; border-color: #7f1d1d; background: #270e0e; }
  .btn-act.danger:hover { background: #451010; border-color: #ef4444; }

  .align-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-bottom: 6px; }
  .dist-row { display: flex; gap: 4px; margin-bottom: 6px; }

  .multi-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .multi-row { display: flex; align-items: center; gap: 7px; font-size: 11px;
    padding: 5px 8px; background: #1e293b; border-radius: 5px; }
  .multi-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .multi-name { color: #f1f5f9; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
  .multi-id { color: #64748b; font-size: 10px; font-family: monospace; }
  .multi-actions { display: flex; gap: 6px; }

  .pin-wrap { max-height: 180px; overflow-y: auto; margin-bottom: 6px; border-radius: 4px; }
  .pin-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .pin-table th { color: #64748b; text-align: left; padding: 3px 6px; font-weight: 600; font-size: 10px; }
  .pin-table td { padding: 4px 6px; color: #cbd5e1; border-top: 1px solid #1e293b; }

  .empty { text-align: center; padding: 28px 12px 16px; color: #475569; }
  .empty p { margin-top: 10px; font-size: 12px; line-height: 1.6; color: #94a3b8; }

  .legend { padding-top: 12px; border-top: 1px solid #1e293b; margin-top: 8px; }
  .legend-title { font: 700 10px/1 sans-serif; text-transform: uppercase;
    letter-spacing: 0.8px; color: #64748b; margin-bottom: 8px; }
  .legend-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
  .legend-row { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #94a3b8; }
  .ldot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; border: 1px solid #1e293b; }

  /* ── Light Mode Integration ── */
  :global(.light-app) .panel {
    background: #ffffff;
    color: #0f172a;
  }
  :global(.light-app) .section-title {
    color: #475569;
  }
  :global(.light-app) .field span {
    color: #475569;
  }
  :global(.light-app) .field input,
  :global(.light-app) .field select {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #0f172a;
  }
  :global(.light-app) .field input:focus,
  :global(.light-app) .field select:focus {
    border-color: #0284c7;
    box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
  }
  :global(.light-app) .conn-info {
    background: #f8fafc;
    border-color: #e2e8f0;
  }
  :global(.light-app) .conn-lbl {
    color: #64748b;
  }
  :global(.light-app) .conn-val {
    color: #0284c7;
  }
  :global(.light-app) .conn-pin {
    color: #334155;
  }
  :global(.light-app) .btn-act {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #334155;
  }
  :global(.light-app) .btn-act:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #94a3b8;
  }
  :global(.light-app) .btn-act.danger {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }
  :global(.light-app) .btn-act.danger:hover {
    background: #fee2e2;
    border-color: #ef4444;
  }
  :global(.light-app) .multi-row {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }
  :global(.light-app) .multi-name {
    color: #0f172a;
  }
  :global(.light-app) .pin-table th {
    color: #64748b;
  }
  :global(.light-app) .pin-table td {
    color: #334155;
    border-top-color: #e2e8f0;
  }
  :global(.light-app) .legend {
    border-top-color: #e2e8f0;
  }
  :global(.light-app) .legend-title {
    color: #64748b;
  }
  :global(.light-app) .legend-row {
    color: #475569;
  }
  :global(.light-app) .empty p {
    color: #64748b;
  }
</style>
