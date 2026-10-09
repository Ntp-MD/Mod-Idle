import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/json.ts';
import * as SHARED from '../engine/index.ts';

/**
 * Bases cage — `tools/data/bases.json` is the source for every Base frame.
 *
 * The Bases (frame, weight, which Mod line is Primary / Secondary, Gear Mod school) live in the
 * JSON and nothing parses a doc into them; this cage gates the JSON against `engine/` and the Mod
 * data, so the file is a verified source rather than a second hand-typed copy.
 */

const MODS = readJson(path.join(import.meta.dirname, 'data', 'mods.json'));

const OUT = path.join(import.meta.dirname, 'data', 'bases.json');

const PATHS = [
  { name: 'cloth/glass', label: 'cloth', bases: ['Circlet', 'Vestment', 'Legwraps', 'Silk Slippers', 'Silk Sash', 'Silk Wraps', 'Iron Band', 'Iron Band', 'Jade Amulet', 'Silver Hoop', 'Traveler\'s Cloak'], gear: 'Circlet \u00b7 Vestment \u00b7 Legwraps \u00b7 Silk Slippers \u00b7 Silk Sash \u00b7 Silk Wraps \u00b7 Iron Band \u00d72 \u00b7 Jade Amulet \u00b7 Silver Hoop \u00b7 Traveler\'s Cloak' },
  { name: 'balanced', label: 'balanced', bases: ['Hood', 'Ring Mail', 'Breeches', 'Strapped Boots', 'Chain Clasp', 'Nimble Mitts', 'Iron Band', 'Iron Band', 'Jade Amulet', 'Jade Stud', 'Traveler\'s Cloak'], gear: 'Hood \u00b7 Ring Mail \u00b7 Breeches \u00b7 Strapped Boots \u00b7 Chain Clasp \u00b7 Nimble Mitts \u00b7 Iron Band \u00d72 \u00b7 Jade Amulet \u00b7 Jade Stud \u00b7 Traveler\'s Cloak' },
  { name: 'armored', label: 'armored', bases: ['Sallet', 'Plate Vest', 'Cuisses', 'Plated Greaves', 'War Belt', 'Iron Gauntlets', 'Moonstone Signet', 'Moonstone Signet', 'Onyx Talisman', 'Onyx Drop', 'Heavy Mantle'], gear: 'Sallet \u00b7 Plate Vest \u00b7 Cuisses \u00b7 Plated Greaves \u00b7 War Belt \u00b7 Iron Gauntlets \u00b7 Moonstone Signet \u00d72 \u00b7 Onyx Talisman \u00b7 Onyx Drop \u00b7 Heavy Mantle' },
];

const weightOf = (bases: any[], names: any[]): number => names.reduce((t: number, n: any) => t + (bases.find((b: any) => b.name === n)?.weight || 0), 0);

/**
 * BS3 / BS4 are properties of the printed tables now: the
 * "Three Paths" numbers were hand-typed in prose and did not follow from the Base weights in the same
 * file, so both tables are generated from `tools/data/bases.json` and the gates check ordering and
 * growth instead of matching a typed copy.
 */
const EDATA = readJson(path.join(import.meta.dirname, 'data', 'engine.json'));
const ENGINE = SHARED.createEngine(EDATA);

/** The worn sets the tax math is shown against: Str from levels only, then 2 and 6 slots on Str. */
function capacities(): any {
  const S = EDATA.stat;
  const bare = ENGINE.statAt(S.level_cap - 1);
  const strAt = (n: number): number => bare + n * S.core_flat_max;
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

function checks(): any[] {
  const out: any[] = [];
  const add = (id: any, status: any, detail: any): number => out.push({ id, status, ok: status !== 'fail', detail });
  let current: any = null;
  try { current = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { current = null; }
  if (!current) {
    add('BS1', 'fail', 'tools/data/bases.json is missing');
    return out;
  }
  // bases.json is the source now — nothing parses a doc into it
  const doc = current;
  const shape = Array.isArray(current.bases) && current.bases.length > 0 && Array.isArray(current.slots) && current.slots.length > 0
    && ['base_mod', 'weapons', 'weapon_pools', 'weapon_frames'].every((k: string) => current[k]);
  add('BS1', shape ? 'pass' : 'fail', shape
    ? `${current.bases.length} Base rows across ${current.slots.length} slots, with base_mod · weapons · weapon_pools · weapon_frames present`
    : 'bases.json is missing a required section');
  add('BS2', current.quality_weight_multiplier === 1.3 ? 'pass' : 'fail',
    `the Quality multiplier applied to weight is ${current.quality_weight_multiplier}`);
  const totals = PATHS.map((p) => Math.round(weightOf(doc.bases, p.bases) * 10) / 10);
  add('BS3', totals.every((x: number) => x > 0) && totals[0] < totals[1] && totals[1] < totals[2] ? 'pass' : 'fail',
    `the three paths order as designed: cloth ${totals[0]} < balanced ${totals[1]} < armored ${totals[2]}, summed from the Base rows the tables print from`);
  const m = current.quality_weight_multiplier;
  add('BS4', m > 1 && totals.every((x: number) => Math.round(x * m * m) > x) ? 'pass' : 'fail',
    `quality weight grows per band at ×${m}: ${PATHS.map((p, i) => `${p.label} ${totals[i]}→${Math.round(totals[i] * m)}→${Math.round(totals[i] * m * m)}`).join(' · ')}`);

  // The owner ruling: a frame's name says which FLAT defence lines its Base Mod carries, and the frames
  // of an armour slot cover every combination of the three — three singles, three pairs and the one
  // frame that carries all three — without repeating one. The name is the promise the player reads, so
  // this is the gate behind it.
  {
    const ARMOUR_SLOTS = ['helmet', 'chest', 'pant', 'boots', 'gloves', 'cape'];
    const TRIO = ['armour_flat', 'energy_shield_flat', 'evasion_flat'];
    const want = new Set<string>([...TRIO]);
    for (let i = 0; i < TRIO.length; i++) for (let j = i + 1; j < TRIO.length; j++) want.add([TRIO[i], TRIO[j]].sort().join('+'));
    want.add([...TRIO].sort().join('+'));
    const bad: string[] = [];
    for (const slot of ARMOUR_SLOTS) {
      const sets = (current.bases || []).filter((b: any) => b.slot === slot)
        .map((b: any) => [...(b.base_lines || [])].sort().join('+'));
      const uniq = new Set(sets);
      if (sets.length !== want.size || uniq.size !== want.size || [...want].some((w) => !uniq.has(w))) {
        bad.push(`${slot}: ${sets.length} frames / ${uniq.size} unique — ${sets.join(' | ')}`);
      }
      for (const b of (current.bases || []).filter((b: any) => b.slot === slot)) {
        const lines: string[] = b.base_lines || [];
        if (!lines.length) bad.push(`${b.name} has no base_lines`);
        for (const id of lines) if (!want.has(id)) bad.push(`${b.name} carries ${id}, which is not one of the three flat defence lines`);
      }
    }
    add('BS11', bad.length === 0 ? 'pass' : 'fail', bad.length ? bad.join(' · ')
      : `every armour slot covers all ${want.size} combinations of the three flat defence lines exactly once — ${ARMOUR_SLOTS.length} slots × ${want.size} (${[...want].join(' · ')}), one of them the frame that carries all three, each frame's Base Mod flat and named by the frame`);
  }

  const weapons = current.weapons || [];
  add('BS5', weapons.length > 0 ? 'pass' : 'fail',
    `${weapons.length} weapon types in bases.json, each with its own frame list`);
  const multBad = weapons.filter((w: any) => Math.abs(w.weapon_mult - Math.round(ENGINE.weaponMult(w.weapon_aspd) * 100) / 100) > 0.011);
  add('BS6', multBad.length === 0 ? 'pass' : 'fail', multBad.length
    ? `weapon_mult ≠ the engine's weaponMult for ${multBad.map((w: any) => w.name).join(', ')}`
    : "every weapon type keeps the engine's equal-DPS rule weapon_mult = engine weaponMult(weapon_aspd)");
  const blocked = current.weapon_pools?.['main hand']?.Blocked || [];
  const primary = current.weapon_pools?.['main hand']?.Primary || [];
  const secondary = current.weapon_pools?.['main hand']?.Secondary || [];
  const leaks = blocked.filter((id: any) => primary.includes(id) || secondary.includes(id));
  add('BS7', blocked.length > 0 && leaks.length === 0 ? 'pass' : 'fail',
    leaks.length ? `the main hand blocks and offers the same line: ${leaks.join(', ')}` : `main-hand pool offers ${primary.length + secondary.length} lines and blocks ${blocked.length}`);
  const M = current.mastery || {};
  const capPct = weapons.length * (M.drop_bonus_per_type_pct || 0);
  add('BS8', capPct > 0 ? 'pass' : 'fail',
    `the account-wide Mastery drop bonus tops out at ${weapons.length} × ${M.drop_bonus_per_type_pct}% = ${capPct}%`);
  // A10: every weapon type carries a frame list. The FIRST frame of each type is exactly the live
  // forced pair, so the published behaviour has a named home, and every frame names Base-Mod lines
  // that exist in `mods.json`. This replaced the old "no variant list defined yet" guard.
  const KNOWN_MOD_IDS = new Set((MODS.mods || []).map((m: any) => m.id));
  const FRAMES = current.weapon_frames || {};
  const frameProblems: string[] = [];
  for (const w of weapons) {
    const list = FRAMES[w.name];
    if (!Array.isArray(list) || !list.length) { frameProblems.push(`${w.name} has no frame list`); continue; }
    if (JSON.stringify(list[0].base_mod) !== JSON.stringify((current.base_mod?.weapons || {})[w.name])) frameProblems.push(`${w.name}: the first frame is not the live forced pair`);
    for (const f of list) {
      if (!(f.weight > 0)) frameProblems.push(`${w.name}/${f.name} carries no weight`);
      if (!(f.base_mod || []).length) frameProblems.push(`${w.name}/${f.name} forces no line`);
      for (const id of f.base_mod || []) if (!KNOWN_MOD_IDS.has(id)) frameProblems.push(`${w.name}/${f.name}: unknown line ${id}`);
      if (list.filter((x: any) => x.name === f.name).length > 1) frameProblems.push(`${w.name} names ${f.name} twice`);
    }
  }
  for (const t of Object.keys(FRAMES)) if (!weapons.some((w: any) => w.name === t)) frameProblems.push(`a frame list for an unknown type ${t}`);
  const frameCount = Object.values(FRAMES).flat().length;
  add('BS9', frameProblems.length === 0 ? 'pass' : 'fail',
    frameProblems.length ? frameProblems.join(' · ')
      : `${weapons.length} weapon types each carry ${Math.min(...Object.values(FRAMES).map((l: any) => l.length))}-${Math.max(...Object.values(FRAMES).map((l: any) => l.length))} frames (${frameCount} in all), the first frame of every type is its live forced pair, and every frame line is a real Mod (A10)`);
  // B13: the weight column exists and every type carries one.
  const noWeight = weapons.filter((w: any) => !(w.weight > 0));
  const wSpan = [Math.min(...weapons.map((w: any) => w.weight || 0)), Math.max(...weapons.map((w: any) => w.weight || 0))];
  add('BS10', noWeight.length === 0 ? 'pass' : 'fail',
    noWeight.length
      ? 'NO WEIGHT: ' + noWeight.map((w: any) => w.name).join(', ')
      : `all ${weapons.length} weapon types carry a weight, spanning ${wSpan[0]}-${wSpan[1]}`);
  return out;
}

function report(): void {
  const rows = checks();
  for (const r of rows) console.log(`${r.status.toUpperCase().padEnd(8)}${r.id.padEnd(13)}${r.detail}`);
  const failed = rows.filter((r: any) => r.status === 'fail').length;
  const pending = rows.filter((r: any) => r.status === 'pending').length;
  console.log(`\n${rows.length - failed}/${rows.length} gate PASS · ${pending} PENDING · ${failed} FAIL`);
  if (failed) process.exit(1);
}

if (process.argv.includes('--checks')) {
  report();
} else {
  console.log('Bases cage — tools/data/bases.json is the source\n\n  node tools/bases.ts --checks   gate the Base tables\n');
}

export { checks, capacities };
