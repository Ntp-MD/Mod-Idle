import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { activeVfxArt, activeVfxVersionId, setActiveVfxVersion, vfxArtCandidates, vfxVersionsFor } from '../../src/ui/fx/catalog';
import { POOL_VERSIONS } from '../../src/ui/fx/pool.generated';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('skill VFX pool', () => {
  it('registers valid, readable animation sheets for every live skill', () => {
    const skills = sm.all().filter(skill => !skill.retired);
    expect(Object.keys(POOL_VERSIONS).sort()).toEqual(skills.map(skill => skill.id).sort());
    for (const skill of skills) {
      expect(vfxVersionsFor(skill.id), skill.id).toHaveLength(1);
      expect(activeVfxVersionId(skill.id), skill.id).toBe('pool');
      expect(activeVfxArt(skill.id), skill.id).toBeDefined();
      expect(vfxArtCandidates(skill.id), skill.id).toHaveLength(1);
      for (const layer of POOL_VERSIONS[skill.id][0].layers) {
        expect(layer.src).toMatch(/^\/fx\/skill-pool\/[a-z-]+\/[a-z-]+\/[a-z0-9-]+\.png$/);
        const png = readFileSync(path.resolve('public', layer.src.slice(1)));
        expect(png.subarray(0, 8).toString('hex'), layer.src).toBe('89504e470d0a1a0a');
        expect(png.readUInt32BE(16), layer.src).toBe(layer.frame.width * layer.frame.columns);
        expect(png.readUInt32BE(20), layer.src).toBe(layer.frame.height * layer.frame.rows!);
        expect(layer.frame.count).toBeLessThanOrEqual(layer.frame.columns * layer.frame.rows!);
        expect(layer.fps).toBeGreaterThan(0);
      }
    }
  });

  it('keeps explicit, distinct recipes and real provenance across the source packs', () => {
    const config = JSON.parse(readFileSync(path.resolve('../tools/data/external-vfx.json'), 'utf8'));
    expect(Object.keys(config.recipes).sort()).toEqual(Object.keys(POOL_VERSIONS).sort());
    const recipes = Object.values(config.recipes).map(recipe => JSON.stringify(recipe));
    expect(new Set(recipes).size).toBe(recipes.length);
    const packs = new Set(Object.values(config.sources).map((source: any) => source.packId));
    expect(packs.size).toBeGreaterThanOrEqual(10);
    for (const [id, versions] of Object.entries(POOL_VERSIONS)) {
      const src = versions[0].layers[0].src;
      const metaPath = path.resolve('public', path.dirname(src).slice(1), 'meta.json');
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
      expect(meta.id).toBe(id);
      expect(meta.sources).toHaveLength(versions[0].layers.length);
      for (const source of meta.sources) {
        expect(packs.has(source.packId), id).toBe(true);
        expect(source.bakedSha256, id).toMatch(/^[a-f0-9]{64}$/);
      }
    }
  });

  it('rejects a version selection without a registered rubric', () => {
    expect(setActiveVfxVersion('attack.fireball', 'missing-version')).toBe(false);
    expect(vfxVersionsFor('attack.nonexistent')).toEqual([]);
    expect(activeVfxVersionId('attack.nonexistent')).toBeNull();
    expect(activeVfxArt('attack.nonexistent')).toBeUndefined();
  });
});
