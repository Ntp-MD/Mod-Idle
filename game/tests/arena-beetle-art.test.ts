import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { arenaArtForSpecies } from '../src/ui/combat/arena/arena-art';
import { beetleVariants } from '../src/ui/combat/arena/arena-art-beetle';
import beetleMain from '../src/ui/combat/arena/arena-art-pixel-v2/beetle-animation-v1.json';
import borerMeta from '../src/ui/combat/arena/arena-art-pixel-v2/borer-beetle-animation-v1.json';
import carapaceMeta from '../src/ui/combat/arena/arena-art-pixel-v2/carapace-beetle-animation-v1.json';
import dustMeta from '../src/ui/combat/arena/arena-art-pixel-v2/dust-beetle-animation-v1.json';
import hollowMeta from '../src/ui/combat/arena/arena-art-pixel-v2/hollow-beetle-animation-v1.json';
import ironshellMeta from '../src/ui/combat/arena/arena-art-pixel-v2/ironshell-beetle-animation-v1.json';

describe('production beetle art', () => {
  it('uses the animated base for an unknown variant', () => {
    const base = arenaArtForSpecies('beetle')!;
    expect(base).toBeDefined();
    expect(arenaArtForSpecies('beetle', 'Unknown Beetle')).toBe(base);
    expect(base.clips.walk.east?.frames).toBe(4);
    expect(base.clips.attack.west?.frames).toBe(4);
  });

  it('selects each named variant without playing neighbouring facings as animation', () => {
    for (const [name, art] of Object.entries(beetleVariants)) {
      expect(arenaArtForSpecies('beetle', name), name).toBe(art);
      for (const [action, directions] of Object.entries(art.clips)) {
        expect(Object.keys(directions), `${name} ${action}`).toHaveLength(8);
        for (const sheet of Object.values(directions)) {
          expect(sheet.frames, `${name} ${action}`).toBe(1);
          expect(sheet.sourceFrames?.[sheet.startFrame!], name).toBeDefined();
          expect(existsSync(fileURLToPath(new URL('../public' + sheet.href, import.meta.url))), name).toBe(true);
        }
      }
      expect(art.clips.walk.east?.startFrame).toBe(10);
      expect(art.clips.attack.west?.startFrame).toBe(22);
      expect(art.clips.death?.north?.startFrame).toBe(36);
    }
  });

  it('keeps other species on their existing registry entries', () => {
    expect(arenaArtForSpecies('skeleton', 'Dust Beetle')).toBe(arenaArtForSpecies('skeleton'));
    expect(arenaArtForSpecies('unknown-species')).toBeNull();
  });

  it('maps every action and direction to its declared metadata frame inside the image', () => {
    const actions = ['idle', 'walk', 'attack', 'hit', 'death'] as const;
    const directions = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    const metas: Record<string, typeof dustMeta> = {
      'Dust Beetle': dustMeta,
      'Carapace Beetle': carapaceMeta,
      'Borer Beetle': borerMeta,
      'Ironshell Beetle': ironshellMeta,
      'Hollow Beetle': hollowMeta,
    };
    for (const [name, art] of Object.entries(beetleVariants)) {
      const meta = metas[name];
      for (const action of actions) {
        const clip = (art.clips as any)[action] ?? {};
        expect(Object.keys(clip).sort(), `${name} ${action} directions`).toEqual([...directions].sort());
        for (const direction of directions) {
          const sheet = clip[direction];
          const want = (meta.frames ?? []).find((frame) => frame.action === action && frame.direction === direction)?.index;
          expect(sheet.startFrame, `${name} ${action} ${direction} frame`).toBe(want);
          expect(sheet.frames, `${name} ${action} ${direction} count`).toBe(1);
          const rect = sheet.sourceFrames?.[sheet.startFrame];
          expect(rect, `${name} ${action} ${direction} rect`).toBeDefined();
          expect(rect.x, `${name} ${action} ${direction} x`).toBeGreaterThanOrEqual(0);
          expect(rect.y, `${name} ${action} ${direction} y`).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width, `${name} ${action} ${direction} right`).toBeLessThanOrEqual(meta.sourceCanvas.width);
          expect(rect.y + rect.height, `${name} ${action} ${direction} bottom`).toBeLessThanOrEqual(meta.sourceCanvas.height);
        }
      }
    }
    const base = arenaArtForSpecies('beetle')!;
    const main = beetleMain as any;
    for (const [action, clip] of Object.entries((base.clips as any) ?? {})) {
      for (const [direction, raw] of Object.entries((clip as any) ?? {})) {
        const sheet = raw as any;
        expect(sheet.startFrame + sheet.frames - 1, `beetle ${action} ${direction} range`)
          .toBeLessThan(main.sourceFrames.length);
        for (let i = sheet.startFrame; i < sheet.startFrame + sheet.frames; i++) {
          const rect = sheet.sourceFrames[i];
          expect(rect, `beetle ${action} ${direction} rect ${i}`).toBeDefined();
          expect(rect.x + rect.width, `beetle ${action} ${direction} right ${i}`)
            .toBeLessThanOrEqual(main.sourceCanvas.width);
          expect(rect.y + rect.height, `beetle ${action} ${direction} bottom ${i}`)
            .toBeLessThanOrEqual(main.sourceCanvas.height);
        }
      }
    }
  });
});
