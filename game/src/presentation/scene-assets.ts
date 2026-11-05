const cache = new Map<string, Promise<'ready' | 'failed'>>();
export function prepareSceneImage(url: string): Promise<'ready' | 'failed'> {
  const existing = cache.get(url);
  if (existing) return existing;
  const p = new Promise<'ready' | 'failed'>((resolve) => {
    const img = new Image();
    img.onload = () => { img.decode().then(() => resolve('ready')).catch(() => resolve('ready')); };
    img.onerror = () => resolve('failed');
    img.src = url;
  });
  // Keep outcome cached; remove listeners via GC – cache holds promise, not element.
  cache.set(url, p);
  p.then(() => {}, () => {});
  return p;
}
export function clearFailedForScene(urls: string[]) {
  for (const url of urls) {
    const p = cache.get(url);
    if (p) p.then(v => { if (v === 'failed') cache.delete(url); });
  }
}
