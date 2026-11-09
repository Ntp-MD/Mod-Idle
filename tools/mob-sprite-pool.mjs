import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pool = join(root, 'game/public/combat/mob-pool');
const output = join(root, 'game/src/ui/combat/arena/mob-pool.generated.json');
const data = JSON.parse(readFileSync(join(root, 'tools/data/engine.json'), 'utf8'));
const races = new Map(data.mob.species.map(({ id, race }) => [id, race]));
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const directories = path => readdirSync(path, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
const result = { player: active(join(root, 'game/public/combat/arpg/player/pawn')), species: {}, variants: {} };

function active(path) {
  const { version } = readJson(join(path, 'default/version.json'));
  if (typeof version !== 'string' || !/^v[1-9]\d*$/.test(version)) throw new Error(`Invalid version at ${path}`);
  const dir = join(path, version);
  const metadata = readJson(join(dir, 'meta.json'));
  if (!existsSync(join(dir, 'atlas.png'))) throw new Error(`Missing atlas at ${dir}`);
  if (!metadata.sourceCanvas || !metadata.frameCanvas || !metadata.anchor) throw new Error(`Incomplete metadata at ${dir}`);
  const href = '/' + dir.slice(join(root, 'game/public').length + 1).replaceAll('\\', '/') + '/atlas.png';
  return { href, metadata };
}

for (const race of directories(pool)) {
  for (const species of directories(join(pool, race))) {
    if (races.get(species) !== race) throw new Error(`Wrong or unknown race/species: ${race}/${species}`);
    if (result.species[species]) throw new Error(`Duplicate species: ${species}`);
    const speciesPath = join(pool, race, species);
    result.species[species] = active(speciesPath);
    const variantsPath = join(speciesPath, 'variants');
    if (!existsSync(variantsPath)) continue;
    result.variants[species] = {};
    for (const variant of directories(variantsPath)) {
      const entry = active(join(variantsPath, variant));
      if (entry.metadata.speciesId !== species || entry.metadata.variantId !== variant || !entry.metadata.name || !Array.isArray(entry.metadata.frames)) {
        throw new Error(`Invalid variant metadata: ${species}/${variant}`);
      }
      if (result.variants[species][entry.metadata.name]) throw new Error(`Duplicate variant name: ${entry.metadata.name}`);
      result.variants[species][entry.metadata.name] = entry;
    }
  }
}

const generated = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!existsSync(output) || readFileSync(output, 'utf8') !== generated) throw new Error('Mob sprite registry is stale; run node tools/mob-sprite-pool.mjs');
} else {
  const temporary = `${output}.${process.pid}.tmp`;
  writeFileSync(temporary, generated);
  renameSync(temporary, output);
}
const variantCount = Object.values(result.variants).reduce((total, variants) => total + Object.keys(variants).length, 0);
console.log(`Mob sprite pool: ${Object.keys(result.species).length} species, ${variantCount} variants`);
