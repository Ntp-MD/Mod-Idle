<script lang="ts">
  import {
    copyHudLayout, DEFAULT_HUD_LAYOUT, DEFAULT_MODAL_AREA, HUD_REGION_META,
    moveGridArea, validGridArea, validateHudLayout,
    type GridAlign, type GridArea, type HudLayout, type HudRegionId,
  } from './hud-layout';

  type Layer = 'hud' | 'modal';
  type RegionId = HudRegionId | 'panel';
  type Coordinate = 'rowStart' | 'rowEnd' | 'columnStart' | 'columnEnd';
  const CELLS = Array.from({ length: 225 }, (_, index) => ({
    row: Math.floor(index / 15) + 1,
    column: (index % 15) + 1,
  }));
  const TONES: Record<RegionId, string> = {
    objectives: 'var(--focus)', target: 'var(--hot)', menu: 'var(--gold)', field: 'var(--good-lit)',
    travel: 'var(--focus)', panels: 'var(--gold-lit)', feed: 'var(--dim)',
    actionbar: 'var(--mana-lit)', controls: 'var(--hp-lit)', panel: 'var(--gold)',
  };
  const ALIGNMENTS: [GridAlign, string][] = [
    ['start', 'Start'], ['center', 'Center'], ['end', 'End'], ['stretch', 'Stretch'],
  ];

  let { hud, modal, onapply }: {
    hud: HudLayout;
    modal: GridArea;
    onapply: (hud: HudLayout, modal: GridArea) => void;
  } = $props();
  let layer = $state<Layer>('hud');
  let hudDraft = $state(copyHudLayout(DEFAULT_HUD_LAYOUT));
  let modalDraft = $state<GridArea>({ ...DEFAULT_MODAL_AREA });
  let selected = $state<RegionId>('objectives');
  let focusedCell = $state({ row: 1, column: 1 });
  let notice = $state('');
  let gridEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    hudDraft = copyHudLayout(hud);
    modalDraft = { ...modal };
  });

  const issue = $derived(layer === 'hud' ? validateHudLayout(hudDraft) : (validGridArea(modalDraft) ? null : 'Panel canvas goes outside the grid.'));
  const activeArea = $derived(layer === 'hud' ? hudDraft[selected as HudRegionId].area : modalDraft);
  const activeLabel = $derived(layer === 'hud' ? hudDraft[selected as HudRegionId].label : 'Main panel canvas');

  function regionAt(row: number, column: number): RegionId | null {
    if (layer === 'modal') {
      const a = modalDraft;
      return row >= a.rowStart && row <= a.rowEnd && column >= a.columnStart && column <= a.columnEnd ? 'panel' : null;
    }
    return HUD_REGION_META.find(({ id }) => {
      const a = hudDraft[id].area;
      return row >= a.rowStart && row <= a.rowEnd && column >= a.columnStart && column <= a.columnEnd;
    })?.id ?? null;
  }

  function labelFor(id: RegionId): string {
    return id === 'panel' ? 'Main panel canvas' : hudDraft[id].label;
  }

  function shortLabel(id: RegionId): string {
    const labels: Record<RegionId, string> = {
      objectives: 'MAP', target: 'MOB', menu: 'MENU', travel: 'TRAVEL', field: 'FIELD', panels: 'PANELS',
      feed: 'LOG', actionbar: 'VITALS', controls: 'CTRL', panel: 'PANEL',
    };
    return labels[id];
  }

  function chooseRegion(id: RegionId) {
    if ((layer === 'modal') !== (id === 'panel')) return;
    selected = id;
    notice = '';
  }

  function placeAt(row: number, column: number) {
    if (layer === 'hud' && selected !== 'panel') {
      const next = copyHudLayout(hudDraft);
      next[selected].area = moveGridArea(next[selected].area, row, column);
      hudDraft = next;
    } else if (layer === 'modal') {
      modalDraft = moveGridArea(modalDraft, row, column);
    }
    notice = '';
  }

  function cellClick(row: number, column: number) {
    focusedCell = { row, column };
    const owner = regionAt(row, column);
    if (owner) chooseRegion(owner);
    else placeAt(row, column);
  }

  function focusCell(row: number, column: number) {
    focusedCell = { row, column };
    requestAnimationFrame(() => gridEl?.querySelector<HTMLButtonElement>(`[data-grid-cell="${row}:${column}"]`)?.focus());
  }

  function onGridKeydown(event: KeyboardEvent) {
    const rowStep = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    const columnStep = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (rowStep || columnStep) {
      event.preventDefault();
      focusCell(Math.min(15, Math.max(1, focusedCell.row + rowStep)), Math.min(15, Math.max(1, focusedCell.column + columnStep)));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusCell(focusedCell.row, event.key === 'Home' ? 1 : 15);
    }
  }

  function dragStart(event: DragEvent, id: RegionId) {
    selected = id;
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function dropAt(event: DragEvent, row?: number, column?: number) {
    event.preventDefault();
    event.stopPropagation();
    const raw = event.dataTransfer?.getData('text/plain') as RegionId | '';
    if (!raw) return;
    const target = row && column ? { row, column } : cellFromPointer(event);
    if (target) {
      selected = raw;
      placeAt(target.row, target.column);
    }
  }

  function cellFromPointer(event: DragEvent): { row: number; column: number } | null {
    const rect = gridEl?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      column: Math.min(15, Math.max(1, Math.floor(((event.clientX - rect.left) / rect.width) * 15) + 1)),
      row: Math.min(15, Math.max(1, Math.floor(((event.clientY - rect.top) / rect.height) * 15) + 1)),
    };
  }

  function setCoordinate(key: Coordinate, value: number) {
    const coordinate = Math.min(15, Math.max(1, Math.round(value)));
    if (layer === 'modal') {
      const next = { ...modalDraft };
      next[key] = coordinate;
      if (key === 'rowStart' && next.rowEnd < coordinate) next.rowEnd = coordinate;
      if (key === 'rowEnd' && next.rowStart > coordinate) next.rowStart = coordinate;
      if (key === 'columnStart' && next.columnEnd < coordinate) next.columnEnd = coordinate;
      if (key === 'columnEnd' && next.columnStart > coordinate) next.columnStart = coordinate;
      modalDraft = next;
      notice = '';
      return;
    }
    if (selected === 'panel') return;
    const next = copyHudLayout(hudDraft);
    const area = next[selected].area;
    area[key] = coordinate;
    if (key === 'rowStart' && area.rowEnd < coordinate) area.rowEnd = coordinate;
    if (key === 'rowEnd' && area.rowStart > coordinate) area.rowStart = coordinate;
    if (key === 'columnStart' && area.columnEnd < coordinate) area.columnEnd = coordinate;
    if (key === 'columnEnd' && area.columnStart > coordinate) area.columnStart = coordinate;
    hudDraft = next;
    notice = '';
  }

  function setAlignment(axis: 'justify' | 'align', value: GridAlign) {
    if (layer !== 'hud' || selected === 'panel') return;
    hudDraft = { ...hudDraft, [selected]: { ...hudDraft[selected], [axis]: value } };
  }

  function resetLayer() {
    if (layer === 'hud') {
      hudDraft = copyHudLayout(DEFAULT_HUD_LAYOUT);
      selected = 'objectives';
    } else {
      modalDraft = { ...DEFAULT_MODAL_AREA };
      selected = 'panel';
    }
    notice = '';
  }

  function applyLayout() {
    if (issue) {
      notice = issue;
      return;
    }
    onapply(copyHudLayout(hudDraft), { ...modalDraft });
  }

  function exportLayout() {
    const contents = JSON.stringify({ version: 1, hud: hudDraft, modal: modalDraft }, null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hud-layout.json';
    link.click();
    URL.revokeObjectURL(url);
    notice = 'Layout exported.';
  }
</script>

<div class="layout-editor">
  <aside class="layout-palette" aria-label="Layout components">
    <div class="layer-switch" role="tablist" aria-label="Layout layer">
      <button role="tab" aria-selected={layer === 'hud'} class:active={layer === 'hud'} onclick={() => { layer = 'hud'; selected = 'objectives'; notice = ''; }}>HUD</button>
      <button role="tab" aria-selected={layer === 'modal'} class:active={layer === 'modal'} onclick={() => { layer = 'modal'; selected = 'panel'; notice = ''; }}>Modal</button>
    </div>
    <h3>{layer === 'hud' ? 'Components' : 'Modal surfaces'}</h3>
    <div class="component-list">
      {#if layer === 'hud'}
        {#each HUD_REGION_META as region (region.id)}
          <button class="component" class:selected={selected === region.id} draggable="true"
                  ondragstart={(event) => dragStart(event, region.id)} onclick={() => chooseRegion(region.id)}>
            <i style={`--region-tone:${TONES[region.id]}`}></i><span>{region.label}</span>
          </button>
        {/each}
      {:else}
        <button class="component" class:selected={selected === 'panel'} draggable="true"
                ondragstart={(event) => dragStart(event, 'panel')} onclick={() => chooseRegion('panel')}>
          <i style={`--region-tone:${TONES.panel}`}></i><span>Main panel canvas</span>
        </button>
      {/if}
    </div>
    <div class="editor-actions">
      <button onclick={resetLayer}>Reset layer</button>
      <button onclick={exportLayout}>Export JSON</button>
    </div>
  </aside>

  <section class="layout-workspace" aria-label="15 by 15 layout canvas">
    <div class="canvas-heading">
      <h3>{layer === 'hud' ? 'HUD grid · 15×15' : 'Modal grid · 15×15'}</h3>
      <span>Drag a component, or select it then click a cell.</span>
    </div>
    <div class="layout-grid" bind:this={gridEl} role="grid" aria-label="Layout cells"
         tabindex="-1" onkeydown={onGridKeydown}
         ondragover={(event) => event.preventDefault()} ondrop={(event) => dropAt(event)}>
      {#each CELLS as cell (`${cell.row}:${cell.column}`)}
        {@const owner = regionAt(cell.row, cell.column)}
        <button class="grid-cell" class:occupied={!!owner} class:chosen={owner === selected}
                style={`grid-row:${cell.row};grid-column:${cell.column}${owner ? `;--region-tone:${TONES[owner]}` : ''}`}
                data-grid-cell={`${cell.row}:${cell.column}`}
                tabindex={focusedCell.row === cell.row && focusedCell.column === cell.column ? 0 : -1}
                role="gridcell" aria-label={`${String.fromCharCode(64 + cell.row)}${cell.column}${owner ? ` · ${labelFor(owner)}` : ''}`}
                title={`${String.fromCharCode(64 + cell.row)}${cell.column}${owner ? ` · ${labelFor(owner)}` : ''}`}
                ondragover={(event) => event.preventDefault()}
                ondrop={(event) => dropAt(event, cell.row, cell.column)}
                onclick={() => cellClick(cell.row, cell.column)}>
          <small>{String.fromCharCode(64 + cell.row)}{cell.column}</small>
        </button>
      {/each}
      {#if layer === 'hud'}
        {#each HUD_REGION_META as region (region.id)}
          {@const area = hudDraft[region.id].area}
          <span class="region-caption" style={`--region-tone:${TONES[region.id]};grid-row:${area.rowStart}/${area.rowEnd + 1};grid-column:${area.columnStart}/${area.columnEnd + 1}`}>{shortLabel(region.id)}</span>
        {/each}
      {:else}
        <span class="region-caption" style={`--region-tone:${TONES.panel};grid-row:${modalDraft.rowStart}/${modalDraft.rowEnd + 1};grid-column:${modalDraft.columnStart}/${modalDraft.columnEnd + 1}`}>{shortLabel('panel')}</span>
      {/if}
    </div>
    {#if notice}<p class="notice" role="status">{notice}</p>{/if}
    {#if issue}<p class="issue" role="alert">{issue}</p>{/if}
  </section>

  <aside class="layout-inspector" aria-label="Selected region">
    <h3>{activeLabel}</h3>
    <p>Cell bounds use inclusive row and column coordinates.</p>
    <div class="coordinates">
      {#each [['rowStart', 'Row from'], ['rowEnd', 'Row to'], ['columnStart', 'Column from'], ['columnEnd', 'Column to']] as [key, label] (key)}
        <label>{label}
          <select value={activeArea[key as Coordinate]} onchange={(event) => setCoordinate(key as Coordinate, Number(event.currentTarget.value))}>
            {#each Array.from({ length: 15 }, (_, index) => index + 1) as value (value)}<option value={value}>{value}</option>{/each}
          </select>
        </label>
      {/each}
    </div>
    {#if layer === 'hud' && selected !== 'panel'}
      <label>Horizontal alignment
        <select value={hudDraft[selected].justify} onchange={(event) => setAlignment('justify', event.currentTarget.value as GridAlign)}>
          {#each ALIGNMENTS as [value, label] (value)}<option {value}>{label}</option>{/each}
        </select>
      </label>
      <label>Vertical alignment
        <select value={hudDraft[selected].align} onchange={(event) => setAlignment('align', event.currentTarget.value as GridAlign)}>
          {#each ALIGNMENTS as [value, label] (value)}<option {value}>{label}</option>{/each}
        </select>
      </label>
    {/if}
    <button class="apply" disabled={!!issue} onclick={applyLayout}>Apply layout</button>
  </aside>
</div>

<style>
  .layout-editor {
    display: grid;
    grid-template-columns: minmax(var(--box-180), .75fr) minmax(0, 3fr) minmax(var(--box-200), .85fr);
    gap: var(--spacing-sm);
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
  .layout-palette, .layout-workspace, .layout-inspector { min-width: 0; min-height: 0; }
  .layout-palette, .layout-inspector { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  h3 { margin: 0; color: var(--gold); font-size: var(--font-xs); }
  .layer-switch { display: flex; gap: var(--spacing-2xs); }
  .layer-switch button { flex: 1; padding: var(--spacing-2xs); font-size: var(--font-xs); }
  .layer-switch .active { color: var(--gold-lit); border-color: var(--gold); }
  .component-list { display: grid; align-content: start; gap: var(--spacing-2xs); min-height: 0; }
  .component {
    display: grid; grid-template-columns: var(--icon-xs) minmax(0, 1fr); align-items: center; gap: var(--spacing-xs);
    min-width: 0; padding: var(--spacing-xs); text-align: left; font-size: var(--font-xs); color: var(--text);
  }
  .component i { width: var(--icon-xs); height: var(--icon-xs); border: 1px solid var(--region-tone); background: color-mix(in srgb, var(--region-tone) 22%, transparent); }
  .component span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .component.selected { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 10%, var(--panel)); }
  .editor-actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-2xs); margin-top: auto; }
  .editor-actions button, .apply { padding: var(--spacing-xs); font-size: var(--font-xs); }
  .layout-workspace { display: flex; flex-direction: column; justify-content: center; gap: var(--spacing-xs); }
  .canvas-heading { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-xs); }
  .canvas-heading span, .layout-inspector p { margin: 0; color: var(--dim); font-size: var(--font-xs); }
  .layout-grid {
    display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); grid-template-rows: repeat(15, minmax(0, 1fr));
    width: 100%; max-height: 100%; aspect-ratio: 16 / 9; align-self: center; min-height: 0; border: 1px solid var(--hud-edge); background: var(--bg);
  }
  .grid-cell {
    display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between;
    min-width: 0; min-height: 0; padding: var(--spacing-3xs); border-radius: 0; border-top: 0; border-left: 0;
    background: transparent; text-align: left; color: var(--dim);
  }
  .grid-cell small { font: var(--font-xs) / 1 var(--num); opacity: .7; }
  .region-caption {
    display: grid; place-items: center; z-index: 2; pointer-events: none; overflow: hidden;
    padding: var(--spacing-3xs); color: var(--region-tone); font-size: var(--font-xs); font-weight: 700;
    line-height: 1; letter-spacing: .02em; text-shadow: 0 1px 2px var(--bg);
  }
  .grid-cell.occupied { background: color-mix(in srgb, var(--region-tone) 14%, transparent); border-color: color-mix(in srgb, var(--region-tone) 55%, var(--line)); }
  .grid-cell.chosen { box-shadow: inset 0 0 0 1px var(--gold); background: color-mix(in srgb, var(--gold) 20%, var(--region-tone)); }
  .grid-cell:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; z-index: 1; }
  .coordinates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-xs); }
  .layout-inspector label { display: grid; gap: var(--spacing-3xs); color: var(--dim); font-size: var(--font-xs); }
  .layout-inspector select { min-width: 0; padding: var(--spacing-2xs); font-size: var(--font-xs); }
  .apply { margin-top: auto; color: var(--gold-lit); border-color: var(--gold); }
  .apply:disabled { opacity: .45; }
  .notice, .issue { margin: 0; font-size: var(--font-xs); }
  .notice { color: var(--good-lit); }
  .issue { color: var(--alarm); }
</style>
