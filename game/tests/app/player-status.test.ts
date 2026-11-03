import { describe, expect, it } from 'vitest';
import { tree } from '../../src/engine/client';
import { newGame, tick, huntZone } from '@sim/core/game';
import { exportJson, importJson, migrate } from '../../src/state/save';
import { deriveDotInstances, perSecOf, stacksOf, statusViews } from '@sim/combat/playerStatus';
import { newKeystoneRuntimeState, validatePlayerStatuses } from '@engine/keystones.ts';

/**
 * Packet D1 §7.7 — the statuses ON the character are canonical saved state. The live tick writes
 * them into `s.playerStatuses`, a load never clears them, and the save round-trips them and the
 * keystone runtime byte-for-byte without drawing RNG.
 */

describe('playerStatuses is the one store', () => {
  it('newGame opens with empty statuses and an empty keystone runtime', () => {
    const s = newGame(900);
    expect(s.playerStatuses).toEqual({});
    expect(s.keystoneRuntime).toEqual(newKeystoneRuntimeState());
  });

  it('a tick mutates the saved-state object itself — never a caller copy', () => {
    const s = newGame(901);
    huntZone(s, s.zone);
    let guard = 0;
    while (!s.group.length && guard++ < 400) tick(s, { online: true });
    const before = s.playerStatuses;
    // a shock on the character keeps living across ticks in the same object (§7.7)
    s.playerStatuses.poison = { stacks: 1, secLeft: 3, perSec: 0 };
    tick(s, { online: true });
    expect(s.playerStatuses).toBe(before);
    expect(s.playerStatuses.poison).toBeTruthy();
    expect(s.playerStatuses.poison!.secLeft).toBeLessThan(3);
  });

  it('a Push still clears the fight’s statuses from the canonical store', () => {
    const s = newGame(902);
    huntZone(s, s.zone);
    let guard = 0;
    while (!s.group.length && guard++ < 400) tick(s, { online: true });
    s.playerStatuses.burn = { stacks: 2, secLeft: 5, perSec: 10, alignedSec: 100 };
    s.player.hp = 0;
    tick(s, { online: true });
    expect(s.phase).toBe('camp');
    expect(Object.keys(s.playerStatuses)).toHaveLength(0);
  });
});

describe('the status-instance adapter wraps the native aggregate', () => {
  it('the aggregate views read stacks, dps and clock from the one store', () => {
    const s = newGame(903);
    s.playerStatuses.burn = { stacks: 3, secLeft: 5, perSec: 4 };
    expect(stacksOf(s.playerStatuses, 'burn')).toBe(3);
    expect(perSecOf(s.playerStatuses, 'burn')).toBe(12);
    expect(statusViews(s.playerStatuses)).toEqual([
      { family: 'burn', stacks: 3, dps: 12, secLeft: 5 },
    ]);
  });

  it('derived DoT instances carry the §7.6 fields on the native lane', () => {
    const s = newGame(904);
    s.playerStatuses.poison = { stacks: 2, secLeft: 4, perSec: 5 };
    s.playerStatuses.bleed = { stacks: 1, secLeft: 6, perSec: 8 };
    s.playerStatuses.chill = { stacks: 1, secLeft: 10, perSec: 0 };
    const units = tree.mechanics!.combat_time_units_per_sec;
    const period = tree.mechanics!.periodic_payment_sec;
    const list = deriveDotInstances(s.playerStatuses, 12, units, period);
    expect(list.map((i) => i.family).sort()).toEqual(['bleed', 'poison']);
    const poison = list.find((i) => i.family === 'poison')!;
    expect(poison.lane).toBe('native');
    expect(poison.budgetDps).toBe(poison.dps);
    expect(poison.nextPayAtUs).toBe(12 * units + period * units);
    expect(poison.expiresAtUs).toBe(12 * units + 4 * units);
    expect(poison.decayGroupId).toBe('native:poison:decay');
    expect(list.find((i) => i.family === 'bleed')!.budgetDps).toBe(0); // bleed is outside the elemental budget
  });
});

describe('save round-trip of the new state (§7.7)', () => {
  it('export → import → export is identical, keeps statuses and queues, and draws no RNG', () => {
    const s = newGame(905);
    s.playerStatuses.poison = { stacks: 4, secLeft: 2.5, perSec: 3, stackPerSec: [1, 1, 1, 3] };
    s.keystoneRuntime = {
      ...newKeystoneRuntimeState(),
      lastHitAtUs: 12_000_000,
      stacks: { rage: 3 },
      counters: { 'worthy-foe:m-1': 2 },
      flags: { 'shield-gate:armed': true },
      icdsUs: { 'auto-cleanse': 18_000_000 },
      bank: [{ pool: 'es', amount: 40, expiresAtUs: 22_000_000 }],
      queues: {
        ...newKeystoneRuntimeState().queues,
        deferred: [{ dueAtUs: 14_000_000, amount: 60, sourceId: 'player', targetId: 'm-1' }],
        hpDebt: [{ dueAtUs: 15_000_000, amount: 8, sourceId: 'm-2', targetId: 'player' }],
      },
    };
    const rngBefore = s.rngState;
    const a = exportJson(s);
    const loaded = importJson(a);
    const b = exportJson(loaded);
    expect(b).toBe(a);
    expect(loaded.rngState).toBe(rngBefore); // the load itself drew nothing
    expect(loaded.playerStatuses.poison?.stackPerSec).toEqual([1, 1, 1, 3]);
    expect(loaded.keystoneRuntime.queues.hpDebt).toHaveLength(1);
  });

  it('a current-format save missing or corrupting the new fields errors instead of default-filling', () => {
    const s = newGame(906);
    const text = JSON.parse(exportJson(s));
    delete (text.state as any).playerStatuses;
    expect(() => importJson(JSON.stringify(text))).toThrow(/playerStatuses/);
    const bad = JSON.parse(exportJson(s));
    bad.state.playerStatuses = { burn: { stacks: -1, secLeft: 5, perSec: 0 } };
    expect(() => importJson(JSON.stringify(bad))).toThrow(/playerStatuses\.burn/);
    const unknown = JSON.parse(exportJson(s));
    unknown.state.playerStatuses.gloom = { stacks: 1, secLeft: 1, perSec: 1 };
    expect(() => importJson(JSON.stringify(unknown))).toThrow(/gloom/);
    const rt = JSON.parse(exportJson(s));
    rt.state.keystoneRuntime = { ...rt.state.keystoneRuntime, surprise: [] };
    expect(() => importJson(JSON.stringify(rt))).toThrow(/keystoneRuntime\.surprise/);
  });

  it('a pre-v18 save backfills both fields empty and keeps everything else', () => {
    const s = newGame(907);
    s.counters.kills = 5;
    const old = JSON.parse(JSON.stringify(s));
    delete old.playerStatuses;
    delete old.keystoneRuntime;
    const migrated = migrate(old as any, 17);
    expect(migrated.playerStatuses).toEqual({});
    expect(migrated.keystoneRuntime).toEqual(newKeystoneRuntimeState());
    expect(migrated.counters.kills).toBe(5);
  });

  it('the statuses validator names the offending family and field', () => {
    expect(() => validatePlayerStatuses({ burn: { stacks: 1, secLeft: Number.NaN, perSec: 0 } }))
      .toThrow(/playerStatuses\.burn\.secLeft/);
    expect(() => validatePlayerStatuses('nope')).toThrow(/playerStatuses/);
  });

  it('the mechanics line the adapter reads lives in tree.json, not in the sim', () => {
    expect(tree.mechanics!.combat_time_units_per_sec).toBe(1_000_000);
    expect(tree.mechanics!.periodic_payment_sec).toBe(1);
    expect(tree.mechanics!.control_bucket_capacity_sec).toBe(1);
    expect(tree.mechanics!.low_life_pct).toBe(50);
    expect(tree.mechanics!.hp_cost_floor).toBe(1);
    expect(tree.mechanics!.camp_min_hp_per_sec).toBe(1);
  });
});
