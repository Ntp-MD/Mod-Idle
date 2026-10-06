import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { E } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import type { Item } from '../src/sim/types';

/**
 * The four Mod lines the mod-table change adds, checked where they land: on the character sheet.
 *
 * A line that rolls but is never read by `buildCharacter` is worse than no line at all — the drop
 * would look like an upgrade and do nothing — so each new id gets an assertion here, and every range
 * is read out of `mods.json` instead of being repeated below.
 */
const require = createRequire(import.meta.url);
const MODS = require('../../tools/data/mods.json');
const topOf = (id: string) => Number((MODS.mods.find((m: any) => m.id === id) || {}).max ?? 0);

const line = (id: string, value: number) => ({ id, value, slice: 1 } as any);
const piece = (slot: string, lines: any[]): Item => ({
  slot, base: 'plate', rarity: 'Rare', quality: 'high', tier: 'T1', q: 2, weight: 0, lines,
} as Item);

/** A sheet from nothing but the lines named, so each pair below differs by exactly one line. */
function sheetWith(...entries: [string, any[]][]) {
  const gear = emptyGear();
  const SLOTS: Record<string, number> = { chest: 1, belt: 4, gloves: 5, boots: 6 };
  for (const [slot, lines] of entries) gear[SLOTS[slot]] = piece(slot, lines);
  return buildCharacter(90, gear);
}

describe('the new pool and regen lines feed the sheet', () => {
  it('Life Regeneration % multiplies the Vit-derived regen line', () => {
    const pct = topOf('life_regen_pct');
    expect(pct).toBeGreaterThan(0);
    const bare = sheetWith();
    const withIt = sheetWith(['chest', [line('life_regen_pct', pct)]]);
    expect(withIt.hpRegen).toBeCloseTo(bare.hpRegen * (1 + pct / 100), 6);
  });

  it('Mana Regeneration % multiplies the Int-derived regen line', () => {
    const pct = topOf('mana_regen_pct');
    const bare = sheetWith();
    const withIt = sheetWith(['belt', [line('mana_regen_pct', pct)]]);
    expect(withIt.manaRegen).toBeCloseTo(bare.manaRegen * (1 + pct / 100), 6);
  });

  it('Max Energy Shield % scales the shield the way the other two pool % lines scale theirs', () => {
    const pct = topOf('max_energy_shield_pct');
    const flat = topOf('energy_shield_flat');
    // Energy Shield is a GEAR line, not a Core stat line, so a sheet built from nothing holds a zero
    // pool and the % line would be scaling nothing (0 ≈ 0). The flat line is the pool, so both sides
    // wear it — the same shape the two regen % rows above are read in.
    const pool = ['chest', [line('energy_shield_flat', flat)]] as [string, any[]];
    const bare = sheetWith(pool);
    const withIt = sheetWith(pool, ['belt', [line('max_energy_shield_pct', pct)]]);
    expect(bare.es).toBeGreaterThan(0);
    expect(withIt.es).toBeCloseTo(bare.es * (1 + pct / 100), 6);
  });

  it('All Resistance lifts the total and the one Cap still binds it against the per-Element line', () => {
    const all = topOf('all_resistance_pct');
    const each = topOf('elemental_resistance');
    const bare = sheetWith();
    const withIt = sheetWith(['gloves', [line('all_resistance_pct', all)]]);
    expect(withIt.resistance).toBeGreaterThan(bare.resistance);
    expect(withIt.resistance).toBeLessThanOrEqual(E.caps.elem_res);

    // both lines at their top on the same character — the Cap is what keeps All Resistance beside the
    // per-Element line rather than replacing it
    const both = sheetWith(['gloves', [line('all_resistance_pct', all)]], ['boots', [line('elemental_resistance', each)]]);
    expect(both.resistance).toBeLessThanOrEqual(E.caps.elem_res);
  });
});
