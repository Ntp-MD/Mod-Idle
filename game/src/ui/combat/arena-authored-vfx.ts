import batchManifest from './fx-manifests/batch-manifest.json';
import spatialManifest from './fx-manifests/spatial-v2-manifest.json';
import meteorComponents from './fx-manifests/components-v2-manifest.json';
import type { VfxFootprint } from './arena-vfx-space';
import { projectArenaPoint } from './combat-arena-view';

export type AuthoredVfx = {
  src: string;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  anchorY: number;
  anchorX?: number;
  impactAnchorX?: number;
  impactAnchorY?: number;
  opening: readonly [number, number];
  loop: readonly [number, number];
  exit: readonly [number, number];
  frameMs: number;
  imageWidth?: number;
  imageHeight?: number;
  frames?: readonly { index: number; rect: readonly number[]; offsetX?: number; offsetY?: number; bounds?: readonly number[] | null }[];
  virtualWidth?: number;
  virtualHeight?: number;
  alphaDiscard?: number;
  delivery?: 'projectile' | 'melee' | 'instant' | 'ground';
  origin?: 'caster' | 'target';
  orient?: boolean;
  groundOrigin?: boolean;
  contentWidthRatio?: number;
  contentHeightRatio?: number;
  spatial?: {
    composition: 'whole-field' | 'whole-sector' | 'projectile-component';
    layer: 'ground' | 'front';
    spanM: number;
  };
};

/** Preserved production presets and PNGs, available for reuse or rollback. */
export const LEGACY_AUTHORED_VFX: Record<string, AuthoredVfx> = {
  'attack.fireball': {
    src: '/fx/authored/attack-fireball/v1/atlas-v2.png',
    columns: 4, rows: 4, cellWidth: 313.5, cellHeight: 313.5,
    anchorY: .5, opening: [0, 3], loop: [4, 11], exit: [12, 15], frameMs: 80,
    delivery: 'projectile', origin: 'target', orient: true,
  },
  'attack.firestorm': {
    src: '/fx/authored/attack-firestorm/v1/atlas-v1.png',
    columns: 4,
    rows: 4,
    cellWidth: 352,
    cellHeight: 352,
    anchorY: .9,
    opening: [0, 3],
    loop: [4, 11],
    exit: [12, 15],
    frameMs: 80,
  },
  // The production checker validates the complete batch before this manifest is promoted.
  ...(batchManifest as unknown as Record<string, AuthoredVfx>),
};

const groundArt = new Set(['attack.ground_slam', 'attack.earth_shock', 'attack.aftershock', 'attack.void_blast', 'attack.shatter', 'attack.overload']);
const spatialEntries = spatialManifest.entries as unknown as Record<string, AuthoredVfx & {
  composition: NonNullable<AuthoredVfx['spatial']>['composition']; authoringGeometry: {spanM:number};
}>;
export const AUTHORED_VFX: Record<string, AuthoredVfx> = {
  ...LEGACY_AUTHORED_VFX,
  ...Object.fromEntries(Object.entries(spatialEntries).map(([id, art]) => [id, {
    ...LEGACY_AUTHORED_VFX[id], ...art,
    anchorX: art.anchorX ?? .5,
    anchorY: art.anchorY ?? .72,
    delivery: id === 'attack.arrow_shower' ? 'projectile' : 'ground',
    orient: id === 'attack.arrow_shower',
    spatial: { composition: art.composition, layer: groundArt.has(id) ? 'ground' : 'front', spanM: art.authoringGeometry.spanM },
  } satisfies AuthoredVfx])),
};

export function authoredVfxFor(id: string, version: 'current' | 'legacy' = 'current') {
  return (version === 'legacy' ? LEGACY_AUTHORED_VFX : AUTHORED_VFX)[id];
}

export type AuthoredComponent = {
  key: string;
  role: 'fall' | 'trail' | 'impact';
  sizeM: number;
  sizeAxis: 'width' | 'height';
  art: AuthoredVfx;
};
export type AuthoredComposition = {
  version: string;
  skillId: string;
  distribution: { rings: { radius: number; count: number }[] };
  motion: { directionScreen: readonly [number, number]; durationSec: readonly [number, number];
    travelM: readonly [number, number]; sourceForwardScreen: readonly [number, number] };
  components: AuthoredComponent[];
};

/** Invalid candidates leave the selected working atlas available. PNG checks run before promotion. */
export function validAuthoredComposition(input: unknown): input is AuthoredComposition {
  if (!input || typeof input !== 'object') return false;
  const value = input as AuthoredComposition;
  if (!Array.isArray(value.components) || !Array.isArray(value.distribution?.rings)) return false;
  const motion = value.motion;
  if (!motion || ![motion.directionScreen, motion.durationSec, motion.travelM, motion.sourceForwardScreen]
    .every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite))
    || Math.hypot(...motion.directionScreen) === 0 || Math.hypot(...motion.sourceForwardScreen) === 0
    || motion.durationSec[0] <= 0 || motion.durationSec[1] < motion.durationSec[0]
    || motion.travelM[0] <= 0 || motion.travelM[1] < motion.travelM[0]) return false;
  return typeof value.version === 'string' && typeof value.skillId === 'string' && value.components.length === 3
    && value.components.every(component => component && ['fall', 'trail', 'impact'].includes(component.role))
    && new Set(value.components.map(component => component.role)).size === 3
    && value.distribution.rings.every(ring => ring && Number.isFinite(ring.radius) && ring.radius >= 0
      && ring.radius < 1 && Number.isInteger(ring.count) && ring.count > 0 && ring.count <= 32)
    && value.components.every(component => Number.isFinite(component.sizeM) && component.sizeM > 0
      && ['width', 'height'].includes(component.sizeAxis) && !!component.art
      && typeof component.art.src === 'string' && component.art.src.startsWith('/fx/authored/')
      && Number.isFinite(component.art.frameMs) && component.art.frameMs > 0
      && Number.isFinite(component.art.virtualWidth) && component.art.virtualWidth! > 0
      && Number.isFinite(component.art.virtualHeight) && component.art.virtualHeight! > 0
      && Number.isFinite(component.art.contentWidthRatio) && component.art.contentWidthRatio! > 0
      && Number.isFinite(component.art.contentHeightRatio) && component.art.contentHeightRatio! > 0
      && Number.isFinite(component.art.anchorX) && Number.isFinite(component.art.anchorY)
      && Array.isArray(component.art.frames) && component.art.frames.length > 0
      && component.art.frames.length === component.art.columns * component.art.rows
      && [component.art.opening, component.art.loop, component.art.exit].every(range => Array.isArray(range)
        && range.length === 2 && Number.isInteger(range[0]) && Number.isInteger(range[1])
        && range[0] >= 0 && range[0] <= range[1] && range[1] < component.art.frames!.length)
      && new Set(component.art.frames.map(frame => frame?.index)).size === component.art.frames.length
      && component.art.frames.every((frame, index) => frame && frame.index === index && Array.isArray(frame.rect) && frame.rect.length === 4 && frame.rect.every(Number.isFinite)
        && frame.rect[0] >= 0 && frame.rect[1] >= 0 && frame.rect[2] > 0 && frame.rect[3] > 0
        && frame.rect[0] + frame.rect[2] <= (component.art.imageWidth ?? 0)
        && frame.rect[1] + frame.rect[3] <= (component.art.imageHeight ?? 0)
        && Number.isFinite(frame.offsetX) && Number.isFinite(frame.offsetY)
        && frame.offsetX! >= 0 && frame.offsetY! >= 0
        && frame.offsetX! + frame.rect[2] <= component.art.virtualWidth!
        && frame.offsetY! + frame.rect[3] <= component.art.virtualHeight!));
}

const componentCandidates = [meteorComponents as unknown as AuthoredComposition];
export function authoredCompositionFor(id: string) {
  return componentCandidates.find(composition => composition.skillId === id && validAuthoredComposition(composition));
}

/** Stratified sites depend only on the action seed and committed footprint, including empty ground. */
export function authoredComponentSites(composition: AuthoredComposition, area: VfxFootprint, seed: number) {
  const angleOffset = ((Math.imul(seed | 0, 2654435761) >>> 0) / 4294967296) * Math.PI * 2;
  return composition.distribution.rings.flatMap((ring, ringIndex) => Array.from({ length: ring.count }, (_, index) => {
    const angle = angleOffset + index / ring.count * Math.PI * 2 + ringIndex * .73;
    const x = Math.cos(angle) * ring.radius, y = Math.sin(angle) * ring.radius;
    return { x: area.center.x + x * area.basisX.x + y * area.basisY.x,
      y: area.center.y + x * area.basisX.y + y * area.basisY.y,
      phase: ((index * 7 + ringIndex * 3 + (seed | 0)) % 16 + 16) % 16 };
  }));
}

export type AuthoredComponentSite = ReturnType<typeof authoredComponentSites>[number];

export function authoredCompositionDuration(composition: AuthoredComposition) {
  return Math.max(...composition.components.filter(component => component.role === 'impact')
    .map(component => (component.art.frames!.length - component.art.loop[0]) * component.art.frameMs / 1000));
}

/** View-space flight ends at the unchanged projected landing point; it never changes gameplay aim. */
export function authoredComponentPose(composition: AuthoredComposition, site: AuthoredComponentSite,
  age: number, reducedMotion = false) {
  const motion = composition.motion, fraction = site.phase / 16;
  const duration = motion.durationSec[0] + fraction * (motion.durationSec[1] - motion.durationSec[0]);
  const distanceM = motion.travelM[0] + fraction * (motion.travelM[1] - motion.travelM[0]);
  const unit = projectArenaPoint({ x: 1, y: 0 }), origin = projectArenaPoint({ x: 0, y: 0 });
  const meter = Math.hypot(unit.x - origin.x, unit.y - origin.y);
  const length = Math.hypot(...motion.directionScreen);
  const direction = { x: motion.directionScreen[0] / length, y: motion.directionScreen[1] / length };
  const falling = !reducedMotion && age >= -duration && age < 0;
  const remaining = falling ? -age / duration * distanceM * meter : 0;
  return { falling, position: { x: site.x - remaining * direction.x, y: site.y - remaining * direction.y },
    rotation: (Math.atan2(direction.y, direction.x)
      - Math.atan2(motion.sourceForwardScreen[1], motion.sourceForwardScreen[0])) * 180 / Math.PI };
}

/** Same depth domain as actors. Landing depth stays fixed while an airborne sprite descends. */
export function arenaComponentDepth(groundY: number, cameraY: number) {
  return Math.max(1, Math.round(groundY - cameraY));
}

/** Position the painted ground, not the center of falling particles, at the committed footprint. */
export function spatialVfxMatrix(preset: AuthoredVfx, frame: number, area: VfxFootprint) {
  const cell = authoredVfxCell(preset, frame);
  const authored = preset.frames?.find(f => f.index === frame);
  const bounds = authored?.bounds;
  const width = bounds ? bounds[2] - bounds[0] : cell.width;
  const sector = preset.spatial?.composition === 'whole-sector';
  const anchorX = cell.offsetX + (bounds ? (bounds[0] + bounds[2]) / 2 : cell.width / 2);
  const anchorY = cell.offsetY + (bounds ? bounds[3] - (sector ? 0 : width * .25) : cell.height * .72);
  const radiusX = (preset.contentWidthRatio ?? 1) * (preset.virtualWidth ?? cell.width) / 2;
  let a: number, b: number, c: number, d: number;
  if (sector && area.shape === 'cone') {
    const direction = area.directionRad ?? 0, reach = area.lengthM ?? 1;
    const halfAngle = (area.angleDeg ?? 90) * Math.PI / 360;
    const unitX = {x:area.basisX.x / reach,y:area.basisX.y / reach};
    const unitY = {x:area.basisY.x / reach,y:area.basisY.y / reach};
    const side = reach * Math.sin(halfAngle);
    a = (-Math.sin(direction)*unitX.x + Math.cos(direction)*unitY.x)*side/radiusX;
    b = (-Math.sin(direction)*unitX.y + Math.cos(direction)*unitY.y)*side/radiusX;
    const depth = Math.max(1, bounds ? bounds[3]-bounds[1] : cell.height);
    c = -(Math.cos(direction)*unitX.x + Math.sin(direction)*unitY.x)*reach/depth;
    d = -(Math.cos(direction)*unitX.y + Math.sin(direction)*unitY.y)*reach/depth;
  } else {
    const xx=area.basisX.x**2+area.basisY.x**2, xy=area.basisX.x*area.basisX.y+area.basisY.x*area.basisY.y;
    const yy=area.basisX.y**2+area.basisY.y**2, spread=Math.hypot(xx-yy,2*xy);
    const major=Math.sqrt((xx+yy+spread)/2), minor=Math.sqrt(Math.max(0,(xx+yy-spread)/2));
    const angle=Math.atan2(2*xy,xx-yy)/2;
    a=Math.cos(angle)*major/radiusX; b=Math.sin(angle)*major/radiusX;
    c=-Math.sin(angle)*minor/(radiusX*.5); d=Math.cos(angle)*minor/(radiusX*.5);
  }
  return [a,b,c,d,area.center.x-a*anchorX-c*anchorY,area.center.y-b*anchorX-d*anchorY];
}

export function spatialProjectileWidth(preset: AuthoredVfx) {
  const origin=projectArenaPoint({x:0,y:0}), tip=projectArenaPoint({x:preset.spatial?.spanM ?? 0,y:0});
  return Math.hypot(tip.x-origin.x,tip.y-origin.y);
}

export function spatialVfxClipPath(area: VfxFootprint) {
  if (area.shape !== 'cone') return undefined;
  const reach=area.lengthM ?? 1, direction=area.directionRad ?? 0;
  const half=(area.angleDeg ?? 90)*Math.PI/360;
  const arc=Array.from({length:25},(_,i)=> {
    const angle=direction-half+2*half*i/24;
    return `${area.center.x+Math.cos(angle)*area.basisX.x+Math.sin(angle)*area.basisY.x} ${area.center.y+Math.cos(angle)*area.basisX.y+Math.sin(angle)*area.basisY.y}`;
  });
  return reach>0 ? `M${area.center.x} ${area.center.y} L${arc.join(' L')} Z` : undefined;
}

export function authoredVfxCell(preset: AuthoredVfx, frame: number) {
  const index = Math.max(0, Math.min(preset.columns * preset.rows - 1, Math.floor(frame)));
  const column = index % preset.columns;
  const row = Math.floor(index / preset.columns);
  const authoredFrame = preset.frames?.find(frame => frame.index === index);
  const rect = authoredFrame?.rect;
  return {
    viewBox: rect ? rect.join(' ') : `${column * preset.cellWidth} ${row * preset.cellHeight} ${preset.cellWidth} ${preset.cellHeight}`,
    imageWidth: preset.imageWidth ?? preset.cellWidth * preset.columns,
    imageHeight: preset.imageHeight ?? preset.cellHeight * preset.rows,
    width: rect?.[2] ?? preset.cellWidth,
    height: rect?.[3] ?? preset.cellHeight,
    offsetX: authoredFrame?.offsetX ?? 0,
    offsetY: authoredFrame?.offsetY ?? 0,
    sourceX: rect?.[0] ?? column * preset.cellWidth,
    sourceY: rect?.[1] ?? row * preset.cellHeight,
  };
}

export function authoredVfxFrame(preset: AuthoredVfx, age: number, duration: number, reducedMotion = false, strikeCount = 1) {
  const openingCount = preset.opening[1] - preset.opening[0] + 1;
  const loopCount = preset.loop[1] - preset.loop[0] + 1;
  const exitCount = preset.exit[1] - preset.exit[0] + 1;
  if (reducedMotion) return preset.loop[0] + Math.floor(loopCount / 2);
  const total = Math.max(.001, duration);
  if (preset.spatial && preset.spatial.composition !== 'projectile-component') {
    const exitStart = Math.max(total*.65,total-exitCount*preset.frameMs/1000);
    if (age < exitStart) return preset.loop[0] + Math.floor(Math.max(0,age)*1000/preset.frameMs)%loopCount;
    return preset.exit[0] + Math.min(exitCount-1,Math.floor((age-exitStart)/Math.max(.001,total-exitStart)*exitCount));
  }
  if (preset.delivery && preset.delivery !== 'ground') {
    const activeEnd = total * loopCount / (loopCount + exitCount);
    if (age < activeEnd) return preset.loop[0] + Math.floor(Math.max(0, age) / activeEnd * loopCount * Math.max(1, strikeCount)) % loopCount;
    return preset.exit[0] + Math.min(exitCount - 1, Math.floor((age - activeEnd) / Math.max(.001, total - activeEnd) * exitCount));
  }
  if (preset.delivery === 'ground') {
    const exitStart = Math.max(total * .65, total - exitCount * preset.frameMs / 1000);
    if (age < exitStart) return preset.loop[0] + Math.floor(Math.max(0, age) / exitStart * loopCount * Math.max(1, strikeCount)) % loopCount;
    return preset.exit[0] + Math.min(exitCount - 1, Math.floor((age - exitStart) / Math.max(.001, total - exitStart) * exitCount));
  }
  const nominal = preset.frameMs / 1000;
  const openingSec = openingCount * nominal;
  const exitSec = exitCount * nominal;
  let openingEnd = openingSec;
  let exitStart = total - exitSec;
  let loopFrameSec = nominal;
  if (total < openingSec + exitSec) {
    const unit = total / (openingCount + loopCount + exitCount);
    openingEnd = openingCount * unit;
    exitStart = total - exitCount * unit;
    loopFrameSec = unit;
  } else {
    const cycles = Math.max(1, Math.round((total - openingSec - exitSec) / (loopCount * nominal)));
    loopFrameSec = (total - openingSec - exitSec) / (loopCount * cycles);
    exitStart = total - exitSec;
  }
  const elapsed = Math.max(0, Math.min(total, age));
  if (elapsed < openingEnd) {
    const index = Math.min(openingCount - 1, Math.floor(elapsed / (openingEnd / openingCount)));
    return preset.opening[0] + index;
  }
  if (elapsed < exitStart) {
    const index = Math.floor((elapsed - openingEnd) / loopFrameSec);
    return preset.loop[0] + index % loopCount;
  }
  const index = Math.min(exitCount - 1, Math.floor((elapsed - exitStart) / ((total - exitStart) / exitCount)));
  return preset.exit[0] + index;
}

export function authoredVfxSize(recipeSize: number, areaDiameter?: number) {
  return areaDiameter && areaDiameter > 0 ? areaDiameter : recipeSize * 1.4;
}
