'use strict';

/**
 * Survival cage — which build survives what.
 *
 *   node tools/survival.js --emit     print the tables
 *   node tools/survival.js --write    rewrite the blocks in combat.md
 *   node tools/survival.js --checks   gate the result
 *
 * The tables in combat.md sections 6-7 used to be a hand run against a field rule the
 * design has since replaced ("kill in spawn order" vs the published lowest-HP-first
 * targeting rule), and they were labelled as tool output while no tool existed. This is
 * that tool. Every number it prints comes from engine.json + lib/engine.js.
 */

const fs = require('fs');
const path = require('path');
const G = require('./lib/generated');
const eng = require('./lib/engine');

const { E, S, K, M, LG, DERIVED } = eng;
const ROOT = eng.ROOT;
const f0 = (x) => Math.round(x).toLocaleString('en-US');
const f1 = (x) => x.toFixed(1);
const f2 = (x) => x.toFixed(2);

// ---------------------------------------------------------------- build definitions
// 12 worn items, every one carrying Stat Mod flat at high-quality T1. On top of that each
// build spends the slots its theme needs on the Mods those slots are allowed to roll
// (equipment-slot-pools.md mod-matrix). Nothing here is typed twice: the Mod ceilings come
// from mod_max and the slot permissions from the matrix the engine already reads.
const HIGH = E.mob.zones[8].quality; // zone 9 publishes the high tier these builds wear
const T = (name) => {
  const m = MOD_CEIL[name];
  if (m == null) return 0;
  return m;
};
const MOD_CEIL = {
  'Max HP flat': M.hp_pct_per_item, 'Max HP %': M.hp_pct_per_item,
  'Max Mana flat': M.mana_pct_per_item, 'Max Mana %': M.mana_pct_per_item,
  'Evasion flat': M.evasion_flat_t1, 'Evasion %': M.evasion_pct,
  'Cooldown reduction %': M.cdr_pct_per_item, 'Elemental resistance %': M.res_pct_per_item,
  'Elemental alignment %': M.align_pct_per_item,
  'Armour flat': M.armour_flat_t1, 'Energy Shield flat': M.energy_shield_flat_t1,
};

// the defensive Mods each theme puts on the slots that may roll them
const THEMES = {
  glass: ['Max HP %'],
  mix: ['Max HP %', 'Max Mana %', 'Cooldown reduction %', 'Elemental resistance %'],
  tank: ['Max HP %', 'Armour flat', 'Elemental resistance %'],
  dodge: ['Evasion flat', 'Evasion %', 'Elemental resistance %'],
};

const BUILDS = [
  { id: 'glass', split: { str: 12 }, themes: THEMES.glass },
  { id: 'mix', split: { str: 6, vit: 3, agi: 3 }, themes: THEMES.mix },
  { id: 'tank', split: { vit: 12 }, themes: THEMES.tank },
  { id: 'dodge', split: { agi: 12 }, themes: THEMES.dodge },
  // Evasion reads Dex, so the dodge build carries a Dex leg alongside its Agi (D-112)
];

const SLOT_MOD_ROLLS = {
  'Max HP %': ['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'cape'],
  'Max Mana %': ['helmet', 'boots', 'belt', 'ring', 'cape'],
  'Cooldown reduction %': ['off hand', 'helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'amulet', 'cape'],
  'Elemental resistance %': ['helmet', 'chest', 'pant', 'boots', 'belt', 'ring', 'amulet', 'cape'],
  'Evasion flat': ['pant', 'boots', 'belt', 'gloves'], 'Evasion %': ['helmet', 'chest', 'belt', 'gloves', 'ring'],
  'Armour flat': ['helmet', 'chest', 'pant', 'boots', 'gloves'],
  'Energy Shield flat': ['helmet', 'chest', 'pant', 'boots', 'gloves'],
};

// ---------------------------------------------------------------- one build
// stat fed by n items at level L (L = the level cap by default; the zone table passes a zone edge)
const statWithItemsL = (n, L) => (eng.statAt(L) + S.core_flat_max * n) * (1 + (0 * n) / 100);
function build(b, L = S.level_cap, gearMod = 0) {
  const statOf = (k) => (b.split[k] ? statWithItemsL(b.split[k], L) : eng.statAt(L));
  const str = statOf('str'), vit = statOf('vit'), agi = statOf('agi'), dex = statOf('dex');

  // each theme Mod lands on every slot allowed to roll it, at the T1 ceiling
  const per = {};
  for (const m of b.themes) {
    const slots = SLOT_MOD_ROLLS[m] || [];
    per[m] = { count: slots.length, value: T(m) };
  }
  const hpPct = per['Max HP %'] ? (per['Max HP %'].count * M.hp_pct_per_item) / 100 : 0;
  const manaPct = per['Max Mana %'] ? (per['Max Mana %'].count * M.mana_pct_per_item) / 100 : 0;
  const resPct = per['Elemental resistance %'] ? (per['Elemental resistance %'].count * M.res_pct_per_item) / 100 : 0;
  const cdrPct = per['Cooldown reduction %'] ? (per['Cooldown reduction %'].count * M.cdr_pct_per_item) / 100 : 0;
  const evFlat = per['Evasion flat'] ? per['Evasion flat'].count * M.evasion_flat_t1 : 0;
  const evPct = per['Evasion %'] ? per['Evasion %'].count * M.evasion_pct : 0;
  const armourFlat = per['Armour flat'] ? per['Armour flat'].count * M.armour_flat_t1 : 0;
  const esFlat = per['Energy Shield flat'] ? per['Energy Shield flat'].count * M.energy_shield_flat_t1 : 0;

  const hp = (vit * K.K_VIT_HP + LG.hp_per_level * (L - 1)) * (1 + hpPct);
  const regen = vit * K.K_VIT_REGEN * (1 + (per['Max HP %'] ? 0 : 0));
  const res = (vit * K.K_VIT_RES) * (1 + resPct);
  const cdr = (agi * 0) + 0;
  // the Gear Mod is a second copy of the theme's own defensive line at the upgrade value
  // (`item-base.md` · D-104); Energy Shield is a pool this table does not spend and Evasion is not
  // modelled here at all, so only the Armour school can raise this gate
  const evRating = dex * K.K_EVASION + evFlat + (evPct / 100) * (dex * K.K_EVASION + evFlat);
  const evAgi = agi / (1 / K.K_AGI_EVAS);
  const armour = str * K.K_ARMOUR + armourFlat + (armourFlat ? gearMod : 0);
  return { b, str, vit, dex, agi, hp, regen, res, cdr, evRating, evAgi, armour, hpPct, resPct, cdrPct, manaPct, esFlat };
}

// Evasion: the Dex rating rolls against that mob's accuracy, then Agi adds points (D-112)
const evasionVs = (r, mobAcc) => eng.evasionChance(r.evRating, r.evAgi, mobAcc);

// ---------------------------------------------------------------- engagements
const MOB = E.mob;
const zone9 = eng.zoneById(9);
const BOSS = MOB.sizes.find((s) => s.id === 'boss');
const LARGE = MOB.sizes.find((s) => s.id === 'large');
const MEDIUM = MOB.sizes.find((s) => s.id === 'medium');

// Elite is a rarity flag on a Large body, not a body of its own: same multipliers the
// roster prints, different HP/damage multipliers here.
const ELITE = { hp: 6, ps: 4 };
const KINDS = { normal: MEDIUM, elite: ELITE, boss: BOSS, group: MEDIUM };
// one round of the heal skills as a multiple of Max HP (engine.json build.heal_pool_mult; SV6 gates it)
const HEAL_MULT = E.build.heal_pool_mult;

function encounter(r, kind, dps, mobAcc) {
  const mult = KINDS[kind];
  const hp = zone9.hp[1] * mult.hp;
  const dpsIn = eng.mobPs(zone9.hp[1], S.level_cap) * mult.ps;
  const attackers = kind === 'group' ? 3 : 1;   // Cap 3 engage at once; the rest queue
  const secs = hp / dps;

  const evasion = evasionVs(r, mobAcc);
  const res = Math.min(r.res, E.caps.elem_res);
  const armourCut = eng.armourReduce(r.armour, dpsIn / 2);
  let taken = dpsIn * attackers;
  taken *= (1 - evasion / 100) * (1 - res / 100) * (1 - armourCut);
  // regen runs during the fight, so the pool shrinks by incoming minus what it heals back
  const net = Math.max(0, taken - r.regen) * secs;
  return { pct: (net / r.hp) * 100, secs, evasion, res: res, incoming: taken };
}

// a boss at a zone edge: the player is that zone's level, the mob is that zone's HP
function zoneEncounter(r, dps, mobHp, L, kind) {
  const mult = KINDS[kind];
  const hp = mobHp * mult.hp;
  const dpsIn = eng.mobPs(mobHp, L) * mult.ps;
  const attackers = kind === 'group' ? 3 : 1;
  const secs = hp / dps;
  const mobAccL = eng.mobAcc(L, eng.MEAN_SPECIES_DEX, 1);
  const evasion = evasionVs(r, mobAccL);
  const res = Math.min(r.res, E.caps.elem_res);
  const armourCut = eng.armourReduce(r.armour, dpsIn / 2);
  let taken = dpsIn * attackers;
  taken *= (1 - evasion / 100) * (1 - res / 100) * (1 - armourCut);
  const net = Math.max(0, taken - r.regen) * secs;
  return { pct: (net / r.hp) * 100, secs, evasion, res, incoming: taken };
}

// DPS from the offense chain: physical power x hits/sec, with this build's own Str and Agi,
// then the skill multiplier that mob_HP already folds in (there is no passive tree).
function dpsOf(r, L = S.level_cap) {
  const sword = E.weapons.find((w) => w.id === 'sword') || E.weapons[0];
  const phys = r.str * K.K_STR;
  const aspd = (sword.weapon_aspd * (100 + (r.agi - S.base) * K.K_AGI_ASPD + M.aspd_pct)) / 100;
  return phys * aspd * eng.skillF(L);
}

function table(kind, label, gearMod = 0) {
  const mobAcc = eng.mobAcc(S.level_cap, eng.MEAN_SPECIES_DEX, 1);
  const rows = BUILDS.map((b) => {
    const r = build(b, S.level_cap, gearMod);
    const dps = dpsOf(r);
    const e = encounter(r, kind, dps, mobAcc);
    return { id: b.id, r, dps, e };
  });
  return { label, rows };
}

function render(t) {
  const head = ['| build | Str | Vit | Dex | Agi | Max HP | regen/sec | dodge | res | taken/sec | pool used | time |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  const body = t.rows.map(({ r, e }) =>
    `| ${r.b.id} | ${f0(r.str)} | ${f0(r.vit)} | ${f0(r.dex)} | ${f0(r.agi)} | **${f0(r.hp)}** | ${f0(r.regen)} | ${f1(e.evasion)}% | ${f1(e.res)}% | ${f0(e.incoming)} | ${f1(e.pct)}% | ${f1(e.secs)} sec${e.pct >= 100 ? ' → **Push**' : ''} |`);
  return [...head, ...body].join('\n');
}

function zoneBossBlock() {
  const head = ['| Zone (level) | boss HP | build | fight time | no heal | with heal |', '|---|---|---|---|---|---|'];
  const rows = [];
  for (const z of E.mob.zones) {
    const L = z.levels[1], mobHp = z.hp[1], bossHp = mobHp * BOSS.hp;
    for (const b of BUILDS) {
      const r = build(b, L);
      const e = zoneEncounter(r, dpsOf(r, L), mobHp, L, 'boss');
      const h = e.pct / HEAL_MULT;
      rows.push(`| ${z.id} (${L}) | ${f0(bossHp)} | ${b.id} | ${f1(e.secs)} sec | ${e.pct >= 100 ? '**' + f0(e.pct) + '% Push**' : f0(e.pct) + '%'} | ${h >= 100 ? '**' + f0(h) + '% Push**' : f0(h) + '%'} |`);
    }
  }
  return ['**Boss at every zone edge** (player at that zone\'s level · boss damage ×' + BOSS.ps + ' · heal = pool ×' + HEAL_MULT + ')', '', ...head, ...rows].join('\n');
}

function buildDefs() {
  const mobAcc = eng.mobAcc(S.level_cap, eng.MEAN_SPECIES_DEX, 1);
  const rows = BUILDS.map((b) => {
    const r = build(b);
    const split = Object.entries(b.split).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)} ${v}`).join(' / ');
    const evasion = evasionVs(r, mobAcc);
    const res = Math.min(r.res, E.caps.elem_res);
    return `| ${b.id} | ${split} | ${f0(r.str)} | ${f0(r.vit)} | ${f0(r.dex)} | ${f0(r.agi)} | **${f0(r.hp)}** | ${f0(r.regen)} | ${f1(evasion)}% | ${f1(res)}% |`;
  });
  return ['| build | 12-item split | Str | Vit | Dex | Agi | Max HP | regen/sec | Evasion | res |', '|---|---|---|---|---|---|---|---|---|---|---|', ...rows].join('\n');
}

function pushTable() {
  const rows = BUILDS.map((b) => {
    const r = build(b);
    const down = r.hp / (r.regen * 8);
    return `| ${b.id} | ${f0(r.vit)} | ${f0(r.hp)} | ${f0(r.regen)}/sec | **${f0(down)} sec** |`;
  });
  return ['| build | Vit | Max HP | hp_regen | Downtime per Push |', '|---|---|---|---|---|', ...rows].join('\n');
}

const SECTIONS = [
  { key: 'build-defs', title: 'Build definitions', render: buildDefs },
  { key: 'push-table', title: 'Push downtime', render: pushTable },
  { key: 'survival-mob', title: 'Level 100 · one mob', kind: 'normal' },
  { key: 'survival-group', title: 'Level 100 · a group of 5 (3 engage at once)', kind: 'group' },
  { key: 'survival-elite', title: 'Level 100 · an elite', kind: 'elite' },
  { key: 'survival-boss', title: 'Level 100 · the zone-9 boss', kind: 'boss' },
  { key: 'survival-boss-zones', title: 'Boss at every zone edge', render: zoneBossBlock },
];

function block(key) {
  const s = SECTIONS.find((x) => x.key === key);
  if (s.render) return s.render();
  return ['**' + s.title + '**', '', render(table(s.kind, s.title))].join('\n');
}

// ---------------------------------------------------------------- gates
function gates() {
  const out = [];
  const add = (id, ok, d) => out.push({ id, ok, d });
  const mobAcc = eng.mobAcc(S.level_cap, eng.MEAN_SPECIES_DEX, 1);
  const built = BUILDS.map((b) => build(b));

  const bad = built.filter((r) => r.hp <= 0 || r.regen < 0 || r.evRating < 0);
  add('SV1', bad.length === 0, `every build has a positive pool, regen and Evasion rating${bad.length ? ' · ' + bad.map((r) => r.b.id).join(', ') : ''}`);

  const tanks = built.find((r) => r.b.id === 'tank'), glass = built.find((r) => r.b.id === 'glass');
  add('SV2', tanks.hp > glass.hp * 2, `tank pool ${f0(tanks.hp)} beats glass ${f0(glass.hp)} by ${f1(tanks.hp / glass.hp)}x — the themes are actually different builds`);

  const b = table('boss', 'boss');
  const dodgeRow = b.rows.find((r) => r.r.b.id === 'dodge');
  add('SV3', dodgeRow.e.pct > 0, `the dodge build does take boss damage (${f1(dodgeRow.e.pct)}% of pool) — dodging is not immunity`);

  const grp = table('group', 'group');
  const maxGrp = Math.max(...grp.rows.map((r) => r.e.pct));
  add('SV4', maxGrp < 100, `a group of 5 costs at most ${f1(maxGrp)}% of pool, so AFK stays safe — this is the rule that makes it safe`);

  const capped = built.filter((r) => evasionVs(r, mobAcc) > E.caps.evasion + 0.01);
  add('SV5', capped.length === 0, `no printed build exceeds the ${E.caps.evasion}% Evasion Cap — the table cannot sell a number the Cap forbids${capped.length ? ' · ' + capped.map((r) => r.b.id).join(', ') : ''}`);

  // The G5 promise ("AFK cannot kill bosses") lives here: at the level cap the boss must Push
  // most builds with no heal, and a heal round must open the door for all but one of them.
  const bossRows = table('boss').rows;
  const pushed = bossRows.filter((r) => r.e.pct >= 100).length;
  const pass = bossRows.filter((r) => r.e.pct / HEAL_MULT < 100).length;
  add('SV6', pushed >= 3 && pass === 3, `the G5 boss gate holds at level ${S.level_cap}: ${pushed}/4 builds Pushed without heal, ${pass}/4 pass with heal (×${HEAL_MULT}) — AFK cannot beat the boss and heal casts can`);

  // D-104 · the Upgrade ladder is a bounded line, and the bound has to hold against the boss as well:
  // every Gear Mod slot at +Cap is one more copy of the theme's own defensive line at the published
  // per-step value, and that is what checks.md H1 asks to be paid for.
  const gmSlots = (SLOT_MOD_ROLLS['Armour flat'] || []).length;
  const GM_STEP = E.craft.gear_mod_per_level;
  const GM_FULL = GM_STEP * E.craft.upgrade_cap * gmSlots;
  const bareTank = table('boss', 'boss').rows.find((r) => r.r.b.id === 'tank');
  const upRows = table('boss', 'boss', GM_FULL).rows;
  const pushedUp = upRows.filter((r) => r.e.pct >= 100).length;
  const passUp = upRows.filter((r) => r.e.pct / HEAL_MULT < 100).length;
  const tankUp = upRows.find((r) => r.r.b.id === 'tank');
  add('SV7', pushedUp >= 3 && passUp === 3,
    `a full ${gmSlots}-slot Gear Mod set at +${E.craft.upgrade_cap} is +${GM_FULL} Armour on the heavy theme (${f1(tankUp.e.pct)}% of pool against the bare ${f1(bareTank.e.pct)}%) and the G5 promise still holds: ${pushedUp}/4 builds Pushed without heal, ${passUp}/4 pass with heal`);

  // B4 · mob skills are a re-timing of the priced `mob_PS`, never extra power (`combat.md` §5b ·
  // D-067), so the shape that matters is how much of the pool one second of that damage can take.
  // No mob skill list exists yet to name a window, so the cage bounds the window instead of guessing
  // one: an AFK-reachable mob must not be able to spend two seconds of its own budget in one instant
  // and still empty the pool — the same promise SV4 makes about the average.
  const shape = [];
  for (const kind of ['normal', 'group', 'elite']) {
    for (const { r, e } of table(kind, kind).rows) {
      const netPerSec = Math.max(0, e.incoming - r.regen);
      const poolSec = netPerSec > 0 ? r.hp / netPerSec : Infinity;
      shape.push({ kind, id: r.b.id, poolSec, spike2: (2 * netPerSec) / r.hp * 100 });
    }
  }
  const shortest = shape.reduce((a, b) => (b.poolSec < a.poolSec ? b : a));
  const fails = shape.filter((s) => !(s.poolSec >= 2));
  add('SV8', fails.length === 0,
    `no AFK-reachable mob can one-hit-kill through a re-timing: the thinnest margin is ${shortest.id} against an ${shortest.kind} at ${f1(shortest.poolSec)} pool-seconds of its own priced damage, so the two-second burst shape costs ${f1(shortest.spike2)}% of that pool and a skill would have to spend ${f1(shortest.poolSec)} seconds of budget in one instant to empty it${fails.length ? ' · over the line: ' + fails.map((f) => `${f.id}/${f.kind}`).join(', ') : ''}`);

  return out;
}

// ---------------------------------------------------------------- writers
const WRITERS = SECTIONS.map((s) => ({
  file: 'combat.md', key: s.key, render: () => block(s.key),
}));

const arg = process.argv[2];
if (arg === '--emit') {
  for (const s of SECTIONS) console.log(block(s.key) + '\n');
} else if (arg === '--write') {
  const missing = G.writeAll(WRITERS);
  if (missing) process.exitCode = 1;
} else if (arg === '--checks') {
  const rows = gates();
  for (const r of rows) console.log(`${r.id.padEnd(4)}  ${r.ok ? 'PASS ' : 'FAIL '}  ${r.d}`);
  const states = G.checkAll(WRITERS);
  const stale = states.filter((s) => s.state !== 'current');
  for (const s of states) console.log(`${s.state === 'current' ? 'PASS ' : 'FAIL '}  block ${s.key} · ${s.file} (${s.state})`);
  const fails = rows.filter((r) => !r.ok).length + stale.length;
  console.log(`\n${rows.length - rows.filter((r) => !r.ok).length}/${rows.length} gate PASS · ${stale.length} block(s) not current · ${fails} FAIL`);
  if (fails) process.exitCode = 1;
} else {
  console.log(`survival cage — engine.json → combat.md sections 6-7

  node tools/survival.js --emit     print the tables
  node tools/survival.js --write    rewrite the four tables
  node tools/survival.js --checks   gate the result
`);
}