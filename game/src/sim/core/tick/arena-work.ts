import type { CombatArena } from '../../combat/combat-arena';
import type { CombatFlight } from '../../combat/combat-actions';
import type { CombatClock } from '../../combat/combat-clock';
import { updateArenaAction } from '../../combat/combat-arena';

/**
 * Cancelling arena work: the player's unreleased basic, the committed intent, every flight in the
 * encounter, and one released flight. These read only the arena and the clock, so the tick can build
 * them before any other stage needs them.
 */
export function createArenaWork(opts: { arena: CombatArena | undefined; clock: CombatClock }) {
  const { arena, clock } = opts;

  /** Cancel an unreleased player basic; a released swing keeps its pose and receipt. */
  function cancelPlayerBasic(reason: string) {
    const action = arena?.player.action;
    if (!arena || !action || action.kind !== 'swing' || action.cancelledAtUs != null
      || action.releasedAtUs != null || action.impactCount) return;
    updateArenaAction(arena, action.id, { cancelledAtUs: clock.nowUs, cancelReason: reason, endsAtUs: clock.nowUs });
    arena.player.action = undefined;
  }

  function cancelIntent(reason: string) {
    const intent = arena?.intent;
    if (!arena || !intent) return;
    arena.intent = undefined;
    const action = intent.actionId != null
      ? arena.actions.find((entry) => entry.id === intent.actionId) : undefined;
    // A normal recovery keeps its pose; a channel is owned by its primary action and stops at
    // the control receipt instead of playing a tail the simulation already refused.
    const cutsPose = intent.phase !== 'recovery' || !!intent.mobile || !!action?.channel;
    if (!cutsPose || intent.actionId == null) return;
    if (action && action.cancelledAtUs == null)
      updateArenaAction(arena, action.id, { cancelledAtUs: clock.nowUs, cancelReason: reason, endsAtUs: clock.nowUs });
    if (arena.player.action?.id === intent.actionId) arena.player.action = undefined;
  }

  function cancelArenaWork(reason: string) {
    if (!arena) return;
    cancelIntent(reason);
    for (const flight of arena.flights) {
      const action = arena.actions.find((entry) => entry.id === flight.actionId);
      if (action && action.cancelledAtUs == null)
        updateArenaAction(arena, action.id, { cancelledAtUs: clock.nowUs, cancelReason: reason, endsAtUs: clock.nowUs });
    }
    arena.flights = [];
    for (const shot of arena.mobFlights) {
      const action = arena.actions.find((entry) => entry.id === shot.actionId);
      if (action && action.cancelledAtUs == null)
        updateArenaAction(arena, action.id, { cancelledAtUs: clock.nowUs, cancelReason: reason, endsAtUs: clock.nowUs });
    }
    arena.mobFlights = [];
    if (arena.player.action && arena.player.action.cancelledAtUs == null)
      updateArenaAction(arena, arena.player.action.id, { cancelledAtUs: clock.nowUs, cancelReason: reason, endsAtUs: clock.nowUs });
    arena.player.action = undefined;
  }

  /** Drop one released flight with its receipt; used when its encounter is no longer current. */
  function cancelFlight(flight: CombatFlight, atUs: number, reason: string) {
    if (!arena) return;
    const at = arena.flights.indexOf(flight);
    if (at >= 0) arena.flights.splice(at, 1);
    const action = arena.actions.find((entry) => entry.id === flight.actionId);
    if (action && action.cancelledAtUs == null)
      updateArenaAction(arena, action.id, { cancelledAtUs: atUs, cancelReason: reason, endsAtUs: atUs });
  }

  return { cancelPlayerBasic, cancelIntent, cancelArenaWork, cancelFlight };
}
