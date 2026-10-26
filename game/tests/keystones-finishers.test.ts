import { describe, expect, it } from 'vitest';
import { E } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/core/player';
import { playerSwing } from '../src/sim/combat/combat';
import { KEYSTONE_HANDLERS, registerStaticKeystoneHandlers, supportedKeystoneKeys } from '../src/sim/core/keystone-runtime';
import {
  ambushCritChance, demolitionBlast, headsmanExecutes, inevitableElementMult,
  painforgedBank, thornboundRetaliation, type KeystoneBundle,
} from '../../engine/keystones.ts';
import type { Mob } from '../src/sim/core/types';

registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys(E.elements.status_of));
const h = (key: string) => KEYSTONE_HANDLERS[key] as any;
const bundle = (key: string, params: Record<string, number | string>): KeystoneBundle => ({ key, params });
const sheet = (bundles: KeystoneBundle[] = []) =>
  buildCharacter(1, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, undefined, {}, bundles);
function mob(over: Partial<Mob> = {}): Mob {
  return {
    id: 'm1', species: 'Dummy', kind: 'normal', zone: 1, level: 1, hp: 1000, hpMax: 1000,
    ps: 0, acc: 0, evasion: 0, dodgeRate: 0, armour: 0, res: 0, damage: 'physical',
    innate: [], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
  } as Mob;
}
const seq = (v: number[]) => { let i = 0; return () => v[i++] ?? 0.99; };

describe('Packet I — crit, finishers, secondary damage', () => {
  it('08 Headsman executes Normals at 15% and Boss/Unique at 5%', () => {
    expect(headsmanExecutes(150, 1000, false, { normalThresholdPct: 15, bossUniqueThresholdPct: 5 })).toBe(true);
    expect(headsmanExecutes(150, 1000, true, { normalThresholdPct: 15, bossUniqueThresholdPct: 5 })).toBe(false);
    expect(headsmanExecutes(50, 1000, true, { normalThresholdPct: 15, bossUniqueThresholdPct: 5 })).toBe(true);
  });

  it('08 executes a surviving target through the swing path', () => {
    const c = { ...sheet([bundle('headsman', { normalThresholdPct: 15, bossUniqueThresholdPct: 5 })]), phys: 1000, critChance: 0 };
    const target = mob({ hp: 1000, hpMax: 1000, armour: 0 });
    const hit = playerSwing(() => 0.99, c, target, null, undefined, 0);
    expect(hit.landed).toBe(true);
    expect(target.hp).toBeLessThanOrEqual(0);
    const boss = mob({ hp: 1000, hpMax: 1000, kind: 'Boss · Dummy' });
    playerSwing(() => 0.99, { ...c, phys: 100 }, boss, null, undefined, 0);
    expect(boss.hp).toBeGreaterThan(0);
  });

  it('19 Ambush forces a crit on a full target and halves the chance afterwards', () => {
    expect(ambushCritChance(true, 20, { otherCritMult: 0.5 })).toBe(100);
    expect(ambushCritChance(false, 20, { otherCritMult: 0.5 })).toBe(10);
    const c = { ...sheet([bundle('ambush', { otherCritMult: 0.5 })]), phys: 100, critChance: 20, critDmg: 200 };
    const full = mob({ hp: 1000, hpMax: 1000 });
    // the first rng is the hit roll, the second the dodge, the third the crit roll
    expect(playerSwing(seq([0, 0, 0.99]), c, full, null, undefined, 0).crit).toBe(true);
    const hurt = mob({ hp: 500, hpMax: 1000 });
    expect(playerSwing(seq([0, 0, 0.15]), c, hurt, null, undefined, 0).crit).toBe(false);
    expect(playerSwing(seq([0, 0, 0.05]), c, hurt, null, undefined, 0).crit).toBe(true);
  });

  it('10 Painforged banks the blocked cut up to 20% of Max HP', () => {
    expect(painforgedBank(0, 30, 1000, { bankCapHpPct: 20, nextHitBonusPct: 100 })).toBe(30);
    expect(painforgedBank(190, 30, 1000, { bankCapHpPct: 20, nextHitBonusPct: 100 })).toBe(200);
  });

  it('22 and 27 publish their blast sizes; 31 and 53 keep their multipliers', () => {
    expect(demolitionBlast(500, { damagePct: 20, hits: 5 })).toBe(100);
    expect(h('profane-bloom').kill({ maxHp: 1000, cursed: true })).toBe(150);
    expect(h('profane-bloom').kill({ maxHp: 1000, cursed: false })).toBe(0);
    expect(inevitableElementMult(true, { nonCritElemMult: 0.8 })).toBe(1);
    expect(inevitableElementMult(false, { nonCritElemMult: 0.8 })).toBeCloseTo(0.8, 9);
    expect(thornboundRetaliation(1000, { armourDamagePct: 20 })).toBe(200);
  });

  it('53 Thornbound halves the owner\'s own direct damage', () => {
    const plain = { ...sheet([]), phys: 100, critChance: 0 };
    const thorn = { ...sheet([bundle('thornbound', { armourDamagePct: 20, icdSec: 0.5, ownDirectDamageMult: 0.5 })]), phys: 100, critChance: 0 };
    const a = playerSwing(() => 0.99, plain, mob({ ps: 0 }), null, undefined, 0).damage;
    const b = playerSwing(() => 0.99, thorn, mob({ ps: 0 }), null, undefined, 0).damage;
    expect(b).toBeCloseTo(a * 0.5, 6);
  });

  it('registers the thirty-three Packet E–I keys', () => {
    expect(supportedKeystoneKeys(KEYSTONE_HANDLERS)).toHaveLength(105);
  });
});
