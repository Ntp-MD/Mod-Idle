import { eng, E, ED, TOWN } from '../../engine/client';
import type { EngineData } from '../../../../engine/types.ts';
import { createWorld } from '../../../../engine/world.ts';
import { pick, weightedPick } from '../../engine/client-helpers';
import { resolveMobKit } from '../combat/mobSkills';
import type { Mob } from '../core/types';

/**
 * Spawn and variant construction (Phase 6 combat-game split).
 * Owns the HX1 world query, boss index, body selection and spawnMob.
 * game.ts re-exports spawnMob so active callers keep their paths.
 * RNG draw order is unchanged: the function body moved verbatim.
 */

/** HX1 world queries (HX5 habitat consumer): bare ground draws its species pool from the hex's
 *  resolved winning habitat, never from a zone-wide sub-zone roll. `Cell.sub` is never written
 *  from the habitat — the hex stays bare; only the spawn pool narrows. */
export const world = createWorld(ED as unknown as EngineData, TOWN.settlements as Array<{ id: string; zone: number }>);

/** combat.md §1 · engine.json mob.attack_clock_per_sec, capped by the one clock rule (caps.attack_interval_sec).
 *  A fast-clock lineage (`mob.trait_mechanics.fast_clock`) multiplies its own clock; the swing divides
 *  by the same number in `mobSwing`, so the faster body deals exactly its published damage per second. */
const MOB_CLOCK_FLOOR = E.mob.attack_clock_per_sec;
const MOB_CLOCK_CAP = 1 / E.caps.attack_interval_sec;
const mobClock = (kind: string, mult = 1) => {
  const rank = kind.toLowerCase();
  return Math.min(((rank.startsWith('boss') || rank.startsWith('unique')) ? MOB_CLOCK_FLOOR.boss : MOB_CLOCK_FLOOR.normal) * mult, MOB_CLOCK_CAP);
};

// The boss row per zone is fixed data, so index it once instead of filtering on every spawn
// (a spawn happens many times per tick through the offline catch-up).
const _bossByZone = new Map<number, any>();
const bossInZone = (zoneId: number): any => {
  if (!_bossByZone.has(zoneId)) _bossByZone.set(zoneId, E.mob.bosses.find((b: any) => b.zone === zoneId) || null);
  return _bossByZone.get(zoneId);
};

/**
 * The body a normal spawn takes: the side's pack odds (`mob.spawn_packs`) run over the bodies this
 * species can field. A species with one body takes it whatever the pack says, and a side with no pack
 * rolls the plain even mix — which is every body at equal odds, exactly what bare ground rolls.
 */
function pickBody(rng: () => number, bodies: string[], pack: Record<string, number> | null): string {
  const total = bodies.reduce((t, b) => t + ((pack || {})[b] || 0), 0);
  if (!pack || !(total > 0)) return pick(rng, bodies);
  let roll = rng() * total;
  for (const b of bodies) {
    roll -= (pack[b] || 0);
    if (roll < 0) return b;
  }
  return bodies[bodies.length - 1];
}

export function spawnMob(rng: () => number, zoneId: number, kind: 'normal' | 'elite' | 'boss', bodyHint?: string, standSub?: number | null, options: { allowWildUnique?: boolean; uniqueChance?: number; id?: string; standTerrain?: string | null; hex?: { q: number; r: number } | null; forceSpecial?: { rank: 'boss' | 'unique'; name: string } | null } = {}): Mob {
  const z = eng.zoneById(zoneId);
  // A standing named side hunts its authored pool; bare ground hunts its resolved local habitat
  // (HX5): the winning named side of the hex (`habitatOf`), not a zone-wide sub-zone roll. The
  // cell stays bare — `Cell.sub` is never written here; only the species pool narrows. Spawn
  // callers without a hex keep the legacy zone draw.
  const subs = z.subzones || [];
  const stood = standSub != null && subs[standSub] ? subs[standSub] : null;
  const terrain = options.standTerrain ?? null;
  const habitat = !stood && options.hex ? world.habitatOf(options.hex) : null;
  const habitatSub = habitat && habitat.zoneId === zoneId ? subs[habitat.subzoneIndex] ?? null : null;
  const chosenSub = kind !== 'boss' && !options.forceSpecial && subs.length
    ? stood ?? habitatSub ?? (terrain == null
      ? subs[Math.floor(rng() * subs.length)]
      : subs[Number(weightedPick(rng, subs.map((s, i) => ({ id: String(i), w: eng.spawnSubzoneWeight(s, terrain) }))))] ?? null)
    : null;
  let rank: string = options.forceSpecial ? options.forceSpecial.rank : kind;
  let placementId: string;
  let species: any;
  let body = 'medium';
  let fixedName: string | null = null;
  const pack = chosenSub ? ((E.mob as any).spawn_packs?.[(chosenSub.spawn || {}).pack || ''] || null) : null;

  if (options.forceSpecial) {
    // A named special is invoked by its own owner (Boss request or an exact Unique probe), never
    // rolled out of the normal field pool.
    const row = options.forceSpecial.rank === 'boss'
      ? (bossInZone(zoneId)?.name === options.forceSpecial.name ? bossInZone(zoneId) : null)
      : E.mob.uniques.find((u: any) => u.name === options.forceSpecial!.name && u.zone === zoneId) ?? null;
    if (!row) throw new Error(`spawnMob: unknown ${options.forceSpecial.rank} ${options.forceSpecial.name} in zone ${zoneId}`);
    placementId = row.id;
    species = E.mob.species.find((sp: any) => sp.id === row.species)!;
    body = 'boss';
    fixedName = row.name;
  } else if (kind === 'boss') {
    const boss = bossInZone(zoneId)!;
    placementId = boss.id;
    species = E.mob.species.find((sp: any) => sp.id === boss.species)!;
    body = 'boss';
    fixedName = boss.name;
  } else {
    const runtimeSub = chosenSub ? subs.indexOf(chosenSub) : -1;
    const subzone = runtimeSub >= 0 ? runtimeSub + 1 : null;
    const contextRank = kind === 'elite' ? 'elite' : 'normal';
    const pool = subzone != null
      ? eng.placementPool(zoneId, { subzone, rank: contextRank, bodyHint: bodyHint ?? null, terrain, standing: !!stood })
      : eng.placementsIn(zoneId).map((row: any) => ({ id: row.id, w: row.weight }));
    // one weighted draw over the eligible placement IDs; the species follows the row
    placementId = weightedPick(rng, pool) as string;
    const row = eng.placementById(placementId);
    species = E.mob.species.find((sp: any) => sp.id === row.species)!;
    if (kind === 'elite') body = 'large';
    else if (bodyHint) body = bodyHint;
    else body = pickBody(rng, species.sizes.filter((s: string) => s !== 'boss' && s !== 'large'), pack);
    // One Unique proc on the already selected Species, using only this Zone's authored Uniques.
    if (kind === 'normal' && !bodyHint) {
      const uniques = eng.uniquesOf(species.id, zoneId) as any[];
      if (options.allowWildUnique !== false && uniques.length && rng() < (options.uniqueChance ?? E.loot.unique_chance ?? 0)) {
        rank = 'unique';
        const chosen = uniques.length === 1 ? uniques[0] : pick(rng, uniques);
        placementId = chosen.id;
        body = 'boss';
        fixedName = chosen.name;
      }
    }
  }
  const base = eng.spawnAt(zoneId, body, placementId);
  // The placement owns the fixed level, name, Core and damage override.
  const lv = base.level;
  const size = eng.sizeById(body)!;
  // body classes no longer scale HP: every mob of a species reads the same curve at its own level,
  // so the boss takes the same spawn shape any mob of its species takes
  const hp = rank === 'elite'
    ? eng.mobHpOf(lv, base.vit) * E.mob.elite.hp // the Elite multiplier rides the same curve the engine adds its flat terms to
    : base.hp;
  // the Elite swaps the Large body's own ps factor for its multiplier; the boss keeps the spawn
  // shape whole (the zone-mean divide included), exactly like any other body of its species
  const ps = rank === 'elite' ? base.ps / size.ps * E.mob.elite.ps : base.ps;
  // Normal and Elite spawns inherit the species Element; a Boss reads its own declared profile.
  const innate = base.innate;
  // The placement id is the drop table's key (`mob.variant_drops`), while the display name stays
  // what the field shows. Drawn last on purpose, so every field above keeps its random stream.
  const variantName: string = fixedName || (eng.placementById(placementId) as any).name || species.name;
  const skillIds = resolveMobKit(rank, species.id, placementId);
  return {
    // A slot or phase owner supplies a deterministic id, so a spawn never consumes the shared
    // world stream just to name itself. Random callers keep the historical id draw.
    id: options.id ?? `${zoneId}_${species.id}_${body}_${Math.floor(rng() * 1e9)}`,
    species: species.name,
    speciesId: species.id,
    formName: base.formName,
    placementId,
    variant: variantName,
    trait: base.trait,
    environment: chosenSub?.environment,
    kind: rank === 'boss' ? `Boss · ${(bossInZone(zoneId) || { name: 'Boss' }).name}` : rank === 'unique' ? `Unique · ${fixedName}` : rank === 'elite' ? 'Elite' : size.name,
    zone: zoneId,
    level: lv,
    hp,
    hpMax: hp,
    ps,
    core: base.core,
    subzone: chosenSub ? chosenSub.name : undefined,
    readsAs: base.readsAs,
    acc: base.acc,
    evasion: kind === 'elite' ? eng.mobEvasion(base.core.dex, 'elite') : base.evasion,
    dodgeRate: base.dodgeRate,
    armour: base.armour,
    res: base.res,
    resByElement: base.resByElement,
    damage: base.damage,
    innate,
    xp: rank === 'elite' ? base.xp * E.xp.elite_mult : rank === 'boss' ? base.xp * E.xp.boss_mult : rank === 'unique' ? base.xp * E.xp.unique_mult : base.xp,
    line: species.line,
    immune: base.immune, weak: base.weak, burst: base.burst, mechanics: base.mechanics,
    hitsPerSec: mobClock(rank, base.clock_mult),
    atkTimer: 0,
    engageSec: 0,
    skillIds,
    skillReadyAtUs: {},
  };
}
