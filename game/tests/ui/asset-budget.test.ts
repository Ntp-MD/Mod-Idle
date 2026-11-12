import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Phase-2 asset budgets (pilot = phase-0 fresh build baseline).
 * Budgets are per-family + total production bytes, measured before any batch optimize.
 * JS URL metadata is measured separately from emitted art bytes.
 * A manifest listing every image is not tree shaking; atlas is only pursued if
 * the simpler approach cannot meet these budgets.
 */
const MIB = 1_048_576;

function bytesOf(dir: string): number {
  let total = 0;
  if (!fs.existsSync(dir)) return total;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) total += fs.statSync(full).size;
    }
  };
  walk(dir);
  return total;
}

describe('production art budgets', () => {
  it('keeps per-family source art within budget', () => {
    // Pilot baselines (MiB): src/icon 136.90, fx 163.34, combat 51.80, map 23.49.
    // 2026-11-10: budget raised for the full-roster vfx-component rebuild (90 player skills
    // from library masters, ~4 layers each); user approved ignoring size for the art pass.
    const iconBytes = bytesOf(path.join(process.cwd(), 'src/icon'));
    const fxBytes = bytesOf(path.join(process.cwd(), 'public/fx'));
    const combatBytes = bytesOf(path.join(process.cwd(), 'public/combat'));
    const mapBytes = bytesOf(path.join(process.cwd(), 'public/map'));
    expect(iconBytes / MIB, `src/icon ${iconBytes}`).toBeLessThan(150);
    expect(fxBytes / MIB, `public/fx ${fxBytes}`).toBeLessThan(300);
    expect(combatBytes / MIB, `public/combat ${combatBytes}`).toBeLessThan(60);
    expect(mapBytes / MIB, `public/map ${mapBytes}`).toBeLessThan(30);
  });

  it('keeps emitted dist art within total budget', () => {
    const dist = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(dist)) return; // budget applies to fresh build; no build yet in CI unit run
    const total = bytesOf(dist);
    expect(total / MIB, `dist ${total}`).toBeLessThan(620);
  });
});
