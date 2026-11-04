import playerPilot from './arena-art-pixel-v2/player-animation-v2.json';
import pool from './mob-pool.generated.json';
import type { ArenaCharacterArt, ArenaSpriteSheet, ArenaPixelSpriteSet } from './arena-art';

export type SpriteAtlasMetadata = {
  sourceCanvas: { width: number; height: number };
  frameCanvas: { width: number; height: number };
  anchor: { x: number; y: number };
  sourceFrames?: NonNullable<ArenaSpriteSheet['sourceFrames']>;
  sourceFrameOrder?: number[];
  frameBottoms?: number[];
  releaseSockets?: Partial<Record<'east' | 'west', { x: number; y: number; provenance: string }>>;
};

export function pilotArt(href: string, atlas: SpriteAtlasMetadata, displayHeight: number, hoverAtRest = false): ArenaCharacterArt {
  const socketFor = (direction: 'east' | 'west'): ArenaSpriteSheet['releaseSocket'] => {
    const socket = atlas.releaseSockets?.[direction];
    if (!socket) return undefined;
    if (!Number.isFinite(socket.x) || !Number.isFinite(socket.y) || socket.x < 0 || socket.y < 0
      || socket.x > atlas.frameCanvas.width || socket.y > atlas.frameCanvas.height
      || !['measured', 'authored-fallback'].includes(socket.provenance))
      throw new Error(`Invalid release socket: ${href} ${direction}`);
    return { ...socket, provenance: socket.provenance === 'measured' ? 'measured' : 'authored-fallback' };
  };
  const sourceFrames = atlas.sourceFrames ?? Array.from({ length: 40 }, (_, index) => {
    const sourceIndex = atlas.sourceFrameOrder?.[index] ?? index;
    const bottom = atlas.frameBottoms?.[sourceIndex] ?? atlas.frameCanvas.height - 1;
    return {
      x: sourceIndex % 8 * atlas.frameCanvas.width,
      y: Math.floor(sourceIndex / 8) * atlas.frameCanvas.height,
      width: atlas.frameCanvas.width,
      height: bottom + 1,
      offsetX: 0,
      offsetY: atlas.frameCanvas.height - 1 - bottom,
    };
  });
  const sheet = (startFrame: number, frames = 4, frameMs = 140, loop = true): ArenaSpriteSheet => ({
    href, frameWidth: atlas.frameCanvas.width, frameHeight: atlas.frameCanvas.height,
    imageWidth: atlas.sourceCanvas.width, imageHeight: atlas.sourceCanvas.height, sourceFrames,
    columns: 8, rows: 5, startFrame, frames, frameMs, loop,
  });
  return {
    pixelArt: true,
    displayHeight,
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


/** Approved Pixel-v2 animation atlases; production and the species review selector share these files. */
export const pixelArenaArt: ArenaPixelSpriteSet = {
  hero: pilotArt('/combat/arpg/pixel-v2/player-animation-v2.png', playerPilot, 240),
  species: Object.fromEntries(
    Object.entries(pool.species).map(([species, { href, metadata }]) => [
      species, pilotArt(href, metadata, 224, species === 'wisp'),
    ]),
  ),
};
