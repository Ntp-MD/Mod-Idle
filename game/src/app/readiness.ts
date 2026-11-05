export const MARKS = {
  bootStart: 'modworld:boot-start',
  appMounted: 'modworld:app-mounted',
  shellVisible: 'modworld:shell-visible',
  playable: 'modworld:playable',
  sceneReady: (gen: number) => `modworld:scene-ready:${gen}`,
  panelOpen: (id: string, gen: number) => `modworld:panel-open:${id}:${gen}`,
  panelReady: (id: string, gen: number) => `modworld:panel-ready:${id}:${gen}`,
} as const;

let generation = 0;
export function nextGeneration() { return ++generation; }
export function mark(name: string, detail?: unknown) {
  try { performance.mark(name, detail !== undefined ? { detail } as any : undefined); } catch {}
}
const MAX = 20;
export function clearOld(panel: string) { void panel; void MAX; }
