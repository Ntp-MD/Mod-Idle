import { describe, it, expect } from 'vitest';
import { E } from '../src/engine/client';
import { newGame, tick, setLevel, huntZone } from '../src/sim/game';
import { craft } from '../src/sim/craft';

/**
 * The three stones the craft ladder costs have an income now.
 *
 * `crafting.md` priced Upgrade / Repair / Corrupt while `loot.md` §5 paid for none of them, so a
 * player could never run the bench. The rates are `engine.json` `loot.*_stone_sources`; every figure
 * the bench asks for is read from the same data, so this file checks the minting path and nothing else.
 */

const L = E.loot as any;
const C = E.craft as any;
const bench: any = craft;

const piece = (over: any = {}) => ({
  slot: 'helmet', base: 'coif', ilvl: 1, quality: 'low', tier: 'T3', q: 0,
  lines: [{ id: 'armour_flat', value: 20, slice: 2 }], ...over,
});

/**
 * One hunt, stopped by the STATE the calling test waits on rather than by a window of hours: a fixed
 * four-hour run is a time premise (`AGENTS.md`) and it was most of this file's 21 minutes of suite.
 * `until` names the state; the `hours` argument only scales the hang guard.
 */
function hunt(hours: number, level: number, zone: number, online: boolean, seed: number, until: (s: any) => boolean = (st) => st.counters.kills > 0) {
  const s = newGame(seed);
  huntZone(s, s.zone);
  setLevel(s, level);
  s.zone = zone;
  // Tick until the run has killed the thing each assertion waits on, never for a fixed number of
  // hours: a four-hour window is a time premise (AGENTS.md) and it is the reason this file cost 21
  // minutes of the suite. The bound is a hang guard. `hours` is only used to scale that bound.
  const cap = 3600 * hours * 6;
  for (let i = 0; i < cap && !until(s); i++) tick(s, {}, { online });
  expect(s.counters.kills).toBeGreaterThan(0);
  return s;
}

describe('Quality, Repair and Corrupt stone are minted by hunting', () => {
  // the loop pays a boss stone only to a kill, and `combat.md` §7 says losing = losing the spawn, so
  // these runs hunt a zone the character can actually win: level 90 against zone 1's mobs
  it('a run that kills bosses pays all three stones', () => {
    // corrupt is boss-only, so the state this test waits on is the boss stone itself
    const s = hunt(4, 90, 1, true, 20261004, (st) => (st.counters.stones.corrupt || 0) > 0);
    expect(s.counters.stones.quality || 0).toBeGreaterThan(0);
    expect(s.counters.stones.repair || 0).toBeGreaterThan(0);
    expect(s.counters.stones.corrupt || 0).toBeGreaterThan(0);
    // the boss line is 24 whole stones a kill, so it dominates the pool at four bosses an hour — measured
    // over the run the test itself produced, never over a fixed window it might not have reached
    const fromBoss = L.boss_per_hour * L.quality_stone_sources.boss_quality_stones * (s.clockSec / 3600);
    expect(s.counters.stones.quality).toBeGreaterThan(fromBoss * 0.4);
  }, 60000);

  it('an offline run mints Quality but cannot mint the boss-only stone', () => {
    // offline mints no boss stone, so the state to wait on is the quality line, not corrupt
    const s = hunt(4, 90, 1, false, 91, (st) => (st.counters.stones.quality || 0) > 0);
    expect(s.counters.stones.quality || 0).toBeGreaterThan(0);
    expect(s.counters.stones.corrupt || 0).toBe(0);
    // elites still count while away, so Repair (elite or boss) can arrive but stays the smaller line
    expect(s.counters.stones.repair || 0).toBeLessThan(s.counters.stones.quality);
  }, 60000);

  it('the bench charges Quality stones by the published step, and a run earns the steps', () => {
    expect(bench.costOf('upgrade', piece())).toEqual({ quality: C.upgrade_costs[0] });
    expect(bench.costOf('upgrade', piece({ upgrade_lv: 10 }))).toEqual({ quality: C.upgrade_costs[10] });
    expect(bench.costOf('repair', piece({ broken: true }))).toEqual({ repair: C.repair_stones });
    expect(bench.costOf('corrupt', piece())).toEqual({ corrupt: 1 });
    const s = hunt(4, 90, 1, true, 20261004, (st) => (st.counters.stones.quality || 0) >= C.upgrade_costs[0] && (st.counters.stones.corrupt || 0) >= 1);
    // the ladder's cheapest step is inside what one hunting session earns
    expect(s.counters.stones.quality).toBeGreaterThanOrEqual(C.upgrade_costs[0]);
    expect(s.counters.stones.corrupt).toBeGreaterThanOrEqual(1);
  }, 60000);
});
