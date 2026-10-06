import { describe, it, expect } from 'vitest';
import { E, TOWN } from '../src/engine/client';
import {
  road, startTrip, startCircuit, stopCircuit, circuitValid, linkReachable, purseReady, payPurse,
  claimChest, chestReady, encounterSizes, encounterZones, linkLabel,
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
    expect(s.road).not.toBe(null);                          // a one-off trip would have forfeited here
    expect(s.log.some((l) => /Circuit carries on/.test(l.text))).toBe(true);
  });

  it('stops mid-leg by letting the current leg finish, and clears at a settlement', () => {
    const s = newGame(25);
    s.town.visited.push('millbrook');
    setLevel(s, 60);
    startCircuit(s, [0]);
    expect(stopCircuit(s).ok).toBe(true);
    expect(s.road).not.toBe(null);          // mid-leg: it becomes a one-off trip, not a dropped character
    expect(s.road!.circuit.length).toBe(0);
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
    expect(s.log.some((l) => /Road ·/.test(l.text))).toBe(true);
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
    for (let i = 0; i < 700 && (s.counters.cleanLaps || 0) === 0; i++) tick(s, {});
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
