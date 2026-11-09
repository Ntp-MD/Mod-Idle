import type { CombatArena, CombatArenaAction, CombatArenaActor } from '@sim/combat/combat-arena';
import type { GameState, Mob } from '@sim/core/types';
import type { Character } from '@sim/core/player';
import { E, sm } from '../../engine/client';
import { elementIcon } from '../../icon';
import { statusLabel } from '@sim/combat/mobStatus';
import { mobSkillById } from '@sim/combat/mobSkills';
import { arenaMobShape, arenaSkillShape } from '../fx';
import { playerEquipmentLayers, type ArenaEquipmentLayer } from './arena/arena-equipped-player';
import { arenaArtExtent, type ArenaCharacterArt, type ArenaSourceFrame, type ArenaSpriteFrameImage, type ArenaSpriteSheet } from './arena/arena-art';
import { type ActorArt } from './combat-actor';
import {
  ARENA_CULL_MARGIN_X,
  ARENA_CULL_MARGIN_Y,
  arenaActionPose,
  arenaActorAction,
  arenaFacingSector,
  arenaPhaseOffset,
  arenaScreenAngleFor,
  arenaSheetDirection,
  arenaSpriteFrame,
  arenaSpriteIndex,
  type ArenaGaitSample,
} from './combat-arena-view';
import { ARENA_DEFAULT_BODY_RADIUS_M, ARENA_DIRECTIONS, ARENA_REF_PX_PER_M } from '../../presentation/arena-camera';
import { applyWorldToViewport, fieldPointM, type FieldVectorM } from '../../presentation/view-transform';
import type { FieldViewFrame } from '../../presentation/arena-view-frame';
import {
  fallbackBodyVisual,
  normalizeArenaBody,
  resolveFrameScale,
  type BodyVisual,
} from './arena/arena-body-model';
import { actorHitFrom, combatCastProgress, type ActorHitIndex, type CombatFeedbackPop } from './combat-feedback';

/**
 * Pure actor-view builder for the field scene (WP3).
 *
 * The scene owns DOM/SVG and emits intents; this module owns actor math:
 * WP2 body models (root-relative metres) + the painted frame (world metres
 * to viewport CSS). It moves the scene's former `actorView()` logic without
 * adding a scene graph, per-species branches or gameplay reads.
 *
 * Units: world input in metres, sizes out in viewport CSS pixels plus the
 * model-metre envelope (`bodyM`) that release/feedback/VFX adapters convert
 * once at their own boundary. Nothing here reads DOM sizes or divides by a
 * viewport scale; the frame's `cssPixelsPerMeter` is the one multiplier.
 */

/** Reference pixels per metre: the shared presentation calibration (single topdown source). */
export const REF_PX_PER_M = ARENA_REF_PX_PER_M;

/** Shadow style ratio: reference appearance was 23 ref px at the default body radius. One owner. */
export const SHADOW_WIDTH_RATIO = (23 / REF_PX_PER_M) / (2 * ARENA_DEFAULT_BODY_RADIUS_M);
/** Lunge in world metres from ref-px authorship through the single density. */
const LUNGE_SLASH_M = 8 / REF_PX_PER_M;
const LUNGE_BACK_M = -3 / REF_PX_PER_M;

/** Failure/readability tail owners (DR7): never a gameplay timer, never a hit time. */
export const ACTOR_OPACITY_TAIL_SEC = 1.7;
export const DEATH_ROTATION_SEC = 0.32;
export const FEEDBACK_WINDOW_SEC = 0.72;
export const FEEDBACK_RISE_PX_PER_SEC = 43;

export function shadowWidthM(radiusM: number): number {
  const radius = Number.isFinite(radiusM) && radiusM > 0 ? radiusM : ARENA_DEFAULT_BODY_RADIUS_M;
  return 2 * radius * SHADOW_WIDTH_RATIO;
}

export interface ActorViewInput {
  arena: CombatArena;
  actor: CombatArenaActor & { diedAtUs?: number };
  /** Sprite art resolved by the scene (failed/loading art is already null here). */
  art: ArenaCharacterArt | null;
  /** Normalized WP2 model for `art` (or the fallback icon contract when art is null). */
  body: BodyVisual;
  assetId: string;
  radiusM: number;
  bodySize: string;
  fallback: ActorArt;
  frame: FieldViewFrame;
  /** Combat playhead in microseconds. */
  atUs: number;
  gaitSample: ArenaGaitSample | undefined;
  actorHits: ActorHitIndex;
  reducedMotion: boolean;
  /** Present only for the player: equipment and contact-pose reads. */
  playerCtx: { state: GameState; character: Character } | null;
}

export interface ActorView {
  actor: CombatArenaActor & { diedAtUs?: number };
  /** Feet in world metres; depth sort reads this, never a projected axis. */
  ground: { x: number; y: number };
  action: CombatArenaAction | undefined;
  threat: boolean;
  art: ArenaCharacterArt | null;
  sheet: ArenaSpriteSheet | undefined;
  standaloneFrame: ArenaSpriteFrameImage | undefined;
  equipmentLayers: ArenaEquipmentLayer[];
  anchor: { x: number; y: number };
  fallback: ActorArt;
  /** Sprite box in viewport CSS pixels. */
  height: number;
  width: number;
  bodyScale: number;
  walkPhase: number;
  sourceHitElapsedMs: number | undefined;
  castProgress: ReturnType<typeof combatCastProgress>;
  /** Model-metre envelope of the drawn body (root-relative). Adapters convert once. */
  bodyM: { width: number; height: number };
  /** Mirror-aware release socket in model metres, or undefined when the sheet has none. */
  socketM: FieldVectorM | undefined;
  nameplateHeight: number;
  hitboxWidth: number;
  age: number;
  cue: { name?: string } | null | undefined;
  statuses: { name: string; stacks: number; secLeft: number; label: string; icon: string; colour: string }[];
  clipName: string;
  sourceFrame: (ArenaSourceFrame & { offsetX: number; offsetY: number }) | undefined;
  mirror: boolean;
  frame: string;
  /** Feet in viewport CSS pixels; the scene adds the camera-wrapper cancellation. */
  x: number;
  y: number;
  bodyX: number;
  bodyY: number;
  brightness: number;
  opacity: number;
  deadRotation: number;
  /** Shadow width in viewport CSS pixels. */
  shadowCss: number;
  /** Cast-bar lift above the nameplate in viewport CSS pixels. */
  castLiftCss: number;
}

/** A source crop kept inside the runtime cell and the image (moved from the scene, unchanged). */
export function containedFrame(sheet: ArenaSpriteSheet | undefined, index: number, standalone?: ArenaSpriteFrameImage) {
  const frame = standalone?.sourceFrame ?? sheet?.sourceFrames?.[index];
  if (!frame || !sheet) return undefined;
  const imageWidth = standalone?.imageWidth ?? sheet.imageWidth ?? sheet.frameWidth * sheet.columns;
  const imageHeight = standalone?.imageHeight ?? sheet.imageHeight ?? sheet.frameHeight * sheet.rows;
  let x = frame.x, y = frame.y, width = frame.width, height = frame.height;
  let offsetX = frame.offsetX, offsetY = frame.offsetY;
  if (offsetX < 0) { x -= offsetX; width += offsetX; offsetX = 0; }
  if (offsetY < 0) { y -= offsetY; height += offsetY; offsetY = 0; }
  width = Math.max(1, Math.min(width, sheet.frameWidth - offsetX, imageWidth - x));
  height = Math.max(1, Math.min(height, sheet.frameHeight - offsetY, imageHeight - y));
  return { ...frame, x, y, width, height, offsetX, offsetY };
}

/** Presentation style of one action (moved from the scene, unchanged). */
export function actionStyleFor(action: CombatArenaAction, mob: Mob | undefined, playerCtx: { character: Character } | null) {
  if (mob) {
    const skill = action.skillId ? mobSkillById(action.skillId) : null;
    return arenaMobShape(skill, mob);
  }
  const skill = action.skillId ? sm.byId[action.skillId] : null;
  const character = playerCtx?.character;
  return arenaSkillShape(skill, character ? sm.weaponGroupOf(character.weaponName) : 'melee', character?.weaponElement);
}

/**
 * Memoized WP2 boundary reads: one normalize per (art, radius, size).
 * Scale/zoom/skin changes reuse the model; `normalizeCalls` instruments
 * A12 (no per-actor rebuild on scale change).
 */
export function createActorBodyCache() {
  const byArt = new WeakMap<ArenaCharacterArt, Map<string, BodyVisual>>();
  const fallbackByKey = new Map<string, BodyVisual>();
  let normalizeCalls = 0;
  const key = (assetId: string, radiusM: number, bodySize: string) =>
    `${assetId}|${radiusM}|${bodySize}`;
  return {
    get normalizeCalls() { return normalizeCalls; },
    modelFor(art: ArenaCharacterArt | null, opts: { assetId: string; radiusM: number; bodySize: string }): BodyVisual {
      const radiusM = Number.isFinite(opts.radiusM) && (opts.radiusM as number) > 0 ? opts.radiusM : ARENA_DEFAULT_BODY_RADIUS_M;
      if (!art) {
        const cacheKey = key(opts.assetId, radiusM, opts.bodySize);
        const hit = fallbackByKey.get(cacheKey);
        if (hit) return hit;
        normalizeCalls += 1;
        const body = fallbackBodyVisual(opts.assetId, radiusM, opts.bodySize);
        fallbackByKey.set(cacheKey, body);
        return body;
      }
      let inner = byArt.get(art);
      if (!inner) { inner = new Map(); byArt.set(art, inner); }
      const cacheKey = key(opts.assetId, radiusM, opts.bodySize);
      const hit = inner.get(cacheKey);
      if (hit) return hit;
      normalizeCalls += 1;
      const body = normalizeArenaBody(art, { assetId: opts.assetId, radiusM, bodySize: opts.bodySize });
      inner.set(cacheKey, body);
      return body;
    },
    /** WeakMap entries drop with their art; only the fallback map needs clearing. */
    clear() { fallbackByKey.clear(); },
  };
}

export type ActorBodyCache = ReturnType<typeof createActorBodyCache>;

/** Model envelope for culling/lifts without building a full view or measuring DOM. */
export function bodyEnvelopeM(body: BodyVisual): { width: number; height: number } {
  return { width: body.referenceWidthM.value, height: body.referenceHeightM.value };
}

/** Model height used for attachment lifts; trimmed reference height, never the runtime cell padding. */
export function bodyLiftM(body: BodyVisual): number {
  return body.referenceHeightM.value;
}

function playerDeathTime(arena: CombatArena, playhead: number): number | undefined {
  let diedAtUs: number | undefined;
  for (const frame of arena.frames) {
    if (frame.atUs > playhead) break;
    if (frame.player.hp > 0) diedAtUs = undefined;
    else diedAtUs ??= frame.atUs;
  }
  return diedAtUs;
}

export function buildActorView(input: ActorViewInput): ActorView {
  const { arena, art, body, fallback, frame, atUs, gaitSample, actorHits, reducedMotion, playerCtx } = input;
  const unitsPerSec = arena.unitsPerSec;
  let { actor } = input;
  if (actor.id === 'player' && actor.hp <= 0 && actor.hpMax > 0 && actor.diedAtUs == null) {
    actor = { ...actor, diedAtUs: playerDeathTime(arena, atUs) };
  }
  const cssPerM = frame.renderable ? frame.cssPixelsPerMeter : 0;
  const perRef = frame.renderable ? frame.cssPixelsPerMeter / REF_PX_PER_M : 0;
  const feet = frame.renderable
    ? applyWorldToViewport(frame.worldToViewport, fieldPointM(actor.x, actor.y))
    : { x: 0, y: 0 };
  // One nominal projected sector per actor; each clip then falls back to the sheets it owns.
  const nominal = arenaFacingSector(actor.facing,
    actor.facingSector == null ? undefined : ARENA_DIRECTIONS[actor.facingSector]);
  const sheetFor = (clip: ArenaCharacterArt['clips']['idle'] | undefined) =>
    clip?.[arenaSheetDirection(nominal, clip)];
  const sheetEntry = (clip: ArenaCharacterArt['clips']['idle'] | undefined) => {
    if (!clip) return undefined;
    const direction = arenaSheetDirection(nominal, clip);
    const sheet = clip[direction];
    return sheet ? { direction, sheet } : undefined;
  };
  const dead = actor.diedAtUs != null;
  const action = dead ? undefined : arenaActorAction(arena, actor, atUs, art?.clips.attack);
  const attackSheet = sheetFor(art?.clips.attack);
  const pose = action ? arenaActionPose(action, atUs, unitsPerSec, attackSheet) : undefined;
  const gaitPhase = actor.diedAtUs == null ? gaitSample : undefined;
  // A stopped actor holds its last foot beat briefly instead of snapping to idle mid-step.
  const settle = !actor.moving && !!gaitPhase
    && atUs - gaitPhase.lastMovedAtUs < 90 * unitsPerSec / 1000;
  const deathSheet = sheetFor(art?.clips.death);
  const hitSheet = sheetFor(art?.clips.hit);
  const hitDurationMs = hitSheet ? hitSheet.frames * hitSheet.frameMs : 0;
  const hit = actorHitFrom(actorHits, actor.id, Math.max(160, hitDurationMs));
  const hitElapsedMs = hit ? (atUs - eventTime(hit, unitsPerSec)) / unitsPerSec * 1000 : 0;
  // A light reaction may replace recovery, but never protected preparation, release or contact.
  const showHit = hit && hitElapsedMs < hitDurationMs
    && (!pose || pose.phase === 'recovery');
  const clipName = dead ? deathSheet ? 'death' : 'idle'
    : showHit ? 'hit' : pose ? 'attack' : actor.moving || settle ? 'walk' : 'idle';
  const clipEntry = sheetEntry(art?.clips[clipName]);
  const idleEntry = sheetEntry(art?.clips.idle);
  // The drawn sheet owns the release: an attack clip with no usable sheet falls
  // back to the idle record, so the key follows the picked record, not the clip.
  const picked = clipEntry?.sheet
    ? { clip: clipName, direction: clipEntry.direction, sheet: clipEntry.sheet }
    : idleEntry?.sheet
      ? { clip: 'idle', direction: idleEntry.direction, sheet: idleEntry.sheet }
      : undefined;
  const sheet = picked?.sheet;
  const anchor = sheet?.anchor ?? (sheet ? art?.anchor : null) ?? { x: .5, y: 1 };
  // Broken art with no usable sheet renders the fallback icon contract, never a guessed size.
  const visual = sheet ? body : fallbackBodyVisual(input.assetId, input.radiusM, input.bodySize, body.problems);
  const unitPx = visual.metresPerPixel * cssPerM;
  const projectedHeight = unitPx * fallback.imageHeight;
  // Keep the half-meter idle footprint stable through movement and camera depth.
  const restSheet = sheetFor(art?.clips.idle) ?? sheet;
  const restFrame = containedFrame(restSheet, restSheet?.startFrame ?? 0);
  const referenceSheet = art?.clips.idle.south ?? Object.values(art?.clips.idle ?? {})[0] ?? restSheet;
  const bodyReference = containedFrame(referenceSheet, referenceSheet?.startFrame ?? 0) ?? restFrame;
  const restAnchor = restSheet?.anchor ?? art?.anchor ?? anchor;
  // Clips have different cell heights (an attack raises a fist, a death flattens the body).
  // Measuring on the idle silhouette keeps the creature the same size when the clip changes.
  const pixelScale = art?.pixelArt && restSheet && bodyReference ? unitPx : null;
  const height = pixelScale != null && sheet ? pixelScale * sheet.frameHeight : projectedHeight;
  const width = height * (sheet ? sheet.frameWidth / sheet.frameHeight : fallback.imageWidth / fallback.imageHeight);
  // The nameplate rides above the tallest authored frame, not the idle pose, so an attack or a
  // raised weapon never grows through the plate.
  const extent = arenaArtExtent(art);
  const artTop = extent?.top ?? restFrame?.offsetY ?? 0;
  const nameplateHeight = pixelScale != null && restSheet
    ? (restAnchor.y * restSheet.frameHeight - artTop) * pixelScale
    : restSheet
      ? (restAnchor.y * restSheet.frameHeight - artTop) * height / restSheet.frameHeight
      : height;
  // One frame for both: the plate and the click target cover every authored frame, so a raised
  // weapon or a wide attack can never stick outside the hitbox.
  const anchorX = restAnchor.x * (restSheet?.frameWidth ?? 0);
  const artReach = extent && restSheet
    ? Math.max(anchorX - extent.left, extent.right - anchorX)
    : (restFrame?.width ?? width) / 2;
  const hitboxWidth = restSheet
    ? Math.max(58, artReach * 2 * (pixelScale ?? height / restSheet.frameHeight))
    : width * .75;
  const age = actor.diedAtUs == null ? 0 : Math.max(0, (atUs - actor.diedAtUs) / unitsPerSec);
  const attackElapsedMs = pose?.elapsedMs ?? 0;
  const attackDurationMs = attackSheet ? attackSheet.frames * attackSheet.frameMs : 520;
  const impactMs = attackSheet?.impactMs ?? 340;
  const aimX = action?.targetX ?? actor.x;
  const aimY = action?.targetY ?? actor.y;
  const angle = Math.atan2(aimY - actor.y, aimX - actor.x);
  // The lunge belongs to the active strike, not to the walk, the preparation or a held channel.
  const lunge = pose?.phase === 'contact' ? 1
    : pose?.phase === 'recovery' && !action?.channel
      ? Math.max(0, 1 - (attackElapsedMs - impactMs) / Math.max(1, attackDurationMs - impactMs))
      : 0;
  const reachM = art?.pixelArt || reducedMotion || !pose || clipName !== 'attack'
    ? 0 : lunge * (actionStyleFor(action!, actor.mob, playerCtx) === 'slash' ? LUNGE_SLASH_M : LUNGE_BACK_M);
  const cue = action?.skillId ? (actor.mob ? mobSkillById(action.skillId) : sm.byId[action.skillId]) : null;
  const statuses = Object.entries(actor.statuses || {}).filter(([, line]) => line.stacks > 0 || line.secLeft > 0).map(([name, line]) => {
    const element = Object.entries(E.elements.status_of as Record<string, string>).find(([, status]) => status === name)?.[0] || 'physical';
    return { name, stacks: line.stacks, secLeft: Math.max(0, Math.ceil(line.secLeft)), label: statusLabel(name), icon: elementIcon(element),
      colour: (E.elements.colour as Record<string, string>)[element] || E.elements.physical_colour };
  });
  // Walk phase comes from voluntary distance; idle keeps a stable per-actor offset.
  const walkSheet = sheetFor(art?.clips.walk);
  const walkCycleMs = walkSheet ? walkSheet.frames * walkSheet.frameMs : 0;
  const idleCycleMs = restSheet ? restSheet.frames * restSheet.frameMs : 1000;
  const walkPhase = clipName === 'walk' && gaitPhase ? gaitPhase.phase : 0;
  const idleOffset = arenaPhaseOffset(actor.id) * idleCycleMs;
  const elapsedMs = clipName === 'death' ? age * 1000 : clipName === 'hit' ? hitElapsedMs
    : pose ? attackElapsedMs
    : clipName === 'walk' && walkCycleMs > 0 ? walkPhase * walkCycleMs
    : atUs / unitsPerSec * 1000 + idleOffset;
  const frameIndex = sheet ? arenaSpriteIndex(sheet, elapsedMs, reducedMotion, clipName === 'death') : 0;
  const standaloneFrame = sheet?.frameImages?.[frameIndex];
  // Tight-crop sheets index one authored rect per frame; an overrun must clamp to that list, never
  // fall back to a cell crop that would pull neighbouring frames into view.
  const sourceFrameCount = standaloneFrame ? sheet?.frameImages?.length ?? 0 : sheet?.sourceFrames?.length ?? 0;
  const sourceFrame = sourceFrameCount
    ? containedFrame(sheet, Math.min(frameIndex, sourceFrameCount - 1), standaloneFrame)
    : undefined;
  // Correct body-size drift in the authored player images. Scale about this clip's measured
  // foot/root anchor; death frames use their own fallen-pose reference above.
  const bodyScale = resolveFrameScale(art, clipName, sourceFrame?.height);
  const equipmentFrame = standaloneFrame ?? (sheet?.mainGripCell || sheet?.offGripCell
    ? { mainGripCell: sheet.mainGripCell, offGripCell: sheet.offGripCell } : undefined);
  const equipmentLayers: ArenaEquipmentLayer[] = actor.id === 'player' && equipmentFrame && !standaloneFrame?.equipmentBaked && playerCtx
    ? playerEquipmentLayers({ state: playerCtx.state, character: playerCtx.character, frame: equipmentFrame,
      // The parent applies bodyScale after item placement, so size gear against this frame's
      // source height; both body and equipment then land at the same normalized scale.
      bodyHeight: sourceFrame?.height ?? restFrame?.height ?? 0, clip: clipName, phase: pose?.phase, facing: actor.facing })
    : [];
  const bodyUnit = pixelScale ?? height / (sheet?.frameHeight ?? 1);
  const bodyHeightCss = sheet && restFrame ? restFrame.height * bodyUnit * bodyScale : height;
  const bodyWidthCss = sheet && restFrame ? restFrame.width * bodyUnit * bodyScale : width;
  // Model metres are the source: metresPerPixel × trimmed reference size.
  // Never divide a CSS output by cssPerM (hidden frame would zero the envelope).
  const bodyM = sheet && restFrame
    ? {
      width: restFrame.width * visual.metresPerPixel * bodyScale,
      height: restFrame.height * visual.metresPerPixel * bodyScale,
    }
    : { width: visual.referenceWidthM.value, height: visual.referenceHeightM.value };
  const socketM: FieldVectorM | undefined = picked
    ? visual.releaseSocketsM[`${picked.clip}:${picked.direction}`] : undefined;
  // A basic swing already leaving the mob is the one tell the cast bar never covers.
  const threat = !!action && action.kind === 'swing' && !action.skillId && action.targetId === 'player'
    && (action.timing ? atUs < action.timing.impactAtUs : atUs < action.endsAtUs);
  return { actor, ground: { x: actor.x, y: actor.y }, action, threat, art, sheet, standaloneFrame, equipmentLayers, anchor, fallback, height, width, bodyScale,
    walkPhase, sourceHitElapsedMs: showHit ? hitElapsedMs : undefined,
    castProgress: combatCastProgress(action, atUs, unitsPerSec),
    bodyM, socketM,
    nameplateHeight, hitboxWidth, age, cue, statuses, clipName, sourceFrame, mirror: Boolean(sheet?.mirror),
    frame: sourceFrame && sheet ? `0 0 ${sheet.frameWidth} ${sheet.frameHeight}`
      : sheet ? arenaSpriteFrame(sheet, elapsedMs, reducedMotion, clipName === 'death') : '',
    x: art?.pixelArt ? Math.round(feet.x) : feet.x,
    y: art?.pixelArt ? Math.round(feet.y) : feet.y,
    bodyX: art?.pixelArt ? Math.round(Math.cos(angle) * reachM * cssPerM) : Math.cos(angle) * reachM * cssPerM,
    bodyY: art?.pixelArt ? Math.round(Math.sin(angle) * reachM * cssPerM) : Math.sin(angle) * reachM * cssPerM,
    brightness: hit && hitElapsedMs < 160 ? 1.6 : 1,
    opacity: actor.diedAtUs == null || actor.id === 'player' ? 1 : Math.max(0, 1 - age / ACTOR_OPACITY_TAIL_SEC),
    deadRotation: actor.diedAtUs == null || deathSheet || reducedMotion ? 0
      : Math.min(1, age / DEATH_ROTATION_SEC) * (Math.cos(arenaScreenAngleFor({ x: Math.cos(actor.facing), y: Math.sin(actor.facing) })) < 0 ? -78 : 78),
    shadowCss: shadowWidthM(input.radiusM) * cssPerM,
    castLiftCss: nameplateHeight + 28 * perRef,
  };
}

function eventTime(event: Pick<CombatFeedbackPop, 'atUs' | 'sec'>, unitsPerSec: number) {
  return event.atUs ?? event.sec * unitsPerSec;
}

/**
 * Model-world release anchor: feet plus the mirror-aware socket in metres.
 * The scene converts once for ref-space readers; gameplay never sees pixels.
 */
export function actorReleaseWorld(view: Pick<ActorView, 'actor' | 'socketM'>): { x: number; y: number } | undefined {
  if (!view.socketM) return undefined;
  return { x: view.actor.x + view.socketM.x, y: view.actor.y + view.socketM.y };
}

/** Actor depth band: stacking context of the scene (ground 0, effects 1200, review 5000). */
export const ACTOR_DEPTH_MIN = 1;
export const ACTOR_DEPTH_MAX = 1099;

function compareStableId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Deterministic depth order: ground y, then x, then stable actor id. Never locale or array order. */
export function compareActorGround(
  a: { actor: { id: string }; ground: { x: number; y: number } },
  b: { actor: { id: string }; ground: { x: number; y: number } },
): number {
  return a.ground.y - b.ground.y || a.ground.x - b.ground.x || compareStableId(a.actor.id, b.actor.id);
}

export function sortActorViews<T extends { actor: { id: string }; ground: { x: number; y: number } }>(views: readonly T[]): T[] {
  return [...views].sort(compareActorGround);
}

/**
 * Rank actors into the depth band by ground order. Fails explicitly if the scene
 * cannot fit (never silently clamps several ranks onto one z-index).
 */
export function actorDepthRanks(views: readonly { actor: { id: string }; ground: { x: number; y: number } }[]): Map<string, number> {
  const ordered = sortActorViews(views);
  const ranks = new Map<string, number>();
  for (const [index, view] of ordered.entries()) {
    const rank = ACTOR_DEPTH_MIN + index;
    if (rank > ACTOR_DEPTH_MAX) throw new RangeError(`arena: actor depth band holds ${ACTOR_DEPTH_MAX - ACTOR_DEPTH_MIN + 1} actors, got ${ordered.length}`);
    ranks.set(view.actor.id, rank);
  }
  return ranks;
}

/**
 * Cheap pre-filter through the painted frame; pinned bodies always stay.
 * When draw bounds are supplied the check is against the projected
 * drawBoundsM corners (expanded by a separate UI-overhang budget), never
 * a centre point alone, so an off-screen root with on-screen art stays.
 * Point-only callers keep the legacy ref-px margin fallback.
 */
export const ACTOR_CULL_OVERHANG_M = 0.5;

export function actorVisibleInFrame(
  frame: FieldViewFrame, point: { x: number; y: number }, pinned = false,
  drawBoundsM?: { left: number; top: number; right: number; bottom: number } | null,
): boolean {
  if (pinned) return true;
  if (!frame.renderable) return false;
  const css = applyWorldToViewport(frame.worldToViewport, fieldPointM(point.x, point.y));
  const perRef = frame.cssPixelsPerMeter / REF_PX_PER_M;
  const marginX = ARENA_CULL_MARGIN_X * perRef;
  const marginY = ARENA_CULL_MARGIN_Y * perRef;
  const pointVisible = css.x > -marginX && css.x < frame.viewportCss.width + marginX
    && css.y > -marginY && css.y < frame.viewportCss.height + marginY;
  if (!drawBoundsM) return pointVisible;
  // Bounds path is conservative: the projected draw box (expanded by the overhang
  // budget) overlapping the viewport keeps the actor. Rectangle overlap also keeps
  // a large body whose four corners all sit outside but whose art covers the view.
  // Never cull on alpha/DOM.
  const m = ACTOR_CULL_OVERHANG_M;
  const corners = [
    { x: point.x + drawBoundsM.left - m, y: point.y + drawBoundsM.top - m },
    { x: point.x + drawBoundsM.right + m, y: point.y + drawBoundsM.top - m },
    { x: point.x + drawBoundsM.left - m, y: point.y + drawBoundsM.bottom + m },
    { x: point.x + drawBoundsM.right + m, y: point.y + drawBoundsM.bottom + m },
  ];
  const projected = corners.map((corner) =>
    applyWorldToViewport(frame.worldToViewport, fieldPointM(corner.x, corner.y)));
  const left = Math.min(...projected.map((p) => p.x));
  const right = Math.max(...projected.map((p) => p.x));
  const top = Math.min(...projected.map((p) => p.y));
  const bottom = Math.max(...projected.map((p) => p.y));
  const overlaps = right >= 0 && left <= frame.viewportCss.width
    && bottom >= 0 && top <= frame.viewportCss.height;
  return overlaps || pointVisible;
}
