/**
 * Flat ground shared by the world hexes and the field camera.
 *
 * Unit contract: `tileSizeM` is field metres — only the field renderer sizes
 * its pattern from it. The macro map never reads `tileSizeM`: its sheet
 * density is declared in map-plan units by the generator, and map art resolves
 * only `href` through `terrainGroundMaterials` (see `ui/map/map-terrain.ts`).
 * Values below are approved content; the contract above is what WP5 references.
 */
export type GroundMaterial = {
  id: string; href: string; width: number; height: number; tileSizeM: number;
};
const material = (id: string): GroundMaterial =>
  ({ id, href: `/map/ground/${id}-floor.webp`, width: 1254, height: 1254, tileSizeM: 8 });

export const groundMaterials = {
  meadow: material('meadow'), forest: material('forest'), marsh: material('marsh'),
  mountain: material('mountain'), coast: material('coast'), cave: material('cave'),
  snow: material('snow'), desert: material('desert'), tomb: material('tomb'),
  ruins: material('ruins'), volcanic: material('volcanic'), rift: material('rift'),
};

export const terrainGroundMaterials: Record<string, GroundMaterial> = {
  grass: groundMaterials.meadow, village: groundMaterials.meadow,
  camp: groundMaterials.meadow, town: groundMaterials.meadow,
  forest: groundMaterials.forest, marsh: groundMaterials.marsh, moor: groundMaterials.marsh,
  water: groundMaterials.coast, rock: groundMaterials.mountain, snow: groundMaterials.snow,
  salt: groundMaterials.desert, ash: groundMaterials.volcanic, waste: groundMaterials.rift,
  dungeon: groundMaterials.cave,
};
