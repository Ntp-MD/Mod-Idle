import { describe, it, expect } from 'vitest';
import { buildCharacter, emptyGear } from '../src/sim/core/player';

describe('per-Element resistance', () => {
  it('an Elemental resistance line hardens only its own Element', () => {
    const gear = emptyGear();
    const at = gear.findIndex(() => true);
    gear[at] = {
      base: 'Iron Band', slot: 'ring', quality: 'low', level: 1, value: 0, weight: 0,
      lines: [{ id: 'elemental_resistance', value: 20, element: 'fire', slice: 1 }],
    } as any;
    const c = buildCharacter(1, gear);
    expect(c.resistance).toBe(0);
    expect(c.resByElement.fire).toBe(20);
    expect(c.resByElement.cold ?? 0).toBe(0);
  });

  it('a line with no Element still lifts every Element together', () => {
    const gear = emptyGear();
    gear[0] = {
      base: 'Leather Cap', slot: 'helmet', quality: 'low', level: 1, value: 0, weight: 0,
      lines: [{ id: 'elemental_resistance', value: 15, slice: 1 }],
    } as any;
    const c = buildCharacter(1, gear);
    expect(c.resistance).toBe(15);
  });
});
