import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { arenaArtForSpecies } from '../../src/ui/combat/arena/arena-art';
import { beetleVariants, directionalVariantArt } from '../../src/ui/combat/arena/arena-art-beetle';
import pool from '../../src/ui/combat/arena/mob-pool.generated.json';
import hollowDraftMeta from '../../public/combat/mob-pool/insect/beetle/variants/hollow-beetle/v1/meta.json';

const beetleMain = pool.species.beetle.metadata;
const borerMeta = pool.variants.beetle['Borer Beetle'].metadata;
const carapaceMeta = pool.variants.beetle['Carapace Beetle'].metadata;
const dustMeta = pool.variants.beetle['Dust Beetle'].metadata;
const hollowMeta = pool.variants.beetle['Hollow Beetle'].metadata;
const ironshellMeta = pool.variants.beetle['Ironshell Beetle'].metadata;
const animatedVariants = new Set(['Dust Beetle', 'Borer Beetle', 'Carapace Beetle', 'Hollow Beetle', 'Ironshell Beetle']);

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
        const animated = animatedVariants.has(name) && action !== 'idle';
        expect(Object.keys(directions), `${name} ${action}`).toHaveLength(animated ? 2 : 8);
        for (const sheet of Object.values(directions)) {
          expect(sheet.frames, `${name} ${action}`).toBe(animated ? 4 : 1);
          expect(sheet.sourceFrames?.[sheet.startFrame!], name).toBeDefined();
          expect(existsSync(fileURLToPath(new URL('../../public' + sheet.href, import.meta.url))), name).toBe(true);
        }
      }
      expect(art.clips.walk.east?.startFrame).toBe(animatedVariants.has(name) ? 8 : 10);
      expect(art.clips.attack.west?.startFrame).toBe(animatedVariants.has(name) ? 20 : 22);
      if (!animatedVariants.has(name)) expect(art.clips.death?.north?.startFrame).toBe(36);
    }
  });

  it('keeps other species on their existing registry entries', () => {
    expect(arenaArtForSpecies('skeleton', 'Dust Beetle')).toBe(arenaArtForSpecies('skeleton'));
    expect(arenaArtForSpecies('unknown-species')).toBeNull();
  });

  it('maps directional draft rows without treating different facings as animation frames', () => {
    const { frames: _frames, ...metadata } = hollowDraftMeta;
    const draft = directionalVariantArt('/draft.png', metadata);
    expect(draft.clips.idle.south?.startFrame).toBe(0);
    expect(draft.clips.walk.east?.startFrame).toBe(10);
    expect(draft.clips.attack.west?.startFrame).toBe(22);
    expect(draft.clips.death?.north?.startFrame).toBe(36);
    expect(draft.clips.walk.east?.frames).toBe(1);
  });

  it('maps every action and direction to its declared metadata frame inside the image', () => {
    const actions = ['idle', 'walk', 'attack', 'hit', 'death'] as const;
    const directions = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    const metas: Record<string, { frames: { action: string; direction: string; index: number }[]; sourceCanvas: { width: number; height: number } }> = {
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
        const animated = animatedVariants.has(name) && action !== 'idle';
        const expectedDirections = animated ? ['east', 'west'] : directions;
        expect(Object.keys(clip).sort(), `${name} ${action} directions`).toEqual([...expectedDirections].sort());
        for (const direction of expectedDirections) {
          const sheet = clip[direction];
          const want = (meta.frames ?? []).find((frame) => frame.action === action && frame.direction === direction)?.index;
          expect(sheet.startFrame, `${name} ${action} ${direction} frame`).toBe(want);
          expect(sheet.frames, `${name} ${action} ${direction} count`).toBe(animated ? 4 : 1);
          for (let i = sheet.startFrame; i < sheet.startFrame + sheet.frames; i++) {
            const rect = sheet.sourceFrames?.[i];
            expect(rect, `${name} ${action} ${direction} rect`).toBeDefined();
            expect(rect.x, `${name} ${action} ${direction} x`).toBeGreaterThanOrEqual(0);
            expect(rect.y, `${name} ${action} ${direction} y`).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width, `${name} ${action} ${direction} right`).toBeLessThanOrEqual(meta.sourceCanvas.width);
            expect(rect.y + rect.height, `${name} ${action} ${direction} bottom`).toBeLessThanOrEqual(meta.sourceCanvas.height);
          }
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

  it('sizes the visible beetle body from a trimmed idle frame', () => {
    for (const [name, art] of Object.entries(beetleVariants)) {
      const idle = art.clips.idle.south!;
      const source = idle.sourceFrames?.[idle.startFrame!];
      expect(source, name).toBeDefined();
      expect(source!.width, name).toBeLessThan(idle.frameWidth);
      expect(source!.height, name).toBeLessThan(idle.frameHeight);
    }
  });
});
