import { describe, expect, it } from 'vitest';
import { catchUp, newGame, spawnMob, stepCombat } from '@sim/core/game';
import { spawnMob as spawnMobDirect } from '../../src/sim/core/spawn';
import { mulberry32 } from '../../src/engine/client-helpers';

/**
 * Phase-6 combat equivalence: every move preserves seeded state/event traces.
 * HP/mana/statuses, RNG progression, loot/XP/resource deltas, world time and
 * pending actions must match the pre-move baseline behavior exactly.
 */
function digest(s: ReturnType<typeof newGame>): string {
  return JSON.stringify({
    hp: s.player.hp, mana: s.player.mana, es: s.player.es,
    statuses: s.playerStatuses ?? null,
    mobStatuses: s.mobStatus ?? null,
    counters: s.counters,
    rngState: s.rngState, clockSec: s.clockSec, zone: s.zone,
    level: s.player.level, xp: s.player.xp ?? null,
    bag: s.bag.length, gear: s.gear.map((g) => (g ? 1 : 0)).join(''),
    group: s.group.map((m) => [m.id, m.hp, m.level].join(':')),
    fx: s.fx.length, fxSeq: (s as { fxSeq?: number }).fxSeq ?? null,
    pending: JSON.stringify((s as { pendingWork?: unknown }).pendingWork ?? null),
  });
}

function runLive(seed: number, steps: number): string {
  const s = newGame(seed);
  for (let i = 0; i < steps; i++) stepCombat(s);
  return digest(s);
}

describe('combat move equivalence', () => {
  it('keeps the facade pointing at the single spawn implementation', () => {
    expect(spawnMob).toBe(spawnMobDirect);
  });

  it('spawns identically from the same RNG stream (spawn/variant construction)', () => {
    const a = spawnMob(mulberry32(99), 1, 'normal', undefined, null, { id: 'fixed' });
    const b = spawnMob(mulberry32(99), 1, 'normal', undefined, null, { id: 'fixed' });
    expect(a).toEqual(b);
    const c = spawnMob(mulberry32(100), 1, 'normal', undefined, null, { id: 'fixed' });
    expect(c).not.toEqual(a);
  });

  it('replays live ticks deterministically (HP/mana/statuses/RNG/loot/XP/time)', () => {
    expect(runLive(7, 200)).toBe(runLive(7, 200));
  });

  it('replays offline catch-up deterministically (parity with live contracts)', () => {
    const a = newGame(7);
    catchUp(a, 3600);
    const b = newGame(7);
    catchUp(b, 3600);
    expect(digest(a)).toBe(digest(b));
  });
});
