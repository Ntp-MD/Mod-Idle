import { describe, expect, it } from 'vitest';
import { road } from '../../src/engine/client';
import { newGame } from '@sim/core/game';
import { slotsAvailable } from '@sim/gear/slots';
import {
  JOURNEY_RESOURCE_MS, applyJourneyPolicy, chooseHuntCell, createJourneyRuntime, journeyStateKey,
  makeCheckpoint, newJourneyMemory, restoreCheckpoint, runJourney,
} from '../../measurements/release-journey';

describe('release journey policy', () => {
  it('chooses a hunt cell by route then q/r and never a gathering location', () => {
    const state = newGame(20261103);
    state.cell = { q: 0, r: 0, sub: null, site: null };
    const cell = chooseHuntCell(state, 1);
    expect(cell).not.toBeNull();
    expect((road as any).locationAt(cell)).toBeNull();
    expect((road as any).cellRank(cell)).toBeGreaterThan(0);
    expect((road as any).owners(cell).length).toBeGreaterThan(0);
  });

  it('marks an unorganisable full bag as inventory-policy-blocked instead of deleting a piece', () => {
    const state = newGame(20261103);
    state.bag = Array.from({ length: slotsAvailable(state) }, () => ({
      slot: 'ring', base: 'Locked Fixture', ilvl: 1, quality: 'low', tier: 'T1', lines: [], locked: true,
    })) as never;
    const memory = newJourneyMemory(state);
    applyJourneyPolicy(state, memory);
    expect(memory.inventoryBlocked).toBe(true);
    expect(state.bag).toHaveLength(slotsAvailable(state));
    expect(memory.refusals.at(-1)?.action).toBe('inventory');
  });

  it('resumes from a checkpoint and advances the same state as an uninterrupted run', () => {
    const source = newGame(20261103);
    const memory = newJourneyMemory(source);
    const checkpoint = makeCheckpoint('fixture', source, memory);
    const restored = restoreCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
    const a = createJourneyRuntime(source, memory);
    const b = createJourneyRuntime(restored.state, restored.memory);
    for (let second = 0; second < 3; second++) {
      a.advanceSecond();
      b.advanceSecond();
    }
    expect(journeyStateKey(a.state)).toBe(journeyStateKey(b.state));
    expect(a.memory).toEqual(b.memory);
  });

  it('reports a resource cutoff as INCOMPLETE, never PASS', () => {
    const state = newGame(20261103);
    const runtime = createJourneyRuntime(state, newJourneyMemory(state));
    const result = runJourney(runtime, { maxWallMs: 0, now: () => 0 });
    expect(result.outcome.status).toBe('INCOMPLETE');
    expect(result.outcome.reason).toMatch(/resource guard/);
    expect(JOURNEY_RESOURCE_MS).toBe(1_800_000);
  });
});
