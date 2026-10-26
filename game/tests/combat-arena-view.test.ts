import { describe, expect, it } from 'vitest';
import type { CombatArena, CombatArenaAction, CombatArenaActor } from '../src/sim/combat-arena';
import type { FxEvent } from '../src/sim/types';
import type { ArenaSpriteSheet } from '../src/ui/combat/arena/arena-art';
import { arenaActorAction, arenaActorPixelScale, arenaCameraOffset, arenaDirection, arenaEventTiming, arenaFieldNote, arenaPlaybackTime, arenaRangedShots, arenaSpriteFrame, projectArenaPoint, unprojectArenaPoint } from '../src/ui/combat/combat-arena-view';
import { projectVfxFootprint } from '../src/ui/combat/arena-vfx-space';

const sheet: ArenaSpriteSheet = { href: '/test.png', frameWidth: 128, frameHeight: 128, columns: 4, rows: 4, frames: 4, frameMs: 100, loop: true };

describe('arena camera and playback', () => {
  it('keeps the followed actor visible at every ground corner and preserves pointer coordinates', () => {
    for (const x of [0, 18]) for (const y of [0, 12]) {
      const point = projectArenaPoint({ x, y });
      const camera=arenaCameraOffset({x,y});
      expect(point.x-camera.x).toBeGreaterThan(1920 * .28);
      expect(point.x-camera.x).toBeLessThan(1920 * .78);
      expect(point.y-camera.y).toBeGreaterThan(1080 * .25);
      expect(point.y-camera.y).toBeLessThan(1080 * .73);
      const world=unprojectArenaPoint({x:point.x-camera.x+camera.x,y:point.y-camera.y+camera.y});
      expect(world.x).toBeCloseTo(x);expect(world.y).toBeCloseTo(y);
    }
    expect(projectArenaPoint({ x: 9, y: 7 }).y).toBeGreaterThan(projectArenaPoint({ x: 9, y: 6 }).y);
  });

  it('uses a half-meter idle footprint so a six-meter area spans twelve actors', () => {
    const origin=projectArenaPoint({x:0,y:0}),x=projectArenaPoint({x:6,y:0}),y=projectArenaPoint({x:0,y:6});
    const diameter=Math.hypot(x.x-origin.x,y.x-origin.x);
    for(const idleWidth of [70,115,155,230]) expect(diameter/(idleWidth*arenaActorPixelScale(idleWidth,1))).toBeCloseTo(12);
  });

  it('frames the player and current target together without changing their ground positions', () => {
    const player={x:8,y:6},target={x:12,y:7},camera=arenaCameraOffset(player,target);
    const a=projectArenaPoint(player),b=projectArenaPoint(target);
    expect((a.x+b.x)/2-camera.x).toBeCloseTo(1040);
    expect((a.y+b.y)/2-camera.y).toBeCloseTo(530);
  });

  it('plays exactly the received second at all speeds and cannot run beyond resolved simulation', () => {
    expect(arenaPlaybackTime(10_000_000, 1_000_000, 500, 1)).toBe(9_500_000);
    expect(arenaPlaybackTime(10_000_000, 1_000_000, 125, 4)).toBe(9_500_000);
    expect(arenaPlaybackTime(10_000_000, 1_000_000, 500, 4)).toBe(10_000_000);
    expect(arenaPlaybackTime(0, 1_000_000, 0, 1)).toBe(0);
    expect(arenaPlaybackTime(10_000_000, 1_000_000, 500, 1, true)).toBe(9_000_000);
  });

  it('uses only received actor actions, preserving the contact timestamp', () => {
    const action: CombatArenaAction = { id: 1, actorId: 'player', kind: 'swing', atUs: 1_000_000, endsAtUs: 1_200_000, x: 1, y: 1 };
    const arena = { unitsPerSec: 1_000_000, actions: [action] } as CombatArena;
    const actor = { id: 'player' } as CombatArenaActor;
    expect(arenaActorAction(arena, actor, 500_000)).toBeUndefined();
    expect(arenaActorAction(arena, actor, 800_000)).toBe(action);
    expect(arenaActorAction(arena, actor, 1_000_000)?.atUs).toBe(1_000_000);
    expect(arenaActorAction(arena, { id: 'other' } as CombatArenaActor, 1_000_000)).toBeUndefined();
    expect(arenaActorAction(arena, actor, 1_300_000)).toBeUndefined();
  });

  it('uses the nearest available facing and row-major atlas clips without changing anchors', () => {
    expect(arenaDirection(0, { east: sheet, west: sheet })).toBe('east');
    expect(arenaDirection(Math.PI, { east: sheet, west: sheet })).toBe('west');
    expect(arenaDirection(Math.PI / 2, { east: sheet })).toBe('east');
    expect(arenaSpriteFrame({ ...sheet, startFrame: 4 }, 250)).toBe('256 128 128 128');
    expect(arenaSpriteFrame({ ...sheet, startFrame: 4 }, 450)).toBe('0 128 128 128');
    expect(arenaSpriteFrame({ ...sheet, startFrame: 4, loop: false }, 900)).toBe('384 128 128 128');
    expect(arenaSpriteFrame({ ...sheet, startFrame: 4 }, 250, true)).toBe('0 128 128 128');
  });

  it('names a camp push before the field reads as quiet', () => {
    expect(arenaFieldNote({ phase: 'camp', hunting: true, walk: null, group: [] }))
      .toEqual({ text: 'Pushed to camp · recovering', camp: true });
    expect(arenaFieldNote({ phase: 'fighting', hunting: false, walk: null, group: [] }))
      .toEqual({ text: 'The clearing is quiet.', camp: false });
    expect(arenaFieldNote({ phase: 'fighting', hunting: true, walk: null, group: [] })).toBeNull();
    expect(arenaFieldNote({ phase: 'fighting', hunting: false, walk: { blocksLeft: 1 }, group: [] })).toBeNull();
  });

  it('reads a live action timing over a stale event snapshot and keeps history snapshots', () => {
    const planned = { delivery: 'projectile' as const, startedAtUs: 0, releaseAtUs: 250_000,
      impactAtUs: 900_000, recoveryUntilUs: 500_000 };
    const action: CombatArenaAction = { id: 7, actorId: 'player', kind: 'cast', atUs: 0,
      endsAtUs: 1_000_000, x: 1, y: 1, timing: { ...planned, impactAtUs: 720_000 } };
    const arena = { actions: [action] } as CombatArena;
    const event = { id: 1, sec: 0, kind: 'cast', text: 'Fireball', colour: '#fff',
      actionId: 7, castTiming: planned } as FxEvent;
    expect(arenaEventTiming(event, arena)?.impactAtUs).toBe(720_000);
    expect(arenaEventTiming({ ...event, actionId: 99 }, arena)?.impactAtUs).toBe(900_000);
  });

  it('interpolates a released mob shot only inside its committed lifetime', () => {
    const timing = { delivery: 'projectile' as const, startedAtUs: 0, releaseAtUs: 1_000_000,
      impactAtUs: 2_000_000, recoveryUntilUs: 1_000_000 };
    const action: CombatArenaAction = { id: 3, actorId: 'archer', kind: 'swing', atUs: 1_000_000,
      endsAtUs: 2_000_000, x: 4, y: 6, targetX: 1, targetY: 6, ranged: true, timing };
    const arena = { actions: [action], unitsPerSec: 1_000_000,
      mobs: { archer: { mob: { damage: 'physical', innate: [] } } } } as unknown as CombatArena;
    expect(arenaRangedShots(arena, 500_000)).toHaveLength(0);
    expect(arenaRangedShots(arena, 1_500_000)[0]).toMatchObject({ x: 2.5, y: 6, element: null });
    expect(arenaRangedShots(arena, 2_000_000)).toHaveLength(1);
    expect(arenaRangedShots(arena, 2_500_000)).toHaveLength(0);
  });

  it('projects line and cone footprints with their committed direction', () => {
    const line = projectVfxFootprint({ origin: 'caster', radiusM: 0, center: { x: 9, y: 6 },
      targetId: 'a', shape: 'line', lengthM: 5.2, widthM: 0.75, directionRad: 0 });
    expect(line).toMatchObject({ shape: 'line', lengthM: 5.2, widthM: 0.75, directionRad: 0 });
    expect(line?.worldCenter).toEqual({ x: 9, y: 6 });
    const cone = projectVfxFootprint({ origin: 'caster', radiusM: 2.1, center: { x: 9, y: 6 },
      targetId: 'a', shape: 'cone', lengthM: 2.1, angleDeg: 120, directionRad: Math.PI / 2 });
    expect(cone).toMatchObject({ shape: 'cone', angleDeg: 120, directionRad: Math.PI / 2 });
    expect(projectVfxFootprint({ origin: 'target', radiusM: 0, center: { x: 9, y: 6 }, targetId: 'a' }))
      .toBeUndefined();
  });
});
