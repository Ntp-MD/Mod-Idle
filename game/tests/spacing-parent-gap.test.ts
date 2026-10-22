import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const gameRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function uiStyles(): Array<{ file: string; css: string }> {
  const sources: Array<{ file: string; css: string }> = [];
  for (const file of walk(resolve(gameRoot, 'src'))) {
    const source = readFileSync(file, 'utf8');
    if (file.endsWith('.css')) sources.push({ file, css: source });
    if (file.endsWith('.svelte')) {
      for (const match of source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)) {
        sources.push({ file, css: match[1] });
      }
    }
  }

  for (const file of [
    resolve(gameRoot, 'src/wiki/pages.ts'),
    resolve(gameRoot, 'src/wiki/icons-gallery.ts'),
    resolve(gameRoot, '../tools/gallery.ts'),
  ]) {
    sources.push({ file, css: readFileSync(file, 'utf8') });
  }
  return sources;
}

describe('UI spacing ownership', () => {
  it('uses parent gaps instead of nonzero child margins for layout spacing', () => {
    const findings = uiStyles().flatMap(({ file, css }) => {
      const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
      return Array.from(clean.matchAll(/(?:^|[;{])\s*margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?\s*:\s*([^;}]+)/gim))
        .map((match) => ({ file, line: clean.slice(0, match.index).split('\n').length, value: match[1].trim().replace(/\s*!important$/i, '') }))
        // `auto` is alignment, not spacing: it pushes a flex child to the free space (the panel head's
        // close button, a help block pinned to the bottom) and has no parent-gap equivalent, so it is
        // not what this rule owns.
        .filter(({ value }) => !value.split(/\s+/).every((token) => /^0(?:px|rem|em|%)?$/i.test(token) || /^auto$/i.test(token)));
    });

    expect(findings).toEqual([]);
  });
});
