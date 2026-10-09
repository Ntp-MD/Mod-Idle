import { describe, it, expect } from 'vitest';
import { E, eng } from '../src/engine/client';
import { newGame, tick, spendReference, huntZone } from '../src/sim/game';
import { setRule } from '../src/sim/filter';

/**
 * The one promise `loot.md` §4 makes of an AFK run: a piece the filter rejects converts on the spot,
 * so the Reroll value mint keeps paying — including **after the adventure bag fills and pickups
 * pause**. That is the whole claim, and it is a claim about a state, not about a pace.
 *
 * So the premise here is a full bag, reached directly, and the measurement is the mint across the
 * kills that follow. No hour bucket, no comparison against a published checkpoint: this game has no
 * time limit and no play-length target (`AGENTS.md`), so nothing here — and nothing that reads it —
 * may say how long a run "should" take.
 */
export const KILLS_AFTER_FULL = 200;
const CAP = 200000;

describe('the built loop keeps its promise once nothing can be picked up', () => {
  it('keeps minting Value stones with the adventure bag full', () => {
    const s = newGame(20260104);
    huntZone(s, s.zone);
    // phase 1: hunt with the filter OFF — the ships-default — so the adventure bag actually fills and
    // pickups pause. That is the state the promise is about, and it is reached by ticking to it, never
    // by a window of hours (a bag's fill pace is the player's own · AGENTS.md).
    for (let i = 0; i < CAP && s.bag.length < E.inventory.adventure_slots; i++) { tick(s, {}); spendReference(s); }
    expect(s.bag.length).toBeGreaterThanOrEqual(E.inventory.adventure_slots);
    // phase 2: arm every slot, so a rejected piece now dissolves on the spot with the bag already full
    setRule(s.filter, 'all', { enabled: true });
    for (let i = 0; i < CAP && (s.counters.stones.reroll_value || 0) === 0; i++) { tick(s, {}); spendReference(s); }
    const mintedAtFull = s.counters.stones.reroll_value || 0;
    const killsAtFull = s.counters.kills;
    for (let i = 0; i < CAP && s.counters.kills < killsAtFull + KILLS_AFTER_FULL; i++) { tick(s, {}); spendReference(s); }

    expect(s.counters.kills).toBeGreaterThan(killsAtFull); // the fight kept going with a full bag
    expect(s.counters.stones.reroll_value || 0).toBeGreaterThan(mintedAtFull);
    // eslint-disable-next-line no-console
    console.log(`\nAFK in ${eng.zoneById(s.zone).name} · bag full at ${killsAtFull} kills · `
      + `Reroll value ${mintedAtFull} → ${s.counters.stones.reroll_value} over the next ${s.counters.kills - killsAtFull} kills`);
  }, 60000);
});
