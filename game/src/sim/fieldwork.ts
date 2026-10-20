import { E, fieldwork, lifeSkills } from '../engine/client';
import type { Character } from './player';
import type { GameState, Cell, Mob } from './types';
import { addTo, fits } from './slots';
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
export type CampEncounterKind = 'sounds' | 'prowler' | 'traveler' | 'nest' | 'herd' | 'injured' | 'discovered';
export interface CampEncounterActive {
  id: number;
  kind: CampEncounterKind;
  stage: 'warning' | 'choice' | 'combat';
  origin: Cell;
  warningSec: number;
  choiceSec: number;
  payload: Record<string, unknown>;
  preparedGroup: Mob[];
  participantIds: string[];
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
  };
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
      && (cell.sub == null || Number.isSafeInteger(cell.sub)) && (cell.wild == null || Number.isSafeInteger(cell.wild));
    const validGroup = Array.isArray(active.preparedGroup) && active.preparedGroup.every((mob) =>
      mob && typeof mob.id === 'string' && typeof mob.speciesId === 'string'
      && ['Small', 'Medium'].includes(mob.kind) && Number.isFinite(mob.hp) && mob.hp > 0
      && Number.isFinite(mob.hpMax) && mob.hpMax >= mob.hp && Number.isSafeInteger(mob.zone));
    const validActive = typeof active === 'object' && Number.isSafeInteger(active.id) && active.id > 0
      && Number.isSafeInteger(raw.serial) && active.id <= raw.serial
      && ['sounds', 'prowler', 'traveler', 'nest', 'herd', 'injured', 'discovered'].includes(active.kind)
      && ['warning', 'choice', 'combat'].includes(active.stage) && validCell
      && Number.isSafeInteger(active.warningSec) && active.warningSec >= 0
      && Number.isSafeInteger(active.choiceSec) && active.choiceSec >= 0
      && active.payload && typeof active.payload === 'object' && !Array.isArray(active.payload)
      && validGroup && Array.isArray(active.participantIds)
      && active.participantIds.every((id: unknown) => typeof id === 'string')
      && (active.stage !== 'combat' || active.participantIds.length > 0 && active.preparedGroup.length === 0)
      && (active.stage === 'combat' || !['sounds', 'prowler', 'nest', 'discovered'].includes(active.kind) || active.preparedGroup.length > 0)
      && (active.stage === 'combat' || active.participantIds.length === 0);
    if (!validActive) {
      raw.active = null;
      raw.cooldownSec = Math.max(raw.cooldownSec, fieldwork.F.camp_encounters.cooldown_sec);
    }
  }
  if (typeof raw.recap !== 'string') raw.recap = null;
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

/** An independent road event roll; its supplies and rest do not replace the block's ambush roll. */
export function resolveTravelEvent(state: GameState, rng: () => number): string | null {
  const config = fieldwork.F.travel_events;
  if (rng() >= config.chance_per_block) return null;
  const totalWeight = config.events.reduce((sum: number, event: any) => sum + event.weight, 0);
  let roll = rng() * totalWeight;
  const event = config.events.find((row: any) => (roll -= row.weight) < 0) || config.events.at(-1);
  if (!event) return null;
  if (event.kind === 'restore') {
    const before = state.fieldwork.hunger;
    state.fieldwork.hunger = Math.min(fieldwork.F.hunger.max, before + event.hunger_restore);
    return `${event.text} · Hunger ${Math.floor(state.fieldwork.hunger)}%`;
  }
  const amount = event.amount_min + Math.floor(rng() * (event.amount_max - event.amount_min + 1));
  const localFood = fieldwork.F.regional_sources?.[state.zone]?.food;
  const food = fieldwork.foodById[localFood] || fieldwork.foodById[event.food_id];
  if (!food) return null;
  const received = addTo(state, state.fieldwork.foods, food.id, 'food', amount);
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

export function fieldSite(cell: Cell | null | undefined): 'dungeon' | 'mine' | 'grove' | 'hunt' | null {
  if (!cell || rankOf(cell) === 0) return null;
  const named = fieldwork.siteAt(cell.wild);
  if (named) return named;
  return 'hunt';
}

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
  if (state.group.length) return { ok: false, why: 'finish the fight first' };
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
  state.patrol.active = false;
  state.autoReturn.phase = 'idle';
  state.autoReturn.resumeCell = null;
  state.fieldwork.action = null;
  state.group = [];
  state.hunting = false;
  state.spawnIn = 0;
  state.player.atkTimer = 0;
  return { ok: true, moved: !!prior };
}

export function leaveCamp(state: GameState): { ok: boolean; why?: string } {
  if (!campHere(state)) return { ok: false, why: 'stand at your Camp first' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering after a Push' };
  if (state.dungeon) return { ok: false, why: 'already in a dungeon run' };
  state.fieldwork.action = null;
  state.hunting = true;
  state.group = [];
  state.spawnIn = 0;
  state.player.atkTimer = 0;
  return { ok: true };
}

export function returnToCamp(state: GameState): { ok: boolean; why?: string } {
  if (!campHere(state)) return { ok: false, why: 'walk back to your Camp first' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering after a Push' };
  if (state.dungeon || state.walk) return { ok: false, why: 'leave the dungeon or finish the walk first' };
  state.fieldwork.action = null;
  state.hunting = false;
  state.group = [];
  state.spawnIn = 0;
  state.player.atkTimer = 0;
  return { ok: true };
}

export function fieldActionProblem(state: GameState, kind: 'mine' | 'grove' | 'fish'): string | null {
  if (!campHere(state)) return 'set Camp on this hex first';
  if (state.fieldwork.campEncounters?.active?.kind === 'nest') return 'clear the nearby nest before gathering';
  if (state.hunting || state.group.length) return 'return to safe Camp before gathering';
  if (state.phase === 'camp' || state.dungeon || state.walk) return 'gathering is unavailable right now';
  if (kind === 'fish') {
    const food = fieldwork.F.regional_sources[String(state.zone)]?.food;
    if (!food || !fieldwork.F.fishing.foods.includes(food)) return 'this zone has no authored fishing source';
  } else if (fieldSite(state.cell) !== kind) return kind === 'mine' ? 'stand at a Mine hex' : 'stand at a Rare Grove';
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

/** One idle mining or tree-cutting action per configured interval. Pausing combat makes the field safe. */
export function tickFieldwork(state: GameState, rng: () => number): void {
  if (state.fieldwork.activeMeal && state.clockSec >= state.fieldwork.activeMeal.untilSec) state.fieldwork.activeMeal = null;
  const action = state.fieldwork.action;
  if (!action) return;
  if (!campHere(state) || state.hunting || state.group.length || state.dungeon || state.walk || state.phase === 'camp') {
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
    }
    grantSkill(state, skill, cfg.xp, action.kind, cfg.mastery_xp);
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
  if (state.hunting || state.group.length) return { ok: false, why: 'return to safe Camp before cooking' };
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
  state.spawnIn = 0;
  return true;
}
