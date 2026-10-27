import { describe, expect, it } from 'vitest';
import { E } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import {
  arenaAction, arenaDistance, arenaInRange, arenaMobRange, arenaSkillRange, arenaWeaponRange, captureCombatArena,
  createCombatArena, sampleCombatArena, syncCombatArena, advanceCombatArena, type CombatArena,
} from '../src/sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '../src/sim/core/game';
import { skillEligibilityInState } from '../src/sim/combat/skills';
import { pinFieldPopulation } from './mobFixture';

/** Reach for the two 0.25 m bodies this fixture spawns, read from the authored melee profile. */
const MELEE_REACH = E.combat_arena.normal_attack.profiles.melee.range.meters + E.combat_arena.player_radius_m * 2;

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
  pinFieldPopulation(state);
  return { state, mob, arena };
}

describe('opt-in spatial combat', () => {
  it('resumes pursuit after recovery even while the action remains in presentation history', () => {
    const { state, mob, arena } = fight(5);
    const timing = { delivery: 'melee' as const, startedAtUs: 0, releaseAtUs: 200_000,
      impactAtUs: 200_000, recoveryUntilUs: 400_000 };
    const action = arenaAction(arena, mob.id, 'cast', 0, 'player', undefined, undefined, timing)!;
    expect(action.endsAtUs).toBeGreaterThan(timing.recoveryUntilUs);
    const x = arena.mobs[mob.id].x;
    advanceCombatArena(arena, state, 450_000, { playerRange: 0, playerSpeedMult: 0,
      mobSpeedMult: () => 1, engagedIds: new Set([mob.id]) });
    expect(arena.mobs[mob.id].x).toBeLessThan(x);
    expect(x - arena.mobs[mob.id].x).toBeLessThanOrEqual(E.combat_arena.mob_speed * 0.05 + 1e-7);
  });

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

  it('links every chain hop to one action with real per-hop contacts', () => {
    const state = newGame(17);
    setLevel(state, 30);
    state.hunting = true;
    state.spawnIn = 999;
    const mk = (id: string) => {
      const mob = spawnMob(mulberry32(23), 1, 'normal');
      Object.assign(mob, {
        id, hp: 1e8, hpMax: 1e8, ps: 1, evasion: 0, dodgeRate: 0,
        armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
      });
      return mob;
    };
    state.group = [mk('chain-a'), mk('chain-b'), mk('chain-c')];
    const id = 'attack.chain_lightning';
    state.skills.owned[id] = 0;
    state.skills.list.fill(null);
    state.skills.list[0] = id;
    state.player.mana = characterSheet(state).maxMana;
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign(arena.mobs['chain-a'], { x: 3, y: 6 });
    Object.assign(arena.mobs['chain-b'], { x: 4, y: 6 });
    Object.assign(arena.mobs['chain-c'], { x: 5, y: 6 });
    captureCombatArena(arena, state, 0);
    pinFieldPopulation(state);
    for (let i = 0; i < 3; i++) tick(state, { arena });
    const hits = state.fx.filter((event) => event.kind === 'hit' && event.skillId === id);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(new Set(hits.map((hit) => hit.actionId)).size).toBe(1);
    expect(new Set(hits.map((hit) => hit.mobId)).size).toBe(hits.length);
  });
  it('repeats the same arena actions and gameplay outcomes for identical inputs', () => {
    // Arena mode now executes a real basic windup, so its hit timestamps intentionally differ from
    // the classic no-arena path. The invariant is determinism, not cross-mode timing equality.
    const first = fight(MELEE_REACH);
    const second = fight(MELEE_REACH);
    for (let index = 0; index < 8; index++) {
      tick(first.state, { arena: first.arena, autoSkills: false });
      tick(second.state, { arena: second.arena, autoSkills: false });
    }
    // The autosave receipt is wall-clock metadata, not combat state.
    expect({ ...second.state, lastSavedAt: 0 }).toEqual({ ...first.state, lastSavedAt: 0 });
    expect(second.arena).toEqual(first.arena);
  });

  it('walks three melee bodies into distinct contact positions with real attack range and bounded speed', () => {
    const { state, mob } = fight();
    state.group = [0, 1, 2].map((index) => ({ ...structuredClone(mob), id: `contact-${index}` }));
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    pinFieldPopulation(state);
    const twinState = structuredClone(state);
    const twinArena = structuredClone(arena);
    for (let i = 0; i < 20; i++) {
      tick(state, { arena, autoSkills: false });
      tick(twinState, { arena: twinArena, autoSkills: false });
    }
    expect(arena).toEqual(twinArena);
    // Only engaged bodies move, act and keep contact spacing; visible idle population stays home.
    // Contact points are real geometry: every body must reach the player without overlapping a
    // neighbour. The old fixed 120° slot ring is gone; exact pair distance is not a contract.
    const actors = state.group.map((entry) => arena.mobs[entry.id]);
    for (const actor of actors) {
      expect(arenaDistance(actor, arena.player)).toBeLessThanOrEqual(MELEE_REACH + 1e-7);
      expect(arena.actions.some((action) => action.actorId === actor.id)).toBe(true);
      for (const other of actors) if (other !== actor)
        expect(arenaDistance(actor, other)).toBeGreaterThanOrEqual(
          (actor.radiusM ?? 0.25) + (other.radiusM ?? 0.25) - 1e-6);
    }
    expect(new Set(actors.map((actor) => `${actor.x.toFixed(2)},${actor.y.toFixed(2)}`)).size).toBe(actors.length);
    for (let index = 1; index < arena.frames.length; index++) {
      const previous = arena.frames[index - 1];
      const current = arena.frames[index];
      const maxDistance = (current.atUs - previous.atUs) / arena.unitsPerSec * E.combat_arena.mob_speed;
      for (const actor of Object.values(current.mobs))
        expect(arenaDistance(actor, previous.mobs[actor.id])).toBeLessThanOrEqual(maxDistance + 1e-7);
    }
    for (const action of arena.actions.filter((action) => action.kind === 'swing'))
      expect(Math.hypot(action.targetX! - action.x, action.targetY! - action.y)).toBeLessThanOrEqual(MELEE_REACH + 1e-7);
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

  it('interpolates facing on the shortest arc across the -pi/pi seam', () => {
    const player = (atUs: number, facing: number) => ({
      id: 'player', x: 0, y: 0, facing, moving: false, radiusM: .25, hp: 1, hpMax: 1,
    });
    const arena = {
      frames: [
        { atUs: 0, player: player(0, 3), mobs: {}, bodies: [] },
        { atUs: 100_000, player: player(100_000, -3), mobs: {}, bodies: [] },
      ],
    } as unknown as CombatArena;
    const middle = sampleCombatArena(arena, 50_000).player.facing;
    expect(Math.abs(Math.abs(middle) - Math.PI)).toBeLessThan(1e-6);
  });

  it('returns an unengaged body to its home and lets it wander there', () => {
    const { state, mob, arena } = fight(10);
    const slot = state.field!.slots[0];
    const home = slot.home;
    const step = { playerRange: 2.1, playerSpeedMult: 1, mobSpeedMult: () => 1, engagedIds: new Set<string>() };
    const before = arenaDistance(arena.mobs[mob.id], home);
    advanceCombatArena(arena, state, 100_000, step);
    expect(arenaDistance(arena.mobs[mob.id], home)).toBeLessThan(before);
    const travelled = arena.mobs[mob.id].travelledM ?? 0;
    for (let index = 0; index < 120; index++) advanceCombatArena(arena, state, 200_000 + index * 100_000, step);
    expect(arenaDistance(arena.mobs[mob.id], home)).toBeLessThan(slot.roamM + 0.5);
    expect(arena.mobs[mob.id].travelledM ?? 0).toBeGreaterThan(travelled);
  });

  it('samples movement smoothly and changes HP/death only on the resolved impact timestamp', () => {
    const { state, mob, arena } = fight(MELEE_REACH);
    mob.hp = mob.hpMax = 1;    for (let i = 0; i < 5 && !state.counters.kills; i++) tick(state, { arena, autoSkills: false });
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
