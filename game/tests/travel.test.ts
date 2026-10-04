import { describe, it, expect } from 'vitest';
import { E, eng } from '../src/engine/client';
import { newGame, tick } from '../src/sim/game';
import { settlementOfZone } from '../src/sim/town';

describe('the stay / move on switch', () => {
  it('defaults to staying, so nothing travels without being told', () => {
    expect(newGame(81).travel).toBe('stay');
  });

  it('does not move a character that is over level in the opening zone', () => {
    const s = newGame(82);
    s.player.level = 60;
    for (let i = 0; i < 60; i++) tick(s, {});
    expect(s.zone).toBe(E.opening.settlement_zone);
    expect(s.log.some((l) => /Moving on/.test(l.text))).toBe(false);
  });

  it('walks on to the next opened settlement once this zone band is behind', () => {
    const s = newGame(83);
    s.player.level = 60;
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
    s.player.level = first.levels[1]; // exactly at the top, not past it
    s.travel = 'forward';
    s.town.visited = eng.ZONES.slice(0, 3).map((z: any) => settlementOfZone(z.id)!.id);
    for (let i = 0; i < 30; i++) tick(s, {});
    expect(s.zone).toBe(first.id);
  });
});
