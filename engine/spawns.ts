/**
 * Field spawn-point model.
 *
 * `spawns.json` owns where a field's population may stand, how large it is, how fast a slot
 * refills and how far a body may roam/assist/leash. Species, levels, bodies and ranks stay in
 * `engine.json`; the arena owns meters and projection. This module only validates and resolves
 * those authored facts so the sim cannot invent a spawn point or a density at runtime.
 *
 * Pure: no file, no clock, no DOM. The same factory runs in the browser client and the cages.
 */

export interface SpawnPoint {
  id: string;
  x: number;
  y: number;
  /** Idle wander radius around the home point, in meters. */
  roam_m: number;
}

export interface SpawnLayout {
  points: SpawnPoint[];
}

export interface SpawnProfile {
  layout: string;
  cap: number;
  /** Seconds before an emptied slot refills. */
  respawn_sec: number;
  aggro_m: number;
  assist_m: number;
  leash_m: number;
  roam_m: number;
  /** A returning body re-enters the idle/aggro state only inside this radius of home. */
  home_band_m: number;
  /** Return pace as a share of the body's ordinary walk speed; never above 1. */
  return_speed_mult: number;
  /** Hostile spawns and aggro are suppressed within this distance of a field Camp. */
  camp_safe_m: number;
  /** Share of wall seconds an offline field counts as engaged combat time. */
  offline_share: number;
}

export interface SpawnsData {
  meta?: { title?: string; note?: string; read_by?: string[] };
  defaults: SpawnProfile;
  layouts: Record<string, SpawnLayout>;
  zones: Record<string, Partial<SpawnProfile>>;
  subzones?: Record<string, Partial<SpawnProfile>>;
}

export interface SpawnContext {
  arena: { width: number; height: number };
  playerStart?: { x: number; y: number };
  zones: readonly { id: number; subzones?: readonly unknown[] }[];
}

export interface SpawnCoverage {
  zones: number;
  subzones: number;
  layouts: number;
  points: number;
}

export interface SpawnModel {
  readonly data: SpawnsData;
  readonly coverage: SpawnCoverage;
  layout(id: string): SpawnLayout;
  profileFor(zoneId: number, subIndex?: number | null): SpawnProfile;
  pointsFor(zoneId: number, subIndex?: number | null): readonly SpawnPoint[];
}

const SOURCE = 'spawns.json';
const ARENA_MARGIN_M = 0.5;
const MIN_POINT_GAP_M = 1;
const MIN_PLAYER_GAP_M = 2;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A deterministic per-slot seed: the same save and respawn count always roll the same body. */
export function spawnSlotSeed(seed: number, fieldKey: string, slotId: string, respawnCount: number): number {
  let hash = (seed >>> 0) ^ 0x9e3779b9;
  const text = `${fieldKey}|${slotId}|${respawnCount}`;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function refuse(path: string, why: string): never {
  throw new Error(`${SOURCE}: ${path} ${why}`);
}

function numberAt(raw: Record<string, unknown>, key: string, path: string): number {
  const value = raw[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) refuse(`${path}.${key}`, 'must be a finite number');
  return value;
}

function profileAt(raw: unknown, path: string): SpawnProfile {
  if (!isObject(raw)) refuse(path, 'must be an object');
  const layout = raw.layout;
  if (typeof layout !== 'string' || !layout) refuse(`${path}.layout`, 'must be a non-empty layout id');
  const cap = numberAt(raw, 'cap', path);
  if (!Number.isInteger(cap) || cap <= 0) refuse(`${path}.cap`, 'must be a positive whole number');
  const respawn = numberAt(raw, 'respawn_sec', path);
  if (!(respawn > 0)) refuse(`${path}.respawn_sec`, 'must be positive');
  const aggro = numberAt(raw, 'aggro_m', path);
  if (!(aggro > 0)) refuse(`${path}.aggro_m`, 'must be positive');
  const assist = numberAt(raw, 'assist_m', path);
  if (assist < 0) refuse(`${path}.assist_m`, 'must be nonnegative');
  const leash = numberAt(raw, 'leash_m', path);
  if (leash < aggro) refuse(`${path}.leash_m`, 'must be at least aggro_m');
  const roam = numberAt(raw, 'roam_m', path);
  if (roam < 0) refuse(`${path}.roam_m`, 'must be nonnegative');
  const homeBand = numberAt(raw, 'home_band_m', path);
  if (!(homeBand > 0 && homeBand <= roam + 1)) refuse(`${path}.home_band_m`, 'must be positive and near the idle roam radius');
  const returnSpeed = numberAt(raw, 'return_speed_mult', path);
  if (!(returnSpeed > 0 && returnSpeed <= 1)) refuse(`${path}.return_speed_mult`, 'must be within (0, 1]');
  const campSafe = numberAt(raw, 'camp_safe_m', path);
  if (campSafe < 0) refuse(`${path}.camp_safe_m`, 'must be nonnegative');
  const offlineShare = numberAt(raw, 'offline_share', path);
  if (!(offlineShare >= 0 && offlineShare <= 1)) refuse(`${path}.offline_share`, 'must be within [0, 1]');
  return {
    layout, cap, respawn_sec: respawn, aggro_m: aggro, assist_m: assist, leash_m: leash,
    roam_m: roam, home_band_m: homeBand, return_speed_mult: returnSpeed,
    camp_safe_m: campSafe, offline_share: offlineShare,
  };
}

function layoutAt(raw: unknown, path: string): SpawnLayout {
  if (!isObject(raw)) refuse(path, 'must be an object');
  if (!Array.isArray(raw.points) || !raw.points.length) refuse(`${path}.points`, 'must be a non-empty array');
  const ids = new Set<string>();
  const points = raw.points.map((entry, index) => {
    const at = `${path}.points[${index}]`;
    if (!isObject(entry)) refuse(at, 'must be an object');
    if (typeof entry.id !== 'string' || !entry.id) refuse(`${at}.id`, 'must be a non-empty id');
    if (ids.has(entry.id)) refuse(`${at}.id`, `duplicates point ${entry.id}`);
    ids.add(entry.id);
    const x = numberAt(entry, 'x', at);
    const y = numberAt(entry, 'y', at);
    const roam = numberAt(entry, 'roam_m', at);
    if (roam < 0) refuse(`${at}.roam_m`, 'must be nonnegative');
    return { id: entry.id, x, y, roam_m: roam };
  });
  return { points };
}

/** Resolve and validate the authored spawn file against the arena and the zone roster. */
export function createSpawns(raw: unknown, context: SpawnContext): SpawnModel {
  if (!isObject(raw)) refuse('root', 'must be an object');
  if (!isObject(raw.layouts)) refuse('layouts', 'must be an object');
  if (!isObject(raw.zones)) refuse('zones', 'must be an object');
  if (!isObject(raw.defaults)) refuse('defaults', 'must be an object');
  if (raw.subzones != null && !isObject(raw.subzones)) refuse('subzones', 'must be an object');
  if (!context || !isObject(context.arena)
    || !(Number.isFinite(context.arena.width) && Number.isFinite(context.arena.height))
    || context.arena.width <= 0 || context.arena.height <= 0) {
    refuse('context.arena', 'must provide positive width and height');
  }
  if (!Array.isArray(context.zones) || !context.zones.length) refuse('context.zones', 'must be a non-empty roster');

  const defaults = profileAt(raw.defaults, 'defaults');
  const layouts: Record<string, SpawnLayout> = {};
  for (const [id, value] of Object.entries(raw.layouts)) {
    layouts[id] = layoutAt(value, `layouts.${id}`);
  }
  // A layout point must hold its whole wander disc inside the field with the standard body margin.
  for (const [id, layout] of Object.entries(layouts)) {
    for (const point of layout.points) {
      if (point.x - point.roam_m < ARENA_MARGIN_M || point.x + point.roam_m > context.arena.width - ARENA_MARGIN_M
        || point.y - point.roam_m < ARENA_MARGIN_M || point.y + point.roam_m > context.arena.height - ARENA_MARGIN_M) {
        refuse(`layouts.${id}.${point.id}`, 'wander radius leaves the arena bounds');
      }
      if (context.playerStart) {
        const gap = Math.hypot(point.x - context.playerStart.x, point.y - context.playerStart.y);
        if (gap < MIN_PLAYER_GAP_M) refuse(`layouts.${id}.${point.id}`, 'is too close to the player start');
      }
    }
    for (let first = 0; first < layout.points.length; first++) {
      for (let second = first + 1; second < layout.points.length; second++) {
        const a = layout.points[first], b = layout.points[second];
        if (Math.hypot(a.x - b.x, a.y - b.y) < MIN_POINT_GAP_M) {
          refuse(`layouts.${id}`, `points ${a.id} and ${b.id} are closer than ${MIN_POINT_GAP_M}m`);
        }
      }
    }
  }
  if (!layouts[defaults.layout]) refuse('defaults.layout', 'must name an authored layout');

  const zoneIds = new Set(context.zones.map((zone) => String(zone.id)));
  for (const id of Object.keys(raw.zones)) if (!zoneIds.has(id)) refuse(`zones.${id}`, 'names no authored zone');
  const profiles = new Map<number, SpawnProfile>();
  const zoneSubProfiles = new Map<string, SpawnProfile>();
  let subzoneCount = 0;
  for (const zone of context.zones) {
    const path = `zones.${zone.id}`;
    if (!(String(zone.id) in raw.zones)) refuse(path, 'is missing from the spawn roster');
    const merged = { ...defaults, ...(raw.zones[String(zone.id)] as Partial<SpawnProfile>) };
    const profile = profileAt(merged, path);
    if (!layouts[profile.layout]) refuse(`${path}.layout`, `names unknown layout ${profile.layout}`);
    if (profile.cap > layouts[profile.layout].points.length) {
      refuse(`${path}.cap`, `exceeds the ${layouts[profile.layout].points.length} authored points`);
    }
    profiles.set(zone.id, profile);
    const subCount = zone.subzones?.length ?? 0;
    for (let index = 0; index < subCount; index++) {
      subzoneCount++;
      const key = `${zone.id}:${index}`;
      const override = (raw.subzones as Record<string, Partial<SpawnProfile>> | undefined)?.[key];
      const subProfile = override ? profileAt({ ...profile, ...override }, `subzones.${key}`) : profile;
      if (!layouts[subProfile.layout]) refuse(`subzones.${key}.layout`, `names unknown layout ${subProfile.layout}`);
      if (subProfile.cap > layouts[subProfile.layout].points.length) {
        refuse(`subzones.${key}.cap`, `exceeds the ${layouts[subProfile.layout].points.length} authored points`);
      }
      zoneSubProfiles.set(key, subProfile);
    }
  }
  const knownSubzoneKeys = new Set([...zoneSubProfiles.keys()]);
  for (const key of Object.keys(raw.subzones ?? {}))
    if (!knownSubzoneKeys.has(key)) refuse(`subzones.${key}`, 'names no authored zone:subzone');

  const layoutOf = (id: string): SpawnLayout => {
    const layout = layouts[id];
    if (!layout) refuse(`layouts.${id}`, 'is not authored');
    return layout;
  };
  const profileOf = (zoneId: number, subIndex: number | null = null): SpawnProfile => {
    if (subIndex != null) {
      const profile = zoneSubProfiles.get(`${zoneId}:${subIndex}`);
      if (profile) return profile;
    }
    const profile = profiles.get(zoneId);
    if (!profile) refuse(`zones.${zoneId}`, 'is not authored');
    return profile;
  };

  return {
    data: raw as unknown as SpawnsData,
    coverage: { zones: profiles.size, subzones: subzoneCount, layouts: Object.keys(layouts).length,
      points: Object.values(layouts).reduce((sum, layout) => sum + layout.points.length, 0) },
    layout: layoutOf,
    profileFor: profileOf,
    pointsFor(zoneId, subIndex = null) {
      return layoutOf(profileOf(zoneId, subIndex).layout).points;
    },
  };
}

export { SOURCE as SPAWNS_SOURCE };
