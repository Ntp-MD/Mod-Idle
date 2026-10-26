import { BASES, loot } from '../engine/client';
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
  return loot.weaponFrameOf(BASES, item.base, line)?.name || item.base;
}
