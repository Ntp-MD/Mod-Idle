import { describe, expect, it, vi } from 'vitest';
import { E, sm } from '../../src/engine/client';
import { grantNamedSkill, grantSkill, newSkillState, usefulSkillDuplicate } from '@sim/combat/skills';

const timed = sm.all().find((row) => row.type === 'attack' && (row.cd ?? 0) > 0)!;

describe('named skill grants', () => {
  it('collects a fresh skill at zero duplicates and uses the first free active slot', () => {
    const s = newSkillState();
    s.list[0] = 'occupied';
    expect(grantNamedSkill(s, timed.id)).toEqual({ id: timed.id, duplicate: false });
    expect(s.owned[timed.id]).toBe(0);
    expect(s.xp[timed.id]).toBe(0);
    expect(s.list[1]).toBe(timed.id);
  });

  it('adds one duplicate while preserving XP and existing rotation placement', () => {
    const s = newSkillState();
    s.owned[timed.id] = 4;
    s.xp[timed.id] = 1234;
    const slots = [...s.list];
    expect(grantNamedSkill(s, timed.id)).toEqual({ id: timed.id, duplicate: true });
    expect(s.owned[timed.id]).toBe(5);
    expect(s.xp[timed.id]).toBe(1234);
    expect(s.list).toEqual(slots);
  });

  it('owns a zero-CD skill without autoslotting it or treating future copies as useful', () => {
    const s = newSkillState();
    const previous = sm.byId[timed.id];
    // The current roster has no zero-CD row; keep the supported case explicit.
    sm.byId[timed.id] = { ...previous, cd: 0 };
    try {
      expect(usefulSkillDuplicate(s, timed.id)).toBe(true);
      grantNamedSkill(s, timed.id);
      expect(s.list.every((id) => id === null)).toBe(true);
      expect(usefulSkillDuplicate(s, timed.id)).toBe(false);
    } finally {
      sm.byId[timed.id] = previous;
    }
  });

  it('distinguishes a useful duplicate from an already complete ladder', () => {
    const s = newSkillState();
    s.owned[timed.id] = sm.LADDER_MAX_DUPLICATES - 1;
    expect(usefulSkillDuplicate(s, timed.id)).toBe(true);
    grantNamedSkill(s, timed.id);
    expect(usefulSkillDuplicate(s, timed.id)).toBe(false);
    // Ordinary drops keep their historical duplicate count even after the final rung.
    grantNamedSkill(s, timed.id);
    expect(s.owned[timed.id]).toBe(sm.LADDER_MAX_DUPLICATES + 1);
  });

  it('grants target XP levels without duplicates or any downgrade', () => {
    const s = newSkillState();
    const level = E.skill_xp.level_cap;
    expect(grantNamedSkill(s, timed.id, { duplicate: false, level })).toEqual({ id: timed.id, duplicate: false });
    expect(s.xp[timed.id]).toBe(sm.skillXpForLevel(level));
    s.owned[timed.id] = 7;
    s.xp[timed.id] += 13;
    const earned = s.xp[timed.id];
    expect(grantNamedSkill(s, timed.id, { duplicate: false, level: 1 })).toEqual({ id: timed.id, duplicate: true });
    expect(s.owned[timed.id]).toBe(7);
    expect(s.xp[timed.id]).toBe(earned);
  });

  it('upgrades owned XP while retaining its Duplicate Ladder', () => {
    const s = newSkillState();
    s.owned[timed.id] = 2;
    s.xp[timed.id] = 1;
    grantNamedSkill(s, timed.id, { duplicate: false, level: E.skill_xp.level_cap });
    expect(s.xp[timed.id]).toBe(sm.skillXpForLevel(E.skill_xp.level_cap));
    expect(s.owned[timed.id]).toBe(2);
  });

  it.each(['buff', 'aura'])('collects %s skills without activating them', (type) => {
    const s = newSkillState();
    const row = sm.all().find((skill) => skill.type === type)!;
    grantNamedSkill(s, row.id, { duplicate: false, level: E.skill_xp.level_cap });
    expect(s.buffs[row.id]).not.toBe(true);
    expect(s.auras[row.id]).not.toBe(true);
    expect(s.buffUp[row.id]).toBeUndefined();
    expect(s.list).not.toContain(row.id);
  });

  it('refuses unknown and inherited IDs without mutation', () => {
    const s = newSkillState();
    const before = structuredClone(s);
    for (const id of ['unknown.skill', 'toString', '__proto__']) {
      expect(grantNamedSkill(s, id)).toBeNull();
      expect(usefulSkillDuplicate(s, id)).toBe(false);
    }
    expect(s).toEqual(before);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, E.skill_xp.level_cap + 1])('refuses invalid XP level %s before changing ownership', (level) => {
    const s = newSkillState();
    const before = structuredClone(s);
    expect(grantNamedSkill(s, timed.id, { level })).toBeNull();
    expect(s).toEqual(before);
  });
});

describe('random skill grant compatibility', () => {
  it('retains the fresh-pool bias draw and then the selection draw', () => {
    const s = newSkillState();
    s.owned[timed.id] = 0;
    const fresh = sm.all().filter((row) => row.id !== timed.id);
    const selection = 0.37;
    const rng = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(selection);
    const chosen = fresh[Math.floor(selection * fresh.length)];
    s.xp[chosen.id] = 999;
    expect(grantSkill(s, rng)).toEqual({ id: chosen.id, duplicate: false });
    expect(rng).toHaveBeenCalledTimes(2);
    expect(s.xp[chosen.id]).toBe(0);
  });

  it('keeps full-pool selection and XP for an owned drop', () => {
    const s = newSkillState();
    const pool = sm.all();
    const index = pool.findIndex((row) => row.id === timed.id);
    s.owned[timed.id] = 0;
    s.xp[timed.id] = 4321;
    const rng = vi.fn().mockReturnValueOnce(1).mockReturnValueOnce((index + 0.5) / pool.length);
    expect(grantSkill(s, rng)).toEqual({ id: timed.id, duplicate: true });
    expect(rng).toHaveBeenCalledTimes(2);
    expect(s.owned[timed.id]).toBe(1);
    expect(s.xp[timed.id]).toBe(4321);
  });

  it('uses only the selection draw when every skill is already owned', () => {
    const s = newSkillState();
    for (const row of sm.all()) s.owned[row.id] = 0;
    const rng = vi.fn(() => 0);
    expect(grantSkill(s, rng)).toEqual({ id: sm.all()[0].id, duplicate: true });
    expect(rng).toHaveBeenCalledTimes(1);
  });
});
