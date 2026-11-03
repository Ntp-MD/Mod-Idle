import type { SkillAreaSnapshot } from '@engine/types';
import { skillAreaSnapshot } from '@engine/skill-area';
import { E, sm } from '../../engine/client';
import { hitColour } from '@sim/core/feedback';
import { mobSkillById, mobStrikeRange } from '@sim/combat/mobSkills';
import { arenaSkillRange, type CombatArenaAction, type CombatArenaFrame } from '@sim/combat/combat-arena';
import type { CombatFlight } from '@sim/combat/combat-actions';
import { ARENA_VIEW, arenaPresentationArea, projectArenaPoint, type ArenaViewSize } from './combat-arena-view';
import { buildSkillVfxAim, groundShapePath, groundShapePoints, type SkillVfxAim } from './arena-vfx-space';
import { groundCirclePath } from './arena-space';

type Point = { x: number; y: number };
export type SkillAimGeometry = {
  skillId: string; area: SkillAreaSnapshot; source: Point; rangeM: number; valid: boolean; targetName?: string;
};
export type SkillGeometry = {
  key: string; skillId: string; name: string; targetName: string; incoming: boolean; valid: boolean;
  /** Seconds since the committed action started; drives atlas frame stepping. */
  elapsedSec?: number;
  /** The skill's authored Element, or physical when the row carries none. */
  element: string; colour: string;
  phase: 'Aim' | 'Windup' | 'Travel' | 'Impact' | 'Field' | 'Channel';
  progress: number; remainingSec?: number;
  area: SkillAreaSnapshot; source: Point; target: Point; footprint: string; range: string;
  innerFootprint: string; center: Point;
  vertices: Point[]; label: Point; labelWidth: number; dimensions: string; direction: { from: Point; to: Point };
  /** The shared release/aim/impact contract every VFX reader uses. */
  vfxAim: SkillVfxAim;
  /** Screen-space body reference the effect is sized against. */
  body: { width: number; height: number };
  /** Seconds inside the current presentation phase; drives authored opening/loop/exit frames. */
  phaseElapsedSec: number;
  /** A real committed chain hop, rendered as a bridge plus its contact atlas. */
  chainHop?: boolean;
  paths: { index: number; from: Point; to: Point; blocked: boolean }[];
};
const number = (value: number) => Number(value.toFixed(2)).toString();
const selfSkill = (type?: string) => type === 'heal' || type === 'buff' || type === 'aura';

function geometry(input: {
  key: string; skillId: string; name: string; incoming: boolean; valid?: boolean;
  element?: string | null;
  targetName: string;
  phase: SkillGeometry['phase']; area: SkillAreaSnapshot; source: Point; target: Point;
  progress?: number; remainingSec?: number; elapsedSec?: number; phaseElapsedSec?: number;
  release?: Point;
  body?: { width: number; height: number };
  rangeM: number; hitRadiusM?: number; hopRangeM?: number; paths?: SkillGeometry['paths'];
}, view: ArenaViewSize = ARENA_VIEW): SkillGeometry {
  const { area } = input;
  const element = input.element || 'physical';
  const vertices = groundShapePoints(area);
  const bounds = vertices.reduce((value, point) => ({
    left: Math.min(value.left, point.x), right: Math.max(value.right, point.x),
    top: Math.min(value.top, point.y), bottom: Math.max(value.bottom, point.y),
  }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  const shape = area.shape ?? (area.radiusM > 0 ? 'circle' : 'single');
  const size = input.hopRangeM != null ? `Single · Hop ${number(input.hopRangeM)} m`
    : shape === 'line' ? `Line ${number(area.lengthM ?? 0)} × ${number(area.widthM ?? 0)} m`
    : shape === 'cone' ? `Cone ${number(area.lengthM ?? area.radiusM)} m · ${number(area.angleDeg ?? 90)}°`
    : area.radiusM > 0 ? `Circle r ${number(area.radiusM)} m` : 'Single';
  const range = input.rangeM > 0 ? `Range ${number(input.rangeM)} m` : 'Self';
  const thickness = input.hitRadiusM ? ` · Hit Ø ${number(input.hitRadiusM * 2)} m` : '';
  const nameText = `${input.name} · ${input.phase}`;
  const dimensions = `Target ${input.targetName} · ${range} · ${size}${thickness}`;
  const labelWidth = Math.min(280, Math.max(nameText.length * 8, dimensions.length * 7) + 18);
  const labelX = bounds.left - labelWidth / 2 - 8 >= 8
    ? bounds.left - labelWidth / 2 - 8 : bounds.right + labelWidth / 2 + 8;
  const body = input.body ?? { width: 60, height: 132 };
  return {
    ...input, element, colour: hitColour(element), progress: input.progress ?? 1, valid: input.valid !== false, vertices,
    elapsedSec: input.elapsedSec ?? 0,
    phaseElapsedSec: input.phaseElapsedSec ?? 0,
    body,
    vfxAim: buildSkillVfxAim(area, input.source, input.target, input.release, body.height),
    label: { x: Math.max(labelWidth / 2 + 6, Math.min(view.width - labelWidth / 2 - 6, labelX)),
      y: Math.max(20, Math.min(view.height - 20, (bounds.top + bounds.bottom) / 2)) },
    labelWidth,
    footprint: groundShapePath(area), range: input.rangeM > 0 ? groundCirclePath(input.source, input.rangeM, 48) : '',
    innerFootprint: groundShapePath({ ...area, radiusM: area.radiusM * .93,
      ...(area.lengthM != null ? { lengthM: area.lengthM * .93 } : {}),
      ...(area.widthM != null ? { widthM: area.widthM * .93 } : {}) }),
    center: projectArenaPoint(area.center),
    dimensions, paths: input.paths ?? [],
    direction: { from: projectArenaPoint(input.source), to: projectArenaPoint(input.target) },
  };
}

/** Geometry reads committed actions. It never acquires a target or advances combat. */
/** How long a footprint must stay drawn after impact: the skill's own effect duration
 *  (lingering ground damage, then any authored window), so the circle lives until the skill
 *  stops working instead of vanishing at the hit. Rows without a duration keep the legacy
 *  impact tail only. `dot_sec` is level-stable by contract (special_level_effects). */
function skillMarkLingerSec(
  playerSkill: { effects?: unknown; duration?: unknown } | undefined,
  mobSkill: { effects?: unknown; duration?: unknown } | undefined,
): number {
  const row = playerSkill ?? mobSkill;
  const effects = Array.isArray(row?.effects) ? row.effects as { stat?: unknown; value?: unknown }[] : [];
  const dotSec = Math.max(0, Math.floor(Number(effects.find((effect) => effect.stat === 'dot_sec')?.value ?? 0)));
  const windowSec = sm.skillDurationSec((row as { duration?: unknown } | undefined)?.duration, 0);
  return Math.max(Number.isFinite(dotSec) ? dotSec : 0,
    Number.isFinite(windowSec) && windowSec > 0 ? windowSec : 0);
}

export function skillActionGeometry(action: CombatArenaAction, frame: CombatArenaFrame,
  atUs: number, unitsPerSec: number, nextImpactAtUs?: number, view: ArenaViewSize = ARENA_VIEW,
  releasePoints?: Record<string, Point>, bodySizes?: Record<string, { width: number; height: number }>,
  presentationTailSec = 0): SkillGeometry | undefined {
  if (action.kind !== 'cast' || !action.skillId || atUs < action.atUs
    || action.cancelledAtUs != null && atUs >= action.cancelledAtUs) return undefined;
  const playerSkill = action.actorId === 'player' ? sm.byId[action.skillId] : undefined;
  const mobSkill = playerSkill ? undefined : mobSkillById(action.skillId);
  if (!playerSkill && !mobSkill) return undefined;
  const kind = playerSkill?.action?.kind;
  const timing = action.primaryTiming ?? action.timing;
  const released = timing?.releaseAtUs ?? action.atUs;
  if (kind === 'ray-channel' && atUs >= released && (!action.channel
    || atUs >= released + (playerSkill?.action?.active_sec ?? 0) * unitsPerSec)) return undefined;
  const impacted = nextImpactAtUs ?? action.timing?.impactAtUs ?? released;
  // A field's later damage beats must not restart its full visual duration.
  const fieldDuration = kind === 'blizzard-field' || kind === 'sand-field' || kind === 'meteor-field' || kind === 'thunder-field'
    ? skillMarkLingerSec(playerSkill, mobSkill) : 0;
  if (fieldDuration > 0 && atUs >= released + fieldDuration * unitsPerSec) return undefined;
  // The footprint outlives the hit while the skill still works: lingering damage and
  // authored windows keep their circle until the duration ends, every skill alike.
  const lingerUntilUs = impacted + skillMarkLingerSec(playerSkill, mobSkill) * unitsPerSec;
  if (atUs > Math.max(action.endsAtUs + presentationTailSec * unitsPerSec, nextImpactAtUs ?? -Infinity, lingerUntilUs)) return undefined;
  const actor = action.actorId === 'player' ? frame.player : frame.mobs[action.actorId];
  const recipient = selfSkill(playerSkill?.type) ? frame.player
    : action.targetId === 'player' ? frame.player : frame.mobs[action.targetId ?? ''];
  const firstPayload = action.payloads?.[0];
  const source = firstPayload?.source ?? { x: action.x, y: action.y };
  const target = selfSkill(playerSkill?.type) ? frame.player
    : action.targetX != null && action.targetY != null ? { x: action.targetX, y: action.targetY }
    : recipient ?? source;
  const targetName = selfSkill(playerSkill?.type) ? 'You'
    : action.actorId !== 'player' && action.targetId === 'player' ? 'Player'
    : recipient?.mob ? `${recipient.mob.species} ${recipient.mob.level}` : action.targetId ? 'Target' : 'Ground';
  const chain = playerSkill?.action?.kind === 'chain-strike';
  const area = selfSkill(playerSkill?.type)
    ? skillAreaSnapshot({ origin: 'caster', radius_m: 0 }, frame.player, frame.player, 'player')
    : arenaPresentationArea(action, frame) ?? skillAreaSnapshot(chain
      ? { origin: 'target', radius_m: 0 }
      : playerSkill?.area ?? mobSkill?.area ?? { origin: 'target', radius_m: 0 }, source, target, action.targetId ?? '', actor?.facing);
  // A chain's authored radius is hop reach, never an impact-circle radius, including windup.
  const footprint = chain ? { ...area, radiusM: 0, shape: 'single' as const } : area;
  const phase: SkillGeometry['phase'] = atUs < released ? 'Windup'
    : kind === 'whirlwind-channel' || kind === 'ray-channel' ? 'Channel'
    : kind === 'blizzard-field' || kind === 'sand-field' || kind === 'meteor-field' || kind === 'thunder-field' ? 'Field'
    : atUs < impacted ? 'Travel' : 'Impact';
  const profile = playerSkill ? sm.castProfileOf(playerSkill) : mobSkill?.cast;
  const rangeM = selfSkill(playerSkill?.type) ? 0 : playerSkill ? arenaSkillRange(playerSkill.id)
    : mobSkill && actor?.mob ? mobStrikeRange(mobSkill, actor.mob) : mobSkill?.cast?.range.meters ?? 0;
  const paths = (action.payloads ?? []).filter(payload => atUs >= payload.releaseAtUs
    && atUs <= (payload.impactAtUs ?? payload.plannedImpactAtUs) + E.combat_arena.action_sec * unitsPerSec)
    .map(payload => ({ index: payload.index, from: projectArenaPoint(payload.source),
      to: projectArenaPoint(payload.impactAtUs != null && atUs >= payload.impactAtUs
        ? payload.contact ?? payload.destination : payload.destination), blocked: !!payload.cancelReason }));
  const until = phase === 'Windup' ? released : phase === 'Travel' ? impacted : undefined;
  const from = phase === 'Windup' ? timing?.startedAtUs ?? action.atUs : released;
  const phaseStart = phase === 'Windup' ? (timing?.startedAtUs ?? action.atUs)
    : phase === 'Travel' || phase === 'Field' || phase === 'Channel' ? released : impacted;
  const progress = until != null && until > from ? Math.max(0, Math.min(1, (atUs - from) / (until - from))) : 1;
  return geometry({ key: `action-${action.id}`, skillId: action.skillId, progress,
    elapsedSec: Math.max(0, (atUs - action.atUs) / unitsPerSec),
    phaseElapsedSec: Math.max(0, (atUs - phaseStart) / unitsPerSec),
    ...(until != null ? { remainingSec: Math.max(0, until - atUs) / unitsPerSec }
      // A lingering impact counts its duration down on the label instead of going silent.
      : phase === 'Impact' && lingerUntilUs > impacted
        ? { remainingSec: Math.max(0, lingerUntilUs - atUs) / unitsPerSec } : {}),
    ...(releasePoints?.[action.actorId] ? { release: releasePoints[action.actorId] } : {}),
    ...(bodySizes?.[action.actorId] ? { body: bodySizes[action.actorId] } : {}),
    name: playerSkill?.name ?? mobSkill?.name ?? action.skillId, targetName, incoming: action.actorId !== 'player',
    element: playerSkill?.element ?? mobSkill?.element ?? null,
    phase, area: footprint, source, target: footprint.shape === 'line' || footprint.shape === 'cone'
      ? { x: footprint.center.x + Math.cos(footprint.directionRad ?? 0) * (footprint.lengthM ?? footprint.radiusM),
        y: footprint.center.y + Math.sin(footprint.directionRad ?? 0) * (footprint.lengthM ?? footprint.radiusM) } : target,
    rangeM, hitRadiusM: profile?.delivery === 'projectile' ? profile.hit_radius_m : undefined,
    hopRangeM: chain ? playerSkill?.area?.radius_m : undefined, paths }, view);
}

/** Each committed shot owns its flight and contact animation; a volley is never one moving stamp. */
export function skillPayloadArtGeometry(mark: SkillGeometry, action: CombatArenaAction,
  atUs: number, unitsPerSec: number, presentationTailSec: number,
  liveFlights: readonly CombatFlight[] = []): SkillGeometry[] {
  if (!action.payloads?.length || mark.phase === 'Windup' || mark.phase === 'Aim') return [mark];
  const chain = sm.byId[mark.skillId]?.action?.kind === 'chain-strike';
  return action.payloads.flatMap(payload => {
    const impactAtUs = payload.impactAtUs ?? payload.plannedImpactAtUs;
    if (atUs < payload.releaseAtUs || atUs > impactAtUs + presentationTailSec * unitsPerSec
      || payload.cancelReason && atUs >= impactAtUs) return [];
    const impacted = atUs >= impactAtUs;
    const target = impacted ? payload.contact ?? payload.destination : payload.destination;
    const area = { ...mark.area, center: target };
    const release = payload.index === 0 ? mark.vfxAim.release : undefined;
    const vfxAim = buildSkillVfxAim(area, payload.source, target, release, mark.body.height);
    const flight = impacted ? undefined : liveFlights.find(flight => flight.actionId === action.id
      && (flight.impactIndex ?? 0) === payload.index && flight.homing);
    const sampledAtUs = flight?.lastCheckedAtUs ?? payload.releaseAtUs;
    const sampled = flight != null && atUs >= sampledAtUs;
    if (sampled) {
      const t = Math.max(0, Math.min(1, (atUs - sampledAtUs)
        / Math.max(1, flight.timing.impactAtUs - sampledAtUs)));
      const position = { x: flight.position.x + (flight.destination.x - flight.position.x) * t,
        y: flight.position.y + (flight.destination.y - flight.position.y) * t };
      vfxAim.release = projectArenaPoint(position);
      vfxAim.release.y -= mark.body.height * .5;
      vfxAim.impact = projectArenaPoint(flight.destination);
      vfxAim.impact.y -= mark.body.height * .5;
    }
    if (chain && payload.index > 0) {
      vfxAim.release = projectArenaPoint(payload.source);
      vfxAim.release.y -= mark.body.height * .5;
      vfxAim.screenAngleRad = Math.atan2(vfxAim.impact.y - vfxAim.release.y, vfxAim.impact.x - vfxAim.release.x);
    }
    return [{ ...mark, key: `${mark.key}-payload-${payload.index}`, source: payload.source, target,
      area, center: projectArenaPoint(target), vertices: groundShapePoints(area), vfxAim, chainHop: chain,
      phase: impacted ? 'Impact' as const : 'Travel' as const,
      phaseElapsedSec: Math.max(0, (atUs - (impacted ? impactAtUs : payload.releaseAtUs)) / unitsPerSec),
      progress: impacted ? 1 : sampled ? 0 : Math.max(0, Math.min(1,
        (atUs - payload.releaseAtUs) / Math.max(1, impactAtUs - payload.releaseAtUs))),
      paths: chain ? [{ index: payload.index, from: vfxAim.release, to: vfxAim.impact, blocked: false }] : [],
    }];
  });
}

export function skillAimGeometry(aim: SkillAimGeometry, view: ArenaViewSize = ARENA_VIEW,
  release?: Point, body?: { width: number; height: number }): SkillGeometry | undefined {
  const skill = sm.byId[aim.skillId];
  if (!skill) return undefined;
  const chain = skill.action?.kind === 'chain-strike';
  const area = chain ? { ...aim.area, radiusM: 0, shape: 'single' as const } : aim.area;
  const directional = area.shape === 'line' || area.shape === 'cone';
  const target = directional ? {
    x: area.center.x + Math.cos(area.directionRad ?? 0) * (area.lengthM ?? area.radiusM),
    y: area.center.y + Math.sin(area.directionRad ?? 0) * (area.lengthM ?? area.radiusM),
  } : area.center;
  const profile = sm.castProfileOf(skill);
  return geometry({ key: 'aim', skillId: skill.id, name: skill.name ?? skill.id,
    targetName: aim.targetName ?? 'Ground', incoming: false, phase: 'Aim', element: skill.element ?? null,
    valid: aim.valid, source: aim.source, target, area, rangeM: selfSkill(skill.type) ? 0 : aim.rangeM,
    ...(release ? { release } : {}),
    ...(body ? { body } : {}),
    hitRadiusM: profile.delivery === 'projectile' ? profile.hit_radius_m : undefined,
    hopRangeM: chain ? skill.area?.radius_m : undefined }, view);
}
