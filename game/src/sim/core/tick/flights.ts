import type { GameState, Mob } from '../types';
import type { CombatArena } from '../../combat/combat-arena';
import type { CombatClock } from '../../combat/combat-clock';
import type { CombatFlight } from '../../combat/combat-actions';
import type { Statuses } from '../../combat/combat';
import type { CastReport } from '../../combat/skills';
import { E, sm } from '../../../engine/client';
import { EVENT_PRIORITY } from '../../combat/combat-clock';
import { arenaDistance, arenaSkillRange, updateArenaAction } from '../../combat/combat-arena';
import { flightTargets, projectilePosition } from '../../combat/combat-actions';
import { firstProjectileHit } from '../../../../../engine/skill-actions.ts';
import { sweepDisc } from '../../../../../engine/navigation.ts';
import { resolvePreparedCast, newCastRollCache } from '../../combat/skills';
import { fieldAreaKey } from '../../world/field-area';

/**
 * The player's released flights: the queued impact, the contact resolution, and the per-step sweep
 * that catches a projectile on the body it crosses. The tick owns the clock and the cast outcome.
 */
export function createFlights(opts: {
  arena: CombatArena | undefined;
  clock: CombatClock;
  rng: () => number;
  s: GameState;
  statuses: Statuses;
  units: number;
  tickStartUs: number;
  tickEndUs: number;
  advanceLiveClocks: (atUs: number) => void;
  applyCastOutcome: (cast: CastReport | null, opts?: any) => void;
  cancelIntent: (reason: string) => void;
  cancelFlight: (flight: CombatFlight, atUs: number, reason: string) => void;
}) {
  const {
    arena, clock, rng, s, statuses, units, tickStartUs, tickEndUs,
    advanceLiveClocks, applyCastOutcome, cancelIntent, cancelFlight,
  } = opts;
  const areaChanged = (flight: CombatFlight) => !!flight.areaKey && flight.areaKey !== fieldAreaKey(s);
  const arenaActors = (group: Mob[]) => group.flatMap((mob) =>
    mob.hp > 0 && arena?.mobs[mob.id] ? [{ ...arena.mobs[mob.id], mob }] : []);

  /** A fizzled lock-on payload: removed with a terminal receipt, no damage, no retry. */
  function fizzleFlight(flight: CombatFlight, atUs: number) {
    if (!arena) return;
    const at = arena.flights.indexOf(flight);
    if (at >= 0) arena.flights.splice(at, 1);
    const action = arena.actions.find((entry) => entry.id === flight.actionId);
    if (action && action.cancelledAtUs == null) {
      updateArenaAction(arena, action.id, {
        ...(action.payloads ? { payloads: action.payloads.map((payload) => payload.index === (flight.impactIndex ?? 0)
          ? { ...payload, impactAtUs: atUs, contact: { ...flight.destination } }
          : payload) } : {}),
        impactCount: (action.impactCount ?? 0) + 1,
        endsAtUs: Math.max(action.endsAtUs, atUs + E.combat_arena.action_sec * units),
      });
    }
  }

  function boundTarget(flight: CombatFlight): Mob | undefined {
    if (!flight.boundTargetId) return undefined;
    const target = s.group.find((mob) => mob.id === flight.boundTargetId && mob.hp > 0);
    return target;
  }

  function scheduleFlight(flight: CombatFlight) {
    if (!arena || flight.queued) return;
    if (flight.profile.delivery === 'projectile') {
      const action = arena.actions.find(entry => entry.id === flight.actionId);
      const index = flight.impactIndex ?? 0;
      if (action && !action.payloads?.some(payload => payload.index === index)) {
        updateArenaAction(arena, action.id, { payloads: [...(action.payloads ?? []), {
          index, source: { ...flight.source }, destination: { ...flight.destination },
          releaseAtUs: flight.timing.releaseAtUs, plannedImpactAtUs: flight.timing.impactAtUs,
          targetId: flight.area?.targetId,
        }] });
      }
    }
    const atUs = Math.max(tickStartUs, flight.timing.impactAtUs);
    if (atUs > tickEndUs) return;
    flight.queued = true;
    clock.schedule(atUs, EVENT_PRIORITY.secondary, 'player', flight.area?.targetId ?? 'group', () => {
      flight.queued = false;
      if (arena?.flights.includes(flight)) resolveFlight(flight, clock.nowUs);
    });
  }

  function resolveFlight(flight: CombatFlight, atUs: number, forced?: Mob[], contact?: { x: number; y: number }) {
    if (!arena) return;
    if (areaChanged(flight)) { cancelFlight(flight, atUs, 'area-exit'); return; }
    // C3 lock-on: a dead or returned bound body fizzles the remaining payloads — no re-acquire.
    // Straight payloads also re-check cast range at resolve; homing already enforces its pursuit
    // bound every sample and arrives on the bound body.
    if (flight.boundTargetId) {
      const bound = boundTarget(flight);
      const pose = bound ? arena.mobs[bound.id] : undefined;
      const inRange = !!bound && !!pose
        && arenaDistance(arena.player, pose) <= arenaSkillRange(flight.cast.id) + 1e-7;
      if (!inRange) { fizzleFlight(flight, atUs); return; }
      if (flight.homing && !flight.hitTargetId) flight.hitTargetId = bound!.id;
    }
    // A caster-following pulse reads the current caster centre; a deployed field never does.
    if (flight.follow && flight.area) {
      const center = { x: arena.player.x, y: arena.player.y };
      flight.source = { ...center };
      flight.destination = { ...center };
      flight.area = { ...flight.area, center };
      flight.position = { ...center };
    }
    const at = arena.flights.indexOf(flight);
    if (at >= 0) arena.flights.splice(at, 1);
    advanceLiveClocks(atUs);
    if (contact) flight.destination = contact;
    // The resolved impact time replaces the planned arrival once; every later reader (event,
    // action, history) sees the same corrected fact.
    flight.timing = { ...flight.timing, impactAtUs: atUs };
    const targets = forced ?? (flight.hitTargetId
      ? s.group.filter((mob) => mob.id === flight.hitTargetId && mob.hp > 0)
      : flightTargets(arena, s.group, flight));
    const report = resolvePreparedCast(s.skills, flight.character,
      { ...flight.cast, targets, area: flight.area }, statuses, rng, {
        ...flight.modifiers, mobStatus: s.mobStatus, curses: s.curses, timeUs: atUs,
        availableGroup: s.group,
        positionOf: (id) => arena.mobs[id] ? { x: arena.mobs[id].x, y: arena.mobs[id].y } : undefined,
        ...(flight.rolls ? {
          impact: { index: flight.impactIndex ?? 0, sharePct: flight.impactSharePct ?? 100, cache: flight.rolls },
        } : {}),
        ...(flight.fieldInitial ? { suppressErosion: true } : {}),
        ...(flight.fieldPulseDamage != null ? { fieldPulse: flight.fieldPulseDamage } : {}),
      });
    applyCastOutcome(report, { pay: false, emitCast: false, castCounter: false, mirror: false,
      actionId: flight.actionId, castTiming: flight.timing });
    const action = arena.actions.find((entry) => entry.id === flight.actionId);
    if (action) updateArenaAction(arena, action.id, {
      ...(action.payloads ? { payloads: action.payloads.map(payload => payload.index === (flight.impactIndex ?? 0)
        ? { ...payload, impactAtUs: atUs, contact: { ...flight.destination }, targetId: flight.hitTargetId ?? payload.targetId }
        : payload) } : {}),
      hitIds: [...new Set([...(action.hitIds ?? []), ...report.byMob.map((hit) => hit.id)])],
      impactCount: (action.impactCount ?? 0) + 1,
      // C3: the action keeps the body the press was locked onto; an interceptor is a payload
      // receipt (`payloads[i].targetId`), never the action's intended target.
      ...(flight.hitTargetId && !flight.boundTargetId ? { targetId: flight.hitTargetId } : {}),
      ...(contact && flight.area?.radiusM === 0 ? { area: { ...flight.area, center: contact } } : {}),
      ...(contact ? { targetX: contact.x, targetY: contact.y } : {}),
      timing: flight.timing,
      endsAtUs: Math.max(action.endsAtUs, atUs + E.combat_arena.action_sec * units),
    });
    if (arena.intent && arena.intent.actionId === flight.actionId
      && arena.intent.phase === 'windup') cancelIntent('impact');
    // C1 cluster (decided, no live adopter): the parent impact spawns each authored child once —
    // same speed/delay/footprint, ±spread around the parent bearing, its own independent rolls so a
    // body in both circles takes parent + child (overlap is the design, not a duplicate bug). A
    // child (impactIndex > 0) never spawns its own children. Kill credit stays single: bodies leave
    // the field on the first fatal hit and every later receipt finds them gone.
    const clusterAction = sm.byId[flight.cast.id]?.action?.kind === 'cluster-burst'
      ? sm.byId[flight.cast.id].action : undefined;
    if (clusterAction && (flight.impactIndex ?? 0) === 0 && flight.area && flight.area.radiusM > 0) {
      const count = Math.floor(Number(clusterAction.child_count));
      const share = Number(clusterAction.child_share_pct);
      const spread = Number(clusterAction.spread_deg ?? 30) * Math.PI / 180;
      if (Number.isInteger(count) && count > 0 && Number.isFinite(share) && share >= 0
        && Number.isFinite(spread)) {
        // Committed parent geometry, not the contact receipt: the bearing, travel and delay are
        // the release plan (payload record), while the children originate at the impact point.
        const planned = arena.actions.find((entry) => entry.id === flight.actionId)?.payloads
          ?.find((payload) => payload.index === (flight.impactIndex ?? 0));
        const aim = planned?.destination ?? flight.destination;
        const travel = Math.hypot(aim.x - flight.source.x, aim.y - flight.source.y);
        const bearing = Math.atan2(aim.y - flight.source.y, aim.x - flight.source.x);
        const delay = Math.max(0, (planned?.plannedImpactAtUs ?? flight.timing.impactAtUs)
          - flight.timing.releaseAtUs);
        const origin = { ...flight.destination };
        for (let k = 0; k < count; k++) {
          const angle = bearing + spread * (count === 1 ? 0 : (2 * k / (count - 1) - 1));
          const destination = {
            x: origin.x + Math.cos(angle) * travel,
            y: origin.y + Math.sin(angle) * travel,
          };
          const child: CombatFlight = {
            ...flight,
            timing: { ...flight.timing, startedAtUs: atUs, releaseAtUs: atUs,
              impactAtUs: atUs + delay, recoveryUntilUs: atUs },
            source: { ...origin },
            destination,
            area: { ...flight.area, center: { ...destination } },
            position: { ...origin },
            lastCheckedAtUs: atUs,
            impactIndex: (flight.impactIndex ?? 0) + 1 + k,
            impactSharePct: share,
            // Independent rolls per impact: a fresh cache, never the parent's. Overlap with the
            // parent (or a sibling) re-rolls hit/crit/proc rather than copying the receipt.
            rolls: newCastRollCache(),
            hitTargetId: undefined,
            chain: undefined,
            follow: false,
          };
          arena.flights.push(child);
          scheduleFlight(child);
        }
      }
    }
    // T5/C2 baseline (preserve, do not extend): a resolved contact attempt always continues
    // while hops remain — even on a miss — reading the next hop from live poses at resolve time.
    // Recorded quirks for C2, changed nothing: a hop that moved after selection still lands (a
    // radius-0 single resolves its body id, not a distance); trigger-fired chain rows resolve once
    // via launchTrigger and never hop.
    if (flight.chain && flight.chain.remaining > 0) {
      const lastId = flight.area?.targetId ?? flight.cast.targets[0]?.id;
      const lastPose = lastId ? arena.mobs[lastId] : undefined;
      const origin = lastPose ?? flight.area?.center ?? flight.destination;
      const next = s.group
        .filter((mob) => mob.hp > 0 && !flight.chain!.visited.includes(mob.id) && arena.mobs[mob.id])
        .map((mob) => ({ mob, pose: arena.mobs[mob.id] }))
        .filter((entry) => arenaDistance(origin, entry.pose) <= flight.chain!.hopRange + 1e-7)
        .sort((a, b) => arenaDistance(origin, a.pose) - arenaDistance(origin, b.pose)
          || (a.mob.id < b.mob.id ? -1 : 1))[0];
      if (next) {
        const nextTiming = {
          delivery: 'instant' as const, startedAtUs: atUs, releaseAtUs: atUs,
          impactAtUs: atUs + Math.ceil((flight.chain.intervalSec ?? 0.08) * units),
          recoveryUntilUs: atUs,
        };
        const nextFlight: CombatFlight = {
          ...flight,
          cast: { ...flight.cast, targets: [next.mob] },
          area: { origin: 'target', radiusM: 0,
            center: { x: next.pose.x, y: next.pose.y }, targetId: next.mob.id },
          timing: nextTiming,
          source: { x: origin.x, y: origin.y },
          destination: { x: next.pose.x, y: next.pose.y },
          position: { x: origin.x, y: origin.y },
          lastCheckedAtUs: atUs,
          impactIndex: (flight.impactIndex ?? 0) + 1,
          impactSharePct: flight.chain.sharePct,
          chain: { ...flight.chain, visited: [...flight.chain.visited, next.mob.id],
            remaining: flight.chain.remaining - 1 },
          hitTargetId: undefined,
        };
        arena.flights.push(nextFlight);
        scheduleFlight(nextFlight);
      }
    }
  }

  function sweepFlights(atUs: number) {
    if (!arena) return;
    for (const flight of [...arena.flights]) {
      if (areaChanged(flight)) { cancelFlight(flight, atUs, 'area-exit'); continue; }
      if (flight.profile.delivery !== 'projectile') continue;
      if (atUs < flight.timing.releaseAtUs) continue;
      // C3 homing: steer each sample toward the bound body inside its pursuit bound. A dead or
      // returned body, a step past the range, or a step past the time fizzles the payload.
      if (flight.homing) {
        const bound = boundTarget(flight);
        const pose = bound ? arena.mobs[bound.id] : undefined;
        const inBound = !!bound && !!pose
          && arenaDistance(arena.player, pose) <= (flight.pursuitRangeM ?? 5) + 1e-7
          && atUs <= (flight.pursuitUntilUs ?? Infinity);
        if (!inBound) { fizzleFlight(flight, atUs); continue; }
        flight.destination = { x: pose!.x, y: pose!.y };
      }
      const from = flight.position;
      // The segment starts where the last sweep left off — never before this flight's own
      // release, since burst pulses share a template stamped at the first release. Contact
      // backdates to the exact crossing instead of the sample that noticed it (F20).
      const fromAtUs = Math.max(flight.lastCheckedAtUs ?? flight.timing.releaseAtUs, flight.timing.releaseAtUs);
      const contactAtUs = (fraction: number) =>
        Math.round(fromAtUs + fraction * Math.max(0, atUs - fromAtUs));
      const to = projectilePosition(flight, atUs);
      const previous = arena.frames.at(-2) ?? arena.frames.at(-1);
      const actors = arenaActors(s.group).map((actor) => {
        const before = previous?.mobs[actor.mob.id];
        return { ...actor, ...(before ? { previous: { x: before.x, y: before.y } } : {}) };
      });
      const hit = firstProjectileHit(from, to, actors, flight.profile.hit_radius_m);
      // Authored projectile barriers stop a shot that reaches them first; a body already struck
      // earlier on the segment still takes its hit.
      const barrier = arena.nav ? sweepDisc(arena.nav, from, to, 0, 'projectiles') : null;
      if (barrier && (!hit || barrier.fraction <= hit.fraction)) {
        flight.position = { x: barrier.x, y: barrier.y };
        flight.lastCheckedAtUs = atUs;
        cancelFlight(flight, contactAtUs(barrier.fraction), 'obstacle');
        continue;
      }
      flight.position = to;
      flight.lastCheckedAtUs = atUs;
      if (hit) {
        const contact = { x: from.x + (to.x - from.x) * hit.fraction,
          y: from.y + (to.y - from.y) * hit.fraction };
        if (flight.area?.shape === 'line') {
          // A piercing shot commits a line, not a body: every eligible body on it is struck once.
          resolveFlight(flight, contactAtUs(hit.fraction), undefined, contact);
        } else if ((flight.area?.radiusM ?? 0) > 0) {
          // A committed circle keeps its release center: the sweep only selects the impact
          // time, while membership re-tests live eligible centers (T3). No forced contact hit.
          resolveFlight(flight, contactAtUs(hit.fraction), undefined, contact);
        } else {
          flight.hitTargetId = hit.target.mob.id;
          resolveFlight(flight, contactAtUs(hit.fraction), [hit.target.mob], contact);
        }
      }
    }
  }

  return { scheduleFlight, resolveFlight, sweepFlights };
}
