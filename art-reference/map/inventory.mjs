import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kit=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(kit,'../..');
const originals=JSON.parse(fs.readFileSync(path.join(kit,'source-assets.json')));
const catalogue=fs.readFileSync(path.join(root,'game/src/ui/map-terrain.ts'),'utf8');
const entries=[...catalogue.matchAll(/^\s+([a-z]+): '([^']+)'/gm)].map(m=>({key:m[1],href:m[2]}));
const footprints=JSON.parse(fs.readFileSync(path.join(root,'game/src/ui/map-terrain-footprints.json')));
const rows=originals.map(({original,stem,source,category})=>{
  if(!fs.existsSync(path.join(root,source)))throw new Error(`Missing original asset: ${source}`);
  const candidates=fs.readdirSync(path.join(root,'game/public/map',category)).filter(f=>f.endsWith('.png'));
  const versions=candidates.filter(f=>f.replace(/-\d+\.png$/,'.png')===original);
  const registered=versions.filter(f=>footprints[`/map/${category}/${f}`]);
  const keys=entries.filter(e=>path.basename(e.href).replace(/-\d+\.png$/,'.png')===original);
  return {original,stem,source,category,versions,registered,catalogue:keys,
    selectedNewVersion:keys.some(e=>e.href in footprints&&registered.includes(path.basename(e.href))),
    integrationNote:stem==='town'?'Town rendering also uses LANDMARK_ART in tools/map.ts; inspect actual renderer routing, not only the terrain catalogue.':null};
});
const report={source:'art-reference/map/source-assets.json',originalCount:rows.length,
  registeredReplacementCount:rows.filter(r=>r.registered.length).length,
  selectedInCatalogueCount:rows.filter(r=>r.selectedNewVersion).length,
  missing:rows.filter(r=>!r.registered.length).map(r=>r.original),
  limitation:'File/metadata/catalogue coverage only. Does not certify visual approval or live renderer usage; inspect per-asset evidence.',rows};
fs.writeFileSync(path.join(kit,'terrain-inventory.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Terrain coverage: ${report.registeredReplacementCount}/${report.originalCount} source images have registered replacements. Missing: ${report.missing.join(', ')||'none'}`);
