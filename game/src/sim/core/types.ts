import type { StatKey } from '../../engine/client';
import type { Hex } from '../../../../engine/road.ts';
import type { SkillAreaSnapshot, SkillCastTiming } from '../../../../engine/types.ts';
import type { AlchemyLedger } from '../../../../engine/alchemy.ts';
import type { EconomyRestore } from '../../../../engine/economy.ts';
import type { QuestBonus } from '../town/quest-rewards';
import type { GuidanceState } from './guidance';
import type { PendingWorkState } from './pending-work';
import type { FieldState, FieldArchive } from '../world/field-area';

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
   * The Core attribute a `stat_mod_flat` line feeds, rolled at drop and baked into the line the way a
   * PoE implicit carries its own stat. Only that line carries it — its `all_stat_flat` sibling
   * feeds all seven at once and bakes nothing; the pool is `mods.json` `stat_mod_flat.rolls`.
   */
  stat?: StatKey;
  /**
   * The further Mods a Frame Mod line carries on the same line (`item-base.md`): line 1 rolls
   * 1-3 Mods onto one line, its own `value` for the first and one entry here for each of the rest.
   */
  extra?: ModExtra[];
  /** Set once a bench has touched the line, so the piece can wear the crafted mark. */
  crafted?: boolean;
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
  /** How many Add stones this piece has taken, gross — the fill price climbs on this and never resets. */
  mods_added?: number;
  /** Unbound lines the piece dropped with: the +2 Add cap is net against this, so Remove refunds room. */
  unbound_at_drop?: number;
  /** The highest value each slot has ever held — the Reroll floor (save.md "Reroll baseline"). */
  baselines?: Record<number, number>;
  /** A Collector set this piece is being held for, instead of dissolved at the filter. */
  heldFor?: string;
  /** Player-locked: bulk deposit/withdraw, the bag swap and auto-dissolve all skip it. */
  locked?: boolean;
  /** +1..+15 from the Quality stone ladder (`crafting.md`). */
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
  /** The fixed level-band form name, separate from its lineage and drop variant. */
  formName?: string;
  /** The lineage's own id, so a per-species rule reads one flag rather than matching a name. */
  speciesId?: string;
  /** The sub-zone this spawn rolled into: its Species pool and one of the zone's own Elements. */
  subzone?: string;
  /** The combat subzone's environment, which can add a conserved drop lean. */
  environment?: string;
  /**
   * The selected Variant name this spawn rolled (`mob.variants` → `mob.variant_drops`), or the
   * fixed boss/unique name for those ranks. It may override the Species' default damage type and
   * selects junk item/lean, so two mobs of one Species can differ. Elite keeps the Variant.
   */
  variant?: string;
  kind: string;
  /** Which body-class column a weapon's `size_mult` reads this mob as (a boss declares its own). */
  readsAs?: string;
  /** Boss-specific descriptive identity, when this spawn has one. */
  trait?: string;
  /**
   * The trait read as a mechanic (`mob.trait_mechanics`): the statuses this body cannot answer, the
   * Element it flinches from, what it pays when it dies, and the clock multiplier it swings on.
   */
  immune?: string[];
  weak?: { element: string; taken_pct: number } | null;
  burst?: { ps_pct: number } | null;
  /** The keys this lineage names in `mob.trait_mechanics.set`, so a readout can say "swift". */
  mechanics?: Record<string, string | boolean> | null;
  zone: number;
  level: number;
  hp: number;
  hpMax: number;
  ps: number;
  /** The authored Core selected by the Species Variant (or the boss profile). */
  core?: Record<string, number>;
  acc: number;
  /** The mob's own evasion rating our accuracy rolls against: its integer Core Dex × K_EVASION × the body base Evasion percent, with no level term. */
  evasion: number;
  /** A mob dodging our swing runs its own thin opposed roll off its Agi (X24). */
  dodgeRate: number;
  armour: number;
  res: number;
  /** Per-Element resistance from the Species profile (X54); the Element half of a swing or skill press reads this. */
  resByElement?: Record<string, number>;
  /**
   * `30` Elemental Equilibrium: the resistance this instance had before the shift, and the second its
   * own duration lapses. Spawn state, never saved — the debuff outlives no fight.
   */
  resShift?: { expiresAtSec: number; res: number; resByElement: Record<string, number> };
  damage: 'physical' | 'magic' | 'mixed';
  innate: string[];
  xp: number;
  line: string;
  hitsPerSec: number;
  atkTimer: number;
  engageSec: number;
  /** Resolved mob skill kit, in priority order (max 4). Runtime-only; a spawn rebuilds it. */
  skillIds?: string[];
  /** Encounter phase of this body: how many of its kit's HP gates it has crossed. Runtime-only. */
  phase?: number;
  /** A boss phase add names the body that called it, so a reward read can classify it. */
  addedBy?: string;
  /** Damage the body must take before its guard breaks; runtime-only and never saved. */
  shieldHp?: number;
  shieldMax?: number;
  /** The field spawn slot this body belongs to; a death returns the slot to its own timer. */
  spawnSlotId?: string;
  /** Absolute µs each skill becomes ready again. Runtime-only; absent means ready. */
  skillReadyAtUs?: Record<string, number>;
  /** Aura-adjusted combat reads, recomputed every tick from living engaged sources. */
  auraDamageMult?: number;
  auraSpeedMult?: number;
  effArmour?: number;
  effRes?: number;
  effResByElement?: Record<string, number>;
  /** The aura rows currently affecting this body and the source that carried each one. */
  auraSources?: { id: string; sourceId: string }[];
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
  /** Points allocated into each Core attribute: `stat = base + points x point_value`. */
  points: Record<StatKey, number>;
  /** Stat points banked from levels, not yet spent. */
  statPoints: number;
  /** When true, level points are auto-spent evenly (the reference build) — the idle default. */
  autoSpend: boolean;
  /** Banked passive-tree points. */
  treePoints: number;
  /** Quest-granted passive-tree points banked beyond the level curve. */
  questTreePointsEarned?: number;
  /** The attainment points a keystone is paid in (D2). */
  attainmentPoints?: number;
  /** Bought ranks, keyed by node id (`impact.1` … `control.21`) — 0-3 each, `engine/tree.ts` owns the nodes. */
  treeRanks?: Record<string, number>;
  /** Passive tree spec version this allocation was bought under. */
  passiveTreeVersion?: number;
  hp: number;
  mana: number;
  es: number;
  esIdleSec: number;
  /** Ghost Dance's perfect-dodge charges: each one deletes an incoming hit outright. */
  charges?: number;
  /** Earth Wall's block charges: each one cuts an incoming physical hit by the block rule. */
  blockCharges?: number;
  atkTimer: number;
}

export interface Counters {
  kills: number;
  zoneKills: Record<number, number>;
  pushes: number;
  drops: number;
  /** Gear pieces dissolved by the bag filter. Historical record — Tier milestones now count eligible
   *  Alchemy Value outputs on the versioned `alchemy` ledger, not this counter. */
  salvaged?: number;
  /** Every point of damage the character dealt, so a DPS figure is state-backed, not inferred. */
  damage?: number;
  /** The same damage split by what dealt it — the swing, a press, or a status ticking over time. */
  damageBy?: { swing: number; cast: number; dot: number };
  /** Grants the full bag refused (`inventory.overflow` · `slots.ts`). */
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

import type { SkillState } from '../combat/skills';
import type { FarmState } from '../world/farm';
import type { FilterState } from '../gear/filter';
import type { GoalState } from './goal';
import type { MobStatusStore } from '../combat/mobStatus';
import type { CurseStore } from '../combat/curse';
import type { DungeonRun } from '../world/dungeon';
import type { FieldworkState } from '../world/fieldwork';
import type { Statuses } from '../combat/combat';
import type { KeystoneRuntimeState } from '../../../../engine/keystones.ts';

export interface HealBuff {
  secLeft: number;
  pctPerSec: number;
}

/** A task slot on the Guild board (`tasks.md`). A Boss hunt pays winner's choice: the
    default `stone`/`count` (the Remove stone) or the `alt` it names (the Reroll tier count). */
export interface TaskSlot {
  kind: 'elite' | 'expedition' | 'boss';
  zone: number;
  /** Expedition target. This Species must be defeated as an Elite at this subzone. */
  targetSpecies?: string;
  subzone?: number;
  n: number;
  progress: number;
  stone: 'reroll_value' | 'tier' | 'remove';
  count: number;
  alt?: { stone: 'reroll_value' | 'tier' | 'remove'; count: number };
  claimed: boolean;
  offeredAt: number;
  /** Quest-granted passive-tree points frozen at offer time. */
  treePoints?: number;
  alternative?: QuestBonus;
  milestone?: string;
}

export interface TownState {
  questMilestones: Record<string, true>;
  deliveryClockSec: number;
  contractTriggerRemainingSec: Record<string, number>;
  contractSerial: number;
  contracts: Record<string, import('../town/delivery-types').DeliveryContract[]>;
  trackedContractIds: string[];
  deliverySummaries: Record<string, import('../town/delivery-types').DeliverySummary>;
  blackMarket: Record<string, import('../town/black-market').BlackMarketTownState>;
  /** Standing credit from one-time Camp aid, kept separate from actual zone kills. */
  helpCredit: Record<string, number>;
  /** Base-value supply already delivered, decaying over simulation time at each town and category. */
  market: Record<string, Record<string, { used: number; atSec: number }>>;
  /** Earned fractions below the currency display unit carry forward into the next sale. */
  marketCredit: number;
  hagglingXp: number;
  visited: string[];
  owned: string[];
  waypoint: string;
  tasks: (TaskSlot | null)[];
  refillAt: number[];
  /** Paid Task skip tokens bought today, capped by `task_sizing`'s daily allowance. */
  skipsToday: number;
  /** Free task skips already used on `skipDay`. */
  freeSkipsToday: number;
  skipDay: number;
}

/**
 * One walk on foot, counted in blocks.
 *
 * `blocksTotal` is the hex distance between the two cells and `secLeft` is the time left on the block
 * being crossed. A crossed block may roll one independent trail event; it never fields a group. A Push
 * preserves the block count. A same-zone Field Camp can end the walk and receive the character; without
 * one, recovery returns to the interrupted block and the route continues.
 *
 * A walk joins two cells, not two settlements (`road.standing_rule`): the destination is any hex the
 * player clicked, and `node`/`kind`/`sub`/`wild` say what stands on it — a settlement, a named side of
 * one, a wild side, or bare ground. The content is answered from the lattice, never from a link table.
 */
export interface Walk {
  from: Hex;
  to: Hex;
  /** The settlement the destination belongs to — itself at rank 0, its nearest one on bare ground. */
  node: string | null;
  kind: 'town' | 'sub' | 'wild' | 'bare';
  /** The sub-zone the destination cell is drawn as, or null where none is named. */
  sub: number | null;
  /** The wild side the destination cell is drawn as, or null — side 0 is a zone's dungeon door. */
  wild: number | null;
  blocksTotal: number;
  blocksLeft: number;
  secLeft: number;
  blocksWalked: number;
}

/** The hex the feet are on, and the content the sheet says stands on it. */
export interface Cell {
  q: number;
  r: number;
  /** The sub-zone index of this cell, or null — standing on one hunts that sub-zone's cast. */
  sub: number | null;
  /** The wild-side index of this cell, or null — side 0 is where a zone's dungeon is entered. */
  wild: number | null;
}

export interface PatrolStop {
  zone: number;
  subzone: number;
  cell: Cell;
}

export interface PatrolState {
  stops: PatrolStop[];
  active: boolean;
  repeat: boolean;
  index: number;
  groupsCleared: number;
}

export interface AutoReturnState {
  enabled: boolean;
  phase: 'idle' | 'waiting' | 'to-town' | 'to-stop';
  /** The stop to resume after a safe stash deposit. */
  resumeCell: Cell | null;
}

/**
 * One thing that just happened, handed to the HUD as an event rather than a log line.
 *
 * The sim already totals damage (`counters.damageBy`) and narrates (`log`); neither is an event the
 * screen can animate, because a total has no moment and a log line has no colour. A short ring of
 * these is what lets a swing, a status proc, a cast, a block-step, a sale or a craft land on screen, and
 * what the character is given — a buff coming up, HP returning, a level taken — lands as its own beat.
 * `colour` is read out of the data at the call site (`elements.colour` / `physical_colour` /
 * `crit_colour`), never typed here, and the field is transient: a save writes an empty ring.
 */
export interface FxEvent {
  /** Monotonic within the run, so the HUD keys one animation per event and never replays an old one. */
  id: number;
  sec: number;
  /** Exact transient combat-clock timestamp, when emitted inside a tick. */
  atUs?: number;
  kind: 'hit' | 'cast' | 'taken' | 'block' | 'proc' | 'kill' | 'drop' | 'sell' | 'travel' | 'craft' | 'warp'
    | 'buff' | 'heal' | 'level';
  /** The number the indicator prints, already formatted by `eng.fmt`, or empty for a non-number. */
  text: string;
  colour: string;
  crit?: boolean;
  /** Whose side of the field it belongs on: the mob field or the player's own plate. */
  side?: 'field' | 'self';
  /** The mob the hit landed on, so its own plate raises the number. A `hit` carries it, and a `kill` carries
   *  it too: the kill's word still reads in the shared column, and its id is what binds the dead body to the
   *  blow that ended it, so the card shows both before it goes. Absent means the shared column. */
  mobId?: string;
  /** The mob that carried the blow — a defence or a hit on the character names its striker, so the
   *  striker's own plate can lunge. `mobId` says *landed on*, this says *carried by*, and a status clock
   *  ticking on the character names no body, because no body is swinging. */
  byId?: string;
  /** What carried a `hit`, so the screen knows whether to draw a weapon at all: a swing leaves an arc, a
   *  press leaves an impact, and a status clock leaves only its number. Absent means no arc is honest. */
  via?: 'swing' | 'cast' | 'dot';
  /** Which player or mob skill raised a cast, buff or heal. Direct hits carry the same identity so effects
   *  do not borrow another skill's appearance when several casts share one second. */
  skillId?: string;
  /** One live action links its release, impact hits and timing facts without replaying the cast. */
  actionId?: number;
  castTiming?: SkillCastTiming;
  /** Resolved presentation facts from the cast report; VFX never guesses extra victims or stacks. */
  skillOutcome?: {
    targets: string[];
    /** Ground-space footprint resolved by combat; VFX may project it without selecting victims. */
    area?: SkillAreaSnapshot;
    consumed?: {status:string; stacks:number}[];
    spread?: {status:string; to:string[]}[];
    charges?: number;
    cleansed?: number;
  };
  /** The amount behind `text`, unformatted. `text` is what the plate prints; this is what a parked figure
   *  adds up when several blows land on one body inside the same second, so the sum is the sim's number and
   *  never a parse of the string the player was shown. */
  value?: number;
  /** Actual mitigated pool damage, retained separately for combat history. */
  hpDamage?: number;
  esDamage?: number;
}

/** The city ledger's saved state: the engine's own restore shape plus whole seconds toward its next step. */
export interface GameEconomy extends EconomyRestore {
  accumSec: number;
}

/** One manual command's outcome, reported at the combat timestamp it was judged at. */
export interface CombatReceipt {
  atUs: number;
  /** The same instant in whole clock seconds, so reports can window receipts. */
  atSec?: number;
  command: 'cast' | 'move' | 'stop';
  status: 'accepted' | 'queued' | 'rejected';
  reason: string;
  skillId?: string;
}

export interface GameState {
  seed: number;
  rngState: number;
  player: Player;
  gear: (Item | null)[];
  bag: Item[];
  stash: Item[][];
  walk: Walk | null;
  /** The hex the feet are on — a town, a side of one, or bare ground (`road.standing_rule`). */
  cell: Cell | null;
  patrol: PatrolState;
  autoReturn: AutoReturnState;
  mapJournal?: import('../world/map-exploration').MapJournal;
  skills: SkillState;
  /** seven squares above the skill bar, each holding a carried potion's name or nothing */
  quickbar: (string | null)[];
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
  /** Saved rule tables for the filter — one slot the character owns, more as Collector rewards pay out. */
  filterPresets: ({ bySlot: FilterState['bySlot'] } | null)[];
  /** 'stay' keeps hunting this zone; 'forward' climbs once its own level band is behind. */
  travel: 'stay' | 'forward';
  /**
   * False on safe ground: a town fields no mobs, so nothing spawns until the character heads
   * out (the hunt button, a forward climb or a dungeon run). True everywhere else.
   */
  hunting: boolean;
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
  /** The player's next-step pin. Automatic suggestions are derived and never stored. */
  guidance?: GuidanceState;
  /** Curse lines currently written on a mob, keyed by that spawn's id (`skill-pool.md`). */
  curses: CurseStore;
  /** Burn · poison · chill · shock · mark · bleed we have put on a mob (`status.mob_side`). */
  mobStatus: MobStatusStore;
  /**
   * The statuses ON the character — canonical saved state (§7.7). This is the one store: the client
   * holds no local copy, a load never clears it, and the aggregate views read through `sim/combat/playerStatus.ts`.
   */
  playerStatuses: Statuses;
  /** The keystone runtime queues and counters (§7.7), persisted with the character. */
  keystoneRuntime: KeystoneRuntimeState;
  /** Why a snapshot is owed right now (`save.md` item 5), or null when none is pending. */
  pendingSnapshot: SnapshotReason | null;
  /** Released arena work whose impact is still owed across a reload; null when nothing is in flight. */
  pendingWork?: PendingWorkState | null;
  /** The loaded field's registry, spawn units, cohort/session identity and saved ground positions. */
  field?: FieldState | null;
  /** Bounded visited-field checkpoints: spawn units, idle identities and their own timers. */
  fieldArchive?: FieldArchive | null;
  /** The next timer snapshot; a written snapshot pushes it out by `save.snapshot_interval_min`. */
  nextSnapshotAt: number;
  town: TownState;
  farm: FarmState;
  fieldwork: FieldworkState;
  alchemy: AlchemyLedger;
  zone: number;
  group: Mob[];
  phase: Phase;
  campSec: number;
  /** Last avoidance reaction, in absolute clock seconds. */
  avoidCooldownUntilSec?: number;
  /** The player turned automatic dodging off; manual movement still works. */
  autoAvoidOff?: boolean;
  /** The blow that took the last HP, so the Push report names the actual cause. */
  lastFatalHit?: { mobId: string; species: string; value: number; atSec: number; skillId?: string };
  /** Recent manual-command outcomes, oldest first, so the HUD can report accepted/queued/rejected. */
  combatReceipts?: CombatReceipt[];
  /** The open dungeon run, or null on open ground. A run is a mode, never a coordinate (M7). */
  dungeon: DungeonRun | null;
  /** The clock second of the last cleared run; entry cools down from here (`dungeon.cooldown_sec`). */
  dungeonClearedAt?: number;
  counters: Counters;
  log: LogLine[];
  /** The transient ring the HUD animates. Never persisted (`save.ts`). */
  fx: FxEvent[];
  /** Bounded factual combat records; optional for saves written before the history existed. */
  combatHistory?: import('../combat/combat-history').CombatHistoryEntry[];
  /** The next ring id. Stored so a restored save cannot replay an old animation key. */
  fxSeq: number;
  clockSec: number;
  /** The city ledger (`town.json → economy`), stepped on the world clock. */
  economy: GameEconomy;
  lastSavedAt: number;
  /** When the next boss is due, per character. It does not accrue offline (`save.md`). */
  bossDueAt?: number;
  /** False while the offline catch-up runs: the boss clock stops and drops use the zone floor. */
  online?: boolean;
}
