import { describe, it, expect } from 'vitest';
import { MODS, SKILLS, sm } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear, type Character } from '../src/sim/player';
import { playerSwing } from '../src/sim/combat';
import { NO_CURSE } from '../src/sim/curse';
import type { Item, Mob } from '../src/sim/types';

/**
 * The two damage buckets (owner ruling): `Attack damage %` on the attack ladder, `Spell damage %` on
 * the spell ladder, each additive only inside itself.
 *
 * A bucket scales what the ladder already deals, so no Core stat moves and a press multiplies once.
 * Every figure here is the line's own top read out of `mods.json`, and the press is the engine's own
 * `perPress` run on the sheet the gear produced — never a second copy of the arithmetic.
 */

const topOf = (id: string) => Number(MODS.mods.find((m: any) => m.id === id)!.max);

const row = (basis: string) => (SKILLS as any).skills.find((r: any) => r.basis === basis && r.base_flat != null);
const press = (c: Character, r: any) =>
  sm.perPress(r, { phys: c.phys, magic: c.magic, elem: c.elem, align: c.alignment, attackPct: c.attackDamage, spellPct: c.spellDamage });

/** A sheet wearing one weapon line, so each pair below differs by exactly that line. */
function sheetWearing(id: string | null, weapon = 'one-handed sword'): Character {
  const gear = emptyGear();
  gear[0] = { slot: 'main hand', base: weapon, ilvl: 61, quality: 'high', tier: 'T1', q: 2, weight: 0,
    lines: id ? [{ id, value: topOf(id), slice: 1 }] : [] } as unknown as Item;
  return buildCharacter(90, gear);
}

const mob = (): Mob => ({
  id: 'm1', species: 'Knight', zone: 1, level: 90, kind: 'Medium', hp: 1e9, hpMax: 1e9,
  ps: 600, acc: 900, armour: 0, res: 0, evasion: 0, dodgeRate: 0, innate: ['fire'],
  damage: 'physical', hitsPerSec: 1, atkTimer: 0,
} as Mob);
const swing = (c: Character) => playerSwing(mulberry32(3), c, mob(), null, NO_CURSE).damage;
/**
 * A swing answers its Element pools on their own line, and the bucket is written on the ladder, not on
 * the Element — so the exact ratio is read on a sheet whose hit is all non-Element.
 */
const noElement = (c: Character) => ({ ...c, elem: 0, elemByElement: {} } as Character);

describe('the damage buckets reach the sheet', () => {
  it('each line feeds its own character field', () => {
    expect(sheetWearing('attack_damage_pct').attackDamage).toBe(topOf('attack_damage_pct'));
    expect(sheetWearing('spell_damage_pct').spellDamage).toBe(topOf('spell_damage_pct'));
  });

  it('and a bare sheet carries no bucket at all, so a published press is the empty-bucket baseline', () => {
    const bare = sheetWearing(null);
    expect(bare.attackDamage).toBe(0);
    expect(bare.spellDamage).toBe(0);
    for (const basis of ['phys', 'magic']) {
      expect(press(bare, row(basis))).toBeCloseTo(sm.perPress(row(basis), { phys: bare.phys, magic: bare.magic, elem: bare.elem, align: bare.alignment })!, 9);
    }
  });
});

describe('a bucket multiplies its own ladder and never the other', () => {
  it('Attack damage % scales a phys-basis press and leaves a magic-basis press alone', () => {
    const pct = topOf('attack_damage_pct');
    const bare = sheetWearing(null);
    const c = sheetWearing('attack_damage_pct');
    expect(press(c, row('phys'))).toBeCloseTo(press(bare, row('phys'))! * (1 + pct / 100), 6);
    expect(press(c, row('magic'))).toBeCloseTo(press(bare, row('magic'))!, 6);
  });

  it('Spell damage % scales a magic-basis press and leaves a phys-basis press alone', () => {
    const pct = topOf('spell_damage_pct');
    const bare = sheetWearing(null);
    const c = sheetWearing('spell_damage_pct');
    expect(press(c, row('magic'))).toBeCloseTo(press(bare, row('magic'))! * (1 + pct / 100), 6);
    expect(press(c, row('phys'))).toBeCloseTo(press(bare, row('phys'))!, 6);
  });

  it('a swing rides the attack bucket, and the spell half of the pair does not touch it', () => {
    const pct = topOf('attack_damage_pct');
    const bare = noElement(sheetWearing(null));
    expect(swing(noElement(sheetWearing('attack_damage_pct')))).toBeCloseTo(swing(bare) * (1 + pct / 100), 6);
    expect(swing(noElement(sheetWearing('spell_damage_pct')))).toBeCloseTo(swing(bare), 6);
  });

  it('a swing that carries Element grows by less than the bucket — the Element pools are not the attack', () => {
    const pct = topOf('attack_damage_pct');
    const bare = sheetWearing(null);
    const withIt = sheetWearing('attack_damage_pct');
    expect(bare.elem).toBeGreaterThan(0);
    expect(swing(withIt)).toBeGreaterThan(swing(bare));
    expect(swing(withIt)).toBeLessThan(swing(bare) * (1 + pct / 100));
  });

  it('a magic weapon bolt rides the spell bucket instead — the bolt is the spell ladder', () => {
    const pct = topOf('spell_damage_pct');
    const bare = noElement(sheetWearing(null, 'wand'));
    expect(swing(noElement(sheetWearing('spell_damage_pct', 'wand')))).toBeCloseTo(swing(bare) * (1 + pct / 100), 6);
    expect(swing(noElement(sheetWearing('attack_damage_pct', 'wand')))).toBeCloseTo(swing(bare), 6);
  });
});
