import { describe, it, expect } from 'vitest';
import { E, eng, sm } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { playerSwing } from '../src/sim/combat';
import { newMobStatusStore, stepMob, applyBleed, modsOn, targetMods } from '../src/sim/mobStatus';
import { NO_CURSE, applyCurse, newCurses, modsFromAuraFold, modsOn as curseModsOn } from '../src/sim/curse';
import { castOnce, newSkillState, effectsActive } from '../src/sim/skills';
import type { Item, Mob } from '../src/sim/types';

const valueOf = (id: string, stat: string) => sm.byId[id].effects.find((e: any) => e.stat === stat).value;

/** HP one cast takes off one mob, so a press can be read off the target rather than recomputed. */
function castPress(id: string, c: ReturnType<typeof buildCharacter>, target: Mob): number {
  const s = newSkillState();
  s.list[0] = id;
  s.xp[id] = 8000;
  const before = target.hp;
  const cast = castOnce(s, c, c.maxMana, [target], {}, mulberry32(7));
  expect(cast).not.toBeNull();
  return before - target.hp;
}

/**
 * B8 · the mob's own defences.
 *
 * `mob-roster.md` prints an Armour line from each species' Str and an Elemental resistance from its
 * Vit, and combat.md §2 did not use either — so those two lines were decorative and Chill's armour cut
 * had nothing to cut. This file is the proof that they now bite, and the proof that a DoT still walks
 * past them (status.mob_side: DoT lands in full · formula-offense.md §4: armour does not reduce bleed).
 */

const mob = (over: Partial<Mob> = {}): Mob => ({
  id: 'm1', species: 'Rat', kind: 'Small', zone: 1, level: 90,
  hp: 1e9, hpMax: 1e9, ps: 200, acc: 400, evasion: 0, dodgeRate: 0, armour: 0, res: 0,
  damage: 'mixed', innate: ['fire'], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0,
  ...over,
} as Mob);

const C = () => buildCharacter(90, emptyGear());

/** The same swing against two mobs that differ only in one defence line. */
function swingAgainst(c: ReturnType<typeof buildCharacter>, over: Partial<Mob>) {
  const target = mob(over);
  let seed = 1;
  while (playerSwing(mulberry32(seed), c, target, null, NO_CURSE).damage === 0) seed++;
  return playerSwing(mulberry32(seed), c, target, null, NO_CURSE).damage;
}

describe('a mob answers the half of the hit its line is written against', () => {
  it('Armour cuts the non-Element part, and the cut softens as the hit grows', () => {
    const c = C();
    const bare = swingAgainst(c, { armour: 0 });
    const armoured = swingAgainst(c, { armour: 2000 });
    expect(armoured).toBeLessThan(bare);
    const expectedCut = eng.armourReduce(2000, c.phys + c.magic);
    expect(bare - armoured).toBeCloseTo((c.phys + c.magic) * expectedCut, 6);
    // PoE shape: the same armour removes a smaller share of a bigger hit, so a slow heavy build is
    // less slowed by an armoured mob than a fast light one (the B3 fast-hit fork, read from the tool)
    const share = (raw: number) => eng.armourReduce(2000, raw);
    expect(share((c.phys + c.magic) * 4)).toBeLessThan(share(c.phys + c.magic));
  });

  it('Elemental resistance cuts the Element half only', () => {
    const gear = emptyGear();
    gear[10] = {
      slot: 'main hand', base: 'one-handed sword', rarity: 'Rare', quality: 'high', tier: 'T1',
      weaponAspd: 1.2, q: 2, lines: [{ id: 'elemental_power_flat', value: 4000, slice: 0, element: 'fire' }],
    } as unknown as Item;
    const c = { ...buildCharacter(90, gear), alignment: 100 } as ReturnType<typeof buildCharacter>;
    const elemPart = c.elem * (c.alignment / 100) * E.elements.weak_mult * (E.elements.counter as any).fire.fire;
    const bare = swingAgainst(c, { res: 0 });
    const resisted = swingAgainst(c, { res: 40 });
    expect(bare - resisted).toBeCloseTo(elemPart * eng.mobResCut(40), 6);
    // the physical half is untouched by resistance
    const physOnly = { ...c, elemByElement: {}, elem: 0 } as ReturnType<typeof buildCharacter>;
    expect(swingAgainst(physOnly, { res: 40 })).toBeCloseTo(swingAgainst(physOnly, { res: 0 }), 6);
  });

  it('resistance is held by the same Cap ours is', () => {
    const cap = (E.caps as any).elem_res;
    expect(eng.mobResCut(cap + 40)).toBeCloseTo(cap / 100, 10);
  });

  it('Chill finally has something to cut', () => {
    const c = C();
    const store = newMobStatusStore();
    store.m1 = {
      statuses: { chill: { stacks: 2, secLeft: 3, perSec: 0 } },
      alignedPerSec: 0, stoppedSec: 0, elapsedSec: 0,
    };
    const cut = targetMods(modsOn(store, 'm1')).armourCut || 0;
    expect(cut).toBe(E.status.chill.armour_cut);
    const armoured = mob({ armour: 4000 });
    const before = playerSwing(mulberry32(2), c, armoured, null, NO_CURSE).damage;
    const after = playerSwing(mulberry32(2), c, armoured, null, { ...NO_CURSE, armourCut: cut }).damage;
    expect(after).toBeGreaterThan(before);
  });

  it('a DoT walks past both lines', () => {
    const store = newMobStatusStore();
    store.m1 = {
      statuses: { bleed: { stacks: 1, secLeft: 5, perSec: 100 } },
      alignedPerSec: 0, stoppedSec: 0, elapsedSec: 0,
    };
    expect(stepMob(store, 'm1')).toBe(100);
    const armoured = mob({ armour: 9000, res: 60 });
    const got = applyBleed(() => 0, store, armoured.id, 1000, 1);
    expect(got).toBe(true);
    expect(stepMob(store, armoured.id)).toBeCloseTo((1000 * (E.K as any).K_BLEED) / (E.K as any).bleed_time_sec, 6);
  });
});

describe('a strip of the mob\'s resistance is spent on the Element half', () => {
  const fireCaster = () => {
    const gear = emptyGear();
    gear[10] = {
      slot: 'main hand', base: 'one-handed sword', rarity: 'Rare', quality: 'high', tier: 'T1',
      weaponAspd: 1.2, q: 2, lines: [{ id: 'elemental_power_flat', value: 4000, slice: 0, element: 'fire' }],
    } as unknown as Item;
    return { ...buildCharacter(90, gear), alignment: 100 } as ReturnType<typeof buildCharacter>;
  };

  it('Sunder opens the Element half by the points its row states', () => {
    const c = fireCaster();
    const store = newCurses();
    applyCurse(store, 'm1', sm.byId['curse.sunder']);
    const cut = curseModsOn(store, 'm1', () => false).resistCut;
    expect(cut).toBe(valueOf('curse.sunder', 'mob_elemental_resistance_pct'));
    const resisted = mob({ res: 40, armour: 0 });
    const before = playerSwing(mulberry32(2), c, resisted, null, NO_CURSE).damage;
    const after = playerSwing(mulberry32(2), c, { ...resisted }, null, { ...NO_CURSE, resistCut: cut }).damage;
    expect(after).toBeGreaterThan(before);
    // the strip is worth the Element part × the percentage points it removed, and nothing else
    const elemPart = c.elem * (c.alignment / 100) * E.elements.weak_mult * (E.elements.counter as any).fire.fire;
    expect(after - before).toBeCloseTo(elemPart * (Math.abs(cut) / 100), 6);
  });

  it('resistance bottoms out at zero rather than amplifying the hit', () => {
    const c = fireCaster();
    const thin = mob({ res: 9.5 });
    const clean = playerSwing(mulberry32(2), c, thin, null, NO_CURSE).damage;
    const stripped = playerSwing(mulberry32(2), c, { ...thin }, null, { ...NO_CURSE, resistCut: -20 }).damage;
    const opened = playerSwing(mulberry32(2), c, mob({ res: 0 }), null, NO_CURSE).damage;
    expect(stripped).toBeGreaterThan(clean);
    expect(stripped).toBeCloseTo(opened, 6);
  });

  it('Nether Orb walks through resistance on its own press', () => {
    const c = fireCaster();
    const resisted = mob({ res: 60 });
    const orbDamage = castPress('attack.nether_orb', c, resisted);
    const boltDamage = castPress('attack.chaos_bolt', c, mob({ id: 'm2', res: 60 }));
    // the two rows press the same 103.191% of the same basis; only the orb ignores the 60
    const scaled = boltDamage * (valueOf('attack.nether_orb', 'resistance_pierce_pct') > 0
      ? sm.byId['attack.nether_orb'].final_pct / sm.byId['attack.chaos_bolt'].final_pct : 1);
    expect(orbDamage).toBeGreaterThan(scaled);
  });

  it('an aura writes its strip on every mob, and stops when it is taken off', () => {
    const sk = newSkillState();
    sk.auras['aura.elemental_fury'] = true;
    expect(modsFromAuraFold(effectsActive(sk).target || {}).resistCut)
      .toBe(valueOf('aura.elemental_fury', 'mob_elemental_resistance_pct'));
    sk.auras['aura.elemental_fury'] = false;
    expect(modsFromAuraFold(effectsActive(sk).target || {}).resistCut).toBe(0);
    // and a target-side line never leaks into our own sheet — Rimbo Form slows the mob, not us
    const sk2 = newSkillState();
    sk2.auras['aura.elemental_fury'] = true;
    sk2.auras['aura.rimbo_form'] = true;
    const bare = buildCharacter(40, emptyGear());
    const withAuras = buildCharacter(40, emptyGear(), {}, 0, effectsActive(sk2));
    expect(withAuras.resistance).toBe(bare.resistance);
    expect(withAuras.aspd).toBeCloseTo(bare.aspd, 10);
    expect(modsFromAuraFold(effectsActive(sk2).target || {}).attackSpeed).toBe(-15);
  });
});
