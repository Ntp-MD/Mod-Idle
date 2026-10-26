import { sm } from '../../engine/client';
import { targetsInSkillArea } from '../../../../engine/skill-actions.ts';
import { skillAreaSnapshot } from '../../../../engine/skill-area.ts';
import type { SkillAreaSnapshot, SkillCastProfile, SkillCastTiming } from '../../../../engine/types.ts';
import { aimForSkill, arenaDistance, arenaSkillRange, type CombatArena } from './combat-arena';
import { rotationOrder, skillEligibilityInState, type CastEnv, type CastRollCache, type PreparedSkillCast } from './skills';
import type { Character } from '../core/player';
import type { GameState, Mob } from '../core/types';

type Point = { x: number; y: number };

/** Deliberate local commands; the automatic rotation resumes when they finish. */
export interface ManualControl {
  /** A local ground point inside the current field; movement pauses new automatic casts. */
  moveTo?: Point;
  /** The farming anchor established by the last completed local move. */
  anchor?: Point;
  /** One uncommitted manual cast; no extra queue is retained. */
  cast?: { skillId: string; point?: Point };
}

export interface CombatIntent {
  skillId: string;
  targetId: string;
  targetPoint: Point;
  phase: 'approach' | 'windup' | 'recovery';
  /** A deliberate request owns the aim until it casts or becomes invalid. */
  manual?: boolean;
  /** The manual request committed an explicit ground point instead of a body. */
  aimPoint?: boolean;
  actionId?: number;
  releaseAtUs?: number;
  recoveryUntilUs?: number;
  releaseQueued?: boolean;
  /** A mobile channel: movement is permitted during the recovered primary action. */
  mobile?: boolean;
  /** Movement multiplier while a channel owns the actor (required with `mobile`). */
  speedMult?: number;
}

export interface CombatFlight {
  actionId: number;
  cast: PreparedSkillCast;
  character: Character;
  modifiers: Pick<CastEnv, 'trigger' | 'forceCrit' | 'critDamageBonusPct' | 'freeCast' | 'missingHpPct' | 'outgoingDamageMult'>;
  profile: SkillCastProfile;
  timing: SkillCastTiming;
  source: Point;
  destination: Point;
  area?: SkillAreaSnapshot;
  position: Point;
  lastCheckedAtUs: number;
  /** Encounter identity at release: crossing out of it cancels the remaining work with a receipt. */
  areaKey?: string;
  /** Multi-impact identity: index, authored share and the rolling cache shared by the whole cast. */
  impactIndex?: number;
  impactSharePct?: number;
  rolls?: CastRollCache;
  /** A caster-following pulse reads the caster's current centre at its own impact. */
  follow?: boolean;
  /** A deployed field's initial press suppresses the legacy erosion; later pulses carry flat DPS. */
  fieldInitial?: boolean;
  fieldPulseDamage?: number;
  /** Chain contacts: nearest unused body within the hop reach, at the authored interval. */
  chain?: { visited: string[]; remaining: number; hopRange: number; sharePct: number; intervalSec?: number };
  queued?: boolean;
  /** The body a projectile sweep touched, when that differs from the committed target. */
  hitTargetId?: string;
}

const actorsOf = (arena: CombatArena, group: Mob[]) => group.flatMap((mob) =>
  mob.hp > 0 && arena.mobs[mob.id] ? [{ ...arena.mobs[mob.id], mob }] : []);

/** Live tracking updates the selected identity, never performs another acquire query. */
export function trackIntentAim(arena: CombatArena, group: Mob[], intent: CombatIntent): CombatIntent | undefined {
  const skill = sm.byId[intent.skillId];
  if (!skill) return undefined;
  if (intent.aimPoint || skill.type === 'buff' || skill.type === 'heal') return intent;
  const target = group.find(mob => mob.id === intent.targetId && mob.hp > 0);
  const pose = target && arena.mobs[target.id];
  if (!pose) return undefined;
  const circle = skill.area?.origin === 'caster' && !['line', 'cone'].includes(skill.area.shape ?? '');
  return { ...intent, targetPoint: circle ? { x: arena.player.x, y: arena.player.y } : { x: pose.x, y: pose.y } };
}

export function intentTargets(
  arena: CombatArena, group: Mob[], intent: CombatIntent, planning = false,
): { targets: Mob[]; area?: SkillAreaSnapshot } {
  const skill = sm.byId[intent.skillId];
  if (skill.type === 'buff' || skill.type === 'heal') return { targets: group };
  const primary = group.find((mob) => mob.id === intent.targetId && mob.hp > 0);
  if (!primary) return { targets: [] };
  const definition = skill.area ?? { origin: 'target' as const, radius_m: 0 };
  const radius = definition.radius_m ?? 0;
  const aim = definition.origin === 'caster'
    ? intent.targetPoint
    : radius > 0
      ? intent.targetPoint
      : arena.mobs[intent.targetId] ?? intent.targetPoint;
  if (!planning && definition.origin !== 'caster'
    && arenaDistance(arena.player, aim) > arenaSkillRange(skill.id) + 1e-7)
    return { targets: [] };
  const area = skillAreaSnapshot(definition, arena.player, aim, primary.id, arena.player.facing);
  const selected = targetsInSkillArea(area, actorsOf(arena, group)).map((actor) => actor.mob);
  // Planning may approach a target that has not entered a self-area yet.
  return { targets: planning && !selected.includes(primary) ? [primary, ...selected] : selected, area };
}

/**
 * Best pick by cast order with live aim, ignoring any held intent. With `nowOnly`, only rows
 * whose aim is already in cast range qualify — a press that can fire this tick — so the
 * rotation stands its ground and casts instead of walking past live targets.
 */
function pickIntent(
  arena: CombatArena, state: GameState, character: Character,
  usable: (intent: CombatIntent) => boolean, nowOnly = false,
): CombatIntent | undefined {
  for (const skillId of rotationOrder(state.skills)) {
    const aim = aimForSkill(arena, state.group, skillId, nowOnly);
    if (!aim) continue;
    const intent: CombatIntent = { skillId, targetId: aim.mob.id,
      targetPoint: { x: aim.point.x, y: aim.point.y }, phase: 'approach' };
    if (usable(intent)) return intent;
  }
  return undefined;
}

/** An automatic field recast must not replace its own still-useful deployed field early. */
function usefulFieldActive(arena: CombatArena, group: Mob[], skillId: string): boolean {
  const kind = sm.byId[skillId]?.action?.kind;
  if (kind !== 'blizzard-field' && kind !== 'sand-field') return false;
  const pending = arena.flights.find((flight) => flight.cast.id === skillId && !!flight.area
    && flight.timing.impactAtUs > arena.nowUs);
  if (!pending?.area) return false;
  return actorsOf(arena, group).some((actor) => targetsInSkillArea(pending.area!, [actor]).length > 0);
}

/**
 * Hold one row and aim while approaching; cast immediately with any row that can fire now
 * rather than walking past live targets, otherwise refresh the aim to live positions, switch
 * to a strictly better cluster (at least one more body) or a newly-ready higher-priority row,
 * and cancel only when the held intent becomes unusable.
 */
export function selectCombatIntent(
  arena: CombatArena, state: GameState, character: Character, autoSkills: boolean,
): CombatIntent | undefined {
  if (!autoSkills || state.player.hp <= 0) return undefined;
  const usable = (intent: CombatIntent) => {
    const skill = sm.byId[intent.skillId];
    if (!skill) return false;
    if (usefulFieldActive(arena, state.group, intent.skillId)) return false;
    const selected = intentTargets(arena, state.group, intent, true);
    return skillEligibilityInState(state, character, intent.skillId, true, selected.targets, true).ready;
  };
  const order = rotationOrder(state.skills);
  const fresh = pickIntent(arena, state, character, usable);
  const previous = arena.intent && trackIntentAim(arena, state.group, arena.intent);
  if (previous?.phase === 'approach' && usable(previous)) {
    const now = pickIntent(arena, state, character, usable, true);
    if (now && now.skillId !== previous.skillId) return now;
    if (now) {
      // A now-usable target is a hard opportunity; otherwise keep an equally useful held aim.
      if (!intentInRange(arena, previous, state.group)) return now;
      const heldCount = intentTargets(arena, state.group, previous, false).targets.length;
      const nowCount = intentTargets(arena, state.group, now, false).targets.length;
      return nowCount > heldCount ? now : previous;
    }
    if (fresh && fresh.skillId !== previous.skillId) {
      const heldCount = intentTargets(arena, state.group, previous, true).targets.length;
      const freshCount = intentTargets(arena, state.group, fresh, true).targets.length;
      const higherPriority = order.indexOf(fresh.skillId) < order.indexOf(previous.skillId);
      if (freshCount > heldCount || (higherPriority && freshCount >= heldCount)) return fresh;
    }
    if (fresh && fresh.skillId === previous.skillId) {
      const heldCount = intentTargets(arena, state.group, previous, true).targets.length;
      const freshCount = intentTargets(arena, state.group, fresh, true).targets.length;
      if (freshCount > heldCount) return fresh;
    }
    return previous;
  }
  const now = pickIntent(arena, state, character, usable, true);
  return now ?? fresh;
}

export function intentInRange(arena: CombatArena, intent: CombatIntent, group: Mob[] = []): boolean {
  const skill = sm.byId[intent.skillId];
  if (skill.type === 'buff' || skill.type === 'heal') return true;
  if (arenaDistance(arena.player, intent.targetPoint) > arenaSkillRange(intent.skillId) + 1e-7) return false;
  return skill.area?.origin !== 'caster'
    || intentTargets(arena, group, intent, false).targets.length > 0;
}

/** A released area remains fixed while living target positions are read again at impact. */
export function flightTargets(arena: CombatArena, group: Mob[], flight: CombatFlight): Mob[] {
  if (!flight.area) return group;
  let actors = actorsOf(arena, group);
  if (flight.profile.delivery === 'melee') {
    actors = actors.filter((actor) => arenaDistance(flight.source, actor) <= flight.profile.range_m + 1e-7);
    const single = flight.area.shape ? flight.area.shape === 'single'
      : flight.area.radiusM === 0;
    if (single) {
      const primary = actors.find((actor) => actor.id === flight.area!.targetId);
      return primary ? [primary.mob] : [];
    }
  }
  const precise = flight.profile.delivery === 'instant' ? 0 : flight.profile.hit_radius_m;
  return targetsInSkillArea(flight.area, actors, precise).map((actor) => actor.mob);
}

export function projectilePosition(flight: CombatFlight, atUs: number): Point {
  const span = flight.timing.impactAtUs - flight.timing.releaseAtUs;
  const progress = span > 0 ? Math.max(0, Math.min(1, (atUs - flight.timing.releaseAtUs) / span)) : 1;
  return { x: flight.source.x + (flight.destination.x - flight.source.x) * progress,
    y: flight.source.y + (flight.destination.y - flight.source.y) * progress };
}
