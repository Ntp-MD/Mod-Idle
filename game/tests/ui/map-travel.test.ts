import { describe, expect, it } from 'vitest';
import { mapTravelPhase } from '../../src/ui/map/map-travel';

describe('board travel presentation', () => {
  it('stays on the board while walking and requests combat for en-route ambushes', () => {
    expect(mapTravelPhase(true, true, false)).toBe('travel');
    expect(mapTravelPhase(true, true, true)).toBe('combat');
    expect(mapTravelPhase(true, false, true)).toBe('combat');
  });
  it('finishes safe arrivals and leaves manual map browsing alone', () => {
    expect(mapTravelPhase(true, false, false)).toBe('arrived');
    expect(mapTravelPhase(false, false, true)).toBe('idle');
  });
});
