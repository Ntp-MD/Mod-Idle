import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { facingSample } from '../../src/ui/dev/sprite-directions';
import manifest from '../../../art-reference/players/one-handed-sword/direction-proof/manifest.json';

describe('16 versus 32 sprite-facing comparison', () => {
  it('uses identical source views at shared bearings and every second row for sixteen', () => {
    for (let i = 0; i < 16; i++) {
      const degrees = i * 22.5;
      expect(facingSample(degrees, 16).sourceRow).toBe(facingSample(degrees, 32).sourceRow);
      expect(facingSample(degrees, 16).sourceRow).toBe(i * 2);
    }
    expect(facingSample(8, 16)).toMatchObject({ angle: 0, sourceRow: 0 });
    expect(facingSample(8, 32)).toMatchObject({ angle: 11.25, sourceRow: 1 });
  });
  it('wraps the circle without an invalid atlas row and respects the maximum facing error', () => {
    for (const count of [16, 32] as const) for (let angle = -720; angle <= 720; angle += .7) {
      const result = facingSample(angle, count);
      expect(result.sourceRow).toBeGreaterThanOrEqual(0);
      expect(result.sourceRow).toBeLessThan(32);
      expect(Math.abs(result.error)).toBeLessThanOrEqual(180 / count + 1e-8);
    }
  });
  it('resolves all 32 unchanged source images strictly inside the original player set', () => {
    const base = fileURLToPath(new URL('../../../art-reference/players/one-handed-sword/', import.meta.url));
    expect(manifest.sourceRoot).toBe('art-reference/players/one-handed-sword');
    expect(manifest.frames).toHaveLength(32);
    expect(manifest.frames.filter(frame => frame.kind === 'existing-player-source')).toHaveLength(8);
    expect(manifest.frames.filter(frame => frame.kind === 'generated-candidate')).toHaveLength(24);
    for (const [index, frame] of manifest.frames.entries()) {
      const path = resolve(base, frame.path), local = relative(base, path);
      expect(isAbsolute(local) || local.startsWith('..')).toBe(false);
      expect(frame.index).toBe(index);
      expect(frame.requestedAngle).toBe(index * 11.25);
      expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(frame.sha256);
    }
  });
});
