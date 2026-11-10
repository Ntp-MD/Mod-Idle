import { describe, expect, it } from 'vitest';
import data from '../../../tools/data/vfx-components.json';
import { skillAreaSnapshot } from '@engine/skill-area';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { applyWorldToViewport, fieldPointM } from '../../src/presentation/view-transform';
import { activeVfxArt, SKILL_VFX_POOL, vfxArtCandidates, type VfxAtlas } from '../../src/ui/fx/catalog';
import { VFX_PALETTE_IDS, isVfxPalette, vfxPaletteTables } from '../../src/ui/fx/palettes';
import { artSizePolicyFor, atlasFrameIndex, atlasOpacity, groundAtlasMatrixForFrame, skillArtPlacement } from '../../src/ui/combat/arena-skill-art';
import { buildSkillVfxAimWorld, groundShapeWorldPoints } from '../../src/ui/combat/arena-vfx-space';
import type { SkillGeometry } from '../../src/ui/combat/skill-geometry';

const source = { x: 1, y: 2 }, target = { x: 4, y: 3 };
const frameFor = (scale = 1) => {
  const frame = createFieldViewFrame({ sceneKey: 'components', atUs: 0, viewportCss: { width: 1920, height: 1080 }, focusM: fieldPointM(1, 2), worldScale: scale });
  if (!frame.renderable) throw new Error('Expected a visible frame');
  return frame;
};
const markFor = (area = skillAreaSnapshot({ origin: 'target', radius_m: 3 }, source, target, 'target')) => ({
  key: 'component-test', skillId: 'attack.firestorm', area, source, target, directionRad: 0,
  phase: 'Impact', phaseElapsedSec: 0, elapsedSec: 0, progress: 0,
  bodyM: { width: .5, height: 1 }, vfxAim: buildSkillVfxAimWorld(area, source, target),
} as SkillGeometry);
const atlas: VfxAtlas = { src: '/test.png', width: 128, height: 128, count: 4, columns: 2, rows: 2, fps: 10, loop: false, content: { widthRatio: .8, heightRatio: .8 } };

describe('VFX component composition', () => {
  it('defines exactly 14 families and seven distinct usable palette tables', () => {
    expect(Object.keys(data.families)).toHaveLength(14);
    expect(VFX_PALETTE_IDS).toHaveLength(7);
    expect(Object.keys(data.families).flatMap(id => VFX_PALETTE_IDS.map(palette => `${id}:${palette}`))).toHaveLength(98);
    const tables = VFX_PALETTE_IDS.map(id => vfxPaletteTables(id));
    expect(new Set(tables.map(table => table.join('|'))).size).toBe(7);
    for (const table of tables) for (const channel of table) {
      const values = channel.split(' ').map(Number);
      expect(values).toHaveLength(4);
      expect(values.every(value => value >= 0 && value <= 1)).toBe(true);
    }
    expect(isVfxPalette('support')).toBe(false);
  });

  it('keeps static and animated layers on one texture with independent projection and metadata', () => {
    const id = 'test.component-composition';
    SKILL_VFX_POOL[id] = [{ id: 'components', label: 'Components', default: true, projection: 'ground', layers: [
      { id: 'floor', role: 'ground', src: '/shared.png', frame: { width: 128, height: 128, count: 1, columns: 1 }, palette: 'fire' },
      { id: 'body', role: 'upright', src: '/shared.png', frame: { width: 128, height: 128, count: 4, columns: 2 }, palette: 'cold', sizePolicy: 'body', binding: 'caster', phases: ['Impact'], delaySec: .1 },
    ] }];
    try {
      const layers = activeVfxArt(id)!.atlases!;
      expect(layers.map(layer => layer.id)).toEqual(['floor', 'body']);
      expect(layers.map(layer => layer.count)).toEqual([1, 4]);
      expect(layers.map(layer => layer.projection)).toEqual(['ground', undefined]);
      expect(layers.map(layer => layer.palette)).toEqual(['fire', 'cold']);
      expect(layers[1]).toMatchObject({ sizePolicy: 'body', binding: 'caster', phases: ['Impact'], delaySec: .1 });
      expect(vfxArtCandidates(id)[0].sources).toEqual(['/shared.png']);
      SKILL_VFX_POOL[id][0].layers[1].id = 'floor';
      expect(vfxArtCandidates(id)).toEqual([]);
    } finally { delete SKILL_VFX_POOL[id]; }
  });

  it('keeps body-sized child art independent of its parent AoE and binds it to the actor', () => {
    const mark = markFor();
    const child = { ...atlas, sizePolicy: 'body' as const, binding: 'caster' as const };
    expect(artSizePolicyFor(mark, child)).toBe('body');
    const small = skillArtPlacement(mark, child, frameFor())!;
    const wide = skillArtPlacement({ ...mark, area: { ...mark.area, radiusM: 30 } }, child, frameFor())!;
    expect(wide).toEqual(small);
    expect(small.cx).toBe(mark.source.x);
    expect(small.width * .8).toBeCloseTo(mark.bodyM.width * 2.8, 8);
  });

  it('applies layer phases and delay to playback without changing the committed mark', () => {
    const mark = markFor();
    const child = { ...atlas, phases: ['Impact'] as const, delaySec: .2, durationSec: .6 };
    const configured = { ...child, phases: [...child.phases] };
    expect(atlasOpacity(mark, configured)).toBe(0);
    expect(atlasFrameIndex({ ...mark, phaseElapsedSec: .31 }, configured)).toBe(1);
    expect(atlasOpacity({ ...mark, phaseElapsedSec: .31 }, configured)).toBeGreaterThan(0);
    expect(atlasOpacity({ ...mark, phase: 'Travel', phaseElapsedSec: .31 }, configured)).toBe(0);
    expect(atlasOpacity({ ...mark, phaseElapsedSec: .81 }, configured)).toBe(0);
    expect(mark.phaseElapsedSec).toBe(0);
  });

  it('fits circles, zero-radius lines and cones to their committed bounds at every zoom', () => {
    const areas = [
      { origin: 'target', radius_m: 3 },
      { origin: 'caster', shape: 'line', radius_m: 0, length_m: 6, width_m: 1 },
      { origin: 'caster', shape: 'cone', radius_m: 0, length_m: 4, angle_deg: 60 },
    ] as const;
    for (const spec of areas) for (const scale of [.5, 1, 2]) {
      const mark = markFor(skillAreaSnapshot(spec, source, target, 'target'));
      const frame = frameFor(scale), m = groundAtlasMatrixForFrame(mark, atlas, frame)!;
      const points = groundShapeWorldPoints(mark.area);
      const left = Math.min(...points.map(point => point.x)), top = Math.min(...points.map(point => point.y));
      const right = Math.max(...points.map(point => point.x)), bottom = Math.max(...points.map(point => point.y));
      for (const [u, v, x, y] of [[12.8, 12.8, left, top], [115.2, 115.2, right, bottom]]) {
        const expected = applyWorldToViewport(frame.worldToViewport, fieldPointM(x, y));
        expect(m.a * u + m.c * v + m.e).toBeCloseTo(expected.x, 6);
        expect(m.b * u + m.d * v + m.f).toBeCloseTo(expected.y, 6);
      }
    }
  });
});

