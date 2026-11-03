import type { ArenaFeedbackEvent, CombatArenaAction } from '@sim/combat/combat-arena';
import type { FxEvent } from '@sim/core/types';

/** Display cadence only: gameplay timing, HP, RNG and procs never read this value. */
const DISPLAY_HIT_INTERVAL_SEC = 0.11;

export type CombatFeedbackPop = ArenaFeedbackEvent & {
  displayKey: string;
  displayIndex: number;
  displayCount: number;
  collapsedCount?: number;
};

/** Partition the rounded displayed total; rounding cannot invent or lose a displayed point. */
export function splitDisplayedDamage(amount: number, count: number): number[] {
  const total = Math.max(0, Math.round(Number.isFinite(amount) ? amount : 0));
  const parts = Number.isSafeInteger(count) && count > 0 ? count : 1;
  return Array.from({ length: parts }, (_, index) =>
    Math.round(total * (index + 1) / parts) - Math.round(total * index / parts));
}

/** Actual indexed impacts stay separate; a legacy aggregate expands only into visual contacts. */
export function combatFeedbackPops(events: readonly ArenaFeedbackEvent[], unitsPerSec: number): CombatFeedbackPop[] {
  return events.flatMap(event => {
    const count = Number.isSafeInteger(event.hitCount) && (event.hitCount ?? 0) > 1 ? event.hitCount! : 1;
    const split = event.kind === 'hit' && event.via === 'cast' && event.hitIndex == null && count > 1 && event.value != null;
    const values = split ? splitDisplayedDamage(event.value!, count) : [event.value];
    return values.map((value, index) => ({
      ...event, ...(split ? { value, text: String(value), atUs: (event.atUs ?? event.sec * unitsPerSec)
        + Math.round(index * DISPLAY_HIT_INTERVAL_SEC * unitsPerSec) } : {}),
      displayKey: `${event.id}:${index}`, displayIndex: split ? index + 1 : event.hitIndex ?? 1,
      displayCount: count,
    }));
  });
}

/** Retain immutable receipt expansions across render frames; expired receipts can be collected. */
export function createCombatFeedbackCache() {
  let units = 0;
  let entries = new WeakMap<ArenaFeedbackEvent, CombatFeedbackPop[]>();
  return (events: readonly ArenaFeedbackEvent[], unitsPerSec: number): CombatFeedbackPop[] => {
    if (units !== unitsPerSec) { units = unitsPerSec; entries = new WeakMap(); }
    return events.flatMap(event => {
      let pops = entries.get(event);
      if (!pops) { pops = combatFeedbackPops([event], unitsPerSec); entries.set(event, pops); }
      return pops;
    });
  };
}

export interface ActorHitIndex {
  byActor: Map<string, CombatFeedbackPop[]>;
  atUs: number;
  unitsPerSec: number;
}

/** Index and order contacts once per frame, instead of filtering/sorting the history per actor. */
export function indexActorHits(events: readonly CombatFeedbackPop[], atUs: number, unitsPerSec: number): ActorHitIndex {
  const byActor = new Map<string, CombatFeedbackPop[]>();
  const damage = (event: FxEvent) => event.hpDamage != null || event.esDamage != null
    ? (event.hpDamage ?? 0) + (event.esDamage ?? 0) : event.value ?? 0;
  for (const event of events) {
    const actorId = event.kind === 'taken' ? 'player' : event.kind === 'hit' ? event.mobId : undefined;
    if (!actorId || damage(event) <= 0 || (event.atUs ?? event.sec * unitsPerSec) > atUs) continue;
    const contacts = byActor.get(actorId);
    if (contacts) contacts.push(event); else byActor.set(actorId, [event]);
  }
  for (const contacts of byActor.values()) contacts.sort((a, b) =>
    (b.atUs ?? b.sec * unitsPerSec) - (a.atUs ?? a.sec * unitsPerSec) || damage(b) - damage(a) || b.id - a.id);
  return { byActor, atUs, unitsPerSec };
}

export function actorHitFrom(index: ActorHitIndex, actorId: string, durationMs: number): CombatFeedbackPop | undefined {
  return index.byActor.get(actorId)?.find(event =>
    (index.atUs - (event.atUs ?? event.sec * index.unitsPerSec)) / index.unitsPerSec * 1000 < durationMs);
}

export interface CastProgress {
  skillId: string;
  progress: number;
  remainingSec: number;
  incoming: boolean;
}

/** The unpaid windup only; recovery, flight and cancelled work cannot masquerade as casting. */
export function combatCastProgress(action: CombatArenaAction | undefined, atUs: number, units: number): CastProgress | undefined {
  const timing = action?.primaryTiming ?? action?.timing;
  if (!action?.skillId || !timing || action.kind !== 'cast' || !(units > 0)
    || action.cancelledAtUs != null && atUs >= action.cancelledAtUs
    || atUs < timing.startedAtUs || atUs >= timing.releaseAtUs) return undefined;
  const span = timing.releaseAtUs - timing.startedAtUs;
  return { skillId: action.skillId, incoming: action.actorId !== 'player',
    progress: span > 0 ? Math.max(0, Math.min(1, (atUs - timing.startedAtUs) / span)) : 1,
    remainingSec: Math.max(0, timing.releaseAtUs - atUs) / units };
}

/** Named contacts retain their beat before ordinary scene clutter is considered. */
export function feedbackPriority(event: FxEvent): number {
  return event.kind === 'hit' && !!event.skillId ? 0 : event.kind === 'taken' || event.kind === 'block' ? 1
    : event.kind === 'hit' ? 2 : 3;
}

/** Dense bursts compact per skill/target/crit lane and retain the represented total and hit count. */
export function compactCombatFeedback<T extends CombatFeedbackPop>(pops: T[], budget = 64): T[] {
  if (pops.length <= budget) return pops;
  const groups = new Map<string, T>();
  const ordinary: T[] = [];
  for (const pop of pops) {
    if (!pop.skillId || pop.kind !== 'hit') { ordinary.push(pop); continue; }
    const key = `${pop.actionId ?? pop.sec}:${pop.skillId}:${pop.mobId}:${pop.crit === true}`;
    const previous = groups.get(key);
    if (!previous) groups.set(key, { ...pop });
    else {
      const value = (previous.value ?? 0) + (pop.value ?? 0);
      groups.set(key, { ...previous, value, text: String(Math.round(value)),
        collapsedCount: (previous.collapsedCount ?? 1) + (pop.collapsedCount ?? 1) });
    }
  }
  const named = [...groups.values()];
  return [...named, ...ordinary.slice(0, Math.max(0, budget - named.length))];
}
