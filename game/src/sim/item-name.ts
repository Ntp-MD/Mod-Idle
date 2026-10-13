import { BASES } from '../engine/client';
import type { Item } from './types';

/**
 * A weapon keeps its weapon type in `item.base` because combat, weight and skills read that key.
 * The dropped Frame Mod identifies which named weapon frame it came from, so the UI can show that
 * variant without storing a second name in the save.
 */
export function itemName(item: Pick<Item, 'slot' | 'base' | 'lines'>): string {
  if (item.slot !== 'main hand') return item.base;
  const line = item.lines[0];
  if (!line) return item.base;
  const mods = [line.id, ...(line.extra || []).map((extra) => extra.id)];
  const frames = ((BASES.weapon_frames as any)?.[item.base] || []) as { name: string; frame_mod: string[] }[];
  return frames.find((frame) => frame.frame_mod.length === mods.length && frame.frame_mod.every((id, i) => id === mods[i]))?.name || item.base;
}
