import type { GameState } from '../sim/types';
import { newSkillState } from '../sim/skills';
import { newTown } from '../sim/town';
import { newFarm } from '../sim/farm';
import { newPresets } from '../sim/presets';
import { newCollector, newGrants } from '../sim/collector';
import { newFilter, refresh as refreshFilter } from '../sim/filter';
import { newGoal } from '../sim/goal';
import { newCurses } from '../sim/curse';
import { newMobStatusStore } from '../sim/mobStatus';
import { reason as snapshotReason, arm as armSnapshot, SAVE_CFG } from '../sim/snapshot';
import { E, BASES, loot } from '../engine/client';

// save.md: local only, three slots, IndexedDB with a localStorage fallback, JSON export/import.
// The town layer is a schema bump, and an import at a different version is rejected rather than
// converted — a converted save could carry a Reroll baseline or craft counter that never existed.
// v4 is the 7-line skeleton: a v3 item is re-stamped, not discarded (D-123). v5 bakes the Core stat
// onto every Stat Mod line, so a v4 piece keeps the stat its player chose (D-127). v6 grows the worn
// set to a thirteenth slot, the earring (D-131), so a v5 gear array is padded back to full length.
const DB_NAME = 'modworld';
const STORE = 'saves';
const ACCOUNT_KEY = 'account';
export const SCHEMA_VERSION = 7;
const SLOTS = ['slot1', 'slot2', 'slot3'] as const;
export type SlotName = (typeof SLOTS)[number];

/** What the three character slots share (`save.md` decision 2). */
export interface Account {
  version: number;
  mastery: Record<string, number>;
  totalPlaySec: number;
  playtimeBySlot: Record<string, number>;
}

export function newAccount(): Account {
  return { version: SCHEMA_VERSION, mastery: {}, totalPlaySec: 0, playtimeBySlot: {} };
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const lsKey = (key: string) => `modworld:${key}`;

async function put(key: string, payload: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(payload, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    if (typeof localStorage !== 'undefined') localStorage.setItem(lsKey(key), payload);
  }
}

async function get(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ? String(req.result) : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(lsKey(key)) : null;
  }
}

/** Client-only preferences (not part of a save slot): number format and the offline-report toggle. */
export interface ClientSettings { numberFormat: 'plain' | 'short'; offlineReport: boolean; }
export const DEFAULT_SETTINGS: ClientSettings = { numberFormat: 'plain', offlineReport: true };
export async function readSettings(): Promise<ClientSettings> {
  const raw = await get('settings');
  if (!raw) return { ...DEFAULT_SETTINGS };
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export async function writeSettings(s: ClientSettings): Promise<void> { await put('settings', JSON.stringify(s)); }

/** Account-wide Mastery is the shared truth: the best value any slot reached wins. */
export function mergeMastery(account: Account, state: GameState, slot = 'current'): Account {
  for (const [weapon, xp] of Object.entries(state.mastery)) {
    account.mastery[weapon] = Math.max(account.mastery[weapon] || 0, xp);
  }
  // total play time is account-wide, so each slot's own line is what grows it (`save.md`)
  const prev = account.playtimeBySlot[slot] || 0;
  if (state.counters.playSec > prev) account.totalPlaySec += state.counters.playSec - prev;
  account.playtimeBySlot[slot] = state.counters.playSec;
  return account;
}

export function applyAccount(account: Account, state: GameState): GameState {
  state.mastery = { ...account.mastery };
  return state;
}

/**
 * Write the slot, and take a snapshot first when one is owed (`save.md` item 5). The snapshot is
 * stored outside the slot record it protects — a copy inside the file it guards would be lost
 * with it.
 */
export async function writeSave(slot: SlotName, state: GameState): Promise<void> {
  const account = mergeMastery(await readAccount(), state, slot);
  await put(ACCOUNT_KEY, JSON.stringify(account));
  const why = snapshotReason(state);
  const shot = why
    ? { version: SCHEMA_VERSION, reason: why, clockSec: state.clockSec, takenAt: Date.now(), state: JSON.parse(JSON.stringify({ ...state, pendingSnapshot: null })) }
    : null;
  if (why) armSnapshot(state);
  await put(slot, JSON.stringify({ version: SCHEMA_VERSION, state }));
  if (shot) await pushSnapshot(slot, shot);
}

export interface Snapshot {
  version?: number;
  reason: string;
  clockSec: number;
  takenAt: number;
  state: GameState;
}

const snapKey = (slot: SlotName) => `snap:${slot}`;

async function readSnapshots(slot: SlotName): Promise<Snapshot[]> {
  const raw = await get(snapKey(slot));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Snapshot[];
  } catch {
    return [];
  }
}

/** Walking snapshots: newest first, `save.snapshot_slots` of them, then the oldest is overwritten. */
async function pushSnapshot(slot: SlotName, shot: Snapshot): Promise<void> {
  const list = [shot, ...(await readSnapshots(slot))].slice(0, SAVE_CFG.snapshot_slots);
  await put(snapKey(slot), JSON.stringify(list));
}

export async function listSnapshots(slot: SlotName): Promise<Snapshot[]> {
  return readSnapshots(slot);
}

/**
 * Restore rewinds the whole character and rebuilds the shared record from the slot files that
 * survive, so a snapshot cannot keep a later craft's Mastery while discarding its cost
 * (`save.md` item 3).
 */
export async function restoreSnapshot(slot: SlotName, index: number): Promise<GameState | null> {
  const shot = (await readSnapshots(slot))[index];
  if (!shot) return null;
  // the record inside the backup is the truth at that moment; the shared half is rebuilt after
  const state = migrate(JSON.parse(JSON.stringify(shot.state)) as GameState, shot.version ?? 0);
  state.pendingSnapshot = null;
  await put(slot, JSON.stringify({ version: SCHEMA_VERSION, state }));
  await put(ACCOUNT_KEY, JSON.stringify(await rebuildAccount()));
  return state;
}

/** The account record is derived from the three slot files, never trusted from the wire. */
export async function rebuildAccount(): Promise<Account> {
  const account = newAccount();
  for (const slot of SLOTS) {
    const raw = await get(slot);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      mergeMastery(account, (parsed.state || parsed) as GameState, slot);
    } catch {
      // a slot file that will not parse is the exact case the snapshots exist for
    }
  }
  return account;
}

export async function readAccount(): Promise<Account> {
  const raw = await get(ACCOUNT_KEY);
  if (!raw) return newAccount();
  try {
    return { ...newAccount(), ...(JSON.parse(raw) as Account) };
  } catch {
    return newAccount();
  }
}

export async function readSave(slot: SlotName): Promise<GameState | null> {
  const raw = await get(slot);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  const state = (parsed.state || parsed) as GameState;
  return applyAccount(await readAccount(), migrate(state, parsed.version ?? 0));
}

/**
 * A v3 item predates the 7-line skeleton, so it gains the Base Mod its frame forces and keeps every
 * line it had — the old Legacy pair slides to lines 2-3 (`D-123`). The line is built at the lowest
 * Tier and lowest value of the piece's quality band with no RNG, so two loads of one save agree to
 * the digit. A frame the rename left unmatched simply keeps its lines, with no Base Mod.
 */
function restampItem(item: any): void {
  if (!item || !Array.isArray(item.lines)) return;
  const frame = BASES.bases.find((b: any) => b.name === item.base && b.slot === item.slot) || null;
  const weapon = frame ? null : BASES.weapons.find((w: any) => item.base === w.name) || null;
  const q = item.q ?? Math.max(0, loot.BAND_LABEL.indexOf(item.quality));
  const base = loot.baseModAtFloor(BASES, item.slot, frame, weapon, q);
  if (base.length) item.lines = [...base, ...item.lines];
}

/**
 * A v4 item predates the stat roll (D-127): its Stat Mod line was told which Core stat to feed by the
 * player (`item.chosenStat`), and the line itself carried none. This bakes that choice onto the line,
 * or the piece's own first stat when nobody chose, so a migrated save keeps exactly the numbers it had
 * and every later Stat Mod line names its own stat the way a fresh drop does.
 */
function restatItem(item: any): void {
  if (!item || !Array.isArray(item.lines)) return;
  const fallback = item.chosenStat || loot.STAT_ROLLS[0];
  for (const line of item.lines) {
    if (line && line.id === 'stat_mod_flat' && !line.stat) line.stat = fallback;
  }
  delete item.chosenStat;
}

/** A save written by an earlier build is missing whole subsystems; fill the shape in. */
export function migrate(s: GameState, fromVersion: number = SCHEMA_VERSION): GameState {
  if (fromVersion < 4) {
    for (const item of s.gear || []) restampItem(item);
    for (const item of s.bag || []) restampItem(item);
    for (const tab of s.stash || []) for (const item of tab || []) restampItem(item);
  }
  if (fromVersion < 5) {
    for (const item of s.gear || []) restatItem(item);
    for (const item of s.bag || []) restatItem(item);
    for (const tab of s.stash || []) for (const item of tab || []) restatItem(item);
  }
  if (fromVersion < 6 && Array.isArray(s.gear)) {
    // the earring is a thirteenth worn slot (D-131), so a v5 save's twelve-long gear array is
    // padded with the empty slots a fresh character has; the piece already worn keeps its index
    const n = E.stat.item_slots as number;
    while (s.gear.length < n) s.gear.push(null);
  }
  if (!s.skills) s.skills = newSkillState();
  if (!s.healUp) s.healUp = null;
  if (!s.spawnIn && s.spawnIn !== 0) s.spawnIn = 0;
  if (!s.counters.zoneKills) s.counters.zoneKills = {};
  if (!s.counters.stones) s.counters.stones = {};
  if (!s.junkByRarity) s.junkByRarity = {};
  if (!s.town) s.town = newTown();
  if (!s.farm) s.farm = newFarm();
  // a farm saved before the automation block existed gets it off; the player opts in
  if (s.farm && !s.farm.autoFarm) { s.farm.autoFarm = { plant: false, harvest: false, brew: false }; s.farm.lastAutoFarmAt = -9999; }
  // an older character auto-allocates its points (the idle default); manual is the opt-out (D-141)
  if (s.player && s.player.autoSpend == null) s.player.autoSpend = true;
  if (!s.stash) s.stash = [];
  // an older save auto-dissolves nothing; the player opts in
  if (!s.autoDissolveRarity) s.autoDissolveRarity = 'off';
  if (!s.purseDay) s.purseDay = {};
  if (!s.chestDay) s.chestDay = {};
  // a Road saved before the Circuit existed is a one-off trip: no loop, no chest ledger entry
  if (s.road) {
    if (!Array.isArray(s.road.circuit)) s.road.circuit = [];
    if (s.road.legIndex == null) s.road.legIndex = 0;
    if (s.road.laps == null) s.road.laps = 0;
    if (s.road.chestPaid == null) s.road.chestPaid = false;
  }
  if (!s.mastery) s.mastery = {};
  if (!s.presets) s.presets = newPresets();
  if (s.activePreset == null) s.activePreset = 0;
  if (!s.collector) s.collector = newCollector();
  if (!s.grants) s.grants = newGrants();
  if (!s.pedlar) s.pedlar = { day: 0, minutes: [], bought: 0 };
  if (!s.filter) s.filter = newFilter();
  if (s.travel !== 'forward') s.travel = 'stay';
  if (!s.goal) s.goal = newGoal();
  if (!s.curses) s.curses = newCurses();
  if (!s.mobStatus) s.mobStatus = newMobStatusStore();
  if (s.pendingSnapshot === undefined) s.pendingSnapshot = null;
  if (!s.nextSnapshotAt && s.nextSnapshotAt !== 0) s.nextSnapshotAt = 0;
  refreshFilter(s);
  return s;
}

export function exportJson(state: GameState): string {
  return JSON.stringify({ version: SCHEMA_VERSION, state }, null, 1);
}

/** Import rejects a foreign schema version instead of guessing at a conversion (`save.md` item 4). */
export function importJson(text: string): GameState {
  const parsed = JSON.parse(text);
  const version = parsed.version == null ? 'none' : parsed.version;
  if (parsed.version !== SCHEMA_VERSION) {
    throw new Error(`schema version ${version} ≠ ${SCHEMA_VERSION}`);
  }
  const state = parsed.state as GameState;
  if (!state.player || !state.counters) throw new Error('not a ModWorld save');
  return migrate(state);
}

export const saveSlots = SLOTS;
