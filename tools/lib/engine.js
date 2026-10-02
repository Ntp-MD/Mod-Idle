'use strict';

/**
 * Shared engine math — the single source for stat ceilings, derived caps,
 * the loot model and craft throughput. Read by tools/check.js (groups A · B · C · F)
 * and tools/town.js (gold per minute · kill thresholds · supply).
 *
 * Nothing here is a doc number copied by hand: every value is computed from
 * tools/data/engine.json, and tools/check.js compares the result against the
 * numbers the docs publish.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const E = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'engine.json'), 'utf8'));

const S = E.stat;
const K = E.K;
const M = E.mod_max;
const LG = E.level_gain;
const L = E.loot;
const C = E.craft;
const TS = E.town_shared;

const BANDS = ['low', 'mid', 'high'];
const BAND_KEYS = ['low', 'mid', 'high', 'high_full_lck'];

const statAt = (level) => S.base + S.per_level * (level - 1);
const ceilStat = (items, split) => {
  const n = split ? items / 2 : items;
  return (statAt(S.level_cap) + S.core_flat_max * n) * (1 + (S.core_pct_max * n) / 100);
};

const CEIL = Math.round(ceilStat(S.item_slots, false) * 100) / 100;   // 816
const SPLIT = Math.round(ceilStat(S.item_slots, true) * 10) / 10;      // 468
const FORCED_SPLIT = (statAt(S.level_cap) + S.core_flat_max * S.item_slots) * 1; // 510

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const fmt = (x, d = 0) => (d ? Number(x).toFixed(d) : Math.round(x)).toLocaleString('en-US', d ? { minimumFractionDigits: d, maximumFractionDigits: d } : undefined);

// ---- derived ceilings (group B)

const DERIVED = {
  phys: (CEIL * K.K_STR + M.phys_flat_main_hand) * (1 + M.phys_pct_main_hand / 100),
  hp: (CEIL * K.K_VIT_HP + LG.hp_per_level * (S.level_cap - 1)) * (1 + M.hp_pct_per_item * LG.hp_pct_mod_slots / 100),
  mana: CEIL * K.K_INT_MP + LG.mp_per_level * (S.level_cap - 1),
  mana_regen: CEIL * K.K_INT_MREGEN,
  crit: CEIL * K.K_LCK_CRIT + M.crit_chance_main_hand,
  res_raw: CEIL * K.K_VIT_RES,
  res_three: CEIL * K.K_VIT_RES * (1 + (M.res_pct_per_item * LG.res_mod_items) / 100),
  align_raw: CEIL * K.K_DEX_ALIGN,
  align_path: CEIL * K.K_DEX_ALIGN + M.align_pct_per_item * 2,
  cdr_raw: CEIL * K.K_WIS_CDR,
  cdr_four: CEIL * K.K_WIS_CDR * (1 + (M.cdr_pct_per_item * LG.cdr_mod_items + LG.cdr_buff_pct) / 100),
  accuracy: CEIL * K.K_DEX_ACC * (1 + M.accuracy_pct / 100),
  weight: CEIL * K.K_STR_WEIGHT,
  drop_mult: 1 + CEIL * K.K_LCK_DROP,
};
DERIVED.pool_regen_sec = DERIVED.mana / DERIVED.mana_regen;
DERIVED.hit_chance = DERIVED.accuracy / (DERIVED.accuracy + K.mob_evasion_per_level * S.level_cap);

// ---- weapon aspd: Agi needed to reach the Cap with the max aspd Mod

const agiForCap = (weaponAspd) =>
  Math.round((E.caps.aspd / weaponAspd - 100 - M.aspd_pct) / K.K_AGI_ASPD + S.base);

const WEAPONS = E.weapons.map((w) => ({
  ...w,
  weapon_mult: r2(1.2 / w.weapon_aspd),
  agi_to_cap: agiForCap(w.weapon_aspd),
  reachable: agiForCap(w.weapon_aspd) <= CEIL,
}));

// ---- loot model (group F)

const lckOf = (band) => (L.bands[band].lck_level === 'ceiling' ? CEIL : statAt(L.bands[band].lck_level));
const dropChance = (band) => L.base_drop_chance * (1 + lckOf(band) * K.K_LCK_DROP);
const killsDerived = (band) => (3600 / (L.bands[band].group_mobs * L.ttk_per_mob_sec + L.group_spawn_sec)) * L.bands[band].group_mobs;

const BAND = {};
for (const b of BAND_KEYS) {
  const drops = Math.round(L.bands[b].kills_per_hr_published * dropChance(b));
  BAND[b] = {
    kills_per_hr: L.bands[b].kills_per_hr_published,
    kills_derived: Math.round(killsDerived(b)),
    group_mobs: L.bands[b].group_mobs,
    lck: Math.round(lckOf(b)),
    lck_mult: r2(1 + lckOf(b) * K.K_LCK_DROP),
    drop_chance_pct: r1(dropChance(b) * 100),
    drops_per_hr: drops,
    upgrades_per_hr: L.bands[b].upgrades_per_hr,
    junk_per_hr: drops - L.bands[b].upgrades_per_hr,
    band_hours: b === 'high_full_lck' ? 0 : undefined,
  };
}
BAND.low.band_hours = L.timeline_checkpoints_hr.level_30;
BAND.mid.band_hours = r1(L.timeline_checkpoints_hr.level_60 - L.timeline_checkpoints_hr.level_30);
BAND.high.band_hours = r1(L.timeline_checkpoints_hr.level_90 - L.timeline_checkpoints_hr.level_60);

const goldPerMinute = (b) => Math.round((BAND[b].junk_per_hr / 60) * Math.pow(10, TS.round_rate_to_decimals)) / Math.pow(10, TS.round_rate_to_decimals);

const STONE = {
  reroll_uses_per_hr: Math.round(BAND.high.junk_per_hr / C.reroll_value_stones_per_use),
  tier_stones_per_hr: Math.round(L.bands.high.kills_per_hr_published * L.elite_spawn_chance * L.elite_tier_stones) + L.boss_per_hour * L.boss_tier_stones,
};
STONE.refines_per_hr = r2(STONE.tier_stones_per_hr / C.refine_stones_per_use);
STONE.refine_casts_full_set = Math.round(C.ascend_items_per_set * C.refine_slots_per_item * C.refine_steps);
STONE.refine_hours_full_set = r1(STONE.refine_casts_full_set / STONE.refines_per_hr);
STONE.polish_hours_full_set = r2(C.polish_casts_per_full_set / STONE.reroll_uses_per_hr);

const LCK_BOUND = r2(BAND.high_full_lck.junk_per_hr / BAND.high.junk_per_hr);

// ---- what tools/town.js needs, so no town number is a copy of a loot number

function engineForTown(townEngine) {
  const bands = {};
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
    towns_gold_rate_multiplier_bound: LCK_BOUND,
    gold_per_minute: { low: goldPerMinute('low'), mid: goldPerMinute('mid'), high: goldPerMinute('high'), high_full_lck: goldPerMinute('high_full_lck') },
  });
}

// ---- doc read-back: the numbers the prose files publish must equal the math

const GENERIC_RULES = [
  { file: 'loot.md', label: 'loot.md F5 junk line', re: /\|\s*Reroll value stone\s*\|\s*([\d,]+)\s*\(/, pick: 1, expect: BAND.high.junk_per_hr },
  { file: 'crafting.md', label: 'crafting.md junk/hour → Reroll uses', re: /\((\d+)\/hour → ~(\d+) uses\/hour\)/, pick: [1, 2], expect: [BAND.high.junk_per_hr, STONE.reroll_uses_per_hr] },
  { file: 'crafting.md', label: 'crafting.md tier stones → Refines/hour', re: /\((\d+)\/hour → ~([\d.]+) Refines\/hour\)/, pick: [1, 2], expect: [STONE.tier_stones_per_hr, STONE.refines_per_hr] },
  { file: 'crafting.md', label: 'crafting.md Refine full-set hours', re: /mods × 2 steps = (\d+) casts\) ≈ ([\d.]+) hours/, pick: [1, 2], expect: [STONE.refine_casts_full_set, STONE.refine_hours_full_set] },
  { file: 'formula.md', label: 'formula.md single-stat ceiling', re: /single-stat ceiling \| \*\*([\d,]+)\*\*/, pick: 1, expect: Math.round(CEIL) },
  { file: 'formula.md', label: 'formula.md stat at level 100 no gear', re: /Level 100 \(no gear\)[^|]*\|[^|]*every stat = (\d+)/, pick: 1, expect: statAt(100) },
  { file: 'formula.md', label: 'formula.md Str 12 physical power', re: /Str 12-item build \| Physical power ([\d,]+)/, pick: 1, expect: Math.round(DERIVED.phys) },
  { file: 'formula.md', label: 'formula.md K_AGI_ASPD', re: /\| K_AGI_ASPD \| ([\d.]+)/, pick: 1, expect: K.K_AGI_ASPD },
  { file: 'formula.md', label: 'formula.md K_INT_MREGEN', re: /\| K_INT_MREGEN \| \*\*([\d.]+)\*\*/, pick: 1, expect: K.K_INT_MREGEN },
  { file: 'formula.md', label: 'formula.md K_dodge', re: /\| K_dodge \| \*\*(\d+)\*\*/, pick: 1, expect: K.K_dodge },
  { file: 'formula-utility.md', label: 'formula-utility.md dagger Cap Agi', re: /\| dagger \| ([\d.]+) \| [\d.]+ \| (\d+) \|/, pick: 2, expect: WEAPONS[0].agi_to_cap },
  { file: 'formula-utility.md', label: 'formula-utility.md sword Cap Agi', re: /\| one-handed sword \/ axe \| ([\d.]+) \| [\d.]+ \| (\d+) \|/, pick: 2, expect: WEAPONS[1].agi_to_cap },
  { file: 'formula-defense.md', label: 'formula-defense.md CDR ceiling × 4 items', re: /4 items required = `24\.5 × 2\.15 = ([\d.]+)`/, pick: 1, expect: r1(DERIVED.cdr_four) },
  { file: 'formula-utility.md', label: 'formula-utility.md accuracy ceiling', re: /Mod max 25 on main hand = \*\*([\d,]+)\*\*/, pick: 1, expect: Math.round(DERIVED.accuracy) },
  { file: 'formula-utility.md', label: 'formula-utility.md weight capacity', re: /Str 816 carries ([\d,]+)/, pick: 1, expect: Math.round(DERIVED.weight) },
  { file: 'formula-utility.md', label: 'formula-utility.md drop multiplier', re: /Lck 816 gives ([\d.]+)x/, pick: 1, expect: r1(DERIVED.drop_mult) },
  { file: 'formula-defense.md', label: 'formula-defense.md level_gain_hp', re: /level_gain_hp` = 40 × \(level − 1\) → at level 100 gives ([\d,]+)/, pick: 1, expect: LG.hp_per_level * (S.level_cap - 1) },
  { file: 'formula-defense.md', label: 'formula-defense.md pool ÷ regen', re: /pool ÷ regen\s*=\s*([\d,]+) ÷ (\d+) = ([\d.]+) seconds/, pick: [1, 3], expect: [Math.round(DERIVED.mana), r1(DERIVED.pool_regen_sec)] },
  { file: 'core-stats.md', label: 'core-stats.md dodge Cap', re: /Dodge - % Cap (\d+)/, pick: 1, expect: E.caps.dodge_chance },
  { file: 'core-stats.md', label: 'core-stats.md aspd Cap', re: /Cap (\d+) \(= 3 hits\/sec\)/, pick: 1, expect: E.caps.aspd },
  { file: 'core-stats.md', label: 'core-stats.md res Cap', re: /Cap (\d+) per Element/, pick: 1, expect: E.caps.elem_res },
  { file: 'core-stats.md', label: 'core-stats.md perfect dodge Cap', re: /Perfect dodge - % Cap (\d+)/, pick: 1, expect: E.caps.perfect_dodge },
  { file: 'checks.md', label: 'checks.md F2 L90 drop chance', re: /([\d.]+)% \(L90\)/, pick: 1, expect: BAND.high.drop_chance_pct },
];

function readDoc(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
const cellNum = (s) => Number(String(s).replace(/[*,\s]/g, '').match(/[\d.]+/)?.[0] ?? NaN);

/** loot.md section 2 is a table, so it is read by row, not by regex. */
function readLootTable() {
  const text = readDoc('loot.md');
  const out = [];
  const rows = { low: 'low (1-30)', mid: 'mid (31-60)', high: 'high (61-90)', high_full_lck: 'high + full Lck' };
  for (const [band, key] of Object.entries(rows)) {
    const line = text.split(/\r?\n/).find((l) => l.startsWith('| ' + key));
    if (!line) { out.push({ ok: false, label: `loot.md section 2 ${band} row`, detail: 'row not found' }); continue; }
    const cells = line.split('|').map((c) => c.trim());
    const checks = [
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

function runReadBack() {
  const out = [];
  for (const rule of GENERIC_RULES) {
    let text;
    try { text = readDoc(rule.file); } catch (e) { out.push({ ok: false, label: rule.file, detail: e.message }); continue; }
    const m = text.match(rule.re);
    if (!m) { out.push({ ok: false, label: rule.label, detail: `pattern not found in ${rule.file}` }); continue; }
    const picks = Array.isArray(rule.pick) ? rule.pick : [rule.pick];
    const expects = Array.isArray(rule.expect) ? rule.expect : [rule.expect];
    picks.forEach((p, i) => {
      const got = cellNum(m[p]);
      out.push({ ok: got === expects[i], label: `${rule.label} [${i}]`, detail: `doc ${got} · engine ${expects[i]}` });
    });
  }
  return out.concat(readLootTable());
}

module.exports = {
  ROOT, E, S, K, M, LG, L, C, TS, BANDS, BAND_KEYS, BAND, CEIL, SPLIT, FORCED_SPLIT,
  DERIVED, WEAPONS, STONE, LCK_BOUND, statAt, goldPerMinute, agiForCap,
  engineForTown, runReadBack, GENERIC_RULES, fmt, r1, r2,
};
