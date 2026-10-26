/**
 * What the plate reads.
 *
 * The sim raises the events (`sim/core/game.ts` `fx`); this file decides which of them a body's own card shows
 * and how the figure that lands on it is put together. It lives apart from `App.svelte` for one reason: the
 * rules below are the ones a player can see, so they are worth naming and testing instead of being written
 * inline in markup.
 *
 * Nothing here keeps state between reads and nothing here reads a clock. Every rule is a function of the event
 * ring the sim already owns and of a hold map the caller keeps — which is the design rule for motion on this
 * client: a beat is mounted by the fact that happened, never by a timer the stylesheet guessed.
 */
import type { FxEvent, Mob } from '../../sim/core/types';

/** Every event the ring still holds, bucketed by the body it names, newest first as the ring already is. */
export function fxByMob(ring: FxEvent[]): Map<string, FxEvent[]> {
  const by = new Map<string, FxEvent[]>();
  for (const e of ring) {
    if (!e.mobId) continue;
    const list = by.get(e.mobId);
    if (list) list.push(e); else by.set(e.mobId, [e]);
  }
  return by;
}

/**
 * The blows this body took. A `kill` names the same body — it is what binds a card to its own death — and a
 * `drop` may too, so the plate's gestures follow the hits and never the words raised alongside them.
 */
const hits = (by: Map<string, FxEvent[]>, id: string): FxEvent[] =>
  (by.get(id) || []).filter((e) => e.kind === 'hit');

/** The newest direct blow: a swing or a press takes the rim. A status clock's tick drains HP
 *  and pops its own figure, but it never flashes the card — otherwise a DoT spread over the group
 *  would blink every plate while the character swings at one body. */
export function plateBeat(by: Map<string, FxEvent[]>, id: string): FxEvent | null {
  return hits(by, id).find((e) => e.via === 'swing' || e.via === 'cast') || null;
}

/** One parked figure: the total, and the newest event that put something into it. */
export interface Parked {
  /** The newest contributing event, so a `{#key}` remount stamps once per growth and replays nothing. */
  id: number;
  /** The second these blows share — the sim's own fact for one burst. */
  sec: number;
  /** What the plate prints, unformatted: the caller owns the face it is shown in. */
  sum: number;
  colour: string;
  crit?: boolean;
}

/**
 * The figure a body parks on itself: the blows that landed on it inside one second, added up, newest second
 * only.
 *
 * Grouping on `sec` rather than on "whatever the ring still holds" is what makes the sum honest. A group can
 * only gain members while it is the newest, and once a later second arrives it is never read again, so a
 * parked figure grows and then leaves — it never ticks down as the ring drains.
 *
 * `list` must be newest first, as the ring is. Only an event carrying `value` counts toward the sum: the
 * number is the sim's, never a parse of the text the player was shown.
 */
export function parked(list: FxEvent[]): Parked | null {
  const head = list[0];
  if (!head) return null;
  let sum = 0;
  for (const e of list) {
    if (e.sec !== head.sec) continue;
    sum += e.value || 0;
  }
  return { id: head.id, sec: head.sec, sum, colour: head.colour, crit: head.crit };
}

/** The newest blow, added up: what the plate parks on itself. */
export function platePark(by: Map<string, FxEvent[]>, id: string): Parked | null {
  return parked(hits(by, id));
}

/** A cast follows its own hits in the ring's event order. Skill identity separates casts within one
 *  second; the nearest following marker also separates repeated casts of the same skill. Untagged
 *  presentation events may use a single unambiguous marker, never another row chosen by recency. */
export function castForHit(ring: FxEvent[], hit: FxEvent | null | undefined): FxEvent | null {
  if (!hit || hit.via !== 'cast') return null;
  const casts = ring.filter((e) => e.kind === 'cast' && e.side === 'self' && !!e.skillId && e.sec === hit.sec);
  if (!hit.skillId) return casts.length === 1 && casts[0].id > hit.id ? casts[0] : null;
  let match: FxEvent | null = null;
  for (const cast of casts) {
    if (cast.skillId === hit.skillId && cast.id > hit.id && (!match || cast.id < match.id)) match = cast;
  }
  return match;
}

/** Accumulated attack progress, clamped to the span the plate can draw. */
export function windupOf(mob: Pick<Mob, 'atkTimer'>): number {
  return Math.max(0, Math.min(1, Number(mob.atkTimer) || 0));
}

/**
 * The body's own strike: the newest blow it carried against the character. A blocked swing is still a swing,
 * so both halves of a defence name their striker, and the plate that swung is the one that leans.
 */
export function plateStrike(ring: FxEvent[], id: string): FxEvent | null {
  return ring.find((e) => e.byId === id && (e.kind === 'taken' || e.kind === 'block')) || null;
}

/** The gesture a plate's art wears, and the fact that mounts it. A hit wins its own second: the blow
 *  the body took is the louder fact, so a knock plays through the tick it landed in even when the body
 *  swung back in the same instant. A strictly newer second belongs to the striker — that is how a mob's
 *  own attack run is ever seen in a fight it is losing. One card plays one gesture. */
export function plateGesture(
  knock: FxEvent | null,
  lunge: FxEvent | null,
): { id: number; gesture: 'knock' | 'lunge' } | null {
  if (knock && (!lunge || (knock.sec ?? 0) >= (lunge.sec ?? 0))) return { id: knock.id, gesture: 'knock' };
  if (lunge) return { id: lunge.id, gesture: 'lunge' };
  return null;
}

/**
 * The bodies a `kill` names and the group has dropped: a killed mob leaves `s.group` the same tick the blow
 * that ended it is raised, so the card has to be remembered for as long as its own death is in the ring.
 *
 * A `hit` alone does not make a corpse. A group can leave the field without dying — the zone changed under
 * the walk — and a body that walked off must not be blown apart. The kill is the sim's own word for death,
 * so it is the only thing that binds a card to the dust.
 *
 * The sim is not asked to keep a corpse: `s.group` stays the rules' truth and is read unchanged. This is
 * presentation only, and it ends by itself — a grave lives until the next sim second, so a death dusts
 * on the tick right after the blow instead of lingering while the ring drains. Newest first, so the
 * field paints them in the order the fights ended.
 *
 * `nowSec` is the sim clock; omitted, every kill in the ring is kept (the old read).
 */
export function graveIds(ring: FxEvent[], group: Mob[], nowSec?: number): string[] {
  const live = new Set(group.map((m) => m.id));
  const out: string[] = [];
  for (const e of ring) {
    if (e.kind !== 'kill' || !e.mobId || live.has(e.mobId) || out.includes(e.mobId)) continue;
    if (nowSec !== undefined && nowSec - (e.sec ?? nowSec) >= 1) continue;
    out.push(e.mobId);
  }
  return out;
}
