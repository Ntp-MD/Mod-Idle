import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COMBAT_STEP_US, characterSheet, newGame, setLevel, stepCombat, tick,
} from '@sim/core/game';
import { mobFixture, pinFieldPopulation } from '../fixtures/mobFixture';
import { exportJson, importJson } from '../../src/state/save';
import { installSyntheticSkill } from '../fixtures/skillFixture';

const FIELD = 'test.offline-checkpoint-field';
const BURST = 'test.offline-checkpoint-burst';
const RAY = 'test.offline-checkpoint-ray';
let restoreField: (() => void) | undefined;
let restoreBurst: (() => void) | undefined;
let restoreRay: (() => void) | undefined;

beforeEach(() => {
  restoreField = installSyntheticSkill(FIELD, {
    name: 'Checkpoint Field', type: 'attack', group: 'magic', element: 'fire',
    cd: 1, mana: '0 flat', basis: 'magic', offline_targets: '1',
    area: { origin: 'target', radius_m: 3 },
    cast: { delivery: 'ground', range_m: 5, windup_sec: 0.1, recovery_sec: 0.1 },
    action: { kind: 'meteor-field', interval_sec: 0.5, effect_policy: 'refresh-status' },
    duration: '3 sec',
    effects: [
      { stat: 'hits', op: 'add_flat', value: 6, subject: 'self' },
      { stat: 'burn_stacks', op: 'add_flat', value: 1, subject: 'target' },
    ],
    base_flat: 100, eff: 0,
  }).restore;
  restoreBurst = installSyntheticSkill(BURST, {
    name: 'Checkpoint Burst', type: 'attack', group: 'magic', element: 'lightning',
    cd: 3, mana: '0 flat', basis: 'magic', offline_targets: '1',
    area: { origin: 'target', radius_m: 0 },
    cast: { delivery: 'projectile', range_m: 6, windup_sec: 0.1, recovery_sec: 0.1,
      projectile_speed_mps: 4 },
    action: { kind: 'targeted-burst', tracking: 'homing', interval_sec: 0.5,
      roll_policy: 'independent', effect_policy: 'per-impact' },
    effects: [
      { stat: 'hits', op: 'add_flat', value: 3, subject: 'self' },
      { stat: 'hit_pct', op: 'add_pct', value: 40, subject: 'self' },
      { stat: 'shock_chance', op: 'add_pct', value: 100, subject: 'target' },
    ],
    base_flat: 100, eff: 0,
  }).restore;
  restoreRay = installSyntheticSkill(RAY, {
    name: 'Checkpoint Ray', type: 'attack', group: 'magic', element: 'chaos',
    cd: 5, mana: '0 flat', basis: 'magic', offline_targets: '1',
    area: { origin: 'caster', radius_m: 0, shape: 'line', length_m: 6, width_m: 1 },
    cast: { delivery: 'projectile', range_m: 6, windup_sec: 0.1, recovery_sec: 0.1 },
    action: { kind: 'ray-channel', interval_sec: 0.5, active_sec: 3, effect_policy: 'refresh-status' },
    channel: { mana_per_sec: 1 }, duration: '3 sec',
    effects: [
      { stat: 'hits', op: 'add_flat', value: 6, subject: 'self' },
      { stat: 'mark_stacks', op: 'add_flat', value: 1, subject: 'target' },
    ],
    base_flat: 100, eff: 0,
  }).restore;
});

afterEach(() => {
  restoreRay?.();
  restoreBurst?.();
  restoreField?.();
  restoreRay = undefined;
  restoreBurst = undefined;
  restoreField = undefined;
});

function offlineFight(id: string) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  state.group = [mobFixture({
    id: 'checkpoint-target', hp: 1e9, hpMax: 1e9, ps: 0, evasion: 0, dodgeRate: 0,
    armour: 0, res: 0, innate: [], skillIds: [], line: 'front',
  })];
  state.skills.owned[id] = 0;
  state.skills.list.fill(null);
  state.skills.list[0] = id;
  state.player.mana = characterSheet(state).maxMana;
  pinFieldPopulation(state);
  // The offline arena reads slot homes; keep the lone body in front of the caster so a line row
  // (Void Ray shape) can acquire it without changing the production field logic.
  const anchor = state.field!.farmingAnchor;
  state.field!.slots[0].home = { x: anchor.x + 1, y: anchor.y };
  return state;
}

function shot(state: ReturnType<typeof offlineFight>): string {
  state.lastSavedAt = 0;
  return JSON.stringify(state);
}

function untilPending(state: ReturnType<typeof offlineFight>, limit = 12): void {
  for (let second = 0; second < limit && !state.pendingWork; second++) tick(state, { online: false });
  expect(state.pendingWork).not.toBeNull();
}

function ledgerString(value: unknown): string | null {
  return value && typeof value === 'object'
    && Array.isArray((value as any).flights) && Array.isArray((value as any).actors)
    && Number.isFinite((value as any).clockUs)
    ? JSON.stringify(value)
    : null;
}

function isNonEmptyLedger(value: unknown): boolean {
  return !!value && typeof value === 'object'
    && Array.isArray((value as any).flights) && Array.isArray((value as any).actors)
    && Number.isFinite((value as any).clockUs)
    && ((value as any).flights.length > 0 || (value as any).actors.length > 0);
}

function countPublished(run: () => void): number {
  const original = JSON.stringify;
  let count = 0;
  JSON.stringify = ((value: unknown) => {
    if (isNonEmptyLedger(value)) count++;
    return original(value);
  }) as typeof JSON.stringify;
  try {
    run();
  } finally {
    JSON.stringify = original;
  }
  return count;
}

const stepsPerSecond = () => Math.max(1, Math.round(1_000_000 / COMBAT_STEP_US()));

describe('offline publication boundary', () => {
  it.each([FIELD, BURST, RAY])('matches one tick with public steps at every partial offset (%s)', (id) => {
    const steps = stepsPerSecond();
    let sawLedger = false;
    for (let offset = 0; offset < steps; offset++) {
      const whole = offlineFight(id);
      const sliced = offlineFight(id);
      for (let index = 0; index < offset; index++) {
        stepCombat(whole, { online: false });
        stepCombat(sliced, { online: false });
      }
      expect(shot(whole)).toBe(shot(sliced));
      tick(whole, { online: false });
      for (let index = offset; index < steps; index++) stepCombat(sliced, { online: false });
      for (let second = 0; second < 3; second++) {
        expect(shot(sliced), `offset ${offset}, second ${second}`).toBe(shot(whole));
        expect(sliced.pendingWork, `offset ${offset}, second ${second}`).toEqual(whole.pendingWork);
        if (whole.pendingWork) sawLedger = true;
        if (second < 2) {
          tick(whole, { online: false });
          for (let index = 0; index < steps; index++) stepCombat(sliced, { online: false });
        }
      }
    }
    expect(sawLedger).toBe(true);
  });

  it('round-trips a public partial step and continues both imports exactly', () => {
    const source = offlineFight(FIELD);
    untilPending(source);
    for (let index = 0; index < 3; index++) stepCombat(source, { online: false });
    const saved = exportJson(source);
    const direct = importJson(saved);
    const loaded = importJson(saved);
    expect(loaded.pendingWork).toEqual(source.pendingWork);
    tick(direct, { online: false });
    tick(loaded, { online: false });
    expect(shot(loaded)).toBe(shot(direct));
    expect(loaded.pendingWork).toEqual(direct.pendingWork);
  });

  it('keeps a published ledger detached from later live mutations', () => {
    const state = offlineFight(FIELD);
    untilPending(state);
    const before = ledgerString(state.pendingWork);
    expect(before).not.toBeNull();
    state.player.mana = 0;
    state.player.hp = 1;
    state.group[0].hp = 1;
    state.group[0].evasion = 1e9;
    expect(ledgerString(state.pendingWork)).toBe(before);
  });

  it('publishes null after the last impact, not a stale ledger', () => {
    const state = offlineFight(FIELD);
    let sawPending = false;
    let cleared = false;
    for (let second = 0; second < 12; second++) {
      tick(state, { online: false });
      if (state.pendingWork) sawPending = true;
      if (sawPending && !state.pendingWork) { cleared = true; break; }
    }
    expect(sawPending).toBe(true);
    expect(cleared).toBe(true);
    expect(state.pendingWork).toBeNull();
  });

  it('serializes a completed tick at most once and every public step at its own boundary', () => {
    const warm = (id: string) => {
      const state = offlineFight(id);
      untilPending(state);
      return state;
    };
    const tickState = warm(RAY);
    const tickCalls = countPublished(() => tick(tickState, { online: false }));
    expect(tickCalls).toBe(1);

    const stepState = warm(RAY);
    const stepCalls = countPublished(() => {
      for (let index = 0; index < stepsPerSecond(); index++) stepCombat(stepState, { online: false });
    });
    expect(stepCalls).toBeGreaterThan(1);
    expect(stepCalls).toBeLessThanOrEqual(stepsPerSecond());
  });

  it('writes the same count on a partial step as before the batching change', () => {
    // Public steps still publish every completed boundary; the count is the number of calls, not
    // one per world second.
    const state = offlineFight(FIELD);
    const calls = countPublished(() => {
      for (let index = 0; index < stepsPerSecond(); index++) stepCombat(state, { online: false });
    });
    expect(calls).toBeLessThanOrEqual(stepsPerSecond());
  });
});
