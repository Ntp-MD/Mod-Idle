import { E, sm } from '../engine/client';
import { targetsInSkillArea } from '../../../engine/skill-actions.ts';
import { skillAreaSnapshot } from '../../../engine/skill-area.ts';
import type { SkillAreaSnapshot, SkillCastTiming } from '../../../engine/types.ts';
import type { CombatIntent, CombatFlight } from './combat-actions';
import type { FxEvent, GameState, Mob } from './types';

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
  hitIds?: string[];
  /** How many resolved impacts this action has produced (a field pulse counts once). */
  impactCount?: number;
  /** A released ordinary ranged shot; presentation may draw it differently from a melee swing. */
  ranged?: boolean;
  cancelledAtUs?: number;
  cancelReason?: string;
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
  if (!mob) return CFG.player_radius_m ?? 0.4;
  const entry = (E.mob.sizes as { id: string; radius_m?: number }[] | undefined)
    ?.find((size) => size.id === (mob.readsAs || 'medium'));
  return entry?.radius_m ?? 0.45;
}

export interface CombatArenaActor {
  id: string;
  x: number;
  y: number;
  /** Radians on the x/y ground plane. */
  facing: number;
  moving: boolean;
  /** Ground footprint radius in meters, from the body class (player: the arena constant). */
  radiusM: number;
  hp: number;
  hpMax: number;
  es?: number;
  mana?: number;
  /** Stable approach slot among the engaged melee bodies; no collision model is implied. */
  contactSlot?: number;
  /** Display-only status facts copied at this combat sample, without damage-clock internals. */
  statuses?: Record<string, { stacks: number; secLeft: number }>;
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
}

export function createCombatArena(): CombatArena {
  return {
    bounds: { width: CFG.width, height: CFG.height },
    nowUs: 0, atUs: 0, unitsPerSec: 1_000_000,
    player: { id: 'player', ...CFG.player_start, facing: 0, moving: false, radiusM: bodyRadiusM(), hp: 0, hpMax: 0 },
    mobs: {}, bodies: [], actions: [], frames: [], actionSeq: 0, flights: [], mobFlights: [],
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
    for (const id of cancelled) {
      const action = arena.actions.find((entry) => entry.id === id);
      if (action && action.cancelledAtUs == null)
        updateArenaAction(arena, id, { cancelledAtUs: atUs, cancelReason: 'resync', endsAtUs: atUs });
    }
    arena.intent = undefined;
    arena.flights = [];
    arena.mobFlights = [];
    arena.player.action = undefined;
  }
  arena.unitsPerSec = unitsPerSec;
  arena.nowUs = atUs;
  arena.player.hp = state.player.hp;
  arena.player.es = state.player.es;
  arena.player.mana = state.player.mana;
  arena.player.hpMax = maxHp;
  for (const [index, mob] of state.group.entries()) {
    const offset = Math.ceil(index / 2) * (index % 2 ? -1 : 1);
    arena.mobs[mob.id] ??= {
      id: mob.id,
      x: Math.min(arena.bounds.width - 1, CFG.mob_start.x + (index > 2 ? CFG.mob_start.spacing : 0)),
      y: Math.max(1, Math.min(arena.bounds.height - 1, CFG.mob_start.y + offset * CFG.mob_start.spacing)),
      facing: Math.PI, moving: false, radiusM: bodyRadiusM(mob), hp: mob.hp, hpMax: mob.hpMax, mob: mobCopy(mob),
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
  const idle = (state.field?.idleUnits ?? []).flatMap((unit) =>
    unit.mobs.map((mob, index) => ({ mob, unit, index })));
  for (const actor of idle) live.add(actor.mob.id);
  for (const id of Object.keys(arena.mobs)) if (!live.has(id)) delete arena.mobs[id];
  for (const mob of state.group) {
    const actor = arena.mobs[mob.id];
    if (actor) {
      actor.hp = mob.hp; actor.hpMax = mob.hpMax; actor.mob = mobCopy(mob);
      actor.statuses = statusCopy(state.mobStatus[mob.id]?.statuses);
    }
  }
  for (const { mob, unit, index } of idle) {
    const actor = arena.mobs[mob.id] ??= {
      id: mob.id, x: Math.min(arena.bounds.width - 0.5, unit.home.x + index * 0.9), y: unit.home.y,
      facing: Math.PI, moving: false, radiusM: bodyRadiusM(mob), hp: mob.hp, hpMax: mob.hpMax,
      mob: mobCopy(mob),
    };
    actor.hp = mob.hp;
    actor.hpMax = mob.hpMax;
    actor.mob = mobCopy(mob);
  }
  const oldest = atUs - CFG.history_sec * arena.unitsPerSec;
  arena.bodies = arena.bodies.filter((body) => atUs - body.diedAtUs <= CFG.body_sec * arena.unitsPerSec);
  arena.actions = arena.actions.filter((action) => action.endsAtUs >= oldest);
  arena.frames = arena.frames.filter((frame) => frame.atUs >= oldest);
  const frame: CombatArenaFrame = {
    atUs, player: actorCopy(arena.player),
    mobs: Object.fromEntries(Object.entries(arena.mobs).map(([id, actor]) => [id, actorCopy(actor)])),
    bodies: arena.bodies.map((body) => ({ ...body, mob: { ...body.mob } })),
  };
  if (arena.frames.at(-1)?.atUs === atUs) arena.frames[arena.frames.length - 1] = frame;
  else arena.frames.push(frame);
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

function approach(actor: CombatArenaActor, target: { x: number; y: number }, range: number, distance: number, seconds: number): void {
  const gap = arenaDistance(actor, target);
  const remaining = Math.max(0, gap - range);
  turnToward(actor, target.x, target.y, seconds);
  const ease = remaining > ARRIVE_SLOW_M ? 1
    : ARRIVE_MIN_FACTOR + (1 - ARRIVE_MIN_FACTOR) * (remaining / ARRIVE_SLOW_M);
  const move = Math.min(distance * ease, remaining);
  actor.moving = move > 1e-7;
  if (move > 0 && gap > 0) {
    actor.x += (target.x - actor.x) / gap * move;
    actor.y += (target.y - actor.y) / gap * move;
  }
}

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
        push(a, b, bodyRadiusM(a.mob) + bodyRadiusM(b.mob), 0.5);
      }
      const actor = arena.mobs[ids[i]];
      push(actor, arena.player, bodyRadiusM(actor.mob) + bodyRadiusM(undefined), 1);
    }
  }
  for (const actor of [arena.player, ...ids.map((id) => arena.mobs[id])]) {
    actor.x = Math.max(0, Math.min(arena.bounds.width, actor.x));
    actor.y = Math.max(0, Math.min(arena.bounds.height, actor.y));
  }
}

/** Advance to a combat event or fixed movement sample; callers provide existing status-clock cuts. */
export function advanceCombatArena(
  arena: CombatArena, state: GameState, atUs: number,
  options: { playerRange: number; playerSpeedMult: number; mobSpeedMult: (mob: Mob) => number;
    playerTargetId?: string; playerLocked?: boolean; playerMoveTo?: { x: number; y: number } },
): void {
  const seconds = Math.max(0, atUs - arena.nowUs) / arena.unitsPerSec;
  arena.nowUs = atUs;
  if (seconds === 0) { captureCombatArena(arena, state, atUs); return; }
  const target = options.playerTargetId
    ? state.group.find((mob) => mob.id === options.playerTargetId && mob.hp > 0)
    : arenaTarget(arena, state.group);
  arena.player.moving = false;
  if (options.playerMoveTo && state.player.hp > 0) {
    approach(arena.player, options.playerMoveTo, 0,
      CFG.player_speed * options.playerSpeedMult * seconds, seconds);
  } else if (target && state.player.hp > 0 && !options.playerLocked) {
    approach(arena.player, arena.mobs[target.id], options.playerRange,
      CFG.player_speed * options.playerSpeedMult * seconds, seconds);
  }
  const engaging = state.group.filter((mob) => mob.hp > 0);
  const engaged = new Set(engaging.map((mob) => mob.id));
  const melee = engaging.filter((mob) => mob.line !== 'stand-off');
  const slots = new Set<number>();
  for (const [index, mob] of melee.entries()) {
    const actor = arena.mobs[mob.id];
    if (!actor) continue;
    let slot = actor.contactSlot;
    if (slot == null || slots.has(slot)) slot = CFG.melee_contact_angles_deg.findIndex((_, at) => !slots.has(at));
    // More bodies than authored contact angles share a slot; body separation keeps them readable.
    if (slot < 0) slot = index % CFG.melee_contact_angles_deg.length;
    actor.contactSlot = slot;
    slots.add(slot);
  }
  for (const mob of state.group) {
    const actor = arena.mobs[mob.id];
    if (!actor) continue;
    actor.moving = false;
    if (engaged.has(mob.id) && mob.hp > 0 && state.player.hp > 0) {
      const distance = CFG.mob_speed * options.mobSpeedMult(mob) * seconds;
      if (melee.includes(mob)) {
        const angle = CFG.melee_contact_angles_deg[actor.contactSlot!] * Math.PI / 180;
        const radius = arenaMobRange(mob) * CFG.melee_contact_range_mult;
        const contact = {
          x: Math.max(0, Math.min(arena.bounds.width, arena.player.x + Math.cos(angle) * radius)),
          y: Math.max(0, Math.min(arena.bounds.height, arena.player.y + Math.sin(angle) * radius)),
        };
        approach(actor, contact, 0, distance, seconds);
        turnToward(actor, arena.player.x, arena.player.y, seconds);
      } else approach(actor, arena.player, arenaMobStopRange(mob), distance, seconds);
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
    ...(timing ? { timing: { ...timing }, endsAtUs: Math.max(timing.impactAtUs, timing.recoveryUntilUs)
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

/** Interpolate feet only. HP, action and death are discrete facts at the preceding combat sample. */
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
  const pose = (a: CombatArenaActor, b?: CombatArenaActor): CombatArenaActor => b
    ? { ...a, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    : { ...a };
  return {
    atUs, player: pose(before.player, after.player),
    mobs: Object.fromEntries(Object.entries(before.mobs).map(([id, actor]) => [id, pose(actor, after.mobs[id])])),
    bodies: before.bodies,
  };
}
