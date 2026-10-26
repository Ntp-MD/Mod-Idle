import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/core/game';
import { treePath } from '../src/sim/core/tree';
import { recommendTreeNodes, treeGoals } from '../src/sim/core/tree-guide';
import { resolveGoal, setTrackedGoal } from '../src/sim/core/guidance';

describe('passive tree guidance', () => {
  it('offers the four build lenses with reasons tied to the character', () => {
    const goals = treeGoals(newGame());
    expect(goals.map((goal) => goal.id)).toEqual(['survival', 'mana', 'skills', 'weapon']);
    expect(goals.every((goal) => goal.reason.length > 20)).toBe(true);
    expect(goals.find((goal) => goal.id === 'weapon')!.reason).toContain('main-hand');
  });

  it('recommends only Notables and Keystones whose text matches the lens', () => {
    const state = newGame();
    const rows = recommendTreeNodes(state, 'survival', 6);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.node.kind !== 'normal')).toBe(true);
    expect(rows.every((row) => row.matched.length > 0 && row.reason.length > 0)).toBe(true);
  });

  it('quotes the route and price the path purchase uses', () => {
    const state = newGame();
    for (const row of recommendTreeNodes(state, 'mana', 6)) {
      const path = treePath(state, row.node.id);
      expect(row.cost).toEqual(path.cost);
      expect(row.pathLength).toBe(path.nodes.length);
    }
  });

  it('resolves a tracked passive node with its route price', () => {
    const state = newGame();
    const row = recommendTreeNodes(state, 'survival')[0];
    const ref = { kind: 'passive' as const, id: row.node.id };
    setTrackedGoal(state, ref);
    const view = resolveGoal(state, ref);
    expect(view.action).toBe('tree');
    expect(view.progress).toBe(`${row.cost.tree} tree · ${row.cost.attainment} attainment`);
    expect(view.reason).toContain('Route');
  });
});
