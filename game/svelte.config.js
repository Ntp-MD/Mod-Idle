import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// svelte-check reads this file, not the plugin inside vite.config.ts, so without it the runes in
// App.svelte type-check as plain script and every $state call reads as untyped. `runes: true` is
// explicit because the whole client is Svelte 5 runes: without it the language tools fall back to
// legacy per-file detection, and App.svelte (the largest component) was being read as legacy —
// `$state` resolved to a store subscription on a variable named `state`, so `state` fell back to
// `any` and everything derived from it went unknown.
export default { preprocess: vitePreprocess(), compilerOptions: { runes: true } };
