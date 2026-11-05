import { COMBAT_STEP_US, characterSheet, huntZone, newGame, setLevel, stepCombat, tick } from '@sim/core/game';
import { createCombatArena } from '@sim/combat/combat-arena';
import type { CombatArena } from '@sim/combat/combat-arena';
import type { ManualControl } from '@sim/combat/combat-actions';
import { grantNamedSkill } from '@sim/combat/skills';
import { settlementOfZone } from '@sim/town/town';
import { sm, E } from '../src/engine/client';
import type { GameState } from '@sim/core/types';
import { DEFAULT_SETTINGS } from '../src/state/save';

export interface StepInput {
  step: number;
  manual: ManualControl;
}

export interface ScenarioOptions {
  caseId: string;
  seed: number;
  mode: 'mechanic-probe' | 'simulation-benchmark' | 'controlled-build';
  zoneId: number;
  skillIds: string[];
  steps: number;
  inputs: StepInput[];
}

export interface ScenarioResult {
  state: GameState;
  arena: CombatArena;
  projections: unknown[];
  completedSteps: number;
  simulatedUs: number;
}

function validateOptions(options: ScenarioOptions): void {
  if (!options.caseId) throw new Error('runScenario: caseId is required');
  if (!Number.isInteger(options.seed)) throw new Error('runScenario: seed must be an integer');
  if (!['mechanic-probe', 'simulation-benchmark', 'controlled-build'].includes(options.mode)) {
    throw new Error(`runScenario: unknown mode ${options.mode}`);
  }
  const zones = (E.mob.zones as { id: number }[]).map((zone) => zone.id);
  if (!zones.includes(options.zoneId)) throw new Error(`runScenario: unknown zone ${options.zoneId}`);
  for (const skillId of options.skillIds) {
    if (!sm.byId[skillId]) throw new Error(`runScenario: unknown skill ${skillId}`);
  }
  if (!Number.isInteger(options.steps) || options.steps < 0) throw new Error('runScenario: steps must be a non-negative integer');
  let last = -1;
  for (const input of options.inputs) {
    if (!Number.isInteger(input.step) || input.step < 0) throw new Error('runScenario: input step must be a non-negative integer');
    if (input.step <= last) throw new Error('runScenario: inputs must be in strictly increasing step order');
    if (input.step >= options.steps) throw new Error(`runScenario: input step ${input.step} is outside the scenario`);
    last = input.step;
    if (input.manual == null) throw new Error('runScenario: input manual is required');
  }
}

/**
 * One authored combat step per scenario step. Step length derives from
 * `COMBAT_STEP_US()`; no copied 50 ms constant. A manual command is supplied
 * on its designated step only. Inputs are cloned so mutation cannot change
 * the replay fixture.
 */
export function runScenario(options: ScenarioOptions): ScenarioResult {
  validateOptions(options);
  const state = newGame(options.seed);
  setLevel(state, 60);
  const settlement = settlementOfZone(options.zoneId);
  if (!settlement) throw new Error(`runScenario: unknown zone ${options.zoneId}`);
  if (!state.town.visited.includes(settlement.id)) state.town.visited.push(settlement.id);
  const hunted = huntZone(state, options.zoneId);
  if (!hunted.ok) throw new Error(`runScenario: cannot hunt zone ${options.zoneId}: ${hunted.why ?? 'refused'}`);
  // Mechanic probes and benchmarks control their own resource baseline; controlled builds do not top up.
  if (options.mode !== 'controlled-build') {
    const sheet = characterSheet(state);
    state.player.hp = sheet.maxHp;
    state.player.mana = sheet.maxMana;
  }
  state.autoAvoidOff = DEFAULT_SETTINGS.autoAvoid === false;
  for (const skillId of options.skillIds) grantNamedSkill(state.skills, skillId);
  const arena = createCombatArena();
  let guard = 0;
  while (state.group.length < 1 && guard++ < 300) tick(state, { online: true, arena, autoSkills: false });
  const inputs = structuredClone(options.inputs);
  const inputByStep = new Map(inputs.map((input) => [input.step, input.manual]));
  const projections: unknown[] = [];
  for (let step = 0; step < options.steps; step++) {
    const manual = inputByStep.get(step);
    stepCombat(state, {
      arena,
      autoSkills: DEFAULT_SETTINGS.autoSkills,
      holdPosition: DEFAULT_SETTINGS.holdPosition,
      targetPriority: DEFAULT_SETTINGS.targetPriority,
      manual: manual ?? {},
    });
    projections.push(projectArena(state, arena));
  }
  return { state, arena, projections, completedSteps: options.steps, simulatedUs: options.steps * COMBAT_STEP_US() };
}

/** Exact arena projection: simulation clock, player, mobs by ID, intent, actions, flights, channel, navigation. */
export function projectArena(state: GameState, arena: CombatArena): unknown {
  void state;
  const mobs = Object.keys(arena.mobs).sort().map((id) => (arena.mobs as Record<string, unknown>)[id]);
  return {
    nowUs: arena.nowUs,
    player: arena.player,
    mobs,
    intent: arena.intent ?? null,
    actions: arena.actions,
    flights: arena.flights,
    channelTemplate: arena.channelTemplate ?? null,
    nav: arena.nav ?? null,
  };
}

/** Finite-number check over the inspected resource/damage/timer/position fields. */
export function findNonFinite(value: unknown, path = '$'): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? null : path;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const found = findNonFinite(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const found = findNonFinite(entry, `${path}.${key}`);
      if (found) return found;
    }
    return null;
  }
  return null;
}

/** Invariant check run after each controlled/probe step. Returns a witness or null. */
export function checkScenarioInvariants(state: GameState, arena: CombatArena): string | null {
  const sheet = characterSheet(state);
  if (state.player.hp < 0 || state.player.hp > sheet.maxHp) {
    return `hp out of bounds: ${state.player.hp} (max ${sheet.maxHp})`;
  }
  if (state.player.mana < 0 || state.player.mana > sheet.maxMana) {
    return `mana out of bounds: ${state.player.mana} (max ${sheet.maxMana})`;
  }
  const nonFinite = findNonFinite(projectArena(state, arena));
  if (nonFinite) return `nonfinite value at ${nonFinite}`;
  const seen = new Set<number>();
  for (const action of arena.actions) {
    if (seen.has(action.id)) return `duplicate action id ${action.id}`;
    seen.add(action.id);
  }
  return null;
}
