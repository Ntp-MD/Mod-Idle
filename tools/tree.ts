/**
 * Passive-tree cage — the 63-node / 189-rank tree in `tools/data/tree.json`.
 *
 *   node tools/tree.ts            help
 *   node tools/tree.ts --emit     print every generated block
 *   node tools/tree.ts --write    rewrite those blocks in skill-tree*.md
 *   node tools/tree.ts --checks   shape, values, pathing and the point identity
 *
 * The data holds a SPEC, not a node list: three branches, each a list of lines and a tier rule. This
 * cage derives the nodes (id · line · the three rank values · its prerequisite) from that spec and the
 * line maxima in `mods.json`, prints the tables, and gates the derivation — so a node can never be a
 * rule with no number in it, which is exactly what the removed tree was (82 of its 100 points bought
 * rules, and all the power sat in 18 keystones). No keystones here: every node pays a number.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as eng from './lib/engine.ts';
import { createTree } from '../engine/tree.ts';
import { readJson } from './lib/json.ts';

const TREE = readJson(path.join(import.meta.dirname, 'data', 'tree.json'));
const MODS = readJson(path.join(import.meta.dirname, 'data', 'mods.json'));
const maxOf = (id: string) => Number((MODS.mods.find((m: any) => m.id === id) || {}).max ?? 0);
const COST = TREE.point_cost_per_rank;
const RANKS = 3;
const SHALLOW_NODES = 14;

/** The nodes are the SHARED derivation (`engine/tree.ts`) — the cage and the client read one object. */
const TREE_MODEL = createTree(TREE, MODS);

const NODES = TREE_MODEL.nodes;
const BRANCHES = Object.keys(TREE.branches);
const perBranch = (b: string) => NODES.filter((n) => n.branch === b);
const ranksTotal = NODES.reduce((s, n) => s + n.ranks, 0);
const pointsAtCap = eng.treePointsAt(eng.S.level_cap);

// ---------------------------------------------------------------- gates

function gates(): any[] {
  const out: any[] = [];
  const add = (id: string, ok: boolean, detail: string) => out.push({ id, ok, detail });
  const per = BRANCHES.map((b) => perBranch(b).length);
  add('T1', BRANCHES.length === 3 && per.every((n) => n === 21) && NODES.length === 63,
    `${BRANCHES.length} branches (${BRANCHES.join(' · ')}), ${per.join('/')} nodes each = ${NODES.length} nodes, ${RANKS} ranks each = ${ranksTotal} ranks`);
  const badLine = NODES.filter((n) => !(n.max > 0));
  add('T2', badLine.length === 0,
    badLine.length ? `node(s) name a line mods.json does not carry: ${badLine.map((n) => `${n.id} ${n.line}`).join(' · ')}`
      : `every one of the ${NODES.length} nodes names a real mods.json line, so a node always pays a number the game already reads`);
  const flat = NODES.filter((n) => !(n.values[0] >= 1) || !(n.values[1] >= n.values[0]) || !(n.values[2] >= n.values[1]));
  add('T3', flat.length === 0,
    flat.length ? `node(s) whose ranks do not rise: ${flat.map((n) => `${n.id} ${n.values.join('/')}`).join(' · ')}`
      : `every node grants at least 1 at rank 1 and never less at a higher rank (${NODES[0].values.join('/')} is the first ladder)`);
  const drift = NODES.filter((n) => {
    const mult: number[] = TREE.rank_tiers[n.tier];
    let prev = 0;
    return mult.some((m, i) => { const v = Math.max(1, Math.round(n.max * m), prev); prev = v; return v !== n.values[i]; });
  });
  add('T4', drift.length === 0,
    drift.length ? `node(s) whose values are not the stated rule (line max x the tier multiplier): ${drift.map((n) => n.id).join(' · ')}`
      : `every value is the line's own maximum x its tier multiplier (shallow ${TREE.rank_tiers.shallow.map((m: number) => `${Math.round(m * 1000) / 10}%`).join('/')} · deep ${TREE.rank_tiers.deep.map((m: number) => `${Math.round(m * 1000) / 10}%`).join('/')}), floored at 1 — nothing is typed twice`);
  const chain = NODES.filter((n) => (n.index === 1 ? n.needs !== null : n.needs !== `${n.branch}.${n.index - 1}`));
  add('T5', chain.length === 0,
    chain.length ? `node(s) with a broken chain: ${chain.map((n) => n.id).join(' · ')}`
      : `each branch is one chain: node 1 is free, node k needs node k-1 (${BRANCHES.map((b) => `${b} 1→${perBranch(b).length}`).join(' · ')})`);
  add('T6', ranksTotal * COST === pointsAtCap,
    `${NODES.length} nodes x ${RANKS} ranks x ${COST} point = ${ranksTotal * COST} points, and treePointsAt(level ${eng.S.level_cap}) grants ${pointsAtCap} — a level buys exactly one rank, and the tree spends every point the cap hands out`);
  add('T7', NODES.every((n) => n.line && n.values.length === RANKS),
    'no keystones and no rule-only nodes: every node carries a line and its three values, so the whole tree is numbers (the removed tree put 100% of its power in 18 keystones)');
  const weak = NODES.filter((n) => {
    if (n.tier !== 'deep') return false;
    const shallow = NODES.find((s) => s.branch === n.branch && s.line === n.line && s.tier === 'shallow');
    return shallow && n.values[2] <= shallow.values[2];
  });
  add('T8', weak.length === 0,
    weak.length ? `deep node(s) that are not stronger than their shallow twin: ${weak.map((n) => n.id).join(' · ')}`
      : `every repeated line is strictly stronger at its deep node than at its shallow one, so a longer chain is never a worse buy`);
  return out;
}

// ---------------------------------------------------------------- blocks

function summaryBlock() {
  return [
    '| Branch | What it buys | Nodes | Ranks | Points | Chain |',
    '|---|---|---|---|---|---|',
    ...BRANCHES.map((b) => {
      const nodes = perBranch(b);
      const what = { impact: 'offence lines — power, crit, penetration, accuracy, attack speed, stun, bleed', control: 'defence lines — armour, evasion, block, resistance, HP, Energy Shield, cooldown', stream: 'sustain and Core stats — mana, regeneration, Energy Shield regen, Stat Mod' }[b] || '';
      return `| **${b}** | ${what} | ${nodes.length} | ${nodes.length * RANKS} | ${nodes.length * RANKS * COST} | node k needs node k-1 |`;
    }),
    `| **total** | every node pays a number | **${NODES.length}** | **${ranksTotal}** | **${ranksTotal * COST}** | 3 chains |`,
  ].join('\n');
}

function branchBlock(branch: string) {
  const nodes = perBranch(branch);
  return [
    '| Node | Line | Rank 1 | Rank 2 | Rank 3 | Line max | Needs |',
    '|---|---|---|---|---|---|---|',
    ...nodes.map((n) => `| ${n.id} | ${n.line} | ${n.values[0]} | ${n.values[1]} | ${n.values[2]} | ${n.max} | ${n.needs || '—'} |`),
    '',
    `${nodes.length} nodes, ${nodes.length * RANKS} ranks, ${nodes.length * RANKS * COST} points. The first ${SHALLOW_NODES} nodes are shallow (${TREE.rank_tiers.shallow.join('/')}% of the line's own maximum per rank), the last ${nodes.length - SHALLOW_NODES} are deep (${TREE.rank_tiers.deep.join('/')}%) — so a deeper node of the same line is always the stronger buy.`,
  ].join('\n');
}

// ---------------------------------------------------------------- cli

const arg = process.argv[2];
if (arg === '--checks') {
  const rows = gates();
  for (const r of rows) console.log(`${r.id.padEnd(3)}  ${(r.ok ? 'PASS' : 'FAIL').padEnd(5)}  ${r.detail}`);
  const fails = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} gate PASS · ${fails} FAIL`);
  if (fails) process.exitCode = 1;
} else {
  console.log(`tree cage — data: tools/data/tree.json (the spec) + mods.json (the line maxima)

  node tools/tree.ts --checks   shape, values, pathing and the point identity
`);
}
