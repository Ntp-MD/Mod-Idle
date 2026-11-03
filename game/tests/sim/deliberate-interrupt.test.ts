import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';

/** F24 — a deliberate interrupt owns its lane: procs cannot eat a cooldown-gated stop. */
function duel(seed: number) {
  const state = newGame(seed);
  setLevel(state, 60);
  state.hunting = true;
  state.player.hp = 1e9;
  state.skills.owned['attack.glacial_spike'] = 0;
  const rng = mulberry32(seed);
  const mob = spawnMob(rng, 1, 'normal');
  Object.assign(mob, {
    id: 'duel-target', hp: 1e6, hpMax: 1e6, ps: 0, accuracy: 0, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: [],
  });
  state.group = [mob];
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 9.5, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 10, y: 6 });
  arena.focusId = mob.id;
  pinFieldPopulation(state);
  return { state, arena, mob };
}

function saturate(mark: { stoppedSec: number; deliberateSec?: number; elapsedSec: number }, lane: 'proc' | 'deliberate') {
  mark.elapsedSec = 1000;
  if (lane === 'proc') mark.stoppedSec = 999;
  else mark.deliberateSec = 999;
}

function castOnce(state: ReturnType<typeof newGame>, arena: ReturnType<typeof createCombatArena>, ticks = 6) {
  for (let i = 0; i < ticks; i++) {
    state.player.mana = characterSheet(state).maxMana;
    tick(state, { arena, manual: { cast: { skillId: 'attack.glacial_spike' } }, autoSkills: false });
  }
}

describe('F24 deliberate interrupt — its own lane, with a refusal reason', () => {
  it('lands the stop while the proc budget is saturated', () => {
    const { state, arena, mob } = duel(601);
    const mark = state.mobStatus[mob.id] ??= { statuses: {}, alignedPerSec: 0, stoppedSec: 0, elapsedSec: 0 };
    saturate(mark, 'proc');
    castOnce(state, arena);
    // The stop was written (stoppedUntil set past the pre-fight clock) despite the saturated
    // proc budget — and nothing refused it.
    expect(mark.stoppedUntil ?? 0).toBeGreaterThan(1000);
    expect(state.log.some((l) => l.text.includes('resists the stop'))).toBe(false);
  });

  it('refuses with a named reason only when its own lane is spent', () => {
    const { state, arena, mob } = duel(602);
    const mark = state.mobStatus[mob.id] ??= { statuses: {}, alignedPerSec: 0, stoppedSec: 0, elapsedSec: 0 };
    saturate(mark, 'deliberate');
    castOnce(state, arena);
    expect(state.log.some((l) => l.text.includes('resists the stop'))).toBe(true);
  });
});
