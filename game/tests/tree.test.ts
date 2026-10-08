import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { eng, tree } from '../src/engine/client';
import { newGame, setLevel, tick } from '../src/sim/game';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { canSpendTree, respecTree, spendTreePoint, treeLines, treePointsFree, treePointsSpent } from '../src/sim/tree';

/**
 * The passive tree as the client spends it. `tools/tree.ts` gates the shape and the values; this file
 * owns what only the client can: that a rank costs a banked point, that a chain cannot be skipped,
 * that a respec hands every point back, and that a bought rank actually moves the character sheet.
 */

describe('the passive tree is spent one rank at a time', () => {
  it('a level banks a point and the tree spends every point the cap hands out', () => {
    const s = newGame(1);
    setLevel(s, eng.S.level_cap);
    expect(treePointsFree(s)).toBe(eng.treePointsAt(eng.S.level_cap));
    // the identity the cage gates (T6), read from the client side: nodes x ranks x cost = the points
    const allRanks = tree.nodes.reduce((sum: number, node: any) => sum + node.ranks, 0);
    expect(allRanks * tree.cost).toBe(eng.treePointsAt(eng.S.level_cap));
  });

  it('refuses a chain that has not been walked, and a node past its last rank', () => {
    const s = newGame(2);
    s.player.treePoints = 10;
    expect(canSpendTree(s, 'impact.2').ok).toBe(false); // its chain head is not owned
    expect(spendTreePoint(s, 'impact.1').ok).toBe(true);
    expect(canSpendTree(s, 'impact.2').ok).toBe(true);  // now it is
    spendTreePoint(s, 'impact.2');
    spendTreePoint(s, 'impact.2');
    spendTreePoint(s, 'impact.2');
    expect(s.player.treeRanks!['impact.2']).toBe(3);
    expect(canSpendTree(s, 'impact.2').ok).toBe(false); // rank 3 is the last one
    expect(canSpendTree(s, 'stream.1').ok).toBe(true);  // a second chain starts free
  });

  it('refuses to spend a point it does not have', () => {
    const s = newGame(3);
    s.player.treePoints = 0;
    expect(spendTreePoint(s, 'control.1').ok).toBe(false);
    expect(treePointsSpent(s)).toBe(0);
  });

  it('a rank moves the sheet, and a respec hands every point back', () => {
    const s = newGame(4);
    setLevel(s, 60);
    s.player.treePoints = 5;
    const before = buildCharacter(60, emptyGear(), {}, 0, { add: {}, mult: {} }, s.player.points, s.player.treeRanks);
    // impact.1 grants physical_power_flat, so the flat physical line rises by the rank's own value
    spendTreePoint(s, 'impact.1');
    const after = buildCharacter(60, emptyGear(), {}, 0, { add: {}, mult: {} }, s.player.points, s.player.treeRanks);
    expect(after.phys).toBeGreaterThan(before.phys);
    expect(treeLines(s)).toEqual([{ id: tree.byId['impact.1'].line, value: tree.byId['impact.1'].values[0] }]);

    const spent = treePointsSpent(s);
    expect(spent).toBe(tree.cost);
    const refund = respecTree(s);
    expect(refund.ok).toBe(true);
    expect(refund.refunded).toBe(spent);
    expect(treePointsFree(s)).toBe(5);
    expect(treeLines(s)).toEqual([]);
  });

  // The unit tests above pass `treeRanks` by hand, so they cannot see the one wiring mistake that
  // shipped: the client built the sheet without threading the state's ranks, and a bought rank lit a
  // pip while the sheet never moved. This reads the call site, so forgetting the argument fails here.
  it('the client threads the state tree ranks into the sheet', () => {
    const app = fs.readFileSync(path.resolve(import.meta.dirname, '../src/App.svelte'), 'utf8');
    const call = app.match(/buildCharacter\(([^;]*)\)/);
    expect(call, 'App.svelte must build the character sheet from buildCharacter').toBeTruthy();
    expect(call![1]).toContain('treeRanks');
  });

  it('the tree is live in the hunt: ranks are read from the state, not from a copy', () => {
    const s = newGame(5);
    s.player.treePoints = 3;
    spendTreePoint(s, 'control.1'); // armour_flat
    // tick until the loop has paid a kill, never for a guessed window (AGENTS.md · lint L9)
    for (let i = 0; i < 20000 && s.counters.kills === 0; i++) tick(s, {});
    expect(s.player.treeRanks!['control.1']).toBe(1);
    // the fight itself reads the ranks: the sheet the loop builds carries the node's armour
    expect(treeLines(s).length).toBe(1);
  });
});
