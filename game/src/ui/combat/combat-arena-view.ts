import type { CombatArena, CombatArenaAction, CombatArenaActor, CombatArenaFrame, CombatArenaPayload } from '@sim/combat/combat-arena';
import type { FxEvent, GameState } from '@sim/core/types';
import type { ArenaDirection, ArenaSpriteSheet } from './arena/arena-art';
import { sm } from '../../engine/client';

import { ARENA_DIRECTIONS, ARENA_FACING_HYSTERESIS, arenaFacingIndex, projectArenaPoint, projectArenaVector, arenaScreenAngle, arenaScreenAngleFor } from '../../presentation/arena-camera';
export { ARENA_VIEW, ARENA_ACTOR_WIDTH_M, projectArenaPoint, projectArenaVector, arenaScreenAngle, arenaScreenAngleFor, arenaCameraOffset, arenaActorPixelScale, unprojectArenaPoint } from '../../presentation/arena-camera';

export const ARENA_WALK_STRIDE_M = .62;
const FALLBACK_IMPACT_MS = 340;
const CONTACT_HOLD_MS = 90;
const DIRECTION_HYSTERESIS = ARENA_FACING_HYSTERESIS;
const directions = ARENA_DIRECTIONS;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const msToUs = (ms: number, unitsPerSec: number) => ms * unitsPerSec / 1000;

export function arenaFacingSector(facing: number, current?: ArenaDirection, hysteresis = DIRECTION_HYSTERESIS): ArenaDirection {
  return directions[arenaFacingIndex(facing, current == null ? undefined : directions.indexOf(current), hysteresis)];
}

/** The nearest authored sheet to a nominal sector; one-sided art keeps its declared fallback. */
export function arenaSheetDirection(
  nominal: ArenaDirection, available: Partial<Record<ArenaDirection, ArenaSpriteSheet>>,
): ArenaDirection {
  if (available[nominal]) return nominal;
  const index = directions.indexOf(nominal);
  // Four-direction art carries one horizontal side per half: right-down/east and up-right read
  // east, while left-down and west read west. This keeps a sparse atlas from flipping sides
  // just because the nearest-sector scan happened to reach the other side first.
  const side = index <= 2 || index >= 6 ? 'east' : 'west';
  if (available[side]) return side;
  for (let distance = 0; distance <= 4; distance++) {
    for (const offset of distance ? [distance, -distance] : [0]) {
      const candidate = directions[(index + offset + 8) % 8];
      if (available[candidate]) return candidate;
    }
  }
  return 'south';
}

/** Facing follows the projected travel vector, including the camera's compressed ground axis. */
export function arenaDirection(
  facing: number, available: Partial<Record<ArenaDirection, ArenaSpriteSheet>>,
  current?: ArenaDirection, hysteresis = DIRECTION_HYSTERESIS,
): ArenaDirection {
  return arenaSheetDirection(arenaFacingSector(facing, current, hysteresis), available);
}

/** A stable per-actor idle offset so the whole pack does not breathe on one frame. */
export function arenaPhaseOffset(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return (hash >>> 0) / 4294967296;
}

export function arenaSpriteIndex(sheet: ArenaSpriteSheet, elapsedMs: number, reducedMotion = false, once = false) {
  const frame = reducedMotion
    ? once ? sheet.frames - 1
      : sheet.impactMs != null ? Math.max(0, Math.min(sheet.frames - 1, Math.floor(sheet.impactMs / sheet.frameMs)))
        : 0
    : Math.max(0, Math.floor(elapsedMs / sheet.frameMs));
  return (sheet.startFrame ?? 0) + (sheet.loop && !once ? frame % sheet.frames : Math.min(frame, sheet.frames - 1));
}

export function arenaSpriteFrame(sheet: ArenaSpriteSheet, elapsedMs: number, reducedMotion = false, once = false) {
  const index = arenaSpriteIndex(sheet, elapsedMs, reducedMotion, once);
  return `${index % sheet.columns * sheet.frameWidth} ${Math.floor(index / sheet.columns) * sheet.frameHeight} ${sheet.frameWidth} ${sheet.frameHeight}`;
}

export type ArenaActionPhase = 'windup' | 'contact' | 'recovery';

/** One sampled pose: combat time in, authored clip time out. Pure, so a seek repeats the same frame. */
export interface ArenaActionPose {
  action: CombatArenaAction;
  phase: ArenaActionPhase;
  /** Authored clip time in milliseconds; negative never escapes this sampler. */
  elapsedMs: number;
  /** Presentation start, including the legacy/release lead-in. */
  startedAtUs: number;
  releasedAtUs: number;
  contactAtUs?: number;
  primaryEndUs: number;
  endUs: number;
}

/**
 * Resolve one action's authored pose at a combat timestamp.
 *
 * A timed action maps preparation to the clip's anticipation, the release/contact marker to its
 * own beat and recovery to the remaining frames. A legacy swing keeps its contact timestamp as
 * `atUs`, so its lead-in is the authored impact marker. A cancelled action ends at the receipt;
 * it never plays a tail that the simulation already refused.
 */
export function arenaActionPose(
  action: CombatArenaAction, atUs: number, unitsPerSec: number, sheet?: ArenaSpriteSheet,
): ArenaActionPose | undefined {
  if (action.kind === 'death') return undefined;
  const units = unitsPerSec > 0 ? unitsPerSec : 1_000_000;
  const impactMs = sheet?.impactMs ?? FALLBACK_IMPACT_MS;
  const clipMs = sheet ? Math.max(1, sheet.frames * sheet.frameMs) : 0;
  const recoveryClipMs = Math.max(clipMs, impactMs + (sheet?.frameMs ?? 100));
  const cancelUs = action.cancelledAtUs ?? Infinity;

  if (!action.timing) {
    const contactUs = action.atUs;
    const startedAtUs = contactUs - msToUs(impactMs, units);
    const clipTailUs = msToUs(Math.max(0, clipMs - impactMs), units);
    const primaryEndUs = Math.max(action.endsAtUs, contactUs + clipTailUs);
    const endUs = Math.min(primaryEndUs, cancelUs);
    if (atUs < startedAtUs || atUs >= endUs) return undefined;
    const phase: ArenaActionPhase = atUs < contactUs ? 'windup'
      : atUs < contactUs + msToUs(CONTACT_HOLD_MS, units) ? 'contact' : 'recovery';
    return {
      action, phase,
      elapsedMs: (atUs - startedAtUs) / units * 1000,
      startedAtUs, releasedAtUs: contactUs, contactAtUs: contactUs, primaryEndUs, endUs,
    };
  }

  const timing = action.primaryTiming ?? action.timing;
  const startedUs = timing.startedAtUs;
  const releasedUs = Math.max(startedUs, timing.releaseAtUs);
  const impactUs = Math.max(releasedUs, timing.impactAtUs);
  const contactUs = timing.delivery === 'melee' || timing.delivery === 'instant' ? impactUs : releasedUs;
  const windupUs = contactUs - startedUs;
  const startedAtUs = startedUs;
  const primaryEndUs = Math.max(contactUs, timing.recoveryUntilUs);
  const endUs = Math.min(primaryEndUs, cancelUs);
  if (atUs < startedAtUs || atUs >= endUs) return undefined;
  let toImpact: number;
  if (windupUs > 0) {
    const windupMs = windupUs / units * 1000;
    if (windupMs > impactMs * 1.5) {
      // A long preparation holds its anticipation pose instead of playing the strike in slow motion.
      const elapsedMs = Math.max(0, (atUs - startedAtUs) / units * 1000);
      const holdAt = impactMs * .5;
      const rampMs = Math.max(1, Math.min(holdAt, windupMs * .5));
      toImpact = Math.min(holdAt, elapsedMs / rampMs * holdAt);
    } else {
      toImpact = impactMs * clamp01((atUs - startedAtUs) / windupUs);
    }
  } else {
    toImpact = impactMs;
  }
  const recoveryPlayUs = Math.max(1, msToUs(recoveryClipMs - impactMs, units));
  const playbackEndUs = Math.min(primaryEndUs, contactUs + recoveryPlayUs);
  const fromImpact = atUs <= contactUs || primaryEndUs <= contactUs ? impactMs
    : atUs >= playbackEndUs ? recoveryClipMs
      : impactMs + clamp01((atUs - contactUs) / Math.max(1, playbackEndUs - contactUs))
        * Math.max(0, recoveryClipMs - impactMs);
  let elapsedMs = atUs < contactUs ? toImpact : fromImpact;
  if (action.channel && atUs >= contactUs && primaryEndUs > contactUs) {
    const recoveryWindowUs = Math.min(primaryEndUs - contactUs, msToUs(recoveryClipMs, units));
    const holdUntilUs = primaryEndUs - recoveryWindowUs;
    elapsedMs = atUs < holdUntilUs ? impactMs
      : impactMs + clamp01((atUs - holdUntilUs) / Math.max(1, recoveryWindowUs)) * Math.max(0, recoveryClipMs - impactMs);
  }
  const phase: ArenaActionPhase = atUs < contactUs ? 'windup'
    : atUs < contactUs + msToUs(CONTACT_HOLD_MS, units) ? 'contact' : 'recovery';
  return {
    action, phase, elapsedMs, startedAtUs,
    releasedAtUs: releasedUs, contactAtUs: contactUs, primaryEndUs, endUs,
  };
}

/** Compatibility read for callers that only need the authored clip time. */
export function arenaAttackElapsedMs(action: CombatArenaAction, atUs: number, unitsPerSec: number, sheet?: ArenaSpriteSheet) {
  return arenaActionPose(action, atUs, unitsPerSec, sheet)?.elapsedMs ?? 0;
}

/**
 * The action that owns this actor's body at a timestamp. A non-blocking trigger owns an effect and
 * its own flight, never the primary pose; a cancelled action is already over.
 */
export function arenaActorAction(
  arena: CombatArena, actor: CombatArenaActor, atUs: number,
  attackClip?: Partial<Record<ArenaDirection, ArenaSpriteSheet>>,
): CombatArenaAction | undefined {
  const sheet = attackClip?.[arenaDirection(actor.facing, attackClip)];
  let best: { action: CombatArenaAction; startedAtUs: number } | undefined;
  for (let index = arena.actions.length - 1; index >= 0; index--) {
    const latest = arena.actions[index];
    // Captured actor facts own aim at this timestamp. Later interception receipts must not
    // retarget an earlier pose; cancellation still cuts the action at its effective boundary.
    const action = actor.action?.id === latest.id
      ? { ...latest, ...actor.action, cancelledAtUs: latest.cancelledAtUs ?? actor.action.cancelledAtUs } : latest;
    if (action.actorId !== actor.id || action.kind === 'death' || action.nonblocking) continue;
    const pose = arenaActionPose(action, atUs, arena.unitsPerSec, sheet);
    if (!pose) continue;
    if (!best || pose.startedAtUs > best.startedAtUs) best = { action, startedAtUs: pose.startedAtUs };
  }
  return best?.action;
}

/** Continue the displayed window when a wake delivers more simulation; never skip to its last tick. */
export function arenaPlaybackTime(nowUs: number, unitsPerSec: number, elapsedMs: number, speed: number, paused = false,
  fromUs = nowUs - unitsPerSec) {
  return Math.max(0, Math.min(nowUs, fromUs + (paused ? 0 : Math.max(0, elapsedMs) * unitsPerSec * speed / 1000)));
}

/**
 * A live event follows its executable action's latest timing so an early contact or a re-aimed
 * release cannot be overwritten by the event's older snapshot. History keeps its resolved snapshot.
 */
export function arenaEventTiming(event: FxEvent, arena: CombatArena) {
  const linked = event.actionId != null
    ? arena.actions.find((action) => action.id === event.actionId) : undefined;
  const kind = event.skillId ? sm.byId[event.skillId]?.action?.kind : undefined;
  if (event.kind === 'cast' && (kind === 'blizzard-field' || kind === 'sand-field') && linked?.primaryTiming) {
    // The deployed field owns one presentation clock; later damage pulses only update hit receipts.
    return { ...linked.primaryTiming, impactAtUs: linked.primaryTiming.releaseAtUs };
  }
  return linked?.timing ?? event.castTiming;
}

/** The committed release→impact span a projectile actually flies; null when the hit lands at release. */
export function arenaFlightWindow(
  timing: { releaseAtUs: number; impactAtUs: number } | undefined | null,
  unitsPerSec: number,
): { releaseAtUs: number; impactAtUs: number; leadSec: number } | null {
  if (!timing || !(timing.impactAtUs > timing.releaseAtUs) || !(unitsPerSec > 0)) return null;
  return { releaseAtUs: timing.releaseAtUs, impactAtUs: timing.impactAtUs,
    leadSec: (timing.impactAtUs - timing.releaseAtUs) / unitsPerSec };
}

/** Charge progress for the cast label: 0 at the cast beat, 1 just before release; undefined outside. */
export function arenaCastCharge(
  timing: { startedAtUs: number; releaseAtUs: number } | undefined, playhead: number,
): number | undefined {
  if (!timing || !(timing.releaseAtUs > timing.startedAtUs)) return undefined;
  if (playhead < timing.startedAtUs || playhead >= timing.releaseAtUs) return undefined;
  return clamp01((playhead - timing.startedAtUs) / (timing.releaseAtUs - timing.startedAtUs));
}

/**
 * The nearest body the renderer may highlight. It mirrors `arenaTarget`: a returning body is
 * untargetable until it reaches its home band, so it cannot wear the target ring.
 */
export function arenaNearestTarget(
  mobs: Readonly<Record<string, { hp: number; x: number; y: number; returning?: boolean } | undefined>>,
  player: { x: number; y: number },
): string | undefined {
  let best: string | undefined;
  let nearest = Infinity;
  for (const [id, actor] of Object.entries(mobs)) {
    if (!actor || actor.hp <= 0 || actor.returning) continue;
    const gap = Math.hypot(actor.x - player.x, actor.y - player.y);
    if (gap < nearest - 1e-9 || (Math.abs(gap - nearest) <= 1e-9 && best != null && id < best)) {
      nearest = gap;
      best = id;
    }
  }
  return best;
}

/**
 * Projectile progress for the drawn flight. A committed window moves at the sim's own speed from
 * release; only an event with no authored span keeps the legacy 0.24 s lead-in.
 */
export function arenaFlightProgress(
  playhead: number, window: { releaseAtUs: number; impactAtUs: number } | null, age: number,
): number {
  return window
    ? clamp01((playhead - window.releaseAtUs) / Math.max(1, window.impactAtUs - window.releaseAtUs))
    : clamp01((age + .24) / .24);
}

/** Damage pulses show contact feedback; the deployed field atlas belongs to the cast event. */
export function arenaPersistentFieldVisual(event: FxEvent, persistentField: boolean): boolean {
  return !persistentField || event.kind === 'cast';
}

export function arenaPayloadSample(payload: CombatArenaPayload, atUs: number) {
  const terminalAtUs = payload.impactAtUs ?? payload.plannedImpactAtUs;
  const terminal = atUs >= terminalAtUs;
  const progress = clamp01((atUs - payload.releaseAtUs) / Math.max(1, payload.plannedImpactAtUs - payload.releaseAtUs));
  return { terminalAtUs, progress,
    point: terminal && payload.contact ? payload.contact : payload.destination,
    position: terminal && payload.contact ? payload.contact : {
      x: payload.source.x + (payload.destination.x - payload.source.x) * progress,
      y: payload.source.y + (payload.destination.y - payload.source.y) * progress,
    } };
}

/** Mobile channels follow sampled feet; deployed fields retain their committed point. */
export function arenaPresentationArea(action: CombatArenaAction, frame: CombatArenaFrame) {
  const actor = action.actorId === 'player' ? frame.player : frame.mobs[action.actorId];
  return action.area && action.channel && action.area.origin === 'caster' && actor
    ? { ...action.area, center: { x: actor.x, y: actor.y } } : action.area;
}

/** Socket and foot use untrimmed cell pixels. Stage scaling is applied by the scene once. */
export function arenaReleaseSocket(sheet: ArenaSpriteSheet, foot: { x: number; y: number },
  ground: { x: number; y: number }, pixelScale: number) {
  const socket = sheet.releaseSocket;
  if (!socket) return undefined;
  return { x: ground.x + (socket.x - foot.x) * pixelScale * (sheet.mirror ? -1 : 1),
    y: ground.y + (socket.y - foot.y) * pixelScale, provenance: socket.provenance };
}

/** Presentation-only interpolation for an ordinary mob shot; the simulation owns contact. */
export function arenaRangedShots(arena: CombatArena, atUs: number) {
  const live: { id: number; actorId: string; x: number; y: number; angle: number; element: string | null }[] = [];
  for (const action of arena.actions) {
    if (!action.ranged || !action.timing || action.cancelledAtUs != null) continue;
    const { releaseAtUs, impactAtUs } = action.timing;
    if (atUs < releaseAtUs || atUs > impactAtUs + arena.unitsPerSec * 0.08) continue;
    const span = impactAtUs - releaseAtUs;
    const progress = span > 0 ? Math.max(0, Math.min(1, (atUs - releaseAtUs) / span)) : 1;
    const toX = action.targetX ?? action.x, toY = action.targetY ?? action.y;
    const mob = arena.mobs[action.actorId]?.mob;
    live.push({
      id: action.id,
      actorId: action.actorId,
      x: action.x + (toX - action.x) * progress,
      y: action.y + (toY - action.y) * progress,
      angle: arenaScreenAngle({ x: action.x, y: action.y }, { x: toX, y: toY }),
      element: mob && mob.damage !== 'physical' ? (mob.innate?.[0] ?? null) : null,
    });
  }
  return live;
}

export interface ArenaGaitSample {
  distanceM: number;
  phase: number;
  /** Arrival time of the last step; the scene may hold its foot frame for a short settle. */
  lastMovedAtUs: number;
}

/**
 * Voluntary-distance gait for the presentation layer. Frames are ingested once per timestamp;
 * separation pushes (`moving` false) and respawn gaps do not turn into steps. A backward seek
 * rebuilds from the retained window, so the same timestamp always yields the same phase.
 */
export function createArenaGait(strideM = ARENA_WALK_STRIDE_M) {
  const stride = Math.max(.05, strideM);
  const states = new Map<string, { atUs: number; distanceM: number; lastFrameAtUs: number; lastMovedAtUs: number }>();

  const rebuild = (frames: readonly CombatArenaFrame[], actorId: string, atUs: number) => {
    let distanceM = 0;
    let lastMovedAtUs = -Infinity;
    let previous: CombatArenaFrame | undefined;
    let lastFrameAtUs = frames[0]?.atUs ?? atUs;
    for (const frame of frames) {
      if (frame.atUs > atUs) break;
      const actor = frame.mobs[actorId];
      if (actor) {
        const before = previous?.mobs[actorId];
        // `moving` describes the step that arrived at this frame, so the arrival frame owns it.
        const voluntary = actor.voluntaryM
          ?? (before && actor.moving ? Math.hypot(actor.x - before.x, actor.y - before.y) : 0);
        distanceM += Math.max(0, voluntary);
        if (voluntary > 0) lastMovedAtUs = frame.atUs;
        previous = frame;
      }
      lastFrameAtUs = frame.atUs;
    }
    return { distanceM, lastMovedAtUs, lastFrameAtUs: previous?.atUs ?? lastFrameAtUs };
  };

  return {
    sample(arena: CombatArena, actorId: string, atUs: number): ArenaGaitSample {
      // New samples carry their checkpoint in world metres, including the player. This is
      // independent of render history and survives backward seeks after the ring is trimmed.
      let before: CombatArenaFrame | undefined, after: CombatArenaFrame | undefined;
      for (const frame of arena.frames) {
        if (frame.atUs > atUs) { after = frame; break; }
        before = frame;
      }
      const actorOf = (frame?: CombatArenaFrame) => actorId === 'player' ? frame?.player : frame?.mobs[actorId];
      const current = actorOf(before), next = actorOf(after);
      if (current?.travelledM != null) {
        const fraction = before && after ? clamp01((atUs - before.atUs) / (after.atUs - before.atUs)) : 0;
        const distanceM = current.travelledM + fraction * Math.max(0, (next?.travelledM ?? current.travelledM) - current.travelledM);
        return { distanceM, phase: distanceM / stride % 1,
          lastMovedAtUs: current.lastMovedAtUs ?? -Infinity };
      }
      let state = states.get(actorId);
      if (!state || atUs < state.atUs) {
        const rebuilt = rebuild(arena.frames, actorId, atUs);
        state = { atUs, distanceM: rebuilt.distanceM, lastFrameAtUs: rebuilt.lastFrameAtUs, lastMovedAtUs: rebuilt.lastMovedAtUs };
        states.set(actorId, state);
      } else if (atUs > state.atUs) {
        let previous: CombatArenaFrame | undefined;
        for (const frame of arena.frames) {
          if (frame.atUs > state.lastFrameAtUs) break;
          previous = frame;
        }
        for (const frame of arena.frames) {
          if (frame.atUs <= state.lastFrameAtUs || frame.atUs > atUs) continue;
          const actor = frame.mobs[actorId];
          if (actor) {
            const before = previous?.mobs[actorId];
            const voluntary = actor.voluntaryM
              ?? (before && actor.moving ? Math.hypot(actor.x - before.x, actor.y - before.y) : 0);
            state.distanceM += Math.max(0, voluntary);
            if (voluntary > 0) state.lastMovedAtUs = frame.atUs;
            previous = frame;
          }
          state.lastFrameAtUs = Math.max(state.lastFrameAtUs, frame.atUs);
        }
        state.atUs = atUs;
      }
      return { distanceM: state.distanceM, phase: state.distanceM / stride % 1, lastMovedAtUs: state.lastMovedAtUs };
    },
    retain(actorIds: ReadonlySet<string>) {
      for (const id of states.keys()) if (!actorIds.has(id)) states.delete(id);
    },
    clear() { states.clear(); },
  };
}

export type ArenaGait = ReturnType<typeof createArenaGait>;

/** The field says why it is empty; a Push is its own state, not a quiet clearing. */
export function arenaFieldNote(
  state: { phase: GameState['phase']; hunting: boolean; walk: unknown; group: readonly unknown[] },
): { text: string; camp: boolean } | null {
  if (state.phase === 'camp') return { text: 'Pushed to camp · recovering', camp: true };
  if (!state.hunting && !state.walk && !state.group.length) return { text: 'The clearing is quiet.', camp: false };
  return null;
}
