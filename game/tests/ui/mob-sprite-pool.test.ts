import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pool from '../../src/ui/combat/arena/mob-pool.generated.json';
import { arenaArtForSpecies } from '../../src/ui/combat/arena/arena-art';

describe('mob sprite pool', () => {
  it('matches the selected files and keeps every species available to the arena', () => {
    const root = fileURLToPath(new URL('../../..', import.meta.url));
    expect(() => execFileSync(process.execPath, ['tools/mob-sprite-pool.mjs', '--check'], { cwd: root })).not.toThrow();
    const entries = [
      ...Object.values(pool.species),
      ...Object.values(pool.variants).flatMap((variants) => Object.values(variants)),
    ];
    const manifest = JSON.parse(readFileSync(new URL('../../../docs/character/pawn-study/manifest.json', import.meta.url), 'utf8'));
    expect(entries).toHaveLength(manifest.speciesCount + manifest.variantCount);
    for (const entry of entries) {
      expect(entry.href).toMatch(/\/master-version\/atlas\.png$/);
      const atlas = fileURLToPath(new URL('../../public' + entry.href, import.meta.url));
      expect(existsSync(atlas), entry.href).toBe(true);
      const siblings = readdirSync(dirname(dirname(atlas)), { withFileTypes: true });
      expect(siblings.filter((item) => item.isDirectory() && (/^v[1-9]\d*$/.test(item.name) || item.name === 'default')), entry.href).toHaveLength(0);
      expect(entry.metadata.layout.frameCount, entry.href).toBe(8);
    }
    for (const [species, entry] of Object.entries(pool.species)) {
      expect(existsSync(fileURLToPath(new URL('../../public' + entry.href, import.meta.url))), species).toBe(true);
      expect(arenaArtForSpecies(species)?.clips.idle.south?.href, species).toBe(entry.href);
    }
    for (const [species, variants] of Object.entries(pool.variants)) {
      for (const [name, entry] of Object.entries(variants)) {
        expect(arenaArtForSpecies(species, name)?.clips.idle.south?.href, `${species}/${name}`).toBe(entry.href);
      }
    }
  });
});
