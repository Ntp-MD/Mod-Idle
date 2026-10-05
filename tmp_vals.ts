import * as eng from './tools/lib/engine.ts';
const e: any = eng;
const D = e.DERIVED;
const out: Record<string, any> = {
  CEIL: e.CEIL, SPLIT: e.SPLIT, FORCED_SPLIT: e.FORCED_SPLIT,
  statAt100: e.statAt(100),
  phys: D.phys, hp: D.hp, mana: D.mana, mana_regen: D.mana_regen,
  pool_regen_sec: D.pool_regen_sec, crit: D.crit, res_raw: D.res_raw, res_three: D.res_three,
  align_raw: D.align_raw, align_path: D.align_path, cdr_raw: D.cdr_raw, cdr_four: D.cdr_four,
  accuracy: D.accuracy, weight: D.weight, drop_mult: D.drop_mult,
  es_pool: D.es_pool, es_regen: D.es_regen, es_recover_sec: D.es_recover_sec,
  es_cast_hp: D.es_cast_hp, es_share_of_hp: D.es_share_of_hp,
  armour_ceil: D.armour_ceil, armour_vs_zone9_boss: D.armour_vs_zone9_boss,
  armour_vs_zone9_trash: D.armour_vs_zone9_trash,
  LCK_BOUND: e.LCK_BOUND,
  hp_per_level_total: e.LG.hp_per_level * 99,
};
const f = (x: number) => Math.round(x * 100) / 100;
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(22), typeof v === 'number' ? f(v) : v);

// DPS-by-split table, using the table's own convention: power=(Str*5+80)*1.16, times=(secondary)/100,
// DPS = power * times * 0.8978 (hit .7982 x crit 1.125 rounded)
const rows = [
  ['Str 13', 535, 210, 0], ['Str 12 / Dex 1', 510, 235, 1], ['Str 11 / Agi 2', 485, 260, 1],
  ['Str 9 / Agi 4', 435, 310, 1], ['Str 7 / Agi 6', 385, 360, 1], ['Agi 13', 210, 535, 1],
];
console.log('\nDPS split table (power/times/dps):');
for (const [label, a, b] of rows as any[]) {
  const power = Math.round((a * 5 + 80) * 1.16);
  const times = b / 100;
  const dps = Math.round(power * times * 0.8978);
  console.log(label.padEnd(16), 'Str', a, 'Agi', b, '->', power, times.toFixed(2), dps);
}
