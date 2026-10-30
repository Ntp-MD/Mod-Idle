import type { SkillAreaSnapshot } from '@engine/types';
import { skillAreaSnapshot } from '@engine/skill-area';
import { E, sm } from '../../engine/client';
import { mobSkillById, mobStrikeRange } from '@sim/combat/mobSkills';
import { arenaSkillRange, type CombatArenaAction, type CombatArenaFrame } from '@sim/combat/combat-arena';
import { arenaPresentationArea, projectArenaPoint } from './combat-arena-view';
import { groundShapePath, groundShapePoints } from './arena-vfx-space';
import { groundCirclePath } from './arena-space';

type Point = { x: number; y: number };
export type SkillAimGeometry = { skillId: string; area: SkillAreaSnapshot; source: Point; rangeM: number; valid: boolean };
export type SkillGeometry = {
  key: string; skillId: string; name: string; incoming: boolean; valid: boolean;
  phase: 'Aim' | 'Windup' | 'Travel' | 'Impact' | 'Field' | 'Channel';
  area: SkillAreaSnapshot; source: Point; target: Point; footprint: string; range: string;
  vertices: Point[]; label: Point; dimensions: string; direction: { from: Point; to: Point };
  paths: { index: number; from: Point; to: Point; blocked: boolean }[];
};
const number = (value: number) => Number(value.toFixed(2)).toString();
const selfSkill = (type?: string) => type === 'heal' || type === 'buff' || type === 'aura';

function geometry(input: {
  key: string; skillId: string; name: string; incoming: boolean; valid?: boolean;
  phase: SkillGeometry['phase']; area: SkillAreaSnapshot; source: Point; target: Point;
  rangeM: number; hitRadiusM?: number; hopRangeM?: number; paths?: SkillGeometry['paths'];
}): SkillGeometry {
  const { area } = input;
  const vertices = groundShapePoints(area);
  const label = vertices.reduce((best, point) => point.y < best.y ? point : best, vertices[0]);
  const shape = area.shape ?? (area.radiusM > 0 ? 'circle' : 'single');
  const size = input.hopRangeM != null ? `Single · Hop ${number(input.hopRangeM)} m`
    : shape === 'line' ? `Line ${number(area.lengthM ?? 0)} × ${number(area.widthM ?? 0)} m`
    : shape === 'cone' ? `Cone ${number(area.lengthM ?? area.radiusM)} m · ${number(area.angleDeg ?? 90)}°`
    : area.radiusM > 0 ? `Circle r ${number(area.radiusM)} m` : 'Single';
  const range = input.rangeM > 0 ? `Range ${number(input.rangeM)} m` : 'Self';
  const thickness = input.hitRadiusM ? ` · Hit Ø ${number(input.hitRadiusM * 2)} m` : '';
  return {
    ...input, valid: input.valid !== false, vertices, label: { x: label.x, y: label.y - 26 },
    footprint: groundShapePath(area), range: input.rangeM > 0 ? groundCirclePath(input.source, input.rangeM, 48) : '',
    dimensions: `${range} · ${size}${thickness}`, paths: input.paths ?? [],
    direction: { from: projectArenaPoint(input.source), to: projectArenaPoint(input.target) },
  };
}

/** Geometry reads committed actions. It never acquires a target or advances combat. */
export function skillActionGeometry(action: CombatArenaAction, frame: CombatArenaFrame,
  atUs: number, unitsPerSec: number): SkillGeometry | undefined {
  if (action.kind !== 'cast' || !action.skillId || atUs < action.atUs || atUs > action.endsAtUs
    || action.cancelledAtUs != null && atUs >= action.cancelledAtUs) return undefined;
  const playerSkill = action.actorId === 'player' ? sm.byId[action.skillId] : undefined;
  const mobSkill = playerSkill ? undefined : mobSkillById(action.skillId);
  if (!playerSkill && !mobSkill) return undefined;
  const actor = action.actorId === 'player' ? frame.player : frame.mobs[action.actorId];
  const recipient = selfSkill(playerSkill?.type) ? frame.player
    : action.targetId === 'player' ? frame.player : frame.mobs[action.targetId ?? ''];
  const firstPayload = action.payloads?.[0];
  const source = firstPayload?.source ?? { x: action.x, y: action.y };
  const target = selfSkill(playerSkill?.type) ? frame.player
    : action.targetX != null && action.targetY != null ? { x: action.targetX, y: action.targetY }
    : recipient ?? source;
  const chain = playerSkill?.action?.kind === 'chain-strike';
  const area = selfSkill(playerSkill?.type)
    ? skillAreaSnapshot({ origin: 'caster', radius_m: 0 }, frame.player, frame.player, 'player')
    : arenaPresentationArea(action, frame) ?? skillAreaSnapshot(chain
      ? { origin: 'target', radius_m: 0 }
      : playerSkill?.area ?? mobSkill?.area ?? { origin: 'target', radius_m: 0 }, source, target, action.targetId ?? '', actor?.facing);
  // A chain's authored radius is hop reach, never an impact-circle radius, including windup.
  const footprint = chain ? { ...area, radiusM: 0, shape: 'single' as const } : area;
  const timing = action.primaryTiming ?? action.timing;
  const released = timing?.releaseAtUs ?? action.atUs;
  const impacted = action.timing?.impactAtUs ?? released;
  const kind = playerSkill?.action?.kind;
  const phase: SkillGeometry['phase'] = atUs < released ? 'Windup'
    : kind === 'whirlwind-channel' ? 'Channel'
    : kind === 'blizzard-field' || kind === 'sand-field' ? 'Field'
    : atUs < impacted ? 'Travel' : 'Impact';
  const profile = playerSkill ? sm.castProfileOf(playerSkill) : mobSkill?.cast;
  const rangeM = selfSkill(playerSkill?.type) ? 0 : playerSkill ? arenaSkillRange(playerSkill.id)
    : mobSkill && actor?.mob ? mobStrikeRange(mobSkill, actor.mob) : mobSkill?.cast?.range.meters ?? 0;
  const paths = (action.payloads ?? []).filter(payload => atUs >= payload.releaseAtUs
    && atUs <= (payload.impactAtUs ?? payload.plannedImpactAtUs) + E.combat_arena.action_sec * unitsPerSec)
    .map(payload => ({ index: payload.index, from: projectArenaPoint(payload.source),
      to: projectArenaPoint(payload.impactAtUs != null && atUs >= payload.impactAtUs
        ? payload.contact ?? payload.destination : payload.destination), blocked: !!payload.cancelReason }));
  return geometry({ key: `action-${action.id}`, skillId: action.skillId,
    name: playerSkill?.name ?? mobSkill?.name ?? action.skillId, incoming: action.actorId !== 'player',
    phase, area: footprint, source, target: footprint.shape === 'line' || footprint.shape === 'cone'
      ? { x: footprint.center.x + Math.cos(footprint.directionRad ?? 0) * (footprint.lengthM ?? footprint.radiusM),
        y: footprint.center.y + Math.sin(footprint.directionRad ?? 0) * (footprint.lengthM ?? footprint.radiusM) } : target,
    rangeM, hitRadiusM: profile?.delivery === 'projectile' ? profile.hit_radius_m : undefined,
    hopRangeM: chain ? playerSkill?.area?.radius_m : undefined, paths });
}

export function skillAimGeometry(aim: SkillAimGeometry): SkillGeometry | undefined {
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
  return geometry({ key: 'aim', skillId: skill.id, name: skill.name ?? skill.id, incoming: false, phase: 'Aim',
    valid: aim.valid, source: aim.source, target, area, rangeM: selfSkill(skill.type) ? 0 : aim.rangeM,
    hitRadiusM: profile.delivery === 'projectile' ? profile.hit_radius_m : undefined,
    hopRangeM: chain ? skill.area?.radius_m : undefined });
}
