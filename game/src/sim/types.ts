import type { StatKey } from '../engine/client';

export interface ModLine {
  id: string;
  value: number;
  /** Which Tier slice of its Item quality band this line sits on (0 = T1). */
  slice?: number;
  /**
   * The Element an Elemental line rolls on. Stored as a value rather than folded into the number,
   * because crafting must never change it (`item-rarity.md` · `save.md`).
   */
  element?: string | null;
}

/** One worn or bagged piece. Rarity = Mod count, quality = value range, Tier = sub-range. */
export interface Item {
  slot: string;
  base: string;
  weaponAspd?: number;
  rarity: string;
  quality: string;
  tier: string;
  lines: ModLine[];
  /** The Item quality band index, which is what the filter's score reads. */
  q?: number;
  /** Carried weight in the unit items show: the Base frame's weight at this quality. */
  weight?: number;
  /** How many Add mod stones this piece has taken, 0-2 (net counting, item-rarity.md). */
  mods_added?: number;
  /** The highest value each slot has ever held — the Reroll floor (save.md "Reroll baseline"). */
  baselines?: Record<number, number>;
  /** A Collector set this piece is being held for, instead of dissolved at the filter. */
  heldFor?: string;
  /** +1..+15 from the Quality Stone ladder (`crafting.md`). */
  upgrade_lv?: number;
  /** Would-be breaks this piece can still absorb; Repair refills it (`craft.protection_start`). */
  protection_left?: number;
  /** Broken: unequippable, contributes nothing, kept at its level until repaired. */
  broken?: boolean;
  /** One Corrupt gamble per piece; a corrupted piece accepts no further stones. */
  corrupted?: boolean;
  /** What the +1 steps are worth, once the mob-sheet pass sets the Gear Mod value. */
  gearMod?: number;
}

export interface Mob {
  id: string;
  species: string;
  kind: string;
  zone: number;
  level: number;
  hp: number;
  hpMax: number;
  ps: number;
  acc: number;
  /** A mob dodging our swing runs its own thin opposed roll off its Agi (D-024 · X24). */
  dodgeRate: number;
  armour: number;
  res: number;
  damage: 'physical' | 'magic' | 'mixed';
  innate: string[];
  xp: number;
  line: string;
  hitsPerSec: number;
  atkTimer: number;
  engageSec: number;
}

export type Phase = 'fighting' | 'pushed' | 'camp';

/**
 * Why a snapshot is owed: one of the `engine.json` `save.snapshot_triggers` values, or `timer`
 * for the periodic one. Kept as a string because the trigger list is data, not code.
 */
export type SnapshotReason = string;

export interface Player {
  level: number;
  xp: number;
  stats: Record<StatKey, number>;
  hp: number;
  mana: number;
  es: number;
  esIdleSec: number;
  /** Ghost Dance's perfect-dodge charges: each one deletes an incoming hit outright (D-102). */
  charges?: number;
  atkTimer: number;
}

export interface Counters {
  kills: number;
  zoneKills: Record<number, number>;
  pushes: number;
  drops: number;
  /** Gear pieces dissolved by the bag filter; every 500 owes one Reroll tier stone (F15). */
  salvaged?: number;
  /** Every point of damage the character dealt, so a DPS figure is state-backed, not inferred. */
  damage?: number;
  /** The same damage split by what dealt it — the swing, a press, or a status ticking over time. */
  damageBy?: { swing: number; cast: number; dot: number };
  /** Grants the thirty-slot character bag refused (`inventory.overflow` · `slots.ts`). */
  stopped?: number;
  overflow?: number;
  junk: number;
  gold: number;
  stones: Record<string, number>;
  playSec: number;
}

export interface LogLine {
  sec: number;
  text: string;
}

import type { SkillState } from './skills';
import type { FarmState } from './farm';
import type { FilterState } from './filter';
import type { GoalState } from './goal';
import type { MobStatusStore } from './mobStatus';
import type { CurseStore } from './curse';

export interface HealBuff {
  secLeft: number;
  pctPerSec: number;
}

/** A task slot on the Guild board (`tasks.md`). */
export interface TaskSlot {
  kind: 'hunt' | 'elite' | 'boss';
  zone: number;
  n: number;
  progress: number;
  stone: 'reroll_value' | 'tier' | 'remove';
  count: number;
  claimed: boolean;
  offeredAt: number;
}

export interface TownState {
  visited: string[];
  owned: string[];
  waypoint: string;
  linksBought: number;
  tasks: (TaskSlot | null)[];
  refillAt: number[];
  skipsToday: number;
  skipDay: number;
}

/** One trip on the Road: 5 minutes, 5 encounters, a bounded purse at the end. */
export interface RoadTrip {
  linkIndex: number;
  settlementFrom: string;
  settlementTo: string;
  kind: string | null;
  secLeft: number;
  nextEncounterSec: number;
  encountersLeft: number;
  pursePaid: boolean;
}

export interface GameState {
  seed: number;
  rngState: number;
  player: Player;
  gear: (Item | null)[];
  bag: Item[];
  stash: Item[][];
  road: RoadTrip | null;
  purseDay: Record<string, number>;
  skills: SkillState;
  healUp: HealBuff | null;
  junkByRarity: Record<string, number>;
  /** Weapon-type Mastery XP, the held weapon's own track (`equipment-weapon.md`). */
  mastery: Record<string, number>;
  /** The six loadout sets (`engine.json` `presets`). */
  presets: any[];
  activePreset: number;
  collector: { done: Record<string, boolean>; hints: Record<string, boolean> };
  grants: { filter_presets: number; stash_tabs: number; titles: string[]; banners: string[] };
  /** The Curio pedlar restocks three appearance slots a real day, priced inside its band. */
  pedlar: { day: number; minutes: number[]; bought: number };
  lastAutoZone?: number;
  /** Per-slot bag filter thresholds and the "not yet found" keep-list (`loot.md` §4 · `save.md`). */
  filter: FilterState;
  /** 'stay' keeps hunting this zone; 'forward' moves on once its own level band is behind. */
  travel: 'stay' | 'forward';
  /** The completion gate: the final zone's boss, one spawn, no Push (`concept.md`). */
  goal: GoalState;
  /** Curse lines currently written on a mob, keyed by that spawn's id (`skill-pool.md`). */
  curses: CurseStore;
  /** Burn · poison · chill · shock · mark · bleed we have put on a mob (`status.mob_side`, D-067). */
  mobStatus: MobStatusStore;
  /** Why a snapshot is owed right now (`save.md` item 5), or null when none is pending. */
  pendingSnapshot: SnapshotReason | null;
  /** The next timer snapshot; a written snapshot pushes it out by `save.snapshot_interval_min`. */
  nextSnapshotAt: number;
  town: TownState;
  farm: FarmState;
  zone: number;
  group: Mob[];
  phase: Phase;
  campSec: number;
  spawnIn: number;
  counters: Counters;
  log: LogLine[];
  clockSec: number;
  lastSavedAt: number;
  /** When the next boss is due, per character. It does not accrue offline (`save.md`). */
  bossDueAt?: number;
  /** False while the offline catch-up runs: the boss clock stops and drops use the zone floor. */
  online?: boolean;
}
