import { describe, expect, it } from 'vitest';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { newGame } from '@sim/core/game';

describe('P7 arena resync — a rewind starts a new generation', () => {
  it('drops released work when the clock jumps backwards', () => {
    const state = newGame(5);
    const arena = createCombatArena();
    syncCombatArena(arena, state, 80_000_000, 1_000_000, 100);
    arena.intent = {
      skillId: 'attack.fireball', targetId: 'mob', targetPoint: { x: 1, y: 1 }, phase: 'windup',
    } as never;
    arena.flights.push({ actionId: 1 } as never);

    syncCombatArena(arena, state, 3_000_000, 1_000_000, 100);

    expect(arena.nowUs).toBe(3_000_000);
    expect(arena.flights).toHaveLength(0);
    expect(arena.intent).toBeUndefined();
  });

  it('keeps released work across a forward step inside one movement sample', () => {
    const state = newGame(5);
    const arena = createCombatArena();
    syncCombatArena(arena, state, 1_000_000, 1_000_000, 100);
    arena.flights.push({ actionId: 1 } as never);

    syncCombatArena(arena, state, 1_040_000, 1_000_000, 100);

    expect(arena.flights).toHaveLength(1);
  });
});
