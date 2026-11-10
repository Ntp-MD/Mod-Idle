import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { activeVfxArt, activeVfxVersionId, setActiveVfxVersion, vfxArtCandidates, vfxVersionsFor } from '../../src/ui/fx/catalog';
import { POOL_VERSIONS } from '../../src/ui/fx/pool.generated';

const publicPath = (src: string) => path.join(process.cwd(), 'public', src.replace(/^\//, ''));

describe('skill VFX pool', () => {
  it('keeps the fallback active until a default pointer promotes a component recipe', () => {
    const missing = sm.all().filter((skill: any) => vfxVersionsFor(skill.id).length === 0)
      .map((skill: any) => skill.id).sort();
    expect(missing).toEqual([]);
    for (const skill of sm.all()) {
      const versions = vfxVersionsFor(skill.id);
      expect(versions.some((version) => version.id === 'pool-rimworld'), skill.id).toBe(true);
      for (const version of versions) {
        expect(['pool-rimworld', 'pool-vfx-component'], skill.id).toContain(version.id);
      }
      const defaults = versions.filter((version) => version.default);
      expect(defaults.length, skill.id).toBeLessThanOrEqual(1);
      const active = defaults[0] ?? versions[0];
      expect(activeVfxVersionId(skill.id), skill.id).toBe(active.id);
      if (active.renderer === 'procedural') {
        expect(active, skill.id).toMatchObject({ id: 'pool-rimworld', label: 'rimworld', arena: true, layers: [] });
        expect(activeVfxArt(skill.id), skill.id).toBeUndefined();
        expect(vfxArtCandidates(skill.id), skill.id).toEqual([]);
      } else {
        expect(active.id, skill.id).toBe('pool-vfx-component');
        expect(activeVfxArt(skill.id)?.atlas, skill.id).toBeDefined();
      }
    }
  });

  it('keeps fallback rows raster-free and component recipes self-contained', () => {
    const versions = Object.values(POOL_VERSIONS).flat();
    expect(versions.length).toBeGreaterThanOrEqual(90);
    for (const version of versions) {
      if (version.id === 'pool-rimworld') {
        expect(version.renderer, version.id).toBe('procedural');
        expect(version.decal, version.id).toBeUndefined();
        expect(version.layers, version.id).toEqual([]);
        continue;
      }
      expect(version.id).toBe('pool-vfx-component');
      expect(version.layers.length).toBeGreaterThan(0);
      for (const layer of version.layers) {
        expect(layer.frame.count).toBeGreaterThan(0);
        expect(fs.existsSync(publicPath(layer.src)), layer.src).toBe(true);
      }
    }
  });

  it('keeps the selector on the fallback and rejects an unregistered version or skill', () => {
    expect(setActiveVfxVersion('attack.fireball', 'pool-v2')).toBe(false);
    expect(setActiveVfxVersion('attack.fireball', 'pool-rimworld')).toBe(true);
    expect(activeVfxVersionId('attack.fireball')).toBe('pool-rimworld');
    expect(vfxVersionsFor('attack.nonexistent')).toEqual([]);
    expect(activeVfxVersionId('attack.nonexistent')).toBeNull();
    expect(activeVfxArt('attack.nonexistent')).toBeUndefined();
  });
});
