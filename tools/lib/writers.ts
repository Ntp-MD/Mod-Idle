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
  { label: 'skills cage', script: 'tools/skills.ts', args: ['--checks'] },
  { label: 'loot cage', script: 'tools/loot.ts', args: ['--checks'] },
  { label: 'bases cage', script: 'tools/bases.ts', args: ['--checks'] },
  { label: 'imprint cage', script: 'tools/imprint.ts', args: ['--checks'] },
  { label: 'map cage', script: 'tools/map.ts', args: ['--checks'] },
  { label: 'trade cage', script: 'tools/trade.ts', args: ['--checks'] },
];
