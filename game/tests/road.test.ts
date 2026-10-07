import { describe, it, expect } from 'vitest';
import { E, TOWN } from '../src/engine/client';
import { road, startWalk, walkBlocks, walkLabel, walkRoute, walkZones, waypointUnlocked } from '../src/sim/road';
import { stashTabCount, deposit, withdraw, buy } from '../src/sim/town';
import { newGame, tick, catchUp, setLevel } from '../src/sim/game';
import { mulberry32 } from '../src/engine/client-helpers';

const R = E.road;

describe('the walk model is the shared one', () => {
  it('carries one node per settlement, on the hex lattice', () => {
    expect(road.nodes.length).toBe(R.nodes.length);
    expect(road.nodes.length).toBe(TOWN.settlements.length);
    for (const n of road.nodes) {
      expect(Number.isInteger(n.q)).toBe(true);
      expect(Number.isInteger(n.r)).toBe(true);
      expect(TOWN.settlements.some((s: any) => s.id === n.id)).toBe(true);
    }
  });

  it('derives every pair of blocks from the coordinates, and never from a typed number', () => {
    for (const a of road.nodes) {
      for (const b of road.nodes) {
        if (a.id === b.id) continue;
        // symmetric, at least one block apart, and the same both ways round
        expect(road.blocksBetween(a.id, b.id)).toBe(road.blocksBetween(b.id, a.id));
        expect(road.blocksBetween(a.id, b.id)).toBeGreaterThan(0);
        // the hex distance is the cube distance: no two settlements may share a hex
        const dq = a.q - b.q, dr = a.r - b.r;
        expect(road.blocksBetween(a.id, b.id)).toBe((Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2);
      }
    }
  });

  it('plots a far destination as a chain of adjacent cells, one per block', () => {
    for (const a of road.nodes) {
      for (const b of road.nodes) {
        if (a.id === b.id) continue;
        const route = walkRoute(a.id, b.id);
        // one cell per block, plus the cell the walk starts on
        expect(route.length).toBe(road.blocksBetween(a.id, b.id) + 1);
        expect(route[0]).toBe(`${a.q},${a.r}`);
        expect(route[route.length - 1]).toBe(`${b.q},${b.r}`);
        // every step is a side of the cell before it, and no cell is crossed twice
        const seen = new Set<string>();
        for (let i = 0; i < route.length; i++) {
          expect(seen.has(route[i])).toBe(false);
          seen.add(route[i]);
          if (!i) continue;
          const [pq, pr] = route[i - 1].split(',').map(Number);
          const [q, r] = route[i].split(',').map(Number);
          const dq = q - pq, dr = r - pr;
          expect((Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2).toBe(1);
        }
      }
    }
  });

  it('turns blocks into seconds at the one block time the data owns', () => {
    const [a, b] = road.nodes;
    expect(road.secBetween(a.id, b.id)).toBe(road.blocksBetween(a.id, b.id) * R.block_sec);
    expect(road.blockSec).toBe(R.block_sec);
  });

  it('rolls one encounter chance per block, and it is neither certain nor never', () => {
    expect(road.encounterChance()).toBe(R.encounter_chance_pct / 100);
    expect(road.encounterChance()).toBeGreaterThan(0);
    expect(road.encounterChance()).toBeLessThan(1);
    const rng = mulberry32(5);
    let hits = 0;
    for (let i = 0; i < 20000; i++) if (road.rollEncounter(rng)) hits++;
    const rate = hits / 20000;
    expect(Math.abs(rate - road.encounterChance())).toBeLessThan(0.01);
  });

  it('an encounter draws from the lower of the two zones the walk joins', () => {
    const [a, b] = TOWN.settlements;
    const z = walkZones(a.id, b.id);
    expect(z.lower).toBe(Math.min(a.zone, b.zone));
    expect(z.higher).toBe(Math.max(a.zone, b.zone));
    // the order the walk is taken in never changes which zone pays
    expect(walkZones(b.id, a.id)).toEqual(z);
  });
});

describe('starting a walk', () => {
  it('needs two different settlements and cannot be started twice', () => {
    const s = newGame(11);
    const [a, b] = TOWN.settlements;
    expect(startWalk(s, a.id, a.id).ok).toBe(false);
    expect(startWalk(s, a.id, 'nowhere').ok).toBe(false);
    expect(startWalk(s, a.id, b.id).ok).toBe(true);
    expect(startWalk(s, a.id, b.id).ok).toBe(false);   // already walking
    expect(s.walk!.blocksTotal).toBe(road.blocksBetween(a.id, b.id));
    expect(s.walk!.blocksLeft).toBe(s.walk!.blocksTotal);
  });

  it('crosses a block per block_sec and opens the Waypoint at the far end', () => {
    const s = newGame(19);
    const [a, b] = TOWN.settlements;
    setLevel(s, 60);
    startWalk(s, a.id, b.id);
    const blocks = road.blocksBetween(a.id, b.id);
    let guard = 0;
    while (s.walk && guard++ < 20000) tick(s, {});
    expect(guard).toBeLessThan(blocks * R.block_sec + 50);
    expect(s.walk).toBe(null);
    expect(s.town.visited).toContain(b.id);          // walked there, so the Waypoint is open
    expect(waypointUnlocked(s, b.id)).toBe(true);
    expect(s.zone).toBe(b.zone);
  });

  it('a Push keeps the walk and its blocks', () => {
    const s = newGame(12);
    const [a, b] = TOWN.settlements;
    setLevel(s, 60);
    startWalk(s, a.id, b.id);
    for (let i = 0; i < R.block_sec + 1; i++) tick(s, {});   // cross one block
    const left = s.walk!.blocksLeft;
    s.player.hp = -100000;                              // deep enough that regen cannot save it
    tick(s, {});
    expect(s.counters.pushes).toBe(1);
    expect(s.walk).not.toBe(null);                      // the walk survives the Push
    expect(s.walk!.blocksLeft).toBe(left);              // and it lost no block
    expect(s.log.some((l) => /keeps its \d+ block/.test(l.text))).toBe(true);
  });

  it('an away period never crosses a block', () => {
    const s = newGame(13);
    const [a, b] = TOWN.settlements;
    setLevel(s, 60);
    startWalk(s, a.id, b.id);
    const walked = s.walk!.blocksWalked;
    const r = catchUp(s, {}, 600);
    expect(r.simulated).toBe(600);
    expect(s.walk!.blocksWalked).toBe(walked);
    expect(s.town.visited).not.toContain(b.id);
  });
});

describe('the walk mints nothing', () => {
  it('pays no gold, no Standing and no stones of its own', () => {
    const s = newGame(26);
    const [a, b] = TOWN.settlements;
    setLevel(s, 60);
    const gold = s.counters.gold;
    const standing = Object.values(s.counters.zoneKills).reduce((x: number, y: any) => x + y, 0);
    startWalk(s, a.id, b.id);
    let guard = 0;
    while (s.walk && guard++ < 20000) tick(s, {});
    // a walk pays a drop roll and nothing else, so gold and Standing move only by what was killed
    expect(s.counters.gold - gold).toBeLessThanOrEqual(0);
    expect(Object.values(s.counters.zoneKills).reduce((x: number, y: any) => x + y, 0) - standing)
      .toBeLessThanOrEqual(s.counters.kills);
  }, 30000);
});

describe('labels', () => {
  it('reads in the direction the walk goes', () => {
    const [a, b] = TOWN.settlements;
    expect(walkLabel(a.id, b.id)).toBe(`${a.name} → ${b.name}`);
    expect(walkLabel(b.id, a.id)).toBe(`${b.name} → ${a.name}`);
    expect(walkBlocks(a.id, b.id)).toBe(road.blocksBetween(a.id, b.id));
  });
});

describe('the stash', () => {
  it('tabs come from Porter purchases and houses, capped at six', () => {
    const s = newGame(16);
    expect(stashTabCount(s)).toBe(0);
    s.counters.gold = 100000;
    buy(s, 'eastgate', 'stash_tab_1');
    expect(stashTabCount(s)).toBe(1);
    s.town.owned.push('house_ashfall', 'house_highspire');
    expect(stashTabCount(s)).toBe(5);
    for (let i = 2; i <= 6; i++) s.town.owned.push(`stash_tab_${i}`);
    expect(stashTabCount(s)).toBe(6);
  });

  it('deposits and withdraws round-trip, and a full bag refuses the pull', () => {
    const s = newGame(17);
    s.town.owned.push('stash_tab_1');
    s.bag.unshift({ slot: 'chest', base: 'plate', ilvl: 1, quality: 'low', tier: 'T1', lines: [], q: 0, weight: 85 });
    expect(deposit(s, 0, 0).ok).toBe(true);
    expect(s.bag.length).toBe(0);
    expect(s.stash[0].length).toBe(1);
    expect(withdraw(s, 0, 0).ok).toBe(true);
    expect(s.stash[0].length).toBe(0);
    expect(withdraw(s, 0, 0).ok).toBe(false);
    const filler = s.bag[0];
    deposit(s, 0, 0);
    s.bag = new Array(E.inventory.adventure_slots).fill(filler);
    expect(withdraw(s, 0, 0).ok).toBe(false);
  });

  it('an unbought tab is refused', () => {
    const s = newGame(18);
    s.bag.unshift({ slot: 'chest', base: 'mail', ilvl: 1, quality: 'low', tier: 'T1', lines: [], q: 0, weight: 60 });
    expect(deposit(s, 0, 0).ok).toBe(false);
  });
});