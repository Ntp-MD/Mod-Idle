import { BASES, loot } from '../../engine/client';
import { itemName } from './item-name';
import { push } from '../core/game';
import { refresh as refreshFilter } from './filter';
import { slotsFree } from './slots';
import type { GameState, Item } from '../core/types';

/**
 * Wearing a piece.
 *
 * This is the player's decision and nothing else unless Auto Equip is enabled: then a better carried drop
 * takes that decision automatically. It lives here rather than in the panel because the rule it enforces —
 * one piece per slot, the displaced one back into the bag — is sim behaviour the tests must reach, and
 * stat-bearing logic is kept out of a component.
 *
 * `autoEquip` below applies the same decision either from the player's press or the enabled client setting.
 */

/** Which line a piece's +N feeds, and how much it has added so far. Weapons and the jewellery slots
 * have no school, so they have nothing to raise (`item-base.md`). */
export function gearModOf(item: Item): { stat: string | null; value: number } {
  const school = (BASES.bases.find((b: any) => b.name === item.base) as any)?.school || null;
  return { stat: school, value: school ? item.gearMod || 0 : 0 };
}

/** The strength number the whole client already agrees on: `loot.md` §4, the same one the bag filter and
 *  the item card's "against the worn piece" read. Nothing here invents a second measure of good. */
const scoreOf = (item: Item) => loot.score({ ...item, q: item.q ?? 0 });

/** How much stronger one piece is than another, in the percent the filter's margin is set in. */
const gainPct = (better: Item, worse: Item | null): number => {
  const base = worse ? scoreOf(worse) : 0;
  const mine = scoreOf(better);
  if (!(base > 0)) return mine > 0 ? Infinity : 0;
  return ((mine - base) / base) * 100;
};

/** The cell a piece wears into, or -1 when the body has no room for it.
 *
 *  A slot the body carries two of — the ring pair — has to be *filled* before it is swapped, and the swap
 *  has to take the weaker of the pair. The old search took the first cell naming the slot, which is a worn
 *  ring ahead of the empty one beside it, so a second ring could never be worn and each press replaced
 *  the last one. A two-hander keeps the rule it always had: it belongs in the main hand it displaces. */
function cellFor(gear: (Item | null)[], item: Item, protectLocked = false): number {
  const free = gear.findIndex((g, i) => !g && loot.SLOTS[i] === item.slot);
  const same = gear
    .map((g, i) => (g && g.slot === item.slot && (!protectLocked || !g.locked) ? i : -1))
    .filter((i) => i >= 0);
  const weakest = same.length ? same.reduce((a, b) => (scoreOf(gear[b]!) < scoreOf(gear[a]!) ? b : a)) : -1;
  if (item.slot === 'main hand' && weakest >= 0) return weakest;
  if (free >= 0) return free;
  if (weakest >= 0) return weakest;
  return -1;
}

/** Wear the piece at `bagIndex`; the piece it displaces goes back to the front of the bag. */
export function equipFromBag(s: GameState, bagIndex: number, quiet = false, protectLocked = false): { ok: boolean; why?: string } {
  const item = s.bag[bagIndex];
  if (!item) return { ok: false, why: 'nothing in that bag slot' };
  if (item.broken) return { ok: false, why: 'Broken — Repair it before equipping' };
  const gear = [...s.gear];
  const at = cellFor(gear, item, protectLocked);
  if (at < 0) return { ok: false, why: 'no empty slot left to wear it in' };
  const prev = gear[at];
  // a swap is slot-neutral — the piece leaves the bag and the one it displaced takes its place — so a
  // full bag is never a reason to refuse a swap; a take-off still needs a free slot of its own.
  // a Stat Mod line already carries its own Core attribute, baked at drop, so wearing changes
  // nothing about it — the piece is worn exactly as it was rolled
  gear[at] = { ...item };
  // Wearing a reserved Collector piece is the player's choice to use it in the build.
  delete gear[at]!.heldFor;
  s.bag.splice(bagIndex, 1);
  if (prev) s.bag.unshift(prev);
  s.gear = gear;
  refreshFilter(s); // the "not yet found" keep-list is read from what is actually worn
  if (!quiet) push(s, `Equipped ${itemName(item)} in ${item.slot}${prev ? `, ${itemName(prev)} to the bag` : ''}`);
  return { ok: true };
}

/**
 * Take one body cell off and put the piece at the front of the bag — the drag-back and the "take off"
 * verb. The bag holding no room refuses rather than dropping anything, the same way a deposit does.
 */
export function unequip(s: GameState, cell: number, quiet = false): { ok: boolean; why?: string } {
  const item = s.gear[cell];
  if (!item) return { ok: false, why: 'nothing is worn in that slot' };
  if (slotsFree(s) < 1) return { ok: false, why: 'the bag is full' };
  const gear = [...s.gear];
  gear[cell] = null;
  s.gear = gear;
  s.bag.unshift(item);
  refreshFilter(s);
  if (!quiet) push(s, `Took off ${itemName(item)}`);
  return { ok: true };
}

export interface EquipSwap {
  slot: string;
  base: string;
  /** the piece it took off, or null when this piece filled a cell that was bare */
  instead: string | null;
  /** the percent the new piece is ahead by — Infinity is an empty cell, which is always worth filling */
  gains: number;
  /** The Collector set a worn piece was reserved for; wearing it releases the reservation. */
  heldFor?: string | null;
}

/**
 * Auto Equip leaves locked and Broken pieces alone. A Collector reservation can be released when
 * its item is a real upgrade, so an early set request never blocks the character's gear.
 */
const untouchable = (item: Item) =>
  item.locked ? 'locked' : item.broken ? 'Broken' : null;

export interface EquipResult {
  swaps: EquipSwap[];
  /** carried pieces still left alone after the press */
  spared: { locked: number; set: number; broken: number };
  /** stored pieces that would beat something worn — the warehouse is reported, never raided */
  inStash: number;
}

/**
 * Put on the best gear the character is carrying.
 *
 * The principle, since the owner left it to be chosen: **best is the engine's own strength number, not a
 * new one.** `loot.score` (Σ weight × value ÷ Total, `loot.md` §4) already decides what the bag filter
 * keeps and what the item card calls stronger, so an auto-pick that used any other measure would disagree
 * with both. On top of that number the rule is four lines long:
 *
 * - A swap must be **strictly** ahead, and by at least `marginPct`, so it never trades a piece for
 *   nothing and a body never churns over a rounding error. An empty cell is always worth filling.
 * - **Nothing the player pinned moves** — locked and Broken pieces stay put. A Collector reservation
 *   yields to an upgrade, and wearing clears the reservation.
 * - **Only what the character carries** is worked: worn gear and the carried pieces. The warehouse is a decision
 *   away, so the result counts what is better in there instead of quietly emptying it into the body.
 * - **Auto Equip is enabled or the player pressed it.** Either path reads this same rule.
 *
 * Each pass re-reads the carried pieces, because wearing one piece shifts every index after it.
 */
export function autoEquip(s: GameState, marginPct = 0): EquipResult {
  const swaps: EquipSwap[] = [];
  let refused: string | null = null;
  // one swap per cell the body owns is the most any press can do, so the pass count is bounded by the body
  for (let pass = 0; pass < s.gear.length; pass++) {
    // the whole carried list read against the body it has now, then the single best swap taken. It is
    // re-read every pass because wearing a piece shifts every index after it.
    const best = s.bag
      .map((item, bagIndex) => ({ item, bagIndex }))
      .filter((p): p is { item: Item; bagIndex: number } => Boolean(p.item) && !untouchable(p.item!))
      .map((p) => {
        const cell = cellFor(s.gear, p.item, true);
        const worn = cell >= 0 ? s.gear[cell] : null;
        return { ...p, cell, worn, gains: cell >= 0 ? gainPct(p.item, worn) : 0 };
      })
      .filter((p) => p.cell >= 0 && p.gains > marginPct)
      .sort((a, b) => b.gains - a.gains)[0];
    if (!best) break;
    const reservation = best.item.heldFor || null;
    const wore = equipFromBag(s, best.bagIndex, true, true);
    if (!wore.ok) { refused = wore.why ?? 'refused'; break; }
    swaps.push({ slot: best.item.slot, base: itemName(best.item), instead: best.worn ? itemName(best.worn) : null, gains: best.gains, heldFor: reservation });
  }
  const spared = s.bag.reduce(
    (acc, item) => {
      const why = item && untouchable(item);
      if (why === 'locked') acc.locked++;
      else if (item?.heldFor) acc.set++;
      else if (why === 'Broken') acc.broken++;
      return acc;
    },
    { locked: 0, set: 0, broken: 0 },
  );
  const inStash = s.stash.reduce(
    (n, tab) => n + tab.filter((item) => {
      if (!item || untouchable(item) || item.heldFor) return false;
      const at = cellFor(s.gear, item, true);
      return at >= 0 && gainPct(item, s.gear[at]) > marginPct;
    }).length,
    0,
  );
  // assembled, not nested: a template literal inside a template literal is where this file's parser bites
  const where = (w: EquipSwap) => w.gains === Infinity ? `${w.slot} into a free cell` : `${w.slot} +${w.gains.toFixed(0)}%`;
  if (swaps.length) {
    push(s, `Best gear on — ${swaps.length} piece${swaps.length === 1 ? '' : 's'} went up: ${swaps.map(where).join(', ')}`);
  } else if (refused) {
    // a refusal is its own answer: the press heard "nothing better is carried" and that would be a lie
    push(s, `Nothing went on — ${refused}`);
  } else {
    const held = spared.locked + spared.set + spared.broken;
    push(s, `Nothing to change — what you wear is already the best you carry`
      + (held ? `, and ${held} piece${held === 1 ? '' : 's'} in the bag are left alone (locked, promised to a set, or Broken)` : ''));
  }
  return { swaps, spared, inStash };
}
