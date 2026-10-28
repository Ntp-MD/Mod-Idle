import { describe, expect, it } from 'vitest';
import { E, SPAWNS, eng, spawns } from '../../src/engine/client';
import { checkSpawnNavigation, createSpawns } from '@engine/spawns.ts';
import { isClear } from '@engine/navigation.ts';

const context = () => ({
  arena: E.combat_arena,
  playerStart: E.combat_arena.player_start,
  zones: E.mob.zones,
});

describe('field spawn data', () => {
  it('covers every live zone and subzone with one validated layout', () => {
    expect(spawns.coverage).toEqual({ zones: 18, subzones: 54, layouts: 2, points: 56 });
    for (const zone of E.mob.zones) {
      const profile = spawns.profileFor(zone.id);
      expect(profile.cap).toBeLessThanOrEqual(spawns.layout(profile.layout).points.length);
      expect(profile.cap).toBeGreaterThan(0);
      expect([32, 40, 48]).toContain(profile.cap);
      expect(profile.respawn_sec).toBeGreaterThanOrEqual(24);
      expect(profile.respawn_sec).toBeLessThanOrEqual(40);
      expect(profile.respawn_sec).toBeGreaterThan(0);
      expect(profile.aggro_m).toBeGreaterThan(0);
      expect(profile.assist_m).toBeGreaterThanOrEqual(0);
      expect(profile.leash_m).toBeGreaterThanOrEqual(profile.aggro_m);
      expect(profile.camp_safe_m).toBeGreaterThanOrEqual(0);
      expect(profile.offline_share).toBeGreaterThanOrEqual(0);
      expect(profile.offline_share).toBeLessThanOrEqual(1);
      expect(new Set(spawns.pointsFor(zone.id).map((point) => point.id)).size).toBe(48);
      for (let sub = 0; sub < (zone.subzones?.length ?? 0); sub++) {
        expect(spawns.profileFor(zone.id, sub)).toEqual(profile);
        expect(spawns.pointsFor(zone.id, sub)).toBe(spawns.pointsFor(zone.id));
      }
    }
  });

  it('keeps every home disc inside the arena and away from the player start', () => {
    for (const zone of E.mob.zones) {
      for (const point of spawns.pointsFor(zone.id)) {
        expect(point.x - point.roam_m).toBeGreaterThanOrEqual(.5);
        expect(point.x + point.roam_m).toBeLessThanOrEqual(E.combat_arena.width - .5);
        expect(point.y - point.roam_m).toBeGreaterThanOrEqual(.5);
        expect(point.y + point.roam_m).toBeLessThanOrEqual(E.combat_arena.height - .5);
        expect(Math.hypot(point.x - E.combat_arena.player_start.x, point.y - E.combat_arena.player_start.y))
          .toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('keeps the authored population supply within five percent of the 7x band kill target', () => {
    for (const zone of E.mob.zones) {
      const [lo, hi] = eng.groupRangeOf(zone.id);
      const expected = (lo + hi) / 2;
      const target = 3600 / (expected * E.loot.ttk_per_mob_sec + E.loot.group_spawn_sec) * expected * 7;
      const profile = spawns.profileFor(zone.id);
      const supply = 3600 * profile.cap / profile.respawn_sec;
      expect(Math.abs(supply - target) / target).toBeLessThan(0.05);
    }
  });

  it('keeps live population caps out of the legacy Camp/dungeon/offline domain', () => {
    for (const zone of E.mob.zones) {
      const live = spawns.profileFor(zone.id);
      const legacy = spawns.profileFor(zone.id, null, 'legacy');
      expect(live.cap).toBeGreaterThanOrEqual(32);
      expect(legacy.cap).toBeLessThanOrEqual(8);
      expect(live.respawn_sec).toBeLessThan(legacy.respawn_sec);
    }
  });

  it('refuses missing zones, impossible caps, outside wander discs and unknown subzones', () => {
    const missing = structuredClone(SPAWNS) as unknown as Record<string, any>;
    delete missing.zones['1'];
    expect(() => createSpawns(missing, context())).toThrow(/spawns\.json: zones\.1 is missing/);

    const cap = structuredClone(SPAWNS) as unknown as Record<string, any>;
    cap.zones['1'].cap = 99;
    expect(() => createSpawns(cap, context())).toThrow(/spawns\.json: zones\.1\.cap exceeds/);

    const outside = structuredClone(SPAWNS) as unknown as Record<string, any>;
    outside.layouts['forest-clearing'].points[0].x = 49.2;
    expect(() => createSpawns(outside, context())).toThrow(/spawns\.json: layouts\.forest-clearing\.p01/);

    const unknown = structuredClone(SPAWNS) as unknown as Record<string, any>;
    unknown.subzones['1:99'] = { cap: 2 };
    expect(() => createSpawns(unknown, context())).toThrow(/spawns\.json: subzones\.1:99 names no authored/);

    const unknownZone = structuredClone(SPAWNS) as unknown as Record<string, any>;
    unknownZone.zones['99'] = { cap: 2 };
    expect(() => createSpawns(unknownZone, context())).toThrow(/spawns\.json: zones\.99 names no authored zone/);
  });
});

describe('authored navigation geometry', () => {
  const withNav = (nav: unknown) => {
    const raw = structuredClone(SPAWNS) as unknown as Record<string, any>;
    raw.layouts['forest-clearing'].nav = nav;
    return createSpawns(raw, context());
  };
  const openNav = (extra: Record<string, unknown> = {}) => ({
    version: 1, origin: { x: 0, y: 0 }, cell_size_m: 1, obstacles: [], ...extra,
  });
  const obstacle = (extra: Record<string, unknown> = {}) => ({
    id: 'rock', kind: 'circle', x: 20, y: 20, radius: 2,
    blocks_movement: true, blocks_sight: true, blocks_projectiles: true, ...extra,
  });

  it('stays unauthored until a layout proves its geometry', () => {
    expect(spawns.navigation('forest-clearing')).toBeNull();
    expect(checkSpawnNavigation(spawns, 'forest-clearing', E.combat_arena.player_start, 0.3)).toBeNull();
  });

  it('resolves authored obstacles into independent kernel flags', () => {
    const model = withNav(openNav({ obstacles: [
      obstacle({ id: 'rock', blocks_projectiles: false }),
      obstacle({ id: 'canopy', kind: 'box', x: 30, y: 20, width: 4, height: 3, radius: undefined,
        blocks_movement: false, blocks_sight: true, blocks_projectiles: false }),
    ] }));
    const nav = model.navigation('forest-clearing')!;
    expect(nav).toMatchObject({
      version: 1, cellSize: 1,
      bounds: { x: 0, y: 0, width: E.combat_arena.width, height: E.combat_arena.height },
    });
    expect(nav.obstacles[0]).toMatchObject({ kind: 'circle', radius: 2, flags: { movement: true, sight: true, projectiles: false } });
    expect(nav.obstacles[1]).toMatchObject({ kind: 'box', flags: { movement: false, sight: true, projectiles: false } });
  });

  it('refuses malformed geometry at the data boundary', () => {
    const refused = (nav: unknown, match: RegExp) => expect(() => withNav(nav)).toThrow(match);
    refused(openNav({ cell_size_m: 0 }), /cell_size_m.*positive/);
    refused(openNav({ obstacles: [obstacle({ radius: 0 })] }), /radius.*positive/);
    refused(openNav({ obstacles: [obstacle({ kind: 'wall' })] }), /kind.*circle or box/);
    refused(openNav({ obstacles: [obstacle({ blocks_movement: 'yes' })] }), /blocks_movement.*true or false/);
    refused(openNav({ obstacles: [obstacle({ id: 'same' }), obstacle({ id: 'same', x: 30 })] }), /duplicates obstacle same/);
  });

  it('proves every authored home reachable on an open proof grid', () => {
    const model = withNav(openNav());
    const nav = model.navigation('forest-clearing')!;
    for (const point of spawns.pointsFor(1)) expect(isClear(nav, point, 0.3)).toBe(true);
    expect(checkSpawnNavigation(model, 'forest-clearing', E.combat_arena.player_start, 0.3)).toEqual([]);
  });

  it('reports an authored obstacle that covers a home', () => {
    const point = spawns.pointsFor(1)[0];
    const model = withNav(openNav({ obstacles: [
      obstacle({ id: 'boulder', kind: 'box', x: point.x - 2, y: point.y - 2, width: 4, height: 4 }),
    ] }));
    expect(checkSpawnNavigation(model, 'forest-clearing', E.combat_arena.player_start, 0.3))
      .toContainEqual({ pointId: point.id, reason: 'blocked' });
  });

  it('keeps a sight-only obstacle walkable', () => {
    const point = spawns.pointsFor(1)[0];
    const model = withNav(openNav({ obstacles: [
      obstacle({ id: 'canopy', kind: 'box', x: point.x - 2, y: point.y - 2, width: 4, height: 4,
        blocks_movement: false, blocks_sight: true, blocks_projectiles: false }),
    ] }));
    expect(checkSpawnNavigation(model, 'forest-clearing', E.combat_arena.player_start, 0.3)).toEqual([]);
  });

  it('proves the slice layout: authored homes reachable around authored ground', () => {
    const nav = spawns.navigation('grove-slice');
    expect(nav).not.toBeNull();
    expect(nav!.obstacles.map((o) => o.id).sort())
      .toEqual(['ridge-north', 'ridge-south', 'thicket']);
    for (const point of spawns.layout('grove-slice').points) expect(isClear(nav!, point, 0.3)).toBe(true);
    expect(checkSpawnNavigation(spawns, 'grove-slice', E.combat_arena.player_start, 0.3)).toEqual([]);
  });
});
