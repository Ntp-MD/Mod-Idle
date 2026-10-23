import { E, fieldwork } from '../engine/client';
import { mulberry32 } from '../engine/client-helpers';
import type { GameState } from './types';
import { currentCell, rankOf, road, zoneOf } from './road';
import { addTo } from './slots';

export interface MapJournal {
  visited: string[];
  scouted: string[];
  claimedSites: string[];
  trail?: { sites: TrailSite[]; serial: number; streamState: number; checkInSec: number };
  lastPosition?: string;
  lastEvent?: { q: number; r: number; text: string; atSec: number; activity?: string };
}
export interface TrailSite {
  id: string; q: number; r: number;
  kind: keyof typeof E.fieldwork.map_exploration.kinds;
  remainingSec: number;
}
export type MapKnowledge = 'unknown' | 'scouted' | 'explored';
export const MAP_EXPLORATION = E.fieldwork.map_exploration;
export const trailSites = (state: GameState): TrailSite[] => state.mapJournal?.trail?.sites || [];
export const hexKey = (h: { q: number; r: number }) => `${h.q},${h.r}`;
export function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }) {
  const q = a.q - b.q, r = a.r - b.r;
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}
export const newMapJournal = (seed: number): MapJournal => ({ visited: [], scouted: [], claimedSites: [],
  trail: { sites: [], serial: 0, streamState: (seed ^ 0x51ed270b) >>> 0, checkInSec: MAP_EXPLORATION.spawn.check_interval_sec } });

function survey(journal: MapJournal, h: { q: number; r: number }, radius: number) {
  const seen = new Set(journal.scouted);
  for (let q = -radius; q <= radius; q++) for (let r = -radius; r <= radius; r++) {
    const next = { q: h.q + q, r: h.r + r };
    if (hexDistance(h, next) <= radius) seen.add(hexKey(next));
  }
  journal.scouted = [...seen];
}

/** Record nearby knowledge from an explicit online Camp investigation without marking travel. */
export function surveyMapAround(state: GameState, h: { q: number; r: number }, radius = MAP_EXPLORATION.reveal_radius): void {
  const journal = state.mapJournal ||= newMapJournal(state.seed);
  survey(journal, h, Math.max(0, Math.floor(radius)));
}

/** Additive migration: only known towns and the current block can be reconstructed from old saves. */
export function normalizeMapJournal(state: GameState) {
  const raw = state.mapJournal;
  const keys = (value: unknown) => Array.isArray(value)
    ? [...new Set(value.filter((key): key is string => typeof key === 'string' && /^-?\d+,-?\d+$/.test(key)))] : [];
  const journal = state.mapJournal = newMapJournal(state.seed);
  journal.visited = keys(raw?.visited);
  journal.scouted = keys(raw?.scouted);
  journal.claimedSites = Array.isArray(raw?.claimedSites)
    ? [...new Set(raw.claimedSites.filter(id => typeof id === 'string'
      && (MAP_EXPLORATION.retired_site_ids.includes(id) || /^trail-[1-9]\d*$/.test(id))))] : [];
  if (raw?.trail != null) {
    const t = raw.trail, cfg = MAP_EXPLORATION.spawn;
    const uint = (n: number) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
    if (!uint(t.streamState) || !Number.isSafeInteger(t.serial) || t.serial < 0
      || !Number.isInteger(t.checkInSec) || t.checkInSec < 0 || t.checkInSec > cfg.check_interval_sec
      || !Array.isArray(t.sites) || t.sites.length > cfg.max_active) throw new Error('Invalid trail event state');
    const ids = new Set<string>(), cells = new Set<string>();
    for (const site of t.sites) {
      if (!site || !/^trail-[1-9]\d*$/.test(site.id) || Number(site.id.slice(6)) > t.serial
        || !Number.isInteger(site.q) || !Number.isInteger(site.r) || rankOf(site) <= 1
        || !Object.hasOwn(MAP_EXPLORATION.kinds, site.kind)
        || !Number.isInteger(site.remainingSec) || site.remainingSec <= 0 || site.remainingSec > cfg.lifetime_sec
        || ids.has(site.id) || cells.has(hexKey(site))) throw new Error('Invalid trail site');
      ids.add(site.id); cells.add(hexKey(site));
    }
    journal.trail = { ...t, sites: t.sites.map(site => ({ ...site })) };
  }
  if (raw?.lastEvent && Number.isInteger(raw.lastEvent.q) && Number.isInteger(raw.lastEvent.r)
    && typeof raw.lastEvent.text === 'string' && Number.isFinite(raw.lastEvent.atSec)) {
    const { q, r, text, atSec } = raw.lastEvent;
    journal.lastEvent = typeof raw.lastEvent.activity === 'string'
      ? { q, r, text, atSec, activity: raw.lastEvent.activity } : { q, r, text, atSec };
  }
  for (const id of state.town.visited) {
    const node = road.nodeById(id);
    if (!node) continue;
    if (!journal.visited.includes(hexKey(node))) journal.visited.push(hexKey(node));
    survey(journal, node, MAP_EXPLORATION.reveal_radius);
  }
  recordMapDiscovery(state);
}

export function recordMapDiscovery(state: GameState) {
  const journal = state.mapJournal ||= newMapJournal(state.seed);
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

/** Online world events have their own saved clock and RNG, independent of combat and loot. */
export function tickTrailSites(state: GameState, online: boolean): void {
  if (!online) return;
  if (!state.mapJournal?.trail) normalizeMapJournal(state);
  const journal = state.mapJournal!, events = journal.trail!, cfg = MAP_EXPLORATION.spawn;
  for (const site of events.sites) site.remainingSec--;
  events.sites = events.sites.filter(site => site.remainingSec > 0);
  if (--events.checkInSec > 0) return;
  events.checkInSec = cfg.check_interval_sec;
  if (events.sites.length >= cfg.max_active) return;
  const feet = currentCell(state), camp = state.fieldwork.camp?.cell;
  const cells = journal.visited.map(key => {
    const [q, r] = key.split(',').map(Number); return { q, r };
  }).filter(cell => hexDistance(feet, cell) > 0 && hexDistance(feet, cell) <= cfg.radius
    && rankOf(cell) > 1 && (!camp || hexDistance(cell, camp) !== 0)
    && !events.sites.some(site => hexDistance(cell, site) === 0))
    .sort((a, b) => a.q - b.q || a.r - b.r);
  if (!cells.length) return;
  const rng = mulberry32(events.streamState);
  events.streamState = (events.streamState + 0x6d2b79f5) >>> 0;
  const rolled: { q: number; r: number; kind: TrailSite['kind'] } | null = fieldwork.rollTrailSite(cells, rng);
  if (rolled) events.sites.push({ ...rolled, id: `trail-${++events.serial}`, remainingSec: cfg.lifetime_sec });
}

export const trailSiteAt = (state: GameState, h: { q: number; r: number }) => trailSites(state).find(site => site.q === h.q && site.r === h.r);
export const trailSiteKind = (site: TrailSite) => MAP_EXPLORATION.kinds[site.kind];

export function investigateTrailSite(state: GameState, id: string): { ok: boolean; why?: string; message?: string } {
  const site = trailSites(state).find(row => row.id === id);
  if (!site || hexDistance(currentCell(state), site) !== 0) return { ok: false, why: 'Walk to this trail site first.' };
  if (state.walk || state.dungeon || state.phase === 'camp') return { ok: false, why: 'Finish traveling, recovering or the dungeon run first.' };
  if (state.group.length) return { ok: false, why: 'Finish the fight first.' };
  const journal = state.mapJournal ||= newMapJournal(state.seed);
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
  } else {
    if (state.fieldwork.hunger >= fieldwork.F.hunger.max) return { ok: false, why: 'Hunger is already full. You can rest here later.' };
    state.fieldwork.hunger = Math.min(fieldwork.F.hunger.max, state.fieldwork.hunger + kind.hunger_restore);
    message = `${kind.name} · Hunger ${Math.floor(state.fieldwork.hunger)}%`;
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
