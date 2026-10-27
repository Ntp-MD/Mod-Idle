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
  if (state.avoidCooldownUntilSec != null && state.avoidCooldownUntilSec > state.clockSec) return null;
  const player = arena.player;
  const bodyRadius = E.combat_arena.player_radius_m;
  const speed = E.combat_arena.player_speed;
  let threat: { actionId: number; destination: { x: number; y: number }; radius: number; seconds: number } | null = null;
  for (const shot of arena.mobFlights) {
    const impactRadius = shot.impactRadiusM;
    if (shot.kind !== 'ground' || !shot.skillId || impactRadius == null || !(impactRadius > 0)) continue;
    if (!mobSkillById(shot.skillId)?.heavy) continue;
    if (shot.impactAtUs <= atUs) continue;
    const radius = impactRadius + bodyRadius;
    if (Math.hypot(player.x - shot.destination.x, player.y - shot.destination.y) > radius + 1e-7) continue;
    const seconds = (shot.impactAtUs - atUs) / unitsPerSec;
    if (!threat || seconds < threat.seconds) {
      threat = { actionId: shot.actionId, destination: shot.destination, radius, seconds };
    }
  }
  if (!threat) return null;
  const dx = player.x - threat.destination.x;
  const dy = player.y - threat.destination.y;
  const length = Math.hypot(dx, dy);
  const ux = length > 1e-9 ? dx / length : 1;
  const uy = length > 1e-9 ? dy / length : 0;
  const required = threat.radius + 0.05;
  if (speed * threat.seconds < required) return null;
  const point = {
    x: Math.max(bodyRadius, Math.min(arena.bounds.width - bodyRadius, player.x + ux * required)),
    y: Math.max(bodyRadius, Math.min(arena.bounds.height - bodyRadius, player.y + uy * required)),
  };
  if (Math.hypot(point.x - threat.destination.x, point.y - threat.destination.y) <= threat.radius + 1e-7) return null;
  return { ...point, actionId: threat.actionId };
}
