import { afterEach, describe, expect, it } from 'vitest';
import { requestAccountWriterLock } from '../../src/state/accountWriterLock';

type Pending = { grant: () => void; abort: () => void };

/** Browser-shaped lock manager: one exclusive holder, queued waiters, abort signals. */
function lockManager() {
  let held = false;
  const waiting: Pending[] = [];
  async function request(_name: string, options: LockOptions, callback: (lock: unknown) => Promise<void>) {
    if (options.ifAvailable && held) { await callback(null); return; }
    if (!options.ifAvailable && held) {
      await new Promise<void>((resolve, reject) => {
        const entry: Pending = {
          grant: resolve,
          abort: () => reject(new DOMException('aborted', 'AbortError')),
        };
        waiting.push(entry);
        options.signal?.addEventListener('abort', entry.abort, { once: true });
      });
    }
    held = true;
    try {
      await callback({});
    } finally {
      held = false;
      waiting.shift()?.grant();
    }
  }
  return { request, isHeld: () => held };
}

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function installLocks(request: (name: string, options: LockOptions, callback: (lock: unknown) => Promise<void>) => Promise<void>) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { locks: { request } },
  });
}

afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: undefined });
});

describe('account writer lock handoff', () => {
  it('acquires a free lock and releases it', async () => {
    const manager = lockManager();
    installLocks(manager.request);
    const first = await requestAccountWriterLock();
    expect(first.status).toBe('acquired');
    if (first.status !== 'acquired') return;
    expect(manager.isHeld()).toBe(true);
    first.release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(manager.isHeld()).toBe(false);
  });

  it('waits out a departing same-document holder instead of reporting it as a second tab', async () => {
    const manager = lockManager();
    installLocks(manager.request);
    const departing = await requestAccountWriterLock();
    expect(departing.status).toBe('acquired');
    if (departing.status !== 'acquired') return;
    const replacement = requestAccountWriterLock({ retryMs: 2_000 });
    setTimeout(() => departing.release(), 40);
    const result = await replacement;
    expect(result.status).toBe('acquired');
    if (result.status === 'acquired') result.release();
  });

  it('reports busy when a genuinely occupied tab keeps the lock past the retry window', async () => {
    const manager = lockManager();
    installLocks(manager.request);
    const owner = await requestAccountWriterLock();
    expect(owner.status).toBe('acquired');
    if (owner.status !== 'acquired') return;
    const result = await requestAccountWriterLock({ retryMs: 40 });
    expect(result.status).toBe('busy');
    owner.release();
  });

  it('cancels a pending handoff when the component is disposed', async () => {
    const manager = lockManager();
    installLocks(manager.request);
    const owner = await requestAccountWriterLock();
    expect(owner.status).toBe('acquired');
    const controller = new AbortController();
    const waiting = requestAccountWriterLock({ retryMs: 2_000, signal: controller.signal });
    controller.abort();
    expect((await waiting).status).toBe('cancelled');
    if (owner.status === 'acquired') owner.release();
  });
});
