import { loot } from '../engine/client';
import type { Item } from '../sim/types';
import type { BagStack } from '../sim/slots';

/**
 * The bag view model.
 *
 * A slot in the panel is either a piece of gear or one carried stack, and both need the same three
 * things to be drawn and sorted: a title, a rank for Rarity and Item quality, and a strength number.
 * Nothing here decides what is strong — `loot.score` does, the same function the bag filter and the
 * cages read — and the orders come out of the data the roll already uses (`loot.RARITY`,
 * `eng.BANDS`), so the panel cannot invent a tier that the drop engine does not know.
 */

export interface SlotEntry {
  /** where it sits in the bag it came from; Equip and the stat choice address this index */
  index: number;
  kind: 'gear' | 'stack' | 'worn' | 'empty';
  title: string;
  sub: string;
  item?: Item;
  stack?: BagStack;
  /** which silhouette the tile draws */
  glyph: 'weapon' | 'armour' | 'jewellery' | 'stone' | 'herb' | 'draught' | 'junk';
  rarityRank: number;
  qualityRank: number;
  score: number;
  slot: string;
  count?: number;
  heldFor?: string;
}

const RARITY_ORDER = (loot.RARITY as any[]).map((r) => String(r.name));
const QUALITY_ORDER = (engBands() as string[]);

function engBands(): string[] {
  const b = loot.BANDS;
  return Array.isArray(b) ? b.map((x: any) => String(typeof x === 'string' ? x : x?.name ?? x?.id ?? '')) : Object.keys(b || {});
}

const rankOf = (order: string[], value?: string) => {
  const i = order.indexOf(String(value ?? ''));
  return i < 0 ? -1 : i;
};

/** Slot families decide the tile shape; the names come from the roll's own slot list. */
const WEAPONS = ['main hand', 'off hand'];
const JEWELLERY = ['ring', 'amulet', 'belt', 'cape'];
function glyphFor(slot: string, group?: string): SlotEntry['glyph'] {
  if (WEAPONS.includes(slot)) return 'weapon';
  if (JEWELLERY.includes(slot)) return 'jewellery';
  if (slot) return 'armour';
  return group === 'stones' ? 'stone' : group === 'herbs' ? 'herb' : group === 'draughts' || group === 'condensed' ? 'draught' : 'junk';
}

export function gearEntry(item: Item, index: number): SlotEntry {
  return {
    index,
    kind: 'gear',
    title: item.base,
    sub: `${item.rarity} · ${item.quality} · ${item.tier}`,
    item,
    glyph: glyphFor(item.slot),
    rarityRank: rankOf(RARITY_ORDER, item.rarity),
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
    glyph: glyphFor('', stack.group),
    rarityRank: -1,
    qualityRank: -1,
    score: stack.count,
    slot: '',
    count: stack.count,
  };
}

export type SortKey = 'newest' | 'slot' | 'rarity' | 'strength' | 'name';

export const SORT_LABELS: Record<SortKey, string> = {
  newest: 'as it dropped',
  slot: 'by slot',
  rarity: 'by Rarity',
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
  if (key === 'rarity') {
    return list.sort((a, b) => b.rarityRank - a.rarityRank || b.qualityRank - a.qualityRank || b.score - a.score || byName(a, b));
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
