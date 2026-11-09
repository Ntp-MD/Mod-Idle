import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = path.resolve('src/ui/map');
const source = (file: string) => fs.readFileSync(file, 'utf8');
const parse = (file: string) => ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true);
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : entry.name.endsWith('.ts') ? [file] : [];
  });
}
function runtimeImports(file: string): string[] {
  const imports: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause, bindings = clause?.namedBindings;
      const onlyTypes = clause?.isTypeOnly || (!clause?.name && bindings && ts.isNamedImports(bindings)
        && bindings.elements.every(entry => entry.isTypeOnly));
      if (!onlyTypes) imports.push(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const name = node.arguments[0];
      imports.push(name && ts.isStringLiteral(name) ? name.text : '<dynamic import>');
    }
    ts.forEachChild(node, visit);
  }
  visit(parse(file));
  return imports;
}

describe('modular map architecture', () => {
  it('keeps contracts data-only', () => {
    const invalid = parse(path.join(root, 'map-types.ts')).statements.filter(node =>
      !ts.isInterfaceDeclaration(node) && !ts.isTypeAliasDeclaration(node)
      && !(ts.isImportDeclaration(node) && node.importClause?.isTypeOnly));
    expect(invalid.map(node => node.getText())).toEqual([]);
  });

  it('keeps engine/state queries out of the entire paint dependency graph', () => {
    const seen = new Set<string>(), violations: string[] = [];
    function visit(file: string) {
      if (seen.has(file)) return;
      seen.add(file);
      for (const specifier of runtimeImports(file)) {
        // The validated sheet index is the one explicit world-resolution boundary.
        if (file === path.join(root, 'render/map-dom.ts') && specifier === '../map-world') continue;
        if (/engine|@sim|map-view-model|map-adventure|map-world|\.svelte$|<dynamic/.test(specifier)) {
          violations.push(`${path.relative(root, file)} -> ${specifier}`);
        } else if (specifier.startsWith('.')) {
          const target = path.resolve(path.dirname(file), specifier.replace(/\.ts$/, '') + '.ts');
          if (fs.existsSync(target)) visit(target);
        }
      }
    }
    visit(path.join(root, 'map.ts'));
    files(path.join(root, 'render')).forEach(visit);
    for (const file of files(path.join(root, 'render'))) {
      function check(node: ts.Node) {
        if (ts.isIdentifier(node) && ['GameState', 'localStorage', 'indexedDB', 'setInterval', 'setTimeout', 'requestAnimationFrame'].includes(node.text)) {
          violations.push(`${path.relative(root, file)}: ${node.text}`);
        }
        ts.forEachChild(node, check);
      }
      check(parse(file));
    }
    expect(violations).toEqual([]);
  });

  it('keeps DOM access out of the state projection and pure math', () => {
    const dom = new Set(['document', 'window', 'Element', 'HTMLElement', 'SVGElement', 'DOMPoint', 'ResizeObserver']);
    const hits: string[] = [];
    for (const name of ['map-types', 'map-world', 'map-view-model', 'map-adventure', 'map-camera', 'map-projection', 'map-view-transform', 'map-content-layout']) {
      function visit(node: ts.Node) {
        if (ts.isIdentifier(node) && dom.has(node.text)) hits.push(`${name}: ${node.text}`);
        ts.forEachChild(node, visit);
      }
      visit(parse(path.join(root, name + '.ts')));
    }
    expect(hits).toEqual([]);
  });

  it('keeps content dimensions in the sizing policy instead of painters or CSS', () => {
    const painter = source(path.join(root, 'render/map-content.ts'));
    const literals = [...painter.matchAll(/\b(width|height|x|y|font-size|stroke-width)="(-?\d+(?:\.\d+)?)"/g)]
      .filter(match => Number(match[2]) !== 0).map(match => match[0]);
    expect(literals).toEqual([]);
    const css = source(path.resolve('src/styles/map.css'));
    const hardcoded = [...css.matchAll(/\.hex-(?:name|level|overflow|icon)[^{]*\{([^}]+)\}/g)]
      .flatMap(rule => rule[1].match(/\b(?:font|font-size|width|height|stroke-width|gap|line-height|transform)\s*:\s*[^;]*\d[^;]*/g) ?? []);
    expect(hardcoded).toEqual([]);
    expect(runtimeImports(path.join(root, 'render/map-content.ts'))).toContain('../map-content-layout');
  });

  it('does not retain the old nameplate/orbit/scenery paths', () => {
    const retired = ['map-name-stem', 'map-name-pointer', 'paintNames', 'map-marker-leader', 'map-scenery',
      'data-map-ground', 'orbitMapPan', 'mapBearingDegrees', 'mapTurnTo', 'mapLevelBand', 'mapMarker', 'mapGlyphHref', 'mapSpeciesGlyph', 'map-marker'];
    const hits: string[] = [];
    for (const file of [...files(root), path.resolve('src/styles/map.css')]) {
      for (const token of retired) if (source(file).includes(token)) hits.push(`${path.relative(root, file)}: ${token}`);
    }
    expect(hits).toEqual([]);
  });
});
