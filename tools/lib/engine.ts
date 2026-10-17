/**
 * Shared engine math — the single source for stat ceilings, derived caps,
 * the loot model and craft throughput. Read by tools/check.ts (groups A · B · C · F)
 * and by every reader that needs a derived figure.
 *
 * Nothing here is a number copied by hand: every value is computed from
 * tools/data/engine.json, and every cage asserts the result against engine/ and the client.
 *
 * This file binds the data to `engine/index.ts` and hands the whole suite back as one object. It
 * names no member of that suite: a cage reaches `eng.<anything>` straight off the engine, so a new
 * engine figure is readable by every cage the moment it exists — the mirror cannot fall behind.
 */

import path from 'node:path';
import { readJson } from './json.ts';
import * as shared from '../../engine/index.ts';
import { createRoad } from '../../engine/road.ts';
import type { EngineData } from '../../engine/types.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ENGINE_JSON = path.join(import.meta.dirname, '..', 'data', 'engine.json');
const E = readJson<EngineData>(ENGINE_JSON);

/**
 * The cage-side engine: the shared suite over `tools/data/engine.json`, plus the raw data it was
 * built from and the walk model the cages read (the hex graph, the block time, the encounter chance).
 */
const eng = Object.assign({}, shared.createEngine(E), { E, ROAD: createRoad(E) });

// ---- the derived figures a reader asks for, so no number is a copy of a loot number
// The shape only: every figure here is a name on the engine, never an expression re-typed here.

function engineForTown(): any {
  const bands: Record<string, any> = {};
  for (const b of eng.BAND_KEYS) {
    bands[b] = {
      kills_per_hr: eng.BAND[b].kills_derived,
      drops_per_hr: eng.BAND[b].drops_per_hr,
      upgrades_per_hr: eng.BAND[b].upgrades_per_hr,
      band_kills: b === 'high_full_lck' ? 0 : eng.BAND[b].band_kills,
    };
  }
  return {
    bands,
    gold_per_junk_piece: eng.TS.gold_per_junk_piece,
    round_rate_to_decimals: eng.TS.round_rate_to_decimals,
    checkpoints_kills: eng.CHECKPOINTS_KILLS,
    budget_kills: (zone: number) => eng.SETTLEMENT_BUDGET_KILLS[zone],
    push_kills_91_100: eng.PUSH_KILLS_91_100,
    reroll_value_stones_per_hour: eng.STONE.reroll_value_stones_per_hr,
    reroll_uses_per_hour: eng.STONE.reroll_uses_per_hr,
    reroll_stones_per_cast: eng.C.reroll_value_stones_per_use,
    alchemy_tier_stones_per_hour: eng.STONE.alchemy_tier_stones_per_hr,
    reroll_casts_per_full_set_polish: eng.C.polish_casts_per_full_set,
    elite_reroll_tier_stones_per_hr: eng.eliteTierStonesPerHr('high'),
    add_mod_stones_per_hr: eng.STONE.add_stones_per_hr,
    ascend_stones_per_piece: eng.ascendStonesPerPiece,
    towns_gold_rate_multiplier_bound: eng.LCK_BOUND,
    gold_per_minute: {
      low: eng.goldPerMinute('low'), mid: eng.goldPerMinute('mid'),
      high: eng.goldPerMinute('high'), high_full_lck: eng.goldPerMinute('high_full_lck'),
    },
    // the walk's own shape, so T9 prints the block time and the encounter chance rather than a copy
    road: { block_sec: E.road.block_sec, encounter_chance_pct: E.road.encounter_chance_pct },
  };
}

export { ROOT, E, eng, engineForTown };
