import { describe, expect, it } from 'vitest';
import { createProofFrameSampler, summarizeProofFrameIntervals } from '../src/presentation/proof-frame-timing';

describe('proof frame timing', () => {
  it('uses nearest-rank percentiles and ignores invalid intervals', () => {
    const report = summarizeProofFrameIntervals([NaN, 0, -1, ...Array.from({ length: 20 }, (_, index) => index + 1)]);
    expect(report).toEqual({ sampleCount: 20, p50Ms: 10, p95Ms: 19, maxMs: 20 });
    expect(summarizeProofFrameIntervals([]).p95Ms).toBeNull();
  });

  it('does not include time spent hidden in the frame samples', () => {
    const sampler = createProofFrameSampler();
    sampler.sample(0, true);
    sampler.sample(16, true);
    sampler.sample(25, false);
    sampler.sample(10000, true);
    sampler.sample(10020, true);
    expect(sampler.report()).toEqual({ sampleCount: 2, p50Ms: 16, p95Ms: 20, maxMs: 20 });
  });
});
