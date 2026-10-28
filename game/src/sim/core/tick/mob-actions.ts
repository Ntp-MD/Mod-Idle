import type { GameState, Mob } from '../types';
import type { CombatArena, CombatArenaAction } from '../../combat/combat-arena';
import type { CombatClock } from '../../combat/combat-clock';
import type { MobCastProfile, MobSkillRow, SkillCastTiming } from '../../../../../engine/types.ts';
import { E } from '../../../engine/client';
import { EVENT_PRIORITY, planAttacks } from '../../combat/combat-clock';
import {
  arenaAction, arenaInRange, arenaMobInReach, updateArenaAction,
  mobAttackProfile, arenaDistance,
} from '../../combat/combat-arena';
import { basicPhaseBudget } from '../../../../../engine/attack-range.ts';
import {
  mobCastGeometry, mobCastProfile, mobSkillById, markMobSkillUsed, mobPhase,
  mobStrikeRange, planMobSkills, readyMobSkill,
} from '../../combat/mobSkills';
import { modsOn as statusModsOn } from '../../combat/mobStatus';
import { fieldAreaKey } from '../../world/field-area';
import { fx, hitColour } from '../feedback';
import { push } from '../log';

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
  mobMods: (mobId: string) => { attackSpeed: number };
  mobPlans: { mob: Mob; rate: number; actionsLeft: number }[];
  online: boolean;
}) {
  const {
    arena, clock, rng, s, units, tickStartUs, tickEndUs, advanceArenaAt, launchMobShot,
    cancelMobPreparation, resolveIncomingHit, mobMods, mobPlans, online,
  } = opts;
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

  /** Schedule one engaged body from the moment it joins; duplicate schedules are ignored. */
  const scheduledMobs = new Set<string>();
  function scheduleMobAttacksFor(mob: Mob, fromUs: number): void {
    if (scheduledMobs.has(mob.id)) return;
    scheduledMobs.add(mob.id);
    if (mob.hp <= 0 || !s.group.includes(mob)) return;
    // Encounter phase (F25): a body that crosses one of its kit's HP gates fights the next phase
    // down. The gate, not a timer, owns the transition, and the log names it once.
    const rows = (mob.skillIds || []).map((id) => mobSkillById(id)).filter((row) => !!row);
    const phase = mobPhase(mob, rows);
    if (phase > (mob.phase ?? 0)) push(s, `${mob.species} shifts tactics (phase ${phase})`);
    mob.phase = phase;
    const tm = mobMods(mob.id);
    const rate = mob.hitsPerSec * (mob.auraSpeedMult ?? 1) * Math.max(0, 1 + tm.attackSpeed / 100);
    const plan = planAttacks(fromUs, mob.atkTimer, rate, units, Math.max(0, tickEndUs - fromUs));
    mob.atkTimer = plan.progressAtEnd;
    const pending = { mob, rate, actionsLeft: plan.times.length };
    mobPlans.push(pending);
    const skillPlan = arena ? undefined : planMobSkills(mob, plan.times, units);
    for (const atUs of plan.times) {
      const plannedSkill = skillPlan?.get(atUs);
      if (plannedSkill) {
        // The cast beat is placed before the action, clamped to this window; the swing itself still
        // lands on the planned action time, so the telegraph never changes the DPS clock.
        const castAt = Math.max(fromUs, atUs - Math.max(0, mobCastProfile(plannedSkill, mob).windup_sec) * units);
        clock.schedule(castAt, EVENT_PRIORITY.mobAction, mob.id, 'player', () => {
          if (mob.hp <= 0 || !s.group.includes(mob)) return;
          advanceArenaAt(clock.nowUs);
          if (s.field && !s.field.engagementIds.includes(mob.id)) return;
          if (statusModsOn(s.mobStatus, mob.id).stopped) return;
          if (arena && !arenaInRange(arena, mob.id, mobStrikeRange(plannedSkill, mob))) return;
          fx(s, { kind: 'cast', side: 'field', mobId: mob.id, skillId: plannedSkill.id, text: plannedSkill.name, colour: hitColour(plannedSkill.element) });
          // The telegraph owns the body from its cast beat to the strike beat, so preparation
          // reads at the authored length instead of the default 0.3s action tail.
          const castAction = arena && [...arena.actions].reverse().find((entry) => entry.actorId === mob.id
            && entry.kind === 'cast' && entry.skillId === plannedSkill.id
            && entry.atUs === clock.nowUs && !entry.timing);
          if (arena && castAction) updateArenaAction(arena, castAction.id, {
            timing: { delivery: 'melee', startedAtUs: clock.nowUs, releaseAtUs: atUs, impactAtUs: atUs, recoveryUntilUs: atUs },
            endsAtUs: Math.max(castAction.endsAtUs, atUs),
          });
          if (online) push(s, `${mob.species} begins ${plannedSkill.name}`);
        });
      }
      clock.schedule(atUs, EVENT_PRIORITY.mobAction, mob.id, 'player', () => {
        pending.actionsLeft--;
        if (mob.hp <= 0 || !s.group.includes(mob)) return;
        advanceArenaAt(clock.nowUs);
        if (s.field && !s.field.engagementIds.includes(mob.id)) return;
        // Hard control before the beat cancels the attack and leaves the strike's cooldown unspent.
        if (statusModsOn(s.mobStatus, mob.id).stopped) return;
        if (arena) {
          const owned = arena.mobs[mob.id]?.action;
          if (owned?.kind === 'cast' && owned.timing && owned.cancelledAtUs == null
            && !owned.impactCount && owned.timing.releaseAtUs >= atUs) return;
        }
        // A ready strike replaces the opportunity only while its role reach holds. An out-of-reach
        // strike does not block the ordinary attack, and the mob never walks in just to enable it.
        const strike = readyMobSkill(mob, atUs, row => !arena || arenaInRange(arena, mob.id, mobStrikeRange(row, mob)));
        if (!strike && arena && !arenaMobInReach(arena, mob.id)) return;
        if (arena && strike) {
          const cast = mobCastProfile(strike, mob);
          const releaseAtUs = atUs + Math.ceil(Math.max(0, cast.windup_sec) * units);
          const recoveryUs = Math.ceil(Math.max(0, cast.recovery_sec) * units);
          const impactAtUs = cast.delivery === 'ground'
            ? releaseAtUs + Math.ceil(Math.max(0.001, Number(cast.impact_delay_sec) || 0.4) * units)
            : releaseAtUs;
          const timing: SkillCastTiming = { delivery: cast.delivery, startedAtUs: atUs,
            releaseAtUs, impactAtUs, recoveryUntilUs: releaseAtUs + recoveryUs };
          const action = arenaAction(arena, mob.id, 'cast', atUs, 'player', strike.id, undefined, timing);
          if (action) {
            fx(s, { kind: 'cast', side: 'field', mobId: mob.id, skillId: strike.id,
              actionId: action.id, castTiming: timing, text: strike.name, colour: hitColour(strike.element) });
            scheduleMobStrike(action, mob);
            if (online) push(s, `${mob.species} begins ${strike.name}`);
          }
          return;
        }
        if (arena) {
          startMobBasic(mob, clock.nowUs, rate);
          return;
        }
        if (strike) markMobSkillUsed(mob, strike, clock.nowUs, units);
        resolveIncomingHit(mob, strike, rng);
      });
    }
  }

  return { startMobBasic, scheduleMobBasic, launchMobSkillShot, scheduleMobStrike, scheduleMobAttacksFor };
}
