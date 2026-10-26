import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const kit = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(kit, '../..');
const names = process.argv.slice(2);
if (!names.length) throw new Error('Usage: node art-reference/map/check-placement.mjs snow-1 [grass-1 ...]');
const footprints = JSON.parse(fs.readFileSync(path.join(root, 'game/src/ui/map/data/map-terrain-footprints.json')));
const svg = fs.readFileSync(path.join(root, 'game/src/icon/map/map-overlay.svg'), 'utf8');
const guide = svg.match(/class="hex-calibration"[^>]*><polygon points="([^"]+)"/);
assert.ok(guide, 'Generated map has no footprint guide');
const target = guide[1].split(' ').map(p => p.split(',').map(Number));
const width = Math.max(...target.map(p => p[0])) - Math.min(...target.map(p => p[0]));
const apply = (m,p) => [m[0]*p[0]+m[2]*p[1]+m[4], m[1]*p[0]+m[3]*p[1]+m[5]];
const digest = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for (const name of names) {
  assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a simple asset stem, without a path or extension');
  const matches = Object.keys(footprints).filter(href => path.basename(href) === `${name}.png`);
  assert.equal(matches.length, 1, `Expected one registered asset for ${name}`);
  const href = matches[0], r = footprints[href];
  assert.ok(r, `No registered metadata: ${href}`);
  const installed = path.join(root, 'game/public', href.slice(1));
  const candidate = path.join(kit, 'outputs', `${name}.png`);
  const png = fs.readFileSync(installed);
  assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), r.width, 'Metadata width differs from PNG');
  assert.equal(png.readUInt32BE(20), r.height, 'Metadata height differs from PNG');
  assert.equal(digest(installed), digest(candidate), 'Installed file differs from generated candidate');
  const id = 'terrain-' + href.replace(/[^a-z0-9-]/gi, '-');
  const sectors = [...svg.matchAll(/<use data-sector="(\d)" href="#([^"]+)" transform="matrix\(([^)]+)\)"/g)]
    .filter(m => m[2] === `${id}-texture`).sort((a,b) => Number(a[1])-Number(b[1]));
  assert.equal(sectors.length, 6, 'Registration needs six sectors');
  const matrices = sectors.map(m => m[3].split(' ').map(Number));
  const source = r.vertices.map(([x,y]) => [x/r.width,y/r.height]);
  const center = source.reduce((p,q) => [p[0]+q[0]/6,p[1]+q[1]/6], [0,0]);
  const errors = [];
  for (let i=0;i<6;i++) {
    const j=(i+1)%6;
    for (const [p,q] of [[source[i],target[i]],[source[j],target[j]],[center,[0,0]]]) {
      const v=apply(matrices[i],p);
      errors.push(Math.hypot(v[0]-q[0],v[1]-q[1]));
    }
    for (const t of [0,.25,.5,.75,1]) {
      const p=[center[0]*(1-t)+source[j][0]*t,center[1]*(1-t)+source[j][1]*t];
      const a=apply(matrices[i],p), b=apply(matrices[j],p);
      assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-10, 'Internal sectors do not share an edge');
    }
  }
  const error=Math.max(...errors);
  assert.ok(Number.isFinite(error) && error<1e-10, 'Ground vertex registration differs');
  const instances=[...svg.matchAll(/data-art-href="([^"]+)"/g)].filter(m=>m[1]===href).length;
  assert.ok(instances>0, 'Selected asset is not used in the generated map');
  const report={asset:href,instances,source:r,maxMapUnitError:error,maxErrorAt1024:error/width*1024,
    checks:{sixVertices:true,center:true,sharedEdges:true,actualPngDimensions:true,installedCopyUnmodified:true},
    limitation:'Control-point registration only; inspect pixel edges, object perspective and appearance in the live map separately.'};
  fs.writeFileSync(path.join(kit,'outputs',`${name}.registration.json`),JSON.stringify(report,null,2)+'\n');
  console.log(`${name}: ${instances} instances; max vertex error ${report.maxErrorAt1024.toExponential(3)} px at width 1024`);
}
