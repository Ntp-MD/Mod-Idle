/**
 * One home for the Node flags every child process needs.
 *
 * The cages and writers load `engine/*.ts` and `tools/lib/*.ts`, so each spawned
 * `node` must run native type-stripping. `execFileSync`/`spawn` inherit
 * `process.env`, so a parent sets `NODE_OPTIONS` once and every child follows.
 */
export const NODE_FLAGS = '--experimental-strip-types --disable-warning=ExperimentalWarning';

/** Append the flags to whatever `NODE_OPTIONS` already holds, without duplicating them. */
export function withNodeFlags(existing?: string): string {
  return [existing, NODE_FLAGS].filter(Boolean).join(' ');
}
