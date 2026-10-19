import { describe, it, expect } from 'vitest';
import { E, BASES, SKILLS, eng, tree } from '../src/engine/client';
import { newGame } from '../src/sim/game';
import { mastery, masteryLevel, dropMultiplier, weaponSkillBonusPct } from '../src/sim/mastery';
import { canSpendTree, spendTreePoint, respecTree, treePointsSpent, treeLines } from '../src/sim/tree';
import { newGoal, target, onSpawn, onKill, watch } from '../src/sim/goal';
import type { GameState, Mob } from '../src/sim/types';
import { respecStats } from '../src/sim/respec';
import { buildCharacter, openingGear } from '../src/sim/player';

/** The three progression side-tracks the game runs beside the level bar: Mastery, the passive tree, the
 *  win gate. Each one's rules live in the sim; these read them through the same calls the client makes. */

describe('weapon Mastery', () => {
  it('reads its level off the shared curve, capped at the table', () => {
    expect(mastery.level(0)).toBe(1);
    expect(mastery.level(mastery.xpForLevel(5))).toBe(5);
    expect(mastery.level(Number.MAX_SAFE_INTEGER)).toBe(BASES.mastery.level_cap);
  });

  it('pays 4 XP a kill while held, and a bare hand keeps nothing', () => {
    const s = newGame();
    const name = BASES.weapons[0].name;
    expect(masteryLevel(s, null)).toBe(1);
    s.mastery[name] = mastery.payKill(0);
    expect(s.mastery[name]).toBe(BASES.mastery.xp_per_kill);
  });

  it('counts one point of drop per type at the required level, account-wide', () => {
    const s = newGame();
    expect(dropMultiplier(s)).toBe(1);
    const need = BASES.mastery.drop_bonus_level_required;
    for (const w of BASES.weapons) s.mastery[w.name] = mastery.xpForLevel(need);
    const expected = 1 + (BASES.weapons.length * BASES.mastery.drop_bonus_per_type_pct) / 100;
    expect(dropMultiplier(s)).toBeCloseTo(expected, 10);
  });

  it('grants the while-held skill bonus from its own level, whole percent, at the cap', () => {
    expect(weaponSkillBonusPct(BASES.mastery.skill_bonus_from_level - 1)).toBe(0);
    expect(weaponSkillBonusPct(BASES.mastery.skill_bonus_from_level)).toBe(BASES.mastery.skill_bonus_per_level_pct);
    expect(weaponSkillBonusPct(BASES.mastery.level_cap)).toBe(BASES.mastery.skill_bonus_cap_pct);
  });
});

describe('the passive tree', () => {
  const spent = (s: GameState) => treePointsSpent(s);
  const firstWithNeeds = () => Object.values(tree.byId as Record<string, any>).find((n: any) => n.needs.length && !n.needs.includes('start')) as any;

  it('refuses a rank with no point banked and one past the node cap', () => {
    const s = newGame();
    s.player.treePoints = 0;
    const id = Object.keys(tree.byId)[0];
    expect(canSpendTree(s, id).ok).toBe(false);
    expect(canSpendTree(s, 'no-such-node').ok).toBe(false);

    s.player.treePoints = 1000;
    expect(canSpendTree(s, id).ok).toBe(true);
    const cap = (tree.byId as any)[id].ranks;
    for (let i = 0; i < cap; i++) spendTreePoint(s, id);
    expect(canSpendTree(s, id).ok).toBe(false);
  });

  it('requires an owned adjacent node before extending a path', () => {
    const node = firstWithNeeds();
    const s = newGame();
    s.player.treePoints = 1000;
    expect(canSpendTree(s, node.id).ok).toBe(false);
    const parent = node.needs.find((id: string) => id !== 'start');
    expect(spendTreePoint(s, parent).ok).toBe(true);
    expect(canSpendTree(s, node.id).ok).toBe(true);
  });

  it('opens a cross-linked branch from a neighbouring owned path', () => {
    const s = newGame();
    s.player.treePoints = 1000;
    for (let rank = 1; rank <= 7; rank++) expect(spendTreePoint(s, `impact.${rank}`).ok).toBe(true);
    expect(canSpendTree(s, 'control.7').ok).toBe(true);
    expect(spendTreePoint(s, 'control.7').ok).toBe(true);
    expect(canSpendTree(s, 'control.8').ok).toBe(true);
  });

  it('hands every spent point back, free, and grants the lines its ranks buy', () => {
    const s = newGame();
    s.player.treePoints = 1000;
    const id = Object.keys(tree.byId)[0];
    spendTreePoint(s, id);
    expect(spent(s)).toBe(tree.cost);
    expect(treeLines(s).length).toBeGreaterThan(0);

    const refunded = respecTree(s);
    expect(refunded).toEqual({ ok: true, refunded: tree.cost });
    expect(s.player.treeRanks).toEqual({});
    expect(treeLines(s).length).toBe(0);
    expect(respecTree(s)).toEqual({ ok: false, refunded: 0 });
  });
});

describe('settlement respec', () => {
  it.each(['field', 'camp', 'walking', 'missing-cell'])('refuses both refunds in %s without changing points', (place) => {
    const s = newGame();
    s.player.points.str = 5;
    s.player.treeRanks = { [Object.keys(tree.byId)[0]]: 1 };
    if (place === 'field') s.cell = { ...s.cell!, q: s.cell!.q + 1 };
    if (place === 'camp') s.phase = 'camp';
    if (place === 'walking') s.walk = {} as GameState['walk'];
    if (place === 'missing-cell') s.cell = null;
    const before = structuredClone(s.player);
    expect(respecStats(s)).toEqual({ ok: false, refunded: 0 });
    expect(respecTree(s)).toEqual({ ok: false, refunded: 0 });
    expect(s.player).toEqual(before);
  });

  it('refunds allocated stats exactly once for free in a settlement', () => {
    const s = newGame();
    s.player.points.str = 5;
    s.player.points.vit = 3;
    const banked = s.player.statPoints;
    expect(respecStats(s)).toEqual({ ok: true, refunded: 8 });
    expect(Object.values(s.player.points).every((n) => n === 0)).toBe(true);
    expect(s.player.statPoints).toBe(banked + 8);
    expect(respecStats(s)).toEqual({ ok: false, refunded: 0 });
  });
});

describe('resistance ceiling', () => {
  it('caps at 75% normally and lets only passive ranks extend it to 90%', () => {
    const s = newGame();
    s.gear = openingGear();
    const item = s.gear.find((g) => g)!;
    item.lines = [
      { id: 'elemental_resistance', value: 200 },
      { id: 'elemental_resistance_cap_pct', value: 15 },
    ];
    const base = buildCharacter(s.player.level, [item]);
    expect(base.resCap).toBe(75);
    expect(base.resistance).toBe(75);
    const node = Object.values(tree.byId).find((n) => n.line === 'elemental_resistance_cap_pct')!;
    for (let rank = 1; rank <= node.ranks; rank++) {
      const c = buildCharacter(s.player.level, [item], {}, 0, undefined, undefined, { [node.id]: rank });
      expect(c.resCap).toBe(Math.min(90, 75 + node.values[rank - 1]));
      expect(c.resistance).toBe(c.resCap);
    }
    expect(eng.elemResCapOf(1000)).toBe(90);
  });
});

describe('the win gate', () => {
  const bossOf = (zone: number, id = 'b1'): Mob => ({
    id, species: 'Slime', kind: 'Boss', zone, level: 20, hp: 1e6, hpMax: 1e6, ps: 100, acc: 100,
    evasion: 0, dodgeRate: 0, armour: 0, res: 0, damage: 'mixed', innate: [], xp: 1, line: 'front',
    hitsPerSec: 1, atkTimer: 0, engageSec: 0,
  });

  it('arms only on the final zone boss, and counts the attempt', () => {
    const s = newGame();
    s.goal = newGoal();
    const t = target();
    onSpawn(s, bossOf(t.zone - 1));
    expect(s.goal.spawnId).toBeNull();
    onSpawn(s, bossOf(t.zone));
    expect(s.goal.spawnId).toBe('b1');
    expect(s.goal.attempts).toBe(1);
  });

  it('closes only on the armed spawn, and only while no Push landed', () => {
    const s = newGame();
    s.goal = newGoal();
    const t = target();
    const boss = bossOf(t.zone);
    onSpawn(s, boss);
    expect(onKill(s, bossOf(t.zone, 'other'))).toBe(false);

    s.counters.pushes = s.goal.pushesAtSpawn + 1;
    expect(onKill(s, boss)).toBe(false);
    expect(s.goal.done).toBeNull();

    onSpawn(s, boss);
    const clean = onKill(s, boss);
    expect(clean).toBe(true);
    expect(s.goal.done).toMatchObject({ level: s.player.level, hp: boss.hpMax });
    expect(s.goal.attempts).toBe(2);
  });

  it('drops an armed spawn that leaves the field alive', () => {
    const s = newGame();
    s.goal = newGoal();
    const boss = bossOf(target().zone);
    onSpawn(s, boss);
    s.group = [];
    watch(s);
    expect(s.goal.spawnId).toBeNull();
    expect(s.goal.attempts).toBe(1);
  });
});

describe('the goal states the gate in the curve\u2019s own numbers', () => {
  it('names the final zone and the HP the mob curve gives its boss', () => {
    const t = target();
    expect(t.zone).toBe(eng.finalZoneId());
    expect(t.hp).toBeGreaterThan(0);
  });
});

describe('the level table is one ramp for every skill (S18)', () => {
  it('rises, never falls, and every row is whole-number on the buff column', () => {
    const rows = (SKILLS as any).meta.formula.skill_levels.rows;
    expect(rows[0].level).toBe(1);
    rows.forEach((r: any, i: number) => {
      expect(r.level).toBe(i + 1);
      expect(Number.isInteger(r.buff_effect_pct)).toBe(true);
      if (i) {
        expect(r.damage_pct).toBeGreaterThanOrEqual(rows[i - 1].damage_pct);
        expect(r.effect_pct).toBeGreaterThanOrEqual(rows[i - 1].effect_pct);
      }
    });
  });
});
