import { loot } from '../engine/client';
import { gearIcon, stackIcon } from '../icon';
import type { Item } from '../sim/types';
import type { BagStack } from '../sim/slots';

/**
 * The bag view model.
 *
 * A slot in the panel is either a piece of gear or one carried stack, and both need the same three
 * things to be drawn and sorted: a title, the item's level, and a strength number. Nothing here decides
 * what is strong — `loot.score` does, the same function the bag filter and the cages read — and the
 * orders come out of the data the roll already uses, so the panel cannot invent a tier the drop engine
 * does not know.
 */

export interface SlotEntry {
  /** where it sits in the bag it came from; Equip and the stat choice address this index */
  index: number;
  kind: 'gear' | 'stack' | 'worn' | 'empty';
  title: string;
  sub: string;
  item?: Item;
  stack?: BagStack;
  icon: string;
  levelRank: number;
  qualityRank: number;
  score: number;
  slot: string;
  count?: number;
  heldFor?: string;
}

const QUALITY_ORDER = (engBands() as string[]);

function engBands(): string[] {
  const b = loot.BANDS;
  return Array.isArray(b) ? b.map((x: any) => String(typeof x === 'string' ? x : x?.name ?? x?.id ?? '')) : Object.keys(b || {});
}

const rankOf = (order: string[], value?: string) => {
  const i = order.indexOf(String(value ?? ''));
  return i < 0 ? -1 : i;
};

export function gearEntry(item: Item, index: number): SlotEntry {
  return {
    index,
    kind: 'gear',
    title: item.base,
    sub: `level ${item.ilvl} · ${item.quality} · ${item.tier}`,
    item,
    icon: gearIcon(item),
    levelRank: item.ilvl,
    qualityRank: rankOf(QUALITY_ORDER, item.quality),
    score: loot.score({ ...item, q: item.q ?? 0 }),
    slot: item.slot,
    heldFor: item.heldFor,
  };
}

export function stackEntry(stack: BagStack, index: number): SlotEntry {
  return {
    index,
    kind: 'stack',
    title: stack.name,
    sub: stack.group,
    stack,
    icon: stackIcon(stack.group, stack.name),
    levelRank: -1,
    qualityRank: -1,
    score: stack.count,
    slot: '',
    count: stack.count,
  };
}

export type SortKey = 'newest' | 'slot' | 'level' | 'strength' | 'name';

export const SORT_LABELS: Record<SortKey, string> = {
  newest: 'as it dropped',
  slot: 'by slot',
  level: 'by item level',
  strength: 'by strength',
  name: 'by name',
};

/** Sorted copy, never in place: the bag's own order is what Equip addresses. */
export function sortEntries(entries: SlotEntry[], key: SortKey): SlotEntry[] {
  const list = [...entries];
  const byName = (a: SlotEntry, b: SlotEntry) => a.title.localeCompare(b.title);
  if (key === 'newest') return list.sort((a, b) => a.index - b.index);
  if (key === 'name') return list.sort(byName);
  if (key === 'slot') return list.sort((a, b) => a.slot.localeCompare(b.slot) || b.score - a.score);
  if (key === 'level') {
    return list.sort((a, b) => b.levelRank - a.levelRank || b.qualityRank - a.qualityRank || b.score - a.score || byName(a, b));
  }
  return list.sort((a, b) => b.score - a.score || byName(a, b));
}

/** How much stronger one piece is than the one it would replace, in the same units the filter uses. */
export function vsWorn(candidate: Item, worn: Item | null | undefined): number | null {
  if (!worn) return null;
  const base = loot.score({ ...worn, q: worn.q ?? 0 });
  if (!(base > 0)) return null;
  return Math.round(((loot.score({ ...candidate, q: candidate.q ?? 0 }) - base) / base) * 1000) / 10;
}
