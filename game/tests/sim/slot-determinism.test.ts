import { describe, expect, it } from 'vitest';
import { spawns } from '../../src/engine/client';
import { spawnSlotSeed } from '@engine/spawns.ts';
import { createFieldState, fieldAreaKey, releaseSpawnSlot } from '@sim/world/field-area';
import { newGame } from '@sim/core/game';
import { mobFixture } from '../fixtures/mobFixture';

/** P9 SP2 — one deterministic slot seed serves the field and the dungeon door it shares a key with. */
describe('slot determinism', () => {
  it('resolves the same authored slot list on every read', () => {
    const first = createFieldState({ zone: 1, cell: null, dungeon: null, clockSec: 0 });
    const second = createFieldState({ zone: 1, cell: null, dungeon: null, clockSec: 0 });
    expect(second).toEqual(first);
    expect(new Set(first.slots.map((slot) => slot.id)).size).toBe(first.slots.length);
  });

  it('separates field and dungeon keys while keeping each seed stable', () => {
    const cell = { q: 1, r: 2, sub: 0, wild: 0 };
    const field = fieldAreaKey({ zone: 1, cell, dungeon: null });
    const run = fieldAreaKey({ zone: 1, cell, dungeon: { zone: 1 } as never });
    expect(run).not.toBe(field);
    expect(run.endsWith('|dungeon:1')).toBe(true);
    expect(spawnSlotSeed(9, field, 's1', 0)).toBe(spawnSlotSeed(9, field, 's1', 0));
    expect(spawnSlotSeed(9, run, 's1', 0)).not.toBe(spawnSlotSeed(9, field, 's1', 0));
  });

  it('rolls the same respawn window for the same saved slot state', () => {
    const fight = () => {
      const state = newGame(90210);
      state.clockSec = 100;
      state.field = createFieldState(state);
      const slot = state.field.slots[0];
      const mob = mobFixture({ id: 'slot-mob', spawnSlotId: slot.id });
      slot.mobId = mob.id;
      slot.respawnCount = 3;
      expect(releaseSpawnSlot(state, mob)).toBe(true);
      return state.field.slots[0].respawnAtSec;
    };
    const first = fight();
    expect(fight()).toBe(first);
    const profile = spawns.profileFor(1, null);
    expect(first).toBeGreaterThanOrEqual(100 + profile.respawn_min_sec);
    expect(first).toBeLessThanOrEqual(100 + profile.respawn_max_sec + 1e-9);
  });
});
