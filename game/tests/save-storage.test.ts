import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame } from '../src/sim/core/game';

describe('durable save success and storage recovery', () => {
  let save: typeof import('../src/state/save');
  const mirror = new Map<string, string>();
  const database = new Map<string, string>();
  const faults = { mirror: false, remove: false, open: false, transaction: false };
  let holdWrite: ((key: string, commit: () => void) => boolean) | undefined;

  beforeEach(async () => {
    mirror.clear(); database.clear();
    holdWrite = undefined;
    Object.assign(faults, { mirror: false, remove: false, open: false, transaction: false });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mirror.get(key) ?? null,
      setItem: (key: string, value: string) => { if (faults.mirror) throw new Error('quota'); mirror.set(key, value); },
      removeItem: (key: string) => { if (faults.remove) throw new Error('blocked'); mirror.delete(key); },
    });
    // Only the IDB request/transaction boundary is mocked; the real save reader and writer run.
    vi.stubGlobal('indexedDB', { open: () => {
      const request: any = {};
      queueMicrotask(() => {
        if (faults.open) { request.error = new Error('unavailable'); request.onerror?.(); return; }
        request.result = { transaction: () => {
          const transaction: any = {};
          transaction.objectStore = () => ({
            put: (value: string, key: string) => {
              const commit = () => queueMicrotask(() => {
                if (faults.transaction) { transaction.error = new Error('aborted'); transaction.onabort?.(); }
                else { database.set(key, value); transaction.oncomplete?.(); }
              });
              if (!holdWrite?.(key, commit)) commit();
            },
            get: (key: string) => {
              const read: any = {};
              queueMicrotask(() => { read.result = database.get(key); read.onsuccess?.(); });
              return read;
            },
          });
          return transaction;
        } };
        request.onsuccess?.();
      });
      return request;
    } });
    vi.resetModules();
    save = await import('../src/state/save');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses the database when the mirror cannot store a newer save, removing only its stale shadow', async () => {
    const state = newGame(61); state.counters.kills = 42;
    await save.writeSave('slot1', state);
    faults.mirror = true;
    state.counters.kills++;
    await save.writeSave('slot1', state);
    expect(mirror.has('modworld:slot1')).toBe(false);
    expect((await save.readSave('slot1'))?.counters.kills).toBe(43);
  });

  it('uses the confirmed mirror if the database transaction aborts', async () => {
    faults.transaction = true;
    const state = newGame(62); state.counters.kills = 17;
    await expect(save.writeSave('slot2', state)).resolves.toBeUndefined();
    expect((await save.readSave('slot2'))?.counters.kills).toBe(17);
    expect(database.has('slot2')).toBe(false);
  });

  it('reports an unreplaced stale mirror instead of falsely confirming a readable new save', async () => {
    const state = newGame(63);
    await save.writeSave('slot1', state);
    faults.mirror = faults.remove = true;
    state.counters.kills = 9;
    await expect(save.writeSave('slot1', state)).rejects.toThrow(/older browser copy/);
    expect((await save.readSave('slot1'))?.counters.kills).toBe(0);
  });

  it('retries a failed database open when storage becomes available again', async () => {
    faults.mirror = faults.open = true;
    const state = newGame(64);
    await expect(save.writeSave('slot1', state)).rejects.toThrow(/could not save/);
    faults.open = false;
    await expect(save.writeSave('slot1', state)).resolves.toBeUndefined();
    expect(await save.readSave('slot1')).not.toBeNull();
  });

  it('stores one consistent state and leaves a newer snapshot trigger pending during an async write', async () => {
    const state = newGame(65); state.counters.kills = 42;
    const saving = save.writeSave('slot1', state);
    state.counters.kills = 43;
    state.clockSec++;
    state.pendingSnapshot = 'level';
    await saving;
    expect((await save.readSave('slot1'))?.counters.kills).toBe(42);
    expect(state.counters.kills).toBe(43);
    expect(state.pendingSnapshot).toBe('level');
  });

  it('keeps a newer emergency save when an older async save is still reading the account', async () => {
    const state = newGame(66); state.counters.kills = 42;
    const saving = save.writeSave('slot1', state);
    state.counters.kills = 43;
    state.clockSec++;
    state.pendingSnapshot = 'level';
    save.writeSaveSync('slot1', state);
    await saving;
    expect((await save.readSave('slot1'))?.counters.kills).toBe(43);
    expect((await save.listSnapshots('slot1'))[0].state.counters.kills).toBe(43);
  });

  it('finishes database recovery if an overlapping emergency save cannot write its slot', async () => {
    const state = newGame(68); state.counters.kills = 42;
    const saving = save.writeSave('slot1', state);
    faults.mirror = true;
    expect(() => save.writeSaveSync('slot1', state)).toThrow(/emergency browser save failed/);
    await saving;
    expect((await save.readSave('slot1'))?.counters.kills).toBe(42);
  });

  it.each(['account', 'snap:slot1', 'slot1'].flatMap((key) => [false, true].map((mirrorFails) => ({ key, mirrorFails }))))(
    'keeps the emergency save during an older $key transaction (mirror initially failing: $mirrorFails)', async ({ key, mirrorFails }) => {
    const state = newGame(67); state.counters.kills = 41; state.counters.playSec = 41;
    state.pendingSnapshot = 'level';
    await save.writeSave('slot1', state);
    let release!: () => void;
    let started!: () => void;
    const held = new Promise<void>((resolve) => { started = resolve; });
    holdWrite = (writingKey, commit) => {
      if (writingKey !== key) return false;
      release = commit; started(); return true;
    };
    faults.mirror = mirrorFails;
    state.counters.kills = 42;
    state.counters.playSec = 42;
    state.pendingSnapshot = 'level';
    const saving = save.writeSave('slot1', state);
    await held;
    faults.mirror = false;
    state.counters.kills = 43;
    state.counters.playSec = 43;
    state.clockSec++;
    state.pendingSnapshot = 'level';
    save.writeSaveSync('slot1', state);
    const emergencyStamp = state.lastSavedAt;
    release();
    await saving;
    expect((await save.readSave('slot1'))?.counters.kills).toBe(43);
    expect(state.lastSavedAt).toBe(emergencyStamp);
    expect((await save.readAccount()).totalPlaySec).toBe(43);
    expect((await save.listSnapshots('slot1'))[0].state.counters.kills).toBe(43);
  });
});
