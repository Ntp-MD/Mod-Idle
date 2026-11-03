/** Frame intervals are observed browser cadence, not CPU/GPU render durations. */
export interface ProofFrameTiming {
  sampleCount: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
}

/** Nearest-rank percentiles; an empty or invalid sample set has no result. */
export function summarizeProofFrameIntervals(intervals: readonly number[]): ProofFrameTiming {
  const values = intervals.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  const at = (percentile: number) => values[Math.ceil(values.length * percentile) - 1] ?? null;
  return { sampleCount: values.length, p50Ms: at(.5), p95Ms: at(.95), maxMs: values.at(-1) ?? null };
}

/** Reset the timestamp baseline when the document is hidden so background time isn't reported as a frame. */
export function createProofFrameSampler() {
  let last: number | undefined;
  const intervals: number[] = [];
  return {
    sample(timestampMs: number, visible: boolean) {
      if (!visible || !Number.isFinite(timestampMs)) { last = undefined; return; }
      if (last !== undefined && timestampMs > last) intervals.push(timestampMs - last);
      last = timestampMs;
    },
    report: () => summarizeProofFrameIntervals(intervals),
  };
}
