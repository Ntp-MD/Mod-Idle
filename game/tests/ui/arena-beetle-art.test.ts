import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { arenaArtForSpecies } from '../../src/ui/combat/arena/arena-art';
import { beetleVariants, directionalVariantArt } from '../../src/ui/combat/arena/arena-art-beetle';
import pool from '../../src/ui/combat/arena/mob-pool.generated.json';
import hollowDraftMeta from '../../public/combat/mob-pool/insect/beetle/variants/hollow-beetle/v1/meta.json';

describe('pawn beetle art', () => {
  it('uses four static views for the base and falls back for an unavailable variant', () => {
    const base = arenaArtForSpecies('beetle')!;
    expect(base).toBeDefined();
    expect(arenaArtForSpecies('beetle', 'Unknown Beetle')).toBe(base);
    expect(pool.species.beetle.metadata.layout).toMatchObject({ columns: 2, rows: 2, frameCount: 4 });
    expect(base.clips.walk.east?.frames).toBe(1);
    expect(base.clips.attack.west?.frames).toBe(1);
  });

  it('selects every authored beetle variant without treating views as animation frames', () => {
    for (const [name, art] of Object.entries(beetleVariants)) {
      expect(arenaArtForSpecies('beetle', name), name).toBe(art);
      for (const directions of Object.values(art.clips)) {
        expect(Object.keys(directions)).toHaveLength(8);
        for (const sheet of Object.values(directions)) {
          expect(sheet.frames, name).toBe(1);
          expect(sheet.sourceFrames?.[sheet.startFrame!], name).toBeDefined();
          expect(existsSync(fileURLToPath(new URL('../../public' + sheet.href, import.meta.url))), name).toBe(true);
        }
      }
    }
  });

  it('maps all actions to a static four-view atlas', () => {
    const { frames: _frames, ...metadata } = hollowDraftMeta;
    const draft = directionalVariantArt('/draft.png', metadata);
    expect(draft.clips.idle.south?.startFrame).toBe(0);
    expect(draft.clips.walk.east?.startFrame).toBe(3);
    expect(draft.clips.attack.west?.startFrame).toBe(2);
    expect(draft.clips.death?.north?.startFrame).toBe(1);
    expect(draft.clips.walk.east?.frames).toBe(1);
  });
});
