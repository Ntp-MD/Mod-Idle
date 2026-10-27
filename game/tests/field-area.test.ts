import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/client-helpers';
import { spawns } from '../src/engine/client';
import { arenaDistance, captureCombatArena, createCombatArena, syncCombatArena } from '../src/sim/combat/combat-arena';
import { fieldAreaKey, normalizeFieldState, releaseSpawnSlot, restoreFieldPositions, syncFieldState } from '../src/sim/world/field-area';
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
  pinFieldPopulation(state, count, new Map(state.group.map((mob) => [mob.id, arena.mobs[mob.id]])));
  return { state, arena };
}

describe('field population registry', () => {
  it('resolves the same assist chain regardless of the living-body queue order', () => {
    const first = fieldFight(3);
    first.state.group.forEach((mob, index) => {
      const point = { x: 4.9 + index * 2.9, y: 6 };
      Object.assign(first.arena.mobs[mob.id], point);
      first.state.field!.slots[index].home = point;
    });
    first.state.playerStatuses.shock = { stacks: 1, secLeft: 3, perSec: 0 };
    const second = structuredClone(first);
    second.state.group.reverse();
    for (const { state, arena } of [first, second]) tick(state, { arena, autoSkills: false });
    expect([...second.state.field!.engagementIds].sort()).toEqual([...first.state.field!.engagementIds].sort());
  });

  it.each([false, true])('drops a body beyond its home leash despite nearby aggro or a held target (%s)', heldTarget => {
    const { state, arena } = fieldFight(1);
    const mob = state.group[0];
    state.field!.slots[0].home = { x: 1, y: 6 };
    state.field!.engagementIds = [mob.id];
    Object.assign(arena.player, { x: 13, y: 6 });
    Object.assign(arena.mobs[mob.id], { x: 12, y: 6 });
    state.playerStatuses.shock = { stacks: 1, secLeft: 3, perSec: 0 };
    mob.hp = mob.hpMax / 2;
    if (heldTarget) arena.intent = { skillId: 'attack.firestorm', targetId: mob.id,
      targetPoint: { x: 12, y: 6 }, phase: 'approach' };
    tick(state, { arena, autoSkills: false });
    expect(state.field!.engagementIds).not.toContain(mob.id);
    expect(mob.hp).toBe(mob.hpMax);
    expect(state.fx.filter(event => event.kind === 'taken' && event.byId === mob.id)).toHaveLength(0);
    expect(arena.mobs[mob.id].x).toBeLessThan(12);
  });

  it('schedules a target selected after the initial engagement snapshot', () => {
    const { state, arena } = fieldFight(1);
    const mob = state.group[0];
    Object.assign(mob, { line: 'stand-off' });
    Object.assign(arena.mobs[mob.id], { x: 7, y: 6 });
    state.field!.slots[0].home = { x: 7, y: 6 };
    state.field!.engagementIds = [];
    expect(arenaDistance(arena.player, arena.mobs[mob.id])).toBeGreaterThan(4);
    tick(state, { arena, autoSkills: true, manual: { cast: { skillId: 'attack.firestorm' } } });
    expect(state.field!.engagementIds).toContain(mob.id);
    const action = arena.actions.find((entry) => entry.actorId === mob.id && entry.kind === 'swing');
    expect(action?.timing).toBeDefined();
    expect(action!.timing!.startedAtUs).toBeLessThanOrEqual(1_000_000);
  });

  it('admits a body that enters aggro at a movement sample and schedules from that moment', () => {
    const { state, arena } = fieldFight(1);
    const mob = state.group[0];
    Object.assign(mob, { line: 'stand-off', atkTimer: 0.8, hitsPerSec: 1 });
    Object.assign(arena.mobs[mob.id], { x: 6, y: 6 });
    state.field!.slots[0].home = { x: 6, y: 6 };
    state.field!.engagementIds = [];
    tick(state, { arena, autoSkills: false, manual: { moveTo: { x: 4, y: 6 } } });
    expect(state.field!.engagementIds).toContain(mob.id);
    const action = arena.actions.find((entry) => entry.actorId === mob.id && entry.timing);
    expect(action).toBeDefined();
    // The plan starts after the player actually crossed the aggro line, not at tick start.
    expect(action!.timing!.startedAtUs).toBeGreaterThan(0);
    expect(action!.timing!.startedAtUs).toBeLessThan(1_000_000);
  });

  it('keeps a returning body untargetable until it reaches its home band', () => {
    const { state, arena } = fieldFight(1);
    const mob = state.group[0];
    const home = { x: 2, y: 6 };
    state.field!.slots[0].home = home;
    Object.assign(arena.mobs[mob.id], { x: 12, y: 6 });
    Object.assign(arena.player, { x: 13, y: 6 });
    state.field!.engagementIds = [mob.id];
    mob.hp = mob.hpMax / 2;
    state.mobStatus[mob.id] = { statuses: { burn: { stacks: 1, secLeft: 3, perSec: 10 } },
      alignedPerSec: 0, elapsedSec: 0, stoppedSec: 0 };

    tick(state, { arena, autoSkills: false });
    expect(state.field!.engagementIds).not.toContain(mob.id);
    expect(arena.mobs[mob.id].returning).toBe(true);
    expect(state.field!.actors.find((actor) => actor.id === mob.id)?.returning).toBe(true);
    expect(mob.hp).toBe(mob.hpMax);
    expect(state.mobStatus[mob.id]).toBeUndefined();

    // The reset belongs to the transition; later returning frames do not refill the pool again.
    mob.hp = mob.hpMax / 2;
    arena.focusId = mob.id;
    tick(state, { arena, autoSkills: false });
    expect(mob.hp).toBe(mob.hpMax / 2);
    expect(arena.focusId).toBeUndefined();
    expect(state.log.some((line) => /returning home/.test(line.text))).toBe(true);
    expect(state.fx.filter((event) => event.kind === 'hit' && event.mobId === mob.id)).toHaveLength(0);

    let clearedAt = -1;
    let clearedDistance = Infinity;
    for (let index = 0; index < 12; index++) {
      tick(state, { arena, autoSkills: false });
      if (!arena.mobs[mob.id].returning) {
        clearedAt = index;
        clearedDistance = arenaDistance(arena.mobs[mob.id], home);
        break;
      }
    }
    expect(clearedAt).toBeGreaterThanOrEqual(0);
    expect(clearedDistance).toBeLessThanOrEqual(0.35 + 1e-6);
    for (let index = 0; index < 3; index++) tick(state, { arena, autoSkills: false });
    expect(arena.mobs[mob.id].returning).toBe(false);
  });

  it('does not let a stale engagement id cancel an in-progress return', () => {
    const { state, arena } = fieldFight(1);
    const mob = state.group[0];
    Object.assign(arena.mobs[mob.id], { x: 12, y: 6, returning: true });
    Object.assign(arena.player, { x: 13, y: 6 });
    state.field!.slots[0].home = { x: 2, y: 6 };
    state.field!.engagementIds = [mob.id];
    mob.hp = mob.hpMax / 2;
    tick(state, { arena, autoSkills: false });
    expect(state.field!.engagementIds).not.toContain(mob.id);
    expect(arena.mobs[mob.id].returning).toBe(true);
    expect(mob.hp).toBe(mob.hpMax);
  });

  it('round-trips the returning flag through the saved field actors', () => {
    const { state, arena } = fieldFight(1);
    const mob = state.group[0];
    arena.mobs[mob.id].returning = true;
    syncFieldState(state, arena, 2, false);
    expect(state.field!.actors.find((actor) => actor.id === mob.id)?.returning).toBe(true);
    const loaded = importJson(exportJson(state));
    expect(loaded.field!.actors.find((actor) => actor.id === mob.id)?.returning).toBe(true);
    const fresh = createCombatArena();
    syncCombatArena(fresh, loaded, loaded.clockSec * 1_000_000, 1_000_000, characterSheet(loaded).maxHp);
    restoreFieldPositions(fresh, loaded);
    expect(fresh.mobs[mob.id].returning).toBe(true);
  });

  it('cancels an unpaid mob preparation when the body leaves its leash mid-tick', () => {
    const { state, arena } = fieldFight(1);
    const mob = state.group[0];
    Object.assign(mob, {
      line: 'stand-off', hitsPerSec: 2, atkTimer: 0,
      skillIds: ['mob.poison.venom-spit'], skillReadyAtUs: {},
    });
    state.field!.slots[0].home = { x: 0.5, y: 6 };
    Object.assign(arena.player, { x: 7.5, y: 6 });
    Object.assign(arena.mobs[mob.id], { x: 8.5, y: 6 });
    tick(state, { arena, autoSkills: false, manual: { moveTo: { x: 17, y: 6 } } });
    const action = arena.actions.find((entry) => entry.actorId === mob.id && entry.kind === 'cast');
    expect(action).toBeDefined();
    expect(action!.releasedAtUs).toBeUndefined();
    expect(action!.cancelReason).toBe('disengaged');
    expect(state.fx.filter((event) => event.kind === 'taken' && event.byId === mob.id)).toHaveLength(0);
    expect(mob.skillReadyAtUs?.['mob.poison.venom-spit']).toBeUndefined();
    expect(arena.mobs[mob.id].returning).toBe(true);
  });

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

  it('preserves a fractional respawn deadline through save normalization', () => {
    const normalized = normalizeFieldState({
      areaKey: 'x', arenaEpoch: 1, farmingAnchor: { x: 0, y: 0 }, player: { x: 0, y: 0 },
      slots: [{ id: 's', pointId: 'p', home: { x: 1, y: 1 }, roamM: 1, respawnAtSec: 12.345, respawnCount: 0 }],
      actors: [], engagementIds: [], combatSessionId: 0, sessionActive: false, quietSec: 0,
    });
    expect(normalized?.slots[0].respawnAtSec).toBeCloseTo(12.345);
  });

  it('translates a legacy 18x12 field once into the 50 m arena', () => {
    const raw = {
      areaKey: 'x', layoutRevision: 1, arenaEpoch: 1, farmingAnchor: { x: 1, y: 1 }, player: { x: 1, y: 1 },
      slots: [{ id: 's', pointId: 'p', home: { x: 1, y: 1 }, roamM: 1, respawnAtSec: 5, respawnCount: 0 }],
      actors: [{ id: 'a', x: 1, y: 1 }], engagementIds: [], combatSessionId: 0, sessionActive: false, quietSec: 0,
    };
    const once = normalizeFieldState(raw)!;
    expect(once.layoutRevision).toBe(2);
    expect(once.player).toEqual({ x: 17, y: 11.0256 });
    expect(once.farmingAnchor).toEqual({ x: 17, y: 11.0256 });
    expect(once.slots[0].home).toEqual({ x: 17, y: 11.0256 });
    expect(once.actors[0]).toMatchObject({ x: 17, y: 11.0256 });
    const twice = normalizeFieldState(once)!;
    expect(twice.player).toEqual(once.player);
    expect(twice.slots[0].home).toEqual(once.slots[0].home);
  });

  it('reconstitutes an archived field life with the same identity and HP, without a reward', () => {
    const { state, arena } = fieldFight(2);
    tick(state, { arena, autoSkills: false });
    const mob = state.group[0];
    mob.hp = 123;
    state.mobStatus[mob.id] = { statuses: {}, alignedPerSec: 0, stoppedSec: 0, elapsedSec: 0 };
    const id = mob.id;
    const species = mob.species;
    const home = state.cell ? { ...state.cell } : { q: 0, r: 0, sub: null, wild: null };
    const kills = state.counters.kills;
    state.cell = { q: 4, r: 4, sub: null, wild: null };
    syncFieldState(state);
    state.group = [];
    state.cell = home;
    syncFieldState(state);
    const restored = state.group.find((entry) => entry.id === id);
    expect(restored?.species).toBe(species);
    expect(restored?.hp).toBe(123);
    expect(restored?.spawnSlotId).toBeDefined();
    expect(state.mobStatus[id]).toBeDefined();
    expect(state.counters.kills).toBe(kills);
  });

  it('draws a deterministic respawn window from slot identity', () => {
    const first = fieldFight(2);
    const second = fieldFight(2);
    tick(first.state, { arena: first.arena, autoSkills: false });
    tick(second.state, { arena: second.arena, autoSkills: false });
    const mob = first.state.group[0];
    expect(releaseSpawnSlot(first.state, mob)).toBe(true);
    expect(releaseSpawnSlot(second.state, structuredClone(second.state.group[0]))).toBe(true);
    const slot = first.state.field!.slots.find((entry) => entry.id === mob.spawnSlotId)!;
    const twin = second.state.field!.slots.find((entry) => entry.id === second.state.group[0].spawnSlotId)!;
    expect(slot.respawnAtSec).toBeCloseTo(twin.respawnAtSec);
    const profile = spawns.profileFor(first.state.zone, first.state.cell?.sub ?? null);
    expect(slot.respawnAtSec - first.state.clockSec).toBeGreaterThanOrEqual(profile.respawn_min_sec - 1e-9);
    expect(slot.respawnAtSec - first.state.clockSec).toBeLessThanOrEqual(profile.respawn_max_sec + 1e-9);
  });
});
