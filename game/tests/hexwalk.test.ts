import { describe, it, expect } from 'vitest';
import { E, TOWN } from '../src/engine/client';
import { newGame, tick, catchUp, setLevel, huntHere } from '../src/sim/game';
import {
  road, startWalk, endWalk, settlementCell, currentCell, cellBlocks,
  cellSec, rankOf, zoneOf, ownerOf, walkedCells,
} from '../src/sim/road';
import type { GameState } from '../src/sim/types';

/**
 * Walking on the field itself, not between two names: every cell is a place to stand, every cell costs
 * one block, and the ground under the feet decides whose cast a hunt draws (`road.standing_rule`).
 */

const topUp = (s: GameState) => { s.player.hp = 1e12; s.player.mana = 1e12; s.player.es = 1e12; };
const home = (s: GameState) => road.nodeById(s.town.waypoint);
/** The six cells one block out from a settlement — every one of them rank 1. */
const sides = (s: GameState) => road.neighbours(home(s));
/** The first cell beyond a side: bare ground, no settlement of its own. */
const bare = (s: GameState) => sides(s).flatMap((h: any) => road.neighbours(h)).find((h: any) => rankOf(h) >= 2)!;
/** The sub-zone names the standing zone actually fields. */
const cast = (zone: number) => ((E.mob.zones.find((z: any) => z.id === zone)?.subzones) || []) as any[];

/** Driven to a number of spawns rather than a fixed window of ticks: a window is a time premise. */
function spawnsSeen(state: GameState, want: number, cap = 120000): Set<string> {
  const seen = new Set<string>();
  for (let i = 0; i < cap && seen.size < want; i++) {
    tick(state, {});
    topUp(state);
    for (const m of state.group || []) if (m.subzone) seen.add(`${m.subzone}|${m.speciesId}|${m.variant}`);
  }
  return seen;
}
const namesOf = (seen: Set<string>) => new Set([...seen].map((k) => k.split('|')[0]));

describe('every hex is a place to stand', () => {
  it('refuses nothing but the cell already under the feet', () => {
    const s = newGame(41);
    setLevel(s, 60);
    const ring = sides(s);
    for (const h of ring) {
      const before = { ...s.cell };
      expect(startWalk(s, { ...h, sub: null, wild: null }).ok).toBe(true);
      expect(s.walk!.blocksTotal).toBe(1);          // one block, whatever the ground
      expect(s.walk!.secLeft).toBe(E.road.block_sec);
      expect(currentCell(s)).toEqual({ q: before.q, r: before.r });  // the route starts where the feet are
      endWalk(s);
      expect(s.cell).toEqual(before);               // and turning back keeps that cell
    }
    // the cell under the feet is the only destination that cannot be walked to
    expect(startWalk(s, { ...home(s), sub: null, wild: null }).ok).toBe(false);
  });

  it('crosses a bare cell for the same price as a settlement: one block, one block_sec', () => {
    const s = newGame(42);
    setLevel(s, 60);
    const out = bare(s);
    const visited = [...s.town.visited];
    expect(cellBlocks(s, out)).toBe(rankOf(out));
    expect(cellSec(s, out)).toBe(rankOf(out) * E.road.block_sec);
    expect(startWalk(s, { ...out, sub: null, wild: null }).ok).toBe(true);
    let guard = 0;
    while (s.walk && guard++ < 20000) { tick(s, {}); topUp(s); }
    expect(s.cell).toEqual({ q: out.q, r: out.r, sub: null, wild: null });
    expect(rankOf(s.cell!)).toBeGreaterThanOrEqual(2);
    expect(s.zone).toBe(zoneOf(out));               // the zone follows the settlement that owns the cell
    expect(s.town.visited).toEqual(visited);        // bare ground opened nothing that was not open
    expect(s.town.waypoint).toBe(home(s).id);       // and the Waypoint still marks the town, not the cell
  });

  it('a settlement and a clicked cell are priced by the same hex rule', () => {
    const s = newGame(43);
    const dest = TOWN.settlements.find((x: any) => x.id !== s.town.waypoint)!;
    const cell = settlementCell(dest.id)!;
    expect(cellBlocks(s, cell)).toBe(road.blocksBetweenHex(currentCell(s), cell));
    expect(cellBlocks(s, cell)).toBe(road.blocksBetween(s.town.waypoint, dest.id));
    expect(cellsLit(s, cell).length).toBe(cellBlocks(s, cell) + 1);
  });

  it('cannot lay a second walk while one runs, and turning back pays no block twice', () => {
    const s = newGame(44);
    setLevel(s, 60);
    const out = bare(s);
    startWalk(s, { ...out, sub: null, wild: null });
    expect(startWalk(s, { ...out, sub: null, wild: null }).ok).toBe(false);
    // to a crossed block, never to a tick count: a window of ticks is a time premise
    while (s.walk!.blocksWalked === 0) { tick(s, {}); topUp(s); }
    const walked = s.walk!.blocksWalked;
    expect(walked).toBeGreaterThan(0);
    expect(walkedCells(s).length).toBe(walked + 1); // the walked prefix stays lit
    endWalk(s);
    expect(s.walk).toBeNull();
    expect(s.cell).toEqual({ q: home(s).q, r: home(s).r, sub: null, wild: null });
    startWalk(s, { ...out, sub: null, wild: null });
    expect(s.walk!.blocksWalked).toBe(0);           // and the whole route is paid again, none of it free
  });

  it('a Push rests at the camp of the zone ambushed in and keeps the road', () => {
    const s = newGame(45);
    setLevel(s, 60);
    const out = bare(s);
    startWalk(s, { ...out, sub: null, wild: null });
    const total = s.walk!.blocksTotal;
    s.player.hp = -1e9;
    for (let i = 0; i < total; i++) {
      // top up between crossings, so only this Push is live and the walk's own ticks are not
      // decided by a fixed window: the block advance and the Push land on one tick either way
      s.player.hp = 1e12;
      tick(s, {});
    }
    s.player.hp = -1e9;
    tick(s, {});
    expect(s.counters.pushes).toBe(1);
    // a Push never ends a walk and never gives a block back: walked plus remaining is the route
    if (s.walk) expect(s.walk!.blocksWalked + s.walk!.blocksLeft).toBe(total);
    expect(s.log.some((l) => /Pushed/.test(l.text))).toBe(true);
    expect(s.phase).toBe('camp');
  });

  it('an away period never crosses a block, on foot or on the way back', () => {
    const s = newGame(46);
    setLevel(s, 60);
    startWalk(s, { ...bare(s), sub: null, wild: null });
    const walked = s.walk!.blocksWalked;
    expect(catchUp(s, {}, 600).simulated).toBe(600);
    expect(s.walk!.blocksWalked).toBe(walked);
    expect(s.cell).toEqual({ q: home(s).q, r: home(s).r, sub: null, wild: null });
  });
});

describe('standing on a cell decides whose cast rolls', () => {
  it('a side with a sub-zone written into it hunts that sub-zone alone', () => {
    const s = newGame(47);
    setLevel(s, 60);
    topUp(s);
    const side = sides(s)[0];
    const zone = zoneOf(side)!;
    const want = cast(zone);
    expect(want.length).toBeGreaterThan(1);
    s.cell = { q: side.q, r: side.r, sub: 0, wild: null };
    expect(huntHere(s).ok).toBe(true);
    expect(s.zone).toBe(zone);
    const seen = spawnsSeen(s, 4, 60000);
    expect(seen.size).toBeGreaterThanOrEqual(4);    // many spawns, not one lucky draw
    const names = namesOf(seen);
    expect(names.size).toBe(1);                     // and not one of them came from another side
    expect(names.has(want[0].name)).toBe(true);
  });

  it('ground with no side named rolls the whole cast, as it always did', () => {
    const s = newGame(48);
    setLevel(s, 60);
    topUp(s);
    const side = sides(s)[0];
    s.cell = { q: side.q, r: side.r, sub: null, wild: null };
    expect(huntHere(s).ok).toBe(true);
    const zone = s.zone;
    const names = namesOf(spawnsSeen(s, 2));
    expect(names.size).toBeGreaterThan(1);
    for (const name of names) expect(cast(zone).map((x: any) => x.name)).toContain(name);
  });

  it('a bare cell is huntable ground, and it belongs to the settlement that owns it', () => {
    const s = newGame(49);
    setLevel(s, 60);
    topUp(s);
    const out = bare(s);
    const owner = ownerOf(out);
    s.cell = { q: out.q, r: out.r, sub: null, wild: null };
    expect(huntHere(s).ok).toBe(true);
    expect(s.zone).toBe(TOWN.settlements.find((x: any) => x.id === owner.id)!.zone);
    expect(s.town.visited.length).toBe(1);          // hunting bare ground opened no Waypoint
  });
});

/** The plotted chain to a cell, keyed the way the sheet keys one. */
function cellsLit(s: GameState, dest: { q: number; r: number }): string[] {
  return road.hexKeys(road.routeHex(currentCell(s), dest));
}
