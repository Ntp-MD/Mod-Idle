import type { StatKey } from '../../engine/client';
import type { Hex } from '../../../../engine/road.ts';
import type { SkillAreaSnapshot, SkillCastTiming } from '../../../../engine/types.ts';
import type { AlchemyLedger } from '../../../../engine/alchemy.ts';
import type { EconomyRestore } from '../../../../engine/economy.ts';
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
  /** The authored placement this actor belongs to; absent only on a pre-migration snapshot. */
  placementId?: string;
  /** A mob carried through the placement migration keeps its saved stats and pinned reward. */
  legacySnapshot?: true;
  /** The reward payload pinned for a legacy snapshot; null suppresses only its Variant reward. */
  legacyDrop?: { item: string; rarity: string; lean: 'gear' | 'herb' | 'junk' | 'none' } | null;
  /** The sub-zone this spawn rolled into: its Species pool and one of the zone's own Elements. */
  subzone?: string;
  /** The combat subzone's environment, which can add a conserved drop lean. */
  environment?: string;
  /**
   * The placement's display name (`mob.variants[].name`), or the fixed boss/unique name for those
   * ranks. It is presentation only; rewards and kits use `placementId`. Elite keeps the name.
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
  /** Cumulative gold actually received; the transaction owner writes every credit here. */
  goldEarned?: number;
  /** Cumulative gold actually paid; the transaction owner writes every debit here. */
  goldSpent?: number;
  stones: Record<string, number>;
  playSec: number;
}

/** Credit gold through the one owner so earned/spent never net out within a second. */
export function earnGold(counters: Counters, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  // Credits keep the exact ledger value (previous `+=` behavior); only debits round to cents.
  counters.gold += amount;
  counters.goldEarned = (counters.goldEarned || 0) + amount;
}

/** Debit gold through the one owner so earned/spent never net out within a second. */
export function spendGold(counters: Counters, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  counters.gold = Math.round((counters.gold - amount) * 100) / 100;
  counters.goldSpent = Math.round(((counters.goldSpent || 0) + amount) * 100) / 100;
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
  /** The cast whose recovery ticks this window owns; absent in older saves. */
  skillId?: string;
}

/** A task slot on the Guild board (`tasks.md`). A Boss hunt pays winner's choice: the
    default `stone`/`count` (the Remove stone) or the `alt` it names (the Reroll tier count). */
export interface TaskSlot {
  kind: 'elite' | 'boss';
  zone: number;
  n: number;
  progress: number;
  stone: 'reroll_value' | 'tier' | 'remove';
  count: number;
  alt?: { stone: 'reroll_value' | 'tier' | 'remove'; count: number };
  claimed: boolean;
  offeredAt: number;
}

export interface TownState {
  questMilestones: Record<string, true>;
  deliveryClockSec: number;
  contractTriggerRemainingSec: Record<string, number>;
  contractSerial: number;
  courierSerial: number;
  courierStreamState: number;
  courierTriggerRemainingSec: number;
  contracts: Record<string, import('../town/delivery-types').DeliveryContract[]>;
  trackedContractIds: string[];
  deliverySummaries: Record<string, import('../town/delivery-types').DeliverySummary>;
  blackMarket: Record<string, import('../town/black-market').BlackMarketTownState>;
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
 * One journey on foot: the frozen plan, the completed-leg index and the active leg's remaining time.
 * Total/walked/remaining counts derive from `legs`/`stepIndex`; destination facts resolve through
 * World from `to` — neither is stored twice. A crossed block may roll one trail event (receipt:
 * `lastEventStep`); it never fields a group. A Push preserves the plan; a same-zone Field Camp can
 * end the walk and receive the character, otherwise recovery resumes the interrupted block.
 */
export interface Walk {
  from: Hex;
  to: Hex;
  /** Zone at departure: arrival selects the preset only when the stop is in another zone. */
  fromZone: number;
  /** Journey id from the accepted-command sequence; rejected starts never advance it. */
  journeyId: number;
  /** The journey start — equals `from`; the committed position before the first leg. */
  origin: Hex;
  /** The ordered frozen legs, one adjacent walk edge each. */
  legs: { from: Hex; to: Hex }[];
  /** Completed legs: the committed position is the last completed leg's destination. */
  stepIndex: number;
  /** Seconds left on the active leg. */
  secLeft: number;
  /** The greatest leg index whose discovery/road event already processed (no replay). */
  lastEventStep: number;
}

/** The gathering site or dungeon entrance a wild-side block carries. */
export type FieldSite = 'dungeon' | 'mine' | 'grove' | 'fishing';

/** The hex the feet are on, and the content the sheet says stands on it. */
export interface Cell {
  q: number;
  r: number;
  /** The sub-zone index of this cell, or null — standing on one hunts that sub-zone's cast. */
  sub: number | null;
  /** The wild-side site carried by this cell, or null. */
  site: FieldSite | null;
  /** The terrain printed on this cell, or null where unknown — spawn weighting reads this. */
  terrain?: string | null;
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
  /** Authored repeat count. No index means one aggregate damage receipt, split only for display. */
  hitCount?: number;
  /** One-based actual payload index; indexed receipts must never be split again by presentation. */
  hitIndex?: number;
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
  /** Accepted-journey sequence: the next journey id is `travelSeq + 1`. Rejected starts never advance it. */
  travelSeq?: number;
  /** The hex the feet are on — a town, a side of one, or bare ground (`road.standing_rule`). */
  cell: Cell | null;
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
  /**
   * False on safe ground: a town, a Field Camp, or a wild-side cell fields no mobs, so nothing spawns
   * until the character heads to open ground. True everywhere else.
   */
  /**
   * True while the character stands on hunting ground. The field needs no user toggle: arrival sets it
   * from rank, a settlement, Field Camp or wild-side cell clears it, and walking out sets it again.
   */
  hunting: boolean;
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
  /** Released work still owed when an away settlement runs out of credited seconds. */
  pendingWorkReceipt?: { deferredFlights: number; deferredMobFlights: number; atSec: number };
  /** The open dungeon run, or null on open ground. A run is a mode, never a coordinate (M7). */
  dungeon: DungeonRun | null;
  /** Latest read-only dungeon result; never a claimable inventory queue. */
  lastDungeonReceipt?: import('../world/dungeon').DungeonReceipt | null;
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
