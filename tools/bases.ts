import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/json.ts';
import * as G from './lib/generated.ts';
import * as SHARED from '../engine/index.ts';
import type { Writer } from './lib/types.ts';

/**
 * Bases cage — `tools/data/bases.json` must equal the Base tables in `item-base.md`.
 *
 * The Bases (frame, weight, which Mod line is Primary / Secondary, Gear Mod school) were designed
 * in prose, and `tools/loot.ts` used to parse that prose at run time — which a browser cannot do.
 * This cage lifts them into data and then gates the two against each other, so the JSON is a
 * verified mirror rather than a second hand-typed copy. `--write` re-imports from the doc;
 * `--checks` fails on any drift and reports the published set totals.
 */

const MODS = readJson(path.join(import.meta.dirname, 'data', 'mods.json'));

const ROOT = path.resolve(import.meta.dirname, '..');
const DOC = 'item-base.md';
const OUT = path.join(import.meta.dirname, 'data', 'bases.json');
const SLOT_ORDER = ['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'amulet', 'earring', 'cape', 'off hand'];

const clean = (s: any): string => String(s).replace(/\s+/g, ' ').trim();
const splitMods = (s: any): string[] => String(s).split('·').map(clean).filter((x: string) => x && x !== '—' && x !== '-');
const idOf = (name: any): any => {
  const n = clean(name).toLowerCase();
  let hit: any = null;
  for (const m of MODS.mods) {
    const full = m.name.toLowerCase();
    const bare = full.replace(/\s+(flat|%)$/, '');
    if (n === full || n === bare || n.startsWith(full + ' ')) hit = hit || m.id;
  }
  return hit;
};

/** Parse `| Base | Weight | Primary | Secondary |` under each `## slot` heading. */
function parseDoc(): Record<string, any> {
  const text = G.read(DOC);
  const bySlot: Record<string, any> = {};
  let slot: any = null, inTable = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      const name = line.slice(3).toLowerCase();
      slot = SLOT_ORDER.find((s: string) => name === s || name.startsWith(s + ' ')) || null;
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
function parseSchools(): Record<string, any> {
  const text = G.read(DOC);
  const line = text.split(/\r?\n/).find((l: string) => /carry\s+(Armour|Evasion|Energy Shield)/i.test(l));
  const out: Record<string, any> = {};
  if (!line) return out;
  // verb is `carry` for the three families and `take the school of the heaviest type ...:`
  // for the three-way frames. The gap stops at the next open paren, not at a full stop,
  // because a Base name may contain one.
  for (const m of line.matchAll(/(Heavy|light|cloth|three-way) Bases?\s*\(([^)]*)\)([^(]*?)(?:carry|take the school of the heaviest type[^()]*?:)\s*(Armour|Evasion|Energy Shield)/gi)) {
    const id = idOf(m[4]);
    for (const b of m[2].split('·')) out[clean(b)] = id;
  }
  return out;
}

/**
 * The Line 1 pool per slot and weapon type, from the table under `# Line 1 · Base Mod`.
 * Armour slots list their three defence Mods (the Base's own type is the locked one, read off the
 * schools sentence); weapons list every Mod the type forces; belt / ring / amulet carry the marker
 * `pool`, meaning "roll line 1 from the slot's own Legacy pool".
 */
function parseLine1(): Record<string, any> {
  const text = G.read(DOC);
  const i = text.indexOf('# Line 1');
  const j = text.indexOf('# Base Table per Slot', i);
  const out: Record<string, any> = {};
  if (i < 0) return out;
  let seenHeader = false;
  for (const line of text.slice(i, j < 0 ? undefined : j).split(/\r?\n/)) {
    const c = line.split('|').map(clean);
    if (c.length < 4 || c[0] !== '') continue;
    if (c[1] === 'Slot / type') { seenHeader = true; continue; }
    if (!seenHeader || /^-+$/.test(c[1])) continue;
    const ids = splitMods(c[2]).map(idOf).filter(Boolean);
    out[c[1]] = ids.length ? ids : ['pool'];
  }
  return out;
}

/** The parsed Line 1 table in the shape the drop roll reads: defence list · pool slots · per-type. */
function line1Pools(): any {
  const raw = parseLine1();
  const defence: string[] = [];
  const legacy_slots: string[] = [];
  const weapons: Record<string, string[]> = {};
  const off_hand: Record<string, string[]> = {};
  for (const [key, ids] of Object.entries(raw)) {
    if (key === 'Shield' || key === 'Book') { off_hand[key] = ids; continue; }
    const parts = key.split('\u00b7').map(clean);
    if (ids.length === 1 && ids[0] === 'pool') {
      for (const slot of SLOT_ORDER) if (parts.includes(slot)) legacy_slots.push(slot);
      continue;
    }
    if (parts.includes('helmet')) { defence.push(...ids); continue; }
    weapons[key] = ids;
  }
  return { defence, legacy_slots, weapons, off_hand };
}

/** "The off hand's two families: **Shield** (Buckler · Kite Shield) carries …" → frame name → family. */
function parseOffHandFamilies(): Record<string, any> {
  const text = G.read(DOC);
  const line = text.split(/\r?\n/).find((l: string) => /off hand's two families/i.test(l));
  const out: Record<string, any> = {};
  if (!line) return out;
  for (const m of line.matchAll(/\*\*(\w+)\*\* \(([^)]*)\)/g)) {
    for (const n of m[2].split('\u00b7')) out[clean(n)] = m[1];
  }
  return out;
}

/** The 11 weapon types from equipment-weapon.md, and the off-hand-only items below that table. */
/**
 * The off-hand mass rule lives in `mod-pool.md`'s weight line: "dual-wield counts x0.8". Read, not
 * retyped, so the sentence is the one home for the number (B13).
 */
function parseDualWieldMult(): number {
  const text = G.read('mod-pool.md');
  const m = text.match(/dual-wield counts\s*x\s*(0?\.\d+|\d+(\.\d+)?)/i);
  if (!m) throw new Error('mod-pool.md no longer states the dual-wield weight multiplier');
  return Number(m[1]);
}

function parseWeapons(): any[] {
  const text = G.read('equipment-weapon.md');
  const rows: any[] = [];
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
function parseWeaponPools(): any {
  const text = G.read('equipment-slot-weapon.md');
  const section = (from: string, to: string): string => {
    const i = text.indexOf(from);
    const j = text.indexOf(to, i);
    return text.slice(i, j < 0 ? undefined : j);
  };
  const roles = (body: string): Record<string, any> => {
    const out: Record<string, any> = {};
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

/**
 * The % line a Base's defence locks (item-base.md Line 1 table). The schools sentence names the type
 * in words ("Evasion"), the Gear Mod school is the flat id, and line 1 uses the % form — so the %
 * line is found by matching the school word against the Line 1 defence list, never typed here.
 */
const NAME_OF: Record<string, string> = Object.fromEntries(MODS.mods.map((m: any) => [m.id, m.name]));
function defencePctOf(flatId: any): any {
  if (!flatId) return null;
  const word = clean(NAME_OF[flatId] || '').split(' ')[0].toLowerCase();
  return line1Pools().defence.find((id: string) => clean(NAME_OF[id] || '').toLowerCase().includes(word)) || null;
}

/** The frame list per weapon type, from the A10 table in item-base.md — the doc owns it, the data mirrors it. */
function parseFrames(): Record<string, any[]> {
  const text = G.read(DOC);
  const section = (text.split(/^## Frames per weapon type\s*$/m)[1] || '').split(/^#\s+/m)[0];
  const out: Record<string, any[]> = {};
  for (const line of section.split(/\r?\n/)) {
    if (!/^\|/.test(line) || /^\|\s*-{2,}/.test(line) || /^\|\s*Type\s*\|/i.test(line)) continue;
    const c = line.split('|').slice(1, -1).map(clean);
    if (c.length < 3 || !c[0] || !c[1]) continue;
    // a frame rolls EQUALLY inside its type, exactly as a Base does inside its slot (roll_rule)
    (out[c[0]] = out[c[0]] || []).push({ name: c[1], base_mod: splitMods(c[2]), weight: 1 });
  }
  return out;
}

function build(): any {
  const bySlot = parseDoc();
  const schools = parseSchools();
  const families = parseOffHandFamilies();
  const bases: any[] = [];
  for (const [slot, rows] of Object.entries(bySlot)) {
    for (const r of rows) {
      const school = schools[r.name] || null;          // the flat Gear Mod the frame's school carries
      const defence = defencePctOf(school); // the % line line 1 locks 
      // the cape carries a defence type on its Base Mod line but no Gear Mod ladder: the
      // Quality-Stone ladder belongs to the five slots engine/loot.ts GEAR_MOD_SLOTS names
      bases.push({ ...r, slot, defence, school: slot === 'cape' ? null : school, family: families[r.name] || null });
    }
  }
  return {
    note: 'The Base frames per slot, imported from item-base.md by tools/bases.ts --write. Weight is in the unit items show; primary and secondary are the Mod ids that frame may roll; defence is the type line 1 locks; school is the Gear Mod the frame carries; family is the off-hand family (Shield · Book) and null elsewhere. base_mod is the line-1 pool in the shape the roll reads: defence is the three armour Mods, legacy_slots the slots whose line 1 draws from their own pool, weapons the forced Mods per type, off_hand the Shield / Book families. weapons and weapon_pools come from equipment-weapon.md and equipment-slot-weapon.md. weapon_frames is the A10 list per weapon type (from the Frames table in item-base.md), which the loot roll reads at step 2. tools/loot.ts and the client both read this file, and `node tools/bases.ts --checks` gates it against the docs so none of them can drift.',
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
    base_mod: line1Pools(),
    weapons: parseWeapons(),
    // mod-pool.md states the off hand's mass rule ("dual-wield counts x0.8") in one sentence; this
    // reads it out as a number so the client never types the 0.8 beside it (B13)
    dual_wield_weight_mult: parseDualWieldMult(),
    weapon_pools: parseWeaponPools(),
    weapon_frames: parseFrames(),
  };
}

/**
 * The three paths item-base.md publishes. Each list names one ring, and the worn set has two, so
 * the second ring repeats the first — that reading is what makes cloth (193) and armored (420)
 * reproduce exactly.
 */
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

/**
 * Print one of the two weight tables from data. The Base weights are the only home of these numbers,
 * `quality_weight_multiplier` is applied per Item quality band exactly as `weightAtQuality` applies it
 * to a single item, and each tax figure is the engine's own `encumbranceOf` under the Cap.
 */
function renderPaths(kind: string): string {
  const data = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const C = capacities();
  const mult = data.quality_weight_multiplier;
  const w = (name: string): number => data.bases.find((b: any) => b.name === name)?.weight || 0;
  const taxOf = (high: number, str: number): string => {
    const e = ENGINE.encumbranceOf(high, str);
    return e > 0 ? '\u2212' + Math.round(e * 100) + '%' : '0%';
  };
  const sets = PATHS.map((p) => {
    const base = p.bases.reduce((acc: number, n: string) => acc + w(n), 0);
    return { p, base, mid: Math.round(base * mult), high: Math.round(base * mult * mult) };
  });
  if (kind === 'tax') {
    return [
      '| Worn set at high quality (item-base.md) | High weight | No Str (' + C.none + ') | Str 2 items (' + C.two + ') | Str 6 items (' + C.six + ') |',
      '|---|---|---|---|---|',
      ...sets.map((s) => '| ' + s.p.name + ' (' + s.p.gear + ') | ' + s.high
        + ' | ' + taxOf(s.high, C.strNone) + ' | ' + taxOf(s.high, C.strTwo) + ' | ' + taxOf(s.high, C.strSix) + ' |'),
      '',
      'Capacity is `weight_base` plus Str \u00d7 `K_STR_WEIGHT` at level ' + C.level + ' with no investment (' + C.strNone + ' \u2192 ' + C.none + '), then `core_flat_max` flat per slot spent on Str: 2 items (' + C.two + ') and 6 items (' + C.six + ') \u2014 Core Stat has no % line any more. The tax is the engine\u2019s own `encumbranceOf`, capped at ' + Math.round(C.capPct * 100) + '%.',
    ].join('\n');
  }
  return [
    '| Chosen path | Combined total (low quality) | Full set (mid quality) | Full set (high quality) | Aspd tax with no Str investment |',
    '|---|---|---|---|---|',
    ...sets.map((s) => '| ' + s.p.name + ' (' + s.p.gear + ') | ' + s.base + ' | ' + s.mid + ' | ' + s.high + ' | ' + taxOf(s.high, C.strNone) + ' |'),
    '',
    'Printed by `node tools/bases.ts --blocks` from `tools/data/bases.json`. Mid and high apply `quality_weight_multiplier` (\u00d7' + mult + ') per Item quality band, the same way `weightAtQuality` applies it to a single item. The held weapon is not folded into these sets: it weighs ' + Math.min(...data.weapons.map((x: any) => x.weight)) + ' to ' + Math.max(...data.weapons.map((x: any) => x.weight)) + ' at Base weight (`equipment-weapon.md`), the same \u00d7-quality multiplier applies, and an off-hand weapon counts \u00d7' + data.dual_wield_weight_mult + ' of its own type (`mod-pool.md`).',
  ].join('\n');
}

/**
 * Weapon × body class (HugePatch §12): the ladder `engine.json weapon_size_mult` carries, printed
 * where the weapon families are documented. `X47` gates the same rows, so the table cannot drift.
 */
function renderSizeLadder() {
  const engine: any = readJson(path.join(import.meta.dirname, 'data', 'engine.json'));
  const ladder: Record<string, any> = (engine.weapon_size_mult || {}).ladder || {};
  const rows = Object.entries(ladder).map(([name, l]) => {
    const fav = l.small > l.medium ? 'Small' : l.large > l.medium ? 'Large' : '—';
    return `| ${name} | ${Number(l.small).toFixed(2)} | ${Number(l.medium).toFixed(2)} | ${Number(l.large).toFixed(2)} | ${fav} |`;
  });
  return [
    '| Weapon | Small | Medium | Large | Favours |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    'One multiplier on the **physical share** of an outgoing hit, applied **after** mitigation so it never scales the armour ratio: the weapon\'s own swing always carries its row (a staff\'s swing included), a physical attack skill carries it too, and a **magic-damage skill is exempt**. A boss is not a size — it declares which column it reads (`mob.sizes` `reads_as`, Large by default). The one-handed sword is flat at 1.00, so the reference row moves no zone price. **How the rows are derived, with no magnitude typed by hand:** the *direction* comes from each weapon\'s own line and the rules the design already states — heavy single-target press and armour penetration answer a Large body, accuracy and long reach answer a Small one, and magic answers Large through the Element half that already bypasses armour — and the *magnitude* is the owner\'s own dagger ladder (`1.25 / 0.90 / 0.75`), reused as-is for a Small-favouring row and pointed the other way for a Large-favouring one. A row the weapon has no opinion about (the one-handed axe, whose line is bleed and answers no body) stays flat. **A magic weapon is the related case `weapon.basic_attack` names:** it has no swing, it flicks a **bolt** — a press on the attack clock with no mana and no cooldown, worth the attack ladder\'s floor instead of a swing\'s full hit — read off the weapon\'s own `damage` line, so a wand cannot be a bolt in one file and a swing in another (**X50** · `wand` · `staff`). `engine.json` `weapon_size_mult` is the home, and this is the weapon type\'s own rule — not a Mastery bonus, so `AGENT.md` §5\'s per-weapon DPS ban is untouched.',
  ].join('\n');
}

/**
 * The frame list a weapon type drops as (A10). `item-base.md` states the rule and `bases.json`
 * `weapon_frames` owns it, so the table is a projection and cannot drift from the roll.
 */
function renderWeaponFrames() {
  const data: any = readJson(path.join(import.meta.dirname, 'data', 'bases.json'));
  const frames: Record<string, any> = data.weapon_frames || {};
  const rows = Object.entries(frames).flatMap(([type, list]) =>
    (list as any[]).map((f, i) => `| ${type} | ${f.name} | ${(f.base_mod || []).join(' · ')} |${i === 0 ? ' **reference** |' : ' |'}`));
  return [
    '| Weapon type | Frame | Base-Mod lines it forces | |',
    '|---|---|---|---|',
    ...rows,
    '',
    'Step 2 of the loot roll picks the **type** and then the **frame** inside it, so a type ships as frame variants: the frame is what the piece is called and what it forces, which is why two frames of one type differ in their craftable-Mod count. A type\'s frames roll **equally**, like a Base inside its slot. The **reference frame** of every type carries exactly the lines its type forced before the frame list existed, so the published behaviour has a named home and no measured loot number moved (A10 · `item-base.md` · `bases.ts` BS9).',
  ].join('\n');
}

const WRITERS: Writer[] = [
  { file: 'item-base.md', key: 'three-paths', render: () => renderPaths('paths') },
  { file: 'formula-utility.md', key: 'weight-tax', render: () => renderPaths('tax') },
  { file: 'equipment-weapon.md', key: 'size-ladder', render: renderSizeLadder },
  { file: 'equipment-weapon.md', key: 'weapon-frames', render: renderWeaponFrames },
];
function checks(): any[] {
  const out: any[] = [];
  const add = (id: any, status: any, detail: any): number => out.push({ id, status, ok: status !== 'fail', detail });
  const doc = build();
  let current: any = null;
  try { current = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { current = null; }
  if (!current) {
    add('BS1', 'fail', 'tools/data/bases.json is missing — run `node tools/bases.ts --write`');
    return out;
  }
  const same = ['bases', 'base_mod', 'weapons', 'weapon_pools'].every((k: string) => JSON.stringify(current[k]) === JSON.stringify(doc[k]));
  add('BS1', same ? 'pass' : 'fail', same
    ? `${doc.bases.length} Base rows across ${doc.slots.length} slots match item-base.md`
    : 'bases.json disagrees with item-base.md — run `node tools/bases.ts --write`');
  add('BS2', current.quality_weight_multiplier === 1.3 ? 'pass' : 'fail',
    `the Quality multiplier applied to weight is ${current.quality_weight_multiplier} (item-base.md · formula.md section 11)`);
  const totals = PATHS.map((p) => weightOf(doc.bases, p.bases));
  add('BS3', totals.every((x: number) => x > 0) && totals[0] < totals[1] && totals[1] < totals[2] ? 'pass' : 'fail',
    `the three paths order as designed: cloth ${totals[0]} < balanced ${totals[1]} < armored ${totals[2]}, summed from the Base rows the tables print from`);
  const m = current.quality_weight_multiplier;
  add('BS4', m > 1 && totals.every((x: number) => Math.round(x * m * m) > x) ? 'pass' : 'fail',
    `quality weight grows per band at ×${m}: ${PATHS.map((p, i) => `${p.label} ${totals[i]}→${Math.round(totals[i] * m)}→${Math.round(totals[i] * m * m)}`).join(' · ')}`);

  const weapons = current.weapons || [];
  const statedCount = Number((G.read('equipment-weapon.md').match(/Weapons have \*\*(\d+) types\*\*/) || [])[1]);
  add('BS5', weapons.length === statedCount ? 'pass' : 'fail',
    `${weapons.length} weapon types imported from equipment-weapon.md (the doc states ${statedCount})`);
  const multBad = weapons.filter((w: any) => Math.abs(w.weapon_mult - Math.round((1.2 / w.weapon_aspd) * 100) / 100) > 0.011);
  add('BS6', multBad.length === 0 ? 'pass' : 'fail', multBad.length
    ? `weapon_mult ≠ 1.2 / weapon_aspd for ${multBad.map((w: any) => w.name).join(', ')}`
    : 'every weapon type keeps the equal-DPS rule weapon_mult = 1.2 / weapon_aspd');
  const blocked = current.weapon_pools?.['main hand']?.Blocked || [];
  const primary = current.weapon_pools?.['main hand']?.Primary || [];
  const secondary = current.weapon_pools?.['main hand']?.Secondary || [];
  const leaks = blocked.filter((id: any) => primary.includes(id) || secondary.includes(id));
  add('BS7', blocked.length > 0 && leaks.length === 0 ? 'pass' : 'fail',
    leaks.length ? `the main hand blocks and offers the same line: ${leaks.join(', ')}` : `main-hand pool offers ${primary.length + secondary.length} lines and blocks ${blocked.length}`);
  const M = current.mastery || {};
  const capPct = weapons.length * (M.drop_bonus_per_type_pct || 0);
  const statedCap = (G.read('equipment-weapon.md').match(/\+(\d+)% \((\d+) types\)/) || []);
  add('BS8', capPct === Number(statedCap[1]) && weapons.length === Number(statedCap[2]) ? 'pass' : 'fail',
    `the account-wide Mastery drop bonus tops out at ${weapons.length} × ${M.drop_bonus_per_type_pct}% = ${capPct}% (equipment-weapon.md states +${statedCap[1]}% across ${statedCap[2]} types)`);
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
  add('BS9', frameProblems.length === 0 && weapons.length === statedCount ? 'pass' : 'fail',
    frameProblems.length ? frameProblems.join(' · ')
      : `${weapons.length} weapon types each carry ${Math.min(...Object.values(FRAMES).map((l: any) => l.length))}-${Math.max(...Object.values(FRAMES).map((l: any) => l.length))} frames (${frameCount} in all), the first frame of every type is its live forced pair, and every frame line is a real Mod (A10 · item-base.md)`);
  // B13: the weight column exists, every type carries one, and the two endpoints are the
  // range `mod-pool.md` states out of its own mouth — read back from that sentence, never retyped here.
  const stated = (G.read('mod-pool.md').match(/weight by type \((\w+) (\d+) → ([a-z -]+) (\d+)\)/) || []);
  const noWeight = weapons.filter((w: any) => !(w.weight > 0));
  const lightNamed = weapons.filter((w: any) => w.name === stated[1]);
  const heavyNamed = weapons.filter((w: any) => w.name === stated[3]);
  const endpointBad = stated.length !== 5 || !lightNamed.length || !heavyNamed.length
    || lightNamed.some((w: any) => w.weight !== Number(stated[2])) || heavyNamed.some((w: any) => w.weight !== Number(stated[4]));
  const spanBad = Math.min(...weapons.map((w: any) => w.weight || 0)) !== Number(stated[2] || 0)
    || Math.max(...weapons.map((w: any) => w.weight || 0)) !== Number(stated[4] || 0);
  add('BS10', !noWeight.length && !endpointBad && !spanBad ? 'pass' : 'fail',
    !noWeight.length && !endpointBad && !spanBad
      ? `all ${weapons.length} weapon types carry a weight, and the span ${Math.min(...weapons.map((w: any) => w.weight))}-${Math.max(...weapons.map((w: any) => w.weight))} is exactly the range mod-pool.md states ("${stated[1]}/${stated[2]} → ${stated[3]} ${stated[4]}")`
      : `${noWeight.length ? 'NO WEIGHT: ' + noWeight.map((w: any) => w.name).join(', ') + ' · ' : ''}${endpointBad ? `endpoints disagree with mod-pool.md (${stated[1]}/${stated[2]} → ${stated[3]}/${stated[4]})` : ''}${spanBad ? ' · the set does not span the stated range' : ''}`);
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
  console.log('Bases cage — tools/data/bases.json ↔ item-base.md\n\n  node tools/bases.ts --write    import the Base tables into data\n  node tools/bases.ts --checks  gate the two against each other\n');
}

export { checks, build, parseDoc, parseSchools, WRITERS, renderPaths, capacities };
