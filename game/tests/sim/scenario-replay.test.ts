import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { canonical } from '../../../tools/lib/measurement-output.mjs';
import { runScenario, projectArena } from '../../measurements/scenarios';
import { seededEncounter, encounterSignature } from '../../tests/fixtures/encounter';
import { installSyntheticSkill } from '../../tests/fixtures/skillFixture';
import { sm } from '../../src/engine/client';
import { createGameLoop } from '../../src/app/loop';
import { newGame, setLevel, stepCombat, tick, COMBAT_STEP_US, characterSheet, huntZone } from '../../src/sim/core/game';
import { createCombatArena } from '../../src/sim/combat/combat-arena';
import { DEFAULT_SETTINGS } from '../../src/state/save';

function digest(projections: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(canonical(projections))).digest('hex');
}

function baseOptions() {
  return { caseId: 'test.replay', seed: 7, mode: 'mechanic-probe' as const, zoneId: 1, skillIds: [] as string[], steps: 40, inputs: [] as { step: number; manual: never }[] };
}

it('REP-01: the same case/seed twice yields identical state and trace digests', () => {
  const first = runScenario(baseOptions());
  const second = runScenario(baseOptions());
  expect(digest(first.projections)).toBe(digest(second.projections));
  expect(first.completedSteps).toBe(second.completedSteps);
  expect(first.simulatedUs).toBe(second.simulatedUs);
});

it('REP-02: direct stepping matches createGameLoop.step() for equal steps', () => {
  const direct = runScenario(baseOptions());
  const state = newGame(7);
  setLevel(state, 60);
  huntZone(state, 1);
  state.autoAvoidOff = DEFAULT_SETTINGS.autoAvoid === false;
  state.player.hp = characterSheet(state).maxHp;
  state.player.mana = characterSheet(state).maxMana;
  const arena = createCombatArena();
  const ctx = {
    gameState: state, settings: DEFAULT_SETTINGS, transactionWriter: true, arenaMode: true,
    combatArena: arena, arenaManual: {}, running: true, paused: false, speed: 1,
    canWriteAccount: true, cooldownSimRemainder: 0, cooldownSchedulerAt: 0,
    syncArenaFocus() {}, equipCarriedBest() {},
  };
  const loop = createGameLoop(ctx, () => 0);
  let guard = 0;
  while (state.group.length < 1 && guard++ < 300) tick(state, { online: true, arena, autoSkills: false });
  for (let index = 0; index < 40; index++) loop.step();
  expect(digest([projectArena(state, arena)])).toBe(digest([direct.projections[direct.projections.length - 1]]));
  expect(direct.completedSteps).toBe(40);
});

it('REP-03: speeds 1/2/4 with equal simulated duration give equal results', () => {
  const results = [1, 2, 4].map((speed) => {
    const state = newGame(7);
    setLevel(state, 60);
    huntZone(state, 1);
    state.player.hp = characterSheet(state).maxHp;
    const arena = createCombatArena();
    let guard = 0;
    while (state.group.length < 1 && guard++ < 300) tick(state, { online: true, arena, autoSkills: false });
    const ctx = {
      gameState: state, settings: DEFAULT_SETTINGS, transactionWriter: true, arenaMode: true,
      combatArena: arena, arenaManual: {}, running: true, paused: false, speed,
      canWriteAccount: true, cooldownSimRemainder: 0, cooldownSchedulerAt: 0,
      syncArenaFocus() {}, equipCarriedBest() {},
    };
    let wall = 0;
    const loop = createGameLoop(ctx, () => wall);
    loop.wake(0);
    // Equal simulated duration (40 steps): wall elapsed grows with speed, so
    // the scheduler banks the same number of steps at every speed.
    const stepMs = COMBAT_STEP_US() / 1000;
    for (let index = 0; index < 40 / speed; index++) {
      wall += stepMs;
      loop.wake(wall);
    }
    return projectArena(state, arena);
  });
  expect(digest([results[0]])).toBe(digest([results[1]]));
  expect(digest([results[0]])).toBe(digest([results[2]]));
});

it('REP-04: pause/resume with an injected clock earns no paused duration', () => {
  const state = newGame(7);
  setLevel(state, 60);
  huntZone(state, 1);
  state.player.hp = characterSheet(state).maxHp;
  const arena = createCombatArena();
  let guard = 0;
  while (state.group.length < 1 && guard++ < 300) tick(state, { online: true, arena, autoSkills: false });
  const beforePause = state.clockSec;
  let wall = 0;
  let paused = false;
  const ctx = {
    gameState: state, settings: DEFAULT_SETTINGS, transactionWriter: true, arenaMode: true,
    combatArena: arena, arenaManual: {}, running: true, get paused() { return paused; }, speed: 1,
    canWriteAccount: true, cooldownSimRemainder: 0, cooldownSchedulerAt: 0,
    syncArenaFocus() {}, equipCarriedBest() {},
  };
  const loop = createGameLoop(ctx, () => wall);
  loop.wake(0);
  wall += COMBAT_STEP_US() / 1000;
  loop.wake(wall);
  paused = true;
  const clockAtPause = state.clockSec;
  wall += 60000; // 60 s of wall time while paused
  loop.wake(wall);
  expect(state.clockSec).toBe(clockAtPause);
  paused = false;
  wall += COMBAT_STEP_US() / 1000;
  loop.wake(wall);
  expect(state.clockSec).toBeGreaterThan(beforePause);
  // Only the earned steps were paid out: the 60 paused seconds were never simulated.
  expect(state.clockSec).toBeLessThan(beforePause + 60);
});

it('REP-05: changing one manual command reports the first differing step', () => {
  const without = runScenario(baseOptions());
  const withCommand = runScenario({
    ...baseOptions(),
    inputs: [{ step: 5, manual: { skillId: 'test.nonexistent' } as never }],
  });
  const firstDiffering = without.projections.findIndex((projection, index) => canonical(projection) !== canonical(withCommand.projections[index]));
  expect(firstDiffering).toBeGreaterThanOrEqual(0);
  expect(firstDiffering).toBeLessThanOrEqual(5);
});

it('REP-06: insufficient mana leaves payment and release state unchanged', () => {
  const { row, restore } = installSyntheticSkill('test.rep06.probe', { mana: '999999 flat' });
  try {
    const encounter = seededEncounter({ seed: 7, zone: 1, skills: [] });
    const manaBefore = encounter.state.player.mana;
    const actionsBefore = encounter.arena.actions.length;
    encounter.run(1, { tick: 0, manual: { skillId: 'test.rep06.probe', targetId: encounter.arena.focusId ?? undefined } as never });
    expect(row).toBeTruthy();
    expect(encounter.state.player.mana).toBe(manaBefore);
    // A refused cast releases no payload: no new action was committed for this skill.
    expect(encounter.arena.actions.filter((action) => action.skillId === 'test.rep06.probe')).toHaveLength(0);
    expect(encounter.arena.actions.length).toBeGreaterThanOrEqual(actionsBefore);
  } finally {
    restore();
  }
});

it('REP-07: removing a synthetic skill prevents the next case from resolving it', () => {
  const { restore } = installSyntheticSkill('test.rep07.probe');
  restore();
  expect(sm.byId['test.rep07.probe']).toBeUndefined();
  expect(() => runScenario({ ...baseOptions(), skillIds: ['test.rep07.probe'] })).toThrow(/unknown skill/);
});

it('REP-08: a deliberately corrupted resource fails the invariant check with a witness', async () => {
  const { checkScenarioInvariants } = await import('../../measurements/scenarios');
  const encounter = seededEncounter({ seed: 7, zone: 1 });
  encounter.state.player.hp = 1e12;
  const witness = checkScenarioInvariants(encounter.state, encounter.arena);
  expect(witness).toMatch(/hp out of bounds/);
});
