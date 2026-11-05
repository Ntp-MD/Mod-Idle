import { expect, it } from 'vitest';
import { runScenario, checkScenarioInvariants, findNonFinite } from '../../measurements/scenarios';
import { seededEncounter } from '../fixtures/encounter';
import { installSyntheticSkill } from '../fixtures/skillFixture';
import { sm } from '../../src/engine/client';

function options(overrides = {}) {
  return {
    caseId: 'test.invariants',
    seed: 7,
    mode: 'mechanic-probe' as const,
    zoneId: 1,
    skillIds: [] as string[],
    steps: 40,
    inputs: [] as { step: number; manual: never }[],
    ...overrides,
  };
}

it('rejects invalid scenario references before running', () => {
  expect(() => runScenario(options({ zoneId: 999 }))).toThrow(/unknown zone/);
  expect(() => runScenario(options({ skillIds: ['test.unknown'] }))).toThrow(/unknown skill/);
  expect(() => runScenario(options({ inputs: [{ step: -1, manual: {} as never }] }))).toThrow(/non-negative/);
  expect(() => runScenario(options({ inputs: [{ step: 3, manual: {} as never }, { step: 3, manual: {} as never }] }))).toThrow(/strictly increasing/);
  expect(() => runScenario(options({ inputs: [{ step: 40, manual: {} as never }] }))).toThrow(/outside/);
});

it('keeps resources finite and bounded after each controlled/probe step', () => {
  const { state, arena, projections } = runScenario(options());
  expect(projections.length).toBe(40);
  expect(findNonFinite(projections)).toBeNull();
  expect(checkScenarioInvariants(state, arena)).toBeNull();
});

it('reports duplicate action ids as an invariant witness', () => {
  const encounter = seededEncounter({ seed: 7, zone: 1 });
  encounter.arena.actions.push(structuredClone(encounter.arena.actions[0] ?? { id: 1 }));
  const witness = checkScenarioInvariants(encounter.state, encounter.arena);
  if (encounter.arena.actions.length >= 2 && encounter.arena.actions[0].id === encounter.arena.actions[1].id) {
    expect(witness).toMatch(/duplicate action id/);
  } else {
    expect(witness).toBeNull();
  }
});

it('cannot resolve a synthetic skill removed before the case', () => {
  const { restore } = installSyntheticSkill('test.invariant.removed');
  restore();
  expect(sm.byId['test.invariant.removed']).toBeUndefined();
  expect(() => runScenario(options({ skillIds: ['test.invariant.removed'] }))).toThrow(/unknown skill/);
});

it('labels synthetic mechanics with test. IDs and restores them', () => {
  const { restore } = installSyntheticSkill('test.invariant.present');
  try {
    expect(sm.byId['test.invariant.present']).toBeTruthy();
  } finally {
    restore();
  }
  expect(sm.byId['test.invariant.present']).toBeUndefined();
});
