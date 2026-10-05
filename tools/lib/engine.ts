/**
 * Shared engine math — the single source for stat ceilings, derived caps,
 * the loot model and craft throughput. Read by tools/check.ts (groups A · B · C · F)
 * and tools/town.ts (gold per minute · kill thresholds · supply).
 *
 * Nothing here is a doc number copied by hand: every value is computed from
 * tools/data/engine.json, and tools/check.ts compares the result against the
 * numbers the docs publish.
 */

import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './json.ts';
import { resolveDoc } from './generated.ts';
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
// "The one rule"). Only doc read-back and the town packaging live on this side.
const { createEngine } = shared;
const eng = createEngine(E);
/** The Road model the cages read: link graph, terrain tilt, the purse cap and the Chest cap. */
const ROAD = createRoad(E);

const {
  S, K, M, LG, L, C, TS, ES, CAP, BANDS, BAND_KEYS, BAND, CEIL, SPLIT, FORCED_SPLIT,
  DERIVED, REF, WEAPONS, STONE, LCK_BOUND, statAt, goldPerMinute, agiForCap, statWithItems,
  mobEvasion, sizeMult, playerAccuracy, hitVs, hitChance, MEAN_SPECIES_DEX, MOB_EVASION_REF, SPECIES_EVASION,
  armourOf, armourReduce, damageSplit, zoneBodyFactor, skillF, typicalDps, mobPs, mobHpAt,
  typicalDpsAt, mobPsAt, MOB_HP_ANCHORS, ZONES, zoneById, sizeById, mobAcc, mobDodge,
  refAttackerAcc, mobRoster, finalZoneId, winTarget, lckOf, dropChance, killsDerived, r1, r2, fmt,
  aspdOf, hitsPerSec, weaponMult, physOf, magicOf, dodgeRate, dodgeChance, perfectDodgeChance,
  evasionChance, evasionRating, agilityEvasion,
  critPool, critChanceOf, critDmgOf, maxHpOf, hpRegenOf, maxManaOf, manaRegenOf, maxEsOf,
  esRegenOf, cdrOf, alignmentOf, resistanceOf, weightCapacityOf, killsToLevel, xpToNext,
  encumbranceOf, aspdEncumbered, weightAtQuality, weaponWeightOf,
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
      kills_per_hr: BAND[b].kills_per_hr,
      drops_per_hr: BAND[b].drops_per_hr,
      upgrades_per_hr: BAND[b].upgrades_per_hr,
      band_hours: b === 'high_full_lck' ? 0 : BAND[b].band_hours,
    };
  }
  return Object.assign({}, townEngine, {
    bands,
    gold_per_junk_piece: TS.gold_per_junk_piece,
    round_rate_to_decimals: TS.round_rate_to_decimals,
    checkpoints_hr: L.timeline_checkpoints_hr,
    push_hr_levels_91_100: L.push_hr_levels_91_100,
    reroll_value_stones_per_hour: STONE.reroll_uses_per_hr,
    reroll_stones_per_cast: C.reroll_value_stones_per_use,
    reroll_casts_per_full_set_polish: C.polish_casts_per_full_set,
    elite_reroll_tier_stones_per_hr: Math.round(L.bands.high.kills_per_hr_published * L.elite_spawn_chance * L.elite_tier_stones),
    add_mod_stones_per_hr: STONE.add_stones_per_hr,
    ascend_stones_per_piece: C.ascend_add_stones + C.ascend_tier_stones,
    towns_gold_rate_multiplier_bound: LCK_BOUND,
    gold_per_minute: { low: goldPerMinute('low'), mid: goldPerMinute('mid'), high: goldPerMinute('high'), high_full_lck: goldPerMinute('high_full_lck') },
  });
}

// ---- doc read-back: the numbers the prose files publish must equal the math
const GENERIC_RULES: any[] = [
  { file: 'loot.md', label: 'loot.md F5 junk line', re: /\|\s*Reroll value stone\s*\|\s*([\d,]+)\s*\(/, pick: 1, expect: BAND.high.junk_per_hr },
  { file: 'crafting.md', label: 'crafting.md junk/hour → Reroll uses', re: /\((\d+)\/hour → ~(\d+) uses\/hour\)/, pick: [1, 2], expect: [BAND.high.junk_per_hr, STONE.reroll_uses_per_hr] },
  { file: 'crafting.md', label: 'crafting.md tier stones → Refines/hour', re: /\((\d+)\/hour → ~([\d.]+) Refines\/hour\)/, pick: [1, 2], expect: [STONE.tier_stones_per_hr, STONE.refines_per_hr] },
  { file: 'crafting.md', label: 'crafting.md Refine full-set hours', re: /2 steps = (\d+) casts[^)]*\) ≈ ([\d.]+) hours/, pick: [1, 2], expect: [STONE.refine_casts_full_set, r1(STONE.refine_hours_full_set)] },
  { file: 'formula.md', label: 'formula.md single-stat ceiling', re: /single-stat ceiling \| \*\*([\d,]+)\*\*/, pick: 1, expect: Math.round(CEIL) },
  { file: 'formula.md', label: 'formula.md stat at level 100 no gear', re: /Level 100 \(no gear\)[^|]*\|[^|]*every stat = (\d+)/, pick: 1, expect: statAt(100) },
  { file: 'formula.md', label: 'formula.md Str 13 physical power', re: /Str 13-item build \| Physical power ([\d,]+)/, pick: 1, expect: Math.round(DERIVED.phys) },
  { file: 'formula.md', label: 'formula.md K_AGI_ASPD', re: /\| K_AGI_ASPD \| ([\d.]+)/, pick: 1, expect: K.K_AGI_ASPD },
  { file: 'formula.md', label: 'formula.md K_INT_MREGEN', re: /\| K_INT_MREGEN \| \*\*([\d.]+)\*\*/, pick: 1, expect: K.K_INT_MREGEN },
  { file: 'formula-utility.md', label: 'formula-utility.md dagger Cap Agi', re: /\| dagger \| ([\d.]+) \| [\d.]+ \| ([\d,]+)/, pick: 2, expect: WEAPONS[0].agi_to_cap },
  { file: 'formula-utility.md', label: 'formula-utility.md sword Cap Agi', re: /\| one-handed sword \/ axe \| ([\d.]+) \| [\d.]+ \| ([\d,]+)/, pick: 2, expect: WEAPONS[1].agi_to_cap },
  { file: 'formula-defense.md', label: 'formula-defense.md CDR path to Cap (11 items)', re: /11 Mod items[^=]*= `([\d.]+) × ([\d.]+) = \**([\d.]+)\**`/, pick: [1, 2, 3], expect: [r1(DERIVED.cdr_raw), r2(1 + M.cdr_pct_per_item * LG.cdr_mod_items / 100), r1(DERIVED.cdr_four)] },
  { file: 'formula-utility.md', label: 'formula-utility.md accuracy ceiling', re: /Mod max 25 on main hand = \*\*([\d,]+)\*\*/, pick: 1, expect: Math.round(DERIVED.accuracy) },
  { file: 'formula.md', label: 'formula.md K_EVASION row', re: /\| K_EVASION \| ([\d.]+) \|/, pick: 1, expect: K.K_EVASION },
  { file: 'core-stats.md', label: 'core-stats.md Evasion K', re: /Dex x K_EVASION` \(([\d.]+)\)/, pick: 1, expect: K.K_EVASION },
  { file: 'core-stats.md', label: 'core-stats.md Armour K and divisor', re: /`Str x K_ARMOUR` \(([\d.]+)\)[\s\S]{0,160}?armour \+ (\d+) × raw_hit/, pick: [1, 2], expect: [K.K_ARMOUR, K.armour_divisor] },
  { file: 'core-stats.md', label: 'core-stats.md Energy Shield line', re: /`Int x K_INT_ES` \((\d+)\)[\s\S]{0,200}?recharges after (\d+) sec/, pick: [1, 2], expect: [K.K_INT_ES, E.energy_shield.delay_sec] },
  { file: 'combat.md', label: 'combat.md ES recharge delay', re: /Energy Shield takes the mitigated damage before HP \(chaos bypasses\) · recharges after (\d+) sec/, pick: 1, expect: E.energy_shield.delay_sec },
  { file: 'crafting.md', label: 'crafting.md ES recharge delay', re: /energy shield\s+= second pool ahead of HP [\u00b7]+ Int x K_INT_ES [\u00b7]+ chaos bypasses [\u00b7]+ recharges after (\d+) sec/, pick: 1, expect: E.energy_shield.delay_sec },


  { file: 'concept.md', label: 'concept.md zone-9 boss HP', re: /zone 9 boss \(level 90, HP ([\d,]+)\)/, pick: 1, expect: Math.round(E.mob.zones[8].hp[1] * E.mob.sizes.find((s) => s.id === 'boss')!.hp) },
  // The stat value in front of each of these is the ceiling itself, so it is interpolated from CEIL
  // rather than typed: a re-based ceiling moves the pattern instead of silently breaking the match.
  { file: 'formula-utility.md', label: 'formula-utility.md weight capacity', re: new RegExp('Str ' + Math.round(CEIL) + ' carries ([\\d,]+)'), pick: 1, expect: Math.round(DERIVED.weight) },
  { file: 'formula-utility.md', label: 'formula-utility.md drop multiplier', re: new RegExp('Lck ' + Math.round(CEIL) + ' gives ([\\d.]+)x'), pick: 1, expect: r1(DERIVED.drop_mult) },
  { file: 'formula-defense.md', label: 'formula-defense.md level_gain_hp', re: /level_gain_hp` = 40 × \(level − 1\) → at level 100 gives ([\d,]+)/, pick: 1, expect: LG.hp_per_level * (S.level_cap - 1) },
  { file: 'formula-defense.md', label: 'formula-defense.md pool ÷ regen', re: /pool ÷ regen\s*=\s*([\d,]+) ÷ (\d+) = ([\d.]+) seconds/, pick: [1, 3], expect: [Math.round(DERIVED.mana), r1(DERIVED.pool_regen_sec)] },
  { file: 'core-stats.md', label: 'core-stats.md Evasion Cap', re: /Evasion - % Cap (\d+)/, pick: 1, expect: E.caps.evasion },
  { file: 'core-stats.md', label: 'core-stats.md aspd Cap', re: /Cap (\d+) \(= 5 hits\/sec/, pick: 1, expect: E.caps.aspd },
  { file: 'core-stats.md', label: 'core-stats.md res Cap', re: /Cap (\d+) per Element/, pick: 1, expect: E.caps.elem_res },
  { file: 'core-stats.md', label: 'core-stats.md perfect dodge Cap', re: /Perfect dodge - % Cap (\d+)/, pick: 1, expect: E.caps.perfect_dodge },
  { file: 'checks.md', label: 'checks.md F2 L90 drop chance', re: /([\d.]+)% \(L90\)/, pick: 1, expect: BAND.high.drop_chance_pct },
];

function readDoc(file: string): string { return fs.readFileSync(path.join(ROOT, resolveDoc(file)), 'utf8'); }
const cellNum = (s: any): number => Number(String(s).replace(/[*,\s]/g, '').match(/[\d.]+/)?.[0] ?? NaN);

/** loot.md section 2 is a table, so it is read by row, not by regex. */
function readLootTable(): any[] {
  const text = readDoc('loot.md');
  const out: any[] = [];
  const rows: Record<string, string> = { low: 'low (1-30)', mid: 'mid (31-60)', high: 'high (61-90)', high_full_lck: 'high + full Lck' };
  for (const [band, key] of Object.entries(rows)) {
    const line = text.split(/\r?\n/).find((l) => l.startsWith('| ' + key));
    if (!line) { out.push({ ok: false, label: `loot.md section 2 ${band} row`, detail: 'row not found' }); continue; }
    const cells = line.split('|').map((c) => c.trim());
    const checks: any[][] = [
      ['kills/hr', cellNum(cells[4]), BAND[band].kills_per_hr],
      ['drops/hr', cellNum(cells[6]), BAND[band].drops_per_hr],
    ];
    const lckCell = cells[5].match(/(\d+)\s*\(?(?:L\d+)?\)?\s*→\s*×([\d.]+)/) || cells[5].match(/(\d+).*×([\d.]+)/);
    if (lckCell) {
      checks.push(['Lck at that level', cellNum(lckCell[1]), BAND[band].lck]);
      checks.push(['Lck multiplier', cellNum(lckCell[2]), BAND[band].lck_mult]);
    }
    for (const [what, got, want] of checks) {
      out.push({ ok: got === want, label: `loot.md §2 ${band} ${what}`, detail: `doc ${got} · engine ${want}` });
    }
  }
  return out;
}

function runReadBack(): any[] {
  const out: any[] = [];
  for (const rule of GENERIC_RULES) {
    let text: string;
    try { text = readDoc(rule.file); } catch (e) { out.push({ ok: false, label: rule.file, detail: e.message }); continue; }
    const m = text.match(rule.re);
    if (!m) { out.push({ ok: false, label: rule.label, detail: `pattern not found in ${rule.file}` }); continue; }
    const picks = Array.isArray(rule.pick) ? rule.pick : [rule.pick];
    const expects = Array.isArray(rule.expect) ? rule.expect : [rule.expect];
    picks.forEach((p: number, i: number) => {
      const got = cellNum(m[p]);
      out.push({ ok: got === expects[i], label: `${rule.label} [${i}]`, detail: `doc ${got} · engine ${expects[i]}` });
    });
  }
  return out.concat(readLootTable());
}

export {
  ROOT, E, S, K, M, LG, L, C, TS, BANDS, BAND_KEYS, BAND, CEIL, SPLIT, FORCED_SPLIT,
  DERIVED, REF, ES, WEAPONS, STONE, LCK_BOUND, statAt, goldPerMinute, agiForCap,
  statWithItems, mobEvasion, sizeMult, playerAccuracy, hitVs, MEAN_SPECIES_DEX, SPECIES_EVASION,
  armourOf, armourReduce, damageSplit, zoneBodyFactor, skillF, typicalDps, mobPs, mobHpAt, typicalDpsAt, mobPsAt, MOB_HP_ANCHORS, ZONES, zoneById, finalZoneId, winTarget, sizeById, mobAcc, mobDodge, refAttackerAcc, mobRoster,
  engineForTown, runReadBack, GENERIC_RULES, fmt, r1, r2, build, ROAD,
  aspdOf, hitsPerSec, weaponMult, physOf, magicOf, dodgeRate, dodgeChance, perfectDodgeChance,
  evasionChance, evasionRating, agilityEvasion,
  critPool, critChanceOf, critDmgOf, maxHpOf, hpRegenOf, maxManaOf, manaRegenOf, maxEsOf,
  esRegenOf, cdrOf, alignmentOf, resistanceOf, weightCapacityOf, killsToLevel, xpToNext,
  encumbranceOf, aspdEncumbered, weightAtQuality, weaponWeightOf,
  xpPerKill, spawnAt, rerollValueStonesPerHr, tierStonesPerHr, addStonesPerHr, qualityStonesPerHr, repairStonesPerHr, corruptStonesPerHr, stonesForMinutes, taskPayout, shared,
};
