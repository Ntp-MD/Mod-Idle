import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { E } from '../src/engine/client';
import {
  farm, newFarm, plant, harvest, plotCount, craftPotion, condense, maybeDrink, maybeFarm, rollHerbs, farmLevel,
} from '../src/sim/farm';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { newGame, tick } from '../src/sim/game';
import { mulberry32 } from '../src/engine/client-helpers';

const require = createRequire(import.meta.url);
const cage = require('../../tools/lib/engine.ts');

describe('the farm curve is the engine curve', () => {
  it('levels on the Mastery sqrt curve and caps at 20', () => {
    expect(farm.farmLevel(0)).toBe(1);
    expect(farm.farmLevel(E.farm.level_divisor)).toBe(2);
    expect(farm.farmLevel(3600)).toBe(7);
    expect(farm.farmLevel(999999)).toBe(E.farm.level_cap);
  });

  it('unlocks herb tiers at the published levels', () => {
    expect(farm.canGrow(1, 'low')).toBe(true);
    expect(farm.canGrow(1, 'mid')).toBe(false);
    expect(farm.canGrow(E.farm.tier_unlock_level.mid, 'mid')).toBe(true);
    expect(farm.canGrow(E.farm.tier_unlock_level.high, 'high')).toBe(true);
  });

  it('plots are three, and the two Steward deeds raise it to the cap', () => {
    const s = newGame(3);
    expect(plotCount(s)).toBe(E.farm.plots.base);
    s.town.owned.push('plot_deed_4', 'plot_deed_5');
    expect(plotCount(s)).toBe(E.farm.plots.max);
    s.town.owned.push('plot_deed_4');
    expect(plotCount(s)).toBe(E.farm.plots.max); // the cap is a cap, not a sum
  });
});

describe('planting and harvesting', () => {
  it('refuses a tier the level has not reached and a plot that is still growing', () => {
    const s = newGame(4);
    s.farm.herbs.high = 1;
    expect(plant(s, 0, 'high').ok).toBe(false); // the level gates the tier, not the seed
    s.farm.herbs.low = 1;
    const low = plant(s, 0, 'low');
    expect(low.ok).toBe(true);
    expect(s.farm.herbs.low).toBe(0); // the seed is spent
    expect(plant(s, 0, 'low').ok).toBe(false);
    expect(harvest(s, 0).ok).toBe(false);
  });

  it('refuses to plant without the seed the cycle names', () => {
    const s = newGame(97);
    const r = plant(s, 0, 'low');
    expect(r.ok).toBe(false);
    expect(String(r.why)).toMatch(/seed/);
  });

  it('pays the published yield and XP, then regrows on its own clock', () => {
    const s = newGame(5);
    s.farm.herbs.low = E.farm.seed_cost_herbs;
    plant(s, 0, 'low');
    s.clockSec = s.farm.plots[0].readyAt;
    const r = harvest(s, 0);
    expect(r.ok).toBe(true);
    expect(r.herbs).toBe(E.farm.yield_per_harvest);
    expect(r.xp).toBe(E.farm.xp_per_harvest);
    expect(s.farm.herbs.low).toBe(E.farm.yield_per_harvest);
    expect(s.farm.plots[0].readyAt).toBe(s.clockSec + E.farm.growth_hours * 3600);
    expect(farmLevel(s)).toBe(1);
  });

  it('grows into the deed plots 4 and 5 instead of crashing on an undefined slot', () => {
    // the base array is three long; buying the Steward's deeds used to leave plots[3]/[4] undefined,
    // so plant() threw and an auto-plant tick froze the game. The track must grow to the owned count.
    const s = newGame(98);
    s.town.owned.push('plot_deed_4', 'plot_deed_5');
    s.farm.herbs.low = 10;
    expect(plant(s, 3, 'low').ok).toBe(true);
    expect(plant(s, 4, 'low').ok).toBe(true);
    expect(s.farm.plots.length).toBe(E.farm.plots.max);
    expect(s.farm.plots[3].tier).toBe('low');
    expect(s.farm.plots[4].tier).toBe('low');
  });

  it('auto-plant fills every owned plot without throwing', () => {
    const s = newGame(99);
    s.town.owned.push('plot_deed_4', 'plot_deed_5');
    s.farm.herbs.low = 10;
    s.farm.autoFarm.plant = true;
    expect(() => maybeFarm(s)).not.toThrow();
    expect(plotCount(s)).toBe(E.farm.plots.max);
    expect(s.farm.plots.filter((p) => p.tier).length).toBe(E.farm.plots.max);
  });

  it('grows while the player is away, inside the offline cap', () => {
    const s = newGame(6);
    s.farm.herbs.low = E.farm.seed_cost_herbs;
    plant(s, 0, 'low');
    const before = s.farm.herbs.low;
    for (let i = 0; i < E.farm.growth_hours * 3600 + 5; i++) tick(s, {});
    const r = harvest(s, 0);
    expect(r.ok).toBe(true);
    expect(s.farm.herbs.low - before).toBe(E.farm.yield_per_harvest);
  }, 30000);
});

describe('herbs drop on their own roll', () => {
  it('pays nothing in a low zone and the published chance in mid and high', () => {
    expect(farm.herbChance('low')).toBe(0);
    expect(farm.herbChance('mid')).toBe(E.herbs.mid_chance);
    expect(farm.herbChance('high')).toBe(E.herbs.high_chance);
    const s = newGame(8);
    const rng = mulberry32(1);
    let got = 0;
    for (let i = 0; i < 5000; i++) got += rollHerbs(s, rng, 'mid', 'mid');
    const expected = 5000 * E.herbs.mid_chance * ((E.herbs.bundle_min + E.herbs.bundle_max) / 2);
    expect(got).toBeGreaterThan(expected * 0.8);
    expect(got).toBeLessThan(expected * 1.2);
  });
});

describe('potions are a bounded convenience', () => {
  it('derives the effect ladder from the base and step, matching farm.md', () => {
    const effects = farm.P.list.map((p: any) => `${p.name}:${farm.potionEffect(p)}`);
    expect(effects).toContain('Red Draught:10');
    expect(effects).toContain('Yellow Draught:20');
    expect(effects).toContain('White Draught:30');
    expect(effects).toContain('Sky Draught:15');
    expect(effects).toContain('Deep Blue Draught:35');
  });

  it('brews for the published cost and refuses without it', () => {
    const s = newGame(9);
    const red = farm.P.list[0];
    const cost = farm.craftCost(red.tier);
    expect(craftPotion(s, red.name).ok).toBe(false);
    s.farm.herbs[red.tier] = cost.herbs;
    s.counters.stones.reroll_value = cost.reroll_value_stones;
    expect(craftPotion(s, red.name).ok).toBe(true);
    expect(s.farm.potions[red.name]).toBe(1);
    expect(s.farm.herbs[red.tier]).toBe(0);
    expect(s.counters.stones.reroll_value).toBe(0);
  });

  it('condenses ten bottles into one ten-times dose', () => {
    const s = newGame(10);
    const red = farm.P.list[0];
    s.farm.potions[red.name] = E.potions.condensed.cost_bottles;
    s.counters.stones.reroll_value = E.potions.condensed.cost_reroll_value_stones;
    expect(condense(s, red.name).ok).toBe(true);
    expect(s.farm.condensed[red.name]).toBe(1);
    expect(s.counters.stones.reroll_value).toBe(0);
  });

  it('auto-use respects the threshold, the shared cooldown and the per-fight cap', () => {
    const s = newGame(11);
    const c = buildCharacter(s.player.level, s.gear);
    s.farm.potions['Red Draught'] = 10;
    s.player.hp = c.maxHp * 0.1;
    const first = maybeDrink(s, c, false);
    expect(first?.name).toBe('Red Draught');
    expect(s.player.hp).toBeGreaterThan(c.maxHp * 0.1);
    // the shared cooldown blocks the next sip even with bottles left
    s.player.hp = c.maxHp * 0.1;
    expect(maybeDrink(s, c, false)).toBe(null);
    s.clockSec += E.potions.shared_cooldown_sec;
    expect(maybeDrink(s, c, false)).toBeTruthy();
  });

  it('drinks the best bottle it owns, and nothing works on a boss', () => {
    const s = newGame(12);
    const c = buildCharacter(s.player.level, s.gear);
    s.farm.potions['Red Draught'] = 1;
    s.farm.potions['White Draught'] = 1;
    s.player.hp = c.maxHp * 0.1;
    expect(maybeDrink(s, c, false)?.name).toBe('White Draught');

    const s2 = newGame(13);
    const c2 = buildCharacter(s2.player.level, s2.gear);
    s2.farm.potions['White Draught'] = 3;
    s2.player.hp = 1;
    expect(maybeDrink(s2, c2, true)).toBe(null);
  });

  it('stops after the published number of sips in one fight', () => {
    const s = newGame(14);
    const c = buildCharacter(s.player.level, s.gear);
    s.farm.potions['Red Draught'] = 20;
    for (let i = 0; i < E.potions.max_uses_per_fight; i++) {
      s.player.hp = 1;
      s.clockSec += E.potions.shared_cooldown_sec + 1;
      expect(maybeDrink(s, c, false)).toBeTruthy();
    }
    s.player.hp = 1;
    s.clockSec += E.potions.shared_cooldown_sec + 1;
    expect(maybeDrink(s, c, false)).toBe(null);
  });
});

describe('the client and the cages read one farm', () => {
  it('shares engine.json numbers with the cage side', () => {
    expect(E.farm.growth_hours).toBe(cage.E.farm.growth_hours);
    expect(E.potions.craft.high.herbs).toBe(cage.E.potions.craft.high.herbs);
  });
});
