import { expect, it, vi } from 'vitest';
import { newGame } from '@sim/core/game';
import * as guide from '@sim/core/tree-guide';
import { applyJourneyPolicy, journeyStateKey, newJourneyMemory } from '../../measurements/release-journey';

it('reuses an exhausted tree search and invalidates every recommendation input without changing policy results', () => {
  const cached = newGame(20261103);
  cached.player.treePoints = 1;
  let eager = structuredClone(cached);
  const cachedMemory = newJourneyMemory(cached);
  const eagerMemory = newJourneyMemory(eager);
  const spy = vi.spyOn(guide, 'recommendTreeNodes');
  const changes = [
    () => {},
    () => { cached.clockSec++; cached.player.hp--; },
    () => { cached.player.treePoints += 4; },
    () => { cached.player.attainmentPoints = (cached.player.attainmentPoints ?? 0) + 1; },
    () => { cached.skills.owned['attack.fireball'] = 0; },
    () => { cached.mastery['bow'] = 1; },
    () => { cached.gear[0] = { slot: 'main hand', base: 'bow', ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] }; },
    () => { cached.gear[0]!.broken = true; },
    () => { cached.player.treeRanks = {}; },
  ];
  try {
    for (const [index, change] of changes.entries()) {
      change();
      eager = structuredClone(cached);
      Object.assign(eagerMemory, structuredClone(cachedMemory));
      spy.mockClear();
      applyJourneyPolicy(cached, cachedMemory);
      const cachedCalls = spy.mock.calls.length;
      if (index === 1) expect(cachedCalls).toBe(0);
      spy.mockClear();
      applyJourneyPolicy(eager, eagerMemory);
      expect(journeyStateKey(cached)).toBe(journeyStateKey(eager));
      expect(cachedMemory).toEqual(eagerMemory);
      if (index > 1 && index < 8 && (cached.player.treePoints > 0 || (cached.player.attainmentPoints ?? 0) > 0)) {
        expect(cachedCalls, `changed input ${index}`).toBeGreaterThan(0);
      }
    }
  } finally { spy.mockRestore(); }
});
