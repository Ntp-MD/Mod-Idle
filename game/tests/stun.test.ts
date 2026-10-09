import { describe, it, expect } from 'vitest';
import { newGame, tick, setLevel, huntZone } from '../src/sim/game';
import type { Statuses } from '../src/sim/combat';
import { E, eng } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';

/**
 * Owner ruling, first step: **a shocked player is stopped.**
 *
 * `rollStatus` has always written the player's `shock` with a one-second clock and **nothing ever
 * read it** — the status was applied and did nothing. The mob side is the mirror and shows the shape:
 * `modsOn` reads a mob's own shock into `stopped` and its swing is blocked outright. So a fresh shock
 * now stands the player's swing AND its press down for the second, and the attack clock stops with
 * them rather than banking the time.
 *
 * The second step — the owner's Stun Recovery, which cuts that second — is not this module's job: it is
 * Vit's line (`K_VIT_STUNREC`), read where the status is rolled.
 */

const run = (shocked: boolean) => {
  const s = newGame(4242);
  huntZone(s, s.zone);
  setLevel(s, 60);
  s.zone = 3;
  const statuses: Statuses = shocked ? { shock: { stacks: 1, secLeft: 30, perSec: 0 } } : {};
  for (let i = 0; i < 60; i++) {
    // keep the clock fresh: this file is about the stop, not about how long a shock lasts
    if (statuses.shock) statuses.shock.secLeft = 30;
    tick(s, statuses);
  }
  return s.counters.damage || 0;
};

describe('a shocked player is stopped (the dead half of shock · item 5 step 1)', () => {
  it('the status the client already writes now costs the attack', () => {
    const bare = run(false);
    const shocked = run(true);
    expect(bare).toBeGreaterThan(0);      // the control run really does swing
    expect(shocked).toBe(0);              // and a stopped player produces nothing at all
  });

  it('the stop lasts the published `status.shock.stop_sec`, not a typed second', () => {
    // the duration is the config's own field, so re-cutting the status moves this with it
    expect(E.status.shock.stop_sec).toBeGreaterThan(0);
    const s = newGame(11);
    huntZone(s, s.zone);
    setLevel(s, 60);
    s.zone = 3;
    const statuses: Statuses = { shock: { stacks: 1, secLeft: E.status.shock.stop_sec, perSec: 0 } };
    for (let i = 0; i < E.status.shock.stop_sec; i++) tick(s, statuses);
    expect(s.counters.damage || 0).toBe(0);
    // one more second with no shock on it and the attack comes back
    tick(s, {});
    tick(s, {});
    expect(s.counters.damage || 0).toBeGreaterThan(0);
  });

  it('and the pools stop regenerating — the other half of the published shock', () => {    const s = newGame(7);
    setLevel(s, 60);
    s.zone = 3;
    s.farm.autoUse = { hp: false, mana: false };   // a potion would read as regen and hide the rule
    const statuses: Statuses = { shock: { stacks: 1, secLeft: 30, perSec: 0 } };
    tick(s, statuses);                            // let a group spawn first
    s.player.mana = 10;
    const before = s.player.mana;
    for (let i = 0; i < 3; i++) { statuses.shock!.secLeft = 30; tick(s, statuses); }
    // nothing can raise it while stopped: no regen, and no cast to spend it either
    expect(s.player.mana).toBe(before);
  });

  it('Vit buys part of the stop back, and the owner\'s 50% takes half the second', () => {
    // the sheet carries the value (one home: `K_VIT_STUNREC`), so the client and the docs read it
    const c = buildCharacter(190, emptyGear());
    expect(c.stunRecovery).toBeGreaterThan(0);
    // the K is derived from the owner's own example: a single-stat Vit build at the ceiling lands
    // on 50%, so the published one-second stop leaves half a second — and the reference build, at
    // the level-only Vit, gets a fraction of that rather than a free pass
    expect(eng.stunRecoveryOf(eng.CEIL)).toBeCloseTo(50, 0);
    expect(c.stunRecovery).toBeLessThan(eng.stunRecoveryOf(eng.CEIL));
    expect(eng.stunStopSec(eng.CEIL, E.status.shock.stop_sec)).toBeCloseTo(E.status.shock.stop_sec / 2, 1);
    // 100% is the natural bound: recovery never takes more than the whole duration
    expect(eng.stunStopSec(1e6, E.status.shock.stop_sec)).toBe(0);
  });
});
