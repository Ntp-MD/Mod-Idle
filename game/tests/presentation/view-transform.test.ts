import { describe, expect, it } from 'vitest';
import {
  applyViewportToWorld,
  applyWorldVector,
  applyWorldToViewport,
  applyClientToWorld,
  applyWorldToClient,
  clientPointPx,
  composeAffine,
  fieldPointM,
  fieldVectorM,
  invertAffine,
  isUniformScale,
  lengthM,
  viewportPointPx,
  IDENTITY_AFFINE,
} from '../../src/presentation/view-transform';

describe('view-transform A1 unit boundary', () => {
  it('round-trips point, vector and length through a uniform matrix', () => {
    const m = { a: 140, b: 0, c: 0, d: 140, e: 960, f: 540 };
    const p = fieldPointM(12.5, 8.25);
    const v = applyWorldToViewport(m, p);
    expect(v).toEqual(viewportPointPx(12.5 * 140 + 960, 8.25 * 140 + 540));
    const inv = invertAffine(m)!;
    expect(applyViewportToWorld(inv, v)).toEqual(p);
    // Vector ignores translation and keeps length scaling.
    const vec = applyWorldVector(m, fieldVectorM(1, 0));
    expect(vec.x).toBeCloseTo(140, 12);
    expect(vec.y).toBe(0);
    expect(isUniformScale(m)).toBe(true);
  });

  it('inverts composed matrices and round-trips client coordinates', () => {
    const scale = { a: 70, b: 0, c: 0, d: 70, e: 100, f: 50 };
    const shift = { a: 1, b: 0, c: 0, d: 1, e: 10, f: -5 };
    const worldToClient = composeAffine(shift, scale);
    const clientToWorld = invertAffine(worldToClient)!;
    const p = fieldPointM(3, 4);
    const roundTrip = applyClientToWorld(clientToWorld, applyWorldToClient(worldToClient, p));
    expect(roundTrip.x).toBeCloseTo(p.x, 10);
    expect(roundTrip.y).toBeCloseTo(p.y, 10);
    expect(invertAffine({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 })).toBeNull();
    expect(invertAffine({ a: Number.NaN, b: 0, c: 0, d: 1, e: 0, f: 0 })).toBeNull();
    expect(applyWorldToViewport(IDENTITY_AFFINE, p).x).toBe(3);
    expect(lengthM(2).value).toBe(2);
    expect(clientPointPx(1, 2).y).toBe(2);
  });
});
