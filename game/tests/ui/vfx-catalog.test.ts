import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { activeVfxArt, activeVfxVersionId, setActiveVfxVersion, vfxVersionsFor } from '../../src/ui/fx/catalog';
import { POOL_VERSIONS } from '../../src/ui/fx/pool.generated';

const publicPath = (src: string) => path.join(process.cwd(), 'public', src.replace(/^\//, ''));

describe('skill VFX atlas pool', () => {
  it('resolves Fissure v1 from its current pointer and packed frame metadata', () => {
    const versions = vfxVersionsFor('attack.fissure');
    const folder = path.join(process.cwd(), 'public/fx/skill-pool/attack-earth/attack-fissure');
    const pointer = JSON.parse(fs.readFileSync(path.join(folder, 'default/version.json'), 'utf8'));
    const meta = JSON.parse(fs.readFileSync(path.join(folder, 'v1/meta.json'), 'utf8'));
    expect(versions[0].id).toBe(`pool-${pointer.version}`);
    expect(versions[0].default).toBe(true);
    const first = versions.find(version => version.id === 'pool-v1')!;
    expect(first.layers[0].src).toBe(meta.src);
    expect(fs.existsSync(publicPath(first.layers[0].src))).toBe(true);
    expect(first.layers[0].frame.virtualWidth).toBe(meta.virtualWidth);
    expect(first.layers[0].frame.sourceFrames?.length).toBe(meta.frames.length);
    for (const version of versions) for (const layer of version.layers)
      expect(fs.existsSync(publicPath(layer.src)), layer.src).toBe(true);
  });

  it('registers the Aftershock versions and their files', () => {
    const versions = vfxVersionsFor('attack.aftershock');
    expect(versions.length).toBeGreaterThanOrEqual(2);
    for (const version of versions) {
      expect(version.id).toBeTruthy();
      expect(version.layers.length).toBeGreaterThan(0);
      for (const layer of version.layers) {
        expect(layer.frame.count).toBeGreaterThan(0);
        expect(layer.frame.columns).toBeGreaterThan(0);
        expect(layer.frame.width).toBeGreaterThan(0);
        expect(layer.frame.height).toBeGreaterThan(0);
        expect(fs.existsSync(publicPath(layer.src)), layer.src).toBe(true);
      }
    }
  });

  it('switches the active runtime art version and falls back to the first', () => {
    const first = vfxVersionsFor('attack.aftershock')[0];
    const second = vfxVersionsFor('attack.aftershock')[1];
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(setActiveVfxVersion('attack.aftershock', second.id)).toBe(true);
    expect(activeVfxVersionId('attack.aftershock')).toBe(second.id);
    expect(activeVfxArt('attack.aftershock')?.decal).toBe(second.decal);
    setActiveVfxVersion('attack.aftershock', first.id);
    expect(activeVfxVersionId('attack.aftershock')).toBe(first.id);
  });

  it('renders a chosen decal still even when a multi-frame atlas exists', () => {
    const versions = vfxVersionsFor('attack.thunder_storm');
    const atlasDefault = versions.find((version) => version.default)!;
    const decal = versions.find((version) => version.decal)!;
    expect(atlasDefault.layers.some((layer) => layer.frame.count > 1)).toBe(true);
    expect(setActiveVfxVersion('attack.thunder_storm', decal.id)).toBe(true);
    const art = activeVfxArt('attack.thunder_storm');
    expect(art?.atlas).toBeUndefined();
    expect(art?.decal).toBe(decal.decal);
    setActiveVfxVersion('attack.thunder_storm', atlasDefault.id);
    expect(activeVfxArt('attack.thunder_storm')?.atlas).toBeDefined();
  });

  it('returns no atlas art for an unregistered id', () => {
    expect(vfxVersionsFor('attack.nonexistent')).toEqual([]);
    expect(activeVfxVersionId('attack.nonexistent')).toBeNull();
    expect(activeVfxArt('attack.nonexistent')).toBeUndefined();
  });

  it('plays the archived pool animation in the arena with its authored aim metadata', () => {
    const pool = vfxVersionsFor('attack.fireball');
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((version) => version.arena === true)).toBe(true);
    expect(pool[0].layers[0].frame.count).toBeGreaterThan(1);
    const atlas = activeVfxArt('attack.fireball')?.atlas;
    expect(atlas).toBeTruthy();
    expect(atlas?.orient).toBe(true);
    expect(atlas?.anchor?.length).toBe(2);
    expect(atlas?.impactAnchor?.length).toBe(2);
    expect(atlas?.content?.widthRatio).toBeGreaterThan(0);
    expect(atlas?.frames?.opening).toEqual([0, 3]);
    expect(atlas?.frames?.exit).toEqual([12, 15]);
    expect(atlas?.authoring?.delivery).toBe('projectile');
    const meta = JSON.parse(fs.readFileSync(path.join(path.dirname(publicPath(atlas!.src)), 'meta.json'), 'utf8'));
    expect(atlas?.virtualWidth).toBe(meta.virtualWidth);
    expect(atlas?.virtualHeight).toBe(meta.virtualHeight);
    if (meta.frames) {
      expect(atlas?.sourceFrames?.[4]).toEqual({
        rect: meta.frames[4].rect, offsetX: meta.frames[4].offsetX, offsetY: meta.frames[4].offsetY,
      });
    } else {
      expect(atlas?.sourceFrames).toBeUndefined();
      expect(atlas?.width).toBe(meta.cellWidth);
      expect(atlas?.height).toBe(meta.cellHeight);
    }
  });

  it('carries the authored sector/line geometry for directional skills', () => {
    expect(activeVfxArt('attack.cleave')?.atlas?.authoring?.shape).toBe('cone');
    expect(activeVfxArt('attack.cleave')?.atlas?.authoring?.angleDeg).toBe(120);
    expect(activeVfxArt('attack.fissure')?.atlas?.authoring?.shape).toBe('line');
    expect(activeVfxArt('attack.fissure')?.atlas?.authoring?.lengthM).toBe(6);
    expect(activeVfxArt('attack.whirlwind')?.atlas?.authoring?.shape).toBe('circle');
  });

  it('covers every live skill', () => {
    const missing = sm.all().filter((skill: any) => vfxVersionsFor(skill.id).length === 0)
      .map((skill: any) => skill.id).sort();
    expect(missing).toEqual([]);
    expect(activeVfxArt('attack.double_strafe')?.atlas?.orient).toBe(true);
    expect(activeVfxArt('attack.double_strafe')?.atlas?.frames?.exit).toEqual([12, 15]);
    expect(activeVfxArt('attack.double_strafe')?.atlas?.authoring?.delivery).toBe('projectile');
  });

  it('has every archived pool atlas on disk and a valid frame grid', () => {
    let checked = 0;
    for (const versions of Object.values(POOL_VERSIONS)) for (const version of versions) {
      expect(version.arena).toBe(true);
      if (version.decal) expect(fs.existsSync(publicPath(version.decal)), version.decal).toBe(true);
      for (const layer of version.layers) {
        expect(fs.existsSync(publicPath(layer.src)), layer.src).toBe(true);
        expect(layer.frame.count).toBeGreaterThan(0);
        expect(layer.frame.columns).toBeGreaterThan(0);
        expect(layer.frame.width).toBeGreaterThan(0);
        expect(layer.frame.height).toBeGreaterThan(0);
        expect(layer.fps ?? 0).toBeGreaterThan(0);
        const texture = fs.readFileSync(publicPath(layer.src));
        expect(layer.frame.textureWidth).toBe(texture.readUInt32BE(16));
        expect(layer.frame.textureHeight).toBe(texture.readUInt32BE(20));
        const metaPath = path.join(path.dirname(publicPath(layer.src)), 'meta.json');
        const versionMeta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : null;
        const meta = versionMeta?.additionalLayers?.find((entry: any) => entry.file === path.basename(layer.src))
          ?? versionMeta;
        if (meta?.frames) {
          expect(layer.frame.virtualWidth).toBe(meta.virtualWidth);
          expect(layer.frame.virtualHeight).toBe(meta.virtualHeight);
          expect(layer.frame.sourceFrames).toEqual(meta.frames.map((frame: any) => ({
            rect: frame.rect, offsetX: frame.offsetX, offsetY: frame.offsetY,
          })));
          expect(layer.frame.sourceFrames?.length).toBe(layer.frame.count);
          for (const frame of layer.frame.sourceFrames ?? []) {
            const [x, y, width, height] = frame.rect;
            expect(x).toBeGreaterThanOrEqual(0);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(width).toBeGreaterThan(0);
            expect(height).toBeGreaterThan(0);
            expect(x + width).toBeLessThanOrEqual(layer.frame.textureWidth!);
            expect(y + height).toBeLessThanOrEqual(layer.frame.textureHeight!);
            expect(frame.offsetX).toBeGreaterThanOrEqual(0);
            expect(frame.offsetY).toBeGreaterThanOrEqual(0);
            expect(frame.offsetX + width).toBeLessThanOrEqual(layer.frame.virtualWidth!);
            expect(frame.offsetY + height).toBeLessThanOrEqual(layer.frame.virtualHeight!);
          }
        } else {
          expect(layer.frame.sourceFrames).toBeUndefined();
          expect(layer.frame.width * layer.frame.columns).toBe(layer.frame.textureWidth);
          expect(layer.frame.height * (layer.frame.rows ?? 1)).toBe(layer.frame.textureHeight);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
