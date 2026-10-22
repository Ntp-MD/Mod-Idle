<script lang="ts">
  import {
    copyHudLayout, DEFAULT_HUD_LAYOUT, DEFAULT_MODAL_AREA, HUD_LAYOUT_VERSION, HUD_REGION_META, migrateHudLayout,
    moveGridArea, rectFromArea, validGridArea, validRect, validateHudLayout,
    type GridAlign, type GridArea, type HudPlacement, type HudLayout, type HudRegionId, type RegionRect,
  } from './hud-layout';

  type Layer = 'hud' | 'modal';
  type RegionId = HudRegionId | 'panel';
  type Coordinate = 'rowStart' | 'rowEnd' | 'columnStart' | 'columnEnd';
  const CELLS = Array.from({ length: 225 }, (_, index) => ({
    row: Math.floor(index / 15) + 1,
    column: (index % 15) + 1,
  }));
  const TONES: Record<RegionId, string> = {
    tasks: 'var(--gold-lit)', objectives: 'var(--focus)', target: 'var(--hot)', menu: 'var(--gold)', field: 'var(--good-lit)',
    travel: 'var(--focus)', panels: 'var(--gold-lit)', commands: 'var(--good-lit)', feed: 'var(--dim)',
    actionbar: 'var(--mana-lit)', panel: 'var(--gold)',
  };
  const ALIGNMENTS: [GridAlign, string][] = [
    ['start', 'Start'], ['center', 'Center'], ['end', 'End'], ['stretch', 'Stretch'],
  ];

  let { hud, modal, onapply, migrationNotice = null }: {
    hud: HudLayout;
    modal: GridArea;
    onapply: (hud: HudLayout, modal: GridArea) => void;
    migrationNotice?: string | null;
  } = $props();
  let layer = $state<Layer>('hud');
  let hudDraft = $state(copyHudLayout(DEFAULT_HUD_LAYOUT));
  let modalDraft = $state<GridArea>({ ...DEFAULT_MODAL_AREA });
  let selected = $state<RegionId>('objectives');
  let focusedCell = $state({ row: 1, column: 1 });
  let notice = $state('');
  let gridEl = $state<HTMLDivElement | null>(null);
  let layoutFile = $state<HTMLInputElement | null>(null);

  $effect(() => {
    hudDraft = copyHudLayout(hud);
    modalDraft = { ...modal };
    if (migrationNotice) notice = migrationNotice;
  });

  const issue = $derived(layer === 'hud' ? validateHudLayout(hudDraft) : (validGridArea(modalDraft) ? null : 'Panel canvas goes outside the grid.'));
  const activeArea = $derived(layer === 'hud' ? hudDraft[selected as HudRegionId].area : modalDraft);
  const activeLabel = $derived(layer === 'hud' ? hudDraft[selected as HudRegionId].label : 'Main panel canvas');
  const activeDescription = $derived(layer === 'hud'
    ? HUD_REGION_META.find(({ id }) => id === selected)?.description ?? ''
    : 'A shared position for every screen panel shown in the Showcase and game.');

  function regionAt(row: number, column: number): RegionId | null {
    if (layer === 'modal') {
      const a = modalDraft;
      return row >= a.rowStart && row <= a.rowEnd && column >= a.columnStart && column <= a.columnEnd ? 'panel' : null;
    }
    return [...HUD_REGION_META.filter(({ id }) => id !== 'field'), ...HUD_REGION_META.filter(({ id }) => id === 'field')].find(({ id }) => {
      const region = hudDraft[id];
      if (id !== 'field' && region.mode === 'absolute') return false;
      const a = region.area;
      return row >= a.rowStart && row <= a.rowEnd && column >= a.columnStart && column <= a.columnEnd;
    })?.id ?? null;
  }

  function labelFor(id: RegionId): string {
    return id === 'panel' ? 'Main panel canvas' : hudDraft[id].label;
  }

  function shortLabel(id: RegionId): string {
    const labels: Record<RegionId, string> = {
      tasks: 'GOALS', objectives: 'MAP', target: 'MOB', menu: 'MENU', travel: 'TRAVEL', field: 'FIELD', panels: 'PANELS', commands: 'CMD',
      feed: 'LOG', actionbar: 'VITALS', panel: 'PANEL',
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

  const isAbsolute = $derived(layer === 'hud' && selected !== 'panel' && hudDraft[selected as HudRegionId].mode === 'absolute');
  const absoluteIds = $derived(HUD_REGION_META.filter(({ id }) => id !== 'field' && hudDraft[id].mode === 'absolute').map(({ id }) => hudDraft[id].label));
  const activeRect = $derived(layer === 'hud' && selected !== 'panel' ? hudDraft[selected as HudRegionId].rect : null);

  function setPlacement(value: HudPlacement) {
    if (layer !== 'hud' || selected === 'panel') return;
    const next = copyHudLayout(hudDraft);
    const region = next[selected];
    if (region.mode === value) return;
    if (value === 'absolute') region.rect = rectFromArea(region.area);
    region.mode = value;
    hudDraft = next;
    notice = '';
  }

  function setRect(key: keyof RegionRect, value: number) {
    if (layer !== 'hud' || selected === 'panel') return;
    const next = copyHudLayout(hudDraft);
    const rect = next[selected].rect;
    rect[key] = Math.round(value * 10) / 10;
    if (!validRect(rect)) { rect[key] = hudDraft[selected].rect[key]; notice = 'That free box would leave no room — keep x/y within −10…100 and w/h within 2…120 percent.'; return; }
    hudDraft = next;
    notice = '';
  }

  function setZ(value: number) {
    if (layer !== 'hud' || selected === 'panel') return;
    hudDraft = { ...hudDraft, [selected]: { ...hudDraft[selected], z: Number.isFinite(value) ? Math.round(value) : 0 } };
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
    if (issue) { notice = issue; return; }
    const normalized = migrateHudLayout({ version: HUD_LAYOUT_VERSION, hud: hudDraft, modal: modalDraft, notice: migrationNotice });
    const contents = JSON.stringify({ version: HUD_LAYOUT_VERSION, hud: normalized.hud, modal: normalized.modal, notice: normalized.notice }, null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hud-layout.json';
    link.click();
    URL.revokeObjectURL(url);
    notice = 'Layout exported.';
  }

  async function importLayout(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = migrateHudLayout(await file.text());
      hudDraft = imported.hud;
      modalDraft = imported.modal;
      selected = 'field';
      notice = imported.notice || 'Layout imported. Apply to preview it in the game.';
    } catch (error) {
      notice = error instanceof Error ? `Cannot import layout: ${error.message}` : 'Cannot import this layout.';
    } finally {
      input.value = '';
    }
  }
</script>

<div class="layout-editor">
  <aside class="layout-palette" aria-label="Layout components">
    <div class="layer-switch" role="tablist" aria-label="Layout layer">
      <button role="tab" aria-selected={layer === 'hud'} class:picked={layer === 'hud'} onclick={() => { layer = 'hud'; selected = 'objectives'; notice = ''; }}>HUD</button>
      <button role="tab" aria-selected={layer === 'modal'} class:picked={layer === 'modal'} onclick={() => { layer = 'modal'; selected = 'panel'; notice = ''; }}>Modal</button>
    </div>
    <h3>{layer === 'hud' ? 'Components' : 'Modal surfaces'}</h3>
    <div class="component-list">
      {#if layer === 'hud'}
        {#each HUD_REGION_META as region (region.id)}
            <button class="component" class:selected={selected === region.id} draggable="true" title={region.description}
                  ondragstart={(event) => dragStart(event, region.id)} onclick={() => chooseRegion(region.id)}>
            <i style={`--region-tone:${TONES[region.id]}`}></i><span>{region.label}</span>
            {#if region.id === 'field' || hudDraft[region.id].mode === 'absolute'}<em class="abs-tag">ABS</em>{/if}
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
      <label class="layout-import">Import JSON <input type="file" accept=".json,application/json" aria-label="Import HUD layout JSON" onchange={importLayout} /></label>
    </div>
    <p class="abs-list" aria-label="Absolutely positioned UI">
      <strong>Absolute:</strong> Combat field (overlay, always) · experience bar (pinned bottom) · panel veil and popovers (fixed)
      {#if absoluteIds.length} · free-boxed now: {absoluteIds.join(', ')}{/if}
    </p>
  </aside>

  <section class="layout-workspace" aria-label="15 by 15 layout canvas">
    <div class="canvas-heading">
      <h3>{layer === 'hud' ? 'HUD grid · 15×15' : 'Modal grid · 15×15'}</h3>
      <span>Drag to move · select then click an empty cell.</span>
    </div>
    <div class="layout-grid" bind:this={gridEl} role="grid" aria-label="Layout cells"
         tabindex="-1" onkeydown={onGridKeydown}
         ondragover={(event) => event.preventDefault()} ondrop={(event) => dropAt(event)}>
      {#each CELLS as cell (`${cell.row}:${cell.column}`)}
        {@const owner = regionAt(cell.row, cell.column)}
        <button class="grid-cell" class:occupied={!!owner} class:selected={owner === selected}
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
          {#if hudDraft[region.id].mode === 'absolute'}
            <span class="region-caption abs-caption" style={`--region-tone:${TONES[region.id]};left:${hudDraft[region.id].rect.x}%;top:${hudDraft[region.id].rect.y}%;width:${hudDraft[region.id].rect.w}%;height:${hudDraft[region.id].rect.h}%`}>{shortLabel(region.id)}<em>ABS</em></span>
          {:else}
            {@const area = hudDraft[region.id].area}
            <span class="region-caption" style={`--region-tone:${TONES[region.id]};grid-row:${area.rowStart}/${area.rowEnd + 1};grid-column:${area.columnStart}/${area.columnEnd + 1}`}>{shortLabel(region.id)}</span>
          {/if}
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
    <p>{activeDescription}</p>
    <p class="editor-help">
      <strong>How to use:</strong>
      {#if layer === 'hud'}
        Select a group and click an empty cell, or drag it from the list. Change the inclusive row/column bounds to resize it; alignment positions its contents. Placement "Absolute box" frees the region from the grid: it then sits at its own x/y percent of the stage with its own size and Z-index. Reset restores this layer's draft. Apply updates the HUD; in Showcase it changes the preview only.
      {:else}
        Set the shared panel bounds with the inclusive coordinates. Reset restores this layer's draft. Apply updates the game; in Showcase it changes the preview only.
      {/if}
    </p>
    {#if layer === 'modal'}
      <div class="coordinates">
        {#each [['rowStart', 'Row from'], ['rowEnd', 'Row to'], ['columnStart', 'Column from'], ['columnEnd', 'Column to']] as [key, label] (key)}
          <label>{label}
            <select value={modalDraft[key as Coordinate]} onchange={(event) => setCoordinate(key as Coordinate, Number(event.currentTarget.value))}>
              {#each Array.from({ length: 15 }, (_, index) => index + 1) as value (value)}<option value={value}>{value}</option>{/each}
            </select>
          </label>
        {/each}
      </div>
    {/if}
    {#if layer === 'hud' && selected !== 'panel'}
      <label>Placement
        <select value={hudDraft[selected].mode} onchange={(event) => setPlacement(event.currentTarget.value as HudPlacement)}>
          <option value="grid">Grid cells</option>
          <option value="absolute">Absolute box</option>
        </select>
      </label>
      {#if isAbsolute && activeRect}
        <div class="coordinates">
          {#each [['x', 'X %'], ['y', 'Y %'], ['w', 'Width %'], ['h', 'Height %']] as [key, label] (key)}
            <label>{label}
              <input type="number" min="-10" max="120" step="0.5" value={activeRect[key as keyof RegionRect]}
                     onchange={(event) => setRect(key as keyof RegionRect, Number(event.currentTarget.value) || 0)} />
            </label>
          {/each}
        </div>
      {:else if selected !== 'field'}
        <div class="coordinates">
          {#each [['rowStart', 'Row from'], ['rowEnd', 'Row to'], ['columnStart', 'Column from'], ['columnEnd', 'Column to']] as [key, label] (key)}
            <label>{label}
              <select value={activeArea[key as Coordinate]} onchange={(event) => setCoordinate(key as Coordinate, Number(event.currentTarget.value))}>
                {#each Array.from({ length: 15 }, (_, index) => index + 1) as value (value)}<option value={value}>{value}</option>{/each}
              </select>
            </label>
          {/each}
        </div>
      {/if}
      <label>Z-index
        <input type="number" step="1" value={hudDraft[selected].z}
               title="0 keeps the region's shipped stacking layer; any other number overrides it"
               onchange={(event) => setZ(Number(event.currentTarget.value))} />
      </label>
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
    <div class="inspector-spacer" aria-hidden="true"></div>
    <button class="apply" disabled={!!issue} onclick={applyLayout}>Apply layout</button>
  </aside>
</div>

<style>
  .layout-editor {
    display: grid;
    grid-template-columns: minmax(clamp(113px, 8.71vw, 243px), .75fr) minmax(0, 3fr) minmax(clamp(125px, 9.68vw, 270px), .85fr);
    gap: var(--spacing-sm);
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
  .layout-palette, .layout-workspace, .layout-inspector { min-width: 0; min-height: 0; }
  .layout-palette, .layout-inspector { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  h3 { margin: 0; font-size: var(--font-xs); }
  .layer-switch { display: flex; gap: var(--spacing-xs); }
  .layer-switch button { flex: 1; font-size: var(--font-xs); }
  .layer-switch .picked { color: var(--gold-lit); border-color: var(--gold); }
  .component-list { display: grid; flex: 1; align-content: start; gap: var(--spacing-xs); min-height: 0; }
  .component {
    display: grid; grid-template-columns: var(--icon-detail) minmax(0, 1fr) auto; align-items: center; gap: var(--spacing-xs);
    min-width: 0; text-align: left; font-size: var(--font-xs); color: var(--text);
  }
  .component i { width: var(--icon-detail); height: var(--icon-detail); border: 1px solid var(--region-tone); background: color-mix(in srgb, var(--region-tone) 22%, transparent); }
  .component span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .component.selected { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 10%, var(--panel)); }
  .editor-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-xs); min-width: 0; }
  .editor-actions button { min-width: 0; }
  .editor-actions .layout-import { grid-column: 1 / -1; }
  .editor-actions button, .apply { font-size: var(--font-xs); }
  .layout-import { display: grid; gap: var(--spacing-xs); min-width: 0; color: var(--dim); font-size: var(--font-xs); }
  .layout-import input { min-width: 0; max-width: 100%; font-size: var(--font-xs); }
  .layout-workspace { display: flex; flex-direction: column; justify-content: center; gap: var(--spacing-xs); }
  .canvas-heading { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-xs); }
  .canvas-heading span, .layout-inspector p { margin: 0; color: var(--dim); font-size: var(--font-xs); line-height: 1.35; }
  .layout-inspector .editor-help { padding-top: var(--spacing-xs); border-top: 1px solid var(--edge); }
  .layout-inspector .editor-help strong { color: var(--text); }
  .layout-grid {
    display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); grid-template-rows: repeat(15, minmax(0, 1fr));
    position: relative;
    width: 100%; max-height: 100%; aspect-ratio: 16 / 9; align-self: center; min-height: 0; border: 1px solid var(--hud-edge); background: var(--bg);
  }
  .grid-cell {
    display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between;
    min-width: 0; min-height: 0; border-radius: var(--radius-card); border-top: 0; border-left: 0;
    background: transparent; text-align: left; color: var(--dim);
  }
  .grid-cell small { font: var(--font-xs) / 1 var(--num); opacity: .7; }
  .region-caption {
    display: grid; place-items: center; z-index: var(--z-content); pointer-events: none; overflow: hidden;
    padding: var(--spacing-xs); color: var(--region-tone); font-size: var(--font-xs); font-weight: 700;
    line-height: 1; letter-spacing: .02em; text-shadow: 0 1px 2px var(--bg);
  }
  .grid-cell.occupied { background: color-mix(in srgb, var(--region-tone) 14%, transparent); border-color: color-mix(in srgb, var(--region-tone) 55%, var(--line)); }
  .abs-caption {
    position: absolute; z-index: var(--z-popover); display: flex; align-items: center; justify-content: center; gap: 4px;
    border: 1px dashed var(--region-tone); background: color-mix(in srgb, var(--region-tone) 10%, transparent);
  }
  .abs-caption em { font-style: normal; font-size: calc(var(--font-xs) * .85); color: var(--dim); }
  .component .abs-tag { font-style: normal; font-size: var(--font-xs); color: var(--dim); }
  .abs-list { margin: 0; color: var(--dim); font-size: var(--font-xs); line-height: 1.35; }
  .abs-list strong { color: var(--text); }
  .grid-cell.selected { box-shadow: inset 0 0 0 1px var(--gold); background: color-mix(in srgb, var(--gold) 20%, var(--region-tone)); }
  .grid-cell:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; z-index: var(--z-underlay); }
  .coordinates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-xs); }
  .layout-inspector label { display: grid; gap: var(--spacing-xs); color: var(--dim); font-size: var(--font-xs); }
  .layout-inspector select { min-width: 0; padding: var(--spacing-xs); font-size: var(--font-xs); }
  .inspector-spacer { flex: 1; min-height: 0; }
  .apply { color: var(--gold-lit); border-color: var(--gold); }
  .apply:disabled { opacity: .45; }
  .notice, .issue { margin: 0; font-size: var(--font-xs); }
  .notice { color: var(--good-lit); }
  .issue { color: var(--alarm); }
</style>
