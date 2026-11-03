import { describe, expect, it } from 'vitest';
import { arenaSkillTargets, createCombatArena, resolveOfflineTargets, syncCombatArena } from '@sim/combat/combat-arena';
import { liveId } from '../fixtures/liveSkill';
import { mobFixture } from '../fixtures/mobFixture';
import { E, sm } from '../../src/engine/client';
import { installSyntheticSkill } from '../fixtures/skillFixture';
import { catchUp, characterSheet, newGame, setLevel, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import type { Mob } from '@sim/core/types';

/**
 * Offline positional resolution: the same pull resolved offline (slot homes)
 * must match the live arena resolved from the same positions. No queue slicing,
 * no authored counts — the footprint decides.
 */

const CLUSTER = [
  { x: 25, y: 16 },
  { x: 26, y: 16.5 },
  { x: 24, y: 17 },
];
const OUTLIER = { x: 40, y: 16 };

const circleId = () => liveId((s) => s.type === 'attack' && !s.area?.shape
  && (s.area?.radius_m ?? 0) > 0 && s.area?.origin === 'target', 'target circle');
const lineId = () => liveId((s) => s.area?.shape === 'line', 'line');
const coneId = () => liveId((s) => s.area?.shape === 'cone', 'cone');
const singleId = () => liveId((s) => s.type === 'attack' && (s.area?.radius_m ?? 0) === 0
  && !s.area?.shape, 'single target');
const buffId = () => liveId((s) => s.type === 'buff', 'buff');

function pull(points: { x: number; y: number }[]) {
  const group = points.map((_, index) => mobFixture({ id: `m${index}` }));
  const field = {
    areaKey: 'test-zone',
    actors: points.map((point, index) => ({ id: `m${index}`, ...point })),
    slots: points.map((point, index) => ({
      id: `slot${index}`, pointId: `p${index}`, home: { ...point },
      roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: `m${index}`,
    })),
  };
  return { group, field };
}

function liveArena(points: { x: number; y: number }[], group: Mob[]) {
  const arena = createCombatArena();
  points.forEach((point, index) => {
    arena.mobs[`m${index}`] = {
      id: `m${index}`, x: point.x, y: point.y, facing: Math.PI,
      moving: false, radiusM: 0.3, hp: group[index].hp, hpMax: group[index].hpMax,
    } as any;
  });
  return arena;
}

const ids = (group: Mob[]) => group.map((mob) => mob.id).sort();

describe('offline positional resolution', () => {
  it('matches live for a target circle over a real pull', () => {
    const { group, field } = pull([...CLUSTER, OUTLIER]);
    const skillId = circleId();
    const offline = resolveOfflineTargets(field, skillId, group);
    const live = arenaSkillTargets(liveArena([...CLUSTER, OUTLIER], group), skillId, group);
    expect(ids(offline.targets)).toEqual(ids(live.targets));
    expect(offline.targets.length).toBeGreaterThan(0);
    expect(offline.area).toEqual(live.area);
  });

  it('matches live for lines and cones', () => {
    const { group, field } = pull([...CLUSTER, OUTLIER]);
    for (const skillId of [lineId(), coneId()]) {
      const offline = resolveOfflineTargets(field, skillId, group);
      const live = arenaSkillTargets(liveArena([...CLUSTER, OUTLIER], group), skillId, group);
      expect(ids(offline.targets), skillId).toEqual(ids(live.targets));
      expect(offline.area, skillId).toEqual(live.area);
    }
  });

  it('matches live for single-target and buff rows', () => {
    const { group, field } = pull([...CLUSTER, OUTLIER]);
    const single = singleId();
    expect(ids(resolveOfflineTargets(field, single, group).targets))
      .toEqual(ids(arenaSkillTargets(liveArena([...CLUSTER, OUTLIER], group), single, group).targets));
    const buff = buffId();
    expect(ids(resolveOfflineTargets(field, buff, group).targets)).toEqual(ids(group));
  });

  it('casts without a range gate offline where live holds fire', () => {
    // A pull beyond cast range: live returns no targets (the player would walk up
    // first — online-only), offline casts from the committed footprint like the
    // queue path always has.
    const far = [{ x: 40, y: 16 }, { x: 40.5, y: 16.2 }];
    const { group, field } = pull(far);
    const skillId = circleId();
    const offline = resolveOfflineTargets(field, skillId, group);
    const live = arenaSkillTargets(liveArena(far, group), skillId, group);
    expect(live.targets).toEqual([]);
    expect(offline.targets.length).toBeGreaterThan(0);
  });

  it('returns nothing when nothing is alive', () => {
    const { field } = pull(CLUSTER);
    const dead = CLUSTER.map((_, index) => mobFixture({ id: `m${index}`, hp: 0 }));
    expect(resolveOfflineTargets(field, circleId(), dead).targets).toEqual([]);
  });
});

describe('offline cache invalidation (A)', () => {
  const p = E.combat_arena.player_start as { x: number; y: number };
  const skillId = 'test.cache-repro';
  function withCacheSkill(run: (id: string) => void) {
    const installed = installSyntheticSkill(skillId, {
      name: 'Cache Repro',
      area: { origin: 'target', radius_m: 2 },
      cast: { delivery: 'melee', range_m: 99, windup_sec: 0.15, recovery_sec: 0.22 },
    });
    try { run(skillId); } finally { installed.restore(); }
  }

  it('new field objects with same areaKey but moved mob change hit-set', () => {
    withCacheSkill((id) => {
      const group = [mobFixture({ id: 'm0' }), mobFixture({ id: 'm1' })];
      const fieldA = {
        areaKey: 'test-cache-a',
        actors: [{ id: 'm0', x: p.x + 1, y: p.y }, { id: 'm1', x: p.x + 1.5, y: p.y }],
        slots: [
          { id: 's0', pointId: 'p0', home: { x: p.x + 1, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' },
          { id: 's1', pointId: 'p1', home: { x: p.x + 1.5, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm1' },
        ],
      };
      const fieldB = {
        areaKey: 'test-cache-a',
        actors: [{ id: 'm0', x: p.x + 1, y: p.y }, { id: 'm1', x: p.x + 10, y: p.y }],
        slots: [
          { id: 's0', pointId: 'p0', home: { x: p.x + 1, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' },
          { id: 's1', pointId: 'p1', home: { x: p.x + 10, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm1' },
        ],
      };
      expect(resolveOfflineTargets(fieldA, id, group).targets).toHaveLength(2);
      expect(resolveOfflineTargets(fieldB, id, group).targets).toHaveLength(1);
    });
  });

  it('same field object mutated between calls does not reuse stale pose', () => {
    withCacheSkill((id) => {
      const group = [mobFixture({ id: 'm0' }), mobFixture({ id: 'm1' })];
      const field: any = {
        areaKey: 'test-cache-b',
        actors: [{ id: 'm0', x: p.x + 1, y: p.y }, { id: 'm1', x: p.x + 1.5, y: p.y }],
        slots: [
          { id: 's0', pointId: 'p0', home: { x: p.x + 1, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' },
          { id: 's1', pointId: 'p1', home: { x: p.x + 1.5, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm1' },
        ],
      };
      expect(resolveOfflineTargets(field, id, group).targets).toHaveLength(2);
      field.actors[1].x = p.x + 10;
      field.slots[1].home.x = p.x + 10;
      expect(resolveOfflineTargets(field, id, group).targets).toHaveLength(1);
    });
  });

  it('A -> B -> A switching does not cross cache', () => {
    withCacheSkill((id) => {
      const group = [mobFixture({ id: 'm0' }), mobFixture({ id: 'm1' })];
      const fieldA1 = {
        areaKey: 'test-cache-c',
        actors: [{ id: 'm0', x: p.x + 1, y: p.y }, { id: 'm1', x: p.x + 1.5, y: p.y }],
        slots: [
          { id: 's0', pointId: 'p0', home: { x: p.x + 1, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' },
          { id: 's1', pointId: 'p1', home: { x: p.x + 1.5, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm1' },
        ],
      };
      const fieldB = {
        areaKey: 'test-cache-c',
        actors: [{ id: 'm0', x: p.x + 1, y: p.y }, { id: 'm1', x: p.x + 10, y: p.y }],
        slots: [
          { id: 's0', pointId: 'p0', home: { x: p.x + 1, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' },
          { id: 's1', pointId: 'p1', home: { x: p.x + 10, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm1' },
        ],
      };
      const fieldA2 = {
        areaKey: 'test-cache-c',
        actors: [{ id: 'm0', x: p.x + 1, y: p.y }, { id: 'm1', x: p.x + 1.5, y: p.y }],
        slots: [
          { id: 's0', pointId: 'p0', home: { x: p.x + 1, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' },
          { id: 's1', pointId: 'p1', home: { x: p.x + 1.5, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm1' },
        ],
      };
      expect(resolveOfflineTargets(fieldA1, id, group).targets).toHaveLength(2);
      expect(resolveOfflineTargets(fieldB, id, group).targets).toHaveLength(1);
      expect(resolveOfflineTargets(fieldA2, id, group).targets).toHaveLength(2);
    });
  });

  it('uses current slot home when no actor pose', () => {
    withCacheSkill((id) => {
      const group = [mobFixture({ id: 'm0' }), mobFixture({ id: 'm1' })];
      const field1: any = {
        areaKey: 'test-cache-home',
        actors: [],
        slots: [
          { id: 's0', pointId: 'p0', home: { x: p.x + 1, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' },
          { id: 's1', pointId: 'p1', home: { x: p.x + 1.5, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm1' },
        ],
      };
      const field2: any = {
        areaKey: 'test-cache-home',
        actors: [],
        slots: [
          { id: 's0', pointId: 'p0', home: { x: p.x + 1, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' },
          { id: 's1', pointId: 'p1', home: { x: p.x + 10, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm1' },
        ],
      };
      expect(resolveOfflineTargets(field1, id, group).targets).toHaveLength(2);
      expect(resolveOfflineTargets(field2, id, group).targets).toHaveLength(1);
    });
  });

  it('does not return dead or removed mobs', () => {
    withCacheSkill((id) => {
      const alive = [mobFixture({ id: 'm0' }), mobFixture({ id: 'm1' })];
      const field = {
        areaKey: 'test-cache-dead',
        actors: [{ id: 'm0', x: p.x + 1, y: p.y }, { id: 'm1', x: p.x + 1.5, y: p.y }],
        slots: [
          { id: 's0', pointId: 'p0', home: { x: p.x + 1, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' },
          { id: 's1', pointId: 'p1', home: { x: p.x + 1.5, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm1' },
        ],
      };
      expect(resolveOfflineTargets(field, id, alive).targets).toHaveLength(2);
      const dead = [mobFixture({ id: 'm0' }), mobFixture({ id: 'm1', hp: 0 })];
      expect(resolveOfflineTargets(field, id, dead).targets.map(m => m.id)).toEqual(['m0']);
      const removed = [mobFixture({ id: 'm0' })];
      const field2 = {
        areaKey: 'test-cache-dead',
        actors: [{ id: 'm0', x: p.x + 1, y: p.y }],
        slots: [{ id: 's0', pointId: 'p0', home: { x: p.x + 1, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' }],
      };
      expect(resolveOfflineTargets(field2, id, removed).targets).toHaveLength(1);
    });
  });

  it('live sync does not teleport a walking actor', () => {
    const arena = createCombatArena();
    const mob = mobFixture({ id: 'm0' });
    const state: any = {
      zone: 1, cell: { q: 0, r: 0, sub: null, site: null },
      field: {
        areaKey: 'test-live-teleport', arenaEpoch: 1, nextSlotSeq: 2, slots: [{ id: 's0', pointId: 'p0', home: { x: 20, y: 16 }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' }], engagementIds: [], combatSessionId: 0, sessionActive: false, quietSec: 0, farmingAnchor: { x: p.x, y: p.y }, player: { x: p.x, y: p.y }, actors: [], lastSeenAtSec: 0,
      }, group: [mob], player: { hp: 100, es: 0, mana: 100 }, playerStatuses: {}, mobStatus: {}, skills: { buffUp: {} }, curses: {}, fieldArchive: {},
    };
    syncCombatArena(arena, state, 0, 1_000_000, 100);
    const before = { x: arena.mobs['m0'].x, y: arena.mobs['m0'].y };
    // simulate walk
    arena.mobs['m0'].x += 5; arena.mobs['m0'].y += 5;
    const walked = { x: arena.mobs['m0'].x, y: arena.mobs['m0'].y };
    syncCombatArena(arena, state, 500_000, 1_000_000, 100);
    expect(arena.mobs['m0'].x).toBe(walked.x);
    expect(arena.mobs['m0'].y).toBe(walked.y);
    expect(arena.mobs['m0'].x).not.toBe(before.x);
  });
});

describe('offline/live via syncCombatArena and tick integration (E)', () => {
  it('offline matches live syncCombatArena coordinate frame', () => {
    const skillId = 'test.sync-frame';
    const installed = installSyntheticSkill(skillId, {
      name: 'Sync Frame', area: { origin: 'target', radius_m: 2 },
      cast: { delivery: 'melee', range_m: 99, windup_sec: 0.15, recovery_sec: 0.22 },
    });
    try {
      const p = E.combat_arena.player_start as { x: number; y: number };
      const group = [mobFixture({ id: 'm0' }), mobFixture({ id: 'm1' })];
      const field: any = {
        areaKey: 'test-sync-frame', arenaEpoch: 1, nextSlotSeq: 3,
        slots: [
          { id: 's0', pointId: 'p0', home: { x: p.x + 1, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm0' },
          { id: 's1', pointId: 'p1', home: { x: p.x + 1.5, y: p.y }, roamM: 0, respawnAtSec: 0, respawnCount: 0, mobId: 'm1' },
        ], engagementIds: [], combatSessionId: 0, sessionActive: false, quietSec: 0,
        farmingAnchor: { x: p.x, y: p.y }, player: { x: p.x, y: p.y }, actors: [], lastSeenAtSec: 0,
      };
      const state: any = {
        zone: 1, cell: { q: 0, r: 0, sub: null, site: null },
        field, group, player: { hp: 100, es: 0, mana: 100 }, playerStatuses: {}, mobStatus: {}, skills: { buffUp: {} }, curses: {}, fieldArchive: {},
      };
      const arena = createCombatArena();
      syncCombatArena(arena, state, 0, 1_000_000, 100);
      // sync should place mobs at slot homes
      const live = arenaSkillTargets(arena, skillId, group);
      const offline = resolveOfflineTargets(field, skillId, group);
      expect(live.targets).toHaveLength(2);
      expect(offline.targets).toHaveLength(2);
      expect(offline.targets.map(m=>m.id).sort()).toEqual(live.targets.map(m=>m.id).sort());
      expect(offline.area).toEqual(live.area);
    } finally { installed.restore(); }
  });

  it('integration via tick/catchUp has no stale stale after position change', () => {
    const skillId = 'test.tick-offline';
    const installed = installSyntheticSkill(skillId, {
      name: 'Tick Offline', type: 'attack', group: 'melee', element: 'physical', cd: 1, mana: '0 flat', basis: 'phys', offline_targets: '2',
      area: { origin: 'target', radius_m: 2 }, cast: { delivery: 'melee', range_m: 99, windup_sec: 0.15, recovery_sec: 0.22 }, effects: [], base_flat: 10, eff: 0,
    });
    try {
      const state = newGame(999);
      setLevel(state, 10);
      state.hunting = true;
      const p = E.combat_arena.player_start as { x: number; y: number };
      state.group = [mobFixture({ id: 'm0' }), mobFixture({ id: 'm1' })];
      state.skills.owned[skillId] = 0;
      state.skills.list[0] = skillId;
      const arena = createCombatArena();
      syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
      // pin close positions
      pinFieldPopulation(state, 2, new Map([['m0', { x: p.x + 1, y: p.y }], ['m1', { x: p.x + 1.5, y: p.y }]]));
      state.field!.actors = [{ id: 'm0', x: p.x + 1, y: p.y }, { id: 'm1', x: p.x + 1.5, y: p.y }];
      // first offline resolve hits 2
      expect(resolveOfflineTargets(state.field!, skillId, state.group).targets).toHaveLength(2);
      // simulate offline catchUp for 1 sec (should settle without stale)
      catchUp(state, 1);
      // move second mob far - update field actors and homes, and keep arena in sync if needed
      state.field!.actors = [{ id: 'm0', x: p.x + 1, y: p.y }, { id: 'm1', x: p.x + 10, y: p.y }];
      state.field!.slots[1].home = { x: p.x + 10, y: p.y };
      // second resolve should now hit 1, not stale 2
      expect(resolveOfflineTargets(state.field!, skillId, state.group).targets).toHaveLength(1);
    } finally { installed.restore(); }
  });
});
