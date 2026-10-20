/**
 * The one place the canonical data is checked before anything reads it.
 *
 * A TypeScript interface is erased at runtime, so `readJson<EngineData>` cannot discover a key the
 * file lost — it only renames the lie. This module is the runtime half of the same contract: a
 * small set of checks over the paths the engine factories actually use, each refusal naming the
 * exact path that is wrong (`K.K_VIT_HP`, `mob.zones[3].levels`). It is pure — no file, no clock —
 * so the browser client and the cages can run the same checks over the same file.
 *
 * The data is never changed here: a bad file is refused, not repaired.
 */

import { K_KEYS, type EngineData } from './types.ts';

/** The name the data file goes by in a refusal — the client and the cages read the same file. */
const SOURCE = 'engine.json';

/** A refusal, naming the path the way the data file names it. */
function refuse(path: string, why: string): never {
  throw new Error(`${SOURCE}: ${path} ${why}`);
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A finite number — `NaN` and `Infinity` are not values a formula can price. */
function numberAt(raw: Record<string, unknown>, key: string, path: string): number {
  const v = raw[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) refuse(`${path}.${key}`, 'must be a finite number');
  return v;
}

/** A number or an explicit `null` — the data's own word for "no Cap". */
function capAt(raw: Record<string, unknown>, key: string, path: string): number | null {
  const v = raw[key];
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) refuse(`${path}.${key}`, 'must be a finite number or null');
  return v;
}

/** A pair of numbers — the `[level, level]` / `[hp, hp]` shape a zone row carries. */
function pairAt(raw: Record<string, unknown>, key: string, path: string): [number, number] {
  const v = raw[key];
  if (!Array.isArray(v) || v.length !== 2) refuse(`${path}.${key}`, 'must be a pair of numbers');
  const [a, b] = v as unknown[];
  if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b))
    refuse(`${path}.${key}`, 'must be a pair of finite numbers');
  return [a, b];
}

/** The sections every factory reads. A section the file lost is refused by name. */
const REQUIRED_SECTIONS = [
  'stat', 'K', 'status', 'mob', 'bleed', 'level_gain', 'xp', 'mod_max', 'mod_weights',
  'energy_shield', 'evasion_roll', 'caps', 'weapons', 'herbs', 'farm', 'fieldwork', 'potions',
  'presets', 'skill_xp', 'loot', 'road', 'dungeon', 'inventory', 'item_level', 'salvage', 'junk',
  'aoe', 'max_hp_press', 'craft', 'town_shared', 'elements', 'f_rows_carried', 'build', 'global',
  'save', 'opening', 'skill_drop',
] as const;

/** The `stat` block the level curve and the sheet read. */
const REQUIRED_STAT = [
  'base', 'level_cap', 'mob_level_cap', 'item_slots', 'core_flat_max', 'split_items',
  'points_per_level', 'point_value', 'tree_points_base', 'tree_points_per_level',
] as const;

/** The `caps` block: every Cap is a number or an explicit `null` (no Cap). */
const REQUIRED_CAPS = [
  'alignment', 'crit_chance', 'accuracy', 'attack_interval_sec', 'cdr', 'elem_res', 'elem_res_max',
  'evasion', 'perfect_dodge', 'weight_overload', 'block', 'block_divisor', 'stun',
] as const;

/** The seven Core attributes a mob's or a species' Core block must carry. */
const CORE_STATS = ['str', 'agi', 'vit', 'dex', 'int', 'wis', 'lck'] as const;

/**
 * The data as the engine's declared view.
 *
 * The `K` parameter is the compile-time half of the contract: the caller's own map must satisfy
 * the declared one, so a constant the file lost fails the build before this function runs.
 */
export function validateEngineData<K extends EngineData['K']>(raw: { K: K }): EngineData {
  const data = raw as unknown as Record<string, unknown>;
  if (!isObject(data)) refuse('the file', 'must be a JSON object');

  for (const section of REQUIRED_SECTIONS) {
    if (!(section in data)) refuse(section, 'is missing');
  }

  // The named constants: every one the engine reads must be a finite number.
  const constants = data.K as Record<string, unknown>;
  if (!isObject(constants)) refuse('K', 'must be an object of named constants');
  for (const key of K_KEYS) {
    const v = constants[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) refuse(`K.${key}`, 'must be a finite number');
  }

  const stat = data.stat as Record<string, unknown>;
  for (const key of REQUIRED_STAT) numberAt(stat, key, 'stat');

  const caps = data.caps as Record<string, unknown>;
  for (const key of REQUIRED_CAPS) capAt(caps, key, 'caps');

  // The Max HP press: the share a boss answers a %HP slam with.
  const press = data.max_hp_press as Record<string, unknown>;
  numberAt(press, 'boss_pct', 'max_hp_press');

  // The bag filter: a margin the player raises, and the two defaults a fresh character starts on.
  const loot = data.loot as Record<string, unknown>;
  const filter = loot.filter as Record<string, unknown>;
  numberAt(filter, 'upgrade_margin_pct', 'loot.filter');
  const filterRules = filter.rules as Record<string, unknown>;
  for (const key of ['default_enabled', 'default_keep_missing_element']) {
    if (typeof filterRules[key] !== 'boolean') refuse(`loot.filter.rules.${key}`, 'must be true or false');
  }

  // The mob roster: the identity and the tuples the spawn code reads.
  const mob = data.mob as Record<string, unknown>;
  const damageSplit = mob.damage_split as Record<string, unknown>;
  if (!isObject(damageSplit)) refuse('mob.damage_split', 'must be an object of damage tags');
  for (const tag of ['physical', 'magic', 'mixed']) {
    const v = damageSplit[tag];
    if (!Array.isArray(v) || v.length !== 2) refuse(`mob.damage_split.${tag}`, 'must be a pair of numbers');
    const [a, b] = v as unknown[];
    if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b))
      refuse(`mob.damage_split.${tag}`, 'must be a pair of finite numbers');
  }

  const zones = mob.zones as unknown;
  if (!Array.isArray(zones)) refuse('mob.zones', 'must be an array of zones');
  const zoneIds = new Set<number>();
  zones.forEach((zone, i) => {
    const path = `mob.zones[${i}]`;
    if (!isObject(zone)) refuse(path, 'must be an object');
    const id = zone.id;
    if (typeof id !== 'number' || !Number.isFinite(id)) refuse(`${path}.id`, 'must be a number');
    if (zoneIds.has(id)) refuse(`${path}.id`, `duplicates zone id ${id}`);
    zoneIds.add(id);
    pairAt(zone, 'levels', path);
    pairAt(zone, 'hp', path);
  });

  const species = mob.species as unknown;
  if (!Array.isArray(species)) refuse('mob.species', 'must be an array of species');
  const speciesIds = new Set<string>();
  species.forEach((sp, i) => {
    const path = `mob.species[${i}]`;
    if (!isObject(sp)) refuse(path, 'must be an object');
    if (typeof sp.id !== 'string' || !sp.id) refuse(`${path}.id`, 'must be a non-empty name');
    if (speciesIds.has(sp.id)) refuse(`${path}.id`, `duplicates species id ${sp.id}`);
    speciesIds.add(sp.id);
    const core = sp.core as Record<string, unknown>;
    if (!isObject(core)) refuse(`${path}.core`, 'must be an object');
    for (const key of CORE_STATS) numberAt(core, key, `${path}.core`);
  });

  const sizes = mob.sizes as unknown;
  if (!Array.isArray(sizes)) refuse('mob.sizes', 'must be an array of body classes');
  const sizeIds = new Set<string>();
  sizes.forEach((size, i) => {
    const path = `mob.sizes[${i}]`;
    if (!isObject(size)) refuse(path, 'must be an object');
    if (typeof size.id !== 'string' || !size.id) refuse(`${path}.id`, 'must be a non-empty name');
    if (sizeIds.has(size.id)) refuse(`${path}.id`, `duplicates body id ${size.id}`);
    sizeIds.add(size.id);
    numberAt(size, 'ps', path);
  });

  return raw as unknown as EngineData;
}
