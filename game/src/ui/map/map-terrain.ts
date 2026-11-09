import { terrainGroundMaterials } from '../../presentation/ground-materials.ts';

/** The same unprojected ground as the field, masked by each world hex. */
export const TERRAIN_ART: Record<string, string> = Object.fromEntries(
  Object.entries(terrainGroundMaterials).map(([terrain, material]) => [terrain, material.href]),
);

/** The upright column above the ground: separate transparent objects, never full-hex canvases.
 *  Terrain biomes have no relief art: every field hex paints its flat ground color. Only
 *  authored landmarks (village, camp, town, dungeon) keep an upright figure. */
export const TERRAIN_RELIEF: Record<string, string> = {
  village: '/map/landmark/village-1.png',
  camp: '/map/landmark/camp-1.png',
  town: '/map/landmark/town-relief-1.png',
  dungeon: '/map/landmark/encounter-ruins-1.png',
};

/** Full-hex paintings are retained as assets outside the active roster. */
export const TERRAIN_VARIANTS: Record<string, string[]> = {};
