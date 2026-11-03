import { describe, expect, it } from 'vitest';
import { E, SPAWNS, spawns } from '../../src/engine/client';
import { checkSpawnNavigation, createSpawns } from '@engine/spawns.ts';
import { isClear } from '@engine/navigation.ts';

const fixtureContext = {
  arena: { width: 50, height: 40 }, playerStart: { x: 2, y: 2 },
  zones: [{ id: 101, subzones: [{}, {}] }],
};
const fixtureData = (): any => ({
  defaults: { ...SPAWNS.defaults, layout: 'fixture-layout', cap: 2,
    respawn_sec: 10, respawn_min_sec: 10, respawn_max_sec: 10 },
  layouts: { 'fixture-layout': { points: [
    { id: 'first', x: 10, y: 10, roam_m: 1 },
    { id: 'second', x: 40, y: 25, roam_m: 1 },
  ] } },
  zones: { '101': {} }, subzones: {},
  legacy: { defaults: { cap: 1, respawn_sec: 20 } },
});

describe('field spawn data', () => {
  it('covers every live zone and subzone with validated layouts', () => {
    expect(spawns.coverage).toEqual({
      zones: E.mob.zones.length,
      subzones: E.mob.zones.reduce((sum, zone) => sum + (zone.subzones?.length ?? 0), 0),
      layouts: Object.keys(SPAWNS.layouts).length,
      points: Object.values(SPAWNS.layouts).reduce((sum, layout) => sum + layout.points.length, 0),
    });
    for (const zone of E.mob.zones) {
      const profile = spawns.profileFor(zone.id);
      expect(profile.cap).toBeLessThanOrEqual(spawns.layout(profile.layout).points.length);
      expect(profile.cap).toBeGreaterThan(0);
      expect(profile.respawn_sec).toBeGreaterThan(0);
      expect(profile.aggro_m).toBeGreaterThan(0);
      expect(profile.assist_m).toBeGreaterThanOrEqual(0);
      expect(profile.offline_share).toBeGreaterThanOrEqual(0);
      expect(profile.offline_share).toBeLessThanOrEqual(1);
      expect(new Set(spawns.pointsFor(zone.id).map((point) => point.id)).size)
        .toBe(spawns.layout(profile.layout).points.length);
      for (let sub = 0; sub < (zone.subzones?.length ?? 0); sub++) {
        const subProfile = spawns.profileFor(zone.id, sub);
        const override = (SPAWNS.subzones as Record<string, unknown>)[`${zone.id}:${sub}`] ?? {};
        expect(subProfile).toMatchObject({ ...profile, ...override });
        expect(spawns.pointsFor(zone.id, sub)).toBe(spawns.layout(subProfile.layout).points);
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

  it('keeps live population changes independent of the legacy domain', () => {
    const raw = fixtureData();
    const original = createSpawns(raw, fixtureContext);
    raw.zones['101'] = { cap: 1, respawn_sec: 5 };
    const changed = createSpawns(raw, fixtureContext);
    expect(changed.profileFor(101)).toMatchObject({ cap: 1, respawn_sec: 5 });
    expect(changed.profileFor(101, null, 'legacy')).toEqual(original.profileFor(101, null, 'legacy'));
  });

  it('accepts added, renamed and removed layouts and zones', () => {
    const raw = fixtureData();
    raw.layouts.renamed = raw.layouts['fixture-layout'];
    delete raw.layouts['fixture-layout'];
    raw.defaults.layout = 'renamed';
    raw.zones['202'] = {};
    const expanded = createSpawns(raw, { ...fixtureContext, zones: [...fixtureContext.zones, { id: 202 }] });
    expect(expanded.profileFor(202).layout).toBe('renamed');
    delete raw.zones['101'];
    const reduced = createSpawns(raw, { ...fixtureContext, zones: [{ id: 202 }] });
    expect(reduced.coverage.zones).toBe(1);
    expect(() => reduced.profileFor(101)).toThrow(/not authored/);
  });

  it('refuses missing zones, impossible caps, outside wander discs and unknown subzones', () => {
    const missing = fixtureData();
    delete missing.zones['101'];
    expect(() => createSpawns(missing, fixtureContext)).toThrow(/spawns\.json: zones\.101 is missing/);

    const cap = fixtureData();
    cap.zones['101'].cap = cap.layouts['fixture-layout'].points.length + 1;
    expect(() => createSpawns(cap, fixtureContext)).toThrow(/spawns\.json: zones\.101\.cap exceeds/);

    const outside = fixtureData();
    outside.layouts['fixture-layout'].points[0].x = fixtureContext.arena.width + 1;
    expect(() => createSpawns(outside, fixtureContext)).toThrow(/spawns\.json: layouts\.fixture-layout\.first/);

    const unknown = fixtureData();
    unknown.subzones['101:99'] = { cap: 2 };
    expect(() => createSpawns(unknown, fixtureContext)).toThrow(/spawns\.json: subzones\.101:99 names no authored/);

    const unknownZone = fixtureData();
    unknownZone.zones['202'] = { cap: 2 };
    expect(() => createSpawns(unknownZone, fixtureContext)).toThrow(/spawns\.json: zones\.202 names no authored zone/);
  });
});

describe('authored navigation geometry', () => {
  const withNav = (nav: unknown) => {
    const raw = fixtureData();
    raw.layouts['fixture-layout'].nav = nav;
    return createSpawns(raw, fixtureContext);
  };
  const openNav = (extra: Record<string, unknown> = {}) => ({
    version: 1, origin: { x: 0, y: 0 }, cell_size_m: 1, obstacles: [], ...extra,
  });
  const obstacle = (extra: Record<string, unknown> = {}) => ({
    id: 'rock', kind: 'circle', x: 20, y: 20, radius: 2,
    blocks_movement: true, blocks_sight: true, blocks_projectiles: true, ...extra,
  });

  it('stays unauthored until a layout proves its geometry', () => {
    const model = createSpawns(fixtureData(), fixtureContext);
    expect(model.navigation('fixture-layout')).toBeNull();
    expect(checkSpawnNavigation(model, 'fixture-layout', fixtureContext.playerStart, 0.3)).toBeNull();
  });

  it('resolves and proves every currently authored navigation layout', () => {
    for (const [id, layout] of Object.entries<any>(SPAWNS.layouts)) {
      const nav = spawns.navigation(id);
      if (!layout.nav) {
        expect(nav).toBeNull();
        continue;
      }
      expect(nav).not.toBeNull();
      expect(nav!.obstacles.map((obstacle) => obstacle.id)).toEqual(layout.nav.obstacles.map((obstacle: any) => obstacle.id));
      for (const obstacle of layout.nav.obstacles) {
        expect(nav!.obstacles.find((entry) => entry.id === obstacle.id)?.flags).toEqual({
          movement: obstacle.blocks_movement, sight: obstacle.blocks_sight, projectiles: obstacle.blocks_projectiles,
        });
      }
      expect(checkSpawnNavigation(spawns, id, E.combat_arena.player_start, 0.3)).toEqual([]);
    }
  });

  it('resolves authored obstacles into independent kernel flags', () => {
    const model = withNav(openNav({ obstacles: [
      obstacle({ id: 'rock', blocks_projectiles: false }),
      obstacle({ id: 'canopy', kind: 'box', x: 30, y: 20, width: 4, height: 3, radius: undefined,
        blocks_movement: false, blocks_sight: true, blocks_projectiles: false }),
    ] }));
    const nav = model.navigation('fixture-layout')!;
    expect(nav).toMatchObject({
      version: 1, cellSize: 1,
      bounds: { x: 0, y: 0, width: fixtureContext.arena.width, height: fixtureContext.arena.height },
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
    const nav = model.navigation('fixture-layout')!;
    for (const point of model.pointsFor(101)) expect(isClear(nav, point, 0.3)).toBe(true);
    expect(checkSpawnNavigation(model, 'fixture-layout', fixtureContext.playerStart, 0.3)).toEqual([]);
  });

  it('reports an authored obstacle that covers a home', () => {
    const point = fixtureData().layouts['fixture-layout'].points[0];
    const model = withNav(openNav({ obstacles: [
      obstacle({ id: 'boulder', kind: 'box', x: point.x - 2, y: point.y - 2, width: 4, height: 4 }),
    ] }));
    expect(checkSpawnNavigation(model, 'fixture-layout', fixtureContext.playerStart, 0.3))
      .toContainEqual({ pointId: point.id, reason: 'blocked' });
  });

  it('keeps a sight-only obstacle walkable', () => {
    const point = fixtureData().layouts['fixture-layout'].points[0];
    const model = withNav(openNav({ obstacles: [
      obstacle({ id: 'canopy', kind: 'box', x: point.x - 2, y: point.y - 2, width: 4, height: 4,
        blocks_movement: false, blocks_sight: true, blocks_projectiles: false }),
    ] }));
    expect(checkSpawnNavigation(model, 'fixture-layout', fixtureContext.playerStart, 0.3)).toEqual([]);
  });

  it('proves authored homes reachable around inline obstacle ground', () => {
    const model = withNav(openNav({ obstacles: [
      obstacle({ id: 'ridge-north', kind: 'box', x: 24, y: 0, width: 2.5, height: 13, radius: undefined }),
      obstacle({ id: 'ridge-south', kind: 'box', x: 24, y: 19, width: 2.5, height: 13.0513, radius: undefined }),
      obstacle({ id: 'thicket', kind: 'circle', x: 37, y: 16, radius: 2.5,
        blocks_sight: false, blocks_projectiles: false }),
    ] }));
    const nav = model.navigation('fixture-layout');
    expect(nav).not.toBeNull();
    expect(nav!.obstacles.map((o) => o.id).sort())
      .toEqual(['ridge-north', 'ridge-south', 'thicket']);
    for (const point of model.pointsFor(101)) expect(isClear(nav!, point, 0.3)).toBe(true);
    expect(checkSpawnNavigation(model, 'fixture-layout', fixtureContext.playerStart, 0.3)).toEqual([]);
  });
});
