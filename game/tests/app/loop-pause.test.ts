import { describe, expect, it, vi } from 'vitest';
import { createGameLoop, LIVE_STEP_MS, type LoopContext } from '../../src/app/loop';
import { previewTick, planSteps, runWorkSlice } from '../../src/app/scheduler';
import { COMBAT_STEP_US, MAX_WORK_SLICE_MS, newGame } from '@sim/core/game';
import { createCombatArena } from '@sim/combat/combat-arena';

function harness(settings: Record<string, unknown> = { autoSkills: true, autoEquip: false }) {
  const state = newGame(9);
  let paused = false;
  let arena = createCombatArena();
  let arenaMode = false;
  let remainder = 0;
  let schedulerAt = 0;
  const ctx: LoopContext = {
    get gameState() { return state; },
    get settings() { return settings as never; },
    get transactionWriter() { return true; },
    get arenaMode() { return arenaMode; },
    get combatArena() { return arena; },
    set combatArena(value) { arena = value; },
    get arenaManual() { return {}; },
    get running() { return true; },
    get paused() { return paused; },
    get speed() { return 1; },
    get canWriteAccount() { return true; },
    set cooldownSimRemainder(value: number) { remainder = value; },
    set cooldownSchedulerAt(value: number) { schedulerAt = value; },
    syncArenaFocus() { /* no arena */ },
    equipCarriedBest() { /* no gear */ },
  };
  return {
    ctx, state, arena: () => arena, remainder: () => remainder, schedulerAt: () => schedulerAt,
    setPaused: (value: boolean) => { paused = value; },
    setArenaMode: (value: boolean) => { arenaMode = value; },
  };
}

describe('the live wake keeps earned time through a pause', () => {
  it('yields after a slow step and pays every deferred step after a pause without counting paused time', () => {
    const { ctx, state, setPaused, setArenaMode, arena, remainder, schedulerAt } = harness();
    setArenaMode(true);
    let wallMs = 0;
    let workMs = LIVE_STEP_MS() * 2;
    let completed = 0;
    ctx.syncArenaFocus = () => { completed++; wallMs += workMs; };
    const loop = createGameLoop(ctx, () => wallMs);
    const stepUs = COMBAT_STEP_US();
    const stepMs = stepUs / 1000;
    const stepSec = stepUs / 1_000_000;
    const owedSteps = 20;
    const initialMs = (owedSteps + 0.5) * stepMs;
    const pausedUntil = initialMs + 100 * stepMs;
    const resumedAt = pausedUntil + stepMs;
    const earnedSec = initialMs / 1000 + stepSec;
    loop.wake(0);
    loop.wake(initialMs);

    // Every callback follows a real combat step. One slow step must return control instead of
    // running the other nineteen owed steps in the same blocked browser task.
    expect(completed).toBe(1);
    expect(arena().nowUs).toBe(stepUs);
    expect(remainder()).toBeCloseTo(initialMs / 1000 - stepSec, 10);
    expect(schedulerAt()).toBe(initialMs);

    setPaused(true);
    loop.wake(pausedUntil);
    expect(completed).toBe(1);
    expect(remainder()).toBeCloseTo(initialMs / 1000 - stepSec, 10);
    setPaused(false);
    loop.wake(resumedAt);
    expect(completed).toBe(2);
    expect(remainder()).toBeCloseTo(earnedSec - 2 * stepSec, 10);

    // Once the machine is fast again, a wake at the same wall instant drains the existing debt.
    // Paused time earned nothing, and no yielded step or fractional remainder disappeared.
    workMs = 0;
    loop.wake(resumedAt);
    expect(completed).toBe(owedSteps + 1);
    expect(arena().nowUs).toBe(completed * stepUs);
    expect(remainder()).toBeCloseTo(stepSec / 2, 10);
    expect(completed * stepSec + remainder()).toBeCloseTo(earnedSec, 10);
    const control = harness();
    const fast = createGameLoop(control.ctx);
    for (let i = 0; i < completed; i++) fast.step();
    expect(state.clockSec).toBe(control.state.clockSec);
    expect(state.counters.playSec).toBe(control.state.counters.playSec);
  });

  it('pays a backlog banked before the pause instead of dropping it', () => {
    const { ctx, state, setPaused } = harness();
    const loop = createGameLoop(ctx, () => 0);
    loop.wake(0);                 // anchor
    loop.wake(60_000);            // a 60 s stall: at most MAX_BATCH ticks run, the rest banks
    const afterStall = state.clockSec;
    expect(afterStall).toBeGreaterThan(0);

    setPaused(true);
    loop.wake(60_250);
    setPaused(false);
    loop.wake(60_500);

    expect(state.clockSec).toBeGreaterThan(afterStall);
  });

  it('does not simulate the paused wall time itself', () => {
    const { ctx, state, setPaused } = harness();
    const loop = createGameLoop(ctx, () => 0);
    loop.wake(0);
    loop.wake(250);
    const before = state.clockSec;
    setPaused(true);
    for (let at = 500; at <= 10_000; at += 250) loop.wake(at);
    setPaused(false);
    loop.wake(10_250);
    // one second of the pause's 9.75 s may be paid at most; never the whole pause
    expect(state.clockSec - before).toBeLessThan(3);
  });
});

describe('the live loop stops at an 8 ms work slice', () => {
  it('runs three 3 ms steps, or one 20 ms step, then yields with the remaining debt', () => {
    const fast = harness();
    fast.setArenaMode(true);
    let fastWall = 0, fastCompleted = 0;
    fast.ctx.syncArenaFocus = () => { fastCompleted++; fastWall += 3; };
    const fastLoop = createGameLoop(fast.ctx, () => fastWall);
    fastLoop.wake(0);
    fastLoop.wake(1000);
    expect(fastCompleted).toBe(3);
    expect(fast.remainder()).toBeCloseTo((20 - 3) * COMBAT_STEP_US() / 1_000_000, 10);

    const slow = harness();
    slow.setArenaMode(true);
    let slowWall = 0, slowCompleted = 0;
    slow.ctx.syncArenaFocus = () => { slowCompleted++; slowWall += 20; };
    const slowLoop = createGameLoop(slow.ctx, () => slowWall);
    slowLoop.wake(0);
    slowLoop.wake(1000);
    expect(slowCompleted).toBe(1);
    expect(slow.remainder()).toBeCloseTo((20 - 1) * COMBAT_STEP_US() / 1_000_000, 10);
    expect(MAX_WORK_SLICE_MS).toBe(8);
  });

  it('queues one continuation for a 60-second stall, pays debt at unchanged time, and cleans up', async () => {
    vi.useFakeTimers();
    try {
      const { ctx, state, setArenaMode } = harness();
      setArenaMode(true);
      let wall = 0, completed = 0, costSteps = true;
      ctx.syncArenaFocus = () => { completed++; if (costSteps) wall += 3; };
      const loop = createGameLoop(ctx, () => wall);
      const stop = loop.startWakeLoop();
      loop.wake(0);
      wall = 60_000;
      loop.wake(wall);
      expect(completed).toBe(3);
      // The interval plus at most one continuation, never one timer per owed step.
      expect(vi.getTimerCount()).toBeLessThanOrEqual(2);
      const owedBefore = state.clockSec;
      costSteps = false;
      wall = 60_000; // same wall instant: the continuation pays debt, it earns no new time
      await vi.advanceTimersByTimeAsync(0);
      expect(completed).toBeGreaterThan(3);
      expect(state.clockSec).toBeGreaterThan(owedBefore);
      stop();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('restart clears a queued continuation so an old run cannot advance', async () => {
    vi.useFakeTimers();
    try {
      const { ctx, state, setArenaMode } = harness();
      setArenaMode(true);
      let wall = 0;
      ctx.syncArenaFocus = () => { wall += 3; };
      const loop = createGameLoop(ctx, () => wall);
      const stop = loop.startWakeLoop();
      loop.wake(0);
      loop.wake(60_000);
      const clock = state.clockSec;
      loop.restart();
      await vi.advanceTimersByTimeAsync(0);
      expect(state.clockSec).toBe(clock);
      stop();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the live loop advances combat in steps, not one second per step', () => {
  it('runs twenty 50 ms samples as one world second even when the arena view is replaced', () => {
    const { ctx, state, setArenaMode, arena } = harness();
    setArenaMode(true);
    const loop = createGameLoop(ctx, () => 0);
    loop.wake(0);
    const before = state.clockSec;
    loop.wake(1000);
    // A decision that restarted the second on every Svelte copy would advance twenty seconds.
    expect(state.clockSec - before).toBeLessThanOrEqual(1);
    expect(state.clockSec - before).toBeGreaterThan(0);
    // The presentation copy is the same encounter, so its released work is still on one arena.
    expect(arena().frames.length).toBeGreaterThan(0);
  });
});

describe('the live loop carries the auto-avoid switch into the sim', () => {
  it('mirrors the client setting onto the state the avoid planner reads', () => {
    const on = harness({ autoSkills: true, autoAvoid: true });
    createGameLoop(on.ctx).step();
    expect(on.state.autoAvoidOff).toBe(false);
    const off = harness({ autoSkills: true, autoAvoid: false });
    createGameLoop(off.ctx).step();
    expect(off.state.autoAvoidOff).toBe(true);
  });
});

describe('preview shares mechanics but caps elapsed and discards debt', () => {
  it('caps a long stall, discards while paused/hidden, and agrees with schedulerSteps', () => {
    const state = { acc: 0, previous: 0 };
    // Long stall capped at 0.5s: debt is capped, not banked live-style.
    const capped = previewTick(state, 60_000, { running: true, paused: false, hidden: false, speed: 1 });
    const viaPlan = planSteps(0, 1, 0.5);
    expect(capped.steps).toBe(viaPlan.steps);
    expect(state.acc).toBeCloseTo(viaPlan.acc, 10);
    // Paused: debt dropped, previous still advances so no catch-up backlog.
    const dropped = previewTick(state, 60_250, { running: true, paused: true, hidden: false, speed: 1 });
    expect(dropped.steps).toBe(0);
    expect(state.acc).toBe(0);
    // Hidden: same discard.
    state.acc = 0.5;
    const hid = previewTick(state, 60_500, { running: true, paused: false, hidden: true, speed: 1 });
    expect(hid.steps).toBe(0);
    expect(state.acc).toBe(0);
    // Stopped: same discard.
    state.acc = 0.5;
    const stopped = previewTick(state, 60_750, { running: false, paused: false, hidden: false, speed: 1 });
    expect(stopped.steps).toBe(0);
    expect(state.acc).toBe(0);
    // Speed scales.
    const fast = { acc: 0, previous: 0 };
    const base = previewTick({ acc: 0, previous: 0 }, 500, { running: true, paused: false, hidden: false, speed: 1 });
    const sped = previewTick(fast, 500, { running: true, paused: false, hidden: false, speed: 4 });
    expect(sped.steps).toBe(base.steps * 4);
  });

  it('runWorkSlice yields at 8 ms with unpaid debt retained and no double step', () => {
    let wall = 0;
    let calls = 0;
    const readWall = () => wall;
    const runStep = () => { calls++; wall += 3; };
    const out = runWorkSlice(20, readWall, runStep);
    expect(out.completed).toBe(3);
    expect(calls).toBe(3);
    expect(out.elapsedMs).toBeGreaterThanOrEqual(MAX_WORK_SLICE_MS);
    // Remaining debt is retained by the caller (live keeps acc, preview resets).
    const retained = 20 - out.completed;
    expect(retained).toBe(17);
  });
});
