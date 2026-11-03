import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { characterSheet, newGame } from '@sim/core/game';
import { castOnce, newSkillState, rotationOrder, skillEligibility } from '@sim/combat/skills';
import { approachStopRange, selectCombatIntent } from '@sim/combat/combat-actions';
import { advanceCombatArena, arenaDistance, arenaTarget, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { mobFixture } from '../fixtures/mobFixture';
import { installSyntheticSkill } from '../fixtures/skillFixture';

const TUNED = 'test.timed-control';
let restoreTuned: (() => void) | undefined;
beforeAll(() => {
  restoreTuned = installSyntheticSkill(TUNED, { name: 'Fixture timed row',
    group: 'all', area: { origin: 'target', radius_m: 2.1, shape: 'cone', angle_deg: 120, max_targets: 2 },
    cast: { delivery: 'melee', range_m: 2.1, windup_sec: 0.25, recovery_sec: 0.22 },
    cd: 6, mana: '15 flat' }).restore;
});
afterAll(() => { restoreTuned?.(); });
const character = { ...buildCharacter(90, emptyGear()), weaponName: 'one-handed axe' };
const group = () => [mobFixture({ id: 'm1', kind: 'Medium', level: 90, ps: 600, acc: 900 })];

function state() {
  const skills = newSkillState();
  skills.owned[TUNED] = 0;
  skills.list[0] = TUNED;
  return skills;
}

/** A zero-cooldown fixture row matching the tuned row's weapon fit, installed per use. */
function withFiller<T>(run: (fillerId: string) => T): T {
  const installed = installSyntheticSkill('test.filler', { name: 'Fixture Filler',
    group: 'all', cd: 0, mana: '10 flat',
    area: { origin: 'target', radius_m: 2.1, shape: 'cone', angle_deg: 120, max_targets: 2 },
    cast: { delivery: 'melee', range_m: 2.1, windup_sec: 0.25, recovery_sec: 0.22 } });
  try {
    return run(installed.row.id);
  } finally {
    installed.restore();
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

  it('honours a player auto override before the authored row flag', () => {
    const skills = state();
    skills.autoMode = { [TUNED]: 'manual' };
    const row = sm.byId[TUNED];
    expect(row.auto).toBeUndefined();
    expect(skillEligibility(skills, character, TUNED, character.maxMana, group(), {}).reason)
      .toBe('manual-only');
    // A manual press still bypasses the auto gate.
    expect(skillEligibility(skills, character, TUNED, character.maxMana, group(), {}, {
      ignoreConditions: true,
    }).ready).toBe(true);
    skills.autoMode[TUNED] = 'both';
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
      expect(held.detail).toContain(sm.byId[TUNED].name);

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

  it('holds position without an auto approach, while a normal stance closes', () => {
    const game = newGame(413);
    const mob = mobFixture({ id: 'm1', hp: 1e9, hpMax: 1e9, innate: [], skillIds: [], hitsPerSec: 0 });
    game.group = [mob];
    const arena = createCombatArena();
    syncCombatArena(arena, game, 0, 1_000_000, characterSheet(game).maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign(arena.mobs[mob.id], { x: 10, y: 6 });
    const options = {
      playerRange: 0, playerSpeedMult: 1, mobSpeedMult: () => 0,
      playerTargetId: mob.id, engagedIds: new Set([mob.id]),
    };
    advanceCombatArena(arena, game, 1_000_000, { ...options, holdPosition: true });
    expect(arena.player.x).toBeCloseTo(1, 6);
    advanceCombatArena(arena, game, 2_000_000, options);
    expect(arenaDistance(arena.player, arena.mobs[mob.id])).toBeLessThan(9);
  });

  it('orders automatic target choice by nearest, lowest HP, or highest HP', () => {
    const game = newGame(412);
    game.group = [
      mobFixture({ id: 'near', hp: 80, hpMax: 100 }),
      mobFixture({ id: 'low', hp: 20, hpMax: 100 }),
      mobFixture({ id: 'high', hp: 100, hpMax: 100 }),
    ];
    const arena = createCombatArena();
    syncCombatArena(arena, game, 0, 1_000_000, characterSheet(game).maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign(arena.mobs.near, { x: 2, y: 6 });
    Object.assign(arena.mobs.low, { x: 8, y: 6 });
    Object.assign(arena.mobs.high, { x: 9, y: 6 });
    expect(arenaTarget(arena, game.group)?.id).toBe('near');
    arena.targetPriority = 'lowest-hp';
    expect(arenaTarget(arena, game.group)?.id).toBe('low');
    arena.targetPriority = 'highest-hp';
    expect(arenaTarget(arena, game.group)?.id).toBe('high');
  });

  it('keeps the held approach range until a fresh row stops a clear band closer', () => {
    expect(approachStopRange({ range: 5, valid: true }, 4.98, 2.1, 0.06)).toBe(5);
    expect(approachStopRange({ range: 5, valid: true }, 5.4, 2.1, 0.06)).toBe(5);
    expect(approachStopRange({ range: 5, valid: true }, 4.9, 2.1, 0.06)).toBe(4.9);
    expect(approachStopRange({ range: 5, valid: true }, undefined, 2.1, 0.06)).toBe(5);
    expect(approachStopRange({ range: 5, valid: false }, 4.9, 2.1, 0.06)).toBe(4.9);
    expect(approachStopRange(undefined, undefined, 2.1, 0.06)).toBe(2.1);
  });

  it('keeps a held row against a now row within the band and switches when it is a band closer', () => {
    const circle = installSyntheticSkill('test.circle', { name: 'Fixture Circle',
      group: 'all', area: { origin: 'target', radius_m: 0.05 }, cast: { delivery: 'instant', range_m: 5 } });
    const single = installSyntheticSkill('test.single', { name: 'Fixture Single',
      group: 'all', area: { origin: 'target', radius_m: 0 }, cast: { delivery: 'instant', range_m: 5 } });
    const circleId = circle.row.id;
    const singleId = single.row.id;
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
      circle.restore();
      single.restore();
    }
  });
});
