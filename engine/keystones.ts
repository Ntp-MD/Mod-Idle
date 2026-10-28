/**
 * The keystone bundle registry, shared and pure.
 *
 * `tools/data/tree.json` writes each keystone node's `effects[].params` from the bundle table; this
 * module owns the PARAMETER SCHEMA (names, units, ranges), the REQUIRED HOOKS each key needs, and the
 * closed runtime-state schema of §7.6/§7.7. It reads nothing: no RNG, no DOM, no globals, no client
 * or game imports. The runtime adapter (`game/src/sim/keystone-runtime.ts`) binds real handler
 * functions to these keys; a key is purchasable and usable only when every required hook is a real
 * function supplied there — never by a "supported list" kept beside the handlers.
 */

export type { StatKey } from './core-attributes.ts';

/** The hook names a keystone handler may answer — a closed union (§6). */
export const KEYSTONE_HOOKS = [
  'sheet', 'reservation', 'cost', 'outgoing', 'incoming', 'status', 'recovery', 'timing', 'kill',
] as const;
export type KeystoneHook = (typeof KEYSTONE_HOOKS)[number];

/** The player-side status families the runtime schema knows — one list, read by the save and by combat. */
export const PLAYER_STATUS_FAMILIES = ['burn', 'chill', 'shock', 'poison', 'bleed', 'mark', 'crippled'] as const;
export type PlayerStatusFamily = (typeof PLAYER_STATUS_FAMILIES)[number];

/** A param's unit and bounds, from §6: % in 0..100, mult >= 0, duration/interval > 0, count a
 *  positive integer. `pct-positive` and `mult-positive` are the fields whose zero has no meaning
 *  (the conversion rate of 05); `points` is a resistance-point move, `rate` a per-second frequency. */
export type KeystoneParamKind = 'pct' | 'pct-positive' | 'mult' | 'mult-positive' | 'count' | 'sec' | 'rate' | 'points' | 'meters' | 'element';

export interface KeystoneBundleDef {
  /** The slug shared with the node id suffix (`keystone.<key>`). */
  key: string;
  /** The declared params — an empty object is a boolean contract, not an empty handler. */
  params: Record<string, KeystoneParamKind>;
  /** Every hook the runtime must supply with a real function before this key may be bought. */
  requiredHooks: readonly KeystoneHook[];
}

/** The 105 bundle keys — §6's catalogue plus Packet N — params and required hooks exactly as the table states them. */
const BUNDLES: KeystoneBundleDef[] = [
  { key: 'ironwall', params: { evasionToArmour: 'mult' }, requiredHooks: ['sheet'] },
  { key: 'unstoppable', params: { penaltyDamageMult: 'mult' }, requiredHooks: ['outgoing', 'timing'] },
  { key: 'berserk', params: { damageMult: 'mult', aspdMult: 'mult', takenMult: 'mult' }, requiredHooks: ['outgoing', 'incoming', 'timing'] },
  { key: 'redline', params: { hitStacks: 'count', maxStacks: 'count', damagePctPerStack: 'pct', hpCostPctPerStackPerSec: 'pct', idleResetSec: 'sec' }, requiredHooks: ['outgoing', 'timing'] },
  { key: 'emberheart', params: { element: 'element', conversionPct: 'pct-positive' }, requiredHooks: ['outgoing'] },
  { key: 'one-flame', params: { sharedFirePct: 'pct', ownColdLightningEffectPct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'endless-hunger', params: { bankCapPct: 'pct', expirySec: 'sec' }, requiredHooks: ['recovery', 'timing'] },
  { key: 'headsman', params: { normalThresholdPct: 'pct', bossUniqueThresholdPct: 'pct' }, requiredHooks: ['outgoing', 'kill'] },
  { key: 'crimson-pact', params: { directPhysicalPct: 'pct', bleedTotalPct: 'pct', durationSec: 'sec' }, requiredHooks: ['outgoing', 'status'] },
  { key: 'painforged', params: { bankCapHpPct: 'pct', nextHitBonusPct: 'pct' }, requiredHooks: ['incoming', 'outgoing'] },
  { key: 'fortress-under-siege', params: { maxStacks: 'count', reductionPctPerStack: 'pct', resetSec: 'sec' }, requiredHooks: ['incoming', 'timing'] },
  { key: 'worthy-foe', params: { hits: 'count', dealtMult: 'mult', takenMult: 'mult' }, requiredHooks: ['outgoing', 'incoming', 'timing'] },
  { key: 'unerring-eye', params: {}, requiredHooks: ['outgoing'] },
  { key: 'barkskin', params: { regenEverySec: 'sec', maxCharges: 'count', hitTakenMult: 'mult' }, requiredHooks: ['incoming', 'timing'] },
  { key: 'master-surgeon', params: { healMult: 'mult', durationSec: 'sec' }, requiredHooks: ['recovery', 'timing'] },
  { key: 'ambush', params: { otherCritMult: 'mult' }, requiredHooks: ['outgoing'] },
  { key: 'toxic-execution', params: { durationSec: 'sec' }, requiredHooks: ['outgoing', 'status'] },
  { key: 'delayed-demolition', params: { deferredPct: 'pct', deferredMult: 'mult', delaySec: 'sec' }, requiredHooks: ['outgoing', 'timing'] },
  { key: 'demolition-sequence', params: { hits: 'count', damagePct: 'pct', extraTargets: 'count', element: 'element' }, requiredHooks: ['outgoing'] },
  { key: 'ghost-dance', params: { recoveryEvasionPct: 'pct', maxEsPerProcPct: 'pct', icdSec: 'sec' }, requiredHooks: ['incoming', 'recovery', 'timing'] },
  { key: 'escape-artist', params: { idleSec: 'sec', burstEverySec: 'sec', esBurstPct: 'pct' }, requiredHooks: ['recovery', 'timing'] },
  { key: 'profane-bloom', params: { victimMaxHpPct: 'pct', element: 'element', radiusM: 'meters' }, requiredHooks: ['kill'] },
  { key: 'malediction', params: { curseLimit: 'count', effectMult: 'mult' }, requiredHooks: ['status'] },
  { key: 'elemental-equilibrium', params: { durationSec: 'sec', ownResPlus: 'points', otherResMinus: 'points' }, requiredHooks: ['outgoing', 'status'] },
  { key: 'inevitable-judgement', params: { nonCritElemMult: 'mult' }, requiredHooks: ['outgoing'] },
  { key: 'instruments-of-virtue', params: { alternateMult: 'mult' }, requiredHooks: ['outgoing'] },
  { key: 'mind-over-matter', params: { manaSharePct: 'pct' }, requiredHooks: ['incoming'] },
  { key: 'arcane-battery', params: { reserveManaPct: 'pct', esPerMana: 'mult' }, requiredHooks: ['sheet', 'reservation'] },
  { key: 'radiant-faith', params: { reserveHpPct: 'pct', flatCutReservedPct: 'pct', maxHitCutPct: 'pct' }, requiredHooks: ['reservation', 'incoming'] },
  { key: 'time-of-need', params: { periodSec: 'sec', healMaxHpPct: 'pct' }, requiredHooks: ['recovery', 'status', 'timing'] },
  { key: 'blood-price', params: { hpPerMana: 'mult' }, requiredHooks: ['cost'] },
  { key: 'borrowed-time', params: { recoupPct: 'pct', durationSec: 'sec' }, requiredHooks: ['incoming', 'recovery', 'timing'] },
  { key: 'crushing-rhythm', params: { maxBasicHitsPerSec: 'rate' }, requiredHooks: ['outgoing', 'timing'] },
  { key: 'armourbreaker', params: { armourBreakPct: 'pct', maxBreakPct: 'pct', resetSec: 'sec' }, requiredHooks: ['outgoing', 'status'] },
  { key: 'turtle-doctrine', params: {}, requiredHooks: ['incoming'] },
  { key: 'dark-siphon', params: {}, requiredHooks: ['recovery'] },
  { key: 'disrupting-blows', params: { hitMaxHpThresholdPct: 'pct', stopSec: 'sec' }, requiredHooks: ['outgoing', 'status'] },
  { key: 'elemental-aegis', params: { elementHitTakenMult: 'mult' }, requiredHooks: ['incoming'] },
  { key: 'enduring-core', params: { hpThresholdPct: 'pct', belowTakenMult: 'mult' }, requiredHooks: ['sheet', 'incoming'] },
  { key: 'mana-debt', params: { debtLimitUsableManaPct: 'pct', negativeRegenMult: 'mult' }, requiredHooks: ['cost', 'recovery'] },
  { key: 'thornbound', params: { armourDamagePct: 'pct', icdSec: 'sec', ownDirectDamageMult: 'mult' }, requiredHooks: ['incoming', 'outgoing', 'timing'] },
  { key: 'blood-covenant', params: {}, requiredHooks: ['reservation'] },
  { key: 'chaos-inoculation', params: { maxHp: 'count' }, requiredHooks: ['sheet', 'incoming', 'cost', 'reservation'] },
  { key: 'staggering-resolve', params: { deferredPct: 'pct', durationSec: 'sec' }, requiredHooks: ['incoming', 'timing'] },
  { key: 'shield-gate', params: { rearmCdSec: 'sec' }, requiredHooks: ['incoming', 'recovery', 'timing'] },
  { key: 'capacitive-casting', params: { spentManaEsPct: 'pct', naturalEsRegenMult: 'mult' }, requiredHooks: ['cost', 'recovery'] },
  { key: 'auto-cleanse', params: { icdSec: 'sec' }, requiredHooks: ['status', 'timing'] },
  { key: 'plague-courier', params: { icdSec: 'sec' }, requiredHooks: ['outgoing', 'status', 'timing'] },
  { key: 'parasitic-affliction', params: { baseLeechPct: 'pct' }, requiredHooks: ['recovery'] },
  { key: 'aura-resonance', params: { reservationPctPerAura: 'pct', reservationCapPct: 'pct', effectPctPerAura: 'pct', effectCapPct: 'pct' }, requiredHooks: ['sheet', 'reservation'] },
  { key: 'elemental-infusion', params: { extraTotalPct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'elemental-conduit', params: {}, requiredHooks: ['outgoing', 'status'] },

  // ---- Packet M — the expansion trade-offs. Each one buys a condition with a disadvantage on the
  // other side of the same rule; none of them adds a grant line.
  { key: 'titan-frame', params: { maxHpPct: 'pct', aspdPct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'gale-form', params: { aspdPct: 'pct', maxHpPct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'bulwark', params: { armourPct: 'pct', evasionPct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'phantom-step', params: { evasionPct: 'pct', armourPct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'deepwell', params: { maxManaPct: 'pct', maxHpPct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'hollow-body', params: { maxEsPct: 'pct', maxHpPct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'blood-engine', params: { maxHpPct: 'pct', maxManaPct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'keen-edge', params: { critChancePct: 'pct', critDamagePct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'brutal-force', params: { critDamagePct: 'pct', critChancePct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'spellfocus', params: { magicPct: 'pct', physicalPct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'executioner', params: { lowHpThresholdPct: 'pct', lowHpDamagePct: 'pct', otherDamagePct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'opener', params: { fullHpDamagePct: 'pct', otherDamagePct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'giant-slayer', params: { bossDamagePct: 'pct', normalDamagePct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'swarm-bane', params: { normalDamagePct: 'pct', bossDamagePct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'elementalist', params: { elementalPct: 'pct', physicalPct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'brute', params: { physicalPct: 'pct', elementalPct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'overkill', params: { highHpThresholdPct: 'pct', highHpDamagePct: 'pct', otherDamagePct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'sniper', params: { critDamagePct: 'pct', nonCritDamagePct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'puncturing', params: { armourPenPct: 'pct', damagePct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'firewalker', params: { element: 'element', reductionPct: 'pct', otherElementPct: 'pct' }, requiredHooks: ['incoming'] },
  { key: 'frostwalker', params: { element: 'element', reductionPct: 'pct', otherElementPct: 'pct' }, requiredHooks: ['incoming'] },
  { key: 'stormwalker', params: { element: 'element', reductionPct: 'pct', otherElementPct: 'pct' }, requiredHooks: ['incoming'] },
  { key: 'earthward', params: { element: 'element', reductionPct: 'pct', otherElementPct: 'pct' }, requiredHooks: ['incoming'] },
  { key: 'plagueward', params: { element: 'element', reductionPct: 'pct', otherElementPct: 'pct' }, requiredHooks: ['incoming'] },
  { key: 'last-stand', params: { hpThresholdPct: 'pct', lowTakenPct: 'pct', highTakenPct: 'pct' }, requiredHooks: ['incoming'] },
  { key: 'brawler', params: { hpThresholdPct: 'pct', highReductionPct: 'pct', lowIncreasePct: 'pct' }, requiredHooks: ['incoming'] },
  { key: 'reaper', params: { healMaxHpPct: 'pct' }, requiredHooks: ['kill'] },
  { key: 'soul-harvest', params: { restoreMaxManaPct: 'pct' }, requiredHooks: ['kill'] },
  { key: 'trophy-hunter', params: { bossHealMaxHpPct: 'pct', bossRestoreMaxManaPct: 'pct', normalHealMaxHpPct: 'pct', normalRestoreMaxManaPct: 'pct' }, requiredHooks: ['kill'] },
  { key: 'bloodfeast', params: { bleedingHealMaxHpPct: 'pct', otherHealMaxHpPct: 'pct' }, requiredHooks: ['kill'] },

  // ---- Packet N — the 15-per-wing expansion. Every key states one rule and one cost; none adds a
  // stat line beside its bundle.
  { key: 'anvil', params: { elementalArmourPct: 'pct' }, requiredHooks: ['sheet', 'incoming'] },
  { key: 'unbreakable', params: { ignoreBelowMaxHpPct: 'pct', bigHitTakenPct: 'pct' }, requiredHooks: ['incoming'] },
  { key: 'concussive-blows', params: { stunSec: 'sec', stunnedTakenPct: 'pct' }, requiredHooks: ['outgoing', 'status', 'timing'] },
  { key: 'riposte', params: { blockChanceMult: 'mult', reflectMult: 'mult', icdSec: 'sec' }, requiredHooks: ['sheet', 'incoming', 'timing'] },
  { key: 'single-combat', params: { damagePct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'mirror-strike', params: { windowSec: 'sec' }, requiredHooks: ['incoming', 'outgoing', 'timing'] },
  { key: 'crippling-strikes', params: { crippledTakenPct: 'pct' }, requiredHooks: ['status', 'outgoing'] },
  { key: 'conductive', params: { spreadTargets: 'count', shockedTakenPct: 'pct' }, requiredHooks: ['status', 'outgoing'] },
  { key: 'exploit-weakness', params: { statusDamagePct: 'pct', cleanDamagePct: 'pct' }, requiredHooks: ['outgoing', 'status'] },
  { key: 'ashen-crown', params: { burningTakenPct: 'pct', directFirePct: 'pct' }, requiredHooks: ['outgoing', 'status'] },
  { key: 'winters-grip', params: { chilledTakenPct: 'pct' }, requiredHooks: ['outgoing', 'status'] },
  { key: 'monochrome', params: { element: 'element', elementalPct: 'pct' }, requiredHooks: ['outgoing', 'status'] },
  { key: 'empty-vessel', params: { maxManaPct: 'pct', auraEffectPct: 'pct' }, requiredHooks: ['sheet', 'reservation'] },
  { key: 'sanctuary', params: { fullEsTakenPct: 'pct', esRegenPct: 'pct' }, requiredHooks: ['sheet', 'incoming', 'timing'] },
  { key: 'trance', params: { everyCasts: 'count', costPct: 'pct' }, requiredHooks: ['cost', 'timing'] },
  { key: 'purist', params: {}, requiredHooks: ['sheet', 'incoming', 'status'] },
  { key: 'bloodthirst', params: { leechPct: 'pct' }, requiredHooks: ['sheet'] },
  { key: 'grit', params: { maxHitMaxHpPct: 'pct', otherHitPct: 'pct' }, requiredHooks: ['incoming'] },
  { key: 'hemorrhage', params: { bleedDamagePct: 'pct', directPhysicalPct: 'pct' }, requiredHooks: ['outgoing', 'status'] },
  { key: 'blur', params: { hitsPerDodge: 'count' }, requiredHooks: ['sheet', 'incoming', 'timing'] },
  { key: 'fortuna', params: { doubleCritPct: 'pct', nonCritPct: 'pct' }, requiredHooks: ['outgoing'] },
  { key: 'lucky-streak', params: { critDamagePctPerStack: 'pct', maxStacks: 'count' }, requiredHooks: ['outgoing', 'timing'] },
  { key: 'gamblers-step', params: { perfectDodgeMult: 'mult' }, requiredHooks: ['sheet'] },
];

const BY_KEY = new Map(BUNDLES.map((b) => [b.key, b]));

/** Every bundle key the registry knows, in catalogue order. */
export const KEYSTONE_KEYS: readonly string[] = BUNDLES.map((b) => b.key);

/** The bundle a key names, or a refusal that names the key. */
export function keystoneDef(key: string): KeystoneBundleDef {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`keystone "${key}" is not a bundle the registry knows`);
  return def;
}

const inRange = (kind: KeystoneParamKind, v: number): boolean => {
  switch (kind) {
    case 'pct': return v >= 0 && v <= 100;
    case 'pct-positive': return v > 0 && v <= 100;
    case 'mult': return v >= 0;
    case 'mult-positive': return v > 0;
    case 'count': return Number.isSafeInteger(v) && v > 0;
    case 'sec': case 'rate': case 'points': case 'meters': return v > 0;
    case 'element': return true;
  }
};

/**
 * One param, checked against its declared unit. A missing, unknown or nonfinite param, or a value
 * outside its band, is refused with the key AND the param name — a bundle that half-matches is a
 * keystone bought on one promise and paid out on another.
 */
export function validateKeystoneParams(
  key: string,
  params: unknown,
  elements: readonly string[] = [],
): Record<string, number | string> {
  const def = keystoneDef(key);
  const given = (params ?? {}) as Record<string, unknown>;
  if (typeof given !== 'object' || Array.isArray(given))
    throw new Error(`keystone "${key}": params must be an object`);
  for (const name of Object.keys(given))
    if (!Object.hasOwn(def.params, name))
      throw new Error(`keystone "${key}": unknown param "${name}"`);
  const out: Record<string, number | string> = {};
  for (const [name, kind] of Object.entries(def.params)) {
    if (!Object.hasOwn(given, name))
      throw new Error(`keystone "${key}": missing param "${name}"`);
    const v = given[name];
    if (kind === 'element') {
      if (typeof v !== 'string' || !elements.includes(v))
        throw new Error(`keystone "${key}": param "${name}" must name a canonical element`);
      out[name] = v;
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v))
      throw new Error(`keystone "${key}": param "${name}" must be a finite number, got ${String(v)}`);
    if (!inRange(kind, v))
      throw new Error(`keystone "${key}": param "${name}" = ${v} is outside its ${kind} band`);
    out[name] = v;
  }
  return out;
}

/** The required hooks a key's handler must carry — the table's line, not a caller's guess. */
export function requiredHooksFor(key: string): readonly KeystoneHook[] {
  return keystoneDef(key).requiredHooks;
}

/** The required hooks this handler set does NOT answer with a real function. */
export function missingHooksFor(key: string, hooks: Record<string, unknown> | undefined): KeystoneHook[] {
  return requiredHooksFor(key).filter((h) => typeof hooks?.[h] !== 'function');
}

/**
 * The capability gate: a key is supported only when every required hook is a real function.
 * This is what `createTree`, the purchase path and the import validator must consult — there is no
 * second "supported" list to edit into passing (§6).
 */
export function isKeystoneSupported(key: string, hooks: Record<string, unknown> | undefined): boolean {
  return missingHooksFor(key, hooks).length === 0;
}

/** Refuse a key by name and hook, before any currency is spent. */
export function assertKeystoneSupported(key: string, hooks: Record<string, unknown> | undefined): void {
  const missing = missingHooksFor(key, hooks);
  if (missing.length)
    throw new Error(`keystone "${key}" is missing its real ${missing.map((h) => `"${h}"`).join(' + ')} handler`);
}

// ---------------------------------------------------------------------------
// Pure self-contained formulas from the §6/§7 tables. Handlers and wiring arrive with their
// packets; these are the closed arithmetic the tables already lock, kept here so no caller
// re-types a number.

/** 04 Redline: the damage pool is `1 + damagePctPerStack% × stacks`, never compounded (§7.2.2). */
export function redlineDamageMult(params: Record<string, number>, stacks: number): number {
  return 1 + (params.damagePctPerStack / 100) * Math.max(0, Math.min(params.maxStacks, stacks));
}

/** 42 Crushing Rhythm: `actualRate = min(r, cap)` and `damageMult = max(1, r / cap)` (§7.4). */
export function crushingRhythm(rate: number, params: Record<string, number>): { actualRate: number; damageMult: number } {
  const cap = params.maxBasicHitsPerSec;
  return { actualRate: Math.min(rate, cap), damageMult: Math.max(1, rate / cap) };
}

/** 64 Aura Resonance: `b = min(cap, perAura% × N)` on both sides, each capped on its own (§5.64). */
export function auraResonance(auraCount: number, params: Record<string, number>): { b: number; reservationMult: number; effectMult: number } {
  const b = Math.min(params.reservationCapPct / 100, (params.reservationPctPerAura / 100) * Math.max(0, auraCount));
  return { b, reservationMult: 1 - b, effectMult: 1 + b };
}

/** 64 Aura Resonance effect size: `bE = min(effectCap, effectPerAura × N)` (§7.5.6). */
export function auraEffectScale(auraCount: number, params: Record<string, number>): number {
  return 1 + Math.min(params.effectCapPct / 100, (params.effectPctPerAura / 100) * Math.max(0, auraCount));
}

/**
 * 65 Elemental Infusion: `extra[e] = extraTotalPct% × P × max(0, F[e]) / Σ max(0, F)` (§5.65).
 * P is the cached pre-crit, pre-conversion physical pool; a flat with no weight gets nothing, and
 * the bonus never feeds back into F or P.
 */
export function elementalInfusionExtras(
  physicalPool: number,
  flatByElement: Record<string, number>,
  params: Record<string, number>,
  elements: readonly string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  const weights: Record<string, number> = {};
  let sum = 0;
  for (const el of elements) {
    const f = Math.max(0, flatByElement[el] || 0);
    if (f > 0) { weights[el] = f; sum += f; }
  }
  if (sum <= 0 || physicalPool <= 0) return out;
  for (const [el, f] of Object.entries(weights))
    out[el] = (params.extraTotalPct / 100) * physicalPool * f / sum;
  return out;
}

/** 28 Malediction: an add line scales ×effectMult; a mult line scales its distance from 1 (§7.6). */
export function maledictionValue(op: 'add' | 'mult', value: number, params: Record<string, number>): number {
  return op === 'add' ? value * params.effectMult : 1 + (value - 1) * params.effectMult;
}

// ---------------------------------------------------------------------------
// Packet E — static folds: 01, 05, 06, 13, 47, 51, 55. Each one is the closed arithmetic the plan
// fixes; the runtime handlers call these, so the sim and a fixture cannot disagree.

/** A bought keystone: the slug and its validated params. */
export interface KeystoneBundle {
  key: string;
  params: Record<string, number | string>;
}

/** The first bundle with this key, or undefined — the one lookup every handler uses. A caller with no
 *  allocation (or a fixture built before the field existed) reads as "not bought". */
export const bundleOf = (bundles: readonly KeystoneBundle[] | undefined, key: string): KeystoneBundle | undefined =>
  bundles?.find((b) => b.key === key);

export const bundleHas = (bundles: readonly KeystoneBundle[] | undefined, key: string): boolean => bundleOf(bundles, key) !== undefined;

/**
 * 01 Ironwall: every point of Evasion Rating becomes Armour 1:1 and the Evasion layer goes away.
 * Perfect Dodge is its own layer and is not touched (§7.5.1).
 */
export function ironwallSheet(armour: number, evasion: number): { armour: number; evasion: number } {
  return { armour: armour + evasion, evasion: 0 };
}

/**
 * 06 One Flame: raw resistance bases (common + specific, before the cap). Fire's bonus is shared at
 * `sharedFirePct` with Cold and Lightning, and their own bonuses count only at
 * `ownColdLightningEffectPct`. Fire and every other Element are unchanged; the Cap is applied later,
 * per Element, and is never copied (§7.5.2).
 */
export function oneFlameResistances(
  fire: number,
  cold: number,
  lightning: number,
  params: Record<string, number>,
): { fire: number; cold: number; lightning: number } {
  const share = params.sharedFirePct / 100;
  const own = params.ownColdLightningEffectPct / 100;
  return {
    fire,
    cold: cold * own + fire * share,
    lightning: lightning * own + fire * share,
  };
}

/**
 * 05 Emberheart: the crit-finished Physical share is routed into Fire 1:1 before mitigation. The
 * native Element pools are untouched and the base stays the pre-conversion Physical pool (§7.2.8).
 */
export function emberheartConvert(physical: number, params: Record<string, number>): { physical: number; fire: number } {
  const routed = physical * (params.conversionPct / 100);
  return { physical: physical - routed, fire: routed };
}

/** 13 Unerring Eye: the Accuracy/Evasion miss is skipped; Dodge is its own roll and crits are off. */
export const unerringEyeActive = (bundles: readonly KeystoneBundle[]): boolean => bundleHas(bundles, 'unerring-eye');

/**
 * 47 Elemental Aegis: the Elemental part of a Hit enters ES at `elementHitTakenMult`, while the
 * Physical part bypasses ES entirely. `toHpPhysical` is still paid through HP (§7.3.6).
 */
export function elementalAegisSplit(
  physical: number,
  elemental: number,
  es: number,
  params: Record<string, number>,
): { toEs: number; elementToHp: number; physicalToHp: number } {
  const element = elemental * params.elementHitTakenMult;
  const toEs = Math.min(Math.max(0, es), element);
  return { toEs, elementToHp: element - toEs, physicalToHp: physical };
}

/**
 * 51 Enduring Core: only the HP damage below `hpThresholdPct` of Max HP is cut by `belowTakenMult`;
 * a Hit that crosses the threshold keeps its upper part at full value (§7.3.9). The character also
 * has no ES while this is bought, which the sheet fold enforces.
 */
export function enduringCoreHpDamage(
  damage: number,
  currentHp: number,
  maxHp: number,
  params: Record<string, number>,
): number {
  const floor = maxHp * (params.hpThresholdPct / 100);
  const below = Math.min(damage, Math.max(currentHp - floor, 0));
  const above = Math.max(damage - below, 0);
  return below * params.belowTakenMult + above;
}

/** 55 Chaos Inoculation: Max HP is the param's value (1), and the character is never Low Life. */
export const chaosInoculationMaxHp = (params: Record<string, number>): number => params.maxHp;

/** 55 Chaos Inoculation: a Chaos packet is negated in full — damage immunity, not status immunity. */
export const chaosInoculationImmune = (elements: readonly string[]): boolean => elements.includes('chaos');

// ---------------------------------------------------------------------------
// Packet F — reservation and skill costs: 34, 35, 37, 52, 54, 64.

/** 34 Arcane Battery: the ES the fixed Mana reservation buys, after the base ES percent (§7.5.3). */
export function arcaneBatteryEs(maxMana: number, params: Record<string, number>): number {
  return maxMana * (params.reserveManaPct / 100) * params.esPerMana;
}

/** 35 Radiant Faith: the flat cut is `flatCutReservedPct%` of the reserved HP, capped at
 *  `maxHitCutPct%` of the Hit itself (§7.3.4). */
export function radiantFaithCut(reservedHp: number, hit: number, params: Record<string, number>): number {
  return Math.min(reservedHp * (params.flatCutReservedPct / 100), hit * (params.maxHitCutPct / 100));
}

/** 37 Blood Price: the Mana part of a skill cost becomes HP 1:1 (`hpPerMana`), auras untouched. */
export function bloodPriceHp(manaCost: number, params: Record<string, number>): number {
  return manaCost * params.hpPerMana;
}

/** 52 Mana Debt: the borrow floor is a share of usable Mana, a positive magnitude. */
export function manaDebtFloor(usableMana: number, params: Record<string, number>): number {
  return Math.max(0, usableMana) * (params.debtLimitUsableManaPct / 100);
}

/** 52 Mana Debt: Mana Regen is multiplied while the pool stands negative (§7.4.10). */
export function manaRegenWhileNegative(regen: number, negative: boolean, params: Record<string, number>): number {
  return negative ? regen * params.negativeRegenMult : regen;
}

/**
 * 64 Aura Resonance: the Aura Effect stretch, applied once per aura row (§7.5.6). An `add` value is
 * rounded; a `mult` keeps its distance from 1 scaled. Trigger clocks, cast costs and cast damage are
 * part of the aura's identity, never its effect, so they are not stretched.
 */
export const AURA_SCALE_SKIP = ['trigger_cd_sec', 'cast_mana_mult', 'cast_damage_mult'] as const;

export function auraScaledValue(op: string, value: number, bE: number, stat: string): number {
  if ((AURA_SCALE_SKIP as readonly string[]).includes(stat)) return value;
  return op === 'mult' ? 1 + (value - 1) * (1 + bE) : Math.round(value * (1 + bE));
}

// ---------------------------------------------------------------------------
// Packet G — routing, cadence and resource recovery: 33, 42, 44, 45, 58, 65.

/** 33 Mind over Matter: a share of the HP-bound damage is paid by unreserved Mana 1:1 (§7.3.8). */
export function mindOverMatter(hpDamage: number, manaAvailable: number, params: Record<string, number>): { mana: number; hp: number } {
  const mana = Math.max(0, Math.min(hpDamage * (params.manaSharePct / 100), manaAvailable));
  return { mana, hp: Math.max(0, hpDamage - mana) };
}

/** 44 Turtle Doctrine: the expected cut of a Block, replacing the roll. `p` is 0..1. */
export function turtleCut(blockChancePct: number, armour: number, divisor: number, physical: number): number {
  const p = Math.max(0, Math.min(1, blockChancePct / 100));
  return p * Math.min(armour / divisor, physical);
}

/** 58 Capacitive Casting: 20% of funded Mana spend returns as ES; funded never includes debt. */
export function capacitiveEs(fundedSpend: number, currentUnreservedMana: number, params: Record<string, number>): number {
  const funded = Math.max(0, Math.min(fundedSpend, currentUnreservedMana));
  return funded * (params.spentManaEsPct / 100);
}

// ---------------------------------------------------------------------------
// Packet H — conditions, stacks and action history: 02, 03, 04, 11, 12, 16, 32.

/** 03 Berserk: Low Life is a share of the FULL Max HP, and the sheet's own take-more is a separate
 *  always-on line (§5.03). */
export const belowLowLife = (currentHp: number, fullMaxHp: number, lowLifePct: number): boolean =>
  fullMaxHp > 0 && currentHp <= fullMaxHp * (lowLifePct / 100);

/** 12 Worthy Foe: from the third landed hit on the same target, damage dealt and taken move. */
export function worthyFoe(hits: number, params: Record<string, number>): { dealtMult: number; takenMult: number } {
  return hits >= params.hits
    ? { dealtMult: params.dealtMult, takenMult: params.takenMult }
    : { dealtMult: 1, takenMult: 1 };
}

/** 32 Instruments of Virtue: switching between Attack and Spell multiplies the next action once. */
export function instrumentsMult(last: 'attack' | 'spell' | null, next: 'attack' | 'spell', params: Record<string, number>): number {
  return last !== null && last !== next ? params.alternateMult : 1;
}

// ---------------------------------------------------------------------------
// Packet I — crit, direct-hit finishers and secondary damage: 08, 10, 19, 22, 27, 31, 53.

/** 08 Headsman: a Normal executes at its threshold, a Boss/Unique at its own lower one. */
export function headsmanThreshold(isBossUnique: boolean, params: Record<string, number>): number {
  return isBossUnique ? params.bossUniqueThresholdPct : params.normalThresholdPct;
}

/** 08: the target dies when its remaining share is at or below the threshold. */
export const headsmanExecutes = (hpRemaining: number, maxHp: number, isBossUnique: boolean, params: Record<string, number>): boolean =>
  maxHp > 0 && (hpRemaining / maxHp) * 100 <= headsmanThreshold(isBossUnique, params);

/** 19 Ambush: a full-HP target always crits; every other target half-chances it. */
export function ambushCritChance(fullHp: boolean, chance: number, params: Record<string, number>): number {
  return fullHp ? 100 : chance * params.otherCritMult;
}

/** 10 Painforged: the bank is capped at a share of Full Max HP; the next Hit spends it all once. */
export function painforgedBank(current: number, cut: number, maxHp: number, params: Record<string, number>): number {
  return Math.min(maxHp * (params.bankCapHpPct / 100), current + Math.max(0, cut));
}

/** 22 Demolition Sequence: the fifth landed Hit fires a blast worth a share of the real HP loss. */
export const demolitionBlast = (sumHpLoss: number, params: Record<string, number>): number =>
  Math.max(0, sumHpLoss) * (params.damagePct / 100);

/** 31 Inevitable Judgement: an elemental crit skips resistance, a non-crit elemental Hit loses 20%. */
export const inevitableElementMult = (crit: boolean, params: Record<string, number>): number =>
  crit ? 1 : params.nonCritElemMult;

/** 53 Thornbound: the retaliation is a share of Armour, and the owner's own direct damage is halved. */
export const thornboundRetaliation = (armour: number, params: Record<string, number>): number =>
  Math.max(0, armour) * (params.armourDamagePct / 100);

// ---------------------------------------------------------------------------
// Packet J — reactive defenses: 23, 57, 59.

/** 23 Ghost Dance: an Evasion success returns `recoveryEvasionPct%` of the Evasion Rating as ES,
 *  capped at `maxEsPerProcPct%` of Max ES, once per ICD (§5.23). */
export function ghostDanceRecovery(evasionRating: number, maxEs: number, params: Record<string, number>): number {
  return Math.max(0, Math.min(evasionRating * (params.recoveryEvasionPct / 100), maxEs * (params.maxEsPerProcPct / 100)));
}

/** 57 Shield Gate: only a Hit that empties a non-empty ES uses the gate, and it discards the
 *  overflow that would have reached HP; the gate rearms once ES is full and the cooldown has passed. */
export function shieldGateHolds(esBefore: number, esAfter: number, armed: boolean): boolean {
  return armed && esBefore > 0 && esAfter <= 0;
}

/** 59 Auto Cleanse: a newly applied family is removed at once when its ICD is ready. */
export const autoCleanseReady = (nowUs: number, icdUntilUs: number): boolean => nowUs >= icdUntilUs;

// ---------------------------------------------------------------------------
// Packet K — status mechanics and transfer: 09, 20, 28, 30, 43, 46, 60, 66.

/** 09 Crimson Pact: a Physical Hit pays half at once and owes the other half as Bleed over time. */
export function crimsonPactSplit(physical: number, params: Record<string, number>): { direct: number; bleedTotal: number; bleedDps: number } {
  const direct = physical * (params.directPhysicalPct / 100);
  const bleedTotal = physical * (params.bleedTotalPct / 100);
  return { direct, bleedTotal, bleedDps: bleedTotal / params.durationSec };
}

/**
 * 20 Toxic Execution: the crit bonus alone is paid as Poison over the duration, no Element needed.
 * The whole of it arrives — `dps` is the bonus spread across the seconds the bundle states — while
 * `budgetDps` is the per-second figure the shared DoT cap measures the lane against.
 */
export function toxicExecution(critBonus: number, nominalRate: number, params: Record<string, number>): { budgetDps: number; dps: number } {
  const bonus = Math.max(0, critBonus);
  return { budgetDps: bonus * nominalRate, dps: bonus / params.durationSec };
}

/** 43 Armourbreaker: each landed Physical Hit breaks 5% of the initial Armour, capped. */
export function armourBreak(initialArmour: number, stacks: number, params: Record<string, number>): { armour: number; stacks: number } {
  const cap = params.maxBreakPct / params.armourBreakPct;
  const next = Math.min(cap, Math.max(0, stacks) + 1);
  return { armour: initialArmour * (1 - Math.min(params.maxBreakPct, next * params.armourBreakPct) / 100), stacks: next };
}

/** 46 Disrupting Blows: a Hit worth at least the threshold share of Max HP buys a stop. */
export const disruptingStop = (hpLoss: number, maxHp: number, params: Record<string, number>): boolean =>
  maxHp > 0 && hpLoss >= maxHp * (params.hitMaxHpThresholdPct / 100);

/** 30 Elemental Equilibrium: the dominant Element's resistance rises, the others fall. */
export function equilibriumResistance(ownRes: number, otherRes: number, params: Record<string, number>): { own: number; other: number } {
  return { own: ownRes + params.ownResPlus, other: Math.max(0, otherRes - params.otherResMinus) };
}

/** 60 Plague Courier: the transferred instance keeps its remaining damage and lifetime. */
export const plagueTransfer = (dps: number, nextPayAtUs: number, expiresAtUs: number | null): { dps: number; nextPayAtUs: number; expiresAtUs: number | null } =>
  ({ dps, nextPayAtUs, expiresAtUs });

// ---------------------------------------------------------------------------
// Packet L — timed recovery and committed damage: 07, 17, 21, 24, 36, 40, 56, 61.

/** 07 Endless Hunger: excess leech banks up to a share of the destination pool, with an expiry. */
export function endlessHungerBank(current: number, excess: number, fullMaxPool: number, params: Record<string, number>): number {
  return Math.min(fullMaxPool * (params.bankCapPct / 100), Math.max(0, current) + Math.max(0, excess));
}

/** 17 Master Surgeon: a potion's nominal heal is multiplied and spread evenly over its stream. */
export function surgeonStream(nominalHeal: number, params: Record<string, number>): { total: number; perSec: number } {
  const total = nominalHeal * params.healMult;
  return { total, perSec: total / params.durationSec };
}

/** 21 Delayed Demolition: a share of the post-mitigation Hit lands later, multiplied once. */
export function deferredHit(damage: number, params: Record<string, number>): { immediate: number; deferred: number } {
  const share = damage * (params.deferredPct / 100);
  return { immediate: damage - share, deferred: share * params.deferredMult };
}

/** 24 Escape Artist: the burst is a share of Max ES, then repeats on its own beat. */
export const escapeBurst = (maxEs: number, params: Record<string, number>): number =>
  maxEs * (params.esBurstPct / 100);

/** 36 Time of Need: the periodic heal is a share of Max HP, clamped to the usable pool. */
export const timeOfNeedHeal = (maxHp: number, params: Record<string, number>): number =>
  maxHp * (params.healMaxHpPct / 100);

/** 40 Borrowed Time: the recoup is a share of the HP actually paid, spread over its duration. */
export function borrowedRecoup(hpPaid: number, params: Record<string, number>): { total: number; perPay: number } {
  const total = Math.max(0, hpPaid) * (params.recoupPct / 100);
  return { total, perPay: total / params.durationSec };
}

/** 56 Staggering Resolve: the HP-bound share is paid at once, the rest as equal debts. */
export function staggeringSplit(hpDamage: number, params: Record<string, number>): { immediate: number; perDebt: number } {
  const deferred = hpDamage * (params.deferredPct / 100);
  return { immediate: hpDamage - deferred, perDebt: deferred / params.durationSec };
}

/** 61 Parasitic Affliction: total Life Leech applies to actual DoT damage, never Hits. */
export const parasiticLeech = (actualDotDamage: number, params: Record<string, number>, totalLeechPct = params.baseLeechPct): number =>
  Math.max(0, actualDotDamage) * (totalLeechPct / 100);

// ---------------------------------------------------------------------------
// Packet M — the expansion trade-offs. One condition, two percentages: the rule reads the condition
// and returns the multiplier for the side that applies. An Element ward names its own Element and
// amplifies every other Elemental hit, so a second ward is a real commitment rather than a free stack.

/** The multiplier a two-sided condition buys: `whenTruePct` or `whenFalsePct`, as a percentage. */
export const tradeoffPct = (condition: boolean, whenTruePct: number, whenFalsePct: number): number =>
  1 + (condition ? whenTruePct : whenFalsePct) / 100;

/** An Element ward: its named Element is cut, every other Elemental hit is amplified. */
export function elementWardMult(
  hitting: string | null | undefined,
  element: string,
  reductionPct: number,
  otherElementPct: number,
): number {
  if (!hitting) return 1;
  return hitting === element ? 1 - reductionPct / 100 : 1 + otherElementPct / 100;
}








// ---------------------------------------------------------------------------
// The runtime state schema of §7.6/§7.7 — typed now, filled by later packets. Nothing here holds a
// function; every queue stores dueAtUs/amount/source/target so it round-trips through the save.

/** The DoT instance model of §7.6. `appliedAtUs` is null while a family is still held as the native
 *  aggregate (its own per-stack apply time is not recorded); the status packets replace the
 *  aggregate with real instances and fill every field. */
export interface StatusInstance {
  family: string;
  lane: 'native' | 'extra' | 'critical' | 'transfer';
  dps: number;
  budgetDps: number;
  appliedAtUs: number | null;
  nextPayAtUs: number;
  expiresAtUs: number | null;
  decayGroupId: string | null;
  sourceId: string | null;
}

/** One queued payment (§7.1): a debt, DoT, recoup or recovery entry, stored by time and amount. */
export interface PendingPayment {
  dueAtUs: number;
  amount: number;
  sourceId: string | null;
  targetId: string | null;
}

/** 07 Endless Hunger's excess-leech bank: FIFO entries with their own expiry (§7.4). */
export interface BankEntry {
  pool: 'hp' | 'es';
  amount: number;
  expiresAtUs: number;
}

export interface KeystoneQueues {
  deferred: PendingPayment[];
  dot: PendingPayment[];
  hpDebt: PendingPayment[];
  recoup: PendingPayment[];
  potion: PendingPayment[];
}

/** The combat state §7.7 lists as canonical saved state. D1 opens the fields; the packets that
 *  implement the effects fill the queues, stacks and counters. */
export interface KeystoneRuntimeState {
  lastHitAtUs: number | null;
  lastLossAtUs: number | null;
  lastAction: 'attack' | 'spell' | null;
  lastActionAtUs: number | null;
  /** Rage, Fortify, Bark and the rest: one entry per named counter. */
  stacks: Record<string, number>;
  /** Per-target hit counters (Worthy Foe, Demolition Sequence). */
  counters: Record<string, number>;
  /** Per-target auxiliary references (summed HP loss, dominant-element state), plain numbers only. */
  targetCounters: Record<string, number>;
  bank: BankEntry[];
  /** Armed/cleared one-word flags: Shield Gate, Painforged's next hit, gate arms. */
  flags: Record<string, boolean>;
  /** ICDs by name, stored as the absolute µs they next allow (59, 53, 60, 23, 57). */
  icdsUs: Record<string, number>;
  /** 52 Mana Debt: the borrow limit captured when the pool first went negative, in positive units of
   *  Mana. Null while the pool is non-negative. A later MaxMana change never moves it (§7.4.10). */
  manaDebtLimit: number | null;
  /** The control bucket of §7.6: available stop-time in µs and the stop's end. */
  controlAvailableUs: number;
  stopUntilUs: number | null;
  queues: KeystoneQueues;
  /** Real DoT instances once the status packets replace the native aggregate. */
  dotInstances: StatusInstance[];
  /** Actor-instance references the pending damage must resolve against — never a reused index. */
  targetRefs: Record<string, string>;
}

export function newKeystoneRuntimeState(): KeystoneRuntimeState {
  return {
    lastHitAtUs: null, lastLossAtUs: null, lastAction: null, lastActionAtUs: null,
    stacks: {}, counters: {}, targetCounters: {}, bank: [], flags: {}, icdsUs: {},
    manaDebtLimit: null,
    controlAvailableUs: 0, stopUntilUs: null,
    queues: { deferred: [], dot: [], hpDebt: [], recoup: [], potion: [] },
    dotInstances: [], targetRefs: {},
  };
}

// ---------------------------------------------------------------------------
// Save-format validators. A current-format field that is absent or impossible is corrupt data, and
// the reader refuses with the name of the field — it never default-fills to make a load pass (§7.7).

const fail = (path: string, why: string): never => {
  throw new Error(`save: ${path} ${why}`);
};

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const recordOf = (v: unknown, keys: string[], what: string, path: string): void => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, `must be a ${what} object`);
  for (const k of Object.keys(v as object)) if (!keys.includes(k)) fail(`${path}.${k}`, 'is not a known entry');
};

/** The native aggregate line the save may hold for one family. */
export interface SavedStatusLine {
  stacks: number;
  secLeft: number;
  perSec: number;
  alignedSec?: number;
  stackPerSec?: number[];
}
export type SavedStatuses = Partial<Record<PlayerStatusFamily, SavedStatusLine>>;

export function validatePlayerStatuses(raw: unknown): SavedStatuses {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail('playerStatuses', 'must be an object');
  recordOf(raw, [...PLAYER_STATUS_FAMILIES], 'status-family', 'playerStatuses');
  const out: SavedStatuses = {};
  for (const [family, line] of Object.entries(raw as Record<string, unknown>)) {
    const path = `playerStatuses.${family}`;
    if (typeof line !== 'object' || line === null) fail(path, 'must be a status line');
    const l = line as Record<string, unknown>;
    for (const k of Object.keys(l))
      if (!['stacks', 'secLeft', 'perSec', 'alignedSec', 'stackPerSec'].includes(k)) fail(`${path}.${k}`, 'is not a known field');
    if (!isInt(l.stacks) || (l.stacks as number) < 0) fail(`${path}.stacks`, 'must be a non-negative safe integer');
    if (!isNum(l.secLeft) || (l.secLeft as number) < 0) fail(`${path}.secLeft`, 'must be a finite number, zero or more');
    if (!isNum(l.perSec) || (l.perSec as number) < 0) fail(`${path}.perSec`, 'must be a finite number, zero or more');
    if (l.alignedSec !== undefined && (!isNum(l.alignedSec) || (l.alignedSec as number) < 0)) fail(`${path}.alignedSec`, 'must be a finite number, zero or more');
    if (l.stackPerSec !== undefined) {
      if (!Array.isArray(l.stackPerSec) || !l.stackPerSec.every((v) => isNum(v) && (v as number) >= 0))
        fail(`${path}.stackPerSec`, 'must be an array of finite non-negative numbers');
    }
    out[family as PlayerStatusFamily] = l as unknown as SavedStatusLine;
  }
  return out;
}

const RUNTIME_KEYS = Object.keys(newKeystoneRuntimeState());
const QUEUE_KEYS = ['deferred', 'dot', 'hpDebt', 'recoup', 'potion'];

function validatePayment(p: unknown, path: string): void {
  if (typeof p !== 'object' || p === null) fail(path, 'must be a payment entry');
  const e = p as Record<string, unknown>;
  for (const k of Object.keys(e)) if (!['dueAtUs', 'amount', 'sourceId', 'targetId'].includes(k)) fail(`${path}.${k}`, 'is not a known field');
  if (!isInt(e.dueAtUs) || (e.dueAtUs as number) < 0) fail(`${path}.dueAtUs`, 'must be a non-negative safe integer of µs');
  if (!isNum(e.amount) || (e.amount as number) < 0) fail(`${path}.amount`, 'must be a finite number, zero or more');
  for (const id of ['sourceId', 'targetId'])
    if (e[id] !== null && typeof e[id] !== 'string') fail(`${path}.${id}`, 'must be a string or null');
}

export function validateKeystoneRuntime(raw: unknown): KeystoneRuntimeState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail('keystoneRuntime', 'must be an object');
  recordOf(raw, RUNTIME_KEYS, 'runtime-state', 'keystoneRuntime');
  const r = raw as Record<string, unknown>;
  for (const k of ['lastHitAtUs', 'lastLossAtUs', 'lastActionAtUs', 'stopUntilUs'])
    if (r[k] !== null && !isInt(r[k])) fail(`keystoneRuntime.${k}`, 'must be a safe integer of µs or null');
  if (r.manaDebtLimit !== null && (!isNum(r.manaDebtLimit) || (r.manaDebtLimit as number) < 0))
    fail('keystoneRuntime.manaDebtLimit', 'must be a finite non-negative number or null');
  if (r.lastAction !== null && r.lastAction !== 'attack' && r.lastAction !== 'spell')
    fail('keystoneRuntime.lastAction', 'must be "attack", "spell" or null');
  for (const k of ['stacks', 'counters', 'targetCounters', 'icdsUs']) {
    if (typeof r[k] !== 'object' || r[k] === null) fail(`keystoneRuntime.${k}`, 'must be an object');
    for (const [name, v] of Object.entries(r[k] as Record<string, unknown>))
      if (!isNum(v) || (v as number) < 0) fail(`keystoneRuntime.${k}.${name}`, 'must be a finite number, zero or more');
  }
  for (const [name, v] of Object.entries(r.flags as Record<string, unknown>))
    if (typeof v !== 'boolean') fail(`keystoneRuntime.flags.${name}`, 'must be a boolean');
  if (!isNum(r.controlAvailableUs)) fail('keystoneRuntime.controlAvailableUs', 'must be a finite number');
  const bank = Array.isArray(r.bank) ? r.bank : fail('keystoneRuntime.bank', 'must be an array');
  bank.forEach((b: unknown, i: number) => {
    const path = `keystoneRuntime.bank[${i}]`;
    if (typeof b !== 'object' || b === null) fail(path, 'must be a bank entry');
    const e = b as Record<string, unknown>;
    for (const k of Object.keys(e)) if (!['pool', 'amount', 'expiresAtUs'].includes(k)) fail(`${path}.${k}`, 'is not a known field');
    if (e.pool !== 'hp' && e.pool !== 'es') fail(`${path}.pool`, 'must be "hp" or "es"');
    if (!isNum(e.amount) || (e.amount as number) < 0) fail(`${path}.amount`, 'must be a finite number, zero or more');
    if (!isInt(e.expiresAtUs)) fail(`${path}.expiresAtUs`, 'must be a safe integer of µs');
  });
  if (typeof r.queues !== 'object' || r.queues === null) fail('keystoneRuntime.queues', 'must be an object');
  recordOf(r.queues, QUEUE_KEYS, 'queue', 'keystoneRuntime.queues');
  for (const q of QUEUE_KEYS) {
    const list = (r.queues as Record<string, unknown>)[q];
    const arr = Array.isArray(list) ? list : fail(`keystoneRuntime.queues.${q}`, 'must be an array');
    arr.forEach((p: unknown, i: number) => validatePayment(p, `keystoneRuntime.queues.${q}[${i}]`));
  }
  const dotInstances = Array.isArray(r.dotInstances) ? r.dotInstances : fail('keystoneRuntime.dotInstances', 'must be an array');
  dotInstances.forEach((v: unknown, i: number) => {
    const path = `keystoneRuntime.dotInstances[${i}]`;
    if (typeof v !== 'object' || v === null) fail(path, 'must be a status instance');
    const e = v as Record<string, unknown>;
    for (const k of Object.keys(e))
      if (!['family', 'lane', 'dps', 'budgetDps', 'appliedAtUs', 'nextPayAtUs', 'expiresAtUs', 'decayGroupId', 'sourceId'].includes(k))
        fail(`${path}.${k}`, 'is not a known field');
    if (typeof e.family !== 'string' || !e.family) fail(`${path}.family`, 'must name a status family');
    if (e.lane !== 'native' && e.lane !== 'extra' && e.lane !== 'critical' && e.lane !== 'transfer')
      fail(`${path}.lane`, 'must be native, extra, critical or transfer');
    for (const k of ['dps', 'budgetDps']) if (!isNum(e[k]) || (e[k] as number) < 0) fail(`${path}.${k}`, 'must be a finite number, zero or more');
    if (!isInt(e.nextPayAtUs) || (e.nextPayAtUs as number) < 0) fail(`${path}.nextPayAtUs`, 'must be a non-negative safe integer of µs');
    for (const k of ['appliedAtUs', 'expiresAtUs'])
      if (e[k] !== null && !isInt(e[k])) fail(`${path}.${k}`, 'must be a safe integer of µs or null');
    for (const k of ['decayGroupId', 'sourceId'])
      if (e[k] !== null && typeof e[k] !== 'string') fail(`${path}.${k}`, 'must be a string or null');
  });
  if (typeof r.targetRefs !== 'object' || r.targetRefs === null) fail('keystoneRuntime.targetRefs', 'must be an object');
  for (const [name, v] of Object.entries(r.targetRefs as Record<string, unknown>))
    if (typeof v !== 'string') fail(`keystoneRuntime.targetRefs.${name}`, 'must be an actor id string');
  return r as unknown as KeystoneRuntimeState;
}
