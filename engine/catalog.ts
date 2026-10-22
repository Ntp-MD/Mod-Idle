/**
 * Read-only indexes over the canonical JSON. The data files stay where they are; this module
 * builds the cross-pool maps once so a consumer asks for a row by its stable key instead of
 * scanning arrays or re-deriving the same lookup.
 */

import type {
  BaseRow,
  EngineData,
  ModsData,
  MobBoss,
  MobSpecies,
  MobUnique,
  MobVariant,
  MobZone,
  SkillRow,
  SkillsData,
  VariantDrop,
} from './types.ts';

export interface CatalogPool<T, K = string> {
  readonly rows: readonly T[];
  readonly byId: ReadonlyMap<K, T>;
}

export interface CatalogNamePool<T> {
  readonly rows: readonly T[];
  readonly byName: ReadonlyMap<string, T>;
}

export interface WeaponRow {
  name: string;
  [key: string]: unknown;
}

export interface WeaponFrameRow {
  name: string;
  frame_mod?: string[];
  legacy_frame_mod?: string[];
  drop_weight?: number;
  value_bias?: number;
  [key: string]: unknown;
}

export interface BaseCatalogSource {
  bases: BaseRow[];
  weapons?: WeaponRow[];
  slots?: string[];
  weapon_frames?: Record<string, WeaponFrameRow[]>;
  weapon_pools?: Record<string, Record<string, string[]>>;
}

export interface TownNpc {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface TownSettlement {
  id: string;
  name?: string;
  zone: number;
  npcs?: string[];
  stock?: string[];
  [key: string]: unknown;
}

export interface TownShopRow {
  id: string;
  item?: string;
  npc?: string;
  ladder?: string | null;
  [key: string]: unknown;
}

export interface TownCollectorSet {
  id: string;
  settlement: string;
  pieces: string[];
  school?: string;
  quality?: string;
  reward?: string;
  pays_gold?: boolean;
  [key: string]: unknown;
}

export interface TownCatalogSource {
  npcs: TownNpc[];
  settlements: TownSettlement[];
  one_time: TownShopRow[];
  repeatable: TownShopRow[];
  collector_sets: TownCollectorSet[];
  delivery?: { skill_weights?: Record<string, number> };
  black_market?: { skill_weights?: Record<string, number> };
}

export interface CatalogSource {
  engine: EngineData;
  mods: ModsData;
  skills: SkillsData;
  town: TownCatalogSource;
  bases: BaseCatalogSource;
}

export type TownStockEntry =
  | { readonly kind: 'shop'; readonly id: string; readonly row: TownShopRow }
  | { readonly kind: 'collector'; readonly id: string; readonly row: TownCollectorSet };

export type ModRow = ModsData['mods'][number];

export interface Catalog {
  readonly items: {
    readonly bases: CatalogNamePool<BaseRow>;
    readonly weapons: CatalogNamePool<WeaponRow>;
    readonly mods: CatalogPool<ModRow>;
    readonly slots: readonly string[];
    readonly weaponFrames: ReadonlyMap<string, readonly WeaponFrameRow[]>;
    readonly weaponPools: ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>;
  };
  readonly mobs: {
    readonly species: CatalogPool<MobSpecies>;
    readonly zones: CatalogPool<MobZone, number>;
    readonly variantsBySpecies: ReadonlyMap<string, readonly MobVariant[]>;
    readonly uniquesBySpecies: ReadonlyMap<string, readonly MobUnique[]>;
    readonly bossesByZone: ReadonlyMap<number, MobBoss>;
    readonly speciesByZone: ReadonlyMap<number, readonly MobSpecies[]>;
    readonly variantDrops: ReadonlyMap<string, VariantDrop>;
  };
  readonly skills: {
    readonly all: CatalogPool<SkillRow>;
    readonly byType: ReadonlyMap<string, readonly SkillRow[]>;
    readonly byGroup: ReadonlyMap<string, readonly SkillRow[]>;
  };
  readonly town: {
    readonly settlements: CatalogPool<TownSettlement>;
    readonly npcs: CatalogPool<TownNpc>;
    readonly shopRows: CatalogPool<TownShopRow>;
    readonly collectorSets: CatalogPool<TownCollectorSet>;
    readonly stockEntries: ReadonlyMap<string, TownStockEntry>;
  };
  readonly problems: readonly string[];
}

function indexPool<T, K>(
  rows: readonly T[],
  key: (row: T) => K,
  label: string,
  problems: string[],
): CatalogPool<T, K> {
  const byId = new Map<K, T>();
  for (const row of rows) {
    const id = key(row);
    if (byId.has(id)) problems.push(`${label}: duplicate id ${String(id)}`);
    else byId.set(id, row);
  }
  return { rows, byId };
}

function indexNames<T extends { name: string }>(rows: readonly T[], label: string, problems: string[]): CatalogNamePool<T> {
  const byName = new Map<string, T>();
  for (const row of rows) {
    if (byName.has(row.name)) problems.push(`${label}: duplicate name ${row.name}`);
    else byName.set(row.name, row);
  }
  return { rows, byName };
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string | undefined): ReadonlyMap<string, readonly T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = key(row);
    if (!group) continue;
    const list = groups.get(group);
    if (list) list.push(row);
    else groups.set(group, [row]);
  }
  return groups;
}

/** Build every pool index once and collect cross-pool references that do not resolve. */
export function createCatalog(source: CatalogSource): Catalog {
  const problems: string[] = [];
  const E = source.engine;
  const mob = E.mob;

  const bases = indexNames(source.bases.bases, 'bases', problems);
  const weapons = indexNames(source.bases.weapons || [], 'weapons', problems);
  const mods = indexPool(source.mods.mods, (row) => row.id, 'mods', problems);
  const skills = indexPool(source.skills.skills, (row) => row.id, 'skills', problems);
  const species = indexPool(mob.species, (row) => row.id, 'mob.species', problems);
  const zones = indexPool(mob.zones, (row) => row.id, 'mob.zones', problems);
  const npcs = indexPool(source.town.npcs, (row) => row.id, 'town.npcs', problems);
  const settlements = indexPool(source.town.settlements, (row) => row.id, 'town.settlements', problems);
  const shopRows = indexPool([...source.town.one_time, ...source.town.repeatable], (row) => row.id, 'town.shop', problems);
  const collectorSets = indexPool(source.town.collector_sets, (row) => row.id, 'town.collector_sets', problems);

  const weaponFrames = new Map<string, readonly WeaponFrameRow[]>();
  for (const [weapon, frames] of Object.entries(source.bases.weapon_frames || {})) {
    if (!weapons.byName.has(weapon)) problems.push(`weapon_frames: unknown weapon ${weapon}`);
    const seen = new Set<string>();
    for (const frame of frames) {
      if (seen.has(frame.name)) problems.push(`weapon_frames.${weapon}: duplicate frame ${frame.name}`);
      seen.add(frame.name);
      for (const id of frame.frame_mod || []) if (!mods.byId.has(id)) problems.push(`weapon_frames.${weapon}.${frame.name}: unknown mod ${id}`);
    }
    weaponFrames.set(weapon, frames);
  }
  for (const weapon of weapons.rows) {
    if (!weaponFrames.has(weapon.name)) problems.push(`weapons: no frames for ${weapon.name}`);
  }

  const weaponPools = new Map<string, ReadonlyMap<string, readonly string[]>>();
  for (const [slot, pools] of Object.entries(source.bases.weapon_pools || {})) {
    const indexed = new Map<string, readonly string[]>();
    for (const [pool, rows] of Object.entries(pools)) {
      for (const id of rows) if (!mods.byId.has(id)) problems.push(`weapon_pools.${slot}.${pool}: unknown mod ${id}`);
      indexed.set(pool, rows);
    }
    weaponPools.set(slot, indexed);
  }

  for (const base of bases.rows) {
    if (base.slot && source.bases.slots?.length && !source.bases.slots.includes(String(base.slot))) {
      problems.push(`bases.${base.name}: unknown slot ${String(base.slot)}`);
    }
    for (const field of ['primary', 'secondary', 'base_lines'] as const) {
      for (const id of (base as any)[field] || []) {
        if (!mods.byId.has(id)) problems.push(`bases.${base.name}.${field}: unknown mod ${id}`);
      }
    }
  }

  const variantsBySpecies = new Map<string, readonly MobVariant[]>();
  const variantNames = new Set<string>();
  for (const row of species.rows) {
    const variants = mob.variants?.[row.id] || [];
    variantsBySpecies.set(row.id, variants);
    for (const variant of variants) {
      if (variantNames.has(variant.name)) problems.push(`mob.variants: duplicate variant name ${variant.name}`);
      variantNames.add(variant.name);
    }
  }
  for (const speciesId of Object.keys(mob.variants || {})) {
    if (!species.byId.has(speciesId)) problems.push(`mob.variants: unknown species ${speciesId}`);
  }

  const variantDrops = new Map(Object.entries(mob.variant_drops || {}));
  for (const name of variantNames) {
    if (!variantDrops.has(name)) problems.push(`mob.variant_drops: no drop row for variant ${name}`);
  }

  const bossesByZone = new Map<number, MobBoss>();
  for (const boss of mob.bosses || []) {
    if (bossesByZone.has(boss.zone)) problems.push(`mob.bosses: duplicate zone ${boss.zone}`);
    bossesByZone.set(boss.zone, boss);
    if (!zones.byId.has(boss.zone)) problems.push(`mob.bosses.${boss.name}: unknown zone ${boss.zone}`);
    if (!species.byId.has(boss.species)) problems.push(`mob.bosses.${boss.name}: unknown species ${boss.species}`);
  }

  const uniquesBySpecies = new Map<string, MobUnique[]>();
  for (const unique of mob.uniques || []) {
    const list = uniquesBySpecies.get(unique.species);
    if (list) list.push(unique);
    else uniquesBySpecies.set(unique.species, [unique]);
    if (!species.byId.has(unique.species)) problems.push(`mob.uniques.${unique.name}: unknown species ${unique.species}`);
  }

  const speciesByZone = new Map<number, MobSpecies[]>();
  for (const row of species.rows) {
    for (const zoneId of row.zones || []) {
      if (!zones.byId.has(zoneId)) problems.push(`mob.species.${row.id}: unknown zone ${zoneId}`);
      const list = speciesByZone.get(zoneId);
      if (list) list.push(row);
      else speciesByZone.set(zoneId, [row]);
    }
    for (const zoneId of Object.keys(row.zone_levels || {})) {
      if (!zones.byId.has(Number(zoneId))) problems.push(`mob.species.${row.id}.zone_levels: unknown zone ${zoneId}`);
    }
  }
  for (const zone of zones.rows) {
    for (const subzone of zone.subzones || []) {
      for (const speciesId of subzone.species || []) {
        if (!species.byId.has(speciesId)) problems.push(`mob.zones.${zone.id}.${subzone.name}: unknown species ${speciesId}`);
      }
    }
  }

  const stockEntries = new Map<string, TownStockEntry>();
  for (const row of shopRows.rows) {
    if (stockEntries.has(row.id)) problems.push(`town.stock: duplicate id ${row.id}`);
    stockEntries.set(row.id, { kind: 'shop', id: row.id, row });
  }
  for (const row of collectorSets.rows) {
    if (stockEntries.has(row.id)) problems.push(`town.stock: duplicate id ${row.id}`);
    stockEntries.set(row.id, { kind: 'collector', id: row.id, row });
  }
  for (const row of shopRows.rows) {
    if (row.npc && !npcs.byId.has(row.npc)) problems.push(`town.shop.${row.id}: unknown npc ${row.npc}`);
  }
  for (const settlement of settlements.rows) {
    for (const npc of settlement.npcs || []) if (!npcs.byId.has(npc)) problems.push(`town.settlements.${settlement.id}: unknown npc ${npc}`);
    for (const id of settlement.stock || []) if (!stockEntries.has(id)) problems.push(`town.settlements.${settlement.id}.stock: unknown row ${id}`);
  }
  for (const set of collectorSets.rows) {
    if (!settlements.byId.has(set.settlement)) problems.push(`town.collector_sets.${set.id}: unknown settlement ${set.settlement}`);
    for (const piece of set.pieces || []) {
      const name = piece.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (!bases.byName.has(name)) problems.push(`town.collector_sets.${set.id}: unknown base ${name}`);
    }
  }

  for (const [scope, weights] of [
    ['town.black_market.skill_weights', source.town.black_market?.skill_weights],
    ['town.delivery.skill_weights', source.town.delivery?.skill_weights],
  ] as const) {
    for (const id of Object.keys(weights || {})) if (!skills.byId.has(id)) problems.push(`${scope}: unknown skill ${id}`);
  }

  return {
    items: { bases, weapons, mods, slots: source.bases.slots || [], weaponFrames, weaponPools },
    mobs: { species, zones, variantsBySpecies, uniquesBySpecies, bossesByZone, speciesByZone, variantDrops },
    skills: {
      all: skills,
      byType: groupBy(skills.rows, (row) => row.type),
      byGroup: groupBy(skills.rows, (row) => row.group),
    },
    town: { settlements, npcs, shopRows, collectorSets, stockEntries },
    problems,
  };
}
