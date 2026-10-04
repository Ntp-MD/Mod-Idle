import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

// The repo root is the workspace: the client reads tools/data/*.json and engine/*.js, which sit
// outside game/. That is deliberate — the game must import the cages' numbers, not copy them.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  server: { fs: { allow: [repoRoot] } },
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
