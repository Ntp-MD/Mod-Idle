'use strict';

/**
 * The key-number table, computed from tools/lib/engine.js at call time.
 * Shared by dashboard.html and the wiki so neither can quote a value the math
 * does not produce. Every row names the checks.md row it comes from.
 */

const f0 = (x) => Math.round(Number(x)).toLocaleString('en-US');
const f1 = (x) => Number(x).toFixed(1);
const f2 = (x) => Number(x).toFixed(2);

function keyNumbers(eng) {
  const band = (fn) => eng.BAND_KEYS.map((b) => fn(eng.BAND[b])).join(' · ');
  return [
    { what: 'stat_c line', expr: `${eng.S.base} + ${eng.S.per_level} × (level − 1)`, value: `L1 ${eng.statAt(1)} · L100 ${eng.statAt(eng.S.level_cap)}`, row: 'engine.json stat', src: 'stat' },
    { what: 'single-stat ceiling', expr: `${eng.statAt(eng.S.level_cap)} + ${eng.S.core_flat_max}×${eng.S.item_slots}`, value: f0(eng.CEIL), row: 'engine.json · A3', src: 'stat' },
    { what: 'Physical / Magic power', expr: `(${f0(eng.CEIL)}×${eng.K.K_STR} + ${eng.M.phys_flat_main_hand}) × ${f2(1 + eng.M.phys_pct_main_hand / 100)}`, value: f0(eng.DERIVED.phys), row: 'B1', src: 'K' },
    { what: 'Max HP (Vit)', expr: `(${f0(eng.CEIL)}×${eng.K.K_VIT_HP} + ${f0(eng.LG.hp_per_level * (eng.S.level_cap - 1))}) × ${f2(1 + eng.M.hp_pct_per_item * eng.LG.hp_pct_mod_slots / 100)}`, value: f0(eng.DERIVED.hp), row: 'B2', src: 'K' },
    { what: 'mana pool ÷ regen', expr: `${f0(eng.DERIVED.mana)} ÷ ${f1(eng.DERIVED.mana_regen)}`, value: `${f1(eng.DERIVED.pool_regen_sec)} sec (intent 40)`, row: 'B5', src: 'K' },
    { what: 'accuracy ceiling', expr: `${f0(eng.CEIL)} × ${eng.K.K_DEX_ACC} × ${f2(1 + eng.M.accuracy_pct / 100)}`, value: f0(eng.DERIVED.accuracy), row: 'B12', src: 'K' },
    { what: 'drop multiplier', expr: `1 + ${f0(eng.CEIL)} × ${eng.K.K_LCK_DROP}`, value: f2(eng.DERIVED.drop_mult) + 'x', row: 'B14', src: 'K' },
    { what: 'kills/hr', expr: '3600 ÷ (group × 1 + 4) × group', value: band((b) => f0(b.kills_per_hr)), row: 'F1', src: 'loot' },
    { what: 'drops/hr', expr: 'kills × 8% × (1 + Lck×0.01)', value: band((b) => f0(b.drops_per_hr)), row: 'F3', src: 'loot' },
    { what: 'junk → stones & gold', expr: 'drops − upgrades', value: band((b) => f0(b.junk_per_hr)) + ' per hour', row: 'F5 · G2', src: 'loot' },
    { what: 'Reroll uses/hr', expr: `${f0(eng.BAND.high.junk_per_hr)} ÷ 8`, value: String(eng.STONE.reroll_uses_per_hr), row: 'F6', src: 'craft' },
    { what: 'Reroll tier stones/hr', expr: 'elite 18 + boss 12', value: String(eng.STONE.tier_stones_per_hr), row: 'F7', src: 'loot' },
    { what: 'Refine/hr · full set', expr: `30 ÷ 8 · ${eng.STONE.refine_casts_full_set} casts ÷ 3.75`, value: `3.75 · ${f1(eng.STONE.refine_hours_full_set)} hr`, row: 'F8 · E6', src: 'craft' },
    { what: 'full-set polish', expr: '100 casts ÷ 52', value: `${f2(eng.STONE.polish_hours_full_set)} hr`, row: 'F17 · E8', src: 'craft' },
    { what: 'gold per income-minute', expr: 'junk/hr ÷ 60', value: eng.BAND_KEYS.map((b) => eng.goldPerMinute(b)).join(' · '), row: 'F18 · T2', src: 'loot' },
    { what: 'full-Lck income ceiling', expr: `${f0(eng.BAND.high_full_lck.junk_per_hr)} ÷ ${f0(eng.BAND.high.junk_per_hr)}`, value: `×${f2(eng.LCK_BOUND)} (G8 · T7)`, row: 'T7', src: 'K' },
    { what: 'game length', expr: 'E1-E5 timeline checkpoints', value: `${eng.E.loot.timeline_checkpoints_hr.level_100} hr to level 100`, row: 'E5', src: 'loot' },
    { what: 'weapon DPS equality', expr: 'weapon_mult = 1.2 ÷ weapon_aspd', value: `${eng.WEAPONS.length} rows verified`, row: 'X14 · D10', src: 'weapons' },
    {
      what: 'aspd Cap Agi per weapon',
      expr: eng.WEAPONS.map((w) => `${w.name.split(' ')[0]} ${w.agi_to_cap}`).slice(0, 4).join(' · '),
      value: eng.WEAPONS.filter((w) => !w.reachable).map((w) => `${w.name.split(' ')[0]} ${w.agi_to_cap}`).join(' · ') + ' unreachable by intent',
      row: 'C3 · C4 · X13',
      src: 'weapons',
    },
  ];
}

module.exports = { keyNumbers, f0, f1, f2 };
