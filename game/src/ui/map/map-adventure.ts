import { E, eng, fieldwork, TOWN } from '../../engine/client';
import type { GameState } from '../../sim/core/types';
import { currentCell } from '../../sim/world/road';
import { standingProgress } from '../../sim/town/town';
import { hexDistance, hexKey, mapKnowledge, MAP_EXPLORATION, type MapKnowledge, trailSites, trailSiteKind } from '../../sim/world/map-exploration';
import { MAP_CAMERA_TRANSFORM, mapUprightAt } from './map-projection';
import { mapMarker, mapSpeciesGlyph, type MapMarkerGlyph, type MapMarkerKind, type MapMarkerOptions } from './map-markers';

const esc = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
const rendered = new WeakMap<Element, string>();
const titles = new WeakMap<SVGTitleElement, string>();

export type CampActivity = 'mine' | 'grove' | 'fish' | 'cook' | null;
export function campActivityArt(activity: CampActivity): string {
  return activity ? mapMarker('resource', activity) : '';
}

export function uniqueTraceSpecies(speciesIds: string[]): string | undefined {
  return speciesIds.find(id => eng.uniquesOf(id).length > 0);
}

export function hasUniqueTrace(speciesIds: string[]): boolean {
  return speciesIds.some(id => eng.uniquesOf(id).length > 0);
}

export function mapEventArt(text: string, activity?: string): string {
  return mapMarker('event', eventGlyph(text, activity));
}

function eventGlyph(text: string, activity?: string): MapMarkerGlyph {
  if (activity === 'cook' || activity === 'food' || activity === 'rest') return activity;
  const event = text.toLowerCase();
  if (event.startsWith('abandoned camp')) return 'fire';
  if (event.startsWith('provision caravan')) return 'caravan';
  if (event.startsWith('camp kitchen')) return 'cook';
  if (event.includes('clear spring')) return 'rest';
  if (event.includes('mushroom') || event.includes('sunroot') || event.includes('moonmint') || event.startsWith('found ')) return 'food';
  return 'flag';
}

/** One block of the board as the sheet holds it: where it is and what stands on it. */
export interface AdventureCell { ax: string; q: number; r: number; town: string | null; sub: boolean; zone?: number; subzone?: number; wild?: number; uniqueSpecies?: string }
type AdventureIndex = {
  cells: AdventureCell[];
  byAx: Map<string, SVGPolygonElement>;
  figures: Map<string, SVGGElement>;
  actors: Map<string, SVGGElement>;
  titles: SVGTitleElement[];
};
const adventureIndexes = new WeakMap<SVGSVGElement, AdventureIndex>();

function adventureIndex(svg: SVGSVGElement): AdventureIndex {
  const cached = adventureIndexes.get(svg);
  if (cached) return cached;
  const cells: AdventureCell[] = [], byAx = new Map<string, SVGPolygonElement>();
  const figures = new Map<string, SVGGElement>(), actors = new Map<string, SVGGElement>();
  const collect = (selector: string, attr: string, into: Map<string, SVGGElement>) =>
    svg.querySelectorAll<SVGGElement>(selector).forEach(node => {
      const ax = node.getAttribute(attr);
      if (ax) into.set(ax, node);
    });
  svg.querySelectorAll<SVGPolygonElement>('polygon.cell').forEach(cell => {
    const ax = cell.getAttribute('data-ax'), nodeId = cell.getAttribute('data-node'), sub = cell.getAttribute('data-sub');
    if (ax == null) return;
    const comma = ax.indexOf(','), owner = nodeId ? TOWN.settlements.find(row => row.id === nodeId) : undefined;
    const species = owner && sub != null ? eng.zoneById(owner.zone).subzones?.[Number(sub)]?.species || [] : [];
    byAx.set(ax, cell);
    cells.push({ ax, q: Number(ax.slice(0, comma)), r: Number(ax.slice(comma + 1)),
      town: cell.classList.contains('town') ? nodeId : null, sub: sub != null,
      zone: owner?.zone, subzone: sub != null ? Number(sub) : undefined,
      wild: cell.hasAttribute('data-wild') ? Number(cell.getAttribute('data-wild')) : undefined,
      uniqueSpecies: uniqueTraceSpecies(species) });
  });
  collect('[data-figure-ax]', 'data-figure-ax', figures);
  collect('[data-actor-ax]', 'data-actor-ax', actors);
  const index = { cells, byAx, figures, actors, titles: Array.from(svg.querySelectorAll<SVGTitleElement>('polygon.cell > title')) };
  adventureIndexes.set(svg, index);
  return index;
}
/** What the board says about a block, before any of it reaches the DOM. */
export interface AdventureMark { ax: string; discovery: MapKnowledge; activity: string; standing: string | null; uniqueSpecies?: string; threat?: 'territory' | 'unique-possible' | 'warning' | 'combat' | 'boss' }
export interface AdventureMarker extends MapMarkerOptions { kind: MapMarkerKind; glyph: MapMarkerGlyph }
/** Individual discoveries remain available to the destination panel, even when their tokens stack. */
export interface AdventurePlacement { ax: string; cls: string; label: string; art: string; marker?: AdventureMarker; ground?: boolean; signal?: boolean }
export interface AdventureView { marks: AdventureMark[]; placements: AdventurePlacement[] }

const markerPlacement = (ax: string, cls: string, label: string, marker: AdventureMarker): AdventurePlacement =>
  ({ ax, cls, label, marker, signal: true, art: mapMarker(marker.kind, marker.glyph, marker) });

const placementPriority = (p: AdventurePlacement) => p.cls.startsWith('map-camp-encounter') ? 110
  : p.cls.includes('is-combat') ? 100 : p.cls.startsWith('map-field-camp') ? 80
    : p.cls.startsWith('map-trail-site') ? 60 : p.cls.startsWith('map-expedition') ? 50 : 10;

/** One crest per hex; a smaller glyph and count retain its other known activities. */
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
    if (ordered.length === 1 || !primary.marker) return ordered;
    return [{ ...primary, cls: `${primary.cls} map-marker-stack`, label: ordered.map(p => p.label).join(' · '),
      art: mapMarker(primary.marker.kind, primary.marker.glyph, primary.marker) }];
  });
}

/** Board state is resolved without touching the DOM so the placements can be tested as rules. */
export function adventureView(state: GameState, cells: AdventureCell[]): AdventureView {
  const feet = currentCell(state), feetKey = hexKey(feet), reveal = MAP_EXPLORATION.reveal_radius;
  const claimed = new Set(state.mapJournal?.claimedSites);
  const marks: AdventureMark[] = [], placements: AdventurePlacement[] = [];
  const feetActivity = state.group.length ? 'combat' : state.walk ? 'travel' : state.fieldwork.action?.kind || 'idle';
  for (const cell of cells) {
    const here = cell.ax === feetKey, knowledge = mapKnowledge(state, cell);
    const standing = cell.town ? standingProgress(state, cell.town) : null;
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
      standing: standing ? String(standing.tier) : null, uniqueSpecies: unique, threat });
    if (live || unique) {
      const label = live ? state.group.map(mob => mob.species).join(', ') + ' · in combat'
        : (species?.name || speciesId) + ' territory · Unique possible';
      placements.push(markerPlacement(cell.ax, 'map-mob' + (live ? ' is-combat' : ' is-unique'),
        label, { kind: boss ? 'boss' : 'mob', glyph: boss ? 'skull' : mapSpeciesGlyph(speciesId || '', species?.race) }));
    }
    if (knowledge !== 'unknown' && cell.wild != null) {
      const site = fieldwork.siteAt(cell.wild);
      if (site) placements.push(markerPlacement(cell.ax, 'map-resource', site === 'mine' ? 'Mine'
        : site === 'grove' ? 'Rare Grove' : 'Dungeon', { kind: 'resource', glyph: site === 'mine' ? 'mine' : site === 'grove' ? 'grove' : 'skull' }));
    }
    const objectives = knowledge !== 'unknown' && cell.sub ? state.town.tasks.filter(task => task
      && task.kind === 'expedition' && !task.claimed && task.zone === cell.zone && task.subzone === cell.subzone) : [];
    if (objectives.length) placements.push(markerPlacement(cell.ax, 'map-expedition',
      objectives.map(task => 'Expedition · ' + task!.progress + '/' + task!.n).join(' · '), { kind: 'objective', glyph: 'expedition' }));
  }
  for (const site of trailSites(state)) {
    if (mapKnowledge(state, site) === 'unknown') continue;
    if (state.fieldwork.camp && hexDistance(state.fieldwork.camp.cell, site) === 0) continue;
    const used = claimed.has(site.id), kind = trailSiteKind(site);
    placements.push(markerPlacement(hexKey(site), 'map-trail-site' + (used ? ' is-explored' : ''),
      kind.name + (used ? ' · explored' : ' · walk here to investigate'),
      { kind: 'event', glyph: site.kind === 'provision-caravan' ? 'caravan' : 'fire', quiet: used }));
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
    placements.push(markerPlacement(hexKey(camp.cell), 'map-field-camp' + (here ? ' is-occupied' : '') + (action ? ' is-working' : ''),
      'Field Camp' + (activityName ? ' · ' + activityName : ''),
      { kind: 'camp', glyph: activity || (here ? 'fire' : 'flag'), secondary: activity ? 'fire' : undefined }));
  }
  const encounter = state.fieldwork.campEncounters.active;
  if (encounter && mapKnowledge(state, encounter.origin) !== 'unknown') {
    const warning = encounter.stage === 'warning', combat = encounter.stage === 'combat';
    const mark = marks.find(row => row.ax === hexKey(encounter.origin));
    if (mark && combat && mark.threat !== 'boss') mark.threat = 'combat';
    else if (mark && warning && !mark.threat) mark.threat = 'warning';
    const glyph: MapMarkerGlyph = combat ? 'sword' : warning || encounter.kind === 'herd' || encounter.kind === 'sounds' ? 'claw'
      : encounter.kind === 'traveler' ? 'caravan' : encounter.kind === 'injured' ? 'heal' : 'claw';
    placements.push(markerPlacement(hexKey(encounter.origin), 'map-camp-encounter is-' + encounter.stage,
      encounter.kind + ' · ' + encounter.stage, { kind: combat ? 'boss' : warning ? 'unknown' : 'event', glyph }));
  }
  return { marks, placements };
}

/** The sheet hover title obeys the same discovery limit as the destination card. */
export function adventureTitle(original: string, town: boolean, discovery: MapKnowledge): string {
  if (discovery !== 'unknown') return original;
  return town ? original.replace(/\s*·\s*Lv\s*\d+[–-]\d+\s*$/, '') : 'Unexplored ground';
}

/** Paint the already-decided board pieces, keeping the state rules separately testable. */
export function paintMapAdventure(root: HTMLElement, state: GameState, terrainView: boolean) {
  const svg = root.querySelector('svg'), board = svg?.querySelector('#projected-board');
  if (!svg || !board) return;
  const actorLayer = board.querySelector<SVGGElement>('#actors') || board;
  let layer = board.querySelector<SVGGElement>('#map-adventure');
  if (!layer) { layer = document.createElementNS('http://www.w3.org/2000/svg', 'g'); layer.id = 'map-adventure'; actorLayer.append(layer); }
  layer.setAttribute('pointer-events', 'none');
  layer.setAttribute('display', terrainView ? '' : 'none');

  const index = adventureIndex(svg);
  const { cells, byAx, figures, actors } = index;
  const view = adventureView(state, cells);
  const setIf = (el: Element, name: string, value: string) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
  for (const mark of view.marks) {
    const cell = byAx.get(mark.ax);
    const camp = String(!!state.fieldwork.camp && mark.ax === hexKey(state.fieldwork.camp.cell));
    if (cell) {
      setIf(cell, 'data-discovery', mark.discovery);
      setIf(cell, 'data-threat', mark.threat || 'none');
      setIf(cell, 'data-signal-count', String(view.placements.filter(p => p.ax === mark.ax).length));
    }
    for (const node of [figures.get(mark.ax), actors.get(mark.ax)]) {
      if (!node) continue;
      setIf(node, 'data-discovery', mark.discovery);
      setIf(node, 'data-activity', mark.activity);
      setIf(node, 'data-camp', camp);
      setIf(node, 'data-picked', String(!!cell?.classList.contains('picked')));
      if (mark.standing != null) setIf(node, 'data-standing', mark.standing);
    }
  }
  for (const ax of new Set([...figures.keys(), ...actors.keys()])) {
    const cell = byAx.get(ax);
    if (!cell) continue;
    const town = cell.classList.contains('town');
    figures.get(ax)?.classList.toggle('map-settlement-figure', town);
    actors.get(ax)?.classList.toggle('map-settlement-figure', town);
  }
  const discovery = new Map(view.marks.map(mark => [mark.ax, mark.discovery]));
  index.titles.forEach(title => {
    const cell = title.parentElement, ax = cell?.getAttribute('data-ax');
    if (!cell || ax == null) return;
    const original = titles.get(title) ?? (title.textContent || '');
    titles.set(title, original);
    const knowledge = discovery.get(ax) ?? 'unknown';
    const labels = knowledge === 'unknown' ? [] : view.placements.filter(p => p.ax === ax).map(p => p.label);
    const want = [adventureTitle(original, cell.classList.contains('town'), knowledge), ...labels].join(' · ');
    if (title.textContent !== want) title.textContent = want;
  });
  const byCell = new Map<string, AdventurePlacement[]>();
  const stacked = stackAdventurePlacements(view.placements);
  for (const placement of stacked) {
    const list = byCell.get(placement.ax) || [];
    list.push(placement); byCell.set(placement.ax, list);
  }
  const piece = (placement: AdventurePlacement) => {
    const name = placement.label.split(' · ')[0];
    const short = name.length > 22 ? name.slice(0, 21) + '…' : name;
    return `<g class="map-piece ${placement.cls}" data-ax="${placement.ax}"${placement.ground ? ` data-map-ground="true" transform="${MAP_CAMERA_TRANSFORM}"` : ''} role="img" aria-label="${esc(placement.label)}"><title>${esc(placement.label)}</title><path class="map-marker-leader" d="M0 0V-18"/><g transform="translate(0 -18)">${placement.art}</g><text class="map-marker-label" x="0" y="8" text-anchor="middle">${esc(short)}</text></g>`;
  };
  const render = (group: Element, markup: string) => {
    if (rendered.get(group) !== markup) { group.innerHTML = markup; rendered.set(group, markup); }
  };
  const trailNames = new Map(trailSites(state).map(site => [hexKey(site), trailSiteKind(site).name]));
  for (const [ax, actor] of actors) {
    const placements = byCell.get(ax) || [];
    const cell = byAx.get(ax);
    if (cell) {
      setIf(cell, 'data-trail-claimed', String(placements.some(p => p.cls.startsWith('map-trail-site') && p.cls.includes('is-explored'))));
      setIf(cell, 'data-trail-name', placements.some(p => p.cls.startsWith('map-trail-site')) ? trailNames.get(ax) || '' : '');
    }
    const figure = figures.get(ax);
    if (figure) setIf(figure, 'data-trail-site', 'false');
    if (!placements.length && !actor.querySelector('.map-scenery, .map-signals')) continue;
    for (const signal of [false, true]) {
      const cls = signal ? 'map-signals' : 'map-scenery';
      let group = actor.querySelector<SVGGElement>(`.${cls}`);
      if (!group) {
        group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', cls); group.setAttribute('pointer-events', 'none');
        actor.querySelector(signal ? '.actor-signals' : '.actor-scenery')!.append(group);
      }
      setIf(group, 'display', terrainView ? '' : 'none');
      render(group, placements.filter(p => !!p.signal === signal).map(piece).join(''));
    }
  }
  render(layer, stacked.filter(p => !actors.has(p.ax)).map(placement => {
    const cell = byAx.get(placement.ax);
    if (!cell) return '';
    const box = cell.getBBox();
    return `<g transform="${mapUprightAt(box.x + box.width / 2, box.y + box.height / 2)}">${piece(placement)}</g>`;
  }).join(''));
}
