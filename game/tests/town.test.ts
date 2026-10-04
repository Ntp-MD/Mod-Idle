import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { eng, E, TOWN, loot } from '../src/engine/client';
import {
  rowById, priceGold, priceMinutes, stockOf, settlementById, sellJunk, canBuy, buy, huntN,
  claimTask, newTown, standingShare, standingTier, canTravel, ROAD_LINKS,
} from '../src/sim/town';
import { newGame, tick } from '../src/sim/game';

const require = createRequire(import.meta.url);
const cage = require('../../tools/lib/engine.js');

describe('prices are minutes of income, not typed gold', () => {
  it('the client rate equals the cage rate', () => {
    for (const band of ['low', 'mid', 'high']) {
      expect(eng.goldPerMinute(band)).toBe(cage.goldPerMinute(band));
    }
  });

  it('a Road link costs its 20 minutes at the charging band', () => {
    const row = rowById('road_link');
    expect(priceMinutes(row, 'millbrook')).toBe(20);
    expect(priceGold(row, 'millbrook')).toBeCloseTo(20 * eng.goldPerMinute(row.charge_band || 'low'), 2);
  });

  it('Eastgate sells the first stash tab at the teaching price', () => {
    expect(priceMinutes(rowById('stash_tab_1'), 'eastgate')).toBe(30);
    expect(priceMinutes(rowById('stash_tab_1'), 'ashfall')).toBe(60);
  });
});

describe('gold stays the convenience medium', () => {
  it('every stall line is a kind town.json allows', () => {
    const allowed = TOWN.invariants.allowed_kinds;
    for (const row of [...TOWN.one_time, ...TOWN.repeatable]) {
      expect(allowed).toContain(row.kind);
    }
  });

  it('junk is kept, not auto-sold, and pays its rarity price at the Counterhand', () => {
    const s = newGame(77);
    for (let i = 0; i < 400; i++) tick(s, {});
    const pieces = Object.values(s.junkByRarity).reduce((a: number, b: number) => a + b, 0);
    expect(pieces).toBeGreaterThan(0);
    const goldBefore = s.counters.gold;
    const r = sellJunk(s);
    let expectGold = 0;
    for (const [rarity, count] of Object.entries(s.junkByRarity)) expectGold += count * E.junk.rarities[rarity].sell_gold;
    expect(r.gold).toBe(s.counters.gold - goldBefore + expectGold);
    expect(Object.values(s.junkByRarity).reduce((a: number, b: number) => a + b, 0)).toBe(0);
  });

  it('a purchase cannot be made without the gold and cannot be made twice past its qty', () => {
    const s = newGame(5);
    s.counters.gold = 0;
    expect(canBuy(s, 'eastgate', 'stash_tab_1').ok).toBe(false);
    s.counters.gold = 10_000;
    expect(buy(s, 'eastgate', 'stash_tab_1').ok).toBe(true);
    expect(buy(s, 'eastgate', 'stash_tab_1').ok).toBe(false); // the teaching tab is qty 1
  });

  it('a line not stocked at a settlement is refused', () => {
    const s = newGame(6);
    s.counters.gold = 10_000;
    expect(canBuy(s, 'eastgate', 'house_vermolch').ok).toBe(false);
    expect(stockOf('vermolch').map((r: any) => r.id)).toContain('house_vermolch');
  });
});

describe('the Guild board', () => {
  it('minute one offers the hunt engine.json describes', () => {
    const s = newGame();
    const task = s.town.tasks[0]!;
    expect(task.kind).toBe('hunt');
    expect(task.zone).toBe(E.opening.settlement_zone);
    expect(task.n).toBe(5);
    expect(huntN(1)).toBe(5);
  });

  it('N scales with the zone group size and the payout is in stones', () => {
    expect(huntN(9)).toBeGreaterThan(huntN(1));
    const s = newGame();
    const task = s.town.tasks[0]!;
    expect(task.stone).toBe('reroll_value');
    expect(task.count).toBe(eng.taskPayout('low', TOWN.task_sizing.reward_minutes_of_band_income).reroll_value);
    expect(Number.isInteger(task.count)).toBe(true);
    task.progress = task.n;
    s.clockSec = 10;
    expect(claimTask(s, 0)).toBe(true);
    expect(s.counters.stones.reroll_value).toBe(task.count);
    expect(s.town.tasks[0]).toBe(null);
    expect(s.town.refillAt[0]).toBe(10 + TOWN.task_sizing.refill_sec);
  });

  it('kills feed the matching slot and an empty slot refills after an hour', () => {
    const s = newGame();
    s.town.tasks[1] = { kind: 'hunt', zone: 1, n: 3, progress: 0, stone: 'reroll_value', count: 1, claimed: false, offeredAt: 0 };
    for (let i = 0; i < 60; i++) tick(s, {});
    expect(s.town.tasks[1].progress).toBeGreaterThan(0);
    s.clockSec = s.town.refillAt[0] + 1;
    tick(s, {});
    expect(s.town.tasks[0]).toBeTruthy();
  });
});

describe('the road is bounded and travel follows the links', () => {
  it('8 links exist and an unlinked settlement is out of reach', () => {
    expect(ROAD_LINKS).toBe(TOWN.settlements.length - 1);
    const s = newGame();
    expect(canTravel(s, 'eastgate')).toBe(true);
    expect(canTravel(s, 'vermolch')).toBe(false);
    s.counters.gold = 100_000;
    buy(s, 'millbrook', 'road_link');
    expect(canTravel(s, 'vermolch')).toBe(true);
  });

  it('standing is earned by kills in that settlement zone and never grants power', () => {
    const s = newGame();
    const budget = eng.BAND.low.kills_per_hr * settlementById('eastgate').budget_hr;
    s.counters.zoneKills[1] = Math.round(budget);
    expect(standingShare(s, 'eastgate')).toBeCloseTo(1, 1);
    expect(standingTier(s, 'eastgate')).toBe(2);          // Tier III asks for 1.4 of the budget
    s.counters.zoneKills[1] = Math.round(budget * 1.4);
    expect(standingTier(s, 'eastgate')).toBe(3);
    expect(TOWN.standing.never_grants).toContain('any stat');
  });
});

describe('the Curio pedlar rotates its stock', () => {
  it('prices each of the three daily slots inside the published band', () => {
    const s = newGame(31);
    for (let i = 0; i < 5; i++) tick(s, {});
    const row = rowById('pedlar_rotation');
    expect(s.pedlar.minutes.length).toBe(row.per_day_cap);
    for (const m of s.pedlar.minutes) {
      expect(m).toBeGreaterThanOrEqual(row.m_min);
      expect(m).toBeLessThanOrEqual(row.m_max);
    }
    expect(priceMinutes(row, 'highspire', s)).toBe(s.pedlar.minutes[0]);
  });

  it('sells at most three slots a day and the price walks up the stock', () => {
    const s = newGame(32);
    for (let i = 0; i < 5; i++) tick(s, {});
    s.counters.gold = 100000;
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      seen.push(priceMinutes(rowById('pedlar_rotation'), 'highspire', s));
      expect(buy(s, 'highspire', 'pedlar_rotation').ok).toBe(true);
    }
    expect(new Set(seen).size).toBeGreaterThan(0);
    expect(canBuy(s, 'highspire', 'pedlar_rotation').ok).toBe(false);
    s.clockSec += 86400;
    tick(s, {});
    expect(s.pedlar.bought).toBe(0);
    expect(s.pedlar.day).toBe(1);
    expect(canBuy(s, 'highspire', 'pedlar_rotation').ok).toBe(true);
  });
});

describe('the bag filter is the same rule the loot cage runs', () => {
  it('a drop is kept only as an upgrade past the margin, or as a fresh Element', () => {
    const weak = { slot: 'chest', q: 0, lines: [{ id: 'stat_mod_flat', value: 6 }] };
    const strong = { slot: 'chest', q: 2, lines: [{ id: 'stat_mod_flat', value: 25 }] };
    const top = loot.score(strong);
    expect(loot.keepsDrop(strong, undefined, new Set(), 0.1).keep).toBe(true);
    expect(loot.keepsDrop(weak, top, new Set(), 0.1).keep).toBe(false);
    expect(loot.keepsDrop(strong, top, new Set(), 0.1).keep).toBe(false); // equal is noise, not an upgrade
    // the second keep reason: an Element the player has no answer to is always kept
    const freshElement = { slot: 'chest', q: 0, lines: [{ id: 'elemental_power_flat', value: 6, element: 'fire' }] };
    expect(loot.keepsDrop(freshElement, top, new Set(), 0.1).keep).toBe(true);
    expect(loot.keepsDrop(freshElement, top, new Set(['fire']), 0.1).keep).toBe(false);
  });

  it('a full bag stops pickup rather than deleting gear (engine.json inventory.overflow)', () => {
    const s = newGame(9);
    s.bag = new Array(E.inventory.adventure_slots).fill({ slot: 'chest', base: 'chest', rarity: 'Common', quality: 'low', tier: 'T1', lines: [], q: 0 });
    for (let i = 0; i < 600; i++) tick(s, {});
    expect(s.counters.drops).toBeGreaterThan(0);
    expect(s.bag.length).toBe(E.inventory.adventure_slots);
  });
});
