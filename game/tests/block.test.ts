import { describe, it, expect } from 'vitest';
import { E, eng } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { mobSwing } from '../src/sim/combat';
import { NO_CURSE } from '../src/sim/curse';
import type { Character } from '../src/sim/player';
import type { Mob } from '../src/sim/types';

/**
 * `owner/idea-gameplay.md`: **block answers a physical hit only.** A shield argues with a blade, not
 * with a spell — so the roll is gated on the incoming hit actually carrying a physical half, and the
 * flat `armour / 10` cut is capped by that half. A pure-Element swing is never blocked and never
 * thinned, which is the half of the rule a whole-hit cut could not express.
 */

const mob = (damage: 'physical' | 'magic' | 'mixed'): Mob => ({
  id: 'm1', species: 'Knight', zone: 1, level: 90, kind: 'Medium', hp: 1e9, hpMax: 1e9,
  ps: 600, acc: 900, armour: 0, res: 0, evasion: 0, dodgeRate: 0, innate: ['fire'],
  damage, hitsPerSec: 1, atkTimer: 0,
} as Mob);

/** A sheet with a shield up and no avoidance in the way, so the block is the only variable. */
const withShield = (armour: number, block: number): Character => {
  const c = buildCharacter(90, emptyGear());
  return {
    ...c, armour, block, perfectDodge: 0, evasion: 0, evasionFromAgi: 0, resistance: 0, damageTaken: 1,
  } as Character;
};

/** liveEs 0, so nothing is absorbed by a pool and the landed number is the whole swing. */
const swing = (c: Character, damage: 'physical' | 'magic' | 'mixed') =>
  mobSwing(mulberry32(1), c, mob(damage), {}, NO_CURSE, 0);
const landed = (r: ReturnType<typeof swing>) => r.toHp + r.toEs;

describe('block answers a physical hit only (owner ruling · owner/idea-gameplay.md)', () => {
  it('never blocks a pure-Element swing', () => {
    const shielded = swing(withShield(100, 100), 'magic');
    const bare = swing(withShield(100, 0), 'magic');
    expect(shielded.raw).toBeGreaterThan(0);
    expect(shielded.blocked).toBeNull();
    // exactly the unblocked number — a shield does not thin a spell at all
    expect(landed(shielded)).toBeCloseTo(landed(bare), 9);
  });

  it('cuts a physical swing by the flat armour / 10', () => {
    const shielded = swing(withShield(100, 100), 'physical');
    const bare = swing(withShield(100, 0), 'physical');
    expect(shielded.blocked).toBe('block');
    expect(landed(bare) - landed(shielded)).toBeCloseTo(100 / 10, 6);
  });

  it('caps the cut at the physical half, so an Element-heavy swing is only thinned by that half', () => {
    // armour high enough that `armour / 10` is bigger than the physical half it may cut, but not so
    // high that the armour ratio itself erases that half — the cap is then the only thing binding
    const ARMOUR = 3000;
    const shielded = swing(withShield(ARMOUR, 100), 'mixed');
    const bare = swing(withShield(ARMOUR, 0), 'mixed');
    expect(shielded.blocked).toBe('block');
    expect(landed(shielded)).toBeGreaterThan(0);            // the Element half survives the shield
    // the reduction is the whole physical half, not the (larger) flat cut
    const [physShare] = eng.damageSplit('mixed');
    const PS = 600;                                         // the mob's `ps` in this file's helper
    const physicalFinal = PS * physShare * (1 - eng.armourReduce(ARMOUR, PS * physShare)) * E.global.defend_mult;
    expect(landed(bare) - landed(shielded)).toBeCloseTo(physicalFinal, 6);
    expect(ARMOUR / 10).toBeGreaterThan(physicalFinal);      // the cap is what bound, not the cut
  });

  it('a physical swing with no shield in hand is never blocked', () => {
    const noShield = swing(withShield(100, 0), 'physical');
    expect(noShield.blocked).toBeNull();
  });
});
