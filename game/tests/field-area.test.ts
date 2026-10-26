import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/client-helpers';
import { captureCombatArena, createCombatArena, syncCombatArena } from '../src/sim/combat/combat-arena';
import { fieldAreaKey, releaseSpawnSlot, restoreFieldPositions } from '../src/sim/world/field-area';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '../src/sim/core/game';
import { exportJson, importJson, migrate, SCHEMA_VERSION } from '../src/state/save';
import { pinFieldPopulation } from './mobFixture';

function fieldFight(count = 3) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  state.group = Array.from({ length: count }, (_, index) => {
    const mob = spawnMob(mulberry32(23 + index), 1, 'normal');
    Object.assign(mob, {
      id: `field-${index}`, hp: 1e8, hpMax: 1e8, ps: 1, evasion: 0, dodgeRate: 0,
      armour: 0, line: index === 0 ? 'front' : 'stand-off', damage: 'physical', innate: [], skillIds: [],
    });
    return mob;
  });
  state.skills.list.fill(null);
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  state.group.forEach((mob, index) => Object.assign(arena.mobs[mob.id], { x: 3 + index, y: 6 }));
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state, count);
  return { state, arena };
}

describe('field population registry', () => {
  it('owns one slot per living body and records engagement without copying HP', () => {
    const { state, arena } = fieldFight();
    tick(state, { arena, autoSkills: false });
    const field = state.field!;
    expect(field.areaKey).toBe(fieldAreaKey(state));
    expect(field.slots).toHaveLength(3);
    expect(field.slots.map((slot) => slot.mobId).sort()).toEqual(state.group.map((mob) => mob.id).sort());
    expect(state.group.every((mob) => !!mob.spawnSlotId)).toBe(true);
    expect(field).not.toHaveProperty('hp');
    expect(field.engagementIds).toEqual(state.group.map((mob) => mob.id));
    expect(field.sessionActive).toBe(true);
    expect(field.combatSessionId).toBe(1);
    expect(field.player).toEqual({ x: arena.player.x, y: arena.player.y });
    expect(field.actors).toHaveLength(3);
  });

  it('returns a dead body to its own slot timer and refills only when due', () => {
    const { state, arena } = fieldFight(2);
    tick(state, { arena, autoSkills: false });
    const removed = state.group[0];
    const slot = state.field!.slots.find((entry) => entry.id === removed.spawnSlotId)!;
    const oldId = removed.id;
    state.group = state.group.filter((mob) => mob.id !== removed.id);
    expect(releaseSpawnSlot(state, removed)).toBe(true);
    expect(slot.mobId).toBeUndefined();
    expect(slot.respawnAtSec).toBeGreaterThan(state.clockSec);
    expect(slot.respawnCount).toBe(1);
    state.clockSec = slot.respawnAtSec - 1;
    tick(state, { arena, autoSkills: false });
    expect(slot.mobId).toBeDefined();
    expect(slot.mobId).not.toBe(oldId);
    expect(slot.respawnCount).toBe(2);
    expect(state.group.some((mob) => mob.id === slot.mobId)).toBe(true);
  });

  it('archives the field slots and restores the same homes on return', () => {
    const { state, arena } = fieldFight(2);
    tick(state, { arena, autoSkills: false });
    const home = state.cell ? { ...state.cell } : { q: 0, r: 0, sub: null, wild: null };
    const oldKey = fieldAreaKey(state);
    const homes = state.field!.slots.map((slot) => `${slot.id}:${slot.home.x},${slot.home.y}`);
    state.group = [];
    state.cell = { q: 4, r: 4, sub: null, wild: null };
    tick(state, { arena, autoSkills: false });
    expect(fieldAreaKey(state)).not.toBe(oldKey);
    const archived = state.fieldArchive?.[oldKey];
    expect(archived).toBeDefined();
    expect(archived!.slots.map((slot) => `${slot.id}:${slot.home.x},${slot.home.y}`)).toEqual(homes);
    state.group = [];
    state.cell = home;
    tick(state, { arena, autoSkills: false });
    expect(fieldAreaKey(state)).toBe(oldKey);
    expect(state.field!.slots.map((slot) => `${slot.id}:${slot.home.x},${slot.home.y}`)).toEqual(homes);
  });

  it('round-trips slots and positions through a save; a v25 field opens with slots to seed', () => {
    const { state, arena } = fieldFight(2);
    tick(state, { arena, autoSkills: false });
    const loaded = importJson(exportJson(state));
    expect(loaded.field?.slots).toHaveLength(2);
    expect(loaded.field?.actors).toEqual(state.field!.actors);
    const fresh = createCombatArena();
    syncCombatArena(fresh, loaded, loaded.clockSec * 1_000_000, 1_000_000, characterSheet(loaded).maxHp);
    restoreFieldPositions(fresh, loaded);
    expect(fresh.player.x).toBeCloseTo(state.field!.player.x);
    expect(fresh.mobs[state.group[0].id].x).toBeCloseTo(state.field!.actors[0].x);

    const legacy = JSON.parse(JSON.stringify(state));
    legacy.field = {
      areaKey: state.field!.areaKey, arenaEpoch: state.field!.arenaEpoch,
      nextUnitSeq: 1, spawnUnits: [], idleUnits: [], engagementIds: [],
      combatSessionId: 0, sessionActive: false, quietSec: 0,
      farmingAnchor: state.field!.farmingAnchor, player: state.field!.player, actors: state.field!.actors,
    };
    const migrated = migrate(legacy, 25);
    expect(migrated.field?.slots).toEqual([]);
    expect(migrated.field?.areaKey).toBe(state.field!.areaKey);
    const bad = JSON.parse(JSON.stringify(state));
    bad.field = { areaKey: 'x', arenaEpoch: 1 };
    expect(migrate(bad, SCHEMA_VERSION).field).toBeNull();
  });
});
