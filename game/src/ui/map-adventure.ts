import { E, TOWN } from '../engine/client';
import type { GameState } from '../sim/types';
import { currentCell } from '../sim/road';
import { standingProgress } from '../sim/town';
import { hexDistance, hexKey, MAP_EXPLORATION, type MapKnowledge, trailSites, trailSiteKind } from '../sim/map-exploration';
import { mapUprightAt } from './map-projection';

const esc = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
const tent = '<image href="/map/terrain/camp.png" x="-11" y="-12" width="22" height="19" preserveAspectRatio="xMidYMax meet"/>';
const cart = '<path class="map-cart" d="M-10-5H9V3H-10Z M-11-5Q0-17 10-5 M10 1H15 M-7 3v4m12-4v4"/><path class="map-cart-wheel" d="M-9 7a3 3 0 1 0 6 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/>';
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

/** One block of the board as the sheet holds it: where it is and what stands on it. */
export interface AdventureCell { ax: string; q: number; r: number; town: string | null; sub: boolean }
/** What the board says about a block, before any of it reaches the DOM. */
export interface AdventureMark { ax: string; discovery: MapKnowledge; activity: string; standing: string | null }
/** A piece of scenery: art to stand on one block, in paint order. */
export interface AdventurePlacement { ax: string; cls: string; label: string; art: string }
export interface AdventureView { marks: AdventureMark[]; placements: AdventurePlacement[] }

const townLifeArt = (tier: number) => '<g transform="translate(0 5) scale(.6)"><path class="map-town-banner" d="M-17 7V-9h9v9l-4-2-5 2"/>'
  + '<path class="map-stall-wood" d="M6 8V2h10v6M4 8h14"/><path class="map-stall-cloth" d="M4 2l3-5h8l3 5Z"/>'
  + (tier > 1 ? '<path class="map-town-lamp" d="M-7 9V2m-2-3 2-4 2 4-2 3Z"/>' : '')
  + (tier > 2 ? '<path class="map-town-guild" d="M11-4v-9h7v7l-3 3-4-3m3-3 1-2 1 2-1 2Z"/>' : '') + '</g>';

const siteArt = (kind: string) => kind === 'provision-caravan' ? `${tent}<g transform="translate(8 4) scale(.45)">${cart}</g>`
  : kind === 'hunting-tracks' ? `<g transform="translate(3 9) scale(.65)">${tracks}</g>` : tent;

/**
 * Everything the living board decides, decided without touching the DOM: which blocks the player
 * knows, what their feet are doing, which landmark has grown its Standing scenery, which trail site
 * is still worth a walk, where the Camp stands and what the Patrol itinerary looks like from here.
 * The paint below only carries these onto the sheet, so the board's rules are testable as rules.
 */
export function adventureView(state: GameState, cells: AdventureCell[]): AdventureView {
  const feet = currentCell(state), feetKey = hexKey(feet), reveal = MAP_EXPLORATION.reveal_radius;
  const visited = new Set(state.mapJournal?.visited), scouted = new Set(state.mapJournal?.scouted);
  const claimed = new Set(state.mapJournal?.claimedSites);
  const knowledgeOf = (ax: string, q: number, r: number): MapKnowledge =>
    ax === feetKey || visited.has(ax) ? 'explored'
      : scouted.has(ax) || hexDistance(feet, { q, r }) <= reveal ? 'scouted' : 'unknown';
  const marks: AdventureMark[] = [], placements: AdventurePlacement[] = [];
  const feetActivity = state.fieldwork.action?.kind || (state.group.length ? 'combat' : 'idle');
  for (const cell of cells) {
    const here = cell.ax === feetKey;
    const standing = cell.town ? standingProgress(state, cell.town) : null;
    const knowledge = knowledgeOf(cell.ax, cell.q, cell.r);
    marks.push({ ax: cell.ax, discovery: knowledge, activity: here ? feetActivity : 'idle',
      standing: standing ? String(standing.tier) : null });
    if (cell.town) {
      if (standing && standing.tier > 0 && state.town.visited.includes(cell.town)) {
        placements.push({ ax: cell.ax, cls: 'map-town-life',
          label: `Standing ${TOWN.standing.tiers[standing.tier - 1]?.name || standing.tier}`, art: townLifeArt(standing.tier) });
      }
    } else if (cell.sub && knowledge === 'unknown' && hexDistance(feet, cell) <= reveal + 1) {
      placements.push({ ax: cell.ax, cls: 'map-wild-hint', label: 'Unidentified tracks · approach to scout this block',
        art: `<g transform="translate(3 9) scale(.5)">${tracks}</g>` });
    }
  }
  for (const site of trailSites) {
    if (knowledgeOf(hexKey(site), site.q, site.r) === 'unknown') continue;
    if (state.fieldwork.camp && hexDistance(state.fieldwork.camp.cell, site) === 0) continue;
    const used = claimed.has(site.id), kind = trailSiteKind(site);
    placements.push({ ax: hexKey(site), cls: `map-trail-site${used ? ' is-explored' : ''}`,
      label: `${kind.name}${used ? ' · explored' : ' · walk here to investigate'}`, art: siteArt(site.kind) });
  }
  const event = state.mapJournal?.lastEvent, camp = state.fieldwork.camp;
  if (camp) {
    const here = hexDistance(feet, camp.cell) === 0 && !state.walk;
    const action = here ? state.fieldwork.action?.kind : null;
    const cooking = !!event && event.q === camp.cell.q && event.r === camp.cell.r
      && event.activity === 'cook' && state.clockSec - event.atSec <= MAP_EXPLORATION.event_display_sec;
    const activity: CampActivity = action || (cooking ? 'cook' : null);
    const activityName = activity === 'mine' ? 'Mining' : activity === 'grove' ? 'Woodcutting'
      : activity === 'fish' ? 'Fishing' : activity === 'cook' ? 'Cooking' : '';
    if (action === 'mine') placements.push({ ax: hexKey(camp.cell), cls: 'map-mine-glow',
      label: 'Mining · working light on the ore seam', art: '<ellipse cx="5" cy="7" rx="17" ry="7"/>' });
    placements.push({ ax: hexKey(camp.cell), cls: `map-field-camp${here ? ' is-occupied' : ''}${action ? ' is-working' : ''}`,
      label: `Field Camp${activityName ? ` · ${activityName}` : ''}`,
      art: '<image href="/map/terrain/camp.png" x="-16" y="-16" width="29" height="25" preserveAspectRatio="xMidYMax meet"/>'
        + campActivityArt(activity)
        + '<path class="map-camp-smoke" d="M2-10q-4-5 0-9q4-4 0-8"/>'
        + (here ? '<path class="map-camp-fire" d="M1 4q-6-2-1-9q0 4 3 3q5 5-2 6Z"/>' : '')
        + (activityName ? `<text class="map-activity-label" x="0" y="15">${activityName}</text>` : '') });
  }
  const encounter = state.fieldwork.campEncounters.active;
  if (encounter) {
    const mark = encounter.kind === 'traveler' || encounter.kind === 'injured'
      ? '<circle cx="0" cy="-2" r="7"/><path d="M-8 11q1-9 8-9t8 9Z"/>'
      : encounter.kind === 'herd' ? '<path d="m-9 5 3-5 3 5m3 3 3-5 3 5"/>'
        : encounter.kind === 'nest' ? '<path d="M-9 6Q-8-3 0-3T9 6M-6 8h12"/>'
          : '<path d="M-10 4q4-7 8 0t8 0m-14 5h2m5 0h2"/>';
    placements.push({ ax: hexKey(encounter.origin), cls: `map-camp-encounter is-${encounter.stage}`,
      label: `${encounter.kind} · ${encounter.stage}`, art: `<g class="map-encounter-mark">${mark}</g>` });
  }
  state.patrol.stops.forEach((stop, i) => {
    const active = state.patrol.active && state.patrol.index === i;
    placements.push({ ax: hexKey(stop.cell), cls: `map-patrol-stop${active ? ' is-active' : ''}`,
      label: `Patrol stop ${i + 1}${active ? ` · ${state.patrol.groupsCleared}/${E.road.patrol.groups_per_stop} groups` : ''}`,
      art: `<path class="map-stop-flag" d="M-21 12V-8h12v15l-6-3-6 3"/><text class="map-stop-number" x="-15" y="1">${i + 1}</text>`
        + (active ? `<rect class="map-stop-progress" x="-21" y="10" width="${12 * state.patrol.groupsCleared / E.road.patrol.groups_per_stop}" height="2"/>` : '') });
  });
  if (event && state.clockSec - event.atSec <= MAP_EXPLORATION.event_display_sec) {
    placements.push({ ax: hexKey(event), cls: 'map-recent-event', label: event.text, art: '<path d="m13-5 3 5-3 5-3-5Z"/>' });
  }
  return { marks, placements };
}

/**
 * The overlay ships a hover title naming every block and its level band, so an unscouted block would
 * spoil from the tooltip exactly what the destination card keeps hidden. Same rule as the labels: a
 * landmark keeps its name and loses its band, everything else keeps nothing.
 */
export function adventureTitle(original: string, town: boolean, discovery: MapKnowledge): string {
  if (discovery !== 'unknown') return original;
  return town ? original.replace(/\s*·\s*Lv\s*\d+[–-]\d+\s*$/, '') : 'Unexplored ground';
}

/** Read-only board scenery follows the real simulation; drawing consumes no gameplay randomness. */
export function paintMapAdventure(root: HTMLElement, state: GameState, terrainView: boolean) {
  const svg = root.querySelector('svg'), board = svg?.querySelector('#projected-board');
  if (!svg || !board) return;
  let layer = board.querySelector<SVGGElement>('#map-adventure');
  if (!layer) { layer = document.createElementNS('http://www.w3.org/2000/svg', 'g'); layer.id = 'map-adventure'; board.append(layer); }
  layer.setAttribute('pointer-events', 'none');
  layer.setAttribute('display', terrainView ? '' : 'none');
  /* This paint runs on every tick, so no block may re-query the board for its own mark or scan a
     journal array that grows with playtime: cells, figures and the journal are indexed once here. */
  const cells: AdventureCell[] = [], byAx = new Map<string, SVGPolygonElement>();
  svg.querySelectorAll<SVGPolygonElement>('polygon.cell').forEach(cell => {
    const ax = cell.getAttribute('data-ax');
    if (ax == null) return;
    const comma = ax.indexOf(',');
    byAx.set(ax, cell);
    cells.push({ ax, q: Number(ax.slice(0, comma)), r: Number(ax.slice(comma + 1)),
      town: cell.classList.contains('town') ? cell.getAttribute('data-node') : null, sub: cell.hasAttribute('data-sub') });
  });
  const view = adventureView(state, cells);
  const figures = new Map<string, SVGGElement>();
  board.querySelectorAll<SVGGElement>('[data-figure-ax]').forEach(figure => {
    const ax = figure.getAttribute('data-figure-ax');
    if (ax) figures.set(ax, figure);
  });
  const setIf = (el: Element, name: string, value: string) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
  for (const mark of view.marks) {
    const cell = byAx.get(mark.ax), figure = figures.get(mark.ax);
    if (cell) setIf(cell, 'data-discovery', mark.discovery);
    if (!figure) continue;
    setIf(figure, 'data-discovery', mark.discovery);
    setIf(figure, 'data-activity', mark.activity);
    if (mark.standing != null) setIf(figure, 'data-standing', mark.standing);
  }
  figures.forEach((figure, ax) => {
    const cell = byAx.get(ax);
    if (cell) figure.classList.toggle('map-settlement-figure', cell.classList.contains('town'));
  });
  const discovery = new Map(view.marks.map(mark => [mark.ax, mark.discovery]));
  svg.querySelectorAll<SVGTitleElement>('polygon.cell > title').forEach(title => {
    const cell = title.parentElement, ax = cell?.getAttribute('data-ax');
    if (!cell || ax == null) return;
    const original = titles.get(title) ?? (title.textContent || '');
    titles.set(title, original);
    const want = adventureTitle(original, cell.classList.contains('town'), discovery.get(ax) ?? 'unknown');
    if (title.textContent !== want) title.textContent = want;
  });
  const markup = view.placements.map(placement => {
    const cell = byAx.get(placement.ax);
    if (!cell) return '';
    const box = cell.getBBox();
    return `<g class="${placement.cls}" data-ax="${placement.ax}" transform="${mapUprightAt(box.x + box.width / 2, box.y + box.height / 2)}" role="img" aria-label="${esc(placement.label)}"><title>${esc(placement.label)}</title>${placement.art}</g>`;
  }).join('');
  if (rendered.get(layer) !== markup) { layer.innerHTML = markup; rendered.set(layer, markup); }
  const feetCell = byAx.get(hexKey(currentCell(state)));
  board.querySelectorAll('.map-mob').forEach(mob => mob.classList.toggle('is-fighting',
    mob.getAttribute('data-cell') === feetCell?.getAttribute('data-cell') && state.group.length > 0));
}
