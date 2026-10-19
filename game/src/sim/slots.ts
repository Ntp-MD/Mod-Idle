import { E, TOWN, fieldwork } from '../engine/client';
import type { GameState } from './types';

/**
 * The bag as the design defines it: one pool of carried slots, where a kept gear piece takes one slot
 * and a consumable stack takes one, stones and junk stack 999 per slot and are weightless, herbs and
 * potions stack 100 per slot, and gold takes no slot at all (`glossary.md` · `loot.md` §4 ·
 * `engine.json` `inventory`).
 *
 * There is no second, temporary bag: what a kill keeps and what the character carries share the one
 * count, so the number the panel prints is the number every capacity check uses. Nothing here adds a
 * number: the caps, the slot count and the overflow verb all come from `inventory`, and the verb is
 * the one the doc already chose — `stop_pickup` — so a grant that would not fit is simply not made,
 * and is never converted into a different medium or deleted.
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
  { read: (s) => s.fieldwork.materials, cap: 'material', label: 'materials' },
  { read: (s) => s.fieldwork.foods, cap: 'food', label: 'food' },
  { read: (s) => s.junk, cap: 'stone', label: 'junk' },
];

const slotsFor = (count: number, cap: number) => Math.ceil(Math.max(0, count) / cap);

/** One stack the character carries, in the shape the bag grid draws it. */
export interface BagStack {
  /** Stable source key for icon registration; `name` is display-only and may change. */
  key: string;
  name: string;
  group: string;
  capKind: string;
  count: number;
  /** Units weigh what `inventory.unit_weight` says they weigh; stones and junk are weightless. */
  weight: number;
}

/**
 * Every stack in the bag, category by category. `slotsUsed` counts these, so the grid and
 * the slot number can never disagree — the panel draws this list and owns no number of its own.
 */
export function bagStacks(state: GameState): BagStack[] {
  const out: BagStack[] = [];
  for (const b of BUCKETS) {
    const unit = (E.inventory.unit_weight as Record<string, number>)[b.cap] ?? 0;
    for (const [name, total] of Object.entries(b.read(state) || {})) {
      const count = Number(total) || 0;
      if (count <= 0) continue;
      const label = b.cap === 'food'
        ? fieldwork.foodById[name]?.name || name
        : b.cap === 'material' ? fieldwork.materialById[name]?.name || name : name;
      out.push({ key: name, name: label, group: b.label, capKind: b.cap, count, weight: count * unit });
    }
  }
  return out;
}

/** Slots the bag is using now: one per carried gear piece, plus one per full or partial stack. */
export function slotsUsed(state: GameState): number {
  return (state.bag?.length || 0)
    + bagStacks(state)
      .reduce((sum, s) => sum + slotsFor(s.count, (E.inventory.stack_size as Record<string, number>)[s.capKind]), 0);
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
  const cap = (E.inventory.stack_size as Record<string, number>)[capKind];
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
export interface BagCost { bucket: Record<string, number>; key: string; capKind: string; amount: number }

/** Preview the complete bag exchange without consuming costs or granting outputs. */
export function fitsTransaction(state: GameState, costs: BagCost[], grants: BagCost[]): boolean {
  const canonical = new Map(BUCKETS.map((entry) => [entry.read(state), entry.cap]));
  const grouped = new Map<Record<string, number>, Map<string, { costs: number; grants: number }>>();
  for (const [entries, kind] of [[costs, 'costs'], [grants, 'grants']] as const) {
    for (const entry of entries) {
      const cap = INV.stack_size[entry.capKind];
      if (!Number.isSafeInteger(entry.amount) || entry.amount < 0
        || !Number.isSafeInteger(cap) || cap <= 0 || canonical.get(entry.bucket) !== entry.capKind) return false;
      let keys = grouped.get(entry.bucket);
      if (!keys) { keys = new Map(); grouped.set(entry.bucket, keys); }
      const total = keys.get(entry.key) || { costs: 0, grants: 0 };
      total[kind] += entry.amount;
      if (!Number.isSafeInteger(total[kind])) return false;
      keys.set(entry.key, total);
    }
  }
  // the one pool: kept gear pieces take a slot each, and the stacks below take theirs out of the same count
  let used = state.bag?.length || 0;
  for (const [bucket, capKind] of canonical) {
    const cap = INV.stack_size[capKind];
    if (!Number.isSafeInteger(cap) || cap <= 0) return false;
    const changes = grouped.get(bucket);
    const keys = new Set([...Object.keys(bucket), ...(changes?.keys() || [])]);
    for (const key of keys) {
      const before = Object.hasOwn(bucket, key) ? bucket[key] : 0;
      const change = changes?.get(key);
      if (!Number.isSafeInteger(before) || before < 0 || (change?.costs || 0) > before) return false;
      const after = before - (change?.costs || 0) + (change?.grants || 0);
      if (!Number.isSafeInteger(after) || after < 0) return false;
      used += slotsFor(after, cap);
      if (!Number.isSafeInteger(used)) return false;
    }
  }
  const available = slotsAvailable(state);
  return Number.isSafeInteger(available) && available >= 0 && used <= available;
}

export const fits = (state: GameState, bucket: Record<string, number>, key: string, capKind: string, amount: number, costs: BagCost[] = []): boolean => {
  const cap = (E.inventory.stack_size as Record<string, number>)[capKind];
  let before = bucket[key] || 0;
  let freed = 0;
  for (const cost of costs) {
    const count = cost.bucket[cost.key] || 0;
    if (cost.amount < 0 || count < cost.amount) return false;
    const costCap = (E.inventory.stack_size as Record<string, number>)[cost.capKind];
    freed += slotsFor(count, costCap) - slotsFor(count - cost.amount, costCap);
    if (cost.bucket === bucket && cost.key === key) before -= cost.amount;
  }
  return slotsFor(before + amount, cap) - slotsFor(before, cap) <= slotsFree(state) + freed;
};

/** Extra bag slots the Porter's pouch lines sold — each is a `space` line. */
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
