import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

/**
 * The suite is pure module imports over a read-only engine: no DOM, no fixtures on disk, no global
 * state one file could trip another over (no vi.mock, no fake timers anywhere). A fork and a fresh
 * module graph per file cost the suite more seconds than its tests spend running, so one shared
 * worker pool carries every file.
 *
 * This file is the config vitest reads, so it carries the clocks `vite.config.ts` states for the
 * suite: the long files (the geared fold, the paced ladder, an offline hunt run to its first drop)
 * pass the five-second default under a loaded worker pool, and a time premise typed into a test is
 * a flake the day the machine gets busier.
 */
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('../engine', import.meta.url)),
      '@sim': fileURLToPath(new URL('./src/sim', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    pool: 'threads',
    isolate: false,
    testTimeout: 180_000,
    hookTimeout: 180_000,
    teardownTimeout: 120_000,
    // One retry: this box is a busy desktop (emulator, browser, WSL beside the
    // suite), and wall-clock-sensitive async catch-up tests have starved past the
    // timeout under parallel load while passing solo and in clean runs. A retry
    // heals scheduling starvation only — a deterministic failure fails both
    // attempts and stays red.
    retry: 1,
  },
});
