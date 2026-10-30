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
  /** F27 hold the line: while true the automatic rotation yields to an unaffordable re-arm.
   *  The same gate runs on every movement sample, not only at the world tick's one press. */
  holdFiller?: () => boolean;
}) {
  const {
    arena, s, attackCharacter, autoSkills, playerActiveFraction, manual,
    cancelIntent, startWindup, holdFiller,
  } = opts;

  function note(atUs: number, command: 'cast' | 'move' | 'stop', status: 'accepted' | 'queued' | 'rejected', reason: string, skillId?: string) {
    const list = (s.combatReceipts ||= []);
    const last = list[list.length - 1];
    if (last && last.atUs === atUs && last.command === command && last.status === status && last.reason === reason) return;
    list.push({ atUs, atSec: atUs / (arena?.unitsPerSec || 1), command, status, reason, ...(skillId ? { skillId } : {}) });
    if (list.length > 8) list.splice(0, list.length - 8);
  }

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
      if (intent?.phase === 'windup') { note(atUs, 'cast', 'accepted', 'superseded windup', manual.cast.skillId); cancelIntent('manual cast'); intent = arena.intent; }
      if (intent?.phase === 'recovery') {
        if (intent.mobile) {
          for (const flight of [...arena.flights]) {
            if (flight.actionId !== intent!.actionId || flight.timing.impactAtUs <= atUs) continue;
            const at = arena.flights.indexOf(flight);
            if (at >= 0) arena.flights.splice(at, 1);
          }
          return;
        }
        if (atUs < (intent.recoveryUntilUs ?? 0)) { note(atUs, 'cast', 'queued', 'recovery', manual.cast.skillId); return; }
        arena.intent = undefined;
        intent = undefined;
      }
      const request = manual.cast;
      const focus = arena.focusId
        ? s.group.find((mob) => mob.id === arena!.focusId && mob.hp > 0 && arena!.mobs[mob.id]) : undefined;
      const primary = focus ?? arenaTarget(arena, s.group);
      const pose = primary ? arena.mobs[primary.id] : undefined;
      if (!sm.byId[request.skillId]) { note(atUs, 'cast', 'rejected', 'unknown skill', request.skillId); manual.cast = undefined; return; }
      const next: CombatIntent = {
        skillId: request.skillId,
        targetId: primary?.id ?? '',
        targetPoint: request.point ?? (pose ? { x: pose.x, y: pose.y } : { x: arena.player.x, y: arena.player.y }),
        phase: 'approach',
        manual: true,
        ...(request.point ? { aimPoint: true } : {}),
      };
      note(atUs, 'cast', 'accepted', 'committed', request.skillId);
      manual.cast = undefined;
      manual.moveTo = undefined;
      arena.intent = next;
      if (intentInRange(arena, next, s.group)) startWindup(next, atUs);
      return;
    }
    if (intent?.manual && intent.phase === 'approach') {
      if (!intent.aimPoint && intent.targetId && !s.group.some((mob) => mob.id === intent!.targetId && mob.hp > 0)) {
        arena.intent = undefined;
        return;
      }
      if (intentInRange(arena, intent, s.group)) startWindup(intent, atUs);
      return;
    }
    if (manual?.moveTo) {
      if (arena.intent?.phase === 'windup') { note(atUs, 'move', 'accepted', 'cancelled windup'); cancelIntent('manual move'); }
      else if (arena.intent?.phase === 'approach') { note(atUs, 'move', 'accepted', 'dropped approach'); arena.intent = undefined; }
      else note(atUs, 'move', 'accepted', 'ordered');
      return;
    }
    // A manual request keeps its action alive when automatic skills are off; hard control still
    // cancels an unpaid manual windup at the control timestamp.
    if (playerActiveFraction <= 0) { cancelIntent('inactive'); return; }
    if (!autoSkills && !intent?.manual) { cancelIntent('inactive'); return; }
    if (intent?.phase === 'windup') {
      if (!(intent.manual && intent.aimPoint) && !s.group.some((mob) => mob.id === intent!.targetId && mob.hp > 0)) cancelIntent('target lost');
      return;
    }
    if (intent?.phase === 'recovery') return;
    // A held filler never punches through the re-arm: the yield lives on every sample, so a
    // zero-cooldown row cannot spend mana the upkeep needs on the very next movement step.
    if (holdFiller?.()) return;
    const next = selectCombatIntent(arena, s, attackCharacter, autoSkills);
    if (!next) { arena.intent = undefined; return; }
    arena.intent = next;
    if (intentInRange(arena, next, s.group)) startWindup(next, atUs);
  }

  return { ensureIntent };
}
