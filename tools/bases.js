'use strict';

/**
 * Bases cage — `tools/data/bases.json` must equal the Base tables in `item-base.md`.
 *
 * The Bases (frame, weight, which Mod line is Primary / Secondary, Gear Mod school) were designed
 * in prose, and `tools/loot.js` used to parse that prose at run time — which a browser cannot do.
 * This cage lifts them into data and then gates the two against each other, so the JSON is a
 * verified mirror rather than a second hand-typed copy. `--write` re-imports from the doc;
 * `--checks` fails on any drift and reports the published set totals.
 */

const fs = require('fs');
const path = require('path');
const MODS = require('./data/mods.json');

const ROOT = path.resolve(__dirname, '..');
const DOC = 'item-base.md';
const OUT = path.join(__dirname, 'data', 'bases.json');
const SLOT_ORDER = ['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'amulet', 'cape', 'off hand'];

const clean = (s) => String(s).replace(/\s+/g, ' ').trim();
const splitMods = (s) => String(s).split('·').map(clean).filter((x) => x && x !== '—' && x !== '-');
const idOf = (name) => {
  const n = clean(name).toLowerCase();
  let hit = null;
  for (const m of MODS.mods) {
    const full = m.name.toLowerCase();
    const bare = full.replace(/\s+(flat|%)$/, '');
    if (n === full || n === bare || n.startsWith(full + ' ')) hit = hit || m.id;
  }
  return hit;
};

/** Parse `| Base | Weight | Primary | Secondary |` under each `## slot` heading. */
function parseDoc() {
  const text = fs.readFileSync(path.join(ROOT, DOC), 'utf8');
  const bySlot = {};
  let slot = null, inTable = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      const name = line.slice(3).toLowerCase();
      slot = SLOT_ORDER.find((s) => name === s || name.startsWith(s + ' ')) || null;
      inTable = false;
      continue;
    }
    if (!slot) continue;
    const cells = line.split('|').map(clean);
    if (cells.length < 5 || cells[0] !== '') { inTable = false; continue; }
    if (cells[1] === 'Base') { inTable = true; continue; }
    if (!inTable || /^-+$/.test(cells[1])) continue;
    (bySlot[slot] = bySlot[slot] || []).push({
      name: cells[1],
      weight: Number(cells[2]) || 1,
      primary: splitMods(cells[3]).map(idOf).filter(Boolean),
      secondary: splitMods(cells[4]).map(idOf).filter(Boolean),
    });
  }
  return bySlot;
}

/** "Heavy Bases (barbute · plate · …) carry Armour" → Base name → Gear Mod id. */
function parseSchools() {
  const text = fs.readFileSync(path.join(ROOT, DOC), 'utf8');
  const line = text.split(/\r?\n/).find((l) => /carry\s+(Armour|Evasion|Energy Shield)/i.test(l));
  const out = {};
  if (!line) return out;
  for (const m of line.matchAll(/(Heavy|light|cloth) Bases \(([^)]*)\) carry (Armour|Evasion|Energy Shield)/gi)) {
    const id = idOf(m[3]);
    for (const b of m[2].split('·')) out[clean(b)] = id;
  }
  return out;
}

/** The 12 weapon types from equipment-weapon.md, and the off-hand-only items below that table. */
/**
 * The off-hand mass rule lives in `mod-pool.md`'s weight line: "dual-wield counts x0.8". Read, not
 * retyped, so the sentence is the one home for the number (B13 · D-101).
 */
function parseDualWieldMult() {
  const text = fs.readFileSync(path.join(ROOT, 'mod-pool.md'), 'utf8');
  const m = text.match(/dual-wield counts\s*x\s*(0?\.\d+|\d+(\.\d+)?)/i);
  if (!m) throw new Error('mod-pool.md no longer states the dual-wield weight multiplier');
  return Number(m[1]);
}

function parseWeapons() {
  const text = fs.readFileSync(path.join(ROOT, 'equipment-weapon.md'), 'utf8');
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const c = line.split('|').map(clean);
    if (c.length < 8 || c[0] !== '') continue;
    if (c[1] === 'Weapon') continue;
    if (/^-+$/.test(c[1])) continue;
    const aspd = Number(c[5]);
    const mult = Number(c[6]);
    if (!aspd || !mult) continue;
    rows.push({
      name: c[1],
      hands: c[2],
      group: c[3],
      damage: c[4],
      weapon_aspd: aspd,
      weapon_mult: mult,
      dual_wield: c[7] === 'Yes',
      weight: Number(c[8]),
    });
  }
  return rows;
}

/** The union pools for the two weapon slots, from equipment-slot-weapon.md. */
function parseWeaponPools() {
  const text = fs.readFileSync(path.join(ROOT, 'equipment-slot-weapon.md'), 'utf8');
  const section = (from, to) => {
    const i = text.indexOf(from);
    const j = text.indexOf(to, i);
    return text.slice(i, j < 0 ? undefined : j);
  };
  const roles = (body) => {
    const out = {};
    for (const line of body.split(/\r?\n/)) {
      const c = line.split('|').map(clean);
      if (c.length < 3 || c[0] !== '') continue;
      if (c[1] === 'Role' || /^-+$/.test(c[1])) continue;
      out[c[1]] = splitMods(c[2]).map(idOf).filter(Boolean);
    }
    return out;
  };
  return {
    'main hand': roles(section('## main hand', '## off hand')),
    'off hand': roles(section('## off hand', '# Offensive / Defensive Rules')),
  };
}

function build() {
  const bySlot = parseDoc();
  const schools = parseSchools();
  const bases = [];
  for (const [slot, rows] of Object.entries(bySlot)) {
    for (const r of rows) bases.push({ ...r, slot, school: schools[r.name] || null });
  }
  return {
    note: 'The Base frames per slot, imported from item-base.md by tools/bases.js --write. Weight is in the unit items show; primary and secondary are the Mod ids that frame may roll; school is the Gear Mod the frame carries. weapons and weapon_pools come from equipment-weapon.md and equipment-slot-weapon.md. tools/loot.js and the client both read this file, and `node tools/bases.js --checks` gates it against the docs so none of them can drift.',
    roll_rule: 'Bases roll equally inside their slot (item-base.md "Base Rolling"); a dual-wield off hand weapon uses that weapon type weight x 0.8.',
    quality_weight_multiplier: 1.3,
    mastery: {
      xp_per_kill: 4,
      level_divisor: 100,
      level_cap: 20,
      weight_discount_per_level_pct: 1,
      weight_discount_cap_pct: 20,
      skill_bonus_from_level: 5,
      skill_bonus_per_level_pct: 0.5,
      skill_bonus_cap_pct: 8,
      drop_bonus_per_type_pct: 1,
      drop_bonus_level_required: 10,
    },
    slots: SLOT_ORDER,
    bases,
    weapons: parseWeapons(),
    // mod-pool.md states the off hand's mass rule ("dual-wield counts x0.8") in one sentence; this
    // reads it out as a number so the client never types the 0.8 beside it (B13 · D-101)
    dual_wield_weight_mult: parseDualWieldMult(),
    weapon_pools: parseWeaponPools(),
  };
}

/**
 * The three paths item-base.md publishes. Each list names one ring, and the worn set has two, so
 * the second ring repeats the first — that reading is what makes cloth (193) and armored (420)
 * reproduce exactly.
 */
const PATHS = [
  { name: 'cloth/glass', label: 'cloth', bases: ['circlet', 'vestments', 'wrap', 'soft boots', 'sash', 'wraps', 'band', 'band', 'pendant', 'cloak'], gear: 'circlet \u00b7 vestments \u00b7 wrap \u00b7 soft boots \u00b7 sash \u00b7 wraps \u00b7 band \u00d72 \u00b7 pendant \u00b7 cloak' },
  { name: 'balanced', label: 'balanced', bases: ['coif', 'mail', 'greaves', 'striders', 'clasp', 'gloves', 'band', 'band', 'pendant', 'cloak'], gear: 'coif \u00b7 mail \u00b7 greaves \u00b7 striders \u00b7 clasp \u00b7 gloves \u00b7 band \u00d72 \u00b7 pendant \u00b7 cloak' },
  { name: 'armored', label: 'armored', bases: ['barbute', 'plate', 'cuisses', 'sabatons', 'girdle', 'gauntlets', 'signet', 'signet', 'talisman', 'mantle'], gear: 'barbute \u00b7 plate \u00b7 cuisses \u00b7 sabatons \u00b7 girdle \u00b7 gauntlets \u00b7 signet \u00d72 \u00b7 talisman \u00b7 mantle' },
];

const weightOf = (bases, names) => names.reduce((t, n) => t + (bases.find((b) => b.name === n)?.weight || 0), 0);

/**
 * BS3 / BS4 are properties of the printed tables now (harness/todo.md B12 resolved by D-093): the
 * "Three Paths" numbers were hand-typed in prose and did not follow from the Base weights in the same
 * file, so both tables are generated from `tools/data/bases.json` and the gates check ordering and
 * growth instead of matching a typed copy.
 */
const G = require('./lib/generated');
const SHARED = require('../engine/index.js');
const EDATA = require('./data/engine.json');
const ENGINE = SHARED.createEngine(EDATA);

/** The worn sets the tax math is shown against: Str from levels only, then 2 and 6 slots on Str. */
function capacities() {
  const S = EDATA.stat;
  const bare = ENGINE.statAt(S.level_cap - 1);
  const strAt = (n) => bare + n * S.core_flat_max;
  return {
    level: S.level_cap - 1,
    strNone: bare,
    strTwo: strAt(2),
    strSix: strAt(6),
    none: Math.round(ENGINE.weightCapacityOf(bare)),
    two: Math.round(ENGINE.weightCapacityOf(strAt(2))),
    six: Math.round(ENGINE.weightCapacityOf(strAt(6))),
    capPct: ENGINE.CAP.weight_overload,
  };
}

/**
 * Print one of the two weight tables from data. The Base weights are the only home of these numbers,
 * `quality_weight_multiplier` is applied per Item quality band exactly as `weightAtQuality` applies it
 * to a single item, and each tax figure is the engine's own `encumbranceOf` under the Cap.
 */
function renderPaths(kind) {
  const data = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const C = capacities();
  const mult = data.quality_weight_multiplier;
  const w = (name) => data.bases.find((b) => b.name === name)?.weight || 0;
  const taxOf = (high, str) => {
    const e = ENGINE.encumbranceOf(high, str);
    return e > 0 ? '\u2212' + Math.round(e * 100) + '%' : '0%';
  };
  const sets = PATHS.map((p) => {
    const base = p.bases.reduce((acc, n) => acc + w(n), 0);
    return { p, base, mid: Math.round(base * mult), high: Math.round(base * mult * mult) };
  });
  if (kind === 'tax') {
    return [
      '| Worn set at high quality (item-base.md) | High weight | No Str (' + C.none + ') | Str 2 items (' + C.two + ') | Str 6 items (' + C.six + ') |',
      '|---|---|---|---|---|',
      ...sets.map((s) => '| ' + s.p.name + ' (' + s.p.gear + ') | ' + s.high
        + ' | ' + taxOf(s.high, C.strNone) + ' | ' + taxOf(s.high, C.strTwo) + ' | ' + taxOf(s.high, C.strSix) + ' |'),
      '',
      'Capacity is `weight_base` plus Str \u00d7 `K_STR_WEIGHT` at level ' + C.level + ' with no investment (' + C.strNone + ' \u2192 ' + C.none + '), then `core_flat_max` flat per slot spent on Str: 2 items (' + C.two + ') and 6 items (' + C.six + ') \u2014 Core Stat has no % line any more (D-114). The tax is the engine\u2019s own `encumbranceOf`, capped at ' + Math.round(C.capPct * 100) + '%.',
    ].join('\n');
  }
  return [
    '| Chosen path | Combined total (low quality) | Full set (mid quality) | Full set (high quality) | Aspd tax with no Str investment |',
    '|---|---|---|---|---|',
    ...sets.map((s) => '| ' + s.p.name + ' (' + s.p.gear + ') | ' + s.base + ' | ' + s.mid + ' | ' + s.high + ' | ' + taxOf(s.high, C.strNone) + ' |'),
    '',
    'Printed by `node tools/bases.js --blocks` from `tools/data/bases.json`. Mid and high apply `quality_weight_multiplier` (\u00d7' + mult + ') per Item quality band, the same way `weightAtQuality` applies it to a single item. The held weapon is not folded into these sets: it weighs ' + Math.min(...data.weapons.map((x) => x.weight)) + ' to ' + Math.max(...data.weapons.map((x) => x.weight)) + ' at Base weight (`equipment-weapon.md` \u00b7 D-101), the same \u00d7-quality multiplier applies, and an off-hand weapon counts \u00d7' + data.dual_wield_weight_mult + ' of its own type (`mod-pool.md`).',
  ].join('\n');
}

const WRITERS = [
  { file: 'item-base.md', key: 'three-paths', render: () => renderPaths('paths') },
  { file: 'formula-utility.md', key: 'weight-tax', render: () => renderPaths('tax') },
];
function checks() {
  const out = [];
  const add = (id, status, detail) => out.push({ id, status, ok: status !== 'fail', detail });
  const doc = build();
  let current = null;
  try { current = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { current = null; }
  if (!current) {
    add('BS1', 'fail', 'tools/data/bases.json is missing — run `node tools/bases.js --write`');
    return out;
  }
  const same = ['bases', 'weapons', 'weapon_pools'].every((k) => JSON.stringify(current[k]) === JSON.stringify(doc[k]));
  add('BS1', same ? 'pass' : 'fail', same
    ? `${doc.bases.length} Base rows across ${doc.slots.length} slots match item-base.md`
    : 'bases.json disagrees with item-base.md — run `node tools/bases.js --write`');
  add('BS2', current.quality_weight_multiplier === 1.3 ? 'pass' : 'fail',
    `the Quality multiplier applied to weight is ${current.quality_weight_multiplier} (item-base.md · formula.md section 11)`);
  const totals = PATHS.map((p) => weightOf(doc.bases, p.bases));
  add('BS3', totals.every((x) => x > 0) && totals[0] < totals[1] && totals[1] < totals[2] ? 'pass' : 'fail',
    `the three paths order as designed: cloth ${totals[0]} < balanced ${totals[1]} < armored ${totals[2]}, summed from the Base rows the tables print from`);
  const m = current.quality_weight_multiplier;
  add('BS4', m > 1 && totals.every((x) => Math.round(x * m * m) > x) ? 'pass' : 'fail',
    `quality weight grows per band at ×${m}: ${PATHS.map((p, i) => `${p.label} ${totals[i]}→${Math.round(totals[i] * m)}→${Math.round(totals[i] * m * m)}`).join(' · ')}`);

  const weapons = current.weapons || [];
  add('BS5', weapons.length === 12 ? 'pass' : 'fail',
    `${weapons.length} weapon types imported from equipment-weapon.md (the doc states 12 · melee 7 / ranged 2 / magic 3)`);
  const multBad = weapons.filter((w) => Math.abs(w.weapon_mult - Math.round((1.2 / w.weapon_aspd) * 100) / 100) > 0.011);
  add('BS6', multBad.length === 0 ? 'pass' : 'fail', multBad.length
    ? `weapon_mult ≠ 1.2 / weapon_aspd for ${multBad.map((w) => w.name).join(', ')}`
    : 'every weapon type keeps the equal-DPS rule weapon_mult = 1.2 / weapon_aspd');
  const blocked = current.weapon_pools?.['main hand']?.Blocked || [];
  const primary = current.weapon_pools?.['main hand']?.Primary || [];
  const secondary = current.weapon_pools?.['main hand']?.Secondary || [];
  const leaks = blocked.filter((id) => primary.includes(id) || secondary.includes(id));
  add('BS7', blocked.length > 0 && leaks.length === 0 ? 'pass' : 'fail',
    leaks.length ? `the main hand blocks and offers the same line: ${leaks.join(', ')}` : `main-hand pool offers ${primary.length + secondary.length} lines and blocks ${blocked.length}`);
  const M = current.mastery || {};
  add('BS8', (weapons.length * (M.drop_bonus_per_type_pct || 0)) === 12 ? 'pass' : 'fail',
    `the account-wide Mastery drop bonus tops out at ${weapons.length} × ${M.drop_bonus_per_type_pct}% = ${weapons.length * (M.drop_bonus_per_type_pct || 0)}% (equipment-weapon.md)`);
  // B6 · B7 (harness/todo.md): a weapon type MAY carry several Bases (D-072), but no variant list has
  // been written yet, so the shipped frames are the types themselves. This gate fails the moment a
  // frame list appears without being read by the drop roll, which is how the variants must land.
  add('BS9', (current.weapon_frames || []).length === 0 && weapons.length === 12 ? 'pass' : 'fail',
    `${weapons.length} weapon types are the frames in play · no variant list defined yet (D-072 permits one, and it would have to reach bases.json before the roll)`);
  // B13 · D-101: the weight column exists, every type carries one, and the two endpoints are the
  // range `mod-pool.md` states out of its own mouth — read back from that sentence, never retyped here.
  const stated = (fs.readFileSync(path.join(ROOT, 'mod-pool.md'), 'utf8').match(/weight by type \((\w+)\/\w+ (\d+) → ([a-z -]+) (\d+)\)/) || []);
  const noWeight = weapons.filter((w) => !(w.weight > 0));
  const lightNamed = weapons.filter((w) => w.name === stated[1]);
  const heavyNamed = weapons.filter((w) => w.name === stated[3]);
  const endpointBad = stated.length !== 5 || !lightNamed.length || !heavyNamed.length
    || lightNamed.some((w) => w.weight !== Number(stated[2])) || heavyNamed.some((w) => w.weight !== Number(stated[4]));
  const spanBad = Math.min(...weapons.map((w) => w.weight || 0)) !== Number(stated[2] || 0)
    || Math.max(...weapons.map((w) => w.weight || 0)) !== Number(stated[4] || 0);
  add('BS10', !noWeight.length && !endpointBad && !spanBad ? 'pass' : 'fail',
    !noWeight.length && !endpointBad && !spanBad
      ? `all ${weapons.length} weapon types carry a weight, and the span ${Math.min(...weapons.map((w) => w.weight))}-${Math.max(...weapons.map((w) => w.weight))} is exactly the range mod-pool.md states ("${stated[1]}/${stated[2]} → ${stated[3]} ${stated[4]}")`
      : `${noWeight.length ? 'NO WEIGHT: ' + noWeight.map((w) => w.name).join(', ') + ' · ' : ''}${endpointBad ? `endpoints disagree with mod-pool.md (${stated[1]}/${stated[2]} → ${stated[3]}/${stated[4]})` : ''}${spanBad ? ' · the set does not span the stated range' : ''}`);
  return out;
}

function report() {
  const rows = checks();
  for (const r of rows) console.log(`${r.status.toUpperCase().padEnd(8)}${r.id.padEnd(13)}${r.detail}`);
  const failed = rows.filter((r) => r.status === 'fail').length;
  const pending = rows.filter((r) => r.status === 'pending').length;
  console.log(`\n${rows.length - failed}/${rows.length} gate PASS · ${pending} PENDING · ${failed} FAIL`);
  if (failed) process.exit(1);
}

if (process.argv.includes('--write')) {
  const data = build();
  fs.writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n', 'utf8');
  console.log(`bases.json written · ${data.bases.length} Base rows in ${data.slots.length} slots`);
} else if (process.argv.includes('--blocks')) {
  const missing = G.writeAll(WRITERS);
  if (missing) process.exit(1);
} else if (process.argv.includes('--checks')) {
  report();
  const states = G.checkAll(WRITERS);
  for (const s of states) console.log(`${s.state === 'current' ? 'PASS ' : 'FAIL '}  block ${s.key} · ${s.file} (${s.state})`);
  if (states.some((s) => s.state !== 'current')) process.exitCode = 1;
} else {
  console.log('Bases cage — tools/data/bases.json ↔ item-base.md\n\n  node tools/bases.js --write    import the Base tables into data\n  node tools/bases.js --checks  gate the two against each other\n');
}

module.exports = { checks, build, parseDoc, parseSchools, WRITERS, renderPaths, capacities };
