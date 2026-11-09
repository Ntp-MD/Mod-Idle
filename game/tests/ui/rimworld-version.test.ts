import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  activeVfxArt, activeVfxVersionId, setActiveVfxVersion, vfxArtCandidates, vfxVersionsFor,
} from '../../src/ui/fx/catalog';
import { resolveVfxPresentation } from '../../src/ui/combat/arena-skill-art';

const RIMWORLD = 'pool-rimworld';
const folder = path.join(process.cwd(), 'public/fx/skill-pool/attack-lightning/attack-chain-lightning');

describe('procedural rimworld version', () => {
  it('registers as a renderer-only version with no raster slots and never defaults', () => {
    const versions = vfxVersionsFor('attack.chain_lightning');
    const variant = versions.find((version) => version.id === RIMWORLD);
    expect(variant).toBeTruthy();
    expect(variant!.label).toBe('rimworld');
    expect(variant!.renderer).toBe('procedural');
    expect(variant!.default).toBe(false);
    expect(variant!.layers).toEqual([]);
    expect(JSON.parse(fs.readFileSync(path.join(folder, 'rimworld/version.json'), 'utf8')))
      .toEqual({ renderer: 'procedural' });
    expect(vfxArtCandidates('attack.chain_lightning').map((c) => c.versionId)).not.toContain(RIMWORLD);
  });

  it('routes the selected variant to the procedural renderer and leaves Base forced as Base', () => {
    const previous = activeVfxVersionId('attack.chain_lightning');
    try {
      expect(setActiveVfxVersion('attack.chain_lightning', RIMWORLD)).toBe(true);
      expect(resolveVfxPresentation('attack.chain_lightning', 'auto'))
        .toEqual({ kind: 'procedural', versionId: RIMWORLD });
      expect(resolveVfxPresentation('attack.chain_lightning', 'base').kind).toBe('base');
      // A renderer-only version owns no raster slot, so the atlas fallback stays off.
      expect(activeVfxArt('attack.chain_lightning')).toBeUndefined();
    } finally {
      if (previous) setActiveVfxVersion('attack.chain_lightning', previous);
    }
  });
});
