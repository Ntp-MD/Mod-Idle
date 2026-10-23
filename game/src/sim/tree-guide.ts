import { tree, sm } from '../engine/client';
import type { TreeNode } from '../../../engine/tree';
import type { GameState } from './types';
import { lineName } from './craft';
import { treePath, treePointsFree } from './tree';

/**
 * Read-only passive-tree guidance. A goal is a lens over what a node actually grants; the helper never
 * allocates a point, and it never claims a build is best. Route prices come from `treePath`, the same
 * function the board's path purchase uses, so the quote and the charge cannot disagree.
 */
export type TreeGoalId = 'survival' | 'mana' | 'skills' | 'weapon';

export interface TreeGoal {
  id: TreeGoalId;
  label: string;
  reason: string;
}

export interface TreeRecommendation {
  node: TreeNode;
  reason: string;
  matched: string[];
  pathLength: number;
  cost: { tree: number; attainment: number };
  affordable: boolean;
  conflict: string | null;
  score: number;
}

const SURVIVAL = ['life', 'hp', 'health', 'armour', 'resist', 'evasion', 'block', 'shield', 'energy shield', 'regen', 'leech', 'recovery', 'endurance', 'fortif', 'thorns', 'retaliat', 'defence', 'defense', 'ward'];
const MANA = ['mana', 'spell', 'cast', 'aura', 'reserve', 'regeneration', 'intelligence', 'wisdom', 'cost'];
const WEAPON = ['weapon', 'attack', 'melee', 'projectile', 'accuracy', 'attack speed', 'crit', 'physical', 'sword', 'axe', 'mace', 'bow', 'staff', 'dagger', 'spear', 'crossbow', 'two hand', 'dual wield', 'bleed'];

const heldWeapon = (state: GameState) => state.gear.find((item) => item?.slot === 'main hand' && !item.broken) || null;
const ownedSkillRows = (state: GameState) => Object.keys(state.skills.owned)
  .map((id) => sm.byId[id])
  .filter(Boolean);

const skillWords = (state: GameState): string[] => {
  const words = new Set<string>();
  for (const skill of ownedSkillRows(state) as any[]) {
    if (skill.element) words.add(String(skill.element).toLowerCase());
    if (skill.group) words.add(String(skill.group).toLowerCase());
    if (skill.basis) words.add(String(skill.basis).toLowerCase());
    for (const effect of skill.effects || []) if (effect?.stat) words.add(String(effect.stat).toLowerCase().replace(/_/g, ' '));
    for (const term of String(skill.effect || '').toLowerCase().match(/[a-z][a-z -]{3,}/g) || []) words.add(term.trim());
  }
  return [...words].filter((word) => word.length > 3);
};

const weaponWords = (state: GameState): string[] => {
  const held = heldWeapon(state);
  const mastery = Object.entries(state.mastery || {}).filter(([, xp]) => xp > 0).map(([weapon]) => weapon.toLowerCase());
  const base = held ? String(held.base).toLowerCase().split(/[\s-]+/).filter((word) => word.length > 2) : [];
  return [...new Set([...WEAPON, ...mastery, ...base])];
};

export function treeGoals(state: GameState): TreeGoal[] {
  const held = heldWeapon(state);
  const skills = ownedSkillRows(state) as any[];
  const skillNames = skills.slice(0, 3).map((skill) => skill.name).join(', ');
  return [
    {
      id: 'survival', label: 'Stay alive',
      reason: `Weight life, armour, resistance, block and recovery. Current HP ${Math.round(state.player.hp)}.`,
    },
    {
      id: 'mana', label: 'Manage mana',
      reason: `Weight mana, regeneration, cast frequency and reservation. Current mana ${Math.round(state.player.mana)}.`,
    },
    {
      id: 'skills', label: 'Support my skills',
      reason: skills.length
        ? `Weight lines that share the tags of ${skillNames}${skills.length > 3 ? ` and ${skills.length - 3} more` : ''}.`
        : 'No skills owned yet; this lens uses attack and spell tags.',
    },
    {
      id: 'weapon', label: 'Support my weapon',
      reason: held
        ? `Weight lines for ${held.base} and the ${held.slot} attacks it carries${Object.keys(state.mastery || {}).length ? ' (Mastery weapons included)' : ''}.`
        : 'No main-hand weapon is held; this lens uses the generic attack lines.',
    },
  ];
}

const wordsFor = (state: GameState, goal: TreeGoalId): string[] =>
  goal === 'survival' ? SURVIVAL
    : goal === 'mana' ? MANA
      : goal === 'skills' ? skillWords(state)
        : weaponWords(state);

const nodeText = (node: TreeNode): string => {
  const grants = node.grants.flatMap((grant) => [
    grant.id.replace(/_/g, ' '),
    lineName(grant.id),
    grant.stat || '',
    grant.element || '',
  ]);
  const effects = (node.effects || []).map((effect) => effect.key.replace(/_/g, ' '));
  return [node.id, node.name, node.description, ...grants, ...effects].join(' ').toLowerCase();
};

const grantText = (node: TreeNode): string => {
  if (node.description) return node.description;
  const labels = [...new Set(node.grants.map((grant) => lineName(grant.id)))];
  return labels.length ? `Grants ${labels.join(', ')}.` : 'A keystone that changes a rule rather than adding a number.';
};

export function recommendTreeNodes(state: GameState, goal: TreeGoalId, limit = 6): TreeRecommendation[] {
  const words = [...new Set(wordsFor(state, goal))].filter((word) => word.length > 2);
  const ranks = state.player.treeRanks || {};
  const treeFree = treePointsFree(state, 'tree');
  const attainment = treePointsFree(state, 'attainment');
  const rows = tree.nodes
    .filter((node) => node.kind !== 'normal')
    .filter((node) => (ranks[node.id] || 0) < node.ranks)
    .map((node) => {
      const text = nodeText(node);
      const matched = words.filter((word) => text.includes(word));
      const score = matched.length;
      if (!score) return null;
      const path = treePath(state, node.id);
      const holder = node.kind === 'keystone' ? tree.pairHolder(node.id, ranks) : null;
      const conflict = holder ? tree.byId[holder]?.name || holder : null;
      const affordable = path.cost.tree <= treeFree && path.cost.attainment <= attainment && !conflict;
      const reason = [
        grantText(node),
        matched.length ? `Related to ${[...new Set(matched)].slice(0, 3).join(', ')}.` : '',
        node.weapon ? `Active while holding ${node.weapon}.` : '',
        conflict ? `Cannot be held with ${conflict}; choose one keystone.` : '',
      ].filter(Boolean).join(' ');
      return { node, reason, matched: [...new Set(matched)], pathLength: path.nodes.length, cost: path.cost, affordable, conflict, score };
    })
    .filter((row): row is TreeRecommendation => row !== null)
    .sort((a, b) => Number(!!a.conflict) - Number(!!b.conflict)
      || b.score - a.score
      || (a.cost.tree + a.cost.attainment) - (b.cost.tree + b.cost.attainment)
      || (a.node.name || a.node.id).localeCompare(b.node.name || b.node.id));
  return rows.slice(0, limit);
}
