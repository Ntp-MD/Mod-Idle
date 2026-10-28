import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { activeVfxMechanics, activeVfxResolvedHits } from '../../src/ui/combat/arena-active-vfx';

describe('one arena event, one strike visual', () => {
  it('never repeats a press the tick already splits into impact events', () => {
    for (const id of ['attack.ice_lance', 'attack.arrow_shower', 'attack.overload', 'attack.blizzard', 'attack.whirlwind']) {
      const skill = sm.byId[id];
      expect(skill, id).toBeTruthy();
      expect(skill!.effects?.some((effect) => effect.stat === 'hits' && effect.value > 1), id).toBe(true);
      expect(activeVfxResolvedHits(skill, false), id).toBe(1);
    }
  });

  it('keeps the repeat decoration for rows the engine folds into one receipt', () => {
    const waterBall = sm.byId['attack.water_ball'];
    expect(activeVfxMechanics(waterBall).hits).toBe(5);
    expect(activeVfxResolvedHits(waterBall, false)).toBe(5);
    expect(activeVfxResolvedHits(waterBall, true)).toBe(1);
    expect(activeVfxResolvedHits(sm.byId['attack.double_strike'], false)).toBe(2);
  });

  it('never repeats on a cast beat or an unknown row', () => {
    expect(activeVfxResolvedHits(sm.byId['attack.blizzard'], true)).toBe(1);
    expect(activeVfxResolvedHits(undefined, false)).toBe(1);
    expect(activeVfxResolvedHits(sm.byId['attack.firestorm'], false)).toBe(1);
  });
});

describe('mob skill cast visuals', () => {
  it('resolves every authored mob delivery to a real active VFX shape', async () => {
    const { MS } = await import('../../src/engine/client');
    const { mobCastFxFor } = await import('../../src/ui/combat/arena-skill-effects');
    const { ACTIVE_VFX } = await import('../../src/ui/combat/arena-active-vfx');
    const strikes = MS.skills.filter((row) => row.mode === 'strike');
    expect(strikes.length).toBeGreaterThan(20);
    for (const row of strikes) {
      const fx = mobCastFxFor(row.cast?.delivery);
      expect(fx, row.id).toBeTruthy();
      expect(ACTIVE_VFX[fx!.shape], row.id).toBeTruthy();
    }
    expect(mobCastFxFor('ground')?.shape).toBe('groundSlam');
    expect(mobCastFxFor('projectile')?.shape).toBe('fireball');
    expect(mobCastFxFor(undefined)?.shape).toBe('cleave');
  });
});

describe('folded multi-hit labels', () => {
  it('names the hit count only when the engine folded the receipt', async () => {
    const { arenaDamageLabel } = await import('../../src/ui/combat/arena-active-vfx');
    expect(arenaDamageLabel('1,200', 5)).toBe('1,200 ×5');
    expect(arenaDamageLabel('1,200', 5, true)).toBe('1,200! ×5');
    expect(arenaDamageLabel('1,200', 1)).toBe('1,200');
    expect(arenaDamageLabel('1,200', 1, true)).toBe('1,200!');
    expect(arenaDamageLabel(undefined, 5)).toBe('');
  });
});
