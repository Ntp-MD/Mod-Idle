'use strict';

/**
 * Tree cage — the wiring between the skill tree and the skill roster.
 *
 *   node tools/tree.js            help
 *   node tools/tree.js --emit     print the generated summary block
 *   node tools/tree.js --write    apply skills.json `renames` to the node "Enables"
 *                                 cells, then rewrite the summary in skill-tree.md
 *   node tools/tree.js --checks   parse the node tables, validate every "Enables"
 *                                 cell against skills.json + tree.json, fail on a
 *                                 stale summary (checks.md D19)
 *
 * The 122 minor nodes are prose tables in skill-tree-*.md; this tool does not own
 * their text, it owns the *links*. To rename a skill: change its name in
 * skills.json, add `old: new` to skills.json `renames`, then `--write` — the node
 * cells update themselves, so the md is never hand-edited for a rename.
 */

const path = require('path');
const R = require('./lib/roster');
const G = require('./lib/generated');
const TREE = JSON.parse(G.read('tools/data/tree.json'));

const KEYSTONE_NAMES = new Set(TREE.keystones.map((k) => k.name));
const SKILL_NAMES = new Set(R.allNames());
const KNOWN = new Set([...SKILL_NAMES, ...KEYSTONE_NAMES]);
const PENDING_REFS = new Set(TREE.pending_refs || []);
const RENAMES = R.RENAMES || {};
const RENAME_KEYS = Object.keys(RENAMES);

// ---------------------------------------------------------------- parser

const BRANCH_RE = /^###\s+(.+?)\s+branch\s+—\s+(\d+)\s+minor in\s+(\d+)\s+limbs/;
const LIMB_RE = /^\*\*(.+?)\s+limb\*\*\s+\((\d+)\s+nodes/;

function parseBranch(file) {
  const lines = G.read(file).split(/\r?\n/);
  const out = { file, branchName: null, minorsDeclared: null, limbsDeclared: null, limbs: [], nodes: [] };
  let limb = null;
  for (const line of lines) {
    let m = line.match(BRANCH_RE);
    if (m) { out.branchName = m[1]; out.minorsDeclared = Number(m[2]); out.limbsDeclared = Number(m[3]); continue; }
    m = line.match(LIMB_RE);
    if (m) { limb = { name: m[1], declared: Number(m[2]), parsed: 0 }; out.limbs.push(limb); continue; }
    if (!/^\|/.test(line)) continue;
    const cells = line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    if (cells.length < 4 || !/^\d+$/.test(cells[0])) continue; // header / separator
    const node = { tier: Number(cells[0]), name: cells[1], rule: cells[2], enables: cells[3], limb: limb ? limb.name : null, file };
    out.nodes.push(node);
    if (limb) limb.parsed++;
  }
  return out;
}

function cleanRef(cell) {
  return String(cell).replace(/\*\*/g, '').trim();
}

function isIntentionalEmpty(cell) {
  const c = cleanRef(cell);
  return c === '' || /^[—–-]/.test(c);
}

function resolveRef(cell) {
  const c = cleanRef(cell);
  if (isIntentionalEmpty(cell)) return { ok: true, empty: true, names: [], bad: [], renamed: [] };
  const parts = c.split(/\s*[·/]\s*/).map((x) => x.trim()).filter(Boolean);
  const bad = [];
  const renamed = [];
  for (const p of parts) {
    if (KNOWN.has(p)) continue;
    if (RENAMES[p]) { renamed.push({ from: p, to: RENAMES[p] }); continue; }
    bad.push(p);
  }
  return { ok: bad.length === 0 && renamed.length === 0, empty: false, names: parts, bad, renamed };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Rewrite any node "Enables" cell that names a skill recorded in skills.json `renames`. */
function applyRenames(file) {
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
  const branches = TREE.branches.map((b) => {
    const parsed = parseBranch(b.file);
    const dangling = [];
    const renamed = [];
    for (const n of parsed.nodes) {
      const r = resolveRef(n.enables);
      if (r.bad.length) dangling.push({ node: n.name, ref: n.enables, bad: r.bad });
      if (r.renamed.length) renamed.push({ node: n.name, from: r.renamed.map((x) => x.from).join('/'), to: r.renamed.map((x) => x.to).join('/') });
    }
    return { ...b, parsed, dangling, renamed };
  });
  return branches;
}

function gates(branches) {
  const out = [];
  const add = (id, ok, detail) => out.push({ id, ok, detail });

  const ids = TREE.keystones.map((k) => k.id);
  add('T1', ids.length === new Set(ids).size, `unique keystone ids (${ids.length} keystones)`);

  const names = new Set(TREE.keystones.map((k) => k.name));
  const badPair = TREE.keystones.filter((k) => !names.has(k.pair)).map((k) => k.name);
  add('T2', badPair.length === 0, `every keystone pair names a real keystone${badPair.length ? ' · BAD: ' + badPair.join(', ') : ''}`);

  const branchIds = new Set(TREE.branches.map((b) => b.id));
  const badBranch = TREE.keystones.filter((k) => !branchIds.has(k.branch)).map((k) => k.name);
  add('T3', badBranch.length === 0, `every keystone names a real branch${badBranch.length ? ' · BAD: ' + badBranch.join(', ') : ''}`);

  const mismatched = [];
  for (const b of branches) {
    if (b.parsed.nodes.length !== b.minors) mismatched.push(`${b.name} minors ${b.parsed.nodes.length}≠${b.minors}`);
    if (b.parsed.limbs.length !== b.limbs) mismatched.push(`${b.name} limbs ${b.parsed.limbs.length}≠${b.limbs}`);
    for (const l of b.parsed.limbs) if (l.parsed !== l.declared) mismatched.push(`${b.name}/${l.name} ${l.parsed}≠${l.declared}`);
  }
  add('T4', mismatched.length === 0, `parsed node/limb counts match every declared header${mismatched.length ? ' · ' + mismatched.join(' · ') : ''}`);

  const dangling = branches.flatMap((b) => b.dangling.map((d) => ({ branch: b.name, node: d.node, ref: d.ref, bad: d.bad })));
  const renamed = branches.flatMap((b) => b.renamed.map((d) => ({ branch: b.name, ...d })));
  const unexpected = dangling.filter((d) => d.bad.some((n) => !PENDING_REFS.has(n)));
  const pending = dangling.length - unexpected.length;
  if (unexpected.length) {
    add('T5', false, `"Enables" cell(s) point at unknown skills · ${unexpected.length} UNEXPECTED: ` + unexpected.slice(0, 12).map((d) => `${d.branch}/${d.node}→${d.ref}`).join(' · ') + (unexpected.length > 12 ? ' …' : ''));
  } else if (renamed.length) {
    out.push({ id: 'T5', ok: true, status: 'PENDING', detail: `${renamed.length} "Enables" cell(s) use a renamed skill (recorded in skills.json renames) — run \`node tools/tree.js --write\` to update them: ` + renamed.slice(0, 8).map((d) => `${d.branch}/${d.node} ${d.from}→${d.to}`).join(' · ') });
  } else if (pending) {
    out.push({ id: 'T5', ok: true, status: 'PENDING', detail: `${pending} "Enables" cell(s) point at the cleared buff set (waived in tree.json pending_refs, tracked by D19) — no unexpected dangling reference` });
  } else {
    add('T5', true, 'every "Enables" cell resolves to a real skill or keystone');
  }

  return out;
}

// ---------------------------------------------------------------- summary block

function summaryBlock(branches) {
  const rows = branches.map((b) => {
    const keys = TREE.keystones.filter((k) => k.branch === b.id).length;
    return `| ${b.name} | \`${b.file}\` | ${b.minors} | ${b.parsed.nodes.length} | ${b.parsed.limbs.length} | ${keys} | ${b.dangling.length} |`;
  });
  const tot = {
    minors: branches.reduce((s, b) => s + b.minors, 0),
    parsed: branches.reduce((s, b) => s + b.parsed.nodes.length, 0),
    limbs: branches.reduce((s, b) => s + b.parsed.limbs.length, 0),
    keys: TREE.keystones.length,
    dangling: branches.reduce((s, b) => s + b.dangling.length, 0),
  };
  const dangling = branches.flatMap((b) => b.dangling.map((d) => `${b.name} · ${d.node} → ${cleanRef(d.ref)}`));
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

// ---------------------------------------------------------------- writers

const WRITERS = [
  { file: 'skill-tree.md', key: 'tree-summary', render: () => summaryBlock(analyze()) },
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
  const stale = states.filter((s) => s.state !== 'current');
  console.log('');
  for (const s of states) console.log(`${s.state === 'current' ? 'PASS ' : 'FAIL '}  block ${s.key} · ${s.file} (${s.state})`);

  const gateFails = rows.filter((r) => !r.ok).length;
  const fails = gateFails + stale.length;
  const passed = rows.filter((r) => r.ok).length;
  console.log(`\n${passed}/${rows.length} gate PASS · ${stale.length} block(s) not current · ${fails} FAIL`);
  if (fails) process.exitCode = 1;
} else {
  console.log(`tree cage — data: tools/data/tree.json + the node tables in skill-tree-*.md

  node tools/tree.js --emit     print the generated summary block
  node tools/tree.js --write    rewrite the summary in skill-tree.md
  node tools/tree.js --checks   validate node counts + every "Enables" reference (D19)
`);
}
