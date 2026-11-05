import { expect, it } from 'vitest';
import { canonical, hashFiles, sha256, summaryStatus } from '../../../tools/lib/measurement-output.mjs';

it('keeps stable key order and rejects nonfinite values', () => {
  const a = { b: 1, a: 2, nested: { d: 4, c: 3 } };
  const b = { a: 2, nested: { c: 3, d: 4 }, b: 1 };
  expect(canonical(a)).toEqual(canonical(b));
  expect(() => canonical({ value: Number.NaN })).toThrow(/nonfinite/);
  expect(() => canonical({ value: Number.POSITIVE_INFINITY })).toThrow(/nonfinite/);
});

it('changes the digest when an HP/mana/status/RNG/action field changes', () => {
  const base = { hp: 100, mana: 50, status: 'ready', rng: 42, action: 'hit' };
  const variants = [
    { ...base, hp: 99 },
    { ...base, mana: 49 },
    { ...base, status: 'hit' },
    { ...base, rng: 43 },
    { ...base, action: 'miss' },
  ];
  const digests = new Set([sha256(base)]);
  for (const variant of variants) digests.add(sha256(variant));
  expect(digests.size).toBe(variants.length + 1);
});

it('does not change the digest for a wall-clock save stamp', () => {
  const saved = { state: { hp: 10 }, lastSavedAt: 1700000000000 };
  const { lastSavedAt: _ignored, ...rest } = saved;
  const resaved = { state: { hp: 10 }, lastSavedAt: 1700000060000 };
  const { lastSavedAt: _ignored2, ...rest2 } = resaved;
  expect(sha256(rest)).toBe(sha256(rest2));
});

it('changes the digest when an array order changes', () => {
  expect(sha256({ order: [1, 2] })).not.toBe(sha256({ order: [2, 1] }));
});

it('computes FAIL over INCOMPLETE over PASS summary status', () => {
  const run = { status: 'PASS', checks: [] };
  const incomplete = { ...run, status: 'INCOMPLETE' };
  const failed = { ...run, status: 'FAIL' };
  expect(summaryStatus([run])).toEqual({ status: 'PASS', counts: { pass: 1, fail: 0, incomplete: 0, pendingWatches: 0 } });
  expect(summaryStatus([run, incomplete]).status).toBe('INCOMPLETE');
  expect(summaryStatus([incomplete, failed]).status).toBe('FAIL');
  expect(summaryStatus([{ ...run, checks: [{ id: 'x', verdict: 'PENDING', detail: '' }] }]).counts.pendingWatches).toBe(1);
});

it('hashes files deterministically across order and path separators', () => {
  const a = hashFiles(['tools/lib/measurement-output.mjs']);
  const b = hashFiles(['tools/lib/measurement-output.mjs', 'tools/lib/measurement-output.mjs']);
  expect(a).toBe(b);
  expect(a).toMatch(/^[0-9a-f]{64}$/);
});
