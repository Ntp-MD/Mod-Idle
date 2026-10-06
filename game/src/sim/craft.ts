import { E, loot, MODS, BASES } from '../engine/client';
import { createCraft, QUALITY_STEPS } from '../../../engine/craft.ts';
import { mark as markSnapshot } from './snapshot';
import type { GameState, Item } from './types';

/** The bench calls the shared craft module — the same prices `crafting.md` prints. */
export const craft: any = createCraft(E, loot);
export const stoneName = (key: string) => craft.STONE_NAME[key] || key;
export const qualitySteps = QUALITY_STEPS;

export type CraftOp = 'reroll' | 'refine' | 'randomize' | 'ascend' | 'remove' | 'add'
  | 'upgrade' | 'repair' | 'corrupt';
export type Where = 'gear' | 'bag';

/**
 * The pool a piece may draw from on lines 2-7 (item-base.md): the slot's union of Bases plus
 * the lines the slot adds on its own. One list for the whole piece — `loot.poolFor` owns it, so the
 * bench and the drop roll cannot disagree about what a Base may carry.
 */
export function poolOf(item: Item): string[] {
  const frame = BASES.bases.find((b: any) => b.name === item.base && b.slot === item.slot) || null;
  const weapon = frame ? null : BASES.weapons.find((w: any) => item.base === w.name) || null;
  return loot.poolFor(BASES, item.slot, frame, weapon).map((e: any) => e.id);
}

export interface CraftResult { ok: boolean; why?: string; item?: Item; note?: string }

/** Every craft in the game is Settlement-only (`crafting.md`). */
export function atSettlement(state: GameState): boolean {
  return Boolean(state.town.visited.includes(state.town.waypoint)) && state.phase !== 'camp';
}

export function stoneNames(op: CraftOp, item?: Item): Record<string, number> {
  return craft.costOf(op, item);
}

function replace(state: GameState, where: Where, index: number, item: Item): boolean {
  if (where === 'gear') {
    if (!state.gear[index]) return false;
    state.gear[index] = item;
  } else {
    if (!state.bag[index]) return false;
    state.bag[index] = item;
  }
  return true;
}

/** Run one craft on one line of one piece, paying the stones the shared module prices. */
export function doCraft(
  state: GameState,
  where: Where,
  index: number,
  op: CraftOp,
  lineIndex: number,
  rng: () => number,
): CraftResult {
  const item: Item | null = where === 'gear' ? state.gear[index] : state.bag[index];
  if (!item) return { ok: false, why: 'nothing in that slot' };
  if (craft.LOCKED[op]) return { ok: false, why: craft.LOCKED[op] };
  // Upgrade and Corrupt take the whole piece, and Repair takes nothing but the stone
  const whole = op === 'upgrade' || op === 'repair' || op === 'corrupt';
  if (!craft.payable(state.counters.stones, op, item)) {
    return { ok: false, why: `needs ${JSON.stringify(craft.costOf(op, item))}` };
  }
  const result = whole
    ? (op === 'upgrade' ? craft.upgrade(item, rng)
      : op === 'repair' ? craft.repair(item)
        : craft.corrupt(item, poolOf(item), rng))
    : op === 'reroll' ? craft.reroll(item, lineIndex, rng)
      : op === 'refine' ? craft.refine(item, lineIndex, rng)
        : op === 'randomize' ? craft.randomize(item, lineIndex, rng)
          : op === 'ascend' ? craft.ascend(item, rng)
            : op === 'add' ? craft.add(item, poolOf(item), rng)
              : craft.remove(item, rng);
  if (!result.ok) return { ok: false, why: result.why };
  if (!replace(state, where, index, result.item)) return { ok: false, why: 'slot changed under the bench' };
  craft.spend(state.counters.stones, op, item); // the stone is spent even when Corrupt changes nothing
  // a successful Ascend or Refine is a snapshot trigger (`save.md` item 5)
  if (op === 'ascend' || op === 'refine') markSnapshot(state, op);
  const line = item.lines[lineIndex];
  const note = whole ? wholeNote(op, result.changed)
    : op === 'ascend' ? `quality ${item.quality} → ${result.item.quality}`
    : op === 'remove' ? `slot ${result.changed.index + 1} removed`
      : op === 'add' ? `${loot.NAME_OF[result.changed.id] || result.changed.id} ${result.changed.value} lands in slot ${result.item.lines.length}`
        : line ? `${loot.NAME_OF[line.id]} ${line.value} → ${result.item.lines[lineIndex]?.value}`
          : op;
  return { ok: true, item: result.item, note };
}

/** Say a whole-piece craft in the words the ladder uses, so the bench reports what actually happened. */
function wholeNote(op: CraftOp, changed: any): string {
  if (op === 'repair') return `repaired at +${changed.level} with ${changed.protection_left} charges of protection`;
  if (op === 'corrupt') return `corrupted · ${String(changed.outcome).replace(/_/g, ' ')}`;
  const outcome = ({ up: 'reached', dropped: 'failed and dropped to', protected: 'protection spent, down to', broken: 'BROKEN at' } as Record<string, string>)[changed.outcome];
  return `${outcome || 'failed at'} +${changed.level} (${Math.round(changed.chance)}% chance)`;
}

/** The bench needs the Mod name for a line, which mods.json owns. */
export const lineName = (id: string) => (MODS.mods.find((m: any) => m.id === id)?.name) || id;
export const lineTier = (line: any) => (line.slice == null ? '—' : `T${line.slice + 1}`);
