/** Read-only state projection; all content, discovery and gameplay queries finish before paint. */
import type { GameState } from '@sim/core/types';
import { currentCell, cellsTo, rankOf, trailCells, walkedCells } from '@sim/world/road';
import { resolveCell } from '@sim/world/travel';
import { hexKey, trailSiteKind, trailSites } from '@sim/world/map-exploration';
import { E, eng } from '../../engine/client';
import { adventureTitle, adventureView, stackAdventurePlacements, uniqueTraceSpecies } from './map-adventure';
import { characterIcon, mobSpeciesArt } from '../../icon';
import type { AxialKey, MapCellIcon, MapCellContent, MapPaintModel, MapStaticCell, MapViewOptions, Picked } from './map-types';

export interface MapPaintInput { state: GameState; cells: readonly MapStaticCell[]; selected: Picked | null; options: MapViewOptions }

/** The band ramp: dark green at the first band of levels, deep red at the last. */
export const ramp = (band: number) => {
  const t = band / (E.mob.zones.length - 1);
  return `hsl(${Math.round(94 - 82 * t)} 36% ${Math.round(20 + 20 * t)}%)`;
};

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
  const unique = zone != null ? uniqueTraceSpecies(species, zone) : undefined;
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
  const walkDest = walk ? resolveCell(walk.to) : null;
  const targetTown = walkDest?.kind === 'town' ? walkDest.ownerId : null;
  const townCell = (id: string | null) => {
    if (!id) return null;
    const owned = cells.filter((cell) => cell.nodeId === id);
    return owned.find((cell) => cell.picked.kind === 'town') ?? owned[0] ?? null;
  };
  const routeKeys = (walk ? trailCells(state)
    : selected ? cellsTo(state, { q: selected.q, r: selected.r }) : []) as AxialKey[];
  const walkedKeys = (walk ? walkedCells(state) : []) as AxialKey[];

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
  const adventure = adventureView(state, adventureCells, selectedAx);
  const stacked = stackAdventurePlacements(adventure.placements);
  const signalByAx = new Map(stacked.map(signal => [signal.ax, signal]));
  const placementLabels = new Map<string, string[]>();
  for (const placement of adventure.placements) {
    const list = placementLabels.get(placement.ax) ?? [];
    list.push(placement.label);
    placementLabels.set(placement.ax, list);
  }
  const markByAx = new Map(adventure.marks.map(mark => [mark.ax, mark]));
  const content: MapCellContent[] = cells.map((cell) => {
    const mark = markByAx.get(cell.ax)!;
    const discovery = mark.discovery;
    const trailEntry = trail.get(cell.ax);
    const placements = placementLabels.get(cell.ax) ?? [];
    const titled = cell.originalTitle.replace(/\s*·\s*Lv\s*\d+[–-]\d+\s*$/, '');
    const base = discovery === 'unknown'
      ? (cell.picked.kind === 'town' ? cell.picked.label : 'Unexplored ground')
      : trailEntry
        ? trailEntry.kind.name + (trailEntry.claimed ? ' · explored' : '')
        : cell.picked.kind === 'bare' ? titled : cell.picked.label;
    const name = discovery === 'unknown' && cell.picked.kind !== 'town' ? '' : base.split(' · ')[0];
    const uniqueName = mark.uniqueSpecies ? eng.speciesById(mark.uniqueSpecies)?.name ?? mark.uniqueSpecies : '';
    const details = discovery === 'unknown' ? [] : [...placements];
    if (uniqueName) details.unshift(uniqueName + ' territory · Unique possible');
    const title = [adventureTitle(cell.originalTitle, cell.picked.kind === 'town', discovery), ...details].join(' · ');
    const bounds = placementPoolBounds(cell.zone, cell.picked.kind === 'sub' && cell.picked.sub != null ? cell.picked.sub : null);
    const icons: MapCellIcon[] = [];
    if (cell.ax === playerAx) icons.push({ href: characterIcon(), label: 'Your position', role: 'player' });
    const signal = signalByAx.get(cell.ax);
    if (signal && signal.source !== 'resource') icons.push({ href: signal.icon.href, label: signal.label, role: 'signal', quiet: signal.icon.quiet });
    if (cell.picked.kind === 'town') icons.push({ href: '/map/landmark/town.png', label: cell.picked.label, role: 'town' });
    for (const site of adventure.placements.filter(p => p.ax === cell.ax && p.source === 'resource')) {
      icons.push({ href: site.icon.href, label: site.label, role: 'site' });
    }
    for (const id of mark.roster) {
      const href = mobSpeciesArt(id);
      if (!icons.some(item => item.href === href)) icons.push({ href, label: eng.speciesById(id)?.name ?? id, role: 'mob', unique: id === mark.uniqueSpecies });
    }
    return {
      ax: cell.ax,
      name,
      title,
      levelText: !bounds ? '' : bounds.lo === bounds.hi ? `Lv ${bounds.lo}` : `Lv ${bounds.lo}–${bounds.hi}`,
      icons,
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
    adventure: { ...adventure, placements: stacked },
    content,
  };
}
