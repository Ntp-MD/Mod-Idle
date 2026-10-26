import { afterEach, describe, expect, it, vi } from 'vitest';
import { E, TOWN, eng, farm, fieldwork, lifeSkills, road, STAT_KEYS } from '../src/engine/client';
import { newGame, huntHere } from '../src/sim/game';
import {
  cookMeal, establishCamp, fieldHarvestAmount, fieldSkillLevel, lifeSkillBonuses,
  returnToCamp, startFieldAction, tickFieldwork,
} from '../src/sim/fieldwork';
import { farmGrowthSec, farmLevel, harvest, plant } from '../src/sim/farm';
import { processMaterials } from '../src/sim/trade';
import { buildCharacter } from '../src/sim/player';
import { reservedPct, usableMana } from '../src/sim/skills';
import { lifeSkillMilestones } from '../src/sim/goal';
import { settlementCell, startWalk, zoneOf } from '../src/sim/road';
import { slotsAvailable } from '../src/sim/slots';
import { exportJson, importJson, migrate } from '../src/state/save';
import type { Item } from '../src/sim/types';
import type { LifeSkillId } from '../../engine/life-skills';

afterEach(() => vi.restoreAllMocks());
const xpAt = (level: number) => (level - 1) ** 2 * E.fieldwork.level_divisor;
const masteryAt = (level: number) => (level - 1) ** 2 * E.fieldwork.mastery_divisor;
function safeTown() {
  const state = newGame(304);
  state.cell = settlementCell(state.town.visited[0])!;
  state.hunting = false; state.group = [];
  return state;
}
function fishingCamp(fishable = true) {
  const state = safeTown();
  const zone = Object.entries(E.fieldwork.regional_sources).find(([, row]) => E.fieldwork.fishing.foods.includes(row.food) === fishable)![0];
  const town = TOWN.settlements.find((row) => row.zone === Number(zone))!;
  const side = road.neighbours(settlementCell(town.id)!).find((cell: { q: number; r: number }) => zoneOf(cell) === town.zone)!;
  state.cell = { ...side, sub: null, wild: null }; state.zone = town.zone;
  expect(establishCamp(state).ok).toBe(true);
  return state;
}
function unchanged<T>(state: ReturnType<typeof newGame>, action: () => T) {
  const before = JSON.stringify(state), result = action();
  expect(JSON.stringify(state)).toBe(before);
  return result;
}

describe('Fishing and safe activities', () => {
  it('requires a safe Camp in an authored fishing zone and schedules only future catches', () => {
    const unavailable = fishingCamp(false);
    expect(unchanged(unavailable, () => startFieldAction(unavailable, 'fish')).ok).toBe(false);
    const state = fishingCamp(); state.clockSec = 50000;
    const oldXp = state.player.xp, cfg = E.fieldwork.fishing;
    expect(startFieldAction(state, 'fish').ok).toBe(true);
    const food = E.fieldwork.regional_sources[String(state.zone) as keyof typeof E.fieldwork.regional_sources].food;
    const before = state.fieldwork.foods[food] || 0;
    expect(state.fieldwork.action?.nextAt).toBe(state.clockSec + cfg.interval_sec);
    state.clockSec += cfg.interval_sec - 1; tickFieldwork(state, () => 0);
    expect(state.fieldwork.foods[food] || 0).toBe(before);
    state.clockSec++; tickFieldwork(state, () => 0);
    expect(state.fieldwork.foods[food]).toBe(before + cfg.yield);
    expect(state.fieldwork.skills.fishing.xp).toBe(cfg.xp);
    expect(state.fieldwork.skills.fishing.mastery[food]).toBe(cfg.mastery_xp);
    expect(state.player.xp).toBe(oldXp);
    state.fieldwork.action = null; state.fieldwork.camp = null;
    expect(unchanged(state, () => startFieldAction(state, 'fish')).ok).toBe(false);
  });

  it('stops on primary full-bag refusal without skill or Mastery XP', () => {
    const state = fishingCamp();
    state.junk['full-bag fixture'] = slotsAvailable(state) * E.inventory.stack_size.stone;
    // Remove opening provisions so the fixture contains exactly a full bag.
    for (const bucket of [state.farm.herbs, state.counters.stones, state.farm.potions, state.farm.condensed,
      state.fieldwork.foods, state.fieldwork.materials]) for (const key of Object.keys(bucket)) bucket[key] = 0;
    expect(startFieldAction(state, 'fish').ok).toBe(true);
    state.clockSec = state.fieldwork.action!.nextAt;
    const skill = structuredClone(state.fieldwork.skills.fishing);
    tickFieldwork(state, () => 0);
    expect(state.fieldwork.action).toBeNull();
    expect(state.fieldwork.skills.fishing).toEqual(skill);
  });

  it('applies existing harvest progression to Fishing and keeps hunting/gathering exclusive', () => {
    const state = fishingCamp();
    const milestone = E.fieldwork.progression.harvest_bonus_levels[0];
    state.fieldwork.skills.fishing.xp = xpAt(milestone);
    const food = E.fieldwork.regional_sources[String(state.zone) as keyof typeof E.fieldwork.regional_sources].food;
    const before = state.fieldwork.foods[food] || 0;
    expect(startFieldAction(state, 'fish').ok).toBe(true);
    state.clockSec = state.fieldwork.action!.nextAt; tickFieldwork(state, () => 0);
    expect(state.fieldwork.foods[food] - before).toBe(fieldHarvestAmount(state, 'fishing', E.fieldwork.fishing.yield));
    expect(huntHere(state).ok).toBe(true);
    expect(state.fieldwork.action).toBeNull();
    expect(state.hunting).toBe(true);
    expect(unchanged(state, () => startFieldAction(state, 'fish')).ok).toBe(false);
    expect(returnToCamp(state).ok).toBe(true);
    expect(startFieldAction(state, 'fish').ok).toBe(true);
    state.hunting = true; // legacy impossible XOR is resolved in favor of hunting.
    const xp = state.fieldwork.skills.fishing.xp;
    state.clockSec += E.fieldwork.fishing.interval_sec; tickFieldwork(state, () => 0);
    expect(state.fieldwork.action).toBeNull();
    expect(state.fieldwork.skills.fishing.xp).toBe(xp);
    expect(state.hunting).toBe(true);
  });
});

describe('Smithing, cooking batches and Farming Mastery', () => {
  it('crafts iron components at a safe settlement with the authored owners, costs, XP and Mastery', () => {
    const state = safeTown(), beforeCharXp = state.player.xp;
    state.fieldwork.materials['iron-ore'] = 4;
    state.fieldwork.materials.timber = 1;
    const bar = fieldwork.workshopById['iron-bar'], brackets = fieldwork.workshopById['iron-brackets'];
    expect(bar.skill).toBe('smithing'); expect(brackets.skill).toBe('smithing');
    expect(processMaterials(state, bar.id).ok).toBe(true);
    expect(state.fieldwork.materials['iron-ore']).toBe(4 - bar.materials['iron-ore']);
    expect(state.fieldwork.skills.smithing.xp).toBe(bar.xp);
    expect(state.fieldwork.skills.smithing.mastery[bar.id]).toBe(bar.mastery_xp);
    expect(processMaterials(state, brackets.id).ok).toBe(false);
    state.fieldwork.skills.smithing.xp = xpAt(brackets.level);
    expect(processMaterials(state, bar.id).ok).toBe(true);
    const xp = state.fieldwork.skills.smithing.xp;
    expect(processMaterials(state, brackets.id).ok).toBe(true);
    expect(state.fieldwork.materials['iron-bar']).toBe(0);
    expect(state.fieldwork.materials['iron-brackets']).toBe(brackets.yield);
    expect(state.fieldwork.materials.timber).toBe(0);
    expect(state.fieldwork.skills.smithing.xp).toBe(xp + brackets.xp);
    expect(state.fieldwork.skills.mining.xp).toBe(0);
    expect(state.player.xp).toBe(beforeCharXp);
    for (const recipe of E.fieldwork.workshop_recipes) expect(fieldwork.workshopById[recipe.id].skill).toBe(recipe.skill);
  });

  it('refuses Smithing during field activities, walking, recovery, dungeon and output overflow without costs', () => {
    const setups = [
      (state: ReturnType<typeof newGame>) => { state.hunting = true; },
      (state: ReturnType<typeof newGame>) => { state.phase = 'camp'; },
      (state: ReturnType<typeof newGame>) => { state.fieldwork.action = { kind: 'fish', nextAt: 100 }; },
      (state: ReturnType<typeof newGame>) => { state.dungeon = {} as NonNullable<typeof state.dungeon>; },
      (state: ReturnType<typeof newGame>) => { startWalk(state, settlementCell(TOWN.settlements[1].id)!); },
      (state: ReturnType<typeof newGame>) => { state.cell = { q: 1, r: 0, sub: null, wild: null }; },
    ];
    for (const setup of setups) {
      const state = safeTown(); state.fieldwork.materials['iron-ore'] = 4; setup(state);
      expect(unchanged(state, () => processMaterials(state, 'iron-bar')).ok).toBe(false);
    }
    const full = safeTown();
    for (const bucket of [full.farm.herbs, full.counters.stones, full.farm.potions, full.farm.condensed,
      full.fieldwork.foods, full.fieldwork.materials]) for (const key of Object.keys(bucket)) bucket[key] = 0;
    full.fieldwork.materials['iron-ore'] = 3; // One craft leaves this ingredient stack occupied.
    full.junk.fixture = (slotsAvailable(full) - 1) * E.inventory.stack_size.stone;
    expect(unchanged(full, () => processMaterials(full, 'iron-bar')).ok).toBe(false);
    full.fieldwork.materials['iron-ore'] = 2;
    expect(processMaterials(full, 'iron-bar').ok).toBe(true); // Consumed ingredients release the output slot.
  });

  it('batches Smithing as exact single crafts and stops at the first missing ingredient', () => {
    const state = safeTown(), recipe = fieldwork.workshopById['iron-bar'];
    state.fieldwork.skills.smithing.mastery[recipe.id] = masteryAt(40);
    state.fieldwork.materials['iron-ore'] = recipe.materials['iron-ore'] * 2 + 1;
    const oldClock = state.clockSec, oldXp = state.fieldwork.skills.smithing.xp;
    const oldMastery = state.fieldwork.skills.smithing.mastery[recipe.id];
    expect(processMaterials(state, recipe.id).ok).toBe(true);
    expect(state.fieldwork.materials['iron-bar']).toBe(recipe.yield * 2);
    expect(state.fieldwork.materials['iron-ore']).toBe(1);
    expect(state.fieldwork.skills.smithing.xp - oldXp).toBe(recipe.xp * 2);
    expect(state.fieldwork.skills.smithing.mastery[recipe.id] - oldMastery).toBe(recipe.mastery_xp * 2);
    expect(state.clockSec).toBe(oldClock);
    expect(unchanged(state, () => processMaterials(state, recipe.id)).ok).toBe(false);
  });

  it('makes cooking batches equivalent to repeated single transactions', () => {
    const state = fishingCamp(), recipe = fieldwork.recipeById.trail_stew;
    state.fieldwork.skills.cooking.mastery[recipe.id] = masteryAt(20);
    state.fieldwork.foods.raw_game_meat = recipe.foods.raw_game_meat * 3;
    const single = structuredClone(state);
    expect(cookMeal(state, recipe.id, 2)).toMatchObject({ ok: true, made: 2 });
    expect(cookMeal(single, recipe.id).ok).toBe(true);
    expect(cookMeal(single, recipe.id).ok).toBe(true);
    expect(state).toEqual(single);
  });

  it('starts Farming Mastery at zero, pays it only on harvest and changes only future growth', () => {
    const state = safeTown();
    expect(state.farm.mastery).toEqual({ low: 0, mid: 0, high: 0 });
    state.farm.herbs.low = farm.seedCostHerbs;
    expect(plant(state, 0, 'low').ok).toBe(true);
    const readyAt = state.farm.plots[0].readyAt;
    const baselineDuration = readyAt - state.clockSec;
    expect(unchanged(state, () => harvest(state, 0)).ok).toBe(false);
    state.farm.mastery.low = masteryAt(E.fieldwork.mastery_cap);
    const mastery = state.farm.mastery.low;
    expect(state.farm.plots[0].readyAt).toBe(readyAt);
    expect(farmGrowthSec(state, 'low')).toBeLessThan(baselineDuration);
    state.clockSec = readyAt;
    expect(harvest(state, 0).ok).toBe(true);
    expect(state.farm.mastery.low).toBe(mastery + 1);
    expect(state.farm.plots[0].plantedAt).toBe(readyAt);
    expect(state.farm.plots[0].readyAt).toBe(readyAt + farmGrowthSec(state, 'low'));
    expect(unchanged(state, () => harvest(state, 0)).ok).toBe(false);
    expect(state.farm.mastery.mid).toBe(0);
  });
});

describe('life-skill combat composition and compatibility', () => {
  it('reports the current combat benefit per track without changing final-boss progress', () => {
    const state = safeTown();
    const goal = structuredClone(state.goal);
    expect(lifeSkillMilestones(state).find((row) => row.id === 'farming')!.bonus).toBe(0);
    const rung = E.fieldwork.life_skill_combat.rungs[0];
    state.farm.xp = (rung - 1) ** 2 * E.farm.level_divisor;
    state.fieldwork.skills.cooking.xp = xpAt(rung);
    const rows = lifeSkillMilestones(state);
    const farming = rows.find((row) => row.id === 'farming')!;
    const cooking = rows.find((row) => row.id === 'cooking')!;
    expect(farming.stat).toBe(E.fieldwork.life_skill_combat.effects.farming.stat);
    expect(farming.unit).toBe(E.fieldwork.life_skill_combat.effects.farming.unit);
    expect(farming.bonus).toBe(lifeSkills.bonuses({ farming: farmLevel(state) }).hp_regen_pct);
    expect(cooking.bonus).toBe(lifeSkills.bonuses({ cooking: fieldSkillLevel(state, 'cooking') }).hp_regen_pct);
    expect(farming.bonus).toBeGreaterThan(0);
    expect(farming.bonus + cooking.bonus).toBeCloseTo(lifeSkillBonuses(state).hp_regen_pct!, 12);
    expect(state.goal).toEqual(goal);
  });

  it('keeps every fixed share monotone and does not redistribute unused track allocations', () => {
    const cfg = E.fieldwork.life_skill_combat;
    const cap = E.fieldwork.level_cap;
    const all = Object.fromEntries(Object.keys(cfg.weights).map((id) => [id, cap]));
    const maximal = lifeSkills.bonuses(all);
    expect(Object.values(maximal).reduce((sum, value) => sum + value!, 0)).toBeLessThanOrEqual(cfg.budget + 1e-12);
    for (const id of Object.keys(cfg.weights) as LifeSkillId[]) {
      let previous = 0;
      for (let level = 1; level <= cap; level++) {
        const value = Object.values(lifeSkills.bonuses({ [id]: level })).reduce((sum, amount) => sum + amount!, 0);
        expect(value).toBeGreaterThanOrEqual(previous);
        expect(value).toBeLessThanOrEqual(cfg.track_cap);
        previous = value;
      }
      expect(previous).toBeCloseTo(Math.min(cfg.track_cap, cfg.budget * cfg.weights[id]), 12);
    }
    const mining = lifeSkills.bonuses({ mining: cap }).armour_pct;
    expect(lifeSkills.bonuses({ mining: cap, fishing: cap }).armour_pct).toBe(mining);
    const cooking = lifeSkills.bonuses({ cooking: cap }).hp_regen_pct!;
    const farming = lifeSkills.bonuses({ farming: cap }).hp_regen_pct!;
    expect(lifeSkills.bonuses({ cooking: cap, farming: cap }).hp_regen_pct).toBeCloseTo(cooking + farming, 12);
  });

  it('adds bonuses in existing percentage channels once and preserves mob HP and Mana reservation', () => {
    const state = safeTown();
    const item: Item = { slot: 'helmet', base: 'composition fixture', ilvl: 1, quality: 'low', tier: 'T1', weight: 0,
      lines: [{ id: 'armour_pct', value: 15 }, { id: 'accuracy', value: 12 }, { id: 'evasion_pct', value: 11 },
        { id: 'life_regen_pct', value: 10 }, { id: 'mana_regen_pct', value: 9 }, { id: 'armour_pen', value: 8 }] };
    const life = { armour_pct: 3, accuracy_pct: 2, evasion_pct: 1, hp_regen_pct: 0.8, mana_regen_pct: 0.6, armour_pen: 0.4 };
    const effects = { add: { hp_regen: 5, mana_regen: 4 }, mult: {} };
    const beforeMobs = JSON.stringify(E.mob.zones.map((zone) => zone.hp));
    const beforeReservation = reservedPct(state.skills);
    const base = buildCharacter(30, [item], {}, 0, effects, state.player.points);
    const result = buildCharacter(30, [item], {}, 0, effects, state.player.points, {}, life);
    expect(result.armour).toBeCloseTo(eng.armourOf(result.core.str) * (1 + (15 + life.armour_pct) / 100), 12);
    expect(result.accuracy).toBeCloseTo(eng.playerAccuracy(result.core.dex, 12 + life.accuracy_pct), 12);
    expect(result.evasion).toBeCloseTo(eng.evasionRating(result.core.agi, 0, 11 + life.evasion_pct), 12);
    expect(result.hpRegen).toBeCloseTo(eng.hpRegenOf(result.core.vit, 10 + 5 + life.hp_regen_pct), 12);
    expect(result.manaRegen).toBeCloseTo(eng.manaRegenOf(result.core.int, 9 + 4 + life.mana_regen_pct), 12);
    expect(result.armourPen).toBeCloseTo(8 + life.armour_pen, 12);
    expect(result.maxMana).toBe(base.maxMana);
    expect(usableMana(result, state.skills)).toBe(usableMana(base, state.skills));
    expect(reservedPct(state.skills)).toBe(beforeReservation);
    expect(JSON.stringify(E.mob.zones.map((zone) => zone.hp))).toBe(beforeMobs);
  });

  it('does not create flat ratings or regeneration when their percentage base is zero', () => {
    vi.spyOn(eng, 'statOf').mockReturnValue(0);
    const life = lifeSkills.bonuses(Object.fromEntries(Object.keys(E.fieldwork.life_skill_combat.weights).map((id) => [id, E.fieldwork.level_cap])));
    const result = buildCharacter(1, [], {}, 0, undefined, Object.fromEntries(STAT_KEYS.map((id) => [id, 0])) as Record<typeof STAT_KEYS[number], number>, {}, life);
    expect(result.armour).toBe(0); expect(result.evasion).toBe(0); expect(result.accuracy).toBe(0);
    expect(result.hpRegen).toBe(0); expect(result.manaRegen).toBe(0);
    expect(result.armourPen).toBe(life.armour_pen);
  });

  it('preserves old track XP, Mastery, active deadlines and plots while backfilling only new progress', () => {
    const old = safeTown();
    const oldShape = old as any;
    old.fieldwork.skills.mining = { xp: xpAt(25), mastery: { mine: 1234 } };
    old.farm.xp = xpAt(24);
    old.farm.plots[0] = { tier: 'low', plantedAt: 100, readyAt: 99999 };
    old.fieldwork.action = { kind: 'mine', nextAt: 88888 };
    delete oldShape.fieldwork.skills.fishing; delete oldShape.fieldwork.skills.smithing; delete oldShape.farm.mastery;
    const loaded = migrate(old, 14);
    expect(loaded.fieldwork.skills.mining).toEqual({ xp: xpAt(25), mastery: { mine: 1234 } });
    expect(fieldSkillLevel(loaded, 'mining')).toBe(25);
    expect(farmLevel(loaded)).toBe(24);
    expect(loaded.fieldwork.skills.fishing).toEqual({ xp: 0, mastery: {} });
    expect(loaded.fieldwork.skills.smithing).toEqual({ xp: 0, mastery: {} });
    expect(loaded.farm.mastery).toEqual({ low: 0, mid: 0, high: 0 });
    expect(loaded.fieldwork.action?.nextAt).toBe(88888);
    expect(loaded.farm.plots[0].readyAt).toBe(99999);
    expect(lifeSkillBonuses(loaded)).toEqual(lifeSkills.bonuses({ mining: 25, woodcutting: 1, hunting: 1, cooking: 1, fishing: 1, smithing: 1, farming: 24 }));
    expect(importJson(exportJson(loaded)).fieldwork.skills).toEqual(loaded.fieldwork.skills);
  });
});
