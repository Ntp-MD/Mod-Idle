import { describe, expect, it } from 'vitest';
import { buildGameplayCases, runGameplayCase, runGameplayWorkload } from '../../measurements/gameplay-cases';

/**
 * The controlled workload is evidence, not a placeholder: it must enumerate stable case keys, run a
 * real state transition, fail an invalid source, report a truncated window as INCOMPLETE and replay
 * a seed identically.
 */
describe('controlled gameplay measurement', () => {
  it('enumerates the fixed smoke workload in numeric Zone/Subzone order', () => {
    const cases = buildGameplayCases('smoke');
    expect(cases.filter((c) => c.kind === 'field')).toHaveLength(15);
    expect(new Set(cases.map((c) => c.caseId)).size).toBe(cases.length);
    expect(cases.slice(0, 3).map((c) => c.caseId)).toEqual(['field:z01:s01', 'field:z01:s02', 'field:z01:s03']);
    expect(cases.some((c) => c.caseId === 'gather:zone:1:site:1:mine:isolated')).toBe(true);
    expect(cases.some((c) => c.caseId === 'gather:zone:7:site:3:fishing:isolated')).toBe(true);
    expect(cases.some((c) => c.caseId === 'special:z01:boss:goblin')).toBe(true);
  });

  it('executes a real field hunt with positive simulated time and a state transition', () => {
    const field = buildGameplayCases('smoke').find((c) => c.caseId === 'field:z01:s01')!;
    const result = runGameplayCase(field, 7, 30);
    expect(result.status).toBe('PASS');
    expect(result.simulatedUs).toBeGreaterThan(0);
    expect(result.completedSteps).toBeGreaterThan(0);
    expect(result.checks.find((c) => c.id === 'execution:positive-time')?.verdict).toBe('PASS');
    expect(result.checks.find((c) => c.id === 'state:transition')?.verdict).toBe('PASS');
    expect(result.metrics.kills.value).not.toBeNull();
  });

  it('fails an invalid placement/special reference instead of guessing', () => {
    const result = runGameplayCase(
      { caseId: 'special:z01:boss:nope', kind: 'special', zone: 1, rank: 'boss', species: 'nope', expectedSource: 'Not A Boss' },
      7,
      5,
    );
    expect(result.status).toBe('FAIL');
    expect(result.checks.find((c) => c.id === 'source:special')?.verdict).toBe('FAIL');
    expect(result.firstFailure?.assertion).toBe('source:special');
  });

  it('reports a deliberately truncated window as INCOMPLETE, never PASS', () => {
    const outcome = runGameplayWorkload({ preset: 'smoke', mode: 'controlled', seeds: [7], simSeconds: 5, maxWallMs: 1, truncateAfterMs: 0 });
    expect(outcome.cutoff).toBe(true);
    expect(outcome.missing.length).toBeGreaterThan(0);
    expect(outcome.cases.length).toBeLessThan(buildGameplayCases('smoke').length);
  });

  it('replays one seed to identical state and trace digests', () => {
    const field = buildGameplayCases('smoke').find((c) => c.caseId === 'field:z04:s02')!;
    const first = runGameplayCase(field, 7, 20);
    const second = runGameplayCase(field, 7, 20);
    expect(first.stateDigest).toBe(second.stateDigest);
    expect(first.traceDigest).toBe(second.traceDigest);
  });

  it('runs a resource site through the existing fieldwork owner', () => {
    const gather = buildGameplayCases('smoke').find((c) => c.caseId.endsWith(':mine:isolated'))!;
    const result = runGameplayCase(gather, 7, 300);
    expect(result.status).toBe('PASS');
    expect(result.metrics.completedCycles.value).toBeGreaterThan(0);
    expect(result.metrics.paidUnits.value).toBeGreaterThan(0);
  });
});
