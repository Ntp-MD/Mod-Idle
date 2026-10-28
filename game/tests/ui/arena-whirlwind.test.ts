import { describe, expect, it } from 'vitest';
import { ACTIVE_VFX } from '../../src/ui/combat/arena-active-vfx';
import {
  whirlwindBlades, whirlwindDust, whirlwindFade, whirlwindRibbon, whirlwindRounds, whirlwindSize, whirlwindSpin,
} from '../../src/ui/combat/arena-whirlwind';

describe('whirlwind VFX', () => {
  it('keeps Whirlwind off its legacy art sheets', () => {
    const vfx = ACTIVE_VFX.whirlwind;
    expect(vfx.duration).toBe(1.3);
    expect(vfx.size).toBe(210);
    expect([vfx.art, vfx.impact, vfx.ground]).not.toContain('wave-1251');
    expect([vfx.art, vfx.impact, vfx.ground]).not.toContain('wave-1617');
    expect([vfx.art, vfx.impact, vfx.ground]).not.toContain('spark-1066');
    expect([vfx.art, vfx.impact, vfx.ground]).not.toContain('ring-1732');
  });

  it('keeps the effect footprint inside a readable range', () => {
    expect(whirlwindSize()).toBe(200);
    expect(whirlwindSize(60)).toBe(150);
    expect(whirlwindSize(400)).toBe(230);
  });

  it('spins one full turn per round and holds still for reduced motion', () => {
    const turns = Math.PI * 2 * 3;
    expect(whirlwindSpin(1.3, 1.3, 3)).toBeCloseTo(turns, 6);
    expect(whirlwindSpin(.65, 1.3, 3)).toBeCloseTo(turns / 2, 6);
    expect(whirlwindSpin(.65, 1.3, 3, true)).toBe(0);
  });

  it('fades in quickly and out at the end of the cast', () => {
    expect(whirlwindFade(0, 1.3)).toBe(0);
    expect(whirlwindFade(.2, 1.3)).toBe(1);
    expect(whirlwindFade(1.3, 1.3)).toBe(0);
    expect(whirlwindFade(5, 1.3)).toBe(0);
  });

  it('stages one strike beat per round across the cast', () => {
    const beats = whirlwindRounds(1, 1.3, 3);
    expect(beats).toHaveLength(3);
    expect(beats[0].local).toBe(1);
    expect(beats[1].start).toBeCloseTo(1.3 / 3, 6);
    expect(beats[1].local).toBeCloseTo(1 - 1.3 / 3, 6);
    const early = whirlwindRounds(.8, 1.3, 3);
    expect(early[2].local).toBeLessThan(0);
    expect(early[2].progress).toBe(0);
    expect(whirlwindRounds(1.3, 1.3, 3).every(beat => beat.progress === 1)).toBe(true);
  });

  it('builds finite ribbon and blade geometry', () => {
    const ribbon = whirlwindRibbon(200, 224, 1.2, 0, 4);
    expect(ribbon.fill.startsWith('M')).toBe(true);
    expect(ribbon.fill.endsWith('Z')).toBe(true);
    expect(ribbon.core.startsWith('M')).toBe(true);
    expect(ribbon.fill).not.toContain('NaN');
    expect(ribbon.core).not.toContain('NaN');
    const blades = whirlwindBlades(200, 224, 1.2, 3);
    expect(blades).toHaveLength(3);
    expect(blades.every(blade => [blade.x, blade.y, blade.rotation, blade.radius, blade.opacity].every(Number.isFinite))).toBe(true);
    expect(blades.every(blade => blade.opacity >= 0 && blade.opacity <= 1)).toBe(true);
  });

  it('keeps dust deterministic when motion is reduced', () => {
    const dust = whirlwindDust(200, .3, true);
    expect(dust).toHaveLength(14);
    expect(whirlwindDust(200, 2.6, true)).toEqual(dust);
    expect(dust.every(speck => [speck.x, speck.y, speck.size, speck.opacity].every(Number.isFinite))).toBe(true);
  });
});
