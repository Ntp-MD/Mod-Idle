import { describe, expect, it } from 'vitest';
import { E } from '../../src/engine/client';
import { KEYSTONE_HANDLERS, registerStaticKeystoneHandlers, supportedKeystoneKeys } from '@sim/core/keystone-runtime';
import {
  belowLowLife, instrumentsMult, redlineDamageMult, worthyFoe,
} from '@engine/keystones.ts';

registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys(E.elements.status_of));
const h = (key: string) => KEYSTONE_HANDLERS[key] as any;

describe('Packet H — conditions, stacks and action history', () => {
  it('02 Unstoppable keeps the status but multiplies damage by 0.75 while it would stop or slow', () => {
    expect(h('unstoppable').outgoing(100, true)).toBe(75);
    expect(h('unstoppable').outgoing(100, false)).toBe(100);
    expect(h('unstoppable').timing(true)).toBe(true);
  });

  it('03 Berserk reads Low Life at 50% full Max HP and takes 15% more always', () => {
    expect(belowLowLife(500, 1000, 50)).toBe(true);
    expect(belowLowLife(501, 1000, 50)).toBe(false);
    expect(h('berserk').outgoing(100, true)).toBeCloseTo(140, 9);
    expect(h('berserk').outgoing(100, false)).toBe(100);
    expect(h('berserk').incoming(100)).toBeCloseTo(115, 9);
  });

  it('04 Redline is 1 + 3% per stack, never compounded, and caps at 10 stacks', () => {
    expect(redlineDamageMult({ damagePctPerStack: 3, maxStacks: 10 }, 10)).toBeCloseTo(1.3, 9);
    expect(h('redline').outgoing(100, 10)).toBeCloseTo(130, 9);
    expect(h('redline').outgoing(100, 0)).toBe(100);
  });

  it('11 Fortress Under Siege cuts later Hits 5% per stack and stops at 5 stacks', () => {
    expect(h('fortress-under-siege').incoming(100, 5)).toBeCloseTo(75, 9);
    expect(h('fortress-under-siege').incoming(100, 0)).toBe(100);
    expect(h('fortress-under-siege').incoming(100, 9)).toBeCloseTo(75, 9);
  });

  it('12 Worthy Foe starts at the third hit and swaps dealt/taken at the same moment', () => {
    expect(worthyFoe(2, { hits: 3, dealtMult: 1.3, takenMult: 0.8 })).toEqual({ dealtMult: 1, takenMult: 1 });
    expect(worthyFoe(3, { hits: 3, dealtMult: 1.3, takenMult: 0.8 })).toEqual({ dealtMult: 1.3, takenMult: 0.8 });
    expect(h('worthy-foe').outgoing(100, 3)).toBeCloseTo(130, 9);
    expect(h('worthy-foe').incoming(100, 3)).toBeCloseTo(80, 9);
  });

  it('16 Barkskin spends one charge for a 40% cut and does nothing without one', () => {
    expect(h('barkskin').incoming(100, 1)).toBeCloseTo(60, 9);
    expect(h('barkskin').incoming(100, 0)).toBe(100);
  });

  it('32 Instruments of Virtue rewards only an actual Attack/Spell switch', () => {
    expect(instrumentsMult('attack', 'spell', { alternateMult: 1.35 })).toBe(1.35);
    expect(instrumentsMult('spell', 'attack', { alternateMult: 1.35 })).toBe(1.35);
    expect(instrumentsMult('attack', 'attack', { alternateMult: 1.35 })).toBe(1);
    expect(instrumentsMult(null, 'attack', { alternateMult: 1.35 })).toBe(1);
  });

  it('opens all fifty-two catalogue keys', () => {
    expect(supportedKeystoneKeys(KEYSTONE_HANDLERS)).toHaveLength(105);
  });
});
