import { E, sm } from '../../engine/client';
import { arenaFacingIndex } from '../../presentation/arena-camera';
import { targetsInSkillArea } from '../../../../engine/skill-actions.ts';
import { skillAreaSnapshot } from '../../../../engine/skill-area.ts';
import type { SkillAreaSnapshot, SkillCastTiming } from '../../../../engine/types.ts';
import type { CombatIntent, CombatFlight } from './combat-actions';
import type { FxEvent, GameState, Mob } from '../core/types';

const CFG = E.combat_arena;
const mobCopy = (mob: Mob): Mob => ({
  ...mob, skillReadyAtUs: mob.skillReadyAtUs ? { ...mob.skillReadyAtUs } : undefined,
});
const statusCopy = (statuses: Record<string, { stacks: number; secLeft: number } | undefined> = {}) =>
  Object.fromEntries(Object.entries(statuses).flatMap(([id, status]) => status
    ? [[id, { stacks: status.stacks, secLeft: status.secLeft }]] : []));

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
  /** Encounter identity at release; leaving it cancels the shot with a receipt. */
  areaKey?: string;
  queued?: boolean;
}

/** Ground footprint radius in meters: the sim reads body classes, never pixels. */
export function bodyRadiusM(mob?: Mob): number {
  if (!mob) return CFG.player_radius_m ?? 0.25;
  const entry = (E.mob.sizes as { id: string; radius_m?: number }[] | undefined)
    ?.find((size) => size.id === (mob.readsAs || 'medium'));
  return entry?.radius_m ?? 0.25;
}

/** A claimed contact point: the right to approach a body, never the right to attack it. */
export interface CombatContactClaim {
  x: number;
  y: number;
  targetId: string;
  atUs: number;
  /** Player centre when the claim was made; the ring follows the player by this delta. */
  playerX: number;
  playerY: number;
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
  /** The player's deliberate target pin; cleared/ignored when the body is gone. */
  focusId?: string;
  /** The player's local farming anchor, in field meters. */
  anchor?: { x: number; y: number };
  /** Planned melee contact points, keyed by actor id; revalidated every movement sample. */
  contacts: Record<string, CombatContactClaim>;
}

export function createCombatArena(): CombatArena {
  return {
    bounds: { width: CFG.width, height: CFG.height },
    nowUs: 0, atUs: 0, unitsPerSec: 1_000_000,
    player: { id: 'player', ...CFG.player_start, facing: 0, moving: false, radiusM: bodyRadiusM(), hp: 0, hpMax: 0 },
    mobs: {}, bodies: [], actions: [], frames: [], actionSeq: 0, flights: [], mobFlights: [], contacts: {},
  };
}

export const arenaDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(b.x - a.x, b.y - a.y);

export function arenaWeaponRange(weaponName: string): number {
  const group = sm.weaponGroupOf(weaponName) as keyof typeof CFG.range;
  return CFG.range[group] ?? CFG.range.melee;
}

export function arenaSkillRange(skillId: string): number {
  const skill = sm.byId[skillId];
  if (!skill || skill.type === 'buff' || skill.type === 'heal') return Infinity;
  return sm.castProfileOf(skill).range_m;
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
  if (!skill || radius <= 0) {
    const t = nearest();
    if (!t) return undefined;
    // a single press casts only while its primary is already in cast range
    if (requireRange && arenaDistance(arena.player, t.point) > arenaSkillRange(skillId) + 1e-7)
      return undefined;
    return t;
  }
  if (skill.area!.origin === 'caster') {
    const inside = group.some((mob) => mob.hp > 0 && arena.mobs[mob.id]
      && arenaDistance(arena.player, arena.mobs[mob.id]) <= radius + 1e-7);
    if (!inside && requireRange) return undefined;
    const t = arenaTarget(arena, group);
    if (!t) return undefined;
    const pose = arena.mobs[t.id];
    // A cone/line needs a real direction; a circle keeps its caster-centred aim contract.
    const oriented = skill.area!.shape === 'cone' || skill.area!.shape === 'line';
    return { mob: t, point: oriented && pose
      ? { x: pose.x, y: pose.y } : { x: arena.player.x, y: arena.player.y } };
  }
  const range = arenaSkillRange(skillId);
  let best: { mob: Mob; point: { x: number; y: number }; count: number; dist: number } | undefined;
  for (const mob of group) {
    const pose = arena.mobs[mob.id];
    if (mob.hp <= 0 || !pose) continue;
    const dist = arenaDistance(arena.player, pose);
    if (dist > range + 1e-7) continue;
    let n = 0;
    for (const other of group) {
      const p2 = arena.mobs[other.id];
      if (other.hp <= 0 || !p2) continue;
      if (arenaDistance(pose, p2) <= radius + 1e-7) n++;
    }
    if (!best || n > best.count || (n === best.count && dist < best.dist - 1e-7))
      best = { mob, point: { x: pose.x, y: pose.y }, count: n, dist };
  }
  if (best) return { mob: best.mob, point: best.point };
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

export function arenaMobRange(mob: Mob): number {
  return mob.line === 'stand-off' ? CFG.range.ranged : CFG.range.melee;
}

/** Ordinary stand-off bodies hold short of their maximum reach instead of touching the range edge. */
export function arenaMobStopRange(mob: Mob): number {
  if (mob.line !== 'stand-off') return arenaMobRange(mob);
  const pct = Number(E.combat_arena.normal_attack.profiles.ranged.stop_at_range_pct) / 100;
  return arenaMobRange(mob) * (Number.isFinite(pct) ? pct : 1);
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
    const distance = arenaDistance(arena.player, pose);
    if (distance < nearest) { nearest = distance; target = mob; }
  }
  return target;
}

/** Reconcile spawns without consuming combat RNG or moving existing bodies. */
export function syncCombatArena(arena: CombatArena, state: GameState, atUs: number, unitsPerSec: number, maxHp: number): void {
  if (atUs > arena.nowUs + CFG.movement_step_sec * unitsPerSec || state.player.hp <= 0) {
    const cancelled = new Set<number>();
    if (arena.intent?.actionId != null) cancelled.add(arena.intent.actionId);
    for (const flight of arena.flights) cancelled.add(flight.actionId);
    if (arena.player.action) cancelled.add(arena.player.action.id);
    for (const shot of arena.mobFlights) cancelled.add(shot.actionId);
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
    arena.contacts = {};
    arena.player.action = undefined;
  }
  arena.unitsPerSec = unitsPerSec;
  arena.nowUs = atUs;
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
  }
  captureCombatArena(arena, state, atUs);
}

const actorCopy = (actor: CombatArenaActor): CombatArenaActor => ({
  ...actor, mob: actor.mob ? mobCopy(actor.mob) : undefined, statuses: statusCopy(actor.statuses),
});

/** Capture after impacts too, so delayed playback shows the pool loss on the correct beat. */
export function captureCombatArena(arena: CombatArena, state: GameState, atUs: number): void {
  arena.atUs = atUs;
  arena.player.hp = state.player.hp;
  arena.player.es = state.player.es;
  arena.player.mana = state.player.mana;
  arena.player.statuses = statusCopy(state.playerStatuses);
  const live = new Set(state.group.map((mob) => mob.id));
  for (const id of Object.keys(arena.mobs)) if (!live.has(id)) delete arena.mobs[id];
  for (const mob of state.group) {
    const actor = arena.mobs[mob.id];
    if (actor) {
      actor.hp = mob.hp; actor.hpMax = mob.hpMax; actor.mob = mobCopy(mob);
      actor.statuses = statusCopy(state.mobStatus[mob.id]?.statuses);
    }
  }
  // A claim belongs only to a living body in this arena; a dead or departed actor drops it here.
  const groupHp = new Map(state.group.map((mob) => [mob.id, mob.hp]));
  for (const id of Object.keys(arena.contacts)) {
    if (!live.has(id)) delete arena.contacts[id];
    else if ((groupHp.get(id) ?? 1) <= 0) delete arena.contacts[id];
  }
  const oldest = atUs - CFG.history_sec * arena.unitsPerSec;
  arena.bodies = arena.bodies.filter((body) => atUs - body.diedAtUs <= CFG.body_sec * arena.unitsPerSec);
  arena.actions = arena.actions.filter((action) => action.endsAtUs >= oldest);
  arena.frames = arena.frames.filter((frame) => frame.atUs >= oldest);
  // A second capture at the same timestamp (an impact after the movement sample) must keep the
  // movement evidence the first frame carries; the live actors were already reset for the next step.
  const previousFrame = arena.frames.at(-1)?.atUs === atUs ? arena.frames.at(-1) : undefined;
  const keepVoluntary = (copy: CombatArenaActor, prior?: CombatArenaActor): CombatArenaActor => {
    if (!(copy.voluntaryM ?? 0) && prior) copy.voluntaryM = prior.voluntaryM;
    return copy;
  };
  for (const actor of [arena.player, ...Object.values(arena.mobs)]) {
    actor.facingSector = arenaFacingIndex(actor.facing, actor.facingSector);
    actor.travelledM ??= 0;
    if ((actor.voluntaryM ?? 0) > 0) actor.lastMovedAtUs = atUs;
  }
  const frame: CombatArenaFrame = {
    atUs, player: keepVoluntary(actorCopy(arena.player), previousFrame?.player),
    mobs: Object.fromEntries(Object.entries(arena.mobs).map(([id, actor]) =>
      [id, keepVoluntary(actorCopy(actor), previousFrame?.mobs[id])])),
    bodies: arena.bodies.map((body) => ({ ...body, mob: { ...body.mob } })),
    ...(arena.intent ? { intent: { ...arena.intent, targetPoint: { ...arena.intent.targetPoint } } } : {}),
  };
  if (arena.frames.at(-1)?.atUs === atUs) arena.frames[arena.frames.length - 1] = frame;
  else arena.frames.push(frame);
  // The captured frame owns this step's voluntary distance; a later capture at another event
  // must not count the same metres again.
  arena.player.voluntaryM = 0;
  for (const actor of Object.values(arena.mobs)) actor.voluntaryM = 0;
}

/** Arrival easing and turn-rate facts: bodies slow inside the last half meter and
 *  never snap their facing, so motion reads as weight rather than teleporting. */
const ARRIVE_SLOW_M = 0.5;
const ARRIVE_MIN_FACTOR = 0.35;
const TURN_RATE_RAD_S = 9;

function turnToward(actor: CombatArenaActor, tx: number, ty: number, seconds: number): void {
  const want = Math.atan2(ty - actor.y, tx - actor.x);
  let delta = want - actor.facing;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const cap = TURN_RATE_RAD_S * Math.max(0, seconds);
  actor.facing += Math.max(-cap, Math.min(cap, delta));
}

function approach(actor: CombatArenaActor, target: { x: number; y: number }, range: number, distance: number, seconds: number): number {
  const gap = arenaDistance(actor, target);
  const remaining = Math.max(0, gap - range);
  turnToward(actor, target.x, target.y, seconds);
  const ease = remaining > ARRIVE_SLOW_M ? 1
    : ARRIVE_MIN_FACTOR + (1 - ARRIVE_MIN_FACTOR) * (remaining / ARRIVE_SLOW_M);
  const move = Math.min(distance * ease, remaining);
  actor.moving = move > 1e-7;
  actor.voluntaryM = (actor.voluntaryM ?? 0) + Math.max(0, move);
  actor.travelledM = (actor.travelledM ?? 0) + Math.max(0, move);
  if (move > 0 && gap > 0) {
    actor.x += (target.x - actor.x) / gap * move;
    actor.y += (target.y - actor.y) / gap * move;
  }
  return Math.max(0, move);
}

const CONTACT_CLEARANCE_M = 0.02;
const PLAYER_STOP_INSET_M = 0.05;
/** Melee claims sit further inside reach so a neighbour's correction cannot push them out of range. */
const MOB_CONTACT_INSET_M = 0.1;

/**
 * Bodies occupy ground: after movement, overlapping edges are pushed apart until clear.
 * Mob pairs split the correction; the player is immovable, so a mob clears the player fully.
 * Sorted ids and fixed passes keep the result deterministic — no RNG is consumed.
 * Queued (non-engaged) bodies hold their ground but still refuse overlap.
 */
function separateBodies(arena: CombatArena, state: GameState): void {
  const ids = state.group
    .filter((mob) => mob.hp > 0 && arena.mobs[mob.id])
    .map((mob) => mob.id)
    .sort();
  const clampBody = (actor: CombatArenaActor): void => {
    const radius = actor.radiusM ?? 0.25;
    actor.x = Math.max(radius, Math.min(arena.bounds.width - radius, actor.x));
    actor.y = Math.max(radius, Math.min(arena.bounds.height - radius, actor.y));
  };
  const push = (a: CombatArenaActor, b: CombatArenaActor, need: number, aShare: number): void => {
    const dx = a.x - b.x, dy = a.y - b.y;
    const dist = Math.hypot(dx, dy);
    const overlap = need - dist;
    if (!(overlap > 0)) return;
    const ux = dist > 1e-9 ? dx / dist : -1;
    const uy = dist > 1e-9 ? dy / dist : 0;
    a.x += ux * overlap * aShare;
    a.y += uy * overlap * aShare;
    b.x -= ux * overlap * (1 - aShare);
    b.y -= uy * overlap * (1 - aShare);
  };
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = arena.mobs[ids[i]], b = arena.mobs[ids[j]];
        push(a, b, (a.radiusM ?? 0.25) + (b.radiusM ?? 0.25) + CONTACT_CLEARANCE_M, 0.5);
      }
      const actor = arena.mobs[ids[i]];
      push(actor, arena.player,
        (actor.radiusM ?? 0.25) + (arena.player.radiusM ?? 0.25) + CONTACT_CLEARANCE_M, 1);
    }
    clampBody(arena.player);
    for (const id of ids) clampBody(arena.mobs[id]);
  }
}

/** Bearings are chosen in tiers so a small pack fans out before it shares a close angle. */
const CONTACT_BEARING_TIERS_DEG: readonly (readonly number[])[] = [
  [0, 90, -90, 180],
  [45, -45, 135, -135],
  [22.5, -22.5, 67.5, -67.5, 112.5, -112.5, 157.5, -157.5],
];

/**
 * Claim a reachable, clear contact point per melee body. Retention comes first: a body that can
 * already strike keeps its ground, then its previous claim, and only then searches bearings in
 * tiers. Claims are approach rights, not attack rights; range and control are rechecked by the
 * caller. Stable order and deterministic ties keep a reload or twin run identical.
 */
function assignContactPoints(arena: CombatArena, state: GameState, melee: readonly Mob[]): void {
  const player = arena.player;
  if (state.player.hp <= 0) { arena.contacts = {}; return; }
  const living = state.group.filter((mob) => mob.hp > 0 && arena.mobs[mob.id]);
  const livingIds = new Set(living.map((mob) => mob.id));
  const meleeIds = new Set(melee.map((mob) => mob.id));
  for (const id of Object.keys(arena.contacts))
    if (!livingIds.has(id) || !meleeIds.has(id)) delete arena.contacts[id];
  // A claim is player-relative: when the player moves, the whole ring moves with them instead of
  // leaving stale slots behind or re-solving every body from scratch.
  for (const claim of Object.values(arena.contacts)) {
    claim.x += player.x - claim.playerX;
    claim.y += player.y - claim.playerY;
    claim.playerX = player.x;
    claim.playerY = player.y;
  }
  const playerRadius = player.radiusM ?? bodyRadiusM();
  const inBounds = (point: { x: number; y: number }, radius: number) =>
    point.x >= radius - 1e-9 && point.x <= arena.bounds.width - radius + 1e-9
    && point.y >= radius - 1e-9 && point.y <= arena.bounds.height - radius + 1e-9;
  const reserved: { id: string; x: number; y: number; r: number }[] = [];
  const clearOf = (point: { x: number; y: number }, radius: number, ignore: string) =>
    reserved.every((claim) => claim.id === ignore
      || arenaDistance(point, claim) >= radius + claim.r + CONTACT_CLEARANCE_M);
  /** Spacing tiers keep a small pack fanned out before tighter contact is allowed. */
  const spacedFrom = (point: { x: number; y: number }, radius: number, ignore: string, spacing: number) =>
    reserved.every((claim) => claim.id === ignore
      || (arenaDistance(point, claim) >= radius + claim.r + CONTACT_CLEARANCE_M
        && arenaDistance(point, claim) >= spacing - 1e-9));
  const order = [...melee].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const mob of order) {
    const actor = arena.mobs[mob.id];
    if (!actor) continue;
    const radius = actor.radiusM ?? bodyRadiusM(mob);
    const reach = arenaMobRange(mob);
    const stop = Math.max(playerRadius + radius + CONTACT_CLEARANCE_M, reach - MOB_CONTACT_INSET_M);
    const held = arena.contacts[mob.id];
    let point: { x: number; y: number } | undefined;
    const currentClear = living.every((other) => {
      if (other.id === mob.id) return true;
      const pose = arena.mobs[other.id];
      return !pose || arenaDistance(actor, pose) >= radius + (pose.radiusM ?? 0.25) + CONTACT_CLEARANCE_M;
    });
    // A real attack opportunity takes priority over completing a decorative formation.
    if (arenaDistance(actor, player) <= reach + 1e-7 && currentClear && inBounds(actor, radius)) {
      point = { x: actor.x, y: actor.y };
    } else if (held && held.targetId === 'player'
      && arenaDistance(held, player) <= reach + 1e-7
      && arenaDistance(held, player) >= playerRadius + radius + CONTACT_CLEARANCE_M
      && inBounds(held, radius)
      && clearOf(held, radius, mob.id)) {
      point = { x: held.x, y: held.y };
    }
    if (!point) {
      const anchor = Math.atan2(actor.y - player.y, actor.x - player.x);
      for (const spacing of [reach, 1.2, 0]) {
        for (const tier of CONTACT_BEARING_TIERS_DEG) {
          const options: { x: number; y: number; travel: number; tie: number }[] = [];
          for (const offsetDeg of tier) {
            const angle = anchor + offsetDeg * Math.PI / 180;
            const candidate = {
              x: Math.max(radius, Math.min(arena.bounds.width - radius, player.x + Math.cos(angle) * stop)),
              y: Math.max(radius, Math.min(arena.bounds.height - radius, player.y + Math.sin(angle) * stop)),
            };
            const gap = arenaDistance(candidate, player);
            if (gap > reach + 1e-7 || gap < playerRadius + radius + CONTACT_CLEARANCE_M - 1e-7) continue;
            if (!spacedFrom(candidate, radius, mob.id, spacing)) continue;
            options.push({ ...candidate, travel: arenaDistance(actor, candidate), tie: Math.abs(offsetDeg) });
          }
          if (!options.length) continue;
          options.sort((a, b) => a.travel - b.travel || a.tie - b.tie);
          point = { x: options[0].x, y: options[0].y };
          break;
        }
        if (point) break;
      }
    }
    if (!point) { delete arena.contacts[mob.id]; continue; }
    arena.contacts[mob.id] = {
      x: point.x, y: point.y, targetId: 'player', atUs: arena.nowUs,
      playerX: player.x, playerY: player.y,
    };
    reserved.push({ id: mob.id, x: point.x, y: point.y, r: radius });
  }
}

/** Advance to a combat event or fixed movement sample; callers provide existing status-clock cuts. */
export function advanceCombatArena(
  arena: CombatArena, state: GameState, atUs: number,
  options: { playerRange: number; playerSpeedMult: number; mobSpeedMult: (mob: Mob) => number;
    playerTargetId?: string; playerLocked?: boolean; playerMoveTo?: { x: number; y: number };
    engagedIds?: ReadonlySet<string> },
): void {
  const seconds = Math.max(0, atUs - arena.nowUs) / arena.unitsPerSec;
  arena.nowUs = atUs;
  if (seconds === 0) { captureCombatArena(arena, state, atUs); return; }
  arena.player.moving = false;
  arena.player.voluntaryM = 0;
  for (const actor of Object.values(arena.mobs)) { actor.moving = false; actor.voluntaryM = 0; }
  const target = options.playerTargetId
    ? state.group.find((mob) => mob.id === options.playerTargetId && mob.hp > 0)
    : arenaTarget(arena, state.group);
  arena.player.moving = false;
  if (options.playerMoveTo && state.player.hp > 0) {
    approach(arena.player, options.playerMoveTo, 0,
      CFG.player_speed * options.playerSpeedMult * seconds, seconds);
  } else if (target && state.player.hp > 0 && !options.playerLocked) {
    // Stop just inside the valid range so a moving body cannot shuffle in and out of reach.
    approach(arena.player, arena.mobs[target.id], Math.max(0, options.playerRange - PLAYER_STOP_INSET_M),
      CFG.player_speed * options.playerSpeedMult * seconds, seconds);
  }
  const engaging = state.group.filter((mob) => mob.hp > 0
    && (!options.engagedIds || options.engagedIds.has(mob.id)));
  const engaged = new Set(engaging.map((mob) => mob.id));
  const melee = engaging.filter((mob) => mob.line !== 'stand-off');
  const meleeIds = new Set(melee.map((mob) => mob.id));
  assignContactPoints(arena, state, melee);
  for (const mob of state.group) {
    const actor = arena.mobs[mob.id];
    if (!actor) continue;
    if (engaged.has(mob.id) && mob.hp > 0 && state.player.hp > 0) {
      const distance = CFG.mob_speed * options.mobSpeedMult(mob) * seconds;
      if (meleeIds.has(mob.id)) {
        // A committed strike or preparation owns the feet and the facing; only an idle melee body
        // walks and turns toward its claim.
        const busy = !!actor.action && actor.action.endsAtUs > atUs;
        const claim = arena.contacts[mob.id];
        if (!busy) {
          if (claim) approach(actor, claim, 0, distance, seconds);
          turnToward(actor, arena.player.x, arena.player.y, seconds);
        }
      } else {
        // A stand-off body that can already fire holds while its shot/recovery is active and after
        // its first valid opportunity; it walks to the preferred stop only before that.
        const inMaxRange = arenaDistance(actor, arena.player) <= arenaMobRange(mob) + 1e-7;
        if (!inMaxRange) actor.holdAtRange = false;
        const holding = inMaxRange && (actor.holdAtRange || (!!actor.action && actor.action.endsAtUs > atUs));
        if (holding) {
          const released = actor.action?.timing != null && atUs >= actor.action.timing.releaseAtUs;
          if (!released) turnToward(actor, arena.player.x, arena.player.y, seconds);
        } else approach(actor, arena.player, Math.max(0, arenaMobStopRange(mob) - PLAYER_STOP_INSET_M), distance, seconds);
      }
    } else if (mob.hp > 0 && options.engagedIds) {
      // An unengaged body returns to its authored home, then idles around it. The wander target is
      // a function of combat time and slot identity, so a seek draws the same step.
      const slot = state.field?.slots.find((entry) => entry.id === mob.spawnSlotId);
      if (!slot) continue;
      const speed = CFG.mob_speed * options.mobSpeedMult(mob) * seconds;
      const gap = arenaDistance(actor, slot.home);
      if (gap > 0.35) {
        approach(actor, slot.home, 0, speed * 0.65, seconds);
      } else {
        const phase = atUs / arena.unitsPerSec * 0.28 + (slot.home.x + slot.home.y) * 0.13;
        approach(actor, {
          x: slot.home.x + Math.cos(phase) * slot.roamM * 0.6,
          y: slot.home.y + Math.sin(phase) * slot.roamM * 0.6,
        }, 0, speed * 0.3, seconds);
      }
    }
  }
  separateBodies(arena, state);
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
      arena.bodies.push({ ...actor, hp: 0, moving: false, mob: mobCopy(source), diedAtUs: atUs });
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
  };
}
