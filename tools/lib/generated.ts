/**
 * Shared generated-block I/O for the skill/tree cages.
 *
 * A "generated block" is the text between
 *   <!-- BEGIN GENERATED:key -->  …  <!-- END GENERATED:key -->
 * The writer rewrites the body; --checks fails when the body is stale, which is
 * what stops a hand-edit between the markers from silently drifting.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Writer, BlockState } from './types.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const begin = (k: string): string => `<!-- BEGIN GENERATED:${k} -->`;
const end = (k: string): string => `<!-- END GENERATED:${k} -->`;
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A body is always rendered with `\n`, but the docs are also written by the owner's editor and half
 * of them are CRLF through. So a block is written in the file's own ending and compared ignoring
 * endings — otherwise a CRLF doc reports every one of its generated blocks stale for a reason that is
 * only line endings, and `--write` leaves the file mixed.
 */
const eolOf = (text: string): string => (((text.match(/\r\n/g) || []).length) > ((text.match(/(?<!\r)\n/g) || []).length) ? '\r\n' : '\n');
const toEol = (text: string, eol: string): string => text.replace(/\r\n/g, '\n').split('\n').join(eol);
const bare = (s: string): string => s.replace(/\r\n/g, '\n').trim();

function replaceBlock(text: string, key: string, body: string): { text: string; found: boolean } {
  const re = new RegExp(escapeRe(begin(key)) + '[\\s\\S]*?' + escapeRe(end(key)));
  if (!re.test(text)) return { text, found: false };
  return { text: text.replace(re, () => toEol(`${begin(key)}\n${body}\n${end(key)}`, eolOf(text))), found: true };
}

function blockState(text: string, key: string, body: string): string {
  const m = text.match(new RegExp(escapeRe(begin(key)) + '([\\s\\S]*?)' + escapeRe(end(key))));
  if (!m) return 'missing';
  return bare(m[1]) === bare(body) ? 'current' : 'stale';
}

/**
 * Doc addresses. Design specs live under `doc/<layer>/`, agent ops and the
 * open-work queue under `harness/`, and `AGENT.md` stays at the root.
 *
 * A doc's key is its **bare file name** (the `doc/<layer>/` folder is a shelf,
 * not part of the identity), so every `import x.md`, `G.read('x.md')` argument
 * and prose `` `x.md` `` reference stays short. Harness docs keep the
 * `harness/` prefix so the two namespaces cannot collide. `resolveDoc(key)`
 * maps a key to its repo-relative path; non-doc paths (e.g.
 * `tools/data/engine.json`) pass through untouched.
 */
const DOC_TREE = 'doc';
const HARNESS = 'harness';

const isDocName = (name: string): boolean => name.endsWith('.md');

function walkDocs(dir: string, prefix: string, out: Map<string, string>): Map<string, string> {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walkDocs(rel, prefix, out);
    else if (isDocName(e.name)) out.set(prefix + e.name, rel);
  }
  return out;
}

/** Key → repo-relative path for every markdown doc the cages may read. */
function docIndex(): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of fs.readdirSync(ROOT)) if (isDocName(f)) map.set(f, f);
  walkDocs(DOC_TREE, '', map);
  walkDocs(HARNESS, `${HARNESS}/`, map);
  return map;
}

/** A doc key to its repo-relative path; a non-doc key is returned unchanged. */
function resolveDoc(key: string): string {
  if (typeof key !== 'string' || !isDocName(key)) return key;
  return docIndex().get(key) || key;
}

function read(file: string): string {
  return fs.readFileSync(path.join(ROOT, resolveDoc(file)), 'utf8');
}

/** Every markdown doc in the repo, keyed as `resolveDoc` expects. */
function listDocs(): string[] {
  return [...docIndex().keys()].sort();
}

/**
 * Writing is guarded, and the guard is the point: a writer that empties a doc destroys work that
 * was never committed and cannot be recovered from git. This happened twice on 2026-10-04 —
 * `combat.md` and `skill-pool.md` both went to zero bytes and came back as the last *committed*
 * version, which is older than what the owner had been editing. So a write is refused, loudly,
 * when the text it was handed is empty or has lost a marker pair it is supposed to fill.
 *
 * `writeAll` applies the same rule one level up, and that is the one that actually matters: the
 * truncations were not a renderer producing a short body, they were a writer run against a doc
 * whose markers were gone. A block whose marker pair is missing is not skipped and left for a
 * later pass — it aborts the whole file, because the half-written version of a generated doc is
 * worse than the stale one: it looks current and it is not.
 */
function write(file: string, text: string): void {
  const abs = path.join(ROOT, resolveDoc(file));
  if (!text || !text.trim()) throw new Error(`refusing to write ${file}: the rendered text is empty — the file would be destroyed`);
  const before = fs.readFileSync(abs, 'utf8');
  if (before && before.length > 200 && text.length < before.length * 0.5) {
    throw new Error(`refusing to write ${file}: ${before.length} bytes would become ${text.length} — that is a truncation, not a block rewrite`);
  }
  fs.writeFileSync(abs, text, 'utf8');
}

/** Run a writer table: [{ file, key, render() }]. Returns the number of missing marker pairs. */
function writeAll(writers: Writer[], log: (...a: any[]) => void = console.log): number {
  const byFile = new Map<string, Writer[]>();
  for (const w of writers) {
    if (!byFile.has(w.file)) byFile.set(w.file, []);
    byFile.get(w.file)!.push(w);
  }
  let missing = 0;
  for (const [file, ws] of byFile) {
    let text: string;
    try { text = read(file); } catch (e) {
      log(`REFUSED ${file}: the file is unreadable (${e.code || e.message}) — nothing written`);
      missing += ws.length;
      continue;
    }
    const absent = ws.filter((w) => blockState(text, w.key, '') === 'missing');
    if (absent.length) {
      for (const w of absent) log(`MISSING MARKER ${w.key} in ${file}`);
      log(`REFUSED ${file}: ${absent.length} of ${ws.length} marker pair(s) absent — the whole file is left untouched`);
      missing += absent.length;
      continue;
    }
    for (const w of ws) {
      text = replaceBlock(text, w.key, w.render()).text;
      log(`wrote ${w.key} → ${file}`);
    }
    write(file, text);
  }
  return missing;
}

/** Verify a writer table is current. Returns [{ file, key, state }]. */
function checkAll(writers: Writer[]): BlockState[] {
  const out: BlockState[] = [];
  const byFile = new Map<string, Writer[]>();
  for (const w of writers) {
    if (!byFile.has(w.file)) byFile.set(w.file, []);
    byFile.get(w.file)!.push(w);
  }
  for (const [file, ws] of byFile) {
    let text = '';
    try { text = read(file); } catch (e) { out.push({ file, key: '*', state: 'absent' }); continue; }
    for (const w of ws) out.push({ file, key: w.key, state: blockState(text, w.key, w.render()) });
  }
  return out;
}

export { ROOT, begin, end, replaceBlock, blockState, read, write, writeAll, checkAll, listDocs, resolveDoc };
