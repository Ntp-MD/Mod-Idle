import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render } from 'svelte/server';
import AtlasFrame from '../../src/ui/fx/AtlasFrame.svelte';
import data from '../../../tools/data/vfx-components.json';
import { skillAreaSnapshot } from '@engine/skill-area';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { applyWorldToViewport, fieldPointM } from '../../src/presentation/view-transform';
import { activeVfxArt, activeVfxVersionId, setActiveVfxVersion, SKILL_VFX_POOL, vfxArtCandidates, type VfxAtlas } from '../../src/ui/fx/catalog';
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
  it('retains the ray ground base and both component layers during its real channel phase', () => {
    const before = activeVfxVersionId('attack.void_ray')!;
    setActiveVfxVersion('attack.void_ray', 'pool-v3');
    try {
      const candidate = vfxArtCandidates('attack.void_ray').find(row => row.versionId === 'pool-v3')!;
      const layers = candidate.art.atlases!;
      expect(layers.map(layer => layer.id)).toEqual(['animated-base', 'ribbon-beam', 'impact-burst']);
      expect(layers[0].projection).toBe('ground');
      const channel = { ...markFor(), phase: 'Channel' as const, phaseElapsedSec: 1.5 };
      expect(layers.slice(1).every(layer => atlasOpacity(channel, layer) > 0)).toBe(true);
      expect(candidate.sources.every(src => fs.existsSync(path.join(process.cwd(), 'public', src)))).toBe(true);
    } finally { setActiveVfxVersion('attack.void_ray', before); }
  });
  it('resolves all 29 shapes across all seven element palettes without missing artwork', () => {
    expect(VFX_PALETTE_IDS).toEqual(expect.arrayContaining(['fire', 'cold', 'lightning', 'earth', 'poison', 'chaos', 'physical']));
    const shapes = { ...data.families, ...data.variants };
    expect(Object.keys(shapes)).toHaveLength(29);
    const pairs = new Set<string>();
    for (const [shape, definition] of Object.entries(shapes)) {
      const master = definition.master;
      const version = SKILL_VFX_POOL[master.skill].find(row => row.id === `pool-${master.version}`)!;
      const layer = version.layers.find(row => row.id === master.layerId)!;
      const png = fs.readFileSync(path.join(process.cwd(), 'public', layer.src));
      expect(png.readUInt32BE(16)).toBe(1024);
      expect(png.readUInt32BE(20)).toBe(1024);
      expect(png[25]).toBe(6);
      for (const palette of VFX_PALETTE_IDS) pairs.add(`${shape}:${palette}`);
    }
    expect(pairs.size).toBe(203);
  });

  it('resolves all 98 unique family/palette pairs to real square registered master images', () => {
    const pairs = new Set<string>();
    for (const [family, definition] of Object.entries(data.families)) {
      const master = definition.master;
      const version = SKILL_VFX_POOL[master.skill].find(row => row.id === `pool-${master.version}`)!;
      expect(version.default).toBe(false);
      const layer = version.layers.find(row => row.id === master.layerId)!;
      expect(layer.src.endsWith(`/${master.file}`)).toBe(true);
      const png = fs.readFileSync(path.join(process.cwd(), 'public', layer.src));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(1024);
      expect(png.readUInt32BE(20)).toBe(1024);
      expect(layer.frame.count).toBe(1);
      for (const palette of VFX_PALETTE_IDS) pairs.add(`${family}:${palette}`);
    }
    expect(pairs.size).toBe(98);
  });

  it('renders every palette as RGB-only transfer functions preserving source alpha', () => {
    for (const palette of VFX_PALETTE_IDS) {
      const { body } = render(AtlasFrame, { props: { src: '/test.png', frame: atlas, index: 0, palette } });
      expect(body).toContain('<feFuncR');
      expect(body).toContain('<feFuncG');
      expect(body).toContain('<feFuncB');
      expect(body).not.toContain('<feFuncA');
      for (const table of vfxPaletteTables(palette)) expect(body).toContain(table);
    }
  });

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
      { id: 'edge', role: 'ground', projection: 'ground', src: '/shared.png', frame: { width: 128, height: 128, count: 1, columns: 1 }, palette: 'fire' },
      { id: 'body', role: 'upright', src: '/shared.png', frame: { width: 128, height: 128, count: 4, columns: 2 }, palette: 'cold', sizePolicy: 'body', binding: 'caster', phases: ['Impact'], delaySec: .1 },
    ] }];
    try {
      const layers = activeVfxArt(id)!.atlases!;
      expect(layers.map(layer => layer.id)).toEqual(['floor', 'edge', 'body']);
      expect(layers.map(layer => layer.count)).toEqual([1, 1, 4]);
      expect(layers.map(layer => layer.projection)).toEqual(['ground', 'ground', undefined]);
      expect(layers.filter(layer => layer.projection === 'ground').map(layer => layer.id)).toEqual(['floor', 'edge']);
      expect(layers.map(layer => layer.palette)).toEqual(['fire', 'fire', 'cold']);
      expect(layers[2]).toMatchObject({ sizePolicy: 'body', binding: 'caster', phases: ['Impact'], delaySec: .1 });
      expect(vfxArtCandidates(id)[0].sources).toEqual(['/shared.png']);
      SKILL_VFX_POOL[id][0].layers[2].id = 'floor';
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

  it('keeps authored upright world size independent of line and cone parent footprints', () => {
    const child = { ...atlas, sizePolicy: 'world' as const, binding: 'area' as const,
      authoring: { shape: 'circle', spanM: 1.2, depthM: 3 } };
    for (const area of [
      { origin: 'caster', shape: 'line', radius_m: 0, length_m: 6, width_m: 1 },
      { origin: 'caster', shape: 'line', radius_m: 0, length_m: 60, width_m: 10 },
      { origin: 'caster', shape: 'cone', radius_m: 4, angle_deg: 60 },
    ] as const) {
      const mark = markFor(skillAreaSnapshot(area, source, target, 'target'));
      const placed = skillArtPlacement(mark, child, frameFor())!;
      expect(placed.width * .8).toBeCloseTo(1.2, 8);
      expect(placed.height * .8).toBeCloseTo(3, 8);
      expect([placed.cx, placed.cy]).toEqual([mark.area.center.x, mark.area.center.y]);
    }
  });

  it('keeps mist as a billboard beside independently configured falling fragments', () => {
    const id = 'test.component-rain';
    const frame = { width: 128, height: 128, count: 1, columns: 1 };
    SKILL_VFX_POOL[id] = [{ id: 'rain', label: 'Rain', default: true, rainDurationSec: 8, layers: [
      { id: 'main', role: 'upright', src: '/shared.png', frame },
      { id: 'mist', role: 'upright', src: '/shared.png', frame },
      { id: 'fragments', role: 'upright', src: '/shared.png', frame, rainDurationSec: 2 },
    ] }];
    try {
      expect(activeVfxArt(id)!.atlases!.map(layer => layer.rainDurationSec)).toEqual([8, undefined, 2]);
    } finally { delete SKILL_VFX_POOL[id]; }
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
      { origin: 'caster', shape: 'cone', radius_m: 4, angle_deg: 60 },
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

  it('roots horizontal cone material at the caster across headings and zooms', () => {
    for (let heading = 0; heading < 8; heading++) for (const scale of [.5, 1, 2]) {
      const angle = heading * Math.PI / 4;
      const aim = { x: source.x + Math.cos(angle) * 3, y: source.y + Math.sin(angle) * 3 };
      const area = skillAreaSnapshot({ origin: 'caster', shape: 'cone', radius_m: 3, angle_deg: 90 }, source, aim, 'target');
      const frame = frameFor(scale);
      const matrix = groundAtlasMatrixForFrame(markFor(area), { ...atlas, orient: true }, frame)!;
      const root = applyWorldToViewport(frame.worldToViewport, fieldPointM(source.x, source.y));
      expect(matrix.a * 12.8 + matrix.c * 64 + matrix.e).toBeCloseTo(root.x, 6);
      expect(matrix.b * 12.8 + matrix.d * 64 + matrix.f).toBeCloseTo(root.y, 6);
    }
  });

  it('aligns directional ground content with committed line corners at eight headings and every zoom', () => {
    for (let heading = 0; heading < 8; heading++) for (const scale of [.5, 1, 2]) {
      const angle = heading * Math.PI / 4;
      const aim = { x: source.x + Math.cos(angle) * 6, y: source.y + Math.sin(angle) * 6 };
      const area = skillAreaSnapshot({ origin: 'caster', shape: 'line', radius_m: 0, length_m: 6, width_m: 1 }, source, aim, 'target');
      const frame = frameFor(scale);
      const matrix = groundAtlasMatrixForFrame(markFor(area), { ...atlas, orient: true }, frame)!;
      const expected = groundShapeWorldPoints(area).map(point => applyWorldToViewport(frame.worldToViewport, fieldPointM(point.x, point.y)));
      for (const [x, y] of [[12.8, 12.8], [115.2, 12.8], [115.2, 115.2], [12.8, 115.2]]) {
        const painted = { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
        expect(Math.min(...expected.map(point => Math.hypot(point.x - painted.x, point.y - painted.y)))).toBeLessThan(1e-6);
      }
    }
  });
});

