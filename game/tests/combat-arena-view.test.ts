import { describe, expect, it } from 'vitest';
import type { CombatArena, CombatArenaAction, CombatArenaActor, CombatArenaFrame } from '../src/sim/combat/combat-arena';
import type { FxEvent } from '../src/sim/core/types';
import type { ArenaSpriteSheet } from '../src/ui/combat/arena/arena-art';
import { arenaActionPose, arenaActorAction, arenaActorPixelScale, arenaCameraOffset, arenaDirection, arenaEventTiming, arenaFacingSector, arenaFieldNote, arenaPlaybackTime, arenaRangedShots, arenaScreenAngle, arenaSpriteFrame, createArenaGait, projectArenaPoint, projectArenaVector, unprojectArenaPoint } from '../src/ui/combat/combat-arena-view';
import { groundShapePath, projectVfxFootprint } from '../src/ui/combat/arena-vfx-space';
import { createCombatArena, captureCombatArena, sampleCombatArena } from '../src/sim/combat/combat-arena';
import { newGame } from '../src/sim/core/game';
import { ARENA_DIRECTIONS } from '../src/presentation/arena-camera';
import { arenaPayloadSample, arenaPresentationArea, arenaReleaseSocket } from '../src/ui/combat/combat-arena-view';

const sheet: ArenaSpriteSheet = { href: '/test.png', frameWidth: 128, frameHeight: 128, columns: 4, rows: 4, frames: 4, frameMs: 100, loop: true };

describe('arena camera and playback', () => {
  it('reconstructs facing from captured checkpoints across seeks and history trimming', () => {
    const arena = createCombatArena(), state = newGame(41);
    state.group = [];
    for (const [atUs, facing] of [[0, 0], [100_000, .9], [200_000, 1.2], [300_000, .9]]) {
      arena.player.facing = facing;
      captureCombatArena(arena, state, atUs);
    }
    const at = (time: number) => {
      const actor = sampleCombatArena(arena, time).player;
      return arenaFacingSector(actor.facing, ARENA_DIRECTIONS[actor.facingSector!]);
    };
    expect(at(100_000)).toBe('east');
    expect(at(300_000)).toBe('south-east');
    expect(at(100_000)).toBe('east');
    arena.frames = arena.frames.slice(1);
    expect(at(100_000)).toBe('east');
    expect(at(300_000)).toBe('south-east');
  });
  it('places release sockets relative to the foot anchor, including mirrored art', () => {
    const release = { ...sheet, releaseSocket: { x: 90, y: 40, provenance: 'measured' as const } };
    expect(arenaReleaseSocket(release, { x: 64, y: 100 }, { x: 500, y: 400 }, 2))
      .toEqual({ x: 552, y: 280, provenance: 'measured' });
    expect(arenaReleaseSocket({ ...release, mirror: true }, { x: 64, y: 100 }, { x: 500, y: 400 }, 2)?.x).toBe(448);
    expect(arenaReleaseSocket(sheet, { x: 64, y: 100 }, { x: 500, y: 400 }, 2)).toBeUndefined();
  });
  it('moves channel art with sampled feet while preserving a deployed field centre', () => {
    const area = { origin: 'caster' as const, radiusM: 2, center: { x: 1, y: 2 }, targetId: 'a' };
    const action = { actorId: 'player', channel: true, area } as CombatArenaAction;
    const frame = { player: { x: 3, y: 4 } } as CombatArenaFrame;
    expect(arenaPresentationArea(action, frame)?.center).toEqual({ x: 3, y: 4 });
    expect(arenaPresentationArea({ ...action, channel: false }, frame)?.center).toEqual({ x: 1, y: 2 });
    expect(area.center).toEqual({ x: 1, y: 2 });
  });
  it('keeps a projectile prefix fixed when an early contact corrects its terminal receipt', () => {
    const planned = { index: 0, source: { x: 0, y: 0 }, destination: { x: 10, y: 0 },
      releaseAtUs: 0, plannedImpactAtUs: 1_000_000 };
    const corrected = { ...planned, impactAtUs: 400_000, contact: { x: 4, y: 0 } };
    expect(arenaPayloadSample(corrected, 200_000).position).toEqual(arenaPayloadSample(planned, 200_000).position);
    expect(arenaPayloadSample(corrected, 400_000).position).toEqual({ x: 4, y: 0 });
    expect(arenaPayloadSample(corrected, 400_000).progress).toBeCloseTo(.4);
  });
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
    expect(arenaDirection(Math.PI / 2, { east: sheet, west: sheet })).toBe('east');
    expect(arenaSpriteFrame({ ...sheet, startFrame: 4 }, 250)).toBe('256 128 128 128');
    expect(arenaSpriteFrame({ ...sheet, startFrame: 4 }, 450)).toBe('0 128 128 128');
    expect(arenaSpriteFrame({ ...sheet, startFrame: 4, loop: false }, 900)).toBe('384 128 128 128');
    expect(arenaSpriteFrame({ ...sheet, startFrame: 4 }, 250, true)).toBe('0 128 128 128');
    expect(arenaSpriteFrame({ ...sheet, impactMs: 200 }, 0, true)).toBe('256 0 128 128');
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

  it('preserves sub-meter circle, line and cone dimensions without a visual minimum', () => {
    const center = { x: 9, y: 6 };
    const unit = projectArenaVector({ x: 1, y: 0 });
    for (const radiusM of [.1, .25, .75, 2]) {
      const area = projectVfxFootprint({ origin: 'target', radiusM, center, targetId: 'a' })!;
      expect(area.basisX.x).toBeCloseTo(unit.x * radiusM, 8);
      expect(area.basisX.y).toBeCloseTo(unit.y * radiusM, 8);
    }
    for (const shape of ['line', 'cone'] as const) {
      const area = projectVfxFootprint({ origin: 'caster', radiusM: .4, center, targetId: 'a',
        shape, lengthM: .4, widthM: .1, angleDeg: 60, directionRad: 0 })!;
      expect(area.basisX.x).toBeCloseTo(unit.x * .4, 8);
      expect(area.basisX.y).toBeCloseTo(unit.y * .4, 8);
    }
  });

  it('round-trips every ground point and keeps vectors on the same camera algebra', () => {
    for (let x = 0; x <= 18; x += 1.5) for (let y = 0; y <= 12; y += 1.5) {
      const screen = projectArenaPoint({ x, y });
      const world = unprojectArenaPoint(screen);
      expect(world.x).toBeCloseTo(x, 9);
      expect(world.y).toBeCloseTo(y, 9);
    }
    const origin = projectArenaPoint({ x: 5, y: 5 });
    for (const angle of [0, .4, 1.2, Math.PI / 2, 2.4, Math.PI, -2.1, -0.7]) {
      const v = { x: Math.cos(angle), y: Math.sin(angle) };
      const projected = projectArenaVector(v);
      const step = projectArenaPoint({ x: 5 + v.x, y: 5 + v.y });
      expect(projected.x).toBeCloseTo(step.x - origin.x, 9);
      expect(projected.y).toBeCloseTo(step.y - origin.y, 9);
      expect(arenaScreenAngle({ x: 0, y: 0 }, v)).toBeCloseTo(Math.atan2(projected.y, projected.x) * 180 / Math.PI, 9);
    }
  });

  it('maps a timed action through windup, contact and recovery without guessing one atUs', () => {
    const attackSheet = { ...sheet, impactMs: 200 };
    const action: CombatArenaAction = {
      id: 4, actorId: 'player', kind: 'cast', atUs: 0, endsAtUs: 2_000_000, x: 1, y: 1,
      timing: { delivery: 'melee', startedAtUs: 0, releaseAtUs: 500_000, impactAtUs: 500_000, recoveryUntilUs: 900_000 },
    };
    const at = (us: number) => arenaActionPose(action, us, 1_000_000, attackSheet);
    expect(at(-1)).toBeUndefined();
    expect(at(0)).toMatchObject({ phase: 'windup', elapsedMs: 0 });
    expect(at(250_000)).toMatchObject({ phase: 'windup', elapsedMs: 100 });
    expect(at(500_000)).toMatchObject({ phase: 'contact', elapsedMs: 200 });
    expect(at(600_000)).toMatchObject({ phase: 'recovery', elapsedMs: 300 });
    expect(at(700_000)).toMatchObject({ phase: 'recovery', elapsedMs: 400 });
    expect(at(900_000)).toBeUndefined();
  });

  it('cuts a cancelled action at its receipt and never plays the tail', () => {
    const attackSheet = { ...sheet, impactMs: 200 };
    const action: CombatArenaAction = {
      id: 5, actorId: 'player', kind: 'cast', atUs: 0, endsAtUs: 2_000_000, x: 1, y: 1,
      timing: { delivery: 'melee', startedAtUs: 0, releaseAtUs: 500_000, impactAtUs: 500_000, recoveryUntilUs: 900_000 },
      cancelledAtUs: 600_000, cancelReason: 'shock',
    };
    expect(arenaActionPose(action, 520_000, 1_000_000, attackSheet)?.phase).toBe('contact');
    expect(arenaActionPose(action, 600_000, 1_000_000, attackSheet)).toBeUndefined();
    expect(arenaActionPose(action, 800_000, 1_000_000, attackSheet)).toBeUndefined();
  });

  it('does not invent anticipation before an instantaneous action or extend primary recovery', () => {
    const action: CombatArenaAction = { id: 20, actorId: 'player', kind: 'cast', atUs: 1_000_000,
      endsAtUs: 2_000_000, x: 1, y: 1, timing: { delivery: 'instant', startedAtUs: 1_000_000,
        releaseAtUs: 1_000_000, impactAtUs: 1_000_000, recoveryUntilUs: 1_030_000 } };
    expect(arenaActionPose(action, 999_999, 1_000_000, sheet)).toBeUndefined();
    expect(arenaActionPose(action, 1_000_000, 1_000_000, sheet)).toBeDefined();
    expect(arenaActionPose(action, 1_030_000, 1_000_000, sheet)).toBeUndefined();
  });

  it('does not let a later burst launch take over the caster recovery', () => {
    const primaryTiming = { delivery: 'projectile' as const, startedAtUs: 0, releaseAtUs: 200_000,
      impactAtUs: 900_000, recoveryUntilUs: 400_000 };
    const action = { id: 21, actorId: 'player', kind: 'cast', atUs: 0, endsAtUs: 2_000_000, x: 0, y: 0,
      primaryTiming, timing: { ...primaryTiming, releaseAtUs: 350_000, impactAtUs: 1_050_000, recoveryUntilUs: 550_000 } } as CombatArenaAction;
    expect(arenaActionPose(action, 200_000, 1_000_000, sheet)?.releasedAtUs).toBe(200_000);
    expect(arenaActionPose(action, 400_000, 1_000_000, sheet)).toBeUndefined();
  });

  it('keeps a non-blocking trigger out of the primary pose', () => {
    const primary: CombatArenaAction = { id: 6, actorId: 'player', kind: 'swing', atUs: 1_000_000, endsAtUs: 1_300_000, x: 1, y: 1 };
    const trigger: CombatArenaAction = { id: 7, actorId: 'player', kind: 'cast', atUs: 400_000, endsAtUs: 900_000, x: 1, y: 1, nonblocking: true };
    const arena = { unitsPerSec: 1_000_000, actions: [primary, trigger], nowUs: 1_300_000, mobs: {} } as unknown as CombatArena;
    const actor = { id: 'player' } as CombatArenaActor;
    expect(arenaActorAction(arena, actor, 500_000)).toBeUndefined();
    expect(arenaActorAction(arena, actor, 1_000_000)).toBe(primary);
  });

  it('does not expose a later interception target to an earlier sampled pose', () => {
    const earlier = { id: 30, actorId: 'player', kind: 'swing', atUs: 1_000_000, endsAtUs: 1_300_000,
      x: 0, y: 0, targetId: 'original' } as CombatArenaAction;
    const latest = { ...earlier, targetId: 'interceptor' };
    const arena = { actions: [latest], unitsPerSec: 1_000_000 } as CombatArena;
    expect(arenaActorAction(arena, { id: 'player', action: earlier } as CombatArenaActor, 900_000)?.targetId).toBe('original');
    expect(arenaActorAction(arena, { id: 'player', action: latest } as CombatArenaActor, 1_100_000)?.targetId).toBe('interceptor');
  });

  it('derives walk phase from voluntary distance and rebuilds it on a backward seek', () => {
    const frame = (atUs: number, x: number, moving: boolean, voluntaryM?: number): CombatArenaFrame => ({
      atUs, player: { id: 'player', x: 0, y: 0, facing: 0, moving: false, radiusM: .25, hp: 1, hpMax: 1 },
      mobs: { a: { id: 'a', x, y: 0, facing: 0, moving, voluntaryM, radiusM: .25, hp: 1, hpMax: 1 } }, bodies: [],
    });
    const arena = { frames: [frame(0, 0, false), frame(100_000, .1, true), frame(200_000, .2, true),
      frame(300_000, .5, false), frame(400_000, .8, false), frame(500_000, 1.2, true, .1)] } as unknown as CombatArena;
    const gait = createArenaGait(.62);
    expect(gait.sample(arena, 'a', 200_000).distanceM).toBeCloseTo(.2, 9);
    expect(gait.sample(arena, 'a', 400_000).distanceM).toBeCloseTo(.2, 9);
    expect(gait.sample(arena, 'a', 500_000).distanceM).toBeCloseTo(.3, 9);
    expect(gait.sample(arena, 'a', 200_000).distanceM).toBeCloseTo(.2, 9);
    expect(gait.sample(arena, 'a', 200_000).phase).toBeCloseTo(.2 / .62 % 1, 9);
    expect(gait.sample(arena, 'missing', 400_000).distanceM).toBe(0);
  });

  it('applies direction hysteresis only inside the presentation deadband', () => {
    expect(arenaFacingSector(0)).toBe('east');
    expect(arenaFacingSector(.9)).toBe('south-east');
    expect(arenaFacingSector(.9, 'east')).toBe('east');
    expect(arenaFacingSector(1.2, 'east')).toBe('south-east');
  });

  it('interpolates the player gait and retains its checkpoint after history trimming', () => {
    const frame = (atUs: number, travelledM: number) => ({ atUs,
      player: { id: 'player', travelledM, lastMovedAtUs: atUs }, mobs: {}, bodies: [] }) as unknown as CombatArenaFrame;
    const arena = { frames: [frame(0, 0), frame(100_000, .1), frame(200_000, .3), frame(300_000, .4)] } as CombatArena;
    const gait = createArenaGait(.62);
    expect(gait.sample(arena, 'player', 150_000).distanceM).toBeCloseTo(.2);
    expect(gait.sample(arena, 'player', 300_000).distanceM).toBeCloseTo(.4);
    arena.frames = arena.frames.slice(1);
    expect(gait.sample(arena, 'player', 150_000).distanceM).toBeCloseTo(.2);
    expect(createArenaGait(.62).sample(arena, 'player', 150_000).phase).toBeCloseTo(.2 / .62);
  });

  it('rotates a mob shot on the projected ground axis, not the world angle', () => {
    const timing = { delivery: 'projectile' as const, startedAtUs: 0, releaseAtUs: 0,
      impactAtUs: 1_000_000, recoveryUntilUs: 0 };
    const action: CombatArenaAction = { id: 9, actorId: 'archer', kind: 'swing', atUs: 0,
      endsAtUs: 1_000_000, x: 1, y: 6, targetX: 1, targetY: 2, ranged: true, timing };
    const arena = { actions: [action], unitsPerSec: 1_000_000,
      mobs: { archer: { mob: { damage: 'physical', innate: [] } } } } as unknown as CombatArena;
    const shot = arenaRangedShots(arena, 500_000)[0];
    expect(shot.actorId).toBe('archer');
    expect(shot.angle).toBeCloseTo(Math.atan2(-120, -40) * 180 / Math.PI, 6);
    expect(shot.angle).not.toBeCloseTo(-90, 1);
  });

  it('holds anticipation through a long preparation instead of slowing the strike', () => {
    const attackSheet = { ...sheet, impactMs: 200 };
    const action: CombatArenaAction = {
      id: 8, actorId: 'mob', kind: 'cast', atUs: 0, endsAtUs: 2_000_000, x: 1, y: 1,
      timing: { delivery: 'melee', startedAtUs: 0, releaseAtUs: 1_000_000, impactAtUs: 1_000_000, recoveryUntilUs: 1_100_000 },
    };
    expect(arenaActionPose(action, 50_000, 1_000_000, attackSheet)?.elapsedMs).toBeCloseTo(50, 6);
    expect(arenaActionPose(action, 500_000, 1_000_000, attackSheet)?.elapsedMs).toBeCloseTo(100, 6);
    expect(arenaActionPose(action, 1_000_000, 1_000_000, attackSheet)).toMatchObject({ phase: 'contact', elapsedMs: 200 });
  });

  it('projects a single, circle, line and cone footprint on the ground plane', () => {
    expect(groundShapePath({ origin: 'target', radiusM: 0, center: { x: 9, y: 6 }, targetId: 'a' })).toMatch(/^M/);
    expect(groundShapePath({ origin: 'target', radiusM: 2, center: { x: 9, y: 6 }, targetId: 'a' })).toMatch(/Z$/);
    const line = groundShapePath({ origin: 'caster', radiusM: 0, center: { x: 9, y: 6 }, targetId: 'a',
      shape: 'line', lengthM: 4, widthM: 1, directionRad: 0 });
    expect((line.match(/L/g) ?? []).length).toBe(3);
    const cone = groundShapePath({ origin: 'caster', radiusM: 3, center: { x: 9, y: 6 }, targetId: 'a',
      shape: 'cone', lengthM: 3, angleDeg: 90, directionRad: 0 });
    expect((cone.match(/L/g) ?? []).length).toBe(21);
  });
});
