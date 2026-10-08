import { describe, it, expect } from 'vitest';
import { BASES, STAT_KEYS, loot } from '../src/engine/client';
import { newGame, tick, equippedCount } from '../src/sim/game';
import { equipFromBag, gearModOf, autoEquip } from '../src/sim/gear';
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
    // than after a guessed window (a time premise · AGENTS.md)
    for (let i = 0; i < 40000 && s.bag.length === 0; i++) tick(s, {}, { online: true });
    // a bag full of kept pieces is the design working (loot.md §4), not a bug to fix here
    expect(s.bag.length).toBeGreaterThan(0);
    expect(equippedCount(s)).toBe(atStart);
  });

  it('fills the second ring slot instead of replacing the first one', () => {
    // the body carries two rings, so a press that always took the first cell naming the slot could never
    // wear a second one — and the last ring pressed won, whatever it was worth
    const s = newGame(77);
    const ring = (v: number): Item =>
      ({ slot: 'ring', base: 'Band', ilvl: 20, quality: 'mid', tier: 'T1', q: 1, lines: [{ id: 'all_stat_flat', value: v, slice: 1 }] } as Item);
    s.bag = [];
    s.gear[6] = null;
    s.gear[7] = null;
    s.bag = [ring(5), ring(10)];
    expect(equipFromBag(s, 1).ok).toBe(true);
    expect(equipFromBag(s, 0).ok).toBe(true);
    expect(s.gear.filter((g) => g && g.slot === 'ring').length).toBe(2);
  });

  it('takes the weaker of a pair when a piece has to displace one', () => {
    const s = newGame(78);
    const ring = (v: number): Item =>
      ({ slot: 'ring', base: 'Band', ilvl: 20, quality: 'mid', tier: 'T1', q: 1, lines: [{ id: 'all_stat_flat', value: v, slice: 1 }] } as Item);
    s.bag = [];
    s.gear[6] = ring(10);
    s.gear[7] = ring(3);
    s.bag = [ring(5)];
    expect(equipFromBag(s, 0).ok).toBe(true);
    expect(s.gear[6]!.lines[0].value).toBe(10); // the strong ring stayed where it was
    expect(s.gear[7]!.lines[0].value).toBe(5);
  });
});

describe('putting on the best gear the character carries', () => {
  const piece = (slot: string, v: number, extra: Partial<Item> = {}): Item =>
    ({ slot, base: 'Band', ilvl: 20, quality: 'mid', tier: 'T1', q: 1, lines: [{ id: 'all_stat_flat', value: v, slice: 1 }], ...extra } as Item);
  const score = (item: Item) => loot.score({ ...item, q: item.q ?? 0 });

  it('wears what is stronger and leaves the rest in the pile', () => {
    const s = newGame(80);
    s.bag = [];
    s.gear[0] = null; // a bare cell is always worth filling, so the swap needs no guess about the start set
    s.bag = [piece('helmet', 40), piece('helmet', 1)];
    const r = autoEquip(s, 0);
    expect(r.swaps.length).toBe(1);
    expect(s.gear[0]!.lines[0].value).toBe(40);
    expect(s.bag.length).toBe(1);
  });

  it('will not move a piece the player pinned, promised to a set, or left Broken', () => {
    const s = newGame(81);
    s.bag = [];
    s.gear[0] = null;
    s.bag = [piece('helmet', 999, { locked: true }), piece('helmet', 998, { heldFor: 'a-set' }), piece('helmet', 997, { broken: true })];
    const r = autoEquip(s, 0);
    expect(r.spared).toEqual({ locked: 1, set: 1, broken: 1 });
    expect(r.swaps.length).toBe(0);
    expect(s.bag.length).toBe(3);
    expect(s.gear[0]).toBe(null);
  });

  it('honours the margin it was given instead of churning over a rounding error', () => {
    const worn = piece('helmet', 100);
    const tiny = piece('helmet', 101);
    const big = piece('helmet', 400);
    const gain = ((score(tiny) - score(worn)) / score(worn)) * 100;
    expect(gain).toBeGreaterThan(0); // the fixture really is an improvement, or the reading proves nothing
    const s = newGame(82);
    s.bag = [];
    s.gear[0] = worn;
    s.bag = [tiny];
    expect(autoEquip(s, gain + 1).swaps.length).toBe(0);
    expect(s.gear[0]).toBe(worn);
    s.bag = [big];
    expect(autoEquip(s, gain + 1).swaps.length).toBe(1);
  });

  it('settles the second press with nothing left to change', () => {
    const s = newGame(83);
    s.bag = [];
    s.gear[0] = null;
    s.gear[6] = null;
    s.bag = [piece('helmet', 30), piece('ring', 50)];
    expect(autoEquip(s, 0).swaps.length).toBe(2);
    const wornNow = s.gear.map((g) => (g ? g.lines[0].value : 0)).join('|');
    expect(autoEquip(s, 0).swaps.length).toBe(0); // no ping-pong once the press has already won
    expect(s.gear.map((g) => (g ? g.lines[0].value : 0)).join('|')).toBe(wornNow);
  });

  it('counts what the warehouse holds better, without raiding it', () => {
    const s = newGame(84);
    s.bag = [];
    s.gear[0] = null;
    s.stash = [[piece('helmet', 900)], [], [], [], [], []];
    const r = autoEquip(s, 0);
    expect(r.inStash).toBe(1);
    expect(s.stash[0].length).toBe(1); // reported, not moved: a stored piece comes out by the player's hand
    expect(s.gear[0]).toBe(null);
  });
});

describe('the school a Base carries', () => {
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
