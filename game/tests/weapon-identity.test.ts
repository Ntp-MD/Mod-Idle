import { describe, expect, it } from 'vitest';
import { BASES, E, eng, loot, sm, tree } from '../src/engine/client';
import { createMastery } from '../../engine/mastery';
import { rollDrop } from '../src/sim/drop';
import { itemName } from '../src/sim/item-name';
import { buildCharacter, emptyGear } from '../src/sim/player';

const WEAPON_MULTS: Record<string, [number, number]> = {
  'one-handed sword': [1.2, 1],
  'one-handed axe': [1.2, 1.05],
  dagger: [1.5, 0.84],
  mace: [1, 1.15],
  wand: [1, 1.1],
  staff: [0.85, 1.42],
  spear: [0.85, 1.48],
  'two-handed sword': [0.7, 1.8],
  'two-handed axe': [0.7, 1.88],
  bow: [1.1, 1.05],
  crossbow: [1.1, 1.2],
};

describe('weapon identity', () => {
  it('uses per-type damage multipliers with the sword as the unchanged reference anchor', () => {
    const rows = eng.WEAPONS as any[];
    expect(rows.map((row) => row.name).sort()).toEqual(Object.keys(WEAPON_MULTS).sort());
    for (const [name, [aspd, mult]] of Object.entries(WEAPON_MULTS)) {
      const row = rows.find((item) => item.name === name);
      expect(row.weapon_aspd).toBe(aspd);
      expect(row.weapon_mult).toBe(mult);
      expect((eng.weaponMult as any)(aspd, name)).toBe(mult);
    }
    const anchor = rows.find((row) => row.name === 'one-handed sword');
    for (const row of rows) {
      const dpsIndex = row.weapon_aspd * row.weapon_mult / (anchor.weapon_aspd * anchor.weapon_mult);
      expect(dpsIndex).toBeGreaterThanOrEqual(0.9);
      expect(dpsIndex).toBeLessThanOrEqual(1.1);
    }
    expect(eng.REFERENCE.weapon).toBe('one-handed sword');
    expect(eng.REFERENCE.ttk).toBeCloseTo(E.loot.ttk_per_mob_sec, 3);
    const held = (base: string) => {
      const gear = emptyGear();
      gear[loot.SLOTS.indexOf('main hand')] = { slot: 'main hand', base, ilvl: 1, quality: 'low', tier: 'T1', lines: [], weight: 0 } as any;
      return buildCharacter(1, gear);
    };
    expect(held('one-handed axe').phys / held('one-handed sword').phys).toBeCloseTo(1.05, 8);
  });

  it('gives every weapon frame its own drop and value weights while resolving old saved frame lines', () => {
    const frames = BASES.weapon_frames as any;
    for (const list of Object.values(frames) as any[][]) {
      expect(new Set(list.map((frame) => frame.drop_weight)).size).toBeGreaterThan(1);
      expect(list.every((frame) => frame.value_bias > 0 && frame.legacy_frame_mod?.length > 0)).toBe(true);
      for (const frame of list) {
        const [id, ...extraIds] = frame.legacy_frame_mod;
        expect(itemName({
          slot: 'main hand',
          base: Object.keys(frames).find((name) => frames[name] === list)!,
          lines: [{ id, value: 1, slice: 0, extra: extraIds.map((extraId: string) => ({ id: extraId, value: 1 })) }],
        } as any)).toBe(frame.name);
      }
    }
    expect(itemName({
      slot: 'main hand',
      base: 'one-handed sword',
      lines: [{ id: 'physical_power_flat', value: 1, slice: 0, extra: [{ id: 'attack_speed', value: 1 }] }],
    } as any)).toBe('Gloamblade');
  });

  it('rolls multiple named frame variants in live weapon drops', () => {
    const names = new Map<string, Set<string>>();
    for (let seed = 1; seed <= 400; seed++) {
      const item = rollDrop(loot.mulberry32(seed), 'low', 1);
      if (item.slot === 'main hand') {
        if (!names.has(item.base)) names.set(item.base, new Set());
        names.get(item.base)!.add(itemName(item));
      }
    }
    expect([...names.values()].some((variants) => variants.size > 1)).toBe(true);
  });

  it('adds archetype lines to each type-specific weapon pool', () => {
    const pool = (name: string) => loot.poolFor(BASES, 'main hand', null, { name, damage: 'physical' }).map((row: any) => row.id);
    expect(pool('one-handed axe')).toContain('bleed_chance');
    expect(pool('mace')).toContain('stun_chance');
    expect(pool('spear')).toContain('accuracy');
    expect(pool('crossbow')).toContain('armour_pen');
  });

  it('locks only arrow attacks to their weapon and gives off-type skills half Mastery synergy', () => {
    expect(sm.weaponFits(sm.byId['attack.whirlaxe'], 'one-handed axe')).toBe(true);
    expect(sm.weaponFits(sm.byId['attack.whirlaxe'], 'one-handed sword')).toBe(true);
    expect(sm.weaponFits(sm.byId['attack.piercing_shot'], 'bow')).toBe(true);
    expect(sm.weaponFits(sm.byId['attack.piercing_shot'], 'crossbow')).toBe(true);
    expect(sm.weaponFits(sm.byId['attack.piercing_shot'], 'one-handed sword')).toBe(false);
    expect(sm.weaponMatches(sm.byId['attack.piercing_shot'], 'bow')).toBe(true);
    expect(sm.weaponMatches(sm.byId['attack.piercing_shot'], 'crossbow')).toBe(true);
    expect(sm.weaponMatches(sm.byId['attack.piercing_shot'], 'one-handed sword')).toBe(false);
    const model = createMastery(BASES as any);
    expect(model.skillBonus(20)).toBe(1.08);
    expect(model.skillBonus(20, false)).toBe(1.04);
  });

  it('activates weapon-specific passive nodes only while their weapon is held', () => {
    const axeNode = (tree.nodes as any[]).find((node) => node.weapon === 'one-handed axe');
    expect(axeNode?.name).toBeTruthy();
    expect(tree.linesOf({ [axeNode.id]: 3 }, 'one-handed axe')).toEqual([{ id: axeNode.line, value: axeNode.values[2] }]);
    expect(tree.linesOf({ [axeNode.id]: 3 }, 'one-handed sword')).toEqual([]);
    const ranks = { [axeNode.id]: 3 };
    const bare = buildCharacter(1, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, ranks);
    const held = emptyGear();
    held[loot.SLOTS.indexOf('main hand')] = { slot: 'main hand', base: 'one-handed axe', ilvl: 1, quality: 'low', tier: 'T1', lines: [], weight: 0 } as any;
    const equipped = buildCharacter(1, held, {}, 0, { add: {}, mult: {} }, undefined, ranks);
    expect(bare.lines.bleedChancePct).toBe(0);
    expect(equipped.lines.bleedChancePct).toBe(axeNode.values[2]);
  });
});
