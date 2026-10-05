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
  per_level: number;
  level_cap: number;
  mob_level_cap: number;
  item_slots: number;
  core_flat_max: number;
  split_items: number;
  note: string;
}

/** Named engine constants — a map by nature, so it stays an index rather than 28 hand-copied keys. */
export type KMap = Record<string, number>;

export interface Caps {
  alignment: number;
  aspd: number;
  cdr: number;
  elem_res: number;
  evasion: number;
  perfect_dodge: number;
  weight_overload: number;
  /** The second avoidance layer — a blocked hit is deleted outright (D-123). */
  block: number;
  /** The lightning stun chance Cap, elements.md — fed by Alignment plus the gear line (D-123). */
  stun: number;
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
  res_pct_per_item: number;
  cdr_pct_per_item: number;
  align_pct_per_item: number;
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
  kills_per_hr_published: number;
  group_mobs: number;
  upgrades_per_hr: number;
  lck_level: number | 'ceiling';
}

export interface StoneSource {
  monster_quality_chance?: number;
  elite_quality_chance?: number;
  boss_quality_stones?: number;
  elite_repair_chance?: number;
  boss_repair_stones?: number;
  boss_corrupt_chance?: number;
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
  timeline_checkpoints_hr: Record<string, number>;
  push_hr_levels_91_100: number;
  quality_stone_sources: StoneSource;
  repair_stone_sources: StoneSource;
  corrupt_stone_sources: StoneSource;
  /** Line 1's hybrid chance and value scale (D-123). */
  base_mod: BaseModCfg;
}

export interface CraftCfg {
  reroll_value_stones_per_use: number;
  refine_stones_per_use: number;
  refine_slots_per_item: number;
  refine_steps: number;
  ascend_items_per_set: number;
  ascend_add_stones: number;
  ascend_tier_stones: number;
  polish_casts_per_full_set: number;
  remove_stones_per_use: number;
  repair_stones: number;
  upgrade_cap: number;
  upgrade_costs: number[];
  upgrade_breaks_from: number;
  upgrade_success_endpoints: { safe_to: number; mid: [number, number]; high: [number, number] };
  protection_start: number;
  gear_mod_per_level: number;
  corrupt_outcomes: { kind: string; weight: number; steps?: number }[];
}

export interface TownShared {
  gold_per_junk_piece: number;
  round_rate_to_decimals: number;
  craft_progress_intent_sec: number;
  pool_regen_tolerance: number;
}

export interface EnergyShieldCfg {
  delay_sec: number;
}

export interface XpCfg {
  per_kill_mob_level: number;
  kills_anchors: Record<string, number>;
  elite_mult: number;
  boss_mult: number;
  step: number;
  hours_tolerance: number;
  note: string;
}

export interface CurveCfg {
  skill_per_level: number;
  hp_at_player_level_cap: number;
}

export interface MobSpecies {
  id: string;
  name: string;
  zones: number[];
  sizes: string[];
  element_bias: string[];
  carries_weapon: boolean;
  accuracy_mult: number;
  damage: unknown;
  stats: { str: number; dex: number; int: number; vit: number; agi: number; lck: number };
}

export interface MobSize {
  id: string;
  name: string;
  hp: number;
  ps: number;
  evasion: number;
}

export interface MobZone {
  id: number;
  name: string;
  levels: [number, number];
  hp: [number, number];
  elements: string[];
  group: string;
}

export interface MobBoss {
  zone: number;
  name: string;
  species: string;
}

export interface MobElite {
  name: string;
  hp: number;
  ps: number;
  evasion: number;
}

export interface MobStatCfg {
  base: number;
  per_level: number;
}

export interface MobCfg {
  stat: MobStatCfg;
  zones: MobZone[];
  species: MobSpecies[];
  sizes: MobSize[];
  bosses: MobBoss[];
  elite: MobElite;
  curve: CurveCfg;
  spawn_weights: Record<string, number>;
  damage_split: Record<string, number>;
}

export interface WeaponCfg {
  name: string;
  weapon_aspd: number;
}

export interface RarityRow {
  /** How many of the Random lines (4-7) arrive rolled at drop — the rest are empty slots (D-123). */
  dropped_random: number;
  crafted_max: number;
}

export interface RarityCfg {
  floor_ceiling: Record<string, { floor?: string; ceiling?: string; note?: string }>;
  Common: RarityRow;
  Rare: RarityRow;
  drop_chance: Record<string, number>;
  mods_added_cap: number;
  add_stones_per_fill: number[];
  stat_mod_slots: number;
  legacy_slots: number;
  /** Line 1 — the Base Mod slot, unremovable like the Legacy pair (D-123). */
  base_mod_slots: number;
  note?: string;
}

/** Line 1's own rules (`engine.json` `loot.base_mod` · item-base.md · D-123). */
export interface BaseModCfg {
  /** Chance the line gains the 2nd and 3rd defence Mod, in order (armour slots only). */
  hybrid_chance: number[];
  /** What each Mod on the line is multiplied by, keyed by how many share it. */
  value_scale: Record<string, number>;
  note?: string;
}

export interface ElementsCfg {
  order: string[];
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
}

export interface ModWeightsCfg {
  rows: { ids: string[]; weight: number | number[] }[];
  role_weights: Record<string, number>;
  flat_group: string[];
}

export interface RoadLinkCfg {
  a: string;
  b: string;
  zoneA: number;
  zoneB: number;
  kind: 'ladder' | 'branch';
  terrain: string;
  trip_min: number;
}

export interface RoadCfg {
  links: RoadLinkCfg[];
  link_rule: string;
  trip_min: number;
  encounters_per_min: number;
  terrain: Record<string, Record<string, number>>;
  terrain_rule: string;
  encounters: Record<string, { weight: number; mobs: string; resolve: unknown; win: unknown; loss: unknown }>;
  base_rule: string;
  purse_gold: number;
  purse_once_per_link_per_day: boolean;
  chest_once_per_link_per_day: boolean;
  circuit: { push_skips_leg: boolean; offline_resolves: boolean; editable_in: string };
  standing_per_trip_kills: number;
  forfeit_kills: number;
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
  offline_cap_hours: number;
}

export interface HerbsCfg {
  low_chance: number;
  mid_chance: number;
  high_chance: number;
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
  adventure_slots: number;
  character_slots: number;
  stack_size: Record<string, number>;
  unit_weight: Record<string, number>;
  gold_uses_slot: boolean;
  offline_cap_hr: number;
  overflow: string;
  note: string;
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
  caps: Caps;
  weapons: WeaponCfg[];
  herbs: HerbsCfg;
  farm: FarmCfg;
  potions: PotionsCfg;
  presets: PresetsCfg;
  skill_drop: any;
  skill_xp: SkillXpCfg;
  build: any;
  global: any;
  loot: LootCfg;
  road: RoadCfg;
  inventory: InventoryCfg;
  rarity: RarityCfg;
  salvage: any;
  save: any;
  junk: any;
  aoe: any;
  craft: CraftCfg;
  town_shared: TownShared;
  f_rows_carried: any[];
  elements: ElementsCfg;
  opening: any;
  doc_prose_lines_max: number;
  doc_prose: any;
}

/** The skill roster payload (`tools/data/skills.json`) — only the fields the model reads. */
export interface SkillRow {
  id: string;
  type?: string;
  group?: string;
  cd?: number;
  basis?: string;
  final_pct?: number;
  mana?: string;
  effects?: { stat: string; element?: string; op: string; value: number; subject?: string; condition?: string; cap?: number }[];
}

export interface SkillsData {
  meta: {
    formula?: {
      level_step_pct?: number;
      /** A flat mana cost climbs on this step per skill level (D-136). */
      mana_level_step_pct?: number;
      /** How much of the pool's growth a flat cost takes on (D-136). */
      mana_pool_exponent?: number;
      /** Which character level the reference pool is derived at (D-136). */
      mana_reference_level?: number;
      cast_reference?: { cdr_pct: number; ladder_pct: number };
    };
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
  school?: string;
  [k: string]: unknown;
}

export interface BasesData {
  bases: BaseRow[];
  weapons?: { name: string; weight: number }[];
  dual_wield_weight_mult?: number;
  mastery: Record<string, number>;
}

/** A town record (`tools/data/town.json`) — only the fields the collector reads. */
export interface TownData {
  collector_sets: { id: string; settlement: string; pieces: string[]; quality: string; reward: string; pays_gold: boolean }[];
  repeatable: { id: string; m: number; m_min?: number; m_max?: number }[];
}
