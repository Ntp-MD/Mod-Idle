import { describe, expect, it } from 'vitest';
import { isAdvancedStone, modesForStone } from '../src/ui/craft-use';

describe('craft bench disclosure', () => {
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
