import { describe, expect, it } from 'vitest';
import { loot, sm } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { characterSheet, newGame, setLevel, spawnMob, stepCombat } from '@sim/core/game';
import { arenaPlayerInReach, captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import type { ManualControl } from '@sim/combat/combat-actions';

type Spot = { id: string; x: number; y: number; hp?: number };

function encounter(spots: Spot[], weapon: string) {
  const state = newGame(810);
  setLevel(state, 30);
  state.hunting = true;
  state.player.hp = 1e9;
  state.skills.list.fill(null);
  const hand = loot.SLOTS.findIndex((slot: string) => slot === 'main hand');
  state.gear[hand] = { slot: 'main hand', base: weapon, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] } as never;
  state.group = spots.map((spot, index) => {
    const mob = spawnMob(mulberry32(810 + index), 1, 'normal');
    Object.assign(mob, {
      id: spot.id, hp: spot.hp ?? 1e9, hpMax: spot.hp ?? 1e9, ps: 0, acc: 0,
      evasion: 0, dodgeRate: 0, armour: 0, line: 'stand-off', damage: 'physical',
      innate: [], skillIds: [], hitsPerSec: 1, atkTimer: 1,
    });
    return mob;
  });
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  for (const spot of spots) {
    Object.assign(arena.mobs[spot.id], { x: spot.x, y: spot.y });
  }
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state, state.group.length,
    new Map(spots.map((spot) => [spot.id, { x: spot.x, y: spot.y }])));
  state.field!.engagementIds = state.group.filter((mob) => mob.hp > 0).map((mob) => mob.id);
  return { state, arena };
}

describe('T2 placed ground intent and terminal basic release', () => {
  it('keeps a placed Meteor through the primary basic kill and damages current occupants at that point', () => {
    const point = { x: 9, y: 6 };
    const { state, arena } = encounter([
      { id: 'incidental', x: 1.6, y: 6, hp: 1 },
      { id: 'survivor-a', x: 9, y: 6 },
      { id: 'survivor-b', x: 10.2, y: 6.5 },
    ], 'one-handed sword');
    for (const actor of Object.values(arena.mobs)) actor.holdAtRange = true;
    state.skills.owned['attack.meteor'] = 0;
    state.skills.list[0] = 'attack.meteor';
    arena.focusId = 'incidental';
    const manual: ManualControl = { cast: { skillId: 'attack.meteor', point } };
    let manaDebited = 0;

    // The placed order starts outside Meteor range. A live basic kills its incidental
    // focus while the order is still approaching, exercising player-basic target loss.
    let attempts = 0;
    while (state.group.some((mob) => mob.id === 'incidental') && attempts++ < 80) {
      const before = state.player.mana;
      stepCombat(state, { arena, autoSkills: false, manual });
      manaDebited += Math.max(0, before - state.player.mana);
    }
    expect(state.group.some((mob) => mob.id === 'incidental')).toBe(false);
    expect(state.fx.some((event) => event.kind === 'hit' && event.via === 'swing'
      && event.mobId === 'incidental')).toBe(true);
    expect(arena.intent?.aimPoint).toBe(true);
    expect(arena.intent?.targetPoint).toEqual(point);

    while (arena.intent?.phase !== 'windup' && attempts++ < 180) {
      const before = state.player.mana;
      stepCombat(state, { arena, autoSkills: false, manual });
      manaDebited += Math.max(0, before - state.player.mana);
    }
    expect(arena.intent?.phase).toBe('windup');
    expect(arena.intent?.targetPoint).toEqual(point);
    while (!state.fx.some((event) => event.kind === 'cast' && event.skillId === 'attack.meteor')
      && attempts++ < 240) {
      const before = state.player.mana;
      stepCombat(state, { arena, autoSkills: false, manual });
      manaDebited += Math.max(0, before - state.player.mana);
    }
    const meteorCast = state.fx.find((event) => event.kind === 'cast' && event.skillId === 'attack.meteor')!;
    expect(meteorCast).toBeDefined();
    expect(meteorCast.skillOutcome?.area?.center).toEqual(point);
    // Put two living bodies into the exact placed circle after release. The incidental primary is
    // already gone; impact membership must read these current occupants at the unchanged point.
    for (const [id, position] of [['survivor-a', point], ['survivor-b', { x: point.x - 0.5, y: point.y + 0.5 }]] as const) {
      const actor = arena.mobs[id];
      Object.assign(actor, position, { holdAtRange: true, moving: false });
      const slot = state.field!.slots.find((entry) => entry.mobId === id);
      if (slot) slot.home = { ...position };
    }
    state.field!.engagementIds = state.group.filter((mob) => mob.hp > 0).map((mob) => mob.id);
    captureCombatArena(arena, state, arena.nowUs);
    while (!arena.actions.some((action) => action.skillId === 'attack.meteor'
      && action.impactCount && action.impactCount > 0) && attempts++ < 260) {
      const before = state.player.mana;
      stepCombat(state, { arena, autoSkills: false, manual });
      manaDebited += Math.max(0, before - state.player.mana);
    }

    const meteorActions = arena.actions.filter((action) => action.skillId === 'attack.meteor');
    expect(meteorActions).toHaveLength(1);
    expect(meteorActions[0].area?.center).toEqual(point);
    expect(meteorActions[0].cancelReason).toBeUndefined();
    const hits = state.fx.filter((event) => event.kind === 'hit' && event.skillId === 'attack.meteor');
    expect(hits.map((event) => event.mobId).sort()).toEqual(['survivor-a', 'survivor-b']);
    expect(manaDebited).toBe(sm.manaCostOf(sm.byId['attack.meteor']));
    expect(state.skills.cd['attack.meteor']).toBeGreaterThan(0);
  });

  it('spends an out-of-reach melee basic once and does not revive it when the target returns', () => {
    const run = (moveOutside: boolean) => {
      const { state, arena } = encounter([{ id: 'target', x: 1.6, y: 6 }], 'one-handed sword');
      const target = state.group[0];
      arena.focusId = target.id;
      for (const actor of Object.values(arena.mobs)) actor.holdAtRange = true;
      let attempts = 0;
      while (!arena.actions.some((action) => action.actorId === 'player' && action.kind === 'swing')
        && attempts++ < 80) stepCombat(state, { arena, autoSkills: false });
      const initial = arena.actions.find((action) => action.actorId === 'player' && action.kind === 'swing')!;
      expect(initial).toBeDefined();
      const firstId = initial.id;
      if (moveOutside) {
        arena.mobs[target.id].x = 1.701;
        expect(Math.hypot(arena.player.x - arena.mobs[target.id].x,
          arena.player.y - arena.mobs[target.id].y)).toBeGreaterThan(0.70);
        expect(arenaPlayerInReach(arena, characterSheet(state).weaponName, target.id)).toBe(false);
      }
      while (arena.actions.find((action) => action.id === firstId)?.releasedAtUs == null && attempts++ < 80)
        stepCombat(state, { arena, autoSkills: false });
      const first = arena.actions.find((action) => action.id === firstId)!;
      expect(first.releasedAtUs).toBeDefined();
      expect(first.impactCount).toBe(1);
      if (moveOutside) arena.mobs[target.id].x = 1.6;
      while (arena.actions.filter((action) => action.actorId === 'player' && action.kind === 'swing').length < 2
        && attempts++ < 120) stepCombat(state, { arena, autoSkills: false });
      const swings = arena.actions.filter((action) => action.actorId === 'player' && action.kind === 'swing');
      const nextId = swings[1].id;
      while (arena.actions.find((action) => action.id === nextId)?.releasedAtUs == null && attempts++ < 160)
        stepCombat(state, { arena, autoSkills: false });
      const next = arena.actions.find((action) => action.id === nextId)!;
      const liveFirst = arena.actions.find((action) => action.id === firstId)!;
      return { first: liveFirst, next, hits: state.fx.filter((event) => event.kind === 'hit'
        && event.via === 'swing' && event.mobId === target.id) };
    };

    const control = run(false);
    const missed = run(true);
    expect(missed.first.impactCount).toBe(1);
    expect(missed.first.releasedAtUs).toBe(missed.first.timing?.releaseAtUs);
    expect(missed.hits).toHaveLength(1);
    expect(missed.hits[0].atUs).toBe(missed.next.timing?.releaseAtUs);
    expect(missed.next.atUs).toBe(control.next.atUs);
    expect(missed.next.timing?.releaseAtUs).toBe(control.next.timing?.releaseAtUs);
  });
});

describe('T3 Split Shot committed impact circle', () => {
  it('uses the release circle after an interceptor, hits four live occupants once, and ignores the contact circle', () => {
    const { state, arena } = encounter([
      { id: 'anchor', x: 5.5, y: 6 },
      { id: 'inside-a', x: 5, y: 6.7 },
      { id: 'inside-b', x: 5.5, y: 5.4 },
      { id: 'inside-c', x: 6.4, y: 6.2 },
      { id: 'interceptor', x: 2.2, y: 6 },
      { id: 'contact-only', x: 2, y: 7.5 },
      { id: 'outside', x: 8.1, y: 6 },
      { id: 'dead-inside', x: 5.1, y: 6.2, hp: 0 },
    ], 'bow');
    state.skills.owned['attack.split_shot'] = 0;
    state.skills.list[0] = 'attack.split_shot';
    arena.focusId = 'anchor';
    for (const actor of Object.values(arena.mobs)) actor.holdAtRange = true;
    const manual: ManualControl = { cast: { skillId: 'attack.split_shot' } };
    let manaDebited = 0;
    let attempts = 0;
    while (!state.fx.some((event) => event.kind === 'cast' && event.skillId === 'attack.split_shot')
      && attempts++ < 80) {
      const before = state.player.mana;
      stepCombat(state, { arena, autoSkills: false, manual });
      manaDebited += Math.max(0, before - state.player.mana);
    }
    const cast = state.fx.find((event) => event.kind === 'cast' && event.skillId === 'attack.split_shot')!;
    expect(cast).toBeDefined();
    const committedArea = cast.skillOutcome?.area!;
    expect(committedArea).toBeDefined();
    expect(committedArea.radiusM).toBe(2);
    const source = { x: arena.player.x, y: arena.player.y };
    const dx = committedArea.center.x - source.x;
    const dy = committedArea.center.y - source.y;
    const length = Math.hypot(dx, dy);
    const direction = { x: dx / length, y: dy / length };
    const perpendicular = { x: -direction.y, y: direction.x };
    const pose = (along: number, across = 0) => ({
      x: committedArea.center.x + direction.x * along + perpendicular.x * across,
      y: committedArea.center.y + direction.y * along + perpendicular.y * across,
    });
    const pinActor = (id: string, position: { x: number; y: number }) => {
      const actor = arena.mobs[id];
      if (!actor) return;
      Object.assign(actor, position, { holdAtRange: true, moving: false });
      const slot = state.field!.slots.find((entry) => entry.mobId === id);
      if (slot) slot.home = { ...position };
    };
    pinActor('anchor', pose(0));
    pinActor('inside-a', pose(-0.2, 0.8));
    pinActor('inside-b', pose(0, 1.2));
    pinActor('inside-c', pose(0.2, -0.9));
    pinActor('interceptor', pose(-3));
    pinActor('contact-only', pose(-3, 1.5));
    pinActor('outside', pose(2.8));
    state.field!.engagementIds = state.group.filter((mob) => mob.hp > 0).map((mob) => mob.id);
    captureCombatArena(arena, state, arena.nowUs);
    while (!arena.actions.some((entry) => entry.skillId === 'attack.split_shot' && (entry.impactCount ?? 0) > 0)
      && attempts++ < 160) {
      const before = state.player.mana;
      stepCombat(state, { arena, autoSkills: false, manual });
      manaDebited += Math.max(0, before - state.player.mana);
    }

    const action = arena.actions.find((entry) => entry.skillId === 'attack.split_shot')!;
    expect(action).toBeDefined();
    const committedCenter = { ...committedArea.center };
    expect(action.area).toEqual(committedArea);
    expect(action.payloads?.[0]?.targetId).toBe('anchor');
    expect(action.payloads?.[0]?.contact?.x).toBeLessThan(3);
    const contact = action.payloads?.[0]?.contact!;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    expect(dist(contact, committedCenter)).toBeGreaterThan(2);
    expect(dist(arena.mobs['inside-a'], committedCenter)).toBeLessThan(2);
    expect(dist(arena.mobs['inside-a'], contact)).toBeGreaterThan(2);
    expect(dist(arena.mobs['contact-only'], contact)).toBeLessThan(2);
    expect(dist(arena.mobs['contact-only'], committedCenter)).toBeGreaterThan(2);
    expect(action.impactCount).toBe(1);
    expect(action.hitIds?.sort()).toEqual(['anchor', 'inside-a', 'inside-b', 'inside-c']);
    const hits = state.fx.filter((event) => event.kind === 'hit' && event.actionId === action.id);
    expect(hits.map((event) => event.mobId).sort()).toEqual(['anchor', 'inside-a', 'inside-b', 'inside-c']);
    expect(new Set(hits.map((event) => event.mobId)).size).toBe(4);
    expect(manaDebited).toBe(sm.manaCostOf(sm.byId['attack.split_shot']));
    expect(state.skills.cd['attack.split_shot']).toBeGreaterThan(0);
    expect(state.group.find((mob) => mob.id === 'interceptor')?.hp).toBe(1e9);
    expect(state.group.find((mob) => mob.id === 'contact-only')?.hp).toBe(1e9);

    // Another world second cannot replay the already resolved projectile.
    for (let index = 0; index < 40; index++) stepCombat(state, { arena, autoSkills: false });
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === action.id)).toHaveLength(4);
    expect(action.area?.center).toEqual(committedCenter);
  });
});
