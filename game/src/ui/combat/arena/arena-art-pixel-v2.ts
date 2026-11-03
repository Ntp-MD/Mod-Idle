import playerPilot from './arena-art-pixel-v2/player-animation-v2.json';
import wolfPilot from './arena-art-pixel-v2/wolf-animation-v2.json';
import spiderPilot from './arena-art-pixel-v2/spider-animation-v1.json';
import wispPilot from './arena-art-pixel-v2/wisp-animation-v2.json';
import goblinMob from './arena-art-pixel-v2/goblin-animation-v1.json';
import orcMob from './arena-art-pixel-v2/orc-animation-v1.json';
import koboldMob from './arena-art-pixel-v2/kobold-animation-v1.json';
import ogreMob from './arena-art-pixel-v2/ogre-animation-v1.json';
import trollMob from './arena-art-pixel-v2/troll-animation-v1.json';
import minotaurMob from './arena-art-pixel-v2/minotaur-animation-v1.json';
import skeletonMob from './arena-art-pixel-v2/skeleton-animation-v1.json';
import mummyMob from './arena-art-pixel-v2/mummy-animation-v1.json';
import vampireMob from './arena-art-pixel-v2/vampire-animation-v1.json';
import demonMob from './arena-art-pixel-v2/demon-animation-v1.json';
import slimeMob from './arena-art-pixel-v2/slime-animation-v1.json';
import golemMob from './arena-art-pixel-v2/golem-animation-v1.json';
import dragonMob from './arena-art-pixel-v2/dragon-animation-v1.json';
import wyvernMob from './arena-art-pixel-v2/wyvern-animation-v1.json';
import mirehydraMob from './arena-art-pixel-v2/mirehydra-animation-v1.json';
import wyrmlingMob from './arena-art-pixel-v2/wyrmling-animation-v1.json';
import treantMob from './arena-art-pixel-v2/treant-animation-v1.json';
import humanMob from './arena-art-pixel-v2/human-animation-v1.json';
import lizardmanMob from './arena-art-pixel-v2/lizardman-animation-v1.json';
import elfMob from './arena-art-pixel-v2/elf-animation-v1.json';
import giantMob from './arena-art-pixel-v2/giant-animation-v1.json';
import werewolfMob from './arena-art-pixel-v2/werewolf-animation-v1.json';
import dryadMob from './arena-art-pixel-v2/dryad-animation-v1.json';
import beetleMob from './arena-art-pixel-v2/beetle-animation-v1.json';
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
  species: {
    beetle: pilotArt('/combat/arpg/pixel-v2/beetle-animation-v1.png', beetleMob, 224),
    goblin: pilotArt('/combat/arpg/pixel-v2/goblin-animation-v1.png', goblinMob, 224),
    orc: pilotArt('/combat/arpg/pixel-v2/orc-animation-v1.png', orcMob, 224),
    kobold: pilotArt('/combat/arpg/pixel-v2/kobold-animation-v1.png', koboldMob, 224),
    ogre: pilotArt('/combat/arpg/pixel-v2/ogre-animation-v1.png', ogreMob, 224),
    troll: pilotArt('/combat/arpg/pixel-v2/troll-animation-v1.png', trollMob, 224),
    minotaur: pilotArt('/combat/arpg/pixel-v2/minotaur-animation-v1.png', minotaurMob, 224),
    skeleton: pilotArt('/combat/arpg/pixel-v2/skeleton-animation-v1.png', skeletonMob, 224),
    mummy: pilotArt('/combat/arpg/pixel-v2/mummy-animation-v1.png', mummyMob, 224),
    vampire: pilotArt('/combat/arpg/pixel-v2/vampire-animation-v1.png', vampireMob, 224),
    demon: pilotArt('/combat/arpg/pixel-v2/demon-animation-v1.png', demonMob, 224),
    slime: pilotArt('/combat/arpg/pixel-v2/slime-animation-v1.png', slimeMob, 224),
    golem: pilotArt('/combat/arpg/pixel-v2/golem-animation-v1.png', golemMob, 224),
    dragon: pilotArt('/combat/arpg/pixel-v2/dragon-animation-v1.png', dragonMob, 224),
    wyvern: pilotArt('/combat/arpg/pixel-v2/wyvern-animation-v1.png', wyvernMob, 224),
    mirehydra: pilotArt('/combat/arpg/pixel-v2/mirehydra-animation-v1.png', mirehydraMob, 224),
    wyrmling: pilotArt('/combat/arpg/pixel-v2/wyrmling-animation-v1.png', wyrmlingMob, 224),
    treant: pilotArt('/combat/arpg/pixel-v2/treant-animation-v1.png', treantMob, 224),
    human: pilotArt('/combat/arpg/pixel-v2/human-animation-v1.png', humanMob, 224),
    lizardman: pilotArt('/combat/arpg/pixel-v2/lizardman-animation-v1.png', lizardmanMob, 224),
    elf: pilotArt('/combat/arpg/pixel-v2/elf-animation-v1.png', elfMob, 224),
    giant: pilotArt('/combat/arpg/pixel-v2/giant-animation-v1.png', giantMob, 224),
    werewolf: pilotArt('/combat/arpg/pixel-v2/werewolf-animation-v1.png', werewolfMob, 224),
    dryad: pilotArt('/combat/arpg/pixel-v2/dryad-animation-v1.png', dryadMob, 224),
    wolf: pilotArt('/combat/arpg/pixel-v2/wolf-animation-v2.png', wolfPilot, 224),
    spider: pilotArt('/combat/arpg/pixel-v2/spider-animation-v1.png', spiderPilot, 224),
    wisp: pilotArt('/combat/arpg/pixel-v2/wisp-animation-v2.png', wispPilot, 224, true),
  },
};
