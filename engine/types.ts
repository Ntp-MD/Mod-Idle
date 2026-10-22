/**
 * The shape of `tools/data/engine.json` — the payload every `create*` factory reads.
 *
 * This is the seam where the JSON becomes typed: the config sections are enumerated key by key,
 * so a renamed or mistyped `E.<section>.<key>` fails `npm run typecheck` instead of silently
 * producing `NaN`. Genuine constant maps (`K`, `spawn_weights`, `damage_split`) keep a string
 * index because they are maps by nature; the runtime rows (an Item, a Mod line, a skill row) are
 * `any`-typed on purpose — they are the game's own objects and their shapes live in
 * `game/src/sim/types.ts`, not here (see the migration plan's "boundary any" rule).
 */

export type Rng = () => number;

export interface StatCfg {
  base: number;
  level_cap: number;
  mob_level_cap: number;
  item_slots: number;
  core_flat_max: number;
  split_items: number;
  points_per_level: number;
  point_value: number;
  paragon_from: number;
  paragon_points_per_level: number;
  reference_build: string;
  respec_cost: number;
  note: string;
}

/**
 * The engine's named constants — the keys `engine.json` `K` must carry. The list is the contract:
 * a constant the engine reads but the data dropped must fail the loader, and a name the engine
 * never declared must fail the compiler, instead of reading as `undefined` inside a formula.
 */
export const K_KEYS = [
  'K_STR', 'K_INT', 'K_ELEM', 'K_VIT_HP', 'K_VIT_REGEN', 'K_INT_MP', 'K_INT_MREGEN', 'K_AGI_ASPD',
  'K_WIS_CDR', 'K_WIS_ES', 'K_DEX_ACC', 'K_DEX_ALIGN', 'K_MOB_RES', 'K_VIT_STUNREC', 'K_LCK_CRIT',
  'K_LCK_PDOGE', 'K_LCK_DROP', 'K_STR_WEIGHT', 'K_PDOGE', 'K_CRIT_CAP', 'K_CRIT_OVERFLOW',
  'K_STUN_PER_ALIGN', 'K_EVASION', 'K_ARMOUR', 'armour_divisor', 'mob_damage_divisor',
  'K_MOB_PS_STAT', 'K_BLEED', 'K_BLEED_CHANCE', 'bleed_time_sec', 'K_MOB_DODGE',
] as const;

/** One named engine constant, by the name the data gives it. */
export type KKey = (typeof K_KEYS)[number];

/** The constant map: a finite set of named numbers, not an open index. */
export type KMap = Record<KKey, number>;

export interface Caps {
  /** No Cap (owner ruling) — `null` is the data's word for "keeps climbing". */
  alignment: number | null;
  crit_chance: number | null;
  accuracy: number | null;
  /** The clock Cap in its own unit: the fastest swing the game allows. */
  attack_interval_sec: number;
  cdr: number;
  elem_res: number;
  /** The top of the tree's `elem_res` unlock — the ceiling the raised Cap cannot pass. */
  elem_res_max: number;
  evasion: number;
  perfect_dodge: number | null;
  weight_overload: number;
  /** The second avoidance layer. No Cap (owner ruling): a blocked hit is cut, not deleted. */
  block: number | null;
  /** The flat cut a block applies: `armour / block_divisor`. */
  block_divisor: number;
  /** The lightning stun chance Cap, elements.md — fed by Alignment plus the gear line. No Cap (owner ruling). */
  stun: number | null;
}

export interface ModMax {
  phys_flat_main_hand: number;
  phys_pct_main_hand: number;
  magic_flat_main_hand: number;
  magic_pct_main_hand: number;
  crit_pct_main_hand: number;
  crit_damage_mod_pct: number;
  accuracy_pct: number;
  aspd_pct: number;
  hp_pct_per_item: number;
  mana_pct_per_item: number;
  res_pct_per_item: number;
  cdr_pct_per_item: number;
  align_pct_per_item: number;
  energy_shield_flat_t1: number;
  max_energy_shield_pct: number;
  // the defensive and regen ceilings the survival cage reads off the same table
  armour_flat_t1: number;
  armour_pct: number;
  evasion_flat_t1: number;
  evasion_pct: number;
  perfect_dodge_pct: number;
  block_chance: number;
  all_resistance_pct: number;
  status_resistance_pct: number;
  life_regen_pct: number;
  life_regen_flat: number;
  mana_regen_pct: number;
  mana_regen_flat: number;
  bleed_chance: number;
  stun_chance: number;
  armour_pen: number;
}

export interface LevelGain {
  hp_base: number;
  hp_per_level: number;
  hp_pct_mod_slots: number;
  mana_base: number;
  mp_per_level: number;
  weight_base: number;
  cdr_mod_items: number;
  cdr_buff_pct: number;
  res_mod_items: number;
}

export interface LootBand {
  group_mobs: number;
  upgrades_per_hr: number;
  lck_level: number | 'ceiling';
}

/** One interface per stone stream, so a stream's own field is required rather than one of six optionals. */
export interface QualityStoneSource {
  monster_quality_chance: number;
  elite_quality_chance: number;
  boss_quality_stones: number;
  note?: string;
}

export interface RepairStoneSource {
  elite_repair_chance: number;
  boss_repair_stones: number;
  note?: string;
}

export interface CorruptStoneSource {
  boss_corrupt_chance: number;
  note?: string;
}

export interface ReplaceStoneSource {
  elite_replace_chance: number;
  boss_replace_chance: number;
  note?: string;
}

export interface ImprintStoneSource {
  elite_imprint_chance: number;
  boss_imprint_stones: number;
  note?: string;
}

export interface PolishStoneSource {
  elite_polish_chance: number;
  boss_polish_chance: number;
  boss_polish_stones: number;
  note?: string;
}

export interface ReforgeStoneSource {
  boss_reforge_chance: number;
  note?: string;
}

/** Bosses only, and one stone a whole-set press. */
export interface RebirthStoneSource {
  boss_rebirth_chance: number;
  boss_rebirth_stones: number;
  status?: string;
  note?: string;
}

/** The bag filter's own rules (`engine.json` `loot.filter`) — the margin and the two defaults. */
export interface LootFilterCfg {
  /** A swap must beat what is worn in the same slot by this much to be worth dissolving the old piece. */
  upgrade_margin_pct: number;
  rules: {
    /** A fresh character keeps every drop and dissolves nothing. */
    default_enabled: boolean;
    /** Whether a missing Element counts as an upgrade. */
    default_keep_missing_element: boolean;
    note?: string;
  };
  note?: string;
}

export interface LootCfg {
  bands: Record<string, LootBand>;
  base_drop_chance: number;
  ttk_per_mob_sec: number;
  group_spawn_sec: number;
  elite_spawn_chance: number;
  elite_tier_stones: number;
  elite_add_stone_chance: number;
  boss_per_hour: number;
  boss_tier_stones: number;
  boss_add_stones: number;
  /** Wild-unique share per normal spawn: one selected Species Unique upgrades the spawn it replaces. */
  unique_chance: number;
  quality_stone_sources: QualityStoneSource;
  repair_stone_sources: RepairStoneSource;
  corrupt_stone_sources: CorruptStoneSource;
  replace_stone_sources: ReplaceStoneSource;
  imprint_stone_sources: ImprintStoneSource;
  polish_stone_sources: PolishStoneSource;
  reforge_stone_sources: ReforgeStoneSource;
  rebirth_stone_sources: RebirthStoneSource;
  /** Line 1's value scale. */
  frame_mod: FrameModCfg;
  /** The window's thirds: the roll under the first cut is the top third (T1), under the second the
   *  middle (T2), above it the bottom (T3). The odds every Mod shares. */
  tier_split: [number, number];
  /** The bag filter's margin and defaults — the player's own threshold, never a second copy of a number. */
  filter: LootFilterCfg;
  /** A variant's lean: the stream its row tilts the three collectible streams toward (`shift_pct`). */
  variant_lean: { shift_pct: number; categories: string[]; note?: string };
}

export interface CraftCfg {
  reroll_value_stones_per_use: number;
  refine_stones_per_use: number;
  /** What one roll of a line costs in Tier stones: Randomize (its Tier) and Reroll mod (its identity). */
  roll_stones_per_use: number;
  refine_slots_per_item: number;
  refine_steps: number;
  ascend_items_per_set: number;
  ascend_add_stones: number;
  ascend_tier_stones: number;
  polish_casts_per_full_set: number;
  remove_stones_per_use: number;
  replace_stones_per_use: number;
  imprint_stones_per_use: number;
  polish_stones_per_use: number;
  reforge_stones_per_use: number;
  rebirth_stones_per_use: number;
  repair_stones: number;
  upgrade_cap: number;
  upgrade_costs: number[];
  upgrade_breaks_from: number;
  upgrade_success_endpoints: { safe_to: number; mid: [number, number]; high: [number, number] };
  protection_start: number;
  gear_mod_per_level: number;
  corrupt_outcomes: { kind: string; weight: number; steps?: number }[];
}

/** Material-driven gear creation (`engine.json` `forge`) — pattern + material grade. */
export interface ForgeCfg {
  note?: string;
  /** Smithing level required per material grade (index 0 = grade 1). */
  smithing_level: number[];
  /** Smithing XP awarded per material grade (index 0 = grade 1). */
  xp_per_grade: number[];
  materials: Record<string, { family: string; grade: number }>;
  families: Record<string, { name: string; bases: Record<string, string> }>;
  armour: Record<string, { name: string; count: number }>;
  weapons: Record<string, { name: string; family: string; frame: string; count: number }>;
}

export interface TownShared {
  gold_per_junk_piece: number;
  round_rate_to_decimals: number;
  craft_progress_intent_sec: number;
  pool_regen_tolerance: number;
}

export interface EnergyShieldCfg {
  delay_sec: number;
  /** Base regen as a percent of the max pool per second; an `es_regen` line amplifies it. */
  regen_pct: number;
  /** Player-only by design: a mob sizes its survivability from `mob_HP`, so a second pool would
   *  count the same anchor twice (checks.md H1). */
  player_only: boolean;
  chaos_bypasses: boolean;
}

export interface EvasionRollCfg {
  opening_rating: number;
  opening_max_chance_pct: number;
  opening_share: number;
  earned_mult: number;
  note: string;
}

export interface XpCfg {
  per_kill_mob_level: number;
  kills_anchors: Record<string, number>;
  elite_mult: number;
  boss_mult: number;
  /** A wild Species Unique pays its own XP line on top of the Elite stone lines. */
  unique_mult: number;
  step: number;
  /** The level the flat XP bar starts at, and the level whose step out of it sets that bar. */
  plateau_from?: number;
  plateau_step_at?: number;
  note: string;
}

export interface CurveCfg {
  skill_per_level: number;
  hp_at_player_level_cap: number;
}

export interface MobCore {
  str: number;
  agi: number;
  vit: number;
  dex: number;
  int: number;
  wis: number;
  lck: number;
  [key: string]: number;
}

export type MobDamageType = 'physical' | 'magic' | 'mixed';

/** One authored resistance line: the Element and the percent it cuts. */
export interface MobResistance {
  element: string;
  pct: number;
}

/** One authored weakness: the Element and the percent more it lands for. */
export interface MobWeakness {
  element: string;
  taken_pct: number;
}

/** One thematic material the body can yield on any kill. */
export interface MobBonusMaterial {
  resource: string;
  chance: number;
  min: number;
  max: number;
}

export interface MobSpecies {
  id: string;
  name: string;
  /** The single broad fantasy Race that contains this Species. */
  race: MobRaceId;
  /** Optional species-flavoured alternatives, at most one for each sale rarity. */
  junk_items: Partial<Record<'common' | 'uncommon' | 'rare', string>>;
  zones: number[];
  /** The regions this species may live in — its `zones` must be a subset (X52). */
  habitat: string[];
  sizes: string[];
  /** The one Element the Species attacks with and carries as its innate status; resistance is authored separately. */
  element: string;
  /** The one Element line this body cuts. */
  resistance: MobResistance;
  /** The one Element line this body takes more of. */
  weakness: MobWeakness;
  /** The one material this body can yield on any kill, independent of Hunting. */
  bonus_material: MobBonusMaterial;
  carries_weapon: boolean;
  accuracy_mult: number;
  /** Authored fixed spawn level for each zone this Species inhabits; never derived from player level. */
  zone_levels?: Record<string, number>;
  /** Default damage type; a normal Variant may override it. */
  damage: MobDamageType;
  /** Explicit potion-drop permission; independent of the Species' Race. */
  potion_source?: boolean;
  trait?: string;
  /**
   * The trait read as a mechanic: flag keys from the closed set `mob.trait_mechanics.set`. Absent
   * means an ordinary body. None of them moves mob_HP, mob PS, the drop line or the stone funnel (X74).
   */
  mechanics?: Record<string, string | boolean>;
  /** The line the species holds in a mob group's formation (`mob.reach`). */
  line: string;
  /** The species' Base damage power, averaged to 1.00 across the roster (X68). */
  power_base: number;
  /** The Core block the Species uses for its reference body — the roster mean prices MEAN_CORE. */
  core: MobCore;
}

export interface MobSize {
  id: string;
  name: string;
  ps: number;
  /** Base Evasion the body class carries, as a percent added on top of the species Dex line. */
  evasion_pct: number;
  group?: string;
  /** A boss is not a size — it declares which body class a weapon's `size_mult` reads it as. */
  reads_as?: string;
}

/** Weapon × body class (HugePatch §12): one row per weapon NAME, three body-class columns. */
export interface WeaponSizeMultCfg {
  note?: string;
  /** What a magic weapon's bolt is worth, as a share of the finished hit (the attack ladder's floor). */
  bolt_share_pct?: number;
  bolt_note?: string;
  ladder: Record<string, { small: number; medium: number; large: number }>;
}

export interface MobSubzone {
  name: string;
  environment: string;
  element: string;
  /** Species ids fielded in this side of the zone. */
  species: string[];
  /**
   * This side's own spawn profile (X75): the pack range, the Elite rate and the body mix a group
   * rolled on this side draws from. Every zone's three sides average back to the zone's published
   * `group`, to `loot.elite_spawn_chance`, and to the plain body mix, so standing on a side changes
   * what that side reads like and never what the zone pays.
   */
  spawn?: MobSubzoneSpawn;
}

/** One side's spawn profile (`mob.zones[].subzones[].spawn`). */
export interface MobSubzoneSpawn {
  /** The group range rolled on this side, e.g. `"1-3"`. */
  group?: string;
  /** The percent of groups on this side that arrive as an Elite. */
  elite_pct?: number;
  /** The body mix a normal spawn draws: `swarm` | `even` | `brute` (`mob.spawn_packs`). */
  pack?: string;
}

export interface MobZone {
  id: number;
  name: string;
  region?: string;
  levels: [number, number];
  hp: [number, number];
  /** The item-quality band this zone pays at — the ceiling a drop in the zone draws under. The bestiary
   *  page prints it per zone, so the declaration carries it the same way the data row does. */
  quality: string;
  group: string;
  /** What a spawn table rolls against: the zone cast is the union of its sub-zones. The Elements a
   *  zone fields are derived from that cast (`zoneElements`), never declared beside it. */
  subzones?: MobSubzone[];
}

/** One fixed-level normal variant: its name, level band, combat Core and optional damage override. */
export interface MobVariant {
  name: string;
  levels: [number, number];
  core: MobCore;
  damage?: MobDamageType;
}

export type MobRaceId =
  | 'humanoid' | 'beast' | 'undead' | 'demon' | 'dragon' | 'insect'
  | 'plant' | 'fish' | 'formless' | 'elemental' | 'celestial';

export interface MobRacesCfg {
  note: string;
  set: MobRaceId[];
}

export interface MobBoss {
  zone: number;
  name: string;
  species: string;
  /** Bosses keep the source species' Vit, so the zone's HP anchor stays fixed. */
  core: MobCore;
  trait: string;
  /** A boss runs its species' trait mechanics unless it declares its own. */
  mechanics?: Record<string, string | boolean>;
  element: string;
  damage: MobDamageType;
  accuracy_mult: number;
  reads_as: 'small' | 'medium' | 'large';
}

/** An optional named wild boss belonging to a Species; it is a creature, not a rank. */
export interface MobUnique {
  species: string;
  name: string;
  core: MobCore;
  trait: string;
  /** A unique runs its species' trait mechanics unless it declares its own. */
  mechanics?: Record<string, string | boolean>;
  element: string;
  damage: MobDamageType;
  accuracy_mult: number;
  reads_as: 'small' | 'medium' | 'large';
}

export interface MobElite {
  name: string;
  hp: number;
  ps: number;
  evasion_pct: number;
}

/** One mob-only skill row. A strike replaces the next basic swing; an aura is a passive group buff. */
export interface MobSkillRow {
  id: string;
  name: string;
  mode: 'strike' | 'aura';
  /** The skill's visual Element; damage still comes from the mob's own damage type and innate Element. */
  element: string | null;
  /** A forced control status. Damaging statuses are deliberately absent from the MVP. */
  status?: string | null;
  /** Seconds between casts; absent or zero means always ready. */
  cd?: number;
  /** Display lead-in for the cast beat; it never moves the action clock. */
  cast_sec?: number;
  role?: 'front' | 'stand-off' | 'any';
  /** Auras affect the engaged group (max 3), or only that source's own line. */
  scope?: 'engaged' | 'line';
  /** Aura effects are defensive so a group buff cannot double the mob DPS budget. */
  effects?: Partial<Record<'armour_pct' | 'resist_pct', number>>;
}

/** `tools/data/mob-skills.json`: the optional library and its override kits. */
export interface MobSkillsData {
  meta: {
    note?: string;
    max_kit: number;
    statuses: string[];
    aura_stats: string[];
    scopes: string[];
  };
  skills: MobSkillRow[];
  kits: {
    species: Record<string, string[]>;
    variants: Record<string, string[]>;
    bosses: Record<string, string[]>;
    uniques: Record<string, string[]>;
  };
}

export interface MobStatCfg {
  note: string;
}

/** The authored Core-spend guide: one Dex ceiling per Variant band. */
export interface MobCoreSpendCfg {
  note: string;
  dex_cap: number[];
}

/** One named field form for a lineage in one ten-level zone band. */
export interface MobForm {
  name: string;
  levels: [number, number];
  /** Legacy field-form Core projection; live normal/Elite combat Core belongs to MobVariant. */
  core: MobCore;
  /** Species-owned normal-variant drop identity inherited by this form. */
  drop_profile?: string;
}

/** One field-label tier: where the word comes from (`species` | `name`) and the suffix appended. */
export interface FieldLabelRule {
  source: string;
  suffix: string;
}

/**
 * One variant's drop identity (`mob.variant_drops`, keyed by the variant name `mob.variants` owns).
 * `item`/`rarity` are its base junk item and sale rarity; its species may supply a second item at the
 * same rarity. `lean` is the collectible stream it tilts toward, applied through `leanReweight` so
 * the total expected drops/kill is conserved.
 */
export interface VariantDrop {
  item: string;
  rarity: string;
  lean: 'gear' | 'herb' | 'junk' | 'none';
}

/** The three field-label rows the roster doc and the client share (no colour — that is client-only). */
export interface FieldLabelsCfg {
  note: string;
  normal: FieldLabelRule;
  elite: FieldLabelRule;
  boss: FieldLabelRule;
}

export interface MobCfg {
  /** Closed taxonomy registry. Races are descriptive, not automatic gameplay rules. */
  races: MobRacesCfg;
  stat: MobStatCfg;
  /** The band ceilings that keep a Variant's Core spend from collapsing into Dex (X79). */
  core_spend: MobCoreSpendCfg;
  /** Highest mob level that receives authored field forms. Later zones reuse the latest form label. */
  form_level_cap: number;
  /** Optional field labels keyed by zone id, then Species id. Missing rows inherit the prior label. */
  forms: Record<string, Record<string, MobForm>>;
  zones: MobZone[];
  species: MobSpecies[];
  /** Normal Variant bands by Species id; they select name/Core while zone_levels sets actual spawn level. */
  variants?: Record<string, MobVariant[]>;
  /** What each of those names drops: its base junk item, sale rarity and stream lean (`X56`). */
  variant_drops?: Record<string, VariantDrop>;
  /** Zero or more named Uniques per Species (`mob.uniques`); chance is per normal spawn. */
  uniques?: MobUnique[];
  /** The second drop tilt keyed by the subzone environment; `none` is the identity (`X73`). */
  environment_lean?: Record<string, 'none' | 'gear' | 'herb' | 'junk'>;
  /** The closed set of trait mechanics, each with the one number it runs on (`X74`). */
  trait_mechanics?: Record<string, any>;
  /** The three body mixes a side's normal spawns draw from (`mob.spawn_packs`, `X75`). */
  spawn_packs?: Record<string, any>;
  deprecated_species?: Record<string, string>;
  sizes: MobSize[];
  bosses: MobBoss[];
  elite: MobElite;
  curve: CurveCfg;
  spawn_weights: Record<string, number>;
  damage_split: Record<string, [number, number]>;
  /** Mobs carry no skills in the current build; X27 fails if a species gains one while this is false. */
  skills_enabled: boolean;
  /** Formation bands: the melee/reach/standoff distances a group places its mobs at. */
  reach: { bands: Record<string, number>; weapons: Record<string, number>; rules?: string };
  /** The clock a normal and an elite swing at, and a boss's own (`mob.attack_clock_per_sec`). */
  attack_clock_per_sec: { normal: number; elite: number; boss: number; note?: string };
  field_labels: FieldLabelsCfg;
}

export interface WeaponCfg {
  name: string;
  weapon_aspd: number;
  weapon_mult: number;
}

/** One band's own level span — the levels a band reads, `item-level.md`. */
export interface ItemLevelSpan {
  band: string;
  from: number;
  to: number;
}

export interface ItemLevelCfg {
  /** The band ladder: each band's level span, in order. */
  spans: ItemLevelSpan[];
  /** Levels Ascend adds to a piece (one span's length, gated against it). */
  ascend_levels: number;
  crafted_max: number;
  mods_added_cap: number;
  add_stones_per_fill: number[];
  /** The Unbound lines a drop draws, both ends included. */
  unbound_slots: { min: number; max: number };
  bound_slots: number;
  /** Line 1 — the Frame Mod slot, unremovable like the Bound pair. */
  frame_mod_slots: number;
  note?: string;
}

/** Line 1's own rules (`engine.json` `loot.frame_mod`). */
export interface FrameModCfg {
  /** What each Mod on the line is multiplied by, keyed by how many share it (1 · 2 · 3). */
  value_scale: Record<string, number>;
  note?: string;
}

export interface ElementsCfg {
  order: string[];
  status_of?: Record<string, string>;
  /** The damage indicator's colour set: one per Element, one for a physical hit, one for a crit. */
  colour?: Record<string, string>;
  physical_colour?: string;
  crit_colour?: string;
}

export interface SkillXpCfg {
  xp_per_kill: number;
  xp_per_step: number;
  level_cap: number;
  note: string;
}

export interface PresetsCfg {
  sets: number;
  main_index: number;
  auto_select_by_zone?: boolean;
  cooldowns_persist_on_push?: boolean;
  skill_xp_is_account_wide?: boolean;
}

export interface ModWeightsCfg {
  rows: { ids: string[]; weight: number | number[] }[];
  role_weights: Record<string, number>;
  flat_group: string[];
}

export interface DungeonCfg {
  mob_cap: number;
  group_cap: number;
  cooldown_sec: number;
  retreat_keep_min: number;
  retreat_keep_max: number;
  note?: string;
}

export interface RoadNodeCfg {
  id: string;
  q: number;
  r: number;
}

export interface RoadCfg {
  nodes: RoadNodeCfg[];
  graph_rule: string;
  standing_rule: string;
  cost_rule: string;
  block_sec: number;
  encounter_chance_pct: number;
  encounter_rule: string;
  push_rule: string;
  waypoint_rule: string;
  patrol: {
    min_stops: number;
    max_stops: number;
    groups_per_stop: number;
    repeat_default: boolean;
    auto_return_threshold_pct: number;
    auto_return_default: boolean;
  };
  seen_rule?: string;
}

export interface FarmCfg {
  level_cap: number;
  level_divisor: number;
  tier_unlock_level: Record<string, number>;
  growth_hours: number;
  plots: { base: number; shop_deeds: number };
  yield_per_harvest: number;
  seed_cost_herbs: number;
  xp_per_harvest: number;
  offline_cap_hours: number | null;
}

export interface FieldworkCfg {
  materials: { id: string; name: string; group: string }[];
  regional_drop_chance: number;
  regional_food_chance: number;
  regional_food_yield: number;
  regional_sources: Record<string, { mine: string; grove: string; food: string }>;
  workshop_recipes: {
    id: string; name: string; skill: 'mining' | 'woodcutting' | 'smithing'; level: number; xp: number; mastery_xp?: number;
    materials: Record<string, number>; yield: number;
  }[];
  smithing_recipes: { id: string; name: string; level: number; xp: number; mastery_xp: number; materials: Record<string, number>; yield: number }[];
  fishing: { foods: string[]; interval_sec: number; yield: number; xp: number; mastery_xp: number };
  life_skill_combat: {
    budget: number; track_cap: number; weights: Record<string, number>; rungs: number[];
    effects: Record<string, { stat: string; unit: 'pct' | 'percentage_points' }>;
  };
  level_divisor: number;
  level_cap: number;
  mastery_divisor: number;
  mastery_cap: number;
  progression: {
    harvest_bonus_levels: number[];
    harvest_bonus_per_level: number;
    drop_rate_bonus_per_skill_level_pct: number;
    drop_rate_bonus_per_mastery_level_pct: number;
    drop_rate_bonus_cap_pct: number;
  };
  hunger: {
    max: number;
    empty_hp_regen_cut_pct: number;
    drain_per_sec: { travel: number; hunting: number; gathering: number };
    auto_eat: { enabled_default: boolean; threshold_default: number; threshold_options: number[]; allow_raw_default: boolean; emergency_raw_at_zero: boolean; priority: ('cooked' | 'fruit' | 'herb' | 'raw')[] };
  };
  foods: {
    id: string; name: string; kind: 'raw' | 'fruit' | 'herb' | 'ingredient' | 'cooked';
    hunger_restore: number; edible: boolean; auto_eat: boolean; source?: string;
  }[];
  travel_events: {
    chance_per_block: number;
    events: {
      id: string; weight: number; kind: 'food' | 'restore'; text: string;
      food_id?: string; amount_min?: number; amount_max?: number; hunger_restore?: number;
    }[];
  };
  camp: { free_relocations: number; relocate_ore: number; relocate_timber: number };
  camp_encounters: {
    arrival_grace_sec: number; check_interval_sec: number; chance_per_check: number;
    warning_sec: number; choice_sec: number; cooldown_sec: number;
    exposure_threshold_sec: number; exposure_cap_sec: number; exposure_decay_per_sec: number;
    kinds: ('sounds' | 'prowler' | 'traveler' | 'nest' | 'herd' | 'injured' | 'discovered')[];
    barter_food: number; aid_food: number; aid_potion_count: number;
  };
  wild_site_index: { dungeon: number; mine: number; grove: number };
  actions: Record<'mine' | 'grove' | 'fish', {
    resource: string; yield: number; interval_sec: number; xp: number; mastery_xp: number;
    rare_drop_chance: number; rare_resource: string;
    food_drop_chance?: number; food_id?: string;
    /** The resource this verb is the bulk source for, named again on the kill table below. */
    mob_resource?: string;
  }>;
  hunt: {
    xp_per_kill: number; mastery_xp_per_kill: number; meat_drop_chance: number;
    meat_min: number; meat_max: number; edible_species: string[];
    food_drops: { species: string[]; food_id: string; chance: number; min: number; max: number }[];
    /** The metal and wood a body is made of, paid into `materials` the way `mine`/`grove` pay it. */
    material_drops?: { species: string[]; resource: string; chance: number; min: number; max: number }[];
  };
  recipes: {
    id: string; name: string; menu: 'hearth' | 'forage'; level: number; xp: number; mastery_xp: number;
    materials: Record<string, number>; foods: Record<string, number>; herbs: Record<string, number>;
    hunger_restore: number;
    duration_sec: number; damage_pct: number; hp_regen_pct: number;
  }[];
}

export interface HerbsCfg {
  low_chance: number;
  mid_chance: number;
  high_chance: number;
  /** A bundle rolls between these two, so the average is what the potion-drop derivation divides by. */
  bundle_min: number;
  bundle_max: number;
}

export interface PotionsCfg {
  hp_base_pct: number;
  hp_step_pct: number;
  mana_base_pct: number;
  mana_step_pct: number;
  list: { name: string; pool: string; index: number }[];
  craft: Record<string, unknown>;
  condensed: { cost_bottles: number; cost_reroll_value_stones: number };
  shared_cooldown_sec: number;
  max_uses_per_fight: number;
  boss_suppressed: boolean;
}

export interface InventoryCfg {
  character_slots: number;
  stack_size: Record<string, number>;
  unit_weight: Record<string, number>;
  gold_uses_slot: boolean;
  offline_cap_hr: number | null;
  overflow: string;
  note: string;
}

/** The Max HP press lines (`engine.json` `max_hp_press`) — what a press takes of a pool it reads. */
export interface MaxHpPressCfg {
  /** The share a Boss or Unique takes of the target's own maximum pool. */
  boss_pct: number;
  note?: string;
}

export interface EngineData {
  meta: any;
  stat: StatCfg;
  K: KMap;
  status: any;
  mob: MobCfg;
  bleed: any;
  level_gain: LevelGain;
  xp: XpCfg;
  mod_max: ModMax;
  mod_weights: ModWeightsCfg;
  energy_shield: EnergyShieldCfg;
  evasion_roll: EvasionRollCfg;
  caps: Caps;
  weapons: WeaponCfg[];
  herbs: HerbsCfg;
  farm: FarmCfg;
  fieldwork: FieldworkCfg;
  potions: PotionsCfg;
  presets: PresetsCfg;
  skill_drop: any;
  skill_xp: SkillXpCfg;
  build: any;
  global: any;
  loot: LootCfg;
  road: RoadCfg;
  dungeon: DungeonCfg;
  inventory: InventoryCfg;
  item_level: ItemLevelCfg;
  salvage: {
    note?: string;
    outputs: Record<string, number>;
    alchemy: { scrap_cost: number; value_yield: number; outputs_per_tier_stone: number };
  };
  save: any;
  junk: any;
  aoe: any;
  max_hp_press: MaxHpPressCfg;
  craft: CraftCfg;
  forge: ForgeCfg;
  town_shared: TownShared;
  f_rows_carried: any[];
  elements: ElementsCfg;
  opening: any;
  weapon_size_mult?: WeaponSizeMultCfg;
}

/** The skill roster payload (`tools/data/skills.json`) — only the fields the model reads. */
export interface SkillRow {
  id: string;
  name?: string;
  type?: string;
  group?: string;
  /** the weapon family this row fires with, matched against the Base's own name — only the arrow rows carry one (`bow` covers bow and crossbow) */
  weapon?: string;
  element?: string;
  cd?: number;
  basis?: string;
  targets?: string;
  /** The row's own flat damage at skill level 1 — its identity, the same for every caster. */
  base_flat?: number;
  /** The share of the added power line the press receives, in percent (PoE damage effectiveness). */
  eff?: number;
  mana?: string;
  /** Flat HP units paid out of the caster's current HP pool instead of Mana. */
  hp_cost?: string;
  /** The caster's Max HP share added to the skill's damage basis, in percent. */
  max_hp_pct?: number;
  effect?: string;
  modelled_by?: string;
  rules?: string[];
  kind?: string;
  /** The window the row grants, in the data's own words (`"8 sec"`) — the sim reads the seconds off it. */
  duration?: string;
  /** The reserve tier name this aura draws from (`reserve_tiers`). */
  reserve?: string;
  effects?: { stat: string; element?: string; status?: string; op: string; value: number; subject?: string; condition?: string; cap?: number }[];
  /** A legacy row kept resolvable for old saves, but excluded from drops, rewards and the active UI. */
  retired?: boolean;
  /** The active row that carries this retired row's role. */
  retired_to?: string;
}

export interface SkillsData {
  meta: {
    formula?: {
      /** One row per skill level: the multiplier a press and an effect carry at that level. */
      skill_levels?: {
        note?: string;
        rows: { level: number; damage_pct: number; effect_pct: number; buff_effect_pct?: number }[];
        /** Effect stats that already spend skill level their own way and must not be scaled twice. */
        special_level_effects?: string[];
      };
      /** Provenance only: the archetype bands the press pairs were *derived from*. No formula reads
       *  this block — the numbers a cast spends are each row's own `base_flat` / `eff` / cooldown. */
      archetype_bands?: any;
      /** The existing data key names the step shared by typed Mana and HP skill costs. */
      mana_level_step_pct?: number;
      cast_reference?: { cdr_pct: number; ladder_pct: number };
      /** The duplicate ladder: each rung's cooldown reduction and the duplicates it costs. */
      ladder: { rows: { step: number; cdr: number; cost: number }[]; note?: string };
      /** How many duplicates convert into one of a chosen skill. */
      conversion_duplicates: number;
      /** What a press of the weapon's own skill group is worth: 0.25 is +25%. */
      group_bonus: number;
    };
    /** The three numbers a conditional row's leg opens at (`tools/data/skills.json` `cast_conditions`). */
    cast_conditions: { hp_below_pct_default: number; mana_floor_pct_default: number; min_targets_default: number };
    reservation: { max_pct: number };
  };
  skills: SkillRow[];
  reserve_tiers: Record<string, { pct: number }>;
}

/** The mods payload (`tools/data/mods.json`) — only what the loot roller reads. */
export interface ModsData {
  mods: { id: string; name: string; group?: string; max: number; bands: number[][][]; rolls?: string[] }[];
}

/** A Base frame (`tools/data/bases.json`) — only the fields the collector reads. */
export interface BaseRow {
  name: string;
  school?: string | null;
  [k: string]: unknown;
}

export interface BasesData {
  bases: BaseRow[];
  weapons?: { name: string; weight: number; damage?: string; group?: string; size_mult?: { small: number; medium: number; large: number } }[];
  weapon_frames?: Record<string, {
    name: string;
    frame_mod: string[];
    legacy_frame_mod?: string[];
    drop_weight?: number;
    value_bias?: number;
  }[]>;
  dual_wield_weight_mult?: number;
  mastery: Record<string, number>;
}

/** A town record (`tools/data/town.json`) — only the fields the collector reads. */
export interface TownData {
  collector_sets: { id: string; settlement: string; pieces: string[]; quality: string; reward: string; pays_gold: boolean }[];
  /** A repeatable line prices itself one way or another: a fixed `m`, a band (`m_min`/`m_max`), or
   *  a per-block rate. The row that has none of them is not a price — it is a rule. */
  repeatable: { id: string; m?: number; m_min?: number; m_max?: number; m_per_block?: number }[];
}
