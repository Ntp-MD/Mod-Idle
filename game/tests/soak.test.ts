import { describe, it, expect } from 'vitest';
import { newGame, tick, carried, huntZone } from '../src/sim/game';
import { buildCharacter } from '../src/sim/player';
import { slotsAvailable, slotsUsed } from '../src/sim/slots';

/**
 * The one long walk the unit tests never take: a live hunt from the opening minute, long enough that
 * drops, the filter, Auto Equip, skills, Pushes and the pools all run through the same loop. The
 * assertions are the invariants every one of those systems promises at once — finite numbers, pools
 * inside their sheet bounds, a bag that never grows past its slots.
 */
describe('a long live hunt stays sane', () => {
  it('runs 12k online ticks with finite pools inside their bounds and a bag that never overfills', () => {
    const s = newGame(4242);
    huntZone(s, s.zone);
    const sheet = () => buildCharacter(s.player.level, s.gear, carried(s), 0, undefined, s.player.points, s.player.treeRanks);
    for (let i = 0; i < 12000; i++) {
      tick(s, { online: true });
      if (i % 500 === 0) {
        const c = sheet();
        expect(s.player.level).toBeGreaterThan(0);
        expect(Number.isFinite(s.player.hp)).toBe(true);
        expect(Number.isFinite(s.player.mana)).toBe(true);
        expect(Number.isFinite(s.player.es)).toBe(true);
        expect(Number.isFinite(c.maxHp)).toBe(true);
        expect(s.player.hp).toBeLessThanOrEqual(c.maxHp + 1e-6);
        expect(s.player.mana).toBeLessThanOrEqual(c.maxMana + 1e-6);
        expect(s.player.es).toBeLessThanOrEqual(c.es + 1e-6);
        expect(s.player.hp).toBeGreaterThanOrEqual(0);
        expect(s.player.mana).toBeGreaterThanOrEqual(0);
        expect(s.player.es).toBeGreaterThanOrEqual(0);
        expect(slotsUsed(s)).toBeLessThanOrEqual(slotsAvailable(s));
        expect(Number.isFinite(s.counters.damage || 0)).toBe(true); // damage is written on first credit
      }
    }
    // the walk was long enough to actually live: kills, at least one level, pieces in the bag
    expect(s.counters.kills).toBeGreaterThan(0);
    expect(s.player.level).toBeGreaterThan(1);
    expect(s.bag.length).toBeGreaterThan(0);
  });
});
