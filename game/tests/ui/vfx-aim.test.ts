import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { skillAreaSnapshot } from '@engine/skill-area';
import { createCombatArena, type CombatArenaAction } from '@sim/combat/combat-arena';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { applyWorldToViewport, fieldPointM } from '../../src/presentation/view-transform';
import { projectSkillGeometry, skillActionGeometry } from '../../src/ui/combat/skill-geometry';
import { buildSkillVfxAimWorld, groundShapeWorldPoints, projectSkillVfxAim, sampleVfxOffset, VFX_BODY_LIFT_SHARE } from '../../src/ui/combat/arena-vfx-space';
import { artSizePolicyFor, atlasFrameIndex, atlasImpactDuration, atlasOpacity, skillArtPlacement, skillArtFor } from '../../src/ui/combat/arena-skill-art';
import { activeVfxVersionId, setActiveVfxVersion, vfxArtCandidates, vfxVersionsFor } from '../../src/ui/fx/catalog';
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

const frameFor = (worldScale = 1) => {
  const frame = createFieldViewFrame({
    sceneKey: 'test', atUs: 0,
    viewportCss: { width: 1920, height: 1080 },
    focusM: fieldPointM(1, 2), worldScale,
  });
  if (!frame.renderable) throw new Error('test frame must render');
  return frame;
};

describe('the shared VFX aim contract', () => {
  it('gives every live attack a finite hand release and a body or ground impact', () => {
    const frame = frameFor();
    const attacks = sm.all().filter((skill: any) => skill.type === 'attack' && !skill.retired);
    expect(attacks.length).toBeGreaterThan(40);
    for (const skill of attacks) {
      const { arena, action } = fixture(skill.id);
      const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
      const screen = projectSkillGeometry(mark, frame)!;
      const aim = screen.vfxAim;
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
      // World release sits forward of the caster along the committed aim.
      expect(mark.vfxAim.releaseM.x, skill.id).toBeGreaterThan(action.x);
    }
  });

  it('adds atlas versions through registration only: every version stays bounded on the same mark', () => {
    const skillId = 'attack.fireball';
    const versions = vfxVersionsFor(skillId);
    expect(versions.map(version => version.id)).toEqual(
      expect.arrayContaining(['pool-v3', 'pool-v1', 'pool-v2']));
    const frame = frameFor();
    const { arena, action } = fixture(skillId);
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    const previous = activeVfxVersionId(skillId);
    try {
      for (const version of versions) {
        // Registration round-trips through the existing selector, no per-version branch.
        expect(setActiveVfxVersion(skillId, version.id), version.id).toBe(true);
        expect(activeVfxVersionId(skillId), version.id).toBe(version.id);
        if (version.renderer === 'procedural') {
          // Renderer-only versions own no raster slot, so the atlas bounds contract does not apply.
          expect(version.layers, version.id).toEqual([]);
          expect(skillArtFor(skillId), version.id).toBeUndefined();
          continue;
        }
        const selected = vfxArtCandidates(skillId)[0];
        expect(selected?.versionId, version.id).toBe(version.id);
        const atlas = skillArtFor(skillId)!.atlas!;
        const screen = projectSkillGeometry(mark, frame)!;
        const placement = skillArtPlacement(mark, atlas, frame, screen)!;
        // Same bounds contract as every authored atlas: finite, anchored, body/viewport capped.
        for (const value of [placement.cx, placement.cy, placement.width, placement.height]) {
          expect(Number.isFinite(value), version.id).toBe(true);
        }
        expect(placement.anchorX, version.id).toBeGreaterThanOrEqual(0);
        expect(placement.anchorX, version.id).toBeLessThanOrEqual(1);
        const cap = artSizePolicyFor(mark, atlas) === 'footprint'
          ? Math.max(frame.viewportCss.width, frame.viewportCss.height) / 140 : mark.bodyM.height * 7;
        expect(placement.width, version.id).toBeLessThanOrEqual(cap + 1e-9);
        expect(placement.height, version.id).toBeLessThanOrEqual(cap + 1e-9);
      }
      expect(setActiveVfxVersion(skillId, 'no-such-version')).toBe(false);
    } finally {
      if (previous) setActiveVfxVersion(skillId, previous);
    }
  });

  it('takes the authored hand socket release when the scene provides one', () => {
    const { arena, action } = fixture(VFX_PROJECTILE);
    const socket = { x: 2, y: 3 };
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec,
      undefined, { releaseM: socket })!;
    expect(mark.vfxAim.releaseM).toEqual(socket);
    expect(mark.vfxAim.fromSocket).toBe(true);
    const frame = frameFor();
    const screen = projectSkillGeometry(mark, frame)!;
    // A socket release carries no default hand lift: it lands exactly on its world point.
    const expected = applyWorldToViewport(frame.worldToViewport, fieldPointM(socket.x, socket.y));
    expect(screen.vfxAim.release.x).toBeCloseTo(expected.x, 6);
    expect(screen.vfxAim.release.y).toBeCloseTo(expected.y, 6);
    const direct = buildSkillVfxAimWorld(mark.area, { x: 1, y: 2 }, { x: 4, y: 2 }, socket);
    expect(direct.releaseM).toEqual(socket);
    expect(projectSkillVfxAim(direct, frame, 0.94)!.release).toEqual(screen.vfxAim.release);
  });

  it('keeps the release in front of the caster and the body impact above the ground point', () => {
    const world = buildSkillVfxAimWorld({ origin: 'target', radiusM: 0, center: { x: 4, y: 2 } } as any,
      { x: 1, y: 2 }, { x: 4, y: 2 });
    expect(world.bodyImpact).toBe(true);
    const screen = projectSkillVfxAim(world, frameFor(), 0.94)!;
    expect(screen.impact.y).toBeLessThan(screen.groundImpact.y);
    expect(world.releaseM.x).not.toBe(1);
    expect(screen.mirror).toBe(1);
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

  it('places atlas art on the authored anchor and rotates only art authored to orient', () => {
    const frame = frameFor();
    const cone = fixture(VFX_CONE);
    const coneMark = skillActionGeometry(cone.action, cone.arena, 1_500_000, cone.arena.unitsPerSec)!;
    const coneScreen = projectSkillGeometry(coneMark, frame)!;
    const coneAtlas = skillArtFor(VFX_CONE)!.atlas!;
    const conePlacement = skillArtPlacement(coneMark, coneAtlas, frame, coneScreen)!;
    // Model-space minima: the 24/20 ref-px floors at the 140 px/m reference density.
    expect(conePlacement.width).toBeGreaterThan(24 / 140);
    expect(conePlacement.height).toBeGreaterThan(20 / 140);
    expect(conePlacement.anchorX).toBeGreaterThanOrEqual(0);
    expect(conePlacement.anchorX).toBeLessThanOrEqual(1);
    // Pool art is painted as-is unless its own meta opts into aim rotation.
    expect(coneAtlas.orient).not.toBe(true);
    expect(conePlacement.rotateDeg).toBe(0);
    const oriented = skillArtPlacement(coneMark, { ...coneAtlas, orient: true }, frame, coneScreen)!;
    expect(Math.abs(oriented.rotateDeg)).toBeGreaterThan(1);

    const fireball = fixture(VFX_PROJECTILE);
    const fireballMark = skillActionGeometry(fireball.action, fireball.arena, 1_500_000, fireball.arena.unitsPerSec)!;
    const fireballScreen = projectSkillGeometry(fireballMark, frame)!;
    const fireballAtlas = skillArtFor(VFX_PROJECTILE)!.atlas!;
    const fireballPlacement = skillArtPlacement(fireballMark, fireballAtlas, frame, fireballScreen)!;
    expect(fireballPlacement.anchorX).toBeCloseTo(fireballAtlas.anchor![0], 9);
    // Model-space travel: the aim point stays between release and impact in metres too.
    expect(fireballPlacement.cx).toBeGreaterThan(fireballMark.vfxAim.releaseM.x);
    expect(fireballPlacement.cx).toBeLessThan(fireballMark.vfxAim.groundImpactM.x);
  });

  it('leaves line atlas art in its painted orientation unless the atlas opts into orient', () => {
    const frame = frameFor();
    const { arena, action } = fixture(VFX_LINE);
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    const atlas = skillArtFor(VFX_LINE)!.atlas!;
    expect(atlas.orient).not.toBe(true);
    expect(skillArtPlacement(mark, atlas, frame, projectSkillGeometry(mark, frame)!)!.rotateDeg).toBe(0);
  });

  it('moves a body-sized projectile from its release socket to the collision, then uses the impact anchor', () => {
    const frame = frameFor();
    const { arena, action } = fixture(VFX_PROJECTILE);
    const atlas = skillArtFor(VFX_PROJECTILE)!.atlas!;
    const early = skillActionGeometry(action, arena, 1_100_000, arena.unitsPerSec)!;
    const late = skillActionGeometry(action, arena, 1_900_000, arena.unitsPerSec)!;
    const impact = skillActionGeometry(action, arena, 2_000_000, arena.unitsPerSec)!;
    const a = skillArtPlacement(early, atlas, frame, projectSkillGeometry(early, frame)!)!;
    const b = skillArtPlacement(late, atlas, frame, projectSkillGeometry(late, frame)!)!;
    const hitMark = impact;
    const hitScreen = projectSkillGeometry(hitMark, frame)!;
    const hit = skillArtPlacement(hitMark, atlas, frame, hitScreen)!;
    expect(a.cx).toBeLessThan(b.cx);
    expect(b.cx).toBeLessThan(hit.cx);
    // The impact anchor is the committed ground point lifted by half a body, in metres.
    expect(hit.cx).toBe(hitMark.vfxAim.groundImpactM.x);
    expect(hit.cy).toBeCloseTo(hitMark.vfxAim.groundImpactM.y - hitMark.bodyM.height * VFX_BODY_LIFT_SHARE, 9);
    expect(hit.anchorX).toBe(atlas.impactAnchor![0]);
    expect(hit.anchorY).toBe(atlas.impactAnchor![1]);
    expect(a.width).toBe(b.width);
    const distant = { ...late, vfxAim: { ...late.vfxAim, groundImpactM: { x: late.vfxAim.groundImpactM.x + 1000, y: late.vfxAim.groundImpactM.y } } };
    const distantScreen = projectSkillGeometry(distant, frame)!;
    expect(skillArtPlacement(distant, atlas, frame, distantScreen)!.width).toBe(b.width);
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
      undefined, undefined, atlasImpactDuration(atlas));
    expect(read(2_600_000)?.phase).toBe('Impact');
    // Aftershock carries a 6s window: the circle outlives recovery until the duration ends.
    expect(read(4_000_000)?.phase).toBe('Impact');
    expect(read(4_000_000)?.remainingSec).toBeCloseTo(4, 9);
    expect(read(8_000_001)).toBeUndefined();
    action.cancelledAtUs = 2_500_000;
    expect(read(2_600_000)).toBeUndefined();
  });

  it('bounds every live atlas by its declared policy: footprint by area, world by authored metres, body by the character body (R2/R5)', () => {
    const frame = frameFor();
    const live = sm.all().filter((skill: any) => !skill.retired && skillArtFor(skill.id)?.atlas);
    const allLive = sm.all().filter((skill: any) => !skill.retired);
    expect(allLive.every((skill: any) => !!skillArtFor(skill.id))).toBe(true);
    for (const skill of live) {
      const { arena, action } = fixture(skill.id);
      const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
      const screen = projectSkillGeometry(mark, frame)!;
      const atlas = skillArtFor(skill.id)!.atlas!;
      const placement = skillArtPlacement(mark, atlas, frame, screen)!;
      const policy = artSizePolicyFor(mark, atlas);
      // Only body-relative layers are capped by the body model; footprint and
      // authored world layers carry their own metres (R2/R5).
      const cap = policy === 'body' ? mark.bodyM.height * 7 : Number.POSITIVE_INFINITY;
      expect(Number.isFinite(placement.width), skill.id).toBe(true);
      expect(placement.width, skill.id).toBeLessThanOrEqual(cap + 1e-9);
      expect(placement.height, skill.id).toBeLessThanOrEqual(cap + 1e-9);
    }
  });

  it('places every authored attack atlas within its frame grid and anchor bounds', () => {
    const frame = frameFor();
    const attacks = sm.all().filter((skill: any) => skill.type === 'attack' && !skill.retired);
    let authored = 0;
    for (const skill of attacks) {
      const art = skillArtFor(skill.id);
      if (!art?.atlas) continue;
      authored++;
      const { arena, action } = fixture(skill.id);
      const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
      const screen = projectSkillGeometry(mark, frame)!;
      const framed = atlasFrameIndex(mark, art.atlas);
      expect(framed, skill.id).toBeGreaterThanOrEqual(0);
      expect(framed, skill.id).toBeLessThan(art.atlas.count);
      const placement = skillArtPlacement(mark, art.atlas, frame, screen)!;
      for (const value of [placement.cx, placement.cy, placement.width, placement.height, placement.rotateDeg])
        expect(Number.isFinite(value), skill.id).toBe(true);
      expect(placement.width, skill.id).toBeGreaterThan(0);
      expect(placement.height, skill.id).toBeGreaterThan(0);
      const policy = artSizePolicyFor(mark, art.atlas);
      const attackCap = policy === 'body' ? mark.bodyM.height * 7 : Number.POSITIVE_INFINITY;
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
    const frame = frameFor();
    const { arena, action } = fixture(VFX_SELF_INSTANT);
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    const screen = projectSkillGeometry(mark, frame)!;
    const atlas = skillArtFor(VFX_SELF_INSTANT)!.atlas!;
    const placement = skillArtPlacement(mark, atlas, frame, screen)!;
    // Model-space coverage: the committed footprint extents in metres.
    const spans = groundShapeWorldPoints(mark.area);
    const spanX = Math.max(...spans.map((point) => point.x)) - Math.min(...spans.map((point) => point.x));
    const spanY = Math.max(...spans.map((point) => point.y)) - Math.min(...spans.map((point) => point.y));
    expect(placement.width * (atlas.content?.widthRatio ?? 1)).toBeGreaterThanOrEqual(spanX - 1e-9);
    expect(placement.height * (atlas.content?.heightRatio ?? 1)).toBeGreaterThanOrEqual(spanY - 1e-9);
  });

  it('R5: line art keeps authored world metres while body layers follow the actor body', () => {
    const frame = frameFor();
    const line = fixture(VFX_LINE);
    const mark = skillActionGeometry(line.action, line.arena, 1_500_000, line.arena.unitsPerSec)!;
    const atlas = skillArtFor(VFX_LINE)!.atlas!;
    expect(artSizePolicyFor(mark, atlas)).toBe('world');
    const small = skillArtPlacement({ ...mark, bodyM: { width: 24 / 140, height: 66 / 140 } },
      atlas, frame, projectSkillGeometry({ ...mark, bodyM: { width: 24 / 140, height: 66 / 140 } }, frame)!)!;
    const large = skillArtPlacement({ ...mark, bodyM: { width: 96 / 140, height: 264 / 140 } },
      atlas, frame, projectSkillGeometry({ ...mark, bodyM: { width: 96 / 140, height: 264 / 140 } }, frame)!)!;
    // World decorations read authored/resolved metres, never a body multiple.
    const contentW = (placement: { width: number }) =>
      placement.width * (atlas.content?.widthRatio ?? 1);
    expect(contentW(large)).toBeCloseTo(contentW(small), 9);
    expect(contentW(small)).toBeCloseTo(Math.max(0.4,
      Number(atlas.authoring?.lengthM ?? mark.area.lengthM ?? 0)), 9);
    // Body layers still scale with the shared body model.
    const body = fixture(VFX_PROJECTILE);
    const bodyMark = skillActionGeometry(body.action, body.arena, 1_500_000, body.arena.unitsPerSec)!;
    const bodyAtlas = skillArtFor(VFX_PROJECTILE)!.atlas!;
    expect(artSizePolicyFor(bodyMark, bodyAtlas)).toBe('body');
    const short = skillArtPlacement({ ...bodyMark, bodyM: { width: 24 / 140, height: 66 / 140 } },
      bodyAtlas, frame, projectSkillGeometry({ ...bodyMark, bodyM: { width: 24 / 140, height: 66 / 140 } }, frame)!)!;
    const tall = skillArtPlacement({ ...bodyMark, bodyM: { width: 96 / 140, height: 264 / 140 } },
      bodyAtlas, frame, projectSkillGeometry({ ...bodyMark, bodyM: { width: 96 / 140, height: 264 / 140 } }, frame)!)!;
    expect(tall.width).toBeGreaterThan(short.width);
    expect(tall.height).toBeGreaterThan(short.height);
  });

  it('puts a single-body impact at the body centre for the live body height', () => {
    const frame = frameFor();
    const area = skillAreaSnapshot({ origin: 'target', radius_m: 0 }, { x: 1, y: 2 }, { x: 4, y: 2 }, 'target');
    const short = projectSkillVfxAim(buildSkillVfxAimWorld(area, { x: 1, y: 2 }, { x: 4, y: 2 }), frame, 80 / 140)!;
    const tall = projectSkillVfxAim(buildSkillVfxAimWorld(area, { x: 1, y: 2 }, { x: 4, y: 2 }), frame, 240 / 140)!;
    expect(tall.impact.y).toBeLessThan(short.impact.y);
    expect(short.groundImpact.y - short.impact.y).toBeCloseTo(40 / 140 * frame.cssPixelsPerMeter, 6);
    expect(tall.groundImpact.y - tall.impact.y).toBeCloseTo(120 / 140 * frame.cssPixelsPerMeter, 6);
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
