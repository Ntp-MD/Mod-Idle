/**
 * Combat events inside the one-second world tick.
 *
 * The world still advances in fixed seconds; what this module adds is a monotone, absolute integer
 * microsecond clock for the events inside that second, so a half-second ICD, a two-second deferred
 * hit or a stop that begins mid-tick can be represented without changing the world rate. Events are
 * ordered by (atUs, priority, actorId, targetId, sequence) and the tie-break is stable across a
 * reload because every field is stored or rebuilt deterministically.
 *
 * Pure: no RNG, no DOM, no data imports.
 */

/** The §7.1 priority ladder — lower runs first when two events share a timestamp. */
export const EVENT_PRIORITY = {
  /** 0 · expire buffs, control and ICDs */
  expire: 0,
  /** 10 · pending damage: DoT, Stagger, deferred hits */
  pendingDamage: 10,
  /** 20 · DoT expiry and decay, after the last payment */
  dotExpiry: 20,
  /** 30 · the player's primary action */
  playerAction: 30,
  /** 40 · a mob's primary action */
  mobAction: 40,
  /** 50 · queued secondary and triggered casts */
  secondary: 50,
  /** 60 · scheduled recovery */
  recovery: 60,
} as const;

export type EventPriority = (typeof EVENT_PRIORITY)[keyof typeof EVENT_PRIORITY];

export interface CombatEvent {
  atUs: number;
  priority: number;
  actorId: string;
  targetId: string;
  seq: number;
  run: () => void;
}

/** The §7.1 comparator, exported so a test can prove the tie-break without a clock. */
export function compareEvents(a: CombatEvent, b: CombatEvent): number {
  if (a.atUs !== b.atUs) return a.atUs - b.atUs;
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (a.actorId !== b.actorId) return a.actorId < b.actorId ? -1 : 1;
  if (a.targetId !== b.targetId) return a.targetId < b.targetId ? -1 : 1;
  return a.seq - b.seq;
}

/**
 * One tick window's event queue. Events stamped at or before the window end run in this tick; an
 * event stamped past it stays queued (the attack queue is rebuilt from `attackProgress` at the next
 * boundary, so nothing is double counted).
 *
 * `haltWhen` is the Push latch (§7.7): after each event the character's pools are read, and a pool
 * that has reached zero stops every later event of the tick — no heal may revive a fatal hit.
 */
export class CombatClock {
  /** The start of the window in absolute µs; each executed event moves it forward. */
  nowUs: number;
  private readonly untilUs: number;
  private readonly haltWhen: (() => boolean) | null;
  private events: CombatEvent[] = [];
  private seq = 0;

  constructor(startUs: number, untilUs: number, haltWhen?: () => boolean) {
    this.nowUs = startUs;
    this.untilUs = untilUs;
    this.haltWhen = haltWhen ?? null;
  }

  /** True once the Push latch or a caller's stop ended the window early. */
  halted = false;

  /**
   * Queue one event. A time before the current cursor is clamped to it — an event can never run in
   * the past. The sequence number is assigned here, at schedule time, so two events scheduled by the
   * same handler keep the order that handler created them in.
   */
  schedule(atUs: number, priority: number, actorId: string, targetId: string, run: () => void): void {
    if (this.halted) return;
    this.events.push({
      atUs: Math.max(this.nowUs, Math.ceil(atUs)),
      priority,
      actorId,
      targetId,
      seq: this.seq++,
      run,
    });
  }

  /** Move this actor's pending actions and telegraphs together; elapsed events stay spent. */
  delayActor(actorId: string, delayUs: number): void {
    for (const event of this.events) {
      if (event.actorId === actorId && event.priority === EVENT_PRIORITY.mobAction)
        event.atUs += Math.max(0, Math.ceil(delayUs));
    }
  }

  /** The earliest pending event, or null. Sorting is on demand: a tick holds a handful of events. */
  private next(): CombatEvent | null {
    let best: CombatEvent | null = null;
    for (const e of this.events) if (best === null || compareEvents(e, best) < 0) best = e;
    return best;
  }

  /** Stop the window (Push latch or an explicit caller stop). No queued event runs afterwards. */
  stop(): void {
    this.halted = true;
  }

  /**
   * Run every event due in (start, untilUs], in order, until the window is empty or the latch trips.
   * Returns true when the window completed without halting.
   */
  runUntil(endUs: number = this.untilUs): boolean {
    while (!this.halted) {
      const next = this.next();
      if (!next || next.atUs > endUs) break;
      this.events = this.events.filter((e) => e !== next);
      this.nowUs = next.atUs;
      next.run();
      if (this.haltWhen?.()) {
        this.halted = true;
        break;
      }
    }
    if (!this.halted) this.nowUs = Math.max(this.nowUs, endUs);
    return !this.halted;
  }
}

export interface AttackPlan {
  /** Absolute µs of each attack that lands inside the window, in order. */
  times: number[];
  /** The accumulated attack progress carried into the next window (always below 1). */
  progressAtEnd: number;
}

/**
 * Expand one window of attacks from `progress` (§7.1): progress is "attacks accumulated", a hit
 * fires at the moment it reaches 1 and then loses exactly 1. The k-th hit lands after
 * `ceil((k - progress) / rate × unitsPerSec)` µs, so the plan never drifts: every time is computed
 * from the window's start, and an event exactly at the window end still belongs to this tick.
 */
export function planAttacks(
  startUs: number,
  progress: number,
  rate: number,
  unitsPerSec: number,
  windowUs: number = unitsPerSec,
): AttackPlan {
  if (!(rate > 0) || !(unitsPerSec > 0)) return { times: [], progressAtEnd: progress };
  // progress may be negative: a caller that parks the clock keeps subtracting, and an attack only
  // exists when the running total reaches 1.
  const p = progress;
  const count = Math.max(0, Math.floor(p + rate));
  const times: number[] = [];
  for (let k = 1; k <= count; k++) times.push(startUs + Math.ceil(((k - p) / rate) * unitsPerSec));
  return { times, progressAtEnd: p + rate - count };
}

/**
 * A stop that begins or ends inside the window splits the attack accumulation: no progress is made
 * while the actor cannot act, and it resumes exactly where it was. Returns the segment of the
 * window the actor may act in, once any stop covering the start has been resolved.
 */
export function activeWindows(startUs: number, windowUs: number, stopUntilUs: number | null): { fromUs: number; toUs: number } {
  const end = startUs + windowUs;
  if (stopUntilUs === null || stopUntilUs <= startUs) return { fromUs: startUs, toUs: end };
  return { fromUs: Math.min(stopUntilUs, end), toUs: end };
}
