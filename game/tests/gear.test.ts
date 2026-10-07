import { describe, it, expect } from 'vitest';
import { BASES, STAT_KEYS } from '../src/engine/client';
import { newGame, tick, equippedCount } from '../src/sim/game';
import { equipFromBag, gearModOf } from '../src/sim/gear';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { craft as clientCraft } from '../src/sim/craft';
import { rollDrop } from '../src/sim/drop';
import { mulberry32 } from '../src/engine/client-helpers';
import type { Item } from '../src/sim/types';

/**
 * Wearing a piece, as one verb (`game/src/sim/gear.ts`).
 *
 * It used to live inside `App.svelte`, which meant no test could reach the rule and the loop could
 * not be dressed for the balance measurement. These three are what the panel's Equip button
 * is allowed to do — and the third is what it is never allowed to do on its own.
 */
const rolled = (seed: number, band = 'high'): Item => rollDrop(mulberry32(seed), band, 61) as Item;

describe('equipping from the bag', () => {
  it('wears a piece in its own slot and sends the displaced one back to the front of the bag', () => {
    const s = newGame(71);
    const held = equippedCount(s);
    const item = { ...rolled(3), ilvl: 99 }; // a level no start-set piece has, so the bag search is exact
    const worn = s.gear.find((g) => g && g.slot === item.slot) || null;
    s.bag.unshift(item);

    expect(equipFromBag(s, 0).ok).toBe(true);
    const at = s.gear.findIndex((g) => g && g.base === item.base);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(s.gear[at]!.slot).toBe(item.slot);
    expect(equippedCount(s)).toBe(held + (worn ? 0 : 1));
    // the piece it replaced is a decision waiting again, not a piece that vanished
    if (worn) expect(s.bag[0]!.base).toBe(worn.base);
    expect(s.bag.some((b) => b && b.ilvl === 99)).toBe(false);
  });

  it('carries the Core stat its Stat Mod rolled at drop, and wearing never changes it', () => {
    let withStatMod: Item | null = null;
    for (let seed = 1; seed <= 200 && !withStatMod; seed++) {
      const p = rolled(seed);
      if (p.lines.some((l) => l.id === 'stat_mod_flat')) withStatMod = p;
    }
    if (!withStatMod) throw new Error('no rolled piece carried a Stat Mod line — the roll changed');
    const item = withStatMod;
    const line = item.lines.find((l) => l.id === 'stat_mod_flat')!;
    expect(STAT_KEYS).toContain(line.stat); // the stat is baked at drop, one of the seven 
    const s = newGame(72);
    s.bag.unshift(item);
    expect(equipFromBag(s, 0).ok).toBe(true);
    const wornLine = s.gear.filter(Boolean)
      .flatMap((g) => g!.lines).find((l) => l.id === 'stat_mod_flat')!;
    expect(wornLine.stat).toBe(line.stat); // wearing is not a decision about the stat anymore
  });

  it('lifts every Core stat by its one value when the Stat Mod is the all-stats line', () => {
    const chest = BASES.bases.find((b: any) => b.slot === 'chest') as any;
    const item: Item = {
      slot: 'chest', base: chest.name, ilvl: 1, quality: 'mid', tier: 'T2', q: 1,
      lines: [{ id: 'all_stat_flat', value: 12, slice: 1 }],
    } as Item;
    const bare = buildCharacter(50, emptyGear());
    const worn = emptyGear();
    worn[1] = item; // chest is slot 1 in loot.SLOTS order
    const withIt = buildCharacter(50, worn);
    for (const k of STAT_KEYS) expect(withIt.core[k] - bare.core[k]).toBe(12);
  });

  it('never rolls two Stat Mod lines onto one piece — the slot holds the family to one ', () => {
    const family = new Set(['stat_mod_flat', 'all_stat_flat']);
    let sawAllStats = false;
    for (let seed = 1; seed <= 800; seed++) {
      const p = rolled(seed);
      const ids = new Set(p.lines.flatMap((l) => [l.id, ...((l.extra || []).map((x) => x.id))]));
      expect([...ids].filter((id) => family.has(id)).length).toBeLessThanOrEqual(1);
      if (ids.has('all_stat_flat')) sawAllStats = true;
    }
    expect(sawAllStats).toBe(true); // the new line really reaches a drop, not just the table
  });

  it('never happens by itself while the character is hunting', () => {
    const s = newGame(73);
    const atStart = equippedCount(s);
    // hunt until the loop has actually banked a piece, so the reading is taken on a live bag rather
    // than after a guessed window (a time premise · AGENT.md)
    for (let i = 0; i < 40000 && s.bag.length === 0; i++) tick(s, {}, { online: true });
    // a bag full of kept pieces is the design working (loot.md §4), not a bug to fix here
    expect(s.bag.length).toBeGreaterThan(0);
    expect(equippedCount(s)).toBe(atStart);
  });

  it('pays a full Upgrade ladder onto the school its Base carries, and nowhere else', () => {
    const light = BASES.bases.find((b: any) => b.school === 'evasion_flat') as any;
    const heavy = BASES.bases.find((b: any) => b.school === 'armour_flat') as any;
    if (!light || !heavy) throw new Error('bases.json lost a Gear Mod school');
    const piece = (frame: any): Item => ({
      slot: frame.slot, base: frame.name, ilvl: 1, quality: 'high', tier: 'T1', q: 3,
      level: 100, lines: [],
    } as Item);

    const bare = buildCharacter(100, [piece(light), piece(heavy), ...emptyGear().slice(2)]);
    const maxed = [piece(light), piece(heavy)];
    for (const p of maxed) p.gearMod = clientCraft.stepOf(p, clientCraft.C.upgrade_cap);
    const uplifted = buildCharacter(100, [...maxed, ...emptyGear().slice(2)]);

    // one ladder reaches the whole ceiling of the smaller school (X42), so +15 Evasion is that line
    expect(uplifted.evasion - bare.evasion).toBeCloseTo(clientCraft.C.gear_mod_per_level * clientCraft.C.upgrade_cap, 9);
    // and the heavy piece's uplift is Armour, which the sheet folds after its Str term
    expect(uplifted.armour - bare.armour).toBeCloseTo(clientCraft.C.gear_mod_per_level * clientCraft.C.upgrade_cap, 9);
    // a Base with no school has nothing to raise
    expect(gearModOf(piece({ slot: 'ring', name: 'band' })).value).toBe(0);
  });
});
