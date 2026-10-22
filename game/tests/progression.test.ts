import { describe, it, expect } from 'vitest';
import { E, BASES, SKILLS, MODS, TREE_SPEC, eng, tree } from '../src/engine/client';
import { createTree } from '../../engine/tree';
import { newGame } from '../src/sim/game';
import { mastery, masteryLevel, dropMultiplier, weaponSkillBonusPct } from '../src/sim/mastery';
import { canSpendTree, spendTreePoint, respecTree, treePointsSpent, treeLines, treePath, allocateTreePath } from '../src/sim/tree';
import { keystoneBuildContext } from '../src/sim/keystone-runtime';
import { newGoal, target, onSpawn, onKill, watch } from '../src/sim/goal';
import type { GameState, Mob } from '../src/sim/types';
import { respecStats } from '../src/sim/respec';
import { buildCharacter, openingGear } from '../src/sim/player';
import { mobFixture } from './mobFixture';

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
  const ELEMENTS = Object.keys((E as any).elements.status_of);
  const build = (spec: any) => createTree(spec, MODS, ELEMENTS, keystoneBuildContext(ELEMENTS));
  const cloneSpec = () => JSON.parse(JSON.stringify(TREE_SPEC));

  it('reads the three v3 kinds and the rank each one holds', () => {
    const nodes = Object.values(tree.byId as Record<string, any>);
    for (const node of nodes.filter((n) => n.kind === 'normal')) {
      expect(node.ranks).toBe(1);
      expect(node.cost).toBe(1);
      expect(node.currency).toBe('tree');
      expect(node.profile).toBe(`core.${node.wing}`);
    }
    for (const node of nodes.filter((n) => n.kind === 'notable')) {
      expect(node.ranks).toBe(1);
      expect(node.cost).toBe(3);
      expect(node.currency).toBe('tree');
    }
    for (const node of nodes.filter((n) => n.kind === 'keystone')) {
      expect(node.ranks).toBe(1);
      expect(node.cost).toBe(1);
      expect(node.currency).toBe('attainment');
      expect(node.grants).toEqual([]);
    }
  });

  it('refuses a v3 tree spec it cannot build, and names the key that is wrong', () => {
    const noKind = cloneSpec();
    delete noKind.node_kinds.keystone;
    expect(() => build(noKind)).toThrow(/keystone/);

    const noProfiles = cloneSpec();
    delete noProfiles.profiles;
    expect(() => build(noProfiles)).toThrow(/profiles/);

    const wrongLayout = cloneSpec();
    wrongLayout.layout.algorithm = 'radial-topology';
    expect(() => build(wrongLayout)).toThrow(/seven-spoke-v3/);
  });


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

  it('opens a cross-linked branch from a neighbouring owned region', () => {
    const s = newGame();
    s.player.treePoints = 1000;
    for (let index = 1; index <= 6; index++) expect(spendTreePoint(s, `normal.str.s${String(index).padStart(2, '0')}`).ok).toBe(true);
    expect(canSpendTree(s, 'normal.agi.s06').ok).toBe(true);
    expect(spendTreePoint(s, 'normal.agi.s06').ok).toBe(true);
    expect(canSpendTree(s, 'normal.agi.s07').ok).toBe(true);

    // and the ring works the other way round
    const back = newGame();
    back.player.treePoints = 1000;
    for (let index = 1; index <= 6; index++) expect(spendTreePoint(back, `normal.agi.s${String(index).padStart(2, '0')}`).ok).toBe(true);
    expect(canSpendTree(back, 'normal.str.s06').ok).toBe(true);
    expect(spendTreePoint(back, 'normal.str.s06').ok).toBe(true);
  });

  it('hands every spent point back, free, and grants the lines its ranks buy', () => {
    const s = newGame();
    s.player.treePoints = 1000;
    const id = Object.keys(tree.byId)[0];
    spendTreePoint(s, id);
    expect(spent(s)).toBe(tree.cost);
    expect(treeLines(s).length).toBeGreaterThan(0);

    const refunded = respecTree(s);
    expect(refunded).toEqual({ ok: true, refundedTree: tree.cost, refundedAttainment: 0 });
    expect(s.player.treeRanks).toEqual({});
    expect(treeLines(s).length).toBe(0);
    expect(respecTree(s)).toEqual({ ok: false, refundedTree: 0, refundedAttainment: 0 });
  });

  it('breaks a shortest-path tie by the lexically smallest purchase sequence', () => {
    const spec: any = {
      version: 3,
      meta: { note: 'a tie' },
      points: { currencies: { tree: { base: 0, per_level: 2 }, attainment: { base: 0 } } },
      node_kinds: {
        normal: { ranks: 1, cost: 1, currency: 'tree' },
        notable: { ranks: 1, cost: 3, currency: 'tree' },
        keystone: { ranks: 1, cost: 1, currency: 'attainment' },
      },
      keystone_groups: [],
      clusters: [],
      profiles: {
        'core.str': [{ id: 'stat_mod_flat', values: [1], stat: 'str' }],
        'core.agi': [{ id: 'stat_mod_flat', values: [1], stat: 'agi' }],
      },
      incompatibilities: [],
      layout: {
        algorithm: 'seven-spoke-v3', start: { x: 0, y: 0 }, regions: ['str', 'agi'],
        spine_step: 25, branch_step: 12, notable_offset: 72, keystone_offset: 90,
        junction_radius: 100, radii: { normal: 3.5, notable: 7, keystone: 9, start: 8 }, padding: 16,
      },
      links: [],
      nodes: [
        { id: 'normal.str.s01', wing: 'str', kind: 'normal', needs: ['start'], profile: 'core.str', placement: { role: 'spine', index: 1 } },
        { id: 'normal.str.s02', wing: 'str', kind: 'normal', needs: ['normal.str.s01'], profile: 'core.str', placement: { role: 'spine', index: 2 } },
        { id: 'normal.agi.s01', wing: 'agi', kind: 'normal', needs: ['start'], profile: 'core.agi', placement: { role: 'spine', index: 1 } },
        { id: 'normal.agi.s02', wing: 'agi', kind: 'normal', needs: ['normal.agi.s01'], profile: 'core.agi', placement: { role: 'spine', index: 2 } },
        // two equal-cost routes reach it; the id order decides, not insertion order
        { id: 'normal.str.s03', wing: 'str', kind: 'normal', needs: ['normal.str.s02', 'normal.agi.s02'], profile: 'core.str', placement: { role: 'spine', index: 3 } },
      ],
    };
    const model = build(spec);
    expect(model.pathTo('normal.str.s03', {})).toEqual(['normal.agi.s01', 'normal.agi.s02', 'normal.str.s03']);
    expect(model.pathCost('normal.str.s03', {})).toEqual({ tree: 3, attainment: 0 });
  });

  it('buys a mixed-wallet path whole, then refunds both currencies', () => {
    const s = newGame();
    s.player.treePoints = 1000;
    s.player.attainmentPoints = 0;
    s.player.treeRanks = {};
    const keystone = Object.values(tree.byId).find((n: any) => n.kind === 'keystone')!;
    const before = structuredClone(s.player.treeRanks);

    // the tree points are plentiful but the attainment wallet is empty: nothing is bought, not even
    // the ordinary prefix
    expect(allocateTreePath(s, keystone.id).ok).toBe(false);
    expect(s.player.treeRanks).toEqual(before);
    expect(s.player.treePoints).toBe(1000);
    expect(s.player.attainmentPoints).toBe(0);

    s.player.attainmentPoints = 1;
    const path = treePath(s, keystone.id);
    expect(path.cost.attainment).toBe(1);
    expect(path.nodes[path.nodes.length - 1]).toBe(keystone.id);
    expect(allocateTreePath(s, keystone.id).ok).toBe(true);
    expect(s.player.treePoints).toBe(1000 - path.cost.tree);
    expect(s.player.attainmentPoints).toBe(0);
    expect(Object.keys(s.player.treeRanks!).length).toBe(path.nodes.length);
    // the path is bought: a second click spends nothing
    expect(allocateTreePath(s, keystone.id).ok).toBe(false);
    expect(s.player.treePoints).toBe(1000 - path.cost.tree);

    expect(respecTree(s)).toEqual({ ok: true, refundedTree: path.cost.tree, refundedAttainment: 1 });
    expect(s.player.treePoints).toBe(1000);
    expect(s.player.attainmentPoints).toBe(1);
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
    expect(respecTree(s)).toEqual({ ok: false, refundedTree: 0, refundedAttainment: 0 });
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
  it('caps at the data’s own ceiling and never above its maximum', () => {
    const s = newGame();
    s.gear = openingGear();
    const item = s.gear.find((g) => g)!;
    item.lines = [
      { id: 'elemental_resistance', value: 200 },
      { id: 'elemental_resistance_cap_pct', value: 15 },
    ];
    const base = buildCharacter(s.player.level, [item]);
    expect(base.resCap).toBe(E.caps.elem_res);
    expect(base.resistance).toBe(E.caps.elem_res);
    expect(eng.elemResCapOf(1000)).toBe(E.caps.elem_res_max);
  });
});

describe('the win gate', () => {
    const bossOf = (zone: number, id = 'b1'): Mob => mobFixture({
      id, species: 'Slime', kind: 'Boss', zone, hp: 1e6, hpMax: 1e6, ps: 100, acc: 100, innate: [],
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
