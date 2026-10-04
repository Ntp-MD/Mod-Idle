import { E, BASES } from '../engine/client';
import { push } from './game';
import { refresh as refreshFilter } from './filter';
import type { StatKey } from '../engine/client';
import type { GameState, Item } from './types';

/**
 * Wearing a piece.
 *
 * This is the player's decision and nothing else (`harness/decisions.md` D-089 — no auto-pick), so
 * the idle loop never calls it: a kept drop waits in the bag until someone chooses. It lives here
 * rather than in the panel because the rule it enforces — one piece per slot, the displaced one back
 * into the bag — is sim behaviour the tests must reach, and `harness/handoff.md` keeps stat-bearing
 * logic out of a component.
 */

/** The stat a `Stat Mod` line was told to feed; a piece nobody chose for lands on Str. */
export function statChoiceOf(item: Item): StatKey {
  const chosen = (item as any).chosenStat as StatKey | undefined;
  return chosen || 'str';
}

/** Which line a piece's +N feeds, and how much it has added so far. Weapons and the jewellery slots
 * have no school, so they have nothing to raise (`item-base.md` · D-104). */
export function gearModOf(item: Item): { stat: string | null; value: number } {
  const school = (BASES.bases.find((b: any) => b.name === item.base) as any)?.school || null;
  return { stat: school, value: school ? item.gearMod || 0 : 0 };
}

/** Equip the piece at `bagIndex`; the piece it displaces goes back to the front of the bag. */
export function equipFromBag(s: GameState, bagIndex: number): { ok: boolean; why?: string } {
  const item = s.bag[bagIndex];
  if (!item) return { ok: false, why: 'nothing in that bag slot' };
  const gear = [...s.gear];
  const target = gear.findIndex((g) => g === null || g.slot === item.slot);
  const slotIndex = item.slot === 'main hand' ? gear.findIndex((g) => g && g.slot === 'main hand') : target;
  const at = slotIndex >= 0 ? slotIndex : gear.findIndex((g) => g === null);
  if (at < 0) return { ok: false, why: 'no empty slot left to wear it in' };
  const prev = gear[at];
  const lines = item.lines.map((l) =>
    l.id === 'stat_mod_flat' ? { ...l, stat: statChoiceOf(item) } : l
  );
  gear[at] = { ...item, lines };
  s.bag.splice(bagIndex, 1);
  if (prev) s.bag.unshift(prev);
  if (s.bag.length > E.inventory.adventure_slots) s.bag.length = E.inventory.adventure_slots;
  s.gear = gear;
  refreshFilter(s); // the "not yet found" keep-list is read from what is actually worn
  push(s, `Equipped ${item.base} in ${item.slot}${prev ? `, ${prev.base} to the bag` : ''}`);
  return { ok: true };
}
