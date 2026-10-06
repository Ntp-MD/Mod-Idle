import { E, TOWN } from '../engine/client';
import type { GameState } from './types';

/**
 * The character bag as the design defines it: thirty slots of carried consumables, where stones and
 * junk stack 999 per slot and are weightless, herbs and potions stack 100 per slot, and gold takes no
 * slot at all (`glossary.md` · `loot.md` §4 · `engine.json` `inventory`).
 *
 * Until now the client counted every one of those media as an unbounded number, so the bag existed
 * on paper only until this module. Nothing here adds a number: the caps, the slot count and the
 * overflow verb all come from `inventory`, and the verb is the one the doc already chose —
 * `stop_pickup` — so a grant that would not fit is simply not made, and is never converted into a
 * different medium or deleted.
 */

const INV = E.inventory as {
  character_slots: number;
  stack_size: Record<string, number>;
  overflow: string;
  gold_uses_slot: boolean;
};

/** Where each category's stacks live on the state, and which cap governs them. */
const BUCKETS: { read: (s: GameState) => Record<string, number>; cap: string; label: string }[] = [
  { read: (s) => s.counters.stones, cap: 'stone', label: 'stones' },
  { read: (s) => s.farm.herbs, cap: 'herb', label: 'herbs' },
  { read: (s) => s.farm.potions, cap: 'potion', label: 'draughts' },
  { read: (s) => s.farm.condensed, cap: 'potion', label: 'condensed' },
  { read: (s) => s.junk, cap: 'stone', label: 'junk' },
];

const slotsFor = (count: number, cap: number) => Math.ceil(Math.max(0, count) / cap);

/** One stack the character carries, in the shape the bag grid draws it. */
export interface BagStack {
  name: string;
  group: string;
  capKind: string;
  count: number;
  /** Units weigh what `inventory.unit_weight` says they weigh; stones and junk are weightless. */
  weight: number;
}

/**
 * Every stack in the character bag, category by category. `slotsUsed` counts these, so the grid and
 * the slot number can never disagree — the panel draws this list and owns no number of its own.
 */
export function bagStacks(state: GameState): BagStack[] {
  const out: BagStack[] = [];
  for (const b of BUCKETS) {
    const unit = (E.inventory.unit_weight as Record<string, number>)[b.cap] ?? 0;
    for (const [name, total] of Object.entries(b.read(state) || {})) {
      const count = Number(total) || 0;
      if (count <= 0) continue;
      out.push({ name, group: b.label, capKind: b.cap, count, weight: count * unit });
    }
  }
  return out;
}

/** Slots the bag is using now: one per full or partial stack, by category. */
export function slotsUsed(state: GameState): number {
  return bagStacks(state)
    .reduce((sum, s) => sum + slotsFor(s.count, E.inventory.stack_size[s.capKind]), 0);
}

export const slotsFree = (state: GameState): number => slotsAvailable(state) - slotsUsed(state);

/**
 * Add to one stack under its cap, honouring `stop_pickup`: an amount that would need more slots than
 * the bag has is refused whole rather than partly taken, and nothing is deleted or re-minted.
 * Returns how much actually went in, so the caller can be truthful about what the player got.
 */
export function addTo(
  state: GameState,
  bucket: Record<string, number>,
  key: string,
  capKind: string,
  amount: number,
): number {
  if (amount <= 0) return 0;
  const cap = E.inventory.stack_size[capKind];
  const before = bucket[key] || 0;
  const need = slotsFor(before + amount, cap) - slotsFor(before, cap);
  if (need > slotsFree(state)) {
    state.counters.stopped = (state.counters.stopped || 0) + 1;
    return 0;
  }
  bucket[key] = before + amount;
  return amount;
}

/** Would a grant of this size fit? Used by producers that must not consume a cost they can't bank. */
export const fits = (state: GameState, bucket: Record<string, number>, key: string, capKind: string, amount: number): boolean => {
  const cap = E.inventory.stack_size[capKind];
  const before = bucket[key] || 0;
  return slotsFor(before + amount, cap) - slotsFor(before, cap) <= slotsFree(state);
};

/** Extra character-bag slots the Porter's pouch lines sold — each is a `space` line. */
export function pouchSlots(state: GameState): number {
  const owned = (state.town && state.town.owned) || [];
  let granted = 0;
  for (const id of owned) {
    const row = (TOWN.one_time as any[]).find((r) => r.id === id);
    if (row && row.character_slot_grant) granted += row.character_slot_grant;
  }
  return granted;
}

/** The bag the character actually carries: the published base plus the space it bought. */
export const slotsAvailable = (state: GameState): number => INV.character_slots + pouchSlots(state);

export const bagSlots = INV.character_slots;
