import { describe, it, expect } from 'vitest';
import { validateEngineData } from '../../engine/validate.ts';
import { K_KEYS } from '../../engine/types.ts';
import { E } from '../src/engine/client';

/**
 * The canonical data is checked before anything reads it. Every case runs on a copy, so a bad
 * input is proved without the real file ever changing.
 */

/** A copy of the canonical data — the negative cases work on this, never on the file. */
const copy = (): any => structuredClone(E as any);

describe('the canonical data is checked before anything reads it', () => {
  it('loads the real file', () => {
    expect(() => validateEngineData(copy())).not.toThrow();
  });

  it('carries exactly the constants the engine declares', () => {
    expect(Object.keys(E.K).sort()).toEqual([...K_KEYS].sort());
  });

  it('names the constant the file lost', () => {
    const data = copy();
    delete data.K.K_VIT_HP;
    expect(() => validateEngineData(data)).toThrow(/K\.K_VIT_HP must be a finite number/);
  });

  it('names a constant that is not a number', () => {
    const data = copy();
    data.K.K_STR = 'twelve';
    expect(() => validateEngineData(data)).toThrow(/K\.K_STR must be a finite number/);
  });

  it('names the section the file lost', () => {
    const data = copy();
    delete data.max_hp_press;
    expect(() => validateEngineData(data)).toThrow(/max_hp_press is missing/);
  });

  it('names the value that is not a number', () => {
    const data = copy();
    data.stat.level_cap = '190';
    expect(() => validateEngineData(data)).toThrow(/stat\.level_cap must be a finite number/);
  });

  it('names a Cap that is neither a number nor an explicit null', () => {
    const data = copy();
    data.caps.evasion = 'eighty';
    expect(() => validateEngineData(data)).toThrow(/caps\.evasion must be a finite number or null/);
  });

  it('names the pair that is not a pair', () => {
    const data = copy();
    data.mob.zones[0].levels = [1];
    expect(() => validateEngineData(data)).toThrow(/mob\.zones\[0\]\.levels must be a pair of numbers/);
  });

  it('names the identity that is duplicated', () => {
    const data = copy();
    data.mob.species[1].id = data.mob.species[0].id;
    expect(() => validateEngineData(data)).toThrow(/mob\.species\[1\]\.id duplicates species id/);
  });

  it('names a Core block that lost an attribute', () => {
    const data = copy();
    data.mob.species[0].core.lck = undefined;
    expect(() => validateEngineData(data)).toThrow(/mob\.species\[0\]\.core\.lck must be a finite number/);
  });

  it('leaves the file it was given untouched', () => {
    const data = copy();
    const before = JSON.stringify(data);
    expect(() => validateEngineData(data)).not.toThrow();
    expect(JSON.stringify(data)).toBe(before);
  });
});
