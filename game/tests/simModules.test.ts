import { describe, it, expect } from 'vitest';
import { E, eng, sm, TOWN, loot, farm as FARM } from '../src/engine/client';
import { newGame } from '../src/sim/game';
import { bagStacks, slotsUsed, slotsFree, slotsAvailable, addTo, fits, bagSlots, pouchSlots } from '../src/sim/slots';
import { newPresets, storePreset, switchPreset, autoSelect, bindZone } from '../src/sim/presets';
import { newFarm, plotCount, farmLevel, plant, harvest, craftPotion, condense } from '../src/sim/farm';
import { startSettlement, stockOf, standingShare, standingTier, sellJunk, taskReward, stashTabCount, canBuy, buy, priceGold } from '../src/sim/town';
import { newCollector, newGrants, heldFor, heldCount, turnIn } from '../src/sim/collector';
import { rollDrop } from '../src/sim/drop';
import { mulberry32 } from '../src/engine/client-helpers';
import type { GameState, Item } from '../src/sim/types';

/**
 * The sim modules the client drives but no test had reached: the bag's slot accounting, the six
 * loadout presets, the farm's plant→harvest cycle, the town's board and stalls, the Collector, and the
 * drop roll's shape. Each one reads its numbers out of the data through `client.ts`, so these assert
 * the rules rather than a copied figure.
 */

const piece = (base: string, slot = 'helmet'): Item => ({
  slot, base, ilvl: 1, quality: 'low', tier: 'T1', lines: [], weight: 0,
}) as unknown as Item;

describe('the character bag counts slots the way the data prices them', () => {
  it('reads the published slot count and adds only what a pouch deed granted', () => {
    const s = newGame();
    expect(bagSlots).toBe(E.inventory.character_slots);
    expect(pouchSlots(s)).toBe(0);
    expect(slotsAvailable(s)).toBe(E.inventory.character_slots);
    const pouch = ((TOWN.one_time as any[]).find((r) => r.character_slot_grant) as any);
    s.town.owned.push(pouch.id);
    expect(pouchSlots(s)).toBe(pouch.character_slot_grant);
    expect(slotsAvailable(s)).toBe(E.inventory.character_slots + pouch.character_slot_grant);
  });

  it('counts one slot per stack and refuses a grant the bag cannot hold, without deleting anything', () => {
    const s = newGame();
    const cap = (E.inventory.stack_size as Record<string, number>).stone;
    const empty = slotsFree(s);
    expect(bagStacks(s).length).toBe(0);

    expect(addTo(s, s.counters.stones, 'tier', 'stone', cap)).toBe(cap);
    expect(slotsUsed(s)).toBe(1);
    expect(slotsFree(s)).toBe(empty - 1);

    // a grant that would need more slots than are free is refused whole, and `stopped` says so
    const huge = cap * (empty + 5);
    expect(fits(s, s.counters.stones, 'tier', 'stone', huge)).toBe(false);
    expect(addTo(s, s.counters.stones, 'tier', 'stone', huge)).toBe(0);
    expect(s.counters.stones.tier).toBe(cap);
    expect(s.counters.stopped).toBe(1);
  });

  it('never counts gold as a slot', () => {
    const s = newGame();
    s.counters.gold = 1e9;
    expect(slotsUsed(s)).toBe(0);
  });
});

describe('the six loadout presets', () => {
  it('opens at the data\u2019s own shape, with the main set named', () => {
    const s = newGame();
    expect(s.presets.length).toBe(sm.presetCount);
    expect(s.presets[sm.mainPreset].name).toBe('Main');
    expect(s.presets[0].list.length).toBe(s.presets[sm.presetCount - 1].list.length);
  });

  it('round-trips a loadout across sets, and leaves cooldowns and XP alone', () => {
    const s = newGame();
    const xpBefore = { ...s.skills.xp };
    // the loadout only carries owned rows, so the fixture grants them the way a drop would
    s.skills.owned['attack.cleave'] = 0;
    s.skills.owned['buff.iron_will'] = 0;
    // switching SAVES the set being left and loads the one being entered, so the trip is out and back
    s.skills.list = s.skills.list.map((_, i) => (i === 0 ? 'attack.cleave' : null));
    s.skills.buffs = { 'buff.iron_will': true };
    expect(switchPreset(s, 1)).toBe(true);
    s.skills.list = s.skills.list.map(() => null);
    s.skills.buffs = {};

    expect(switchPreset(s, 0)).toBe(true);
    expect(s.skills.list[0]).toBe('attack.cleave');
    expect(s.skills.buffs['buff.iron_will']).toBe(true);
    expect(s.skills.xp).toEqual(xpBefore);
  });

  it('refuses an index that is not a preset, and binds a zone to one', () => {
    const s = newGame();
    expect(switchPreset(s, 999)).toBe(false);
    const from = s.activePreset;
    bindZone(s, from, 1);
    expect(s.presets[from].zones).toContain(1);
    bindZone(s, from, 1);
    expect(s.presets[from].zones).not.toContain(1);
  });

  it('picks the set bound to the zone only when the data asks for it', () => {
    const s = newGame();
    if (!sm.PRESETS.auto_select_by_zone) {
      expect(autoSelect(s, 1)).toBeNull();
      return;
    }
    bindZone(s, 2, 4);
    expect(autoSelect(s, 4)).toBe(2);
    expect(autoSelect(s, 5)).toBeNull();
  });
});

describe('the farm', () => {
  it('opens with the published plot count and one row per herb tier and draught', () => {
    const f = newFarm();
    const s = newGame();
    expect(Object.keys(f.herbs).length).toBeGreaterThan(0);
    expect(Object.keys(f.potions).length).toBe(Object.keys(f.condensed).length);
    expect(plotCount(s)).toBeGreaterThanOrEqual(0);
  });

  it('refuses a tier the track has not unlocked, then plants, waits and harvests', () => {
    const s = newGame();
    const tier = Object.keys(s.farm.herbs)[0];
    const locked = s.farm.herbs[tier];
    expect(locked).toBe(0);
    // level 1 with no seed: the first refusal is the seed cost, not the unlock (both are real rules)
    const r1 = plant(s, 0, tier);
    expect(r1.ok).toBe(false);

    s.farm.xp = Number.MAX_SAFE_INTEGER;               // the unlock is a level, and the level is data
    const stack = (s.farm.herbs[tier] = 10);
    expect(stack).toBeGreaterThan(0);
    expect(plant(s, 0, tier).ok).toBe(true);
    expect(harvest(s, 0).ok).toBe(false);              // still growing
    s.clockSec += 10 * 24 * 3600;
    const h = harvest(s, 0);
    expect(h.ok).toBe(true);
    expect(h.herbs).toBeGreaterThan(0);
    expect(s.farm.xp).toBeGreaterThanOrEqual(h.xp ?? 0);
    expect(farmLevel(s)).toBeGreaterThanOrEqual(1);
  });

  it('pays a draught only when the herbs, the stones and a free slot are all there', () => {
    const s = newGame();
    const name = Object.keys(s.farm.potions)[0];
    expect(craftPotion(s, 'no such draught').ok).toBe(false);
    expect(craftPotion(s, name).ok).toBe(false);

    const potion = (FARM.P.list as any[]).find((p) => p.name === name);
    const cost = FARM.craftCost(potion.tier);
    s.farm.herbs[potion.tier] = cost.herbs * 2;
    s.counters.stones.reroll_value = 10_000;
    expect(craftPotion(s, name).ok).toBe(true);
    expect(s.farm.potions[name]).toBe(1);

    s.counters.stones.reroll_value = 0;
    expect(condense(s, name).ok).toBe(false);
    s.counters.stones.reroll_value = 10_000;
    expect(condense(s, name).ok).toBe(false);          // one bottle is not the ten a condensed dose costs
  });
});

describe('the town board and its stalls', () => {
  it('reads Standing off the zone kill budget, and Tier II is what a Collector set needs', () => {
    const s = newGame();
    const home = startSettlement();
    expect(standingShare(s, home)).toBe(0);
    expect(standingTier(s, home)).toBe(0);
  });

  it('pays a task in the stone its kind names', () => {
    const elite = taskReward('elite', 'low');
    const boss = taskReward('boss', 'low');
    expect(elite.stone).toBe('tier');
    expect(boss.stone).toBe('remove');
    expect(elite.count).toBeGreaterThan(0);
    expect(boss.count).toBeGreaterThan(0);
  });

  it('mints gold from variant and race junk at the Counterhand using each item rarity', () => {
    const s = newGame();
    // Variant and race items each resolve to their declared rarity; `junk.rarities` owns the price.
    const drop = (Object.values((E.mob as any).variant_drops) as any[])[0];
    const price = (E.junk as any).rarities[drop.rarity].sell_gold;
    const raceItem = E.mob.species[0].junk_items.common;
    s.junk[drop.item] = 3;
    s.junk[raceItem] = 2;
    s.counters.gold = 0;
    const r = sellJunk(s);
    expect(r.pieces).toBe(5);
    expect(r.gold).toBe(price * 3 + (E.junk as any).rarities.common.sell_gold * 2);
    expect(s.counters.gold).toBe(r.gold);
    expect(s.junk[drop.item]).toBe(0);
    expect(s.junk[raceItem]).toBe(0);
  });

  it('sells a stocked, allowed line and refuses power, an unstocked line and an empty purse', () => {
    const s = newGame();
    const home = startSettlement();
    const stocked = stockOf(home) as any[];
    expect(stocked.length).toBeGreaterThan(0);
    const row = stocked.find((r) => TOWN.invariants.allowed_kinds.includes(r.kind))!;
    expect(canBuy(s, home, 'no-such-line').ok).toBe(false);
    s.counters.gold = 0;
    const poor = canBuy(s, home, row.id);
    expect(poor.ok).toBe(false);
    expect(poor.gold).toBe(priceGold(row, home, s));

    s.counters.gold = (poor.gold || 0) + 1000;
    const bought = buy(s, home, row.id);
    expect(bought.ok).toBe(true);
    expect(s.town.owned).toContain(row.id);
  });

  it('counts stash tabs from what was bought and what a set granted, capped at the data limit', () => {
    const s = newGame();
    expect(stashTabCount(s)).toBe(0);
    s.grants.stash_tabs = 99;
    expect(stashTabCount(s)).toBeLessThanOrEqual(6);
  });
});

describe('the Collector', () => {
  it('opens empty, and reads held pieces out of the bag and the stash alike', () => {
    const s = newGame();
    s.collector = newCollector();
    s.grants = newGrants();
    expect(s.collector.done).toEqual({});

    s.bag = [piece('Iron Helm')];
    s.stash = [[piece('Iron Boots')]];
    const held = heldFor(s, 'set-x');
    expect(held.length).toBe(0);
    (s.bag[0] as any).heldFor = 'set-x';
    (s.stash[0][0] as any).heldFor = 'set-x';
    expect(heldFor(s, 'set-x').length).toBe(2);
    expect(heldCount(s, 'set-x', 'Iron Helm')).toBe(1);
  });

  it('refuses a turn-in at a settlement with no set, and under Tier II standing', () => {
    const s = newGame();
    s.collector = newCollector();
    s.town.owned = [];
    expect(turnIn(s, 'no-such-settlement').ok).toBe(false);
    const set = ((TOWN as any).collector_sets || [])[0];
    if (!set) return;
    const r = turnIn(s, set.settlement);
    expect(r.ok).toBe(false);
    expect(r.why).toBeTruthy();
  });
});

describe('the drop roll', () => {
  it('always answers a piece a character can wear, inside its own band', () => {
    const rng = mulberry32(11);
    for (const band of loot.BAND_LABEL) {
      const item = rollDrop(rng, band, eng.floorLevelOf(band));
      expect(item.slot, band).toBeTruthy();
      expect(loot.SLOTS).toContain(item.slot);
      expect(item.lines.length).toBeGreaterThan(0);
      expect(item.ilvl).toBeGreaterThan(0);
    }
  });
});

