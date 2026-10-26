import { describe, expect, it } from 'vitest';
import { captureCombatArena, createCombatArena, syncCombatArena, arenaAction } from '../src/sim/combat-arena';
import { characterSheet, newGame, setLevel, tick } from '../src/sim/game';

function bossFight() {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  state.spawnIn = 0;
  state.group = [];
  state.bossDueAt = -1;
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  captureCombatArena(arena, state, 0);
  return { state, arena };
}

describe('Boss local arena epoch', () => {
  it('settles old field work before the Boss and advances the field epoch', () => {
    const { state, arena } = bossFight();
    const timing = { delivery: 'instant' as const, startedAtUs: 0, releaseAtUs: 0,
      impactAtUs: 10_000_000, recoveryUntilUs: 0 };
    const action = arenaAction(arena, 'player', 'cast', 0, undefined, 'attack.firestorm', undefined, timing)!;
    arena.flights.push({
      actionId: action.id, cast: { id: 'attack.firestorm', manaCost: 0, hpCost: 0, level: 1,
        cooldownSec: 0, spatial: true, targets: [] },
      character: characterSheet(state), modifiers: {}, profile: {
        delivery: 'instant', range_m: 0, windup_sec: 0, recovery_sec: 0, impact_delay_sec: 0,
        projectile_speed_mps: 0, hit_radius_m: 0.5,
      }, timing, source: { x: 1, y: 6 }, destination: { x: 1, y: 6 },
      area: undefined, position: { x: 1, y: 6 }, lastCheckedAtUs: 0,
    });
    const epoch = state.field?.arenaEpoch ?? 0;
    tick(state, { arena });
    expect(state.group[0]?.kind.startsWith('Boss')).toBe(true);
    expect(arena.actions.find((entry) => entry.id === action.id)?.cancelReason).toBe('boss-arena');
    expect(state.field!.arenaEpoch).toBeGreaterThanOrEqual(epoch);
  });

  it('settles remaining work when the Boss dies and returns to the checkpointed field', () => {
    const { state, arena } = bossFight();
    tick(state, { arena });
    expect(state.group[0]?.kind.startsWith('Boss')).toBe(true);
    const epoch = state.field!.arenaEpoch;
    const anchor = { ...state.field!.farmingAnchor };
    const idleIds = state.field!.idleUnits.flatMap((unit) => unit.mobs.map((mob) => mob.id)).sort();
    const timing = { delivery: 'instant' as const, startedAtUs: 1_000_000, releaseAtUs: 1_000_000,
      impactAtUs: 20_000_000, recoveryUntilUs: 1_000_000 };
    const action = arenaAction(arena, 'player', 'cast', 1_000_000, undefined, 'attack.firestorm', undefined, timing)!;
    arena.flights.push({
      actionId: action.id, cast: { id: 'attack.firestorm', manaCost: 0, hpCost: 0, level: 1,
        cooldownSec: 0, spatial: true, targets: [] },
      character: characterSheet(state), modifiers: {}, profile: {
        delivery: 'instant', range_m: 0, windup_sec: 0, recovery_sec: 0, impact_delay_sec: 0,
        projectile_speed_mps: 0, hit_radius_m: 0.5,
      }, timing, source: { x: 1, y: 6 }, destination: { x: 1, y: 6 },
      area: undefined, position: { x: 1, y: 6 }, lastCheckedAtUs: 1_000_000,
    });
    state.group[0].hp = 0;
    tick(state, { arena });
    expect(state.group.length).toBe(0);
    expect(arena.actions.find((entry) => entry.id === action.id)?.cancelReason).toBe('boss-exit');
    expect(state.field!.arenaEpoch).toBeGreaterThan(epoch);
    // The field, its visible units and the farming anchor were checkpointed under the Boss arena.
    expect(state.field!.idleUnits.flatMap((unit) => unit.mobs.map((mob) => mob.id)).sort()).toEqual(idleIds);
    expect(state.field!.farmingAnchor).toEqual(anchor);
  });
});
