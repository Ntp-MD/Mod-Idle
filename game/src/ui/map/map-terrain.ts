/** One upright diorama per biome, placed above the rotating coloured hex ground. */
export const TERRAIN_ART: Record<string, string> = {
  grass: '/map/terrain/grass.png',
  forest: '/map/terrain/forest-relief.png',
  rock: '/map/terrain/mountain-relief.png',
  snow: '/map/terrain/snow.png',
  water: '/map/terrain/water.png',
  marsh: '/map/terrain/marsh.png',
  moor: '/map/terrain/moor.png',
  salt: '/map/terrain/salt.png',
  waste: '/map/terrain/waste.png',
  ash: '/map/terrain/ash.png',
  village: '/map/landmark/village.png',
  camp: '/map/landmark/camp.png',
  town: '/map/landmark/town.png',
  dungeon: '/map/landmark/encounter-ruins.png',
  wild: '/map/terrain/forest-relief.png',
};

/** Optional alternate dioramas; full-hex paintings are retained as assets outside the active roster. */
export const TERRAIN_VARIANTS: Record<string, string[]> = {};
