import { E, loot } from '../engine/client';
import type { GameState } from './types';

/**
 * The bag filter's stored settings (`save.md` · `loot.md` §4).
 *
 * Every rule is per slot, because the doc's own example is a per-slot decision (a tighter margin on a
 * slot that already has a good piece, the Element keep-list off while farming one Element). The default
 * margin is the published swap margin read straight from `engine.json`, so raising one slot is a player
 * setting and never a second copy of the number.
 */

export interface SlotRule {
  /** Off by default: an off slot keeps every drop and dissolves nothing. */
  enabled: boolean;
  /** Keep a drop only when it outscores the piece worn in that slot by more than this. */
  margin_pct: number;
  /** Elemental res of an Element the player has no answer to is always kept. */
  keep_missing_element: boolean;
}

export interface FilterState {
  bySlot: Record<string, SlotRule>;
  /** "Elements/slots the player has not yet found" — a filter condition, so it is stored. */
  missing: { elements: string[]; slots: string[] };
}

/** The slots the filter can be tuned per, with the duplicated ring slots folded into one row. */
export const FILTER_SLOTS: string[] = [...new Set((loot.SLOTS as string[]).map(String))];

const DEFAULT_RULE: SlotRule = {
  enabled: E.loot.filter.rules.default_enabled,
  margin_pct: E.loot.filter.upgrade_margin_pct,
  keep_missing_element: E.loot.filter.rules.default_keep_missing_element,
};

const clone = (r: SlotRule): SlotRule => ({ ...r });

export function newFilter(): FilterState {
  const bySlot: Record<string, SlotRule> = {};
  for (const slot of FILTER_SLOTS) bySlot[slot] = clone(DEFAULT_RULE);
  return { bySlot, missing: { elements: [...loot.ELEMENTS], slots: [...FILTER_SLOTS] } };
}

/** The rule one slot runs, falling back to the published default if the save predates a slot. */
export function ruleFor(f: FilterState | undefined, slot: string): SlotRule {
  return f?.bySlot[slot] || clone(DEFAULT_RULE);
}

/** Edit one slot, or every slot at once when `slot` is 'all'. */
export function setRule(f: FilterState, slot: string, patch: Partial<SlotRule>): FilterState {
  const targets = slot === 'all' ? FILTER_SLOTS : [slot];
  for (const s of targets) f.bySlot[s] = { ...ruleFor(f, s), ...patch };
  return f;
}

/** Re-read the keep-list from what is actually worn (`loot.md` §4). */
export function refresh(s: GameState): FilterState['missing'] {
  const found = loot.notYetFound(s.gear);
  s.filter.missing = { elements: found.elements, slots: found.slots };
  return s.filter.missing;
}

/** The Elements the player cannot resist yet — the set the filter's second keep-reason reads. */
export const coveredElements = (s: GameState): Set<string> => loot.notYetFound(s.gear).covered;

/** How the bench should phrase one slot's rule, using only words the design already uses. */
export function describeRule(rule: SlotRule): string {
  if (!rule.enabled) return 'filter off — every drop is kept';
  const parts = [`+${rule.margin_pct}% to keep`];
  if (!rule.keep_missing_element) parts.push('an unknown Element does not count');
  return parts.join(' · ');
}
