import { describe, it, expect } from 'vitest';
import { E } from '../src/engine/client';
import { newGame, tick, catchUp, catchUpAsync, catchUpPlan, schedulerBatch, WAKE_SEC, MAX_BATCH, huntZone, setLevel } from '../src/sim/game';
import type { GameState } from '../src/sim/types';

/**
 * The world clock has three callers and one loop: the live scheduler ticks online, `catchUp` runs the
 * away seconds in a row, `catchUpAsync` runs the same ticks in slices so a day-long absence cannot
 * freeze first paint. The published rates are measured through this loop, so the two away paths must
 * land on byte-identical states for one seed — the slicing is a scheduling detail, never a number.
 */

/**
 * The whole state as the save writes it: same construction, same key order, so the strings compare.
 * `lastSavedAt` is the one field the constructor stamps from the wall clock rather than from the seed,
 * so it is levelled before the comparison — every other field is the loop's own doing.
 */
const shot = (s: GameState) => {
  s.lastSavedAt = 0;
  return JSON.stringify(s);
};

/** A character that actually fights while away, so the states carry real drops, kills and levels. */
function busy(seed: number, level: number): GameState {
  const s = newGame(seed);
  setLevel(s, level);
  huntZone(s, s.zone);
  return s;
}

describe('the away clock: one loop, two schedules', () => {
  it('lands the sync and the sliced catch-up on the identical state', async () => {
    // 5,000 sec crosses the 2,000-tick slice boundary three times, which is where a divergence would show
    const secs = 5000;
    const a = busy(71, 30);
    const b = busy(71, 30);
    const ra = catchUp(a, {}, secs);
    const rb = await catchUpAsync(b, {}, secs);
    expect(rb).toEqual(ra);
    expect(shot(b)).toBe(shot(a));
    expect(a.counters.kills).toBeGreaterThan(0); // the claim is about a run that did something
  });

  it('equals a plain row of offline ticks, so the slice cannot add or lose a second', () => {
    const secs = 2500;
    const a = busy(72, 20);
    const b = busy(72, 20);
    catchUp(a, {}, secs);
    for (let i = 0; i < secs; i++) tick(b, {}, { online: false });
    expect(shot(b)).toBe(shot(a));
  });

  it('is reproducible from the seed on both paths, so neither can reroll an absence', async () => {
    const a = busy(73, 25);
    const b = busy(73, 25);
    await catchUpAsync(a, {}, 3000);
    catchUp(b, {}, 3000);
    const c = busy(73, 25);
    catchUp(c, {}, 3000);
    expect(shot(c)).toBe(shot(a));
    expect(shot(c)).toBe(shot(b));
  });
});

/**
 * The live scheduler's whole job is turning wall time into whole sim seconds, so the accumulator is
 * tested on its own: the claim is the pace, not the frame rate, and a tab that was throttled must lose
 * the time it could not spend rather than owe it.
 */
describe('the live wake turns wall time into whole seconds', () => {
  it('pays one sim second per second of real time at speed 1', () => {
    let acc = 0;
    let ticks = 0;
    for (let wake = 0; wake < 4 * 60; wake++) {
      const b = schedulerBatch(acc, 1);
      acc = b.acc;
      ticks += b.ticks;
    }
    expect(ticks).toBe(60); // four 250 ms wakes make one second, and nothing drifts over an hour of them
  });

  it('fires one batched wake at speed 4 instead of four stacked timers', () => {
    expect(schedulerBatch(0, 4)).toEqual({ ticks: 1, acc: 0 });
    expect(schedulerBatch(0, 1)).toEqual({ ticks: 0, acc: WAKE_SEC });
  });

  it('carries a fraction forward, so a fast speed never loses a press', () => {
    let acc = 0;
    let ticks = 0;
    const got: number[] = [];
    for (let wake = 0; wake < 8; wake++) {
      const b = schedulerBatch(acc, 1.5);
      acc = b.acc;
      ticks += b.ticks;
      got.push(b.ticks);
    }
    expect(got).toEqual([0, 0, 1, 0, 0, 1, 0, 1]); // a third of a second short of a tick, then one over
    expect(ticks).toBe(3); // eight 250 ms wakes at ×1.5 are three seconds of world, none of them dropped
    expect(acc).toBeCloseTo(0, 10);
  });

  it('spends at most the batch in one wake and drops what a throttled tab could not fit', () => {
    const b = schedulerBatch(1000, 1);
    expect(b.ticks).toBe(MAX_BATCH);
    expect(b.acc).toBe(0); // owed nothing: a queued burst would spend the next frames catching up
    let acc = 0;
    for (let wake = 0; wake < 100; wake++) acc = schedulerBatch(acc, 1).acc;
    expect(acc).toBeLessThan(1);
  });
});

describe('the away window is capped by the save rule', () => {
  const CAP = E.inventory.offline_cap_hr * 3600;

  it('simulates exactly the cap and reports the cut, for either path', () => {
    expect(catchUpPlan(CAP + 7200)).toEqual({ secs: CAP, capped: true });
    expect(catchUpPlan(600)).toEqual({ secs: 600, capped: false });
    // a clock that runs backwards or a fractional second is no time at all
    expect(catchUpPlan(-500)).toEqual({ secs: 0, capped: false });
    expect(catchUpPlan(59.9).secs).toBe(59);
  });

  it('credits no more than the cap on either path, and both agree', async () => {
    const a = busy(74, 10);
    const b = busy(74, 10);
    const away = CAP + 3600;
    const ra = catchUp(a, {}, away);
    const rb = await catchUpAsync(b, {}, away);
    expect(ra.simulated).toBe(CAP);
    expect(rb.simulated).toBe(CAP);
    expect(ra.capped).toBe(true);
    expect(shot(b)).toBe(shot(a));
  }, 120000); // the capped hours are 43,200 ticks on each path, the same window the save rule promises
});

describe('the online clocks do not accrue while away', () => {
  it('shifts the boss and dungeon due times by exactly the simulated seconds', async () => {
    const a = busy(75, 20);
    const b = busy(75, 20);
    for (const s of [a, b]) {
      s.bossDueAt = s.clockSec + 900;
      s.dungeonClearedAt = s.clockSec - 60;
    }
    const start = a.clockSec;
    const secs = 4000;
    catchUp(a, {}, secs);
    await catchUpAsync(b, {}, secs);
    // the away ticks did advance clockSec, so the due times had to move with it: what is left of the
    // gate is measured in ONLINE seconds and is exactly what it was when the player left
    expect(a.clockSec).toBe(start + secs);
    expect(b.clockSec).toBe(a.clockSec);
    expect(a.bossDueAt).toBe(start + 900 + secs);
    expect(b.bossDueAt).toBe(a.bossDueAt);
    expect(a.dungeonClearedAt).toBe(start - 60 + secs);
    expect(b.dungeonClearedAt).toBe(a.dungeonClearedAt);
  });
});
