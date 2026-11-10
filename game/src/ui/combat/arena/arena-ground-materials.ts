import { groundMaterials, terrainGroundMaterials, type GroundMaterial } from '../../../presentation/ground-materials';
import { eng } from '../../../engine/client';
import type { GameState } from '@sim/core/types';

export type ArenaGroundMaterial = GroundMaterial;
export const arenaGroundMaterials = groundMaterials;

type MaterialId = keyof typeof arenaGroundMaterials;
const environmentMaterials: Record<string, MaterialId> = {
  grassland: 'meadow', village: 'meadow', camp: 'meadow',
  grove: 'forest', rootway: 'forest', glade: 'forest', 'dark forest': 'forest', fog: 'forest',
  'charged rootway': 'forest', 'thunder glade': 'forest',
  swamp: 'marsh', mud: 'marsh', 'poison fen': 'marsh', 'frozen fen': 'marsh',
  mountain: 'mountain', cliff: 'mountain', cliffs: 'mountain', mesa: 'mountain',
  peak: 'snow', snow: 'snow', ice: 'snow', rime: 'snow',
  coast: 'coast', sea: 'coast', dunes: 'desert',
  court: 'tomb', gallery: 'tomb', sanctum: 'tomb', temple: 'tomb', tombs: 'tomb', vault: 'tomb',
  'bone stair': 'tomb',
  tunnels: 'cave', warrens: 'cave', hollow: 'cave', depths: 'cave',
  stair: 'cave', deeps: 'cave', abyss: 'cave', 'throne abyss': 'cave',
  ruins: 'ruins', gate: 'ruins', market: 'ruins', quarter: 'ruins',
  volcano: 'volcanic', lava: 'volcanic', caldera: 'volcanic', 'molten deeps': 'volcanic',
  blight: 'rift', waste: 'rift', rift: 'rift',
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
    || (state.cell?.terrain && terrainGroundMaterials[state.cell.terrain]?.id as MaterialId)
    || (zone?.subzones?.[0]?.environment && environmentMaterials[zone.subzones[0].environment])
    || 'forest';
  return arenaGroundMaterials[id];
}

