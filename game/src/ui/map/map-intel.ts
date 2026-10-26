import { E, eng, fieldwork, TOWN } from '../../engine/client';
import type { GameState } from '../../sim/core/types';
import { mapKnowledge, trailSiteAt, trailSiteKind, hexDistance } from '../../sim/world/map-exploration';
import { standingProgress } from '../../sim/town/town';
import type { Picked } from './map';

export function destinationIntel(state: GameState, cell: Picked, townId: string, blocks: number) {
  const settlement = TOWN.settlements.find((row: any) => row.id === townId)!;
  const zone = eng.zoneById(settlement.zone);
  const knowledge = cell.kind === 'town' && state.town.visited.includes(townId) ? 'explored' : mapKnowledge(state, cell);
  const known = knowledge !== 'unknown';
  const source = fieldwork.F.regional_sources[settlement.zone];
  const siteKind = cell.kind === 'wild' ? fieldwork.siteAt(cell.wild) : null;
  const pool = cell.kind === 'sub' && cell.sub != null ? zone.subzones?.[cell.sub]?.species || [] : eng.speciesInZone(settlement.zone);
  const encounters = known && (cell.kind === 'sub' || cell.kind === 'bare' || siteKind === 'dungeon')
    ? pool.map((id: string) => { const s = eng.speciesById(id); return `${s?.name || id} · ${s?.damage || 'physical'}`; }) : [];
  const resources: string[] = [];
  if (known && source && siteKind === 'mine') resources.push('Ore', fieldwork.materialById[source.mine]?.name || source.mine);
  if (known && source && siteKind === 'grove') resources.push('Timber', fieldwork.materialById[source.grove]?.name || source.grove);
  if (known && source?.food && cell.kind !== 'town') resources.push(fieldwork.foodById[source.food]?.name || source.food);
  const objectives = known ? state.town.tasks.flatMap(task => {
    if (!task || task.claimed || task.kind !== 'expedition' || task.zone !== settlement.zone
      || (cell.kind !== 'town' && (cell.kind !== 'sub' || task.subzone !== cell.sub))) return [];
    const target = eng.speciesById(task.targetSpecies || '');
    const location = zone.subzones?.[task.subzone!]?.name || '';
    return [`Expedition · ${target?.name || task.targetSpecies} Elites · ${task.progress}/${task.n}${cell.kind === 'town' ? ` · ${location}` : ''}`];
  }) : [];
  const site = known ? trailSiteAt(state, cell) : undefined;
  const standing = cell.kind === 'town' ? standingProgress(state, townId) : null;
  const tier = standing && TOWN.standing.tiers[standing.tier - 1];
  const event = state.mapJournal?.lastEvent;
  return {
    knowledge, known, encounters, resources: [...new Set(resources.filter(Boolean))], objectives,
    purpose: !known ? 'Approach within one block to scout the landmark, creatures and supplies.'
      : site ? `${trailSiteKind(site).description} Available for ${Math.ceil(site.remainingSec / 60)}m of online time.`
        : cell.kind === 'town' ? 'Town services, trading, storage and a known Waypoint.'
          : siteKind === 'mine' ? 'Set Camp to mine ore and regional minerals.'
            : siteKind === 'grove' ? 'Set Camp to gather timber and regional wood.'
              : siteKind === 'dungeon' ? 'Enter a dungeon run; loot remains in escrow until cleared.'
                : 'Hunt this roster or add this subzone to your Patrol.',
    levelNote: !known ? 'Levels unknown until scouted' : state.player.level < zone.levels[0]
      ? `Above your level · starts at Lv ${zone.levels[0]}` : `Lv ${zone.levels[0]}–${zone.levels[1]}`,
    campDistance: state.fieldwork.camp ? hexDistance(state.fieldwork.camp.cell, cell) : null,
    site: site ? { id: site.id, name: trailSiteKind(site).name, claimed: !!state.mapJournal?.claimedSites.includes(site.id) } : null,
    standing: standing ? {
      label: `Standing ${tier?.name || '0'}`,
      unlocked: TOWN.standing.tiers.slice(0, standing.tier).map((entry: any) => entry.unlocks) as string[],
      next: standing.next ? `${standing.next.remaining} kills to Standing ${standing.next.name}` : 'All Standing tiers unlocked',
    } : null,
    recentEvent: event && event.q === cell.q && event.r === cell.r ? event.text : '',
  };
}
export type MapIntel = ReturnType<typeof destinationIntel>;
