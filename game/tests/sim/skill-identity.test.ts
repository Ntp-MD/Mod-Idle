import { describe, expect, it } from 'vitest';
import { SKILLS } from '../../src/engine/client';
import { skillIdentity } from '@sim/combat/skills';

describe('F23 — every row carries one readable combat identity', () => {
  it('classifies the whole roster without an unclassified attack', () => {
    const rows = (SKILLS as { skills: { id: string; type?: string }[] }).skills;
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const identity = skillIdentity(row as never);
      counts[identity] = (counts[identity] || 0) + 1;
      expect(['single-target', 'pack-clear', 'sustain', 'control', 'utility']).toContain(identity);
      if (row.type === 'attack') expect(identity).not.toBe('utility');
    }
    expect(counts['single-target']).toBeGreaterThan(0);
    expect(counts['pack-clear']).toBeGreaterThan(0);
  });
});
