import { describe, it, expect } from 'vitest';
import { E, eng } from '../src/engine/client';
import { newGame, tick, setLevel } from '../src/sim/game';
import { settlementOfZone } from '../src/sim/town';
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
