import { E, eng, fieldwork, TOWN } from '../../engine/client';
import type { GameState } from '@sim/core/types';
import { mapKnowledge, trailSiteAt, trailSiteKind, hexDistance } from '@sim/world/map-exploration';
import type { Picked } from './map-types';

export function destinationIntel(state: GameState, cell: Picked, townId: string, blocks: number) {
  const settlement = TOWN.settlements.find((row: any) => row.id === townId)!;
  const zone = eng.zoneById(settlement.zone);
  const knowledge = cell.kind === 'town' && state.town.visited.includes(townId) ? 'explored' : mapKnowledge(state, cell);
  const known = knowledge !== 'unknown';
  const source = fieldwork.F.regional_sources[settlement.zone];
  const fieldSite = cell.site;
  const pool = cell.kind === 'sub' && cell.sub != null ? zone.subzones?.[cell.sub]?.species || [] : eng.speciesInZone(settlement.zone);
  const encounters = known && !fieldSite && (cell.kind === 'sub' || cell.kind === 'bare')
    ? pool.map((id: string) => { const s = eng.speciesById(id); return `${s?.name || id} · ${s?.damage || 'physical'}`; }) : [];
  const resources: string[] = [];
  if (known && source && fieldSite === 'mine') resources.push('Ore', fieldwork.materialById[source.mine]?.name || source.mine);
  if (known && source && fieldSite === 'grove') resources.push('Timber', fieldwork.materialById[source.grove]?.name || source.grove);
  if (known && source?.food && fieldSite === 'fishing') resources.push('Fishing', fieldwork.foodById[source.food]?.name || source.food);
  const trail = known ? trailSiteAt(state, cell) : undefined;
  const event = state.mapJournal?.lastEvent;
  return {
    knowledge, known, encounters, resources: [...new Set(resources.filter(Boolean))],
    purpose: !known ? 'Approach within one block to scout the landmark, creatures and supplies.'
      : trail ? `${trailSiteKind(trail).description} Available for ${Math.ceil(trail.remainingSec / 60)}m of online time.`
        : cell.kind === 'town' ? 'Town services, trading, storage and a known Waypoint.'
          : fieldSite === 'mine' ? 'Safe wild-side mine for ore and regional minerals; a Camp adds a bonus.'
            : fieldSite === 'grove' ? 'Safe wild-side grove for timber and regional wood; a Camp adds a bonus.'
              : fieldSite === 'fishing' ? 'Safe wild-side fishing spot for the zone’s authored food; a Camp adds a bonus.'
                : fieldSite === 'dungeon' ? 'Safe wild-side dungeon entrance; the run itself is a combat mode.'
                  : 'Hunt this roster.',
    levelNote: !known ? 'Levels unknown until scouted' : state.player.level < zone.levels[0]
      ? `Above your level · recommends Lv ${zone.recommended_level ?? zone.levels[0]}` : `Recommended Lv ${zone.recommended_level ?? zone.levels[0]}`,
    campDistance: state.fieldwork.camp ? hexDistance(state.fieldwork.camp.cell, cell) : null,
    site: trail ? { id: trail.id, name: trailSiteKind(trail).name, claimed: !!state.mapJournal?.claimedSites.includes(trail.id) } : null,
    recentEvent: event && event.q === cell.q && event.r === cell.r ? event.text : '',
  };
}
export type MapIntel = ReturnType<typeof destinationIntel>;
