import type { CombatArena } from './combat-arena';
import { updateArenaAction } from './combat-arena';
import type { GameState } from '../core/types';

/** Release the one owner before cancelling its callbacks or starting cooldown. */
export function finishRayChannel(arena: CombatArena, state: GameState, atUs: number, reason: string): void {
  const intent = arena.intent;
  const channel = intent?.channel;
  if (!intent || !channel) return;
  delete intent.channel;
  arena.channelTemplate = undefined;
  state.skills.cd[intent.skillId] = channel.cooldownSec;
  arena.flights = arena.flights.filter(flight => flight.actionId !== intent.actionId);
  intent.phase = 'recovery';
  intent.recoveryUntilUs = atUs + channel.recoveryUs;
  const action = arena.actions.find(entry => entry.id === intent.actionId);
  if (action) updateArenaAction(arena, action.id, {
    channel: false, endsAtUs: intent.recoveryUntilUs,
    ...(reason !== 'complete' ? { cancelledAtUs: atUs, cancelReason: reason } : {}),
    ...(action.timing ? { timing: { ...action.timing, impactAtUs: atUs, recoveryUntilUs: intent.recoveryUntilUs },
      primaryTiming: { ...action.timing, impactAtUs: atUs, recoveryUntilUs: intent.recoveryUntilUs } } : {}),
  });
}
