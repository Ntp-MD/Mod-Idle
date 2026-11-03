import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The project's module layering, enforced as tests.
 *
 * Each rule is a direction that must not exist, not a style preference: a violation is what turns
 * the simulation into something the view, the save file or Node can bend. Value imports only — a
 * `import type` carries no runtime edge and is allowed wherever the type is owned.
 */

const gameRoot = path.resolve(import.meta.dirname, '../..');
const src = path.join(gameRoot, 'src');
const repo = path.resolve(gameRoot, '..');

function walk(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    return fs.statSync(file).isDirectory() ? walk(file) : [file];
  });
}

/** Every module specifier a file imports, with type-only specifiers dropped. */
function valueImports(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const specs: string[] = [];
  for (const match of text.matchAll(/import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const clause = match[1];
    if (/^type\s/.test(clause.trim())) continue;
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named) {
      const values = named[1].split(',').map((part) => part.trim()).filter((part) => part && !/^type\s/.test(part));
      const rest = clause.replace(named[0], '').replace(/,\s*$/, '').trim();
      if (!values.length && !rest) continue;
    }
    specs.push(match[2]);
  }
  for (const match of text.matchAll(/export\s*\{[^}]*\}\s*from\s*['"]([^'"]+)['"]/g)) specs.push(match[1]);
  return specs;
}

const ALIASES: [string, string][] = [
  ['@engine/', path.join(repo, 'engine')],
  ['@sim/', path.join(src, 'sim')],
];

function resolve(file: string, spec: string): string | null {
  const alias = ALIASES.find(([prefix]) => spec.startsWith(prefix));
  if (alias) {
    const abs = path.resolve(alias[1], spec.slice(alias[0].length));
    return abs.replace(/\\/g, '/').replace(/\.(ts|svelte|js)$/, '').replace(/\/index$/, '');
  }
  if (spec.startsWith('.')) {
    const abs = path.resolve(path.dirname(file), spec);
    return abs.replace(/\\/g, '/').replace(/\.(ts|svelte|js)$/, '').replace(/\/index$/, '');
  }
  // a bare specifier stays as written instead of being dropped: the layer rules below must
  // see a Node builtin (`node:fs`, `fs`) to refuse it — a null here would blind the check
  return spec;
}

function moduleIds() {
  return walk(src)
    .filter((file) => /\.(ts|svelte)$/.test(file))
    .map((file) => ({
      file,
      id: file.replace(/\\/g, '/').replace(/\.(ts|svelte)$/, ''),
      imports: valueImports(file)
        .map((spec) => resolve(file, spec))
        .filter((target): target is string => !!target),
    }));
}

const modules = moduleIds();
const under = (id: string, prefix: string) => id.startsWith(`${src.replace(/\\/g, '/')}/${prefix}/`);

function violations(from: (id: string) => boolean, to: (id: string) => boolean) {
  return modules
    .filter((module) => from(module.id))
    .flatMap((module) => module.imports
      .filter((target) => to(target))
      .map((target) => `${path.relative(repo, module.file).replace(/\\/g, '/')} -> ${path.relative(repo, target).replace(/\\/g, '/')}`));
}

describe('simulation layering', () => {
  it('never imports the view, the save layer or the app shell', () => {
    const found = [
      ...violations((id) => under(id, 'sim'), (id) => under(id, 'ui')),
      ...violations((id) => under(id, 'sim'), (id) => under(id, 'state')),
      ...violations((id) => under(id, 'sim'), (id) => under(id, 'app')),
    ];
    expect(found).toEqual([]);
  });

  it('touches presentation only through the pure camera math', () => {
    const presentation = path.join(src, 'presentation').replace(/\\/g, '/');
    const found = modules
      .filter((module) => under(module.id, 'sim'))
      .flatMap((module) => module.imports
        .filter((target) => target.startsWith(`${presentation}/`))
        .filter((target) => target !== `${presentation}/arena-camera`)
        .map((target) => `${path.relative(repo, module.file).replace(/\\/g, '/')} -> ${path.relative(repo, target).replace(/\\/g, '/')}`));
    expect(found).toEqual([]);
  });

  it('never reaches for a Node builtin, so the tick runs unchanged in the browser', () => {
    const found = modules
      .filter((module) => under(module.id, 'sim'))
      .flatMap((module) => module.imports
        .filter((target) => /(^|\/)node:/.test(target) || /(^|\/)(fs|path|crypto|child_process)$/.test(target))
        .map((target) => `${path.relative(repo, module.file).replace(/\\/g, '/')} -> ${target}`));
    expect(found).toEqual([]);
  });
});

describe('shared math layering', () => {
  it('never imports the game', () => {
    const engineFiles = walk(path.join(repo, 'engine'))
      .filter((file) => file.endsWith('.ts'))
      .map((file) => ({ file, imports: valueImports(file) }));
    const found = engineFiles.flatMap(({ file, imports }) => imports
      .filter((spec) => spec.startsWith('.'))
      .map((spec) => path.resolve(path.dirname(file), spec).replace(/\\/g, '/'))
      .filter((target) => target.includes('/game/'))
      .map((target) => `${path.relative(repo, file).replace(/\\/g, '/')} -> ${target}`));
    expect(found).toEqual([]);
  });
});

describe('persistence layering', () => {
  it('never imports the view or the app shell', () => {
    const found = [
      ...violations((id) => under(id, 'state'), (id) => under(id, 'ui')),
      ...violations((id) => under(id, 'state'), (id) => under(id, 'app')),
    ];
    expect(found).toEqual([]);
  });
});

describe('the tick stages', () => {
  it('never import the tick facade, so a stage cannot form a cycle with it', () => {
    const tick = path.join(src, 'sim', 'core', 'tick').replace(/\\/g, '/');
    const facade = path.join(src, 'sim', 'core', 'game').replace(/\\/g, '/');
    const found = modules
      .filter((module) => module.id.startsWith(`${tick}/`))
      .filter((module) => module.imports.includes(facade))
      .map((module) => path.relative(repo, module.file).replace(/\\/g, '/'));
    expect(found).toEqual([]);
  });
});

describe('the data bridge', () => {
  const client = path.join(src, 'engine', 'client.ts');

  it('is the only module allowed to instantiate the engine over the JSON sources', () => {
    const instantiators = walk(src)
      .filter((file) => /\.(ts|svelte)$/.test(file))
      .filter((file) => /\bcreateEngine\(/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(repo, file).replace(/\\/g, '/'));
    expect(instantiators).toEqual(['game/src/engine/client.ts']);
  });

  it('imports the simulation once, and only for the keystone handler seam', () => {
    const simImports = valueImports(client).filter((spec) => spec.includes('/sim/') || spec.startsWith('@sim/'));
    expect(simImports).toEqual(['../sim/core/keystone-runtime.ts']);
  });
});
