import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { spawns } from '../../src/engine/client';
import { arenaDistance, captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { advanceEngagement, createEngagementState } from '@sim/core/tick/engagement';
import { createFieldSlots, fieldAreaKey, normalizeFieldState, releaseSpawnSlot, restoreFieldPositions, syncFieldState } from '@sim/world/field-area';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { exportJson, importJson, migrate, SCHEMA_VERSION } from '../../src/state/save';
import { pinFieldPopulation } from '../fixtures/mobFixture';

function fieldFight(count = 3) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  state.group = Array.from({ length: count }, (_, index) => {
    const mob = spawnMob(mulberry32(23 + index), 1, 'normal');
    Object.assign(mob, {
      id: `field-${index}`, speciesId: 'wolf', hp: 1e8, hpMax: 1e8, ps: 1, evasion: 0, dodgeRate: 0,
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
  it('backfills an older saved population once without resetting its living mobs or refill timers', () => {
    const { state, arena } = fieldFight(2);
    state.field!.layoutRevision = 2;
    const saved = state.field!.slots[0];
    saved.respawnCount = 7;
    const empty = state.field!.slots[1];
    const removedId = empty.mobId;
    state.group = state.group.filter(mob => mob.id !== removedId);
    empty.mobId = undefined;
    empty.respawnAtSec = state.clockSec + 20;
    const loaded = importJson(exportJson(state));
    syncFieldState(loaded, undefined, 2, false);
    expect(loaded.field!.slots).toHaveLength(spawns.profileFor(state.zone, state.cell?.sub ?? null).cap);
    expect(loaded.field!.slots.find(slot => slot.id === saved.id)).toMatchObject({
      mobId: saved.mobId, respawnCount: saved.respawnCount, respawnAtSec: saved.respawnAtSec,
    });
    expect(loaded.field!.slots.find(slot => slot.id === empty.id)?.respawnAtSec).toBe(empty.respawnAtSec);
    expect(loaded.group[0].id).toBe(state.group[0].id);
    expect(loaded.group[0].hp).toBe(state.group[0].hp);
    expect(loaded.field!.actors).toEqual(state.field!.actors);
    expect(loaded.field!.slots.map(slot => slot.home)).toEqual(createFieldSlots(state.zone, state.cell?.sub, 0).map(slot => slot.home));
    const homes = structuredClone(loaded.field!.slots);
    syncFieldState(loaded, arena, 2, false);
    expect(loaded.field!.slots).toEqual(homes);
    tick(loaded, { arena, autoSkills: false });
    expect(loaded.group).toHaveLength(homes.length - 1);
  });

  it('distributes a capped population over the entire authored clearing', () => {
    const slots = createFieldSlots(1, null, 0);
    const points = spawns.pointsFor(1, null);
    expect(Math.max(...slots.map(slot => slot.home.x))).toBe(Math.max(...points.map(point => point.x)));
    expect(new Set(slots.map(slot => slot.pointId)).size).toBe(slots.length);
  });
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

  it('never pulls more bodies than the field has slots', () => {
    const { state, arena } = fieldFight(6);
    // Every body is inside the aggro radius; the population ceiling still caps the engagement.
    state.group.forEach((mob, index) => {
      Object.assign(arena.mobs[mob.id], { x: 2.4 + index * 0.3, y: 6 });
      state.field!.slots[index % state.field!.slots.length].home = { x: 2.4, y: 6 };
    });
    tick(state, { arena, autoSkills: false });
    expect(state.field!.engagementIds.length).toBeLessThanOrEqual(state.field!.slots.length);
    expect(new Set(state.field!.engagementIds).size).toBe(state.field!.engagementIds.length);
  });

  it('wakes one assist link without cascading across the field', () => {
    const { state, arena } = fieldFight(3);
    // the third body stands far enough that a full tick of wander and approach
    // can never close the assist gap: only the depth rule can keep it asleep.
    const points = [{ x: 4.9, y: 6 }, { x: 7.8, y: 6 }, { x: 14, y: 6 }];
    state.group.forEach((mob, index) => {
      Object.assign(arena.mobs[mob.id], points[index]);
      state.field!.slots[index].home = points[index];
    });
    state.playerStatuses.shock = { stacks: 1, secLeft: 3, perSec: 0 };
    tick(state, { arena, autoSkills: false });
    expect(state.field!.engagementIds).toContain('field-0');
    expect(state.field!.engagementIds).toContain('field-1');
    expect(state.field!.engagementIds).not.toContain('field-2');
  });

  it('caps assist expansion at one link in a single resolver pass', () => {
    const { state, arena } = fieldFight(3);
    state.group.forEach((mob, index) => {
      const point = { x: 4.9 + index * 2.9, y: 6 };
      Object.assign(arena.mobs[mob.id], point);
      state.field!.slots[index].home = point;
    });
    // one resolver pass, no movement in between: the old fixed-point chain wakes
    // the third body here, the one-link cap leaves it asleep.
    advanceEngagement(state, {
      arena, online: true, fieldProfile: () => spawns.profileFor(state.zone, state.cell?.sub ?? null),
      cancelMobPreparation: () => {},
      tickStartUs: 0, state: createEngagementState(),
    });
    expect(state.field!.engagementIds).toContain('field-0');
    expect(state.field!.engagementIds).toContain('field-1');
    expect(state.field!.engagementIds).not.toContain('field-2');
  });

  it('keeps a pulled body engaged and wounded beyond its old home leash', () => {
    const { state, arena } = fieldFight(1);
    const mob = state.group[0];
    state.field!.slots[0].home = { x: 1, y: 6 };
    state.field!.engagementIds = [mob.id];
    Object.assign(arena.player, { x: 13, y: 6 });
    Object.assign(arena.mobs[mob.id], { x: 12, y: 6 });
    mob.hp = mob.hpMax / 2;
    tick(state, { arena, autoSkills: false });
    expect(state.field!.engagementIds).toContain(mob.id);
    expect(mob.hp).toBe(mob.hpMax / 2);
  });

  it('alerts a selected body only when the committed press reaches it', () => {
    const { state, arena } = fieldFight(1);
    const mob = state.group[0];
    Object.assign(mob, { line: 'stand-off' });
    Object.assign(arena.mobs[mob.id], { x: 7, y: 6 });
    state.field!.slots[0].home = { x: 7, y: 6 };
    state.field!.engagementIds = [];
    expect(arenaDistance(arena.player, arena.mobs[mob.id])).toBeGreaterThan(4);
    tick(state, { arena, autoSkills: true, manual: { cast: { skillId: 'attack.firestorm' } } });
    // A selection and a pre-release press are player-side: no hostile awareness yet.
    expect(state.field!.engagementIds).not.toContain(mob.id);
    for (let index = 0; index < 20 && !state.field!.engagementIds.includes(mob.id); index++)
      tick(state, { arena, autoSkills: true });
    // The press reached the body: the contact alerts it once and its own plan starts from that beat.
    expect(state.field!.engagementIds).toContain(mob.id);
    const press = arena.actions.find((entry) => entry.actorId === 'player' && entry.skillId === 'attack.firestorm');
    for (let index = 0; index < 4; index++) tick(state, { arena, autoSkills: true });
    const action = arena.actions.find((entry) => entry.actorId === mob.id && entry.kind === 'swing');
    expect(action?.timing).toBeDefined();
    expect(action!.timing!.startedAtUs).toBeGreaterThanOrEqual(press?.timing?.impactAtUs ?? 0);
    expect(action!.timing!.startedAtUs).toBeLessThanOrEqual(arena.nowUs);
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

  it('resumes living bodies at their archived ground positions, not their slot homes', () => {
    const { state, arena } = fieldFight(2);
    tick(state, { arena, autoSkills: false });
    Object.assign(arena.mobs['field-0'], { x: 14.5, y: 9.25 });
    Object.assign(arena.mobs['field-1'], { x: 15.25, y: 10.5 });
    captureCombatArena(arena, state, arena.nowUs);
    syncFieldState(state, arena, 2, false);
    const oldKey = fieldAreaKey(state);
    const home = state.cell ? { ...state.cell } : { q: 0, r: 0, sub: null, wild: null };
    const positions = state.field!.actors
      .map((actor) => `${actor.id}:${actor.x.toFixed(2)},${actor.y.toFixed(2)}`);
    state.cell = { q: 5, r: 5, sub: null, wild: null };
    tick(state, { arena, autoSkills: false });
    const archived = state.fieldArchive?.[oldKey];
    expect(archived!.actors.map((actor) => `${actor.id}:${actor.x.toFixed(2)},${actor.y.toFixed(2)}`))
      .toEqual(positions);
    state.group = [];
    state.cell = home;
    // A re-entry creates a fresh renderer: saved ground must survive until it builds the bodies.
    const returning = createCombatArena();
    syncFieldState(state, returning, 2, false);
    expect(state.field!.actors.map((actor) => `${actor.id}:${actor.x.toFixed(2)},${actor.y.toFixed(2)}`))
      .toEqual(positions);
    syncCombatArena(returning, state, 0, 1_000_000, characterSheet(state).maxHp);
    expect(returning.mobs['field-0'].x).toBeCloseTo(14.5);
    expect(returning.mobs['field-0'].y).toBeCloseTo(9.25);
    expect(returning.mobs['field-1'].x).toBeCloseTo(15.25);
    expect(returning.mobs['field-1'].y).toBeCloseTo(10.5);
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
