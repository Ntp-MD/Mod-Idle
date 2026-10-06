/**
 * Doc linter — the referential-integrity guard for the whole design layer.
 *
 *   node tools/lint.ts            run every check, exit 1 on FAIL
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
 *   L7  a roster doc does not restate a generated skill/aura value outside markers
 *   L8  the glossary abbreviation set is closed and 1:1, and every entry is used
 */

import fs from 'node:fs';
import path from 'node:path';
import * as G from './lib/generated.ts';
import * as R from './lib/roster.ts';
const ALIASES = JSON.parse(G.read('tools/data/aliases.json'));

const RESERVED_NONFILES = new Set(['skill.md', 'skills.md', 'SKILL.md']); // AGENT.md forbids creating these

// Docs live at the root and under `harness/`, which holds the agent ops and the open-work
// queue. Keys are the path from the repo root so a doc can be named as `harness/todo.md`.
const DOCS = G.listDocs();
const TEXT: Record<string, string> = {};
for (const f of DOCS) TEXT[f] = fs.readFileSync(path.join(G.ROOT, G.resolveDoc(f)), 'utf8');
const lineCount = (f: string) => TEXT[f].split(/\r?\n/).length;

const out: any[] = [];
const add = (id: any, ok: any, detail: any, status?: any) => out.push({ id, ok, detail, status });

// ---------------------------------------------------------------- L1 imports

{
  const missing: any[] = [];
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
  // an optional folder prefix, because the agent ops and the open-work queue live under `harness/`
  const refRe = /`(harness\/(?:handoff\/|state\/)?)?([A-Za-z0-9-]+\.md)(?::(\d+))?`/g;
  const missing = new Set<string>();
  const drifted: any[] = [];
  for (const f of DOCS) {
    let m: any;
    while ((m = refRe.exec(TEXT[f]))) {
      const target = (m[1] || '') + m[2];
      if (RESERVED_NONFILES.has(target)) continue;
      // `in`, not a truthiness test: an empty doc is still a real file, and reading one as
      // "missing" would make every reference to it look like a broken wire
      if (!(target in TEXT)) { missing.add(`${f} → ${target}`); continue; }
      if (m[3]) {
        const n = Number(m[3]);
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
  const hits: any[] = [];
  for (const t of ALIASES.terms) {
    const allow = new Set(t.allow_in || []);
    // a trailing `%` is not a word character, so the closing \b would never match; only
    // require it when the retired spelling ends on one
    const tail = /[\w]$/.test(t.old) ? '\\b' : '';
    // `not_prefix` keeps a banned spelling out of a *live* compound term: `Perfect dodge %`
    // and `mob dodge` are current vocabulary, while the retired player Mod is `Dodge %`
    const guard = (t.not_prefix || []).map((p: any) => `(?<!${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} )`).join('');
    const re = new RegExp(`${guard}\\b${t.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${tail}`, 'i');
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
  const checks: any[] = [
    ['skill-pool.md', /^#\s+Skill count = (\d+)\s*$/m, R.total(), 'total'],
    ['skill-pool-attack.md', /^#\s+(\d+)\s+attack skills\s*$/m, R.count('attack'), 'attack'],
    ['skill-pool-curse.md', /^#\s+(\d+)\s+curse skills\s*$/m, R.count('curse'), 'curse'],
    ['skill-pool-aura-heal.md', /^#\s+(\d+)\s+healing skills\s*$/m, R.count('heal'), 'heal'],
    ['skill-pool-aura-heal.md', /^#\s+(\d+)\s+aura skills\s*$/m, R.count('aura'), 'aura'],
  ];
  const bad: any[] = [];
  for (const [file, re, want, label] of checks) {
    const m = TEXT[file].match(re);
    if (!m) { bad.push(`${file}: heading for ${label} not found`); continue; }
    if (Number(m[1]) !== want) bad.push(`${file}: heading says ${m[1]} ${label}, roster has ${want}`);
  }
  add('L5', bad.length === 0, `every skill-count heading matches skills.json${bad.length ? ' · ' + bad.join(' · ') : ''}`);
}

// ---------------------------------------------------------------- L6 marker balance

{
  const bad: any[] = [];
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
  // a sign counts only when it is not the hyphen inside a range like "20-30%"
  const signedPct = (s: any) => (String(s || '').replace(/[−–—]/g, '-').replace(/\s+/g, ' ').match(/(?<![\d])[+\-]\s?\d+(?:\.\d+)?\s?%/g) || [])
    .map((t) => t.replace(/\s+/g, ''));
  const facts = new Map(R.SKILLS.map((s: any) => [s.name, new Set(signedPct(s.effect))]));
  const names = R.SKILLS.map((s: any) => s.name).sort((a: any, b: any) => b.length - a.length);
  const nameRe = new Map(names.map((n: any) => [n, new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b')]));
  const hits: any[] = [];
  for (const f of DOCS) {
    const lines = TEXT[f].split(/\r?\n/);
    let inBlock = false;
    lines.forEach((l, i) => {
      if (/^\s*<!-- BEGIN GENERATED:/.test(l)) { inBlock = true; return; }
      if (/^\s*<!-- END GENERATED:/.test(l)) { inBlock = false; return; }
      if (inBlock || /lint:allow/.test(l)) return;
      const named = names.filter((n: any) => nameRe.get(n)!.test(l));
      if (!named.length) return;
      const union = new Set();
      for (const n of named) for (const t of facts.get(n)!) union.add(t);
      const bad = [...new Set(signedPct(l).filter((t: any) => !union.has(t)))];
      if (bad.length) hits.push(`${f}:${i + 1} names ${named.join(' / ')} but quotes ${bad.join(', ')}`);
    });
  }
  add('L7', hits.length === 0, `roster docs do not restate a generated skill/aura value outside markers${hits.length ? ' · ' + hits.slice(0, 10).join(' · ') + (hits.length > 10 ? ' …' : '') : ''}`);
}

// ---------------------------------------------------------------- L8 abbreviation set

{
  // glossary.md owns the closed set. L8 enforces the properties of a *closed* set:
  // one abbreviation per term, one term per abbreviation, and every abbreviation is
  // actually used somewhere (a doc or a tool) — an unused row is a dead rule that will
  // drift. A rejected spelling belongs in aliases.json, guarded by L4.
  const esc = (s: any) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const section = (TEXT['glossary.md'] || '').split(/^#\s+Abbreviations\s*$/m)[1] || '';
  const body = section.split(/^#\s+/m)[0];
  const rows = body.split(/\r?\n/)
    .filter((l) => /^\|/.test(l) && !/^\|\s*-{2,}/.test(l) && !/^\|\s*Term\s*\|/i.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.replace(/[*`]/g, '').trim()))
    .filter((c) => c[0] && c[1]);

  const strip = (s: any) => String(s).replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '');
  const pairs = rows.map((c) => ({ term: c[0], abbrev: strip(c[1]).trim() })).filter((r) => r.abbrev);
  const bad: any[] = [];

  const byAbbrev = new Map(), byTerm = new Map();
  for (const r of pairs) {
    const ka = r.abbrev.toLowerCase(), kt = r.term.toLowerCase();
    if (byAbbrev.has(ka)) bad.push(`${r.abbrev} maps both "${byAbbrev.get(ka)}" and "${r.term}"`);
    else byAbbrev.set(ka, r.term);
    if (byTerm.has(kt) && byTerm.get(kt) !== r.abbrev) bad.push(`${r.term} maps both ${byTerm.get(kt)} and ${r.abbrev}`);
    else byTerm.set(kt, r.abbrev);
  }

  // a tool file is any .js/.ts under tools/, so a code-only abbreviation (mp · ev) still counts
  const toolFiles: string[] = [];
  (function walk(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (/\.(js|ts)$/.test(e.name)) toolFiles.push(fs.readFileSync(path.join(d, e.name), 'utf8'));
    }
  })(path.join(G.ROOT, 'tools'));
  const toolText = toolFiles.join('\n');
  const docsMinusGlossary = DOCS.filter((f) => f !== 'glossary.md');

  for (const r of pairs) {
    const re = new RegExp('\\b' + esc(r.abbrev) + '\\b');
    const usedDoc = docsMinusGlossary.some((f) => re.test(TEXT[f]));
    const usedTool = re.test(toolText);
    if (!usedDoc && !usedTool) bad.push(`${r.abbrev} ("${r.term}") is listed but used nowhere — an unused abbreviation is a dead rule`);
  }

  add('L8', bad.length === 0, `the abbreviation set is closed and 1:1 (${pairs.length} rows)${bad.length ? ' · ' + bad.join(' · ') : ''}`);
}

// ---------------------------------------------------------------- cli

for (const r of out) console.log(`${r.id.padEnd(3)}  ${(r.status || (r.ok ? 'PASS' : 'FAIL')).padEnd(7)}  ${r.detail}`);
const fails = out.filter((r) => !r.ok).length;
console.log(`\n${out.length - fails}/${out.length} lint PASS · ${fails} FAIL`);
if (fails) process.exitCode = 1;
