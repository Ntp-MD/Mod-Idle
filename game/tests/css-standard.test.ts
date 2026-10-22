import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const ui = path.join(root, 'src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    return fs.statSync(file).isDirectory() ? walk(file) : [file];
  });
}

const sources = walk(ui)
  .filter((file) => file.endsWith('.svelte') || file.endsWith('.css'))
  .flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const styles = file.endsWith('.css')
      ? text
      : [...text.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join('\n');
    return [{ file, text, styles }];
  });

describe('CSS standards', () => {
  it('uses the shared dim text role instead of a local .dim class', () => {
    const broken = sources.filter(({ text, styles }) => /class="dim"/.test(text) || /\.dim\s*\{/.test(styles));
    expect(broken.map(({ file }) => path.relative(root, file))).toEqual([]);
  });

  it('uses one shared icon-label rule instead of repeating the token dimensions', () => {
    const duplicate = /width:\s*var\(--icon-label\);\s*height:\s*var\(--icon-label\);\s*(?:flex:\s*none;\s*)?object-fit:\s*contain/;
    const broken = sources.filter(({ file, styles }) => !file.endsWith('skins.css') && duplicate.test(styles));
    expect(broken.map(({ file }) => path.relative(root, file))).toEqual([]);
    expect(fs.readFileSync(path.join(ui, 'styles/skins.css'), 'utf8')).toMatch(/\.icon-label\s*\{[\s\S]*width:\s*var\(--icon-label\)/);
  });
});
