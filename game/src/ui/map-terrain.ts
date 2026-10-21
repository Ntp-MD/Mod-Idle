/** The tile a biome shows by default; one piece per hex, standing alone without compositions. */
export const TERRAIN_ART: Record<string, string> = {
  grass: '/map/terrain/grass-1.png',
  forest: '/map/terrain/forest-relief-1.png',
  rock: '/map/terrain/mountain-relief-1.png',
  snow: '/map/terrain/snow-1.png',
  water: '/map/terrain/water-1.png',
  marsh: '/map/terrain/marsh-1.png',
  moor: '/map/terrain/moor-1.png',
  salt: '/map/terrain/salt-1.png',
  waste: '/map/terrain/waste-1.png',
  ash: '/map/terrain/ash-1.png',
  village: '/map/landmark/village.png',
  camp: '/map/landmark/camp.png',
  town: '/map/landmark/town-1.png',
  dungeon: '/map/landmark/encounter-ruins.png',
  wild: '/map/terrain/forest-relief-1.png',
};

/**
 * The other tiles a biome may show. A stretch of one biome then reads as ground rather than one
 * repeated picture: the generator picks one tile per hex, and the biome's own art comes first.
 * Every variant needs its own footprint registration before it may be listed here.
 */
export const TERRAIN_VARIANTS: Record<string, string[]> = {
  grass: ['/map/terrain/grass-2.png'],
  forest: ['/map/terrain/forest-relief-2.png'],
  rock: ['/map/terrain/mountain-relief-2.png'],
  snow: ['/map/terrain/snow-2.png'],
  water: ['/map/terrain/water-2.png'],
  marsh: ['/map/terrain/marsh-2.png'],
  moor: ['/map/terrain/moor-2.png'],
  salt: ['/map/terrain/salt-2.png'],
  waste: ['/map/terrain/waste-2.png'],
  ash: ['/map/terrain/ash-2.png'],
  wild: ['/map/terrain/forest-relief-2.png'],
};
