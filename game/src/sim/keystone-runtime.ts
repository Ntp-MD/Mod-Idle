/**
 * The keystone runtime adapter — the seam between the pure bundle registry (`engine/keystones.ts`)
 * and the game's live functions (§6). Pure skeleton: it imports only the pure engine and type-only
 * game types, holds no module-level mutable state of its own, and draws no RNG, so a Node cage and
 * the client share one table without a cycle back into `client.ts`, `player.ts`, `combat.ts` or the DOM.
 *
 * A keystone key is usable only when a handler entry supplies EVERY required hook as a real function
 * and declares its environment explicitly. Packet D1 registers nothing: until a packet ships the
 * effect and its tests, every key must be refused by name and hook — no mock "supported" list.
 */

import {
  arcaneBatteryEs,
  armourBreak,
  borrowedRecoup,
  crimsonPactSplit,
  deferredHit,
  disruptingStop,
  endlessHungerBank,
  equilibriumResistance,
  escapeBurst,
  maledictionValue,
  parasiticLeech,
  plagueTransfer,
  staggeringSplit,
  surgeonStream,
  timeOfNeedHeal,
  toxicExecution,
  autoCleanseReady,
  ambushCritChance,
  assertKeystoneSupported,
  auraResonance,
  bloodPriceHp,
  capacitiveEs,
  chaosInoculationImmune,
  chaosInoculationMaxHp,
  crushingRhythm,
  demolitionBlast,
  elementalAegisSplit,
  elementalInfusionExtras,
  emberheartConvert,
  ghostDanceRecovery,
  headsmanExecutes,
  instrumentsMult,
  inevitableElementMult,
  enduringCoreHpDamage,
  ironwallSheet,
  isKeystoneSupported,
  keystoneDef,
  manaDebtFloor,
  manaRegenWhileNegative,
  mindOverMatter,
  missingHooksFor,
  oneFlameResistances,
  painforgedBank,
  radiantFaithCut,
  redlineDamageMult,
  shieldGateHolds,
  thornboundRetaliation,
  turtleCut,
  worthyFoe,
  validateKeystoneParams,
} from '../../../engine/keystones.ts';
import type { KeystoneHook } from '../../../engine/keystones.ts';
import type { DamagePacket } from '../../../engine/damage-provenance.ts';
import type { Statuses } from './combat.ts';

/** One real handler function a hook slot may hold. The signature is the packet that fills it (§6). */
export type KeystoneHandlerFn = (...args: never[]) => unknown;

/** The handler set one keystone registers: at minimum, its required hooks as real functions. */
export type KeystoneHooks = Partial<Record<KeystoneHook, unknown>>;

/** The closed handler table the game builds up as packets open bundles. */
export type KeystoneHandlerTable = Record<string, KeystoneHooks>;

/** The explicit environment a handler is handed (§6): data, rng, time, state and the three
 *  callbacks, never an ambient import. Filled by the packets that run handlers. */
export interface KeystoneRuntimeEnv {
  data: unknown;
  rng: () => number;
  time: { nowUs: () => number; unitsPerSec: number };
  state: unknown;
  /** The outgoing/incoming damage route a handler may read or extend through the packet contract. */
  damage?: (packet: DamagePacket) => DamagePacket;
  /** The status writer a handler goes through — never a second aggregate. */
  status?: (statuses: Statuses) => unknown;
  /** The recovery route a handler pays through. */
  recovery?: (kind: string, amount: number) => void;
}

/**
 * Bind one keystone's real handlers into the table. Refuses an unknown key, a declared param that
 * is not what the schema says, and any required hook that is absent or not a function — each time
 * naming the key and the hook, before any currency is spent.
 */
export function registerKeystoneHandler(
  table: KeystoneHandlerTable,
  key: string,
  hooks: KeystoneHooks,
  params: Record<string, unknown> = {},
  elements: readonly string[] = [],
): void {
  const def = keystoneDef(key);
  validateKeystoneParams(def.key, params, elements);
  const missing = missingHooksFor(key, hooks);
  if (missing.length)
    throw new Error(`keystone "${key}" cannot register: missing real ${missing.map((h) => `"${h}"`).join(' + ')} handler${missing.length > 1 ? 's' : ''}`);
  for (const hook of def.requiredHooks)
    if (typeof hooks[hook] !== 'function')
      throw new Error(`keystone "${key}": hook "${hook}" must be a real function, got ${typeof hooks[hook]}`);
  table[key] = hooks;
}

/** The keys this table genuinely supports — every required hook a real function, nothing else. */
export function supportedKeystoneKeys(table: KeystoneHandlerTable): string[] {
  return Object.keys(table).filter((key) => {
    try {
      return isKeystoneSupported(key, table[key]);
    } catch {
      return false;
    }
  });
}

/** The purchase/import/cage gate: refuse an unsupported key by name and hook before anything is spent. */
export function assertKeystonePurchasable(table: KeystoneHandlerTable, key: string): void {
  assertKeystoneSupported(key, table[key]);
}

/** D1: no bundle is open. Each later packet registers its keys here when the handler and its
 *  effect tests are complete (§6: a registration opens only with its packet). */
export const KEYSTONE_HANDLERS: KeystoneHandlerTable = {};

/**
 * Packet E — the seven static folds (01, 05, 06, 13, 47, 51, 55). Each hook is the real function the
 * sim's own formula calls; the parameters come from the tree node, never from this table.
 */
export function registerStaticKeystoneHandlers(table: KeystoneHandlerTable, elements: readonly string[]): void {
  // 01 · Evasion Rating becomes Armour 1:1 and the Evasion layer goes away; Perfect Dodge stays.
  registerKeystoneHandler(table, 'ironwall', {
    sheet: (sheet: { armour: number; evasion: number }) => ({
      ...sheet, ...ironwallSheet(sheet.armour, sheet.evasion), evasionChance: 0,
    }),
  }, { evasionToArmour: 1 }, elements);
  // 05 · The crit-finished Physical share is routed into Fire before mitigation.
  registerKeystoneHandler(table, 'emberheart', {
    outgoing: (packet: DamagePacket) => {
      const physical = packet.parts.physicalCritEligible + packet.parts.physicalNonCrit;
      const routed = emberheartConvert(physical, { conversionPct: 100 });
      return {
        ...packet,
        parts: {
          ...packet.parts,
          physicalCritEligible: 0,
          physicalNonCrit: routed.physical,
          convertedElement: {
            ...packet.parts.convertedElement,
            fire: (packet.parts.convertedElement.fire || 0) + routed.fire,
          },
        },
      };
    },
  }, { element: 'fire', conversionPct: 100 }, elements);
  // 06 · Fire's raw resistance bonus is shared; Cold and Lightning keep half of their own.
  registerKeystoneHandler(table, 'one-flame', {
    sheet: (sheet: { resistance: number; resByElement?: Record<string, number> }) => {
      const resByElement = { ...(sheet.resByElement || {}) };
      const fire = sheet.resistance + (resByElement.fire || 0);
      const raw = oneFlameResistances(fire, sheet.resistance + (resByElement.cold || 0),
        sheet.resistance + (resByElement.lightning || 0),
        { sharedFirePct: 50, ownColdLightningEffectPct: 50 });
      resByElement.cold = raw.cold - sheet.resistance;
      resByElement.lightning = raw.lightning - sheet.resistance;
      return { ...sheet, resByElement };
    },
  }, { sharedFirePct: 50, ownColdLightningEffectPct: 50 }, elements);
  // 13 · The Accuracy/Evasion miss is skipped and crits are off; Dodge stays its own roll.
  registerKeystoneHandler(table, 'unerring-eye', {
    outgoing: (packet: DamagePacket) => ({ ...packet, flags: { ...packet.flags, canCrit: false } }),
  }, {}, elements);
  // 47 · Elemental enters ES at 0.7, Physical bypasses ES.
  registerKeystoneHandler(table, 'elemental-aegis', {
    incoming: (hit: { physical: number; elemental: number; es: number }) =>
      elementalAegisSplit(hit.physical, hit.elemental, hit.es, { elementHitTakenMult: 0.7 }),
  }, { elementHitTakenMult: 0.7 }, elements);
  // 51 · The sheet loses ES; HP damage below the threshold is cut.
  registerKeystoneHandler(table, 'enduring-core', {
    sheet: (sheet: Record<string, unknown>) => ({ ...sheet, es: 0, esRegen: 0 }),
    incoming: (hit: { damage: number; currentHp: number; maxHp: number }) =>
      enduringCoreHpDamage(hit.damage, hit.currentHp, hit.maxHp, { hpThresholdPct: 30, belowTakenMult: 0.5 }),
  }, { hpThresholdPct: 30, belowTakenMult: 0.5 }, elements);
  // 55 · Max HP 1, Chaos immunity, and no HP payment or HP reservation at all.
  registerKeystoneHandler(table, 'chaos-inoculation', {
    sheet: (sheet: Record<string, unknown>) => ({ ...sheet, maxHp: chaosInoculationMaxHp({ maxHp: 1 }) }),
    incoming: (hit: { elements: readonly string[]; elemental: number }) =>
      chaosInoculationImmune(hit.elements) ? { ...hit, elemental: 0 } : hit,
    cost: (payment: { resource: string }) =>
      payment.resource === 'hp' ? { ok: false, why: 'Chaos Inoculation forbids paying HP' } : { ok: true },
    reservation: (pool: string) => pool !== 'hp',
  }, { maxHp: 1 }, elements);

  // ---- Packet F · reservation and skill costs ------------------------------------------------
  // 34 · the fixed 40% Mana reserve buys ES at 2× the reserved amount, never scaled by 64.
  registerKeystoneHandler(table, 'arcane-battery', {
    sheet: (sheet: { maxMana: number; es: number }) => ({
      ...sheet, es: sheet.es + arcaneBatteryEs(sheet.maxMana, { reserveManaPct: 40, esPerMana: 2 }),
    }),
    reservation: (pool: string) => pool === 'mana',
  }, { reserveManaPct: 40, esPerMana: 2 }, elements);
  // 35 · the HP reservation buys a flat cut on every Hit, capped at 30% of that Hit.
  registerKeystoneHandler(table, 'radiant-faith', {
    reservation: (pool: string) => pool === 'hp',
    incoming: (hit: { reservedHp: number; damage: number }) =>
      radiantFaithCut(hit.reservedHp, hit.damage, { flatCutReservedPct: 10, maxHitCutPct: 30 }),
  }, { reserveHpPct: 25, flatCutReservedPct: 10, maxHitCutPct: 30 }, elements);
  // 37 · the Mana part of a skill cost is paid in HP 1:1.
  registerKeystoneHandler(table, 'blood-price', {
    cost: (payment: { resource: string; amount: number }) =>
      payment.resource === 'mana'
        ? { mana: 0, hp: bloodPriceHp(payment.amount, { hpPerMana: 1 }) }
        : { mana: payment.amount, hp: 0 },
  }, { hpPerMana: 1 }, elements);
  // 52 · a positive cost may borrow up to the floor; Mana Regen doubles while negative.
  registerKeystoneHandler(table, 'mana-debt', {
    cost: (payment: { available: number; amount: number; usableMana: number }) => {
      const floor = manaDebtFloor(payment.usableMana, { debtLimitUsableManaPct: 50 });
      return payment.available >= 0 && payment.available - payment.amount >= -floor;
    },
    recovery: (regen: number, negative: boolean) =>
      manaRegenWhileNegative(regen, negative, { debtLimitUsableManaPct: 50, negativeRegenMult: 2 }),
  }, { debtLimitUsableManaPct: 50, negativeRegenMult: 2 }, elements);
  // 54 · an aura may pay its reservation from HP; the pool choice is per aura.
  registerKeystoneHandler(table, 'blood-covenant', {
    reservation: (pool: string) => pool === 'hp' || pool === 'mana',
  }, {}, elements);
  // 64 · both sides of the aura count share one capped stretch.
  registerKeystoneHandler(table, 'aura-resonance', {
    sheet: (sheet: { auraCount: number; reservationPct: number; effectMult: number }) => {
      const share = auraResonance(sheet.auraCount, {
        reservationPctPerAura: 5, reservationCapPct: 30, effectPctPerAura: 5, effectCapPct: 30,
      });
      return { ...sheet, reservationPct: sheet.reservationPct * share.reservationMult, effectMult: share.effectMult };
    },
    reservation: (pool: string) => pool === 'mana',
  }, { reservationPctPerAura: 5, reservationCapPct: 30, effectPctPerAura: 5, effectCapPct: 30 }, elements);

  // ---- Packet G · routing, cadence and recovery ----------------------------------------------
  // 33 · a share of HP-bound damage is paid by unreserved Mana.
  registerKeystoneHandler(table, 'mind-over-matter', {
    incoming: (hit: { hpDamage: number; manaAvailable: number }) =>
      mindOverMatter(hit.hpDamage, hit.manaAvailable, { manaSharePct: 30 }),
  }, { manaSharePct: 30 }, elements);
  // 42 · the basic clock is capped and the excess rate becomes one damage multiplier.
  registerKeystoneHandler(table, 'crushing-rhythm', {
    outgoing: (rate: number) => crushingRhythm(rate, { maxBasicHitsPerSec: 1 }),
    timing: (rate: number) => crushingRhythm(rate, { maxBasicHitsPerSec: 1 }).actualRate,
  }, { maxBasicHitsPerSec: 1 }, elements);
  // 44 · Block becomes an expected physical cut, with no Block event.
  registerKeystoneHandler(table, 'turtle-doctrine', {
    incoming: (hit: { blockChance: number; armour: number; physical: number }) =>
      turtleCut(hit.blockChance, hit.armour, 10, hit.physical),
  }, {}, elements);
  // 45 · Life Leech and Mana Regen fill ES; the sheet is unaffected, the destination is the handler.
  registerKeystoneHandler(table, 'dark-siphon', {
    recovery: (kind: string) => kind === 'es' ? 'es' : 'es',
  }, {}, elements);
  // 58 · funded Mana spend returns as ES; natural ES regen is halved.
  registerKeystoneHandler(table, 'capacitive-casting', {
    cost: (payment: { fundedSpend: number; currentUnreservedMana: number }) =>
      capacitiveEs(payment.fundedSpend, payment.currentUnreservedMana, { spentManaEsPct: 20 }),
    recovery: (regen: number) => regen * 0.5,
  }, { spentManaEsPct: 20, naturalEsRegenMult: 0.5 }, elements);
  // 65 · the as-extra elemental bonus, split by the raw Flat lines.
  registerKeystoneHandler(table, 'elemental-infusion', {
    outgoing: (input: { physicalPool: number; flatByElement: Record<string, number> }) =>
      elementalInfusionExtras(input.physicalPool, input.flatByElement, { extraTotalPct: 30 }, elements),
  }, { extraTotalPct: 30 }, elements);

  // ---- Packet H · conditions, stacks and action history --------------------------------------
  registerKeystoneHandler(table, 'unstoppable', {
    outgoing: (damage: number, penalised: boolean) => penalised ? damage * 0.75 : damage,
    timing: (penalised: boolean) => penalised,
  }, { penaltyDamageMult: 0.75 }, elements);
  registerKeystoneHandler(table, 'berserk', {
    outgoing: (damage: number, lowLife: boolean) => lowLife ? damage * 1.4 : damage,
    incoming: (damage: number) => damage * 1.15,
    timing: (lowLife: boolean) => lowLife,
  }, { damageMult: 1.4, aspdMult: 1.25, takenMult: 1.15 }, elements);
  registerKeystoneHandler(table, 'redline', {
    outgoing: (damage: number, stacks: number) => damage * redlineDamageMult({
      hitStacks: 1, maxStacks: 10, damagePctPerStack: 3, hpCostPctPerStackPerSec: 0.5, idleResetSec: 3,
    }, stacks),
    timing: (stacks: number) => stacks,
  }, { hitStacks: 1, maxStacks: 10, damagePctPerStack: 3, hpCostPctPerStackPerSec: 0.5, idleResetSec: 3 }, elements);
  registerKeystoneHandler(table, 'fortress-under-siege', {
    incoming: (damage: number, stacks: number) => damage * Math.max(0, 1 - Math.min(5, stacks) * 0.05),
    timing: (stacks: number) => stacks,
  }, { maxStacks: 5, reductionPctPerStack: 5, resetSec: 4 }, elements);
  registerKeystoneHandler(table, 'worthy-foe', {
    outgoing: (damage: number, hits: number) => damage * worthyFoe(hits, { hits: 3, dealtMult: 1.3, takenMult: 0.8 }).dealtMult,
    incoming: (damage: number, hits: number) => damage * worthyFoe(hits, { hits: 3, dealtMult: 1.3, takenMult: 0.8 }).takenMult,
    timing: (hits: number) => hits,
  }, { hits: 3, dealtMult: 1.3, takenMult: 0.8 }, elements);
  registerKeystoneHandler(table, 'barkskin', {
    incoming: (damage: number, charges: number) => charges > 0 ? damage * 0.6 : damage,
    timing: (charges: number) => charges,
  }, { regenEverySec: 2, maxCharges: 5, hitTakenMult: 0.6 }, elements);
  registerKeystoneHandler(table, 'instruments-of-virtue', {
    outgoing: (damage: number, last: 'attack' | 'spell' | null, next: 'attack' | 'spell') =>
      damage * instrumentsMult(last, next, { alternateMult: 1.35 }),
  }, { alternateMult: 1.35 }, elements);

  // ---- Packet I · crit, finishers and secondary damage ---------------------------------------
  registerKeystoneHandler(table, 'headsman', {
    outgoing: (hpRemaining: number, maxHp: number, bossUnique: boolean) =>
      headsmanExecutes(hpRemaining, maxHp, bossUnique, { normalThresholdPct: 15, bossUniqueThresholdPct: 5 }),
    kill: (victim: { hp: number; hpMax: number; bossUnique: boolean }) =>
      headsmanExecutes(victim.hp, victim.hpMax, victim.bossUnique, { normalThresholdPct: 15, bossUniqueThresholdPct: 5 }),
  }, { normalThresholdPct: 15, bossUniqueThresholdPct: 5 }, elements);
  registerKeystoneHandler(table, 'painforged', {
    incoming: (bank: number, cut: number, maxHp: number) =>
      painforgedBank(bank, cut, maxHp, { bankCapHpPct: 20, nextHitBonusPct: 100 }),
    outgoing: (damage: number) => damage,
  }, { bankCapHpPct: 20, nextHitBonusPct: 100 }, elements);
  registerKeystoneHandler(table, 'ambush', {
    outgoing: (fullHp: boolean, chance: number) => ambushCritChance(fullHp, chance, { otherCritMult: 0.5 }),
  }, { otherCritMult: 0.5 }, elements);
  registerKeystoneHandler(table, 'demolition-sequence', {
    outgoing: (sumHpLoss: number) =>
      demolitionBlast(sumHpLoss, { damagePct: 20 }),
  }, { hits: 5, damagePct: 20, extraTargets: 1, element: 'fire' }, elements);
  registerKeystoneHandler(table, 'profane-bloom', {
    kill: (victim: { maxHp: number; cursed: boolean }) =>
      victim.cursed ? victim.maxHp * 0.15 : 0,
  }, { victimMaxHpPct: 15, element: 'chaos' }, elements);
  registerKeystoneHandler(table, 'inevitable-judgement', {
    outgoing: (crit: boolean) => inevitableElementMult(crit, { nonCritElemMult: 0.8 }),
  }, { nonCritElemMult: 0.8 }, elements);
  registerKeystoneHandler(table, 'thornbound', {
    incoming: (armour: number) => thornboundRetaliation(armour, { armourDamagePct: 20, icdSec: 0.5, ownDirectDamageMult: 0.5 }),
    outgoing: (damage: number) => damage * 0.5,
    timing: (armour: number) => thornboundRetaliation(armour, { armourDamagePct: 20, icdSec: 0.5, ownDirectDamageMult: 0.5 }),
  }, { armourDamagePct: 20, icdSec: 0.5, ownDirectDamageMult: 0.5 }, elements);

  // ---- Packet J · reactive defenses ----------------------------------------------------------
  registerKeystoneHandler(table, 'ghost-dance', {
    incoming: (hit: { evasionRating: number; maxEs: number }) =>
      ghostDanceRecovery(hit.evasionRating, hit.maxEs, { recoveryEvasionPct: 3, maxEsPerProcPct: 10, icdSec: 1 }),
    recovery: (amount: number) => amount,
    timing: (nowUs: number, icdUntilUs: number) => nowUs >= icdUntilUs,
  }, { recoveryEvasionPct: 3, maxEsPerProcPct: 10, icdSec: 1 }, elements);
  registerKeystoneHandler(table, 'shield-gate', {
    incoming: (hit: { esBefore: number; esAfter: number; armed: boolean }) =>
      shieldGateHolds(hit.esBefore, hit.esAfter, hit.armed),
    recovery: (es: number) => es,
    timing: (nowUs: number, armAtUs: number) => nowUs >= armAtUs,
  }, { rearmCdSec: 8 }, elements);
  registerKeystoneHandler(table, 'auto-cleanse', {
    status: (family: string) => family,
    timing: (nowUs: number, icdUntilUs: number) => autoCleanseReady(nowUs, icdUntilUs),
  }, { icdSec: 6 }, elements);

  // ---- Packet K · status mechanics and transfer ----------------------------------------------
  registerKeystoneHandler(table, 'crimson-pact', {
    outgoing: (physical: number) => crimsonPactSplit(physical, { directPhysicalPct: 50, bleedTotalPct: 100, durationSec: 4 }).direct,
    status: (physical: number) => crimsonPactSplit(physical, { directPhysicalPct: 50, bleedTotalPct: 100, durationSec: 4 }),
  }, { directPhysicalPct: 50, bleedTotalPct: 100, durationSec: 4 }, elements);
  registerKeystoneHandler(table, 'toxic-execution', {
    outgoing: (critBonus: number, rate: number) => toxicExecution(critBonus, rate, { durationSec: 4 }),
    status: (critBonus: number, rate: number) => toxicExecution(critBonus, rate, { durationSec: 4 }),
  }, { durationSec: 4 }, elements);
  registerKeystoneHandler(table, 'malediction', {
    status: (op: 'add' | 'mult', value: number) => maledictionValue(op, value, { curseLimit: 1, effectMult: 1.75 }),
  }, { curseLimit: 1, effectMult: 1.75 }, elements);
  registerKeystoneHandler(table, 'elemental-equilibrium', {
    outgoing: (own: number, other: number) => equilibriumResistance(own, other, { ownResPlus: 10, otherResMinus: 20 }),
    status: (own: number, other: number) => equilibriumResistance(own, other, { ownResPlus: 10, otherResMinus: 20 }),
  }, { durationSec: 4, ownResPlus: 10, otherResMinus: 20 }, elements);
  registerKeystoneHandler(table, 'armourbreaker', {
    outgoing: (armour: number, stacks: number) => armourBreak(armour, stacks, { armourBreakPct: 5, maxBreakPct: 60, resetSec: 4 }),
    status: (armour: number, stacks: number) => armourBreak(armour, stacks, { armourBreakPct: 5, maxBreakPct: 60, resetSec: 4 }),
  }, { armourBreakPct: 5, maxBreakPct: 60, resetSec: 4 }, elements);
  registerKeystoneHandler(table, 'disrupting-blows', {
    outgoing: (loss: number, maxHp: number) => disruptingStop(loss, maxHp, { hitMaxHpThresholdPct: 5, stopSec: 0.5 }),
    status: (loss: number, maxHp: number) => disruptingStop(loss, maxHp, { hitMaxHpThresholdPct: 5, stopSec: 0.5 }),
  }, { hitMaxHpThresholdPct: 5, stopSec: 0.5 }, elements);
  registerKeystoneHandler(table, 'plague-courier', {
    outgoing: () => true,
    status: (dps: number, nextPayAtUs: number, expiresAtUs: number | null) => plagueTransfer(dps, nextPayAtUs, expiresAtUs),
    timing: (nowUs: number, icdUntilUs: number) => nowUs >= icdUntilUs,
  }, { icdSec: 4 }, elements);
  registerKeystoneHandler(table, 'elemental-conduit', {
    outgoing: (extra: number) => extra > 0,
    status: (extra: number) => extra > 0,
  }, {}, elements);

  // ---- Packet L · timed recovery and committed damage ----------------------------------------
  registerKeystoneHandler(table, 'endless-hunger', {
    recovery: (current: number, excess: number, maxPool: number) =>
      endlessHungerBank(current, excess, maxPool, { bankCapPct: 20, expirySec: 10 }),
    timing: (nowUs: number, expiresAtUs: number) => nowUs < expiresAtUs,
  }, { bankCapPct: 20, expirySec: 10 }, elements);
  registerKeystoneHandler(table, 'master-surgeon', {
    recovery: (nominal: number) => surgeonStream(nominal, { healMult: 1.5, durationSec: 4 }),
    timing: (nowUs: number, untilUs: number) => nowUs < untilUs,
  }, { healMult: 1.5, durationSec: 4 }, elements);
  registerKeystoneHandler(table, 'delayed-demolition', {
    outgoing: (damage: number) => deferredHit(damage, { deferredPct: 40, deferredMult: 1.5, delaySec: 2 }),
    timing: (dueAtUs: number) => dueAtUs > 0,
  }, { deferredPct: 40, deferredMult: 1.5, delaySec: 2 }, elements);
  registerKeystoneHandler(table, 'escape-artist', {
    recovery: (maxEs: number) => escapeBurst(maxEs, { idleSec: 3, burstEverySec: 3, esBurstPct: 50 }),
    timing: (idleSec: number, needSec: number) => idleSec >= needSec,
  }, { idleSec: 3, burstEverySec: 3, esBurstPct: 50 }, elements);
  registerKeystoneHandler(table, 'time-of-need', {
    recovery: (maxHp: number) => timeOfNeedHeal(maxHp, { periodSec: 5, healMaxHpPct: 15 }),
    status: (family: string) => family,
    timing: (nowUs: number, dueAtUs: number) => nowUs >= dueAtUs,
  }, { periodSec: 5, healMaxHpPct: 15 }, elements);
  registerKeystoneHandler(table, 'borrowed-time', {
    incoming: (hpPaid: number) => borrowedRecoup(hpPaid, { recoupPct: 40, durationSec: 6 }),
    recovery: (hpPaid: number) => borrowedRecoup(hpPaid, { recoupPct: 40, durationSec: 6 }),
    timing: (nowUs: number, dueAtUs: number) => nowUs >= dueAtUs,
  }, { recoupPct: 40, durationSec: 6 }, elements);
  registerKeystoneHandler(table, 'staggering-resolve', {
    incoming: (hpDamage: number) => staggeringSplit(hpDamage, { deferredPct: 40, durationSec: 5 }),
    timing: (nowUs: number, dueAtUs: number) => nowUs >= dueAtUs,
  }, { deferredPct: 40, durationSec: 5 }, elements);
  registerKeystoneHandler(table, 'parasitic-affliction', {
    recovery: (dotDamage: number) => parasiticLeech(dotDamage, { baseLeechPct: 2 }),
  }, { baseLeechPct: 2 }, elements);
}
