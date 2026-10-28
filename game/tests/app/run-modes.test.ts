import { describe, expect, it } from 'vitest';
import { renderLossDecision, resolveRunMode } from '../../src/app/run-modes';

describe('F32 run-mode matrix — every shell state has one answer', () => {
  it('runs live while visible, running and owning writes', () => {
    expect(resolveRunMode({ visible: true, running: true, paused: false, showcase: false, writer: true }))
      .toEqual({ mode: 'live', present: true, persistBoundary: false });
  });

  it('stays live when hidden: the wake banks, it never freezes the account', () => {
    expect(resolveRunMode({ visible: false, running: true, paused: false, showcase: false, writer: true }).mode)
      .toBe('live');
  });

  it('holds on pause, on stop and without the writer lock', () => {
    for (const condition of [
      { visible: true, running: true, paused: true, showcase: false, writer: true },
      { visible: true, running: false, paused: false, showcase: false, writer: true },
      { visible: true, running: true, paused: false, showcase: false, writer: false },
    ]) expect(resolveRunMode(condition).mode).toBe('held');
  });

  it('previews the showcase without touching the account', () => {
    expect(resolveRunMode({ visible: true, running: true, paused: false, showcase: true, writer: true }))
      .toEqual({ mode: 'preview', present: true, persistBoundary: false });
  });

  it('freezes presentation loss and persists the boundary first', () => {
    expect(renderLossDecision()).toEqual({ mode: 'held', present: false, persistBoundary: true });
  });
});
