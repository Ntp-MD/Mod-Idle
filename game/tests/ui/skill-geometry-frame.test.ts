import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { targetsInSkillArea } from '@engine/skill-actions';
import { skillAreaSnapshot } from '@engine/skill-area';
import { sm } from '../../src/engine/client';
import { createCombatArena, type CombatArenaAction } from '@sim/combat/combat-arena';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { ARENA_CAMERA } from '../../src/presentation/arena-camera';
import { fieldPointM } from '../../src/presentation/view-transform';
import {
  projectSkillGeometry,
  skillActionGeometry,
  skillAimGeometry,
} from '../../src/ui/combat/skill-geometry';
import {
  artSizePolicyFor,
  groundDecalMatrixForFrame,
  resolveVfxPresentation,
  skillArtFor,
  skillArtPlacement,
} from '../../src/ui/combat/arena-skill-art';
import { groundShapeWorldPoints } from '../../src/ui/combat/arena-vfx-space';
import { skillRainDrops } from '../../src/ui/combat/meteor-rain';
import type { VfxAtlas, VfxAuthoring } from '../../src/ui/fx/catalog';

const frameFor = (worldScale: number, atUs = 0) => {
  const frame = createFieldViewFrame({
    sceneKey: 'contract', atUs,
    viewportCss: { width: 1920, height: 1080 },
    focusM: fieldPointM(1, 2), worldScale,
  });
  if (!frame.renderable) throw new Error('test frame must render');
  return frame;
};

function liveAction(skillId: string, atUs = 1_500_000): { arena: ReturnType<typeof createCombatArena>; action: CombatArenaAction } {
  const arena = createCombatArena();
  Object.assign(arena.player, { x: 1, y: 2 });
  const skill = sm.byId[skillId];
  const action: CombatArenaAction = {
    id: 7, kind: 'cast', actorId: 'player', skillId, targetId: 'target', x: 1, y: 2,
    targetX: 4, targetY: 2, atUs: 0, endsAtUs: 10_000_000,
    area: skillAreaSnapshot(skill.area ?? { origin: 'target', radius_m: 0 }, arena.player, { x: 4, y: 2 }, 'target'),
    timing: { delivery: 'projectile', startedAtUs: 0, releaseAtUs: 1_000_000,
      impactAtUs: 2_000_000, recoveryUntilUs: 2_500_000 },
  };
  void atUs;
  return { arena, action };
}

describe('WP4 skill/VFX geometry contract', () => {
  it('A2: one world scale keeps actor/area/range/VFX proportions across 0.5–2', () => {
    const { arena, action } = liveAction('attack.firestorm');
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    const screens = [0.5, 0.75, 1, 1.5, 2].map(scale => projectSkillGeometry(mark, frameFor(scale))!);
    const spans = screens.map(screen =>
      Math.max(...screen.vertices.map(p => p.x)) - Math.min(...screen.vertices.map(p => p.x)));
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i] / spans[0]).toBeCloseTo([0.5, 0.75, 1, 1.5, 2][i] / 0.5, 6);
    }
    // World geometry is untouched by scale: same snapshot reference, same area.
    expect(screens.map(s => s.bodyCss.width)[4] / screens.map(s => s.bodyCss.width)[0]).toBeCloseTo(4, 6);
    const atlas = skillArtFor(mark.skillId)!.atlas!;
    const widths = [0.5, 2].map(scale => {
      const frame = frameFor(scale);
      return skillArtPlacement(mark, atlas, frame, projectSkillGeometry(mark, frame)!)!.width;
    });
    // Painted placement is zoom-independent model content: same metres at any scale.
    expect(widths[1] / widths[0]).toBeCloseTo(1, 6);
    // Range ring scales with the same factor.
    const spanOf = (path: string) => {
      const xs = [...path.matchAll(/M([-\d.]+) ([-\d.]+)|L([-\d.]+) ([-\d.]+)/g)]
        .map(m => Number(m[1] ?? m[3]));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spanOf(screens[4].rangePath) / spanOf(screens[0].rangePath)).toBeCloseTo(4, 4);
  });

  it('R2: circle r=3 keeps model diameter 6 m at 1920×1080 and 600×337.5 viewports (DR1)', () => {
    const { arena, action } = liveAction('attack.firestorm');
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    expect(mark.area.radiusM).toBe(3);
    const atlas = skillArtFor(mark.skillId)?.atlas;
    expect(atlas).toBeDefined();
    const placementAt = (width: number, height: number) => {
      const frame = createFieldViewFrame({
        sceneKey: 'r2', atUs: 0, viewportCss: { width, height },
        focusM: fieldPointM(1, 2), worldScale: 1,
      });
      if (!frame.renderable) throw new Error('frame must render');
      return skillArtPlacement(mark, atlas!, frame, projectSkillGeometry(mark, frame)!)!;
    };
    const wide = placementAt(1920, 1080);
    const narrow = placementAt(600, 337.5);
    // Painted content owns the footprint; atlas padding is outside it.
    const content = atlas!.content ?? { widthRatio: 1, heightRatio: 1 };
    expect(wide.width * content.widthRatio).toBeCloseTo(6, 9);
    expect(wide.height * content.heightRatio).toBeCloseTo(6, 9);
    expect(narrow.width * content.widthRatio).toBeCloseTo(6, 9);
    expect(narrow.height * content.heightRatio).toBeCloseTo(6, 9);
    const decalAt = (width: number, height: number) => {
      const frame = createFieldViewFrame({
        sceneKey: 'r2', atUs: 0, viewportCss: { width, height },
        focusM: fieldPointM(0, 0), worldScale: 1,
      });
      if (!frame.renderable) throw new Error('frame must render');
      return groundDecalMatrixForFrame({ x: 0, y: 0 }, 3, frame, 2048)!;
    };
    expect(decalAt(1920, 1080).a / decalAt(600, 337.5).a).toBeCloseTo(1920 / 600, 6);
    const wideDecal = decalAt(1920, 1080);
    expect(wideDecal.a).toBeCloseTo(2 * 3 * 140 / 2048, 6);
  });

  it('A5: circle, line, cone, single, chain, field and channel all read resolved geometry', () => {
    const cases: [string, (area: any) => void][] = [
      ['attack.firestorm', area => expect(area.radiusM).toBeGreaterThan(0)],
      ['attack.tidal_wave', area => expect(area.shape).toBe('line')],
      ['attack.cleave', area => expect(area.shape).toBe('cone')],
      ['attack.fireball', area => expect(area.radiusM).toBe(0)],
      ['attack.chain_lightning', area => expect(area.radiusM).toBe(0)],
      ['attack.blizzard', area => expect(area.radiusM).toBeGreaterThan(0)],
      ['attack.whirlwind', area => expect(area.shape ?? (area.radiusM > 0 ? 'circle' : 'single')).toBe('circle')],
    ];
    for (const [id, check] of cases) {
      const skill = sm.byId[id];
      if (!skill || skill.retired) continue;
      const { arena, action } = liveAction(id);
      const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
      check(mark.area);
      const frame = frameFor(1);
      const screen = projectSkillGeometry(mark, frame)!;
      expect(screen.footprint.length).toBeGreaterThan(0);
      expect(screen.vertices.length).toBeGreaterThanOrEqual(4);
      expect(groundShapeWorldPoints(mark.area).length).toBeGreaterThanOrEqual(4);
      const atlas = skillArtFor(id)?.atlas;
      if (atlas) {
        const placement = skillArtPlacement(mark, atlas, frame, screen)!;
        expect(Number.isFinite(placement.width) && placement.width > 0).toBe(true);
        expect(['footprint', 'body', 'world']).toContain(artSizePolicyFor(mark, atlas));
      }
    }
    // Self buff/heal/aura rows resolve on the caster with no range path.
    const heal = sm.all().find(s => !s.retired && s.type === 'heal')!;
    const { arena, action } = liveAction(heal.id);
    const self = skillActionGeometry(action, arena, 500_000, arena.unitsPerSec)!;
    expect(self.rangeM).toBe(0);
    expect(projectSkillGeometry(self, frameFor(1))!.rangePath).toBe('');
  });

  it('A4: view/skin/quality changes keep hit targets, cooldowns and RNG receipts identical', () => {
    const { arena, action } = liveAction('attack.firestorm');
    const before = JSON.stringify({ action, area: action.area });
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    const bodies = [{ id: 'a', x: 4, y: 2, radiusM: 0 }, { id: 'b', x: 9, y: 9, radiusM: 0 }];
    const hits = targetsInSkillArea(mark.area, bodies).map(t => t.id);
    for (const scale of [0.5, 1, 2]) {
      const rescaled = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
      projectSkillGeometry(rescaled, frameFor(scale));
      expect(targetsInSkillArea(rescaled.area, bodies).map(t => t.id)).toEqual(hits);
    }
    // Skin/Base resolution never rewrites geometry, duration or hit identity.
    expect(resolveVfxPresentation(mark.skillId, 'auto')).toBeDefined();
    expect(resolveVfxPresentation(mark.skillId, 'base').kind).toBe('base');
    const reaimed = skillAimGeometry({ skillId: mark.skillId, area: mark.area, source: mark.source, rangeM: mark.rangeM, valid: true })!;
    expect(reaimed.area).toEqual(mark.area);
    expect(JSON.stringify({ action, area: action.area })).toBe(before);
  });

  it('A7: timeline and seed stay stable across Base/skin mode switches', () => {
    const { arena, action } = liveAction('attack.blizzard');
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    const frame = frameFor(1);
    const screen = projectSkillGeometry(mark, frame)!;
    const atlas = skillArtFor(mark.skillId)?.atlas;
    if (atlas) {
      const rain = skillRainDrops(mark, frame, atlas);
      expect(rain).toEqual(skillRainDrops({ ...mark }, frame, atlas));
      const base = skillArtFor(mark.skillId, 'base');
      expect(base).toBeUndefined();
      // Placement is mode-independent: the same world mark fits the same art either way.
      expect(skillArtPlacement(mark, atlas, frame, screen)).toEqual(
        skillArtPlacement({ ...mark }, atlas, frame, projectSkillGeometry({ ...mark }, frame)!));
    }
    expect(mark.elapsedSec).toBe(1.5);
    expect(mark.phaseElapsedSec).toBe(0.5);
  });

  it('R5: line/cone art reads its declared world metres, never a body multiple (DR1)', () => {
    const synth = (authoring: VfxAuthoring): VfxAtlas => ({
      src: '/synthetic-vfx.png', width: 64, height: 64, count: 1, columns: 1, rows: 1,
      fps: 10, loop: false, authoring,
    });
    const lineAtlas = synth({ shape: 'line', delivery: 'ground', lengthM: 6, widthM: 0.6 });
    const coneAtlas = synth({ shape: 'cone', delivery: 'ground', radiusM: 2.1, spanM: 3.637, depthM: 2.1 });
    const frame = frameFor(1);
    const line = liveAction('attack.tidal_wave');
    const lineMark = skillActionGeometry(line.action, line.arena, 1_500_000, line.arena.unitsPerSec)!;
    expect(artSizePolicyFor(lineMark, lineAtlas)).toBe('world');
    const lineSmall = skillArtPlacement({ ...lineMark, bodyM: { width: .3, height: .5 } }, lineAtlas, frame)!;
    const lineLarge = skillArtPlacement({ ...lineMark, bodyM: { width: 1.2, height: 2 } }, lineAtlas, frame)!;
    for (const placement of [lineSmall, lineLarge]) {
      expect(placement.width).toBeCloseTo(6, 9);
      expect(placement.height).toBeCloseTo(0.6, 9);
    }
    const cone = liveAction('attack.cleave');
    const coneMark = skillActionGeometry(cone.action, cone.arena, 1_500_000, cone.arena.unitsPerSec)!;
    expect(artSizePolicyFor(coneMark, coneAtlas)).toBe('world');
    const coneSmall = skillArtPlacement({ ...coneMark, bodyM: { width: .3, height: .5 } }, coneAtlas, frame)!;
    const coneLarge = skillArtPlacement({ ...coneMark, bodyM: { width: 1.2, height: 2 } }, coneAtlas, frame)!;
    for (const placement of [coneSmall, coneLarge]) {
      expect(placement.width).toBeCloseTo(3.637, 3);
      expect(placement.height).toBeCloseTo(2.1, 9);
    }
    // Body-relative layers still read the shared body model.
    const single = liveAction('attack.fireball');
    const singleMark = skillActionGeometry(single.action, single.arena, 1_500_000, single.arena.unitsPerSec)!;
    const bodyAtlas = synth({ delivery: 'instant' });
    expect(artSizePolicyFor(singleMark, bodyAtlas)).toBe('body');
    const small = skillArtPlacement({ ...singleMark, bodyM: { width: .3, height: .5 } }, bodyAtlas, frame)!;
    const large = skillArtPlacement({ ...singleMark, bodyM: { width: 1.2, height: 2 } }, bodyAtlas, frame)!;
    expect(small.height).toBeLessThan(large.height);
  });

  it('A12: scale changes reuse world geometry and keep no per-frame projected cache', () => {
    const { arena, action } = liveAction('attack.firestorm');
    const first = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    const worldFirst = groundShapeWorldPoints(first.area);
    const second = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    expect(groundShapeWorldPoints(second.area)).toBe(worldFirst);
    const small = projectSkillGeometry(first, frameFor(0.5))!;
    const large = projectSkillGeometry(first, frameFor(2))!;
    expect(small.footprint).not.toBe(large.footprint);
    // Ground decal keeps the camera's axis-aligned ellipse at every scale.
    for (const scale of [0.5, 1, 2]) {
      const frame = frameFor(scale);
      const m = groundDecalMatrixForFrame({ x: 100, y: 100 }, 3, frame, 2048)!;
      expect(m.b).toBeCloseTo(0, 8);
      expect(m.c).toBeCloseTo(0, 8);
      expect(m.d / m.a).toBeCloseTo(ARENA_CAMERA.projection.d / ARENA_CAMERA.projection.a, 8);
      expect(m.a).toBeCloseTo(2 * 3 * frame.cssPixelsPerMeter / 2048, 8);
    }
  });

  it('no per-skill or per-asset branches in scene/placement code', () => {
    const roots = [
      'src/ui/combat/skill-geometry.ts',
      'src/ui/combat/arena-vfx-space.ts',
      'src/ui/combat/arena-skill-art.ts',
      'src/ui/combat/SkillGeometryLayer.svelte',
      'src/ui/combat/ArenaSkillVfxStage.svelte',
      'src/ui/combat/meteor-rain.ts',
    ];
    for (const root of roots) {
      const text = fs.readFileSync(path.join(process.cwd(), root), 'utf8');
      const hits = [...text.matchAll(/(case\s+['"]attack\.|===\s*['"]attack\.|!==\s*['"]attack\.|skillId\s*===\s*['"])/g)];
      expect(hits.map(h => h[0]), root).toEqual([]);
    }
  });
});
