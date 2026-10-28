import { describe, expect, it } from 'vitest';
import { schedulerBatch, WAKE_SEC } from '@sim/core/game';
import { seededEncounter } from '../fixtures/encounter';

const COMMAND_AT_WALL_SEC = 0.25;
const BUDGET_SEC = 0.1;

/**
 * Drives the shipped loop cadence (wake every 250 ms, whole-second ticks) and reports how long a
 * command issued between ticks waits before the sim judges it. No browser: this is the same
 * scheduler and the same tick the live loop calls.
 */
function measureCommandLatency(): number {
  const encounter = seededEncounter({ seed: 61, bodies: 4 });
  encounter.run(1);
  const player = { ...encounter.arena.player };
  let acc = 0;
  let ticks = 0;
  // each world tick owns one simulated second, and a wake is 250 ms, so tick N lands at wall N s
  const wallOfTick = (index: number) => index * WAKE_SEC * 4;

  for (let wake = 1; wake <= 8; wake++) {
    const batch = schedulerBatch(acc, 1, WAKE_SEC);
    acc = batch.acc;
    for (let i = 0; i < batch.ticks; i++) {
      const manual = ticks === 0
        ? { moveTo: { x: player.x, y: player.y + 3 } }
        : undefined;
      encounter.run(1, manual ? { tick: 0, manual } : undefined);
      ticks++;
      const receipt = encounter.state.combatReceipts?.find((entry) => entry.command === 'move');
      if (receipt) return wallOfTick(ticks) - COMMAND_AT_WALL_SEC;
    }
  }
  throw new Error('the move command was never consumed');
}

describe('P1 acceptance — command latency', () => {
  it('reports what the current loop cadence costs', () => {
    const latency = measureCommandLatency();
    console.log(`[P1 latency] command @${COMMAND_AT_WALL_SEC}s -> judged +${(latency * 1000).toFixed(0)} ms (budget ${BUDGET_SEC * 1000} ms)`);
    expect(latency).toBeGreaterThan(0);
  });

  // F01: until combat advances between world ticks, a command waits for the next whole second.
  it.fails('judges a command within the 100 ms budget', () => {
    expect(measureCommandLatency()).toBeLessThanOrEqual(BUDGET_SEC);
  });
});
