import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { actorHitFrom, combatCastProgress, combatFeedbackPops, compactCombatFeedback, createCombatFeedbackCache, indexActorHits, splitDisplayedDamage } from '../../src/ui/combat/combat-feedback';
import CombatCastBar from '../../src/ui/combat/CombatCastBar.svelte';
import CombatArenaScene from '../../src/ui/combat/CombatArenaScene.svelte';
import { createCombatArena, recordCombatArenaFx, syncCombatArena, type CombatArenaAction } from '@sim/combat/combat-arena';
import { characterSheet, newGame } from '@sim/core/game';
import { fx, tickFxClock } from '@sim/core/feedback';
import { CombatClock } from '@sim/combat/combat-clock';
import { createFieldState } from '@sim/world/field-area';
import type { FxEvent } from '@sim/core/types';

const hit = (over: Partial<FxEvent> = {}): FxEvent => ({ id: 1, sec: 1, atUs: 1_000_000,
  kind: 'hit', side: 'field', via: 'cast', skillId: 'attack.water_ball', mobId: 'target', value: 101,
  text: '101', colour: '#fff', hitCount: 5, ...over });

describe('combat hit feedback facts', () => {
  it('reuses immutable contact expansions while accepting new receipts, clocks and seeks', () => {
    const read = createCombatFeedbackCache(), event = hit();
    const first = read([event], 1_000_000);
    const again = read([event], 1_000_000);
    expect(again).toEqual(first);
    expect(again[0]).toBe(first[0]);
    const replacement = read([{ ...event, value: 200 }], 1_000_000);
    expect(replacement.reduce((sum, pop) => sum + pop.value!, 0)).toBe(200);
    expect(read([event], 1000)[1].atUs! - read([event], 1000)[0].atUs!).toBe(110);
    const rewound = read([event], 1_000_000);
    expect(rewound[1].atUs! - rewound[0].atUs!).toBe(110_000);
    expect(read([], 1_000_000)).toEqual([]);
  });

  it('indexes the latest real contact per actor and respects duration, future hits and absorption', () => {
    const events = combatFeedbackPops([
      hit({ id: 1, hitCount: 1, atUs: 100_000, value: 1000 }),
      hit({ id: 2, hitCount: 1, atUs: 200_000, value: 10 }),
      hit({ id: 3, hitCount: 1, atUs: 400_000, value: 100 }),
      hit({ id: 4, kind: 'taken', hitCount: 1, atUs: 250_000, value: 50, hpDamage: 0, esDamage: 50 }),
    ], 1_000_000);
    const indexed = indexActorHits(events, 300_000, 1_000_000);
    expect(actorHitFrom(indexed, 'target', 160)?.id).toBe(2);
    expect(actorHitFrom(indexed, 'player', 160)?.id).toBe(4);
    expect(actorHitFrom(indexed, 'missing', 160)).toBeUndefined();
    expect(actorHitFrom(indexActorHits(events, 700_000, 1_000_000), 'target', 160)).toBeUndefined();
    expect(actorHitFrom(indexActorHits(events, 150_000, 1_000_000), 'target', 160)?.id).toBe(1);
  });
  it.each([0, 1, 101, 101.4, 99999.9])('preserves rounded total %s across five visual contacts', amount => {
    const values = splitDisplayedDamage(amount, 5);
    expect(values).toHaveLength(5);
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(Math.round(amount));
    expect(values.every(value => Number.isSafeInteger(value) && value >= 0)).toBe(true);
  });

  it('stamps five display contacts without changing the damage receipt', () => {
    const event = hit(), before = structuredClone(event);
    const pops = combatFeedbackPops([event], 1_000_000);
    expect(pops.map(pop => pop.displayIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(pops.map(pop => pop.displayKey)).size).toBe(5);
    expect(pops[4].atUs).toBeGreaterThan(pops[0].atUs!);
    expect(pops.reduce((sum, pop) => sum + pop.value!, 0)).toBe(101);
    expect(event).toEqual(before);
  });

  it('never splits real indexed impacts, DoT, healing or ordinary swings', () => {
    for (const event of [hit({ hitIndex: 3 }), hit({ via: 'dot' }), hit({ kind: 'heal' }), hit({ via: 'swing' })]) {
      const [pop, extra] = combatFeedbackPops([event], 1_000_000);
      expect(extra).toBeUndefined();
      expect(pop.value).toBe(event.value);
      expect(pop.atUs).toBe(event.atUs);
    }
  });

  it('compacts dense contacts with explicit count and no lost damage or crit lane', () => {
    const events = Array.from({ length: 20 }, (_, index) => hit({ id: index + 1, actionId: 8,
      hitIndex: index + 1, hitCount: 20, crit: index % 2 === 0, value: 10 }));
    const compact = compactCombatFeedback(combatFeedbackPops(events, 1_000_000), 4);
    expect(compact).toHaveLength(2);
    expect(compact.reduce((sum, pop) => sum + pop.value!, 0)).toBe(200);
    expect(compact.map(pop => pop.collapsedCount)).toEqual([10, 10]);
  });

  it('retains contacts after the notification ring overflows and clears them across encounters', () => {
    const s = newGame(931), arena = createCombatArena();
    s.field = createFieldState(s);
    const c = characterSheet(s);
    syncCombatArena(arena, s, 0, 1_000_000, c.maxHp);
    tickFxClock.set(s, { clock: new CombatClock(0, 1_000_000), arena });
    for (let index = 0; index < 40; index++) fx(s, { kind: 'hit', via: 'cast', skillId: 'attack.fireball', value: 1, text: '1', colour: '#fff' });
    tickFxClock.delete(s);
    expect(s.fx.length).toBeLessThan(40);
    expect(arena.feedback).toHaveLength(40);
    recordCombatArenaFx(arena, s, arena.feedback![0]);
    expect(arena.feedback).toHaveLength(40);
    s.field!.areaKey += ':next';
    syncCombatArena(arena, s, 0, 1_000_000, c.maxHp);
    expect(arena.feedback).toHaveLength(0);
  });

  it.each(['full', 'reduced', 'minimal'] as const)('renders all five named damage parts in %s after the target leaves', effectLevel => {
    const s = newGame(932), arena = createCombatArena(), c = characterSheet(s);
    syncCombatArena(arena, s, 0, 1_000_000, c.maxHp);
    arena.feedback = [{ ...hit({ atUs: -450_000 }), point: { ...arena.player } }];
    const body = render(CombatArenaScene, { props: { arena, s, c, ring: [], effectLevel, speed: 4 } }).body;
    expect(body.match(/data-hit-count="5"/g)).toHaveLength(5);
    expect(body).toContain('data-hit-index="5"');
  });
});

describe('cast progress', () => {
  const action: CombatArenaAction = { id: 1, actorId: 'player', kind: 'cast', skillId: 'attack.meteor',
    x: 1, y: 1, atUs: 0, endsAtUs: 3_000_000,
    timing: { delivery: 'ground', startedAtUs: 0, releaseAtUs: 1_000_000,
      impactAtUs: 2_000_000, recoveryUntilUs: 1_400_000 } };

  it('shows the actual fraction and remaining time, then ends at release', () => {
    expect(combatCastProgress(action, 250_000, 1_000_000)).toMatchObject({ progress: .25, remainingSec: .75 });
    expect(combatCastProgress(action, 1_000_000, 1_000_000)).toBeUndefined();
    expect(combatCastProgress({ ...action, cancelledAtUs: 100_000 }, 250_000, 1_000_000)).toBeUndefined();
  });

  it('renders a named accessible progress bar for a hostile cast', () => {
    const cast = combatCastProgress({ ...action, actorId: 'mob' }, 500_000, 1_000_000)!;
    const body = render(CombatCastBar, { props: { cast, name: 'Meteor' } }).body;
    expect(body).toContain('role="progressbar"');
    expect(body).toContain('Enemy casting Meteor');
    expect(body).toContain('aria-valuenow="50"');
    expect(body).toContain('0.5s');
  });
});
