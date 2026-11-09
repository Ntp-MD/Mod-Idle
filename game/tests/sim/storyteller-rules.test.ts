import { describe, expect, it } from 'vitest';
import { E, STORY, fieldwork } from '../../src/engine/client';
import { createFieldwork } from '../../../engine/fieldwork.ts';
import { storyHash32 } from '../../../engine/storyteller.ts';

const CFG = (E.fieldwork.camp_encounters as any);
const campSceneIds = new Set(STORY.scenes.filter((s) => s.source === 'camp').map((s) => s.id));

describe('storyteller hash (T-01)', () => {
  it('produces the FNV-1a vectors without state or RNG', () => {
    expect(storyHash32('')).toBe(2166136261);
    expect(storyHash32('courier')).toBe(2887494740);
    expect(storyHash32('courier')).toBe(storyHash32('courier'));
    expect(storyHash32('courier')).toBeGreaterThan(0);
  });
});

describe('camp pool validation (T-24)', () => {
  it('accepts the exact initial six-row catalog', () => {
    expect(() => fieldwork.validateCampPool(campSceneIds)).not.toThrow();
    expect(CFG.event_pool.map((r: any) => r.id)).toEqual([
      'camp-sounds', 'camp-prowler', 'camp-traveler', 'camp-nest', 'camp-discovered', 'camp-supply-cache',
    ]);
    expect(CFG.event_pool.map((r: any) => r.kind)).toEqual(['sounds', 'prowler', 'traveler', 'nest', 'discovered', 'supply-cache']);
    expect(CFG.event_pool.every((r: any) => r.weight === 1 && r.repeat_gap_events === 0)).toBe(true);
  });

  it('rejects duplicate, unknown, overflow, fractional and executable rows with path errors', () => {
    const base = structuredClone(CFG.event_pool);
    const attempt = (mutate: (pool: any[]) => void) => {
      const pool = structuredClone(base);
      mutate(pool);
      const fw = createFieldwork({ ...E.fieldwork, camp_encounters: { ...CFG, event_pool: pool } } as any);
      expect(() => fw.validateCampPool(campSceneIds)).toThrow(/camp\.event_pool/);
    };
    attempt((pool) => { pool[1].id = pool[0].id; });
    attempt((pool) => { pool[0].kind = 'unknown-kind'; });
    attempt((pool) => { pool[0].requires = ['unknown-requirement']; });
    attempt((pool) => { pool[0].scene_id = 'delivery-request'; });
    attempt((pool) => { pool[0].weight = 0; });
    attempt((pool) => { pool[0].weight = -1; });
    attempt((pool) => { pool[0].weight = Number.NaN; });
    attempt((pool) => { pool[0].repeat_gap_events = 1.5; });
    attempt((pool) => { pool[0].repeat_gap_events = CFG.story.recent_limit + 1; });
    attempt((pool) => { pool[0].command = 'grant'; });
    attempt((pool) => { pool[0].requires = []; });
  });
});

describe('eligibleCampPool (T-22, T-23, T-26)', () => {
  const F = {
    localMobs: true, travelerOffer: false, worksite: false, exposureThreshold: false, idleCache: true,
  };
  const eligible = (facts: any, history: any[] = [], nextSerial = 10) =>
    fieldwork.eligibleCampPool(facts, history, nextSerial);
  const eligibleFrom = (pool: any[], facts: any, history: any[], nextSerial: number, avoid = CFG.story.avoid_consecutive_kind) =>
    createFieldwork({
      ...E.fieldwork,
      camp_encounters: { ...CFG, event_pool: pool, kinds: CFG.kinds, story: { ...CFG.story, avoid_consecutive_kind: avoid } },
    } as any).eligibleCampPool(facts, history, nextSerial);

  it('retains legacy eligibility for equal weights', () => {
    // local-mobs only: sounds + prowler (same order as the old push-list)
    expect(eligible({ ...F, idleCache: false }).map((r: any) => r.kind)).toEqual(['sounds', 'prowler']);
    // idle only: supply-cache
    expect(eligible({ ...F, localMobs: false }).map((r: any) => r.kind)).toEqual(['supply-cache']);
  });

  it('for equal weights selects the same row as the old uniform index, one draw only', () => {
    const rows = eligible({ ...F, idleCache: false });
    for (const draw of [0, 0.24, 0.49, 0.5, 0.99]) {
      expect(fieldwork.selectCampPool(rows, draw)).toBe(rows[Math.floor(draw * rows.length)]);
    }
  });

  it('falls back to the oldest-seen row when every row is inside its gap, and never relaxes hard requirements', () => {
    const pool = structuredClone(CFG.event_pool).map((r: any) => ({ ...r, repeat_gap_events: 6 }));
    const history = pool.map((r: any, i: number) => ({ eventId: r.id, kind: r.kind, encounterId: i + 1 }));
    const facts = { localMobs: true, travelerOffer: true, worksite: true, exposureThreshold: true, idleCache: true };
    // nextSerial 7, gaps 6: every diff 1..6 is <= gap, so the preferred set is empty.
    const rows = eligibleFrom(pool, facts, history, 7, false);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: any) => {
      const last = history.find((h: any) => h.eventId === r.id);
      return last.encounterId === 1;
    })).toBe(true);
    // hard facts still gate: with no local mobs none of the mob rows return
    const gated = eligibleFrom(pool, { ...facts, localMobs: false }, history, 7, false);
    expect(gated.map((r: any) => r.kind)).not.toContain('sounds');
  });

  it('keeps a singleton selectable even when its gap excludes it', () => {
    const pool = structuredClone(CFG.event_pool).map((r: any) => ({ ...r, repeat_gap_events: 5 }));
    const only = [pool[0]];
    const history = [{ eventId: only[0].id, kind: only[0].kind, encounterId: 9 }];
    const rows = eligibleFrom(only, F, history, 10, false);
    expect(rows.map((r: any) => r.id)).toEqual([only[0].id]);
  });

  it('empty pool returns null and proposes no draw; invalid nonempty draw throws', () => {
    expect(fieldwork.selectCampPool([], 0.5)).toBeNull();
    const rows = eligible(F);
    expect(() => fieldwork.selectCampPool(rows, 1)).toThrow();
    expect(() => fieldwork.selectCampPool(rows, Number.NaN)).toThrow();
    expect(() => fieldwork.selectCampPool(rows, -0.1)).toThrow();
  });

  it('weighted boundaries use draw < cumulative / total', () => {
    const rows = eligible({ ...F, localMobs: true, idleCache: false });
    expect(fieldwork.selectCampPool(rows, 0)?.kind).toBe('sounds');
    expect(fieldwork.selectCampPool(rows, 0.5)?.kind).toBe('prowler');
    expect(fieldwork.selectCampPool(rows, 1 - Number.EPSILON)?.kind).toBe('prowler');
  });
});

describe('selectCampVariant', () => {
  it('is deterministic, avoids recent variants, and falls back to all when all recent', () => {
    const input = { seed: 7, serial: 3, eventId: 'camp-prowler', variantIds: ['prowler-edge-0', 'prowler-edge-1', 'prowler-edge-2'], recentIds: [] as string[] };
    const first = fieldwork.selectCampVariant(input);
    expect(fieldwork.selectCampVariant(input)).toBe(first);
    expect(input.variantIds).toContain(first);
    const filtered = fieldwork.selectCampVariant({ ...input, recentIds: [first] });
    expect(input.variantIds.filter((v) => v !== first)).toContain(filtered);
    expect(filtered).not.toBe(first);
    // all recent -> same deterministic choice (uses full list)
    expect(fieldwork.selectCampVariant({ ...input, recentIds: input.variantIds })).toBe(first);
  });
});

describe('cache helpers (T-03)', () => {
  const foodId = (E.fieldwork.regional_sources as Record<string, { food: string }>)[String(1)].food;
  it('draws gain / mixed / loss in table order at cumulative boundaries', () => {
    expect(fieldwork.cacheOffer(1, foodId, 0).quickOutcome).toBe('gain');
    expect(fieldwork.cacheOffer(1, foodId, 0.5).quickOutcome).toBe('mixed');
    expect(fieldwork.cacheOffer(1, foodId, 0.75).quickOutcome).toBe('loss');
    expect(fieldwork.cacheOffer(1, foodId, 1 - Number.EPSILON).quickOutcome).toBe('loss');
    expect(() => fieldwork.cacheOffer(1, foodId, 1)).toThrow();
    expect(() => fieldwork.cacheOffer(1, foodId, Number.NaN)).toThrow();
  });
  it('freezes unit yield and careful duration from canonical data', () => {
    const offer = fieldwork.cacheOffer(1, foodId, 0.1);
    expect(offer.unitYield).toBe((E.fieldwork.actions.mine as any).yield);
    expect(offer.carefulSec).toBe(Math.ceil(2 * (E.fieldwork.actions.mine as any).interval_sec));
    expect(offer.materialId).toBe('ore');
    expect(offer.foodId).toBe(foodId);
  });
  it('preview declares time, maximum food loss and all outcomes; result reports only the frozen outcome', () => {
    const offer = fieldwork.cacheOffer(1, foodId, 0.6); // mixed
    const preview = fieldwork.cachePreview(offer, 'quick');
    expect(preview.choice).toBe('quick');
    expect(preview.timeSec).toBe(0);
    expect(preview.maxFoodLoss).toBe(1);
    expect(preview.outcomes.map((o: any) => o.id)).toEqual(['gain', 'mixed', 'loss']);
    expect(preview.outcomes.reduce((sum: number, o: any) => sum + o.chance, 0)).toBeCloseTo(1);
    const result = fieldwork.cacheResult(offer, 'quick');
    expect(result.outcome).toBe('mixed');
    expect(result.materialCount).toBe(offer.unitYield * 1);
    expect(result.foodLoss).toBe(1);
    expect(result.sceneId).toBe('cache-mixed-result');
    const careful = fieldwork.cacheResult(offer, 'careful');
    expect(careful.outcome).toBe('careful');
    expect(careful.foodLoss).toBe(0);
    expect(careful.sceneId).toBe('cache-careful-result');
  });
  it('economic bound: cache rate never exceeds ordinary mining rate', () => {
    // CE-04 rate invariant from the plan §14.2
    const offer = fieldwork.cacheOffer(1, foodId, 0);
    const maxGrant = Math.max(...fieldwork.cachePreview(offer, 'quick').outcomes.map((o: any) => o.materialCount));
    const denom = Math.max(CFG.cooldown_sec, CFG.check_interval_sec);
    expect(maxGrant / denom).toBeLessThanOrEqual(
      (E.fieldwork.actions.mine as any).yield / (E.fieldwork.actions.mine as any).interval_sec,
    );
  });
});
