import { describe, expect, it } from 'vitest';
import { seededEncounter } from '../fixtures/encounter';

/** Deterministic packs of a fixed body count, measured by how long the pack takes to clear. */
function clearTime(limit: number, cap = 120) {
  const encounter = seededEncounter({ seed: 91, bodies: 4, zone: 1 });
  if (encounter.state.field) {
    encounter.state.field.slots.length = limit;
    encounter.state.group = [];
    encounter.run(1);
  }
  const start = { kills: encounter.state.counters.kills, xp: encounter.state.player.xp };
  let ticks = 0;
  while (encounter.state.counters.kills - start.kills < limit && ticks < cap) {
    encounter.run(1);
    ticks++;
  }
  return {
    limit,
    ticks,
    cleared: encounter.state.counters.kills - start.kills,
    xp: encounter.state.player.xp - start.xp,
    alive: encounter.state.group.filter((mob) => mob.hp > 0).length,
  };
}

describe('P5 density baseline — clear time per pack size', () => {
  it('clears a small pack faster than a large one from the same seed', () => {
    const sparse = clearTime(3);
    const dense = clearTime(16);
    console.log(`[density] sparse=${JSON.stringify(sparse)} dense=${JSON.stringify(dense)}`);
    expect(sparse.cleared).toBe(3);
    expect(sparse.ticks).toBeLessThan(dense.ticks);
    expect(dense.cleared).toBeGreaterThan(sparse.cleared);
  });
});
