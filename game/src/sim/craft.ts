import { E, loot, MODS, BASES } from '../engine/client';
import { createCraft, QUALITY_STEPS } from '../../../engine/craft.ts';
import { mark as markSnapshot } from './snapshot';
import type { GameState, Item } from './types';

/** The bench calls the shared craft module — one home for the prices and one for the names. */
export const craft: any = createCraft(E, loot);
/** The press name comes from the engine, so a screen never renames a verb for itself. */
export const pressName = (op: string) => craft.pressName(op);
/**
 * A purse key in the player's words. The imprint family is one stone per Mod, and the stone is named
 * for the Mod it carries — the Mod's unit sign is not part of a stone's name.
 */
export const stoneName = (key: string) => craft.STONE_NAME[key]
  || (key.startsWith('imprint_') ? `Imprint — ${lineName(key.slice('imprint_'.length)).replace(/ %$/, '')}` : key);
export const qualitySteps = QUALITY_STEPS;

/** Owned imprint stones as the Mod each carries: the purse key minus its prefix. */
export const imprintStonesOf = (stones: Record<string, number>): { key: string; mod: string }[] =>
  Object.entries(stones || {})
    .filter(([k, v]) => k.startsWith('imprint_') && (v || 0) > 0)
    .map(([k]) => ({ key: k, mod: k.slice('imprint_'.length) }));

export type CraftOp = 'reroll' | 'reroll_random' | 'refine' | 'randomize' | 'reroll_mod' | 'reroll_mod_all'
  | 'ascend' | 'remove' | 'remove_at' | 'add' | 'add_specific' | 'replace' | 'replace_random' | 'replace_all'
  | 'imprint' | 'polish' | 'rebirth'
  | 'upgrade' | 'repair' | 'corrupt';
export type Where = 'gear' | 'bag';

/** The ops that take the piece rather than one named line. */
const PIECE_OPS = new Set<CraftOp>(['ascend', 'add', 'add_specific', 'remove', 'reroll_random',
  'reroll_mod_all', 'replace_all', 'polish', 'rebirth']);

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
  pick?: string,
): CraftResult {
  const item: Item | null = where === 'gear' ? state.gear[index] : state.bag[index];
  if (!item) return { ok: false, why: 'nothing in that slot' };
  if (craft.LOCKED[op]) return { ok: false, why: craft.LOCKED[op] };
  const pool = poolOf(item);
  if (!craft.payable(state.counters.stones, op, item, pick)) {
    return { ok: false, why: `needs ${JSON.stringify(craft.costOf(op, item, pick))}` };
  }
  const FORGE = {
    upgrade: () => craft.upgrade(item, rng),
    repair: () => craft.repair(item),
    corrupt: () => craft.corrupt(item, pool, rng),
  };
  const run: Record<string, () => any> = {
    reroll: () => craft.reroll(item, lineIndex, rng),
    reroll_random: () => craft.rerollRandom(item, rng),
    refine: () => craft.refine(item, lineIndex, rng),
    randomize: () => craft.randomize(item, lineIndex, rng),
    reroll_mod: () => craft.rerollMod(item, lineIndex, pool, rng),
    reroll_mod_all: () => craft.rerollModAll(item, pool, rng),
    ascend: () => craft.ascend(item, rng),
    replace: () => craft.replaceLine(item, lineIndex, pick || '', pool, rng),
    replace_random: () => craft.replaceRandom(item, pick || '', pool, rng),
    replace_all: () => craft.replaceAll(item, pool, rng),
    imprint: () => craft.imprint(item, lineIndex, pick || '', rng),
    add: () => craft.add(item, pool, rng),
    add_specific: () => craft.addSpecific(item, pool, pick || '', rng),
    remove: () => craft.remove(item, rng),
    remove_at: () => craft.removeAt(item, lineIndex),
    polish: () => craft.polish(item, rng),
    rebirth: () => craft.rebirth(item, pool, rng),
    ...FORGE,
  };
  const result = (run[op] || (() => ({ ok: false, why: 'no such craft' })))();
  if (!result.ok) return { ok: false, why: result.why };
  if (!replace(state, where, index, result.item)) return { ok: false, why: 'slot changed under the bench' };
  craft.spend(state.counters.stones, op, item, pick); // the stone is spent even when Corrupt changes nothing
  // a successful Ascend or Refine is a snapshot trigger (`save.md` item 5)
  if (op === 'ascend' || op === 'refine') markSnapshot(state, op);
  const forge = (FORGE as Record<string, string>)[op];
  const note = forge !== undefined ? wholeNote(op, result.changed) : craftNote(op, item, result, lineIndex);
  return { ok: true, item: result.item, note };
}

/**
 * What a press did, in one line the bench can print. An identity change reads as `out → in`; a value
 * change reads as its numbers; a bulk press reads as how many lines it touched.
 */
function craftNote(op: CraftOp, item: Item, result: any, lineIndex: number): string {
  const c = result.changed || {};
  const swap = (ch: any) => `${lineName(ch.out)} → ${lineName(ch.in)}${ch.value != null ? ` ${ch.value}` : ''}${ch.slice != null ? ` at T${ch.slice + 1}` : ''}`;
  if (op === 'ascend') return `quality ${item.quality} → ${result.item.quality}`;
  if (op === 'remove') return `slot ${c.index + 1} removed`;
  if (op === 'remove_at') return `slot ${c.index + 1} removed · ${lineName(c.out)}`;
  if (op === 'replace' || op === 'replace_random' || op === 'imprint') return swap(c);
  if (op === 'reroll_mod') return `slot ${c.index + 1} · ${swap(c)}`;
  if (op === 'rebirth') {
    const touched = Array.isArray(c) ? c : (c.changes || []);
    return `the Unbound set redrawn · ${touched.length} lines · ${touched.map((x: any) => lineName(x.in)).join(', ')}`;
  }
  if (op === 'reroll_mod_all' || op === 'replace_all') {
    const touched = Array.isArray(c) ? c : (c.changes || []);
    return `${touched.length || item.lines.length - 1} lines redrawn · ${touched.map((x: any) => lineName(x.in)).join(', ')}`;
  }
  if (op === 'polish') return `every line rerolled inside its own Tier · ${c.lines} lines, Tiers held`;
  if (op === 'add' || op === 'add_specific') return `${loot.NAME_OF[c.id] || c.id} ${c.value} lands in slot ${result.item.lines.length}`;
  if (op === 'reroll_random') return `slot ${c.index + 1} · ${c.from} → ${c.to}`;
  const line = item.lines[lineIndex];
  return line ? `${loot.NAME_OF[line.id]} ${line.value} → ${result.item.lines[lineIndex]?.value}` : op;
}

/** The lines the Replace stone may bring in on this piece: its own pool, minus what it already wears. */
export function replaceChoices(state: GameState, where: Where, index: number): string[] {
  const item: Item | null = where === 'gear' ? state.gear[index] : state.bag[index];
  return item ? craft.choicesOf(item, poolOf(item)) : [];
}

/** The lines a Replace stone may be pointed at: every line but the Frame Mod. */
export function replaceTargets(state: GameState, where: Where, index: number): number[] {
  return targetsFor(state, where, index, 'piece');
}

/**
 * The lines a Remove stone may take off — everything past the Bound pair. Exposed so any screen that
 * offers the press can print the same count the purse charges for.
 */
export function removeTargets(state: GameState, where: Where, index: number): number[] {
  return targetsFor(state, where, index, 'unbound');
}

/**
 * Which head a verb may cross. `piece` reaches the Bound pair (the identity verbs and the whole-piece
 * stone); `unbound` stops below it. The Frame Mod is in neither — no verb redraws line 1.
 */
export const opScope = (op: CraftOp): 'unbound' | 'piece' =>
  (op === 'reroll_mod' || op === 'reroll_mod_all' || op === 'replace' || op === 'replace_all' || op === 'polish')
    ? 'piece' : 'unbound';

/** Every line one scope holds on this piece. */
export function targetsFor(state: GameState, where: Where, index: number, scope: 'unbound' | 'piece'): number[] {
  const item: Item | null = where === 'gear' ? state.gear[index] : state.bag[index];
  if (!item) return [];
  return item.lines.map((_: any, i: number) => i).slice(scope === 'piece' ? craft.PIECE_FLOOR : craft.UNTOUCHABLE);
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
/** A line an Add stone filled is named as one — the mark rides the slot, so a Rebirth or Replace keeps saying it. */
export const craftedMark = (line: any): string => (line?.crafted ? ' (crafted)' : '');
