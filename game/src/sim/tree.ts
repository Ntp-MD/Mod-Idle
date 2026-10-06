import { tree } from '../engine/client';
import type { GameState } from './types';

/**
 * Spending the passive tree (`skill-tree.md` · `engine/tree.ts`).
 *
 * A level banks one point; one point buys one rank; a node's rank 1 needs the node before it in its
 * own chain, and a node holds three ranks. Respec is **free**, at the town Counterhand — the same
 * rule the Core stat points obey, because the build is the player's to express (`AGENT.md` D11), so
 * taking it back costs nothing.
 */

export interface TreeVerdict { ok: boolean; why?: string }

/** Points the character has spent in the tree — what a respec hands back. */
export const treePointsSpent = (state: GameState): number => tree.pointsSpent(state.player.treeRanks);

/** Points banked and unspent. */
export const treePointsFree = (state: GameState): number => Math.max(0, state.player.treePoints);

/** Can this rank be bought right now? */
export function canSpendTree(state: GameState, nodeId: string): TreeVerdict {
  const node = tree.byId[nodeId];
  if (!node) return { ok: false, why: 'no such node' };
  if (treePointsFree(state) < tree.cost) return { ok: false, why: `needs ${tree.cost} banked point` };
  const rank = state.player.treeRanks?.[nodeId] || 0;
  if (rank >= node.ranks) return { ok: false, why: `${node.id} is already at rank ${node.ranks}` };
  if (node.needs && (state.player.treeRanks?.[node.needs] || 0) < 1) {
    return { ok: false, why: `${node.needs} comes first in that chain` };
  }
  return { ok: true };
}

/** Buy one rank of a node. */
export function spendTreePoint(state: GameState, nodeId: string): TreeVerdict {
  const verdict = canSpendTree(state, nodeId);
  if (!verdict.ok) return verdict;
  if (!state.player.treeRanks) state.player.treeRanks = {};
  state.player.treeRanks[nodeId] = (state.player.treeRanks[nodeId] || 0) + 1;
  state.player.treePoints -= tree.cost;
  return { ok: true };
}

/** Hand every spent point back. Free, and it touches nothing else. */
export function respecTree(state: GameState): { ok: boolean; refunded: number } {
  const refunded = treePointsSpent(state);
  if (!refunded) return { ok: false, refunded: 0 };
  state.player.treeRanks = {};
  state.player.treePoints += refunded;
  return { ok: true, refunded };
}

/** The lines the bought ranks grant — what the character sheet adds to its gear. */
export const treeLines = (state: GameState) => tree.linesOf(state.player.treeRanks);
