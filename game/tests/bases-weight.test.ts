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

});

describe('the weight tax from formula-utility.md section 11', () => {
  // the shape is the promise; the two constants are the data own (a rescale moves both together)
  const cap = (str: number) => E.level_gain.weight_base + str * E.K.K_STR_WEIGHT;

  it('capacity is weight_base + Str x K_STR_WEIGHT, and the printed sets sit under it', () => {
    expect(eng.weightCapacityOf(210)).toBeCloseTo(cap(210), 6);
    expect(eng.weightCapacityOf(510)).toBeCloseTo(cap(510), 6);
    expect(eng.encumbranceOf(cap(210) * 0.9, 210)).toBe(0);
    expect(eng.encumbranceOf(cap(210), 210)).toBe(0);
  });

  it('the tax bites only past capacity, and a set heavy enough to cross it hits the 50% ceiling', () => {
    const c210 = cap(210);
    expect(eng.encumbranceOf(c210 * 1.2, 210)).toBeCloseTo((c210 * 1.2 - c210) / c210, 5);
    expect(eng.encumbranceOf(c210 * 1.5, 210)).toBeCloseTo(E.caps.weight_overload, 6);
    expect(eng.encumbranceOf(c210 * 40, 210)).toBe(E.caps.weight_overload);
  });

  // the reason the two constants are a pair: a full set of the heaviest frames at the top band has to
  // be a real fraction of the ceiling capacity, or the tax is decoration nobody can ever feel
  it('the heaviest frames at the top band are a real fraction of the ceiling capacity', () => {
    const heaviestPerSlot = BASES.slots.reduce((t: number, slot: string) =>
      t + Math.max(...BASES.bases.filter((b: any) => b.slot === slot).map((b: any) => b.weight)), 0);
    const topBand = heaviestPerSlot * Math.pow(BASES.quality_weight_multiplier, 2);
    const ceiling = eng.DERIVED.weight;
    expect(topBand).toBeLessThanOrEqual(ceiling);
    expect(topBand / ceiling).toBeGreaterThan(0.4);
  });

  it('a printed set stays under the base line, so the tax does not fire on it', () => {
    const bare = buildCharacter(100, emptyGear());
    const heavy = emptyGear();
    for (let i = 0; i < heavy.length; i++) {
      const name = PATHS.armored[i % PATHS.armored.length];
      const frame = BASES.bases.find((b: any) => b.name === name)!;
      heavy[i] = { slot: frame.slot, base: frame.name, ilvl: 61, quality: 'high', tier: 'T3', lines: [], q: 2, weight: frame.weight * 1.3 };
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
      const item = rollDrop(rng, ['low', 'mid', 'high'][i % 3], 1);
      if (weaponNames.includes(item.base)) {
        // a weapon — main hand, or a dual-wielded off hand — forces its own line-1 Mods
        expect(item.lines.length).toBeGreaterThan(0);
        continue;
      }
      const frame = BASES.bases.find((b: any) => b.name === item.base);
      expect(frame?.slot).toBe(item.slot);
      // line 1 is the frame's OWN set (the flat defence lines its name declares, or an off-hand
      // family's row), while lines 2-7 draw the whole slot union — so both are allowed here
      const allowed = new Set([
        ...loot.poolFor(BASES, item.slot, frame, null).map((e: any) => e.id),
        ...(frame?.base_lines || []),
        ...(BASES.frame_mod?.off_hand?.[frame?.family] || []),
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
    const low = rollDrop(mulberry32(7), 'low', 1);
    const frame = BASES.bases.find((b: any) => b.name === low.base);
    if (frame) {
      expect(low.weight).toBeCloseTo(frame.weight * Math.pow(BASES.quality_weight_multiplier, low.q!), 6);
    }
  });
});
