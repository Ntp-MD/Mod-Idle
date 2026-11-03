import { actionFeetUntil, type CombatArena } from '@sim/combat/combat-arena';

/**
 * F22 — when gear may change in combat. A swap never happens inside a committed windup, release
 * or recovery: the action was paid for with the sheet it started on, and changing the weapon
 * mid-swing would silently rewrite its damage. Between actions the window is open; the caller
 * defers and retries rather than dropping the drop.
 */
export function equipWindowOpen(arena: CombatArena | undefined): boolean {
  if (!arena) return true;
  if (arena.player.action && arena.player.action.cancelledAtUs == null
    && arena.nowUs < actionFeetUntil(arena.player.action)) return false;
  return arena.intent?.phase !== 'windup' && arena.intent?.phase !== 'recovery';
}
