import { describe, expect, it } from 'vitest';
import { sm, tree } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { characterSheet, newGame } from '../src/sim/game';
import {
  NO_COND, buffRecastCost, castOnce, newSkillState, rotationOrder, skillEligibility,
  skillEligibilityInState, usableMana,
} from '../src/sim/skills';
import { mobFixture } from './mobFixture';

const id = 'attack.cleave';
const character = { ...buildCharacter(90, emptyGear()), weaponName: 'one-handed axe' };
const group = () => [mobFixture({ id: 'm1', kind: 'Medium', level: 90, ps: 600, acc: 900 })];
const state = () => {
  const skills = newSkillState();
  skills.owned[id] = 0;
  skills.list[0] = id;
  return skills;
};

describe('shared skill eligibility and rotation', () => {
  it('reports snapshot eligibility without touching skill state, target HP or RNG', () => {
    const skills = state();
    const mobs = group();
    const before = JSON.stringify({ skills, mobs });
    expect(skillEligibility(skills, character, id, character.maxMana, mobs, {}).ready).toBe(true);
    expect(JSON.stringify({ skills, mobs })).toBe(before);
    const cast = castOnce(skills, character, character.maxMana, mobs, {}, mulberry32(7));
    expect(cast?.id).toBe(id);
    expect(skills.cd[id]).toBeGreaterThan(0);
  });

  it('distinguishes no target and Auto Skills disabled from combat readiness', () => {
    const skills = state();
    expect(skillEligibility(skills, character, id, character.maxMana, [], {}).reason).toBe('no-target');
    expect(skillEligibility(skills, character, id, character.maxMana, group(), {}, { autoSkills: false }).reason).toBe('auto-off');
    expect(castOnce(skills, character, character.maxMana, [], {}, mulberry32(7))).toBeNull();
  });

  it('rejects unknown, unowned, incompatible, cooling and silenced skills', () => {
    const skills = state();
    const read = (skillId = id, c = character) => skillEligibility(skills, c, skillId, c.maxMana, group(), {});
    expect(read('unknown.skill').reason).toBe('unowned');
    delete skills.owned[id];
    expect(read().reason).toBe('unowned');
    skills.owned[id] = 0;
    const bow = sm.all().find((row) => row.weapon === 'bow')!;
    skills.owned[bow.id] = 0;
    expect(read(bow.id).reason).toBe('weapon');
    skills.cd[id] = 2.5;
    expect(read().reason).toBe('cooldown');
    skills.cd[id] = 0;
    skills.mode[id] = 'never';
    expect(read().reason).toBe('silenced');
  });

  it('uses OR triggers while the usable-Mana floor can only hold a cast back', () => {
    const skills = state();
    skills.mode[id] = 'conditional';
    skills.conditions[id] = { ...NO_COND, boss: true, hpBelowPct: 50, manaFloorPct: 1 };
    const read = (missingHpPct: number) => skillEligibility(skills, character, id, character.maxMana, group(), {}, { missingHpPct });
    expect(read(20).reason).toBe('conditions');
    expect(read(60).ready).toBe(true);
    skills.conditions[id].manaFloorPct = 100;
    expect(read(60).reason).toBe('mana-floor');
    expect(castOnce(skills, character, character.maxMana, group(), {}, mulberry32(7), { missingHpPct: 60 })).toBeNull();
    skills.conditions[id] = { ...NO_COND, manaFloorPct: 1 };
    expect(read(60).reason).toBe('conditions');
  });

  it('quotes the same AoE resource payment castOnce actually makes', () => {
    const skills = state();
    const mobs = [group()[0], { ...group()[0], id: 'm2' }];
    const read = skillEligibility(skills, character, id, character.maxMana, mobs, {});
    expect(read.aoe).toBe(true);
    const cast = castOnce(skills, character, character.maxMana, mobs, {}, mulberry32(7))!;
    expect(cast.manaCost).toBe(read.manaCost);
    expect(cast.hpCost).toBe(read.hpCost);
    expect(skillEligibility(state(), character, id, 0, group(), {}).reason).toBe('mana');
  });

  it('Single Combat removes the AoE price in both explanation and payment', () => {
    const skills = state();
    const c = { ...character, keystones: tree.keystoneBundles({ 'keystone.single-combat': 1 }) };
    const mobs = [group()[0], { ...group()[0], id: 'm2' }];
    const read = skillEligibility(skills, c, id, c.maxMana, mobs, {});
    expect(read.aoe).toBe(false);
    expect(read.manaCost).toBeLessThan(skillEligibility(skills, character, id, character.maxMana, mobs, {}).manaCost);
    expect(castOnce(skills, c, c.maxMana, mobs, {}, mulberry32(7))?.manaCost).toBe(read.manaCost);
  });

  it('Blood Price costs HP atomically and protects the final HP point', () => {
    const skills = state();
    const c = { ...character, keystones: tree.keystoneBundles({ 'keystone.blood-price': 1 }) };
    const read = skillEligibility(skills, c, id, 0, group(), {}, { currentHp: c.maxHp });
    expect(read.manaCost).toBe(0);
    expect(read.hpCost).toBeGreaterThan(0);
    expect(skillEligibility(skills, c, id, 0, group(), {}, { currentHp: read.hpCost }).reason).toBe('hp');
    const cast = castOnce(skills, c, 0, group(), {}, mulberry32(7), { currentHp: read.hpCost + 1 })!;
    expect(cast.hpCost).toBe(read.hpCost);
    expect(cast.manaCost).toBe(0);
  });

  it('Mana Debt exposes repayment separately from an unaffordable borrow', () => {
    const skills = state();
    const c = { ...character, maxMana: 10000, keystones: tree.keystoneBundles({ 'keystone.mana-debt': 1 }) };
    expect(skillEligibility(skills, c, id, -1, group(), {}).reason).toBe('mana-debt');
    expect(skillEligibility(skills, c, id, 0, group(), {}).ready).toBe(true);
    const noRoom = { ...c, maxMana: 1 };
    expect(skillEligibility(skills, noRoom, id, 0, group(), {}).reason).toBe('mana');
  });

  it('the state adapter includes reservations and the next Trance free cast without live writes', () => {
    const game = newGame(99);
    game.skills = state();
    game.group = group();
    game.player.treeRanks = { 'keystone.trance': 1 };
    const c = { ...characterSheet(game), weaponName: character.weaponName };
    const trance = c.keystones.find((bundle) => bundle.key === 'trance')!;
    game.keystoneRuntime.counters.tranceCasts = Number(trance.params.everyCasts) - 1;
    game.player.mana = 0;
    const before = JSON.stringify(game);
    expect(skillEligibilityInState(game, c, id)).toMatchObject({ ready: true, manaCost: 0, hpCost: 0 });
    expect(skillEligibilityInState(game, c, id, false).reason).toBe('auto-off');
    expect(JSON.stringify(game)).toBe(before);
    game.player.treeRanks = {};
    game.skills.owned['aura.clarity'] = 0;
    game.skills.auras['aura.clarity'] = true;
    const normal = { ...characterSheet(game), weaponName: character.weaponName };
    game.player.mana = normal.maxMana - usableMana(normal, game.skills);
    expect(skillEligibilityInState(game, normal, id).reason).toBe('mana');
  });

  it('keeps timed skills in slot order while checking every filler last', () => {
    const skills = state();
    // A fixture checks the filler rule even when the current roster has no zero-cooldown attack.
    const filler = { ...sm.byId[id], id: 'test.filler', cd: 0 };
    const timed = sm.all().find((row) => row.id !== id && (row.cd || 0) > 0 && row.type === 'attack')!;
    sm.byId[filler.id] = filler;
    try {
      for (const row of [filler, timed]) skills.owned[row.id] = 0;
      skills.list.splice(0, 3, filler.id, id, timed.id);
      expect(rotationOrder(skills)).toEqual([id, timed.id, filler.id]);
    } finally { delete sm.byId[filler.id]; }
  });

  it('holds snapshot readiness during a fully stopped Shock step and respects Unstoppable', () => {
    const game = newGame(100);
    game.skills = state();
    game.group = group();
    const c = { ...characterSheet(game), weaponName: character.weaponName };
    game.playerStatuses.shock = { stacks: 1, secLeft: 2, perSec: 0 };
    const before = JSON.stringify(game);
    expect(skillEligibilityInState(game, c, id)).toMatchObject({ ready: false, reason: 'shock' });
    expect(JSON.stringify(game)).toBe(before);
    const unstoppable = { ...c, keystones: tree.keystoneBundles({ 'keystone.unstoppable': 1 }) };
    expect(skillEligibilityInState(game, unstoppable, id).ready).toBe(true);
    game.playerStatuses.shock.secLeft = .5;
    expect(skillEligibilityInState(game, c, id).ready).toBe(true);
  });

  it('quotes the buff track base price while a Trance rotation press is free', () => {
    const skills = newSkillState();
    const buff = sm.all().find(row => row.type === 'buff' && sm.costOf(row, { skillLevel: 1, aoe: false }).resource === 'mana')!;
    skills.owned[buff.id] = 0;
    const c = { ...character, keystones: tree.keystoneBundles({ 'keystone.trance': 1 }) };
    const base = sm.costOf(buff, { skillLevel: 1, aoe: false });
    expect(base.amount).toBeGreaterThan(0);
    expect(buffRecastCost(skills, c, buff.id)).toEqual(base);
    expect(skillEligibility(skills, c, buff.id, c.maxMana, group(), {}, { freeCast: true }).manaCost).toBe(0);
    const blood = { ...c, keystones: tree.keystoneBundles({ 'keystone.trance': 1, 'keystone.blood-price': 1 }) };
    const hpCost = buffRecastCost(skills, blood, buff.id);
    expect(hpCost.resource).toBe('hp');
    expect(hpCost.amount).toBeGreaterThan(0);
  });
});
