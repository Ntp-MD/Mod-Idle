/**
 * Shared engine math — the single source for stat ceilings, derived caps,
 * the loot model and craft throughput. Read by tools/check.ts (groups A · B · C · F)
 * and tools/town.ts (gold per minute · kill thresholds · supply).
 *
 * Nothing here is a number copied by hand: every value is computed from
 * tools/data/engine.json, and every cage asserts the result against engine/ and the client.
 */

import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './json.ts';
import * as shared from '../../engine/index.ts';
import { createRoad } from '../../engine/road.ts';
import type { EngineData } from '../../engine/types.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ENGINE_JSON = path.join(import.meta.dirname, '..', 'data', 'engine.json');
const E = readJson<EngineData>(ENGINE_JSON);

// ---- the shared math now lives in engine/index.ts ------------------------------------
// This file loads the data and re-exports the shared engine so every existing
// `import ... from './lib/engine.ts'` keeps working. The formulas are NOT here any more: the cages and
// the game both call engine/index.ts, so a cage and the game cannot disagree (Techstack.md
// "The one rule").
const { createEngine } = shared;
const eng = createEngine(E);
/** The walk model the cages read: the hex graph, the block time and the encounter chance. */
const ROAD = createRoad(E);

const {
  S, K, M, LG, L, C, TS, ES, CAP, BANDS, BAND_KEYS, BAND, CEIL, SPLIT, FORCED_SPLIT, FOCUSED_CEIL,
  DERIVED, REF, REFERENCE, WEAPONS, STONE, LCK_BOUND, statAt, pointsAt, goldPerMinute, agiForCap, statWithItems,
  mobEvasion, sizeMult, playerAccuracy, hitVs, hitChance, MEAN_SPECIES_DEX, MOB_EVASION_REF, SPECIES_EVASION,
  armourOf, armourReduce, damageSplit, zoneBodyFactor, skillF, typicalDps, mobPs, mobHpAt,
  typicalDpsAt, mobPsAt, MOB_HP_ANCHORS, ZONES, zoneById, finalZoneId, winTarget, sizeById, speciesById, racesInZone, mobAcc, mobDodge,
  refAttackerAcc, mobRoster, mobResOf, speciesResMult, mobResByElementOf, lckOf, dropChance, killsDerived, r1, r2, fmt,
  aspdOf, capAspd, hitsPerSec, weaponMult, physOf, magicOf, dodgeRate, dodgeChance, perfectDodgeChance,
  evasionChance, evasionRating, agilityEvasion,
  critPool, critChanceOf, critDmgOf, maxHpOf, hpRegenOf, maxManaOf, manaRegenOf, maxEsOf,
  esRegenOf, cdrOf, alignmentOf, resistanceOf, weightCapacityOf, killsToLevel, xpToNext, CHECKPOINTS_KILLS, PUSH_KILLS_91_100, SETTLEMENT_BUDGET_KILLS, treePointsAt,
  encumbranceOf, aspdEncumbered, weightAtQuality, weaponWeightOf, sizeMultOf, applySizeMult,
  stunRecoveryOf, stunStopSec, basicAttackOf,
  xpPerKill, spawnAt, rerollValueStonesPerHr, tierStonesPerHr, addStonesPerHr, qualityStonesPerHr, repairStonesPerHr, corruptStonesPerHr, stonesForMinutes, taskPayout,
} = eng;

/**
 * Re-read `engine.json` and rebuild the engine. The wiki calls this on every fingerprint change, so a
 * data edit shows up on the next render without a rebuild — the ESM replacement for busting
 * `require.cache`. Returns the fresh engine plus the payload it was built from.
 */
function build(): any {
  const data = readJson<EngineData>(ENGINE_JSON);
  return Object.assign({}, createEngine(data), { E: data });
}

// ---- what tools/town.ts needs, so no town number is a copy of a loot number

function engineForTown(townEngine: any): any {
  const bands: Record<string, any> = {};
  for (const b of BAND_KEYS) {
    bands[b] = {
      kills_per_hr: BAND[b].kills_derived,
      drops_per_hr: BAND[b].drops_per_hr,
      upgrades_per_hr: BAND[b].upgrades_per_hr,
      band_kills: b === 'high_full_lck' ? 0 : BAND[b].band_kills,
    };
  }
  return Object.assign({}, townEngine, {
    bands,
    gold_per_junk_piece: TS.gold_per_junk_piece,
    round_rate_to_decimals: TS.round_rate_to_decimals,
    checkpoints_kills: eng.CHECKPOINTS_KILLS,
    budget_kills: (zone: number) => SETTLEMENT_BUDGET_KILLS[zone],
    push_kills_91_100: eng.PUSH_KILLS_91_100,
    reroll_value_stones_per_hour: STONE.reroll_uses_per_hr,
    reroll_stones_per_cast: C.reroll_value_stones_per_use,
    reroll_casts_per_full_set_polish: C.polish_casts_per_full_set,
    elite_reroll_tier_stones_per_hr: Math.round(BAND.high.kills_derived * L.elite_spawn_chance * L.elite_tier_stones),
    add_mod_stones_per_hr: STONE.add_stones_per_hr,
    ascend_stones_per_piece: C.ascend_add_stones + C.ascend_tier_stones,
    towns_gold_rate_multiplier_bound: LCK_BOUND,
    gold_per_minute: { low: goldPerMinute('low'), mid: goldPerMinute('mid'), high: goldPerMinute('high'), high_full_lck: goldPerMinute('high_full_lck') },
    // the walk's own shape, so T9 prints the block time and the encounter chance rather than a copy
    road: { block_sec: E.road.block_sec, encounter_chance_pct: E.road.encounter_chance_pct },
  });
}


export {
  ROOT, E, S, K, M, LG, L, C, TS, BANDS, BAND_KEYS, BAND, CEIL, SPLIT, FORCED_SPLIT, FOCUSED_CEIL,
  DERIVED, REF, REFERENCE, ES, WEAPONS, STONE, LCK_BOUND, statAt, pointsAt, goldPerMinute, agiForCap,
  statWithItems, mobEvasion, sizeMult, playerAccuracy, hitVs, MEAN_SPECIES_DEX, SPECIES_EVASION, MOB_EVASION_REF,
  armourOf, armourReduce, damageSplit, zoneBodyFactor, skillF, typicalDps, mobPs, mobHpAt, typicalDpsAt, mobPsAt, MOB_HP_ANCHORS, ZONES, zoneById, finalZoneId, winTarget, sizeById, speciesById, racesInZone, mobAcc, mobDodge, refAttackerAcc, mobRoster,
  mobResOf, speciesResMult, mobResByElementOf,
  engineForTown, fmt, r1, r2, build, ROAD,
  aspdOf, capAspd, hitsPerSec, weaponMult, physOf, magicOf, dodgeRate, dodgeChance, perfectDodgeChance,
  evasionChance, evasionRating, agilityEvasion,
  critPool, critChanceOf, critDmgOf, maxHpOf, hpRegenOf, maxManaOf, manaRegenOf, maxEsOf,
  esRegenOf, cdrOf, alignmentOf, resistanceOf, weightCapacityOf, killsToLevel, xpToNext, CHECKPOINTS_KILLS, PUSH_KILLS_91_100, SETTLEMENT_BUDGET_KILLS, treePointsAt,
  encumbranceOf, aspdEncumbered, weightAtQuality, weaponWeightOf, sizeMultOf, applySizeMult,
  stunRecoveryOf, stunStopSec, basicAttackOf,
  xpPerKill, spawnAt, rerollValueStonesPerHr, tierStonesPerHr, addStonesPerHr, qualityStonesPerHr, repairStonesPerHr, corruptStonesPerHr, stonesForMinutes, taskPayout, shared,
};
