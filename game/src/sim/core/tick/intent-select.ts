import type { GameState } from '../types';
import type { Character } from '../player';
import type { CombatArena } from '../../combat/combat-arena';
import type { CombatIntent, ManualControl } from '../../combat/combat-actions';
import { sm } from '../../../engine/client';
import { arenaTarget } from '../../combat/combat-arena';
import { intentInRange, selectCombatIntent } from '../../combat/combat-actions';

/**
 * Choosing the player's committed intent for the arena: the manual request, the held windup, or the
 * rotation's first ready skill. The bodies and callbacks arrive verbatim from the tick.
 */
export function createIntentSelect(opts: {
  arena: CombatArena | undefined;
  s: GameState;
  attackCharacter: Character;
  autoSkills: boolean;
  playerActiveFraction: number;
  manual: ManualControl | undefined;
  cancelIntent: (reason: string) => void;
  startWindup: (intent: CombatIntent, atUs: number) => void;
  engageTarget: (targetId?: string) => void;
}) {
  const {
    arena, s, attackCharacter, autoSkills, playerActiveFraction, manual,
    cancelIntent, startWindup, engageTarget,
  } = opts;

  function ensureIntent(atUs: number) {
    if (!arena) return;
    let intent = arena.intent;
    if (intent?.phase === 'recovery' && atUs >= (intent.recoveryUntilUs ?? 0)) {
      arena.intent = undefined;
      intent = undefined;
    }
    // A deliberate cast request bypasses automatic slot enable/conditions; canonical ownership,
    // range, resource and cooldown checks still run at release.
    if (manual?.cast) {
      if (intent?.phase === 'windup') { cancelIntent('manual cast'); intent = arena.intent; }
      if (intent?.phase === 'recovery') {
        if (intent.mobile) {
          for (const flight of [...arena.flights]) {
            if (flight.actionId !== intent!.actionId || flight.timing.impactAtUs <= atUs) continue;
            const at = arena.flights.indexOf(flight);
            if (at >= 0) arena.flights.splice(at, 1);
          }
          return;
        }
        if (atUs < (intent.recoveryUntilUs ?? 0)) return;
        arena.intent = undefined;
        intent = undefined;
      }
      const request = manual.cast;
      const focus = arena.focusId
        ? s.group.find((mob) => mob.id === arena!.focusId && mob.hp > 0 && arena!.mobs[mob.id]) : undefined;
      const primary = focus ?? arenaTarget(arena, s.group);
      const pose = primary ? arena.mobs[primary.id] : undefined;
      if (!sm.byId[request.skillId]) { manual.cast = undefined; return; }
      const next: CombatIntent = {
        skillId: request.skillId,
        targetId: primary?.id ?? '',
        targetPoint: request.point ?? (pose ? { x: pose.x, y: pose.y } : { x: arena.player.x, y: arena.player.y }),
        phase: 'approach',
        manual: true,
        ...(request.point ? { aimPoint: true } : {}),
      };
      manual.cast = undefined;
      manual.moveTo = undefined;
      arena.intent = next;
      engageTarget(next.targetId);
      if (intentInRange(arena, next, s.group)) startWindup(next, atUs);
      return;
    }
    if (intent?.manual && intent.phase === 'approach') {
      if (intent.targetId && !s.group.some((mob) => mob.id === intent!.targetId && mob.hp > 0)) {
        arena.intent = undefined;
        return;
      }
      if (intentInRange(arena, intent, s.group)) startWindup(intent, atUs);
      return;
    }
    if (manual?.moveTo) {
      if (arena.intent?.phase === 'windup') cancelIntent('manual move');
      else if (arena.intent?.phase === 'approach') arena.intent = undefined;
      return;
    }
    // A manual request keeps its action alive when automatic skills are off; hard control still
    // cancels an unpaid manual windup at the control timestamp.
    if (playerActiveFraction <= 0) { cancelIntent('inactive'); return; }
    if (!autoSkills && !intent?.manual) { cancelIntent('inactive'); return; }
    if (intent?.phase === 'windup') {
      if (!s.group.some((mob) => mob.id === intent!.targetId && mob.hp > 0)) cancelIntent('target lost');
      return;
    }
    if (intent?.phase === 'recovery') return;
    const next = selectCombatIntent(arena, s, attackCharacter, autoSkills);
    if (!next) { arena.intent = undefined; return; }
    arena.intent = next;
    engageTarget(next.targetId);
    if (intentInRange(arena, next, s.group)) startWindup(next, atUs);
  }

  return { ensureIntent };
}
