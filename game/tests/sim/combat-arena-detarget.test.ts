import { describe, expect, it } from 'vitest';
import { E, sm } from '../../src/engine/client';
import { intentTargets, selectCombatIntent } from '@sim/combat/combat-actions';
import { advanceCombatArena, aimForSkill, arenaDistance, arenaMobRange, arenaSkillRange, bodyRadiusM, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { newGame } from '@sim/core/game';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { characterSheet } from '@sim/core/game';
import { mobFixture } from '../fixtures/mobFixture';

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
  it('tracks the same single-target intent while an equally useful neighbour gets closer', () => {
    const { state, arena, character } = encounter();
    const id = 'attack.fireball';
    state.skills.owned[id] = 0;
    state.skills.list[0] = id;
    arena.intent = { skillId: id, targetId: 'detarget-0', targetPoint: { x: 2.5, y: 6 }, phase: 'approach' };
    Object.assign(arena.mobs['detarget-1'], { x: 2.3, y: 6 });
    const held = selectCombatIntent(arena, state, character, true)!;
    expect(held.targetId).toBe('detarget-0');
    expect(held.targetPoint).toEqual({ x: 2.5, y: 6 });
  });
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
    // The baseline is one 0.5m ground diameter for every body class; rank does not resize it.
    expect(E.combat_arena.player_radius_m).toBe(0.25);
    for (const size of E.mob.sizes as any[]) expect(size.radius_m).toBe(0.25);
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

  it('settles a six-body pack in reach, clear of each other and inside the field', () => {
    const state = newGame(31);
    state.group = Array.from({ length: 6 }, (_, index) => mobFixture({
      id: `pack-${index}`, hp: 1e9, hpMax: 1e9, innate: [], skillIds: [],
    }));
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 9, y: 6 });
    for (const mob of state.group) Object.assign(arena.mobs[mob.id], { x: 13, y: 6 });
    const opts = { ...stepOpts, playerRange: 2.1, playerLocked: true };
    for (let index = 1; index <= 160; index++) advanceCombatArena(arena, state, index * 50_000, opts);
    const actors = state.group.map((mob) => arena.mobs[mob.id]);
    for (const actor of actors) {
      const radius = actor.radiusM ?? 0.25;
      expect(arenaDistance(actor, arena.player)).toBeLessThanOrEqual(arenaMobRange(actor.mob!) + 1e-7);
      expect(actor.x).toBeGreaterThanOrEqual(radius - 1e-6);
      expect(actor.y).toBeGreaterThanOrEqual(radius - 1e-6);
      expect(actor.x).toBeLessThanOrEqual(arena.bounds.width - radius + 1e-6);
      expect(actor.y).toBeLessThanOrEqual(arena.bounds.height - radius + 1e-6);
      for (const other of actors) if (other !== actor)
        expect(arenaDistance(actor, other)).toBeGreaterThanOrEqual(radius + (other.radiusM ?? 0.25) - 1e-6);
    }
    expect(Object.keys(arena.contacts)).toHaveLength(actors.length);
    const claims = new Set(Object.values(arena.contacts).map((claim) => `${claim.x.toFixed(3)},${claim.y.toFixed(3)}`));
    expect(claims.size).toBe(actors.length);
  });

  it('keeps an eight-body pack clear and names the bodies that cannot reach', () => {
    const state = newGame(31);
    state.group = Array.from({ length: 8 }, (_, index) => mobFixture({
      id: `dense-${index}`, hp: 1e9, hpMax: 1e9, innate: [], skillIds: [],
    }));
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 9, y: 6 });
    for (const mob of state.group) Object.assign(arena.mobs[mob.id], { x: 13, y: 6 });
    const opts = { ...stepOpts, playerRange: 2.1, playerLocked: true };
    for (let index = 1; index <= 160; index++) advanceCombatArena(arena, state, index * 50_000, opts);
    const actors = state.group.map((mob) => arena.mobs[mob.id]);
    for (const actor of actors) {
      for (const other of actors) if (other !== actor)
        expect(arenaDistance(actor, other)).toBeGreaterThanOrEqual(
          (actor.radiusM ?? 0.25) + (other.radiusM ?? 0.25) - 1e-6);
    }
    expect(Object.keys(arena.contacts).length).toBeGreaterThanOrEqual(6);
    expect(actors.filter((actor) => actor.waitingForContact).length).toBeGreaterThanOrEqual(1);
    for (const actor of actors) {
      if (!actor.waitingForContact) continue;
      expect(arenaDistance(actor, arena.player)).toBeGreaterThan(0.7 + 1e-7);
    }
  });

  it('keeps a corner pack reachable, clear and deterministic without claim churn', () => {
    const state = newGame(31);
    state.group = [0, 1, 2].map((index) => mobFixture({
      id: `corner-${index}`, hp: 1e9, hpMax: 1e9, innate: [], skillIds: [],
    }));
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 17.5, y: 11.5 });
    state.group.forEach((mob, index) => Object.assign(arena.mobs[mob.id], { x: 15 + index * .2, y: 11.2 }));
    const twinState = structuredClone(state);
    const twinArena = structuredClone(arena);
    const opts = { ...stepOpts, playerRange: 2.1, playerLocked: true };
    for (let index = 1; index <= 100; index++) {
      advanceCombatArena(arena, state, index * 50_000, opts);
      advanceCombatArena(twinArena, twinState, index * 50_000, opts);
    }
    expect(arena).toEqual(twinArena);
    const actors = state.group.map((mob) => arena.mobs[mob.id]);
    for (const actor of actors) {
      expect(actor.x).toBeGreaterThanOrEqual((actor.radiusM ?? .25) - 1e-6);
      expect(actor.y).toBeGreaterThanOrEqual((actor.radiusM ?? .25) - 1e-6);
      expect(actor.x).toBeLessThanOrEqual(arena.bounds.width - (actor.radiusM ?? .25) + 1e-6);
      expect(actor.y).toBeLessThanOrEqual(arena.bounds.height - (actor.radiusM ?? .25) + 1e-6);
      if (actor.waitingForContact) expect(arena.contacts[actor.id]).toBeUndefined();
    }
    expect(new Set(Object.values(arena.contacts).map((claim) => `${claim.x.toFixed(2)},${claim.y.toFixed(2)}`)).size)
      .toBe(Object.keys(arena.contacts).length);
  });

  it('insets every body by its radius at the field edge', () => {
    const state = newGame(31);
    state.group = [0, 1].map((index) => mobFixture({
      id: `edge-${index}`, hp: 1e9, hpMax: 1e9, innate: [], skillIds: [],
    }));
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 0.05, y: 0.05 });
    for (const mob of state.group) Object.assign(arena.mobs[mob.id], { x: 0.02, y: 0.02 });
    advanceCombatArena(arena, state, 50_000, stepOpts);
    for (const actor of [arena.player, ...state.group.map((mob) => arena.mobs[mob.id])]) {
      const radius = actor.radiusM ?? 0.25;
      expect(actor.x).toBeGreaterThanOrEqual(radius - 1e-6);
      expect(actor.y).toBeGreaterThanOrEqual(radius - 1e-6);
    }
  });
});
