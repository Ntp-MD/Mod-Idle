/**
 * CSS report — finds repeated declarations and component classes that shadow the shared skins.
 *
 *   node tools/css-audit.ts
 *
 * Read-only: this is the first pass before adding a stricter gate. Geometry and map styles are
 * reported separately so a unique coordinate is not mistaken for a reusable rule.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const UI = path.join(ROOT, 'game/src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    return fs.statSync(file).isDirectory() ? walk(file) : [file];
  });
}

function styleSources(): { file: string; css: string }[] {
  const out: { file: string; css: string }[] = [];
  for (const file of walk(UI)) {
    const text = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.css')) out.push({ file, css: text });
    if (file.endsWith('.svelte')) {
      for (const match of text.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)) out.push({ file, css: match[1] });
    }
  }
  return out;
}

const sources = styleSources();
const rules: { file: string; selector: string; body: string }[] = [];
for (const { file, css } of sources) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    const body = match[2].trim().replace(/\s+/g, ' ');
    if (!selector || selector.startsWith('@') || selector.includes('%')) continue;
    rules.push({ file, selector, body });
  }
}

const byBody = new Map<string, typeof rules>();
for (const rule of rules) {
  if (rule.body.length < 30) continue;
  const group = byBody.get(rule.body);
  if (group) group.push(rule);
  else byBody.set(rule.body, [rule]);
}
const duplicates = [...byBody.entries()]
  .map(([body, rows]) => ({ body, rows }))
  .filter(({ rows }) => new Set(rows.map((row) => row.file)).size > 1)
  .sort((a, b) => b.rows.length - a.rows.length);

const skins = fs.readFileSync(path.join(UI, 'styles/skins.css'), 'utf8');
const shared = new Set(Array.from(skins.matchAll(/\.([a-zA-Z][\w-]*)/g), (match) => match[1]));
const shadows = new Map<string, Set<string>>();
for (const { file, css } of sources) {
  if (file.endsWith('styles/skins.css') || file.endsWith('styles/variables.css') || file.endsWith('styles/base.css')) continue;
  for (const match of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
    if (!shared.has(match[1])) continue;
    const files = shadows.get(match[1]) ?? new Set<string>();
    files.add(path.relative(ROOT, file));
    shadows.set(match[1], files);
  }
}

const colors = new Map<string, number>();
const pixelLiterals = new Map<string, number>();
for (const { file, css } of sources) {
  const name = path.relative(ROOT, file);
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  colors.set(name, (colors.get(name) ?? 0) + (clean.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) ?? []).length);
  pixelLiterals.set(name, (pixelLiterals.get(name) ?? 0) + (clean.match(/\b\d+(?:\.\d+)?px\b/g) ?? []).length);
}

console.log(`CSS sources: ${sources.length} · rules: ${rules.length}`);
console.log(`Exact duplicate rule bodies across files: ${duplicates.length}`);
for (const { body, rows } of duplicates.slice(0, 20)) {
  console.log(`  ${body}`);
  console.log(`    ${rows.map((row) => `${path.relative(ROOT, row.file)} ${row.selector}`).join(' | ')}`);
}
console.log(`\nComponent classes also named in skins.css: ${shadows.size}`);
for (const [name, files] of [...shadows.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 20)) {
  console.log(`  .${name}: ${[...files].join(', ')}`);
}
console.log('\nRaw colour literals by file');
for (const [file, count] of [...colors.entries()].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${count.toString().padStart(3)} ${file}`);
}
console.log('\nPixel literals by file');
for (const [file, count] of [...pixelLiterals.entries()].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${count.toString().padStart(3)} ${file}`);
}
