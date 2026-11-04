import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pool from '../../src/ui/combat/arena/mob-pool.generated.json';
import { arenaArtForSpecies } from '../../src/ui/combat/arena/arena-art';

describe('mob sprite pool', () => {
  it('matches the selected files and keeps every species available to the arena', () => {
    const root = fileURLToPath(new URL('../../..', import.meta.url));
    expect(() => execFileSync(process.execPath, ['tools/mob-sprite-pool.mjs', '--check'], { cwd: root })).not.toThrow();
    for (const [species, entry] of Object.entries(pool.species)) {
      expect(existsSync(fileURLToPath(new URL('../../public' + entry.href, import.meta.url))), species).toBe(true);
      expect(arenaArtForSpecies(species)?.clips.idle.south?.href, species).toBe(entry.href);
    }
  });
});
