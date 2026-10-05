/**
 * Tree cage — the wiring between the skill tree and the skill roster.
 *
 *   node tools/tree.ts            help
 *   node tools/tree.ts --emit     print the generated summary block
 *   node tools/tree.ts --write    apply skills.json `renames` to the node "Enables"
 *                                 cells, then rewrite the summary in skill-tree.md
 *   node tools/tree.ts --checks   parse the node tables, validate every "Enables"
 *                                 cell against skills.json + tree.json, fail on a
 *                                 stale summary (checks.md D19)
 *
 * The 122 minor nodes are prose tables in skill-tree-*.md; this tool does not own
 * their text, it owns the *links*. To rename a skill: change its name in
 * skills.json, add `old: new` to skills.json `renames`, then `--write` — the node
 * cells update themselves, so the md is never hand-edited for a rename.
 */

import * as R from './lib/roster.ts';
import * as G from './lib/generated.ts';
import type { Writer } from './lib/types.ts';

const TREE = JSON.parse(G.read('tools/data/tree.json'));

const KEYSTONE_NAMES = new Set(TREE.keystones.map((k: any) => k.name));
const SKILL_NAMES = new Set(R.allNames());
const KNOWN = new Set([...SKILL_NAMES, ...KEYSTONE_NAMES]);
const PENDING_REFS = new Set(TREE.pending_refs || []);
const RENAMES = R.RENAMES || {};
const RENAME_KEYS = Object.keys(RENAMES);

// ---------------------------------------------------------------- parser

const BRANCH_RE = /^###\s+(.+?)\s+branch\s+—\s+(\d+)\s+minor in\s+(\d+)\s+limbs/;
const LIMB_RE = /^\*\*(.+?)\s+limb\*\*\s+\((\d+)\s+nodes/;

function parseBranch(file: string) {
  const lines = G.read(file).split(/\r?\n/);
  const out: Record<string, any> = { file, branchName: null, minorsDeclared: null, limbsDeclared: null, limbs: [], nodes: [] };
  let limb: any = null;
  for (const line of lines) {
    let m = line.match(BRANCH_RE);
    if (m) { out.branchName = m[1]; out.minorsDeclared = Number(m[2]); out.limbsDeclared = Number(m[3]); continue; }
    m = line.match(LIMB_RE);
    if (m) { limb = { name: m[1], declared: Number(m[2]), parsed: 0 }; out.limbs.push(limb); continue; }
    if (!/^\|/.test(line)) continue;
    const cells = line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c: any) => c.trim());
    if (cells.length < 4 || !/^\d+$/.test(cells[0])) continue; // header / separator
    const node = { tier: Number(cells[0]), name: cells[1], rule: cells[2], enables: cells[3], limb: limb ? limb.name : null, file };
    out.nodes.push(node);
    if (limb) limb.parsed++;
  }
  return out;
}

function cleanRef(cell: any) {
  return String(cell).replace(/\*\*/g, '').trim();
}

function isIntentionalEmpty(cell: any) {
  const c = cleanRef(cell);
  return c === '' || /^[—–-]/.test(c);
}

function resolveRef(cell: any) {
  const c = cleanRef(cell);
  if (isIntentionalEmpty(cell)) return { ok: true, empty: true, names: [], bad: [], renamed: [] };
  const parts = c.split(/\s*[·/]\s*/).map((x: any) => x.trim()).filter(Boolean);
  const bad: any[] = [];
  const renamed: any[] = [];
  for (const p of parts) {
    if (KNOWN.has(p)) continue;
    if (RENAMES[p]) { renamed.push({ from: p, to: RENAMES[p] }); continue; }
    bad.push(p);
  }
  return { ok: bad.length === 0 && renamed.length === 0, empty: false, names: parts, bad, renamed };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Rewrite any node "Enables" cell that names a skill recorded in skills.json `renames`. */
function applyRenames(file: string) {
  if (!RENAME_KEYS.length) return 0;
  const lines = G.read(file).split(/\r?\n/);
  let changed = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!/^\|/.test(lines[i])) continue;
    const raw = lines[i].replace(/^\|/, '').replace(/\|\s*$/, '').split('|');
    if (raw.length < 4 || !/^\d+$/.test(raw[0].trim())) continue;
    const before = raw[3];
    let after = before;
    for (const [from, to] of Object.entries(RENAMES)) after = after.replace(new RegExp('\\b' + escapeRe(from) + '\\b', 'g'), to);
    if (after !== before) { raw[3] = after; lines[i] = '|' + raw.join('|') + '|'; changed++; }
  }
  if (changed) G.write(file, lines.join('\n'));
  return changed;
}

// ---------------------------------------------------------------- gates

function analyze() {
  const branches = TREE.branches.map((b: any) => {
    const parsed = parseBranch(b.file);
    const dangling: any[] = [];
    const renamed: any[] = [];
    for (const n of parsed.nodes) {
      const r = resolveRef(n.enables);
      if (r.bad.length) dangling.push({ node: n.name, ref: n.enables, bad: r.bad });
      if (r.renamed.length) renamed.push({ node: n.name, from: r.renamed.map((x: any) => x.from).join('/'), to: r.renamed.map((x: any) => x.to).join('/') });
    }
    return { ...b, parsed, dangling, renamed };
  });
  return branches;
}

function gates(branches: any) {
  const out: any[] = [];
  const add = (id: any, ok: any, detail: any) => out.push({ id, ok, detail });

  const ids = TREE.keystones.map((k: any) => k.id);
  add('T1', ids.length === new Set(ids).size, `unique keystone ids (${ids.length} keystones)`);

  const names = new Set(TREE.keystones.map((k: any) => k.name));
  const badPair = TREE.keystones.filter((k: any) => !names.has(k.pair)).map((k: any) => k.name);
  add('T2', badPair.length === 0, `every keystone pair names a real keystone${badPair.length ? ' · BAD: ' + badPair.join(', ') : ''}`);

  const branchIds = new Set(TREE.branches.map((b: any) => b.id));
  const badBranch = TREE.keystones.filter((k: any) => !branchIds.has(k.branch)).map((k: any) => k.name);
  add('T3', badBranch.length === 0, `every keystone names a real branch${badBranch.length ? ' · BAD: ' + badBranch.join(', ') : ''}`);

  // the tree multiplier SUMS a typical path of 6, and mob_HP is built on x1.85 — so the
  // band has to straddle that. A new keystone that pushes every legal path past it is a
  // mob_HP problem, not a node problem (skill-tree.md section 3).
  const KB: any = keystoneBudget();
  add('T7', TREE.keystones.length === 0 || (KB.bestMul >= 1.85 && KB.worstMul < 1.85),
    `legal tree band is x${KB.worstMul} (worst ${KB.worstVals.join('/')}) to x${KB.bestMul} (best ${KB.bestVals.join('/')}), so the x1.85 mob_HP baseline sits inside it`);

  const missingCalc = TREE.keystones.filter((k: any) => k.origin !== 'original' && !k.calc).map((k: any) => k.name);
  const missingRule = TREE.keystones.filter((k: any) => k.rule === undefined).map((k: any) => k.name);
  add('T8', missingCalc.length === 0 && missingRule.length === 0,
    `every keystone carries the rule and the worked calculation its table prints${missingRule.length ? ' · no rule: ' + missingRule.join(', ') : ''}${missingCalc.length ? ' · no calc: ' + missingCalc.join(', ') : ''}`);

  const mismatched: any[] = [];
  for (const b of branches) {
    if (b.parsed.nodes.length !== b.minors) mismatched.push(`${b.name} minors ${b.parsed.nodes.length}≠${b.minors}`);
    if (b.parsed.limbs.length !== b.limbs) mismatched.push(`${b.name} limbs ${b.parsed.limbs.length}≠${b.limbs}`);
    for (const l of b.parsed.limbs) if (l.parsed !== l.declared) mismatched.push(`${b.name}/${l.name} ${l.parsed}≠${l.declared}`);
  }
  add('T4', mismatched.length === 0, `parsed node/limb counts match every declared header${mismatched.length ? ' · ' + mismatched.join(' · ') : ''}`);

  const dangling = branches.flatMap((b: any) => b.dangling.map((d: any) => ({ branch: b.name, node: d.node, ref: d.ref, bad: d.bad })));
  const renamed = branches.flatMap((b: any) => b.renamed.map((d: any) => ({ branch: b.name, ...d })));
  const unexpected = dangling.filter((d: any) => d.bad.some((n: any) => !PENDING_REFS.has(n)));
  const pending = dangling.length - unexpected.length;
  if (unexpected.length) {
    add('T5', false, `"Enables" cell(s) point at unknown skills · ${unexpected.length} UNEXPECTED: ` + unexpected.slice(0, 12).map((d: any) => `${d.branch}/${d.node}→${d.ref}`).join(' · ') + (unexpected.length > 12 ? ' …' : ''));
  } else if (renamed.length) {
    out.push({ id: 'T5', ok: true, status: 'PENDING', detail: `${renamed.length} "Enables" cell(s) use a renamed skill (recorded in skills.json renames) — run \`node tools/tree.ts --write\` to update them: ` + renamed.slice(0, 8).map((d: any) => `${d.branch}/${d.node} ${d.from}→${d.to}`).join(' · ') });
  } else if (pending) {
    out.push({ id: 'T5', ok: true, status: 'PENDING', detail: `${pending} "Enables" cell(s) point at the cleared buff set (waived in tree.json pending_refs, tracked by D19) — no unexpected dangling reference` });
  } else {
    add('T5', true, 'every "Enables" cell resolves to a real skill or keystone');
  }

  // The tree has to be buildable: a fixed shape, derived from the tables, not invented per node.
  const shape: any[] = [];
  for (const b of branches) {
    if (b.parsed.limbs.length !== 5) shape.push(`${b.name} has ${b.parsed.limbs.length} limbs, not the 5 the shape needs`);
    for (const l of b.parsed.limbs) if (l.parsed < 4) shape.push(`${b.name}/${l.name} has only ${l.parsed} nodes (a spoke needs 4+)`);
  }
  const totalMinors = branches.reduce((t: any, b: any) => t + b.parsed.nodes.length, 0);
  if (totalMinors > 0 && totalMinors !== 122) shape.push(totalMinors + ' minor nodes parsed, not the 122 the removed tree declared');
  add('T6', shape.length === 0, shape.length ? shape.join(' · ')
    : `the tree is buildable from the tables: 3 branches × 5 limbs × ≥4 nodes = ${totalMinors} minors, and tier = position within its own limb (hub → branch gateway → limb gateway → node 1..N)`);

  return out;
}

// ---------------------------------------------------------------- summary block

function summaryBlock(branches: any) {
  const rows = branches.map((b: any) => {
    const keys = TREE.keystones.filter((k: any) => k.branch === b.id).length;
    return `| ${b.name} | \`${b.file}\` | ${b.minors} | ${b.parsed.nodes.length} | ${b.parsed.limbs.length} | ${keys} | ${b.dangling.length} |`;
  });
  const tot = {
    minors: branches.reduce((s: any, b: any) => s + b.minors, 0),
    parsed: branches.reduce((s: any, b: any) => s + b.parsed.nodes.length, 0),
    limbs: branches.reduce((s: any, b: any) => s + b.parsed.limbs.length, 0),
    keys: TREE.keystones.length,
    dangling: branches.reduce((s: any, b: any) => s + b.dangling.length, 0),
  };
  const dangling = branches.flatMap((b: any) => b.dangling.map((d: any) => `${b.name} · ${d.node} → ${cleanRef(d.ref)}`));
  return [
    '| Branch | File | Minor declared | Minor parsed | Limbs parsed | Keystones | Dangling refs |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    `| **total** | 3 files | **${tot.minors}** | **${tot.parsed}** | **${tot.limbs}** | **${tot.keys}** | **${tot.dangling}** |`,
    '',
    tot.dangling
      ? `> **${tot.dangling} dangling "Enables" references** — a node points at a skill that no longer exists in \`skills.json\` (mostly the cleared buff set). \`checks.md\` D19 stays FAIL until these nodes are rewritten. Full list: ${dangling.slice(0, 20).join(' · ')}${dangling.length > 20 ? ' …' : ''}`
      : '> Every node "Enables" cell resolves to a real skill or keystone. `checks.md` D19 reference check passes.',
  ].join('\n');
}

function layoutBlock(branches: any) {
  const rows: any[] = [];
  for (const br of branches) {
    const keys = TREE.keystones.filter((k: any) => k.branch === br.id);
    br.parsed.limbs.forEach((l: any, i: any) => {
      const key = keys.length ? keys[i % keys.length].name : '—';
      rows.push(`| ${br.name} | ${i + 1} · ${l.name} | ${l.parsed} | 1-${l.parsed} | ${key} |`);
    });
  }
  return [
    '| Branch | Limb (order from the hub) | Nodes | Tiers it can hold | Spoke keystone |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    'Pathing, so a client guesses nothing: **hub → branch gateway → limb gateway → nodes in table order**. A node is purchasable once the node before it in the same limb is owned; tier is distance from the hub, exactly as this file already describes it. The keystone column is the paired-spoke assignment, cycled per branch — a keystone is reachable through two limbs, never one (T2).',
  ].join('\n');
}

// ---------------------------------------------------------------- keystone tables

const BRANCH_LABEL: Record<string, string> = { impact: 'Impact', stream: 'Stream', control: 'Control' };

/** One pick per exclusive pair: walk `order` and take a keystone, claiming its whole pair
 *  so the partner is skipped. Returns every legal pick, not just the first 6. */
function legalPicks(order: any) {
  const claimed = new Set();
  const picks: any[] = [];
  for (const k of order) {
    if (claimed.has(k.name) || claimed.has(k.pair)) continue;
    claimed.add(k.name);
    claimed.add(k.pair);
    picks.push(k);
  }
  return picks;
}

function keystoneBudget() {
  const K = TREE.keystones;
  const orig = K.filter((k: any) => k.origin === 'original');
  const fresh = K.filter((k: any) => k.origin !== 'original');
  const mean = (a: any) => (a.reduce((s: any, k: any) => s + k.value, 0) / a.length).toFixed(1);
  // the tree multiplier sums the picks, it does not average them (6 x 14.2% = x1.85)
  const mul = (picks: any) => (1 + picks.reduce((s: any, k: any) => s + k.value, 0) / 100).toFixed(2);
  const sum = (picks: any) => (picks.reduce((s: any, k: any) => s + k.value, 0)).toFixed(1);
  const best = legalPicks([...K].sort((a: any, b: any) => b.value - a.value)).slice(0, 6);
  const worst = legalPicks([...K].sort((a: any, b: any) => a.value - b.value)).slice(0, 6);
  return {
    origMean: mean(orig), freshMean: mean(fresh), poolMean: mean(K),
    bestVals: best.map((k: any) => k.value), bestSum: sum(best), bestMul: mul(best),
    worstVals: worst.map((k: any) => k.value), worstSum: sum(worst), worstMul: mul(worst),
    pairs: new Set(K.map((k: any) => k.pair)).size,
  };
}

function keystoneOriginalBlock() {
  return [
    '| Original | Branch | Measured value (%) | Notes |',
    '|---|---|---|---|',
    ...TREE.keystones.filter((k: any) => k.origin === 'original').map((k: any) => {
      const label = k.rule ? `${k.name} (${k.rule})` : k.name;
      const v = k.value === 0 ? '0% DPS' : (k.value % 1 ? `+${k.value}%` : `+${k.value}%`);
      return `| ${label} | ${BRANCH_LABEL[k.branch]} | ${k.value >= 20 ? `**${v}**` : v} | ${k.note || ''} |`;
    }),
  ].join('\n');
}

function keystoneNewBlock() {
  const B = keystoneBudget();
  return [
    '| Keystone | Branch | Rule | Calculated value | Conflicting pair |',
    '|---|---|---|---|---|',
    ...TREE.keystones.filter((k: any) => k.origin !== 'original').map((k: any) => {
      const v = k.value === 0 ? '**0% DPS**' : `**+${k.value}%**`;
      const extra = k.pair_note ? ` · ${k.pair_note}` : '';
      return `| ${k.name} | ${BRANCH_LABEL[k.branch]} | ${k.rule} | ${v} · ${k.calc}${extra} | ${k.pair} |`;
    }),
    '',
    `**Pool accounting check** — ${TREE.keystones.length} units = ${TREE.keystones.filter((k: any) => k.origin === 'original').length} original (mean ${B.origMean}%) + ${TREE.keystones.filter((k: any) => k.origin !== 'original').length} new (mean ${B.freshMean}%) → **whole-pool mean ${B.poolMean}%**`,
    `- The multiplier **sums** the picks, so a typical path of 6 at 14.2% is ×1.85 — that is the \`mob_HP\` baseline`,
    `- Best *legal* picks = ${B.bestVals.join('/')} → sum **${B.bestSum}%** → tree **×${B.bestMul}** (the ceiling \`mob_HP\` does not cover)`,
    `- Worst *legal* picks = ${B.worstVals.join('/')} → sum **${B.worstSum}%** → tree **×${B.worstMul}**`,
    `- **${B.pairs} exclusive pairs**, one pick each (T2) — this is what controls the band width`,
  ].join('\n');
}

function keystonePairBlock() {
  return [
    '| Pair | Why they truly cut each other (not paired by branch) |',
    '|---|---|',
    ...TREE.keystones.filter((k: any) => k.pair_reason).map((k: any) => `| ${k.name} ↔ ${k.pair} | ${k.pair_reason} |`),
  ].join('\n');
}

// ---------------------------------------------------------------- writers

const WRITERS: Writer[] = [
  { file: 'skill-tree.md', key: 'tree-summary', render: () => summaryBlock(analyze()) },
  { file: 'skill-tree.md', key: 'tree-layout', render: () => layoutBlock(analyze()) },
  { file: 'skill-tree-keystone.md', key: 'keystone-original', render: keystoneOriginalBlock },
  { file: 'skill-tree-keystone.md', key: 'keystone-new', render: keystoneNewBlock },
  { file: 'skill-tree-keystone.md', key: 'keystone-pairs', render: keystonePairBlock },
];

// ---------------------------------------------------------------- cli

const arg = process.argv[2];
const branches = analyze();

if (arg === '--emit') {
  for (const w of WRITERS) console.log(`\n===== ${w.file} :: ${w.key} =====\n${w.render()}`);
} else if (arg === '--write') {
  let renamed = 0;
  for (const b of TREE.branches) renamed += applyRenames(b.file);
  if (renamed) console.log(`updated ${renamed} "Enables" cell(s) from skills.json renames`);
  const missing = G.writeAll(WRITERS);
  if (missing) process.exitCode = 1;
} else if (arg === '--checks') {
  const rows = gates(branches);
  for (const r of rows) console.log(`${r.id.padEnd(3)}  ${(r.status || (r.ok ? 'PASS' : 'FAIL')).padEnd(7)}  ${r.detail}`);

  const states = G.checkAll(WRITERS);
  const stale = states.filter((s: any) => s.state !== 'current');
  console.log('');
  for (const s of states) console.log(`${s.state === 'current' ? 'PASS ' : 'FAIL '}  block ${s.key} · ${s.file} (${s.state})`);

  const gateFails = rows.filter((r: any) => !r.ok).length;
  const fails = gateFails + stale.length;
  const passed = rows.filter((r: any) => r.ok).length;
  console.log(`\n${passed}/${rows.length} gate PASS · ${stale.length} block(s) not current · ${fails} FAIL`);
  if (fails) process.exitCode = 1;
} else {
  console.log(`tree cage — data: tools/data/tree.json + the node tables in skill-tree-*.md

  node tools/tree.ts --emit     print the generated summary block
  node tools/tree.ts --write    rewrite the summary in skill-tree.md
  node tools/tree.ts --checks   validate node counts + every "Enables" reference (D19)
`);
}
