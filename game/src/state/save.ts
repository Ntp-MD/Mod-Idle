import type { GameState } from '../sim/types';
import { normalizeAlchemyLedger } from '../../../engine/alchemy.ts';
import { normalizeBlackMarket } from '../sim/black-market';
import { ACTIVE_SLOTS, clampAuraReservations, clearUnownedTracks, effectsActive, newSkillState } from '../sim/skills';
import { newTown } from '../sim/town';
import { normalizeDeliveries } from '../sim/delivery';
import { normalizeQuestRewards } from '../sim/quest-rewards';
import { normalizeExplorationState } from '../sim/exploration';
import { normalizeMapJournal } from '../sim/map-exploration';
import { newFarm, QUICKBAR_SLOTS } from '../sim/farm';
import { slotsAvailable, slotsUsed } from '../sim/slots';
import { newFieldwork, normalizeCampEncounterState } from '../sim/fieldwork';
import { newPresets } from '../sim/presets';
import { newCollector, newGrants } from '../sim/collector';
import { newFilter, refresh as refreshFilter } from '../sim/filter';
import { newGoal } from '../sim/goal';
import { buildCharacter } from '../sim/player';
import { newCurses } from '../sim/curse';
import { newMobStatusStore } from '../sim/mobStatus';
import { newKeystoneRuntimeState, validateKeystoneRuntime, validatePlayerStatuses } from '../../../engine/keystones.ts';
import { reason as snapshotReason, arm as armSnapshot, SAVE_CFG } from '../sim/snapshot';
import { E, TOWN, BASES, eng, loot, sm, tree, STAT_KEYS, type StatKey } from '../engine/client';
import { road } from '../sim/road';
import { newEconomyState, validateEconomy } from '../sim/economy';

// save.md: local only, three slots, IndexedDB with a localStorage fallback, JSON export/import.
// The town layer is a schema bump, and an import at a different version is rejected rather than
// converted — a converted save could carry a Reroll baseline or craft counter that never existed.
// v4 is the 7-line skeleton: a v3 item is re-stamped, not discarded. v5 bakes the Core attribute
// onto every Stat Mod line, so a v4 piece keeps the stat its player chose. v6 grows the worn
// set to a thirteenth slot, the earring, so a v5 gear array is padded back to full length.
// v9 is the item level: the value window moved onto the level and Rarity was retired, and a v8 item
// gains the level its band starts at with its labels flipped onto the new order. A v9 item keeps
// whatever line count it holds — the Normal count is drawn at drop from `item_level.unbound_slots`,
// which is data, not schema. v10 deletes the hunt
// systems: the per-zone Hunt Order and the per-zone hunting ground are gone, so a v9 save's fields for
// them are dropped — the variant's own lean is the only lean left. v11 is the HUD's transient event
// ring (`fx`), which a write never stores. v12 is the hex the feet stand on: a walk joins two cells
// rather than two settlement ids, so a v11 walk is re-read through the walk graph's own coordinates and
// an in-flight route that names no settlement is dropped rather than left to compute NaN blocks.
// v13 adds the persistent field Camp, field-skill tracks, materials, meals and active meal timer.
// v14 adds Hunger, Auto Eat, ten carried food types and persistent trail-event provisions. v15 adds
// the Alchemy ledger. v16 adds optional Patrol and Auto-Return settings with an empty-route default.
// v18 moves the statuses ON the character and the keystone runtime into the saved state (§7.7): a
// pre-v18 save carried neither, so it backfills empty ones; a save claiming v18 must hold both
// whole — the reader refuses a missing or impossible field by name rather than default-filling it.
// v20 adds the city ledger (`town.json → economy`): an older save replays its own clock in whole
// steps so the city world it meets is the one its play time implies.
const DB_NAME = 'modworld';
const STORE = 'saves';
const ACCOUNT_KEY = 'account';
export const SCHEMA_VERSION = 20;

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
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((error) => { dbPromise = null; throw error; });
  }
  return dbPromise;
}

const lsKey = (key: string) => `modworld:${key}`;

/**
 * The localStorage mirror is written synchronously, so a `beforeunload` flush survives: an IndexedDB
 * write is async and the page can be gone before its transaction commits, while the same bytes hit
 * localStorage before the handler returns. Keep an older mirror on failure until the database has
 * confirmed its replacement; otherwise both failures could destroy the only recoverable copy.
 */
function lsWrite(key: string, payload: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try { localStorage.setItem(lsKey(key), payload); return true; }
  catch { return lsRead(key) === payload; }
}

function lsRead(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try { return localStorage.getItem(lsKey(key)); } catch { return null; }
}

async function put(key: string, payload: string): Promise<void> {
  const previousMirror = lsRead(key);
  const mirrored = lsWrite(key, payload);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(payload, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Save transaction aborted'));
    });
  } catch {
    if (!mirrored) throw new Error('Browser storage could not save your progress. Export JSON before closing, then free storage or allow browser storage and try again.');
    return;
  }
  // A synchronous unload flush can replace the mirror while this transaction awaits its commit.
  // Remove only the stale copy this write actually encountered, never a newer emergency save.
  if (!mirrored && previousMirror !== null && previousMirror !== payload && lsRead(key) === previousMirror) {
    try { localStorage.removeItem(lsKey(key)); } catch { /* Report the stale mirror below. */ }
    if (lsRead(key) !== null) throw new Error('The database saved, but an older browser copy could not be replaced. Export JSON before closing and repair browser storage.');
  }
}

async function get(key: string): Promise<string | null> {
  // the mirror first: every `put` writes it synchronously, so it can never be staler than the DB, and
  // an unload flush mid-transaction is a save the next session actually reads
  const local = lsRead(key);
  if (local != null) return local;
  try {
    const db = await openDb();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ? String(req.result) : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Client-only preferences (not part of a save slot): number format, the offline-report toggle, and the
 * keyboard map. Bindings live here rather than in `GameState` because they belong to the hand on the
 * keyboard, not to the character — one set serves all three slots, and a save file never carries them.
 * `keybinds` is a sparse override: an action missing from it takes its default, so adding a bound action
 * later cannot strand an old settings record.
 */
export interface ClientSettings {
  numberFormat: 'plain' | 'short';
  offlineReport: boolean;
  keybinds?: Record<string, string>;
  /** how far ahead a piece must be before "put on the best I carry" will trade for it, in percent */
  equipMargin?: number;
  /** the clock's pace: how many sim seconds a real second spends (the field's ×1 ×2 ×4 switch) */
  speed?: 1 | 2 | 4;
  /** whether the simulation automatically presses ready skill rows */
  autoSkills?: boolean;
  /** whether better gear found in the carried bag is equipped automatically */
  autoEquip?: boolean;
  /** the hub's drag offset from its docked corner, in px — wheel and satellites move as one */
  hub?: { x: number; y: number };
}
export const DEFAULT_SETTINGS: ClientSettings = { numberFormat: 'plain', offlineReport: true, keybinds: {}, equipMargin: 0, autoSkills: true, autoEquip: true };
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
  // The account record is the shared truth, but it is a derived file: if it is missing or will not
  // parse, `readAccount` hands back an empty one. Overwriting the slot's Mastery with that would
  // zero every weapon the moment the record is lost, so keep the higher of the two per weapon —
  // the same rule `mergeMastery` uses across the three slots.
  state.mastery = state.mastery || {};
  for (const [weapon, xp] of Object.entries(account.mastery || {})) {
    state.mastery[weapon] = Math.max(state.mastery[weapon] || 0, xp);
  }
  return state;
}

const emergencySaveRevision: Partial<Record<SlotName, number>> = {};

/**
 * Write the slot, and take a snapshot first when one is owed (`save.md` item 5). The snapshot is
 * stored outside the slot record it protects — a copy inside the file it guards would be lost
 * with it.
 */
export async function writeSave(slot: SlotName, state: GameState): Promise<void> {
  const revision = emergencySaveRevision[slot];
  const current = () => emergencySaveRevision[slot] === revision;
  const beforeStamp = state.lastSavedAt;
  const saved = JSON.parse(JSON.stringify({ ...state, lastSavedAt: Date.now() })) as GameState;
  const pending = saved.pendingSnapshot;
  const account = await readAccount();
  if (!current()) return;
  await put(ACCOUNT_KEY, JSON.stringify(mergeMastery(account, saved, slot)));
  if (!current()) return;
  const why = snapshotReason(saved);
  const shot = why
    ? { version: SCHEMA_VERSION, reason: why, clockSec: saved.clockSec, takenAt: Date.now(), state: { ...saved, pendingSnapshot: null } }
    : null;
  if (shot) await pushSnapshot(slot, shot, current);
  if (!current()) return;
  if (why) armSnapshot(saved);
  await put(slot, JSON.stringify({ version: SCHEMA_VERSION, state: { ...saved, fx: [] } }));
  if (!current()) return;
  if (state.lastSavedAt === beforeStamp) state.lastSavedAt = saved.lastSavedAt;
  if (why && state.pendingSnapshot === pending && state.clockSec === saved.clockSec) {
    state.pendingSnapshot = saved.pendingSnapshot;
    state.nextSnapshotAt = saved.nextSnapshotAt;
  }
}

/** The account record as the mirror holds it — the synchronous twin of `readAccount`, for the unload path. */
function readAccountSync(): Account {
  const raw = lsRead(ACCOUNT_KEY);
  if (!raw) return newAccount();
  try {
    return { ...newAccount(), ...(JSON.parse(raw) as Account) };
  } catch {
    return newAccount();
  }
}

function parseSnapshots(raw: string | null): Snapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((shot) => shot?.state?.player && shot.state.counters && typeof shot.reason === 'string')
      : [];
  } catch {
    return [];
  }
}

function readSnapshotsSync(slot: SlotName): Snapshot[] {
  return parseSnapshots(lsRead(snapKey(slot)));
}

/**
 * The synchronous flush the unload path needs: `writeSave` awaits an account read and a transaction,
 * and the browser may tear the page down before either finishes. This writes the account, the slot and
 * any owed snapshot straight to the localStorage mirror in one turn, so closing the tab loses nothing.
 */
export function writeSaveSync(slot: SlotName, state: GameState): void {
  const saved = JSON.parse(JSON.stringify({ ...state, lastSavedAt: Date.now() })) as GameState;
  const accountOk = lsWrite(ACCOUNT_KEY, JSON.stringify(mergeMastery(readAccountSync(), saved, slot)));
  const why = snapshotReason(saved);
  let snapshotOk = true;
  if (why) {
    const shot: Snapshot = {
      version: SCHEMA_VERSION, reason: why, clockSec: saved.clockSec, takenAt: Date.now(),
      state: { ...saved, pendingSnapshot: null },
    };
    snapshotOk = lsWrite(snapKey(slot), JSON.stringify([shot, ...readSnapshotsSync(slot)].slice(0, SAVE_CFG.snapshot_slots)));
    if (snapshotOk) armSnapshot(saved);
  }
  const slotOk = lsWrite(slot, JSON.stringify({ version: SCHEMA_VERSION, state: { ...saved, fx: [] } }));
  // A confirmed visibility/unload save supersedes the async queue's older frozen state.
  // If the slot could not be written, let that queue finish its database recovery instead.
  if (slotOk) emergencySaveRevision[slot] = (emergencySaveRevision[slot] ?? 0) + 1;
  if (!accountOk || !snapshotOk || !slotOk)
    throw new Error('The emergency browser save failed. Export JSON before closing and retry a normal save. Your older saved copies were kept.');
  state.lastSavedAt = saved.lastSavedAt;
  state.pendingSnapshot = saved.pendingSnapshot;
  state.nextSnapshotAt = saved.nextSnapshotAt;
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
  return parseSnapshots(await get(snapKey(slot)));
}

/** Walking snapshots: newest first, `save.snapshot_slots` of them, then the oldest is overwritten. */
async function pushSnapshot(slot: SlotName, shot: Snapshot, current: () => boolean): Promise<void> {
  const list = [shot, ...(await readSnapshots(slot))].slice(0, SAVE_CFG.snapshot_slots);
  if (!current()) return;
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
  const raw = JSON.parse(JSON.stringify(shot.state)) as GameState;
  assertPassiveTreeVersion(raw);
  const state = migrate(raw, shot.version ?? 0);
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

/**
 * The passive tree is new-character-only: an allocation bought under another tree version has no
 * mapping into v3, so the character is refused by name. The slot is never deleted, rewritten or
 * refunded — a later build that understands its version is the only thing allowed to touch it.
 */
export function assertPassiveTreeVersion(state: GameState): void {
  if (state?.player?.passiveTreeVersion !== tree.version)
    throw new Error('ตัวละครนี้ใช้ passive tree รุ่นเก่า กรุณาสร้างตัวละครใหม่');
}

export async function readSave(slot: SlotName): Promise<GameState | null> {
  const raw = await get(slot);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  const state = (parsed.state || parsed) as GameState;
  assertPassiveTreeVersion(state);
  return applyAccount(await readAccount(), migrate(state, parsed.version ?? 0));
}

/**
 * A v3 item predates the 7-line skeleton, so it gains the Frame Mod its frame forces and keeps every
 * line it had — the old Bound pair slides to lines 2-3 (``). The line is built at the lowest value of
 * the piece's window with no RNG, so two loads of one save agree to the digit. A frame the rename left
 * unmatched simply keeps its lines, with no Frame Mod.
 */
function restampItem(item: any): void {
  if (!item || !Array.isArray(item.lines)) return;
  const frame = BASES.bases.find((b: any) => b.name === item.base && b.slot === item.slot) || null;
  const weapon = frame ? null : BASES.weapons.find((w: any) => item.base === w.name) || null;
  const q = item.q ?? Math.max(0, loot.BAND_LABEL.indexOf(item.quality));
  const band = loot.BAND_LABEL[q] || 'low';
  const base = loot.frameModAtFloor(BASES, item.slot, frame, weapon, item.ilvl ?? eng.floorLevelOf(band), q);
  if (base.length) item.lines = [...base, ...item.lines];
}

/**
 * A v8 item predates the item level. It gains the level its band starts at — the same level an offline
 * drop lands on, so the piece reads as the floor of the band it came from — and its labels are flipped
 * onto the new order, because the old T1 named the window's bottom and the new T1 names its top. Every
 * value it holds is kept exactly as it was, and the Rarity field goes away.
 */
function levelItem(item: any): void {
  if (!item || !Array.isArray(item.lines)) return;
  const band = loot.BAND_LABEL[item.q ?? 0] || item.quality || 'low';
  if (item.ilvl == null) item.ilvl = Math.max(1, eng.floorLevelOf(band));
  for (const line of item.lines) if (line && line.slice != null) line.slice = 2 - line.slice;
  // the item-level tier label rides the same flip, so a piece's tier keeps describing its own lines
  if (item.tier === 'T1') item.tier = 'T3';
  else if (item.tier === 'T3') item.tier = 'T1';
  delete item.rarity;
}

/**
 * A v4 item predates the stat roll: its Stat Mod line was told which Core attribute to feed by the
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

/** The broken auto-spend loop restarted its remainder at STR each level. Repair only the exact
 *  signature it produced, so manually-built or otherwise uneven characters keep their allocation. */
function repairLegacyAutoSpend(s: GameState): void {
  const p = s.player;
  if (!p?.points || !p.autoSpend || p.statPoints !== 0) return;
  const start = Number(E.opening.level) || 1;
  const level = Math.min(p.level, E.stat.level_cap as number);
  const total = eng.pointsAt(level) - eng.pointsAt(start);
  const spent = STAT_KEYS.reduce((sum, key) => sum + p.points[key], 0);
  if (total <= 0 || spent !== total) return;

  const legacy = Object.fromEntries(STAT_KEYS.map((key) => [key, 0])) as Record<StatKey, number>;
  for (let reached = start + 1; reached <= level; reached++) {
    const grant = reached >= E.stat.paragon_from ? E.stat.paragon_points_per_level : E.stat.points_per_level;
    const each = Math.floor(grant / STAT_KEYS.length);
    let remainder = grant;
    for (const key of STAT_KEYS) { legacy[key] += each; remainder -= each; }
    for (const key of STAT_KEYS) { if (remainder <= 0) break; legacy[key]++; remainder--; }
  }
  if (!STAT_KEYS.every((key) => p.points[key] === legacy[key])) return;

  const balanced = Object.fromEntries(STAT_KEYS.map((key) => [key, 0])) as Record<StatKey, number>;
  for (let left = total; left > 0; left--) {
    const least = STAT_KEYS.reduce((best, key) => balanced[key] < balanced[best] ? key : best, STAT_KEYS[0]);
    balanced[least]++;
  }
  p.points = balanced;
}

/** A save written by an earlier build is missing whole subsystems; fill the shape in. */
export function migrate(s: GameState, fromVersion: number = SCHEMA_VERSION): GameState {
  if (!Number.isInteger(fromVersion) || fromVersion < 0 || fromVersion > SCHEMA_VERSION) throw new Error(`schema version ${fromVersion} is not supported`);
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
    // the earring is a thirteenth worn slot, so a v5 save's twelve-long gear array is
    // padded with the empty slots a fresh character has; the piece already worn keeps its index
    const n = E.stat.item_slots as number;
    while (s.gear.length < n) s.gear.push(null);
  }
  // v8 · travel became walking. A v7 save has a Road trip, a carriage ledger and a bought-link count;
  // none of them exist now, so they are dropped. Every settlement it had already visited keeps its
  // Waypoint, because a visited settlement is what a Waypoint is — the walk to the rest starts again.
  if (fromVersion < 8) {
    delete (s as any).road;
    delete (s as any).purseDay;
    delete (s as any).chestDay;
    if (s.town) delete (s.town as any).linksBought;
  }
  // v12 · a walk joins two cells and the feet stand on one. A v11 save names settlements where the new
  // shape holds hexes, so both ends are read off the walk graph's own coordinates — and the standing
  // cell is where the last Waypoint anchor sits, because an old save could only ever be in a town.
  if (fromVersion < 12) {
    const home = road.nodeById(s.town?.waypoint || E.road.nodes[0].id) || E.road.nodes[0];
    s.cell = { q: home.q, r: home.r, sub: null, wild: null };
    const w = s.walk as any;
    const from = w && typeof w.from === 'string' ? road.nodeById(w.from) : null;
    const to = w && typeof w.to === 'string' ? road.nodeById(w.to) : null;
    if (!from || !to) {
      s.walk = null;
    } else {
      s.walk = {
        from: { q: from.q, r: from.r },
        to: { q: to.q, r: to.r },
        node: to.id,
        kind: 'town',
        sub: null,
        wild: null,
        blocksTotal: w.blocksTotal,
        blocksLeft: w.blocksLeft,
        secLeft: w.secLeft,
        blocksWalked: w.blocksWalked,
      };
    }
  }
  if (!s.walk) s.walk = null;
  if (!s.cell) {
    const home = road.nodeById(s.town?.waypoint || E.road.nodes[0].id) || E.road.nodes[0];
    s.cell = { q: home.q, r: home.r, sub: null, wild: null };
  }
  if (!s.dungeon) s.dungeon = null;
  // the quickbar arrived after v17: an old save opens with seven empty squares
  if (!Array.isArray(s.quickbar) || s.quickbar.length !== QUICKBAR_SLOTS)
    s.quickbar = Array.from({ length: QUICKBAR_SLOTS }, (_, i) => (Array.isArray(s.quickbar) ? s.quickbar[i] ?? null : null));
  // saves from before safe ground were always hunting: keep them hunting
  if (s.hunting == null) s.hunting = true;
  // pieces from before the drop-count stamp gain it back: current Unbound lines minus Add stones
  // taken, so the +2 net cap reads the same on an old piece as on a fresh drop.
  {
    const stamp = (item: any) => {
      if (!item || !Array.isArray(item.lines) || item.unbound_at_drop != null) return;
      const untouchable = (E.item_level.frame_mod_slots || 1) + (E.item_level.bound_slots || 2);
      item.unbound_at_drop = Math.max(0, item.lines.length - untouchable - (item.mods_added || 0));
    };
    for (const item of s.gear || []) stamp(item);
    for (const item of s.bag || []) stamp(item);
    for (const tab of s.stash || []) for (const item of tab || []) stamp(item);
  }
  // v9 · the item level replaced Rarity. Every piece the save holds gains its level and its labels are
  // flipped onto the new order; the auto-dissolve setting moves off the Rarity axis onto the level one,
  // keeping the same idea (the named Rarity's own band floor is where "keep above this" now starts).
  if (fromVersion < 9) {
    for (const item of s.gear || []) levelItem(item);
    for (const item of s.bag || []) levelItem(item);
    for (const tab of s.stash || []) for (const item of tab || []) levelItem(item);
    const old = (s as any).autoDissolveRarity as string | undefined;
    if (old && old !== 'off') s.autoDissolveLevel = eng.floorLevelOf(old === 'Rare' ? 'high' : 'mid');
    delete (s as any).autoDissolveRarity;
  }
  if (!s.skills) s.skills = newSkillState();
  s.skills.owned ||= {};
  s.skills.buffs ||= {};
  s.skills.auras ||= {};
  s.skills.buffUp ||= {};
  clearUnownedTracks(s.skills);
  // a skill the collection no longer knows is not an owned copy and not a rotation slot; the raw
  // list stays readable until the §14 copy below has read it, and is sanitised right after
  for (const key of Object.keys(s.skills.owned)) if (!sm.byId[key]) delete s.skills.owned[key];
  for (const key of Object.keys(s.skills.xp || {})) if (!sm.byId[key]) delete s.skills.xp[key];
  s.skills.list = Array.from({ length: ACTIVE_SLOTS }, (_, i) => s.skills.list?.[i] ?? null);
  // a save from before §14 has no per-slot mode and no condition lists: default them, so the
  // rotation keeps behaving exactly as it did (`always`) until the player changes something
  if (!s.skills.mode) s.skills.mode = {};
  if (!s.skills.conditions) s.skills.conditions = {};
  // §14 moved the list off the character and onto each conditional row. A save still holding the one
  // shared set is copied onto the rows that were reading it, so an existing rotation keeps firing
  const sharedCond = s.skills.conditions as any;
  if (sharedCond && ('boss' in sharedCond || 'hpBelowPct' in sharedCond)) {
    const perSlot: Record<string, any> = {};
    for (const id of s.skills.list || []) {
      if (id && s.skills.mode[id] === 'conditional') {
        perSlot[id] = {
          boss: Boolean(sharedCond.boss),
          hpBelowPct: Number(sharedCond.hpBelowPct) || 0,
          statusMissing: Array.isArray(sharedCond.statusMissing) ? [...sharedCond.statusMissing] : [],
          minTargets: 0,
          manaFloorPct: 0,
          statusPresent: false,
          statusStacksAtLeast: 0,
          selfDebuffed: false,
        };
      }
    }
    s.skills.conditions = perSlot;
  }
  for (const cond of Object.values(s.skills.conditions)) {
    if (!Array.isArray(cond.statusMissing)) cond.statusMissing = [];
    if (typeof cond.statusPresent !== 'boolean') cond.statusPresent = false;
    if (!Number.isFinite(cond.statusStacksAtLeast)) cond.statusStacksAtLeast = 0;
    if (typeof cond.selfDebuffed !== 'boolean') cond.selfDebuffed = false;
  }
  // the rotation reads every id raw (`castOnce`), so a dead id here would throw on the first
  // hunting tick, and an unowned one would cast without ownership — dropped, not kept
  s.skills.list = s.skills.list.map((id) => (id && sm.byId[id] && Object.hasOwn(s.skills.owned, id) ? id : null));
  if (!s.healUp) s.healUp = null;
  if (!s.spawnIn && s.spawnIn !== 0) s.spawnIn = 0;
  if (!s.counters.zoneKills) s.counters.zoneKills = {};
  if (!s.counters.stones) s.counters.stones = {};
  if (!s.junk) s.junk = {};
  // a save from before the tree existed holds no ranks; the points it banked are still there
  if (s.player && !s.player.treeRanks) s.player.treeRanks = {};
  if (s.player && s.player.attainmentPoints == null) s.player.attainmentPoints = 0;
  // junk used to be carried per RARITY; the item is per variant now, so a pre-variant stack is moved
  // onto one item of its own rarity. Every rarity is worth the same gold per kill by construction, so
  // the move is value-exact — nothing is deleted and no gold is minted (`junk.rarities` · X39).
  const junkByRarity = (s as any).junkByRarity as Record<string, number> | undefined;
  if (junkByRarity) {
    const firstOfRarity: Record<string, string> = {};
    for (const r of Object.values((E.mob as any).variant_drops || {}) as any[]) firstOfRarity[r.rarity] = firstOfRarity[r.rarity] || r.item;
    for (const [rarity, count] of Object.entries(junkByRarity)) {
      const item = firstOfRarity[rarity];
      if (item && count) s.junk[item] = (s.junk[item] || 0) + Number(count);
    }
    delete (s as any).junkByRarity;
  }
  // v10 · the hunt systems are gone: the per-zone Hunt Order override and the per-zone hunting ground
  // are deleted fields, and a save that still carries them simply loses them (the variant's lean, which
  // survives, is the only author of a lean now).
  if (fromVersion < 10) {
    delete (s as any).huntOrder;
    delete (s as any).zoneFocus;
  }
  if (!s.town) s.town = newTown();
  s.town.helpCredit ||= {};
  if (typeof s.town.helpCredit !== 'object' || Array.isArray(s.town.helpCredit)) s.town.helpCredit = {};
  const settlements = new Set((TOWN.settlements as { id: string }[]).map(row => row.id));
  for (const [id, amount] of Object.entries(s.town.helpCredit))
    if (!settlements.has(id) || !Number.isSafeInteger(amount) || amount < 0) delete s.town.helpCredit[id];
  // Additive task-skip state: an older save has used no free skips today.
  s.town.freeSkipsToday ??= 0;
  if (!Number.isSafeInteger(s.town.freeSkipsToday) || s.town.freeSkipsToday < 0) s.town.freeSkipsToday = 0;
  if (!Number.isSafeInteger(s.town.skipsToday) || s.town.skipsToday < 0) s.town.skipsToday = 0;
  if (!Number.isSafeInteger(s.town.skipDay) || s.town.skipDay < 0) s.town.skipDay = 0;
  // v16 · optional saved Patrol and Auto-Return backfill to an empty, disabled route; existing
  // inventory, task progress and location are preserved.
  normalizeExplorationState(s);
  normalizeMapJournal(s);
  // Additive market records preserve every existing stack and gold balance. Empty supply means full demand.
  s.town.market ||= {};
  s.town.marketCredit ??= 0;
  s.town.hagglingXp ??= 0;
  if (!Number.isFinite(s.town.hagglingXp) || s.town.hagglingXp < 0) throw new Error('invalid Haggling XP');
  // v11 · the HUD reads a transient event ring (`fx`), which a write never stores.
  if (!Array.isArray(s.fx)) s.fx = [];
  if (!s.fxSeq) s.fxSeq = 0;
  if (!s.farm) s.farm = newFarm();
  // v13 · field gathering, Camp and cooked meals did not exist in a v12 save.
  if (fromVersion < 13 || !s.fieldwork) s.fieldwork = newFieldwork(s.seed);
  s.fieldwork.campEncounters ||= newFieldwork(s.seed).campEncounters;
  normalizeCampEncounterState(s);
  // v14 · carry old meal and meat stacks into the unified provision bag, then add Hunger and Auto Eat.
  if (fromVersion < 14 || !s.fieldwork.foods) {
    const defaults = newFieldwork();
    const fw = s.fieldwork as any;
    const foods = { ...defaults.foods, ...(fw.foods || {}) };
    for (const [id, count] of Object.entries(fw.meals || {})) foods[id] = (foods[id] || 0) + Number(count || 0);
    foods.raw_game_meat = (foods.raw_game_meat || 0) + Number(fw.materials?.meat || 0);
    fw.foods = foods;
    const hunger = Number(fw.hunger);
    fw.hunger = Math.max(0, Math.min(E.fieldwork.hunger.max, Number.isFinite(hunger) ? hunger : E.fieldwork.hunger.max));
    fw.autoEat ||= defaults.autoEat;
    delete fw.meals;
    if (fw.materials) delete fw.materials.meat;
    s.fieldwork = fw;
  }
  s.fieldwork.materials = { ...newFieldwork().materials, ...s.fieldwork.materials };
  s.fieldwork.foods = { ...newFieldwork().foods, ...s.fieldwork.foods };
  const fieldDefaults = newFieldwork();
  for (const key of Object.keys(fieldDefaults.skills) as (keyof typeof fieldDefaults.skills)[]) {
    const saved = s.fieldwork.skills?.[key];
    if (!saved) s.fieldwork.skills[key] = { xp: 0, mastery: {} };
    else { saved.mastery ||= {}; }
  }
  s.farm.mastery ||= { low: 0, mid: 0, high: 0 };
  for (const tier of ['low', 'mid', 'high']) s.farm.mastery[tier] ||= 0;
  s.alchemy = normalizeAlchemyLedger(s.alchemy, E.salvage.alchemy.outputs_per_tier_stone, fromVersion < 15 ? s.counters.salvaged : undefined);
  normalizeBlackMarket(s);
  if (s.dungeon) s.dungeon.escrow.materials ||= {};
  normalizeDeliveries(s);
  normalizeQuestRewards(s);
  // a farm saved before the automation block existed gets it off; the player opts in
  if (s.farm && !s.farm.autoFarm) { s.farm.autoFarm = { plant: false, harvest: false, brew: false }; s.farm.lastAutoFarmAt = -9999; }
  // an older character auto-allocates its points (the idle default); manual is the opt-out 
  if (s.player && s.player.autoSpend == null) s.player.autoSpend = true;
  repairLegacyAutoSpend(s);
  if (!s.stash) s.stash = [];
  // v17 · the temporary adventure bag is gone: a kept gear piece and a carried stack now share the
  // one bag, so a legacy save carrying more pieces than the shared bag has room for moves the excess
  // into the first stash tab, oldest piece first. Nothing is deleted and a save that already fits is
  // left exactly as it was; an imported file that overflows is repaired by the same rule.
  if (Array.isArray(s.bag)) {
    for (let over = slotsUsed(s) - slotsAvailable(s); over > 0 && s.bag.length; over--) {
      const item = s.bag.pop()!;
      if (!s.stash.length) s.stash.push([]);
      s.stash[0].unshift(item);
    }
  }
  // an older save auto-dissolves nothing; the player opts in with a level floor
  if (s.autoDissolveLevel == null) s.autoDissolveLevel = 0;
  if (!s.mastery) s.mastery = {};
  // a save written before the field existed has no wall-clock stamp, which the offline catch-up
  // reads: without it the whole away period is silently skipped. Default to "now" (no phantom
  // offline credited) so the field is always present.
  if (s.lastSavedAt == null) s.lastSavedAt = Date.now();
  if (!s.presets) s.presets = newPresets();
  for (const preset of s.presets) {
    // a preset row the collection does not know dies here, the same read the live switch does
    preset.list = Array.from({ length: ACTIVE_SLOTS }, (_, i) => {
      const id = preset.list?.[i] ?? null;
      return id && sm.byId[id] ? id : null;
    });
  }
  if (s.activePreset == null) s.activePreset = 0;
  if (!s.collector) s.collector = newCollector();
  s.collector.hints ||= {};
  if (!s.grants) s.grants = newGrants();
  if (!s.pedlar) s.pedlar = { day: 0, minutes: [], bought: 0 };
  if (!s.filter) s.filter = newFilter();
  if (!Array.isArray(s.filterPresets)) s.filterPresets = [];
  // a preset is only a rule table; anything a hand edit left beside or inside it is not a filter, and
  // a rule's numbers come back inside what the live filter can produce
  s.filterPresets = s.filterPresets.map((p) => {
    if (!p || typeof p.bySlot !== 'object' || p.bySlot === null) return null;
    const bySlot: Record<string, any> = {};
    for (const [slot, rule] of Object.entries(p.bySlot)) {
      if (!rule || typeof rule !== 'object') continue;
      bySlot[slot] = {
        enabled: Boolean(rule.enabled),
        margin_pct: Math.max(0, Math.floor(Number(rule.margin_pct) || 0)),
        keep_missing_element: Boolean(rule.keep_missing_element),
      };
    }
    return { bySlot };
  });
  if (s.travel !== 'forward') s.travel = 'stay';
  if (!s.goal) s.goal = newGoal();
  if (!s.curses) s.curses = newCurses();
  if (!s.mobStatus) s.mobStatus = newMobStatusStore();
  // v18 · the statuses on the character and the keystone runtime became saved state (§7.7). A save
  // claiming the current format must hold both whole — a missing or impossible field is refused by
  // name, never default-filled to make a load pass; a pre-v18 save predates them and backfills empty.
  if (fromVersion < 18) {
    s.playerStatuses = {};
    s.keystoneRuntime = newKeystoneRuntimeState();
  } else {
    s.playerStatuses = validatePlayerStatuses(s.playerStatuses);
    s.keystoneRuntime = validateKeystoneRuntime(s.keystoneRuntime);
  }
  // v20 · the city ledger. A save claiming the current format must hold a whole, in-range ledger;
  // an older one replays the steps its play time implies, so the cities are never a blank slate.
  if (fromVersion < 20) s.economy = newEconomyState(s.clockSec);
  else s.economy = validateEconomy(s.economy);
  if (s.pendingSnapshot === undefined) s.pendingSnapshot = null;
  if (!s.nextSnapshotAt && s.nextSnapshotAt !== 0) s.nextSnapshotAt = 0;
  // An imported or hand-edited file must not be an impossible state: the numbers below are clamped
  // to what the live rules can produce, and every id the collection no longer knows is dropped.
  // Nothing here is a schema change — the shape stays, the values come back inside their bounds.
  {
    const finite = (v: unknown, fallback: number): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    if (s.player) {
      const lv = Math.max(1, Math.min(E.stat.level_cap as number, Math.floor(finite(s.player.level, 1))));
      s.player.level = lv;
      s.player.xp = Math.max(0, finite(s.player.xp, 0));
      s.player.hp = Math.max(0, finite(s.player.hp, 1));
      s.player.mana = (tree?.keystoneBundles(s.player.treeRanks) || []).some((b) => b.key === 'mana-debt')
        ? finite(s.player.mana, 0) : Math.max(0, finite(s.player.mana, 0));
      s.player.es = Math.max(0, finite(s.player.es, 0));
      // points in hand cannot exceed what the level curve has paid out in total
      s.player.statPoints = Math.max(0, Math.min(eng.pointsAt(lv), Math.floor(finite(s.player.statPoints, 0))));
      s.player.points = Object.fromEntries(STAT_KEYS.map((k) => [k, Math.max(0, Math.floor(finite(s.player.points?.[k], 0)))])) as Record<StatKey, number>;
      let spent = Object.values(s.player.points).reduce((a, b) => a + b, 0);
      if (spent > eng.pointsAt(lv)) {
        s.player.points = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<StatKey, number>;
        s.player.statPoints = eng.pointsAt(lv);
        spent = 0;
      }
      s.player.statPoints = Math.min(s.player.statPoints, eng.pointsAt(lv) - spent);
      // a rank on a node the tree does not carry is refused by name, never deleted: the allocation
      // belongs to a different tree, and this reader must not quietly turn it into a refund
      const ranks = s.player.treeRanks || (s.player.treeRanks = {});
      for (const id of Object.keys(ranks)) {
        if (!tree.byId[id]) throw new Error(`tree rank ${id} is not a node in tree version ${tree.version}`);
        ranks[id] = Math.max(0, Math.min(tree.byId[id].ranks, Math.floor(finite(ranks[id], 0))));
      }
      const conflict = tree.conflictsIn(ranks);
      if (conflict)
        throw new Error(`tree allocation holds the incompatible keystones ${conflict.a} and ${conflict.b}`);
      // the tree's points in hand are what the level has paid out MINUS what the ranks have spent, so a
      // save written under an older rate is recomputed rather than clamped (D8)
       s.player.attainmentPoints = Math.max(0, Math.floor(finite(s.player.attainmentPoints, 0)));
       s.player.questTreePointsEarned = Math.max(0, Math.floor(finite(s.player.questTreePointsEarned, 0)));
       const treeBudget = tree.pointsAt(lv, E.stat.level_cap);
       const spentByCurrency = tree.pointsSpentByCurrency(ranks);
       const treeSpent = spentByCurrency.tree ?? 0;
       const qEarned = s.player.questTreePointsEarned ?? 0;
       if (treeSpent > treeBudget + qEarned) {
         for (const id of Object.keys(ranks)) delete ranks[id];
         s.player.treePoints = treeBudget + qEarned;
       } else {
         s.player.treePoints = treeBudget + qEarned - treeSpent;
       }
      const fixUpgrade = (item: any) => {
        if (!item || item.upgrade_lv == null) return;
        item.upgrade_lv = Math.max(0, Math.min(E.craft.upgrade_cap, Math.floor(finite(item.upgrade_lv, 0))));
        item.gearMod = item.upgrade_lv * E.craft.gear_mod_per_level;
      };
      for (const item of s.gear || []) fixUpgrade(item);
      for (const item of s.bag || []) fixUpgrade(item);
      for (const tab of s.stash || []) for (const item of tab) fixUpgrade(item);
      // an imported character's pools cannot exceed what its gear and allocations support
      const bundles = tree ? tree.keystoneBundles(ranks) : [];
      clampAuraReservations(s.skills, bundles);
      const c = buildCharacter(lv, Array.isArray(s.gear) ? s.gear : [], {}, 0, effectsActive(s.skills, bundles), s.player.points, ranks, {}, bundles);
      s.player.hp = Math.min(Math.max(0, s.player.hp), c.maxHp);
      s.player.mana = bundles.some((b) => b.key === 'mana-debt')
        ? Math.min(s.player.mana, c.maxMana) : Math.min(Math.max(0, s.player.mana), c.maxMana);
      s.player.es = Math.min(Math.max(0, s.player.es), c.es);
    }
    if (!eng.ZONES.some((z: any) => z.id === s.zone)) s.zone = eng.ZONES[0].id;
    if (s.dungeon && !eng.ZONES.some((z: any) => z.id === s.dungeon!.zone)) s.dungeon = null;
    // a Hunger that is not a number would read as 0 forever (the empty cut, Auto Eat re-firing)
    if (s.fieldwork) {
      const h = Number(s.fieldwork.hunger);
      s.fieldwork.hunger = Number.isFinite(h)
        ? Math.max(0, Math.min(E.fieldwork.hunger.max, h))
        : E.fieldwork.hunger.max;
    }
  }
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
  if (parsed.version !== SCHEMA_VERSION && parsed.version !== 18 && parsed.version !== 17 && parsed.version !== 16 && parsed.version !== 15 && parsed.version !== 14) {
    throw new Error(`schema version ${version} ≠ ${SCHEMA_VERSION}`);
  }
  const state = parsed.state as GameState;
  if (!state.player || !state.counters) throw new Error('not a ModWorld save');
  assertPassiveTreeVersion(state);
  return migrate(state, parsed.version);
}

export const saveSlots = SLOTS;
