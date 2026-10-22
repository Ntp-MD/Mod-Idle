import { E, loot } from '../engine/client';
import { atSettlement, craft, lineTier, opScope, replaceChoices, type CraftOp, type Where } from '../sim/craft';
import type { GameState, Item } from '../sim/types';

export type StoneMode = { op: CraftOp; target: 'piece' | 'line'; pick?: boolean };
/** Interaction choices only. Prices, reach and results remain owned by the crafting engine. */
export const STONE_MODES: Record<string, StoneMode[]> = {
  reroll_value: [{ op: 'reroll_random', target: 'piece' }, { op: 'reroll', target: 'line' }],
  tier: [{ op: 'refine', target: 'line' }, { op: 'randomize', target: 'line' }, { op: 'reroll_mod', target: 'line' }, { op: 'reroll_mod_all', target: 'piece' }],
  add: [{ op: 'add', target: 'piece' }, { op: 'add_specific', target: 'piece', pick: true }, { op: 'ascend', target: 'piece' }],
  remove: [{ op: 'remove', target: 'piece' }, { op: 'remove_at', target: 'line' }],
  replace: [{ op: 'replace', target: 'line', pick: true }, { op: 'replace_random', target: 'piece', pick: true }, { op: 'replace_all', target: 'piece' }],
  quality: [{ op: 'upgrade', target: 'piece' }],
  repair: [{ op: 'repair', target: 'piece' }],
  corrupt: [{ op: 'corrupt', target: 'piece' }],
  polish: [{ op: 'polish', target: 'piece' }],
  reforge: [{ op: 'reforge', target: 'piece' }],
  rebirth: [{ op: 'rebirth', target: 'piece' }],
};

/** The whole-piece/rare presses are one click away, never the first thing a new player meets. */
export const ADVANCED_OPS = new Set<CraftOp>(['reroll_mod_all', 'replace_all', 'ascend', 'imprint', 'polish', 'reforge', 'rebirth', 'corrupt']);
export const ADVANCED_STONES = new Set(['corrupt', 'polish', 'reforge', 'rebirth']);
export const isAdvancedStone = (key: string): boolean => key.startsWith('imprint_') || ADVANCED_STONES.has(key);

export const modesForStone = (key: string, advanced = false): StoneMode[] => {
  const modes = key.startsWith('imprint_')
    ? [{ op: 'imprint', target: 'line' } as StoneMode] : STONE_MODES[key] || [];
  return advanced ? modes : modes.filter((mode) => !ADVANCED_OPS.has(mode.op));
};

export function stoneUseReason(
  game: GameState, item: Item | null, where: Where | null, index: number,
  mode: StoneMode, line: number | null, pick: string, writer: boolean,
): string {
  if (!writer) return 'Read-only. Take account control before crafting.';
  if (!atSettlement(game)) return 'Gear crafting is available at a settlement.';
  if (!item || where == null || index < 0) return 'Choose an item from your equipment, bag or Stash.';
  if (craft.LOCKED[mode.op]) return craft.LOCKED[mode.op];
  const gate = craft.guard(item, mode.op);
  if (!gate.ok) return gate.why;
  if (mode.pick && (!pick || !replaceChoices(game, where, index).includes(pick))) return 'Choose the Mod to write first.';
  if (mode.op === 'imprint' && !pick) return 'Choose an Imprint Stone first.';
  if (mode.op === 'imprint') {
    const taken = new Set<string>(item.lines.flatMap((entry) => [entry.id, ...(entry.extra || []).map((extra) => extra.id)]));
    if (!loot.NAME_OF[pick]) return 'This Imprint Stone does not name a known Mod.';
    if (taken.has(pick)) return 'This item already carries that Mod.';
    if (loot.blockedBy(taken).has(pick)) return 'That Mod is blocked on this item.';
  }
  if (mode.target === 'line') {
    if (line == null) return 'Click a highlighted Mod line on the item.';
    const editable = craft.editable(item, line, opScope(mode.op) === 'piece' ? craft.PIECE_FLOOR : craft.UNTOUCHABLE);
    if (!editable.ok) return editable.why;
    if (mode.op === 'refine' && lineTier(item.lines[line]) === 'T1') return 'This Mod is already T1.';
  }
  if (['remove', 'reroll_random', 'rebirth'].includes(mode.op) && !craft.editableCount(item, craft.UNTOUCHABLE)) return 'This item has no Unbound Mod to change.';
  if (['reroll_mod_all', 'replace_all'].includes(mode.op) && !craft.editableCount(item, craft.PIECE_FLOOR)) return 'The Frame Mod cannot be replaced. This item has no other Mod.';
  if (mode.op === 'ascend' && (item.q ?? 0) >= craft.QUALITY_STEPS.length - 1) return 'This item is already in the highest quality band.';
  if (mode.op === 'add' || mode.op === 'add_specific') {
    const dropped = item.unbound_at_drop ?? Math.max(0, item.lines.length - craft.UNTOUCHABLE - (item.mods_added || 0));
    const added = item.lines.length - craft.UNTOUCHABLE - dropped;
    if (added >= E.item_level.mods_added_cap) return 'This item has used all its additional Mod slots.';
    if (item.lines.length >= E.item_level.crafted_max) return 'This item has no open Mod slot.';
  }
  if (!craft.payable(game.counters.stones, mode.op, item, pick || undefined)) return 'Not enough stones for this use. Check the cost below.';
  return '';
}
