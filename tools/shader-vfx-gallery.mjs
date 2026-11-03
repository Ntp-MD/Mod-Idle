import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ARENA_CAMERA } from '../game/src/presentation/arena-camera.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'output/shader-skills');
const skills = JSON.parse(fs.readFileSync(path.join(root, 'tools/data/skills.json'), 'utf8')).skills.filter(skill => !skill.retired);
const rows = fs.readdirSync(directory).filter(file => file.endsWith('-report.json')).sort().flatMap(file =>
  JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')).map(row => ({ ...row, family: file.replace('-shaders-report.json', '') })));
const aftershock = 'game/public/fx/skill-pool/attack-earth/attack-aftershock/v5/meta.json';
if (fs.existsSync(path.join(root, aftershock))) {
  const meta = JSON.parse(fs.readFileSync(path.join(root, aftershock), 'utf8'));
  rows.push({ id: meta.id, name: skills.find(skill => skill.id === meta.id)?.name, version: 'v5', src: meta.src, projection: meta.projection, family: 'earth', kind: 'ground' });
}
assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'Each skill must appear once');
assert.deepEqual(rows.map(row => row.id).sort(), skills.map(skill => skill.id).sort(), 'Gallery must cover the complete active roster');
for (const row of rows) {
  const atlasPath = path.join(root, 'game/public', row.src);
  assert.ok(fs.existsSync(atlasPath), `${row.id}: missing atlas`);
  row.meta = JSON.parse(fs.readFileSync(path.join(path.dirname(atlasPath), 'meta.json'), 'utf8'));
  assert.equal(row.meta.id, row.id);
  assert.equal(row.meta.columns * row.meta.rows, 16, `${row.id}: expected sixteen authored frames`);
  if (row.projection === 'ground') {
    assert.equal(row.meta.contentWidthRatio, row.meta.contentHeightRatio, `${row.id}: ground circle must have equal ratios`);
    assert.equal(row.meta.cellWidth, row.meta.cellHeight);
  }
  row.url = `../../game/public${row.src}`;
}
rows.sort((a, b) => a.family.localeCompare(b.family) || a.id.localeCompare(b.id));
const data = JSON.stringify(rows).replaceAll('<', '\\u003c');
const camera = JSON.stringify(ARENA_CAMERA.projection);
const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,">
<title>ModWorld shader VFX prototypes</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#13191e;color:#e1e9ed;font:15px system-ui,sans-serif}header{padding:24px 28px 12px;max-width:1350px}h1{font-size:25px;margin:0 0 12px}p{line-height:1.5;max-width:1000px;color:#aebdc8}a{color:#9ad7ff}button,input,select{font:inherit;background:#26343e;color:inherit;border:1px solid #5d7382;border-radius:5px;padding:7px}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #9ad7ff;outline-offset:2px}label{display:inline-flex;align-items:center;gap:8px}nav{position:sticky;top:0;background:#182128f2;z-index:1;padding:14px 28px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;border-block:1px solid #354550}#search{width:245px}#frame{width:180px}#cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding:24px 28px}article{border:1px solid #354550;background:#1a232b;border-radius:8px;overflow:hidden}article[hidden]{display:none}h2{font-size:17px;margin:14px 16px 4px}small,.details{display:block;font-size:12px;line-height:1.5;color:#aebdc8;margin:0 16px 12px}.stage{display:block;width:100%;height:auto;aspect-ratio:1;background:repeating-conic-gradient(#202c35 0% 25%,#24313b 0% 50%) 50% / 24px 24px}.sources{margin:0 16px 16px;font-size:12px}.load-error{color:#ffb1a0}#count{font-size:13px;color:#b8c9d5}
</style>
<header><h1>ModWorld · Shader VFX prototypes</h1>
<p>${rows.length} skills. These PNG atlases adapt scalar equations from the supplied Godot shaders using deterministic CPU rasterization. They are <strong>prototypes, not Godot scene renders</strong>; particle meshes, lighting and some noise differ from the original packs.</p>
<p>This gallery previews authored frames and the canonical ground camera matrix. It does <strong>not</strong> prove in-game hit timing, rain composition, targeting, scale, or aura activation. Inspect those in <a href="http://localhost:5173/__showcase#showcase-field">the game showcase</a>. Ground previews fit one source cell into the card; sizes across cards do not represent skill range.</p></header>
<nav aria-label="Preview controls">
<label>Find <input id="search" type="search" placeholder="Skill name or ID"></label>
<label>Family <select id="family"><option value="">All families</option>${[...new Set(rows.map(row => row.family))].map(family => `<option>${family}</option>`).join('')}</select></label>
<label>View <select id="mode"><option value="projected">Camera ground projection</option><option value="source">Source frame</option></select></label>
<button id="play" type="button" aria-pressed="true">Pause</button>
<label>Frame <input id="frame" type="range" min="0" max="15" value="6" step="1"><output id="frame-label">6 / 15</output></label>
<span id="count" role="status"></span>
</nav><main id="cards"></main>
<script>
const rows=${data};
const basis=${camera};
const cards=document.getElementById('cards'), search=document.getElementById('search'), family=document.getElementById('family'), mode=document.getElementById('mode'), play=document.getElementById('play'), slider=document.getElementById('frame'), frameLabel=document.getElementById('frame-label'), count=document.getElementById('count');
const visible=new Set(), entries=new Map();
let frame=6, playing=!matchMedia('(prefers-reduced-motion: reduce)').matches, last=0;
function draw(entry){
  const {canvas,image,row}=entry, ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,320,320);
  if(!image?.complete || !image.naturalWidth)return;
  const meta=row.meta, ground=row.projection==='ground' && mode.value==='projected';
  ctx.save();ctx.translate(160,160);
  if(ground){
    // Uniform normalization preserves the canonical skew/tilt and fits the whole source cell.
    const extent=Math.max(Math.abs(basis.a)+Math.abs(basis.c),Math.abs(basis.b)+Math.abs(basis.d));
    const fit=260/extent;
    ctx.transform(basis.a*fit,basis.b*fit,basis.c*fit,basis.d*fit,0,0);
    ctx.drawImage(image,frame%meta.columns*meta.cellWidth,Math.floor(frame/meta.columns)*meta.cellHeight,meta.cellWidth,meta.cellHeight,-.5,-.5,1,1);
    ctx.beginPath();ctx.arc(0,0,(meta.contentWidthRatio??1)*.5,0,Math.PI*2);ctx.strokeStyle='#91d9e8';ctx.lineWidth=.004;ctx.setLineDash([.015,.012]);ctx.stroke();
  }else{
    ctx.drawImage(image,frame%meta.columns*meta.cellWidth,Math.floor(frame/meta.columns)*meta.cellHeight,meta.cellWidth,meta.cellHeight,-140,-140,280,280);
  }
  ctx.restore();
}
function load(entry){
  if(entry.image)return;
  entry.image=new Image();entry.image.decoding='async';
  entry.image.onload=()=>draw(entry);
  entry.image.onerror=()=>{entry.note.textContent='Atlas failed to load: '+entry.row.url;entry.note.classList.add('load-error');};
  entry.image.src=entry.row.url;
}
const observer=new IntersectionObserver(changes=>{for(const item of changes){const entry=entries.get(item.target);if(item.isIntersecting&&!item.target.hidden){visible.add(entry);load(entry);draw(entry);}else visible.delete(entry);}}, {rootMargin:'0px'});
for(const row of rows){
  const article=document.createElement('article'), title=document.createElement('h2'), detail=document.createElement('small'), canvas=document.createElement('canvas'), note=document.createElement('p'), sources=document.createElement('div');
  title.textContent=row.name+' · '+row.version;detail.textContent=row.id+' / '+row.family;
  canvas.width=320;canvas.height=320;canvas.className='stage';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',row.name+' VFX animated frame preview');
  note.className='details';note.textContent=row.projection==='ground'?'Ground · dashed guide = authored footprint':'Upright · screen facing; source orientation';
  sources.className='sources';
  const atlasLink=document.createElement('a');atlasLink.href=row.url;atlasLink.textContent='Atlas';sources.append(atlasLink);
  const metaLink=document.createElement('a');metaLink.href=row.url.replace(/atlas[^/]*\\.png$/,'meta.json');metaLink.textContent='Metadata';sources.append(' · ',metaLink);
  const entry={row,canvas,note,image:null};entries.set(article,entry);article.append(title,detail,canvas,note,sources);cards.append(article);observer.observe(article);
}
function redraw(){for(const entry of visible)draw(entry);}
function filter(){
  const query=search.value.toLowerCase().trim();let matches=0;
  for(const [article,entry]of entries){article.hidden=!!((family.value&&entry.row.family!==family.value)||!((entry.row.name+' '+entry.row.id+' '+entry.row.family).toLowerCase().includes(query)));if(article.hidden)visible.delete(entry);else matches++;observer.unobserve(article);observer.observe(article);}
  count.textContent=matches+' / '+rows.length+' skills';redraw();
}
function updatePlay(){play.textContent=playing?'Pause':'Play';play.setAttribute('aria-pressed',String(playing));}
function setFrame(value){frame=value;slider.value=String(frame);frameLabel.value=frame+' / 15';redraw();}
search.addEventListener('input',filter);family.addEventListener('change',filter);mode.addEventListener('change',redraw);
play.addEventListener('click',()=>{playing=!playing;last=0;updatePlay();});
slider.addEventListener('input',()=>{playing=false;updatePlay();setFrame(Number(slider.value));});
function animate(now){if(playing&&!document.hidden&&now-last>=90){last=now;setFrame((frame+1)%16);}requestAnimationFrame(animate);}
filter();updatePlay();requestAnimationFrame(animate);
</script></html>`;
fs.writeFileSync(path.join(directory, 'index.html'), html);
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.equal(scripts.length, 1);
new Function(scripts[0]);
console.log(`Gallery: ${rows.length} active skills, ${Object.keys(ARENA_CAMERA.projection).length}-component canonical projection; embedded JavaScript syntax passed.`);
