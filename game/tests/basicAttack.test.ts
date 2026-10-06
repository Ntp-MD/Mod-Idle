import { describe, it, expect } from 'vitest';
import { eng, E, sm, BASES } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear, type Character } from '../src/sim/player';
import { playerSwing } from '../src/sim/combat';
import { NO_CURSE } from '../src/sim/curse';
import type { Mob } from '../src/sim/types';

/**
 * HugePatch §14c · `weapon.basic_attack: swing | bolt`.
 *
 * A magic weapon has no swing — it flicks a **bolt**: a press on the attack clock, no mana and no
 * cooldown, worth the **attack ladder's floor** (the weakest attack row in the roster). So a caster
 * never idles on an empty bar, and the bar can hold real cooldowns instead of filler rows. Which
 * weapon is a bolt is read off the weapon's own damage line, never a second field.
 */

const mob = (): Mob => ({
  id: 'm1', species: 'Knight', zone: 1, level: 90, kind: 'Medium', hp: 1e9, hpMax: 1e9,
  ps: 600, acc: 900, armour: 0, res: 0, evasion: 0, dodgeRate: 0, innate: ['fire'],
  damage: 'physical', hitsPerSec: 1, atkTimer: 0,
} as Mob);

/** The bolt is switched off by naming a FLAT melee row: the sheet's own phys/magic do not move. */
const sheet = (weapon: string): Character =>
  ({ ...buildCharacter(90, emptyGear()), weaponName: weapon, evasion: 0, evasionFromAgi: 0, perfectDodge: 0 } as Character);
const landed = (c: Character) => playerSwing(mulberry32(3), c, mob(), null, NO_CURSE).damage;

describe('a magic weapon flicks a bolt (§14c)', () => {
  it('the bolt is read off the weapon damage line, not a second field', () => {
    expect(eng.basicAttackOf(BASES, 'wand')).toBe('bolt');
    expect(eng.basicAttackOf(BASES, 'staff')).toBe('bolt');
    expect(eng.basicAttackOf(BASES, 'one-handed sword')).toBe('swing');
    expect(eng.basicAttackOf(BASES, 'crossbow')).toBe('swing');
    expect(eng.basicAttackOf(BASES, 'bare hand')).toBe('swing');   // an unknown name falls back to a swing
  });

  it('its value is the attack ladder\'s floor, so the filler is never a downgrade', () => {
    const floor = sm.ladderFloorPct();
    const attack = sm.of('attack').map((k: any) => k.final_pct);
    expect(floor).toBe(Math.min(...attack));      // the roster's own floor, not a number beside it
    expect(floor).toBeGreaterThanOrEqual(100);    // a press is worth at least a swing, by construction
    // the reference: the SAME sheet under a flat melee row, which swings and carries no bolt
    const c = sheet('wand');
    const flat = playerSwing(mulberry32(3), { ...c, weaponName: 'one-handed sword' }, mob(), null, NO_CURSE).damage;
    const bolted = landed(c);
    const row = (E.weapon_size_mult as any).ladder.wand.medium;   // the wand's own Medium column
    expect(bolted).toBeCloseTo(flat * row * (floor / 100), 6);
  });

  it('and a melee weapon is untouched by it', () => {
    const c = sheet('crossbow');
    const flat = playerSwing(mulberry32(3), { ...c, weaponName: 'one-handed sword' }, mob(), null, NO_CURSE).damage;
    const row = (E.weapon_size_mult as any).ladder.crossbow.medium;
    // a swing weapon reads its body row and nothing else — no ladder floor on top
    expect(landed(c)).toBeCloseTo(flat * row, 6);
    expect(E.weapons.length).toBeGreaterThan(0);   // the aspd bands the swing clock reads
  });
});
