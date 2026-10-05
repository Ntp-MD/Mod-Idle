import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { eng, E, BASES, loot } from '../src/engine/client';
import { rollDrop } from '../src/sim/drop';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { mulberry32 } from '../src/engine/client-helpers';

const require = createRequire(import.meta.url);
const basesCage = require('../../tools/bases.ts');

const PATHS: Record<string, string[]> = {
  cloth: ['Circlet', 'Vestment', 'Legwraps', 'Silk Slippers', 'Silk Sash', 'Silk Wraps', 'Iron Band', 'Iron Band', 'Jade Amulet', 'Silver Hoop', "Traveler's Cloak"],
  armored: ['Sallet', 'Plate Vest', 'Cuisses', 'Plated Greaves', 'War Belt', 'Iron Gauntlets', 'Moonstone Signet', 'Moonstone Signet', 'Onyx Talisman', 'Onyx Drop', 'Heavy Mantle'],
};

const weightOf = (names: string[]) => names.reduce((t, n) => t + (BASES.bases.find((b: any) => b.name === n)?.weight || 0), 0);

describe('bases.json is the mirror the cage gates', () => {
  it('carries every frame with a weight and a Primary pool', () => {
    expect(BASES.bases.length).toBeGreaterThan(20);
    for (const b of BASES.bases) {
      expect(b.weight).toBeGreaterThan(0);
      expect(b.primary.length).toBeGreaterThan(0);
    }
  });

  it('agrees with the cage side, including what is still PENDING', () => {
    const rows = basesCage.checks();
    const failed = rows.filter((r: any) => r.status === 'fail');
    expect(failed).toEqual([]);
    const mirror = rows.find((r: any) => r.id === 'BS1');
    expect(mirror.status).toBe('pass');
    // the client and the cage must disagree about nothing, including the doc's own set totals
    expect(BASES.bases.length).toBe(Number(String(mirror.detail).match(/(\d+) Base rows/)?.[1]));
  });

  it('reproduces two of the three published path weights exactly', () => {
    expect(weightOf(PATHS.cloth)).toBe(205);
    expect(weightOf(PATHS.armored)).toBe(442);
  });
});

describe('the weight tax from formula-utility.md section 11', () => {
  it('capacity is weight_base + Str x 2, and the printed sets sit under it', () => {
    expect(eng.weightCapacityOf(210)).toBe(1420);
    expect(eng.weightCapacityOf(510)).toBe(2020);
    expect(eng.encumbranceOf(193, 210)).toBe(0);
    expect(eng.encumbranceOf(420, 210)).toBe(0);
  });

  it('the tax bites only past capacity, and a set heavy enough to cross it hits the 50% ceiling', () => {
    expect(eng.encumbranceOf(1700, 210)).toBeCloseTo((1700 - 1420) / 1420, 5);
    expect(eng.encumbranceOf(2130, 210)).toBe(E.caps.weight_overload);
    expect(eng.encumbranceOf(9999, 210)).toBe(E.caps.weight_overload);
  });

  it('a printed set stays under the base line, so the tax does not fire on it', () => {
    const bare = buildCharacter(100, emptyGear());
    const heavy = emptyGear();
    for (let i = 0; i < heavy.length; i++) {
      const name = PATHS.armored[i % PATHS.armored.length];
      const frame = BASES.bases.find((b: any) => b.name === name)!;
      heavy[i] = { slot: frame.slot, base: frame.name, rarity: 'Rare', quality: 'high', tier: 'T3', lines: [], q: 2, weight: frame.weight * 1.3 };
    }
    const c = buildCharacter(100, heavy);
    expect(c.weightUsed).toBeLessThanOrEqual(c.weightCap);
    expect(c.encumbrance).toBe(0);
    expect(c.hitsPerSec).toBeCloseTo(bare.hitsPerSec, 6);
  });
});

describe('drops are built from the Base table', () => {
  it('every piece names a real frame for its slot and carries only lines that frame may roll', () => {
    const rng = mulberry32(20260104);
    const weaponNames = BASES.weapons.map((w: any) => w.name);
    for (let i = 0; i < 400; i++) {
      const item = rollDrop(rng, ['low', 'mid', 'high'][i % 3], 1.2);
      if (weaponNames.includes(item.base)) {
        // a weapon — main hand, or a dual-wielded off hand — forces its own line-1 Mods
        expect(item.lines.length).toBeGreaterThan(0);
        continue;
      }
      const frame = BASES.bases.find((b: any) => b.name === item.base);
      expect(frame?.slot).toBe(item.slot);
      // line 1 draws off the frame, but lines 2-7 draw the whole slot union (item-base.md · D-123);
      // an off-hand frame's Base Mod pair is its own line-1 pool, so it is allowed too
      const allowed = new Set([
        ...loot.poolFor(BASES, item.slot, frame, null).map((e: any) => e.id),
        ...(BASES.base_mod?.off_hand?.[frame?.family] || []),
      ]);
      for (const line of item.lines) {
        for (const id of [line.id, ...((line.extra || []).map((x: any) => x.id))]) {
          expect(allowed.has(id) || id === 'stat_mod').toBe(true);
        }
      }
      expect(item.weight).toBeGreaterThan(0);
    }
  });

  it('quality weighs more, at the multiplier bases.json carries', () => {
    const low = rollDrop(mulberry32(7), 'low', 1.2);
    const frame = BASES.bases.find((b: any) => b.name === low.base);
    if (frame) {
      expect(low.weight).toBeCloseTo(frame.weight * Math.pow(BASES.quality_weight_multiplier, low.q!), 6);
    }
  });
});
