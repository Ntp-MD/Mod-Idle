import type { GameState, Item } from '../core/types';
import { autoEquip, type EquipResult } from './gear';
import { previewFilterRun, type FilterRunAction } from '../core/game';

/**
 * A read-only forecast of the gear rules the client already runs.
 *
 * Auto Equip is previewed on a structured clone, so the swap list comes from the same `autoEquip` the
 * press uses without moving a live piece. The filter rows read `filterVerdict`, the one verdict a drop
 * and a bulk filter run share.
 */
export interface BagVerdict {
  item: Item;
  index: number;
  action: FilterRunAction;
  reason: string;
}

export interface GearCarePreview {
  equip: EquipResult;
  /** What remains in the copied bag after the Auto Equip forecast, in the order it would sit. */
  bag: BagVerdict[];
  /** True when running the filter now would stop before the first bundle because the bag has no room. */
  filterBlocked: string | null;
}

export function gearCarePreview(state: GameState, marginPct = 0): GearCarePreview {
  const copy = structuredClone(state);
  const equip = autoEquip(copy, marginPct);
  const bag = previewFilterRun(state).map((row) => ({ ...row, item: state.bag[row.index] }));
  return {
    equip,
    bag,
    filterBlocked: bag.find((row) => row.action === 'blocked')?.reason || null,
  };
}
