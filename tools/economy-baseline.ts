/**
 * Phase A of `docs/economy-world-life-ideas.md`: measure the economy that exists today.
 *
 *   node --experimental-strip-types tools/economy-baseline.ts
 *
 * Read-only. Prints the catalogue and its uses, each settlement's market and reach, the sale
 * routes a traveller can choose, and every current gold source and sink. Prices come from the
 * shared engine; travel comes from the Road; nothing here is copied from a doc or a hand count.
 */

import path from 'node:path';
import { readJson } from './lib/json.ts';
import { createTrade, type TradeCfg, type TradeGood } from '../engine/trade.ts';
import { createRoad } from '../engine/road.ts';
import { createEngine } from '../engine/index.ts';
import type { EngineData } from '../engine/types.ts';

interface TownRow {
  id: string; name: string; zone: number; band: string; capital?: string | null;
  start?: boolean; stock: string[];
}
interface ShopRow {
  id: string; item: string; kind: string; m?: number; m_min?: number; m_max?: number;
  m_per_block?: number; charge_band?: string; per_day_cap?: number; qty?: number; required_standing_tier?: number;
}
interface TownData {
  settlements: TownRow[];
  trade: TradeCfg;
  delivery: {
    premium_base: number; premium_per_difficulty: number; choice_reward_mult: number;
    reward_modes: string[];
  };
  one_time: ShopRow[];
  repeatable: ShopRow[];
  black_market: {
    refresh_interval_sec: number; offers_per_refresh: number; item_count_min: number; item_count_max: number;
    stones: { key: string; count_min: number; count_max: number; price_gold: number }[];
  };
}

const root = path.resolve(import.meta.dirname, '..');
const E = readJson<EngineData>(path.join(root, 'tools/data/engine.json'));
const T = readJson<TownData>(path.join(root, 'tools/data/town.json'));
const trade = createTrade(E, T.trade);
const road = createRoad(E);
const eng = createEngine(E);

const BUCKETS = ['junk', 'material', 'food', 'herb'] as const;
const startTown = T.settlements.find((town) => town.start) || T.settlements[0];
const townById = new Map(T.settlements.map((town) => [town.id, town]));
const money = (value: number, digits = 2) => `${value.toFixed(digits)}g`;
const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const sections: string[] = [];
const section = (title: string, lines: string[]) => sections.push([`## ${title}`, ...lines].join('\n'));

const warpRow = T.repeatable.find((row) => row.id === 'waypoint_warp');
const warpBand = warpRow?.charge_band || 'mid';
const warpPerBlock = warpRow?.m_per_block || 0;
const goldPerMinute = (band: string) => eng.goldPerMinute(band);
const shopGold = (minutes: number, band: string) => Math.round(minutes * goldPerMinute(band) * 100) / 100;
const warpGold = (blocks: number) => shopGold(warpPerBlock * blocks, warpBand);
const walkSec = (from: string, to: string) => road.secBetween(from, to);

const originOf = (good: TradeGood) => {
  for (const zone of good.sourceZones) {
    const town = T.settlements.find((settlement) => settlement.zone === zone);
    if (town) return town.id;
  }
  return startTown.id;
};

const settlementsWithMarkets = T.settlements.filter((town) => Object.hasOwn(T.trade.towns, town.id));

/* ---- catalogue ------------------------------------------------------------------------------- */

const catalogue = BUCKETS.map((bucket) => {
  const goods = trade.goods.filter((good) => good.bucket === bucket);
  const valued = goods.map((good) => good.value);
  const used = goods.filter((good) => good.uses.length > 0).length;
  return `| ${bucket} | ${goods.length} | ${valued.length ? money(Math.min(...valued)) : '—'} | ${valued.length ? money(Math.max(...valued)) : '—'} | ${used} |`;
});
const unused = trade.goods.filter((good) => good.uses.length === 0 && good.bucket !== 'junk');
section('Catalogue', [
  'Base values are the engine\'s own; a use is a cooking, workshop or Smithing recipe that names the good.',
  '',
  '| bucket | goods | min base | max base | named by a recipe |',
  '|---|---:|---:|---:|---:|',
  ...catalogue,
  '',
  `${trade.goods.length} goods total · ${trade.goods.filter((good) => good.uses.length > 0).length} named by a recipe.`,
  unused.length ? `${unused.length} non-junk goods have no recipe use: ${unused.slice(0, 12).map((good) => good.key).join(', ')}${unused.length > 12 ? ', …' : ''}.` : 'Every non-junk good has a recipe use.',
  `A town's premium is paid from ${money(T.trade.capacity_gold)} of sale volume per category and refills over ${T.trade.recovery_sec / 3600}h; below the premium the same sale still pays ${pct(T.trade.floor_mult)} of base.`,
  `Junk sells only through the market; it is not a recipe input, so its uses are zero by design.`,
]);

/* ---- settlements and reach ------------------------------------------------------------------- */

const reach = settlementsWithMarkets.map((town) => {
  const blocks = road.blocksBetween(startTown.id, town.id);
  const profile = T.trade.towns[town.id];
  return `| ${town.name} | ${town.zone} | ${town.band} | ${profile.imports.length} | ${profile.exports.length} | ${blocks} | ${(walkSec(startTown.id, town.id) / 60).toFixed(1)} min | ${money(warpGold(blocks))} |`;
});
section('Settlements, market profiles and reach from ' + startTown.name, [
  'Imports/exports are market categories (`good.id` or group) from `town.json`; a premium applies to both lists, below base for exports.',
  '',
  '| settlement | zone | band | imports | exports | blocks | walk | warp |',
  '|---|---:|---|---:|---:|---:|---:|---:|',
  ...reach,
]);

/* ---- sale routes ------------------------------------------------------------------------------ */

const LOT = 10;
interface Route {
  good: TradeGood; origin: string; local: number; localGold: number;
  walkTown: string; walkGold: number; walkBlocks: number; walkSec: number;
  warpTown: string; warpGross: number; warpFare: number; warpNet: number; warpBlocks: number;
}
const routes: Route[] = [];
for (const good of trade.goods) {
  const origin = originOf(good);
  const local = trade.quote(origin, good, LOT, undefined, 0);
  let walk = { town: origin, quote: local, blocks: 0 };
  let warp = { town: origin, quote: local, blocks: 0, fare: 0 };
  for (const town of settlementsWithMarkets) {
    if (town.id === origin) continue;
    const quote = trade.quote(town.id, good, LOT, undefined, 0);
    const blocks = road.blocksBetween(origin, town.id);
    if (quote.gold > walk.quote.gold) walk = { town: town.id, quote, blocks };
    const fare = warpGold(blocks);
    if (quote.gold - fare > warp.quote.gold - warp.fare) warp = { town: town.id, quote, blocks, fare };
  }
  routes.push({
    good, origin, local: local.gold, localGold: local.gold,
    walkTown: walk.town, walkGold: walk.quote.gold, walkBlocks: walk.blocks, walkSec: walk.blocks * E.road.block_sec,
    warpTown: warp.town, warpGross: warp.quote.gold, warpFare: warp.fare, warpNet: warp.quote.gold - warp.fare, warpBlocks: warp.blocks,
  });
}

const opportunities = routes
  .map((route) => {
    const walkExtra = route.walkGold - route.local;
    const warpExtra = route.warpNet - route.local;
    return { ...route, walkExtra, warpExtra, walkPerHour: route.walkSec > 0 ? walkExtra / (route.walkSec / 3600) : 0 };
  })
  .sort((a, b) => b.walkPerHour - a.walkPerHour);
const remoteWalk = opportunities.filter((route) => route.walkExtra > 0);
const remoteWarp = opportunities.filter((route) => route.warpExtra > 0);
const farthestBlocks = Math.max(...settlementsWithMarkets.map((town) => road.blocksBetween(startTown.id, town.id)));
const top = opportunities.slice(0, 10).map((route) => `| ${route.good.key} (${route.good.bucket}) | ${townById.get(route.origin)?.name} | ${townById.get(route.walkTown)?.name} | ${route.walkBlocks} | ${money(route.local)} | ${money(route.walkGold)} | ${money(route.walkExtra)} | ${money(route.walkPerHour, 0)}/h | ${money(route.warpNet)} (fare ${money(route.warpFare)}) |`);
section('Sale routes at a ten-unit lot', [
  'Origin is the first zone that sources the good (the start settlement when nothing sources it). Local is a fresh quote at the origin; walk is the best fresh quote at another market, warp is that quote minus the Waypoint fare. Haggling is zero and no market has sold yet, so these are the best-case prices.',
  '',
  '| good | origin | best walk | blocks | local | walk gross | extra over local | extra per walking hour | best warp net |',
  '|---|---|---|---:|---:|---:|---:|---:|---:|',
  ...top,
  '',
  `Goods with a higher fresh quote elsewhere: ${remoteWalk.length}/${routes.length} by walking; ${remoteWarp.length}/${routes.length} stay ahead of the local sale after the warp fare.`,
  `The Road charges ${E.road.block_sec}s per block, so all ${settlementsWithMarkets.length} settlements sit within ${farthestBlocks} seconds of ${startTown.name}; the walking-hour column is a rate, not a realistic session.`,
  `Median walking premium over local: ${money(median(remoteWalk.map((route) => route.walkExtra)))} per ten-unit lot; median walking extra per hour: ${money(median(remoteWalk.map((route) => route.walkPerHour)), 0)}.`,
  `Median warp premium after fare: ${money(median(remoteWarp.map((route) => route.warpExtra)))}; median warp fare: ${money(median(opportunities.map((route) => route.warpFare)))}.`,
]);

const unitCap = BUCKETS.map((bucket) => {
  const goods = trade.goods.filter((good) => good.bucket === bucket);
  const units = goods.map((good) => T.trade.capacity_gold / good.value).filter(Number.isFinite).sort((a, b) => a - b);
  return `| ${bucket} | ${units.length ? units[0].toFixed(1) : '—'} | ${units.length ? units[Math.floor(units.length / 2)].toFixed(1) : '—'} | ${units.length ? units[units.length - 1].toFixed(1) : '—'} |`;
});
section('Premium capacity in units', [
  `\`capacity_gold\` is sale volume (units × base value), shared by the whole category at a town. These are the units one town can buy before only the ${pct(T.trade.floor_mult)} floor remains, if nothing else has sold there.`,
  '',
  '| bucket | fewest units (dearest good) | median | most units (cheapest good) |',
  '|---|---:|---:|---:|',
  ...unitCap,
]);

/* ---- gold sources and sinks ------------------------------------------------------------------ */

const deliveryRows = [1, 5, 10, 20, 40].map((difficulty) => {
  const factor = 1 + (T.delivery.premium_base + difficulty * T.delivery.premium_per_difficulty - 1);
  const bonus = factor - 1;
  return `| ${difficulty} | ${(bonus * 100).toFixed(0)}% | ${(bonus * T.delivery.choice_reward_mult * 100).toFixed(0)}% |`;
});
section('Gold sources', [
  'The client adds gold in exactly two places: a market sale (`sim/trade.ts`) and a paid Delivery/quest bonus (`sim/quest-rewards.ts`). Mob kills mint no gold themselves — their junk must be sold. Tasks pay stones, not gold.',
  '',
  '| band | reference junk income / minute |',
  '|---|---:|',
  ...['low', 'mid', 'high'].map((band) => `| ${band} | ${money(goldPerMinute(band))} |`),
  '',
  '`goldPerMinute` is the band\'s full-sell junk income; town service prices are minutes of it. Delivery adds a premium over the market quote of the delivered goods:',
  '',
  '| difficulty | bonus over quote | choice-gold bonus |',
  '|---:|---:|---:|',
  ...deliveryRows,
  '',
  `Delivery reward modes: ${T.delivery.reward_modes.join(' / ')}; the gold alternative multiplies the bonus by ${T.delivery.choice_reward_mult}.`,
]);

const shopPrice = (row: ShopRow) => {
  const band = row.charge_band || 'mid';
  if (row.m_per_block != null) return null;
  if (row.m != null) return shopGold(row.m, band);
  if (row.m_min != null && row.m_max != null) return `${money(shopGold(row.m_min, band))}–${money(shopGold(row.m_max, band))}`;
  return null;
};
const oneTimeTotal = T.one_time.reduce((sum, row) => sum + (typeof shopPrice(row) === 'number' ? shopPrice(row) as number : 0), 0);
const repeatable = T.repeatable.map((row) => {
  const price = shopPrice(row);
  return `| ${row.item} | ${typeof price === 'number' ? money(price) : price ?? 'per block'} | ${row.per_day_cap ?? '—'} | ${row.required_standing_tier ?? 0} |`;
});
section('Gold sinks', [
  `Stall lines are priced in minutes of their charge band; the Waypoint is the only per-block line. No rent, upkeep, daily upkeep or offline charge exists in the data.`,
  '',
  `One-time stall lines total ${money(oneTimeTotal)} if every line is bought once (before Haggling). Repeatable lines:`,
  '',
  '| line | price | per day | Standing tier |',
  '|---|---|---:|---:|',
  ...repeatable,
  '',
  `Waypoint: ${money(warpPerBlock * goldPerMinute(warpBand))} per block (${warpPerBlock} minutes × ${money(goldPerMinute(warpBand))}), paid at the ${warpBand} band; a crossing from ${startTown.name} of 20 blocks costs ${money(warpGold(20))}.`,
  `Black Market: ${T.black_market.offers_per_refresh} offers every ${T.black_market.refresh_interval_sec / 60} min, ${T.black_market.item_count_min}–${T.black_market.item_count_max} materials each, plus ${T.black_market.stones.length} priced stone lines (${T.black_market.stones.map((stone) => `${stone.key} ${money(stone.price_gold)}`).join(', ')}).`,
]);

/* ---- current invariants ---------------------------------------------------------------------- */

function bulkVsSplit(goodId: string, units: number, town: string) {
  const good = trade.byId[goodId];
  let bulk = trade.quote(town, good, units, undefined, 0);
  let bulkCredit = 0;
  const bulkSettled = trade.settleCurrency(bulk.gold, bulkCredit);
  bulkCredit = bulkSettled.credit;
  let supply: { used: number; atSec: number } | undefined;
  let splitGold = 0, credit = 0;
  for (let sold = 0; sold < units; sold += LOT) {
    const count = Math.min(LOT, units - sold);
    const quote = trade.quote(town, good, count, supply, 0);
    supply = { used: quote.used, atSec: quote.atSec };
    const settled = trade.settleCurrency(quote.gold, credit);
    splitGold += settled.gold;
    credit = settled.credit;
  }
  return { bulk: bulkSettled.gold, split: splitGold, bulkCredit, splitCredit: credit };
}
const parity = bulkVsSplit('material:copper-ore', 500, startTown.id);
const parityOk = Math.abs(parity.bulk - parity.split) < 1e-9 && Math.abs(parity.bulkCredit - parity.splitCredit) < 1e-9;
section('Phase A findings', [
  `Gold enters only from market sales and Delivery bonus gold; mob kills themselves mint nothing. Any new city budget must therefore count as a real source, and the basic buy channel is the only unlimited mint in the current loop.`,
  `Travel cannot carry a time cost at ${E.road.block_sec}s per block: the whole market map is ${farthestBlocks}s away, while a warp costs ${money(warpGold(3))}–${money(warpGold(farthestBlocks))}. A time-limited event cannot make walk-or-warp a real choice until travel time or the warp price changes; do not lock event durations against the current route times.`,
  `Premium capacity is sale volume, not units: the dearest junk exhausts a town's ${money(T.trade.capacity_gold)} premium in ${(T.trade.capacity_gold / Math.max(...trade.goods.filter((good) => good.bucket === 'junk').map((good) => good.value))).toFixed(1)} units. The Phase B ledger therefore keeps real stock and a real budget; \`capacity_gold\` cannot stand in for either.`,
]);

section('Current invariants', [
  `Bulk vs split at ${startTown.name}, 500 copper ore: bulk ${money(parity.bulk)} + ${parity.bulkCredit.toFixed(6)} credit; 50 × 10 split ${money(parity.split)} + ${parity.splitCredit.toFixed(6)} credit.`,
  parityOk ? 'PASS — the sale path already matches the plan\'s one-transaction accounting.' : 'FAIL — the existing sale path breaks bulk/split parity.',
  `The quote is still shared per category at a town (${Object.keys(T.trade.towns).length} market profiles); the Phase B ledger adds real stock and a city budget beside it, so the sale formula itself does not need a new copy.`,
]);

console.log(sections.join('\n\n'));
if (!parityOk) process.exitCode = 1;
