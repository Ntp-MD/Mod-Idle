import { describe, it, expect } from 'vitest';
import { E, eng } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import type { Item } from '../src/sim/types';

/**
 * Elemental power is one rule, and the engine owns it (DECISIONS: per Element, the flat pool plus
 * `Int x K_ELEM` for the weapon's own Element, scaled by the shared and the Element-specific
 * percents).
 *
 * The figures below were read off the sheet BEFORE the rule moved into the engine, so they are a
 * before/after record and not a restatement of the code. Each case names a shape the rule has to
 * answer: one Element, two Elements, none, a percent line, a Herald on the weapon's own Element and
 * a Herald on another.
 */

const gearWith = (lines: any[], slot = 10): (Item | null)[] => {
  const gear = emptyGear();
  gear[slot] = {
    slot: slot === 10 ? 'main hand' : 'off hand', base: slot === 10 ? 'one-handed sword' : 'Buckler',
    ilvl: 1, quality: 'low', tier: 'T3', weaponAspd: 1.2, q: 0, lines,
  } as unknown as Item;
  return gear;
};

const F = (value: number, element: string | null) => ({ id: 'elemental_power_flat', value, slice: 0, element });
const P = (value: number, element: string | null) => ({ id: 'elemental_power', value, slice: 0, element });

describe('the elemental pool is the engine rule, and the sheet reads it', () => {
  it('puts the whole pool on the weapon’s own Element', () => {
    const c = buildCharacter(40, gearWith([F(40, 'fire')]));
    expect(c.elem).toBeCloseTo(199.42857142857144, 6);
    expect(c.elemByElement).toEqual({ fire: 199.42857142857144 });
  });

  it('splits a two-Element weapon, and the split never invents or loses pool', () => {
    const c = buildCharacter(40, gearWith([F(60, 'fire'), F(40, 'cold')]));
    expect(c.elem).toBeCloseTo(259.42857142857144, 6);
    expect(Object.keys(c.elemByElement)).toEqual(['fire', 'cold']);
    expect(c.elemByElement.fire).toBeCloseTo(219.42857142857144, 6);
    expect(c.elemByElement.cold).toBeCloseTo(40, 6);
    expect(Object.values(c.elemByElement).reduce((a, b) => a + b, 0)).toBeCloseTo(c.elem, 6);
  });

  it('keeps a build with no Element on the piece unattributed, never countered either way', () => {
    const c = buildCharacter(40, gearWith([F(40, null)]));
    expect(c.elem).toBeCloseTo(199.42857142857144, 6);
    expect(c.elemByElement).toEqual({ '': 199.42857142857144 });
  });

  it('lets a percent line ride its own Element and leaves the rest unattributed', () => {
    const c = buildCharacter(40, gearWith([P(20, 'fire')]));
    expect(c.elem).toBeCloseTo(191.31428571428572, 6);
    expect(c.elemByElement.fire).toBeCloseTo(223.20000000000002, 6);
    expect(c.elemByElement['']).toBeCloseTo(-31.8857142857143, 6);
  });

  it('answers a flat line and a percent line together', () => {
    const c = buildCharacter(40, gearWith([F(40, 'fire'), P(20, 'fire')]));
    expect(c.elem).toBeCloseTo(239.31428571428572, 6);
    expect(c.elemByElement.fire).toBeCloseTo(279.2, 6);
    expect(c.elemByElement['']).toBeCloseTo(-39.88571428571427, 6);
  });

  it('adds a Herald on top of the weapon’s own Element, leaving every other pool alone', () => {
    const c = buildCharacter(40, gearWith([F(40, 'fire')]), {}, 0, { add: { 'elemental_power:fire': 30 }, mult: {} });
    expect(c.elem).toBeCloseTo(229.42857142857144, 6);
    expect(c.elemByElement).toEqual({ fire: 229.42857142857144 });
  });

  it('adds a Herald on another Element to that Element’s own pool', () => {
    const c = buildCharacter(40, gearWith([F(40, 'fire')]), {}, 0, { add: { 'elemental_power:cold': 30 }, mult: {} });
    expect(c.elem).toBeCloseTo(229.42857142857144, 6);
    expect(c.elemByElement.fire).toBeCloseTo(199.42857142857144, 6);
    expect(c.elemByElement.cold).toBeCloseTo(30, 6);
  });

  it('leaves the pool alone when nothing carries an Element', () => {
    const c = buildCharacter(40, emptyGear());
    expect(c.elem).toBeCloseTo(159.42857142857144, 6);
    expect(c.elemByElement).toEqual({ '': 159.42857142857144 });
  });

  it('counts an Element on a piece that is not the weapon, and keeps the weapon’s base unattributed', () => {
    const c = buildCharacter(40, gearWith([F(25, 'cold')], 11));
    expect(c.weaponElement).toBe(null);
    expect(c.elem).toBeCloseTo(184.42857142857144, 6);
    expect(c.elemByElement.cold).toBeCloseTo(25, 6);
    expect(c.elemByElement['']).toBeCloseTo(159.42857142857144, 6);
  });

  it('is the same figure the engine rule produces from the same pools', () => {
    const c = buildCharacter(40, gearWith([F(60, 'fire'), F(40, 'cold'), P(20, 'fire')]));
    const int = c.core.int;
    const own = eng.elementalPowerOf({
      intCore: int,
      weaponElement: c.weaponElement,
      flat: 60 + 40,
      pct: 20,
      byElement: { fire: { flat: 60, pct: 20 }, cold: { flat: 40, pct: 0 } },
      herald: {},
    });
    expect(c.elem).toBeCloseTo(own.total, 6);
    expect(c.elemByElement.fire).toBeCloseTo(own.byElement.fire, 6);
    expect(c.elemByElement.cold).toBeCloseTo(own.byElement.cold, 6);
  });
});
