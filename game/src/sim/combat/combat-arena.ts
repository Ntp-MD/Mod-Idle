import { E, sm, spawns } from '../../engine/client';
import { mulberry32 } from '../../engine/client-helpers';
import { spawnSlotSeed } from '../../../../engine/spawns.ts';
import { arenaFacingIndex } from '../../presentation/arena-camera';
import { isClear, route, sweepDisc, traceSight, type NavLayout, type NavPoint } from '../../../../engine/navigation.ts';
import { attackProfileGeometry, type AttackRangeGeometry } from '../../../../engine/attack-range.ts';
import { targetsInSkillArea } from '../../../../engine/skill-actions.ts';
import { skillAreaSnapshot } from '../../../../engine/skill-area.ts';
import type { AttackRangeProfile, SkillAreaSnapshot, SkillCastTiming } from '../../../../engine/types.ts';
import type { CombatIntent, CombatFlight } from './combat-actions';
import type { FxEvent, GameState, Mob } from '../core/types';

const CFG = E.combat_arena;
/**
 * One plain identity snapshot per spawn. A frame only reads the mob's immutable identity
 * (species, kind, level, variant, art profile); every mutable combat value it shows
 * (hp, hpMax, statuses) lives on the actor and is captured separately. Copying the whole
 * reactive mob on every sample was the measured hotspot in P6.
 */
const mobCopy = (mob: Mob): Mob => ({
  ...mob, skillReadyAtUs: mob.skillReadyAtUs ? { ...mob.skillReadyAtUs } : undefined,
});
const statusCopy = (statuses: Record<string, { stacks: number; secLeft: number } | undefined> = {}) => {
  const copy: Record<string, { stacks: number; secLeft: number }> = {};
  for (const id in statuses) {
    if (!Object.hasOwn(statuses, id)) continue;
    const status = statuses[id];
    if (status) copy[id] = { stacks: status.stacks, secLeft: status.secLeft };
  }
  return copy;
};

/** Transient ground-space state. This object belongs to its caller, never to a save. */
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

/** Ground footprint radius in meters: the sim reads body classes, never pixels. */
export function bodyRadiusM(mob?: Mob): number {
  if (!mob) return CFG.player_radius_m ?? 0.25;
  const entry = (E.mob.sizes as { id: string; radius_m?: number }[] | undefined)
    ?.find((size) => size.id === (mob.readsAs || 'medium'));
  return entry?.radius_m ?? 0.25;
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

export interface CombatArena extends CombatArenaFrame {
  bounds: { width: number; height: number };
  nowUs: number;
  unitsPerSec: number;
  actions: CombatArenaAction[];
  frames: CombatArenaFrame[];
  actionSeq: number;
  intent?: CombatIntent;
  flights: CombatFlight[];
  mobFlights: CombatMobFlight[];
  playerShots: CombatPlayerShot[];
  /** The player's deliberate target pin; cleared/ignored when the body is gone. */
  focusId?: string;
  /** Authored static ground geometry; absent means none is proven, never "open ground". */
  nav?: NavLayout;
  /** Layout id the current `nav` was resolved from, so a tick does not rebuild it. */
  navLayoutId?: string;
}

export function createCombatArena(): CombatArena {
  return {
    bounds: { width: CFG.width, height: CFG.height },
    nowUs: 0, atUs: 0, unitsPerSec: 1_000_000,
    player: { id: 'player', ...CFG.player_start, facing: 0, moving: false, radiusM: bodyRadiusM(), hp: 0, hpMax: 0 },
    mobs: {}, bodies: [], actions: [], frames: [], actionSeq: 0, flights: [], mobFlights: [], playerShots: [],
  };
}

export const arenaDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(b.x - a.x, b.y - a.y);

const NORMAL_ATTACK = CFG.normal_attack;
const ATTACK_CLEARANCE_M = Number(NORMAL_ATTACK.contact_clearance_m);
const ATTACK_BAND_M = Number(NORMAL_ATTACK.contact_band_m);

/** The profile an ordinary spawn line resolves to; delivery is never inferred from a sprite. */
export function mobAttackProfile(mob: Mob): AttackRangeProfile {
  const line = mob.line === 'stand-off' ? 'stand-off' : 'front';
  const id = NORMAL_ATTACK.legacy[line];
  return NORMAL_ATTACK.profiles[id as keyof typeof NORMAL_ATTACK.profiles] as AttackRangeProfile;
}

/** The profile a player basic resolves to from the held weapon group. */
export function playerAttackProfile(weaponName: string): AttackRangeProfile {
  const group = sm.weaponGroupOf(weaponName);
  const key = group === 'ranged' || group === 'magic' ? group : 'melee';
  const id = NORMAL_ATTACK.player[key];
  return NORMAL_ATTACK.profiles[id as keyof typeof NORMAL_ATTACK.profiles] as AttackRangeProfile;
}

/** One geometry read for every basic-attack caller: AI, start, release, contact and debug. */
export function attackGeometryFor(
  profile: AttackRangeProfile, selfRadius: number, targetRadius: number, distance: number,
): AttackRangeGeometry {
  return attackProfileGeometry(profile, { selfRadius, targetRadius }, distance,
    ATTACK_CLEARANCE_M, ATTACK_BAND_M);
}

export function arenaMobAttackGeometry(arena: CombatArena, mobId: string): AttackRangeGeometry | undefined {
  const actor = arena.mobs[mobId];
  if (!actor?.mob) return undefined;
  return attackGeometryFor(mobAttackProfile(actor.mob),
    actor.radiusM ?? bodyRadiusM(actor.mob), arena.player.radiusM ?? bodyRadiusM(),
    arenaDistance(actor, arena.player));
}

export function arenaMobInReach(arena: CombatArena, mobId: string): boolean {
  return arenaMobAttackGeometry(arena, mobId)?.inRange === true;
}

/** Melee contact is radius-only until ground geometry is authored; then sight also gates the hit. */
export function arenaMobSightClear(arena: CombatArena, mobId: string): boolean {
  const actor = arena.mobs[mobId];
  if (!actor || !arena.nav) return true;
  return traceSight(arena.nav, actor, arena.player) === null;
}

export function arenaPlayerAttackGeometry(
  arena: CombatArena, weaponName: string, mobId: string,
): AttackRangeGeometry | undefined {
  const target = arena.mobs[mobId];
  if (!target) return undefined;
  return attackGeometryFor(playerAttackProfile(weaponName),
    arena.player.radiusM ?? bodyRadiusM(), target.radiusM ?? bodyRadiusM(), arenaDistance(arena.player, target));
}

export function arenaPlayerInReach(arena: CombatArena, weaponName: string, mobId: string): boolean {
  return arenaPlayerAttackGeometry(arena, weaponName, mobId)?.inRange === true;
}

/** Standard-body maximum centre distance; callers with real bodies use `attackGeometryFor`. */
export function arenaWeaponRange(weaponName: string): number {
  const radius = bodyRadiusM();
  return attackGeometryFor(playerAttackProfile(weaponName), radius, radius, 0).maxCenterDistance;
}

export function arenaWeaponStopRange(weaponName: string): number {
  const radius = bodyRadiusM();
  return attackGeometryFor(playerAttackProfile(weaponName), radius, radius, 0).stopCenterDistance;
}

export function arenaSkillRange(skillId: string): number {
  const skill = sm.byId[skillId];
  if (!skill || skill.type === 'buff' || skill.type === 'heal') return Infinity;
  return sm.castProfileOf(skill).range_m;
}

/**
 * Coverage memo for `aimForSkill`. A target circle or a caster cone/line scores every candidate
 * footprint against every living body, so one cast costs O(n²); a rotation may ask for the same
 * row several times in one sample. The memo is keyed by arena and skill, and its hit test compares
 * every input the loop reads — candidate identity, liveness, pose, player pose and facing — so a
 * moved, dead, replaced or newly focused body always misses. Deterministic result, no RNG.
 */
interface AimCoverageMemo {
  mode: 'target' | 'caster';
  radius: number;
  range: number;
  count: number;
  mobs: Mob[];
  live: boolean[];
  xs: number[];
  ys: number[];
  playerX: number;
  playerY: number;
  facing: number;
  /** Authored ground can change which body is a visible target; include the resolved layout. */
  nav: NavLayout | undefined;
  /** Index into `mobs` of the winning candidate, or -1 when the row has no castable target. */
  best: number;
  pointX: number;
  pointY: number;
  /** Caster cones/lines: did any living body sit inside the authored reach at sample time? */
  inside: boolean;
}

const AIM_MEMOS = new WeakMap<CombatArena, Map<string, AimCoverageMemo>>();

/** Test/measurement counters: coverage passes prove the memo skips the quadratic scan. */
export const AIM_DIAGNOSTICS = { hits: 0, misses: 0, coverageChecks: 0 };

function aimMemoFor(arena: CombatArena): Map<string, AimCoverageMemo> {
  let memos = AIM_MEMOS.get(arena);
  if (!memos) {
    memos = new Map();
    AIM_MEMOS.set(arena, memos);
  }
  return memos;
}

function aimMemoValid(
  memo: AimCoverageMemo | undefined, arena: CombatArena, group: Mob[],
  mode: 'target' | 'caster', radius: number, range: number,
): memo is AimCoverageMemo {
  if (!memo || memo.mode !== mode || memo.radius !== radius || memo.range !== range
    || memo.count !== group.length
    || memo.playerX !== arena.player.x || memo.playerY !== arena.player.y) return false;
  // Only the caster cone/line reads facing or sight; a target circle reads positions alone.
  if (mode === 'caster' && (memo.facing !== arena.player.facing || memo.nav !== arena.nav)) return false;
  for (let index = 0; index < group.length; index++) {
    const mob = group[index];
    const pose = arena.mobs[mob.id];
    const live = mob.hp > 0 && !!pose;
    if (memo.mobs[index] !== mob || memo.live[index] !== live) return false;
    if (memo.xs[index] !== (pose?.x ?? 0) || memo.ys[index] !== (pose?.y ?? 0)) return false;
  }
  return true;
}

function aimMemoStore(
  arena: CombatArena, skillId: string, mode: 'target' | 'caster', group: Mob[],
  radius: number, range: number, best: number, pointX: number, pointY: number, inside: boolean,
): void {
  const memo = aimMemoFor(arena).get(skillId);
  const count = group.length;
  const write = memo && memo.count === count && memo.mobs.length === count ? memo
    : {
      mode, radius, range, count, playerX: 0, playerY: 0, facing: 0, nav: undefined,
      best: -1, pointX: 0, pointY: 0, inside: false,
      mobs: new Array<Mob>(count), live: new Array<boolean>(count),
      xs: new Array<number>(count), ys: new Array<number>(count),
    } satisfies AimCoverageMemo;
  write.mode = mode;
  write.radius = radius;
  write.range = range;
  write.count = count;
  write.playerX = arena.player.x;
  write.playerY = arena.player.y;
  write.facing = arena.player.facing;
  write.nav = arena.nav;
  write.best = best;
  write.pointX = pointX;
  write.pointY = pointY;
  write.inside = inside;
  for (let index = 0; index < count; index++) {
    const mob = group[index];
    const pose = arena.mobs[mob.id];
    write.mobs[index] = mob;
    write.live[index] = mob.hp > 0 && !!pose;
    write.xs[index] = pose?.x ?? 0;
    write.ys[index] = pose?.y ?? 0;
  }
  aimMemoFor(arena).set(skillId, write);
}

/**
 * Where one row wants to be aimed: singles track the nearest body, caster circles are
 * centred on the player (the nearest body is only the approach magnet), and target
 * circles centre on the in-range body whose circle holds the most bodies. When no
 * candidate is in cast range yet, the nearest body is the approach magnet — unless
 * `requireRange` asks for a castable aim only, in which case there is none. Ties break
 * by distance to the player, then queue order — deterministic, no RNG.
 * Single home of aim for rotation casts, re-aims and trigger casts alike.
 */
export function aimForSkill(
  arena: CombatArena, group: Mob[], skillId: string, requireRange = false,
): { mob: Mob; point: { x: number; y: number } } | undefined {
  const skill = sm.byId[skillId];
  const radius = skill?.area?.radius_m ?? 0;
  // A deliberate focus pins the target of every aim path until the body is gone.
  const focused = arena.focusId
    ? group.find((mob) => mob.id === arena.focusId && mob.hp > 0 && arena.mobs[mob.id]) : undefined;
  if (focused) {
    const pose = arena.mobs[focused.id];
    // A pinned body behind an authored sight screen is not attackable; the pin survives for the
    // day the screen clears. Movement-only ground (a thicket) stays transparent, and self rows
    // (heal/buff) do not read the target's line at all.
    const hostile = skill?.type === 'attack' || skill?.type === 'curse';
    if (hostile && arena.nav && traceSight(arena.nav, arena.player, pose)) return undefined;
    if (requireRange && arenaDistance(arena.player, pose) > arenaSkillRange(skillId) + 1e-7)
      return undefined;
    const oriented = skill?.area?.shape === 'cone' || skill?.area?.shape === 'line';
    const point = skill?.area?.origin === 'caster'
      ? (oriented ? { x: pose.x, y: pose.y } : { x: arena.player.x, y: arena.player.y })
      : { x: pose.x, y: pose.y };
    return { mob: focused, point };
  }
  const nearest = (): { mob: Mob; point: { x: number; y: number } } | undefined => {
    const t = arenaTarget(arena, group);
    if (!t) return undefined;
    const pose = arena.mobs[t.id];
    if (!pose) return undefined;
    return { mob: t, point: { x: pose.x, y: pose.y } };
  };
  // A caster-origin cone or line is aimed by direction even when its footprint declares no radius
  // (a line carries `length_m` instead), so it must not fall into the plain nearest-body path.
  const casterOriented = !!skill?.area && skill.area.origin === 'caster'
    && (skill.area.shape === 'cone' || skill.area.shape === 'line');
  if (!skill || (radius <= 0 && !casterOriented)) {
    const t = nearest();
    if (!t) return undefined;
    // a single press casts only while its primary is already in cast range
    if (requireRange && arenaDistance(arena.player, t.point) > arenaSkillRange(skillId) + 1e-7)
      return undefined;
    return t;
  }
  if (casterOriented) {
    const reach = Math.max(radius, skill.area!.length_m ?? 0);
    const memo = aimMemoFor(arena).get(skillId);
    if (aimMemoValid(memo, arena, group, 'caster', radius, reach)) {
      AIM_DIAGNOSTICS.hits++;
      if ((!memo.inside && requireRange) || memo.best < 0) return undefined;
      return { mob: group[memo.best], point: { x: memo.pointX, y: memo.pointY } };
    }
    AIM_DIAGNOSTICS.misses++;
    const live: Mob[] = [];
    let inside = false;
    for (const mob of group) {
      const pose = arena.mobs[mob.id];
      if (mob.hp <= 0 || !pose) continue;
      live.push(mob);
      if (arenaDistance(arena.player, pose) <= reach + 1e-7) inside = true;
    }
    const t = arenaTarget(arena, group);
    if (!t) {
      aimMemoStore(arena, skillId, 'caster', group, radius, reach, -1, 0, 0, inside);
      return undefined;
    }
    // The direction that reaches the most bodies wins; the nearest body only breaks ties.
    // Score actual eligible footprints only.
    const actors = live.map((mob) => ({ ...arena.mobs[mob.id], mob }));
    let bestMob: Mob | undefined;
    let bestCount = -1;
    let bestDist = Infinity;
    for (const mob of live) {
      const pose = arena.mobs[mob.id];
      const area = skillAreaSnapshot(skill.area!, arena.player, pose, mob.id, arena.player.facing);
      AIM_DIAGNOSTICS.coverageChecks++;
      const count = targetsInSkillArea(area, actors).length;
      const dist = arenaDistance(arena.player, pose);
      if (count > bestCount || (count === bestCount && dist < bestDist - 1e-7)) {
        bestMob = mob;
        bestCount = count;
        bestDist = dist;
      }
    }
    let pointX = bestMob ? arena.mobs[bestMob.id].x : 0;
    let pointY = bestMob ? arena.mobs[bestMob.id].y : 0;
    // Without chasing their bearing anchor: a distant bearing that still hits nearby
    // occupants must not force a walk to the far point. Clamp the point to the
    // authored reach while preserving the bearing.
    if (bestCount > 0 && arenaDistance(arena.player, { x: pointX, y: pointY }) > reach + 1e-7) {
      const angle = Math.atan2(pointY - arena.player.y, pointX - arena.player.x);
      pointX = arena.player.x + Math.cos(angle) * reach;
      pointY = arena.player.y + Math.sin(angle) * reach;
    }
    const best = bestMob ? group.indexOf(bestMob) : -1;
    aimMemoStore(arena, skillId, 'caster', group, radius, reach, best, pointX, pointY, inside);
    if (!inside && requireRange) return undefined;
    return best >= 0 ? { mob: group[best], point: { x: pointX, y: pointY } } : undefined;
  }
  if (skill.area!.origin === 'caster') {
    // A circle stays centred on the player; the nearest body is only the approach magnet.
    const inside = group.some((mob) => mob.hp > 0 && arena.mobs[mob.id]
      && arenaDistance(arena.player, arena.mobs[mob.id]) <= radius + 1e-7);
    if (!inside && requireRange) return undefined;
    const t = arenaTarget(arena, group);
    if (!t) return undefined;
    return { mob: t, point: { x: arena.player.x, y: arena.player.y } };
  }
  const range = arenaSkillRange(skillId);
  const memo = aimMemoFor(arena).get(skillId);
  if (aimMemoValid(memo, arena, group, 'target', radius, range)) {
    AIM_DIAGNOSTICS.hits++;
    if (memo.best >= 0) return { mob: group[memo.best], point: { x: memo.pointX, y: memo.pointY } };
  } else {
    AIM_DIAGNOSTICS.misses++;
    let bestIndex = -1;
    let bestCount = -1;
    let bestDist = Infinity;
    for (let index = 0; index < group.length; index++) {
      const mob = group[index];
      const pose = arena.mobs[mob.id];
      if (mob.hp <= 0 || !pose) continue;
      const dist = arenaDistance(arena.player, pose);
      if (dist > range + 1e-7) continue;
      let n = 0;
      for (const other of group) {
        const p2 = arena.mobs[other.id];
        if (other.hp <= 0 || !p2) continue;
        AIM_DIAGNOSTICS.coverageChecks++;
        if (arenaDistance(pose, p2) <= radius + 1e-7) n++;
      }
      if (bestIndex < 0 || n > bestCount || (n === bestCount && dist < bestDist - 1e-7)) {
        bestIndex = index;
        bestCount = n;
        bestDist = dist;
      }
    }
    const pointX = bestIndex >= 0 ? arena.mobs[group[bestIndex].id].x : 0;
    const pointY = bestIndex >= 0 ? arena.mobs[group[bestIndex].id].y : 0;
    aimMemoStore(arena, skillId, 'target', group, radius, range, bestIndex, pointX, pointY, false);
    if (bestIndex >= 0) return { mob: group[bestIndex], point: { x: pointX, y: pointY } };
  }
  return requireRange ? undefined : nearest();
}

/** Resolve one cast through the same aim every path uses, before damage mutates the bodies. */
export function arenaSkillTargets(arena: CombatArena, skillId: string, group: Mob[]): {
  targets: Mob[]; area?: SkillAreaSnapshot;
} {
  const skill = sm.byId[skillId];
  if (!skill || skill.type === 'buff' || skill.type === 'heal')
    return { targets: group };
  const aim = aimForSkill(arena, group, skillId);
  if (!aim) return { targets: [] };
  const definition = skill.area ?? { origin: 'target' as const, radius_m: 0 };
  const radius = definition.radius_m ?? 0;
  const pose = arena.mobs[aim.mob.id];
  const aimPoint = definition.origin === 'caster'
    ? aim.point
    : radius > 0 ? aim.point : pose ?? aim.point;
  if (definition.origin !== 'caster'
    && arenaDistance(arena.player, aimPoint) > arenaSkillRange(skillId) + 1e-7) {
    return { targets: [] };
  }
  const area = skillAreaSnapshot(definition, arena.player, aimPoint, aim.mob.id, arena.player.facing);
  const actors = group.flatMap((mob) => mob.hp > 0 && arena.mobs[mob.id]
    ? [{ ...arena.mobs[mob.id], mob }] : []);
  return { targets: targetsInSkillArea(area, actors).map((actor) => actor.mob), area };
}

/** Standard-body maximum centre distance for an ordinary spawn; real actors use geometry. */
export function arenaMobRange(mob: Mob): number {
  const selfRadius = bodyRadiusM(mob);
  return attackGeometryFor(mobAttackProfile(mob), selfRadius, bodyRadiusM(), 0).maxCenterDistance;
}

/** Standard-body stop distance for an ordinary spawn; real actors use geometry. */
export function arenaMobStopRange(mob: Mob): number {
  const selfRadius = bodyRadiusM(mob);
  return attackGeometryFor(mobAttackProfile(mob), selfRadius, bodyRadiusM(), 0).stopCenterDistance;
}

export function arenaInRange(arena: CombatArena, mobId: string, range: number): boolean {
  const mob = arena.mobs[mobId];
  return !!mob && arenaDistance(arena.player, mob) <= range + 1e-7;
}

/** Nearest living body, with queue order as the deterministic tie-break. */
export function arenaTarget(arena: CombatArena, group: Mob[]): Mob | undefined {
  if (arena.focusId) {
    const focused = group.find((mob) => mob.id === arena.focusId && mob.hp > 0 && arena.mobs[mob.id]);
    if (focused) return focused;
  }
  let target: Mob | undefined;
  let nearest = Infinity;
  for (const mob of group) {
    const pose = arena.mobs[mob.id];
    if (mob.hp <= 0 || !pose) continue;
    // Authored sight screens hide a body from acquisition; a pinned focus above stays explicit.
    if (arena.nav && sweepDisc(arena.nav, arena.player, pose, 0, 'sight')) continue;
    const distance = arenaDistance(arena.player, pose);
    if (distance < nearest) { nearest = distance; target = mob; }
  }
  return target;
}

/** Reconcile spawns without consuming combat RNG or moving existing bodies. */
export function syncCombatArena(arena: CombatArena, state: GameState, atUs: number, unitsPerSec: number, maxHp: number): void {
  // A clock that jumped backwards is a different character generation (a rewind or a restore), so
  // the arena cannot keep work from the timeline it left behind.
  const rewound = atUs < arena.nowUs - CFG.movement_step_sec * unitsPerSec;
  if (rewound || atUs > arena.nowUs + CFG.movement_step_sec * unitsPerSec || state.player.hp <= 0) {
    const cancelled = new Set<number>();
    if (arena.intent?.actionId != null) cancelled.add(arena.intent.actionId);
    for (const flight of arena.flights) cancelled.add(flight.actionId);
    if (arena.player.action) cancelled.add(arena.player.action.id);
    for (const shot of arena.mobFlights) cancelled.add(shot.actionId);
    for (const shot of arena.playerShots) cancelled.add(shot.actionId);
    for (const actor of Object.values(arena.mobs)) {
      if (actor.action?.kind === 'cast' && actor.action.timing && !actor.action.impactCount)
        cancelled.add(actor.action.id);
    }
    for (const id of cancelled) {
      const action = arena.actions.find((entry) => entry.id === id);
      if (action && action.cancelledAtUs == null)
        updateArenaAction(arena, id, { cancelledAtUs: atUs, cancelReason: 'resync', endsAtUs: atUs });
    }
    arena.intent = undefined;
    arena.flights = [];
    arena.mobFlights = [];
    arena.playerShots = [];
    arena.player.avoidActionId = undefined;
    arena.player.action = undefined;
  }
  arena.unitsPerSec = unitsPerSec;
  arena.nowUs = atUs;
  // Static ground is data: resolve it once per authored layout, and never invent it.
  const layoutId = spawns.profileFor(state.zone, state.cell?.sub ?? null).layout;
  if (arena.navLayoutId !== layoutId) {
    arena.navLayoutId = layoutId;
    arena.nav = spawns.navigation(layoutId) ?? undefined;
  }
  arena.player.hp = state.player.hp;
  arena.player.es = state.player.es;
  arena.player.mana = state.player.mana;
  arena.player.hpMax = maxHp;
  const savedPositions = new Map((state.field?.actors ?? []).map((actor) => [actor.id, actor]));
  const slotHomes = new Map((state.field?.slots ?? [])
    .filter((slot) => !!slot.mobId).map((slot) => [slot.mobId!, slot.home]));
  for (const [index, mob] of state.group.entries()) {
    const offset = Math.ceil(index / 2) * (index % 2 ? -1 : 1);
    const radius = bodyRadiusM(mob);
    const saved = savedPositions.get(mob.id);
    const home = saved ?? slotHomes.get(mob.id);
    arena.mobs[mob.id] ??= {
      id: mob.id,
      x: home ? Math.max(radius, Math.min(arena.bounds.width - radius, home.x))
        : Math.max(radius, Math.min(arena.bounds.width - radius, CFG.mob_start.x + (index > 2 ? CFG.mob_start.spacing : 0))),
      y: home ? Math.max(radius, Math.min(arena.bounds.height - radius, home.y))
        : Math.max(radius, Math.min(arena.bounds.height - radius, CFG.mob_start.y + offset * CFG.mob_start.spacing)),
      facing: Math.PI, moving: false, radiusM: radius, hp: mob.hp, hpMax: mob.hpMax, mob: mobCopy(mob),
    };
    const actor = arena.mobs[mob.id];
    if (actor.mob) { actor.mob.line = mob.line; actor.mob.readsAs = mob.readsAs; }
  }
  captureCombatArena(arena, state, atUs);
}

const actorCopy = (actor: CombatArenaActor): CombatArenaActor => ({
  ...actor, statuses: statusCopy(actor.statuses),
});

/** Return the same list when nothing expired; only a real trim allocates the filtered copy. */
function retain<T>(list: T[], keep: (entry: T) => boolean): T[] {
  for (let index = 0; index < list.length; index++) if (!keep(list[index])) return list.filter(keep);
  return list;
}

/** Capture after impacts too, so delayed playback shows the pool loss on the correct beat. */
export function captureCombatArena(arena: CombatArena, state: GameState, atUs: number): void {
  arena.atUs = atUs;
  arena.player.hp = state.player.hp;
  arena.player.es = state.player.es;
  arena.player.mana = state.player.mana;
  arena.player.statuses = statusCopy(state.playerStatuses);
  const live = new Set<string>();
  for (const mob of state.group) live.add(mob.id);
  for (const id in arena.mobs) {
    if (Object.hasOwn(arena.mobs, id) && !live.has(id)) delete arena.mobs[id];
  }
  for (const mob of state.group) {
    const actor = arena.mobs[mob.id];
    if (actor) {
      // The actor's mob keeps its spawn identity; hp/hpMax are the live facts a frame reads.
      actor.hp = mob.hp; actor.hpMax = mob.hpMax;
      if (actor.mob) { actor.mob.line = mob.line; actor.mob.readsAs = mob.readsAs; }
      actor.statuses = statusCopy(state.mobStatus[mob.id]?.statuses);
    }
  }
  const oldest = atUs - CFG.history_sec * arena.unitsPerSec;
  const bodySpan = CFG.body_sec * arena.unitsPerSec;
  arena.bodies = retain(arena.bodies, (body) => atUs - body.diedAtUs <= bodySpan);
  arena.actions = retain(arena.actions, (action) => action.endsAtUs >= oldest);
  arena.frames = retain(arena.frames, (frame) => frame.atUs >= oldest);
  // A second capture at the same timestamp (an impact after the movement sample) must keep the
  // movement evidence the first frame carries; the live actors were already reset for the next step.
  const previousFrame = arena.frames.at(-1)?.atUs === atUs ? arena.frames.at(-1) : undefined;
  const keepVoluntary = (copy: CombatArenaActor, prior?: CombatArenaActor): CombatArenaActor => {
    if (!(copy.voluntaryM ?? 0) && prior) copy.voluntaryM = prior.voluntaryM;
    return copy;
  };
  const touchActor = (actor: CombatArenaActor): void => {
    actor.facingSector = arenaFacingIndex(actor.facing, actor.facingSector);
    actor.travelledM ??= 0;
    if ((actor.voluntaryM ?? 0) > 0) actor.lastMovedAtUs = atUs;
  };
  touchActor(arena.player);
  const mobs: Record<string, CombatArenaActor> = {};
  for (const id in arena.mobs) {
    if (!Object.hasOwn(arena.mobs, id)) continue;
    const actor = arena.mobs[id];
    touchActor(actor);
    mobs[id] = keepVoluntary(actorCopy(actor), previousFrame?.mobs[id]);
  }
  const curses: Record<string, Record<string, number>> = {};
  const curseStore = state.curses ?? {};
  for (const id in curseStore) {
    if (!Object.hasOwn(curseStore, id)) continue;
    const lines = curseStore[id];
    const values: Record<string, number> = {};
    for (const stat in lines) {
      if (!Object.hasOwn(lines, stat)) continue;
      values[stat] = lines[stat].value;
    }
    curses[id] = values;
  }
  const frame: CombatArenaFrame = {
    atUs, player: keepVoluntary(actorCopy(arena.player), previousFrame?.player),
    mobs,
    bodies: arena.bodies.map((body) => ({ ...body, mob: { ...body.mob } })),
    ...(arena.intent ? { intent: { ...arena.intent, targetPoint: { ...arena.intent.targetPoint } } } : {}),
    buffs: { ...(state.skills?.buffUp ?? {}) },
    curses,
    ...(arena.focusId ? { focusId: arena.focusId } : {}),
  };
  if (arena.frames.at(-1)?.atUs === atUs) arena.frames[arena.frames.length - 1] = frame;
  else arena.frames.push(frame);
  // The captured frame owns this step's voluntary distance; a later capture at another event
  // must not count the same metres again.
  arena.player.voluntaryM = 0;
  for (const id in arena.mobs) {
    if (Object.hasOwn(arena.mobs, id)) arena.mobs[id].voluntaryM = 0;
  }
}

/** Arrival easing and turn-rate facts: bodies slow inside the last half meter and
 *  never snap their facing, so motion reads as weight rather than teleporting. */
const ARRIVE_SLOW_M = 0.5;
/** A goal that moved further than this invalidates the planned route. */
const ROUTE_GOAL_EPS = 0.6;
/** A path look-ahead: steering aims at the corridor, not at the next point's centre. */
const ROUTE_LOOKAHEAD_M = 0.7;
/** A target that drifts this far on the replan beat gets a fresh route. */
const ROUTE_REPLAN_EPS = 0.2;
const ROUTE_REPLAN_US = 250_000;
/** An unchanged failed goal after this many plans stops the body; a moved goal starts again. */
const ROUTE_HOLD_FAILS = 3;
const ROUTE_HOLD_GOAL_M = 1;
const ARRIVE_MIN_FACTOR = 0.35;
const TURN_RATE_RAD_S = 9;

/**
 * A body whose route to an unchanged goal kept failing holds its ground. The scheduler reads this
 * before ordering another walk, so an unreachable strike cannot retry forever; a goal that moves at
 * least a metre is a fresh question.
 */
export function arenaRouteHeld(actor: CombatArenaActor, target?: NavPoint): boolean {
  if ((actor.routeFailCount ?? 0) < ROUTE_HOLD_FAILS || !actor.routeHoldGoal) return false;
  return !target || arenaDistance(actor.routeHoldGoal, target) < ROUTE_HOLD_GOAL_M;
}

function turnToward(actor: CombatArenaActor, tx: number, ty: number, seconds: number): void {
  const want = Math.atan2(ty - actor.y, tx - actor.x);
  let delta = want - actor.facing;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const cap = TURN_RATE_RAD_S * Math.max(0, seconds);
  actor.facing += Math.max(-cap, Math.min(cap, delta));
}

/**
 * The next point to steer at: the goal itself, or the corridor of a route around ground.
 *
 * A route is cached per goal and re-planned when the goal moves materially or when a moving target
 * has drifted for one replan beat. The returned point is a look-ahead along the polyline, and a
 * reachable later waypoint replaces the next one only after a swept-clear check — smoothing never
 * cuts a corner through static ground. A blocked next point forces a fresh plan on the next sample.
 */
export function nextRoutePoint(
  actor: CombatArenaActor, target: { x: number; y: number }, nav: NavLayout, radius: number,
  atUs = 0,
): NavPoint {
  const goalMoved = !actor.pathGoal || arenaDistance(actor.pathGoal, target) > ROUTE_GOAL_EPS;
  // A failed plan retries on the same beat even for a static goal, so a blocked body gathers its
  // three failures in bounded time instead of waiting for the target to drift.
  const replanBeat = !!actor.pathGoal && (atUs - (actor.pathPlannedAtUs ?? atUs)) >= ROUTE_REPLAN_US
    && (arenaDistance(actor.pathGoal, target) > ROUTE_REPLAN_EPS || !!actor.routeFailed);
  if (goalMoved || replanBeat) {
    const found = route(nav, { x: actor.x, y: actor.y }, [{ id: 'goal', x: target.x, y: target.y }], radius);
    actor.path = found.ok ? found.waypoints.map((point) => ({ ...point })) : [];
    actor.pathGoal = { x: target.x, y: target.y };
    actor.pathPlannedAtUs = atUs;
    actor.routeFailed = !found.ok;
    // A moved goal is a fresh question, so its first failure counts as one; an unchanged goal adds up.
    actor.routeFailCount = found.ok ? 0 : goalMoved ? 1 : (actor.routeFailCount ?? 0) + 1;
    actor.routeHoldGoal = found.ok ? undefined : { x: target.x, y: target.y };
  }
  if (!actor.path?.length) return target;
  while (actor.path.length && arenaDistance(actor, actor.path[0]) <= radius + 0.05) actor.path.shift();
  // A swept-clear later waypoint is a legal shortcut: the body heads for it instead of the near
  // corner. When no later point is clear the route stays exactly as authored.
  while (actor.path.length >= 2 && !sweepDisc(nav, actor, actor.path[1], radius)) actor.path.shift();
  if (!actor.path.length) return target;
  const next = actor.path[0];
  // A body standing where the route wants to go forces a fresh plan on the next sample.
  if (sweepDisc(nav, actor, next, radius)) { actor.pathGoal = undefined; return target; }
  if (actor.path.length === 1) return next;
  // Look ahead along the next leg, but only when the blended point is itself swept-clear.
  const leg = arenaDistance(actor, next);
  if (leg >= ROUTE_LOOKAHEAD_M) {
    const fraction = ROUTE_LOOKAHEAD_M / leg;
    return { x: actor.x + (next.x - actor.x) * fraction, y: actor.y + (next.y - actor.y) * fraction };
  }
  const after = actor.path[1];
  const leg2 = arenaDistance(next, after);
  if (!(leg2 > 1e-9)) return after;
  const fraction = Math.min(1, (ROUTE_LOOKAHEAD_M - leg) / leg2);
  const look = { x: next.x + (after.x - next.x) * fraction, y: next.y + (after.y - next.y) * fraction };
  return sweepDisc(nav, actor, look, radius) ? next : look;
}

function approach(
  actor: CombatArenaActor, target: { x: number; y: number }, range: number, distance: number, seconds: number,
  nav?: NavLayout, atUs = 0,
): number {
  const radius = actor.radiusM ?? bodyRadiusM();
  const gapToTarget = arenaDistance(actor, target);
  const remaining = Math.max(0, gapToTarget - range);
  if (remaining <= 0) { actor.routeFailCount = 0; actor.routeHoldGoal = undefined; }
  let steer: NavPoint = target;
  if (nav && remaining > 0) {
    // A body whose route to the same goal keeps failing holds this ground before replanning, so an
    // unreachable target does not keep paying for routes that cannot change. It keeps its target
    // and its attack plan; a goal that moves at least 1 m makes the route a fresh question.
    if (actor.id !== 'player' && arenaRouteHeld(actor, target)) {
      turnToward(actor, target.x, target.y, seconds);
      return 0;
    }
    if (sweepDisc(nav, actor, target, radius)) steer = nextRoutePoint(actor, target, nav, radius, atUs);
    else if (actor.path) { actor.path = undefined; actor.pathGoal = undefined; }
  }
  const gap = arenaDistance(actor, steer);
  const legRemaining = Math.max(0, gap - (steer === target ? range : 0));
  turnToward(actor, steer.x, steer.y, seconds);
  const ease = steer === target && remaining <= ARRIVE_SLOW_M
    ? ARRIVE_MIN_FACTOR + (1 - ARRIVE_MIN_FACTOR) * (remaining / ARRIVE_SLOW_M)
    : 1;
  const move = Math.min(distance * ease, legRemaining);
  const from = { x: actor.x, y: actor.y };
  let to = { x: actor.x, y: actor.y };
  if (move > 0 && gap > 0) {
    to = { x: from.x + (steer.x - from.x) / gap * move, y: from.y + (steer.y - from.y) / gap * move };
  }
  if (nav) {
    // The step is swept, not sampled: a fast body cannot land past a thin wall.
    const contact = sweepDisc(nav, from, to, actor.radiusM ?? bodyRadiusM());
    if (contact) {
      const keep = Math.max(0, contact.fraction - 1e-6);
      to = { x: from.x + (to.x - from.x) * keep, y: from.y + (to.y - from.y) * keep };
    }
  }
  const travelled = arenaDistance(from, to);
  actor.moving = travelled > 1e-7;
  actor.voluntaryM = (actor.voluntaryM ?? 0) + travelled;
  actor.travelledM = (actor.travelledM ?? 0) + travelled;
  actor.x = to.x;
  actor.y = to.y;
  return travelled;
}

/** After separation and contact correction, no body may finish a sample inside static ground. */
function settleStaticClearance(
  arena: CombatArena, state: GameState, before: Map<string, NavPoint>,
): void {
  const nav = arena.nav;
  if (!nav) return;
  const settle = (body: CombatArenaActor, id: string): void => {
    const radius = body.radiusM ?? bodyRadiusM();
    if (isClear(nav, body, radius)) return;
    const legal = before.get(id);
    if (!legal || !isClear(nav, legal, radius)) return;
    // Slide back only to the wall face on the last legal side of the step; a snap to the whole
    // previous pose would discard progress the body legitimately made along the wall.
    const contact = sweepDisc(nav, legal, body, radius);
    const keep = contact ? Math.max(0, contact.fraction - 1e-6) : 0;
    const x = legal.x + (body.x - legal.x) * keep;
    const y = legal.y + (body.y - legal.y) * keep;
    if (isClear(nav, { x, y }, radius)) { body.x = x; body.y = y; }
    else { body.x = legal.x; body.y = legal.y; }
  };
  settle(arena.player, 'player');
  for (const mob of state.group) {
    const actor = arena.mobs[mob.id];
    if (actor && mob.hp > 0) settle(actor, mob.id);
  }
}

/**
 * Bodies occupy ground: after movement, overlapping edges are pushed apart until clear.
 * Mob pairs split the correction; the player is immovable, so a mob clears the player fully.
 * Sorted ids and fixed passes keep the result deterministic — no RNG is consumed.
 * A pass that moves nothing is a fixed point, so later passes are skipped.
 * Queued (non-engaged) bodies hold their ground but still refuse overlap.
 */
function separateBodies(arena: CombatArena, state: GameState): void {
  const ids = state.group
    .filter((mob) => mob.hp > 0 && arena.mobs[mob.id])
    .map((mob) => mob.id)
    .sort();
  // With authored ground, a correction is a swept step: a push that would finish inside static
  // ground stops at the wall face instead of snapping the body back to its pre-sample pose.
  const nav = arena.nav;
  const stepTo = (actor: CombatArenaActor, x: number, y: number): boolean => {
    if (nav) {
      const radius = actor.radiusM ?? 0.25;
      const contact = sweepDisc(nav, actor, { x, y }, radius);
      if (contact) {
        const keep = Math.max(0, contact.fraction - 1e-6);
        x = actor.x + (x - actor.x) * keep;
        y = actor.y + (y - actor.y) * keep;
      }
      if (!isClear(nav, { x, y }, radius)) return false;
    }
    if (x === actor.x && y === actor.y) return false;
    actor.x = x; actor.y = y;
    return true;
  };
  const clampBody = (actor: CombatArenaActor): void => {
    const radius = actor.radiusM ?? 0.25;
    const x = Math.max(radius, Math.min(arena.bounds.width - radius, actor.x));
    const y = Math.max(radius, Math.min(arena.bounds.height - radius, actor.y));
    if (x !== actor.x || y !== actor.y) { actor.x = x; actor.y = y; changed = true; }
  };
  let changed = false;
  const push = (a: CombatArenaActor, b: CombatArenaActor, need: number, aShare: number): void => {
    const dx = a.x - b.x, dy = a.y - b.y;
    const dist = Math.hypot(dx, dy);
    const overlap = need - dist;
    if (!(overlap > 0)) return;
    const ux = dist > 1e-9 ? dx / dist : -1;
    const uy = dist > 1e-9 ? dy / dist : 0;
    const movedA = stepTo(a, a.x + ux * overlap * aShare, a.y + uy * overlap * aShare);
    const movedB = stepTo(b, b.x - ux * overlap * (1 - aShare), b.y - uy * overlap * (1 - aShare));
    if (movedA || movedB) changed = true;
  };
  for (let pass = 0; pass < 8; pass++) {
    changed = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = arena.mobs[ids[i]], b = arena.mobs[ids[j]];
        push(a, b, (a.radiusM ?? 0.25) + (b.radiusM ?? 0.25) + ATTACK_CLEARANCE_M, 0.5);
      }
      const actor = arena.mobs[ids[i]];
      push(actor, arena.player,
        (actor.radiusM ?? 0.25) + (arena.player.radiusM ?? 0.25) + ATTACK_CLEARANCE_M, 1);
    }
    clampBody(arena.player);
    for (const id of ids) clampBody(arena.mobs[id]);
    if (!changed) break;
  }
}

/**
 * The nearest engaged neighbour standing in the straight lane to the target. This is the body a
 * melee mover steps around for one sample; it owns no ground and reserves no bearing.
 */
function blockingNeighbour(
  actor: CombatArenaActor, target: { x: number; y: number }, engaged: readonly Mob[],
  poses: Record<string, CombatArenaActor>,
): CombatArenaActor | undefined {
  const span = arenaDistance(actor, target);
  if (!(span > 1e-9)) return undefined;
  const ux = (target.x - actor.x) / span;
  const uy = (target.y - actor.y) / span;
  const actorRadius = actor.radiusM ?? bodyRadiusM();
  let best: CombatArenaActor | undefined;
  let bestAlong = Infinity;
  for (const mob of engaged) {
    if (mob.id === actor.id) continue;
    const other = poses[mob.id];
    if (!other || mob.hp <= 0) continue;
    const dx = other.x - actor.x;
    const dy = other.y - actor.y;
    const along = dx * ux + dy * uy;
    if (along <= 0 || along >= span) continue;
    const lateral = Math.abs(dx * uy - dy * ux);
    const need = actorRadius + (other.radiusM ?? 0.25) + ATTACK_CLEARANCE_M;
    if (lateral >= need) continue;
    if (along < bestAlong) { bestAlong = along; best = other; }
  }
  return best;
}

/** Retained action history does not own the feet after the authored recovery has ended. */
export function actionFeetUntil(action: CombatArenaAction | undefined): number {
  if (!action || action.nonblocking) return -Infinity;
  const timing = action.primaryTiming ?? action.timing;
  const end = timing ? Math.max(timing.releaseAtUs, timing.recoveryUntilUs) : action.endsAtUs;
  return Math.min(end, action.cancelledAtUs ?? Infinity);
}

/** Advance to a combat event or fixed movement sample; callers provide existing status-clock cuts. */
export function advanceCombatArena(
  arena: CombatArena, state: GameState, atUs: number,
  options: { playerRange: number; playerSpeedMult: number; mobSpeedMult: (mob: Mob) => number;
    playerTargetId?: string; playerLocked?: boolean; playerMoveTo?: { x: number; y: number };
    engagedIds?: ReadonlySet<string>; homeBandM?: number; returnSpeedMult?: number;
    /** Authored idle decision beat and the share of beats that wait instead of moving. */
    idleDecisionSec?: number; idleWaitPct?: number },
): void {
  const fromUs = arena.nowUs;
  const seconds = Math.max(0, atUs - fromUs) / arena.unitsPerSec;
  arena.nowUs = atUs;
  if (seconds === 0) { captureCombatArena(arena, state, atUs); return; }
  const before = arena.nav ? new Map<string, NavPoint>() : null;
  if (before) {
    before.set('player', { x: arena.player.x, y: arena.player.y });
    for (const mob of state.group) {
      const actor = arena.mobs[mob.id];
      if (actor) before.set(mob.id, { x: actor.x, y: actor.y });
    }
  }
  arena.player.moving = false;
  arena.player.voluntaryM = 0;
  for (const actor of Object.values(arena.mobs)) { actor.moving = false; actor.voluntaryM = 0; }
  const target = options.playerTargetId
    ? state.group.find((mob) => mob.id === options.playerTargetId && mob.hp > 0)
    : arenaTarget(arena, state.group);
  arena.player.moving = false;
  if (options.playerMoveTo && state.player.hp > 0) {
    approach(arena.player, options.playerMoveTo, 0,
      CFG.player_speed * options.playerSpeedMult * seconds, seconds, arena.nav, atUs);
  } else if (target && state.player.hp > 0 && !options.playerLocked) {
    // `playerRange` is the profile's already-inset stop distance, never its far edge.
    approach(arena.player, arena.mobs[target.id], Math.max(0, options.playerRange),
      CFG.player_speed * options.playerSpeedMult * seconds, seconds, arena.nav, atUs);
  }
  const engaging = state.group.filter((mob) => mob.hp > 0
    && (!options.engagedIds || options.engagedIds.has(mob.id)));
  const engaged = new Set(engaging.map((mob) => mob.id));
  const playerRadius = arena.player.radiusM ?? bodyRadiusM();
  const unitsPerSec = arena.unitsPerSec;
  for (const mob of state.group) {
    const actor = arena.mobs[mob.id];
    if (!actor) continue;
    if (engaged.has(mob.id) && mob.hp > 0 && state.player.hp > 0) {
      const lockedUntilUs = actionFeetUntil(actor.action);
      const freeSeconds = Math.max(0, atUs - Math.max(fromUs, lockedUntilUs)) / arena.unitsPerSec;
      const distance = CFG.mob_speed * options.mobSpeedMult(mob) * freeSeconds;
      const radius = actor.radiusM ?? bodyRadiusM(mob);
      const geometry = attackGeometryFor(mobAttackProfile(mob), radius, playerRadius,
        arenaDistance(actor, arena.player));
      if (!geometry.inRange) actor.holdAtRange = false;
      // A scheduled ready strike owns the approach range until it releases; without authored
      // geometry no such order exists, so the radius-only stop stays exactly as it was.
      const strikeRange = arena.nav ? actor.strikeRangeM : undefined;
      if (mob.line !== 'stand-off') {
        // One movement rule for a melee body: walk to its own attack stop distance. Body clearance
        // and static collision answer the crowd; there is no reserved bearing to wait for. A
        // neighbour standing in the straight lane is answered by a local sidestep this sample,
        // not by a formation slot.
        if (freeSeconds > 0) {
          const blocker = blockingNeighbour(actor, arena.player, engaging, arena.mobs);
          if (blocker) {
            const ux = (arena.player.x - actor.x) / Math.max(1e-9, arenaDistance(actor, arena.player));
            const uy = (arena.player.y - actor.y) / Math.max(1e-9, arenaDistance(actor, arena.player));
            const side = actor.id < blocker.id ? 1 : -1;
            const reach = (actor.radiusM ?? bodyRadiusM(mob)) + (blocker.radiusM ?? 0.25) + ATTACK_CLEARANCE_M + 0.15;
            approach(actor, {
              x: arena.player.x - uy * reach * side,
              y: arena.player.y + ux * reach * side,
            }, 0, distance, freeSeconds, arena.nav, atUs);
          } else {
            approach(actor, arena.player, strikeRange ?? geometry.stopCenterDistance,
              distance, freeSeconds, arena.nav, atUs);
          }
        }
        continue;
      }
      // A stand-off body that can already fire holds while its shot/recovery is active and after
      // its first valid opportunity; it walks to the profile's stop distance only before that.
      if (strikeRange != null) {
        if (freeSeconds > 0)
          approach(actor, arena.player, strikeRange, distance, freeSeconds, arena.nav, atUs);
        continue;
      }
      const holding = geometry.inRange && (actor.holdAtRange || lockedUntilUs > atUs);
      if (holding) {
        const released = actor.action?.timing != null && atUs >= actor.action.timing.releaseAtUs;
        if (!released) turnToward(actor, arena.player.x, arena.player.y, seconds);
      } else if (freeSeconds > 0) {
        approach(actor, arena.player, geometry.stopCenterDistance, distance, freeSeconds, arena.nav, atUs);
      }
    } else if (mob.hp > 0 && options.engagedIds) {
      // An unengaged body returns to its authored home, then idles from a seeded decision at an
      // authored beat: choose one reachable spot or wait. Nothing follows a time-based orbit.
      const slot = state.field?.slots.find((entry) => entry.id === mob.spawnSlotId);
      if (!slot) continue;
      const speed = CFG.mob_speed * options.mobSpeedMult(mob) * seconds;
      const gap = arenaDistance(actor, slot.home);
      const band = Math.max(0, options.homeBandM ?? 0.35);
      const returnMult = Math.max(0, Math.min(1, options.returnSpeedMult ?? 0.65));
      if (gap > slot.roamM) {
        actor.idleBeat = undefined;
        actor.idleGoal = undefined;
        approach(actor, slot.home, band, speed * returnMult, seconds, arena.nav, atUs);
        continue;
      }
      const beatSec = Math.max(0.25, options.idleDecisionSec ?? 5);
      const beat = Math.floor(atUs / (arena.unitsPerSec * beatSec));
      if (actor.idleBeat !== beat) {
        actor.idleBeat = beat;
        const roll = mulberry32(spawnSlotSeed(state.seed ?? 0, state.field?.areaKey ?? '', slot.id, beat));
        const waiting = roll() < Math.max(0, Math.min(1, options.idleWaitPct ?? 0.35));
        const angle = roll() * Math.PI * 2;
        const reach = roll() * slot.roamM;
        actor.idleGoal = waiting ? undefined : {
          x: Math.max(actor.radiusM ?? 0.25, Math.min(arena.bounds.width - (actor.radiusM ?? 0.25),
            slot.home.x + Math.cos(angle) * reach)),
          y: Math.max(actor.radiusM ?? 0.25, Math.min(arena.bounds.height - (actor.radiusM ?? 0.25),
            slot.home.y + Math.sin(angle) * reach)),
        };
      }
      if (actor.idleGoal) {
        if (arenaDistance(actor, actor.idleGoal) <= 0.1) actor.idleGoal = undefined;
        else approach(actor, actor.idleGoal, 0.1, speed * 0.35, seconds, arena.nav, atUs);
      }
    }
  }
  separateBodies(arena, state);
  if (before) settleStaticClearance(arena, state, before);
  captureCombatArena(arena, state, atUs);
}

export function arenaAction(
  arena: CombatArena, actorId: string, kind: CombatArenaAction['kind'], atUs: number, targetId?: string, skillId?: string,
  area?: SkillAreaSnapshot,
  timing?: SkillCastTiming,
): CombatArenaAction | undefined {
  const actor = actorId === 'player' ? arena.player : arena.mobs[actorId];
  if (!actor) return;
  const target = targetId === 'player' ? arena.player : targetId ? arena.mobs[targetId] : undefined;
  const action: CombatArenaAction = {
    id: ++arena.actionSeq, actorId, targetId, kind, atUs,
    endsAtUs: atUs + CFG.action_sec * arena.unitsPerSec,
    x: actor.x, y: actor.y, targetX: target?.x, targetY: target?.y, skillId,
    ...(area ? { area: { ...area, center: { ...area.center } } } : {}),
    ...(timing ? { timing: { ...timing }, primaryTiming: { ...timing }, endsAtUs: Math.max(timing.impactAtUs, timing.recoveryUntilUs)
      + CFG.action_sec * arena.unitsPerSec } : {}),
  };
  if (area?.origin === 'target') {
    action.targetX = area.center.x;
    action.targetY = area.center.y;
  }
  arena.actions.push(action);
  actor.action = action;
  actor.moving = false;
  return action;
}

/** Replace the live record so already captured frames retain their earlier action facts. */
export function updateArenaAction(arena: CombatArena, id: number, patch: Partial<CombatArenaAction>): void {
  const previous = arena.actions.find((action) => action.id === id);
  if (!previous) return;
  const updated = { ...previous, ...patch };
  arena.actions = arena.actions.map((action) => action.id === id ? updated : action);
  if (arena.player.action?.id === id) arena.player.action = updated;
  for (const actor of Object.values(arena.mobs)) if (actor.action?.id === id) actor.action = updated;
}

/** Presentation hooks observe canonical outcomes; they never deal damage or grant rewards. */
export function recordCombatArenaFx(arena: CombatArena, state: GameState, event: FxEvent, source?: Mob): void {
  const atUs = event.atUs ?? arena.nowUs;
  if (event.kind === 'cast') {
    const area = event.skillOutcome?.area;
    const actorId = event.side === 'self' ? 'player' : event.mobId;
    const struck = actorId === 'player' ? state.fx.find((fx) => fx.kind === 'hit'
      && fx.via === 'cast' && fx.skillId === event.skillId && fx.atUs === atUs)?.mobId : undefined;
    if (actorId && event.actionId == null) arenaAction(arena, actorId, 'cast', atUs,
      actorId === 'player' ? area?.targetId ?? struck ?? arenaTarget(arena, state.group)?.id : 'player', event.skillId, area);
  }
  if (event.kind === 'kill' && event.mobId) {
    const actor = arena.mobs[event.mobId]
      ?? [...arena.frames].reverse().find((frame) => frame.mobs[event.mobId!])?.mobs[event.mobId];
    if (actor && source && !arena.bodies.some((body) => body.id === event.mobId)) {
      arenaAction(arena, actor.id, 'death', atUs);
      arena.bodies.push({ ...actor, hp: 0, moving: false, mob: actor.mob ?? mobCopy(source), diedAtUs: atUs });
    }
  }
  captureCombatArena(arena, state, atUs);
}

/** Interpolate feet and facing only. HP, action and death are discrete facts at the preceding combat sample. */
export function sampleCombatArena(arena: CombatArena, atUs: number): CombatArenaFrame {
  const frames = arena.frames;
  if (!frames.length) return { atUs, player: actorCopy(arena.player), mobs: { ...arena.mobs }, bodies: [...arena.bodies] };
  let before = frames[0];
  let after = before;
  for (const frame of frames) {
    if (frame.atUs > atUs) { after = frame; break; }
    before = after = frame;
  }
  const t = after.atUs > before.atUs ? Math.max(0, Math.min(1, (atUs - before.atUs) / (after.atUs - before.atUs))) : 0;
  const pose = (a: CombatArenaActor, b?: CombatArenaActor): CombatArenaActor => {
    if (!b) return { ...a };
    let turn = b.facing - a.facing;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    return {
      ...a,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      facing: a.facing + turn * t,
      moving: a.moving || b.moving,
    };
  };
  return {
    atUs, player: pose(before.player, after.player),
    mobs: Object.fromEntries(Object.entries(before.mobs).map(([id, actor]) => [id, pose(actor, after.mobs[id])])),
    bodies: before.bodies,
    ...(before.intent ? { intent: before.intent } : {}),
    ...(before.buffs ? { buffs: before.buffs } : {}),
    ...(before.curses ? { curses: before.curses } : {}),
    ...(before.focusId ? { focusId: before.focusId } : {}),
  };
}
