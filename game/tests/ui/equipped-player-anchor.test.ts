import { describe, expect, it } from 'vitest';
import type { ArenaSpriteSheet } from '../../src/ui/combat/arena/arena-art';
import { arenaArt } from '../../src/ui/combat/arena/arena-art';
import { equippedPlayerArt } from '../../src/ui/combat/arena/arena-equipped-player';
import { arenaSpriteScaleForFrame } from '../../src/ui/combat/combat-arena-view';
import {
  canonicalRootPx,
  legacyAnimationScale,
  normalizeArenaBody,
  referenceFramePx,
  resolveFrameScale,
  resolveMountM,
  resolveReleaseSocketM,
  rootPxForSheet,
  validateArenaBodySource,
} from '../../src/ui/combat/arena/arena-body-model';

type Clip = Record<string, ArenaSpriteSheet | undefined>;
const clip = (name: string): Clip => (equippedPlayerArt.clips as unknown as Record<string, Clip>)[name];

describe('pawn player body and equipment anchors', () => {
  it('uses one static eight-view atlas for every action', () => {
    for (const sheets of Object.values(equippedPlayerArt.clips) as Clip[]) {
      expect(Object.keys(sheets)).toHaveLength(8);
      for (const sheet of Object.values(sheets)) {
        expect(sheet?.columns).toBe(4);
        expect(sheet?.rows).toBe(2);
        expect(sheet?.frames).toBe(1);
        expect(sheet?.sourceFrames).toHaveLength(8);
      }
    }
    expect(equippedPlayerArt.anchor).toEqual({ x: 0.5, y: 0.875 });
    expect(arenaArt.hero).toBe(equippedPlayerArt);
  });

  it('keeps the player root and collision footprint in model metres', () => {
    expect(equippedPlayerArt.assetId).toBe('player-pawn');
    expect(validateArenaBodySource(equippedPlayerArt, 'player-pawn')).toEqual([]);
    const body = normalizeArenaBody(equippedPlayerArt, { assetId: 'player-pawn', radiusM: 0.25, bodySize: 'player' });
    expect(body.fallback).toBe(false);
    expect(body.referenceWidthM.value).toBeCloseTo(0.5, 12);
    const ref = referenceFramePx(equippedPlayerArt)!;
    expect(body.referenceBoundsPx).toEqual({ width: ref.width, height: ref.height });
    expect(canonicalRootPx(equippedPlayerArt)).toEqual({ x: 128, y: 224 });
    expect(rootPxForSheet(equippedPlayerArt, clip('idle').east)).toEqual({ x: 128, y: 224 });
    expect(rootPxForSheet(equippedPlayerArt, clip('attack').west)).toEqual({ x: 128, y: 224 });
    expect(legacyAnimationScale({ units: 'metres', scale: 1 }, 'player-pawn')).toBe(1);
  });

  it('places independent weapons on the authored pawn grips', () => {
    const body = normalizeArenaBody(equippedPlayerArt, { assetId: 'player-pawn', radiusM: 0.25, bodySize: 'player' });
    const east = clip('attack').east!;
    const west = clip('attack').west!;
    expect(east.releaseSocket?.provenance).toBe('authored-fallback');
    expect(west.releaseSocket?.provenance).toBe('authored-fallback');
    expect(resolveReleaseSocketM(east, rootPxForSheet(equippedPlayerArt, east), body.metresPerPixel)).toBeDefined();
    expect(body.releaseSocketsM['attack:east']).toBeDefined();
    expect(body.releaseSocketsM['attack:west']).toBeDefined();

    const grip = clip('idle').south!.mainGripCell!;
    const root = rootPxForSheet(equippedPlayerArt, clip('idle').south);
    const plain = resolveMountM(grip, root, body.metresPerPixel, false)!;
    const mirrored = resolveMountM(grip, root, body.metresPerPixel, true)!;
    expect(mirrored.x).toBeCloseTo(-plain.x, 12);
    expect(mirrored.y).toBeCloseTo(plain.y, 12);
    expect(arenaSpriteScaleForFrame(undefined, 600)).toBe(1);
  });

  it('keeps the shared mob baseline and uses no clip-specific size correction', () => {
    const goblin = arenaArt.species.goblin!;
    expect(goblin.clips.idle.east?.anchor).toBeUndefined();
    expect(goblin.clips.attack.east?.anchor).toBeUndefined();
    for (const action of ['idle', 'walk', 'attack', 'hit', 'death'] as const) {
      const sheet = clip(action).south!;
      const frame = sheet.sourceFrames?.[sheet.startFrame!];
      expect(frame).toBeDefined();
      expect(resolveFrameScale(equippedPlayerArt, action, frame?.height)).toBe(1);
    }
    expect(resolveFrameScale(equippedPlayerArt, 'idle', 0)).toBe(1);
  });
});
