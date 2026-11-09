import { describe, expect, it } from 'vitest';
import { groundDecalMatrixForFrame } from '../../src/ui/combat/arena-skill-art';
import { activeVfxArt, activeVfxVersion, SKILL_VFX_POOL } from '../../src/ui/fx/catalog';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { applyWorldToViewport, fieldPointM } from '../../src/presentation/view-transform';

const frameFor = (worldScale = 1) => {
  const frame = createFieldViewFrame({
    sceneKey: 'decal', atUs: 0,
    viewportCss: { width: 1920, height: 1080 },
    focusM: fieldPointM(0, 0), worldScale,
  });
  if (!frame.renderable) throw new Error('frame must render');
  return frame;
};

describe('skill art registry', () => {
  it('carries ground projection and padding from a version into its atlas', () => {
    const id = 'test.ground-shader-port';
    SKILL_VFX_POOL[id] = [{ id: 'prototype', label: 'Prototype', default: true,
      projection: 'ground', content: { widthRatio: .8, heightRatio: .8 },
      layers: [{ role: 'ground', src: '/test.png', frame: { width: 128, height: 128, count: 2, columns: 2 } }] }];
    try {
      const atlas = activeVfxArt(id)?.atlas;
      expect(atlas?.projection).toBe('ground');
      expect(atlas?.content).toEqual({ widthRatio: .8, heightRatio: .8 });
    } finally { delete SKILL_VFX_POOL[id]; }
  });
  it('opens the promoted pool atlas with its authored projection', () => {
    const promoted = SKILL_VFX_POOL['attack.aftershock'].find(version => version.default)!;
    expect(activeVfxVersion('attack.aftershock')?.id).toBe(promoted.id);
    const art = activeVfxArt('attack.aftershock');
    expect(art?.atlas?.src).toBe(promoted.layers[0]?.src);
    expect(art?.atlas?.projection).toBe(promoted.projection);
    expect(SKILL_VFX_POOL['attack.aftershock'][0]?.default).toBe(true);
  });

  it('plays the version.json default for every skill, not just aftershock', () => {
    const art = activeVfxArt('buff.magia_drive');
    const promoted = SKILL_VFX_POOL['buff.magia_drive'].find(version => version.default)!;
    expect(art?.atlas?.src).toBe(promoted.layers[0].src);
    expect(SKILL_VFX_POOL['buff.magia_drive'][0]?.default).toBe(true);
  });
});

/** Singular values and major-axis angle of the matrix's 2 × 2 linear part. */
function ellipse(m: { a: number; b: number; c: number; d: number }) {
  // L = [[a, c], [b, d]] maps texture (u, v) to screen; L·Lᵀ gives the screen-space ellipse.
  const s11 = m.a * m.a + m.c * m.c;
  const s12 = m.a * m.b + m.c * m.d;
  const s22 = m.b * m.b + m.d * m.d;
  const tr = s11 + s22;
  const det = s11 * s22 - s12 * s12;
  const major = tr / 2 + Math.sqrt(tr * tr / 4 - det);
  const minor = tr / 2 - Math.sqrt(tr * tr / 4 - det);
  const angle = 0.5 * Math.atan2(2 * s12, s11 - s22) * 180 / Math.PI;
  return { ratio: Math.sqrt(minor / major), angle };
}

describe('skill art ground projection', () => {
  it('maps a padded ground atlas circle to the same world footprint in every direction', () => {
    const radiusM = 3, padding = .8, canvas = 2048, center = { x: 4, y: 3 };
    for (const scale of [.25, .5, .75, 1, 1.5, 2]) {
      const frame = frameFor(scale);
      const centerPx = applyWorldToViewport(frame.worldToViewport, fieldPointM(center.x, center.y));
      const m = groundDecalMatrixForFrame(centerPx, radiusM, frame, canvas, padding)!;
      for (let i = 0; i < 32; i++) {
        const angle = i / 32 * Math.PI * 2;
        const u = canvas / 2 + Math.cos(angle) * canvas / 2 * padding;
        const v = canvas / 2 + Math.sin(angle) * canvas / 2 * padding;
        const expected = applyWorldToViewport(frame.worldToViewport,
          fieldPointM(center.x + Math.cos(angle) * radiusM, center.y + Math.sin(angle) * radiusM));
        expect(m.a * u + m.c * v + m.e).toBeCloseTo(expected.x, 6);
        expect(m.b * u + m.d * v + m.f).toBeCloseTo(expected.y, 6);
      }
    }
  });
  it('keeps the authored ground circle circular on the north-up field', () => {
    // circle radius 3 m (attack.aftershock), 2048 texture
    const m = groundDecalMatrixForFrame({ x: 0, y: 0 }, 3, frameFor(1), 2048)!;
    const { ratio, angle } = ellipse(m);
    expect(ratio).toBeCloseTo(1, 8);
    expect(angle).toBeCloseTo(0, 8);
  });

  it('keeps the texture centred and axis-aligned without skew or foreshortening', () => {
    const m = groundDecalMatrixForFrame({ x: 900, y: 400 }, 3, frameFor(1), 2048)!;
    const centre = { x: m.a * 1024 + m.c * 1024 + m.e, y: m.b * 1024 + m.d * 1024 + m.f };
    expect(centre.x).toBeCloseTo(900, 6);
    expect(centre.y).toBeCloseTo(400, 6);
    expect(m.b).toBeCloseTo(0, 8);
    expect(m.c).toBeCloseTo(0, 8);
    expect(m.a).toBeCloseTo(m.d, 8);
  });
});
