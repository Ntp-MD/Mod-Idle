import {
  ARENA_CAMERA,
  ARENA_DEFAULT_WORLD_SCALE,
  ARENA_REF_PX_PER_M,
  ARENA_VIEW,
  ARENA_ZOOM_MAX,
  ARENA_ZOOM_MIN,
  arenaTopdownBasis,
} from './arena-camera';
import {
  IDENTITY_AFFINE,
  composeAffine,
  invertAffine,
  isFiniteAffine,
  type FieldPointM,
  type Affine2,
} from './view-transform';

export type FieldViewFrame =
  | Readonly<{ renderable: false; sceneKey: string; atUs: number }>
  | Readonly<{
      renderable: true;
      sceneKey: string;
      atUs: number;
      viewportCss: { width: number; height: number };
      focusM: FieldPointM;
      anchorCss: { x: number; y: number };
      worldScale: number;
      cssPixelsPerMeter: number;
      worldToViewport: Affine2;
      viewportToWorld: Affine2;
      worldToClient: Affine2;
      clientToWorld: Affine2;
    }>;

/**
 * Single effective-scale owner for the field view.
 * Non-finite/wrong-typed scale falls back to ARENA_DEFAULT_WORLD_SCALE;
 * finite values are clamped to [ARENA_ZOOM_MIN, ARENA_ZOOM_MAX].
 * Zero/non-finite viewports are hidden (renderable: false, no matrices).
 */
export function clampWorldScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ARENA_DEFAULT_WORLD_SCALE;
  }
  return Math.max(ARENA_ZOOM_MIN, Math.min(ARENA_ZOOM_MAX, value));
}

/** Follow the displayed actor sample while retaining the host's scale and client transform. */
export function followFieldViewFrame(frame: FieldViewFrame, atUs: number, focusM: FieldPointM): FieldViewFrame {
  if (!frame.renderable) return { ...frame, atUs };
  return createFieldViewFrame({
    sceneKey: frame.sceneKey, atUs, focusM,
    viewportCss: frame.viewportCss, worldScale: frame.worldScale,
    viewportToClient: composeAffine(frame.worldToClient, frame.viewportToWorld),
  });
}

export function createFieldViewFrame(input: {
  sceneKey: string;
  atUs: number;
  viewportCss: { width: number; height: number };
  focusM: FieldPointM;
  worldScale: unknown;
  /** Optional DOM container transform viewport->client; identity by default. */
  viewportToClient?: Affine2;
  clientToViewport?: Affine2;
}): FieldViewFrame {
  const { sceneKey, atUs, viewportCss, focusM } = input;
  if (
    !Number.isFinite(viewportCss.width) ||
    !Number.isFinite(viewportCss.height) ||
    viewportCss.width <= 0 ||
    viewportCss.height <= 0 ||
    !Number.isFinite(focusM.x) ||
    !Number.isFinite(focusM.y)
  ) {
    return { renderable: false, sceneKey, atUs };
  }

  const worldScale = clampWorldScale(input.worldScale);
  const fit = viewportCss.width / ARENA_VIEW.width;
  const referencePixelsPerMeter = ARENA_REF_PX_PER_M;
  const cssPixelsPerMeter = referencePixelsPerMeter * worldScale * fit;
  const anchorCss = {
    x: viewportCss.width * ARENA_CAMERA.playerAnchor.x,
    y: viewportCss.height * ARENA_CAMERA.playerAnchor.y,
  };

  // Topdown basis flows from the single camera source: identity today (a=d=1),
  // oblique tomorrow — skill circles squash through this matrix automatically.
  const basis = arenaTopdownBasis();
  const worldToViewport: Affine2 = {
    a: basis.a * cssPixelsPerMeter,
    b: basis.b * cssPixelsPerMeter,
    c: basis.c * cssPixelsPerMeter,
    d: basis.d * cssPixelsPerMeter,
    e: anchorCss.x - (basis.a * focusM.x + basis.c * focusM.y) * cssPixelsPerMeter,
    f: anchorCss.y - (basis.b * focusM.x + basis.d * focusM.y) * cssPixelsPerMeter,
  };
  const viewportToWorldOrThrow = invertAffine(worldToViewport);
  // cssPixelsPerMeter is positive here, so the inverse always exists.
  if (!viewportToWorldOrThrow) return { renderable: false, sceneKey, atUs };

  const viewportToClient = input.viewportToClient ?? IDENTITY_AFFINE;
  if (!isFiniteAffine(viewportToClient)) return { renderable: false, sceneKey, atUs };
  const clientToViewport = input.clientToViewport ??
    invertAffine(viewportToClient);
  // A singular/degenerate container has no usable inverse: never paint or pick
  // through it on a silently substituted identity.
  if (!clientToViewport || !isFiniteAffine(clientToViewport)) return { renderable: false, sceneKey, atUs };
  const worldToClient = composeAffine(viewportToClient, worldToViewport);
  const clientToWorld = composeAffine(viewportToWorldOrThrow, clientToViewport);
  if (!isFiniteAffine(worldToClient) || !isFiniteAffine(clientToWorld)) {
    return { renderable: false, sceneKey, atUs };
  }

  return {
    renderable: true,
    sceneKey,
    atUs,
    viewportCss: { width: viewportCss.width, height: viewportCss.height },
    focusM,
    anchorCss: { ...anchorCss },
    worldScale,
    cssPixelsPerMeter,
    worldToViewport,
    viewportToWorld: viewportToWorldOrThrow,
    worldToClient,
    clientToWorld,
  };
}
