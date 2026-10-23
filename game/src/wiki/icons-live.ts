/**
 * The live half of the icon gallery: every PNG shelf figure under `game/src/icon/`, with the URL Vite
 * resolves.
 *
 * This sits apart from `icons-gallery.ts` on purpose, because `import.meta.glob` is a Vite feature:
 * `tools/wiki.ts` imports the shared runtime in Node, which has no glob, and the static build feeds that
 * same runtime from the folder scan it does instead. The game client reads these files through the same
 * `?url` seam, so a figure is identical in both hosts.
 */

import { iconEntry, GALLERY_RUNTIME, type IconEntry } from './icons-gallery.ts';

const modules = import.meta.glob<string>('../icon/**/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
});

export const ICONS: IconEntry[] = Object.entries(modules)
  .map(([path, url]) => iconEntry(path.replace(/^\.\.\/icon\//, ''), url))
  .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

/** Run the shared runtime against these entries, into the page's `#icons-gallery`. */
export function renderIconsGallery(entries: IconEntry[]): void {
  (window as unknown as { __ICONS__?: IconEntry[] }).__ICONS__ = entries;
  const script = document.createElement('script');
  script.textContent = GALLERY_RUNTIME;
  document.body.appendChild(script);
}
