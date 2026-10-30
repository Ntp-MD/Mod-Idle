import { describe, expect, it } from 'vitest';
import { loot } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { arenaDistance, arenaWeaponRange, captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';

/** The first-release release proof: the same spatial loop carries all three archetypes. */
function encounter(weaponName: string, skillId?: string, distance = 14) {
  const state = newGame(91);
  setLevel(state, 30);
  state.hunting = true;
  const mainHand = loot.SLOTS.findIndex((slot: string) => slot === 'main hand');
  state.gear[mainHand] = { slot: 'main hand', base: weaponName, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] } as never;
  state.skills.list.fill(null);
  if (skillId) { state.skills.owned[skillId] = 0; state.skills.list[0] = skillId; }
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'proof-target', hp: 1e9, hpMax: 1e9, ps: 0, accuracy: 0, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
  });
  state.group = [mob];
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 1 + distance, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  return { state, mob, arena };
}

describe('first-release combat acceptance', () => {
  it('scopes a mob aura to the canonical four-meter local radius', () => {
    const state = newGame(55);
    setLevel(state, 30);
    state.hunting = true;
      const bodies = ['source', 'inside', 'outside'].map((id, index) => {
      const mob = spawnMob(mulberry32(60 + index), 1, 'normal');
      Object.assign(mob, {
        id, speciesId: 'wolf', hp: 1e8, hpMax: 1e8, ps: 1, evasion: 0, dodgeRate: 0,
        armour: 100, line: 'front', damage: 'physical', innate: [],
        skillIds: id === 'source' ? ['mob.earth.stone-guard'] : [],
      });
      return mob;
    });
    state.group = bodies;
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign(arena.mobs.source, { x: 3, y: 6 });
    Object.assign(arena.mobs.inside, { x: 6, y: 6 });
    Object.assign(arena.mobs.outside, { x: 8, y: 6 });
    captureCombatArena(arena, state, 0);
    pinFieldPopulation(state);
    tick(state, { arena, autoSkills: false });
    expect(bodies[1].effArmour).toBeCloseTo(125, 5);
    expect(bodies[2].effArmour).toBeCloseTo(100, 5);
  });

  it('demonstrates a melee, a ranged and a magic archetype through the shared arena', () => {
    const melee = encounter('one-handed sword');
    for (let index = 0; index < 8; index++) tick(melee.state, { arena: melee.arena, autoSkills: false });
    const meleeSwing = melee.arena.actions.find((action) => action.actorId === 'player' && action.kind === 'swing')!;
    expect(meleeSwing).toBeDefined();
    expect(melee.mob.hp).toBeLessThan(1e9);
    expect(arenaDistance({ x: meleeSwing.x, y: meleeSwing.y },
      { x: meleeSwing.targetX!, y: meleeSwing.targetY! }))
      .toBeLessThanOrEqual(arenaWeaponRange(characterSheet(melee.state).weaponName) + 1e-7);

    const ranged = encounter('bow');
    for (let index = 0; index < 8; index++) tick(ranged.state, { arena: ranged.arena, autoSkills: false });
    const bowSwing = ranged.arena.actions.find((action) => action.actorId === 'player' && action.kind === 'swing')!;
    expect(bowSwing).toBeDefined();
    // The ranged basic fires from its own weapon reach, not by walking into contact first.
    expect(arenaDistance({ x: bowSwing.x, y: bowSwing.y },
      { x: bowSwing.targetX!, y: bowSwing.targetY! }))
      .toBeLessThanOrEqual(arenaWeaponRange(characterSheet(ranged.state).weaponName) + 1e-7);
    expect(arenaWeaponRange('bow')).toBeGreaterThan(arenaWeaponRange('one-handed sword'));
    expect(ranged.mob.hp).toBeLessThan(1e9);

    const magic = encounter('staff', 'attack.fireball', 6);
    const mana = magic.state.player.mana;
    tick(magic.state, { arena: magic.arena });
    const cast = magic.arena.actions.find((action) => action.actorId === 'player' && action.skillId === 'attack.fireball');
    expect(cast).toBeDefined();
    expect(magic.state.player.mana).toBeLessThan(mana);
    expect(magic.state.skills.cd['attack.fireball']).toBeGreaterThan(0);
  });
});
