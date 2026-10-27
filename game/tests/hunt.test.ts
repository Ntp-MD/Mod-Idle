import { describe, it, expect } from 'vitest';
import { newGame, setLevel, tick, huntZone } from '../src/sim/core/game';
import { arrive, road, settlementCell } from '../src/sim/world/road';
import { migrate } from '../src/state/save';

/**
 * Safe ground: a town fields no mobs. Minute one stands in town with nothing spawning until
 * the character heads out — the hunt button, a dungeon run, or a walk that ended on wild ground,
 * which starts the fight by itself the moment the feet land.
 */
describe('safe town', () => {
  it('minute one is safe: no group, no kills', () => {
    const s = newGame();
    setLevel(s, 60);
    for (let i = 0; i < 500; i++) tick(s, {});
    expect(s.hunting).toBe(false);
    expect(s.group.length).toBe(0);
    expect(s.counters.kills).toBe(0);
  });

  it('the hunt button heads out, including in the standing zone', () => {
    const s = newGame();
    setLevel(s, 60);
    expect(huntZone(s, s.zone)).toEqual({ ok: true });
    expect(s.hunting).toBe(true);
    let guard = 0;
    while (!s.group.length && guard++ < 5000) tick(s, {});
    expect(s.group.length).toBeGreaterThan(0);
  });

  it('an unopened zone is still a walk away', () => {
    const s = newGame();
    const far = s.zone === 1 ? 2 : 1;
    expect(huntZone(s, far).ok).toBe(false);
    expect(s.hunting).toBe(false);
    expect(s.zone).not.toBe(far);
  });

  it('arriving lands on safe ground', () => {
    const s = newGame();
    setLevel(s, 60);
    (s as any).hunting = true;
    const home = settlementCell(road.nodes[0].id)!;
    arrive(s, {
      from: home, to: home, node: road.nodes[0].id, kind: 'town', sub: null, wild: null,
      blocksTotal: 1, blocksLeft: 0, secLeft: 0, blocksWalked: 1,
    } as any);
    expect(s.hunting).toBe(false);
  });

  it('a walk that ends on wild ground starts the fight by itself', () => {
    // the owner's rule: only a settlement is safe ground. One step out of town is the enemy's country, and
    // arriving there is the same order the hunt button gives — no dead minute standing on a wild hex
  const s = newGame(1);
  setLevel(s, 60);
  const home = settlementCell(road.nodes[0].id)!;
  const side = road.neighbours(home).find((h: any) => road.cellRank(h) === 1)!;
    arrive(s, {
      from: home, to: side, node: road.nodes[0].id, kind: 'sub', sub: null, wild: null,
      blocksTotal: 1, blocksLeft: 0, secLeft: 0, blocksWalked: 1,
    } as any);
    expect(s.hunting).toBe(true);
    // the arrival tick is the tick the spawn gate reads, so the group is up before the walk's fx even settles
    tick(s, {});
    expect(s.group.length).toBeGreaterThan(0);
  });

  it('old saves keep hunting', () => {
    const s = newGame() as any;
    delete s.hunting;
    expect(migrate(s).hunting).toBe(true);
  });

  it('a swing the mob answers without taking raises a cornered word, never a column entry', () => {
    const s = newGame(7);
    huntZone(s, s.zone);
    const seen = new Set<string>();
    for (let i = 0; i < 3000 && seen.size < 2; i++) {
      tick(s, {});
      for (const e of s.fx) {
        if (e.kind === 'block' && e.mobId) seen.add(String(e.text));
      }
    }
    // both halves of a failed swing name themselves: the accuracy roll and the mob's own dodge
    expect([...seen].sort()).toEqual(['dodge', 'miss']);
  });

  it('the feed names pay, not kills: XP trickles and loot lines land, no kill lines', () => {
    const s = newGame(7);
    huntZone(s, s.zone);
    for (let i = 0; i < 20000 && s.counters.kills < 3; i++) tick(s, {});
    expect(s.counters.kills).toBeGreaterThanOrEqual(3);
    const texts = s.log.map((l: any) => l.text);
    expect(texts.some((t: string) => / down$/.test(t))).toBe(false);
    expect(texts.some((t: string) => /^\+\S+ XP$/.test(t))).toBe(true);
  });
});
