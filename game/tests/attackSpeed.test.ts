import { describe, it, expect } from 'vitest';
import { E, eng } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';

/**
 * The attack-speed Cap is a CLOCK rule (core-stats.md · formula.md): it binds the FINAL figure, so
 * it is applied after the aspd Mod band, after a multiplicative aspd buff (Haste's ×1.15) and after
 * the weight tax. These tests hold the ceiling at 5 hits/sec on the sheet, not just inside the Agi
 * term where a later multiplier could slip past it.
 */
describe('the attack-speed cap is the final 5 hits/sec ceiling', () => {
  it('clamps the engine helpers however fast the raw clock is built', () => {
    const raw = eng.aspdOf(5000, 1.5, 4000); // fastest weapon, absurd Agi + aspd band
    expect(raw).toBeGreaterThan(E.caps.aspd);
    expect(eng.capAspd(raw)).toBe(E.caps.aspd);
    expect(eng.hitsPerSec(raw)).toBeCloseTo(E.caps.aspd / 100, 10);
  });

  it('caps the character sheet after a multiplicative aspd buff, so Haste cannot pass 5 hits/sec', () => {
    const gear = emptyGear();
    gear[0] = {
      slot: 'main hand', base: 'dagger', rarity: 'Common', quality: 'mid', tier: 'T1',
      lines: [{ id: 'attack_speed', value: 4000 }],
    } as any;
    const plain = buildCharacter(100, gear);
    const hasted = buildCharacter(100, gear, {}, 0, { add: {}, mult: { attack_speed: 1.15 } });
    expect(plain.aspd).toBeLessThanOrEqual(E.caps.aspd);
    expect(plain.hitsPerSec).toBeLessThanOrEqual(5);
    // the buff would push the raw clock past the Cap; the sheet still lands on it
    expect(hasted.aspd).toBe(E.caps.aspd);
    expect(hasted.hitsPerSec).toBeCloseTo(5, 10);
  });

  it('leaves an ordinary build under the Cap — it stays a clock rule, not a build target', () => {
    const c = buildCharacter(E.stat.level_cap, emptyGear());
    expect(c.aspd).toBeLessThan(E.caps.aspd);
    expect(c.hitsPerSec).toBeLessThan(5);
  });
});
