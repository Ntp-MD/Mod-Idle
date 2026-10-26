import { describe, expect, it } from 'vitest';
import { E } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import {
  arenaDistance, arenaInRange, arenaMobRange, arenaSkillRange, arenaWeaponRange, captureCombatArena,
  createCombatArena, sampleCombatArena, syncCombatArena,
} from '../src/sim/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '../src/sim/game';
import { skillEligibilityInState } from '../src/sim/skills';

function fight(distance = 15) {
  const state = newGame(17);
  setLevel(state, 30);
  state.hunting = true;
  state.spawnIn = 999;
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'arena-target', hp: 1e8, hpMax: 1e8, ps: 1, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
  });
  state.group = [mob];
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 1 + distance, y: 6 });
  captureCombatArena(arena, state, 0);
  return { state, mob, arena };
}

describe('opt-in spatial combat', () => {
  it('approaches before either side can swing, then resolves real canonical attacks in range', () => {
    const { state, mob, arena } = fight();
    const initialHp = mob.hp;
    for (let i = 0; i < 2; i++) tick(state, { arena, autoSkills: false });
    expect(mob.hp).toBe(initialHp);
    expect(state.counters.damage || 0).toBe(0);
    expect(arena.actions).toHaveLength(0);
    expect(arenaDistance(arena.player, arena.mobs[mob.id])).toBeLessThan(15);

    for (let i = 0; i < 4; i++) tick(state, { arena, autoSkills: false });
    expect(state.counters.damage).toBeGreaterThan(0);
    expect(mob.hp).toBeLessThan(initialHp);
    expect(arena.actions.some((action) => action.actorId === 'player')).toBe(true);
    expect(arena.actions.some((action) => action.actorId === mob.id)).toBe(true);
    for (const action of arena.actions.filter((action) => action.kind === 'swing')) {
      const range = action.actorId === 'player' ? arenaWeaponRange(characterSheet(state).weaponName) : arenaMobRange(mob);
      expect(Math.hypot(action.targetX! - action.x, action.targetY! - action.y)).toBeLessThanOrEqual(range + 1e-7);
    }
  });

  it('withholds offensive skill costs and cooldowns until a target is in its own range', () => {
    const { state, arena } = fight();
    const id = 'attack.fireball';
    state.skills.owned[id] = 0;
    state.skills.list[0] = id;
    const character = characterSheet(state);
    const ordinary = skillEligibilityInState(state, character, id);
    expect(ordinary.ready).toBe(true);
    expect(skillEligibilityInState(state, character, id, true, state.group)).toEqual(ordinary);
    const reached = state.group.filter((mob) => arenaInRange(arena, mob.id, arenaSkillRange(id)));
    expect(skillEligibilityInState(state, character, id, true, reached).reason).toBe('no-target');
    tick(state, { arena });
    expect(state.skills.cd[id] || 0).toBe(0);
    expect(state.fx.some((event) => event.kind === 'cast' && event.skillId === id)).toBe(false);
    for (let i = 0; i < 4; i++) tick(state, { arena });
    const cast = arena.actions.find((action) => action.actorId === 'player' && action.skillId === id);
    expect(cast).toBeDefined();
    expect(Math.hypot(cast!.targetX! - cast!.x, cast!.targetY! - cast!.y)).toBeLessThanOrEqual(arenaSkillRange(id) + 1e-7);
    expect(state.counters.damageBy?.cast).toBeGreaterThan(0);
  });

  it('keeps point-blank damage, RNG, rewards and ordinary clocks identical to the existing mode', () => {
    const { state, arena } = fight(E.combat_arena.range.melee);
    const ordinary = structuredClone(state);
    // Ground positions are presentation facts owned by the live arena; gameplay fields must agree.
    const withoutGroundFacts = (s: typeof state) => ({ ...s, field: s.field ? {
      ...s.field, player: undefined, actors: undefined, farmingAnchor: undefined,
    } : s.field });
    for (let i = 0; i < 8; i++) {
      tick(state, { arena, autoSkills: false });
      tick(ordinary, { autoSkills: false });
      expect(withoutGroundFacts(state)).toEqual(withoutGroundFacts(ordinary));
    }
  });

  it('walks three melee bodies into distinct contact positions with real attack range and bounded speed', () => {
    const { state, mob } = fight();
    state.group = [0, 1, 2].map((index) => ({ ...structuredClone(mob), id: `contact-${index}` }));
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    const twinState = structuredClone(state);
    const twinArena = structuredClone(arena);
    for (let i = 0; i < 10; i++) {
      tick(state, { arena, autoSkills: false });
      tick(twinState, { arena: twinArena, autoSkills: false });
    }
    expect(arena).toEqual(twinArena);
    // Only engaged bodies move, act and keep contact spacing; visible idle population stays home.
    const actors = state.group.map((entry) => arena.mobs[entry.id]);
    for (const actor of actors) {
      expect(arenaDistance(actor, arena.player)).toBeLessThanOrEqual(E.combat_arena.range.melee + 1e-7);
      expect(arena.actions.some((action) => action.actorId === actor.id)).toBe(true);
      for (const other of actors) if (other !== actor)
        expect(arenaDistance(actor, other)).toBeGreaterThan(E.combat_arena.range.melee);
    }
    for (let index = 1; index < arena.frames.length; index++) {
      const previous = arena.frames[index - 1];
      const current = arena.frames[index];
      const maxDistance = (current.atUs - previous.atUs) / arena.unitsPerSec * E.combat_arena.mob_speed;
      for (const actor of Object.values(current.mobs))
        expect(arenaDistance(actor, previous.mobs[actor.id])).toBeLessThanOrEqual(maxDistance + 1e-7);
    }
    for (const action of arena.actions.filter((action) => action.kind === 'swing'))
      expect(Math.hypot(action.targetX! - action.x, action.targetY! - action.y)).toBeLessThanOrEqual(E.combat_arena.range.melee + 1e-7);
  });

  it('holds a weapon-bound press until the fitting weapon is held (showcase all-in-one cast)', () => {
    const { state, arena } = fight();
    const id = 'attack.piercing_shot'; // bow-bound
    state.skills.owned[id] = 0;
    state.skills.list.fill(null);
    state.skills.list[0] = id;
    // The opening character is bare-handed, so a bow row is refused until a bow is actually held.
    expect(skillEligibilityInState(state, characterSheet(state), id).reason).toBe('weapon');
    const mainHandIndex = state.gear.findIndex((piece) => piece?.slot === 'main hand');
    const slot = mainHandIndex >= 0 ? mainHandIndex : 0;
    state.gear[slot] = { slot: 'main hand', base: 'bow', ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] };
    expect(skillEligibilityInState(state, characterSheet(state), id).reason).toBe('ready');
    state.skills.cd[id] = 0;
    let castSeen = false;
    for (let i = 0; i < 8 && !castSeen; i++) {
      tick(state, { arena });
      castSeen = state.fx.some((event) => event.kind === 'cast' && event.skillId === id);
    }
    expect(castSeen).toBe(true);
  });

  it('samples status stacks and remaining time at the impact without leaking later live mutations', () => {
    const { state, mob, arena } = fight();
    captureCombatArena(arena, state, 0);
    state.playerStatuses.chill = { stacks: 1, secLeft: 4, perSec: 0 };
    state.mobStatus[mob.id] = {
      statuses: { burn: { stacks: 2, secLeft: 3, perSec: 25 } },
      alignedPerSec: 0, stoppedSec: 0, elapsedSec: 0,
    };
    captureCombatArena(arena, state, 250_000);
    state.playerStatuses.chill.stacks = 7;
    state.mobStatus[mob.id].statuses.burn!.secLeft = 1;
    const before = sampleCombatArena(arena, 249_999);
    const impact = sampleCombatArena(arena, 250_000);
    expect(before.player.statuses?.chill).toBeUndefined();
    expect(before.mobs[mob.id].statuses?.burn).toBeUndefined();
    expect(impact.player.statuses?.chill).toEqual({ stacks: 1, secLeft: 4 });
    expect(impact.mobs[mob.id].statuses?.burn).toEqual({ stacks: 2, secLeft: 3 });
    expect(impact.mobs[mob.id].statuses?.burn).not.toHaveProperty('perSec');
  });

  it('ignores an arena during offline catch-up and respects the read-only writer gate', () => {
    const { state, arena } = fight();
    const ordinary = structuredClone(state);
    const untouched = structuredClone(arena);
    tick(state, { arena, writer: false });
    expect(state).toEqual(ordinary);
    for (let i = 0; i < 4; i++) {
      tick(state, { arena, online: false });
      tick(ordinary, { online: false });
    }
    expect(state).toEqual(ordinary);
    expect(arena).toEqual(untouched);
    expect('arena' in state).toBe(false);
  });

  it('samples movement smoothly and changes HP/death only on the resolved impact timestamp', () => {
    const { state, mob, arena } = fight(E.combat_arena.range.melee);
    mob.hp = mob.hpMax = 1;
    for (let i = 0; i < 5 && !state.counters.kills; i++) tick(state, { arena, autoSkills: false });
    expect(state.counters.kills).toBe(1);
    const kill = state.fx.find((event) => event.kind === 'kill' && event.mobId === mob.id)!;
    expect(kill.atUs).toBeGreaterThan(0);
    const before = sampleCombatArena(arena, kill.atUs! - 1);
    const impact = sampleCombatArena(arena, kill.atUs!);
    expect(before.mobs[mob.id]?.hp).toBeGreaterThan(0);
    expect(before.bodies).toHaveLength(0);
    expect(impact.mobs[mob.id]).toBeUndefined();
    expect(impact.bodies[0]?.id).toBe(mob.id);
    expect(impact.bodies[0]?.diedAtUs).toBe(kill.atUs);
    expect(impact.player.es).toBeTypeOf('number');
    expect(impact.player.mana).toBeTypeOf('number');

    const moving = fight();
    tick(moving.state, { arena: moving.arena, autoSkills: false });
    const a = sampleCombatArena(moving.arena, 100_000).player;
    const b = sampleCombatArena(moving.arena, 125_000).player;
    const c = sampleCombatArena(moving.arena, 150_000).player;
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.x).toBeCloseTo((a.x + c.x) / 2, 10);
  });
});
