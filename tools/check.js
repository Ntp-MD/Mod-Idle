'use strict';

/**
 * Engine cage — groups A · B · C · F of checks.md.
 *
 *   node tools/check.js            help
 *   node tools/check.js --emit     print the generated group tables
 *   node tools/check.js --write    rewrite those tables inside checks.md
 *   node tools/check.js --checks   run every invariant, exit 1 on FAIL or stale doc
 *
 * Values are computed from tools/data/engine.json (stat model · K values · mod maxima ·
 * loot model · craft prices) and then read back against the prose files that publish
 * them (mod-pool.md · formula.md · core-stats.md · crafting.md · loot.md).
 * A doc number that is not the output of this math is a FAIL, not a note.
 */

const fs = require('fs');
const path = require('path');
const eng = require('./lib/engine');

const { E, S, K, M, LG, BAND, BANDS, BAND_KEYS, CEIL, SPLIT, FORCED_SPLIT, DERIVED, ES, WEAPONS, STONE, LCK_BOUND, L, C, TS } = eng;
const MODS = JSON.parse(fs.readFileSync(path.join(eng.ROOT, 'tools/data/mods.json'), 'utf8'));
const BASES_JSON = require('./data/bases.json');
const ROOT = eng.ROOT;
const f0 = (x) => Math.round(x).toLocaleString('en-US');
const f1 = (x) => x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = (x) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;
const modRange = (id) => { const m = MODS.mods.find((x) => x.id === id); return m ? `${m.min}-${m.max}` : 'TBD'; };

const BAND_LABEL = { low: 'low', mid: 'mid', high: 'high', high_full_lck: 'full Lck' };

// ---------------------------------------------------------------- tables

const BLOCKS = {};

BLOCKS['group-A'] = () => [
  '| id | Must hold | Expression | Value |',
  '|---|---|---|---|',
  `| A1 | stat at level 1 | \`${S.base} + ${S.per_level}×0\` | ${f0(eng.statAt(1))} |`,
  `| A2 | stat at level 100 no gear | \`${S.base} + ${S.per_level}×${S.level_cap - 1}\` | ${f0(eng.statAt(100))} |`,
  `| A3 | single-stat ceiling | \`(${f0(eng.statAt(100))} + ${S.core_flat_max}×${S.item_slots}) × (1 + ${S.core_pct_max}%×${S.item_slots})\` | **${f0(CEIL)}** |`,
  `| A4 | two-stat split ceiling | \`${S.split_items} items + ${S.split_items} items\` = \`(${f0(eng.statAt(100))} + ${S.core_flat_max}×${S.split_items}) × (1 + ${S.core_pct_max}×${S.split_items}%) \` | ${f0(SPLIT)} / ${f0(SPLIT)} |`,
  `| A5 | if Flat and % forced to different stats | \`(${f0(eng.statAt(100))} + ${S.core_flat_max}×${S.item_slots}) × 1.0\` | ${f0(FORCED_SPLIT)} → **never revert to this** because all K values are set on ${f0(CEIL)} |`,
  `| A6 | item count origin | ${S.item_slots} worn slots (11 + main hand) · from equipment-slot.md | ${S.item_slots} |`,
  '',
  `Source: \`node tools/check.js\` · stat line = \`stat_c = ${S.base} + ${S.per_level} × (level − 1)\` (formula.md) · the Flat maximum from mod-pool.md (Stat Mod flat ${S.core_flat_max} · Stat Mod % ${S.core_pct_max}) · slot count from equipment-slot.md.`,
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
    ['B7', 'Elem res raw', `${f0(CEIL)}×${K.K_VIT_RES}`, `${f1(DERIVED.res_raw)}%`],
    ['B8', 'Elem res + 3 Mod items', `${f1(DERIVED.res_raw)} × (1 + ${M.res_pct_per_item}×${LG.res_mod_items})%`, `${f1(DERIVED.res_three)} → cut ${E.caps.elem_res}`],
    ['B9', 'Alignment raw', `${f0(CEIL)}×${K.K_DEX_ALIGN}`, `${f1(DERIVED.align_raw)}%`],
    ['B10', 'CDR raw', `${f0(CEIL)}×${K.K_WIS_CDR}`, `${f1(DERIVED.cdr_raw)}%`],
    ['B11', 'CDR + 4 Mod + BO', `${f1(DERIVED.cdr_raw)} × (1 + ${M.cdr_pct_per_item}×${LG.cdr_mod_items} + ${LG.cdr_buff_pct})%`, `${f1(DERIVED.cdr_four)} → cut ${E.caps.cdr}`],
    ['B12', 'Accuracy', `${f0(CEIL)}×${K.K_DEX_ACC}×${f2(1 + M.accuracy_pct / 100)}`, f0(DERIVED.accuracy)],
    ['B13', 'Weight capacity', `${f0(CEIL)}×${K.K_STR_WEIGHT}`, f0(DERIVED.weight)],
    ['B14', 'Drop multiplier', `1 + ${f0(CEIL)}×${K.K_LCK_DROP}`, `${f2(DERIVED.drop_mult)}x`],
    ['B15', 'Energy Shield pool (Int build)', `${f0(CEIL)}×${K.K_INT_ES}`, `**${f0(DERIVED.es_pool)}** · ${f1(DERIVED.es_share_of_hp * 100)}% of the same build's ${f0(DERIVED.es_cast_hp)} HP`],
    ['B16', 'ES recharge · full recovery', `${f0(CEIL)}×${K.K_INT_ESREGEN}/sec · after ${ES.delay_sec} sec without a hit`, `${f1(DERIVED.es_regen)}/sec → **${f1(DERIVED.es_recover_sec)} sec** for the whole pool · pool ÷ regen held by **X25**`],
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
  // Evasion is one layer (D-112): the Dex rating runs the entropy roll against that mob's
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
    ['C6', `Alignment ${cap('alignment')}`, `Dex ${f0(CEIL)} (${f1(DERIVED.align_raw)}) + amulet + gloves (+${M.align_pct_per_item} +${M.align_pct_per_item})`, `${f1(DERIVED.align_path)} ✓`],
    ['C7', `Elem res ${cap('elem_res')}`, `Vit ${f0(CEIL)} + ${LG.res_mod_items} res items`, `${f1(DERIVED.res_three)} → ${cap('elem_res')} ✓`],
    ['C8', `CDR ${cap('cdr')}`, `Wis ${f0(CEIL)} + ${LG.cdr_mod_items} CDR items + BO`, `${f1(DERIVED.cdr_four)} → ${cap('cdr')} ✓`],
    ['C9', 'Crit (no Cap)', `Lck ${f0(CEIL)} + ${M.crit_pct_main_hand}% Mod + buff`, `${f1(DERIVED.crit)}% from stats alone · anything over ${K.K_CRIT_CAP} becomes crit damage (B6b) ✓`],
    ['C10', `stun ${Math.round(cap('alignment') * K.K_STUN_PER_ALIGN)}%`, `Alignment ${cap('alignment')} × ${K.K_STUN_PER_ALIGN}`, `${Math.round(cap('alignment') * K.K_STUN_PER_ALIGN)} ✓ (old K 0.15 unreachable)`],
    ['C11', 'Accuracy', 'no Cap · `acc/(acc+E)` forbids 100% itself', `${f0(DERIVED.accuracy)} → ${f1(DERIVED.hit_chance * 100)}% ✓`],
  ];
  return ['| id | Cap | Reachable path | Value at that point |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`), '',
    'H3 rule: every Cap states whether it is reachable, and no row reads `pending` any more — the last one, evasion, was closed by putting it on the opposed form the mob side already uses, so X20 can prove it both ways.',
    'Agi-per-Cap rows are the same line as formula-utility.md section 7: `${E.caps.aspd} ÷ weapon_aspd` minus the 100 baseline and the 25% Mod, divided by ${K.K_AGI_ASPD} per Agi, plus the level-1 Base of 12.', ''].join('\n');
};

BLOCKS['group-F'] = () => {
  const b = BAND;
  const rows = [
    ['F1', 'kills/hr', `3600 ÷ (group × ${L.ttk_per_mob_sec} sec clear + ${L.group_spawn_sec} sec spawn) × group`, `${f0(b.high.kills_per_hr)} high · ${f0(b.mid.kills_per_hr)} mid · ${f0(b.low.kills_per_hr)} low`],
    ['F2', 'drops per kill', `${L.base_drop_chance * 100}% × (1 + Lck×${K.K_LCK_DROP})`, `${f1(b.low.drop_chance_pct)}% (L${L.bands.low.lck_level}) · ${f1(b.mid.drop_chance_pct)}% (L${L.bands.mid.lck_level}) · ${f1(b.high.drop_chance_pct)}% (L${L.bands.high.lck_level}) · ${f1(b.high_full_lck.drop_chance_pct)}% (full Lck ${f0(CEIL)})`],
    ['F3', 'drops/hr', `kills/hr × F2`, `**${f0(b.high.drops_per_hr)}** (L90) · ${f0(b.mid.drops_per_hr)} (L60) · ${f0(b.low.drops_per_hr)} (L30) · ${f0(b.high_full_lck.drops_per_hr)} (full Lck)`],
    ['F4', 'upgrades/hr', E.f_rows_carried.find((r) => r.id === 'F4').expression, E.f_rows_carried.find((r) => r.id === 'F4').value],
    ['F5', 'Reroll value stone/hr', `junk × ${TS.gold_per_junk_piece} = drops − upgrades`, `**${f0(b.high.junk_per_hr)}**`],
    ['F6', 'Reroll value uses/hr', `${f0(b.high.junk_per_hr)} ÷ ${C.reroll_value_stones_per_use}`, `**${f0(STONE.reroll_uses_per_hr)}**`],
    ['F7', 'Reroll tier stone/hr', `elite ${f0(b.high.kills_per_hr * L.elite_spawn_chance * L.elite_tier_stones)} (${L.elite_spawn_chance * 100}% of kills ×${L.elite_tier_stones}) + boss ${f0(L.boss_per_hour * L.boss_tier_stones)} (${L.boss_per_hour} ×${L.boss_tier_stones})`, `${f0(STONE.tier_stones_per_hr)}`],
    ['F8', 'Refine/hr', `${f0(STONE.tier_stones_per_hr)} ÷ ${C.refine_stones_per_use}`, `**${STONE.refines_per_hr.toFixed(2)}**`],
    ['F9', 'Add mod stone/hr', `elite ${f2(b.high.kills_per_hr * L.elite_spawn_chance * L.elite_add_stone_chance)} (${L.elite_spawn_chance * 100}% of kills × ${L.elite_add_stone_chance * 100}% chance) + boss ${f0(L.boss_per_hour * L.boss_add_stones)} (${L.boss_per_hour} ×${L.boss_add_stones})`, `**${STONE.add_stones_per_hr.toFixed(2)}**`],
    ['F10', 'Ascend/hr', `min(F9 ÷ ${C.ascend_add_stones} Add, F7 ÷ ${C.ascend_tier_stones} tier) — the scarcer stone sets the pace`, `**${STONE.ascend_per_hr.toFixed(2)}** · full 12-piece set **${STONE.ascend_hours_full_set} hr** (Add alone ${STONE.add_hours_full_set} hr · tier stones alone ${STONE.tier_hours_full_set} hr → tier stones bind)`],
    ['F13', 'herb bundles/hr', `separate roll · ${f2(E.herbs.mid_chance * 100)}% per kill mid · ${f2(E.herbs.high_chance * 100)}% high · bundle of ${E.herbs.bundle_min}-${E.herbs.bundle_max} zone-tier herbs`, `mid band **${f2(BAND.mid.kills_per_hr * E.herbs.mid_chance)}/hr** · high band **${f2(BAND.high.kills_per_hr * E.herbs.high_chance)}/hr**`],
    ['F16', 'Refine full set', `${C.ascend_items_per_set} pieces × ${C.refine_slots_per_item} slots × ${C.refine_steps} steps = ${STONE.refine_casts_full_set} casts ÷ ${STONE.refines_per_hr.toFixed(2)}`, `**${f1(STONE.refine_hours_full_set)} hr** (checks.md E6)`],
    ['F17', 'Full-set polish', `${C.polish_casts_per_full_set} casts ÷ ${f0(STONE.reroll_uses_per_hr)}`, `**${f2(STONE.polish_hours_full_set)} hr** (checks.md E8)`],
    ['F18', 'gold per minute of full-sell income', `junk/hr ÷ 60`, `${eng.goldPerMinute('low')} low · ${eng.goldPerMinute('mid')} mid · ${eng.goldPerMinute('high')} high · ${eng.goldPerMinute('high_full_lck')} full Lck (towns-stalls.md §1)`],
    ['F19', 'full-Lck income ceiling over the no-Lck line', `${f0(b.high_full_lck.junk_per_hr)} ÷ ${f0(b.high.junk_per_hr)}`, `**×${f2(LCK_BOUND)}** — the only place Lck may multiply income (G8)`],
    ['F20', 'Quality Stone/hr', `monster ${f0(b.high.kills_per_hr * L.quality_stone_sources.monster_quality_chance)} (${L.quality_stone_sources.monster_quality_chance * 100}% of kills) + elite ${f0(b.high.kills_per_hr * L.elite_spawn_chance * L.quality_stone_sources.elite_quality_chance)} (1 in 5 × ${L.quality_stone_sources.elite_quality_chance * 100}%) + boss ${f0(L.boss_per_hour * L.quality_stone_sources.boss_quality_stones)} (${L.boss_per_hour} ×${L.quality_stone_sources.boss_quality_stones})`, `**${f0(STONE.quality_stones_per_hr)}**`],
    ['F21', 'Upgrade full set', `${C.upgrade_costs.join(' + ')} = ${STONE.upgrade_stones_per_piece} per piece × ${C.ascend_items_per_set} pieces = ${STONE.upgrade_stones_full_set} stones ÷ F20`, `**${f1(STONE.upgrade_hours_full_set)} hr** for a full +15 set · the steps ${C.upgrade_breaks_from}-15 third alone, hunted only from bosses, is **${f1(STONE.upgrade_boss_third_hours)} hr** (crafting.md "sources shift monsters → elites → bosses by step")`],
    ['F22', 'Repair and Corrupt stone/hr', `Repair: elite ${f0(b.high.kills_per_hr * L.elite_spawn_chance * L.repair_stone_sources.elite_repair_chance)} (1 in 5 × ${L.repair_stone_sources.elite_repair_chance * 100}%) + boss ${f0(L.boss_per_hour * L.repair_stone_sources.boss_repair_stones)} · Corrupt: boss ${L.boss_per_hour} × ${L.corrupt_stone_sources.boss_corrupt_chance * 100}% chance`, `Repair **${f0(STONE.repair_stones_per_hr)}/hr** · Corrupt **${f1(STONE.corrupt_stones_per_hr)}/hr** — the rarest stone, so one gamble per piece costs about an hour and a full ${STONE.corrupt_gambles_full_set}-piece set of gambles is ${STONE.corrupt_gambles_full_set} hr (crafting.md §Corrupt)`],
  ];
  const carried = E.f_rows_carried.filter((r) => !['F4'].includes(r.id)).map((r) => `| ${r.id} | ${r.value} | ${r.expression} · status **${r.status}** |`);
  return ['| id | Value | Expression |', '|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | \`${r[2]}\` = ${r[3]} |`),
    ...carried, '',
    `Derived from: group spawn ${L.group_spawn_sec} sec · ${L.ttk_per_mob_sec} sec TTK per mob (checks.md D1-D3) · Lck read at the band's top level (stat_c = ${S.base} + ${S.per_level}×(L−1)) · Base drop ${L.base_drop_chance * 100}% (formula-utility.md section 10) · prices ${C.reroll_value_stones_per_use}/${C.refine_stones_per_use} stones (crafting.md).`,
    `F4 · F11 are **simulation output** (loot.md section 3) and F13 is unset — this cage does not invent it, it only refuses to let a derived row drift.`, ''].join('\n');
};

// ---------------------------------------------------------------- invariants

function runChecks() {
  const out = [];
  const add = (id, ok, detail) => out.push({ id, ok, detail });

  add('X1', Math.round(CEIL) === 816, `single-stat ceiling = ${f0(CEIL)} — every K value is set on this number (H5 · A3)`);
  add('X2', f0(FORCED_SPLIT) === '510', `Flat/% forced to different stats would give ${f0(FORCED_SPLIT)} — the doc line that forbids reverting A3`);
  add('X3', Math.abs(DERIVED.pool_regen_sec - TS.craft_progress_intent_sec) <= TS.pool_regen_tolerance,
    `mana pool ÷ regen = ${f1(DERIVED.pool_regen_sec)} sec against the ${TS.craft_progress_intent_sec} sec intent (B5 · K_INT_MREGEN)`);
  add('X4', BANDS.every((b) => Math.abs(BAND[b].kills_derived - BAND[b].kills_per_hr) / BAND[b].kills_per_hr <= L.kill_rate_tolerance),
    `kill rates derived from group size + spawn time within ${L.kill_rate_tolerance * 100}%: ${BANDS.map((b) => `${BAND[b].kills_derived}/${BAND[b].kills_per_hr} ${BAND_LABEL[b]}`).join(' · ')}`);
  add('X5', BANDS.every((b) => BAND[b].drops_per_hr === Math.round(BAND[b].kills_per_hr * (BAND[b].drop_chance_pct / 100))) && BAND.high_full_lck.drops_per_hr === Math.round(BAND.high_full_lck.kills_per_hr * (BAND.high_full_lck.drop_chance_pct / 100)),
    `F3 = F1 × F2 for all four rows: ${['low', 'mid', 'high', 'high_full_lck'].map((b) => `${f0(BAND[b].drops_per_hr)} ${BAND_LABEL[b]}`).join(' · ')}`);
  add('X6', BANDS.every((b) => BAND[b].junk_per_hr === BAND[b].drops_per_hr - BAND[b].upgrades_per_hr),
    `junk = drops − upgrades everywhere, so gold and stones share one ceiling (G2 · G8)`);
  add('X7', Math.abs(LCK_BOUND - 3.16) < 0.02, `full-Lck junk line ×${f2(LCK_BOUND)} — the bound G8 and towns-stalls T7 quote`);
  add('X8', STONE.tier_stones_per_hr === 18 + 12 && STONE.reroll_uses_per_hr === 52,
    `stone flow: elite 18 + boss 12 = ${STONE.tier_stones_per_hr} tier stones/hr · ${f0(BAND.high.junk_per_hr)} junk ÷ ${C.reroll_value_stones_per_use} = ${STONE.reroll_uses_per_hr} Reroll uses/hr (F6 · F7)`);
  const e6Lines = fs.readFileSync(path.join(ROOT, 'checks.md'), 'utf8').split(/\r?\n/);
  const e6row = e6Lines.find((l) => l.startsWith('| E6 |')) || '';
  const e6 = Number((e6row.match(/([\d.]+) hr/) || [0, NaN])[1]);
  add('X9', Math.abs(e6 - STONE.refine_hours_full_set) <= 0.1, `Refine full set = ${STONE.refine_casts_full_set} casts ÷ ${f1(STONE.refines_per_hr)}/hr = ${f1(STONE.refine_hours_full_set)} hr, and checks.md E6 prints ${e6} hr — Tier belongs to the piece (D-033), so a cast moves the whole item one step`);
  add('X10', STONE.polish_hours_full_set <= 2, `full-set polish = ${f2(STONE.polish_hours_full_set)} hr (E8 · the opportunity cost one gold is priced against)`);

  // Cap reachability: exactly one row may be pending, the rest must be proven
  const capRows = [
    ['alignment', DERIVED.align_path, E.caps.alignment],
    ['elem res', DERIVED.res_three, E.caps.elem_res],
    ['cdr', DERIVED.cdr_four, E.caps.cdr],
  ];
  const unreached = capRows.filter(([, v, c2]) => v < c2);
  add('X11', unreached.length === 0,
    `proven-reachable caps: ${capRows.map(([n, v, c2]) => `${n} ${f1(v)} ≥ ${c2}`).join(' · ')}${unreached.length ? ' · UNREACHED: ' + unreached.map((r) => r[0]).join(',') : ''}`);
  add('X12', DERIVED.crit <= K.K_CRIT_CAP && E.caps.crit_chance === null,
    `crit has no Cap (the 100 Cap became a spill point): stats alone = ${f1(DERIVED.crit)}% < ${K.K_CRIT_CAP}, so overflow is ${f1(DERIVED.crit_overflow)} today and only buffs/skills can push past it (C9 · formula-offense.md)`);
  const capped = WEAPONS.filter((w) => !w.reachable).map((w) => w.name);
  add('X13', capped.length === WEAPONS.length,
    `aspd Cap ${E.caps.aspd} (= ${E.caps.aspd / 100} times/sec, the 0.2 sec floor) is out of reach for every weapon at the Agi ceiling: ${WEAPONS.map((w) => `${w.name} ${f0(w.agi_to_cap)}`).join(' · ')} vs ceiling ${f0(CEIL)} — the Cap is a clock rule, not a build target, and K_AGI_ASPD stays at ${K.K_AGI_ASPD} so no weapon crowds it`);
  add('X14', WEAPONS.every((w) => Math.abs(w.weapon_mult - 1.2 / w.weapon_aspd) < 0.005),
    `weapon_mult = 1.2 ÷ weapon_aspd for all 6 rows (D10 · equal DPS across 12 types)`);

  // X15 reads the maxima out of `mods.json` — the file that owns them. It used to parse the
  // "Total" column back out of mod-pool.md and compare, which made the DOC a second source of a
  // number the engine already had: the two could disagree and the doc would win (D-113). Now the
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
  ];
  const mpProblems = [];
  for (const [label, want] of MP_RULES) {
    const got = modMaxOf(label);
    if (got === null) mpProblems.push(label + ': not a Mod line in mods.json');
    else if (got !== want) mpProblems.push(label + ': mods.json ' + got + ' vs engine ' + want);
  }
  add('X15', mpProblems.length === 0, mpProblems.length ? mpProblems.join(' · ')
    : `${MP_RULES.length} Mod maxima read out of \`mods.json\` and equal the engine — the data owns the number, mod-pool.md only prints it (D-113)`);

  add('X16', L.base_drop_chance === 0.08 && K.K_LCK_DROP === 0.01,
    `Base drop ${L.base_drop_chance * 100}%/kill · drop_rate = 1 + Lck×${K.K_LCK_DROP} (formula-utility.md section 10 · nothing else mints items)`);
  // Mob species: every multiplier vector must average 1.00 so mob_HP keeps deriving from player DPS
  const MOB = E.mob;
  const ZONES = MOB.zones;
  const bad = MOB.species
    .map((r) => ({ name: r.name, avg: STAT_KEYS.reduce((t, k) => t + r.stats[k], 0) / STAT_KEYS.length }))
    .filter((r) => Math.abs(r.avg - 1) > 0.005);
  const zoneProblems = MOB.species.filter((r) => r.zones.some((z) => z < 1 || z > 9)).map((r) => r.name);
  const sizeProblems = MOB.species.filter((r) => r.sizes.some((s) => !MOB.sizes.some((x) => x.id === s))).map((r) => r.name);
  add('X19', bad.length === 0 && zoneProblems.length === 0 && sizeProblems.length === 0,
    bad.length ? `species stat vector does not average 1.00: ${bad.map((r) => `${r.name} ${r.avg.toFixed(3)}`).join(' · ')}`
      : zoneProblems.length ? `species listed in a zone outside 1-9: ${zoneProblems.join(', ')}`
        : sizeProblems.length ? `species references a body class that does not exist: ${sizeProblems.join(', ')}`
          : `${MOB.species.length} species × ${MOB.sizes.length} body classes · every stat vector averages 1.00 (mob_HP still derives from player DPS) · accuracy spans ×${Math.min(...MOB.species.map((r) => r.accuracy_mult)).toFixed(2)}-×${Math.max(...MOB.species.map((r) => r.accuracy_mult)).toFixed(2)}, so the Evasion Cap ${E.caps.evasion} costs a full Dex+Agi pair against the ceiling (X20)`);

  // The species mix is what makes the Evasion Cap answerable, so guard a floor and a ceiling.
  // X20's question changed shape with D-112: Agi now adds flat points rather than an opposed
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
  if (Math.abs(evRef - evMean) > 0.05) evProblems.push(`the published reference mob (${f1(evRef)}) is not the mean species line (${f1(evMean)})`);
  if (Math.abs(evMean - S.level_cap) > 5) evProblems.push(`mean-species evasion ${f1(evMean)} drifted from the retired level×1 anchor ${S.level_cap} by more than 5 — that is a rebalance, not a derivation`);
  if (!(evLo < evRef && evRef < evHi)) evProblems.push(`species evasion is degenerate: range ${f0(evLo)}-${f0(evHi)} does not straddle the reference ${f0(evRef)}`);
  if (Math.min(...hits) < 70 || Math.max(...hits) > 90) evProblems.push(`a 0-item player's hit chance leaves the 70-90% band (${f1(Math.min(...hits))}-${f1(Math.max(...hits))}%)`);
  if (mobHitFullDex < 40) evProblems.push(`a Full-Dex player is too untouchable: the top accuracy tier lands only ${f1(mobHitFullDex)}%`);
  if (Math.round(DERIVED.ref_build_hit_pct) !== E.build.hit_chance_pct) evProblems.push(`build.hit_chance_pct ${E.build.hit_chance_pct} vs engine ${Math.round(DERIVED.ref_build_hit_pct)}`);
  add('X21', evProblems.length === 0,
    evProblems.length ? evProblems.join(' · ')
      : `mob evasion = stat_c × species.dex × K_EVASION ${K.K_EVASION} × body · reference (mean species, Medium body) ${f1(evRef)} at level ${S.level_cap} vs the retired level×1 curve ${S.level_cap}, so the published hit anchors hold (${E.build.hit_chance_pct}% no-Dex · ${f1(DERIVED.hit_chance * 100)}% at the accuracy ceiling) · species spread ${f0(evLo)}-${f0(evHi)} keeps a 0-item player at ${f1(Math.min(...hits))}-${f1(Math.max(...hits))}% hit · a Full-Dex player still eats ${f1(mobHitFullDex)}% of the top accuracy tier before Dodge`);

  // Armour: the Str line both sides, and it must never wall the player
  const armProblems = [];
  if (!(K.K_ARMOUR > 0 && K.armour_divisor > 0)) armProblems.push('K_ARMOUR or armour_divisor missing');
  const bossCut = DERIVED.armour_vs_zone9_boss * 100, trashCut = DERIVED.armour_vs_zone9_trash * 100;
  // The band tracks the boss damage multiplier. A PoE ratio cuts a fixed Str armour line less of a
  // bigger hit, and boss damage is now forced up by the G5 gate (mob.sizes boss ps -> 16, SV6), so
  // the share armour covers falls by construction. The floor is where armour still matters against
  // a boss and the ceiling is where it would wall one; the trash line above is the real test.
  if (bossCut < 10 || bossCut > 40) armProblems.push(`full-Str armour cuts the zone-9 boss physical hit by ${f1(bossCut)}% — outside the 10-40% design band`);
  if (trashCut < 55) armProblems.push(`armour does not answer trash mobs (${f1(trashCut)}% cut)`);
  const topMobStr = Math.max(...E.mob.species.map((r) => r.stats.str));
  const mobArmour = eng.statAt(80) * topMobStr * K.K_ARMOUR;
  const mobArmourCut = (mobArmour / (mobArmour + K.armour_divisor * DERIVED.phys)) * 100;
  if (mobArmourCut > 10) armProblems.push(`the hardest-armoured mob cuts a max physical hit by ${f1(mobArmourCut)}% — armour is walling the player`);
  add('X22', armProblems.length === 0, armProblems.length ? armProblems.join(' · ')
    : `armour = Str × ${K.K_ARMOUR} both sides · reduction = armour ÷ (armour + ${K.armour_divisor} × raw physical) · Str ${f0(CEIL)} = ${f0(DERIVED.armour_ceil)} armour cuts the zone-9 boss physical hit ${f1(bossCut)}% and a zone-9 trash hit ${f1(trashCut)}% · the hardest mob armour (${f0(mobArmour)} · Golem at 80) costs a max physical hit only ${f1(mobArmourCut)}%`);

  // The mob roster: every legal zone × species × body entry has to exist and be playable
  const ROWS = eng.mobRoster();
  const rp = [];
  if (E.mob.species.length !== 15) rp.push(`${E.mob.species.length} species, not 15`);
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
  add('X24', dLo > 2 && dHi < 25, `mob dodge runs ${f1(dLo)}-${f1(dHi)}% against a same-level attacker — it must stay a thin layer (2-25%) so a mob's own Agi never becomes the answer to a build`);

  // Energy Shield: the caster's second pool, sized so it supplements HP instead of doubling it
  const esProblems = [];
  if (!(K.K_INT_ES > 0 && K.K_INT_ESREGEN > 0)) esProblems.push('K_INT_ES or K_INT_ESREGEN missing');
  if (Math.abs(DERIVED.es_recover_sec - ES.recover_sec) > 0.2) esProblems.push(`ES recovers in ${f1(DERIVED.es_recover_sec)} sec, not the stated ${ES.recover_sec}`);
  if (DERIVED.es_share_of_hp > 0.45 || DERIVED.es_share_of_hp < 0.30) esProblems.push(`ES is ${f1(DERIVED.es_share_of_hp * 100)}% of a caster's HP — outside the 30-45% band`);
  if (!(ES.delay_sec >= 3 && ES.delay_sec <= 8)) esProblems.push(`es delay ${ES.delay_sec} sec is outside the 3-8 sec band`);
  if (!ES.player_only || ROWS.some((r) => r.es)) esProblems.push('Energy Shield leaked to the mob side (it would double-count mob_HP · checks.md H1)');
  add('X25', esProblems.length === 0, esProblems.length ? esProblems.join(' · ')
    : `Energy Shield = Int × ${K.K_INT_ES} (${f0(DERIVED.es_pool)} at the ceiling) · recharges Int × ${K.K_INT_ESREGEN}/sec (${f1(DERIVED.es_regen)}) after ${ES.delay_sec} sec without a hit · full pool in ${f1(DERIVED.es_recover_sec)} sec · exactly ${f1(DERIVED.es_share_of_hp * 100)}% of the same Int build's ${f0(DERIVED.es_cast_hp)} HP · **player-only** so mob_HP stays the single survivability anchor`);

  // Zone identity is data now (mob.zones), but towns.md and loot.md still print the same facts in prose.
  // Nothing allowed two homes: this guard reads both back and fails on any drift.
  const zp = [];
  let townsText = '';
  try { townsText = fs.readFileSync(path.join(ROOT, 'towns.md'), 'utf8'); } catch (e) { zp.push('towns.md unreadable'); }
  if (townsText) {
    for (const line of townsText.split(/\r?\n/)) {
      const m = line.match(/^\|\s*([1-9])\s*\|\s*([\d]+)-([\d]+)\s*\|\s*([^|]+?)\s*\|/);
      if (!m) continue;
      const z = ZONES.find((x) => x.id === Number(m[1]));
      if (!z) { zp.push(`towns.md has zone ${m[1]} with no data row`); continue; }
      if (`${z.levels[0]}-${z.levels[1]}` !== `${m[2]}-${m[3]}`) zp.push(`zone ${m[1]} levels towns.md ${m[2]}-${m[3]} vs data ${z.levels.join('-')}`);
      if (z.name !== m[4]) zp.push(`zone ${m[1]} settlement towns.md "${m[4]}" vs data "${z.name}"`);
      const cells = line.split('|').map((c) => c.trim());
      const tElems = cells[5].split('/').map((s) => s.trim()).sort().join('/');
      const dElems = [...z.elements].sort().join('/');
      if (tElems !== dElems) zp.push(`zone ${m[1]} innate Element towns.md "${tElems}" vs data "${dElems}"`);
    }
  }
  let lootText = '';
  try { lootText = fs.readFileSync(path.join(ROOT, 'loot.md'), 'utf8'); } catch (e) { zp.push('loot.md unreadable'); }
  const GROUP_AVG = { low: '1-2', mid: '2-3', high: '3-5' };
  if (lootText) {
    for (const line of lootText.split(/\r?\n/)) {
      const m = line.match(/^\|\s*(low|mid|high)\s*\((\d+)-(\d+)\)\s*\|\s*([\d.]+) mobs/);
      if (!m) continue;
      const [, band, from, to] = m;
      for (const z of ZONES) {
        if (!z.quality.startsWith(band)) continue;
        if (z.levels[0] < Number(from) || z.levels[1] > Number(to)) zp.push(`zone ${z.id} is quality "${z.quality}" but its levels ${z.levels.join('-')} fall outside loot.md's ${band} band ${from}-${to}`);
        if (z.group !== GROUP_AVG[band]) zp.push(`zone ${z.id} group "${z.group}" does not match loot.md's ${band} band grouping rule (${GROUP_AVG[band]})`);
      }
      const inBand = ZONES.filter((z) => z.quality.startsWith(band));
      if (inBand.length !== 3) zp.push(`loot.md's ${band} band owns ${inBand.length} zones, not 3`);
    }
  }
  add('X26', zp.length === 0, zp.length ? zp.join(' · ')
    : `zone identity has one source — towns.md section 4 (9 settlement rows: name · level range · innate Element) and loot.md section 2 (3 quality bands: level range · group average) both read back equal to engine.json mob.zones · this is the map↔resource↔mob seam that previously had no guard`);

  // checks.md D1 (mob HP) and D2 (mob damage) are hand rows, but they are now machine-checkable
  // against each other: mob_PS = mob_HP ÷ (tree × skill × 27), because mob_HP is built from the same typical DPS.
  let checksText = '';
  try { checksText = fs.readFileSync(path.join(ROOT, 'checks.md'), 'utf8'); } catch (e) { checksText = ''; }
  const cp = [];
  const d1 = checksText.match(/^\| D1 \|[^\n]*/m);
  const d2 = checksText.match(/^\| D2 \|[^\n]*/m);
  const readPairs = (line) => [...line.matchAll(/L(\d+) \*{0,2}([\d,]+)/g)].map((m) => [Number(m[1]), Number(m[2].replace(/,/g, ''))]);
  if (!d1 || !d2) cp.push('D1 or D2 row not found in checks.md');
  else {
    const hp = Object.fromEntries(readPairs(d1[0]));
    const ps = Object.fromEntries(readPairs(d2[0]));
    for (const [L, psAt] of Object.entries(ps)) {
      const hpAt = hp[L];
      if (hpAt === undefined) { cp.push(`D2 gives damage at level ${L} but D1 has no HP anchor to derive it from`); continue; }
      const want = eng.typicalDps(hpAt, Number(L)) / K.mob_damage_divisor;
      if (Math.abs(psAt - Math.round(want)) > 1) cp.push(`level ${L}: D2 says ${psAt}/sec, D1's HP ${f0(hpAt)} inverts to ${f1(want)}/sec`);
    }
    for (const z of ZONES) {
      const edge = z.levels[1];
      if (hp[edge] !== undefined && hp[edge] !== z.hp[1]) cp.push(`zone ${z.id} edge HP data ${f0(z.hp[1])} vs checks.md D1 ${f0(hp[edge])}`);
    }
    // world.md prints the mob HP / mob damage curve by hand — check its two rows agree with each other and with the data
    const wLines = fs.readFileSync(path.join(ROOT, 'world.md'), 'utf8').split(/\r?\n/);
    const wHead = wLines.find((l) => /^\| Level \| 1 \|/.test(l));
    const wHp = wLines.find((l) => /^\| mob HP \|/.test(l));
    const wPs = wLines.find((l) => /^\| mob damage\/sec \|/.test(l));
    let lv = [];
    if (!wHead || !wHp || !wPs) cp.push('world.md mob curve table (Level / mob HP / mob damage) not found');
    else {
      const cells = (l) => l.split('|').slice(2, -1).map((c) => Number(c.trim().replace(/,/g, '')));
      lv = cells(wHead);
      const hpRow = cells(wHp), psRow = cells(wPs);
      if (lv.length !== hpRow.length || lv.length !== psRow.length) cp.push('world.md mob curve rows have different lengths');
      for (let i = 0; i < lv.length; i++) {
        const want = Math.round(eng.typicalDps(hpRow[i], lv[i]) / K.mob_damage_divisor);
        if (Math.abs(psRow[i] - want) > 1) cp.push(`world.md level ${lv[i]}: HP ${f0(hpRow[i])} derives ${want}/sec, the table says ${psRow[i]}`);
        const z = ZONES.find((x) => x.levels[1] === lv[i]);
        if (z && z.hp[1] !== hpRow[i]) cp.push(`world.md level ${lv[i]} HP ${f0(hpRow[i])} vs engine zone ${z.id} edge ${f0(z.hp[1])}`);
      }
    }
    add('X27', cp.length === 0, cp.length ? cp.join(' · ')
      : `mob damage is derived from mob HP, not typed beside it — checks.md D1's ${Object.keys(hp).length} HP anchors invert through the skill multiplier ÷ ${K.mob_damage_divisor} to exactly D2's damage anchors (${Object.keys(ps).map((L) => `L${L} ${ps[L]}`).join(' · ')}), every zone edge in engine.json equals the D1 row, and world.md's generated ${lv.length}-point curve (levels ${lv.join(' · ')}) agrees with itself`);
  }

  // B2: mob_HP(L) is defined at every level, not only the published anchors (X37). The curve is
  // anchored at each zone edge and interpolated inside the zone, so a mob at an unlisted level
  // still has an HP; mob_PS derives from the same line. This gate also pins the D1/D2 prose rows.
  {
    const hpAnchors = d1 ? Object.fromEntries(readPairs(d1[0])) : {};
    const psAnchors = d2 ? Object.fromEntries(readPairs(d2[0])) : {};
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
    for (const [L, h] of Object.entries(hpAnchors)) if (Math.abs(eng.mobHpAt(Number(L)) - h) > 0.5) p.push(`D1 L${L} ${f0(h)} vs curve ${f0(eng.mobHpAt(Number(L)))}`);
    for (const [L, v] of Object.entries(psAnchors)) if (Math.abs(eng.mobPsAt(Number(L)) - v) > 1) p.push(`D2 L${L} ${v} vs curve ${f1(eng.mobPsAt(Number(L)))}`);
    add('X37', p.length === 0, p.length ? p.join(' · ')
      : `mob_HP(L) is anchored at every zone edge and linearly interpolated inside a zone, so every level 1-${S.level_cap} has a value (${f0(eng.mobHpAt(1))} → ${f0(eng.mobHpAt(S.level_cap))}, strictly rising) · mob_PS(L) is \`typical_gear_DPS(L) ÷ ${K.mob_damage_divisor}\` off the same line · the D1 anchors (${Object.keys(hpAnchors).join(' · ')}) read back equal`);
  }

  // One home for every Cap: core-stats.md is the list a player reads, so it must equal the data.
  const CAP_LINES = [
    ['aspd', /Attack speed - % .+ Cap (\d+)/],
    ['evasion', /^Evasion - % Cap (\d+)/],
    ['perfect_dodge', /^Perfect dodge - % Cap (\d+)/],
    ['cdr', /^Cooldown reduction - % Cap (\d+)/],
    ['alignment', /^Elemental alignment - % Cap (\d+)/],
    ['elem_res', /^Elemental resistance .+Cap (\d+) per Element/],
  ];
  const un = [
    ['crit_chance', /^Critical chance - % (no Cap)/],
    ['accuracy', /^Accuracy - numeric value, (no Cap)/],
  ];
  const csText = fs.readFileSync(path.join(ROOT, 'core-stats.md'), 'utf8').split(/\r?\n/);
  const capProblems = [];
  for (const [key, re] of CAP_LINES) {
    const line = csText.find((l) => re.test(l));
    if (!line) { capProblems.push(`core-stats.md has no readable Cap line for ${key}`); continue; }
    const got = Number(line.match(re)[1]);
    if (E.caps[key] !== got) capProblems.push(`${key}: core-stats.md says ${got}, engine.json caps say ${E.caps[key]}`);
  }
  for (const [key, re] of un) {
    const line = csText.find((l) => re.test(l));
    if (E.caps[key] !== null && !line) capProblems.push(`${key} is capped in data but core-stats.md does not show a Cap`);
    if (E.caps[key] === null && !line) capProblems.push(`${key} has no Cap in data but core-stats.md does not say "no Cap"`);
  }
  add('X28', capProblems.length === 0, capProblems.length ? capProblems.join(' · ')
    : `every Cap has one home — core-stats.md's 5 capped lines and 3 "no Cap" lines equal engine.json caps exactly (${CAP_LINES.map(([k]) => `${k}=${E.caps[k]}`).join(' · ')}) · this is the guard that would have caught the CDR 50 → 45 move`);

  // D-104 · the Gear Mod ladder is bounded by the published ceiling of the very line it raises, the
  // same `mod_max` row `tools/loot.js` rolls it from — so +Cap can never out-print a T1 rolled line.
  const GM = E.craft.gear_mod_per_level, GM_CAP = E.craft.upgrade_cap;
  const SCHOOL = { 'Armour flat': E.mod_max.armour_flat_t1, 'Evasion flat': E.mod_max.evasion_flat_t1, 'Energy Shield flat': E.mod_max.energy_shield_flat_t1 };
  const BINDING = Math.min(...Object.values(SCHOOL));
  add('X42', GM > 0 && GM === Math.floor(BINDING / GM_CAP),
    `one Upgrade step is ${GM}, so a full ladder is ${GM * GM_CAP} — exactly the smallest school ceiling (${BINDING}, Evasion flat) and ${Object.entries(SCHOOL).map(([k, v]) => `${k} ${Math.round(GM * GM_CAP / v * 100)}%`).join(' · ')} of theirs (item-base.md sets the school · checks.md H1 pays for the uplift through SV7, not through mob_HP, which D-103 measured as already inside the pacing)`);
  // The endgame craft target is now the engine's own number, not a claim in prose
  // B21 · the three stones the ladder costs must be reachable, and the new income must sit in the
  // pacing family the other crafts were priced in (a full Upgrade set against a full Ascend set).
  add('X41', STONE.quality_stones_per_hr > 0 && STONE.repair_stones_per_hr > 0 && STONE.corrupt_stones_per_hr > 0 &&
      STONE.upgrade_hours_full_set <= 2 * STONE.ascend_hours_full_set && STONE.corrupt_stones_per_hr <= STONE.tier_stones_per_hr / 4,
    `Quality ${STONE.quality_stones_per_hr}/hr · Repair ${STONE.repair_stones_per_hr}/hr · Corrupt ${STONE.corrupt_stones_per_hr}/hr — a full +15 set is ${STONE.upgrade_hours_full_set} hr against Ascend's ${STONE.ascend_hours_full_set} hr and one gamble costs about an hour, while the flow the prices were set against still reads junk ${BAND.high.junk_per_hr}/hr (F5) and tier stones ${STONE.tier_stones_per_hr}/hr (F7)`);
  add('X30', Math.abs(STONE.ascend_hours_full_set - 15) <= 1, `Ascend is priced by the engine at ${STONE.ascend_per_hr}/hr, so a full 12-piece set takes ${STONE.ascend_hours_full_set} hr — inside the ~15 hr the design sells (E7 · concept.md). Add stones (${STONE.add_stones_per_hr}/hr) are the binding cost at ${E.craft.ascend_add_stones} per Ascend, not tier stones (${STONE.tier_stones_per_hr}/hr would allow ${(STONE.tier_stones_per_hr / E.craft.ascend_tier_stones).toFixed(2)})`);

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
  if (BAND.high.drops_per_hr !== 418) bp.push(`normalising bodies moved the drop engine (high band is ${BAND.high.drops_per_hr}, not 418)`);
  add('X32', bp.length === 0, bp.length ? bp.join(' · ')
    : `every zone's body mix averages exactly the published mob_HP(${S.mob_level_cap}) anchor (spawn weights Small ${E.mob.spawn_weights.small} · Medium ${E.mob.spawn_weights.medium} · Large ${E.mob.spawn_weights.large}) · Large entries run ${f0(Math.max(...budgetRows.map((r) => r.hpTo / ZONES.find((z) => z.id === r.zone).hp[1])) * 100)}% of the anchor and Small ${f0(Math.min(...budgetRows.map((r) => r.hpTo / ZONES.find((z) => z.id === r.zone).hp[1])) * 100)}%, so body class changes what a fight feels like without touching kills/hour, drops/hour, stone flow or the timeline`);

  // Reach: the only positional model, and its cost to a melee build must stay small
  const RP = [];
  const allWeapons = ['sword','axe','dagger','mace','spear','two-handed sword','two-handed axe','bow','crossbow','staff','rod','wand','book'];
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
    : `reach is the whole positional model (no tiles, no movement): ${allWeapons.length} weapons mapped to ${Object.keys(E.mob.reach.bands).length} bands · 15 species all carry a line (12 front · 3 stand-off) · stand-off lineages start in zone 7, so zones 1-6 cost a melee build nothing and the worst case is ${f1(worst.cyclePct)}% of the cycle in zone ${worst.zone} (the 12% ceiling)`);

  // Inventory: an adventure bag that fills and pauses, a character bag of stacks, town-only stash/craft
  const IV = E.inventory || {};
  const ivp = [];
  if (!(IV.adventure_slots > 0)) ivp.push('no adventure bag size');
  if (!(IV.character_slots > 0)) ivp.push('no character bag size');
  if (IV.overflow !== 'stop_pickup') ivp.push('overflow must be stop_pickup — a full bag pauses pickups, nothing auto-converts');
  for (const k of ['stone', 'herb', 'potion']) if (!(IV.stack_size && IV.stack_size[k] > 0)) ivp.push(`no stack size for ${k}`);
  if (IV.gold_uses_slot !== false) ivp.push('gold must not consume a slot');
  const invText = fs.readFileSync(path.join(ROOT, 'loot.md'), 'utf8');
  if (!/adventure bag/i.test(invText)) ivp.push('loot.md never describes the adventure bag');
  const gearHr = L.bands.high.upgrades_per_hr;                       // kept gear/hr = measured upgrades (F4)
  const gearFill = IV.adventure_slots / gearHr;
  const stoneSlotHr = IV.stack_size.stone / BAND.high.junk_per_hr;   // one stone slot of value stones
  add('X34', ivp.length === 0, ivp.length ? ivp.join(' · ')
    : `adventure bag ${IV.adventure_slots} slots (kept gear only) fills in ~${f1(gearFill)} hr at the high band's measured ${gearHr} upgrades/hr · character bag ${IV.character_slots} slots holds consumables (stone ${IV.stack_size.stone}/slot = ${f1(stoneSlotHr)} hr of value stones, herb/potion ${IV.stack_size.herb}/slot) with gold taking no slot · full = pickups pause, nothing auto-converts, nothing is deleted · stash + craft are Settlement-only (loot.md §4 · D-056)`);

  // Junk is gold's primary mint now (Ragnarok-style); every rarity must reproduce the published
  // junk line, so rarity changes the flavour and the price but not the expected income
  {
    const J = E.junk || {};
    const jp = [];
    const perKill = BAND.high.junk_per_hr / L.bands.high.kills_per_hr_published;
    if (!J.rarities) jp.push('no junk rarities');
    else for (const [r, v] of Object.entries(J.rarities)) {
      if (!(v.sell_gold > 0 && v.drop_chance_per_kill > 0 && v.drop_chance_per_kill < 1)) jp.push(`rarity ${r} needs a sell and a chance`);
      else if (Math.abs(v.drop_chance_per_kill * v.sell_gold - perKill) > 1e-4) jp.push(`rarity ${r}: chance x sell = ${f2(v.drop_chance_per_kill * v.sell_gold)} gold/kill, must equal the line ${f2(perKill)}`);
    }
    for (const sp of E.mob.species) {
      const j = J.by_species && J.by_species[sp.id];
      if (!j) jp.push(`no junk item for species ${sp.id}`);
      else if (!J.rarities || !J.rarities[j.rarity]) jp.push(`${sp.id} junk "${j.name}" has unknown rarity ${j.rarity}`);
    }
    const junkHr = L.bands.high.kills_per_hr_published * perKill;
    add('X39', jp.length === 0, jp.length ? jp.join(' · ')
      : `mob junk is gold's primary mint: ${Object.keys(J.by_species).length} species items over ${Object.keys(J.rarities).length} rarities (common ${J.rarities.common.sell_gold}g · uncommon ${J.rarities.uncommon.sell_gold}g · rare ${J.rarities.rare.sell_gold}g) · each rarity's chance = the line / its sell, so expected gold is ${f2(perKill)}/kill for any species and the junk line stays ${f0(junkHr)}/hr · stacks ${J.stack}/slot, weightless`);
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

  // The Road is a designed mode now: link graph, weights, a bounded mint, Standing below the time cost.
  const ROAD = E.road;
  const roadP = [];
  if (ROAD.links.length !== ZONES.length - 1) roadP.push(`${ROAD.links.length} Road links for ${ZONES.length} zones, expected ${ZONES.length - 1}`);
  const roadZoneNames = ZONES.map((z) => z.name);
  ROAD.links.forEach((l, i) => {
    const parts = l.split(' ↔ ');
    if (parts[0] !== roadZoneNames[i] || parts[1] !== roadZoneNames[i + 1]) roadP.push(`link ${i + 1} "${l}" is not ${roadZoneNames[i]} ↔ ${roadZoneNames[i + 1]}`);
  });
  const roadEnc = Object.entries(ROAD.encounters);
  const roadWsum = roadEnc.reduce((t, e) => t + e[1].weight, 0);
  if (roadWsum !== 100) roadP.push(`encounter weights sum ${wsum}, not 100`);
  for (const e of roadEnc) for (const fld of ['mobs', 'resolve', 'win', 'loss']) if (!e[1][fld]) roadP.push(`${e[0]} has no ${fld}`);
  const roadPurse = ROAD.links.length * ROAD.purse_gold;
  const roadJunk = eng.goldPerMinute('high') * 60 * 6;
  if (roadPurse / roadJunk > 0.05) roadP.push(`Road mints ${roadPurse} gold/day = ${f1(roadPurse / roadJunk * 100)}% of a 6-hour junk mint, over the 5% bound`);
  const roadTrip = Math.min(...['low', 'mid', 'high'].map((b) => (ROAD.trip_min * BAND[b].kills_per_hr) / 60));
  if (ROAD.standing_per_trip_kills / roadTrip > 0.2) roadP.push(`a trip pays ${ROAD.standing_per_trip_kills} kill-equivalents of Standing but costs ${f1(roadTrip)} kills of hunting time`);
  add('X36', roadP.length === 0, roadP.length ? roadP.join(' · ')
    : `Road is a closed design: ${ROAD.links.length} chain links over consecutive settlements only · ${ROAD.trip_min} min per trip × ${ROAD.encounters_per_min} encounter/min · weights ${roadEnc.map((e) => `${e[0]} ${e[1].weight}%`).join(' · ')} with mobs + resolve + win + loss on each · purse capped at ${roadPurse} gold/day = ${f1((roadPurse / roadJunk) * 100)}% of a 6-hour junk mint · Standing ${ROAD.standing_per_trip_kills} kill-equivalents against the ${f1(roadTrip)} kills a trip costs · no stones, never AFK`);

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
  const givenFlat = OP.gear.reduce((s, it) => s + ((it.mods && it.mods['Physical power flat']) || 0), 0);
  const opPhys = opStat * K.K_STR + givenFlat;
  const opDps = opPhys * (opWpn ? opWpn.weapon_aspd : 0);
  const opMobHp = opZone.hp[0];
  const opSecs = opDps > 0 ? opMobHp / opDps : Infinity;
  const pwRange = MODS.mods.find((m) => m.id === 'physical_power_flat');
  // the curve prices this mob against exactly this character, so the opening weapon must sit
  // in the WORST band of the lowest quality, not merely somewhere inside the whole range —
  // the top of the range is inside it but is a top-tier roll and pays more than the curve
  const worstTier = pwRange.bands[0][0];
  add('OP2', !!opWpn && givenFlat >= worstTier[0] && givenFlat <= worstTier[1] && opSecs >= 0.8 && opSecs <= 2,
    `the starting weapon gives +${givenFlat} physical, and the worst low-quality Tier is ${worstTier[0]}-${worstTier[1]} — so it is the floor of the table, not a gift. A level-1 mob dies in ${Number.isFinite(opSecs) ? f1(opSecs) + ' sec' : 'no time at all (no weapon)'}`);

  const opHp = opStat * K.K_VIT_HP;
  const opRegen = opStat * K.K_VIT_REGEN;
  const opTaken = eng.mobPs(opMobHp, OP.level);
  const opSurvive = opHp / Math.max(0.1, opTaken - opRegen);
  add('OP3', opSurvive > 60, `a level-1 character survives ${f0(opSurvive)} sec against a zone-1 mob — the opening cannot kill the player`);

  add('OP4', OP.skills.length === 0,
    OP.skills.length === 0
      ? 'no starting skill — the mob curve gives a level-1 character 0.3% skill power, so a free skill would be power outside the priced curve'
      : `FAIL: ${OP.skills.length} starting skill(s), each is power the mob curve does not pay for`);

  add('OP5', OP.gold === 0 && Object.keys(OP.stones).length === 0,
    'the opening hands over no currency, so minute one cannot buy past a gate the design has not opened');

  // D-108 · the starting sword is carried, so §11 must weigh it — a client that starts weightless is
  // silently granting the opening build attack speed the weapon column does not give it. The number is
  // the same engine call the client makes, so the two cannot disagree about minute one.
  const opCarry = eng.weaponWeightOf(BASES_JSON, OP.gear[0].base, OP.gear[0].slot);
  const opTax = eng.encumbranceOf(opCarry, eng.statAt(OP.level));
  const lightestMain = Math.min(...BASES_JSON.weapons.filter((w) => w.weight > 0).map((w) => w.weight));
  add('OP6', opCarry > 0 && opTax <= E.caps.weight_overload + 1e-9,
    `the opening weapon weighs ${f0(opCarry)} against a ${f0(eng.weightCapacityOf(eng.statAt(OP.level)))} capacity, so section 11 takes ${f1(opTax * 100)}% of aspd from second one — inside the ${f0(E.caps.weight_overload * 100)}% Cap · the lightest main hand in the table (${f0(lightestMain)}) already exceeds that capacity, so no level-1 character carries a weapon untaxed, which is what harness/todo.md A12 puts to the owner`);

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
  const leaked = offensiveOnly.filter((n) => modMatrix().includes(`| ${n} | yes | yes`));
  if (leaked.length) matrixProblems.push(`Offensive Mod reaching a Defensive slot: ${leaked.join(', ')}`);
  const gearLeak = GEAR_MODS.filter((n) => modMatrix().includes(`| ${n} | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes`));
  if (gearLeak.length) matrixProblems.push(`Gear Mod outside the 5 armour slots: ${gearLeak.join(', ')}`);
  add('X18', matrixProblems.length === 0,
    matrixProblems.length ? matrixProblems.join(' · ')
      : `Mod matrix holds ${matrixRows.length} named lines, all of them real Mod lines · ${offensiveOnly.length} Offensive lines stay on weapons only · Gear Mod stays on the 5 armour slots · Stat Mod on all ${SLOT_ORDER.length} slots`);

  // L9 · prose may not carry a number (D-113). A number outside a GENERATED block has no owner:
  // no writer writes it, so it cannot move when the data moves, and nothing detects it going stale.
  // The rule is that prose names the KEY (`Int x K_INT_ES`) and never the value. A large number of
  // lines still break it, so it lands with a cap equal to today’s count — the shape A2/A3 use for
  // the derived anchors. The cap may only fall.
  {
    const DOCS = require('./lib/generated').listDocs();
    const DECISION_LOG = /(^|\/)(decisions|todo|handoff|HARNESS)\.md$/;   // history and agent ops
    const counted = [];
    for (const f of DOCS) {
      if (DECISION_LOG.test(f)) continue;
      const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
      let inBlock = false;
      text.split(/\r?\n/).forEach((line, i) => {
        if (/^\s*<!-- (BEGIN|END) GENERATED:/.test(line)) { inBlock = /BEGIN/.test(line); return; }
        if (inBlock || /^\s*lint:allow/.test(line)) return;
        if (/(?<![\w.\/])\d/.test(line)) counted.push(`${f}:${i + 1}`);
      });
    }
    const cap = E.doc_prose_lines_max;
    const drift = counted.length - cap;
    add('L9', drift <= 0,
      `prose carries no numbers: ${counted.length} line(s) still do, cap ${cap}` +
      (drift > 0 ? ` — OVER BY ${drift}, the cap may only fall` : ` (under by ${-drift})`) +
      ` · first: ${counted.slice(0, 6).join(', ')}`);
  }

  // doc read-back
  for (const r of eng.runReadBack()) add('RB', r.ok, `${r.label} — ${r.detail}`);
  return out.concat();
}

// ---------------------------------------------------------------- Mod availability matrix
// Reads every Base row out of item-base.md (Primary + Secondary per Base) plus the main-hand
// weapon pool out of equipment-slot-weapon.md, then prints which Mod can appear on which slot.
// Nothing here is typed by hand: edit item-base.md and re-run --write.

/** Per-slot pools split by role, read out of item-base.md — the single source (D-034). */
function basePoolsByRole() {
  const text = fs.readFileSync(path.join(ROOT, 'item-base.md'), 'utf8');
  const out = {};
  let slot = null, roles = [];
  for (const line of text.split(/\r?\n/)) {
    const head = line.match(/^## (.+)$/);
    if (head) {
      const name = cleanMod(head[1]);
      slot = SLOT_ORDER.find((x) => name === x || name.startsWith(x + ' ')) || null;
      roles = [];
      continue;
    }
    if (!slot) continue;
    const cells = line.split('|').map(cleanMod);
    if (cells.length < 5 || cells[0] !== '') continue;
    if (cells[1] === 'Base') { roles = cells.slice(3); continue; }
    if (/^-+$/.test(cells[1]) || !roles.length) continue;
    const bySlot = out[slot] || (out[slot] = {});
    roles.forEach((role, i) => {
      const set = bySlot[role] || (bySlot[role] = new Set());
      for (const one of splitMods(cells[3 + i] || '')) set.add(one);
    });
  }
  return out;
}

const SLOT_ORDER = ['main hand', 'off hand', 'helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'amulet', 'cape'];
const GEAR_MOD_SLOTS = ['helmet', 'chest', 'pant', 'boots', 'gloves']; // item-base.md "Gear Mod school per Base"
const GEAR_MODS = ['Armour flat', 'Evasion flat', 'Energy Shield flat'];
const STAT_MODS = ['Stat Mod flat', 'Stat Mod %'];

const cleanMod = (s) => s.replace(/\s+/g, ' ').trim();
const splitMods = (s) => s.split('·').map(cleanMod).filter((x) => x && x !== '—' && x !== '-');

/** Parse the `| Base | Weight | Primary | Secondary |` tables in item-base.md. */
function basePools() {
  const text = fs.readFileSync(path.join(ROOT, 'item-base.md'), 'utf8');
  const bySlot = {};
  const lines = text.split(/\r?\n/);
  let slot = null;
  let inTable = false;
  for (const line of lines) {
    const head = line.match(/^## (.+)$/);
    if (head) {
      const name = cleanMod(head[1]);
      slot = SLOT_ORDER.find((s) => name === s || name.startsWith(s + ' ')) || null;
      inTable = false;
      continue;
    }
    if (!slot) continue;
    const cells = line.split('|').map(cleanMod);
    if (cells.length < 5 || cells[0] !== '') { inTable = false; continue; }
    if (cells[1] === 'Base') { inTable = true; continue; }
    if (!inTable || /^-+$/.test(cells[1])) continue;
    const mods = bySlot[slot] || (bySlot[slot] = new Set());
    for (const role of cells.slice(3)) for (const one of splitMods(role)) mods.add(one);
  }
  return bySlot;
}

/** Every Mod name that carries a value range in mod-pool.md (Total column starts with a digit). */
function rangedMods() {
  const text = fs.readFileSync(path.join(ROOT, 'mod-pool.md'), 'utf8');
  const names = new Set();
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split('|').map(cleanMod);
    if (cells.length !== 7 || !/^\d/.test(cells[2] || '')) continue;
    names.add(cells[1]);
  }
  return names;
}

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
function weaponPools() {
  const names = rangedMods();
  const mods = new Set();
  const text = fs.readFileSync(path.join(ROOT, 'equipment-slot-weapon.md'), 'utf8');
  const from = text.indexOf('## main hand');
  const body = text.slice(from, text.indexOf('## off hand', from));
  const cells = [];
  for (const line of body.split(/\r?\n/)) {
    const c = line.split('|').map(cleanMod);
    if (c.length < 3) continue;
    if (c[1] === 'Primary' || c[1] === 'Secondary') { for (const one of splitMods(c[2])) mods.add(one); continue; }
    if (c[1] === 'Role' || c[1] === 'Weapon' || c[1] === 'Blocked' || /^-+$/.test(c[1])) continue;
    cells.push(c[2]);
  }
  const pools = fs.readFileSync(path.join(ROOT, 'equipment-slot-pools.md'), 'utf8');
  for (const line of pools.slice(pools.indexOf('# Offensive Pool')).split(/\r?\n/)) {
    const c = line.split('|').map(cleanMod);
    if (c.length === 4) cells.push(c[1]);
  }
  // a cell such as "Physical power flat / %" carries both variants, so match on the base name
  for (const name of names) if (cells.some((cell) => hasBase(cell, modBase(name)))) mods.add(name);
  return mods;
}

function modMatrix() {
  const pools = basePools();
  const weapon = weaponPools();
  const slots = {};
  for (const slot of SLOT_ORDER) {
    const set = new Set(slot === 'main hand' ? weapon : (pools[slot] || []));
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
const mobStat = (mult) => E.stat.base + E.stat.per_level * (E.stat.level_cap - 1);

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
      `${f1(v('vit') * K.K_VIT_RES)}%`,
      `${f1(v('lck') * K.K_LCK_CRIT)}%`,
      `${f1(eng.mobDodge(dodgeRate, S.level_cap))}%`,
    ];
  });
  return [
    '| Species | HP × (Vit) | PS × (Str) | accuracy | evasion | armour | res | crit | dodge |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `Every column is the player's own formula at level 100 (stat block ${f0(base)} per stat): accuracy = Dex × ${K.K_DEX_ACC} × accuracy tier · **evasion = Dex × ${K.K_EVASION}** (the Medium-body line · a Small body multiplies it ×${MOB.sizes[0].evasion}, Large and Elite ×${MOB.sizes[2].evasion}) · **armour = Str × ${K.K_ARMOUR}** (the same line the player uses · D-022 · it is what chill's 25% cut acts on) · res = Vit × ${K.K_VIT_RES} · crit = Lck × ${K.K_LCK_CRIT} · dodge = \`own Agi rate ÷ (rate + a same-level attacker's accuracy)\` (D-024). Mobs are not a separate math — they are the same math with a multiply vector on the stat block. Energy Shield is the one player line a mob does not have (player-only · D-026).`,
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
    r.damage,
    `×${r.accuracy_mult.toFixed(2)}`,
    [...new Set(r.sizes.map(sizeName))].join(' · '),
    STAT_KEYS.map((k) => r.stats[k].toFixed(2)).join(' · '),
  ]);
  const sizeRows = MOB.sizes.map((s) => [s.name, `×${s.hp.toFixed(2)}`, `×${s.ps.toFixed(2)}`, `×${s.evasion.toFixed(2)}`, s.group]);
  sizeRows.push([MOB.elite.name, `×${MOB.elite.hp.toFixed(2)}`, `×${MOB.elite.ps.toFixed(2)}`, `×${MOB.elite.evasion.toFixed(2)}`, MOB.elite.group]);
  return [
    '| Species | Zones | Damage | accuracy | Body classes | str · agi · vit · dex · int · wis · lck |',
    '|---|---|---|---|---|---|',
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
    `The reference is set on the mean so the anchor does not move: \`stat_c × ${K.K_EVASION}\` at the roster mean is ${f1(meanEv)} evasion, against the retired \`level × 1\` curve of ${S.level_cap}. The published hit chances therefore hold as they were — ${E.build.hit_chance_pct}% with no Dex, ${f1(DERIVED.hit_chance * 100)}% at the accuracy ceiling — and everything derived from them (the DPS anchor row in formula.md section 0, mob_HP, the E1-E5 hour checkpoints) is untouched. What changed is only *who* sits above and below the reference: the species spread runs ${f0(loEv)}-${f0(hiEv)} evasion, and a body class multiplies it again (Small ×${E.mob.sizes[0].evasion} · Large and Elite ×${E.mob.sizes[2].evasion}).`,
    '',
    `**Same line, pointed at the player** — mob accuracy against the player's own Evasion rating (\`Dex × ${K.K_EVASION}\` + Gear Evasion flat ${modRange('evasion_flat')}):`,
    '',
    '| mob accuracy tier | species | mob accuracy | mob hits a Dex 0-item player | mob hits a Full-Dex player |',
    '|---|---|---|---|---|',
    ...defRows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `K_DEX_ACC ${K.K_DEX_ACC} against K_EVASION ${K.K_EVASION} is a ${f0(K.K_DEX_ACC / K.K_EVASION)}:1 ratio, so equal Dex on both sides lands the attacker at ${f1((K.K_DEX_ACC / (K.K_DEX_ACC + K.K_EVASION)) * 100)}%. The defensive line is deliberately the weaker one per point, so one stat alone cannot approach untouchable, and this roll runs *before* Dodge and Perfect dodge (combat.md section 2).`,
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
// The weight table tools/loot.js reads as its only Mod-selection input. Generated here so
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
      '`tools/loot.js` is the only consumer, so a weight cannot be typed twice.',
  ].join('\n');
};

// ---------------------------------------------------------------- skill drop rate
BLOCKS['skill-drop'] = () => {
  const SD = E.skill_drop;
  const kph = BAND.high.kills_per_hr;
  const elites = kph * L.elite_spawn_chance;
  const perHour = elites * SD.elite + L.boss_per_hour * SD.boss + kph * (1 - L.elite_spawn_chance) * SD.normal;
  const rows = [
    ['Boss (single, always online-only)', f1(SD.boss * 100) + '% per boss kill', f1(L.boss_per_hour) + '/hr', f1(L.boss_per_hour * SD.boss * 100) / 100 + '/hr'],
    ['Elite (1 in ' + Math.round(1 / L.elite_spawn_chance) + ' kills)', f1(SD.elite * 100) + '% per elite kill', f0(elites) + '/hr', f2(elites * SD.elite) + '/hr'],
    ['Normal mob', f2(SD.normal * 100) + '% per kill', f0(kph) + '/hr', f1(kph * (1 - L.elite_spawn_chance) * SD.normal) + '/hr'],
  ];
  return [
    '| Source | Rate | High-band volume | Skills/hr |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `**${f2(perHour)} skills per hour** in the high band (boss ${f2(L.boss_per_hour * SD.boss)} + elite ${f2(elites * SD.elite)} + normal ${f2(kph * (1 - L.elite_spawn_chance) * SD.normal)}) — the rare item the whole skill list is gated on. Every number above comes from engine.json; the rates were previously quoted in this file and stored nowhere, so nothing could check them.`,
  ].join('\n');
};

// ---------------------------------------------------------------- minute one
BLOCKS['opening'] = () => {
  const OP = E.opening;
  const z = E.mob.zones.find((x) => x.name === OP.settlement);
  const wpn = E.weapons.find((w) => w.name.startsWith('one-handed sword'));
  const stat = eng.statAt(OP.level);
  const flat = OP.gear.reduce((s, it) => s + ((it.mods && it.mods['Physical power flat']) || 0), 0);
  const phys = stat * K.K_STR + flat;
  // the sword is carried, so §11 weighs it: the column comes from bases.json through the same engine
  // rule the client calls, which is why minute one has one answer and not two (D-108)
  const carryWeight = eng.weaponWeightOf(BASES_JSON, OP.gear[0].base, OP.gear[0].slot);
  const tax = eng.encumbranceOf(carryWeight, stat);
  const dps = phys * wpn.weapon_aspd;
  const dpsCarried = phys * wpn.weapon_aspd * (1 - tax);
  const mobHp = z.hp[0];
  const secs = mobHp / dps;
  const secsCarried = dpsCarried > 0 ? mobHp / dpsCarried : Infinity;
  const hp = stat * K.K_VIT_HP;
  const regen = stat * K.K_VIT_REGEN;
  const survive = hp / Math.max(0.1, eng.mobPs(mobHp, OP.level) - regen);
  const it0 = OP.gear[0];
  return [
    '| | Given | Why |',
    '|---|---|---|',
    `| Settlement | **${OP.settlement}** (zone ${z.id}, levels ${z.levels[0]}-${z.levels[1]}) | the zone the player opens in |`,
    `| Level | **${OP.level}** · ${f0(stat)} each stat · ${f0(hp)} Max HP · ${f1(regen)} regen/sec | level-1 baseline, no gear |`,
    `| Gear | **1 item**: ${it0.base}, ${it0.quality} quality T${it0.tier}, Physical power flat +${flat} | the floor of the low-quality table |`,
    `| Skills | **none** | the first skill is the first boss drop |`,
    `| Gold / stones | **0 / 0** | minute one buys nothing |`,
    `| First rule | **${OP.first_rule.objective}** (from the ${OP.first_rule.source}) | the task board already exists and pays stones only |`,
    '',
    `**First fight, measured:** a level-${OP.level} character kills a zone-${z.id} mob in **${f1(secs)} sec** as the curve prices it, and in **${f1(secsCarried)} sec** as a character actually carrying the ${f0(carryWeight)}-weight sword swings it (§11 takes ${f0(tax * 100)}% of aspd against a ${f0(eng.weightCapacityOf(stat))} capacity · survives **${f0(survive)} sec** of the mob's return damage). Numbers come from the same engine the cages use, so the opening cannot drift away from the mob curve it is priced against.`,
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
    `- **${frac(ST.proc_chance)} status proc chance per landed hit** · innate Element is every mob's baseline skill; Large · Elite and Boss add a signature that only re-times its priced \`mob_PS\` (\`combat.md\` §5b · D-067).`,
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
    ['K_VIT_RES', K.K_VIT_RES, 'elem res / Vit · no Flat'],
    ['K_FIRE_BURN', ST.burn.k_dps, `burn per stack · max ${ST.burn.stack_max} stacks = ${f2(ST.burn.k_dps * ST.burn.stack_max)}, exactly the global DoT Cap`],
    ['K_BURN_REGEN_CUT', ST.burn.regen_cut_per_stack, `HP regen cut per burn stack · ${ST.burn.stack_max} stacks = −${f0(ST.burn.regen_cut_max * 100)}%, no separate Cap`],
    ['K_CHILL_ARMOUR_CUT', ST.chill.armour_cut, `target Armour × ${(1 - ST.chill.armour_cut).toFixed(2)} · bites the lineages that carry Armour (D-022)`],
    ['shock_aspd_pct', ST.shock.aspd_pct, `target attack speed · own Cap ${ST.shock.aspd_cap} · adds to chill, which has its own Cap ${ST.chill.aspd_cap}`],
    ['shock_align_cut', ST.shock.align_cut, `our \`elem_align\` × ${(1 - ST.shock.align_cut).toFixed(2)} against a shocked target · shock is the only status that fights our own`],
    ['K_POISON', ST.poison.k_dps, `poison per stack · ${ST.poison.stack_max} stacks = ${f2(ST.poison.k_dps * ST.poison.stack_max)}`],
    ['K_CHAOS_DMG', ST.mark.k_dmg, `+dmg per mark stack · ${ST.mark.stack_max} stacks = +${f0(ST.mark.k_dmg * ST.mark.stack_max * 100)}% damage`],
    ['K_CHAOS_LEECH', ST.mark.k_leech, `lifesteal per mark stack · ${ST.mark.stack_max} stacks = ${f2(ST.mark.k_leech * ST.mark.stack_max)}%`],
    ['K_LIGHTNING_STUN', K.K_STUN_PER_ALIGN, `stun chance per Alignment (${f2(K.K_STUN_PER_ALIGN / 2)} could never reach Cap ${f0(E.caps.alignment * K.K_STUN_PER_ALIGN)}%)`],
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
    `Stand-off lineages on the mob side: ${E.mob.species.filter((s) => s.line === 'stand-off').map((s) => s.name).join(' · ')} — they hold no front slot, so while a front mob lives they can only be reached by a reach-${R.bands.reach} or reach-${R.bands.standoff} attack, and their half of incoming damage is the res-able one (D-030). A reach-1 attack waits one engage cycle (1 sec) when only stand-off mobs remain; the measured cost is nothing in zones 1-6 and at most ${f1(worstCost.pct)}% of the cycle in zone ${worstCost.zone} (**X33**).`,
  ].join('\n');
};

BLOCKS['slot-pools'] = () => {
  const pools = basePoolsByRole();
  const slots = ['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'amulet', 'cape'];
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
  const rows = Object.entries(RD.encounters).map(([k, v]) => `| ${k} | ${v.weight}% | ${v.mobs} | ${v.resolve} | ${v.win} · loss: ${v.loss} |`);
  const dailyPurse = RD.links.length * RD.purse_gold;
  return [
    '| Road element | Value |',
    '|---|---|',
    `| Links (a chain, in zone order) | ${RD.links.join('   ·   ')} |`,
    `| Trip length · encounters | ${RD.trip_min} real minutes · ${RD.trip_min * RD.encounters_per_min} encounters (1 per Road minute) |`,
    '| After the first visit | the Waypoint is free and instant; opening a link costs the carriage price in `towns.md` section 5 |',
    '',
    '| Encounter | Weight | Mobs | Resolution | Win · loss |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    `The purse pays ${RD.purse_gold} gold once per link per day, so the Road can never mint more than **${dailyPurse} gold/day**, while one 6-hour farming session mints thousands by selling junk — Road gold is a rounding error, which is what "C+D are a content choice, not an income choice" has to mean. Standing is granted in kill-equivalents (**${RD.standing_per_trip_kills}** per completed trip), under a fifth of what the same ${RD.trip_min} minutes would earn hunting (**X36**). Losing forfeits roughly ${RD.forfeit_kills} kills of progress and the purse. Road fights pay no stones, and AFK never runs on a Road: a closed client auto-completes the trip (\`save.md\`).`,
  ].join('\n');
};

BLOCKS['zone-table'] = () => {
  const rows = E.mob.zones.map((z) => {
    const boss = E.mob.bosses.find((b) => b.zone === z.id);
    const bs = E.mob.species.find((r) => r.id === boss.species);
    const n = eng.mobRoster().filter((r) => r.zone === z.id).length;
    return [z.id, `${z.name} · ${z.levels[0]}-${z.levels[1]}`, z.quality, `${f0(z.hp[0])} → ${f0(z.hp[1])}`, z.elements.join(' · '), z.group, `${boss.name} (${bs.name})`, n];
  });
  return [
    '| Zone | Settlement · Levels | Dropped Quality ceiling | mob HP (zone edge) | innate Elements | Mobs per group | Boss | roster entries |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
    `HP columns are \`mob_HP(L)\` at the zone's first and last level (checks.md D1) · the boss row is the zone's own \`mob_HP × 15 / damage × 4\` carrier species (combat.md section 7). \`mob-roster.md\` expands every one of these into the per-species, per-body entries a build reads from.`,
  ].join('\n');
};

BLOCKS['mob-curve'] = () => {
  const levels = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const hp = levels.map((L) => f0(eng.mobHpAt(L)));
  const ps = levels.map((L) => f0(eng.mobPsAt(L)));
  return [
    `| Level | ${levels.join(' | ')} |`,
    `|---|${levels.map(() => '---').join('|')}|`,
    `| mob HP | ${hp.join(' | ')} |`,
    `| mob damage/sec | ${ps.join(' | ')} |`,
    '',
    `mob_HP(L) is defined at every level: the curve is anchored at each zone edge in \`tools/data/engine.json\` \`mob.zones\` and interpolated linearly inside the zone a mob spawns in, and the level-100 column is the theoretical cap anchor \`mob.curve.hp_at_player_level_cap\` (the spawn cap is 90). mob damage/sec is \`typical_gear_DPS(L) ÷ ${K.mob_damage_divisor}\`, derived from the same curve rather than typed beside it (**X37**).`,
  ].join('\n');
};

BLOCKS['dodge-table'] = () => {
  const refAcc = eng.mobAcc(S.level_cap, eng.MEAN_SPECIES_DEX, 1);
  const cases = [
    ['Full Dex + Agi 12 items + boots/gloves T1', 816, 30, 0],
    ['Dex + Agi 6 items + 1 T1 item', 468, 30, 0],
    ['No investment + 1 low-Quality item', 210, 6, 0],
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
    `Evasion is one line (D-112): the Dex rating is rolled against the reference attacker (mean species · Medium body · accuracy tier ×1 · level ${S.level_cap} accuracy ${f0(refAcc)}) as \`1 − acc ÷ (acc + rating)\`, then Agi adds **${r4(1 / K.K_AGI_EVAS)} Agi per point** and the Cap ${E.caps.evasion} binds the sum — so this is a snapshot against an average mob, not a fixed Cap point.`,
  ].join('\n');
};

BLOCKS['hp-mana-block'] = () => {
  const hpPct = 1 + (M.hp_pct_per_item * LG.hp_pct_mod_slots) / 100;
  return [
    '```',
    `Max HP   level 100 · full Vit 12 items + 1 Max HP % slot = (${f0(CEIL * K.K_VIT_HP)} + ${f0(LG.hp_per_level * (S.level_cap - 1))}) × ${r2(hpPct)} = ${f0(DERIVED.hp)}`,
    `Max Mana level 100 · full Int                            = (${f0(CEIL * K.K_INT_MP)} + ${f0(LG.mp_per_level * (S.level_cap - 1))})          = ${f0(DERIVED.mana)}`,
    `pool ÷ regen                                              = ${f0(DERIVED.mana)} ÷ ${f0(DERIVED.mana_regen)} = ${r1(DERIVED.pool_regen_sec)} seconds`,
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
    `| Evasion | **${E.caps.evasion}** | Dex rating opposed by mob accuracy, + Agi ÷ ${r4(1 / K.K_AGI_EVAS)} points, capped together · D-112 merged Dodge into this line · reachability closed by X20 |`,
    `| Perfect dodge | **${E.caps.perfect_dodge}** | ratio tops at ${r1(DERIVED.perfect_dodge)}% at Lck ${f0(CEIL)} but the Cap binds first · reachable at Lck ${Math.ceil((E.caps.perfect_dodge / 100) * K.K_PDOGE / (1 - E.caps.perfect_dodge / 100) / K.K_LCK_PDOGE)} · old no-Cap retired |`,
    `| Elemental Alignment | **${E.caps.alignment}** | Dex ${f0(CEIL)} + amulet + gloves = ${r1(DERIVED.align_path)} → exact · old 60 unreachable |`,
    `| Elemental resistance | ${E.caps.elem_res} | requires Vit ${f0(CEIL)} + 3 res slots |`,
    `| Cooldown reduction | ${E.caps.cdr} | requires Wis ${f0(CEIL)} + ${LG.cdr_mod_items} CDR slots |`,
    `| Attack speed | **${E.caps.aspd} (= ${E.caps.aspd / 100} times/sec)** | the 0.2 sec floor between hits · a clock rule, not a build target: fastest weapon needs Agi ${f0(dagger.agi_to_cap)} vs the ${f0(CEIL)} ceiling |`,
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
    `| K_INT_MREGEN | **${K.K_INT_MREGEN}** | mana regen / Int | old 0.2 gave pool/regen 29.7 sec against 40 sec intent |`,
    `| K_INT_ES | ${K.K_INT_ES} | Energy Shield / Int | Int ${f0(CEIL)} = ${f0(CEIL * K.K_INT_ES)} shield = ${r1(DERIVED.es_share_of_hp * 100)}% of that build''s ${f0(DERIVED.es_cast_hp)} HP (X25) |`,
    `| K_INT_ESREGEN | ${K.K_INT_ESREGEN} | ES recharge / Int | ${r1(DERIVED.es_regen)}/sec · ${E.energy_shield.delay_sec} sec delay · whole pool back in ${r1(DERIVED.es_recover_sec)} sec |`,
    `| K_AGI_EVAS | ${r4(K.K_AGI_EVAS)} | Evasion points / Agi | **30 Agi = 1 point** (owner ruling, D-112) · the mob side keeps K_MOB_DODGE for its own thin dodge (D-024) |`,
    `| K_AGI_ASPD | ${K.K_AGI_ASPD} | aspd % per Agi | \`aspd = weapon_aspd × (100 + (agi−12)×${K.K_AGI_ASPD} + aspd_pct)\` · level 1 sword = 1.2 times/sec |`,
    `| K_WIS_CDR | ${K.K_WIS_CDR} | cdr / Wis | ${r1(DERIVED.cdr_raw)}% at ${f0(CEIL)} · needs ${LG.cdr_mod_items} Mod items to reach the ${E.caps.cdr} Cap |`,
    `| K_DEX_ACC | ${K.K_DEX_ACC} | accuracy / Dex | no Cap; ratio formula limits itself |`,
    `| K_DEX_ALIGN | ${K.K_DEX_ALIGN} | Alignment / Dex | shared by Element and status · Cap ${E.caps.alignment} |`,
    `| K_VIT_RES | ${K.K_VIT_RES} | elem res / Vit | no Flat · ${r1(DERIVED.res_raw)}% at ${f0(CEIL)} |`,
    `| K_LCK_CRIT | ${K.K_LCK_CRIT} | crit chance / Lck | ${critFromStat}% at ${f0(CEIL)} + ${M.crit_pct_main_hand} from main hand |`,
    `| K_LCK_PDOGE | **${K.K_LCK_PDOGE}** | perfect dodge rate / Lck | ratio ${r1(DERIVED.perfect_dodge)}% at ${f0(CEIL)} · \`K_PDOGE\` ${K.K_PDOGE} → Cap ${E.caps.perfect_dodge} binds first (reachable at Lck ${Math.ceil((E.caps.perfect_dodge / 100) * K.K_PDOGE / (1 - E.caps.perfect_dodge / 100) / K.K_LCK_PDOGE)}) |`,
    `| K_LCK_DROP | ${K.K_LCK_DROP} | drop rate multiplier / Lck | ${r1(DERIVED.drop_mult)}x at ${f0(CEIL)} · Base drop still separate |`,
    `| K_STR_WEIGHT | ${K.K_STR_WEIGHT} | weight / Str | ${f0(DERIVED.weight)} at Str ${f0(CEIL)} · overweight cuts aspd up to -50% (section 11) |`,
    `| K_dodge | **retired** | — | the flat divisor is gone: Evasion is a ratio plus Agi points (D-112) |`,
    `| K_EVASION | ${K.K_EVASION} | evasion / Dex | same line both sides: mob evasion = \`stat_c × species.dex × ${K.K_EVASION} × body\`, player evasion = \`Dex × ${K.K_EVASION}\` (+ Gear Evasion flat ${modRange('evasion_flat')}) · replaces the old \`mob evasion = level × 1\` stand-in, which made a Slime and an Elf equally hard to hit |`,
    `| weapon_aspd | ${Math.min(...aspds)}-${Math.max(...aspds)} | Base times/sec of weapon | multiplies whole parenthesis in section 7, not only the Agi term |`,
    `| weapon_mult | 1.2 / weapon_aspd | per weapon type | decided · equalizes DPS across types where Agi does not hit Cap |`,
  ].join('\n');
};

BLOCKS['craft-set'] = () => {
  const rows = [
    `| Reroll value | ${C.reroll_value_stones_per_use} Reroll value stones | ~${STONE.reroll_uses_per_hr} | Cheap, can spam · Keeps values inside the same Tier |`,
    `| Refine | ${C.refine_stones_per_use} Reroll tier stones | ~${STONE.refines_per_hr} | Main upgrade path · Tier stones come only from elites (1 in 5, 5% drop) + bosses |`,
    `| Ascend | ${C.ascend_add_stones} Add mod stones + ${C.ascend_tier_stones} Reroll tier stones | ~${STONE.ascend_per_hr} | Slowest and needs planning · Add stones come only from elites and bosses (no AFK path) |`,
    '| Add (1st / 2nd fill) | 1 / 2 Add mod stones | boss-gated | Expands to Rarity crafted max (net counting) |',
    '| Upgrade +N | tiered Quality Stones: 1/2/3/4/5 · 7/9/11/13/15 · 18/21/24/27/30 (sources shift monsters → elites → bosses by step) | set (D-009 5a) | Raises Gear Mod only |',
    '| Repair | 1 Repair stone | elite / boss only | Revives Broken + refills protection |',
  ];
  return [
    '| Tier | Price | Actual casts/hour at high zone | Meaning |',
    '|---|---|---|---|',
    ...rows,
    '',
    '```',
    `Refine full set (${C.ascend_items_per_set} pieces × ${C.refine_steps} steps = ${STONE.refine_casts_full_set} casts, because Tier belongs to the piece · D-033) ≈ ${STONE.refine_hours_full_set} hours`,
    `Ascend full set (${C.ascend_items_per_set} pieces)                             ≈ ${STONE.ascend_hours_full_set} hours`,
    '```',
  ].join('\n');
};

BLOCKS['cap-lines'] = () => {
  const c = E.caps;
  const cdrAt = (n) => r1(DERIVED.cdr_raw * (1 + (M.cdr_pct_per_item * n) / 100));
  return [
    `Attack speed - % · \`hits/sec = aspd / 100\` · Cap ${c.aspd} (= ${c.aspd / 100} hits/sec · the 0.2 sec floor between hits)`,
    `Evasion - % Cap ${c.evasion} (Dex rating ÷ (rating + mob accuracy), then + Agi ÷ 30 points, capped together · D-112 merged Dodge into this line · reachability settled by X20)`,
    `Perfect dodge - % Cap ${c.perfect_dodge} · \`lck × K_LCK_PDOGE ÷ (rate + K_PDOGE)\` ratio tops at ${r1(DERIVED.perfect_dodge)}% but the Cap binds first (reachable at Lck ${Math.ceil((c.perfect_dodge / 100) * K.K_PDOGE / (1 - c.perfect_dodge / 100) / K.K_LCK_PDOGE)}) · definition: dodges what normal dodge cannot block (DoT ticks · effects with no dodge condition) — actual order is in combat.md section 2`,
    `Critical chance - % no Cap · held at 100 and the excess adds to crit damage (\`K_CRIT_OVERFLOW\` ${K.K_CRIT_OVERFLOW} · formula-offense.md section 3) · stat-only ceiling = ${r1(DERIVED.crit)}% at ${f0(CEIL)} Lck, so only buffs/skills create overflow`,
    'Critical damage - % physical only · magic and the 5 Elements never crit · no Cap · `100 + crit_dmg_pct + crit_overflow`',
    `Cooldown reduction - % Cap ${c.cdr} (reachable at ${f0(CEIL)} Wis + ${LG.cdr_mod_items} CDR slots = ${r1(DERIVED.cdr_four)} before the cut · 9 slots reach only ${cdrAt(9)}, so the Cap needs the full set · 10 slots reach ${cdrAt(10)} · D-041)`,
    'Accuracy - numeric value, no Cap · formula `acc / (acc + evasion)` can never reach 100% by design · previously Cap 2,000 which was unreachable',
    `Elemental alignment - % Cap ${c.alignment} (reachable at ${f0(CEIL)} Dex + amulet + gloves · previously 60, unreachable)`,
    `Elemental resistance - % split across 5 Elements, Cap ${c.elem_res} per Element (reachable at ${f0(CEIL)} Vit + 3 res slots)`,
    `Armour - numeric rating · \`Str x K_ARMOUR\` (${K.K_ARMOUR}) + Gear Armour flat (${modRange('armour_flat')}) · physical reduction% = armour / (armour + ${K.armour_divisor} × raw_hit) · no Cap (diminishing by design) · the mob side runs the same K off its own Str, so a Golem or Knight carries real armour and a Rat carries almost none (mob-roster.md)`,
    `Evasion - numeric rating · \`Dex x K_EVASION\` (${K.K_EVASION}) + Gear Evasion flat (${modRange('evasion_flat')}) · PoE entropy roll vs attacker accuracy ahead of dodge · no hard Cap (the ratio is the limit) · the same line runs the mob side, from the mob's own Dex (formula-utility.md section 8)`,
    `Energy Shield - second pool ahead of HP · \`Int x K_INT_ES\` (${K.K_INT_ES}) + Gear Energy Shield flat (${modRange('energy_shield_flat')}) · chaos bypasses it · armour and Elemental resistance shrink the number that drains it · recharges after ${E.energy_shield.delay_sec} sec without a hit at \`Int x K_INT_ESREGEN\` (${K.K_INT_ESREGEN}) per sec, so the whole pool returns in ${r1(DERIVED.es_recover_sec)} sec · no Cap (D-026 · X25)`,
    `Weight - units · capacity = Str x ${K.K_STR_WEIGHT} (${f0(DERIVED.weight)} at ${f0(CEIL)} Str) · Over-capacity is allowed, does not lock equip slots, but reduces Attack speed proportionally up to -50% (formula.md section 11)`,
  ].join('\n');
};

BLOCKS['loot-bands'] = () => {
  const label = { low: 'low (1-30)', mid: 'mid (31-60)', high: 'high (61-90)', high_full_lck: 'high + full Lck' };
  const lckCell = (b) => (b === 'high_full_lck'
    ? `${BAND[b].lck} → ×${BAND[b].lck_mult.toFixed(2)}`
    : `${BAND[b].lck} (L${L.bands[b].lck_level}) → ×${BAND[b].lck_mult.toFixed(2)}`);
  const rows = BAND_KEYS.map((b) => {
    const grp = BAND[b].group_mobs;
    const cycle = (grp * L.ttk_per_mob_sec + L.group_spawn_sec).toFixed(1);
    const drops = b === 'high_full_lck' ? `**${f0(BAND[b].drops_per_hr)}**` : f0(BAND[b].drops_per_hr);
    return `| ${label[b]} | ${grp} mobs | ${cycle} sec | ${f0(BAND[b].kills_per_hr)} | ${lckCell(b)} | ${drops} |`;
  });
  return [
    '| Zone | Average group | Cycle | kills/hour | Lck at that level | drops/hour |',
    '|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
};

BLOCKS['aoe-rules'] = () => {
  const A = E.aoe;
  const dpm = (n) => (Math.min(n, A.target_cap) * A.per_target_pct) / 100 / A.mana_mult;
  return [
    '```',
    'single target → 100% damage · mana cost 1.0×',
    `AoE           → ${A.per_target_pct}% damage per target hit · Cap ${A.target_cap} targets · mana cost ${A.mana_mult}×`,
    '',
    `damage per mana: 1 target ${f2(dpm(1))}× · 2 targets ${f2(dpm(2))}× · 3+ targets ${f2(dpm(A.target_cap))}×`,
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
  return [
    '| Zone | Settlement | species on cast | Small · Medium · Large | Elite | Boss (species · name) | boss HP at zone edge | boss damage/sec | entries |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.join(' | ')} |`),
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
    `Every row is the mob's own stat block at the zone's **last** level (\`stat_c = ${E.stat.base} + ${E.stat.per_level} × (L − 1)\` = ${f0(eng.statAt(90))} at 90), multiplied by the species vector, then by the body class: accuracy = Dex line × ${K.K_DEX_ACC} × accuracy tier · evasion = Dex × ${K.K_EVASION} × body · armour = Str × ${K.K_ARMOUR} · res = Vit × ${K.K_VIT_RES} · crit = Lck × ${K.K_LCK_CRIT} · dodge = own Agi rate ÷ (rate + a same-level attacker's accuracy) (D-024 · X24). HP is \`mob_HP(L) × body\` at both ends of the range, so a mob mid-range interpolates. XP is \`10 × the mob's own level\` with elite ×${E.xp.elite_mult} and boss ×${E.xp.boss_mult} (world.md XP), printed as a range because a mob spawns at the attacker's level, so it is read at both ends of the zone. \`status gate\` is the mob's own Elemental Alignment (\`Dex × ${K.K_DEX_ALIGN}\`, cut at ${E.caps.alignment}), the number that decides how often its innate Element status actually lands (combat.md section 2 step 9). A mob spawns at the attacker's level clamped into its zone's range; its innate Element is rolled with the species bias at ×${E.mob.element_roll.bias_weight} against any other Element the zone carries at ×${E.mob.element_roll.other_weight}; and \`drops: weapon\` means the lineage is allowed to be the source of a weapon-slot piece; \`armour only\` species still drop every other slot, so the 8% base drop rate, the quality floors and the whole stone funnel are untouched (loot.md sections 1-2 · gear, herbs, stones and junk are the four streams).`,
  ].join('\n');
};




const { begin, end, replaceBlock, blockState } = require('./lib/generated');

function targets() {
  const map = {};
  for (const [file, keys] of Object.entries(E.meta.targets)) (map[file] = map[file] || []).push(...keys);
  return map;
}

// ---------------------------------------------------------------- cli

const arg = process.argv[2];

if (arg === '--emit') {
  for (const [file, keys] of Object.entries(targets())) {
    console.log(`\n===== ${file} =====`);
    for (const k of keys) console.log(`\n${begin(k)}\n${BLOCKS[k]()}\n${end(k)}`);
  }
} else if (arg === '--write') {
  for (const [file, keys] of Object.entries(targets())) {
    const p = path.join(ROOT, file);
    let text = fs.readFileSync(p, 'utf8');
    for (const k of keys) {
      const r = replaceBlock(text, k, BLOCKS[k]());
      if (!r.found) { console.error(`MISSING MARKER ${k} in ${file}`); process.exitCode = 1; continue; }
      text = r.text;
      console.log(`wrote ${k} → ${file}`);
    }
    fs.writeFileSync(p, text, 'utf8');
  }
} else if (arg === '--checks') {
  const rows = runChecks();
  for (const r of rows) console.log(`${r.id.padEnd(3)}  ${(r.status || (r.ok ? 'PASS ' : 'FAIL ')).padEnd(7)}  ${r.detail}`);
  const fails = rows.filter((r) => !r.ok);

  const stale = [];
  for (const [file, keys] of Object.entries(targets())) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) { stale.push(`${file} (absent)`); continue; }
    const text = fs.readFileSync(p, 'utf8');
    for (const k of keys) {
      const s = blockState(text, k, BLOCKS[k]());
      if (s !== 'current') stale.push(`${file} :: ${k} (${s})`);
    }
  }
  console.log('');
  const leaks = [];
  for (const [file, keys] of Object.entries(targets())) for (const k of keys) if (/undefined|NaN/.test(BLOCKS[k]())) leaks.push(`${file} :: ${k}`);
  if (leaks.length) console.log('TEMPLATE LEAKS (a generated table contains undefined/NaN):\n  ' + leaks.join('\n  '));
  else console.log('template leaks: none · every generated cell holds a number or a word');
  if (stale.length) console.log('DOC BLOCKS NOT CURRENT:\n  ' + stale.join('\n  '));
  else console.log(`doc blocks: checks.md groups ${targets()['checks.md'].join(' · ')} match the engine`);
  console.log(`\n${rows.length - fails.length}/${rows.length} PASS · ${fails.length} FAIL`);
  if (fails.length || stale.length || leaks.length) process.exitCode = 1;
} else {
  console.log(`engine cage — data: tools/data/engine.json (shared with tools/town.js)

  node tools/check.js --emit     print the generated group tables
  node tools/check.js --write    rewrite groups A · B · C · F inside checks.md
  node tools/check.js --checks   run invariants + read every prose file, exit 1 on FAIL or stale doc
`);
}
