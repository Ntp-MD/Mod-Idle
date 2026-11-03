import type { GameState, Item } from '@sim/core/types';
import type { Where } from '@sim/gear/craft';

export interface ItemSelection { where: Where; item: Item }

/** A UI selection follows the piece, rather than the position newer loot can take. */
export function resolveItemSelection(game: Pick<GameState, 'bag' | 'gear'>, selection: ItemSelection | null) {
  if (!selection) return null;
  const index = game[selection.where].indexOf(selection.item);
  return index < 0 ? null : { ...selection, index };
}

/** A service that replaces the selected Item object keeps the bench on the replacement at the same spot. */
export function refreshSelectionAfterRepair(
  game: Pick<GameState, 'bag' | 'gear'>,
  selection: ItemSelection | null,
  target: { where: Where; index: number } | null,
  where: Where,
  index: number,
): ItemSelection | null {
  if (!selection || !target || target.where !== where || target.index !== index) return selection;
  const item = game[where][index];
  return item ? { where, item } : selection;
}
