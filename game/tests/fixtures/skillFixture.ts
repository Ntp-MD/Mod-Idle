import { SKILLS, sm } from '../../src/engine/client';
import type { SkillRow } from '@engine/types.ts';

/**
 * The dev/test-only rows in `tools/data/skills.json` `test_fixtures`. They are deliberately outside
 * `skills`, so the live roster, drops, rewards and roster cages never see them. A test injects one
 * into the model by id and restores the prior row in a `finally`.
 */
type FixtureFile = { test_fixtures?: { skills: SkillRow[] } };

export function skillFixture(id: string): SkillRow {
  const row = (SKILLS as unknown as FixtureFile).test_fixtures?.skills.find((entry) => entry.id === id);
  if (!row) throw new Error(`skills.json test_fixtures is missing ${id}`);
  return row;
}

export function installSkillFixture(id: string): { row: SkillRow; restore: () => void } {
  const row = skillFixture(id);
  const prior = sm.byId[id];
  sm.byId[id] = row;
  return {
    row,
    restore: () => {
      if (prior) sm.byId[id] = prior;
      else delete sm.byId[id];
    },
  };
}
