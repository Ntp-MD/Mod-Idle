'use strict';

/**
 * Doc linter — the referential-integrity guard for the whole design layer.
 *
 *   node tools/lint.js            run every check, exit 1 on FAIL
 *
 * This is the cage the numbers cages do not cover: it reads the markdown as a
 * graph and fails when a wire is cut.
 *
 *   L1  every `import X.md` resolves to a real file
 *   L2  every `file.md` reference in prose resolves to a real file
 *   L3  every `file.md:line` citation is inside that file (PENDING when the line drifted)
 *   L4  no deprecated term outside its allow-list (aliases.json)
 *   L5  every "N <type> skills" heading matches skills.json
 *   L6  every generated block has a balanced BEGIN/END marker pair
 */

const fs = require('fs');
const path = require('path');
const G = require('./lib/generated');
const R = require('./lib/roster');
const ALIASES = JSON.parse(G.read('tools/data/aliases.json'));

const RESERVED_NONFILES = new Set(['skill.md', 'skills.md', 'SKILL.md']); // AGENT.md forbids creating these

const DOCS = fs.readdirSync(G.ROOT).filter((f) => f.endsWith('.md')).sort();
const TEXT = {};
for (const f of DOCS) TEXT[f] = fs.readFileSync(path.join(G.ROOT, f), 'utf8');
const lineCount = (f) => TEXT[f].split(/\r?\n/).length;

const out = [];
const add = (id, ok, detail, status) => out.push({ id, ok, detail, status });

// ---------------------------------------------------------------- L1 imports

{
  const missing = [];
  for (const f of DOCS) {
    for (const line of TEXT[f].split(/\r?\n/)) {
      const m = line.match(/^import\s+(.+?)\s*$/);
      if (m && !TEXT[m[1]]) missing.push(`${f} → ${m[1]}`);
    }
  }
  add('L1', missing.length === 0, `every import resolves to a real file${missing.length ? ' · MISSING: ' + missing.join(' · ') : ''}`);
}

// ---------------------------------------------------------------- L2 / L3 md refs

{
  const refRe = /`([A-Za-z0-9-]+\.md)(?::(\d+))?`/g;
  const missing = new Set();
  const drifted = [];
  for (const f of DOCS) {
    let m;
    while ((m = refRe.exec(TEXT[f]))) {
      const target = m[1];
      if (RESERVED_NONFILES.has(target)) continue;
      if (!TEXT[target]) { missing.add(`${f} → ${target}`); continue; }
      if (m[2]) {
        const n = Number(m[2]);
        if (n > lineCount(target)) drifted.push(`${f} → ${target}:${n} (file has ${lineCount(target)})`);
      }
    }
  }
  add('L2', missing.size === 0, `every \`file.md\` reference resolves${missing.size ? ' · MISSING: ' + [...missing].slice(0, 12).join(' · ') : ''}`);
  if (drifted.length) add('L3', true, `${drifted.length} \`file.md:line\` citation(s) point past the end of the file (line drift, not a broken wire) · ` + drifted.slice(0, 8).join(' · ') + (drifted.length > 8 ? ' …' : ''), 'PENDING');
  else add('L3', true, 'every `file.md:line` citation is inside its file');
}

// ---------------------------------------------------------------- L4 deprecated terms

{
  const hits = [];
  for (const t of ALIASES.terms) {
    const allow = new Set(t.allow_in || []);
    const re = new RegExp(`\\b${t.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    for (const f of DOCS) {
      if (allow.has(f)) continue;
      TEXT[f].split(/\r?\n/).forEach((line, i) => {
        if (re.test(line)) hits.push(`${f}:${i + 1} "${t.old}" → use "${t.new}"`);
      });
    }
  }
  add('L4', hits.length === 0, `no deprecated term outside its allow-list (${ALIASES.terms.length} tracked)${hits.length ? ' · ' + hits.slice(0, 12).join(' · ') : ''}`);
}

// ---------------------------------------------------------------- L5 heading counts

{
  const checks = [
    ['skill-pool.md', /^#\s+Skill count = (\d+)\s*$/m, R.total(), 'total'],
    ['skill-pool-attack.md', /^#\s+(\d+)\s+attack skills\s*$/m, R.count('attack'), 'attack'],
    ['skill-pool-curse.md', /^#\s+(\d+)\s+curse skills\s*$/m, R.count('curse'), 'curse'],
    ['skill-pool-aura-heal.md', /^#\s+(\d+)\s+healing skills\s*$/m, R.count('heal'), 'heal'],
    ['skill-pool-aura-heal.md', /^#\s+(\d+)\s+aura skills\s*$/m, R.count('aura'), 'aura'],
  ];
  const bad = [];
  for (const [file, re, want, label] of checks) {
    const m = TEXT[file].match(re);
    if (!m) { bad.push(`${file}: heading for ${label} not found`); continue; }
    if (Number(m[1]) !== want) bad.push(`${file}: heading says ${m[1]} ${label}, roster has ${want}`);
  }
  add('L5', bad.length === 0, `every skill-count heading matches skills.json${bad.length ? ' · ' + bad.join(' · ') : ''}`);
}

// ---------------------------------------------------------------- L6 marker balance

{
  const bad = [];
  for (const f of DOCS) {
    const b = (TEXT[f].match(/^\s*<!-- BEGIN GENERATED:/gm) || []).length;
    const e = (TEXT[f].match(/^\s*<!-- END GENERATED:/gm) || []).length;
    if (b !== e) bad.push(`${f} (${b} BEGIN / ${e} END)`);
  }
  add('L6', bad.length === 0, `every generated block has a balanced marker pair${bad.length ? ' · ' + bad.join(' · ') : ''}`);
}

// ---------------------------------------------------------------- L7 value drift

{
  // The roster docs are the projection of skills.json. Outside the generated
  // markers a line may explain *why* a value sits where it does, but it must not
  // quote a signed percentage that the named skill's data does not contain —
  // that is a copy which can silently drift (the bug this guard exists for).
  const rosterDocs = DOCS.filter((f) => f !== 'decisions.md'); // the log quotes values as they were at decision time
  // a sign counts only when it is not the hyphen inside a range like "20-30%"
  const signedPct = (s) => (String(s || '').replace(/[−–—]/g, '-').replace(/\s+/g, ' ').match(/(?<![\d])[+\-]\s?\d+(?:\.\d+)?\s?%/g) || [])
    .map((t) => t.replace(/\s+/g, ''));
  const facts = new Map(R.SKILLS.map((s) => [s.name, new Set(signedPct(s.effect))]));
  const names = R.SKILLS.map((s) => s.name).sort((a, b) => b.length - a.length);
  const nameRe = new Map(names.map((n) => [n, new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b')]));
  const hits = [];
  for (const f of rosterDocs) {
    const lines = TEXT[f].split(/\r?\n/);
    let inBlock = false;
    lines.forEach((l, i) => {
      if (/^\s*<!-- BEGIN GENERATED:/.test(l)) { inBlock = true; return; }
      if (/^\s*<!-- END GENERATED:/.test(l)) { inBlock = false; return; }
      if (inBlock || /lint:allow/.test(l)) return;
      const named = names.filter((n) => nameRe.get(n).test(l));
      if (!named.length) return;
      const union = new Set();
      for (const n of named) for (const t of facts.get(n)) union.add(t);
      const bad = [...new Set(signedPct(l).filter((t) => !union.has(t)))];
      if (bad.length) hits.push(`${f}:${i + 1} names ${named.join(' / ')} but quotes ${bad.join(', ')}`);
    });
  }
  add('L7', hits.length === 0, `roster docs do not restate a generated skill/aura value outside markers${hits.length ? ' · ' + hits.slice(0, 10).join(' · ') + (hits.length > 10 ? ' …' : '') : ''}`);
}

// ---------------------------------------------------------------- cli

for (const r of out) console.log(`${r.id.padEnd(3)}  ${(r.status || (r.ok ? 'PASS' : 'FAIL')).padEnd(7)}  ${r.detail}`);
const fails = out.filter((r) => !r.ok).length;
console.log(`\n${out.length - fails}/${out.length} lint PASS · ${fails} FAIL`);
if (fails) process.exitCode = 1;
