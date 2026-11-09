import { describe, expect, it } from 'vitest';
import { validateCampEventBeat, validateCampEvents, resolveCampChoice } from '../../../engine/camp-events';
import beats from '../../../tools/data/camp-events.json';

describe('camp story data', () => {
  it('validates every authored beat', () => {
    expect(validateCampEvents((beats as any).beats)).toEqual([]);
  });
  it('resolves a prowler choice to combat without publishing damage', () => {
    const beat = (beats as any).beats.find((b: any) => b.state === 'prowler');
    expect(beat).toBeDefined();
    const r = resolveCampChoice(beat, 1);
    expect(r?.choice.result).toBe('combat');
    expect(r?.choice).not.toHaveProperty('damage');
  });
  it('keeps read-only and timeout cost-free', () => {
    for (const b of (beats as any).beats as any[]) {
      if (b.state === 'read-only' || b.state === 'timeout') {
        for (const c of b.choices) expect(c.cost).toBeUndefined();
      }
    }
  });
  it('rejects multi-cost choices', () => {
    expect(validateCampEventBeat({ id: 'x', state: 'prowler', line: 'x', choices: [{ label: 'y', cost: { timeSec: 10, item: 'food', qty: 1 }, result: 'close' }] })).toContain('x/y: at most one cost type');
  });
});
