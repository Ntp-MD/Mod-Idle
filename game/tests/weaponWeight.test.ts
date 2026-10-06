import { describe, it, expect } from 'vitest';
import { BASES } from '../src/engine/client';
import { weaponWeightOf } from '../src/sim/drop';
import { buildCharacter, emptyGear } from '../src/sim/player';
import type { Item } from '../src/sim/types';

/**
 * A main-hand weapon weighs what its type says.
 *
 * Before this only the two types `mod-pool.md` named carried any weight, so every other weapon read
 * as weightless — the encumbrance tax missed exactly the builds it exists to bite (a two-handed axe
 * costs more to lift than a wand). The column lives in `equipment-weapon.md`, `tools/bases.ts` imports
 * it into `bases.json`, and the client reads it from there, so nothing below is a second copy.
 */

const axeIn = (): (Item | null)[] => {
  const gear = emptyGear();
  gear[10] = weaponPiece('two-handed axe');
  return gear;
};

function weaponPiece(name: string, slot = 'main hand'): Item {
  const w = (BASES.weapons as any[]).find((x) => x.name === name);
  return {
    slot, base: name, rarity: 'Common', quality: 'low', tier: 'T3', q: 0,
    weaponAspd: w.weapon_aspd, weight: weaponWeightOf(name, slot), lines: [],
  } as unknown as Item;
}

const gearWith = (name: string) => {
  const gear = emptyGear();
  gear[10] = weaponPiece(name);
  return gear;
};

describe('the held weapon weighs its type', () => {

  it('an off-hand weapon counts the stated fraction of its own type, not the whole thing', () => {
    const full = weaponWeightOf('dagger', 'main hand');
    const off = weaponWeightOf('dagger', 'off hand');
    expect(off).toBe(full * (BASES as any).dual_wield_weight_mult);
    expect(off).toBeLessThan(full);
  });

  it('a level-1 character carries any single weapon untaxed, and Mastery discounts the weight it would tax', () => {
    const heavy = buildCharacter(1, axeIn());
    const light = buildCharacter(1, gearWith('wand'));
    expect(heavy.weightUsed).toBeGreaterThan(light.weightUsed);
    // `weight_base` lifts the level-1 capacity clear of every weapon in the table, so a lone weapon
    // is never taxed — the tax is a percentage that binds only on a set heavy enough to cross the line
    expect(heavy.encumbrance).toBe(0);
    expect(light.encumbrance).toBe(0);
    const mastered = buildCharacter(1, gearWith('two-handed axe'), {}, 20);
    expect(mastered.weightUsed).toBeLessThan(heavy.weightUsed);
    expect(mastered.encumbrance).toBe(0);
  });
});
