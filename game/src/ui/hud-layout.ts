export type HudRegionId = 'objectives' | 'target' | 'menu' | 'travel' | 'field' | 'panels' | 'feed' | 'actionbar' | 'controls';
export type GridAlign = 'start' | 'center' | 'end' | 'stretch';

export type GridArea = {
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
};

export type HudRegion = {
  id: HudRegionId;
  label: string;
  area: GridArea;
  justify: GridAlign;
  align: GridAlign;
};

export type HudLayout = Record<HudRegionId, HudRegion>;

export const HUD_LAYOUT_STORAGE_KEY = 'modworld.hud-layout.v1';

export const HUD_REGION_META: Pick<HudRegion, 'id' | 'label'>[] = [
  { id: 'objectives', label: 'Minimap & objectives' },
  { id: 'target', label: 'Target bar' },
  { id: 'menu', label: 'Menu rail' },
  { id: 'travel', label: 'Travel controls' },
  { id: 'field', label: 'Combat field' },
  { id: 'panels', label: 'Field panels' },
  { id: 'feed', label: 'Chronicle' },
  { id: 'actionbar', label: 'Vitals, skills & EXP' },
  { id: 'controls', label: 'Game controls' },
];

export const DEFAULT_HUD_LAYOUT: HudLayout = {
  objectives: { id: 'objectives', label: 'Minimap & objectives', area: { rowStart: 1, rowEnd: 5, columnStart: 1, columnEnd: 2 }, justify: 'start', align: 'start' },
  target: { id: 'target', label: 'Target bar', area: { rowStart: 1, rowEnd: 2, columnStart: 6, columnEnd: 10 }, justify: 'center', align: 'center' },
  menu: { id: 'menu', label: 'Menu rail', area: { rowStart: 1, rowEnd: 1, columnStart: 12, columnEnd: 15 }, justify: 'end', align: 'start' },
  travel: { id: 'travel', label: 'Travel controls', area: { rowStart: 7, rowEnd: 8, columnStart: 1, columnEnd: 1 }, justify: 'start', align: 'center' },
  field: { id: 'field', label: 'Combat field', area: { rowStart: 3, rowEnd: 11, columnStart: 4, columnEnd: 12 }, justify: 'stretch', align: 'stretch' },
  panels: { id: 'panels', label: 'Field panels', area: { rowStart: 2, rowEnd: 6, columnStart: 13, columnEnd: 15 }, justify: 'stretch', align: 'stretch' },
  feed: { id: 'feed', label: 'Chronicle', area: { rowStart: 11, rowEnd: 14, columnStart: 1, columnEnd: 2 }, justify: 'stretch', align: 'stretch' },
  actionbar: { id: 'actionbar', label: 'Vitals, skills & EXP', area: { rowStart: 12, rowEnd: 15, columnStart: 5, columnEnd: 11 }, justify: 'stretch', align: 'stretch' },
  controls: { id: 'controls', label: 'Game controls', area: { rowStart: 15, rowEnd: 15, columnStart: 12, columnEnd: 15 }, justify: 'end', align: 'stretch' },
};

export const DEFAULT_MODAL_AREA: GridArea = { rowStart: 2, rowEnd: 14, columnStart: 3, columnEnd: 13 };

const regionIds = HUD_REGION_META.map(({ id }) => id);

export function copyHudLayout(layout: Partial<HudLayout> = DEFAULT_HUD_LAYOUT): HudLayout {
  return Object.fromEntries(regionIds.map((id) => {
    const region = layout[id] ?? DEFAULT_HUD_LAYOUT[id];
    return [id, { ...region, area: { ...region.area } }];
  })) as HudLayout;
}

export function validGridArea(area: GridArea): boolean {
  return [area.rowStart, area.rowEnd, area.columnStart, area.columnEnd]
    .every((coordinate) => Number.isInteger(coordinate) && coordinate >= 1 && coordinate <= 15)
    && area.rowStart <= area.rowEnd && area.columnStart <= area.columnEnd;
}

export function validateHudLayout(layout: HudLayout): string | null {
  const occupied = new Map<string, HudRegionId>();
  for (const id of regionIds) {
    const region = layout[id];
    if (!region || !validGridArea(region.area)) return `${region?.label || id} goes outside the grid.`;
    if (!['start', 'center', 'end', 'stretch'].includes(region.justify) || !['start', 'center', 'end', 'stretch'].includes(region.align)) {
      return `${region.label} has an invalid alignment.`;
    }
    const { rowStart, rowEnd, columnStart, columnEnd } = region.area;
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let column = columnStart; column <= columnEnd; column++) {
        const cell = `${row}:${column}`;
        const prior = occupied.get(cell);
        if (prior && prior !== id) return `${layout[prior].label} overlaps ${region.label} at ${String.fromCharCode(64 + row)}${column}.`;
        occupied.set(cell, id);
      }
    }
  }
  return null;
}

export function hudGridTemplate(layout: HudLayout): string {
  const rows: string[] = ['"' + Array(17).fill('.').join(' ') + '"'];
  for (let row = 1; row <= 15; row++) {
    const cells = Array(15).fill('.');
    for (const id of regionIds) {
      const area = layout[id].area;
      if (row < area.rowStart || row > area.rowEnd) continue;
      for (let column = area.columnStart; column <= area.columnEnd; column++) cells[column - 1] = id;
    }
    rows.push('"' + ['.', ...cells, '.'].join(' ') + '"');
  }
  rows.push('"' + Array(17).fill('.').join(' ') + '"');
  return rows.join(' ');
}

/** Convert one-based inclusive grid cells into CSS grid-line coordinates. */
export function gridAreaCss(area: GridArea, outerGutter = false): string {
  const offset = outerGutter ? 1 : 0;
  return `${area.rowStart + offset} / ${area.columnStart + offset} / ${area.rowEnd + offset + 1} / ${area.columnEnd + offset + 1}`;
}

export function moveGridArea(area: GridArea, row: number, column: number): GridArea {
  const height = area.rowEnd - area.rowStart;
  const width = area.columnEnd - area.columnStart;
  const rowStart = Math.min(15 - height, Math.max(1, row));
  const columnStart = Math.min(15 - width, Math.max(1, column));
  return { rowStart, rowEnd: rowStart + height, columnStart, columnEnd: columnStart + width };
}
