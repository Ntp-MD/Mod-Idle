import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/core/game';
import { rollDrop } from '../src/sim/gear/drop';
import { mulberry32 } from '../src/engine/client-helpers';
import { loot } from '../src/engine/client';
import { gearCarePreview } from '../src/sim/gear/gear-care';
import { setRule } from '../src/sim/gear/filter';
import { slotsAvailable, slotsUsed } from '../src/sim/gear/slots';
import { autoReturnThreshold } from '../src/sim/world/exploration';

const withCarried = (count = 6) => {
  const state = newGame();
  const rng = mulberry32(7);
  for (let i = 0; i < count; i++) state.bag.push(rollDrop(rng, 'low', 10, 1.2, false));
  return state;
};

describe('gear care preview', () => {
  for (const blocker of ['recovery', 'dungeon'] as const) {
    it(`does not promise Auto-Return during ${blocker}`, () => {
      const state = withCarried();
      state.patrol.active = true; state.autoReturn.enabled = true;
      while (slotsUsed(state) < autoReturnThreshold(state)) state.bag.push(rollDrop(mulberry32(state.bag.length + 21), 'low', 10, 1.2, false));
      if (blocker === 'recovery') state.phase = 'camp';
      else state.dungeon = {} as NonNullable<typeof state.dungeon>;
      const preview = gearCarePreview(state, 0);
      expect(preview.autoReturn.readyToStart).toBe(false);
      expect(preview.autoReturn.blocked?.toLowerCase()).toContain(blocker);
    });
  }
  it('never changes the live bag, worn gear or RNG', () => {
    const state = withCarried();
    state.bag[0].locked = true;
    const bag = JSON.stringify(state.bag);
    const gear = JSON.stringify(state.gear);
    const rng = state.rngState;
    gearCarePreview(state, 0);
    expect(JSON.stringify(state.bag)).toBe(bag);
    expect(JSON.stringify(state.gear)).toBe(gear);
    expect(state.rngState).toBe(rng);
  });

  it('keeps locked and Collector-held pieces protected from the filter', () => {
    const state = withCarried();
    state.bag[0].locked = true;
    state.bag[1].heldFor = 'set-test';
    const preview = gearCarePreview(state, 0);
    expect(preview.bag.some((row) => row.action === 'protected' && /Locked/.test(row.reason))).toBe(true);
    expect(preview.bag.some((row) => row.action === 'protected' && /Collector/.test(row.reason))).toBe(true);
  });

  it('reports the live Auto-Return watermark and why it waits', () => {
    const state = withCarried();
    state.autoReturn.enabled = true;
    state.patrol.active = true;
    const preview = gearCarePreview(state, 0);
    expect(preview.autoReturn.available).toBe(slotsAvailable(state));
    expect(preview.autoReturn.used).toBe(slotsUsed(state));
    expect(preview.autoReturn.threshold).toBeGreaterThan(0);
    expect(preview.autoReturn.settlement.length).toBeGreaterThan(0);
    expect(preview.autoReturn.blocked).toContain('Waits until');
  });

  it('explains when enabling Auto-Return would immediately start a trip', () => {
    const state = newGame();
    state.patrol.active = true;
    state.autoReturn.enabled = false;
    const threshold = autoReturnThreshold(state);
    while (slotsUsed(state) < threshold) state.bag.push(rollDrop(mulberry32(state.bag.length + 21), 'low', 10, 1.2, false));
    const preview = gearCarePreview(state, 0);
    expect(preview.autoReturn.readyToStart).toBe(true);
    expect(preview.autoReturn.blocked).toContain('next tick');
  });

  it('shows no filter blocker when the full bag keeps every piece', () => {
    const state = withCarried();
    while (slotsUsed(state) < slotsAvailable(state)) state.bag.push(rollDrop(mulberry32(state.bag.length + 21), 'low', 10, 1.2, false));
    const preview = gearCarePreview(state, 0);
    expect(preview.filterBlocked).toBeNull();
    expect(preview.bag.every((row) => row.action === 'keep')).toBe(true);
  });

  it('marks the first salvage bundle that cannot fit and leaves later pieces unreached', () => {
    const state = newGame();
    let weak = null as ReturnType<typeof rollDrop> | null;
    for (let seed = 1; seed <= 64 && !weak; seed++) {
      const item = rollDrop(mulberry32(seed), 'low', 10, 1.2, false);
      if (item.slot === 'helmet') weak = item;
    }
    expect(weak).not.toBeNull();
    const helmetIndex = loot.SLOTS.indexOf('helmet');
    expect(helmetIndex).toBeGreaterThanOrEqual(0);
    const strong = { ...weak!, lines: weak!.lines.map((line) => ({ ...line, value: 1_000_000 })) };
    state.gear[helmetIndex] = strong;
    setRule(state.filter, 'helmet', { enabled: true, margin_pct: 0 });
    const otherUsed = slotsUsed(state) - state.bag.length;
    state.bag = [weak!, ...Array.from({ length: slotsAvailable(state) - otherUsed - 1 }, () => ({ ...weak!, locked: true }))];

    const preview = gearCarePreview(state, 0);
    expect(preview.filterBlocked).toContain('salvage bundle');
    expect(preview.bag[0].action).toBe('blocked');
    expect(preview.bag.slice(1).every((row) => row.action === 'protected')).toBe(true);
  });
});
