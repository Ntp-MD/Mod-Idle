import { describe, expect, it } from 'vitest';
import { E } from '../../src/engine/client';
import { basicPhaseBudget } from '@engine/attack-range.ts';
import {
  resolveAnimation, shippedAnimationManifest, validateAnimationManifest, type AnimationManifest,
} from '../../src/ui/combat/animation/manifest';

const speciesIds = (E.mob.species as { id: string }[]).map(({ id }) => id);

describe('P4 — animation identity and fallbacks', () => {
  it('resolves every canonical species and every player weapon group by name', () => {
    const manifest = shippedAnimationManifest(E.mob.species as { id: string }[]);
    expect(validateAnimationManifest(manifest, speciesIds)).toEqual([]);
    for (const id of speciesIds) {
      const resolved = resolveAnimation(manifest, `species.${id}`);
      expect(resolved.kind).toBe('sprite');
      if (resolved.kind === 'sprite') expect(resolved.fallback).toBe(`sprite-${id}`);
    }
    for (const group of ['melee', 'ranged', 'magic'] as const) {
      expect(resolveAnimation(manifest, `player.${group}`)).toMatchObject({ kind: 'sprite', fallback: `player-equipped-${group}` });
    }
  });

  it('rejects an imported rig without feet pivot, required clips or a sprite fallback', () => {
    const manifest: AnimationManifest = shippedAnimationManifest(E.mob.species as { id: string }[]);
    manifest.species[speciesIds[0]] = {
      rig: {
        model: 'Bad_Model', skeleton: 'skeleton',
        feetPivot: { x: 0, y: 1, z: 0 }, sockets: {},
        clips: {
          idle: { name: 'Idle', phase: 'idle', durationSec: 1 },
          walk: { name: 'Walk', phase: 'walk', durationSec: 1 },
          turn: { name: 'Turn', phase: 'turn', durationSec: .4 },
          windup: { name: 'Windup', phase: 'windup', durationSec: .01, minPhaseSec: .01 },
          release: { name: 'Release', phase: 'release', durationSec: .2 },
          recovery: { name: 'Recovery', phase: 'recovery', durationSec: .05, minPhaseSec: .01 },
          hit: { name: 'Hit', phase: 'hit', durationSec: .3 },
          death: { name: 'Death', phase: 'death', durationSec: 1 },
        },
      },
      sprite: '',
    };
    const problems = validateAnimationManifest(manifest, speciesIds);
    expect(problems.some((problem) => problem.includes('lowercase-hyphen'))).toBe(true);
    expect(problems.some((problem) => problem.includes('feet pivot'))).toBe(true);
    expect(problems.some((problem) => problem.includes('phase floor'))).toBe(true);
    expect(problems.some((problem) => problem.includes('sprite fallback'))).toBe(true);
  });

  it('keeps the F44 phase floor from shrinking at a high attack rate', () => {
    const profile = { delivery: 'melee', range: { basis: 'body-edge', meters: .2 }, stop_at_range_pct: 75, windup_interval_pct: 35, recovery_interval_pct: 20 } as const;
    const fast = basicPhaseBudget(profile, 100_000, 100_000);
    expect(fast.windupUs).toBeGreaterThanOrEqual(100_000);
    expect(fast.recoveryUs).toBeGreaterThanOrEqual(100_000);
    const normal = basicPhaseBudget(profile, 1_000_000, 100_000);
    expect(normal.windupUs).toBe(350_000);
    expect(normal.recoveryUs).toBe(200_000);
  });
});
