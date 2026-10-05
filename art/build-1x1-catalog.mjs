import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const artDir = dirname(fileURLToPath(import.meta.url));
const sourceDir = join(artDir, 'svg');
const manifestFile = join(artDir, 'svg-manifest.tsv');

// The library lives in one flat folder, so the original `1x1/<artist>/<icon>.svg` grouping is
// recovered from the manifest written by the flatten step (each line is `<flat>\\t<original>`).
const restored = new Map(
  readFileSync(manifestFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'))
    .map(([flat, original]) => [flat, original]),
);

const entries = readdirSync(sourceDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.svg'))
  .map((entry) => ({ flat: entry.name, original: restored.get(entry.name) ?? entry.name }))
  .filter((entry) => entry.original.startsWith('1x1/'))
  .map((entry) => ({ artist: entry.original.split('/')[1], flat: entry.flat }));

const artists = [...new Set(entries.map((entry) => entry.artist))].sort((a, b) => a.localeCompare(b));
const groups = artists.map((artist) => ({
  name: `1x1 library / ${artist}`,
  items: entries
    .filter((entry) => entry.artist === artist)
    .map((entry) => ({
      name: entry.flat.slice(0, -4),
      path: `svg/${entry.flat}`,
      asset: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
}));

const total = groups.reduce((sum, group) => sum + group.items.length, 0);
writeFileSync(
  join(artDir, '1x1-catalog.js'),
  `window.MODWORLD_1X1_ICON_CATALOG = ${JSON.stringify(groups)};\n`,
  'utf8',
);
console.log(`Indexed ${total} SVG icons in ${groups.length} artist groups.`);