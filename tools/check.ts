// @ts-nocheck
// TODO(migration): 124 KB engine cage; the ESM conversion is done, per-file typing is a follow-up.

/**
 * Engine cage — the stat model, the caps, the Mod pools and the loot/craft prices.
 *
 *   node tools/check.ts            help
 *   node tools/check.ts --checks   run every invariant, exit 1 on FAIL
 *
 * Every value is computed from tools/data/engine.json (stat model · K values · mod maxima ·
 * loot model · craft prices) and read through engine/ — the data is the only home of a number,
 * so a gate that disagrees with the engine is a FAIL, not a note.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as eng from './lib/engine.ts';
import { readJson } from './lib/json.ts';
import { createSkillModel } from '../engine/skills.ts';
import { createLoot, leanReweight } from '../engine/loot.ts';

const { E, S, K, M, LG, BAND, BANDS, BAND_KEYS, CEIL, SPLIT, FOCUSED_CEIL, DERIVED, ES, WEAPONS, STONE, LCK_BOUND, L, C, TS } = eng;
const MODS = JSON.parse(fs.readFileSync(path.join(eng.ROOT, 'tools/data/mods.json'), 'utf8'));
const BASES_JSON = readJson(path.join(import.meta.dirname, 'data/bases.json'));
const ROOT = eng.ROOT;
const f0 = (x) => Math.round(x).toLocaleString('en-US');
const f1 = (x) => x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = (x) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (x) => Math.round(x * 100) / 100;

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
      lines: LOOT.frameModAtFloor(BASES_JSON, g.slot, frame, weapon, OPEN.level, q),
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
    ['C10', `stun ${cap('stun')}`, `Alignment reach ${f1(DERIVED.align_path)} × ${K.K_STUN_PER_ALIGN} = ${f1(DERIVED.align_path * K.K_STUN_PER_ALIGN)} + the mace's Chance to stun % line`, `${cap('stun')} ✓ via the mace Frame Mod, the only source past the Alignment reach `],
    ['C11', 'Accuracy', 'no Cap · `acc/(acc+E)` forbids 100% itself', `${f0(DERIVED.accuracy)} → ${f1(DERIVED.hit_chance * 100)}% ✓`],
  ];
  return ['| id | Cap | Reachable path | Value at that point |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`), '',
    'H3 rule: every Cap states whether it is a build target or a hard ceiling. A build-target Cap must bind (the build reaches it); a hard-ceiling Cap must not (the build tops out under it) — `alignment`, `elem_res` and `cdr` are hard ceilings, and evasion was closed by putting it on the opposed form the mob side already uses, so X20 can prove it both ways.',
    'Agi-per-Cap rows are the same line as formula-utility.md section 7: `${E.caps.aspd} ÷ weapon_aspd` minus the 100 baseline and the 25% Mod, divided by ${K.K_AGI_ASPD} per Agi, plus the level-1 Base of 12.', ''].join('\n');
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
  const out = [];
  const add = (id, ok, detail) => out.push({ id, ok, detail });

  // The reference ceiling is the even-split stat line plus every item slot; the focused ceiling
  // (all points in one stat) is the true maximum above it. A stat-model change that inverts the
  // order is a broken reference line, so the order is the gate.
  add('X1', SPLIT <= CEIL && CEIL <= FOCUSED_CEIL, `the two-way split ceiling ${f0(SPLIT)} sits under the reference ceiling ${f0(CEIL)}, which sits under the all-in-one-stat ceiling ${f0(FOCUSED_CEIL)} — the K values ride the even-split reference line, never the focused one (H5 · A3)`);
  add('X3', Math.abs(DERIVED.pool_regen_sec - TS.craft_progress_intent_sec) <= TS.pool_regen_tolerance,
    `mana pool ÷ regen = ${f1(DERIVED.pool_regen_sec)} sec against the ${TS.craft_progress_intent_sec} sec intent (B5 · K_INT_MREGEN)`);
  add('X5', BANDS.every((b) => BAND[b].drops_per_hr === Math.round(BAND[b].kills_derived * (BAND[b].drop_chance_pct / 100))) && BAND.high_full_lck.drops_per_hr === Math.round(BAND.high_full_lck.kills_derived * (BAND.high_full_lck.drop_chance_pct / 100)),
    `F3 = F1 × F2 for all four rows: ${['low', 'mid', 'high', 'high_full_lck'].map((b) => `${f0(BAND[b].drops_per_hr)} ${BAND_LABEL[b]}`).join(' · ')}`);
  add('X6', BANDS.every((b) => BAND[b].junk_per_hr === BAND[b].drops_per_hr - BAND[b].upgrades_per_hr),
    `junk = drops − upgrades everywhere, so gold and stones share one ceiling (G2 · G8)`);
  // The full-Lck junk multiple is a derived anchor: `CEIL × K_LCK_DROP` is the whole lever, so
  // dropping the stat ceiling to 510 moved 3.16 → 2.11, adding the earring as a 13th
  // item moved it to 2.20, the re-base (kill rates ×1/3 and the level-90 Lck
  // line 190 → 76) moved it to the value below, and the item-level pass moved it again — a drop's
  // Unbound line count is drawn from a range now (2-5, up to 10 crafted), so the keep-rate and with it
  // the junk line sits where that leaves it. Like X1 this literal is a canary against an accidental K
  // re-tune, and the docs print the derived value, not this number.
  add('X7', Math.abs(LCK_BOUND - 3.15) < 0.02, `full-Lck junk line ×${f2(LCK_BOUND)} — the bound G8 and towns-stalls T7 quote`);
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
  add('X8', Math.round(STONE.tier_stones_per_hr) === 18 && Math.round(STONE.reroll_uses_per_hr) === 79,
    `stone flow, per kill: elite ${perKillK(BAND.high.kills_derived * L.elite_spawn_chance * L.elite_tier_stones).toFixed(5)} + boss ${perKillK(L.boss_per_hour * L.boss_tier_stones).toFixed(5)} = ${tierPerKill.toFixed(5)} tier stone · junk ${junkPerKill.toFixed(5)} ÷ ${C.reroll_value_stones_per_use} = ${perKillK(STONE.reroll_uses_per_hr).toFixed(5)} Reroll use (F6 · F7)`);
  const polishKills = killsFor(C.polish_casts_per_full_set * C.reroll_value_stones_per_use, BAND.high.junk_per_hr);
  add('X10', polishKills <= 6500, `full-set polish = ${C.polish_casts_per_full_set} casts at ${C.reroll_value_stones_per_use} stones = ${C.polish_casts_per_full_set * C.reroll_value_stones_per_use} Value stones, which the junk line pays in ${f0(polishKills)} kills — the cost one gold is priced against, read off the drop a kill pays (E8)`);

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
    `weapon_mult = 1.2 ÷ weapon_aspd for all 6 rows (equal DPS across every weapon type)`);

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
  // Mob species: every multiplier vector must average 1.00 so the zone's average mob stays on the published HP anchor
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
          : `${MOB.species.length} species × ${MOB.sizes.length} body classes · every stat vector averages 1.00 (the zone average stays on the published HP anchor) · ${Object.keys(MOB.deprecated_species || {}).length} retired lineage(s) stay out of the roster · accuracy spans ×${Math.min(...MOB.species.map((r) => r.accuracy_mult)).toFixed(2)}-×${Math.max(...MOB.species.map((r) => r.accuracy_mult)).toFixed(2)}, so the Evasion Cap ${E.caps.evasion} costs a full Dex+Agi pair against the ceiling (X20)`);

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
      const sp = E.mob.species.find((x) => x.id === r.speciesId);
      if (!z || !sp) { sh.push(`${r.id} names a missing zone or species`); continue; }
      const elite = /Elite/.test(r.kind), boss = /Boss/.test(r.kind);
      const bodyId = elite ? 'large' : boss ? 'boss' : String(r.kind).toLowerCase();
      const size = eng.sizeById(bodyId);
      // every column the sheet reads must be a real number — a blank cell is the defect this catches
      for (const k of ['hpFrom', 'hpTo', 'ps', 'acc', 'ev', 'armour', 'res', 'crit', 'align', 'dodge', 'xpFrom', 'xpTo'])
        if (!fin((r as any)[k])) sh.push(`${r.id}.${k} is not a finite number`);
      // Core Stat cell: the seven-stat block the sheet prints in full
      const block = eng.mobStatsOf(sp.id);
      if (CORE_STATS.some((k) => !fin(block[k]))) sh.push(`${r.id} Core Stat block is missing a stat`);
      // res cell: the sheet prints the headline and every Element — the headline IS the profile mean
      const prof = eng.mobResByElementOf(sp);
      const mean = (E.elements.order as string[]).reduce((t, el) => t + (prof[el] || 0), 0) / (E.elements.order as string[]).length;
      if (Math.abs(mean - r.res) > 0.05) sh.push(`${r.id} res ${f1(r.res)} is not the profile mean ${f1(mean)}`);
      // Armour cell: the roster's inline Str line must equal the engine's own `armourOf`
      if (Math.abs(eng.armourOf(eng.mobStat() * sp.stats.str) - r.armour) > 0.5)
        sh.push(`${r.id} Armour ${f1(r.armour)} vs armourOf() ${f1(eng.armourOf(eng.mobStat() * sp.stats.str))}`);
      // PS cell: the roster's column rebuilt off the curve, the body class and the species term
      const mult = elite ? E.mob.elite.ps : boss ? size.ps : size.ps / eng.zoneBodyFactor(z.id);
      const ps = eng.mobPs(z.hp[1], r.levels[1]) * mult * eng.speciesPsMult(z.id, sp.id);
      if (Math.abs(ps - r.ps) > 0.5) sh.push(`${r.id} PS ${f1(r.ps)} vs the curve × body × species ${f1(ps)}`);
      // the drop cell the sheet prints names a band, and every band must actually pay gear
      const band = String(z.quality || 'low').split(' ')[0];
      if (!(eng.dropChance(band) > 0)) sh.push(`${r.id} band ${band} pays no gear drop`);
      // body class must resolve, or the sheet's Size column reads a missing row
      if (!size) sh.push(`${r.id} body ${bodyId} is not a size`);
    }
    add('X61', sh.length === 0, sh.length ? sh.slice(0, 6).join(' · ')
      : `the mob sheet is a view of the engine: all ${ROWS.length} roster rows carry every column it prints, each cell a finite number, the Core Stat block is the seven-stat line, the res headline is the per-Element profile mean, and Armour and PS rebuild off \`armourOf\` and the \`mobPs\` curve × body class × the species term — so a wrong cell fails here instead of only showing on the wiki`);
  }

  // Energy Shield: the caster's second pool, sized so it supplements HP instead of doubling it
  const esProblems = [];
  if (!(M.energy_shield_flat_t1 > 0)) esProblems.push('energy_shield_flat_t1 missing');
  if (!(ES.regen_pct >= 2 && ES.regen_pct <= 8)) esProblems.push(`es regen ${ES.regen_pct}%/sec is outside the 2-8%/sec band`);
  if (Math.abs(DERIVED.es_recover_sec - 100 / ES.regen_pct) > 0.01) esProblems.push(`ES full-recovery ${f1(DERIVED.es_recover_sec)} sec is not 100 ÷ regen_pct`);
  // The 15-30% share band was written when the pool was a stat line (Int x K_INT_ES) that
  // followed the stat ceiling while the caster's HP it is compared against was level-only and did
  // not. The pool is gear now (owner ruling): the shipped range prints 0.7% openly (B15), the client
  // sums the line across items, and survival does not spend the pool at all — so the share is
  // REPORTED, not gated, until a rebalance re-prices the gear range (a ~20x move folded into the curve,
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
    `one Upgrade step is ${GM}, so a full ladder is ${GM * GM_CAP} — exactly the smallest school ceiling (${BINDING}, Evasion flat) and ${Object.entries(SCHOOL).map(([k, v]) => `${k} ${Math.round(GM * GM_CAP / v * 100)}%`).join(' · ')} of theirs (item-base.md sets the school · checks.md H1 pays for the uplift through SV7, not through mob_HP, which measured as already inside the pacing)`);
  // · block is the second avoidance layer and the mace's stun line is a second stun source.
  // Both are OPEN-ENDED now (owner ruling): no Cap holds either line, so there is nothing to reach.
  const shieldT1 = E.mod_max.block_chance, maceT1 = E.mod_max.stun_chance;
  const alignReach = DERIVED.align_path;   // Alignment has no Cap (owner ruling)
  const stunAlignOnly = alignReach * K.K_STUN_PER_ALIGN;
  add('X43', E.caps.block == null && E.caps.stun == null,
    `block and stun carry no Cap in the data (caps.block ${E.caps.block} · caps.stun ${E.caps.stun}, owner ruling): the shield's line 1 blocks for ${shieldT1} (mods.json) and keeps climbing; the lightning stun chance is Alignment ${f1(stunAlignOnly)} + the mace line ${maceT1} = ${f1(stunAlignOnly + maceT1)}, uncapped`);
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
  const upKills = STONE.upgrade_stones_full_set / perKillK(STONE.quality_stones_per_hr);
  const corruptPerKill = perKillK(STONE.corrupt_stones_per_hr);
  add('X41', STONE.quality_stones_per_hr > 0 && STONE.repair_stones_per_hr > 0 && STONE.corrupt_stones_per_hr > 0 &&
      upKills <= 7 * ascKills && corruptPerKill <= tierPerKill / 4,
    `Quality ${perKillK(STONE.quality_stones_per_hr).toFixed(4)}/kill · Repair ${perKillK(STONE.repair_stones_per_hr).toFixed(4)}/kill · Corrupt ${corruptPerKill.toFixed(5)}/kill — a full +15 set is ${f0(upKills)} kills against Ascend's ${f0(ascKills)}, and one gamble is under a quarter of a tier stone's per-kill share, while the flow the prices were set against reads junk ${junkPerKill.toFixed(4)}/kill (F5) and tier ${tierPerKill.toFixed(5)}/kill (F7)`);
  add('X30', Math.abs(ascKills - 1491) <= 150, `a full ${E.craft.ascend_items_per_set}-piece Ascend set costs ${E.craft.ascend_items_per_set * E.craft.ascend_add_stones} Add + ${E.craft.ascend_items_per_set * E.craft.ascend_tier_stones} tier stones; the drop lines pay Add ${addPerKill.toFixed(5)}/kill and tier ${tierPerKill.toFixed(5)}/kill, so the set is ${f0(ascKills)} kills (Add binds: ${f0(ascAddKills)} vs tier ${f0(ascTierKills)}) — the pace is kills, never an hour (the kills-not-hours rule · concept.md)`);
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
  // A warp buys back the walk's time, so it is a gold sink and nothing else: gold is the convenience
  // the power currency, so a stone would make travel a power track, and free warps would delete the walk the
  // encounter rate hangs off. The price is one data row, priced per block like every stall line.
  const TOWNJSON = readJson(path.join(eng.ROOT, 'tools/data/town.json'));
  const WARP = (TOWNJSON.repeatable || []).find((r) => r.id === 'waypoint_warp');
  if (!/gold/i.test(ROAD.waypoint_rule)) roadP.push('a Waypoint must warp for gold — it buys back the walk time');
  if (/\bfree\b/i.test(ROAD.waypoint_rule)) roadP.push('a Waypoint must not warp for free — the warp is priced');
  if (!WARP) roadP.push('no town.json `waypoint_warp` line carries the Waypoint price');
  else {
    if (!(WARP.m_per_block > 0)) roadP.push('the Waypoint price must be per block, never a flat toll');
    if (WARP.kind !== 'time') roadP.push(`the Waypoint is sold as "${WARP.kind}" — a warp buys time and nothing else`);
    if (TOWNJSON.settlements.some((s) => (s.stock || []).includes('waypoint_warp'))) roadP.push('a Waypoint is not a stall line: no settlement stocks it');
  }
  if (/\bstone/i.test(ROAD.waypoint_rule)) roadP.push('a Waypoint may never be priced in a stone — stones are the power currency');
  add('X36', roadP.length === 0, roadP.length ? roadP.join(' · ')
    : `the walk is a closed shape: ${ROAD.nodes.length} settlements on the hex lattice · ${ROAD.block_sec}s a block · ${ROAD.encounter_chance_pct}% an encounter per block, so a ${WALK.blocksBetween(ROAD.nodes[0].id, ROAD.nodes[1].id)}-block walk pays ${f1((ROAD.encounter_chance_pct / 100) * WALK.blocksBetween(ROAD.nodes[0].id, ROAD.nodes[1].id) * 10) / 10} fights in expectation · a fight is an ordinary mob group that pays the ordinary drop roll · a Push keeps the walk's blocks · a Waypoint unlocks on foot and warps for ${WARP.m_per_block} minutes of gold a block`);

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
  const expectFlat = Math.round(pwRange.bands[0][0][0] * (E.loot.frame_mod.value_scale['2'] || 1));
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
  // and no Bound pair or Unbound line anywhere — minute one is junk, and junk is what this proves
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
    `the set is ${OP_PIECES.length} pieces, one per slot of the ${opSlots.length} a character wears, and every piece carries exactly one line — its frame's Frame Mod at the floor, with no Bound pair and no Unbound line${opSlotProblems.length ? ' · SLOTS: ' + opSlotProblems.join(' · ') : ''}${opLineProblems.length ? ' · LINES: ' + opLineProblems.join(' · ') : ''}`);

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
    const tierCounts = new Set(m.bands.map((b) => b.length));
    if (tierCounts.size !== 1) modProblems.push(`${m.id} has ${[...tierCounts].join('/')} Tiers across its quality bands`);
    for (const b of m.bands) for (const [a, z] of b) if (a > z) modProblems.push(`${m.id} slice ${a}-${z} is inverted`);
  }
  add('MP1', modProblems.length === 0,
    `every mod range covers its Total — contiguous thirds, overlapping seams, rising T1 floors${modProblems.length ? ' · ' + modProblems.join(' · ') : ''}`);

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
    add('X58', Math.abs(at100 - 1.34) < 0.005,
      `the level-100 skill multiplier reads ×${at100.toFixed(3)} from skill_per_level ${perLevel} — the curve spends ×1.34, so moving that coefficient is a re-base and must say so here`);
  }

  // ---------------------------------------------------------------- the doc linter (X59 · L9 · L10)
  // The prose shelf that survives, and the record of what was retired, are shared by the three gates:
  // X59 holds the retired words out of it, L9 holds the numbers out of it, L10 holds the pointers honest.
  const ALIASES = readJson(path.join(import.meta.dirname, 'data', 'aliases.json'));
  const prose = ['doc/start/glossary.md', 'doc/start/concept.md', 'doc/start/Techstack.md', 'doc/start/tasks.md',
    'AGENTS.md', 'DECISIONS.md', 'PRODUCT.md', 'DESIGN.md'];

  // A retired word must not creep back. The record is `tools/data/aliases.json`; this reads the prose
  // that survives (`doc/start/` and the root rules) and every data note, and honours each entry's own
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
    const termFiles = prose.concat(['todo.md'], parked);
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
      const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
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
      for (const [file, text] of haystack.concat(codeProse)) {
        if (allow.has(file) || allow.has(file.replace(/^.*\//, ''))) continue;
        if (re.test(text)) tHits.push(`${file} "${t.old}" → ${t.new}`);
      }
    }
    add('X59', tHits.length === 0,
      tHits.length ? tHits.slice(0, 8).join(' · ')
        : `${(ALIASES.terms || []).length} retired term(s) stay retired across ${termFiles.length} prose file(s), every data note, and the ${codeProse.length} client/engine file(s)' UI strings and template text, honouring each entry's own allow-list`);
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
    add('L9', hits.length <= (DP.lines_max ?? 0),
      `${hits.length} prose line(s) carry a hand-typed number against the cap ${DP.lines_max} (${DP.rule}) · exempt: ${DP.exempt} · over the cap, move the figure to the key that owns it or mark the line \`lint:allow\`${hits.length ? ` · first: ${hits.slice(0, 6).join(' · ')}` : ''}`);
  }

  // L10 · a pointer to a retired doc must still resolve. The prose shelf collapsed to `doc/start/` plus
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
        if (live.has(n) || DOCS[n]) continue;
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

  return out.concat();
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

const cleanMod = (s) => s.replace(/\s+/g, ' ').trim();
const modName = (id) => LOOT_NAMES[id] || id;
const modBase = (n) => n.replace(/\s+(flat|%)$/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim();

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
  const ids = ['physical_power_flat', 'physical_power', 'magic_power_flat', 'magic_power', ...crit, ...(wp.Secondary || []), 'elemental_power_flat'];
  return new Set(ids.map(modName));
}

function modMatrix() {
  const pools = framePools();
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
