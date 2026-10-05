import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const artDir = dirname(fileURLToPath(import.meta.url));
const svgDir = join(artDir, 'svg');
const libDir = join(artDir, 'svg-lib');
const cacheDir = join(artDir, 'preview-cache');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name.endsWith('.svg')) files.push(full);
  }
  return files;
}

await rm(cacheDir, { recursive: true, force: true });

async function buildTree(dir, prefix) {
  const files = (await walk(dir)).sort();
  const root = { name: '', dir: '', children: new Map(), items: [] };
  let patched = 0;

  for (const file of files) {
    const rel = relative(dir, file).split(sep).join('/');
    const segments = rel.split('/');
    const name = segments.pop().replace(/\.svg$/, '');
    let node = root;
    for (const segment of segments) {
      if (!node.children.has(segment)) {
        node.children.set(segment, { name: segment, dir: segment, children: new Map(), items: [] });
      }
      node = node.children.get(segment);
    }

    const source = await readFile(file, 'utf8');
    let src = `${prefix}/${rel}`;
    if (source.includes('currentColor')) {
      const target = join(cacheDir, prefix, rel);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source.replaceAll('currentColor', '#ffffff'));
      src = `preview-cache/${prefix}/${rel}`;
      patched += 1;
    }
    node.items.push({ name, path: rel, src });
  }

  let folderCount = 0;
  function freeze(node) {
    folderCount += 1;
    return {
      name: node.name,
      dir: node.dir,
      count: countOf(node),
      items: node.items,
      children: [...node.children.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(freeze),
    };
  }

  function countOf(node) {
    return node.items.length + [...node.children.values()].reduce((sum, child) => sum + countOf(child), 0);
  }

  const tree = [...root.children.values()].sort((a, b) => b.name.localeCompare(a.name)).map(freeze);
  return { tree, total: files.length, folders: folderCount, patched };
}

const shipped = await buildTree(svgDir, 'svg');
const lib = await buildTree(libDir, 'svg-lib').catch(() => null);

const manifest = {
  total: shipped.total,
  folders: shipped.folders,
  budget: 500,
  tree: shipped.tree,
  lib: lib && { total: lib.total, folders: lib.folders, tree: lib.tree },
};

const template = await readFile(join(artDir, 'preview.template.html'), 'utf8');
const html = template.replace('/*__MANIFEST__*/', JSON.stringify(manifest).replaceAll('<', '\\u003c'));
await writeFile(join(artDir, 'preview.html'), html);

console.log(
  `shipped ${shipped.total} icons / ${shipped.folders} folders`
    + (lib ? `, lib ${lib.total} (hidden)` : '')
    + ` -> art/preview.html, ${shipped.patched} recolored`,
);