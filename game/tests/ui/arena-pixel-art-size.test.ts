import { describe, expect, it } from 'vitest';
import pool from '../../src/ui/combat/arena/mob-pool.generated.json';
import { pixelArenaArt, pilotArt } from '../../src/ui/combat/arena/arena-art-pixel-v2';
import type { ArenaCharacterArt } from '../../src/ui/combat/arena/arena-art';
import {
  VISUAL_WIDTH_RATIO,
  fallbackBodyVisual,
  legacyDisplayScale,
  normalizeArenaBody,
  resolveMountM,
  resolveReleaseSocketM,
  rootPxForSheet,
  validateArenaBodySource,
  visualWidthRatioForSize,
} from '../../src/ui/combat/arena/arena-body-model';

describe('pixel mob display size calibration', () => {
  it('aligns south idle visible height without changing body-class scale', () => {
    const heights = Object.entries(pool.species).map(([id, entry]) => {
      const frame = entry.metadata.sourceFrames?.[0];
      expect(frame, id).toBeDefined();
      const aspect = frame!.height / Math.max(1, frame!.width);
      const art = pixelArenaArt.species[id];

      expect(art, id).toBeDefined();
      expect(art!.displayScale, id).toBeGreaterThanOrEqual(.6);
      expect(art!.displayScale, id).toBeLessThanOrEqual(2.3);
      return aspect * art!.displayScale!;
    });

    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1e-9);
  });
});

describe('WP2 — sprite source normalizes to model metres (A6/A11)', () => {
  const radiusM = 0.25;

  it('validates every shipped species with asset IDs and no guessed pivots', () => {
    for (const [id, art] of Object.entries(pixelArenaArt.species)) {
      const problems = validateArenaBodySource(art, `species.${id}`);
      expect(problems, id).toEqual([]);
      const body = normalizeArenaBody(art, { assetId: `species.${id}`, radiusM, bodySize: 'medium' });
      expect(body.fallback, id).toBe(false);
      expect(body.problems, id).toEqual([]);
      expect(body.referenceWidthM.value, id).toBeGreaterThan(0);
      expect(body.metresPerPixel, id).toBeGreaterThan(0);
      expect(Number.isFinite(body.drawBoundsM.left + body.drawBoundsM.top + body.drawBoundsM.right + body.drawBoundsM.bottom), id).toBe(true);
    }
  });

  it('keeps one visual-width owner: legacy displayScale is consumed once, never re-applied', () => {
    expect(VISUAL_WIDTH_RATIO).toEqual({ player: 1, small: 1, medium: 1.25, large: 1.5, boss: 1.8 });
    expect(visualWidthRatioForSize('medium')).toBe(1.25);
    expect(visualWidthRatioForSize('nope')).toBe(1);
    for (const [id, art] of Object.entries(pixelArenaArt.species)) {
      const body = normalizeArenaBody(art, { assetId: `species.${id}`, radiusM, bodySize: 'medium' });
      // referenceWidthM = 2 * radiusM * ratio * displayScale (legacy, once).
      const expected = 2 * radiusM * 1.25 * (legacyDisplayScale(art) || 1);
      expect(body.referenceWidthM.value, id).toBeCloseTo(expected, 12);
      expect(body.visualWidthRatio, id).toBeCloseTo(1.25 * (legacyDisplayScale(art) || 1), 12);
    }
  });

  it('adds one canvas-different profile through the existing adapter without new branches', () => {
    const goblinMeta = (pool.species as Record<string, { metadata: any }>).goblin.metadata;
    const wideAtlas = {
      ...goblinMeta,
      frameCanvas: { width: 512, height: 512 },
      anchor: { x: 128, y: 224 },
    };
    const base = pixelArenaArt.species.goblin!;
    const wide = pilotArt('/test-canvas-beast.png', wideAtlas, 224, false, base.displayScale ?? 1, 'test.canvas-beast');
    expect(validateArenaBodySource(wide, 'test.canvas-beast')).toEqual([]);
    const baseBody = normalizeArenaBody(base, { assetId: 'species.goblin', radiusM, bodySize: 'medium' });
    const wideBody = normalizeArenaBody(wide, { assetId: 'test.canvas-beast', radiusM, bodySize: 'medium' });
    // Same trimmed reference, same root in source pixels, so the same model size.
    expect(wideBody.referenceBoundsPx).toEqual(baseBody.referenceBoundsPx);
    expect(wideBody.rootPx.x).toBeCloseTo(baseBody.rootPx.x, 9);
    expect(wideBody.rootPx.y).toBeCloseTo(baseBody.rootPx.y, 9);
    expect(wideBody.metresPerPixel).toBeCloseTo(baseBody.metresPerPixel, 12);
    expect(wideBody.referenceWidthM.value).toBeCloseTo(baseBody.referenceWidthM.value, 12);
    expect(wideBody.drawBoundsM.left).toBeCloseTo(baseBody.drawBoundsM.left, 9);
    expect(wideBody.drawBoundsM.right).toBeCloseTo(baseBody.drawBoundsM.right, 9);
  });

  it('trims padding without moving the root or changing the model size', () => {
    const base = pixelArenaArt.species.goblin!;
    const ref = base.clips.idle.south!;
    const shifted: ArenaCharacterArt = {
      ...base,
      assetId: 'test.trim-shift',
      clips: {
        ...base.clips,
        idle: {
          ...base.clips.idle,
          south: {
            ...ref,
            sourceFrames: ref.sourceFrames!.map((frame, index) =>
              index === ref.startFrame! ? { ...frame, offsetX: frame.offsetX + 17, offsetY: frame.offsetY + 11 } : frame),
          },
        },
      },
    };
    const baseBody = normalizeArenaBody(base, { assetId: 'species.goblin', radiusM, bodySize: 'medium' });
    const shiftedBody = normalizeArenaBody(shifted, { assetId: 'test.trim-shift', radiusM, bodySize: 'medium' });
    expect(shiftedBody.metresPerPixel).toBeCloseTo(baseBody.metresPerPixel, 12);
    expect(shiftedBody.referenceWidthM.value).toBeCloseTo(baseBody.referenceWidthM.value, 12);
    expect(shiftedBody.rootPx.x).toBeCloseTo(baseBody.rootPx.x, 9);
    // The shifted reference frame's own root-relative edge moves by the trim delta converted once.
    const baseFrame = ref.sourceFrames![ref.startFrame!];
    const shiftedFrame = shifted.clips.idle.south!.sourceFrames![ref.startFrame!];
    const baseLeft = (baseFrame.offsetX - baseBody.rootPx.x) * baseBody.metresPerPixel;
    const shiftedLeft = (shiftedFrame.offsetX - shiftedBody.rootPx.x) * shiftedBody.metresPerPixel;
    expect(shiftedLeft - baseLeft).toBeCloseTo(17 * baseBody.metresPerPixel, 9);
  });

  it('reads the collision footprint from the sim, never from pixels', () => {
    const art = pixelArenaArt.species.goblin!;
    const narrow = normalizeArenaBody(art, { assetId: 'species.goblin', radiusM: 0.25, bodySize: 'medium' });
    const wide = normalizeArenaBody(art, { assetId: 'species.goblin', radiusM: 0.5, bodySize: 'medium' });
    expect(wide.referenceWidthM.value).toBeCloseTo(narrow.referenceWidthM.value * 2, 12);
    expect(wide.metresPerPixel).toBeCloseTo(narrow.metresPerPixel * 2, 12);
    expect(wide.referenceBoundsPx).toEqual(narrow.referenceBoundsPx);
    expect(wide.drawBoundsM.right - wide.drawBoundsM.left)
      .toBeCloseTo(2 * (narrow.drawBoundsM.right - narrow.drawBoundsM.left), 9);
  });

  it('mirrors the release socket without changing its reach', () => {
    const base = pixelArenaArt.species.goblin!;
    const east = base.clips.attack.east ?? base.clips.attack.west!;
    const root = rootPxForSheet(base, east);
    const k = 0.5 / Math.max(1, base.clips.idle.south!.sourceFrames![base.clips.idle.south!.startFrame!].width);
    const plain = resolveReleaseSocketM(east, root, k);
    const mirrored = resolveReleaseSocketM({ ...east, mirror: true }, root, k);
    const flipped = resolveReleaseSocketM({ ...east, mirror: false }, root, k);
    if (plain && east.releaseSocket) {
      expect(flipped!.x).toBeCloseTo(plain.x, 12);
      expect(mirrored!.x).toBeCloseTo(-plain.x, 12);
      expect(mirrored!.y).toBeCloseTo(plain.y, 12);
      expect(Math.hypot(mirrored!.x, mirrored!.y)).toBeCloseTo(Math.hypot(plain.x, plain.y), 12);
    }
    // Unknown provenance stays fallback: no socket, asset ID reported elsewhere.
    const bad = resolveReleaseSocketM(
      { ...east, releaseSocket: { ...east.releaseSocket!, provenance: 'guessed' as never } }, root, k);
    expect(bad).toBeUndefined();
    expect(resolveMountM(undefined, root, k, false)).toBeUndefined();
  });

  it('falls back with the asset ID when metadata is unknown, never a component multiplier', () => {
    const bad = { displayHeight: Number.NaN, anchor: { x: Number.NaN, y: 0 }, clips: {} } as unknown as ArenaCharacterArt;
    const problems = validateArenaBodySource(bad, 'test.unknown-asset');
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((problem) => problem.includes('test.unknown-asset'))).toBe(true);
    const body = normalizeArenaBody(bad, { assetId: 'test.unknown-asset', radiusM: 0.25, bodySize: 'medium' });
    expect(body.problems.some((problem) => problem.includes('test.unknown-asset'))).toBe(true);
    expect(Number.isFinite(body.metresPerPixel)).toBe(true);
    const icon = fallbackBodyVisual('test.unknown-asset', 0.25, 'medium', problems);
    expect(icon.fallback).toBe(true);
    expect(icon.releaseSocketsM).toEqual({});
  });
});
