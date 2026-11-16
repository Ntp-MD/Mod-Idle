import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { E } from '../../src/engine/client';
import { basicPhaseBudget } from '@engine/attack-range.ts';
import {
  resolveAnimation, shippedAnimationManifest, validateAnimationManifest, type AnimationManifest,
} from '../../src/ui/combat/animation/manifest';
import {
  SKILL_VFX_POOL,
  activeVfxArt,
  activeVfxVersionId,
  setActiveVfxVersion,
  vfxArtCandidates,
  vfxVersionsFor,
} from '../../src/ui/fx/catalog';
import { legacyAnimationScale } from '../../src/ui/combat/arena/arena-body-model';

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

  it('has every runtime arena JSON on disk with valid JSON', () => {
    const arenaDir = path.join(process.cwd(), 'src/ui/combat/arena');
    const jsons: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.json')) jsons.push(full);
      }
    };
    walk(arenaDir);
    expect(jsons.length).toBeGreaterThan(0);
    for (const file of jsons) {
      expect(fs.existsSync(file), file).toBe(true);
      const raw = fs.readFileSync(file, 'utf8');
      expect(() => JSON.parse(raw), file).not.toThrow();
      const data = JSON.parse(raw);
      expect(data, file).toBeDefined();
    }
  });
});

describe('WP2 — animation fallback lifecycle and VFX registration (A7/A11)', () => {
  it('reports unknown metadata as a named sprite fallback, never a guessed pivot', () => {
    const manifest = shippedAnimationManifest(E.mob.species as { id: string }[]);
    const resolved = resolveAnimation(manifest, 'species.not-a-species');
    expect(resolved.kind).toBe('sprite');
    if (resolved.kind === 'sprite') expect(resolved.fallback).toBe('unknown');
    // Production manifests stay metres with a unit scale; the scale is consumed once.
    expect(manifest.units).toBe('metres');
    expect(manifest.scale).toBe(1);
    expect(legacyAnimationScale(manifest, 'species.goblin')).toBe(1);
    expect(legacyAnimationScale({ units: 'pixels', scale: 2 }, 'test.bad-manifest')).toBe(1);
  });

  it('adds one VFX version through the existing registration without new renderer branches', () => {
    const skillId = 'attack.fireball';
    const before = vfxVersionsFor(skillId);
    expect(before.length).toBeGreaterThan(0);
    const testVersion = {
      id: 'test-wp2-version', label: 'WP2 boundary check', default: false, arena: true,
      decal: '/fx/test-wp2/decal.png', layers: [],
    };
    (SKILL_VFX_POOL[skillId] as unknown[]).push(testVersion);
    try {
      expect(vfxVersionsFor(skillId).some((version) => version.id === 'test-wp2-version')).toBe(true);
      const previous = activeVfxVersionId(skillId);
      expect(setActiveVfxVersion(skillId, 'test-wp2-version')).toBe(true);
      expect(activeVfxVersionId(skillId)).toBe('test-wp2-version');
      const candidates = vfxArtCandidates(skillId);
      expect(candidates[0].versionId).toBe('test-wp2-version');
      // The same art reader serves the new version: no skill-ID branch, same sources shape.
      expect(activeVfxArt(skillId)).toBeDefined();
      expect(candidates[0].sources.length).toBeGreaterThan(0);
      if (previous) setActiveVfxVersion(skillId, previous);
    } finally {
      const pool = SKILL_VFX_POOL[skillId] as unknown[];
      const index = pool.findIndex((version) => (version as { id: string }).id === 'test-wp2-version');
      if (index >= 0) pool.splice(index, 1);
    }
    expect(vfxVersionsFor(skillId).some((version) => version.id === 'test-wp2-version')).toBe(false);
  });
});
