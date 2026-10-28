import { describe, expect, it } from 'vitest';
import { skillSlotState } from '../../src/ui/character/skill-slot-copy';

describe('skill slot cooldown copy', () => {
  it('names the live clock only while a skill is cooling', () => {
    expect(skillSlotState('Cooling down', 3.44, false)).toBe('Cooling down · 3.4s');
    expect(skillSlotState('Cooling down', 0, false)).toBe('Cooling down');
    expect(skillSlotState('Not enough Mana', 0, false)).toBe('Not enough Mana');
    expect(skillSlotState('Ready', 2, true)).toBe('Ready');
  });
});
