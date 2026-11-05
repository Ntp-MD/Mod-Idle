/**
 * Machine-readable evidence contract (plan P1). Types only: no Node/browser
 * side effects, so this module can be imported by the game, the measurement
 * runners and the comparison CLI. Extend through `schemaVersion` rather than
 * replacing fields silently.
 */

export type RunStatus = 'PASS' | 'FAIL' | 'INCOMPLETE';
export type Verdict = 'PASS' | 'FAIL' | 'PENDING';
export type WorkloadMode =
  | 'mechanic-probe'
  | 'simulation-benchmark'
  | 'controlled-build'
  | 'natural-journey'
  | 'browser-loading'
  | 'browser-scene';

export interface RunIdentity {
  schemaVersion: 1;
  tool: string;
  workloadVersion: number;
  commit: string;
  dirty: boolean;
  sourceHash: string;
  gameplayDataHash: string;
  workloadHash: string;
  environmentKey: string;
  environment: {
    node: string;
    platform: string;
    arch: string;
    cpuModel: string;
    browser: string | null;
    buildMode: string | null;
    viewport: { width: 1920; height: 1080; deviceScaleFactor: 1 } | null;
    cpuThrottle: number | null;
    networkProfile: string | null;
  };
}

export interface CaseCheck {
  id: string;
  verdict: Verdict;
  detail: string;
}

export interface CaseMetric {
  value: number | null;
  unit: string;
}

export interface FirstFailure {
  step: number;
  atUs: number;
  assertion: string;
  expected: unknown;
  actual: unknown;
}

export interface CaseResult {
  kind: 'case';
  caseId: string;
  mode: WorkloadMode;
  seed: number | null;
  status: RunStatus;
  completedSteps: number;
  simulatedUs: number;
  selectedIds: Record<string, string[]>;
  checks: CaseCheck[];
  metrics: Record<string, CaseMetric>;
  stateDigest: string | null;
  traceDigest: string | null;
  firstFailure: FirstFailure | null;
}

export interface RunRecord extends RunIdentity {
  kind: 'run';
}

export interface SummaryRecord {
  kind: 'summary';
  status: RunStatus;
  counts: {
    pass: number;
    fail: number;
    incomplete: number;
    pendingWatches: number;
  };
}

/** Arena projection fields included in exact state digests. */
export interface ArenaProjection {
  nowUs: number;
  player: unknown;
  mobs: unknown[];
  intent: unknown;
  actions: unknown[];
  flights: unknown[];
  channelTemplate: unknown;
  nav: unknown;
}
