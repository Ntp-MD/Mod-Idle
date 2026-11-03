import meadow from '../../../assets/combat/meadow-floor.webp';
import forest from '../../../assets/combat/forest-floor.webp';
import marsh from '../../../assets/combat/marsh-floor.webp';
import mountain from '../../../assets/combat/mountain-floor.webp';
import coast from '../../../assets/combat/coast-floor.webp';
import cave from '../../../assets/combat/cave-floor.webp';
import snow from '../../../assets/combat/snow-floor.webp';
import desert from '../../../assets/combat/desert-floor.webp';
import tomb from '../../../assets/combat/tomb-floor.webp';
import ruins from '../../../assets/combat/ruins-floor.webp';
import volcanic from '../../../assets/combat/volcanic-floor.webp';
import rift from '../../../assets/combat/rift-floor.webp';
import { eng } from '../../../engine/client';
import type { GameState } from '@sim/core/types';

export type ArenaGroundMaterial = {
  id: string; href: string; width: number; height: number; tileSizeM: number;
};
const material = (id: string, href: string): ArenaGroundMaterial =>
  ({ id, href, width: 1254, height: 1254, tileSizeM: 8 });

export const arenaGroundMaterials = {
  meadow: material('meadow', meadow),
  forest: material('forest', forest),
  marsh: material('marsh', marsh),
  mountain: material('mountain', mountain),
  coast: material('coast', coast),
  cave: material('cave', cave),
  snow: material('snow', snow),
  desert: material('desert', desert),
  tomb: material('tomb', tomb),
  ruins: material('ruins', ruins),
  volcanic: material('volcanic', volcanic),
  rift: material('rift', rift),
} as const;

type MaterialId = keyof typeof arenaGroundMaterials;
const environmentMaterials: Record<string, MaterialId> = {
  grassland: 'meadow', village: 'meadow', camp: 'meadow',
  grove: 'forest', rootway: 'forest', glade: 'forest', 'dark forest': 'forest', fog: 'forest',
  swamp: 'marsh', mud: 'marsh', 'poison fen': 'marsh',
  mountain: 'mountain', cliff: 'mountain', cliffs: 'mountain', mesa: 'mountain',
  peak: 'snow', snow: 'snow', ice: 'snow', rime: 'snow',
  coast: 'coast', sea: 'coast', dunes: 'desert',
  court: 'tomb', gallery: 'tomb', sanctum: 'tomb', temple: 'tomb', tombs: 'tomb', vault: 'tomb',
  tunnels: 'cave', warrens: 'cave', hollow: 'cave', depths: 'cave',
  stair: 'cave', deeps: 'cave', abyss: 'cave',
  ruins: 'ruins', gate: 'ruins', market: 'ruins', quarter: 'ruins',
  volcano: 'volcanic', lava: 'volcanic', caldera: 'volcanic',
  blight: 'rift', waste: 'rift', rift: 'rift',
};
const terrainMaterials: Record<string, MaterialId> = {
  grass: 'meadow', village: 'meadow', camp: 'meadow', town: 'meadow',
  forest: 'forest', marsh: 'marsh', moor: 'marsh', water: 'coast',
  rock: 'mountain', snow: 'snow', salt: 'desert', ash: 'volcanic', waste: 'rift',
};

/** Visual selection only; the authored roster and navigation remain owned by simulation data. */
export function arenaGroundForField(state: Pick<GameState, 'zone' | 'cell' | 'dungeon'>): ArenaGroundMaterial {
  if (state.dungeon) return arenaGroundMaterials.cave;
  const zone = eng.zoneById(state.zone);
  const sub = state.cell?.sub;
  const environment = sub != null ? zone?.subzones?.[sub]?.environment : undefined;
  // "deeps" is shared by flooded caves and this authored molten location.
  if (state.zone === 12 && sub === 1) return arenaGroundMaterials.volcanic;
  const id = (environment && environmentMaterials[environment])
    || (state.cell?.terrain && terrainMaterials[state.cell.terrain])
    || (zone?.subzones?.[0]?.environment && environmentMaterials[zone.subzones[0].environment])
    || 'forest';
  return arenaGroundMaterials[id];
}

