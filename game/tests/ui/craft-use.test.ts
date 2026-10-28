import { describe, expect, it } from 'vitest';
import { isAdvancedStone, modesForStone, stoneUseReason } from '../../src/ui/inventory/craft-use';
import { newGame } from '@sim/core/game';
import { imprintStones } from '../../src/ui/inventory/stones';
import type { Item } from '@sim/core/types';

describe('craft bench disclosure', () => {
  it('keeps a legacy excluded Imprint visible and explains why no line accepts it', () => {
    const game = newGame();
    const key = 'imprint_elemental_resistance_cap_pct';
    game.counters.stones[key] = 2;
    const item: Item = { slot: 'ring', base: 'ring', ilvl: 30, quality: 'low', tier: 'T1', q: 0, lines: [
      { id: 'max_hp_flat', value: 40 }, { id: 'armour_flat', value: 8 },
      { id: 'max_mana_flat', value: 15 }, { id: 'life_regen', value: 5 },
    ] };
    game.bag.push(item);
    const [stone] = imprintStones(game.counters.stones);
    expect(stone.count).toBe(2);
    expect(stone.detail).toMatch(/cannot be Imprinted/);
    for (const line of [null, 0, 1, 3]) {
      expect(stoneUseReason(game, item, 'bag', 0, { op: 'imprint', target: 'line' }, line,
        'elemental_resistance_cap_pct', true)).toMatch(/cannot be Imprinted/);
    }
  });

  it('keeps whole-piece presses out of the basic view', () => {
    expect(modesForStone('tier', false).map((mode) => mode.op)).toEqual(['refine', 'randomize', 'reroll_mod']);
    expect(modesForStone('tier', true).map((mode) => mode.op)).toContain('reroll_mod_all');
    expect(modesForStone('add', false).map((mode) => mode.op)).not.toContain('ascend');
    expect(modesForStone('add', true).map((mode) => mode.op)).toContain('ascend');
  });

  it('hides rare stones and imprint stones until advanced', () => {
    expect(isAdvancedStone('corrupt')).toBe(true);
    expect(isAdvancedStone('polish')).toBe(true);
    expect(isAdvancedStone('imprint_attack_speed')).toBe(true);
    expect(isAdvancedStone('tier')).toBe(false);
    expect(modesForStone('corrupt', false)).toEqual([]);
    expect(modesForStone('corrupt', true).map((mode) => mode.op)).toEqual(['corrupt']);
  });
});
