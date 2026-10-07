/**
 * The key-number table, computed from tools/lib/engine.ts at call time.
 * Shared by dashboard.html and the wiki so neither can quote a value the math
 * does not produce. Every row names the checks.md row it comes from.
 */

const f0 = (x: any): string => Math.round(Number(x)).toLocaleString('en-US');
const f1 = (x: any): string => Number(x).toFixed(1);
const f2 = (x: any): string => Number(x).toFixed(2);

function keyNumbers(eng: any): any[] {
  const band = (fn: (b: any) => string): string => eng.BAND_KEYS.map((b: string) => fn(eng.BAND[b])).join(' · ');
  return [
    { what: 'stat_c line', expr: `${eng.S.base} + ${eng.S.point_value} × (points ÷ 7)`, value: `L1 ${eng.statAt(1)} · L${eng.S.level_cap} ${eng.statAt(eng.S.level_cap)}`, row: 'engine.json stat', src: 'stat' },
    { what: 'single-stat ceiling (reference build)', expr: `${eng.statAt(eng.S.level_cap)} + ${eng.S.core_flat_max}×${eng.S.item_slots}`, value: f0(eng.CEIL), row: 'engine.json · A3', src: 'stat' },
    { what: 'focused stat ceiling (all points + items on one stat)', expr: `${eng.S.base} + ${f0(eng.pointsAt(eng.S.level_cap))}×${eng.S.point_value} + ${eng.S.core_flat_max}×${eng.S.item_slots}`, value: f0(eng.FOCUSED_CEIL), row: 'engine.json · ', src: 'stat' },
    { what: 'Physical / Magic power', expr: `(${f0(eng.CEIL)}×${eng.K.K_STR} + ${eng.M.phys_flat_main_hand}) × ${f2(1 + eng.M.phys_pct_main_hand / 100)}`, value: f0(eng.DERIVED.phys), row: 'B1', src: 'K' },
    { what: 'Max HP (Vit)', expr: `(${f0(eng.CEIL)}×${eng.K.K_VIT_HP} + ${f0(eng.LG.hp_per_level * (eng.S.level_cap - 1))}) × ${f2(1 + eng.M.hp_pct_per_item * eng.LG.hp_pct_mod_slots / 100)}`, value: f0(eng.DERIVED.hp), row: 'B2', src: 'K' },
    { what: 'mana pool ÷ regen', expr: `${f0(eng.DERIVED.mana)} ÷ ${f1(eng.DERIVED.mana_regen)}`, value: `${f1(eng.DERIVED.pool_regen_sec)} sec (intent 40)`, row: 'B5', src: 'K' },
    { what: 'accuracy ceiling', expr: `${f0(eng.CEIL)} × ${eng.K.K_DEX_ACC} × ${f2(1 + eng.M.accuracy_pct / 100)}`, value: f0(eng.DERIVED.accuracy), row: 'B12', src: 'K' },
    { what: 'drop multiplier', expr: `1 + ${f0(eng.CEIL)} × ${eng.K.K_LCK_DROP}`, value: f2(eng.DERIVED.drop_mult) + 'x', row: 'B14', src: 'K' },
    { what: 'kills per clear cycle', expr: 'the group a cycle spawns', value: band((b: any) => String(b.group_mobs)), row: 'F1', src: 'loot' },
    { what: 'drops per kill', expr: '8% × (1 + Lck×0.01)', value: band((b: any) => (b.drop_chance_pct / 100).toFixed(4)), row: 'F2', src: 'loot' },
    { what: 'junk per kill (gold)', expr: 'drops − upgrades, per kill', value: band((b: any) => (b.junk_per_hr / b.kills_derived).toFixed(4)), row: 'F5 · G2', src: 'loot' },
    { what: 'Reroll uses per kill', expr: `${f0(eng.BAND.high.junk_per_hr)} ÷ 8, per kill`, value: (eng.STONE.reroll_uses_per_hr / eng.BAND.high.kills_derived).toFixed(4), row: 'F6', src: 'craft' },
    { what: 'Reroll tier stones per kill', expr: 'elite + boss, per kill', value: (eng.STONE.tier_stones_per_hr / eng.BAND.high.kills_derived).toFixed(4), row: 'F7', src: 'loot' },
    { what: 'Refines per kill · full set', expr: `F7 ÷ 8 · ${eng.STONE.refine_casts_full_set} casts`, value: `${(eng.STONE.refines_per_hr / eng.BAND.high.kills_derived).toFixed(4)} per kill · ${eng.STONE.refine_casts_full_set} casts`, row: 'F8 · E6', src: 'craft' },
    { what: 'full-set polish', expr: `${eng.E.craft.polish_casts_per_full_set} casts at ${eng.E.craft.reroll_value_stones_per_use} stones`, value: `${eng.E.craft.polish_casts_per_full_set * eng.E.craft.reroll_value_stones_per_use} Reroll value stones`, row: 'F17 · E8', src: 'craft' },
    { what: 'gold per kill (the price unit)', expr: 'junk per kill', value: eng.BAND_KEYS.map((b: string) => (eng.BAND[b].junk_per_hr / eng.BAND[b].kills_derived).toFixed(4)).join(' · '), row: 'F18 · T2', src: 'loot' },
    { what: 'full-Lck income ceiling', expr: `${(eng.BAND.high_full_lck.junk_per_hr / eng.BAND.high_full_lck.kills_derived).toFixed(4)} ÷ ${(eng.BAND.high.junk_per_hr / eng.BAND.high.kills_derived).toFixed(4)}`, value: `×${f2(eng.LCK_BOUND)} (G8 · T7)`, row: 'T7', src: 'K' },
    { what: 'game length', expr: 'E1-E5 progression checkpoints', value: `${eng.CHECKPOINTS_KILLS.level_100.toLocaleString('en-US')} kills to level 100`, row: 'E5', src: 'loot' },
    { what: 'weapon DPS equality', expr: 'weapon_mult = 1.2 ÷ weapon_aspd', value: `${eng.WEAPONS.length} rows verified`, row: 'X14 · D10', src: 'weapons' },
    {
      what: 'aspd Cap Agi per weapon',
      expr: eng.WEAPONS.map((w: any) => `${w.name.split(' ')[0]} ${w.agi_to_cap}`).slice(0, 4).join(' · '),
      value: eng.WEAPONS.filter((w: any) => !w.reachable).map((w: any) => `${w.name.split(' ')[0]} ${w.agi_to_cap}`).join(' · ') + ' unreachable by intent',
      row: 'C3 · C4 · X13',
      src: 'weapons',
    },
  ];
}

export { keyNumbers, f0, f1, f2 };
