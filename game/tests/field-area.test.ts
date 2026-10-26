import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/client-helpers';
import { captureCombatArena, createCombatArena, syncCombatArena } from '../src/sim/combat-arena';
import { fieldAreaKey, restoreFieldPositions } from '../src/sim/field-area';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '../src/sim/game';
import { exportJson, importJson, migrate, SCHEMA_VERSION } from '../src/state/save';

function fieldFight(count = 3) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  state.spawnIn = 999;
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
  return { state, arena };
}

describe('field registry', () => {
  it('records one spawn unit and a combat session without copying HP', () => {
    const { state, arena } = fieldFight();
    tick(state, { arena, autoSkills: false });
    const field = state.field!;
    expect(field.areaKey).toBe(fieldAreaKey(state));
    expect(field.spawnUnits).toHaveLength(1);
    expect(field.spawnUnits[0]).toMatchObject({
      id: 'u1', cohortId: `${field.arenaEpoch}-u1`, actorIds: state.group.map((mob) => mob.id),
    });
    expect(field).not.toHaveProperty('hp');
    expect(field.engagementIds).toEqual(state.group.slice(0, 3).map((mob) => mob.id));
    expect(field.sessionActive).toBe(true);
    expect(field.combatSessionId).toBe(1);
    expect(field.player).toEqual({ x: arena.player.x, y: arena.player.y });
    expect(field.actors).toHaveLength(3);
    expect(field.idleUnits).toHaveLength(1);
    const idleId = field.idleUnits[0].mobs[0].id;
    expect(state.group.some((mob) => mob.id === idleId)).toBe(false);
    expect(arena.mobs[idleId]).toBeDefined();
    expect(arena.mobs[idleId].x).toBeCloseTo(field.idleUnits[0].home.x);
  });

  it('promotes the visible unit into the next engagement and respawns its slot on its own timer', () => {
    const { state, arena } = fieldFight(1);
    tick(state, { arena, autoSkills: false });
    const idle = state.field!.idleUnits[0];
    const idleIds = idle.mobs.map((mob) => mob.id);
    state.spawnIn = 0;
    for (const mob of state.group) mob.hp = 0;
    tick(state, { arena, autoSkills: false });
    // A normal spawn opportunity promotes the visible unit; an Elite roll keeps its own wave and the
    // idle unit waits, so retry until the normal opportunity arrives.
    let promoted = false;
    const wanted = [...idleIds].sort().join(',');
    const groupKey = () => [...state.group.map((mob) => mob.id)].sort().join(',');
    for (let attempt = 0; attempt < 40 && !promoted; attempt++) {
      if (groupKey() === wanted) { promoted = true; break; }
      if (state.group.length) state.group = [];
      state.spawnIn = 0;
      tick(state, { arena, autoSkills: false });
      if (groupKey() === wanted) promoted = true;
    }
    expect(promoted).toBe(true);
    expect(state.field!.activeUnitId).toBe(idle.id);
    expect(state.field!.idleUnits).toHaveLength(0);
    expect(state.field!.spawnUnits.at(-1)!.cohortId).toBe(idle.cohortId);
    state.field!.nextIdleAtSec = 0;
    tick(state, { arena, autoSkills: false });
    expect(state.field!.idleUnits).toHaveLength(1);
    expect(state.field!.idleUnits[0].id).not.toBe(idle.id);
  });

  it('keeps the same cohort while it lives and completes it once after the clear', () => {
    const { state, arena } = fieldFight();
    tick(state, { arena, autoSkills: false });
    const cohort = state.field!.spawnUnits[0].cohortId;
    state.group[0].hp = 0;
    tick(state, { arena, autoSkills: false });
    expect(state.field!.spawnUnits[0].cohortId).toBe(cohort);
    expect(state.field!.engagementIds).toHaveLength(2);
    for (const mob of state.group) mob.hp = 0;
    tick(state, { arena, autoSkills: false });
    expect(state.field!.activeUnitId).toBeUndefined();
    expect(state.field!.spawnUnits[0].clearedAtSec).toBeDefined();
    expect(state.field!.spawnUnits[0].nextSpawnAtSec).toBeGreaterThan(state.field!.spawnUnits[0].clearedAtSec!);
    expect(state.field!.quietSec).toBe(1);
    tick(state, { arena, autoSkills: false });
    expect(state.field!.sessionActive).toBe(false);
    expect(state.field!.combatSessionId).toBe(1);
  });

  it('starts a new unit and session when a fresh wave appears', () => {
    const { state, arena } = fieldFight(1);
    tick(state, { arena, autoSkills: false });
    for (const mob of state.group) mob.hp = 0;
    tick(state, { arena, autoSkills: false });
    tick(state, { arena, autoSkills: false });
    const fresh = spawnMob(mulberry32(99), 1, 'normal');
    Object.assign(fresh, { id: 'fresh', hp: 1e8, hpMax: 1e8, ps: 1, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [] });
    state.group = [fresh];
    syncCombatArena(arena, state, playerTime(state), 1_000_000, characterSheet(state).maxHp);
    tick(state, { arena, autoSkills: false });
    const field = state.field!;
    const active = field.spawnUnits.at(-1)!;
    expect(active.id).toBe(field.activeUnitId);
    expect(active.id).not.toBe('u1');
    expect(active.cohortId).toBe(`${field.arenaEpoch}-${active.id}`);
    expect(field.combatSessionId).toBe(2);
    expect(field.sessionActive).toBe(true);
    expect(field.idleUnits).toHaveLength(1);
    expect(field.idleUnits[0].mobs.map((mob) => mob.id)).not.toContain(active.actorIds[0]);
  });

  it('starts a new epoch when the standing area changes', () => {
    const { state, arena } = fieldFight(1);
    tick(state, { arena, autoSkills: false });
    const epoch = state.field!.arenaEpoch;
    state.cell = { q: 4, r: 4, sub: null, wild: null };
    tick(state, { arena, autoSkills: false });
    expect(state.field!.arenaEpoch).toBe(epoch + 1);
    expect(state.field!.spawnUnits).toHaveLength(1);
    expect(state.field!.combatSessionId).toBe(1);
  });

  it('archives a visited field and restores its spawn/idle identities without reroll', () => {
    const { state, arena } = fieldFight(1);
    const home = state.cell ? { ...state.cell } : { q: 0, r: 0, sub: null, wild: null };
    tick(state, { arena, autoSkills: false });
    const oldKey = fieldAreaKey(state);
    const idleIds = state.field!.idleUnits.flatMap((unit) => unit.mobs.map((mob) => mob.id)).sort();
    state.cell = { q: 4, r: 4, sub: null, wild: null };
    tick(state, { arena, autoSkills: false });
    expect(fieldAreaKey(state)).not.toBe(oldKey);
    const archived = state.fieldArchive?.[oldKey];
    expect(archived).toBeDefined();
    expect(archived!.idleUnits.flatMap((unit) => unit.mobs.map((mob) => mob.id)).sort()).toEqual(idleIds);

    const loaded = importJson(exportJson(state));
    expect(loaded.fieldArchive?.[oldKey]?.idleUnits.length).toBe(archived!.idleUnits.length);
    const old = JSON.parse(JSON.stringify(state));
    delete old.fieldArchive;
    expect(migrate(old, 24).fieldArchive).toEqual({});

    state.cell = home;
    tick(state, { arena, autoSkills: false });
    expect(fieldAreaKey(state)).toBe(oldKey);
    expect(state.field!.idleUnits.flatMap((unit) => unit.mobs.map((mob) => mob.id)).sort()).toEqual(idleIds);
  });

  it('round-trips the registry and positions through a save; older saves open without one', () => {
    const { state, arena } = fieldFight();
    tick(state, { arena, autoSkills: false });
    const loaded = importJson(exportJson(state));
    expect(loaded.field?.spawnUnits).toHaveLength(1);
    expect(loaded.field?.idleUnits).toHaveLength(1);
    expect(loaded.field?.idleUnits[0].mobs.map((mob) => mob.id))
      .toEqual(state.field!.idleUnits[0].mobs.map((mob) => mob.id));
    expect(loaded.field?.actors).toEqual(state.field!.actors);
    const fresh = createCombatArena();
    syncCombatArena(fresh, loaded, loaded.clockSec * 1_000_000, 1_000_000, characterSheet(loaded).maxHp);
    restoreFieldPositions(fresh, loaded);
    expect(fresh.player.x).toBeCloseTo(state.field!.player.x);
    expect(fresh.mobs[state.group[0].id].x).toBeCloseTo(state.field!.actors[0].x);

    const old = JSON.parse(JSON.stringify(state));
    delete old.field;
    expect(migrate(old, 23).field).toBeNull();
    const bad = JSON.parse(JSON.stringify(state));
    bad.field = { areaKey: 'x', arenaEpoch: 1 };
    expect(migrate(bad, SCHEMA_VERSION).field).toBeNull();
  });
});

const playerTime = (state: ReturnType<typeof newGame>) => state.clockSec * 1_000_000;
