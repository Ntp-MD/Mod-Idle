import { describe, expect, it } from 'vitest';
import { TOWN } from '../src/engine/client';
import { catchUp, catchUpPlan, newGame, tick } from '../src/sim/game';
import { migrate, SCHEMA_VERSION } from '../src/state/save';

const STEP = (TOWN as any).economy.step_sec as number;

describe('the live city ledger', () => {
  it('starts from the data and steps only once a whole economy step has gathered', () => {
    const s = newGame(11);
    expect(s.economy.nowSec).toBe(0);
    for (let second = 0; second < STEP - 1; second++) tick(s);
    expect(s.economy.accumSec).toBe(STEP - 1);
    expect(s.economy.nowSec).toBe(0);
    tick(s);
    expect(s.economy.accumSec).toBe(0);
    expect(s.economy.nowSec).toBe(STEP);
  });

  it('lands the online and the away clock on the same cities', () => {
    const secs = STEP * 7 + 1234;
    const simulated = catchUpPlan(secs).secs;
    const online = newGame(12);
    for (let second = 0; second < simulated; second++) tick(online);
    const away = newGame(12);
    catchUp(away, secs);
    expect(away.economy).toEqual(online.economy);
  });

  it('keeps the ledger across a save round trip and continues identically', () => {
    const live = newGame(13);
    for (let second = 0; second < STEP * 3 + 500; second++) tick(live);
    const restored = migrate(JSON.parse(JSON.stringify(live)), SCHEMA_VERSION);
    expect(restored.economy).toEqual(live.economy);
    for (let second = 0; second < 2000; second++) {
      tick(live);
      tick(restored);
    }
    expect(restored.economy).toEqual(live.economy);
  });

  it('backfills an older save by replaying the steps its clock implies', () => {
    const s = newGame(14);
    s.clockSec = STEP * 5 + 42;
    delete (s as any).economy;
    const migrated = migrate(s, 19);
    expect(migrated.economy.nowSec).toBe(STEP * 5);
    expect(migrated.economy.accumSec).toBe(42);
  });

  it('refuses a saved ledger the engine cannot hold', () => {
    const s = newGame(15);
    const bad = JSON.parse(JSON.stringify(s));
    bad.economy.cities.highspire.budget = -1;
    expect(() => migrate(bad, SCHEMA_VERSION)).toThrow('budget');
    const torn = JSON.parse(JSON.stringify(s));
    torn.economy.accumSec = STEP;
    expect(() => migrate(torn, SCHEMA_VERSION)).toThrow('next step');
  });
});
