import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterSaveSession } from '../../src/state/saveSession';
import { createSessionActions } from '../../src/app/session';
import { newGame } from '@sim/core/game';
import { sm } from '../../src/engine/client';
import * as save from '../../src/state/save';

/** The away simulator is the only piece faked: the real save rules and storage run below. */
const awayCtl = vi.hoisted(() => ({
  calls: [] as { secs: number; state: unknown }[],
  cancelled: false,
  hold: null as Promise<void> | null,
}));

vi.mock('@sim/core/game', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sim/core/game')>();
  return {
    ...actual,
    catchUpAsync: async (state: unknown, secs: number) => {
      awayCtl.calls.push({ secs, state });
      if (awayCtl.hold) await awayCtl.hold;
      return {
        simulated: awayCtl.cancelled ? 0 : Math.floor(secs),
        capped: false,
        ...(awayCtl.cancelled ? { cancelled: true } : {}),
      };
    },
  };
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

const mirror = new Map<string, string>();

function setMirrorStorage() {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => mirror.get(key) ?? null,
    setItem: (key: string, value: string) => { mirror.set(key, value); },
    removeItem: (key: string) => { mirror.delete(key); },
  });
}

beforeEach(() => {
  mirror.clear();
  awayCtl.calls.length = 0;
  awayCtl.cancelled = false;
  awayCtl.hold = null;
  vi.stubGlobal('indexedDB', undefined);
  setMirrorStorage();
});
afterEach(() => vi.unstubAllGlobals());

async function seed(slot: 'slot1' | 'slot2' | 'slot3', state: ReturnType<typeof newGame>, awaySec = 0) {
  await save.writeSave(slot, state);
  const key = `modworld:${slot}`;
  const envelope = JSON.parse(mirror.get(key)!);
  envelope.state.lastSavedAt = Date.now() - awaySec * 1000;
  envelope.writtenAt = envelope.state.lastSavedAt;
  mirror.set(key, JSON.stringify(envelope));
}

function seedAccount(mastery: Record<string, number>) {
  mirror.set('modworld:account', JSON.stringify({
    version: save.SCHEMA_VERSION, mastery, totalPlaySec: 0, playtimeBySlot: {},
  }));
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  const session = new CharacterSaveSession();
  const ctx: any = {
    showcaseMode: false,
    liveArpgArena: false,
    saveSession: session,
    gameState: newGame(77),
    canWriteAccount: true,
    settings: { autoSkills: true, autoEquip: false, offlineReport: false },
    paused: false,
    loadController: null,
    offlineProgress: null,
    attachedSlot: null,
    accountWriterState: 'owner',
    accountWriterLease: null,
    takeoverController: null,
    takeoverSlot: 'slot1',
    snapSlot: 'slot1',
    snaps: [],
    resetArena: vi.fn(),
    restartLoop: vi.fn(),
    resetSkillDiscovery: vi.fn(),
    resetCharacterUi: vi.fn(),
    restoreCharacterUi: vi.fn(),
    captureCharacterUi: vi.fn(() => ({})),
    equipCarriedBest: vi.fn(),
    ...overrides,
  };
  return { ctx, actions: createSessionActions(ctx) };
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

describe('persistent session contract', () => {
  it('starts a new character unslotted while keeping shared Mastery and the old slot bytes', async () => {
    const { ctx, actions } = makeCtx();
    const old = newGame(1);
    old.player.level = 5;
    old.mastery = { sword: 9 };
    await seed('slot1', old);
    seedAccount({ sword: 12, axe: 3 });
    const before = mirror.get('modworld:slot1');
    expect(await actions.doLoad('slot1')).toBe(true);
    expect(ctx.saveSession.slot).toBe('slot1');
    awayCtl.calls.length = 0;

    ctx.gameState.player.level = 99;
    expect(await actions.reset()).toBe(true);
    expect(ctx.gameState.player.level).not.toBe(99);
    expect(ctx.saveSession.slot).toBeNull();
    expect(ctx.attachedSlot).toBeNull();
    expect(ctx.gameState.mastery).toMatchObject({ sword: 12, axe: 3 });
    expect(mirror.get('modworld:slot1')).toBe(before);
    expect(awayCtl.calls).toEqual([]);
  });

  it('pays away once through doLoad, then a save moves the stamp so a reload does not pay it again', async () => {
    const { ctx, actions } = makeCtx();
    const stored = newGame(8); stored.counters.kills = 4;
    await seed('slot1', stored, 10);
    const before = mirror.get('modworld:slot1');

    expect(await actions.doLoad('slot1')).toBe(true);
    expect(ctx.attachedSlot).toBe('slot1');
    expect(awayCtl.calls).toHaveLength(1);
    expect(awayCtl.calls[0].secs).toBeGreaterThanOrEqual(9);
    expect(awayCtl.calls[0].secs).toBeLessThanOrEqual(12);
    // Loading reads and catch-ups in memory; the stored slot is not rewritten by the load.
    expect(mirror.get('modworld:slot1')).toBe(before);

    ctx.gameState.counters.kills = 5;
    await actions.doSave('slot1');
    awayCtl.calls.length = 0;
    expect(await actions.doLoad('slot1')).toBe(true);
    expect(awayCtl.calls).toHaveLength(1);
    expect(awayCtl.calls[0].secs).toBeLessThanOrEqual(2);
  });

  it('keeps the previous run and slot when catch-up is cancelled, and retries from the same stored input', async () => {
    const { ctx, actions } = makeCtx();
    await seed('slot1', newGame(9), 10);
    const other = newGame(10); other.counters.kills = 21;
    await seed('slot2', other, 0);
    expect(await actions.doLoad('slot2')).toBe(true);
    const previous = ctx.gameState;
    const before = mirror.get('modworld:slot1');

    awayCtl.cancelled = true;
    awayCtl.calls.length = 0;
    expect(await actions.doLoad('slot1')).toBe(false);
    expect(ctx.gameState).toBe(previous);
    expect(ctx.saveSession.slot).toBe('slot2');
    expect(ctx.attachedSlot).toBe('slot2');
    expect(mirror.get('modworld:slot1')).toBe(before);
    expect(awayCtl.calls[0].secs).toBeGreaterThanOrEqual(9);

    awayCtl.cancelled = false;
    awayCtl.calls.length = 0;
    expect(await actions.doLoad('slot1')).toBe(true);
    expect(awayCtl.calls[0].secs).toBeGreaterThanOrEqual(9);
  });

  it('cannot let an older load attach or replace a newer run chosen before it finishes', async () => {
    const { ctx, actions } = makeCtx();
    const stored = newGame(11); stored.player.level = 50;
    await seed('slot1', stored, 10);
    const held = deferred();
    awayCtl.hold = held.promise;

    const loading = actions.doLoad('slot1');
    await vi.waitFor(() => expect(awayCtl.calls).toHaveLength(1));
    const other = newGame(15); other.player.level = 60;
    await seed('slot2', other, 0);
    const second = actions.doLoad('slot2');
    held.resolve();
    expect(await loading).toBe(false);
    expect(await second).toBe(true);
    expect(ctx.saveSession.slot).toBe('slot2');
    expect(ctx.attachedSlot).toBe('slot2');
    expect(ctx.gameState.player.level).toBe(60);
  });

  it('keeps the newest choice when an older load is still waiting and the player starts a new character', async () => {
    const { ctx, actions } = makeCtx();
    const stored = newGame(11); stored.player.level = 50;
    await seed('slot1', stored, 10);
    const held = deferred();
    awayCtl.hold = held.promise;

    const loading = actions.doLoad('slot1');
    await vi.waitFor(() => expect(awayCtl.calls).toHaveLength(1));
    expect(await actions.reset()).toBe(true);
    held.resolve();
    expect(await loading).toBe(false);
    expect(ctx.saveSession.slot).toBeNull();
    expect(ctx.attachedSlot).toBeNull();
    expect(ctx.gameState.player.level).not.toBe(50);
  });

  it('keeps the run unslotted and says so when the durable write fails, then retries cleanly', async () => {
    const { ctx, actions } = makeCtx();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('quota'); },
      removeItem: () => {},
    });
    await actions.doSave('slot1');
    expect(ctx.saveSession.slot).toBeNull();
    expect(ctx.attachedSlot).toBeNull();
    expect(ctx.saveNote).not.toMatch(/Saved to/);
    expect(ctx.persistenceError).toMatch(/Save failed/);
    // The in-memory run is still exportable for recovery.
    expect(() => save.importJson(save.exportJson(ctx.gameState))).not.toThrow();

    setMirrorStorage();
    await actions.doSave('slot1');
    expect(ctx.saveSession.slot).toBe('slot1');
    expect(ctx.attachedSlot).toBe('slot1');
    expect(ctx.persistenceError).toBeNull();
    expect(ctx.saveNote).toBe('Saved to slot1');
  });

  it('validates an import before detaching and merges the shared account into the new run', async () => {
    const { ctx, actions } = makeCtx();
    await seed('slot1', newGame(12), 0);
    expect(await actions.doLoad('slot1')).toBe(true);
    const before = mirror.get('modworld:slot1');
    seedAccount({ sword: 7 });
    const imported = newGame(13);
    imported.counters.kills = 12;
    imported.player.xp = 345;
    imported.mastery = { sword: 2, axe: 4 };
    const skillId = sm.all()[0].id;
    imported.skills.owned[skillId] = 1;
    imported.skills.xp[skillId] = 88;
    const file = { text: async () => save.exportJson(imported) };

    await actions.upload({ target: { files: [file] } } as any);
    expect(ctx.saveSession.slot).toBeNull();
    expect(ctx.attachedSlot).toBeNull();
    expect(ctx.gameState.counters.kills).toBe(12);
    expect(ctx.gameState.player.xp).toBe(345);
    expect(ctx.gameState.skills.owned[skillId]).toBe(1);
    expect(ctx.gameState.skills.xp[skillId]).toBe(88);
    expect(ctx.gameState.mastery).toMatchObject({ sword: 7, axe: 4 });
    expect(mirror.get('modworld:slot1')).toBe(before);
    expect(ctx.saveNote).toMatch(/Choose a save slot/);

    const kept = ctx.gameState;
    const note = ctx.saveNote;
    await actions.upload({ target: { files: [{ text: async () => 'not json' }] } } as any);
    expect(ctx.gameState).toBe(kept);
    expect(ctx.saveNote).toMatch(/^Import failed:/);
    expect(ctx.saveNote).not.toBe(note);
  });

  it('keeps the attached run and slot when an import is invalid', async () => {
    const { ctx, actions } = makeCtx();
    await seed('slot1', newGame(14), 0);
    expect(await actions.doLoad('slot1')).toBe(true);
    const previous = ctx.gameState;
    const before = mirror.get('modworld:slot1');
    await actions.upload({ target: { files: [{ text: async () => 'not json' }] } } as any);
    expect(ctx.gameState).toBe(previous);
    expect(ctx.saveSession.slot).toBe('slot1');
    expect(ctx.attachedSlot).toBe('slot1');
    expect(mirror.get('modworld:slot1')).toBe(before);
    expect(ctx.saveNote).toMatch(/your current slot was not changed/);
  });

  it('never reads or writes player storage in showcase mode', async () => {
    const { ctx, actions } = makeCtx({ showcaseMode: true });
    await actions.doSave('slot1');
    expect(await actions.doLoad('slot1')).toBe(false);
    expect(await actions.loadSnaps()).toBeUndefined();
    expect(await actions.restore(0)).toBe(false);
    expect(await actions.upload({ target: { files: [{ text: async () => '{}' }] } } as any)).toBe(false);
    expect(await actions.reset()).toBe(false);
    actions.flushSync();
    actions.download();
    expect(ctx.snaps).toEqual([]);
    expect(ctx.saveSession.slot).toBeNull();
    expect(awayCtl.calls).toEqual([]);
    expect(mirror.size).toBe(0);
  });
});
