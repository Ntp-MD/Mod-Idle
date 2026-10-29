import { describe, expect, it } from 'vitest';
import { characterSheet, stepCombat, tick } from '@sim/core/game';
import { seededEncounter, encounterSignature } from '../fixtures/encounter';

const COMMAND_AT_WALL_SEC = 0.25;
const BUDGET_SEC = 0.1;
const STEP_SEC = 0.05;

/**
 * Drives the shipped 50 ms combat driver and reports how long a command issued between two wakes
 * waits before the sim judges it. The receipt carries the combat second it was accepted in, so the
 * measurement is the sim's own clock rather than a test stopwatch.
 */
function measureCommandLatency(): number {
  const encounter = seededEncounter({ seed: 61, bodies: 4 });
  encounter.run(1);
  const { state, arena } = encounter;
  // The arena's clock is absolute, so the first step's second is the origin of the wall timeline.
  const baseSec = state.clockSec;
  let issued = false;
  for (let wall = STEP_SEC; wall < 8; wall += STEP_SEC) {
    state.player.hp = 1e9;
    state.player.mana = characterSheet(state).maxMana;
    // The command lands just after a wake, the worst case for a step-driven intake.
    const manual = !issued && wall + 1e-9 >= COMMAND_AT_WALL_SEC + 0.001
      ? { moveTo: { x: arena.player.x, y: arena.player.y + 3 } }
      : undefined;
    if (manual) issued = true;
    stepCombat(state, { online: true, arena, ...(manual ? { manual } : {}) });
    const receipt = state.combatReceipts?.find((entry) => entry.command === 'move');
    if (receipt) return (receipt.atUs / arena.unitsPerSec) - baseSec - COMMAND_AT_WALL_SEC;
  }
  throw new Error('the move command was never consumed');
}

describe('P1 acceptance — command latency', () => {
  it('judges a command within the 100 ms budget on the 50 ms driver', () => {
    const latency = measureCommandLatency();
    console.log(`[P1 latency] command @${COMMAND_AT_WALL_SEC}s -> judged +${(latency * 1000).toFixed(0)} ms (budget ${BUDGET_SEC * 1000} ms)`);
    expect(latency).toBeLessThanOrEqual(BUDGET_SEC);
  });

  it('keeps the same timeline whether a second runs in one call or in twenty steps', () => {
    const whole = seededEncounter({ seed: 72, bodies: 4, skills: ['attack.fireball'] });
    const split = seededEncounter({ seed: 72, bodies: 4, skills: ['attack.fireball'] });
    for (let second = 0; second < 4; second++) {
      whole.state.player.hp = 1e9;
      whole.state.player.mana = characterSheet(whole.state).maxMana;
      tick(whole.state, { online: true, arena: whole.arena });
      for (let step = 0; step < 20; step++) {
        split.state.player.hp = 1e9;
        split.state.player.mana = characterSheet(split.state).maxMana;
        stepCombat(split.state, { online: true, arena: split.arena });
      }
    }
    expect(encounterSignature(split)).toBe(encounterSignature(whole));
    // The world/economy driver still advances once per second: twenty steps must not pay play
    // time, town work or regen twenty times.
    expect(split.state.clockSec).toBe(whole.state.clockSec);
    expect(split.state.counters.playSec).toBe(whole.state.counters.playSec);
    expect(split.state.player.xp).toBe(whole.state.player.xp);
    expect(split.state.counters.kills).toBe(whole.state.counters.kills);
  });
});
