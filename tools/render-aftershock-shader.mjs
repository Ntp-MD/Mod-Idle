import fs from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { ARENA_CAMERA } from '../game/src/presentation/arena-camera.ts';
import { renderAftershockFrame, FOOTPRINT_RATIO, DURATION_SEC } from './vfx/aftershock-shader.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv.find(x => /^--version=v\d+$/.test(x))?.split('=')[1] ?? 'v5';
const destination = path.join(root, 'game/public/fx/skill-pool/attack-earth/attack-aftershock', version);
const size = 384, columns = 4, frames = 16;
fs.mkdirSync(destination, { recursive: true });
if (fs.existsSync(path.join(destination, 'meta.json'))) {
  const old = JSON.parse(fs.readFileSync(path.join(destination, 'meta.json'), 'utf8'));
  if (old.generator !== 'tools/render-aftershock-shader.mjs') throw new Error(`Refusing to overwrite ${version}`);
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type), buffer = Buffer.alloc(data.length + 12);
  buffer.writeUInt32BE(data.length, 0); name.copy(buffer, 4); data.copy(buffer, 8);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  buffer.writeUInt32BE((crc ^ 0xffffffff) >>> 0, buffer.length - 4);
  return buffer;
}
function png(width, height, rgba) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(rows, y * (width * 4 + 1) + 1);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
const atlasWidth = size * columns;
const atlas = new Uint8ClampedArray(atlasWidth * atlasWidth * 4);
const qaFrames = [];
for (let frame = 0; frame < frames; frame++) {
  const data = renderAftershockFrame(size, frame / (frames - 1) * DURATION_SEC);
  let occupied = 0, perimeterAlpha = 0;
  for (let y = 0; y < size; y++) {
    const target = ((Math.floor(frame / columns) * size + y) * atlasWidth + frame % columns * size) * 4;
    atlas.set(data.subarray(y * size * 4, (y + 1) * size * 4), target);
    for (let x = 0; x < size; x++) {
      const a = data[(y * size + x) * 4 + 3];
      if (a) occupied++;
      if (x === 0 || x === size - 1 || y === 0 || y === size - 1) perimeterAlpha = Math.max(perimeterAlpha, a);
    }
  }
  if (perimeterAlpha) throw new Error(`Frame ${frame} touches tile perimeter`);
  qaFrames.push({ frame, occupiedPixels: occupied, perimeterAlpha });
}
if (!qaFrames.slice(1, -1).every(x => x.occupiedPixels > 0)) throw new Error('Empty intermediate shader frame');
const bytes = png(atlasWidth, atlasWidth, atlas);
fs.writeFileSync(path.join(destination, 'atlas.png'), bytes);
const sourceRoot = 'art-reference/VFX-Godot/ExplosionFXFree/assets/BinbunVFX_Vol2/ExplosionFX';
const meta = {
  id: 'attack.aftershock', src: `/fx/skill-pool/attack-earth/attack-aftershock/${version}/atlas.png`,
  columns, rows: 4, cellWidth: size, cellHeight: size, imageWidth: atlasWidth, imageHeight: atlasWidth,
  projection: 'ground', contentWidthRatio: FOOTPRINT_RATIO, contentHeightRatio: FOOTPRINT_RATIO,
  anchorX: .5, anchorY: .5, opening: [0, 3], loop: [0, 11], exit: [12, 15], frameMs: 90,
  delivery: 'ground', origin: 'caster', orient: false, status: 'prototype',
  generator: 'tools/render-aftershock-shader.mjs',
  sourceShaders: ['explosion_rings.gdshader', 'explosion_impact.gdshader', 'explosion_smoke.gdshader'].map(x => `${sourceRoot}/shader/${x}`),
  adaptation: 'Scalar Godot shader equations ported to JavaScript; deterministic value noise replaces FastNoiseLite. Ground-only bake, no ImageGen.',
};
fs.writeFileSync(path.join(destination, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
fs.copyFileSync(path.join(root, sourceRoot, 'license.txt'), path.join(destination, 'source-license.txt'));
fs.writeFileSync(path.join(destination, 'qa.json'), JSON.stringify({ frameCount: frames, alphaPerimeterPass: true, frames: qaFrames }, null, 2) + '\n');
const previewDir = path.join(root, 'output/aftershock-shader'); fs.mkdirSync(previewDir, { recursive: true });
const contact = new Uint8ClampedArray(atlas.length);
for (let i = 0; i < atlas.length; i += 4) {
  const alpha = atlas[i + 3] / 255;
  for (let c = 0; c < 3; c++) contact[i + c] = atlas[i + c] * alpha + [32, 38, 43][c] * (1 - alpha);
  contact[i + 3] = 255;
}
fs.writeFileSync(path.join(previewDir, 'contact.png'), png(atlasWidth, atlasWidth, contact));
const projectedWidth = 1920, projectedHeight = 1080;
const projected = new Uint8ClampedArray(projectedWidth * projectedHeight * 4);
const camera = ARENA_CAMERA.projection, determinant = camera.a * camera.d - camera.b * camera.c;
for (let y = 0; y < projectedHeight; y++) for (let x = 0; x < projectedWidth; x++) {
  const dx = x - 960, dy = y - 600;
  const wx = (camera.d * dx - camera.c * dy) / determinant;
  const wy = (-camera.b * dx + camera.a * dy) / determinant;
  const u = Math.floor((wx / (3 / FOOTPRINT_RATIO) + 1) / 2 * size);
  const v = Math.floor((wy / (3 / FOOTPRINT_RATIO) + 1) / 2 * size);
  const p = (y * projectedWidth + x) * 4;
  const grid = x % 80 === 0 || y % 80 === 0;
  const bg = grid ? [48, 57, 64] : [32, 38, 43];
  const sample = u >= 0 && v >= 0 && u < size && v < size ? ((2 * size + v) * atlasWidth + u) * 4 : -1;
  const alpha = sample < 0 ? 0 : atlas[sample + 3] / 255;
  for (let c = 0; c < 3; c++) projected[p + c] = sample < 0 ? bg[c] : atlas[sample + c] * alpha + bg[c] * (1 - alpha);
  projected[p + 3] = 255;
  if (Math.abs(Math.hypot(wx, wy) - 3) < .009) {
    projected[p] = 88; projected[p + 1] = 201; projected[p + 2] = 255;
  }
}
fs.writeFileSync(path.join(previewDir, 'projected-preview.png'), png(projectedWidth, projectedHeight, projected));
const preview = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Aftershock — shader port</title>
<style>body{margin:0;background:#171b21;color:#e5e8eb;font:16px system-ui}header{padding:16px;display:flex;gap:20px;align-items:center}canvas{width:100%;display:block}button,select,input{font:inherit}label{display:flex;align-items:center;gap:8px}</style>
<header><strong>Aftershock · Godot formula port</strong><button id="play">Pause</button><label>Time <input id="time" type="range" min="0" max="1.44" step=".01" value=".8"></label><label>View <select id="view"><option value="ground">Game camera</option><option value="top">Top down source</option></select></label><label><input id="guide" type="checkbox" checked>Skill footprint</label><output id="stamp"></output></header>
<canvas id="scene" width="1920" height="1080"></canvas><script>
const [scene,play,time,view,guide,stamp]=['scene','play','time','view','guide','stamp'].map(id=>document.getElementById(id));
const image=new Image(); image.src='data:image/png;base64,${bytes.toString('base64')}';
const ctx=scene.getContext('2d'), camera=${JSON.stringify(ARENA_CAMERA.projection)}, tile=${size}, ratio=${FOOTPRINT_RATIO};
let running=true, t=.8, previous=performance.now();
play.onclick=()=>{running=!running;play.textContent=running?'Pause':'Play'};
time.oninput=()=>{t=Number(time.value);running=false;play.textContent='Play'};
function draw(now){const elapsed=(now-previous)/1000;previous=now;if(running)t=(t+elapsed)%1.8;const f=Math.min(15,Math.floor(t/.09));
ctx.fillStyle='#20262b';ctx.fillRect(0,0,1920,1080);ctx.strokeStyle='#303940';ctx.lineWidth=1;for(let x=0;x<1920;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1080);ctx.stroke()}for(let y=0;y<1080;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1920,y);ctx.stroke()}
ctx.save();const radius=view.value==='top'?300:3;const m=view.value==='top'?{a:radius,c:0,b:0,d:radius}:{a:camera.a*radius,c:camera.c*radius,b:camera.b*radius,d:camera.d*radius};
ctx.transform(2*m.a/(ratio*tile),2*m.b/(ratio*tile),2*m.c/(ratio*tile),2*m.d/(ratio*tile),960-(m.a+m.c)/ratio,600-(m.b+m.d)/ratio);
if(image.complete)ctx.drawImage(image,(f%4)*tile,Math.floor(f/4)*tile,tile,tile,0,0,tile,tile);ctx.restore();
if(guide.checked){ctx.strokeStyle='#58c9ff';ctx.lineWidth=2;ctx.setLineDash([10,7]);ctx.beginPath();for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,x=960+m.a*Math.cos(a)+m.c*Math.sin(a),y=600+m.b*Math.cos(a)+m.d*Math.sin(a);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();ctx.setLineDash([])}
stamp.textContent=t.toFixed(2)+' s · frame '+f;time.value=Math.min(t,1.44);requestAnimationFrame(draw)}requestAnimationFrame(draw);
</script></html>`;
fs.writeFileSync(path.join(previewDir, 'preview.html'), preview);
console.log(JSON.stringify({ version, atlas: path.relative(root, destination), bytes: bytes.length, preview: 'output/aftershock-shader/preview.html', qa: '16 frames; transparent perimeter; no empty intermediate frames' }));
