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
    const ra = catchUp(a, secs);
    const rb = await catchUpAsync(b, secs);
    expect(rb).toEqual(ra);
    expect(shot(b)).toBe(shot(a));
    expect(a.counters.kills).toBeGreaterThan(0); // the claim is about a run that did something
  });

  it('equals a plain row of offline ticks, so the slice cannot add or lose a second', () => {
    const secs = 2500;
    const a = busy(72, 20);
    const b = busy(72, 20);
    catchUp(a, secs);
    // the statuses ride in the saved state (`s.playerStatuses`) for the whole window, the way the
    // live scheduler holds them: §7.7
    for (let i = 0; i < secs; i++) tick(b, { online: false });
    expect(shot(b)).toBe(shot(a));
  });

  it('is reproducible from the seed on both paths, so neither can reroll an absence', async () => {
    const a = busy(73, 25);
    const b = busy(73, 25);
    await catchUpAsync(a, 3000);
    catchUp(b, 3000);
    const c = busy(73, 25);
    catchUp(c, 3000);
    expect(shot(c)).toBe(shot(a));
    expect(shot(c)).toBe(shot(b));
  });
});

/**
 * The live scheduler's whole job is turning wall time into whole sim seconds, so the accumulator is
 * tested on its own: the claim is the pace, not the frame rate, and a tab that was throttled must owe
 * the time it could not spend rather than lose it.
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

  it('spends at most the batch in one wake and keeps the rest owed, never dropped', () => {
    const b = schedulerBatch(1000, 1);
    expect(b.ticks).toBe(MAX_BATCH);
    expect(b.acc).toBeCloseTo(1000 + WAKE_SEC - MAX_BATCH, 10); // the backlog stays owed, not lost
    let acc = 100;
    let ticks = 0;
    for (let wake = 0; wake < 20; wake++) {
      const step = schedulerBatch(acc, 1);
      acc = step.acc;
      ticks += step.ticks;
    }
    expect(ticks).toBe(105); // the whole 100s backlog plus the 5s that passed replays, second for second
    expect(acc).toBeCloseTo(0, 10);
    let idle = 0;
    for (let wake = 0; wake < 100; wake++) idle = schedulerBatch(idle, 1).acc;
    expect(idle).toBeLessThan(1);
  });
});

describe('the away window has no time limit', () => {

  it('keeps every whole second even across days or months', () => {
    expect(E.inventory.offline_cap_hr).toBeNull();
    expect(catchUpPlan(365 * 86400)).toEqual({ secs: 365 * 86400, capped: false });
    expect(catchUpPlan(600)).toEqual({ secs: 600, capped: false });
    // a clock that runs backwards or a fractional second is no time at all
    expect(catchUpPlan(-500)).toEqual({ secs: 0, capped: false });
    expect(catchUpPlan(59.9).secs).toBe(59);
    expect(catchUpPlan(NaN).secs).toBe(0);
    expect(catchUpPlan(Infinity).secs).toBe(0);
  });

  it('credits the complete span beyond the old limit, identically on both paths', async () => {
    const a = busy(74, 10);
    const b = busy(74, 10);
    const away = 12 * 3600 + 1;
    const ra = catchUp(a, away);
    const rb = await catchUpAsync(b, away);
    expect(ra.simulated).toBe(away);
    expect(rb.simulated).toBe(away);
    expect(ra.capped).toBe(false);
    expect(shot(b)).toBe(shot(a));
  }, 120000);

  it('can cancel between slices and keeps the simulated portion deterministic', async () => {
    const a = busy(76, 20), b = busy(76, 20);
    a.bossDueAt = b.bossDueAt = 900;
    const controller = new AbortController();
    const progress: number[] = [];
    const result = await catchUpAsync(a, 5000, { signal: controller.signal, onProgress: (done) => {
      progress.push(done);
      if (done > 0) controller.abort();
    } });
    expect(result.cancelled).toBe(true);
    expect(result.simulated).toBeGreaterThan(0);
    expect(result.simulated).toBeLessThan(5000);
    expect(progress.at(-1)).toBe(result.simulated);
    catchUp(b, result.simulated);
    expect(shot(a)).toBe(shot(b));
  });

  it('does not mutate a character when cancelled before catching up', async () => {
    const s = busy(77, 20);
    const before = shot(s);
    const controller = new AbortController(); controller.abort();
    expect(await catchUpAsync(s, 86400, { signal: controller.signal })).toEqual({ simulated: 0, capped: false, cancelled: true });
    expect(shot(s)).toBe(before);
  });
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
    catchUp(a, secs);
    await catchUpAsync(b, secs);
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
