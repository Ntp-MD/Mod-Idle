import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { eng, E, sm } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { newGame, tick } from '../src/sim/game';
import {
  newSkillState, grantSkill, castOnce, skillCd, skillLevel, ladderOf, reservedPct, usableMana,
  effectsActive, tickSkills, ACTIVE_SLOTS,
} from '../src/sim/skills';
import { mulberry32 } from '../src/engine/client-helpers';

const require = createRequire(import.meta.url);
const cageModel = require('../../tools/lib/skillmodel.ts');

const REF = { ...cageModel.referenceBases().glass, level: 20 };
const RAMP = sm.damagePct(REF.level) / 100;   // read off the level table, never a second copy of the ramp

describe('the client skill calculator is the cage skill calculator', () => {
  it('per-press and effective cooldown match tools/skills.ts --calc', () => {
    const cleave = sm.byId['attack.cleave'] as any;
    // press = the row's own flat plus its effectiveness on the reference build's finished hit, whose
    // physical line the engine cage already publishes (checks.md B1) — so this pins the number, not just the shape
    expect(sm.perPress(cleave, REF)).toBeCloseTo((cleave.base_flat + (cleave.eff / 100) * eng.DERIVED.phys) * RAMP, 2);
    // a magic-basis row folds Element into the basis instead of the physical line 
    const bolt = sm.byId['attack.chaos_bolt'] as any;
    const magicBasis = REF.magic + REF.elem * (REF.align / 100);
    expect(sm.perPress(bolt, REF)).toBeCloseTo((bolt.base_flat + (bolt.eff / 100) * magicBasis) * RAMP, 2);
    expect(sm.critsOnBasis(cleave)).toBe(true);
    expect(sm.critsOnBasis(bolt)).toBe(false);
    expect(sm.effCd(cleave.cd, 50, 30)).toBeCloseTo(2.1, 6);
    expect(cageModel.perPress(cleave, REF)).toBe(sm.perPress(cleave, REF));
    expect(cageModel.effCd(cleave.cd, 50, 30)).toBe(sm.effCd(cleave.cd, 50, 30));
  });

  it('the ladder tops out at −30% for 12 duplicates', () => {
    expect(ladderOf({ ...newSkillState(), owned: { 'attack.cleave': 12 } } as any, 'attack.cleave')).toBe(30);
    expect(sm.ladderCostToStep(6)).toBe(12);
    expect(cageModel.LADDER).toEqual(sm.LADDER);
  });

  it('skill level is earned per kill and caps at 20', () => {
    expect(skillLevel({ xp: { a: 0 } } as any, 'a')).toBe(1);
    expect(skillLevel({ xp: { a: 400 } } as any, 'a')).toBe(2);
    expect(skillLevel({ xp: { a: 8000 } } as any, 'a')).toBe(E.skill_xp.level_cap);
    expect(skillLevel({ xp: { a: 999999 } } as any, 'a')).toBe(E.skill_xp.level_cap);
  });
});

describe('the casting rule from skill-pool.md', () => {
  const c = buildCharacter(100, emptyGear());

  it('presses the first slot that is ready and affordable', () => {
    const s = newSkillState();
    s.owned['attack.cleave'] = 0;
    s.list[0] = 'attack.cleave';
    const mob = { hp: 1e9, evasion: 0, dodgeRate: 0 } as any;
    const rng = mulberry32(7);
    const cast = castOnce(s, c, c.maxMana, [mob], {}, rng);
    expect(cast?.name).toBe('Cleave');
    expect(mob.hp).toBeLessThan(1e9);
    expect(s.cd['attack.cleave']).toBeGreaterThan(0);
    // the same skill cannot fire twice while its own cooldown runs
    expect(castOnce(s, c, c.maxMana, [mob], {}, rng)).toBe(null);
  });

  it('a cast goes through the same hit and dodge chain as a swing', () => {
    const evasive = { hp: 1e9, hpMax: 1e9, evasion: 1e9, dodgeRate: 0 } as any;
    const s = newSkillState();
    s.list[0] = 'attack.cleave';
    const miss = castOnce(s, c, c.maxMana, [evasive], {}, mulberry32(3));
    expect(miss?.targets).toBe(0);
    expect(evasive.hp).toBe(1e9); // the press happened and nothing landed
    expect(s.cd['attack.cleave']).toBeGreaterThan(0); // and the cooldown is still spent
    const dodgey = { hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 1e9 } as any;
    const s2 = newSkillState();
    s2.list[0] = 'attack.cleave';
    const dodged = castOnce(s2, c, c.maxMana, [dodgey], {}, mulberry32(3));
    expect(dodged?.targets).toBe(0);
    expect(dodgey.hp).toBe(1e9);
  });

  it('a matching weapon group pays the +25% and a mismatch does not', () => {
    const melee = sm.byId['attack.cleave'];
    expect(sm.groupBonus(melee, 'one-handed sword / axe')).toBe(1.25);
    expect(sm.groupBonus(melee, 'staff / spear')).toBe(1);
  });

  it('an aura reserves its tier share and the pool never fully locks', () => {
    const s = newSkillState();
    s.owned['aura.clarity'] = 0;
    s.auras['aura.clarity'] = true;
    expect(reservedPct(s)).toBe(E ? sm.reservePct('cheap') : 0);
    expect(usableMana(c, s)).toBeCloseTo(c.maxMana * (1 - sm.reservePct('cheap') / 100), 6);
  });
});

describe('the two mana cost forms ', () => {
  const flat = { id: 'test.flat', type: 'attack', mana: '14 flat', cd: 6 } as any;
  const cap = E.skill_xp.level_cap;
  const c = buildCharacter(100, emptyGear());

  it('a flat row is never free, and a missing unit is loud', () => {
    expect(sm.manaSpec(flat)).toEqual({ kind: 'flat', value: 14 });
    expect(sm.manaSpec({ id: 'test.bare', mana: '14' } as any)).toBe(null);
    expect(sm.manaCostOf(flat, { maxMana: sm.MANA_REF_POOL, usableMana: sm.MANA_REF_POOL })).toBeGreaterThan(0);
    expect(() => sm.manaCostOf({ id: 'test.bare', mana: '14' } as any, { maxMana: 148, usableMana: 148 })).toThrow();
    expect(() => sm.manaCostOf({ id: 'test.none', type: 'attack' } as any, { maxMana: 148, usableMana: 148 })).toThrow();
  });

  it('the level ramp and the pool term compose', () => {
    const at = (level: number, pool: number) =>
      sm.manaCostOf(flat, { skillLevel: level, maxMana: pool, usableMana: pool });
    const levelFactor = 1 + ((cap - 1) * sm.MANA_LEVEL_STEP) / 100;
    const poolFactor = Math.pow(c.maxMana / sm.MANA_REF_POOL, sm.MANA_POOL_EXPONENT);
    expect(at(1, sm.MANA_REF_POOL)).toBeCloseTo(14, 9);
    expect(at(cap, c.maxMana) / at(1, sm.MANA_REF_POOL)).toBeCloseTo(levelFactor * poolFactor, 6);
    // the two terms are independent: the level term moves with no pool change, and the reverse
    expect(at(cap, sm.MANA_REF_POOL) / at(1, sm.MANA_REF_POOL)).toBeCloseTo(levelFactor, 9);
    expect(at(1, c.maxMana) / at(1, sm.MANA_REF_POOL)).toBeCloseTo(poolFactor, 9);
    expect(cageModel.MANA_REF_POOL).toBe(sm.MANA_REF_POOL);
    expect(cageModel.MANA_LEVEL_STEP).toBe(sm.MANA_LEVEL_STEP);
  });

  it('every % row still charges the usable pool it always did', () => {
    for (const skill of sm.all().filter((k: any) => (sm.manaSpec(k) || { kind: '' }).kind === 'pct')) {
      const spec = sm.manaSpec(skill)!;
      const usable = c.maxMana * (1 - sm.reservePct('mid') / 100);
      expect(sm.manaCostOf(skill, { maxMana: c.maxMana, usableMana: usable })).toBeCloseTo(usable * spec.value / 100, 9);
      expect(sm.manaCostOf(skill, { maxMana: c.maxMana, usableMana: usable, aoe: true }))
        .toBeCloseTo(usable * spec.value / 100 * E.aoe.mana_mult, 9);
    }
  });

  it('an aura reserves the bar but never discounts the price', () => {
    const s = newSkillState();
    const before = sm.manaCostOf(flat, { skillLevel: 1, maxMana: c.maxMana, usableMana: usableMana(c, s) });
    s.owned['aura.clarity'] = 0;
    s.auras['aura.clarity'] = true;
    const after = sm.manaCostOf(flat, { skillLevel: 1, maxMana: c.maxMana, usableMana: usableMana(c, s) });
    expect(after).toBe(before);
    expect(usableMana(c, s)).toBeLessThan(c.maxMana);
  });
});

describe('a press can open its own timed window (Reap)', () => {
  const c = buildCharacter(100, emptyGear());

  it('the window folds the row onto the sheet and lapses on its own duration', () => {
    const s = newSkillState();
    s.owned['attack.reap'] = 0;
    s.list[0] = 'attack.reap';
    const mob = { hp: 1e9, evasion: 0, dodgeRate: 0 } as any;
    const rng = mulberry32(5);
    const before = effectsActive(s);
    expect(before.add.leech || 0).toBe(0);
    castOnce(s, c, c.maxMana, [mob], {}, rng);
    const dur = Number(String(sm.byId['attack.reap'].duration).match(/\d+/)?.[0] || 0);
    expect(s.buffUp['attack.reap']).toBe(dur);
    const during = effectsActive(s);
    expect(during.add.leech).toBe(25);
    expect(during.mult.physical_power).toBeCloseTo(1.1, 9);
    for (let i = 0; i < dur; i++) tickSkills(s, 1);
    expect(s.buffUp['attack.reap']).toBe(0);
    expect(effectsActive(s).add.leech || 0).toBe(0);
  });

  it('a row without the rule word opens no window', () => {
    const s = newSkillState();
    s.owned['attack.cleave'] = 0;
    s.list[0] = 'attack.cleave';
    castOnce(s, c, c.maxMana, [{ hp: 1e9, evasion: 0, dodgeRate: 0 } as any], {}, mulberry32(5));
    expect(s.buffUp['attack.cleave']).toBeUndefined();
  });
});

describe('skills in the live loop', () => {
  it('the bar holds 15 slots and a fresh skill auto-slots', () => {
    const s = newSkillState();
    expect(s.list.length).toBe(ACTIVE_SLOTS);
    const rng = mulberry32(11);
    const g = grantSkill(s, rng);
    expect(g).toBeTruthy();
    expect(s.owned[g!.id]).toBe(0);
    if (['attack', 'curse', 'heal'].includes(sm.byId[g!.id].type)) expect(s.list[0]).toBe(g!.id);
  });

  it('kills pay skill XP and a boss can hand out the first skill', () => {
    const game = newGame(999);
    game.skills.owned['attack.cleave'] = 0;
    game.skills.list[0] = 'attack.cleave';
    for (let i = 0; i < 20000 && !game.skills.xp['attack.cleave']; i++) tick(game, {});
    expect(game.skills.xp['attack.cleave']).toBeGreaterThan(0);
    expect(game.counters.kills).toBeGreaterThan(0);
  });

  it('a long enough run drops at least one skill through the real rate', () => {
    const game = newGame(20260103);
    // the rate is per kill (0.1% normal, 8% elite, 35% boss), so a fixed window is a coin flip on the
    // kill rate rather than a premise. Tick until a piece lands; the bound is a hang guard.
    // tick to the state BOTH assertions read: a piece owned AND a bar slot filled (the loop slots a
    // freshly owned skill on its next pass, so stopping at the drop alone reads an empty bar)
    const slotted = () => Object.keys(game.skills.owned).length > 0 && game.skills.list.filter(Boolean).length > 0;
    for (let i = 0; i < 200000 && !slotted(); i++) tick(game, {});
    // the log is a 60-line window, so the proof is the ledger, not the last page of text
    expect(Object.keys(game.skills.owned).length).toBeGreaterThan(0);
    expect(game.skills.list.filter(Boolean).length).toBeGreaterThan(0);
  }, 30000);
});
