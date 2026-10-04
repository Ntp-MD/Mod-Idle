import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// svelte-check reads this file, not the plugin inside vite.config.ts, so without it the runes in
// App.svelte type-check as plain script and every $state call reads as untyped.
export default { preprocess: vitePreprocess() };
