import { describe, expect, it } from 'vitest';
import { captureCombatArena, createCombatArena, syncCombatArena, arenaAction } from '../src/sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, tick } from '../src/sim/core/game';
import { isBossKind } from '../src/sim/core/game';

function bossFight() {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
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
    const boss = state.group.find((mob) => isBossKind(String(mob.kind)));
    expect(boss).toBeDefined();
    expect(arena.actions.find((entry) => entry.id === action.id)?.cancelReason).toBe('boss-arena');
    expect(state.field!.arenaEpoch).toBeGreaterThan(epoch);
    // The population is already there; the Boss is one of its slots, not the whole field.
    expect(state.group.length).toBeGreaterThan(1);
  });

  it('settles remaining work when the Boss dies and returns to the checkpointed field', () => {
    const { state, arena } = bossFight();
    tick(state, { arena });
    const boss = state.group.find((mob) => isBossKind(String(mob.kind)))!;
    // This test owns the Boss arena epoch, not field density: isolate the Boss and its slot.
    state.group = state.group.filter((mob) => mob.id === boss.id);
    const bossSlot = state.field!.slots.find((slot) => slot.id === boss.spawnSlotId);
    const at = { x: arena.player.x + 1.2, y: arena.player.y };
    Object.assign(arena.mobs[boss.id], at);
    if (bossSlot) state.field!.slots = [{ ...bossSlot, home: at }];
    state.field!.actors = [{ id: boss.id, ...at }];
    boss.hp = 1;
    Object.assign(arena.mobs[boss.id], { x: arena.player.x + 1.2, y: arena.player.y });
    const epoch = state.field!.arenaEpoch;
    const anchor = { ...state.field!.farmingAnchor };
    const homes = state.field!.slots.map((slot) => `${slot.id}:${slot.home.x},${slot.home.y}`);
    const timing = { delivery: 'instant' as const, startedAtUs: state.clockSec * 1_000_000,
      releaseAtUs: state.clockSec * 1_000_000, impactAtUs: 20_000_000, recoveryUntilUs: 0 };
    const action = arenaAction(arena, 'player', 'cast', state.clockSec * 1_000_000, undefined,
      'attack.firestorm', undefined, timing)!;
    arena.flights.push({
      actionId: action.id, cast: { id: 'attack.firestorm', manaCost: 0, hpCost: 0, level: 1,
        cooldownSec: 0, spatial: true, targets: [] },
      character: characterSheet(state), modifiers: {}, profile: {
        delivery: 'instant', range_m: 0, windup_sec: 0, recovery_sec: 0, impact_delay_sec: 0,
        projectile_speed_mps: 0, hit_radius_m: 0.5,
      }, timing, source: { x: 1, y: 6 }, destination: { x: 1, y: 6 },
      area: undefined, position: { x: 1, y: 6 }, lastCheckedAtUs: 0,
    });
    for (let index = 0; index < 8 && state.group.some((mob) => mob.id === boss.id && mob.hp > 0); index++)
      tick(state, { arena, autoSkills: false });
    expect(state.group.some((mob) => mob.id === boss.id && mob.hp > 0)).toBe(false);
    expect(arena.actions.find((entry) => entry.id === action.id)?.cancelReason).toBe('boss-exit');
    expect(state.field!.arenaEpoch).toBeGreaterThan(epoch);
    // The field, its authored homes and the farming anchor survive the Boss arena.
    expect(state.field!.slots.map((slot) => `${slot.id}:${slot.home.x},${slot.home.y}`)).toEqual(homes);
    expect(Number.isFinite(state.field!.farmingAnchor.x)).toBe(true);
    expect(Number.isFinite(state.field!.farmingAnchor.y)).toBe(true);
  });
});
