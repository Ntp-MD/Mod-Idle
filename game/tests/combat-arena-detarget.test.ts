import { describe, expect, it } from 'vitest';
import { E, sm } from '../src/engine/client';
import { intentTargets, selectCombatIntent } from '../src/sim/combat-actions';
import { advanceCombatArena, aimForSkill, arenaSkillRange, bodyRadiusM, createCombatArena, syncCombatArena } from '../src/sim/combat-arena';
import { newGame } from '../src/sim/game';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { characterSheet } from '../src/sim/game';
import { mobFixture } from './mobFixture';

/**
 * ARPG detarget: a target-centred circle aims at its best cluster, a caster
 * circle needs no target, and a single row keeps the nearest body.
 */
function encounter() {
  const state = newGame(31);
  const id = 'attack.firestorm';
  const radius = sm.byId[id].area!.radius_m;
  expect(radius).toBeGreaterThan(0);
  // isolated magnet near the player, cluster of three further out but in cast range
  const positions = [
    { x: 2.5, y: 6 },
    { x: 6, y: 6 }, { x: 6.8, y: 6 }, { x: 7.6, y: 6 },
  ];
  state.group = positions.map((_, index) => mobFixture({
    id: 'detarget-' + index, hp: 1e9, hpMax: 1e9, innate: [], skillIds: [],
  }));
  state.skills.owned[id] = 0;
  state.skills.list = new Array(16).fill(null);
  state.skills.list[0] = id;
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 2, y: 6 });
  positions.forEach((point, index) => Object.assign(arena.mobs[state.group[index].id], point));
  return { state, arena, id, character: buildCharacter(100, emptyGear()) };
}

describe('ARPG detarget', () => {
  it('centres a target circle on the best cluster, not the nearest body', () => {
    const { state, arena, id, character } = encounter();
    const nearest = arena.mobs['detarget-0'];
    expect(nearest).toBeDefined();
    const aim = aimForSkill(arena, state.group, id)!;
    expect(aim.mob.id).not.toBe('detarget-0');
    expect(['detarget-1', 'detarget-2', 'detarget-3']).toContain(aim.mob.id);
    const intent = selectCombatIntent(arena, state, character, true)!;
    expect(intent.skillId).toBe(id);
    expect(intent.targetId).toBe(aim.mob.id);
    const resolved = intentTargets(arena, state.group, intent, false);
    expect(resolved.targets.map((mob) => mob.id).sort()).toEqual(
      ['detarget-1', 'detarget-2', 'detarget-3']);
    expect(resolved.area?.center.x).toBeCloseTo(arena.mobs[aim.mob.id].x, 9);
  });

  it('keeps a single row locked on the nearest body', () => {
    const { state, arena } = encounter();
    const id = 'attack.fireball';
    state.skills.owned[id] = 0;
    state.skills.list[0] = id;
    const aim = aimForSkill(arena, state.group, id)!;
    expect(aim.mob.id).toBe('detarget-0');
  });

  it('aims a caster circle from the player while naming the nearest body', () => {
    const { state, arena } = encounter();
    const id = 'attack.whirlwind';
    expect(sm.byId[id].area?.origin).toBe('caster');
    expect(sm.byId[id].area?.shape).toBeUndefined();
    const aim = aimForSkill(arena, state.group, id)!;
    expect(aim.mob.id).toBe('detarget-0');
    expect(aim.point.x).toBe(arena.player.x);
    expect(aim.point.y).toBe(arena.player.y);
  });

  it('walks on the skill range, not the weapon range', () => {
    const { arena } = encounter();
    expect(arenaSkillRange('attack.firestorm')).toBeGreaterThan(
      arenaSkillRange('attack.cleave') === 0 ? -1 : 0);
    expect(E.combat_arena.range.magic).toBe(4.6);
    expect(arenaSkillRange('attack.firestorm')).toBe(4.6);
  });

  it('stands its ground: a castable row fires before a farther row walks', () => {
    const state = newGame(31);
    state.group = [mobFixture({ id: 'hold-0', hp: 1e9, hpMax: 1e9, innate: [], skillIds: [] })];
    for (const id of ['attack.backstab', 'attack.firestorm']) state.skills.owned[id] = 0;
    state.skills.list = new Array(16).fill(null);
    state.skills.list[0] = 'attack.backstab';
    state.skills.list[1] = 'attack.firestorm';
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    // 3.5m out: past the melee row but inside the firestorm circle
    Object.assign(arena.mobs['hold-0'], { x: 4.5, y: 6 });
    const character = buildCharacter(100, emptyGear());
    const intent = selectCombatIntent(arena, state, character, true)!;
    expect(intent.skillId).toBe('attack.firestorm');
    expect(intent.targetId).toBe('hold-0');
  });

  it('reads ground footprint radii from the body class', () => {
    expect(bodyRadiusM(undefined)).toBe(E.combat_arena.player_radius_m);
    expect(bodyRadiusM(mobFixture({ readsAs: 'small' }) as any)).toBe(
      (E.mob.sizes as any[]).find((s) => s.id === 'small').radius_m);
    expect(bodyRadiusM(mobFixture({ readsAs: 'boss' }) as any)).toBe(
      (E.mob.sizes as any[]).find((s) => s.id === 'boss').radius_m);
    expect(bodyRadiusM(mobFixture() as any)).toBe(
      (E.mob.sizes as any[]).find((s) => s.id === 'medium').radius_m);
  });

  it('re-tracks the held approach aim when the cluster leaves cast range', () => {
    const { state, arena, id, character } = encounter();
    const first = selectCombatIntent(arena, state, character, true)!;
    expect(['detarget-1', 'detarget-2', 'detarget-3']).toContain(first.targetId);
    arena.intent = { ...first };
    // shove the cluster out of cast range; the isolated mob stays in range
    (['detarget-1', 'detarget-2', 'detarget-3'] as const).forEach((mobId, i) =>
      Object.assign(arena.mobs[mobId], { x: 10 + i * 0.8, y: 6 }));
    const second = selectCombatIntent(arena, state, character, true)!;
    expect(second.targetId).toBe('detarget-0');
    expect(second.targetPoint.x).toBeCloseTo(2.5, 9);
  });
});

describe('bodies occupy ground', () => {
  const stepOpts = {
    playerRange: 2.1, playerSpeedMult: 1, mobSpeedMult: () => 1,
  };
  function overlapped() {
    const state = newGame(31);
    state.group = [0, 1].map((index) => mobFixture({
      id: 'overlap-' + index, hp: 1e9, hpMax: 1e9, innate: [], skillIds: [],
    }));
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    for (const mob of state.group) Object.assign(arena.mobs[mob.id], { x: 5, y: 6 });
    return { state, arena };
  }

  it('pushes overlapping edges apart until clear, deterministically', () => {
    const first = overlapped();
    const second = overlapped();
    const atUs = Math.round(0.05 * 1_000_000);
    for (const { state, arena } of [first, second]) {
      advanceCombatArena(arena, state, atUs, stepOpts);
      const [a, b] = state.group.map((mob) => arena.mobs[mob.id]);
      const need = bodyRadiusM(a.mob) + bodyRadiusM(b.mob);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(need - 1e-6);
    }
    const pos = ({ state, arena }: ReturnType<typeof overlapped>) =>
      state.group.map((mob) => [arena.mobs[mob.id].x, arena.mobs[mob.id].y]);
    expect(pos(second)).toEqual(pos(first));
  });

  it('treats the player as immovable when a mob stands on them', () => {
    const { state, arena } = overlapped();
    for (const mob of state.group) Object.assign(arena.mobs[mob.id], { x: 1, y: 6 });
    advanceCombatArena(arena, state, Math.round(0.05 * 1_000_000), stepOpts);
    expect(arena.player.x).toBe(1);
    expect(arena.player.y).toBe(6);
    for (const mob of state.group) {
      const actor = arena.mobs[mob.id];
      const need = bodyRadiusM(actor.mob) + bodyRadiusM(undefined);
      expect(Math.hypot(actor.x - 1, actor.y - 6)).toBeGreaterThanOrEqual(need - 1e-6);
    }
  });
});
