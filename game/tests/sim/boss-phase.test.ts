import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { mobPhase, mobSkillById, readyMobSkill } from '@sim/combat/mobSkills';
import { mobFixture } from '../fixtures/mobFixture';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, stepCombat, tick } from '@sim/core/game';
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

  it('counts a multi-gate kit in threshold order and lets a heal lower the phase', () => {
    const rows = [70, 40, 10].map((hpBelowPct) =>
      ({ id: `phase-${hpBelowPct}`, mode: 'strike', phase: { hpBelowPct } })) as never;
    const body = (hp: number) => ({ ...mobFixture(), hp, hpMax: 1000 }) as never;
    expect([1000, 650, 350, 50].map((hp) => mobPhase(body(hp), rows))).toEqual([0, 1, 2, 3]);
    // A heal raises the fraction again; the count follows the body down instead of sticking.
    expect(mobPhase(body(800), rows)).toBe(0);
    expect(mobPhase(body(650), rows)).toBe(1);
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

  it('samples the gate on every combat step, and a heal-then-recross is a new transition', () => {
    const state = newGame(702);
    setLevel(state, 60);
    state.hunting = true;
    state.player.hp = 1e9;
    const mob = spawnMob(mulberry32(702), 1, 'normal');
    Object.assign(mob, {
      id: 'recross-id', hp: 6e11, hpMax: 1e12, ps: 0, accuracy: 0, evasion: 0, dodgeRate: 0,
      armour: 0, res: 0, line: 'stand-off', damage: 'physical', innate: [],
      skillIds: ['mob.earth.seismic-slam'], skillReadyAtUs: {},
    });
    state.group = [mob];
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 9.5, y: 6 });
    Object.assign(arena.mobs[mob.id], { x: 10, y: 6 });
    pinFieldPopulation(state);
    const shifts = () => state.log.filter((line) => line.text.includes('shifts tactics')).length;
    const adds = () => state.group.filter((entry) => entry.addedBy === mob.id).length;

    // One step opens the body's cached second plan while the gate still reads 60%.
    stepCombat(state, { arena, autoSkills: false });
    expect(mob.phase).toBe(0);
    expect(adds()).toBe(0);
    // The next step sees the damage that crossed the gate: the plan must not delay the transition.
    mob.hp = 4e11;
    stepCombat(state, { arena, autoSkills: false });
    expect(mob.phase).toBe(1);
    expect(shifts()).toBe(1);
    expect(adds()).toBe(2);
    // Heal above the gate: the stored phase follows the body down without a transition.
    mob.hp = 6e11;
    stepCombat(state, { arena, autoSkills: false });
    expect(mob.phase).toBe(0);
    expect(shifts()).toBe(1);
    // Crossing again is a new transition and summons again.
    mob.hp = 4e11;
    stepCombat(state, { arena, autoSkills: false });
    expect(mob.phase).toBe(1);
    expect(shifts()).toBe(2);
    expect(adds()).toBe(4);
  });
});
