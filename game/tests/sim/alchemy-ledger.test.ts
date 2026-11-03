import { describe, expect, it } from 'vitest';
import {
  ALCHEMY_LEGACY_INTERVAL_V1, alchemyTierProgress, migrateAlchemyLedger, newAlchemyLedger, normalizeAlchemyLedger,
  previewAlchemyAdvance, type AlchemyLedger,
} from '@engine/alchemy';

describe('exact Alchemy milestone ledger', () => {
  it('starts fresh and missing-history ledgers without eligible output or legacy credit', () => {
    const ledger = newAlchemyLedger(7);
    expect(ledger).toEqual({ version: 1, eligibleOutputs: 0, paidMilestones: 0,
      interval: 7, legacyRemainder: 0, legacyInterval: ALCHEMY_LEGACY_INTERVAL_V1 });
    expect(migrateAlchemyLedger(undefined, 7)).toEqual(ledger);
    expect(previewAlchemyAdvance(ledger, 0)).toEqual({ ledger, tierDue: 0 });
    expect(typeof JSON.parse(JSON.stringify(ledger)).eligibleOutputs).toBe('number');
  });

  it.each([
    [0, 0], [499, 499], [500, 0], [501, 1], [999, 499], [1000, 0],
  ])('migrates salvage history %i into remainder %i without paying its whole milestones', (history, remainder) => {
    const migrated = migrateAlchemyLedger(history, 500);
    expect(migrated.eligibleOutputs).toBe(0);
    expect(migrated.paidMilestones).toBe(0);
    expect(migrated.legacyRemainder).toBe(remainder);
    expect(previewAlchemyAdvance(migrated, 0).tierDue).toBe(0);
  });

  it('applies fractional credit exactly when old and new intervals differ', () => {
    // Half an old interval plus two thirds of the new interval crosses one milestone.
    const half = migrateAlchemyLedger(750, 3);
    const first = previewAlchemyAdvance(half, 1);
    expect(first.tierDue).toBe(0);
    const second = previewAlchemyAdvance(first.ledger, 1);
    expect(second.tierDue).toBe(1);
    expect(second.ledger.eligibleOutputs).toBe(2);
    expect(second.ledger.paidMilestones).toBe(1);
    expect(previewAlchemyAdvance(second.ledger, 1).tierDue).toBe(0);
    // 499/500 is still below one; the first output at interval 1000 crosses it only at output 2.
    const almost = migrateAlchemyLedger(499, 1000);
    expect(previewAlchemyAdvance(almost, 1).tierDue).toBe(0);
    expect(previewAlchemyAdvance(almost, 2).tierDue).toBe(1);
  });

  it('pays every newly due milestone once and agrees for batch versus individual outputs', () => {
    const start = migrateAlchemyLedger(2499, 7);
    const bulk = previewAlchemyAdvance(start, 34);
    let ledger = start, total = 0;
    for (let index = 0; index < 34; index++) {
      const step = previewAlchemyAdvance(ledger, 1);
      ledger = step.ledger; total += step.tierDue;
    }
    expect(total).toBe(bulk.tierDue);
    expect(ledger).toEqual(bulk.ledger);
    expect(previewAlchemyAdvance(ledger, 0).tierDue).toBe(0);
    expect(previewAlchemyAdvance(ledger, 1).tierDue).toBe(0);
    expect(previewAlchemyAdvance(ledger, 2).tierDue).toBe(1);
  });

  it('preserves the input and leaves a failed or discarded transaction preview uncommitted', () => {
    const ledger = Object.freeze(migrateAlchemyLedger(499, 500));
    const before = JSON.stringify(ledger);
    const first = previewAlchemyAdvance(ledger, 1);
    const retried = previewAlchemyAdvance(ledger, 1);
    expect(first).toEqual(retried);
    expect(first.tierDue).toBe(1);
    expect(first.ledger).not.toBe(ledger);
    expect(JSON.stringify(ledger)).toBe(before);
  });

  it('normalizes repeatedly without replacing the saved interval or deriving legacy credit twice', () => {
    const initial = normalizeAlchemyLedger(undefined, 7, 749);
    const saved = previewAlchemyAdvance(initial, 10).ledger;
    const before = JSON.stringify(saved);
    const first = normalizeAlchemyLedger(saved, 13, 999);
    const second = normalizeAlchemyLedger(first, 19, 1499);
    expect(first).toEqual(saved);
    expect(second).toEqual(saved);
    expect(first.interval).toBe(7);
    expect(first.legacyRemainder).toBe(249);
    expect(JSON.stringify(saved)).toBe(before);
    expect(first).not.toBe(saved);
    expect(normalizeAlchemyLedger(JSON.parse(JSON.stringify(second)), 31)).toEqual(saved);
  });

  it('uses exact BigInt intermediates at safe-integer limits and refuses overflow', () => {
    const legacy = migrateAlchemyLedger(Number.MAX_SAFE_INTEGER, 2);
    expect(legacy.legacyRemainder).toBe(491);
    const preview = previewAlchemyAdvance(legacy, Number.MAX_SAFE_INTEGER);
    expect(preview.ledger.eligibleOutputs).toBe(Number.MAX_SAFE_INTEGER);
    expect(preview.tierDue).toBe(4503599627370496);
    expect(typeof preview.ledger.paidMilestones).toBe('number');
    const before = JSON.stringify(preview.ledger);
    expect(() => previewAlchemyAdvance(preview.ledger, 1)).toThrow(/unsafe result/);
    expect(JSON.stringify(preview.ledger)).toBe(before);
    const longest = newAlchemyLedger(Number.MAX_SAFE_INTEGER);
    expect(previewAlchemyAdvance(longest, Number.MAX_SAFE_INTEGER).tierDue).toBe(1);
  });

  it('rejects invalid input instead of repairing or silently reinterpreting progress', () => {
    for (const interval of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => newAlchemyLedger(interval)).toThrow(/Alchemy ledger/);
    }
    for (const history of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => migrateAlchemyLedger(history, 7)).toThrow(/legacy salvage/);
    }
    const valid = newAlchemyLedger(7);
    for (const outputs of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => previewAlchemyAdvance(valid, outputs)).toThrow(/output advance/);
    }
    const malformed: unknown[] = [null, {}, { ...valid, version: 2 }, { ...valid, legacyInterval: 1000 },
      { ...valid, legacyRemainder: 500 }, { ...valid, legacyRemainder: -1 },
      { ...valid, eligibleOutputs: Infinity }, { ...valid, paidMilestones: 1 }, { ...valid, interval: 0 }];
    for (const saved of malformed) expect(() => normalizeAlchemyLedger(saved, 7)).toThrow(/Alchemy ledger/);
    expect(() => previewAlchemyAdvance({ ...valid, paidMilestones: 1 } as AlchemyLedger, 1)).toThrow(/exceed earned/);
  });

  it('reads progress toward the next Tier stone exactly, without mutating the ledger', () => {
    const fresh = newAlchemyLedger(500);
    expect(alchemyTierProgress(fresh)).toEqual({ paid: 0, outputsToNext: 500, interval: 500 });
    let current = fresh;
    for (let i = 0; i < 499; i++) current = previewAlchemyAdvance(current, 1).ledger;
    expect(alchemyTierProgress(current)).toEqual({ paid: 0, outputsToNext: 1, interval: 500 });
    const paid = previewAlchemyAdvance(current, 1).ledger;
    expect(alchemyTierProgress(paid)).toEqual({ paid: 1, outputsToNext: 500, interval: 500 });
    // legacy fractional credit shortens the first milestone by exactly the carried remainder
    expect(alchemyTierProgress(migrateAlchemyLedger(234, 500)).outputsToNext).toBe(266);
    // a retuned ledger reports its own snapshotted interval, and the read never writes
    expect(alchemyTierProgress(newAlchemyLedger(400)).outputsToNext).toBe(400);
    const before = JSON.stringify(current);
    alchemyTierProgress(current);
    expect(JSON.stringify(current)).toBe(before);
    expect(() => alchemyTierProgress({ ...fresh, version: 2 } as unknown as AlchemyLedger)).toThrow(/Alchemy ledger/);
  });
});
