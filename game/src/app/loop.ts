import { COMBAT_STEP_US, schedulerSteps, stepCombat } from '@sim/core/game';
import { equipWindowOpen } from '../ui/combat/equip-policy';
import type { GameState } from '@sim/core/types';
import type { CombatArena } from '@sim/combat/combat-arena';
import type { ManualControl } from '@sim/combat/combat-actions';
import type { ClientSettings } from '../state/save';

/** The shell state the fixed tick reads; App owns the runes. */
export interface LoopContext {
  get gameState(): GameState;
  get settings(): ClientSettings;
  get transactionWriter(): boolean;
  get arenaMode(): boolean;
  get combatArena(): CombatArena;
  set combatArena(value: CombatArena);
  get arenaManual(): ManualControl;
  get running(): boolean;
  get paused(): boolean;
  get speed(): number;
  get canWriteAccount(): boolean;
  set cooldownSimRemainder(value: number);
  set cooldownSchedulerAt(value: number);
  syncArenaFocus(): void;
  equipCarriedBest(): void;
}

/** The live step in wall milliseconds: the sim's own authored combat step, never a timer constant. */
export const LIVE_STEP_MS = (): number => Math.max(16, COMBAT_STEP_US() / 1000);

/**
 * The live game loop: one 50 ms combat step, and the wake that converts real elapsed time into
 * steps at the chosen speed. A command is judged inside the step it arrives in, so input never
 * waits for a whole world second. A throttled tab banks the time it actually missed.
 */
export function createGameLoop(ctx: LoopContext, readWallMs: () => number = () => performance.now()) {
  /** A gear roll that arrived inside a committed action waits for the next free sample. */
  let equipPending = false;
  function step() {
    if (!ctx.transactionWriter) return;
    // `stepCombat` mutates the state in place. `gameState` is a deep `$state` proxy, so its
    // fine-grained signals fire on their own — no need to clone the whole root and reassign, which
    // used to invalidate every `$derived` (bag sorts, character rebuild) once a second.
    const state = ctx.gameState;
    const dropsBefore = state.counters.drops;
    const wasDungeon = !!state.dungeon;
    // The avoid planner reads state, not settings: the loop mirrors the client switch
    // onto it every step, so a flipped toggle takes effect on the next sample.
    state.autoAvoidOff = ctx.settings.autoAvoid === false;
    stepCombat(state, { autoSkills: ctx.settings.autoSkills !== false, ...(ctx.arenaMode ? { arena: ctx.combatArena, manual: ctx.arenaManual } : {}) });
    // The arena is a live object: the scene samples it on its own render clock. Replacing the
    // `$state.raw` value every 50 ms would invalidate the whole scene twenty times a second for
    // no new fact, so only the focus pin is synchronized here.
    if (ctx.arenaMode) ctx.syncArenaFocus();
    // Dungeon gear waits in escrow until payout; otherwise equip after each new gear roll, but
    // never inside a committed action. A deferred drop stays pending until the feet are free.
    if (ctx.settings.autoEquip !== false && !state.dungeon
      && (state.counters.drops > dropsBefore || wasDungeon)) equipPending = true;
    if (equipPending && (ctx.settings.autoEquip === false || state.dungeon)) equipPending = false;
    if (equipPending && equipWindowOpen(ctx.arenaMode ? ctx.combatArena : undefined)) {
      ctx.equipCarriedBest();
      equipPending = false;
    }
  }

  /** One wake: bank the elapsed time and run at most eight simulated seconds of steps. */
  function startWakeLoop(): () => void {
    const timer = setInterval(() => wake(readWallMs()), LIVE_STEP_MS());
    return () => clearInterval(timer);
  }

  let acc = 0;
  let last = 0;
  let started = false;
  /** A reset owns a new run: drop banked elapsed time so the old run cannot land in the new one. */
  function restart(): void { acc = 0; last = 0; started = false; }
  function wake(now: number): void {
    if (!started) { started = true; last = now; return; }
    // a wake that ran late is measured, never assumed; the tab's own throttling is the only clock
    const elapsed = Math.max(0, (now - last) / 1000);
    last = now;
    if (!ctx.canWriteAccount || ctx.paused || !ctx.running) {
      // Earned steps survive a pause: only the anchor moves, so paused wall time is never
      // simulated but a backlog banked before the pause is still paid out afterwards.
      ctx.cooldownSimRemainder = acc;
      ctx.cooldownSchedulerAt = now;
      return;
    }
    const stepSec = COMBAT_STEP_US() / 1_000_000;
    const batch = schedulerSteps(acc, ctx.speed, elapsed, stepSec);
    const beganAt = readWallMs();
    const budgetMs = LIVE_STEP_MS();
    let completed = 0;
    while (completed < batch.steps) {
      step();
      completed++;
      // A slow frame must give input and rendering another turn. Keep every unexecuted step
      // as simulation debt instead of attempting the entire backlog in one browser task.
      if (readWallMs() - beganAt >= budgetMs) break;
    }
    acc = batch.acc + (batch.steps - completed) * stepSec;
    ctx.cooldownSimRemainder = acc;
    ctx.cooldownSchedulerAt = now;
  }

  return { step, startWakeLoop, wake, restart };
}
