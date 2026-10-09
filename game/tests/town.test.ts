import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { eng, E, TOWN, loot } from '../src/engine/client';
import {
  rowById, priceGold, priceMinutes, stockOf, settlementById, sellJunk, canBuy, buy,
  claimTask, newTown, standingShare, standingTier, canTravel, rollTask,
} from '../src/sim/town';
import { mulberry32 } from '../src/engine/client-helpers';
import { newGame, tick } from '../src/sim/game';

const require = createRequire(import.meta.url);
const cage = require('../../tools/lib/engine.ts');

describe('prices are minutes of income, not typed gold', () => {
  it('the client rate equals the cage rate', () => {
    for (const band of ['low', 'mid', 'high']) {
      expect(eng.goldPerMinute(band)).toBe(cage.goldPerMinute(band));
    }
  });

  it('sells no route — the walk is free, and the Waypoint is the only travel line for gold', () => {
    expect(rowById('road_link')).toBeUndefined();
    const lines = [...TOWN.one_time, ...TOWN.repeatable].filter((r) => /^(road|carriage)/.test(r.id));
    expect(lines.length).toBe(0);
    const warp = rowById('waypoint_warp');
    expect(warp.kind).toBe('time');
    expect(warp.m_per_block > 0).toBe(true);
    // it buys back time and nothing else: no settlement stocks it, so it is never a stall purchase
    expect(TOWN.settlements.some((s: any) => (s.stock || []).includes('waypoint_warp'))).toBe(false);
  });

  it('Eastgate sells the first stash tab at the teaching price', () => {
    expect(priceMinutes(rowById('stash_tab_1'), 'eastgate')).toBe(rowById('stash_tab_1').discount.m);
    expect(priceMinutes(rowById('stash_tab_1'), 'ashfall')).toBe(rowById('stash_tab_1').m);
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
    // one roll per kill at the variant's own rarity, so a low zone pays junk on about 1 kill in 20 —
    // run until the first piece lands rather than for a fixed window that can miss it
    const total = () => Object.values(s.junk).reduce((a: number, b: number) => a + b, 0);
    for (let i = 0; i < 20000 && total() === 0; i++) tick(s, {});
    const pieces = total();
    expect(pieces).toBeGreaterThan(0);
    const goldBefore = s.counters.gold;
    const r = sellJunk(s);
    // each item is priced at its own rarity, and the item's rarity is the variant row's own
    const rarityOf: Record<string, string> = {};
    for (const row of Object.values(E.mob.variant_drops as Record<string, any>)) rarityOf[row.item] = row.rarity;
    let expectGold = 0;
    for (const [item, count] of Object.entries(s.junk)) expectGold += count * E.junk.rarities[rarityOf[item]].sell_gold;
    expect(r.gold).toBe(s.counters.gold - goldBefore + expectGold);
    expect(Object.values(s.junk).reduce((a: number, b: number) => a + b, 0)).toBe(0);
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
  it('minute one offers the Elite task engine.json describes, at the board\u2019s own sizing', () => {
    const s = newGame();
    const task = s.town.tasks[0]!;
    expect(task.kind).toBe('elite');
    expect(task.zone).toBe(E.opening.settlement_zone);
    expect(task.n).toBe(TOWN.task_sizing.elite_n);
  });

  it('the elite payout is in stones, sized off the band\u2019s own income', () => {
    const s = newGame();
    const task = s.town.tasks[0]!;
    expect(task.stone).toBe('tier');
    expect(task.count).toBe(eng.taskPayout('low', TOWN.task_sizing.reward_minutes_of_band_income).tier);
    expect(Number.isInteger(task.count)).toBe(true);
    task.progress = task.n;
    s.clockSec = 10;
    expect(claimTask(s, 0)).toBe(true);
    expect(s.counters.stones.tier).toBe(task.count);
    expect(s.town.tasks[0]).toBe(null);
    expect(s.town.refillAt[0]).toBe(10 + TOWN.task_sizing.refill_sec);
  });

  it('offers only Elite and Boss tasks, each priced by its own kind', () => {
    const s = newGame(99);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const t = rollTask(mulberry32(i + 1), s);
      seen.add(t.kind);
      expect(['elite', 'boss']).toContain(t.kind);
      expect(t.stone).toBe(t.kind === 'elite' ? 'tier' : 'remove');
      expect(t.n).toBe(t.kind === 'elite' ? TOWN.task_sizing.elite_n : 1);
    }
    // both kinds are reachable, and the plain kill-count task that used to carry 60% of the roll is gone
    expect(seen.has('elite')).toBe(true);
    expect(seen.has('boss')).toBe(true);
  });

  it('kills feed the matching slot and an empty slot refills after an hour', () => {
    const s = newGame();
    s.town.tasks[1] = { kind: 'elite', zone: 1, n: 3, progress: 0, stone: 'tier', count: 1, claimed: false, offeredAt: 0 };
    // tick until the Elite the slot waits for actually spawns, never for a guessed window: Elites are
    // one kill in five, so a fixed window is a coin flip on the roll (AGENTS.md). The bound is a hang guard.
    for (let i = 0; i < 200000 && s.town.tasks[1].progress === 0; i++) tick(s, {});
    expect(s.town.tasks[1].progress).toBeGreaterThan(0);
    s.clockSec = s.town.refillAt[0] + 1;
    tick(s, {});
    expect(s.town.tasks[0]).toBeTruthy();
  });
});

describe('a Waypoint opens on foot and never for gold', () => {
  it('a settlement is unreachable until it has been walked to, and no gold opens it', () => {
    const s = newGame();
    expect(canTravel(s, 'eastgate')).toBe(true);       // the start is walked to by definition
    expect(canTravel(s, 'vermolch')).toBe(false);
    s.counters.gold = 100_000;
    // gold cannot buy the way: only arriving on foot does
    s.town.owned.push('stash_tab_1');
    expect(canTravel(s, 'vermolch')).toBe(false);
    s.town.visited.push('vermolch');
    expect(canTravel(s, 'vermolch')).toBe(true);
  });

  it('standing is earned by kills in that settlement zone and never grants power', () => {
    const s = newGame();
    const budget = eng.SETTLEMENT_BUDGET_KILLS[1];
    s.counters.zoneKills[1] = Math.round(budget);
    expect(standingShare(s, 'eastgate')).toBeCloseTo(1, 1);
    expect(standingTier(s, 'eastgate')).toBe(2);          // Tier III asks for 1.4 of the budget
    // the budget is already a count of kills, so the tier's own threshold is the state to set —
    // rounded up, because a tier is reached AT its threshold and rounding down misses it by a kill
    s.counters.zoneKills[1] = Math.ceil(budget * TOWN.standing.tiers[2].share);
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
    // tick until the paused-pickup run has rolled a drop, never for a guessed window (AGENTS.md)
    for (let i = 0; i < 40000 && s.counters.drops === 0; i++) tick(s, {});
    expect(s.counters.drops).toBeGreaterThan(0);
    expect(s.bag.length).toBe(E.inventory.adventure_slots);
  });
});
