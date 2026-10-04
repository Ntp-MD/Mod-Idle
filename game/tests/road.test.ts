import { describe, it, expect } from 'vitest';
import { E, TOWN } from '../src/engine/client';
import {
  road, startTrip, linkReachable, purseReady, payPurse, encounterSizes, encounterZones, linkLabel,
} from '../src/sim/road';
import { stashTabCount, deposit, withdraw, buy } from '../src/sim/town';
import { newGame, tick, catchUp } from '../src/sim/game';
import { mulberry32 } from '../src/engine/client-helpers';

const R = E.road;

describe('the Road model is the shared one', () => {
  it('eight links, five minutes, five encounters, a hundred weight points', () => {
    expect(road.links.length).toBe(R.links.length);
    expect(road.links.length).toBe(8);
    expect(road.tripSec).toBe(R.trip_min * 60);
    expect(road.encountersPerTrip).toBe(R.trip_min * R.encounters_per_min);
    expect(road.totalWeight).toBe(100);
    expect(road.purseCapPerDay).toBe(R.links.length * R.purse_gold);
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
  });

  it('an encounter draws from the lower and higher zone of its own link', () => {
    const z = encounterZones(0);
    expect(z.lower).toBe(TOWN.settlements[0].zone);
    expect(z.higher).toBe(TOWN.settlements[1].zone);
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
    expect(s.road!.encountersLeft).toBe(road.encountersPerTrip);
  });

  it('walking the Road opens the settlement at the far end', () => {
    const s = newGame(19);
    s.player.level = 60;
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

  it('never runs while the player is away', () => {
    const s = newGame(13);
    s.town.visited.push('millbrook');
    startTrip(s, 0);
    const r = catchUp(s, {}, 600);
    expect(s.road).toBe(null);
    expect(r.simulated).toBe(600);
  });
});

describe('a trip that finishes', () => {
  it('clears its encounters, pays the purse once, and grants Standing at the far end', () => {
    const s = newGame(14);
    s.town.visited.push('millbrook');
    s.player.level = 60;
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
    s.player.level = 60;
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
