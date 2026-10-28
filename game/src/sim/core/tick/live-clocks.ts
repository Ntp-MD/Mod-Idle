import type { GameState } from '../types';
import type { Character } from '../player';
import type { CombatArena } from '../../combat/combat-arena';
import { tickSkillCooldowns } from '../../combat/skills';

/**
 * The arena's live skill clocks: cooldowns advance to an event's own timestamp before the event
 * reads readiness, through one shared timestamp holder.
 */
export function createLiveClocks(opts: {
  arena: CombatArena | undefined;
  s: GameState;
  c: Character;
  units: number;
  cooldown: { atUs: number };
  playerActiveFraction: number;
}) {
  const { arena, s, c, units, cooldown, playerActiveFraction } = opts;

  function advanceLiveClocks(atUs: number) {
    if (!arena) return;
    const elapsed = Math.max(0, atUs - cooldown.atUs) / units;
    if (elapsed <= 0) return;
    tickSkillCooldowns(s.skills, elapsed * c.cooldownRate * playerActiveFraction);
    cooldown.atUs = atUs;
  }

  return { advanceLiveClocks };
}
