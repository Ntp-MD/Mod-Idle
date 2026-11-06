import type { FieldSite, GameState } from '@sim/core/types';
import { currentCell, cellsTo, rankOf, trailCells, walkedCells } from '@sim/world/road';
import { settlementById } from '@sim/town/town';
import { hexDistance, hexKey, mapKnowledge, trailSiteKind, trailSites, type MapKnowledge } from '@sim/world/map-exploration';
import { E, eng } from '../../engine/client';
import { adventureView, type AdventureView } from './map-adventure';

import type { MapPoint } from './map-camera';

/** The band ramp: dark green at the first band of levels, deep red at the last. */
export const ramp = (band: number) => {
  const t = band / (E.mob.zones.length - 1);
  return `hsl(${Math.round(94 - 82 * t)} 36% ${Math.round(20 + 20 * t)}%)`;
};

/** What a cell is called, read off the sheet's own marks. */
export function cellLabel(node: Element): Picked {
  const ax = (node.getAttribute('data-ax') || '0,0').split(',').map(Number);
  const key = node.getAttribute('data-cell') || '';
  const sub = node.getAttribute('data-sub');
  const site = node.getAttribute('data-site') as FieldSite | null;
  const id = node.getAttribute('data-node');
  const terrain = node.getAttribute('data-terrain');
  const h = { q: ax[0], r: ax[1] };
  if (id && rankOf(h) === 0) return { key, q: h.q, r: h.r, kind: 'town', label: settlementById(id)!.name, sub: null, site: null, terrain, nodeId: id };
  if (id && sub != null) {
    const s = settlementById(id)!;
    return { key, q: h.q, r: h.r, kind: 'sub', label: (eng.zoneById(s.zone).subzones || [])[Number(sub)]?.name || '', sub: Number(sub), site: null, terrain, nodeId: id };
  }
  if (id && site != null) {
    const s = settlementById(id)!;
    const label = site === 'dungeon' ? `${s.name} Wild Side · Dungeon`
      : site === 'mine' ? `${s.name} Wild Side · Mine`
        : site === 'grove' ? `${s.name} Wild Side · Grove` : `${s.name} Wild Side · Fishing`;
    return { key, q: h.q, r: h.r, kind: 'bare', site, label, sub: null, terrain, nodeId: id };
  }
  return { key, q: h.q, r: h.r, kind: 'bare', label: `Hunting Ground · ${key}`, sub: null, site: null, terrain };
}

/** Axial identity is the world key below the SVG; display keys such as A1 are presentation. */
export type AxialKey = `${number},${number}`;

export type PickedKind = 'town' | 'sub' | 'bare';
/** The clicked cell's presentation identity: its display key is not world identity. */
export interface Picked {
  key: string;
  q: number;
  r: number;
  kind: PickedKind;
  label: string;
  sub: number | null;
  site: FieldSite | null;
  terrain: string | null;
  /** The owning settlement when the sheet names one; display/selection support only. */
  nodeId?: string | null;
}

export interface MapViewOptions {
  view: 'terrain' | 'band' | 'gate';
  gateLevel: number;
  showIds: boolean;
  showWalk: boolean;
  townId: string;
  showNames: boolean;
  cleanMap: boolean;
  showHexCalibration: boolean;
}

export interface MapStaticCell {
  ax: AxialKey;
  picked: Picked;
  nodeId: string | null;
  zone: number | null;
  originalTitle: string;
  tone: string;
  edgeOpacity: number;
  band: number | null;
  center: MapPoint;
  radius: number;
  points: readonly MapPoint[];
  anchor: boolean;
}

export interface MapPaintInput {
  state: GameState;
  cells: readonly MapStaticCell[];
  selected: Picked | null;
  options: MapViewOptions;
}

export interface MapLabel {
  ax: AxialKey;
  key: string;
  name: string;
  levelText: string;
  kind: PickedKind;
  discovery: MapKnowledge;
  standing: boolean;
}

export interface MapPaintModel {
  surface: {
    options: MapViewOptions;
    playerAx: AxialKey;
    selectedAx: AxialKey | null;
    campAx: AxialKey | null;
    selectedTown: string | null;
    hereTown: string | null;
    targetTown: string | null;
    pinHereAx: AxialKey | null;
    pinTargetAx: AxialKey | null;
    walking: boolean;
    route: readonly AxialKey[];
    walked: readonly AxialKey[];
    cells: readonly { ax: AxialKey; fill: string; opacity: number; locked: boolean }[];
  };
  adventure: AdventureView;
  labels: readonly MapLabel[];
}

/** Live danger reads the authored placement pool; a missing or unreadable zone has no band. */
export function placementPoolBounds(zone: number | null, subzone: number | null): { lo: number; hi: number } | null {
  if (zone == null) return null;
  try {
    const rows = eng.placementsIn(zone, subzone != null ? subzone + 1 : undefined) as any[];
    if (!rows.length) return null;
    return { lo: Math.min(...rows.map((row) => row.level)), hi: Math.max(...rows.map((row) => row.level)) };
  } catch {
    return null;
  }
}

function adventureCell(cell: MapStaticCell) {
  const zone = cell.zone;
  const subzone = cell.picked.kind === 'sub' && cell.picked.sub != null ? cell.picked.sub : undefined;
  const species = zone != null && subzone != null ? eng.zoneById(zone).subzones?.[subzone]?.species || [] : [];
  const unique = species.find((id) => eng.uniquesOf(id, zone!).length > 0);
  return {
    ax: cell.ax,
    q: Number(cell.ax.split(',')[0]),
    r: Number(cell.ax.split(',')[1]),
    town: cell.picked.kind === 'town' ? cell.nodeId : null,
    sub: cell.picked.kind === 'sub',
    zone: zone ?? undefined,
    subzone,
    site: cell.picked.site ?? undefined,
    uniqueSpecies: unique,
  };
}

/**
 * Pure map read: the ship builds this before any paint frame, so deep reactive reads happen inside
 * Svelte's dependency tracking and a painter never re-reads GameState. No DOM, no mutation.
 */
export function buildMapPaintModel(input: MapPaintInput): MapPaintModel {
  const { state, cells, selected, options } = input;
  const feet = currentCell(state);
  const playerAx = hexKey(feet) as AxialKey;
  const selectedAx = selected ? (`${selected.q},${selected.r}` as AxialKey) : null;
  const camp = state.fieldwork?.camp?.cell ?? null;
  const walk = state.walk;
  const cellByAx = new Map(cells.map((cell) => [cell.ax, cell]));
  const selectedTown = selectedAx ? cellByAx.get(selectedAx)?.nodeId ?? null : null;
  const hereTown = !walk && rankOf(feet) === 0 ? options.townId : null;
  const targetTown = walk && walk.kind === 'town' ? walk.node : null;
  const townCell = (id: string | null) => {
    if (!id) return null;
    const owned = cells.filter((cell) => cell.nodeId === id);
    return owned.find((cell) => cell.picked.kind === 'town') ?? owned[0] ?? null;
  };
  const routeKeys = (walk ? trailCells(state)
    : selected ? cellsTo(state, { q: selected.q, r: selected.r }) : []) as AxialKey[];
  const walkedKeys = (walk ? walkedCells(state) : []) as AxialKey[];
  const walkedSet = new Set(walkedKeys);

  const surfaceCells = cells.map((cell) => {
    const bounds = placementPoolBounds(cell.zone, cell.picked.kind === 'sub' && cell.picked.sub != null ? cell.picked.sub : null);
    const fill = options.view === 'terrain' ? cell.tone || 'none'
      : cell.band == null ? 'none' : ramp(cell.band);
    return {
      ax: cell.ax,
      fill,
      opacity: options.view === 'terrain' ? cell.edgeOpacity : 1,
      locked: options.view !== 'terrain' && options.view !== 'band' && bounds != null && options.gateLevel < bounds.lo,
    };
  });

  const trail = new Map(trailSites(state).map((site) => [hexKey(site), { site, claimed: !!state.mapJournal?.claimedSites?.includes(site.id), kind: trailSiteKind(site) }]));
  const adventureCells = cells.map(adventureCell);
  const adventure = adventureView(state, adventureCells);
  const placementLabels = new Map<string, string[]>();
  for (const placement of adventure.placements) {
    const list = placementLabels.get(placement.ax) ?? [];
    list.push(placement.label);
    placementLabels.set(placement.ax, list);
  }
  const labels: MapLabel[] = cells.map((cell) => {
    const discovery = mapKnowledge(state, adventureCells[cells.indexOf(cell)]);
    const trailEntry = trail.get(cell.ax);
    const placements = placementLabels.get(cell.ax) ?? [];
    const titled = cell.originalTitle.replace(/\s*·\s*Lv\s*\d+[–-]\d+\s*$/, '');
    const base = discovery === 'unknown'
      ? (cell.picked.kind === 'town' ? cell.picked.label : 'Unexplored ground')
      : trailEntry
        ? trailEntry.kind.name + (trailEntry.claimed ? ' · explored' : '')
        : cell.picked.kind === 'bare' ? titled : cell.picked.label;
    const name = discovery === 'unknown' ? base : [base, ...placements].join(' · ');
    const bounds = placementPoolBounds(cell.zone, cell.picked.kind === 'sub' && cell.picked.sub != null ? cell.picked.sub : null);
    return {
      ax: cell.ax,
      key: cell.picked.key,
      name,
      levelText: discovery === 'unknown' || !bounds ? '' : bounds.lo === bounds.hi ? `Lv ${bounds.lo}` : `Lv ${bounds.lo}–${bounds.hi}`,
      kind: cell.picked.kind,
      discovery,
      standing: cell.ax === playerAx,
    };
  });

  return {
    surface: {
      options: { ...options },
      playerAx,
      selectedAx,
      campAx: camp ? (hexKey(camp) as AxialKey) : null,
      selectedTown,
      hereTown,
      targetTown,
      pinHereAx: (townCell(hereTown)?.ax ?? null) as AxialKey | null,
      pinTargetAx: (townCell(targetTown)?.ax ?? null) as AxialKey | null,
      walking: !!walk,
      route: routeKeys,
      walked: walkedKeys,
      cells: surfaceCells,
    },
    adventure,
    labels,
  };
}

/** The axial key of one cell, so the input controller can compare cached neighbours. */
export const axialOf = (cell: MapStaticCell): AxialKey => cell.ax;
/** Segment identity is the axial key; a display key is never world identity. */
export const axialDistance = (a: AxialKey, b: AxialKey): number => {
  const [aq, ar] = a.split(',').map(Number);
  const [bq, br] = b.split(',').map(Number);
  return hexDistance({ q: aq, r: ar }, { q: bq, r: br });
};
