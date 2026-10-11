import { defineConfig } from 'vitest/config';

/**
 * The suite is pure module imports over a read-only engine: no DOM, no fixtures on disk, no global
 * state one file could trip another over (no vi.mock, no fake timers anywhere). A fork and a fresh
 * module graph per file cost the suite more seconds than its tests spend running, so one shared
 * worker pool carries every file.
 */
export default defineConfig({
  test: {
    pool: 'threads',
    isolate: false,
  },
});
