import { E, eng, TOWN } from '../engine/client';
import type { GameState } from '../sim/types';
import { currentCell } from '../sim/road';
import { standingProgress } from '../sim/town';
import { hexDistance, hexKey, MAP_EXPLORATION, type MapKnowledge, trailSites, trailSiteKind } from '../sim/map-exploration';
import { MAP_CAMERA_TRANSFORM, mapUprightAt } from './map-projection';
import { mapSpeciesArt } from './map-species-art';
import { mapSprite } from './map-sprites';

const esc = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
const tent = mapSprite('/map/landmark/camp-unlit.png', -13, -16, 26, 23);
const cart = mapSprite('/map/landmark/provision-caravan.png', -12, -20, 24, 25);
const tracks = '<path class="map-tracks" d="M-7-2q-4 5 0 7q4-1 2-5Z M3-10q-4 5 0 7q4-1 2-5Z M-8-7l-1-3m4 3v-4M2-15l-1-3m4 3v-4"/>';
const rendered = new WeakMap<Element, string>();
const titles = new WeakMap<SVGTitleElement, string>();

export type CampActivity = 'mine' | 'grove' | 'fish' | 'cook' | null;
export function campActivityArt(activity: CampActivity): string {
  if (activity === 'mine') return '<g class="map-camp-props" transform="translate(11 4) scale(.55)"><path class="map-pickaxe" d="M-9-9Q0-16 9-9L5-5Q1-9-5-4L-8-1M0-7 5 12"/><path class="map-ore" d="m-10 9 4-5 4 5-4 3Zm12-1 4-5 4 5-4 3Z"/></g>';
  if (activity === 'grove') return '<g class="map-camp-props" transform="translate(11 5) scale(.55)"><path class="map-log" d="M-11 4h19v5h-19Zm3-6H9v5H-8Z"/><path class="map-axe" d="M1-12 4-9-2-3-5-6Zm-4 7 7 10"/></g>';
  if (activity === 'fish') return '<g class="map-camp-props" transform="translate(11 4) scale(.55)"><path class="map-fishing-rod" d="M-10-12Q-1-7 3 4m0 0q2 4 5 1m-5-1v6"/><path class="map-fish-ripple" d="M-10 9q4-3 8 0m2 2q4-3 8 0"/></g>';
  if (activity === 'cook') return '<g class="map-camp-props" transform="translate(0 1) scale(.55)"><path class="map-pot-steam" d="M-5-2q-2-3 0-5m4 5q-2-3 0-5m4 5q-2-3 0-5"/></g>';
  return '';
}

export function uniqueTraceSpecies(speciesIds: string[]): string | undefined {
  return speciesIds.find(id => eng.uniquesOf(id).length > 0 && mapSpeciesArt(id));
}

export function hasUniqueTrace(speciesIds: string[]): boolean {
  return speciesIds.some(id => eng.uniquesOf(id).length > 0);
}

export function mapEventArt(text: string, activity?: string): string {
  if (activity === 'cook') return campActivityArt('cook');
  if (activity === 'food') return '<g class="map-event-food"><path d="M-7-2q0-5 7-5t7 5v10H-7Z"/><path d="M-4-2q4-4 8 0m-4-5v-3"/></g>';
  if (activity === 'rest') return '<g class="map-event-spring"><path d="M-10 3q5-4 10 0t10 0M-8 7q4-3 8 0t8 0"/><path d="M0-9q-5 6 0 9q5-3 0-9Z"/></g>';
  const event = text.toLowerCase();
  if (event.startsWith('abandoned camp')) return `${tent}<path class="map-event-fire" d="M1 4q-6-2-1-9q0 4 3 3q5 5-2 6Z"/>`;
  if (event.startsWith('provision caravan')) return `<g transform="translate(8 4) scale(.7)">${cart}</g>`;
  if (event.startsWith('hunting tracks')) return `<g transform="translate(2 6) scale(.8)">${tracks}</g>`;
  if (event.startsWith('camp kitchen')) return campActivityArt('cook');
  if (event.includes('clear spring')) return '<g class="map-event-spring"><path d="M-10 3q5-4 10 0t10 0M-8 7q4-3 8 0t8 0"/><path d="M0-9q-5 6 0 9q5-3 0-9Z"/></g>';
  if (event.includes('mushroom')) return '<g class="map-event-mushroom"><path d="M-8 2q0-8 8-8t8 8H-8Z"/><path d="M-3 2v7h6V2"/></g>';
  if (event.includes('sunroot') || event.includes('moonmint')) return '<path class="map-event-sprig" d="M0 9V-7m0 6q-9-7-10-1q5 5 10 1m0-4q8-8 10-2q-4 6-10 2"/>';
  if (event.startsWith('found ')) return '<g class="map-event-food"><path d="M-7-2q0-5 7-5t7 5v10H-7Z"/><path d="M-4-2q4-4 8 0m-4-5v-3"/></g>';
  return '<path d="m13-5 3 5-3 5-3-5Z"/>';
}

/** One block of the board as the sheet holds it: where it is and what stands on it. */
export interface AdventureCell { ax: string; q: number; r: number; town: string | null; sub: boolean; zone?: number; subzone?: number; uniqueSpecies?: string }
/** What the board says about a block, before any of it reaches the DOM. */
export interface AdventureMark { ax: string; discovery: MapKnowledge; activity: string; standing: string | null; uniqueSpecies?: string }
/** A piece of scenery: art to stand on one block, in paint order. */
export interface AdventurePlacement { ax: string; cls: string; label: string; art: string; ground?: boolean; signal?: boolean }
export interface AdventureView { marks: AdventureMark[]; placements: AdventurePlacement[] }

const townLifeArt = (tier: number) => '<g transform="translate(18 3) scale(.5)"><path class="map-town-banner" d="M-17 7V-9h9v9l-4-2-5 2"/>'
  + '<path class="map-stall-wood" d="M6 8V2h10v6M4 8h14"/><path class="map-stall-cloth" d="M4 2l3-5h8l3 5Z"/>'
  + (tier > 1 ? '<path class="map-town-lamp" d="M-7 9V2m-2-3 2-4 2 4-2 3Z"/>' : '')
  + (tier > 2 ? '<path class="map-town-guild" d="M11-4v-9h7v7l-3 3-4-3m3-3 1-2 1 2-1 2Z"/>' : '') + '</g>';

const siteArt = (kind: string) => kind === 'provision-caravan' ? cart
  : kind === 'hunting-tracks' ? `<g transform="translate(3 9) scale(.65)">${tracks}</g>` : tent;

/** Board state is resolved without touching the DOM so the placements can be tested as rules. */
export function adventureView(state: GameState, cells: AdventureCell[]): AdventureView {
  const feet = currentCell(state), feetKey = hexKey(feet), reveal = MAP_EXPLORATION.reveal_radius;
  const visited = new Set(state.mapJournal?.visited), scouted = new Set(state.mapJournal?.scouted);
  const claimed = new Set(state.mapJournal?.claimedSites);
  const knowledgeOf = (ax: string, q: number, r: number): MapKnowledge =>
    ax === feetKey || visited.has(ax) ? 'explored'
      : scouted.has(ax) || hexDistance(feet, { q, r }) <= reveal ? 'scouted' : 'unknown';
  const marks: AdventureMark[] = [], placements: AdventurePlacement[] = [];
  const feetActivity = state.group.length ? 'combat' : state.walk ? 'travel' : state.fieldwork.action?.kind || 'idle';
  for (const cell of cells) {
    const here = cell.ax === feetKey;
    const standing = cell.town ? standingProgress(state, cell.town) : null;
    const knowledge = knowledgeOf(cell.ax, cell.q, cell.r);
    marks.push({ ax: cell.ax, discovery: knowledge, activity: here ? feetActivity : 'idle',
      standing: standing ? String(standing.tier) : null,
      uniqueSpecies: knowledge !== 'unknown' && hexDistance(feet, cell) <= reveal ? cell.uniqueSpecies : undefined });
    if (cell.town) {
      if (standing && standing.tier > 0 && state.town.visited.includes(cell.town)) {
        placements.push({ ax: cell.ax, cls: 'map-town-life',
          label: `Standing ${TOWN.standing.tiers[standing.tier - 1]?.name || standing.tier}`, art: townLifeArt(standing.tier) });
      }
    } else if (cell.sub && knowledge === 'unknown' && hexDistance(feet, cell) <= reveal + 1) {
      placements.push({ ax: cell.ax, cls: 'map-wild-hint', label: 'Unidentified tracks · approach to scout this block',
        ground: true, art: `<g transform="translate(3 9) scale(.5)">${tracks}</g>` });
    }
    const objectives = knowledge !== 'unknown' && cell.sub ? state.town.tasks.filter(task => task
      && task.kind === 'expedition' && !task.claimed && task.zone === cell.zone && task.subzone === cell.subzone) : [];
    if (objectives.length) placements.push({ ax: cell.ax, cls: 'map-expedition', signal: true,
      label: objectives.map(task => `Expedition · ${task!.progress}/${task!.n}`).join(' · '),
      art: '<path class="map-expedition-flag" d="M20 7V-5l7 2-2 5h-5"/>' });
  }
  for (const site of trailSites) {
    if (knowledgeOf(hexKey(site), site.q, site.r) === 'unknown') continue;
    if (state.fieldwork.camp && hexDistance(state.fieldwork.camp.cell, site) === 0) continue;
    const used = claimed.has(site.id), kind = trailSiteKind(site);
    placements.push({ ax: hexKey(site), cls: `map-trail-site${used ? ' is-explored' : ''}`,
      label: `${kind.name}${used ? ' · explored' : ' · walk here to investigate'}`, ground: site.kind === 'hunting-tracks',
      art: `<g transform="translate(9 -2)">${siteArt(site.kind)}</g>` });
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
    if (action === 'mine') placements.push({ ax: hexKey(camp.cell), cls: 'map-mine-glow',
      label: 'Mining · working light on the ore seam', ground: true, art: '<ellipse cx="14" cy="1" rx="10" ry="5"/>' });
    placements.push({ ax: hexKey(camp.cell), cls: `map-field-camp${here ? ' is-occupied' : ''}${action ? ' is-working' : ''}`,
      label: `Field Camp${activityName ? ` · ${activityName}` : ''}`,
      art: mapSprite('/map/landmark/camp-unlit.png', -3, -24, 32, 29)
        + (activity === 'cook' ? '' : campActivityArt(activity))
        + `<g transform="translate(13 0)">${activity === 'cook' ? campActivityArt(activity) : ''}`
        + (here ? '<path class="map-camp-smoke" d="M0-8q-2-4 0-7q2-3 0-6"/><path class="map-camp-fire" d="M0 0q-3-1 0-5q0 2 1 2q3 3-1 3Z"/>' : '') + '</g>'
        + (activityName ? `<text class="map-activity-label" x="13" y="11">${activityName}</text>` : '') });
  }
  const encounter = state.fieldwork.campEncounters.active;
  if (encounter) {
    const species = encounter.preparedGroup[0]?.speciesId || String(encounter.payload.species || '');
    const creature = mapSpeciesArt(species);
    const isTracks = encounter.kind === 'herd' || encounter.kind === 'sounds' && encounter.stage === 'warning';
    const mark = isTracks ? `<g transform="translate(14 12) scale(.6)">${tracks}</g>`
      : encounter.kind === 'traveler' ? `<g transform="translate(12 8) scale(.65)">${cart}</g>`
        : encounter.kind === 'injured' ? mapSprite('/map/characters/species/human/human.png', 5, -6, 13, 18)
          : creature && encounter.stage !== 'combat' ? mapSprite(creature, 5, -8, 17, 20)
            : '<path class="map-threat-pennant" d="M23 8V-3l7 3-7 3"/>';
    placements.push({ ax: hexKey(encounter.origin), cls: `map-camp-encounter is-${encounter.stage}`,
      label: `${encounter.kind} · ${encounter.stage}`, ground: isTracks, signal: true, art: mark });
  }
  state.patrol.stops.forEach((stop, i) => {
    const active = state.patrol.active && state.patrol.index === i;
    placements.push({ ax: hexKey(stop.cell), cls: `map-patrol-stop${active ? ' is-active' : ''}`,
      signal: true,
      label: `Patrol stop ${i + 1}${active ? ` · ${state.patrol.groupsCleared}/${E.road.patrol.groups_per_stop} groups` : ''}`,
      art: `<g transform="translate(-8 -8) scale(.75)"><path class="map-stop-flag" d="M-21 12V-8h12v15l-6-3-6 3"/><text class="map-stop-number" x="-15" y="1">${i + 1}</text>`
        + (active ? `<rect class="map-stop-progress" x="-21" y="10" width="${12 * state.patrol.groupsCleared / E.road.patrol.groups_per_stop}" height="2"/>` : '') + '</g>' });
  });
  if (event && state.clockSec - event.atSec <= MAP_EXPLORATION.event_display_sec
    && !(event.activity === 'cook' && camp && hexKey(event) === hexKey(camp.cell))) {
    placements.push({ ax: hexKey(event), cls: 'map-recent-event', signal: true, label: event.text,
      art: `<g transform="translate(17 11) scale(.45)">${mapEventArt(event.text, event.activity)}</g>` });
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

  const cells: AdventureCell[] = [], byAx = new Map<string, SVGPolygonElement>();
  svg.querySelectorAll<SVGPolygonElement>('polygon.cell').forEach(cell => {
    const ax = cell.getAttribute('data-ax'), nodeId = cell.getAttribute('data-node'), sub = cell.getAttribute('data-sub');
    if (ax == null) return;
    const comma = ax.indexOf(','), owner = nodeId ? TOWN.settlements.find(row => row.id === nodeId) : undefined;
    const species = owner && sub != null ? eng.zoneById(owner.zone).subzones?.[Number(sub)]?.species || [] : [];
    byAx.set(ax, cell);
    cells.push({ ax, q: Number(ax.slice(0, comma)), r: Number(ax.slice(comma + 1)),
      town: cell.classList.contains('town') ? nodeId : null, sub: sub != null,
      zone: owner?.zone, subzone: sub != null ? Number(sub) : undefined, uniqueSpecies: uniqueTraceSpecies(species) });
  });
  const view = adventureView(state, cells);
  const figures = new Map<string, SVGGElement>();
  const actors = new Map<string, SVGGElement>();
  const collect = (selector: string, attr: string, into: Map<string, SVGGElement>) =>
    board.querySelectorAll<SVGGElement>(selector).forEach(node => {
      const ax = node.getAttribute(attr);
      if (ax) into.set(ax, node);
    });
  collect('[data-figure-ax]', 'data-figure-ax', figures);
  collect('[data-actor-ax]', 'data-actor-ax', actors);
  const setIf = (el: Element, name: string, value: string) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
  for (const mark of view.marks) {
    const cell = byAx.get(mark.ax);
    const camp = String(!!state.fieldwork.camp && mark.ax === hexKey(state.fieldwork.camp.cell));
    if (cell) setIf(cell, 'data-discovery', mark.discovery);
    for (const node of [figures.get(mark.ax), actors.get(mark.ax)]) {
      if (!node) continue;
      setIf(node, 'data-discovery', mark.discovery);
      setIf(node, 'data-activity', mark.activity);
      setIf(node, 'data-camp', camp);
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
  svg.querySelectorAll<SVGTitleElement>('polygon.cell > title').forEach(title => {
    const cell = title.parentElement, ax = cell?.getAttribute('data-ax');
    if (!cell || ax == null) return;
    const original = titles.get(title) ?? (title.textContent || '');
    titles.set(title, original);
    const want = adventureTitle(original, cell.classList.contains('town'), discovery.get(ax) ?? 'unknown');
    if (title.textContent !== want) title.textContent = want;
  });
  const byCell = new Map<string, AdventurePlacement[]>();
  for (const placement of view.placements) {
    const list = byCell.get(placement.ax) || [];
    list.push(placement); byCell.set(placement.ax, list);
  }
  const piece = (placement: AdventurePlacement) => `<g class="map-piece ${placement.cls}" data-ax="${placement.ax}"${placement.ground ? ` transform="${MAP_CAMERA_TRANSFORM}"` : ''} role="img" aria-label="${esc(placement.label)}"><title>${esc(placement.label)}</title>${placement.art}</g>`;
  const render = (group: Element, markup: string) => {
    if (rendered.get(group) !== markup) { group.innerHTML = markup; rendered.set(group, markup); }
  };
  for (const [ax, actor] of actors) {
    const placements = byCell.get(ax) || [];
    const cell = byAx.get(ax);
    if (cell) setIf(cell, 'data-trail-claimed', String(placements.some(p => p.cls.startsWith('map-trail-site') && p.cls.includes('is-explored'))));
    const figure = figures.get(ax);
    if (figure) setIf(figure, 'data-trail-site', String(placements.some(p => p.cls.startsWith('map-trail-site') && !p.ground)));
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
  render(layer, view.placements.filter(p => !actors.has(p.ax)).map(placement => {
    const cell = byAx.get(placement.ax);
    if (!cell) return '';
    const box = cell.getBBox();
    return `<g transform="${mapUprightAt(box.x + box.width / 2, box.y + box.height / 2)}">${piece(placement)}</g>`;
  }).join(''));
  const feetCell = byAx.get(hexKey(currentCell(state)));
  board.querySelectorAll<SVGGElement>('.map-mob').forEach(mob => {
    const fighting = mob.getAttribute('data-cell') === feetCell?.getAttribute('data-cell') && state.group.length > 0;
    mob.classList.toggle('is-fighting', fighting);
    const ax = mob.closest('[data-actor-ax]')?.getAttribute('data-actor-ax');
    const unique = view.marks.find(mark => mark.ax === ax)?.uniqueSpecies;
    mob.setAttribute('aria-label', `${mob.getAttribute('data-species') || 'Mob'} ${fighting ? 'in combat' : `territory${unique ? ' · Unique possible' : ''}`} on block ${mob.getAttribute('data-cell') || ''}`);
  });
}
