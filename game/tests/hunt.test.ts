import { describe, it, expect } from 'vitest';
import { newGame, setLevel, tick, huntZone } from '../src/sim/game';
import { arrive } from '../src/sim/road';
import { migrate } from '../src/state/save';

/**
 * Safe ground: a town fields no mobs. Minute one stands in town with nothing spawning until
 * the character heads out — the hunt button, a walk arrival in reverse, or a dungeon run.
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
    arrive(s, { from: 'eastgate', to: 'eastgate', blocksTotal: 1, blocksLeft: 0, secLeft: 0, blocksWalked: 1 } as any);
    expect(s.hunting).toBe(false);
  });

  it('old saves keep hunting', () => {
    const s = newGame() as any;
    delete s.hunting;
    expect(migrate(s).hunting).toBe(true);
  });
});
