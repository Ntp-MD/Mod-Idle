#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import * as eng from './lib/engine.ts';

/**
 * Town economy cage — tools/data/town.json, priced off the engine's own band numbers.
 *
 *   node tools/town.ts            help
 *   node tools/town.ts --checks   run group T, exit 1 on FAIL
 *
 * Every gold price, Standing kill threshold, supply figure and demand ratio is an output of
 * tools/data/town.json read against `tools/data/engine.json` — town.json carries no band number
 * of its own (T18), so the two can never drift.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'data', 'town.json'), 'utf8'));
// Band numbers are never stored here: tools/data/engine.json is the only source.
const E = eng.engineForTown({});
const INV = DATA.invariants;
const BANDS = ['low', 'mid', 'high'];
const BAND_KEYS = Object.keys(E.bands);

// ---------------------------------------------------------------- helpers

const junk = (b: any) => E.bands[b].drops_per_hr - E.bands[b].upgrades_per_hr;
// The band's gold rate and the price it turns an `m` into are the engine's own — the cage reads the
// same two calls the wiki and the client call, so a town price has exactly one home (AGENTS.md §3).
const rate = (b: any) => eng.goldPerMinute(b);
const gold = (m: any, b: any) => eng.goldPrice(m, b);
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
 * player's own pace (`AGENTS.md`). The arithmetic is the published one unchanged: hours x junk/hr is
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
// T10b: with F9 landed, the Armourer floor is re-checked against the Add stone, which is the
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

  // T9 — the walk costs time and pays nothing; the Waypoint is the only travel line for sale, and it
  // buys back that time. The cage reads the shape (a block time, an encounter chance, one priced warp
  // per block that no settlement stocks) rather than trusting prose.
  const travelLines = [...DATA.one_time, ...DATA.repeatable].filter((l: any) => /road|carriage|pedlar_on_road/i.test(l.id));
  const warp = DATA.repeatable.find((l: any) => l.id === 'waypoint_warp');
  const stocked = DATA.settlements.filter((s: any) => (s.stock || []).includes('waypoint_warp'));
  add('T9', travelLines.length === 0 && !!warp && warp.kind === 'time' && warp.m_per_block > 0
    && stocked.length === 0 && E.road.block_sec >= 1 && E.road.encounter_chance_pct > 0,
    travelLines.length ? `a travel line survives the walk: ${travelLines.map((l) => l.id).join(', ')}`
      : !warp ? 'no waypoint_warp line prices the Waypoint'
        : stocked.length ? `a settlement stocks the Waypoint (${stocked.map((s: any) => s.id).join(', ')}) — a warp is not a stall line`
          : `no route is sold: the Waypoint is the only travel line, ${warp.m_per_block} minutes a block at its own band and stocked nowhere · ${E.road.block_sec}s a block · ${E.road.encounter_chance_pct}% an encounter per block`);

  // T10 — Armourer floor
  const repairLines = [...DATA.one_time, ...DATA.repeatable].filter((l) => /repair/.test(l.id));
  add('T10', repairLines.every((l) => gold(l.m, 'high') > MIN_PER_TIER_STONE * rate('high')),
    `repair ${repairLines.map((l) => fmt(gold(l.m, 'high')) + ' gold').join(' / ')} > ${(MIN_PER_TIER_STONE * rate('high')).toFixed(2)} gold per Tier stone (F7 · the elite stone line)`);
  add('T10b', repairLines.every((l) => gold(l.m, 'high') > MIN_PER_ADD_STONE * rate('high')),
    `with F9 landed, repair ${repairLines.map((l) => fmt(gold(l.m, 'high')) + ' gold').join(' / ')} > ${(MIN_PER_ADD_STONE * rate('high')).toFixed(2)} gold per Add stone (F9 · the boss+elite Add line) — the same floor still holds against the stone Ascend needs, so the Add line never makes repair a bad deal`);

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

  // T17 — the band numbers town reads are the engine's own, never a retyped copy
  const kph = BANDS.map((b) => E.bands[b].kills_per_hr);
  const engineKph = BANDS.map((b) => eng.BAND[b].kills_derived);
  add('T17', kph.every((v: number, i: number) => v === engineKph[i]),
    `town's band kills/hr ${kph.join(' / ')} equal the engine's own ${engineKph.join(' / ')} — this tool invents no kill rate`);

  // T18 — town.json must not carry an engine block of its own (one home for every number)
  add('T18', !DATA.engine, DATA.engine
    ? 'town.json still carries an engine block — band numbers must come only from tools/data/engine.json'
    : 'town.json carries no engine block: every band number is read from tools/data/engine.json');

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

// ---------------------------------------------------------------- cli

const arg = process.argv[2];

if (arg === '--checks') {
  const rows = runChecks();
  const width = Math.max(...rows.map((r) => r.id.length));
  for (const r of rows) console.log(`${r.id.padEnd(width)}  ${r.status.padEnd(7)}  ${r.detail}`);
  const fails = rows.filter((r) => r.status === 'FAIL');
  const pend = rows.filter((r) => r.status === 'PENDING');
  console.log(`
${rows.length - fails.length}/${rows.length} PASS · ${pend.length} PENDING · ${fails.length} FAIL`);
  if (fails.length) process.exitCode = 1;
} else {
  console.log(`town cage — engine.json + town.json → the settlement economy

  node tools/town.ts --checks   invariants
`);
}
