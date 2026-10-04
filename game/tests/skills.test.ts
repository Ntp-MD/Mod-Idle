import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { eng, E, sm } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { newGame, tick } from '../src/sim/game';
import {
  newSkillState, grantSkill, castOnce, skillCd, skillLevel, ladderOf, reservedPct, usableMana,
  ACTIVE_SLOTS,
} from '../src/sim/skills';
import { mulberry32 } from '../src/engine/client-helpers';

const require = createRequire(import.meta.url);
const cageModel = require('../../tools/lib/skillmodel.js');

const REF = { ...cageModel.referenceBases().glass, level: 20 };
const RAMP = 1 + ((REF.level - 1) * sm.LEVEL_STEP) / 100;

describe('the client skill calculator is the cage skill calculator', () => {
  it('per-press and effective cooldown match tools/skills.js --calc', () => {
    const cleave = sm.byId['attack.cleave'] as any;
    // press = the row's own fraction of the reference build's finished hit, whose physical line the
    // engine cage already publishes (checks.md B1) — so this pins the number, not just the shape
    expect(sm.perPress(cleave, REF)).toBeCloseTo((cleave.final_pct / 100) * eng.DERIVED.phys * RAMP, 2);
    // a magic-basis row folds Element into the basis instead of the physical line (D-070)
    const bolt = sm.byId['attack.arcane_bolt'] as any;
    const magicBasis = REF.magic + REF.elem * (REF.align / 100);
    expect(sm.perPress(bolt, REF)).toBeCloseTo((bolt.final_pct / 100) * magicBasis * RAMP, 2);
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
    for (let i = 0; i < 400; i++) tick(game, {});
    expect(game.skills.xp['attack.cleave']).toBeGreaterThan(0);
    expect(game.counters.kills).toBeGreaterThan(0);
  });

  it('a long enough run drops at least one skill through the real rate', () => {
    const game = newGame(20260103);
    for (let i = 0; i < 6000; i++) tick(game, {});
    // the log is a 60-line window, so the proof is the ledger, not the last page of text
    expect(Object.keys(game.skills.owned).length).toBeGreaterThan(0);
    expect(game.skills.list.filter(Boolean).length).toBeGreaterThan(0);
  });
});
