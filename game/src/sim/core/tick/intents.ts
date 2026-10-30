import type { GameState, Mob } from '../types';
import type { Character } from '../player';
import type { CombatArena } from '../../combat/combat-arena';
import type { CombatClock } from '../../combat/combat-clock';
import type { CombatFlight, CombatIntent } from '../../combat/combat-actions';
import type { CastReport, PreparedSkillCast, TriggerAura } from '../../combat/skills';
import { E, sm } from '../../../engine/client';
import { EVENT_PRIORITY } from '../../combat/combat-clock';
import {
  arenaAction, arenaDistance, arenaSkillRange, updateArenaAction,
} from '../../combat/combat-arena';
import { intentTargets, trackIntentAim } from '../../combat/combat-actions';
import { prepareSkillCast, spendableMana, newCastRollCache, resolvePreparedCast } from '../../combat/skills';
import { skillCastTiming, releasedSkillCastTiming, targetsInSkillArea } from '../../../../../engine/skill-actions.ts';
import { dispatchSkillFlights } from './flights.ts';
import type { SkillCastTiming } from '../../../../../engine/types.ts';
import { isClear, sweepDisc } from '../../../../../engine/navigation.ts';
import { skillAreaSnapshot } from '../../../../../engine/skill-area.ts';
import { bundleOf } from '../../../../../engine/keystones.ts';
import { isBossKind } from '../kinds';
import { fieldAreaKey } from '../../world/field-area';

/**
 * The released cast: the live-clock advance before release, the windup, and the release itself.
 * Bodies arrive verbatim from the tick; the factory closes over the tick state and the arena work.
 */
export function createIntents(opts: {
  arena: CombatArena | undefined;
  clock: CombatClock;
  rng: () => number;
  s: GameState;
  c: Character;
  attackCharacter: Character;
  units: number;
  tickEndUs: number;
  timeUs: number | null;
  statuses: GameState['playerStatuses'];
  rkH: GameState['keystoneRuntime'];
  front: Mob | undefined;
  crippledOutgoingMult: number;
  playerActiveFraction: number;
  trig: { crit: TriggerAura | null; taken: TriggerAura | null };
  advanceLiveClocks: (atUs: number) => void;
  queueTrigger: (aura: TriggerAura | null, targetId: string) => void;
  recoverLeech: (amount: number, atUs: number) => void;
  mirrorReady: () => boolean;
  luckyBonus: () => number;
  tranceFree: () => boolean;
  resolveTargetsForSkill: ((id: string, group: Mob[]) => { targets: Mob[]; area?: any }) | undefined;
  resolveFlight: (flight: any, atUs: number, forced?: Mob[]) => void;
  scheduleFlight: (flight: any) => void;
  applyCastOutcome: (cast: CastReport | null, opts?: any) => void;
  applyCast: (cast: CastReport | null) => void;
  payCast: (cast: Pick<PreparedSkillCast, 'manaCost' | 'hpCost'>) => void;
  castFx: (id: string, area: any, targets: string[], actionId?: number, timing?: any, extra?: any) => void;
  cancelIntent: (reason: string) => void;
  cancelPlayerBasic: (reason: string) => void;
  cancelFlight: (flight: CombatFlight, atUs: number, reason: string) => void;
  fireTrigger: (aura: TriggerAura | null) => void;
}) {
  const encounterKeyOf = (state: GameState) => fieldAreaKey(state);
  const {
    arena, clock, rng, s, c, attackCharacter, units, tickEndUs, timeUs, statuses, rkH, front,
    crippledOutgoingMult, playerActiveFraction, trig, advanceLiveClocks, queueTrigger, recoverLeech,
    mirrorReady, luckyBonus, tranceFree, resolveTargetsForSkill, resolveFlight, scheduleFlight,
    applyCastOutcome, applyCast, payCast, castFx, cancelIntent, cancelPlayerBasic, cancelFlight,
    fireTrigger,
  } = opts;
  const phaseFloorUs = Math.round(Math.max(E.combat_arena.movement_step_sec,
    E.combat_arena.animation_phase_floor_sec ?? 0) * units);

    /** Cancel an unreleased player basic; a released swing keeps its pose and receipt. */
  

  

  

    /** Drop one released flight with its receipt; used when its encounter is no longer current. */
  

    const areaChanged = (flight: CombatFlight) => !!flight.areaKey && flight.areaKey !== encounterKeyOf(s);

    const arenaActors = (group: Mob[]) => group.flatMap((mob) =>
      mob.hp > 0 && arena?.mobs[mob.id] ? [{ ...arena.mobs[mob.id], mob }] : []);



    function startWindup(intent: CombatIntent, atUs: number) {
      if (!arena) return;
      const skill = sm.byId[intent.skillId];
      if (!skill) { cancelIntent('missing skill'); return; }
      const profile = sm.castProfileOf(skill);
      const resolved = intentTargets(arena, s.group, intent);
      const source = { x: arena.player.x, y: arena.player.y };
      const destination = resolved.area?.center ?? source;
      const timing = skillCastTiming(profile, atUs, units, source, destination,
        { cast: c.castSpeed, recovery: c.recoverySpeed, castReductionPct: c.castReductionPct }, phaseFloorUs);
      const action = arenaAction(arena, 'player', 'cast', atUs, intent.targetId, intent.skillId, resolved.area, timing);
      if (!action) { arena.intent = undefined; return; }
      intent.phase = 'windup';
      intent.actionId = action.id;
      intent.releaseAtUs = timing.releaseAtUs;
      intent.recoveryUntilUs = timing.recoveryUntilUs;
      intent.releaseQueued = false;
      arena.intent = intent;
      scheduleRelease(intent);
    }

    function scheduleRelease(intent: CombatIntent) {
      if (!arena || intent.releaseQueued || intent.releaseAtUs == null) return;
      if (intent.releaseAtUs > tickEndUs) return;
      intent.releaseQueued = true;
      clock.schedule(intent.releaseAtUs, EVENT_PRIORITY.playerAction, 'player', intent.targetId, () => {
        if (arena?.intent !== intent || intent.phase !== 'windup') return;
        releaseIntent(clock.nowUs);
      });
    }

    function releaseIntent(atUs: number) {
      const intent = arena?.intent;
      if (!arena || !intent || intent.phase !== 'windup' || intent.actionId == null) return;
      advanceLiveClocks(atUs);
      const action = arena.actions.find((entry) => entry.id === intent.actionId);
      if (!action || action.cancelledAtUs != null) { cancelIntent('action cancelled'); return; }
      const skill = sm.byId[intent.skillId];
      if (!skill) { cancelIntent('missing skill'); return; }
      const normalizedAction = sm.actionOf(skill);
      const failTerminal = () => {
        updateArenaAction(arena, action.id, {
          releasedAtUs: atUs, impactCount: 1,
          timing: { ...(action.timing as SkillCastTiming), releaseAtUs: atUs, impactAtUs: atUs },
        });
        intent.phase = 'recovery';
        arena.intent = intent;
      };
      // Authored cover is read at release, not only at acquisition: a screen raised
      // mid-windup still blocks a targeted strike. Ground placements need standable
      // ground at the moment they fire.
      if (arena.nav && (skill.type === 'attack' || skill.type === 'curse') && !intent.aimPoint
        && intent.targetId && arena.mobs[intent.targetId]
        && sweepDisc(arena.nav, arena.player, arena.mobs[intent.targetId], 0, 'sight')) {
        failTerminal();
        return;
      }
      if (arena.nav && intent.aimPoint && !isClear(arena.nav, intent.targetPoint, 0)) {
        failTerminal();
        return;
      }
      const profile = sm.castProfileOf(skill);
      const free = tranceFree();
      const force = mirrorReady();
      const lucky = luckyBonus();
      const env = {
        mobStatus: s.mobStatus, curses: s.curses, currentHp: s.player.hp,
        missingHpPct: c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0,
        isBoss: s.group.some((mob) => isBossKind(String(mob.kind))),
        timeUs: atUs, freeCast: free, forceCrit: force, critDamageBonusPct: lucky,
        spatialTargets: true,
        positionOf: (id: string) => arena.mobs[id] ? { x: arena.mobs[id].x, y: arena.mobs[id].y } : undefined,
        availableGroup: s.group,
        ...(intent.manual ? { ignoreConditions: true } : {}),
        ...(intent.manual && intent.aimPoint ? { allowEmptyTarget: true } : {}),
      };
      // Re-aim at release: the bodies may have moved since windup began, so the
      // committed footprint is recomputed from live positions instead of reusing the
      // windup snapshot. Buffs and heals keep the windup aim; impact still re-tests
      // living positions at impact for everything.
      let releaseArea = action.area;
      let releaseTargets = intentTargets(arena, s.group, intent, true).targets;
      if (intent.manual && intent.aimPoint) {
        // A manual ground request stays where it was placed, including empty permitted ground;
        // range is still re-tested at release, and the impact reads living bodies at that point.
        if (skill.area?.origin !== 'caster'
          && arenaDistance(arena.player, intent.targetPoint) > arenaSkillRange(skill.id) + 1e-7) {
          failTerminal();
          return;
        }
        const definition = skill.area ?? { origin: 'target' as const, radius_m: 0 };
        releaseArea = skillAreaSnapshot(definition, arena.player, intent.targetPoint, intent.targetId, arena.player.facing);
        releaseTargets = targetsInSkillArea(releaseArea, arenaActors(s.group)).map((actor) => actor.mob);
      } else if (skill.type === 'attack' || skill.type === 'curse') {
        const tracked = trackIntentAim(arena, s.group, intent);
        if (!tracked) { failTerminal(); return; }
        intent.targetPoint = tracked.targetPoint;
        const live = intentTargets(arena, s.group, intent, false);
        if (!live.targets.length) { failTerminal(); return; }
        releaseArea = live.area;
        releaseTargets = live.targets;
        arena.intent = intent;
      }
      // The release is the committed receipt: travel and recovery are measured from the actual
      // release source/aim, replacing the windup snapshot rather than keeping its old distance.
      let chainHopRange = 0;
      if (normalizedAction?.kind === 'chain-strike') {
        const primary = s.group.find((mob) => mob.id === intent.targetId && mob.hp > 0);
        if (!primary) { failTerminal(); return; }
        const pose = arena.mobs[primary.id];
        releaseArea = { origin: 'target', radiusM: 0, targetId: primary.id,
          center: pose ? { x: pose.x, y: pose.y } : { x: intent.targetPoint.x, y: intent.targetPoint.y } };
        releaseTargets = [primary];
        chainHopRange = Number(skill.area?.radius_m ?? 0) || 3;
      }
      const releaseSource = { x: arena.player.x, y: arena.player.y };
      // A caster-origin line or cone is aimed, not centred: the bolt travels to the far edge of
      // the footprint, while damage still propagates along the committed area (F16). Other
      // shapes resolve at their snapshot center.
      const downRange = releaseArea && releaseArea.origin === 'caster'
        && (releaseArea.shape === 'line' || releaseArea.shape === 'cone')
        && releaseArea.directionRad != null && releaseArea.lengthM != null;
      const releaseDestination = downRange
        ? { x: releaseSource.x + Math.cos(releaseArea!.directionRad!) * releaseArea!.lengthM!,
            y: releaseSource.y + Math.sin(releaseArea!.directionRad!) * releaseArea!.lengthM! }
        : releaseArea?.center ?? releaseSource;
      const releaseTiming = releasedSkillCastTiming(profile, action.timing?.startedAtUs ?? action.atUs,
        atUs, units, releaseSource, releaseDestination,
        { cast: c.castSpeed, recovery: c.recoverySpeed, castReductionPct: c.castReductionPct },
        phaseFloorUs);
      intent.recoveryUntilUs = releaseTiming.recoveryUntilUs;
      updateArenaAction(arena, action.id, { timing: releaseTiming, primaryTiming: releaseTiming, area: releaseArea,
        targetId: releaseArea?.targetId ?? intent.targetId,
        targetX: releaseArea?.center.x ?? releaseDestination.x, targetY: releaseArea?.center.y ?? releaseDestination.y });
      const prepared = prepareSkillCast(s.skills, attackCharacter, intent.skillId,
        spendableMana(attackCharacter, s.skills, s.player.mana), releaseTargets, statuses, env, releaseArea);
      if (!prepared) { failTerminal(); return; }
      payCast(prepared);
      const trance = bundleOf(c.keystones, 'trance');
      if (trance) rkH.counters.tranceCasts = (rkH.counters.tranceCasts || 0) + 1;
      if (force && skill.type === 'attack') rkH.flags.mirrorCrit = false;
      const struck = releaseArea
        ? targetsInSkillArea(releaseArea, arenaActors(s.group), profile.hit_radius_m).map((actor) => actor.mob.id)
        : [intent.targetId];
      castFx(intent.skillId, releaseArea, struck, action.id, releaseTiming);
      intent.phase = 'recovery';
      const flight: CombatFlight = {
        actionId: action.id, cast: prepared, character: attackCharacter,
        modifiers: { forceCrit: force, critDamageBonusPct: lucky,
          freeCast: free, missingHpPct: env.missingHpPct, outgoingDamageMult: crippledOutgoingMult },
        profile, timing: releaseTiming,
        source: releaseSource,
        destination: releaseDestination,
        area: releaseArea, position: { x: releaseSource.x, y: releaseSource.y }, lastCheckedAtUs: atUs,
        areaKey: encounterKeyOf(s),
      };
      if (skill.type === 'heal' || skill.type === 'buff') {
        const report = resolvePreparedCast(s.skills, attackCharacter, prepared, statuses, rng, env);
        applyCastOutcome(report, { pay: false, emitCast: false, castCounter: false, mirror: false,
          actionId: action.id, castTiming: releaseTiming });
        return;
      }
      if (normalizedAction?.kind === 'sand-field' || normalizedAction?.kind === 'blizzard-field') {
        // One deployed field per caster-skill-arena: a deliberate recast replaces it at release and
        // cancels only its unspent pulses. Resolved pulses and their rewards stay spent.
        for (const old of [...arena.flights]) {
          if (old.cast.id !== skill.id) continue;
          const at = arena.flights.indexOf(old);
          if (at >= 0) arena.flights.splice(at, 1);
          const oldAction = arena.actions.find((entry) => entry.id === old.actionId);
          if (oldAction && oldAction.cancelledAtUs == null)
            updateArenaAction(arena, oldAction.id, { cancelledAtUs: atUs, cancelReason: 'replaced', endsAtUs: atUs });
        }
      }
      const dispatched = dispatchSkillFlights(flight, normalizedAction, skill, releaseTiming, units, {
        chainHopRange, boundTargetId: intent.targetId,
      });
      if (normalizedAction) {
        if (dispatched.recoveryUntilUs != null) {
          intent.recoveryUntilUs = dispatched.recoveryUntilUs;
          updateArenaAction(arena, action.id, {
            ...(dispatched.channel ? { channel: true } : {}),
            timing: { ...releaseTiming, recoveryUntilUs: intent.recoveryUntilUs },
            ...(dispatched.primaryTiming ? { primaryTiming: { ...releaseTiming, recoveryUntilUs: intent.recoveryUntilUs } } : {}),
          });
        }
        if (dispatched.mobile) {
          intent.mobile = true;
          intent.speedMult = dispatched.speedMult;
        }
        if (dispatched.endsAtUs != null) {
          updateArenaAction(arena, action.id, {
            endsAtUs: Math.max(action.endsAtUs, dispatched.endsAtUs + E.combat_arena.action_sec * units),
          });
        }
        for (const entry of dispatched.flights) {
          arena.flights.push(entry);
          scheduleFlight(entry);
        }
        return;
      }
      if (profile.delivery === 'projectile') {
        arena.flights.push(flight);
        scheduleFlight(flight);
        return;
      }
      if (action.timing && action.timing.impactAtUs > atUs) {
        arena.flights.push(flight);
        scheduleFlight(flight);
        return;
      }
      resolveFlight(flight, atUs);
    }

  return { startWindup, scheduleRelease, releaseIntent };
}
