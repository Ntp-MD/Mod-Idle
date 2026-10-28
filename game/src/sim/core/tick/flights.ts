import type { GameState, Mob } from '../types';
import type { CombatArena } from '../../combat/combat-arena';
import type { CombatClock } from '../../combat/combat-clock';
import type { CombatFlight } from '../../combat/combat-actions';
import type { Statuses } from '../../combat/combat';
import type { CastReport } from '../../combat/skills';
import { E } from '../../../engine/client';
import { EVENT_PRIORITY } from '../../combat/combat-clock';
import { arenaDistance, updateArenaAction } from '../../combat/combat-arena';
import { flightTargets, projectilePosition } from '../../combat/combat-actions';
import { firstProjectileHit } from '../../../../../engine/skill-actions.ts';
import { resolvePreparedCast } from '../../combat/skills';
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
    mob.hp > 0 && arena?.mobs[mob.id] && !arena.mobs[mob.id].returning
      ? [{ ...arena.mobs[mob.id], mob }] : []);

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
      ...(flight.hitTargetId ? { targetId: flight.hitTargetId } : {}),
      ...(contact && flight.area?.radiusM === 0 ? { area: { ...flight.area, center: contact } } : {}),
      ...(contact ? { targetX: contact.x, targetY: contact.y } : {}),
      timing: flight.timing,
      endsAtUs: Math.max(action.endsAtUs, atUs + E.combat_arena.action_sec * units),
    });
    if (arena.intent && arena.intent.actionId === flight.actionId
      && arena.intent.phase === 'windup') cancelIntent('impact');
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
      const from = flight.position;
      const to = projectilePosition(flight, atUs);
      const previous = arena.frames.at(-2) ?? arena.frames.at(-1);
      const actors = arenaActors(s.group).map((actor) => {
        const before = previous?.mobs[actor.mob.id];
        return { ...actor, ...(before ? { previous: { x: before.x, y: before.y } } : {}) };
      });
      const hit = firstProjectileHit(from, to, actors, flight.profile.hit_radius_m);
      flight.position = to;
      flight.lastCheckedAtUs = atUs;
      if (hit) {
        const contact = { x: from.x + (to.x - from.x) * hit.fraction,
          y: from.y + (to.y - from.y) * hit.fraction };
        if (flight.area?.shape === 'line') {
          // A piercing shot commits a line, not a body: every eligible body on it is struck once.
          resolveFlight(flight, atUs, undefined, contact);
        } else {
          flight.hitTargetId = hit.target.mob.id;
          resolveFlight(flight, atUs, [hit.target.mob], contact);
        }
      }
    }
  }

  return { scheduleFlight, resolveFlight, sweepFlights };
}
