import { describe, it, expect } from 'vitest';
import { E, eng, loot, BASES } from '../src/engine/client';
import { rollDrop } from '../src/sim/drop';
import { craft } from '../src/sim/craft';
import { buildCharacter, emptyGear, sumLines } from '../src/sim/player';
import { mobSwing } from '../src/sim/combat';
import { mulberry32 } from '../src/engine/client-helpers';
import type { Item } from '../src/sim/types';

/**
 * The 7-line skeleton (`item-base.md`): line 1 is the Base Mod, lines 2-3 the unremovable
 * Legacy pair, lines 4-7 the Random lines a Rarity fills at drop. These tests pin the shape, the
 * one-line/1-3-Mod rule with its value scale, the armour hybrid chance, and the two new avoidance
 * readings the skeleton added — block and armour penetration.
 */

const armourFrame = (defence: string) =>
  BASES.bases.find((b: any) => b.slot === 'helmet' && b.defence === defence);
const weaponNamed = (name: string) => BASES.weapons.find((w: any) => w.name === name);

describe('the 7-line skeleton', () => {
  it('fills a fixed count per Rarity and never exceeds the pool', () => {
    const rng = mulberry32(101);
    for (let i = 0; i < 600; i++) {
      const item = rollDrop(rng, ['low', 'mid', 'high'][i % 3], 1.2);
      const target = loot.linesAtDrop(item.rarity);
      expect(item.lines.length).toBeLessThanOrEqual(target);
      if (item.slot === 'main hand') expect(item.lines.length).toBe(target); // a weapon pool always fills
    }
  });

  it('Common fills 5 and Rare fills 7', () => {
    expect(loot.linesAtDrop('Common')).toBe(5);
    expect(loot.linesAtDrop('Rare')).toBe(7);
    expect(E.rarity.base_mod_slots + E.rarity.legacy_slots + E.rarity.Common.dropped_random).toBe(5);
    expect(E.rarity.base_mod_slots + E.rarity.legacy_slots + E.rarity.Rare.dropped_random).toBe(7);
  });

  it('line 1 is the Base Mod, lines 2-3 the Legacy pair, and the craft verbs refuse all three', () => {
    const item = rollDrop(mulberry32(202), 'high', 1.2);
    expect(craft.BASE_MOD_SLOTS).toBe(1);
    expect(craft.LEGACY_SLOTS).toBe(2);
    expect(craft.UNTOUCHABLE).toBe(3);
    for (let i = 0; i < craft.UNTOUCHABLE; i++) {
      expect(craft.reroll(item, i, mulberry32(1)).ok).toBe(false);
      expect(craft.refine(item, i, mulberry32(1)).ok).toBe(false);
      expect(craft.randomize(item, i, mulberry32(1)).ok).toBe(false);
    }
    expect(craft.reroll(item, craft.UNTOUCHABLE, mulberry32(1)).ok).toBe(true);
  });
});

describe('line 1 carries 1-3 Mods on one line, scaled', () => {
  it('a weapon forces every Mod its type lists, at the two-Mod scale', () => {
    const wand = weaponNamed('wand');
    const line = loot.baseModRoll(BASES, 'main hand', null, wand, () => 0, 1, 0);
    expect(line.length).toBe(1); // ONE line ...
    expect(line[0].id).toBe('magic_power_flat');
    expect(line[0].extra.length).toBe(1); // ... carrying the pair
    expect(line[0].extra[0].id).toBe('cooldown_reduction');
    const k = E.loot.base_mod.value_scale['2'];
    expect(line[0].value).toBe(Math.round(loot.rangeOf('magic_power_flat', 1, 0)[0] * k));
    expect(line[0].extra[0].value).toBe(Math.round(loot.rangeOf('cooldown_reduction', 1, 0)[0] * k));
  });

  it('a single-Mod weapon keeps its full roll', () => {
    const line = loot.baseModRoll(BASES, 'main hand', null, weaponNamed('two-handed sword'), () => 0, 1, 0);
    expect(line.length).toBe(1);
    expect(line[0].extra).toBeUndefined();
    expect(line[0].value).toBe(loot.rangeOf('physical_power_flat', 1, 0)[0]);
  });

  it('an armour Base locks its own defence type and may add the others at the three-Mod scale', () => {
    const frame = armourFrame('armour_pct');
    const line = loot.baseModRoll(BASES, 'helmet', frame, null, () => 0, 1, 0);
    expect(line.length).toBe(1);
    expect(line[0].id).toBe('armour_pct');
    expect(line[0].extra.length).toBe(2);
    const k = E.loot.base_mod.value_scale['3'];
    expect(line[0].value).toBe(Math.round(loot.rangeOf('armour_pct', 1, 0)[0] * k));
  });

  it('a pure frame stays the common case and a three-way line is the rare one', () => {
    const frame = armourFrame('armour_pct');
    let two = 0;
    let three = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const line = loot.baseModRoll(BASES, 'helmet', frame, null, mulberry32(i), 1, 0);
      const n = 1 + (line[0].extra?.length || 0);
      if (n === 2) two++;
      if (n === 3) three++;
    }
    expect(two / N).toBeGreaterThan(E.loot.base_mod.hybrid_chance[0] * 0.8);
    expect(two / N).toBeLessThan(E.loot.base_mod.hybrid_chance[0] * 1.2);
    expect(three / N).toBeLessThan(E.loot.base_mod.hybrid_chance[0] * E.loot.base_mod.hybrid_chance[1] * 1.5);
  });
});

describe('block is its own avoidance layer (exception)', () => {
  const shield = (pct: number): Item => ({
    slot: 'off hand', base: 'Buckler', rarity: 'Rare', quality: 'high', tier: 'T1', q: 2,
    lines: [{ id: 'block_chance', value: pct, slice: 0 }],
  } as unknown as Item);

  const gearWith = (item: Item) => {
    const gear = emptyGear();
    gear[loot.SLOTS.indexOf('off hand')] = item;
    return gear;
  };

  it('the shield line feeds the sheet, uncapped (owner ruling)', () => {
    const c = buildCharacter(60, gearWith(shield(25)));
    expect(c.block).toBe(25);
    // no Cap: a huge shield line is not clipped
    expect(buildCharacter(60, gearWith(shield(999))).block).toBe(999);
    expect(buildCharacter(60, emptyGear()).block).toBe(0);
  });

  it('a blocked hit is thinned by a flat armour / 10, not deleted (owner ruling)', () => {
    const c = buildCharacter(60, gearWith(shield(100)));
    // an accurate mob keeps the evasion roll near zero, so a draw between that and the block
    // chance lands on the block layer and nowhere else
    const mob = { ps: 300, hitsPerSec: 1, acc: 1e6, damage: 'physical', innate: ['fire'], armour: 0, res: 0 } as any;
    const ev = eng.evasionChance(c.evasion, c.evasionFromAgi, mob.acc);
    expect(ev).toBeLessThan(c.block);
    const draw = (ev + c.block) / 200;
    const r = mobSwing(() => draw, c, mob, {} as any);
    expect(r.blocked).toBe('block');
    // the hit still lands, cut by the flat `armour / 10` — a shield thins it, it does not erase it
    expect(r.toHp).toBeGreaterThan(0);
    expect(r.absorbed).toBe(0);
  });

  it('a build with no shield never blocks', () => {
    const c = buildCharacter(60, emptyGear());
    const mob = { ps: 300, hitsPerSec: 1, acc: 0, damage: 'physical', innate: ['fire'], armour: 0, res: 0 } as any;
    expect(mobSwing(() => 0.99, c, mob, {} as any).blocked).toBe(null);
  });
});

describe('armour penetration cuts the mob armour ratio ', () => {
  it('the crossbow line lands on the sheet as a fraction', () => {
    const line = loot.baseModRoll(BASES, 'main hand', null, weaponNamed('crossbow'), () => 0, 1, 0);
    expect(line[0].extra[0].id).toBe('armour_pen');
    const gear = emptyGear();
    gear[loot.SLOTS.indexOf('main hand')] = {
      slot: 'main hand', base: 'crossbow', rarity: 'Rare', quality: 'high', tier: 'T1', q: 2,
      weaponAspd: weaponNamed('crossbow').weapon_aspd, lines: line,
    } as unknown as Item;
    const c = buildCharacter(60, gear);
    expect(c.armourPen).toBeGreaterThan(0);
    expect(eng.armourPenCut(c.armourPen)).toBeCloseTo(c.armourPen / 100, 6);
  });

  it('penetration raises the damage a heavy armour would otherwise stop', () => {
    const mob = { armour: 9000, res: 0 };
    const plain = eng.mitigateMobHit(mob, 1000, 0, 0);
    const penned = eng.mitigateMobHit(mob, 1000, 0, eng.armourPenCut(15));
    expect(penned).toBeGreaterThan(plain);
    // and over-penetration is wasted, never an amplifier
    expect(eng.armourPenCut(200)).toBe(1);
    expect(eng.armourPenCut(-5)).toBe(0);
  });
});

describe('the new lines reach the sheet through line 1', () => {
  it('sumLines counts a Base Mod line and its extra Mods', () => {
    const item: Item = {
      slot: 'off hand', base: 'Buckler', rarity: 'Rare', quality: 'high', tier: 'T1', q: 2,
      lines: [{ id: 'block_chance', value: 20, slice: 0, extra: [{ id: 'evasion_pct', value: 10 }] }],
    } as unknown as Item;
    const gear = emptyGear();
    gear[loot.SLOTS.indexOf('off hand')] = item;
    const lines = sumLines(gear);
    expect(lines.blockPct).toBe(20);
    expect(lines.evasionPct).toBe(10);
  });
});
