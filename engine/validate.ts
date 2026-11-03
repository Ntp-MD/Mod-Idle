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
  'aoe', 'max_hp_press', 'craft', 'forge', 'town_shared', 'elements', 'f_rows_carried', 'build', 'global',
  'save', 'opening', 'skill_drop',
] as const;

/** The `stat` block the level curve and the sheet read. */
const REQUIRED_STAT = [
  'base', 'level_cap', 'mob_level_cap', 'item_slots', 'core_flat_max', 'split_items',
    'points_per_level', 'point_value',
] as const;

/** The `caps` block: every Cap is a number or an explicit `null` (no Cap). */
const REQUIRED_CAPS = [
  'alignment', 'crit_chance', 'accuracy', 'attack_interval_sec', 'cdr', 'elem_res', 'elem_res_max',
  'evasion', 'perfect_dodge', 'weight_overload', 'block', 'block_divisor', 'stun', 'speed_mult',
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
  for (const [section, key] of [['inventory', 'offline_cap_hr'], ['farm', 'offline_cap_hours']] as const) {
    const row = data[section] as Record<string, unknown>;
    if (!isObject(row)) refuse(section, 'must be an object');
    const hours = row[key];
    if (hours !== null && (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0))
      refuse(`${section}.${key}`, 'must be null (unlimited) or finite nonnegative hours');
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

  const coreSpend = mob.core_spend as Record<string, unknown>;
  if (!isObject(coreSpend)) refuse('mob.core_spend', 'must be an object');
  if (typeof coreSpend.note !== 'string' || !coreSpend.note) refuse('mob.core_spend.note', 'must be a non-empty string');
  const dexCap = coreSpend.dex_cap as unknown;
  if (!Array.isArray(dexCap) || dexCap.length !== 5) refuse('mob.core_spend.dex_cap', 'must hold one ceiling per Variant band');
  dexCap.forEach((value, i) => {
    if (!Number.isInteger(value) || (value as number) <= 0) refuse(`mob.core_spend.dex_cap[${i}]`, 'must be a positive whole number');
  });

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
    const resistance = sp.resistance as Record<string, unknown>;
    if (!isObject(resistance)) refuse(`${path}.resistance`, 'must be an object');
    if (typeof resistance.element !== 'string' || !resistance.element) refuse(`${path}.resistance.element`, 'must be a non-empty Element name');
    numberAt(resistance, 'pct', `${path}.resistance`);
    const weakness = sp.weakness as Record<string, unknown>;
    if (!isObject(weakness)) refuse(`${path}.weakness`, 'must be an object');
    if (typeof weakness.element !== 'string' || !weakness.element) refuse(`${path}.weakness.element`, 'must be a non-empty Element name');
    numberAt(weakness, 'taken_pct', `${path}.weakness`);
    const bonus = sp.bonus_material as Record<string, unknown>;
    if (!isObject(bonus)) refuse(`${path}.bonus_material`, 'must be an object');
    if (typeof bonus.resource !== 'string' || !bonus.resource) refuse(`${path}.bonus_material.resource`, 'must be a non-empty material id');
    const chance = numberAt(bonus, 'chance', `${path}.bonus_material`);
    if (!(chance > 0 && chance <= 1)) refuse(`${path}.bonus_material.chance`, 'must be above 0 and at most 1');
    const min = numberAt(bonus, 'min', `${path}.bonus_material`);
    const max = numberAt(bonus, 'max', `${path}.bonus_material`);
    if (!Number.isInteger(min) || min <= 0) refuse(`${path}.bonus_material.min`, 'must be a positive whole number');
    if (!Number.isInteger(max) || max < min) refuse(`${path}.bonus_material.max`, 'must be a whole number at least min');
  });

  // Field-awareness eligibility is authored, not inferred: every id names a real Species and a
  // Species appears at most once in each list.
  const engagement = mob.engagement as unknown;
  if (engagement != null) {
    if (!isObject(engagement)) refuse('mob.engagement', 'must be an object');
    for (const key of ['proximity', 'assist'] as const) {
      const list = engagement[key];
      if (!Array.isArray(list)) refuse(`mob.engagement.${key}`, 'must be an array of Species ids');
      const seen = new Set<string>();
      list.forEach((id, i) => {
        if (typeof id !== 'string' || !speciesIds.has(id))
          refuse(`mob.engagement.${key}[${i}]`, `names unknown Species ${String(id)}`);
        if (seen.has(id)) refuse(`mob.engagement.${key}[${i}]`, `duplicates Species ${String(id)}`);
        seen.add(id as string);
      });
    }
  }

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
    const radius = numberAt(size, 'radius_m', path);
    if (!(radius > 0)) refuse(`${path}.radius_m`, 'must be a positive ground footprint in meters');
  });

  // The forge: material families/grades, pattern costs and the two grade-indexed ladders.
  const forge = data.forge as Record<string, unknown>;
  const forgeMaterials = forge.materials as Record<string, unknown>;
  if (!isObject(forgeMaterials) || !Object.keys(forgeMaterials).length) refuse('forge.materials', 'must be a non-empty object');
  for (const [id, row] of Object.entries(forgeMaterials)) {
    const path = `forge.materials.${id}`;
    if (!isObject(row)) refuse(path, 'must be an object');
    if (typeof row.family !== 'string' || !row.family) refuse(`${path}.family`, 'must be a non-empty family id');
    const grade = numberAt(row, 'grade', path);
    if (!Number.isInteger(grade) || grade < 1 || grade > 3) refuse(`${path}.grade`, 'must be a whole number from 1 to 3');
  }
  const forgeFamilies = forge.families as Record<string, unknown>;
  if (!isObject(forgeFamilies) || !Object.keys(forgeFamilies).length) refuse('forge.families', 'must be a non-empty object');
  for (const [id, row] of Object.entries(forgeFamilies)) {
    const path = `forge.families.${id}`;
    if (!isObject(row)) refuse(path, 'must be an object');
    if (typeof row.name !== 'string' || !row.name) refuse(`${path}.name`, 'must be a non-empty name');
    const bases = row.bases as Record<string, unknown>;
    if (!isObject(bases)) refuse(`${path}.bases`, 'must be an object');
    for (const [slot, base] of Object.entries(bases)) {
      if (typeof base !== 'string' || !base) refuse(`${path}.bases.${slot}`, 'must be a non-empty Base name');
    }
  }
  for (const key of ['armour', 'weapons'] as const) {
    const rows = forge[key] as Record<string, unknown>;
    if (!isObject(rows) || !Object.keys(rows).length) refuse(`forge.${key}`, 'must be a non-empty object');
    for (const [id, row] of Object.entries(rows)) {
      const path = `forge.${key}.${id}`;
      if (!isObject(row)) refuse(path, 'must be an object');
      if (typeof row.name !== 'string' || !row.name) refuse(`${path}.name`, 'must be a non-empty name');
      const count = numberAt(row, 'count', path);
      if (!Number.isInteger(count) || count <= 0) refuse(`${path}.count`, 'must be a positive whole number');
      if (key === 'weapons') {
        if (typeof row.family !== 'string' || !row.family) refuse(`${path}.family`, 'must be a non-empty family id');
        if (typeof row.frame !== 'string' || !row.frame) refuse(`${path}.frame`, 'must be a non-empty Frame name');
      }
    }
  }
  for (const key of ['smithing_level', 'xp_per_grade'] as const) {
    const row = forge[key];
    if (!Array.isArray(row) || row.length !== 3) refuse(`forge.${key}`, 'must be three numbers, one per grade');
    row.forEach((n, i) => {
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) refuse(`forge.${key}[${i}]`, 'must be a positive finite number');
      if (i > 0 && n < (row[i - 1] as number)) refuse(`forge.${key}[${i}]`, 'must not fall below the previous grade');
    });
  }

  // Ordinary attacks: both adapters and every profile they name must resolve, each profile must
  // state whether its metres are centre distance or body-edge reach, and its stop point must stay
  // inside that reach without forcing two authored bodies to occupy the same ground.
  const arena = data.combat_arena as Record<string, unknown>;
  const normal = arena?.normal_attack as Record<string, unknown>;
  if (!isObject(normal)) refuse('combat_arena.normal_attack', 'must be an object');
  const legacy = normal.legacy as Record<string, unknown>;
  const playerMap = normal.player as Record<string, unknown>;
  const profiles = normal.profiles as Record<string, unknown>;
  if (!isObject(legacy)) refuse('combat_arena.normal_attack.legacy', 'must be an object');
  if (!isObject(playerMap)) refuse('combat_arena.normal_attack.player', 'must be an object');
  if (!isObject(profiles)) refuse('combat_arena.normal_attack.profiles', 'must be an object');
  for (const line of ['front', 'stand-off']) {
    const id = legacy[line];
    if (typeof id !== 'string' || !isObject(profiles[id]))
      refuse(`combat_arena.normal_attack.legacy.${line}`, 'must name a profile');
  }
  for (const group of ['melee', 'ranged', 'magic']) {
    const id = playerMap[group];
    if (typeof id !== 'string' || !isObject(profiles[id]))
      refuse(`combat_arena.normal_attack.player.${group}`, 'must name a profile');
  }
  const clearance = numberAt(normal, 'contact_clearance_m', 'combat_arena.normal_attack');
  if (!(clearance >= 0)) refuse('combat_arena.normal_attack.contact_clearance_m', 'must be nonnegative');
  const band = numberAt(normal, 'contact_band_m', 'combat_arena.normal_attack');
  if (!(band >= 0)) refuse('combat_arena.normal_attack.contact_band_m', 'must be nonnegative');
  const playerRadius = numberAt(arena, 'player_radius_m', 'combat_arena');
  if (!(playerRadius > 0)) refuse('combat_arena.player_radius_m', 'must be a positive radius');
  const sizeRows = (data.mob as Record<string, unknown> | undefined)?.sizes;
  let bodyRadius = playerRadius;
  if (Array.isArray(sizeRows)) for (const row of sizeRows) {
    if (isObject(row) && typeof row.radius_m === 'number' && Number.isFinite(row.radius_m))
      bodyRadius = Math.max(bodyRadius, row.radius_m);
  }
  const minContact = playerRadius + bodyRadius + clearance;
  for (const [id, rawProfile] of Object.entries(profiles)) {
    const path = `combat_arena.normal_attack.profiles.${id}`;
    if (!isObject(rawProfile)) refuse(path, 'must be an object');
    if (rawProfile.delivery !== 'melee' && rawProfile.delivery !== 'projectile')
      refuse(`${path}.delivery`, 'must be melee or projectile');
    if (rawProfile.hit_class !== 'attack')
      refuse(`${path}.hit_class`, 'must be attack for an ordinary basic');
    const range = rawProfile.range as Record<string, unknown>;
    if (!isObject(range)) refuse(`${path}.range`, 'must be an object');
    if (range.basis !== 'center' && range.basis !== 'body-edge')
      refuse(`${path}.range.basis`, 'must be center or body-edge');
    const meters = numberAt(range, 'meters', `${path}.range`);
    if (!(meters > 0)) refuse(`${path}.range.meters`, 'must be a positive distance');
    const stop = numberAt(rawProfile, 'stop_at_range_pct', path);
    if (!(stop > 0 && stop <= 100)) refuse(`${path}.stop_at_range_pct`, 'must be within (0, 100]');
    const windup = numberAt(rawProfile, 'windup_interval_pct', path);
    if (!(windup > 0 && windup < 100)) refuse(`${path}.windup_interval_pct`, 'must be within (0, 100)');
    const recovery = numberAt(rawProfile, 'recovery_interval_pct', path);
    if (!(recovery >= 0 && recovery < 100)) refuse(`${path}.recovery_interval_pct`, 'must be within [0, 100)');
    if (windup + recovery > 100) refuse(`${path}`, 'windup and recovery must leave part of the interval free');
    if (range.basis === 'body-edge') {
      if (!(meters > clearance))
        refuse(`${path}.range.meters`, 'must exceed contact_clearance_m so the stop band stays inside reach');
    } else {
      if (!(meters * stop / 100 >= minContact))
        refuse(`${path}.stop_at_range_pct`, 'places the stop closer than two body footprints allow');
      if (!(minContact <= meters))
        refuse(`${path}.range.meters`, 'cannot reach even touching bodies');
    }
    if (rawProfile.delivery === 'projectile') {
      if (!(numberAt(rawProfile, 'projectile_speed_mps', path) > 0))
        refuse(`${path}.projectile_speed_mps`, 'must be a positive speed');
      if (numberAt(rawProfile, 'hit_radius_m', path) < 0)
        refuse(`${path}.hit_radius_m`, 'must be nonnegative');
    }
  }

  return raw as unknown as EngineData;
}
