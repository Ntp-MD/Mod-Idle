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
import { E, BASES, eng, loot } from '../engine/client';

// save.md: local only, three slots, IndexedDB with a localStorage fallback, JSON export/import.
// The town layer is a schema bump, and an import at a different version is rejected rather than
// converted — a converted save could carry a Reroll baseline or craft counter that never existed.
// v4 is the 7-line skeleton: a v3 item is re-stamped, not discarded. v5 bakes the Core stat
// onto every Stat Mod line, so a v4 piece keeps the stat its player chose. v6 grows the worn
// set to a thirteenth slot, the earring, so a v5 gear array is padded back to full length.
// v9 is the item level: the value window moved onto the level and Rarity was retired, and a v8 item
// gains the level its band starts at with its labels flipped onto the new order. A v9 item keeps
// whatever line count it holds — the Normal count is drawn at drop from `item_level.unbound_slots`,
// which is data, not schema. v10 deletes the hunt
// systems: the per-zone Hunt Order and the per-zone hunting ground are gone, so a v9 save's fields for
// them are dropped — the variant's own lean is the only lean left. v11 is the HUD's transient event
// ring (`fx`), which a write never stores.
const DB_NAME = 'modworld';
const STORE = 'saves';
const ACCOUNT_KEY = 'account';
export const SCHEMA_VERSION = 11;
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
}
export const DEFAULT_SETTINGS: ClientSettings = { numberFormat: 'plain', offlineReport: true, keybinds: {}, equipMargin: 0 };
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
  await put(slot, JSON.stringify({ version: SCHEMA_VERSION, state: { ...state, fx: [] } }));
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
 * A v4 item predates the stat roll: its Stat Mod line was told which Core stat to feed by the
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
  if (!s.walk) s.walk = null;
  if (!s.dungeon) s.dungeon = null;
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
  // keeping the same idea (the named Rarity's own top level is where "keep above this" now starts).
  if (fromVersion < 9) {
    for (const item of s.gear || []) levelItem(item);
    for (const item of s.bag || []) levelItem(item);
    for (const tab of s.stash || []) for (const item of tab || []) levelItem(item);
    const old = (s as any).autoDissolveRarity as string | undefined;
    if (old && old !== 'off') s.autoDissolveLevel = old === 'Rare' ? 61 : 31;
    delete (s as any).autoDissolveRarity;
  }
  if (!s.skills) s.skills = newSkillState();
  // a save from before §14 has no per-slot mode and no shared condition list: default them, so the
  // rotation keeps behaving exactly as it did (`always`) until the player changes something
  if (!s.skills.mode) s.skills.mode = {};
  if (!s.skills.conditions) s.skills.conditions = { boss: false, hpBelowPct: 0, statusMissing: [] };
  if (!Array.isArray(s.skills.conditions.statusMissing)) s.skills.conditions.statusMissing = [];
  if (!s.healUp) s.healUp = null;
  if (!s.spawnIn && s.spawnIn !== 0) s.spawnIn = 0;
  if (!s.counters.zoneKills) s.counters.zoneKills = {};
  if (!s.counters.stones) s.counters.stones = {};
  if (!s.junk) s.junk = {};
  // a save from before the tree existed holds no ranks; the points it banked are still there
  if (s.player && !s.player.treeRanks) s.player.treeRanks = {};
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
  // v11 · the HUD reads a transient event ring (`fx`), which a write never stores.
  if (!Array.isArray(s.fx)) s.fx = [];
  if (!s.fxSeq) s.fxSeq = 0;
  if (!s.farm) s.farm = newFarm();
  // a farm saved before the automation block existed gets it off; the player opts in
  if (s.farm && !s.farm.autoFarm) { s.farm.autoFarm = { plant: false, harvest: false, brew: false }; s.farm.lastAutoFarmAt = -9999; }
  // an older character auto-allocates its points (the idle default); manual is the opt-out 
  if (s.player && s.player.autoSpend == null) s.player.autoSpend = true;
  if (!s.stash) s.stash = [];
  // an older save auto-dissolves nothing; the player opts in with a level floor
  if (s.autoDissolveLevel == null) s.autoDissolveLevel = 0;
  if (!s.mastery) s.mastery = {};
  // a save written before the field existed has no wall-clock stamp, which the offline catch-up
  // reads: without it the whole away period is silently skipped. Default to "now" (no phantom
  // offline credited) so the field is always present.
  if (s.lastSavedAt == null) s.lastSavedAt = Date.now();
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
