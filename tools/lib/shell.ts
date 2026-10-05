/**
 * Wiki shell — routes, page furniture, design tokens and the browser script.
 *
 * The tokens are the dashboard's, on purpose: the wiki and dashboard.html are two
 * views of one repo and must not look like two projects. Everything the client
 * script does (filter, live pill, form submit) is progressive: a static build
 * opened from disk still reads fine with JavaScript disabled.
 */

import * as mdLib from './md.ts';

const esc = mdLib.esc;
const slug = mdLib.slug;

// ------------------------------------------------------------------ routes

/**
 * Raw-file links differ between the two views: the server exposes /raw/<path>,
 * while a static tree sits one directory below the repo root, so ../<path> resolves.
 */
let rawMode = 'serve';
const setRawMode = (m: string): void => { rawMode = m === 'build' ? 'build' : 'serve'; };

const R = {
  index: 'index.html',
  doc: (f: any) => `doc-${f.replace(/\.md$/, '')}.html`,
  data: 'data.html',
  coll: (k: any, p: any) => `data-${k}-${String(p || '').replace(/\./g, '-')}.html`,
  record: (k: any, p: any, id: any) => `rec-${k}-${String(p).replace(/\./g, '-')}-${slug(id)}.html`,
  numbers: 'numbers.html',
  checks: 'checks.html',
  pending: 'pending.html',
  graph: 'graph.html',
  xref: 'xref.html',
  az: 'az.html',
  edit: 'edit.html',
  about: 'about.html',
  search: 'search.html',
  raw: (f: any) => (rawMode === 'build' ? `../${f}` : `/raw/${f}`),
  anchor: (section: any) => `h-${slug(section)}`,
  dashboard: '../dashboard.html',
};

const TOP = [
  [R.index, 'Home'],
  [R.data, 'Data files'],
  [R.numbers, 'Derived numbers'],
  [R.checks, 'Cage results'],
  [R.pending, 'Open & pending'],
  [R.graph, 'Graphs'],
  [R.xref, 'Cross-references'],
  [R.az, 'Index A–Z'],
  [R.edit, 'Editor'],
  [R.about, 'About'],
];

// ------------------------------------------------------------------ atoms

const chip = (label: any, value: any, cls = ''): string => `<span class="chip ${cls}">${esc(label)} <b>${esc(String(value))}</b></span>`;
const tag = (text: any, cls = ''): string => `<span class="tag ${cls}">${esc(text)}</span>`;
const hint = (html: any): string => `<p class="hint">${html}</p>`;
const code = (s: any): string => `<code>${esc(String(s))}</code>`;

function tbl(headers: any[], rows: any[][], cls = ''): string {
  const head = headers.map((h) => `<th>${h}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c == null || c === '' ? '—' : c}</td>`).join('')}</tr>`).join('');
  return `<table class="${cls}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function kv(pairs: any[]): string {
  return `<dl class="kv">${pairs.filter((p) => p[1] != null && p[1] !== '').map((p) => `<dt>${p[0]}</dt><dd>${p[1]}</dd>`).join('')}</dl>`;
}

function breadcrumb(parts: any[]): string {
  return `<nav class="crumbs" aria-label="Breadcrumb">${parts.map((p, i) => (i === parts.length - 1
    ? `<span>${esc(p[1])}</span>` : `<a href="${p[0]}">${esc(p[1])}</a>`)).join('<span class="sep">/</span>')}</nav>`;
}

function valueText(v: any): string {
  if (v === null) return 'null';
  if (v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))).join(' · ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ------------------------------------------------------------------ style

const CSS = [
  ':root{--bg:#0d1117;--panel:#12171f;--panel-2:#171d27;--line:#272e3a;--line-2:#1d2430;--fg:#e6edf3;--muted:#9aa5b1;--dim:#6e7885;--ok:#4ac26b;--bad:#f2636b;--warn:#d7a54a;--accent:#6cb8ff;--mono:"Fira Code",ui-monospace,"Cascadia Code",Consolas,"Liberation Mono",monospace;--sans:"Fira Sans",system-ui,"Segoe UI",Roboto,Arial,sans-serif}',
  '*{box-sizing:border-box}html{scroll-padding-top:104px}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 var(--sans)}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}',
  'code{font:.92em/1.5 var(--mono);background:var(--panel-2);border:1px solid var(--line-2);border-radius:4px;padding:.05em .3em;word-break:break-word}',
  'pre.code{font:.85rem/1.5 var(--mono);background:var(--panel);border:1px solid var(--line-2);border-radius:8px;padding:12px 14px;overflow:auto;color:#cfe3f7;white-space:pre-wrap}',
  'header.top{position:sticky;top:0;z-index:5;background:rgba(13,17,23,.97);border-bottom:1px solid var(--line);padding:9px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}',
  '.brand{font:.95rem/1 var(--mono);font-weight:600}.brand b{color:var(--accent)}',
  '.stamp{color:var(--muted);font:.74rem/1.2 var(--mono)}',
  '#q{flex:1;min-width:190px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:7px 10px;font:.88rem var(--mono)}',
  '#q:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
  '.chips{display:flex;gap:7px;flex-wrap:wrap;align-items:center}',
  '.chip{font:.74rem/1 var(--mono);border:1px solid var(--line);border-radius:999px;padding:6px 9px;background:var(--panel);white-space:nowrap;color:var(--muted)}.chip b{font-weight:600;color:var(--fg)}.chip.ok b{color:var(--ok)}.chip.bad b{color:var(--bad)}.chip.warn b{color:var(--warn)}a.chip:hover{border-color:var(--accent)}',
  '.pill{font:.72rem/1 var(--mono);border-radius:999px;padding:6px 9px;border:1px solid var(--line);color:var(--muted)}.pill.live{border-color:#2f4a3a;color:#9adfae;background:#132018}.pill.off{color:var(--warn);border-color:#4a3d22}',
  'main{display:grid;grid-template-columns:226px minmax(0,1fr);gap:22px;padding:18px 16px 70px;max-width:1580px;margin:0 auto}',
  '@media(max-width:920px){main{grid-template-columns:1fr}nav.side{position:static;max-height:none}}',
  'nav.side{position:sticky;top:66px;align-self:start;max-height:calc(100vh - 84px);overflow:auto;font-size:.86rem;padding-right:4px}',
  'nav.side h4{margin:14px 0 4px;font:.68rem/1 var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--dim)}',
  'nav.side a{display:block;color:var(--muted);padding:3px 8px;border-left:2px solid var(--line);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  'nav.side a:hover,nav.side a[aria-current="page"]{color:var(--fg);border-left-color:var(--accent);text-decoration:none}',
  '.crumbs{font:.76rem var(--mono);color:var(--dim);margin-bottom:10px}.crumbs .sep{margin:0 6px}',
  'section{background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:16px 18px;margin:0 0 20px;min-width:0}',
  'article.doc{padding:0;background:transparent;border:none}',
  'article.doc>section,article.doc>h1{background:transparent;border:none;padding:0;margin:0 0 14px}',
  'article.doc>h2,article.doc>h3,article.doc>h4,article.doc>p,article.doc>table,article.doc>ul,article.doc>ol,article.doc>pre,article.doc>blockquote,article.doc>hr{background:var(--panel);border:1px solid var(--line-2);border-radius:10px;padding:12px 14px;margin:0 0 14px;overflow:auto}',
  'article.doc>h2{font-size:1.02rem;background:var(--panel-2)}article.doc>h3{font-size:.95rem;border:none;background:transparent;padding:6px 0 0}article.doc>h4{border:none;background:transparent;padding:4px 0 0}',
  '.tw{overflow-x:auto;max-width:100%;padding-bottom:2px}',
  'h1{font-size:1.32rem;margin:0 0 8px}h2{font-size:1.06rem;margin:0 0 8px}h3{font-size:.97rem;margin:16px 0 4px}',
  '.hint{color:var(--muted);font-size:.87rem;margin:.3em 0 1em}.dim{color:var(--dim)}',
  'table{border-collapse:collapse;width:100%;font:.85rem/1.45 var(--mono);margin:.4em 0 1em}th,td{border-bottom:1px solid var(--line-2);padding:5px 8px;text-align:left;vertical-align:top}th{color:var(--muted);font-weight:600;background:var(--panel-2)}tbody tr:hover{background:#161d28}',
  '.num td:first-child{color:var(--accent)}',
  '.tag{font:.7rem/1 var(--mono);border:1px solid var(--line);border-radius:4px;padding:3px 6px;color:var(--muted);margin-left:6px;white-space:nowrap}.tag.gen{border-color:#2f4a3a;color:#9adfae;background:#132018}.tag.src{border-color:#3b3355;color:#c3b2ee}',
  '.status-pass,.ok{color:var(--ok)}.status-fail,.bad{color:var(--bad)}.status-pending,.warn{color:var(--warn)}',
  '.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}',
  '.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:20px}',
  '.card{background:var(--panel);border:1px solid var(--line-2);border-radius:10px;padding:12px 14px}.card h3{margin:0 0 8px;font-size:.94rem}',
  '.kv{display:grid;grid-template-columns:max-content 1fr;gap:3px 14px;font-size:.88rem;margin:.4em 0 1em}.kv dt{color:var(--muted);font:.8rem/1.6 var(--mono)}.kv dd{margin:0}',
  'ul.plain{list-style:none;padding:0;margin:0}ul.plain li{padding:2px 0}',
  'ul.two{columns:2;column-gap:26px;font-size:.86rem}@media(max-width:760px){ul.two{columns:1}}',
  'form.rec{border:1px solid var(--line-2);border-radius:10px;padding:14px;background:var(--panel-2);margin:10px 0}',
  'form.rec .f{display:grid;grid-template-columns:200px 1fr;gap:4px 12px;margin-bottom:8px;align-items:start}@media(max-width:700px){form.rec .f{grid-template-columns:1fr}}',
  'form.rec label{font:.78rem/1.4 var(--mono);color:var(--muted);padding-top:6px}form.rec label small{display:block;color:var(--dim)}',
  'input[type=text],input[type=search],select,textarea{background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:7px;padding:6px 8px;font:.86rem var(--mono);width:100%}',
  'textarea{min-height:62px;resize:vertical}input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible,#q:focus-visible{outline:2px solid var(--accent);outline-offset:1px}',
  'button{background:#1c2634;color:var(--fg);border:1px solid var(--line);border-radius:7px;padding:7px 12px;font:.82rem var(--mono);cursor:pointer}button:hover{border-color:var(--accent)}button.warn{border-color:#5a2f34;color:#ffb3b8}',
  'label.chk{display:inline-flex;gap:6px;align-items:center;font:.78rem var(--mono);color:var(--muted)}label.chk input{width:auto}',
  '.result{border-radius:8px;padding:10px 12px;margin:10px 0;font-size:.85rem;display:none;white-space:pre-wrap}.result.show{display:block}.result.good{background:#122019;border:1px solid #2f4a3a;color:#b7e9c4}.result.err{background:#20131a;border:1px solid #5a2f3a;color:#ffc3cb}.result pre{margin:6px 0 0;white-space:pre-wrap;font:.8rem/1.45 var(--mono);max-height:260px;overflow:auto}',
  '.banner{border:1px solid #4a3d22;background:#1d1710;color:#e6caa0;border-radius:10px;padding:10px 12px;font-size:.86rem;margin-bottom:16px}',
  '.pager{display:flex;justify-content:space-between;gap:10px;font:.85rem var(--mono);margin:18px 0}',
  '.hide{display:none!important}.inline{display:contents}',
  'svg .node rect{fill:var(--panel-2);stroke:var(--line)}svg text{fill:var(--fg);font:11px var(--mono)}svg .edge{stroke:var(--dim);stroke-width:1.2;fill:none}',
  '@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}',
  '@media print{header.top,nav.side{position:static}section,article{border:none}}',
].join('\n');

// ------------------------------------------------------------------ client

const CLIENT = String.raw`
(function(){
  function boxNear(el){
    var p=el.closest('section')||document.body;
    var b=p.querySelector('.result');
    if(!b){b=document.createElement('div');b.className='result';el.after(b);}
    return b;
  }
  function say(el,msg,cls){var b=boxNear(el);b.className='result show '+(cls||'');b.textContent=msg;}
  var q=document.getElementById('q');
  function apply(){
    if(!q)return;
    var t=(q.value||'').toLowerCase().trim();
    document.querySelectorAll('main section, main article.doc > h2, nav.side a').forEach(function(s){
      if(!t){s.classList.remove('hide');return;}
      s.classList.toggle('hide', s.textContent.toLowerCase().indexOf(t)<0);
    });
    var n=document.getElementById('filter-count');
    if(n){var k=document.querySelectorAll('main section:not(.hide)').length;n.textContent=t?('matching sections: '+k):'';}
  }
  if(q){
    q.addEventListener('input',apply);
    document.addEventListener('keydown',function(e){
      if(e.key==='/'&&document.activeElement!==q){e.preventDefault();q.focus();}
      if(e.key==='Escape'&&document.activeElement===q){q.value='';apply();q.blur();}
    });
  }
  var pill=document.getElementById('pill');
  if(pill&&pill.dataset.live==='1'&&window.EventSource){
    var es=new EventSource('/events');
    es.onmessage=function(ev){
      var m;try{m=JSON.parse(ev.data);}catch(e){return;}
      if(m.type==='change'){pill.textContent='live · '+m.stamp;location.reload();}
    };
    es.onerror=function(){pill.textContent='server stopped';pill.classList.add('off');};
  }
  document.querySelectorAll('form[data-api]').forEach(function(f){
    f.addEventListener('submit',function(e){
      e.preventDefault();
      if(location.protocol==='file:'){
        say(f,'Static build: forms cannot write. Run  node tools/wiki.ts serve  and open the printed address.','err');
        return;
      }
      var body={};
      new FormData(f).forEach(function(v,k){body[k]=(k==='revertOnFail')?(v?'1':'') : v;});
      if(!f.querySelector('[name=revertOnFail]'))body.revertOnFail='1';
      say(f,'writing, running the writers and both cages…','');
      fetch(f.dataset.api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
        .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};}).catch(function(){return{ok:r.ok,j:{message:'not json: HTTP '+r.status}};});})
        .then(function(r){show(r.j,r.ok);})
        .catch(function(err){say(f,'request failed: '+err.message,'err');});
      function show(j,ok){
        var lines=(j.log||[]).map(function(l){return (l.ok?'ok   ':'FAIL ')+l.step+(l.ok?'':' · exit '+l.code);}).join('\n');
        var errs=(j.errors||[]).map(function(e){return '· '+(e.field?e.field+': ':'')+e.msg;}).join('\n');
        var b=boxNear(f);
        if(ok&&!(j.errors&&j.errors.length)&&j.ok!==false){
          b.className='result show good';
          b.textContent=(j.message||'Written and the cages passed.')+(lines?'\n'+lines:'')+'\nreloading…';
          setTimeout(function(){location.reload();},800);
          return;
        }
        b.className='result show err';
        b.textContent=(j.reverted?'Rejected and rolled back. ':'Rejected. ')+(j.message||'')+
          (errs?'\n\n'+errs:'')+(lines?'\n\n'+lines:'')+
          (j.log&&j.log.length?'\n\n'+((j.log[j.log.length-1]||{}).out||''):'');
      }
    });
  });
  document.querySelectorAll('[data-toggle]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var t=document.getElementById(btn.dataset.toggle);
      if(t)t.classList.toggle('hide');
    });
  });
})();
`;

// ------------------------------------------------------------------ layout

function layout(o: any): string {
  const navBlocks = (o.nav || []).map((n: any) => (n.heading
    ? `<h4>${esc(n.heading)}</h4>`
    : `<a href="${n.href}"${n.current ? ' aria-current="page"' : ''}>${esc(n.text)}${n.count != null ? ` <span class="dim">${n.count}</span>` : ''}</a>`)).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)} · ModWorld wiki</title>
<style>
${CSS}
</style>
</head>
<body>
<header class="top">
<span class="brand"><b>ModWorld</b> wiki</span>
<span class="stamp">rendered ${esc(o.stamp)} · ${o.mode === 'serve' ? 'live from disk' : 'static build'}</span>
<form class="inline" onsubmit="return false"><input id="q" type="search" placeholder="filter this page (/)" aria-label="Filter this page"></form>
<span class="chips">${(o.chips || []).join('')}</span>
<span class="pill ${o.mode === 'serve' ? 'live' : 'off'}" id="pill" data-live="${o.mode === 'serve' ? 1 : 0}">${o.mode === 'serve' ? 'live · ' + esc(o.stamp) : 'static copy'}</span>
<span class="chips"><a class="chip" href="${R.index}">wiki</a><a class="chip" href="${R.dashboard}">dashboard</a><a class="chip" href="${R.about}">how it works</a></span>
</header>
<main>
<nav class="side" aria-label="Wiki">
${navBlocks}
</nav>
<div>
${breadcrumb(o.crumbs)}
<div id="filter-count" class="hint"></div>
${o.banner || ''}
${o.body}
</div>
</main>
<script>
${CLIENT}
</script>
</body>
</html>`;
}

function headerChips(state: any): string[] {
  const t = state.cages.totals;
  return [
    chip('docs', state.counts.docs),
    chip('data rows', state.counts.records),
    chip('checks', `${t.PASS}/${t.FAIL}/${t.PENDING}`, t.FAIL ? 'bad' : 'ok'),
    chip('generated blocks', state.counts.blocks),
  ];
}

function sideNav(state: any, current: any, ctx?: any): any[] {
  const nav: any[] = ([{ heading: 'Wiki' }] as any[]).concat(TOP.map(([href, text]) => ({ href, text, current: current === href })));
  if (ctx && ctx.items && ctx.items.length) nav.push({ heading: ctx.title || 'On this page' }, ...ctx.items);
  nav.push({ heading: 'Spec files' }, ...state.docs.map((d: any) => ({ href: R.doc(d.file), text: d.file, current: current === R.doc(d.file) })));
  return nav;
}

const BUILD_BANNER = `<div class="banner">Static build of the wiki — content is current as of the render stamp above, but forms cannot write from a <code>file://</code> page. Run <code>node tools/wiki.ts serve</code> and open <code>http://127.0.0.1:7777/</code> to add or edit data.</div>`;

export { R, TOP, esc, slug, chip, tag, hint, code, tbl, kv, breadcrumb, valueText, layout, sideNav, headerChips, CSS, CLIENT, BUILD_BANNER, setRawMode };
