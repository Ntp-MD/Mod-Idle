import { schedulerBatch, tick, WAKE_SEC } from '@sim/core/game';
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

/**
 * The live game loop: one fixed tick, and the wake that converts real elapsed time into sim seconds
 * at the chosen speed. A throttled tab banks the time it actually missed.
 */
export function createGameLoop(ctx: LoopContext) {
  function step() {
    if (!ctx.transactionWriter) return;
    // `tick` mutates the state in place. `gameState` is a deep `$state` proxy, so its fine-grained
    // signals fire on their own — no need to clone the whole root and reassign, which used to
    // invalidate every `$derived` (bag sorts, character rebuild) once a second on an idle tick.
    const state = ctx.gameState;
    const dropsBefore = state.counters.drops;
    const wasDungeon = !!state.dungeon;
    // The avoid planner reads state, not settings: the loop mirrors the client switch
    // onto it every tick, so a flipped toggle takes effect on the next step.
    state.autoAvoidOff = ctx.settings.autoAvoid === false;
    tick(state, { autoSkills: ctx.settings.autoSkills !== false, ...(ctx.arenaMode ? { arena: ctx.combatArena, manual: ctx.arenaManual } : {}) });
    if (ctx.arenaMode) {
      ctx.syncArenaFocus();
      ctx.combatArena = { ...ctx.combatArena };
    }
    // Dungeon gear waits in escrow until payout; otherwise equip after each new gear roll.
    if (ctx.settings.autoEquip !== false && !state.dungeon && (state.counters.drops > dropsBefore || wasDungeon)) {
      ctx.equipCarriedBest();
    }
  }

  /** One wake: bank the elapsed time and run at most `MAX_BATCH` ticks. Exposed for tests. */
  function startWakeLoop(): () => void {
    let last = performance.now();
    const timer = setInterval(() => wake(performance.now()), WAKE_SEC * 1000);
    return () => clearInterval(timer);
  }

  let acc = 0;
  let last = 0;
  let started = false;
  function wake(now: number): void {
    if (!started) { started = true; last = now; return; }
    // a wake that ran late is measured, never assumed; the tab's own throttling is the only clock
    const elapsed = Math.max(0, (now - last) / 1000);
    last = now;
    if (!ctx.canWriteAccount || ctx.paused || !ctx.running) {
      // Earned whole seconds survive a pause: only the anchor moves, so paused wall time is never
      // simulated but a backlog banked before the pause is still paid out afterwards.
      ctx.cooldownSimRemainder = acc;
      ctx.cooldownSchedulerAt = now;
      return;
    }
    const batch = schedulerBatch(acc, ctx.speed, elapsed);
    acc = batch.acc;
    ctx.cooldownSimRemainder = acc;
    ctx.cooldownSchedulerAt = now;
    for (let i = 0; i < batch.ticks; i++) step();
  }

  return { step, startWakeLoop, wake };
}
