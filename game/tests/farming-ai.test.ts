import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/client-helpers';
import { arenaDistance, captureCombatArena, createCombatArena, syncCombatArena } from '../src/sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '../src/sim/core/game';
import { pinFieldPopulation } from './mobFixture';

function farmFight(weapon: string | null, spots: { id: string; x: number; y: number }[]) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  state.spawnIn = 999;
  state.group = spots.map((spot, index) => {
    const mob = spawnMob(mulberry32(60 + index), 1, 'normal');
    Object.assign(mob, {
      id: spot.id, hp: 1e9, hpMax: 1e9, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
    });
    return mob;
  });
  if (weapon) state.gear[0] = { slot: 'main hand', base: weapon, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] };
  state.skills.list.fill(null);
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  for (const spot of spots) Object.assign(arena.mobs[spot.id], { x: spot.x, y: spot.y });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  state.field!.slots.forEach((slot, index) => { slot.home = { x: spots[index].x, y: spots[index].y }; });
  return { state, arena };
}

describe('stable auto-farming', () => {
  it('keeps a ranged build at range instead of walking into melee', () => {
    const { state, arena } = farmFight('bow', [{ id: 'target', x: 5, y: 6 }]);
    const start = { x: arena.player.x, y: arena.player.y };
    for (let index = 0; index < 3; index++) tick(state, { arena, autoSkills: false });
    expect(arenaDistance(arena.player, start)).toBeLessThan(0.2);
    expect(state.group[0].hp).toBeLessThan(state.group[0].hpMax);
  });

  it('closes the gap for a melee build and lands real attacks', () => {
    const { state, arena } = farmFight('one-handed axe', [{ id: 'target', x: 8, y: 6 }]);
    const start = arenaDistance(arena.player, arena.mobs.target);
    for (let index = 0; index < 4; index++) tick(state, { arena, autoSkills: false });
    expect(arenaDistance(arena.player, arena.mobs.target)).toBeLessThan(start);
    expect(state.group[0].hp).toBeLessThan(state.group[0].hpMax);
  });

  it('keeps the same basic target while two equal bodies jitter around it', () => {
    const { state, arena } = farmFight(null, [
      { id: 'left', x: 0.2, y: 6 }, { id: 'right', x: 1.8, y: 6 },
    ]);
    const firstHits: string[] = [];
    for (let index = 0; index < 3; index++) {
      const before = state.fx.length;
      tick(state, { arena, autoSkills: false });
      for (const event of state.fx.slice(before)) {
        if (event.kind === 'hit' && event.via === 'swing' && event.mobId) firstHits.push(event.mobId);
      }
    }
    expect(firstHits.length).toBeGreaterThan(0);
    expect(new Set(firstHits).size).toBe(1);
  });

  it('lets every in-range body attack under spatial engagement and holds the far body out', () => {
    const spots = Array.from({ length: 5 }, (_, index) => ({ id: `queued-${index}`, x: 1.6 + index * 0.2, y: 6 }));
    spots.push({ id: 'far', x: 8, y: 6 });
    const { state, arena } = farmFight(null, spots);
    tick(state, { arena, autoSkills: false });
    tick(state, { arena, autoSkills: false });
    const attackers = new Set(arena.actions.map((action) => action.actorId));
    const closeAttackers = [...attackers].filter((id) => id.startsWith('queued-'));
    expect(closeAttackers.length).toBeGreaterThan(3);
    expect(attackers.has('far')).toBe(false);
  });

  it('gives the same decision sequence for the same seed and inputs', () => {
    const a = farmFight('one-handed axe', [{ id: 'target', x: 4, y: 6 }]);
    const b = { state: structuredClone(a.state), arena: structuredClone(a.arena) };
    for (let index = 0; index < 4; index++) {
      tick(a.state, { arena: a.arena, autoSkills: false });
      tick(b.state, { arena: b.arena, autoSkills: false });
      expect(a.arena.actions.map((action) => [action.actorId, action.kind, action.skillId]))
        .toEqual(b.arena.actions.map((action) => [action.actorId, action.kind, action.skillId]));
    }
  });
});
