import data from '../../../../tools/data/vfx-components.json';

export type VfxPaletteId = keyof typeof data.palettes;
export const VFX_PALETTE_IDS = Object.keys(data.palettes) as VfxPaletteId[];
export const isVfxPalette = (value: unknown): value is VfxPaletteId =>
  typeof value === 'string' && Object.hasOwn(data.palettes, value);

/** RGB lookup tables preserve alpha, frame geometry and white-hot highlights. */
export function vfxPaletteTables(palette: VfxPaletteId): [string, string, string] {
  const stops = data.palettes[palette];
  return [1, 3, 5].map(offset => stops.map(hex =>
    (parseInt(hex.slice(offset, offset + 2), 16) / 255).toFixed(6)).join(' ')) as [string, string, string];
}

