import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { BASES, eng } from '../src/engine/client';
import { mastery, WEAPONS, weaponByName, payMastery, masteryLevel, dropBonusPct } from '../src/sim/mastery';
import { rollDrop } from '../src/sim/drop';
import { newGame, tick, heldWeaponName } from '../src/sim/game';
import { mulberry32 } from '../src/engine/client-helpers';

const require = createRequire(import.meta.url);
const basesCage = require('../../tools/bases.ts');

describe('the Mastery curve is the published one', () => {
  it('the kill anchors in equipment-weapon.md land on the right levels', () => {
    // 4 XP per kill: 400 kills = 1,600 xp = L5, 2,025 = L10, 4,900 = L15, 9,025 = L20
    expect(mastery.level(mastery.xpForLevel(5))).toBe(5);
    expect(mastery.level(1600)).toBe(5);
    expect(mastery.level(8100)).toBe(10);
    expect(mastery.level(19600)).toBe(15);
    expect(mastery.level(36100)).toBe(20);
    expect(mastery.level(999999)).toBe(20);
  });

  it('weight falls 1% a level and stops at -20%', () => {
    expect(mastery.weightDiscount(1)).toBe(1);
    expect(mastery.weightDiscount(14)).toBe(14);
    expect(mastery.weightDiscount(20)).toBe(20);
    expect(mastery.weaponWeight(100, 20)).toBe(80);
  });

  it('skill damage joins at L5 and caps at +8%', () => {
    expect(mastery.skillBonus(1)).toBe(1);
    expect(mastery.skillBonus(4)).toBe(1);
    expect(mastery.skillBonus(5)).toBeCloseTo(1.005, 6);
    expect(mastery.skillBonus(20)).toBeCloseTo(1.08, 6);
  });

  it('the drop bonus counts types at L10 or better, to 11%', () => {
    const s = newGame(3);
    expect(dropBonusPct(s)).toBe(0);
    for (const w of WEAPONS) s.mastery[w.name] = mastery.xpForLevel(10);
    expect(dropBonusPct(s)).toBe(11);
    expect(mastery.MAX_DROP_BONUS).toBe(11);
    s.mastery[WEAPONS[0].name] = mastery.xpForLevel(9);
    expect(dropBonusPct(s)).toBe(10);
  });
});

describe('the held weapon is the only one that levels', () => {
  it('pays 4 XP per kill to that type alone', () => {
    const s = newGame(4);
    const held = heldWeaponName(s);
    expect(held).toBeTruthy();
    payMastery(s, held);
    payMastery(s, held);
    expect(s.mastery[held!]).toBe(8);
    expect(Object.keys(s.mastery).length).toBe(1);
  });

  it('grows through the live loop and shows on the sheet', () => {
    const s = newGame(5);
    for (let i = 0; i < 900; i++) tick(s, {});
    const held = heldWeaponName(s)!;
    // the rule is one weapon per kill, not one weapon forever: a kept upgrade is worn at once, so
    // the held type changes mid-run and only the newest type carries the whole total
    const total = Object.values(s.mastery).reduce((a: number, b: number) => a + b, 0);
    expect(total).toBe(s.counters.kills * BASES.mastery.xp_per_kill);
    expect(s.mastery[held]).toBeGreaterThan(0);
    expect(s.mastery[held]).toBeLessThanOrEqual(total);
    expect(masteryLevel(s, held)).toBeGreaterThanOrEqual(1);
  });

  it('weapon types come from the doc table, not a client list', () => {
    expect(WEAPONS.length).toBe(11);
    expect(weaponByName('one-handed sword / axe')?.name).toBe('one-handed sword');
    expect(weaponByName('dagger')?.group).toBe('melee');
    expect(weaponByName('staff')?.damage).toBe('magic');
    expect(WEAPONS.filter((w) => w.group === 'melee').length).toBe(7);
    expect(WEAPONS.filter((w) => w.group === 'ranged').length).toBe(2);
    expect(WEAPONS.filter((w) => w.group === 'magic').length).toBe(2);
  });
});

describe('weapon drops obey the union pool', () => {
  it('a main-hand piece never carries a line the slot blocks', () => {
    const blocked = new Set(BASES.weapon_pools['main hand'].Blocked);
    const rng = mulberry32(9);
    let seen = 0;
    for (let i = 0; i < 500; i++) {
      const item = rollDrop(rng, 'high', 1.2);
      if (item.slot !== 'main hand') continue;
      seen++;
      // line 1 is the frame's own implicit — a wand carries Cooldown reduction there even though the
      // random pool blocks it (item-base.md · D-123); lines 2-7 must stay inside the pool
      for (const line of item.lines.slice(1)) expect(blocked.has(line.id)).toBe(false);
      const w = weaponByName(item.base)!;
      const magicLines = item.lines.filter((l) => l.id.startsWith('magic_power'));
      const physLines = item.lines.filter((l) => l.id.startsWith('physical_power'));
      if (w.damage === 'magic') expect(physLines.length).toBe(0);
      else expect(magicLines.length).toBe(0);
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('the cage agrees the tables match the docs', () => {
    const rows = basesCage.checks();
    expect(rows.filter((r: any) => r.status === 'fail')).toEqual([]);
    expect(rows.find((r: any) => r.id === 'BS5').status).toBe('pass');
    expect(rows.find((r: any) => r.id === 'BS8').status).toBe('pass');
  });
});

describe('Mastery never touches DPS', () => {
  it('the equal-DPS rule holds for every type at equal stats', () => {
    for (const w of WEAPONS) {
      const mult = 1.2 / w.weapon_aspd;
      expect(Math.abs(mult - w.weapon_mult)).toBeLessThan(0.011);
      // power is multiplied by weapon_mult and the clock by aspd, so the product is fixed
      const dps = eng.physOf(816, 80, 16, w.weapon_aspd) * eng.hitsPerSec(eng.aspdOf(210, w.weapon_aspd, 0));
      const base = eng.physOf(816, 80, 16, 1.2) * eng.hitsPerSec(eng.aspdOf(210, 1.2, 0));
      expect(dps / base).toBeGreaterThan(0.99);
      expect(dps / base).toBeLessThan(1.01);
    }
  });
});
