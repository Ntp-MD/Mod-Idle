import { describe, it, expect } from 'vitest';
import { E, BASES, eng } from '../src/engine/client';
import { mastery, WEAPONS, weaponByName, payMastery, masteryLevel, dropBonusPct } from '../src/sim/mastery';
import { rollDrop } from '../src/sim/drop';
import { newGame, tick, heldWeaponName, huntZone } from '../src/sim/game';
import { mulberry32 } from '../src/engine/client-helpers';

describe('the Mastery curve is the published one', () => {
  it('the kill anchors land on the right levels', () => {
    // the anchor levels the mastery curve was calibrated on; the last is the data's own cap
    expect(mastery.level(mastery.xpForLevel(5))).toBe(5);
    expect(mastery.level(mastery.xpForLevel(10))).toBe(10);
    expect(mastery.level(mastery.xpForLevel(15))).toBe(15);
    expect(mastery.level(mastery.xpForLevel(BASES.mastery.level_cap))).toBe(BASES.mastery.level_cap);
    expect(mastery.level(999999)).toBe(BASES.mastery.level_cap);
  });

  it('weight falls its per-level share a level and stops at the published cap', () => {
    expect(mastery.weightDiscount(1)).toBe(BASES.mastery.weight_discount_per_level_pct);
    expect(mastery.weightDiscount(BASES.mastery.level_cap - 6)).toBe((BASES.mastery.level_cap - 6) * BASES.mastery.weight_discount_per_level_pct);
    expect(mastery.weightDiscount(BASES.mastery.level_cap)).toBe(BASES.mastery.weight_discount_cap_pct);
    expect(mastery.weaponWeight(100, BASES.mastery.level_cap)).toBe(100 * (1 - BASES.mastery.weight_discount_cap_pct / 100));
  });

  it('skill damage joins at its published level and caps at the published %', () => {
    expect(mastery.skillBonus(1)).toBe(1);
    expect(mastery.skillBonus(BASES.mastery.skill_bonus_from_level - 1)).toBe(1);
    expect(mastery.skillBonus(BASES.mastery.skill_bonus_from_level)).toBeCloseTo(1 + BASES.mastery.skill_bonus_per_level_pct / 100, 6);
    expect(mastery.skillBonus(BASES.mastery.level_cap)).toBeCloseTo(1 + BASES.mastery.skill_bonus_cap_pct / 100, 6);
  });

  it('the drop bonus counts types at its published level, to the whole-table cap', () => {
    const s = newGame(3);
    expect(dropBonusPct(s)).toBe(0);
    for (const w of WEAPONS) s.mastery[w.name] = mastery.xpForLevel(BASES.mastery.drop_bonus_level_required);
    expect(dropBonusPct(s)).toBe(BASES.weapons.length * BASES.mastery.drop_bonus_per_type_pct);
    expect(mastery.MAX_DROP_BONUS).toBe(BASES.weapons.length * BASES.mastery.drop_bonus_per_type_pct);
    s.mastery[WEAPONS[0].name] = mastery.xpForLevel(BASES.mastery.drop_bonus_level_required - 1);
    expect(dropBonusPct(s)).toBe((BASES.weapons.length - 1) * BASES.mastery.drop_bonus_per_type_pct);
  });
});

describe('the held weapon is the only one that levels', () => {
  it('pays its XP per kill to that type alone', () => {
    const s = newGame(4);
    const held = heldWeaponName(s);
    expect(held).toBeTruthy();
    payMastery(s, held);
    payMastery(s, held);
    expect(s.mastery[held!]).toBe(2 * BASES.mastery.xp_per_kill);
    expect(Object.keys(s.mastery).length).toBe(1);
  });

  it('grows through the live loop and shows on the sheet', () => {
    const s = newGame(5);
    huntZone(s, s.zone);
    // Tick until the loop has paid a kill, never for a guessed window (a time premise · AGENTS.md).
    for (let i = 0; i < 20000 && s.counters.kills === 0; i++) tick(s, {});
    const held = heldWeaponName(s)!;
    // the rule is one weapon per kill, not one weapon forever: a kept upgrade is worn at once, so
    // the held type changes mid-run and only the newest type carries the whole total
    const total = Object.values(s.mastery).reduce((a: number, b: number) => a + b, 0);
    expect(total).toBe(s.counters.kills * BASES.mastery.xp_per_kill);
    expect(s.mastery[held]).toBeGreaterThan(0);
    expect(s.mastery[held]).toBeLessThanOrEqual(total);
    expect(masteryLevel(s, held)).toBeGreaterThanOrEqual(1);
  });

  it('weapon types come from the bases data, not a client list', () => {
    expect(WEAPONS.length).toBe(BASES.weapons.length);
    expect(weaponByName('one-handed sword / axe')?.name).toBe('one-handed sword');
    expect(weaponByName('dagger')?.group).toBe('melee');
    expect(weaponByName('staff')?.damage).toBe('magic');
    const inGroup = (g: string) => BASES.weapons.filter((w: any) => w.group === g).length;
    expect(WEAPONS.filter((w) => w.group === 'melee').length).toBe(inGroup('melee'));
    expect(WEAPONS.filter((w) => w.group === 'ranged').length).toBe(inGroup('ranged'));
    expect(WEAPONS.filter((w) => w.group === 'magic').length).toBe(inGroup('magic'));
  });
});

describe('weapon drops obey the union pool', () => {
  it('a main-hand piece never carries a line the slot blocks', () => {
    const blocked = new Set(BASES.weapon_pools['main hand'].Blocked);
    const rng = mulberry32(9);
    let seen = 0;
    for (let i = 0; i < 500; i++) {
      const item = rollDrop(rng, 'high', E.item_level.spans.find((s: any) => s.band === 'high').from);
      if (item.slot !== 'main hand') continue;
      seen++;
      // line 1 is the frame's own implicit — a wand carries Cooldown reduction there even though the
      // random pool blocks it (the weapon pool in bases.json); lines 2-7 must stay inside the pool
      for (const line of item.lines.slice(1)) expect(blocked.has(line.id)).toBe(false);
      const w = weaponByName(item.base)!;
      const magicLines = item.lines.filter((l) => l.id.startsWith('magic_power'));
      const physLines = item.lines.filter((l) => l.id.startsWith('physical_power'));
      if (w.damage === 'magic') expect(physLines.length).toBe(0);
      else expect(magicLines.length).toBe(0);
    }
    expect(seen).toBeGreaterThan(20);
  });

});

