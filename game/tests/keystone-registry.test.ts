import { describe, expect, it } from 'vitest';
// Packet E's registration runs in the sim entry; a registry cage binds it here against the canonical data.
import engineJson from '../../tools/data/engine.json' with { type: 'json' };
import { registerStaticKeystoneHandlers } from '../src/sim/keystone-runtime';
registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys((engineJson as any).elements.status_of));
import {
  KEYSTONE_HOOKS,
  KEYSTONE_KEYS,
  auraEffectScale,
  auraResonance,
  assertKeystoneSupported,
  crushingRhythm,
  elementalInfusionExtras,
  isKeystoneSupported,
  keystoneDef,
  maledictionValue,
  missingHooksFor,
  newKeystoneRuntimeState,
  redlineDamageMult,
  requiredHooksFor,
  validateKeystoneParams,
  validateKeystoneRuntime,
} from '../../engine/keystones.ts';
import {
  KEYSTONE_HANDLERS,
  assertKeystonePurchasable,
  registerKeystoneHandler,
  supportedKeystoneKeys,
} from '../src/sim/keystone-runtime.ts';

/**
 * Packet D1 — the bundle registry of `docs/passive-tree-keystones-draft.md` §6: the 52 keys, their
 * params, their required hooks, the capability gate that refuses a key without real handlers, and
 * the pure formulas the tables lock. The registry is gated as DATA here; no keystone effect runs.
 */

/** The §6 table verbatim — every row must validate against its own schema. */
const TABLE: [string, Record<string, unknown>, readonly string[]][] = [
  ['ironwall', { evasionToArmour: 1 }, ['sheet']],
  ['unstoppable', { penaltyDamageMult: 0.75 }, ['outgoing', 'timing']],
  ['berserk', { damageMult: 1.4, aspdMult: 1.25, takenMult: 1.15 }, ['outgoing', 'incoming', 'timing']],
  ['redline', { hitStacks: 1, maxStacks: 10, damagePctPerStack: 3, hpCostPctPerStackPerSec: 0.5, idleResetSec: 3 }, ['outgoing', 'timing']],
  ['emberheart', { element: 'fire', conversionPct: 100 }, ['outgoing']],
  ['one-flame', { sharedFirePct: 50, ownColdLightningEffectPct: 50 }, ['sheet']],
  ['endless-hunger', { bankCapPct: 20, expirySec: 10 }, ['recovery', 'timing']],
  ['headsman', { normalThresholdPct: 15, bossUniqueThresholdPct: 5 }, ['outgoing', 'kill']],
  ['crimson-pact', { directPhysicalPct: 50, bleedTotalPct: 100, durationSec: 4 }, ['outgoing', 'status']],
  ['painforged', { bankCapHpPct: 20, nextHitBonusPct: 100 }, ['incoming', 'outgoing']],
  ['fortress-under-siege', { maxStacks: 5, reductionPctPerStack: 5, resetSec: 4 }, ['incoming', 'timing']],
  ['worthy-foe', { hits: 3, dealtMult: 1.3, takenMult: 0.8 }, ['outgoing', 'incoming', 'timing']],
  ['unerring-eye', {}, ['outgoing']],
  ['barkskin', { regenEverySec: 2, maxCharges: 5, hitTakenMult: 0.6 }, ['incoming', 'timing']],
  ['master-surgeon', { healMult: 1.5, durationSec: 4 }, ['recovery', 'timing']],
  ['ambush', { otherCritMult: 0.5 }, ['outgoing']],
  ['toxic-execution', { durationSec: 4 }, ['outgoing', 'status']],
  ['delayed-demolition', { deferredPct: 40, deferredMult: 1.5, delaySec: 2 }, ['outgoing', 'timing']],
  ['demolition-sequence', { hits: 5, damagePct: 20, extraTargets: 1, element: 'fire' }, ['outgoing']],
  ['ghost-dance', { recoveryEvasionPct: 3, maxEsPerProcPct: 10, icdSec: 1 }, ['incoming', 'recovery', 'timing']],
  ['escape-artist', { idleSec: 3, burstEverySec: 3, esBurstPct: 50 }, ['recovery', 'timing']],
  ['profane-bloom', { victimMaxHpPct: 15, element: 'chaos' }, ['kill']],
  ['malediction', { curseLimit: 1, effectMult: 1.75 }, ['status']],
  ['elemental-equilibrium', { durationSec: 4, ownResPlus: 10, otherResMinus: 20 }, ['outgoing', 'status']],
  ['inevitable-judgement', { nonCritElemMult: 0.8 }, ['outgoing']],
  ['instruments-of-virtue', { alternateMult: 1.35 }, ['outgoing']],
  ['mind-over-matter', { manaSharePct: 30 }, ['incoming']],
  ['arcane-battery', { reserveManaPct: 40, esPerMana: 2 }, ['sheet', 'reservation']],
  ['radiant-faith', { reserveHpPct: 25, flatCutReservedPct: 10, maxHitCutPct: 30 }, ['reservation', 'incoming']],
  ['time-of-need', { periodSec: 5, healMaxHpPct: 15 }, ['recovery', 'status', 'timing']],
  ['blood-price', { hpPerMana: 1 }, ['cost']],
  ['borrowed-time', { recoupPct: 40, durationSec: 6 }, ['incoming', 'recovery', 'timing']],
  ['crushing-rhythm', { maxBasicHitsPerSec: 1 }, ['outgoing', 'timing']],
  ['armourbreaker', { armourBreakPct: 5, maxBreakPct: 60, resetSec: 4 }, ['outgoing', 'status']],
  ['turtle-doctrine', {}, ['incoming']],
  ['dark-siphon', {}, ['recovery']],
  ['disrupting-blows', { hitMaxHpThresholdPct: 5, stopSec: 0.5 }, ['outgoing', 'status']],
  ['elemental-aegis', { elementHitTakenMult: 0.7 }, ['incoming']],
  ['enduring-core', { hpThresholdPct: 30, belowTakenMult: 0.5 }, ['sheet', 'incoming']],
  ['mana-debt', { debtLimitUsableManaPct: 50, negativeRegenMult: 2 }, ['cost', 'recovery']],
  ['thornbound', { armourDamagePct: 20, icdSec: 0.5, ownDirectDamageMult: 0.5 }, ['incoming', 'outgoing', 'timing']],
  ['blood-covenant', {}, ['reservation']],
  ['chaos-inoculation', { maxHp: 1 }, ['sheet', 'incoming', 'cost', 'reservation']],
  ['staggering-resolve', { deferredPct: 40, durationSec: 5 }, ['incoming', 'timing']],
  ['shield-gate', { rearmCdSec: 8 }, ['incoming', 'recovery', 'timing']],
  ['capacitive-casting', { spentManaEsPct: 20, naturalEsRegenMult: 0.5 }, ['cost', 'recovery']],
  ['auto-cleanse', { icdSec: 6 }, ['status', 'timing']],
  ['plague-courier', { icdSec: 4 }, ['outgoing', 'status', 'timing']],
  ['parasitic-affliction', { baseLeechPct: 2 }, ['recovery']],
  ['aura-resonance', { reservationPctPerAura: 5, reservationCapPct: 30, effectPctPerAura: 5, effectCapPct: 30 }, ['sheet', 'reservation']],
  ['elemental-infusion', { extraTotalPct: 30 }, ['outgoing']],
  ['elemental-conduit', {}, ['outgoing', 'status']],
];

const ELEMENTS = ['fire', 'cold', 'lightning', 'poison', 'chaos', 'earth'];

describe('the 52 bundle keys of §6', () => {
  it('lists exactly the catalogue', () => {
    expect(KEYSTONE_KEYS.length).toBe(52);
    expect([...KEYSTONE_KEYS].sort()).toEqual(TABLE.map(([k]) => k).sort());
  });

  it('validates every table row against its own schema and hook line', () => {
    for (const [key, params, hooks] of TABLE) {
      expect(() => validateKeystoneParams(key, params, ELEMENTS)).not.toThrow();
      expect(requiredHooksFor(key)).toEqual(hooks);
    }
  });

  it('keeps the hook vocabulary closed', () => {
    for (const key of KEYSTONE_KEYS)
      for (const hook of requiredHooksFor(key)) expect(KEYSTONE_HOOKS).toContain(hook);
  });
});

describe('the parameter schema', () => {
  it('refuses a missing param, naming key and param', () => {
    expect(() => validateKeystoneParams('emberheart', { element: 'fire' }, ELEMENTS))
      .toThrow(/emberheart.*conversionPct/s);
  });

  it('refuses an unknown param, naming key and param', () => {
    expect(() => validateKeystoneParams('berserk', { damageMult: 1.4, aspdMult: 1.25, takenMult: 1.15, extra: 2 }, ELEMENTS))
      .toThrow(/berserk.*"extra"/s);
  });

  it('refuses a nonfinite value', () => {
    expect(() => validateKeystoneParams('berserk', { damageMult: Number.NaN, aspdMult: 1.25, takenMult: 1.15 }, ELEMENTS))
      .toThrow(/berserk.*damageMult/s);
  });

  it('keeps percentages inside 0..100', () => {
    expect(() => validateKeystoneParams('mind-over-matter', { manaSharePct: 130 })).toThrow(/outside its pct band/);
  });

  it('refuses a zero where zero has no meaning — the conversion rate of 05', () => {
    expect(() => validateKeystoneParams('emberheart', { element: 'fire', conversionPct: 0 }, ELEMENTS))
      .toThrow(/conversionPct/);
  });

  it('demands whole positive counts and strictly positive durations', () => {
    expect(() => validateKeystoneParams('redline', { hitStacks: 1, maxStacks: 2.5, damagePctPerStack: 3, hpCostPctPerStackPerSec: 0.5, idleResetSec: 3 })).toThrow(/maxStacks/);
    expect(() => validateKeystoneParams('crimson-pact', { directPhysicalPct: 50, bleedTotalPct: 100, durationSec: 0 }, ELEMENTS)).toThrow(/durationSec/);
  });

  it('demands a canonical element and rejects an invented one', () => {
    expect(() => validateKeystoneParams('profane-bloom', { victimMaxHpPct: 15, element: 'aether' }, ELEMENTS))
      .toThrow(/element/);
  });

  it('reads an empty Params as a boolean contract that takes nothing', () => {
    expect(validateKeystoneParams('unerring-eye', {})).toEqual({});
    expect(() => validateKeystoneParams('unerring-eye', { anything: 1 })).toThrow(/unerring-eye.*anything/s);
  });

  it('refuses an unknown bundle key by name', () => {
    expect(() => keystoneDef('not-a-keystone')).toThrow(/not-a-keystone/);
  });
});

describe('the capability gate — real handlers only', () => {
  const fn = () => 0;

  it('binds every catalogue key to real handlers, so nothing on the tree is a no-op', () => {
    const opened = supportedKeystoneKeys(KEYSTONE_HANDLERS);
    expect(opened.sort()).toEqual([...KEYSTONE_KEYS].sort());
    for (const key of KEYSTONE_KEYS.filter((k) => !opened.includes(k))) {
      expect(isKeystoneSupported(key, undefined)).toBe(false);
      expect(() => assertKeystonePurchasable(KEYSTONE_HANDLERS, key)).toThrow(new RegExp(`keystone "${key}".*missing`));
    }
  });

  it('opens a key only when every required hook is a real function', () => {
    const table = {};
    registerKeystoneHandler(table, 'redline', { outgoing: fn, timing: fn }, TABLE[3][1] as Record<string, unknown>);
    expect(supportedKeystoneKeys(table)).toEqual(['redline']);
    expect(() => assertKeystonePurchasable(table, 'redline')).not.toThrow();
  });

  it('refuses a handler missing one required hook — by key AND hook name', () => {
    const table = {};
    expect(() => registerKeystoneHandler(table, 'redline', { outgoing: fn }, TABLE[3][1] as Record<string, unknown>))
      .toThrow(/redline.*"timing"/s);
    expect(table).toEqual({});
  });

  it('refuses a declared hook that is not a function, not just absent', () => {
    const table = {};
    expect(() => registerKeystoneHandler(table, 'thornbound', { incoming: fn, outgoing: fn, timing: 42 }, TABLE[40][1] as Record<string, unknown>))
      .toThrow(/thornbound.*timing/s);
  });

  it('refuses a handler carrying bad params before registering', () => {
    const table = {};
    expect(() => registerKeystoneHandler(table, 'redline', { outgoing: fn, timing: fn }, { hitStacks: 1 }))
      .toThrow(/redline.*missing param "maxStacks"/s);
    expect(table).toEqual({});
  });

  it('the negative fixture of §6: removing one required function makes the gate red again', () => {
    const hooks: Record<string, unknown> = { outgoing: fn, timing: fn };
    expect(isKeystoneSupported('redline', hooks)).toBe(true);
    delete hooks.timing;
    expect(missingHooksFor('redline', hooks)).toEqual(['timing']);
    expect(() => assertKeystoneSupported('redline', hooks)).toThrow(/redline.*"timing"/s);
  });
});

describe('the pure formulas the §6/§7 tables lock', () => {
  it('04 Redline: 1 + 3% × stacks, never 1.03^stacks (fixture: 10 stacks, 100 → 130)', () => {
    expect(redlineDamageMult({ maxStacks: 10, damagePctPerStack: 3 }, 10)).toBeCloseTo(1.30, 10);
    expect(redlineDamageMult({ maxStacks: 10, damagePctPerStack: 3 }, 13)).toBeCloseTo(1.30, 10);
  });

  it('42 Crushing Rhythm: 4/s lands as 1/s at ×4 damage; a slower weapon is untouched', () => {
    expect(crushingRhythm(4, { maxBasicHitsPerSec: 1 })).toEqual({ actualRate: 1, damageMult: 4 });
    expect(crushingRhythm(0.6, { maxBasicHitsPerSec: 1 })).toEqual({ actualRate: 0.6, damageMult: 1 });
  });

  it('64 Aura Resonance: b caps at 30%; N=6 turns a 40% reservation into 28%; N=1 gives +5%', () => {
    const p = { reservationPctPerAura: 5, reservationCapPct: 30, effectPctPerAura: 5, effectCapPct: 30 };
    expect(auraResonance(6, p)).toEqual({ b: 0.30, reservationMult: 0.70, effectMult: 1.30 });
    expect(40 * auraResonance(6, p).reservationMult).toBeCloseTo(28, 10);
    expect(auraEffectScale(1, p)).toBeCloseTo(1.05, 10);
    expect(auraEffectScale(10, p)).toBeCloseTo(1.30, 10);
  });

  it('65 Elemental Infusion: P=100 with Flat fire 10 / cold 20 gives extra 10 + 20, not 30 each', () => {
    const out = elementalInfusionExtras(100, { fire: 10, cold: 20 }, { extraTotalPct: 30 }, ELEMENTS);
    expect(out.fire).toBeCloseTo(10, 10);
    expect(out.cold).toBeCloseTo(20, 10);
    expect(elementalInfusionExtras(100, {}, { extraTotalPct: 30 }, ELEMENTS)).toEqual({});
  });

  it('28 Malediction: an add of 20 becomes 35, a mult of 0.8 becomes 0.65', () => {
    expect(maledictionValue('add', 20, { effectMult: 1.75 })).toBeCloseTo(35, 10);
    expect(maledictionValue('mult', 0.8, { effectMult: 1.75 })).toBeCloseTo(0.65, 10);
  });
});

describe('the keystone runtime schema (§7.7)', () => {
  it('starts empty and round-trips a filled fixture exactly', () => {
    const empty = newKeystoneRuntimeState();
    expect(validateKeystoneRuntime(empty)).toEqual(empty);
    const filled = newKeystoneRuntimeState();
    filled.lastHitAtUs = 1_500_000;
    filled.stacks.rage = 4;
    filled.counters['worthy-foe:target-1'] = 2;
    filled.flags['shield-gate:armed'] = true;
    filled.icdsUs['auto-cleanse'] = 6_000_000;
    filled.bank.push({ pool: 'es', amount: 120, expiresAtUs: 10_000_000 });
    filled.queues.deferred.push({ dueAtUs: 2_000_000, amount: 60, sourceId: 'player', targetId: 'mob-9' });
    filled.dotInstances.push({
      family: 'burn', lane: 'extra', dps: 10, budgetDps: 10,
      appliedAtUs: 1_000_000, nextPayAtUs: 2_000_000, expiresAtUs: 6_000_000,
      decayGroupId: null, sourceId: 'keystone.elemental-conduit',
    });
    expect(validateKeystoneRuntime(JSON.parse(JSON.stringify(filled)))).toEqual(filled);
  });

  it('refuses an unknown runtime field, a bad queue entry and a non-integer time by name', () => {
    expect(() => validateKeystoneRuntime({ ...newKeystoneRuntimeState(), surprise: 1 }))
      .toThrow(/keystoneRuntime.surprise/);
    const bad = newKeystoneRuntimeState();
    bad.queues.hpDebt.push({ dueAtUs: 1.5, amount: 10, sourceId: null, targetId: null });
    expect(() => validateKeystoneRuntime(bad)).toThrow(/queues\.hpDebt\[0\]\.dueAtUs/);
    const badInstance = newKeystoneRuntimeState();
    badInstance.dotInstances.push({
      family: 'burn', lane: 'wild' as never, dps: 1, budgetDps: 1, appliedAtUs: null,
      nextPayAtUs: 1, expiresAtUs: null, decayGroupId: null, sourceId: null,
    });
    expect(() => validateKeystoneRuntime(badInstance)).toThrow(/lane/);
    expect(() => validateKeystoneRuntime(undefined)).toThrow(/keystoneRuntime/);
  });
});
