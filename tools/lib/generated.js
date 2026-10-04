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

function write(file, text) {
  fs.writeFileSync(path.join(ROOT, file), text, 'utf8');
}

/** Run a writer table: [{ file, key, render() }]. */
function writeAll(writers, log = console.log) {
  const byFile = new Map();
  for (const w of writers) {
    if (!byFile.has(w.file)) byFile.set(w.file, []);
    byFile.get(w.file).push(w);
  }
  let missing = 0;
  for (const [file, ws] of byFile) {
    let text = read(file);
    for (const w of ws) {
      const r = replaceBlock(text, w.key, w.render());
      if (!r.found) { log(`MISSING MARKER ${w.key} in ${file}`); missing++; continue; }
      text = r.text;
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
