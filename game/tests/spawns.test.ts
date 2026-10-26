import { describe, expect, it } from 'vitest';
import { E, SPAWNS, eng, spawns } from '../src/engine/client';
import { createSpawns } from '../../engine/spawns.ts';

const context = () => ({
  arena: E.combat_arena,
  playerStart: E.combat_arena.player_start,
  zones: E.mob.zones,
});

describe('field spawn data', () => {
  it('covers every live zone and subzone with one validated layout', () => {
    expect(spawns.coverage).toEqual({ zones: 18, subzones: 54, layouts: 1, points: 8 });
    for (const zone of E.mob.zones) {
      const profile = spawns.profileFor(zone.id);
      expect(profile.cap).toBeLessThanOrEqual(spawns.layout(profile.layout).points.length);
      expect(profile.cap).toBeGreaterThan(0);
      expect(profile.respawn_sec).toBeGreaterThan(0);
      expect(profile.aggro_m).toBeGreaterThan(0);
      expect(profile.assist_m).toBeGreaterThanOrEqual(0);
      expect(profile.leash_m).toBeGreaterThanOrEqual(profile.aggro_m);
      expect(profile.camp_safe_m).toBeGreaterThanOrEqual(0);
      expect(profile.offline_share).toBeGreaterThanOrEqual(0);
      expect(profile.offline_share).toBeLessThanOrEqual(1);
      expect(new Set(spawns.pointsFor(zone.id).map((point) => point.id)).size).toBe(8);
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

  it('keeps the authored population supply within five percent of the band kill target', () => {
    for (const zone of E.mob.zones) {
      const [lo, hi] = eng.groupRangeOf(zone.id);
      const expected = (lo + hi) / 2;
      const target = 3600 / (expected * E.loot.ttk_per_mob_sec + E.loot.group_spawn_sec) * expected;
      const profile = spawns.profileFor(zone.id);
      const supply = 3600 * profile.cap / profile.respawn_sec;
      expect(Math.abs(supply - target) / target).toBeLessThan(0.05);
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
    outside.layouts['forest-clearing'].points[0].x = 17.8;
    expect(() => createSpawns(outside, context())).toThrow(/spawns\.json: layouts\.forest-clearing\.west-north/);

    const unknown = structuredClone(SPAWNS) as unknown as Record<string, any>;
    unknown.subzones['1:99'] = { cap: 2 };
    expect(() => createSpawns(unknown, context())).toThrow(/spawns\.json: subzones\.1:99 names no authored/);

    const unknownZone = structuredClone(SPAWNS) as unknown as Record<string, any>;
    unknownZone.zones['99'] = { cap: 2 };
    expect(() => createSpawns(unknownZone, context())).toThrow(/spawns\.json: zones\.99 names no authored zone/);
  });
});
