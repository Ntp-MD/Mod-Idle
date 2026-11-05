import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)![1];

function boot() {
  class Element extends EventTarget {
    textContent = '';
    hidden = true;
    removed = false;
    attributes = new Map<string, string>();
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    remove() { this.removed = true; }
  }
  const elements = Object.fromEntries(['boot-status', 'boot-title', 'boot-message', 'boot-retry', 'game-entry']
    .map(id => [id, new Element()]));
  Object.assign(elements['game-entry'], { tagName: 'SCRIPT' });
  const window = Object.assign(new EventTarget(), { location: { reload: vi.fn() } });
  let timeout: (() => void) | undefined;
  runInNewContext(script, {
    document: { getElementById: (id: string) => elements[id] }, window,
    setTimeout: (callback: () => void) => { timeout = callback; return 1; },
    clearTimeout: () => { timeout = undefined; },
  });
  return { elements, window, slow: () => timeout?.() };
}

describe('startup recovery independent of the game bundle', () => {
  it('offers a manual reload when the entry script or its dependencies fail', () => {
    const { elements, window } = boot();
    const error = new Event('error');
    Object.defineProperty(error, 'target', { value: elements['game-entry'] });
    window.dispatchEvent(error);
    expect(elements['boot-status'].attributes.get('role')).toBe('alert');
    expect(elements['boot-title'].textContent).toBe('The game could not open');
    expect(elements['boot-retry'].hidden).toBe(false);
    expect(window.location.reload).not.toHaveBeenCalled();
    elements['boot-retry'].dispatchEvent(new Event('click'));
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it.each(['error', 'unhandledrejection'])('handles a startup %s without needing the game code', type => {
    const { elements, window } = boot();
    window.dispatchEvent(Object.assign(new Event(type), { error: new Error('startup failed') }));
    expect(elements['boot-retry'].hidden).toBe(false);
    expect(elements['boot-title'].textContent).toBe('The game could not open');
  });

  it('allows a slow load to continue and removes its UI when the app mounts', () => {
    const { elements, window, slow } = boot();
    slow();
    expect(elements['boot-message'].textContent).toContain('keep waiting');
    expect(elements['boot-retry'].hidden).toBe(false);
    expect(window.location.reload).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('modworld:ready'));
    expect(elements['boot-status'].removed).toBe(true);
    window.dispatchEvent(new Event('unhandledrejection'));
    slow();
    expect(elements['boot-title'].textContent).not.toBe('The game could not open');
  });

  it('ignores a failed image during startup', () => {
    const { elements, window } = boot();
    window.dispatchEvent(new Event('error'));
    expect(elements['boot-retry'].hidden).toBe(true);
    expect(elements['boot-status'].attributes.has('role')).toBe(false);
  });
});
