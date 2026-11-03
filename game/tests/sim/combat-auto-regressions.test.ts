import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import type { NavLayout } from '@engine/navigation.ts';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { characterSheet, newGame, setLevel, tick } from '@sim/core/game';
import { aimForSkill, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { intentTargets } from '@sim/combat/combat-actions';
import { CombatClock } from '@sim/combat/combat-clock';
import { newSkillState, skillEligibility } from '@sim/combat/skills';
import { createArenaStep } from '@sim/core/tick/arena-step';
import { mobFixture, pinFieldPopulation } from '../fixtures/mobFixture';
import { installSyntheticSkill } from '../fixtures/skillFixture';

describe('combat automation regression checks', () => {
  it('reserves filler Mana using the same player override as the automatic rotation', () => {
    // Both rows are scenario-owned: the timed row carries the `auto` flag the
    // rotation reads, the filler is its zero-CD counterpart. No live data.
    const timed = installSyntheticSkill('test.audit-timed', { cd: 6, auto: 'both' });
    const filler = installSyntheticSkill('test.audit-filler', { cd: 0 });
    try {
      const skills = newSkillState();
      skills.list.splice(0, 2, timed.row.id, filler.row.id);
      for (const skillId of [timed.row.id, filler.row.id]) { skills.owned[skillId] = 0; skills.mode[skillId] = 'always'; }
      skills.cd[timed.row.id] = 2;
      const c = { ...buildCharacter(90, emptyGear()), weaponName: 'one-handed axe', manaRegen: 4 };
      const group = [mobFixture()];
      skills.autoMode = { [timed.row.id]: 'manual' };
      expect(skillEligibility(skills, c, filler.row.id, 11, group, {}).ready).toBe(true);
      (timed.row as any).auto = 'manual';
      skills.autoMode[timed.row.id] = 'both';
      expect(skillEligibility(skills, c, filler.row.id, 11, group, {}).reason).toBe('mana-reserve');
    } finally {
      timed.restore();
      filler.restore();
    }
  });

  it('lets a manual target cast approach while Hold Position stops automatic approach', () => {
    const s = newGame(913);
    s.group = [mobFixture({ id: 'target' })];
    const arena = createCombatArena();
    syncCombatArena(arena, s, 0, 1_000_000, characterSheet(s).maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign(arena.mobs.target, { x: 10, y: 6 });
    arena.intent = { skillId: 'attack.fireball', targetId: 'target',
      targetPoint: { x: 10, y: 6 }, phase: 'approach' };
    const noop = () => {};
    const step = createArenaStep({
      arena, s, clock: new CombatClock(0, 2_000_000), units: 1_000_000,
      manual: {}, holdPosition: true, autoAvoid: () => null,
      cancelPlayerBasic: noop, cancelIntent: noop, cancelMobPreparation: noop,
      advanceLiveClocks: noop, approachRange: () => 4, playerActiveFraction: 1,
      statusModsOn: () => ({ stopped: true }), syncEngagement: () => ({ added: [] }),
      scheduleMobAttacksFor: noop, sweepFlights: noop, sweepMobShots: noop, sweepPlayerShots: noop,
      fieldProfile: () => ({}),
    });
    step.advanceArenaAt(1_000_000);
    expect(arena.player.x).toBe(1);
    arena.intent.manual = true;
    step.advanceArenaAt(2_000_000);
    expect(arena.player.x).toBeGreaterThan(1);
  });

  it('rechecks sight for a focused player basic at release', () => {
    const fight = (covered: boolean) => {
      const s = newGame(914);
      setLevel(s, 30);
      s.hunting = true;
      s.skills.list.fill(null);
      s.player.atkTimer = 1;
      s.group = [mobFixture({ id: 'target', ps: 0, hitsPerSec: 0, innate: [], skillIds: [] })];
      const arena = createCombatArena();
      syncCombatArena(arena, s, 0, 1_000_000, characterSheet(s).maxHp);
      Object.assign(arena.player, { x: 5, y: 10 });
      Object.assign(arena.mobs.target, { x: 5.65, y: 10 });
      arena.focusId = 'target';
      pinFieldPopulation(s);
      if (covered) arena.nav = { version: 1, bounds: { x: 0, y: 0, width: 50, height: 32 }, cellSize: 1,
        obstacles: [{ kind: 'box', id: 'screen', x: 5.3, y: 0, width: 0.05, height: 32,
          flags: { movement: false, sight: true, projectiles: false } }] };
      tick(s, { arena, autoSkills: false, holdPosition: true });
      return s.fx.filter(event => event.kind === 'hit' && event.mobId === 'target');
    };
    expect(fight(false).length).toBeGreaterThan(0);
    expect(fight(true)).toHaveLength(0);
  });
});

function coveredCrowd() {
  const arena = createCombatArena();
  Object.assign(arena.player, { x: 5, y: 10 });
  const group = [['hidden', 6, 10], ['hidden-2', 6.1, 10], ['hidden-3', 6, 10.1],
    ['visible', 5, 11.8]].map(([id, x, y]) => {
    const mob = mobFixture({ id: String(id), hp: 1000, hpMax: 1000 });
    arena.mobs[mob.id] = { id: mob.id, x: Number(x), y: Number(y), facing: 0,
      moving: false, radiusM: 0.25, hp: mob.hp, hpMax: mob.hpMax };
    return mob;
  });
  const nav: NavLayout = { version: 1, bounds: { x: 0, y: 0, width: 50, height: 32 }, cellSize: 1,
    obstacles: [{ kind: 'box', id: 'screen', x: 5.4, y: 0, width: 0.2, height: 32,
      flags: { movement: false, sight: true, projectiles: false } }] };
  return { arena, group, nav };
}

describe('automatic skill acquisition with cover', () => {
  it.each(['attack.firestorm', 'attack.cleave'])('does not aim %s at a hidden cluster, including a cached aim', (id) => {
    const { arena, group, nav } = coveredCrowd();
    expect(aimForSkill(arena, group, id)?.mob.id).toBe('hidden');
    arena.nav = nav;
    expect(aimForSkill(arena, group, id)?.mob.id).toBe('visible');
  });

  it('invalidates a held hostile aim when its primary loses sight', () => {
    const { arena, group, nav } = coveredCrowd();
    arena.nav = nav;
    const intent = { skillId: 'attack.fireball', targetId: 'hidden',
      targetPoint: { x: 6, y: 10 }, phase: 'approach' as const };
    expect(intentTargets(arena, group, intent, true).targets).toEqual([]);
  });
});
