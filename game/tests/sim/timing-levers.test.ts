import { describe, expect, it } from 'vitest';
import { releasedSkillCastTiming, skillCastTiming } from '@engine/skill-actions.ts';
import type { SkillCastProfile } from '@engine/types.ts';
import { buildCharacter, emptyGear } from '@sim/core/player';

const melee: SkillCastProfile = {
  delivery: 'melee', range_m: 2.1, windup_sec: 0.18, recovery_sec: 0.22,
  impact_delay_sec: 0, projectile_speed_mps: 0, hit_radius_m: 0.55,
};
const point = { x: 0, y: 0 };
const UNITS = 1_000_000;

describe('F44 timing levers — haste splits by phase, fixed portions resist it', () => {
  it('compresses only the variable share when a phase names a fixed commitment', () => {
    const profile: SkillCastProfile = { ...melee, fixed_windup_sec: 0.1, fixed_recovery_sec: 0.1 };
    const slow = skillCastTiming(profile, 0, UNITS, point, point, 1);
    const fast = skillCastTiming(profile, 0, UNITS, point, point, 4);
    // Windup 0.18 = fixed 0.10 + variable 0.08; at ×4 only the 0.08 shrinks (0.08/4 = 0.02).
    expect(slow.releaseAtUs).toBe(180_000);
    expect(fast.releaseAtUs).toBe(120_000);
    expect(fast.recoveryUntilUs - fast.releaseAtUs).toBe(100_000 + 30_000);
  });

  it('reads cast and recovery from separate levers', () => {
    const castHaste = skillCastTiming(melee, 0, UNITS, point, point, { cast: 2, recovery: 1 });
    expect(castHaste.releaseAtUs).toBe(90_000);
    expect(castHaste.recoveryUntilUs - castHaste.releaseAtUs).toBe(220_000);
    const tailHaste = releasedSkillCastTiming(melee, 0, 0, UNITS, point, point, { cast: 1, recovery: 2 });
    expect(tailHaste.recoveryUntilUs - tailHaste.releaseAtUs).toBe(110_000);
    expect(tailHaste.releaseAtUs).toBe(0);
  });

  it('floors each phase at one combat step instead of vanishing', () => {
    const floored = skillCastTiming(melee, 0, UNITS, point, point, 1_000_000, 50_000);
    expect(floored.releaseAtUs).toBe(50_000);
    expect(floored.recoveryUntilUs - floored.releaseAtUs).toBe(50_000);
  });

  it('keeps one haste source feeding all three levers until data differentiates them', () => {
    const c = buildCharacter(90, emptyGear());
    expect(c.castSpeed).toBe(c.globalSpeed);
    expect(c.recoverySpeed).toBe(c.globalSpeed);
    expect(c.cooldownRate).toBe(c.globalSpeed);
  });
});
