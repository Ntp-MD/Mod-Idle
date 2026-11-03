import type { CraftOp, Where } from '@sim/gear/craft';
import type { Item } from '@sim/core/types';

/** A contextual open asks the board to show one piece once, after it has measured the grid. */
export interface CraftReveal {
  where: Where;
  item: Item;
}

/** Browsing choices survive panel navigation; an armed stone is always local to an open bench. */
export interface CraftWorkbenchView {
  advanced: boolean;
  stoneQuery: string;
  stonePage: number;
  selectedKey: string;
  modeOp: CraftOp;
  chosenMod: string;
  sourceTab: 'inventory' | 'equipped' | 'stash';
  stashQuery: string;
  bagQuery: string;
  stashItem: Item | null;
  gearPage: number;
  bagPage: number;
  stashPage: number;
  reveal: CraftReveal | null;
}

export const newCraftWorkbenchView = (): CraftWorkbenchView => ({
  advanced: false, stoneQuery: '', stonePage: 0, selectedKey: '', modeOp: 'reroll_random',
  chosenMod: '', sourceTab: 'inventory', stashQuery: '', bagQuery: '', stashItem: null,
  gearPage: 0, bagPage: 0, stashPage: 0, reveal: null,
});

/** The page a revealed piece lands on, once the source grid has a real capacity. */
export function revealPageFor(entries: readonly { item?: Item | null }[], item: Item, capacity: number): number | null {
  const position = entries.findIndex((entry) => entry.item === item);
  return position < 0 ? null : Math.floor(position / Math.max(1, capacity));
}

export type CraftRevealStep =
  | { kind: 'none' }
  | { kind: 'wait' }
  | { kind: 'missing' }
  | { kind: 'page'; page: number | null };

/** How an open contextual request resolves against the source grid the player can actually see. */
export function nextCraftReveal(
  view: Pick<CraftWorkbenchView, 'reveal'>,
  entries: readonly { item?: Item | null }[],
  sourceCapacity: number,
  measuredSource: 'inventory' | 'equipped' | 'stash' | null,
): CraftRevealStep {
  const reveal = view.reveal;
  if (!reveal) return { kind: 'none' };
  if (reveal.where === 'bag' && measuredSource !== 'inventory') return { kind: 'wait' };
  const page = revealPageFor(entries, reveal.item, sourceCapacity);
  if (page == null) return { kind: 'missing' };
  return { kind: 'page', page: reveal.where === 'bag' ? page : null };
}
