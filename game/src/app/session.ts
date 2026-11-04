import { catchUpAsync, newGame } from '@sim/core/game';
import type { GameState } from '@sim/core/types';
import type { CharacterSaveSession } from '../state/saveSession';
import {
  applyAccount, exportJson, importJson, listSnapshots, readAccount, readSave, restoreSnapshot,
  writeSaveSync, type ClientSettings, type SlotName, type Snapshot,
} from '../state/save';
import { requestAccountWriterLock, type AccountWriterLockResult } from '../state/accountWriterLock';
import { buildAwayReport, describeSnap, snapCounters, type AwayReport } from '../ui/hud/hud';
import type { CharacterUiSnapshot } from '../ui/character/character-ui-session';

export type AccountWriterState = 'checking' | 'owner' | 'readonly' | 'waiting' | 'unsupported';
export type AccountWriterLease = Extract<AccountWriterLockResult, { status: 'acquired' }>;

/** The reactive shell state the persistence flow reads and writes; App owns the runes. */
export interface SessionContext {
  showcaseMode: boolean;
  saveSession: CharacterSaveSession;
  get gameState(): GameState;
  set gameState(value: GameState);
  get canWriteAccount(): boolean;
  get settings(): ClientSettings;
  get paused(): boolean;
  set paused(value: boolean);
  get loadController(): AbortController | null;
  set loadController(value: AbortController | null);
  set offlineProgress(value: { done: number; total: number } | null);
  set saveNote(value: string);
  set persistenceError(value: string | null);
  set awayReport(value: AwayReport | null);
  get liveArpgArena(): boolean;
  get accountWriterState(): AccountWriterState;
  set accountWriterState(value: AccountWriterState);
  get accountWriterLease(): AccountWriterLease | null;
  set accountWriterLease(value: AccountWriterLease | null);
  get takeoverController(): AbortController | null;
  set takeoverController(value: AbortController | null);
  get takeoverSlot(): SlotName;
  set takeoverSlot(value: SlotName);
  /** Reactive mirror of `saveSession.slot` for the shell's save notices. */
  set attachedSlot(value: SlotName | null);
  get snapSlot(): SlotName;
  get snaps(): Snapshot[];
  set snaps(value: Snapshot[]);
  set snapNote(value: string);
  resetArena(): void;
  resetSkillDiscovery(): void;
  /** Stop the old wake loop and start exactly one new one for this run. */
  restartLoop(): void;
  captureCharacterUi(): CharacterUiSnapshot;
  restoreCharacterUi(snapshot: CharacterUiSnapshot): void;
  resetCharacterUi(): void;
  equipCarriedBest(): void;
}

/**
 * Account persistence orchestration: slots, autosave, snapshots, import/export and writer takeover.
 * The pure save rules live in `state/save.ts`; this is the session around them.
 */
export function createSessionActions(ctx: SessionContext) {
  function attachSlot(slot: SlotName, epoch: number): boolean {
    if (!ctx.saveSession.attach(slot, epoch)) return false;
    ctx.attachedSlot = slot;
    return true;
  }

  /** Drop the autosave binding first; the epoch makes a stale write unable to rebind. */
  function detachSlot(): number {
    ctx.attachedSlot = null;
    return ctx.saveSession.detach();
  }

  function cancelOfflineLoad() {
    ctx.loadController?.abort();
    if (ctx.showcaseMode) { ctx.offlineProgress = null; ctx.loadController = null; }
  }

  async function doSave(slot: SlotName, quiet = false) {
    if (ctx.showcaseMode) return;
    if (!ctx.canWriteAccount) { ctx.saveNote = 'This tab does not control account saves.'; return; }
    const epoch = ctx.saveSession.checkpoint();
    try {
      if (!await ctx.saveSession.save(slot, ctx.gameState)) return;
      ctx.attachedSlot = slot;
      ctx.persistenceError = null;
      if (!quiet) {
        ctx.gameState = { ...ctx.gameState };
        ctx.saveNote = `Saved to ${slot}`;
        if (slot === ctx.snapSlot) await loadSnaps();
      }
    } catch (error) {
      if (ctx.saveSession.isCurrent(epoch)) {
        ctx.persistenceError = `Save failed: ${error instanceof Error ? error.message : 'browser storage failed'}`;
        ctx.saveNote = ctx.persistenceError ?? '';
      }
    }
  }

  async function loadSnaps() {
    if (ctx.showcaseMode) { ctx.snaps = []; ctx.snapNote = 'Snapshots are disabled in the Showcase.'; return; }
    ctx.snaps = await listSnapshots(ctx.snapSlot);
    ctx.snapNote = ctx.snaps.length ? '' : 'No backup yet — one is owed on the next level up, craft or timer.';
  }

  async function restore(index: number): Promise<boolean> {
    if (ctx.showcaseMode || !ctx.canWriteAccount) return false;
    const targetSlot = ctx.snapSlot;
    const previousSlot = ctx.saveSession.slot;
    const epoch = detachSlot();
    ctx.paused = true;
    try {
      const s = await ctx.saveSession.run(() => restoreSnapshot(targetSlot, index));
      if (!ctx.saveSession.isCurrent(epoch)) return false;
      if (!s) { if (previousSlot) attachSlot(previousSlot, epoch); ctx.snapNote = 'That backup is gone'; return false; }
      ctx.gameState = s;
      // A rewind replaces the character, so the living arena must start a new generation too.
      if (ctx.liveArpgArena) ctx.resetArena();
      ctx.resetCharacterUi();
      ctx.awayReport = null;
      ctx.resetSkillDiscovery();
      attachSlot(targetSlot, epoch);
      const what = describeSnap(ctx.snaps[index]);
      await loadSnaps();
      ctx.snapNote = `Rewound ${targetSlot} to the backup taken ${what} — the character went back whole, stones and craft counts with it`;
      return true;
    } catch (error) {
      if (ctx.saveSession.isCurrent(epoch)) {
        if (previousSlot) attachSlot(previousSlot, epoch);
        ctx.snapNote = `Cannot rewind: ${error instanceof Error ? error.message : 'the backup failed validation'}`;
      }
      return false;
    } finally { if (ctx.saveSession.isCurrent(epoch)) ctx.paused = false; }
  }

  async function doLoad(slot: SlotName) {
    if (ctx.showcaseMode) return false;
    ctx.loadController?.abort();
    const controller = new AbortController();
    ctx.loadController = controller;
    const previous = ctx.gameState;
    const previousSlot = ctx.saveSession.slot;
    const epoch = detachSlot();
    let ui: CharacterUiSnapshot | null = null;
    ctx.offlineProgress = { done: 0, total: 0 };
    ctx.paused = true;
    try {
      await ctx.saveSession.flush();
      const s = await readSave(slot);
      if (!ctx.saveSession.isCurrent(epoch)) return false;
      if (!s || controller.signal.aborted) {
        if (previousSlot) attachSlot(previousSlot, epoch);
        ctx.saveNote = controller.signal.aborted ? 'Load cancelled; your character and saved slot were kept.' : `${slot} is empty`;
        return false;
      }
      ui = ctx.captureCharacterUi();
      ctx.gameState = { ...s };
      const away = (Date.now() - (s.lastSavedAt || Date.now())) / 1000;
      const before = snapCounters(ctx.gameState);
      // a load never clears the statuses the save just carried in (§7.7)
      const r = ctx.canWriteAccount ? await catchUpAsync(ctx.gameState, away, {
        autoSkills: ctx.settings.autoSkills !== false, signal: controller.signal,
        onProgress: (done, total) => { if (ctx.saveSession.isCurrent(epoch)) ctx.offlineProgress = { done, total }; },
      }) : { simulated: 0, capped: false, cancelled: false };
      if (!ctx.saveSession.isCurrent(epoch)) return false;
      if (r.cancelled) {
        ctx.gameState = previous;
        if (ctx.liveArpgArena) ctx.resetArena();
        if (ui) ctx.restoreCharacterUi(ui);
        if (previousSlot) attachSlot(previousSlot, epoch);
        ctx.saveNote = 'Load cancelled; your character and saved slot were kept.';
        return false;
      }
      if (ctx.canWriteAccount && ctx.settings.autoEquip !== false) ctx.equipCarriedBest();
      ctx.awayReport = ctx.settings.offlineReport ? buildAwayReport(before, Math.round(away / 60), r.simulated, r.capped, ctx.gameState) : null;
      // this slot becomes the autosave home, and the away window is spent (a reload must not recount it)
      ctx.resetSkillDiscovery();
      attachSlot(slot, epoch);
      ctx.resetCharacterUi();
      ctx.takeoverSlot = slot;
      if (ctx.canWriteAccount) ctx.gameState.lastSavedAt = Date.now();
      ctx.saveNote = ctx.canWriteAccount
        ? `Loaded ${slot} — ${r.simulated} sec caught up`
        : `Loaded ${slot} read-only — ${r.simulated} sec caught up`;
      ctx.gameState = { ...ctx.gameState };
      if (ctx.liveArpgArena) ctx.resetArena();
      return true;
    } catch (error) {
      // a save that fails migration validation (removed content, illegal transitions) must say so —
      // an unhandled rejection leaves the player staring at the slot they just clicked
      if (ctx.saveSession.isCurrent(epoch)) {
        ctx.gameState = previous;
        if (ctx.liveArpgArena) ctx.resetArena();
        if (ui) ctx.restoreCharacterUi(ui);
        if (previousSlot) attachSlot(previousSlot, epoch);
        ctx.saveNote = `Cannot load ${slot}: ${error instanceof Error ? error.message : 'the save failed validation'} — your character and slot were kept.`;
      }
      return false;
    } finally {
      if (ctx.saveSession.isCurrent(epoch)) { ctx.paused = false; ctx.offlineProgress = null; ctx.loadController = null; }
    }
  }

  async function takeOverAccount(): Promise<boolean> {
    if (ctx.showcaseMode || ctx.accountWriterState !== 'readonly') return false;
    const controller = new AbortController();
    ctx.takeoverController = controller;
    ctx.accountWriterState = 'waiting';
    const result = await requestAccountWriterLock({ wait: true, signal: controller.signal });
    if (ctx.takeoverController !== controller) {
      if (result.status === 'acquired') result.release();
      return false;
    }
    ctx.takeoverController = null;
    if (result.status !== 'acquired') {
      ctx.accountWriterState = result.status === 'cancelled' ? 'readonly' : 'unsupported';
      return false;
    }
    ctx.accountWriterLease = result;
    ctx.accountWriterState = 'owner';
    const loaded = await doLoad(ctx.takeoverSlot);
    if (!loaded) {
      ctx.accountWriterLease.release();
      ctx.accountWriterLease = null;
      ctx.accountWriterState = 'readonly';
      ctx.saveNote = `${ctx.takeoverSlot} is empty. Choose a slot with a saved character before taking over.`;
      return false;
    }
    return true;
  }

  function cancelTakeover() {
    ctx.takeoverController?.abort();
  }

  function download() {
    if (ctx.showcaseMode) return;
    const blob = new Blob([exportJson(ctx.gameState)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `modworld-${ctx.gameState.player.level}.json`;
    // A detached anchor click is ignored by some headless browsers; attach, press, detach.
    // Revoking synchronously can win the race against the download starting, so the URL lives
    // until the next export replaces it, then the old one is released.
    document.body.appendChild(a);
    a.click();
    a.remove();
    const stale = (download as { lastUrl?: string }).lastUrl;
    if (stale) URL.revokeObjectURL(stale);
    (download as { lastUrl?: string }).lastUrl = a.href;
  }

  async function upload(ev: Event): Promise<boolean> {
    if (ctx.showcaseMode || !ctx.canWriteAccount) return false;
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return false;
    const epoch = ctx.saveSession.checkpoint();
    const previousSlot = ctx.saveSession.slot;
    try {
      // Validate the file and merge the shared account before anything detaches: a bad import
      // leaves both the run and its slot exactly where they were.
      const imported = importJson(await file.text());
      if (!ctx.saveSession.isCurrent(epoch)) return false;
      const account = await readAccount();
      if (!ctx.saveSession.isCurrent(epoch)) return false;
      applyAccount(account, imported);
      detachSlot();
      ctx.gameState = imported;
      ctx.resetCharacterUi();
      ctx.awayReport = null;
      ctx.resetSkillDiscovery();
      ctx.saveNote = 'Imported in memory. Choose a save slot to keep this character.';
      ctx.gameState = { ...ctx.gameState };
      if (ctx.liveArpgArena) ctx.resetArena();
      return true;
    } catch (e) {
      if (ctx.saveSession.isCurrent(epoch)) {
        if (previousSlot) attachSlot(previousSlot, epoch);
        ctx.saveNote = `Import failed: ${(e as Error).message} — your current slot was not changed. Start a new character to play the current tree.`;
      }
      return false;
    }
  }

  async function reset(): Promise<boolean> {
    if (ctx.showcaseMode || !ctx.canWriteAccount) return false;
    ctx.loadController?.abort();
    const epoch = detachSlot();
    ctx.offlineProgress = null;
    try {
      // A new character keeps the shared account (Mastery, play time) but no slot: autosave only
      // starts after an explicit Save. The epoch stops a slow read from replacing a newer run.
      const account = await readAccount();
      if (!ctx.saveSession.isCurrent(epoch)) return false;
      ctx.paused = false;
      ctx.gameState = applyAccount(account, newGame(undefined, crypto.getRandomValues(new Uint32Array(1))[0]));
      if (ctx.liveArpgArena) ctx.resetArena();
      ctx.restartLoop();
      ctx.resetCharacterUi();
      ctx.awayReport = null;
      ctx.resetSkillDiscovery();
      ctx.saveNote = 'New character is not saved yet. Choose a save slot; existing slots were kept.';
      return true;
    } catch (error) {
      if (ctx.saveSession.isCurrent(epoch)) {
        ctx.persistenceError = `Cannot start a new character: ${error instanceof Error ? error.message : 'the shared account could not be read'}`;
        ctx.saveNote = ctx.persistenceError;
      }
      return false;
    }
  }

  /** The unload flush must be synchronous: IndexedDB commits asynchronously and the page can be gone
   *  first, so `writeSaveSync` writes the mirror in one turn. It refreshes the away stamp too, so a
   *  reload right after cannot count the same absence twice. */
  function flushSync(event?: Event): void {
    if (!ctx.canWriteAccount || !ctx.saveSession.slot) return;
    try { writeSaveSync(ctx.saveSession.slot, ctx.gameState); ctx.persistenceError = null; }
    catch (error) {
      ctx.persistenceError = error instanceof Error ? error.message : 'Emergency save failed; export JSON before closing.';
      ctx.saveNote = ctx.persistenceError ?? '';
      if (event?.type === 'beforeunload') {
        event.preventDefault();
        (event as BeforeUnloadEvent).returnValue = '';
      }
    }
  }

  return {
    cancelOfflineLoad, doSave, loadSnaps, restore, doLoad, takeOverAccount, cancelTakeover,
    download, upload, reset, flushSync,
  };
}
