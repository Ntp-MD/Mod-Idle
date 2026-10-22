import { describe, expect, it, vi } from 'vitest';
import { CharacterSaveSession } from '../src/state/saveSession';
import { newGame } from '../src/sim/game';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('character ownership of save requests', () => {
  it('detaches a new character from a previously selected slot', async () => {
    const write = vi.fn(async () => {});
    const session = new CharacterSaveSession(write);
    await session.save('slot1', newGame(1));
    expect(session.slot).toBe('slot1');
    session.detach();
    expect(session.slot).toBeNull();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('finishes an old in-flight save without attaching the new character to its slot', async () => {
    const held = deferred();
    const writes: number[] = [];
    const session = new CharacterSaveSession(async (_slot, state) => { await held.promise; writes.push(state.counters.kills); });
    const old = newGame(2); old.counters.kills = 42;
    const pending = session.save('slot1', old);
    await Promise.resolve();
    session.detach();
    held.resolve();
    expect(await pending).toBe(false);
    expect(session.slot).toBeNull();
    expect(writes).toEqual([42]);
  });

  it('serializes an explicit later save after the old character finishes writing', async () => {
    const held = deferred();
    const writes: number[] = [];
    const session = new CharacterSaveSession(async (_slot, state) => { if (state.counters.kills === 42) await held.promise; writes.push(state.counters.kills); });
    const old = newGame(3); old.counters.kills = 42;
    const first = session.save('slot1', old);
    session.detach();
    const second = session.save('slot1', newGame(4));
    held.resolve();
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(writes).toEqual([42, 0]);
    expect(session.slot).toBe('slot1');
  });

  it('does not attach a failed first save and lets a subsequent retry succeed', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('storage full')).mockResolvedValueOnce(undefined);
    const session = new CharacterSaveSession(write);
    await expect(session.save('slot2', newGame(5))).rejects.toThrow('storage full');
    expect(session.slot).toBeNull();
    expect(await session.save('slot2', newGame(5))).toBe(true);
    expect(session.slot).toBe('slot2');
  });

  it('rejects stale load or restore bindings after another character was chosen', () => {
    const session = new CharacterSaveSession();
    const oldLoad = session.detach();
    const currentLoad = session.detach();
    expect(session.attach('slot1', oldLoad)).toBe(false);
    expect(session.slot).toBeNull();
    expect(session.attach('slot2', currentLoad)).toBe(true);
    expect(session.slot).toBe('slot2');
  });
});
