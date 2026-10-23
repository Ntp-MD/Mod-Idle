import { describe, expect, it } from 'vitest';
import { E, tree } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { playerSwing } from '../src/sim/combat';
import { KEYSTONE_HANDLERS, registerStaticKeystoneHandlers, supportedKeystoneKeys } from '../src/sim/keystone-runtime';
import {
  armourBreak, borrowedRecoup, crimsonPactSplit, deferredHit, disruptingStop, endlessHungerBank,
  equilibriumResistance, escapeBurst, maledictionValue, parasiticLeech, plagueTransfer,
  staggeringSplit, surgeonStream, timeOfNeedHeal, toxicExecution, type KeystoneBundle,
} from '../../engine/keystones.ts';
import type { Mob } from '../src/sim/types';
import { characterSheet, huntZone, newGame, spawnMob, tick, catchUp } from '../src/sim/game';
import { placeKeystoneDoT, placeStatus } from '../src/sim/mobStatus';
import { NO_CURSE } from '../src/sim/curse';
import { exportJson, importJson } from '../src/state/save';

registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys(E.elements.status_of));
const h = (key: string) => KEYSTONE_HANDLERS[key] as any;
const bundle = (key: string, params: Record<string, number | string>): KeystoneBundle => ({ key, params });
function mob(over: Partial<Mob> = {}): Mob {
  return {
    id: 'm1', species: 'Dummy', kind: 'normal', zone: 1, level: 1, hp: 1000, hpMax: 1000,
    ps: 0, acc: 0, evasion: 0, dodgeRate: 0, armour: 0, res: 0, damage: 'physical',
    innate: [], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
  } as Mob;
}

describe('Packet K — status mechanics', () => {
  it('09 Crimson Pact pays half now and owes the full physical as Bleed over 4s', () => {
    expect(crimsonPactSplit(100, { directPhysicalPct: 50, bleedTotalPct: 100, durationSec: 4 }))
      .toEqual({ direct: 50, bleedTotal: 100, bleedDps: 25 });
  });

  it('20 Toxic Execution turns the crit bonus into 4s of Poison with no Element', () => {
    expect(toxicExecution(100, 1, { durationSec: 4 })).toEqual({ budgetDps: 100, dps: 25 });
  });

  it('28 Malediction scales add lines and mult distance from 1', () => {
    expect(maledictionValue('add', 20, { effectMult: 1.75 })).toBe(35);
    expect(maledictionValue('mult', 0.8, { effectMult: 1.75 })).toBeCloseTo(0.65, 9);
  });

  it('30 Elemental Equilibrium raises the dominant resistance and lowers the others, floor 0', () => {
    expect(equilibriumResistance(10, 50, { ownResPlus: 10, otherResMinus: 20 })).toEqual({ own: 20, other: 30 });
    expect(equilibriumResistance(10, 10, { ownResPlus: 10, otherResMinus: 20 })).toEqual({ own: 20, other: 0 });
  });

  it('43 Armourbreaker breaks 5% of the initial Armour per hit, capped at 60%', () => {
    expect(armourBreak(1000, 0, { armourBreakPct: 5, maxBreakPct: 60 })).toEqual({ armour: 950, stacks: 1 });
    expect(armourBreak(1000, 11, { armourBreakPct: 5, maxBreakPct: 60 })).toEqual({ armour: 400, stacks: 12 });
    expect(armourBreak(1000, 12, { armourBreakPct: 5, maxBreakPct: 60 }).armour).toBe(400);
  });

  it('46 Disrupting Blows stops only a Hit worth 5% of Max HP', () => {
    expect(disruptingStop(50, 1000, { hitMaxHpThresholdPct: 5 })).toBe(true);
    expect(disruptingStop(49, 1000, { hitMaxHpThresholdPct: 5 })).toBe(false);
  });

  it('60 Plague Courier keeps the instance clock and lifetime', () => {
    expect(plagueTransfer(10, 2000, 5000)).toEqual({ dps: 10, nextPayAtUs: 2000, expiresAtUs: 5000 });
  });

  it('66 Elemental Conduit opens an extra attempt only when the extra lane carried damage', () => {
    expect(h('elemental-conduit').status(5)).toBe(true);
    expect(h('elemental-conduit').status(0)).toBe(false);
  });
});

describe('Packet L — timed recovery', () => {
  it('07 Endless Hunger banks the excess up to 20% of the destination pool', () => {
    expect(endlessHungerBank(0, 150, 500, { bankCapPct: 20 })).toBe(100);
    expect(endlessHungerBank(90, 30, 500, { bankCapPct: 20 })).toBe(100);
  });

  it('17 Master Surgeon spreads ×1.5 over four seconds', () => {
    expect(surgeonStream(100, { healMult: 1.5, durationSec: 4 })).toEqual({ total: 150, perSec: 37.5 });
  });

  it('21 Delayed Demolition pays 60% now and 40% ×1.5 after the delay', () => {
    expect(deferredHit(100, { deferredPct: 40, deferredMult: 1.5 })).toEqual({ immediate: 60, deferred: 60 });
    const c = buildCharacter(1, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, undefined, {},
      [bundle('delayed-demolition', { deferredPct: 40, deferredMult: 1.5, delaySec: 2 })]);
    const r = playerSwing(() => 0.99, { ...c, phys: 100, critChance: 0 }, mob({ armour: 0 }), null, undefined, 0);
    expect(r.deferred).toBeGreaterThan(0);
  });

  it('24 Escape Artist bursts 50% Max ES, halved by 58 when that is bought', () => {
    expect(escapeBurst(100, { esBurstPct: 50 })).toBe(50);
  });

  it('36 Time of Need heals 15% of Full Max HP', () => {
    expect(timeOfNeedHeal(1000, { healMaxHpPct: 15 })).toBe(150);
  });

  it('40 Borrowed Time recoups 40% over six payments', () => {
    expect(borrowedRecoup(100, { recoupPct: 40, durationSec: 6 }).total).toBeCloseTo(40, 9);
    expect(borrowedRecoup(100, { recoupPct: 40, durationSec: 6 }).perPay).toBeCloseTo(40 / 6, 9);
  });

  it('56 Staggering Resolve pays 60% now and five equal debts', () => {
    expect(staggeringSplit(100, { deferredPct: 40, durationSec: 5 })).toEqual({ immediate: 60, perDebt: 8 });
  });

  it('61 Parasitic Affliction returns 2% of actual DoT damage', () => {
    expect(parasiticLeech(100, { baseLeechPct: 2 })).toBe(2);
    expect(parasiticLeech(0, { baseLeechPct: 2 })).toBe(0);
  });

  it('the registry now opens all fifty-two catalogue keys', () => {
    expect(supportedKeystoneKeys(KEYSTONE_HANDLERS)).toHaveLength(105);
  });
});

/** Real spawn and sheet, with automatic consumables and unrelated attacks parked. */
function liveFight(keys: string[] = []) {
  const state = newGame(4242);
  state.player.treeRanks = Object.fromEntries(keys.map((key) => [`keystone.${key}`, 1]));
  state.player.autoSpend = false;
  state.player.level = 40;
  state.player.points.wis = 100;
  huntZone(state, 1);
  const target = spawnMob(() => 0.5, 1, 'normal');
  Object.assign(target, {
    id: 'timed-target', hp: 1e9, hpMax: 1e9, ps: 0, acc: 0, evasion: 0,
    dodgeRate: 0, armour: 0, res: 0, resByElement: {}, innate: [],
    hitsPerSec: 0, atkTimer: 0, skillIds: [],
  });
  state.group = [target];
  const c = characterSheet(state);
  state.player.hp = c.maxHp;
  state.player.mana = c.maxMana;
  state.player.es = 0;
  state.player.atkTimer = -100;
  state.farm.potions = {};
  state.clockSec = 10;
  return state;
}

describe('live Keystone timing and recovery', () => {
  const units = tree.mechanics!.combat_time_units_per_sec;

  it.each([0, 0.5, 1])('pays lethal HP debt at +%ss before an attack at that time or later', (due) => {
    const state = liveFight(['staggering-resolve']);
    state.group[0].hp = 0.01;
    const c = characterSheet(state);
    state.player.atkTimer = 1 - c.hitsPerSec * Math.max(0.25, due);
    state.keystoneRuntime.queues.hpDebt.push({
      dueAtUs: (state.clockSec + due) * units, amount: c.maxHp + 1,
      sourceId: state.group[0].id, targetId: 'player',
    });
    tick(state, { autoSkills: false });
    expect(state.counters.kills).toBe(0);
    expect(state.counters.pushes).toBe(1);
    expect(state.phase).toBe('camp');
  });

  it.each([0.25, 1, 1.25])('keeps deferred damage scheduled at +%ss in order with enemy actions', (due) => {
    const state = liveFight(['delayed-demolition']);
    Object.assign(state.group[0], { hp: 1, hitsPerSec: 1, atkTimer: 0.75, ps: 5, acc: 1e9 });
    state.keystoneRuntime.queues.deferred.push({
      dueAtUs: (state.clockSec + due) * units, amount: 2,
      sourceId: 'player', targetId: state.group[0].id,
    });
    tick(state, { autoSkills: false });
    expect(state.fx.some((event) => event.kind === 'taken')).toBe(due > 0.25);
    expect(state.counters.kills).toBe(due <= 1 ? 1 : 0);
    expect(state.keystoneRuntime.queues.deferred).toHaveLength(due <= 1 ? 0 : 1);
  });

  it.each([0.25, -0.8])('Disrupting Blows preserves delayed progress %s through a reload', (progress) => {
    const state = liveFight(['disrupting-blows']);
    Object.assign(state.group[0], { hp: 1000, hpMax: 1000, hitsPerSec: 1, atkTimer: progress, ps: 5, acc: 1e9 });
    state.player.atkTimer = 1 - characterSheet(state).hitsPerSec * 0.1;
    tick(state, { autoSkills: false });
    expect(state.fx.some((event) => event.kind === 'hit')).toBe(true);
    expect(state.fx.some((event) => event.kind === 'taken')).toBe(false);
    expect(state.group[0].atkTimer).toBeCloseTo(progress + 0.5, 8);

    const loaded = importJson(exportJson(state));
    state.player.atkTimer = loaded.player.atkTimer = -100;
    state.fx = []; loaded.fx = [];
    tick(state, { autoSkills: false });
    tick(loaded, { autoSkills: false });
    expect(state.fx.some((event) => event.kind === 'taken')).toBe(progress > 0);
    expect(loaded.player.hp).toBe(state.player.hp);
    expect(loaded.group[0].atkTimer).toBe(state.group[0].atkTimer);
    if (progress < 0) {
      tick(state, { autoSkills: false });
      tick(loaded, { autoSkills: false });
      expect(state.fx.some((event) => event.kind === 'taken')).toBe(true);
      expect(loaded.player.hp).toBe(state.player.hp);
    }
  });

  it.each([false, true])('Escape Artist replaces natural recharge (Capacitive Casting: %s)', (capacitive) => {
    const state = liveFight(['escape-artist', ...(capacitive ? ['capacitive-casting'] : [])]);
    const c = characterSheet(state);
    state.player.esIdleSec = E.energy_shield.delay_sec;
    tick(state, { autoSkills: false });
    const bundles = tree.keystoneBundles(state.player.treeRanks);
    const escape = bundles.find((entry) => entry.key === 'escape-artist')!;
    const factor = Number(bundles.find((entry) => entry.key === 'capacitive-casting')?.params.naturalEsRegenMult ?? 1);
    const burst = escapeBurst(c.es, escape.params as Record<string, number>) * factor;
    expect(state.player.es).toBeCloseTo(burst, 8);
    tick(state, { autoSkills: false });
    expect(state.player.es).toBeCloseTo(burst, 8);
  });

  it('keeps natural recharge for characters without Escape Artist', () => {
    const state = liveFight();
    state.player.esIdleSec = E.energy_shield.delay_sec;
    const c = characterSheet(state);
    tick(state, { autoSkills: false });
    expect(state.player.es).toBeCloseTo(c.esRegen, 8);
  });

  it('Parasitic Affliction removes hit leech, including target Mark, from damage and provenance', () => {
    const state = liveFight(['parasitic-affliction']);
    const c = { ...characterSheet(state), leechPct: 17, accuracy: 1e9, critChance: 0 };
    const curse = { ...NO_CURSE, leechPct: 5 };
    const hit = playerSwing(() => 0.99, c, state.group[0], null, curse, 0);
    expect(hit.landed).toBe(true);
    expect(hit.leech || 0).toBe(0);
    expect(hit.packet!.flags.canLeech).toBe(false);
    const control = playerSwing(() => 0.99, { ...c, keystones: [] }, state.group[0], null, curse, 0);
    expect(control.leech).toBeCloseTo(control.damage * 0.22, 8);
  });

  it.each([false, true])('Parasitic Affliction transfers buff and Mark leech onto DoT (Dark Siphon: %s)', (dark) => {
    const state = liveFight(['parasitic-affliction', ...(dark ? ['dark-siphon'] : [])]);
    state.skills.owned['buff.berserker'] = 0;
    state.skills.buffs['buff.berserker'] = true;
    state.skills.buffUp['buff.berserker'] = 10;
    state.player.hp = 20;
    const control = structuredClone(state);
    const targetId = state.group[0].id;
    placeStatus(state.mobStatus, targetId, 'mark', characterSheet(state), 0);
    placeKeystoneDoT(state.mobStatus, targetId, 'poison', 10, 4, 100, []);
    const c = characterSheet(state);
    expect(c.leechPct).toBe(17);
    tick(state, { autoSkills: false });
    tick(control, { autoSkills: false });
    const expected = 10 * (c.leechPct / 100 + E.status.mark.k_leech);
    expect(state.player[dark ? 'es' : 'hp'] - control.player[dark ? 'es' : 'hp']).toBeCloseTo(expected, 8);
  });

  it('continues queued payments identically online, offline and after reload', () => {
    const state = liveFight(['delayed-demolition', 'staggering-resolve', 'escape-artist']);
    state.keystoneRuntime.queues.hpDebt.push({ dueAtUs: 10.5 * units, amount: 5, sourceId: 'source', targetId: 'player' });
    state.keystoneRuntime.queues.deferred.push({ dueAtUs: 11.5 * units, amount: 7, sourceId: 'player', targetId: state.group[0].id });
    const offline = structuredClone(state);
    const loaded = importJson(exportJson(state));
    for (let i = 0; i < 3; i++) tick(state, { autoSkills: false });
    catchUp(offline, 3, { autoSkills: false });
    for (let i = 0; i < 3; i++) tick(loaded, { autoSkills: false });
    for (const other of [offline, loaded]) {
      expect(other.player.hp).toBe(state.player.hp);
      expect(other.player.es).toBe(state.player.es);
      expect(other.group[0].hp).toBe(state.group[0].hp);
      expect(other.keystoneRuntime.queues).toEqual(state.keystoneRuntime.queues);
    }
  });

  it('leeches only the HP a DoT actually removes on an overkill', () => {
    const state = liveFight(['parasitic-affliction']);
    state.player.hp = 20;
    state.group[0].hp = 5;
    const c = characterSheet(state);
    placeKeystoneDoT(state.mobStatus, state.group[0].id, 'poison', 10, 4, 100, []);
    tick(state, { autoSkills: false });
    expect(state.player.hp - 20 - c.hpRegen).toBeCloseTo(5 * c.leechPct / 100, 8);
    expect(state.counters.kills).toBe(1);
  });

  it('banks DoT leech at full HP through Endless Hunger and spends it on later missing HP', () => {
    const state = liveFight(['parasitic-affliction', 'endless-hunger']);
    const c = characterSheet(state);
    placeKeystoneDoT(state.mobStatus, state.group[0].id, 'poison', 100, 1, 100, []);
    tick(state, { autoSkills: false });
    expect(state.keystoneRuntime.bank).toMatchObject([{ pool: 'hp', amount: 100 * c.leechPct / 100 }]);
    const banked = state.keystoneRuntime.bank[0].amount;
    state.player.hp = 20;
    tick(state, { autoSkills: false });
    expect(state.player.hp - 20 - c.hpRegen).toBeCloseTo(banked, 8);
    expect(state.keystoneRuntime.bank).toEqual([]);
  });
});
