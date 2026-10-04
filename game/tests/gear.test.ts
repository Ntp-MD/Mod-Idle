import { describe, it, expect } from 'vitest';
import { BASES } from '../src/engine/client';
import { newGame, tick, equippedCount } from '../src/sim/game';
import { equipFromBag, gearModOf, statChoiceOf } from '../src/sim/gear';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { craft as clientCraft } from '../src/sim/craft';
import { rollDrop } from '../src/sim/drop';
import { mulberry32 } from '../src/engine/client-helpers';
import type { Item } from '../src/sim/types';

/**
 * Wearing a piece, as one verb (`game/src/sim/gear.ts`).
 *
 * It used to live inside `App.svelte`, which meant no test could reach the rule and the loop could
 * not be dressed for the balance measurement (D-103). These three are what the panel's Equip button
 * is allowed to do — and the third is what it is never allowed to do on its own.
 */
const rolled = (seed: number, band = 'high'): Item => rollDrop(mulberry32(seed), band, 1.2) as Item;

describe('equipping from the bag', () => {
  it('wears a piece in its own slot and sends the displaced one back to the front of the bag', () => {
    const s = newGame(71);
    const held = equippedCount(s);
    const item = rolled(3);
    const worn = s.gear.find((g) => g && g.slot === item.slot) || null;
    s.bag.unshift(item);

    expect(equipFromBag(s, 0).ok).toBe(true);
    const at = s.gear.findIndex((g) => g && g.base === item.base);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(s.gear[at]!.slot).toBe(item.slot);
    expect(equippedCount(s)).toBe(held + (worn ? 0 : 1));
    // the piece it replaced is a decision waiting again, not a piece that vanished
    if (worn) expect(s.bag[0]!.base).toBe(worn.base);
    expect(s.bag.findIndex((b) => b.base === item.base)).toBe(-1);
  });

  it('feeds a Stat Mod the stat the player chose, and Str when nobody chose', () => {
    let withStatMod: Item | null = null;
    for (let seed = 1; seed <= 200 && !withStatMod; seed++) {
      const p = rolled(seed);
      if (p.lines.some((l) => l.id === 'stat_mod_flat' || l.id === 'stat_mod')) withStatMod = p;
    }
    if (!withStatMod) throw new Error('no rolled piece carried a Stat Mod line — the roll changed');
    const item = withStatMod;
    const s = newGame(72);
    s.bag.unshift(item);
    expect(statChoiceOf(item)).toBe('str'); // the default a piece nobody chose for lands on

    (item as any).chosenStat = 'int';
    expect(equipFromBag(s, 0).ok).toBe(true);
    const wornLine = s.gear.filter(Boolean)
      .flatMap((g) => g!.lines).find((l) => l.id === 'stat_mod_flat' || l.id === 'stat_mod');
    expect(wornLine!.stat).toBe('int');
  });

  it('never happens by itself while the character is hunting', () => {
    const s = newGame(73);
    const atStart = equippedCount(s);
    for (let i = 0; i < 1800; i++) tick(s, {}, { online: true });
    // a bag full of kept pieces is the design working (loot.md §4 · D-089), not a bug to fix here
    expect(equippedCount(s)).toBe(atStart);
  });

  it('pays a full Upgrade ladder onto the school its Base carries, and nowhere else', () => {
    const light = BASES.bases.find((b: any) => b.school === 'evasion_flat') as any;
    const heavy = BASES.bases.find((b: any) => b.school === 'armour_flat') as any;
    if (!light || !heavy) throw new Error('bases.json lost a Gear Mod school');
    const piece = (frame: any): Item => ({
      slot: frame.slot, base: frame.name, rarity: 'Common', quality: 'high', tier: 'T1', q: 3,
      level: 100, lines: [],
    } as Item);

    const bare = buildCharacter(100, [piece(light), piece(heavy), ...emptyGear().slice(2)]);
    const maxed = [piece(light), piece(heavy)];
    for (const p of maxed) p.gearMod = clientCraft.stepOf(p, clientCraft.C.upgrade_cap);
    const uplifted = buildCharacter(100, [...maxed, ...emptyGear().slice(2)]);

    // one ladder reaches the whole ceiling of the smaller school (X42), so +15 Evasion is that line
    expect(uplifted.evasion - bare.evasion).toBe(clientCraft.C.gear_mod_per_level * clientCraft.C.upgrade_cap);
    // and the heavy piece's uplift is Armour, which the sheet folds after its Str term
    expect(uplifted.armour - bare.armour).toBe(clientCraft.C.gear_mod_per_level * clientCraft.C.upgrade_cap);
    // a Base with no school has nothing to raise
    expect(gearModOf(piece({ slot: 'ring', name: 'band' })).value).toBe(0);
  });
});
