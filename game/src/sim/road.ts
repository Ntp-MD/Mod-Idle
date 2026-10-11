import { E, TOWN } from '../engine/client';
import { createRoad, hexAdjacent } from '../../../engine/road.ts';
import type { Hex } from '../../../engine/road.ts';
import { abandonRun } from './dungeon';
import { priceGold, rowById } from './town';
import type { GameState, Cell, Walk } from './types';

/** The walk model comes from the shared module, so every bound is one number in one place. */
export const road: any = createRoad(E);

const settlementById = (id: string) => TOWN.settlements.find((s: any) => s.id === id);

export const settlementZone = (id: string): number | null => settlementById(id)?.zone ?? null;

/**
 * The order a tied bare cell is resolved in: `road.standing_rule` gives it to the settlement holding the
 * lowest zone, and the zone belongs to `town.json`, so the preference list is built here rather than
 * copied into the Road.
 */
export const standingOrder: string[] = TOWN.settlements
  .slice()
  .sort((a: any, b: any) => (a.zone ?? 0) - (b.zone ?? 0))
  .map((s: any) => s.id);

/** The settlement a cell belongs to — itself when the cell is a town, its nearest one otherwise. */
export const ownerOf = (h: Hex) => road.owningNode(h, standingOrder);
/** The zone a cell stands in, read off the settlement that owns it. */
export const zoneOf = (h: Hex): number | null => settlementZone(ownerOf(h).id);
/** 0 is a settlement, 1 a side of one, 2 and out bare ground. */
export const rankOf = (h: Hex): number => road.cellRank(h);

/** What a cell is: the sheet's own marks decide, so a click and a save agree on the same content. */
export function cellKind(h: Hex, sub: number | null, wild: number | null): Walk['kind'] {
  if (rankOf(h) === 0) return 'town';
  if (sub != null) return 'sub';
  if (wild != null) return 'wild';
  return 'bare';
}

/** The cell the feet are on, defaulted to the starting settlement for a state with no mark yet. */
export function currentCell(state: GameState): Hex {
  const w = state.walk;
  if (w) return road.routeHex(w.from, w.to)[Math.min(w.blocksWalked, w.blocksTotal)] ?? w.from;
  if (state.cell) return { q: state.cell.q, r: state.cell.r };
  const home = road.nodeById(state.town?.waypoint || E.road.nodes[0].id) || E.road.nodes[0];
  return { q: home.q, r: home.r };
}

/** "Eastgate → Millbrook", the label the UI shows for a walk in either direction. */
export function walkLabel(fromId: string, toId: string): string {
  const a = settlementById(fromId)?.name ?? fromId;
  const b = settlementById(toId)?.name ?? toId;
  return `${a} → ${b}`;
}

/**
 * What the HUD says while a walk runs: the cell the feet are heading for, named by what stands on it
 * and the settlement whose ground it is. A walk joins two cells, so the sentence quotes the destination
 * rather than a settlement pair (`road.standing_rule`).
 */
export function walkNote(state: GameState): string {
  const w = state.walk;
  if (!w) return '';
  const own = w.node ? settlementById(w.node) : null;
  const name = own?.name ?? w.node ?? 'the field';
  const subs = own ? ((E.mob.zones.find((z: any) => z.id === own.zone)?.subzones) || []) : [];
  const where = w.kind === 'town' ? name
    : w.kind === 'sub' ? `${subs[w.sub ?? 0]?.name ?? `sub-zone ${(w.sub ?? 0) + 1}`} of ${name}`
      : w.kind === 'wild' ? (w.wild === 0 ? `the dungeon side of ${name}` : `wild side ${name}`)
        : `bare ground in the field of ${name}`;
  return where;
}

export const walkBlocks = (fromId: string, toId: string): number => road.blocksBetween(fromId, toId);
export const walkSec = (fromId: string, toId: string): number => road.secBetween(fromId, toId);

/**
 * The plotted route as the cells it crosses, keyed the way the sheet keys a cell. A far destination
 * is never jumped to: the walk is this chain, one cell per block, and the map lights it up one cell
 * at a time. The keys come from the walk graph's own coordinates, so the client matches a label the
 * generated sheet already carries and reads no position table (X33 · M7).
 */
export function walkRoute(fromId: string, toId: string): string[] {
  return road.routeBetween(fromId, toId).map((h: { q: number; r: number }) => `${h.q},${h.r}`);
}

/** The settlement the character stands in right now: rank 0, and opened. */
export function standingSettlement(state: GameState): any {
  if (state.walk || !state.cell) return null;
  if (rankOf(state.cell) !== 0) return null;
  const node = ownerOf(state.cell);
  return state.town.visited.includes(node.id) ? settlementById(node.id) : null;
}

/** A Waypoint exists for every settlement the character has arrived at on foot, once. */
export function waypointUnlocked(state: GameState, id: string): boolean {
  return state.town.visited.includes(id);
}

export function canTravel(state: GameState, id: string): boolean {
  return waypointUnlocked(state, id);
}

/**
 * The Waypoint's own price line (`town.json` `waypoint_warp`): minutes per block the walk would have
 * crossed, charged at the destination settlement's band. It is not a stall line — no `stock` array
 * names it and no vendor sells it — so it is priced here rather than bought through `canBuy`.
 */
export const warpRow: any = () => rowById('waypoint_warp');

/** What a warp to this settlement costs right now, in gold. */
export function warpCost(state: GameState, id: string): number {
  const row = warpRow();
  if (!row) return 0;
  return priceGold(row, id, state, Math.max(1, road.blocksBetween(state.town.waypoint, id)));
}

/**
 * Take the Waypoint: instant, and it pays gold for the time the walk would have taken. It opens no new
 * destination — the settlement is reachable because the foot earned it (`road.waypoint_rule`).
 */
export function warpTo(state: GameState, id: string): { ok: boolean; why?: string; gold?: number; forfeit?: string } {
  if (state.walk) return { ok: false, why: 'mid-walk — finish the route or turn back' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering at camp' };
  if (id === state.town.waypoint) return { ok: false, why: 'you already stand there' };
  if (!waypointUnlocked(state, id)) return { ok: false, why: 'no Waypoint — reach it on foot first' };
  const gold = warpCost(state, id);
  if (state.counters.gold < gold) return { ok: false, why: `needs ${gold} gold`, gold };
  state.counters.gold = Math.round((state.counters.gold - gold) * 100) / 100;
  const dest = settlementById(id);
  if (!dest) return { ok: false, why: 'no such settlement' };
  state.zone = dest.zone;
  state.town.waypoint = id;
  // a warp lands the feet on the settlement's own hex: the Waypoint buys the walk's time, and the
  // ground it arrives on is the same cell a foot would have stood on
  const node = road.nodeById(id);
  if (node) state.cell = { q: node.q, r: node.r, sub: null, wild: null };
  state.group = [];
  // warping home is safe ground: town fields no mobs until the character heads back out
  state.hunting = false;
  const forfeit = state.dungeon ? abandonRun(state, 'Warped out') : undefined;
  return { ok: true, gold, forfeit };
}

/** Every cell the route has already been walked through, up to and including the current block. */
export function walkedCells(state: GameState): string[] {
  const w = state.walk;
  if (!w) return [];
  return road.hexKeys(road.routeHex(w.from, w.to)).slice(0, w.blocksWalked + 1);
}

/**
 * The whole road the running walk lies on, in the order it is crossed. The sheet lights this, not the
 * route re-plotted from the feet: a trail that went dark behind the walker would leave only the cell
 * under them lit, and the walk would read as a jump from block to block.
 */
export function trailCells(state: GameState): string[] {
  const w = state.walk;
  return w ? road.hexKeys(road.routeHex(w.from, w.to)) : [];
}

/**
 * Lay a walk down to any cell of the field. The blocks are the hex distance between the cell the feet
 * are on and the cell clicked, never typed, and the route is the chain of adjacent cells the foot
 * crosses — one cell per block, never a jump. Re-clicking mid-walk is refused: the route is re-laid
 * from where the feet stand, so the walked prefix stays lit and no block is paid twice.
 */
export function startWalk(state: GameState, dest: Cell): { ok: boolean; why?: string; forfeit?: string } {
  if (state.walk) return { ok: false, why: 'already walking' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering at camp' };
  const from = currentCell(state);
  const to: Hex = { q: dest.q, r: dest.r };
  const blocks = road.blocksBetweenHex(from, to);
  if (blocks <= 0) return { ok: false, why: 'you are already there' };
  const keys = road.hexKeys(road.routeHex(from, to));
  // a plotted route is a chain of single steps: each cell enters one that shares an edge with the
  // cell before it, which is what makes a far destination a walk rather than a jump
  if (keys.some((k: string, i: number) => i > 0 && !adjacent(keys[i - 1], k))) {
    return { ok: false, why: 'the plotted route leaves the lattice' };
  }
  const kind = cellKind(to, dest.sub ?? null, dest.wild ?? null);
  state.walk = {
    from,
    to,
    node: ownerOf(to).id,
    kind,
    sub: kind === 'sub' ? dest.sub ?? null : null,
    wild: kind === 'wild' ? dest.wild ?? null : null,
    blocksTotal: blocks,
    blocksLeft: blocks,
    secLeft: road.blockSec,
    blocksWalked: 0,
  };
  // the walk spends the standing fight: a group left alive here keeps swinging through the whole
  // walk — block and evasion events off mobs the field never shows — so it is dropped whole, the
  // same way entering a hunt drops it. An ambush on the road spawns its own group fresh.
  state.group = [];
  state.player.atkTimer = 0;
  // walking out abandons the open run: a dungeon is entered ground, not a destination
  const forfeit = state.dungeon ? abandonRun(state, 'Walked out') : undefined;
  return { ok: true, forfeit };
}

/** Two sheet keys share an edge — the one step a block is allowed to take. */
const adjacent = (a: string, b: string) => {
  const [aq, ar] = a.split(',').map(Number);
  const [bq, br] = b.split(',').map(Number);
  return hexAdjacent({ q: aq, r: ar }, { q: bq, r: br });
};

/**
 * Arriving puts the feet on the cell. Only rank 0 opens a settlement and its Waypoint — a Waypoint
 * marks a town, not a patch of ground (`road.standing_rule`) — while any arrival sets the zone from
 * the settlement that owns the cell.
 */
export function arrive(state: GameState, walk: Walk) {
  const node = ownerOf(walk.to);
  const dest = settlementById(node.id);
  const rank = road.cellRank(walk.to);
  state.cell = { q: walk.to.q, r: walk.to.r, sub: walk.sub, wild: walk.wild };
  state.zone = settlementZone(node.id) ?? state.zone;
  let first = false;
  if (rank === 0 && dest) {
    first = !state.town.visited.includes(dest.id);
    if (first) state.town.visited.push(dest.id);
    state.town.waypoint = dest.id;
  }
  state.walk = null;
  state.group = [];
  // A settlement is safe ground; wild ground is a fight the moment the feet land on it. The owner's travel
  // switch is a hunt wherever it stands, and `spawnIn = 0` is what makes the arrival tick itself field the
  // group — the spawn gate reads this on the same tick (`sim/game.ts`), so no dead second is spent looking
  // for an enemy that is already due.
  state.hunting = rank !== 0 || state.travel === 'forward';
  if (rank !== 0) state.spawnIn = 0;
  return {
    name: dest?.name ?? node.id,
    first,
    town: rank === 0,
    kind: walk.kind,
    cell: state.cell,
  };
}

/** Turn back: the walk is dropped and the feet go back to the cell the route started on. */
export function endWalk(state: GameState) {
  const w = state.walk;
  state.walk = null;
  if (w) state.cell = { q: w.from.q, r: w.from.r, sub: null, wild: null };
  state.group = [];
}

/** Which zone an encounter on a walk draws from: the lower-numbered of the two it joins. */
export function walkZonesHex(from: Hex, to: Hex): { lower: number; higher: number } {
  const a = settlementZone(ownerOf(from).id) ?? 0;
  const b = settlementZone(ownerOf(to).id) ?? 0;
  return { lower: Math.min(a, b), higher: Math.max(a, b) };
}

/** The same rule read from settlement ids, for a caller that has names rather than cells. */
export function walkZones(fromId: string, toId: string): { lower: number; higher: number } {
  const a = settlementZone(fromId) ?? 0;
  const b = settlementZone(toId) ?? 0;
  return { lower: Math.min(a, b), higher: Math.max(a, b) };
}

/** A walk has no purse, no chest and no Standing: an encounter is a fight and pays a normal drop. */

/** The cell a settlement stands on, for a caller that has a name rather than a clicked hex. */
export function settlementCell(id: string): Cell | null {
  const n = road.nodeById(id);
  return n ? { q: n.q, r: n.r, sub: null, wild: null } : null;
}

/** Blocks from where the feet are to a cell — the price a destination card quotes. */
export const cellBlocks = (state: GameState, dest: Hex): number => road.blocksBetweenHex(currentCell(state), dest);
/** Seconds the same walk would take, at the one rate the Road charges. */
export const cellSec = (state: GameState, dest: Hex): number => road.secFromHex(currentCell(state), dest);
/** The plotted chain to a cell, keyed the way the sheet keys a cell — lit one cell per block. */
export function cellsTo(state: GameState, dest: Hex): string[] {
  return road.hexKeys(road.routeHex(currentCell(state), dest));
}
