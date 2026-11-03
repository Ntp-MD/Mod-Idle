import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { activeVfxArt, activeVfxVersionId, setActiveVfxVersion, vfxVersionsFor } from '../../src/ui/fx/catalog';

describe('mixed Blizzard', () => {
  it('plays v6 as v3 and v1 ice effects without the v4 ground layer', () => {
    const previous = activeVfxVersionId('attack.blizzard');
    try {
      expect(setActiveVfxVersion('attack.blizzard', 'pool-v6')).toBe(true);
      const layers = activeVfxArt('attack.blizzard')!.atlases!;
      expect(layers).toHaveLength(2);
      expect(layers.map(layer => layer.projection)).toEqual([undefined, undefined]);
      expect(layers.map(layer => layer.rainPhase)).toEqual(['Field', 'Field']);
      expect(layers.map(layer => layer.rainDurationSec)).toEqual([8, 8]);
      const pool = path.join(process.cwd(), 'public/fx/skill-pool/attack-cold/attack-blizzard');
      const meta = JSON.parse(fs.readFileSync(path.join(pool, 'v6/meta.json'), 'utf8'));
      expect(layers.map(layer => layer.rainIntervalSec))
        .toEqual([meta.rainIntervalSec, meta.additionalLayers[0].rainIntervalSec]);
      expect(layers.map(layer => layer.rainSizeScale))
        .toEqual([meta.rainSizeScale, meta.additionalLayers[0].rainSizeScale]);
      expect(meta.sourceVersions).toEqual(['v3', 'v1']);
      for (const [source, name] of [['v3', 'atlas.png'], ['v1', 'ice-rain.png']]) {
        const digest = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        expect(digest(path.join(pool, 'v6', name))).toBe(digest(path.join(pool, source, 'atlas.png')));
      }
    } finally {
      if (previous) setActiveVfxVersion('attack.blizzard', previous);
    }
  });
});
