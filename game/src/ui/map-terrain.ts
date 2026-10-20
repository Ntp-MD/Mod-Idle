/** Presentation assets and modular compositions; no gameplay terrain rules live here. */
export type TerrainProp = { x: number; y: number; width: number; front?: boolean };
// Relief stays inside its own hex: every prop's foot sits near the centre and no crown climbs
// past the upper edge, so art never spills onto the neighbour above.
const compositions: readonly (readonly TerrainProp[])[] = [
  [{ x: -10, y: -2, width: 34 }, { x: 12, y: 10, width: 17, front: true }],
  [{ x: -14, y: 2, width: 28 }, { x: 13, y: -4, width: 29 }],
  [{ x: -12, y: -5, width: 26 }, { x: 12, y: 0, width: 27 }, { x: -4, y: 12, width: 16, front: true }],
  [{ x: 5, y: 3, width: 42 }, { x: -15, y: 10, width: 17, front: true }],
  [{ x: -14, y: 0, width: 21 }, { x: 2, y: -6, width: 22 }, { x: 14, y: 10, width: 18, front: true }, { x: -6, y: 12, width: 15, front: true }],
];
export const TERRAIN_COMPOSITIONS = compositions;
export const TERRAIN_ART: Record<string, { prop: string; surface: 'grass' | 'forest' | 'rock' | 'water'; height: number }> = {
  grass: { prop: '/map/terrain/grass.png', surface: 'grass', height: .75 },
  forest: { prop: '/map/forest-relief.png', surface: 'forest', height: .82 },
  rock: { prop: '/map/mountain-relief.png', surface: 'rock', height: .67 },
  snow: { prop: '/map/terrain/snow.png', surface: 'rock', height: .8 },
  water: { prop: '/map/terrain/water.png', surface: 'water', height: .7 },
  marsh: { prop: '/map/terrain/marsh.png', surface: 'water', height: .75 },
  moor: { prop: '/map/terrain/moor.png', surface: 'grass', height: .7 },
  salt: { prop: '/map/terrain/salt.png', surface: 'rock', height: .65 },
  waste: { prop: '/map/terrain/waste.png', surface: 'rock', height: .8 },
  ash: { prop: '/map/terrain/ash.png', surface: 'rock', height: .7 },
  village: { prop: '/map/terrain/village.png', surface: 'grass', height: .8 },
  camp: { prop: '/map/terrain/camp.png', surface: 'grass', height: .7 },
  town: { prop: '/map/terrain/town.png', surface: 'grass', height: 1 },
  wild: { prop: '/map/forest-relief.png', surface: 'forest', height: .82 },
};

/** Stable art selection survives refreshes, travel and changes of map selection. */
export function terrainVariant(terrain: string, q: number, r: number): number {
  let hash = 2166136261;
  for (const letter of `${terrain}:${q},${r}`) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return (hash >>> 0) % compositions.length;
}

export function terrainComposition(variant: number, encounter = false): TerrainProp[] {
  return compositions[variant].map(prop => encounter
    ? { ...prop, x: prop.x < 0 ? -14 : 15, y: prop.front ? 13 : -6, width: Math.min(prop.width, prop.front ? 13 : 27) }
    : { ...prop });
}
