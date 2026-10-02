'use strict';

/**
 * Wiki store — the only place the wiki is allowed to change the repository.
 *
 * Every write follows the same pipeline a human would:
 *   snapshot → edit tools/data/*.json → run the writers (--write) → run the cages
 *   (--checks) → keep the result, or restore the snapshot when a cage disagrees.
 *
 * Nothing here ever edits between <!-- BEGIN GENERATED:* --> markers by hand: the
 * prose is rewritten only by tools/check.js and tools/town.js themselves.
 */

const fs = require('fs');
const path = require('path');
const st = require('./state');
const reg = require('./registry');

const ROOT = st.ROOT;
const BACKUP = path.join(ROOT, 'tools', '.wiki-backup');
const WRITERS = {
  engine: [['tools/check.js', ['--write']], ['tools/town.js', ['--write']], ['tools/timeline.js', ['--write']]],
  town: [['tools/town.js', ['--write']]],
  skills: [['tools/skills.js', ['--write']], ['tools/tree.js', ['--write']], ['tools/ladder.js', ['--write']]],
  tree: [['tools/tree.js', ['--write']]],
};
const VERIFY = ['tools/check.js', 'tools/town.js', 'tools/skills.js', 'tools/tree.js', 'tools/ladder.js', 'tools/timeline.js', 'tools/lint.js'];
const GENERATED_FILES = ['checks.md', 'towns-stalls.md', 'world.md', 'skill-pool.md', 'skill-pool-attack.md', 'skill-pool-curse.md', 'skill-pool-buff.md', 'skill-pool-aura-heal.md', 'skill-pool-system.md', 'skill-tree.md'];

function abs(rel) { return path.join(ROOT, rel); }
function touch(rel) { return ['tools/data/engine.json', 'tools/data/town.json', 'checks.md', 'towns-stalls.md'].includes(rel) || rel.endsWith('.md'); }

// ------------------------------------------------------------------ backups

function snapshot(label, files) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(BACKUP, ts);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = { label, ts, files: [], kept: true };
  for (const rel of files) {
    if (!fs.existsSync(abs(rel))) continue;
    fs.writeFileSync(path.join(dir, rel.replace(/[\\/]/g, '__')), fs.readFileSync(abs(rel)), 'utf8');
    manifest.files.push(rel);
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return dir;
}

function backups(limit = 15) {
  if (!fs.existsSync(BACKUP)) return [];
  return fs.readdirSync(BACKUP).filter((d) => /^\d{4}-/.test(d)).sort().reverse().slice(0, limit).map((d) => {
    let m = { ts: d };
    try { m = JSON.parse(fs.readFileSync(path.join(BACKUP, d, 'manifest.json'), 'utf8')); } catch (e) { /* partial */ }
    return { dir: d, label: m.label || d, ts: m.ts || d, files: m.files || [], restored: !!m.restored };
  });
}

function restoreDir(dir) {
  const from = path.join(BACKUP, dir);
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(from, 'manifest.json'), 'utf8')); } catch (e) { return { ok: false, msg: 'no manifest in ' + dir }; }
  for (const rel of m.files) {
    const src = path.join(from, rel.replace(/[\\/]/g, '__'));
    if (fs.existsSync(src)) fs.writeFileSync(abs(rel), fs.readFileSync(src), 'utf8');
  }
  m.restored = new Date().toISOString();
  fs.writeFileSync(path.join(from, 'manifest.json'), JSON.stringify(m, null, 2), 'utf8');
  return { ok: true, msg: `restored ${m.files.length} file(s) from ${dir}` };
}

// ------------------------------------------------------------------ layout-preserving writes
//
// The data files are read and edited by people too: one record per line, related
// keys grouped. A plain JSON.stringify would explode every row onto eight lines and
// bury the real change in diff noise, so a write first tries to splice the new values
// into the existing text. The patched text is only kept when it re-parses to exactly
// the object the cages will read; otherwise the file is rewritten in full.

function regionBounds(text, keyPath, kind) {
  const key = keyPath.split('.').pop();
  const open = kind === 'records' ? '[' : '{';
  const re = new RegExp(`"${key}"\\s*:\\s*${open === '[' ? '\\[' : '\\{'}`, 'g');
  const hits = [...text.matchAll(re)];
  if (hits.length !== 1) return null;
  const start = hits[0].index + hits[0][0].length;
  const end = matchClose(text, start - 1, open, open === '[' ? ']' : '}');
  return end == null ? null : { start, end };
}

function matchClose(text, from, open, close) {
  let depth = 0;
  let inStr = false;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return null;
}

/** Text slice of one element of a collection, located by its id (or object key). */
function elementBounds(text, collRegion, idField, id, kind) {
  const { start, end } = collRegion;
  const body = text.slice(start, end);
  if (kind === 'recordmap') {
    const re = new RegExp(`"${String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*\\{`, 'g');
    const hits = [...body.matchAll(re)];
    if (hits.length !== 1) return null;
    const s = start + hits[0].index + hits[0][0].length - 1;
    const e = matchClose(text, s, '{', '}');
    return e == null ? null : { start: s, end: e };
  }
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const needle = new RegExp(`"${esc(idField)}"\\s*:\\s*"${esc(String(id))}"`);
  const first = body.search(needle);
  if (first < 0 || body.slice(first + 1).search(needle) >= 0) return null;
  const s = text.lastIndexOf('{', start + first);
  const e = matchClose(text, s, '{', '}');
  return e == null || e > end ? null : { start: s, end: e };
}

const VALUE_RE = (name) => new RegExp(
  `("${name}"\\s*:\\s*)(?:"(?:[^"\\\\]|\\\\.)*"|-?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?|true|false|null|\\{(?:[^{}]||\\{[^{}]*\\})*\\}|\\[[^\\[\\]]*\\])`, 'g');

function patchElement(text, el, changes, addMissing) {
  const body = text.slice(el.start, el.end + 1);
  let out = body;
  let touched = 0;
  for (const [name, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    const re = VALUE_RE(name);
    const hits = [...out.matchAll(re)];
    if (hits.length === 1) {
      out = out.slice(0, hits[0].index) + hits[0][1] + JSON.stringify(value) + out.slice(hits[0].index + hits[0][0].length);
      touched++;
    } else if (hits.length === 0 && addMissing) {
      const at = out.lastIndexOf('}');
      const tail = out.slice(0, at).match(/\s*$/);
      out = out.slice(0, at) + ',' + (tail ? '' : ' ') + JSON.stringify(name) + ': ' + JSON.stringify(value) + out.slice(at);
      touched++;
    }
  }
  if (!touched) return null;
  return text.slice(0, el.start) + out + text.slice(el.end + 1);
}

/** Apply a list of layout-preserving edits; null when any of them cannot be spliced. */
function patchText(text, dataKey, coll, edits) {
  let out = text;
  for (const ed of edits) {
    const region = regionBounds(out, coll.path, coll.kind);
    if (!region) return null;
    if (ed.op === 'set') {
      const el = coll.kind === 'constmap'
        ? { start: region.start, end: region.end }
        : elementBounds(out, region, coll.idField, ed.id, coll.kind);
      if (!el) return null;
      const next = patchElement(out, el, ed.values, true);
      if (next == null) return null;
      out = next;
    } else if (ed.op === 'add') {
      const body = out.slice(region.start, region.end);
      const trailing = (body.match(/\s*$/) || [''])[0];
      const core = body.slice(0, body.length - trailing.length);
      const indent = (trailing.match(/[ \t]*$/)[0] || '') + '  ';
      const add = `${core.trimEnd().endsWith(',') ? '' : ','}\n${indent}${JSON.stringify(ed.record)}`;
      out = out.slice(0, region.start) + core + add + trailing + out.slice(region.end);
    } else if (ed.op === 'del') {
      const el = elementBounds(out, region, coll.idField, ed.id, coll.kind);
      if (!el) return null;
      const elLineStart = out.lastIndexOf('\n', el.start) + 1;
      const nl = out.indexOf('\n', el.end);
      const elLineEnd = nl < 0 ? out.length : nl + 1;
      const before = out.slice(elLineStart, el.start);
      const after = out.slice(el.end + 1, nl < 0 ? out.length : nl);
      if (!/^\s*$/.test(before) || !/^[,\s]*$/.test(after)) return null;
      out = after.includes(',')
        ? out.slice(0, elLineStart) + out.slice(elLineEnd)
        : (() => {
          // last element of the array: the comma that separated it lives on the previous line
          let at = elLineStart - 1;
          while (at > 0 && /[\s]/.test(out[at])) at--;
          if (out[at] !== ',' || at <= region.start) return null;
          return out.slice(0, at) + out.slice(at + 1, elLineStart) + out.slice(elLineEnd);
        })();
      if (out == null) return null;
    } else {
      return null;
    }
  }
  return out;
}

// ------------------------------------------------------------------ pipeline

function regenerate(dataKey, log) {
  for (const [script, args] of WRITERS[dataKey] || []) {
    const r = st.runNode(script, args);
    log.push({ step: `${script} ${args.join(' ')}`, ok: r.ok, code: r.code, out: r.out });
    if (!r.ok) return false;
  }
  for (const script of VERIFY) {
    const r = st.runNode(script, ['--checks']);
    log.push({ step: `${script} --checks`, ok: r.ok, code: r.code, out: r.out });
    if (!r.ok) return false;
  }
  return true;
}

/**
 * Apply a mutation to one data file and prove the repo still agrees with itself.
 * fn(json, ctx) must return { errors } to abort, or mutate json in place.
 */
function commit(dataKey, label, fn, opts = {}) {
  const rel = st.DATA_FILES[dataKey];
  const log = [];
  const text = fs.readFileSync(abs(rel), 'utf8');
  let json;
  try { json = JSON.parse(text); } catch (e) { return { ok: false, errors: [{ field: '$json', msg: `${rel} does not parse: ${e.message}` }], log }; }
  const state = st.getState();
  const ctx = reg.context(
    dataKey === 'engine' ? json : state.data.engine.json,
    dataKey === 'town' ? json : state.data.town.json,
  );
  const res = fn(json, ctx);
  if (res && res.errors && res.errors.length) return { ok: false, errors: res.errors, log: [{ step: 'validate', ok: false, out: res.errors.map((e) => e.msg).join('\n') }] };

  const dir = snapshot(label, [rel, ...GENERATED_FILES]);
  let out = reg.serialize(json);
  let how = 'rewrote';
  if (res.patch && res.patch.edits && res.patch.edits.length) {
    const patched = patchText(text, dataKey, res.patch.coll, res.patch.edits);
    if (patched) {
      try {
        if (JSON.stringify(JSON.parse(patched)) === JSON.stringify(json)) { out = patched; how = 'spliced into place, layout kept'; }
      } catch (e) { /* the splice changed no data we can prove — rewrite instead */ }
    }
  }
  fs.writeFileSync(abs(rel), out, 'utf8');
  log.push({ step: `write ${rel} (${how})`, ok: true, out: '' });
  const passed = regenerate(dataKey, log);
  const failed = log.filter((l) => !l.ok);
  if (!passed && opts.revertOnFail !== false) {
    restoreDir(path.basename(dir));
    return {
      ok: false, reverted: true, backup: path.basename(dir), log,
      errors: [{ field: '$cage', msg: `A cage rejected this edit, so ${rel} and the generated tables were restored from ${path.basename(dir)}. See the cage output below.` }],
    };
  }
  return { ok: passed, reverted: false, backup: path.basename(dir), log, errors: passed ? [] : failed.map((f) => ({ field: '$cage', msg: `${f.step} exited ${f.code}` })) };
}

// ------------------------------------------------------------------ mutations

function collection(dataKey, pathKey) {
  const rel = st.DATA_FILES[dataKey];
  return (reg.specs[rel] && reg.specs[rel].collections[pathKey]) || null;
}

/** Replace or append one record of a records/recordmap collection. */
function writeRecord(dataKey, pathKey, id, values, opts = {}) {
  const found = collection(dataKey, pathKey);
  if (!found) return { ok: false, errors: [{ field: '$coll', msg: `no collection "${pathKey}" in ${dataKey}.json` }] };
  const coll = Object.assign({ path: pathKey }, found);
  return commit(dataKey, `${dataKey}:${pathKey}:${id || 'new'}`, (json, ctx) => {
    const seed = seedFrom(json, coll, pathKey, id);
    // The stored value wins for type inference: a form always submits strings.
    const declared = { fields: reg.fieldSpecs(coll, [{ value: Object.assign({}, values, seed) }]) };
    const fields = declared.fields;
    const errs = [];
    const out = {};
    for (const [k, raw] of Object.entries(values)) {
      const f = fields.find((x) => x.name === k);
      if (!f) { errs.push({ field: k, msg: `"${k}" is not a field of ${pathKey}`, warn: true }); out[k] = raw; continue; }
      const c = reg.coerce(f, raw);
      if (c.error) errs.push({ field: k, msg: c.error });
      else if (c.value === undefined || (c.value === '' && f.type === 'enum' && f.nullable)) out[k] = null;
      else out[k] = c.value;
    }
    if (errs.filter((e) => !e.warn).length) return { errors: errs };
    const recColl = declared;
    const extra = Object.keys(out).filter((k) => !recColl.fields.some((f) => f.name === k));
    const validation = reg.validateRecord({ ...coll, fields: recColl.fields.concat(extra.map((k) => ({ name: k, type: 'json', label: k }))) }, ctx, out, { id: id || out[coll.idField], extraKeys: [] });
    if (validation.length) return { errors: validation };
    let patch = null;

    if (coll.kind === 'records') {
      const arr = reg.getPath(json, pathKey) || [];
      const idx = id == null ? -1 : arr.findIndex((r) => String((r || {})[coll.idField]) === String(id));
      const merged = idx >= 0 ? Object.assign({}, arr[idx], out) : out;
      const dup = arr.findIndex((r, i) => i !== idx && String((r || {})[coll.idField]) === String(merged[coll.idField]));
      if (merged[coll.idField] == null) return { errors: [{ field: coll.idField, msg: `${coll.idField} is required` }] };
      if (dup >= 0) return { errors: [{ field: coll.idField, msg: `${merged[coll.idField]} already exists in ${pathKey}` }] };
      const cross = reg.validateCross(coll, ctx, merged, { id: merged[coll.idField], siblings: arr.filter((_, i) => i !== idx).concat([merged]) });
      if (cross.length) return { errors: cross };
      if (idx >= 0) arr[idx] = merged; else arr.push(merged);
      reg.setPath(json, pathKey, arr);
      patch = idx >= 0
        ? { coll, edits: [{ op: 'set', id: String(id), values: out }] }
        : { coll, edits: [{ op: 'add', record: merged }] };
    } else if (coll.kind === 'recordmap') {
      const map = reg.getPath(json, pathKey) || {};
      const key = id == null ? String(out[coll.idField] || Object.keys(map).length) : String(id);
      const merged = Object.assign({}, map[key], out);
      const cross = reg.validateCross(coll, ctx, merged, { id: key, siblings: Object.values(map) });
      if (cross.length) return { errors: cross };
      delete merged.$key;
      map[key] = merged;
      reg.setPath(json, pathKey, map);
      patch = { coll, edits: [{ op: 'set', id: key, values: merged }] };
    } else if (coll.kind === 'constmap') {
      const key = String(id);
      const parent = reg.getPath(json, pathKey) || {};
      const value = Object.prototype.hasOwnProperty.call(out, key) ? out[key] : Object.values(out)[0];
      const f = fields.find((x) => x.name === key) || { name: key, type: reg.inferType(parent[key]), label: key, nullable: parent[key] === null };
      const coerced = reg.coerce(f, value);
      if (coerced.error) return { errors: [{ field: key, msg: coerced.error }] };
      parent[key] = coerced.value;
      reg.setPath(json, pathKey, parent);
      patch = { coll, edits: [{ op: 'set', id: key, values: { [key]: coerced.value } }] };
    } else {
      return { errors: [{ field: '$coll', msg: `collection ${pathKey} is not editable from the wiki` }] };
    }
    return { errors: [], patch };
  }, opts);
}

/** The record already on disk, used to type fields the form does not send. */
function seedFrom(json, coll, pathKey, id) {
  const node = reg.getPath(json, pathKey);
  if (coll.kind === 'records') return (node || []).find((r) => String((r || {})[coll.idField]) === String(id)) || {};
  if (coll.kind === 'recordmap') return (node || {})[id] || {};
  return node || {};
}

/** One constant on a constmap row: /api/const → engine.json K.K_STR etc. */
function writeConst(dataKey, pathKey, key, raw, opts = {}) {
  return writeRecord(dataKey, pathKey, key, { [key]: raw }, opts);
}

function deleteRecord(dataKey, pathKey, id, opts = {}) {
  const coll = collection(dataKey, pathKey);
  if (!coll) return { ok: false, errors: [{ field: '$coll', msg: `no collection "${pathKey}"` }] };
  return commit(dataKey, `delete ${dataKey}:${pathKey}:${id}`, (json) => {
    if (coll.kind === 'records') {
      const arr = reg.getPath(json, pathKey) || [];
      const keep = arr.filter((r) => String((r || {})[coll.idField]) !== String(id));
      if (keep.length === arr.length) return { errors: [{ field: '$id', msg: `no ${pathKey} record "${id}"` }] };
      const referenced = [];
      const scan = (node, where) => {
        if (node == null) return;
        if (Array.isArray(node)) { if (node.some((x) => String(x) === String(id))) referenced.push(where); node.forEach((x) => scan(x, where)); return; }
        if (typeof node === 'object') for (const [k, v] of Object.entries(node)) scan(v, where);
      };
      for (const [p, c] of Object.entries(reg.specs[st.DATA_FILES[dataKey]].collections)) {
        if (p === pathKey) continue;
        scan(reg.getPath(json, p), p);
      }
      if (referenced.length) return { errors: [{ field: '$ref', msg: `"${id}" is still referenced by ${[...new Set(referenced)].join(', ')} — clear those first` }] };
      reg.setPath(json, pathKey, keep);
      return { errors: [], patch: { coll: Object.assign({ path: pathKey }, coll), edits: [{ op: 'del', id: String(id) }] } };
    } else if (coll.kind === 'recordmap') {
      const map = reg.getPath(json, pathKey) || {};
      if (!(id in map)) return { errors: [{ field: '$id', msg: `no ${pathKey} entry "${id}"` }] };
      delete map[id];
      reg.setPath(json, pathKey, map);
    } else {
      return { errors: [{ field: '$coll', msg: 'a constant cannot be deleted, only set' }] };
    }
    return { errors: [] };
  }, opts);
}

/** Prose edit: whole-file replacement, refused when it touches a generated block. */
function writeDoc(file, text, opts = {}) {
  if (!/^[\w-]+\.md$/.test(file)) return { ok: false, errors: [{ field: 'file', msg: `bad file name "${file}"` }] };
  const before = fs.existsSync(abs(file)) ? fs.readFileSync(abs(file), 'utf8') : null;
  if (before != null) {
    const msgs = reg.validateProse(before, text);
    if (msgs.length) return { ok: false, errors: msgs.map((m) => ({ field: file, msg: m })) };
  } else if (!/^import\s|^#\s/m.test(text)) {
    return { ok: false, errors: [{ field: file, msg: 'a new spec file must open with a "# Title" line (see AGENT.md §4)' }] };
  }
  const dir = snapshot(`doc:${file}`, [file, ...GENERATED_FILES]);
  fs.writeFileSync(abs(file), text, 'utf8');
  const log = [{ step: `write ${file}`, ok: true, out: '' }];
  const passed = regenerate('engine', log);
  const failed = log.filter((l) => !l.ok);
  if (!passed && opts.revertOnFail !== false) {
    restoreDir(path.basename(dir));
    return { ok: false, reverted: true, backup: path.basename(dir), log, errors: [{ field: file, msg: 'a cage failed after the prose edit, so the file was restored.' }] };
  }
  return { ok: passed, backup: path.basename(dir), log, errors: passed ? [] : failed.map((f) => ({ field: file, msg: `${f.step} exited ${f.code}` })) };
}

/** Re-run the writers without changing data — used by the "regenerate" button. */
function regenerateNow(dataKey = 'engine') {
  const log = [];
  const passed = regenerate(dataKey, log);
  return { ok: passed, log };
}

module.exports = { commit, writeRecord, writeConst, deleteRecord, writeDoc, regenerateNow, snapshot, restoreDir, backups, BACKUP, abs };
