/**
 * Engine cage — the stat model, the caps, the Mod pools and the loot/craft prices.
 *
 *   node tools/check.ts            help
 *   node tools/check.ts --checks   run every invariant, exit 1 on FAIL
 *   node tools/check.ts --sync     re-publish a derived anchor into the data
 *
 * Every value is computed from tools/data/engine.json (stat model · K values · mod maxima ·
 * loot model · craft prices) and read through engine/ — the data is the only home of a number,
 * so a gate that disagrees with the engine is a FAIL, not a note.
 */

import fs from 'node:fs';
import path from 'node:path';
import { eng, ROOT } from './lib/engine.ts';
import * as G from './lib/gates.ts';
import { readJson } from './lib/json.ts';
import { createSkillModel } from '../engine/skills.ts';
import { createLoot, leanReweight, leanReweightMany } from '../engine/loot.ts';

const { E, S, K, M, LG, BAND, BANDS, BAND_KEYS, CEIL, SPLIT, FORCED_SPLIT, FOCUSED_CEIL, DERIVED, ES, WEAPONS, STONE, LCK_BOUND, L, C, TS } = eng;
const MODS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/data/mods.json'), 'utf8'));
const BASES_JSON = readJson(path.join(import.meta.dirname, 'data/bases.json'));
const MAP = readJson(path.join(ROOT, 'tools/data/map.json'));
const f0 = (x: number) => Math.round(x).toLocaleString('en-US');
const f1 = (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (x: number) => Math.round(x * 100) / 100;

const BAND_LABEL: Record<string, string> = { low: 'low', mid: 'mid', high: 'high', high_full_lck: 'full Lck' };

// ---- minute one's set, derived the way the client derives it (`openingGear`): the data names a frame
// per slot and the engine's own floor rule produces the one line each piece carries, so the cages, the
// generated table and the game cannot disagree about minute one.
const LOOT_SLOTS = createLoot(E, MODS).SLOTS as string[];
const LOOT_NAMES: Record<string, string> = Object.fromEntries(MODS.mods.map((m: any) => [m.id, m.name]));
const openingSet = () => {
  const OPEN = E.opening;
  const LOOT = createLoot(E, MODS);
  return (OPEN.gear as any[]).map((g) => {
    const q = (LOOT.BAND_LABEL as string[]).indexOf(g.quality);
    const frame = BASES_JSON.bases.find((b: any) => b.name === g.base && b.slot === g.slot) || null;
    const weapon = frame ? null : BASES_JSON.weapons.find((w: any) => w.name === g.base) || null;
    return {
      g,
      frame,
      weapon,
      lines: LOOT.frameModAtFloor(BASES_JSON, g.slot, frame, weapon, OPEN.level, q),
      weight: frame ? frame.weight : eng.weaponWeightOf(BASES_JSON, g.base, 'main hand'),
    };
  });
};

// ---------------------------------------------------------------- tables

const BLOCKS: Record<string, () => string> = {};

BLOCKS['group-A'] = () => [
  '| id | Must hold | Expression | Value |',
  '|---|---|---|---|',
  `| A1 | stat at level 1 | \`${S.base} + ${S.point_value} × (${f0(eng.pointsAt(1))} ÷ 7)\` | ${f0(eng.statAt(1))} |`,
  `| A2 | stat at the level cap, no gear | \`${S.base} + ${S.point_value} × (${f0(eng.pointsAt(S.level_cap))} ÷ 7)\` | ${f0(eng.statAt(S.level_cap))} |`,
  `| A3 | single-stat ceiling | \`${f0(eng.statAt(S.level_cap))} + ${S.core_flat_max}×${S.item_slots}\` | **${f0(CEIL)}** |`,
  `| A4 | two-stat split ceiling | \`${S.split_items} items + ${S.split_items} items\` = \`${f0(eng.statAt(S.level_cap))} + ${S.core_flat_max}×${S.split_items}\` | ${f0(SPLIT)} / ${f0(SPLIT)} |`,
  `| A5 | no % term reinstated | \`(${f0(eng.statAt(S.level_cap))} + ${S.core_flat_max}×${S.item_slots}) × 1.0\` | ${f0(FORCED_SPLIT)} → **never revert to this** because all K values are set on ${f0(CEIL)} |`,
  `| A6 | item count origin | ${S.item_slots} worn slots (12 + main hand) · from equipment-slot.md | ${S.item_slots} |`,
  '',
  `Source: \`node tools/check.ts\` · stat line = \`stat_c = ${S.base} + ${S.point_value} × (points ÷ 7)\` (formula.md) · the Flat maximum from mod-pool.md (Stat Mod flat ${S.core_flat_max} · Stat Mod % is retired, so A3 is a flat-only sum) · slot count from equipment-slot.md.`,
  ''
].join('\n');

BLOCKS['group-B'] = () => {
  const rows = [
    ['B1', 'Physical / Magic power', `(${f0(CEIL)}×${K.K_STR} + ${M.phys_flat_main_hand}) × ${f2(1 + M.phys_pct_main_hand / 100)}`, `**${f0(DERIVED.phys)}**`],
    ['B2', 'Max HP (Vit build)', `(${f0(CEIL)}×${K.K_VIT_HP} + ${f0(LG.hp_per_level * (S.level_cap - 1))}) × ${f2(1 + (M.hp_pct_per_item * LG.hp_pct_mod_slots) / 100)}`, f0(DERIVED.hp)],
    ['B3', 'Max Mana', `${f0(CEIL)}×${K.K_INT_MP} + ${f0(LG.mp_per_level * (S.level_cap - 1))}`, f0(DERIVED.mana)],
    ['B4', 'Mana regen', `${f0(CEIL)}×${K.K_INT_MREGEN}`, `${f0(DERIVED.mana_regen)}/sec`],
    ['B5', '**pool ÷ regen**', `${f0(DERIVED.mana)} ÷ ${f1(DERIVED.mana_regen)}`, `**${f1(DERIVED.pool_regen_sec)} sec** (intent = ${TS.craft_progress_intent_sec})`],
    ['B6', 'Crit chance (no Flat)', `${f0(CEIL)}×${K.K_LCK_CRIT} + ${M.crit_pct_main_hand}% Mod`, `${f1(DERIVED.crit)}%`],
    ['B6b', 'Crit chance Cap → overflow', `min(${f1(DERIVED.crit)}, ${K.K_CRIT_CAP})`, `${f1(DERIVED.crit_chance)}% chance · overflow ${f1(DERIVED.crit_overflow)}% → crit damage ${f0(DERIVED.crit_dmg)}%`],
    ['B7', 'Elem res · no Core stat', 'gear only (owner ruling) — no K row feeds it', `${f1(DERIVED.res_raw)}% raw`],
    ['B8', 'Elem res from 3 Mod items', `${M.res_pct_per_item}×${LG.res_mod_items} (all gear)`, `${f1(DERIVED.res_three)} (Cap ${E.caps.elem_res})`],
    ['B9', 'Alignment raw', `${f0(CEIL)}×${K.K_DEX_ALIGN}`, `${f1(DERIVED.align_raw)}%`],
    ['B10', 'CDR raw', `${f0(CEIL)}×${K.K_WIS_CDR}`, `${f1(DERIVED.cdr_raw)}%`],
    ['B11', 'CDR + 4 Mod + BO', `${f1(DERIVED.cdr_raw)} × (1 + ${M.cdr_pct_per_item}×${LG.cdr_mod_items} + ${LG.cdr_buff_pct})%`, `${f1(DERIVED.cdr_four)} (hard ceiling ${E.caps.cdr})`],
    ['B12', 'Accuracy', `${f0(CEIL)}×${K.K_DEX_ACC}×${f2(1 + M.accuracy_pct / 100)}`, f0(DERIVED.accuracy)],
    ['B13', 'Weight capacity', `${f0(LG.weight_base)} + ${f0(CEIL)}×${K.K_STR_WEIGHT}`, f0(DERIVED.weight)],
    ['B14', 'Drop multiplier', `1 + ${f0(CEIL)}×${K.K_LCK_DROP}`, `${f2(DERIVED.drop_mult)}x`],
    ['B15', 'Energy Shield pool (Wis + gear)', `(${f0(eng.statAt(S.level_cap))}×${K.K_WIS_ES} + ${M.energy_shield_flat_t1}) × (1 + ${M.max_energy_shield_pct}/100)`, `**${f0(DERIVED.es_pool)}** · ${f1(DERIVED.es_share_of_hp * 100)}% of a caster build's ${f0(DERIVED.es_cast_hp)} HP`],
    ['B16', 'ES regen · full recovery', `${ES.regen_pct}% of the pool per sec · after ${ES.delay_sec} sec without a hit`, `${f1(DERIVED.es_regen)}/sec → **${f1(DERIVED.es_recover_sec)} sec** for the whole pool from the base rate · an \`es_regen\` skill, Mod or passive amplifies the rate (X25)`],
  ];
  return ['| id | Value | Expression | Result |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | \`${r[2]}\` | ${r[3]} |`), '',
    `Every row is the single-stat ceiling (${f0(CEIL)}) plus the one Mod slot that can roll that line (mod-pool.md maxima · equipment-slot.md slot rules).`,
    `B5 is the row K_INT_MREGEN was retuned for: ${f1(DERIVED.pool_regen_sec)} sec against the ${TS.craft_progress_intent_sec} sec intent (tolerance ±${TS.pool_regen_tolerance} sec).`, ''].join('\n');
};

BLOCKS['group-C'] = () => {
  const cap = (n: string) => (E.caps as any)[n];
  const sword = WEAPONS[1], dagger = WEAPONS[0];
  // The clock Cap is the interval itself, so its aspd form is derived, never typed.
  const aspdCap = 100 / E.caps.attack_interval_sec;
  // Evasion is one layer, and AGI carries it (owner ruling): the rating is `agi × K_EVASION` plus
  // the gear lines; its opening slice is discounted before the rest meets mob accuracy.
  // Dex feeds it nothing — its line is accuracy and the Status alignment gate.
  const evFloor = E.mob.species.reduce((a, b) => (b.accuracy_mult < a.accuracy_mult ? b : a));
  const c2rating = eng.evasionRating(SPLIT, M.evasion_flat_t1, M.evasion_pct);
  const c2chance = eng.evasionChance(c2rating, eng.mobAcc(eng.coreOf(evFloor, 'dex', evFloor.zones[0]), evFloor.accuracy_mult));
  const rows = [
    ['C1', `Evasion ${cap('evasion')}%`, `first ${E.evasion_roll.opening_rating} rating × ${E.evasion_roll.opening_share}; rating above × ${E.evasion_roll.earned_mult}; effective rating ÷ (effective rating + mob accuracy) · Dex feeds nothing (owner ruling)`, `**reachable** against the ${evFloor.name} ✓`],
    ['C2', `(compare) Agi ${f0(SPLIT)} + one Evasion flat line vs the floor lineage`, `rating = (${f0(SPLIT)}×${K.K_EVASION} + ${M.evasion_flat_t1}) × (1 + ${M.evasion_pct}/100) = ${f1(c2rating)}`, `${f1(c2chance)}% vs ${evFloor.name} · does not hit Cap ✓`],
    ['C3', `aspd ${f0(aspdCap)} (${E.caps.attack_interval_sec} sec a swing)`, `sword ${sword.weapon_aspd} + ${M.aspd_pct}% Mod → Agi = ${f0(sword.agi_to_cap)}`, `**${f0(sword.agi_to_cap)}** (ceiling ${f0(CEIL)}) ✓`],
    ['C4', `aspd ${f0(aspdCap)} (${E.caps.attack_interval_sec} sec a swing)`, `dagger ${dagger.weapon_aspd} + ${M.aspd_pct}% Mod`, `${f0(dagger.agi_to_cap)} ✓ · staff/2h unreachable by intent`],
    ['C5', 'Perfect dodge · no Cap', `ratio: Lck ${f0(CEIL)} × ${K.K_LCK_PDOGE} = rate ${f1(DERIVED.pdogge_rate)} ÷ (rate + ${K.K_PDOGE}) = ${f1(DERIVED.perfect_dodge)}%`, `the Lck ratio is the whole bound — it tops out under the old Cap, so the Cap was decoration and it was removed (owner ruling)`],
    ['C6', `Alignment ${cap('alignment')} · hard ceiling`, `Dex ${f0(CEIL)} (${f1(DERIVED.align_raw)}) + amulet + gloves (+${M.align_pct_per_item} +${M.align_pct_per_item})`, `${f1(DERIVED.align_path)} — the build tops out under the Cap `],
    ['C7', `Elem res ${cap('elem_res')} · binding Cap`, `${LG.res_mod_items} res items at the max roll · gear only, no Core stat`, `${f1(DERIVED.res_three)} — the build reaches past the Cap, so it **binds** `],
    ['C8', `CDR ${cap('cdr')} · hard ceiling`, `Wis ${f0(CEIL)} + ${LG.cdr_mod_items} CDR items + BO`, `${f1(DERIVED.cdr_four)} — the build tops out under the Cap `],
    ['C9', 'Crit (no Cap)', `Lck ${f0(CEIL)} + ${M.crit_pct_main_hand}% Mod + buff`, `${f1(DERIVED.crit)}% from stats alone · anything over ${K.K_CRIT_CAP} becomes crit damage (B6b) ✓`],
    ['C10', `stun ${cap('stun')}`, `Alignment reach ${f1(DERIVED.align_path)} × ${K.K_STUN_PER_ALIGN} = ${f1(DERIVED.align_path * K.K_STUN_PER_ALIGN)} + the mace's Chance to stun % line`, `${cap('stun')} ✓ via the mace Frame Mod, the only source past the Alignment reach `],
    ['C11', 'Accuracy', 'no Cap · `acc/(acc+E)` forbids 100% itself', `${f0(DERIVED.accuracy)} → ${f1(DERIVED.hit_chance * 100)}% ✓`],
  ];
  return ['| id | Cap | Reachable path | Value at that point |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`), '',
    'H3 rule: every Cap states whether it is a build target or a hard ceiling. A build-target Cap must bind (the build reaches it); a hard-ceiling Cap must not (the build tops out under it) — `elem_res` and `cdr` are hard ceilings, `evasion` binds against the low-accuracy lineages (X20), and `perfect_dodge`, `block`, `stun` and `alignment` carry no Cap at all (owner ruling).',
    'Agi-per-Cap rows are the same line as formula-utility.md section 7: `(100 ÷ attack_interval_sec) ÷ weapon_aspd` minus the 100 baseline and the 25% Mod, divided by ${K.K_AGI_ASPD} per Agi, plus the level-1 Base of 12.', ''].join('\n');
};

BLOCKS['group-F'] = () => {
  const b = BAND;
  // Every income row is per KILL, never per hour (the kills-not-hours rule): a rate is a tool's own arithmetic, not a
  // published source, so the only unit the surface states is what one kill pays.
  const perKill = (band: string, perHr: number) => perHr / BAND[band].kills_derived;
  const chance = (band: string) => BAND[band].drop_chance_pct / 100;
  const grp = (band: string) => BAND[band].group_mobs;
  const bossPerKill = perKill('high', L.boss_per_hour).toFixed(4);
  const rows = [
    ['F1', 'kills per clear cycle', `the group a cycle spawns`, `${grp('low')} low · ${grp('mid')} mid · ${grp('high')} high`],
    ['F2', 'drops per kill', `${L.base_drop_chance * 100}% × (1 + Lck×${K.K_LCK_DROP})`, `${f1(b.low.drop_chance_pct)}% (L${L.bands.low.lck_level}) · ${f1(b.mid.drop_chance_pct)}% (L${L.bands.mid.lck_level}) · ${f1(b.high.drop_chance_pct)}% (L${L.bands.high.lck_level}) · ${f1(b.high_full_lck.drop_chance_pct)}% (full Lck ${f0(CEIL)})`],
    ['F3', 'drops per clear cycle', `F1 × F2`, `${f2(grp('low') * chance('low'))} low · ${f2(grp('mid') * chance('mid'))} mid · ${f2(grp('high') * chance('high'))} high`],
    ['F4', 'upgrades per drop', E.f_rows_carried.find((r) => r.id === 'F4').expression, E.f_rows_carried.find((r) => r.id === 'F4').value],
    ['F5', 'junk per kill (gold)', `(drops − upgrades) per kill × ${TS.gold_per_junk_piece}`, `**${perKill('high', b.high.junk_per_hr).toFixed(4)}**`],
    ['F6', 'Reroll value uses per kill', `F5 ÷ ${C.reroll_value_stones_per_use}`, `**${perKill('high', STONE.reroll_uses_per_hr).toFixed(4)}**`],
    ['F7', 'Tier stone per kill', `elite ${perKill('high', b.high.kills_derived * L.elite_spawn_chance * L.elite_tier_stones).toFixed(4)} (${L.elite_spawn_chance * 100}% of kills ×${L.elite_tier_stones}) + boss ${perKill('high', L.boss_per_hour * L.boss_tier_stones).toFixed(4)} (${bossPerKill} ×${L.boss_tier_stones})`, `${perKill('high', STONE.tier_stones_per_hr).toFixed(4)}`],
    ['F8', 'Refines per kill', `F7 ÷ ${C.refine_stones_per_use}`, `**${perKill('high', STONE.refines_per_hr).toFixed(4)}**`],
    ['F9', 'Add stone per kill', `elite ${perKill('high', b.high.kills_derived * L.elite_spawn_chance * L.elite_add_stone_chance).toFixed(4)} (${L.elite_spawn_chance * 100}% of kills × ${L.elite_add_stone_chance * 100}% chance) + boss ${perKill('high', L.boss_per_hour * L.boss_add_stones).toFixed(4)} (${bossPerKill} ×${L.boss_add_stones})`, `**${perKill('high', STONE.add_stones_per_hr).toFixed(4)}**`],
    ['F10', 'Ascend per kill', `min(F9 ÷ ${C.ascend_add_stones} Add, F7 ÷ ${C.ascend_tier_stones} tier) — the scarcer stone sets the pace`, `**${perKill('high', STONE.ascend_per_hr).toFixed(4)}** · full 12-piece set **${f0(STONE.ascend_hours_full_set * b.high.kills_derived)} kills** (Add alone ${f0(STONE.add_hours_full_set * b.high.kills_derived)} kills · tier stones alone ${f0(STONE.tier_hours_full_set * b.high.kills_derived)} kills → tier stones bind)`],
    ['F13', 'herb bundles per kill', `separate roll · a bundle of ${E.herbs.bundle_min}-${E.herbs.bundle_max} zone-tier herbs`, `mid band **${f2(E.herbs.mid_chance)}** · high band **${f2(E.herbs.high_chance)}**`],
    ['F16', 'Refine full set', `${C.ascend_items_per_set} pieces × ${C.refine_slots_per_item} slots × ${C.refine_steps} steps = ${STONE.refine_casts_full_set} casts`, `**${STONE.refine_casts_full_set} casts** · ${STONE.refine_casts_full_set * C.refine_stones_per_use} Tier stones (checks.md E6)`],
    ['F17', 'Full-set polish', `${C.polish_casts_per_full_set} casts at ${C.reroll_value_stones_per_use} stones`, `**${C.polish_casts_per_full_set} casts** · ${C.polish_casts_per_full_set * C.reroll_value_stones_per_use} Value stones (checks.md E8)`],
    ['F18', 'gold per kill, the price unit', `F5, the junk line`, `${perKill('low', b.low.junk_per_hr).toFixed(4)} low · ${perKill('mid', b.mid.junk_per_hr).toFixed(4)} mid · ${perKill('high', b.high.junk_per_hr).toFixed(4)} high · ${perKill('high_full_lck', b.high_full_lck.junk_per_hr).toFixed(4)} full Lck (towns-stalls.md §1)`],
    ['F19', 'full-Lck income ceiling over the no-Lck line', `${perKill('high_full_lck', b.high_full_lck.junk_per_hr).toFixed(4)} ÷ ${perKill('high', b.high.junk_per_hr).toFixed(4)}`, `**×${f2(LCK_BOUND)}** — the only place Lck may multiply income (G8)`],
    ['F20', 'Quality stone per kill', `monster ${perKill('high', b.high.kills_derived * L.quality_stone_sources.monster_quality_chance).toFixed(4)} (${L.quality_stone_sources.monster_quality_chance * 100}% of kills) + elite ${perKill('high', b.high.kills_derived * L.elite_spawn_chance * L.quality_stone_sources.elite_quality_chance).toFixed(4)} (1 in 5 × ${L.quality_stone_sources.elite_quality_chance * 100}%) + boss ${perKill('high', L.boss_per_hour * L.quality_stone_sources.boss_quality_stones).toFixed(4)} (${bossPerKill} ×${L.quality_stone_sources.boss_quality_stones})`, `**${perKill('high', STONE.quality_stones_per_hr).toFixed(4)}**`],
    ['F21', 'Upgrade full set', `${C.upgrade_costs.join(' + ')} = ${STONE.upgrade_stones_per_piece} per piece × ${C.ascend_items_per_set} pieces = ${STONE.upgrade_stones_full_set} stones ÷ F20`, `**${f0(STONE.upgrade_stones_full_set / perKill('high', STONE.quality_stones_per_hr))} kills** for a full +15 set · the steps ${C.upgrade_breaks_from}-15 third alone, hunted only from bosses, is **${f0(STONE.upgrade_boss_third_hours * b.high.kills_derived)} kills** (crafting.md "sources shift monsters → elites → bosses by step")`],
    ['F22', 'Repair and Corrupt stone per kill', `Repair: elite ${perKill('high', b.high.kills_derived * L.elite_spawn_chance * L.repair_stone_sources.elite_repair_chance).toFixed(4)} (1 in 5 × ${L.repair_stone_sources.elite_repair_chance * 100}%) + boss ${perKill('high', L.boss_per_hour * L.repair_stone_sources.boss_repair_stones).toFixed(4)} · Corrupt: boss ${bossPerKill} × ${L.corrupt_stone_sources.boss_corrupt_chance * 100}% chance`, `Repair **${perKill('high', STONE.repair_stones_per_hr).toFixed(4)}** · Corrupt **${perKill('high', STONE.corrupt_stones_per_hr).toFixed(4)}** — the rarest stone, so one gamble per piece costs about ${f0(1 / perKill('high', STONE.corrupt_stones_per_hr))} kills and a full ${STONE.corrupt_gambles_full_set}-piece set of gambles is ${f0(STONE.corrupt_gambles_full_set / perKill('high', STONE.corrupt_stones_per_hr))} kills (crafting.md §Corrupt)`],
  ];
  const carried = E.f_rows_carried.filter((r) => !['F4'].includes(r.id)).map((r) => `| ${r.id} | ${r.value} | ${r.expression} · status **${r.status}** |`);
  return ['| id | Value | Expression |', '|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | \`${r[2]}\` = ${r[3]} |`),
    ...carried, '',
    `Derived from: group spawn ${L.group_spawn_sec} sec · ${L.ttk_per_mob_sec} sec TTK per mob (engine.json loot) · Lck read at the band's top level (stat_c = ${S.base} + ${S.point_value}×(points ÷ 7)) · Base drop ${L.base_drop_chance * 100}% (formula-utility.md section 10) · prices ${C.reroll_value_stones_per_use}/${C.refine_stones_per_use} stones (crafting.md).`,
    `F4 · F11 are **simulation output** (loot.md section 3) and F13 is unset — this cage does not invent it, it only refuses to let a derived row drift.`, ''].join('\n');
};

// ---------------------------------------------------------------- invariants

function runChecks() {
  const { add, watch, pending, rows } = G.gates();
  /**
   * A gate the owner has ruled ADVISORY: where it would have printed FAIL it prints PENDING instead, so a
   * published figure that moved can never block a feature. The signal survives — the line still prints,
   * with its own numbers — and the repair is the one it already names.
   */
  const soft = (id: string, ok: boolean, detail: string) => (ok ? add(id, true, detail) : pending(id, detail));

  // The reference ceiling is the even-split stat line plus every item slot; the focused ceiling
  // (all points in one stat) is the true maximum above it. A stat-model change that inverts the
  // order is a broken reference line, so the order is the gate.
  add('X1', SPLIT <= CEIL && CEIL <= FOCUSED_CEIL, `the two-way split ceiling ${f0(SPLIT)} sits under the reference ceiling ${f0(CEIL)}, which sits under the all-in-one-stat ceiling ${f0(FOCUSED_CEIL)} — the K values ride the even-split reference line, never the focused one (H5 · A3)`);
  watch('X3', Math.abs(DERIVED.pool_regen_sec - TS.craft_progress_intent_sec) <= TS.pool_regen_tolerance,
    `mana pool ÷ regen = ${f1(DERIVED.pool_regen_sec)} sec, outside the ±${TS.pool_regen_tolerance} sec window around the ${TS.craft_progress_intent_sec} sec intent (B5 · K_INT_MREGEN) — a pacing target to read, not a broken wire`,
    `mana pool ÷ regen = ${f1(DERIVED.pool_regen_sec)} sec against the ${TS.craft_progress_intent_sec} sec intent (B5 · K_INT_MREGEN)`);
  soft('X5', BANDS.every((b) => BAND[b].drops_per_hr === Math.round(BAND[b].kills_derived * (BAND[b].drop_chance_pct / 100))) && BAND.high_full_lck.drops_per_hr === Math.round(BAND.high_full_lck.kills_derived * (BAND.high_full_lck.drop_chance_pct / 100)),
    `F3 = F1 × F2 for all four rows: ${['low', 'mid', 'high', 'high_full_lck'].map((b) => `${f0(BAND[b].drops_per_hr)} ${BAND_LABEL[b]}`).join(' · ')}`);
  soft('X6', BANDS.every((b) => BAND[b].junk_per_hr === BAND[b].drops_per_hr - BAND[b].upgrades_per_hr),
    `junk = drops − upgrades everywhere, so gold and stones share one ceiling (G2 · G8)`);
  // The craft pacing is priced in KILLS (the kills-not-hours rule): what a kill pays is a drop line, so a set's cost is the
  // kills it takes, never an hour. `perKillK` turns each hourly figure into its per-kill drop, and
  // `killsFor` reads a set's stone count back out as kills off that same line.
  const perKillK = (perHr: number) => perHr / BAND.high.kills_derived;
  const tierPerKill = perKillK(STONE.tier_stones_per_hr);
  const addPerKill = perKillK(STONE.add_stones_per_hr);
  const junkPerKill = perKillK(BAND.high.junk_per_hr);
  const killsFor = (stones: number, perHr: number) => stones / perKillK(perHr);
  const ascAddKills = killsFor(C.ascend_items_per_set * C.ascend_add_stones, STONE.add_stones_per_hr);
  const ascTierKills = killsFor(C.ascend_items_per_set * C.ascend_tier_stones, STONE.tier_stones_per_hr);
  const ascKills = Math.max(ascAddKills, ascTierKills);
  const polishKills = killsFor(C.polish_casts_per_full_set * C.reroll_value_stones_per_use, BAND.high.junk_per_hr);
  watch('X10', polishKills <= 6500, `full-set polish costs ${f0(polishKills)} kills — past the ~6,500-kill pace the bench price was set at`,
    `full-set polish = ${C.polish_casts_per_full_set} casts at ${C.reroll_value_stones_per_use} stones = ${C.polish_casts_per_full_set * C.reroll_value_stones_per_use} Value stones, which the junk line pays in ${f0(polishKills)} kills — the cost one gold is priced against, read off the drop a kill pays (E8)`);

  // Cap reachability, split by kind. A build-target Cap must bind — the build reaches at
  // least the Cap, so the Cap is what the player feels. A hard-ceiling Cap must NOT bind — it sits
  // above what any build reaches, so the player keeps the build's real value instead of a cut. `cdr`
  // is the hard ceiling left, so the gate flips: it fails only if it ever drops onto its own build.
  // `alignment`, `perfect_dodge`, `block` and `stun` have no Cap (owner ruling), so they are not in
  // this list. `elem_res` binds (gear-only, X20's own argument), and `evasion` binds against the
  // low-accuracy lineages — both are build-target Caps, proved by C1/C7 and X20.
  const ceilCaps: [string, number, number][] = [
    ['cdr', DERIVED.cdr_four, E.caps.cdr],
  ];
  const nowBinding = ceilCaps.filter(([, v, c2]) => v > c2);
  soft('X11', nowBinding.length === 0,
    `hard-ceiling caps stay above their build: ${ceilCaps.map(([n, v, c2]) => `${n} reach ${f1(v)} < cap ${c2}`).join(' · ')}${nowBinding.length ? ' · NOW BINDING: ' + nowBinding.map((r) => r[0]).join(','): ''}`);
  soft('X12', E.caps.crit_chance === null,
    `crit carries no Cap in the data (caps.crit_chance ${E.caps.crit_chance} — the 100 Cap became a spill point, owner ruling)`);
  watch('X12t', DERIVED.crit <= K.K_CRIT_CAP,
    `stats alone reach ${f1(DERIVED.crit)}% against the ${K.K_CRIT_CAP} spill — past it every point is crit damage, a shape to re-read, not a broken wire`,
    `crit has no Cap: stats alone = ${f1(DERIVED.crit)}% < ${K.K_CRIT_CAP}, so overflow is ${f1(DERIVED.crit_overflow)} today and only buffs/skills can push past it (C9 · formula-offense.md)`);
  const capped = WEAPONS.filter((w) => !w.reachable).map((w) => w.name);
  soft('X13', capped.length === WEAPONS.length,
    `the clock Cap ${E.caps.attack_interval_sec} sec a swing (= ${f1(100 / E.caps.attack_interval_sec)} hits/sec, derived as 100 ÷ the interval) is out of reach for every weapon at the Agi ceiling: ${WEAPONS.map((w) => `${w.name} ${f0(w.agi_to_cap)}`).join(' · ')} vs ceiling ${f0(CEIL)} — the Cap is a clock rule, not a build target, and K_AGI_ASPD stays at ${K.K_AGI_ASPD} so no weapon crowds it`);
  const sword = WEAPONS.find((w) => w.name === 'one-handed sword');
  const anchorDps = sword ? sword.weapon_aspd * sword.weapon_mult : 0;
  const outsideWeaponBand = WEAPONS.filter((w) => {
    const index = anchorDps ? w.weapon_aspd * w.weapon_mult / anchorDps : 0;
    return index < 0.9 || index > 1.1;
  });
  add('X14', WEAPONS.length === 11 && sword?.weapon_mult === 1 && outsideWeaponBand.length === 0,
    `11 type-specific multipliers keep the one-handed sword at 1.00 and every type within ±10% DPS (sword anchor ${anchorDps}, outside: ${outsideWeaponBand.map((w) => w.name).join(', ') || 'none'})`);

  // §12 · the weapon × body-class ladder. The reference weapon must be flat across the three body
  // classes (that is what keeps every zone price still), every row must carry all three columns, and
  // a boss has to declare a real body class to read as. A non-flat row must be monotone, so the
  // sheet can print "favours Small, disfavours Large" without a chart.
  const weaponSizeProblems = [];
  const REF_WEAPON = 'one-handed sword';
  const weaponRows = (Object.entries((E.weapon_size_mult || {}).ladder || {}) as any[]).map(([name, l]) => ({ name, size_mult: l }));
  const bodyLabels = ['small', 'medium', 'large'];
  if (!weaponRows.length) weaponSizeProblems.push('bases.json has no weapon rows');
  for (const w of weaponRows) {
    const l = w.size_mult;
    if (!l || bodyLabels.some((b) => !(typeof l[b] === 'number' && l[b] > 0))) { weaponSizeProblems.push(`${w.name}: size_mult is missing a positive small/medium/large column`); continue; }
    if (bodyLabels.every((b) => l[b] === 1) === false && !(Math.max(l.small, l.medium, l.large) >= l.medium && l.medium >= Math.min(l.small, l.medium, l.large))) {
      weaponSizeProblems.push(`${w.name}: ladder is not monotone (${l.small}/${l.medium}/${l.large})`);
    }
  }
  const refRow = weaponRows.find((w) => w.name === REF_WEAPON);
  if (!refRow || bodyLabels.some((b) => refRow.size_mult?.[b] !== 1)) weaponSizeProblems.push(`${REF_WEAPON} is not the flat reference row`);
  const nonFlat = weaponRows.filter((w) => bodyLabels.some((b) => w.size_mult?.[b] !== 1)).map((w) => w.name);
  // every weapon type in bases.json needs a row, or a new type ships with an implicit 1.00 nobody chose
  const ladderNames = weaponRows.map((w) => String(w.name).toLowerCase());
  const uncovered = ((BASES_JSON.weapons || []) as any[]).map((w) => w.name).filter((n: string) => !ladderNames.includes(String(n).toLowerCase()));
  if (uncovered.length) weaponSizeProblems.push(`no size ladder row for: ${uncovered.join(', ')}`);
  const bossBodySize = E.mob.sizes.find((s) => s.id === 'boss');
  if (!bossBodySize?.reads_as || !E.mob.sizes.some((s) => s.id === bossBodySize!.reads_as)) weaponSizeProblems.push('mob.sizes.boss does not declare a real reads_as body class');
  
  add('X47', weaponSizeProblems.length === 0, weaponSizeProblems.length ? weaponSizeProblems.join(' · ')
    : `${weaponRows.length} weapon rows carry a small/medium/large ladder, ${REF_WEAPON} is flat at 1.00 so the reference row moves no zone price, ${nonFlat.length} row(s) are non-flat (${nonFlat.join(', ') || 'none'}) · Boss profiles declare the body class each one reads as (default \`${bossBodySize!.reads_as}\`) · the rule is one multiplier on the physical share of an outgoing hit, applied after mitigation (HugePatch section 12)`);

  // item 5 · Stun Recovery is Vit's line, and its K is derived from the owner's own example rather
  // than picked: a single-stat Vit build at the ceiling lands on 50%, so the published one-second
  // shock leaves half a second there. 100% is the natural bound, so the bound is not a new Cap.
  watch('X48', Math.abs(eng.stunRecoveryOf(CEIL) - 50) < 0.5 && eng.stunRecoveryOf(eng.FOCUSED_CEIL) <= 100,
    `Stun Recovery left its anchor: the ceiling Vit build recovers ${f1(eng.stunRecoveryOf(CEIL))}% (the owner's 50% example) and the focused build ${f1(eng.stunRecoveryOf(eng.FOCUSED_CEIL))}% (bounded by the natural 100)`,
    `Stun Recovery is \`Vit x K_VIT_STUNREC\` (${K.K_VIT_STUNREC}): the reference build (Vit ${f0(eng.statAt(S.level_cap))}) recovers ${f1(eng.stunRecoveryOf(eng.statAt(S.level_cap)))}% and a single-stat Vit build at the ceiling (Vit ${f0(CEIL)}) recovers ${f1(eng.stunRecoveryOf(CEIL))}%, so a ${E.status.shock.stop_sec} sec shock leaves ${r2(eng.stunStopSec(CEIL, E.status.shock.stop_sec))} sec there — the owner's own example (item 5) · the focused build is bounded by the natural 100% rather than negative`);

  // items 2 + 4 · the humanoid tribes drop a potion, and the chance is DERIVED from the band's own
  // herb stream rather than typed: the farm stays the primary provisioning source by construction.
  const potProblems: string[] = [];
  const humanoids = (E.mob.species as any[]).filter((r) => r.humanoid).map((r) => r.id);
  if (!humanoids.length) potProblems.push('no species carries the humanoid flag, so the potion drop has no source');
  const herbOf = (b: string) => (b === 'high' ? E.herbs.high_chance : b === 'mid' ? E.herbs.mid_chance : 0);
  const dropOf = (b: string) => {
    const cost = (E.potions as any).craft?.[b]?.herbs;
    return cost && herbOf(b) ? (herbOf(b) * ((E.herbs.bundle_min + E.herbs.bundle_max) / 2)) / cost : 0;
  };
  if (dropOf('low') !== 0) potProblems.push('the low band has no herb stream, so it must have no mob potion source');
  for (const b of ['mid', 'high']) {
    if (!(dropOf(b) > 0)) potProblems.push(`${b}: no potion drop at all`);
    else if (!(dropOf(b) < herbOf(b))) potProblems.push(`${b}: the potion drop (${f2(dropOf(b) * 100)}%) is not smaller than the herb stream it supplements`);
  }
  add('X49', potProblems.length === 0, potProblems.length ? potProblems.join(' · ')
    : `${humanoids.length} humanoid tribes (${humanoids.join(' · ')}) carry the potion drop · the chance is the band's own herb stream ÷ a potion's herb cost: ${['low', 'mid', 'high'].map((b) => `${b} ${f2(dropOf(b) * 100)}%`).join(' · ')} per kill, always under that band's herb chance, so the farm stays the primary source (items 2 + 4)`);

  // §14c · a magic weapon has no swing, it has a bolt worth the attack ladder's floor — the roster's
  // own weakest attack row — so the filler a caster falls back on is derived, and never a downgrade.
  const SM_ATK = createSkillModel(readJson(path.join(ROOT, 'tools/data/skills.json')), E);
  const boltProblems: string[] = [];
  for (const w of (BASES_JSON.weapons || []) as any[]) {
    const got = eng.basicAttackOf(BASES_JSON, w.name);
    const want = w.damage === 'magic' ? 'bolt' : 'swing';
    if (got !== want) boltProblems.push(`${w.name}: ${got}, expected ${want}`);
  }
  const boltFloor = SM_ATK.ladderFloorPct();
  if (!(boltFloor >= 100)) boltProblems.push(`the attack ladder's floor is ${f2(boltFloor)}% — a bolt below a swing's full hit would make the filler a downgrade`);
  const boltRows = ((BASES_JSON.weapons || []) as any[]).filter((w) => eng.basicAttackOf(BASES_JSON, w.name) === 'bolt').map((w) => w.name);
  add('X50', boltProblems.length === 0, boltProblems.length ? boltProblems.join(' · ')
    : `${boltRows.length} magic weapon(s) of ${(BASES_JSON.weapons || []).length} flick a bolt instead of swinging (${boltRows.join(' · ')}) · a bolt is a press on the attack clock with no mana and no cooldown, worth the attack ladder's floor ${f2(boltFloor)}% of the finished hit, so the filler is never a downgrade and the bar can carry real cooldowns (HugePatch section 14c)`);

  // the world's regions are data now (`mob.zones[].region`), so the owner's geography pass has a
  // model to place species against instead of prose per settlement
  const regionProblems: string[] = [];
  const byRegion: Record<string, string[]> = {};
  for (const z of E.mob.zones as any[]) {
    const r = z.region;
    if (!r || typeof r !== 'string') { regionProblems.push(`zone ${z.id} names no region`); continue; }
    if (r !== r.toLowerCase()) regionProblems.push(`zone ${z.id}: region "${r}" is not lowercase`);
    if (r === z.name.toLowerCase()) regionProblems.push(`zone ${z.id}: region "${r}" just repeats the settlement`);
    (byRegion[r] = byRegion[r] || []).push(z.name);
  }
  const global = Object.entries(byRegion).filter(([, zs]) => zs.length > 2);
  if (global.length) regionProblems.push(`a region covering more than two zones is a biome, not a region: ${global.map(([r, zs]) => `${r} (${zs.length})`).join(' · ')}`);
  add('X51', regionProblems.length === 0, regionProblems.length ? regionProblems.join(' · ')
    : `${Object.keys(byRegion).length} regions over ${E.mob.zones.length} zones, every one lowercase, none echoing its settlement and none covering more than two zones — the world reads as places, which is what the owner's geography pass places species against (mob.zones[].region · world.md \`zone-table\`)`);

  // the geography layer, second half: a species owns a `habitat` region list and may appear ONLY
  // in zones whose region is on it. Placement (`zones`) is where the species is today; habitat is
  // where it is allowed to be — so a re-placement is a data edit the gate checks, not a second doc.
  const habitatProblems: string[] = [];
  const regionOfZone = new Map<number, string>((E.mob.zones as any[]).map((z) => [z.id, z.region]));
  const realRegions = new Set<string>([...regionOfZone.values()]);
  const claimedRegions = new Set<string>();
  for (const s of E.mob.species as any[]) {
    const h = s.habitat;
    if (!Array.isArray(h) || !h.length) { habitatProblems.push(`species ${s.id} names no habitat`); continue; }
    for (const r of h) {
      if (!realRegions.has(r)) habitatProblems.push(`${s.id}: habitat "${r}" is not a region any zone carries`);
      else claimedRegions.add(r);
    }
    for (const zid of s.zones as number[]) {
      const r = regionOfZone.get(zid);
      if (!r) { habitatProblems.push(`${s.id}: zone ${zid} does not exist`); continue; }
      if (!h.includes(r)) habitatProblems.push(`${s.id} appears in zone ${zid} (${r}), outside its habitat`);
    }
  }
  const lifelessRegions = [...realRegions].filter((r) => !claimedRegions.has(r));
  if (lifelessRegions.length) habitatProblems.push(`no species claims the region(s): ${lifelessRegions.join(' · ')}`);
  const habitatSizes = (E.mob.species as any[]).map((s) => s.habitat.length);
  add('X52', habitatProblems.length === 0, habitatProblems.length ? habitatProblems.join(' · ')
    : `${E.mob.species.length} species each carry a habitat of ${Math.min(...habitatSizes)}-${Math.max(...habitatSizes)} regions, every named region is real and claimed by at least one species, and every zone a species sits in is inside its habitat — a species appears only where its habitat allows, so the owner's re-placement is a data edit this gate reads (mob.species[].habitat · world.md \`mob-sheet\`)`);
  // X53: species.zones owns zone eligibility; each subzone is an independent pool and pools may overlap.
  // Their union must cover the zone cast, and every displayed ladder rung must belong to its pool.
  const subProblems: string[] = [];
  {
    const byId = new Map((E.mob.species as any[]).map((s) => [s.id, s]));
    const variants = (E.mob as any).variants || {};
    const bossNames = new Set(((E.mob as any).bosses || []).map((b: any) => b.name));
    const variantOwner = new Map<string, string[]>();
    for (const [sid, names] of Object.entries(variants)) for (const n of (names as string[])) {
      if (!variantOwner.has(n)) variantOwner.set(n, []);
      variantOwner.get(n)!.push(sid);
    }
    for (const sid of Object.keys(variants)) if (!byId.has(sid)) subProblems.push(`variants row ${sid} names no species`);
    for (const s of (E.mob.species as any[])) if (!(s.id in variants)) subProblems.push(`${s.name} has no variants row`);
    for (const z of (E.mob.zones as any[])) {
      const want = new Set(eng.racesInZone(z.id));
      const shown = new Set<string>((z.subzones || []).flatMap((s: any) => s.races || []));
      for (const r of shown) {
        if (!byId.has(r)) { subProblems.push(`zone ${z.id} subzone names unknown race ${r}`); continue; }
        if (!want.has(r)) subProblems.push(`${r} shown in zone ${z.id} but placed in zones ${(byId.get(r).zones || []).join(',')}`);
      }
      for (const r of want) if (!shown.has(r)) subProblems.push(`${r} placed in zone ${z.id} but shown in no subzone there`);
      for (const s of (z.subzones || [])) {
        const pool = new Set(s.races || []);
        for (const n of (s.normal || [])) {
          const owners = (variantOwner.get(n) || []).filter((o) => pool.has(o));
          if (!owners.length) subProblems.push(`zone ${z.id} ${s.name} lists ${n}, owned by no race shown there`);
        }
        if (s.elite && !bossNames.has(s.elite)) {
          const owners = (variantOwner.get(s.elite) || []).filter((o) => pool.has(o));
          if (!owners.length) subProblems.push(`zone ${z.id} ${s.name} elite ${s.elite} owned by no race shown there`);
        }
      }
    }
  }
  add('X53', subProblems.length === 0, subProblems.length ? subProblems.join(' · ')
    : `${E.mob.zones.length} zones read eligibility from mob.species[].zones via racesInZone, subzone race pools may overlap across environments while their union covers each zone cast, and every displayed variant belongs to a race shown in its subzone`);

  // The map stays presentation-only. This crosswalk lets the cage catch drift between its ground
  // vocabulary and the environments attached to combat subzones without making the client read map data.
  const environmentTerrain = (MAP as any).environment_terrain || {};
  const mobEnvironments = new Set<string>((E.mob.zones as any[]).flatMap((z) =>
    (z.subzones || []).map((s: any) => s.environment)));
  const mapTerrains = new Set<string>(((MAP as any).cells || []).flatMap((cell: any) =>
    (cell.subs || []).map((sub: any) => sub.terrain)));
  const environmentTerrainProblems: string[] = [];
  for (const environment of mobEnvironments) {
    if (!(environment in environmentTerrain)) environmentTerrainProblems.push(`${environment}: no terrain mapping`);
  }
  for (const [environment, terrain] of Object.entries(environmentTerrain) as [string, string][]) {
    if (!mobEnvironments.has(environment)) environmentTerrainProblems.push(`${environment}: no mob environment uses this mapping`);
    if (!mapTerrains.has(terrain)) environmentTerrainProblems.push(`${environment}: unknown map terrain ${terrain}`);
  }
  const usedMapTerrains = new Set<string>(Object.values(environmentTerrain));
  for (const terrain of mapTerrains) if (!usedMapTerrains.has(terrain)) environmentTerrainProblems.push(`${terrain}: no mob environment maps to it`);
  add('X66', environmentTerrainProblems.length === 0, environmentTerrainProblems.length
    ? environmentTerrainProblems.join(' · ')
    : `${mobEnvironments.size} mob environments map to the map's ${mapTerrains.size} terrain labels; both vocabularies are joined for validation only (map.json environment_terrain)`);

  // A wild cell's kind is the readable label for the fieldwork index it occupies. The array order
  // remains the address; its kind makes accidental reordering visible to this gate.
  const wildIndex = (E.fieldwork as any).wild_site_index || {};
  const wildKindAt = new Map<number, string>();
  const wildProblems: string[] = [];
  for (const [kind, index] of Object.entries(wildIndex) as [string, number][]) {
    if (!Number.isInteger(index) || index < 0 || wildKindAt.has(index)) wildProblems.push(`${kind}: invalid or duplicate wild-site index ${index}`);
    else wildKindAt.set(index, kind);
  }
  const wildCount = wildKindAt.size;
  for (const [cellIndex, cell] of ((MAP as any).cells || []).entries()) {
    if (!Array.isArray(cell.wild) || cell.wild.length !== wildCount) {
      wildProblems.push(`map cell ${cellIndex}: ${cell.wild?.length ?? 0} wild sites, expected ${wildCount}`);
      continue;
    }
    cell.wild.forEach((site: any, index: number) => {
      const expected = wildKindAt.get(index);
      if (!expected || site.kind !== expected) wildProblems.push(`map cell ${cellIndex} wild index ${index}: kind ${site.kind || 'missing'}, expected ${expected || 'no site kind'}`);
    });
  }
  add('X67', wildProblems.length === 0, wildProblems.length ? wildProblems.join(' · ')
    : `${(MAP as any).cells.length} map cells label all ${wildCount} wild sites by the matching fieldwork index (map.json cells[].wild)`);

  const accuracyLevels = new Set((E.mob.species as any[]).map((s) => s.accuracy_mult));
  const sizePatterns = new Set((E.mob.species as any[]).map((s) => [...s.sizes].sort().join('+')));
  const m3Problems: string[] = [];
  if (accuracyLevels.size < 7) m3Problems.push(`accuracy ladder has ${accuracyLevels.size} values, expected at least 7`);
  if (sizePatterns.size < 5) m3Problems.push(`species use ${sizePatterns.size} body-class patterns, expected at least 5`);
  for (const id of ['kobold', 'slime', 'spider', 'wolf']) {
    if ((E.mob.species as any[]).find((s) => s.id === id)?.sizes.includes('large')) m3Problems.push(`${id}: swarm body may not include Large`);
  }
  for (const id of ['ogre', 'troll', 'golem', 'treant', 'giant']) {
    if ((E.mob.species as any[]).find((s) => s.id === id)?.sizes.includes('small')) m3Problems.push(`${id}: bruiser body may not include Small`);
  }
  for (const zone of (E.mob.zones as any[]).slice(-3)) {
    const cast = (E.mob.species as any[]).filter((s) => s.zones.includes(zone.id));
    const nonPhysical = cast.filter((s) => s.damage !== 'physical').length;
    if (nonPhysical * 2 < cast.length) m3Problems.push(`zone ${zone.id}: ${nonPhysical}/${cast.length} species use mixed or magic damage`);
  }
  add('X69', m3Problems.length === 0, m3Problems.length ? m3Problems.join(' · ')
    : `${accuracyLevels.size} accuracy tiers, ${sizePatterns.size} body-class patterns, role-specific Small/Large bounds, and mixed or magic damage on at least half of each final-zone cast`);

  const subzoneCasts = (E.mob.zones as any[]).flatMap((z) =>
    (z.subzones || []).map((s: any) => (s.races || []).slice().sort().join('+')));
  const distinctSubzoneCasts = new Set(subzoneCasts).size;
  add('X70', subzoneCasts.length > 0 && distinctSubzoneCasts >= 40, subzoneCasts.length > 0 && distinctSubzoneCasts >= 40
    ? `${distinctSubzoneCasts} distinct race casts across ${subzoneCasts.length} subzones (target 40+)`
    : `${distinctSubzoneCasts} distinct race casts across ${subzoneCasts.length} subzones; the layout target is 40+`);

  const bossProfileProblems: string[] = [];
  const physicalBodies = new Set(['small', 'medium', 'large']);
  for (const boss of E.mob.bosses as any[]) {
    const species = (E.mob.species as any[]).find((s) => s.id === boss.species);
    if (!species) { bossProfileProblems.push(`${boss.name}: missing species ${boss.species}`); continue; }
    if (!boss.core || STAT_KEYS.some((key) => !Number.isInteger(boss.core[key]) || boss.core[key] < 0)) bossProfileProblems.push(`${boss.name}: Core must contain whole non-negative stats`);
    if (boss.core?.wis !== 0) bossProfileProblems.push(`${boss.name}: Wis is not live on mobs`);
    if (boss.core?.vit !== species.core.vit) bossProfileProblems.push(`${boss.name}: Vit changes its species HP contribution`);
    if (boss.damage === 'physical' && boss.core?.int !== 0) bossProfileProblems.push(`${boss.name}: physical profile carries Int`);
    if (boss.damage !== 'physical' && !(boss.core?.int > 0)) bossProfileProblems.push(`${boss.name}: ${boss.damage} profile needs Int`);
    if (!(boss.damage in (E.mob.damage_split as any))) bossProfileProblems.push(`${boss.name}: unknown damage tag ${boss.damage}`);
    if (!(E.elements.order as string[]).includes(boss.element)) bossProfileProblems.push(`${boss.name}: unknown Element ${boss.element}`);
    if (!physicalBodies.has(boss.reads_as)) bossProfileProblems.push(`${boss.name}: reads_as must name a body class`);
    if (!(boss.accuracy_mult > 0) || !boss.trait) bossProfileProblems.push(`${boss.name}: accuracy tier or trait is missing`);
  }
  add('X71', bossProfileProblems.length === 0, bossProfileProblems.length ? bossProfileProblems.join(' · ')
    : `${E.mob.bosses.length} per-zone bosses own Core, trait, Element, damage, accuracy and reads_as; their species Vit keeps each HP contribution fixed`);

  const mapRegionProblems: string[] = [];
  const zoneById = new Map<number, any>((E.mob.zones as any[]).map((zone) => [zone.id, zone]));
  const mappedZoneIds = new Set<number>();
  for (const region of ((MAP as any).regions || [])) {
    const ids = region.zones || [];
    for (const id of ids) {
      if (mappedZoneIds.has(id)) mapRegionProblems.push(`${region.name}: zone ${id} is assigned to more than one map region`);
      mappedZoneIds.add(id);
      if (!zoneById.has(id)) mapRegionProblems.push(`${region.name}: zone ${id} does not exist`);
    }
    const expected = [...new Set(ids.map((id: number) => zoneById.get(id)?.region).filter(Boolean))].sort();
    const actual = [...(region.zone_regions || [])].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) mapRegionProblems.push(`${region.name}: zone_regions ${actual.join(', ') || '(missing)'}, expected ${expected.join(', ')}`);
  }
  for (const zone of E.mob.zones as any[]) if (!mappedZoneIds.has(zone.id)) mapRegionProblems.push(`zone ${zone.id} has no map region`);
  add('X72', mapRegionProblems.length === 0, mapRegionProblems.length ? mapRegionProblems.join(' · ')
    : `${((MAP as any).regions || []).length} presentation regions map all ${mappedZoneIds.size} zone IDs to their gameplay zone.region names (map.json regions[].zone_regions)`);

  const environmentLean = (E.mob as any).environment_lean || {};
  const environmentLeanProblems: string[] = [];
  for (const environment of mobEnvironments) {
    if (!(environment in environmentLean)) environmentLeanProblems.push(`${environment}: no drop lean`);
  }
  for (const [environment, lean] of Object.entries(environmentLean) as [string, string][]) {
    if (!mobEnvironments.has(environment)) environmentLeanProblems.push(`${environment}: no subzone uses this lean`);
    if (!['none', 'gear', 'herb', 'junk'].includes(lean)) environmentLeanProblems.push(`${environment}: unknown lean ${lean}`);
  }
  const leanSample = { gear: 0.08, herb: 0.17, junk: 0.3 };
  const onceLeaned = leanReweight(leanSample, 'gear', E.loot.variant_lean.shift_pct);
  const combinedLeans = (lean: 'none' | 'gear' | 'herb' | 'junk') =>
    leanReweightMany(leanSample, ['gear', lean], E.loot.variant_lean.shift_pct);
  const probabilityTotal = (p: any) => p.gear + p.herb + p.junk;
  for (const [environment, lean] of Object.entries(environmentLean) as [string, 'none' | 'gear' | 'herb' | 'junk'][]) {
    const result = combinedLeans(lean);
    if (Math.abs(probabilityTotal(result) - probabilityTotal(leanSample)) > 1e-9) environmentLeanProblems.push(`${environment}: variant + environment tilts changed expected drops/kill`);
    if (lean !== 'none' && result[lean] <= onceLeaned[lean]) environmentLeanProblems.push(`${environment}: environment lean ${lean} does not increase its stream over the variant lean`);
  }
  add('X73', environmentLeanProblems.length === 0, environmentLeanProblems.length
    ? environmentLeanProblems.join(' · ')
    : `${mobEnvironments.size} subzone environments carry a second lean; each layers over the variant lean and conserves the gear/herb/junk expected total`);

  // X74: the species trait is read as a mechanic. The set is closed, every key carries the one number
  // it runs on, and no key may reach mob_HP, mob PS, the drop line or the stone funnel — the variety is
  // in how a fight reads, never in what the published anchors pay.
  {
    const TM = (E.mob as any).trait_mechanics || {};
    const tp: string[] = [];
    const set: string[] = TM.set || [];
    if (!set.length) tp.push('mob.trait_mechanics.set is empty — the trait is a label again');
    for (const key of set) {
      if (!TM[key]) tp.push(`${key}: named in the set but carries no rule`);
      else if (!TM[key].word) tp.push(`${key}: no word for the card, the travel panel and the wiki to print`);
      else if (key === 'fast_clock' && !(TM[key].clock_mult > 1)) tp.push('fast_clock: clock_mult must speed the swing (>1)');
      else if (key === 'poison_burst' && !(TM[key].ps_pct > 0)) tp.push('poison_burst: ps_pct must be a real share (>0)');
      else if (key === 'element_weak' && !(TM[key].taken_pct > 0)) tp.push('element_weak: taken_pct must be a real share (>0)');
      else if (key === 'bleed_immune' && !(TM[key].statuses || []).includes('bleed')) tp.push('bleed_immune: it must name the status it refuses');
    }
    const elements = new Set(E.elements.order as string[]);
    const mechanicCount: Record<string, number> = {};
    for (const sp of E.mob.species) {
      const mech = (sp as any).mechanics || {};
      for (const [key, arg] of Object.entries(mech) as [string, any][]) {
        if (!set.includes(key)) tp.push(`${sp.id}: ${key} is not in mob.trait_mechanics.set`);
        mechanicCount[key] = (mechanicCount[key] || 0) + 1;
        if (key === 'element_weak') {
          if (!elements.has(String(arg))) tp.push(`${sp.id}: weak to ${arg}, which is not a declared Element`);
          else if (arg === (sp as any).element) tp.push(`${sp.id}: weak to its own Element, which its flat res already answers`);
        } else if (arg !== true) tp.push(`${sp.id}: ${key} takes no argument but carries ${JSON.stringify(arg)}`);
      }
      // a fast clock is the one mechanic that moves a swing rate, and the mob clock is the same ceiling
      // the player obeys — the published PS is divided by it, so the damage per second never moves
      if (mech.fast_clock && 1 / (E.mob.attack_clock_per_sec.normal * TM.fast_clock.clock_mult) < E.caps.attack_interval_sec) {
        tp.push(`${sp.id}: a fast clock would out-run caps.attack_interval_sec`);
      }
    }
    for (const key of set) if (!mechanicCount[key]) tp.push(`${key}: no species carries it — the mechanic is never read`);
    add('X74', tp.length === 0, tp.length ? tp.join(' · ')
      : `${Object.values(mechanicCount).reduce((a, b) => a + b, 0)} species mechanics over the closed set ${set.join(' · ')}: ${Object.entries(mechanicCount).map(([k, n]) => `${k} ×${n}`).join(' · ')} — none of them touches mob_HP, mob PS, the drop line or the stone funnel`);
  }

  // X75: the side the feet stand on fields its own pack, and every zone spends the encounter budget it
  // publishes: the three sides average back to the zone's own group range, to loot.elite_spawn_chance
  // and to the plain body mix, so a crowded side and a heavy side are a choice of ground, not a rate.
  {
    const sp2: string[] = [];
    const packs = (E.mob as any).spawn_packs || {};
    const packNames = Object.keys(packs).filter((k) => k !== 'note');
    if (!packNames.includes('even')) sp2.push('mob.spawn_packs has no `even` — bare ground has no mix to roll');
    if (!packNames.length) sp2.push('mob.spawn_packs is empty — the side profile is decoration');
    // the mix tilts cancel: the mean Small share over the pack kinds is the plain mix's own Small share
    if (packNames.length) {
      const smallOf = (name: string) => {
        const p = packs[name] || {};
        const total = (p.small || 0) + (p.medium || 0);
        return total ? (p.small || 0) / total : 0;
      };
      const evenSmall = smallOf('even');
      const meanSmall = packNames.reduce((t, n) => t + smallOf(n), 0) / packNames.length;
      if (Math.abs(meanSmall - evenSmall) > 1e-9) sp2.push(`the pack kinds average a ${f1(meanSmall * 100)}% Small share, not the even mix's ${f1(evenSmall * 100)}%`);
    }
    const mid = (g: string) => { const [lo, hi] = String(g).split('-').map(Number); return ((lo || 1) + (hi || lo || 1)) / 2; };
    const zoneList = E.mob.zones as any[];
    let profiled = 0;
    for (const z of zoneList) {
      const subs = z.subzones || [];
      if (!subs.length) continue;
      const kinds = subs.map((s: any) => (s.spawn || {}).pack);
      if (kinds.every((k: string) => k === kinds[0]) && kinds[0]) sp2.push(`zone ${z.id}: every side rolls the same pack, so the zone reads tilted, not the side`);
      // one of each kind per zone is what keeps the zone's own body mix on the published line
      if (kinds.every((k: string) => k) && kinds.slice().sort().join(' ') !== packNames.slice().sort().join(' ')) {
        sp2.push(`zone ${z.id}: its sides carry ${kinds.join(' ')}, not one of each pack kind`);
      }
      const groups = subs.map((s: any) => (s.spawn || {}).group);
      if (groups.every((g: string) => !g)) continue;
      profiled++;
      const meanGroup = groups.reduce((t: number, g: string) => t + (g ? mid(g) : mid(z.group)), 0) / subs.length;
      if (Math.abs(meanGroup - mid(z.group)) > 1e-9) sp2.push(`zone ${z.id}: the sides average a ${f2(meanGroup)}-mob pack against the published ${f2(mid(z.group))} (${groups.join(' ')})`);
      const pcts = subs.map((s: any) => (s.spawn || {}).elite_pct);
      const meanElite = pcts.reduce((t: number, p: any) => t + (p == null ? E.loot.elite_spawn_chance * 100 : p), 0) / subs.length;
      if (Math.abs(meanElite - E.loot.elite_spawn_chance * 100) > 1e-9) sp2.push(`zone ${z.id}: the sides average ${f1(meanElite)}% Elites against the published ${f1(E.loot.elite_spawn_chance * 100)}% (${pcts.join(' ')})`);
      for (const s of subs) {
        const own = (s as any).spawn || {};
        if (own.pack && !packNames.includes(own.pack)) sp2.push(`zone ${z.id} ${s.name}: pack ${own.pack} is not in mob.spawn_packs`);
        if (own.group && own.group.split('-').length !== 2) sp2.push(`zone ${z.id} ${s.name}: group ${own.group} is not a lo-hi range`);
        if (own.elite_pct != null && !(own.elite_pct >= 0 && own.elite_pct <= 100)) sp2.push(`zone ${z.id} ${s.name}: elite_pct ${own.elite_pct} is not a percent`);
      }
    }
    add('X75', sp2.length === 0, sp2.length ? sp2.join(' · ')
      : `${profiled}/${zoneList.filter((z: any) => (z.subzones || []).length).length} zones field a per-side pack, Elite rate and body mix; each zone's sides average back to its published group and to the ${f1(E.loot.elite_spawn_chance * 100)}% Elite rate, and the ${packNames.length} pack kinds average the plain mix`);
  }

  const formProblems: string[] = [];
  const formNames = new Set<string>();
  const formCoreKeys = ['str', 'agi', 'vit', 'dex', 'int', 'wis', 'lck'];
  for (const z of E.mob.zones) {
    const zoneForms = (E.mob.forms as any)?.[z.id] || {};
    const placed = E.mob.species.filter((sp) => sp.zones.includes(z.id));
    if (z.levels[0] > E.mob.form_level_cap) {
      if (Object.keys(zoneForms).length) formProblems.push(`zone ${z.id}: levels above 100 must not define mob variants`);
      continue;
    }
    const expectedIds = placed.map((sp) => sp.id).sort();
    const actualIds = Object.keys(zoneForms).sort();
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) formProblems.push(`zone ${z.id}: forms do not match its placed lineages`);
    for (const sp of placed) {
      const form = zoneForms[sp.id];
      if (!form) continue;
      if (form.levels?.[0] !== z.levels[0] || form.levels?.[1] !== z.levels[1]) formProblems.push(`${z.id}/${sp.id}: form range does not match the zone`);
      if (!form.name || formNames.has(form.name)) formProblems.push(`${z.id}/${sp.id}: form name is missing or duplicated (${form.name || 'empty'})`);
      else formNames.add(form.name);
      for (const key of formCoreKeys) if (!Number.isInteger(form.core?.[key])) formProblems.push(`${z.id}/${sp.id}: form Core ${key} is missing or not an integer`);
    }
  }
  add('X76', formProblems.length === 0, formProblems.length ? formProblems.join(' · ')
    : `${formNames.size} uniquely named fixed-Core forms cover real mob placements through level ${E.mob.form_level_cap}; later zones reuse the latest lineage form and Core, with Elite and Boss as rank overlays`);

  const catalogProblems: string[] = [];
  const catalogNames = new Set<string>();
  let catalogCount = 0;
  const catalogZones = E.mob.zones.filter((z) => z.levels[0] <= E.mob.form_level_cap);
  for (const z of catalogZones) {
    const zoneCatalog = (E.mob.form_catalog as any)?.[z.id] || {};
    const expectedIds = E.mob.species.map((sp) => sp.id).sort();
    const actualIds = Object.keys(zoneCatalog).sort();
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) catalogProblems.push(`zone ${z.id}: catalog does not contain every race`);
    for (const sp of E.mob.species) {
      const form = zoneCatalog[sp.id];
      if (!form) continue;
      catalogCount++;
      if (form.levels?.[0] !== z.levels[0] || form.levels?.[1] !== z.levels[1]) catalogProblems.push(`${z.id}/${sp.id}: catalog range does not match its band`);
      if (!form.name || catalogNames.has(form.name)) catalogProblems.push(`${z.id}/${sp.id}: catalog name is missing or duplicated (${form.name || 'empty'})`);
      else catalogNames.add(form.name);
      for (const key of formCoreKeys) if (!Number.isInteger(form.core?.[key])) catalogProblems.push(`${z.id}/${sp.id}: catalog Core ${key} is missing or not an integer`);
    }
  }
  const expectedCatalogCount = E.mob.species.length * catalogZones.length;
  if (catalogCount !== expectedCatalogCount) catalogProblems.push(`catalog has ${catalogCount} forms, expected ${expectedCatalogCount}`);
  for (const z of E.mob.zones.filter((zone) => zone.levels[0] > E.mob.form_level_cap)) {
    if ((E.mob.form_catalog as any)?.[z.id]) catalogProblems.push(`zone ${z.id}: catalog extends above the form cap`);
  }
  add('X77', catalogProblems.length === 0, catalogProblems.length ? catalogProblems.join(' · ')
    : `${catalogCount} uniquely named race forms cover ${E.mob.species.length} races across ${catalogZones.length} real level bands, all assigned to their gameplay zones`);

  const formDropProblems: string[] = [];
  const dropVariants = (E.mob as any).variants || {};
  const formDropRows = (E.mob as any).variant_drops || {};
  for (const z of catalogZones) for (const sp of E.mob.species) {
    const form = (E.mob.form_catalog as any)[z.id][sp.id];
    const ladder = dropVariants[sp.id] || [];
    if (form.drop_profile !== sp.id) formDropProblems.push(`${z.id}/${sp.id}: form does not reference its race drop profile`);
    if (ladder.length !== 5) formDropProblems.push(`${sp.id}: drop profile has ${ladder.length} rungs, expected 5`);
    for (const name of ladder.slice(0, 3)) if (!formDropRows[name]) formDropProblems.push(`${z.id}/${sp.id}: normal drop rung ${name} has no item/rarity/lean row`);
    for (const name of ladder.slice(3)) {
      const row = formDropRows[name];
      if (row && (typeof row.item !== 'string' || typeof row.rarity !== 'string' || typeof row.lean !== 'string')) formDropProblems.push(`${z.id}/${sp.id}: ranked drop rung ${name} has an incomplete row`);
    }
  }
  add('X78', formDropProblems.length === 0, formDropProblems.length ? formDropProblems.join(' · ')
    : `all ${catalogCount} forms inherit their race drop profile; normal rungs have junk rows and ranked rungs keep their stone/optional-junk behavior`);

  // X15 reads the maxima out of `mods.json` — the file that owns them. It used to parse the
  // "Total" column back out of mod-pool.md and compare, which made the DOC a second source of a
  // number the engine already had: the two could disagree and the doc would win. Now the
  // data is the only home and the doc is its projection.
  const modMaxOf = (label: string) => {
    const row = MODS.mods.find((m: any) => m.name === label);
    return row ? row.max : null;
  };
  const MP_RULES: [string, number][] = [
    ['Physical power flat', M.phys_flat_main_hand], ['Physical power %', M.phys_pct_main_hand],
    ['Magic power flat', M.magic_flat_main_hand], ['Magic power %', M.magic_pct_main_hand],
    ['Critical chance %', M.crit_pct_main_hand], ['Critical damage %', M.crit_damage_mod_pct],
    ['Attack speed %', M.aspd_pct], ['Accuracy %', M.accuracy_pct],
    ['Cooldown reduction %', M.cdr_pct_per_item],
    ['Max HP %', M.hp_pct_per_item], ['Elemental resistance %', M.res_pct_per_item],
    ['Max Energy Shield %', M.max_energy_shield_pct], ['Life Regeneration %', M.life_regen_pct],
    ['Mana Regeneration %', M.mana_regen_pct], ['All Resistance %', M.all_resistance_pct],
    ['Elemental alignment %', M.align_pct_per_item], ['Stat Mod flat', S.core_flat_max],
    ['Evasion flat', M.evasion_flat_t1],
    ['Armour %', M.armour_pct], ['Evasion %', M.evasion_pct],
    ['Life Regeneration flat', M.life_regen_flat], ['Mana Regeneration flat', M.mana_regen_flat],
    ['Perfect dodge %', M.perfect_dodge_pct], ['Status Alignment resistance %', M.status_resistance_pct],
    ['Chance to bleed %', M.bleed_chance], ['Chance to stun %', M.stun_chance],
    ['Block chance %', M.block_chance], ['Armour penetration %', M.armour_pen],
  ];
  const mpProblems = [];
  for (const [label, want] of MP_RULES) {
    const got = modMaxOf(label);
    if (got === null) mpProblems.push(label + ': not a Mod line in mods.json');
    else if (got !== want) mpProblems.push(label + ': mods.json ' + got + ' vs engine ' + want);
  }
  add('X15', mpProblems.length === 0, mpProblems.length ? mpProblems.join(' · ')
    : `${MP_RULES.length} Mod maxima read out of \`mods.json\` and equal the engine — the data owns the number, mod-pool.md only prints it `);

  watch('X16', L.base_drop_chance === 0.08 && K.K_LCK_DROP === 0.01,
    `the drop pins moved: Base drop ${L.base_drop_chance * 100}%/kill and K_LCK_DROP ${K.K_LCK_DROP} — a deliberate re-price must say so where the quotes live`,
    `Base drop ${L.base_drop_chance * 100}%/kill · drop_rate = 1 + Lck×${K.K_LCK_DROP} (formula-utility.md section 10 · nothing else mints items)`);
  // Mob species: the Core is an integer POINT block (DECISIONS: one Core model). A stat is live only
  // where the mob reads it: Wis feeds no mob line at all, and Int feeds magic power, so a pure-physical
  // body carries neither — those entries must be 0, and every live entry a whole non-negative number.
  const MOB = E.mob;
  const ZONES = MOB.zones;
  const liveKeys = (damage: string) => STAT_KEYS.filter((k) => k !== 'wis' && !(damage === 'physical' && k === 'int'));
  const bad = MOB.species.filter((r) => STAT_KEYS.some((k) =>
    !Number.isInteger(r.core[k]) || r.core[k] < 0 || (!liveKeys(r.damage).includes(k) && r.core[k] !== 0)))
    .map((r) => ({ name: r.name, vals: STAT_KEYS.map((k) => `${k} ${r.core[k]}`).join(' ') }));
  const zoneProblems = MOB.species.filter((r) => r.zones.some((z) => z < 1 || z > ZONES.length)).map((r) => r.name);
  const sizeProblems = MOB.species.filter((r) => r.sizes.some((s) => !MOB.sizes.some((x) => x.id === s))).map((r) => r.name);
  const speciesPower = MOB.species.map((r) => r.power_base);
  const speciesPowerMean = speciesPower.reduce((sum, value) => sum + value, 0) / speciesPower.length;
  const powerProblems: string[] = [];
  if (speciesPower.some((value) => !Number.isFinite(value) || value <= 0)) powerProblems.push('power_base must be finite and positive for every species');
  if (Math.abs(speciesPowerMean - 1) > 1e-9) powerProblems.push(`power_base mean is ${speciesPowerMean.toFixed(4)}, expected 1.00`);
  if (new Set(speciesPower).size < 4) powerProblems.push(`power_base has ${new Set(speciesPower).size} values, expected at least 4`);
  // a retired lineage may not creep back into the roster — the `deprecated_species` record is what says so
  const zombie = Object.keys(MOB.deprecated_species || {}).filter((id) => MOB.species.some((r) => r.id === id));
  if (zombie.length) zoneProblems.push(`retired lineage(s) back in the roster: ${zombie.join(', ')}`);
  add('X19', bad.length === 0 && zoneProblems.length === 0 && sizeProblems.length === 0 && powerProblems.length === 0,
    bad.length ? `a species Core block is not a whole number, is negative, or carries a dead stat: ${bad.map((r) => `${r.name} (${r.vals})`).join(' · ')}`
      : zoneProblems.length ? `species listed in a zone outside 1-${ZONES.length}: ${zoneProblems.join(', ')}`
        : sizeProblems.length ? `species references a body class that does not exist: ${sizeProblems.join(', ')}`
          : powerProblems.length ? powerProblems.join(' · ')
            : `${MOB.species.length} species × ${MOB.sizes.length} body classes · Core blocks stay whole, Wis is 0 everywhere and Int is 0 on physical bodies · power_base spans ${Math.min(...speciesPower).toFixed(2)}-${Math.max(...speciesPower).toFixed(2)} with a ${speciesPowerMean.toFixed(2)} mean · ${Object.keys(MOB.deprecated_species || {}).length} retired lineage(s) stay out of the roster · accuracy spans ×${Math.min(...MOB.species.map((r) => r.accuracy_mult)).toFixed(2)}-×${Math.max(...MOB.species.map((r) => r.accuracy_mult)).toFixed(2)}, so the Evasion Cap ${E.caps.evasion} answers to the gear line against the floor and not against the ceiling (X20)`);

  // The species mix is what makes the Evasion Cap answerable, so guard a floor and a ceiling.
  // X20's question changed shape with the Agi ruling: Agi IS the rating now, so what must hold is
  // that a maxed Agi build caps against the accuracy floor, while the same rating lands well under
  // the Cap against the accuracy ceiling — and an even-split Agi lands lower still.
  const accMults = MOB.species.map((r) => r.accuracy_mult);
  const floorRace = MOB.species.find((r) => r.accuracy_mult === Math.min(...accMults));
  const ceilRace = MOB.species.find((r) => r.accuracy_mult === Math.max(...accMults));
  // ONE Evasion flat line at its T1 ceiling, lifted by one Evasion % line — the gear a real build wears
  const floorZone = floorRace!.zones[0];
  const ceilingZone = ceilRace!.zones[ceilRace!.zones.length - 1];
  const formName = (sp: any, zoneId: number) => (E.mob.forms as any)[zoneId]?.[sp.id]?.name || sp.name;
  const evVs = (sp: any, zoneId: number) => eng.evasionChance(eng.evasionRating(CEIL, M.evasion_flat_t1, M.evasion_pct), eng.mobAcc(eng.coreOf(sp, 'dex', zoneId), sp.accuracy_mult));
  // the floor build — Agi at the split point, which is what a real build holds
  const midVs = (sp: any, zoneId: number) => eng.evasionChance(eng.evasionRating(SPLIT, M.evasion_flat_t1, M.evasion_pct), eng.mobAcc(eng.coreOf(sp, 'dex', zoneId), sp.accuracy_mult));
  add('X20', evVs(floorRace!, floorZone) >= E.caps.evasion - 0.5 && midVs(ceilRace!, ceilingZone) < E.caps.evasion - 1,
    `Evasion Cap ${E.caps.evasion} is reachable against the low-accuracy form (${formName(floorRace!, floorZone)} · ×${floorRace!.accuracy_mult} → ${f1(evVs(floorRace!, floorZone))}% at Agi ${f0(CEIL)} + gear) and is not free against the highest-accuracy form (${formName(ceilRace!, ceilingZone)} · ×${ceilRace!.accuracy_mult} → ${f1(midVs(ceilRace!, ceilingZone))}% at Agi ${f0(SPLIT)}); species forms supply the fixed Core while zone bands supply progression`);

  // Mob evasion is derived from the species Dex line, and the derivation must not be a rebalance
  const evRef = DERIVED.mob_evasion_ref;
  const BODY_TOPUP = (id: string) => 1 + ((MOB.sizes.find((s: any) => s.id === id) || {}).evasion_pct ?? 0) / 100;
  const evMean = eng.mobEvasion(eng.MEAN_SPECIES_DEX);
  const evList = eng.SPECIES_EVASION.map((r) => r.evasion);
  const evLo = Math.min(...evList), evHi = Math.max(...evList);
  const hits = eng.SPECIES_EVASION.map((r) => eng.hitChance(eng.playerAccuracy(eng.statAt(r.level), 0), r.evasion) * 100);
  const topMobAcc = eng.statAt(S.level_cap) * K.K_DEX_ACC * Math.max(...MOB.species.map((r) => r.accuracy_mult));
  const mobHitFullDex = (topMobAcc / (topMobAcc + eng.statWithItems(S.item_slots) * K.K_EVASION)) * 100;
  const evProblems = [];
  if (!(K.K_EVASION > 0)) evProblems.push('K_EVASION missing or not positive');
  // A mob's stat block carries no level term (owner ruling): the body's base Evasion percent is the
  // only thing added on top of the flat Core stat line, so the anchors left are the
  // mean-species-on-Medium line above and the published hit chances below.
  if (Math.abs(evRef - evMean) > 0.05) evProblems.push(`the published reference mob (${f1(evRef)}) is not the mean species line (${f1(evMean)})`);
  // The base percent shape is the owner's rule: Small carries the most, Medium a little, and nothing
  // above Medium carries any — a big body simply presents all of itself.
  if (!(BODY_TOPUP('small') > BODY_TOPUP('medium') && BODY_TOPUP('medium') > 1))
    evProblems.push(`the body base Evasion percent does not fall Small > Medium > nothing (${BODY_TOPUP('small')} · ${BODY_TOPUP('medium')})`);
  const helped = [...MOB.sizes, { id: 'elite', evasion_pct: E.mob.elite.evasion_pct }].filter((s: any) => s.id !== 'small' && s.id !== 'medium' && s.evasion_pct !== 0);
  if (helped.length) evProblems.push(`${helped.map((s: any) => `${s.id} ${s.evasion_pct}%`).join(', ')} — a body above Medium carries a base percent, so the big target is priced against the player instead of getting no help`);
  if (!(evLo < evRef && evRef < evHi)) evProblems.push(`species evasion is degenerate: range ${f0(evLo)}-${f0(evHi)} does not straddle the reference ${f0(evRef)}`);
  // The two hit anchors are pacing targets the owner reads by eye, not conditions: they move with
  // any balance pass and only the eye can say whether the new figure is the one they meant.
  const evTargets = [];
  if (Math.min(...hits) < 70 || Math.max(...hits) > 90) evTargets.push(`same-level, no-gear hit chances leave the 70-90% band (${f1(Math.min(...hits))}-${f1(Math.max(...hits))}%)`);
  if (mobHitFullDex < 40) evTargets.push(`a Full-Dex player is too untouchable: the top accuracy tier lands only ${f1(mobHitFullDex)}%`);
  if (Math.round(DERIVED.ref_build_hit_pct) !== E.build.hit_chance_pct) evProblems.push(`build.hit_chance_pct ${E.build.hit_chance_pct} vs engine ${Math.round(DERIVED.ref_build_hit_pct)} — run \`node tools/check.ts --sync\` to re-publish it`);
  soft('X21', evProblems.length === 0,
    evProblems.length ? evProblems.join(' · ')
      : `form Evasion = its fixed Core Dex × K_EVASION ${K.K_EVASION} × body base percent (Small +20% · Medium +10% · Large 0%) · reference (mean form, Medium body) ${f1(evRef)} · same-level no-gear hit chances ${f1(Math.min(...hits))}-${f1(Math.max(...hits))}% · a Full-Dex player still eats ${f1(mobHitFullDex)}% of the top accuracy tier before Evasion`);
  watch('X21t', evTargets.length === 0, evTargets.join(' · '),
    `hit anchors by eye: a 0-item player lands ${f1(Math.min(...hits))}-${f1(Math.max(...hits))}% across the species (70-90 band) and a Full-Dex player still eats ${f1(mobHitFullDex)}% from the top accuracy tier (40 floor)`);

  // Armour: the Str line both sides, and it must never wall the player
  const armProblems = [];
  if (!(K.K_ARMOUR > 0 && K.armour_divisor > 0)) armProblems.push('K_ARMOUR or armour_divisor missing');
  const bossCut = DERIVED.armour_vs_zone9_boss * 100, trashCut = DERIVED.armour_vs_zone9_trash * 100;
  // The band tracks the boss damage multiplier. A PoE ratio cuts a fixed Str armour line less of a
  // bigger hit, and boss damage is now forced up by the G5 gate (mob.sizes boss ps -> 16, SV6), so
  // the share armour covers falls by construction. The floor is where armour still matters against
  // a boss and the ceiling is where it would wall one; the trash line above is the real test.
  // The floor moved 25% → 10% for the ×16 boss, 10% → 5% when Core Stat % retired,
  // and 55% → 50% with the re-base (ceiling 535 → 433): the armour line is Str-driven while
  // the trash hit it answers is anchored on mob DPS, which did not move.
  if (bossCut < 5 || bossCut > 40) armProblems.push(`full-Str armour cuts the zone-9 boss physical hit by ${f1(bossCut)}% — outside the 5-40% design band`);
  if (trashCut < 50) armProblems.push(`armour does not answer trash mobs (${f1(trashCut)}% cut)`);
  // The mob's own armour reads the mob's integer Core stat, not the player's line: mobs carry no
  // level term, so `statAt(80)` here was a stale read of the player's curve.
  const formRows = Object.entries(E.mob.forms as Record<string, Record<string, any>>)
    .flatMap(([zoneId, forms]) => Object.values(forms).map((form) => ({ zoneId: Number(zoneId), form })));
  const hardestArmour = formRows.reduce((best, row) => row.form.core.str > best.form.core.str ? row : best, formRows[0]);
  const mobArmour = Math.max(...formRows.map((row) => row.form.core.str * K.K_ARMOUR));
  const mobArmourCut = (mobArmour / (mobArmour + K.armour_divisor * DERIVED.phys)) * 100;
  if (mobArmourCut > 10) armProblems.push(`the hardest-armoured mob cuts a max physical hit by ${f1(mobArmourCut)}% — armour is walling the player`);
  watch('X22', armProblems.length === 0, armProblems.length ? armProblems.join(' · ')
    : `armour bands held`,
    `armour = Str × ${K.K_ARMOUR} both sides · reduction = armour ÷ (armour + ${K.armour_divisor} × raw physical) · Str ${f0(CEIL)} = ${f0(DERIVED.armour_ceil)} armour cuts the zone-9 boss physical hit ${f1(bossCut)}% and a zone-9 trash hit ${f1(trashCut)}% · the hardest form armour (${f0(mobArmour)} · ${hardestArmour.form.name}, zone ${hardestArmour.zoneId}) costs a max physical hit only ${f1(mobArmourCut)}%`);

  // The mob roster: every legal zone × species × body entry has to exist and be playable
  const ROWS = eng.mobRoster();
  const rp: string[] = [];
  if (E.mob.species.length !== E.mob.species_target) rp.push(`${E.mob.species.length} species, not ${E.mob.species_target}`);
  if (ROWS.length < 100) rp.push(`only ${ROWS.length} roster rows (100+ required)`);
  const perZone: Record<number, number> = {};
  for (const z of ZONES) perZone[z.id] = ROWS.filter((r) => r.zone === z.id).length;
  for (const z of ZONES) {
    if (perZone[z.id] < 5) rp.push(`zone ${z.id} has only ${perZone[z.id]} entries`);
    const boss = E.mob.bosses.find((b) => b.zone === z.id);
    if (!boss) rp.push(`zone ${z.id} has no boss`);
    else {
      const bs = E.mob.species.find((r) => r.id === boss.species);
      if (!bs) rp.push(`zone ${z.id} boss names an unknown species ${boss.species}`);
      else if (!bs.zones.includes(z.id)) rp.push(`zone ${z.id} boss ${bs.name} does not live in that zone`);
    }
  }
  for (const sp of E.mob.species) {
    if (!sp.zones.length) rp.push(`${sp.name} is placed in no zone`);
    for (const s of sp.sizes) if (!ZONES.some((z) => sp.zones.includes(z.id))) rp.push(`${sp.name} has a body but no zone`);
    if (!(E.elements.order as string[]).includes((sp as any).element)) rp.push(`${sp.name} owns Element ${(sp as any).element}, which is not a declared Element`);
  }
  for (const sp of E.mob.species) if (typeof sp.carries_weapon !== 'boolean') rp.push(`${sp.name} has no carries_weapon ruling`);
  for (const z of ZONES) if (z.id > 1 && !ROWS.some((r) => r.zone === z.id && r.weapon)) rp.push(`zone ${z.id} has no weapon-carrying lineage, so no weapon could ever drop there`);
  for (const r of ROWS) {
    const sp = E.mob.species.find((x) => x.id === r.speciesId)!;
    if (/Elite/.test(r.kind)) {
      if (!sp.sizes.includes('large')) rp.push(`Elite ${r.id}: ${sp.name} has no Large body to flag`);
      if (Math.abs(r.hpBaseTo - eng.mobHpAt(r.level) * E.mob.elite.hp) > 1) rp.push(`Elite ${r.id} Base HP is not the curve at its own level ×${E.mob.elite.hp}`);
    } else if (/Boss/.test(r.kind)) {
      if (Math.abs(r.hpBaseTo - eng.mobHpAt(r.level)) > 1) rp.push(`Boss ${r.id} Base HP is not mob_HP at its own level — body classes no longer scale HP`);
    } else {
      if (Math.abs(r.hpBaseTo - eng.mobHpAt(r.level)) > 1) rp.push(`${r.id} Base HP does not equal the curve at its own level — body classes no longer scale HP`);
    }
  }
  add('X23', rp.length === 0, rp.length ? rp.join(' · ')
    : `${ROWS.length} roster rows from ${E.mob.species.length} species × 3 body classes + ${ROWS.filter((r) => /Elite/.test(r.kind)).length} Elite + ${ROWS.filter((r) => /Boss/.test(r.kind)).length} named bosses · every zone 6+ entries and exactly one boss · normal and Elite spawns inherit their species Element; each Boss reads its declared Element profile · zone entry counts ${ZONES.map((z) => `${z.id}:${perZone[z.id]}`).join(' ')}`);

  // X61 · the mob sheet is a VIEW (`tools/wiki.ts`), so every cell it prints must agree with the engine
  // the sheet reads it from — the four calls are `mobRoster()`, `mobEvasion()`, `mobResByElementOf()`
  // and `dropChance()`. The roster builds its columns inline while the sheet calls the named functions,
  // so a divergence between the two paths is a wrong cell nothing else catches.
  {
    const sh: string[] = [];
    const fin = (x: any) => typeof x === 'number' && Number.isFinite(x);
    const CORE_STATS = ['str', 'vit', 'dex', 'agi', 'wis', 'int', 'lck'];
    for (const r of ROWS) {
      const z = ZONES.find((x) => x.id === r.zone);
      const sp = E.mob.species.find((x) => x.id === r.speciesId)!;
      if (!z || !sp) { sh.push(`${r.id} names a missing zone or species`); continue; }
      const elite = /Elite/.test(r.kind), boss = /Boss/.test(r.kind);
      const bossProfile = boss ? (E.mob.bosses as any[]).find((entry) => entry.zone === z.id) : null;
      if (boss && !bossProfile) { sh.push(`${r.id} has no boss profile`); continue; }
      const bodyId = elite ? 'large' : boss ? 'boss' : String(r.kind).toLowerCase();
      const size = eng.sizeById(bodyId)!;
      // every column the sheet reads must be a real number — a blank cell is the defect this catches
      for (const k of ['hpFrom', 'hpTo', 'hpBaseFrom', 'hpBaseTo', 'vit', 'manaFrom', 'manaTo', 'ps', 'acc', 'ev', 'armour', 'res', 'crit', 'align', 'dodge', 'xpFrom', 'xpTo'])
        if (!fin((r as any)[k])) sh.push(`${r.id}.${k} is not a finite number`);
      // Core Stat cell: the seven-stat block the sheet prints in full, every value a whole number
      const block = r.core || eng.mobStatsOf(sp.id, z.id);
      const expectedCore = bossProfile?.core || eng.mobStatsOf(sp.id, z.id);
      if (CORE_STATS.some((k) => !fin(block[k]))) sh.push(`${r.id} Core Stat block is missing a stat`);
      if (CORE_STATS.some((k) => !Number.isInteger(block[k]))) sh.push(`${r.id} Core Stat block carries a fraction (${CORE_STATS.map((k) => `${k} ${block[k]}`).join(' · ')})`);
      if (CORE_STATS.some((k) => block[k] !== Number(expectedCore[k] || 0))) sh.push(`${r.id} Core differs from its fixed species/Boss profile`);
      // HP must add back up: Base HP + the flat level grant + the Core Vit bonus = HP, at both edges
      const hpGrant = (lv: number) => LG.hp_per_level * (lv - 1) + r.vit * K.K_VIT_HP;
      if (Math.abs(r.hpBaseFrom + hpGrant(r.levels[0]) - r.hpFrom) > 1e-6 || Math.abs(r.hpBaseTo + hpGrant(r.levels[1]) - r.hpTo) > 1e-6)
        sh.push(`${r.id} Base HP + level grant + Vit bonus does not equal HP (${f1(r.hpBaseFrom)}+${f1(hpGrant(r.levels[0]))} vs ${f1(r.hpFrom)})`);
      if (r.hpBaseFrom <= 0 || r.hpBaseTo <= 0)
        sh.push(`${r.id} Base HP is not positive (${f1(r.hpBaseFrom)}-${f1(r.hpBaseTo)}) — the Vit bonus is eating the whole curve`);
      // res cell: the sheet prints the headline and every Element — the headline IS the profile mean
      const prof = r.resByElement || eng.mobResByElementOf(sp, z.id);
      const mean = (E.elements.order as string[]).reduce((t, el) => t + (prof[el] || 0), 0) / (E.elements.order as string[]).length;
      if (Math.abs(mean - r.res) > 0.05) sh.push(`${r.id} res ${f1(r.res)} is not the profile mean ${f1(mean)}`);
      // Armour cell: the roster's inline Str line must equal the engine's own `armourOf`
      if (Math.abs(eng.armourOf(block.str) - r.armour) > 0.5)
        sh.push(`${r.id} Armour ${f1(r.armour)} vs armourOf() ${f1(eng.armourOf(block.str))}`);
      // PS cell: the roster's column rebuilt off the curve, the body class and the species term
      const mult = elite ? E.mob.elite.ps : size.ps / eng.zoneBodyFactor(z.id);
      const powerProfile = bossProfile ? { ...sp, core: bossProfile.core, _fixedCore: bossProfile.core, damage: bossProfile.damage } : sp;
      const speciesTerm = eng.speciesPowerOf(powerProfile, z.id) / eng.zonePowerFactor(z.id);
      const ps = eng.mobPsAt(r.level) * mult * speciesTerm;
      if (Math.abs(ps - r.ps) > 0.5) sh.push(`${r.id} PS ${f1(r.ps)} vs the curve at its own level × body × species ${f1(ps)}`);
      // the drop cell the sheet prints names a band, and every band must actually pay gear
      const band = String(z.quality || 'low').split(' ')[0];
      if (!(eng.dropChance(band) > 0)) sh.push(`${r.id} band ${band} pays no gear drop`);
      // body class must resolve, or the sheet's Size column reads a missing row
      if (!size) sh.push(`${r.id} body ${bodyId} is not a size`);
    }
    add('X61', sh.length === 0, sh.length ? sh.slice(0, 6).join(' · ')
      : `the mob sheet is a view of the engine: all ${ROWS.length} roster rows carry every column it prints, Boss rows use their own Core and Element profile, and Armour and PS rebuild off the same Core and the mob curve × body factor × power term — so a wrong cell fails here instead of only showing on the wiki`);
  }

  // Energy Shield: the caster's second pool, sized so it supplements HP instead of doubling it
  const esProblems = [];
  if (!(M.energy_shield_flat_t1 > 0)) esProblems.push('energy_shield_flat_t1 missing');
  if (Math.abs(DERIVED.es_recover_sec - 100 / ES.regen_pct) > 0.01) esProblems.push(`ES full-recovery ${f1(DERIVED.es_recover_sec)} sec is not 100 ÷ regen_pct`);
  // The 15-30% share band was written when the pool was a stat line (Int x K_INT_ES) that
  // followed the stat ceiling while the caster's HP it is compared against was level-only and did
  // not. Wis feeds the pool flat now (owner ruling, `K_WIS_ES`) and the gear ES lines ride on top:
  // the shipped share prints openly (B15), the client sums the line across items, and survival does
  // not spend the pool at all — so the share is REPORTED, not gated, until a rebalance re-prices the
  // line range (an owner decision, never a side effect). What stays hard is the mechanics: a real
  // pool, the exact clock, and player-only.
  if (!(ES.delay_sec >= 3 && ES.delay_sec <= 8)) esProblems.push(`es delay ${ES.delay_sec} sec is outside the 3-8 sec band`);
  if (!ES.player_only || ROWS.some((r) => r.es)) esProblems.push('Energy Shield leaked to the mob side (it would double-count mob_HP · checks.md H1)');
  add('X25', esProblems.length === 0, esProblems.length ? esProblems.join(' · ')
    : `Energy Shield is Wis plus gear (owner ruling): Wis ${f0(eng.statAt(S.level_cap))} × ${K.K_WIS_ES} and ${M.energy_shield_flat_t1} flat, × (1 + ${M.max_energy_shield_pct}%) = ${f0(DERIVED.es_pool)} at the ceiling, and regen is ${ES.regen_pct}% of the pool per sec — ${f1(DERIVED.es_regen)}/sec after ${ES.delay_sec} sec without a hit, so the base rate alone returns the whole pool in ${f1(DERIVED.es_recover_sec)} sec · an \`es_regen\` skill, Mod or passive amplifies the rate · ${f1(DERIVED.es_share_of_hp * 100)}% of a caster build's ${f0(DERIVED.es_cast_hp)} HP · **player-only** so mob_HP stays the single survivability anchor`);
  watch('X25t', ES.regen_pct >= 2 && ES.regen_pct <= 8 && ES.delay_sec >= 3 && ES.delay_sec <= 8,
    `the pool's clock moved off its pacing bands: regen ${ES.regen_pct}%/sec (2-8) · delay ${ES.delay_sec} sec (3-8)`,
    `the pool's clock sits in its pacing bands: regen ${ES.regen_pct}%/sec (2-8) · delay ${ES.delay_sec} sec (3-8)`);

  // Race resistance: a race owns one Element and answers it at the flat race res; no Element
  // counters another, so every other Element meets no res at all (mob.resist_rules · X54)
  {
    const order = E.elements.order as string[];
    const rp: string[] = [];
    for (const sp of E.mob.species) {
      if ((sp as any).resist) rp.push(`${sp.id} still carries a resist profile — the advantage between Elements is cancelled`);
      for (const z of sp.zones) {
        const map = eng.mobResByElementOf(sp, z);
        for (const el of order) {
          const want = el === (sp as any).element ? E.mob.race_res_pct : 0;
          if (Math.abs(map[el] - want) > 1e-9) rp.push(`${sp.id} in zone ${z} resists ${el} at ${f1(map[el])} — not the ${f1(want)} the race shape states`);
        }
      }
    }
    add('X54', rp.length === 0, rp.length ? rp.join(' · ')
      : `every one of ${E.mob.species.length} races owns one Element (\`mob.species[].element\`) and answers it at a flat \`mob.race_res_pct\` in every zone it lives in · no Element counters another: the other four meet no res at all, and no profile tilts the Vit line`);
  }

  // Mobs carry no skills until the skill/mechanics system lands (mob.skills_note)
  {
    const sk: string[] = [];
    if (E.mob.skills_enabled) sk.push('skills_enabled is true but the mob skill system is not built');
    for (const sp of E.mob.species) if ((sp as any).skills) sk.push(`${sp.id} carries a skill field while skills_enabled is false`);
    add('X55', sk.length === 0, sk.length ? sk.join(' · ')
      : `mobs carry no skills — a species' damage tag, its Element and its trait mechanics (X74) are the whole of its behaviour; ${E.mob.species.length} species checked, none carries a skill field while skills_enabled is false`);
  }

  // Zone identity lives in `mob.zones` alone. Bands repeat every three zones, so each band owns
  // however many zones fall in its 30-level window — read off the zone list, never typed.
  const zp: string[] = [];
  const GROUP_AVG: Record<string, string> = { low: '1-2', mid: '2-3', high: '3-5' };
  const ZONES_PER_BAND = Math.ceil(ZONES.length / 3);
  for (const band of Object.keys(GROUP_AVG)) {
    const inBand = ZONES.filter((z) => z.quality.startsWith(band));
    if (inBand.length !== ZONES_PER_BAND) zp.push(`band ${band} owns ${inBand.length} zones, not ${ZONES_PER_BAND}`);
    for (const z of inBand) {
      if (z.group !== GROUP_AVG[band]) zp.push(`zone ${z.id} group "${z.group}" does not match the ${band} band rule (${GROUP_AVG[band]})`);
    }
  }
  add('X26', zp.length === 0, zp.length ? zp.join(' · ')
    : `zone identity has one home — engine.json mob.zones: the 3 quality bands split the ${ZONES.length} zones evenly and every zone's group average matches its band`);

  // B2: mob_HP(L) is defined at every level, not only the published anchors (X37). The curve is
  // anchored at each zone edge and interpolated inside the zone, so a mob at an unlisted level
  // still has an HP; mob_PS derives from the same line. This gate also pins the published HP and mob_PS rows.
  {
    const p = [];
    let prev = -Infinity;
    for (let L = 1; L <= S.level_cap; L++) {
      const h = eng.mobHpAt(L);
      if (!(h > prev)) p.push(`mob_HP(${L}) ${f1(h)} is not above level ${L - 1} (${f1(prev)})`);
      prev = h;
    }
    for (const z of ZONES) {
      if (Math.abs(eng.mobHpAt(z.levels[0]) - z.hp[0]) > 0.5) p.push(`zone ${z.id} start HP ${f1(eng.mobHpAt(z.levels[0]))} vs data ${f0(z.hp[0])}`);
      if (Math.abs(eng.mobHpAt(z.levels[1]) - z.hp[1]) > 0.5) p.push(`zone ${z.id} end HP ${f1(eng.mobHpAt(z.levels[1]))} vs data ${f0(z.hp[1])}`);
    }
    // The species power term divides out exactly: each zone's spawn-weighted mean species
    // multiplier is 1, so the zone's average mob IS the published curve and no edge, timeline,
    // ladder or survival number moves when a species Base or stat vector is re-tuned.
    for (const z of ZONES) {
      let w = 0, sum = 0;
      for (const sp of E.mob.species.filter((x) => x.zones.includes(z.id))) for (const sid of sp.sizes) {
        const weight = E.mob.spawn_weights[sid] || 0;
        if (!weight) continue;
        w += weight; sum += weight * eng.speciesPsMult(z.id, sp.id);
      }
      const mean = w ? sum / w : 1;
      if (Math.abs(mean - 1) > 1e-9) p.push(`zone ${z.id} species power mean ${mean} is not 1`);
    }
    add('X37', p.length === 0, p.length ? p.join(' · ')
      : `mob_HP(L) is anchored at every zone edge and linearly interpolated inside a zone, so every level 1-${S.level_cap} has a value (${f0(eng.mobHpAt(1))} → ${f0(eng.mobHpAt(S.level_cap))}, strictly rising) · mob_PS(L) is \`typical_gear_DPS(L) ÷ ${K.mob_damage_divisor}\` for the zone's AVERAGE mob, and each species moves it by (\`power_base + ${K.K_MOB_PS_STAT} ×\` the Str/Int its \`damage\` tag reads) over the zone mean`);
  }

  // One home for every Cap: core-stats.md is the list a player reads, so it must equal the data.
  const CAP_LINES = [
    ['aspd', /Attack speed - % .+ Cap (\d+)/],
    ['evasion', /^Evasion - % Cap (\d+)/],
    ['perfect_dodge', /^Perfect dodge - % Cap (\d+)/],
    ['cdr', /^Cooldown reduction - % Cap (\d+)/],
    ['elem_res', /^Elemental resistance .+Cap (\d+) per Element/],
  ];
  const un = [
    ['crit_chance', /^Critical chance - % (no Cap)/],
    ['accuracy', /^Accuracy - numeric value, (no Cap)/],
    ['alignment', /^Elemental alignment - % (no Cap)/],
  ];
  // · the Gear Mod ladder is bounded by the published ceiling of the very line it raises, the
  // same `mod_max` row `tools/loot.ts` rolls it from — so +Cap can never out-print a T1 rolled line.
  const GM = E.craft.gear_mod_per_level, GM_CAP = E.craft.upgrade_cap;
  const SCHOOL = { 'Armour flat': E.mod_max.armour_flat_t1, 'Evasion flat': E.mod_max.evasion_flat_t1, 'Energy Shield flat': E.mod_max.energy_shield_flat_t1 };
  const BINDING = Math.min(...Object.values(SCHOOL));
  add('X42', GM > 0 && GM === Math.floor(BINDING / GM_CAP),
    `one Upgrade step is ${GM}, so a full ladder is ${GM * GM_CAP} — exactly the smallest school ceiling (${BINDING}, Evasion flat) and ${Object.entries(SCHOOL).map(([k, v]) => `${k} ${Math.round(GM * GM_CAP / v * 100)}%`).join(' · ')} of theirs (item-base.md sets the school · checks.md H1 pays for the uplift, not through mob_HP, which measured as already inside the pacing)`);
  // · block is the second avoidance layer and the mace's stun line is a second stun source.
  // Both are OPEN-ENDED now (owner ruling): no Cap holds either line, so there is nothing to reach.
  const shieldT1 = E.mod_max.block_chance, maceT1 = E.mod_max.stun_chance;
  const alignReach = DERIVED.align_path;   // Alignment has no Cap (owner ruling)
  const stunAlignOnly = alignReach * K.K_STUN_PER_ALIGN;
  soft('X43', E.caps.block == null && E.caps.stun == null,
    `block and stun carry no Cap in the data (caps.block ${E.caps.block} · caps.stun ${E.caps.stun}, owner ruling): the shield's line 1 blocks for ${shieldT1} (mods.json) and keeps climbing; the lightning stun chance is Alignment ${f1(stunAlignOnly)} + the mace line ${maceT1} = ${f1(stunAlignOnly + maceT1)}, uncapped`);
  // · a Stat Mod line bakes one of the seven Core stats at drop, so the pool lives in the Mod
  // row (`mods.json` `rolls`) — the data owns all seven.
  const statRolls = ((MODS.mods.find((m: any) => m.id === 'stat_mod_flat') || {}).rolls) || [];
  const SEVEN_STATS = ['str', 'vit', 'dex', 'agi', 'wis', 'int', 'lck'];
  const missingStats = SEVEN_STATS.filter((s) => !statRolls.includes(s));
  add('X44', statRolls.length === SEVEN_STATS.length && missingStats.length === 0,
    missingStats.length ? `stat_mod_flat does not roll ${missingStats.join(', ')}`
      : `Stat Mod flat rolls one of the ${statRolls.length} Core stats at drop (${statRolls.join(' · ')}) — the data owns the pool`);
  // · a Mod line can only roll if it also carries a drop weight, or `weightOf` reads `undefined`
  // and the pool's weighted pick goes NaN. Every `mods.json` row must have a `mod_weights` row, and the
  // Stat Mod family (`group: "Stat Mod"`) shares the one slot that `blockedBy` keeps to a single line.
  const weightIds = new Set(E.mod_weights.rows.flatMap((r: any) => r.ids));
  const unweighted = MODS.mods.map((m: any) => m.id).filter((id: any) => !weightIds.has(id));
  const statFamily = MODS.mods.filter((m: any) => m.group === 'Stat Mod');
  add('X45', unweighted.length === 0 && statFamily.length >= 2,
    unweighted.length ? `Mods with no \`mod_weights\` row: ${unweighted.join(', ')}`
      : `all ${MODS.mods.length} Mod lines carry a \`mod_weights\` row, so a pool pick always resolves a weight · the Stat Mod slot is one line shared by ${statFamily.map((m: any) => m.name).join(' · ')} `);
  // The endgame craft target is now the engine's own number, not a claim in prose
  // B21 · the three stones the ladder costs must be reachable, and the new income must sit in the
  // pacing family the other crafts were priced in (a full Upgrade set against a full Ascend set).
  const upKills = STONE.upgrade_stones_full_set / perKillK(STONE.quality_stones_per_hr);
  const corruptPerKill = perKillK(STONE.corrupt_stones_per_hr);
  watch('X41t', upKills <= 7 * ascKills && corruptPerKill <= tierPerKill / 4,
    `the stone ladder left its pacing family: a full +15 set is ${f0(upKills)} kills against Ascend's ${f0(ascKills)} (≤7×) and one gamble is ${corruptPerKill.toFixed(5)}/kill against a tier stone's ${tierPerKill.toFixed(5)} (≤¼)`,
    `Quality ${perKillK(STONE.quality_stones_per_hr).toFixed(4)}/kill · Repair ${perKillK(STONE.repair_stones_per_hr).toFixed(4)}/kill · Corrupt ${corruptPerKill.toFixed(5)}/kill — a full +15 set is ${f0(upKills)} kills against Ascend's ${f0(ascKills)}, and one gamble is under a quarter of a tier stone's per-kill share, while the flow the prices were set against reads junk ${junkPerKill.toFixed(4)}/kill (F5) and tier ${tierPerKill.toFixed(5)}/kill (F7)`);
  soft('X41', STONE.quality_stones_per_hr > 0 && STONE.repair_stones_per_hr > 0 && STONE.corrupt_stones_per_hr > 0,
    `the three ladder stones must each carry a flow: Quality ${STONE.quality_stones_per_hr} · Repair ${STONE.repair_stones_per_hr} · Corrupt ${STONE.corrupt_stones_per_hr} an hour — a zero starves a verb the bench sells`);
  watch('X30', Math.abs(ascKills - 1491) <= 150, `a full Ascend set is ${f0(ascKills)} kills — off the ~1,500-kill pace the craft prices were set against (±150)`,
    `a full ${E.craft.ascend_items_per_set}-piece Ascend set costs ${E.craft.ascend_items_per_set * E.craft.ascend_add_stones} Add + ${E.craft.ascend_items_per_set * E.craft.ascend_tier_stones} tier stones; the drop lines pay Add ${addPerKill.toFixed(5)}/kill and tier ${tierPerKill.toFixed(5)}/kill, so the set is ${f0(ascKills)} kills (Add binds: ${f0(ascAddKills)} vs tier ${f0(ascTierKills)}) — the pace is kills, never an hour (the kills-not-hours rule · concept.md)`);
  // The two whole-piece stones are gated as the notes say: Polish is one step tighter than Replace on
  // the Elite half and keeps its Boss half, Reforge is bosses only on half the Corrupt stone's chance.
  const PO = E.loot.polish_stone_sources, RF = E.loot.reforge_stone_sources;
  add('X62', PO.elite_polish_chance === E.loot.replace_stone_sources.elite_replace_chance / 2 &&
      PO.boss_polish_chance === E.loot.replace_stone_sources.boss_replace_chance &&
      PO.boss_polish_stones === E.loot.replace_stone_sources.boss_replace_chance * 2 &&
      RF.boss_reforge_chance === E.loot.corrupt_stone_sources.boss_corrupt_chance / 2 &&
      STONE.polish_stones_per_hr > 0 && STONE.reforge_stones_per_hr > 0 &&
      STONE.polish_presses_full_set === E.craft.ascend_items_per_set &&
      E.craft.polish_stones_per_use === 1 && E.craft.reforge_stones_per_use === 1,
    `Polish elite ${PO.elite_polish_chance} = half Replace's ${E.loot.replace_stone_sources.elite_replace_chance}, boss ${PO.boss_polish_chance} = Replace's gate, ${PO.boss_polish_stones} a boss · Reforge boss ${RF.boss_reforge_chance} = half Corrupt's ${E.loot.corrupt_stone_sources.boss_corrupt_chance} and no Elite pays one · Polish ${perKillK(STONE.polish_stones_per_hr).toFixed(5)}/kill and Reforge ${perKillK(STONE.reforge_stones_per_hr).toFixed(5)}/kill, one press a piece so a set is ${STONE.polish_presses_full_set} presses · 1 stone a use each`);

  // The two damage ladders (owner ruling): each bucket multiplies its own ladder once, never the
  // other's, and it rides the weapon pool only. The rows, the weights and the pools are data reads;
  // the no-cross rule is a read of the engine's own `ladderMult` and the skill model's own `perPress`.
  {
    const BUCKET = [['attack_damage_pct', 'Attack damage %'], ['spell_damage_pct', 'Spell damage %']] as any[];
    const pools = framePools();
    const weapon = weaponPools();
    const bp: string[] = [];
    for (const [id, name] of BUCKET) {
      const mod = MODS.mods.find((m: any) => m.id === id) as any;
      if (!mod) bp.push(`${name} is not a mods.json line`);
      else if (!mod.pct) bp.push(`${name} is not a % line`);
      if (!weightIds.has(id)) bp.push(`${name} has no mod_weights row`);
      if (!weapon.has(name)) bp.push(`${name} is not in the weapon pool`);
      const on = ARMOUR_SLOTS.filter((s: string) => (pools[s] || new Set()).has(name));
      if (on.length) bp.push(`${name} reaches ${on.join(' · ')}`);
    }
    if (eng.ladderMult('phys', 10, 20) !== 1.10) bp.push('the phys ladder does not read Attack damage %');
    if (eng.ladderMult('magic', 10, 20) !== 1.20) bp.push('the magic ladder does not read Spell damage %');
    if (eng.ladderMult('phys', 0, 0) !== 1 || eng.ladderMult('magic', 0, 0) !== 1) bp.push('an empty bucket is not x1');
    const SKM = createSkillModel(readJson(path.join(ROOT, 'tools/data/skills.json')), E);
    const SKJ = readJson(path.join(ROOT, 'tools/data/skills.json'));
    const rowsOf = (basis: string) => (SKJ.skills as any[]).filter((r: any) => r.basis === basis && r.base_flat != null && r.eff != null);
    const physRow = rowsOf('phys')[0] as any, magicRow = rowsOf('magic')[0] as any;
    if (!physRow || !magicRow) bp.push('the roster has no phys-basis and magic-basis row to press against');
    else {
      // `perPress` answers null when the row cannot press for that build; a 0 makes the ratio fail loudly
      const at = (s: any, o: any) => (SKM.perPress(s, { ...eng.REF.glass, ...o }) ?? 0) as number;
      const cross = [
        ['a phys press', at(physRow, { attackPct: 20 }) / at(physRow, {}), 1.20],
        ['a magic press', at(magicRow, { spellPct: 20 }) / at(magicRow, {}), 1.20],
        ['a phys press carrying the spell bucket', at(physRow, { spellPct: 20 }) / at(physRow, {}), 1],
        ['a magic press carrying the attack bucket', at(magicRow, { attackPct: 20 }) / at(magicRow, {}), 1],
      ] as any[];
      for (const [what, got, want] of cross) if (Math.abs(got - want) > 1e-9) bp.push(`${what} scales x${got.toFixed(4)}, not x${want}`);
    }
    add('X63', bp.length === 0, bp.length ? bp.join(' · ')
      : `the two buckets are ${BUCKET.map(([id]) => id).join(' + ')}: real % lines, each with a \`mod_weights\` row, each on the weapon pool and on no armour slot · a press multiplies once, on its own ladder only (${physRow.id} reads Attack damage %, ${magicRow.id} reads Spell damage %, the other half of the pair is x1.00 on both) · a swing rides the attack bucket and a magic weapon's bolt the spell one · an empty bucket is x1, so every published press stays the empty-bucket baseline`);
  }

  // The species damage tag is now a rule: it divides the incoming hit
  const splitTags = [...new Set(E.mob.species.map((r) => r.damage))];
  const spProblems = splitTags.filter((t) => !E.mob.damage_split[t] || Math.abs(E.mob.damage_split[t][0] + E.mob.damage_split[t][1] - 1) > 1e-9);
  const counts = splitTags.map((t) => `${t} ${E.mob.species.filter((r) => r.damage === t).length}`);
  add('X31', spProblems.length === 0 && splitTags.length === 3, spProblems.length ? `no valid split for: ${spProblems.join(', ')}` : `every species damage tag resolves to a real split (${counts.join(' · ')}) · physical is the whole armour-able half (Knight · Golem · Troll answered by Armour and chill), magic is the whole res-able half (Slime · Seraph only reachable through res), mixed keeps the old 50/50`);

  // With a mob's level STATIC per species (spread inside the zone, `mob.species[].zone_levels`), the
  // zone average no longer equals the zone-top anchor: a mob reads `mob_HP` at its OWN level, so the
  // Reach: the only positional model, and its cost to a melee build must stay small
  const RP = [];
  const allWeapons = ['sword','axe','dagger','mace','spear','two-handed sword','two-handed axe','bow','crossbow','staff','wand','book'];
  for (const w of allWeapons) if (!E.mob.reach.weapons[w]) RP.push(`weapon ${w} has no reach band`);
  for (const sp of E.mob.species) if (!['front','stand-off'].includes(sp.line)) RP.push(`${sp.name} has no line`);
  for (const z of ZONES) {
    const cast = E.mob.species.filter((sp) => sp.zones.includes(z.id));
    if (cast.some((sp) => sp.line === 'stand-off') && !cast.some((sp) => sp.line === 'front')) RP.push(`zone ${z.id} fields only stand-off mobs, so a melee build could never engage there`);
  }
  const exposure = ZONES.map((z) => {
    const cast = E.mob.species.filter((sp) => sp.zones.includes(z.id));
    let wAll = 0, wBack = 0;
    for (const sp of cast) for (const sid of sp.sizes) { const wt = E.mob.spawn_weights[sid] || 0; wAll += wt; if (sp.line === 'stand-off') wBack += wt; }
    const G = z.id <= 3 ? 1.5 : z.id <= 6 ? 2.5 : 4;
    return { zone: z.id, pct: (wBack / wAll) * 100, cyclePct: (wBack / wAll) / (G + 4) * 100 };
  });
  const worst = exposure.reduce((a, b) => (b.cyclePct > a.cyclePct ? b : a));
  watch('X33t', worst.cyclePct <= 12, `reach costs a melee build ${f1(worst.cyclePct)}% of the cycle in zone ${worst.zone} — past the 12% ceiling the owner read the model against`,
    `reach is the whole positional model (no tiles, no movement): ${allWeapons.length} weapons mapped to ${Object.keys(E.mob.reach.bands).length} bands · ${E.mob.species.length} species all carry a line (${E.mob.species.filter((sp) => sp.line === 'front').length} front · ${E.mob.species.filter((sp) => sp.line === 'stand-off').length} stand-off) · the worst case is ${f1(worst.cyclePct)}% of the cycle in zone ${worst.zone} (the 12% ceiling)`);
  add('X33', RP.length === 0, RP.length ? RP.join(' · ')
    : `reach is the whole positional model (no tiles, no movement): ${allWeapons.length} weapons mapped to ${Object.keys(E.mob.reach.bands).length} bands · ${E.mob.species.length} species all carry a line (${E.mob.species.filter((sp) => sp.line === 'front').length} front · ${E.mob.species.filter((sp) => sp.line === 'stand-off').length} stand-off)`);

  // Inventory: an adventure bag that fills and pauses, a character bag of stacks, town-only stash/craft
  const IV = E.inventory || {};
  const ivp = [];
  if (!(IV.adventure_slots > 0)) ivp.push('no adventure bag size');
  if (!(IV.character_slots > 0)) ivp.push('no character bag size');
  if (IV.overflow !== 'stop_pickup') ivp.push('overflow must be stop_pickup — a full bag pauses pickups, nothing auto-converts');
  for (const k of ['stone', 'herb', 'potion', 'material', 'food']) if (!(IV.stack_size && IV.stack_size[k] > 0)) ivp.push(`no stack size for ${k}`);
  for (const k of ['herb', 'potion', 'material', 'food']) if (!(IV.unit_weight && IV.unit_weight[k] >= 0)) ivp.push(`no unit weight for ${k}`);
  if (IV.gold_uses_slot !== false) ivp.push('gold must not consume a slot');
  const gearHr = L.bands.high.upgrades_per_hr;                       // kept gear/hr = measured upgrades (F4)
  const gearFill = IV.adventure_slots / gearHr;
  const stoneSlotHr = IV.stack_size.stone / BAND.high.junk_per_hr;   // one stone slot of value stones
  soft('X34', ivp.length === 0, ivp.length ? ivp.join(' · ')
    : `adventure bag ${IV.adventure_slots} slots (kept gear only) fills in ~${f1(gearFill)} hr at the high band's measured ${gearHr} upgrades/hr · character bag ${IV.character_slots} slots holds stone (${IV.stack_size.stone}/slot, weightless), herb ${IV.stack_size.herb}/slot, potion ${IV.stack_size.potion}/slot, material ${IV.stack_size.material}/slot, food ${IV.stack_size.food}/slot; gold takes no slot · full = pickups pause, nothing auto-converts, nothing is deleted · stash + gear craft are Settlement-only, meal cooking is Camp-only`);

  // Junk is gold's primary mint now (Ragnarok-style); every rarity must reproduce the published
  // junk line, so rarity changes the flavour and the price but not the expected income
  {
    const J = E.junk || {};
    const jp = [];
    const perKill = BAND.high.junk_per_hr / BAND.high.kills_derived;
    if (!J.rarities) jp.push('no junk rarities');
    else for (const [r, v] of Object.entries(J.rarities) as [string, any][]) {
      if (!(v.sell_gold > 0 && v.drop_chance_per_kill > 0 && v.drop_chance_per_kill < 1)) jp.push(`rarity ${r} needs a sell and a chance`);
      else if (Math.abs(v.drop_chance_per_kill * v.sell_gold - perKill) > 1e-4) jp.push(`rarity ${r}: chance x sell = ${f2(v.drop_chance_per_kill * v.sell_gold)} gold/kill, must equal the line ${f2(perKill)}`);
    }
    // Every fieldable variant keeps its unique base item. Each species also owns one alternative per
    // rarity; those names must be globally unique and map to the same fixed sale rarity in town.
    const V = (E.mob as any).variants || {};
    const D = (E.mob as any).variant_drops || {};
    // Only a FIELDABLE rung may promise a junk item: a name the cast can never field is a drop the
    // Counterhand would advertise and nothing could ever pay. Reachability is read off the cast, not
    // typed: a normal rung is cast in some sub-zone, an elite rung is declared by some sub-zone, and a
    // boss rung belongs to a species that owns a boss entry (X57 checks the names are the right rungs).
    const declaredNormal = new Set<string>(), declaredElite = new Set<string>();
    for (const z of E.mob.zones as any[]) for (const s of z.subzones || []) {
      if (s.elite) declaredElite.add(s.elite);
      for (const n of s.normal || []) declaredNormal.add(n);
    }
    const rungOf = new Map<string, { sid: string; rung: number }>();
    for (const [sid, list] of Object.entries<string[]>(V)) list.forEach((n, i) => rungOf.set(n, { sid, rung: i }));
    const names = [...rungOf.keys()];
    const fieldable = names.filter((n) => {
      const o = rungOf.get(n)!;
      if (o.rung < 3) return declaredNormal.has(n);
      if (o.rung === 3) return declaredElite.has(n);
      return E.mob.bosses.some((b) => b.species === o.sid);
    });
    const paidBy = new Map<string, string>();
    const variantItems = new Set(Object.values(D).map((row: any) => row.item));
    for (const n of fieldable) {
      const row = D[n];
      if (!row) { jp.push(`variant ${n} can be fielded but has no variant_drops row`); continue; }
      const owner = paidBy.get(row.item);
      if (owner) jp.push(`junk item "${row.item}" is paid by two variants: ${owner} and ${n}`);
      paidBy.set(row.item, n);
      if (!J.rarities || !J.rarities[row.rarity]) jp.push(`${n} junk "${row.item}" has unknown rarity ${row.rarity}`);
    }
    const speciesItemOwner = new Map<string, string>();
    const expectedRarities = Object.keys(J.rarities || {}).sort();
    for (const species of E.mob.species as any[]) {
      const items = species.junk_items || {};
      const rarities = Object.keys(items).sort();
      if (rarities.join('|') !== expectedRarities.join('|')) {
        jp.push(`${species.name} junk_items must declare exactly one item for each rarity (${expectedRarities.join(', ')})`);
      }
      for (const rarity of expectedRarities) {
        const item = items[rarity];
        if (typeof item !== 'string' || !item.trim()) { jp.push(`${species.name} has no ${rarity} race junk item`); continue; }
        if (!J.rarities[rarity]) jp.push(`${species.name} junk "${item}" has unknown rarity ${rarity}`);
        if (variantItems.has(item)) jp.push(`${species.name} race junk "${item}" duplicates a variant junk item`);
        const owner = speciesItemOwner.get(item);
        if (owner) jp.push(`race junk item "${item}" is shared by ${owner} and ${species.id}`);
        speciesItemOwner.set(item, species.id);
      }
    }
    for (const k of Object.keys(D)) {
      if (!names.includes(k)) jp.push(`variant_drops row for a name no ladder carries: ${k}`);
      else if (!fieldable.includes(k)) jp.push(`variant_drops row for a rung the cast can never field: ${k}`);
    }
    const junkHr = BAND.high.kills_derived * perKill;
    add('X39', jp.length === 0, jp.length ? jp.join(' · ')
      : `mob junk is gold's primary mint: ${fieldable.length} unique variant items plus ${speciesItemOwner.size} unique race items across ${Object.keys(J.rarities).length} rarities · each race alternative shares its rarity's existing sale price, and each rarity's chance = the line / its sell, so expected gold is ${f2(perKill)}/kill for any variant and the junk line stays ${f0(junkHr)}/hr · every variant row belongs to a fieldable rung · stacks ${J.stack}/slot, weightless`);
  }

  // X57: the cast names the rung it is. A sub-zone's normal names must be the NORMAL rungs of races
  // cast there, and its declared elite must be exactly an ELITE rung (index 3) of one of them — X53
  // only asked that a name be owned by some race shown, which let a sub-zone promise a normal rung as
  // its elite. The sim reads that declared elite to choose the spawn and its junk, so the promise and
  // the fight had to be the same fact (game/src/sim/game.ts spawnMob).
  {
    const cp: string[] = [];
    const V = (E.mob as any).variants || {};
    const rungOf = new Map<string, { sid: string; rung: number }>();
    for (const [sid, list] of Object.entries<string[]>(V)) list.forEach((n, i) => rungOf.set(n, { sid, rung: i }));
    let normals = 0, elites = 0;
    for (const z of E.mob.zones as any[]) for (const s of z.subzones || []) {
      const pool = new Set<string>(s.races || []);
      for (const n of s.normal || []) {
        const o = rungOf.get(n);
        if (!o || !pool.has(o.sid) || o.rung > 2) cp.push(`zone ${z.id} ${s.name} lists ${n} as a normal body, but it is not a normal rung of a race cast there`);
        else normals++;
      }
      if (s.elite) {
        const o = rungOf.get(s.elite);
        if (!o || !pool.has(o.sid) || o.rung !== 3) cp.push(`zone ${z.id} ${s.name} declares elite ${s.elite}, which is not an elite rung of a race cast there`);
        else elites++;
      }
    }
    add('X57', cp.length === 0, cp.length ? cp.join(' · ')
      : `${normals} normal body row(s) and ${elites} declared elite(s) are the rungs of the races their sub-zone casts — the elite a sub-zone promises is the elite that spawns, and its junk is that variant's own (mob.zones[].subzones · mob.variants · game/src/sim/game.ts)`);
  }

  // X56: normal variant rungs share their species' drop archetype. Elite and Boss rows stay balanced
  // because they already pay their own stone lines. Every lean still conserves expected drops/kill.
  {
    const vp: string[] = [];
    const V = (E.mob as any).variants || {};
    const D = (E.mob as any).variant_drops || {};
    const CATS = E.loot.variant_lean.categories as string[];
    const sample = { gear: 0.08, herb: 0.17, junk: 0.3 };
    const sum = (x: any) => x.gear + x.herb + x.junk;
    let leaned = 0, normalLeaned = 0;
    for (const [sid, list] of Object.entries<string[]>(V)) {
      const normal: string[] = [];
      list.forEach((n, i) => {
        const r = D[n];
        if (!r) return; // a pruned rung carries no row; X39 owns that fact, not this gate
        if (i < 3) {
          normal.push(r.lean);
          if (!CATS.includes(r.lean)) vp.push(`${sid}: ${n} has unknown lean ${r.lean}`);
        }
        else {
          if (r.lean !== 'none') vp.push(`${sid}: ${r.item} leans ${r.lean}, Elite and Boss must stay 'none'`);
          leaned++;
        }
      });
      if (normal.length !== 3) vp.push(`${sid}: has ${normal.length} normal lean rows, expected 3`);
      if (new Set(normal).size > 1) vp.push(`${sid}: normal rungs split across ${[...new Set(normal)].join(' · ')}`);
      for (const lean of normal) {
        const out = leanReweight(sample, lean as any, E.loot.variant_lean.shift_pct);
        if (Math.abs(sum(out) - sum(sample)) > 1e-9) vp.push(`${sid}: lean ${lean} does not conserve the total`);
        if (out[lean as 'gear' | 'herb' | 'junk'] <= sample[lean as 'gear' | 'herb' | 'junk']) vp.push(`${sid}: lean ${lean} does not raise its own stream`);
        leaned++; normalLeaned++;
      }
    }
    add('X56', vp.length === 0, vp.length ? vp.join(' · ')
      : `each species' three normal rungs share one archetype lean and Elite/Boss rungs carry 'none': ${leaned} leans checked (${normalLeaned} normal rows), each lean raises its stream and conserves ${sum(sample).toFixed(2)} expected drops/kill (mob.variant_drops · loot.variant_lean)`);
  }

  // The AoE rule is data now, and its shape must stay a real trade: lose at 1 target, win at the Cap
  {
    const A = E.aoe || {};
    const p = [];
    if (!(A.per_target_pct > 0 && A.per_target_pct <= 100)) p.push('aoe per-target damage must be a percentage');
    if (!(A.target_cap >= 1)) p.push('aoe needs a target cap');
    if (!(A.mana_mult >= 1)) p.push('aoe mana must cost at least 1x');
    const dpm = (n: number) => (Math.min(n, A.target_cap) * A.per_target_pct) / 100 / A.mana_mult;
    if (!(dpm(1) < 1)) p.push('aoe must lose to single-target damage per mana at 1 target');
    if (!(dpm(A.target_cap) > 1)) p.push('aoe must beat single-target damage per mana at the Cap');
    soft('X40', p.length === 0, p.length ? p.join(' · ')
      : `the AoE rule is data: ${A.per_target_pct}% per target · Cap ${A.target_cap} · mana ×${A.mana_mult} → damage per mana ${f2(dpm(1))}× / ${f2(dpm(2))}× / ${f2(dpm(A.target_cap))}×, so AoE loses at 1 target and wins at the Cap (skill-pool-system.md)`);
  }

// The Road is walking now: a hex graph, one block per `block_sec`, one encounter chance per block,
  // and no mint at all — an encounter is a fight that pays the ordinary drop roll. The cage proves
  // the shape is closed: a node per settlement on the lattice, a reachable world, a sane block time,
  // an encounter chance that is neither certain nor never, and nothing that pays outside a kill.
  const ROAD = E.road;
  const roadP = [];
  const WALK = eng.ROAD;
  const settlementNames = new Set<string>(readJson(path.join(ROOT, 'tools/data/town.json')).settlements.map((s: any) => s.id));
  for (const n of ROAD.nodes) {
    if (!settlementNames.has(n.id)) roadP.push(`walk node "${n.id}" is not a settlement`);
    if (!Number.isInteger(n.q) || !Number.isInteger(n.r)) roadP.push(`walk node ${n.id} is not on the hex lattice (q/r must be integers)`);
  }
  if (ROAD.nodes.length !== settlementNames.size) roadP.push(`${ROAD.nodes.length} walk nodes for ${settlementNames.size} settlements`);
  if (new Set(ROAD.nodes.map((n) => n.id)).size !== ROAD.nodes.length) roadP.push('two walk nodes share one id');
  // no two settlements may share a hex: every pair must be a real walk of at least one block
  for (const a of ROAD.nodes) {
    if (ROAD.nodes.some((b) => b.id !== a.id && WALK.blocksBetween(a.id, b.id) <= 0)) {
      roadP.push(`walk node ${a.id} shares a hex with another settlement — every pair must be at least one block apart`);
    }
  }
  if (!(ROAD.block_sec >= 1)) roadP.push(`block_sec is ${ROAD.block_sec} — a block must cost at least a second`);
  if (!(ROAD.encounter_chance_pct > 0 && ROAD.encounter_chance_pct < 100)) roadP.push(`encounter chance is ${ROAD.encounter_chance_pct}% — a walk must be able to be quiet and able to be ambushed`);
  // the walk pays nothing outside a kill: the rules may not name a purse, a chest, Standing or a stone
  for (const [key, text] of [['encounter_rule', ROAD.encounter_rule], ['push_rule', ROAD.push_rule], ['waypoint_rule', ROAD.waypoint_rule], ['graph_rule', ROAD.graph_rule]]) {
    if (/\bpurse\b|\bchest\b|\bpedlar\b|\bcaravan\b/i.test(text)) roadP.push(`${key} still names a Road reward — the walk pays a drop roll and nothing else`);
  }
  if (/\bstone/i.test(ROAD.encounter_rule)) roadP.push('the walk may not pay crafting stones — G5 keeps them with Elite and boss');
  if (!/on foot/i.test(ROAD.waypoint_rule)) roadP.push('a Waypoint must unlock by arriving on foot');
  // A warp buys back the walk's time, so it is a gold sink and nothing else: gold is the convenience
  // the power currency, so a stone would make travel a power track, and free warps would delete the walk the
  // encounter rate hangs off. The price is one data row, priced per block like every stall line.
  const TOWNJSON = readJson(path.join(ROOT, 'tools/data/town.json'));
  const WARP = (TOWNJSON.repeatable || []).find((r: any) => r.id === 'waypoint_warp');
  if (!/gold/i.test(ROAD.waypoint_rule)) roadP.push('a Waypoint must warp for gold — it buys back the walk time');
  if (/\bfree\b/i.test(ROAD.waypoint_rule)) roadP.push('a Waypoint must not warp for free — the warp is priced');
  if (!WARP) roadP.push('no town.json `waypoint_warp` line carries the Waypoint price');
  else {
    if (!(WARP.m_per_block > 0)) roadP.push('the Waypoint price must be per block, never a flat toll');
    if (WARP.kind !== 'time') roadP.push(`the Waypoint is sold as "${WARP.kind}" — a warp buys time and nothing else`);
    if (TOWNJSON.settlements.some((s: any) => (s.stock || []).includes('waypoint_warp'))) roadP.push('a Waypoint is not a stall line: no settlement stocks it');
  }
  if (/\bstone/i.test(ROAD.waypoint_rule)) roadP.push('a Waypoint may never be priced in a stone — stones are the power currency');
  add('X36', roadP.length === 0, roadP.length ? roadP.join(' · ')
    : `the walk is a closed shape: ${ROAD.nodes.length} settlements on the hex lattice · ${ROAD.block_sec}s a block · ${ROAD.encounter_chance_pct}% an encounter per block, so a ${WALK.blocksBetween(ROAD.nodes[0].id, ROAD.nodes[1].id)}-block walk pays ${f1((Number(ROAD.encounter_chance_pct) / 100) * Number(WALK.blocksBetween(ROAD.nodes[0].id, ROAD.nodes[1].id)))} fights in expectation · a fight is an ordinary mob group that pays the ordinary drop roll · a Push keeps the walk's blocks · a Waypoint unlocks on foot and warps for ${WARP.m_per_block} minutes of gold a block`);

  // X46 · the walk is online-only and Push-neutral. A Push cannot refund a block, a same-zone Field
  // Camp can end its current route, an away period must not walk, and a Waypoint must not gate a zone.
  const walkP = [];
  if (!/same-zone Field Camp/i.test(ROAD.push_rule)) walkP.push('a same-zone Field Camp must own the field return');
  if (!/ends the current walk/i.test(ROAD.push_rule)) walkP.push('a Field Camp return must end the interrupted walk');
  if (!/without refunding a block/i.test(ROAD.push_rule)) walkP.push('a Push must not refund a block');
  if (!/never gates a zone/i.test(ROAD.waypoint_rule)) walkP.push('a Waypoint must never gate a zone');
  if (/offline/i.test(ROAD.encounter_rule) && !/never/i.test(ROAD.encounter_rule)) walkP.push('an encounter rule that mentions offline must say an away period never walks');
  add('X46', walkP.length === 0, walkP.length ? walkP.join(' · ')
    : `the walk is online-only and Push-neutral: a same-zone Field Camp receives a Push and ends the route without refunding a block; without one, the walk resumes at the ambush block · an away period never crosses a block · a Waypoint never gates a zone`);

  // X64 · every cell is a place to stand, so a cell's zone must be answerable from the lattice alone —
  // nearest settlement, with a written tie-break. The cage proves the ownership is a derivation and not
  // a table: a settlement owns its own hex, no cell can sit one block from two towns, the six neighbours
  // are the six cells `hexAdjacent` admits, and a tied bare cell resolves to one answer every time.
  const ownP = [];
  const PREFER = TOWNJSON.settlements.slice().sort((a: any, b: any) => a.zone - b.zone).map((s: any) => s.id);
  for (const n of ROAD.nodes) {
    const own = WALK.owningNode({ q: n.q, r: n.r }, PREFER);
    if (own.id !== n.id) ownP.push(`${n.id} is not the owner of its own hex (${own.id} answers)`);
    if (WALK.cellRank({ q: n.q, r: n.r }) !== 0) ownP.push(`${n.id} does not rank 0 on its own hex`);
  }
  // rank <= 1 must never tie, or a side would belong to two towns and the standing rule would be a coin toss
  for (const a of ROAD.nodes) {
    for (const b of ROAD.nodes) {
      if (a.id !== b.id && WALK.blocksBetweenHex(a, b) < 2) ownP.push(`${a.id} and ${b.id} sit ${WALK.blocksBetweenHex(a, b)} blocks apart — a cell one block from both would tie`);
    }
  }
  // A bare cell two blocks out is where two towns' fields can meet, so the tie-break must be a rule that
  // answers the same way every read: the tied settlement holding the lowest zone.
  const tieSeen = [];
  for (const n of ROAD.nodes) {
    for (let dq = -3; dq <= 3; dq++) {
      for (let dr = -3; dr <= 3; dr++) {
        const h = { q: n.q + dq, r: n.r + dr };
        if (WALK.cellRank(h) < 2) continue;
        const tied = WALK.owners(h);
        if (tied.length < 2) continue;
        if (tied.some((t) => WALK.blocksBetweenHex(h, t) !== WALK.cellRank(h))) ownP.push(`a tie at ${h.q},${h.r} is not between equally near settlements`);
        const chosen = WALK.owningNode(h, PREFER);
        const chosenZone = TOWNJSON.settlements.find((s: any) => s.id === chosen.id)?.zone ?? 99;
        if (tied.some((t) => (TOWNJSON.settlements.find((s: any) => s.id === t.id)?.zone ?? 99) < chosenZone)) {
          ownP.push(`a ${WALK.cellRank(h)}-block cell ties ${tied.map((t) => t.id).join('/')} and does not take the lowest zone`);
        }
        tieSeen.push(h);
      }
    }
  }
  if (tieSeen.length === 0) ownP.push('no tied bare cell to prove the tie-break with — the rule is untested');
  for (const h of WALK.neighbours({ q: ROAD.nodes[0].q, r: ROAD.nodes[0].r })) {
    const ring = WALK.neighbours(h);
    if (ring.length !== 6) ownP.push(`a cell has ${ring.length} neighbours, not six`);
    if (new Set(WALK.hexKeys(ring)).size !== 6) ownP.push('two neighbour offsets land on the same cell');
    if (ring.some((b) => WALK.blocksBetweenHex(h, b) !== 1)) ownP.push('a neighbour is not one block away');
  }
  if (!/nearest settlement/i.test(ROAD.standing_rule)) ownP.push('standing_rule must name the nearest settlement as the owner of a cell');
  if (!/sub-zone/.test(ROAD.standing_rule) || !/whole cast/i.test(ROAD.standing_rule)) ownP.push('standing_rule must say a named side hunts that sub-zone and unnamed ground rolls the zone whole');
  if (!/0 is the settlement/i.test(ROAD.standing_rule)) ownP.push('standing_rule must say rank 0 is the settlement itself');
  if (!/lowest zone/i.test(ROAD.standing_rule)) ownP.push('standing_rule must give the tie-break in writing');
  const minGap = Math.min(...WALK.pairs.map((p) => p.blocks));
  add('X64', ownP.length === 0, ownP.length ? ownP.join(' · ')
    : `every cell is standable and its zone is derived: ${ROAD.nodes.length} settlements each own their own hex at rank 0 · the closest two settlements sit ${minGap} blocks apart, so no side ever has two owners · ${tieSeen.length} bare cells tie between settlements and each resolves to the lowest zone, the same answer every read · a cell's six neighbours are six distinct one-block cells`);

  // X65 · one hex is one block whatever stands on it. The cost is the distance, the route is the same
  // distance walked cell by cell, and no terrain row may come back and quietly re-price the field.
  const costP = [];
  for (const p of WALK.pairs) {
    const na = WALK.nodeById(p.a)!, nb = WALK.nodeById(p.b)!;
    if (WALK.blocksBetweenHex(na, nb) !== p.blocks) costP.push(`${p.a}→${p.b} costs ${WALK.blocksBetweenHex(na, nb)} hex blocks but ${p.blocks} by id`);
    if (WALK.secFromHex(na, nb) !== p.sec) costP.push(`${p.a}→${p.b} costs ${WALK.secFromHex(na, nb)}s by hex but ${p.sec}s by id`);
    const route = WALK.routeHex(na, nb);
    if (route.length !== p.blocks + 1) costP.push(`${p.a}→${p.b} plots ${route.length} cells for a ${p.blocks}-block walk`);
    for (let i = 1; i < route.length; i++) {
      if (WALK.blocksBetweenHex(route[i - 1], route[i]) !== 1) costP.push(`${p.a}→${p.b} jumps ${WALK.blocksBetweenHex(route[i - 1], route[i])} cells in one step`);
    }
  }
  if (Object.keys(ROAD).some((k) => /terrain|passab/i.test(k))) costP.push('the Road carries a terrain or passability row again — every cell costs one block');
  if (!/one block whatever/i.test(ROAD.cost_rule)) costP.push('cost_rule must say a cell costs one block whatever lies under it');
  if (!/no terrain cost/i.test(ROAD.cost_rule) || !/passability/i.test(ROAD.cost_rule)) costP.push('cost_rule must retire terrain cost and passability by name');
  add('X65', costP.length === 0, costP.length ? costP.join(' · ')
    : `the field is priced uniformly: all ${WALK.pairs.length} ordered settlement routes cost the same by hex as by id (${ROAD.block_sec}s a block) and plot one adjacent cell per block · no terrain, passability or per-ground cost row exists anywhere in \`road\``);

  add('X17', E.caps.accuracy === null, 'accuracy has no Cap (the 2,000 Cap was removed) · the ratio formula limits itself at ' + f1(DERIVED.hit_chance * 100) + '%');

  // ---- the opening (minute one): a client builds a character straight from `opening`, and
  // these hold the two ways that could silently break the game — a free item paying more than
  // the mob curve assumes, or a starting character that cannot clear zone 1.
  const OP = E.opening;
  const opZone = MOB.zones.find((z) => z.name === OP.settlement)!;
  soft('OP1', !!opZone, `the opening settlement "${OP.settlement}" is a real zone${opZone ? ` (zone ${opZone.id}, levels ${opZone.levels[0]}-${opZone.levels[1]})` : ''}`);

  // Resolve the opening weapon by its exact data name, so a rename cannot fall back to the dagger.
  const opBase = OP.gear[0].base;
  const opWpn = E.weapons.find((w) => w.name === opBase || w.name.split(' / ').includes(opBase));
  const opFrame = ((BASES_JSON.weapon_frames || {})[opBase] || [])[0];
  add('OP0', !!opWpn, opWpn
    ? `the starting weapon "${opBase}" resolves to ${opWpn.name} (${opWpn.weapon_aspd} hits/sec)`
    : `the starting weapon "${opBase}" matches no row in engine.weapons — a client would have no attack speed`);
  const opStat = eng.statAt(OP.level);
  // the set is derived the way the client derives it: the data names a frame per slot and the engine's
  // own floor rule produces the one line each piece carries, so nothing below can disagree with minute one
  const OP_PIECES = openingSet();
  const opMain = OP_PIECES.find((p) => p.g.slot === 'main hand');
  const givenFlat = opMain ? opMain.lines.reduce((s, l) => s + (l.id === 'physical_power_flat' ? l.value : 0)
    + (l.extra || []).reduce((n: number, part: any) => n + (part.id === 'physical_power_flat' ? part.value : 0), 0), 0) : 0;
  const opPhys = opStat * K.K_STR + givenFlat;
  const opDps = opPhys * (opWpn ? opWpn.weapon_aspd * opWpn.weapon_mult : 0);
  const opMobHp = opZone.hp[0];
  const opSecs = opDps > 0 ? opMobHp / opDps : Infinity;
  const pwRange = MODS.mods.find((m: any) => m.id === 'physical_power_flat');
  // the curve prices this mob against exactly this character, so the opening line must be the RULE's own
  // floor for a two-Mod line — the worst slice's low end scaled by `value_scale` — and never a typed
  // number that merely happens to sit inside the low band
  const expectFlat = Math.max(1, Math.round(pwRange.bands[0][0][0]
    * (E.loot.frame_mod.value_scale['2'] || 1) * (opFrame?.value_bias ?? 1)));
  soft('OP2', !!opWpn && givenFlat === expectFlat,
    opWpn && givenFlat === expectFlat
      ? `the starting weapon's flat is the low band's two-Mod floor after its frame value bias (+${givenFlat} physical; the unweighted floor is ${Math.round(pwRange.bands[0][0][0] * (E.loot.frame_mod.value_scale['2'] || 1))})`
      : `the opening main hand is missing or its flat line is not the rule's own floor (got ${opWpn ? givenFlat : 'no weapon'}, want ${expectFlat})`);
  watch('OP2t', opSecs >= 0.8 && opSecs <= 2,
    `minute one kills a level-1 mob in ${Number.isFinite(opSecs) ? f1(opSecs) + ' sec' : 'no time at all'} — outside the 0.8-2 sec opening pacing band`,
    `minute one's kill of a level-1 mob reads ${Number.isFinite(opSecs) ? f1(opSecs) + ' sec' : 'never'} — inside the 0.8-2 sec opening pacing band`);

  const opHp = eng.maxHpOf(opStat, OP.level);
  const opRegen = opStat * K.K_VIT_REGEN;
  const opTaken = eng.mobPs(opMobHp, OP.level);
  const opSurvive = opHp / Math.max(0.1, opTaken - opRegen);
  watch('OP3', opSurvive > 60, `a level-1 character with nothing worn dies after ${f0(opSurvive)} sec against a zone-1 mob — the opening's "cannot kill the player" pacing target moved`,
    `a level-1 character with nothing worn survives ${f0(opSurvive)} sec against a zone-1 mob — the opening cannot kill the player, and the set can only raise that`);

  soft('OP4', OP.skills.length === 0,
    OP.skills.length === 0
      ? 'no starting skill — the mob curve gives a level-1 character 0.3% skill power, so a free skill would be power outside the priced curve'
      : `FAIL: ${OP.skills.length} starting skill(s), each is power the mob curve does not pay for`);

  soft('OP5', OP.gold === 0 && Object.keys(OP.stones).length === 0,
    'the opening hands over no currency, so minute one cannot buy past a gate the design has not opened');

  // · the set is carried, so §11 must weigh it — a client that starts weightless is silently granting the
  // opening build attack speed the frames do not give it. The number is the same engine call the client
  // makes, so the two cannot disagree about minute one. `weight_base` (owner ruling) lifts the level-1
  // capacity clear of every main hand, and the lightest frame of each slot keeps the whole set under it.
  const opCarry = OP_PIECES.reduce((s, p) => s + p.weight, 0);
  const opTax = eng.encumbranceOf(opCarry, opStat);
  const lightestMain = Math.min(...BASES_JSON.weapons.filter((w: any) => w.weight > 0).map((w: any) => w.weight));
  soft('OP6', opCarry > 0 && opTax === 0,
    `the opening set weighs ${f0(opCarry)} against a ${f0(eng.weightCapacityOf(opStat))} level-1 capacity, so section 11 takes ${f1(opTax * 100)}% of aspd — the lightest frame of every slot keeps the set under the weight_base line, and the lightest main hand in the table (${f0(lightestMain)}) fits with it`);

  // OP7 · the set's shape: every slot filled exactly once (the two rings included), one line per piece,
  // and no Bound pair or Unbound line anywhere — minute one is junk, and junk is what this proves
  const opSlotProblems: string[] = [];
  const opSlots = (LOOT_SLOTS as string[]);
  for (const slot of [...new Set(opSlots)]) {
    const n = OP_PIECES.filter((p) => p.g.slot === slot).length;
    const want = opSlots.filter((s) => s === slot).length;
    if (n !== want) opSlotProblems.push(`${slot}: ${n} piece(s), SLOTS carries ${want}`);
  }
  const opLineProblems = OP_PIECES
    .filter((p) => p.lines.length !== 1)
    .map((p) => `${p.g.slot} ${p.g.base}`);
  add('OP7', OP_PIECES.length === opSlots.length && opSlotProblems.length === 0 && opLineProblems.length === 0,
    `the set is ${OP_PIECES.length} pieces, one per slot of the ${opSlots.length} a character wears, and every piece carries exactly one line — its frame's Frame Mod at the floor, with no Bound pair and no Unbound line${opSlotProblems.length ? ' · SLOTS: ' + opSlotProblems.join(' · ') : ''}${opLineProblems.length ? ' · LINES: ' + opLineProblems.join(' · ') : ''}`);

  // OP8 · the priced clock cannot move: no piece outside the main hand may carry an attack line, because
  // mob_HP, the drop line and the timeline are all keyed on the attack side
  const ATTACK_LINES = new Set(['physical_power_flat', 'physical_power', 'magic_power_flat', 'magic_power',
    'elemental_power_flat', 'elemental_power', 'attack_speed', 'critical_chance', 'critical_damage',
    'accuracy', 'armour_pen', 'bleed_chance', 'stun_chance']);
  const opAttack = OP_PIECES
    .filter((p) => p.g.slot !== 'main hand')
    .flatMap((p) => p.lines.flatMap((l: any) => [l.id, ...((l.extra || []).map((x: any) => x.id))]))
    .filter((id) => ATTACK_LINES.has(id));
  add('OP8', opAttack.length === 0,
    `no piece outside the main hand carries an attack line (${[...ATTACK_LINES].length} are watched), so the set dresses the character without moving a price the mob curve publishes${opAttack.length ? ' · FOUND: ' + opAttack.join(' · ') : ''}`);

  // ---- mod pool ranges (tools/data/mods.json → mod-pool.md `mod-pool`)
  const modProblems = [];
  for (const m of MODS.mods) {
    const flat = m.bands.flat();
    if (!flat.length) { modProblems.push(`${m.id} has no slices`); continue; }
    if (flat[0][0] !== m.min) modProblems.push(`${m.id} starts at ${flat[0][0]}, Total says ${m.min}`);
    if (flat[flat.length - 1][1] !== m.max) modProblems.push(`${m.id} ends at ${flat[flat.length - 1][1]}, Total says ${m.max}`);
    // thirds are contiguous inside a band; a seam overlaps by design (owner ruling): a low-band T1
    // outrolls the next band's T3, while every band's effective T1 floor still rises above the band
    // below — the god-roll window is real and the top third always wins.
    const tiers = m.bands[0].length;
    for (let i = 1; i < flat.length; i++) {
      const seam = i % tiers === 0;
      if (!seam) {
        if (flat[i][0] <= flat[i - 1][1]) modProblems.push(`${m.id} slice ${i} (${flat[i][0]}) overlaps slice ${i - 1} (ends ${flat[i - 1][1]})`);
        else if (flat[i][0] !== flat[i - 1][1] + 1) modProblems.push(`${m.id} slice ${i} starts ${flat[i][0]}, a gap after ${flat[i - 1][1]}`);
      } else {
        const q = i / tiers;
        const ov = flat[i - 1][1] - flat[i][0];
        if (ov < 1) modProblems.push(`${m.id} seam ${i} has no god-roll overlap`);
        const hi = m.bands[q][m.bands[q].length - 1][1];
        const size = Math.ceil((hi - flat[i][0] + 1) / 3);
        if (hi - size + 1 <= flat[i - 1][1]) modProblems.push(`${m.id} seam ${i} T1 no longer wins outright`);
      }
    }
    const tierCounts = new Set(m.bands.map((b: any[]) => b.length));
    if (tierCounts.size !== 1) modProblems.push(`${m.id} has ${[...tierCounts].join('/')} Tiers across its quality bands`);
    for (const b of m.bands) for (const [a, z] of b) if (a > z) modProblems.push(`${m.id} slice ${a}-${z} is inverted`);
  }
  add('MP1', modProblems.length === 0,
    `every mod range covers its Total — contiguous thirds, overlapping seams, rising T1 floors${modProblems.length ? ' · ' + modProblems.join(' · ') : ''}`);

  const modIds = MODS.mods.map((m: any) => m.id);
  add('MP2', modIds.length === new Set(modIds).size && MODS.pending.every((p: any) => !modIds.includes(p.id)),
    `${MODS.mods.length} unique mod ids · ${MODS.pending.length} pending line(s) (${MODS.pending.map((p: any) => p.name).join(', ') || 'none'})`);

  // Mod availability matrix: every name in it must be a real Mod line, and the three pools must not leak
  const matrixRows = modMatrix().split('\n').slice(2).map((l) => l.split('|').map(cleanMod).filter(Boolean)[0]);
  const known = rangedMods();
  const matrixProblems = [];
  for (const name of matrixRows) if (!known.has(name) && !GEAR_MODS.includes(name) && !STAT_MODS.includes(name)) matrixProblems.push(`not a Mod line in mod-pool.md: ${name}`);
  const offensiveOnly = ['Physical power flat', 'Physical power %', 'Magic power flat', 'Magic power %', 'Elemental power flat', 'Elemental power %', 'Critical chance %', 'Critical damage %', 'Attack speed %', 'Accuracy %', 'Attack damage %', 'Spell damage %'];
  // The off hand is a weapon/defence hybrid (a Book carries the magic pair on its Frame Mod line),
  // so the leak rule reads the armour slots only — helmet through cape.
  const armourCols = (n: string) => {
    const row = modMatrix().split('\n').find((l) => l.startsWith(`| ${n} | `));
    return row ? row.split('|').map(cleanMod).slice(4, 13) : [];
  };
  const leaked = offensiveOnly.filter((n) => armourCols(n).some((c) => c === 'yes'));
  if (leaked.length) matrixProblems.push(`Offensive Mod reaching a Defensive slot: ${leaked.join(', ')}`);
  const gearLeak = GEAR_MODS.filter((n) => modMatrix().includes(`| ${n} | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes`));
  if (gearLeak.length) matrixProblems.push(`Gear Mod outside the 5 armour slots: ${gearLeak.join(', ')}`);
  add('X18', matrixProblems.length === 0,
    matrixProblems.length ? matrixProblems.join(' · ')
      : `Mod matrix holds ${matrixRows.length} named lines, all of them real Mod lines · ${offensiveOnly.length} Offensive lines stay off the armour slots · Gear Mod stays on the 5 armour slots · Stat Mod on all ${SLOT_ORDER.length} slots`);

  // The curve's skill term is a canary: mob_PS and the reference read-backs divide out of the
  // static HP table through this roster-wide level term, so moving `skill_per_level` silently
  // re-bases them. The gate holds the value the design states, so a re-tune has to be deliberate.
  {
    const perLevel = E.mob.curve.skill_per_level;
    const at100 = 1 + perLevel * 100;
    watch('X58', Math.abs(at100 - 1.34) < 0.005,
      `the level-100 skill multiplier reads ×${at100.toFixed(3)} — off the ×1.34 the skill tables were written against; re-quoting them is the owner's call`,
      `the level-100 skill multiplier reads ×${at100.toFixed(3)} from skill_per_level ${perLevel} — the curve spends ×1.34, so moving that coefficient is a re-base and must say so here`);
  }

  // ---------------------------------------------------------------- the doc linter (X59 · L9 · L10)
  // The prose shelf that survives, and the record of what was retired, are shared by the three gates:
  // X59 holds the retired words out of it, L9 holds the numbers out of it, L10 holds the pointers honest.
  const ALIASES = readJson(path.join(import.meta.dirname, 'data', 'aliases.json'));
  const prose = ['doc/glossary.md', 'doc/DECISIONS.md', 'AGENTS.md'];

  // A retired word must not creep back. The record is `tools/data/aliases.json`; this reads the prose
  // that survives (`doc/` and the root rules) and every data note, and honours each entry's own
  // `allow_in` list. `renames` and `deprecated` blocks are the record of the rename itself, so they are
  // skipped wherever they appear.
  {
    const SKIP_KEYS = new Set(['renames', 'deprecated', 'aliases']);
    const stringsOf = (v: any, out: string[] = []): string[] => {
      if (typeof v === 'string') out.push(v);
      else if (Array.isArray(v)) for (const x of v) stringsOf(x, out);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) stringsOf(x, out);
      return out;
    };
    const haystack: [string, string][] = [];
    const parked = fs.existsSync(path.join(ROOT, 'draft'))
      ? fs.readdirSync(path.join(ROOT, 'draft')).filter((n) => n.endsWith('.md')).map((n) => 'draft/' + n) : [];
    const termFiles = prose.concat(['doc/todo.md'], parked);
    for (const f of termFiles) { try { haystack.push([f, fs.readFileSync(path.join(ROOT, f), 'utf8')]); } catch { /* the file may not exist yet */ } }
    for (const f of fs.readdirSync(path.join(import.meta.dirname, 'data'))) {
      if (!f.endsWith('.json') || f === 'aliases.json') continue;
      haystack.push(['tools/data/' + f, stringsOf(readJson(path.join(import.meta.dirname, 'data', f))).join('\n')]);
    }
    // The player reads the client, not the doc shelf, so a retired word may not ship in a UI string.
    // History comments and data keys are out of scope: comments are allowed to name the old word, and
    // `rarity:` / `v.rarity` is the junk rung, an unrelated word spelled the same. So this reads only
    // what a player can see — a string literal, or the text between tags in a template.
    const quoted = (s: string) => (s.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) || []).join(' ');
    const markup = (s: string) => s
      .replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ').replace(/\{@const[\s\S]*?\}/g, ' ')
      .replace(/\{[^{}]*\}/g, ' ').replace(/<[^>]+>/g, ' ');
    const codeProse: [string, string][] = [];
    for (const dir of ['game/src', 'engine']) {
      const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(d, e.name);
        if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
        return /\.(svelte|ts)$/.test(e.name) ? [p] : [];
      });
      for (const f of walk(path.join(ROOT, dir))) {
        const txt = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
        const rel = path.relative(ROOT, f).replace(/\\/g, '/');
        codeProse.push([rel, `${quoted(txt)} ${/\.(svelte|html)$/.test(rel) ? markup(txt) : ''}`]);
      }
    }
    const esc = (s: any): string => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tHits: string[] = [];
    for (const t of ALIASES.terms || []) {
      const allow = new Set([...(t.allow_in || []), ...(t.allow_in_data || [])]);
      const guard = (t.not_prefix || []).map((x: any) => `(?<!${esc(x)} )`).join('');
      const re = new RegExp(guard + '\\b' + esc(t.old) + '\\b', 'i');
      for (const [file, text] of haystack) {
        if (allow.has(file) || allow.has(file.replace(/^.*\//, ''))) continue;
        if (re.test(text)) tHits.push(`${file} "${t.old}" → ${t.new}`);
      }
    }
    add('X59', tHits.length === 0,
      tHits.length ? tHits.slice(0, 8).join(' · ')
        : `${(ALIASES.terms || []).length} retired term(s) stay retired across ${termFiles.length} prose file(s) and every data note, honouring each entry's own allow-list — client and engine source is no longer scanned, because a retired word there is a rename in progress`);
  }

  // L9 · the prose-number ratchet the data owns (`engine.json doc_prose`): a number typed into prose has
  // no writer, so it cannot move with the data and nothing detects it going stale. The rule and the cap
  // are the data's; this counts the hand-typed lines and holds the cap, which may only fall.
  // Structural digits are not values — a section heading, a list ordinal, a table's row index — and
  // `todo.md` is exempt (the work file), as the data's own `exempt` line says; a line opts out with
  // `lint:allow`.
  {
    const DP = E.doc_prose || {};
    const hits: string[] = [];
    for (const f of prose) {
      let text: string; try { text = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { continue; }
      let fence = false;
      text.split(/\r?\n/).forEach((l, i) => {
        if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return; }
        if (fence || /lint:allow/.test(l)) return;
        if (/^\s*#{1,6}\s/.test(l)) return;
        if (/^\s*(?:\d+|[a-z])[.)]\s/.test(l)) return;
        const cells = l.split('|').map((c) => c.trim());
        if (cells.length > 2 && /^\d+$/.test(cells[1])) return;
        if (/\d/.test(l)) hits.push(`${f}:${i + 1}`);
      });
    }
    watch('L9', hits.length <= (DP.lines_max ?? 0),
      `${hits.length} prose line(s) carry a hand-typed number against the cap ${DP.lines_max} (${DP.rule}) · exempt: ${DP.exempt} · over the cap, move the figure to the key that owns it or mark the line \`lint:allow\`${hits.length ? ` · first: ${hits.slice(0, 6).join(' · ')}` : ''}`,
      `${hits.length} prose line(s) carry a hand-typed number, inside the cap ${DP.lines_max} (${DP.rule}) — a watch, so prose hygiene never blocks a feature`);
  }

  // L10 · a pointer to a retired doc must still resolve. The prose shelf collapsed to `doc/` plus
  // the root rules, and the citations stayed where they were written, so `tools/data/aliases.json`
  // `docs` records the name and the file that owns its numbers now. A pointer to a doc that neither
  // exists nor is recorded is a pointer to nothing. Generated views (`wiki/`, `tools/wiki.ts`) are the
  // wiki's own output and read by nobody here, so they are out of the scan.
  {
    const DOCS = ALIASES.docs || {};
    const live = new Set<string>();
    const hidden = (n: string) => n.startsWith('.');
    const collect = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) { if (!['node_modules', 'dist', 'wiki'].includes(e.name) && !hidden(e.name)) collect(path.join(d, e.name)); }
        else if (/\.md$/.test(e.name) && !/\.template\.md$/.test(e.name)) live.add(e.name);
      }
    };
    collect(ROOT);
    const scanned: string[] = [];
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) return ['node_modules', 'dist', 'wiki', 'icon'].includes(e.name) || hidden(e.name) ? [] : walk(p);
      if (!/\.(ts|svelte|json|md)$/.test(e.name)) return [];
      if (p.endsWith(path.join('tools', 'wiki.ts')) || p.endsWith('aliases.json')) return [];
      return [p];
    });
    let dead = 0;
    for (const f of ['engine', 'tools', 'game', 'doc', 'draft'].flatMap((d) => walk(path.join(ROOT, d)))) {
      const txt = fs.readFileSync(f, 'utf8');
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      for (const m of txt.matchAll(/\b([a-z][a-z0-9-]*\.md)\b/g)) {
        const n = m[1];
        if (live.has(n) || DOCS[n] || n === 'todo.md') continue;
        dead++; scanned.push(`${rel} → ${n}`);
      }
    }
    add('L10', dead === 0,
      dead ? `${dead} dangling pointer(s): ${[...new Set(scanned)].slice(0, 8).join(' · ')}`
        : `every doc pointer resolves: ${Object.keys(DOCS).length} retired name(s) mapped to the data/engine file that owns them now, and the surviving shelf (${[...live].sort().join(' · ')}) is read from disk`);
  }

  // Minute one is a read a client performs, so the opening set must be complete and resolvable: one
  // piece per slot, and every `base` a real frame (a weapon TYPE for the hand, a Base for the rest).
  {
    const OP = E.opening || {};
    const want = [...BASES_JSON.slots, 'main hand'];
    const opProblems: string[] = [];
    const seen = new Set<string>();
    for (const g of OP.gear || []) {
      seen.add(g.slot);
      if (g.slot === 'main hand') {
        if (!(BASES_JSON.weapons || []).some((w: any) => w.name === g.base)) opProblems.push(`main hand "${g.base}" is not a weapon type`);
      } else if (!(BASES_JSON.bases || []).some((b: any) => b.name === g.base)) opProblems.push(`${g.slot} "${g.base}" is not a Base frame`);
      if (g.quality !== 'low' || g.tier !== 3) opProblems.push(`${g.slot} is not the floor of its window (${g.quality} T${g.tier})`);
    }
    for (const s of want) if (!seen.has(s)) opProblems.push(`no opening piece for ${s}`);
    if (OP.level !== 1) opProblems.push(`the opening level is ${OP.level}, not 1`);
    const noStones = OP.stones == null || OP.stones === 0 || (typeof OP.stones === 'object' && Object.keys(OP.stones).length === 0);
    if (OP.gold !== 0 || !noStones) opProblems.push(`minute one buys nothing, so gold and stones must be 0 (gold ${OP.gold}, stones ${JSON.stringify(OP.stones)})`);
    if ((OP.skills || []).length) opProblems.push('the opening set carries no skill');
    add('X60', opProblems.length === 0,
      opProblems.length ? opProblems.join(' · ')
        : `the opening set is complete and resolvable: ${(OP.gear || []).length} pieces covering all ${want.length} slots, every frame named in bases.json, each at the floor of its own window, level ${OP.level} with nothing bought and no skill`);
  }

  return rows();
}

// ---------------------------------------------------------------- Mod availability (X18)
// The engine's own craft pool, rebuilt from `bases.json` + `mods.json`, so X18 can assert every
// line the matrix names is a line the loot pool can actually roll. Nothing here is typed by hand.

const SLOT_ORDER = ['main hand', 'off hand', 'helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'amulet', 'earring', 'cape'];
const GEAR_MOD_SLOTS = ['helmet', 'chest', 'pant', 'boots', 'gloves']; // `bases.json` `school`
const GEAR_MODS = ['Armour flat', 'Evasion flat', 'Energy Shield flat'];
const STAT_MODS = ['Stat Mod flat', 'All stats flat']; // the Stat Mod slot's family — one line per item
const ARMOUR_SLOTS = ['helmet', 'chest', 'pant', 'boots', 'gloves', 'cape'];
const STAT_KEYS = ['str', 'agi', 'vit', 'dex', 'int', 'wis', 'lck'];

const cleanMod = (s: string) => s.replace(/\s+/g, ' ').trim();
const modName = (id: string) => LOOT_NAMES[id] || id;
const modBase = (n: string) => n.replace(/\s+(flat|%)$/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim();

/** Every Mod name that carries a value range — `tools/data/mods.json` is the only source. */
function rangedMods() {
  return new Set(MODS.mods.map((m: any) => m.name));
}

/** Per-slot pool, engine-faithful: `bases[].primary/secondary` plus the lines the slot adds. */
function framePools() {
  const bySlot: Record<string, Set<string>> = {};
  const add = (slot: string, ids: any[]) => {
    const set = bySlot[slot] || (bySlot[slot] = new Set());
    for (const id of ids) set.add(modName(id));
  };
  for (const b of BASES_JSON.bases) add(b.slot, [...(b.primary || []), ...(b.secondary || [])]);
  // engine/loot.ts `poolFor`: the armour slots' own line-1 pool is also rollable
  for (const slot of ARMOUR_SLOTS) add(slot, BASES_JSON.frame_mod?.defence || []);
  // engine/loot.ts `poolFor`: an off-hand frame draws its slot union plus its family's row
  for (const [family, ids] of Object.entries<any>(BASES_JSON.weapon_pools?.['off hand'] || {})) {
    if (family === 'Stat Mod' || family === 'Dual-wield weapon') continue;
    add('off hand', ids);
  }
  return bySlot;
}

/** Line 1 is the frame's own Frame Mod and never enters a craftable pool (engine/loot.ts `frameModRoll`). */
function line1Pools() {
  const names = rangedMods();
  const out: Record<string, Set<string>> = {};
  const add = (slot: string, ids: any[]) => {
    const set = out[slot] || (out[slot] = new Set());
    for (const id of ids) { const n = modName(id); if (names.has(n)) set.add(n); }
  };
  for (const ids of Object.values<any>(BASES_JSON.frame_mod?.weapons || {})) add('main hand', ids);
  for (const ids of Object.values<any>(BASES_JSON.frame_mod?.off_hand || {})) add('off hand', ids);
  for (const slot of ARMOUR_SLOTS) add(slot, BASES_JSON.frame_mod?.defence || []);
  return out;
}

/** The weapon pool, engine-faithful: engine/loot.ts `poolFor`'s weapon branch, over both damage kinds. */
function weaponPools() {
  const wp = BASES_JSON.weapon_pools?.['main hand'] || {};
  const crit = (wp.Primary || []).filter((id: string) => !id.startsWith('physical') && !id.startsWith('magic'));
  const fixed = new Set(['Primary', 'Secondary', 'Stat Mod', 'Blocked', 'Weapon']);
  const typePools = Object.entries<any>(wp).filter(([key]) => !fixed.has(key)).flatMap(([, ids]) => ids);
  const ids = ['physical_power_flat', 'physical_power', 'magic_power_flat', 'magic_power', ...crit, ...(wp.Secondary || []), ...typePools];
  return new Set(ids.map(modName));
}

let modMatrixCache: string | null = null;
function modMatrix() {
  // a pure function of the static pools, and runChecks() asks for it a dozen times, so it is built once
  if (modMatrixCache !== null) return modMatrixCache;
  const pools = framePools();
  const line1 = line1Pools();
  const weapon = weaponPools();
  const slots: Record<string, Set<string>> = {};
  for (const slot of SLOT_ORDER) {
    const set = new Set(slot === 'main hand' ? weapon : (pools[slot] || []));
    for (const one of (line1[slot] || [])) set.add(one);
    for (const one of GEAR_MODS) if (GEAR_MOD_SLOTS.includes(slot)) set.add(one);
    for (const one of STAT_MODS) set.add(one);
    slots[slot] = set;
  }

  const all = new Set<string>();
  const STATS = ['Str', 'Vit', 'Dex', 'Agi', 'Wis', 'Int', 'Lck'];
  for (const s of SLOT_ORDER) for (const one of slots[s]) if (!STATS.includes(modBase(one))) all.add(one);
  const rank = (x: string) => (STAT_MODS.includes(x) ? 0 : GEAR_MODS.includes(x) ? 2 : 1);
  const rows = [...all].sort((a: string, b: string) => rank(a) - rank(b) || a.localeCompare(b));
  const mark = (mod: string, slot: string) => ((slots as any)[slot].has(mod) ? 'yes' : '-');
  modMatrixCache = [
    '| Mod | ' + SLOT_ORDER.join(' | ') + ' |',
    '|---|' + SLOT_ORDER.map(() => '---').join('|') + '|',
    ...rows.map((mod: string) => `| ${mod} | ` + SLOT_ORDER.map((s: string) => mark(mod, s)).join(' | ') + ' |'),
  ].join('\n');
  return modMatrixCache;
}

// ---------------------------------------------------------------- the derived anchors
// A published anchor is a copy of a figure the engine derives from other data. The gate keeps it
// EXACT — that is what catches a stale figure — so a balance nudge upstream trips it, and the honest
// repair is to re-publish the copy, never to widen the tolerance. `--sync` does the re-publishing
// from the engine; the anchor declares itself here and nowhere else. What the loot simulation
// MEASURES is a different class and belongs to `tools/loot.ts --sync`.
const ANCHORS: any[] = [
  {
    file: 'engine.json',
    label: 'build.hit_chance_pct',
    re: /("hit_chance_pct":\s*)(\d+)/,
    want: () => String(Math.round(DERIVED.ref_build_hit_pct)),
  },
];

function sync() {
  const texts: Record<string, string> = {};
  for (const f of [...new Set(ANCHORS.map((a: any) => a.file))])
    texts[f] = fs.readFileSync(path.join(ROOT, 'tools', 'data', f), 'utf8');
  const moved: Record<string, string[]> = {};
  let missing = 0;
  for (const a of ANCHORS) {
    const m = texts[a.file].match(a.re);
    const want = a.want();
    if (!m) { console.log(`MISSING ${a.label} in tools/data/${a.file}`); missing++; continue; }
    if (m[2] === want) continue;
    texts[a.file] = texts[a.file].replace(a.re, `$1${want}`);
    (moved[a.file] = moved[a.file] || []).push(`${a.label} ${m[2]} → ${want}`);
  }
  const files = Object.keys(moved);
  for (const f of files) fs.writeFileSync(path.join(ROOT, 'tools', 'data', f), texts[f], 'utf8');
  const n = files.reduce((t: any, f: any) => t + moved[f].length, 0);
  console.log(n === 0
    ? `every derived anchor already carries the engine figure (${ANCHORS.map((a: any) => `${a.label} ${a.want()}`).join(' · ')}) — nothing written`
    : `${n} anchor(s) re-published: ${files.map((f: any) => `${f} ${moved[f].join(' · ')}`).join(' | ')}${missing ? ` · ${missing} MISSING` : ''}`);
}

// ---------------------------------------------------------------- cli

const arg = process.argv[2];

if (arg === '--checks') {
  G.report(runChecks());
} else if (arg === '--sync') {
  sync();
} else {
  console.log(`engine cage — data: tools/data/engine.json (the same file the client and the other cages read)

  node tools/check.ts --checks   run the invariants, exit 1 on FAIL
  node tools/check.ts --sync     re-publish the derived anchors from the engine into tools/data/
`);
}
