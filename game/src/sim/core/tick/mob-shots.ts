import type { GameState, Mob } from '../types';
import type { CombatArena, CombatArenaAction, CombatMobFlight } from '../../combat/combat-arena';
import type { CombatClock } from '../../combat/combat-clock';
import type { SkillCastTiming } from '../../../../../engine/types.ts';
import { E } from '../../../engine/client';
import { EVENT_PRIORITY } from '../../combat/combat-clock';
import {
  arenaAction, arenaDistance, mobAttackProfile, updateArenaAction,
} from '../../combat/combat-arena';
import { firstProjectileHit } from '../../../../../engine/skill-actions.ts';
import { sweepDisc } from '../../../../../engine/navigation.ts';
import { mobSkillById } from '../../combat/mobSkills';
import { fieldAreaKey } from '../../world/field-area';

/**
 * Stand-off mob projectiles: the shot's travel, its swept contact, and the terminal resolve.
 *
 * The factory closes over one tick's arena/clock/rng so each function keeps the exact body the tick
 * always ran — the only change is where it lives.
 */
export function createMobShots(opts: {
  arena: CombatArena | undefined;
  clock: CombatClock;
  rng: () => number;
  s: GameState;
  tickStartUs: number;
  tickEndUs: number;
  units: number;
  resolveIncomingHit: (mob: Mob, plannedSkill: any, rng: () => number, live: Mob, atUs?: number) => void;
}) {
  const { arena, clock, rng, s, tickStartUs, tickEndUs, units, resolveIncomingHit } = opts;
  const encounterKeyOf = (state: GameState) => fieldAreaKey(state);

  function mobShotPosition(shot: CombatMobFlight, atUs: number) {
    const span = shot.impactAtUs - shot.releaseAtUs;
    const progress = span > 0 ? Math.max(0, Math.min(1, (atUs - shot.releaseAtUs) / span)) : 1;
    return { x: shot.source.x + (shot.destination.x - shot.source.x) * progress,
      y: shot.source.y + (shot.destination.y - shot.source.y) * progress };
  }

  /**
   * Release one ordinary stand-off basic: commit the aim at the attack beat, then let the swept
   * body query decide contact. A ready strike never reaches this path; it replaces the opportunity.
   */
  function launchMobShot(mob: Mob, atUs: number, existing?: CombatArenaAction) {
    if (!arena) return;
    const actor = arena.mobs[mob.id];
    if (!actor) return;
    const profile = mobAttackProfile(mob);
    const speed = Number(profile.projectile_speed_mps);
    const radius = Number(profile.hit_radius_m);
    if (!(speed > 0) || !(radius >= 0)) return;
    const action = existing ?? arenaAction(arena, mob.id, 'swing', atUs, 'player');
    if (!action) return;
    const source = { x: actor.x, y: actor.y };
    const destination = { x: arena.player.x, y: arena.player.y };
    const impactAtUs = atUs + Math.ceil(Math.hypot(destination.x - source.x, destination.y - source.y)
      / speed * units);
    const plannedRecoveryUs = existing?.timing
      ? Math.max(0, existing.timing.recoveryUntilUs - existing.timing.impactAtUs) : 0;
    const timing: SkillCastTiming = { delivery: 'projectile', startedAtUs: existing?.timing?.startedAtUs ?? atUs,
      releaseAtUs: atUs, impactAtUs, recoveryUntilUs: atUs + plannedRecoveryUs };
    updateArenaAction(arena, action.id, { timing, ranged: true, releasedAtUs: atUs,
      targetX: destination.x, targetY: destination.y });
    actor.holdAtRange = true;
    arena.mobFlights.push({
      actionId: action.id, mobId: mob.id, mob: { ...mob }, source, destination,
      position: { x: source.x, y: source.y }, releaseAtUs: atUs, impactAtUs, speedMps: speed,
      radiusM: radius, areaKey: encounterKeyOf(s),
    });
  }

  function cancelMobShot(shot: CombatMobFlight, atUs: number, reason: string) {
    if (!arena) return;
    const at = arena.mobFlights.indexOf(shot);
    if (at >= 0) arena.mobFlights.splice(at, 1);
    const action = arena.actions.find((entry) => entry.id === shot.actionId);
    if (action && action.cancelledAtUs == null)
      updateArenaAction(arena, action.id, { cancelledAtUs: atUs, cancelReason: reason, endsAtUs: atUs });
  }

  /** Contact/impact ends the shot; a terminal arrival with no contact is a miss, never a ghost hit. */
  function resolveMobShot(shot: CombatMobFlight, atUs: number, contact: boolean) {
    if (!arena) return;
    shot.queued = false;
    const at = arena.mobFlights.indexOf(shot);
    if (at >= 0) arena.mobFlights.splice(at, 1);
    const row = shot.skillId ? mobSkillById(shot.skillId) : undefined;
    const point = shot.kind === 'ground' ? shot.destination : mobShotPosition(shot, atUs);
    const action = arena.actions.find((entry) => entry.id === shot.actionId);
    if (action && action.cancelledAtUs == null) {
      const timing = action.timing ? { ...action.timing, impactAtUs: atUs } : action.timing;
      updateArenaAction(arena, action.id, {
        ...(timing ? { timing } : {}),
        impactCount: 1,
        targetX: point.x, targetY: point.y,
        endsAtUs: Math.max(action.endsAtUs, atUs + E.combat_arena.action_sec * units),
      });
    }
    if (s.player.hp <= 0) return;
    if (shot.kind === 'ground') {
      // The committed point is fixed; the player is read where they actually stand at impact.
      if (arenaDistance(shot.destination, arena.player) > (shot.impactRadiusM ?? 0) + 1e-7) return;
    } else if (!contact) return;
    const live = s.group.find((entry) => entry.id === shot.mobId && entry.hp > 0);
    resolveIncomingHit(shot.mob, row, rng, live ?? shot.mob, atUs);
  }

  function scheduleMobShot(shot: CombatMobFlight) {
    if (!arena || shot.queued) return;
    const atUs = Math.max(tickStartUs, shot.impactAtUs);
    if (atUs > tickEndUs) return;
    shot.queued = true;
    clock.schedule(atUs, EVENT_PRIORITY.mobAction, shot.mobId, 'player', () => {
      shot.queued = false;
      if (!arena?.mobFlights.includes(shot)) return;
      // One last sweep covers contact exactly at the committed endpoint; otherwise the shot is spent.
      sweepMobShots(atUs);
      if (arena?.mobFlights.includes(shot)) resolveMobShot(shot, clock.nowUs, false);
    });
  }

  function sweepMobShots(atUs: number) {
    if (!arena || s.player.hp <= 0) return;
    for (const shot of [...arena.mobFlights]) {
      if (shot.areaKey && shot.areaKey !== encounterKeyOf(s)) { cancelMobShot(shot, atUs, 'area-exit'); continue; }
      const from = shot.position;
      // The segment starts where the last sweep left off — never before this shot's own
      // release. Contact backdates to the exact crossing instead of the sample that
      // noticed it (F20: time-of-impact).
      const fromAtUs = Math.max(shot.lastCheckedAtUs ?? shot.releaseAtUs, shot.releaseAtUs);
      const contactAtUs = (fraction: number) =>
        Math.round(fromAtUs + fraction * Math.max(0, atUs - fromAtUs));
      const to = mobShotPosition(shot, atUs);
      // A ground cast owns its committed impact; only a projectile tests swept contact on the way.
      if (shot.kind === 'ground') { shot.position = to; shot.lastCheckedAtUs = atUs; continue; }
      const barrier = arena.nav ? sweepDisc(arena.nav, from, to, 0, 'projectiles') : null;
      if (barrier) {
        shot.position = { x: barrier.x, y: barrier.y };
        shot.lastCheckedAtUs = atUs;
        resolveMobShot(shot, contactAtUs(barrier.fraction), false);
        continue;
      }
      shot.position = to;
      shot.lastCheckedAtUs = atUs;
      const previous = arena.frames.at(-2)?.player ?? arena.frames.at(-1)?.player;
      const target = { ...arena.player, ...(previous ? { previous: { x: previous.x, y: previous.y } } : {}) };
      const hit = firstProjectileHit(from, to, [target], shot.radiusM);
      if (hit) resolveMobShot(shot, contactAtUs(hit.fraction), true);
    }
  }

  return { launchMobShot, cancelMobShot, resolveMobShot, scheduleMobShot, sweepMobShots };
}
