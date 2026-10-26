import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sm } from '../src/engine/client';
import { AUTHORED_VFX, LEGACY_AUTHORED_VFX, authoredVfxCell, authoredVfxFor, authoredVfxFrame, authoredVfxSize, spatialVfxMatrix, spatialVfxClipPath } from '../src/ui/combat/arena-authored-vfx';
import { activeVfxDuration, activeVfxPlaybackDuration } from '../src/ui/combat/arena-active-vfx';
import { authoredCompositionFor, authoredComponentSites, authoredComponentPose, validAuthoredComposition } from '../src/ui/combat/arena-authored-vfx';
import skillData from '../../tools/data/skills.json';
import review from '../../art-reference/skills/generated/spatial-v2/review.json';
import roster from '../../art-reference/skills/vfx-production-roster.json';
import qaSummary from '../../art-reference/skills/generated/spatial-v2/qa-summary.json';

const firestorm = authoredVfxFor('attack.firestorm', 'legacy')!;

describe('authored active-skill VFX', () => {
  it('moves Meteor diagonally toward its fixed landing point with aligned art', () => {
    const composition = authoredCompositionFor('attack.meteor')!;
    expect(composition.version).toBe('components-v2');
    const site = { x: 500, y: 400, phase: 4 };
    const early = authoredComponentPose(composition, site, -.2);
    const later = authoredComponentPose(composition, site, -.1);
    expect(early.position.x).toBeLessThan(later.position.x);
    expect(early.position.y).toBeLessThan(later.position.y);
    expect(later.position.x).toBeLessThan(site.x);
    expect(later.position.y).toBeLessThan(site.y);
    expect(authoredComponentPose(composition, site, 0).position).toEqual({ x: 500, y: 400 });
    const angle = Math.atan2(site.y - early.position.y, site.x - early.position.x) * 180 / Math.PI;
    expect(early.rotation + 90).toBeCloseTo(angle);
    expect(authoredComponentPose(composition, site, -.2, true).falling).toBe(false);
    const invalid = structuredClone(composition);
    invalid.motion.directionScreen = [0, 0];
    expect(validAuthoredComposition(invalid)).toBe(false);
  });
  it('keeps distributed component sites deterministic and inside the committed footprint', () => {
    const composition = authoredCompositionFor('attack.meteor')!;
    expect(validAuthoredComposition(composition)).toBe(true);
    const area = { center: { x: 0, y: 0 }, basisX: { x: 3, y: 0 }, basisY: { x: 0, y: 3 }, diameter: 6 };
    const sites = authoredComponentSites(composition, area, 12);
    expect(authoredComponentSites(composition, area, 12)).toEqual(sites);
    expect(authoredComponentSites(composition, area, 13)).not.toEqual(sites);
    expect(sites.some(site => Math.hypot(site.x, site.y) < 1)).toBe(true);
    expect(sites.some(site => Math.hypot(site.x, site.y) > 2)).toBe(true);
    for (const site of sites) expect(Math.hypot(site.x, site.y)).toBeLessThanOrEqual(3);
    const invalid = structuredClone(composition);
    invalid.components[0].art.frames![0].rect = [-1, 0, 10, 10];
    expect(validAuthoredComposition(invalid)).toBe(false);
  });
  it('keeps original presets accessible while activating spatial replacement art', () => {
    expect(authoredVfxFor('attack.meteor')!.src).toContain('/spatial-v2/');
    expect(authoredVfxFor('attack.meteor', 'legacy')!.src).toContain('/batch-v1/');
    expect(authoredVfxFor('attack.fireball')).toBe(LEGACY_AUTHORED_VFX['attack.fireball']);
    for (const [id, preset] of Object.entries(LEGACY_AUTHORED_VFX)) {
      expect(existsSync(fileURLToPath(new URL('../public' + preset.src, import.meta.url))), id).toBe(true);
    }
  });

  it('uses caster-facing source art for Whirlwind and ground-depth art for stationary bursts', () => {
    expect(authoredVfxFor('attack.whirlwind')?.spatial?.layer).toBe('front');
    expect(authoredVfxFor('attack.ground_slam')?.spatial?.layer).toBe('ground');
  });

  it('fits the whole source field to the committed projected circle', () => {
    const preset = { ...authoredVfxFor('attack.meteor')!, virtualWidth:328, virtualHeight:328,
      contentWidthRatio:200/328, frames:[{index:4,rect:[0,0,200,150],offsetX:64,offsetY:64,bounds:[10,20,210,120]}] };
    const area = {center:{x:500,y:400},basisX:{x:120,y:30},basisY:{x:10,y:60},diameter:250};
    const [a,b,c,d,x,y] = spatialVfxMatrix(preset,4,area);
    expect(a*174+c*134+x).toBeCloseTo(500);
    expect(b*174+d*134+y).toBeCloseTo(400);
    expect(Math.hypot(a*100,c*50)).toBeCloseTo(Math.hypot(120,10));
    expect(Math.hypot(b*100,d*50)).toBeCloseTo(Math.hypot(30,60));
  });

  it('keeps cone reach and edges on the committed directional footprint', () => {
    const preset=authoredVfxFor('attack.venom_spray')!, frame=preset.frames!.find(f=>f.index===4)!;
    const bounds=frame.bounds!, x=(frame.offsetX ?? 0)+(bounds[0]+bounds[2])/2, y=(frame.offsetY ?? 0)+bounds[3];
    const area={center:{x:500,y:400},basisX:{x:150,y:30},basisY:{x:45,y:90},diameter:310,shape:'cone' as const,lengthM:2.5,angleDeg:90,directionRad:0};
    const [a,b,c,d,tx,ty]=spatialVfxMatrix(preset,4,area), depth=bounds[3]-bounds[1];
    expect(a*x+c*(y-depth)+tx).toBeCloseTo(650);
    expect(b*x+d*(y-depth)+ty).toBeCloseTo(430);
    expect(spatialVfxClipPath(area)).toMatch(/^M500 400 L.* Z$/);
  });

  it('loops weather by presentation time without turning damage hit counts into extra fields', () => {
    const blizzard=authoredVfxFor('attack.blizzard')!;
    for(const age of [.1,.7,2,6,7.9]) {
      expect(authoredVfxFrame(blizzard,age,8,false,20)).toBe(authoredVfxFrame(blizzard,age,8,false,1));
    }
  });
  it('points every preset at a shipped atlas and a live skill', () => {
    for (const [id, preset] of Object.entries(AUTHORED_VFX)) {
      expect(sm.byId[id], id).toBeDefined();
      expect(preset.src.startsWith('/fx/authored/'), id).toBe(true);
      expect(existsSync(fileURLToPath(new URL('../public' + preset.src, import.meta.url))), id).toBe(true);
      const last = preset.columns * preset.rows - 1;
      for (const range of [preset.opening, preset.loop, preset.exit]) {
        expect(range[0], id).toBeGreaterThanOrEqual(0);
        expect(range[1], id).toBeGreaterThanOrEqual(range[0]);
        expect(range[1], id).toBeLessThanOrEqual(last);
      }
    }
  });

  it('gates every live skill on selected art, review disposition and staged source', () => {
    const live = (skillData.skills as { id: string; retired?: boolean }[])
      .filter((skill) => !skill.retired).map((skill) => skill.id);
    const ids = new Set(live);
    expect(new Set(Object.keys(AUTHORED_VFX))).toEqual(ids);
    expect(new Set(review.skills.map((row) => row.id))).toEqual(ids);
    expect(new Set(roster.skills.map((row) => row.id))).toEqual(ids);
    expect(review.skills).toHaveLength(ids.size);
    expect(roster.skills).toHaveLength(ids.size);
    const dispositions = new Set(['reuse-component-recompose-and-calibrate', 'new-area-art', 'new-projectile-component']);
    const activations = new Set(['existing-active-component', 'active-spatial-v2']);
    for (const row of review.skills) {
      expect(dispositions.has(row.disposition), row.id).toBe(true);
      expect(activations.has(row.runtimeActivation), row.id).toBe(true);
      expect(row.sourceQa, row.id).toBe('PASS');
      expect(existsSync(fileURLToPath(new URL('../../' + row.sourceAsset, import.meta.url))), row.id).toBe(true);
      if (row.stagedAsset)
        expect(existsSync(fileURLToPath(new URL('../public' + row.stagedAsset, import.meta.url))), row.id).toBe(true);
    }
    for (const row of roster.skills) {
      expect(row.status, row.id).toBe('integrated');
      expect(existsSync(fileURLToPath(new URL('../../' + row.authored, import.meta.url))), row.id).toBe(true);
    }
    const spatial = new Set(Object.entries(AUTHORED_VFX).filter(([, preset]) => preset.spatial).map(([id]) => id));
    expect(new Set(qaSummary.map((row) => row.id))).toEqual(spatial);
    for (const row of qaSummary) {
      expect(row.status, row.id).toBe('PASS');
      expect(row.runtimeActivated, row.id).toBe(true);
    }
  });

  it('maps the action duration across opening, loop and exit', () => {
    expect(authoredVfxFrame(firestorm, 0, 1.6)).toBe(0);
    expect(authoredVfxFrame(firestorm, .08, 1.6)).toBe(1);
    expect(authoredVfxFrame(firestorm, .24, 1.6)).toBe(3);
    expect(authoredVfxFrame(firestorm, .32, 1.6)).toBe(4);
    expect(authoredVfxFrame(firestorm, 1.28, 1.6)).toBe(12);
    expect(authoredVfxFrame(firestorm, 1.6, 1.6)).toBe(15);
    const seen = new Set<number>();
    for (let ms = 0; ms <= 1600; ms++) seen.add(authoredVfxFrame(firestorm, ms / 1000, 1.6));
    expect([...seen].sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
  });

  it('keeps short and long actions inside the atlas while retaining all phases', () => {
    const cases = [
      {duration: .5, openingEnd: .125, exitStart: .375},
      {duration: 4, openingEnd: .32, exitStart: 3.68},
    ];
    for (const {duration, openingEnd, exitStart} of cases) {
      expect(authoredVfxFrame(firestorm, openingEnd, duration)).toBe(4);
      expect(authoredVfxFrame(firestorm, exitStart, duration)).toBe(12);
      for (let ms = 0; ms <= duration * 1000; ms += 10) {
        const frame = authoredVfxFrame(firestorm, ms / 1000, duration);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThanOrEqual(15);
      }
    }
  });

  it('holds a readable loop frame for reduced motion', () => {
    for (const age of [0, .4, 1.5]) expect(authoredVfxFrame(firestorm, age, 1.6, true)).toBe(8);
  });

  it('selects atlas cells and scales with the action footprint', () => {
    expect(authoredVfxCell(firestorm, 5).viewBox).toBe('352 352 352 352');
    expect(authoredVfxCell(firestorm, 15).viewBox).toBe('1056 1056 352 352');
    expect(authoredVfxSize(230)).toBeCloseTo(322);
    expect(authoredVfxSize(230, 270)).toBeCloseTo(270);
    expect(authoredVfxSize(230, 352)).toBeCloseTo(352);
    expect(authoredVfxSize(230, 1000)).toBeCloseTo(1000);
  });

  it('does not stretch a strike animation to its applied status duration', () => {
    const reap = sm.byId['attack.reap'];
    expect(activeVfxDuration('reap', reap)).toBe(6);
    expect(activeVfxPlaybackDuration('reap', reap, 'attack.reap')).toBe(.65);
    expect(activeVfxPlaybackDuration('curse', reap, 'curse.weaken')).toBe(.72);
    expect(activeVfxPlaybackDuration('weaken', sm.byId['curse.weaken'], 'curse.weaken')).toBe(.85);
    expect(activeVfxPlaybackDuration('blizzard', sm.byId['attack.blizzard'], 'attack.blizzard')).toBe(8);
    expect(activeVfxPlaybackDuration('sandStorm', sm.byId['attack.sand_storm'], 'attack.sand_storm')).toBe(10);
  });
});
