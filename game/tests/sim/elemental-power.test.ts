import { describe, it, expect } from 'vitest';
import { eng } from '../../src/engine/client';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { craft } from '@sim/gear/craft';
import { newGame } from '@sim/core/game';
import { equipFromBag } from '@sim/gear/gear';
import { playerSwing } from '@sim/combat/combat';
import { NO_CURSE } from '@sim/combat/curse';
import { mobFixture } from '../fixtures/mobFixture';
import { mulberry32 } from '../../src/engine/client-helpers';
import type { Item } from '@sim/core/types';

/**
 * Elemental power is one rule, and the engine owns it: the flat pool plus `Int x K_ELEM` for the
 * weapon's own Element, scaled by the shared and the Element-specific percents.
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

  it('floors a combined percent below -100% at zero instead of minting a negative pool', () => {
    const own = eng.elementalPowerOf({
      intCore: 10, weaponElement: 'poison', flat: 100, pct: -114,
      byElement: { poison: { flat: 40, pct: 4 } }, herald: {},
    });
    expect(own.byElement.poison).toBe(0);
    expect(Object.values(own.byElement).every((v) => v >= 0)).toBe(true);
    expect(own.total).toBeCloseTo(
      Object.values(own.byElement).reduce((a, b) => a + b, 0), 10);
  });
});

describe('imprint → equip → swing with a sub -100% combined percent', () => {
  it('lands without the validator refusing the packet after HP was paid', () => {
    // a real drop shape: frame + bound pair up top, one editable line to imprint
    const drop: Item = {
      slot: 'main hand', base: 'one-handed sword', ilvl: 99, quality: 'mid', tier: 'T3',
      weaponAspd: 1.2, q: 1,
      lines: [
        { id: 'physical_power_flat', value: 10, slice: 2 },
        { id: 'armour_flat', value: 5, slice: 2 },
        { id: 'accuracy_flat', value: 5, slice: 2 },
        { id: 'attack_damage_flat', value: 8, slice: 2 },
      ],
    } as unknown as Item;
    const stamped = craft.imprint(drop, 3, 'elemental_power', mulberry32(7));
    expect(stamped.ok).toBe(true);
    const el = (stamped.item.lines[3] as any).element as string;
    expect(typeof el).toBe('string');
    // the rest of the build drags the shared percent below -100%
    const anchor: Item = {
      slot: 'chest', base: 'Plate', ilvl: 99, quality: 'mid', tier: 'T3', q: 1,
      lines: [{ id: 'elemental_power', value: -114, slice: 0, element: null }],
    } as unknown as Item;
    const s = newGame(71);
    s.bag = [stamped.item, anchor];
    expect(equipFromBag(s, 0).ok).toBe(true);
    expect(equipFromBag(s, 0).ok).toBe(true);
    const c = buildCharacter(50, s.gear);
    expect(c.elemByElement[el]).toBe(0);
    expect(Object.values(c.elemByElement).every((v) => (v as number) >= 0)).toBe(true);
    const m = mobFixture({
      species: 'Goblin', level: 1, hp: 100000, hpMax: 100000, xp: 10, ps: 100, acc: 50,
      evasion: 10, damage: 'phys', align: 100, crit: 0, innate: [el],
    });
    const r = playerSwing(() => 0.5, c, m, null, NO_CURSE, null);
    expect(r.landed).toBe(true);
    for (const lane of [r.packet!.parts.nativeElement, r.packet!.parts.convertedElement, r.packet!.parts.extraElement])
      for (const v of Object.values(lane)) expect(v).toBeGreaterThanOrEqual(0);
  });
});
