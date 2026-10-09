import fs from 'node:fs';
import path from 'node:path';
import * as eng from './lib/engine.ts';
import { readJson } from './lib/json.ts';
import { createLoot } from '../engine/loot.ts';

/**
 * Loot cage — the drop pipeline, measured instead of asserted.
 *
 *   node tools/loot.ts                help
 *   node tools/loot.ts --emit         print the generated measured-results block
 *   node tools/loot.ts --write        rewrite the measured-results block in loot.md
 *   node tools/loot.ts --checks       invariants + stale-block check (checks.md F4 / F11 / T15)
 *   node tools/loot.ts --sim          raw numbers, no block
 *   node tools/loot.ts --bias         the Base-bias experiment towns.md section 4 needs (T15)
 *
 * Nothing here is invented. Every input is read from the repo:
 *   drop rate, kills/hr, Lck      tools/data/engine.json `loot` (via lib/engine.js BAND)
 *   Mod value ranges + quality    tools/data/mods.json `bands`
 *   Mod drop weights              tools/data/engine.json `mod_weights`
 *   Base frames + Gear Mod school item-base.md
 *   weapon pools                  equipment-slot-weapon.md + engine.json `weapons`
 * and the roll order is the seven steps printed in loot.md section 1, in that order.
 *
 * The one thing this tool decides (and records) is the operational meaning of the
 * filter rule "better than the equipped piece on at least 1 axis": an item scores
 * Σ weight(line) × value ÷ Total, and it is kept when it outscores the equipped piece
 * in the same slot. See `scoring` below — the doc prints the same sentence.
 */

const MODS = readJson(path.join(import.meta.dirname, 'data', 'mods.json'));

const { E, L, BAND, BAND_KEYS, BANDS, WEAPONS }: any = eng;

const ROOT = path.resolve(import.meta.dirname, '..');

// ---------------------------------------------------------------- inputs

// The sample size: 14 x the band's own drops-per-hour, so a run is a fixed COUNT of drops, never a
// stretch of hours (D12). The six published windows are shares of that count.
const HOURS = 14;
const TRIALS = 12;         // seeds averaged per band, so a single run cannot decide a number
const SEED0 = 20260101;    // fixed, so a cage run is reproducible

// The roll primitives live in engine/loot.ts, which the client calls too, so a drop the game
// rolls and a drop the cage simulates come off the same item-level / window / third machinery.
const LOOT = createLoot(E, MODS);
const {
  SLOTS, TIER_NAME, ELEMENTS,
  FLAT_GROUP, weightOf, rangeOf, sliceCount, tierSlice,
} = LOOT;
// the band ladder and its level spans, read once (`item_level` — item-level.md)
const BAND_INDEX: Record<string, number> = { low: 0, mid: 1, high: 2 };
const SPAN: Record<string, [number, number]> = Object.fromEntries(
  (E.item_level.spans || []).map((s: any) => [s.band, [s.from, s.to]]),
);

// ---------------------------------------------------------------- parse the Bases out of item-base.md

const clean = (s: any) => s.replace(/\s+/g, ' ').trim();
const splitMods = (s: any) => s.split('·').map(clean).filter((x: any) => x && x !== '—' && x !== '-');

/** Mod id from the doc's display name ("Max HP %" → max_hp). */
const idOf = (name: any) => {
  const n = clean(name).toLowerCase();
  let hit = null;
  for (const m of MODS.mods) {
    const full = m.name.toLowerCase();
    const bare = full.replace(/\s+(flat|%)$/, '');
    if (n === full || n === bare || n.startsWith(full + ' ') || n === bare) hit = hit || m.id;
  }
  return hit;
};

// The Base frames and their Gear Mod school come from tools/data/bases.json, which
// `node tools/bases.ts --checks` gates against item-base.md. The client reads the same file, so a
// drop the simulation scores and a drop the game rolls are built from one table.
const BASES_JSON = readJson(path.join(import.meta.dirname, 'data', 'bases.json'));
const BASES = BASES_JSON.bases.reduce((by: any, b: any) => {
  (by[b.slot] = by[b.slot] || []).push(b);
  return by;
}, {});
const SCHOOL = Object.fromEntries(BASES_JSON.bases.filter((b: any) => b.school).map((b: any) => [b.name, b.school]));

/** The weapon types and the dual-wieldable subset, from `equipment-weapon.md` via bases.json. */
const WEAPON_TYPES = BASES_JSON.weapons;
const DUAL_WIELD = WEAPON_TYPES.filter((w: any) => w.dual_wield);

// ---------------------------------------------------------------- rng

const { mulberry32, pick, intBetween, pickBand, weightedPick } = LOOT; // engine/loot.ts owns the roll

/** One option out of a weighted list — the frame / weapon pick at step 2. */
function pickWeighted(rng: any, options: any[]) {
  const total = options.reduce((s: any, o: any) => s + o.weight, 0);
  let r = rng() * total;
  for (const o of options) { r -= o.weight; if (r <= 0) return o; }
  return options[options.length - 1];
}

// ---------------------------------------------------------------- the roll (loot.md section 1, seven steps)

/**
 * Step 2 — the frame inside the rolled slot. Main hand picks a weapon type by weight; the off hand
 * picks equally among its three frames (Buckler · Kite Shield · Grimoire) and one dual-wielded
 * weapon, so a shield or a book can actually drop (item-base.md); every other slot picks a
 * Base by weight.
 */
function rollBase(rng: any, slot: any, bias: any) {
  if (slot === 'main hand') {
    const weapon = pickWeighted(rng, WEAPON_TYPES.map((w: any) => ({ weapon: w, weight: bias && bias.weapon_weight ? bias.weapon_weight : 1 })));
    // A10: the type picks the frame pool, and the frame is what the piece is called and what it forces
    const frames = (BASES_JSON.weapon_frames || {})[weapon.name] || [];
    const frame = frames.length ? pickWeighted(rng, frames.map((f: any) => ({ frame: f, weight: f.weight || 1 }))) : null;
    return { frame, weapon };
  }
  if (slot === 'off hand') {
    const options = [
      ...BASES['off hand'].map((f: any) => ({ frame: f, weight: 1 })),
      { weapon: pick(rng, DUAL_WIELD), weight: 1 },
    ];
    return pickWeighted(rng, options);
  }
  const frames = BASES[slot].map((b: any) => ({ frame: b, weight: bias && bias.frame_weight ? bias.frame_weight(b) : 1 }));
  return pickWeighted(rng, frames);
}

/** Steps 3-7 plus the Mod lines: one dropped item (loot.md section 1). */
function rollItem(rng: any, band: any, bias: any) {
  const slot = pick(rng, SLOTS);
  const chosen = rollBase(rng, slot, bias);
  const frame = chosen.frame || null;
  const weapon = chosen.weapon || null;
  const b = band === 'high_full_lck' ? 'high' : band;
  const q = BAND_INDEX[b];
  // the level the source rolls at: a character farming a band walks its whole level span, so the sim
  // draws uniformly across it — the same spread of items a real run sees (`item_level.spans`)
  const [from, to] = SPAN[b];
  const ilvl = from + Math.floor(rng() * (to - from + 1));
  const u = rng(); // one Tier draw per item, shared by line 1 and every Unbound line

  // line 1 is the Frame Mod: it is rolled first, off the frame, before any Unbound line
  const lines: any[] = LOOT.frameModRoll(BASES_JSON, slot, frame, weapon, rng, ilvl, q, u);
  // every id the piece already holds — a Frame Mod line's `extra` Mods included, exactly as the client
  // does (`game/src/sim/drop.ts`), so a line never appears twice on one piece in either roll
  const taken = new Set<string>(lines.flatMap((l: any) => [l.id, ...((l.extra || []).map((x: any) => x.id))]));
  const pool = LOOT.poolFor(BASES_JSON, slot, frame, weapon).filter((e: any) => !taken.has(e.id));
  const target = LOOT.linesAtDrop(rng);

  while (lines.length < target) {
    const blocked = LOOT.blockedBy(taken);
    const remaining = pool.filter((e: any) => !taken.has(e.id) && !blocked.has(e.id));
    if (!remaining.length) break; // an off hand simply publishes fewer lines (item-base.md)
    const id = weightedPick(rng, remaining.map((e: any) => ({ id: e.id, w: e.role * weightOf(e.id, q) })));
    taken.add(id);
    const slice = tierSlice(u);
    const [lo, hi] = rangeOf(id, ilvl, q, slice);
    lines.push({ id, value: intBetween(rng, lo, hi), slice, element: id.startsWith('elemental_') ? pick(rng, ELEMENTS) : null });
  }

  return { slot, base: frame ? frame.name : weapon.name, ilvl, quality: BANDS[q], tier: (TIER_NAME as any)[tierSlice(u)], q, lines };
}

/** The score the filter compares lives in engine/loot.ts — one copy for the cage and the client. */

// ---------------------------------------------------------------- one 14-hour run in one band

function runBand(band: any, seed: any, opts: any = {}) {
  const hours = opts.hours || HOURS;
  const dropsPerHr = BAND[band].drops_per_hr;
  const rng = mulberry32(seed);
  const equipped: Record<string, any> = {};         // slot → score
  const haveElement = new Set<string>();
  const hourUp = new Array(hours).fill(0);
  let drops = 0, upgrades = 0, elementKeeps = 0, flatLines = 0, itemLines = 0;

  const totalDrops = Math.round(dropsPerHr * hours);
  for (let i = 0; i < totalDrops; i++) {
    const item = rollItem(rng, band, opts.bias);
    drops++;
    for (const l of item.lines) { itemLines++; if (FLAT_GROUP.has(l.id)) flatLines++; }
    const margin = opts.margin !== undefined ? opts.margin : L.filter.upgrade_margin_pct / 100;
    const verdict = LOOT.keepsDrop(item, equipped[item.slot], haveElement, margin);
    if (verdict.keep) {
      upgrades++;
      hourUp[Math.min(hours - 1, Math.floor(i / dropsPerHr))]++;
      for (const l of item.lines) if (l.element) haveElement.add(l.element);
      if (verdict.reason === 'upgrade') equipped[item.slot] = verdict.score;
      else elementKeeps++;
    }
  }

  const scores = Object.values(equipped);
  return {
    drops, upgrades, elementKeeps,
    keepRate: (upgrades / drops) * 100,
    perHr: upgrades / hours,
    avgScore: scores.reduce((s: any, x: any) => s + x, 0) / Math.max(1, scores.length),
    flatPerDrop: flatLines / Math.max(1, drops),
    linesPerItem: itemLines / Math.max(1, drops),
    hourUp,
  };
}

function measureBand(band: any, opts: any = {}) {
  const runs: any[] = [];
  for (let t = 0; t < (opts.trials || TRIALS); t++) runs.push(runBand(band, SEED0 + t * 7919, opts));
  const avg = (f: any) => runs.reduce((s: any, r: any) => s + f(r), 0) / runs.length;
  const keepRates = runs.map((r: any) => r.keepRate);
  const mean = avg((r: any) => r.keepRate);
  const sd = Math.sqrt(avg((r: any) => (r.keepRate - mean) ** 2));
  return {
    band,
    drops: avg((r: any) => r.drops),
    upgrades: avg((r: any) => r.upgrades),
    keepRate: mean,
    keepSd: sd,
    perHr: avg((r: any) => r.perHr),
    avgScore: avg((r: any) => r.avgScore),
    flatPerDrop: avg((r: any) => r.flatPerDrop),
    linesPerItem: avg((r: any) => r.linesPerItem),
    elementKeeps: avg((r: any) => r.elementKeeps),
    hourUp: (() => { const out: any[] = []; for (let h = 0; h < HOURS; h++) out.push(avg((r: any) => r.hourUp[h])); return out; })(),
  };
}

// The measurement is pure and CPU-heavy (a Monte Carlo over seeds), and `--checks` reads it twice —
// once for the gates and once when the writer renders the block. Memoize so the sim runs once per
// process while both readers see the identical rows.
let _all: any[] | undefined;
const ALL = () => (_all ??= BAND_KEYS.map((b: any) => measureBand(b)));

// ---------------------------------------------------------------- the Base-bias experiment (T15)

/** towns.md section 4 wants per-settlement Base weights. This is what a weight would cost. */
let _bias: any[] | undefined;
function biasExperiment() {
  if (_bias) return _bias;
  const school = (b: any) => (SCHOOL[b] === 'armour_flat' ? 'armored' : SCHOOL[b] === 'evasion_flat' ? 'balanced' : 'cloth');
  const scenarios = [
    { label: 'no bias (equal frames, published rule)', bias: null },
    {
      label: 'a soldier town (armored frames x2.5, cloth x0.4)',
      bias: { frame_weight: (b: any) => (school(b.name) === 'armored' ? 2.5 : school(b.name) === 'cloth' ? 0.4 : 1) },
    },
    {
      label: 'the same town inverted (cloth x2.5, armored x0.4)',
      bias: { frame_weight: (b: any) => (school(b.name) === 'cloth' ? 2.5 : school(b.name) === 'armored' ? 0.4 : 1) },
    },
  ];
  return (_bias = scenarios.map((s: any) => {
    const m = measureBand('high', { bias: s.bias, trials: TRIALS });
    return { label: s.label, keepRate: m.keepRate, perHr: m.perHr, avgScore: m.avgScore };
  }));
}

// ---------------------------------------------------------------- generated block

const scoring = 'An item scores the sum of `weight(line) x value / Total` over its own Mod lines, and the filter keeps it when it outscores the piece equipped in the same slot — that is the operational reading of "better on at least 1 axis" (loot.md section 4). A second, weaker keep reason survives: Elemental lines of an Element the player has no resistance for are always kept, so hunting a new Element still pays.';

function block(rows: any, bias: any) {
  const n = (x: any, d = 2) => x.toFixed(d);
  const per1000 = (r: any) => (r.perHr / BAND[r.band].drops_per_hr) * 1000;
  return [
    '| Zone | Drops 1/14 | 2/14 | 3/14 | 4/14 | 6/14 | 12/14 | Total upgrades | Keep-rate of drops | Upgrades per 1,000 drops | Avg score per equipped piece |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r: any) => {
      const at = (h: any) => n(r.hourUp[h - 1]);
      return `| ${r.band.replace('_', ' + ')} | ${at(1)} | ${at(2)} | ${at(3)} | ${at(4)} | ${at(6)} | ${at(12)} | ${n(r.upgrades, 0)} | **${n(r.keepRate)}%** | ${n(per1000(r), 1)} | ${n(r.avgScore)} |`;
    }),
    '',
    `Measured by \`node tools/loot.ts --sim\` · each band's own drop count per run x ${TRIALS} seeds, no clock — the six windows are shares of that drop count, never hours (D12). Drop rate and Lck from \`engine.json\` \`loot\`, Mod ranges from \`mods.json\`, Mod weights from \`engine.json\` \`mod_weights\`, Base frames and the Gear Mod school from \`item-base.md\`.`,
    '',
    `**${scoring}**`,
    '',
    `- Flat lines per drop: ${rows.map((r: any) => `${n(r.flatPerDrop, 3)} (${r.band.replace('_', ' + ')})`).join(' · ')} — the four early-game Flat lines are weighted 0.5 / 0.4 / 0.25 by Item quality, so they thin out exactly as the player leaves the early zones (F11)`,
    `- Mod lines per item: ${rows.map((r: any) => n(r.linesPerItem)).join(' · ')} · Element-hunt keeps: ${rows.map((r: any) => n(r.elementKeeps, 1)).join(' · ')}`,
    `- Keep-rate spread across seeds: ${rows.map((r: any) => `±${n(r.keepSd)}% (${r.band.replace('_', ' + ')})`).join(' · ')} — the row above is the mean, not a single lucky run`,
    '',
    `**Swap margin sensitivity** — the filter keeps a drop only when it beats the equipped piece by more than \`loot.filter.upgrade_margin_pct\` = ${L.filter.upgrade_margin_pct}% (a 2% gain is a reroll, not a decision):`,
    '',
    '| Zone | 0% (any gain counts) | set margin | 2x margin |',
    '|---|---|---|---|',
    ...rows.map((r: any) => {
      const zero = measureBand(r.band, { margin: 0, trials: 4 }).keepRate;
      const dbl = measureBand(r.band, { margin: (L.filter.upgrade_margin_pct * 2) / 100, trials: 4 }).keepRate;
      return `| ${r.band.replace('_', ' + ')} | ${zero.toFixed(2)}% | **${r.keepRate.toFixed(2)}%** | ${dbl.toFixed(2)}% |`;
    }),
    '',
    `The published keep-rates for this design (5.1% / 4.4% / 3.1% / 1.1% of drops) sit on the set-margin column, which is the evidence that the filter always meant this and the earlier numbers were measured the same way. The re-base cut the drop flow ~3x, so the same decisions are now a larger share of a smaller drop count — the rule is unchanged, the published rates are re-derived.`,
    '',
    '**Base bias, measured (checks.md T15)**',
    '',
    '| Scenario | Keep-rate | Upgrades per 1,000 drops | Avg score |',
    '|---|---|---|---|',
    ...bias.map((b: any) => `| ${b.label} | ${b.keepRate.toFixed(2)}% | ${(b.perHr / BAND.high.drops_per_hr * 1000).toFixed(1)} | ${b.avgScore.toFixed(2)} |`),
    '',
    'A settlement that rolls one school more often does move the measured rows, so a Base weight is not free — which is why `town.json` carries no frame weight while the status is pending. The pipeline above is bias-ready: add `frame_weight` and re-run.',
  ].join('\n');
}

// ---------------------------------------------------------------- engine.json hand-back

/** Rounded measured upgrades/hr per band — the value `engine.json` must carry. */
function measured() {
  const out: Record<string, number> = {};
  for (const r of ALL()) out[r.band] = Math.max(0, Math.round(r.perHr));
  return out;
}

/**
 * Write the measured upgrades/hr into engine.json loot.bands, one line per band, so the junk
 * line (drops - upgrades) and everything priced off it move with the simulation instead of
 * a hand-typed guess. Only those keys are touched; the file's formatting is left alone.
 */
function sync() {
  const file = path.join(ROOT, 'tools', 'data', 'engine.json');
  const want = measured();
  let text = fs.readFileSync(file, 'utf8');
  let changed = 0;
  for (const [band, value] of Object.entries(want)) {
    const re = new RegExp(`("${band}":\\s*\\{[^}]*?"upgrades_per_hr":\\s*)(\\d+)`);
    const m = text.match(re);
    if (!m) { console.log(`MISSING loot.bands.${band}.upgrades_per_hr in engine.json`); changed++; continue; }
    if (m[2] !== String(value)) { text = text.replace(re, `$1${value}`); changed++; }
  }
  // the junk rarities divide the same junk line by their sell value, so they move with it.
  // BAND was built before the write, so read the freshly measured upgrades, not the stored ones.
  const perKill = (BAND.high.drops_per_hr - want.high) / BAND.high.kills_derived;
  for (const [rarity, r] of Object.entries<any>(E.junk.rarities)) {
    const value = Number((perKill / r.sell_gold).toFixed(7));
    const re = new RegExp(`("${rarity}":\\s*\\{[^}]*?"drop_chance_per_kill":\\s*)([\\d.]+)`);
    const m = text.match(re);
    if (!m) { console.log(`MISSING junk.rarities.${rarity}.drop_chance_per_kill in engine.json`); changed++; continue; }
    if (Number(m[2]) !== value) { text = text.replace(re, `$1${value}`); changed++; }
  }
  // F4 and F11 are simulation output, so the measured wording is handed back too
  const rows = ALL();
  const low = rows.find((r: any) => r.band === 'low')!;
  const high = rows.find((r: any) => r.band === 'high')!;
  const f4 = `first 1/14 of drops ${low.hourUp[0].toFixed(1)} → 2/14-4/14 ${(low.hourUp[1] + low.hourUp[2] + low.hourUp[3]).toFixed(1)} → after that ${low.hourUp.slice(4).reduce((a: any, b: any) => a + b, 0).toFixed(1)} (low band) · keep-rate ${rows.map((r: any) => `${r.keepRate.toFixed(2)}% ${r.band.replace('_', ' + ')}`).join(' · ')}`;
  const f11 = `${high.flatPerDrop.toFixed(2)} Flat lines per high-zone drop (${high.linesPerItem.toFixed(2)} lines per item) · the four early-game Flats thin out as Item quality rises`;
  for (const [id, value] of [['F4', f4], ['F11', f11]]) {
    // whitespace-tolerant: engine.json is pretty-printed JSON, and a row may sit on one line or four
    const re = new RegExp(`("id":\\s*"${id}",\\s*"value":\\s*")([^"]*)(")`);
    const m = text.match(re);
    if (!m) { console.log(`MISSING f_rows_carried ${id} in engine.json`); changed++; continue; }
    if (m[2] !== value) { text = text.replace(re, `$1${value}$3`); changed++; }
  }
  fs.writeFileSync(file, text, 'utf8');
  console.log(`engine.json loot.bands upgrades_per_hr -> ${BAND_KEYS.map((b: any) => `${b} ${want[b]}`).join(' · ')} (${changed} line(s) changed)`);
}

// ---------------------------------------------------------------- gates

import { leanReweight } from '../engine/loot.ts';

function gates(rows: any, bias: any) {
  const out: any[] = [];
  const add = (id: any, ok: any, detail: any) => out.push({ id, ok, detail });

  const low = rows.find((r: any) => r.band === 'low')!;
  const high = rows.find((r: any) => r.band === 'high')!;
  const lck = rows.find((r: any) => r.band === 'high_full_lck');

  add('LT1', rows.length === BAND_KEYS.length, `measured ${rows.length}/${BAND_KEYS.length} bands · every band in engine.json loot.bands has a row`);

  add('LT2', rows.every((r: any) => r.upgrades > 0 && r.keepRate > 0 && r.keepRate < 100),
    'every band produces upgrades, and none of them is every drop — the "98.9% of drops are not upgrades" claim needs a real number, not a slogan');

  add('LT3', low.hourUp[0] > low.hourUp[3] && low.hourUp[3] >= low.hourUp[11],
    `decision frequency falls inside a band: hour 1 ${low.hourUp[0].toFixed(1)} → hour 4 ${low.hourUp[3].toFixed(1)} → hour 12 ${low.hourUp[11].toFixed(1)} (low)`);

  add('LT4', low.keepRate > high.keepRate,
    `keep-rate falls with Item quality: low ${low.keepRate.toFixed(2)}% > high ${high.keepRate.toFixed(2)}% — higher zones mean better equipped pieces, so a drop has to clear a higher bar`);

  // The count leg used to be a bare `> x3`, which was really the 816-era full-Lck junk bound
  // (drop_mult 9.16 → junk x3.16) written as a floor. With the ceiling flat-only at 510 the
  // published bound is x2.11, so the gate now asks the honest question instead: does the simulation
  // reproduce the anchor `engine.json` publishes, and does the decision leg stay flat?
  const lckBound = BAND.high_full_lck.junk_per_hr / BAND.high.junk_per_hr;
  const lckRatio = lck.drops / high.drops;
  add('LT5', Math.abs(lckRatio - lckBound) / lckBound <= 0.05 && lck.upgrades <= high.upgrades * 1.6,
    `Lck buys count, not decisions: ${lck.drops.toFixed(0)} drops vs ${high.drops.toFixed(0)} (x${lckRatio.toFixed(2)} against the published junk bound x${lckBound.toFixed(2)}) but ${lck.upgrades.toFixed(0)} upgrades vs ${high.upgrades.toFixed(0)} (x${(lck.upgrades / high.upgrades).toFixed(2)}) — the rule Lck is craft-speed, not equip-speed`);

  add('LT6', rows.every((r: any) => r.avgScore > 0 && r.linesPerItem >= 2),
    'every equipped piece carries real lines: ' + rows.map((r: any) => `${r.band.replace('_', ' + ')} score ${r.avgScore.toFixed(2)} on ${r.linesPerItem.toFixed(2)} lines`).join(' · '));

  add('LT7', high.flatPerDrop < low.flatPerDrop && high.flatPerDrop < 0.4,
    `Flat lines per drop fall with Item quality: low ${low.flatPerDrop.toFixed(3)} → high ${high.flatPerDrop.toFixed(3)} of ${high.linesPerItem.toFixed(2)} lines — the 0.25 high-quality weighting keeps drops from being full of dead early-game lines (F11)`);

  // The signal a frame weight would move is the upgrade rate, not the average item score. Score is
  // carried by Item quality and line count, so once Dodge and Armour sat on one merged Evasion shape
  // the three school biases scored within a thousandth of each other while decisions-per-hour still
  // separated cleanly — and the rate is the row `towns.md` section 4 would actually be changing.
  const biasRows = bias.map((b: any) => `${b.perHr.toFixed(2)} up/hr · ${b.keepRate.toFixed(2)}% keep · ${b.avgScore.toFixed(2)} score`);
  add('LT8', bias.length === 3 && new Set(bias.map((b: any) => b.perHr.toFixed(2))).size === 3,
    `the Base-bias experiment moves the upgrade rate (${biasRows.join(' | ')}), so a per-settlement frame weight is a real balance change — which is why the owner ruled to ship even-weighted (A9) and no weight is ever added to the data`);

  add('LT9', rows.every((r: any) => r.keepSd / Math.max(r.keepRate, 0.01) < 0.35),
    'every keep-rate is stable across seeds: ' + rows.map((r: any) => `±${(100 * r.keepSd / r.keepRate).toFixed(0)}% (${r.band.replace('_', ' + ')})`).join(' · '));

  const want = measured();
  const stored = BAND_KEYS.map((b: any) => `${b} ${L.bands[b].upgrades_per_hr}`);
  add('LT10', BAND_KEYS.every((b: any) => L.bands[b].upgrades_per_hr === want[b]),
    `engine.json carries the measured upgrades/hr (${stored.join(' · ')}) so the junk line drops - upgrades follows the simulation — run \`node tools/loot.ts --sync\` if this FAILs`);

  add('LT11', L.filter.upgrade_margin_pct > 0 && rows.every((r: any) => r.keepRate < 6.0) && rows.every((r: any) => r.keepRate > 0.15),
    `the swap margin is ${L.filter.upgrade_margin_pct}% and every band stays inside the published decision budget (0.15-6.0% of drops, widened from 3.5 when the re-base cut the drop flow ~3x): ${rows.map((r: any) => r.keepRate.toFixed(2) + '%').join(' · ')}`);

  add('LT12', Math.abs(rows[2].keepRate - 3.1) < 0.6 && Math.abs(rows[0].keepRate - 5.1) < 0.9,
    `the measurement reproduces the published keep-rates: low ${rows[0].keepRate.toFixed(2)}% (published 5.1) · high ${rows[2].keepRate.toFixed(2)}% (published 3.1) — the filter rule did not change, it was finally written down`);

  const carried = (id: any) => (E.f_rows_carried.find((r: any) => r.id === id) || {}).value || '';
  add('LT13', carried('F4').includes(rows[2].keepRate.toFixed(2)) && carried('F11').includes(rows[2].flatPerDrop.toFixed(2)),
    `F4 and F11 print this run's numbers (${carried('F4').slice(0, 28)}… / ${carried('F11').slice(0, 20)}…) — run \`node tools/loot.ts --sync\` if this FAILs`);

  // The variant's lean: 'none' is the identity and every lean conserves the total expected drops/kill,
  // so a leaned variant can never raise the drop rate the timeline is priced on.
  const HO = L.variant_lean || { shift_pct: 0, categories: [] };
  const sample = { gear: 0.08, herb: 0.17, junk: 0.3 };
  const sum = (x: any) => x.gear + x.herb + x.junk;
  const none = leanReweight(sample, 'none', HO.shift_pct);
  const identity = none.gear === sample.gear && none.herb === sample.herb && none.junk === sample.junk;
  const leans = HO.categories.map((c: 'gear' | 'herb' | 'junk') => ({ c, r: leanReweight(sample, c, HO.shift_pct) }));
  const conserved = leans.every(({ r }: any) => Math.abs(sum(r) - sum(sample)) < 1e-9);
  const leaning = leans.every(({ c, r }: { c: 'gear' | 'herb' | 'junk'; r: { gear: number; herb: number; junk: number } }) => r[c] > sample[c]);
  add('LT14', identity && conserved && leaning && leans.length === 3,
    `The variant lean: 'none' is the identity, each lean raises its own stream, and every lean conserves ${sum(sample).toFixed(2)} expected drops/kill across gear · herb · junk${!identity ? ' · NONE NOT IDENTITY' : ''}${!conserved ? ' · TOTAL NOT CONSERVED' : ''}${!leaning ? ' · LEAN NOT RAISED' : ''}${leans.length !== 3 ? ' · CATEGORIES != 3' : ''}`);

  return out;
}

// ---------------------------------------------------------------- cli

const arg = process.argv[2];

if (arg === '--checks') {
  const rows = ALL();
  const bias = biasExperiment();
  const res = gates(rows, bias);
  for (const r of res) console.log(`${r.id.padEnd(4)}  ${r.ok ? 'PASS ' : 'FAIL '}  ${r.detail}`);
  const fails = res.filter((r) => !r.ok).length;
  console.log(`\n${res.length - fails}/${res.length} gate PASS · ${fails} FAIL`);
  if (fails) process.exitCode = 1;
} else if (arg === '--sync') {
  sync();
} else if (arg === '--sim') {
  const rows = ALL();
  console.log('band            drops   upgrades  keep%   up/1k   score   flat/drop  lines/item');
  for (const r of rows) {
    console.log(
      r.band.padEnd(15) +
      r.drops.toFixed(0).padStart(6) +
      r.upgrades.toFixed(1).padStart(10) +
      r.keepRate.toFixed(2).padStart(8) +
      ((r.perHr / BAND[r.band].drops_per_hr) * 1000).toFixed(1).padStart(7) +
      r.avgScore.toFixed(2).padStart(8) +
      r.flatPerDrop.toFixed(3).padStart(11) +
      r.linesPerItem.toFixed(2).padStart(12)
    );
  }
  console.log('\ndrop-window buckets (upgrades), shares of each run:');
  for (const r of rows) console.log(r.band.padEnd(15) + '1/14 ' + r.hourUp[0].toFixed(1) + ' · 2/14-4/14 ' + (r.hourUp[1] + r.hourUp[2] + r.hourUp[3]).toFixed(1) + ' · 5/14-12/14 ' + r.hourUp.slice(4, 12).reduce((a: any, b: any) => a + b, 0).toFixed(1));
  console.log('\nbase bias:');
  for (const b of biasExperiment()) console.log('  ' + b.label.padEnd(48) + ' keep ' + b.keepRate.toFixed(2) + '%  up/1k ' + (b.perHr / BAND.high.drops_per_hr * 1000).toFixed(1) + '  score ' + b.avgScore.toFixed(2));
} else {
  console.log(`loot cage — the seven roll steps, measured

  node tools/loot.ts --checks   invariants
  node tools/loot.ts --sim      raw numbers per band
  node tools/loot.ts --sync     hand the measured upgrades/hr back to engine.json
`);
}