import { describe, it, expect } from 'vitest';
import { E, dungeon as D } from '../src/engine/client';
import { newGame, setLevel, tick, huntZone } from '../src/sim/game';
import { enterDungeon, cooldownLeft } from '../src/sim/dungeon';

/**
 * DG4 · the run's behaviour. A run fields `mob_cap` normals of its zone in encounters of at
 * most `group_cap` and pays the ordinary per-kill roll — the escrow only delays it, so the data
 * shape the dungeon cage gates (DG1-DG3) is all the tuning this file reads.
 *
 * Loot waits in escrow until the last mob falls; a Push ends the run at once and the escrow is
 * forfeited, never paid; a cleared run cools down for `cooldown_sec` before the next entry.
 */
const sum = (m: Record<string, number> = {}) => Object.values(m).reduce((a, b) => a + b, 0);

function entered(level = 60) {
  const s = newGame();
  setLevel(s, level);
  expect(enterDungeon(s)).toEqual({ ok: true });
  return s;
}

describe('dungeon run', () => {
  it('entry opens a run of mob_cap in the standing zone, and refuses a second run', () => {
    const s = entered();
    expect(s.dungeon?.zone).toBe(s.zone);
    expect(s.dungeon?.left).toBe(D.mobCap);
    expect(s.dungeon?.total).toBe(D.mobCap);
    expect(enterDungeon(s).ok).toBe(false);
  });

  it('entry refuses mid-fight', () => {
    const s = newGame();
    huntZone(s, s.zone);
    setLevel(s, 60);
    let guard = 0;
    while (!s.group.length && guard++ < 5000) tick(s, {});
    expect(s.group.length).toBeGreaterThan(0);
    const r = enterDungeon(s);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/fight/);
  });

  it('kills escrow instead of paying, groups stay within group_cap, the run pays on the last mob', () => {
    const s = entered();
    const bag0 = s.bag.length;
    const junk0 = sum(s.junk);
    const stones0 = sum(s.counters.stones);
    const kills0 = s.counters.kills;
    let guard = 0;
    while (s.counters.kills < kills0 + 3 && guard++ < 20000) tick(s, {});
    expect(s.dungeon).not.toBeNull();
    // nothing landed: the rolls wait in escrow
    expect(s.bag.length).toBe(bag0);
    expect(sum(s.junk)).toBe(junk0);
    expect(sum(s.counters.stones)).toBe(stones0);
    guard = 0;
    let maxGroup = 0;
    while (s.dungeon && guard++ < 60000) {
      tick(s, {});
      maxGroup = Math.max(maxGroup, s.group.length);
      if (s.dungeon) expect(s.dungeon.left).toBeGreaterThanOrEqual(0);
    }
    expect(s.dungeon).toBeNull();
    // the run fields exactly its mob count, in capped encounters
    expect(s.counters.kills - kills0).toBe(D.mobCap);
    expect(maxGroup).toBeLessThanOrEqual(D.groupCap);
    // the escrow paid out: something material landed
    const paid = s.bag.length - bag0 > 0 || (s.counters.salvaged || 0) > 0
      || sum(s.junk) - junk0 > 0 || sum(s.counters.stones) - stones0 > 0;
    expect(paid).toBe(true);
    expect(s.dungeonClearedAt).toBe(s.clockSec);
    expect(s.log.some((l) => /Dungeon cleared/.test(l.text))).toBe(true);
  });

  it('a Push forfeits the escrow and cools nothing down', () => {
    const s = entered();
    let guard = 0;
    while (s.counters.kills === 0 && guard++ < 20000) tick(s, {});
    s.dungeon!.escrow.stones = { tier: 5 };
    const stones0 = sum(s.counters.stones);
    // lethal damage past any regen: the end-of-tick check reads a negative pool as a Push
    s.player.hp = -1e9;
    tick(s, {});
    expect(s.phase).toBe('camp');
    expect(s.dungeon).toBeNull();
    expect(sum(s.counters.stones)).toBe(stones0);
    expect(s.dungeonClearedAt).toBeUndefined();
    expect(cooldownLeft(s)).toBe(0);
    expect(enterDungeon(s).why).toMatch(/camp/);
    expect(s.log.some((l) => /forfeited/.test(l.text))).toBe(true);
  });

  it('a cleared run cools down before the next entry', () => {
    const s = entered();
    let guard = 0;
    while (s.dungeon && guard++ < 60000) tick(s, {});
    expect(s.dungeon).toBeNull();
    const r = enterDungeon(s);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/cooling/);
    expect(cooldownLeft(s)).toBeGreaterThan(0);
    s.clockSec += E.dungeon.cooldown_sec + 1;
    expect(enterDungeon(s)).toEqual({ ok: true });
  });
});
