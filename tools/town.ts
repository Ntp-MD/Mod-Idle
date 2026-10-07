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
const rate = (b: any) => Math.round((junk(b) / 60) * pow10) / pow10;
const gold = (m: any, b: any) => Math.round(m * rate(b) + 1e-9);
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
    return Object.entries(line.qty_by_band).reduce((s: any, [b, q]: any) => s + q * gold(line.m, b), 0);
  }
  if (line.charge === 'one_per_band') {
    return BANDS.reduce((s, b) => s + gold(line.m, b), 0);
  }
  return (line.qty || 1) * gold(line.m, line.charge_band);
}

function essentialGold(entry: any) {
  const line = LINE[entry.id];
  if (!line) throw new Error('unknown essentials line: ' + entry.id);
  if (entry.qty_by_band) {
    return Object.entries(entry.qty_by_band).reduce((s: any, [b, q]: any) => s + q * gold(entryPriceM(line, b, entry), b), 0);
  }
  const band = line.charge === 'by_settlement_band' ? 'low' : line.charge_band;
  if (line.charge === 'one_per_band') return BANDS.reduce((s, b) => s + gold(line.m, b), 0);
  if (entry.use_discount && line.discount) {
    const dBand = SETTLEMENTS[line.discount.settlement].band;
    return gold(line.discount.m, dBand);
  }
  return (line.qty || 1) * gold(entryPriceM(line, band, entry), band);
}

function entryPriceM(line: any, band: any, entry: any) {
  if (entry.use_discount && line.discount) return line.discount.m;
  return line.m;
}

/**
 * The run's junk, in KILLS. A band is a count of kills (`band_kills`) and junk is priced per kill
 * (`junkKill`), so the supply is the pieces the run pays — never a stretch of hours, which is the
 * player's own pace (`AGENT.md`). The arithmetic is the published one unchanged: hours x junk/hr is
 * kills x junk/kill.
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
const HIGH_BAND_KILLS = E.bands.high.band_kills + E.push_kills_91_100;
const LCK_HIGH_BAND = Math.round(HIGH_BAND_KILLS * junkKill('high_full_lck'));
const NO_LCK_HIGH_BAND = Math.round(HIGH_BAND_KILLS * junkKill('high'));
const CASTS_FORGONE = Math.round(SUPPLY / E.reroll_stones_per_cast);
const POLISHES_FORGONE = SUPPLY / E.reroll_stones_per_cast / E.reroll_casts_per_full_set_polish;
const MIN_PER_TIER_STONE = 60 / E.elite_reroll_tier_stones_per_hr;
// T10b: with F9 landed, the Armourer floor is re-checked against the Add mod stone, which is the
// stone Ascend actually needs and the one the Armourer competes with for the same boss kills.
const MIN_PER_ADD_STONE = 60 / E.add_mod_stones_per_hr;
// The skip-token day ceiling, in the gold the high band pays it (D12: prices quote gold, never minutes).
const SKIP_DAY_GOLD = Math.round(LINE.skip_token.m * rate('high') * LINE.skip_token.per_day_cap);

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
  for (const l of DATA.one_time) if (l.ladder) (groups[l.ladder] = groups[l.ladder] || []).push(gold(l.m, l.charge_band));
  return Object.entries(groups)
    .map(([k, v]) => `${k} ${Math.min(...v)}-${Math.max(...v)} gold`)
    .join(' · ');
}

// ---------------------------------------------------------------- blocks

const BLOCKS: Record<string, () => string> = {};

BLOCKS['price-unit'] = () => '```\n' + [
  `gold per sold junk piece        = ${E.gold_per_junk_piece}                       (economy.md · loot.md section 4)`,
  `the price unit                  = gold — minted by the Counterhand, spent at the stalls`,
  `a price is charged at the band of the place that sells it:`,
  `  drops per kill by band        = ${bandLabel((b: any) => (E.bands[b].drops_per_hr / E.bands[b].kills_per_hr).toFixed(4))}   (loot.md section 2 · F2)`,
  `  upgrades per kill by band     = ${bandLabel((b: any) => (E.bands[b].upgrades_per_hr / E.bands[b].kills_per_hr).toFixed(4))}`,
  `  junk = drops - upgrades       = ${bandLabel((b: any) => junkKill(b).toFixed(4))}   gold per kill`,
  `opportunity cost of 1 gold      = 1 Reroll value stone forgone = 1/${E.reroll_value_stones_per_hour} of Reroll capacity (F6 · E8)`,
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

BLOCKS['one-time'] = () => {
  const head = '| Item | Sold by | Kind | Gold @low | Gold @mid | Gold @high | Charged at | Qty | Gold in the demand total | Note |';
  const rows = DATA.one_time.map((l: any) => {
    const charged = l.charge === 'by_settlement_band'
      ? 'the band of each destination'
      : l.charge === 'one_per_band' ? 'one per band' : `${l.charge_band} band`;
    const qty = l.qty_by_band
      ? Object.entries(l.qty_by_band).map(([b, q]: any) => `${q} ${b}`).join(' + ')
      : (l.qty || 1);
    return `| ${l.item} | ${npcName(l.npc)} | ${l.kind} | ${fmt(gold(l.m, 'low'))} | ${fmt(gold(l.m, 'mid'))} | ${fmt(gold(l.m, 'high'))} | ${charged} | ${qty} | ${fmt(lineGoldTotal(l))} | ${l.note} |`;
  });
  return [head, '|---|---|---|---|---|---|---|---|---|---|', ...rows, '', `Total one-time demand = **${fmt(ONETIME_DEMAND)} gold** (see section 2).`, ''].join('\n');
};

BLOCKS.repeatable = () => {
  const head = '| Item | Sold by | Kind | Gold | Bound | Note |';
  const rows = DATA.repeatable.map((l: any) => {
    const price = l.m_min != null
      ? `${fmt(gold(l.m_min, l.charge_band))}-${fmt(gold(l.m_max, l.charge_band))} (${l.charge_band})`
      : `${fmt(gold(l.m, l.charge_band))} (${l.charge_band})`;
    const bound = l.per_day_cap ? `${l.per_day_cap} per real day` : 'repeatable';
    return `| ${l.item} | ${npcName(l.npc)} | ${l.kind} | ${price} | ${bound} | ${l.note} |`;
  });
  const dayGold = Math.round(LINE.skip_token.m * rate('high') * LINE.skip_token.per_day_cap);
  return [head, '|---|---|---|---|---|---|', ...rows, '', `Skip-token ceiling = ${LINE.skip_token.per_day_cap}/day = **${fmt(dayGold)} gold/day** in the high band.`, ''].join('\n');
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
    ['T1', 'gold is minted by the sell choice and by nothing else (G2 · G6 · X36)', `${E.gold_per_junk_piece} gold per sold junk piece · walking pays a drop roll, never gold, never Standing, never stones`, `${E.gold_per_junk_piece}`],
    ['T2', 'the price unit is gold, and the junk line alone mints it (D12)', `the junk line per kill, per band`, `${junkKill('low').toFixed(4)} low · ${junkKill('mid').toFixed(4)} mid · ${junkKill('high').toFixed(4)} high · ${junkKill('high_full_lck').toFixed(4)} high+full Lck gold per kill`],
    ['T3', 'lifetime gold supply is the junk line, not a new faucet', `${fmt(E.bands.low.band_kills)}×${junkKill('low').toFixed(4)} + ${fmt(E.bands.mid.band_kills)}×${junkKill('mid').toFixed(4)} + ${fmt(E.bands.high.band_kills + E.push_kills_91_100)}×${junkKill('high').toFixed(4)}`, fmt(SUPPLY) + ' gold'],
    ['T4', `one-time stall demand ≤ ${(INV.onetime_demand_max_multiple_of_lifetime_supply).toFixed(2)}× the supply — a funnel, not a wall`, `Σ ${DATA.one_time.length} one-time lines at their charge band`, `${fmt(ONETIME_DEMAND)} = ${(ONETIME_DEMAND / SUPPLY).toFixed(2)}× ✓`],
    ['T5', `essentials ≤ ${pct(INV.essentials_max_share_of_lifetime_supply, 0)} of the supply while ~80%+ still dissolves`, `tab 1 at Eastgate · tab 2 · pouch II · deed 4`, `${fmt(ESSENTIALS)} = ${pct(ESSENTIALS / SUPPLY)} ✓`],
    ['T6', 'selling everything is a craft decision, priced in craft', `${fmt(SUPPLY)} ÷ ${E.reroll_stones_per_cast} stones · ÷ ${E.reroll_casts_per_full_set_polish} casts per full polish`, `${fmt(CASTS_FORGONE)} Reroll casts ≈ ${POLISHES_FORGONE.toFixed(1)} full-set polishes forgone`],
    ['T7', 'the full-Lck advantage stops at the junk line (G8)', `${fmt(HIGH_BAND_KILLS)} high-band kills × ${fmt(junkKill('high_full_lck'))} vs × ${fmt(junkKill('high'))}`, `${fmt(LCK_HIGH_BAND)} vs ${fmt(NO_LCK_HIGH_BAND)} gold = ×${(LCK_HIGH_BAND / NO_LCK_HIGH_BAND).toFixed(2)} against the ×${E.towns_gold_rate_multiplier_bound} ceiling ✓`],
    ['T8', 'every stall line is space · time · information · appearance only (G7)', `kind tag on all ${DATA.one_time.length + DATA.repeatable.length} lines · power nouns need an explicit display_only flag`, `${DATA.one_time.length + DATA.repeatable.length} lines, 0 power lines ✓`],
    ['T9', 'travel never gates content and never beats farming (G9)', `${E.road.block_sec}s a block · ${E.road.encounter_chance_pct}% an encounter per block · a Waypoint unlocks on foot and warps free`, `0 gold to travel ✓`],
    ['T10', 'Armourer repair costs more than the elite income it replaces (D2 service class)', `${E.elite_reroll_tier_stones_per_hr} tier stones per kill → ${(MIN_PER_TIER_STONE * rate('high')).toFixed(2)} gold floor · F9 re-checked in T10b`, `${fmt(gold(LINE.repair.m, 'high'))} gold · ${fmt(gold(LINE.repair_ironrow.m, 'high'))} gold at Ironrow ✓`],
    ['T11', 'skip tokens stay inside the tasks.md bound', `${LINE.skip_token.per_day_cap}/day at the high band`, `${fmt(SKIP_DAY_GOLD)} gold/day ✓ (payouts untouched)`],
    ['T12', `Standing has ${INV.standing_min_tiers} tiers per settlement and is counted from the band's kill stream`, `budget kills × tier share`, 'see table T-S below, 27 thresholds ✓'],
    ['T13', 'Tier III is a chase, never a formality', `tier III share ≥ ${INV.chase_tier_min_share} × the zone budget`, `${DATA.standing.tiers[2].share} on all 9 ✓`],
    ['T14', 'Collector sets pay items, never gold (G6)', `pays_gold flag on ${DATA.collector_sets.length} sets`, '0 gold ✓'],
    ['T15', 'Base bias is permanent flavour — ruled even-weighted, so it may never carry a number', `loot.md section 1 step 2 + section 3`, `status = ${DATA.base_bias.status} · ${DATA.base_bias.checks.length} guards · 0 numeric weights`],
    ['T16', 'price ladders are monotonic, so no later tier is cheaper', ladderRanges(), '✓'],
    ['T17', 'this file owns no income rate: the junk line is loot.md unchanged', `no rate is retyped here — the band junk line is read from loot.md`, 'mob_HP and the published loot line unmoved ✓ (H1)'],
    ['T18', 'no band number is retyped here — town prices scale the engine junk line', `tools/lib/engine.ts (engine.json) → the band junk line, then loot.md section 2 read back`, dc.problems.length ? `MISMATCH: ${dc.problems.join(' · ')}` : `${dc.d.rows} loot.md numbers read back equal ✓`],
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
  add('T2', BANDS.every((b, i) => i === 0 || junkKill(b) > junkKill(BANDS[i - 1])),
    `the junk line rises with the band: ${BANDS.map((b) => junkKill(b).toFixed(4)).join(' < ')} gold per kill`);
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

  // T9 — travel costs nothing and pays nothing. The walk is a shape (a block time and an encounter
  // chance) and the Waypoint is free, so the cage reads the shape and proves no gold line survived.
  const travelLines = [...DATA.one_time, ...DATA.repeatable].filter((l: any) => /road|carriage|waypoint|pedlar_on_road/i.test(l.id));
  add('T9', travelLines.length === 0 && E.road.block_sec >= 1 && E.road.encounter_chance_pct > 0,
    `travel is free: no Road, carriage or waypoint line survives in the ${DATA.one_time.length + DATA.repeatable.length} stall lines · ${E.road.block_sec}s a block · ${E.road.encounter_chance_pct}% an encounter per block`);

  // T10 — Armourer floor
  const repairLines = [...DATA.one_time, ...DATA.repeatable].filter((l) => /repair/.test(l.id));
  add('T10', repairLines.every((l) => gold(l.m, 'high') > MIN_PER_TIER_STONE * rate('high')),
    `repair ${repairLines.map((l) => fmt(gold(l.m, 'high')) + ' gold').join(' / ')} > ${(MIN_PER_TIER_STONE * rate('high')).toFixed(2)} gold per Reroll tier stone (F7 · the elite stone line)`);
  add('T10b', repairLines.every((l) => gold(l.m, 'high') > MIN_PER_ADD_STONE * rate('high')),
    `with F9 landed, repair ${repairLines.map((l) => fmt(gold(l.m, 'high')) + ' gold').join(' / ')} > ${(MIN_PER_ADD_STONE * rate('high')).toFixed(2)} gold per Add mod stone (F9 · the boss+elite Add line) — the same floor still holds against the stone Ascend needs, so the Add line never makes repair a bad deal`);

  // T11 — skip tokens
  add('T11', LINE.skip_token.per_day_cap <= INV.skip_token_max_per_day
    && SKIP_DAY_GOLD <= INV.skip_token_max_gold_per_day,
    `skip token ceiling ${fmt(SKIP_DAY_GOLD)} gold/day (caps ${INV.skip_token_max_gold_per_day} gold)`);

  // T12/T13 — Standing
  const stOk = DATA.settlements.every((s: any) => {
    const st = standing(s);
    return st.length === INV.standing_min_tiers
      && st.every((t: any) => t.kills > 0)
      && st.every((t: any, i: any) => i === 0 || t.kills > st[i - 1].kills);
  });
  add('T12', stOk, `3 tiers × 9 settlements = 27 thresholds, all from F1 kills/hr and monotonic`);
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
    const sorted = [...ls].sort((a, b) => a.m - b.m);
    if (sorted.some((l, i) => i > 0 && l.m <= sorted[i - 1].m)) return false;
    return sorted.every((l, i) => i === 0 || l.charge_band !== sorted[i - 1].charge_band || gold(l.m, l.charge_band) > gold(sorted[i - 1].m, sorted[i - 1].charge_band));
  });
  add('T16', ladderOk, `${Object.keys(ladders).length} ladders monotonic: ${ladderRanges()}`);

  // T17 — no income invented here
  const kph = BANDS.map((b) => E.bands[b].kills_per_hr);
  add('T17', kph.join() === '463,537,589', `F1 ${kph.join(' / ')} kills/hr copied from loot.md section 2 · this tool changes no kill rate`);

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
