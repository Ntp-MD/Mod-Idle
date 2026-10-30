import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { characterSheet, newGame } from '@sim/core/game';
import { castOnce, newSkillState, rotationOrder, skillEligibility } from '@sim/combat/skills';
import { approachStopRange, selectCombatIntent } from '@sim/combat/combat-actions';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { mobFixture } from '../fixtures/mobFixture';

const TUNED = 'attack.cleave';
const character = { ...buildCharacter(90, emptyGear()), weaponName: 'one-handed axe' };
const group = () => [mobFixture({ id: 'm1', kind: 'Medium', level: 90, ps: 600, acc: 900 })];

function state() {
  const skills = newSkillState();
  skills.owned[TUNED] = 0;
  skills.list[0] = TUNED;
  return skills;
}

/** A zero-cooldown fixture row cloned from the tuned row, so both fit the same weapon. */
function withFiller<T>(run: (fillerId: string) => T): T {
  const fillerId = 'test.filler';
  sm.byId[fillerId] = { ...sm.byId[TUNED], id: fillerId, name: 'Fixture Filler', cd: 0, mana: '10 flat' };
  try {
    return run(fillerId);
  } finally {
    delete sm.byId[fillerId];
  }
}

describe('auto combat controls', () => {
  it('keeps a manual-only row out of the rotation while a manual press still casts it', () => {
    const skills = state();
    const row = sm.byId[TUNED];
    row.auto = 'manual';
    try {
      expect(skillEligibility(skills, character, TUNED, character.maxMana, group(), {}).reason)
        .toBe('manual-only');
      // The manual bypass (intent-select) marks the press, and the row is still castable.
      expect(skillEligibility(skills, character, TUNED, character.maxMana, group(), {}, {
        ignoreConditions: true,
      }).ready).toBe(true);
      expect(rotationOrder(skills)).toContain(TUNED);
    } finally {
      delete row.auto;
    }
    expect(skillEligibility(skills, character, TUNED, character.maxMana, group(), {}).ready).toBe(true);
  });

  it('holds a filler only while waiting lets a higher-priority timed row be paid', () =>
    withFiller((fillerId) => {
      const skills = state();
      skills.owned[fillerId] = 0;
      skills.list.splice(0, 2, TUNED, fillerId);
      skills.cd[TUNED] = 2;
      for (const row of [TUNED, fillerId]) skills.mode[row] = 'always';

      // 11 Mana, 4/s regen, 2s to the timed row: waiting reaches 15, spending 10 now does not.
      const held = skillEligibility(skills, { ...character, manaRegen: 4 }, fillerId, 11, group(), {});
      expect(held).toMatchObject({ ready: false, reason: 'mana-reserve' });
      expect(held.detail).toContain('Cleave');

      // Spending now still leaves the timed row affordable.
      expect(skillEligibility(skills, { ...character, manaRegen: 4 }, fillerId, 30, group(), {}).ready)
        .toBe(true);
      // Regeneration can never reach the price: holding would starve the filler for good.
      expect(skillEligibility(skills, { ...character, manaRegen: 0.2 }, fillerId, 10, group(), {}).ready)
        .toBe(true);
      // Without regeneration the wait can never pay for the row.
      expect(skillEligibility(skills, { ...character, manaRegen: 0 }, fillerId, 11, group(), {}).ready)
        .toBe(true);

      // The offline rotation takes the same answer: no press while the reserve holds.
      const heldCast = castOnce(skills, { ...character, manaRegen: 4 }, 11, group(), {}, () => 0.5);
      expect(heldCast).toBeNull();
      // Once the timed row is ready the reserve lifts with it; the filler never starves it.
      skills.cd[TUNED] = 0;
      expect(castOnce(skills, { ...character, manaRegen: 4 }, 23, group(), {}, () => 0.5)?.id).toBe(TUNED);
    }));

  it('keeps the held approach range until a fresh row stops a clear band closer', () => {
    expect(approachStopRange({ range: 5, valid: true }, 4.98, 2.1, 0.06)).toBe(5);
    expect(approachStopRange({ range: 5, valid: true }, 5.4, 2.1, 0.06)).toBe(5);
    expect(approachStopRange({ range: 5, valid: true }, 4.9, 2.1, 0.06)).toBe(4.9);
    expect(approachStopRange({ range: 5, valid: true }, undefined, 2.1, 0.06)).toBe(5);
    expect(approachStopRange({ range: 5, valid: false }, 4.9, 2.1, 0.06)).toBe(4.9);
    expect(approachStopRange(undefined, undefined, 2.1, 0.06)).toBe(2.1);
  });

  it('keeps a held row against a now row within the band and switches when it is a band closer', () => {
    const circleId = 'test.circle';
    const singleId = 'test.single';
    sm.byId[circleId] = {
      ...structuredClone(sm.byId['attack.fireball']), id: circleId, name: 'Fixture Circle',
      area: { origin: 'target', radius_m: 0.05 }, cast: { delivery: 'instant', range_m: 5 },
    };
    sm.byId[singleId] = {
      ...structuredClone(sm.byId['attack.fireball']), id: singleId, name: 'Fixture Single',
      area: { origin: 'target', radius_m: 0 }, cast: { delivery: 'instant', range_m: 5 },
    };
    try {
      const game = newGame(411);
      game.group = ['near', 'held'].map((id) => mobFixture({
        id, hp: 1e9, hpMax: 1e9, innate: [], skillIds: [],
      }));
      game.skills.list = new Array(16).fill(null);
      game.skills.list[0] = circleId;
      game.skills.list[1] = singleId;
      for (const id of [circleId, singleId]) game.skills.owned[id] = 0;

      const arena = createCombatArena();
      syncCombatArena(arena, game, 0, 1_000_000, characterSheet(game).maxHp);
      Object.assign(arena.player, { x: 1, y: 6 });
      Object.assign(arena.mobs.near, { x: 4, y: 6 });
      Object.assign(arena.mobs.held, { x: 4.03, y: 6 });
      arena.intent = {
        skillId: singleId, targetId: 'held', targetPoint: { x: 4.03, y: 6 }, phase: 'approach',
      };
      const c = buildCharacter(100, emptyGear());

      // The higher-priority circle aims 0.03m closer than the held target — inside the band.
      expect(selectCombatIntent(arena, game, c, true)?.skillId).toBe(singleId);
      // A whole band closer: the now row takes the approach.
      Object.assign(arena.mobs.near, { x: 3.9, y: 6 });
      expect(selectCombatIntent(arena, game, c, true)?.skillId).toBe(circleId);
    } finally {
      delete sm.byId[circleId];
      delete sm.byId[singleId];
    }
  });
});
