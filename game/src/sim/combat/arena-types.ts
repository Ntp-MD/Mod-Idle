import type { SkillAreaSnapshot, SkillCastTiming } from '../../../../engine/types.ts';
import type { CombatFlight, CombatIntent } from './combat-actions';
import type { FxEvent, Mob } from '../core/types';
import type { NavLayout, NavPoint } from '../../../../engine/navigation.ts';

/**
 * Shared arena contracts (Phase 6 combat-arena split).
 * Pure types only: no runtime imports, no DOM, no GameState writes.
 * combat-arena.ts re-exports these so active callers keep their paths.
 */

/** Transient ground-space state. This object belongs to its caller, never to a save. */
export type ArenaTargetPriority = 'nearest' | 'lowest-hp' | 'highest-hp';

export interface CombatArenaAction {
  id: number;
  actorId: string;
  targetId?: string;
  kind: 'swing' | 'cast' | 'death';
  /** Combat-clock timestamp of the action, in arena.unitsPerSec units. */
  atUs: number;
  /** End of the action's presentation history. Timed skills resolve at timing.impactAtUs. */
  endsAtUs: number;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  skillId?: string;
  /** Frozen cast footprint in ground meters, independent of subsequent movement or deaths. */
  area?: SkillAreaSnapshot;
  timing?: SkillCastTiming;
  /** Caster ownership remains fixed when later payload receipts correct their own arrival. */
  primaryTiming?: SkillCastTiming;
  hitIds?: string[];
  /** How many resolved impacts this action has produced (a field pulse counts once). */
  impactCount?: number;
  /** A released ordinary ranged shot; presentation may draw it differently from a melee swing. */
  ranged?: boolean;
  /** The committed release beat; later reschedules must not release the same action twice. */
  releasedAtUs?: number;
  /** Encounter identity when the action began; a change before release cancels the preparation. */
  areaKey?: string;
  /** A trigger/proc cast owns an effect and flight, never the actor's primary pose. */
  nonblocking?: boolean;
  /** A channel holds its active pose until the last pulse, then recovers. */
  channel?: boolean;
  /**
   * A bounded channel's effective sustain rate in Mana per simulation second, captured at
   * release from the shared model at the cast's skill level. Absent means no sustain cost —
   * legacy rows and non-channel actions never carry it.
   */
  channelRatePerSec?: number;
  /**
   * The persisted payment watermark: sustain is funded through this combat timestamp.
   * Advancing to the same timestamp twice costs nothing; only a funded impact may resolve.
   */
  channelPaidUntilUs?: number;
  cancelledAtUs?: number;
  cancelReason?: string;
  /** Immutable launch paths plus terminal receipts; a corrected contact cannot warp the prefix. */
  payloads?: CombatArenaPayload[];
}

export interface CombatArenaPayload {
  index: number;
  source: { x: number; y: number };
  destination: { x: number; y: number };
  releaseAtUs: number;
  plannedImpactAtUs: number;
  impactAtUs?: number;
  contact?: { x: number; y: number };
  targetId?: string;
  /** A per-payload terminal receipt, such as one volley bolt stopped by an obstacle. */
  cancelReason?: string;
}

/** A released player ordinary shot. The projectile is non-homing and owns its own contact. */
export interface CombatPlayerShot {
  actionId: number;
  targetId: string;
  source: { x: number; y: number };
  destination: { x: number; y: number };
  position: { x: number; y: number };
  releaseAtUs: number;
  impactAtUs: number;
  speedMps: number;
  radiusM: number;
  /** Encounter identity at release; leaving it cancels the shot with a receipt. */
  areaKey?: string;
  queued?: boolean;
  /** Start of the segment the next sweep measures from; contact backdates to its crossing. */
  lastCheckedAtUs?: number;
}

/** A released incoming ordinary shot. The projectile is non-homing and owns its own contact. */
export interface CombatMobFlight {
  actionId: number;
  mobId: string;
  /** Offensive receipt at release; a dead source no longer supplies the live record. */
  mob: Mob;
  source: { x: number; y: number };
  destination: { x: number; y: number };
  position: { x: number; y: number };
  releaseAtUs: number;
  impactAtUs: number;
  speedMps: number;
  radiusM: number;
  /** A skill shot names its row; a plain ranged basic leaves both cast fields absent. */
  skillId?: string;
  kind?: 'projectile' | 'ground';
  impactRadiusM?: number;
  /** Encounter identity at release; leaving it cancels the shot with a receipt. */
  areaKey?: string;
  queued?: boolean;
  /** Start of the segment the next sweep measures from; contact backdates to its crossing. */
  lastCheckedAtUs?: number;
}

export interface CombatArenaActor {
  id: string;
  x: number;
  y: number;
  /** Radians on the x/y ground plane. */
  facing: number;
  /** Transient camera-sector checkpoint, captured independently of render frequency. */
  facingSector?: number;
  moving: boolean;
  /** Ground footprint radius in meters, from the body class (player: the arena constant). */
  radiusM: number;
  /** Authored-geometry route being followed, in ground meters. */
  path?: NavPoint[];
  /** The goal the current path was planned for, so a moved goal replans. */
  pathGoal?: NavPoint;
  /** When the current route was planned; a moving target only replans on its own beat. */
  pathPlannedAtUs?: number;
  /** The last route to this goal failed; callers report it and drop the order. */
  routeFailed?: boolean;
  /** Consecutive failed plans toward an unchanged goal; the body holds ground after the third. */
  routeFailCount?: number;
  /** The goal the failed count belongs to; a goal that moves at least 1 m resets the count. */
  routeHoldGoal?: NavPoint;
  hp: number;
  hpMax: number;
  es?: number;
  mana?: number;
  /** Own movement in this sample, in meters; separation and forced pushes are not part of it. */
  voluntaryM?: number;
  /** Transient locomotion checkpoint; retained frames can be trimmed without losing gait phase. */
  travelledM?: number;
  lastMovedAtUs?: number;
  /** Display-only status facts copied at this combat sample, without damage-clock internals. */
  statuses?: Record<string, { stacks: number; secLeft: number }>;
  /** A stand-off body that has fired from its current band holds until the target leaves reach. */
  holdAtRange?: boolean;
  /** A ready strike the body is closing to; the scheduler clears it once the strike releases. */
  strikeRangeM?: number;
  /** The authored idle beat this body last decided on, and the spot it picked (absent = wait). */
  idleBeat?: number;
  idleGoal?: NavPoint;
  /** The committed ground threat the body is still answering; the plan holds until the flight
   *  lands or the body clears the hysteresis band, so the farmer cannot wander back inside. */
  avoidActionId?: number;
  mob?: Mob;
  action?: CombatArenaAction;
}

export interface CombatArenaBody extends CombatArenaActor {
  mob: Mob;
  diedAtUs: number;
}

export interface CombatArenaFrame {
  atUs: number;
  player: CombatArenaActor;
  mobs: Record<string, CombatArenaActor>;
  bodies: CombatArenaBody[];
  /** The player's committed approach/windup decision sampled with this frame. */
  intent?: CombatIntent;
  /** Player buff timers sampled with this frame, so a HUD read cannot mix clocks. */
  buffs?: Record<string, number>;
  /** Curse lines per mob sampled with this frame (stat → value). */
  curses?: Record<string, Record<string, number>>;
  /** The player's deliberate target pin sampled with this frame. */
  focusId?: string;
}

export type ArenaFeedbackEvent = FxEvent & { point?: { x: number; y: number } };

export interface CombatArena extends CombatArenaFrame {
  /** Simulation adapter: timed skills share the clock without enabling live movement or reach gates. */
  offline?: boolean;
  queueOnly?: boolean;
  /** Release snapshot retained even when no channel pulse is currently queued. */
  channelTemplate?: CombatFlight;
  bounds: { width: number; height: number };
  nowUs: number;
  unitsPerSec: number;
  actions: CombatArenaAction[];
  frames: CombatArenaFrame[];
  /** Transient presentation history; notification-ring pressure cannot erase a visible hit. */
  feedback?: ArenaFeedbackEvent[];
  feedbackAreaKey?: string;
  actionSeq: number;
  intent?: CombatIntent;
  flights: CombatFlight[];
  mobFlights: CombatMobFlight[];
  playerShots: CombatPlayerShot[];
  /** The player's deliberate target pin; cleared/ignored when the body is gone. */
  focusId?: string;
  /** Automatic target choice; a focused or committed target still wins. */
  targetPriority?: ArenaTargetPriority;
  /** Authored static ground geometry; absent means none is proven, never "open ground". */
  nav?: NavLayout;
  /** Layout id the current `nav` was resolved from, so a tick does not rebuild it. */
  navLayoutId?: string;
}
