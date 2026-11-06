import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type LoadKind = 'success' | 'error' | 'empty';
class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 64;
  naturalHeight = 32;
  listeners = new Map<string, Array<() => void>>();
  src = '';
  private kind: LoadKind = 'success';
  constructor() { FakeImage.instances.push(this); }
  addEventListener(type: string, fn: () => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, fn: () => void) {
    const list = this.listeners.get(type);
    if (list) this.listeners.set(type, list.filter(f => f !== fn));
  }
  decode() { return Promise.resolve(); }
  emit(type: 'load' | 'error') {
    if (type === 'load') {
      if (this.kind === 'error') return;
      if (this.kind === 'empty') { this.naturalWidth = 0; this.naturalHeight = 0; }
    }
    for (const fn of this.listeners.get(type) ?? []) fn();
  }
  static setKind(kind: LoadKind) {
    for (const img of FakeImage.instances) img.kind = kind;
  }
}

describe('vfx-assets state machine', () => {
  let mod: typeof import('../../src/ui/fx/vfx-assets.svelte');
  beforeEach(async () => {
    vi.useFakeTimers();
    FakeImage.instances = [];
    vi.stubGlobal('window', {});
    vi.stubGlobal('Image', FakeImage as any);
    vi.stubGlobal('setTimeout', globalThis.setTimeout.bind(globalThis));
    vi.stubGlobal('clearTimeout', globalThis.clearTimeout.bind(globalThis));
    mod = await import('../../src/ui/fx/vfx-assets.svelte');
    mod._resetVfxAssetsForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('reads idle for unknown URI without creating work', () => {
    expect(mod.getVfxAssetStatus('https://example.invalid/unknown.png')).toBe('idle');
    mod.ensureVfxAssets(['https://example.invalid/one.png']);
    expect(FakeImage.instances).toHaveLength(1);
  });

  it('loads once per URI: duplicate ensure creates one request', async () => {
    mod.ensureVfxAssets(['/a.png', '/a.png', '/a.png']);
    mod.ensureVfxAssets(['/a.png']);
    expect(FakeImage.instances).toHaveLength(1);
    FakeImage.instances[0].emit('load');
    await vi.advanceTimersByTimeAsync(0);
    expect(mod.getVfxAssetStatus('/a.png')).toBe('ready');
    expect(mod.getVfxAssetSize('/a.png')).toEqual({ width: 64, height: 32 });
    // ensure on ready creates no new request
    mod.ensureVfxAssets(['/a.png']);
    expect(FakeImage.instances).toHaveLength(1);
  });

  it('failed via error event is terminal; late success ignored', async () => {
    mod.ensureVfxAssets(['/b.png']);
    const img = FakeImage.instances[0];
    img.emit('error');
    await vi.advanceTimersByTimeAsync(0);
    expect(mod.getVfxAssetStatus('/b.png')).toBe('failed');
    // late completion cannot revive
    img.emit('load');
    await vi.advanceTimersByTimeAsync(0);
    expect(mod.getVfxAssetStatus('/b.png')).toBe('failed');
  });

  it('10s timeout marks failed; late load ignored', async () => {
    mod.ensureVfxAssets(['/c.png']);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mod.getVfxAssetStatus('/c.png')).toBe('failed');
    FakeImage.instances[0].emit('load');
    await vi.advanceTimersByTimeAsync(0);
    expect(mod.getVfxAssetStatus('/c.png')).toBe('failed');
  });

  it('zero natural dimensions are failed (empty)', async () => {
    mod.ensureVfxAssets(['/d.png']);
    FakeImage.instances[0].naturalWidth = 0;
    FakeImage.instances[0].naturalHeight = 0;
    FakeImage.instances[0].emit('load');
    await vi.advanceTimersByTimeAsync(0);
    expect(mod.getVfxAssetStatus('/d.png')).toBe('failed');
  });

  it('reportVfxAssetFailure moves ready → failed', async () => {
    mod.ensureVfxAssets(['/e.png']);
    FakeImage.instances[0].emit('load');
    await vi.advanceTimersByTimeAsync(0);
    expect(mod.getVfxAssetStatus('/e.png')).toBe('ready');
    mod.reportVfxAssetFailure('/e.png');
    expect(mod.getVfxAssetStatus('/e.png')).toBe('failed');
    expect(mod.getVfxAssetSize('/e.png')).toBeNull();
  });
});
