import { describe, expect, it } from 'vitest';
import { E } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { playerSwing } from '../src/sim/combat';
import { KEYSTONE_HANDLERS, registerStaticKeystoneHandlers, supportedKeystoneKeys } from '../src/sim/keystone-runtime';
import {
  armourBreak, borrowedRecoup, crimsonPactSplit, deferredHit, disruptingStop, endlessHungerBank,
  equilibriumResistance, escapeBurst, maledictionValue, parasiticLeech, plagueTransfer,
  staggeringSplit, surgeonStream, timeOfNeedHeal, toxicExecution, type KeystoneBundle,
} from '../../engine/keystones.ts';
import type { Mob } from '../src/sim/types';

registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys(E.elements.status_of));
const h = (key: string) => KEYSTONE_HANDLERS[key] as any;
const bundle = (key: string, params: Record<string, number | string>): KeystoneBundle => ({ key, params });
function mob(over: Partial<Mob> = {}): Mob {
  return {
    id: 'm1', species: 'Dummy', kind: 'normal', zone: 1, level: 1, hp: 1000, hpMax: 1000,
    ps: 0, acc: 0, evasion: 0, dodgeRate: 0, armour: 0, res: 0, damage: 'physical',
    innate: [], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
  } as Mob;
}

describe('Packet K — status mechanics', () => {
  it('09 Crimson Pact pays half now and owes the full physical as Bleed over 4s', () => {
    expect(crimsonPactSplit(100, { directPhysicalPct: 50, bleedTotalPct: 100, durationSec: 4 }))
      .toEqual({ direct: 50, bleedTotal: 100, bleedDps: 25 });
  });

  it('20 Toxic Execution turns the crit bonus into 4s of Poison with no Element', () => {
    expect(toxicExecution(100, 1, { durationSec: 4 })).toEqual({ budgetDps: 100, dps: 25 });
  });

  it('28 Malediction scales add lines and mult distance from 1', () => {
    expect(maledictionValue('add', 20, { effectMult: 1.75 })).toBe(35);
    expect(maledictionValue('mult', 0.8, { effectMult: 1.75 })).toBeCloseTo(0.65, 9);
  });

  it('30 Elemental Equilibrium raises the dominant resistance and lowers the others, floor 0', () => {
    expect(equilibriumResistance(10, 50, { ownResPlus: 10, otherResMinus: 20 })).toEqual({ own: 20, other: 30 });
    expect(equilibriumResistance(10, 10, { ownResPlus: 10, otherResMinus: 20 })).toEqual({ own: 20, other: 0 });
  });

  it('43 Armourbreaker breaks 5% of the initial Armour per hit, capped at 60%', () => {
    expect(armourBreak(1000, 0, { armourBreakPct: 5, maxBreakPct: 60 })).toEqual({ armour: 950, stacks: 1 });
    expect(armourBreak(1000, 11, { armourBreakPct: 5, maxBreakPct: 60 })).toEqual({ armour: 400, stacks: 12 });
    expect(armourBreak(1000, 12, { armourBreakPct: 5, maxBreakPct: 60 }).armour).toBe(400);
  });

  it('46 Disrupting Blows stops only a Hit worth 5% of Max HP', () => {
    expect(disruptingStop(50, 1000, { hitMaxHpThresholdPct: 5 })).toBe(true);
    expect(disruptingStop(49, 1000, { hitMaxHpThresholdPct: 5 })).toBe(false);
  });

  it('60 Plague Courier keeps the instance clock and lifetime', () => {
    expect(plagueTransfer(10, 2000, 5000)).toEqual({ dps: 10, nextPayAtUs: 2000, expiresAtUs: 5000 });
  });

  it('66 Elemental Conduit opens an extra attempt only when the extra lane carried damage', () => {
    expect(h('elemental-conduit').status(5)).toBe(true);
    expect(h('elemental-conduit').status(0)).toBe(false);
  });
});

describe('Packet L — timed recovery', () => {
  it('07 Endless Hunger banks the excess up to 20% of the destination pool', () => {
    expect(endlessHungerBank(0, 150, 500, { bankCapPct: 20 })).toBe(100);
    expect(endlessHungerBank(90, 30, 500, { bankCapPct: 20 })).toBe(100);
  });

  it('17 Master Surgeon spreads ×1.5 over four seconds', () => {
    expect(surgeonStream(100, { healMult: 1.5, durationSec: 4 })).toEqual({ total: 150, perSec: 37.5 });
  });

  it('21 Delayed Demolition pays 60% now and 40% ×1.5 after the delay', () => {
    expect(deferredHit(100, { deferredPct: 40, deferredMult: 1.5 })).toEqual({ immediate: 60, deferred: 60 });
    const c = buildCharacter(1, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, undefined, {},
      [bundle('delayed-demolition', { deferredPct: 40, deferredMult: 1.5, delaySec: 2 })]);
    const r = playerSwing(() => 0.99, { ...c, phys: 100, critChance: 0 }, mob({ armour: 0 }), null, undefined, 0);
    expect(r.deferred).toBeGreaterThan(0);
  });

  it('24 Escape Artist bursts 50% Max ES, halved by 58 when that is bought', () => {
    expect(escapeBurst(100, { esBurstPct: 50 })).toBe(50);
  });

  it('36 Time of Need heals 15% of Full Max HP', () => {
    expect(timeOfNeedHeal(1000, { healMaxHpPct: 15 })).toBe(150);
  });

  it('40 Borrowed Time recoups 40% over six payments', () => {
    expect(borrowedRecoup(100, { recoupPct: 40, durationSec: 6 }).total).toBeCloseTo(40, 9);
    expect(borrowedRecoup(100, { recoupPct: 40, durationSec: 6 }).perPay).toBeCloseTo(40 / 6, 9);
  });

  it('56 Staggering Resolve pays 60% now and five equal debts', () => {
    expect(staggeringSplit(100, { deferredPct: 40, durationSec: 5 })).toEqual({ immediate: 60, perDebt: 8 });
  });

  it('61 Parasitic Affliction returns 2% of actual DoT damage', () => {
    expect(parasiticLeech(100, { baseLeechPct: 2 })).toBe(2);
    expect(parasiticLeech(0, { baseLeechPct: 2 })).toBe(0);
  });

  it('the registry now opens all fifty-two catalogue keys', () => {
    expect(supportedKeystoneKeys(KEYSTONE_HANDLERS)).toHaveLength(52);
  });
});
