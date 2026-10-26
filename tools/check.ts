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
import { modRangeProblems } from './lib/mod-ranges.ts';

const { E, S, K, M, LG, BAND, BANDS, CEIL, SPLIT, FORCED_SPLIT, FOCUSED_CEIL, DERIVED, ES, WEAPONS, STONE, LCK_BOUND, L, C, TS } = eng;
const MODS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/data/mods.json'), 'utf8'));
const MOB_SKILLS = readJson(path.join(import.meta.dirname, 'data/mob-skills.json'));
const BASES_JSON = readJson(path.join(import.meta.dirname, 'data/bases.json'));
const f0 = (x: number) => Math.round(x).toLocaleString('en-US');
const f1 = (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    ['F5', 'eligible salvage pieces per kill', `(drops − upgrades) per kill`, `**${perKill('high', b.high.junk_per_hr).toFixed(4)}**`],
    ['F6', 'Alchemy Value stones per kill', `F5 × ${E.salvage.outputs.scrap} Scrap × ${E.salvage.alchemy.value_yield} Value ÷ ${E.salvage.alchemy.scrap_cost} Scrap`, `**${perKill('high', eng.rerollValueStonesPerHr('high')).toFixed(4)}**`],
    ['F7', 'Tier stone per kill, including Alchemy', `elite ${perKill('high', b.high.kills_derived * L.elite_spawn_chance * L.elite_tier_stones).toFixed(4)} + boss ${perKill('high', L.boss_per_hour * L.boss_tier_stones).toFixed(4)} + Alchemy ${perKill('high', eng.alchemyTierStonesPerHr('high')).toFixed(4)} (${E.salvage.alchemy.outputs_per_tier_stone} Value per Tier)`, `${perKill('high', STONE.tier_stones_per_hr).toFixed(4)}`],
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
  const { add, pending, rows } = G.gates();
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
  soft('X5', BANDS.every((b) => BAND[b].drops_per_hr === Math.round(BAND[b].kills_derived * (BAND[b].drop_chance_pct / 100))) && BAND.high_full_lck.drops_per_hr === Math.round(BAND.high_full_lck.kills_derived * (BAND.high_full_lck.drop_chance_pct / 100)),
    `F3 = F1 × F2 for all four rows: ${['low', 'mid', 'high', 'high_full_lck'].map((b) => `${f0(BAND[b].drops_per_hr)} ${BAND_LABEL[b]}`).join(' · ')}`);
  soft('X6', BANDS.every((b) => BAND[b].junk_per_hr === BAND[b].drops_per_hr - BAND[b].upgrades_per_hr),
    `reference junk = drops − upgrades everywhere; the base junk-value and stone streams share the loot ceiling before town demand and field goods (G2 · G8)`);
  // The craft pacing is priced in KILLS (the kills-not-hours rule): what a kill pays is a drop line, so a set's cost is the
  // kills it takes, never an hour. `perKillK` turns each hourly figure into its per-kill drop, and
  // `killsFor` reads a set's stone count back out as kills off that same line.
  const perKillK = (perHr: number) => perHr / BAND.high.kills_derived;

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
  const capped = WEAPONS.filter((w) => !w.reachable).map((w) => w.name);
  soft('X13', capped.length === WEAPONS.length,
    `the clock Cap ${E.caps.attack_interval_sec} sec a swing (= ${f1(100 / E.caps.attack_interval_sec)} hits/sec, derived as 100 ÷ the interval) is out of reach for every weapon at the Agi ceiling: ${WEAPONS.map((w) => `${w.name} ${f0(w.agi_to_cap)}`).join(' · ')} vs ceiling ${f0(CEIL)} — the Cap is a clock rule, not a build target, and K_AGI_ASPD stays at ${K.K_AGI_ASPD} so no weapon crowds it`);
  const sword = WEAPONS.find((w) => w.name === 'one-handed sword');
  // The reference anchor is the rule; how many types exist is content. A missing multiplier shows up as
  // `weapon_mult` undefined on that row, so an added type still cannot slip through.
  add('X14', WEAPONS.length > 0 && WEAPONS.every((w) => w.weapon_mult > 0) && sword?.weapon_mult === 1,
    `${WEAPONS.length} type-specific multipliers, all positive, and the one-handed sword holds the reference at 1.00`);

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


  // items 2 + 4 · explicit potion-source species drop a potion, and the chance is DERIVED from the band's own
  // herb stream rather than typed: the farm stays the primary provisioning source by construction.
  const potProblems: string[] = [];
  const potionSources = (E.mob.species as any[]).filter((r) => r.potion_source).map((r) => r.id);
  if (!potionSources.length) potProblems.push('no species has potion_source enabled, so the potion drop has no source');
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
    : `${potionSources.length} Species have explicit potion_source (${potionSources.join(' · ')}) · Race membership does not grant potion drops · the chance is the band's own herb stream ÷ a potion's herb cost: ${['low', 'mid', 'high'].map((b) => `${b} ${f2(dropOf(b) * 100)}%`).join(' · ')} per kill, always under that band's herb chance, so the farm stays the primary source (items 2 + 4)`);

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

  // X53: species.zones owns zone eligibility; each subzone is an independent Species pool and pools may overlap.
  // Their union must cover the zone cast. Variants supply names/Core by zone midpoint; zone_levels supplies
  // each Species' actual fixed level, and subzones carry no variant list.
  const subProblems: string[] = [];
  {
    const raceSet = new Set((E.mob.races?.set || []) as string[]);
    if (!raceSet.size) subProblems.push('mob.races.set is empty');
    if (raceSet.size !== (E.mob.races?.set || []).length) subProblems.push('mob.races.set contains duplicate race ids');
    const byId = new Map((E.mob.species as any[]).map((s) => [s.id, s]));
    const variants = (E.mob as any).variants || {} as Record<string, { name: string; levels: [number, number] }[]>;
    const variantOwner = new Map<string, string[]>();
    for (const [sid, rows] of Object.entries(variants)) for (const v of (rows as { name: string }[])) {
      if (!variantOwner.has(v.name)) variantOwner.set(v.name, []);
      variantOwner.get(v.name)!.push(sid);
    }
    for (const sid of Object.keys(variants)) if (!byId.has(sid)) subProblems.push(`variants row ${sid} names no species`);
    for (const s of (E.mob.species as any[])) {
      if (!raceSet.has(s.race)) subProblems.push(`${s.name} belongs to unknown Race ${s.race}`);
      if (!(s.id in variants)) subProblems.push(`${s.name} has no variants row`);
      else if (!(variants[s.id] as any[]).length) subProblems.push(`${s.name} has no Variant and cannot be fielded`);
      else for (const v of (variants[s.id] as { name: string; levels: [number, number] }[])) {
        const [lo, hi] = v.levels || [];
        if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || hi < lo || hi > E.mob.form_level_cap)
          subProblems.push(`${s.name} variant ${v.name} levels [${lo}, ${hi}] are not a real band`);
      }
    }
    for (const [name, owners] of variantOwner) if (owners.length > 1) subProblems.push(`Variant ${name} is owned by multiple Species: ${owners.join(', ')}`);
    for (const z of (E.mob.zones as any[])) {
      const want = new Set(eng.speciesInZone(z.id));
      const shown = new Set<string>((z.subzones || []).flatMap((s: any) => s.species || []));
      for (const r of shown) {
        if (!byId.has(r)) { subProblems.push(`zone ${z.id} subzone names unknown species ${r}`); continue; }
        if (!want.has(r)) subProblems.push(`${r} shown in zone ${z.id} but placed in zones ${(byId.get(r).zones || []).join(',')}`);
      }
      for (const r of want) if (!shown.has(r)) subProblems.push(`${r} placed in zone ${z.id} but shown in no subzone there`);
      for (const s of (z.subzones || [])) {
        if ('normal' in s || 'elite' in s) subProblems.push(`zone ${z.id} ${s.name} declares variants: the Species ladder owns names, subzones own only Species ids`);
        if ((z.levels as number[])[1] <= E.mob.form_level_cap) {
          for (const r of (s.species || [])) {
            const fielded = eng.variantsInZone(r, z.id);
            if (fielded.length !== 1) subProblems.push(`${r} in zone ${z.id} fields ${fielded.length} variants; expected one midpoint band`);
          }
        }
      }
    }
    const uniques = ((E.mob as any).uniques || []) as any[];
    for (const u of uniques) if (!byId.has(u.species)) subProblems.push(`unique ${u.name} names no species ${u.species}`);
  }
  add('X53', subProblems.length === 0, subProblems.length ? subProblems.join(' · ')
    : `${E.mob.races.set.length} Races classify ${E.mob.species.length} Species, every Species references a Race and has at least one Variant; ${E.mob.zones.length} zones read eligibility from speciesInZone, subzone Species pools may overlap across environments while their union covers each zone cast, and any declared Unique maps to a Species`);

  // the subzone environments each zone's sides stand on (X73 reads the set for the drop lean)
  const mobEnvironments = new Set<string>((E.mob.zones as any[]).flatMap((z) =>
    (z.subzones || []).map((s: any) => s.environment)));

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
  for (const u of ((E.mob as any).uniques || []) as any[]) {
    const species = (E.mob.species as any[]).find((s) => s.id === u.species);
    if (!species) { bossProfileProblems.push(`${u.name}: missing species ${u.species}`); continue; }
    if (!u.core || STAT_KEYS.some((key) => !Number.isInteger(u.core[key]) || u.core[key] < 0)) bossProfileProblems.push(`${u.name}: Core must contain whole non-negative stats`);
    if (u.core?.wis !== 0) bossProfileProblems.push(`${u.name}: Wis is not live on mobs`);
    if (!(u.damage in (E.mob.damage_split as any))) bossProfileProblems.push(`${u.name}: unknown damage tag ${u.damage}`);
    if (!(E.elements.order as string[]).includes(u.element)) bossProfileProblems.push(`${u.name}: unknown Element ${u.element}`);
    if (!physicalBodies.has(u.reads_as)) bossProfileProblems.push(`${u.name}: reads_as must name a body class`);
    if (!(u.accuracy_mult > 0) || !u.trait) bossProfileProblems.push(`${u.name}: accuracy tier or trait is missing`);
  }

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
      else if (key === 'bleed_immune' && !(TM[key].statuses || []).includes('bleed')) tp.push('bleed_immune: it must name the status it refuses');
    }
    const mechanicCount: Record<string, number> = {};
    for (const sp of E.mob.species) {
      const mech = (sp as any).mechanics || {};
      for (const [key, arg] of Object.entries(mech) as [string, any][]) {
        if (!set.includes(key)) tp.push(`${sp.id}: ${key} is not in mob.trait_mechanics.set`);
        mechanicCount[key] = (mechanicCount[key] || 0) + 1;
        if (arg !== true) tp.push(`${sp.id}: ${key} takes no argument but carries ${JSON.stringify(arg)}`);
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
    // What must hold is the published mix, not which kinds a zone happens to spend: each zone's sides
    // average back to the plain body mix. Authoring a new pack kind or a fourth side cannot break
    // this, while a tilted zone still turns the gate red.
    const mixOf = (name: string): [number, number] => {
      const p = (name && packs[name]) || packs['even'] || {};
      const total = (p.small || 0) + (p.medium || 0);
      return total ? [(p.small || 0) / total, (p.medium || 0) / total] : [0, 0];
    };
    const evenMix = mixOf('even');
    const mid = (g: string) => { const [lo, hi] = String(g).split('-').map(Number); return ((lo || 1) + (hi || lo || 1)) / 2; };
    const zoneList = E.mob.zones as any[];
    let profiled = 0;
    for (const z of zoneList) {
      const subs = z.subzones || [];
      if (!subs.length) continue;
      const kinds = subs.map((s: any) => (s.spawn || {}).pack);
      // The published line is the body mix, not the kind list: a zone's sides must average back to the
      // plain mix whatever kinds it spends. A new pack kind or a fourth side cannot fail this, while a
      // zone that leans its whole encounter still turns the gate red.
      const mixSum = subs.reduce((t: number[], s: any) => {
        const m = mixOf((s.spawn || {}).pack);
        return [t[0] + m[0], t[1] + m[1]];
      }, [0, 0]);
      const meanSmallShare = mixSum[0] / subs.length;
      const meanMediumShare = mixSum[1] / subs.length;
      if (Math.abs(meanSmallShare - evenMix[0]) > 1e-9 || Math.abs(meanMediumShare - evenMix[1]) > 1e-9) {
        sp2.push(`zone ${z.id}: its sides average ${f1(meanSmallShare * 100)}% Small / ${f1(meanMediumShare * 100)}% Medium, not the plain ${f1(evenMix[0] * 100)}% / ${f1(evenMix[1] * 100)}% (${kinds.join(' ') || 'all bare'})`);
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
      : `${profiled}/${zoneList.filter((z: any) => (z.subzones || []).length).length} zones field a per-side pack, Elite rate and body mix; each zone's sides average back to its published group, its ${f1(E.loot.elite_spawn_chance * 100)}% Elite rate and the plain ${f1(evenMix[0] * 100)}% Small / ${f1(evenMix[1] * 100)}% Medium mix — no fixed pack list per zone`);
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
    const placedIds = new Set(placed.map((sp) => sp.id));
    for (const [speciesId, form] of Object.entries<any>(zoneForms)) {
      if (!placedIds.has(speciesId)) formProblems.push(`zone ${z.id}: form names unplaced Species ${speciesId}`);
      if (form.levels?.[0] !== z.levels[0] || form.levels?.[1] !== z.levels[1]) formProblems.push(`${z.id}/${speciesId}: form range does not match the zone`);
      if (!form.name || formNames.has(form.name)) formProblems.push(`${z.id}/${speciesId}: form name is missing or duplicated (${form.name || 'empty'})`);
      else formNames.add(form.name);
      for (const key of formCoreKeys) if (!Number.isInteger(form.core?.[key])) formProblems.push(`${z.id}/${speciesId}: form Core ${key} is missing or not an integer`);
    }
  }
  add('X76', formProblems.length === 0, formProblems.length ? formProblems.join(' · ')
    : `${formNames.size} authored field forms are uniquely named and zone-valid; missing forms inherit the previous label, while Variants own live Core and Elite/Boss remain rank overlays`);

  const formDropProblems: string[] = [];
  const dropVariants = (E.mob as any).variants || {};
  const formDropRows = (E.mob as any).variant_drops || {};
  for (const sp of E.mob.species) {
    const ladder = (dropVariants[sp.id] || []) as { name: string; core?: Record<string, number> }[];
    for (const v of ladder) {
      const row = formDropRows[v.name];
      if (!row || typeof row.item !== 'string' || typeof row.rarity !== 'string' || typeof row.lean !== 'string')
        formDropProblems.push(`${sp.id}: variant ${v.name} has no complete item/rarity/lean row`);
      for (const key of ['str', 'agi', 'vit', 'dex', 'int', 'wis', 'lck']) {
        if (!Number.isInteger(v.core?.[key])) formDropProblems.push(`${sp.id}: variant ${v.name} Core ${key} is missing or not an integer`);
      }
    }
  }
  add('X78', formDropProblems.length === 0, formDropProblems.length ? formDropProblems.join(' · ')
    : `every authored Variant has an integer Core and complete item/rarity/lean row`);

  // The Core spend audit: every body spends whole points on live stats only, and Dex follows
  // the band ceilings in `mob.core_spend` instead of swallowing a level band's whole growth.
  const spendProblems: string[] = [];
  const coreSpend = (E.mob as any).core_spend || {};
  const dexCap = coreSpend.dex_cap as number[] | undefined;
  const spendCaps = Array.isArray(dexCap) ? dexCap.join(' / ') : 'missing';
  if (!Array.isArray(dexCap) || dexCap.length !== 5 || dexCap.some((n) => !Number.isInteger(n) || n <= 0)) {
    spendProblems.push('mob.core_spend.dex_cap must hold five positive whole band ceilings');
  } else {
    const variantBand = (levels: [number, number]) => Math.min(4, Math.max(0, Math.floor((levels[0] - 1) / 20)));
    const zoneBand = (zone: number) => Math.min(4, Math.max(0, Math.floor((zone - 1) / 2)));
    const liveKeys = (damage: string) => damage === 'physical'
      ? ['str', 'agi', 'vit', 'dex', 'lck']
      : ['str', 'agi', 'vit', 'dex', 'int', 'lck'];
    const audit = (label: string, core: any, damage: string, cap: number) => {
      for (const key of STAT_KEYS) {
        if (!Number.isInteger(core?.[key]) || core[key] < 0) spendProblems.push(`${label}: ${key} must be a whole non-negative stat`);
      }
      if (core?.wis !== 0) spendProblems.push(`${label}: Wis ${core?.wis} is dead on a mob and must be 0`);
      if (damage === 'physical' && core?.int !== 0) spendProblems.push(`${label}: physical Int ${core?.int} is dead and must be 0`);
      for (const key of liveKeys(damage)) {
        if (!(core?.[key] > 0)) spendProblems.push(`${label}: live ${key} has no authored points`);
      }
      if (core?.dex > cap) spendProblems.push(`${label}: Dex ${core.dex} is over the ${cap} band ceiling`);
    };
    const variants = ((E.mob as any).variants || {}) as Record<string, any[]>;
    for (const sp of E.mob.species) {
      audit(`species ${sp.id}`, sp.core, sp.damage, dexCap[0]);
      for (const v of variants[sp.id] || []) audit(`${sp.id}/${v.name}`, v.core, v.damage ?? sp.damage, dexCap[variantBand(v.levels)]);
    }
    for (const [zoneId, forms] of Object.entries(((E.mob as any).forms || {}) as Record<string, Record<string, any>>)) {
      for (const [speciesId, form] of Object.entries(forms)) {
        const sp = E.mob.species.find((s) => s.id === speciesId);
        if (!sp) {
          spendProblems.push(`form z${zoneId}/${speciesId}: no Species`);
          continue;
        }
        audit(`form z${zoneId}/${speciesId}`, form.core, sp.damage, dexCap[zoneBand(Number(zoneId))]);
      }
    }
    for (const boss of E.mob.bosses as any[]) audit(`boss ${boss.name}`, boss.core, boss.damage, dexCap[4]);
    for (const unique of (((E.mob as any).uniques || []) as any[])) audit(`unique ${unique.name}`, unique.core, unique.damage, dexCap[4]);
  }
  const variantCount = Object.values(((E.mob as any).variants || {}) as Record<string, any[]>).reduce((n, rows) => n + rows.length, 0);
  const formCount = Object.values(((E.mob as any).forms || {}) as Record<string, Record<string, any>>).reduce((n, rows) => n + Object.keys(rows).length, 0);
  const uniqueCount = (((E.mob as any).uniques || []) as any[]).length;
  add('X79', spendProblems.length === 0, spendProblems.slice(0, 8).join(' · ')
    || `${variantCount} Variants · ${formCount} forms · ${E.mob.species.length} Species · ${E.mob.bosses.length} Bosses · ${uniqueCount} Uniques — every body spends whole live points, Wis is 0, physical Int is 0, and Dex stays within ${spendCaps} by band`);

  // X80/X81: every Species owns one thematic material. The shape and the catalogue reference are
  // hard; the 5%-of-junk-line budget is a watch because it is a tuning figure, not a structural rule.
  {
    const townData = readJson(path.join(ROOT, 'tools/data/town.json'));
    const materialValues = (townData.trade && townData.trade.material_values) || {};
    const materialById = new Map((E.fieldwork.materials as any[]).map((material) => [material.id, material]));
    const allowedGroups = new Set(['ore', 'wood', 'craft']);
    const structure: string[] = [];
    const rows: { species: string; resource: string; newPct: number; combinedPct: number }[] = [];
    const junkLine = BAND.high.junk_per_hr / BAND.high.kills_derived;
    for (const sp of E.mob.species as any[]) {
      const bonus = sp.bonus_material;
      if (!bonus || typeof bonus !== 'object') { structure.push(`${sp.id}: no bonus_material`); continue; }
      const material = materialById.get(bonus.resource);
      if (!material) structure.push(`${sp.id}: unknown material ${bonus.resource}`);
      else if (!allowedGroups.has(material.group)) structure.push(`${sp.id}: material ${bonus.resource} is in an unbudgeted group ${material.group}`);
      const value = Number(materialValues[bonus.resource]);
      if (!(Number.isFinite(value) && value > 0)) structure.push(`${sp.id}: material ${bonus.resource} has no positive trade value`);
      if (bonus.resource === 'scrap') structure.push(`${sp.id}: scrap is salvage/Alchemy-only`);
      if (!(Number.isFinite(bonus.chance) && bonus.chance > 0 && bonus.chance <= 1)) structure.push(`${sp.id}: bonus chance must be above 0 and at most 1`);
      if (!Number.isInteger(bonus.min) || bonus.min <= 0 || !Number.isInteger(bonus.max) || bonus.max < bonus.min)
        structure.push(`${sp.id}: bonus min/max must be positive whole numbers with min <= max`);
      const newGold = bonus.chance * ((bonus.min + bonus.max) / 2) * (Number.isFinite(value) ? value : 0);
      let legacyGold = 0;
      for (const row of ((E.fieldwork.hunt as any).material_drops || []) as any[]) {
        if (!row.species.includes(sp.id)) continue;
        const legacyValue = Number(materialValues[row.resource]);
        if (Number.isFinite(legacyValue)) legacyGold += row.chance * ((row.min + row.max) / 2) * legacyValue;
      }
      rows.push({ species: sp.id, resource: bonus.resource, newPct: (newGold / junkLine) * 100, combinedPct: ((newGold + legacyGold) / junkLine) * 100 });
    }
    add('X80', structure.length === 0, structure.slice(0, 8).join(' · ')
      || `${rows.length} Species carry one themed bonus material · every resource resolves to a positive trade good in ore/wood/craft · scrap excluded · chance/min/max valid`);
    const budget = 5;
    const over = rows.filter((row) => row.newPct > budget);
    const combinedOver = rows.filter((row) => row.combinedPct > budget);
    const maxNew = rows.reduce((n, row) => Math.max(n, row.newPct), 0);
    const maxCombined = rows.reduce((n, row) => Math.max(n, row.combinedPct), 0);
    soft('X81', over.length === 0,
      over.length
        ? `${over.length} Species over the ${budget}% incremental budget: ${over.slice(0, 8).map((row) => `${row.species} ${row.newPct.toFixed(2)}%`).join(' · ')} · max ${maxNew.toFixed(2)}% · combined max ${maxCombined.toFixed(2)}%`
        : `${rows.length} Species · new material ${maxNew.toFixed(2)}% of the junk line (budget ${budget}%) · ${combinedOver.length} legacy combined row(s) over ${budget}% by design (max ${maxCombined.toFixed(2)}%)`);
  }

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
  // The mean is a property of the shipped roster and moves every time a Species is authored or
  // retired. It is reported in the gate line, never gated: `power_base` is a balance vector, an
  // exact mean would tax every correct roster edit, and AGENTS.md forbids a gate that prescribes
  // balance. What stays hard is that each value is finite and positive (X19 above) and that X20's
  // floor and ceiling Species exist to answer the Evasion Cap.
  // a retired lineage may not creep back into the roster — the `deprecated_species` record is what says so
  const zombie = Object.keys(MOB.deprecated_species || {}).filter((id) => MOB.species.some((r) => r.id === id));
  if (zombie.length) zoneProblems.push(`retired lineage(s) back in the roster: ${zombie.join(', ')}`);
  add('X19', bad.length === 0 && zoneProblems.length === 0 && sizeProblems.length === 0 && powerProblems.length === 0,
    bad.length ? `a species Core block is not a whole number, is negative, or carries a dead stat: ${bad.map((r) => `${r.name} (${r.vals})`).join(' · ')}`
      : zoneProblems.length ? `species listed in a zone outside 1-${ZONES.length}: ${zoneProblems.join(', ')}`
        : sizeProblems.length ? `species references a body class that does not exist: ${sizeProblems.join(', ')}`
          : powerProblems.length ? powerProblems.join(' · ')
            : `${E.mob.races.set.length} Races · ${MOB.species.length} Species × ${MOB.sizes.length} body classes · Core blocks stay whole, Wis is 0 everywhere and Int is 0 on physical bodies · power_base spans ${Math.min(...speciesPower).toFixed(2)}-${Math.max(...speciesPower).toFixed(2)} with a ${speciesPowerMean.toFixed(2)} mean · ${Object.keys(MOB.deprecated_species || {}).length} retired Species stay out of the roster · accuracy spans ×${Math.min(...MOB.species.map((r) => r.accuracy_mult)).toFixed(2)}-×${Math.max(...MOB.species.map((r) => r.accuracy_mult)).toFixed(2)}, so the Evasion Cap ${E.caps.evasion} answers to the gear line against the floor and not against the ceiling (X20)`);

  // The species mix is what makes the Evasion Cap answerable, so guard a floor and a ceiling.
  // X20's question changed shape with the Agi ruling: Agi IS the rating now, so what must hold is
  // that a maxed Agi build caps against the accuracy floor, while the same rating lands well under
  // the Cap against the accuracy ceiling — and an even-split Agi lands lower still.
  const accMults = MOB.species.map((r) => r.accuracy_mult);
  const floorSpecies = MOB.species.find((species) => species.accuracy_mult === Math.min(...accMults));
  const ceilSpecies = MOB.species.find((species) => species.accuracy_mult === Math.max(...accMults));
  // ONE Evasion flat line at its T1 ceiling, lifted by one Evasion % line — the gear a real build wears
  const floorZone = floorSpecies!.zones[0];
  const ceilingZone = ceilSpecies!.zones[ceilSpecies!.zones.length - 1];
  const formName = (sp: any, zoneId: number) => (E.mob.forms as any)[zoneId]?.[sp.id]?.name || sp.name;
  const evVs = (sp: any, zoneId: number) => eng.evasionChance(eng.evasionRating(CEIL, M.evasion_flat_t1, M.evasion_pct), eng.mobAcc(eng.coreOf(sp, 'dex', zoneId), sp.accuracy_mult));
  // the floor build — Agi at the split point, which is what a real build holds
  const midVs = (sp: any, zoneId: number) => eng.evasionChance(eng.evasionRating(SPLIT, M.evasion_flat_t1, M.evasion_pct), eng.mobAcc(eng.coreOf(sp, 'dex', zoneId), sp.accuracy_mult));
  add('X20', evVs(floorSpecies!, floorZone) >= E.caps.evasion - 0.5 && midVs(ceilSpecies!, ceilingZone) < E.caps.evasion - 1,
    `Evasion Cap ${E.caps.evasion} is reachable against the low-accuracy Species (${formName(floorSpecies!, floorZone)} · ×${floorSpecies!.accuracy_mult} → ${f1(evVs(floorSpecies!, floorZone))}% at Agi ${f0(CEIL)} + gear) and is not free against the highest-accuracy Species (${formName(ceilSpecies!, ceilingZone)} · ×${ceilSpecies!.accuracy_mult} → ${f1(midVs(ceilSpecies!, ceilingZone))}% at Agi ${f0(SPLIT)}); Species Variants supply the authored Core while zone bands supply progression`);

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
  // What is a condition is the COPY: a published figure that no longer agrees with the engine it was
  // published from is a stale copy, and `--sync` is the repair.
  if (Math.round(DERIVED.ref_build_hit_pct) !== E.build.hit_chance_pct) evProblems.push(`build.hit_chance_pct ${E.build.hit_chance_pct} vs engine ${Math.round(DERIVED.ref_build_hit_pct)} — run \`node tools/check.ts --sync\` to re-publish it`);
  add('X21', evProblems.length === 0,
    evProblems.length ? evProblems.join(' · ')
      : `reference Evasion = its authored Core Dex × K_EVASION ${K.K_EVASION} × body base percent (Small +20% · Medium +10% · Large 0%) · reference (mean form, Medium body) ${f1(evRef)} · same-level no-gear hit chances ${f1(Math.min(...hits))}-${f1(Math.max(...hits))}% · a Full-Dex player still eats ${f1(mobHitFullDex)}% of the top accuracy tier before Evasion`);


  // The mob roster: every species actually placed in a zone needs a playable normal spawn.
  const ROWS = eng.mobRoster();
  const rp: string[] = [];
  if (new Set(ROWS.map((row) => row.id)).size !== ROWS.length) rp.push('mob roster contains duplicate row ids');
  const perZone: Record<number, number> = {};
  for (const z of ZONES) perZone[z.id] = ROWS.filter((r) => r.zone === z.id).length;
  for (const z of ZONES) {
    if (!eng.speciesInZone(z.id).length) rp.push(`zone ${z.id} has no Species for normal hunting`);
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
    if (sp.sizes.length && !ZONES.some((z) => sp.zones.includes(z.id))) rp.push(`${sp.name} has a body but no zone`);
    if (!(E.elements.order as string[]).includes((sp as any).element)) rp.push(`${sp.name} owns Element ${(sp as any).element}, which is not a declared Element`);
  }
  for (const sp of E.mob.species) if (typeof sp.carries_weapon !== 'boolean') rp.push(`${sp.name} has no carries_weapon ruling`);
  for (const z of ZONES) if (z.id > 1 && !ROWS.some((r) => r.zone === z.id && r.weapon)) rp.push(`zone ${z.id} has no weapon-carrying lineage, so no weapon could ever drop there`);
  for (const r of ROWS) {
    const sp = E.mob.species.find((x) => x.id === r.speciesId)!;
    if (/Elite/.test(r.kind)) {
      if (!sp.sizes.includes('large')) rp.push(`Elite ${r.id}: ${sp.name} has no Large body to flag`);
      const zone = eng.zoneById(r.zone);
      const fixedLevel = sp.zone_levels?.[r.zone];
      if (!Number.isInteger(fixedLevel) || fixedLevel! < zone.levels[0] || fixedLevel! > zone.levels[1]) {
        rp.push(`Elite ${r.id} has no static Species level inside ${zone.levels[0]}–${zone.levels[1]}`);
      }
      if (r.level !== fixedLevel) rp.push(`Elite ${r.id} level does not match its static Species zone level`);
      if (Math.abs(r.hpBaseTo - eng.mobHpAt(r.level) * E.mob.elite.hp) > 1) rp.push(`Elite ${r.id} Base HP is not the curve at its own level ×${E.mob.elite.hp}`);
      const flat = eng.LG.hp_per_level * (r.level - 1) + r.vit * eng.K.K_VIT_HP;
      const expectedHp = (eng.mobHpAt(r.level) + flat) * E.mob.elite.hp;
      if (Math.abs(r.hpFrom - expectedHp) > 1) rp.push(`Elite ${r.id} HP does not multiply the complete mobHP by ${E.mob.elite.hp}`);
      const variant = eng.variantsInZone(r.speciesId, r.zone).find((v: any) => v.name === r.variant);
      const expectedPs = eng.mobPsAt(r.level) * E.mob.elite.ps / eng.zoneBodyFactor(r.zone)
        * eng.speciesPsMult(r.zone, r.speciesId, variant?.core, variant?.damage);
      if (Math.abs(r.ps - expectedPs) > 0.01) rp.push(`Elite ${r.id} PS does not match the live spawn formula`);
    } else if (/Boss/.test(r.kind)) {
      if (Math.abs(r.hpBaseTo - eng.mobHpAt(r.level)) > 1) rp.push(`Boss ${r.id} Base HP is not mob_HP at its own level — body classes no longer scale HP`);
    } else {
      if (Math.abs(r.hpBaseTo - eng.mobHpAt(r.level)) > 1) rp.push(`${r.id} Base HP does not equal the curve at its own level — body classes no longer scale HP`);
      if (!/Unique/.test(r.kind)) {
        const zone = eng.zoneById(r.zone);
        const fixedLevel = sp.zone_levels?.[r.zone];
        if (!Number.isInteger(fixedLevel) || fixedLevel! < zone.levels[0] || fixedLevel! > zone.levels[1]) {
          rp.push(`${r.id} has no static Species level inside ${zone.levels[0]}–${zone.levels[1]}`);
        }
        if (r.level !== fixedLevel) rp.push(`${r.id} level does not match its static Species zone level`);
      }
    }
  }
  add('X23', rp.length === 0, rp.length ? rp.join(' · ')
    : `${ROWS.length} roster rows from ${E.mob.species.length} Species × authored Variants × body classes + ${ROWS.filter((r) => /Elite/.test(r.kind)).length} Elite + ${ROWS.filter((r) => /Unique/.test(r.kind)).length} Species Uniques + ${ROWS.filter((r) => /Boss/.test(r.kind)).length} named bosses · every zone has a normal Species and a Boss · normal and Elite spawns inherit their Species Element; each Boss reads its declared Element profile · zone row counts ${ZONES.map((z) => `${z.id}:${perZone[z.id]}`).join(' ')}`);

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
  if (!(ES.delay_sec > 0)) esProblems.push(`es delay ${ES.delay_sec} sec must be positive`);
  if (!ES.player_only || ROWS.some((r) => r.es)) esProblems.push('Energy Shield leaked to the mob side (it would double-count mob_HP · checks.md H1)');
  add('X25', esProblems.length === 0, esProblems.length ? esProblems.join(' · ')
    : `Energy Shield is Wis plus gear (owner ruling): Wis ${f0(eng.statAt(S.level_cap))} × ${K.K_WIS_ES} and ${M.energy_shield_flat_t1} flat, × (1 + ${M.max_energy_shield_pct}%) = ${f0(DERIVED.es_pool)} at the ceiling, and regen is ${ES.regen_pct}% of the pool per sec — ${f1(DERIVED.es_regen)}/sec after ${ES.delay_sec} sec without a hit, so the base rate alone returns the whole pool in ${f1(DERIVED.es_recover_sec)} sec · an \`es_regen\` skill, Mod or passive amplifies the rate · ${f1(DERIVED.es_share_of_hp * 100)}% of a caster build's ${f0(DERIVED.es_cast_hp)} HP · positive recharge delay and **player-only** so mob_HP stays the single survivability anchor`);

  // Species resistance: each Species authors one resistance line and one weakness line. The attack
  // Element is separate; no Element counters another and no profile tilts the Vit line (X54).
  {
    const order = E.elements.order as string[];
    const valid = new Set(order);
    const rp: string[] = [];
    const resPcts: number[] = [];
    const weakPcts: number[] = [];
    for (const sp of E.mob.species as any[]) {
      const r = sp.resistance;
      const w = sp.weakness;
      if (!r || !valid.has(r.element)) rp.push(`${sp.id}: resistance Element missing or unknown`);
      else if (!(r.pct > 0 && r.pct <= E.caps.elem_res)) rp.push(`${sp.id}: resistance ${r.pct}% is outside 0..${E.caps.elem_res}`);
      else resPcts.push(r.pct);
      if (!w || !valid.has(w.element)) rp.push(`${sp.id}: weakness Element missing or unknown`);
      else if (!(w.taken_pct > 0 && w.taken_pct < 100)) rp.push(`${sp.id}: weakness ${w.taken_pct}% is outside 0..100`);
      else weakPcts.push(w.taken_pct);
      if (r && w && r.element === w.element) rp.push(`${sp.id}: resistance and weakness name the same Element`);
      const map = eng.mobResByElementOf(sp);
      for (const el of order) {
        const want = r && el === r.element ? Math.min(E.caps.elem_res, r.pct || 0) : 0;
        if (Math.abs(map[el] - want) > 1e-9) rp.push(`${sp.id}: ${el} resists ${f1(map[el])} — not the ${f1(want)} its profile states`);
      }
    }
    const range = (values: number[]) => values.length ? `${Math.min(...values)}-${Math.max(...values)}%` : '—';
    add('X54', rp.length === 0, rp.length ? rp.join(' · ')
      : `${E.mob.species.length} Species carry one resistance (${range(resPcts)}) and one weakness (${range(weakPcts)}); the attack Element is a separate line, all other Elements meet no res, and Bosses/Uniques inherit their Species profile`);
  }

  // X55: mob skills are an optional kit on a separate library. A strike replaces one basic swing, so
  // direct damage stays exactly mob PS; auras are defensive only, so neither can raise the DPS budget.
  {
    const sk: string[] = [];
    const lib = MOB_SKILLS.skills as any[];
    const byId = new Map<string, any>(lib.map((row) => [row.id, row]));
    const elements = Object.keys(E.elements.status_of || {});
    const allowedStatus = new Set(MOB_SKILLS.meta.statuses as string[]);
    const allowedAura = new Set(MOB_SKILLS.meta.aura_stats as string[]);
    const allowedScope = new Set(MOB_SKILLS.meta.scopes as string[]);
    const maxKit = Number(MOB_SKILLS.meta.max_kit);
    if (!E.mob.skills_enabled) sk.push('skills_enabled is false while tools/data/mob-skills.json exists');
    if (!(lib.length >= 40 && lib.length <= 60)) sk.push(`library carries ${lib.length} skills, outside 40..60`);
    if (byId.size !== lib.length) sk.push('skill ids are not unique');
    const coverage = new Map<string, { strike: number; aura: number }>();
    for (const row of lib) {
      if (!row.id?.startsWith('mob.')) sk.push(`${row.id}: id must start with mob.`);
      if (!row.name) sk.push(`${row.id}: missing name`);
      if (!['strike', 'aura'].includes(row.mode)) sk.push(`${row.id}: mode is not strike/aura`);
      if (row.element != null && !elements.includes(row.element)) sk.push(`${row.id}: unknown element ${row.element}`);
      if (row.status != null && !allowedStatus.has(row.status)) sk.push(`${row.id}: status ${row.status} is not a control status`);
      if (!['front', 'stand-off', 'any'].includes(row.role)) sk.push(`${row.id}: role is not front/stand-off/any`);
      if (row.mode === 'strike') {
        if (!(row.cd > 0)) sk.push(`${row.id}: a strike needs a positive cooldown`);
        if (!(row.cast_sec >= 0 && row.cast_sec <= 2)) sk.push(`${row.id}: cast_sec is outside 0..2`);
        if (row.effects || row.scope) sk.push(`${row.id}: a strike cannot carry aura fields`);
        const c = coverage.get(row.element || 'physical') || { strike: 0, aura: 0 };
        c.strike++;
        coverage.set(row.element || 'physical', c);
      } else {
        if (!allowedScope.has(row.scope)) sk.push(`${row.id}: aura scope is not engaged/line`);
        const stats = Object.keys(row.effects || {});
        if (!stats.length) sk.push(`${row.id}: aura carries no effects`);
        for (const [stat, value] of Object.entries(row.effects || {})) {
          if (!allowedAura.has(stat)) sk.push(`${row.id}: aura stat ${stat} is outside the defensive set`);
          if (!(Number(value) > 0)) sk.push(`${row.id}: aura ${stat} must be positive`);
        }
        if (row.cd != null || row.cast_sec != null) sk.push(`${row.id}: an aura has no cast/cooldown`);
        const c = coverage.get(row.element || 'physical') || { strike: 0, aura: 0 };
        c.aura++;
        coverage.set(row.element || 'physical', c);
      }
    }
    for (const el of elements) {
      const c = coverage.get(el) || { strike: 0, aura: 0 };
      if (c.strike < 1) sk.push(`${el}: no strike`);
      if (c.aura < 1) sk.push(`${el}: no aura`);
    }
    if (!lib.some((row) => row.mode === 'strike' && row.role === 'front')) sk.push('no front-line strike');
    if (!lib.some((row) => row.mode === 'strike' && row.role === 'stand-off')) sk.push('no stand-off strike');

    const speciesIds = new Set(E.mob.species.map((sp) => sp.id));
    const variantNames = new Set(Object.values(((E.mob as any).variants || {}) as Record<string, any[]>).flatMap((rows) => rows.map((r) => r.name)));
    const bossNames = new Set((E.mob.bosses as any[]).map((b) => b.name));
    const uniqueNames = new Set(((E.mob as any).uniques || []).map((u: any) => u.name));
    const checkKit = (label: string, ids: string[], max: number) => {
      if (!Array.isArray(ids) || ids.length < 1) sk.push(`${label}: empty kit`);
      if (ids.length > max) sk.push(`${label}: ${ids.length} skills exceeds ${max}`);
      if (new Set(ids).size !== ids.length) sk.push(`${label}: duplicate skill id`);
      for (const id of ids) if (!byId.has(id)) sk.push(`${label}: unknown skill ${id}`);
    };
    const kits = MOB_SKILLS.kits;
    const speciesSigs = new Map<string, string>();
    const kitDamages = new Set<string>();
    let speciesWithKit = 0;
    for (const [id, ids] of Object.entries(kits.species || {}) as [string, string[]][]) {
      if (!speciesIds.has(id)) sk.push(`species kit ${id}: unknown species`);
      const species = E.mob.species.find((sp) => sp.id === id);
      if (species) kitDamages.add(species.damage);
      checkKit(`species ${id}`, ids, 2);
      if (ids.length) speciesWithKit++;
      const sig = [...ids].sort().join('|');
      if (speciesSigs.has(sig)) sk.push(`species ${id}: resolved kit duplicates ${speciesSigs.get(sig)}`);
      else speciesSigs.set(sig, id);
    }
    for (const damage of ['physical', 'magic', 'mixed']) {
      if (!kitDamages.has(damage)) sk.push(`no species kit covers ${damage} damage`);
    }
    if (speciesWithKit === 0) sk.push('no species carries a kit');
    if (speciesWithKit >= speciesIds.size) sk.push('every species carries a kit; at least one should stay basic-only');
    for (const [name, ids] of Object.entries(kits.variants || {}) as [string, string[]][]) {
      if (!variantNames.has(name)) sk.push(`variant kit ${name}: unknown variant`);
      checkKit(`variant ${name}`, ids, maxKit);
    }
    for (const [name, ids] of Object.entries(kits.bosses || {}) as [string, string[]][]) {
      if (!bossNames.has(name)) sk.push(`boss kit ${name}: unknown boss`);
      checkKit(`boss ${name}`, ids, maxKit);
    }
    for (const [name, ids] of Object.entries(kits.uniques || {}) as [string, string[]][]) {
      if (!uniqueNames.has(name)) sk.push(`unique kit ${name}: unknown unique`);
      checkKit(`unique ${name}`, ids, maxKit);
    }
    if (!Object.keys(kits.variants || {}).length) sk.push('no variant override exists');
    if (!Object.keys(kits.bosses || {}).length) sk.push('no boss kit exists');
    if (!Object.keys(kits.uniques || {}).length) sk.push('no unique override exists');

    add('X55', sk.length === 0, sk.length ? sk.join(' · ')
      : `${lib.length} mob skills over ${coverage.size} element lanes (${elements.length} Elements + physical) · ${speciesWithKit}/${speciesIds.size} species carry 1-2 across ${[...kitDamages].sort().join('/')} damage, the rest stay basic-only · ${Object.keys(kits.bosses || {}).length} boss and ${Object.keys(kits.uniques || {}).length} unique kits · every kit ≤${maxKit}, no layer merge, no duplicate species kit · strikes are swing-neutral and auras are defensive only`);
  }

  // Zone identity lives in `mob.zones` alone. Bands repeat every three zones, so each band owns
  // however many zones fall in its 30-level window. The band list is read from `item_level.spans`
  // (the ladder that owns band names) and the expected group size from `loot.bands[band].group_mobs`
  // (the number that band already owns), so a zone's own `group` string must average to it.
  const zp: string[] = [];
  const SPAN_BANDS = E.item_level.spans.map((s) => s.band);
  const bandOfZone = (z: (typeof ZONES)[number]) => z.quality.split(' ')[0];
  for (const z of ZONES) {
    if (!SPAN_BANDS.includes(bandOfZone(z))) zp.push(`zone ${z.id} names the band "${bandOfZone(z)}", which item_level.spans does not carry`);
  }
  for (const band of SPAN_BANDS) {
    const want = E.loot.bands[band]?.group_mobs;
    if (want == null) { zp.push(`the ${band} band has no loot.bands row to own a group size`); continue; }
    for (const z of ZONES.filter((zz) => bandOfZone(zz) === band)) {
      const [lo, hi] = String(z.group).split('-').map(Number);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) { zp.push(`zone ${z.id} group "${z.group}" is not a readable range`); continue; }
      const avg = (lo + hi) / 2;
      if (Math.abs(avg - want) > 1e-9) zp.push(`zone ${z.id} group "${z.group}" averages ${avg}, not the ${want} the ${band} band owns (loot.bands.${band}.group_mobs)`);
    }
  }
  add('X26', zp.length === 0, zp.length ? zp.join(' · ')
    : `zone identity has one home — engine.json mob.zones: every zone's group average matches the group size its own band owns (${ZONES.length} zones read from the list, the band list from item_level.spans, the expected size from loot.bands[band].group_mobs — no per-band group string is typed)`);

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
    add('X37', p.length === 0, p.length ? p.join(' · ')
      : `mob_HP(L) is anchored at every zone edge and linearly interpolated inside a zone, so every level 1-${S.level_cap} has a value (${f0(eng.mobHpAt(1))} → ${f0(eng.mobHpAt(S.level_cap))}, strictly rising) · mob_PS(L) is \`typical_gear_DPS(L) ÷ ${K.mob_damage_divisor}\` for the zone's AVERAGE mob, and each Species Variant moves it by (\`power_base + ${K.K_MOB_PS_STAT} ×\` the Str/Int its \`damage\` tag reads) over the zone mean`);
  }

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
  soft('X41', STONE.quality_stones_per_hr > 0 && STONE.repair_stones_per_hr > 0 && STONE.corrupt_stones_per_hr > 0,
    `the three ladder stones must each carry a flow: Quality ${STONE.quality_stones_per_hr} · Repair ${STONE.repair_stones_per_hr} · Corrupt ${STONE.corrupt_stones_per_hr} an hour — a zero starves a verb the bench sells`);
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

  // Species provide a default damage type; individual Variants may override it.
  const variantsBySpecies = ((E.mob as any).variants || {}) as Record<string, any[]>;
  const variantDamageTags = Object.values(variantsBySpecies)
    .flatMap((ladder: any[]) => ladder.filter((variant) => variant.damage !== undefined).map((variant) => variant.damage));
  const splitTags: string[] = [...new Set([...E.mob.species.map((r) => r.damage), ...variantDamageTags])];
  const damageProblems = splitTags.filter((t) => !E.mob.damage_split[t] || Math.abs(E.mob.damage_split[t][0] + E.mob.damage_split[t][1] - 1) > 1e-9);
  const magicCoreProblems: string[] = [];
  for (const sp of E.mob.species) for (const variant of variantsBySpecies[sp.id] || []) {
    if ((variant.damage ?? sp.damage) === 'magic' && variant.core.int <= variant.core.str) {
      magicCoreProblems.push(`${sp.id}/${variant.name}: magic damage needs Int above Str`);
    }
  }
  for (const boss of E.mob.bosses as any[]) {
    if (boss.damage === 'magic' && boss.core.int <= boss.core.str) {
      magicCoreProblems.push(`boss ${boss.name}: magic damage needs Int above Str`);
    }
  }
  for (const unique of ((E.mob as any).uniques || []) as any[]) {
    if (unique.damage === 'magic' && unique.core.int <= unique.core.str) {
      magicCoreProblems.push(`unique ${unique.name}: magic damage needs Int above Str`);
    }
  }
  const damageProfileProblems = [...damageProblems, ...magicCoreProblems];
  add('X31', damageProfileProblems.length === 0, damageProfileProblems.join(' · ')
    || 'Species defaults and Variant overrides resolve to real splits; magic damage Variants, Bosses and Uniques put Int above Str');

  // With a mob's level STATIC per variant (`mob.variants[].levels`; the legacy per-species zone
  // table `mob.species[].zone_levels` answers only past the form cap), the zone average no longer
  // equals the zone-top anchor: a mob reads `mob_HP` at its OWN level, so the
  // Reach: the only positional model, and its cost to a melee build must stay small
  const RP = [];
  const allWeapons = ['sword','axe','dagger','mace','spear','two-handed sword','two-handed axe','bow','crossbow','staff','wand','book'];
  for (const w of allWeapons) if (!E.mob.reach.weapons[w]) RP.push(`weapon ${w} has no reach band`);
  for (const sp of E.mob.species) if (!['front','stand-off'].includes(sp.line)) RP.push(`${sp.name} has no line`);
  for (const z of ZONES) {
    const cast = E.mob.species.filter((sp) => sp.zones.includes(z.id));
    if (cast.some((sp) => sp.line === 'stand-off') && !cast.some((sp) => sp.line === 'front')) RP.push(`zone ${z.id} fields only stand-off mobs, so a melee build could never engage there`);
  }
  add('X33', RP.length === 0, RP.length ? RP.join(' · ')
    : `reach is the whole positional model (no tiles, no movement): ${allWeapons.length} weapons mapped to ${Object.keys(E.mob.reach.bands).length} bands · ${E.mob.species.length} species all carry a line (${E.mob.species.filter((sp) => sp.line === 'front').length} front · ${E.mob.species.filter((sp) => sp.line === 'stand-off').length} stand-off)`);

  // Inventory: one bag of gear pieces and carried stacks that fills and pauses, town-only stash/craft
  const IV = E.inventory || {};
  const ivp = [];
  if (!(IV.character_slots > 0)) ivp.push('no bag size');
  if ((IV as any).adventure_slots !== undefined) ivp.push('adventure_slots is gone — one bag holds gear and stacks against character_slots');
  if (IV.overflow !== 'stop_pickup') ivp.push('overflow must be stop_pickup — a full bag pauses pickups, nothing auto-converts');
  for (const k of ['stone', 'herb', 'potion', 'material', 'food']) if (!(IV.stack_size && IV.stack_size[k] > 0)) ivp.push(`no stack size for ${k}`);
  for (const k of ['herb', 'potion', 'material', 'food']) if (!(IV.unit_weight && IV.unit_weight[k] >= 0)) ivp.push(`no unit weight for ${k}`);
  if (IV.gold_uses_slot !== false) ivp.push('gold must not consume a slot');
  const gearHr = L.bands.high.upgrades_per_hr;                       // kept gear/hr = measured upgrades (F4)
  const gearFill = IV.character_slots / gearHr;
  // The bag's own rules are conditions, not pacing: a bag with no size, a missing stack size, a
  // retired key or a wrong overflow is a broken contract. The hours a bag takes to fill are the
  // measured figure, and they stay in the line below.
  add('X34', ivp.length === 0, ivp.length ? ivp.join(' · ')
    : `the bag holds ${IV.character_slots} slots — gear pieces at one a slot fills it in ~${f1(gearFill)} hr of kept gear at the high band's measured ${gearHr} upgrades/hr, and stacks share the same count: stone (${IV.stack_size.stone}/slot, weightless), herb ${IV.stack_size.herb}/slot, potion ${IV.stack_size.potion}/slot, material ${IV.stack_size.material}/slot, food ${IV.stack_size.food}/slot; gold takes no slot · full = pickups pause, nothing auto-converts, nothing is deleted · stash + gear craft are Settlement-only, meal cooking is Camp-only`);

  // Junk rarity values preserve the reference mint; every rarity must reproduce the published
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
    // Only a FIELDABLE name may promise a junk item: a name the cast can never field is a drop the
    // Counterhand would advertise and nothing could ever pay. Reachability is read off the cast, not
    // typed: every normal Variant is fielded in its band, and every Species Unique is fielded wild.
    const ladderNames = (Object.values(V) as { name: string }[][]).flat().map((v) => v.name);
    const uniqueNames = (((E.mob as any).uniques || []) as any[]).map((u) => u.name);
    const names = [...ladderNames, ...uniqueNames];
    const paidBy = new Map<string, string>();
    const variantItems = new Set(Object.values(D).map((row: any) => row.item));
    for (const n of names) {
      const row = D[n];
      if (!row) { jp.push(`variant ${n} can be fielded but has no variant_drops row`); continue; }
      const owner = paidBy.get(row.item);
      if (owner) jp.push(`junk item "${row.item}" is paid by two variants: ${owner} and ${n}`);
      paidBy.set(row.item, n);
      if (!J.rarities || !J.rarities[row.rarity]) jp.push(`${n} junk "${row.item}" has unknown rarity ${row.rarity}`);
    }
    const speciesItemOwner = new Map<string, string>();
    for (const species of E.mob.species as any[]) {
      const items = species.junk_items || {};
      const entries = Object.entries(items) as [string, unknown][];
      if (entries.length < 1 || entries.length > Object.keys(J.rarities || {}).length)
        jp.push(`${species.name} must declare between 1 and ${Object.keys(J.rarities || {}).length} species junk alternatives`);
      for (const [rarity, value] of entries) {
        const item = value;
        if (!J.rarities?.[rarity]) { jp.push(`${species.name} junk item uses unknown rarity ${rarity}`); continue; }
        if (typeof item !== 'string' || !item.trim()) { jp.push(`${species.name} has no valid ${rarity} species junk item`); continue; }
        if (variantItems.has(item)) jp.push(`${species.name} species junk "${item}" duplicates a variant junk item`);
        const owner = speciesItemOwner.get(item);
        if (owner) jp.push(`species junk item "${item}" is shared by ${owner} and ${species.id}`);
        speciesItemOwner.set(item, species.id);
      }
    }
    for (const k of Object.keys(D)) {
      if (!names.includes(k)) jp.push(`variant_drops row for a name no ladder or unique carries: ${k}`);
    }
    const junkHr = BAND.high.kills_derived * perKill;
    add('X39', jp.length === 0, jp.length ? jp.join(' · ')
      : `mob junk has ${names.length} unique variant items plus ${speciesItemOwner.size} unique Species alternatives across ${Object.keys(J.rarities).length} rarities · each Species alternative shares its rarity's base value, and each rarity's chance = the line / its base value, so reference gold is ${f2(perKill)}/kill and ${f0(junkHr)}/hr before town demand · every declared Variant and Unique carries exactly one row · stacks ${J.stack}/slot, weightless`);
  }

  // X57: a Species may author any number of Variants. Bands are valid and non-overlapping;
  // zones carry a previous Variant across gaps. Subzones list Species ids, never Variant names.
  {
    const cp: string[] = [];
    const V = (E.mob as any).variants || {};
    const seenNames = new Set<string>();
    let rows = 0;
    for (const [sid, list] of Object.entries<{ name: string; levels: [number, number] }[]>(V)) {
      const bands = (list as { name: string; levels: [number, number] }[]).map((v) => v.levels);
      rows += bands.length;
      // A Species may author any number of Variants: a ladder length is content, not correctness, so it
      // is never a gate. What holds is the shape below.
      for (const v of list) {
        if (!v.name || seenNames.has(v.name)) cp.push(`variant name is missing or repeated: ${v.name || '(empty)'}`);
        else seenNames.add(v.name);
        // Variant names are authored freely: a name must read as a creature, which no check can prove.
        // What stays gated is the shape below — unique names, real bands, no overlap.
        if (!Number.isInteger(v.levels?.[0]) || !Number.isInteger(v.levels?.[1]) || v.levels[0] < 1 || v.levels[1] < v.levels[0] || v.levels[1] > E.mob.form_level_cap)
          cp.push(`${sid} variant ${v.name} has invalid levels [${v.levels?.[0]}, ${v.levels?.[1]}]`);
      }
      const sorted = [...bands].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i][0] <= sorted[i - 1][1]) cp.push(`${sid} Variant bands overlap at ${sorted[i - 1][1]}→${sorted[i][0]}`);
      }
    }
    for (const z of E.mob.zones as any[]) for (const s of z.subzones || []) {
      if ('normal' in s || 'elite' in s) cp.push(`zone ${z.id} ${s.name} still declares variant names`);
    }
    add('X57', cp.length === 0, cp.length ? cp.join(' · ')
      : `${rows} authored Variants across ${Object.keys(V).length} Species; ladder length is free, bands stay valid and non-overlapping, zone gaps carry the prior Variant, names are unique across the roster, and subzones declare no variants`);
  }

  // X56: normal Variants share their Species' drop archetype. Species Uniques stay balanced
  // because they already pay the boss stone lines. Every lean still conserves expected drops/kill.
  {
    const vp: string[] = [];
    const V = (E.mob as any).variants || {};
    const D = (E.mob as any).variant_drops || {};
    const U = new Set((((E.mob as any).uniques || []) as any[]).map((u) => u.name));
    const CATS = E.loot.variant_lean.categories as string[];
    const sample = { gear: 0.08, herb: 0.17, junk: 0.3 };
    const sum = (x: any) => x.gear + x.herb + x.junk;
    let leaned = 0, normalLeaned = 0;
    for (const [sid, list] of Object.entries<{ name: string }[]>(V)) {
      const normal: string[] = [];
      for (const v of (list as { name: string }[])) {
        const r = D[v.name];
        if (!r) continue; // a pruned rung carries no row; X39 owns that fact, not this gate
        if (U.has(v.name)) continue;
        normal.push(r.lean);
        if (!CATS.includes(r.lean)) vp.push(`${sid}: ${v.name} has unknown lean ${r.lean}`);
      }
      if (normal.length !== (list as unknown[]).length) vp.push(`${sid}: has ${normal.length} normal lean rows, expected ${(list as unknown[]).length}`);
      if (new Set(normal).size > 1) vp.push(`${sid}: normal rungs split across ${[...new Set(normal)].join(' · ')}`);
      for (const lean of normal) {
        const out = leanReweight(sample, lean as any, E.loot.variant_lean.shift_pct);
        if (Math.abs(sum(out) - sum(sample)) > 1e-9) vp.push(`${sid}: lean ${lean} does not conserve the total`);
        if (out[lean as 'gear' | 'herb' | 'junk'] <= sample[lean as 'gear' | 'herb' | 'junk']) vp.push(`${sid}: lean ${lean} does not raise its own stream`);
        leaned++; normalLeaned++;
      }
    }
    for (const u of U) {
      const r = D[u];
      if (r && r.lean !== 'none') vp.push(`Unique ${u} leans ${r.lean}, Species Uniques must stay 'none'`);
      if (r) leaned++;
    }
    add('X56', vp.length === 0, vp.length ? vp.join(' · ')
      : `each Species' normal Variants share one archetype lean and its Uniques carry 'none': ${leaned} leans checked (${normalLeaned} normal rows), each lean raises its stream and conserves ${sum(sample).toFixed(2)} expected drops/kill (mob.variant_drops · loot.variant_lean)`);
  }

  // The AoE rule is data now, and its shape must stay a real trade: lose at 1 target, win at the Cap.
  // What is a condition and what is a measurement:
  //  - the shape of the fields — a percentage, a target cap, and a mana multiplier that really is a
  //    cost (below 1x it stops being one) — is a condition;
  //  - the trade the block exists to hold (AoE loses at one target, wins at the Cap) is the owning
  //    rule (skill-pool-system.md), so it is a condition too;
  //  - the damage-per-mana figures are measurements, and they are printed, not gated.
  {
    const A = E.aoe || {};
    const p = [];
    if (!(A.per_target_pct > 0 && A.per_target_pct <= 100)) p.push('aoe per-target damage must be a percentage');
    if (!(A.target_cap >= 1)) p.push('aoe needs a target cap');
    if (!(A.mana_mult >= 1)) p.push('aoe mana must cost at least 1x');
    const dpm = (n: number) => (Math.min(n, A.target_cap) * A.per_target_pct) / 100 / A.mana_mult;
    if (!(dpm(1) < 1)) p.push('aoe must lose to single-target damage per mana at 1 target');
    if (!(dpm(A.target_cap) > 1)) p.push('aoe must beat single-target damage per mana at the Cap');
    add('X40', p.length === 0, p.length ? p.join(' · ')
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

  // OP7 · the set's shape: no slot worn twice, one line per piece, and no Bound pair or Unbound line
  // anywhere — minute one is junk, and junk is what this proves. Whether the set reaches every slot is
  // not gated: a slot added later may legally start empty, and that is a content choice, not a defect.
  const opSlotProblems: string[] = [];
  const opSlots = (LOOT_SLOTS as string[]);
  for (const slot of [...new Set(opSlots)]) {
    const n = OP_PIECES.filter((p) => p.g.slot === slot).length;
    const want = opSlots.filter((s) => s === slot).length;
    if (n > want) opSlotProblems.push(`${slot}: ${n} piece(s) worn against the ${want} the slot list carries`);
  }
  for (const p of OP_PIECES) if (!opSlots.includes(p.g.slot)) opSlotProblems.push(`${p.g.slot} ${p.g.base}: a slot the character does not wear`);
  const opLineProblems = OP_PIECES
    .filter((p) => p.lines.length !== 1)
    .map((p) => `${p.g.slot} ${p.g.base}`);
  add('OP7', opSlotProblems.length === 0 && opLineProblems.length === 0,
    `the set is ${OP_PIECES.length} pieces across the ${opSlots.length} slots a character wears — no slot worn twice, nothing outside the worn list, every piece exactly one line: its frame's Frame Mod at the floor, with no Bound pair and no Unbound line${opSlotProblems.length ? ' · SLOTS: ' + opSlotProblems.join(' · ') : ''}${opLineProblems.length ? ' · LINES: ' + opLineProblems.join(' · ') : ''} · coverage of every slot is X60's rule, not this one`);

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
  const modProblems = modRangeProblems(MODS);
  add('MP1', modProblems.length === 0,
    `every mod range stays within its Total — contiguous thirds, nondecreasing band floors, strict seams (singleton endpoint allowed), rising T1 floors${modProblems.length ? ' · ' + modProblems.join(' · ') : ''}`);

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
  {
    // the reference time-to-kill is derived from the roster, so a Species added or retired moves it:
    // the cage re-publishes it instead of leaving a hand-typed figure to rot (`engine/index.ts` REFERENCE)
    file: 'engine.json',
    label: 'loot.ttk_per_mob_sec',
    re: /("ttk_per_mob_sec":\s*)([\d.]+)/,
    want: () => eng.REFERENCE.ttk.toFixed(4),
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
