import { describe, expect, it } from 'vitest';
import { createGameLoop, type LoopContext } from '../../src/app/loop';
import { newGame } from '@sim/core/game';
import { createCombatArena } from '@sim/combat/combat-arena';

function harness(settings: Record<string, unknown> = { autoSkills: true, autoEquip: false }) {
  const state = newGame(9);
  let paused = false;
  let arena = createCombatArena();
  let arenaMode = false;
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
    set cooldownSimRemainder(_value: number) { /* display only */ },
    set cooldownSchedulerAt(_value: number) { /* display only */ },
    syncArenaFocus() { /* no arena */ },
    equipCarriedBest() { /* no gear */ },
  };
  return {
    ctx, state, arena: () => arena,
    setPaused: (value: boolean) => { paused = value; },
    setArenaMode: (value: boolean) => { arenaMode = value; },
  };
}

describe('the live wake keeps earned time through a pause', () => {
  it('pays a backlog banked before the pause instead of dropping it', () => {
    const { ctx, state, setPaused } = harness();
    const loop = createGameLoop(ctx);
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
    const loop = createGameLoop(ctx);
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

describe('the live loop advances combat in steps, not one second per step', () => {
  it('runs twenty 50 ms samples as one world second even when the arena view is replaced', () => {
    const { ctx, state, setArenaMode, arena } = harness();
    setArenaMode(true);
    const loop = createGameLoop(ctx);
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
