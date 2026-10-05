import { readdir, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const svgDir = join(dirname(fileURLToPath(import.meta.url)), 'svg');

const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith('.svg')) files.push(full);
  }
}
await walk(svgDir);

const clean = (name) =>
  `${name
    .replace(/^general-\d+-/, '')
    .replace(/^general-/, '')
    .replace(/^new-skill-support-/, '')
    .replace(/^duplicate-of-existing-skill-/, '')
    .replace(/^skill-/, '')
    .replace(/\.svg$/, '')}.svg`;

const stem = (file) => file.replace(/\.svg$/, '');
const key = (file, target) => `${dirname(file).toLowerCase()}/${target.toLowerCase()}`;

const plans = files.map((file) => ({ file, target: clean(basename(file)), renamed: false }));

// Names kept as-is block the cleaned name of any other file in the same folder.
const taken = new Set(
  plans.filter(({ file, target }) => target === basename(file)).map(({ file, target }) => key(file, target)),
);

const removed = [];
const moves = [];

for (const plan of plans) {
  if (plan.target === basename(plan.file)) continue;

  if (taken.has(key(plan.file, plan.target))) {
    const duplicateFamily = /^duplicate-of-existing-skill-/.test(basename(plan.file));
    if (duplicateFamily) {
      removed.push(plan.file);
      continue;
    }
    let suffix = 2;
    while (taken.has(key(plan.file, `${stem(plan.target)}-${suffix}.svg`))) suffix += 1;
    plan.target = `${stem(plan.target)}-${suffix}.svg`;
  }

  taken.add(key(plan.file, plan.target));
  moves.push(plan);
}

for (const file of removed) await rm(file);

for (const { file, target } of moves) {
  const staged = join(dirname(file), `.rename-${basename(file)}`);
  await rename(file, staged);
  await rename(staged, join(dirname(file), target));
}

console.log(`renamed ${moves.length}`);
console.log(`removed ${removed.length} duplicates:`);
for (const file of removed) console.log(`  ${file.replace(/\\/g, '/')}`);