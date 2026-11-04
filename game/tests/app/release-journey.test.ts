import { describe, expect, it } from 'vitest';
import { road } from '../../src/engine/client';
import { catchUp, catchUpAsync, newGame } from '@sim/core/game';
import { earnGold, spendGold } from '@sim/core/types';
import { slotsAvailable, slotsFree } from '@sim/gear/slots';
import { exportJson, importJson } from '../../src/state/save';
import { depositMany, stashTabCount } from '@sim/town/town';
import { settlementCell } from '../../src/sim/world/road';
import {
  JOURNEY_RESOURCE_MS, applyJourneyPolicy, checkpointMatches, chooseHuntCell, createJourneyRuntime, journeyStateKey,
  makeCheckpoint, newJourneyMemory, restoreCheckpoint, runJourney, sellSurplusGoods, upgradeWornSafe,
} from '../../measurements/release-journey';

describe('release journey policy', () => {
  it('chooses a hunt cell by route then q/r and never a gathering location', () => {
    const state = newGame(20261103);
    state.cell = { q: 0, r: 0, sub: null, site: null };
    const cell = chooseHuntCell(state, 1);
    expect(cell).not.toBeNull();
    expect((road as any).locationAt(cell)).toBeNull();
    expect((road as any).cellRank(cell)).toBeGreaterThan(0);
    expect((road as any).owners(cell).length).toBeGreaterThan(0);
  });

  it('marks an unorganisable full bag as inventory-policy-blocked instead of deleting a piece', () => {
    const state = newGame(20261103);
    state.bag = Array.from({ length: slotsAvailable(state) }, () => ({
      slot: 'ring', base: 'Locked Fixture', ilvl: 1, quality: 'low', tier: 'T1', lines: [], locked: true,
    })) as never;
    const memory = newJourneyMemory(state);
    applyJourneyPolicy(state, memory);
    expect(memory.inventoryBlocked).toBe(true);
    expect(state.bag).toHaveLength(slotsAvailable(state));
    expect(memory.refusals.at(-1)?.action).toBe('inventory');
  });

  it('resumes from a checkpoint and advances the same state as an uninterrupted run', () => {
    const source = newGame(20261103);
    const memory = newJourneyMemory(source);
    const checkpoint = makeCheckpoint('fixture', source, memory);
    const restored = restoreCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
    const a = createJourneyRuntime(source, memory);
    const b = createJourneyRuntime(restored.state, restored.memory);
    for (let second = 0; second < 3; second++) {
      a.advanceSecond();
      b.advanceSecond();
    }
    expect(journeyStateKey(a.state)).toBe(journeyStateKey(b.state));
    expect(a.memory).toEqual(b.memory);
  });

  it('reports a resource cutoff as INCOMPLETE, never PASS', () => {
    const state = newGame(20261103);
    const runtime = createJourneyRuntime(state, newJourneyMemory(state));
    const result = runJourney(runtime, { maxWallMs: 0, now: () => 0 });
    expect(result.outcome.status).toBe('INCOMPLETE');
    expect(result.outcome.reason).toMatch(/resource guard/);
    expect(JOURNEY_RESOURCE_MS).toBe(1_800_000);
  });

  it('catches round-trip loss against the original across ownership, resources, location, pending work and progression', () => {
    const base = newGame(20261103);
    const key = journeyStateKey(base);
    expect(checkpointMatches(base, importJson(exportJson(base)))).toBe(true);
    const cases: ((s: ReturnType<typeof newGame>) => void)[] = [
      (s) => { s.town.owned.push('synthetic-ownership-probe'); },
      (s) => { s.counters.gold += 1; },
      (s) => { s.cell = { q: (s.cell?.q || 0) + 1, r: s.cell?.r || 0, sub: null, site: null }; },
      (s) => { s.pendingWork = { kind: 'synthetic-probe' } as never; },
      (s) => { s.counters.kills += 1; },
    ];
    for (const mutate of cases) {
      const probe = importJson(exportJson(base));
      mutate(probe);
      expect(journeyStateKey(probe)).not.toBe(key);
      expect(checkpointMatches(base, probe)).toBe(false);
    }
  });

  it('ignores transient receipts and the authored log cap instead of reading them as a loss', () => {
    const state = newGame(20261103);
    if (state.field) (state.field as unknown as Record<string, unknown>).engagementTruncated = 3;
    if (state.combatHistory) for (let id = 1; id <= 200; id++) state.combatHistory.push({ id, sec: 1, kind: 'push', text: 'Probe', away: false });
    expect(checkpointMatches(state, importJson(exportJson(state)))).toBe(true);
  });

  it('deposits across every owned tab in index order and never touches locked or reserved pieces', () => {
    const state = newGame(20261103);
    state.grants.stash_tabs = 2;
    const tabs = stashTabCount(state);
    expect(tabs).toBeGreaterThanOrEqual(2);
    const gear = (i: number, extra = {}) => ({ slot: 'ring', base: `Probe ${i}`, ilvl: 1, quality: 'low', tier: 'T1', lines: [], ...extra });
    state.bag = [gear(1), gear(2, { locked: true }), gear(3, { heldFor: 'set-x' }), gear(4)] as never;
    const movedFirst = depositMany(state, [0, 3], 0);
    expect(movedFirst).toBe(2);
    expect(state.bag).toHaveLength(2);
    // depositMany never moves a locked piece; the remaining unlocked piece can use the next tab.
    const movedSecond = depositMany(state, [0, 1], 1);
    expect(movedSecond).toBe(1);
    expect(state.bag).toHaveLength(1);
    expect(state.bag[0]).toMatchObject({ locked: true });
  });

  it('counts same-second earn and spend separately instead of netting them away', () => {
    const state = newGame(20261103);
    const memory = newJourneyMemory(state);
    earnGold(state.counters, 50);
    spendGold(state.counters, 20);
    applyJourneyPolicy(state, memory);
    expect(memory.goldEarned).toBe(50);
    expect(memory.goldSpent).toBe(20);
  });

  it('matches single, sliced and cancel-resumed away catch-up with no travel or boss drift', async () => {
    const source = newGame(20261103);
    const cell = source.cell ? `${source.cell.q},${source.cell.r}` : '';
    const a = importJson(exportJson(source));
    const b = importJson(exportJson(source));
    const sync = catchUp(a, 120);
    const asyncRes = await catchUpAsync(b, 120);
    expect(sync.simulated).toBe(asyncRes.simulated);
    expect(journeyStateKey(a)).toBe(journeyStateKey(b));
    const d = importJson(exportJson(source));
    let sliced = 0;
    for (let i = 0; i < 4; i++) sliced += catchUp(d, 30).simulated;
    expect(sliced).toBe(sync.simulated);
    expect(journeyStateKey(d)).toBe(journeyStateKey(a));
    const e = importJson(exportJson(source));
    const controller = new AbortController();
    const cancelled = await catchUpAsync(e, 120, { signal: controller.signal,
      onProgress: (done) => { if (done > 0) controller.abort(); } });
    expect(cancelled.simulated).toBeLessThan(120);
    const resumed = catchUp(e, 120 - cancelled.simulated);
    expect(cancelled.simulated + resumed.simulated).toBe(sync.simulated);
    expect(journeyStateKey(e)).toBe(journeyStateKey(a));
    for (const s of [b, d, e]) {
      expect(s.cell ? `${s.cell.q},${s.cell.r}` : '').toBe(cell);
      expect(s.walk).toBeFalsy();
    }
  });

  it('buys the cheapest unowned stash tab with earned gold when the organized bag is still full', () => {
    const state = newGame(20261103);
    state.cell = settlementCell('eastgate')!;
    state.zone = 1;
    state.bag = Array.from({ length: slotsAvailable(state) }, (_, i) => ({
      slot: 'ring', base: `Keep ${i}`, ilvl: 1, quality: 'low', tier: 'T1', lines: [],
    })) as never;
    state.counters.gold = 1000;
    const memory = newJourneyMemory(state);
    applyJourneyPolicy(state, memory);
    expect(memory.inventoryBlocked).toBe(false);
    expect(state.town.owned).toContain('stash_tab_1');
    expect(state.counters.gold).toBe(1000 - 24);
    expect(state.counters.goldSpent).toBe(24);
    expect(slotsFree(state)).toBeGreaterThan(0);
    expect(importJson(exportJson(state)).town.owned).toContain('stash_tab_1');
  });

  it('stays blocked with a priced refusal when the purse cannot cover the next tab', () => {
    const state = newGame(20261103);
    state.cell = settlementCell('eastgate')!;
    state.zone = 1;
    const pieces = slotsAvailable(state);
    state.bag = Array.from({ length: pieces }, (_, i) => ({
      slot: 'ring', base: `Keep ${i}`, ilvl: 1, quality: 'low', tier: 'T1', lines: [],
    })) as never;
    state.counters.gold = 0;
    const memory = newJourneyMemory(state);
    applyJourneyPolicy(state, memory);
    expect(memory.inventoryBlocked).toBe(true);
    expect(state.town.owned).not.toContain('stash_tab_1');
    expect(state.bag).toHaveLength(pieces);
    expect(memory.refusals.some((row) => row.action === 'stash-tab')).toBe(true);
    expect(memory.refusals.at(-1)).toMatchObject({ action: 'inventory' });
  });

  it('walks to the cheapest visited tab when the local one is unaffordable', () => {
    const state = newGame(20261103);
    state.cell = settlementCell('highspire')!;
    state.zone = 2;
    state.town.visited.push('highspire');
    state.bag = Array.from({ length: slotsAvailable(state) }, (_, i) => ({
      slot: 'ring', base: `Keep ${i}`, ilvl: 1, quality: 'low', tier: 'T1', lines: [],
    })) as never;
    state.counters.gold = 40;
    const memory = newJourneyMemory(state);
    applyJourneyPolicy(state, memory);
    expect(memory.inventoryBlocked).toBe(false);
    expect(state.town.owned).toHaveLength(0);
    expect(state.counters.gold).toBe(40);
    expect(state.walk).toBeTruthy();
    expect((state.walk as unknown as { to: { q: number; r: number } }).to.q).toBe(0);
    expect((state.walk as unknown as { to: { q: number; r: number } }).to.r).toBe(0);
  });

  it('stays blocked when no visited settlement has an affordable tab', () => {
    const state = newGame(20261103);
    state.cell = settlementCell('highspire')!;
    state.zone = 2;
    state.town.visited.push('highspire');
    state.bag = Array.from({ length: slotsAvailable(state) }, (_, i) => ({
      slot: 'ring', base: `Keep ${i}`, ilvl: 1, quality: 'low', tier: 'T1', lines: [],
    })) as never;
    state.counters.gold = 0;
    const memory = newJourneyMemory(state);
    applyJourneyPolicy(state, memory);
    expect(memory.inventoryBlocked).toBe(true);
    expect(state.walk).toBeFalsy();
    expect(memory.refusals.some((row) => row.action === 'stash-tab')).toBe(true);
  });

  it('reuses an owned tab instead of buying another', () => {
    const setup = () => {
      const state = newGame(20261103);
      state.cell = settlementCell('eastgate')!;
      state.zone = 1;
      state.town.owned.push('stash_tab_1');
      state.bag = Array.from({ length: slotsAvailable(state) }, (_, i) => ({
        slot: 'ring', base: `Keep ${i}`, ilvl: 1, quality: 'low', tier: 'T1', lines: [],
      })) as never;
      state.counters.gold = 100_000;
      return state;
    };
    const a = setup();
    const b = setup();
    applyJourneyPolicy(a, newJourneyMemory(a));
    applyJourneyPolicy(b, newJourneyMemory(b));
    expect(a.town.owned).toEqual(['stash_tab_1']);
    expect(a.town.owned).toEqual(b.town.owned);
    expect(a.counters.gold).toBe(100_000);
  });

  it('sells surplus goods but holds back open delivery contracts', () => {
    const setup = () => {
      const state = newGame(20261103);
      state.cell = settlementCell('eastgate')!;
      state.zone = 1;
      state.junk['Goblin Ear'] = 10;
      state.fieldwork.materials['ore'] = 10;
      state.fieldwork.foods['raw_game_meat'] = 50;
      state.town.contracts = { eastgate: [{
        id: 'probe', serial: 1, town: 'eastgate', good: 'material:ore', target: 5, delivered: 2,
        status: 'open',
      }] } as never;
      state.counters.gold = 0;
      return state;
    };
    const a = setup();
    const goldBefore = a.counters.gold;
    sellSurplusGoods(a);
    expect(a.junk['Goblin Ear'] || 0).toBe(0);
    expect(a.fieldwork.materials['ore']).toBe(3);
    expect(a.fieldwork.foods['raw_game_meat'] || 0).toBe(0);
    expect(a.counters.gold).toBeGreaterThan(goldBefore);
    expect(a.counters.goldEarned).toBeGreaterThan(0);
    const b = setup();
    sellSurplusGoods(b);
    expect(b.counters.gold).toBe(a.counters.gold);
    expect(b.fieldwork.materials['ore']).toBe(3);
    // A second pass finds nothing left to sell and mints nothing.
    const goldAfter = a.counters.gold;
    sellSurplusGoods(a);
    expect(a.counters.gold).toBe(goldAfter);
  });

  it('upgrades worn pieces through safe steps only, deterministically', () => {
    const setup = () => {
      const state = newGame(20261103);
      state.cell = settlementCell('eastgate')!;
      state.zone = 1;
      state.gear = [{ slot: 'ring', base: 'Keep', ilvl: 1, quality: 'low', tier: 'T1', lines: [] }] as never;
      state.bag = Array.from({ length: slotsAvailable(state) }, (_, i) => ({
        slot: 'ring', base: `Keep ${i}`, ilvl: 1, quality: 'low', tier: 'T1', lines: [],
      })) as never;
      state.counters.stones = { quality: 500 };
      return state;
    };
    const a = setup();
    expect(upgradeWornSafe(a)).toBeGreaterThan(0);
    expect((a.gear[0] as { upgrade_lv?: number }).upgrade_lv).toBe(4);
    expect(a.counters.stones['quality']).toBe(500 - 1 - 2 - 3 - 4);
    const b = setup();
    const countA = upgradeWornSafe(setup());
    expect(upgradeWornSafe(b)).toBe(countA);
    expect((b.gear[0] as { upgrade_lv?: number }).upgrade_lv).toBe(4);
    // At the safe cap nothing gambles, even with stones to burn.
    expect(upgradeWornSafe(a)).toBe(0);
    expect((a.gear[0] as { upgrade_lv?: number }).upgrade_lv).toBe(4);
    // Broken, corrupted and unaffordable pieces are left alone.
    const c = setup();
    (c.gear[0] as { broken?: boolean }).broken = true;
    expect(upgradeWornSafe(c)).toBe(0);
    const d = setup();
    d.counters.stones = {};
    expect(upgradeWornSafe(d)).toBe(0);
    expect((d.gear[0] as { upgrade_lv?: number } | undefined)?.upgrade_lv || 0).toBe(0);
  });

  it('frees a slot when bench spending drops a stone stack under its boundary', () => {
    const state = newGame(20261103);
    state.cell = settlementCell('eastgate')!;
    state.zone = 1;
    state.gear = [{ slot: 'ring', base: 'Keep', ilvl: 1, quality: 'low', tier: 'T1', lines: [] }] as never;
    state.bag = Array.from({ length: 96 }, (_, i) => ({
      slot: 'ring', base: `Keep ${i}`, ilvl: 1, quality: 'low', tier: 'T1', lines: [],
    })) as never;
    state.counters.stones = { quality: 1000 };
    expect(slotsFree(state)).toBeLessThanOrEqual(0);
    const freeBefore = slotsFree(state);
    expect(upgradeWornSafe(state)).toBeGreaterThan(0);
    expect(slotsFree(state)).toBeGreaterThan(freeBefore);
  });

  it('refuses PASS when goal.done has no real encounter or the post-win second never advances', () => {
    const fake = newGame(20261103);
    fake.goal.done = { clockSec: fake.clockSec, level: 1, hp: 100 };
    fake.goal.attempts = 0;
    const fakeRun = runJourney(createJourneyRuntime(fake, newJourneyMemory(fake)), { maxWallMs: 1000, now: () => 0 });
    expect(fakeRun.outcome.status).toBe('FAIL');
    expect(fakeRun.outcome.reason).toMatch(/real encounter|post-win clock/);
  });
});
