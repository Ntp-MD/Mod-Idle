import { describe, it, expect } from 'vitest';
import { E, MODS, SKILLS, eng, loot, sm } from '../src/engine/client';
import { openingGear } from '../src/sim/player';
import type { Item } from '../src/sim/types';

/**
 * The shapes the cages report as advisory (`soft`) but that must never silently break. Each block is one
 * shape, read through the client's own objects — the same data the game runs on — so a drift fails here
 * even though the cage would only print a PENDING line. The gate id names the cage check it mirrors.
 */

describe('the clock Cap is a rule, not a build target (X13)', () => {
  it('no weapon reaches the clock Cap at the single-stat ceiling', () => {
    const weapons = eng.WEAPONS as any[];
    expect(weapons.length).toBeGreaterThan(0);
    for (const w of weapons) {
      // `agi_to_cap` is the Agi a build would need for this weapon to clock at the Cap; the ceiling is
      // what a build can actually hold, so any weapon under it would make the Cap a target
      expect(w.agi_to_cap, `${w.name} reaches the Cap`).toBeGreaterThan(eng.CEIL);
      expect(w.reachable).toBe(false);
    }
  });
});

describe('the open-ended lines carry no Cap in the data (X12 · X43)', () => {
  it('crit, block and stun are all uncapped', () => {
    expect(E.caps.crit_chance).toBeNull();
    expect(E.caps.block).toBeNull();
    expect(E.caps.stun).toBeNull();
  });
});

describe('the Gear Mod ladder is bounded by the school it raises (X42)', () => {
  it('one Upgrade step inverts exactly the smallest school ceiling', () => {
    const gm = E.craft.gear_mod_per_level;
    const cap = E.craft.upgrade_cap;
    const binding = Math.min(E.mod_max.armour_flat_t1, E.mod_max.evasion_flat_t1, E.mod_max.energy_shield_flat_t1);
    expect(gm).toBeGreaterThan(0);
    expect(gm).toBe(Math.floor(binding / cap));
  });
});

describe('every Mod range covers its own Total (MP1)', () => {
  it('bands are contiguous thirds with an overlapping, winning seam', () => {
    const problems: string[] = [];
    for (const m of MODS.mods as any[]) {
      const flat: [number, number][] = m.bands.flat();
      if (!flat.length) { problems.push(`${m.id}: no slices`); continue; }
      if (flat[0][0] !== m.min) problems.push(`${m.id}: starts ${flat[0][0]}, Total says ${m.min}`);
      if (flat[flat.length - 1][1] !== m.max) problems.push(`${m.id}: ends ${flat[flat.length - 1][1]}, Total says ${m.max}`);
      const tiers = m.bands[0].length;
      expect(new Set(m.bands.map((b: any[]) => b.length)).size, `${m.id} tier counts differ`).toBe(1);
      for (let i = 1; i < flat.length; i++) {
        if (i % tiers === 0) {
          const q = i / tiers;
          const hi = m.bands[q][m.bands[q].length - 1][1];
          const size = Math.ceil((hi - flat[i][0] + 1) / 3);
          if (flat[i - 1][1] - flat[i][0] < 1) problems.push(`${m.id}: seam ${i} has no overlap`);
          if (hi - size + 1 <= flat[i - 1][1]) problems.push(`${m.id}: seam ${i} T1 does not win`);
        } else if (flat[i][0] !== flat[i - 1][1] + 1) {
          problems.push(`${m.id}: slice ${i} starts ${flat[i][0]} after ${flat[i - 1][1]}`);
        }
      }
      for (const b of m.bands) for (const [a, z] of b) if (a > z) problems.push(`${m.id}: inverted ${a}-${z}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('the opening set is a whole character and nothing more (OP7 · OP8)', () => {
  const ATK_LINES = new Set([
    'physical_power_flat', 'physical_power', 'magic_power_flat', 'magic_power',
    'elemental_power_flat', 'elemental_power', 'attack_speed', 'critical_chance', 'critical_damage',
    'accuracy', 'armour_pen', 'bleed_chance', 'stun_chance',
  ]);
  const pieces = () => openingGear().filter(Boolean) as Item[];

  it('fills every worn slot exactly once, one line a piece', () => {
    const slots = loot.SLOTS as string[];
    const set = pieces();
    expect(set.length).toBe(slots.length);
    for (const slot of new Set(slots)) {
      expect(set.filter((p) => p.slot === slot).length, slot).toBe(slots.filter((s) => s === slot).length);
    }
    for (const p of set) expect(p.lines.length, `${p.slot} ${p.base}`).toBe(1);
  });

  it('carries no attack line outside the main hand, so the priced clock cannot move', () => {
    const found = pieces()
      .filter((p) => p.slot !== 'main hand')
      .flatMap((p) => p.lines.map((l: any) => l.id))
      .filter((id) => ATK_LINES.has(id));
    expect(found).toEqual([]);
  });
});

describe('every declared skill effect is real and already printed (S11)', () => {
  it('names a known stat, op, subject and condition, and its value is in its own sentence', () => {
    const problems: string[] = [];
    for (const s of SKILLS.skills as any[]) {
      for (const e of s.effects || []) {
        if (!sm.EFFECT_STATS.includes(e.stat) || !sm.EFFECT_OPS.includes(e.op)) problems.push(`${s.id}: ${e.stat}/${e.op}`);
        if (!sm.EFFECT_SUBJECTS.includes(e.subject || 'self')) problems.push(`${s.id}: subject ${e.subject}`);
        if (e.condition && !sm.EFFECT_CONDITIONS.includes(e.condition)) problems.push(`${s.id}: condition ${e.condition}`);
        if (e.element && !E.elements.order.includes(e.element)) problems.push(`${s.id}: element ${e.element}`);
        const text = String(s.effect || '').replace(/−/g, '-');
        if (!text.includes(String(e.value))) problems.push(`${s.id}: value ${e.value} not in its sentence`);
      }
    }
    expect(problems).toEqual([]);
  });
});
