import { describe, expect, it } from 'vitest';
import { encounterSignature, seededEncounter } from '../fixtures/encounter';

describe('P0 baseline — replay determinism', () => {
  it('the same seed and script reproduce the same outcome', () => {
    const first = seededEncounter({ seed: 4242 });
    first.run(6);
    const second = seededEncounter({ seed: 4242 });
    second.run(6);
    expect(encounterSignature(first)).toBe(encounterSignature(second));
  });

  it('a different seed does not produce the same fingerprint', () => {
    const a = seededEncounter({ seed: 4242 });
    a.run(6);
    const b = seededEncounter({ seed: 9999 });
    b.run(6);
    expect(encounterSignature(a)).not.toBe(encounterSignature(b));
  });

  it('a manual ground command reaches authoritative motion', () => {
    const control = seededEncounter({ seed: 77 });
    control.run(2);
    const commanded = seededEncounter({ seed: 77 });
    commanded.run(2, { tick: 1, manual: { moveTo: { x: control.arena.player.x, y: control.arena.player.y + 3 } } });
    const moved = Math.hypot(
      commanded.arena.player.x - control.arena.player.x,
      commanded.arena.player.y - control.arena.player.y,
    );
    expect(moved).toBeGreaterThan(0.5);
  });
});
