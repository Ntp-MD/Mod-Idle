import { E, fieldwork, TOWN } from '../engine/client';
import type { GameState } from './types';
import { currentCell, ownerOf, road, zoneOf } from './road';
import { addTo } from './slots';

export interface MapJournal {
  visited: string[];
  scouted: string[];
  claimedSites: string[];
  lastPosition?: string;
  lastEvent?: { q: number; r: number; text: string; atSec: number };
}
export type MapKnowledge = 'unknown' | 'scouted' | 'explored';
export const MAP_EXPLORATION = E.fieldwork.map_exploration;
export const trailSites = MAP_EXPLORATION.sites;
export const hexKey = (h: { q: number; r: number }) => `${h.q},${h.r}`;
export function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }) {
  const q = a.q - b.q, r = a.r - b.r;
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}
const newJournal = (): MapJournal => ({ visited: [], scouted: [], claimedSites: [] });

function survey(journal: MapJournal, h: { q: number; r: number }, radius: number) {
  const seen = new Set(journal.scouted);
  for (let q = -radius; q <= radius; q++) for (let r = -radius; r <= radius; r++) {
    const next = { q: h.q + q, r: h.r + r };
    if (hexDistance(h, next) <= radius) seen.add(hexKey(next));
  }
  journal.scouted = [...seen];
}

/** Additive migration: only known towns and the current block can be reconstructed from old saves. */
export function normalizeMapJournal(state: GameState) {
  const raw = state.mapJournal;
  const keys = (value: unknown) => Array.isArray(value)
    ? [...new Set(value.filter((key): key is string => typeof key === 'string' && /^-?\d+,-?\d+$/.test(key)))] : [];
  const journal = state.mapJournal = newJournal();
  journal.visited = keys(raw?.visited);
  journal.scouted = keys(raw?.scouted);
  journal.claimedSites = Array.isArray(raw?.claimedSites)
    ? [...new Set(raw.claimedSites.filter(id => trailSites.some(site => site.id === id)))] : [];
  if (raw?.lastEvent && Number.isInteger(raw.lastEvent.q) && Number.isInteger(raw.lastEvent.r)
    && typeof raw.lastEvent.text === 'string' && Number.isFinite(raw.lastEvent.atSec)) journal.lastEvent = raw.lastEvent;
  for (const id of state.town.visited) {
    const node = road.nodeById(id);
    if (!node) continue;
    if (!journal.visited.includes(hexKey(node))) journal.visited.push(hexKey(node));
    survey(journal, node, MAP_EXPLORATION.reveal_radius);
  }
  recordMapDiscovery(state);
}

export function recordMapDiscovery(state: GameState) {
  const journal = state.mapJournal ||= newJournal();
  const feet = currentCell(state), key = hexKey(feet);
  if (journal.lastPosition === key) return;
  journal.lastPosition = key;
  if (!journal.visited.includes(key)) journal.visited.push(key);
  survey(journal, feet, MAP_EXPLORATION.reveal_radius);
}

export function mapKnowledge(state: GameState, h: { q: number; r: number }): MapKnowledge {
  const key = hexKey(h);
  if (state.mapJournal?.visited.includes(key) || hexDistance(currentCell(state), h) === 0) return 'explored';
  if (state.mapJournal?.scouted.includes(key) || hexDistance(currentCell(state), h) <= MAP_EXPLORATION.reveal_radius) return 'scouted';
  return 'unknown';
}

export const trailSiteAt = (h: { q: number; r: number }) => trailSites.find(site => site.q === h.q && site.r === h.r);
export const trailSiteKind = (site: typeof trailSites[number]) => MAP_EXPLORATION.kinds[site.kind as keyof typeof MAP_EXPLORATION.kinds];

export function investigateTrailSite(state: GameState, id: string): { ok: boolean; why?: string; message?: string } {
  const site = trailSites.find(row => row.id === id);
  if (!site || hexDistance(currentCell(state), site) !== 0) return { ok: false, why: 'Walk to this trail site first.' };
  if (state.walk || state.dungeon || state.phase === 'camp') return { ok: false, why: 'Finish traveling, recovering or the dungeon run first.' };
  if (state.group.length) return { ok: false, why: 'Finish the fight first.' };
  const journal = state.mapJournal ||= newJournal();
  if (journal.claimedSites.includes(id)) return { ok: false, why: 'This site has already been explored.' };
  const kind = trailSiteKind(site);
  let message: string;
  if ('food_count' in kind) {
    const zone = zoneOf(site) ?? state.zone;
    const foodId = fieldwork.F.regional_sources[zone]?.food;
    const food = fieldwork.foodById[foodId];
    if (!food) return { ok: false, why: 'No local provision is available here.' };
    const received = addTo(state, state.fieldwork.foods, foodId, 'food', kind.food_count);
    if (!received) return { ok: false, why: 'Make space in the food bag first.' };
    message = `${kind.name} · ${food.name} ×${received}`;
  } else if ('hunger_restore' in kind) {
    if (state.fieldwork.hunger >= fieldwork.F.hunger.max) return { ok: false, why: 'Hunger is already full. You can rest here later.' };
    state.fieldwork.hunger = Math.min(fieldwork.F.hunger.max, state.fieldwork.hunger + kind.hunger_restore);
    message = `${kind.name} · Hunger ${Math.floor(state.fieldwork.hunger)}%`;
  } else {
    survey(journal, site, MAP_EXPLORATION.tracks_radius);
    const town = TOWN.settlements.find((row: any) => row.id === ownerOf(site).id);
    message = `${kind.name} · surveyed nearby hunting grounds in ${town?.name || 'this region'}`;
  }
  journal.claimedSites.push(id);
  journal.lastEvent = { q: site.q, r: site.r, text: message, atSec: state.clockSec };
  state.hunting = false;
  state.group = [];
  state.player.atkTimer = 0;
  state.fieldwork.action = null;
  state.patrol.active = false;
  state.autoReturn.phase = 'idle';
  state.autoReturn.resumeCell = null;
  return { ok: true, message };
}
