import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { encodeRgba } from './vfx/png.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = JSON.parse(fs.readFileSync(path.join(root, 'tools/data/skills.json'), 'utf8')).skills;
const size = Number(process.argv.find(x => x.startsWith('--size='))?.split('=')[1] ?? 256);
if (!Number.isInteger(size) || size < 64 || size > 512) throw new Error('size must be 64..512');
const moduleArgs = process.argv.slice(2).filter(x => !x.startsWith('--'));
if (!moduleArgs.length) throw new Error('Pass one or more recipe module paths');
const reportDir = path.join(root, 'output/shader-skills'); fs.mkdirSync(reportDir, { recursive: true });
const report = [];
for (const moduleArg of moduleArgs) {
  const modulePath = path.resolve(root, moduleArg), relativeModule = path.relative(root, modulePath).replaceAll('\\', '/');
  const { recipes, licenseFiles = [] } = await import(pathToFileURL(modulePath));
  if (!Array.isArray(recipes)) throw new Error(`${moduleArg} must export recipes`);
  const contacts = [];
  for (const recipe of recipes) {
    const skill = skills.find(x => x.id === recipe.id && !x.retired);
    if (!skill) throw new Error(`Unknown active skill ${recipe.id}`);
    if (!recipe.sources?.length || recipe.sources.some(x => !fs.existsSync(path.resolve(root, x)))) throw new Error(`${recipe.id}: missing shader source`);
    const skillDir = path.join(root, 'game/public/fx/skill-pool', skill.type, recipe.id.replaceAll('.', '-').replaceAll('_', '-'));
    const dirs = fs.existsSync(skillDir) ? fs.readdirSync(skillDir).filter(x => /^v\d+$/.test(x)) : [];
    const owned = dirs.filter(v => {
      const p = path.join(skillDir, v, 'meta.json'); if (!fs.existsSync(p)) return false;
      const m = JSON.parse(fs.readFileSync(p, 'utf8')); return m.generator === 'tools/bake-shader-recipes.mjs' && m.recipeModule === relativeModule;
    });
    const version = owned.sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))[0]
      ?? recipe.version ?? `v${Math.max(0, ...dirs.map(v => Number(v.slice(1)))) + 1}`;
    if (!/^v\d+$/.test(version) || dirs.includes(version) && !owned.includes(version)) {
      throw new Error(`${recipe.id}: version ${version} is invalid or belongs to another author`);
    }
    const destination = path.join(skillDir, version); fs.mkdirSync(destination, { recursive: true });
    const width = size * 4, atlas = new Uint8ClampedArray(width * width * 4), qa = [];
    let maxWidth = 0, maxHeight = 0;
    for (let frame = 0; frame < 16; frame++) {
      const data = recipe.render(size, frame / 15 * (recipe.durationSec ?? 1.44), frame);
      if (!(data instanceof Uint8ClampedArray) || data.length !== size * size * 4) throw new Error(`${recipe.id}: invalid RGBA frame ${frame}`);
      let count = 0, minX = size, minY = size, maxX = -1, maxY = -1, edge = 0;
      for (let y = 0; y < size; y++) {
        atlas.set(data.subarray(y * size * 4, (y + 1) * size * 4), ((Math.floor(frame / 4) * size + y) * width + frame % 4 * size) * 4);
        for (let x = 0; x < size; x++) {
          const a = data[(y * size + x) * 4 + 3];
          if (a > 8) { count++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
          if (x === 0 || y === 0 || x === size - 1 || y === size - 1) edge = Math.max(edge, a);
        }
      }
      if (edge > 8) throw new Error(`${recipe.id}: frame ${frame} clips tile perimeter (alpha ${edge})`);
      if (frame >= 4 && frame <= 11 && count === 0) throw new Error(`${recipe.id}: empty active frame ${frame}`);
      maxWidth = Math.max(maxWidth, maxX - minX + 1); maxHeight = Math.max(maxHeight, maxY - minY + 1);
      qa.push({ frame, pixels: count, edgeAlpha: edge });
      if (frame === 6) {
        const contact = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] / 255;
          for (let c = 0; c < 3; c++) contact[i + c] = data[i + c] * a + [32, 38, 43][c] * (1 - a);
          contact[i + 3] = 255;
        }
        contacts.push({ id: recipe.id, name: skill.name, data: contact });
      }
    }
    const area = skill.area ?? {}, authored = {};
    for (const [from, to] of [['shape', 'shape'], ['origin', 'origin'], ['radius_m', 'radiusM'], ['length_m', 'lengthM'], ['width_m', 'widthM'], ['angle_deg', 'angleDeg']]) if (area[from] != null) authored[to] = area[from];
    if (!authored.shape) authored.shape = authored.radiusM > 0 ? 'circle' : 'single';
    if (recipe.meta?.delivery) authored.delivery = recipe.meta.delivery;
    if (recipe.meta?.projection === 'ground' && !(authored.radiusM > 0)) throw new Error(`${recipe.id}: ground circle projection requires radius`);
    const meta = {
      id: recipe.id, src: `/fx/skill-pool/${skill.type}/${path.basename(skillDir)}/${version}/atlas.png`,
      columns: 4, rows: 4, cellWidth: size, cellHeight: size, imageWidth: width, imageHeight: width,
      frameMs: 90, opening: [0, 3], loop: [4, 11], exit: [12, 15], anchorX: .5, anchorY: .5,
      contentWidthRatio: Math.max(.05, maxWidth / size), contentHeightRatio: Math.max(.05, maxHeight / size),
      ...recipe.meta, authoringGeometry: { ...authored, ...recipe.meta?.authoringGeometry },
      generator: 'tools/bake-shader-recipes.mjs', recipeModule: relativeModule,
      sourceShaders: recipe.sources, status: 'prototype',
      adaptation: recipe.adaptation ?? 'Godot shader mask/noise/decay equations adapted to deterministic offline JavaScript raster frames.',
    };
    const bytes = encodeRgba(width, width, atlas); fs.writeFileSync(path.join(destination, 'atlas.png'), bytes);
    const metaText = JSON.stringify(meta, null, 2) + '\n'; fs.writeFileSync(path.join(destination, 'meta.json'), metaText);
    fs.writeFileSync(path.join(destination, 'qa.json'), JSON.stringify({ frameCount: 16, alphaPerimeterPass: true, atlasSha256: createHash('sha256').update(bytes).digest('hex'), frames: qa }, null, 2) + '\n');
    const sourceLicenses = new Set([...(recipe.licenseFiles ?? []), ...licenseFiles]);
    for (const source of recipe.sources) {
      let parent = path.dirname(path.resolve(root, source));
      const boundary = path.join(root, 'art-reference/VFX-Godot');
      while (parent.startsWith(boundary + path.sep)) {
        for (const name of ['license.txt', 'LICENSE.md', 'LICENSE']) {
          const candidate = path.join(parent, name);
          if (fs.existsSync(candidate)) sourceLicenses.add(path.relative(root, candidate).replaceAll('\\', '/'));
        }
        parent = path.dirname(parent);
      }
    }
    for (const license of sourceLicenses) {
      if (!fs.existsSync(path.resolve(root, license))) throw new Error(`Missing license ${license}`);
      const pack = license.replaceAll('\\', '/').split('/')[2];
      fs.copyFileSync(path.resolve(root, license), path.join(destination, `source-license-${pack}-${path.basename(license)}`));
    }
    report.push({ id: recipe.id, kind: recipe.kind, version, src: meta.src, projection: meta.projection ?? 'upright', bytes: bytes.length, name: skill.name, recipeModule: relativeModule });
    console.log(`${recipe.id} -> ${version} (${bytes.length} bytes)`);
  }
  const contactWidth = size * 4, contactHeight = size * Math.ceil(contacts.length / 4);
  const pixels = new Uint8ClampedArray(contactWidth * contactHeight * 4);
  contacts.forEach((item, n) => { for (let y = 0; y < size; y++) pixels.set(item.data.subarray(y * size * 4, (y + 1) * size * 4), ((Math.floor(n / 4) * size + y) * contactWidth + n % 4 * size) * 4); });
  const family = path.basename(modulePath, '.mjs');
  fs.writeFileSync(path.join(reportDir, `${family}-contact.png`), encodeRgba(contactWidth, contactHeight, pixels));
  fs.writeFileSync(path.join(reportDir, `${family}-report.json`), JSON.stringify(report.filter(x => x.recipeModule === relativeModule), null, 2) + '\n');
}
console.log(`Baked ${report.length} prototypes; defaults unchanged. Reports: output/shader-skills/`);
