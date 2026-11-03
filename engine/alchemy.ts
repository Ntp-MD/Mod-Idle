/** Immutable migration definition: the pre-Alchemy salvage milestone interval, never live tuning. */
export const ALCHEMY_LEGACY_INTERVAL_V1 = 500;
export const ALCHEMY_LEDGER_VERSION = 1;

export interface AlchemyLedger {
  version: typeof ALCHEMY_LEDGER_VERSION;
  eligibleOutputs: number;
  paidMilestones: number;
  /** The interval this progress was earned under; changing tuning does not reinterpret it. */
  interval: number;
  legacyRemainder: number;
  legacyInterval: typeof ALCHEMY_LEGACY_INTERVAL_V1;
}

const invalid = (detail: string): never => { throw new Error(`invalid Alchemy ledger: ${detail}`); };
const whole = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const intervalValid = (interval: number) => { if (!whole(interval) || interval < 1) invalid('interval'); };
const earned = (ledger: AlchemyLedger): bigint =>
  (BigInt(ledger.eligibleOutputs) * BigInt(ledger.legacyInterval) + BigInt(ledger.legacyRemainder) * BigInt(ledger.interval))
    / (BigInt(ledger.interval) * BigInt(ledger.legacyInterval));
const safeNumber = (value: bigint): number => {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) invalid('unsafe result');
  return Number(value);
};

/** Validate and copy without changing progress, granting rewards, or adopting a new interval. */
function copyLedger(value: unknown): AlchemyLedger {
  if (!value || typeof value !== 'object') invalid('missing record');
  const ledger = value as AlchemyLedger;
  if (ledger.version !== ALCHEMY_LEDGER_VERSION || ledger.legacyInterval !== ALCHEMY_LEGACY_INTERVAL_V1) invalid('unsupported version');
  intervalValid(ledger.interval);
  if (!whole(ledger.eligibleOutputs) || !whole(ledger.paidMilestones) || !whole(ledger.legacyRemainder)
    || ledger.legacyRemainder >= ledger.legacyInterval) invalid('counts');
  if (BigInt(ledger.paidMilestones) > earned(ledger)) invalid('milestones exceed earned credit');
  return { version: ledger.version, eligibleOutputs: ledger.eligibleOutputs, paidMilestones: ledger.paidMilestones,
    interval: ledger.interval, legacyRemainder: ledger.legacyRemainder, legacyInterval: ledger.legacyInterval };
}

export function newAlchemyLedger(interval: number): AlchemyLedger {
  intervalValid(interval);
  return { version: ALCHEMY_LEDGER_VERSION, eligibleOutputs: 0, paidMilestones: 0,
    interval, legacyRemainder: 0, legacyInterval: ALCHEMY_LEGACY_INTERVAL_V1 };
}

/** Carry only historical fractional progress; previously paid whole milestones never become due. */
export function migrateAlchemyLedger(oldSalvaged: number | undefined, interval: number): AlchemyLedger {
  const ledger = newAlchemyLedger(interval);
  if (oldSalvaged === undefined) return ledger;
  if (!whole(oldSalvaged)) invalid('legacy salvage count');
  ledger.legacyRemainder = Number(BigInt(oldSalvaged) % BigInt(ALCHEMY_LEGACY_INTERVAL_V1));
  return ledger;
}

/** Missing optional state migrates once. An existing ledger owns its version and interval snapshot. */
export function normalizeAlchemyLedger(saved: unknown, interval: number, oldSalvaged?: number): AlchemyLedger {
  intervalValid(interval);
  return saved === undefined ? migrateAlchemyLedger(oldSalvaged, interval) : copyLedger(saved);
}

/**
 * Preview all Tier owed after eligible recipe outputs. The caller preflights costs and every output,
 * then commits this returned ledger together with those grants. No ledger or inventory is mutated.
 */
export function previewAlchemyAdvance(saved: AlchemyLedger, outputs: number): { ledger: AlchemyLedger; tierDue: number } {
  const ledger = copyLedger(saved);
  if (!whole(outputs)) invalid('eligible output advance');
  ledger.eligibleOutputs = safeNumber(BigInt(ledger.eligibleOutputs) + BigInt(outputs));
  const total = earned(ledger);
  const tierDue = safeNumber(total - BigInt(ledger.paidMilestones));
  ledger.paidMilestones = safeNumber(total);
  return { ledger, tierDue };
}

/**
 * Read-only progress for UI: milestones paid, and how many more eligible Value outputs earn the next
 * Tier stone under this ledger's own snapshotted interval (legacy fractional credit included).
 */
export function alchemyTierProgress(saved: AlchemyLedger): { paid: number; outputsToNext: number; interval: number } {
  const ledger = copyLedger(saved);
  const span = BigInt(ledger.interval) * BigInt(ledger.legacyInterval);
  const numerator = BigInt(ledger.eligibleOutputs) * BigInt(ledger.legacyInterval)
    + BigInt(ledger.legacyRemainder) * BigInt(ledger.interval);
  const outputsToNext = safeNumber((span - 1n - (numerator % span)) / BigInt(ledger.legacyInterval) + 1n);
  return { paid: ledger.paidMilestones, outputsToNext, interval: ledger.interval };
}
