#!/usr/bin/env node
'use strict';

/**
 * ModWorld wiki — the readable, editable face of the design layer.
 *
 *   node tools/wiki.js serve [--port 7777] [--open]   live view + editing (127.0.0.1)
 *   node tools/wiki.js build  [--out wiki]            static tree, same templates
 *   node tools/wiki.js page <file.html>               print one rendered page
 *   node tools/wiki.js validate <file> <coll> [id]    dry-run the front-gate checks
 *
 * Serve renders per request from the files on disk, so a saved edit is on the page
 * without a rebuild; build writes the identical HTML out for sharing. Page logic
 * lives in tools/lib/pages.js — this file is only routing, writing and printing.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const cp = require('child_process');
const st = require('./lib/state');
const reg = require('./lib/registry');
const store = require('./lib/store');
const pages = require('./lib/pages');
const S = require('./lib/shell');

const ROOT = st.ROOT;
const argv = process.argv.slice(2);
const cmd = argv[0] || 'serve';
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : (i >= 0 ? true : dflt);
};

const RAW_OK = /^([\w-]+\.md|tools\/[\w-]+\.js|tools\/lib\/[\w-]+\.js|tools\/data\/[\w-]+\.json)$/;

// ------------------------------------------------------------------ router

function routeToPage(file, state, mode) {
  const cols = (k) => state.collections[k] || [];
  if (file === '/' || file === '' || file === 'index.html') return pages.home(state, mode);
  for (const [name, fn] of [
    ['numbers.html', pages.numbersPage], ['checks.html', pages.checksPage], ['pending.html', pages.pendingPage],
    ['graph.html', pages.graphPage], ['xref.html', pages.xrefPage], ['az.html', pages.azPage],
    ['edit.html', pages.editPage], ['about.html', pages.aboutPage], ['data.html', pages.dataHub],
  ]) if (file === name) return fn(state, mode);
  let m;
  if ((m = file.match(/^doc-([\w-]+)\.html$/))) {
    const name = `${m[1]}.md`;
    if (state.docText[name] != null) return pages.docPage(state, name, mode);
  }
  if ((m = file.match(/^rec-([a-z]+)-(.+)\.html$/))) {
    const key = m[1];
    const rest = m[2];
    if (state.data[key]) for (const c of cols(key)) {
      const pre = `${c.path.replace(/\./g, '-')}-`;
      if (!rest.startsWith(pre)) continue;
      const want = rest.slice(pre.length);
      const item = c.items.find((i) => S.slug(i.id) === want);
      if (item) return pages.recordPage(state, key, c.path, item.id, mode);
    }
  }
  if ((m = file.match(/^data-([a-z]+)-([\w-]+)?\.html$/))) {
    const key = m[1];
    const want = m[2];
    if (state.data[key]) {
      const c = cols(key).find((x) => x.path.replace(/\./g, '-') === want) || cols(key)[0];
      if (c) return pages.collPage(state, key, c.path, mode);
    }
  }
  return null;
}

// ------------------------------------------------------------------ build

function build() {
  const out = path.resolve(ROOT, String(flag('out', 'wiki')));
  const state = st.getState();
  const list = pages.allPages(state, 'build');
  fs.mkdirSync(out, { recursive: true });
  let bytes = 0;
  for (const p of list) {
    const target = path.join(out, p.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, p.html, 'utf8');
    bytes += Buffer.byteLength(p.html);
  }
  const rel = path.relative(ROOT, out);
  console.log(`wrote ${rel}/ (${list.length} pages · ${Math.round(bytes / 1024)} KB) · ${state.counts.docs} docs · ${state.counts.records} data rows · cages ${state.cages.allOk ? 'pass' : 'FAIL'}`);
  console.log(`open: file://${path.join(out, 'index.html').replace(/\\/g, '/')}`);
  if (flag('open', false)) openInBrowser(path.join(out, 'index.html'));
  return 0;
}

function openInBrowser(target) {
  const c = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try { cp.spawn(c, [target], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref(); } catch (e) { /* headless */ }
}

// ------------------------------------------------------------------ serve

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 8 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      const ct = req.headers['content-type'] || '';
      try {
        if (ct.includes('application/x-www-form-urlencoded')) {
          const o = {};
          for (const [k, v] of new URLSearchParams(data)) o[k] = v;
          resolve(o);
        } else resolve(JSON.parse(data));
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function recordValues(body) {
  const skip = new Set(['file', 'coll', 'id', 'revertOnFail', '$key']);
  const out = {};
  for (const [k, v] of Object.entries(body)) if (!skip.has(k)) out[k] = v;
  if (body.$key != null && body.id == null) out.$key = body.$key;
  return out;
}

function serve() {
  const port = Number(flag('port', 7777));
  const host = String(flag('host', '127.0.0.1'));
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    console.error(`refusing to bind ${host}: the wiki writes files in this repository, so it listens on loopback only.`);
    return 1;
  }
  const clients = new Set();
  let lastFp = st.fingerprint();

  const notify = () => {
    const msg = `data: ${JSON.stringify({ type: 'change', stamp: new Date().toISOString().slice(11, 19) })}\n\n`;
    for (const res of clients) { try { res.write(msg); } catch (e) { clients.delete(res); } }
  };
  const watchTargets = [ROOT, path.join(ROOT, 'tools', 'data')];
  for (const dir of watchTargets) {
    try {
      fs.watch(dir, { persistent: false }, (ev, name) => {
        if (!name) return;
        if (!/\.(md|json)$/.test(name)) return;
        setTimeout(() => {
          const fp = st.fingerprint();
          if (fp === lastFp) return;
          lastFp = fp;
          notify();
          console.log(`· reload pushed · ${name}`);
        }, 350);
      });
    } catch (e) { /* platform without fs.watch */ }
  }

  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (e) {
      // A page bug must never take the server down with it.
      console.error(`· ${req.method} ${req.url} → ${e.stack || e}`);
      if (!res.headersSent) json(res, 500, { ok: false, errors: [{ field: '$server', msg: String(e.message || e) }] });
      else { try { res.end(); } catch (e2) { /* gone */ } }
    }
  });

  async function handle(req, res) {
    const u = new URL(req.url, `http://${host}:${port}`);
    const p = decodeURIComponent(u.pathname);
    const state = st.getState();
    lastFp = state.fingerprint;

    if (req.method === 'GET' && p === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify({ type: 'hello', stamp: state.stamp })}\n\n`);
      clients.add(res);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { /* gone */ } }, 25000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }

    if (req.method === 'GET' && p.startsWith('/raw/')) {
      const rel = p.slice(5);
      if (!RAW_OK.test(rel)) { res.writeHead(400).end('refused: only spec, tool and data files are readable here'); return; }
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) { res.writeHead(404).end('missing'); return; }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(fs.readFileSync(abs, 'utf8'));
      return;
    }

    if (p === '/dashboard.html' || p === '/dashboard') {
      const abs = path.join(ROOT, 'dashboard.html');
      if (!fs.existsSync(abs)) { res.writeHead(404).end('run node tools/report.js first'); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(abs, 'utf8'));
      return;
    }

    if (p === '/api/state') {
      json(res, 200, {
        stamp: state.stamp, live: true, cages: state.cages.totals, cagesOk: state.cages.allOk,
        counts: state.counts, fingerprint: state.fingerprint,
        docs: state.docs.map((d) => ({ file: d.file, title: d.title, category: d.category, lines: d.lines, blocks: d.blocks.map((b) => b.key) })),
        data: Object.values(state.data).map((d) => ({ key: d.key, file: d.file, parseError: d.parseError, collections: (state.collections[d.key] || []).map((c) => ({ path: c.path, label: c.label, kind: c.kind, rows: c.items.length })) })),
        backups: store.backups(10),
      });
      return;
    }

    if (p === '/api/schema') {
      const key = u.searchParams.get('file') || 'town';
      json(res, 200, { file: st.DATA_FILES[key], collections: state.collections[key] || [] });
      return;
    }

    if (p === '/api/search') {
      const q = u.searchParams.get('q') || '';
      const page = pages.search(state, q, 'serve');
      if (u.searchParams.get('format') === 'json') {
        const needle = q.toLowerCase();
        const docs = state.docs.filter((d) => needle && state.docText[d.file].toLowerCase().includes(needle)).map((d) => d.file);
        const rows = [];
        if (needle.length > 2) for (const [k, cols] of Object.entries(state.collections)) for (const c of cols) for (const it of c.items) {
          if (`${it.id} ${JSON.stringify(it.value)}`.toLowerCase().includes(needle)) rows.push(`${k}.json ${c.path}[${it.id}]`);
        }
        json(res, 200, { q, docs, rows: rows.slice(0, 200) });
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page.html);
      return;
    }

    if (req.method === 'POST' && (p === '/api/record' || p === '/api/delete' || p === '/api/doc' || p === '/api/restore' || p === '/api/regenerate')) {
      let body;
      try { body = await readBody(req); } catch (e) { return json(res, 400, { ok: false, errors: [{ field: '$body', msg: e.message }] }); }
      const revert = body.revertOnFail !== '' && body.revertOnFail !== false;
      let out;
      if (p === '/api/restore') {
        const dir = String(body.dir || '');
        if (!/^\d{4}-/.test(dir)) return json(res, 400, { ok: false, errors: [{ field: 'dir', msg: 'bad snapshot name' }] });
        const r = store.restoreDir(dir);
        out = { ok: r.ok, message: r.msg, log: [{ step: `restore ${dir}`, ok: r.ok, out: '' }] };
      } else if (p === '/api/regenerate') {
        const key = st.DATA_FILES[body.file] ? body.file : 'engine';
        const r = store.regenerateNow(key);
        out = { ok: r.ok, message: r.ok ? 'Writers re-run and both cages pass.' : 'A cage failed; nothing was rolled back because no data was written.', log: r.log };
      } else if (p === '/api/doc') {
        const file = String(body.file || '');
        if (!RAW_OK.test(file) || !file.endsWith('.md')) return json(res, 400, { ok: false, errors: [{ field: 'file', msg: `refused: ${file} is not a root spec file` }] });
        out = store.writeDoc(file, String(body.text || ''), { revertOnFail: revert });
        if (out.ok) out.message = `${file} saved; both cages pass against the new text.`;
      } else {
        const key = st.DATA_FILES[body.file] ? body.file : 'engine';
        const pathKey = String(body.coll || '');
        const id = body.id === '' || body.id == null ? null : String(body.id);
        if (!pathKey) return json(res, 400, { ok: false, errors: [{ field: 'coll', msg: 'no collection named' }] });
        if (p === '/api/delete') {
          out = store.deleteRecord(key, pathKey, id, { revertOnFail: revert });
          if (out.ok) out.message = `Removed ${pathKey}[${id}] from ${st.DATA_FILES[key]}.`;
        } else {
          const values = recordValues(body);
          const realId = values.$key != null ? String(values.$key) : id;
          delete values.$key;
          if (id == null && values[regKeyFor(key, pathKey)] != null && keyOfIsId(key, pathKey)) { /* new record id from its own field */ }
          out = store.writeRecord(key, pathKey, id, values, { revertOnFail: revert });
          if (out.ok) out.message = `${id ? 'Updated' : 'Added'} ${pathKey}[${values[regKeyFor(key, pathKey)] || realId || ''}] in ${st.DATA_FILES[key]}.`;
        }
      }
      json(res, out.ok ? 200 : 422, Object.assign({ ok: out.ok !== false }, out));
      notify();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end('method'); return; }

    const file = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
    const page = routeToPage(file, state, 'serve') || routeToPage(file.replace(/\.html$/, '') + '.html', state, 'serve')
      || (file === 'search' || file === 'search.html' ? pages.search(state, u.searchParams.get('q') || '', 'serve') : null);
    if (!page) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(S.layout({ title: 'Not found', mode: 'serve', stamp: state.stamp, chips: S.headerChips(state), crumbs: [[S.R.index, 'Wiki'], ['#', file]], nav: S.sideNav(state, ''), body: `<section><h1>Nothing at ${S.code(file)}</h1><p class="hint">Routes: <a href="${S.R.index}">home</a> · <a href="${S.R.data}">data</a> · <a href="${S.R.numbers}">numbers</a> · <a href="${S.R.checks}">checks</a> · <a href="${S.R.edit}">editor</a> · <a href="${S.R.az}">index A–Z</a> · <a href="${S.R.search}">search</a></p></section>` }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(page.html);
  }

  server.listen(port, host, () => {
    const state = st.getState();
    console.log(`ModWorld wiki · http://${host}:${port}/`);
    console.log(`  ${state.counts.docs} specs · ${state.counts.records} data rows · ${state.counts.blocks} generated blocks · cages ${state.cages.allOk ? 'pass' : 'FAIL'}`);
    console.log('  reads the repo on every request; editing writes tools/data/*.json and *.md after both cages pass.');
    console.log(`  stop with Ctrl+C · static copy: node tools/wiki.js build`);
    if (flag('open', false)) openInBrowser(`http://${host}:${port}/`);
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`port ${port} is busy — try  node tools/wiki.js serve --port ${port + 1}`);
    else console.error(e.message);
    process.exitCode = 1;
  });
  const bye = () => { try { server.close(); } catch (e) { /* */ } process.exit(0); };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
}

function regKeyFor(dataKey, pathKey) {
  const spec = reg.specs[st.DATA_FILES[dataKey]];
  return (spec && spec.collections[pathKey] && spec.collections[pathKey].idField) || 'id';
}

function keyOfIsId(dataKey, pathKey) {
  return !!regKeyFor(dataKey, pathKey);
}

function page(file) {
  const state = st.getState();
  const pageObj = routeToPage(file, state, 'serve') || pages.search(state, '', 'serve');
  if (!pageObj) { console.error(`no route for ${file}`); return 1; }
  process.stdout.write(pageObj.html);
  return 0;
}

function validateCmd() {
  const [key, pathKey, id] = argv.slice(1).filter((a) => !a.startsWith('--'));
  if (!key || !pathKey) {
    console.log('collections:');
    for (const k of Object.keys(reg.specs)) console.log(`  ${k}`);
    for (const [k, spec] of Object.entries(reg.specs)) for (const [p, c] of Object.entries(spec.collections)) console.log(`  ${k.replace('tools/data/', '').replace('.json', '')} → ${p} (${c.kind}, ${(c.fields || []).length} declared fields)`);
    return 0;
  }
  const dataKey = Object.keys(st.DATA_FILES).find((k) => k === key || key.includes(k)) || key;
  const state = st.getState();
  const cols = state.collections[dataKey] || [];
  const coll = cols.find((c) => c.path === pathKey);
  if (!coll) { console.error(`no collection ${pathKey} in ${dataKey}`); return 1; }
  const items = id ? coll.items.filter((i) => String(i.id) === id) : coll.items;
  let bad = 0;
  for (const it of items) {
    const fields = pages.itemFields(coll, it);
    const values = {};
    for (const f of fields) values[f.name === '$key' ? it.id : f.name] = value2form(it.value || {}, f, it);
    const ctx = reg.context(state.data.engine.json, state.data.town.json);
    const errs = reg.validateRecord(Object.assign({}, coll, { fields }), ctx, values, { id: it.id, extraKeys: [] });
    const cross = reg.validateCross(coll, ctx, it.value, { id: it.id, siblings: coll.items.map((x) => x.value) });
    if (errs.length + cross.length) { bad++; console.log(`FAIL ${coll.path}[${it.id}]`); [...errs, ...cross].forEach((e) => console.log(`     ${e.msg}`)); }
  }
  console.log(`${coll.path}: ${items.length} rows checked · ${items.length - bad} clean · ${bad} with front-gate complaints`);
  return bad ? 1 : 0;
}

function value2form(value, f, item) {
  const v = f.name === '$key' ? item.id : value[f.name];
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function help() {
  console.log(`ModWorld wiki — dynamic, data-driven view of the design layer

  node tools/wiki.js serve [--port 7777] [--open]   live wiki + editing, loopback only
  node tools/wiki.js build  [--out wiki]            static tree (same templates)
  node tools/wiki.js page <file.html>               print one rendered page to stdout
  node tools/wiki.js validate <file> <coll> [id]    dry-run the front-gate validation
  node tools/wiki.js routes                         list every route this state produces

The wiki never stores numbers of its own. Serve renders from disk per request, so a
saved edit is visible without a rebuild; build writes the identical HTML for sharing.
Writes go through tools/lib/store.js: validate → snapshot → write → run the writers →
run both cages → keep or roll back.`);
}

function routes() {
  const state = st.getState();
  for (const p of pages.allPages(state, 'build')) console.log(p.file);
}

const dispatch = { serve, build, page, validate: validateCmd, routes, help, '--help': help };
const run = dispatch[cmd];
if (!run) { console.error(`unknown command "${cmd}"\n`); help(); process.exit(2); }
const code = run();
if (typeof code === 'number' && code !== 0) process.exitCode = code;
