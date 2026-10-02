'use strict';

/**
 * Wiki pages — one function per route, each returning { file, html }.
 *
 * Everything is read from the state object built by tools/lib/state.js, so a page
 * never carries a number of its own: if it is not on disk or computed from what is
 * on disk, it does not appear here.
 */

const mdLib = require('./md');
const reg = require('./registry');
const st = require('./state');
const store = require('./store');
const S = require('./shell');

const { R, esc, slug, chip, tag, hint, code, tbl, kv, valueText, layout, sideNav, headerChips, BUILD_BANNER } = S;

const collPathSlug = (p) => String(p).replace(/\./g, '-');

const BLOCK_OWNER = {
  'group-A': 'tools/check.js', 'group-B': 'tools/check.js', 'group-C': 'tools/check.js', 'group-F': 'tools/check.js', 'group-T': 'tools/town.js',
  'skill-count': 'tools/skills.js', 'attack-roster': 'tools/skills.js', 'curse-roster': 'tools/skills.js', 'buff-roster': 'tools/skills.js', 'heal-roster': 'tools/skills.js', 'aura-roster': 'tools/skills.js',
  'tree-summary': 'tools/tree.js',
};

// ------------------------------------------------------------------ home

function home(state, mode) {
  const cards = state.categories.filter(([, list]) => list.length).map(([name, list]) => {
    const lines = list.reduce((s, f) => s + ((state.docs.find((d) => d.file === f) || {}).lines || 0), 0);
    return `<div class="card"><h3>${esc(name)} <span class="dim">${lines} lines</span></h3><ul class="plain">${list.map((f) => {
      const d = state.docs.find((x) => x.file === f);
      return `<li><a href="${R.doc(f)}">${esc(f)}</a> <span class="dim">${d ? d.lines : 0}</span>${d && d.blocks.length ? tag(`${d.blocks.length} generated`, 'gen') : ''}</li>`;
    }).join('')}</ul></div>`;
  }).join('');
  const fails = state.cages.rows.filter((r) => r.status === 'FAIL');
  const dataRows = Object.values(state.data).map((d) => {
    const cols = state.collections[d.key] || [];
    return [code(d.file), esc(d.label || ''), cols.length, cols.reduce((s, c) => s + c.items.length, 0),
      `<a href="${R.coll(d.key, (cols[0] || {}).path || '')}">browse</a> · <a href="${R.edit}">edit</a>`];
  });
  const body = `
<h1>The ModWorld spec wiki</h1>
${hint(`Rendered from this repository at request time: ${state.counts.docs} markdown specs, ${Object.keys(state.data).length} data files under <code>tools/data/</code>, the math in <code>tools/lib/engine.js</code>, and the two cages that rewrite the numeric tables in the prose. Nothing here is copied by hand, so a page cannot disagree with the data. <a href="${R.about}">How it stays true</a> · <a href="${R.edit}">add or edit data</a> · <a href="${R.dashboard}">dashboard snapshot</a>.`)}
<div class="grid2">
<div class="card"><h3>Spec layer</h3>${kv([['documents', state.counts.docs], ['lines', state.counts.lines.toLocaleString('en-US')], ['words', state.counts.words.toLocaleString('en-US')], ['generated blocks', `${state.counts.blocks} owned by tools/check.js and tools/town.js`], ['import edges', state.docs.reduce((s, d) => s + d.imports.filter((i) => state.docText[i] != null).length, 0)]])}</div>
<div class="card"><h3>Cages — ${state.cages.allOk ? '<span class="ok">passing</span>' : '<span class="bad">failing</span>'}</h3>${state.cages.list.map((c) => kv([[esc(c.label), `<span class="${c.ok ? 'ok' : 'bad'}">${c.counts.PASS} pass · ${c.counts.FAIL} fail · ${c.counts.PENDING} pending</span>`]])).join('')}${kv([['last cage run', state.cages.stamp]])}
<p>${fails.length ? `<span class="bad">${fails.length} failing check${fails.length > 1 ? 's' : ''}:</span> ${fails.map((r) => `<a href="${R.checks}"><code>${esc(r.id)}</code></a>`).join(' ')}` : '<span class="ok">no check is failing</span>'}</p></div>
<div class="card"><h3>Data layer</h3>${tbl([['file', 'rows', 'collections', '']], dataRows.map((r) => [r[0], r[3], r[2], '']))}${Object.values(state.data).map((d) => d.parseError ? `<p class="bad">${esc(d.file)} does not parse: ${esc(d.parseError)}</p>` : '').join('')}</div>
<div class="card"><h3>Open work</h3>${kv([['pending numbers', state.open.townPending.length ? state.open.townPending.length - 1 : 0], ['pending cage rows', state.open.cagePending.length], ['decisions forced by numbers', state.open.groupI.length ? state.open.groupI.length - 1 : 0], ['wiki snapshots', store.backups(50).length]])}<p><a href="${R.pending}">open &amp; pending →</a></p></div>
</div>
<h2>Browse by layer</h2>
${hint('A file dropped into the repository shows up here on the next render; anything not listed in a category lands in <i>Unsorted</i> rather than disappearing.')}
<div class="cards">${cards}</div>
${state.unsorted.length ? `<h2>Unsorted</h2><div class="cards"><div class="card"><ul class="plain">${state.unsorted.map((f) => `<li><a href="${R.doc(f)}">${esc(f)}</a></li>`).join('')}</ul></div></div>` : ''}
<h2>Named things</h2>
${hint(`${state.counts.entities} labels published in a spec table (Mods, skills, bases, stones, weapons, elements, check rows) — <a href="${R.xref}">cross-references</a> maps each to the documents that carry it, and to the data row behind it when one exists.`)}
`;
  return { file: R.index, html: layout({ title: 'Home', mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.index, 'Home']], nav: sideNav(state, R.index), body }) };
}

// ------------------------------------------------------------------ doc page

function docPage(state, file, mode) {
  const d = state.docs.find((x) => x.file === file);
  if (!d) return null;
  const text = state.docText[file];
  const renderer = mdLib.createRenderer({ shift: 1, idPrefix: 'h-', href: (f) => (state.docText[f] != null ? R.doc(f) : null), toc: [] });
  const html = renderer.mdToHtml(text);
  const toc = renderer.toc;
  const cat = state.categories.find(([, list]) => list.includes(file)) || ['Unsorted', []];
  const sibs = cat[1].filter((f) => state.docText[f] != null);
  const pos = sibs.indexOf(file);
  const backlinks = state.docs.filter((o) => o.file !== file
    && state.docText[o.file].replace(/^import\s+.*$/gm, '').includes('`' + file + '`'));
  const body = `
<article class="doc">
<h1>${esc(d.title)}</h1>
${kv([
  ['file', code(d.file) + ` · ${d.lines} lines · ${d.words.toLocaleString('en-US')} words · written ${esc(d.mtime)}`],
  ['category', esc(d.category)],
  ['imports', d.imports.length ? d.imports.map((i) => `<a href="${R.doc(i)}">${esc(i)}</a>`).join(' · ') : '—'],
  ['imported by', d.importedBy.length ? d.importedBy.map((i) => `<a href="${R.doc(i)}">${esc(i)}</a>`).join(' · ') : '—'],
  ['quoted by', backlinks.length ? backlinks.map((o) => `<a href="${R.doc(o.file)}">${esc(o.file)}</a>`).join(' · ') : '—'],
  ['generated blocks', d.blocks.length ? d.blocks.map((b) => `${code(b.key)} ${tag(BLOCK_OWNER[b.key] || 'tools/town.js', 'gen')}`).join(' · ') : 'none — prose and hand-written tables only'],
  ['raw', `<a href="${R.raw(d.file)}">${esc(d.file)}</a>`],
])}
${d.blocks.length ? hint('Text between <code>&lt;!-- BEGIN GENERATED:key --&gt;</code> markers belongs to the tool named above: change the data, run the writer, never the block.') : ''}
${html}
<nav class="pager">${pos > 0 ? `<a href="${R.doc(sibs[pos - 1])}">← ${esc(sibs[pos - 1])}</a>` : '<span></span>'}<a href="${R.index}">${esc(d.category)}</a>${pos >= 0 && pos < sibs.length - 1 ? `<a href="${R.doc(sibs[pos + 1])}">${esc(sibs[pos + 1])} →</a>` : '<span></span>'}</nav>
${mode === 'serve' ? docEditForm(file, text) : ''}
</article>`;
  const ctx = { title: 'On this page', items: toc.filter((h) => h.level <= 3).map((h) => ({ href: `#${h.id}`, text: `${'· '.repeat(h.level - 1)}${h.text}` })) };
  return { file: R.doc(file), html: layout({ title: d.title, mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.index, d.category], [R.doc(file), d.file]], nav: sideNav(state, R.doc(file), ctx), body }) };
}

function docEditForm(file, text) {
  return `<section id="source"><h2>Edit this file</h2>
${hint('Saving re-runs both cages against the new text and restores the file if a generated block no longer matches the data. Text between the markers is refused outright.')}
<form class="rec" data-api="/api/doc" method="post"><input type="hidden" name="file" value="${esc(file)}">
<div class="f"><span>markdown</span><div><textarea name="text" rows="26" spellcheck="false" style="min-height:360px">${esc(text)}</textarea></div></div>
<div class="f"><span></span><div><button type="submit">Save file &amp; run cages</button></div></div></form>
<div class="result"></div></section>`;
}

// ------------------------------------------------------------------ data hub

function dataHub(state, mode) {
  const body = Object.values(state.data).map((d) => {
    const spec = reg.specs[d.file] || {};
    const cols = state.collections[d.key] || [];
    return `<section id="${esc(d.key)}">
<h1>${code(d.file)}</h1>
${hint(esc(spec.note || 'No description — add one under specs in tools/lib/registry.js.'))}
${kv([['label', esc(spec.label || '')], ['written by', (spec.writers || []).map((w) => `<code>${esc(w)} --write</code>`).join(' · ') || '—'], ['read by', '<code>tools/lib/*</code> plus the cages'], ['rows', `${cols.reduce((s, c) => s + c.items.length, 0)} in ${cols.length} collections`], ['raw', `<a href="${R.raw(d.file)}">${esc(d.file)}</a>`]])}
${d.parseError ? `<div class="result show err"><b>This file does not parse.</b><pre>${esc(d.parseError)}</pre></div>` : ''}
${tbl(['collection', 'path', 'kind', 'rows', 'fields', 'group'], cols.map((c) => [`<a href="${R.coll(d.key, c.path)}">${esc(c.label)}</a>`, code(c.path), code(c.kind), c.items.length, c.fields.length, esc(c.group)]))}
</section>`;
  }).join('');
  const ctx = { title: 'Collections', items: Object.values(state.data).flatMap((d) => (state.collections[d.key] || []).map((c) => ({ href: R.coll(d.key, c.path), text: `${d.key} · ${c.label} (${c.items.length})` }))) };
  return { file: R.data, html: layout({ title: 'Data files', mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.data, 'Data files']], nav: sideNav(state, R.data, ctx), body }) };
}

// ------------------------------------------------------------------ fields & forms

function itemFields(coll, item) {
  if (coll.kind !== 'constmap' || !item) return coll.fields;
  return coll.fields.filter((f) => f.name === item.id);
}

function fieldInput(f, value, name) {
  const id = `f-${slug(name)}`;
  const v = value === undefined ? '' : value;
  const note = f.help ? `<small>${esc(f.help)}</small>` : (f.inferred ? '<small>inferred from the JSON on disk</small>' : '');
  const label = `<label for="${id}">${esc(f.label)}${f.unit ? ` <span class="dim">(${esc(f.unit)})</span>` : ''}${note}</label>`;
  const raw = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : JSON.stringify(v == null ? (f.type === 'list' ? [] : {}) : v, null, f.type === 'map' ? 1 : 0);
  let input;
  if (f.type === 'bool') input = `<select id="${id}" name="${esc(name)}"><option${v === true ? ' selected' : ''}>true</option><option${v === false ? ' selected' : ''}>false</option></select>`;
  else if (f.type === 'map' || f.type === 'json' || f.type === 'list') input = `<textarea id="${id}" name="${esc(name)}" spellcheck="false">${esc(raw)}</textarea>`;
  else if (f.type === 'text') input = `<textarea id="${id}" name="${esc(name)}">${esc(raw)}</textarea>`;
  else if (f.options || f.ref) input = `<input id="${id}" type="text" name="${esc(name)}" value="${esc(raw)}" list="${id}-dl" placeholder="${esc((f.options || []).join(' | ') || 'one of ' + (f.ref || ''))}"><datalist id="${id}-dl">${(f.options || []).map((o) => `<option value="${esc(o)}"></option>`).join('')}</datalist>`;
  else input = `<input id="${id}" type="text" inputmode="decimal" name="${esc(name)}" value="${esc(raw)}"${f.pattern ? ` pattern="${esc(f.pattern)}"` : ''}${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}>`;
  return `<div class="f">${label}<div>${input}</div></div>`;
}

function recordForm(dataKey, coll, item) {
  const fields = itemFields(coll, item);
  const value = item ? Object.assign({}, item.value) : {};
  const id = item ? item.id : '';
  const idField = coll.idField && (item ? coll.fields.find((f) => f.name === coll.idField) : { name: coll.idField, type: 'str', label: coll.idField });
  const rows = [];
  if (coll.kind === 'records' && idField) rows.push(fieldInput(idField, value[coll.idField], coll.idField));
  if (coll.kind === 'recordmap') rows.push(fieldInput({ name: '$key', type: 'str', label: 'key', help: 'the object key this row is stored under' }, id, '$key'));
  if (coll.kind === 'constmap') rows.push(fieldInput(fields[0] || { name: id, type: 'str', label: id }, value[id], id));
  rows.push(...fields.filter((f) => f.name !== coll.idField && f.name !== '$key' && (coll.kind !== 'constmap' || f.name !== id)).map((f) => fieldInput(f, value[f.name], f.name)));
  return `<form class="rec" data-api="/api/record" method="post">
<input type="hidden" name="file" value="${esc(dataKey)}"><input type="hidden" name="coll" value="${esc(coll.path)}"><input type="hidden" name="id" value="${esc(id)}">
${rows.join('\n')}
<div class="f"><span></span><div><button type="submit">${item ? 'Save &amp; regenerate' : 'Add &amp; regenerate'}</button> <label class="chk"><input type="checkbox" name="revertOnFail" value="1" checked> roll back if a cage fails</label></div></div>
</form><div class="result"></div>`;
}

// ------------------------------------------------------------------ collection page

function collPage(state, dataKey, pathKey, mode) {
  const cols = state.collections[dataKey] || [];
  const coll = cols.find((c) => c.path === pathKey) || cols[0];
  if (!coll) return null;
  const dfile = state.data[dataKey];
  const spec = (reg.specs[dfile.file] || {}).collections[coll.path] || {};
  const head = `<h1>${esc(coll.label)}</h1>${coll.note || spec.note ? hint(esc(coll.note || spec.note)) : ''}
${kv([['path', code(`${dfile.file} → ${coll.path}`)], ['kind', code(coll.kind) + (coll.idField ? ` · id field ${code(coll.idField)}` : '')], ['rows', coll.items.length], ['written by', ((reg.specs[dfile.file] || {}).writers || []).map((w) => `<code>${esc(w)} --write</code>`).join(' · ')], ['spec', `<a href="${R.doc((reg.specs[dfile.file] || {}).doc || '')}">${esc((reg.specs[dfile.file] || {}).doc || 'no index doc named')}</a>`]])}`;

  let body;
  if (coll.kind === 'constmap') {
    body = tbl(['key', 'label', 'value', ''], coll.items.map((it) => {
      const f = coll.fields.find((x) => x.name === it.id) || { name: it.id, type: 'str', label: reg.labelize(it.id) };
      return [code(it.id), esc(f.label) + (f.unit ? ` <span class="dim">(${esc(f.unit)})</span>` : ''), code(valueText(it.value[it.id])), `<a href="${R.record(dataKey, coll.path, it.id)}">edit</a>`];
    }));
  } else {
    const shown = coll.fields.filter((f) => f.name !== '$key').slice(0, 7);
    body = tbl([shown[0] ? esc(shown[0].label) : 'id', ...shown.slice(1).map((f) => esc(f.label)), ''], coll.items.map((it) => {
      const v = it.value || {};
      return shown.map((f, i) => {
        const cell = valueText(f.name === '$key' ? it.id : v[f.name]);
        const text = cell.length > 96 ? `${cell.slice(0, 96)}…` : cell;
        return i === 0 ? `<a href="${R.record(dataKey, coll.path, it.id)}">${esc(text)}</a>` : esc(text);
      }).concat([`<a href="${R.record(dataKey, coll.path, it.id)}">open</a>`]);
    }));
  }

  const addable = coll.kind !== 'constmap';
  const sections = `
<section>${head}${hint('Read-only view of the rows; the editor writes them.')}
<div class="tw">${body}</div></section>
${addable ? `<section id="add"><h2>Add a row</h2>${hint(`Validated, written to ${code(dfile.file)}, then re-run through the writers and both cages. A cage failure rolls the write back from a snapshot.`)}${recordForm(dataKey, coll, null)}</section>` : ''}
<section><h2>Raw JSON of this collection</h2><pre class="code">${esc(JSON.stringify(reg.getPath(dfile.json, coll.path), null, 2))}</pre><p><a href="${R.raw(dfile.file)}">${esc(dfile.file)}</a> · <a href="${R.edit}">snapshots</a></p></section>`;
  const ctx = { title: 'Collections', items: cols.map((c) => ({ href: R.coll(dataKey, c.path), text: `${c.label} (${c.items.length})`, current: c.path === coll.path })) };
  return { file: R.coll(dataKey, coll.path), html: layout({ title: coll.label, mode, stamp: state.stamp, chips: headerChips(state).concat([chip('rows', coll.items.length)]), crumbs: [[R.index, 'Wiki'], [R.data, dfile.file], [R.coll(dataKey, coll.path), coll.path]], nav: sideNav(state, R.coll(dataKey, coll.path), ctx), body: sections }) };
}

// ------------------------------------------------------------------ record page

function recordPage(state, dataKey, pathKey, id, mode) {
  const cols = state.collections[dataKey] || [];
  const coll = cols.find((c) => c.path === pathKey);
  const item = coll && coll.items.find((i) => String(i.id) === String(id));
  const back = `<a href="${R.coll(dataKey, pathKey)}">${esc(pathKey)}</a>`;
  if (!item) {
    return { file: R.record(dataKey, pathKey, id), html: layout({ title: 'Row not found', mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.data, 'Data'], [back, pathKey], ['#', id]], nav: sideNav(state, R.coll(dataKey, pathKey)), body: `<section><h1>No ${code(pathKey)} row ${code(id)}</h1>${hint('It was renamed or deleted since this link was made.')}<p>${back}</p></section>` }) };
  }
  const dfile = state.data[dataKey];
  const fields = itemFields(coll, item);
  const needles = [String(item.id)].concat(Object.values(item.value || {}).filter((v) => typeof v === 'string' && v.length > 4).map((v) => v));
  const seen = new Set();
  const mentions = [];
  for (const n of needles) for (const m of st.mentions(state, n)) {
    const k = `${m.file}#${m.anchor}`;
    if (seen.has(k)) continue;
    seen.add(k);
    mentions.push(Object.assign({ needle: n }, m));
  }
  const derived = state.numbers.filter((n) => coll.path.split('.')[0] === n.src || String(n.row).includes(String(item.id)) || String(n.expr).includes(String(item.id)));
  const referrers = [];
  for (const c of cols) {
    for (const it of c.items) {
      if (c.path === coll.path && it.id === item.id) continue;
      const hit = Object.entries(it.value || {}).find(([, v]) => (Array.isArray(v) ? v.map(String) : [String(v)]).includes(String(item.id)));
      if (hit) referrers.push([c, it, hit[0]]);
    }
  }
  const title = (item.value && (item.value.name || item.value.item || item.value.label)) || String(item.id);
  const body = `
<section><h1>${esc(title)}</h1>
${hint(`One row of ${code(dfile.file)} → ${code(coll.path)}. ${esc((reg.specs[dfile.file] || {}).note || '')}`)}
${kv([['path', code(coll.kind === 'constmap' ? `${coll.path}.${item.id}` : `${coll.path}[${item.id}]`)], ['collection', `<a href="${R.coll(dataKey, coll.path)}">${esc(coll.label)}</a>`], ['written by', ((reg.specs[dfile.file] || {}).writers || []).map((w) => `<code>${esc(w)}</code>`).join(' · ')], ['rows around it', coll.items.length]])}
<div class="tw">${tbl(['field', 'value', 'type', 'meaning'], fields.map((f) => {
  const raw = f.name === '$key' ? item.id : (item.value || {})[f.name];
  return [esc(f.label) + (f.unit ? ` <span class="dim">(${esc(f.unit)})</span>` : ''), code(valueText(raw)), code(f.type) + (f.inferred ? tag('inferred') : '') + (f.ref ? `<span class="dim"> → ${esc(f.ref)}</span>` : ''), esc(f.help || '')];
}))}</div></section>
<section id="edit"><h2>Edit</h2>${hint('On save: validate the row → snapshot the files → write the JSON → run the writers → run both cages → keep it or restore the snapshot.')}${recordForm(dataKey, Object.assign({}, coll, { fields }), item)}
<form class="rec" data-api="/api/delete" method="post"><input type="hidden" name="file" value="${esc(dataKey)}"><input type="hidden" name="coll" value="${esc(coll.path)}"><input type="hidden" name="id" value="${esc(item.id)}"><div class="f"><span></span><div><button class="warn" type="submit">Delete this row</button> <span class="dim">refused while another row still references it</span></div></div></form><div class="result"></div></section>
${derived.length ? `<section><h2>Numbers this feeds</h2>${tbl(['what', 'expression', 'value', 'checks row'], derived.map((n) => [esc(n.what), code(n.expr), code(n.value), `<a href="${R.checks}">${esc(n.row)}</a>`]))}</section>` : ''}
<section><h2>Mentioned in the specs</h2>${mentions.length ? tbl(['document', 'under heading', 'matched as', 'hits'], mentions.map((m) => [`<a href="${R.doc(m.file)}#${m.anchor}">${esc(m.file)}</a>`, esc(m.section), code(m.needle), m.hits])) : hint('No document names this row yet. If that is wrong, the spec is missing a line — not the data.')}</section>
${referrers.length ? `<section><h2>Referenced by</h2>${tbl(['row', 'collection', 'field'], referrers.map(([c, it, via]) => [`<a href="${R.record(dataKey, c.path, it.id)}">${esc(it.id)}</a>`, `<a href="${R.coll(dataKey, c.path)}">${esc(c.label)}</a>`, code(via)]))}</section>` : ''}
<section><h2>Raw JSON</h2><pre class="code">${esc(JSON.stringify(item.value, null, 2))}</pre></section>`;
  const ctx = { title: coll.label, items: coll.items.map((i) => ({ href: R.record(dataKey, coll.path, i.id), text: String(i.id), current: String(i.id) === String(item.id) })) };
  return { file: R.record(dataKey, coll.path, item.id), html: layout({ title: String(item.id), mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.data, dfile.file], [R.coll(dataKey, coll.path), coll.path], [R.record(dataKey, coll.path, item.id), String(item.id)]], nav: sideNav(state, R.record(dataKey, coll.path, item.id), ctx), body }) };
}

// ------------------------------------------------------------------ numbers / checks / pending

function numbersPage(state, mode) {
  const eng = state.engine;
  const body = `
<section><h1>Derived numbers</h1>${hint('Computed by <code>tools/lib/engine.js</code> from <code>tools/data/engine.json</code> while this page was being built. This is what the cages compare the prose against, so it is the fastest way to see what a data edit moves.')}</section>
<section>${tbl(['what', 'expression', 'value', 'checks row', 'source'], state.numbers.map((n) => [esc(n.what), code(n.expr), code(n.value), `<a href="${R.checks}">${esc(n.row)}</a>`, `<a href="${R.coll('engine', n.src || 'stat')}">${esc(n.src || 'stat')}</a>`]))}</section>
<section><h2>Band math</h2>${tbl(['band', 'mobs per group', 'kills/hr', 'drops/hr', 'junk/hr', 'gold per income-minute'], eng.BAND_KEYS.map((k) => {
  const b = eng.BAND[k];
  return [code(k), b.group_mobs, code(Math.round(b.kills_per_hr).toLocaleString('en-US')), code(Math.round(b.drops_per_hr).toLocaleString('en-US')), code(Math.round(b.junk_per_hr).toLocaleString('en-US')), code(eng.goldPerMinute(k))];
}))}<p>${Object.keys(eng.BAND).map((k) => `<a href="${R.record('engine', 'loot.bands', k)}">${esc(k)}</a>`).join(' · ')}</p></section>
<section><h2>Weapon math</h2>${tbl(['weapon', 'weapon_aspd', 'weapon_mult', 'Agi to Aspd Cap', 'reachable'], eng.WEAPONS.map((w) => [`<a href="${R.record('engine', 'weapons', w.name)}">${esc(w.name)}</a>`, code(w.weapon_aspd), code(w.weapon_mult), code(w.agi_to_cap), w.reachable ? '<span class="ok">yes</span>' : '<span class="warn">no — by intent</span>']))}<p class="hint">weapon_mult is derived, never stored: DPS equality is the rule (<code>checks.md</code> X14 · D10).</p></section>
<section><h2>engine.js exports</h2>${tbl(['export', 'value'], ['CEIL', 'SPLIT', 'FORCED_SPLIT', 'LCK_BOUND', 'BANDS', 'STONE', 'DERIVED'].map((k) => [code(k), code(JSON.stringify(eng[k]).slice(0, 700))]))}</section>`;
  return { file: R.numbers, html: layout({ title: 'Derived numbers', mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.numbers, 'Derived numbers']], nav: sideNav(state, R.numbers), body }) };
}

function checksPage(state, mode) {
  const body = `
<section><h1>Cage results</h1>${hint(`Every cage was executed here with <code>--checks</code> at ${esc(state.cages.stamp)}: invariants inside the data plus a read-back of every prose file. A <span class="bad">FAIL</span> means a document publishes a number the math does not produce; a <span class="warn">PENDING</span> row is a number the cages refuse to invent. Re-run manually with <code>node tools/verify.js</code>.`)}
<div class="tw">${tbl(['cage', 'script', 'writes', 'pass', 'fail', 'pending', 'docs exit'], state.cages.list.map((c) => [esc(c.label), `<a href="${R.raw(c.script)}">${esc(c.script)}</a>`, esc(c.owns), `<span class="ok">${c.counts.PASS}</span>`, `<span class="${c.counts.FAIL ? 'bad' : ''}">${c.counts.FAIL}</span>`, `<span class="warn">${c.counts.PENDING}</span>`, c.ok ? '<span class="ok">0</span>' : `<span class="bad">${c.code}</span>` ]))}</div></section>
${state.cages.list.map((c) => `<section><h2>${esc(c.label)} · ${esc(c.script)} ${c.ok ? '<span class="ok">PASS</span>' : '<span class="bad">FAIL</span>'}</h2>${c.notes.length ? `<pre class="code">${esc(c.notes.join('\n'))}</pre>` : ''}<div class="tw">${tbl(['id', 'status', 'detail'], c.rows.map((r) => [code(r.id), `<span class="status-${r.status.toLowerCase()}">${esc(r.status)}</span>`, esc(r.detail)]))}</div></section>`).join('')}
<section><h2>Generated blocks on disk</h2>${hint('Between the markers in these files there is nothing but tool output.')}</section>
<div class="tw">${tbl(['file', 'block', 'owner', 'lines'], state.generated.map((g) => [`<a href="${R.doc(g.file)}">${esc(g.file)}</a>`, code(g.key), `<a href="${R.raw(g.owner)}">${esc(g.owner)}</a>`, g.body.split(/\r?\n/).length]))}</div>
<section><h2>Raw cage output</h2>${state.cages.list.map((c, i) => `<p><button type="button" data-toggle="raw-${i}">${esc(c.script)} --checks</button></p><pre class="code hide" id="raw-${i}">${esc(c.raw)}</pre>`).join('')}</section>`;
  return { file: R.checks, html: layout({ title: 'Cage results', mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.checks, 'Cage results']], nav: sideNav(state, R.checks), body }) };
}

function pendingPage(state, mode) {
  const cells = (line) => line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const town = state.data.town.json || {};
  const bias = town.base_bias || {};
  const carried = (state.data.engine.json.f_rows_carried || []).filter((r) => r.status === 'pending');
  const body = `
<section><h1>Open &amp; pending</h1>${hint('What the cages refuse to invent. Each entry names the number it blocks, so closing one has a defined end. These lists are read from <code>towns-stalls.md</code>, <code>checks.md</code> group I, the cage output and the two data files — they are never typed twice.')}</section>
${state.open.townPending.length ? `<section><h2>Pending town numbers</h2>${tbl(['number', 'what it moves', 'status'], state.open.townPending.slice(1).map(cells))}</section>` : ''}
<section><h2>Pending cage rows</h2>${state.open.cagePending.length ? tbl(['cage', 'id', 'detail'], state.open.cagePending.map((r) => [esc(r.cage), code(r.id), esc(r.detail)])) : hint('None — every cage row is decided.')}</section>
${state.open.groupI.length ? `<section><h2>checks.md group I · decisions forced by numbers</h2>${tbl(['topic', 'what forces it'], state.open.groupI.map(cells))}</section>` : ''}
${carried.length ? `<section><h2>engine.json hand-carried rows</h2>${tbl(['id', 'value', 'status'], carried.map((r) => [`<a href="${R.record('engine', 'f_rows_carried', r.id)}">${code(r.id)}</a>`, esc(r.value), `<span class="warn">${esc(r.status)}</span>`]))}</section>` : ''}
${bias.status ? `<section><h2>Base bias · <span class="warn">${esc(bias.status)}</span></h2>${hint(esc(bias.column_meaning || ''))}<h3>Checks to close it</h3><ul>${(bias.checks || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ul><h3>Forbidden until then</h3><ul>${(bias.forbidden_until_closed || []).map((c) => `<li class="bad">${esc(c)}</li>`).join('')}</ul><p><a href="${R.record('town', 'base_bias', 'status')}">change the status</a></p></section>` : ''}
${(town.pending || []).length ? `<section><h2>town.json pending list</h2>${tbl(['number', 'breaks', 'status', ''], (town.pending || []).map((p) => [esc(p.number), esc(p.breaks), esc(p.status), `<a href="${R.record('town', 'pending', p.number)}">edit</a>`]))}</section>` : ''}`;
  return { file: R.pending, html: layout({ title: 'Open & pending', mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.pending, 'Open & pending']], nav: sideNav(state, R.pending), body }) };
}

// ------------------------------------------------------------------ graphs

function graphPage(state, mode) {
  const nodes = state.docs.map((d, i) => Object.assign({}, d, { x: 24 + (i % 6) * 160, y: 24 + Math.floor(i / 6) * 64 }));
  const by = {};
  for (const n of nodes) by[n.file] = n;
  const edges = [];
  for (const n of nodes) for (const t of n.imports) if (by[t]) edges.push([n, by[t]]);
  const svg = `<svg viewBox="0 0 1000 ${24 + Math.ceil(nodes.length / 6) * 64}" width="100%" role="img" aria-label="Import graph of the spec files">
<defs><marker id="g1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6e7885"/></marker></defs>
${edges.map(([a, b]) => `<path class="edge" d="M${a.x + 78},${a.y + 34} C${a.x + 78},${a.y + 60} ${b.x + 78},${b.y - 12} ${b.x + 78},${b.y}" marker-end="url(#g1)"/>`).join('')}
${nodes.map((n) => `<g class="node"><a href="${R.doc(n.file)}"><title>${esc(n.category)} · ${n.lines} lines</title><rect x="${n.x}" y="${n.y}" width="150" height="34" rx="7"/><text x="${n.x + 75}" y="${n.y + 15}" text-anchor="middle">${esc(n.file)}</text><text x="${n.x + 75}" y="${n.y + 28}" text-anchor="middle" font-size="9" fill="#9aa5b1">${esc(n.category)} · ${n.lines}L</text></a></g>`).join('')}
</svg>`;
  const boxes = [['tools/data/engine.json', 20, 20], ['tools/data/town.json', 20, 92], ['tools/lib/registry.js', 20, 190], ['tools/lib/engine.js', 262, 56], ['tools/check.js', 492, 20], ['tools/town.js', 492, 92], ['checks.md', 716, 20], ['towns-stalls.md', 716, 92], ['tools/lib/state.js', 262, 190], ['tools/wiki.js', 492, 190], ['the wiki', 716, 190], ['tools/report.js', 492, 258], ['dashboard.html', 716, 258]];
  const flow = `<svg viewBox="0 0 960 320" width="100%" role="img" aria-label="How data travels from the JSON files to the wiki and the dashboard">
<defs><marker id="g2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6e7885"/></marker></defs>
${boxes.map(([t, x, y]) => `<g class="node"><rect x="${x}" y="${y}" width="200" height="40" rx="7"/><text x="${x + 100}" y="${y + 24}" text-anchor="middle" font-size="10.5">${esc(t)}</text></g>`).join('')}
${[[220, 40, 262, 76], [220, 112, 262, 76], [462, 76, 492, 40], [462, 76, 492, 112], [692, 40, 716, 40], [692, 112, 716, 112], [220, 210, 262, 210], [462, 76, 262, 200], [692, 210, 716, 210], [462, 210, 492, 278], [692, 278, 716, 278]]
    .map(([x1, y1, x2, y2]) => `<path class="edge" d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}" marker-end="url(#g2)"/>`).join('')}
<text x="20" y="312" fill="#9aa5b1" font-size="10.5">JSON → shared math → cages → generated blocks in the specs → the wiki and the dashboard, both read from the same files.</text>
</svg>`;
  const body = `<section><h1>Graphs</h1>${hint(`Drawn from the files themselves: ${edges.length} import edges between ${nodes.length} specs. Adding a file or an <code>import</code> line redraws this page on the next render.`)}</section>
<section><h2>Import graph</h2><div class="tw">${svg}</div></section>
<section><h2>Where numbers travel</h2><div class="tw">${flow}</div></section>
<section><h2>In and out, per file</h2><div class="tw">${tbl(['file', 'category', 'imports', 'imported by', 'quoted by', 'generated blocks'], state.docs.map((d) => [`<a href="${R.doc(d.file)}">${esc(d.file)}</a>`, esc(d.category), d.imports.map((i) => `<a href="${R.doc(i)}">${esc(i)}</a>`).join(' · ') || '—', d.importedBy.map((i) => `<a href="${R.doc(i)}">${esc(i)}</a>`).join(' · ') || '—', state.docs.filter((o) => o.file !== d.file && state.docText[o.file].includes('\`' + d.file + '\`')).length || '0', d.blocks.map((b) => code(b.key)).join(' · ') || '—' ]))}</div></section>`;
  return { file: R.graph, html: layout({ title: 'Graphs', mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.graph, 'Graphs']], nav: sideNav(state, R.graph), body }) };
}

function xrefPage(state, mode) {
  const recs = {};
  for (const [k, cols] of Object.entries(state.collections)) {
    for (const c of cols) for (const it of c.items) {
      const targets = [it.id, it.value && (it.value.name || it.value.item)].filter(Boolean);
      for (const t of targets) {
        const key = slug(t);
        if (!recs[key]) recs[key] = { dataKey: k, coll: c.path, id: it.id };
      }
    }
  }
  const body = `<section><h1>Cross-references</h1>${hint(`Built by reading the first column of every published table in the specs — Mod names, skills, item bases, stones, weapons, elements, slots, check rows: ${state.entities.length} distinct labels across ${state.counts.docs} files. A label that matches a row in <code>tools/data/</code> links to the record that owns it.`)}</section>
<section>${hint('Press / and type to filter this table to the rows you care about.')}</section>
<section><div class="tw">${tbl(['label', 'published as', 'in documents', 'data row'], state.entities.map((e) => [code(e.label), [...e.vocabulary].map(esc).join(', '), [...e.docs.values()].map((d) => `<a href="${R.doc(d.file)}#${d.anchor}">${esc(d.page)}</a>`).join(' · '), recs[slug(e.label)] ? `<a href="${R.record(recs[slug(e.label)].dataKey, recs[slug(e.label)].coll, recs[slug(e.label)].id)}">${esc(recs[slug(e.label)].coll)}</a>` : '<span class="dim">prose only</span>']))}</div></section>`;
  return { file: R.xref, html: layout({ title: 'Cross-references', mode, stamp: state.stamp, chips: headerChips(state).concat([chip('labels', state.entities.length)]), crumbs: [[R.index, 'Wiki'], [R.xref, 'Cross-references']], nav: sideNav(state, R.xref), body }) };
}

function azPage(state, mode) {
  const items = state.docs.map((d) => ({ href: R.doc(d.file), text: d.file, note: d.title }));
  for (const [k, cols] of Object.entries(state.collections)) {
    for (const c of cols) {
      items.push({ href: R.coll(k, c.path), text: `${k}.json → ${c.path}`, note: `${c.label} (${c.items.length})` });
      for (const it of c.items) {
        items.push({ href: R.record(k, c.path, it.id), text: `${k}.json ${c.path}[${it.id}]`, note: (it.value && (it.value.name || it.value.item)) || '' });
      }
    }
  }
  items.sort((a, b) => a.text.localeCompare(b.text));
  const body = `<section><h1>Index A–Z</h1>${hint(`${items.length} documents, collections and data rows, all read from disk at render time.`)}</section>
<section><ul class="plain two">${items.map((i) => `<li><a href="${i.href}">${code(i.text)}</a>${i.note ? ` <span class="dim">${esc(String(i.note).slice(0, 70))}</span>` : ''}</li>`).join('')}</ul></section>`;
  return { file: R.az, html: layout({ title: 'Index A–Z', mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.az, 'Index A–Z']], nav: sideNav(state, R.az), body }) };
}

// ------------------------------------------------------------------ editor / about / search

function editPage(state, mode) {
  const blist = store.backups(12);
  const body = `
<section><h1>Editor</h1>${hint('The wiki writes exactly two kinds of thing: rows inside <code>tools/data/*.json</code>, and whole <code>*.md</code> files. Both run the same pipeline — validate → snapshot → write → run the writers → run both cages → keep the result or restore the snapshot — in <code>tools/lib/store.js</code>.')}</section>
<section><h2>Guards the editor enforces</h2><ul>
<li>Only <code>tools/data/engine.json</code>, <code>tools/data/town.json</code> and root <code>*.md</code> files are writable; every other path is refused and the server binds to 127.0.0.1.</li>
<li>A prose save that changes text between <code>BEGIN GENERATED</code> markers is refused — the markers belong to <code>tools/check.js</code> and <code>tools/town.js</code>.</li>
<li>Values are typed before writing: numbers stay numbers, enums must be one of the allowed options, references (<code>npc</code>, <code>stock</code>, <code>settlement</code>, band names) must resolve to a real row.</li>
<li>Price guards from <code>town.json → invariants</code> are checked in the browser-free validator: Road link ceiling, skip-token daily cap, stall lines that would sell gear/Mods/potions/stones.</li>
<li>After the write, both cages must exit 0 or the whole change is rolled back from the snapshot in <code>tools/.wiki-backup/</code>.</li>
</ul></section>
<section><h2>What to edit</h2><div class="tw">${tbl(['data file', 'collection', 'rows', 'kind', ''], Object.entries(state.collections).flatMap(([k, cols]) => cols.map((c) => [code(state.data[k].file), `<a href="${R.coll(k, c.path)}">${esc(c.label)}</a>`, c.items.length, code(c.kind), c.kind === 'constmap' ? `<a href="${R.coll(k, c.path)}">set a value</a>` : `<a href="${R.coll(k, c.path)}#add">add row</a>`])))}</div></section>
<section><h2>Commands the same buttons run</h2><pre class="code">node tools/check.js --write     # checks.md groups A · B · C · F
node tools/town.js --write      # towns-stalls.md + checks.md group T
node tools/check.js --checks    # invariants + prose read-back
node tools/town.js --checks
node tools/report.js            # dashboard.html snapshot
node tools/wiki.js build        # static wiki into wiki/</pre></section>
<section><h2>Snapshots</h2>${hint('Written under <code>tools/.wiki-backup/&lt;timestamp&gt;/</code>. Restoring copies back exactly the files the snapshot lists and nothing else.')}${blist.length ? `<div class="tw">${tbl(['when', 'what', 'files', ''], blist.map((b) => [code(b.ts), esc(b.label), b.files.map((f) => code(f)).join(' '), b.restored ? '<span class="warn">restored</span>' : `<form data-api="/api/restore" method="post"><input type="hidden" name="dir" value="${esc(b.dir)}"><button type="submit">restore</button></form>` ]))}</div>` : hint('No writes from the wiki yet.')}</section>`;
  return { file: R.edit, html: layout({ title: 'Editor', mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.edit, 'Editor']], nav: sideNav(state, R.edit, { title: 'Collections', items: Object.entries(state.collections).flatMap(([k, cols]) => cols.map((c) => ({ href: R.coll(k, c.path), text: `${k} · ${c.label}` }))) }), body }) };
}

function aboutPage(state, mode) {
  const body = `
<section><h1>About this wiki</h1>
<p>ModWorld is in design phase: the repository <em>is</em> the product, a set of English markdown specs whose numeric tables are generated from two JSON data files. This wiki is a fourth reader of the same files, so the docs, the dashboard, and the wiki can only ever say the same thing.</p>
<h2>Why it stays current</h2>
<ul>
<li><b>Rendered per request.</b> <code>tools/lib/state.js</code> re-reads every <code>*.md</code>, both data files and the engine module, and re-runs the cages only when their inputs change (mtime + size fingerprint). Saving a file in your editor shows up on reload; the live view reloads by itself over <code>/events</code>.</li>
<li><b>Nothing is typed twice.</b> Counts, band tables, ceilings, prices and check results are read from the data or computed by <code>tools/lib/engine.js</code>. There is no number in this code base of tools that imitates a doc number.</li>
<li><b>New data needs no code.</b> <code>tools/lib/registry.js</code> describes the fields it knows — labels, units, enums, cross-references. A key or record it has never seen is inferred from the JSON value and rendered as an editable row tagged <span class="tag">inferred</span>, so adding a field to <code>town.json</code> is enough.</li>
<li><b>New documents need no code.</b> A file dropped in the root appears in the spec list and on the home page; an unlisted file sorts into <i>Unsorted</i> instead of vanishing.</li>
<li><b>Edits are proven or reverted.</b> See <a href="${R.edit}">the editor</a>: validation, snapshot, writers, both cages, keep or roll back.</li>
<li><b>The dashboard is the frozen twin.</b> <a href="${R.dashboard}">dashboard.html</a> comes from <code>node tools/report.js</code>; both it and the wiki import <code>tools/lib/md.js</code> and <code>tools/lib/numbers.js</code>, so a table cannot render one way in one view and another way in the other.</li>
</ul>
<h2>Commands</h2><pre class="code">node tools/wiki.js serve [--port 7777] [--open]   live view + editing, 127.0.0.1 only
node tools/wiki.js build  [--out wiki]            static tree, same templates
node tools/wiki.js page &lt;file.html&gt;               print one rendered page to stdout
node tools/wiki.js validate &lt;file&gt; &lt;coll&gt; &lt;id&gt;    dry-run the front-gate validation</pre>
<h2>Layout of the tooling</h2>
<div class="tw">${tbl(['file', 'role'], [
  [code('tools/wiki.js'), 'CLI: serve, build, page, validate. No page logic of its own.'],
  [code('tools/lib/state.js'), 'live model: docs, data, derived numbers, cage runs, entity index'],
  [code('tools/lib/registry.js'), 'what each data collection means; coercion + validation + prose guards'],
  [code('tools/lib/store.js'), 'the only writer: snapshot, mutate, regenerate, verify, restore'],
  [code('tools/lib/md.js'), 'shared markdown renderer (also used by dashboard.html)'],
  [code('tools/lib/numbers.js'), 'shared derived key-number table'],
  [code('tools/lib/shell.js'), 'routes, CSS tokens, forms, client script'],
  [code('tools/lib/pages.js'), 'this page and every other page'],
  [code('tools/data/engine.json'), 'stat model · K · Mod maxima · loot · craft · timeline'],
  [code('tools/data/town.json'), 'prices · rosters · stock · Standing · Collector sets'],
])}</div>
<h2>Limits</h2>
<ul>
<li>The header box filters the page you are on; whole-repo search lives at <code>/search.html?q=…</code> and needs the server.</li>
<li>A static build cannot submit forms — the banner on each page says so rather than failing silently.</li>
<li><code>checks.md</code> groups D6–D14 are still hand-carried: <code>tools/survival.js</code> does not exist yet, so those rows are read from the doc, not produced by it.</li>
<li>Deleting a row is refused while another row references it, so the cages never see a dangling stock line.</li>
</ul>
</section>`;
  return { file: R.about, html: layout({ title: 'About', mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.about, 'About']], nav: sideNav(state, R.about), body }) };
}

function search(state, q, mode) {
  const needle = String(q || '').toLowerCase();
  const hits = [];
  if (needle.length >= 2) {
    for (const d of state.docs) {
      const lines = state.docText[d.file].split(/\r?\n/);
      let count = 0;
      const sample = [];
      for (let i = 0; i < lines.length && count < 8; i++) {
        if (!lines[i].toLowerCase().includes(needle)) continue;
        count++;
        let section = d.toc[0] ? d.toc[0].text : '';
        for (const h of d.toc) { if (h.line <= i + 1) section = h.text; else break; }
        sample.push({ line: i + 1, section, text: lines[i].slice(0, 160) });
      }
      const total = state.docText[d.file].toLowerCase().split(needle).length - 1;
      if (total) hits.push({ kind: 'doc', file: d.file, title: d.title, total, sample });
    }
    const rows = [];
    for (const [k, cols] of Object.entries(state.collections)) {
      for (const c of cols) for (const it of c.items) {
        if (`${it.id} ${JSON.stringify(it.value)}`.toLowerCase().includes(needle)) rows.push({ dataKey: k, coll: c, item: it });
      }
    }
    for (const r of rows.slice(0, 60)) hits.push({ kind: 'record', href: R.record(r.dataKey, r.coll.path, r.item.id), text: `${r.dataKey}.json ${r.coll.path}[${r.item.id}]`, label: (r.item.value && (r.item.value.name || r.item.value.item)) || '' });
  }
  const body = `<section><h1>Search</h1>${hint('Whole-repo search over every spec line and every data row. Served from the live state, so it sees unsaved-to-dashboard edits the moment they are on disk.')}</section>
<section><form method="get" class="rec"><div class="f"><span>query</span><div><input type="text" name="q" value="${esc(q || '')}" autofocus></div></div><div class="f"><span></span><div><button type="submit">Search ${state.counts.docs} docs and ${state.counts.records} data rows</button></div></div></form>
${needle.length >= 2 ? (hits.length ? hits.map((h) => h.kind === 'doc'
    ? `<h2><a href="${R.doc(h.file)}">${esc(h.file)}</a> <span class="dim">${h.total} match${h.total > 1 ? 'es' : ''} · ${esc(h.title)}</span></h2>${tbl(['line', 'under heading', 'text'], h.sample.map((s) => [`<a href="${R.doc(h.file)}">${s.line}</a>`, esc(s.section), code(s.text)]))}`
    : `<p><a href="${h.href}">${code(h.text)}</a> <span class="dim">${esc(h.label)}</span></p>`).join('') : hint(`Nothing in the repo contains "${esc(q)}".`)) : hint('Type at least two characters.')}</section>`;
  return { file: R.search, html: layout({ title: 'Search', mode, stamp: state.stamp, chips: headerChips(state), crumbs: [[R.index, 'Wiki'], [R.search, 'Search']], nav: sideNav(state, R.search), body }) };
}

// ------------------------------------------------------------------ page table

function allPages(state, mode) {
  S.setRawMode(mode);
  const pages = [home(state, mode), dataHub(state, mode), numbersPage(state, mode), checksPage(state, mode), pendingPage(state, mode), graphPage(state, mode), xrefPage(state, mode), azPage(state, mode), editPage(state, mode), aboutPage(state, mode)];
  for (const d of state.docs) pages.push(docPage(state, d.file, mode));
  for (const [k, cols] of Object.entries(state.collections)) {
    for (const c of cols) {
      pages.push(collPage(state, k, c.path, mode));
      for (const it of c.items) pages.push(recordPage(state, k, c.path, it.id, mode));
    }
  }
  return pages.filter(Boolean);
}

module.exports = { home, docPage, dataHub, collPage, recordPage, numbersPage, checksPage, pendingPage, graphPage, xrefPage, azPage, editPage, aboutPage, search, allPages, recordForm, fieldInput, itemFields, collPathSlug };
