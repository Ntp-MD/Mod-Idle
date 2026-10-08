import type { StatKey } from '../engine/client';

export interface ModExtra {
  id: string;
  value: number;
}

export interface ModLine {
  id: string;
  value: number;
  /** Which Tier slice of its Item quality band this line sits on (0 = T1). */
  slice?: number;
  /**
   * The Element an Elemental line rolls on. Stored as a value rather than folded into the number,
   * because crafting must never change it (`item-level.md` · `save.md`).
   */
  element?: string | null;
  /**
   * The Core stat a `stat_mod_flat` line feeds, rolled at drop and baked into the line the way a
   * PoE implicit carries its own stat. Only that line carries it — its `all_stat_flat` sibling
   * feeds all seven at once and bakes nothing; the pool is `mods.json` `stat_mod_flat.rolls`.
   */
  stat?: StatKey;
  /**
   * The further Mods a Base Mod line carries on the same line (`item-base.md`): line 1 rolls
   * 1-3 Mods onto one line, its own `value` for the first and one entry here for each of the rest.
   */
  extra?: ModExtra[];
}

/** One worn or bagged piece. Its level answers the value window; the band label rides along for weights. */
export interface Item {
  slot: string;
  base: string;
  /** The level the piece dropped at. It is the one axis its values ride (`item-level.md`). */
  ilvl: number;
  weaponAspd?: number;
  /** The band the drop source declared (`low` · `mid` · `high`) — the weight and label half. */
  quality: string;
  tier: string;
  lines: ModLine[];
  /** The band's index, which is what the filter's score and the weight tables read. */
  q?: number;
  /** Carried weight in the unit items show: the Base frame's weight at this quality. */
  weight?: number;
  /** How many Add mod stones this piece has taken, 0-2 (net counting, item-level.md). */
  mods_added?: number;
  /** The highest value each slot has ever held — the Reroll floor (save.md "Reroll baseline"). */
  baselines?: Record<number, number>;
  /** A Collector set this piece is being held for, instead of dissolved at the filter. */
  heldFor?: string;
  /** Player-locked: bulk deposit/withdraw, the bag swap and auto-dissolve all skip it. */
  locked?: boolean;
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
  /** The lineage's own id, so a per-species rule reads one flag rather than matching a name. */
  speciesId?: string;
  /** The sub-zone this spawn rolled into: its own race pair and one of the zone's own Elements. */
  subzone?: string;
  /**
   * The ladder name this spawn rolled (`mob.variants` → `mob.variant_drops`). It owns both the junk
   * item the mob pays and the stream it leans, so two mobs of one species are not one drop table.
   */
  variant?: string;
  kind: string;
  /** Which body-class column a weapon's `size_mult` reads this mob as (a boss declares its own). */
  readsAs?: string;
  zone: number;
  level: number;
  hp: number;
  hpMax: number;
  ps: number;
  acc: number;
  /** The mob's own evasion rating our accuracy rolls against: `mob_evasion = Dex × K_EVASION`. */
  evasion: number;
  /** A mob dodging our swing runs its own thin opposed roll off its Agi (X24). */
  dodgeRate: number;
  armour: number;
  res: number;
  /** Per-Element res from the race profile (X54); the Element half of a swing or skill press reads this. */
  resByElement?: Record<string, number>;
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
  /** Points allocated into each Core stat: `stat = base + points x point_value`. */
  points: Record<StatKey, number>;
  /** Stat points banked from levels, not yet spent. */
  statPoints: number;
  /** When true, level points are auto-spent evenly (the reference build) — the idle default. */
  autoSpend: boolean;
  /** Banked passive-tree points. */
  treePoints: number;
  /** Bought ranks, keyed by node id (`impact.1` … `control.21`) — 0-3 each, `engine/tree.ts` owns the nodes. */
  treeRanks?: Record<string, number>;
  hp: number;
  mana: number;
  es: number;
  esIdleSec: number;
  /** Ghost Dance's perfect-dodge charges: each one deletes an incoming hit outright. */
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
  kind: 'elite' | 'boss';
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
  tasks: (TaskSlot | null)[];
  refillAt: number[];
  skipsToday: number;
  skipDay: number;
}

/**
 * One walk on foot, counted in blocks.
 *
 * `blocksTotal` is the hex distance between the two settlements and `secLeft` is the time left on
 * the block being crossed. Every block crossed rolls one encounter chance. A Push is the ordinary
 * Push: the character rests at the camp of the zone it was ambushed in and walks back in on the
 * block it was ambushed on, so `blocksLeft` never moves for it.
 */
export interface Walk {
  from: string;
  to: string;
  blocksTotal: number;
  blocksLeft: number;
  secLeft: number;
  blocksWalked: number;
}

export interface GameState {
  seed: number;
  rngState: number;
  player: Player;
  gear: (Item | null)[];
  bag: Item[];
  stash: Item[][];
  walk: Walk | null;
  skills: SkillState;
  healUp: HealBuff | null;
  /** Unsold junk, keyed by the variant item's own name (`mob.variant_drops`). */
  junk: Record<string, number>;
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
  /** 'stay' keeps hunting this zone; 'forward' climbs once its own level band is behind. */
  travel: 'stay' | 'forward';
  /**
   * Forward Mode's safe floor: the zone the character last held (the one it advanced out of). A
   * Push returns here — the ladder's own answer to "this chapter is not survivable yet".
   */
  forwardSafe?: number;
  /** The zone a Push chased the character out of, and the level it happened at. */
  forwardBlockedZone?: number;
  /** Forward Mode may not re-enter `forwardBlockedZone` until it has gained a level against this. */
  forwardBlockedLevel?: number;
  /**
   * Auto-dissolve any drop below this item level (0 = never, the default: every drop waits for a
   * decision). A client rule that dissolves into Reroll stones — never gold, so the two mints are
   * untouched.
   */
  autoDissolveLevel?: number;
  /** The completion gate: the final zone's boss, one spawn, no Push (`concept.md`). */
  goal: GoalState;
  /** Curse lines currently written on a mob, keyed by that spawn's id (`skill-pool.md`). */
  curses: CurseStore;
  /** Burn · poison · chill · shock · mark · bleed we have put on a mob (`status.mob_side`). */
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
