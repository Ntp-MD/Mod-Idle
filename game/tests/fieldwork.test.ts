import { describe, expect, it } from 'vitest';
import { E, fieldwork } from '../src/engine/client';
import { newGame } from '../src/sim/game';
import {
  activeMeal, canCook, cookMeal, eatMeal, establishCamp, fieldDropChance, fieldHarvestAmount, fieldHarvestBonus, fieldMasteryLevel, fieldSkillLevel,
  recordHuntKill, resolveTravelEvent, startFieldAction, tickFieldwork, tickHunger, withHunger, withMeal,
} from '../src/sim/fieldwork';
import { buildCharacter } from '../src/sim/player';
import { carried } from '../src/sim/game';
import { migrate } from '../src/state/save';
import { atSettlement } from '../src/sim/craft';

function standAt(state: ReturnType<typeof newGame>, wild: number | null) {
  state.cell = { q: 1, r: 0, sub: null, wild };
  state.zone = E.opening.settlement_zone;
  state.hunting = false;
  state.group = [];
}

describe('field Camp and fieldwork', () => {
  it('only enables settlement services while the feet stand on the settlement hex', () => {
    const state = newGame();
    state.town.visited.push(state.town.waypoint);
    state.cell = { q: 1, r: 0, sub: null, wild: fieldwork.F.wild_site_index.mine };
    expect(atSettlement(state)).toBe(false);
    state.cell = { q: 0, r: 0, sub: null, wild: null };
    expect(atSettlement(state)).toBe(true);
  });

  it('adds empty fieldwork state when a v12 save is migrated', () => {
    const old = JSON.parse(JSON.stringify(newGame()));
    delete old.fieldwork;
    const upgraded = migrate(old, 12);
    expect(upgraded.fieldwork.camp).toBeNull();
    expect(upgraded.fieldwork.materials.ore).toBe(0);
    expect(upgraded.fieldwork.hunger).toBe(fieldwork.F.hunger.max);
    expect(upgraded.fieldwork.foods.raw_game_meat).toBe(0);
  });

  it('moves v13 meat and cooked meal counts into the provision bag', () => {
    const old = JSON.parse(JSON.stringify(newGame()));
    old.fieldwork.meals = { trail_stew: 3 };
    old.fieldwork.materials.meat = 5;
    delete old.fieldwork.foods;
    delete old.fieldwork.hunger;
    delete old.fieldwork.autoEat;
    const upgraded = migrate(old, 13);
    expect(upgraded.fieldwork.foods.trail_stew).toBe(3);
    expect(upgraded.fieldwork.foods.raw_game_meat).toBe(5);
    expect(upgraded.fieldwork.materials.meat).toBeUndefined();
    expect(upgraded.fieldwork.autoEat.enabled).toBe(fieldwork.F.hunger.auto_eat.enabled_default);
  });

  it('pays the metal a body is made of into the same materials map the mine verb fills', () => {
    const state = newGame();
    state.hunting = true;
    const before = state.fieldwork.materials.ore || 0;
    const log = recordHuntKill(state, 'golem', () => 0);   // every roll succeeds
    expect(state.fieldwork.materials.ore).toBeGreaterThan(before);
    expect(log).toContain('ore');
    // the site verb owns the bulk: one kill never out-yields a mined action
    expect(state.fieldwork.materials.ore - before).toBeLessThanOrEqual(fieldwork.F.actions.mine.yield);
    // a body with no metal row pays none of it
    const plain = newGame();
    plain.hunting = true;
    recordHuntKill(plain, 'skeleton', () => 0);
    expect(plain.fieldwork.materials.ore || 0).toBe(0);
  });

  it('accepts a new food key in an existing provision bag without changing its save schema', () => {
    const old = JSON.parse(JSON.stringify(newGame()));
    delete old.fieldwork.foods.goblin_haunch;
    const loaded = migrate(old, 14);
    loaded.hunting = true;
    expect(recordHuntKill(loaded, 'goblin', () => 0)).toContain('Goblin Haunch');
    expect(loaded.fieldwork.foods.goblin_haunch).toBeGreaterThan(0);
  });

  it('sets a safe Camp, mines on its hex, and tracks skill and resource mastery', () => {
    const state = newGame();
    standAt(state, fieldwork.F.wild_site_index.mine);
    expect(establishCamp(state)).toMatchObject({ ok: true, moved: false });
    expect(state.hunting).toBe(false);
    expect(startFieldAction(state, 'mine')).toEqual({ ok: true });
    state.clockSec = state.fieldwork.action!.nextAt;
    tickFieldwork(state, () => 1);
    expect(state.fieldwork.materials.ore).toBe(fieldwork.F.actions.mine.yield);
    expect(state.fieldwork.skills.mining.xp).toBe(fieldwork.F.actions.mine.xp);
    expect(fieldMasteryLevel(state, 'mining', 'mine')).toBe(fieldwork.masteryLevel(fieldwork.F.actions.mine.mastery_xp));
  });

  it('adds configured harvest units at Skill level milestones in both Mines and Rare Groves', () => {
    const milestone = fieldwork.F.progression.harvest_bonus_levels[0];
    const cases = [
      { site: 'mine' as const, skill: 'mining' as const },
      { site: 'grove' as const, skill: 'woodcutting' as const },
    ];
    for (const { site, skill } of cases) {
      const state = newGame();
      standAt(state, fieldwork.F.wild_site_index[site]);
      expect(establishCamp(state).ok).toBe(true);
      expect(startFieldAction(state, site)).toEqual({ ok: true });
      state.fieldwork.skills[skill].xp = (milestone - 1) ** 2 * fieldwork.F.level_divisor;
      expect(fieldSkillLevel(state, skill)).toBe(milestone);
      state.clockSec = state.fieldwork.action!.nextAt;
      tickFieldwork(state, () => 1);
      const cfg = fieldwork.F.actions[site];
      expect(state.fieldwork.materials[cfg.resource]).toBe(cfg.yield + fieldwork.F.progression.harvest_bonus_per_level);
    }
  });

  it('keeps one free relocation for the other site, then charges timber', () => {
    const state = newGame();
    standAt(state, fieldwork.F.wild_site_index.mine);
    expect(establishCamp(state).ok).toBe(true);
    state.cell = { q: 2, r: 0, sub: null, wild: fieldwork.F.wild_site_index.grove };
    expect(establishCamp(state)).toMatchObject({ ok: true, moved: true });
    expect(state.fieldwork.freeRelocationsRemaining).toBe(0);
    state.cell = { q: 1, r: 0, sub: null, wild: fieldwork.F.wild_site_index.mine };
    expect(establishCamp(state).ok).toBe(false);
    state.fieldwork.materials.timber = fieldwork.F.camp.relocate_timber;
    state.fieldwork.materials.ore = fieldwork.F.camp.relocate_ore;
    expect(establishCamp(state)).toMatchObject({ ok: true, moved: true });
    expect(state.fieldwork.materials.timber).toBe(0);
    expect(state.fieldwork.materials.ore).toBe(0);
  });

  it('hunts meat, cooks a meal at Camp, and applies its timed combat effects', () => {
    const state = newGame();
    standAt(state, null);
    state.cell = { q: 1, r: 0, sub: null, wild: null };
    state.hunting = true;
    expect(recordHuntKill(state, 'wolf', () => 0)).toBeTruthy();
    expect(state.fieldwork.foods.raw_game_meat).toBeGreaterThan(0);
    expect(state.fieldwork.skills.hunting.xp).toBe(fieldwork.F.hunt.xp_per_kill);
    expect(fieldSkillLevel(state, 'hunting')).toBe(fieldwork.skillLevel(fieldwork.F.hunt.xp_per_kill));

    state.hunting = false;
    expect(establishCamp(state).ok).toBe(true);
    const recipe = fieldwork.F.recipes[0];
    state.fieldwork.foods.raw_game_meat = recipe.foods.raw_game_meat;
    expect(canCook(state, recipe.id).ok).toBe(true);
    expect(cookMeal(state, recipe.id).ok).toBe(true);
    expect(eatMeal(state, recipe.id).ok).toBe(true);
    expect(activeMeal(state)?.id).toBe(recipe.id);
    const base = buildCharacter(state.player.level, state.gear, carried(state), 0, undefined, state.player.points, state.player.treeRanks);
    expect(withMeal(base, state).phys).toBeGreaterThan(base.phys);
    state.clockSec = state.fieldwork.activeMeal!.untilSec;
    expect(activeMeal(state)).toBeNull();
  });

  it('drains Hunger on a hunt and lets Auto Eat choose cooked food before fruit or raw food', () => {
    const state = newGame();
    state.hunting = true;
    state.fieldwork.hunger = fieldwork.F.hunger.auto_eat.threshold_default;
    state.fieldwork.foods.trail_stew = 1;
    state.fieldwork.foods.wild_berries = 1;
    state.fieldwork.foods.raw_game_meat = 1;
    const prior = state.fieldwork.hunger;
    const note = tickHunger(state);
    expect(state.fieldwork.hunger).toBeGreaterThan(prior);
    expect(state.fieldwork.foods.trail_stew).toBe(0);
    expect(state.fieldwork.foods.wild_berries).toBe(1);
    expect(state.fieldwork.foods.raw_game_meat).toBe(1);
    expect(note).toContain('Trail Stew');
    expect(state.fieldwork.activeMeal?.id).toBe('trail_stew');
  });

  it('uses edible fruit before herbs, then consumes edible herbs before raw food', () => {
    const state = newGame();
    state.fieldwork.hunger = fieldwork.F.hunger.auto_eat.threshold_default;
    state.fieldwork.foods.wild_berries = 1;
    state.fieldwork.foods.moonmint = 1;
    state.fieldwork.foods.raw_game_meat = 1;

    expect(tickHunger(state)).toContain('Wild Berries');
    expect(state.fieldwork.foods.wild_berries).toBe(0);
    expect(state.fieldwork.foods.moonmint).toBe(1);
    expect(state.fieldwork.foods.raw_game_meat).toBe(1);

    state.fieldwork.hunger = fieldwork.F.hunger.auto_eat.threshold_default;
    expect(tickHunger(state)).toContain('Moonmint');
    expect(state.fieldwork.foods.moonmint).toBe(0);
    expect(state.fieldwork.foods.raw_game_meat).toBe(1);
  });

  it('lets the player eat raw, fruit and herb provisions while refusing cooking ingredients', () => {
    const state = newGame();
    for (const kind of ['raw', 'fruit', 'herb']) {
      const food = fieldwork.F.foods.find((row: any) => row.kind === kind && row.edible)!;
      state.fieldwork.foods[food.id] = 1;
      state.fieldwork.hunger = 0;
      expect(eatMeal(state, food.id)).toEqual({ ok: true });
      expect(state.fieldwork.foods[food.id]).toBe(0);
      expect(state.fieldwork.hunger).toBe(Math.min(fieldwork.F.hunger.max, food.hunger_restore));
    }

    const ingredient = fieldwork.F.foods.find((row: any) => row.kind === 'ingredient')!;
    state.fieldwork.foods[ingredient.id] = 1;
    expect(eatMeal(state, ingredient.id)).toEqual({ ok: false, why: 'this is a cooking ingredient' });
    expect(state.fieldwork.foods[ingredient.id]).toBe(1);
  });

  it('only includes raw food in Auto Eat after the player opts in', () => {
    const state = newGame();
    state.fieldwork.hunger = 1;
    state.fieldwork.foods.raw_game_meat = 1;
    expect(tickHunger(state)).toBeNull();
    expect(state.fieldwork.foods.raw_game_meat).toBe(1);
    state.fieldwork.hunger = 0;
    expect(tickHunger(state)).toContain('Raw Game Meat');
    expect(state.fieldwork.foods.raw_game_meat).toBe(0);
    state.fieldwork.foods.raw_game_meat = 1;
    state.fieldwork.hunger = 1;
    state.fieldwork.autoEat.allowRaw = true;
    expect(tickHunger(state)).toContain('Raw Game Meat');
    expect(state.fieldwork.foods.raw_game_meat).toBe(0);
  });

  it('cuts only HP regeneration at empty Hunger and leaves Energy Shield recharge unchanged', () => {
    const state = newGame();
    const base = buildCharacter(state.player.level, state.gear, carried(state), 0, undefined, state.player.points, state.player.treeRanks);
    state.fieldwork.hunger = 0;
    const hungry = withHunger(base, state);
    expect(hungry.hpRegen).toBeCloseTo(base.hpRegen * (1 - fieldwork.F.hunger.empty_hp_regen_cut_pct / 100));
    expect(hungry.esRegen).toBe(base.esRegen);
  });

  it('rolls independent trail events for supplies and rest', () => {
    const state = newGame();
    const localFood = fieldwork.F.regional_sources[state.zone].food;
    const event = resolveTravelEvent(state, () => 0);
    expect(event).toContain(fieldwork.foodById[localFood].name);
    expect(event).toContain(E.mob.zones.find((zone: any) => zone.id === state.zone)!.name);
    expect(state.fieldwork.foods[localFood]).toBeGreaterThan(0);
  });

  it('drops raw Goblin Haunch, cooked human rations and edible herbs from their matching species', () => {
    const goblin = newGame();
    goblin.hunting = true;
    expect(recordHuntKill(goblin, 'goblin', () => 0)).toContain('Goblin Haunch');
    expect(goblin.fieldwork.foods.goblin_haunch).toBeGreaterThan(0);
    expect(goblin.fieldwork.foods.raw_game_meat).toBe(0);

    const human = newGame();
    human.hunting = true;
    expect(recordHuntKill(human, 'human', () => 0)).toContain("Soldier's Ration");
    expect(human.fieldwork.foods.soldier_ration).toBeGreaterThan(0);

    const dryad = newGame();
    dryad.hunting = true;
    expect(recordHuntKill(dryad, 'dryad', () => 0)).toContain('Moonmint');
    expect(dryad.fieldwork.foods.moonmint).toBeGreaterThan(0);
  });

  it('raises field drop chance with Skill level and per-resource Mastery, then increases hunted portions at harvest milestones', () => {
    const state = newGame();
    const drop = fieldwork.F.hunt.food_drops.find((row: any) => row.species.includes('goblin'))!;
    expect(fieldDropChance(state, 'hunting', 'goblin', drop.chance)).toBeCloseTo(drop.chance);

    const P = fieldwork.F.progression;
    state.fieldwork.skills.hunting.xp = (fieldwork.F.level_cap - 1) ** 2 * fieldwork.F.level_divisor;
    state.fieldwork.skills.hunting.mastery.goblin = (fieldwork.F.mastery_cap - 1) ** 2 * fieldwork.F.mastery_divisor;
    const improved = fieldDropChance(state, 'hunting', 'goblin', drop.chance);
    expect(improved).toBeGreaterThan(drop.chance);
    expect(improved).toBeLessThanOrEqual(drop.chance * (1 + P.drop_rate_bonus_cap_pct / 100));

    state.hunting = true;
    const betweenBaseAndBonus = (drop.chance + improved) / 2;
    const rolls = [betweenBaseAndBonus, 0];
    expect(recordHuntKill(state, 'goblin', () => rolls.shift() ?? 1)).toContain('Goblin Haunch');
    expect(state.fieldwork.foods.goblin_haunch).toBe(drop.min + fieldHarvestBonus(state, 'hunting'));

    const milestoneState = newGame();
    milestoneState.hunting = true;
    const milestone = P.harvest_bonus_levels[0];
    milestoneState.fieldwork.skills.hunting.xp = (milestone - 1) ** 2 * fieldwork.F.level_divisor;
    const note = recordHuntKill(milestoneState, 'goblin', () => 0);
    expect(note).toContain('Goblin Haunch');
    expect(milestoneState.fieldwork.foods.goblin_haunch).toBe(
      drop.min + fieldHarvestAmount(milestoneState, 'hunting', 0),
    );
  });

  it('provides edible raw, fruit and herb provisions plus both compact recipe menus', () => {
    const edibleKinds = new Set(fieldwork.F.foods.filter((food: any) => food.edible).map((food: any) => food.kind));
    expect(edibleKinds).toEqual(new Set(['raw', 'fruit', 'herb', 'cooked']));
    expect(new Set(fieldwork.F.recipes.map((recipe: any) => recipe.menu))).toEqual(new Set(['hearth', 'forage']));
    expect(fieldwork.recipeById.soldier_ration).toMatchObject({ menu: 'hearth' });
    expect(fieldwork.recipeById.goblin_bone_broth).toMatchObject({ menu: 'forage' });
    expect(fieldwork.recipeById.moonmint_tea).toMatchObject({ menu: 'forage' });
    expect(fieldwork.recipeById.sunroot_porridge).toMatchObject({ menu: 'forage' });
    expect(fieldwork.recipeById.spiced_trail_roast).toMatchObject({ menu: 'forage' });
  });

  it('drains by activity while safe town and Camp idle do not drain', () => {
    const state = newGame();
    state.fieldwork.hunger = 50;
    tickHunger(state);
    expect(state.fieldwork.hunger).toBe(50);
    state.fieldwork.action = { kind: 'mine', nextAt: 1 };
    tickHunger(state);
    expect(state.fieldwork.hunger).toBeCloseTo(50 - fieldwork.F.hunger.drain_per_sec.gathering);
    state.fieldwork.action = null;
    state.fieldwork.hunger = 50;
    state.walk = {
      from: { q: 0, r: 0 }, to: { q: 1, r: 0 }, node: 'start', kind: 'wild', sub: null, wild: null,
      blocksTotal: 1, blocksLeft: 1, secLeft: 1, blocksWalked: 0,
    };
    tickHunger(state, false);
    expect(state.fieldwork.hunger).toBe(50);
    tickHunger(state, true);
    expect(state.fieldwork.hunger).toBeCloseTo(50 - fieldwork.F.hunger.drain_per_sec.travel);
  });
});
