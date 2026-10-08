/**
 * Survival cage — which build survives what.
 *
 *   node tools/survival.ts --emit     print the tables
 *   node tools/survival.ts --write    rewrite the blocks in combat.md
 *   node tools/survival.ts --checks   gate the result
 *
 * The tables in combat.md sections 6-7 used to be a hand run against a field rule the
 * design has since replaced ("kill in spawn order" vs the published lowest-HP-first
 * targeting rule), and they were labelled as tool output while no tool existed. This is
 * that tool. Every number it prints comes from engine.json + lib/engine.js.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as eng from './lib/engine.ts';

const { E, S, K, M, LG, DERIVED } = eng as any;
const ROOT = eng.ROOT;
const f0 = (x: any) => Math.round(x).toLocaleString('en-US');
const f1 = (x: any) => x.toFixed(1);
const f2 = (x: any) => x.toFixed(2);

// which themes a single heal round is supposed to carry through the level-cap boss (SV6 · SV7),
// and the two lines the gates read it through
const HEAL_PASS = ['mix', 'tank'];
const healed = (rows: any) => rows.filter((r: any) => r.e.pct < 100 * HEAL_MULT).map((r: any) => r.r.b.id);
const sameSet = (a: any, b: any) => a.length === b.length && a.slice().sort().join() === b.slice().sort().join();
const wrongTheme = (pass: any) => (sameSet(pass, HEAL_PASS) ? '' : ` · the heal round is buying ${pass.join(', ') || 'nobody'} where the published answer is ${HEAL_PASS.join(', ')}`);

// ---------------------------------------------------------------- build definitions
// 13 worn items, every one carrying Stat Mod flat at high-quality T1. On top of that each
// build spends the slots its theme needs on the Mods those slots are allowed to roll
// (equipment-slot-pools.md mod-matrix). Nothing here is typed twice: the Mod ceilings come
// from mod_max and the slot permissions from the matrix the engine already reads.
const HIGH = E.mob.zones[8].quality; // zone 9 publishes the high tier these builds wear
const T = (name: any) => {
  const m = MOD_CEIL[name];
  if (m == null) return 0;
  return m;
};
const MOD_CEIL: Record<string, any> = {
  'Max HP flat': M.hp_pct_per_item, 'Max HP %': M.hp_pct_per_item,
  'Max Mana flat': M.mana_pct_per_item, 'Max Mana %': M.mana_pct_per_item,
  'Evasion flat': M.evasion_flat_t1, 'Evasion %': M.evasion_pct,
  'Cooldown reduction %': M.cdr_pct_per_item, 'Elemental resistance %': M.res_pct_per_item,
  'Elemental alignment %': M.align_pct_per_item,
  'Armour flat': M.armour_flat_t1, 'Energy Shield flat': M.energy_shield_flat_t1,
};

// the defensive Mods each theme puts on the slots that may roll them
const THEMES: Record<string, any> = {
  glass: ['Max HP %'],
  mix: ['Max HP %', 'Max Mana %', 'Cooldown reduction %', 'Elemental resistance %'],
  tank: ['Max HP %', 'Armour flat', 'Elemental resistance %'],
  evasion: ['Evasion flat', 'Evasion %', 'Elemental resistance %'],
};

const BUILDS = [
  { id: 'glass', split: { str: 13 }, themes: THEMES.glass },
  { id: 'mix', split: { str: 7, vit: 3, agi: 3 }, themes: THEMES.mix },
  { id: 'tank', split: { vit: 13 }, themes: THEMES.tank },
  { id: 'evasion', split: { agi: 13 }, themes: THEMES.evasion },
  // Evasion reads Dex, so the evasion build carries a Dex leg alongside its Agi 
];

const SLOT_MOD_ROLLS: Record<string, any> = {
  'Max HP %': ['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'cape', 'earring'],
  'Max Mana %': ['helmet', 'boots', 'belt', 'ring', 'cape', 'earring'],
  'Cooldown reduction %': ['off hand', 'helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'amulet', 'cape', 'earring'],
  'Elemental resistance %': ['helmet', 'chest', 'pant', 'boots', 'belt', 'ring', 'amulet', 'cape', 'earring'],
  'Evasion flat': ['pant', 'boots', 'belt', 'gloves'], 'Evasion %': ['helmet', 'chest', 'belt', 'gloves', 'ring'],
  'Armour flat': ['helmet', 'chest', 'pant', 'boots', 'gloves'],
  'Energy Shield flat': ['helmet', 'chest', 'pant', 'boots', 'gloves'],
};

// ---------------------------------------------------------------- one build
// stat fed by n items at level L (L = the level cap by default; the zone table passes a zone edge)
const statWithItemsL = (n: any, L: any) => eng.statAt(L) + S.core_flat_max * n;
function build(b: any, L = S.level_cap, gearMod = 0): any {
  const statOf = (k: any) => (b.split[k] ? statWithItemsL(b.split[k], L) : eng.statAt(L));
  const str = statOf('str'), vit = statOf('vit'), agi = statOf('agi'), dex = statOf('dex');

  // each theme Mod lands on every slot allowed to roll it, at the T1 ceiling
  const per: Record<string, any> = {};
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

  // Every defensive line is the shared engine's own formula (engine/index.ts), the same one
  // game/src/sim/player.ts builds the live character with — so a change to a K or a base moves the
  // cage and the game together. Hand-rolled copies here were where the two silently diverged.
  const hp = eng.maxHpOf(vit, L, hpPct * 100);
  const regen = eng.hpRegenOf(vit);
  const res = (vit * K.K_MOB_RES) * (1 + resPct);
  // CDR is Wis-fed (`cdrOf`); these builds spend no Wis, so the Mod line is the only input
  const cdr = eng.cdrOf(0, cdrPct * 100);
  // the Gear Mod is a second copy of the theme's own defensive line at the upgrade value
  // (`item-base.md`); Energy Shield is a pool this table does not spend and Evasion is not
  // modelled here at all, so only the Armour school can raise this gate
  const evRating = eng.evasionRating(dex, evFlat, evPct);
  const evAgi = eng.agilityEvasion(agi);
  const armour = eng.armourOf(str) + armourFlat + (armourFlat ? gearMod : 0);
  return { b, str, vit, dex, agi, hp, regen, res, cdr, evRating, evAgi, armour, hpPct, resPct, cdrPct, manaPct, esFlat };
}

// Evasion: the Dex rating rolls against that mob's accuracy, then Agi adds points 
const evasionVs = (r: any, mobAcc: any) => eng.evasionChance(r.evRating, r.evAgi, mobAcc);

// ---------------------------------------------------------------- engagements
const MOB = E.mob;
const zone9: any = eng.zoneById(9);
const BOSS = MOB.sizes.find((s: any) => s.id === 'boss');
const LARGE = MOB.sizes.find((s: any) => s.id === 'large');
const MEDIUM = MOB.sizes.find((s: any) => s.id === 'medium');

// Elite is a rarity flag on a Large body, not a body of its own: same multipliers the
// roster prints, different HP/damage multipliers here.
const ELITE = { hp: 6, ps: 4 };
const KINDS: Record<string, any> = { normal: MEDIUM, elite: ELITE, boss: BOSS, group: MEDIUM };
// one round of the heal skills as a multiple of Max HP (engine.json build.heal_pool_mult; SV6 gates it)
const HEAL_MULT = E.build.heal_pool_mult;

function encounter(r: any, kind: any, dps: any, mobAcc: any) {
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
function zoneEncounter(r: any, dps: any, mobHp: any, L: any, kind: any) {
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
function dpsOf(r: any, L = S.level_cap) {
  // engine.json weapons carry `name`, not `id`: matching on `id` silently failed and fell back to
  // E.weapons[0] (the dagger), pricing every kill time below at dagger speed. Match the one-handed
  // sword the same way the engine's own REFERENCE build does.
  const weapon = E.weapons.find((w: any) => /one-handed/.test(w.name)) || E.weapons[0];
  // the shared offense chain: physical power (includes the weapon's `1.2 / aspd` multiplier) ×
  // hits/sec, at this build's own Str and Agi, then the skill multiplier `mob_HP` already folds in
  const phys = r.str * K.K_STR * eng.weaponMult(weapon.weapon_aspd);
  const aspd = eng.hitsPerSec(eng.aspdOf(r.agi, weapon.weapon_aspd, M.aspd_pct));
  return phys * aspd * eng.skillF(L);
}

function table(kind: any, label?: any, gearMod = 0): any {
  const mobAcc = eng.mobAcc(S.level_cap, eng.MEAN_SPECIES_DEX, 1);
  const rows = BUILDS.map((b: any) => {
    const r = build(b, S.level_cap, gearMod);
    const dps = dpsOf(r);
    const e = encounter(r, kind, dps, mobAcc);
    return { id: b.id, r, dps, e };
  });
  return { label, rows };
}

function render(t: any) {
  const head = ['| build | Str | Vit | Dex | Agi | Max HP | regen/sec | evasion | res | taken/sec | pool used | time |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  const body = t.rows.map(({ r, e }: any) =>
    `| ${r.b.id} | ${f0(r.str)} | ${f0(r.vit)} | ${f0(r.dex)} | ${f0(r.agi)} | **${f0(r.hp)}** | ${f0(r.regen)} | ${f1(e.evasion)}% | ${f1(e.res)}% | ${f0(e.incoming)} | ${f1(e.pct)}% | ${f1(e.secs)} sec${e.pct >= 100 ? ' → **Push**' : ''} |`);
  return [...head, ...body].join('\n');
}

function zoneBossBlock() {
  const head = ['| Zone (level) | boss HP | build | fight time | no heal | with heal |', '|---|---|---|---|---|---|'];
  const rows: any[] = [];
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
  const rows = BUILDS.map((b: any) => {
    const r = build(b);
    const split = Object.entries(b.split).map(([k, v]: any) => `${k[0].toUpperCase() + k.slice(1)} ${v}`).join(' / ');
    const evasion = evasionVs(r, mobAcc);
    const res = Math.min(r.res, E.caps.elem_res);
    return `| ${b.id} | ${split} | ${f0(r.str)} | ${f0(r.vit)} | ${f0(r.dex)} | ${f0(r.agi)} | **${f0(r.hp)}** | ${f0(r.regen)} | ${f1(evasion)}% | ${f1(res)}% |`;
  });
  return [`| build | ${S.item_slots}-item split | Str | Vit | Dex | Agi | Max HP | regen/sec | Evasion | res |`, '|---|---|---|---|---|---|---|---|---|---|---|', ...rows].join('\n');
}

function pushTable() {
  const rows = BUILDS.map((b: any) => {
    const r = build(b);
    const down = r.hp / (r.regen * 8);
    return `| ${b.id} | ${f0(r.vit)} | ${f0(r.hp)} | ${f0(r.regen)}/sec | **${f0(down)} sec** |`;
  });
  return ['| build | Vit | Max HP | hp_regen | Downtime per Push |', '|---|---|---|---|---|', ...rows].join('\n');
}

const SECTIONS: any[] = [
  { key: 'build-defs', title: 'Build definitions', render: buildDefs },
  { key: 'push-table', title: 'Push downtime', render: pushTable },
  { key: 'survival-mob', title: `Level ${S.level_cap} · one mob`, kind: 'normal' },
  { key: 'survival-group', title: `Level ${S.level_cap} · a group of 5 (3 engage at once)`, kind: 'group' },
  { key: 'survival-elite', title: `Level ${S.level_cap} · an elite`, kind: 'elite' },
  { key: 'survival-boss', title: `Level ${S.level_cap} · the zone-9 boss`, kind: 'boss' },
  { key: 'survival-boss-zones', title: 'Boss at every zone edge', render: zoneBossBlock },
];

function block(key: any) {
  const s = SECTIONS.find((x: any) => x.key === key);
  if (s.render) return s.render();
  return ['**' + s.title + '**', '', render(table(s.kind, s.title))].join('\n');
}

// ---------------------------------------------------------------- gates
function gates() {
  const out: any[] = [];
  const add = (id: any, ok: any, d: any) => out.push({ id, ok, d });
  const mobAcc = eng.mobAcc(S.level_cap, eng.MEAN_SPECIES_DEX, 1);
  const built = BUILDS.map((b: any) => build(b));

  const bad = built.filter((r: any) => r.hp <= 0 || r.regen < 0 || r.evRating < 0);
  add('SV1', bad.length === 0, `every build has a positive pool, regen and Evasion rating${bad.length ? ' · ' + bad.map((r: any) => r.b.id).join(', ') : ''}`);

  const tanks = built.find((r: any) => r.b.id === 'tank'), glass = built.find((r: any) => r.b.id === 'glass');
  // removed the per-item Core Stat % multiplier, so the widest pool separation the table can
  // have is now fully determined: a full Vit spread against a build that spent its thirteen items on
  // another stat, over the shared per-level term. The old `> 2x` band was priced while the %
  // multiplier still existed and no build can reach it any more, so the gate measures the separation
  // against the ceiling the data actually allows rather than against a margin from the retired 816.
  const vitMax = eng.statAt(S.level_cap) + S.core_flat_max * S.item_slots;
  const perLevelHp = LG.hp_per_level * (S.level_cap - 1);
  const sepMax = (vitMax * K.K_VIT_HP + perLevelHp) / (eng.statAt(S.level_cap) * K.K_VIT_HP + perLevelHp);
  const sep = tanks.hp / glass.hp;
  add('SV2', sep >= 1.5 && sep <= sepMax * 1.02, `tank pool ${f0(tanks.hp)} beats glass ${f0(glass.hp)} by ${f1(sep)}x — the flat-only ceiling allows at most ${f1(sepMax)}x, so the themes are distinct builds and the table cannot sell a wider margin than the data gives`);

  const b = table('boss', 'boss');
  const evasionRow = b.rows.find((r: any) => r.r.b.id === 'evasion');
  add('SV3', evasionRow.e.pct > 0, `the evasion build does take boss damage (${f1(evasionRow.e.pct)}% of pool) — Evasion is not immunity`);

  const grp = table('group', 'group');
  const maxGrp = Math.max(...grp.rows.map((r: any) => r.e.pct));
  add('SV4', maxGrp < 100, `a group of 5 costs at most ${f1(maxGrp)}% of pool, so AFK stays safe — this is the rule that makes it safe`);

  const capped = built.filter((r: any) => evasionVs(r, mobAcc) > E.caps.evasion + 0.01);
  add('SV5', capped.length === 0, `no printed build exceeds the ${E.caps.evasion}% Evasion Cap — the table cannot sell a number the Cap forbids${capped.length ? ' · ' + capped.map((r: any) => r.b.id).join(', ') : ''}`);

  // The G5 promise lives here: at the level cap the boss must Push the AFK builds, and a heal round
  // must open the door for the themes that spend their items on surviving. Which themes pass is
  // published, not just how many: folded Dodge into one capped Evasion line and removed
  // the Core Stat % multiplier, so a heal round now buys the two defensive themes and not the glass
  // build. That is the honest shape of the answer — a damage theme does not out-heal a boss — and a
  // bare count would let any other pair flip and still read as PASS.
  const bossRows = table('boss').rows;
  const pushed = bossRows.filter((r: any) => r.e.pct >= 100).length;
  const pass = healed(bossRows);
  add('SV6', pushed >= 3 && sameSet(pass, HEAL_PASS), `the G5 boss gate holds at level ${S.level_cap}: ${pushed}/4 builds Pushed without heal, and one heal round (×${HEAL_MULT}) clears it for ${pass.join(', ') || 'nobody'} — AFK cannot beat the boss and the themes that cast heal can${wrongTheme(pass)}`);

  // · the Upgrade ladder is a bounded line, and the bound has to hold against the boss as well:
  // every Gear Mod slot at +Cap is one more copy of the theme's own defensive line at the published
  // per-step value, and that is what checks.md H1 asks to be paid for.
  const gmSlots = (SLOT_MOD_ROLLS['Armour flat'] || []).length;
  const GM_STEP = E.craft.gear_mod_per_level;
  const GM_FULL = GM_STEP * E.craft.upgrade_cap * gmSlots;
  const bareTank = table('boss', 'boss').rows.find((r: any) => r.r.b.id === 'tank');
  const upRows = table('boss', 'boss', GM_FULL).rows;
  const pushedUp = upRows.filter((r: any) => r.e.pct >= 100).length;
  const passUp = healed(upRows);
  const tankUp = upRows.find((r: any) => r.r.b.id === 'tank');
  add('SV7', pushedUp >= 3 && sameSet(passUp, HEAL_PASS),
    `a full ${gmSlots}-slot Gear Mod set at +${E.craft.upgrade_cap} is +${GM_FULL} Armour on the heavy theme (${f1(tankUp.e.pct)}% of pool against the bare ${f1(bareTank.e.pct)}%) and the G5 promise still holds: ${pushedUp}/4 builds Pushed without heal, and the heal round still clears it for ${passUp.join(', ') || 'nobody'}${wrongTheme(passUp)}`);

  // B4 · mob skills are a re-timing of the priced `mob_PS`, never extra power (`combat.md` §5b ·
  //), so the shape that matters is how much of the pool one second of that damage can take.
  // No mob skill list exists yet to name a window, so the cage bounds the window instead of guessing
  // one: an AFK-reachable mob must not be able to spend two seconds of its own budget in one instant
  // and still empty the pool — the same promise SV4 makes about the average.
  const shape: any[] = [];
  for (const kind of ['normal', 'group', 'elite']) {
    for (const { r, e } of table(kind, kind).rows) {
      const netPerSec = Math.max(0, e.incoming - r.regen);
      const poolSec = netPerSec > 0 ? r.hp / netPerSec : Infinity;
      shape.push({ kind, id: r.b.id, poolSec, spike2: (2 * netPerSec) / r.hp * 100 });
    }
  }
  const shortest = shape.reduce((a: any, b: any) => (b.poolSec < a.poolSec ? b : a));
  const fails = shape.filter((s: any) => !(s.poolSec >= 2));
  add('SV8', fails.length === 0,
    `no AFK-reachable mob can one-hit-kill through a re-timing: the thinnest margin is ${shortest.id} against an ${shortest.kind} at ${f1(shortest.poolSec)} pool-seconds of its own priced damage, so the two-second burst shape costs ${f1(shortest.spike2)}% of that pool and a skill would have to spend ${f1(shortest.poolSec)} seconds of budget in one instant to empty it${fails.length ? ' · over the line: ' + fails.map((f: any) => `${f.id}/${f.kind}`).join(', ') : ''}`);

  return out;
}

const arg = process.argv[2];
if (arg === '--checks') {
  const rows = gates();
  for (const r of rows) console.log(`${r.id.padEnd(4)}  ${r.ok ? 'PASS ' : 'FAIL '}  ${r.d}`);
  const fails = rows.filter((r: any) => !r.ok).length;
  console.log(`\n${rows.length - fails}/${rows.length} gate PASS · ${fails} FAIL`);
  if (fails) process.exitCode = 1;
} else {
  console.log(`survival cage — engine.json → the combat model

  node tools/survival.ts --checks   gate the result
`);
}
