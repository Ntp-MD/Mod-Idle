import { describe, expect, it } from 'vitest';
import { E, eng } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { mobSwing, playerSwing } from '../src/sim/combat';
import { KEYSTONE_HANDLERS, registerKeystoneHandler, registerStaticKeystoneHandlers, supportedKeystoneKeys } from '../src/sim/keystone-runtime';
import { ironwallSheet, type KeystoneBundle } from '../../engine/keystones.ts';
import type { Mob } from '../src/sim/types';

registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys(E.elements.status_of));

const bundle = (key: string, params: Record<string, number | string>): KeystoneBundle => ({ key, params });

function sheet(bundles: KeystoneBundle[]) {
  return buildCharacter(1, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, undefined, {}, bundles);
}

const noHit: () => number = () => 0.99;
function dumbMob(over: Partial<Mob> = {}): Mob {
  return {
    id: 'm1', species: 'Dummy', kind: 'normal', zone: 1, level: 1,
    hp: 1e9, hpMax: 1e9, ps: 200, acc: 0, evasion: 0, dodgeRate: 0,
    armour: 0, res: 0, damage: 'mixed', innate: ['fire'], xp: 1, line: 'front',
    hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
  } as Mob;
}

describe('Packet E — static keystones', () => {
  it('01 Ironwall turns Evasion Rating into Armour 1:1 and removes the Evasion layer', () => {
    expect(ironwallSheet(100, 200)).toEqual({ armour: 300, evasion: 0 });
    const control = sheet([]);
    const walled = sheet([bundle('ironwall', { evasionToArmour: 1 })]);
    expect(walled.armour).toBeCloseTo(control.armour + control.evasion, 9);
    expect(walled.evasion).toBe(0);
    expect(walled.evasionChance).toBe(0);
    // Perfect Dodge is its own layer and is not touched
    expect(walled.perfectDodge).toBe(control.perfectDodge);
  });

  it('05 Emberheart routes the crit-finished Physical share into Fire 1:1', () => {
    const handler = KEYSTONE_HANDLERS['emberheart'] as any;
    const packet = {
      sourceActionId: 'swing', actorId: 'player', targetId: 'm1', timeUs: 0, nominalRate: 1,
      flags: { direct: true, secondary: false, dot: false, deferred: false, canCrit: true, canStatus: true, canLeech: false, canTriggerKillEffect: true },
      parts: { physicalCritEligible: 200, physicalNonCrit: 0, magic: 0, nativeElement: {}, convertedElement: {}, extraElement: {} },
    };
    const out = handler.outgoing(packet);
    expect(out.parts.physicalCritEligible).toBe(0);
    expect(out.parts.convertedElement.fire).toBe(200);
    const control = sheet([]);
    const ember = sheet([bundle('emberheart', { element: 'fire', conversionPct: 100 })]);
    expect(ember.keystones).toHaveLength(1);
    expect(control.keystones).toHaveLength(0);
  });

  it('06 One Flame shares Fire\'s raw bonus and halves Cold/Lightning\'s own, before any cap', () => {
    const handler = KEYSTONE_HANDLERS['one-flame'] as any;
    const out = handler.sheet({ resistance: 0, resByElement: { fire: 60, cold: 20, lightning: 40 }, resCap: 30 });
    expect(out.resByElement.fire).toBe(60);
    expect(out.resByElement.cold).toBe(40);
    expect(out.resByElement.lightning).toBe(50);
    expect(out.resCap).toBe(30);
  });

  it('13 Unerring Eye lands through an impossible Evasion roll and cannot crit', () => {
    const seq = (values: number[]) => { let i = 0; return () => values[i++] ?? 0.99; };
    const base = { ...sheet([]), accuracy: 1000, critChance: 100 };
    const mob = dumbMob({ evasion: 1e9 });
    // control: the Accuracy/Evasion roll misses
    expect(playerSwing(() => 0.99, { ...base, keystones: [] }, mob, null).landed).toBe(false);
    const r = playerSwing(seq([0.99]), { ...base, keystones: [bundle('unerring-eye', {})] }, mob, null);
    expect(r.landed).toBe(true);
    expect(r.crit).toBe(false);
    // the control build does crit once the hit and dodge rolls pass
    const crit = playerSwing(seq([0.0, 0.99, 0.0]), { ...base, keystones: [] }, mob, null);
    expect(crit.landed).toBe(true);
    expect(crit.crit).toBe(true);
  });

  it('47 Elemental Aegis sends Elemental at 0.7 into ES and lets Physical bypass it', () => {
    const c = { ...sheet([bundle('elemental-aegis', { elementHitTakenMult: 0.7 })]), armour: 0, resistance: 0, resByElement: {}, block: 0, es: 500, damageTaken: 1 };
    const r = mobSwing(noHit, c, dumbMob(), {}, undefined, 500);
    expect(r.toEs).toBeCloseTo(70, 6);
    expect(r.toHp).toBeCloseTo(100, 6);
    const control = mobSwing(noHit, { ...c, keystones: [] }, dumbMob(), {}, undefined, 500);
    expect(control.toEs).toBeCloseTo(200, 6);
    expect(control.toHp).toBeCloseTo(0, 6);
  });

  it('51 Enduring Core removes ES and cuts only the HP part below the threshold', () => {
    const c = { ...sheet([bundle('enduring-core', { hpThresholdPct: 30, belowTakenMult: 0.5 })]), armour: 0, resistance: 0, resByElement: {}, es: 0, maxHp: 1000 };
    expect(c.es).toBe(0);
    const mob = dumbMob({ ps: 200, damage: 'physical' });
    const hit = mobSwing(noHit, c, mob, {}, undefined, 0, 0, false, 400);
    expect(hit.toEs).toBe(0);
    expect(hit.toHp).toBeCloseTo(150, 6);
  });

  it('55 Chaos Inoculation pins Max HP at 1, negates Chaos and forbids HP payment', () => {
    const c = { ...sheet([bundle('chaos-inoculation', { maxHp: 1 })]), armour: 0, resistance: 0, resByElement: {} };
    expect(c.maxHp).toBe(1);
    const chaos = mobSwing(noHit, c, dumbMob({ innate: ['chaos'] }), {}, undefined, c.es, 0, false, 1);
    const plain = mobSwing(noHit, c, dumbMob({ innate: ['fire'] }), {}, undefined, c.es, 0, false, 1);
    expect(chaos.toHp + chaos.toEs).toBeCloseTo(100, 6);
    expect(plain.toHp + plain.toEs).toBeCloseTo(200, 6);
    const handler = KEYSTONE_HANDLERS['chaos-inoculation'] as any;
    expect(handler.cost({ resource: 'hp' }).ok).toBe(false);
    expect(handler.reservation('hp')).toBe(false);
    expect(handler.reservation('mana')).toBe(true);
  });

  it('registers the whole table and refuses a handler missing a required hook', () => {
    expect(supportedKeystoneKeys(KEYSTONE_HANDLERS)).toHaveLength(105);
    for (const key of ['ironwall', 'emberheart', 'one-flame', 'unerring-eye', 'elemental-aegis', 'enduring-core', 'chaos-inoculation']) {
      expect(supportedKeystoneKeys(KEYSTONE_HANDLERS)).toContain(key);
    }
    const table: Record<string, any> = {};
    expect(() => registerStaticKeystoneHandlers(table, Object.keys(E.elements.status_of))).not.toThrow();
    // a handler set missing one required hook is refused by key and hook
    expect(() => registerKeystoneHandler(table, 'elemental-aegis', {}, { elementHitTakenMult: 0.7 }))
      .toThrow(/elemental-aegis/);
    expect(eng).toBeDefined();
  });
});
