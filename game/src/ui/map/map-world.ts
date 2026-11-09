/** Canonical content lookup for the sheet adapter. SVG supplies coordinates, never gameplay facts. */
import type { FieldSite } from '@sim/core/types';
import { settlementById } from '@sim/town/town';
import { createWorld } from '../../../../engine/world.ts';
import { ED, TOWN, eng } from '../../engine/client';
import type { Picked } from './map-types';

export const world = createWorld(ED, TOWN.settlements);

/** What a cell is called, resolved from its coordinates through the World queries. */
export function resolveMapCell(h: { q: number; r: number }, key: string): Picked {
  const cell = world.cellAt(h);
  if (!cell) throw new Error(`map: cell ${h.q},${h.r} is not standable land`);
  const loc = cell.locationId ? world.locationById(cell.locationId) : null;
  if (loc?.kind === 'town') {
    const id = world.ownerOf(h).id;
    return { key, q: h.q, r: h.r, kind: 'town', label: settlementById(id)!.name, sub: null, site: null, terrain: cell.terrainId, nodeId: id };
  }
  if (loc?.kind === 'sub') {
    const id = world.ownerOf(h).id;
    const s = settlementById(id)!;
    return { key, q: h.q, r: h.r, kind: 'sub', label: (eng.zoneById(s.zone).subzones || [])[loc.index]?.name || '', sub: loc.index, site: null, terrain: cell.terrainId, nodeId: id };
  }
  if (loc?.kind === 'site') {
    const site = loc.site as FieldSite;
    const id = world.ownerOf(h).id;
    const s = settlementById(id)!;
    const label = site === 'dungeon' ? `${s.name} Wild Side · Dungeon`
      : site === 'mine' ? `${s.name} Wild Side · Mine`
        : site === 'grove' ? `${s.name} Wild Side · Grove` : `${s.name} Wild Side · Fishing`;
    return { key, q: h.q, r: h.r, kind: 'bare', site, label, sub: null, terrain: cell.terrainId, nodeId: id };
  }
  return { key, q: h.q, r: h.r, kind: 'bare', label: `Hunting Ground · ${key}`, sub: null, site: null, terrain: cell.terrainId };
}
