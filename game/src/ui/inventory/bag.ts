import { loot } from '../../engine/client';
import { gearIcon, stackIcon } from '../../icon';
import { itemName } from '@sim/gear/item-name';
import type { Item } from '@sim/core/types';
import type { BagStack } from '@sim/gear/slots';

/**
 * The bag view model.
 *
 * A slot in the panel is either a piece of gear or one carried stack, and both need the same three
 * things to be drawn and sorted: a title, the item's level, and a strength number. Nothing here decides
 * what is strong — `loot.score` does, the same function the bag filter and the cages read — and the
 * orders come out of the data the roll already uses, so the panel cannot invent a tier the drop engine
 * does not know.
 */

/**
 * A drop's edge, read off the piece itself so the client cannot invent one.
 *
 * The rungs are three facts the roll already stamped on the item — its quality band (`low` / `mid` /
 * `high`), its Tier (T1 is the top half of every Mod's range) and whether a Quality stone was spent on
 * it (`upgrade_lv`) — summed and capped. Nothing here rolls, weighs or compares; a piece reads the
 * same rung in the bag, on the body and in the warehouse. The ink each rung wears is a token in
 * `variables.css`, never a colour typed in a component.
 */
const BAND_RANK: Record<string, number> = { low: 0, mid: 1, high: 2 };

const RUNGS = [
  { name: 'common', token: '--rar-common' },
  { name: 'uncommon', token: '--rar-uncommon' },
  { name: 'rare', token: '--rar-rare' },
  { name: 'epic', token: '--rar-epic' },
  { name: 'legendary', token: '--rar-legend' },
] as const;

export type ItemRank = { rank: number; name: string; tone: string };

/** The rung a piece sits on, or null for a piece with none (a stack). */
export function pieceRank(item: Item | null | undefined): ItemRank | null {
  if (!item) return null;
  const rank = Math.max(
    0,
    Math.min(RUNGS.length - 1, (BAND_RANK[item.quality] ?? 0) + (item.tier === 'T1' ? 1 : 0) + ((item.upgrade_lv || 0) > 0 ? 1 : 0)),
  );
  return { rank, name: RUNGS[rank].name, tone: `var(${RUNGS[rank].token})` };
}

/** The rung's ink as a CSS value, for a style directive; null when the piece has none. */
export const rankTone = (item: Item | null | undefined): string | null => pieceRank(item)?.tone ?? null;

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

/** The quality bands in sort order, read off the loot module's own label row. */
const QUALITY_ORDER = loot.BAND_LABEL as string[];

const rankOf = (order: string[], value?: string) => {
  const i = order.indexOf(String(value ?? ''));
  return i < 0 ? -1 : i;
};

export function gearEntry(item: Item, index: number): SlotEntry {
  return {
    index,
    kind: 'gear',
    title: itemName(item),
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
  const iconKind = stack.group === 'junk' ? 'junk' : stack.capKind;
  return {
    index,
    kind: 'stack',
    title: stack.name,
    sub: stack.group,
    stack,
    icon: stackIcon(stack.group, stack.name, `${iconKind}:${stack.key}`),
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

/** One line the swap changes, read by Mod id (and the Element a line rolled). */
export type LineCmp = {
  id: string;
  element?: string;
  /** what the candidate carries there, or null when only the worn piece has it */
  cand: number | null;
  /** what is worn there, or null when the candidate brings a line nothing is worn against */
  worn: number | null;
  kind: 'lost' | 'gained' | 'over' | 'under' | 'even';
};

/**
 * The per-axis half of a comparison: `vsWorn` answers "is this piece stronger overall", this answers
 * "what does the swap actually change", so a piece that ties on score but trades a line still reads
 * as the trade it is. Lines are paired by id and Element, and a `Frame Mod` carries its extras, so a
 * line is flattened the same way the card prints it. The Keep decision is not here — that is the
 * aggregate score's, in `loot.keepsDrop`. A line both pieces carry at the same value is dropped: it
 * is already printed in the list above.
 */
export function compareLines(candidate: Item, worn: Item | null | undefined): LineCmp[] {
  if (!worn) return [];
  const flat = (it: Item) => (it.lines || []).flatMap((l: any) => [l, ...(l.extra || [])]);
  const key = (l: any) => `${l.id}${l.element ? ':' + l.element : ''}`;
  const map = new Map<string, LineCmp>();
  for (const l of flat(worn)) map.set(key(l), { id: l.id, element: l.element, cand: null, worn: l.value, kind: 'lost' });
  for (const l of flat(candidate)) {
    const k = key(l);
    const row: LineCmp = map.get(k) || { id: l.id, element: l.element, cand: null, worn: null, kind: 'gained' };
    row.cand = l.value;
    row.kind = row.worn == null ? 'gained' : l.value > row.worn ? 'over' : l.value < row.worn ? 'under' : 'even';
    map.set(k, row);
  }
  return [...map.values()].filter((r) => r.kind !== 'even');
}
