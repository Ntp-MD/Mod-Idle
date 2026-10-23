import { describe, expect, it } from 'vitest';
import {
  CombatClock, EVENT_PRIORITY, compareEvents, planAttacks, type CombatEvent,
} from '../src/sim/combat-clock';
import { newGame, setLevel, tick } from '../src/sim/game';
import { buildCharacter } from '../src/sim/player';

const units = 1_000_000;

describe('combat clock (§7.1)', () => {
  it('orders by time, then the priority ladder, then actor, target and sequence', () => {
    const base: CombatEvent = { atUs: 10, priority: 30, actorId: 'player', targetId: 'm1', seq: 0, run: () => {} };
    const later = { ...base, atUs: 11 };
    const recovery = { ...base, priority: EVENT_PRIORITY.recovery };
    const mob = { ...base, priority: EVENT_PRIORITY.mobAction };
    const otherActor = { ...base, actorId: 'zplayer' };
    const first = { ...base, seq: -1 };
    expect(compareEvents(base, later)).toBeLessThan(0);
    expect(compareEvents(base, recovery)).toBeLessThan(0);
    expect(compareEvents(recovery, mob)).toBeGreaterThan(0);
    expect(compareEvents(mob, recovery)).toBeLessThan(0);
    expect(compareEvents(base, otherActor)).toBeLessThan(0);
    expect(compareEvents(first, base)).toBeLessThan(0);
  });

  it('runs only events inside the window, once each, in order', () => {
    const clock = new CombatClock(0, units);
    const seen: string[] = [];
    clock.schedule(units, EVENT_PRIORITY.playerAction, 'player', 'm', () => seen.push('end'));
    clock.schedule(0, EVENT_PRIORITY.recovery, 'player', 'm', () => seen.push('start'));
    clock.schedule(units + 1, EVENT_PRIORITY.playerAction, 'player', 'm', () => seen.push('next'));
    expect(clock.runUntil()).toBe(true);
    expect(seen).toEqual(['start', 'end']);
  });

  it('halts the rest of the window when the Push latch trips', () => {
    let hp = 10;
    const latch = new CombatClock(0, units, () => hp <= 0);
    let healed = false;
    latch.schedule(300_000, EVENT_PRIORITY.mobAction, 'mob', 'player', () => { hp = 0; });
    latch.schedule(400_000, EVENT_PRIORITY.recovery, 'player', 'player', () => { healed = true; });
    expect(latch.runUntil()).toBe(false);
    expect(hp).toBe(0);
    expect(healed).toBe(false);
  });

  it('expands accumulated progress without drift and carries the remainder', () => {
    const plan = planAttacks(0, 0.25, 2.5, units);
    expect(plan.times).toEqual([300_000, 700_000]);
    expect(plan.progressAtEnd).toBeCloseTo(0.75, 10);
    const slow = planAttacks(0, 0, 0.6, units);
    expect(slow.times).toEqual([]);
    expect(slow.progressAtEnd).toBeCloseTo(0.6, 10);
  });

  it('keeps a negative parked progress negative and fires nothing', () => {
    const plan = planAttacks(0, -10000, 1.4, units);
    expect(plan.times).toEqual([]);
    expect(plan.progressAtEnd).toBeCloseTo(-9998.6, 10);
  });

  it('a half-second ICD can elapse inside the tick the events share', () => {
    const clock = new CombatClock(0, units);
    const firings: number[] = [];
    let nextAllowed = 0;
    for (const at of [100_000, 400_000, 700_000]) {
      clock.schedule(at, EVENT_PRIORITY.mobAction, 'mob', 'player', () => {
        if (clock.nowUs < nextAllowed) return;
        nextAllowed = clock.nowUs + units / 2;
        firings.push(clock.nowUs);
      });
    }
    clock.runUntil();
    expect(firings).toEqual([100_000, 700_000]);
  });

  it('delays only pending events of the chosen actor, including events crossing the tick boundary', () => {
    const clock = new CombatClock(0, units);
    const seen: string[] = [];
    clock.schedule(100_000, EVENT_PRIORITY.playerAction, 'player', 'm', () => clock.delayActor('m', 500_000));
    clock.schedule(200_000, EVENT_PRIORITY.mobAction, 'other', 'player', () => seen.push('other'));
    clock.schedule(300_000, EVENT_PRIORITY.pendingDamage, 'm', 'player', () => seen.push('committed debt'));
    clock.schedule(400_000, EVENT_PRIORITY.mobAction, 'm', 'player', () => seen.push('delayed'));
    clock.schedule(800_000, EVENT_PRIORITY.mobAction, 'm', 'player', () => seen.push('next tick'));
    clock.runUntil();
    expect(seen).toEqual(['other', 'committed debt', 'delayed']);
    expect(clock.nowUs).toBe(units);
  });

  it('the world tick still equals one second of attack progress', () => {
    const s = newGame(7);
    setLevel(s, 10);
    const c = buildCharacter(s.player.level, s.gear, {}, 0, { add: {}, mult: {} }, s.player.points, s.player.treeRanks, {});
    const before = s.player.atkTimer;
    tick(s);
    const expected = before + c.hitsPerSec;
    const attacks = Math.floor(expected);
    expect(s.player.atkTimer).toBeCloseTo(expected - attacks, 8);
  });
});
