import { describe, expect, it } from 'vitest';
import { skillAreaSnapshot } from '@engine/skill-area';
import { componentInstances, componentScale } from '../../src/ui/combat/component-placement';
import { skillArtPlacement, tetherMatrixForFrame, groundAtlasMatrixForFrame } from '../../src/ui/combat/arena-skill-art';
import { buildSkillVfxAimWorld, projectSkillVfxAim } from '../../src/ui/combat/arena-vfx-space';
import { createCombatArena } from '@sim/combat/combat-arena';
import { skillRainDrops } from '../../src/ui/combat/meteor-rain';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { fieldPointM } from '../../src/presentation/view-transform';
import { activeVfxArt, SKILL_VFX_POOL, vfxArtCandidates, type VfxAtlas } from '../../src/ui/fx/catalog';
import type { SkillGeometry } from '../../src/ui/combat/skill-geometry';

const source = { x: 1, y: 2 }, target = { x: 7, y: 2 };
const markFor = () => {
  const area = skillAreaSnapshot({ origin: 'caster', shape: 'line', radius_m: 0, length_m: 6, width_m: 1 }, source, target, 'target');
  return { key: 'placement', skillId: 'attack.fissure', area, source, target, directionRad: 0,
    phase: 'Impact', phaseElapsedSec: .3, elapsedSec: .3, progress: 0,
    bodyM: { width: .5, height: 1 }, vfxAim: buildSkillVfxAimWorld(area, source, target) } as SkillGeometry;
};
const atlas: VfxAtlas = { src: '/fixture.png', width: 128, height: 128, columns: 1, rows: 1, count: 1, fps: 12, loop: false };
const frameFor = (worldScale = 1) => {
  const frame = createFieldViewFrame({ sceneKey: 'placement', atUs: 0, viewportCss: { width: 1920, height: 1080 },
    focusM: fieldPointM(1, 2), worldScale });
  if (!frame.renderable) throw new Error('Expected a visible frame');
  return frame;
};

describe('reusable component placement', () => {
  it('keeps both tether endpoints attached to sampled moving actors at every zoom', () => {
    const actors = createCombatArena();
    Object.assign(actors.player, { x: 2, y: 3 });
    actors.mobs.target = { ...actors.player, id: 'target', x: 8, y: 5 };
    const mark = { ...markFor(), actorId: 'player' };
    mark.vfxAim = { ...mark.vfxAim, fromSocket: false, bodyImpact: true };
    const layer = { ...atlas, placement: { kind: 'tether' as const }, content: { widthRatio: .8, heightRatio: .8 }, authoring: { widthM: .2 } };
    for (const scale of [.5, 1, 2]) for (const targetX of [8, 10]) {
      actors.mobs.target.x = targetX;
      const frame = frameFor(scale), matrix = tetherMatrixForFrame(mark, layer, frame, actors)!;
      const expected = projectSkillVfxAim({ ...mark.vfxAim, releaseM: actors.player, groundImpactM: actors.mobs.target }, frame, 1)!;
      for (const [x, endpoint] of [[12.8, expected.release], [115.2, expected.impact]] as const) {
        expect(matrix.a * x + matrix.c * 64 + matrix.e).toBeCloseTo(endpoint.x, 6);
        expect(matrix.b * x + matrix.d * 64 + matrix.f).toBeCloseTo(endpoint.y, 6);
      }
      expect(Math.hypot(matrix.c, matrix.d) * 102.4).toBeCloseTo(.2 * frame.cssPixelsPerMeter, 6);
    }
    Object.assign(actors.mobs.target, actors.player);
    expect(tetherMatrixForFrame(mark, layer, frameFor(), actors)).toBeUndefined();
    expect(mark.vfxAim.groundImpactM).toEqual(target);
  });

  it('expands ground art around a stable centre and freezes full coverage for reduced motion', () => {
    const mark = markFor();
    mark.area = skillAreaSnapshot({ origin: 'target', radius_m: 3 }, source, target, 'target');
    const layer = { ...atlas, durationSec: 1, placement: { kind: 'expand' as const, fromScale: .1 } };
    const start = groundAtlasMatrixForFrame({ ...mark, phaseElapsedSec: 0 }, layer, frameFor())!;
    const full = groundAtlasMatrixForFrame({ ...mark, phaseElapsedSec: 1 }, layer, frameFor())!;
    expect(start.a / full.a).toBeCloseTo(.1);
    expect(start.a * 64 + start.c * 64 + start.e).toBeCloseTo(full.a * 64 + full.c * 64 + full.e);
    expect(start.b * 64 + start.d * 64 + start.f).toBeCloseTo(full.b * 64 + full.d * 64 + full.f);
    expect(componentScale({ ...mark, phaseElapsedSec: .5 }, layer)).toBeCloseTo(.55);
    expect(componentScale({ ...mark, phaseElapsedSec: 20 }, layer)).toBe(1);
    expect(groundAtlasMatrixForFrame({ ...mark, phaseElapsedSec: 0 }, layer, frameFor(), true)).toEqual(full);
  });

  it('follows the sampled target for body bindings while leaving committed geometry intact', () => {
    const actors = createCombatArena();
    actors.mobs.target = { ...actors.player, id: 'target', x: 9, y: 4 };
    const mark = markFor(), before = structuredClone(mark.area);
    const placed = skillArtPlacement(mark, { ...atlas, sizePolicy: 'body', binding: 'target' }, frameFor(), undefined, actors)!;
    expect(placed.cx).toBe(9);
    expect(placed.cy).toBe(3.5);
    expect(mark.area).toEqual(before);
  });
  it('stages repeated roots within the committed line without changing the cast', () => {
    const mark = { ...markFor(), phaseElapsedSec: .25 };
    const before = JSON.stringify(mark);
    const layer: VfxAtlas = { ...atlas, placement: { kind: 'line-series', spacingM: 2, staggerSec: .1 } };
    const active = componentInstances(mark, layer);
    expect(active.map(instance => instance.dx)).toEqual([0, 2, 4]);
    expect(active.every(instance => instance.dy === 0)).toBe(true);
    const complete = componentInstances({ ...mark, phaseElapsedSec: .35 }, layer);
    expect(complete.map(instance => instance.dx)).toEqual([0, 2, 4, 6]);
    expect(componentInstances(mark, layer)).toEqual(active);
    expect(JSON.stringify(mark)).toBe(before);
    expect(componentInstances({ ...mark, phaseElapsedSec: 0 }, layer, true)).toHaveLength(4);
  });

  it('uses the committed direction and bounds decorative work at 64 instances', () => {
    const mark = markFor();
    mark.area = { ...mark.area, directionRad: Math.PI / 2, lengthM: 1000 };
    const layer: VfxAtlas = { ...atlas, placement: { kind: 'line-series', spacingM: .01, staggerSec: 0 } };
    const instances = componentInstances(mark, layer);
    expect(instances).toHaveLength(64);
    expect(instances[0].dy).toBe(0);
    expect(instances.at(-1)!.dy).toBeCloseTo(1000, 8);
    expect(instances.every(instance => Math.abs(instance.dx) < 1e-8)).toBe(true);
  });

  it('advances a wave front in world metres and retains the endpoint in reduced motion', () => {
    const mark = { ...markFor(), phaseElapsedSec: .4 };
    const layer: VfxAtlas = { ...atlas, durationSec: .8, placement: { kind: 'line-front' } };
    expect(componentInstances(mark, layer)[0].dx).toBeCloseTo(3, 8);
    expect(componentInstances(mark, layer, true)[0].dx).toBeCloseTo(6, 8);
    expect(componentInstances({ ...mark, phaseElapsedSec: 10 }, layer)[0].dx).toBeCloseTo(6, 8);
    expect(componentInstances({ ...mark, phaseElapsedSec: .3 }, { ...layer, delaySec: .2 })[0].dx).toBeCloseTo(.75, 8);
  });

  it('spins and orbits around a stable root without camera-dependent positions', () => {
    const mark = { ...markFor(), phaseElapsedSec: .25 };
    const spin: VfxAtlas = { ...atlas, placement: { kind: 'spin', cycleSec: 1 } };
    expect(componentInstances(mark, spin)[0]).toMatchObject({ dx: 0, dy: 0, rotationDeg: 90 });
    expect(componentInstances(mark, spin, true)[0].rotationDeg).toBe(0);
    const orbit: VfxAtlas = { ...atlas, placement: { kind: 'orbit', cycleSec: 1, radiusM: 2 } };
    const point = componentInstances(mark, orbit)[0];
    expect(point.dx).toBeCloseTo(0, 8);
    expect(point.dy).toBeCloseTo(2, 8);
    expect(componentInstances(mark, orbit, true)[0]).toMatchObject({ dx: 2, dy: 0 });
  });

  it('keeps body projectiles moving independently of line and cone parent footprints', () => {
    for (const spec of [
      { origin: 'caster', shape: 'line', radius_m: 0, length_m: 6, width_m: 1 },
      { origin: 'caster', shape: 'cone', radius_m: 6, angle_deg: 120 },
    ] as const) {
      const mark = markFor();
      mark.area = skillAreaSnapshot(spec, source, target, 'target');
      mark.phase = 'Travel';
      mark.vfxAim = { ...mark.vfxAim, releaseM: source, groundImpactM: target, bodyImpact: false };
      const layer: VfxAtlas = { ...atlas, sizePolicy: 'body', authoring: { delivery: 'projectile' } };
      const start = skillArtPlacement({ ...mark, progress: 0 }, layer, frameFor())!;
      const end = skillArtPlacement({ ...mark, progress: 1 }, layer, frameFor())!;
      expect(start.cx).toBe(source.x);
      expect(end.cx).toBe(target.x);
      expect(start.width).toBe(end.width);
      expect(skillArtPlacement(mark, layer, frameFor(.5))!.width).toBe(end.width);
    }
  });

  it('honors explicit aim orientation while keeping upright wave dimensions authored', () => {
    const mark = { ...markFor(), directionRad: Math.PI / 2 };
    const layer: VfxAtlas = { ...atlas, sizePolicy: 'world', orient: true,
      authoring: { shape: 'circle', spanM: 3, depthM: 2 } };
    const placed = skillArtPlacement(mark, layer, frameFor())!;
    expect(placed.width).toBe(3);
    expect(placed.height).toBe(2);
    expect(placed.rotateDeg).toBeCloseTo(90, 8);
  });

  it('keeps still-image rain fragments inside their single source frame', () => {
    const mark = { ...markFor(), skillId: 'test.single-rain', phase: 'Field' as const, phaseElapsedSec: .7 };
    const layer: VfxAtlas = { ...atlas, rainDurationSec: 8, rainPhase: 'Field' };
    const fragments = skillRainDrops(mark, frameFor(), layer).flatMap(drop => drop.fragments);
    expect(fragments.length).toBeGreaterThan(0);
    expect(fragments.every(fragment => fragment.index === 0)).toBe(true);
  });

  it('rejects unsafe placement metadata before a candidate can render', () => {
    const id = 'test.invalid-placement';
    try {
      for (const placement of [
        { kind: 'spin', cycleSec: 0 }, { kind: 'orbit', cycleSec: 1, radiusM: -1 },
        { kind: 'line-series', spacingM: 0, staggerSec: 0 },
        { kind: 'line-series', spacingM: 1, staggerSec: -1 }, { kind: 'unknown' },
        { kind: 'expand', fromScale: 0 }, { kind: 'expand', fromScale: 2 },
      ]) {
        SKILL_VFX_POOL[id] = [{ id: 'invalid', label: 'Invalid', default: true, placement: placement as never,
          layers: [{ role: 'upright', src: '/fixture.png', frame: atlas }] }];
        expect(vfxArtCandidates(id)).toEqual([]);
      }
    } finally { delete SKILL_VFX_POOL[id]; }
  });

  it('keeps each layer placement independent of its parent effect', () => {
    const id = 'test.local-placement';
    SKILL_VFX_POOL[id] = [{ id: 'local', label: 'Local', default: true, placement: { kind: 'spin', cycleSec: 1 }, layers: [
      { id: 'spin', role: 'upright', src: '/fixture.png', frame: atlas },
      { id: 'orbit', role: 'upright', src: '/fixture.png', frame: atlas, placement: { kind: 'orbit', cycleSec: 2, radiusM: 1 } },
      { id: 'still', role: 'upright', src: '/fixture.png', frame: atlas },
    ] }];
    try {
      expect(activeVfxArt(id)!.atlases!.map(layer => layer.placement?.kind)).toEqual(['spin', 'orbit', undefined]);
    } finally { delete SKILL_VFX_POOL[id]; }
  });
});
