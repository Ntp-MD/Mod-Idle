import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const draftDir = dirname(fileURLToPath(import.meta.url));
const templatePath = join(draftDir, 'preview.template.html');
const outPath = join(draftDir, 'preview.html');
const cacheDir = join(draftDir, 'preview-cache');

// The harness itself is never a preview target.
const SELF = new Set(['build-preview.mjs', 'preview.template.html', 'preview.html', 'preview-cache']);

const KINDS = new Map([
  ['.html', 'page'],
  ['.htm', 'page'],
  ['.svg', 'image'],
  ['.png', 'image'],
  ['.jpg', 'image'],
  ['.jpeg', 'image'],
  ['.webp', 'image'],
  ['.gif', 'image'],
  ['.md', 'text'],
  ['.txt', 'text'],
  ['.json', 'text'],
  ['.css', 'text'],
  ['.js', 'text'],
  ['.ts', 'text'],
]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function inline(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

// Enough markdown to read a spec in the viewer: headings, fences, tables, lists, quotes.
function renderMarkdown(source) {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const out = [];
  let fence = false;
  let list = null;
  let table = null;

  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const closeTable = () => {
    if (table) out.push('</tbody></table>');
    table = null;
  };
  const cell = (line) => line.trim().replaceAll('|', '</td><td>').replace(/^\s*\|/, '');

  for (const line of lines) {
    const fenceMatch = /^```(\w*)\s*$/.exec(line);
    if (fenceMatch) {
      closeList();
      closeTable();
      out.push(fence ? '</code></pre>' : `<pre data-lang="${escapeHtml(fenceMatch[1])}"><code>`);
      fence = !fence;
      continue;
    }
    if (fence) {
      out.push(`${escapeHtml(line)}\n`);
      continue;
    }

    const row = /^\s*\|.*\|\s*$/.test(line);
    const isDivider = row && /^[\s|:-]+$/.test(line);
    if (row && !isDivider) {
      closeList();
      if (!table) {
        out.push('<table><thead><tr><th>');
        out.push(`${cell(line)}</th></tr></thead><tbody>`);
        table = true;
      } else {
        out.push(`<tr><td>${cell(line)}</td></tr>`);
      }
      continue;
    }
    closeTable();

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(6, heading[1].length + 2);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      const want = bullet ? 'ul' : 'ol';
      if (list !== want) {
        closeList();
        out.push(`<${want}>`);
        list = want;
      }
      out.push(`<li>${inline((bullet ?? ordered)[1])}</li>`);
      continue;
    }
    closeList();

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push('<hr>');
      continue;
    }
    if (line.trim() === '') continue;
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  closeTable();
  if (fence) out.push('</code></pre>');
  return out.join('\n');
}

async function build() {
  await rm(cacheDir, { recursive: true, force: true });

  const files = (await walk(draftDir))
    .map((file) => ({ file, rel: relative(draftDir, file).split(sep).join('/') }))
    .filter(({ file, rel }) => {
      const name = rel.split('/').pop();
      if (name.startsWith('.') || SELF.has(name) || name.startsWith('~')) return false;
      return KINDS.has(extname(name).toLowerCase());
    })
    .sort((a, b) => a.rel.localeCompare(b.rel));

  const root = { name: '', dir: '', children: new Map(), items: [] };
  let bytes = 0;

  for (const { file, rel } of files) {
    const segments = rel.split('/');
    const name = segments.pop();
    let node = root;
    for (const segment of segments) {
      if (!node.children.has(segment)) {
        node.children.set(segment, { name: segment, dir: segment, children: new Map(), items: [] });
      }
      node = node.children.get(segment);
    }

    const kind = KINDS.get(extname(name).toLowerCase());
    const source = await readFile(file, 'utf8');
    bytes += Buffer.byteLength(source);
    const item = { name, path: rel, kind, src: `./${rel}`, size: Buffer.byteLength(source) };

    if (kind === 'text') {
      const target = join(cacheDir, rel);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, extname(name).toLowerCase() === '.md' ? renderMarkdown(source) : escapeHtml(source));
      item.rendered = `./preview-cache/${rel}`;
    }

    node.items.push(item);
  }

  function countOf(node) {
    return node.items.length + [...node.children.values()].reduce((sum, child) => sum + countOf(child), 0);
  }
  function freeze(node) {
    return {
      name: node.name,
      dir: node.dir,
      count: countOf(node),
      items: node.items,
      children: [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name)).map(freeze),
    };
  }

  const manifest = {
    total: files.length,
    bytes,
    tree: [...root.children.values()].sort((a, b) => b.name.localeCompare(a.name)).map(freeze),
  };

  const template = await readFile(templatePath, 'utf8');
  const html = template.replace('/*__MANIFEST__*/', JSON.stringify(manifest).replaceAll('<', '\\u003c'));
  await writeFile(outPath, html);

  console.log(`draft ${manifest.total} files / ${(bytes / 1024).toFixed(1)} kB -> draft/preview.html`);
  return manifest;
}

function serve(port) {
  const types = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.webp', 'image/webp'],
    ['.gif', 'image/gif'],
    ['.md', 'text/markdown; charset=utf-8'],
    ['.txt', 'text/plain; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.ts', 'text/plain; charset=utf-8'],
  ]);

  createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'preview.html';
    const target = resolve(draftDir, rel);
    // Loopback-only static server rooted at draft/ — it never reaches the game client.
    if (target !== draftDir && !target.startsWith(draftDir + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    try {
      const body = await readFile(target);
      res.writeHead(200, {
        'content-type': types.get(extname(target).toLowerCase()) ?? 'application/octet-stream',
        'cache-control': 'no-store',
      }).end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
    }
  }).listen(port, '127.0.0.1', () => {
    console.log(`draft preview on http://127.0.0.1:${port}/preview.html`);
  });
}

const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const port = Number(portArg?.slice('--port='.length) ?? 5180);
await build();
if (process.argv.includes('--serve')) serve(port);
else console.log(`open draft/preview.html in a browser, or run with --serve (default port ${port})`);