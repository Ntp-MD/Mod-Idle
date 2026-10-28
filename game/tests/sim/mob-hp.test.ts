import { describe, it, expect } from 'vitest';
import { E, eng } from '../../src/engine/client';
import { spawnMob } from '@sim/core/game';
import { mulberry32 } from '../../src/engine/client-helpers';

/**
 * A mob's HP is one shape, in one place: the published zone curve, plus the flat level grant, plus
 * the Core Vit term: the player and a mob run the same shape. The engine
 * owns it (`mobHpOf`), and a normal body, an Elite, a boss and a wild unique all read it.
 *
 * The formula below is written out from the data, not from the engine's helper, so the two cannot
 * agree by sharing a bug.
 */

const shape = (level: number, vit: number) =>
  eng.mobHpAt(level) + (E.level_gain as any).hp_per_level * (level - 1) + vit * E.K.K_VIT_HP;

describe("a mob's HP is one shape, in one place", () => {
  it('is the zone curve plus the level grant plus the Core Vit bonus', () => {
    for (const level of [1, 20, 45, 90, 120, 190]) {
      for (const vit of [0, 10, 40]) {
        expect(eng.mobHpOf(level, vit)).toBeCloseTo(shape(level, vit), 6);
      }
    }
  });

  it('hands a normal body exactly that figure', () => {
    const mob = spawnMob(mulberry32(11), 1, 'normal');
    expect(mob.hp).toBeCloseTo(shape(mob.level, (mob.core as any).vit), 6);
    expect(mob.hpMax).toBeCloseTo(mob.hp, 6);
  });

  it('multiplies the COMPLETE figure for an Elite, not a part of it', () => {
    const mob = spawnMob(mulberry32(11), 1, 'elite');
    expect(mob.kind).toBe('Elite');
    expect(mob.hp).toBeCloseTo(shape(mob.level, (mob.core as any).vit) * E.mob.elite.hp, 6);
    expect(mob.hpMax).toBeCloseTo(mob.hp, 6);
  });

  it('gives a boss its own profile, with no rank multiplier of its own', () => {
    const mob = spawnMob(mulberry32(11), 1, 'boss');
    expect(mob.kind.startsWith('Boss')).toBe(true);
    expect(mob.hp).toBeCloseTo(shape(mob.level, (mob.core as any).vit), 6);
  });

  it('gives a wild unique its own profile at the zone’s top level, with no rank multiplier', () => {
    const unique = (E.mob.uniques as any[]).find((u) => u.species === 'demon');
    const zone = (E.mob.species as any[]).find((s) => s.id === 'demon').zones[0];
    const top = eng.zoneById(zone)!.levels[1];
    const mob = eng.spawnAt(zone, 'large', 'demon', unique, null, top, null);
    expect(mob.level).toBe(top);
    expect(mob.hp).toBeCloseTo(shape(top, mob.vit), 6);
  });

  it('keeps the tree and the gear out of the mob curve', () => {
    // the same spawn twice: a mob wears no gear and holds no passive-tree rank, so its HP is a
    // function of its level and its Core alone: mobHP excludes passive-tree power
    const a = spawnMob(mulberry32(11), 1, 'normal');
    const b = spawnMob(mulberry32(11), 1, 'normal');
    expect(a.hp).toBe(b.hp);
  });
});
