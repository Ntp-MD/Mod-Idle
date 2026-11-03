import { describe, expect, it } from 'vitest';
import { captureCombatArena, createCombatArena, syncCombatArena, arenaAction } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, tick } from '@sim/core/game';
import { isBossKind } from '@sim/core/game';

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
  it('keeps released field work when the Boss joins and advances the field epoch', () => {    const { state, arena } = bossFight();
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
    // A Boss joining the field is a new epoch, not a reason to cancel a committed press.
    expect(arena.actions.find((entry) => entry.id === action.id)?.cancelReason).toBeUndefined();
    expect(arena.flights.some((flight) => flight.actionId === action.id)).toBe(true);
    expect(state.field!.arenaEpoch).toBeGreaterThan(epoch);
    // The population is already there; the Boss is one of its slots, not the whole field.
    expect(state.group.length).toBeGreaterThan(1);
  });

  it('keeps released work when the Boss dies and the field continues', () => {
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
    // The Boss's death settles its own epoch; another body's committed press keeps running.
    expect(arena.actions.find((entry) => entry.id === action.id)?.cancelReason).toBeUndefined();
    expect(state.field!.arenaEpoch).toBeGreaterThan(epoch);
    // The field, its authored homes and the farming anchor survive the Boss arena.
    expect(state.field!.slots.map((slot) => `${slot.id}:${slot.home.x},${slot.home.y}`)).toEqual(homes);
    expect(Number.isFinite(state.field!.farmingAnchor.x)).toBe(true);
    expect(Number.isFinite(state.field!.farmingAnchor.y)).toBe(true);
  });
});
