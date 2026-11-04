import { describe, it, expect } from 'vitest';
import { blackMarket, eng, E, sm, SKILLS, TOWN } from '../../src/engine/client';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { newGame, tick, huntZone } from '@sim/core/game';
import {
  newSkillState, grantSkill, castOnce, skillLevel, ladderOf, reservedPct, usableMana,
  effectsActive, tickSkills, toggleTrack, clearUnownedTracks, ownsSkill, ACTIVE_SLOTS,
  defaultManualSkill, skillEligibility, rotationOrder,
} from '@sim/combat/skills';
import { switchPreset } from '@sim/core/presets';
import { normalizeSkillAction, payHpCost } from '@engine/skills.ts';
import { installSkillFixture, installSyntheticSkill } from '../fixtures/skillFixture';
import { mulberry32 } from '../../src/engine/client-helpers';
import { model as cageModel } from '../../../tools/lib/skillmodel.ts';
import { liveId, hasStat } from '../fixtures/liveSkill';

const MELEE = liveId(row => row.type === 'attack' && row.basis === 'phys' && row.area?.shape === 'cone' && !row.action, 'melee');
const MAGIC = liveId(row => row.type === 'attack' && row.basis === 'magic' && !row.action, 'magic');
const PROJECTILE = liveId(row => row.type === 'attack' && row.cast?.delivery === 'projectile' && !row.action, 'projectile');
const TIMED_ATTACK = liveId(row => row.type === 'attack' && row.rules?.includes('self_window') && hasStat(row, 'physical_power'), 'timed attack');
const MANA_AURA = liveId(row => row.type === 'aura' && hasStat(row, 'mana_regen'), 'mana aura');
const ABSORB = liveId(row => row.type === 'buff' && hasStat(row, 'es_absorb_pct'), 'absorb');
const POWER_BUFF = liveId(row => row.type === 'buff' && hasStat(row, 'physical_power'), 'power buff');

// the same module tools/skills.ts --calc prints from, imported so the suite's transform carries it


const REF = { ...cageModel.referenceBases().glass, level: 20 };
const RAMP = sm.damagePct(REF.level) / 100;   // read off the level table, never a second copy of the ramp

describe('the retired roster', () => {
  it('keeps retired ids resolvable while removing them from the live pool', () => {
    const retired = (SKILLS.skills as any[]).filter((row) => row.retired);
    expect(retired.length).toBeGreaterThan(0);
    const live = new Set(sm.all().map((row: any) => row.id));
    for (const row of retired) {
      expect(sm.byId[row.id]).toBe(row);
      expect(row.retired_to).toBeTruthy();
      expect(sm.byId[row.retired_to]).toBeTruthy();
      expect(sm.byId[row.retired_to].retired).not.toBe(true);
      expect(live.has(row.id)).toBe(false);
    }
  });

  it('keeps an owned retired row castable, reorderable and preset-loadable with its progress', () => {
    const replacement = sm.all().find((row: any) => row.type === 'attack')!.id;
    const installed = installSyntheticSkill('test.legacy-play', {
      name: 'Legacy Play', retired: true, retired_to: replacement,
    });
    const id = installed.row.id;
    try {
      const s = newSkillState();
      s.owned[id] = 2;
      s.xp[id] = sm.skillXpForLevel(5);
      s.list[0] = id;
      const c = { ...buildCharacter(30, emptyGear()), weaponName: 'one-handed axe' };
      const mob = { id: 'legacy-target', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 } as any;
      expect(rotationOrder(s)).toContain(id);
      expect(skillEligibility(s, c, id, c.maxMana, [mob], {}).ready).toBe(true);
      expect(castOnce(s, c, c.maxMana, [mob], {}, mulberry32(7))?.id).toBe(id);
      expect(s.owned[id]).toBe(2);
      expect(s.xp[id]).toBe(sm.skillXpForLevel(5));
      const game = newGame(55);
      game.skills = s;
      s.list[0] = null;
      game.presets[1].list.fill(null);
      game.presets[1].list[0] = id;
      expect(switchPreset(game, 1)).toBe(true);
      expect(game.skills.list[0]).toBe(id);
    } finally {
      installed.restore();
    }
  });

  it('keeps retired rows out of every acquisition pool and every active reference', () => {
    const active = new Set(sm.all().map((row: any) => row.id));
    for (const row of SKILLS.skills as any[]) {
      if (!row.retired) {
        expect(row.retired_to, `${row.id} is active and carries no retired_to`).toBeUndefined();
        continue;
      }
      expect(active.has(row.id), `${row.id} is not a new-drop row`).toBe(false);
      expect(active.has(row.retired_to), `${row.id} points at an active replacement`).toBe(true);
    }
    for (const [id] of Object.entries(blackMarket.C.skill_weights))
      expect(active.has(id), `Black Market weight ${id} is active`).toBe(true);
    for (const [id] of Object.entries((TOWN as any).delivery.skill_weights))
      expect(active.has(id), `Delivery weight ${id} is active`).toBe(true);
  });
});

describe('the client skill calculator is the cage skill calculator', () => {
  it('per-press and effective cooldown match tools/skills.ts --calc', () => {
    const cleave = sm.byId[MELEE] as any;
    // press = the row's own flat plus its effectiveness on the reference build's finished hit, whose
    // physical line the engine cage already publishes (B1) — so this pins the number, not just the shape
    expect(sm.perPress(cleave, REF)).toBeCloseTo((cleave.base_flat + (cleave.eff / 100) * eng.DERIVED.phys) * RAMP, 2);
    // a magic-basis row folds Element into the basis instead of the physical line
    const bolt = sm.byId[MAGIC] as any;
    const magicBasis = REF.magic + REF.elem * (REF.align / 100);
    expect(sm.perPress(bolt, REF)).toBeCloseTo((bolt.base_flat + (bolt.eff / 100) * magicBasis) * RAMP, 2);
    expect(sm.critsOnBasis(cleave)).toBe(true);
    expect(sm.critsOnBasis(bolt)).toBe(false);
    const CR = sm.CAST_REF;
    expect(cageModel.perPress(cleave, REF)).toBe(sm.perPress(cleave, REF));
    expect(cageModel.effCd(cleave.cd, CR.cdr_pct, CR.ladder_pct)).toBe(sm.effCd(cleave.cd, CR.cdr_pct, CR.ladder_pct));
  });

  it('adds the caster Max-HP term inside the levelled press formula', () => {
    const hpBasis = { id: 'test.max-hp', basis: 'phys', base_flat: 100, eff: 0, max_hp_pct: 12 } as any;
    const press = sm.perPress(hpBasis, { phys: 0, maxHp: 1000, level: 20, attackPct: 0, spellPct: 0 });
    expect(press).toBeCloseTo((100 + 120) * sm.damagePct(20) / 100, 9);
    expect(cageModel.perPress(hpBasis, { phys: 0, maxHp: 1000, level: 20, attackPct: 0, spellPct: 0 })).toBe(press);
  });

  it('the ladder tops out at its last rung for a full set of duplicates', () => {
    const full = sm.LADDER_MAX_DUPLICATES;
    expect(ladderOf({ ...newSkillState(), owned: { [MELEE]: full } } as any, MELEE))
      .toBe(sm.LADDER[sm.LADDER.length - 1].cdr);
    expect(sm.ladderCostToStep(sm.LADDER.length)).toBe(full);
    expect(cageModel.LADDER).toEqual(sm.LADDER);
  });

  it('skill level is earned per kill and caps at 20', () => {
    const step = E.skill_xp.xp_per_step;
    expect(skillLevel({ xp: { a: 0 } } as any, 'a')).toBe(1);
    expect(skillLevel({ xp: { a: step } } as any, 'a')).toBe(2);
    expect(skillLevel({ xp: { a: step * E.skill_xp.level_cap } } as any, 'a')).toBe(E.skill_xp.level_cap);
    expect(skillLevel({ xp: { a: 999999 } } as any, 'a')).toBe(E.skill_xp.level_cap);
  });
});

describe('the casting rule', () => {
  const c = { ...buildCharacter(100, emptyGear()), weaponName: 'one-handed axe' };

  it('presses the first slot that is ready and affordable', () => {
    const s = newSkillState();
    s.owned[MELEE] = 0;
    s.list[0] = MELEE; s.owned[MELEE] ??= 0;
    const mob = { id: 'test-mob', hp: 1e9, evasion: 0, dodgeRate: 0 } as any;
    const rng = mulberry32(7);
    const cast = castOnce(s, c, c.maxMana, [mob], {}, rng);
    expect(cast?.name).toBe(sm.byId[MELEE].name);
    expect(mob.hp).toBeLessThan(1e9);
    expect(s.cd[MELEE]).toBeGreaterThan(0);
    // the same skill cannot fire twice while its own cooldown runs
    expect(castOnce(s, c, c.maxMana, [mob], {}, rng)).toBe(null);
  });

  it('says which mob lost how much, not only what the press totalled', () => {
    // the screen raises each number over the plate it belongs to, so the report has to name whose HP moved
    const group = ['a', 'b', 'c'].map((id) => ({ id, hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 }) as any);
    const s = newSkillState();
    s.list[0] = MELEE; s.owned[MELEE] ??= 0;                       // an AoE row: it can hurt more than the front body
    s.xp[MELEE] = 8000;
    const cast = castOnce(s, c, c.maxMana, group, {}, mulberry32(11))!;
    expect(cast.targets).toBeGreaterThan(1);
    expect(cast.byMob.length).toBe(cast.targets);
    expect(cast.byMob.every((h) => group.some((m) => m.id === h.id))).toBe(true);
    expect(cast.byMob.every((h) => h.amount > 0)).toBe(true);
    expect(cast.byMob.reduce((n, h) => n + h.amount, 0)).toBeCloseTo(cast.dealt || 0, 6);
    // and the HP it claims is the HP that actually left the mob
    for (const h of cast.byMob) {
      const m = group.find((g) => g.id === h.id)!;
      expect(1e9 - m.hp).toBeCloseTo(h.amount, 6);
    }
  });

  it('a cast goes through the same hit and dodge chain as a swing', () => {
    const evasive = { hp: 1e9, hpMax: 1e9, evasion: 1e9, dodgeRate: 0 } as any;
    const s = newSkillState();
    s.list[0] = MELEE; s.owned[MELEE] ??= 0;
    const miss = castOnce(s, c, c.maxMana, [evasive], {}, mulberry32(3));
    expect(miss?.targets).toBe(0);
    expect(evasive.hp).toBe(1e9); // the press happened and nothing landed
    expect(s.cd[MELEE]).toBeGreaterThan(0); // and the cooldown is still spent
    const dodgey = { hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 1e9 } as any;
    const s2 = newSkillState();
    s2.list[0] = MELEE; s2.owned[MELEE] ??= 0;
    const dodged = castOnce(s2, c, c.maxMana, [dodgey], {}, mulberry32(3));
    expect(dodged?.targets).toBe(0);
    expect(dodgey.hp).toBe(1e9);
  });

  it('a matching weapon group pays the group bonus and a mismatch does not', () => {
    const melee = sm.byId[MELEE];
    expect(sm.groupBonus(melee, 'one-handed sword / axe')).toBe(1 + sm.GROUP_BONUS);
    expect(sm.groupBonus(melee, 'staff / spear')).toBe(1);
  });

  it('an aura reserves its tier share and the pool never fully locks', () => {
    const s = newSkillState();
    s.owned[MANA_AURA] = 0;
    s.auras[MANA_AURA] = true;
    expect(reservedPct(s)).toBe(sm.reservePct('cheap'));
    expect(usableMana(c, s)).toBeCloseTo(c.maxMana * (1 - sm.reservePct('cheap') / 100), 6);
  });
});

describe('one mana price, typed in units ', () => {
  const flat = { id: 'test.flat', type: 'attack', mana: '14 flat', cd: 6 } as any;
  const cap = E.skill_xp.level_cap;
  const c = { ...buildCharacter(100, emptyGear()), weaponName: 'one-handed axe' };
  const mob = (id = 'test-mob') => ({ id, hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 }) as any;

  it('a typed row is never free, and a cost without its unit is loud', () => {
    expect(sm.manaSpec(flat)).toBe(14);
    expect(sm.manaSpec({ id: 'test.bare', mana: '14' } as any)).toBe(null);
    expect(sm.manaCostOf(flat)).toBeGreaterThan(0);
    expect(() => sm.manaCostOf({ id: 'test.bare', mana: '14' } as any)).toThrow();
    expect(() => sm.manaCostOf({ id: 'test.none', type: 'attack' } as any)).toThrow();
  });

  it('a share of the pool is no longer a legal price, and no row still carries one', () => {
    expect(sm.manaSpec({ id: 'test.pct', type: 'attack', mana: '14%' } as any)).toBe(null);
    expect(() => sm.manaCostOf({ id: 'test.pct', type: 'attack', mana: '14%' } as any)).toThrow();
    const left = sm.all().filter((k: any) => /%/.test(String(k.mana || ''))).map((k: any) => k.id);
    expect(left).toEqual([]);
  });

  it('the skill level is the only term that moves a price', () => {
    const levelFactor = 1 + ((cap - 1) * sm.MANA_LEVEL_STEP) / 100;
    expect(sm.manaCostOf(flat, { skillLevel: 1 })).toBeCloseTo(14, 9);
    expect(sm.manaCostOf(flat, { skillLevel: cap })).toBeCloseTo(14 * levelFactor, 9);
    // measured on the roster: a paid row's level-1 price IS its typed number, so no term hides in it
    for (const skill of sm.all().filter((k: any) => sm.manaSpec(k) != null)) {
      expect(sm.manaCostOf(skill, { skillLevel: 1 })).toBeCloseTo(sm.manaSpec(skill) as number, 9);
    }
    expect(cageModel.MANA_REF_POOL).toBe(sm.MANA_REF_POOL);
    expect(cageModel.MANA_LEVEL_STEP).toBe(sm.MANA_LEVEL_STEP);
  });

  it('a press pays the same price on one target or many', () => {
    // a wide row through the real cast: one mob, two mobs and three mobs of group
    const cast = (n: number) => {
      const s = newSkillState();
      s.list[0] = MELEE; s.owned[MELEE] ??= 0;
      const group = Array.from({ length: n }, (_, i) => ({ id: `m${i}`, hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 }) as any);
      return castOnce(s, c, c.maxMana, group, {}, mulberry32(4))!.manaCost;
    };
    expect(cast(2)).toBeCloseTo(cast(1), 9);
    expect(cast(3)).toBeCloseTo(cast(1), 9);
  });

  it('an aura reserves the bar but never discounts the price', () => {
    const s = newSkillState();
    s.list[0] = MELEE; s.owned[MELEE] ??= 0;
    const before = castOnce(s, c, usableMana(c, s), [mob()], {}, mulberry32(6))!.manaCost;
    s.cd = {};
    s.owned[MANA_AURA] = 0;
    s.auras[MANA_AURA] = true;
    const after = castOnce(s, c, usableMana(c, s), [mob()], {}, mulberry32(6))!.manaCost;
    expect(after).toBe(before);
    expect(usableMana(c, s)).toBeLessThan(c.maxMana);
  });

  it('a bigger bar buys casts, never a cheaper press', () => {
    const fresh = { ...buildCharacter(1, emptyGear()), weaponName: 'one-handed axe' };
    const capped = { ...buildCharacter(E.stat.level_cap, emptyGear()), weaponName: 'one-handed axe' };
    const press = (who: any) => {
      const s = newSkillState();
      s.list[0] = MELEE; s.owned[MELEE] ??= 0;
      return castOnce(s, who, who.maxMana, [mob()], {}, mulberry32(6))!.manaCost;
    };
    const units = press(fresh);
    expect(press(capped)).toBe(units);
    expect(Math.floor(capped.maxMana / units)).toBeGreaterThan(Math.floor(fresh.maxMana / units));
  });
});

describe('current HP skill costs', () => {
  const c = buildCharacter(100, emptyGear());

  it('uses a typed flat HP amount on the shared cost ladder, as the sole resource cost', () => {
    const hpSkill = { id: 'test.hp-cost', hp_cost: '20 flat' } as any;
    const factor = 1 + ((E.skill_xp.level_cap - 1) * sm.COST_LEVEL_STEP) / 100;
    expect(sm.hpCostSpec(hpSkill)).toBe(20);
    expect(sm.costOf(hpSkill, { skillLevel: 1 })).toEqual({ resource: 'hp', amount: 20 });
    expect(sm.costOf(hpSkill, { skillLevel: E.skill_xp.level_cap }).amount).toBeCloseTo(20 * factor, 9);
    expect(() => sm.costOf({ ...hpSkill, mana: '10 flat' })).toThrow(/both Mana and HP/);
    expect(() => sm.costOf({ id: 'test.untyped-hp', hp_cost: '20%' })).toThrow();
  });

  it('pays the dev/test fixture HP price and never takes the final point', () => {
    const installed = installSkillFixture('test.hp_cost');
    try {
      const row = installed.row;
      expect(sm.hpCostSpec(row)).toBe(20);
      const mob = { id: 'test-hp-target', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 } as any;
      const skills = newSkillState();
      skills.owned[row.id] = 0;
      skills.list[0] = row.id;
      expect(skillEligibility(skills, c, row.id, c.maxMana, [mob], {}, { currentHp: 20 }).reason).toBe('hp');
      expect(castOnce(skills, c, c.maxMana, [mob], {}, mulberry32(7), { currentHp: 20 })).toBeNull();
      expect(skills.cd[row.id]).toBeUndefined();
      const cast = castOnce(skills, c, c.maxMana, [mob], {}, mulberry32(7), { currentHp: 21 })!;
      expect(cast.hpCost).toBe(20);
      expect(cast.manaCost).toBe(0);
      expect(payHpCost(21, cast.hpCost)).toBe(1);
      // The floor is the second half of the rule even when a caller bypasses eligibility.
      expect(payHpCost(20, cast.hpCost)).toBe(1);
    } finally {
      installed.restore();
    }
  });

  it('skips the press when paying it would consume the final HP point', () => {
    const installed = installSyntheticSkill('test.hp-cost.cast', { name: 'HP Cost Test',
      group: 'all', mana: undefined, hp_cost: '20 flat', base_flat: 100, eff: 0, effects: [] });
    const id = installed.row.id;
    try {
      const mob = { id: 'test-mob', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 } as any;
      const short = newSkillState();
      short.list[0] = id; short.owned[id] ??= 0;
      expect(castOnce(short, c, c.maxMana, [mob], {}, mulberry32(7), { currentHp: 20 })).toBe(null);

      const enough = newSkillState();
      enough.list[0] = id; enough.owned[id] ??= 0;
      const cast = castOnce(enough, c, c.maxMana, [mob], {}, mulberry32(7), { currentHp: 21 });
      expect(cast?.manaCost).toBe(0);
      expect(cast?.hpCost).toBe(20);
    } finally {
      installed.restore();
    }
  });
});

describe('channel sustain rate', () => {
  const chan = {
    id: 'test.channel', type: 'attack', mana: '22 flat', cd: 9,
    cast: { delivery: 'melee' }, area: { origin: 'caster', radius_m: 3 },
    effects: [{ stat: 'hits', op: 'add_flat', value: 3, subject: 'self' }],
    action: { kind: 'whirlwind-channel', active_sec: 1.2 },
    channel: { mana_per_sec: 10 },
  } as any;

  it('reads the authored rate and climbs the shared cost ladder once', () => {
    const factor = 1 + ((E.skill_xp.level_cap - 1) * sm.COST_LEVEL_STEP) / 100;
    expect(sm.channelRateSpec(chan)).toBe(10);
    expect(sm.channelRateOf(chan, { skillLevel: 1 })).toBeCloseTo(10, 9);
    expect(sm.channelRateOf(chan, { skillLevel: E.skill_xp.level_cap })).toBeCloseTo(10 * factor, 9);
  });

  it('keeps the start price separate and rows without channel unchanged', () => {
    expect(sm.manaCostOf(chan, { skillLevel: 1 })).toBeCloseTo(22, 9);
    expect(sm.channelRateSpec(sm.byId['attack.whirlwind'] as any)).toBe(null);
    expect(() => sm.channelRateOf(sm.byId['attack.whirlwind'] as any)).toThrow(/no channel rate/);
  });

  it('rejects malformed sustain descriptors and wrong homes', () => {
    expect(() => normalizeSkillAction({ ...chan, channel: { mana_per_sec: 0 } })).toThrow(/mana_per_sec/);
    expect(() => normalizeSkillAction({ ...chan, channel: { mana_per_sec: -5 } })).toThrow(/mana_per_sec/);
    expect(() => normalizeSkillAction({ ...chan, channel: 'fast' })).toThrow(/mana_per_sec/);
    expect(() => normalizeSkillAction({ ...chan, channel: { mana_per_sec: 10, extra: 1 } })).toThrow(/no other keys/);
    expect(() => normalizeSkillAction({ ...chan, hp_cost: '20 flat', mana: undefined })).toThrow(/HP start cost/);
    expect(() => normalizeSkillAction({
      ...chan, action: { kind: 'projectile-burst' },
      cast: { delivery: 'projectile' }, area: { origin: 'target', radius_m: 0 },
    })).toThrow(/whirlwind-channel/);
  });

  it('synthetic 10 Mana/s over 0.35 s spends 3.5 Mana', () => {
    expect(sm.channelRateOf(chan, { skillLevel: 1 }) * 0.35).toBeCloseTo(3.5, 9);
  });

  it('funds pulses from the cast-time pool and stops at the first shortfall offline', () => {
    const prior = sm.byId['attack.whirlwind'];
    sm.byId['attack.whirlwind'] = { ...prior, channel: { mana_per_sec: 10 } };
    try {
      const c = buildCharacter(100, emptyGear());
      const row = sm.byId['attack.whirlwind'] as any;
      const start = sm.manaCostOf(row, { skillLevel: 1 });
      const interval = row.action.interval_sec;
      const hits = row.effects.find((effect: any) => effect.stat === 'hits').value;
      const mk = () => {
        const st = newSkillState();
        st.list[0] = 'attack.whirlwind'; st.owned['attack.whirlwind'] ??= 0;
        return st;
      };
      const mob = () => ({ id: 'offline-target', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 }) as any;
      const full = castOnce(mk(), c, c.maxMana, [mob()], {}, mulberry32(7), { currentHp: c.maxHp })!;
      expect(full.targets).toBe(hits);
      expect(full.manaCost).toBeCloseTo(start + 10 * interval * hits, 6);
      // Less than one interval of sustain cannot fund the first pulse.
      // but the paid start is still the report's price
      const poor = castOnce(mk(), c, start + 10 * interval - .1, [mob()], {}, mulberry32(7), { currentHp: c.maxHp })!;
      expect(poor.targets).toBe(0);
      expect(poor.damage).toBe(0);
      expect(poor.manaCost).toBeCloseTo(start, 6);
    } finally {
      sm.byId['attack.whirlwind'] = prior;
    }
  });
});

describe('a press can open its own timed window (Reap)', () => {
  const c = buildCharacter(100, emptyGear());

  it('the window folds the row onto the sheet and lapses on its own duration', () => {
    const s = newSkillState();
    s.owned[TIMED_ATTACK] = 0;
    s.list[0] = TIMED_ATTACK; s.owned[TIMED_ATTACK] ??= 0;
    const mob = { id: 'test-mob', hp: 1e9, evasion: 0, dodgeRate: 0 } as any;
    const rng = mulberry32(5);
    const before = effectsActive(s);
    expect(before.mult.physical_power || 1).toBe(1);
    castOnce(s, { ...c, weaponName: 'two-handed axe' }, c.maxMana, [mob], {}, rng);
    const dur = Number.parseFloat(String(sm.byId[TIMED_ATTACK].duration));
    expect(s.buffUp[TIMED_ATTACK]).toBe(dur);
    const during = effectsActive(s);
    const reap = sm.byId[TIMED_ATTACK] as any;
    const effectValue = (stat: string) => reap.effects.find((e: any) => e.stat === stat).value;
    expect(during.mult.physical_power).toBeCloseTo(effectValue('physical_power'), 9);
    for (let i = 0; i < dur; i++) tickSkills(s, 1);
    expect(s.buffUp[TIMED_ATTACK]).toBe(0);
    expect(effectsActive(s).mult.physical_power || 1).toBe(1);
  });

  it('a row without the rule word opens no window', () => {
    const s = newSkillState();
    s.owned[MELEE] = 0;
    s.list[0] = MELEE; s.owned[MELEE] ??= 0;
    castOnce(s, c, c.maxMana, [{ id: 'test-mob', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 } as any], {}, mulberry32(5));
    expect(s.buffUp[MELEE]).toBeUndefined();
  });
});

describe('skills in the live loop', () => {
  it('collects buff and aura drops without switching them on, and counts a second copy as a duplicate', () => {
    const pool = sm.all();
    for (const type of ['buff', 'aura']) {
      const s = newSkillState();
      const index = pool.findIndex((skill: any) => skill.type === type);
      expect(index).toBeGreaterThanOrEqual(0);
      let call = 0;
      const first = grantSkill(s, () => call++ === 0 ? 0 : (index + 0.5) / pool.length)!;
      expect(sm.byId[first.id].type).toBe(type);
      expect(first.duplicate).toBe(false);
      expect(ownsSkill(s, first.id)).toBe(true); // count zero is still the first owned copy
      expect(s.buffs[first.id]).not.toBe(true);
      expect(s.auras[first.id]).not.toBe(true);
      expect(reservedPct(s)).toBe(0);
      call = 0;
      const second = grantSkill(s, () => call++ === 0 ? 1 : (index + 0.5) / pool.length)!;
      expect(second).toEqual({ id: first.id, duplicate: true });
      expect(s.owned[first.id]).toBe(1);
    }
  });

  it('ignores and clears persistent buff and aura toggles for unowned skills', () => {
    const s = newSkillState();
    s.auras[MANA_AURA] = true;
    s.buffs[ABSORB] = true;
    s.buffUp[ABSORB] = 30;
    expect(reservedPct(s)).toBe(0);
    expect(effectsActive(s).add).toEqual({});
    expect(toggleTrack(s, MANA_AURA).ok).toBe(false);
    clearUnownedTracks(s);
    expect(s.auras).toEqual({});
    expect(s.buffs).toEqual({});
    expect(s.buffUp).toEqual({});
  });

  it('the bar holds its slots and a fresh skill auto-slots', () => {
    const s = newSkillState();
    expect(s.list.length).toBe(ACTIVE_SLOTS);
    const rng = mulberry32(11);
    const g = grantSkill(s, rng);
    expect(g).toBeTruthy();
    expect(s.owned[g!.id]).toBe(0);
    if (['attack', 'curse', 'heal'].includes(sm.byId[g!.id].type as string)) expect(s.list[0]).toBe(g!.id);
  });

  it('kills pay skill XP and a boss can hand out the first skill', () => {
    const game = newGame(999);
    huntZone(game, game.zone);
    game.skills.owned[MELEE] = 0;
    game.skills.list[0] = MELEE; game.skills.owned[MELEE] ??= 0;
    for (let i = 0; i < 20000 && !game.skills.xp[MELEE]; i++) tick(game, {});
    expect(game.skills.xp[MELEE]).toBeGreaterThan(0);
    expect(game.counters.kills).toBeGreaterThan(0);
  });

  it('a long enough run drops at least one skill through the real rate', () => {
    const game = newGame(20260103);
    huntZone(game, game.zone);
    // the rate is per kill (E.skill_drop owns the figures), so a fixed window is a coin flip on the
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

describe('F34 active skill contract — one manual skill for bar, shortcut, aim and command', () => {
  it('reads the first slotted attack or curse in rotation order', () => {
    const s = newSkillState();
    s.owned[PROJECTILE] = 0;
    s.owned[POWER_BUFF] = 0;
    s.list.fill(null);
    s.list[2] = POWER_BUFF;
    s.list[1] = PROJECTILE;
    expect(defaultManualSkill(s)).toBe(PROJECTILE);
  });

  it('skips non-damage slots instead of inventing Fireball', () => {
    const s = newSkillState();
    s.owned[POWER_BUFF] = 0;
    s.list.fill(null);
    s.list[0] = POWER_BUFF;
    expect(defaultManualSkill(s)).toBeUndefined();
    expect(defaultManualSkill(newSkillState())).toBeUndefined();
  });
});
