export type HudRegionId = 'objectives' | 'target' | 'menu' | 'travel' | 'field' | 'panels' | 'commands' | 'feed' | 'actionbar';
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

export const HUD_LAYOUT_STORAGE_KEY = 'modworld.hud-layout.v6';
export const HUD_LAYOUT_PREVIOUS_STORAGE_KEYS = ['modworld.hud-layout.v5', 'modworld.hud-layout.v4', 'modworld.hud-layout.v3', 'modworld.hud-layout.v2', 'modworld.hud-layout.v1'] as const;
export const HUD_LAYOUT_VERSION = 6;

const HUD_LAYOUT_V4_STOCK_AREAS: Record<'target' | 'menu' | 'panels', GridArea> = {
  target: { rowStart: 1, rowEnd: 2, columnStart: 6, columnEnd: 10 },
  menu: { rowStart: 1, rowEnd: 1, columnStart: 11, columnEnd: 15 },
  panels: { rowStart: 2, rowEnd: 6, columnStart: 13, columnEnd: 14 },
};

const HUD_LAYOUT_V5_STOCK_AREAS: Record<'target' | 'menu' | 'panels', GridArea> = {
  target: { rowStart: 1, rowEnd: 2, columnStart: 3, columnEnd: 6 },
  menu: { rowStart: 1, rowEnd: 1, columnStart: 7, columnEnd: 15 },
  panels: { rowStart: 2, rowEnd: 6, columnStart: 13, columnEnd: 14 },
};

export const HUD_REGION_META: { id: HudRegionId; label: string; description: string }[] = [
  { id: 'objectives', label: 'Minimap & objectives', description: 'Minimap, current location, tracked delivery wants and the live phase. The run\'s target is the Chronicle\'s Objectives tab; the life-skill rungs are the Sheet\'s Life skills tab.' },
  { id: 'target', label: 'Target bar', description: 'Current enemy name and health bar, centered over the combat field.' },
  { id: 'menu', label: 'Menu rail', description: 'Main screen navigation, field automation controls (Auto Skills, Auto Equip, Camp), and More; wraps in the right top band.' },
  { id: 'travel', label: 'Travel controls', description: 'Stay Here, Forward, and map tools when the map is open.' },
  { id: 'field', label: 'Combat field', description: 'Mob and player cards with HP/ES/Mana/EXP; buff badges sit outside on the right and debuffs on the left. The You card stays at the original near-field edge and remains visible on the map.' },
  { id: 'panels', label: 'Field panels', description: 'Contextual overlays such as point allocation, in the right-middle area below the menu rail.' },
  { id: 'commands', label: 'Game controls', description: 'Speed ×1/×2/×4 and Pause/Resume as one row of tabs in the bottom-right block (rows 14–15, columns 12–15), hugging the region\'s right edge.' },
  { id: 'feed', label: 'Chronicle', description: 'The combat, loot and system feed with its filters, plus the Objectives tab: the run\'s target.' },
  { id: 'actionbar', label: 'Vitals & skills', description: 'Health and mana orbs and 14 skill slots.' },
];

export const DEFAULT_HUD_LAYOUT: HudLayout = {
  objectives: { id: 'objectives', label: 'Minimap & objectives', area: { rowStart: 1, rowEnd: 5, columnStart: 1, columnEnd: 2 }, justify: 'start', align: 'start' },
  target: { id: 'target', label: 'Target bar', area: { rowStart: 1, rowEnd: 2, columnStart: 6, columnEnd: 9 }, justify: 'center', align: 'center' },
  menu: { id: 'menu', label: 'Menu rail', area: { rowStart: 1, rowEnd: 1, columnStart: 10, columnEnd: 15 }, justify: 'end', align: 'start' },
  travel: { id: 'travel', label: 'Travel controls', area: { rowStart: 7, rowEnd: 8, columnStart: 1, columnEnd: 1 }, justify: 'start', align: 'center' },
  field: { id: 'field', label: 'Combat field', area: { rowStart: 3, rowEnd: 11, columnStart: 4, columnEnd: 12 }, justify: 'stretch', align: 'stretch' },
  panels: { id: 'panels', label: 'Field panels', area: { rowStart: 7, rowEnd: 11, columnStart: 13, columnEnd: 15 }, justify: 'stretch', align: 'stretch' },
  commands: { id: 'commands', label: 'Game controls', area: { rowStart: 14, rowEnd: 15, columnStart: 12, columnEnd: 15 }, justify: 'end', align: 'stretch' },
  feed: { id: 'feed', label: 'Chronicle', area: { rowStart: 11, rowEnd: 15, columnStart: 1, columnEnd: 3 }, justify: 'stretch', align: 'stretch' },
  actionbar: { id: 'actionbar', label: 'Vitals & skills', area: { rowStart: 12, rowEnd: 15, columnStart: 5, columnEnd: 11 }, justify: 'stretch', align: 'stretch' },
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
  if (!area || typeof area !== 'object') return false;
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

function sameArea(value: unknown, expected: GridArea): boolean {
  if (!value || typeof value !== 'object') return false;
  const area = value as GridArea;
  return area.rowStart === expected.rowStart && area.rowEnd === expected.rowEnd
    && area.columnStart === expected.columnStart && area.columnEnd === expected.columnEnd;
}

/** Reflow only unchanged stock regions; a player's edited HUD placement is theirs to keep. */
function reflowStockRegions(hud: HudLayout, rawHud: any, version: number): boolean {
  const previous = version === 5 ? HUD_LAYOUT_V5_STOCK_AREAS : version < 5 ? HUD_LAYOUT_V4_STOCK_AREAS : null;
  if (!previous) return false;
  let reflowed = false;
  for (const id of ['target', 'menu', 'panels'] as const) {
    if (!sameArea(rawHud?.[id]?.area, previous[id])) continue;
    hud[id].area = { ...DEFAULT_HUD_LAYOUT[id].area };
    reflowed = true;
  }
  return reflowed;
}

export interface MigratedHudLayout { hud: HudLayout; modal: GridArea; notice: string | null; version: number }

/** Parse exports and normalize layouts that placed vitals or controls in retired HUD regions. */
export function migrateHudLayout(input: string | unknown): MigratedHudLayout {
  const parsed: any = typeof input === 'string' ? JSON.parse(input) : input;
  if (!parsed || typeof parsed !== 'object' || ![1, 2, 3, 4, 5, HUD_LAYOUT_VERSION].includes(parsed.version)) throw new Error('Unsupported HUD layout version.');
  const rawHud = parsed.hud;
  if (!rawHud || typeof rawHud !== 'object') throw new Error('HUD layout is missing its region map.');
  if (!validGridArea(parsed.modal || DEFAULT_MODAL_AREA)) throw new Error('HUD layout has an invalid panel area.');
  const hud = copyHudLayout(DEFAULT_HUD_LAYOUT);
  for (const { id } of HUD_REGION_META) {
    const saved = rawHud[id];
    if (saved && validGridArea(saved.area) && ['start', 'center', 'end', 'stretch'].includes(saved.justify) && ['start', 'center', 'end', 'stretch'].includes(saved.align)) {
      hud[id] = { ...hud[id], ...saved, id, area: { ...saved.area } };
    }
  }
  const reflowedDefaults = parsed.version < HUD_LAYOUT_VERSION && reflowStockRegions(hud, rawHud, parsed.version);
  let notice: string | null = typeof parsed.notice === 'string' ? parsed.notice : null;
  if (parsed.version < HUD_LAYOUT_VERSION && (rawHud.controls || rawHud.player || rawHud.automation)) {
    notice = `Automation now sits in the top menu rail; speed and Pause/Resume sit in the bottom-right Game controls row. You, Hunger and vitals stay in the combat scene; its Field region moves the card.${reflowedDefaults ? ' Stock HUD regions were moved to make room for the wrapped menu rail.' : ''}`;
  } else if (reflowedDefaults) {
    notice = 'Stock HUD regions were updated for the wrapped menu rail; custom placements stay put.';
  }
  const issue = validateHudLayout(hud);
  if (issue) throw new Error(`HUD layout cannot be migrated: ${issue}`);
  return { hud, modal: { ...(parsed.modal || DEFAULT_MODAL_AREA) }, notice, version: HUD_LAYOUT_VERSION };
}

/**
 * Best-effort recovery when the strict migration refuses a file: keep every saved region that fits
 * without overlapping the regions already kept, default the rest, and never throw. A corrupt or
 * hand-edited export loses the conflicting placements only — never the whole custom layout.
 */
export function salvageHudLayout(input: string | unknown): MigratedHudLayout {
  let parsed: any = null;
  try { parsed = typeof input === 'string' ? JSON.parse(input) : input; } catch { parsed = null; }
  const hud = copyHudLayout(DEFAULT_HUD_LAYOUT);
  const rawHud = parsed && typeof parsed === 'object' && parsed.hud && typeof parsed.hud === 'object' ? parsed.hud : null;
  let kept = 0;
  if (rawHud) {
    for (const { id } of HUD_REGION_META) {
      const saved = rawHud[id];
      if (!saved || !validGridArea(saved.area)) continue;
      const candidate: HudRegion = { ...hud[id], ...saved, id, area: { ...saved.area } };
      if (validateHudLayout({ ...hud, [id]: candidate })) continue;
      hud[id] = candidate;
      kept++;
    }
  }
  const reflowedDefaults = Number(parsed?.version) < HUD_LAYOUT_VERSION && reflowStockRegions(hud, rawHud, Number(parsed?.version));
  const modal = parsed && validGridArea(parsed.modal) ? { ...parsed.modal } : { ...DEFAULT_MODAL_AREA };
  const defaulted = HUD_REGION_META.length - kept;
  const hadRetiredPlacement = !!(rawHud?.controls || rawHud?.player || rawHud?.automation);
  return {
    hud, modal, version: HUD_LAYOUT_VERSION,
    notice: defaulted > 0 ? `The saved HUD layout could not be read whole — ${kept} region${kept === 1 ? '' : 's'} kept, ${defaulted} reset to defaults. Rearrange them in Studio.`
      : hadRetiredPlacement ? `Automation now rides the top menu rail and the Game controls sit in the bottom-right row; the vital card stays in the combat scene.${reflowedDefaults ? ' Stock HUD regions were moved to make room for the wrapped menu rail.' : ''}`
        : reflowedDefaults ? 'Stock HUD regions were updated for the wrapped menu rail; custom HUD placements stay put.' : null,
  };
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
