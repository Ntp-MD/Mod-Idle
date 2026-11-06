import { SvelteMap } from 'svelte/reactivity';

export type VfxAssetStatus = 'idle' | 'loading' | 'ready' | 'failed';

type Entry = { status: VfxAssetStatus; width?: number; height?: number; category?: string };

/** Shared per-URI readiness. One preload/decode per URI per document; failed is terminal until reload. */
const states = new SvelteMap<string, Entry>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Map<string, { img: HTMLImageElement; onLoad: () => void; onError: () => void }>();

function set(src: string, entry: Entry) {
  states.set(src, entry);
}

function detach(src: string) {
  const t = timers.get(src);
  if (t != null) {
    clearTimeout(t);
    timers.delete(src);
  }
  const l = listeners.get(src);
  if (l) {
    l.img.removeEventListener('load', l.onLoad);
    l.img.removeEventListener('error', l.onError);
    listeners.delete(src);
  }
}

export function getVfxAssetStatus(src: string): VfxAssetStatus {
  return states.get(src)?.status ?? 'idle';
}

export function getVfxAssetSize(src: string): Readonly<{ width: number; height: number }> | null {
  const e = states.get(src);
  if (!e || e.status !== 'ready' || !e.width || !e.height) return null;
  return { width: e.width, height: e.height };
}

/**
 * Start loading every source once. No-op for SSR / no window; duplicate ensures create no new request.
 * Ready requires successful decode (or load fallback) with nonzero natural dimensions.
 * 10s timeout → failed (terminal). Late completion after failure is ignored.
 */
export function ensureVfxAssets(sources: readonly string[]): void {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return;
  for (const src of new Set(sources)) {
    if (!src) continue;
    const cur = states.get(src);
    if (cur && cur.status !== 'idle') continue;
    // one request per URI
    const img = new Image();
    set(src, { status: 'loading' });
    const finish = (status: VfxAssetStatus, category?: string, w?: number, h?: number) => {
      // failed is terminal: ignore late completion after timeout/failure
      const now = states.get(src);
      if (now?.status === 'failed' && status !== 'failed') return;
      detach(src);
      set(src, { status, category, width: w, height: h });
    };
    const onLoad = () => {
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;
      if (!(w > 0 && h > 0)) {
        finish('failed', 'empty', 0, 0);
        return;
      }
      // prefer decode when available; already loaded
      if (typeof (img as any).decode === 'function') {
        (img as any).decode().then(() => finish('ready', undefined, w, h)).catch(() => finish('ready', undefined, w, h));
      } else {
        finish('ready', undefined, w, h);
      }
    };
    const onError = () => finish('failed', 'network');
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
    listeners.set(src, { img, onLoad, onError });
    const timeout = setTimeout(() => finish('failed', 'timeout'), 10_000);
    timers.set(src, timeout);
    img.src = src;
  }
}

export function reportVfxAssetFailure(src: string): void {
  if (!src) return;
  const cur = states.get(src);
  if (cur?.status === 'failed') return;
  detach(src);
  set(src, { status: 'failed', category: 'display' });
}

/** Test-only reset: clears state, timers and listeners. Not for production use. */
export function _resetVfxAssetsForTests(): void {
  for (const src of [...timers.keys()]) detach(src);
  states.clear();
}
