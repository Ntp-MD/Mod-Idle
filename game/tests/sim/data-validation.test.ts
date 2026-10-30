import { describe, it, expect } from 'vitest';
import { validateEngineData } from '@engine/validate.ts';
import { K_KEYS } from '@engine/types.ts';
import { E, SKILLS, sm } from '../../src/engine/client';
import {
  DEFAULT_ROLL_POLICY, normalizeSkillAction, skillActionBudget, skillDurationSec, skillTargetCap,
  validateMobSkillRules, validateSkillActions, validateSkillCastProfiles,
} from '@engine/skills.ts';

/**
 * The canonical data is checked before anything reads it. Every case runs on a copy, so a bad
 * input is proved without the real file ever changing.
 */

/** A copy of the canonical data — the negative cases work on this, never on the file. */
const copy = (): any => structuredClone(E as any);

describe('the canonical data is checked before anything reads it', () => {
  it('loads the real file', () => {
    expect(() => validateEngineData(copy())).not.toThrow();
  });

  it('refuses an engagement map that names an unknown or a repeated Species', () => {
    const unknown = copy();
    unknown.mob.engagement.proximity.push('not-a-species');
    expect(() => validateEngineData(unknown)).toThrow(/mob\.engagement\.proximity|unknown Species/);
    const repeated = copy();
    repeated.mob.engagement.assist.push(repeated.mob.engagement.assist[0]);
    expect(() => validateEngineData(repeated)).toThrow(/duplicates Species/);
  });

  it('refuses an ordinary-attack profile with no usable shot', () => {
    const slow = copy();
    slow.combat_arena.normal_attack.profiles.ranged.projectile_speed_mps = 0;
    expect(() => validateEngineData(slow)).toThrow(/normal_attack\.profiles\.ranged\.projectile_speed_mps/);

    const missing = copy();
    delete missing.combat_arena.normal_attack.profiles.ranged;
    expect(() => validateEngineData(missing)).toThrow(/normal_attack\.profiles\.?ranged|legacy\.stand-off/);
  });

  it('refuses an ordinary-attack profile that cannot state or hold its reach', () => {
    const noBasis = copy();
    delete noBasis.combat_arena.normal_attack.profiles.melee.range.basis;
    expect(() => validateEngineData(noBasis)).toThrow(/normal_attack\.profiles\.melee\.range\.basis/);

    const overlap = copy();
    overlap.combat_arena.normal_attack.profiles.melee.range.meters = 0.01;
    expect(() => validateEngineData(overlap)).toThrow(/normal_attack\.profiles\.melee\.range\.meters/);

    const stopInside = copy();
    stopInside.combat_arena.normal_attack.profiles.ranged.range.meters = 0.5;
    expect(() => validateEngineData(stopInside))
      .toThrow(/normal_attack\.profiles\.ranged\.(stop_at_range_pct|range\.meters)/);

    const noPlayerMap = copy();
    delete noPlayerMap.combat_arena.normal_attack.player.magic;
    expect(() => validateEngineData(noPlayerMap)).toThrow(/normal_attack\.player\.magic/);
  });

  it('keeps every multi-impact action row executable', () => {
    const kinds = new Set(['projectile-burst', 'ground-pulse-burst', 'whirlwind-channel', 'blizzard-field', 'sand-field', 'chain-strike', 'cluster-burst', 'targeted-burst']);
    for (const row of Object.values(sm.byId)) {
      const action = (row as any).action;
      if (!action) continue;
      expect(kinds.has(action.kind), row.id).toBe(true);
      const hits = (row.effects || []).find((effect: any) => effect.stat === 'hits')?.value ?? 1;
      if (!['sand-field', 'chain-strike', 'cluster-burst'].includes(action.kind)) expect(hits, row.id).toBeGreaterThan(1);
      if (action.kind === 'cluster-burst') {
        // No live adopter today; the future row must still be one press split exactly 100%.
        const parent = Number(action.parent_share_pct);
        const count = Number(action.child_count);
        const share = Number(action.child_share_pct);
        expect(Number.isInteger(count) && count > 0, row.id).toBe(true);
        expect(parent, row.id).toBeGreaterThanOrEqual(0);
        expect(share, row.id).toBeGreaterThanOrEqual(0);
        expect(parent + count * share, row.id).toBe(100);
        expect((row as any).area?.radius_m, row.id).toBeGreaterThan(0);
        expect(action.spread_deg, row.id).toBeGreaterThan(0);
        expect((row as any).cast?.delivery, row.id).toBe('projectile');
      }
      if (action.kind === 'targeted-burst') {
        expect(action.tracking === 'straight' || action.tracking === 'homing', row.id).toBe(true);
        expect(action.interval_sec, row.id).toBeGreaterThan(0);
        expect((row as any).area?.radius_m, row.id).toBe(0);
        expect((row as any).cast?.delivery, row.id).toBe('projectile');
        expect(hits, row.id).toBe(3);
        if (action.tracking === 'homing') {
          expect(action.pursuit_range_m, row.id).toBeGreaterThan(0);
          expect(action.pursuit_sec, row.id).toBeGreaterThan(0);
        }
      }
      if (action.kind === 'chain-strike') {
        const count = Number(String((row as any).targets ?? '1').split('/')[0]) || 1;
        expect(count, row.id).toBeGreaterThan(1);
        expect((row as any).area?.radius_m, row.id).toBeGreaterThan(0);
        // T5: hop cadence and share live in canonical action data (80ms, 60% baseline).
        // Presence and finiteness only — no tuning cap is invented here.
        expect(action.interval_sec, row.id).toBeGreaterThan(0);
        expect(Number.isFinite(Number(action.hop_share_pct)), row.id).toBe(true);
        expect(Number(action.hop_share_pct), row.id).toBeGreaterThanOrEqual(0);
      }
      if (action.kind === 'projectile-burst' || action.kind === 'blizzard-field') {
        expect((row.effects || []).find((effect: any) => effect.stat === 'hit_pct')?.value, row.id)
          .toBeGreaterThan(0);
      }
      if (action.kind === 'projectile-burst') expect(action.interval_sec, row.id).toBeGreaterThan(0);
      if (action.kind === 'ground-pulse-burst') expect(action.interval_sec, row.id).toBeGreaterThan(0);
      if (action.kind === 'blizzard-field') {
        expect(Number.parseFloat(String((row as any).duration ?? '')), row.id).toBeGreaterThan(0);
      }
      if (action.kind === 'sand-field') {
        expect((row.effects || []).find((effect: any) => effect.stat === 'dot_sec')?.value, row.id)
          .toBeGreaterThan(0);
        expect((row.effects || []).find((effect: any) => effect.stat === 'dot_dps')?.value, row.id)
          .toBeGreaterThan(0);
      }
      if (action.kind === 'whirlwind-channel') {
        expect(action.active_sec, row.id).toBeGreaterThan(0);
        expect(action.movement_speed_mult, row.id).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every authored footprint executable', () => {
    for (const row of Object.values(sm.byId)) {
      const area = (row as any).area;
      if (!area?.shape) continue;
      if (area.shape === 'line') {
        expect(area.origin, row.id).toBe('caster');
        expect(area.length_m, row.id).toBeGreaterThan(0);
        expect(area.width_m, row.id).toBeGreaterThan(0);
      }
      if (area.shape === 'cone') {
        expect(area.origin, row.id).toBe('caster');
        expect(area.radius_m, row.id).toBeGreaterThan(0);
        expect(area.angle_deg, row.id).toBeGreaterThan(0);
        expect(area.angle_deg, row.id).toBeLessThanOrEqual(180);
      }
    }
  });

  it('carries exactly the constants the engine declares', () => {
    expect(Object.keys(E.K).sort()).toEqual([...K_KEYS].sort());
  });

  it('names the constant the file lost', () => {
    const data = copy();
    delete data.K.K_VIT_HP;
    expect(() => validateEngineData(data)).toThrow(/K\.K_VIT_HP must be a finite number/);
  });

  it('names a constant that is not a number', () => {
    const data = copy();
    data.K.K_STR = 'twelve';
    expect(() => validateEngineData(data)).toThrow(/K\.K_STR must be a finite number/);
  });

  it('names the section the file lost', () => {
    const data = copy();
    delete data.max_hp_press;
    expect(() => validateEngineData(data)).toThrow(/max_hp_press is missing/);
  });

  it('names the value that is not a number', () => {
    const data = copy();
    data.stat.level_cap = '190';
    expect(() => validateEngineData(data)).toThrow(/stat\.level_cap must be a finite number/);
  });

  it('names a Cap that is neither a number nor an explicit null', () => {
    const data = copy();
    data.caps.evasion = 'eighty';
    expect(() => validateEngineData(data)).toThrow(/caps\.evasion must be a finite number or null/);
  });

  it('names the pair that is not a pair', () => {
    const data = copy();
    data.mob.zones[0].levels = [1];
    expect(() => validateEngineData(data)).toThrow(/mob\.zones\[0\]\.levels must be a pair of numbers/);
  });

  it('names the identity that is duplicated', () => {
    const data = copy();
    data.mob.species[1].id = data.mob.species[0].id;
    expect(() => validateEngineData(data)).toThrow(/mob\.species\[1\]\.id duplicates species id/);
  });

  it('names a Core block that lost an attribute', () => {
    const data = copy();
    data.mob.species[0].core.lck = undefined;
    expect(() => validateEngineData(data)).toThrow(/mob\.species\[0\]\.core\.lck must be a finite number/);
  });

  it('names a forge grade outside the three published bands', () => {
    const data = copy();
    data.forge.materials['iron-ore'].grade = 4;
    expect(() => validateEngineData(data)).toThrow(/forge\.materials\.iron-ore\.grade must be a whole number from 1 to 3/);
  });

  it('names a forge pattern without a positive material count', () => {
    const data = copy();
    data.forge.armour.chest.count = 0;
    expect(() => validateEngineData(data)).toThrow(/forge\.armour\.chest\.count must be a positive whole number/);
  });

  it('leaves the file it was given untouched', () => {
    const data = copy();
    const before = JSON.stringify(data);
    expect(() => validateEngineData(data)).not.toThrow();
    expect(JSON.stringify(data)).toBe(before);
  });
});


describe('action descriptors normalize once and validate before payment', () => {
  const base = (over: any = {}) => ({
    id: 'attack.test', type: 'attack', hit_class: 'attack', targets: '1',
    cast: { delivery: 'projectile' }, area: { origin: 'target', radius_m: 0 },
    effects: [{ stat: 'hits', op: 'add_flat', value: 2, subject: 'self' }],
    ...over,
  });

  it('publishes a normalized roll policy and the plan budget for every live action row', () => {
    const budget: Record<string, number> = {
      'attack.ice_lance': 2, 'attack.blizzard': 20, 'attack.chain_lightning': 3,
      'attack.sand_storm': 11, 'attack.whirlwind': 3, 'attack.arrow_shower': 3,
      'attack.overload': 2, 'attack.double_strafe': 3, 'attack.seeker_strafe': 3,
    };
    for (const row of Object.values(sm.byId)) {
      if (!row.action) {
        expect(skillActionBudget(row), row.id).toBe(1);
        continue;
      }
      const normalized = normalizeSkillAction(row)!;
      expect(normalized.roll_policy, row.id).toBe(row.action.roll_policy);
      expect(['shared', 'independent'], row.id).toContain(normalized.roll_policy);
      expect(normalized.roll_policy, row.id).toBe(DEFAULT_ROLL_POLICY[row.action.kind]);
      if (budget[row.id] != null) expect(skillActionBudget(row), row.id).toBe(budget[row.id]);
    }
  });

  it('rejects malformed execution before payment', () => {
    expect(() => normalizeSkillAction(base({ action: { kind: 'nope' } }) as any)).toThrow(/unknown kind/);
    expect(() => normalizeSkillAction(base({ action: { kind: 'projectile-burst', roll_policy: 'always' } }) as any))
      .toThrow(/roll_policy/);
    expect(() => normalizeSkillAction(base({ action: { kind: 'projectile-burst', interval_sec: 0 } }) as any))
      .toThrow(/interval_sec/);
    expect(() => normalizeSkillAction(base({ cast: { delivery: 'ground' }, action: { kind: 'targeted-burst' } }) as any))
      .toThrow(/requires projectile delivery/);
    expect(() => normalizeSkillAction(base({ effects: [{ stat: 'hits', op: 'add_flat', value: 2.5 }], action: { kind: 'projectile-burst' } }) as any))
      .toThrow(/safe integer/);
    expect(() => normalizeSkillAction(base({
      area: { origin: 'target', radius_m: 2 },
      action: { kind: 'cluster-burst', parent_share_pct: 40, child_count: 2, child_share_pct: 20 },
    }) as any)).toThrow(/total 100/);
    expect(() => validateSkillActions([base({ action: { kind: 'nope' } })] as any, 'synthetic'))
      .toThrow(/synthetic: attack\.test/);
  });

  it('reads decimal durations, the first targets number and the dev/test fixtures', () => {
    expect(skillDurationSec('1.5 sec')).toBe(1.5);
    expect(skillDurationSec('0.5 sec')).toBe(0.5);
    expect(skillDurationSec('8 sec')).toBe(8);
    expect(skillDurationSec('Instant', 0)).toBe(0);
    expect(skillDurationSec(undefined, 10)).toBe(10);
    expect(skillTargetCap({ targets: '3/5' })).toBe(3);
    expect(skillTargetCap({ targets: ' 2 / 4 ' })).toBe(2);
    expect(skillTargetCap({ targets: 'a/b' } as any)).toBe(1);

    const fixtures = (SKILLS as any).test_fixtures?.skills ?? [];
    expect(fixtures.map((row: any) => row.id)).toEqual(
      expect.arrayContaining(['test.cluster_burst', 'test.hp_cost', 'test.burst_policy']));
    expect(() => validateSkillActions(fixtures, 'skills.json test_fixtures')).not.toThrow();
  });

  it('fails malformed targets and a missing cast profile at the cage, not at dispatch', () => {
    const row = { ...sm.byId['attack.chain_lightning'], targets: 'a/b' };
    expect(() => normalizeSkillAction(row)).toThrow(/targets must be/);
    expect(() => validateSkillCastProfiles(
      [{ id: 'attack.missing_profile', cast: { delivery: 'ground' } } as any], {}, 'skills.json'))
      .toThrow(/attack\.missing_profile has no meta\.action_profiles\.ground/);
    expect(() => validateSkillCastProfiles(
      Object.values(sm.byId), SKILLS.meta.action_profiles, 'skills.json')).not.toThrow();
    // A row that reaches the runtime without its authored profile must not throw mid-combat;
    // the cage above is the one place that failure is allowed to stop the build.
    expect(() => sm.castProfileOf({ ...sm.byId['attack.fireball'], cast: { delivery: 'missing' } } as any)).not.toThrow();
  });

  it('keeps the mob-strike rule vocabulary closed and auras rule-free', () => {
    const row = (over: any = {}) => ({ id: 'mob.test', mode: 'strike', ...over });
    expect(() => validateMobSkillRules([row({ rules: ['ignores_dodge'] })], 'mob-skills.json')).not.toThrow();
    expect(() => validateMobSkillRules([row({ rules: ['bypasses_everything'] })], 'mob-skills.json'))
      .toThrow(/unknown rule/);
    expect(() => validateMobSkillRules([row({ mode: 'aura', rules: ['ignores_dodge'] })], 'mob-skills.json'))
      .toThrow(/aura/);
    expect(() => validateMobSkillRules([row({ rules: 'ignores_dodge' })], 'mob-skills.json'))
      .toThrow(/array/);
  });
});
