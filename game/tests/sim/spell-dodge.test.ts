import { describe, expect, it } from 'vitest';
import { E, tree } from '../../src/engine/client';
import { ghostDanceRecovery } from '../../../engine/keystones.ts';
import { mobSwing } from '@sim/combat/combat';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { createCombatArena, syncCombatArena, captureCombatArena, mobAttackProfile } from '@sim/combat/combat-arena';
import { mobFixture } from '../fixtures/mobFixture';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import { mulberry32 } from '../../src/engine/client-helpers';
import { CombatClock } from '@sim/combat/combat-clock';
import { createIncomingHit } from '@sim/core/tick/incoming-hit';
import type { MobSkillRow } from '@engine/types.ts';

/**
 * C4 — attack dodge vs spell dodge (decided round 3).
 *
 * Single routed roll: attack→Evasion, spell→Spell Dodge (flat, tree-only, cap 30), none→no roll.
 * Perfect Dodge and Ghost Dance apply full to spells; ignores_dodge bypasses both. Basics use
 * their own profile class; DoT never dodges; offline mirrors live.
 */
function swingingMob() {
  return {
    ...mobFixture({ id: 'striker', hp: 1e9, hpMax: 1e9, innate: [], skillIds: [] }),
    ps: 100, hitsPerSec: 1, acc: 10, damage: 'physical' as const,
  };
}

describe('C4 spell dodge routing', () => {
  it('routes attack hits to Evasion and spell hits to Spell Dodge, never both', () => {
    const c = { ...buildCharacter(1, emptyGear()), evasion: 1e9, spellDodgeChance: 100, perfectDodge: 0 };
    const mob = swingingMob();
    // Attack rolls Evasion only: evasion always succeeds here, spell dodge never answers.
    const attack = mobSwing(() => 0, c, mob as never, {}, undefined as never, 0, 0, false, 1e9, { hitClass: 'attack' });
    expect(attack.blocked).toBe('evasion');
    // Spell rolls Spell Dodge only: forced success, and Evasion is not consulted.
    const weak = { ...c, evasion: 0 };
    const spell = mobSwing(() => 0.999, weak, mob as never, {}, undefined as never, 0, 0, false, 1e9, { hitClass: 'spell' });
    expect(spell.blocked).toBe('spell dodge');
    // No spell dodge and no evasion: the spell lands.
    const open = { ...weak, spellDodgeChance: 0 };
    const landed = mobSwing(() => 0.999, open, mob as never, {}, undefined as never, 0, 0, false, 1e9, { hitClass: 'spell' });
    expect(landed.blocked).toBeNull();
    expect(landed.toHp + landed.toEs).toBeGreaterThan(0);
  });

  it('rolls nothing for hit_class none', () => {
    const c = { ...buildCharacter(1, emptyGear()), evasion: 0, spellDodgeChance: 0, perfectDodge: 0 };
    const mob = swingingMob();
    const callsFor = (hitClass: 'attack' | 'spell' | 'none') => {
      let calls = 0;
      mobSwing(() => { calls++; return 0.999; }, c, mob as never, {}, undefined as never,
        0, 0, false, 1e9, { hitClass });
      return calls;
    };
    // A direct non-dodgeable hit reaches damage with no Perfect Dodge or routed-roll draw.
    const r = mobSwing(() => 0.999, c, mob as never, {}, undefined as never, 0, 0, false, 1e9, { hitClass: 'none' });
    expect(r.blocked).toBeNull();
    const noneDraws = callsFor('none');
    expect(callsFor('attack')).toBe(noneDraws + 2); // Perfect Dodge + Evasion
    expect(callsFor('spell')).toBe(noneDraws + 2); // Perfect Dodge + Spell Dodge
  });

  it('ignores_dodge bypasses Perfect Dodge and the routed roll', () => {
    const c = { ...buildCharacter(1, emptyGear()), evasion: 1e9, spellDodgeChance: 100, perfectDodge: 100 };
    const mob = swingingMob();
    const attack = mobSwing(() => 0, c, mob as never, {}, undefined as never, 0, 0, false, 1e9, { hitClass: 'attack', ignoresDodge: true });
    expect(attack.blocked).toBeNull();
    const spell = mobSwing(() => 0, c, mob as never, {}, undefined as never, 0, 0, false, 1e9, { hitClass: 'spell', ignoresDodge: true });
    expect(spell.blocked).toBeNull();
  });

  it('applies Perfect Dodge to spells', () => {
    const c = { ...buildCharacter(1, emptyGear()), evasion: 0, spellDodgeChance: 0, perfectDodge: 100 };
    const mob = swingingMob();
    const r = mobSwing(() => 0.999, c, mob as never, {}, undefined as never, 0, 0, false, 1e9, { hitClass: 'spell' });
    expect(r.blocked).toBe('perfect dodge');
  });

  it('reads spell dodge from the sheet: base 0, Spellward 20, cap 30', () => {
    expect(E.caps.spell_dodge).toBe(30);
    const plain = buildCharacter(30, emptyGear());
    expect(plain.spellDodgeChance).toBe(0);
    const warded = buildCharacter(30, emptyGear(), {}, 0, undefined, undefined, { 'keystone.spellward': 1 });
    expect(warded.spellDodgeChance).toBe(20);
    expect(warded.evasion).toBeCloseTo(plain.evasion * 0.9, 8);
  });

  it('answers spell strikes with spell dodge live, never evasion — and the same offline', () => {
    const run = (online: boolean) => {
      const state = newGame(913);
      setLevel(state, 30);
      state.hunting = true;
      state.player.hp = 1e9;
      state.player.treeRanks = { 'keystone.spellward': 1 };
      const mob = spawnMob(mulberry32(7), 1, 'normal');
      Object.assign(mob, {
        id: 'caster', hp: 1e9, hpMax: 1e9, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
        armour: 0, line: 'stand-off', damage: 'physical', innate: ['cold'], hitsPerSec: 20, atkTimer: 0,
        skillIds: ['mob.cold.ice-shard'], skillReadyAtUs: {},
      });
      state.group = [mob];
      state.skills.list.fill(null);
      const arena = createCombatArena();
      syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
      Object.assign(arena.player, { x: 1, y: 6 });
      Object.assign(arena.mobs[mob.id], { x: 4, y: 6 });
      captureCombatArena(arena, state, 0);
      pinFieldPopulation(state);
      // Spellward's 20% is deterministic under the fixed seed; give the fight enough casts that
      // at least one routed spell-dodge roll succeeds in both the live and offline paths.
      for (let i = 0; i < 80; i++) {
        if (mob.skillReadyAtUs) mob.skillReadyAtUs['mob.cold.ice-shard'] = 0;
        tick(state, { online, ...(online ? { arena } : {}) });
        if (state.fx.some((e) => e.kind === 'block' && (e as any).byId === 'caster'
          && (e as any).text === 'spell dodge')) break;
      }
      const blocks = state.fx.filter((e) => e.kind === 'block' && (e as any).byId === 'caster');
      return { blocks, state };
    };
    for (const online of [true, false]) {
      const { blocks } = run(online);
      expect(blocks.length, online ? 'live' : 'offline').toBeGreaterThan(0);
      expect(blocks.some((b) => b.text === 'spell dodge')).toBe(true);
      expect(blocks.some((b) => b.text === 'evasion')).toBe(false);
    }
  });

  it('routes ordinary incoming basics by their authored attack profile, even with a spell-like Element', () => {
    const run = (online: boolean) => {
      const state = newGame(914);
      setLevel(state, 30);
      state.hunting = true;
      state.player.hp = 1e9;
      state.player.treeRanks = { 'keystone.spellward': 1 };
      const mob = spawnMob(mulberry32(8), 1, 'normal');
      Object.assign(mob, {
        id: 'basic', hp: 1e9, hpMax: 1e9, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
        armour: 0, line: 'stand-off', damage: 'physical', innate: ['cold'], hitsPerSec: 1, atkTimer: 0,
        engageSec: 0,
        skillIds: [], skillReadyAtUs: {},
      });
      expect(mobAttackProfile(mob).hit_class).toBe('attack');
      state.group = [mob];
      state.skills.list.fill(null);
      const arena = createCombatArena();
      syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
      Object.assign(arena.player, { x: 1, y: 6 });
      Object.assign(arena.mobs[mob.id], { x: 4, y: 6 });
      captureCombatArena(arena, state, 0);
      pinFieldPopulation(state);
      for (let i = 0; i < 5; i++) tick(state, { autoSkills: false, online, ...(online ? { arena } : {}) });
      return state.fx.filter((e) => (e.kind === 'taken' || e.kind === 'block') && (e as any).byId === 'basic');
    };

    for (const online of [true, false]) {
      const receipts = run(online);
      expect(receipts.some((e) => e.kind === 'taken'), online ? 'live basic damage' : 'offline basic damage').toBe(true);
      expect(receipts.some((e) => e.kind === 'block' && e.text === 'spell dodge'), online ? 'live basic' : 'offline basic').toBe(false);
    }
  });

  it('recovers ES from Ghost Dance after an actual spell-dodge success', () => {
    const run = (online: boolean, ghostDance: boolean) => {
      const state = newGame(913);
      setLevel(state, 30);
      state.hunting = true;
      state.player.hp = 1e9;
      state.player.treeRanks = {
        'keystone.spellward': 1,
        ...(ghostDance ? { 'keystone.ghost-dance': 1 } : {}),
      };
      const mob = spawnMob(mulberry32(7), 1, 'normal');
      Object.assign(mob, {
        id: 'caster', hp: 1e9, hpMax: 1e9, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
        armour: 0, line: 'stand-off', damage: 'physical', innate: ['cold'], hitsPerSec: 20, atkTimer: 0,
        skillIds: ['mob.cold.ice-shard'], skillReadyAtUs: {},
      });
      state.group = [mob];
      state.skills.list.fill(null);
      const arena = createCombatArena();
      syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
      Object.assign(arena.player, { x: 1, y: 6 });
      Object.assign(arena.mobs[mob.id], { x: 4, y: 6 });
      captureCombatArena(arena, state, 0);
      pinFieldPopulation(state);
      const sheet = characterSheet(state);
      const startEs = sheet.es / 2;
      state.player.es = startEs;
      const ghost = tree.keystoneBundles(state.player.treeRanks).find((entry) => entry.key === 'ghost-dance');
      const expectedRecovery = ghost
        ? ghostDanceRecovery(sheet.evasion, sheet.es, ghost.params as Record<string, number>) : 0;
      for (let i = 0; i < 80; i++) {
        if (mob.skillReadyAtUs) mob.skillReadyAtUs['mob.cold.ice-shard'] = 0;
        tick(state, { online, ...(online ? { arena } : {}) });
        if (state.fx.some((e) => e.kind === 'block' && (e as any).byId === 'caster'
          && (e as any).text === 'spell dodge')) break;
      }
      const blocks = state.fx.filter((e) => e.kind === 'block' && (e as any).byId === 'caster');
      return { blocks, endEs: state.player.es, expectedRecovery };
    };

    for (const online of [true, false]) {
      const withoutGhost = run(online, false);
      const withGhost = run(online, true);
      expect(withGhost.blocks.some((e) => e.text === 'spell dodge'), online ? 'live spell dodge' : 'offline spell dodge').toBe(true);
      expect(withGhost.expectedRecovery).toBeGreaterThan(0);
      const recovery = withGhost.endEs - withoutGhost.endEs;
      const procCount = Math.round(recovery / withGhost.expectedRecovery);
      expect(procCount).toBeGreaterThanOrEqual(1);
      expect(recovery).toBeCloseTo(procCount * withGhost.expectedRecovery, 6);
    }
  });

  it('applies player DoT through recovery without invoking a dodge or block roll', () => {
    const state = newGame(915);
    setLevel(state, 30);
    state.hunting = true;
    state.group = [];
    state.player.hp = 1e9;
    state.player.es = 0;
    state.playerStatuses.burn = { stacks: 1, secLeft: 5, perSec: 10, alignedSec: 100 };
    state.fx = [];

    tick(state, { online: false });

    const dot = state.fx.filter((event) => event.kind === 'taken' && event.via === 'dot');
    expect(dot).toHaveLength(1);
    expect(dot[0]!.value).toBeGreaterThan(0);
    expect(state.fx.some((event) => event.kind === 'block')).toBe(false);
  });
});


describe('ignores_dodge travels the live incoming path, not only the low-level roll', () => {
  const strike = (rules?: string[]): MobSkillRow => ({
    id: 'mob.test.bypass', name: 'Bypass', mode: 'strike', hit_class: 'attack',
    element: null, ...(rules ? { rules } : {}),
  });

  const run = (rules?: string[]) => {
    const state = newGame(916);
    state.player.hp = 1_000;
    state.player.es = 0;
    state.player.charges = 0;
    state.player.blockCharges = 0;
    const sheet = { ...buildCharacter(30, emptyGear()), perfectDodge: 100, evasion: 0,
      spellDodgeChance: 0, block: 0, damageTaken: 1 };
    const mob = { ...mobFixture({ id: 'duelist', hp: 1e9, hpMax: 1e9, innate: [], skillIds: [] }),
      ps: 100, hitsPerSec: 1, acc: 10, damage: 'physical' as const };
    const clock = new CombatClock(0, 1_000_000);
    const { resolveIncomingHit } = createIncomingHit({
      arena: undefined, clock, rng: () => 0, s: state, c: sheet, units: 1_000_000, online: false,
      rkH: state.keystoneRuntime, statuses: state.playerStatuses, statusesAppliedThisTick: new Set(),
      trig: { crit: null, taken: null }, immune: false, absorbPct: 0, berserk: undefined,
      berserkDealt: 1, mobMods: () => undefined, queueTrigger: () => {}, cancelIntent: () => {},
      cancelPlayerBasic: () => {}, onKill: () => {},
    });
    resolveIncomingHit(mob as never, strike(rules), () => 0);
    return state;
  };

  it('lets Perfect Dodge delete an ordinary strike and bypass it when the row authors the rule', () => {
    const dodged = run();
    expect(dodged.player.hp).toBe(1_000);
    expect(dodged.fx.some((event) => event.kind === 'block' && event.text === 'perfect dodge')).toBe(true);
    const bypassed = run(['ignores_dodge']);
    expect(bypassed.player.hp).toBeLessThan(1_000);
    expect(bypassed.fx.some((event) => event.kind === 'taken')).toBe(true);
  });
});
