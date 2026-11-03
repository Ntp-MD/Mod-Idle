/**
 * Released, still-unpaid arena work in a save-safe shape.
 *
 * A cast is paid and committed at release; its impact can land in a later tick. The arena itself is
 * transient, so without this ledger a save or reload between release and impact would lose the hit
 * the character already paid for. Only the executable facts are stored: identities, prepared cast,
 * committed geometry, timing, the attacker snapshot and the last gameplay positions.
 */
import { sm } from '../../engine/client';
import type { SkillAreaSnapshot, SkillCastProfile, SkillCastTiming } from '../../../../engine/types.ts';
import type { CombatArena, CombatArenaAction } from '../combat/combat-arena';
import type { CombatFlight, CombatIntent } from '../combat/combat-actions';
import { finishRayChannel } from '../combat/ray-channel';
import type { Character } from './player';
import type { CastRollCache } from '../combat/skills';
import type { GameState, Mob } from './types';

type Point = { x: number; y: number };

export interface PendingFlightState {
  actionId: number;
  skillId: string;
  /** Living bodies selected at release; anything gone by the restore is dropped. */
  targetIds: string[];
  prepared: Omit<CombatFlight['cast'], 'targets'>;
  character: Character;
  modifiers: CombatFlight['modifiers'];
  profile: SkillCastProfile;
  timing: SkillCastTiming;
  source: Point;
  destination: Point;
  area?: SkillAreaSnapshot;
  position: Point;
  lastCheckedAtUs: number;
  /** Encounter identity at release; a restore in another area cancels the flight with a receipt. */
  areaKey?: string;
  /** Multi-impact identity and shared cast cache, so a reload cannot reroll a prepared press. */
  impactIndex?: number;
  impactSharePct?: number;
  rolls?: CastRollCache;
  /** Ledger-local identity of the live cache; separate payload caches must stay separate. */
  rollCacheId?: number;
  /** Shared once-effect ledger for effect_policy, separate from roll cache. */
  sharedOnceId?: number;
  sharedOnceEffects?: Record<string, true>;
  /** Refresh-status per-target seeded map, shared across payloads. */
  refreshId?: number;
  refreshSeeded?: Record<string, true>;
  follow?: boolean;
  /** A deployed field's initial press suppresses the legacy erosion; later pulses carry flat DPS. */
  fieldInitial?: boolean;
  fieldPulseDamage?: number;
  /** Chain contacts committed at release; the visited list keeps a reload from re-hitting. */
  chain?: NonNullable<CombatFlight['chain']>;
  hitTargetId?: string;
  /** C3 lock-on identity and pursuit bounds survive a pending-work capture/restore. */
  boundTargetId?: string;
  homing?: boolean;
  pursuitRangeM?: number;
  pursuitUntilUs?: number;
}

export interface PendingMobFlightState {
  actionId: number;
  mobId: string;
  /** Offensive receipt at release; live death or control cannot invalidate the committed shot. */
  mob: Mob;
  source: Point;
  destination: Point;
  position: Point;
  releaseAtUs: number;
  impactAtUs: number;
  speedMps: number;
  radiusM: number;
  skillId?: string;
  kind?: 'projectile' | 'ground';
  impactRadiusM?: number;
  areaKey?: string;
}

export interface PendingWorkState {
  clockUs: number;
  unitsPerSec: number;
  player: Point;
  actors: { id: string; x: number; y: number }[];
  actions: CombatArenaAction[];
  flights: PendingFlightState[];
  mobFlights: PendingMobFlightState[];
  /** A ray owns its primary action between pulses and during its remaining recovery. */
  intent?: CombatIntent;
  offline?: boolean;
  queueOnly?: boolean;
}

/** Copy through JSON so the ledger never aliases a live arena, Character or mob record. */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const receiptMap = (value: unknown): boolean => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.values(value).every(entry => entry === true);
const isPoint = (value: unknown): value is Point => {
  const point = value as Point | null;
  return !!point && finite(point.x) && finite(point.y);
};

export function snapshotPendingWork(arena: CombatArena, group: readonly Mob[]): PendingWorkState | null {
  const intent = arena.intent && sm.byId[arena.intent.skillId]?.action?.kind === 'ray-channel'
    ? arena.intent : undefined;
  let flights = arena.flights;
  if (intent?.channel && arena.channelTemplate && !flights.some(flight => flight.actionId === intent.actionId)) {
    const template = arena.channelTemplate;
    const owner = intent.channel;
    const intervalUs = (owner.endsAtUs - template.timing.releaseAtUs) / owner.ticks;
    const restored = Array.from({ length: owner.ticks - owner.nextTick }, (_, offset): CombatFlight => {
      const index = owner.nextTick + offset;
      const independent = sm.byId[intent.skillId].action?.roll_policy === 'independent';
      return { ...template, queued: false, impactIndex: index,
        timing: { ...template.timing, impactAtUs: template.timing.releaseAtUs + Math.round((index + 1) * intervalUs) },
        ...(independent && template.rolls ? { rolls: { targets: {}, effects: {},
          sharedOnceEffects: template.rolls.sharedOnceEffects, refreshSeeded: template.rolls.refreshSeeded,
          payoffs: template.rolls.payoffs } } : {}),
      };
    });
    flights = [...flights, ...restored];
  }
  if (!flights.length && !arena.mobFlights.length && !intent) return null;
  const actionIds = new Set([...flights.map((flight) => flight.actionId),
    ...arena.mobFlights.map((shot) => shot.actionId)]);
  if (intent?.actionId != null) actionIds.add(intent.actionId);
  const cacheIds = new Map<CastRollCache, number>();
  const cacheIdOf = (cache: CastRollCache): number => {
    let id = cacheIds.get(cache);
    if (id == null) { id = cacheIds.size + 1; cacheIds.set(cache, id); }
    return id;
  };
  const sharedOnceIds = new Map<Record<string, true>, number>();
  const sharedOnceIdOf = (ledger: Record<string, true>): number => {
    let id = sharedOnceIds.get(ledger);
    if (id == null) { id = sharedOnceIds.size + 1; sharedOnceIds.set(ledger, id); }
    return id;
  };
  const refreshIds = new Map<Record<string, true>, number>();
  const refreshIdOf = (ledger: Record<string, true>): number => {
    let id = refreshIds.get(ledger);
    if (id == null) { id = refreshIds.size + 1; refreshIds.set(ledger, id); }
    return id;
  };
  return copy({
    ...(arena.offline ? { offline: true, queueOnly: !!arena.queueOnly } : {}),
    ...(intent ? { intent } : {}),
    clockUs: arena.nowUs,
    unitsPerSec: arena.unitsPerSec,
    player: { x: arena.player.x, y: arena.player.y },
    actors: group
      .filter((mob) => mob.hp > 0 && arena.mobs[mob.id])
      .map((mob) => ({ id: mob.id, x: arena.mobs[mob.id].x, y: arena.mobs[mob.id].y })),
    actions: arena.actions.filter((action) => actionIds.has(action.id)).map(({ payloads, ...action }) => action),
    flights: flights.map((flight) => ({
      actionId: flight.actionId,
      skillId: flight.cast.id,
      targetIds: flight.cast.targets.map((mob) => mob.id),
      prepared: { id: flight.cast.id, manaCost: flight.cast.manaCost, hpCost: flight.cast.hpCost,
        level: flight.cast.level, cooldownSec: flight.cast.cooldownSec,
        spatial: flight.cast.spatial, area: flight.cast.area },
      character: flight.character,
      modifiers: flight.modifiers,
      profile: flight.profile,
      timing: flight.timing,
      source: flight.source,
      destination: flight.destination,
      area: flight.area,
      position: flight.position,
      lastCheckedAtUs: flight.lastCheckedAtUs,
      ...(flight.areaKey ? { areaKey: flight.areaKey } : {}),
      ...(flight.impactIndex != null ? { impactIndex: flight.impactIndex } : {}),
      ...(flight.impactSharePct != null ? { impactSharePct: flight.impactSharePct } : {}),
      ...(flight.rolls ? {
        rolls: (() => {
          const r: any = { ...flight.rolls };
          // Do not store shared ledger inside rolls copy via JSON sharing; store separately with ids
          if ((flight.rolls as any).sharedOnceEffects) delete r.sharedOnceEffects;
          if ((flight.rolls as any).refreshSeeded) delete r.refreshSeeded;
          return r;
        })(),
        rollCacheId: cacheIdOf(flight.rolls),
        ...((flight.rolls as any).sharedOnceEffects ? { sharedOnceEffects: (flight.rolls as any).sharedOnceEffects, sharedOnceId: sharedOnceIdOf((flight.rolls as any).sharedOnceEffects) } : {}),
        ...((flight.rolls as any).refreshSeeded ? { refreshSeeded: (flight.rolls as any).refreshSeeded, refreshId: refreshIdOf((flight.rolls as any).refreshSeeded) } : {}),
      } : {}),
      ...(flight.follow ? { follow: true } : {}),
      ...(flight.fieldInitial ? { fieldInitial: true } : {}),
      ...(flight.fieldPulseDamage != null ? { fieldPulseDamage: flight.fieldPulseDamage } : {}),
      ...(flight.chain ? { chain: flight.chain } : {}),
      ...(flight.hitTargetId ? { hitTargetId: flight.hitTargetId } : {}),
      ...(flight.boundTargetId ? { boundTargetId: flight.boundTargetId } : {}),
      ...(flight.homing ? { homing: true } : {}),
      ...(flight.pursuitRangeM != null ? { pursuitRangeM: flight.pursuitRangeM } : {}),
      ...(flight.pursuitUntilUs != null ? { pursuitUntilUs: flight.pursuitUntilUs } : {}),
    })),
    mobFlights: arena.mobFlights.map((shot) => ({
      actionId: shot.actionId,
      mobId: shot.mobId,
      mob: shot.mob,
      source: shot.source,
      destination: shot.destination,
      position: shot.position,
      releaseAtUs: shot.releaseAtUs,
      impactAtUs: shot.impactAtUs,
      speedMps: shot.speedMps,
      radiusM: shot.radiusM,
      ...(shot.skillId ? { skillId: shot.skillId } : {}),
      ...(shot.kind ? { kind: shot.kind } : {}),
      ...(shot.impactRadiusM != null ? { impactRadiusM: shot.impactRadiusM } : {}),
      ...(shot.areaKey ? { areaKey: shot.areaKey } : {}),
    })),
  });
}

/**
 * Put the saved ledger back into a freshly synced arena. The state keeps its copy until the next
 * writer tick refreshes it, so an immediate unload after a load still carries the pending work.
 * Returns how many flights were restored.
 */
export function restorePendingWork(arena: CombatArena, state: GameState): number {
  const work = state.pendingWork;
  if (!work) return 0;
  if (work.offline) { arena.offline = true; arena.queueOnly = work.queueOnly; }
  if (work.intent) arena.intent = copy(work.intent);
  const living = new Map(state.group.filter((mob) => mob.hp > 0).map((mob) => [mob.id, mob]));
  arena.unitsPerSec = work.unitsPerSec;
  Object.assign(arena.player, { x: work.player.x, y: work.player.y });
  for (const actor of work.actors) {
    const saved = arena.mobs[actor.id];
    if (saved && saved.hp > 0) Object.assign(saved, { x: actor.x, y: actor.y });
  }
  for (const action of work.actions) {
    if (!arena.actions.some((entry) => entry.id === action.id)) arena.actions.push(copy(action));
    arena.actionSeq = Math.max(arena.actionSeq, action.id);
  }
  let restored = 0;
  // Restore the cache identity captured before JSON removed object sharing.
  const sharedRolls = new Map<string, CastRollCache>();
  const sharedOnceLedgers = new Map<string, Record<string, true>>();
  const refreshLedgers = new Map<string, Record<string, true>>();
  const payoffLedgers = new Map<number, NonNullable<CastRollCache['payoffs']>>();
  for (const flight of work.flights) {
    if (!sm.byId[flight.skillId]) continue;
    const targets = flight.targetIds.map((id) => living.get(id)).filter((mob): mob is Mob => !!mob);
    const kind = sm.byId[flight.skillId].action?.kind;
    // Mirror live dispatch: targeted/cluster/sand payloads always roll independently,
    // every other kind follows its authored roll_policy.
    const policy = (sm.byId[flight.skillId].action as any)?.roll_policy;
    const independent = policy === 'independent' || kind === 'cluster-burst' || kind === 'targeted-burst' || kind === 'sand-field';
    const cacheKey = flight.rollCacheId != null
      ? `${flight.actionId}:cache:${flight.rollCacheId}`
      : `${flight.actionId}:${independent ? `impact:${flight.impactIndex ?? 0}` : 'cast'}`;
    const onceKey = (flight as any).sharedOnceId != null ? `${flight.actionId}:once:${(flight as any).sharedOnceId}` : null;
    const refreshKey = (flight as any).refreshId != null ? `${flight.actionId}:refresh:${(flight as any).refreshId}` : null;
    const rollsForFlight = (() => {
      if (!flight.rolls) return undefined;
      const base = sharedRolls.get(cacheKey) ?? (() => { const c = copy(flight.rolls!); sharedRolls.set(cacheKey, c); return c; })();
      const withLedgers: any = base;
      if (base.payoffs) {
        const payoffs = payoffLedgers.get(flight.actionId) ?? base.payoffs;
        payoffLedgers.set(flight.actionId, payoffs);
        base.payoffs = payoffs;
      }
      if (onceKey) {
        const ledger = sharedOnceLedgers.get(onceKey) ?? (() => {
          const l = copy((flight as any).sharedOnceEffects ?? {});
          sharedOnceLedgers.set(onceKey, l);
          return l;
        })();
        withLedgers.sharedOnceEffects = ledger;
      }
      if (refreshKey) {
        const ledger = refreshLedgers.get(refreshKey) ?? (() => {
          const l = copy((flight as any).refreshSeeded ?? {});
          refreshLedgers.set(refreshKey, l);
          return l;
        })();
        withLedgers.refreshSeeded = ledger;
      }
      return withLedgers;
    })();
    arena.flights.push({
      actionId: flight.actionId,
      cast: { ...copy(flight.prepared), targets },
      character: copy(flight.character),
      modifiers: copy(flight.modifiers),
      profile: copy(flight.profile),
      timing: copy(flight.timing),
      source: { x: flight.source.x, y: flight.source.y },
      destination: { x: flight.destination.x, y: flight.destination.y },
      ...(flight.area ? { area: copy(flight.area) } : {}),
      position: { x: flight.position.x, y: flight.position.y },
      lastCheckedAtUs: flight.lastCheckedAtUs,
      ...(flight.areaKey ? { areaKey: flight.areaKey } : {}),
      ...(flight.impactIndex != null ? { impactIndex: flight.impactIndex } : {}),
      ...(flight.impactSharePct != null ? { impactSharePct: flight.impactSharePct } : {}),
      ...(rollsForFlight ? { rolls: rollsForFlight } : {}),
      ...(flight.follow ? { follow: true } : {}),
      ...(flight.fieldInitial ? { fieldInitial: true } : {}),
      ...(flight.fieldPulseDamage != null ? { fieldPulseDamage: flight.fieldPulseDamage } : {}),
      ...(flight.chain ? { chain: copy(flight.chain) } : {}),
      ...(flight.hitTargetId ? { hitTargetId: flight.hitTargetId } : {}),
      ...(flight.boundTargetId ? { boundTargetId: flight.boundTargetId } : {}),
      ...(flight.homing ? { homing: true } : {}),
      ...(flight.pursuitRangeM != null ? { pursuitRangeM: flight.pursuitRangeM } : {}),
      ...(flight.pursuitUntilUs != null ? { pursuitUntilUs: flight.pursuitUntilUs } : {}),
    });
    restored++;
  }
  if (arena.intent?.channel) arena.channelTemplate = arena.flights.find(flight => flight.actionId === arena.intent!.actionId);
  if (arena.intent?.manual && arena.intent.channel) finishRayChannel(arena, state, work.clockUs, 'manual reload');
  for (const shot of work.mobFlights) {
    arena.mobFlights.push({
      actionId: shot.actionId,
      mobId: shot.mobId,
      mob: copy(shot.mob),
      source: { x: shot.source.x, y: shot.source.y },
      destination: { x: shot.destination.x, y: shot.destination.y },
      position: { x: shot.position.x, y: shot.position.y },
      releaseAtUs: shot.releaseAtUs,
      impactAtUs: shot.impactAtUs,
      speedMps: shot.speedMps,
      radiusM: shot.radiusM,
      ...(shot.skillId ? { skillId: shot.skillId } : {}),
      ...(shot.kind ? { kind: shot.kind } : {}),
      ...(shot.impactRadiusM != null ? { impactRadiusM: shot.impactRadiusM } : {}),
      ...(shot.areaKey ? { areaKey: shot.areaKey } : {}),
    });
    restored++;
  }
  return restored || (arena.intent ? 1 : 0);
}

/** Counts dropped by the save boundary, so a repair is never silent. */
export interface PendingNormalizeReceipt {
  droppedFlights: number;
  droppedMobFlights: number;
  invalidLedger: number;
}

export const newPendingNormalizeReceipt = (): PendingNormalizeReceipt => ({
  droppedFlights: 0, droppedMobFlights: 0, invalidLedger: 0,
});

/** Save input is a boundary: drop an impossible ledger or an impossible flight by shape, never guess. */
export function normalizePendingWork(value: unknown, receipt?: PendingNormalizeReceipt): PendingWorkState | null {
  // Absent is the ordinary "nothing owed" state; only a present, malformed ledger is a repair.
  if (value == null) return null;
  if (typeof value !== 'object') { if (receipt) receipt.invalidLedger++; return null; }
  const work = value as Partial<PendingWorkState>;
  if (!finite(work.unitsPerSec) || work.unitsPerSec <= 0 || !isPoint(work.player)) {
    if (receipt) receipt.invalidLedger++;
    return null;
  }
  const rawFlights = Array.isArray(work.flights) ? work.flights : [];
  const rawMobFlights = Array.isArray(work.mobFlights) ? work.mobFlights : [];
  const rawActions = Array.isArray(work.actions) ? work.actions : [];
  // A channel action carries its funded watermark beside the rate: both present and valid, or
  // neither. A half-authored sustain descriptor cannot prove its pulses were funded, so its
  // flights are dropped with the other invalid work instead of resolving as free impacts.
  const badChannelActions = new Set<number>();
  for (const action of rawActions) {
    if (!action || typeof action !== 'object') continue;
    const rate = (action as { channelRatePerSec?: unknown }).channelRatePerSec;
    const paid = (action as { channelPaidUntilUs?: unknown }).channelPaidUntilUs;
    if (rate == null && paid == null) continue;
    if (!(typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && Number.isFinite(paid)))
      badChannelActions.add((action as { id?: number }).id as number);
  }
  const seen = new Set<number>();
  const seenImpacts = new Set<string>();
  let flights = rawFlights.filter((flight) => {
    if (!flight || typeof flight !== 'object') return false;
    if (!Number.isInteger(flight.actionId) || flight.actionId <= 0) return false;
    if (badChannelActions.has(flight.actionId)) return false;
    // A multi-impact press deliberately shares its action id; the impact index keeps entries unique.
    const impactKey = `${flight.actionId}:${flight.impactIndex ?? 0}`;
    if (seenImpacts.has(impactKey)) return false;
    if (flight.impactIndex != null && (!Number.isInteger(flight.impactIndex) || flight.impactIndex < 0)) return false;
    if (flight.impactSharePct != null && !finite(flight.impactSharePct)) return false;
    if (flight.follow != null && typeof flight.follow !== 'boolean') return false;
    if (flight.rolls != null && (typeof flight.rolls !== 'object' || !flight.rolls.targets || !flight.rolls.effects))
      return false;
    if (flight.rolls) {
      const cache = flight.rolls;
      if (!receiptMap(cache.effects) || typeof cache.targets !== 'object' || Array.isArray(cache.targets)) return false;
      if (cache.crit != null && typeof cache.crit !== 'boolean') return false;
      if (!Object.values(cache.targets).every(target => target && typeof target === 'object'
        && [target.hit, target.dodged].every(value => value == null || typeof value === 'boolean')
        && [target.bonusPct, target.consumeStacks].every(value => value == null || (finite(value) && value >= 0)))) return false;
    }
    if (flight.rollCacheId != null && (!Number.isInteger(flight.rollCacheId) || flight.rollCacheId <= 0)) return false;
    for (const id of [flight.sharedOnceId, flight.refreshId]) {
      if (id != null && (!Number.isSafeInteger(id) || id <= 0)) return false;
    }
    for (const ledger of [flight.sharedOnceEffects, flight.refreshSeeded]) {
      if (ledger != null && !receiptMap(ledger)) return false;
    }
    if ((flight.sharedOnceId == null) !== (flight.sharedOnceEffects == null)
      || (flight.refreshId == null) !== (flight.refreshSeeded == null)) return false;
    if (flight.rolls?.payoffs != null) {
      if (typeof flight.rolls.payoffs !== 'object' || Array.isArray(flight.rolls.payoffs)) return false;
      if (!Object.values(flight.rolls.payoffs).every(value => value && typeof value === 'object'
        && [value.bonusPct, value.consumeStacks].every(amount => amount == null || (finite(amount) && amount >= 0)))) return false;
    }
    if (flight.fieldInitial != null && typeof flight.fieldInitial !== 'boolean') return false;
    if (flight.fieldPulseDamage != null && (!finite(flight.fieldPulseDamage) || flight.fieldPulseDamage < 0)) return false;
    if (flight.chain != null) {
      const chain = flight.chain as Record<string, unknown>;
      const visited = chain.visited;
      if (!Array.isArray(visited) || !visited.every((id) => typeof id === 'string')) return false;
      if (!finite(chain.remaining) || chain.remaining < 0) return false;
      if (!finite(chain.hopRange) || !(chain.hopRange > 0)) return false;
      if (!finite(chain.sharePct) || chain.sharePct < 0) return false;
      if (chain.intervalSec != null && (!finite(chain.intervalSec) || !(chain.intervalSec > 0))) return false;
    }
    if (!flight.skillId || !sm.byId[flight.skillId]) return false;
    if (!flight.prepared || flight.prepared.id !== flight.skillId) return false;
    if (!finite(flight.prepared.manaCost) || !finite(flight.prepared.hpCost)) return false;
    if (!isPoint(flight.source) || !isPoint(flight.destination) || !isPoint(flight.position)) return false;
    if (!flight.timing || !finite(flight.timing.releaseAtUs) || !finite(flight.timing.impactAtUs)
      || !finite(flight.timing.startedAtUs) || !finite(flight.timing.recoveryUntilUs)) return false;
    if (!flight.profile || typeof flight.profile.delivery !== 'string'
      || !finite(flight.profile.hit_radius_m)) return false;
    if (!flight.modifiers || typeof flight.modifiers !== 'object') return false;
    const mods = flight.modifiers as Record<string, unknown>;
    const trigger = mods.trigger as Record<string, unknown> | undefined;
    if (trigger && (!finite(trigger.manaMult) || !finite(trigger.damageMult))) return false;
    for (const key of ['critDamageBonusPct', 'missingHpPct']) {
      if (mods[key] != null && !finite(mods[key])) return false;
    }
    if (flight.area && (!isPoint(flight.area.center) || !finite(flight.area.radiusM)
      || (flight.area.origin !== 'caster' && flight.area.origin !== 'target'))) return false;
    if (flight.area) {
      // A committed line/cone keeps its dimensions and direction; drop a ledger that names a
      // shape or a dimension the engine never commits instead of guessing the footprint.
      const shape = (flight.area as { shape?: unknown }).shape;
      if (shape != null && shape !== 'single' && shape !== 'circle' && shape !== 'line' && shape !== 'cone') return false;
      const dims = flight.area as { lengthM?: unknown; widthM?: unknown; angleDeg?: unknown; directionRad?: unknown };
      for (const value of [dims.lengthM, dims.widthM, dims.angleDeg, dims.directionRad]) {
        if (value != null && !finite(value)) return false;
      }
      if (shape === 'line' && (!(finite(dims.lengthM) && (dims.lengthM as number) > 0)
        || !finite(dims.widthM) || !finite(dims.directionRad))) return false;
      if (shape === 'cone' && (!finite(dims.lengthM) || !finite(dims.directionRad)
        || !(finite(dims.angleDeg) && (dims.angleDeg as number) > 0 && (dims.angleDeg as number) <= 180))) return false;
    }
    if (flight.areaKey != null && typeof flight.areaKey !== 'string') return false;
    if (flight.boundTargetId != null && typeof flight.boundTargetId !== 'string') return false;
    if (flight.homing != null && typeof flight.homing !== 'boolean') return false;
    if (flight.pursuitRangeM != null && (!finite(flight.pursuitRangeM) || flight.pursuitRangeM < 0)) return false;
    if (flight.pursuitUntilUs != null && !finite(flight.pursuitUntilUs)) return false;
    const character = flight.character;
    if (!character || !finite(character.phys) || !finite(character.magic) || !finite(character.maxHp)
      || !finite(character.critChance) || !finite(character.critDmg)) return false;
    if (!Array.isArray(flight.targetIds) || !flight.targetIds.every((id) => typeof id === 'string')) return false;
    seenImpacts.add(impactKey);
    return true;
  });
  const mobFlights = rawMobFlights.filter((shot) => {
    if (!shot || typeof shot !== 'object') return false;
    if (!Number.isInteger(shot.actionId) || shot.actionId <= 0 || seen.has(shot.actionId)) return false;
    if (typeof shot.mobId !== 'string' || !shot.mob || shot.mob.id !== shot.mobId) return false;
    const mob = shot.mob;
    if (!finite(mob.ps) || !finite(mob.hp) || !finite(mob.hpMax) || !finite(mob.hitsPerSec)
      || !finite(mob.acc) || typeof mob.damage !== 'string') return false;
    if (!isPoint(shot.source) || !isPoint(shot.destination) || !isPoint(shot.position)) return false;
    if (!finite(shot.releaseAtUs) || !finite(shot.impactAtUs)) return false;
    if (!finite(shot.speedMps) || shot.speedMps <= 0 || !finite(shot.radiusM) || shot.radiusM < 0) return false;
    if (shot.skillId != null && typeof shot.skillId !== 'string') return false;
    if (shot.kind != null && shot.kind !== 'projectile' && shot.kind !== 'ground') return false;
    if (shot.impactRadiusM != null && (!finite(shot.impactRadiusM) || shot.impactRadiusM < 0)) return false;
    if (shot.areaKey != null && typeof shot.areaKey !== 'string') return false;
    seen.add(shot.actionId);
    return true;
  });
  let intent: CombatIntent | undefined;
  if (work.intent) {
    const candidate = work.intent;
    const owner = candidate.channel;
    const valid = typeof candidate.skillId === 'string' && sm.byId[candidate.skillId]?.action?.kind === 'ray-channel'
      && finite(work.clockUs)
      && (Array.isArray(work.actions) && work.actions.some(action => action?.id === candidate.actionId && action.skillId === candidate.skillId))
      && Number.isInteger(candidate.actionId) && (candidate.actionId ?? 0) > 0
      && candidate.phase === 'recovery' && isPoint(candidate.targetPoint)
      && finite(candidate.recoveryUntilUs) && typeof candidate.targetId === 'string'
      && (candidate.manual == null || typeof candidate.manual === 'boolean')
      && (owner == null || (typeof owner === 'object' && !Array.isArray(owner)
        && finite(owner.manaPerTick) && owner.manaPerTick >= 0
        && (owner.freeCast == null || typeof owner.freeCast === 'boolean')
        && (owner.freeCast === true ? owner.manaPerTick === 0 : owner.manaPerTick > 0)
        && finite(owner.floorPct) && owner.floorPct >= 0 && owner.floorPct <= 100
        && Number.isSafeInteger(owner.nextTick) && owner.nextTick >= 0
        && Number.isSafeInteger(owner.ticks) && owner.ticks > owner.nextTick
        && finite(owner.cooldownSec) && owner.cooldownSec >= 0
        && finite(owner.recoveryUs) && owner.recoveryUs >= 0 && isPoint(owner.origin) && finite(owner.endsAtUs)));
    if (valid) intent = copy(candidate);
    else if (receipt) receipt.invalidLedger++;
  }
  if (intent?.channel) {
    const owner = intent.channel;
    const remaining = flights.filter(flight => flight.actionId === intent!.actionId && flight.skillId === intent!.skillId)
      .map(flight => flight.impactIndex).sort((a, b) => (a ?? -1) - (b ?? -1));
    if (remaining.length !== owner.ticks - owner.nextTick
      || remaining.some((index, offset) => index !== owner.nextTick + offset)) {
      intent = undefined;
      if (receipt) receipt.invalidLedger++;
    }
  }
  flights = flights.filter(flight => {
    if (sm.byId[flight.skillId]?.action?.kind !== 'ray-channel') return true;
    const owner = intent?.channel;
    return !!owner && flight.actionId === intent?.actionId && flight.skillId === intent.skillId
      && (flight.impactIndex ?? -1) >= owner.nextTick && (flight.impactIndex ?? Infinity) < owner.ticks;
  });
  if (receipt) {
    receipt.droppedFlights += rawFlights.length - flights.length;
    receipt.droppedMobFlights += rawMobFlights.length - mobFlights.length;
  }
  if (!flights.length && !mobFlights.length && !intent) return null;
  const actionIds = new Set([...flights.map((flight) => flight.actionId),
    ...mobFlights.map((shot) => shot.actionId)]);
  if (intent?.actionId != null) actionIds.add(intent.actionId);
  const seenActors = new Set<string>();
  return {
    ...(work.offline === true ? { offline: true, queueOnly: work.queueOnly === true } : {}),
    ...(intent ? { intent } : {}),
    clockUs: finite(work.clockUs) ? work.clockUs : 0,
    unitsPerSec: work.unitsPerSec,
    player: { x: work.player.x, y: work.player.y },
    actors: (Array.isArray(work.actors) ? work.actors : [])
      .filter((actor) => actor && typeof actor.id === 'string' && isPoint(actor)
        && !seenActors.has(actor.id) && (seenActors.add(actor.id), true)),
    actions: (Array.isArray(work.actions) ? work.actions : [])
      .filter((action) => action && Number.isInteger(action.id) && actionIds.has(action.id))
      .map(({ payloads, ...action }) => action),
    flights,
    mobFlights,
  };
}
