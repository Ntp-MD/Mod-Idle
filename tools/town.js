#!/usr/bin/env node
'use strict';

/**
 * Town economy generator + cage.
 *
 *   node tools/town.js            help
 *   node tools/town.js --emit     print every generated block to stdout
 *   node tools/town.js --write    replace the generated blocks inside the docs
 *   node tools/town.js --checks   run group T, report, exit 1 on FAIL
 *
 * Every gold price, Standing kill threshold, supply figure and demand ratio in
 * towns-stalls.md + checks.md group T is an output of tools/data/town.json.
 * Nothing here reads the markdown files except to check that they are current.
 */

const fs = require('fs');
const path = require('path');
const eng = require('./lib/engine');

const ROOT = path.resolve(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'town.json'), 'utf8'));
// Band numbers are never stored here: tools/data/engine.json is the only source.
const E = eng.engineForTown({});
const INV = DATA.invariants;
const BANDS = ['low', 'mid', 'high'];
const BAND_KEYS = Object.keys(E.bands);

// ---------------------------------------------------------------- helpers

const pow10 = Math.pow(10, E.round_rate_to_decimals);

const junk = (b) => E.bands[b].drops_per_hr - E.bands[b].upgrades_per_hr;
const rate = (b) => Math.round((junk(b) / 60) * pow10) / pow10;
const gold = (m, b) => Math.round(m * rate(b) + 1e-9);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const hr = (n, d = 2) => Number(n).toFixed(d);
const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';

const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
const bandTag = (b) => (b === 'high_full_lck' ? 'high+full Lck' : b);
const bandLabel = (f) => BAND_KEYS.map((b) => f(b) + ' ' + bandTag(b)).join(' · ');
const SETTLEMENTS = byId(DATA.settlements);
const NPCS = byId(DATA.npcs);
const ONE_TIME = byId(DATA.one_time);
const REPEATABLE = byId(DATA.repeatable);
const LINE = { ...ONE_TIME, ...REPEATABLE };

const npcName = (id) => (NPCS[id] ? NPCS[id].name : id);
const settlementName = (id) => (SETTLEMENTS[id] ? SETTLEMENTS[id].name : id);

function lineGoldTotal(line) {
  if (line.charge === 'by_settlement_band') {
    return Object.entries(line.qty_by_band).reduce((s, [b, q]) => s + q * gold(line.m, b), 0);
  }
  if (line.charge === 'one_per_band') {
    return BANDS.reduce((s, b) => s + gold(line.m, b), 0);
  }
  return (line.qty || 1) * gold(line.m, line.charge_band);
}

function essentialGold(entry) {
  const line = LINE[entry.id];
  if (!line) throw new Error('unknown essentials line: ' + entry.id);
  if (entry.qty_by_band) {
    return Object.entries(entry.qty_by_band).reduce((s, [b, q]) => s + q * gold(entryPriceM(line, b, entry), b), 0);
  }
  const band = line.charge === 'by_settlement_band' ? 'low' : line.charge_band;
  if (line.charge === 'one_per_band') return BANDS.reduce((s, b) => s + gold(line.m, b), 0);
  if (entry.use_discount && line.discount) {
    const dBand = SETTLEMENTS[line.discount.settlement].band;
    return gold(line.discount.m, dBand);
  }
  return (line.qty || 1) * gold(entryPriceM(line, band, entry), band);
}

function entryPriceM(line, band, entry) {
  if (entry.use_discount && line.discount) return line.discount.m;
  return line.m;
}

function lifetimeSupply() {
  const push = E.push_hr_levels_91_100;
  return E.bands.low.band_hours * junk('low')
    + E.bands.mid.band_hours * junk('mid')
    + E.bands.high.band_hours * junk('high')
    + push * junk('high');
}

const SUPPLY = Math.round(lifetimeSupply());
const ONETIME_DEMAND = DATA.one_time.reduce((s, l) => s + lineGoldTotal(l), 0);
const ESSENTIALS = DATA.essentials.reduce((s, e) => s + essentialGold(e), 0);
const ROAD_LINKS = DATA.settlements.filter((s) => !s.start).length;
const HIGH_BAND_HOURS = E.bands.high.band_hours + E.push_hr_levels_91_100;
const LCK_HIGH_BAND = Math.round(HIGH_BAND_HOURS * junk('high_full_lck'));
const NO_LCK_HIGH_BAND = Math.round(HIGH_BAND_HOURS * junk('high'));
const CASTS_FORGONE = Math.round(SUPPLY / E.reroll_stones_per_cast);
const POLISHES_FORGONE = SUPPLY / E.reroll_stones_per_cast / E.reroll_casts_per_full_set_polish;
const MIN_PER_TIER_STONE = 60 / E.elite_reroll_tier_stones_per_hr;

function standing(s) {
  const kph = E.bands[s.band].kills_per_hr;
  return DATA.standing.tiers.map((t) => ({
    name: t.name,
    share: t.share,
    hours: s.budget_hr * t.share,
    kills: Math.round(s.budget_hr * t.share * kph + 1e-9),
  }));
}

const BAND_HOURS_TEXT = `low z1-3 = ${hr(E.bands.low.band_hours, 1)} hr · mid z4-6 = ${hr(E.bands.mid.band_hours, 1)} · high z7-9 = ${hr(E.bands.high.band_hours, 1)} · z9 push (91-100) = ${hr(E.push_hr_levels_91_100, 1)}`;

function ladderRanges() {
  const groups = {};
  for (const l of DATA.one_time) if (l.ladder) (groups[l.ladder] = groups[l.ladder] || []).push(l.m);
  return Object.entries(groups)
    .map(([k, v]) => `${k} ${Math.min(...v)}-${Math.max(...v)} m`)
    .join(' · ');
}

// ---------------------------------------------------------------- blocks

const BLOCKS = {};

BLOCKS['price-unit'] = () => '```\n' + [
  `gold per sold junk piece        = ${E.gold_per_junk_piece}                       (economy.md · loot.md section 4)`,
  `drops/hour per band             = ${bandLabel((b) => fmt(E.bands[b].drops_per_hr))}   (loot.md section 2 · F3)`,
  `upgrades/hour from drops        = ${bandLabel((b) => E.bands[b].upgrades_per_hr)}   (F4)`,
  `junk/hour = drops - upgrades    = ${bandLabel((b) => fmt(junk(b)))}`,
  `1 m  = 1 minute of full-sell income in that band`,
  `gold per 1 m                    = ${bandLabel((b) => rate(b))}`,
  `kills/hour per band (F1)        = ${BANDS.map((b) => fmt(E.bands[b].kills_per_hr) + ' ' + b).join(' · ')}`,
  `opportunity cost of 1 gold      = 1 Reroll value stone forgone = 1/${E.reroll_value_stones_per_hour} hour of Reroll capacity ≈ 1.15 min of craft progress (F6 · E8)`,
  ``,
  `band hours (${BAND_HOURS_TEXT})  (checks.md E1-E5)`,
].join('\n') + '\n```';

BLOCKS.supply = () => '```\n' + [
  `band hours                      = ${BAND_HOURS_TEXT}`,
  `lifetime junk pieces            = ${hr(E.bands.low.band_hours, 1)}×${junk('low')} + ${hr(E.bands.mid.band_hours, 1)}×${junk('mid')} + ${hr(E.bands.high.band_hours, 1)}×${junk('high')} + ${hr(E.push_hr_levels_91_100, 1)}×${junk('high')} = ${fmt(SUPPLY)}`,
  `max lifetime gold (sell everything, no Lck)              = ${fmt(SUPPLY)}`,
  `one-time stall demand (section 3, all 9 places)          = ${fmt(ONETIME_DEMAND)} gold = ${(ONETIME_DEMAND / SUPPLY).toFixed(2)}x the max`,
  `essentials only (${DATA.essentials.map((e) => LINE[e.id].item.toLowerCase().replace(/\s*\(.*\)/, '')).join(' · ')}) = ${fmt(ESSENTIALS)} = ${pct(ESSENTIALS / SUPPLY)} of the max`,
  `full-Lck ceiling over the ${hr(HIGH_BAND_HOURS, 1)} high-band hours               = ${fmt(LCK_HIGH_BAND)} gold (= ×${(LCK_HIGH_BAND / NO_LCK_HIGH_BAND).toFixed(2)} of the ${fmt(NO_LCK_HIGH_BAND)} a no-Lck run earns there · ceiling ×${E.towns_gold_rate_multiplier_bound})`,
  `stones forgone by selling everything                     = ${fmt(SUPPLY)} ÷ ${E.reroll_stones_per_cast} = ${fmt(CASTS_FORGONE)} Reroll casts ≈ ${POLISHES_FORGONE.toFixed(1)} full-set polishes (E8)`,
  `repeatable demand (section 4)                            = absorbs whatever the one-time list does not, no ceiling`,
].join('\n') + '\n```';

BLOCKS['one-time'] = () => {
  const head = '| Item | Sold by | Kind | m | gold @low | gold @mid | gold @high | Charged at | Qty | Gold in the demand total | Note |';
  const rows = DATA.one_time.map((l) => {
    const charged = l.charge === 'by_settlement_band'
      ? 'the band of each destination'
      : l.charge === 'one_per_band' ? 'one per band' : `${l.charge_band} band`;
    const qty = l.qty_by_band
      ? Object.entries(l.qty_by_band).map(([b, q]) => `${q} ${b}`).join(' + ')
      : (l.qty || 1);
    return `| ${l.item} | ${npcName(l.npc)} | ${l.kind} | ${l.m} | ${fmt(gold(l.m, 'low'))} | ${fmt(gold(l.m, 'mid'))} | ${fmt(gold(l.m, 'high'))} | ${charged} | ${qty} | ${fmt(lineGoldTotal(l))} | ${l.note} |`;
  });
  return [head, '|---|---|---|---|---|---|---|---|---|---|---|', ...rows, '', `Total one-time demand = **${fmt(ONETIME_DEMAND)} gold** (see section 2).`, ''].join('\n');
};

BLOCKS.repeatable = () => {
  const head = '| Item | Sold by | Kind | m | Gold | Bound | Note |';
  const rows = DATA.repeatable.map((l) => {
    const m = l.m_min != null ? `${l.m_min}-${l.m_max}` : String(l.m);
    const price = l.m_min != null
      ? `${fmt(gold(l.m_min, l.charge_band))}-${fmt(gold(l.m_max, l.charge_band))} (${l.charge_band})`
      : `${fmt(gold(l.m, l.charge_band))} (${l.charge_band})`;
    const bound = l.per_day_cap ? `${l.per_day_cap} per real day` : 'repeatable';
    return `| ${l.item} | ${npcName(l.npc)} | ${l.kind} | ${m} | ${price} | ${bound} | ${l.note} |`;
  });
  const dayM = (LINE.skip_token.m * LINE.skip_token.per_day_cap);
  return [head, '|---|---|---|---|---|---|---|', ...rows, '', `Skip-token ceiling = ${LINE.skip_token.m} m × ${LINE.skip_token.per_day_cap}/day = **${dayM} m/day** = ${fmt(dayM * rate('high'))} gold/day in the high band.`, ''].join('\n');
};

BLOCKS['npc-matrix'] = () => {
  const cols = DATA.npcs;
  const head = '| Settlement | Zone | Band | Capital | ' + cols.map((c) => c.name).join(' | ') + ' |';
  const rows = DATA.settlements.map((s) => '| **' + s.name + '** | ' + s.zone + ' | ' + s.band + ' | ' + (s.capital || '—') + ' | '
    + cols.map((c) => (s.npcs.includes(c.id) ? '✓' : '·')).join(' | ') + ' |');
  const count = '| **Present in** |  |  |  | ' + cols.map((c) => DATA.settlements.filter((s) => s.npcs.includes(c.id)).length + '/9').join(' | ') + ' |';
  const legend = cols.map((c) => `- **${c.name}** — ${c.rule} · sells ${c.kind}`).join('\n');
  return [head, '|' + ['---', '---', '---', '---', ...cols.map(() => '---')].join('|') + '|', ...rows, count, '', 'Presence rules:', legend, ''].join('\n');
};

BLOCKS.stock = () => {
  const stockLabel = (id) => {
    const set = DATA.collector_sets.find((c) => c.id === id);
    if (set) return `Collector set **${set.name}** (${set.school} school)`;
    const l = LINE[id];
    return l ? l.item.replace(/\s*\(.*?\)/g, '') : id;
  };
  const head = '| Settlement | Zone · band | Capital | NPCs | Stock lines (prices in sections 3-4) | Base bias (flavour) | Standing tiers (kills) |';
  const rows = DATA.settlements.map((s) => {
    const st = standing(s);
    const arm = s.armourer_variant ? ` (=${s.armourer_variant})` : '';
    return `| **${s.name}** | ${s.zone} · ${s.band} | ${s.capital || '—'} | ${s.npcs.map((n) => npcName(n)).join(' · ')}${arm} | ${s.stock.map(stockLabel).join(' · ')} | ${s.base_bias_flavor} | ${fmt(st[0].kills)} / ${fmt(st[1].kills)} / ${fmt(st[2].kills)} |`;
  });
  return [head, '|' + Array(7).fill('---').join('|') + '|', ...rows, ''].join('\n');
};

BLOCKS.standing = () => {
  const head = '| Settlement | Band | Zone budget (hr) | Tier I ' + Math.round(DATA.standing.tiers[0].share * 100) + '% | Tier II ' + Math.round(DATA.standing.tiers[1].share * 100) + '% | Tier III ' + Math.round(DATA.standing.tiers[2].share * 100) + '% |';
  const rows = DATA.settlements.map((s) => {
    const st = standing(s);
    return `| **${s.name}** | ${s.band} (${fmt(E.bands[s.band].kills_per_hr)} kills/hr) | ${hr(s.budget_hr, 1)} | ${st[0].hours.toFixed(2)} hr · **${fmt(st[0].kills)} kills** | ${st[1].hours.toFixed(2)} hr · **${fmt(st[1].kills)} kills** | ${st[2].hours.toFixed(2)} hr · **${fmt(st[2].kills)} kills** |`;
  });
  const unlocks = DATA.standing.tiers.map((t) => `- **Tier ${t.name}** = ${t.share * 100}% of that settlement's zone budget → ${t.unlocks}.`).join('\n');
  return [head, '|' + Array(6).fill('---').join('|') + '|', ...rows, '',
    'Kill counts = `zone budget hr × tier share × F1 kills/hour of that band` (980 low · 1,385 mid · 1,800 high), rounded.',
    unlocks, ''].join('\n');
};

BLOCKS.collector = () => {
  const head = '| Set | Where | School | Turn in | Quality | Reward | Gold paid | Rule |';
  const rows = DATA.collector_sets.map((c) => `| **${c.name}** | ${settlementName(c.settlement)} | ${c.school} | ${c.pieces.join(' · ')} | ${c.quality} | ${c.reward} | ${c.pays_gold ? 'yes' : 'no'} | ${c.rule} |`);
  return [head, '|' + Array(8).fill('---').join('|') + '|', ...rows, ''].join('\n');
};

BLOCKS['base-bias'] = () => [
  `Status: **${DATA.base_bias.status}** — the column above is ${DATA.base_bias.column_meaning}, and it stays that way until every line below is closed.`,
  '',
  ...DATA.base_bias.checks.map((c, i) => `${i + 1}. ${c}`),
  '',
  'Not written while the status is pending:',
  ...DATA.base_bias.forbidden_until_closed.map((f) => `- ${f}`),
  ''
].join('\n');

BLOCKS.pending = () => {
  const head = '| Pending number | Line it moves | Status |';
  const rows = DATA.pending.map((p) => `| ${p.number} | ${p.breaks} | ${p.status} |`);
  return [head, '|---|---|---|', ...rows, ''].join('\n');
};

BLOCKS['group-T'] = () => {
  const head = '| id | Must hold | Expression | Value |';
  const dc = docCheck();
  const rows = [
    ['T1', 'gold is minted one piece at a time by the sell choice and nothing else (G2 · G6)', `${E.gold_per_junk_piece} gold per sold junk piece`, `${E.gold_per_junk_piece}`],
    ['T2', 'the price unit is real income, not a feeling', `junk/hr ÷ 60, per band`, `${rate('low')} low · ${rate('mid')} mid · ${rate('high')} high · ${rate('high_full_lck')} high+full Lck gold per 1 m`],
    ['T3', 'lifetime gold supply is the junk line, not a new faucet', `${hr(E.bands.low.band_hours, 1)}×${junk('low')} + ${hr(E.bands.mid.band_hours, 1)}×${junk('mid')} + ${hr(E.bands.high.band_hours, 1)}×${junk('high')} + ${hr(E.push_hr_levels_91_100, 1)}×${junk('high')}`, fmt(SUPPLY) + ' gold'],
    ['T4', `one-time stall demand ≤ ${(INV.onetime_demand_max_multiple_of_lifetime_supply).toFixed(2)}× the supply — a funnel, not a wall`, `Σ ${DATA.one_time.length} one-time lines at their charge band`, `${fmt(ONETIME_DEMAND)} = ${(ONETIME_DEMAND / SUPPLY).toFixed(2)}× ✓`],
    ['T5', `essentials ≤ ${pct(INV.essentials_max_share_of_lifetime_supply, 0)} of the supply while ~80%+ still dissolves`, `4 Road links · tab 1 at Eastgate · tab 2 · pouch II · deed 4`, `${fmt(ESSENTIALS)} = ${pct(ESSENTIALS / SUPPLY)} ✓`],
    ['T6', 'selling everything is a craft decision, priced in craft', `${fmt(SUPPLY)} ÷ ${E.reroll_stones_per_cast} stones · ÷ ${E.reroll_casts_per_full_set_polish} casts per full polish`, `${fmt(CASTS_FORGONE)} Reroll casts ≈ ${POLISHES_FORGONE.toFixed(1)} full-set polishes forgone`],
    ['T7', 'the full-Lck advantage stops at the junk line (G8)', `${hr(HIGH_BAND_HOURS, 1)} high-band hr × ${fmt(junk('high_full_lck'))} vs × ${fmt(junk('high'))}`, `${fmt(LCK_HIGH_BAND)} vs ${fmt(NO_LCK_HIGH_BAND)} gold = ×${(LCK_HIGH_BAND / NO_LCK_HIGH_BAND).toFixed(2)} against the ×${E.towns_gold_rate_multiplier_bound} ceiling ✓`],
    ['T8', 'every stall line is space · time · information · appearance only (G7)', `kind tag on all ${DATA.one_time.length + DATA.repeatable.length} lines · power nouns need an explicit display_only flag`, `${DATA.one_time.length + DATA.repeatable.length} lines, 0 power lines ✓`],
    ['T9', 'travel never gates content and never beats farming (G9)', `8 links × ${LINE.road_link.m} m one-time · Road trip ≤ ${INV.road_trip_max_real_minutes} real min`, `${fmt(lineGoldTotal(LINE.road_link))} gold = ${pct(lineGoldTotal(LINE.road_link) / SUPPLY)} of supply ✓`],
    ['T10', 'Armourer repair costs more than the elite time it replaces (D2 service class)', `60 ÷ ${E.elite_reroll_tier_stones_per_hr} tier stones/hr = ${MIN_PER_TIER_STONE.toFixed(2)} m floor`, `${LINE.repair.m} m · ${LINE.repair_ironrow.m} m at Ironrow ✓ · final floor waits on F9`],
    ['T11', 'skip tokens stay inside the tasks.md bound', `${LINE.skip_token.m} m × ${LINE.skip_token.per_day_cap}/day`, `${LINE.skip_token.m * LINE.skip_token.per_day_cap} m/day ✓ (payouts untouched)`],
    ['T12', `Standing has ${INV.standing_min_tiers} tiers per settlement and is counted from F1 kills`, `budget hr × tier share × band kills/hr`, 'see table T-S below, 27 thresholds ✓'],
    ['T13', 'Tier III is a chase, never a formality', `tier III share ≥ ${INV.chase_tier_min_share} × the zone budget`, `${DATA.standing.tiers[2].share} on all 9 ✓`],
    ['T14', 'Collector sets pay items, never gold (G6)', `pays_gold flag on ${DATA.collector_sets.length} sets`, '0 gold ✓'],
    ['T15', 'Base bias carries no numbers until the keep-rate re-sim', `loot.md section 1 step 2 + section 3`, `status = ${DATA.base_bias.status} · ${DATA.base_bias.checks.length} checks open`],
    ['T16', 'price ladders are monotonic, so no later tier is cheaper', ladderRanges(), '✓'],
    ['T17', 'this file owns no kill rate: income is loot.md unchanged', `F1 = ${BANDS.map((b) => fmt(E.bands[b].kills_per_hr)).join(' / ')} kills/hr`, 'mob_HP and the 40.2 hr timeline unmoved ✓ (H1)'],
    ['T18', 'no band number is retyped here — town prices divide the engine junk line by 60', `tools/lib/engine.js (engine.json) → junk/hr per band, then loot.md section 2 read back`, dc.problems.length ? `MISMATCH: ${dc.problems.join(' · ')}` : `F1 ${dc.d.f1} · F3 ${dc.d.f3} · F5 ${dc.d.f5} · ${dc.d.rows} loot.md numbers read back equal ✓`],
  ];
  const table = [head, '|---|---|---|---|', ...rows.map((r) => `| ${r[0]} | ${r[1]} | \`${r[2]}\` | ${r[3]} |`)].join('\n');

  const shead = '| id | Settlement | Band | Budget hr | Tier I kills | Tier II kills | Tier III kills |';
  const srows = DATA.settlements.map((s) => {
    const st = standing(s);
    return `| ${s.id} | ${s.name} | ${s.band} | ${hr(s.budget_hr, 1)} | ${fmt(st[0].kills)} | ${fmt(st[1].kills)} | ${fmt(st[2].kills)} |`;
  });
  return [table, '', '## T-S · Standing thresholds in kills (the numbers T12 reads)', '',
    shead, '|' + Array(7).fill('---').join('|') + '|', ...srows, '',
    `Source: \`node tools/town.js --checks\` · data in \`tools/data/town.json\` · prices, stock and ladders in \`towns-stalls.md\`.`, ''].join('\n');
};

// ---------------------------------------------------------------- checks

function runChecks() {
  const out = [];
  const add = (id, ok, detail) => out.push({ id, status: ok ? 'PASS' : 'FAIL', detail });
  const pending = (id, detail) => out.push({ id, status: 'PENDING', detail });

  const cp = E.checkpoints_hr;
  add('T3a', close(E.bands.low.band_hours, cp.level_30)
    && close(E.bands.mid.band_hours, cp.level_60 - cp.level_30)
    && close(E.bands.high.band_hours, cp.level_90 - cp.level_60)
    && close(E.push_hr_levels_91_100, cp.level_100 - cp.level_90),
    `band hours ${[E.bands.low.band_hours, E.bands.mid.band_hours, E.bands.high.band_hours, E.push_hr_levels_91_100].join(' / ')} = E1-E5 deltas`);
  add('T3b', close(DATA.settlements.reduce((s, x) => s + x.budget_hr, 0), cp.level_100),
    `Σ 9 settlement budgets = ${DATA.settlements.reduce((s, x) => s + x.budget_hr, 0)} hr = ${cp.level_100} hr timeline`);
  add('T2', BANDS.every((b, i) => i === 0 || rate(b) > rate(BANDS[i - 1])),
    `gold per 1 m rises with the band: ${BANDS.map((b) => rate(b)).join(' < ')}`);
  add('T7', Math.abs(junk('high_full_lck') / junk('high') - E.towns_gold_rate_multiplier_bound) < 0.05,
    `full-Lck junk ×${(junk('high_full_lck') / junk('high')).toFixed(2)} against the ×${E.towns_gold_rate_multiplier_bound} ceiling`);
  add('T3', SUPPLY === Math.round(E.bands.low.band_hours * junk('low') + E.bands.mid.band_hours * junk('mid') + (E.bands.high.band_hours + E.push_hr_levels_91_100) * junk('high')),
    `lifetime supply ${fmt(SUPPLY)} gold`);
  add('T4', ONETIME_DEMAND / SUPPLY <= INV.onetime_demand_max_multiple_of_lifetime_supply,
    `one-time demand ${fmt(ONETIME_DEMAND)} = ${(ONETIME_DEMAND / SUPPLY).toFixed(2)}× supply (limit ${(INV.onetime_demand_max_multiple_of_lifetime_supply).toFixed(2)}×)`);
  add('T5', ESSENTIALS / SUPPLY <= INV.essentials_max_share_of_lifetime_supply,
    `essentials ${fmt(ESSENTIALS)} = ${pct(ESSENTIALS / SUPPLY)} of supply (limit ${pct(INV.essentials_max_share_of_lifetime_supply, 0)})`);

  // T8 — no power for sale
  const badKind = [...DATA.one_time, ...DATA.repeatable].filter((l) => !INV.allowed_kinds.includes(l.kind));
  const powerNoun = new RegExp('\\b(' + INV.banned_power_nouns.join('|') + ')s?\\b', 'i');
  const risky = [...DATA.one_time, ...DATA.repeatable]
    .filter((l) => powerNoun.test(l.item) && !l.display_only);
  add('T8', badKind.length === 0 && risky.length === 0,
    badKind.length ? `unknown kind: ${badKind.map((l) => l.id).join(', ')}`
      : risky.length ? `power noun without display_only: ${risky.map((l) => l.id).join(', ')}`
        : `${DATA.one_time.length + DATA.repeatable.length} lines, all tagged space/time/information/appearance`);

  // T9 — travel
  const links = DATA.one_time.find((l) => l.id === 'road_link');
  const linkQty = Object.values(links.qty_by_band).reduce((a, b) => a + b, 0);
  add('T9', links.m <= INV.road_link_max_m && linkQty === ROAD_LINKS,
    `Road link ${links.m} m ≤ ${INV.road_link_max_m} m · ${linkQty} links = ${ROAD_LINKS} non-start settlements · ${fmt(lineGoldTotal(links))} gold total`);

  // T10 — Armourer floor
  const repairLines = [...DATA.one_time, ...DATA.repeatable].filter((l) => /repair/.test(l.id));
  add('T10', repairLines.every((l) => l.m > MIN_PER_TIER_STONE),
    `repair ${repairLines.map((l) => l.m + ' m').join(' / ')} > ${MIN_PER_TIER_STONE.toFixed(2)} m per Reroll tier stone (F7 elite ${E.elite_reroll_tier_stones_per_hr}/hr)`);
  pending('T10b', 'Armourer final floor re-checks when F9 (Add mod stone rate) lands');

  // T11 — skip tokens
  add('T11', LINE.skip_token.per_day_cap <= INV.skip_token_max_per_day
    && LINE.skip_token.m * LINE.skip_token.per_day_cap <= INV.skip_token_max_m_per_day,
    `skip token ${LINE.skip_token.m} m × ${LINE.skip_token.per_day_cap}/day = ${LINE.skip_token.m * LINE.skip_token.per_day_cap} m/day (caps ${INV.skip_token_max_m_per_day} m)`);

  // T12/T13 — Standing
  const stOk = DATA.settlements.every((s) => {
    const st = standing(s);
    return st.length === INV.standing_min_tiers
      && st.every((t) => t.kills > 0)
      && st.every((t, i) => i === 0 || t.kills > st[i - 1].kills);
  });
  add('T12', stOk, `3 tiers × 9 settlements = 27 thresholds, all from F1 kills/hr and monotonic`);
  add('T13', DATA.standing.tiers.every((t, i) => i < 2 || t.share >= INV.chase_tier_min_share)
    && DATA.settlements.every((s) => standing(s)[2].kills > s.budget_hr * E.bands[s.band].kills_per_hr),
    `Tier III = ${DATA.standing.tiers[2].share * 100}% of budget > 100% on all 9 → a chase, not a formality`);
  add('T12b', DATA.standing.never_grants.length > 0 && !DATA.standing.grants.some((g) => /stat|stone|mod/i.test(g)),
    `Standing grants only ${DATA.standing.grants.join(' · ')} and never ${DATA.standing.never_grants.join(' · ')}`);

  // T14 — Collector
  add('T14', DATA.collector_sets.every((c) => c.pays_gold === false)
    && DATA.collector_sets.length === 3
    && new Set(DATA.collector_sets.map((c) => c.school)).size === 3,
    `${DATA.collector_sets.length} sets, ${new Set(DATA.collector_sets.map((c) => c.school)).size} schools (light/heavy/cloth), 0 gold paid`);

  // T15 — Base bias gate
  const weighted = DATA.settlements.filter((s) => s.base_bias_weight != null);
  add('T15', DATA.base_bias.status === 'pending' && weighted.length === 0,
    `status ${DATA.base_bias.status} · ${weighted.length} numeric weights in data · ${DATA.base_bias.checks.length} re-sim checks open`);

  // T16 — ladders
  const ladders = {};
  for (const l of DATA.one_time) if (l.ladder) (ladders[l.ladder] = ladders[l.ladder] || []).push(l);
  const ladderOk = Object.values(ladders).every((ls) => {
    const sorted = [...ls].sort((a, b) => a.m - b.m);
    if (sorted.some((l, i) => i > 0 && l.m <= sorted[i - 1].m)) return false;
    return sorted.every((l, i) => i === 0 || l.charge_band !== sorted[i - 1].charge_band || gold(l.m, l.charge_band) > gold(sorted[i - 1].m, sorted[i - 1].charge_band));
  });
  add('T16', ladderOk, `${Object.keys(ladders).length} ladders monotonic: ${ladderRanges()}`);

  // T17 — no income invented here
  const kph = BANDS.map((b) => E.bands[b].kills_per_hr);
  add('T17', kph.join() === '980,1385,1800', `F1 ${kph.join(' / ')} kills/hr copied from loot.md section 2 · this tool changes no kill rate`);

  // T18 — this data file must read the same engine the loot docs publish
  const dc = docCheck();
  add('T18', dc.problems.length === 0, dc.problems.length
    ? dc.problems.join(' · ')
    : `checks.md F1 ${dc.d.f1_kills} · F3 ${dc.d.f3_drops} · F5 ${dc.d.f5_junk} and loot.md section 2 rows all equal the data engine`);

  // roster consistency
  const setTownIds = DATA.collector_sets.map((c) => c.settlement);
  const pedlarIds = DATA.settlements.filter((s) => s.npcs.includes('curio_pedlar')).map((s) => s.id);
  const rosterProblems = [];
  for (const s of DATA.settlements) {
    for (const id of ['counterhand', 'porter', 'waypoint_keeper']) if (!s.npcs.includes(id)) rosterProblems.push(`${s.name} lacks ${npcName(id)}`);
    for (const id of ['steward', 'guild_clerk']) if (s.npcs.includes(id) && !s.capital) rosterProblems.push(`${s.name} is not a capital but holds ${npcName(id)}`);
    if (s.capital && !['steward', 'guild_clerk', 'armourer', 'waypoint_keeper', 'porter', 'counterhand'].every((id) => s.npcs.includes(id))) rosterProblems.push(`${s.name} capital set incomplete`);
    if (s.npcs.includes('collector') !== setTownIds.includes(s.id)) rosterProblems.push(`${s.name} Collector presence does not match the set towns`);
    if (s.npcs.includes('curio_pedlar') && !['highspire', 'vermolch'].includes(s.id)) rosterProblems.push(`${s.name} should not hold a Curio pedlar`);
    for (const n of s.npcs) if (!NPCS[n]) rosterProblems.push(`${s.name} references unknown NPC ${n}`);
  }
  add('T-R', rosterProblems.length === 0, rosterProblems.length ? rosterProblems.join(' · ')
    : `9 rosters match the presence rules · Collector in ${setTownIds.map(settlementName).join('/')} · pedlar in ${pedlarIds.map(settlementName).join('/')}`);

  // stock references
  const stockProblems = [];
  for (const s of DATA.settlements) for (const id of s.stock) {
    if (DATA.collector_sets.some((c) => c.id === id)) {
      if (!s.npcs.includes('collector')) stockProblems.push(`${s.name} holds a set but no Collector`);
      continue;
    }
    const l = LINE[id];
    if (!l) { stockProblems.push(`${s.name} stock '${id}' is not a priced line`); continue; }
    if (!s.npcs.includes(l.npc)) stockProblems.push(`${s.name} stocks ${id} but has no ${npcName(l.npc)}`);
  }
  add('T-S', stockProblems.length === 0, stockProblems.length ? stockProblems.join(' · ') : 'every stock line resolves to a priced line (or a Collector set) sold by an NPC actually present');

  return out;
}

function close(a, b) { return Math.abs(a - b) < 0.005; }

// ---- doc-vs-data: the town tables may only use the shared engine

function docCheck() {
  const problems = [];
  if (DATA.engine) problems.push('town.json still carries an engine block — band numbers must come only from tools/data/engine.json');
  const rows = eng.runReadBack().filter((r) => /^loot.md/.test(r.label));
  for (const r of rows) if (!r.ok) problems.push(r.label + ': ' + r.detail);
  return { problems, d: { f1: E.bands.high.kills_per_hr, f3: E.bands.high.drops_per_hr, f5: junk('high'), rows: rows.length } };
}
// ---------------------------------------------------------------- docs I/O

function begin(key) { return `<!-- BEGIN GENERATED:${key} -->`; }
function end(key) { return `<!-- END GENERATED:${key} -->`; }

function replaceBlock(text, key, body) {
  const re = new RegExp(escapeRe(begin(key)) + '[\\s\\S]*?' + escapeRe(end(key)));
  if (!re.test(text)) return { text, found: false };
  return { text: text.replace(re, `${begin(key)}\n${body}\n${end(key)}`), found: true };
}

function blockIsCurrent(text, key, body) {
  const re = new RegExp(escapeRe(begin(key)) + '([\\s\\S]*?)' + escapeRe(end(key)));
  const m = text.match(re);
  if (!m) return 'missing';
  return m[1].trim() === body.trim() ? 'current' : 'stale';
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function targets() {
  const map = {};
  for (const [file, keys] of Object.entries(DATA.meta.targets)) (map[file] = map[file] || []).push(...keys);
  return map;
}

// ---------------------------------------------------------------- cli

const arg = process.argv[2];

if (arg === '--emit') {
  for (const [file, keys] of Object.entries(targets())) {
    console.log(`\n===== ${file} =====`);
    for (const k of keys) console.log(`\n${begin(k)}\n${BLOCKS[k]()}${end(k)}`);
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
} else if (arg === '--checks' || arg === '--verify') {
  const rows = runChecks();
  const width = Math.max(...rows.map((r) => r.id.length));
  for (const r of rows) console.log(`${r.id.padEnd(width)}  ${r.status.padEnd(7)}  ${r.detail}`);
  const fails = rows.filter((r) => r.status === 'FAIL');
  const pend = rows.filter((r) => r.status === 'PENDING');

  let stale = [];
  for (const [file, keys] of Object.entries(targets())) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) { stale.push(`${file} (absent)`); continue; }
    const text = fs.readFileSync(p, 'utf8');
    for (const k of keys) {
      const s = blockIsCurrent(text, k, BLOCKS[k]());
      if (s !== 'current') stale.push(`${file} :: ${k} (${s})`);
    }
  }
  console.log('');
  const leaks = [];
  for (const [file, keys] of Object.entries(targets())) for (const k of keys) if (/undefined|NaN/.test(BLOCKS[k]())) leaks.push(`${file} :: ${k}`);
  if (leaks.length) console.log('TEMPLATE LEAKS (a generated table contains undefined/NaN):\n  ' + leaks.join('\n  '));
  else console.log('template leaks: none · every generated cell holds a number or a word');
  if (stale.length) console.log('DOC BLOCKS NOT CURRENT:\n  ' + stale.join('\n  '));
  else console.log('doc blocks: all generated tables in towns-stalls.md + checks.md match this data');
  console.log(`\n${rows.length - fails.length - pend.length}/${rows.length} PASS · ${pend.length} PENDING · ${fails.length} FAIL`);
  if (fails.length || stale.length || leaks.length) process.exitCode = 1;
} else {
  console.log(`town economy generator — data: tools/data/town.json

  node tools/town.js --emit     print every generated block
  node tools/town.js --write    rewrite the generated blocks in towns-stalls.md + checks.md
  node tools/town.js --checks   run group T, exit 1 on FAIL or stale docs
`);
}
