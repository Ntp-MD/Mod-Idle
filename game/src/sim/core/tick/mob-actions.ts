import type { GameState, Mob } from '../types';
import type { CombatArena, CombatArenaAction } from '../../combat/combat-arena';
import type { CombatClock } from '../../combat/combat-clock';
import type { MobCastProfile, MobSkillRow, SkillCastTiming } from '../../../../../engine/types.ts';
import { E } from '../../../engine/client';
import { EVENT_PRIORITY } from '../../combat/combat-clock';
import {
  arenaAction, arenaMobInReach, updateArenaAction,
  mobAttackProfile, arenaDistance,
} from '../../combat/combat-arena';
import { basicPhaseBudget } from '../../../../../engine/attack-range.ts';
import { mobCastGeometry, mobCastProfile, mobSkillById, markMobSkillUsed } from '../../combat/mobSkills';
import { modsOn as statusModsOn } from '../../combat/mobStatus';
import { fieldAreaKey } from '../../world/field-area';

/**
 * Mob basics and typed strikes: the committed release beat, the melee re-test, and the projectile
 * hand-off. Bodies arrive verbatim from the tick; the factory only closes over the tick's state.
 */
export function createMobActions(opts: {
  arena: CombatArena | undefined;
  clock: CombatClock;
  rng: () => number;
  s: GameState;
  units: number;
  tickStartUs: number;
  tickEndUs: number;
  advanceArenaAt: (atUs: number) => void;
  launchMobShot: (mob: Mob, atUs: number, existing?: CombatArenaAction) => void;
  cancelMobPreparation: (action: CombatArenaAction, atUs: number, reason: string) => void;
  resolveIncomingHit: (mob: Mob, plannedSkill: MobSkillRow | undefined, rng: () => number) => void;
}) {
  const { arena, clock, rng, s, units, tickStartUs, tickEndUs, advanceArenaAt, launchMobShot, cancelMobPreparation, resolveIncomingHit } = opts;
  const encounterKeyOf = (state: GameState) => fieldAreaKey(state);

  function startMobBasic(mob: Mob, atUs: number, rate: number): void {
    if (!arena) return;
    const profile = mobAttackProfile(mob);
    const intervalUs = Math.round(units / Math.max(1e-9, rate));
    const phase = basicPhaseBudget(profile, intervalUs);
    const releaseAtUs = atUs + phase.windupUs;
    const timing: SkillCastTiming = {
      delivery: profile.delivery, startedAtUs: atUs, releaseAtUs,
      impactAtUs: releaseAtUs, recoveryUntilUs: releaseAtUs + phase.recoveryUs,
    };
    const action = arenaAction(arena, mob.id, 'swing', atUs, 'player', undefined, undefined, timing);
    if (action) {
      updateArenaAction(arena, action.id, { areaKey: encounterKeyOf(s) });
      scheduleMobBasic(action, mob);
    }
  }

  /** Release an ordinary basic at its committed beat; a miss still owns the action. */
  function scheduleMobBasic(action: CombatArenaAction, mob: Mob): void {
    if (!arena || !action.timing || action.releasedAtUs != null) return;
    const atUs = Math.max(tickStartUs, action.timing.releaseAtUs);
    if (atUs > tickEndUs) return;
    clock.schedule(atUs, EVENT_PRIORITY.mobAction, mob.id, 'player', () => {
      if (!arena) return;
      advanceArenaAt(clock.nowUs);
      const current = arena.actions.find(entry => entry.id === action.id);
      if (!current || current.cancelledAtUs != null || current.impactCount || current.releasedAtUs != null) return;
      if (current.areaKey && current.areaKey !== encounterKeyOf(s)) {
        cancelMobPreparation(current, clock.nowUs, 'area-exit');
        return;
      }
      if (mob.hp <= 0 || !s.group.includes(mob) || s.player.hp <= 0
        || statusModsOn(s.mobStatus, mob.id).stopped) {
        cancelMobPreparation(current, clock.nowUs, 'release-invalid');
        return;
      }
      const profile = mobAttackProfile(mob);
      if (profile.delivery === 'projectile') {
        if (mob.line !== 'stand-off' || !arenaMobInReach(arena, mob.id)) {
          cancelMobPreparation(current, clock.nowUs, 'release-invalid');
          return;
        }
        launchMobShot(mob, clock.nowUs, current);
        return;
      }
      updateArenaAction(arena, current.id, {
        impactCount: 1, releasedAtUs: clock.nowUs,
        timing: { ...(current.timing as SkillCastTiming), impactAtUs: clock.nowUs },
      });
      // Melee contact is re-tested at the body, not the windup's old distance.
      if (arenaMobInReach(arena, mob.id)) resolveIncomingHit(mob, undefined, rng);
    });
  }

  /** Release a typed mob cast by its delivery; damage only follows the delivery's own receipt. */
  function launchMobSkillShot(mob: Mob, row: MobSkillRow, cast: MobCastProfile,
    action: CombatArenaAction, atUs: number): void {
    if (!arena) return;
    const actor = arena.mobs[mob.id];
    if (!actor) return;
    const source = { x: actor.x, y: actor.y };
    const destination = { x: arena.player.x, y: arena.player.y };
    const distance = Math.hypot(destination.x - source.x, destination.y - source.y);
    const groundDelay = Math.max(0.001, Number(cast.impact_delay_sec) || 0.4);
    const speed = cast.delivery === 'ground'
      ? Math.max(0.001, distance / groundDelay)
      : Math.max(0.001, Number(cast.projectile_speed_mps) || 12);
    const impactAtUs = cast.delivery === 'ground'
      ? atUs + Math.round(groundDelay * units)
      : atUs + Math.ceil(distance / speed * units);
    const radius = cast.delivery === 'ground'
      ? Math.max(0, Number(row.area?.radius_m) || 0)
      : Math.max(0, Number(cast.hit_radius_m) || 0);
    const timing: SkillCastTiming = {
      delivery: cast.delivery,
      startedAtUs: action.timing?.startedAtUs ?? atUs,
      releaseAtUs: atUs, impactAtUs,
      recoveryUntilUs: action.timing?.recoveryUntilUs ?? atUs,
    };
    updateArenaAction(arena, action.id, {
      timing, releasedAtUs: atUs, targetX: destination.x, targetY: destination.y,
      ...(cast.delivery === 'projectile' ? { ranged: true } : {}),
      ...(cast.delivery === 'ground' && row.area ? {
        area: { origin: row.area.origin, radiusM: row.area.radius_m, center: { ...destination },
          targetId: 'player', ...(row.area.shape ? { shape: row.area.shape } : {}) },
      } : {}),
    });
    arena.mobFlights.push({
      actionId: action.id, mobId: mob.id, mob: { ...mob }, source, destination,
      position: { ...source }, releaseAtUs: atUs, impactAtUs, speedMps: speed, radiusM: radius,
      skillId: row.id, kind: cast.delivery === 'ground' ? 'ground' : 'projectile',
      ...(cast.delivery === 'ground' ? { impactRadiusM: radius } : {}),
      areaKey: encounterKeyOf(s),
    });
  }

  function scheduleMobStrike(action: CombatArenaAction, mob: Mob) {
    if (!arena || !action.timing || action.releasedAtUs != null || action.timing.releaseAtUs > tickEndUs) return;
    clock.schedule(Math.max(tickStartUs, action.timing.releaseAtUs), EVENT_PRIORITY.mobAction, mob.id, 'player', () => {
      if (!arena) return;
      advanceArenaAt(clock.nowUs);
      const current = arena.actions.find(entry => entry.id === action.id);
      if (!current || current.cancelledAtUs != null || current.impactCount || current.releasedAtUs != null) return;
      const row = current.skillId ? mobSkillById(current.skillId) : undefined;
      const cast = row ? mobCastProfile(row, mob) : undefined;
      const actor = arena.mobs[mob.id];
      const geometry = row && cast && actor
        ? mobCastGeometry(row, mob, actor.radiusM ?? 0.25, arena.player.radiusM ?? 0.25,
          arenaDistance(actor, arena.player)) : undefined;
      if (!row || !cast || !geometry?.inRange || mob.hp <= 0 || !s.group.includes(mob) || s.player.hp <= 0
        || statusModsOn(s.mobStatus, mob.id).stopped
        || (mob.skillReadyAtUs?.[row.id] ?? 0) > clock.nowUs) {
        cancelMobPreparation(current, clock.nowUs, 'release-invalid');
        return;
      }
      // Commit the cooldown at the valid release, before any defence can return early.
      markMobSkillUsed(mob, row, clock.nowUs, units);
      if (cast.delivery === 'melee') {
        updateArenaAction(arena, current.id, { impactCount: 1, releasedAtUs: clock.nowUs,
          timing: { ...(current.timing as SkillCastTiming), impactAtUs: clock.nowUs } });
        resolveIncomingHit(mob, row, rng);
        return;
      }
      launchMobSkillShot(mob, row, cast, current, clock.nowUs);
    });
  }

  return { startMobBasic, scheduleMobBasic, launchMobSkillShot, scheduleMobStrike };
}
