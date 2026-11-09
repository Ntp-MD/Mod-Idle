/** Read-only state -> semantic signals. No DOM, SVG or image allocation here. */
import { E, eng } from '../../engine/client';
import type { FieldSite, GameState } from '@sim/core/types';
import { currentCell } from '@sim/world/road';
import { hexDistance, hexKey, mapKnowledge, MAP_EXPLORATION, type MapKnowledge, trailSites, trailSiteKind } from '@sim/world/map-exploration';
import { icon, mobSpeciesArt } from '../../icon';
import type { AdventureMark, AdventureIcon, AdventurePlacement, AdventureSource, AdventureView } from './map-types';

export function uniqueTraceSpecies(speciesIds: string[], zone: number): string | undefined {
  return speciesIds.find(id => eng.uniquesOf(id, zone).length > 0);
}
type CampActivity = 'mine' | 'grove' | 'fish' | 'cook' | null;
const signalPlacement = (ax: string, cls: string, label: string, icon: AdventureIcon, source: AdventureSource, combat = false): AdventurePlacement =>
  ({ ax, cls, label, icon, source, combat });

const placementPriority = (p: AdventurePlacement) => p.source === 'camp-encounter' ? 110
  : p.combat ? 100 : p.source === 'camp' ? 80
    : p.source === 'trail' ? 60 : 10;

/** One signal per hex; its accessible label retains every coincident activity. */
export function stackAdventurePlacements(placements: AdventurePlacement[]): AdventurePlacement[] {
  const cells = new Map<string, AdventurePlacement[]>();
  for (const placement of placements) {
    const list = cells.get(placement.ax) || [];
    list.push(placement); cells.set(placement.ax, list);
  }
  return [...cells].sort(([a], [b]) => a.localeCompare(b)).flatMap(([, list]) => {
    const ordered = [...list].sort((a, b) => placementPriority(b) - placementPriority(a)
      || a.cls.localeCompare(b.cls) || a.label.localeCompare(b.label));
    const primary = ordered[0];
    if (ordered.length === 1) return ordered;
    return [{ ...primary, cls: `${primary.cls} map-signal-stack`, label: ordered.map(p => p.label).join(' · ') }];
  });
}

/** One block of the board as the sheet holds it: where it is and what stands on it. */
export interface AdventureCell { ax: string; q: number; r: number; town: string | null; sub: boolean; zone?: number; subzone?: number; site?: FieldSite; uniqueSpecies?: string }
export function adventureView(state: GameState, cells: AdventureCell[], selectedAx: string | null = null): AdventureView {
  const feet = currentCell(state), feetKey = hexKey(feet), reveal = MAP_EXPLORATION.reveal_radius;
  const claimed = new Set(state.mapJournal?.claimedSites);
  const marks: AdventureMark[] = [], placements: AdventurePlacement[] = [];
  const feetActivity = state.group.length ? 'combat' : state.walk ? 'travel' : state.fieldwork.action?.kind || 'idle';
  for (const cell of cells) {
    const here = cell.ax === feetKey, knowledge = mapKnowledge(state, cell);
    const nearby = knowledge !== 'unknown' && hexDistance(feet, cell) <= reveal;
    const unique = nearby ? cell.uniqueSpecies : undefined;
    const live = here ? state.group.find(mob => mob.kind.startsWith('Boss') || mob.kind.startsWith('Unique')) || state.group[0] : undefined;
    const roster = cell.zone != null && cell.subzone != null ? eng.zoneById(cell.zone).subzones?.[cell.subzone]?.species || [] : [];
    const speciesId = live?.speciesId || (live && E.mob.species.find(row => row.name === live.species)?.id)
      || (nearby && cell.sub ? unique || roster[0] : undefined);
    const species = speciesId ? eng.speciesById(speciesId) : undefined;
    const boss = !!live && (live.kind.startsWith('Boss') || live.kind.startsWith('Unique'));
    const threat = live ? boss ? 'boss' : 'combat' : species ? unique ? 'unique-possible' : 'territory' : undefined;
    marks.push({ ax: cell.ax, discovery: knowledge, activity: here ? feetActivity : 'idle',
      uniqueSpecies: unique, threat,
      camp: !!state.fieldwork.camp && hexKey(state.fieldwork.camp.cell) === cell.ax,
      picked: selectedAx === cell.ax,
      roster: nearby && cell.sub && cell.zone != null && cell.subzone != null ? [...roster] : [] });
    if (live) {
      const label = state.group.map(mob => mob.species).join(', ') + ' · in combat';
      placements.push(signalPlacement(cell.ax, 'map-mob' + ' is-combat',
        label, { kind: boss ? 'boss' : 'mob', href: mobSpeciesArt(speciesId || '') }, 'mob', true));
    }
    if (knowledge !== 'unknown' && cell.site) {
      const site = cell.site;
      placements.push(signalPlacement(cell.ax, 'map-resource', site === 'mine' ? 'Mine'
        : site === 'grove' ? 'Grove' : site === 'fishing' ? 'Fishing' : 'Dungeon',
        { kind: 'resource', href: icon(site === 'mine' ? 'pickaxe' : site === 'grove' ? 'axe-in-stump' : site === 'fishing' ? 'fishing-rod' : 'dungeon-gate', 'dread-skull') }, 'resource'));
    }
  }
  for (const site of trailSites(state)) {
    if (mapKnowledge(state, site) === 'unknown') continue;
    if (state.fieldwork.camp && hexDistance(state.fieldwork.camp.cell, site) === 0) continue;
    const used = claimed.has(site.id), kind = trailSiteKind(site);
    placements.push(signalPlacement(hexKey(site), 'map-trail-site' + (used ? ' is-explored' : ''),
      kind.name + (used ? ' · explored' : ' · walk here to investigate'),
      { kind: 'event', href: icon(site.kind === 'provision-caravan' ? 'adventure-bags' : 'rest-campfire'), quiet: used }, 'trail'));
  }
  const event = state.mapJournal?.lastEvent, camp = state.fieldwork.camp;
  if (camp) {
    const here = hexDistance(feet, camp.cell) === 0 && !state.walk;
    const action = here ? state.fieldwork.action?.kind : null;
    const cooking = here && !!event && event.q === camp.cell.q && event.r === camp.cell.r
      && event.activity === 'cook' && state.clockSec - event.atSec <= MAP_EXPLORATION.event_display_sec;
    const activity: CampActivity = action || (cooking ? 'cook' : null);
    const activityName = activity === 'mine' ? 'Mining' : activity === 'grove' ? 'Woodcutting'
      : activity === 'fish' ? 'Fishing' : activity === 'cook' ? 'Cooking' : '';
    placements.push(signalPlacement(hexKey(camp.cell), 'map-field-camp' + (here ? ' is-occupied' : '') + (action ? ' is-working' : ''),
      'Field Camp' + (activityName ? ' · ' + activityName : ''),
      { kind: 'camp', href: icon(activity === 'mine' ? 'pickaxe' : activity === 'grove' ? 'axe-in-stump' : activity === 'fish' ? 'fishing-rod' : activity === 'cook' ? 'cooking-cauldron' : 'rest-campfire') }, 'camp'));
  }
  const encounter = state.fieldwork.campEncounters.active;
  if (encounter && mapKnowledge(state, encounter.origin) !== 'unknown') {
    const warning = encounter.stage === 'warning', combat = encounter.stage === 'combat';
    const mark = marks.find(row => row.ax === hexKey(encounter.origin));
    if (mark && combat && mark.threat !== 'boss') mark.threat = 'combat';
    else if (mark && warning && !mark.threat) mark.threat = 'warning';
    const href = icon(combat ? 'crossed-swords-1' : encounter.kind === 'traveler' ? 'adventure-bags' : 'boot-prints');
    placements.push(signalPlacement(hexKey(encounter.origin), 'map-camp-encounter is-' + encounter.stage,
      encounter.kind + ' · ' + encounter.stage, { kind: combat ? 'boss' : warning ? 'unknown' : 'event', href }, 'camp-encounter', combat));
  }
  return { marks, placements };
}

/** The sheet hover title obeys the same discovery limit as the destination card. */
export function adventureTitle(original: string, town: boolean, discovery: MapKnowledge): string {
  if (discovery !== 'unknown') return original;
  return town ? original.replace(/\s*·\s*Lv\s*\d+[–-]\d+\s*$/, '') : 'Unexplored ground';
}
