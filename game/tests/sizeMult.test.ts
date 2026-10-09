import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/engine/client-helpers';
import { E, eng } from '../src/engine/client';
import { buildCharacter, emptyGear, type Character } from '../src/sim/player';
import { playerSwing } from '../src/sim/combat';
import { NO_CURSE } from '../src/sim/curse';
import type { Mob } from '../src/sim/types';

/** The size-multiplier ladder straight off the data (`engine.json weapon_size_mult.ladder`). */
const ladder = (E as any).weapon_size_mult.ladder;

/**
 * HugePatch §12 · weapon × body class, the mechanism. Mounted on the session's own data:
 * `engine.json weapon_size_mult` carries the ladder, `playerSwing` applies it to the whole
 * non-Element part of a swing (a swing is the weapon arguing with a body, whatever damage type it
 * deals) and it lands AFTER mitigation. `X47` gates the table's shape; this file gates the swing.
 */

const mob = (readsAs: string): Mob => ({
  id: 'm1', species: 'Knight', zone: 1, level: 90, kind: 'Medium', hp: 1e9, hpMax: 1e9,
  ps: 600, acc: 900, armour: 0, res: 0, evasion: 0, dodgeRate: 0, innate: ['fire'],
  damage: 'physical', hitsPerSec: 1, atkTimer: 0, readsAs,
} as Mob);

/** No evasion in the way, so the only variable is the weapon's own ladder. */
const sheet = (weapon: string): Character =>
  ({ ...buildCharacter(90, emptyGear()), weaponName: weapon, evasion: 0, evasionFromAgi: 0, perfectDodge: 0 } as Character);

const landed = (weapon: string, readsAs: string) =>
  playerSwing(mulberry32(3), sheet(weapon), mob(readsAs), null, NO_CURSE).damage;

describe('a weapon meets a body class (§12)', () => {
  it('the reference weapon is indifferent to the body', () => {
    const small = landed('one-handed sword', 'small');
    const large = landed('one-handed sword', 'large');
    expect(small).toBeGreaterThan(0);
    expect(large).toBeCloseTo(small, 9);
  });

  it('a Large-favouring weapon hits a Large body harder than a Small one, by its own row', () => {
    const small = landed('mace', 'small');
    const large = landed('mace', 'large');
    // the row is the owner's dagger ladder pointed the other way: 1.25 vs 0.75 = 5/3
    expect(large / small).toBeCloseTo(ladder.mace.large / ladder.mace.small, 4);
  });

  it('and a Small-favouring weapon reads the other way round', () => {
    expect(landed('dagger', 'small') / landed('dagger', 'large')).toBeCloseTo(ladder.dagger.small / ladder.dagger.large, 4);
    // the neutral column is the same for both, and a magic weapon is answered by the same table
    expect(landed('dagger', 'medium')).toBeGreaterThan(0);
    expect(landed('wand', 'large') / landed('wand', 'small')).toBeCloseTo(ladder.wand.large / ladder.wand.small, 4);
  });

  it('a boss reads the class it declares, and an unknown class falls back to flat', () => {
    // the table has three columns, not four: a boss is a species that declares which one it reads
    expect(eng.spawnAt(9, 90, 'boss').readsAs).toBe('large');
    // "boss" is not a column, so it must not silently become a bonus — it reads the identity
    expect(eng.sizeMultOf(ladder, 'mace', 'large')).toBeCloseTo(ladder.mace.large, 9);
    expect(eng.sizeMultOf(ladder, 'mace', 'boss')).toBe(1);
    expect(eng.sizeMultOf(ladder, 'a weapon that does not exist', 'large')).toBe(1);
  });
});
