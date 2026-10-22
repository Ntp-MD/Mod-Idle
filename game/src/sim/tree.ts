import { tree } from '../engine/client';
import { newKeystoneRuntimeState } from '../../../engine/keystones.ts';
import type { GameState } from './types';
import { atSettlement } from './craft';
import { clampAuraReservations } from './skills';

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

/** A node's name for a refusal the player reads: the keystone's own name, the id when it has none. */
const nodeName = (model: typeof tree, id: string): string => model.byId[id]?.name || id;

/** Can this rank be bought right now? */
export function canSpendTree(state: GameState, nodeId: string, model = tree): TreeVerdict {
  const node = model.byId[nodeId];
  if (!node) return { ok: false, why: 'no such node' };
  if (treePointsFree(state, node.currency) < node.cost) {
    return { ok: false, why: `needs ${node.cost} ${currencyName(node.currency)}` };
  }
  const rank = state.player.treeRanks?.[nodeId] || 0;
  if (rank >= node.ranks) return { ok: false, why: `${nodeName(model, node.id)} is already at rank ${node.ranks}` };
  // v2's one-of group or v3's listed keystone pair: holding the other member blocks this one
  const holder = model.version >= 3
    ? model.pairHolder(nodeId, state.player.treeRanks)
    : model.groupHolder(nodeId, state.player.treeRanks);
  if (holder) {
    return {
      ok: false,
      why: model.version >= 3
        ? `${nodeName(model, holder)} is incompatible with this keystone`
        : `${nodeName(model, holder)} already holds this keystone group`,
    };
  }
  if (!model.connected(nodeId, state.player.treeRanks)) {
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
  clampAuraReservations(state.skills, model.keystoneBundles(state.player.treeRanks));
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
  // §7.5.9: the sold keystones take their combat state with them, and an aura's pool choice is only
  // something Blood Covenant can offer. Ownership, the rotation and running cooldowns stay.
  state.keystoneRuntime = newKeystoneRuntimeState();
  state.skills.auraPool = {};
  for (const id of Object.keys(state.skills.auras)) state.skills.auras[id] = false;
  return { ok: true, refundedTree: treeSpent, refundedAttainment: attainmentSpent };
}

/**
 * The path a shift-click would buy (D7): the nodes from the owned frontier to a node, in purchase
 * order, and what each wallet pays. The board shows the price before the click lands.
 */
export const treePath = (state: GameState, nodeId: string, model = tree) => {
  const raw = model.pathTo(nodeId, state.player.treeRanks);
  // v2 walks parents from the target back out; v3's Dijkstra already returns the purchase order
  const nodes = model.version >= 3 ? raw : [...raw].reverse();
  return { nodes, cost: model.pathCost(nodeId, state.player.treeRanks) };
};

/**
 * Buy the whole path to a node at once. Every step is checked against the allocation the earlier
 * steps would leave behind, and the whole path is refused before anything is spent — a path is never
 * bought halfway.
 */
export function allocateTreePath(state: GameState, nodeId: string, model = tree): TreeVerdict & { spent?: number } {
  const path = treePath(state, nodeId, model);
  if (!path.nodes.length) return { ok: false, why: 'that path is already bought' };
  const { tree: treeCost, attainment: attainmentCost } = path.cost;
  if (treePointsFree(state, 'tree') < treeCost) return { ok: false, why: `needs ${treeCost} banked point` };
  if (treePointsFree(state, 'attainment') < attainmentCost) return { ok: false, why: `needs ${attainmentCost} attainment point` };

  const simulated: Record<string, number> = { ...(state.player.treeRanks ?? {}) };
  for (const id of path.nodes) {
    const node = model.byId[id];
    if (!node) return { ok: false, why: 'no such node' };
    const rank = simulated[id] ?? 0;
    if (rank >= node.ranks) return { ok: false, why: `${nodeName(model, node.id)} is already at rank ${node.ranks}` };
    const holder = model.version >= 3
      ? model.pairHolder(id, simulated)
      : model.groupHolder(id, simulated);
    if (holder) return { ok: false, why: `${nodeName(model, holder)} is incompatible with ${nodeName(model, id)}` };
    if (!model.connected(id, simulated)) return { ok: false, why: 'connect this node to an owned path first' };
    simulated[id] = rank + 1;
  }

  state.player.treeRanks ??= {};
  for (const id of path.nodes) {
    const node = model.byId[id];
    state.player.treeRanks[id] = (state.player.treeRanks[id] || 0) + 1;
    if (node.currency === 'tree') state.player.treePoints -= node.cost;
    else state.player.attainmentPoints = (state.player.attainmentPoints ?? 0) - node.cost;
  }
  clampAuraReservations(state.skills, model.keystoneBundles(state.player.treeRanks));
  return { ok: true, spent: treeCost };
}

/** The lines the bought ranks grant — what the character sheet adds to its gear. */
export const treeLines = (state: GameState) => {
  const weapon = state.gear.find((item) => item && !item.broken && item.slot === 'main hand')?.base || '';
  return tree.linesOf(state.player.treeRanks, weapon);
};
