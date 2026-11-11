import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { skillAreaSnapshot } from '@engine/skill-area';
import { directionalAtlasFor, skillArtPlacement, atlasOpacity } from '../../src/ui/combat/arena-skill-art';
import { buildSkillVfxAimWorld } from '../../src/ui/combat/arena-vfx-space';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { ARENA_DIRECTIONS } from '../../src/presentation/arena-camera';
import { fieldPointM } from '../../src/presentation/view-transform';
import { SKILL_VFX_POOL, vfxArtCandidates, type VfxAtlas, type VfxVersion } from '../../src/ui/fx/catalog';
import type { SkillGeometry } from '../../src/ui/combat/skill-geometry';

const root = path.resolve(process.cwd(), '../docs/vfx-skill/component-vfx');
const meta = JSON.parse(fs.readFileSync(path.join(root, 'outputs/animated/charge-gather/meta.json'), 'utf8'));
const source = { x: 1, y: 2 }, target = { x: 7, y: 2 };
const area = skillAreaSnapshot({ origin: 'target', radius_m: 0 }, source, target, 'target');
const mark = { key: 'review', skillId: 'attack.fireball', actorId: 'player', area, source, target, directionRad: 0,
  phase: 'Windup', phaseElapsedSec: .2, elapsedSec: .2, progress: .2,
  bodyM: { width: .5, height: 1 }, vfxAim: buildSkillVfxAimWorld(area, source, target) } as SkillGeometry;
const atlas: VfxAtlas = { src: meta.directional.presets[0].sources.east, ...meta.frame, fps: meta.fps, loop: false,
  directional: meta.directional, posterFrame: meta.posterFrame, binding: 'caster', phases: ['Windup'] };
const frameFor = (worldScale = 1) => {
  const frame = createFieldViewFrame({ sceneKey: 'review', atUs: 0, viewportCss: { width: 1920, height: 1080 },
    focusM: fieldPointM(1,2), worldScale });
  if (!frame.renderable) throw Error('Expected visible frame');
  return frame;
};

describe('camera-rendered directional VFX', () => {
  it('selects world headings without using the foreshortened screen angle', () => {
    for (const scale of [.25,.5,1,2]) for (const [index, direction] of ARENA_DIRECTIONS.entries()) {
      const selected = directionalAtlasFor({ ...mark, directionRad: index * Math.PI / 4 }, atlas, frameFor(scale))!;
      expect(selected.src).toBe(meta.directional.presets[0].sources[direction]);
    }
    const selected = directionalAtlasFor({ ...mark, directionRad: 25 * Math.PI / 180 }, atlas, frameFor())!;
    expect(selected.src).toContain('/south-east/');
  });

  it('matches camera elevation and azimuth independently of zoom, hiding unsupported views', () => {
    const base = frameFor();
    const frame = { ...base, worldToViewport: { ...base.worldToViewport, d: base.cssPixelsPerMeter * Math.SQRT1_2 } };
    expect(directionalAtlasFor(mark, atlas, frame)!.src).toContain('raised/');
    expect(directionalAtlasFor(mark, atlas, { ...frame, worldToViewport: { ...frame.worldToViewport, d: base.cssPixelsPerMeter } })).toBeUndefined();
    const yaw = .4, elevation = Math.sin(33 * Math.PI / 180), density = base.cssPixelsPerMeter;
    const rotated = { ...base, worldToViewport: { ...base.worldToViewport,
      a: Math.cos(yaw)*density, b: Math.sin(yaw)*elevation*density,
      c: -Math.sin(yaw)*density, d: Math.cos(yaw)*elevation*density } };
    expect(directionalAtlasFor(mark, atlas, rotated)).toBeUndefined();
    expect(directionalAtlasFor(mark, atlas, { renderable: false, sceneKey: 'hidden', atUs: 0 })).toBeUndefined();
  });

  it('keeps authored metres, the ground root and aspect ratio without a second rotation or mirror', () => {
    const before = JSON.stringify(mark);
    for (const directionRad of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
      const local = { ...mark, directionRad };
      const selected = directionalAtlasFor(local, atlas, frameFor())!;
      const placement = skillArtPlacement(local, selected, frameFor())!;
      expect(placement).toMatchObject({ cx: source.x, cy: source.y, width: 5, height: 5, rotateDeg: 0, mirror: false });
      expect([placement.anchorX,placement.anchorY]).toEqual(meta.directional.presets[0].anchor);
    }
    expect(JSON.stringify(mark)).toBe(before);
    expect(atlasOpacity(mark, atlas)).toBe(1);
    expect(atlasOpacity(mark, { ...atlas, phases: ['Impact'] })).toBe(0);
  });

  it('preloads every view and rejects incomplete camera metadata at the catalog boundary', () => {
    const id = 'review.directional-fixture';
    const version: VfxVersion = { id: 'review', label: 'Fixture', directional: atlas.directional,
      layers: [{ role: 'upright', src: atlas.src, frame: meta.frame }] };
    try {
      SKILL_VFX_POOL[id] = [version];
      expect(vfxArtCandidates(id)[0].sources).toHaveLength(16);
      const incomplete = structuredClone(version);
      delete (incomplete.directional!.presets[0].sources as Partial<Record<string,string>>).east;
      SKILL_VFX_POOL[id] = [incomplete];
      expect(vfxArtCandidates(id)).toEqual([]);
      SKILL_VFX_POOL[id] = [{ ...version, posterFrame: 24 }];
      expect(vfxArtCandidates(id)).toEqual([]);
    } finally { delete SKILL_VFX_POOL[id]; }
  });

  it('retains verified editable sources for all five candidates', () => {
    for (const component of ['charge-gather','motion-trail','contact-flash','shield-ripple','body-coating']) {
      const folder = path.join(root, 'outputs/animated', component);
      const metadata = JSON.parse(fs.readFileSync(path.join(folder, 'meta.json'), 'utf8'));
      const qa = JSON.parse(fs.readFileSync(path.join(folder, 'source-qa.json'), 'utf8'));
      const bytes = fs.readFileSync(path.join(root, metadata.source));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(qa.sourceSha256);
      expect(qa).toMatchObject({ cameraChangeWithoutRebuild: true, deterministicRerender: true,
        fixedRootAcrossEightHeadings: true, northUpEastRight: true, humanApproval: 'pending' });
    }
  });
});
