import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { mobPhase, mobSkillById, readyMobSkill } from '@sim/combat/mobSkills';
import { mobFixture } from '../fixtures/mobFixture';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';

/** F25 — a strike with a phase gate only answers inside its HP window. */
describe('F25 phase gates — the kit, not the timer, owns the transition', () => {
  const slam = () => mobSkillById('mob.earth.seismic-slam')!;

  it('gates the row on the body’s own HP fraction', () => {
    expect(slam()).toBeDefined();
    const body = (hp: number) =>
      ({ ...mobFixture(), id: 'gate-id', hp, hpMax: 1000, skillIds: ['mob.earth.seismic-slam'] }) as never;
    expect(readyMobSkill(body(1000), 0)).toBeUndefined();
    expect(readyMobSkill(body(501), 0)).toBeUndefined();
    expect(readyMobSkill(body(500), 0)?.id).toBe('mob.earth.seismic-slam');
    expect(mobPhase(body(1000), [slam()])).toBe(0);
    expect(mobPhase(body(400), [slam()])).toBe(1);
  });

  it('holds the slam above half HP and fires it below, naming the transition', () => {
    const state = newGame(701);
    setLevel(state, 60);
    state.hunting = true;
    state.player.hp = 1e9;
    const mob = spawnMob(mulberry32(701), 1, 'normal');
    Object.assign(mob, {
      id: 'elder-id', hp: 6e11, hpMax: 1e12, ps: 0, accuracy: 0, evasion: 0, dodgeRate: 0,
      armour: 0, res: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: ['mob.earth.seismic-slam'],
    });
    state.group = [mob];
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 9.5, y: 6 });
    Object.assign(arena.mobs[mob.id], { x: 10, y: 6 });
    pinFieldPopulation(state);
    const slamCast = () => arena.actions.find((a) => a.kind === 'cast' && a.skillId === 'mob.earth.seismic-slam');

    for (let i = 0; i < 8; i++) tick(state, { arena, autoSkills: false });
    expect(slamCast()).toBeUndefined();
    expect(state.log.some((l) => l.text.includes('shifts tactics'))).toBe(false);

    mob.hp = 4e11;
    for (let i = 0; i < 12 && !slamCast(); i++) tick(state, { arena, autoSkills: false });
    expect(slamCast()).toBeDefined();
    expect(state.log.some((l) => l.text.includes('shifts tactics (phase 1)'))).toBe(true);
  });
});
