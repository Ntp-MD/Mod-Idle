import { E, TOWN } from '../engine/client';
import type { GameState } from '../sim/types';
import { currentCell } from '../sim/road';
import { standingProgress } from '../sim/town';
import { hexDistance, hexKey, mapKnowledge, MAP_EXPLORATION, trailSites, trailSiteKind } from '../sim/map-exploration';
import { mapUprightAt } from './map-projection';

const esc = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
const tent = '<image href="/map/terrain/camp.png" x="-11" y="-12" width="22" height="19" preserveAspectRatio="xMidYMax meet"/>';
const cart = '<path class="map-cart" d="M-10-5H9V3H-10Z M-11-5Q0-17 10-5 M10 1H15 M-7 3v4m12-4v4"/><path class="map-cart-wheel" d="M-9 7a3 3 0 1 0 6 0a3 3 0 1 0-6 0m12 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/>';
const tracks = '<path class="map-tracks" d="M-7-2q-4 5 0 7q4-1 2-5Z M3-10q-4 5 0 7q4-1 2-5Z M-8-7l-1-3m4 3v-4M2-15l-1-3m4 3v-4"/>';
const rendered = new WeakMap<Element, string>();

export type CampActivity = 'mine' | 'grove' | 'fish' | 'cook' | null;
export function campActivityArt(activity: CampActivity): string {
  if (activity === 'mine') return '<g class="map-camp-props" transform="translate(11 4) scale(.55)"><path class="map-pickaxe" d="M-9-9Q0-16 9-9L5-5Q1-9-5-4L-8-1M0-7 5 12"/><path class="map-ore" d="m-10 9 4-5 4 5-4 3Zm12-1 4-5 4 5-4 3Z"/></g>';
  if (activity === 'grove') return '<g class="map-camp-props" transform="translate(11 5) scale(.55)"><path class="map-log" d="M-11 4h19v5h-19Zm3-6H9v5H-8Z"/><path class="map-axe" d="M1-12 4-9-2-3-5-6Zm-4 7 7 10"/></g>';
  if (activity === 'fish') return '<g class="map-camp-props" transform="translate(11 4) scale(.55)"><path class="map-fishing-rod" d="M-10-12Q-1-7 3 4m0 0q2 4 5 1m-5-1v6"/><path class="map-fish-ripple" d="M-10 9q4-3 8 0m2 2q4-3 8 0"/></g>';
  if (activity === 'cook') return '<g class="map-camp-props" transform="translate(0 1) scale(.55)"><path class="map-pot-steam" d="M-5-2q-2-3 0-5m4 5q-2-3 0-5m4 5q-2-3 0-5"/></g>';
  return '';
}

/** Read-only board scenery follows the real simulation; drawing consumes no gameplay randomness. */
export function paintMapAdventure(root: HTMLElement, state: GameState, terrainView: boolean) {
  const svg = root.querySelector('svg'), board = svg?.querySelector('#projected-board');
  if (!svg || !board) return;
  let layer = board.querySelector<SVGGElement>('#map-adventure');
  if (!layer) { layer = document.createElementNS('http://www.w3.org/2000/svg', 'g'); layer.id = 'map-adventure'; board.append(layer); }
  layer.setAttribute('pointer-events', 'none');
  layer.setAttribute('display', terrainView ? '' : 'none');
  const feet = currentCell(state), entries: string[] = [];
  const cells = Array.from(svg.querySelectorAll<SVGPolygonElement>('polygon.cell'));
  const byAx = new Map(cells.map(cell => [cell.getAttribute('data-ax'), cell]));
  const place = (h: { q: number; r: number }, cls: string, label: string, art: string) => {
    const cell = byAx.get(hexKey(h));
    if (!cell) return;
    const box = cell.getBBox();
    entries.push(`<g class="${cls}" data-ax="${hexKey(h)}" transform="${mapUprightAt(box.x + box.width / 2, box.y + box.height / 2)}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${art}</g>`);
  };
  for (const cell of cells) {
    const [q, r] = cell.getAttribute('data-ax')!.split(',').map(Number), h = { q, r };
    const knowledge = mapKnowledge(state, h);
    cell.setAttribute('data-discovery', knowledge);
    const figure = board.querySelector(`[data-figure-ax="${q},${r}"]`);
    figure?.classList.toggle('map-settlement-figure', cell.classList.contains('town'));
    figure?.setAttribute('data-discovery', knowledge);
    figure?.setAttribute('data-activity', hexDistance(feet, h) === 0
      ? state.fieldwork.action?.kind || (state.group.length ? 'combat' : 'idle') : 'idle');
    const town = cell.classList.contains('town') && cell.getAttribute('data-node');
    if (town) {
      const standing = standingProgress(state, town);
      figure?.setAttribute('data-standing', String(standing.tier));
      if (state.town.visited.includes(town) && standing.tier > 0) {
        const name = `Standing ${TOWN.standing.tiers[standing.tier - 1]?.name || standing.tier}`;
        place(h, 'map-town-life', name, `<g transform="translate(0 5) scale(.6)"><path class="map-town-banner" d="M-17 7V-9h9v9l-4-2-5 2"/>`
          + '<path class="map-stall-wood" d="M6 8V2h10v6M4 8h14"/><path class="map-stall-cloth" d="M4 2l3-5h8l3 5Z"/>'
          + (standing.tier > 1 ? '<path class="map-town-lamp" d="M-7 9V2m-2-3 2-4 2 4-2 3Z"/>' : '')
          + (standing.tier > 2 ? '<path class="map-town-guild" d="M11-4v-9h7v7l-3 3-4-3m3-3 1-2 1 2-1 2Z"/>' : '') + '</g>');
      }
    } else if (cell.hasAttribute('data-sub') && knowledge === 'unknown' && hexDistance(feet, h) <= MAP_EXPLORATION.reveal_radius + 1) {
      place(h, 'map-wild-hint', 'Unidentified tracks · approach to scout this block', `<g transform="translate(3 9) scale(.5)">${tracks}</g>`);
    }
  }
  for (const site of trailSites) {
    if (mapKnowledge(state, site) === 'unknown') continue;
    if (state.fieldwork.camp && hexDistance(state.fieldwork.camp.cell, site) === 0) continue;
    const used = !!state.mapJournal?.claimedSites.includes(site.id);
    const kind = trailSiteKind(site);
    place(site, `map-trail-site${used ? ' is-explored' : ''}`, `${kind.name}${used ? ' · explored' : ' · walk here to investigate'}`,
      site.kind === 'provision-caravan' ? `${tent}<g transform="translate(8 4) scale(.45)">${cart}</g>`
        : site.kind === 'hunting-tracks' ? `<g transform="translate(3 9) scale(.65)">${tracks}</g>` : tent);
  }
  const event = state.mapJournal?.lastEvent;
  const camp = state.fieldwork.camp;
  if (camp) {
    const here = hexDistance(feet, camp.cell) === 0 && !state.walk;
    const action = here ? state.fieldwork.action?.kind : null;
    const cooking = !!event && event.q === camp.cell.q && event.r === camp.cell.r
      && event.text.startsWith('Camp kitchen') && state.clockSec - event.atSec <= MAP_EXPLORATION.event_display_sec;
    const activity: CampActivity = action || (cooking ? 'cook' : null);
    const activityName = activity === 'mine' ? 'Mining' : activity === 'grove' ? 'Woodcutting'
      : activity === 'fish' ? 'Fishing' : activity === 'cook' ? 'Cooking' : '';
    if (action === 'mine') place(camp.cell, 'map-mine-glow', 'Mining · working light on the ore seam', '<ellipse cx="5" cy="7" rx="17" ry="7"/>');
    place(camp.cell, `map-field-camp${here ? ' is-occupied' : ''}${action ? ' is-working' : ''}`,
      `Field Camp${activityName ? ` · ${activityName}` : ''}`, '<image href="/map/terrain/camp.png" x="-16" y="-16" width="29" height="25" preserveAspectRatio="xMidYMax meet"/>'
      + campActivityArt(activity)
      + '<path class="map-camp-smoke" d="M2-10q-4-5 0-9q4-4 0-8"/>'
      + (here ? '<path class="map-camp-fire" d="M1 4q-6-2-1-9q0 4 3 3q5 5-2 6Z"/>' : '')
      + (activityName ? `<text class="map-activity-label" x="0" y="15">${activityName}</text>` : ''));
  }
  state.patrol.stops.forEach((stop, i) => {
    const active = state.patrol.active && state.patrol.index === i;
    place(stop.cell, `map-patrol-stop${active ? ' is-active' : ''}`, `Patrol stop ${i + 1}${active ? ` · ${state.patrol.groupsCleared}/${E.road.patrol.groups_per_stop} groups` : ''}`,
      `<path class="map-stop-flag" d="M-21 12V-8h12v15l-6-3-6 3"/><text class="map-stop-number" x="-15" y="1">${i + 1}</text>`
      + (active ? `<rect class="map-stop-progress" x="-21" y="10" width="${12 * state.patrol.groupsCleared / E.road.patrol.groups_per_stop}" height="2"/>` : ''));
  });
  if (event && state.clockSec - event.atSec <= MAP_EXPLORATION.event_display_sec) {
    place(event, 'map-recent-event', event.text, '<path d="m13-5 3 5-3 5-3-5Z"/>');
  }
  const markup = entries.join('');
  if (rendered.get(layer) !== markup) { layer.innerHTML = markup; rendered.set(layer, markup); }
  board.querySelectorAll('.map-mob').forEach(mob => mob.classList.toggle('is-fighting',
    mob.getAttribute('data-cell') === byAx.get(hexKey(feet))?.getAttribute('data-cell') && state.group.length > 0));
}
