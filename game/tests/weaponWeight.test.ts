import { describe, it, expect } from 'vitest';
import { BASES, E } from '../src/engine/client';
import { weaponWeightOf } from '../src/sim/drop';
import { buildCharacter, emptyGear } from '../src/sim/player';
import type { Item } from '../src/sim/types';

/**
 * B13 · a main-hand weapon weighs what its type says (harness/todo.md B13 · D-101).
 *
 * Before this only the two types `mod-pool.md` named carried any weight, so every other weapon read
 * as weightless — the encumbrance tax missed exactly the builds it exists to bite (a two-handed axe
 * costs more to lift than a wand). The column lives in `equipment-weapon.md`, `tools/bases.js` imports
 * it into `bases.json`, and the client reads it from there, so nothing below is a second copy.
 */

const axeIn = (): Item[] => {
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
  it('reads the column for every type, endpoints included', () => {
    for (const w of BASES.weapons as any[]) {
      expect(weaponWeightOf(w.name)).toBe(w.weight);
      expect(w.weight).toBeGreaterThan(0);
    }
    expect(weaponWeightOf('wand')).toBe(weaponWeightOf('rod'));
    expect(weaponWeightOf('two-handed axe')).toBeGreaterThan(weaponWeightOf('two-handed sword'));
    expect(weaponWeightOf('two-handed sword')).toBeGreaterThan(weaponWeightOf('mace'));
  });

  it('an off-hand weapon counts the stated fraction of its own type, not the whole thing', () => {
    const full = weaponWeightOf('dagger', 'main hand');
    const off = weaponWeightOf('dagger', 'off hand');
    expect(off).toBe(full * (BASES as any).dual_wield_weight_mult);
    expect(off).toBeLessThan(full);
  });

  it('a heavy weapon taxes a weak arm, and Mastery discounts the weight it taxes', () => {
    const heavy = buildCharacter(1, axeIn());
    const light = buildCharacter(1, gearWith('wand'));
    expect(heavy.weightUsed).toBeGreaterThan(light.weightUsed);
    // level 1 capacity is the bare Str line × K_STR_WEIGHT, so the axe is far over it and the wand
    // only just — which is the whole reason the tax is a percentage and not a slot lock
    expect(heavy.encumbrance).toBe((E.caps as any).weight_overload);
    expect(light.encumbrance).toBeGreaterThan(0);
    expect(light.encumbrance).toBeLessThan(heavy.encumbrance);
    const mastered = buildCharacter(1, gearWith('two-handed axe'), {}, 20);
    expect(mastered.weightUsed).toBeLessThan(heavy.weightUsed);
    expect(mastered.encumbrance).toBeLessThanOrEqual(heavy.encumbrance);
  });
});
