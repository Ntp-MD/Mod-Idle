import { E } from '../../engine/client';
import type { GameState, Mob, FxEvent } from './types';
import type { CombatClock } from '../combat/combat-clock';
import { recordCombatArenaFx, type CombatArena } from '../combat/combat-arena';
import { recordCombatEvent } from '../combat/combat-history';

/**
 * The tick's feedback line: the numbers the screen animates and the counters the reports divide.
 *
 * `tickFxClock` is the tick's own context (the µs clock and the live arena); the tick sets it at the
 * top and deletes it at the end, so a call outside a tick still stamps `sec` and simply omits `atUs`.
 */
export const FX_RING = 24;
export const tickFxClock = new WeakMap<GameState, { clock: CombatClock; arena?: CombatArena }>();

/**
 * One event handed to the screen. A log line is for reading later; this is for animating now, and it
 * carries the number and the colour, which a total (`counters.damageBy`) and a sentence both lose.
 */
export function fx(s: GameState, ev: Omit<FxEvent, 'id' | 'sec'>, source?: Mob) {
  s.fx = s.fx || [];
  s.fxSeq = (s.fxSeq || 0) + 1;
  const context = tickFxClock.get(s);
  s.fx.unshift({ id: s.fxSeq, sec: s.clockSec, ...(context ? { atUs: context.clock.nowUs } : {}), ...ev });
  if (context?.arena) recordCombatArenaFx(context.arena, s, s.fx[0], source);
  recordCombatEvent(s, s.fx[0], source);
  if (s.fx.length > FX_RING) s.fx.length = FX_RING;
}

/**
 * The indicator's colour for one hit: a crit first, then the Element that carried it, then neutral.
 * A missing data colour falls to `var(--text)`, so the client's own token stays the only neutral.
 */
export function hitColour(element: string | null | undefined, crit = false): string {
  const C = E.elements as any;
  if (crit) return C.crit_colour || 'var(--text)';
  if (element && C.colour?.[element]) return C.colour[element];
  return C.physical_colour || 'var(--text)';
}

/**
 * The colour a status takes — the colour of the Element that inflicts it, read through
 * `elements.status_of`, so a proc never owns a second copy of a colour. The cold proc is `chill`, and
 * `chill` is the game's freeze: the ice colour is the same one either word reads.
 */
export function statusColour(status: string): string {
  const C = E.elements as any;
  const el = Object.keys(C.status_of || {}).find((k) => C.status_of[k] === status);
  return (el && C.colour?.[el]) || C.physical_colour || 'var(--text)';
}

/**
 * The status that carried a DoT tick, so the number has one colour to wear. A tie goes to the
 * Element line over the physical one, which is the same order the budget is written in.
 */
export function dotLead(parts: { burn: number; poison: number; bleed: number }): string {
  return parts.burn >= parts.poison && parts.burn >= parts.bleed ? 'burn'
    : parts.poison >= parts.bleed ? 'poison' : 'bleed';
}

/**
 * One credit of damage dealt, sorted by what dealt it. The total is what the tests divide by time;
 * the split is what answers whether a build's damage comes from its hits or from the statuses those
 * hits leave behind (`concept.md` P0-2).
 */
export function credit(s: GameState, kind: 'swing' | 'cast' | 'dot', amount: number) {
  if (!(amount > 0)) return;
  s.counters.damage = (s.counters.damage || 0) + amount;
  const by = s.counters.damageBy || (s.counters.damageBy = { swing: 0, cast: 0, dot: 0 });
  by[kind] += amount;
}
