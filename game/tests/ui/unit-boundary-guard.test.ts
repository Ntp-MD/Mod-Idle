import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * WP6 closeout guard (A1): the deleted ref-space shims must stay deleted.
 * Fails if a removed legacy path is re-imported or a frame-pure module
 * reaches back into the fixed-reference projection.
 */
const SRC = path.join(process.cwd(), 'src');

// Deleted wrappers/adapters: zero runtime callers after WP6.
const FORBIDDEN = [
  'buildSkillVfxAim(',
  'projectVfxFootprint',
  'groundShapePoints',
  'groundShapePath',
  'groundCirclePoints(',
  'groundCirclePath(',
  'groundDecalMatrix(',
  'toRefSpacePoint',
  'metresToRefPx',
  'groundAuraFootprint',
  'VfxFootprint',
  'VFX_HAND_LIFT_PX',
  'VFX_BODY_CENTER_LIFT_PX',
  'shapeCache',
  'shapePathCache',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|svelte)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('WP6 unit boundary import guard', () => {
  it('keeps field showcase painting in the shared combat arena', () => {
    const app = fs.readFileSync(path.join(SRC, 'App.svelte'), 'utf8');
    expect(app.match(/<CombatArenaScene\b/g)).toHaveLength(1);
    expect(app).not.toContain('MagicAoeSample');
    const dev = path.join(SRC, 'ui', 'dev');
    const forbidden = ['arenaActorPixelScale', 'projectArenaPoint', 'SkillGeometryLayer', 'ArenaGround'];
    const hits = walk(dev).filter(file => file.endsWith('.svelte')).flatMap(file => {
      const source = fs.readFileSync(file, 'utf8');
      return forbidden.filter(token => source.includes(token)).map(token => `${path.relative(SRC, file)}: ${token}`);
    });
    expect(hits).toEqual([]);
  });

  it('has no references to the deleted legacy shims in game sources', () => {
    const hits: string[] = [];
    for (const file of walk(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const token of FORBIDDEN) {
        if (text.includes(token)) hits.push(`${path.relative(process.cwd(), file)}: ${token}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('keeps frame-pure modules off the fixed-reference projection', () => {
    const pure = [
      'src/ui/combat/arena-vfx-space.ts',
      'src/ui/combat/arena-skill-art.ts',
      'src/ui/combat/skill-geometry.ts',
      'src/ui/combat/meteor-rain.ts',
      'src/ui/combat/arena-actor-view.ts',
      'src/ui/combat/ArenaGround.svelte',
    ];
    const hits: string[] = [];
    for (const rel of pure) {
      const text = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      if (text.includes('projectArenaPoint') || text.includes('projectArenaVector')) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not export the removed legacy paths anymore', async () => {
    const vfx = await import('../../src/ui/combat/arena-vfx-space');
    const art = await import('../../src/ui/combat/arena-skill-art');
    const actor = await import('../../src/ui/combat/arena-actor-view');
    for (const key of ['buildSkillVfxAim', 'projectVfxFootprint', 'groundShapePoints', 'groundShapePath', 'groundAuraFootprint']) {
      expect((vfx as Record<string, unknown>)[key]).toBeUndefined();
    }
    expect((art as Record<string, unknown>)['groundDecalMatrix']).toBeUndefined();
    for (const key of ['toRefSpacePoint', 'metresToRefPx']) {
      expect((actor as Record<string, unknown>)[key]).toBeUndefined();
    }
  });

  it('keeps world/frame units out of map-plan math and vice versa', async () => {
    const map = await import('../../src/ui/map/map-view-transform');
    const view = await import('../../src/presentation/view-transform');
    // Branded constructors exist on both sides of the boundary; the typecheck
    // proves they are not interchangeable, this proves neither side vanished.
    expect(typeof map.mapPlanPoint).toBe('function');
    expect(typeof view.fieldPointM).toBe('function');
  });
});
