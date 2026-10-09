import { describe, it, expect } from 'vitest';
import { E, eng, loot, BASES } from '../src/engine/client';
import { rollDrop } from '../src/sim/drop';
import { craft } from '../src/sim/craft';
import { buildCharacter, emptyGear, sumLines } from '../src/sim/player';
import { mobSwing } from '../src/sim/combat';
import { mulberry32 } from '../src/engine/client-helpers';
import type { Item } from '../src/sim/types';

/**
 * The line skeleton: line 1 is the Frame Mod, lines 2-3 the unremovable Bound pair, then the Normal
 * lines the drop drew (`item_level.unbound_slots`) which the Add craft may widen by `mods_added_cap`.
 * These tests pin the shape, the one-line rule that a Frame Mod follows (the FLAT defence lines the
 * frame's name declares, one, two or all three, sharing one budget at ×0.7 / ×0.55), and the two
 * avoidance readings the skeleton added — block and armour penetration.
 */

const frameNamed = (name: string) => BASES.bases.find((b: any) => b.name === name);
const weaponNamed = (name: string) => BASES.weapons.find((w: any) => w.name === name);

describe('the line skeleton', () => {
  it('draws the Unbound line count inside the published range and never exceeds it', () => {
    const L = E.item_level;
    const lo = L.frame_mod_slots + L.bound_slots + L.unbound_slots.min;
    const hi = L.frame_mod_slots + L.bound_slots + L.unbound_slots.max;
    const rng = mulberry32(101);
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      const band = ['low', 'mid', 'high'][i % 3];
      const item = rollDrop(rng, band, band === 'low' ? 1 : band === 'mid' ? 31 : 61);
      expect(item.lines.length).toBeGreaterThanOrEqual(lo);
      expect(item.lines.length).toBeLessThanOrEqual(hi);
      seen.add(item.lines.length);
    }
    // it is a draw, not a constant: the same drop source fields pieces of more than one width
    expect(seen.size).toBeGreaterThan(1);
  });

  it('the ceiling is the head plus the widest Normal draw plus the Add stones', () => {
    const L = E.item_level;
    expect(loot.linesAtDrop(() => 0)).toBe(L.frame_mod_slots + L.bound_slots + L.unbound_slots.min);
    expect(loot.linesAtDrop(() => 0.999999)).toBe(L.frame_mod_slots + L.bound_slots + L.unbound_slots.max);
    expect(L.crafted_max).toBe(L.frame_mod_slots + L.bound_slots + L.unbound_slots.max + L.mods_added_cap);
  });

  it('line 1 is the Frame Mod, lines 2-3 the Bound pair, and the craft verbs refuse all three', () => {
    const item = rollDrop(mulberry32(202), 'high', 61);
    expect(craft.FRAME_MOD_SLOTS).toBe(1);
    expect(craft.BOUND_SLOTS).toBe(2);
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
    const line = loot.frameModRoll(BASES, 'main hand', null, wand, () => 0, 1, 0, 0);
    expect(line.length).toBe(1); // ONE line ...
    expect(line[0].id).toBe('magic_power_flat');
    expect(line[0].extra.length).toBe(1); // ... carrying the pair
    expect(line[0].extra[0].id).toBe('cooldown_reduction');
    const k = E.loot.frame_mod.value_scale['2'];
    expect(line[0].value).toBe(Math.round(loot.windowAt('magic_power_flat', 1, 0)[0] * k));
    expect(line[0].extra[0].value).toBe(Math.round(loot.windowAt('cooldown_reduction', 1, 0)[0] * k));
  });

  it('a single-Mod weapon keeps its full roll', () => {
    const line = loot.frameModRoll(BASES, 'main hand', null, weaponNamed('two-handed sword'), () => 0, 1, 0, 0);
    expect(line.length).toBe(1);
    expect(line[0].extra).toBeUndefined();
    expect(line[0].value).toBe(loot.windowAt('physical_power_flat', 1, 0)[0]);
  });

  it('an armour frame carries the flat defence lines its own name declares, sharing one budget', () => {
    // Crown is the Armour & Energy Shield frame: two flat lines on ONE line, each at the two-line scale
    const pair = loot.frameModRoll(BASES, 'helmet', frameNamed('Crown'), null, () => 0, 1, 0, 0);
    expect(pair.length).toBe(1); // ONE line ...
    expect(pair[0].id).toBe('armour_flat');
    expect(pair[0].extra.length).toBe(1); // ... carrying the frame's second line
    expect(pair[0].extra[0].id).toBe('energy_shield_flat');
    const k2 = E.loot.frame_mod.value_scale['2'];
    expect(pair[0].value).toBe(Math.round(loot.windowAt('armour_flat', 1, 0)[0] * k2));
    expect(pair[0].extra[0].value).toBe(Math.round(loot.windowAt('energy_shield_flat', 1, 0)[0] * k2));

    // Hood is the Evasion frame: one line, and it keeps the whole window with nothing to share
    const single = loot.frameModRoll(BASES, 'helmet', frameNamed('Hood'), null, () => 0, 1, 0, 0);
    expect(single[0].id).toBe('evasion_flat');
    expect(single[0].extra).toBeUndefined();
    expect(single[0].value).toBe(loot.windowAt('evasion_flat', 1, 0)[0]);

    // Bastion is the frame that carries all three: both partners on the same line, each at ×0.55
    const trio = loot.frameModRoll(BASES, 'helmet', frameNamed('Bastion Helm'), null, () => 0, 1, 0, 0);
    expect(trio.length).toBe(1); // still ONE line ...
    expect(trio[0].id).toBe('armour_flat');
    expect(trio[0].extra.map((x: any) => x.id)).toEqual(['energy_shield_flat', 'evasion_flat']);
    const k3 = E.loot.frame_mod.value_scale['3'];
    expect(trio[0].value).toBe(Math.round(loot.windowAt('armour_flat', 1, 0)[0] * k3));
    for (const x of trio[0].extra) expect(x.value).toBe(Math.round(loot.windowAt(x.id, 1, 0)[0] * k3));

    // and the floor roll hands a restored piece the same set, scaled the same way
    const floor = loot.frameModAtFloor(BASES, 'helmet', frameNamed('Bastion Helm'), null, 1, 0);
    expect([floor[0].id, ...floor[0].extra.map((x: any) => x.id)]).toEqual(['armour_flat', 'energy_shield_flat', 'evasion_flat']);
    expect(floor[0].value).toBe(Math.round(loot.windowAt('armour_flat', 1, 0)[0] * k3));
  });

});

describe('block is its own avoidance layer (exception)', () => {
  const shield = (pct: number): Item => ({
    slot: 'off hand', base: 'Buckler', ilvl: 61, quality: 'high', tier: 'T1', q: 2,
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
    const line = loot.frameModRoll(BASES, 'main hand', null, weaponNamed('crossbow'), () => 0, 1, 0, 0);
    expect(line[0].extra[0].id).toBe('armour_pen');
    const gear = emptyGear();
    gear[loot.SLOTS.indexOf('main hand')] = {
      slot: 'main hand', base: 'crossbow', ilvl: 61, quality: 'high', tier: 'T1', q: 2,
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
  it('sumLines counts a Frame Mod line and its extra Mods', () => {
    const item: Item = {
      slot: 'off hand', base: 'Buckler', ilvl: 61, quality: 'high', tier: 'T1', q: 2,
      lines: [{ id: 'block_chance', value: 20, slice: 0, extra: [{ id: 'evasion_pct', value: 10 }] }],
    } as unknown as Item;
    const gear = emptyGear();
    gear[loot.SLOTS.indexOf('off hand')] = item;
    const lines = sumLines(gear);
    expect(lines.blockPct).toBe(20);
    expect(lines.evasionPct).toBe(10);
  });
});
