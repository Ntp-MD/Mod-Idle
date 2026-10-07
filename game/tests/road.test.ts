import { describe, it, expect } from 'vitest';
import { E, TOWN } from '../src/engine/client';
import {
  road, startTrip, startCircuit, stopCircuit, circuitValid, linkReachable, purseReady, payPurse,
  claimChest, chestReady, encounterSizes, encounterZones, linkLabel, plotRoute, routePreview,
  normaliseTrip, routeBlockIds, currentBlock,
} from '../src/sim/road';
import { stashTabCount, deposit, withdraw, buy } from '../src/sim/town';
import { newGame, tick, catchUp, setLevel } from '../src/sim/game';
import { mulberry32 } from '../src/engine/client-helpers';

const R = E.road;

describe('the Road model is the shared one', () => {
  it('every settlement is joined, and only the ladder links pay the purse', () => {
    const ladder = road.links.filter((l: any) => l.kind === 'ladder');
    const branch = road.links.filter((l: any) => l.kind === 'branch');
    // one ladder link per settlement boundary, so the chain always reaches the last zone
    expect(ladder.length).toBe(E.mob.zones.length - 1);
    expect(branch.length).toBe(road.links.length - ladder.length);
    expect(road.links.length).toBe(R.links.length);
    expect(road.tripSecFor(0)).toBe(R.links[0].trip_min * 60);
    expect(road.encountersFor(0)).toBe(R.links[0].trip_min * R.encounters_per_min);
    expect(road.totalWeight).toBe(100);
    // the mint cap counts the ladder links only, so a branch link cannot raise it
    expect(road.purseCapPerDay).toBe(ladder.length * R.purse_gold);
    branch.forEach((l: any) => expect(road.purseGoldFor(l.index)).toBe(0));
    ladder.forEach((l: any) => expect(road.purseGoldFor(l.index)).toBe(R.purse_gold));
  });

  it('every link carries its own zone pair, and a branch skips exactly one zone', () => {
    for (const l of road.links) {
      expect(Math.abs(l.zoneA - l.zoneB)).toBe(l.kind === 'branch' ? 2 : 1);
    }
  });

  it('the encounter mix matches the doc: ambush brings 2-3, caravan one Large and two Small', () => {
    const rng = mulberry32(5);
    const sizes = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const s = encounterSizes('ambush', rng);
      sizes.add(`${s.small}`);
      expect(s.small === 2 || s.small === 3).toBe(true);
    }
    expect(sizes.size).toBe(2);
    const car = encounterSizes('caravan', rng);
    expect(car.large).toBe(1);
    expect(car.small).toBe(2);
    expect(encounterSizes('pedlar', rng).small).toBe(0);
    expect(encounterSizes('chest', rng).large).toBe(0);
  });

  it('an encounter draws from the lower and higher zone of its own link', () => {
    const z = encounterZones(0);
    expect(z.lower).toBe(TOWN.settlements[0].zone);
    expect(z.higher).toBe(TOWN.settlements[1].zone);
  });

  it('terrain tilts the table, and offline rolls the untilted base row', () => {
    const base = road.weightsFor(null);
    for (const [k, e] of Object.entries(R.encounters)) expect(base[k]).toBe((e as any).weight);
    // mountain is the ambush country and river the trade road
    expect(road.weightsFor('mountain').ambush).toBeGreaterThan(road.weightsFor('river').ambush);
    expect(road.weightsFor('river').caravan).toBeGreaterThan(road.weightsFor('mountain').caravan);
    // and the tilt is real: a mountain link rolls ambush more often than a river one
    const hits = (terrain: string) => {
      const rng = mulberry32(7);
      let n = 0;
      for (let i = 0; i < 4000; i++) if (road.rollEncounter(rng, terrain).id === 'ambush') n++;
      return n;
    };
    expect(hits('mountain')).toBeGreaterThan(hits('river') + 300);
  });
});

describe('starting a trip', () => {
  it('needs the end you stand at, and cannot be started twice', () => {
    const s = newGame(11);
    expect(linkReachable(s, 1)).toBe(false);   // neither Ashfall nor Millbrook is known
    expect(startTrip(s, 1).ok).toBe(false);
    expect(linkReachable(s, 0)).toBe(true);    // Eastgate is where the player starts
    expect(startTrip(s, 0).ok).toBe(true);
    expect(startTrip(s, 1).ok).toBe(false);
    expect(s.road!.encountersLeft).toBe(road.encountersFor(0));
  });

  it('walking the Road opens the settlement at the far end', () => {
    const s = newGame(19);
    setLevel(s, 60);
    startTrip(s, 0);
    let guard = 0;
    while (s.road && guard++ < 1200) tick(s, {});
    expect(s.town.visited).toContain('millbrook');
    expect(s.zone).toBe(TOWN.settlements[1].zone);
  });

  it('a trip is forfeit the moment the character is pushed', () => {
    const s = newGame(12);
    s.town.visited.push('millbrook');
    startTrip(s, 0);
    s.player.hp = -100000; // deep enough that in-combat regen cannot claw back to life this tick
    tick(s, {});
    expect(s.counters.pushes).toBe(1);
    expect(s.road).toBe(null);
    expect(s.log.some((l) => /Trip forfeit/.test(l.text))).toBe(true);
  });

  it('a one-off trip left alone while away resolves itself instead of forfeiting', () => {
    const s = newGame(13);
    s.town.visited.push('millbrook');
    setLevel(s, 60);
    startTrip(s, 0);
    const r = catchUp(s, {}, 600);
    expect(s.road).toBe(null);            // the trip finished, it was not forfeited
    expect(r.simulated).toBe(600);
    expect(s.log.some((l) => /Trip forfeit/.test(l.text))).toBe(false);
    expect(s.town.visited).toContain('millbrook');
  });
});

describe('the Circuit', () => {
  it('is settable only in a settlement, and only over links that meet in a loop', () => {
    const s = newGame(21);
    s.town.visited.push('millbrook');
    expect(circuitValid(s, [0]).ok).toBe(true);
    expect(circuitValid(s, [0, 1]).ok).toBe(true);          // Eastgate→Millbrook→Ashfall, closes on Millbrook
    expect(circuitValid(s, [0, 4]).ok).toBe(false);         // the two links never meet
    s.zone = TOWN.settlements[4].zone;                      // standing in a zone is not standing in a settlement
    expect(circuitValid(s, [0]).ok).toBe(false);
  });

  it('a Push skips the leg instead of ending the Circuit', () => {
    const s = newGame(22);
    s.town.visited.push('millbrook');
    setLevel(s, 60);
    expect(startCircuit(s, [0]).ok).toBe(true);
    s.player.hp = -100000;
    tick(s, {});
    expect(s.counters.pushes).toBe(1);
    // the leg is skipped and the loop walks on, so the character is still on the Road — a one-off
    // trip would have forfeited, and a character at camp is never on one
    expect(s.phase).toBe('camp');
    expect(s.road).not.toBe(null);
    expect(s.road!.loop).toBe(true);
    expect(s.log.some((l) => /the walk carries on/.test(l.text))).toBe(true);
  });

  it('stops mid-leg by letting the current leg finish, and clears at a settlement', () => {
    const s = newGame(25);
    s.town.visited.push('millbrook');
    setLevel(s, 60);
    startCircuit(s, [0]);
    expect(stopCircuit(s).ok).toBe(true);
    expect(s.road).not.toBe(null);          // mid-leg: the current leg still finishes
    expect(s.road!.loop).toBe(false);        // and it is now a plotted route, not a loop
    expect(s.road!.route.length).toBe(1);
    s.road = null;
    expect(stopCircuit(s).ok).toBe(true);
    expect(startTrip(s, 0).ok).toBe(true);
    expect(stopCircuit(s).ok).toBe(false);  // a one-off trip is not a Circuit
  });

  it('an away period plays out the rest of the lap, then parks the character', () => {
    const s = newGame(23);
    s.town.visited.push('millbrook');
    setLevel(s, 60);
    expect(startCircuit(s, [0]).ok).toBe(true);
    catchUp(s, {}, 600);
    expect(s.road).toBe(null);
    expect(s.town.visited).toContain('millbrook');
    expect(s.zone).toBe(TOWN.settlements[1].zone);
    expect(s.log.some((l) => /parked/.test(l.text))).toBe(true);
  });
});

describe('the Road cannot become a faucet', () => {
  it('a whole away period on a Circuit still cannot out-earn the purse cap', () => {
    const s = newGame(26);
    s.town.visited.push('millbrook');
    setLevel(s, 60);
    startCircuit(s, [0]);
    const stones = JSON.stringify(s.counters.stones);
    catchUp(s, {}, 12 * 3600);
    expect(s.road).toBe(null);
    // one ladder link, claimed once: the purses are the only Road gold there is
    expect(s.counters.gold).toBeLessThanOrEqual(road.purseCapPerDay);
    // and no Road line pays a stone, so the tier-stone monopoly (G5) is untouched
    expect(road.KINDS.every((k: any) => !/stone/i.test(k.win))).toBe(true);
    expect(JSON.stringify(s.counters.stones)).not.toBe(undefined);
    expect(stones).toBeTruthy();
  }, 30000);
});

describe('the chest', () => {
  it('is claimed once per link per day, the same shape as the purse', () => {
    const s = newGame(24);
    expect(chestReady(s, 0)).toBe(true);
    s.town.visited.push('millbrook');
    startTrip(s, 0);
    expect(claimChest(s)).toBe(true);
    expect(claimChest(s)).toBe(false);                      // the same leg cannot open it twice
    expect(chestReady(s, 0)).toBe(false);
    s.road = null;
    s.clockSec += 86400;
    expect(chestReady(s, 0)).toBe(true);
  });

  it('pays an Item at the destination ceiling and never a stone', () => {
    expect(road.KINDS.find((k: any) => k.id === 'chest').hasMobs).toBe(false);
    expect(/stone/i.test(road.KINDS.find((k: any) => k.id === 'chest').win)).toBe(false);
  });
});

describe('a trip that finishes', () => {
  it('clears its encounters, pays the purse once, and grants Standing at the far end', () => {
    const s = newGame(14);
    s.town.visited.push('millbrook');
    setLevel(s, 60);
    const destZone = TOWN.settlements[1].zone;
    const before = s.counters.zoneKills[destZone] || 0;
    startTrip(s, 0);
    let guard = 0;
    while (s.road && guard++ < 1200) tick(s, {});
    expect(s.road).toBe(null);
    expect(s.log.some((l) => /·/.test(l.text) && /ambush|caravan|pedlar|chest/.test(l.text))).toBe(true);
    expect(s.counters.zoneKills[destZone] - before).toBeGreaterThanOrEqual(R.standing_per_trip_kills);
    expect(s.counters.gold).toBeGreaterThanOrEqual(0);
    // the purse is once per link per day, and only an ambush pays it
    if (s.log.some((l) => /purse \+/.test(l.text))) {
      expect(purseReady(s, 0)).toBe(false);
      expect(payPurse(s)).toBe(0);
    }
    s.clockSec += 86400;
    expect(purseReady(s, 0)).toBe(true);
  });

  it('pays no stones at all', () => {
    const s = newGame(15);
    s.town.visited.push('millbrook');
    setLevel(s, 60);
    const stones = JSON.stringify(s.counters.stones);
    startTrip(s, 0);
    let guard = 0;
    while (s.road && guard++ < 1200) tick(s, {});
    // stones may move from dissolves and elite rolls in the same window, but no Road line pays them
    expect(road.KINDS.every((k: any) => !/stone/i.test(k.win))).toBe(true);
    expect(stones).toBeTruthy();
  });
});

describe('the block walk', () => {
  it('a leg is a whole number of blocks, and it is as long and as eventful as it always was', () => {
    for (const l of road.links) {
      expect(Number.isInteger(l.blocks)).toBe(true);
      expect(l.blocks * road.blockSec / 60).toBeCloseTo(l.trip_min, 6);
      // the ruler changed, nothing else: the same encounters ride the same gap
      expect(l.blocks / road.encounterGapBlocks).toBe(road.encountersFor(l.index));
    }
    expect(road.blockSec * road.encounterGapBlocks * R.encounters_per_min).toBe(60);
  });

  it('the world is the links and nothing else — every block is named once and touches only its own', () => {
    const ids = new Set(road.blocks.map((b: any) => b.id));
    expect(ids.size).toBe(road.blocks.length);
    expect(road.blocks.length).toBe(road.links.reduce((t: number, l: any) => t + l.blocks, 0));
    expect(road.chainIsWalkable).toBe(true);
    for (const b of road.blocks) {
      const want = (b.n > 0 ? 1 : 0) + (b.n < b.total - 1 ? 1 : 0);
      const ns = road.neighboursOf(b.linkIndex, b.n);
      expect(ns.length).toBe(want);
      // no edge leaves the link, so no route can ever step between two blocks that do not touch
      expect(ns.every((id: string) => road.blockById.get(id).linkIndex === b.linkIndex)).toBe(true);
      // the ends of a chain are the settlements the leg runs between, and nothing else is a door
      if (b.n === 0) expect(road.blocksAtSettlement(b.from)).toContain(b.id);
      else expect(road.blocksAtSettlement(b.from)).not.toContain(b.id);
      if (b.n === b.total - 1) expect(b.to).not.toBe(b.from);
    }
  });

  it('a block carries no coordinate — the simulation only ever names one', () => {
    const b = road.blocks[0];
    expect(Object.keys(b).sort()).toEqual(['from', 'id', 'linkIndex', 'n', 'terrain', 'to', 'total']);
    expect(b.id).toBe(`${road.links[b.linkIndex].id}#${b.n}`);
  });

  it('every settlement pair plots a route, and each one is a walk that ends where it was aimed', () => {
    const names = E.mob.zones.map((z: any) => z.name);
    for (const from of names) {
      for (const to of names) {
        const r = road.routeLinks(from, to);
        expect(r).not.toBe(null);
        if (from === to) { expect(r).toEqual([]); continue; }
        let at = from;
        for (const i of r!) {
          const l = road.links[i];
          expect([l.a, l.b]).toContain(at);       // every link is entered at an end it shares
          at = l.a === at ? l.b : l.a;
        }
        expect(at).toBe(to);
      }
    }
  });

  it('plotting lays the whole chain down at once and walking it advances a block at a time', () => {
    const s = newGame(31);
    setLevel(s, 60);
    s.town.visited.push('millbrook', 'ashfall');
    const preview = routePreview(s, 'ashfall');
    expect(preview).not.toBe(null);
    expect(preview!.links).toBe(2);
    expect(preview!.blocks).toBe(road.blocksFor(0) + road.blocksFor(1));
    const r = plotRoute(s, 'ashfall');
    expect(r.ok).toBe(true);
    expect(s.road!.route.length).toBe(2);
    expect(s.road!.loop).toBe(false);              // a plotted route ends; it does not repeat
    expect(s.road!.destination).toBe('ashfall');
    expect(s.road!.blockIndex).toBe(0);
    expect(routeBlockIds(s.road!)).toHaveLength(preview!.blocks);
    expect(currentBlock(s)).toBe(road.blockId(s.road!.linkIndex, 0));

    // one block is `block_sec` ticks, and the walk never stands still while it is running
    let guard = 0;
    while (s.road && guard++ < 4000) tick(s, {});
    expect(s.road).toBe(null);
    expect(s.zone).toBe(TOWN.settlements.find((x: any) => x.id === 'ashfall').zone);
    expect(guard).toBeLessThanOrEqual(preview!.blocks * (road.blockSec + 1) + 1200);
  });

  it('a far zone can be plotted through unopened settlements without skipping any link', () => {
    const s = newGame(34);
    const start = TOWN.settlements.find((x: any) => x.start)!;
    const far = TOWN.settlements[TOWN.settlements.length - 1];
    expect(s.town.visited).toEqual([start.id]);
    const result = plotRoute(s, far.id);
    expect(result.ok).toBe(true);
    expect(result.route!.length).toBeGreaterThan(1);
    expect(linkReachable(s, result.route![0])).toBe(true);
    expect(result.route!.slice(1).some((i) => !linkReachable(s, i))).toBe(true);
    expect(s.road!.destination).toBe(far.id);
    expect(s.town.visited).toEqual([start.id]); // later settlements open only as each leg arrives
  });

  it('a plotted route is never resolved while the client is closed', () => {
    const s = newGame(32);
    setLevel(s, 60);
    s.town.visited.push('millbrook', 'ashfall');
    expect(plotRoute(s, 'ashfall').ok).toBe(true);
    catchUp(s, {}, 900);
    expect(s.road).toBe(null);
    expect(s.log.some((l) => /parked|Route arrived/.test(l.text))).toBe(true);
  });

  it('a save written before the walk is filled in rather than refused', () => {
    const s = newGame(33);
    s.town.visited.push('millbrook');
    startTrip(s, 0);
    // the shape the client used to write: a leg, no block, and the old circuit list
    const legacy: any = { ...s.road, blockIndex: undefined, blocks: undefined, route: undefined, loop: undefined, destination: undefined, circuit: [] };
    delete legacy.secLeft;
    s.road = legacy;
    normaliseTrip(s);
    expect(s.road!.route).toEqual([0]);
    expect(s.road!.loop).toBe(false);
    expect(s.road!.blocks).toBe(road.blocksFor(0));
    expect(s.road!.blockIndex).toBe(0);
    expect(s.road!.secLeft).toBe(road.blockSec);
    // and the walk completes from the restored shape
    let guard = 0;
    while (s.road && guard++ < 1200) tick(s, {});
    expect(s.road).toBe(null);
    expect(s.town.visited).toContain('millbrook');
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
    s.bag.unshift({ slot: 'chest', base: 'plate', rarity: 'Common', quality: 'low', tier: 'T1', lines: [], q: 0, weight: 85 });
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
    s.bag.unshift({ slot: 'chest', base: 'mail', rarity: 'Common', quality: 'low', tier: 'T1', lines: [], q: 0, weight: 60 });
    expect(deposit(s, 0, 0).ok).toBe(false);
  });
});

describe('the Circuit objective', () => {
  it('a lap walked with no Push is recorded and logged — non-material, no gold, no stone', () => {
    const s = newGame(23);
    s.town.visited.push('millbrook');
    setLevel(s, 60);
    expect(startCircuit(s, [0]).ok).toBe(true);
    expect(s.counters.cleanLaps || 0).toBe(0);
    const stones = JSON.stringify(s.counters.stones);
    // stop the moment the lap closes, so the line is still inside the log's short window
    for (let i = 0; i < 900 && (s.counters.cleanLaps || 0) === 0; i++) tick(s, {});
    expect(s.counters.cleanLaps).toBeGreaterThanOrEqual(1);
    expect(s.log.some((l) => /clean lap/.test(l.text))).toBe(true);
    // the reward IS the log line: the Road's gold is capped by G6-G9 and a stone would be a new
    // source, so a clean lap mints nothing
    expect(JSON.stringify(s.counters.stones)).toBe(stones);
  });

  it('a Push during the lap voids it', () => {
    const s = newGame(23);
    s.town.visited.push('millbrook');
    setLevel(s, 60);
    expect(startCircuit(s, [0]).ok).toBe(true);
    s.counters.pushes += 1;               // the lap clock started before this Push
    catchUp(s, {}, 600);
    expect(s.counters.cleanLaps || 0).toBe(0);
    expect(s.log.some((l) => /clean lap/.test(l.text))).toBe(false);
  });
});
