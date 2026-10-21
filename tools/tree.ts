import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/json.ts';
import * as G from './lib/gates.ts';
import { createTree, type TreeSpec } from '../engine/tree.ts';
import { SHEET_LINES } from '../game/src/sim/lines.ts';
import { E } from './lib/engine.ts';

/**
 * Tree cage — `tools/data/tree.json` is the spec, and this gates it against the engine, the Mod data
 * and the character sheet.
 *
 * The passive tree was the one major system with no cage: a node could grant a line the sheet has no
 * bucket for (a silent no-op that costs a point and moves nothing), name a parent that does not
 * exist, or sit in a wing nothing can reach, and the client would spend it anyway. The tree's
 * spending, adjacency, refunds and save fidelity are covered by `game/tests/progression.test.ts` and
 * `game/tests/save-fidelity.test.ts`; this cage is the STRUCTURE those tests cannot see.
 *
 *   node tools/tree.ts --checks   gate the tree, exit 1 on FAIL
 */

const OUT = path.join(import.meta.dirname, 'data', 'tree.json');
const MODS = readJson(path.join(import.meta.dirname, 'data', 'mods.json'));

/** The keys a node may carry. Anything else is a number the engine never reads. */
const READ_KEYS = ['id', 'wing', 'kind', 'needs', 'grants', 'name', 'weapon', 'rule', 'group'];
/** The keys a grant may carry: the line, its ladder, and the stat or Element the sheet reads it against. */
const GRANT_KEYS = ['id', 'values', 'stat', 'element'];
/** The canonical Elements the engine.json declares — a grant's Element is checked against these.
 *  `status_of` is optional in the data interface, so the keys are read with that declared. */
const ELEMENTS = Object.keys((E.elements as { status_of: Record<string, string> }).status_of);
/** The keys the spec's own top level may carry. */
const SPEC_KEYS = [
  'version', 'meta', 'points', 'node_kinds', 'keystone_groups', 'clusters',
  'rank_tiers', 'shallow_nodes', 'layout', 'nodes', 'mechanics',
];

export function checks(source?: any): G.GateRow[] {
  const { add, watch, rows } = G.gates();

  // The file the cage gates — or another object, so a caller can prove a broken structure FAILs
  // without writing a broken file.
  let spec: any = null;
  try { spec = source ?? JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { spec = null; }
  if (!spec) throw new Error('tools/data/tree.json is missing');

  // The engine is the one reader, so the cage gates what the client spends.
  let model: any = null;
  let buildError = '';
  try { model = createTree(spec as TreeSpec, MODS, ELEMENTS); } catch (e: any) { buildError = String(e?.message || e); }
  add('TR1', !buildError, buildError ? `the spec does not build: ${buildError}`
    : `the spec builds: ${model.nodes.length} nodes across ${model.branches.length} wings, ${model.cost} point a rank`);
  if (!model) return rows();

  const nodes: any[] = model.nodes;
  const byId: Record<string, any> = model.byId;
  const wings: string[] = model.branches;

  // TR2 — every node names only real parents or the start marker.
  {
    const bad: string[] = [];
    for (const n of nodes) for (const parent of n.needs) {
      if (parent !== 'start' && !byId[parent]) bad.push(`${n.id} needs ${parent}, which is not a node`);
    }
    add('TR2', bad.length === 0, bad.length ? bad.join(' · ')
      : `every node names only real parents or the start marker (${nodes.length} nodes, ${nodes.reduce((s, n) => s + n.needs.length, 0)} parent links)`);
  }

  // TR3 — every node is reachable from the start. The cross-links are MUTUAL rings by design, so
  // reachability is a flood and never an acyclicity test.
  {
    const reached = new Set<string>();
    const queue = nodes.filter((n) => n.needs.includes('start')).map((n) => n.id);
    while (queue.length) {
      const id = queue.shift()!;
      if (reached.has(id)) continue;
      reached.add(id);
      for (const n of nodes) if (n.needs.includes(id)) queue.push(n.id);
    }
    const orphans = nodes.filter((n) => !reached.has(n.id)).map((n) => n.id);
    add('TR3', orphans.length === 0, orphans.length ? `unreachable: ${orphans.join(', ')}`
      : `every one of the ${nodes.length} nodes is reachable from the free centre start`);
  }

  // TR4 — every grant names a real Mod line.
  {
    const known = new Set<string>(MODS.mods.map((m: any) => m.id));
    const bad: string[] = [];
    for (const n of nodes) for (const g of n.grants) if (!known.has(g.id)) bad.push(`${n.id} grants ${g.id}`);
    add('TR4', bad.length === 0, bad.length ? bad.join(' · ')
      : `every grant names a real mods.json line (${new Set(nodes.flatMap((n: any) => n.grants.map((g: any) => g.id))).size} distinct lines across ${nodes.length} nodes)`);
  }

  // TR5 — and a line the CHARACTER SHEET acts on. A line with no bucket is a silent no-op: the
  // point is spent and nothing moves. This is the check the old tree had no way to make.
  {
    const bad: string[] = [];
    for (const n of nodes) for (const g of n.grants) if (!SHEET_LINES.has(g.id)) bad.push(`${n.id} grants ${g.id}`);
    add('TR5', bad.length === 0, bad.length ? `${bad.join(' · ')} — the sheet has no bucket for those lines`
      : `every granted line reaches the character sheet (${SHEET_LINES.size} sheet lines cover all ${new Set(nodes.flatMap((n: any) => n.grants.map((g: any) => g.id))).size} tree lines)`);
  }

  // TR6 — a rank never grants nothing and never grants less than the rank below it.
  {
    const bad: string[] = [];
    for (const n of nodes) for (const g of n.grants) {
      if (!g.values.length) { bad.push(`${n.id} grants ${g.id} with no value`); continue; }
      let prev = 0;
      g.values.forEach((v: number, i: number) => {
        if (!(v > 0)) bad.push(`${n.id} ${g.id} rank ${i + 1} grants ${v} — a rank may not grant nothing`);
        else if (v < prev) bad.push(`${n.id} ${g.id} rank ${i + 1} grants ${v}, less than the rank below (${prev})`);
        prev = v;
      });
    }
    const totalRanks = nodes.reduce((s, n) => s + n.ranks, 0);
    add('TR6', bad.length === 0, bad.length ? bad.join(' · ')
      : `no rank grants nothing and no rank grants less than the one below it (${totalRanks} ranks checked)`);
  }

  // TR7 — a granted value sits inside the very line it grants.
  {
    const maxOf = (id: string) => Number((MODS.mods.find((m: any) => m.id === id) || {}).max ?? 0);
    const bad: string[] = [];
    for (const n of nodes) for (const g of n.grants) {
      const over = g.values.filter((v: number) => v > maxOf(g.id));
      if (over.length) bad.push(`${n.id} grants ${Math.max(...over)} above the ${g.id} maximum ${maxOf(g.id)}`);
    }
    add('TR7', bad.length === 0, bad.length ? bad.join(' · ')
      : `every granted value sits inside its line's own mods.json maximum`);
  }

  // TR8 — no two nodes share an id. An id is a save key, so a duplicate is a save that means two
  // different things.
  {
    const ids = nodes.map((n) => n.id);
    const dupes = Array.from(new Set(ids.filter((id, i) => ids.indexOf(id) !== i)));
    add('TR8', dupes.length === 0, dupes.length ? `duplicate node ids: ${dupes.join(', ')}`
      : `all ${nodes.length} node ids are unique (${ids[0]} … ${ids[ids.length - 1]})`);
  }

  // TR9 — the legacy ids in each wing are numbered in order. The id is the save key, so a renumbered
  // wing silently re-points every bought rank at a different line. A node of a newer family (a notable,
  // a keystone) carries its own name and is not numbered this way.
  {
    const bad: string[] = [];
    for (const w of wings) {
      const list = nodes.filter((n) => n.wing === w && /^\w+\.\d+$/.test(n.id));
      list.forEach((n, i) => { if (n.id !== `${w}.${i + 1}`) bad.push(`${w} node ${i + 1} is ${n.id}`); });
    }
    add('TR9', bad.length === 0, bad.length ? bad.join(' · ')
      : `every wing numbers its legacy nodes <wing>.1 … <wing>.${wings.map((w) => nodes.filter((n) => n.wing === w && /^\w+\.\d+$/.test(n.id)).length).join('/')} in order`);
  }

  // TR10 — the wings are ringed: a node at the cross-link depth is connected to its neighbour's, so
  // a path bought in one wing can be continued in the next.
  {
    const anchors = spec.layout?.wing_anchor_deg || {};
    const bad: string[] = [];
    const byDepth = new Map<number, any[]>();
    for (const n of nodes) {
      const d = n.needs.includes('start') ? 1 : 0;
      void d;
    }
    // the ring is read off the topology: each wing's node at a cross-link depth needs a node of the
    // neighbouring wing at the same depth
    const depthOf = (id: string): number => {
      const node = byId[id];
      if (!node) return 0;
      let d = 1;
      for (const p of node.needs) {
        if (p === 'start') continue;
        const parent = byId[p];
        if (!parent || parent.wing !== node.wing) continue;
        d = Math.max(d, depthOf(p) + 1);
      }
      return d;
    };
    const ring = [7, 14, 21].filter((d) => wings.some((w) => nodes.some((n) => n.wing === w && depthOf(n.id) === d)));
    for (const d of ring) {
      for (const w of wings) {
        const at = nodes.find((n) => n.wing === w && depthOf(n.id) === d);
        if (!at) continue;
        const others = at.needs.filter((p: string) => p !== 'start' && byId[p] && byId[p].wing !== w);
        if (!others.length) bad.push(`${at.id} at depth ${d} is not cross-linked to another wing`);
      }
    }
    const angles = Object.values(anchors) as number[];
    add('TR10', bad.length === 0 && new Set(angles).size === angles.length,
      bad.length ? bad.join(' · ')
        : new Set(angles).size !== angles.length ? 'two wings share an anchor, so they overlap'
          : `the wings are ringed at depth ${ring.join(', ')}, and each of the ${wings.length} wings has its own anchor (${angles.join('°, ')}°)`);
  }

  // TR11 — the spec carries only what the engine reads. A node's numbers are written out here, so a
  // second copy of them is a number that can disagree with the live one without anything noticing.
  {
    const unread: string[] = [];
    for (const key of Object.keys(spec)) if (!SPEC_KEYS.includes(key)) unread.push(`the spec carries an unread "${key}"`);
    for (const node of spec.nodes || []) {
      for (const key of Object.keys(node)) if (!READ_KEYS.includes(key)) unread.push(`${node.id} carries an unread "${key}"`);
      for (const grant of node.grants || []) {
        for (const key of Object.keys(grant)) if (!GRANT_KEYS.includes(key)) unread.push(`${node.id} grants an unread "${key}"`);
      }
    }
    add('TR11', unread.length === 0, unread.length ? unread.join(' · ')
      : `the spec carries only what the engine reads (${SPEC_KEYS.length} top-level keys · ${READ_KEYS.join(' · ')})`);
  }

  // TR12 — the note's own figures must match the tree. The note is the file's human description, so
  // its counts are a copy of the data and have to be checked like one.
  {
    const note = String(spec.meta?.note || '');
    const saidNodes = /(\d+)\s+nodes/.exec(note);
    const saidRanks = /(\d+)\s+ranks/.exec(note);
    const totalRanks = nodes.reduce((s, n) => s + n.ranks, 0);
    if (!saidNodes || !saidRanks) {
      watch('TR12', false,
        `the note states no node/ranks figure to check — the tree holds ${nodes.length} nodes and ${totalRanks} ranks`,
        `the note states ${nodes.length} nodes and ${totalRanks} ranks, as the tree holds`);
    } else {
      const okN = Number(saidNodes[1]) === nodes.length;
      const okR = Number(saidRanks[1]) === totalRanks;
      add('TR12', okN && okR,
        okN && okR ? `the note's own figures match the tree (${nodes.length} nodes, ${totalRanks} ranks)`
          : `the note says ${saidNodes[1]} nodes and ${saidRanks[1]} ranks; the tree holds ${nodes.length} nodes and ${totalRanks} ranks`);
    }
  }

  // TR13 — the layout is derived, deterministic, and nothing sits on top of anything else.
  {
    const again = createTree(spec as TreeSpec, MODS, ELEMENTS);
    const stable = again.nodes.every((n: any, i: number) => n.x === nodes[i].x && n.y === nodes[i].y);
    let closest = Infinity;
    let pair = '';
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d < closest) { closest = d; pair = `${nodes[i].id} / ${nodes[j].id}`; }
      }
    }
    const radius = Number(spec.layout?.node_radius ?? 0);
    add('TR13', stable && closest >= 2 * radius,
      !stable ? 'the layout generator is not deterministic — two runs over the same spec disagree'
        : `the closest two nodes sit ${closest.toFixed(1)} units apart (${pair}), inside the ${2 * radius} a node of radius ${radius} needs`);
  }

  // A watch, not a gate: the tree is wider than the level cap grants. That is a figure, read by eye
  // — the tree is meant to be PoE-shaped, and the published rates are the empty-tree baseline.
  {
    const currency = model.currencies?.tree || { base: 0, per_level: 0 };
    const budget = (currency.base ?? 0) + Math.max(0, E.stat.level_cap - 1) * (currency.per_level ?? 0);
    const totalRanks = nodes.reduce((s, n) => s + n.ranks, 0);
    watch('TRW1', totalRanks <= budget,
      `the tree offers ${totalRanks} ranks against a ${budget}-point budget at the level cap (${wings.map((w) => `${w} ${nodes.filter((n) => n.wing === w).length}`).join(' · ')}) — read by eye, never enforced`,
      `the tree offers ${totalRanks} ranks against a ${budget}-point budget at the level cap`);
  }

  // A watch, not a gate: the line budget (D9). The tree never hands out more of a line than its
  // budget, so the share each line holds is read here by eye — the figures are the measurement the
  // balance decision rests on, and they are never enforced.
  {
    const budgetPct = Number(spec.points?.budget_pct ?? 0);
    const maxOf = (id: string) => Number((MODS.mods.find((m: any) => m.id === id) || {}).max ?? 0);
    const spent = new Map<string, number>();
    for (const n of nodes) for (const g of n.grants) {
      const total = g.values.reduce((a: number, b: number) => a + b, 0);
      spent.set(g.id, (spent.get(g.id) ?? 0) + total);
    }
    const held = [...spent.entries()]
      .map(([id, total]) => ({ id, pct: maxOf(id) ? (total / maxOf(id)) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);
    const over = held.filter((r) => r.pct > budgetPct);
    const atMax = held.filter((r) => r.pct >= 100);
    const untouched = MODS.mods.filter((m: any) => !spent.has(m.id)).map((m: any) => m.id);
    watch('TRW2', over.length === 0,
      `${over.length} line(s) sit over the ${budgetPct}% budget (${over.map((r) => `${r.id} ${r.pct.toFixed(0)}%`).join(' · ')}); ${atMax.length} sit at or over their whole maximum (${atMax.map((r) => `${r.id} ${r.pct.toFixed(0)}%`).join(' · ')}); the tree never touches ${untouched.length} line(s) (${untouched.join(' · ')}) — read by eye, never enforced`,
      `every line sits inside the ${budgetPct}% budget (the largest is ${held[0]?.id} ${held[0]?.pct.toFixed(0)}%)`);
  }

  return rows();
}

function report(): void {
  G.report(checks());
}

/** The CLI runs only when this file is the entry point, so a test may import `checks` without the
 *  cage reporting (and setting the exit code) behind it. */
const isEntry = process.argv[1] ? path.resolve(process.argv[1]) === path.resolve(import.meta.filename) : false;

if (isEntry) {
  if (process.argv.includes('--checks')) {
    report();
  } else {
    console.log('Tree cage — tools/data/tree.json is the spec\n\n  node tools/tree.ts --checks   gate the passive tree\n');
  }
}
