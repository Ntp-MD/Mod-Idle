'use strict';

/**
 * Shared markdown → HTML renderer for every generated view of the design layer
 * (dashboard.html and the wiki). One renderer means one rendering rule: a table
 * that reads correctly in the dashboard reads the same way in the wiki.
 *
 * mdToHtml(text, opts)          one-shot render
 * createRenderer(opts)          { inline, mdToHtml, toc } — call again for more text
 *
 * opts:
 *   shift        heading level offset (h1 in a doc becomes h{1+shift})
 *   href(file)   resolve a `file.md` reference to a page URL, or null to keep it plain
 *   idPrefix     namespace heading ids so several docs can share a page
 *   toc          array to push { level, id, text, line } into
 */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function isSeparator(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')) || c === '');
}

const BLOCK_START = /^\s*$|^[|#>]|^#{1,6}\s|^\s*[-*]\s+|^\s*\d+\.\s+|^```|^\s*-{3,}\s*$/;
const startsBlock = (l) => BLOCK_START.test(l);

function createRenderer(opts = {}) {
  const shift = opts.shift == null ? 1 : opts.shift;
  const href = opts.href || null;
  const toc = opts.toc || [];
  const used = new Set(toc.map((t) => t.id));

  function unique(base) {
    let id = base;
    let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return id;
  }

  function inline(src) {
    let out = esc(src);
    out = out.replace(/`([^`]+)`/g, (m, code) => {
      const link = code.match(/^([a-z0-9-]+\.md)$/);
      if (link && href) {
        const url = href(link[1]);
        if (url) return `<code><a href="${esc(url)}">${code}</a></code>`;
      }
      return `<code>${code}</code>`;
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, '<em>$1</em>');
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return out;
  }

  function mdToHtml(text, local = {}) {
    const sh = local.shift == null ? shift : local.shift;
    const lines = String(text).split(/\r?\n/);
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*<!-- BEGIN GENERATED:/.test(line) || /^\s*<!-- END GENERATED:/.test(line)) { i++; continue; }
      if (/^```/.test(line)) {
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out.push(`<pre class="code">${esc(buf.join('\n'))}</pre>`);
        continue;
      }
      if (line.startsWith('|')) {
        const rows = [];
        while (i < lines.length && lines[i].startsWith('|')) {
          const cells = lines[i].replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
          if (!isSeparator(cells)) rows.push(cells);
          i++;
        }
        if (!rows.length) continue;
        const head = rows[0];
        const body = rows.slice(1);
        out.push('<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
          + body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('')
          + '</tbody></table>');
        continue;
      }
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const lvl = Math.min(6, h[1].length + sh);
        const id = unique(opts.plainIds ? slug(h[2]) : `${opts.idPrefix || ''}${slug(h[2])}`);
        toc.push({ level: h[1].length, id, text: h[2].replace(/[*`_]/g, ''), line: i + 1 });
        out.push(`<h${lvl} id="${id}">${inline(h[2])}</h${lvl}>`);
        i++;
        continue;
      }
      if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
        out.push(`<blockquote>${mdToHtml(buf.join('\n'), { shift: 2 })}</blockquote>`);
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
        out.push('<ul>' + buf.map((b) => `<li>${inline(b)}</li>`).join('') + '</ul>');
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
        out.push('<ol>' + buf.map((b) => `<li>${inline(b)}</li>`).join('') + '</ol>');
        continue;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
      if (/^\s*$/.test(line)) { i++; continue; }
      const buf = [lines[i++]];
      while (i < lines.length && !startsBlock(lines[i])) buf.push(lines[i++]);
      out.push(`<p>${inline(buf.join(' '))}</p>`);
    }
    return out.join('\n');
  }

  return { inline, mdToHtml, toc };
}

function mdToHtml(text, opts = {}) {
  return createRenderer(opts).mdToHtml(text, opts);
}

/** Heading list only — used to build a page table of contents. */
function headings(text, opts = {}) {
  const r = createRenderer(Object.assign({ toc: [] }, opts));
  r.mdToHtml(text, opts);
  return r.toc;
}

/** Every `<!-- BEGIN GENERATED:key --> … <!-- END GENERATED:key -->` block in a file. */
function extractBlocks(text) {
  const out = [];
  const re = /<!-- BEGIN GENERATED:([\w-]+) -->\n([\s\S]*?)\n<!-- END GENERATED:\1 -->/g;
  let m;
  while ((m = re.exec(text))) out.push({ key: m[1], body: m[2] });
  return out;
}

function titleOf(text, fallback) {
  const line = String(text).split(/\r?\n/).find((l) => l.startsWith('# '));
  return line ? line.replace(/^#\s*/, '') : fallback;
}

function importsOf(text) {
  return String(text).split(/\r?\n/).filter((l) => /^import\s/.test(l)).map((l) => l.replace(/^import\s+/, '').trim());
}

module.exports = { esc, slug, mdToHtml, createRenderer, headings, extractBlocks, titleOf, importsOf, inline: (s) => createRenderer().inline(s) };
