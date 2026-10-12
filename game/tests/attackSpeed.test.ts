import { describe, it, expect } from 'vitest';
import { E, eng, sm } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';

/**
 * The attack-speed Cap is a CLOCK rule stated in seconds (`caps.attack_interval_sec`): the engine
 * derives its aspd ceiling from that one number, so the rule reads as the interval it is and no
 * weapon can clock faster than it. It binds the FINAL figure, so it is applied after the aspd Mod
 * band, after a multiplicative aspd buff (Haste's multiplier) and after the weight tax.
 */
const HITS_CAP = 1 / E.caps.attack_interval_sec;
// the buff under test is Haste's own attack-speed mult, read off the roster
const HASTE = sm.byId['aura.haste']!.effects!.find((e: any) => e.stat === 'attack_speed')!.value;

describe('the attack-speed cap is the final swing-interval ceiling', () => {
  it('clamps the engine helpers however fast the raw clock is built', () => {
    const raw = eng.aspdOf(5000, 1.5, 4000); // fastest weapon, absurd Agi + aspd band
    expect(eng.hitsPerSec(raw)).toBeGreaterThan(0);
    expect(eng.hitsPerSec(raw)).toBeCloseTo(HITS_CAP, 10);
    expect(1 / eng.hitsPerSec(raw)).toBeCloseTo(E.caps.attack_interval_sec, 10);
  });

  it('caps the character sheet after a multiplicative aspd buff, so Haste cannot pass the interval', () => {
    const gear = emptyGear();
    gear[0] = {
      slot: 'main hand', base: 'dagger', ilvl: 1, quality: 'mid', tier: 'T1',
      lines: [{ id: 'attack_speed', value: 4000 }],
    } as any;
    const plain = buildCharacter(100, gear);
    const hasted = buildCharacter(100, gear, {}, 0, { add: {}, mult: { attack_speed: HASTE } });
    expect(plain.hitsPerSec).toBeLessThanOrEqual(HITS_CAP + 1e-9);
    // the buff would push the raw clock past the Cap; the sheet still lands on it
    expect(hasted.hitsPerSec).toBeCloseTo(HITS_CAP, 10);
  });

  it('leaves an ordinary build under the Cap — it stays a clock rule, not a build target', () => {
    const c = buildCharacter(E.stat.level_cap, emptyGear());
    expect(c.hitsPerSec).toBeLessThan(HITS_CAP);
  });
});
