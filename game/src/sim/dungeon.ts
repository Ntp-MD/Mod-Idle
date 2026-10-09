import { dungeon as D } from '../engine/client';
import { addTo } from './slots';
import type { GameState, Item } from './types';

/**
 * One open dungeon run. A run is a mode, not a place: the sim never reads a coordinate (M7),
 * it only knows a run is open. Loot waits in `escrow` until the last mob falls; a Push ends the
 * run at once and the escrow is forfeited, never paid.
 */
export interface DungeonEscrow {
  items: Item[];
  junk: Record<string, number>;
  stones: Record<string, number>;
  herbs: Record<string, number>;
  potions: Record<string, number>;
}

export interface DungeonRun {
  zone: number;
  left: number;
  total: number;
  escrow: DungeonEscrow;
}

export const newEscrow = (): DungeonEscrow => ({ items: [], junk: {}, stones: {}, herbs: {}, potions: {} });

export const cooldownLeft = (s: GameState): number => D.cooldownLeft(s.clockSec, s.dungeonClearedAt);

/**
 * Open a run in the zone the character stands in. Entry needs no active run, a cold dungeon,
 * feet on the ground (no walk) and a character out of camp.
 */
export function enterDungeon(s: GameState): { ok: boolean; why?: string } {
  if (s.dungeon) return { ok: false, why: 'already inside a dungeon' };
  if (!D.canEnter(s.clockSec, s.dungeonClearedAt, !!s.dungeon)) {
    return { ok: false, why: `cooling down — ${cooldownLeft(s)}s left` };
  }
  if (s.walk) return { ok: false, why: 'mid-walk — finish the route first' };
  if (s.phase === 'camp') return { ok: false, why: 'recovering at camp' };
  if (s.group.length) return { ok: false, why: 'finish the fight first' };
  s.dungeon = { zone: s.zone, left: D.mobCap, total: D.mobCap, escrow: newEscrow() };
  s.group = [];
  s.spawnIn = 0;
  // stepping in is heading out: safe ground ends where the run begins
  s.hunting = true;
  return { ok: true };
}

/** Close a run without paying: the escrow is forfeited. Returns the chronicle line. */
export function abandonRun(s: GameState, why: string): string {
  s.dungeon = null;
  return `${why} in dungeon — the run ends and its escrow is forfeited`;
}

/**
 * Merge the escrow's stacks back through the ordinary pickup rule (`stop_pickup`): what the bag
 * cannot hold is left where it fell, exactly as a kill's own roll would be. Returns what landed.
 */
export function payoutStacks(s: GameState): { junk: number; stones: number; herbs: number; potions: number } {
  const run = s.dungeon!;
  const out = { junk: 0, stones: 0, herbs: 0, potions: 0 };
  for (const [k, v] of Object.entries(run.escrow.junk)) {
    const got = addTo(s, s.junk, k, 'stone', v);
    out.junk += got;
    s.counters.junk += got;
  }
  for (const [k, v] of Object.entries(run.escrow.stones)) out.stones += addTo(s, s.counters.stones, k, 'stone', v);
  for (const [k, v] of Object.entries(run.escrow.herbs)) out.herbs += addTo(s, s.farm.herbs, k, 'herb', v);
  for (const [k, v] of Object.entries(run.escrow.potions)) out.potions += addTo(s, s.farm.potions, k, 'potion', v);
  run.escrow.junk = {};
  run.escrow.stones = {};
  run.escrow.herbs = {};
  run.escrow.potions = {};
  return out;
}
