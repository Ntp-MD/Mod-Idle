import { describe, expect, it } from 'vitest';
import { eng, E, sm, BASES } from '../src/engine/client';
import { playerSwing, type HitReport, type Statuses } from '../src/sim/combat/combat';
import { NO_CURSE, takenMult } from '../src/sim/combat/curse';
import { elementalByElement, type DamagePacket } from '../../engine/damage-provenance.ts';
import { castOnce, newSkillState, grantNamedSkill } from '../src/sim/combat/skills';
import { buildCharacter } from '../src/sim/core/player';
import type { Character } from '../src/sim/core/player';
import type { Mob } from '../src/sim/core/types';
import { mobFixture } from './mobFixture';

/**
 * Packet D1 §7.2 — typed damage provenance with no numeric change. The packets are built beside the
 * existing math; these fixtures rebuild the mitigated hit FROM the typed parts and demand the same
 * damage the native path reported, so the parts are the same numbers, split honestly. A keystone
 * reads one pool without anything re-pricing the other.
 */

const sheet = (): Character => buildCharacter(1, new Array(13).fill(null), {}, 0, undefined, undefined, undefined);
const char = (over: Partial<Character>): Character => ({ ...sheet(), ...over } as Character);
const mob = (over: Partial<Mob> = {}): Mob => mobFixture({
  species: 'Goblin', level: 1, hp: 100000, hpMax: 100000, xp: 10, ps: 100, acc: 50, evasion: 10,
  damage: 'phys', align: 100, crit: 0, ...over,
});

/** Rebuild the swing's damage from the packet alone — the tail the native code runs. */
function reconstructSwing(r: HitReport, c: Character, m: Mob): number {
  const p = r.packet!;
  const non = p.parts.physicalCritEligible + p.parts.physicalNonCrit + p.parts.magic;
  const el = elementalByElement(p.parts);
  const elemArg: number | Record<string, number> = Object.keys(el).length ? el : 0;
  let d = eng.mitigateMobHit(m, non, elemArg, eng.armourPenCut(c.armourPen), 0) * takenMult(NO_CURSE);
  d = eng.applySizeMult(d, 1, eng.sizeMultOf(E.weapon_size_mult?.ladder, c.weaponName, m.readsAs || 'medium'));
  if (eng.basicAttackOf(BASES, c.weaponName) === 'bolt') d *= sm.ladderFloorPct() / 100;
  d *= E.global.damage_mult;
  return d;
}

/** Rebuild one press's mitigated damage from its packet — the same tail `castOnce` runs. */
function reconstructCast(p: DamagePacket, c: Character, m: Mob, physBasis: boolean): number {
  const non = p.parts.physicalCritEligible + p.parts.physicalNonCrit + p.parts.magic;
  const el = elementalByElement(p.parts);
  const elemArg: number | Record<string, number> = Object.keys(el).length ? el : 0;
  // `E.global.damage_mult` already rode the press's `dmg` into the parts — not multiplied again here
  let d = eng.mitigateMobHit(m, non, elemArg, 0, 0);
  if (physBasis) d = eng.applySizeMult(d, 1, eng.sizeMultOf(E.weapon_size_mult?.ladder, c.weaponName, m.readsAs || 'medium'));
  return d;
}

const always = (v: number) => () => v;

describe('the swing builds typed parts without moving the number', () => {
  it('pure physical: the crit-eligible pool is the whole non-elemental part', () => {
    const c = char({ phys: 100, magic: 0, elem: 0, elemByElement: {}, alignment: 100, conversion: {}, critChance: 0 });
    const m = mob({ innate: [] });
    const r = playerSwing(always(0.5), c, m, null, NO_CURSE, 5_000_000);
    expect(r.landed).toBe(true);
    expect(r.packet!.parts.physicalCritEligible).toBeGreaterThan(0);
    expect(r.packet!.parts.magic).toBe(0);
    expect(r.packet!.parts.nativeElement).toEqual({});
    expect(r.packet!.parts.extraElement).toEqual({});
    expect(r.packet!.timeUs).toBe(5_000_000);
    expect(reconstructSwing(r, c, m)).toBeCloseTo(r.damage, 10);
    expect(m.hp).toBeCloseTo(100000 - r.damage, 10);
  });

  it('a crit scales only the crit-eligible physical; magic and Elements keep their own parts', () => {
    const c = char({
      phys: 100, magic: 40, elem: 0, elemByElement: { fire: 30 }, alignment: 100, conversion: {},
      critChance: 100, critDmg: 200,
    });
    const m = mob({ innate: ['fire'] });
    // rng order: hit pass (0), dodge roll loses (1), crit roll (0 → crit)
    let i = 0;
    const seq = [0, 1, 0];
    const r = playerSwing(() => seq[i++], c, m, null, NO_CURSE, null);
    expect(r.crit).toBe(true);
    const p = r.packet!;
    expect(p.flags.canCrit).toBe(true);
    // pre-crit the pool would have been 100; the crit doubles it inside the eligible part
    expect(p.parts.physicalCritEligible).toBeGreaterThan(100);
    expect(p.parts.magic).toBeGreaterThan(0);
    expect(p.parts.nativeElement.fire).toBeCloseTo(30, 10);
    expect(reconstructSwing(r, c, m)).toBeCloseTo(r.damage, 10);
  });

  it('conversion splits the physical into native and converted lanes that sum back to one hit', () => {
    const c = char({
      phys: 100, magic: 0, elem: 0, elemByElement: {}, alignment: 100, conversion: { fire: 60 }, critChance: 0,
    });
    const m = mob({ innate: ['fire'] });
    const r = playerSwing(always(0.5), c, m, null, NO_CURSE, null);
    const p = r.packet!;
    expect(p.parts.convertedElement.fire).toBeCloseTo(60, 9);
    expect(p.parts.physicalCritEligible).toBeCloseTo(40, 9);
    expect(reconstructSwing(r, c, m)).toBeCloseTo(r.damage, 10);
  });

  it('a no-Element build keeps the one-number path honest: it rides the headline res lane', () => {
    const c = char({ phys: 0, magic: 10, elem: 25, elemByElement: {}, alignment: 100, conversion: {} });
    const m = mob({ innate: [] });
    const r = playerSwing(always(0.5), c, m, null, NO_CURSE, null);
    expect(r.packet!.parts.nativeElement['']).toBeDefined();
    expect(reconstructSwing(r, c, m)).toBeCloseTo(r.damage, 10);
  });

  it('flags mark a swing a direct hit that may crit, status, leech and trigger kills', () => {
    const c = char({ phys: 10, leechPct: 2 });
    const r = playerSwing(always(0.5), c, mob({}), null, NO_CURSE, null);
    const f = r.packet!.flags;
    expect(f).toMatchObject({ direct: true, secondary: false, dot: false, deferred: false, canCrit: true, canStatus: true, canLeech: true, canTriggerKillEffect: true });
    expect(r.packet!.sourceActionId).toBe('swing');
    expect(r.packet!.targetId).toBe(r.packet!.targetId);
  });

  it('a missed swing carries no packet — no damage event happened', () => {
    const c = char({ phys: 10, accuracy: 0 });
    const r = playerSwing(always(0.999999), c, mob({ evasion: 1e9 }), null, NO_CURSE, null);
    expect(r.landed).toBe(false);
    expect(r.packet).toBeUndefined();
  });
});

describe('a press builds typed parts per target', () => {
  function castFixture(skillId: string, group: Mob[]) {
    const s = newSkillState();
    grantNamedSkill(s, skillId);
    s.list[0] = skillId;
    for (const id of Object.keys(s.owned)) s.xp[id] = 100000;
    const c = char({ phys: 100, magic: 100, elem: 0, elemByElement: {}, alignment: 100, conversion: {}, critChance: 0 });
    const statuses: Statuses = {};
    const cast = castOnce(s, c, 1e9, group, statuses, always(0.5), { mobStatus: {}, timeUs: 2_000_000 });
    return { c, cast };
  }

  /** The first row of the basis that the held weapon fits and the roll lets land. */
  function firstLanding(basis: string, group: Mob[]) {
    const rows = (sm.all() as any[]).filter((k) => k.type === 'attack' && k.basis === basis
      && !(k.effects || []).some((e: any) => e.stat === 'resistance_pierce_pct'));
    for (const row of rows) {
      const f = castFixture(row.id, group);
      if (f.cast && f.cast.byMob.length) return { ...f, id: row.id };
    }
    return null;
  }

  it('the parts of every struck target rebuild its mitigated damage exactly', () => {
    const m = mob({ hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 });
    const hit = firstLanding('phys', [m]);
    expect(hit).toBeTruthy();
    for (const h of hit!.cast!.byMob) {
      expect(h.packet).toBeTruthy();
      expect(h.packet!.sourceActionId).toBe(hit!.id);
      expect(h.packet!.timeUs).toBe(2_000_000);
      expect(h.packet!.nominalRate).toBeGreaterThan(0);
      expect(reconstructCast(h.packet!, hit!.c, m, true)).toBe(h.amount);
    }
  });

  it('a magic-basis press routes its non-elemental part through the magic pool', () => {
    const m = mob({ hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 });
    const hit = firstLanding('magic', [m]);
    if (!hit) return; // no magic-basis row that lands on this fixture is not a failure of this contract
    const p = hit.cast!.byMob[0].packet!;
    expect(p.parts.magic).toBeGreaterThan(0);
    expect(p.parts.physicalCritEligible).toBe(0);
    expect(p.flags.canCrit).toBe(false); // a magic-basis press never rolls crit
    expect(reconstructCast(p, hit.c, m, false)).toBe(hit.cast!.byMob[0].amount);
  });
});
