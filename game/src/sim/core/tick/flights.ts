import type { GameState, Mob } from '../types';
import type { Character } from '../player';
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
import { settleChannelDue } from '../../combat/combat-channel';
import type { PreparedSkillCast } from '../../combat/skills';
import type { SkillAction, SkillCastTiming, SkillRow } from '../../../../../engine/types.ts';
import { fieldAreaKey } from '../../world/field-area';
import { distinctSkillTargets } from '../../../../../engine/skill-area.ts';
import { bundleOf, manaDebtFloor } from '../../../../../engine/keystones.ts';
import { spendableMana, usableMana } from '../../combat/skills';
import { finishRayChannel } from '../../combat/ray-channel';
import type { ManualControl } from '../../combat/combat-actions';

/** What one release expands into: every committed payload plus the primary recovery metadata. */
export interface DispatchedFlights {
  flights: CombatFlight[];
  recoveryUntilUs?: number;
  channel?: boolean;
  primaryTiming?: boolean;
  mobile?: boolean;
  speedMult?: number;
  endsAtUs?: number;
}

/**
 * Expand one paid release into its committed payloads (P4 dispatch contract). Automatic, manual and
 * trigger launches all pass through here after preparation and payment; this function owns shape,
 * counts, shares, cadence, roll policy and the primary recovery/mobile metadata, never the arena's
 * intent, price, cooldown, counter or cast event.
 */
export function dispatchSkillFlights(
  flight: CombatFlight, action: SkillAction | undefined, skill: SkillRow,
  releaseTiming: SkillCastTiming, units: number,
  opts: { chainHopRange?: number; boundTargetId?: string; rng?: () => number;
    positionOf?: (id: string) => { x: number; y: number } | undefined } = {},
): DispatchedFlights {
  if (!action) return { flights: [flight] };
  const effects = skill.effects ?? [];
  const count = Math.max(1, Number(effects.find((effect) => effect.stat === 'hits')?.value ?? 1));
  const effectPolicy = (action as any).effect_policy as string | undefined;
  const sharedOnceEffects: Record<string, true> | undefined = effectPolicy ? {} : undefined;
  const sharedRefreshSeeded: Record<string, true> | undefined = effectPolicy === 'refresh-status' ? {} : undefined;
  const payoffs: NonNullable<import('../../combat/skills').CastRollCache['payoffs']> | undefined = effectPolicy ? {} : undefined;
  const attachShared = (r: import('../../combat/skills').CastRollCache): import('../../combat/skills').CastRollCache => {
    if (sharedOnceEffects) (r as any).sharedOnceEffects = sharedOnceEffects;
    if (sharedRefreshSeeded) (r as any).refreshSeeded = sharedRefreshSeeded;
    if (payoffs) r.payoffs = payoffs;
    return r;
  };
  const makeRolls = (): import('../../combat/skills').CastRollCache => attachShared(newCastRollCache());
  const sharePct = Number(effects.find((effect) => effect.stat === 'hit_pct')?.value ?? 100);
  const recoveryUs = Math.max(0, releaseTiming.recoveryUntilUs - releaseTiming.releaseAtUs);
  if (action.kind === 'sand-field') {
    const scaled = sm.effectsAt(skill, (flight.cast as any).level) as { stat: string; value: number }[];
    const dotSec = Math.max(0, Math.floor(Number(scaled.find((effect) => effect.stat === 'dot_sec')?.value ?? 0)));
    const dotDps = Math.max(0, Number(scaled.find((effect) => effect.stat === 'dot_dps')?.value ?? 0));
    const flights: CombatFlight[] = [{ ...flight, fieldInitial: true, impactIndex: 0, impactSharePct: 100 }];
    for (let index = 1; index <= dotSec; index++) {
      flights.push({ ...flight, fieldPulseDamage: dotDps,
        timing: { ...releaseTiming, impactAtUs: releaseTiming.releaseAtUs + index * units },
        impactIndex: index, impactSharePct: 100 });
    }
    return { flights, endsAtUs: releaseTiming.releaseAtUs + dotSec * units };
  }
  if (action.kind === 'chain-strike') {
    // `targets` is the offline queue cap; live contacts are the hop reach, so the same cap bounds
    // the authored action budget and this dispatch (it is not a live circle membership cap).
    const hops = Math.max(1, sm.skillTargetCap(skill));
    const rawInterval = Number(action.interval_sec ?? 0.08);
    const intervalSec = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : 0.08;
    const rawShare = Number(action.hop_share_pct ?? 60);
    return { flights: [{
      ...flight, rolls: makeRolls(), impactIndex: 0, impactSharePct: 100,
      chain: {
        visited: [flight.area?.targetId ?? opts.boundTargetId ?? ''],
        remaining: Math.max(0, hops - 1),
        hopRange: opts.chainHopRange ?? (Number(skill.area?.radius_m ?? 0) || 3),
        sharePct: Number.isFinite(rawShare) && rawShare >= 0 ? rawShare : 60,
        intervalSec,
      },
    }] };
  }
  if (action.kind === 'targeted-burst') {
    const intervalUs = Math.max(0, Math.round(Number(action.interval_sec ?? 0.15) * units));
    const tracking = action.tracking ?? 'straight';
    const pursuitRangeM = tracking === 'homing' ? Math.max(0, Number(action.pursuit_range_m ?? 5)) : 0;
    const pursuitSec = tracking === 'homing' ? Math.max(0, Number(action.pursuit_sec ?? 0.8)) : 0;
    const distinct = !!(action as any).distinct_targets;
    const flights: CombatFlight[] = [];
    if (distinct) {
      if (!opts.rng) throw new Error('Distinct-target dispatch requires the combat RNG');
      const candidates = distinctSkillTargets(flight.cast.targets.filter(mob => mob.hp > 0), count, opts.rng);
      // If candidates are fewer than count, remaining orbs will fizzle
      for (let k = 0; k < count; k++) {
        const releaseAt = releaseTiming.releaseAtUs + k * intervalUs;
        const boundId = k < candidates.length ? candidates[k].id : `__fizzle__${k}`;
        const isFizzle = k >= candidates.length;
        const destination = opts.positionOf?.(boundId) ?? flight.destination;
        const delayUs = Math.ceil((flight.profile.impact_delay_sec
          + arenaDistance(flight.source, destination) / flight.profile.projectile_speed_mps) * units);
        flights.push({
          ...flight,
          cast: { ...flight.cast, targets: isFizzle ? [] : [candidates[k]] },
          area: { origin: 'target', radiusM: 0, targetId: boundId, center: { x: destination.x, y: destination.y } },
          timing: { ...releaseTiming, releaseAtUs: releaseAt,
            impactAtUs: releaseAt + delayUs,
            recoveryUntilUs: releaseAt + recoveryUs },
          source: { ...flight.source }, destination: { x: destination.x, y: destination.y }, position: { ...flight.source },
          lastCheckedAtUs: releaseAt, impactIndex: k, impactSharePct: sharePct,
          rolls: makeRolls(), boundTargetId: boundId,
          ...(tracking === 'homing' && !isFizzle
            ? { homing: true, pursuitRangeM, pursuitUntilUs: releaseAt + pursuitSec * units }
            : {}),
        });
      }
    } else {
      const boundId = opts.boundTargetId ?? flight.area?.targetId;
      for (let k = 0; k < count; k++) {
        const releaseAt = releaseTiming.releaseAtUs + k * intervalUs;
        flights.push({
          ...flight,
          timing: { ...releaseTiming, releaseAtUs: releaseAt,
            impactAtUs: releaseAt + Math.max(0, releaseTiming.impactAtUs - releaseTiming.releaseAtUs),
            recoveryUntilUs: releaseAt + recoveryUs },
          source: { ...flight.source }, destination: { ...flight.destination }, position: { ...flight.source },
          lastCheckedAtUs: releaseAt, impactIndex: k, impactSharePct: sharePct,
          rolls: makeRolls(), boundTargetId: boundId,
          ...(tracking === 'homing'
            ? { homing: true, pursuitRangeM, pursuitUntilUs: releaseAt + pursuitSec * units }
            : {}),
        });
      }
    }
    const lastImpact = releaseTiming.releaseAtUs + (count - 1) * intervalUs
      + Math.max(0, releaseTiming.impactAtUs - releaseTiming.releaseAtUs);
    return { flights, recoveryUntilUs: releaseTiming.releaseAtUs + (count - 1) * intervalUs + recoveryUs,
      channel: true, primaryTiming: true, endsAtUs: lastImpact };
  }
  if (action.kind === 'cluster-burst') {
    const parentShare = Number(action.parent_share_pct);
    return { flights: [{ ...flight, impactIndex: 0,
      impactSharePct: Number.isFinite(parentShare) ? parentShare : flight.impactSharePct,
      rolls: makeRolls() }] };
  }
  if (action.kind === 'meteor-field' || action.kind === 'thunder-field' || action.kind === 'blizzard-field') {
    const durationSec = sm.skillDurationSec(skill.duration, 8) || 8;
    const intervalSec = action.interval_sec ?? durationSec / count;
    const delayed = action.kind === 'blizzard-field';
    const cache = makeRolls();
    const flights: CombatFlight[] = [];
    for (let i = 0; i < count; i++) {
      const impactAt = releaseTiming.releaseAtUs + Math.round((i + (delayed ? 1 : 0)) * intervalSec * units);
      flights.push({
        ...flight,
        timing: { ...releaseTiming, impactAtUs: impactAt },
        impactIndex: i,
        impactSharePct: sharePct,
        rolls: action.roll_policy === 'independent' ? makeRolls() : cache,
      });
    }
    return { flights, endsAtUs: releaseTiming.releaseAtUs + Math.round(count * intervalSec * units) };
  }
  if (action.kind === 'ray-channel') {
    const interval = action.interval_sec!;
    const hits = Math.round(action.active_sec! / interval);
    const flights: CombatFlight[] = [];
    const cache = makeRolls();
    for (let i = 0; i < hits; i++) {
      const impactAt = releaseTiming.releaseAtUs + Math.round((i + 1) * interval * units);
      flights.push({
        ...flight,
        timing: { ...releaseTiming, impactAtUs: impactAt, recoveryUntilUs: impactAt + (releaseTiming.recoveryUntilUs - releaseTiming.releaseAtUs) },
        impactIndex: i,
        impactSharePct: 100,
        rolls: action.roll_policy === 'independent' ? makeRolls() : cache,
      });
    }
    const lastImpact = releaseTiming.releaseAtUs + Math.round(action.active_sec! * units);
    return { flights, channel: true, primaryTiming: true, endsAtUs: lastImpact, recoveryUntilUs: lastImpact + (releaseTiming.recoveryUntilUs - releaseTiming.releaseAtUs) };
  }
  if (count <= 1) {
    if (effectPolicy) {
      const rolls = makeRolls();
      return { flights: [{ ...flight, rolls }] };
    }
    return { flights: [flight] };
  }
  const cache = makeRolls();
  const flights: CombatFlight[] = [];
  for (let index = 0; index < count; index++) {
    let timing = releaseTiming;
    let follow = false;
    if (action.kind === 'projectile-burst') {
      const releaseAt = releaseTiming.releaseAtUs + Math.round(index * Number(action.interval_sec ?? 0.15) * units);
      timing = { ...releaseTiming, releaseAtUs: releaseAt,
        impactAtUs: releaseAt + Math.max(0, releaseTiming.impactAtUs - releaseTiming.releaseAtUs),
        recoveryUntilUs: releaseAt + recoveryUs };
    } else if (action.kind === 'ground-pulse-burst') {
      timing = { ...releaseTiming, impactAtUs: releaseTiming.impactAtUs
        + Math.round(index * Number(action.interval_sec ?? 0.3) * units) };
    } else {
      const activeUs = Number(action.active_sec ?? 1.2) * units;
      const impactAt = releaseTiming.releaseAtUs + Math.round(activeUs * (index + 1) / count);
      timing = { ...releaseTiming, impactAtUs: impactAt, recoveryUntilUs: impactAt + recoveryUs };
      follow = true;
    }
    flights.push({ ...flight, timing, ...(follow ? { follow: true } : {}),
      impactIndex: index, impactSharePct: sharePct,
      rolls: action.roll_policy === 'independent' ? makeRolls() : cache });
  }
  const lastImpact = Math.max(...flights.map((entry) => entry.timing.impactAtUs));
  const result: DispatchedFlights = { flights, endsAtUs: lastImpact };
  if (action.kind === 'whirlwind-channel') {
    result.mobile = true;
    result.speedMult = Number(action.movement_speed_mult ?? 0.6);
    result.recoveryUntilUs = lastImpact + recoveryUs;
    result.channel = true;
    result.primaryTiming = true;
  } else if (action.kind === 'projectile-burst') {
    result.recoveryUntilUs = Math.max(...flights.map((entry) => entry.timing.releaseAtUs)) + recoveryUs;
    result.channel = true;
  }
  return result;
}

/**
 * The player's released flights: the queued impact, the contact resolution, and the per-step sweep
 * that catches a projectile on the body it crosses. The tick owns the clock and the cast outcome.
 */
export function createFlights(opts: {
  arena: CombatArena | undefined;
  clock: CombatClock;
  rng: () => number;
  s: GameState;
  c: Character;
  statuses: Statuses;
  units: number;
  tickStartUs: number;
  tickEndUs: number;
  advanceLiveClocks: (atUs: number) => void;
  applyCastOutcome: (cast: CastReport | null, opts?: any) => void;
  payCast: (cast: Pick<PreparedSkillCast, 'manaCost' | 'hpCost'>) => void;
  cancelIntent: (reason: string) => void;
  cancelFlight: (flight: CombatFlight, atUs: number, reason: string) => void;
  manual?: ManualControl;
}) {
  const {
    arena, clock, rng, s, c, statuses, units, tickStartUs, tickEndUs,
    advanceLiveClocks, applyCastOutcome, payCast, cancelIntent, cancelFlight,
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
          ? { ...payload, impactAtUs: atUs, contact: { ...flight.destination }, cancelReason: 'target-lost' }
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
    if (flight.profile.delivery === 'projectile' || flight.chain) {
      const action = arena.actions.find(entry => entry.id === flight.actionId);
      const index = flight.impactIndex ?? 0;
      if (action && !action.payloads?.some(payload => payload.index === index)) {
        updateArenaAction(arena, action.id, { payloads: [...(action.payloads ?? []), {
          index, source: { ...flight.source }, destination: { ...flight.destination },
          releaseAtUs: flight.timing.releaseAtUs, plannedImpactAtUs: flight.timing.impactAtUs,
          targetId: flight.boundTargetId ?? flight.area?.targetId,
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
    const ray = sm.byId[flight.cast.id]?.action?.kind === 'ray-channel';
    if (ray) {
      const intent = arena.intent;
      const owner = intent?.actionId === flight.actionId ? intent.channel : undefined;
      if (!owner || (flight.impactIndex ?? 0) !== owner.nextTick || !arena.flights.includes(flight)) return;
      advanceLiveClocks(atUs);
      const controlled = (statuses.shock?.secLeft ?? 0) > 0 && !bundleOf(flight.character.keystones, 'unstoppable');
      const released = intent!.manual && opts.manual?.holdToken !== intent!.holdToken;
      const moved = arenaDistance(arena.player, owner.origin) > 1e-7;
      if (areaChanged(flight) || controlled || released || moved || s.player.hp <= 0 || opts.manual?.moveTo || opts.manual?.cast) {
        finishRayChannel(arena, s, atUs, controlled ? 'control' : released ? 'hold released' : 'interrupted');
        return;
      }
      const mana = spendableMana(flight.character, s.skills, s.player.mana);
      const pool = usableMana(flight.character, s.skills);
      const debt = bundleOf(flight.character.keystones, 'mana-debt');
      const floor = debt ? -manaDebtFloor(pool, debt.params as Record<string, number>) : 0;
      const after = mana - owner.manaPerTick;
      if (owner.manaPerTick > 0 && (mana < 0 || after < floor || (owner.floorPct > 0 && after < pool * owner.floorPct / 100))) {
        finishRayChannel(arena, s, atUs, 'insufficient Mana'); return;
      }
      opts.payCast({ manaCost: owner.manaPerTick, hpCost: 0 });
      owner.nextTick++;
    }
    if (areaChanged(flight)) { cancelFlight(flight, atUs, 'area-exit'); return; }
    // A bounded channel funds the interval up to this impact before the impact may
    // land: exhaustion drops this flight and every unspent later pulse with a receipt.
    if (!settleChannelDue({ arena, s, c,
      action: arena.actions.find((entry) => entry.id === flight.actionId),
      flight, atUs, units, payCast, cancelIntent })) return;
    // C3 lock-on: a dead or returned bound body fizzles the remaining payloads — no re-acquire.
    // Straight payloads also re-check cast range at resolve; homing already enforces its pursuit
    // bound every sample and arrives on the bound body.
    if (flight.boundTargetId) {
      const bound = boundTarget(flight);
      const pose = bound ? arena.mobs[bound.id] : undefined;
      const distinct = !!sm.byId[flight.cast.id]?.action?.distinct_targets;
      const origin = distinct ? flight.source : arena.player;
      const inRange = !!bound && !!pose
        && arenaDistance(origin, pose) <= (distinct && flight.homing ? flight.pursuitRangeM ?? 5 : arenaSkillRange(flight.cast.id)) + 1e-7
        && (!distinct || !flight.homing || atUs <= (flight.pursuitUntilUs ?? Infinity));
      if (arena.offline ? !bound : !inRange) { fizzleFlight(flight, atUs); return; }
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
        positionOf: arena.queueOnly ? undefined : (id) => arena.mobs[id] ? { x: arena.mobs[id].x, y: arena.mobs[id].y } : undefined,
        ...(flight.rolls ? {
          impact: { index: flight.impactIndex ?? 0, sharePct: flight.impactSharePct ?? 100, cache: flight.rolls },
        } : {}),
        ...(flight.fieldInitial ? { suppressErosion: true } : {}),
        ...(flight.fieldPulseDamage != null ? { fieldPulse: flight.fieldPulseDamage } : {}),
      });
    applyCastOutcome(report, { pay: false, emitCast: false, castCounter: false, mirror: false,
      actionId: flight.actionId, castTiming: flight.timing, impactIndex: flight.impactIndex });
    const chainContact = flight.chain && flight.area?.targetId ? arena.mobs[flight.area.targetId] : undefined;
    const visualContact = chainContact ?? flight.destination;
    const action = arena.actions.find((entry) => entry.id === flight.actionId);
    if (action) updateArenaAction(arena, action.id, {
      ...(action.payloads ? { payloads: action.payloads.map(payload => payload.index === (flight.impactIndex ?? 0)
        ? { ...payload, impactAtUs: atUs, contact: { x: visualContact.x, y: visualContact.y }, targetId: flight.hitTargetId ?? payload.targetId }
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
    if (ray && arena.intent?.channel) {
      const owner = arena.intent.channel;
      if (owner.nextTick >= owner.ticks || (owner.manaPerTick > 0 && spendableMana(flight.character, s.skills, s.player.mana) <= 0))
        finishRayChannel(arena, s, atUs, 'complete');
    }
    if (arena.intent && arena.intent.actionId === flight.actionId
      && arena.intent.phase === 'windup') cancelIntent('impact');
    // C1 cluster (decided, no live adopter): the parent impact spawns each authored child once —
    // same speed/delay/footprint, ±spread around the parent bearing, its own independent rolls so a
    // body in both circles takes parent + child (overlap is the design, not a duplicate bug). A
    // child (impactIndex > 0) never spawns its own children. Kill credit stays single: bodies leave
    // the field on the first fatal hit and every later receipt finds them gone.
    const normalized = sm.actionOf(sm.byId[flight.cast.id]);
    const clusterAction = normalized?.kind === 'cluster-burst' ? normalized : undefined;
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
            rolls: newCastRollCache(flight.rolls),
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
          rolls: normalized?.effect_policy && normalized.roll_policy === 'independent' ? newCastRollCache(flight.rolls) : flight.rolls,
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
      if (sm.byId[flight.cast.id]?.action?.kind === 'ray-channel') continue;
      if (flight.profile.delivery !== 'projectile') continue;
      if (atUs < flight.timing.releaseAtUs) continue;
      const distinct = !!sm.byId[flight.cast.id]?.action?.distinct_targets;
      if (distinct && !boundTarget(flight)) { fizzleFlight(flight, atUs); continue; }
      // C3 homing: steer each sample toward the bound body inside its pursuit bound. A dead or
      // returned body, a step past the range, or a step past the time fizzles the payload.
      if (flight.homing) {
        const bound = boundTarget(flight);
        const pose = bound ? arena.mobs[bound.id] : undefined;
        const inBound = !!bound && !!pose
          && arenaDistance(distinct ? flight.source : arena.player, pose) <= (flight.pursuitRangeM ?? 5) + 1e-7
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
      const hit = firstProjectileHit(from, to,
        distinct ? actors.filter(actor => actor.mob.id === flight.boundTargetId) : actors, flight.profile.hit_radius_m);
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
