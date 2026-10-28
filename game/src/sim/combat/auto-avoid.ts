import { E } from '../../engine/client';
import { mobSkillById } from './mobSkills';
import type { CombatArena } from './combat-arena';
import type { GameState } from '../core/types';

export interface AutoAvoidPlan {
  x: number;
  y: number;
  actionId: number;
}

/**
 * Bounded auto-avoid: leave the landing circle of a tagged heavy committed ground threat when the
 * remaining reaction time covers the distance. Manual movement wins; released work is never touched.
 */
export function planAutoAvoid(
  arena: CombatArena, state: GameState, atUs: number, unitsPerSec: number,
): AutoAvoidPlan | null {
  if (state.autoAvoidOff) return null;
  const player = arena.player;
  const bodyRadius = E.combat_arena.player_radius_m;
  const speed = E.combat_arena.player_speed;
  // Hysteresis: an answered threat keeps its plan through the hold band past its rim, so the
  // farmer holds outside until the flight lands instead of drifting back in (F45). A graze that
  // was never answered plans nothing — the hold belongs to a committed escape, not to proximity.
  const HOLD_M = 0.6;
  if (player.avoidActionId != null
    && !arena.mobFlights.some((flight) => flight.actionId === player.avoidActionId))
    player.avoidActionId = undefined;
  let threat: { actionId: number; destination: { x: number; y: number }; radius: number; seconds: number } | null = null;
  for (const shot of arena.mobFlights) {
    const impactRadius = shot.impactRadiusM;
    if (shot.kind !== 'ground' || !shot.skillId || impactRadius == null || !(impactRadius > 0)) continue;
    if (!mobSkillById(shot.skillId)?.heavy) continue;
    if (shot.impactAtUs <= atUs) continue;
    // F19: a ground hazard answers the body centre, exactly like its damage does
    // (`resolveMobShot` reads center distance, never the footprint edge) — the escape is owed
    // only while the centre is still inside the circle, plus one sampling margin.
    const radius = impactRadius;
    const held = player.avoidActionId === shot.actionId;
    if (Math.hypot(player.x - shot.destination.x, player.y - shot.destination.y)
      > radius + (held ? HOLD_M : 0) + 1e-7) continue;
    const seconds = (shot.impactAtUs - atUs) / unitsPerSec;
    if (!threat || seconds < threat.seconds) {
      threat = { actionId: shot.actionId, destination: shot.destination, radius, seconds };
    }
  }
  if (!threat) { player.avoidActionId = undefined; return null; }
  const dx = player.x - threat.destination.x;
  const dy = player.y - threat.destination.y;
  const length = Math.hypot(dx, dy);
  // Outside the rim with no held escape, there is nothing left to buy. A held escape keeps its
  // plan through the hold band; the hold clears when the flight lands or the band is cleared.
  if (length > threat.radius + 1e-7 && player.avoidActionId !== threat.actionId) return null;
  const ux = length > 1e-9 ? dx / length : 1;
  const uy = length > 1e-9 ? dy / length : 0;
  // only the distance still left to the circle edge counts; a body already near the rim must not be
  // asked to travel the whole radius again
  const required = Math.max(0, threat.radius - length) + 0.05;
  if (speed * threat.seconds < required) return null;
  const point = {
    x: Math.max(bodyRadius, Math.min(arena.bounds.width - bodyRadius, player.x + ux * required)),
    y: Math.max(bodyRadius, Math.min(arena.bounds.height - bodyRadius, player.y + uy * required)),
  };
  if (Math.hypot(point.x - threat.destination.x, point.y - threat.destination.y) <= threat.radius + 1e-7) return null;
  player.avoidActionId = threat.actionId;
  return { ...point, actionId: threat.actionId };
}
