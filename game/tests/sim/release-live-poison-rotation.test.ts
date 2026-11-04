import { expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { newMobStatusStore } from '@sim/combat/mobStatus';
import { newSkillState, prepareSkillCast, resolvePreparedCast } from '@sim/combat/skills';
import { mobFixture } from '../fixtures/mobFixture';
import { createCombatArena, syncCombatArena, captureCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';

it('measures the live poison applier and contagion together on a pack', () => {
  const ids = ['attack.poison_cloud', 'attack.contagion'];
  const group = Array.from({ length: 3 }, (_, i) => mobFixture({
    id: `poison-rotation-${i}`, hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0,
    armour: 0, res: 0, innate: [], skillIds: [],
  }));
  const c = buildCharacter(30, emptyGear());
  const skills = newSkillState();
  const statuses = newMobStatusStore();
  for (const id of ids) skills.owned[id] = 0;
  const cast = (id: string, targets: typeof group) => {
    const prepared = prepareSkillCast(skills, c, id, 1e9, targets, {}, { spatialTargets: false });
    expect(prepared, id).not.toBeNull();
    return resolvePreparedCast(skills, c, prepared!, {}, mulberry32(7), { mobStatus: statuses });
  };
  cast(ids[0], [group[0]]);
  const initial = statuses[group[0].id]?.statuses.poison?.stacks ?? 0;
  expect(initial).toBeGreaterThan(0);
  const result = cast(ids[1], group);
  const stacks = group.map((m) => statuses[m.id]?.statuses.poison?.stacks ?? 0);
  expect(stacks).toEqual([initial, initial, initial]);
  expect(new Set(result.byMob?.map((hit) => hit.id)).size).toBeLessThanOrEqual(sm.byId[ids[1]].area!.max_targets!);
  console.log('live poison rotation', { ids, initial, stacks, damage: result.dealt, targets: result.byMob?.map((hit) => hit.id) });
});

it('measures another live skill waiting for a cast and its recovery', () => {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, { id: 'lock-target', hp: 1e9, hpMax: 1e9, ps: 0, evasion: 0,
    dodgeRate: 0, armour: 0, innate: [], skillIds: [] });
  state.group = [mob];
  const ids = ['attack.poison_cloud', 'attack.contagion'];
  for (const id of ids) state.skills.owned[id] = 0;
  state.skills.list.fill(null);
  state.skills.list[0] = ids[0];
  state.skills.list[1] = ids[1];
  state.player.mana = characterSheet(state).maxMana;
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 3, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  for (let i = 0; i < 5; i++) tick(state, { arena });
  const first = arena.actions.find((a) => a.kind === 'cast' && a.skillId === ids[0]);
  const second = arena.actions.find((a) => a.kind === 'cast' && a.skillId === ids[1]);
  expect(first?.timing).toBeDefined();
  expect(second?.timing).toBeDefined();
  expect(second!.atUs).toBeGreaterThanOrEqual(first!.timing!.recoveryUntilUs);
  console.log('live cast lock', { ids, startUs: first!.atUs,
    releaseUs: first!.timing!.releaseAtUs, recoveryUntilUs: first!.timing!.recoveryUntilUs,
    nextStartUs: second!.atUs });
});

it.each(['attack.meteor', 'attack.sand_storm', 'attack.ice_lance', 'attack.void_ray'])(
  'measures the rotation with and without %s and its committed cast lock', (id) => {
    function fight(ids: string[]) {
      const state = newGame(41);
      setLevel(state, 90);
      state.hunting = true;
      const mob = mobFixture({ id: 'rotation-target', hp: 1e9, hpMax: 1e9, ps: 0,
        evasion: 0, dodgeRate: 0, armour: 0, innate: [], skillIds: [] });
      state.group = [mob];
      state.skills.list.fill(null);
      for (const [index, skill] of ids.entries()) {
        state.skills.owned[skill] = 0;
        state.skills.list[index] = skill;
      }
      state.player.mana = characterSheet(state).maxMana;
      const arena = createCombatArena();
      syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
      Object.assign(arena.player, { x: 1, y: 6 });
      Object.assign(arena.mobs[mob.id], { x: 3, y: 6 });
      pinFieldPopulation(state);
      const casts = new Map<number, (typeof arena.actions)[number]>();
      for (let sec = 0; sec < 10; sec++) {
        tick(state, { arena });
        for (const action of arena.actions) if (action.kind === 'cast') casts.set(action.id, action);
      }
      return [...casts.values()];
    }
    const follow = 'attack.contagion';
    const baseline = fight([follow]).find(action => action.skillId === follow)!;
    const together = fight([id, follow]);
    const first = together.find(action => action.skillId === id)!;
    const second = together.find(action => action.skillId === follow)!;
    expect(first, id).toBeDefined();
    expect(second, follow).toBeDefined();
    const timing = first.primaryTiming ?? first.timing!;
    expect(second.atUs).toBeGreaterThanOrEqual(timing.recoveryUntilUs);
    expect(second.atUs).toBeGreaterThan(baseline.atUs);
    expect(first.impactCount).toBeGreaterThan(0);
    console.log(JSON.stringify({ scenario: 'rotation-with-without', id, follow,
      baselineStartUs: baseline.atUs, startUs: first.atUs, releaseUs: timing.releaseAtUs,
      recoveryUntilUs: timing.recoveryUntilUs, nextStartUs: second.atUs, impacts: first.impactCount }));
  });
