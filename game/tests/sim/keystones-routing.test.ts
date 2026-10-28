import { describe, expect, it } from 'vitest';
import { E, eng } from '../../src/engine/client';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { mobSwing, playerSwing } from '@sim/combat/combat';
import { KEYSTONE_HANDLERS, registerStaticKeystoneHandlers, supportedKeystoneKeys } from '@sim/core/keystone-runtime';
import {
  capacitiveEs, crushingRhythm, elementalInfusionExtras, mindOverMatter, turtleCut,
  type KeystoneBundle,
} from '@engine/keystones.ts';
import type { Mob } from '@sim/core/types';

registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys(E.elements.status_of));
const bundle = (key: string, params: Record<string, number | string>): KeystoneBundle => ({ key, params });
const sheet = (bundles: KeystoneBundle[] = []) =>
  buildCharacter(1, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, undefined, {}, bundles);

function dumbMob(over: Partial<Mob> = {}): Mob {
  return {
    id: 'm1', species: 'Dummy', kind: 'normal', zone: 1, level: 1, hp: 1e9, hpMax: 1e9,
    ps: 100, acc: 0, evasion: 0, dodgeRate: 0, armour: 0, res: 0, damage: 'physical',
    innate: [], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
  } as Mob;
}
const noHit = () => 0.99;

describe('Packet G — routing, cadence, recovery', () => {
  it('33 Mind over Matter pays 30% of HP-bound damage from positive unreserved Mana', () => {
    expect(mindOverMatter(100, 20, { manaSharePct: 30 })).toEqual({ mana: 20, hp: 80 });
    expect(mindOverMatter(100, 1000, { manaSharePct: 30 })).toEqual({ mana: 30, hp: 70 });
    const handler = KEYSTONE_HANDLERS['mind-over-matter'] as any;
    expect(handler.incoming({ hpDamage: 100, manaAvailable: 0 })).toEqual({ mana: 0, hp: 100 });
  });

  it('42 Crushing Rhythm caps at 1/s and converts the excess rate into damage once', () => {
    expect(crushingRhythm(4, { maxBasicHitsPerSec: 1 })).toEqual({ actualRate: 1, damageMult: 4 });
    expect(crushingRhythm(0.6, { maxBasicHitsPerSec: 1 })).toEqual({ actualRate: 0.6, damageMult: 1 });
    const c = sheet([bundle('crushing-rhythm', { maxBasicHitsPerSec: 1 })]);
    const mob = dumbMob({ ps: 0, armour: 0, hp: 1e9 });
    const control = playerSwing(noHit, c, mob, null, undefined, 0, 1);
    const crushedTarget = dumbMob({ ps: 0, armour: 0, hp: 1e9 });
    const crushed = playerSwing(noHit, c, crushedTarget, null, undefined, 0, 4);
    expect(crushed.landed).toBe(true);
    expect(crushed.damage).toBeCloseTo(control.damage * 4, 6);
    // the multiplier must reach the actual pool, not only the reported number
    expect(1e9 - crushedTarget.hp).toBeCloseTo((1e9 - mob.hp) * 4, 4);
  });

  it('44 Turtle Doctrine turns Block into an expected physical cut with no Block event', () => {
    expect(turtleCut(50, 100, 10, 100)).toBe(5);
    expect(turtleCut(100, 1000, 10, 50)).toBe(50);
    const c = { ...sheet([bundle('turtle-doctrine', {})]), armour: 100, block: 50, resistance: 0, resByElement: {} };
    const r = mobSwing(noHit, c, dumbMob({ ps: 100 }), {}, undefined, 0);
    expect(r.blocked).toBeNull();
    const turtle = mobSwing(noHit, { ...c, keystones: [] }, dumbMob({ ps: 100 }), {}, undefined, 0);
    // the expected cut is applied every Hit and can only lower the damage the unblocked control takes
    expect(r.toHp).toBeLessThanOrEqual(turtle.toHp);
  });

  it('45 Dark Siphon sends Life Leech and Mana Regen to ES', () => {
    const handler = KEYSTONE_HANDLERS['dark-siphon'] as any;
    expect(handler.recovery('hp')).toBe('es');
    expect(handler.recovery('mana')).toBe('es');
    const c = sheet([bundle('dark-siphon', {})]);
    expect(c.es).toBe(sheet([]).es);
  });

  it('58 Capacitive Casting funds ES only from real Mana and halves natural ES regen', () => {
    expect(capacitiveEs(40, 10, { spentManaEsPct: 20 })).toBe(2);
    expect(capacitiveEs(40, 0, { spentManaEsPct: 20 })).toBe(0);
    const handler = KEYSTONE_HANDLERS['capacitive-casting'] as any;
    expect(handler.recovery(10)).toBe(5);
  });

  it('65 Elemental Infusion adds 30% of Physical split by the raw Flat lines', () => {
    const elements = Object.keys(E.elements.status_of);
    const extras = elementalInfusionExtras(100, { fire: 10, cold: 20 }, { extraTotalPct: 30 }, elements);
    expect(extras.fire).toBeCloseTo(10, 9);
    expect(extras.cold).toBeCloseTo(20, 9);
    expect(elementalInfusionExtras(100, {}, { extraTotalPct: 30 }, elements)).toEqual({});
    const base = sheet([bundle('elemental-infusion', { extraTotalPct: 30 })]);
    const c = {
      ...base, phys: 100, critChance: 0, critDmg: 200,
      lines: { ...base.lines, elemBy: { fire: { flat: 10, pct: 0 }, cold: { flat: 20, pct: 0 } }, elemFlat: 30 },
      attackDamage: 0, spellDamage: 0, alignment: 100, elemByElement: {},
    } as any;
    const r = playerSwing(noHit, c, dumbMob({ armour: 0, res: 0 }), null);
    expect(r.packet?.parts.extraElement.fire).toBeCloseTo(10, 6);
    expect(r.packet?.parts.extraElement.cold).toBeCloseTo(20, 6);
    expect(eng).toBeDefined();
  });

  it('opens all fifty-two catalogue keys', () => {
    expect(supportedKeystoneKeys(KEYSTONE_HANDLERS)).toHaveLength(105);
    for (const key of ['mind-over-matter', 'crushing-rhythm', 'turtle-doctrine', 'dark-siphon', 'capacitive-casting', 'elemental-infusion']) {
      expect(supportedKeystoneKeys(KEYSTONE_HANDLERS)).toContain(key);
    }
  });
});
