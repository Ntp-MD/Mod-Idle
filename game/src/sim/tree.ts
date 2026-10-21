import { tree } from '../engine/client';
import type { GameState } from './types';
import { atSettlement } from './craft';

/**
 * Spending the passive tree (`engine/tree.ts`).
 *
 * A level banks tree points; one point buys one rank; a node opens from any owned adjacent path, and a
 * node holds as many ranks as its kind says. A kind also names the currency it is paid in, so a
 * keystone is bought with attainment points and never competes with the ordinary nodes for them. There is
 * no unlock condition on any node: connectivity is the only rule (D3).
 *
 * Respec is **free**, at the town Counterhand — the same rule the Core attribute points obey, because
 * the build is the player's to express (`docs/game-rules.md` §Completion and progression), so taking it
 * back costs nothing.
 */

export interface TreeVerdict { ok: boolean; why?: string }

/** Points the character has spent in the tree — what a respec hands back. */
export const treePointsSpent = (state: GameState): number => tree.pointsSpentByCurrency(state.player.treeRanks ?? {}).tree ?? 0;

/** Points banked and unspent, in the currency a node is paid in. */
export const treePointsFree = (state: GameState, currency = 'tree'): number => {
  if (currency === 'tree') return Math.max(0, state.player.treePoints);
  return Math.max(0, state.player.attainmentPoints ?? 0);
};

/** The currency's own name, for the refusal a player reads. */
const currencyName = (currency: string): string => (currency === 'tree' ? 'banked point' : `${currency} point`);

/** Can this rank be bought right now? */
export function canSpendTree(state: GameState, nodeId: string, model = tree): TreeVerdict {
  const node = model.byId[nodeId];
  if (!node) return { ok: false, why: 'no such node' };
  if (treePointsFree(state, node.currency) < node.cost) {
    return { ok: false, why: `needs ${node.cost} ${currencyName(node.currency)}` };
  }
  const rank = state.player.treeRanks?.[nodeId] || 0;
  if (rank >= node.ranks) return { ok: false, why: `${node.id} is already at rank ${node.ranks}` };
  // a keystone group is a one-of family (D1): holding one member blocks its siblings
  const holder = model.groupHolder(nodeId, state.player.treeRanks);
  if (holder) return { ok: false, why: `${holder} already holds this keystone group` };
  if (!node.needs.includes('start') && !node.needs.some((parent) => (state.player.treeRanks?.[parent] || 0) > 0)) {
    return { ok: false, why: 'connect this node to an owned path first' };
  }
  return { ok: true };
}

/** Buy one rank of a node. */
export function spendTreePoint(state: GameState, nodeId: string, model = tree): TreeVerdict {
  const verdict = canSpendTree(state, nodeId, model);
  if (!verdict.ok) return verdict;
  const node = model.byId[nodeId];
  if (!state.player.treeRanks) state.player.treeRanks = {};
  state.player.treeRanks[nodeId] = (state.player.treeRanks[nodeId] || 0) + 1;
  if (node.currency === 'tree') state.player.treePoints -= node.cost;
  else state.player.attainmentPoints = (state.player.attainmentPoints ?? 0) - node.cost;
  return { ok: true };
}

/** Hand every spent point back. Free, and it touches nothing else. */
export function respecTree(state: GameState): { ok: boolean; refundedTree: number; refundedAttainment: number } {
  if (!atSettlement(state)) return { ok: false, refundedTree: 0, refundedAttainment: 0 };
  const spentByCurrency = tree.pointsSpentByCurrency(state.player.treeRanks ?? {});
  const treeSpent = spentByCurrency.tree ?? 0;
  const attainmentSpent = spentByCurrency.attainment ?? 0;
  if (!treeSpent && !attainmentSpent) return { ok: false, refundedTree: 0, refundedAttainment: 0 };
  state.player.treeRanks = {};
  state.player.treePoints += treeSpent;
  state.player.attainmentPoints = (state.player.attainmentPoints ?? 0) + attainmentSpent;
  return { ok: true, refundedTree: treeSpent, refundedAttainment: attainmentSpent };
}

/**
 * The path a shift-click would buy (D7): the nodes from the owned frontier to a node, and what it
 * costs. The board shows the number before the click lands.
 */
export const treePath = (state: GameState, nodeId: string, model = tree) => {
  const nodes = model.pathTo(nodeId, state.player.treeRanks);
  return { nodes, cost: nodes.reduce((sum, id) => sum + (model.byId[id]?.cost ?? 0), 0) };
};

/**
 * Buy the whole path to a node at once. The nodes are bought deepest parent first, so every step of
 * the path is legal when it is bought, and the whole thing is refused if it cannot be afforded.
 */
export function allocateTreePath(state: GameState, nodeId: string, model = tree): TreeVerdict & { spent?: number } {
  const path = treePath(state, nodeId, model);
  if (!path.nodes.length) return { ok: false, why: 'that path is already bought' };
  const treeCost = path.nodes.reduce((sum, id) => sum + (model.byId[id]?.currency === 'attainment' ? 0 : (model.byId[id]?.cost ?? 0)), 0);
  const attainmentCost = path.nodes.reduce((sum, id) => sum + (model.byId[id]?.currency === 'attainment' ? (model.byId[id]?.cost ?? 0) : 0), 0);
  if (treePointsFree(state, 'tree') < treeCost) return { ok: false, why: `needs ${treeCost} banked point` };
  if (treePointsFree(state, 'attainment') < attainmentCost) return { ok: false, why: `needs ${attainmentCost} attainment point` };
  for (const id of [...path.nodes].reverse()) {
    const verdict = canSpendTree(state, id, model);
    if (!verdict.ok) return { ok: false, why: verdict.why };
    spendTreePoint(state, id, model);
  }
  return { ok: true, spent: path.cost };
}

/** The lines the bought ranks grant — what the character sheet adds to its gear. */
export const treeLines = (state: GameState) => {
  const weapon = state.gear.find((item) => item && !item.broken && item.slot === 'main hand')?.base || '';
  return tree.linesOf(state.player.treeRanks, weapon);
};
