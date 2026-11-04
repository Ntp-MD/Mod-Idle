import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { skillAreaSnapshot } from '@engine/skill-area';
import { createCombatArena, type CombatArenaAction } from '@sim/combat/combat-arena';
import { ARENA_VIEW, projectArenaPoint } from '../../src/presentation/arena-camera';
import { skillActionGeometry } from '../../src/ui/combat/skill-geometry';
import { buildSkillVfxAim, sampleVfxOffset } from '../../src/ui/combat/arena-vfx-space';
import { atlasFrameIndex, atlasImpactDuration, atlasOpacity, skillArtPlacement, skillArtFor } from '../../src/ui/combat/arena-skill-art';
import { liveId } from '../fixtures/liveSkill';

const VFX_CONE = liveId(row => row.area?.shape === 'cone' && row.cast?.delivery === 'melee' && !!skillArtFor(row.id)?.atlas, 'vfx cone');
const VFX_LINE = liveId(row => row.area?.shape === 'line' && row.cast?.delivery === 'ground' && !!skillArtFor(row.id)?.atlas, 'vfx line');
const VFX_PROJECTILE = liveId(row => row.cast?.delivery === 'projectile' && !row.action && (row.area?.radius_m ?? 0) === 0 && !!skillArtFor(row.id)?.atlas, 'vfx projectile');
const VFX_SELF_GROUND = liveId(row => row.cast?.delivery === 'ground' && row.area?.origin === 'caster' && row.area.radius_m > 0 && !row.action && !!skillArtFor(row.id)?.atlas, 'vfx self ground');
const VFX_SELF_INSTANT = liveId(row => row.cast?.delivery === 'instant' && row.area?.origin === 'caster' && row.area.radius_m > 0 && !row.action && !!skillArtFor(row.id)?.atlas, 'vfx self instant');

const fixture = (skillId: string) => {
  const arena = createCombatArena();
  Object.assign(arena.player, { x: 1, y: 2 });
  const skill = sm.byId[skillId];
  const action: CombatArenaAction = {
    id: 1, kind: 'cast', actorId: 'player', skillId, targetId: 'target', x: 1, y: 2, channel: skill.action?.kind === 'ray-channel',
    targetX: 4, targetY: 2, atUs: 0, endsAtUs: 10_000_000,
    area: skillAreaSnapshot(skill.area ?? { origin: 'target', radius_m: 0 }, arena.player, { x: 4, y: 2 }, 'target'),
    timing: { delivery: 'projectile', startedAtUs: 0, releaseAtUs: 1_000_000,
      impactAtUs: 2_000_000, recoveryUntilUs: 2_500_000 },
  };
  return { arena, action };
};

describe('the shared VFX aim contract', () => {
  it('gives every live attack a finite hand release and a body or ground impact', () => {
    const attacks = sm.all().filter((skill: any) => skill.type === 'attack' && !skill.retired);
    expect(attacks.length).toBeGreaterThan(40);
    for (const skill of attacks) {
      const { arena, action } = fixture(skill.id);
      const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
      const aim = mark.vfxAim;
      for (const point of [aim.release, aim.impact, aim.groundImpact]) {
        expect(Number.isFinite(point.x), skill.id).toBe(true);
        expect(Number.isFinite(point.y), skill.id).toBe(true);
      }
      expect(Number.isFinite(aim.directionRad), skill.id).toBe(true);
      expect(Number.isFinite(aim.screenAngleRad), skill.id).toBe(true);
      expect([-1, 1]).toContain(aim.mirror);
      const directed = mark.area.shape === 'line' || mark.area.shape === 'cone';
      const single = !directed && mark.area.radiusM <= 0;
      expect(aim.bodyImpact, skill.id).toBe(single);
      const source = projectArenaPoint({ x: action.x, y: action.y });
      expect(aim.release.y, skill.id).toBeLessThan(source.y - 18);
    }
  });

  it('takes the authored hand socket release when the scene provides one', () => {
    const { arena, action } = fixture(VFX_PROJECTILE);
    const socket = { x: 777, y: 333 };
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec, undefined, undefined, { player: socket })!;
    expect(mark.vfxAim.release).toEqual(socket);
    const direct = buildSkillVfxAim(mark.area, { x: 1, y: 2 }, { x: 4, y: 2 }, socket);
    expect(direct.release).toEqual(socket);
  });

  it('keeps the release in front of the caster and the body impact above the ground point', () => {
    const aim = buildSkillVfxAim({ origin: 'target', radiusM: 0, center: { x: 4, y: 2 } } as any,
      { x: 1, y: 2 }, { x: 4, y: 2 });
    expect(aim.bodyImpact).toBe(true);
    expect(aim.impact.y).toBeLessThan(aim.groundImpact.y);
    expect(aim.release.x).not.toBe(1);
    expect(aim.mirror).toBe(1);
  });

  it('samples cones forward and lines along their axis', () => {
    const cone = sm.byId[VFX_CONE];
    const area = skillAreaSnapshot(cone.area!, { x: 1, y: 2 }, { x: 4, y: 2 }, 'target');
    const half = (cone.area!.angle_deg ?? 90) * Math.PI / 360;
    const direction = area.directionRad!;
    for (let i = 0; i < 200; i++) {
      const point = sampleVfxOffset(area, () => (i + 1) / 201);
      const angle = Math.atan2(point.y, point.x);
      const delta = Math.abs(Math.atan2(Math.sin(angle - direction), Math.cos(angle - direction)));
      expect(delta).toBeLessThanOrEqual(half + 1e-9);
      expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(area.radiusM + 1e-9);
    }
    const line = sm.byId[VFX_LINE];
    const lineArea = skillAreaSnapshot(line.area!, { x: 1, y: 2 }, { x: 5, y: 2 }, 'target');
    const lineDirection = lineArea.directionRad!;
    for (let i = 0; i < 100; i++) {
      const point = sampleVfxOffset(lineArea, () => (i + 1) / 101);
      const along = point.x * Math.cos(lineDirection) + point.y * Math.sin(lineDirection);
      const across = -point.x * Math.sin(lineDirection) + point.y * Math.cos(lineDirection);
      expect(along).toBeGreaterThanOrEqual(0);
      expect(along).toBeLessThanOrEqual(lineArea.lengthM! + 1e-9);
      expect(Math.abs(across)).toBeLessThanOrEqual(lineArea.widthM! / 2 + 1e-9);
    }
  });

  it('places atlas art on the authored anchor and rotates directional art to the aim', () => {
    const cone = fixture(VFX_CONE);
    const coneMark = skillActionGeometry(cone.action, cone.arena, 1_500_000, cone.arena.unitsPerSec)!;
    const coneAtlas = skillArtFor(VFX_CONE)!.atlas!;
    const conePlacement = skillArtPlacement(coneMark, coneAtlas);
    expect(conePlacement.width).toBeGreaterThan(24);
    expect(conePlacement.height).toBeGreaterThan(20);
    expect(conePlacement.anchorX).toBeGreaterThanOrEqual(0);
    expect(conePlacement.anchorX).toBeLessThanOrEqual(1);
    expect(Math.abs(conePlacement.rotateDeg)).toBeGreaterThan(1);

    const fireball = fixture(VFX_PROJECTILE);
    const fireballMark = skillActionGeometry(fireball.action, fireball.arena, 1_500_000, fireball.arena.unitsPerSec)!;
    const fireballAtlas = skillArtFor(VFX_PROJECTILE)!.atlas!;
    const fireballPlacement = skillArtPlacement(fireballMark, fireballAtlas);
    expect(fireballPlacement.anchorX).toBeCloseTo(fireballAtlas.anchor![0], 9);
    expect(fireballPlacement.cx).toBeGreaterThan(fireballMark.vfxAim.release.x);
    expect(fireballPlacement.cx).toBeLessThan(fireballMark.vfxAim.impact.x);
  });

  it('moves a body-sized projectile from its release socket to the collision, then uses the impact anchor', () => {
    const { arena, action } = fixture(VFX_PROJECTILE);
    const atlas = skillArtFor(VFX_PROJECTILE)!.atlas!;
    const early = skillActionGeometry(action, arena, 1_100_000, arena.unitsPerSec)!;
    const late = skillActionGeometry(action, arena, 1_900_000, arena.unitsPerSec)!;
    const impact = skillActionGeometry(action, arena, 2_000_000, arena.unitsPerSec)!;
    const a = skillArtPlacement(early, atlas);
    const b = skillArtPlacement(late, atlas);
    const hit = skillArtPlacement(impact, atlas);
    expect(a.cx).toBeLessThan(b.cx);
    expect(b.cx).toBeLessThan(hit.cx);
    expect(hit.cx).toBe(impact.vfxAim.impact.x);
    expect(hit.cy).toBe(impact.vfxAim.impact.y);
    expect(hit.anchorX).toBe(atlas.impactAnchor![0]);
    expect(hit.anchorY).toBe(atlas.impactAnchor![1]);
    expect(a.width).toBe(b.width);
    const distant = { ...late, vfxAim: { ...late.vfxAim, impact: { x: late.vfxAim.impact.x + 1000, y: late.vfxAim.impact.y } } };
    expect(skillArtPlacement(distant, atlas).width).toBe(b.width);
  });

  it('keeps travel frames visible and shows the ground-effect peak before the authored fade', () => {
    const fireball = fixture(VFX_PROJECTILE);
    const flying = skillActionGeometry(fireball.action, fireball.arena, 1_200_000, fireball.arena.unitsPerSec)!;
    const projectile = skillArtFor(VFX_PROJECTILE)!.atlas!;
    expect(atlasFrameIndex(flying, projectile)).toBeGreaterThanOrEqual(projectile.frames!.loop![0]);
    expect(atlasFrameIndex(flying, projectile)).toBeLessThanOrEqual(projectile.frames!.loop![1]);
    const ground = fixture(VFX_SELF_GROUND);
    const hit = skillActionGeometry(ground.action, ground.arena, 2_000_000, ground.arena.unitsPerSec)!;
    const atlas = skillArtFor(VFX_SELF_GROUND)!.atlas!;
    expect(atlasFrameIndex(hit, atlas)).toBe(atlas.frames!.loop![0]);
    expect(atlasOpacity(hit, atlas)).toBe(1);
    const faded = { ...hit, phaseElapsedSec: 10 };
    expect(atlasFrameIndex(faded, atlas)).toBe(atlas.count - 1);
    expect(atlasOpacity(faded, atlas)).toBe(0);
    expect(atlasOpacity({ ...hit, phase: 'Windup' }, atlas)).toBe(0);
    expect(atlasOpacity({ ...hit, phase: 'Aim' }, atlas)).toBe(0);
  });

  it('finishes an authored visual tail after recovery without reviving cancelled casts', () => {
    const { arena, action } = fixture(VFX_SELF_GROUND);
    const atlas = skillArtFor(action.skillId!)!.atlas!;
    action.endsAtUs = 2_300_000;
    const read = (at: number) => skillActionGeometry(action, arena, at, arena.unitsPerSec,
      undefined, undefined, undefined, undefined, atlasImpactDuration(atlas));
    expect(read(2_600_000)?.phase).toBe('Impact');
    // Aftershock carries a 6s window: the circle outlives recovery until the duration ends.
    expect(read(4_000_000)?.phase).toBe('Impact');
    expect(read(4_000_000)?.remainingSec).toBeCloseTo(4, 9);
    expect(read(8_000_001)).toBeUndefined();
    action.cancelledAtUs = 2_500_000;
    expect(read(2_600_000)).toBeUndefined();
  });

  it('bounds every live atlas by its own contract: circles by the viewport, the rest by the character body', () => {
    const live = sm.all().filter((skill: any) => !skill.retired && skillArtFor(skill.id)?.atlas);
    const allLive = sm.all().filter((skill: any) => !skill.retired);
    expect(allLive.every((skill: any) => !!skillArtFor(skill.id))).toBe(true);
    for (const skill of live) {
      const { arena, action } = fixture(skill.id);
      const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
      const atlas = skillArtFor(skill.id)!.atlas!;
      const placement = skillArtPlacement(mark, atlas);
      const areaShape = mark.area.shape ?? (mark.area.radiusM > 0 ? 'circle' : 'single');
      const circle = areaShape !== 'line' && areaShape !== 'cone'
        && (areaShape === 'circle' || atlas.authoring?.shape === 'circle');
      const cap = circle ? Math.max(ARENA_VIEW.width, ARENA_VIEW.height) : mark.body.height * 7;
      expect(Number.isFinite(placement.width), skill.id).toBe(true);
      expect(placement.width, skill.id).toBeLessThanOrEqual(cap + 1e-9);
      expect(placement.height, skill.id).toBeLessThanOrEqual(cap + 1e-9);
    }
  });

  it('places every authored attack atlas within its frame grid and anchor bounds', () => {
    const attacks = sm.all().filter((skill: any) => skill.type === 'attack' && !skill.retired);
    let authored = 0;
    for (const skill of attacks) {
      const art = skillArtFor(skill.id);
      if (!art?.atlas) continue;
      authored++;
      const { arena, action } = fixture(skill.id);
      const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
      const frame = atlasFrameIndex(mark, art.atlas);
      expect(frame, skill.id).toBeGreaterThanOrEqual(0);
      expect(frame, skill.id).toBeLessThan(art.atlas.count);
      const placement = skillArtPlacement(mark, art.atlas);
      for (const value of [placement.cx, placement.cy, placement.width, placement.height, placement.rotateDeg])
        expect(Number.isFinite(value), skill.id).toBe(true);
      expect(placement.width, skill.id).toBeGreaterThan(0);
      expect(placement.height, skill.id).toBeGreaterThan(0);
      const attackAreaShape = mark.area.shape ?? (mark.area.radiusM > 0 ? 'circle' : 'single');
      const attackCircle = attackAreaShape !== 'line' && attackAreaShape !== 'cone'
        && (attackAreaShape === 'circle' || art.atlas.authoring?.shape === 'circle');
      const attackCap = attackCircle ? Math.max(ARENA_VIEW.width, ARENA_VIEW.height) : mark.body.height * 7;
      expect(placement.width, skill.id).toBeLessThanOrEqual(attackCap + 1e-9);
      expect(placement.height, skill.id).toBeLessThanOrEqual(attackCap + 1e-9);
      expect(placement.anchorX, skill.id).toBeGreaterThanOrEqual(0);
      expect(placement.anchorX, skill.id).toBeLessThanOrEqual(1);
      expect(placement.anchorY, skill.id).toBeGreaterThanOrEqual(0);
      expect(placement.anchorY, skill.id).toBeLessThanOrEqual(1);
    }
    expect(authored).toBeGreaterThan(40);
  });

  it('covers the committed circle with painted content for wide AoE', () => {
    const { arena, action } = fixture(VFX_SELF_INSTANT);
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    const atlas = skillArtFor(VFX_SELF_INSTANT)!.atlas!;
    const placement = skillArtPlacement(mark, atlas);
    const spanX = Math.max(...mark.vertices.map((point) => point.x)) - Math.min(...mark.vertices.map((point) => point.x));
    const spanY = Math.max(...mark.vertices.map((point) => point.y)) - Math.min(...mark.vertices.map((point) => point.y));
    expect(placement.width * (atlas.content?.widthRatio ?? 1)).toBeGreaterThanOrEqual(spanX - 1);
    expect(placement.height * (atlas.content?.heightRatio ?? 1)).toBeGreaterThanOrEqual(spanY - 1);
  });

  it('sizes atlas content from the actor body, not only the footprint', () => {
    const { arena, action } = fixture(VFX_LINE);
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    const atlas = skillArtFor(VFX_LINE)!.atlas!;
    const small = skillArtPlacement({ ...mark, body: { width: 24, height: 66 } }, atlas);
    const large = skillArtPlacement({ ...mark, body: { width: 96, height: 264 } }, atlas);
    expect(large.width, 'large body').toBeGreaterThan(small.width);
    expect(large.height, 'large body').toBeGreaterThan(small.height);
    expect(small.width).toBeLessThanOrEqual(66 * 7 + 1e-9);
    expect(large.width).toBeLessThanOrEqual(264 * 7 + 1e-9);
  });

  it('puts a single-body impact at the body centre for the live body height', () => {
    const area = skillAreaSnapshot({ origin: 'target', radius_m: 0 }, { x: 1, y: 2 }, { x: 4, y: 2 }, 'target');
    const short = buildSkillVfxAim(area, { x: 1, y: 2 }, { x: 4, y: 2 }, undefined, 80);
    const tall = buildSkillVfxAim(area, { x: 1, y: 2 }, { x: 4, y: 2 }, undefined, 240);
    expect(tall.impact.y).toBeLessThan(short.impact.y);
    expect(short.groundImpact.y - short.impact.y).toBeCloseTo(40, 9);
    expect(tall.groundImpact.y - tall.impact.y).toBeCloseTo(120, 9);
  });

  it('uses opening frames on the way in and exit frames on impact', () => {
    const { arena, action } = fixture(VFX_PROJECTILE);
    const atlas = skillArtFor(VFX_PROJECTILE)!.atlas!;
    const windup = skillActionGeometry(action, arena, 500_000, arena.unitsPerSec)!;
    const impact = skillActionGeometry(action, arena, 2_500_000, arena.unitsPerSec)!;
    expect(atlasFrameIndex(windup, atlas)).toBeGreaterThanOrEqual(atlas.frames!.opening![0]);
    expect(atlasFrameIndex(windup, atlas)).toBeLessThanOrEqual(atlas.frames!.opening![1]);
    expect(atlasFrameIndex(impact, atlas)).toBeGreaterThanOrEqual(atlas.frames!.exit![0]);
    expect(atlasFrameIndex(impact, atlas)).toBeLessThanOrEqual(atlas.frames!.exit![1]);
  });
});
