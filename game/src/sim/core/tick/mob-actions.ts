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
import { sweepDisc } from '../../../../../engine/navigation.ts';
import {
  mobCastGeometry, mobCastProfile, mobSkillById, markMobSkillUsed, mobPhase,
  mobStrikeRange, planMobSkills, readyMobSkill,
} from '../../combat/mobSkills';
import { modsOn as statusModsOn } from '../../combat/mobStatus';
import { fieldAreaKey } from '../../world/field-area';
import { fx, hitColour } from '../feedback';
import { push } from '../log';

/**
 * One mob's attacks for the rest of a world second. The times are expanded once from the second's
 * own progress, so twenty 50 ms windows and one 1 s window keep the same beats. Windows only
 * schedule the next due times; the plan is never re-derived from a window boundary.
 */
export interface MobAttackPlan {
  mob: Mob;
  rate: number;
  times: number[];
  /** Non-arena telegraphs: the cast beat that precedes a planned strike. */
  castBeats: { atUs: number; attackAtUs: number; skill: MobSkillRow }[];
  progressAtEnd: number;
  nextAttack: number;
  nextCast: number;
  fired: number;
}

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
  /** End of the open world second: an attack plan covers up to here, not just this window. */
  secondEndUs: number;
  plans: Map<string, MobAttackPlan>;
  advanceArenaAt: (atUs: number) => void;
  launchMobShot: (mob: Mob, atUs: number, existing?: CombatArenaAction) => void;
  cancelMobPreparation: (action: CombatArenaAction, atUs: number, reason: string) => void;
  resolveIncomingHit: (mob: Mob, plannedSkill: MobSkillRow | undefined, rng: () => number) => void;
  mobMods: (mobId: string) => { attackSpeed: number };
  /** A delay shifts the stored plan's future beats and the live events of this window. */
  shiftPlan?: (mobId: string, delaySec: number) => void;
  /** F25 boss adds: a phase gate summons its own bodies; reward settlement stays ordinary. */
  onPhaseAdds?: (mob: Mob, phase: number) => void;
  online: boolean;
}) {
  const {
    arena, clock, rng, s, units, tickStartUs, tickEndUs, advanceArenaAt, launchMobShot,
    cancelMobPreparation, resolveIncomingHit, mobMods, online,
  } = opts;
  const encounterKeyOf = (state: GameState) => fieldAreaKey(state);

  /** A committed charge travels to the point frozen at windup, never to the player's new feet. */
  function commitCharge(mob: Mob, action: CombatArenaAction, cast: MobCastProfile, atUs: number): void {
    if (!arena || !cast.charge) return;
    const actor = arena.mobs[mob.id];
    if (!actor) return;
    const target = { x: action.targetX ?? arena.player.x, y: action.targetY ?? arena.player.y };
    const dx = target.x - actor.x;
    const dy = target.y - actor.y;
    const distance = Math.hypot(dx, dy);
    const travel = Math.min(Math.max(0, cast.charge.distance_m), distance);
    if (!(travel > 0) || !(distance > 1e-9)) return;
    const from = { x: actor.x, y: actor.y };
    let to = { x: actor.x + dx / distance * travel, y: actor.y + dy / distance * travel };
    if (arena.nav) {
      const contact = sweepDisc(arena.nav, from, to, actor.radiusM ?? 0.25, 'movement');
      if (contact) {
        const keep = Math.max(0, contact.fraction - 1e-6);
        to = { x: from.x + (to.x - from.x) * keep, y: from.y + (to.y - from.y) * keep };
      }
    }
    const moved = Math.hypot(to.x - from.x, to.y - from.y);
    actor.x = to.x;
    actor.y = to.y;
    actor.moving = moved > 1e-7;
    actor.voluntaryM = (actor.voluntaryM ?? 0) + moved;
    void atUs;
  }

  function startMobBasic(mob: Mob, atUs: number, rate: number): void {
    if (!arena) return;
    const profile = mobAttackProfile(mob);
    const intervalUs = Math.round(units / Math.max(1e-9, rate));
    const phase = basicPhaseBudget(profile, intervalUs,
      Math.round((E.combat_arena.animation_phase_floor_sec ?? 0) * units));
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
      const reach = row && actor
        ? arenaDistance(actor, arena.player) : undefined;
      const geometry = row && cast && actor
        ? mobCastGeometry(row, mob, actor.radiusM ?? 0.25, arena.player.radiusM ?? 0.25, reach ?? 0) : undefined;
      const chargeReach = Math.max(0, Number(cast?.charge?.distance_m) || 0);
      const releasedInReach = !!geometry?.inRange
        || (chargeReach > 0 && reach != null && reach <= mobStrikeRange(row!, mob) + chargeReach + 1e-7);
      if (!row || !cast || !releasedInReach || mob.hp <= 0 || !s.group.includes(mob) || s.player.hp <= 0
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
        commitCharge(mob, current, cast, clock.nowUs);
        // A lunge that stopped short of the body is a miss; damage only follows real contact.
        if (arenaMobInReach(arena, mob.id)) resolveIncomingHit(mob, row, rng);
        return;
      }
      launchMobSkillShot(mob, row, cast, current, clock.nowUs);
    });
  }

  /** The full-second plan is created on the body's first call in a second, then advanced per window. */
  function scheduleMobAttacksFor(mob: Mob, fromUs: number): void {
    if (mob.hp <= 0 || !s.group.includes(mob)) return;
    let plan = opts.plans.get(mob.id);
    if (!plan) {
      // Encounter phase (F25): a body that crosses one of its kit's HP gates fights the next phase
      // down. The gate, not a timer, owns the transition, and the log names it once.
      const rows = (mob.skillIds || []).map((id) => mobSkillById(id)).filter((row) => !!row);
      const phase = mobPhase(mob, rows);
      const previousPhase = mob.phase ?? 0;
      if (phase > previousPhase) {
        push(s, `${mob.species} shifts tactics (phase ${phase})`);
        opts.onPhaseAdds?.(mob, phase);
      }
      mob.phase = phase;
      const tm = mobMods(mob.id);
      const rate = Math.max(1e-9, mob.hitsPerSec * (mob.auraSpeedMult ?? 1) * Math.max(0, 1 + tm.attackSpeed / 100));
      const expanded = planAttacks(fromUs, mob.atkTimer, rate, units, Math.max(0, opts.secondEndUs - fromUs));
      const castBeats = arena ? [] : [...(planMobSkills(mob, expanded.times, units) || new Map()).entries()]
        .map(([attackAtUs, skill]) => ({
          skill,
          attackAtUs,
          atUs: Math.max(fromUs, attackAtUs - Math.max(0, mobCastProfile(skill, mob).windup_sec) * units),
        }))
        .sort((a, b) => a.atUs - b.atUs || (a.skill.id < b.skill.id ? -1 : 1));
      plan = {
        mob, rate, times: expanded.times, castBeats, progressAtEnd: expanded.progressAtEnd,
        nextAttack: 0, nextCast: 0, fired: 0,
      };
      opts.plans.set(mob.id, plan);
      mob.atkTimer = expanded.progressAtEnd;
    }
    // Only the beats that fall in this window are queued; the next window continues the same plan.
    for (; plan.nextCast < plan.castBeats.length; plan.nextCast++) {
      const beat = plan.castBeats[plan.nextCast];
      if (beat.atUs > tickEndUs) break;
      if (beat.atUs < tickStartUs) continue;
      const plannedSkill = beat.skill;
      clock.schedule(beat.atUs, EVENT_PRIORITY.mobAction, mob.id, 'player', () => {
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
          timing: { delivery: 'melee', startedAtUs: clock.nowUs, releaseAtUs: beat.attackAtUs, impactAtUs: beat.attackAtUs, recoveryUntilUs: beat.attackAtUs },
          endsAtUs: Math.max(castAction.endsAtUs, beat.attackAtUs),
        });
        if (online) push(s, `${mob.species} begins ${plannedSkill.name}`);
      });
    }
    for (; plan.nextAttack < plan.times.length; plan.nextAttack++) {
      const atUs = plan.times[plan.nextAttack];
      if (atUs > tickEndUs) break;
      if (atUs < tickStartUs) { plan.fired++; continue; }
      const pace = plan;
      clock.schedule(atUs, EVENT_PRIORITY.mobAction, mob.id, 'player', () => {
        pace.fired++;
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
        // A ready strike replaces the opportunity only while its role reach holds. A committed
        // charge may start at its own lunge distance; an out-of-reach strike never blocks the
        // ordinary attack, and the mob never walks in just to enable it.
        const strikeReach = (row: MobSkillRow) => mobStrikeRange(row, mob)
          + Math.max(0, Number(row.cast?.charge?.distance_m) || 0);
        const strike = readyMobSkill(mob, atUs, row => !arena || arenaInRange(arena, mob.id, strikeReach(row)));
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
          startMobBasic(mob, clock.nowUs, pace.rate);
          return;
        }
        if (strike) markMobSkillUsed(mob, strike, clock.nowUs, units);
        resolveIncomingHit(mob, strike, rng);
      });
    }
  }

  return { startMobBasic, scheduleMobBasic, launchMobSkillShot, scheduleMobStrike, scheduleMobAttacksFor };
}
