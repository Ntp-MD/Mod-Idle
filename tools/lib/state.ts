/**
 * Wiki state — everything the pages read, loaded fresh from disk.
 *
 * The dashboard is a snapshot; this is a live view. Every getter re-checks file
 * mtimes, so an edit to a .md spec or a tools/data/*.json record shows up on the
 * next page render without a rebuild, and the cage results are only re-run when
 * something they read has actually changed.
 */

import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import * as md from './md.ts';
import * as reg from './registry.ts';
import { keyNumbers } from './numbers.ts';
import { listDocs, resolveDoc } from './generated.ts';
import { build } from './engine.ts';

// Cages are spawned as child node processes and load engine/*.ts; the flag has to be in
// the child env. execFileSync inherits process.env, so setting it here covers runNode.
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--experimental-strip-types', '--disable-warning=ExperimentalWarning'].filter(Boolean).join(' ');

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DATA_FILES: Record<string, string> = {
  engine: 'tools/data/engine.json',
  town: 'tools/data/town.json',
  skills: 'tools/data/skills.json',
  tree: 'tools/data/tree.json',
};
const CAGES = [
  { script: 'tools/check.ts', owns: 'engine.json → checks.md groups A · B · C · F', label: 'engine cage' },
  { script: 'tools/town.ts', owns: 'engine.json + town.json → towns-stalls.md + checks.md group T', label: 'town cage' },
  { script: 'tools/skills.ts', owns: 'skills.json → skill-pool*.md roster tables + counts', label: 'skills cage' },
  { script: 'tools/tree.ts', owns: 'tree.json + node tables → skill-tree.md summary + D19 refs', label: 'tree cage' },
  { script: 'tools/ladder.ts', owns: 'roster × drop rate → D20/E11 duplicate economy', label: 'ladder cage' },
  { script: 'tools/timeline.ts', owns: 'engine.json xp → world.md 5-level-step table', label: 'timeline cage' },
  { script: 'tools/lint.ts', owns: 'cross-file references · counts · deprecated terms', label: 'doc lint' },
];

const CATEGORIES: [string, string[]][] = [
  ['Start here', ['AGENT.md', 'harness/todo.md', 'concept.md', 'glossary.md', 'Techstack.md', 'harness/decisions.md', 'tasks.md']],
  ['Character & stats', ['core-stats.md', 'character-sheet.md', 'formula.md', 'formula-offense.md', 'formula-defense.md', 'formula-utility.md', 'elements.md']],
  ['Items & mods', ['mod-pool.md', 'item-base.md', 'item-rarity.md', 'item-list.md', 'equipment-slot.md', 'equipment-slot-armor.md', 'equipment-slot-pools.md', 'equipment-slot-weapon.md', 'equipment-weapon.md']],
  ['Skills', ['skill-pool.md', 'skill-pool-attack.md', 'skill-pool-buff.md', 'skill-pool-curse.md', 'skill-pool-aura-heal.md', 'skill-pool-system.md', 'skill-tree.md', 'skill-tree-impact.md', 'skill-tree-stream.md', 'skill-tree-control.md', 'skill-tree-keystone.md']],
  ['Combat & loot', ['combat.md', 'loot.md', 'crafting.md', 'farm.md']],
  ['World & towns', ['world.md', 'mob-roster.md', 'towns.md', 'towns-stalls.md', 'towns-ui.md']],
  ['Economy & persistence', ['economy.md', 'save.md']],
  ['Verification', ['checks.md']],
];

const categoryOf = (file: string) => (CATEGORIES.find(([, list]) => list.includes(file)) || ['Unsorted', []])[0];

// ------------------------------------------------------------------ disk reads

function stat(key: string): string {
  try {
    const s = fs.statSync(path.join(ROOT, DATA_FILES[key] || key));
    return `${s.mtimeMs}:${s.size}`;
  } catch (e) {
    return 'missing';
  }
}

function docFiles(): string[] {
  return listDocs();
}

function fingerprint(): string {
  const parts = docFiles().map((f) => `md:${f}:${stat(f)}`);
  parts.push(`lib:${stat('tools/lib/engine.ts')}`, `libmd:${stat('tools/lib/md.ts')}`);
  for (const k of Object.keys(DATA_FILES)) parts.push(`data:${k}:${stat(k)}`);
  return parts.join('|');
}

function freshEngine(): any {
  return build();
}

// ------------------------------------------------------------------ cages

let cageCache: { fp: string; value: any } = { fp: '', value: null };

function runNode(script: string, args: string[]): any {
  try {
    const out = cp.execFileSync('node', [script, ...args], { cwd: ROOT, encoding: 'utf8' });
    return { ok: true, code: 0, out };
  } catch (e) {
    return { ok: false, code: e.status == null ? -1 : e.status, out: `${(e.stdout || '') + (e.stderr || '')}` };
  }
}

function parseRows(text: string): any {
  const rows = [];
  const notes = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9-]+)\s{2,}(PASS|FAIL|PENDING)\s{2,}(.+)$/);
    if (m) { rows.push({ id: m[1], status: m[2], detail: m[3] }); continue; }
    if (/^(doc blocks|template leaks|DOC BLOCKS|.*PASS · )/i.test(line.trim())) notes.push(line.trim());
  }
  return { rows, notes };
}

function cages(force?: boolean): any {
  const fp = fingerprint();
  if (!force && cageCache.fp === fp && cageCache.value) return cageCache.value;
  const value: any = {
    fingerprint: fp,
    stamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z',
    list: CAGES.map((c) => {
      const res = runNode(c.script, ['--checks']);
      const { rows, notes } = parseRows(res.out);
      const counts: Record<string, number> = { PASS: 0, FAIL: 0, PENDING: 0 };
      for (const r of rows) counts[r.status]++;
      return {
        ...c, ok: res.ok, code: res.code, rows, notes, counts,
        summary: String(res.out).split(/\r?\n/).filter((l) => /PASS\b.*FAIL\b/.test(l)).join(' '),
        raw: res.out,
      };
    }),
  };
  value.allOk = value.list.every((c: any) => c.ok);
  value.rows = value.list.flatMap((c: any) => c.rows.map((r: any) => ({ cage: c.label, ...r })));
  value.totals = value.list.reduce((a: any, c: any) => ({
    PASS: a.PASS + c.counts.PASS, FAIL: a.FAIL + c.counts.FAIL, PENDING: a.PENDING + c.counts.PENDING,
  }), { PASS: 0, FAIL: 0, PENDING: 0 });
  cageCache = { fp, value };
  return value;
}

// ------------------------------------------------------------------ model

function docMeta(docText: any): any[] {
  const files = Object.keys(docText);
  const importedBy: Record<string, Set<string>> = {};
  for (const f of files) for (const t of (docText[f].match(/^import\s+.*$/gm) || [])) {
    const name = t.replace(/^import\s+/, '').trim();
    if (docText[name] != null) (importedBy[name] = importedBy[name] || new Set()).add(f);
  }
  const map = (name: string) => (files.includes(name) ? `d-${name.replace(/\.md$/, '')}.html` : null);
  return files.map((file) => {
    const text = docText[file];
    const lines = text.split(/\r?\n/);
    const blocks = md.extractBlocks(text);
    const toc = md.headings(text, { shift: 1, idPrefix: 'h-' });
    return {
      file,
      page: file.replace(/\.md$/, ''),
      title: md.titleOf(text, file),
      category: categoryOf(file),
      lines: lines.length,
      words: (text.match(/[A-Za-zÀ-ɏ0-9'’-]+/g) || []).length,
      bytes: text.length,
      imports: md.importsOf(text),
      importedBy: [...(importedBy[file] || [])],
      blocks,
      toc,
      mtime: fs.statSync(path.join(ROOT, resolveDoc(file))).mtime.toISOString().slice(0, 19) + 'Z',
      href: map(file),
    };
  });
}

const BLOCK_OWNER: Record<string, string> = {
  'group-A': 'tools/check.ts', 'group-B': 'tools/check.ts', 'group-C': 'tools/check.ts', 'group-F': 'tools/check.ts', 'group-T': 'tools/town.ts',
  'skill-count': 'tools/skills.ts', 'attack-roster': 'tools/skills.ts', 'curse-roster': 'tools/skills.ts', 'buff-roster': 'tools/skills.ts', 'heal-roster': 'tools/skills.ts', 'aura-roster': 'tools/skills.ts',
  'tree-summary': 'tools/tree.ts',
};

function generatedBlocks(docs: any[]): any[] {
  const owner = (key: string) => BLOCK_OWNER[key] || 'tools/town.ts';
  return docs.flatMap((d: any) => d.blocks.map((b: any) => ({ file: d.file, page: d.page, key: b.key, body: b.body, owner: owner(b.key) })));
}

function openItems(docs: any[], docText: any, cageState: any): any {
  const out: any = { townPending: [], groupI: [], cagePending: [], carried: [] };
  const grab = (text: string, heading: string) => {
    const g = text.match(new RegExp(`${heading}[\\s\\S]*?(?=\\n# |\\Z)`));
    return g ? g[0].split(/\r?\n/).filter((l) => l.startsWith('|') && !/^\|[-| ]+\|$/.test(l)) : [];
  };
  const t = docText['towns-stalls.md'] || '';
  const m = t.match(/<!-- BEGIN GENERATED:pending -->\n([\s\S]*?)\n<!-- END GENERATED:pending -->/);
  if (m) out.townPending = m[1].split(/\r?\n/).filter((l: string) => l.startsWith('|') && !/^\|[-| ]+\|$/.test(l));
  const c = docText['checks.md'] || '';
  out.groupI = grab(c, '# I · Not Yet Checked').slice(1);
  out.cagePending = cageState.rows.filter((r: any) => r.status === 'PENDING');
  return out;
}

/** First column of every table in every doc: the vocabulary the docs publish. */
function entityIndex(docs: any[], docText: any): any[] {
  const map = new Map();
  for (const file of Object.keys(docText)) {
    const doc = docs.find((d) => d.file === file);
    let section = doc.toc[0] ? doc.toc[0].text : '';
    let pending = null;
    const lines = docText[file].split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const h = lines[i].match(/^(#{1,6})\s+(.*)$/);
      if (h) { section = h[2].replace(/[*`_]/g, ''); pending = null; continue; }
      if (!lines[i].startsWith('|')) continue;
      const cells = lines[i].replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c: string) => c.trim());
      const head = cells[0] || '';
      if (/^:?-{2,}:?$/.test(head.replace(/\s/g, ''))) continue;
      if (/^(mod|skill|aura|base|stone|weapon|element|id|slot|tier|value|zone|node|keystone|original|item|type|name|what|number|line|row)$/i.test(head)) { pending = head; continue; }
      if (!pending) continue;
      if (head.length < 2 || head.length > 46) continue;
      if (!/^[A-Za-z]/.test(head)) continue;
      const key = head.toLowerCase();
      if (!map.has(key)) map.set(key, { label: head, docs: new Map(), vocabulary: new Set() });
      const e = map.get(key);
      e.vocabulary.add(pending);
      if (!e.docs.has(file)) {
        let section = doc.toc.length ? doc.toc[0].text : '';
        let anchor = doc.toc.length ? doc.toc[0].id : '';
        for (const h of doc.toc) { if (h.line <= i + 1) { section = h.text; anchor = h.id; } else break; }
        e.docs.set(file, { file, page: doc.page, title: doc.title, section, anchor, hits: 0 });
      }
      e.docs.get(file).hits++;
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

let stateCache: { fp: string; value: any } = { fp: '', value: null };

function buildState(): any {
  const files = docFiles();
  const docText: Record<string, string> = {};
  for (const f of files) docText[f] = fs.readFileSync(path.join(ROOT, resolveDoc(f)), 'utf8');
  const docs = docMeta(docText);
  const data: Record<string, any> = {};
  for (const [key, rel] of Object.entries(DATA_FILES)) {
    data[key] = { key, file: rel, label: null, text: fs.readFileSync(path.join(ROOT, rel), 'utf8') };
    try {
      data[key].json = JSON.parse(data[key].text);
      data[key].label = reg.specs[rel] ? reg.specs[rel].label : rel;
      data[key].parseError = null;
    } catch (e) {
      data[key].json = {};
      data[key].parseError = e.message;
    }
  }
  const engine = freshEngine();
  const cageState = cages();
  const collections: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    collections[key] = reg.inspect(DATA_FILES[key], data[key].json);
  }
  const state = {
    stamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z',
    fingerprint: fingerprint(),
    docs, docText, data, collections,
    engine, numbers: keyNumbers(engine),
    cages: cageState,
    generated: generatedBlocks(docs),
    open: openItems(docs, docText, cageState),
    entities: entityIndex(docs, docText),
    categories: CATEGORIES.map(([name, list]) => [name, list.filter((f) => docText[f] != null)]),
    unsorted: docs.filter((d) => d.category === 'Unsorted').map((d) => d.file),
    counts: {
      docs: docs.length,
      lines: docs.reduce((s, d) => s + d.lines, 0),
      words: docs.reduce((s, d) => s + d.words, 0),
      blocks: generatedBlocks(docs).length,
      records: Object.values(collections).reduce((s: number, cs: any) => s + cs.reduce((x: number, c: any) => x + c.items.length, 0), 0),
      entities: 0,
    },
  };
  state.counts.entities = state.entities.length;
  return state;
}

function getState(): any {
  const fp = fingerprint();
  if (stateCache.fp === fp && stateCache.value) return stateCache.value;
  stateCache = { fp, value: buildState() };
  return stateCache.value;
}

/** Which docs mention a token (id or display name), with the heading it sits under. */
function mentions(state: any, needle: any): any[] {
  const n = String(needle || '').toLowerCase().trim();
  if (n.length < 3) return [];
  const out = [];
  for (const d of state.docs) {
    const text = state.docText[d.file].toLowerCase();
    let i = text.indexOf(n);
    if (i < 0) continue;
    let hits = 0;
    while (i >= 0) { hits++; i = text.indexOf(n, i + n.length); if (hits > 40) break; }
    const line = state.docText[d.file].slice(0, text.indexOf(n)).split(/\r?\n/).length;
    let section = d.toc[0] ? d.toc[0].text : '';
    let id = d.toc[0] ? d.toc[0].id : '';
    for (const h of d.toc) {
      if (h.line <= line) { section = h.text; id = h.id; } else break;
    }
    out.push({ file: d.file, page: d.page, title: d.title, section, anchor: id, hits });
  }
  return out;
}

export { ROOT, DATA_FILES, CAGES, CATEGORIES, categoryOf, getState, buildState, cages, runNode, fingerprint, stat, mentions, freshEngine };
