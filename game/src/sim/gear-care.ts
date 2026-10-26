import { TOWN } from '../engine/client';
import type { GameState, Item } from './types';
import { autoEquip, type EquipResult } from './gear';
import { previewFilterRun, type FilterRunAction } from './game';
import { autoReturnBlocker, autoReturnThreshold } from './exploration';
import { slotsAvailable, slotsUsed } from './slots';
import { currentCell, ownerOf } from './road';

/**
 * A read-only forecast of the gear rules the client already runs.
 *
 * Auto Equip is previewed on a structured clone, so the swap list comes from the same `autoEquip` the
 * press uses without moving a live piece. The filter rows read `filterVerdict`, the one verdict a drop
 * and a bulk filter run share. Auto-Return reports the same watermark `maybeStartAutoReturn` reads.
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
  autoReturn: {
    enabled: boolean;
    used: number;
    available: number;
    threshold: number;
    phase: GameState['autoReturn']['phase'];
    settlement: string;
    readyToStart: boolean;
    blocked: string | null;
  };
  /** True when running the filter now would stop before the first bundle because the bag has no room. */
  filterBlocked: string | null;
}

export function gearCarePreview(state: GameState, marginPct = 0): GearCarePreview {
  const copy = structuredClone(state);
  const equip = autoEquip(copy, marginPct);
  const bag = previewFilterRun(state).map((row) => ({ ...row, item: state.bag[row.index] }));
  const used = slotsUsed(state);
  const available = slotsAvailable(state);
  const threshold = autoReturnThreshold(state);
  const blocker = autoReturnBlocker(state);
  const readyToStart = blocker === null;
  const homeId = ownerOf(currentCell(state)).id;
  const settlement = TOWN.settlements.find((town: any) => town.id === homeId)?.name || homeId;
  const blocked = !state.autoReturn.enabled ? readyToStart ? 'Auto-Return is off; enabling it will start a return on the next tick.' : 'Auto-Return is off'
    : blocker;
  return {
    equip,
    bag,
    autoReturn: { enabled: state.autoReturn.enabled, used, available, threshold, phase: state.autoReturn.phase, settlement, readyToStart, blocked },
    filterBlocked: bag.find((row) => row.action === 'blocked')?.reason || null,
  };
}
