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

const { E, S, K, M, LG, BAND, BANDS, CEIL, SPLIT, FORCED_SPLIT, DERIVED, WEAPONS, STONE, LCK_BOUND, L, C, TS } = eng;
const ROOT = eng.ROOT;
const f0 = (x) => Math.round(x).toLocaleString('en-US');
const f1 = (x) => x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = (x) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  `Source: \`node tools/check.js\` · stat line = \`stat_c = ${S.base} + ${S.per_level} × (level − 1)\` (formula.md) · Flat and % maxima from mod-pool.md (Core stat flat ${S.core_flat_max} · Core stat % ${S.core_pct_max}) · slot count from equipment-slot.md.`,
  ''
].join('\n');

BLOCKS['group-B'] = () => {
  const rows = [
    ['B1', 'Physical / Magic power', `(${f0(CEIL)}×${K.K_STR} + ${M.phys_flat_main_hand}) × ${f2(1 + M.phys_pct_main_hand / 100)}`, `**${f0(DERIVED.phys)}**`],
    ['B2', 'Max HP (Vit build)', `(${f0(CEIL)}×${K.K_VIT_HP} + ${f0(LG.hp_per_level * (S.level_cap - 1))}) × ${f2(1 + (M.hp_pct_per_item * LG.hp_pct_mod_slots) / 100)}`, f0(DERIVED.hp)],
    ['B3', 'Max Mana', `${f0(CEIL)}×${K.K_INT_MP} + ${f0(LG.mp_per_level * (S.level_cap - 1))}`, f0(DERIVED.mana)],
    ['B4', 'Mana regen', `${f0(CEIL)}×${K.K_INT_MREGEN}`, `${f0(DERIVED.mana_regen)}/sec`],
    ['B5', '**pool ÷ regen**', `${f0(DERIVED.mana)} ÷ ${f1(DERIVED.mana_regen)}`, `**${f1(DERIVED.pool_regen_sec)} sec** (intent = ${TS.craft_progress_intent_sec})`],
    ['B6', 'Crit chance', `${f0(CEIL)}×${K.K_LCK_CRIT} + ${M.crit_chance_main_hand}`, `${f1(DERIVED.crit)}%`],
    ['B7', 'Elem res raw', `${f0(CEIL)}×${K.K_VIT_RES}`, `${f1(DERIVED.res_raw)}%`],
    ['B8', 'Elem res + 3 Mod items', `${f1(DERIVED.res_raw)} × (1 + ${M.res_pct_per_item}×${LG.res_mod_items})%`, `${f1(DERIVED.res_three)} → cut ${E.caps.elem_res}`],
    ['B9', 'Alignment raw', `${f0(CEIL)}×${K.K_DEX_ALIGN}`, `${f1(DERIVED.align_raw)}%`],
    ['B10', 'CDR raw', `${f0(CEIL)}×${K.K_WIS_CDR}`, `${f1(DERIVED.cdr_raw)}%`],
    ['B11', 'CDR + 4 Mod + BO', `${f1(DERIVED.cdr_raw)} × (1 + ${M.cdr_pct_per_item}×${LG.cdr_mod_items} + ${LG.cdr_buff_pct})%`, `${f1(DERIVED.cdr_four)} → cut ${E.caps.cdr}`],
    ['B12', 'Accuracy', `${f0(CEIL)}×${K.K_DEX_ACC}×${f2(1 + M.accuracy_pct / 100)}`, f0(DERIVED.accuracy)],
    ['B13', 'Weight capacity', `${f0(CEIL)}×${K.K_STR_WEIGHT}`, f0(DERIVED.weight)],
    ['B14', 'Drop multiplier', `1 + ${f0(CEIL)}×${K.K_LCK_DROP}`, `${f2(DERIVED.drop_mult)}x`],
  ];
  return ['| id | Value | Expression | Result |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | \`${r[2]}\` | ${r[3]} |`), '',
    `Every row is the single-stat ceiling (${f0(CEIL)}) plus the one Mod slot that can roll that line (mod-pool.md maxima · equipment-slot.md slot rules).`,
    `B5 is the row K_INT_MREGEN was retuned for: ${f1(DERIVED.pool_regen_sec)} sec against the ${TS.craft_progress_intent_sec} sec intent (tolerance ±${TS.pool_regen_tolerance} sec).`, ''].join('\n');
};

BLOCKS['group-C'] = () => {
  const cap = (n) => E.caps[n];
  const sword = WEAPONS[1], dagger = WEAPONS[0];
  const c2rate = SPLIT * K.K_AGI_DODGE + M.dodge_flat_t1;
  const c2chance = (c2rate / (c2rate + K.K_dodge)) * 100;
  const rows = [
    ['C1', `Dodge ${cap('dodge_chance')}% chance`, 'opposed by mob accuracy (P1-1 option A2) · reachable path **pending the mob sheet rebalance** · the only Cap in this file without a proven path', 'pending'],
    ['C2', `(compare) Agi ${f0(SPLIT)} + 1 Flat item`, `rate = ${f0(SPLIT)}×${K.K_AGI_DODGE} + ${M.dodge_flat_t1} = ${f0(c2rate)}`, `${f1(c2chance)}% · does not hit Cap ✓`],
    ['C3', `aspd ${cap('aspd')}`, `sword ${sword.weapon_aspd} + ${M.aspd_pct}% Mod → Agi = ${f0(sword.agi_to_cap)}`, `**${f0(sword.agi_to_cap)}** (ceiling ${f0(CEIL)}) ✓`],
    ['C4', `aspd ${cap('aspd')}`, `dagger ${dagger.weapon_aspd} + ${M.aspd_pct}% Mod`, `${f0(dagger.agi_to_cap)} ✓ · staff/2h unreachable by intent`],
    ['C5', `Perfect dodge ${cap('perfect_dodge')}`, `${cap('perfect_dodge')} ÷ ${K.K_LCK_PDOGE}`, `Lck ${f0(cap('perfect_dodge') / K.K_LCK_PDOGE)} ✓`],
    ['C6', `Alignment ${cap('alignment')}`, `Dex ${f0(CEIL)} (${f1(DERIVED.align_raw)}) + amulet + gloves (+${M.align_pct_per_item} +${M.align_pct_per_item})`, `${f1(DERIVED.align_path)} ✓`],
    ['C7', `Elem res ${cap('elem_res')}`, `Vit ${f0(CEIL)} + ${LG.res_mod_items} res items`, `${f1(DERIVED.res_three)} → ${cap('elem_res')} ✓`],
    ['C8', `CDR ${cap('cdr')}`, `Wis ${f0(CEIL)} + ${LG.cdr_mod_items} CDR items + BO`, `${f1(DERIVED.cdr_four)} → ${cap('cdr')} ✓`],
    ['C9', `Crit ${cap('crit_chance')}`, `Lck ${f0(CEIL)} + ${M.crit_chance_main_hand} + buff`, `${f1(DERIVED.crit)} from stats alone → needs buff ✓`],
    ['C10', `stun ${Math.round(cap('alignment') * K.K_STUN_PER_ALIGN)}%`, `Alignment ${cap('alignment')} × ${K.K_STUN_PER_ALIGN}`, `${Math.round(cap('alignment') * K.K_STUN_PER_ALIGN)} ✓ (old K 0.15 unreachable)`],
    ['C11', 'Accuracy', 'no Cap · `acc/(acc+E)` forbids 100% itself', `${f0(DERIVED.accuracy)} → ${f1(DERIVED.hit_chance * 100)}% ✓`],
  ];
  return ['| id | Cap | Reachable path | Value at that point |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`), '',
    'H3 rule: every Cap states whether it is reachable. One row is allowed to read `pending` and it is named — C1 dodge waits on the mob sheet (P1-1), and until then the Cap is not sold to players as reachable.',
    'Agi-per-Cap rows are the same line as formula-utility.md section 7: `300 ÷ weapon_aspd` minus the 100 baseline and the 25% Mod, divided by 0.25 per Agi, plus the level-1 Base of 12.', ''].join('\n');
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
    ['F16', 'Refine full set', `${C.ascend_items_per_set} pieces × ${C.refine_slots_per_item} slots × ${C.refine_steps} steps = ${STONE.refine_casts_full_set} casts ÷ ${STONE.refines_per_hr.toFixed(2)}`, `**${f1(STONE.refine_hours_full_set)} hr** (checks.md E6)`],
    ['F17', 'Full-set polish', `${C.polish_casts_per_full_set} casts ÷ ${f0(STONE.reroll_uses_per_hr)}`, `**${f2(STONE.polish_hours_full_set)} hr** (checks.md E8)`],
    ['F18', 'gold per minute of full-sell income', `junk/hr ÷ 60`, `${eng.goldPerMinute('low')} low · ${eng.goldPerMinute('mid')} mid · ${eng.goldPerMinute('high')} high · ${eng.goldPerMinute('high_full_lck')} full Lck (towns-stalls.md §1)`],
    ['F19', 'full-Lck income ceiling over the no-Lck line', `${f0(b.high_full_lck.junk_per_hr)} ÷ ${f0(b.high.junk_per_hr)}`, `**×${f2(LCK_BOUND)}** — the only place Lck may multiply income (G8)`],
  ];
  const carried = E.f_rows_carried.filter((r) => !['F4'].includes(r.id)).map((r) => `| ${r.id} | ${r.value} | ${r.expression} · status **${r.status}** |`);
  return ['| id | Value | Expression |', '|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | \`${r[2]}\` = ${r[3]} |`),
    ...carried, '',
    `Derived from: group spawn ${L.group_spawn_sec} sec · ${L.ttk_per_mob_sec} sec TTK per mob (checks.md D1-D3) · Lck read at the band's top level (stat_c = ${S.base} + ${S.per_level}×(L−1)) · Base drop ${L.base_drop_chance * 100}% (formula-utility.md section 10) · prices ${C.reroll_value_stones_per_use}/${C.refine_stones_per_use} stones (crafting.md).`,
    `F4 · F11 are **simulation output** (loot.md section 3) and F9 · F10 · F13 are unset — this cage does not invent them, it only refuses to let a derived row drift.`, ''].join('\n');
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
  add('X9', f1(STONE.refine_hours_full_set) === '16.0', `Refine full set = ${STONE.refine_casts_full_set} casts ÷ ${f1(STONE.refines_per_hr)}/hr = ${f1(STONE.refine_hours_full_set)} hr (E6)`);
  add('X10', STONE.polish_hours_full_set <= 2, `full-set polish = ${f2(STONE.polish_hours_full_set)} hr (E8 · the opportunity cost one gold is priced against)`);

  // Cap reachability: exactly one row may be pending, the rest must be proven
  const capRows = [
    ['perfect dodge', CEIL * K.K_LCK_PDOGE, E.caps.perfect_dodge],
    ['alignment', DERIVED.align_path, E.caps.alignment],
    ['elem res', DERIVED.res_three, E.caps.elem_res],
    ['cdr', DERIVED.cdr_four, E.caps.cdr],
  ];
  const unreached = capRows.filter(([, v, c2]) => v < c2);
  add('X11', unreached.length === 0,
    `proven-reachable caps: ${capRows.map(([n, v, c2]) => `${n} ${f1(v)} ≥ ${c2}`).join(' · ')}${unreached.length ? ' · UNREACHED: ' + unreached.map((r) => r[0]).join(',') : ''}`);
  add('X12', DERIVED.crit < E.caps.crit_chance,
    `crit chance from stats alone = ${f1(DERIVED.crit)}% < Cap ${E.caps.crit_chance} → the last ${f1(E.caps.crit_chance - DERIVED.crit)} points must come from buffs (C9 · skill-pool.md)`);
  const capped = WEAPONS.filter((w) => !w.reachable).map((w) => w.name);
  add('X13', capped.length === 2 && capped.every((n) => /staff|two-handed/.test(n)),
    `aspd Cap unreachable exactly for: ${capped.join(' · ')} (${WEAPONS.filter((w) => !w.reachable).map((w) => w.agi_to_cap).join(' · ')} Agi vs ceiling ${f0(CEIL)}) — the documented intent`);
  add('X14', WEAPONS.every((w) => Math.abs(w.weapon_mult - 1.2 / w.weapon_aspd) < 0.005),
    `weapon_mult = 1.2 ÷ weapon_aspd for all 6 rows (D10 · equal DPS across 12 types)`);

  // mod-pool.md maxima are the source of every Mod assumption used above
  const mp = fs.readFileSync(path.join(ROOT, 'mod-pool.md'), 'utf8');
  const upperOf = (label) => {
    const line = mp.split(/\r?\n/).find((l) => l.startsWith(`| ${label} |`));
    if (!line) return null;
    const m = line.split('|')[2].match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/);
    return m ? Number(m[2]) : null;
  };
  const MP_RULES = [
    ['Physical power flat', M.phys_flat_main_hand], ['Physical power %', M.phys_pct_main_hand],
    ['Critical chance %', M.crit_chance_main_hand], ['Critical damage % (physical)', M.crit_damage_mod_pct],
    ['Attack speed %', M.aspd_pct], ['Accuracy %', M.accuracy_pct],
    ['Cooldown reduction %', M.cdr_pct_per_item], ['Dodge flat', M.dodge_flat_t1],
    ['Max HP %', M.hp_pct_per_item], ['Elemental resistance %', M.res_pct_per_item],
    ['Elemental alignment %', M.align_pct_per_item], ['Core stat flat', S.core_flat_max],
    ['Core stat %', S.core_pct_max],
  ];
  const mpProblems = [];
  for (const [label, want] of MP_RULES) {
    const got = upperOf(label);
    if (got === null) mpProblems.push(`${label}: row not found in mod-pool.md`);
    else if (got !== want) mpProblems.push(`${label}: mod-pool upper ${got} vs engine ${want}`);
  }
  add('X15', mpProblems.length === 0, mpProblems.length ? mpProblems.join(' · ') : `${MP_RULES.length} Mod maxima read straight out of the mod-pool.md "Total" column and equal the engine`);

  add('X16', L.base_drop_chance === 0.08 && K.K_LCK_DROP === 0.01,
    `Base drop ${L.base_drop_chance * 100}%/kill · drop_rate = 1 + Lck×${K.K_LCK_DROP} (formula-utility.md section 10 · nothing else mints items)`);
  add('X17', E.caps.accuracy === null, 'accuracy has no Cap (the 2,000 Cap was removed) · the ratio formula limits itself at ' + f1(DERIVED.hit_chance * 100) + '%');

  // doc read-back
  for (const r of eng.runReadBack()) add('RB', r.ok, `${r.label} — ${r.detail}`);
  return out.concat();
}

// ---------------------------------------------------------------- docs I/O

const begin = (k) => `<!-- BEGIN GENERATED:${k} -->`;
const end = (k) => `<!-- END GENERATED:${k} -->`;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function targets() {
  const map = {};
  for (const [file, keys] of Object.entries(E.meta.targets)) (map[file] = map[file] || []).push(...keys);
  return map;
}

function replaceBlock(text, key, body) {
  const re = new RegExp(escapeRe(begin(key)) + '[\\s\\S]*?' + escapeRe(end(key)));
  if (!re.test(text)) return { text, found: false };
  return { text: text.replace(re, `${begin(key)}\n${body}\n${end(key)}`), found: true };
}

function blockState(text, key, body) {
  const m = text.match(new RegExp(escapeRe(begin(key)) + '([\\s\\S]*?)' + escapeRe(end(key))));
  if (!m) return 'missing';
  return m[1].trim() === body.trim() ? 'current' : 'stale';
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
  for (const r of rows) console.log(`${r.id.padEnd(3)}  ${r.ok ? 'PASS ' : 'FAIL '}  ${r.detail}`);
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
