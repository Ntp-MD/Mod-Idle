import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/json.ts';
import * as G from './lib/gates.ts';
import { createTree, type TreeSpec } from '../engine/tree.ts';
import { SHEET_LINES } from '../game/src/sim/lines.ts';
import { keystoneBuildContext } from '../game/src/sim/keystone-runtime.ts';
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

/** The four bridge Notables of the recipe; each joins spine04 of two regions. */
const JUNCTIONS: [string, string][] = [['str', 'agi'], ['dex', 'int'], ['wis', 'vit'], ['lck', 'str']];

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Rebuild the v3 node list and its drawn links from the recipe (§3.1), keeping everything the file
 * authors: profiles, keystone bundles and their numbers, pairs and layout. The generated order is
 * region → spine → cluster (branch, Notable, Keystone) → junctions, so a second run is byte-identical.
 */
export function buildSpec(source: any): any {
  if (source?.version !== 3) throw new Error('tree build: the spec is not version 3');
  const regions: string[] = source.layout?.regions ?? [];
  if (!regions.length) throw new Error('tree build: layout.regions is empty');
  for (const region of regions)
    if (!source.profiles?.[`core.${region}`]) throw new Error(`tree build: profile core.${region} is missing`);

  const keystones = new Map<string, any>();
  for (const node of source.nodes ?? []) {
    if (node.kind !== 'keystone') continue;
    const cluster = node.placement?.cluster;
    if (!Number.isInteger(cluster) || cluster < 1 || cluster > 12)
      throw new Error(`tree build: keystone ${node.id} has no cluster placement`);
    if (!regions.includes(node.wing)) throw new Error(`tree build: keystone ${node.id} is in the unknown region ${node.wing}`);
    if (!node.effects?.length) throw new Error(`tree build: keystone ${node.id} carries no bundle`);
    const key = `${node.wing}.${cluster}`;
    if (keystones.has(key)) throw new Error(`tree build: two keystones sit on ${node.wing} cluster ${cluster}`);
    keystones.set(key, node);
  }

  const nodes: any[] = [];
  for (const region of regions) {
    for (let i = 1; i <= 20; i++) {
      nodes.push({
        id: `normal.${region}.s${pad2(i)}`,
        wing: region,
        kind: 'normal',
        needs: [i === 1 ? 'start' : `normal.${region}.s${pad2(i - 1)}`],
        profile: `core.${region}`,
        placement: { role: 'spine', index: i },
      });
    }
    for (let j = 1; j <= 12; j++) {
      for (let k = 1; k <= 5; k++) {
        nodes.push({
          id: `normal.${region}.c${pad2(j)}.${pad2(k)}`,
          wing: region,
          kind: 'normal',
          needs: [k === 1 ? `normal.${region}.s${pad2(j + 6)}` : `normal.${region}.c${pad2(j)}.${pad2(k - 1)}`],
          profile: `core.${region}`,
          placement: { role: 'branch', cluster: j, step: k },
        });
      }
      const notable = `notable.${region}.${pad2(j)}`;
      const notableProfile = source.profiles?.[notable];
      if (!Array.isArray(notableProfile) || !notableProfile.length)
        throw new Error(`tree build: profile ${notable} is missing`);
      nodes.push({
        id: notable,
        wing: region,
        kind: 'notable',
        needs: [`normal.${region}.c${pad2(j)}.${pad2(5)}`],
        profile: notable,
        placement: { role: 'notable', cluster: j },
        name: `${region.toUpperCase()} Focus ${pad2(j)}`,
      });
      const keystone = keystones.get(`${region}.${j}`);
      if (keystone) nodes.push({
        id: keystone.id,
        wing: region,
        kind: 'keystone',
        needs: [notable],
        grants: [],
        ...(keystone.name ? { name: keystone.name } : {}),
        ...(keystone.description ? { description: keystone.description } : {}),
        ...(keystone.draft_ref !== undefined ? { draft_ref: keystone.draft_ref } : {}),
        placement: { role: 'keystone', cluster: j },
        effects: keystone.effects,
      });
    }
  }

  for (const [a, b] of JUNCTIONS) {
    const id = `notable.junction.${a}-${b}`;
    if (!regions.includes(a) || !regions.includes(b))
      throw new Error(`tree build: the junction ${id} names a region the layout does not hold`);
    if (!source.profiles?.[id]) throw new Error(`tree build: profile ${id} is missing`);
    nodes.push({
      id,
      wing: a,
      kind: 'notable',
      needs: [`normal.${a}.s04`, `normal.${b}.s04`],
      profile: id,
      placement: { role: 'junction', a, b },
      name: `${a.toUpperCase()}–${b.toUpperCase()} Link`,
    });
  }

  // The ring: each pair of neighbouring regions is joined at spine06 and spine20 (lck wraps to str).
  const links: any[] = [];
  for (let i = 0; i < regions.length; i++) {
    const a = regions[i];
    const b = regions[(i + 1) % regions.length];
    links.push({ a: `normal.${a}.s06`, b: `normal.${b}.s06`, shape: 'arc' });
    links.push({ a: `normal.${a}.s20`, b: `normal.${b}.s20`, shape: 'arc' });
  }

  return {
    version: 3,
    mechanics: source.mechanics,
    meta: {
      note: 'There are 700 nodes and 700 ranks in seven regions: str, agi, dex, int, wis, vit and lck. '
        + 'Each region is a spine of twenty Normal nodes with twelve clusters of five Normal nodes and a Notable, '
        + 'and a Keystone leaf on the clusters the catalogue assigns. A free centre start connects the first spine '
        + 'node of every region; spine06 and spine20 are ringed to the neighbouring region, and four junction '
        + 'Notables bridge spine04 of str–agi, dex-int, wis–vit and lck–str. Normal nodes grant +1 to their own '
        + 'Core attribute, Notables grant their profile, and Keystones are grantless bundles paid in attainment. '
        + 'Every node has one rank; the layout is derived from the seven-spoke placement, never hand-placed.',
      node_columns: ['Node', 'Region', 'Kind', 'Profile', 'Effects', 'Placement', 'Connections'],
    },
    points: source.points,
    node_kinds: {
      normal: { ranks: 1, cost: 1, currency: 'tree' },
      notable: { ranks: 1, cost: 3, currency: 'tree' },
      keystone: { ranks: 1, cost: 1, currency: 'attainment' },
    },
    keystone_groups: [],
    clusters: [],
    profiles: source.profiles,
    incompatibilities: source.incompatibilities ?? [],
    layout: source.layout,
    links,
    nodes,
  };
}

/** The keys a node may carry. Anything else is a number the engine never reads. */
const READ_KEYS = [
  'id', 'wing', 'kind', 'needs', 'grants', 'name', 'description', 'weapon', 'rule', 'group',
  'profile', 'placement', 'effects', 'draft_ref',
];
/** The keys a grant may carry: the line, its ladder, and the stat or Element the sheet reads it against. */
const GRANT_KEYS = ['id', 'values', 'stat', 'element'];
/** The keys a keystone bundle may carry; `params` is the schema-checked map the registry reads. */
const EFFECT_KEYS = ['kind', 'key', 'params'];
/** The keys each placement role may carry — the recipe fields the engine turns into coordinates. */
const PLACEMENT_KEYS: Record<string, string[]> = {
  spine: ['role', 'index'],
  branch: ['role', 'cluster', 'step'],
  notable: ['role', 'cluster'],
  keystone: ['role', 'cluster'],
  junction: ['role', 'a', 'b'],
};
/** The canonical Elements the engine.json declares — a grant's Element is checked against these.
 *  `status_of` is optional in the data interface, so the keys are read with that declared. */
const ELEMENTS = Object.keys((E.elements as { status_of: Record<string, string> }).status_of);
/** The keys the spec's own top level may carry. */
const SPEC_KEYS = [
  'version', 'meta', 'points', 'node_kinds', 'keystone_groups', 'clusters', 'profiles',
  'links', 'incompatibilities', 'rank_tiers', 'shallow_nodes', 'layout', 'nodes', 'mechanics',
];
/** The keys a drawn link and an incompatibility pair may carry. */
const LINK_KEYS = ['a', 'b', 'shape'];
const PAIR_KEYS = ['a', 'b'];

/** The same real handler table the client builds with, so a bundle is gated against functions. */
const context = () => keystoneBuildContext(ELEMENTS);

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
  try { model = createTree(spec as TreeSpec, MODS, ELEMENTS, context()); } catch (e: any) { buildError = String(e?.message || e); }
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

  // TR3 — every node is reachable from the start over the same undirected graph a purchase walks
  // (`needs` + v3 `links`). The cross-links are MUTUAL rings by design, so reachability is a flood
  // and never an acyclicity test.
  {
    const reached = new Set<string>();
    const queue = nodes.filter((n) => n.needs.includes('start')).map((n) => n.id);
    for (const id of queue) reached.add(id);
    while (queue.length) {
      const id = queue.shift()!;
      for (const next of model.adjacentTo(id)) {
        if (reached.has(next)) continue;
        reached.add(next);
        queue.push(next);
      }
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

  // TR9 — the id names the node's own region and place in the recipe. The id is the save key, so an
  // id that disagrees with its placement would re-point every bought rank at a different node.
  {
    const bad: string[] = [];
    if (model.version >= 3) {
      for (const n of nodes) {
        const p = n.placement;
        if (!p) { bad.push(`${n.id} carries no placement`); continue; }
        let expected = '';
        if (p.role === 'spine') expected = `normal.${n.wing}.s${pad2(p.index)}`;
        else if (p.role === 'branch') expected = `normal.${n.wing}.c${pad2(p.cluster)}.${pad2(p.step)}`;
        else if (p.role === 'notable') expected = `notable.${n.wing}.${pad2(p.cluster)}`;
        else if (p.role === 'keystone') expected = `keystone.${n.effects?.[0]?.key ?? ''}`;
        else expected = `notable.junction.${p.a}-${p.b}`;
        if (n.id !== expected) bad.push(`${n.id} sits at a ${p.role} placement, which names ${expected}`);
        if (p.role === 'junction' && n.wing !== p.a && n.wing !== p.b)
          bad.push(`${n.id} is in ${n.wing}, which is neither junction region ${p.a} or ${p.b}`);
      }
    } else {
      for (const w of wings) {
        const list = nodes.filter((n) => n.wing === w && /^\w+\.\d+$/.test(n.id));
        list.forEach((n, i) => { if (n.id !== `${w}.${i + 1}`) bad.push(`${w} node ${i + 1} is ${n.id}`); });
      }
    }
    add('TR9', bad.length === 0, bad.length ? bad.join(' · ')
      : model.version >= 3
        ? `every one of the ${nodes.length} ids names its region and placement`
        : `every wing numbers its legacy nodes <wing>.1 … <wing>.${wings.map((w) => nodes.filter((n) => n.wing === w && /^\w+\.\d+$/.test(n.id)).length).join('/')} in order`);
  }

  // TR10 — the regions are one ring: a path bought in one can be continued in the next. v2 reads this
  // off the cross-link depths; v3 reads the drawn `links` and the junction Notables that bridge two
  // regions. The check is the property, never a count of links or regions.
  {
    const bad: string[] = [];
    if (model.version >= 3) {
      for (const link of model.links) {
        const a = byId[link.a];
        const b = byId[link.b];
        if (!a || !b) { bad.push(`${link.a} – ${link.b} names a node that does not exist`); continue; }
        if (a.wing === b.wing) bad.push(`${link.a} – ${link.b} joins two nodes of one region, not a ring`);
      }
      // the region graph: any drawn link or cross-region parent joins two regions
      const regionEdges = new Map<string, Set<string>>(wings.map((w) => [w, new Set<string>()]));
      const join = (a: string, b: string) => {
        if (a === b) return;
        regionEdges.get(a)?.add(b);
        regionEdges.get(b)?.add(a);
      };
      for (const link of model.links) if (byId[link.a] && byId[link.b]) join(byId[link.a].wing, byId[link.b].wing);
      for (const n of nodes) for (const parent of n.needs)
        if (parent !== 'start' && byId[parent]) join(n.wing, byId[parent].wing);
      const seen = new Set<string>();
      const queue = wings.length ? [wings[0]] : [];
      for (const w of queue) seen.add(w);
      while (queue.length) {
        for (const next of regionEdges.get(queue.shift()!)!) if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
      const apart = wings.filter((w) => !seen.has(w));
      if (apart.length) bad.push(`the regions ${apart.join(', ')} are not ringed to the rest`);
      for (const n of nodes.filter((n) => n.placement?.role === 'junction')) {
        const p = n.placement as { a: string; b: string };
        if (p.a === p.b) bad.push(`${n.id} bridges ${p.a} to itself`);
        const reaches = new Set(n.needs.map((id: string) => byId[id]?.wing));
        if (!reaches.has(p.a) || !reaches.has(p.b))
          bad.push(`${n.id} does not need a node of both ${p.a} and ${p.b}`);
      }
      add('TR10', bad.length === 0, bad.length ? bad.join(' · ')
        : `the ${model.links.length} links ring the regions and every one of the ${wings.length} regions reaches the others, with the junction Notables bridging two regions each`);
    } else {
      const anchors = spec.layout?.wing_anchor_deg || {};
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
      for (const effect of node.effects || []) {
        for (const key of Object.keys(effect)) if (!EFFECT_KEYS.includes(key)) unread.push(`${node.id} carries an unread effect "${key}"`);
      }
      const placement = node.placement;
      if (placement) {
        const allowed = PLACEMENT_KEYS[placement.role] || [];
        for (const key of Object.keys(placement)) if (!allowed.includes(key)) unread.push(`${node.id} carries an unread placement "${key}"`);
      }
    }
    for (const [profile, grants] of Object.entries(spec.profiles || {})) {
      for (const grant of grants as any[]) {
        for (const key of Object.keys(grant)) if (!GRANT_KEYS.includes(key)) unread.push(`profile ${profile} carries an unread grant "${key}"`);
      }
    }
    for (const link of spec.links || []) {
      for (const key of Object.keys(link)) if (!LINK_KEYS.includes(key)) unread.push(`the link ${link.a} – ${link.b} carries an unread "${key}"`);
    }
    for (const pair of spec.incompatibilities || []) {
      for (const key of Object.keys(pair)) if (!PAIR_KEYS.includes(key)) unread.push(`the pair ${pair.a} – ${pair.b} carries an unread "${key}"`);
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

  // TR13 — the layout is derived, deterministic, and nothing sits on top of anything else. The world
  // bounds carry every node at that node's own radius, the start marker, and the spec's padding.
  {
    const again = createTree(spec as TreeSpec, MODS, ELEMENTS, context());
    const stable = again.nodes.every((n: any, i: number) => n.x === nodes[i].x && n.y === nodes[i].y);
    const radiusOf = (n: any) => Number(spec.layout?.radii?.[n.kind] ?? spec.layout?.node_radius ?? 0);
    const startRadius = Number(spec.layout?.radii?.start ?? spec.layout?.node_radius ?? 0);
    const start = model.graph.start;
    let closest = Infinity;
    let pair = '';
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d < closest) { closest = d; pair = `${nodes[i].id} / ${nodes[j].id}`; }
      }
    }
    // the nearest pair's own two radii are the clearance that pair must keep
    const closestPair = closest < Infinity
      ? nodes.filter((n) => pair.split(' / ').includes(n.id)).reduce((s: number, n: any) => s + radiusOf(n), 0)
      : 0;
    const world = model.layout;
    const outside = nodes.filter((n) => n.x - radiusOf(n) < world.x || n.y - radiusOf(n) < world.y
      || n.x + radiusOf(n) > world.x + world.width || n.y + radiusOf(n) > world.y + world.height);
    const startInside = start.x - startRadius >= world.x && start.y - startRadius >= world.y
      && start.x + startRadius <= world.x + world.width && start.y + startRadius <= world.y + world.height;
    const padding = Number(spec.layout?.padding ?? 0);
    add('TR13', stable && closest >= closestPair && !outside.length && startInside && padding >= 0,
      !stable ? 'the layout generator is not deterministic — two runs over the same spec disagree'
        : outside.length ? `the world bounds cut off ${outside.map((n) => n.id).join(', ')}`
          : !startInside ? 'the world bounds cut off the start marker'
            : padding < 0 ? `the layout padding is negative (${padding})`
              : `the closest two nodes sit ${closest.toFixed(1)} units apart (${pair}), inside the ${closestPair.toFixed(1)} their radii need`);
  }

  // TR14 — the checked file is the build's own output. A hand-added or hand-moved node is a node the
  // next `--build` would erase, so the file has to be a fixed point of the recipe.
  {
    const canonical = (value: any): string => JSON.stringify(value, (_key, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
        : v);
    let built = '';
    let buildAgain = '';
    let reason = '';
    try {
      built = canonical(buildSpec(spec));
      buildAgain = canonical(buildSpec(JSON.parse(built)));
    } catch (e: any) { reason = String(e?.message || e); }
    const same = buildAgain === built;
    const current = canonical(spec);
    const ok = !reason && same && current === built;
    add('TR14', ok,
      ok ? 'the checked file is the recipe\'s own output'
        : reason ? `the build refuses the spec: ${reason}`
          : !same ? 'the build is not idempotent — a second run over its own output differs'
            : 'the checked file differs from the recipe\'s output — run node tools/tree.ts --build');
  }

  // TR15 — every declared profile is reachable from a node, and a Notable names its own profile. A
  // profile nobody reads is a set of numbers that can drift without a node ever showing it.
  {
    const declared = Object.keys(spec.profiles || {});
    const used = new Set<string>(model.profilesUsed);
    const unused = declared.filter((key) => !used.has(key));
    const renamed = nodes.filter((n) => n.kind === 'notable' && n.profile !== n.id);
    add('TR15', unused.length === 0 && renamed.length === 0,
      unused.length ? `unused profiles: ${unused.join(', ')}`
        : renamed.length ? renamed.map((n) => `${n.id} reads ${n.profile}`).join(' · ')
          : `all ${declared.length} profiles are read, and every Notable resolves its own`);
  }

  // TR16 — the pairwise bans are exactly the file's pairs, in both orders and with no transitive
  // closure. Only a listed pair may refuse a second keystone.
  {
    const keystones = nodes.filter((n) => n.kind === 'keystone');
    const keyOf = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
    const listed = new Set(model.incompatibilities.map((p: any) => keyOf(p.a, p.b)));
    const wrong: string[] = [];
    for (let i = 0; i < keystones.length; i++) {
      for (let j = i + 1; j < keystones.length; j++) {
        const a = keystones[i].id;
        const b = keystones[j].id;
        const banned = !model.pairOk(a, { [b]: 1 }) || !model.pairOk(b, { [a]: 1 });
        if (banned !== listed.has(keyOf(a, b))) wrong.push(`${a} – ${b} is ${banned ? 'banned but not listed' : 'listed but allowed'}`);
      }
    }
    for (const pair of model.incompatibilities) {
      if (!model.conflictsIn({ [pair.a]: 1, [pair.b]: 1 })) wrong.push(`${pair.a} – ${pair.b} is not refused when held together`);
    }
    add('TR16', wrong.length === 0, wrong.length ? wrong.join(' · ')
      : `the file's ${listed.size} pairs are exactly the pairs the engine bans, in both orders, with no transitive closure`);
  }

  // A watch, not a gate: the tree is wider than the level cap grants. That is a figure, read by eye
  // — the tree is meant to be PoE-shaped, and the published rates are the empty-tree baseline.
  {
    const budget = model.pointsAt(E.stat.level_cap, E.stat.level_cap);
    const totalRanks = nodes.reduce((s, n) => s + n.ranks, 0);
    const treeCost = nodes.filter((n) => n.currency === 'tree').reduce((s, n) => s + n.points, 0);
    const attainmentCost = nodes.filter((n) => n.currency !== 'tree').reduce((s, n) => s + n.points, 0);
    watch('TRW1', treeCost <= budget,
      `the tree costs ${treeCost} tree points and ${attainmentCost} attainment against a ${budget}-point budget at the level cap (${wings.map((w) => `${w} ${nodes.filter((n) => n.wing === w).length}`).join(' · ')}) — read by eye, never enforced`,
      `the tree costs ${treeCost} tree points and ${attainmentCost} attainment against a ${budget}-point budget at the level cap, across ${totalRanks} ranks`);
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
  if (process.argv.includes('--build')) {
    const source = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    fs.writeFileSync(OUT, `${JSON.stringify(buildSpec(source), null, 2)}\n`);
    console.log('Tree build — wrote the seven-spoke node list and links to tools/data/tree.json');
  } else if (process.argv.includes('--checks')) {
    report();
  } else {
    console.log('Tree cage — tools/data/tree.json is the spec\n\n  node tools/tree.ts --build    rebuild the node list and links from the recipe\n  node tools/tree.ts --checks   gate the passive tree\n');
  }
}
