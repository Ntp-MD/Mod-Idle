import type { GameState } from '../types';
import type { CombatArena } from '../../combat/combat-arena';
import type { CombatClock } from '../../combat/combat-clock';
import type { ManualControl } from '../../combat/combat-actions';
import { sm } from '../../../engine/client';
import {
  actionFeetUntil, advanceCombatArena, arenaDistance,
} from '../../combat/combat-arena';
import { intentInRange } from '../../combat/combat-actions';
import { push } from '../log';

/**
 * The authoritative arena sample: movement, live clocks, engagement membership, and the flight and
 * shot sweeps, all stamped at one event time. Stages that arrive later are late-bound callbacks.
 */
export function createArenaStep(opts: {
  arena: CombatArena | undefined;
  s: GameState;
  clock: CombatClock;
  units: number;
  manual: ManualControl | undefined;
  /** Asked once per movement sample, so a threat released mid-tick is still answered. */
  autoAvoid: () => { x: number; y: number } | null;
  cancelPlayerBasic: (reason: string) => void;
  cancelIntent: (reason: string) => void;
  cancelMobPreparation: (action: import('../../combat/combat-arena').CombatArenaAction, atUs: number, reason: string) => void;
  advanceLiveClocks: (atUs: number) => void;
  approachRange: () => number;
  playerActiveFraction: number;
  statusModsOn: (store: GameState['mobStatus'], mobId: string) => { stopped: boolean };
  syncEngagement: (atUs: number) => { added: string[] };
  scheduleMobAttacksFor: (mob: import('../types').Mob, atUs: number) => void;
  sweepFlights: (atUs: number) => void;
  sweepMobShots: (atUs: number) => void;
  sweepPlayerShots: (atUs: number) => void;
  fieldProfile: () => any;
}) {
  const {
    arena, s, manual, autoAvoid, cancelPlayerBasic, cancelIntent, cancelMobPreparation,
    advanceLiveClocks, approachRange, playerActiveFraction, statusModsOn,
    syncEngagement, scheduleMobAttacksFor, sweepFlights, sweepMobShots, sweepPlayerShots, fieldProfile,
  } = opts;

  function advanceArenaAt(atUs: number) {
    if (!arena) return;
    const autoAvoid = manual?.moveTo || manual?.cast ? null : opts.autoAvoid();
    const escaping = !!autoAvoid && arenaDistance(arena.player, autoAvoid) > 1e-7;
    const intent = arena.intent;
    // Whirlwind is the one mobile channel: its recovered primary action still permits movement.
    const channeling = intent?.phase === 'recovery' && !!intent.mobile;
    if (manual?.moveTo || escaping) cancelPlayerBasic(escaping ? 'auto-avoid' : 'manual move');
    if ((manual?.moveTo || escaping) && intent?.phase === 'windup') cancelIntent(escaping ? 'auto-avoid' : 'manual move');
    const basic = arena.player.action;
    const basicOwnsFeet = !!basic && basic.kind === 'swing' && !!basic.timing
      && basic.cancelledAtUs == null && atUs >= basic.timing.startedAtUs && atUs < actionFeetUntil(basic);
    // A placed ground order outside cast range walks to its own point; other manual casts close
    // through the ordinary target approach. An explicit local move always wins.
    const reachable = intent && intentInRange(arena, intent, s.group);
    const placedApproach = intent?.manual && intent.aimPoint && intent.phase === 'approach' && !reachable
      && sm.byId[intent.skillId]?.area?.origin === 'target' ? intent.targetPoint : undefined;
    advanceLiveClocks(atUs);
    for (const actor of Object.values(arena.mobs)) {
      const action = actor.action;
      if (action?.kind === 'cast' && action.timing && !action.impactCount && action.cancelledAtUs == null
        && action.timing.releaseAtUs >= atUs && statusModsOn(s.mobStatus, actor.id).stopped)
        cancelMobPreparation(action, atUs, 'control');
    }
    advanceCombatArena(arena, s, atUs, {
      playerRange: approachRange(),
      playerSpeedMult: autoAvoid ? 1 : playerActiveFraction * (channeling ? (intent!.speedMult ?? 0.6) : 1),
      playerTargetId: intent?.targetId,
      playerLocked: autoAvoid ? !escaping : !channeling && (intent?.phase === 'windup' || intent?.phase === 'recovery' || basicOwnsFeet),
      playerMoveTo: escaping ? { x: autoAvoid!.x, y: autoAvoid!.y } : manual?.moveTo ?? placedApproach,
      engagedIds: new Set(s.field?.engagementIds ?? []),
      mobSpeedMult: (mob) => {
        return statusModsOn(s.mobStatus, mob.id).stopped ? 0 : 1;
      },
      homeBandM: Number(fieldProfile().home_band_m) || 0.35,
      returnSpeedMult: Number(fieldProfile().return_speed_mult) || 0.65,
      idleDecisionSec: Number(fieldProfile().idle_decision_sec) || 5,
      idleWaitPct: Number(fieldProfile().idle_wait_pct) || 0.35,
    });
    // Membership follows the authoritative movement sample; a body that just entered aggro gets
    // its own remaining-window attack plan instead of waiting for the next world tick.
    const delta = syncEngagement(atUs);
    for (const id of delta.added) {
      const mob = s.group.find((entry) => entry.id === id && entry.hp > 0);
      if (mob) scheduleMobAttacksFor(mob, atUs);
    }
    if (manual?.moveTo && arenaDistance(arena.player, manual.moveTo) <= 0.3) {
      manual.moveTo = undefined;
    } else if (manual?.moveTo && arena.player.routeFailed) {
      // The order cannot be walked: end it with a reason instead of pushing at the wall forever.
      manual.moveTo = undefined;
      arena.player.routeFailed = undefined;
      arena.player.path = undefined;
      arena.player.pathGoal = undefined;
      const list = (s.combatReceipts ||= []);
      list.push({ atUs, command: 'move', status: 'rejected', reason: 'unreachable' });
      if (list.length > 8) list.splice(0, list.length - 8);
    }
    sweepFlights(atUs);
    sweepMobShots(atUs);
    sweepPlayerShots(atUs);
  }

  return { advanceArenaAt };
}
