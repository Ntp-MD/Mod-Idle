'use strict';

/**
 * Spec dashboard — one self-contained HTML file for the whole design layer.
 *
 *   node tools/report.js            writes dashboard.html and prints the path
 *   node tools/report.js --open     also tries to open it in the default browser
 *
 * Everything in the page is read from the repo at build time: the two cages are
 * executed, the generated blocks are parsed out of the markdown between their
 * markers, and the key numbers come from tools/lib/engine.js — so the page cannot
 * disagree with the data files. It is a snapshot with a build stamp, not a live feed.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const eng = require('./lib/engine');
const mdLib = require('./lib/md');
const { keyNumbers } = require('./lib/numbers');
const R = require('./lib/roster');
const SM = require('./lib/skillmodel');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dashboard.html');
const engLib = eng;

// ---------------------------------------------------------------- inputs

const docs = fs.readdirSync(ROOT).filter((f) => f.endsWith('.md')).sort();
const docText = {};
for (const f of docs) docText[f] = fs.readFileSync(path.join(ROOT, f), 'utf8');

const extractBlocks = mdLib.extractBlocks;

const CAGES = [
  { script: 'tools/check.js', owns: 'engine.json → checks.md groups A · B · C · F', label: 'engine cage' },
  { script: 'tools/town.js', owns: 'engine.json + town.json → towns-stalls.md + checks.md group T', label: 'town cage' },
  { script: 'tools/skills.js', owns: 'skills.json → skill-pool*.md roster tables + counts', label: 'skills cage' },
  { script: 'tools/tree.js', owns: 'tree.json + node tables → skill-tree.md summary + D19 refs', label: 'tree cage' },
  { script: 'tools/ladder.js', owns: 'roster × drop rate → D20/E11 duplicate economy', label: 'ladder cage' },
  { script: 'tools/timeline.js', owns: 'engine.json xp → world.md 5-level-step table', label: 'timeline cage' },
  { script: 'tools/lint.js', owns: 'cross-file references · counts · deprecated terms', label: 'doc lint' },
];

for (const cage of CAGES) {
  let res;
  try {
    res = execFileSync('node', [cage.script, '--checks'], { cwd: ROOT, encoding: 'utf8' });
    cage.ok = true;
  } catch (e) {
    res = (e.stdout || '') + (e.stderr || '');
    cage.ok = false;
  }
  cage.rows = [];
  cage.notes = [];
  for (const line of res.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9-]+)\s{2,}(PASS|FAIL|PENDING)\s{2,}(.+)$/);
    if (m) { cage.rows.push({ id: m[1], status: m[2], detail: m[3] }); continue; }
    if (/^(doc blocks|template leaks|DOC BLOCKS|.*PASS · )/.test(line.trim())) cage.notes.push(line.trim());
  }
  cage.summary = res.split(/\r?\n/).filter((l) => /PASS\b.*FAIL\b/.test(l)).join(' ');
}

const generated = [];
for (const f of docs) for (const b of extractBlocks(docText[f])) generated.push({ file: f, key: b.key, body: b.body });
const BLOCK_OWNER = {
  'group-A': 'tools/check.js', 'group-B': 'tools/check.js', 'group-C': 'tools/check.js', 'group-F': 'tools/check.js', 'group-T': 'tools/town.js',
  'skill-count': 'tools/skills.js', 'attack-roster': 'tools/skills.js', 'curse-roster': 'tools/skills.js', 'buff-roster': 'tools/skills.js', 'heal-roster': 'tools/skills.js', 'aura-roster': 'tools/skills.js',
  'tree-summary': 'tools/tree.js',
};
const blockOwner = (key) => BLOCK_OWNER[key] || 'tools/town.js';

const fileMap = docs.map((f) => {
  const text = docText[f];
  const lines = text.split(/\r?\n/);
  const title = (lines.find((l) => l.startsWith('# ')) || f).replace(/^#\s*/, '');
  const imports = lines.filter((l) => /^import\s/.test(l)).map((l) => l.replace(/^import\s+/, '').trim());
  const blocks = extractBlocks(text).map((b) => b.key);
  return {
    file: f,
    title,
    lines: lines.length,
    bytes: text.length,
    imports,
    blocks,
    words: (text.match(/[A-Za-zÀ-ɏ0-9'’-]+/g) || []).length,
  };
});

// graph edges for the import relation
const importEdges = [];
for (const f of fileMap) for (const t of f.imports) if (docText[t] != null) importEdges.push([f.file, t]);

const openItems = {
  townPending: [],
  groupI: [],
  cagePending: [],
};
{
  const t = docText['towns-stalls.md'] || '';
  const m = t.match(/<!-- BEGIN GENERATED:pending -->\n([\s\S]*?)\n<!-- END GENERATED:pending -->/);
  if (m) openItems.townPending = m[1].split(/\r?\n/).filter((l) => l.startsWith('|') && !/^\|[-| ]+\|$/.test(l));
  const c = docText['checks.md'] || '';
  const g = c.match(/# I · Not Yet Checked[\s\S]*?(?=\n# |\Z)/);
  if (g) openItems.groupI = g[0].split(/\r?\n/).filter((l) => l.startsWith('|') && !/^\|[-| ]+\|$/.test(l));
  for (const cage of CAGES) for (const r of cage.rows) if (r.status === 'PENDING') openItems.cagePending.push({ cage: cage.label, ...r });
}

// ---------------------------------------------------------------- key numbers

// The same table the wiki renders, from tools/lib/numbers.js.
const NUMBERS = keyNumbers(engLib).map((n) => [n.what, n.expr, n.value, n.row]);

// ---------------------------------------------------------------- markdown → HTML
// The renderer itself lives in tools/lib/md.js and is shared with the wiki, so a
// table cannot read one way in the dashboard and another way in the wiki.

const esc = mdLib.esc;
const slug = mdLib.slug;
const hrefFor = (f) => (docText[f] != null ? `#doc-${slug(f)}` : null);
const renderer = mdLib.createRenderer({ href: hrefFor });
const inline = (s) => renderer.inline(s);
const mdToHtml = (text, opts = {}) => mdLib.mdToHtml(text, Object.assign({ href: hrefFor }, opts));

// ---------------------------------------------------------------- page

const CSS = [
  ':root{',
  '--bg:#0d1117;--panel:#12171f;--panel-2:#171d27;--line:#272e3a;--line-2:#1d2430;',
  '--fg:#e6edf3;--muted:#9aa5b1;--dim:#6e7885;',
  '--ok:#4ac26b;--bad:#f2636b;--warn:#d7a54a;--accent:#6cb8ff;',
  '--mono:"Fira Code",ui-monospace,"Cascadia Code",Consolas,"Liberation Mono",monospace;',
  '--sans:"Fira Sans",system-ui,"Segoe UI",Roboto,Arial,sans-serif;',
  '}',
  '*{box-sizing:border-box}',
  'html{scroll-padding-top:96px}',
  'body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 var(--sans)}',
  'a{color:var(--accent)}',
  'code{font:.92em/1.5 var(--mono);background:var(--panel-2);border:1px solid var(--line-2);border-radius:4px;padding:.05em .3em}',
  'pre.code{font:.86rem/1.5 var(--mono);background:var(--panel);border:1px solid var(--line-2);border-radius:8px;padding:12px 14px;overflow:auto;color:#cfe3f7}',
  'header{position:sticky;top:0;z-index:3;background:rgba(13,17,23,.97);border-bottom:1px solid var(--line);padding:10px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}',
  'h1{font-size:1rem;margin:0;letter-spacing:.02em}',
  '.stamp{color:var(--muted);font:.8rem/1 var(--mono)}',
  '#q{flex:1;min-width:220px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:.9rem var(--mono)}',
  '#q:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
  '.chips{display:flex;gap:8px;flex-wrap:wrap}',
  '.chip{font:.78rem/1 var(--mono);border:1px solid var(--line);border-radius:999px;padding:6px 10px;background:var(--panel)}',
  '.chip b{font-weight:600}',
  '.chip.ok b{color:var(--ok)}.chip.bad b{color:var(--bad)}.chip.warn b{color:var(--warn)}',
  'main{display:grid;grid-template-columns:220px minmax(0,1fr);gap:22px;padding:20px 18px 60px;max-width:1500px;margin:0 auto}',
  '@media (max-width:860px){main{grid-template-columns:1fr}nav{position:static}}',
  'nav{position:sticky;top:70px;align-self:start;font-size:.9rem}',
  'nav a{display:block;color:var(--muted);text-decoration:none;padding:4px 8px;border-left:2px solid var(--line)}',
  'nav a:hover,nav a:focus-visible{color:var(--fg);border-left-color:var(--accent);outline:none}',
  'section{background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:16px 18px;margin:0 0 22px;min-width:0;overflow:hidden}',
  '.tw{overflow-x:auto;max-width:100%;padding-bottom:2px}',
  'section>h2{margin:0 0 4px;font-size:1.05rem}',
  'section>p.hint,.hint{color:var(--muted);font-size:.88rem;margin:.2em 0 1.1em}',
  'table{border-collapse:collapse;width:100%;font:.86rem/1.45 var(--mono);margin:.4em 0 1em}',
  'th,td{border-bottom:1px solid var(--line-2);padding:6px 8px;text-align:left;vertical-align:top}',
  'th{color:var(--muted);font-weight:600;background:var(--panel-2);position:sticky;top:0}',
  'tbody tr:hover{background:#161d28}',
  '.num td:first-child{color:var(--accent)}',
  '.doc{border-top:3px solid var(--line);margin-top:26px}',
  '.doc h3{font-size:1rem;margin:0 0 2px}',
  '.doc .meta{color:var(--dim);font:.78rem var(--mono);margin-bottom:12px}',
  '.status-pass{color:var(--ok)}.status-fail{color:var(--bad)}.status-pending{color:var(--warn)}',
  '.tag{font:.72rem/1 var(--mono);border:1px solid var(--line);border-radius:4px;padding:3px 6px;color:var(--muted);margin-left:6px}',
  '.gen{border-color:#2f4a3a;color:#9adfae;background:#132018}',
  'svg .node rect{fill:var(--panel-2);stroke:var(--line)}svg text{fill:var(--fg);font:11px var(--mono)}svg .edge{stroke:var(--dim);stroke-width:1.2;fill:none}',
  '.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}',
  '.hide{display:none!important}',
  '@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}',
  '@media print{header,nav{position:static}section{border:none}}',
].join('');

function pipeSvg() {
  const box = (x, y, w, h, t, sub) => `<g class="node"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/>`
    + `<text x="${x + w / 2}" y="${y + (sub ? 17 : 22)}" text-anchor="middle">${t}</text>`
    + (sub ? `<text x="${x + w / 2}" y="${y + 32}" text-anchor="middle" fill="#9aa5b1" font-size="9.5">${sub}</text>` : '') + '</g>';
  const edge = (x1, y1, x2, y2) => `<path class="edge" d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}" marker-end="url(#a)"/>`;
  const a = box(20, 20, 190, 46, 'data/engine.json', 'stat · K · loot · craft');
  const b = box(20, 100, 190, 46, 'data/town.json', 'prices · rosters · stock');
  const lib = box(270, 60, 180, 46, 'lib/engine.js', 'shared math');
  const c1 = box(500, 20, 170, 46, 'check.js', 'groups A B C F');
  const c2 = box(500, 130, 170, 46, 'town.js', 'group T + stalls');
  const d1 = box(730, 20, 200, 46, 'checks.md', '4 generated blocks');
  const d2 = box(730, 130, 200, 46, 'towns-stalls.md', '10 generated blocks');
  const d3 = box(730, 215, 200, 46, 'towns-ui.md', 'reads the tables');
  const read = box(270, 200, 180, 46, 'read-back', 'prose files vs math');
  const w = 960, h = 280;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Data flow from the two JSON files through the shared engine math to the markdown tables">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6e7885"/></marker></defs>
${a}${b}${lib}${c1}${c2}${d1}${d2}${d3}${read}
${edge(210, 43, 270, 83)}${edge(210, 123, 270, 83)}${edge(450, 75, 500, 43)}${edge(450, 91, 500, 153)}
${edge(670, 43, 730, 43)}${edge(670, 153, 730, 153)}${edge(670, 165, 730, 235)}${edge(360, 106, 360, 200)}
<text x="20" y="262" fill="#9aa5b1" font-size="10.5">A hand-edit between the generated markers fails the cage · changing a number in engine.json re-prices every town line on the next --write</text>
</svg>`;
}

function cageSection() {
  return CAGES.map((c) => {
    const counts = { PASS: 0, FAIL: 0, PENDING: 0 };
    for (const r of c.rows) counts[r.status]++;
    const rows = c.rows.map((r) => `<tr class="status-${r.status.toLowerCase()}"><td>${esc(r.id)}</td><td>${r.status}</td><td>${esc(r.detail)}</td></tr>`).join('');
    return `<h3>${esc(c.label)} <span class="tag">${esc(c.script)}</span></h3>
<p class="hint">writes: ${esc(c.owns)} · ${esc(c.summary || 'no summary line')} · docs exit ${c.ok ? '0' : '1'}</p>
<p class="chips"><span class="chip ok"><b>${counts.PASS}</b> pass</span><span class="chip ${counts.FAIL ? 'bad' : 'ok'}"><b>${counts.FAIL}</b> fail</span><span class="chip warn"><b>${counts.PENDING}</b> pending</span></p>
${c.notes.filter((n) => /leak|doc blocks|NOT CURRENT/i.test(n)).map((n) => `<p class="hint">${esc(n)}</p>`).join('')}
<table><thead><tr><th>id</th><th>status</th><th>detail</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join('\n');
}

const sections = [];

sections.push({ id: 'pipeline', title: '1 · Where numbers come from', hint: 'Two JSON data files · one shared math module · two cages · the markdown they write.', body: pipeSvg() });

sections.push({
  id: 'cage', title: '2 · Cage result (snapshot)',
  hint: 'Both cages were executed while building this page. Re-run `node tools/report.js` after any edit — the timestamp in the header is the only freshness signal, this page is not a live view.',
  body: cageSection(),
});

sections.push({
  id: 'numbers', title: '3 · Key numbers, all derived',
  hint: 'Every value here is what tools/lib/engine.js computes right now, not what a document claims.',
  body: '<table class="num"><thead><tr><th>what</th><th>expression</th><th>value</th><th>row</th></tr></thead><tbody>'
    + NUMBERS.map((n) => `<tr><td>${esc(n[0])}</td><td>${esc(n[1])}</td><td>${esc(n[2])}</td><td>${esc(n[3])}</td></tr>`).join('')
    + '</tbody></table>',
});

const workshopSkills = R.byType('attack').map((s) => {
  const sc = SM.parseScale(s.scale) || { statPct: 0, powerPct: 0 };
  return { name: s.name, group: s.group, cd: s.cd, manaPct: SM.manaPct(s), statPct: sc.statPct, powerPct: sc.powerPct };
});
const workshopConst = { K_STAT: SM.K_STAT, K_SKILL: SM.K_SKILL, LEVEL_STEP: SM.LEVEL_STEP };

sections.push({
  id: 'workshop',
  title: '3b · Skill workshop (live)',
  hint: 'Change a build value and the table recomputes from the same formula as `tools/lib/skillmodel.js` and `node tools/skills.js --calc`. `stat` is the skill\'s scaling-stat value; `power` is phys/magic power.',
  body: `<div style="display:flex;gap:16px;flex-wrap:wrap;margin:.2em 0 1em;font:13px var(--mono)">
<label>stat <input id="ws-stat" type="number" value="816" style="width:90px;background:var(--panel-2);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px"></label>
<label>power <input id="ws-power" type="number" value="4826" style="width:90px;background:var(--panel-2);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px"></label>
<label>skill level <input id="ws-level" type="number" value="20" min="1" max="20" style="width:70px;background:var(--panel-2);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px"></label>
<label>CDR % <input id="ws-cdr" type="number" value="50" style="width:70px;background:var(--panel-2);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px"></label>
<label>ladder % <input id="ws-ladder" type="number" value="30" style="width:70px;background:var(--panel-2);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 6px"></label>
</div>
<table class="num" id="ws-table"><thead><tr><th>Skill</th><th>Group</th><th>cd</th><th>eff cd</th><th>press/s</th><th>mana%</th><th>mana%/s</th><th>dmg/press</th></tr></thead><tbody></tbody></table>
<script>
(function(){
var S = ${JSON.stringify(workshopSkills)};
var C = ${JSON.stringify(workshopConst)};
function v(id){return Number(document.getElementById(id).value)||0;}
function fmt(n){return Math.round(n).toLocaleString('en-US');}
function calc(){
  var stat=v('ws-stat'),power=v('ws-power'),level=v('ws-level'),cdr=v('ws-cdr'),lad=v('ws-ladder');
  var body='';
  for(var i=0;i<S.length;i++){
    var s=S[i];
    var ec=s.cd*(1-cdr/100)*(1-lad/100);
    var pps=ec>0?1/ec:0;
    var dmg=(stat*C.K_STAT*s.statPct/100 + power*s.powerPct/100)*C.K_SKILL*(1+level*C.LEVEL_STEP/100);
    body+='<tr><td>'+s.name+'</td><td>'+s.group+'</td><td>'+s.cd+'</td><td>'+ec.toFixed(2)+'</td><td>'+pps.toFixed(2)+'</td><td>'+(s.manaPct!=null?s.manaPct+'%':'—')+'</td><td>'+(s.manaPct!=null?(pps*s.manaPct).toFixed(2)+'%':'—')+'</td><td>'+fmt(dmg)+'</td></tr>';
  }
  document.getElementById('ws-table').getElementsByTagName('tbody')[0].innerHTML=body;
}
['ws-stat','ws-power','ws-level','ws-cdr','ws-ladder'].forEach(function(id){var el=document.getElementById(id);if(el)el.addEventListener('input',calc);});
calc();
})();
</script>`,
});

sections.push({
  id: 'generated', title: '4 · Generated tables',
  hint: 'These blocks live between `<!-- BEGIN GENERATED:key -->` markers. Editing them by hand is caught as a stale block.',
  body: generated.map((g) => `<h3>${esc(g.file)} <span class="tag gen">${esc(g.key)} · ${esc(blockOwner(g.key))}</span></h3>` + mdToHtml(g.body, { shift: 3 })).join('\n'),
});

sections.push({
  id: 'files', title: '5 · File map',
  hint: `${docs.length} spec files · ${fileMap.reduce((s, f) => s + f.lines, 0)} lines · ${generated.length} generated blocks · ${importEdges.length} import edges.`,
  body: '<table><thead><tr><th>file</th><th>title</th><th>lines</th><th>words</th><th>imports</th><th>generated blocks</th></tr></thead><tbody>'
    + fileMap.map((f) => `<tr><td><a href="#doc-${slug(f.file)}">${esc(f.file)}</a></td><td>${esc(f.title)}</td><td>${f.lines}</td><td>${f.words.toLocaleString('en-US')}</td><td>${f.imports.map((i) => `<a href="#doc-${slug(i)}">${esc(i)}</a>`).join(' · ') || '—'}</td><td>${f.blocks.join(' · ') || '—'}</td></tr>`).join('')
    + '</tbody></table>',
});

sections.push({
  id: 'open', title: '6 · Open and pending',
  hint: 'What the cages refuse to invent: rates that belong to simulations that do not exist yet.',
  body: `
<table><thead><tr><th>pending number</th><th>line it moves</th><th>status</th></tr></thead><tbody>
${openItems.townPending.slice(1).map((l) => '<tr>' + l.replace(/^\||\|$/g, '').split('|').map((c) => `<td>${inline(c.trim())}</td>`).join('') + '</tr>').join('')}
</tbody></table>
<h3>Pending cage rows</h3>
<table><thead><tr><th>cage</th><th>id</th><th>detail</th></tr></thead><tbody>
${openItems.cagePending.map((r) => `<tr class="status-pending"><td>${esc(r.cage)}</td><td>${esc(r.id)}</td><td>${esc(r.detail)}</td></tr>`).join('')}
</tbody></table>
<h3>checks.md group I · decisions still forced by numbers</h3>
<table><thead><tr><th>topic</th><th>what forces it</th></tr></thead><tbody>
${openItems.groupI.slice(1).map((l) => '<tr>' + l.replace(/^\||\|$/g, '').split('|').map((c) => `<td>${inline(c.trim())}</td>`).join('') + '</tr>').join('')}
</tbody></table>`,
});

sections.push({
  id: 'docs', title: '7 · Every spec file, rendered',
  hint: 'Click a filename anywhere in this page to jump to its render. Search filters rows and hides non-matching sections.',
  body: fileMap.map((f) => `<article class="doc" id="doc-${slug(f.file)}" data-file="${esc(f.file)}">
<h3>${esc(f.title)} <span class="tag">${esc(f.file)}</span></h3>
<p class="meta">${f.lines} lines · imports ${f.imports.length} · generated ${f.blocks.length ? f.blocks.join(', ') : 'none'}</p>
${mdToHtml(docText[f.file], { shift: 2 })}
</article>`).join('\n'),
});

const JS = [
  '(function(){',
  'var q=document.getElementById("q");',
  'function apply(){',
  'var t=(q.value||"").toLowerCase().trim();',
  'document.querySelectorAll("section").forEach(function(s){',
  'if(!t){s.classList.remove("hide");return;}',
  's.classList.toggle("hide", s.textContent.toLowerCase().indexOf(t)<0);',
  '});',
  'document.querySelectorAll("[data-file]").forEach(function(a){',
  'if(!t){a.classList.remove("hide");return;}',
  'a.classList.toggle("hide", a.textContent.toLowerCase().indexOf(t)<0);',
  '});',
  '}',
  'q.addEventListener("input",apply);',
  'document.addEventListener("keydown",function(e){',
  'if(e.key==="/"&&document.activeElement!==q){e.preventDefault();q.focus();}',
  'if(e.key==="Escape"&&document.activeElement===q){q.value="";apply();q.blur();}',
  '});',
  'var nav=document.getElementById("nav");',
  'Array.prototype.slice.call(nav.querySelectorAll("a")).forEach(function(a){',
  'a.addEventListener("click",function(){setTimeout(apply,0);});',
  '});',
  '})();',
].join('');

const navItems = sections.map((s) => `<a href="#${s.id}">${esc(s.title.replace(/^\d+ · /, ''))}</a>`).join('\n');

const htmlRaw = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ModWorld — spec and data dashboard</title>
<style>${CSS}</style>
</head>
<body>
<header>
<h1>ModWorld spec dashboard</h1>
<span class="stamp">built ${new Date().toISOString().replace('T', ' ').slice(0, 19)}Z · node tools/report.js</span>
<input id="q" type="search" placeholder="search specs, tables, numbers  ( / )" aria-label="Search the dashboard">
<span class="chips">
<span class="chip ${CAGES.every((c) => c.ok) ? 'ok' : 'bad'}">cage <b>${CAGES.map((c) => c.summary || '—').join(' · ')}</b></span>
<span class="chip">docs <b>${docs.length}</b></span>
<span class="chip">generated blocks <b>${generated.length}</b></span>
<span class="chip"><a href="wiki/index.html">live wiki</a></span>
</span>
</header>
<main>
<nav id="nav">${navItems}</nav>
<div>
${sections.map((s) => `<section id="${s.id}"><h2>${esc(s.title)}</h2><p class="hint">${inline(s.hint)}</p>${s.body}</section>`).join('\n')}
</div>
</main>
<script>${JS}</script>
</body>
</html>`;

// every table gets a horizontal scroll wrapper so a wide spec table cannot push the page sideways
const html = htmlRaw
  .replace(/<table(\s[^>]*)?>/g, '<div class="tw"><table$1>')
  .replace(/<\/table>/g, '</table></div>');

fs.writeFileSync(OUT, html, 'utf8');
const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`wrote ${path.relative(ROOT, OUT)} (${kb} KB) · ${docs.length} docs · ${generated.length} generated blocks · cages: ${CAGES.map((c) => c.summary).join(' | ')}`);
console.log(`open: file://${OUT.replace(/\\/g, '/')}`);

if (process.argv.includes('--open')) {
  const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try { spawn(cmd, [OUT], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref(); } catch (e) { /* headless */ }
}
