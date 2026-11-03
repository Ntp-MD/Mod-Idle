import { SKILLS, sm } from '../../src/engine/client';
import type { SkillRow } from '@engine/types.ts';

/**
 * The dev/test-only rows in `tools/data/skills.json` `test_fixtures`. They are deliberately outside
 * `skills`, so the live roster, drops, rewards and roster cages never see them. A test injects one
 * into the model by id and restores the prior row in a `finally`.
 *
 * Every install hands out a fresh clone: with `isolate: false` a shared object would leak one
 * test's mutations into the next.
 */
type FixtureFile = { test_fixtures?: { skills: SkillRow[] } };

const liveIds = new Set((SKILLS as unknown as { skills: SkillRow[] }).skills.map((row) => row.id));
/** Ids currently installed by this registry; a second install without a restore is a leak. */
const installed = new Set<string>();

function claim(id: string): void {
  if (liveIds.has(id)) throw new Error(`refuses to overlay live skill ${id}: synthetic fixtures must use test.* ids`);
  if (installed.has(id)) throw new Error(`skill fixture ${id} is already installed without a restore`);
  installed.add(id);
}

function release(id: string): void {
  installed.delete(id);
}

export function skillFixture(id: string): SkillRow {
  const row = (SKILLS as unknown as FixtureFile).test_fixtures?.skills.find((entry) => entry.id === id);
  if (!row) throw new Error(`skills.json test_fixtures is missing ${id}`);
  return structuredClone(row);
}

export function installSkillFixture(id: string, over: Partial<SkillRow> = {}): { row: SkillRow; restore: () => void } {
  const row = structuredClone({ ...skillFixture(id), ...over }) as SkillRow;
  claim(id);
  const hadPrior = Object.hasOwn(sm.byId, id);
  const prior = sm.byId[id];
  sm.byId[id] = row;
  let done = false;
  return {
    row,
    restore: () => {
      if (done) return;
      done = true;
      release(id);
      if (hadPrior) sm.byId[id] = prior;
      else delete sm.byId[id];
    },
  };
}

/** Minimal valid attack row owned entirely by the scenario — no live roster data. */
const SYNTHETIC_BASE = {
  hit_class: 'attack',
  name: 'Synthetic Fixture',
  type: 'attack',
  group: 'melee',
  element: 'physical',
  cd: 6,
  mana: '10 flat',
  basis: 'phys',
  offline_targets: '1',
  area: { origin: 'target', radius_m: 0 },
  cast: { delivery: 'melee', range_m: 2, windup_sec: 0.15, recovery_sec: 0.22 },
  effect: 'Test-only synthetic row.',
  effects: [],
  base_flat: 100,
  eff: 0,
} as const;

/**
 * Install a synthetic row for unit tests that prove a mechanic, not a live row.
 * Prefer this over cloning `sm.byId[liveId]`: a roster rename/retune must not
 * change what the scenario asserts.
 */
export function installSyntheticSkill(id: string, over: Record<string, unknown> = {}): { row: SkillRow; restore: () => void } {
  const row = structuredClone({ ...SYNTHETIC_BASE, id, ...over }) as unknown as SkillRow;
  claim(id);
  const hadPrior = Object.hasOwn(sm.byId, id);
  const prior = sm.byId[id];
  sm.byId[id] = row;
  let done = false;
  return {
    row,
    restore: () => {
      if (done) return;
      done = true;
      release(id);
      if (hadPrior) sm.byId[id] = prior;
      else delete sm.byId[id];
    },
  };
}
