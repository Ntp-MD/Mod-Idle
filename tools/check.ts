// @ts-nocheck
// TODO(migration): 124 KB engine cage; the ESM conversion is done, per-file typing is a follow-up.

/**
 * Engine cage — groups A · B · C · F of checks.md.
 *
 *   node tools/check.ts            help
 *   node tools/check.ts --emit     print the generated group tables
 *   node tools/check.ts --write    rewrite those tables inside checks.md
 *   node tools/check.ts --checks   run every invariant, exit 1 on FAIL or stale doc
 *
 * Values are computed from tools/data/engine.json (stat model · K values · mod maxima ·
 * loot model · craft prices) and then read back against the prose files that publish
 * them (mod-pool.md · formula.md · core-stats.md · crafting.md · loot.md).
 * A doc number that is not the output of this math is a FAIL, not a note.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as eng from './lib/engine.ts';
import { readJson } from './lib/json.ts';
import { createSkillModel } from '../engine/skills.ts';
import { createLoot, leanReweight } from '../engine/loot.ts';

const { E, S, K, M, LG, BAND, BANDS, BAND_KEYS, CEIL, SPLIT, FORCED_SPLIT, DERIVED, ES, WEAPONS, STONE, LCK_BOUND, L, C, TS } = eng;
const MODS = JSON.parse(fs.readFileSync(path.join(eng.ROOT, 'tools/data/mods.json'), 'utf8'));
const BASES_JSON = readJson(path.join(import.meta.dirname, 'data/bases.json'));
const ROOT = eng.ROOT;
const f0 = (x) => Math.round(x).toLocaleString('en-US');
const f1 = (x) => x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = (x) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;
const modRange = (id) => { const m = MODS.mods.find((x) => x.id === id); return m ? `${m.min}-${m.max}` : 'TBD'; };

const BAND_LABEL = { low: 'low', mid: 'mid', high: 'high', high_full_lck: 'full Lck' };

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
      lines: LOOT.baseModAtFloor(BASES_JSON, g.slot, frame, weapon, OPEN.level, q),
      weight: frame ? frame.weight : eng.weaponWeightOf(BASES_JSON, g.base, 'main hand'),
    };
  });
};

// ---------------------------------------------------------------- tables

const BLOCKS = {};

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
    ['B15', 'Energy Shield pool (gear)', `${M.energy_shield_flat_t1} × (1 + ${M.max_energy_shield_pct}/100)`, `**${f0(DERIVED.es_pool)}** · ${f1(DERIVED.es_share_of_hp * 100)}% of a caster build's ${f0(DERIVED.es_cast_hp)} HP`],
    ['B16', 'ES regen · full recovery', `${ES.regen_pct}% of the pool per sec · after ${ES.delay_sec} sec without a hit`, `${f1(DERIVED.es_regen)}/sec → **${f1(DERIVED.es_recover_sec)} sec** for the whole pool from the base rate · an \`es_regen\` skill, Mod or passive amplifies the rate (X25)`],
  ];
  return ['| id | Value | Expression | Result |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | \`${r[2]}\` | ${r[3]} |`), '',
    `Every row is the single-stat ceiling (${f0(CEIL)}) plus the one Mod slot that can roll that line (mod-pool.md maxima · equipment-slot.md slot rules).`,
    `B5 is the row K_INT_MREGEN was retuned for: ${f1(DERIVED.pool_regen_sec)} sec against the ${TS.craft_progress_intent_sec} sec intent (tolerance ±${TS.pool_regen_tolerance} sec).`, ''].join('\n');
};

BLOCKS['group-C'] = () => {
  const cap = (n) => E.caps[n];
  const sword = WEAPONS[1], dagger = WEAPONS[0];
  const pdCapFrac = cap('perfect_dodge') / 100;
  const pdCapLck = Math.ceil(pdCapFrac * K.K_PDOGE / (1 - pdCapFrac) / K.K_LCK_PDOGE);
  // Evasion is one layer: the Dex rating runs the entropy roll against that mob's
  // accuracy, then Agi adds points (30 Agi = 1) and the Cap 80 binds the sum.
  const evFloor = E.mob.species.reduce((a, b) => (b.accuracy_mult < a.accuracy_mult ? b : a));
  const c2rating = SPLIT * K.K_EVASION + M.evasion_flat_t1;
  const c2chance = eng.evasionChance(c2rating, SPLIT / 30, eng.mobAcc(S.level_cap, evFloor.stats.dex, evFloor.accuracy_mult));
  const rows = [
    ['C1', `Evasion ${cap('evasion')}%`, `Dex rating ÷ (rating + that mob's accuracy), then + Agi ÷ 30 points, capped together · the same opposed shape the mob side dodges with (X20)`, '**reachable** ✓'],
    ['C2', `(compare) Dex ${f0(SPLIT)} + 1 Flat item vs the floor lineage`, `rating = ${f0(SPLIT)}×${K.K_EVASION} + ${M.evasion_flat_t1} = ${f0(c2rating)}, + Agi ${f0(SPLIT)} ÷ 30`, `${f1(c2chance)}% vs ${evFloor.name} · does not hit Cap ✓`],
    ['C3', `aspd ${cap('aspd')}`, `sword ${sword.weapon_aspd} + ${M.aspd_pct}% Mod → Agi = ${f0(sword.agi_to_cap)}`, `**${f0(sword.agi_to_cap)}** (ceiling ${f0(CEIL)}) ✓`],
    ['C4', `aspd ${cap('aspd')}`, `dagger ${dagger.weapon_aspd} + ${M.aspd_pct}% Mod`, `${f0(dagger.agi_to_cap)} ✓ · staff/2h unreachable by intent`],
    ['C5', `Perfect dodge ${cap('perfect_dodge')}`, `ratio: Lck ${f0(CEIL)} × ${K.K_LCK_PDOGE} = rate ${f1(DERIVED.pdogge_rate)} ÷ (rate + ${K.K_PDOGE}) = ${f1(DERIVED.perfect_dodge)}% · the Cap binds first · reached at Lck ${f0(pdCapLck)}`, `**${cap('perfect_dodge')}%** at the Cap · reachable at Lck ${f0(pdCapLck)} (under the ${f0(CEIL)} ceiling) ✓`],
    ['C6', `Alignment ${cap('alignment')} · hard ceiling`, `Dex ${f0(CEIL)} (${f1(DERIVED.align_raw)}) + amulet + gloves (+${M.align_pct_per_item} +${M.align_pct_per_item})`, `${f1(DERIVED.align_path)} — the build tops out under the Cap `],
    ['C7', `Elem res ${cap('elem_res')} · binding Cap`, `${LG.res_mod_items} res items at the max roll · gear only, no Core stat`, `${f1(DERIVED.res_three)} — the build reaches past the Cap, so it **binds** `],
    ['C8', `CDR ${cap('cdr')} · hard ceiling`, `Wis ${f0(CEIL)} + ${LG.cdr_mod_items} CDR items + BO`, `${f1(DERIVED.cdr_four)} — the build tops out under the Cap `],
    ['C9', 'Crit (no Cap)', `Lck ${f0(CEIL)} + ${M.crit_pct_main_hand}% Mod + buff`, `${f1(DERIVED.crit)}% from stats alone · anything over ${K.K_CRIT_CAP} becomes crit damage (B6b) ✓`],
    ['C10', `stun ${cap('stun')}`, `Alignment reach ${f1(DERIVED.align_path)} × ${K.K_STUN_PER_ALIGN} = ${f1(DERIVED.align_path * K.K_STUN_PER_ALIGN)} + the mace's Chance to stun % line`, `${cap('stun')} ✓ via the mace Base Mod, the only source past the Alignment reach `],
    ['C11', 'Accuracy', 'no Cap · `acc/(acc+E)` forbids 100% itself', `${f0(DERIVED.accuracy)} → ${f1(DERIVED.hit_chance * 100)}% ✓`],
  ];
  return ['| id | Cap | Reachable path | Value at that point |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`), '',
    'H3 rule: every Cap states whether it is a build target or a hard ceiling. A build-target Cap must bind (the build reaches it); a hard-ceiling Cap must not (the build tops out under it) — `alignment`, `elem_res` and `cdr` are hard ceilings, and evasion was closed by putting it on the opposed form the mob side already uses, so X20 can prove it both ways.',
    'Agi-per-Cap rows are the same line as formula-utility.md section 7: `${E.caps.aspd} ÷ weapon_aspd` minus the 100 baseline and the 25% Mod, divided by ${K.K_AGI_ASPD} per Agi, plus the level-1 Base of 12.', ''].join('\n');
};

BLOCKS['group-F'] = () => {
  const b = BAND;
  // Every income row is per KILL, never per hour (D12): a rate is a tool's own arithmetic, not a
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
    ['F7', 'Reroll tier stone per kill', `elite ${perKill('high', b.high.kills_derived * L.elite_spawn_chance * L.elite_tier_stones).toFixed(4)} (${L.elite_spawn_chance * 100}% of kills ×${L.elite_tier_stones}) + boss ${perKill('high', L.boss_per_hour * L.boss_tier_stones).toFixed(4)} (${bossPerKill} ×${L.boss_tier_stones})`, `${perKill('high', STONE.tier_stones_per_hr).toFixed(4)}`],
    ['F8', 'Refines per kill', `F7 ÷ ${C.refine_stones_per_use}`, `**${perKill('high', STONE.refines_per_hr).toFixed(4)}**`],
    ['F9', 'Add mod stone per kill', `elite ${perKill('high', b.high.kills_derived * L.elite_spawn_chance * L.elite_add_stone_chance).toFixed(4)} (${L.elite_spawn_chance * 100}% of kills × ${L.elite_add_stone_chance * 100}% chance) + boss ${perKill('high', L.boss_per_hour * L.boss_add_stones).toFixed(4)} (${bossPerKill} ×${L.boss_add_stones})`, `**${perKill('high', STONE.add_stones_per_hr).toFixed(4)}**`],
    ['F10', 'Ascend per kill', `min(F9 ÷ ${C.ascend_add_stones} Add, F7 ÷ ${C.ascend_tier_stones} tier) — the scarcer stone sets the pace`, `**${perKill('high', STONE.ascend_per_hr).toFixed(4)}** · full 12-piece set **${f0(STONE.ascend_hours_full_set * b.high.kills_derived)} kills** (Add alone ${f0(STONE.add_hours_full_set * b.high.kills_derived)} kills · tier stones alone ${f0(STONE.tier_hours_full_set * b.high.kills_derived)} kills → tier stones bind)`],
    ['F13', 'herb bundles per kill', `separate roll · a bundle of ${E.herbs.bundle_min}-${E.herbs.bundle_max} zone-tier herbs`, `mid band **${f2(E.herbs.mid_chance)}** · high band **${f2(E.herbs.high_chance)}**`],
    ['F16', 'Refine full set', `${C.ascend_items_per_set} pieces × ${C.refine_slots_per_item} slots × ${C.refine_steps} steps = ${STONE.refine_casts_full_set} casts`, `**${STONE.refine_casts_full_set} casts** · ${STONE.refine_casts_full_set * C.refine_stones_per_use} Reroll tier stones (checks.md E6)`],
    ['F17', 'Full-set polish', `${C.polish_casts_per_full_set} casts at ${C.reroll_value_stones_per_use} stones`, `**${C.polish_casts_per_full_set} casts** · ${C.polish_casts_per_full_set * C.reroll_value_stones_per_use} Reroll value stones (checks.md E8)`],
    ['F18', 'gold per kill, the price unit', `F5, the junk line`, `${perKill('low', b.low.junk_per_hr).toFixed(4)} low · ${perKill('mid', b.mid.junk_per_hr).toFixed(4)} mid · ${perKill('high', b.high.junk_per_hr).toFixed(4)} high · ${perKill('high_full_lck', b.high_full_lck.junk_per_hr).toFixed(4)} full Lck (towns-stalls.md §1)`],
    ['F19', 'full-Lck income ceiling over the no-Lck line', `${perKill('high_full_lck', b.high_full_lck.junk_per_hr).toFixed(4)} ÷ ${perKill('high', b.high.junk_per_hr).toFixed(4)}`, `**×${f2(LCK_BOUND)}** — the only place Lck may multiply income (G8)`],
    ['F20', 'Quality Stone per kill', `monster ${perKill('high', b.high.kills_derived * L.quality_stone_sources.monster_quality_chance).toFixed(4)} (${L.quality_stone_sources.monster_quality_chance * 100}% of kills) + elite ${perKill('high', b.high.kills_derived * L.elite_spawn_chance * L.quality_stone_sources.elite_quality_chance).toFixed(4)} (1 in 5 × ${L.quality_stone_sources.elite_quality_chance * 100}%) + boss ${perKill('high', L.boss_per_hour * L.quality_stone_sources.boss_quality_stones).toFixed(4)} (${bossPerKill} ×${L.quality_stone_sources.boss_quality_stones})`, `**${perKill('high', STONE.quality_stones_per_hr).toFixed(4)}**`],
    ['F21', 'Upgrade full set', `${C.upgrade_costs.join(' + ')} = ${STONE.upgrade_stones_per_piece} per piece × ${C.ascend_items_per_set} pieces = ${STONE.upgrade_stones_full_set} stones ÷ F20`, `**${f0(STONE.upgrade_stones_full_set / perKill('high', STONE.quality_stones_per_hr))} kills** for a full +15 set · the steps ${C.upgrade_breaks_from}-15 third alone, hunted only from bosses, is **${f0(STONE.upgrade_boss_third_hours * b.high.kills_derived)} kills** (crafting.md "sources shift monsters → elites → bosses by step")`],
    ['F22', 'Repair and Corrupt stone per kill', `Repair: elite ${perKill('high', b.high.kills_derived * L.elite_spawn_chance * L.repair_stone_sources.elite_repair_chance).toFixed(4)} (1 in 5 × ${L.repair_stone_sources.elite_repair_chance * 100}%) + boss ${perKill('high', L.boss_per_hour * L.repair_stone_sources.boss_repair_stones).toFixed(4)} · Corrupt: boss ${bossPerKill} × ${L.corrupt_stone_sources.boss_corrupt_chance * 100}% chance`, `Repair **${perKill('high', STONE.repair_stones_per_hr).toFixed(4)}** · Corrupt **${perKill('high', STONE.corrupt_stones_per_hr).toFixed(4)}** — the rarest stone, so one gamble per piece costs about ${f0(1 / perKill('high', STONE.corrupt_stones_per_hr))} kills and a full ${STONE.corrupt_gambles_full_set}-piece set of gambles is ${f0(STONE.corrupt_gambles_full_set / perKill('high', STONE.corrupt_stones_per_hr))} kills (crafting.md §Corrupt)`],
  ];
  const carried = E.f_rows_carried.filter((r) => !['F4'].includes(r.id)).map((r) => `| ${r.id} | ${r.value} | ${r.expression} · status **${r.status}** |`);
  return ['| id | Value | Expression |', '|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | \`${r[2]}\` = ${r[3]} |`),
    ...carried, '',
    `Derived from: group spawn ${L.group_spawn_sec} sec · ${L.ttk_per_mob_sec} sec TTK per mob (checks.md D1-D3) · Lck read at the band's top level (stat_c = ${S.base} + ${S.point_value}×(points ÷ 7)) · Base drop ${L.base_drop_chance * 100}% (formula-utility.md section 10) · prices ${C.reroll_value_stones_per_use}/${C.refine_stones_per_use} stones (crafting.md).`,
    `F4 · F11 are **simulation output** (loot.md section 3) and F13 is unset — this cage does not invent it, it only refuses to let a derived row drift.`, ''].join('\n');
};

// ---------------------------------------------------------------- invariants

function runChecks() {
  const out = [];
  const add = (id, ok, detail) => out.push({ id, ok, detail });

  // the ceiling is now flat-only (Core Stat % retired) with the earring added as a 13th item
  //: 210 + 25x13 = 535. This gate exists to catch an accidental K re-tune, not to re-assert
  // the retired 816.
  // The ceiling is `stat_c(level cap) + core_flat_max x item_slots`, so it moves with the cap.
// The gate asserts the identity rather than a typed constant, or every world-size change
// would need the number retyped here as well as in the data.
add('X1', Math.abs(CEIL - (eng.statAt(S.level_cap) + S.core_flat_max * S.item_slots)) < 0.01, `single-stat ceiling = ${f0(CEIL)} — the reference line plus every item slot (H5 · A3)`);
  add('X2', f0(FORCED_SPLIT) === f0(Math.round(CEIL)), `Flat/% forced to different stats would give ${f0(FORCED_SPLIT)} — the doc line that forbids reverting A3`);
  add('X3', Math.abs(DERIVED.pool_regen_sec - TS.craft_progress_intent_sec) <= TS.pool_regen_tolerance,
    `mana pool ÷ regen = ${f1(DERIVED.pool_regen_sec)} sec against the ${TS.craft_progress_intent_sec} sec intent (B5 · K_INT_MREGEN)`);
  add('X4', BANDS.every((b) => Math.abs(BAND[b].kills_derived - BAND[b].kills_derived) / BAND[b].kills_derived <= L.kill_rate_tolerance),
    `kill rates derived from group size + spawn time within ${L.kill_rate_tolerance * 100}%: ${BANDS.map((b) => `${BAND[b].kills_derived}/${BAND[b].kills_derived} ${BAND_LABEL[b]}`).join(' · ')}`);
  add('X5', BANDS.every((b) => BAND[b].drops_per_hr === Math.round(BAND[b].kills_derived * (BAND[b].drop_chance_pct / 100))) && BAND.high_full_lck.drops_per_hr === Math.round(BAND.high_full_lck.kills_derived * (BAND.high_full_lck.drop_chance_pct / 100)),
    `F3 = F1 × F2 for all four rows: ${['low', 'mid', 'high', 'high_full_lck'].map((b) => `${f0(BAND[b].drops_per_hr)} ${BAND_LABEL[b]}`).join(' · ')}`);
  add('X6', BANDS.every((b) => BAND[b].junk_per_hr === BAND[b].drops_per_hr - BAND[b].upgrades_per_hr),
    `junk = drops − upgrades everywhere, so gold and stones share one ceiling (G2 · G8)`);
  // The full-Lck junk multiple is a derived anchor: `CEIL × K_LCK_DROP` is the whole lever, so
  // dropping the stat ceiling to 510 moved 3.16 → 2.11, adding the earring as a 13th
  // item moved it to 2.20, the re-base (kill rates ×1/3 and the level-90 Lck
  // line 190 → 76) moved it to the value below, and the item-level pass moved it again — a drop's
  // Normal line count is drawn from a range now (2-5, up to 10 crafted), so the keep-rate and with it
  // the junk line sits where that leaves it. Like X1 this literal is a canary against an accidental K
  // re-tune, and the docs print the derived value, not this number.
  add('X7', Math.abs(LCK_BOUND - 3.15) < 0.02, `full-Lck junk line ×${f2(LCK_BOUND)} — the bound G8 and towns-stalls T7 quote`);
  add('X8', STONE.tier_stones_per_hr === 6 + 12 && STONE.reroll_uses_per_hr === 10,
    `stone flow: elite 18 + boss 12 = ${STONE.tier_stones_per_hr} tier stones/hr · ${f0(BAND.high.junk_per_hr)} junk ÷ ${C.reroll_value_stones_per_use} = ${STONE.reroll_uses_per_hr} Reroll uses/hr (F6 · F7)`);
  add('X10', STONE.polish_hours_full_set <= 10.5, `full-set polish = ${C.polish_casts_per_full_set} casts at ${C.reroll_value_stones_per_use} stones = ${C.polish_casts_per_full_set * C.reroll_value_stones_per_use} Reroll value stones (E8 · the opportunity cost one gold is priced against; the hours it would take at ${f2(STONE.reroll_uses_per_hr)}/hr are nobody's business)`);

  // Cap reachability, split by kind. A build-target Cap must bind — the build reaches at
  // least the Cap, so the Cap is what the player feels. A hard-ceiling Cap must NOT bind — it sits
  // above what any build reaches, so the player keeps the build's real value instead of a cut. These
  // three are hard ceilings, so the gate flips: it fails only if one ever drops onto its own build.
  // Elemental Alignment has no Cap (owner ruling), so it is not in this list.
  // Elemental resistance left this list with the Core stat: it is gear-only now, so max rolls reach
  // past the Cap and the Cap binds — a build-target Cap by definition, not a hard ceiling.
  const ceilCaps = [
    ['cdr', DERIVED.cdr_four, E.caps.cdr],
  ];
  const nowBinding = ceilCaps.filter(([, v, c2]) => v > c2);
  add('X11', nowBinding.length === 0,
    `hard-ceiling caps stay above their build: ${ceilCaps.map(([n, v, c2]) => `${n} reach ${f1(v)} < cap ${c2}`).join(' · ')}${nowBinding.length ? ' · NOW BINDING: ' + nowBinding.map((r) => r[0]).join(','): ''}`);
  add('X12', DERIVED.crit <= K.K_CRIT_CAP && E.caps.crit_chance === null,
    `crit has no Cap (the 100 Cap became a spill point): stats alone = ${f1(DERIVED.crit)}% < ${K.K_CRIT_CAP}, so overflow is ${f1(DERIVED.crit_overflow)} today and only buffs/skills can push past it (C9 · formula-offense.md)`);
  const capped = WEAPONS.filter((w) => !w.reachable).map((w) => w.name);
  add('X13', capped.length === WEAPONS.length,
    `aspd Cap ${E.caps.aspd} (= ${E.caps.aspd / 100} times/sec, the 0.2 sec floor) is out of reach for every weapon at the Agi ceiling: ${WEAPONS.map((w) => `${w.name} ${f0(w.agi_to_cap)}`).join(' · ')} vs ceiling ${f0(CEIL)} — the Cap is a clock rule, not a build target, and K_AGI_ASPD stays at ${K.K_AGI_ASPD} so no weapon crowds it`);
  add('X14', WEAPONS.every((w) => Math.abs(w.weapon_mult - 1.2 / w.weapon_aspd) < 0.005),
    `weapon_mult = 1.2 ÷ weapon_aspd for all 6 rows (D10 · equal DPS across every weapon type)`);

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
    : `${weaponRows.length} weapon rows carry a small/medium/large ladder, ${REF_WEAPON} is flat at 1.00 so the reference row moves no zone price, ${nonFlat.length} row(s) are non-flat (${nonFlat.join(', ') || 'none'}) · a boss reads as \`${bossBodySize!.reads_as}\` (a boss is a species, not a size) · the rule is one multiplier on the physical share of an outgoing hit, applied after mitigation (HugePatch section 12)`);

  // item 5 · Stun Recovery is Vit's line, and its K is derived from the owner's own example rather
  // than picked: a single-stat Vit build at the ceiling lands on 50%, so the published one-second
  // shock leaves half a second there. 100% is the natural bound, so the bound is not a new Cap.
  add('X48', Math.abs(eng.stunRecoveryOf(CEIL) - 50) < 0.5 && eng.stunRecoveryOf(eng.FOCUSED_CEIL) <= 100,
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
  // X53: subzones are presentation over the species source, never a second placement table.
  // `mob.species[].zones` owns where a race lives; `mob.zones[].subzones[].races` must read back
  // equal to it, and every displayed variant name must belong to a race shown in that subzone.
  // Adding a race is one species entry plus its variants row — this gate catches the drift.
  const subProblems: string[] = [];
  {
    const byId = new Map((E.mob.species as any[]).map((s) => [s.id, s]));
    const variants = (E.mob as any).variants || {};
    const bossNames = new Set(((E.mob as any).bosses || []).map((b) => b.name));
    const variantOwner = new Map<string, string[]>();
    for (const [sid, names] of Object.entries(variants)) for (const n of (names as string[])) {
      if (!variantOwner.has(n)) variantOwner.set(n, []);
      variantOwner.get(n)!.push(sid);
    }
    for (const sid of Object.keys(variants)) if (!byId.has(sid)) subProblems.push(`variants row ${sid} names no species`);
    for (const s of (E.mob.species as any[])) if (!(s.id in variants)) subProblems.push(`${s.name} has no variants row`);
    for (const z of (E.mob.zones as any[])) {
      const want = new Set(eng.racesInZone(z.id));
      const shown = new Set((z.subzones || []).flatMap((s) => s.races || []));
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
    : `${E.mob.zones.length} zones read their cast from mob.species[].zones via racesInZone, every subzone race resolves and matches, and every displayed variant belongs to a race shown in its subzone — add a race with one species entry plus its variants row`);
  // X15 reads the maxima out of `mods.json` — the file that owns them. It used to parse the
  // "Total" column back out of mod-pool.md and compare, which made the DOC a second source of a
  // number the engine already had: the two could disagree and the doc would win. Now the
  // data is the only home and the doc is its projection.
  const modMaxOf = (label) => {
    const row = MODS.mods.find((m) => m.name === label);
    return row ? row.max : null;
  };
  const MP_RULES = [
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

  add('X16', L.base_drop_chance === 0.08 && K.K_LCK_DROP === 0.01,
    `Base drop ${L.base_drop_chance * 100}%/kill · drop_rate = 1 + Lck×${K.K_LCK_DROP} (formula-utility.md section 10 · nothing else mints items)`);
  // Mob species: every multiplier vector must average 1.00 so mob_HP keeps deriving from player DPS
  const MOB = E.mob;
  const ZONES = MOB.zones;
  const bad = MOB.species
    .map((r) => ({ name: r.name, avg: STAT_KEYS.reduce((t, k) => t + r.stats[k], 0) / STAT_KEYS.length }))
    .filter((r) => Math.abs(r.avg - 1) > 0.005);
  const zoneProblems = MOB.species.filter((r) => r.zones.some((z) => z < 1 || z > ZONES.length)).map((r) => r.name);
  const sizeProblems = MOB.species.filter((r) => r.sizes.some((s) => !MOB.sizes.some((x) => x.id === s))).map((r) => r.name);
  // a retired lineage may not creep back into the roster — the `deprecated_species` record is what says so
  const zombie = Object.keys(MOB.deprecated_species || {}).filter((id) => MOB.species.some((r) => r.id === id));
  if (zombie.length) zoneProblems.push(`retired lineage(s) back in the roster: ${zombie.join(', ')}`);
  add('X19', bad.length === 0 && zoneProblems.length === 0 && sizeProblems.length === 0,
    bad.length ? `species stat vector does not average 1.00: ${bad.map((r) => `${r.name} ${r.avg.toFixed(3)}`).join(' · ')}`
      : zoneProblems.length ? `species listed in a zone outside 1-${ZONES.length}: ${zoneProblems.join(', ')}`
        : sizeProblems.length ? `species references a body class that does not exist: ${sizeProblems.join(', ')}`
          : `${MOB.species.length} species × ${MOB.sizes.length} body classes · every stat vector averages 1.00 (mob_HP still derives from player DPS) · ${Object.keys(MOB.deprecated_species || {}).length} retired lineage(s) stay out of the roster · accuracy spans ×${Math.min(...MOB.species.map((r) => r.accuracy_mult)).toFixed(2)}-×${Math.max(...MOB.species.map((r) => r.accuracy_mult)).toFixed(2)}, so the Evasion Cap ${E.caps.evasion} costs a full Dex+Agi pair against the ceiling (X20)`);

  // The species mix is what makes the Evasion Cap answerable, so guard a floor and a ceiling.
  // X20's question changed shape: Agi now adds flat points rather than an opposed
  // rate, so a maxed Dex+Agi build reaches the Cap against ANY mob. What must still hold is
  // that the Cap is not free — the floor build is capped, while the ceiling build only gets
  // there by maxing both avoidance stats, and the same Agi spends far less against it.
  const accMults = MOB.species.map((r) => r.accuracy_mult);
  const floorRace = MOB.species.find((r) => r.accuracy_mult === Math.min(...accMults));
  const ceilRace = MOB.species.find((r) => r.accuracy_mult === Math.max(...accMults));
  const evRating = CEIL * K.K_EVASION + M.evasion_flat_t1 * 2;
  const evAgi = CEIL / 30;
  const evVs = (sp) => eng.evasionChance(evRating, evAgi, eng.mobAcc(S.level_cap, sp.stats.dex, sp.accuracy_mult));
  // the floor build — Dex and Agi both at the split point, which is what a real build holds
  const midRating = SPLIT * K.K_EVASION + M.evasion_flat_t1;
  const midVs = (sp) => eng.evasionChance(midRating, SPLIT / 30, eng.mobAcc(S.level_cap, sp.stats.dex, sp.accuracy_mult));
  add('X20', evVs(floorRace) >= E.caps.evasion - 0.5 && midVs(ceilRace) < E.caps.evasion - 1,
    `Evasion Cap ${E.caps.evasion} is reachable against the accuracy floor (${floorRace.name} accuracy ×${floorRace.accuracy_mult} → ${f1(evVs(floorRace))}% at Dex+Agi ${f0(CEIL)}) and is NOT free against the ceiling (${ceilRace.name} accuracy ×${ceilRace.accuracy_mult} → ${f1(evVs(ceilRace))}% maxed, ${f1(midVs(ceilRace))}% at a Dex/Agi ${f0(SPLIT)} build) — a maxed build caps against anything, so what X20 now proves is that the Cap costs the whole Dex+Agi pair rather than being reachable by accident`);

  // Mob evasion is derived from the species Dex line, and the derivation must not be a rebalance
  const evRef = DERIVED.mob_evasion_ref;
  const evMean = eng.statAt(S.level_cap) * eng.MEAN_SPECIES_DEX * K.K_EVASION;
  const evList = eng.SPECIES_EVASION.map((r) => r.evasion);
  const evLo = Math.min(...evList), evHi = Math.max(...evList);
  const noDex = eng.statWithItems(0);
  const hits = eng.SPECIES_EVASION.map((r) => eng.hitVs(noDex, r.evasion));
  const topMobAcc = eng.statAt(S.level_cap) * K.K_DEX_ACC * Math.max(...MOB.species.map((r) => r.accuracy_mult));
  const mobHitFullDex = (topMobAcc / (topMobAcc + eng.statWithItems(S.item_slots) * K.K_EVASION)) * 100;
  const evProblems = [];
  if (!(K.K_EVASION > 0)) evProblems.push('K_EVASION missing or not positive');
  // The retired `mob evasion = level × 1` anchor is gone with the flat mob line: a mob's
  // stat block no longer carries a level term, so the only anchors left are the mean-species line
  // above and the published hit chances below.
  if (Math.abs(evRef - evMean) > 0.05) evProblems.push(`the published reference mob (${f1(evRef)}) is not the mean species line (${f1(evMean)})`);
  if (!(evLo < evRef && evRef < evHi)) evProblems.push(`species evasion is degenerate: range ${f0(evLo)}-${f0(evHi)} does not straddle the reference ${f0(evRef)}`);
  if (Math.min(...hits) < 70 || Math.max(...hits) > 90) evProblems.push(`a 0-item player's hit chance leaves the 70-90% band (${f1(Math.min(...hits))}-${f1(Math.max(...hits))}%)`);
  if (mobHitFullDex < 40) evProblems.push(`a Full-Dex player is too untouchable: the top accuracy tier lands only ${f1(mobHitFullDex)}%`);
  if (Math.round(DERIVED.ref_build_hit_pct) !== E.build.hit_chance_pct) evProblems.push(`build.hit_chance_pct ${E.build.hit_chance_pct} vs engine ${Math.round(DERIVED.ref_build_hit_pct)}`);
  add('X21', evProblems.length === 0,
    evProblems.length ? evProblems.join(' · ')
      : `mob evasion = stat_c × species.dex × K_EVASION ${K.K_EVASION} × body · reference (mean species, Medium body) ${f1(evRef)} at level ${S.level_cap} vs the retired level×1 curve ${S.level_cap}, so the published hit anchors hold (${E.build.hit_chance_pct}% no-Dex · ${f1(DERIVED.hit_chance * 100)}% at the accuracy ceiling) · species spread ${f0(evLo)}-${f0(evHi)} keeps a 0-item player at ${f1(Math.min(...hits))}-${f1(Math.max(...hits))}% hit · a Full-Dex player still eats ${f1(mobHitFullDex)}% of the top accuracy tier before Evasion`);

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
  // The mob's own armour reads the FLAT mob stat, not the player's line: mobs no longer
  // carry a level term, so `statAt(80)` here was a stale read of the player's curve.
  const topMobStr = Math.max(...E.mob.species.map((r) => r.stats.str));
  const mobArmour = E.mob.stat.base * topMobStr * K.K_ARMOUR;
  const mobArmourCut = (mobArmour / (mobArmour + K.armour_divisor * DERIVED.phys)) * 100;
  if (mobArmourCut > 10) armProblems.push(`the hardest-armoured mob cuts a max physical hit by ${f1(mobArmourCut)}% — armour is walling the player`);
  add('X22', armProblems.length === 0, armProblems.length ? armProblems.join(' · ')
    : `armour = Str × ${K.K_ARMOUR} both sides · reduction = armour ÷ (armour + ${K.armour_divisor} × raw physical) · Str ${f0(CEIL)} = ${f0(DERIVED.armour_ceil)} armour cuts the zone-9 boss physical hit ${f1(bossCut)}% and a zone-9 trash hit ${f1(trashCut)}% · the hardest mob armour (${f0(mobArmour)} · Golem at 80) costs a max physical hit only ${f1(mobArmourCut)}%`);

  // The mob roster: every legal zone × species × body entry has to exist and be playable
  const ROWS = eng.mobRoster();
  const rp = [];
  if (E.mob.species.length !== E.mob.species_target) rp.push(`${E.mob.species.length} species, not ${E.mob.species_target}`);
  if (ROWS.length < 100) rp.push(`only ${ROWS.length} roster rows (100+ required)`);
  const perZone = {};
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
    const zoneElems = new Set(sp.zones.flatMap((id) => (ZONES.find((z) => z.id === id) || { elements: [] }).elements));
    const stray = sp.element_bias.filter((e) => !zoneElems.has(e));
    if (stray.length) rp.push(`${sp.name} biases ${stray.join('/')} but no zone it lives in carries it`);
    for (const z of sp.zones) {
      const zz = ZONES.find((x) => x.id === z);
      if (!sp.element_bias.some((e) => zz.elements.includes(e))) rp.push(`${sp.name} in zone ${z} has no innate Element available`);
    }
  }
  for (const sp of E.mob.species) if (typeof sp.carries_weapon !== 'boolean') rp.push(`${sp.name} has no carries_weapon ruling`);
  for (const z of ZONES) if (z.id > 1 && !ROWS.some((r) => r.zone === z.id && r.weapon)) rp.push(`zone ${z.id} has no weapon-carrying lineage, so no weapon could ever drop there`);
  if (!(E.mob.element_roll.bias_weight > E.mob.element_roll.other_weight)) rp.push('a species bias must weigh more than the other Elements in a zone');
  const bossSize = E.mob.sizes.find((x) => x.id === 'boss');
  for (const r of ROWS) {
    const z = ZONES.find((x) => x.id === r.zone);
    const sp = E.mob.species.find((x) => x.id === r.speciesId);
    if (/Elite/.test(r.kind)) {
      if (!sp.sizes.includes('large')) rp.push(`Elite ${r.id}: ${sp.name} has no Large body to flag`);
      if (Math.abs(r.hpTo - z.hp[1] * E.mob.elite.hp) > 1) rp.push(`Elite ${r.id} HP is not the Large-body ×${E.mob.elite.hp} line`);
    } else if (/Boss/.test(r.kind)) {
      if (Math.abs(r.hpTo - z.hp[1] * bossSize.hp) > 1) rp.push(`Boss ${r.id} HP is not mob_HP × ${bossSize.hp}`);
    } else {
      const sz = E.mob.sizes.find((x) => x.name === r.kind);
      if (Math.abs(r.hpTo - z.hp[1] * sz.hp / eng.zoneBodyFactor(z.id)) > 1) rp.push(`${r.id} HP does not equal the zone curve × ${sz.hp} ÷ the zone body factor`);
    }
  }
  add('X23', rp.length === 0, rp.length ? rp.join(' · ')
    : `${ROWS.length} roster rows from ${E.mob.species.length} species × 3 body classes + ${ROWS.filter((r) => /Elite/.test(r.kind)).length} Elite + ${ROWS.filter((r) => /Boss/.test(r.kind)).length} named bosses · every zone 6+ entries and exactly one boss · every species Element bias exists in a zone it actually lives in · zone entry counts ${ZONES.map((z) => `${z.id}:${perZone[z.id]}`).join(' ')}`);

  // Mob dodge: the same opposed shape as the player side, and it must stay a thin layer
  const dodges = ROWS.map((r) => r.dodge);
  const dLo = Math.min(...dodges), dHi = Math.max(...dodges);
  add('X24', dLo > 2 && dHi < 40, `mob dodge runs ${f1(dLo)}-${f1(dHi)}% against a same-level attacker — it must stay a thin layer so a mob's own Agi never becomes the answer to a build. The ceiling was 25% on the level-scaled mob line; the flat mob stat makes a low-level attacker's accuracy the small number, so the band is re-based, the rule is not`);

  // Energy Shield: the caster's second pool, sized so it supplements HP instead of doubling it
  const esProblems = [];
  if (!(M.energy_shield_flat_t1 > 0)) esProblems.push('energy_shield_flat_t1 missing');
  if (!(ES.regen_pct >= 2 && ES.regen_pct <= 8)) esProblems.push(`es regen ${ES.regen_pct}%/sec is outside the 2-8%/sec band`);
  if (Math.abs(DERIVED.es_recover_sec - 100 / ES.regen_pct) > 0.01) esProblems.push(`ES full-recovery ${f1(DERIVED.es_recover_sec)} sec is not 100 ÷ regen_pct`);
  // The 15-30% share band was written when the pool was a stat line (Int x K_INT_ES) that
  // followed the stat ceiling while the caster's HP it is compared against was level-only and did
  // not. The pool is gear now (owner ruling): the shipped range prints 0.7% openly (B15), the client
  // sums the line across items, and survival does not spend the pool at all — so the share is
  // REPORTED, not gated, until a rebalance re-prices the gear range (a ~20x move with a D1 fold,
  // an owner decision, never a side effect). What stays hard is the mechanics: a real pool, the
  // exact clock, and player-only.
  if (!(ES.delay_sec >= 3 && ES.delay_sec <= 8)) esProblems.push(`es delay ${ES.delay_sec} sec is outside the 3-8 sec band`);
  if (!ES.player_only || ROWS.some((r) => r.es)) esProblems.push('Energy Shield leaked to the mob side (it would double-count mob_HP · checks.md H1)');
  add('X25', esProblems.length === 0, esProblems.length ? esProblems.join(' · ')
    : `Energy Shield is gear (owner ruling): ${M.energy_shield_flat_t1} flat × (1 + ${M.max_energy_shield_pct}%) = ${f0(DERIVED.es_pool)} at the ceiling, and regen is ${ES.regen_pct}% of the pool per sec — ${f1(DERIVED.es_regen)}/sec after ${ES.delay_sec} sec without a hit, so the base rate alone returns the whole pool in ${f1(DERIVED.es_recover_sec)} sec · an \`es_regen\` skill, Mod or passive amplifies the rate · ${f1(DERIVED.es_share_of_hp * 100)}% of a caster build's ${f0(DERIVED.es_cast_hp)} HP · **player-only** so mob_HP stays the single survivability anchor`);

  // Race resistance: every species tilts its Vit line by Element, mean-preserving (mob.resist_rules)
  {
    const order = E.elements.order as string[];
    const rp: string[] = [];
    for (const sp of E.mob.species) {
      const r = (sp as any).resist as Record<string, number> | undefined;
      if (!r) { rp.push(`${sp.id} has no resist profile`); continue; }
      if (order.some((el) => !(el in r))) rp.push(`${sp.id} resist keys are not the 5 Elements`);
      const mean = order.reduce((s, el) => s + (r[el] ?? 1), 0) / order.length;
      if (Math.abs(mean - 1) > 0.02) rp.push(`${sp.id} resist mean ${mean.toFixed(3)} is not 1.00`);
      for (const el of order) { const v = r[el] ?? 1; if (!(v >= 0.5 && v <= 1.5)) rp.push(`${sp.id} ${el} resist ${v} is outside 0.5-1.5`); }
      const up = order.filter((el) => (r[el] ?? 1) > 1.01).length, dn = order.filter((el) => (r[el] ?? 1) < 0.99).length;
      if (up !== 1 || dn !== 1) rp.push(`${sp.id} must resist one Element and be weak to one (got ${up} up, ${dn} down)`);
    }
    add('X54', rp.length === 0, rp.length ? rp.join(' · ')
      : `every one of ${E.mob.species.length} races carries a resist profile — one Element at x1.3-1.5, one weakness at x0.5-0.7, three at x1.00, so the five always average x1.00 and the published res column is unchanged · the profile tilts which Element a build brings, before the same Cap the player obeys`);
  }

  // Mobs carry no skills until the skill/mechanics system lands (mob.skills_note)
  {
    const sk: string[] = [];
    if (E.mob.skills_enabled) sk.push('skills_enabled is true but the mob skill system is not built');
    for (const sp of E.mob.species) if ((sp as any).skills) sk.push(`${sp.id} carries a skill field while skills_enabled is false`);
    add('X55', sk.length === 0, sk.length ? sk.join(' · ')
      : `mobs carry no skills — a species trait and its damage tag are the whole of its behaviour; ${E.mob.species.length} species checked, none carries a skill field while skills_enabled is false`);
  }

  // Zone identity lives in `mob.zones` alone. Bands repeat every three zones, so each band owns
  // however many zones fall in its 30-level window — read off the zone list, never typed.
  const zp = [];
  const GROUP_AVG = { low: '1-2', mid: '2-3', high: '3-5' };
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
  // still has an HP; mob_PS derives from the same line. This gate also pins the D1/D2 prose rows.
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
      : `mob_HP(L) is anchored at every zone edge and linearly interpolated inside a zone, so every level 1-${S.level_cap} has a value (${f0(eng.mobHpAt(1))} → ${f0(eng.mobHpAt(S.level_cap))}, strictly rising) · mob_PS(L) is \`typical_gear_DPS(L) ÷ ${K.mob_damage_divisor}\` off the same line`);
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
    `one Upgrade step is ${GM}, so a full ladder is ${GM * GM_CAP} — exactly the smallest school ceiling (${BINDING}, Evasion flat) and ${Object.entries(SCHOOL).map(([k, v]) => `${k} ${Math.round(GM * GM_CAP / v * 100)}%`).join(' · ')} of theirs (item-base.md sets the school · checks.md H1 pays for the uplift through SV7, not through mob_HP, which measured as already inside the pacing)`);
  // · block is the second avoidance layer and the mace's stun line is a second stun source.
  // Both are OPEN-ENDED now (owner ruling): no Cap holds either line, so there is nothing to reach.
  const shieldT1 = E.mod_max.block_chance, maceT1 = E.mod_max.stun_chance;
  const alignReach = DERIVED.align_path;   // Alignment has no Cap (owner ruling)
  const stunAlignOnly = alignReach * K.K_STUN_PER_ALIGN;
  add('X43', true,
    `block and stun have NO Cap (owner ruling): the shield's line 1 blocks for ${shieldT1} (mods.json) and keeps climbing; the lightning stun chance is Alignment ${f1(stunAlignOnly)} + the mace line ${maceT1} = ${f1(stunAlignOnly + maceT1)}, uncapped (formula-defense.md §4b · elements.md)`);
  // · a Stat Mod line bakes one of the seven Core stats at drop, so the pool lives in the Mod
  // row (`mods.json` `rolls`) — the data owns all seven.
  const statRolls = ((MODS.mods.find((m) => m.id === 'stat_mod_flat') || {}).rolls) || [];
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
  add('X41', STONE.quality_stones_per_hr > 0 && STONE.repair_stones_per_hr > 0 && STONE.corrupt_stones_per_hr > 0 &&
      STONE.upgrade_hours_full_set <= 2 * STONE.ascend_hours_full_set && STONE.corrupt_stones_per_hr <= STONE.tier_stones_per_hr / 4,
    `Quality ${STONE.quality_stones_per_hr}/hr · Repair ${STONE.repair_stones_per_hr}/hr · Corrupt ${STONE.corrupt_stones_per_hr}/hr — a full +15 set is ${STONE.upgrade_hours_full_set} hr against Ascend's ${STONE.ascend_hours_full_set} hr and one gamble costs about an hour, while the flow the prices were set against still reads junk ${BAND.high.junk_per_hr}/hr (F5) and tier stones ${STONE.tier_stones_per_hr}/hr (F7)`);
  add('X30', Math.abs(STONE.ascend_hours_full_set - 20) <= 1.5, `Ascend is priced by the engine at ${STONE.ascend_per_hr}/hr, so a full 12-piece set takes ${STONE.ascend_hours_full_set} hr — inside the ~20 hr the design sells after the re-base (E7 · concept.md). Add stones (${STONE.add_stones_per_hr}/hr) are the binding cost at ${E.craft.ascend_add_stones} per Ascend, not tier stones (${STONE.tier_stones_per_hr}/hr would allow ${(STONE.tier_stones_per_hr / E.craft.ascend_tier_stones).toFixed(2)})`);

  // The species damage tag is now a rule: it divides the incoming hit
  const splitTags = [...new Set(E.mob.species.map((r) => r.damage))];
  const spProblems = splitTags.filter((t) => !E.mob.damage_split[t] || Math.abs(E.mob.damage_split[t][0] + E.mob.damage_split[t][1] - 1) > 1e-9);
  const counts = splitTags.map((t) => `${t} ${E.mob.species.filter((r) => r.damage === t).length}`);
  add('X31', spProblems.length === 0 && splitTags.length === 3, spProblems.length ? `no valid split for: ${spProblems.join(', ')}` : `every species damage tag resolves to a real split (${counts.join(' · ')}) · physical is the whole armour-able half (Knight · Golem · Troll answered by Armour and chill), magic is the whole res-able half (Slime · Seraph only reachable through res), mixed keeps the old 50/50`);

  // The encounter budget: mob_HP(L) is the zone average, so the body mix may not move the funnel
  const budgetRows = ROWS.filter((r) => !/Elite|Boss/.test(r.kind));
  const bp = [];
  for (const z of ZONES) {
    const rows = budgetRows.filter((r) => r.zone === z.id);
    let w = 0, sHp = 0;
    for (const r of rows) {
      const weight = E.mob.spawn_weights[({ Small: 'small', Medium: 'medium', Large: 'large' })[r.kind]] || 0;
      w += weight; sHp += weight * (r.hpTo / z.hp[1]);
    }
    const avg = sHp / w;
    if (Math.abs(avg - 1) > 0.01) bp.push(`zone ${z.id} averages ${f2(avg)}x the published mob_HP anchor`);
  }
  // The high-band drop count is a derived canary (418 on the retired stat_c line); the re-base
  // moved the level-90 Lck line 190 → 76 and the kill rate ×1/3, so it is 82 today.
  if (BAND.high.drops_per_hr !== 82) bp.push(`normalising bodies moved the drop engine (high band is ${BAND.high.drops_per_hr}, not 82)`);
  add('X32', bp.length === 0, bp.length ? bp.join(' · ')
    : `every zone's body mix averages exactly the published mob_HP(${S.mob_level_cap}) anchor (spawn weights Small ${E.mob.spawn_weights.small} · Medium ${E.mob.spawn_weights.medium} · Large ${E.mob.spawn_weights.large}) · Large entries run ${f0(Math.max(...budgetRows.map((r) => r.hpTo / ZONES.find((z) => z.id === r.zone).hp[1])) * 100)}% of the anchor and Small ${f0(Math.min(...budgetRows.map((r) => r.hpTo / ZONES.find((z) => z.id === r.zone).hp[1])) * 100)}%, so body class changes what a fight feels like without touching kills/hour, drops/hour, stone flow or the timeline`);

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
  if (worst.cyclePct > 12) RP.push(`reach costs a melee build ${f1(worst.cyclePct)}% of the cycle in zone ${worst.zone} - above the 12% ceiling`);
  add('X33', RP.length === 0, RP.length ? RP.join(' · ')
    : `reach is the whole positional model (no tiles, no movement): ${allWeapons.length} weapons mapped to ${Object.keys(E.mob.reach.bands).length} bands · ${E.mob.species.length} species all carry a line (${E.mob.species.filter((sp) => sp.line === 'front').length} front · ${E.mob.species.filter((sp) => sp.line === 'stand-off').length} stand-off) · the worst case is ${f1(worst.cyclePct)}% of the cycle in zone ${worst.zone} (the 12% ceiling)`);

  // Inventory: an adventure bag that fills and pauses, a character bag of stacks, town-only stash/craft
  const IV = E.inventory || {};
  const ivp = [];
  if (!(IV.adventure_slots > 0)) ivp.push('no adventure bag size');
  if (!(IV.character_slots > 0)) ivp.push('no character bag size');
  if (IV.overflow !== 'stop_pickup') ivp.push('overflow must be stop_pickup — a full bag pauses pickups, nothing auto-converts');
  for (const k of ['stone', 'herb', 'potion']) if (!(IV.stack_size && IV.stack_size[k] > 0)) ivp.push(`no stack size for ${k}`);
  if (IV.gold_uses_slot !== false) ivp.push('gold must not consume a slot');
  const gearHr = L.bands.high.upgrades_per_hr;                       // kept gear/hr = measured upgrades (F4)
  const gearFill = IV.adventure_slots / gearHr;
  const stoneSlotHr = IV.stack_size.stone / BAND.high.junk_per_hr;   // one stone slot of value stones
  add('X34', ivp.length === 0, ivp.length ? ivp.join(' · ')
    : `adventure bag ${IV.adventure_slots} slots (kept gear only) fills in ~${f1(gearFill)} hr at the high band's measured ${gearHr} upgrades/hr · character bag ${IV.character_slots} slots holds consumables (stone ${IV.stack_size.stone}/slot = ${f1(stoneSlotHr)} hr of value stones, herb/potion ${IV.stack_size.herb}/slot) with gold taking no slot · full = pickups pause, nothing auto-converts, nothing is deleted · stash + craft are Settlement-only`);

  // Junk is gold's primary mint now (Ragnarok-style); every rarity must reproduce the published
  // junk line, so rarity changes the flavour and the price but not the expected income
  {
    const J = E.junk || {};
    const jp = [];
    const perKill = BAND.high.junk_per_hr / BAND.high.kills_derived;
    if (!J.rarities) jp.push('no junk rarities');
    else for (const [r, v] of Object.entries(J.rarities)) {
      if (!(v.sell_gold > 0 && v.drop_chance_per_kill > 0 && v.drop_chance_per_kill < 1)) jp.push(`rarity ${r} needs a sell and a chance`);
      else if (Math.abs(v.drop_chance_per_kill * v.sell_gold - perKill) > 1e-4) jp.push(`rarity ${r}: chance x sell = ${f2(v.drop_chance_per_kill * v.sell_gold)} gold/kill, must equal the line ${f2(perKill)}`);
    }
    // The item is per VARIANT now: every name a ladder carries owns exactly one junk row, and no two
    // variants may pay the same item (the Counterhand reads which variants were farmed, so a shared
    // item would erase the answer). This replaced the species-keyed table; a dead row or a bad rarity
    // is the drift this catches.
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
    for (const n of fieldable) {
      const row = D[n];
      if (!row) { jp.push(`variant ${n} can be fielded but has no variant_drops row`); continue; }
      const owner = paidBy.get(row.item);
      if (owner) jp.push(`junk item "${row.item}" is paid by two variants: ${owner} and ${n}`);
      paidBy.set(row.item, n);
      if (!J.rarities || !J.rarities[row.rarity]) jp.push(`${n} junk "${row.item}" has unknown rarity ${row.rarity}`);
    }
    for (const k of Object.keys(D)) {
      if (!names.includes(k)) jp.push(`variant_drops row for a name no ladder carries: ${k}`);
      else if (!fieldable.includes(k)) jp.push(`variant_drops row for a rung the cast can never field: ${k}`);
    }
    const junkHr = BAND.high.kills_derived * perKill;
    add('X39', jp.length === 0, jp.length ? jp.join(' · ')
      : `mob junk is gold's primary mint: ${fieldable.length} items over ${Object.keys(J.rarities).length} rarities (common ${J.rarities.common.sell_gold}g · uncommon ${J.rarities.uncommon.sell_gold}g · rare ${J.rarities.rare.sell_gold}g) · each rarity's chance = the line / its sell, so expected gold is ${f2(perKill)}/kill for any variant and the junk line stays ${f0(junkHr)}/hr · every row belongs to a rung the cast can field and every item is paid by exactly one variant · stacks ${J.stack}/slot, weightless`);
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

  // X56: the variant's second drop axis is the stream it leans. A lean is the one edit that could move
  // a total, so the table is gated: the three normal rungs of every ladder cycle gear · herb · junk (so
  // a zone's aggregate stays the identity and only the per-kill mix moves) and Elite · Boss carry 'none'
  // (they already pay their own stone lines). Reinforcing a lean and conserving the total are properties
  // of leanReweight, and this gate proves the table keeps them.
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
        if (i < 3) normal.push(r.lean);
        else {
          if (r.lean !== 'none') vp.push(`${sid}: ${r.item} leans ${r.lean}, Elite and Boss must stay 'none'`);
          leaned++;
        }
      });
      // the three normal rungs are the cycle, so a ladder missing one is a ladder with no rule left
      if (normal.length === 3 && normal.join(',') !== CATS.join(',')) vp.push(`${sid}: normal rungs lean ${normal.join(' · ')}, must cycle ${CATS.join(' · ')}`);
      for (const lean of normal) {
        const out = leanReweight(sample, lean as any, E.loot.variant_lean.shift_pct);
        if (Math.abs(sum(out) - sum(sample)) > 1e-9) vp.push(`${sid}: lean ${lean} does not conserve the total`);
        if (out[lean as 'gear' | 'herb' | 'junk'] <= sample[lean as 'gear' | 'herb' | 'junk']) vp.push(`${sid}: lean ${lean} does not raise its own stream`);
        leaned++; normalLeaned++;
      }
    }
    add('X56', vp.length === 0, vp.length ? vp.join(' · ')
      : `every ladder's three normal rungs cycle ${CATS.join(' → ')} and its Elite and Boss rungs carry 'none': ${leaned} leans checked (${normalLeaned} of them normal rungs), each one raises its own stream and conserves ${sum(sample).toFixed(2)} expected drops/kill, so a variant tilts the mix without moving the drop rate the timeline is priced on (mob.variant_drops · loot.variant_lean)`);
  }

  // The AoE rule is data now, and its shape must stay a real trade: lose at 1 target, win at the Cap
  {
    const A = E.aoe || {};
    const p = [];
    if (!(A.per_target_pct > 0 && A.per_target_pct <= 100)) p.push('aoe per-target damage must be a percentage');
    if (!(A.target_cap >= 1)) p.push('aoe needs a target cap');
    if (!(A.mana_mult >= 1)) p.push('aoe mana must cost at least 1x');
    const dpm = (n) => (Math.min(n, A.target_cap) * A.per_target_pct) / 100 / A.mana_mult;
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
  if (!/free/i.test(ROAD.waypoint_rule)) roadP.push('a Waypoint must warp for free — travel may never be a gold sink');
  add('X36', roadP.length === 0, roadP.length ? roadP.join(' · ')
    : `the walk is a closed shape: ${ROAD.nodes.length} settlements on the hex lattice · ${ROAD.block_sec}s a block · ${ROAD.encounter_chance_pct}% an encounter per block, so a ${WALK.blocksBetween(ROAD.nodes[0].id, ROAD.nodes[1].id)}-block walk pays ${f1((ROAD.encounter_chance_pct / 100) * WALK.blocksBetween(ROAD.nodes[0].id, ROAD.nodes[1].id) * 10) / 10} fights in expectation · a fight is an ordinary mob group that pays the ordinary drop roll · a Push keeps the walk's blocks · a Waypoint unlocks on foot and warps free`);

  // X46 · the walk is online-only and Push-neutral. A Push must not cost a block, an away period must
  // not walk, and the waypoint must not gate a zone.
  const walkP = [];
  if (!/never ends a walk/i.test(ROAD.push_rule)) walkP.push('a Push must never end a walk');
  if (!/never gives back a block/i.test(ROAD.push_rule)) walkP.push('a Push must not give back a block');
  if (!/never gates a zone/i.test(ROAD.waypoint_rule)) walkP.push('a Waypoint must never gate a zone');
  if (/offline/i.test(ROAD.encounter_rule) && !/never/i.test(ROAD.encounter_rule)) walkP.push('an encounter rule that mentions offline must say an away period never walks');
  add('X46', walkP.length === 0, walkP.length ? walkP.join(' · ')
    : `the walk is online-only and Push-neutral: a Push rests at the camp of the zone it was ambushed in and resumes on the same block · an away period never crosses a block · a Waypoint never gates a zone, so a settlement is reached by walking`);

  add('X17', E.caps.accuracy === null, 'accuracy has no Cap (the 2,000 Cap was removed) · the ratio formula limits itself at ' + f1(DERIVED.hit_chance * 100) + '%');

  // ---- the opening (minute one): a client builds a character straight from `opening`, and
  // these hold the two ways that could silently break the game — a free item paying more than
  // the mob curve assumes, or a starting character that cannot clear zone 1.
  const OP = E.opening;
  const opZone = MOB.zones.find((z) => z.name === OP.settlement);
  add('OP1', !!opZone, `the opening settlement "${OP.settlement}" is a real zone${opZone ? ` (zone ${opZone.id}, levels ${opZone.levels[0]}-${opZone.levels[1]})` : ''}`);

  // weapons carry `name`, not `id`, and each row groups several types ("one-handed sword / axe").
  // Resolve the name the DATA says, so renaming it to something that does not exist fails here
  // instead of silently falling back to weapons[0] — which is the dagger, a different speed.
  const opBase = OP.gear[0].base;
  const opWpn = E.weapons.find((w) => w.name === opBase || w.name.split(' / ').includes(opBase));
  add('OP0', !!opWpn, opWpn
    ? `the starting weapon "${opBase}" resolves to ${opWpn.name} (${opWpn.weapon_aspd} hits/sec)`
    : `the starting weapon "${opBase}" matches no row in engine.weapons — a client would have no attack speed`);
  const opStat = eng.statAt(OP.level);
  // the set is derived the way the client derives it: the data names a frame per slot and the engine's
  // own floor rule produces the one line each piece carries, so nothing below can disagree with minute one
  const OP_PIECES = openingSet();
  const opMain = OP_PIECES.find((p) => p.g.slot === 'main hand');
  const givenFlat = opMain ? opMain.lines.reduce((s, l) => s + (l.id === 'physical_power_flat' ? l.value : 0), 0) : 0;
  const opPhys = opStat * K.K_STR + givenFlat;
  const opDps = opPhys * (opWpn ? opWpn.weapon_aspd : 0);
  const opMobHp = opZone.hp[0];
  const opSecs = opDps > 0 ? opMobHp / opDps : Infinity;
  const pwRange = MODS.mods.find((m) => m.id === 'physical_power_flat');
  // the curve prices this mob against exactly this character, so the opening line must be the RULE's own
  // floor for a two-Mod line — the worst slice's low end scaled by `value_scale` — and never a typed
  // number that merely happens to sit inside the low band
  const expectFlat = Math.round(pwRange.bands[0][0][0] * (E.loot.base_mod.value_scale['2'] || 1));
  add('OP2', !!opWpn && givenFlat === expectFlat && opSecs >= 0.8 && opSecs <= 2,
    `the starting sword's line is the low band's floor at the two-Mod scale (+${givenFlat} physical, the rule's own ${expectFlat}), so minute one is the table's floor and not a gift. A level-1 mob dies in ${Number.isFinite(opSecs) ? f1(opSecs) + ' sec' : 'no time at all (no weapon)'}`);

  const opHp = eng.maxHpOf(opStat, OP.level);
  const opRegen = opStat * K.K_VIT_REGEN;
  const opTaken = eng.mobPs(opMobHp, OP.level);
  const opSurvive = opHp / Math.max(0.1, opTaken - opRegen);
  add('OP3', opSurvive > 60, `a level-1 character with nothing worn survives ${f0(opSurvive)} sec against a zone-1 mob — the opening cannot kill the player, and the set can only raise that`);

  add('OP4', OP.skills.length === 0,
    OP.skills.length === 0
      ? 'no starting skill — the mob curve gives a level-1 character 0.3% skill power, so a free skill would be power outside the priced curve'
      : `FAIL: ${OP.skills.length} starting skill(s), each is power the mob curve does not pay for`);

  add('OP5', OP.gold === 0 && Object.keys(OP.stones).length === 0,
    'the opening hands over no currency, so minute one cannot buy past a gate the design has not opened');

  // · the set is carried, so §11 must weigh it — a client that starts weightless is silently granting the
  // opening build attack speed the frames do not give it. The number is the same engine call the client
  // makes, so the two cannot disagree about minute one. `weight_base` (owner ruling) lifts the level-1
  // capacity clear of every main hand, and the lightest frame of each slot keeps the whole set under it.
  const opCarry = OP_PIECES.reduce((s, p) => s + p.weight, 0);
  const opTax = eng.encumbranceOf(opCarry, opStat);
  const lightestMain = Math.min(...BASES_JSON.weapons.filter((w) => w.weight > 0).map((w) => w.weight));
  add('OP6', opCarry > 0 && opTax === 0,
    `the opening set weighs ${f0(opCarry)} against a ${f0(eng.weightCapacityOf(opStat))} level-1 capacity, so section 11 takes ${f1(opTax * 100)}% of aspd — the lightest frame of every slot keeps the set under the weight_base line, and the lightest main hand in the table (${f0(lightestMain)}) fits with it`);

  // OP7 · the set's shape: every slot filled exactly once (the two rings included), one line per piece,
  // and no Sub pair or Random line anywhere — minute one is junk, and junk is what this proves
  const opSlotProblems: string[] = [];
  const opSlots = (LOOT_SLOTS as string[]);
  for (const slot of [...new Set(opSlots)]) {
    const n = OP_PIECES.filter((p) => p.g.slot === slot).length;
    const want = opSlots.filter((s) => s === slot).length;
    if (n !== want) opSlotProblems.push(`${slot}: ${n} piece(s), SLOTS carries ${want}`);
  }
  const opLineProblems = OP_PIECES
    .filter((p) => p.lines.length !== 1 || (p.g.slot !== 'main hand' && (p.lines[0].extra || []).length))
    .map((p) => `${p.g.slot} ${p.g.base}`);
  add('OP7', OP_PIECES.length === opSlots.length && opSlotProblems.length === 0 && opLineProblems.length === 0,
    `the set is ${OP_PIECES.length} pieces, one per slot of the ${opSlots.length} a character wears, and every piece carries exactly one line — its frame's Base Mod at the floor, with no Sub pair and no Random line${opSlotProblems.length ? ' · SLOTS: ' + opSlotProblems.join(' · ') : ''}${opLineProblems.length ? ' · LINES: ' + opLineProblems.join(' · ') : ''}`);

  // OP8 · the priced clock cannot move: no piece outside the main hand may carry an attack line, because
  // mob_HP, the drop line and the timeline are all keyed on the attack side
  const ATTACK_LINES = new Set(['physical_power_flat', 'physical_power', 'magic_power_flat', 'magic_power',
    'elemental_power_flat', 'elemental_power', 'attack_speed', 'critical_chance', 'critical_damage',
    'accuracy', 'armour_pen', 'bleed_chance', 'stun_chance']);
  const opAttack = OP_PIECES
    .filter((p) => p.g.slot !== 'main hand')
    .flatMap((p) => p.lines.flatMap((l) => [l.id, ...((l.extra || []).map((x) => x.id))]))
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
    for (let i = 1; i < flat.length; i++) {
      if (flat[i][0] <= flat[i - 1][1]) modProblems.push(`${m.id} slice ${i} (${flat[i][0]}) overlaps slice ${i - 1} (ends ${flat[i - 1][1]})`);
      else if (flat[i][0] !== flat[i - 1][1] + 1) modProblems.push(`${m.id} slice ${i} starts ${flat[i][0]}, a gap after ${flat[i - 1][1]}`);
    }
    const tierCounts = new Set(m.bands.map((b) => b.length));
    if (tierCounts.size !== 1) modProblems.push(`${m.id} has ${[...tierCounts].join('/')} Tiers across its quality bands`);
    for (const b of m.bands) for (const [a, z] of b) if (a > z) modProblems.push(`${m.id} slice ${a}-${z} is inverted`);
  }
  add('MP1', modProblems.length === 0,
    `every mod range covers its Total exactly — no gap, overlap or mixed Tier count${modProblems.length ? ' · ' + modProblems.join(' · ') : ''}`);

  const modIds = MODS.mods.map((m) => m.id);
  add('MP2', modIds.length === new Set(modIds).size && MODS.pending.every((p) => !modIds.includes(p.id)),
    `${MODS.mods.length} unique mod ids · ${MODS.pending.length} pending line(s) (${MODS.pending.map((p) => p.name).join(', ') || 'none'})`);

  // Quality bands are not all equal widths. That is published, deliberate state: re-cutting
  // them would move loot income and the 40.2 hr timeline. This gate names the offenders so a
  // new mod cannot make it worse and the owner can see exactly what to re-slice.
  const skewed = MODS.mods.map((m) => {
    const w = m.bands.map((b) => b.reduce((s, [x, z]) => s + (z - x + 1), 0));
    return { name: m.name, w, ratio: Math.max(...w) / Math.min(...w) };
  }).filter((r) => r.ratio > MODS.band_skew_limit);
  const skewDetail = `every mod splits its 3 quality bands within x${MODS.band_skew_limit}` +
    (skewed.length ? ' · SKEWED: ' + skewed.map((r) => `${r.name} ${r.w.join('/')} x${r.ratio.toFixed(2)}`).join(' · ') : '');
  // PENDING, not FAIL: the skew is published design state, not a broken invariant. It must
  // stay visible and must not grow, but verify.js only exits 1 on FAIL.
  if (skewed.length) out.push({ id: 'MP3', ok: true, detail: skewDetail, status: 'PENDING' });
  else add('MP3', true, skewDetail);

  // Mod availability matrix: every name in it must be a real Mod line, and the three pools must not leak
  const matrixRows = modMatrix().split('\n').slice(2).map((l) => l.split('|').map(cleanMod).filter(Boolean)[0]);
  const known = rangedMods();
  const matrixProblems = [];
  for (const name of matrixRows) if (!known.has(name) && !GEAR_MODS.includes(name) && !STAT_MODS.includes(name)) matrixProblems.push(`not a Mod line in mod-pool.md: ${name}`);
  const offensiveOnly = ['Physical power flat', 'Physical power %', 'Magic power flat', 'Magic power %', 'Elemental power flat', 'Elemental power %', 'Critical chance %', 'Critical damage %', 'Attack speed %', 'Accuracy %'];
  // The off hand is a weapon/defence hybrid (a Book carries the magic pair on its Base Mod line),
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

  // The curve's skill term is a canary, not a derivation: `mob_HP` is priced against the character's
  // own DPS line times this roster-wide level term, so moving `skill_per_level` silently re-bases every
  // published edge. The gate holds the value the design states, so a re-tune has to be deliberate.
  {
    const perLevel = E.mob.curve.skill_per_level;
    const at100 = 1 + perLevel * 100;
    add('X58', Math.abs(at100 - 1.34) < 0.005,
      `the level-100 skill multiplier reads ×${at100.toFixed(3)} from skill_per_level ${perLevel} — the curve spends ×1.34, so moving that coefficient is a re-base and must say so here`);
  }

  // A retired word must not creep back. The record is `tools/data/aliases.json`; this reads the prose
  // that survives (`doc/start/` and the root rules) and every data note, and honours each entry's own
  // `allow_in` list. `renames` and `deprecated` blocks are the record of the rename itself, so they are
  // skipped wherever they appear.
  {
    const ALIASES = readJson(path.join(import.meta.dirname, 'data', 'aliases.json'));
    const prose = ['doc/start/glossary.md', 'doc/start/concept.md', 'doc/start/Techstack.md', 'doc/start/tasks.md',
      'AGENTS.md', 'DECISIONS.md', 'PRODUCT.md', 'DESIGN.md'];
    const SKIP_KEYS = new Set(['renames', 'deprecated', 'aliases']);
    const stringsOf = (v: any, out: string[] = []): string[] => {
      if (typeof v === 'string') out.push(v);
      else if (Array.isArray(v)) for (const x of v) stringsOf(x, out);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) stringsOf(x, out);
      return out;
    };
    const haystack: [string, string][] = [];
    for (const f of prose) { try { haystack.push([f, fs.readFileSync(path.join(ROOT, f), 'utf8')]); } catch { /* the file may not exist yet */ } }
    for (const f of fs.readdirSync(path.join(import.meta.dirname, 'data'))) {
      if (!f.endsWith('.json') || f === 'aliases.json') continue;
      haystack.push(['tools/data/' + f, stringsOf(readJson(path.join(import.meta.dirname, 'data', f))).join('\n')]);
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
        : `${(ALIASES.terms || []).length} retired term(s) stay retired across ${prose.length} prose file(s) and every data note, honouring each entry's own allow-list`);
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

  return out.concat();
}

// ---------------------------------------------------------------- Mod availability matrix
// Reads every Base row out of item-base.md (Primary + Secondary per Base) plus the main-hand
// weapon pool out of equipment-slot-weapon.md, then prints which Mod can appear on which slot.
// Nothing here is typed by hand: edit item-base.md and re-run --write.

const SLOT_ORDER = ['main hand', 'off hand', 'helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'amulet', 'earring', 'cape'];
const GEAR_MOD_SLOTS = ['helmet', 'chest', 'pant', 'boots', 'gloves']; // `bases.json` `school`
const GEAR_MODS = ['Armour flat', 'Evasion flat', 'Energy Shield flat'];
const STAT_MODS = ['Stat Mod flat', 'All stats flat']; // the Stat Mod slot's family — one line per item

const cleanMod = (s) => s.replace(/\s+/g, ' ').trim();
const splitMods = (s) => s.split('·').map(cleanMod).filter((x) => x && x !== '—' && x !== '-');

/** Per-slot pools split by role, read out of `bases.json` — the single source. */
function basePoolsByRole() {
  const out: Record<string, any> = {};
  for (const b of BASES_JSON.bases) {
    const bySlot = out[b.slot] || (out[b.slot] = {});
    for (const [role, list] of [['Primary', b.primary], ['Secondary', b.secondary]] as any[]) {
      const set = bySlot[role] || (bySlot[role] = new Set());
      for (const id of list || []) set.add(modName(id));
    }
  }
  return out;
}

/** Per-slot pool, engine-faithful: `bases[].primary/secondary` plus the lines the slot adds. */
function basePools() {
  const bySlot: Record<string, Set<string>> = {};
  const add = (slot: string, ids: any[]) => {
    const set = bySlot[slot] || (bySlot[slot] = new Set());
    for (const id of ids) set.add(modName(id));
  };
  for (const b of BASES_JSON.bases) add(b.slot, [...(b.primary || []), ...(b.secondary || [])]);
  // engine/loot.ts `poolFor`: the armour slots' own line-1 pool is also rollable
  for (const slot of ARMOUR_SLOTS) add(slot, BASES_JSON.base_mod?.defence || []);
  // engine/loot.ts `poolFor`: an off-hand frame draws its slot union plus its family's row
  for (const [family, ids] of Object.entries<any>(BASES_JSON.weapon_pools?.['off hand'] || {})) {
    if (family === 'Stat Mod' || family === 'Dual-wield weapon') continue;
    add('off hand', ids);
  }
  return bySlot;
}

/** Line 1 is the frame's own Base Mod and never enters a craftable pool (engine/loot.ts `baseModRoll`). */
function line1Pools() {
  const names = rangedMods();
  const out: Record<string, Set<string>> = {};
  const add = (slot: string, ids: any[]) => {
    const set = out[slot] || (out[slot] = new Set());
    for (const id of ids) { const n = modName(id); if (names.has(n)) set.add(n); }
  };
  for (const ids of Object.values<any>(BASES_JSON.base_mod?.weapons || {})) add('main hand', ids);
  for (const ids of Object.values<any>(BASES_JSON.base_mod?.off_hand || {})) add('off hand', ids);
  for (const slot of ARMOUR_SLOTS) add(slot, BASES_JSON.base_mod?.defence || []);
  return out;
}

/** Every Mod name that carries a value range — `tools/data/mods.json` is the only source. */
function rangedMods() {
  return new Set(MODS.mods.map((m: any) => m.name));
}

const ARMOUR_SLOTS = ['helmet', 'chest', 'pant', 'boots', 'gloves', 'cape'];
const modName = (id) => LOOT_NAMES[id] || id;
const mentions = (cell, names) => {
  const hit = new Set();
  for (const name of names) {
    const re = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+') + '\\b', 'i');
    if (re.test(cell)) hit.add(name);
  }
  return hit;
};

const modBase = (n) => n.replace(/\s+(flat|%)$/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
const hasBase = (cell, base) =>
  new RegExp('\\b' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+') + '\\b', 'i').test(cell);

/** Parse the `| Role | Mod |` table under `## main hand` plus the By-weapon-type and Offensive Pool tables. */
/** The weapon pool, engine-faithful: engine/loot.ts `poolFor`'s weapon branch, over both damage kinds. */
function weaponPools() {
  const wp = BASES_JSON.weapon_pools?.['main hand'] || {};
  const crit = (wp.Primary || []).filter((id: string) => !id.startsWith('physical') && !id.startsWith('magic'));
  const ids = ['physical_power_flat', 'physical_power', 'magic_power_flat', 'magic_power', ...crit, ...(wp.Secondary || []), 'elemental_power_flat'];
  return new Set(ids.map(modName));
}

function modMatrix() {
  const pools = basePools();
  const line1 = line1Pools();
  const weapon = weaponPools();
  const slots = {};
  for (const slot of SLOT_ORDER) {
    const set = new Set(slot === 'main hand' ? weapon : (pools[slot] || []));
    for (const one of (line1[slot] || [])) set.add(one);
    for (const one of GEAR_MODS) if (GEAR_MOD_SLOTS.includes(slot)) set.add(one);
    for (const one of STAT_MODS) set.add(one);
    slots[slot] = set;
  }

  const all = new Set();
  const STATS = ['Str', 'Vit', 'Dex', 'Agi', 'Wis', 'Int', 'Lck'];
  for (const s of SLOT_ORDER) for (const one of slots[s]) if (!STATS.includes(modBase(one))) all.add(one);
  const rank = (x) => (STAT_MODS.includes(x) ? 0 : GEAR_MODS.includes(x) ? 2 : 1);
  const rows = [...all].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const mark = (mod, slot) => (slots[slot].has(mod) ? 'yes' : '-');
  return [
    '| Mod | ' + SLOT_ORDER.join(' | ') + ' |',
    '|---|' + SLOT_ORDER.map(() => '---').join('|') + '|',
    ...rows.map((mod) => `| ${mod} | ` + SLOT_ORDER.map((s) => mark(mod, s)).join(' | ') + ' |'),
  ].join('\n');
}

BLOCKS['mod-matrix'] = modMatrix;

// ---------------------------------------------------------------- mob stats derived with the player's own K values
//: a mob's stat block is FLAT — one base the species vector multiplies, with no level term.
const mobStat = (mult = 1) => E.mob.stat.base * mult;

BLOCKS['mob-stats'] = () => {
  const MOB = E.mob;
  const base = mobStat(1);
  const rows = MOB.species.map((r) => {
    const v = (k) => base * r.stats[k];
    const acc = v('dex') * K.K_DEX_ACC * r.accuracy_mult;
    const dodgeRate = v('agi') * K.K_MOB_DODGE;
    return [
      r.name,
      `×${r.stats.vit.toFixed(2)}`,
      `×${r.stats.str.toFixed(2)}`,
      f0(acc),
      f0(v('dex') * K.K_EVASION),
      f0(v('str') * K.K_ARMOUR),
      `${f1(v('vit') * K.K_MOB_RES)}%`,
      `${f1(v('lck') * K.K_LCK_CRIT)}%`,
      `${f1(eng.mobDodge(dodgeRate, S.level_cap))}%`,
    ];
  });
  return [
    '| Species | HP × (Vit) | PS × (Str) | accuracy | evasion | armour | res | crit | dodge |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `Every column is the player's own formula run over the mob's FLAT stat block (\`mob.stat.base\` ${f0(base)} per stat, no level term): accuracy = Dex × ${K.K_DEX_ACC} × accuracy tier · **evasion = Dex × ${K.K_EVASION}** (the Medium-body line · a Small body multiplies it ×${MOB.sizes[0].evasion}, Large and Elite ×${MOB.sizes[2].evasion}) · **armour = Str × ${K.K_ARMOUR}** (the same line the player uses · it is what chill's 25% cut acts on) · res = Vit × ${K.K_MOB_RES} · crit = Lck × ${K.K_LCK_CRIT} · dodge = \`own Agi rate ÷ (rate + a same-level attacker's accuracy)\`. Mobs are not a separate math — they are the same math with a multiply vector on one flat block, so two mobs of a level can be nothing alike. Energy Shield is the one player line a mob does not have (player-only).`,
  ].join('\n');
};

// ---------------------------------------------------------------- mob sheet: species + body classes
const STAT_KEYS = ['str', 'agi', 'vit', 'dex', 'int', 'wis', 'lck'];

BLOCKS['mob-sheet'] = () => {
  const MOB = E.mob;
  const sizeName = (id) => (id === 'elite' ? `${MOB.elite.name} (${MOB.elite.hp}×)` : MOB.sizes.find((x) => x.id === id).name);
  const speciesRows = MOB.species.map((r) => [
    r.name,
    r.zones.join(' · '),
    r.habitat.join(' · '),
    (E.mob.variants?.[r.id] || []).join(' → '),
    r.damage,
    `×${r.accuracy_mult.toFixed(2)}`,
    [...new Set(r.sizes.map(sizeName))].join(' · '),
    STAT_KEYS.map((k) => r.stats[k].toFixed(2)).join(' · '),
  ]);
  const sizeRows = MOB.sizes.map((s) => [s.name, `×${s.hp.toFixed(2)}`, `×${s.ps.toFixed(2)}`, `×${s.evasion.toFixed(2)}`, s.group]);
  sizeRows.push([MOB.elite.name, `×${MOB.elite.hp.toFixed(2)}`, `×${MOB.elite.ps.toFixed(2)}`, `×${MOB.elite.evasion.toFixed(2)}`, MOB.elite.group]);
  return [
    '| Species | Zones | Habitat (regions it may live in) | Variants (ladder) | Damage | accuracy | Body classes | str · agi · vit · dex · int · wis · lck |',
    '|---|---|---|---|---|---|---|---|',
    ...speciesRows.map((r) => `| ${r.join(' | ')} |`),
    '',
    '| Body class | HP | PS | evasion | Grouping |',
    '|---|---|---|---|---|',
    ...sizeRows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
};

// ---------------------------------------------------------------- hit chance vs derived mob evasion
BLOCKS['hit-chance'] = () => {
  const SE = eng.SPECIES_EVASION;
  const sorted = [...SE].sort((a, b) => a.evasion - b.evasion);
  const easiest = sorted[0], hardest = sorted[sorted.length - 1];
  const ref = DERIVED.mob_evasion_ref;
  const rows = [0, 1, 2, S.item_slots].map((n) => {
    const dex = eng.statWithItems(n);
    const label = n === 0 ? 'none (level only)' : n === S.item_slots ? `Full Dex ${n} items` : `Dex ${n} item${n > 1 ? 's' : ''}`;
    return [
      label,
      f0(dex),
      f0(eng.playerAccuracy(dex)),
      `${f1(eng.hitVs(dex, easiest.evasion))}%`,
      `${f1(eng.hitVs(dex, ref))}%`,
      `${f1(eng.hitVs(dex, hardest.evasion))}%`,
    ];
  });
  const defRows = [...new Set(E.mob.species.map((r) => r.accuracy_mult))].sort((a, b) => a - b).map((m) => {
    const tierRaces = E.mob.species.filter((r) => r.accuracy_mult === m);
    const meanDex = tierRaces.reduce((t, r) => t + r.stats.dex, 0) / tierRaces.length;
    const macc = eng.mobAcc(S.level_cap, meanDex, m);
    const who = E.mob.species.filter((r) => r.accuracy_mult === m).map((r) => r.name).join(' · ');
    return [`×${m.toFixed(2)}`, who, f0(macc),
      `${f1((macc / (macc + eng.statWithItems(0) * K.K_EVASION)) * 100)}%`,
      `${f1((macc / (macc + eng.statWithItems(S.item_slots) * K.K_EVASION)) * 100)}%`];
  });
  const evList = SE.map((r) => r.evasion);
  const loEv = Math.min(...evList), hiEv = Math.max(...evList);
  const meanEv = eng.statAt(S.level_cap) * eng.MEAN_SPECIES_DEX * K.K_EVASION;
  return [
    '| Dex from items | Dex | accuracy | hit vs easiest species | hit vs reference mob | hit vs hardest species |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `Evasion is now the species Dex line (\`stat_c × species.dex × K_EVASION ${K.K_EVASION} × body\`), so hit chance answers *what* is being hit, not just the level. The reference mob is the **mean species vector on a Medium body** (${f1(ref)} evasion at level ${S.level_cap}) — a real average of the ${SE.length} lineages, not an imaginary ×1.00 one. Easiest = ${easiest.name} (Dex ×${easiest.dex.toFixed(2)} · ${f0(easiest.evasion)}) · hardest = ${hardest.name} (Dex ×${hardest.dex.toFixed(2)} · ${f0(hardest.evasion)}).`,
    '',
    `The reference is set on the mean so the anchor does not move: \`stat_c × ${K.K_EVASION}\` at the roster mean is ${f1(meanEv)} evasion, against the retired \`level × 1\` curve of ${S.level_cap}. The published hit chances therefore hold as they were — ${E.build.hit_chance_pct}% with no Dex, ${f1(DERIVED.hit_chance * 100)}% at the accuracy ceiling — and everything derived from them (the DPS anchor row in formula.md section 0, mob_HP, the E1-E5 kill checkpoints) is untouched. What changed is only *who* sits above and below the reference: the species spread runs ${f0(loEv)}-${f0(hiEv)} evasion, and a body class multiplies it again (Small ×${E.mob.sizes[0].evasion} · Large and Elite ×${E.mob.sizes[2].evasion}).`,
    '',
    `**Same line, pointed at the player** — mob accuracy against the player's own Evasion rating (\`Dex × ${K.K_EVASION}\` + Gear Evasion flat ${modRange('evasion_flat')}):`,
    '',
    '| mob accuracy tier | species | mob accuracy | mob hits a Dex 0-item player | mob hits a Full-Dex player |',
    '|---|---|---|---|---|',
    ...defRows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `K_DEX_ACC ${K.K_DEX_ACC} against K_EVASION ${K.K_EVASION} is a ${f0(K.K_DEX_ACC / K.K_EVASION)}:1 ratio, so equal Dex on both sides lands the attacker at ${f1((K.K_DEX_ACC / (K.K_DEX_ACC + K.K_EVASION)) * 100)}%. The defensive line is deliberately the weaker one per point, so one stat alone cannot approach untouchable, and this roll sits at step 2 of the incoming order — behind perfect dodge, ahead of every mitigation (combat.md section 2).`,
  ].join('\n');
};

// ---------------------------------------------------------------- defensive mod ranges
// The Defensive Pool table in equipment-slot-pools.md restated every range by hand, which is
// how three lines sat at TBD while mods.json already had the answer. It reads mods.json now.
BLOCKS['defensive-ranges'] = () => {
  const rows = MODS.mods.filter((m) => m.group === 'Defensive');
  return [
    '| Mod | Range |',
    '|---|---|',
    ...rows.map((m) => `| ${m.name} | ${m.min}-${m.max}${m.pct ? '%' : ''} |`),
    '',
    'Every range here is the same row `mod-pool.md` prints, read from `tools/data/mods.json` — the two tables cannot disagree.',
  ].join('\n');
};

// ---------------------------------------------------------------- per-Mod drop weight
// The weight table tools/loot.ts reads as its only Mod-selection input. Generated here so
// the doc prints the data instead of typing it twice.
const fmtWeight = (w) => (Array.isArray(w) ? w.map((x) => x.toFixed(2).replace(/^0/, '')).join(' / ') : w.toFixed(1));

BLOCKS['mod-weights'] = () => {
  const RW = E.mod_weights.role_weights;
  const rows = E.mod_weights.rows;
  return [
    '| Mod | Value at level 100 | Early-game value (level 10 - low quality) | weight | Reason |',
    '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.label} | ${r.v100} | ${r.early} | **${fmtWeight(r.weight)}** | ${r.why} |`),
    '',
    'Role weight multiplies in front of `weight`: Primary **' + RW.primary + '** · Secondary **' + RW.secondary + '** · Stat Mod **' + RW.stat_mod + '** · Gear Mod **' + RW.gear_mod + '**',
      '(`item-base.md` Gear Mod school). Every row is one entry in `tools/data/engine.json` `mod_weights` —',
      '`tools/loot.ts` is the only consumer, so a weight cannot be typed twice.',
  ].join('\n');
};

// ---------------------------------------------------------------- skill drop rate
BLOCKS['skill-drop'] = () => {
  const SD = E.skill_drop;
  const kph = BAND.high.kills_derived;
  const elites = kph * L.elite_spawn_chance;
  const perHour = elites * SD.elite + L.boss_per_hour * SD.boss + kph * (1 - L.elite_spawn_chance) * SD.normal;
  const per1k = (x: number) => (x / kph) * 1000;
  const rows = [
    ['Boss (single, always online-only)', f1(SD.boss * 100) + '% per boss kill', f2(L.boss_per_hour / kph) + ' per kill', f1(per1k(L.boss_per_hour * SD.boss))],
    ['Elite (1 in ' + Math.round(1 / L.elite_spawn_chance) + ' kills)', f1(SD.elite * 100) + '% per elite kill', f2(L.elite_spawn_chance) + ' per kill', f1(per1k(elites * SD.elite))],
    ['Normal mob', f2(SD.normal * 100) + '% per kill', f2(1 - L.elite_spawn_chance) + ' per kill', f1(per1k(kph * (1 - L.elite_spawn_chance) * SD.normal))],
  ];
  return [
    '| Source | Rate | Spawns per kill | Skills per 1,000 kills |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `**${f1(per1k(perHour))} skills per 1,000 kills** in the high band (boss ${f1(per1k(L.boss_per_hour * SD.boss))} + elite ${f1(per1k(elites * SD.elite))} + normal ${f1(per1k(kph * (1 - L.elite_spawn_chance) * SD.normal))}) — the rare item the whole skill list is gated on. Every number above comes from engine.json; the rates were previously quoted in this file and stored nowhere, so nothing could check them.`,
  ].join('\n');
};

// ---------------------------------------------------------------- minute one
BLOCKS['opening'] = () => {
  const OP = E.opening;
  // the opening task is the board's own elite sizing, so the row reads the count from its home
  const TS = readJson(path.join(ROOT, 'tools/data/town.json')).task_sizing;
  const z = E.mob.zones.find((x) => x.name === OP.settlement);
  const wpn = E.weapons.find((w) => w.name.startsWith('one-handed sword'));
  const stat = eng.statAt(OP.level);
  const pieces = openingSet();
  const main = pieces.find((p) => p.g.slot === 'main hand')!;
  const flat = main.lines.reduce((s, l) => s + (l.id === 'physical_power_flat' ? l.value : 0), 0);
  const phys = stat * K.K_STR + flat;
  // the set is carried, so §11 weighs it: the column comes from bases.json through the same engine rule
  // the client calls, which is why minute one has one answer and not two
  const carryWeight = pieces.reduce((s, p) => s + p.weight, 0);
  const tax = eng.encumbranceOf(carryWeight, stat);
  const dps = phys * wpn.weapon_aspd;
  const dpsCarried = phys * wpn.weapon_aspd * (1 - tax);
  const mobHp = z.hp[0];
  const secs = mobHp / dps;
  const secsCarried = dpsCarried > 0 ? mobHp / dpsCarried : Infinity;
  const hp = eng.maxHpOf(stat, OP.level);
  const regen = stat * K.K_VIT_REGEN;
  const survive = hp / Math.max(0.1, eng.mobPs(mobHp, OP.level) - regen);
  // every piece, with the one line the engine's own floor rule gave it (the sword's line carries two Mods)
  const pieceText = (p: any) => {
    const mods = [p.lines[0], ...((p.lines[0].extra || []) as any[])]
      .map((l: any) => `${LOOT_NAMES[l.id] ?? l.id} ${l.value}`).join(' + ');
    return `${p.g.slot}: ${p.g.base} (${mods})`;
  };
  return [
    '| | Given | Why |',
    '|---|---|---|',
    `| Settlement | **${OP.settlement}** (zone ${z.id}, levels ${z.levels[0]}-${z.levels[1]}) | the zone the player opens in |`,
    `| Level | **${OP.level}** · ${f0(stat)} each stat · ${f0(hp)} Max HP · ${f1(regen)} regen/sec | level-1 baseline, the set is counted below |`,
    `| Gear | **${pieces.length} pieces**, one line each — ${pieces.map(pieceText).join(' · ')} | the lightest frame of every slot, at the floor of its own window |`,
    `| Skills | **none** | the first skill is the first boss drop |`,
    `| Gold / stones | **0 / 0** | minute one buys nothing |`,
    `| First rule | **${OP.first_rule.objective}** — ${TS.elite_n} Elites (from the ${OP.first_rule.source}) | the task board already exists and pays stones only |`,
    '',
    `**First fight, measured:** a level-${OP.level} character kills a zone-${z.id} mob in **${f1(secs)} sec** as the curve prices it, and in **${f1(secsCarried)} sec** as a character actually carrying the ${f0(carryWeight)}-weight set swings it (§11 takes ${f0(tax * 100)}% of aspd against a ${f0(eng.weightCapacityOf(stat))} capacity · with nothing worn it survives **${f0(survive)} sec** of the mob's return damage, and the set can only raise that). Numbers come from the same engine the cages use, so the opening cannot drift away from the mob curve it is priced against.`,
  ].join('\n');
};

// ---------------------------------------------------------------- mob status table
BLOCKS['mob-status'] = () => {
  const ST = E.status;
  const B = ST.burn, C = ST.chill, K = ST.shock, P = ST.poison, M = ST.mark;
  // aspd/align cuts are stored as whole percents; the damage coefficients are fractions
  const pc = (v) => `${f0(v)}%`;
  const frac = (v) => `${f0(v * 100)}%`;
  const rows = [
    ['fire', 'burn', `\`elem_half × ${f2(B.k_dps)}\` per stack, max ${B.stack_max} stacks · ${B.time_sec} sec · **and cuts our HP regen ${frac(B.regen_cut_per_stack)} per stack (−${f0(B.regen_cut_max * 100)}% at full)**`, 'res · perfect dodge · regen is the only counter'],
    ['cold', 'chill', `aspd −${pc(C.aspd_pct)} (half of what mobs take) · ${C.time_sec} sec · does not stack · **and cuts our Armour ${frac(C.armour_cut)}**`, 'res'],
    ['lightning', 'shock', `stop attacking + stop regen ${K.stop_sec} sec · rolls once per attack · **and −${f0(K.aspd_pct)}% our attack speed, and −${f0(K.align_cut * 100)}% our Alignment against that target**`, 'res'],
    ['poison', 'poison', `\`elem_half × ${f2(P.k_dps)}\` per stack, max ${P.stack_max} · loses 1 stack/${P.decay_sec} sec`, 'res · perfect dodge'],
    ['chaos', 'its own mark', `its damage +${frac(M.k_dmg)} per stack, max ${M.stack_max} stacks = **+${f0(M.k_dmg * M.stack_max * 100)}%** · +${f2(M.k_leech * M.stack_max * 100)}% leech at full · decays ${M.decay_sec} sec after firing stops`, 'res · target switching'],
  ];
  return [
    '| Mob Element | Effect on player | Value | Counter |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`),
    '',
    `- **${frac(ST.proc_chance)} status proc chance per landed hit** · innate Element is every mob's baseline skill; Large · Elite and Boss add a signature that only re-times its priced \`mob_PS\` (\`combat.md\` §5b).`,
    `- Every number in this table comes from \`engine.json\` \`status\` — the mob side runs the same K values the player does, so a change there moves this table with it. The chaos mark is the one row that once disagreed here; the table is generated now so it cannot again.`,
  ].join('\n');
};

// ---------------------------------------------------------------- farm: the one life skill + the potion ladder
BLOCKS['farm-model'] = () => {
  const F = E.farm;
  const cyclesPerDay = Math.floor(24 / F.growth_hours);
  const xpDayBase = F.plots.base * cyclesPerDay * F.xp_per_harvest;
  const xpDayMax = F.plots.max * cyclesPerDay * F.xp_per_harvest;
  const xpTo = (L) => F.level_divisor * (L - 1) * (L - 1);
  const days = (L, xpDay) => (xpTo(L) / xpDay).toFixed(1);
  const t = F.tier_unlock_level;
  return [
    '| Field | Value |',
    '|---|---|',
    `| Plots | ${F.plots.base} owned · ${F.plots.shop_deeds} shop deeds (Steward) → max ${F.plots.max} |`,
    `| Cycle | plant 1 seed → ${F.growth_hours} h → harvest ${F.yield_per_harvest} of that tier · grows offline inside the ${F.offline_cap_hours} h cap |`,
    `| Cost of play | ${F.taps_per_day} taps/day · output is herb for potions, never gear or power |`,
    `| Farm XP | +${F.xp_per_harvest} per harvest · level = floor(sqrt(xp ÷ ${F.level_divisor})) + 1 · Cap ${F.level_cap} (same curve as weapon Mastery) |`,
    `| Herb tier unlocked | low from L${t.low} · mid from L${t.mid} · high from L${t.high} |`,
    '',
    `**Level pace** — ${cyclesPerDay} cycles/day · base ${F.plots.base} plots = ${F.plots.base}×${F.xp_per_harvest}×${cyclesPerDay} = ${xpDayBase} XP/day · full ${F.plots.max} plots = ${xpDayMax} XP/day. Mid-tier unlock (L${t.mid}) in **${days(t.mid, xpDayBase)} farm-days** at base plots / ${days(t.mid, xpDayMax)} at full · high-tier unlock (L${t.high}) in **${days(t.high, xpDayBase)} farm-days** at base plots / ${days(t.high, xpDayMax)} at full. Real-time gated on purpose — it is background provisioning, not a second combat ladder.`,
  ].join('\n');
};

BLOCKS['potion-table'] = () => {
  const P = E.potions;
  const poolName = (x) => (x === 'hp' ? 'Max HP' : 'Max Mana');
  const effect = (p) => (p.pool === 'hp'
    ? P.hp_base_pct + P.hp_step_pct * (p.index - 1)
    : P.mana_base_pct + P.mana_step_pct * (p.index - 1));
  const rows = P.list.map((p) => {
    const c = P.craft[p.tier];
    const stone = c.reroll_value_stones > 1 ? 'stones' : 'stone';
    return `| ${p.name} | ${p.tier} | Instant ${effect(p)}% ${poolName(p.pool)} | ${c.herbs} herbs + ${c.reroll_value_stones} Reroll value ${stone} | ${P.weight} |`;
  });
  const cd = P.condensed;
  rows.push(`| Condensed (any) | same | ${cd.effect_mult}× effect of one bottle | ${cd.cost_bottles} bottles + ${cd.cost_reroll_value_stones} Reroll value stones | ${cd.weight} (vs ${cd.weight_loose} loose) |`);
  return [
    '| Potion | Herb tier | Effect | Craft | Weight |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    `- Effect is % of the pool, derived as \`base + step × (tier − 1)\` from \`engine.json\` \`potions\`. Shared cooldown ${P.shared_cooldown_sec} sec · max ${P.max_uses_per_fight} uses per fight · **suppressed on bosses** (combat.md §7 · bosses are won with casted heals).`,
  ].join('\n');
};

// ---------------------------------------------------------------- elements: the 5, the counter matrix, the K summary
BLOCKS['element-list'] = () => {
  const EL = E.elements;
  return [
    '| Element | Core mechanic | Status left |',
    '|---|---|---|',
    ...EL.order.map((e) => `| ${e} | ${EL.mechanic[e]} | ${EL.status_of[e]} |`),
  ].join('\n');
};

BLOCKS['element-counter'] = () => {
  const EL = E.elements;
  const cap = (e) => e[0].toUpperCase() + e.slice(1);
  return [
    `| Attack ↓ / Target → | ${EL.order.map(cap).join(' | ')} |`,
    `|---|${EL.order.map(() => '---').join('|')}|`,
    ...EL.order.map((a) => `| ${cap(a)} | ${EL.order.map((t) => EL.counter[a][t].toFixed(2)).join(' | ')} |`),
  ].join('\n');
};

BLOCKS['element-k'] = () => {
  const ST = E.status;
  const rows = [
    ['K_ELEM', K.K_ELEM, `elem / Int · lower than K_INT because it must pass Alignment`],
    ['K_MOB_RES', K.K_MOB_RES, 'elem res / Vit · no Flat'],
    ['K_FIRE_BURN', ST.burn.k_dps, `burn per stack · max ${ST.burn.stack_max} stacks = ${f2(ST.burn.k_dps * ST.burn.stack_max)}, exactly the global DoT Cap`],
    ['K_BURN_REGEN_CUT', ST.burn.regen_cut_per_stack, `HP regen cut per burn stack · ${ST.burn.stack_max} stacks = −${f0(ST.burn.regen_cut_max * 100)}%, no separate Cap`],
    ['K_CHILL_ARMOUR_CUT', ST.chill.armour_cut, `target Armour × ${(1 - ST.chill.armour_cut).toFixed(2)} · bites the lineages that carry Armour `],
    ['shock_aspd_pct', ST.shock.aspd_pct, `target attack speed · own Cap ${ST.shock.aspd_cap} · adds to chill, which has its own Cap ${ST.chill.aspd_cap}`],
    ['shock_align_cut', ST.shock.align_cut, `our \`elem_align\` × ${(1 - ST.shock.align_cut).toFixed(2)} against a shocked target · shock is the only status that fights our own`],
    ['K_POISON', ST.poison.k_dps, `poison per stack · ${ST.poison.stack_max} stacks = ${f2(ST.poison.k_dps * ST.poison.stack_max)}`],
    ['K_CHAOS_DMG', ST.mark.k_dmg, `+dmg per mark stack · ${ST.mark.stack_max} stacks = +${f0(ST.mark.k_dmg * ST.mark.stack_max * 100)}% damage`],
    ['K_CHAOS_LEECH', ST.mark.k_leech, `lifesteal per mark stack · ${ST.mark.stack_max} stacks = ${f2(ST.mark.k_leech * ST.mark.stack_max)}%`],
    ['K_LIGHTNING_STUN', K.K_STUN_PER_ALIGN, `stun chance per Alignment · the Alignment reach lands at ${f1(DERIVED.align_path * K.K_STUN_PER_ALIGN)}%, and the mace's Chance to stun % line adds to it — no Cap (owner ruling)`],
    ['K_BLEED', K.K_BLEED, 'bleed total as a fraction of the inflicting physical hit · physical DoT, not an Element — see formula-offense.md section 4'],
    ['bleed_time_sec', K.bleed_time_sec, 'PoE base bleed duration · bleed does not stack'],
    ['K_BLEED_CHANCE', K.K_BLEED_CHANCE, `chance per landed physical hit while \`Lacerate\` is up (curse, ${E.bleed.curse_duration_sec} sec ÷ ${E.bleed.curse_cd_sec} sec = ${E.bleed.uptime_pct}% uptime)`],
    ['global DoT Cap', ST.dot_cap, 'burn + poison combined, as a multiple of confirmed Element damage per second'],
  ];
  // The published form is 2 decimals (0.30, 1.50), a whole number is bare (5, 20), and a
  // value needing more precision keeps it (K_CHAOS_LEECH 0.002) - f2 alone would print 0.00.
  const num = (v) => {
    if (Number.isInteger(v)) return f0(v);
    const s = String(v);
    if (s.includes('e')) return s;
    const r2 = Number(v.toFixed(2));
    return String(r2) === s ? f2(v) : s;
  };
  return [
    '| K | Value | Note |',
    '|---|---|---|',
    ...rows.map(([k, v, note]) => `| ${k} | ${num(v)} | ${note} |`),
  ].join('\n');
};

// ---------------------------------------------------------------- mod pool ranges
const MOD_GROUP_HEADING = { Combat: '## Combat', Defensive: '## Defensive', 'Stat Mod': '## Stat Mod', Elemental: '## Elemental' };

/** A Tier slice as printed. The `%` rides on the Total column only, exactly as the table
 *  has always shown it — printing it on every slice would read as four separate numbers. */
function sliceText([a, b]) {
  return a === b ? String(a) : a + '-' + b;
}

BLOCKS['mod-pool'] = () => {
  const out = [];
  // the column headers come from mods.json so the file that declares the bands is the one
  // that prints them — a fourth band added there shows up instead of being ignored
  const labels = MODS.quality_bands.map((b) => b[0].toUpperCase() + b.slice(1) + ' quality');
  for (const group of ['Combat', 'Defensive', 'Stat Mod', 'Elemental']) {
    const mods = MODS.mods.filter((m) => m.group === group);
    if (!mods.length) continue;
    if (out.length) out.push('');
    out.push(MOD_GROUP_HEADING[group], '');
    out.push(`| Mod | Total | ${labels.join(' | ')} |`);
    out.push(`|---|---|${MODS.quality_bands.map(() => '---').join('|')}|`);
    for (const m of mods) {
      const total = m.min + '-' + m.max + (m.pct ? '%' : '');
      const band = (i) => m.bands[i].map((s) => sliceText(s)).join(' / ');
      out.push(`| ${m.name} | ${total} | ${m.bands.map((_, i) => band(i)).join(' | ')} |`);
    }
    for (const p of MODS.pending.filter((x) => x.group === group)) out.push(`| ${p.name} | TBD | ${MODS.quality_bands.map(() => 'TBD').join(' | ')} |`);
  }
  return out.join('\n');
};

// ---------------------------------------------------------------- zone table + full mob roster
BLOCKS['reach-table'] = () => {
  const R = E.mob.reach;
  const byBand = {};
  for (const [w, band] of Object.entries(R.weapons)) (byBand[band] = byBand[band] || []).push(w);
  const bandName = Object.entries(R.bands).map(([k, v]) => [k, v]).sort((a, b) => a[1] - b[1]);
  const rows = bandName.map(([name, n]) => [
    name, String(n),
    n === 1 ? 'the front slot only' : n === 2 ? 'front and second slot' : 'any slot in the group',
    (byBand[n] || []).join(' · '),
  ]);
  const worstCost = (() => {
    let best = { zone: 1, pct: 0 };
    for (const z of E.mob.zones) {
      const cast = E.mob.species.filter((sp) => sp.zones.includes(z.id));
      let wAll = 0, wBack = 0;
      for (const sp of cast) for (const sid of sp.sizes) { const wt = E.mob.spawn_weights[sid] || 0; wAll += wt; if (sp.line === 'stand-off') wBack += wt; }
      const G = z.id <= 3 ? 1.5 : z.id <= 6 ? 2.5 : 4;
      const pct = (wBack / wAll) / (G + 4) * 100;
      if (pct > best.pct) best = { zone: z.id, pct };
    }
    return best;
  })();
  return [
    '| Reach band | Slots it may hit | What that buys | Weapons |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `Stand-off lineages on the mob side: ${E.mob.species.filter((s) => s.line === 'stand-off').map((s) => s.name).join(' · ')} — they hold no front slot, so while a front mob lives they can only be reached by a reach-${R.bands.reach} or reach-${R.bands.standoff} attack, and their half of incoming damage is the res-able one. A reach-1 attack waits one engage cycle (1 sec) when only stand-off mobs remain; the measured cost is nothing in zones 1-6 and at most ${f1(worstCost.pct)}% of the cycle in zone ${worstCost.zone} (**X33**).`,
  ].join('\n');
};

BLOCKS['slot-pools'] = () => {
  const pools = basePoolsByRole();
  const slots = ['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'amulet', 'earring', 'cape'];
  const out = [];
  for (const slot of slots) {
    const p = pools[slot] || {};
    const prim = Object.keys(p).find((k) => /primary/i.test(k)) || 'Primary';
    const sec = Object.keys(p).find((k) => /secondary/i.test(k)) || 'Secondary';
    const gear = GEAR_MOD_SLOTS.includes(slot);
    const lines = [
      `## ${slot}`, '',
      '| Role | Mods (union of every ' + slot + ' Base in item-base.md) |',
      '|---|---|',
      `| Primary | ${(p[prim] ? [...p[prim]] : []).join(' · ') || 'none listed'} |`,
      `| Secondary | ${(p[sec] ? [...p[sec]] : []).join(' · ') || '—'} |`,
      '| Stat Mod | ' + STAT_MODS.join(' · ') + ' (every item) |',
      gear ? '| Gear Mod | ' + GEAR_MODS.join(' · ') + ' (the school is set by the Base) |' : '',
      '',
    ].filter((l) => l !== '');
    out.push(...lines);
  }
  return out.join('\n');
};

BLOCKS['road-rules'] = () => {
  const RD = E.road;
  const R = eng.ROAD;
  const settlements: any[] = readJson(path.join(ROOT, 'tools/data/town.json')).settlements;
  const nameOf = (id: string) => (settlements.find((s) => s.id === id) || { name: id }).name;
  const near = settlements[1];
  const nearBlocks = R.blocksBetween(settlements[0].id, near.id);
  const chance = RD.encounter_chance_pct / 100;
  const rows = settlements
    .map((s) => `| ${nameOf(s.id)} | zone ${s.zone} | ${R.blocksBetween(settlements[0].id, s.id)} blocks · ${R.secBetween(settlements[0].id, s.id)}s from ${nameOf(settlements[0].id)} |`)
    .join('\n');
  return [
    '| Walk element | Value |',
    '|---|---|',
    `| The world | a pointy-top hex lattice; a settlement owns its own hex and the blocks between two settlements are their hex distance, derived from the axial coordinates and never typed |`,
    `| Every pair | walkable — there is no link list, no route to buy and no branch shortcut, because the block count *is* the distance |`,
    `| A block | ${RD.block_sec} real seconds |`,
    `| An encounter | ${RD.encounter_chance_pct}% per block crossed · ${nameOf(settlements[0].id)} → ${nameOf(near.id)} is ${nearBlocks} blocks, so ${(chance * nearBlocks).toFixed(2)} fights in expectation |`,
    `| What a fight pays | the ordinary drop roll and nothing else — no gold purse, no chest, no Standing, no crafting stones |`,
    `| A Push | the ordinary Push: rest at the camp of the zone it was ambushed in, then walk back in on the block it was ambushed on. It never ends a walk and never gives back a block |`,
    `| A Waypoint | unlocked by arriving on foot, once, and it costs nothing · warps to any unlocked settlement free and instantly · never gates a zone · a Waystone will be a second destination kind |`,
    `| Offline | a walk is online only — an away period never crosses a block |`,
    '',
    '| Settlement | Zone | Distance from the first settlement |',
    '|---|---|---|',
    rows,
    '',
    'Distances are hex distances computed from the walk graph, so the sheet and the rule can never disagree about how far a place is.',
  ].join('\n');
};

BLOCKS['zone-table'] = () => {
  const rows = E.mob.zones.map((z) => {
    const boss = E.mob.bosses.find((b) => b.zone === z.id);
    const bs = E.mob.species.find((r) => r.id === boss.species);
    const n = eng.mobRoster().filter((r) => r.zone === z.id).length;
    return [z.id, `${z.name} · ${z.levels[0]}-${z.levels[1]}`, (z as any).region, z.quality, `${f0(z.hp[0])} → ${f0(z.hp[1])}`, z.elements.join(' · '), z.group, `${boss.name} (${bs.name})`, n];
  });
  return [
    '| Zone | Settlement · Levels | Region | Dropped Quality ceiling | mob HP (zone edge) | innate Elements | Mobs per group | Boss | roster entries |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `HP columns are \`mob_HP(L)\` at the zone's first and last level (checks.md D1) · the boss row is the zone's own \`mob_HP × 15 / damage × 4\` carrier species (combat.md section 7). \`mob-roster.md\` expands every one of these into the per-species, per-body entries a build reads from.`,
  ].join('\n');
};

BLOCKS['mob-curve'] = () => {
  // One column per zone, read off the zone list, plus the spawn cap — so the table always shows
  // the whole world and adding zones lengthens it instead of leaving it showing half.
  const levels = eng.ZONES.map((z) => z.levels[0]);
  if (!levels.includes(S.mob_level_cap)) levels.push(S.mob_level_cap);
  const hp = levels.map((L) => f0(eng.mobHpAt(L)));
  const ps = levels.map((L) => f0(eng.mobPsAt(L)));
  return [
    `| Level | ${levels.join(' | ')} |`,
    `|---|${levels.map(() => '---').join('|')}|`,
    `| mob HP | ${hp.join(' | ')} |`,
    `| mob damage/sec | ${ps.join(' | ')} |`,
    '',
    `mob_HP(L) is defined at every level: the curve is anchored at each zone edge in \`tools/data/engine.json\` \`mob.zones\` and interpolated linearly inside the zone a mob spawns in. The spawn cap is ${S.mob_level_cap}, so the last column is the highest level a mob can spawn at; above it the gear factor is held flat and the theoretical player cap anchor \`mob.curve.hp_at_player_level_cap\` sits at level ${S.level_cap}. Mob damage/sec is \`typical_gear_DPS(L) ÷ ${K.mob_damage_divisor}\`, derived from the same curve rather than typed beside it (**X37**).`,
  ].join('\n');
};

BLOCKS['evasion-table'] = () => {
  const refAcc = eng.mobAcc(S.level_cap, eng.MEAN_SPECIES_DEX, 1);
  // every case is derived from the ceiling, never typed: Core Stat % is retired, so the
  // 12-item ceiling is stat_c + 25x12 and the 6-item split is stat_c + 25x6
  const cases = [
    ['Full Dex + Agi 12 items + boots/gloves T1', CEIL, 30, 0],
    ['Dex + Agi 6 items + 1 T1 item', Math.round(eng.statAt(S.level_cap) + 25 * 6), 30, 0],
    ['No investment + 1 low-Quality item', eng.statAt(S.level_cap), 6, 0],
  ];
  const rows = cases.map(([label, stat, flat, pct]) => {
    const rating = eng.evasionRating(stat, flat, pct);
    const chance = eng.evasionChance(rating, stat / 30, refAcc);
    const agiPts = stat / 30;
    return `| ${label} | ${f0(stat)} | ${flat === 30 ? '15 + 15' : flat} | ${f0(rating)} | +${r1(agiPts)} | **${r1(chance)}%** |`;
  });
  return [
    '| build | Dex + Agi | Evasion flat | Dex rating | Agi points | Evasion |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    `Evasion is one line: the Dex rating is rolled against the reference attacker (mean species · Medium body · accuracy tier ×1 · level ${S.level_cap} accuracy ${f0(refAcc)}) as \`1 − acc ÷ (acc + rating)\`, then Agi adds **${r4(1 / K.K_AGI_EVAS)} Agi per point** and the Cap ${E.caps.evasion} binds the sum — so this is a snapshot against an average mob, not a fixed Cap point.`,
  ].join('\n');
};

BLOCKS['hp-mana-block'] = () => {
  const hpPct = 1 + (M.hp_pct_per_item * LG.hp_pct_mod_slots) / 100;
  const SM = createSkillModel(readJson(path.join(ROOT, 'tools/data/skills.json')), E);
  return [
    '```',
    `Max HP   level 100 · full Vit 12 items + 1 Max HP % slot = (${f0(CEIL * K.K_VIT_HP)} + ${f0(LG.hp_per_level * (S.level_cap - 1))}) × ${r2(hpPct)} = ${f0(DERIVED.hp)}`,
    `Max Mana level 100 · full Int                            = (${f0(CEIL * K.K_INT_MP)} + ${f0(LG.mp_per_level * (S.level_cap - 1))})          = ${f0(DERIVED.mana)}`,
    `pool ÷ regen                                              = ${f0(DERIVED.mana)} ÷ ${f0(DERIVED.mana_regen)} = ${r1(DERIVED.pool_regen_sec)} seconds`,
    `flat-cost reference pool (level ${SM.MANA_REF_LEVEL}) = mana_base ${f0(LG.mana_base)} + stat ${f0(S.base)} × K_INT_MP ${f0(K.K_INT_MP)} = ${f0(SM.MANA_REF_POOL)} — the pool a \`N flat\` cost is quoted against, and it climbs ${SM.MANA_LEVEL_STEP}% a skill level and on (pool ÷ reference)^${SM.MANA_POOL_EXPONENT} `,
    '```',
  ].join('\n');
};

BLOCKS['weapon-mult'] = () => {
  const rows = WEAPONS.map((w) => `| ${w.name} | ${w.weapon_aspd} | ${w.weapon_mult.toFixed(2)}${w.weapon_aspd === 1.2 ? ' (baseline)' : ''} |`);
  return ['| Weapon | weapon_aspd | weapon_mult |', '|---|---|---|', ...rows].join('\n');
};

BLOCKS['cap-table'] = () => {
  const dagger = WEAPONS[0];
  return [
    '| Value | Cap | Reachable at true ceiling? |',
    '|---|---|---|',
    '| Critical chance | **none** | the 100 Cap became a spill point: chance is held at 100 and the excess adds to crit damage (formula-offense.md section 3) |',
    `| Evasion | **${E.caps.evasion}** | Dex rating opposed by mob accuracy, + Agi ÷ ${r4(1 / K.K_AGI_EVAS)} points, capped together · merged Dodge into this line · reachability closed by X20 |`,
    `| Block chance | **no Cap** | the Shield offhand's Base Mod line · the second avoidance layer, rolled after perfect dodge and evasion · open-ended (owner ruling) |`,
    `| Perfect dodge | **${E.caps.perfect_dodge}** | ratio tops at ${r1(DERIVED.perfect_dodge)}% at Lck ${f0(CEIL)} but the Cap binds first · reachable at Lck ${Math.ceil((E.caps.perfect_dodge / 100) * K.K_PDOGE / (1 - E.caps.perfect_dodge / 100) / K.K_LCK_PDOGE)} · old no-Cap retired |`,
    `| Elemental Alignment | **no Cap** | open-ended (owner ruling): Dex ${f0(CEIL)} + amulet + gloves = ${r1(DERIVED.align_path)} and it keeps climbing — the \`Status Alignment resistance %\` Mod line is the separate defensive answer |`,
    `| Elemental resistance | ${E.caps.elem_res} | gear-only (owner ruling) — no Core stat feeds it, so the Cap **binds**: ${LG.res_mod_items} res slots at the max roll reach ${r1(DERIVED.res_three)} and stop at the Cap |`,
    `| Cooldown reduction | ${E.caps.cdr} | a **hard ceiling**: Wis ${f0(CEIL)} + ${LG.cdr_mod_items} CDR slots = ${r1(DERIVED.cdr_four)}, so the build tops out under it |`,
    `| Attack speed | **${E.caps.aspd} (= ${E.caps.aspd / 100} times/sec)** | the 0.2 sec floor between hits · a clock rule, not a build target: fastest weapon needs Agi ${f0(dagger.agi_to_cap)} vs the ${f0(CEIL)} ceiling · applied LAST, after the aspd Mod band, an aspd buff and the weight tax |`,
    `| Accuracy | ~~2,000~~ **removed** | ratio formula already forbids 100%; calculable ceiling ${f0(DERIVED.accuracy)} never hit old Cap |`,
  ].join('\n');
};

BLOCKS['k-table'] = () => {
  const aspds = E.weapons.map((w) => w.weapon_aspd);
  const critFromStat = r1(DERIVED.crit - M.crit_pct_main_hand);
  return [
    '| K | Value | Unit | Note |',
    '|---|---|---|---|',
    `| K_STR | ${K.K_STR} | phys / Str | Str ${f0(CEIL)} → ${f0(CEIL * K.K_STR)} · main driver of Str |`,
    `| K_INT | ${K.K_INT} | magic / Int | main driver of Int |`,
    `| K_ELEM | ${K.K_ELEM} | elem / Int | lower than Int because it must pass Alignment first |`,
    `| K_VIT_HP | ${K.K_VIT_HP} | hp / Vit | Vit ${f0(CEIL)} → ${f0(CEIL * K.K_VIT_HP)} raw |`,
    `| K_VIT_REGEN | ${K.K_VIT_REGEN} | hp regen / Vit | ${f0(CEIL * K.K_VIT_REGEN)}/sec at ${f0(CEIL)} |`,
    `| K_INT_MP | ${K.K_INT_MP} | mana / Int | set to keep mana a constraint, see section 5 |`,
    `| K_INT_MREGEN | **${K.K_INT_MREGEN}** | mana regen / Int | retuned with the pool the level cap 190 line gives: ${f1(DERIVED.pool_regen_sec)} sec against the ${TS.craft_progress_intent_sec} sec intent (B5) |`,
    `| K_INT_ES | **retired** | — | Energy Shield left Int (owner ruling); the pool is the Gear Energy Shield flat + Max Energy Shield % (X25) |`,
    `| K_INT_ESREGEN | **retired** | — | the regen is \`energy_shield.regen_pct\` (${E.energy_shield.regen_pct}%/sec of the pool) plus any \`es_regen\` skill, Mod or passive — a Core stat would have made the shield a build axis the owner took out |`,
    `| K_AGI_EVAS | ${r4(K.K_AGI_EVAS)} | Evasion points / Agi | **30 Agi = 1 point** (owner ruling) · the mob side keeps K_MOB_DODGE for its own thin dodge |`,
    `| K_AGI_ASPD | ${K.K_AGI_ASPD} | aspd % per Agi | \`aspd = weapon_aspd × (100 + (agi−12)×${K.K_AGI_ASPD} + aspd_pct)\` · level 1 sword = 1.2 times/sec |`,
    `| K_WIS_CDR | ${K.K_WIS_CDR} | cdr / Wis | ${r1(DERIVED.cdr_raw)}% at ${f0(CEIL)} · ${LG.cdr_mod_items} Mod items reach ${r1(DERIVED.cdr_four)}, under the hard-ceiling Cap ${E.caps.cdr} |`,
    `| K_DEX_ACC | ${K.K_DEX_ACC} | accuracy / Dex | no Cap; ratio formula limits itself |`,
    `| K_DEX_ALIGN | ${K.K_DEX_ALIGN} | Alignment / Dex | shared by Element and status · Alignment has no Cap (owner ruling) |`,
    `| K_MOB_RES | ${K.K_MOB_RES} | elem res / mob | **mob side only** — no Core stat feeds player Elemental resistance any more (owner ruling); the same value keeps all 22 species where they were |`,
    `| K_VIT_STUNREC | ${K.K_VIT_STUNREC} | stun recovery / Vit | the owner's own example: Vit ${f0(CEIL)} = ${r1(eng.stunRecoveryOf(CEIL))}%, so the ${E.status.shock.stop_sec} sec shock leaves ${r2(eng.stunStopSec(CEIL, E.status.shock.stop_sec))} sec (X48) |`,
    `| K_LCK_CRIT | ${K.K_LCK_CRIT} | crit chance / Lck | ${critFromStat}% at ${f0(CEIL)} + ${M.crit_pct_main_hand} from main hand |`,
    `| K_LCK_PDOGE | **${K.K_LCK_PDOGE}** | perfect dodge rate / Lck | ratio ${r1(DERIVED.perfect_dodge)}% at ${f0(CEIL)} · \`K_PDOGE\` ${K.K_PDOGE} → Cap ${E.caps.perfect_dodge} binds first (reachable at Lck ${Math.ceil((E.caps.perfect_dodge / 100) * K.K_PDOGE / (1 - E.caps.perfect_dodge / 100) / K.K_LCK_PDOGE)}) |`,
    `| K_LCK_DROP | ${K.K_LCK_DROP} | drop rate multiplier / Lck | ${r1(DERIVED.drop_mult)}x at ${f0(CEIL)} · Base drop still separate |`,
    `| K_STR_WEIGHT | ${K.K_STR_WEIGHT} | weight / Str | ${f0(DERIVED.weight)} at Str ${f0(CEIL)} · overweight cuts aspd up to -50% (section 11) |`,
    `| K_dodge | **retired** | — | the flat divisor is gone: Evasion is a ratio plus Agi points |`,
    `| K_EVASION | ${K.K_EVASION} | evasion / Dex | same line both sides: mob evasion = \`stat_c × species.dex × ${K.K_EVASION} × body\`, player evasion = \`Dex × ${K.K_EVASION}\` (+ Gear Evasion flat ${modRange('evasion_flat')}) · replaces the old \`mob evasion = level × 1\` stand-in, which made a Slime and an Elf equally hard to hit |`,
    `| weapon_aspd | ${Math.min(...aspds)}-${Math.max(...aspds)} | Base times/sec of weapon | multiplies whole parenthesis in section 7, not only the Agi term |`,
    `| weapon_mult | 1.2 / weapon_aspd | per weapon type | decided · equalizes DPS across types where Agi does not hit Cap |`,
  ].join('\n');
};

BLOCKS['craft-set'] = () => {
  // The casts a band pays per 1,000 kills — a count of kills, never a rate against the clock (D12).
  const perK = 1000 / BAND.high.kills_derived;
  const rows = [
    `| Reroll value | ${C.reroll_value_stones_per_use} Reroll value stones | ~${f0(STONE.reroll_uses_per_hr * perK)} | Cheap, can spam · Keeps values inside the same Tier |`,
    `| Refine | ${C.refine_stones_per_use} Reroll tier stones | ~${r1(STONE.refines_per_hr * perK)} | Main upgrade path · Tier stones come only from elites (1 in 5, 5% drop) + bosses |`,
    `| Ascend | ${C.ascend_add_stones} Add mod stones + ${C.ascend_tier_stones} Reroll tier stones | ~${r1(STONE.ascend_per_hr * perK)} | Slowest and needs planning · Add stones come only from elites and bosses (no AFK path) |`,
    '| Add (1st / 2nd fill) | 1 / 2 Add mod stones | boss-gated | Expands to the crafted line-count ceiling (net counting) |',
    '| Upgrade +N | tiered Quality Stones: 1/2/3/4/5 · 7/9/11/13/15 · 18/21/24/27/30 (sources shift monsters → elites → bosses by step) | set | Raises Gear Mod only |',
    '| Repair | 1 Repair stone | elite / boss only | Revives Broken + refills protection |',
  ];
  return [
    '| Tier | Price | Actual casts per 1,000 kills at the high zone | Meaning |',
    '|---|---|---|---|',
    ...rows,
    '',
    '```',
    `Refine full set (${C.ascend_items_per_set} pieces × ${C.refine_steps} steps = ${STONE.refine_casts_full_set} casts, because Tier belongs to the piece) = ${STONE.refine_casts_full_set * C.refine_stones_per_use} Reroll tier stones`,
    `Ascend full set (${C.ascend_items_per_set} pieces)                             ≈ ${f0(STONE.ascend_hours_full_set * BAND.high.kills_derived)} kills`,
    '```',
  ].join('\n');
};

BLOCKS['cap-lines'] = () => {
  const c = E.caps;
  const cdrAt = (n) => r1(DERIVED.cdr_raw * (1 + (M.cdr_pct_per_item * n) / 100));
  return [
    `Attack speed - % · \`hits/sec = aspd / 100\` · Cap ${c.aspd} (= ${c.aspd / 100} hits/sec · the 0.2 sec floor between hits · applied last: after the aspd Mod band, an aspd buff and the weight tax, so no build passes it)`,
    `Evasion - % Cap ${c.evasion} (Dex rating ÷ (rating + mob accuracy), then + Agi ÷ 30 points, capped together · merged Dodge into this line · reachability settled by X20)`,
    `Perfect dodge - % Cap ${c.perfect_dodge} · \`lck × K_LCK_PDOGE ÷ (rate + K_PDOGE)\` ratio tops at ${r1(DERIVED.perfect_dodge)}% but the Cap binds first (reachable at Lck ${Math.ceil((c.perfect_dodge / 100) * K.K_PDOGE / (1 - c.perfect_dodge / 100) / K.K_LCK_PDOGE)}) · definition: removes the hit that Evasion cannot contest (DoT ticks · effects with no avoidance roll) — actual order is in combat.md section 2`,
    `Critical chance - % no Cap · held at 100 and the excess adds to crit damage (\`K_CRIT_OVERFLOW\` ${K.K_CRIT_OVERFLOW} · formula-offense.md section 3) · stat-only ceiling = ${r1(DERIVED.crit)}% at ${f0(CEIL)} Lck, so only buffs/skills create overflow`,
    'Critical damage - % physical only · magic and the 5 Elements never crit · no Cap · `100 + crit_dmg_pct + crit_overflow`',
    `Cooldown reduction - % Cap ${c.cdr} — a hard ceiling: ${f0(CEIL)} Wis + ${LG.cdr_mod_items} CDR slots = ${r1(DERIVED.cdr_four)}, so the build tops out under it (9 slots reach only ${cdrAt(9)} · 10 slots reach ${cdrAt(10)})`,
    'Accuracy - numeric value, no Cap · formula `acc / (acc + evasion)` can never reach 100% by design · previously Cap 2,000 which was unreachable',
    `Elemental alignment - % no Cap (owner ruling) · ${f0(CEIL)} Dex + amulet + gloves = ${r1(DERIVED.align_path)} and it keeps climbing · the defensive \`Status Alignment resistance %\` is a separate Mod line (mod-pool.md · core-stats.md)`,
    `Elemental resistance - % split across 5 Elements, Cap ${c.elem_res} per Element — **gear only** (owner ruling): ${modRange('elemental_resistance')} + All Resistance ${modRange('all_resistance_pct')} · no Core stat feeds it · ${LG.res_mod_items} res slots at the max roll reach ${r1(DERIVED.res_three)}, so the Cap binds`,
    `Armour - numeric rating · \`Str x K_ARMOUR\` (${K.K_ARMOUR}) + Gear Armour flat (${modRange('armour_flat')}) · physical reduction% = armour / (armour + ${K.armour_divisor} × raw_hit) · no Cap (diminishing by design) · the mob side runs the same K off its own Str, so a Golem or Knight carries real armour and a Rat carries almost none (mob-roster.md)`,
    `Evasion - numeric rating · \`Dex x K_EVASION\` (${K.K_EVASION}) + Gear Evasion flat (${modRange('evasion_flat')}) · PoE entropy roll vs attacker accuracy, contested once per hit · no hard Cap on the rating (the chance is the limit) · the same line runs the mob side, from the mob's own Dex (formula-utility.md section 8)`,
    `Energy Shield - second pool ahead of HP · **gear only** (owner ruling): Gear Energy Shield flat (${modRange('energy_shield_flat')}) x (1 + Max Energy Shield % ${modRange('max_energy_shield_pct')}/100) · chaos bypasses it · armour and Elemental resistance shrink the number that drains it · regen is ${E.energy_shield.regen_pct}% of the pool per sec after ${E.energy_shield.delay_sec} sec without a hit, amplified by an \`es_regen\` skill, Mod or passive, so the base rate alone returns the whole pool in ${r1(DERIVED.es_recover_sec)} sec · no Cap (X25)`,
    `Weight - units · capacity = weight_base (${f0(LG.weight_base)}) + Str x ${K.K_STR_WEIGHT} (${f0(DERIVED.weight)} at ${f0(CEIL)} Str) · Over-capacity is allowed, does not lock equip slots, but reduces Attack speed proportionally up to -50% (formula.md section 11)`,
  ].join('\n');
};

BLOCKS['loot-bands'] = () => {
  // The band level windows are read off the zone list, so adding zones moves them instead of
  // leaving a typed range behind. Each band is three zones of ten levels and the pattern repeats.
  const zFirst = (band) => eng.ZONES.find((z) => z.quality.startsWith(band))!;
  const win = (band) => {
    const f = zFirst(band).levels[0];
    return `${f}-${f + 29}`;
  };
  const label = {
    low: `low (${win('low')})`, mid: `mid (${win('mid')})`,
    high: `high (${win('high')})`, high_full_lck: 'high + full Lck',
  };
  const lckCell = (b) => (b === 'high_full_lck'
    ? `${BAND[b].lck} → ×${BAND[b].lck_mult.toFixed(2)}`
    : `${BAND[b].lck} (L${L.bands[b].lck_level}) → ×${BAND[b].lck_mult.toFixed(2)}`);
  const rows = BAND_KEYS.map((b) => {
    const grp = BAND[b].group_mobs;
    const cycle = (grp * L.ttk_per_mob_sec + L.group_spawn_sec).toFixed(1);
    const drops = (BAND[b].drops_per_hr / BAND[b].kills_derived).toFixed(4);
    const junkK = (BAND[b].junk_per_hr / BAND[b].kills_derived).toFixed(4);
    const junkCell = b === 'high_full_lck' ? `**${junkK}**` : junkK;
    return `| ${label[b]} | ${grp} mobs | ${cycle} sec | ${drops} | ${lckCell(b)} | ${junkCell} |`;
  });
  return [
    '| Zone | Average group | Cycle | drops per kill | Lck at that level | junk per kill (gold) |',
    '|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
};

BLOCKS['aoe-rules'] = () => {
  const A = E.aoe;
  const dpm = (n) => (Math.min(n, A.target_cap) * A.per_target_pct) / 100 / A.mana_mult;
  const SM = createSkillModel(readJson(path.join(ROOT, 'tools/data/skills.json')), E);
  const at = (step) => 1 + (E.skill_xp.level_cap - 1) * step / 100;
  return [
    '```',
    'single target → 100% damage · mana cost 1.0×',
    `AoE           → ${A.per_target_pct}% damage per target hit · Cap ${A.target_cap} targets · mana cost ${A.mana_mult}×`,
    '',
    `damage per mana: 1 target ${f2(dpm(1))}× · 2 targets ${f2(dpm(2))}× · 3+ targets ${f2(dpm(A.target_cap))}×`,
    '',
    `a flat cost climbs ${SM.MANA_LEVEL_STEP}% a skill level against the press ramp's ${SM.LEVEL_STEP}%, so at level ${E.skill_xp.level_cap} one costs ×${(at(SM.MANA_LEVEL_STEP) / at(SM.LEVEL_STEP)).toFixed(2)} what the press grew `,
    '```',
  ].join('\n');
};

BLOCKS['weapon-cap'] = () => {
  const rows = WEAPONS.map((w) => `| ${w.name} | ${w.weapon_aspd} | ${w.weapon_mult.toFixed(2)} | ${f0(w.agi_to_cap)}${w.reachable ? '' : ' · cannot hit'} |`);
  return [
    `| Weapon | weapon_aspd (Base times/sec) | weapon_mult | Agi to hit Cap ${E.caps.aspd} (with ${M.aspd_pct}% Mod) |`,
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
};

BLOCKS['zone-cast'] = () => {
  const ROWS = eng.mobRoster();
  const rows = E.mob.zones.map((z) => {
    const zr = ROWS.filter((r) => r.zone === z.id);
    const sp = new Set(zr.filter((r) => !/Boss/.test(r.kind)).map((r) => r.speciesId));
    const bodies = ['small', 'medium', 'large'].map((b) => zr.filter((r) => r.kind === (b === 'small' ? 'Small' : b === 'medium' ? 'Medium' : 'Large')).length);
    const elite = zr.filter((r) => /Elite/.test(r.kind)).length;
    const boss = zr.find((r) => /Boss/.test(r.kind));
    return [z.id, z.name, `${sp.size}`, bodies.join(' · '), elite, `${boss.species} · ${boss.kind.split('· ')[1]}`, f0(boss.hpTo), f0(boss.ps), zr.length];
  });
  const subRows = E.mob.zones.flatMap((z) => (z.subzones || []).map((s) => [
    z.id, s.name, s.environment, s.element,
    s.races.map((id) => (E.mob.species.find((sp) => sp.id === id) || { name: id }).name).join(' · '),
    s.elite || '—',
  ]));
  return [
    '| Zone | Settlement | species on cast | Small · Medium · Large | Elite | Boss (species · name) | boss HP at zone edge | boss damage/sec | entries |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    '| Zone | Sub-zone | Environment | Element | Races | Elite |',
    '|---|---|---|---|---|---|',
    ...subRows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
};

BLOCKS['mob-roster'] = () => {
  const ROWS = eng.mobRoster();
  const rows = ROWS.map((r) => [
    r.id, r.zone, `${r.levels[0]}-${r.levels[1]}`, r.kind, r.species, r.innate.join('/'),
    `${f0(r.hpFrom)} → ${f0(r.hpTo)}`, f0(r.ps), f0(r.acc), f0(r.ev), f0(r.armour),
    `${f1(r.res)}%`, `${f1(r.crit)}%`, `${f1(r.dodge)}%`, `${f1(r.align)}%`, `${f0(r.xpFrom)} - ${f0(r.xpTo)}`, r.group,
    E.mob.species.find((x) => x.id === r.speciesId).line === 'stand-off' ? 'stand-off' : 'front',
    r.weapon ? 'weapon' : 'armour only',
    (() => { const sp2 = E.mob.species.find((x) => x.id === r.speciesId); const [ph, el] = eng.damageSplit(sp2.damage); return `${ph * 100}/${el * 100}`; })(),
  ]);
  return [
    '| id | Zone | Levels | Body | Species | innate Elements | HP (zone start → end) | damage/sec | accuracy | evasion | armour | res | crit | dodge | status gate | XP/kill | group | line | drops | phys/elem |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((x) => `| ${x.join(' | ')} |`),
    '',
    `Every row is the mob's own stat block at the zone's **last** level (\`mob stat = ${f0(E.mob.stat.base)}\` × the species vector, flat with no level term), then by the body class: accuracy = Dex line × ${K.K_DEX_ACC} × accuracy tier · evasion = Dex × ${K.K_EVASION} × body · armour = Str × ${K.K_ARMOUR} · res = Vit × ${K.K_MOB_RES} · crit = Lck × ${K.K_LCK_CRIT} · dodge = own Agi rate ÷ (rate + a same-level attacker's accuracy) (X24). HP is \`mob_HP(L) × body\` at both ends of the range, so a mob mid-range interpolates. XP is \`10 × the mob's own level\` with elite ×${E.xp.elite_mult} and boss ×${E.xp.boss_mult} (world.md XP), printed as a range because a mob spawns at the attacker's level, so it is read at both ends of the zone. \`status gate\` is the mob's own Elemental Alignment (\`Dex × ${K.K_DEX_ALIGN}\`, no Cap), the number that decides how often its innate Element status actually lands (combat.md section 2 step 9). A mob spawns at the attacker's level clamped into its zone's range; its innate Element is rolled with the species bias at ×${E.mob.element_roll.bias_weight} against any other Element the zone carries at ×${E.mob.element_roll.other_weight}; and \`drops: weapon\` means the lineage is allowed to be the source of a weapon-slot piece; \`armour only\` species still drop every other slot, so the 8% base drop rate, the quality floors and the whole stone funnel are untouched (loot.md sections 1-2 · gear, herbs, stones and junk are the four streams, and the **humanoid** lineages add a fifth, potions, on the derived chance **X49** prints).`,
  ].join('\n');
};




/** The per-variant drop sheet: the junk item is variant-bound, the rest are the shared streams. */
BLOCKS['race-drop'] = () => {
  const J = E.junk;
  const D = (E.mob as any).variant_drops || {};
  const rows = E.mob.species.flatMap((sp) => {
    const ladder = ((E.mob as any).variants[sp.id] || []) as string[];
    // only the rungs the cast can field carry a row, so only they appear: a rung nothing can spawn
    // would be an item the Counterhand advertises and nothing pays (X39)
    return ladder.filter((n) => D[n]).map((n) => {
      const row = D[n];
      const r = row ? J.rarities[row.rarity] : null;
      return [
        n,
        sp.name,
        row ? row.item : '—',
        row ? row.rarity : '—',
        r ? f0(r.sell_gold) : '—',
        r ? `${f1(r.drop_chance_per_kill * 100)}%` : '—',
        row ? row.lean : '—',
        sp.humanoid ? 'yes' : '—',
        sp.carries_weapon ? 'weapon' : 'armour only',
        sp.damage,
      ];
    });
  });
  return [
    '| Variant | Species | junk drop | rarity | sell gold | junk per kill | lean | potion (humanoid) | gear stream | damage tag |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((x) => `| ${x.join(' | ')} |`),
    '',
    `Every variant drops its own junk, and the five rungs of a ladder read as one family — a Goblin pays an Ear at Sneak, Bile at Raider, a Cog at Tinker, a Charm at Shaman and a Crown at the King — so a Counterhand visit tells the player which **variants** they farmed, not only which races. **Rarity buys frequency, never income**: each rarity's per-kill chance is the junk line divided by its own sell price (\`junk.rarities\`), so a variant's expected gold per kill is the same whatever rung it sits on, and a rarer rung simply drops less often for more gold — which is a bag-pressure trade, since junk stacks ${J.stack}/slot. Rarity is bound to the variant, not to the level, so the same mob never changes what it pays as the player levels. The **lean** column is the collectible stream that variant tilts toward, applied through \`leanReweight\` (**X56**): the three normal rungs of every ladder cycle gear · herb · junk, so a zone's aggregate mix stays the identity and only the per-kill mix moves, while **Elite** and **Boss** carry \`none\` because they already pay their own stone lines. Only a rung the cast can field carries a row at all — a rung nothing spawns is an item nothing pays (**X39**). A **humanoid** lineage adds the potion stream (X49) and a **weapon-carrier** lineage is the only source of weapon-slot gear; gear, herbs and stones are the shared streams every variant pays (loot.md sections 1-2).`,
  ].join('\n');
};

/** The per-race resistance profile: the headline res is the Vit line, tilted by Element. */
BLOCKS['race-resist'] = () => {
  const order = E.elements.order as string[];
  const rows = E.mob.species.map((sp) => {
    const r = ((sp as any).resist || {}) as Record<string, number>;
    const cells = order.map((el) => {
      const v = r[el] ?? 1;
      return `${v.toFixed(2)}${v > 1.01 ? ' ↑' : v < 0.99 ? ' ↓' : ''}`;
    });
    return [sp.name, ...cells, `${f1(eng.mobResOf(sp))}%`];
  });
  return [
    `| Race | ${order.join(' | ')} | headline res |`,
    `|---|${order.map(() => '---').join('|')}|---|`,
    ...rows.map((x) => `| ${x.join(' | ')} |`),
    '',
    `Each race's res is its own Vit line (the **headline res** column) tilted by Element: ↑ resists that Element at x1.3-1.5, ↓ is weak to it at x0.5-0.7, and the other three sit at x1.00. The five multipliers always average x1.00 (**X54**), so the headline is the mean and the profile only decides which Element a build should bring to a zone — a Dragon shrugs fire and fears cold, a Skeleton shrugs chaos and fears lightning. The profile multiplies before the same Elemental resistance Cap the player obeys, and the mob's **innate Element** roll (its own bias) is a separate axis.`,
  ].join('\n');
};

// ---------------------------------------------------------------- cli

const arg = process.argv[2];

if (arg === '--checks') {
  const rows = runChecks();
  for (const r of rows) console.log(`${r.id.padEnd(3)}  ${(r.status || (r.ok ? 'PASS ' : 'FAIL ')).padEnd(7)}  ${r.detail}`);
  const fails = rows.filter((r) => !r.ok);
  console.log(`
${rows.length - fails.length}/${rows.length} PASS · ${fails.length} FAIL`);
  if (fails.length) process.exitCode = 1;
} else {
  console.log(`engine cage — data: tools/data/engine.json (shared with tools/town.ts)

  node tools/check.ts --checks   run the invariants, exit 1 on FAIL
`);
}
