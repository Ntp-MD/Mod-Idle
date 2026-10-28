import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';

function controlledFight() {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'controlled', hp: 1e8, hpMax: 1e8, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'front', damage: 'physical', innate: [],
    skillIds: ['mob.lightning.static-jab'], skillReadyAtUs: {},
    hitsPerSec: 1, atkTimer: 0, engageSec: 0,
  });
  state.group = [mob];
  state.skills.list.fill(null);
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 2, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  state.mobStatus[mob.id] = {
    statuses: { shock: { stacks: 1, secLeft: 2, perSec: 0 } },
    alignedPerSec: 0, elapsedSec: 0, stoppedSec: 0, stoppedUntil: 1.5,
  };
  return { state, mob, arena };
}

describe('hard control of an ordinary mob attack', () => {
  it('cancels the release and keeps the strike cooldown unspent while stopped', () => {
    const { state, mob, arena } = controlledFight();
    tick(state, { arena, autoSkills: false });
    expect(arena.actions.filter((action) => action.actorId === mob.id)).toHaveLength(0);
    expect(state.fx.filter((event) => event.kind === 'taken')).toHaveLength(0);
    expect(state.fx.filter((event) => event.kind === 'cast' && event.mobId === mob.id)).toHaveLength(0);
    expect(mob.skillReadyAtUs?.['mob.lightning.static-jab']).toBeUndefined();
  });

  it('attacks again after the stop expires and spends the strike once', () => {
    const { state, mob, arena } = controlledFight();
    tick(state, { arena, autoSkills: false });
    tick(state, { arena, autoSkills: false });
    // the stop has expired: the ready strike starts its authored preparation, and the
    // cooldown still commits with the actual strike, so nothing is spent yet
    const telegraphs = arena.actions.filter((action) => action.actorId === mob.id);
    expect(telegraphs.length).toBeGreaterThan(0);
    expect(mob.skillReadyAtUs?.['mob.lightning.static-jab']).toBeUndefined();
    tick(state, { arena, autoSkills: false });
    // the preparation releases: damage lands and the strike cooldown is spent once
    expect(state.fx.filter((event) => event.kind === 'taken' && event.byId === mob.id).length).toBeGreaterThan(0);
    expect(mob.skillReadyAtUs?.['mob.lightning.static-jab']).toBeGreaterThan(0);
  });
});