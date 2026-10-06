/**
 * The writer commands that own every generated block in the docs.
 *
 * `tools/build.ts` runs them to regenerate the docs in place;
 * `tools/check-generated.ts` re-runs them in a temp copy to prove the committed
 * files already match. One home so the two can never disagree about what
 * "every writer" means.
 */
export const WRITERS: [string, string[]][] = [
  ['check.ts', ['--write']],
  ['town.ts', ['--write']],
  ['skills.ts', ['--write']],
  ['tree.ts', ['--write']],
  ['ladder.ts', ['--write']],
  ['loot.ts', ['--write']],
  ['timeline.ts', ['--write']],
  ['survival.ts', ['--write']],
  ['bases.ts', ['--blocks']],
];

/**
 * The cages `tools/verify.ts` runs, in order, with the label each prints.
 *
 * One home so `verify.ts` and any other caller agree on what "the cage suite"
 * means. Every entry is read-only under `--checks`, so they may run concurrently
 * (see `tools/verify.ts`).
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
  { label: 'anchor cage', script: 'tools/anchors.ts', args: ['--checks'] },
  { label: 'map cage', script: 'tools/map.ts', args: ['--checks'] },
  { label: 'doc lint', script: 'tools/lint.ts', args: [] },
];
