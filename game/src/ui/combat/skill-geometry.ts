import type { SkillAreaSnapshot } from '@engine/types';
import { skillAreaSnapshot } from '@engine/skill-area';
import { ARENA_REF_PX_PER_M } from '../../presentation/arena-camera';
import { E, sm } from '../../engine/client';
import { hitColour } from '@sim/core/feedback';
import { mobSkillById, mobStrikeRange } from '@sim/combat/mobSkills';
import { arenaSkillRange, type CombatArenaAction, type CombatArenaFrame } from '@sim/combat/combat-arena';
import type { CombatFlight } from '@sim/combat/combat-actions';
import { arenaPresentationArea } from './combat-arena-view';
import {
  buildSkillVfxAimWorld,
  groundShapeWorldPoints,
  projectSkillVfxAim,
  VFX_BODY_LIFT_SHARE,
  worldCirclePoints,
  type SkillVfxAimPx,
  type SkillVfxAimWorld,
} from './arena-vfx-space';
import {
  applyWorldToViewport,
  fieldPointM,
} from '../../presentation/view-transform';
import type { FieldViewFrame } from '../../presentation/arena-view-frame';

/**
 * Skill geometry in world metres (WP4). The engine's resolved snapshot stays
 * authoritative; this DTO carries world points only. Projected SVG strings and
 * viewport pixels are produced per painted frame by `projectSkillGeometry` —
 * never stored here, so zoom/scale can never change the committed footprint.
 */

type WorldPoint = { x: number; y: number };
/** Body model envelope in metres (from the shared WP2 body model, never pixels). */
export type BodyModelM = { width: number; height: number };
/** Legacy ref-space body envelope converted once through the single reference density. */
export const DEFAULT_BODY_M: BodyModelM = { width: 60 / ARENA_REF_PX_PER_M, height: 132 / ARENA_REF_PX_PER_M };

export type SkillAimGeometry = {
  skillId: string; area: SkillAreaSnapshot; source: WorldPoint; rangeM: number; valid: boolean; targetName?: string;
};
export type SkillGeometry = {
  key: string; skillId: string; name: string; targetName: string; incoming: boolean; valid: boolean;
  sourceKind?: 'cast' | 'aim' | 'aura' | 'support';
  actorId?: string;
  actionId?: number;
  eventId?: number;
  payloadIndex?: number;
  /** Seconds since the committed action started; drives atlas frame stepping. */
  elapsedSec?: number;
  /** The skill's authored Element, or physical when the row carries none. */
  element: string; colour: string;
  phase: 'Aim' | 'Windup' | 'Travel' | 'Impact' | 'Field' | 'Channel';
  progress: number; remainingSec?: number;
  area: SkillAreaSnapshot;
  /** World-metre points: committed source, target endpoint and footprint centre. */
  source: WorldPoint; target: WorldPoint; center: WorldPoint;
  /** World aim angle the simulation committed (line/cone direction, else source→target). */
  directionRad: number;
  /** Debug text only; layout in the screen adapter is UI policy. */
  dimensions: string;
  rangeM: number; hitRadiusM?: number; hopRangeM?: number;
  /** Body model envelope in metres; the frame adapter converts once for paint. */
  bodyM: BodyModelM;
  /** The shared release/aim/impact contract in world metres. */
  vfxAim: SkillVfxAimWorld;
  /** Seconds inside the current presentation phase; drives authored opening/loop/exit frames. */
  phaseElapsedSec: number;
  /** A real committed chain hop, rendered as a bridge plus its contact atlas. */
  chainHop?: boolean;
  /** World-metre payload spans; the adapter projects and lifts chain hops. */
  paths: { index: number; from: WorldPoint; to: WorldPoint; blocked: boolean }[];
};

/** Viewport-CSS projection of one world mark for the painted frame. */
export type SkillGeometryScreen = {
  footprint: string; innerFootprint: string; rangePath: string;
  center: WorldPoint; vertices: WorldPoint[]; label: WorldPoint; labelWidth: number;
  direction: { from: WorldPoint; to: WorldPoint };
  vfxAim: SkillVfxAimPx;
  paths: { index: number; from: WorldPoint; to: WorldPoint; blocked: boolean }[];
  bodyCss: { width: number; height: number };
};

const number = (value: number) => Number(value.toFixed(2)).toString();
const selfSkill = (type?: string) => type === 'heal' || type === 'buff' || type === 'aura';

function geometry(input: {
  key: string; skillId: string; name: string; incoming: boolean; valid?: boolean;
  element?: string | null;
  targetName: string;
  phase: SkillGeometry['phase']; area: SkillAreaSnapshot; source: WorldPoint; target: WorldPoint;
  progress?: number; remainingSec?: number; elapsedSec?: number; phaseElapsedSec?: number;
  releaseM?: WorldPoint;
  releaseLiftM?: number;
  bodyM?: BodyModelM;
  rangeM: number; hitRadiusM?: number; hopRangeM?: number; paths?: SkillGeometry['paths'];
  sourceKind?: SkillGeometry['sourceKind']; actorId?: string; actionId?: number; eventId?: number; payloadIndex?: number;
}): SkillGeometry {
  const { area } = input;
  const element = input.element || 'physical';
  const shape = area.shape ?? (area.radiusM > 0 ? 'circle' : 'single');
  const size = input.hopRangeM != null ? `Single · Hop ${number(input.hopRangeM)} m`
    : shape === 'line' ? `Line ${number(area.lengthM ?? area.radiusM)} × ${number(area.widthM ?? 0.6)} m`
    : shape === 'cone' ? `Cone ${number(area.lengthM ?? area.radiusM)} m · ${number(area.angleDeg ?? 90)}°`
    : area.radiusM > 0 ? `Circle r ${number(area.radiusM)} m` : 'Single';
  const range = input.rangeM > 0 ? `Range ${number(input.rangeM)} m` : 'Self';
  const thickness = input.hitRadiusM ? ` · Hit Ø ${number(input.hitRadiusM * 2)} m` : '';
  const dimensions = `Target ${input.targetName} · ${range} · ${size}${thickness}`;
  const bodyM = input.bodyM ?? { ...DEFAULT_BODY_M };
  const fallback = Math.atan2(input.target.y - input.source.y, input.target.x - input.source.x);
  const directionRad = Number.isFinite(area.directionRad) ? area.directionRad! : fallback;
  return {
    ...input, element, colour: hitColour(element), progress: input.progress ?? 1, valid: input.valid !== false,
    elapsedSec: input.elapsedSec ?? 0,
    phaseElapsedSec: input.phaseElapsedSec ?? 0,
    center: { ...area.center },
    directionRad,
    dimensions,
    rangeM: input.rangeM,
    bodyM,
    vfxAim: buildSkillVfxAimWorld(area, input.source, input.target,
      input.releaseM, input.releaseLiftM),
    paths: input.paths ?? [],
  };
}

/**
 * Frame-driven adapter: world mark to viewport CSS for paint. Footprint paths,
 * labels, ranges, directions and aim anchors are projected here per frame; the
 * world mark is never mutated. Returns undefined for a hidden frame.
 */
export function projectSkillGeometry(mark: SkillGeometry, frame: FieldViewFrame): SkillGeometryScreen | undefined {
  if (!frame.renderable) return undefined;
  const cssPerM = frame.cssPixelsPerMeter;
  const viewport = frame.viewportCss;
  const project = (point: WorldPoint): WorldPoint =>
    applyWorldToViewport(frame.worldToViewport, fieldPointM(point.x, point.y)) as WorldPoint;
  const vertices = groundShapeWorldPoints(mark.area).map(project);
  const pathOf = (points: WorldPoint[]): string =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ') + ' Z';
  const footprint = pathOf(vertices);
  const inner = groundShapeWorldPoints({ ...mark.area, radiusM: mark.area.radiusM * .93,
    ...(mark.area.lengthM != null ? { lengthM: mark.area.lengthM * .93 } : {}),
    ...(mark.area.widthM != null ? { widthM: mark.area.widthM * .93 } : {}),
  }).map(project);
  const rangePath = mark.rangeM > 0 ? pathOf(worldCirclePoints(mark.source, mark.rangeM).map(project)) : '';
  const bounds = vertices.reduce((value, point) => ({
    left: Math.min(value.left, point.x), right: Math.max(value.right, point.x),
    top: Math.min(value.top, point.y), bottom: Math.max(value.bottom, point.y),
  }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  const nameText = `${mark.name} · ${mark.phase}`;
  const labelWidth = Math.min(280, Math.max(nameText.length * 8, mark.dimensions.length * 7) + 18);
  const labelX = bounds.left - labelWidth / 2 - 8 >= 8
    ? bounds.left - labelWidth / 2 - 8 : bounds.right + labelWidth / 2 + 8;
  const vfxAim = projectSkillVfxAim(mark.vfxAim, frame, mark.bodyM.height);
  if (!vfxAim) return undefined;
  const bodyLiftCss = mark.bodyM.height * 0.5 * cssPerM;
  return {
    footprint, innerFootprint: pathOf(inner), rangePath,
    center: project(mark.center),
    vertices,
    label: { x: Math.max(labelWidth / 2 + 6, Math.min(viewport.width - labelWidth / 2 - 6, labelX)),
      y: Math.max(20, Math.min(viewport.height - 20, (bounds.top + bounds.bottom) / 2)) },
    labelWidth,
    direction: { from: project(mark.source), to: project(mark.target) },
    vfxAim,
    paths: mark.paths.map((path) => mark.chainHop
      ? { ...path, from: { x: project(path.from).x, y: project(path.from).y - bodyLiftCss },
        to: { x: project(path.to).x, y: project(path.to).y - bodyLiftCss } }
      : { ...path, from: project(path.from), to: project(path.to) }),
    bodyCss: { width: mark.bodyM.width * cssPerM, height: mark.bodyM.height * cssPerM },
  };
}

/** How long a footprint must stay drawn after impact: the skill's own effect duration
 *  (lingering ground damage, then any authored window), so the circle lives until the skill
 *  stops working instead of vanishing at the hit. Rows without a duration keep the legacy
 *  impact tail only. `dot_sec` is level-stable by contract (special_level_effects). */
export function skillMarkLingerSec(
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
  atUs: number, unitsPerSec: number, nextImpactAtUs?: number,
  opts?: { releaseM?: WorldPoint; bodyM?: BodyModelM },
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
    .map(payload => ({ index: payload.index, from: { ...payload.source },
      to: { ...(payload.impactAtUs != null && atUs >= payload.impactAtUs
        ? payload.contact ?? payload.destination : payload.destination) }, blocked: !!payload.cancelReason }));
  const until = phase === 'Windup' ? released : phase === 'Travel' ? impacted : undefined;
  const from = phase === 'Windup' ? timing?.startedAtUs ?? action.atUs : released;
  const phaseStart = phase === 'Windup' ? (timing?.startedAtUs ?? action.atUs)
    : phase === 'Travel' || phase === 'Field' || phase === 'Channel' ? released : impacted;
  const progress = until != null && until > from ? Math.max(0, Math.min(1, (atUs - from) / (until - from))) : 1;
  return geometry({ key: `action-${action.id}`, skillId: action.skillId, progress,
    sourceKind: 'cast' as const, actorId: action.actorId, actionId: action.id,
    elapsedSec: Math.max(0, (atUs - action.atUs) / unitsPerSec),
    phaseElapsedSec: Math.max(0, (atUs - phaseStart) / unitsPerSec),
    ...(until != null ? { remainingSec: Math.max(0, until - atUs) / unitsPerSec }
      // A lingering impact counts its duration down on the label instead of going silent.
      : phase === 'Impact' && lingerUntilUs > impacted
        ? { remainingSec: Math.max(0, lingerUntilUs - atUs) / unitsPerSec } : {}),
    ...(opts?.releaseM ? { releaseM: opts.releaseM } : {}),
    ...(opts?.bodyM ? { bodyM: opts.bodyM } : {}),
    name: playerSkill?.name ?? mobSkill?.name ?? action.skillId, targetName, incoming: action.actorId !== 'player',
    element: playerSkill?.element ?? mobSkill?.element ?? null,
    phase, area: footprint, source, target: footprint.shape === 'line' || footprint.shape === 'cone'
      ? { x: footprint.center.x + Math.cos(footprint.directionRad ?? 0) * (footprint.lengthM ?? footprint.radiusM),
        y: footprint.center.y + Math.sin(footprint.directionRad ?? 0) * (footprint.lengthM ?? footprint.radiusM) } : target,
    rangeM, hitRadiusM: profile?.delivery === 'projectile' ? profile.hit_radius_m : undefined,
    hopRangeM: chain ? playerSkill?.area?.radius_m : undefined, paths });
}

/** Each committed shot owns its flight and contact animation; a volley is never one moving stamp. */
export function skillPayloadGeometry(mark: SkillGeometry, action: CombatArenaAction,
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
    const releaseM = payload.index === 0 ? mark.vfxAim.releaseM : { ...payload.source };
    // Chain hops and homing samples ride body centres; the adapter lifts them.
    const releaseLiftM = payload.index === 0 ? mark.vfxAim.releaseLiftM
      : chain ? mark.bodyM.height * VFX_BODY_LIFT_SHARE : mark.vfxAim.releaseLiftM;
    const vfxAim = buildSkillVfxAimWorld(area, payload.source, target, releaseM, releaseLiftM);
    const flight = impacted ? undefined : liveFlights.find(flight => flight.actionId === action.id
      && (flight.impactIndex ?? 0) === payload.index && flight.homing);
    const sampledAtUs = flight?.lastCheckedAtUs ?? payload.releaseAtUs;
    const sampled = flight != null && atUs >= sampledAtUs;
    if (sampled) {
      const t = Math.max(0, Math.min(1, (atUs - sampledAtUs)
        / Math.max(1, flight.timing.impactAtUs - sampledAtUs)));
      const position = { x: flight.position.x + (flight.destination.x - flight.position.x) * t,
        y: flight.position.y + (flight.destination.y - flight.position.y) * t };
      vfxAim.releaseM = position;
      vfxAim.releaseLiftM = mark.bodyM.height * VFX_BODY_LIFT_SHARE;
      vfxAim.groundImpactM = { ...flight.destination };
    }
    if (chain && payload.index > 0) {
      vfxAim.releaseM = { ...payload.source };
      vfxAim.releaseLiftM = mark.bodyM.height * VFX_BODY_LIFT_SHARE;
    }
    return [{ ...mark, key: `${mark.key}-payload-${payload.index}`, source: payload.source, target,
      area, center: { ...target }, vfxAim, chainHop: chain,
      sourceKind: 'cast' as const, actorId: action.actorId, actionId: action.id, payloadIndex: payload.index,
      phase: impacted ? 'Impact' as const : 'Travel' as const,
      phaseElapsedSec: Math.max(0, (atUs - (impacted ? impactAtUs : payload.releaseAtUs)) / unitsPerSec),
      progress: impacted ? 1 : sampled ? 0 : Math.max(0, Math.min(1,
        (atUs - payload.releaseAtUs) / Math.max(1, impactAtUs - payload.releaseAtUs))),
      paths: chain ? [{ index: payload.index, from: { ...vfxAim.releaseM }, to: { ...vfxAim.groundImpactM }, blocked: false }] : [],
    }];
  });
}

export function skillAimGeometry(aim: SkillAimGeometry,
  opts?: { releaseM?: WorldPoint; bodyM?: BodyModelM }): SkillGeometry | undefined {
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
    sourceKind: 'aim' as const, actorId: 'player',
    targetName: aim.targetName ?? 'Ground', incoming: false, phase: 'Aim', element: skill.element ?? null,
    valid: aim.valid, source: aim.source, target, area, rangeM: selfSkill(skill.type) ? 0 : aim.rangeM,
    ...(opts?.releaseM ? { releaseM: opts.releaseM } : {}),
    ...(opts?.bodyM ? { bodyM: opts.bodyM } : {}),
    hitRadiusM: profile.delivery === 'projectile' ? profile.hit_radius_m : undefined,
    hopRangeM: chain ? skill.area?.radius_m : undefined });
}
