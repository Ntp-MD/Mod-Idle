import { describe, it, expect } from 'vitest';
import { E, eng, TOWN } from '../src/engine/client';
import { newGame, tick, setLevel, huntZone } from '../src/sim/game';
import { settlementOfZone } from '../src/sim/town';
import { walkRoute, walkBlocks, startWalk, warpTo, warpCost } from '../src/sim/road';
import { hexAdjacent } from '../../engine/road.ts';
import type { GameState } from '../src/sim/types';

/**
 * `setLevel` raises the pool ceiling but not the current HP, so a jump-levelled character would be
 * Pushed on its low pool and the travel behaviour would be tested through a survival artifact. Full
 * the bars before a run so these tests measure travel alone.
 */
const topUp = (s: GameState) => { s.player.hp = 1e12; s.player.mana = 1e12; s.player.es = 1e12; };

describe('the stay / move on switch', () => {
  it('defaults to staying, so nothing travels without being told', () => {
    expect(newGame(81).travel).toBe('stay');
  });

  it('does not move a character that is over level in the opening zone', () => {
    const s = newGame(82);
    setLevel(s, 60);
    topUp(s);
    for (let i = 0; i < 60; i++) tick(s, {});
    expect(s.zone).toBe(E.opening.settlement_zone);
    expect(s.log.some((l) => /Moving on/.test(l.text))).toBe(false);
  });

  it('walks on to the next opened settlement once this zone band is behind', () => {
    const s = newGame(83);
    setLevel(s, 60);
    topUp(s);
    s.travel = 'forward';
    // nothing opened yet but the start, so there is nowhere to go
    for (let i = 0; i < 30; i++) tick(s, {});
    expect(s.zone).toBe(eng.ZONES[0].id);
    // open the settlement of the next band and it moves on its own
    const next = eng.ZONES.find((z: any) => z.id > s.zone)!;
    s.town.visited.push(settlementOfZone(next.id)!.id);
    for (let i = 0; i < 30; i++) tick(s, {});
    expect(s.zone).toBe(next.id);
    expect(s.log.some((l) => /Moving on/.test(l.text))).toBe(true);
  });

  it('never moves on in a zone whose band it has not passed', () => {
    const s = newGame(84);
    const first = eng.ZONES[0];
    setLevel(s, first.levels[1]); // exactly at the top, not past it
    topUp(s);
    s.travel = 'forward';
    s.town.visited = eng.ZONES.slice(0, 3).map((z: any) => settlementOfZone(z.id)!.id);
    for (let i = 0; i < 30; i++) tick(s, {});
    expect(s.zone).toBe(first.id);
  });
});

/** A single lethal spawn, rigged so the next ticks land a Push without fighting the real curve. */
const lethal = (zone: number) => ({
  id: 'test:killer', species: 'Test', kind: 'Medium', zone, level: 1,
  hp: 1e9, hpMax: 1e9, ps: 1e12, acc: 1e9, evasion: 0, dodgeRate: 0,
  armour: 0, res: 0, damage: 'physical', innate: ['fire'], xp: 0,
  line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0,
}) as any;

describe('Forward Mode falls back to the last zone it held', () => {
  it('returns to the safe zone on a Push and refuses to re-enter until a level is gained', () => {
    const s = newGame(85);
    setLevel(s, 60);
    topUp(s);
    s.travel = 'forward';
    const z1 = eng.ZONES[0];
    const z2 = eng.ZONES.find((z: any) => z.id > z1.id)!;
    s.town.visited.push(settlementOfZone(z2.id)!.id);
    for (let i = 0; i < 30; i++) tick(s, {});
    expect(s.zone).toBe(z2.id);
    expect(s.forwardSafe).toBe(z1.id);

    // a lethal spawn Pushes the character out of z2
    s.group = [lethal(z2.id)];
    s.spawnIn = 99999;
    s.player.hp = 1;
    for (let i = 0; i < 20 && s.counters.pushes === 0; i++) tick(s, {});
    expect(s.counters.pushes).toBeGreaterThan(0);
    expect(s.zone).toBe(z1.id);
    expect(s.forwardBlockedZone).toBe(z2.id);
    expect(s.forwardBlockedLevel).toBe(60);

    // back on the floor, the climb holds while the level has not moved
    s.phase = 'fighting';
    s.campSec = 0;
    for (let i = 0; i < 5; i++) tick(s, {});
    expect(s.zone).toBe(z1.id);

    // one level on, the climb resumes into the zone it was chased out of
    setLevel(s, 61);
    s.phase = 'fighting';
    s.campSec = 0;
    for (let i = 0; i < 5; i++) tick(s, {});
    expect(s.zone).toBe(z2.id);
  });
});

describe('the walked world: single steps and the Waypoint price', () => {
  const other = (s: GameState) => TOWN.settlements.find((x: any) => x.id !== s.town.waypoint)!;

  it('plots a route of single steps — every cell adjacent to the one before it', () => {
    const s = newGame(10);
    const from = s.town.waypoint, to = other(s).id;
    const keys = walkRoute(from, to);
    expect(keys.length).toBe(walkBlocks(from, to) + 1);
    for (let i = 1; i < keys.length; i++) {
      const [aq, ar] = keys[i - 1].split(',').map(Number);
      const [bq, br] = keys[i].split(',').map(Number);
      expect(hexAdjacent({ q: aq, r: ar }, { q: bq, r: br })).toBe(true);
    }
  });

  it('crosses the plotted route one block at a time and opens the destination on arrival', () => {
    const s = newGame(10);
    topUp(s);
    const from = s.town.waypoint, dest = other(s);
    const to = dest.id;
    const blocks = walkBlocks(from, to);
    startWalk(s, from, to);
    expect(s.walk?.blocksTotal).toBe(blocks);
    s.group = [];
    let ticks = 0;
    while (s.walk && ticks < blocks * 60) { tick(s, {}, { online: true }); topUp(s); ticks++; }
    expect(s.walk).toBeNull();
    expect(s.town.visited).toContain(to);
    expect(s.town.waypoint).toBe(to);
    expect(s.zone).toBe(dest.zone);
  });

  it('charges gold for a warp and never opens a Waypoint money did not earn', () => {
    const s = newGame(10);
    const dest = other(s);
    s.counters.gold = 99999;
    expect(warpTo(s, dest.id).ok).toBe(false);
    s.town.visited.push(dest.id);
    const fare = warpCost(s, dest.id);
    expect(fare).toBeGreaterThan(0);
    s.counters.gold = fare - 0.01;
    expect(warpTo(s, dest.id).ok).toBe(false);
    s.counters.gold = fare;
    const here = s.zone;
    expect(warpTo(s, dest.id).ok).toBe(true);
    expect(s.counters.gold).toBe(0);
    expect(s.town.waypoint).toBe(dest.id);
    expect(s.zone).toBe(dest.zone);
    expect(s.walk).toBeNull();
    expect(here).not.toBe(dest.zone);
  });

  it('raises a hit event the HUD can colour, with the colour read from the data', () => {
    const s = newGame(20);
    huntZone(s, s.zone);
    for (let i = 0; i < 60; i++) { tick(s, {}); topUp(s); }
    const hits = (s.fx || []).filter((e) => e.kind === 'hit');
    expect(hits.length).toBeGreaterThan(0);
    const C = E.elements as any;
    const painted = [...Object.values(C.colour), C.physical_colour, C.crit_colour] as string[];
    for (const e of hits) expect(painted).toContain(e.colour);
    // the ring is a ring: it never grows without bound
    expect(s.fx.length).toBeLessThanOrEqual(24);
  });
});
