import { E, fieldwork, lifeSkills, STORY } from '../../engine/client';
import type { CampPoolKind } from '../../../../engine/types.ts';
import type { CacheOffer } from '../../../../engine/fieldwork.ts';
import type { Character } from '../core/player';
import type { GameState, Cell, Mob } from '../core/types';
import { fieldInFight } from './field-area';
import { addTo, fits } from '../gear/slots';
import { currentCell, rankOf, zoneOf } from './road';
import { farmLevel } from './farm';

export type FieldSkillId = 'mining' | 'woodcutting' | 'hunting' | 'cooking' | 'fishing' | 'smithing';
export interface FieldSkillTrack {
  xp: number;
  mastery: Record<string, number>;
}
export interface FieldCamp {
  cell: Cell;
  zone: number;
}
export interface FieldAction {
  kind: 'mine' | 'grove' | 'fish';
  nextAt: number;
}
export interface FieldMeal {
  id: string;
  untilSec: number;
}
export type CampEncounterPolicy = 'avoid' | 'defend' | 'engage';
/** A camp encounter kind is narrative state only: the project has no audio system and no sound assets. */
export type { CampPoolKind };
export type CampEncounterKind = CampPoolKind;
export type CampEncounterStage = 'warning' | 'choice' | 'combat' | 'resolving' | 'collect';
export interface CampStoryHistory {
  encounterId: number;
  eventId: string;
  kind: CampEncounterKind;
  variantId: string;
  terminalAction: string | null;
  followupUsed: boolean;
}
export interface CampStoryInstance {
  revision: 1;
  eventId: string;
  sceneId: string;
  lineIndex: number;
  beat: number;
  cache: CacheOffer | null;
  remainingSec: number;
}
export interface CampStoryResource { bucket: 'food' | 'material'; id: string; count: number; }
export interface CampStoryReceipt {
  encounterId: number; eventId: string; kind: CampEncounterKind;
  action: string; sceneId: string; elapsedSec: number;
  paid: CampStoryResource[]; earned: CampStoryResource[]; lost: CampStoryResource[];
  info: string[];
}
export interface CampEncounterActive {
  id: number;
  kind: CampEncounterKind;
  stage: CampEncounterStage;
  origin: Cell;
  warningSec: number;
  choiceSec: number;
  payload: Record<string, unknown>;
  preparedGroup: Mob[];
  participantIds: string[];
  story?: CampStoryInstance | null;
}
export interface CampEncounterState {
  policy: CampEncounterPolicy;
  streamState: number;
  serial: number;
  graceSec: number;
  checkSec: number;
  cooldownSec: number;
  exposureSec: number;
  active: CampEncounterActive | null;
  recap: string | null;
  storyHistory: CampStoryHistory[];
  lastReceipt: CampStoryReceipt | null;
}
export interface AutoEatSettings {
  enabled: boolean;
  threshold: number;
  allowRaw: boolean;
}
export interface FieldworkState {
  camp: FieldCamp | null;
  freeRelocationsRemaining: number;
  pushReturn: Cell | null;
  action: FieldAction | null;
  materials: Record<string, number>;
  foods: Record<string, number>;
  hunger: number;
  autoEat: AutoEatSettings;
  skills: Record<FieldSkillId, FieldSkillTrack>;
  activeMeal: FieldMeal | null;
  campEncounters: CampEncounterState;
}

const track = (): FieldSkillTrack => ({ xp: 0, mastery: {} });

export function newCampEncounterState(seed = 0): CampEncounterState {
  return {
    policy: 'avoid', streamState: (seed ^ 0x43414d50) >>> 0, serial: 0,
    graceSec: fieldwork.F.camp_encounters.arrival_grace_sec, checkSec: 0,
    cooldownSec: 0, exposureSec: 0, active: null, recap: null,
    storyHistory: [], lastReceipt: null,
  };
}

const CANONICAL_EVENT_ID: Record<string, string> = {
  'sounds': 'camp-sounds', 'prowler': 'camp-prowler', 'traveler': 'camp-traveler',
  'nest': 'camp-nest', 'discovered': 'camp-discovered', 'supply-cache': 'camp-supply-cache',
};
const LEGAL_TERMINAL_ACTIONS = new Set([
  'investigate', 'quiet', 'fight', 'secure', 'shelter', 'pause', 'listen',
  'trade-ore', 'trade-timber', 'decline', 'cache-careful', 'cache-quick', 'cache-leave',
  'cache-collect', 'cache-cancel', 'timeout', 'cancelled', 'combat-won', 'combat-pushed',
]);
const COMMON_TERMINALS = new Set(['timeout', 'cancelled', 'combat-won', 'combat-pushed']);
const KIND_ACTIONS: Record<string, readonly string[]> = {
  sounds: ['investigate', 'quiet', 'fight'],
  prowler: ['fight', 'secure'],
  nest: ['fight', 'pause'],
  discovered: ['fight', 'shelter'],
  traveler: ['listen', 'trade-ore', 'trade-timber', 'decline'],
  'supply-cache': ['cache-careful', 'cache-quick', 'cache-leave', 'cache-collect', 'cache-cancel'],
};
const validActionForKind = (kind: string, action: string) => COMMON_TERMINALS.has(action) || (KIND_ACTIONS[kind] ?? []).includes(action);
const CACHE_RESULT_SCENES = new Set([
  'cache-careful-result', 'cache-gain-result', 'cache-mixed-result', 'cache-loss-result',
  'cache-left-result', 'cache-cancel-result',
]);
const CAMP_SCENES = new Map(STORY.scenes.filter((scene) => scene.source === 'camp').map((scene) => [scene.id, scene]));
const canonicalScene = (kind: string): string | null =>
  (E.fieldwork.camp_encounters.event_pool as any[]).find((row: any) => row.kind === kind)?.scene_id ?? null;
function allowedScene(kind: string, sceneId: string): boolean {
  if (kind === 'supply-cache') return sceneId === canonicalScene(kind) || CACHE_RESULT_SCENES.has(sceneId);
  if (kind === 'traveler') return sceneId === canonicalScene(kind) || sceneId === 'traveler-return';
  return sceneId === canonicalScene(kind);
}
function validVariant(kind: string, variantId: string): boolean {
  const match = /^(.*)-(\d+)$/.exec(variantId);
  if (!match) return false;
  const scene = CAMP_SCENES.get(match[1]);
  return !!scene && allowedScene(kind, match[1]) && Number(match[2]) < scene.lines.length;
}

function validResourceList(list: unknown): list is CampStoryResource[] {
  if (!Array.isArray(list)) return false;
  return list.every((r) => r && typeof r === 'object' && (r.bucket === 'food' || r.bucket === 'material')
    && typeof r.id === 'string' && r.id.length > 0 && Number.isSafeInteger(r.count) && r.count > 0
    && (r.bucket === 'material' ? fieldwork.F.materials.some((m: any) => m.id === r.id) : !!fieldwork.foodById[r.id]));
}

function validReceipt(raw: any, serial: number): raw is CampStoryReceipt {
  if (!raw || typeof raw !== 'object') return false;
  if (!Number.isSafeInteger(raw.encounterId) || raw.encounterId <= 0 || raw.encounterId > serial) return false;
  if (!Object.keys(CANONICAL_EVENT_ID).includes(raw.kind) || CANONICAL_EVENT_ID[raw.kind] !== raw.eventId) return false;
  if (typeof raw.action !== 'string' || !LEGAL_TERMINAL_ACTIONS.has(raw.action) || !validActionForKind(raw.kind, raw.action)) return false;
  if (typeof raw.sceneId !== 'string' || !CAMP_SCENES.has(raw.sceneId) || !allowedScene(raw.kind, raw.sceneId)) return false;
  if (!Number.isFinite(raw.elapsedSec) || raw.elapsedSec < 0 || raw.elapsedSec > 1e9) return false;
  if (!validResourceList(raw.paid) || !validResourceList(raw.earned) || !validResourceList(raw.lost)) return false;
  if (!Array.isArray(raw.info) || !raw.info.every((i: unknown) => typeof i === 'string')) return false;
  return true;
}

function validCacheOffer(cache: any, zone: number): cache is CacheOffer {
  const cfg = fieldwork.F.camp_encounters;
  if (!cache || typeof cache !== 'object' || cache.revision !== 1) return false;
  const regionalFood = fieldwork.F.regional_sources?.[String(zone)]?.food;
  if (!regionalFood || cache.foodId !== regionalFood) return false;
  if (cache.materialId !== cfg.cache.material_id) return false;
  const unitYield = fieldwork.F.actions.mine.yield;
  const carefulSec = Math.ceil(cfg.cache.careful_intervals * fieldwork.F.actions.mine.interval_sec);
  if (cache.unitYield !== unitYield || cache.carefulSec !== carefulSec) return false;
  if (!['gain', 'mixed', 'loss'].includes(cache.quickOutcome)) return false;
  return true;
}

export function normalizeCampEncounterState(state: GameState): void {
  const defaults = newCampEncounterState(state.seed);
  const raw = state.fieldwork.campEncounters;
  if (!raw || typeof raw !== 'object') {
    state.fieldwork.campEncounters = defaults;
    return;
  }
  if (!['avoid', 'defend', 'engage'].includes(raw.policy)) raw.policy = 'avoid';
  for (const key of ['streamState', 'serial', 'graceSec', 'checkSec', 'cooldownSec', 'exposureSec'] as const) {
    if (!Number.isSafeInteger(raw[key]) || raw[key] < 0) raw[key] = defaults[key];
  }
  raw.streamState >>>= 0;
  raw.exposureSec = Math.min(raw.exposureSec, fieldwork.F.camp_encounters.exposure_cap_sec);
  const active = raw.active;
  if (active != null) {
    const cell = active.origin;
    const validCell = cell && Number.isSafeInteger(cell.q) && Number.isSafeInteger(cell.r)
      && (cell.sub == null || Number.isSafeInteger(cell.sub))
      && (cell.site == null || ['dungeon', 'mine', 'grove', 'fishing'].includes(cell.site));
    const validGroup = Array.isArray(active.preparedGroup) && active.preparedGroup.every((mob) =>
      mob && typeof mob.id === 'string' && typeof mob.speciesId === 'string'
      && ['Small', 'Medium'].includes(mob.kind) && Number.isFinite(mob.hp) && mob.hp > 0
      && Number.isFinite(mob.hpMax) && mob.hpMax >= mob.hp && Number.isSafeInteger(mob.zone));
    const validActive = typeof active === 'object' && Number.isSafeInteger(active.id) && active.id > 0
      && Number.isSafeInteger(raw.serial) && active.id <= raw.serial
      && Object.keys(CANONICAL_EVENT_ID).includes(active.kind)
      && ['warning', 'choice', 'combat', 'resolving', 'collect'].includes(active.stage) && validCell
      && Number.isSafeInteger(active.warningSec) && active.warningSec >= 0
      && Number.isSafeInteger(active.choiceSec) && active.choiceSec >= 0
      && active.payload && typeof active.payload === 'object' && !Array.isArray(active.payload)
      && validGroup && Array.isArray(active.participantIds)
      && active.participantIds.every((id: unknown) => typeof id === 'string')
      && (active.stage !== 'combat' || active.participantIds.length > 0 && active.preparedGroup.length === 0)
      && (active.stage === 'combat' || !['sounds', 'prowler', 'nest', 'discovered'].includes(active.kind) || active.preparedGroup.length > 0)
      && (active.stage === 'combat' || active.participantIds.length === 0)
      && (active.stage === 'resolving' || active.stage === 'collect'
        ? active.kind === 'supply-cache' && validGroup && active.preparedGroup.length === 0 && active.participantIds.length === 0
        : !['resolving', 'collect'].includes(active.stage) || active.kind === 'supply-cache');
    if (!validActive) {
      raw.active = null;
      raw.cooldownSec = Math.max(raw.cooldownSec, fieldwork.F.camp_encounters.cooldown_sec);
    }
    // Story metadata normalization (no RNG): backfill eventId by kind, drop invalid presentation-only fields.
    if (raw.active) {
      const a = raw.active as CampEncounterActive;
      const story = (a as any).story;
      if (story == null) {
        // legacy active retains valid group/timers with null story
      } else if (typeof story !== 'object') {
        (a as any).story = null;
      } else if (story.eventId == null && typeof story === 'object') {
        story.eventId = CANONICAL_EVENT_ID[a.kind];
        // fall through to validation
        const ok = normalizeStory(a, story, state);
        if (!ok && a.kind === 'supply-cache') { raw.active = null; raw.cooldownSec = Math.max(raw.cooldownSec, fieldwork.F.camp_encounters.cooldown_sec); }
      } else {
        const ok = normalizeStory(a, story, state);
        if (!ok && a.kind === 'supply-cache') { raw.active = null; raw.cooldownSec = Math.max(raw.cooldownSec, fieldwork.F.camp_encounters.cooldown_sec); }
      }
    }
  }
  if (typeof raw.recap !== 'string') raw.recap = null;
  if (!Array.isArray(raw.storyHistory)) raw.storyHistory = [];
  raw.storyHistory = raw.storyHistory.filter((h: any) => h && typeof h === 'object'
    && Number.isSafeInteger(h.encounterId) && h.encounterId > 0 && h.encounterId <= raw.serial
    && Object.keys(CANONICAL_EVENT_ID).includes(h.kind) && CANONICAL_EVENT_ID[h.kind] === h.eventId
    && typeof h.variantId === 'string' && validVariant(h.kind, h.variantId)
    && (h.terminalAction === null || (LEGAL_TERMINAL_ACTIONS.has(h.terminalAction) && validActionForKind(h.kind, h.terminalAction)))
    && typeof h.followupUsed === 'boolean');
  raw.storyHistory = raw.storyHistory.slice(-fieldwork.F.camp_encounters.story.recent_limit);
  if (raw.lastReceipt !== null && raw.lastReceipt !== undefined && !validReceipt(raw.lastReceipt, raw.serial)) raw.lastReceipt = null;
  if (raw.lastReceipt === undefined) raw.lastReceipt = null;
  return;
}
function normalizeStory(a: CampEncounterActive, story: any, state: GameState): boolean {
  // Returns false only for cache (caller cancels); for legacy kinds discard story metadata -> null.
  const dropLegacy = (): boolean => { (a as any).story = null; return true; };
  if (story.revision !== 1) return a.kind === 'supply-cache' ? false : dropLegacy();
  if (CANONICAL_EVENT_ID[a.kind] !== story.eventId) return a.kind === 'supply-cache' ? false : dropLegacy();
  if (typeof story.sceneId !== 'string' || !CAMP_SCENES.has(story.sceneId) || !allowedScene(a.kind, story.sceneId))
    return a.kind === 'supply-cache' ? false : dropLegacy();
  const scene = CAMP_SCENES.get(story.sceneId)!;
  if (!Number.isSafeInteger(story.lineIndex) || story.lineIndex < 0 || story.lineIndex >= scene.lines.length)
    return a.kind === 'supply-cache' ? false : dropLegacy();
  if (!Number.isSafeInteger(story.beat) || story.beat < 0) return a.kind === 'supply-cache' ? false : dropLegacy();
  if (!Number.isSafeInteger(story.remainingSec) || story.remainingSec < 0) return a.kind === 'supply-cache' ? false : dropLegacy();
  if (a.kind === 'supply-cache') {
    if (story.sceneId !== canonicalScene('supply-cache')) return false;
    // The cache belongs to the saved origin's zone, not the zone the player may have moved to.
    if (!validCacheOffer(story.cache, state.fieldwork.camp?.zone ?? zoneOf(a.origin) ?? state.zone)) return false;
    if (story.remainingSec > story.cache.carefulSec) return false;
    if (a.stage === 'collect' && story.remainingSec !== 0) return false;
    if ((a.stage === 'warning' || a.stage === 'choice') && story.remainingSec !== 0) return false;
    if (a.stage === 'resolving' && story.remainingSec > story.cache.carefulSec) return false;
    if (a.preparedGroup.length !== 0 || a.participantIds.length !== 0) return false;
  } else {
    if (story.cache !== null && story.cache !== undefined) return dropLegacy();
    if (story.remainingSec !== 0) return dropLegacy();
    if (a.stage === 'resolving' || a.stage === 'collect') return dropLegacy();
    story.cache = null;
  }
  return true;
}

export function newFieldwork(seed = 0): FieldworkState {
  return {
    camp: null,
    freeRelocationsRemaining: fieldwork.F.camp.free_relocations,
    pushReturn: null,
    action: null,
    materials: Object.fromEntries(fieldwork.F.materials.map((material: any) => [material.id, 0])),
    foods: Object.fromEntries(fieldwork.foods.map((food: any) => [food.id, 0])),
    hunger: fieldwork.F.hunger.max,
    autoEat: {
      enabled: fieldwork.F.hunger.auto_eat.enabled_default,
      threshold: fieldwork.F.hunger.auto_eat.threshold_default,
      allowRaw: fieldwork.F.hunger.auto_eat.allow_raw_default,
    },
    skills: { mining: track(), woodcutting: track(), hunting: track(), cooking: track(), fishing: track(), smithing: track() },
    activeMeal: null,
    campEncounters: newCampEncounterState(seed),
  };
}

/** Spend Hunger only on active field loops. A town and a safe, idle Camp remain true rest points. */
export function tickHunger(state: GameState, online = true): string | null {
  const fw = state.fieldwork;
  const config = fieldwork.F.hunger;
  if (state.phase !== 'camp') {
    const rate = state.walk
      ? (online ? config.drain_per_sec.travel : 0)
      : state.hunting || state.dungeon
        ? config.drain_per_sec.hunting
        : fw.action
          ? config.drain_per_sec.gathering
          : 0;
    fw.hunger = Math.max(0, fw.hunger - rate);
  }

  if (!fw.autoEat.enabled || fw.hunger > fw.autoEat.threshold) return null;
  const priority = config.auto_eat.priority;
  for (const kind of priority) {
    const emergencyRaw = kind === 'raw' && config.auto_eat.emergency_raw_at_zero && fw.hunger <= 0;
    if (kind === 'raw' && !fw.autoEat.allowRaw && !emergencyRaw) continue;
    if (kind === 'cooked' && activeMeal(state) && fw.hunger > 0) continue;
    const candidates = fieldwork.foods
      .filter((food: any) => food.edible && food.kind === kind && (food.auto_eat || (kind === 'raw' && (fw.autoEat.allowRaw || emergencyRaw))) && (fw.foods[food.id] || 0) > 0)
      .sort((a: any, b: any) => b.hunger_restore - a.hunger_restore);
    const food = candidates[0];
    if (!food) continue;
    const result = eatMeal(state, food.id);
    if (result.ok) return `Auto Eat · ${food.name} · Hunger ${Math.floor(fw.hunger)}%`;
  }
  return null;
}

export interface TravelEventReceipt {
  resourceDeltas: { bucket: 'food' | 'material'; id: string; count: number }[];
  hungerDelta: number;
}

/** An independent road event roll; its supplies and rest never add a mob group. */
export function resolveTravelEvent(state: GameState, rng: () => number, receipt?: (entry: TravelEventReceipt) => void): string | null {
  const config = fieldwork.F.travel_events;
  if (rng() >= config.chance_per_block) return null;
  const totalWeight = config.events.reduce((sum: number, event: any) => sum + event.weight, 0);
  let roll = rng() * totalWeight;
  const event = config.events.find((row: any) => (roll -= row.weight) < 0) || config.events.at(-1);
  if (!event) return null;
  if (event.kind === 'restore') {
    const before = state.fieldwork.hunger;
    state.fieldwork.hunger = Math.min(fieldwork.F.hunger.max, before + event.hunger_restore);
    receipt?.({ resourceDeltas: [], hungerDelta: state.fieldwork.hunger - before });
    return `${event.text} · Hunger ${Math.floor(state.fieldwork.hunger)}%`;
  }
  const amount = event.amount_min + Math.floor(rng() * (event.amount_max - event.amount_min + 1));
  const localFood = fieldwork.F.regional_sources?.[state.zone]?.food;
  const food = fieldwork.foodById[localFood] || fieldwork.foodById[event.food_id];
  if (!food) return null;
  const received = addTo(state, state.fieldwork.foods, food.id, 'food', amount);
  receipt?.({ resourceDeltas: [{ bucket: 'food', id: food.id, count: received }], hungerDelta: 0 });
  const zoneName = E.mob.zones.find((zone: any) => zone.id === state.zone)?.name || 'the trail';
  return received
    ? `Found ${food.name} along ${zoneName} · ${food.name} ×${received}`
    : `Found ${food.name} along ${zoneName}, but the food bag is full`;
}

export function fieldSkillLevel(state: GameState, id: FieldSkillId): number {
  return fieldwork.skillLevel(state.fieldwork.skills[id]?.xp || 0);
}

export function fieldMasteryLevel(state: GameState, id: FieldSkillId, key: string): number {
  return fieldwork.masteryLevel(state.fieldwork.skills[id]?.mastery[key] || 0);
}

export function lifeSkillBonuses(state: GameState) {
  const levels: Record<string, number> = Object.fromEntries(Object.keys(state.fieldwork.skills).map((id) => [id, fieldSkillLevel(state, id as FieldSkillId)]));
  levels.farming = farmLevel(state);
  return lifeSkills.bonuses(levels);
}

export function fieldHarvestBonus(state: GameState, id: FieldSkillId): number {
  return fieldwork.harvestBonus(fieldSkillLevel(state, id));
}

export function fieldHarvestAmount(state: GameState, id: FieldSkillId, baseAmount: number): number {
  return baseAmount + fieldHarvestBonus(state, id);
}

export function fieldDropChance(state: GameState, id: FieldSkillId, masteryKey: string, baseChance: number): number {
  return fieldwork.dropChanceAt(baseChance, fieldSkillLevel(state, id), fieldMasteryLevel(state, id, masteryKey));
}

export function fieldSite(cell: Cell | null | undefined): 'dungeon' | 'mine' | 'grove' | 'fishing' | 'hunt' | null {
  if (!cell || rankOf(cell) === 0) return null;
  return cell.site ?? 'hunt';
}

/** A Camp is safe ground and the field Push return point; it does not change harvest yield. */
export function campHere(state: GameState): boolean {
  const camp = state.fieldwork?.camp;
  if (!camp || !state.cell) return false;
  const feet = currentCell(state);
  return !state.walk && camp.zone === state.zone && camp.cell.q === feet.q && camp.cell.r === feet.r;
}

/** Establish the first safe field Camp for free; each relocation consumes the configured timber cost. */
export function establishCamp(state: GameState): { ok: boolean; why?: string; moved?: boolean } {
  if (state.walk) return { ok: false, why: 'finish the walk first' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering after a Push' };
  if (state.dungeon) return { ok: false, why: 'leave the dungeon before setting Camp' };
  if (fieldInFight(state) || (state.hunting && state.group.length)) return { ok: false, why: 'finish the fight first' };
  if (!state.cell || rankOf(state.cell) === 0) return { ok: false, why: 'Camp must be set on a field hex' };
  const feet = currentCell(state);
  const prior = state.fieldwork.camp;
  const same = !!prior && prior.zone === state.zone && prior.cell.q === feet.q && prior.cell.r === feet.r;
  if (same) return { ok: false, why: 'Camp is already here' };
  const freeMove = !!prior && state.fieldwork.freeRelocationsRemaining > 0;
  const timberCost = prior && !freeMove ? fieldwork.F.camp.relocate_timber : 0;
  const oreCost = prior && !freeMove ? fieldwork.F.camp.relocate_ore : 0;
  const missing = [
    (state.fieldwork.materials.timber || 0) < timberCost ? `${timberCost} timber` : '',
    (state.fieldwork.materials.ore || 0) < oreCost ? `${oreCost} ore` : '',
  ].filter(Boolean);
  if (missing.length) return { ok: false, why: `relocating Camp needs ${missing.join(' + ')}` };
  if (freeMove) state.fieldwork.freeRelocationsRemaining--;
  if (timberCost) state.fieldwork.materials.timber -= timberCost;
  if (oreCost) state.fieldwork.materials.ore -= oreCost;
  const cell = { ...state.cell, q: feet.q, r: feet.r };
  state.fieldwork.camp = { cell, zone: zoneOf(feet) ?? state.zone };
  state.fieldwork.action = null;
  state.group = [];
  state.hunting = false;
  state.player.atkTimer = 0;
  return { ok: true, moved: !!prior };
}

export function fieldActionProblem(state: GameState, kind: 'mine' | 'grove' | 'fish'): string | null {
  const wanted = kind === 'fish' ? 'fishing' : kind;
  if (fieldSite(state.cell) !== wanted) return kind === 'mine' ? 'stand on a Mine wild-side cell'
    : kind === 'grove' ? 'stand on a Grove wild-side cell' : 'stand on a Fishing wild-side cell';
  if (state.fieldwork.campEncounters?.active?.kind === 'nest') return 'clear the nearby nest before gathering';
  if (fieldInFight(state) || state.group.length || state.hunting) return 'finish the fight before gathering';
  if (state.phase === 'camp' || state.dungeon || state.walk) return 'gathering is unavailable right now';
  if (kind === 'fish') {
    const food = fieldwork.F.regional_sources[String(state.zone)]?.food;
    if (!food || !fieldwork.F.fishing.foods.includes(food)) return 'this zone has no authored fishing source';
  }
  return null;
}

export function startFieldAction(state: GameState, kind: 'mine' | 'grove' | 'fish'): { ok: boolean; why?: string } {
  const why = fieldActionProblem(state, kind);
  if (why) return { ok: false, why };
  state.fieldwork.action = { kind, nextAt: state.clockSec + (kind === 'fish' ? fieldwork.F.fishing.interval_sec : fieldwork.F.actions[kind].interval_sec) };
  return { ok: true };
}

export function stopFieldAction(state: GameState): void {
  state.fieldwork.action = null;
}

function grantSkill(state: GameState, id: FieldSkillId, xp: number, masteryKey: string, masteryXp: number): void {
  const skill = state.fieldwork.skills[id];
  skill.xp += xp;
  skill.mastery[masteryKey] = (skill.mastery[masteryKey] || 0) + masteryXp;
}

/** One wild-side gathering action per configured interval; the cell, not a Camp, is the gate. */
export function tickFieldwork(state: GameState, rng: () => number): void {
  if (state.fieldwork.activeMeal && state.clockSec >= state.fieldwork.activeMeal.untilSec) state.fieldwork.activeMeal = null;
  const action = state.fieldwork.action;
  if (!action) return;
  const wanted = action.kind === 'fish' ? 'fishing' : action.kind;
  if (fieldSite(state.cell) !== wanted || fieldInFight(state) || state.group.length || state.hunting
    || state.dungeon || state.walk || state.phase === 'camp') {
    state.fieldwork.action = null;
    return;
  }
  const skill: FieldSkillId = action.kind === 'mine' ? 'mining' : action.kind === 'grove' ? 'woodcutting' : 'fishing';
  while (action.nextAt <= state.clockSec) {
    if (action.kind === 'fish') {
      const foodId = fieldwork.F.regional_sources[String(state.zone)]?.food;
      const food = foodId && fieldwork.F.fishing.foods.includes(foodId) ? fieldwork.foodById[foodId] : null;
      const received = food ? addTo(state, state.fieldwork.foods, food.id, 'food', fieldHarvestAmount(state, 'fishing', fieldwork.F.fishing.yield)) : 0;
      if (!received) { state.fieldwork.action = null; return; }
      grantSkill(state, 'fishing', fieldwork.F.fishing.xp, food!.id, fieldwork.F.fishing.mastery_xp);
      action.nextAt += fieldwork.F.fishing.interval_sec;
      continue;
    }
    const cfg = fieldwork.F.actions[action.kind];
    const received = addTo(state, state.fieldwork.materials, cfg.resource, 'material', fieldHarvestAmount(state, skill, cfg.yield));
    if (!received) {
      state.fieldwork.action = null;
      return;
    }    grantSkill(state, skill, cfg.xp, action.kind, cfg.mastery_xp);
    if (cfg.rare_drop_chance && cfg.rare_resource && rng() < fieldDropChance(state, skill, action.kind, cfg.rare_drop_chance)) {
      addTo(state, state.fieldwork.materials, cfg.rare_resource, 'material', 1);
    }
    if (cfg.food_drop_chance && cfg.food_id && rng() < fieldDropChance(state, skill, action.kind, cfg.food_drop_chance)) {
      addTo(state, state.fieldwork.foods, cfg.food_id, 'food', 1);
    }
    const regional = fieldwork.F.regional_sources[String(state.zone)];
    if (regional) {
      const resource = regional[action.kind];
      if (rng() < fieldDropChance(state, skill, resource, fieldwork.F.regional_drop_chance)) {
        const received = addTo(state, state.fieldwork.materials, resource, 'material', fieldHarvestAmount(state, skill, cfg.yield));
        if (received) state.fieldwork.skills[skill].mastery[resource] = (state.fieldwork.skills[skill].mastery[resource] || 0) + cfg.mastery_xp;
      }
      if (action.kind === 'grove' && rng() < fieldDropChance(state, skill, regional.food, fieldwork.F.regional_food_chance)) {
        addTo(state, state.fieldwork.foods, regional.food, 'food', fieldwork.F.regional_food_yield);
      }
    }
    action.nextAt += cfg.interval_sec;
  }
}

export function recordHuntKill(state: GameState, speciesId: string, rng: () => number): string | null {
  if (!state.hunting || state.dungeon) return null;
  const config = fieldwork.F.hunt;
  grantSkill(state, 'hunting', config.xp_per_kill, speciesId, config.mastery_xp_per_kill);
  const drops: string[] = [];
  if (config.edible_species.includes(speciesId) && rng() < fieldDropChance(state, 'hunting', speciesId, config.meat_drop_chance)) {
    const amount = config.meat_min + Math.floor(rng() * (config.meat_max - config.meat_min + 1)) + fieldHarvestBonus(state, 'hunting');
    const received = addTo(state, state.fieldwork.foods, 'raw_game_meat', 'food', amount);
    if (received) drops.push(`Raw Game Meat ×${received}`);
  }
  for (const drop of config.food_drops) {
    if (!drop.species.includes(speciesId) || rng() >= fieldDropChance(state, 'hunting', speciesId, drop.chance)) continue;
    const amount = drop.min + Math.floor(rng() * (drop.max - drop.min + 1)) + fieldHarvestBonus(state, 'hunting');
    const food = fieldwork.foodById[drop.food_id];
    const received = food ? addTo(state, state.fieldwork.foods, food.id, 'food', amount) : 0;
    if (food && received) drops.push(`${food.name} ×${received}`);
  }
  // The metal and wood a body is made of pays into the same `materials` map `mine` and `grove` fill,
  // so a kill is the chance you meet and the hex stays the bulk source (`fieldwork.hunt.material_drops`).
  for (const drop of config.material_drops || []) {
    if (!drop.species.includes(speciesId) || rng() >= fieldDropChance(state, 'hunting', speciesId, drop.chance)) continue;
    const amount = drop.min + Math.floor(rng() * (drop.max - drop.min + 1)) + fieldHarvestBonus(state, 'hunting');
    const received = addTo(state, state.fieldwork.materials, drop.resource, 'material', amount);
    if (received) drops.push(`${drop.resource} ×${received}`);
  }
  return drops.length ? drops.join(' · ') : null;
}

export function canCook(state: GameState, recipeId: string): { ok: boolean; why?: string } {
  const recipe = fieldwork.recipeById[recipeId];
  if (!recipe) return { ok: false, why: 'unknown recipe' };
  if (!campHere(state)) return { ok: false, why: 'stand at your Camp to cook' };
  if (fieldInFight(state) || state.group.length || state.hunting) return { ok: false, why: 'return to safe Camp before cooking' };
  if (state.phase === 'camp' || state.dungeon || state.walk) return { ok: false, why: 'cooking is unavailable right now' };
  if (fieldSkillLevel(state, 'cooking') < recipe.level) return { ok: false, why: `Cooking level ${recipe.level} required` };
  for (const [name, amount] of Object.entries(recipe.materials as Record<string, number>)) {
    if ((state.fieldwork.materials[name] || 0) < amount) return { ok: false, why: `needs ${amount} ${name}` };
  }
  for (const [name, amount] of Object.entries(recipe.foods as Record<string, number>)) {
    if ((state.fieldwork.foods[name] || 0) < amount) return { ok: false, why: `needs ${amount} ${fieldwork.foodById[name]?.name || name}` };
  }
  for (const [tier, amount] of Object.entries(recipe.herbs as Record<string, number>)) {
    if ((state.farm.herbs[tier] || 0) < amount) return { ok: false, why: `needs ${amount} ${tier} herb` };
  }
  const costs = [
    ...Object.entries(recipe.materials as Record<string, number>).map(([key, amount]) => ({ bucket: state.fieldwork.materials, key, amount, capKind: 'material' })),
    ...Object.entries(recipe.foods as Record<string, number>).map(([key, amount]) => ({ bucket: state.fieldwork.foods, key, amount, capKind: 'food' })),
    ...Object.entries(recipe.herbs as Record<string, number>).map(([key, amount]) => ({ bucket: state.farm.herbs, key, amount, capKind: 'herb' })),
  ];
  if (!fits(state, state.fieldwork.foods, recipe.id, 'food', 1, costs)) return { ok: false, why: 'bag has no room for food' };
  return { ok: true };
}

export function cookMeal(state: GameState, recipeId: string, count = 1): { ok: boolean; why?: string; made?: number } {
  if (!Number.isSafeInteger(count) || count < 1) return { ok: false, why: 'choose a positive whole batch', made: 0 };
  const batch = Math.min(count, 1 + Math.floor(fieldMasteryLevel(state, 'cooking', recipeId) / 20));
  let made = 0;
  for (; made < batch; made++) {
    const verdict = canCook(state, recipeId);
    if (!verdict.ok) return count === 1 ? { ok: made > 0, why: verdict.why } : { ok: made > 0, why: verdict.why, made };
    const recipe = fieldwork.recipeById[recipeId];
    for (const [name, amount] of Object.entries(recipe.materials as Record<string, number>)) state.fieldwork.materials[name] -= amount;
    for (const [name, amount] of Object.entries(recipe.foods as Record<string, number>)) state.fieldwork.foods[name] -= amount;
    for (const [tier, amount] of Object.entries(recipe.herbs as Record<string, number>)) state.farm.herbs[tier] -= amount;
    addTo(state, state.fieldwork.foods, recipe.id, 'food', 1);
    grantSkill(state, 'cooking', recipe.xp, recipe.id, recipe.mastery_xp);
  }
  return count === 1 ? { ok: true } : { ok: true, made };
}

export function eatMeal(state: GameState, recipeId: string): { ok: boolean; why?: string } {
  const food = fieldwork.foodById[recipeId];
  if ((state.fieldwork.foods[recipeId] || 0) <= 0) return { ok: false, why: 'not in the food bag' };
  if (!food) return { ok: false, why: 'unknown food' };
  if (!food.edible) return { ok: false, why: 'this is a cooking ingredient' };
  state.fieldwork.foods[recipeId]--;
  state.fieldwork.hunger = Math.min(fieldwork.F.hunger.max, state.fieldwork.hunger + food.hunger_restore);
  const recipe = fieldwork.recipeById[recipeId];
  if (recipe) state.fieldwork.activeMeal = { id: recipeId, untilSec: state.clockSec + recipe.duration_sec };
  return { ok: true };
}

export function activeMeal(state: GameState) {
  const active = state.fieldwork?.activeMeal;
  if (!active || state.clockSec >= active.untilSec) return null;
  const recipe = fieldwork.recipeById[active.id];
  return recipe ? { ...recipe, untilSec: active.untilSec, secondsLeft: active.untilSec - state.clockSec } : null;
}

/** Apply the one active meal to the same character snapshot used by both the field and combat. */
export function withMeal(character: Character, state: GameState): Character {
  const meal = activeMeal(state);
  if (!meal) return character;
  const mult = 1 + meal.damage_pct / 100;
  const elemByElement = Object.fromEntries(Object.entries(character.elemByElement).map(([key, value]) => [key, value * mult]));
  return {
    ...character,
    phys: character.phys * mult,
    magic: character.magic * mult,
    elem: character.elem * mult,
    elemByElement,
    hpRegen: character.hpRegen + character.maxHp * meal.hp_regen_pct / 100,
  };
}

/** Hunger only weakens ordinary HP regeneration; Energy Shield recharge is its separate rule. */
export function withHunger(character: Character, state: GameState): Character {
  if (state.fieldwork.hunger > 0) return character;
  return {
    ...character,
    hpRegen: character.hpRegen * (1 - fieldwork.F.hunger.empty_hp_regen_cut_pct / 100),
  };
}

export function pushToFieldCamp(state: GameState, pushedZone = state.zone): boolean {
  const camp = state.fieldwork?.camp;
  if (!camp || camp.zone !== pushedZone) return false;
  state.fieldwork.action = null;
  state.fieldwork.pushReturn = { ...camp.cell };
  state.cell = { ...camp.cell };
  state.walk = null;
  state.zone = camp.zone;
  state.hunting = false;
  return true;
}

export function finishPushAtCamp(state: GameState): boolean {
  const dest = state.fieldwork?.pushReturn;
  if (!dest) return false;
  state.cell = { ...dest };
  state.fieldwork.pushReturn = null;
  state.phase = 'fighting';
  state.hunting = false;
  state.group = [];
  return true;
}
