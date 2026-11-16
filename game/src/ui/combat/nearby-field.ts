import { arenaDistance, type CombatArenaActor, type CombatArenaFrame } from '@sim/combat/combat-arena';
import type { FxEvent, Mob } from '@sim/core/types';

/** Presentation-only window. It never changes engagement, targeting, range or rewards. */
export const NEARBY_RADIUS_M = 10;

export interface NearbyMobView {
  id: string;
  mob: Mob;
  actor: CombatArenaActor;
  /** Unrounded centre distance in metres; the eligibility check uses this value. */
  distanceM: number;
}

/**
 * Living, current-field bodies strictly inside the window. Group order is the simulation's
 * target priority, so the card order stays stable as bodies move or their distance ticks over.
 */
export function nearbyFieldMobs(group: readonly Mob[], frame: CombatArenaFrame): NearbyMobView[] {
  const views: NearbyMobView[] = [];
  for (const mob of group) {
    if (mob.hp <= 0) continue;
    const actor = frame.mobs[mob.id];
    if (!actor || actor.hp <= 0) continue;
    const distanceM = arenaDistance(frame.player, actor);
    if (distanceM < NEARBY_RADIUS_M) views.push({ id: mob.id, mob, actor, distanceM });
  }
  return views;
}

/** 9.96 m must not read as an eligible "10.0 m" card. */
export function nearbyDistanceLabel(distanceM: number): string {
  return distanceM >= NEARBY_RADIUS_M - 0.05 ? '< 10 m' : `${distanceM.toFixed(1)} m`;
}

/** One generic cue for a real action whose body is outside the presentation window. */
export function offViewCue(ring: readonly FxEvent[], visibleIds: ReadonlySet<string>): string | null {
  const event = ring.find((entry) => entry.mobId && !visibleIds.has(entry.mobId)
    && (entry.kind === 'hit' || entry.kind === 'cast' || entry.kind === 'kill' || entry.kind === 'taken'));
  if (!event) return null;
  return event.kind === 'kill' ? 'An enemy fell beyond the nearby field.'
    : event.kind === 'cast' ? 'An unseen enemy cast a skill.'
      : 'An unseen enemy was struck.';
}
