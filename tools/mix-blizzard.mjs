import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'game/public/fx/skill-pool/attack-cold/attack-blizzard');
const version = 'v6';
const destination = path.join(folder, version);
const generator = 'tools/mix-blizzard.mjs';
if (fs.existsSync(destination)) {
  assert.equal(JSON.parse(fs.readFileSync(path.join(destination, 'meta.json'), 'utf8')).generator,
    generator, `${version} belongs to another author; choose a new version`);
}
const read = version => JSON.parse(fs.readFileSync(path.join(folder, version, 'meta.json'), 'utf8'));
fs.mkdirSync(destination, { recursive: true });
const components = [
  { version: 'v3', file: 'atlas.png', opacity: .75, rainIntervalSec: .115, rainSizeScale: .48 },
  { version: 'v1', file: 'ice-rain.png', opacity: .8, rainIntervalSec: .09, rainSizeScale: .39 },
];
for (const component of components) {
  fs.copyFileSync(path.join(folder, component.version, 'atlas.png'), path.join(destination, component.file));
}
const additionalLayers = components.slice(1).map(component => ({ ...read(component.version),
  ...component, src: undefined, generator: undefined, qa: undefined,
}));
const meta = { ...read(components[0].version), ...components[0], generator, recipeModule: undefined,
  src: `/fx/skill-pool/attack-cold/attack-blizzard/${version}/atlas.png`,
  sourceVersions: components.map(component => component.version), additionalLayers,
  composition: 'v3 frost bursts and v1 falling ice; simultaneous independent Field playback',
};
fs.writeFileSync(path.join(destination, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
for (const component of components) {
  for (const name of fs.readdirSync(path.join(folder, component.version)).filter(name => name.startsWith('source-license-'))) {
    fs.copyFileSync(path.join(folder, component.version, name), path.join(destination, name));
  }
}
fs.mkdirSync(path.join(folder, 'default'), { recursive: true });
fs.writeFileSync(path.join(folder, 'default/version.json'), JSON.stringify({ version }, null, 2) + '\n');
console.log(`Blizzard ${version}: ${components.map(component => component.version).join(' + ')}; independent source atlases preserved.`);
