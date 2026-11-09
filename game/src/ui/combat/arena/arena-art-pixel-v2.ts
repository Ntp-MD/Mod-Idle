import pool from './mob-pool.generated.json';
import type { ArenaCharacterArt, ArenaSpriteSheet, ArenaPixelSpriteSet } from './arena-art';

type PawnDirection = 'south' | 'north' | 'west' | 'east';

export type SpriteAtlasMetadata = {
  sourceCanvas: { width: number; height: number };
  frameCanvas: { width: number; height: number };
  anchor: { x: number; y: number };
  sourceFrames?: NonNullable<ArenaSpriteSheet['sourceFrames']>;
  layout?: { columns: number; rows: number; frameCount: number; directions?: string[] };
  sourceFrameOrder?: number[];
  frameBottoms?: number[];
  releaseSockets?: Partial<Record<'east' | 'west', { x: number; y: number; provenance: string }>>;
  gripsByDirection?: Partial<Record<PawnDirection, {
    mainHand?: { x: number; y: number };
    offHand?: { x: number; y: number };
  }>>;
};

const median = (values: readonly number[]) => {
  const sorted = [...values].filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length
    ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
    : 1;
};

function idleSouthAspect(atlas: SpriteAtlasMetadata) {
  const frame = atlas.sourceFrames?.[0];
  if (frame) return frame.height / Math.max(1, frame.width);
  const index = atlas.sourceFrameOrder?.[0] ?? 0;
  const height = (atlas.frameBottoms?.[index] ?? atlas.frameCanvas.height - 1) + 1;
  return height / Math.max(1, atlas.frameCanvas.width);
}

const speciesEntries = Object.entries(pool.species);
const referenceIdleSouthAspect = median(speciesEntries.map(([, { metadata }]) => idleSouthAspect(metadata)));

export function pixelArtDisplayScale(atlas: SpriteAtlasMetadata) {
  return referenceIdleSouthAspect / idleSouthAspect(atlas);
}

export function pilotArt(href: string, atlas: SpriteAtlasMetadata, displayHeight: number, hoverAtRest = false,
  displayScale = 1, assetId?: string): ArenaCharacterArt {
  const socketFor = (direction: 'east' | 'west'): ArenaSpriteSheet['releaseSocket'] => {
    const socket = atlas.releaseSockets?.[direction];
    if (!socket) return undefined;
    if (!Number.isFinite(socket.x) || !Number.isFinite(socket.y) || socket.x < 0 || socket.y < 0
      || socket.x > atlas.frameCanvas.width || socket.y > atlas.frameCanvas.height
      || !['measured', 'authored-fallback'].includes(socket.provenance))
      throw new Error(`Invalid release socket: ${href} ${direction}`);
    return { ...socket, provenance: socket.provenance === 'measured' ? 'measured' : 'authored-fallback' };
  };
  const layout = atlas.layout ?? { columns: 8, rows: 5, frameCount: 40 };
  const sourceFrames = atlas.sourceFrames ?? Array.from({ length: layout.frameCount }, (_, index) => {
    const sourceIndex = atlas.sourceFrameOrder?.[index] ?? index;
    const bottom = atlas.frameBottoms?.[sourceIndex] ?? atlas.frameCanvas.height - 1;
    return {
      x: sourceIndex % layout.columns * atlas.frameCanvas.width,
      y: Math.floor(sourceIndex / layout.columns) * atlas.frameCanvas.height,
      width: atlas.frameCanvas.width,
      height: bottom + 1,
      offsetX: 0,
      offsetY: atlas.frameCanvas.height - 1 - bottom,
    };
  });
  if (layout.frameCount === 4 || layout.frameCount === 8) {
    const fourViewMap: Record<string, { view: PawnDirection; index: number }> = {
      south: { view: 'south', index: 0 }, 'south-east': { view: 'south', index: 0 },
      east: { view: 'east', index: 3 }, 'north-east': { view: 'east', index: 3 },
      north: { view: 'north', index: 1 }, 'north-west': { view: 'north', index: 1 },
      west: { view: 'west', index: 2 }, 'south-west': { view: 'west', index: 2 },
    };
    const eightDirections = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
    const viewByDirection: Record<string, { view: PawnDirection; index: number }> = layout.frameCount === 8
      ? Object.fromEntries((atlas.layout?.directions ?? eightDirections).map((direction, index) => [
        direction, { view: fourViewMap[direction]?.view ?? 'south', index },
      ]))
      : fourViewMap;
    const staticSheet = (direction: string, action: string): ArenaSpriteSheet => {
      const { view, index } = viewByDirection[direction];
      const grips = atlas.gripsByDirection?.[view];
      const grip = grips?.mainHand;
      return {
        href, frameWidth: atlas.frameCanvas.width, frameHeight: atlas.frameCanvas.height,
        imageWidth: atlas.sourceCanvas.width, imageHeight: atlas.sourceCanvas.height, sourceFrames,
        columns: layout.columns, rows: layout.rows, startFrame: index, frames: 1,
        frameMs: action === 'attack' ? 400 : action === 'death' ? 600 : 160,
        loop: action === 'idle' || action === 'walk',
        ...(grips?.mainHand ? { mainGripCell: grips.mainHand } : {}),
        ...(grips?.offHand ? { offGripCell: grips.offHand } : {}),
        ...(action === 'attack' ? {
          impactMs: 200,
          ...(direction === 'east' || direction === 'west'
            ? grip ? { releaseSocket: { ...grip, provenance: 'authored-fallback' as const } } : {}
            : {}),
        } : {}),
      };
    };
    const staticClip = (action: string) => Object.fromEntries(
      Object.keys(viewByDirection).map(direction => [direction, staticSheet(direction, action)]),
    );
    return {
      schemaVersion: 1,
      assetId: assetId ?? href,
      pixelArt: true,
      displayHeight,
      displayScale,
      anchor: { x: atlas.anchor.x / atlas.frameCanvas.width, y: atlas.anchor.y / atlas.frameCanvas.height },
      clips: {
        idle: staticClip('idle'), walk: staticClip('walk'), attack: staticClip('attack'),
        hit: staticClip('hit'), death: staticClip('death'),
      },
    };
  }
  const sheet = (startFrame: number, frames = 4, frameMs = 140, loop = true): ArenaSpriteSheet => ({
    href, frameWidth: atlas.frameCanvas.width, frameHeight: atlas.frameCanvas.height,
    imageWidth: atlas.sourceCanvas.width, imageHeight: atlas.sourceCanvas.height, sourceFrames,
    columns: 8, rows: 5, startFrame, frames, frameMs, loop,
  });
  return {
    schemaVersion: 1,
    assetId: assetId ?? href,
    pixelArt: true,
    displayHeight,
    displayScale,
    anchor: { x: atlas.anchor.x / atlas.frameCanvas.width, y: atlas.anchor.y / atlas.frameCanvas.height },
    clips: {
      idle: {
        south: sheet(0, 1), 'south-east': sheet(1, 1), east: hoverAtRest ? sheet(8) : sheet(2, 1), 'north-east': sheet(3, 1),
        north: sheet(4, 1), 'north-west': sheet(5, 1), west: hoverAtRest ? sheet(12) : sheet(6, 1), 'south-west': sheet(7, 1),
      },
      walk: { east: sheet(8), west: sheet(12) },
      attack: {
        east: { ...sheet(16, 4, 100, false), impactMs: 200, releaseSocket: socketFor('east') },
        west: { ...sheet(20, 4, 100, false), impactMs: 200, releaseSocket: socketFor('west') },
      },
      hit: { east: sheet(24, 4, 65, false), west: sheet(28, 4, 65, false) },
      death: { east: sheet(32, 4, 140, false), west: sheet(36, 4, 140, false) },
    },
  };
}


/** Pawn-study atlases are the default; the four views drive whole-sprite action presentation. */
export const pixelArenaArt: ArenaPixelSpriteSet = {
  hero: pilotArt(pool.player.href, pool.player.metadata, 240, false, 1, 'player-pawn'),
  species: Object.fromEntries(
    speciesEntries.map(([species, { href, metadata }]) => [
      species, pilotArt(href, metadata, 224, species === 'wisp', pixelArtDisplayScale(metadata), `species.${species}`),
    ]),
  ),
  variants: Object.fromEntries(
    Object.entries(pool.variants).map(([species, variants]) => [species,
      Object.fromEntries(Object.entries(variants).map(([name, { href, metadata }]) => [
        name, pilotArt(href, metadata, 224, false, pixelArtDisplayScale(metadata), `variant.${species}.${name}`),
      ])),
    ]),
  ),
};
