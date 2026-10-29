import { describe, expect, it } from 'vitest';
import { resolveSkillArea, skillAreaSnapshot } from '@engine/skill-area.ts';
import { firstProjectileHit, targetsInSkillArea } from '@engine/skill-actions.ts';
import { E, sm, tree } from '../../src/engine/client';
import { arenaAction, arenaSkillTargets, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, tick } from '@sim/core/game';
import { castOnce, newSkillState, skillEligibility } from '@sim/combat/skills';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { mobFixture, pinFieldPopulation } from '../fixtures/mobFixture';

describe('circular skill selection', () => {
  it('acquires in cast range but splashes beyond it, including the radius boundary', () => {
    const targets = [
      { id: 'outside', x: 7.01, y: 0 },
      { id: 'edge', x: 7, y: 0 },
      { id: 'primary', x: 4, y: 0 },
      { id: 'above', x: 4, y: 2 },
    ];
    const resolved = resolveSkillArea({ x: 0, y: 0 }, targets, 4.6, { origin: 'target', radius_m: 3 });
    expect(resolved.targets.map((target) => target.id)).toEqual(['primary', 'edge', 'above']);
    expect(resolved.area?.center).toEqual({ x: 4, y: 0 });
    targets[2].x = 9;
    expect(resolved.area?.center).toEqual({ x: 4, y: 0 });
    expect(resolveSkillArea({ x: 0, y: 0 }, targets, 0.5, { origin: 'target', radius_m: 3 }).targets).toEqual([]);
  });

  it('centers self areas on the caster and resolves all bodies with deterministic tie order', () => {
    const targets = [
      { id: 'a', x: 1, y: 0 }, { id: 'b', x: -1, y: 0 },
      { id: 'c', x: 0, y: 2 }, { id: 'd', x: 0, y: -2 },
      { id: 'edge', x: 3, y: 0 }, { id: 'outside', x: 3.01, y: 0 },
    ];
    const resolved = resolveSkillArea({ x: 0, y: 0 }, targets, 1, { origin: 'caster', radius_m: 3 });
    expect(resolved.targets.map((target) => target.id)).toEqual(['a', 'b', 'c', 'd', 'edge']);
    expect(resolved.area).toEqual({ origin: 'caster', radiusM: 3, center: { x: 0, y: 0 }, targetId: 'a' });
    expect(resolveSkillArea({ x: 0, y: 0 }, targets, 4.6, { origin: 'target', radius_m: 0 }).targets)
      .toEqual([targets[0]]);
  });
});

describe('line and cone footprints', () => {
  it('keeps a line inside its width and endpoints and excludes behind the caster', () => {
    const targets = [
      { id: 'front', x: 1, y: 0 }, { id: 'off', x: 2, y: 0.5 },
      { id: 'behind', x: -1, y: 0 }, { id: 'far', x: 4, y: 0 },
      { id: 'edge', x: 2, y: 0.375 },
    ];
    const resolved = resolveSkillArea({ x: 0, y: 0 }, targets, 3,
      { origin: 'caster', radius_m: 0, shape: 'line', length_m: 3, width_m: 0.75 });
    expect(resolved.targets.map((target) => target.id)).toEqual(['front', 'edge']);
    expect(resolved.area?.shape).toBe('line');
    expect(resolved.area?.directionRad).toBe(0);
  });

  it('uses a full opening angle for a 120-degree cone', () => {
    const targets = [
      { id: 'front', x: 2, y: 0 },
      { id: 'diagonal', x: 2, y: 2 },
      { id: 'side', x: 0, y: 2 },
      { id: 'behind', x: -2, y: 0 },
    ];
    const resolved = resolveSkillArea({ x: 0, y: 0 }, targets, 3,
      { origin: 'caster', radius_m: 3, shape: 'cone', angle_deg: 120 });
    expect(resolved.targets.map((target) => target.id)).toEqual(['front', 'diagonal']);
  });

  it('includes the forward half disc for a 180-degree cone and excludes strict rear', () => {
    const area = skillAreaSnapshot({ origin: 'caster', radius_m: 3, shape: 'cone', angle_deg: 180 },
      { x: 0, y: 0 }, { x: 2, y: 0 }, 'front');
    const bodies = [
      { id: 'front', x: 2, y: 0 }, { id: 'vertical', x: 0, y: 2 },
      { id: 'behind', x: -0.1, y: 0 },
    ];
    expect(targetsInSkillArea(area, bodies).map((target) => target.id)).toEqual(['front', 'vertical']);
  });

  it('falls back to the caster facing when the aim point equals the source', () => {
    const area = skillAreaSnapshot({ origin: 'caster', radius_m: 0, shape: 'line', length_m: 3, width_m: 0.75 },
      { x: 4, y: 4 }, { x: 4, y: 4 }, 'front', Math.PI / 2);
    expect(area.directionRad).toBeCloseTo(Math.PI / 2);
  });

  it('keeps legacy rows single or circular without a shape discriminator', () => {
    expect(skillAreaSnapshot({ origin: 'target', radius_m: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, 'a').shape)
      .toBeUndefined();
    expect(skillAreaSnapshot({ origin: 'target', radius_m: 3 }, { x: 0, y: 0 }, { x: 1, y: 0 }, 'a').shape)
      .toBeUndefined();
  });
});

function encounter() {
  const state = newGame(31);
  const radius = sm.byId['attack.firestorm'].area!.radius_m;
  const positions = [
    { x: 4, y: 6 }, { x: 4 + radius * 2 / 3, y: 6 }, { x: 4, y: 6 + radius * 2 / 3 },
    { x: 4 + radius * 5 / 6, y: 6 }, { x: 4 + radius * 2, y: 6 },
  ];
  state.group = positions.map((_, index) => mobFixture({
    id: 'radius-' + index, hp: 1e9, hpMax: 1e9, innate: [], skillIds: [],
  }));
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  positions.forEach((point, index) => Object.assign(arena.mobs[state.group[index].id], point));
  pinFieldPopulation(state);
  return { state, arena };
}

describe('radius casts in the live simulation', () => {
  it('damages more than three in-circle enemies while offline retains its queue approximation', () => {
    const { state, arena } = encounter();
    const character = buildCharacter(100, emptyGear());
    const id = 'attack.firestorm';
    const skills = newSkillState();
    skills.owned[id] = 0; skills.list[0] = id;
    const offlineGroup = structuredClone(state.group);
    const offlineSkills = structuredClone(skills);
    const before = state.group.map((mob) => mob.hp);
    const cast = castOnce(skills, character, character.maxMana, state.group, {}, () => .5, {
      resolveTargetsForSkill: (skillId, group) => arenaSkillTargets(arena, skillId, group),
    })!;
    expect(cast.byMob.map((hit) => hit.id).sort()).toEqual(state.group.slice(0, 4).map((mob) => mob.id).sort());
    expect(state.group[4].hp).toBe(before[4]);
    expect(cast.area?.radiusM).toBe(sm.byId[id].area!.radius_m);
    expect(cast.manaCost).toBe(sm.manaCostOf(sm.byId[id]));
    expect(castOnce(offlineSkills, character, character.maxMana, offlineGroup, {}, () => .5)?.targets)
      .toBe(Number(sm.byId[id].targets!.split('/')[0]));
    state.group[0].hp = 0;
    expect(arenaSkillTargets(arena, id, state.group).targets.some((mob) => mob.hp <= 0)).toBe(false);
  });

  it('keeps Single Combat restricted to the primary target inside a populated radius', () => {
    const { state, arena } = encounter();
    const character = { ...buildCharacter(100, emptyGear()),
      keystones: tree.keystoneBundles({ 'keystone.single-combat': 1 }) };
    const skills = newSkillState(); skills.owned['attack.firestorm'] = 0; skills.list[0] = 'attack.firestorm';
    const cast = castOnce(skills, character, character.maxMana, state.group, {}, () => .5, {
      resolveTargetsForSkill: (id, group) => arenaSkillTargets(arena, id, group),
    })!;
    expect(cast.byMob).toHaveLength(1);
    expect(state.group.some((mob) => mob.id === cast.byMob[0].id)).toBe(true);
    expect(cast.manaCost).toBe(sm.manaCostOf(sm.byId['attack.firestorm']));
  });

  it('does not pay or start a cooldown when nobody is inside a self-centered radius', () => {
    const { state, arena } = encounter();
    const id = 'attack.whirlwind';
    Object.values(arena.mobs).forEach((actor) => { actor.x = arena.player.x + sm.byId[id].area!.radius_m + 10; });
    const character = { ...buildCharacter(100, emptyGear()), weaponName: 'one-handed axe' };
    const skills = newSkillState(); skills.owned[id] = 0; skills.list[0] = id;
    expect(castOnce(skills, character, character.maxMana, state.group, {}, () => .5, {
      resolveTargetsForSkill: (skillId, group) => arenaSkillTargets(arena, skillId, group),
    })).toBeNull();
    expect(skills.cd[id]).toBeUndefined();
    expect(skillEligibility(skills, character, id, character.maxMana, [], {}, { spatialTargets: true }).reason).toBe('no-target');
  });

  it('still casts a ready caster-centered skill while holding a longer-range weapon', () => {
    const { state, arena } = encounter();
    state.hunting = true;
    state.group = [state.group[0]];
    state.group[0].line = 'stand-off';
    const id = 'attack.venom_spray';
    const radius = sm.byId[id].area!.radius_m;
    Object.assign(arena.mobs[state.group[0].id], { x: arena.player.x + radius + 1, y: arena.player.y });
    state.gear[0] = { slot: 'main hand', base: 'bow', ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] };
    state.skills.owned[id] = 0; state.skills.list.fill(null); state.skills.list[0] = id;
    tick(state, { arena });
    for (let i = 0; i < 3 && !arena.actions.some((action) => action.skillId === id); i++) tick(state, { arena });
    expect(arena.actions.some((action) => action.skillId === id && action.area?.origin === 'caster')).toBe(true);
  });

  it('publishes the release-aimed cast footprint to the event and action without recomputing it after a kill', () => {
    const { state, arena } = encounter();
    state.hunting = true;
    const primaryId = state.group[0].id;
    state.group[0].hp = 1;
    state.skills.owned['attack.firestorm'] = 0;
    state.skills.list.fill(null); state.skills.list[0] = 'attack.firestorm';
    tick(state, { arena });
    const event = state.fx.find((fx) => fx.kind === 'cast' && fx.skillId === 'attack.firestorm')!;
    const action = arena.actions.find((item) => item.skillId === 'attack.firestorm')!;
    // release re-aims onto a live cluster and the committed footprint is the release aim —
    // the event and the action share it. Exact body ids depend on live contact positions.
    expect(event.skillOutcome?.area?.origin).toBe('target');
    expect(event.skillOutcome?.area?.radiusM).toBe(sm.byId['attack.firestorm'].area!.radius_m);
    expect(event.skillOutcome?.area?.targetId).toMatch(/^radius-/);
    expect((event.skillOutcome?.targets ?? []).length).toBeGreaterThanOrEqual(2);
    const area = event.skillOutcome!.area!;
    expect(Number.isFinite(area.center.x)).toBe(true);
    expect(Number.isFinite(area.center.y)).toBe(true);
    expect(action.area).toEqual(area);
    expect(action.targetX).toBeCloseTo(area.center.x, 9);
    expect(action.targetY).toBeCloseTo(area.center.y, 9);
    expect(state.group.some((mob) => mob.id === primaryId)).toBe(false);
    const frozenX = action.area!.center.x;
    const footprint = structuredClone(action.area!);
    arenaAction(arena, 'player', 'cast', E.combat_arena.action_sec * arena.unitsPerSec, undefined,
      'attack.firestorm', footprint);
    footprint.center.x = 99;
    expect(arena.actions.at(-1)?.area?.center.x).toBe(frozenX);
  });
});

describe('contact meets the body edge, circles keep their centres', () => {
  it('a swept projectile clips a large body whose edge crosses the path', () => {
    const from = { x: 0, y: 6 }, to = { x: 10, y: 6 };
    const edge = [{ id: 'big', x: 5, y: 6.5, radiusM: 0.6 }];
    const clear = [{ id: 'far', x: 5, y: 8, radiusM: 0.6 }];
    // 0.5m off the line: outside the 0.35 hit radius, inside edge + body
    expect(firstProjectileHit(from, to, edge, 0.35)?.target.id).toBe('big');
    expect(firstProjectileHit(from, to, [{ id: 'big', x: 5, y: 6.5 }], 0.35)).toBeUndefined();
    expect(firstProjectileHit(from, to, clear, 0.35)).toBeUndefined();
  });

  it('a single-target impact holds a body whose edge is still on the aim point', () => {
    const area = { origin: 'target', radiusM: 0, center: { x: 4, y: 6 }, targetId: 'p' } as const;
    const edged = [{ id: 'p', x: 4.5, y: 6, radiusM: 0.6 }];
    expect(targetsInSkillArea(area, edged, 0.35)).toHaveLength(1);
    expect(targetsInSkillArea(area, [{ id: 'p', x: 4.5, y: 6 }], 0.35)).toHaveLength(0);
  });

  it('an AoE circle still tests centres, never edges', () => {
    const area = { origin: 'target', radiusM: 3, center: { x: 4, y: 6 }, targetId: 'p' } as const;
    const bodies = [
      { id: 'p', x: 4, y: 6, radiusM: 0.45 },
      { id: 'edge', x: 7.4, y: 6, radiusM: 0.6 },
    ];
    // 3.4m out: the edge reaches the circle but the centre does not, so it stays out
    expect(targetsInSkillArea(area, bodies).map((t) => t.id)).toEqual(['p']);
  });
});
