'use strict';

/**
 * Shared generated-block I/O for the skill/tree cages.
 *
 * A "generated block" is the text between
 *   <!-- BEGIN GENERATED:key -->  …  <!-- END GENERATED:key -->
 * The writer rewrites the body; --checks fails when the body is stale, which is
 * what stops a hand-edit between the markers from silently drifting.
 *
 * tools/check.js and tools/town.js keep their own copy of these helpers (they
 * predate this module); new cages use this one so there is a single definition.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const begin = (k) => `<!-- BEGIN GENERATED:${k} -->`;
const end = (k) => `<!-- END GENERATED:${k} -->`;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A body is always rendered with `\n`, but the docs are also written by the owner's editor and half
 * of them are CRLF through. So a block is written in the file's own ending and compared ignoring
 * endings — otherwise a CRLF doc reports every one of its generated blocks stale for a reason that is
 * only line endings, and `--write` leaves the file mixed.
 */
const eolOf = (text) => (((text.match(/\r\n/g) || []).length) > ((text.match(/(?<!\r)\n/g) || []).length) ? '\r\n' : '\n');
const toEol = (text, eol) => text.replace(/\r\n/g, '\n').split('\n').join(eol);
const bare = (s) => s.replace(/\r\n/g, '\n').trim();

function replaceBlock(text, key, body) {
  const re = new RegExp(escapeRe(begin(key)) + '[\\s\\S]*?' + escapeRe(end(key)));
  if (!re.test(text)) return { text, found: false };
  return { text: text.replace(re, () => toEol(`${begin(key)}\n${body}\n${end(key)}`, eolOf(text))), found: true };
}

function blockState(text, key, body) {
  const m = text.match(new RegExp(escapeRe(begin(key)) + '([\\s\\S]*?)' + escapeRe(end(key))));
  if (!m) return 'missing';
  return bare(m[1]) === bare(body) ? 'current' : 'stale';
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/** Every markdown doc in the repo, keyed by its path from the root
 *  (`harness/todo.md`). The agent ops and the open-work queue live under
 *  `harness/`, so a flat root listing is not enough. */
const DOC_DIRS = ['', 'harness'];

function listDocs() {
  const out = [];
  for (const dir of DOC_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (f.endsWith('.md')) out.push(dir ? dir + '/' + f : f);
    }
  }
  return out.sort();
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
function write(file, text) {
  const abs = path.join(ROOT, file);
  if (!text || !text.trim()) throw new Error(`refusing to write ${file}: the rendered text is empty — the file would be destroyed`);
  const before = fs.readFileSync(abs, 'utf8');
  if (before && before.length > 200 && text.length < before.length * 0.5) {
    throw new Error(`refusing to write ${file}: ${before.length} bytes would become ${text.length} — that is a truncation, not a block rewrite`);
  }
  fs.writeFileSync(abs, text, 'utf8');
}

/** Run a writer table: [{ file, key, render() }]. Returns the number of missing marker pairs. */
function writeAll(writers, log = console.log) {
  const byFile = new Map();
  for (const w of writers) {
    if (!byFile.has(w.file)) byFile.set(w.file, []);
    byFile.get(w.file).push(w);
  }
  let missing = 0;
  for (const [file, ws] of byFile) {
    let text;
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
function checkAll(writers) {
  const out = [];
  const byFile = new Map();
  for (const w of writers) {
    if (!byFile.has(w.file)) byFile.set(w.file, []);
    byFile.get(w.file).push(w);
  }
  for (const [file, ws] of byFile) {
    let text = '';
    try { text = read(file); } catch (e) { out.push({ file, key: '*', state: 'absent' }); continue; }
    for (const w of ws) out.push({ file, key: w.key, state: blockState(text, w.key, w.render()) });
  }
  return out;
}

module.exports = { ROOT, begin, end, replaceBlock, blockState, read, write, writeAll, checkAll, listDocs };
