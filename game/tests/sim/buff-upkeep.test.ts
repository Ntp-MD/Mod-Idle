import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { toggleTrack } from '@sim/combat/skills';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, stepCombat, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';

/** F21 — upkeep lanes: rotational represses on lapse, reactive re-arms only on need. */
function ghostOnly() {
  const s = newGame(103);
  setLevel(s, 60);
  s.skills.owned['buff.ghost_dance'] = 0;
  expect(toggleTrack(s.skills, 'buff.ghost_dance').ok).toBe(true);
  return s;
}

const grants = (s: { log: { text: string }[] }) =>
  s.log.filter((l) => l.text.includes('perfect-dodge charges')).length;

describe('F21 buff upkeep — reactive pools wait for need', () => {
  it('re-arms Ghost Dance once spent, never while charges are held', () => {
    const s = ghostOnly();
    tick(s, { online: true });
    expect(s.player.charges).toBeGreaterThan(0);
    expect(grants(s)).toBe(1);
    // Cooldown (15 s) and window (10 s) both lapse with the pool untouched: no repress.
    for (let i = 0; i < 20; i++) tick(s, { online: true });
    expect(grants(s)).toBe(1);
    expect(s.player.charges).toBeGreaterThan(0);
    // Spend the pool: the next lapse re-arms.
    s.player.charges = 0;
    s.skills.cd['buff.ghost_dance'] = 0;
    s.skills.buffUp['buff.ghost_dance'] = 0;
    tick(s, { online: true });
    expect(grants(s)).toBe(2);
  });

  it('keeps an immunity buff maintained even with nothing to cleanse', () => {
    const s = newGame(104);
    setLevel(s, 60);
    s.skills.owned['buff.holy_veil'] = 0;
    expect(toggleTrack(s.skills, 'buff.holy_veil').ok).toBe(true);
    tick(s, { online: true });
    const veils = () => s.fx.filter((f) => f.kind === 'buff' && f.skillId === 'buff.holy_veil').length;
    expect(s.skills.buffUp['buff.holy_veil']).toBeGreaterThan(0);
    // Window (7 s) and cooldown (20 s) lapse with no status on you: immunity stays maintained.
    for (let i = 0; i < 22; i++) tick(s, { online: true });
    expect(veils()).toBeGreaterThan(1);
  });
});

describe('F27 hold the line — the rotation yields to a defensive re-arm', () => {
  it('never spends the re-arm mana on a filler it could afford', () => {
    const s = newGame(105);
    setLevel(s, 60);
    s.hunting = true;
    s.player.hp = 1e9;
    s.skills.owned['buff.ghost_dance'] = 0;
    s.skills.owned['attack.double_strike'] = 0;
    s.skills.list.fill(null);
    s.skills.list[0] = 'attack.double_strike';
    expect(toggleTrack(s.skills, 'buff.ghost_dance').ok).toBe(true);
    const mob = spawnMob(mulberry32(105), 1, 'normal');
    Object.assign(mob, {
      id: 'hold-target', hp: 1e9, hpMax: 1e9, ps: 0, accuracy: 0, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: [],
    });
    s.group = [mob];
    const arena = createCombatArena();
    syncCombatArena(arena, s, 0, 1_000_000, characterSheet(s).maxHp);
    Object.assign(arena.player, { x: 9.5, y: 6 });
    Object.assign(arena.mobs[mob.id], { x: 10, y: 6 });
    arena.focusId = mob.id;
    pinFieldPopulation(s);
    // Below the re-arm but above the filler: every tick the filler is affordable and refused.
    for (let i = 0; i < 5; i++) {
      s.player.mana = 12;
      tick(s, { arena });
      expect(s.player.charges ?? 0).toBe(0);
    }
    expect(arena.actions.some((a) => a.actorId === 'player' && a.skillId === 'attack.double_strike')).toBe(false);
    // Fund the re-arm: the upkeep fires and the hold lifts.
    s.player.mana = 100;
    tick(s, { arena });
    expect(s.player.charges).toBeGreaterThan(0);
  });

  it('holds a zero-cooldown filler on every combat sample, not only the world press', () => {
    const s = newGame(106);
    setLevel(s, 60);
    s.hunting = true;
    s.player.hp = 1e9;
    s.skills.owned['buff.ghost_dance'] = 0;
    s.skills.owned['attack.double_strike'] = 0;
    s.skills.list.fill(null);
    s.skills.list[0] = 'attack.double_strike';
    expect(toggleTrack(s.skills, 'buff.ghost_dance').ok).toBe(true);
    const mob = spawnMob(mulberry32(106), 1, 'normal');
    Object.assign(mob, {
      id: 'sample-hold-target', hp: 1e9, hpMax: 1e9, ps: 0, accuracy: 0, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: [],
    });
    s.group = [mob];
    const arena = createCombatArena();
    syncCombatArena(arena, s, 0, 1_000_000, characterSheet(s).maxHp);
    Object.assign(arena.player, { x: 9.5, y: 6 });
    Object.assign(arena.mobs[mob.id], { x: 10, y: 6 });
    arena.focusId = mob.id;
    pinFieldPopulation(s);
    // A zero-cooldown row would be picked on the very next sample if the hold lived only at t0.
    for (let sample = 0; sample < 40; sample++) {
      s.player.mana = 12;
      s.skills.cd['attack.double_strike'] = 0;
      stepCombat(s, { online: true, arena });
    }
    expect(s.player.charges ?? 0).toBe(0);
    expect(arena.actions.some((action) => action.actorId === 'player'
      && action.skillId === 'attack.double_strike')).toBe(false);
  });
});

describe('P2 duration — simulation time, not Haste or control', () => {
  const buffOnly = (id = 'buff.ghost_dance') => {
    const s = newGame(107);
    setLevel(s, 60);
    s.skills.owned[id] = 0;
    expect(toggleTrack(s.skills, id).ok).toBe(true);
    tick(s, { online: true });
    expect(s.skills.buffUp[id]).toBeGreaterThan(0);
    return { s, id };
  };

  it('advances the window while a shock freezes the action clock', () => {
    const { s, id } = buffOnly();
    const start = s.skills.buffUp[id];
    s.playerStatuses.shock = { secLeft: 5, stacks: 1 } as never;
    tick(s, { online: true });
    tick(s, { online: true });
    tick(s, { online: true });
    expect(s.skills.buffUp[id]).toBeCloseTo(start - 3, 9);
  });

  it('keeps a buff across an ordinary group boundary', () => {
    const { s, id } = buffOnly();
    s.group = [];
    tick(s, { online: true });
    expect(s.skills.buffs[id]).toBe(true);
    expect(s.skills.buffUp[id]).toBeGreaterThan(0);
  });

  it('discards every prior buff and charge when the run resets', () => {
    const { s, id } = buffOnly();
    s.player.charges = 2;
    s.skills.buffUp['buff.holy_veil'] = 7;
    const fresh = newGame(108);
    expect(fresh.skills.buffUp[id] ?? 0).toBe(0);
    expect(fresh.skills.buffUp['buff.holy_veil'] ?? 0).toBe(0);
    expect(fresh.player.charges ?? 0).toBe(0);
  });
});
