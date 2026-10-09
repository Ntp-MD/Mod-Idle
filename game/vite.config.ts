import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

// The repo root is the workspace: the client reads tools/data/*.json and engine/*.js, which sit
// outside game/. That is deliberate — the game must import the cages' numbers, not copy them.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  server: { fs: { allow: [repoRoot] } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Two entries, one app: the game and the live wiki. The wiki is a view over the same engine seam
    // the game imports, so it builds with the client rather than being a second project to keep in step.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        wiki: fileURLToPath(new URL('./wiki.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The long files (the geared fold, the paced ladder) run for minutes on one thread, so the
    // per-test and teardown clocks are set above their worst case. The worker pool is capped: with
    // every core taken at once the RPC channel to the main thread stalls and vitest reports an
    // unhandled "Timeout calling onTaskUpdate" beside an otherwise green suite.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    teardownTimeout: 120_000,
    // The tests load the cages (tools/lib/engine.ts → engine/*.ts) through `createRequire`, so each
    // worker needs Node's native type stripping. execArgv is passed to every spawned worker process.
    poolOptions: {
      forks: {
        minThreads: 1,
        maxThreads: 4,
        execArgv: ['--experimental-strip-types', '--disable-warning=ExperimentalWarning'],
      },
    },
  },
});
