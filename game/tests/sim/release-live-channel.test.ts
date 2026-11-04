import { expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, stepCombat } from '@sim/core/game';
import { createFlights } from '@sim/core/tick/flights';
import { createCastTrigger } from '@sim/core/tick/cast-trigger';
import { CombatClock } from '@sim/combat/combat-clock';
import type { ManualControl } from '@sim/combat/combat-actions';
import { mobFixture, pinFieldPopulation } from '../fixtures/mobFixture';

it.each([false, true])('measures live Void Ray payments and refresh with early release=%s', early => {
  const id = 'attack.void_ray';
  const state = newGame(41);
  setLevel(state, 90);
  state.hunting = true;
  const mob = mobFixture({ id: 'ray-target', hp: 1e9, hpMax: 1e9, ps: 0,
    evasion: 0, dodgeRate: 0, armour: 0, innate: [], skillIds: [] });
  state.group = [mob];
  state.skills.owned[id] = 0;
  state.skills.list.fill(null);
  state.skills.list[0] = id;
  const c = characterSheet(state);
  state.player.mana = c.maxMana;
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1e6, c.maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 3, y: 6 });
  pinFieldPopulation(state);
  const manual: ManualControl = early ? { holdToken: 'key:Digit1', cast: { skillId: id, holdToken: 'key:Digit1' } } : {};
  for (let step = 0; step < 40 && !arena.intent?.channel; step++) stepCombat(state, { arena, manual });
  expect(arena.intent?.channel).toBeDefined();
  const owner = { ...arena.intent!.channel! };
  const startPaid = c.maxMana - state.player.mana;
  expect(startPaid).toBeCloseTo(sm.costOf(sm.byId[id], { skillLevel: 1 }).amount, 8);
  const before = state.player.mana;
  const clock = new CombatClock(0, owner.endsAtUs);
  const { payCast } = createCastTrigger({ s: state, c } as Parameters<typeof createCastTrigger>[0]);
  const payments: number[] = [];
  const hits: number[] = [];
  const marks: number[] = [];
  const work = createFlights({ arena, clock, rng: mulberry32(7), s: state, c, statuses: state.playerStatuses,
    units: 1e6, tickStartUs: 0, tickEndUs: owner.endsAtUs, advanceLiveClocks: () => {},
    applyCastOutcome: report => {
      if (report?.targets) hits.push(report.dealt ?? 0);
      marks.push(state.mobStatus[mob.id]?.statuses.mark?.stacks ?? 0);
    }, cancelIntent: () => {}, cancelFlight: () => {}, manual,
    payCast: cost => { payments.push(cost.manaCost); payCast(cost); } });
  for (const [index, flight] of [...arena.flights].entries()) {
    if (early && index === 1) manual.holdToken = undefined;
    work.resolveFlight(flight, flight.timing.impactAtUs);
  }
  const paidTicks = early ? 1 : owner.ticks;
  expect(payments).toHaveLength(paidTicks);
  expect(hits).toHaveLength(paidTicks);
  expect(payments.every(amount => amount === owner.manaPerTick)).toBe(true);
  expect(state.player.mana).toBeCloseTo(before - payments.reduce((a, b) => a + b, 0), 8);
  expect(new Set(marks).size).toBe(1);
  expect(marks[0]).toBeGreaterThan(0);
  expect(arena.intent?.channel).toBeUndefined();
  expect(state.skills.cd[id]).toBeGreaterThan(0);
  console.log(JSON.stringify({ scenario: 'live-channel', id, early, startPaid, payments, hits, marks,
    manaAfter: state.player.mana, cooldown: state.skills.cd[id] }));
});
