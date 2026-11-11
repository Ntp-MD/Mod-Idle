import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { activeVfxArt, activeVfxVersionId, setActiveVfxVersion, vfxVersionsFor } from '../../src/ui/fx/catalog';
import { POOL_VERSIONS } from '../../src/ui/fx/pool.generated';

const publicPath = (src: string) => path.join(process.cwd(), 'public', src.replace(/^\//, ''));

describe('skill VFX pool', () => {
  it('keeps the current material recipes and protected Thunder Storm pixels after flattening', () => {
    const source = path.resolve(process.cwd(), '../docs/vfx-skill/component-vfx/outputs');
    const recipes = JSON.parse(fs.readFileSync(path.join(source, 'recipes.json'), 'utf8'));
    const active = sm.all().filter((skill: any) => skill.type !== 'aura' && skill.id !== 'attack.thunder_storm');
    expect(Object.keys(recipes).sort()).toEqual(active.map((skill: any) => skill.id).sort());
    for (const [skill, recipe] of Object.entries(recipes) as [string, { src: string; shapes: string[] }][]) {
      const version = vfxVersionsFor(skill).find(v => v.id === 'pool');
      expect(version, skill).toBeDefined();
      expect(version!.default, skill).toBe(true);
      expect(version!.layers.map(layer => layer.id), skill).toEqual(recipe.shapes);
      expect(fs.existsSync(publicPath(recipe.src)), recipe.src).toBe(true);
    }
    const protectedFiles = JSON.parse(fs.readFileSync(path.join(source, 'preserved-defaults.json'), 'utf8'));
    expect(Object.keys(protectedFiles).some(file => file.includes('attack-thunder-storm'))).toBe(true);
    for (const [file, digest] of Object.entries(protectedFiles)) {
      expect(file.endsWith('.png'), file).toBe(true);
      const bytes = fs.readFileSync(path.resolve(process.cwd(), '..', file));
      expect(createHash('sha256').update(bytes).digest('hex'), file).toBe(digest);
    }
  });
  it('keeps exactly one current raster recipe per skill with a Base fallback', () => {
    const missing = sm.all().filter((skill: any) => vfxVersionsFor(skill.id).length === 0)
      .map((skill: any) => skill.id).sort();
    expect(missing).toEqual([]);
    for (const skill of sm.all()) {
      const versions = vfxVersionsFor(skill.id);
      expect(versions.length, skill.id).toBe(1);
      for (const version of versions) {
        expect(version.id, skill.id).toBe('pool');
      }
      const defaults = versions.filter((version) => version.default);
      expect(defaults.length, skill.id).toBe(1);
      const active = defaults[0] ?? versions[0];
      expect(activeVfxVersionId(skill.id), skill.id).toBe(active.id);
      expect(activeVfxArt(skill.id), skill.id).toBeDefined();
    }
    expect(activeVfxArt('attack.nonexistent')).toBeUndefined();
  });

  it('keeps every pool row raster-backed', () => {
    const versions = Object.values(POOL_VERSIONS).flat();
    expect(versions.length).toBeGreaterThanOrEqual(90);
    for (const version of versions) {
      expect(version.id).toBe('pool');
      expect(version.layers.length).toBeGreaterThan(0);
      for (const layer of version.layers) {
        expect(layer.frame.count).toBeGreaterThan(0);
        expect(layer.src).toMatch(/^\/fx\/skill-pool\/[^/]+\/[^/]+\/[^/]+\.png$/);
        expect(fs.existsSync(publicPath(layer.src)), layer.src).toBe(true);
        const folder = path.dirname(publicPath(layer.src));
        expect(fs.existsSync(path.join(folder, 'meta.json')), folder).toBe(true);
        expect(fs.readdirSync(folder, { withFileTypes: true }).filter(entry => entry.isDirectory()), folder).toEqual([]);
      }
    }
  });

  it('rejects an unregistered version or skill', () => {
    expect(setActiveVfxVersion('attack.fireball', 'pool-v2')).toBe(false);
    expect(vfxVersionsFor('attack.nonexistent')).toEqual([]);
    expect(activeVfxVersionId('attack.nonexistent')).toBeNull();
    expect(activeVfxArt('attack.nonexistent')).toBeUndefined();
  });
});
