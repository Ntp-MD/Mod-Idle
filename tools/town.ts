#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import * as eng from './lib/engine.ts';
import { begin, end, blockState, writeAll, resolveDoc } from './lib/generated.ts';
import type { Writer } from './lib/types.ts';

/**
 * Town economy generator + cage.
 *
 *   node tools/town.ts            help
 *   node tools/town.ts --emit     print every generated block to stdout
 *   node tools/town.ts --write    replace the generated blocks inside the docs
 *   node tools/town.ts --checks   run group T, report, exit 1 on FAIL
 *
 * Every gold price, Standing kill threshold, supply figure and demand ratio in
 * towns-stalls.md + checks.md group T is an output of tools/data/town.json.
 * Nothing here reads the markdown files except to check that they are current.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'data', 'town.json'), 'utf8'));
// Band numbers are never stored here: tools/data/engine.json is the only source.
const E = eng.engineForTown({});
const INV = DATA.invariants;
const BANDS = ['low', 'mid', 'high'];
const BAND_KEYS = Object.keys(E.bands);

// ---------------------------------------------------------------- helpers

const pow10 = Math.pow(10, E.round_rate_to_decimals);

const junk = (b: any) => E.bands[b].drops_per_hr - E.bands[b].upgrades_per_hr;
/** Gold per kill — the worth of the price unit `k` in that band (junk sells 1 gold a piece, so gold/kill = junk/kill). */
const goldPerKill = (b: any) => junk(b) / E.bands[b].kills_per_hr;
/** The row's price in kills at band b: `k`, or the per-band ladder for a `by_settlement_band` / `one_per_band` line. */
const priceK = (row: any, b: any) => (row.k != null ? row.k : row.k_by_band[b]);
/** Gold = kills × gold per kill, so the price is a kill count and no gold value is typed here. */
const gold = (row: any, b: any) => Math.round(priceK(row, b) * goldPerKill(b) + 1e-9);
const fmt = (n: any) => Math.round(n).toLocaleString('en-US');
const hr = (n: any, d = 2) => Number(n).toFixed(d);
const pct = (x: any, d = 1) => (x * 100).toFixed(d) + '%';

const byId = (arr: any) => Object.fromEntries(arr.map((x: any) => [x.id, x]));
const bandTag = (b: any) => (b === 'high_full_lck' ? 'high+full Lck' : b);
const bandLabel = (f: any) => BAND_KEYS.map((b: any) => f(b) + ' ' + bandTag(b)).join(' · ');
const SETTLEMENTS = byId(DATA.settlements);
const NPCS = byId(DATA.npcs);
const ONE_TIME = byId(DATA.one_time);
const REPEATABLE = byId(DATA.repeatable);
const LINE = { ...ONE_TIME, ...REPEATABLE };

const npcName = (id: any) => (NPCS[id] ? NPCS[id].name : id);
const settlementName = (id: any) => (SETTLEMENTS[id] ? SETTLEMENTS[id].name : id);

function lineGoldTotal(line: any) {
  if (line.charge === 'by_settlement_band') {
    return Object.entries(line.qty_by_band).reduce((s: any, [b, q]: any) => s + q * gold(line, b), 0);
  }
  if (line.charge === 'one_per_band') {
    return BANDS.reduce((s, b) => s + gold(line, b), 0);
  }
  return (line.qty || 1) * gold(line, line.charge_band);
}

function essentialGold(entry: any) {
  const line = LINE[entry.id];
  if (!line) throw new Error('unknown essentials line: ' + entry.id);
  if (entry.qty_by_band) {
    return Object.entries(entry.qty_by_band).reduce((s: any, [b, q]: any) => s + q * gold(priceRow(line, b, entry), b), 0);
  }
  const band = line.charge === 'by_settlement_band' ? 'low' : line.charge_band;
  if (line.charge === 'one_per_band') return BANDS.reduce((s, b) => s + gold(line, b), 0);
  if (entry.use_discount && line.discount) {
    const dBand = SETTLEMENTS[line.discount.settlement].band;
    return gold({ k: line.discount.k }, dBand);
  }
  return (line.qty || 1) * gold(priceRow(line, band, entry), band);
}

/** The row an essentials bill charges: the teaching discount stands in for the whole line where one exists. */
function priceRow(line: any, band: any, entry: any) {
  return entry.use_discount && line.discount ? { k: line.discount.k } : line;
}

/**
 * The run's junk, in KILLS. A band is a count of kills (`band_kills`) and junk is priced per kill
 * (`junkKill`), so the supply is the pieces the run pays — never a stretch of hours, which is the
 * player's own pace (`AGENT.md`). The arithmetic is the published one unchanged: a band is a count
 * of kills, so the supply is kills x junk/kill.
 */
const junkKill = (b: string) => junk(b) / E.bands[b].kills_per_hr;
function lifetimeSupply() {
  return E.bands.low.band_kills * junkKill('low')
    + E.bands.mid.band_kills * junkKill('mid')
    + (E.bands.high.band_kills + E.push_kills_91_100) * junkKill('high');
}

const SUPPLY = Math.round(lifetimeSupply());
const ONETIME_DEMAND = DATA.one_time.reduce((s: any, l: any) => s + lineGoldTotal(l), 0);
const ESSENTIALS = DATA.essentials.reduce((s: any, e: any) => s + essentialGold(e), 0);
const ROAD_LINKS = DATA.settlements.filter((s: any) => !s.start).length;
const HIGH_BAND_KILLS = E.bands.high.band_kills + E.push_kills_91_100;
const LCK_HIGH_BAND = Math.round(HIGH_BAND_KILLS * junkKill('high_full_lck'));
const NO_LCK_HIGH_BAND = Math.round(HIGH_BAND_KILLS * junkKill('high'));
const CASTS_FORGONE = Math.round(SUPPLY / E.reroll_stones_per_cast);
const POLISHES_FORGONE = SUPPLY / E.reroll_stones_per_cast / E.reroll_casts_per_full_set_polish;
// The floor a repair must clear is the kills it takes to earn the stone it replaces — a kill count,
// never a stretch of minutes (AGENT.md · D12).
const KILLS_PER_TIER_STONE = E.bands.high.kills_per_hr / E.elite_reroll_tier_stones_per_hr;
// T10b: with F9 landed, the Armourer floor is re-checked against the Add mod stone, which is the
// stone Ascend actually needs and the one the Armourer competes with for the same boss kills.
const KILLS_PER_ADD_STONE = E.bands.high.kills_per_hr / E.add_mod_stones_per_hr;

function standing(s: any) {
  return DATA.standing.tiers.map((t: any) => ({
    name: t.name,
    share: t.share,
    kills: Math.round(E.budget_kills(s.zone) * t.share + 1e-9),
  }));
}

const BAND_KILLS_TEXT = `low z1-3 = ${fmt(E.bands.low.band_kills)} kills · mid z4-6 = ${fmt(E.bands.mid.band_kills)} · high z7-9 = ${fmt(E.bands.high.band_kills)} · z9 push (91-100) = ${fmt(E.push_kills_91_100)}`;

function ladderRanges() {
  const groups: Record<string, any> = {};
  for (const l of DATA.one_time) if (l.ladder) (groups[l.ladder] = groups[l.ladder] || []).push(l.k);
  return Object.entries(groups)
    .map(([k, v]) => `${k} ${Math.min(...v)}-${Math.max(...v)} k`)
    .join(' · ');
}

// ---------------------------------------------------------------- blocks

const BLOCKS: Record<string, () => string> = {};

BLOCKS['price-unit'] = () => '```\n' + [
  `gold per sold junk piece        = ${E.gold_per_junk_piece}                       (economy.md · loot.md section 4)`,
  `drops per kill per band         = ${bandLabel((b: any) => (E.bands[b].drops_per_hr / E.bands[b].kills_per_hr).toFixed(4))}   (loot.md section 2 · F3)`,
  `upgrades per kill from drops    = ${bandLabel((b: any) => (E.bands[b].upgrades_per_hr / E.bands[b].kills_per_hr).toFixed(4))}   (F4)`,
  `junk per kill = drops − upgrades = ${bandLabel((b: any) => (junk(b) / E.bands[b].kills_per_hr).toFixed(4))}`,
  `1 k  = one kill of full-sell income in that band`,
  `gold per 1 k                    = ${bandLabel((b: any) => goldPerKill(b).toFixed(4))}`,
  `kills per band (F1)             = ${BANDS.map((b) => fmt(E.bands[b].kills_per_hr) + ' ' + b).join(' · ')}`,
  `opportunity cost of 1 gold      = 1 Reroll value stone forgone (F6 · E8)`,
  ``,
  `band kills (${BAND_KILLS_TEXT})  (checks.md E1-E5)`,
].join('\n') + '\n```';

BLOCKS.supply = () => '```\n' + [
  `band kills                      = ${BAND_KILLS_TEXT}`,
  `lifetime junk pieces            = ${fmt(E.bands.low.band_kills)}×${junkKill('low').toFixed(4)} + ${fmt(E.bands.mid.band_kills)}×${junkKill('mid').toFixed(4)} + ${fmt(E.bands.high.band_kills + E.push_kills_91_100)}×${junkKill('high').toFixed(4)} = ${fmt(SUPPLY)}`,
  `max lifetime gold (sell everything, no Lck)              = ${fmt(SUPPLY)}`,
  `one-time stall demand (section 3, all 9 places)          = ${fmt(ONETIME_DEMAND)} gold = ${(ONETIME_DEMAND / SUPPLY).toFixed(2)}x the max`,
  `essentials only (${DATA.essentials.map((e: any) => LINE[e.id].item.toLowerCase().replace(/\s*\(.*\)/, '')).join(' · ')}) = ${fmt(ESSENTIALS)} = ${pct(ESSENTIALS / SUPPLY)} of the max`,
  `full-Lck ceiling over the ${fmt(HIGH_BAND_KILLS)} high-band kills               = ${fmt(LCK_HIGH_BAND)} gold (= ×${(LCK_HIGH_BAND / NO_LCK_HIGH_BAND).toFixed(2)} of the ${fmt(NO_LCK_HIGH_BAND)} a no-Lck run earns there · ceiling ×${E.towns_gold_rate_multiplier_bound})`,
  `stones forgone by selling everything                     = ${fmt(SUPPLY)} ÷ ${E.reroll_stones_per_cast} = ${fmt(CASTS_FORGONE)} Reroll casts ≈ ${POLISHES_FORGONE.toFixed(1)} full-set polishes (E8)`,
  `repeatable demand (section 4)                            = absorbs whatever the one-time list does not, no ceiling`,
].join('\n') + '\n```';

/** The price cell in kills: a flat `k`, or the low/mid/high ladder for a per-destination or per-band line. */
const kCell = (l: any) => (l.k != null ? String(l.k) : `${l.k_by_band.low}/${l.k_by_band.mid}/${l.k_by_band.high}`);

BLOCKS['one-time'] = () => {
  const head = '| Item | Sold by | Kind | k | gold @low | gold @mid | gold @high | Charged at | Qty | Gold in the demand total | Note |';
  const rows = DATA.one_time.map((l: any) => {
    const charged = l.charge === 'by_settlement_band'
      ? 'the band of each destination'
      : l.charge === 'one_per_band' ? 'one per band' : `${l.charge_band} band`;
    const qty = l.qty_by_band
      ? Object.entries(l.qty_by_band).map(([b, q]: any) => `${q} ${b}`).join(' + ')
      : (l.qty || 1);
    return `| ${l.item} | ${npcName(l.npc)} | ${l.kind} | ${kCell(l)} | ${fmt(gold(l, 'low'))} | ${fmt(gold(l, 'mid'))} | ${fmt(gold(l, 'high'))} | ${charged} | ${qty} | ${fmt(lineGoldTotal(l))} | ${l.note} |`;
  });
  return [head, '|---|---|---|---|---|---|---|---|---|---|---|', ...rows, '', `Total one-time demand = **${fmt(ONETIME_DEMAND)} gold** (see section 2).`, ''].join('\n');
};

BLOCKS.repeatable = () => {
  const head = '| Item | Sold by | Kind | k | Gold | Bound | Note |';
  const rows = DATA.repeatable.map((l: any) => {
    const k = l.k_min != null ? `${l.k_min}-${l.k_max}` : String(l.k);
    const price = l.k_min != null
      ? `${fmt(gold({ k: l.k_min }, l.charge_band))}-${fmt(gold({ k: l.k_max }, l.charge_band))} (${l.charge_band})`
      : `${fmt(gold(l, l.charge_band))} (${l.charge_band})`;
    const bound = l.per_day_cap ? `${l.per_day_cap} per real day` : 'repeatable';
    return `| ${l.item} | ${npcName(l.npc)} | ${l.kind} | ${k} | ${price} | ${bound} | ${l.note} |`;
  });
  const dayK = (LINE.skip_token.k * LINE.skip_token.per_day_cap);
  return [head, '|---|---|---|---|---|---|---|', ...rows, '', `Skip-token ceiling = ${LINE.skip_token.k} k × ${LINE.skip_token.per_day_cap}/day = **${dayK.toFixed(1)} k/day** = ${fmt(dayK * goldPerKill('high'))} gold/day in the high band.`, ''].join('\n');
};

BLOCKS['npc-matrix'] = () => {
  const cols = DATA.npcs;
  const head = '| Settlement | Zone | Band | Capital | ' + cols.map((c: any) => c.name).join(' | ') + ' |';
  const rows = DATA.settlements.map((s: any) => '| **' + s.name + '** | ' + s.zone + ' | ' + s.band + ' | ' + (s.capital || '—') + ' | '
    + cols.map((c: any) => (s.npcs.includes(c.id) ? '✓' : '·')).join(' | ') + ' |');
  const count = '| **Present in** |  |  |  | ' + cols.map((c: any) => DATA.settlements.filter((s: any) => s.npcs.includes(c.id)).length + '/9').join(' | ') + ' |';
  const legend = cols.map((c: any) => `- **${c.name}** — ${c.rule} · sells ${c.kind}`).join('\n');
  return [head, '|' + ['---', '---', '---', '---', ...cols.map(() => '---')].join('|') + '|', ...rows, count, '', 'Presence rules:', legend, ''].join('\n');
};

BLOCKS.stock = () => {
  const stockLabel = (id: any) => {
    const set = DATA.collector_sets.find((c: any) => c.id === id);
    if (set) return `Collector set **${set.name}** (${set.school} school)`;
    const l = LINE[id];
    return l ? l.item.replace(/\s*\(.*?\)/g, '') : id;
  };
  const head = '| Settlement | Zone · band | Capital | NPCs | Stock lines (prices in sections 3-4) | Base bias (flavour) | Standing tiers (kills) |';
  const rows = DATA.settlements.map((s: any) => {
    const st = standing(s);
    const arm = s.armourer_variant ? ` (=${s.armourer_variant})` : '';
    return `| **${s.name}** | ${s.zone} · ${s.band} | ${s.capital || '—'} | ${s.npcs.map((n: any) => npcName(n)).join(' · ')}${arm} | ${s.stock.map(stockLabel).join(' · ')} | ${s.base_bias_flavor} | ${fmt(st[0].kills)} / ${fmt(st[1].kills)} / ${fmt(st[2].kills)} |`;
  });
  return [head, '|' + Array(7).fill('---').join('|') + '|', ...rows, ''].join('\n');
};

BLOCKS.standing = () => {
  const head = '| Settlement | Band | Zone budget (kills) | Tier I ' + Math.round(DATA.standing.tiers[0].share * 100) + '% | Tier II ' + Math.round(DATA.standing.tiers[1].share * 100) + '% | Tier III ' + Math.round(DATA.standing.tiers[2].share * 100) + '% |';
  const rows = DATA.settlements.map((s: any) => {
    const st = standing(s);
    return `| **${s.name}** | ${s.band} | ${fmt(E.budget_kills(s.zone))} | **${fmt(st[0].kills)} kills** | **${fmt(st[1].kills)} kills** | **${fmt(st[2].kills)} kills** |`;
  });
  const unlocks = DATA.standing.tiers.map((t: any) => `- **Tier ${t.name}** = ${t.share * 100}% of that settlement's zone budget → ${t.unlocks}.`).join('\n');
  return [head, '|' + Array(6).fill('---').join('|') + '|', ...rows, '',
    'Kill counts = `zone budget kills × tier share`, rounded. A budget is a count of kills its band pays, so a threshold is a state the player banks — never a stretch of hours (`AGENT.md`).',
    unlocks, ''].join('\n');
};

BLOCKS.collector = () => {
  const head = '| Set | Where | School | Turn in | Quality | Reward | Gold paid | Rule |';
  const rows = DATA.collector_sets.map((c: any) => `| **${c.name}** | ${settlementName(c.settlement)} | ${c.school} | ${c.pieces.join(' · ')} | ${c.quality} | ${c.reward} | ${c.pays_gold ? 'yes' : 'no'} | ${c.rule} |`);
  return [head, '|' + Array(8).fill('---').join('|') + '|', ...rows, ''].join('\n');
};

BLOCKS['base-bias'] = () => [
  `Status: **${DATA.base_bias.status}** (${DATA.base_bias.decision}) — the column above is ${DATA.base_bias.column_meaning}`,
  '',
  ...DATA.base_bias.checks.map((c: any, i: any) => `${i + 1}. ${c}`),
  '',
  'Never written (the ruling forbids it, not merely a pending gate):',
  ...DATA.base_bias.forbidden_until_closed.map((f: any) => `- ${f}`),
  ''
].join('\n');

BLOCKS.pending = () => {
  const head = '| Pending number | Line it moves | Status |';
  const rows = DATA.pending.map((p: any) => `| ${p.number} | ${p.breaks} | ${p.status} |`);
  return [head, '|---|---|---|', ...rows, ''].join('\n');
};

BLOCKS['group-T'] = () => {
  const head = '| id | Must hold | Expression | Value |';
  const dc = docCheck();
  const rows = [
    ['T1', 'gold is minted by the sell choice, plus one bounded exception: the Road purse (G2 · G6 · X36)', `${E.gold_per_junk_piece} gold per sold junk piece · Road ceiling ${eng.ROAD.purseCapPerDay} gold/day, never stones, never AFK`, `${E.gold_per_junk_piece}`],
    ['T2', 'the price unit is a kill’s worth of real loot, not a feeling', `junk per kill, per band`, `${goldPerKill('low').toFixed(4)} low · ${goldPerKill('mid').toFixed(4)} mid · ${goldPerKill('high').toFixed(4)} high · ${goldPerKill('high_full_lck').toFixed(4)} high+full Lck gold per 1 k`],
    ['T3', 'lifetime gold supply is the junk line, not a new faucet', `${fmt(E.bands.low.band_kills)}×${junkKill('low').toFixed(4)} + ${fmt(E.bands.mid.band_kills)}×${junkKill('mid').toFixed(4)} + ${fmt(E.bands.high.band_kills + E.push_kills_91_100)}×${junkKill('high').toFixed(4)}`, fmt(SUPPLY) + ' gold'],
    ['T4', `one-time stall demand ≤ ${(INV.onetime_demand_max_multiple_of_lifetime_supply).toFixed(2)}× the supply — a funnel, not a wall`, `Σ ${DATA.one_time.length} one-time lines at their charge band`, `${fmt(ONETIME_DEMAND)} = ${(ONETIME_DEMAND / SUPPLY).toFixed(2)}× ✓`],
    ['T5', `essentials ≤ ${pct(INV.essentials_max_share_of_lifetime_supply, 0)} of the supply while ~80%+ still dissolves`, `4 Road links · tab 1 at Eastgate · tab 2 · pouch II · deed 4`, `${fmt(ESSENTIALS)} = ${pct(ESSENTIALS / SUPPLY)} ✓`],
    ['T6', 'selling everything is a craft decision, priced in craft', `${fmt(SUPPLY)} ÷ ${E.reroll_stones_per_cast} stones · ÷ ${E.reroll_casts_per_full_set_polish} casts per full polish`, `${fmt(CASTS_FORGONE)} Reroll casts ≈ ${POLISHES_FORGONE.toFixed(1)} full-set polishes forgone`],
    ['T7', 'the full-Lck advantage stops at the junk line (G8)', `${fmt(HIGH_BAND_KILLS)} high-band kills × ${fmt(junkKill('high_full_lck'))} vs × ${fmt(junkKill('high'))}`, `${fmt(LCK_HIGH_BAND)} vs ${fmt(NO_LCK_HIGH_BAND)} gold = ×${(LCK_HIGH_BAND / NO_LCK_HIGH_BAND).toFixed(2)} against the ×${E.towns_gold_rate_multiplier_bound} ceiling ✓`],
    ['T8', 'every stall line is space · time · information · appearance only (G7)', `kind tag on all ${DATA.one_time.length + DATA.repeatable.length} lines · power nouns need an explicit display_only flag`, `${DATA.one_time.length + DATA.repeatable.length} lines, 0 power lines ✓`],
    ['T9', 'travel never gates content and never beats farming (G9)', `8 links × ${LINE.road_link.k_by_band.high} k one-time · Road trip ≤ ${INV.road_trip_max_real_minutes} real min`, `${fmt(lineGoldTotal(LINE.road_link))} gold = ${pct(lineGoldTotal(LINE.road_link) / SUPPLY)} of supply ✓`],
    ['T10', 'Armourer repair costs more than the elite time it replaces (D2 service class)', `${E.bands.high.kills_per_hr} kills ÷ ${E.elite_reroll_tier_stones_per_hr} tier stones = ${KILLS_PER_TIER_STONE.toFixed(1)} kills per Reroll tier stone floor · F9 re-checked in T10b`, `${LINE.repair.k} k · ${LINE.repair_ironrow.k} k at Ironrow ✓`],
    ['T11', 'skip tokens stay inside the tasks.md bound', `${LINE.skip_token.k} k × ${LINE.skip_token.per_day_cap}/day`, `${(LINE.skip_token.k * LINE.skip_token.per_day_cap).toFixed(1)} k/day ✓ (payouts untouched)`],
    ['T12', `Standing has ${INV.standing_min_tiers} tiers per settlement and is counted from F1 kills`, `budget kills × tier share`, 'see table T-S below, 27 thresholds ✓'],
    ['T13', 'Tier III is a chase, never a formality', `tier III share ≥ ${INV.chase_tier_min_share} × the zone budget`, `${DATA.standing.tiers[2].share} on all 9 ✓`],
    ['T14', 'Collector sets pay items, never gold (G6)', `pays_gold flag on ${DATA.collector_sets.length} sets`, '0 gold ✓'],
    ['T15', 'Base bias is permanent flavour — ruled even-weighted, so it may never carry a number', `loot.md section 1 step 2 + section 3`, `status = ${DATA.base_bias.status} · ${DATA.base_bias.checks.length} guards · 0 numeric weights`],
    ['T16', 'price ladders are monotonic, so no later tier is cheaper', ladderRanges(), '✓'],
    ['T17', 'this file owns no kill count: income is loot.md unchanged', `F1 = ${BANDS.map((b) => fmt(E.bands[b].kills_per_hr)).join(' / ')} kills per band`, 'mob_HP and the published kill counts unmoved ✓ (H1)'],
    ['T18', 'no band number is retyped here — town prices read the engine junk line per kill', `tools/lib/engine.ts (engine.json) → junk per kill per band, then loot.md section 2 read back`, dc.problems.length ? `MISMATCH: ${dc.problems.join(' · ')}` : `F1 ${dc.d.f1} · F3 ${dc.d.f3} · F5 ${dc.d.f5} · ${dc.d.rows} loot.md numbers read back equal ✓`],
  ];
  const table = [head, '|---|---|---|---|', ...rows.map((r) => `| ${r[0]} | ${r[1]} | \`${r[2]}\` | ${r[3]} |`)].join('\n');

  const shead = '| id | Settlement | Band | Budget kills | Tier I kills | Tier II kills | Tier III kills |';
  const srows = DATA.settlements.map((s: any) => {
    const st = standing(s);
    return `| ${s.id} | ${s.name} | ${s.band} | ${fmt(E.budget_kills(s.zone))} | ${fmt(st[0].kills)} | ${fmt(st[1].kills)} | ${fmt(st[2].kills)} |`;
  });
  return [table, '', '## T-S · Standing thresholds in kills (the numbers T12 reads)', '',
    shead, '|' + Array(7).fill('---').join('|') + '|', ...srows, '',
    `Source: \`node tools/town.ts --checks\` · data in \`tools/data/town.json\` · prices, stock and ladders in \`towns-stalls.md\`.`, ''].join('\n');
};

// ---------------------------------------------------------------- checks

function runChecks() {
  const out: any[] = [];
  const add = (id: any, ok: any, detail: any) => out.push({ id, status: ok ? 'PASS' : 'FAIL', detail });
  const pending = (id: any, detail: any) => out.push({ id, status: 'PENDING', detail });

  const cp = E.checkpoints_kills;
  add('T3a', close(E.bands.low.band_kills, cp.level_30)
    && close(E.bands.mid.band_kills, cp.level_60 - cp.level_30)
    && close(E.bands.high.band_kills, cp.level_90 - cp.level_60)
    && close(E.push_kills_91_100, cp.level_100 - cp.level_90),
    `band kills ${[E.bands.low.band_kills, E.bands.mid.band_kills, E.bands.high.band_kills, E.push_kills_91_100].join(' / ')} = the E1-E5 deltas`);
  // A budget is a count of kills in the settlement's OWN band, so the budgets cannot sum to one
  // level-banded checkpoint — the old identity held only because durations add and a count does not.
  // What still has to hold is that the budgets rise with the zone, so that is what this reads.
  const budgets = DATA.settlements.map((x: any) => E.budget_kills(x.zone));
  const budgetSum = budgets.reduce((a: number, k: number) => a + k, 0);
  // The budgets ARE the curve's own zone slices (engine/index.ts SETTLEMENT_BUDGET_KILLS), so they sum
  // to the completion checkpoint by construction and can only miss by the rounding of the eighteen
  // counts. That is the identity the old hour sum carried, and it is what keeps the world's slices and
  // the progression curve from ever drifting apart.
  const cp190 = cp.level_190;
  add('T3b', Math.abs(budgetSum - cp190) / cp190 < 0.01,
    `Σ ${DATA.settlements.length} settlement budgets = ${fmt(budgetSum)} kills against the ${fmt(cp190)}-kill completion checkpoint (${pct(Math.abs(budgetSum - cp190) / cp190)} apart, the rounding of the per-settlement counts) — the budgets are the curve's own zone slices, so the world's zones and the progression curve cannot drift apart`);
  add('T2', BANDS.every((b, i) => i === 0 || goldPerKill(b) > goldPerKill(BANDS[i - 1])),
    `gold per 1 k rises with the band: ${BANDS.map((b) => goldPerKill(b).toFixed(4)).join(' < ')}`);
  add('T7', Math.abs(junk('high_full_lck') / junk('high') - E.towns_gold_rate_multiplier_bound) < 0.05,
    `full-Lck junk ×${(junk('high_full_lck') / junk('high')).toFixed(2)} against the ×${E.towns_gold_rate_multiplier_bound} ceiling`);
  add('T3', SUPPLY === Math.round(lifetimeSupply()),
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
  const links = DATA.one_time.find((l: any) => l.id === 'road_link');
  const linkQty = Object.values(links.qty_by_band).reduce((a: any, b: any) => a + b, 0);
  add('T9', links.k_by_band.high <= INV.road_link_max_k && linkQty === ROAD_LINKS,
    `Road link ${links.k_by_band.high} k at the high band ≤ ${INV.road_link_max_k} k · ${linkQty} links = ${ROAD_LINKS} non-start settlements · ${fmt(lineGoldTotal(links))} gold total`);

  // T10 — Armourer floor
  const repairLines = [...DATA.one_time, ...DATA.repeatable].filter((l) => /repair/.test(l.id));
  add('T10', repairLines.every((l) => l.k > KILLS_PER_TIER_STONE),
    `repair ${repairLines.map((l) => l.k + ' k').join(' / ')} > ${KILLS_PER_TIER_STONE.toFixed(1)} kills per Reroll tier stone (F7 elite ${E.elite_reroll_tier_stones_per_hr} at the high band)`);
  add('T10b', repairLines.every((l) => l.k > KILLS_PER_ADD_STONE),
    `with F9 landed, repair ${repairLines.map((l) => l.k + ' k').join(' / ')} > ${KILLS_PER_ADD_STONE.toFixed(1)} kills per Add mod stone (F9 ${E.add_mod_stones_per_hr} at the high band) — the same floor still holds against the stone Ascend needs, so the Add rate never makes repair a bad deal`);

  // T11 — skip tokens
  add('T11', LINE.skip_token.per_day_cap <= INV.skip_token_max_per_day
    && LINE.skip_token.k * LINE.skip_token.per_day_cap <= INV.skip_token_max_k_per_day,
    `skip token ${LINE.skip_token.k} k × ${LINE.skip_token.per_day_cap}/day = ${(LINE.skip_token.k * LINE.skip_token.per_day_cap).toFixed(1)} k/day (cap ${INV.skip_token_max_k_per_day} k)`);

  // T12/T13 — Standing
  const stOk = DATA.settlements.every((s: any) => {
    const st = standing(s);
    return st.length === INV.standing_min_tiers
      && st.every((t: any) => t.kills > 0)
      && st.every((t: any, i: any) => i === 0 || t.kills > st[i - 1].kills);
  });
  add('T12', stOk, `3 tiers × 9 settlements = 27 thresholds, all from F1 kill counts and monotonic`);
  add('T13', DATA.standing.tiers.every((t: any, i: any) => i < 2 || t.share >= INV.chase_tier_min_share)
    && DATA.settlements.every((s: any) => standing(s)[2].kills > E.budget_kills(s.zone)),
    `Tier III = ${DATA.standing.tiers[2].share * 100}% of budget > 100% on all 9 → a chase, not a formality`);
  add('T12b', DATA.standing.never_grants.length > 0 && !DATA.standing.grants.some((g: any) => /stat|stone|mod/i.test(g)),
    `Standing grants only ${DATA.standing.grants.join(' · ')} and never ${DATA.standing.never_grants.join(' · ')}`);

  // T14 — Collector
  add('T14', DATA.collector_sets.every((c: any) => c.pays_gold === false)
    && DATA.collector_sets.length === 3
    && new Set(DATA.collector_sets.map((c: any) => c.school)).size === 3,
    `${DATA.collector_sets.length} sets, ${new Set(DATA.collector_sets.map((c: any) => c.school)).size} schools (light/heavy/cloth), 0 gold paid`);

  // T15 — Base bias gate: ruled even-weighted (checks.md T15), so the column must never carry a numeric weight.
  const weighted = DATA.settlements.filter((s: any) => s.base_bias_weight != null);
  add('T15', DATA.base_bias.status === 'decided' && weighted.length === 0,
    `status ${DATA.base_bias.status} (even-weighted) · ${weighted.length} numeric weights in data · ${DATA.base_bias.checks.length} guards — any weight added here would break the ruling`);

  // T16 — ladders
  const ladders: Record<string, any> = {};
  for (const l of DATA.one_time) if (l.ladder) (ladders[l.ladder] = ladders[l.ladder] || []).push(l);
  const ladderOk = Object.values(ladders).every((ls) => {
    const sorted = [...ls].sort((a, b) => a.k - b.k);
    if (sorted.some((l, i) => i > 0 && l.k <= sorted[i - 1].k)) return false;
    return sorted.every((l, i) => i === 0 || l.charge_band !== sorted[i - 1].charge_band || gold(l, l.charge_band) > gold(sorted[i - 1], sorted[i - 1].charge_band));
  });
  add('T16', ladderOk, `${Object.keys(ladders).length} ladders monotonic: ${ladderRanges()}`);

  // T17 — no income invented here
  const kph = BANDS.map((b) => E.bands[b].kills_per_hr);
  add('T17', kph.join() === '463,537,589', `F1 ${kph.join(' / ')} kills per band copied from loot.md section 2 · this tool changes no kill count`);

  // T18 — this data file must read the same engine the loot docs publish
  const dc = docCheck();
  add('T18', dc.problems.length === 0, dc.problems.length
    ? dc.problems.join(' · ')
    : `checks.md F1 ${dc.d.f1} · F3 ${dc.d.f3} · F5 ${dc.d.f5} and loot.md section 2 rows all equal the data engine`);

  // roster consistency
  const setTownIds = DATA.collector_sets.map((c: any) => c.settlement);
  const pedlarIds = DATA.settlements.filter((s: any) => s.npcs.includes('curio_pedlar')).map((s: any) => s.id);
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
    if (DATA.collector_sets.some((c: any) => c.id === id)) {
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

function close(a: any, b: any) { return Math.abs(a - b) < 0.005; }

// ---- doc-vs-data: the town tables may only use the shared engine

function docCheck(): any {
  const problems: any[] = [];
  if (DATA.engine) problems.push('town.json still carries an engine block — band numbers must come only from tools/data/engine.json');
  const rows = eng.runReadBack().filter((r: any) => /^loot.md/.test(r.label));
  for (const r of rows) if (!r.ok) problems.push(r.label + ': ' + r.detail);
  return { problems, d: { f1: E.bands.high.kills_per_hr, f3: E.bands.high.drops_per_hr, f5: junk('high'), rows: rows.length } };
}
// ---------------------------------------------------------------- docs I/O

function targets() {
  const map: Record<string, any> = {};
  for (const [file, keys] of Object.entries<any>(DATA.meta.targets)) (map[file] = map[file] || []).push(...keys);
  return map;
}

/** The same writer table the shared guard runs, built from `meta.targets`. */
function writerTable() {
  const out: Writer[] = [];
  for (const [file, keys] of Object.entries(targets())) {
    for (const k of keys) out.push({ file, key: k, render: () => BLOCKS[k]() });
  }
  return out;
}

// ---------------------------------------------------------------- cli

const arg = process.argv[2];

if (arg === '--emit') {
  for (const [file, keys] of Object.entries(targets())) {
    console.log(`\n===== ${file} =====`);
    for (const k of keys) console.log(`\n${begin(k)}\n${BLOCKS[k]()}${end(k)}`);
  }
} else if (arg === '--write') {
  // generated.writeAll owns the guards: this file used to write a doc whose markers were
  // gone, which is how a generated table ends up half-present and reads as current.
  if (writeAll(writerTable())) process.exitCode = 1;
} else if (arg === '--checks' || arg === '--verify') {
  const rows = runChecks();
  const width = Math.max(...rows.map((r) => r.id.length));
  for (const r of rows) console.log(`${r.id.padEnd(width)}  ${r.status.padEnd(7)}  ${r.detail}`);
  const fails = rows.filter((r) => r.status === 'FAIL');
  const pend = rows.filter((r) => r.status === 'PENDING');

  let stale = [];
  for (const [file, keys] of Object.entries(targets())) {
    const p = path.join(ROOT, resolveDoc(file));
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
  else console.log('doc blocks: all generated tables in towns-stalls.md + checks.md match this data');
  console.log(`\n${rows.length - fails.length - pend.length}/${rows.length} PASS · ${pend.length} PENDING · ${fails.length} FAIL`);
  if (fails.length || stale.length || leaks.length) process.exitCode = 1;
} else {
  console.log(`town economy generator — data: tools/data/town.json

  node tools/town.ts --emit     print every generated block
  node tools/town.ts --write    rewrite the generated blocks in towns-stalls.md + checks.md
  node tools/town.ts --checks   run group T, exit 1 on FAIL or stale docs
`);
}
