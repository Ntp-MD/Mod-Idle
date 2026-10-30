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
  // An answered threat keeps the feet outside until it lands. A graze that was never answered
  // plans nothing — the hold belongs to a committed escape, not to proximity.
  if (player.avoidActionId != null
    && !arena.mobFlights.some((flight) => flight.actionId === player.avoidActionId))
    player.avoidActionId = undefined;
  let threat: { actionId: number; destination: { x: number; y: number }; radius: number; seconds: number; inside: boolean } | null = null;
  for (const shot of arena.mobFlights) {
    const impactRadius = shot.impactRadiusM;
    if (shot.kind !== 'ground' || !shot.skillId || impactRadius == null || !(impactRadius > 0)) continue;
    if (!mobSkillById(shot.skillId)?.heavy) continue;
    // Movement is sampled before the impact event at this same timestamp. Keep the hold through
    // that sample; the resolver removes the flight after it reads the player's landing position.
    if (shot.impactAtUs < atUs) continue;
    // F19: a ground hazard answers the body centre, exactly like its damage does
    // (`resolveMobShot` reads center distance, never the footprint edge) — the escape is owed
    // only while the centre is still inside the circle, plus one sampling margin.
    const radius = impactRadius;
    const held = player.avoidActionId === shot.actionId;
    const inside = Math.hypot(player.x - shot.destination.x, player.y - shot.destination.y) <= radius + 1e-7;
    if (!inside && !held) continue;
    const seconds = (shot.impactAtUs - atUs) / unitsPerSec;
    // A new circle containing the player needs an escape before a safe old circle needs a hold.
    if (!threat || (inside && !threat.inside) || (inside === threat.inside && seconds < threat.seconds)) {
      threat = { actionId: shot.actionId, destination: shot.destination, radius, seconds, inside };
    }
  }
  if (!threat) { player.avoidActionId = undefined; return null; }
  const dx = player.x - threat.destination.x;
  const dy = player.y - threat.destination.y;
  const length = Math.hypot(dx, dy);
  // Once safe, stand still rather than stepping farther out and then chasing back into this
  // same landing. The hold ends when its flight lands; attacks can continue from this point.
  if (length > threat.radius + 1e-7)
    return { x: player.x, y: player.y, actionId: threat.actionId };
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
