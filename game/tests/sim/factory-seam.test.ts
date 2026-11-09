import { describe, expect, it } from 'vitest';
import { road, farm, fieldwork } from '../../src/engine/client';

// Compile-time contract: these three exports are concrete, never any.
type IsAny<T> = 0 extends (1 & T) ? true : false;
type AssertNotAny<T> = IsAny<T> extends true ? never : unknown;

const _roadContract: AssertNotAny<typeof road> = null as unknown as typeof road;
const _farmContract: AssertNotAny<typeof farm> = null as unknown as typeof farm;
const _fieldworkContract: AssertNotAny<typeof fieldwork> = null as unknown as typeof fieldwork;
export { _roadContract, _farmContract, _fieldworkContract };

describe('factory seam contracts', () => {
  it('exposes concrete road/farm/fieldwork results', () => {
    expect(road).toBeTruthy();
    expect(farm).toBeTruthy();
    expect(fieldwork).toBeTruthy();
    // Meaningful signatures survive inference (no broad index defaults).
    expect(typeof road.blocksLand).toBe('function');
    expect(typeof farm.craftCost).toBe('function');
    expect(typeof fieldwork.validateCampPool).toBe('function');
    // Keep runtime invalid-data checks at the validator, not here.
    expect(Array.isArray(fieldwork.F)).toBe(false);
  });
});
