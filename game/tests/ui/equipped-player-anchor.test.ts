import { describe, expect, it } from 'vitest';
import type { ArenaSpriteSheet } from '../../src/ui/combat/arena/arena-art';
import { arenaArt } from '../../src/ui/combat/arena/arena-art';
import { equippedPlayerArt } from '../../src/ui/combat/arena/arena-equipped-player';

const CANVAS = 1254;
type Clip = Record<string, ArenaSpriteSheet | undefined>;
const clip = (name: string): Clip => (equippedPlayerArt.clips as unknown as Record<string, Clip>)[name];
const anchorY = (name: string, direction: string): number | undefined => {
  const anchor = clip(name)[direction]?.anchor;
  return anchor ? anchor.y * CANVAS : undefined;
};

describe('equipped player 3/4 foot anchors', () => {
  it('anchors each idle direction on its own measured foot line', () => {
    expect(anchorY('idle', 'east')).toBeCloseTo(943, 6);
    expect(anchorY('idle', 'west')).toBeCloseTo(942, 6);
    expect(anchorY('idle', 'south')).toBeCloseTo(972, 6);
    expect(anchorY('idle', 'north')).toBeCloseTo(937, 6);
    // The old single anchor at y=1000 put every idle pose below its own painted feet.
    expect(anchorY('idle', 'south')! - anchorY('idle', 'north')!).toBeGreaterThan(30);
  });

  it('uses each clip’s own contact frame for walk, attack, hit and death', () => {
    expect(anchorY('walk', 'east')).toBeCloseTo(962, 6);
    expect(anchorY('walk', 'west')).toBeCloseTo(976, 6);
    expect(anchorY('attack', 'east')).toBeCloseTo(1038, 6);
    expect(anchorY('attack', 'west')).toBeCloseTo(992, 6);
    expect(anchorY('hit', 'east')).toBeCloseTo(934, 6);
    expect(anchorY('death', 'west')).toBeCloseTo(916, 6);
  });

  it('centres every sheet anchor horizontally and keeps the art-level fallback', () => {
    for (const sheets of Object.values(equippedPlayerArt.clips) as Clip[]) {
      for (const sheet of Object.values(sheets)) expect(sheet?.anchor?.x).toBe(0.5);
    }
    expect(equippedPlayerArt.anchor).toEqual({ x: 627 / CANVAS, y: 1000 / CANVAS });
  });

  it('leaves the shared mob baseline on the art anchor', () => {
    const goblin = arenaArt.species.goblin!;
    expect(goblin.clips.idle.east?.anchor).toBeUndefined();
    expect(goblin.clips.attack.east?.anchor).toBeUndefined();
  });
});
