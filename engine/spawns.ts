/**
 * Field spawn-point model.
 *
 * `spawns.json` owns where a field's population may stand, how large it is, how fast a slot
 * refills and how far a body may roam/assist. Species, levels, bodies and ranks stay in
 * `engine.json`; the arena owns meters and projection. This module only validates and resolves
 * those authored facts so the sim cannot invent a spawn point or a density at runtime.
 *
 * Pure: no file, no clock, no DOM. The same factory runs in the browser client and the cages.
 */
import { isClear, route } from './navigation.ts';
import type { NavLayout, NavPoint } from './navigation.ts';

export interface SpawnPoint {
  id: string;
  x: number;
  y: number;
  /** Idle wander radius around the home point, in meters. */
  roam_m: number;
}

/**
 * One static ground obstacle. Movement, sight and projectile flags are independent so a wall can
 * stop a body without hiding a target, and a canopy can hide without blocking a walk.
 */
export interface SpawnNavCircle {
  kind: 'circle';
  id: string;
  x: number;
  y: number;
  radius: number;
  blocksMovement: boolean;
  blocksSight: boolean;
  blocksProjectiles: boolean;
}

export interface SpawnNavBox {
  kind: 'box';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  blocksMovement: boolean;
  blocksSight: boolean;
  blocksProjectiles: boolean;
}

export type SpawnNavObstacle = SpawnNavCircle | SpawnNavBox;

/**
 * Optional vetted navigation geometry for one authored layout. Authored only after an overlay
 * calibration; absent means "no geometry proven yet", never "open ground".
 */
export interface SpawnNav {
  version: number;
  origin: { x: number; y: number };
  cellSizeM: number;
  obstacles: SpawnNavObstacle[];
}

export interface SpawnLayout {
  points: SpawnPoint[];
  nav?: SpawnNav;
}

export interface SpawnProfile {
  layout: string;
  cap: number;
  /** Seconds before an emptied slot refills. */
  respawn_sec: number;
  /** Deterministic window around `respawn_sec`; defaults to the scalar when unauthored. */
  respawn_min_sec: number;
  respawn_max_sec: number;
  aggro_m: number;
  assist_m: number;
  roam_m: number;
  /** An unengaged body settles inside this radius of home. */
  home_band_m: number;
  /** Return pace as a share of the body's ordinary walk speed; never above 1. */
  return_speed_mult: number;
  /** Idle decision beat in seconds: an unengaged body picks one spot or waits at this beat. */
  idle_decision_sec: number;
  /** Share of idle beats that wait instead of choosing a reachable spot, within [0, 1]. */
  idle_wait_pct: number;
  /** Share of wall seconds an offline field counts as engaged combat time. */
  offline_share: number;
}

export interface SpawnsData {
  meta?: { title?: string; note?: string; read_by?: string[] };
  defaults: SpawnProfile;
  layouts: Record<string, SpawnLayout>;
  zones: Record<string, Partial<SpawnProfile>>;
  subzones?: Record<string, Partial<SpawnProfile>>;
  /** Camp, dungeon and offline paths keep the pre-50 m baseline. */
  legacy?: { defaults?: Partial<SpawnProfile>; zones?: Record<string, Partial<SpawnProfile>> };
}

export type SpawnDomain = 'live' | 'legacy';

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

export interface SpawnNavigationIssue {
  pointId: string;
  reason: 'blocked' | 'unreachable';
}

export interface SpawnModel {
  readonly data: SpawnsData;
  readonly coverage: SpawnCoverage;
  layout(id: string): SpawnLayout;
  profileFor(zoneId: number, subIndex?: number | null, domain?: SpawnDomain): SpawnProfile;
  pointsFor(zoneId: number, subIndex?: number | null): readonly SpawnPoint[];
  /** The layout's authored geometry in the pure kernel's shape, or null when none is proven yet. */
  navigation(id: string): NavLayout | null;
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
  const respawnMin = raw.respawn_min_sec == null ? respawn : numberAt(raw, 'respawn_min_sec', path);
  const respawnMax = raw.respawn_max_sec == null ? respawn : numberAt(raw, 'respawn_max_sec', path);
  if (!(respawnMin > 0) || respawnMax < respawnMin) refuse(`${path}.respawn_min_sec`, 'must be positive and no greater than respawn_max_sec');
  const aggro = numberAt(raw, 'aggro_m', path);
  if (!(aggro > 0)) refuse(`${path}.aggro_m`, 'must be positive');
  const assist = numberAt(raw, 'assist_m', path);
  if (assist < 0) refuse(`${path}.assist_m`, 'must be nonnegative');
  const roam = numberAt(raw, 'roam_m', path);
  if (roam < 0) refuse(`${path}.roam_m`, 'must be nonnegative');
  const homeBand = numberAt(raw, 'home_band_m', path);
  if (!(homeBand > 0 && homeBand <= roam + 1)) refuse(`${path}.home_band_m`, 'must be positive and near the idle roam radius');
  const returnSpeed = numberAt(raw, 'return_speed_mult', path);
  if (!(returnSpeed > 0 && returnSpeed <= 1)) refuse(`${path}.return_speed_mult`, 'must be within (0, 1]');
  const idleDecisionSec = raw.idle_decision_sec == null ? 5 : numberAt(raw, 'idle_decision_sec', path);
  if (!(idleDecisionSec > 0)) refuse(`${path}.idle_decision_sec`, 'must be positive');
  const idleWaitPct = raw.idle_wait_pct == null ? 0 : numberAt(raw, 'idle_wait_pct', path);
  if (!(idleWaitPct >= 0 && idleWaitPct <= 1)) refuse(`${path}.idle_wait_pct`, 'must be within [0, 1]');
  const offlineShare = numberAt(raw, 'offline_share', path);
  if (!(offlineShare >= 0 && offlineShare <= 1)) refuse(`${path}.offline_share`, 'must be within [0, 1]');
  return {
    layout, cap, respawn_sec: respawn, respawn_min_sec: respawnMin, respawn_max_sec: respawnMax, aggro_m: aggro, assist_m: assist,
    roam_m: roam, home_band_m: homeBand, return_speed_mult: returnSpeed,
    idle_decision_sec: idleDecisionSec, idle_wait_pct: idleWaitPct,
    offline_share: offlineShare,
  };
}

function flagAt(raw: Record<string, unknown>, key: string, path: string): boolean {
  const value = raw[key];
  if (typeof value !== 'boolean') refuse(`${path}.${key}`, 'must be true or false');
  return value;
}

function navAt(raw: unknown, path: string): SpawnNav {
  if (!isObject(raw)) refuse(path, 'must be an object');
  const version = numberAt(raw, 'version', path);
  if (!Number.isInteger(version) || version <= 0) refuse(`${path}.version`, 'must be a positive whole number');
  if (!isObject(raw.origin)) refuse(`${path}.origin`, 'must be an object');
  const origin = {
    x: numberAt(raw.origin, 'x', `${path}.origin`),
    y: numberAt(raw.origin, 'y', `${path}.origin`),
  };
  const cellSize = numberAt(raw, 'cell_size_m', path);
  if (!(cellSize > 0)) refuse(`${path}.cell_size_m`, 'must be positive');
  if (!Array.isArray(raw.obstacles)) refuse(`${path}.obstacles`, 'must be an array');
  const ids = new Set<string>();
  const obstacles = raw.obstacles.map((entry, index): SpawnNavObstacle => {
    const at = `${path}.obstacles[${index}]`;
    if (!isObject(entry)) refuse(at, 'must be an object');
    const id = entry.id;
    if (typeof id !== 'string' || !id) refuse(`${at}.id`, 'must be a non-empty id');
    if (ids.has(id)) refuse(`${at}.id`, `duplicates obstacle ${id}`);
    ids.add(id);
    const kind = entry.kind;
    if (kind !== 'circle' && kind !== 'box') refuse(`${at}.kind`, 'must be circle or box');
    const flags = {
      blocksMovement: flagAt(entry, 'blocks_movement', at),
      blocksSight: flagAt(entry, 'blocks_sight', at),
      blocksProjectiles: flagAt(entry, 'blocks_projectiles', at),
    };
    const x = numberAt(entry, 'x', at);
    const y = numberAt(entry, 'y', at);
    if (kind === 'circle') {
      const radius = numberAt(entry, 'radius', at);
      if (!(radius > 0)) refuse(`${at}.radius`, 'must be positive');
      return { kind, id, x, y, radius, ...flags };
    }
    const width = numberAt(entry, 'width', at);
    const height = numberAt(entry, 'height', at);
    if (!(width > 0)) refuse(`${at}.width`, 'must be positive');
    if (!(height > 0)) refuse(`${at}.height`, 'must be positive');
    return { kind, id, x, y, width, height, ...flags };
  });
  return { version, origin, cellSizeM: cellSize, obstacles };
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
  return { points, ...(raw.nav != null ? { nav: navAt(raw.nav, `${path}.nav`) } : {}) };
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
  const legacyRaw = raw.legacy ?? {};
  if (!isObject(legacyRaw)) refuse('legacy', 'must be an object');
  const legacyDefaults = profileAt({ ...defaults, ...(isObject(legacyRaw.defaults) ? legacyRaw.defaults : {}) }, 'legacy.defaults');
  if (legacyRaw.zones != null && !isObject(legacyRaw.zones)) refuse('legacy.zones', 'must be an object');
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
  for (const id of Object.keys(isObject(legacyRaw.zones) ? legacyRaw.zones : {}))
    if (!zoneIds.has(id)) refuse(`legacy.zones.${id}`, 'names no authored zone');
  const profiles = new Map<number, SpawnProfile>();
  const legacyProfiles = new Map<number, SpawnProfile>();
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
    const legacyOverride = isObject(legacyRaw.zones)
      ? (legacyRaw.zones[String(zone.id)] as Partial<SpawnProfile> | undefined)
      : undefined;
    const legacyProfile = profileAt({ ...legacyDefaults, ...(legacyOverride ?? {}) }, `legacy.zones.${zone.id}`);
    if (!layouts[legacyProfile.layout]) refuse(`legacy.zones.${zone.id}.layout`, `names unknown layout ${legacyProfile.layout}`);
    if (legacyProfile.cap > layouts[legacyProfile.layout].points.length) {
      refuse(`legacy.zones.${zone.id}.cap`, `exceeds the ${layouts[legacyProfile.layout].points.length} authored points`);
    }
    legacyProfiles.set(zone.id, legacyProfile);
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
  const profileOf = (zoneId: number, subIndex: number | null = null, domain: SpawnDomain = 'live'): SpawnProfile => {
    if (domain === 'legacy') {
      const profile = legacyProfiles.get(zoneId);
      if (!profile) refuse(`legacy.zones.${zoneId}`, 'is not authored');
      return profile;
    }
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
    navigation(id) {
      const nav = layoutOf(id).nav;
      if (!nav) return null;
      return {
        version: nav.version,
        // The authored origin IS the world origin for this layout; the arena supplies the extent.
        bounds: { x: nav.origin.x, y: nav.origin.y, width: context.arena.width, height: context.arena.height },
        cellSize: nav.cellSizeM,
        obstacles: nav.obstacles.map((obstacle) => {
          const flags = {
            movement: obstacle.blocksMovement,
            sight: obstacle.blocksSight,
            projectiles: obstacle.blocksProjectiles,
          };
          return obstacle.kind === 'circle'
            ? { kind: 'circle' as const, id: obstacle.id, x: obstacle.x, y: obstacle.y, radius: obstacle.radius, flags }
            : { kind: 'box' as const, id: obstacle.id, x: obstacle.x, y: obstacle.y,
              width: obstacle.width, height: obstacle.height, flags };
        }),
      };
    },
  };
}

/**
 * Layout validator, for a cage or a dev overlay: every authored home must hold the body and be
 * reachable from the entry point. Returns null when the layout has no authored geometry yet —
 * that is "not proven", never "clear".
 */
export function checkSpawnNavigation(
  model: SpawnModel, layoutId: string, start: NavPoint, radius: number,
): SpawnNavigationIssue[] | null {
  const nav = model.navigation(layoutId);
  if (!nav) return null;
  if (!isClear(nav, start, radius)) return [{ pointId: 'start', reason: 'blocked' }];
  const issues: SpawnNavigationIssue[] = [];
  for (const point of model.layout(layoutId).points) {
    if (!isClear(nav, point, radius)) {
      issues.push({ pointId: point.id, reason: 'blocked' });
      continue;
    }
    const result = route(nav, start, [{ id: point.id, x: point.x, y: point.y }], radius);
    if (!result.ok) issues.push({ pointId: point.id, reason: 'unreachable' });
  }
  return issues;
}

export { SOURCE as SPAWNS_SOURCE };
