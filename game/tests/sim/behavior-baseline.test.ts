import { describe, expect, it } from 'vitest';
import { characterSheet, tick } from '@sim/core/game';
import { seededEncounter } from '../fixtures/encounter';

/**
 * P5 behavior baseline. The numbers are evidence for the next balance pass, not a tuning gate:
 * the test asserts only that a run is finite and its rewards never go negative. Kill throughput,
 * damage taken, mana pressure and uptime are reported so a later change can compare like with like.
 */
describe('P5 baseline — behavior roles on the shipped field', () => {
  it('reports the authored fixture after roles, retreat and phase adds', () => {
    const encounter = seededEncounter({ seed: 811, bodies: 8, zone: 3, skills: ['attack.firestorm'] });
    const state = encounter.state;
    state.skills.list[0] = 'attack.firestorm';
    const startMana = characterSheet(state).maxMana;
    let manaLow = startMana;
    let taken = 0;
    let seconds = 0;
    const startKills = state.counters.kills;
    for (let index = 0; index < 30; index++) {
      // The fixture keeps the character alive so a role change is measured, not a push loop.
      state.player.hp = characterSheet(state).maxHp;
      state.player.mana = characterSheet(state).maxMana;
      const hpBefore = state.player.hp;
      tick(state, { online: true, arena: encounter.arena });
      seconds++;
      if (state.player.hp < hpBefore) taken += hpBefore - state.player.hp;
      manaLow = Math.min(manaLow, state.player.mana);
    }
    const kills = state.counters.kills - startKills;
    const living = state.group.filter((mob) => mob.hp > 0).length;
    console.log(`[P5 baseline] sec=${seconds} kills=${kills} living=${living} taken=${Math.round(taken)}`
      + ` manaLow=${Math.round(manaLow)}/${Math.round(startMana)} pushes=${state.counters.pushes}`
      + ` phaseAdds=${state.group.filter((mob) => mob.addedBy).length}`);
    expect(Number.isFinite(state.player.hp)).toBe(true);
    expect(state.player.hp).toBeGreaterThan(0);
    expect(kills).toBeGreaterThanOrEqual(0);
    expect(state.counters.gold).toBeGreaterThanOrEqual(0);
    expect(state.player.mana).toBeGreaterThanOrEqual(-Math.abs(startMana) - 1);
  });
});
