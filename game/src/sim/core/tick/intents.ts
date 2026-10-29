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

    /** Cancel an unreleased player basic; a released swing keeps its pose and receipt. */
  

  

  

    /** Drop one released flight with its receipt; used when its encounter is no longer current. */
  

    const areaChanged = (flight: CombatFlight) => !!flight.areaKey && flight.areaKey !== encounterKeyOf(s);

    const arenaActors = (group: Mob[]) => group.flatMap((mob) =>
      mob.hp > 0 && arena?.mobs[mob.id] && !arena.mobs[mob.id].returning
        ? [{ ...arena.mobs[mob.id], mob }] : []);



    function startWindup(intent: CombatIntent, atUs: number) {
      if (!arena) return;
      const skill = sm.byId[intent.skillId];
      if (!skill) { cancelIntent('missing skill'); return; }
      const profile = sm.castProfileOf(skill);
      const resolved = intentTargets(arena, s.group, intent);
      const source = { x: arena.player.x, y: arena.player.y };
      const destination = resolved.area?.center ?? source;
      const stepFloorUs = Math.round(E.combat_arena.movement_step_sec * units);
      const timing = skillCastTiming(profile, atUs, units, source, destination,
        { cast: c.castSpeed, recovery: c.recoverySpeed }, stepFloorUs);
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
      if (skill.action?.kind === 'chain-strike') {
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
        { cast: c.castSpeed, recovery: c.recoverySpeed },
        Math.round(E.combat_arena.movement_step_sec * units));
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
      if (skill.action?.kind === 'sand-field') {
        const scaled = sm.effectsAt(skill, prepared.level) as { stat: string; value: number }[];      const dotSec = Math.max(0, Math.floor(Number(scaled.find((effect) => effect.stat === 'dot_sec')?.value ?? 0)));
        const dotDps = Math.max(0, Number(scaled.find((effect) => effect.stat === 'dot_dps')?.value ?? 0));
        for (const old of [...arena.flights]) {
          if (old.cast.id !== skill.id) continue;
          const at = arena.flights.indexOf(old);
          if (at >= 0) arena.flights.splice(at, 1);
          const oldAction = arena.actions.find((entry) => entry.id === old.actionId);
          if (oldAction && oldAction.cancelledAtUs == null)
            updateArenaAction(arena, oldAction.id, { cancelledAtUs: atUs, cancelReason: 'replaced', endsAtUs: atUs });
        }
        const flights: CombatFlight[] = [{ ...flight, fieldInitial: true, impactIndex: 0, impactSharePct: 100 }];
        for (let index = 1; index <= dotSec; index++) {
          flights.push({ ...flight, fieldPulseDamage: dotDps,
            timing: { ...releaseTiming, impactAtUs: releaseTiming.releaseAtUs + index * units },
            impactIndex: index, impactSharePct: 100 });
        }
        const lastImpact = releaseTiming.releaseAtUs + dotSec * units;
        updateArenaAction(arena, action.id, {
          endsAtUs: Math.max(action.endsAtUs, lastImpact + E.combat_arena.action_sec * units),
        });
        for (const entry of flights) {
          arena.flights.push(entry);
          scheduleFlight(entry);
        }
        return;
      }
      if (skill.action?.kind === 'chain-strike') {
        const cache = newCastRollCache();
        const count = Math.max(1, Number(String(skill.targets ?? '1').split('/')[0]) || 1);
        // T5: hop cadence and share are canonical action data (80ms, 60%); the fallbacks only
        // preserve the baseline when an old row omits them — no tuning cap is invented here.
        const rawInterval = Number(skill.action.interval_sec ?? 0.08);
        const intervalSec = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : 0.08;
        const rawShare = Number((skill.action as { hop_share_pct?: unknown }).hop_share_pct ?? 60);
        const sharePct = Number.isFinite(rawShare) && rawShare >= 0 ? rawShare : 60;
        const chained: CombatFlight = {
          ...flight, rolls: cache, impactIndex: 0, impactSharePct: 100,
          chain: {
            visited: [releaseArea?.targetId ?? intent.targetId],
            remaining: Math.max(0, count - 1),
            hopRange: chainHopRange,
            sharePct,
            intervalSec,
          },
        };
        arena.flights.push(chained);
        scheduleFlight(chained);
        return;
      }
      const actionDef = skill.action;
      if (actionDef) {
        const scaled = sm.effectsAt(skill, prepared.level) as { stat: string; value: number }[];
        const count = Math.max(1, Number(scaled.find((effect) => effect.stat === 'hits')?.value ?? 1));
        if (count > 1) {
          const sharePct = Number(scaled.find((effect) => effect.stat === 'hit_pct')?.value ?? 100);
          const cache = newCastRollCache();
          const recoveryUs = Math.ceil(profile.recovery_sec / Math.max(1e-7, c.recoverySpeed || 1) * units);
          // One deployed field per caster-skill-arena: a deliberate recast replaces it at release and
          // cancels only its unspent pulses. Resolved pulses and their rewards stay spent.
          if (actionDef.kind === 'blizzard-field') {
            for (const old of [...arena.flights]) {
              if (old.cast.id !== skill.id) continue;
              const at = arena.flights.indexOf(old);
              if (at >= 0) arena.flights.splice(at, 1);
              const oldAction = arena.actions.find((entry) => entry.id === old.actionId);
              if (oldAction && oldAction.cancelledAtUs == null)
                updateArenaAction(arena, oldAction.id, { cancelledAtUs: atUs, cancelReason: 'replaced', endsAtUs: atUs });
            }
          }
          const flights: CombatFlight[] = [];
          for (let index = 0; index < count; index++) {
            let timing = releaseTiming;
            let follow = false;
            if (actionDef.kind === 'projectile-burst') {
              const releaseAt = releaseTiming.releaseAtUs
                + Math.round(index * Number(actionDef.interval_sec ?? 0.15) * units);
              timing = { ...releaseTiming, releaseAtUs: releaseAt,
                impactAtUs: releaseAt + Math.max(0, releaseTiming.impactAtUs - releaseTiming.releaseAtUs),
                recoveryUntilUs: releaseAt + recoveryUs };
            } else if (actionDef.kind === 'ground-pulse-burst') {
              timing = { ...releaseTiming,
                impactAtUs: releaseTiming.impactAtUs
                  + Math.round(index * Number(actionDef.interval_sec ?? 0.3) * units) };
            } else if (actionDef.kind === 'blizzard-field') {
              const durationSec = Number.parseFloat(String(skill.duration ?? '')) || 8;
              timing = { ...releaseTiming,
                impactAtUs: releaseTiming.releaseAtUs
                  + Math.round(durationSec * units * (index + 1) / count) };
            } else {
              // Whirlwind: a caster-following pulse at the authored share of its active window.
              const activeUs = Number(actionDef.active_sec ?? 1.2) * units;
              const impactAt = releaseTiming.releaseAtUs + Math.round(activeUs * (index + 1) / count);
              timing = { ...releaseTiming, impactAtUs: impactAt, recoveryUntilUs: impactAt + recoveryUs };
              follow = true;
            }
            flights.push({ ...flight, timing, ...(follow ? { follow: true } : {}),
              impactIndex: index, impactSharePct: sharePct, rolls: cache });
          }
          if (actionDef.kind === 'whirlwind-channel') {
            intent.mobile = true;
            intent.speedMult = Number(actionDef.movement_speed_mult ?? 0.6);
            intent.recoveryUntilUs = Math.max(...flights.map((entry) => entry.timing.impactAtUs)) + recoveryUs;
            updateArenaAction(arena, action.id, {
              channel: true,
              timing: { ...releaseTiming, recoveryUntilUs: intent.recoveryUntilUs },
              primaryTiming: { ...releaseTiming, recoveryUntilUs: intent.recoveryUntilUs },
            });
          } else if (actionDef.kind === 'projectile-burst') {
            intent.recoveryUntilUs = Math.max(...flights.map((entry) => entry.timing.releaseAtUs)) + recoveryUs;
            updateArenaAction(arena, action.id, {
              channel: true,
              timing: { ...releaseTiming, recoveryUntilUs: intent.recoveryUntilUs },
            });
          }
          const lastImpact = Math.max(...flights.map((entry) => entry.timing.impactAtUs));
          updateArenaAction(arena, action.id, {
            endsAtUs: Math.max(action.endsAtUs, lastImpact + E.combat_arena.action_sec * units),
          });
          for (const entry of flights) {
            arena.flights.push(entry);
            scheduleFlight(entry);
          }
          return;
        }
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
