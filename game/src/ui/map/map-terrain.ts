/** One ground texture per biome. Ground is a full-hex surface under the upright relief. */
export const TERRAIN_ART: Record<string, string> = {
  grass: '/map/terrain/grass-3.png',
  forest: '/map/terrain/grass-3.png',
  rock: '/map/terrain/mountain-relief-3.png',
  snow: '/map/terrain/snow-3.png',
  water: '/map/terrain/water-3.png',
  marsh: '/map/terrain/marsh-3.png',
  moor: '/map/terrain/moor-3.png',
  salt: '/map/terrain/salt-3.png',
  waste: '/map/terrain/waste-3.png',
  ash: '/map/terrain/ash-3.png',
  village: '/map/terrain/grass-3.png',
  camp: '/map/terrain/grass-3.png',
  town: '/map/terrain/grass-3.png',
  dungeon: '/map/terrain/waste-3.png',
};

/** The upright column above the ground: separate transparent objects, never full-hex canvases. */
export const TERRAIN_RELIEF: Record<string, string> = {
  forest: '/map/terrain/forest-relief-4.png',
  rock: '/map/terrain/mountain-relief-4.png',
  village: '/map/landmark/village-1.png',
  camp: '/map/landmark/camp-1.png',
  town: '/map/landmark/town-relief-1.png',
  dungeon: '/map/landmark/encounter-ruins-1.png',
};

/** Optional alternate dioramas; full-hex paintings are retained as assets outside the active roster. */
export const TERRAIN_VARIANTS: Record<string, string[]> = {};
