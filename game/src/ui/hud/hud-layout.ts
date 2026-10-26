export type HudRegionId = 'objectives' | 'tasks' | 'target' | 'menu' | 'field' | 'commands' | 'feed' | 'actionbar';
export type GridAlign = 'start' | 'center' | 'end' | 'stretch';
export type HudPlacement = 'grid' | 'absolute';

export type GridArea = {
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
};

/** A free box over the stage, in percent of the stage's width and height. */
export type RegionRect = { x: number; y: number; w: number; h: number };

export type HudRegion = {
  id: HudRegionId;
  label: string;
  area: GridArea;
  justify: GridAlign;
  align: GridAlign;
  /** `absolute` lifts the region off the grid: a free box with its own stacking order */
  mode: HudPlacement;
  rect: RegionRect;
  /** CSS z-index inside the stage; 0 keeps the region in the layer it ships with */
  z: number;
};

export type HudLayout = Record<HudRegionId, HudRegion>;

export const HUD_LAYOUT_STORAGE_KEY = 'modworld.hud-layout.v13';
export const HUD_LAYOUT_PREVIOUS_STORAGE_KEYS = ['modworld.hud-layout.v12', 'modworld.hud-layout.v11', 'modworld.hud-layout.v10', 'modworld.hud-layout.v9', 'modworld.hud-layout.v8', 'modworld.hud-layout.v7', 'modworld.hud-layout.v6', 'modworld.hud-layout.v5', 'modworld.hud-layout.v4', 'modworld.hud-layout.v3', 'modworld.hud-layout.v2', 'modworld.hud-layout.v1'] as const;
export const HUD_LAYOUT_VERSION = 13;

type LegacyJourneyId = 'objectives' | 'panels' | 'travel';
type LegacyRegionId = HudRegionId | LegacyJourneyId;
const LEGACY_JOURNEY_AREAS: Record<LegacyJourneyId, GridArea[]> = {
  objectives: [
    { rowStart: 1, rowEnd: 3, columnStart: 1, columnEnd: 4 },
    { rowStart: 1, rowEnd: 4, columnStart: 1, columnEnd: 3 },
    { rowStart: 1, rowEnd: 5, columnStart: 1, columnEnd: 2 },
  ],
  panels: [
    { rowStart: 6, rowEnd: 10, columnStart: 1, columnEnd: 4 },
    { rowStart: 7, rowEnd: 10, columnStart: 1, columnEnd: 3 },
    { rowStart: 7, rowEnd: 11, columnStart: 13, columnEnd: 15 },
    { rowStart: 2, rowEnd: 6, columnStart: 13, columnEnd: 14 },
  ],
  travel: [
    { rowStart: 4, rowEnd: 5, columnStart: 1, columnEnd: 4 },
    { rowStart: 5, rowEnd: 6, columnStart: 1, columnEnd: 3 },
    { rowStart: 7, rowEnd: 8, columnStart: 1, columnEnd: 1 },
  ],
};

const HUD_LAYOUT_V9_STOCK_AREAS = {
  commands: { rowStart: 14, rowEnd: 15, columnStart: 12, columnEnd: 15 },
} satisfies Partial<Record<LegacyRegionId, GridArea>>;

const HUD_LAYOUT_V8_STOCK_AREAS = {
  field: { rowStart: 3, rowEnd: 10, columnStart: 4, columnEnd: 12 },
  actionbar: { rowStart: 12, rowEnd: 15, columnStart: 5, columnEnd: 11 },
} satisfies Partial<Record<LegacyRegionId, GridArea>>;

const HUD_LAYOUT_V7_STOCK_AREAS = {
  feed: { rowStart: 11, rowEnd: 15, columnStart: 1, columnEnd: 3 },
  field: { rowStart: 3, rowEnd: 11, columnStart: 4, columnEnd: 12 },
} satisfies Partial<Record<LegacyRegionId, GridArea>>;

const HUD_LAYOUT_V6_STOCK_AREAS = {
  objectives: { rowStart: 1, rowEnd: 5, columnStart: 1, columnEnd: 2 },
  target: { rowStart: 1, rowEnd: 2, columnStart: 6, columnEnd: 9 },
  menu: { rowStart: 1, rowEnd: 1, columnStart: 10, columnEnd: 15 },
  travel: { rowStart: 7, rowEnd: 8, columnStart: 1, columnEnd: 1 },
  panels: { rowStart: 7, rowEnd: 11, columnStart: 13, columnEnd: 15 },
} satisfies Partial<Record<LegacyRegionId, GridArea>>;

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
  { id: 'objectives', label: 'Journey', description: 'Current location and status stay visible above one scrolling body for the selected hex, travel tools and map controls.' },
  { id: 'tasks', label: 'Objectives', description: 'Run goal and tracked delivery progress at the upper right. The delivery header remains available when its list collapses.' },
  { id: 'target', label: 'Target bar', description: 'Current enemy name and health bar, centered over the combat field.' },
  { id: 'menu', label: 'Menu rail', description: 'Horizontal screen navigation slides into the right edge. The remaining header names the current screen and opens the same buttons again.' },
  { id: 'field', label: 'Combat field', description: 'Absolute combat overlay, always horizontally centered. Rows set vertical bounds; the column span sets width. It may overlap other HUD regions; the player card anchors to its bottom edge.' },
  { id: 'commands', label: 'Game controls', description: 'Horizontal Stay Here / Forward, Auto Skills, Auto Equip, speed and Pause/Resume group in M12–M15 slides into the right edge. The remaining Game controls button reopens it; hover shows travel mode, speed, automation and running state.' },
  { id: 'feed', label: 'Chronicle', description: 'The combat, loot and system feed with its channel filters.' },
  { id: 'actionbar', label: 'Vitals & skills', description: 'Health and mana orbs, 7 item shortcuts over 16 skill slots (8 a row); the experience bar is pinned to the screen bottom edge.' },
];

const STOCK_PLACEMENT = { mode: 'grid', rect: { x: 0, y: 0, w: 20, h: 20 }, z: 0 } as const;

export const DEFAULT_HUD_LAYOUT: HudLayout = {
  objectives: { ...STOCK_PLACEMENT, id: 'objectives', label: 'Journey', area: { rowStart: 1, rowEnd: 10, columnStart: 1, columnEnd: 4 }, justify: 'stretch', align: 'stretch' },
  tasks: { ...STOCK_PLACEMENT, id: 'tasks', label: 'Objectives', area: { rowStart: 3, rowEnd: 8, columnStart: 13, columnEnd: 15 }, justify: 'stretch', align: 'start' },
  target: { ...STOCK_PLACEMENT, id: 'target', label: 'Target bar', area: { rowStart: 1, rowEnd: 2, columnStart: 6, columnEnd: 10 }, justify: 'center', align: 'center' },
  menu: { ...STOCK_PLACEMENT, id: 'menu', label: 'Menu rail', area: { rowStart: 1, rowEnd: 2, columnStart: 11, columnEnd: 15 }, justify: 'end', align: 'start' },
  field: { ...STOCK_PLACEMENT, id: 'field', label: 'Combat field', area: { rowStart: 3, rowEnd: 11, columnStart: 4, columnEnd: 12 }, justify: 'stretch', align: 'stretch' },
  commands: { ...STOCK_PLACEMENT, id: 'commands', label: 'Game controls', area: { rowStart: 13, rowEnd: 15, columnStart: 12, columnEnd: 15 }, justify: 'end', align: 'stretch' },
  feed: { ...STOCK_PLACEMENT, id: 'feed', label: 'Chronicle', area: { rowStart: 11, rowEnd: 15, columnStart: 1, columnEnd: 4 }, justify: 'stretch', align: 'stretch' },
  actionbar: { ...STOCK_PLACEMENT, id: 'actionbar', label: 'Vitals & skills', area: { rowStart: 13, rowEnd: 15, columnStart: 5, columnEnd: 11 }, justify: 'stretch', align: 'stretch' },
};

export const DEFAULT_MODAL_AREA: GridArea = { rowStart: 2, rowEnd: 14, columnStart: 3, columnEnd: 13 };

const regionIds = HUD_REGION_META.map(({ id }) => id);

export function copyHudLayout(layout: Partial<HudLayout> = DEFAULT_HUD_LAYOUT): HudLayout {
  return Object.fromEntries(regionIds.map((id) => {
    const region = layout[id] ?? DEFAULT_HUD_LAYOUT[id];
    return [id, {
      ...region,
      area: { ...region.area },
      mode: region.mode === 'absolute' ? 'absolute' : 'grid',
      rect: { ...validRect(region.rect) ? region.rect : DEFAULT_HUD_LAYOUT[id].rect },
      z: Number.isFinite(region.z) ? Math.round(region.z) : 0,
    }];
  })) as HudLayout;
}

export function validGridArea(area: GridArea): boolean {
  if (!area || typeof area !== 'object') return false;
  return [area.rowStart, area.rowEnd, area.columnStart, area.columnEnd]
    .every((coordinate) => Number.isInteger(coordinate) && coordinate >= 1 && coordinate <= 15)
    && area.rowStart <= area.rowEnd && area.columnStart <= area.columnEnd;
}

export function validRect(rect: RegionRect): boolean {
  return !!rect && typeof rect === 'object'
    && Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.w) && Number.isFinite(rect.h)
    && rect.x >= -10 && rect.x <= 100 && rect.y >= -10 && rect.y <= 100
    && rect.w >= 2 && rect.w <= 120 && rect.h >= 2 && rect.h <= 120;
}

/** The stage style for one region: free placement in absolute mode, grid alignment otherwise. */
export function regionStyleCss(region: HudRegion): string {
  if (region.mode === 'absolute')
    return `position:absolute;left:${region.rect.x}%;top:${region.rect.y}%;width:${region.rect.w}%;height:${region.rect.h}%;z-index:${region.z || 'auto'}`;
  return `justify-self:${region.justify};align-self:${region.align}`;
}

/** Percent box a grid area maps to on the stage — the starting rect when a region goes absolute. */
export function rectFromArea(area: GridArea): RegionRect {
  return {
    x: ((area.columnStart - 1) / 15) * 100,
    y: ((area.rowStart - 1) / 15) * 100,
    w: ((area.columnEnd - area.columnStart + 1) / 15) * 100,
    h: ((area.rowEnd - area.rowStart + 1) / 15) * 100,
  };
}

export function validateHudLayout(layout: HudLayout): string | null {
  const occupied = new Map<string, HudRegionId>();
  for (const id of regionIds) {
    const region = layout[id];
    if (!region || !validGridArea(region.area)) return `${region?.label || id} goes outside the grid.`;
    if (!['start', 'center', 'end', 'stretch'].includes(region.justify) || !['start', 'center', 'end', 'stretch'].includes(region.align)) {
      return `${region.label} has an invalid alignment.`;
    }
    // An absolute region owns a free box, not grid cells; only its rect has to make sense.
    if (region.mode === 'absolute') {
      if (!validRect(region.rect)) return `${region.label} has an invalid free box.`;
      continue;
    }
    // Combat is an absolute overlay, like the modal canvas; it reserves no grid cells.
    if (id === 'field') continue;
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
  const previous: Partial<Record<LegacyRegionId, GridArea>> | null = version === 9 ? HUD_LAYOUT_V9_STOCK_AREAS : version === 8 ? HUD_LAYOUT_V8_STOCK_AREAS : version === 7 ? HUD_LAYOUT_V7_STOCK_AREAS : version === 6 ? HUD_LAYOUT_V6_STOCK_AREAS : version === 5 ? HUD_LAYOUT_V5_STOCK_AREAS : version < 5 ? HUD_LAYOUT_V4_STOCK_AREAS : null;
  let reflowed = false;
  for (const id of regionIds) {
    if (id === 'objectives' || !previous?.[id] || rawHud?.[id]?.mode === 'absolute') continue;
    if (!sameArea(rawHud?.[id]?.area, previous[id]!)) continue;
    if (sameArea(hud[id].area, DEFAULT_HUD_LAYOUT[id].area)) continue;
    hud[id].area = { ...DEFAULT_HUD_LAYOUT[id].area };
    reflowed = true;
  }
  if (previous && sameArea(rawHud?.actionbar?.area, HUD_LAYOUT_V8_STOCK_AREAS.actionbar)
      && !sameArea(hud.actionbar.area, DEFAULT_HUD_LAYOUT.actionbar.area)) {
    hud.actionbar.area = { ...DEFAULT_HUD_LAYOUT.actionbar.area };
    reflowed = true;
  }
  return reflowed;
}

const journeyAnchorOrder: LegacyJourneyId[] = ['objectives', 'panels', 'travel'];
const JOURNEY_MIGRATION_NOTICE = 'Place, travel and destination details now share Journey. Its position follows your previous custom panel when available; other HUD placements were kept.';

function legacyJourneyPlacements(rawHud: any): HudRegion[] {
  return journeyAnchorOrder.flatMap((id) => {
    const saved = rawHud?.[id];
    if (!saved || !validGridArea(saved.area)
        || !['start', 'center', 'end', 'stretch'].includes(saved.justify)
        || !['start', 'center', 'end', 'stretch'].includes(saved.align)) return [];
    return [{ ...DEFAULT_HUD_LAYOUT.objectives, ...saved, id: 'objectives' as const, label: 'Journey', area: { ...saved.area } }];
  });
}

function mergeLegacyJourney(rawHud: any): HudRegion {
  for (const id of journeyAnchorOrder) {
    const saved = rawHud?.[id];
    const placement = legacyJourneyPlacements({ [id]: saved })[0];
    if (!placement) continue;
    const alignment = id === 'panels' ? 'stretch' : 'start';
    const stock = placement.mode !== 'absolute' && !placement.z
      && ((saved.justify === alignment && saved.align === alignment
        && LEGACY_JOURNEY_AREAS[id].some((a) => sameArea(saved.area, a)))
        || (id === 'objectives' && sameArea(saved.area, DEFAULT_HUD_LAYOUT.objectives.area)
          && saved.justify === 'stretch' && saved.align === 'stretch'));
    if (!stock) return placement;
  }
  return copyHudLayout().objectives;
}

/** A wider Journey must not displace a custom neighbour from an older layout. */
function fitLegacyJourney(hud: HudLayout, rawHud: any) {
  if (!validateHudLayout(hud)) return;
  const placements = legacyJourneyPlacements(rawHud);
  const grid = placements.filter((p) => p.mode !== 'absolute');
  const candidates = [...placements];
  if (grid.length) candidates.unshift({
    ...DEFAULT_HUD_LAYOUT.objectives,
    area: {
      rowStart: Math.min(...grid.map((p) => p.area.rowStart)),
      rowEnd: Math.max(...grid.map((p) => p.area.rowEnd)),
      columnStart: Math.min(...grid.map((p) => p.area.columnStart)),
      columnEnd: Math.max(...grid.map((p) => p.area.columnEnd)),
    },
  });
  for (const candidate of candidates) {
    if (!validateHudLayout({ ...hud, objectives: candidate })) {
      hud.objectives = candidate;
      return;
    }
  }
}

export interface MigratedHudLayout { hud: HudLayout; modal: GridArea; notice: string | null; version: number }

/** Parse exports and normalize layouts that placed vitals or controls in retired HUD regions. */
export function migrateHudLayout(input: string | unknown): MigratedHudLayout {
  const parsed: any = typeof input === 'string' ? JSON.parse(input) : input;
  if (!parsed || typeof parsed !== 'object' || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, HUD_LAYOUT_VERSION].includes(parsed.version)) throw new Error('Unsupported HUD layout version.');
  const rawHud = parsed.hud;
  if (!rawHud || typeof rawHud !== 'object') throw new Error('HUD layout is missing its region map.');
  if (!validGridArea(parsed.modal || DEFAULT_MODAL_AREA)) throw new Error('HUD layout has an invalid panel area.');
  const hud = copyHudLayout(DEFAULT_HUD_LAYOUT);
  for (const { id } of HUD_REGION_META) {
    const saved = rawHud[id];
    if (saved && validGridArea(saved.area) && ['start', 'center', 'end', 'stretch'].includes(saved.justify) && ['start', 'center', 'end', 'stretch'].includes(saved.align)) {
      hud[id] = { ...hud[id], ...saved, id, label: DEFAULT_HUD_LAYOUT[id].label, area: { ...saved.area } };
    }
  }
  const legacy = parsed.version < HUD_LAYOUT_VERSION;
  if (legacy) {
    hud.objectives = mergeLegacyJourney(rawHud);
    reflowStockRegions(hud, rawHud, parsed.version);
    fitLegacyJourney(hud, rawHud);
  }
  // normalize placements through the copy: a bad rect or z falls back instead of poisoning the load
  const normalized = copyHudLayout(hud);
  for (const id of regionIds) hud[id] = normalized[id];
  const notice = legacy ? JOURNEY_MIGRATION_NOTICE : typeof parsed.notice === 'string' ? parsed.notice : null;
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
  const legacy = Number.isInteger(parsed?.version) && parsed.version >= 1 && parsed.version < HUD_LAYOUT_VERSION;
  const currentHud = rawHud && legacy ? { ...rawHud, objectives: mergeLegacyJourney(rawHud) } : rawHud;
  let kept = 0;
  if (currentHud) {
    for (const { id } of HUD_REGION_META) {
      const saved = currentHud[id];
      if (!saved || !validGridArea(saved.area)) continue;
      const candidate: HudRegion = { ...hud[id], ...saved, id, label: DEFAULT_HUD_LAYOUT[id].label, area: { ...saved.area } };
      if (validateHudLayout({ ...hud, [id]: candidate })) continue;
      hud[id] = candidate;
      kept++;
    }
  }
  if (legacy) {
    reflowStockRegions(hud, rawHud, parsed.version);
    fitLegacyJourney(hud, rawHud);
  }
  const modal = parsed && validGridArea(parsed.modal) ? { ...parsed.modal } : { ...DEFAULT_MODAL_AREA };
  const defaulted = HUD_REGION_META.length - kept;
  return {
    hud, modal, version: HUD_LAYOUT_VERSION,
    notice: defaulted > 0 ? `The saved HUD layout could not be read whole - ${kept} regions kept, ${defaulted} reset to defaults. Rearrange them in Studio.`
      : legacy ? JOURNEY_MIGRATION_NOTICE : null,
  };
}

export function hudGridTemplate(layout: HudLayout): string {
  const rows: string[] = ['"' + Array(17).fill('.').join(' ') + '"'];
  for (let row = 1; row <= 15; row++) {
    const cells = Array(15).fill('.');
    for (const id of regionIds) {
      if (id === 'field') continue;
      const area = layout[id].area;
      if (layout[id].mode === 'absolute') continue;
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
