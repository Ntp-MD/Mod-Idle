import { describe, expect, it } from 'vitest';
import { E } from '../src/engine/client';
import { KEYSTONE_HANDLERS, registerStaticKeystoneHandlers, supportedKeystoneKeys } from '../src/sim/core/keystone-runtime';
import { autoCleanseReady, ghostDanceRecovery, shieldGateHolds } from '../../engine/keystones.ts';

registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys(E.elements.status_of));

describe('Packet J — reactive defenses', () => {
  it('23 Ghost Dance recovers 3% of Evasion capped at 10% Max ES', () => {
    expect(ghostDanceRecovery(1000, 200, { recoveryEvasionPct: 3, maxEsPerProcPct: 10 })).toBe(20);
    expect(ghostDanceRecovery(500, 1000, { recoveryEvasionPct: 3, maxEsPerProcPct: 10 })).toBe(15);
  });

  it('57 Shield Gate holds only when a non-empty ES is emptied', () => {
    expect(shieldGateHolds(50, 0, true)).toBe(true);
    expect(shieldGateHolds(0, 0, true)).toBe(false);
    expect(shieldGateHolds(50, 0, false)).toBe(false);
  });

  it('59 Auto Cleanse is ready only after its ICD', () => {
    expect(autoCleanseReady(0, 0)).toBe(true);
    expect(autoCleanseReady(6_000_000, 6_000_000)).toBe(true);
    expect(autoCleanseReady(5_999_999, 6_000_000)).toBe(false);
  });

  it('registers the thirty-six Packet E–J keys', () => {
    expect(supportedKeystoneKeys(KEYSTONE_HANDLERS)).toHaveLength(105);
  });
});
