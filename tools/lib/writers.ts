/**
 * The cages `tools/verify.ts` runs, in order, with the label each prints.
 *
 * One home so `verify.ts` and any other caller agree on what "the cage suite"
 * means. Every entry is read-only under `--checks`, so they may run concurrently
 * (see `tools/verify.ts`).
 *
 * There is no writer list any more: the docs are gone, so nothing prints a number
 * into a file. `tools/data/*.json` is the single numeric home and every cage asserts
 * it against `engine/` and the client.
 */
export const CAGES: { label: string; script: string; args: string[] }[] = [
  { label: 'engine cage', script: 'tools/check.ts', args: ['--checks'] },
  { label: 'town cage', script: 'tools/town.ts', args: ['--checks'] },
  { label: 'skills cage', script: 'tools/skills.ts', args: ['--checks'] },
  { label: 'tree cage', script: 'tools/tree.ts', args: ['--checks'] },
  { label: 'ladder cage', script: 'tools/ladder.ts', args: ['--checks'] },
  { label: 'loot cage', script: 'tools/loot.ts', args: ['--checks'] },
  { label: 'bases cage', script: 'tools/bases.ts', args: ['--checks'] },
  { label: 'timeline cage', script: 'tools/timeline.ts', args: ['--checks'] },
  { label: 'survival cage', script: 'tools/survival.ts', args: ['--checks'] },
  { label: 'inventory cage', script: 'tools/inventory.ts', args: ['--checks'] },
  { label: 'map cage', script: 'tools/map.ts', args: ['--checks'] },
  { label: 'dungeon cage', script: 'tools/dungeon.ts', args: ['--checks'] },
  { label: 'imprint cage', script: 'tools/imprint.ts', args: ['--checks'] },
];
