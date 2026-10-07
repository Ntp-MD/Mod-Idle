/**
 * Data registry — the machine-readable description of everything under
 * tools/data/. It is what lets the wiki render, edit, and validate a data file
 * it has never seen before: declared fields supply labels, units, enums and
 * cross-references; anything undeclared is inferred from the JSON value itself,
 * so adding a new key or a new record never breaks the editor.
 *
 * The cages (tools/check.ts, tools/town.ts) stay the authority: this module is a
 * front gate that catches typos before a write, not a replacement for --checks.
 *
 *   specs                       declared file + collection description
 *   inspect(fileName, data)     collections and their items, ready to render
 *   coerce(field, raw)          form string → typed JSON value
 *   validateWrite(...)          record / constant / prose checks before a write
 */

import * as R from './roster.ts';
import { extractBlocks } from './md.ts';

// field spec: [type, label, extra]
//   type   int num str text bool enum ref list map json
//   extra  { options, ref, unit, min, max, nullable, readonly, help, pattern }
const num = (label: string, x?: any): any[] => ['num', label, x];
const str = (label: string, x?: any): any[] => ['str', label, x];
const txt = (label: string, x?: any): any[] => ['text', label, x];

const ELEMENTS = ['fire', 'cold', 'lightning', 'poison', 'chaos'];
const LADDERS = ['stash_tab', 'herb_pouch', 'plot_deed', 'house', null];

const specs: Record<string, any> = {
  'tools/data/engine.json': {
    label: 'Engine source data',
    doc: 'core-stats.md',
    writers: ['tools/check.ts', 'tools/town.ts'],
    note: 'Stat model · K values · Mod maxima · loot model · craft prices · timeline. Changing a number here re-prices every town line and rewrites checks.md groups A · B · C · F.',
    collections: {
      stat: { kind: 'constmap', group: 'Stat model', label: 'Stat growth', fields: {
        base: ['int', 'Base stat at level 1'], level_cap: ['int', 'Player level cap'],
        mob_level_cap: ['int', 'Mob level cap'], item_slots: ['int', 'Equipment slots'],
        core_flat_max: ['int', 'Stat Mod flat per Mod'], split_items: ['int', 'Items per stat in the reference split'],
        points_per_level: ['int', 'Stat points per level (2-100)'], point_value: ['num', 'Stat gained per point'],
        paragon_from: ['int', 'First Paragon level'], paragon_points_per_level: ['int', 'Stat points per Paragon level'],
        tree_points_per_level: ['int', 'Tree points per level'], reference_build: ['text', 'Reference build'],
        respec_cost: ['int', 'Respec cost'],
      } },
      level_gain: { kind: 'constmap', group: 'Stat model', label: 'Level gain', fields: {
        hp_per_level: ['int', 'HP per level'], mp_per_level: ['int', 'Mana per level'],
        hp_base: ['int', 'Base Max HP'], mana_base: ['int', 'Base Max Mana'], weight_base: ['int', 'Base weight capacity'],
        hp_pct_mod_slots: ['int', 'Slots carrying HP %'], res_mod_items: ['int', 'Items carrying element res'],
        cdr_mod_items: ['int', 'Items carrying CDR'], cdr_buff_pct: ['int', 'CDR from buffs', { unit: '%' }],
      } },
      K: { kind: 'constmap', group: 'Stat model', label: 'K coefficients', fields: {} },
      caps: { kind: 'constmap', group: 'Stat model', label: 'Caps', note: 'null means uncapped.', fields: {
        crit_chance: ['num', 'Crit chance', { unit: '%', nullable: true }],
        evasion: ['num', 'Evasion', { unit: '%', nullable: true }],

        perfect_dodge: ['num', 'Perfect dodge', { unit: '%', nullable: true }],
        alignment: ['num', 'Alignment', { unit: '%', nullable: true }],
        elem_res: ['num', 'Element resistance', { unit: '%', nullable: true }],
        cdr: ['num', 'Cooldown reduction', { unit: '%', nullable: true }],
        aspd: ['num', 'Attack speed bonus', { unit: '%', nullable: true }],
        accuracy: ['num', 'Accuracy', { unit: '%', nullable: true }],
        weight_overload: ['num', 'Weight overload fraction'],
      } },
      mod_max: { kind: 'constmap', group: 'Items', label: 'Mod maxima', fields: {} },
      weapons: { kind: 'records', group: 'Items', label: 'Weapon types', idField: 'name', columns: ['name', 'weapon_aspd'], fields: {
        name: str('Weapon', { unique: true }),
        weapon_aspd: num('Base attack speed', { min: 0.1, max: 5, help: 'weapon_mult is derived as 1.2 ÷ weapon_aspd (DPS equality).' }),
      } },
      build: { kind: 'constmap', group: 'Engine', label: 'Reference build', fields: {
        reference_split: txt('Reference split'),
        hit_chance_pct: num('Hit chance', { unit: '%' }),
        crit_chance_pct: num('Crit chance', { unit: '%' }),
        dagger_capped_at_500: ['bool', 'Dagger reaches Aspd Cap'],
      } },
      loot: { kind: 'constmap', group: 'Loot', label: 'Loot model', fields: {
        base_drop_chance: num('Base drop chance', { min: 0, max: 1 }),
        ttk_per_mob_sec: num('Seconds to kill one mob'),
        group_spawn_sec: num('Group spawn interval', { unit: 'sec' }),
        elite_spawn_chance: num('Elite spawn chance', { min: 0, max: 1 }),
        elite_tier_stones: ['int', 'Tier stones per elite'],
        boss_per_hour: ['int', 'Boss kills per hour'],
        boss_tier_stones: ['int', 'Tier stones per boss'],
        kill_rate_tolerance: num('Kill-rate tolerance', { min: 0, max: 1 }),
      } },
      'loot.bands': { kind: 'recordmap', group: 'Loot', label: 'Band parameters', idField: '$key', columns: ['$key', 'group_mobs', 'lck_level', 'upgrades_per_hr'], fields: {
        group_mobs: num('Mobs per group', { min: 0.1 }),
        lck_level: ['int', 'Luck level', { nullable: true, pattern: '^(ceiling|\\d+)$', help: 'Integer level, or the word "ceiling".' }],
        upgrades_per_hr: ['int', 'Upgrades kept per hour'],
      } },
      'loot.bands.$add': { hidden: true },
      f_rows_carried: { kind: 'records', group: 'Engine', label: 'Hand-carried F rows', idField: 'id', columns: ['id', 'value', 'status'], note: 'Rows the engine does not compute yet; they are read back against the prose.', fields: {
        id: str('Row id', { pattern: '^[A-Z]\\d+$' }),
        value: txt('Value'),
        expression: txt('Expression'),
        status: ['enum', 'Status', { options: ['carried', 'measured', 'pending', 'rule'] }],
      } },
      craft: { kind: 'constmap', group: 'Crafting', label: 'Craft costs', fields: {
        reroll_value_stones_per_use: ['int', 'Value stones per Reroll'],
        refine_stones_per_use: ['int', 'Stones per Refine'],
        ascend_add_stones: ['int', 'Add-Mod stones per Ascend'],
        ascend_tier_stones: ['int', 'Tier stones per Ascend'],
        refine_slots_per_item: num('Refine slots per item'),
        refine_steps: ['int', 'Refine steps'],
        ascend_items_per_set: ['int', 'Items per Ascend set'],
        polish_casts_per_full_set: ['int', 'Polish casts per full set'],
      } },
      town_shared: { kind: 'constmap', group: 'Town', label: 'Shared town constants', fields: {
        gold_per_junk_piece: num('Gold per junk piece'),
        round_rate_to_decimals: ['int', 'Rate rounding decimals'],
        craft_progress_intent_sec: ['int', 'Craft progress intent', { unit: 'sec' }],
        pool_regen_tolerance: num('Mana pool/regen tolerance', { unit: 'sec' }),
      } },
    },
  },

  'tools/data/town.json': {
    label: 'Town economy source data',
    doc: 'towns.md',
    writers: ['tools/town.ts'],
    note: 'Prices · rosters · stock · Standing shares · Collector sets. The only place a town number is written by hand. tools/town.ts --write rebuilds towns-stalls.md and checks.md group T from it.',
    collections: {
      npcs: { kind: 'records', group: 'Cast', label: 'NPC kinds', idField: 'id', columns: ['id', 'name', 'kind', 'rule'], fields: {
        id: str('id', { pattern: '^[a-z][a-z0-9_]*$' }), name: str('Name'),
        kind: ['enum', 'Kind', { ref: 'invariants.allowed_kinds' }], rule: txt('Where it appears'),
      } },
      settlements: { kind: 'records', group: 'Cast', label: 'Settlements', idField: 'id', columns: ['id', 'name', 'zone', 'band', 'capital'], fields: {
        id: str('id', { pattern: '^[a-z][a-z0-9_]*$' }), name: str('Name'),
        zone: ['int', 'Zone', { min: 1, max: 9 }],
        band: ['enum', 'Band', { ref: 'engine:loot.bands' }],
        capital: ['enum', 'Capital of', { options: ['low', 'mid', 'high', ''], nullable: true }],
        innate: ['list', 'Innate elements', { options: ELEMENTS }],
        base_bias_flavor: str('Base bias (flavour)'),
        budget_note: txt('Budget note'),
        npcs: ['list', 'NPCs', { ref: 'npcs' }],
        stock: ['list', 'Stock lines', { ref: 'stock' }],
        start: ['bool', 'Starting settlement'],
        armourer_discount_m: num('Armourer discount', { unit: 'm' }),
        armourer_variant: str('Armourer variant'),
      } },
      one_time: { kind: 'records', group: 'Catalogue', label: 'One-time lines', idField: 'id', columns: ['id', 'item', 'npc', 'kind', 'm'], fields: {
        id: str('id', { pattern: '^[a-z][a-z0-9_]*$' }), item: str('Item', { guard: 'power' }),
        npc: ['ref', 'NPC', { ref: 'npcs' }],
        kind: ['enum', 'Kind', { ref: 'invariants.allowed_kinds' }],
        m: num('Price (gold weight)', { min: 0 }),
        charge: str('Charge rule'), charge_band: ['enum', 'Charged in band', { ref: 'engine:loot.bands' }],
        qty: ['int', 'Quantity'], qty_by_band: ['map', 'Quantity by band', { ref: 'engine:loot.bands' }],
        ladder: ['enum', 'Price ladder', { options: LADDERS.filter(Boolean).concat(['']) }],
        discount: ['map', 'Discount', {}], display_only: ['bool', 'Display only'],
        use_discount: ['bool', 'Uses a discount'], note: txt('Note'),
      } },
      repeatable: { kind: 'records', group: 'Catalogue', label: 'Repeatable lines', idField: 'id', columns: ['id', 'item', 'npc', 'kind', 'm'], fields: {
        id: str('id', { pattern: '^[a-z][a-z0-9_]*$' }), item: str('Item', { guard: 'power' }),
        npc: ['ref', 'NPC', { ref: 'npcs' }],
        kind: ['enum', 'Kind', { ref: 'invariants.allowed_kinds' }],
        m: num('Price (gold weight)', { min: 0 }), m_min: num('Min price (gold weight)'), m_max: num('Max price (gold weight)'),
        charge_band: ['enum', 'Charged in band', { ref: 'engine:loot.bands' }],
        per_day_cap: ['int', 'Per-day cap'], note: txt('Note'),
      } },
      essentials: { kind: 'records', group: 'Catalogue', label: 'Essentials basket', idField: 'id', columns: ['id', 'qty_by_band', 'use_discount'], fields: {
        id: ['ref', 'Line', { ref: 'one_time' }], qty_by_band: ['map', 'Quantity by band', { ref: 'engine:loot.bands' }],
        use_discount: ['bool', 'Uses the teaching discount'],
      } },
      collector_sets: { kind: 'records', group: 'Catalogue', label: 'Collector sets', idField: 'id', columns: ['id', 'name', 'settlement', 'school', 'quality'], fields: {
        id: str('id', { pattern: '^[a-z][a-z0-9_]*$' }), name: str('Name'),
        settlement: ['ref', 'Settlement', { ref: 'settlements' }],
        school: ['enum', 'School', { options: ['cloth', 'light', 'mail', 'heavy', ''] }],
        pieces: ['list', 'Pieces'], quality: ['enum', 'Quality required', { options: ['any', 'high', ''] }],
        reward: txt('Reward'), pays_gold: ['bool', 'Pays gold'], rule: txt('Rule'),
      } },
      'standing.tiers': { kind: 'records', group: 'Standing', label: 'Standing tiers', idField: 'name', columns: ['name', 'share', 'unlocks'], fields: {
        name: str('Tier'), share: num('Share of the zone kill budget', { min: 0 }), unlocks: txt('Unlocks'),
      } },
      standing: { kind: 'constmap', group: 'Standing', label: 'Standing rules', fields: {
        earnt_from: txt('Earnt from'), grants: ['list', 'Grants'], never_grants: ['list', 'Never grants'],
      } },
      base_bias: { kind: 'constmap', group: 'Open', label: 'Base bias (pending)', fields: {
        status: ['enum', 'Status', { options: ['pending', 'closed'] }],
        column_meaning: txt('Column meaning'), checks: ['list', 'Checks to close it'], forbidden_until_closed: ['list', 'Forbidden until closed'],
      } },
      pending: { kind: 'records', group: 'Open', label: 'Pending numbers', idField: 'number', columns: ['number', 'breaks', 'status'], fields: {
        number: str('Number'), breaks: txt('What it breaks'), status: ['enum', 'Status', { options: ['open', 'closed'] }],
      } },
      invariants: { kind: 'constmap', group: 'Open', label: 'Invariants (guards)', note: 'These bound every price the tables can hold; tools/town.ts fails the build when a table violates them.', fields: {
        allowed_kinds: ['list', 'Allowed kinds'], banned_power_nouns: ['list', 'Banned power nouns'],
      } },
    },
  },

  'tools/data/skills.json': {
    label: 'Skill roster source data',
    doc: 'skill-pool.md',
    writers: ['tools/skills.ts'],
    note: 'The roster · reserve tiers · deprecated names. tools/skills.ts --write rebuilds the roster tables in skill-pool*.md; --checks runs the D18 mechanic gate. Counts are always derived from this file, never hand-typed.',
    collections: {
      skills: { kind: 'records', group: 'Roster', label: 'Skills', idField: 'id', columns: ['id', 'name', 'type', 'group', 'element', 'cd', 'effect'], fields: {
        id: str('id', { pattern: '^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$' }),
        name: str('Name', { unique: true }),
        type: ['enum', 'Type', { options: R.TYPES }],
        group: ['enum', 'Weapon group', { options: R.WEAPON_GROUPS.concat(['all', '']) }],
        element: str('Element / tag'),
        cd: ['num', 'Cooldown', { unit: 'sec' }],
        mana: str('Mana cost', { pattern: '^(\\d+(?:\\.\\d+)?)\\s*(%|flat)(?![A-Za-z]).*$' }),
        scale: str('Scaling stat'),
        targets: str('Targets / hits'),
        effect: txt('Effect'),
        kind: str('Aura kind'),
        reserve: ['enum', 'Reserve tier', { options: Object.keys(R.RESERVE).concat(['']), nullable: true }],
        duration: str('Duration'),
        damage: ['map', 'Damage by build'],
      } },
      reserve_tiers: { kind: 'recordmap', group: 'Roster', label: 'Reserve tiers', idField: '$key', columns: ['$key', 'pct', 'abs'], fields: {
        pct: ['num', 'Percent of pool', { unit: '%' }],
        abs: ['int', 'Absolute at pool 4,848'],
      } },
      deprecated: { kind: 'constmap', group: 'Roster', label: 'Deprecated names', fields: {} },
      renames: { kind: 'constmap', group: 'Roster', label: 'Renames (old → new)', note: 'tools/tree.ts --write applies these to the node "Enables" cells.', fields: {} },
    },
  },

  'tools/data/tree.json': {
    label: 'Skill-tree source data',
    doc: 'skill-tree.md',
    writers: ['tools/tree.ts'],
    note: 'Branch/limb shape · the 18 keystones · the waived dangling refs. The 122 minor nodes stay as prose in skill-tree-*.md; tools/tree.ts parses them and validates every "Enables" cell against the roster.',
    collections: {
      branches: { kind: 'records', group: 'Tree', label: 'Branches', idField: 'id', columns: ['id', 'name', 'file', 'minors', 'limbs'], fields: {
        id: str('id', { pattern: '^[a-z][a-z0-9_]*$' }),
        name: str('Name'),
        file: str('Detail file'),
        minors: ['int', 'Minor nodes'],
        limbs: ['int', 'Limbs'],
      } },
      keystones: { kind: 'records', group: 'Tree', label: 'Keystones', idField: 'id', columns: ['id', 'name', 'branch', 'value', 'pair', 'origin'], fields: {
        id: str('id', { pattern: '^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$' }),
        name: str('Name', { unique: true }),
        branch: str('Branch'),
        value: ['num', 'Measured value', { unit: '%' }],
        pair: str('Exclusive pair'),
        origin: ['enum', 'Origin', { options: ['original', 'new'] }],
      } },
      pending_refs: { kind: 'constmap', group: 'Tree', label: 'Waived dangling refs', fields: {} },
    },
  },
};

// ------------------------------------------------------------------ helpers

const ID_RE = /^[a-z][a-z0-9_]*$/;

function getPath(obj: any, dotted: string): any {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj: any, dotted: string, value: any): any {
  const keys = dotted.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
    o = o[keys[i]];
  }
  if (value === undefined) delete o[keys[keys.length - 1]];
  else o[keys[keys.length - 1]] = value;
  return obj;
}

function inferType(value: any): string {
  if (value === null) return 'str';
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'num';
  if (Array.isArray(value)) return 'list';
  if (typeof value === 'object') return 'map';
  return 'str';
}

function labelize(key: string): string {
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function fieldSpecs(coll: any, items: any[]): any[] {
  const declared = coll.fields || {};
  const extra: string[] = [];
  for (const it of items) {
    const v = it.value || {};
    for (const k of Object.keys(v)) if (!extra.includes(k) && !declared[k]) extra.push(k);
  }
  const order: string[] = [];
  for (const k of coll.columns || []) if (!order.includes(k)) order.push(k);
  for (const k of Object.keys(declared)) if (!order.includes(k)) order.push(k);
  for (const k of extra) if (!order.includes(k)) order.push(k);
  const out: any[] = [];
  for (const name of order) {
    const d = declared[name];
    const sample = items.map((i) => (i.value || {})[name]).find((x) => x !== undefined);
    if (name === '$key') { out.push({ name, type: 'str', label: 'key', readonly: true, help: 'the object key this row is stored under' }); continue; }
    if (d) {
      out.push(Object.assign({ name, type: d[0], label: d[1] || labelize(name) }, d[2] || {}));
    } else {
      out.push({ name, type: inferType(sample), label: labelize(name), inferred: true });
    }
  }
  return out;
}

/** Collections of one data file, merged with what the file actually holds. */
function inspect(fileName: string, data: any): any[] {
  const spec = specs[fileName];
  if (!spec) return [];
  const out: any[] = [];
  for (const [path, coll] of Object.entries(spec.collections) as [string, any][]) {
    if (coll.hidden) continue;
    const value = getPath(data, path);
    const items: any[] = [];
    if (coll.kind === 'records' && Array.isArray(value)) {
      value.forEach((rec, i) => items.push({ id: String((rec || {})[coll.idField] ?? `#${i}`), index: i, value: rec }));
    } else if (coll.kind === 'recordmap' && value && typeof value === 'object') {
      for (const [k, rec] of Object.entries(value)) items.push({ id: k, key: k, value: rec });
    } else if (coll.kind === 'constmap' && value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) continue; // nested maps are their own collection
        items.push({ id: k, key: k, value: { [k]: v } });
      }
    }
    if (!items.length && coll.kind === 'constmap') continue;
    out.push({
      file: fileName, path, group: coll.group, label: coll.label, note: coll.note,
      kind: coll.kind, idField: coll.idField, writable: true,
      fields: fieldSpecs(coll, items), items,
    });
  }
  return out;
}

/** All ids a reference can point at, across both data files. */
function refOptions(ref: any, ctx: any): any[] | null {
  if (!ref) return null;
  if (ref === 'stock') return ([] as any[]).concat(refOptions('one_time', ctx) || [], refOptions('repeatable', ctx) || []);
  if (ref.startsWith('engine:')) {
    const key = ref.slice(7);
    if (key === 'loot.bands') return Object.keys(ctx.engine && ctx.engine.loot ? ctx.engine.loot.bands : {});
    return Object.keys(ctx.engine[key] || {});
  }
  if (ref.includes('.')) {
    const arr = getPath(ctx.town, ref);
    if (arr == null) return null;
    if (Array.isArray(arr)) return arr.map((r) => (r && typeof r === 'object' ? (r.id ?? r.name) : r)).filter(Boolean);
    return Object.keys(arr);
  }
  const coll = ctx.townColl && ctx.townColl[ref];
  if (coll) return coll.map((r: any) => (r ? r.id ?? r.name : null)).filter(Boolean);
  return null;
}

function context(engine: any, town: any): any {
  const coll: Record<string, any> = {};
  const list = (f: string, data: any) => { for (const c of inspect(f, data)) coll[c.path] = c.items.map((i: any) => i.value); };
  list('tools/data/engine.json', engine);
  list('tools/data/town.json', town);
  return { engine, town, townColl: coll, engineColl: coll };
}

// ------------------------------------------------------------------ coercion

function coerce(field: any, raw: any): any {
  const t = field.type;
  if (raw === undefined || raw === null) return { value: undefined };
  if (typeof raw === 'object') return { value: raw };
  const s = String(raw).trim();
  if (t === 'str' && field.nullable && /^-?\d+(\.\d+)?$/.test(s)) return { value: Number(s) };
  if (s === '' && (t === 'str' || t === 'text' || t === 'enum' || t === 'ref' || field.nullable || t === 'map' || t === 'list' || t === 'json')) {
    if (field.nullable || s === '') return { value: t === 'list' || t === 'map' || t === 'json' ? undefined : (field.nullable ? null : '') };
  }
  if (t === 'int' || t === 'num') {
    if (!/^-?\d+(\.\d+)?$/.test(s)) return { error: `${field.label}: needs a number, got "${raw}"` };
    const v = t === 'int' ? parseInt(s, 10) : parseFloat(s);
    if (field.min != null && v < field.min) return { error: `${field.label}: ${v} is below the minimum ${field.min}` };
    if (field.max != null && v > field.max) return { error: `${field.label}: ${v} is above the maximum ${field.max}` };
    return { value: v };
  }
  if (t === 'bool') return { value: s === 'true' || s === '1' || s === 'on' };
  if (t === 'list' || t === 'map' || t === 'json') {
    let parsed;
    if (t === 'list') {
      parsed = s.startsWith('[') ? safeJson(s, t) : s.split(',').map((x) => x.trim()).filter((x) => x !== '');
      if (parsed && parsed.error) return { error: parsed.error };
    } else {
      parsed = safeJson(s, t);
      if (parsed && parsed.error) return { error: parsed.error };
    }
    return { value: parsed };
  }
  if (field.pattern && s && !new RegExp(field.pattern).test(s)) return { error: `${field.label}: "${s}" does not match ${field.pattern}` };
  return { value: s };
}

function safeJson(s: string, t: string): any {
  try {
    const v = JSON.parse(s);
    if (t === 'list' && !Array.isArray(v)) return { error: 'expected a JSON array' };
    if (t === 'map' && (typeof v !== 'object' || v === null || Array.isArray(v))) return { error: 'expected a JSON object' };
    return v;
  } catch (e) {
    return { error: `not valid JSON (${e.message})` };
  }
}

// ------------------------------------------------------------------ validation

const POWER_NOUNS_DEFAULT = ['gear', 'Mod', 'potion', 'stone', 'Reroll', 'Refine', 'Ascend', 'weapon'];

function validateRecord(coll: any, ctx: any, values: any, { id = null, extraKeys = [] }: { id?: any; extraKeys?: string[] } = {}): any[] {
  const errors: any[] = [];
  const known = new Map(coll.fields.map((f: any) => [f.name, f]));
  for (const f of coll.fields) {
    if (f.readonly) continue;
    const raw = values[f.name];
    if (raw === undefined) {
      if (f.required) errors.push({ field: f.name, msg: `${f.label} is required` });
      continue;
    }
    const c = coerce(f, raw);
    if (c.error) { errors.push({ field: f.name, msg: c.error }); continue; }
    const v = c.value;
    if (v === undefined || v === null) {
      if (f.required) errors.push({ field: f.name, msg: `${f.label} is required` });
      else if (v === null && !f.nullable && !['list', 'map', 'json'].includes(f.type)) errors.push({ field: f.name, msg: `${f.label} cannot be null` });
      continue;
    }
    if (f.type === 'enum' || f.type === 'ref') {
      const options = f.ref && f.ref.includes('allowed_kinds')
        ? getPath(ctx.town, 'invariants.allowed_kinds')
        : refOptions(f.ref, ctx) || f.options || [];
      if (options.length && !options.includes(v) && !(v === null || v === '')) {
        errors.push({ field: f.name, msg: `${f.label}: "${v}" is not one of ${options.filter((o: any) => o !== null).join(' · ')}` });
      }
    }
    if (f.type === 'list' && f.ref) {
      const options = refOptions(f.ref, ctx) || [];
      for (const item of Array.isArray(v) ? v : []) {
        if (!options.includes(item)) errors.push({ field: f.name, msg: `${f.label}: "${item}" is not a known ${f.ref}` });
      }
    }
    if (f.type === 'list' && f.options) {
      for (const item of Array.isArray(v) ? v : []) {
        if (!f.options.includes(item)) errors.push({ field: f.name, msg: `${f.label}: "${item}" is not one of ${f.options.join(' · ')}` });
      }
    }
    if (f.guard === 'power') {
      const banned = getPath(ctx.town, 'invariants.banned_power_nouns') || POWER_NOUNS_DEFAULT;
      const hit = String(v || '').split(/\s+/).filter((w) => banned.some((b: any) => w.toLowerCase() === String(b).toLowerCase()));
      if (hit.length) errors.push({ field: f.name, msg: `${f.label}: a stall cannot sell ${hit.join(', ')} (AGENTS rule — gold buys space, time, information and appearance only)` });
    }
    if (f.pattern && typeof v === 'string' && v && !new RegExp(f.pattern).test(v)) {
      errors.push({ field: f.name, msg: `${f.label}: "${v}" does not match ${f.pattern}` });
    }
  }
  for (const k of extraKeys) if (!known.has(k) && k !== coll.idField) {
    errors.push({ field: k, msg: `unknown field "${k}" — it is not in ${coll.path}; check the spelling or edit the raw JSON`, warn: true });
  }
  if (id && fieldPatternFor(coll, id)) {
    const f = fieldPatternFor(coll, id);
    if (!new RegExp(f.pattern).test(String(id))) errors.push({ field: coll.idField, msg: `${f.label}: "${id}" does not match ${f.pattern}` });
  }
  return errors;
}

function fieldPatternFor(coll: any, id: any): any {
  const declared = coll.fields || {};
  const d = declared[coll.idField];
  if (!d) return null;
  const extra = d[2] || {};
  return extra.pattern ? { pattern: extra.pattern, label: coll.idField } : null;
}

/** Guards that read across records — cheap copies of what the cages enforce. */
function validateCross(coll: any, ctx: any, record: any, { id, siblings = [] }: { id?: any; siblings?: any[] } = {}): any[] {
  const errors: any[] = [];
  const inv = ctx.town.invariants || {};
  if (coll.path === 'settlements') {
    const zones = siblings.filter((s: any) => s.zone != null).map((s: any) => s.zone);
    if (record.zone != null && zones.filter((z: any) => z === record.zone).length > 1) errors.push({ field: 'zone', msg: `zone ${record.zone} is already used by another settlement` });
    const band = record.band;
    if (band && !(band in ctx.engine.loot.bands)) errors.push({ field: 'band', msg: `band "${band}" is not in engine.json loot.bands` });
  }
  if ((coll.path === 'one_time' || coll.path === 'repeatable') && record.m != null) {
    // travel is free now: a walk has no line to buy, so a road/carriage/waypoint line is a mistake
    if (/^(road|carriage|waypoint)/.test(id || '')) {
      errors.push({ field: 'id', msg: `"${id}" is a travel line — a walk costs nothing and a Waypoint unlocks on foot, so there is no travel line to sell` });
    }
    const banned = inv.banned_power_nouns || [];
    const text = String(record.item || '');
    const hit = banned.filter((b: any) => new RegExp(`\\b${b}\\b`, 'i').test(text));
    if (hit.length) errors.push({ field: 'item', msg: `"${text}" sells or names ${hit.join(', ')} — outside the gold guard (AGENTS §6)` });
  }
  if (coll.path === 'repeatable' && id === 'skip_token' && record.per_day_cap != null) {
    if (record.per_day_cap > (inv.skip_token_max_per_day ?? Infinity)) errors.push({ field: 'per_day_cap', msg: `cap ${record.per_day_cap}/day exceeds invariants.skip_token_max_per_day` });
    if ((record.m || 0) * record.per_day_cap > (inv.skip_token_max_m_per_day ?? Infinity)) errors.push({ field: 'm', msg: `m × per_day_cap must stay under invariants.skip_token_max_m_per_day` });
  }
  if (coll.path === 'standing.tiers' && (ctx.town.standing.tiers || []).length < (inv.standing_min_tiers ?? 0)) {
    errors.push({ field: 'name', msg: `standing needs at least ${inv.standing_min_tiers} tiers` });
  }
  return errors;
}

/** Prose guard: a hand-edit may not touch a generated block. */
function validateProse(before: string, after: string): string[] {
  const b = extractBlocks(before).map((x) => `${x.key}\u0000${x.body}`);
  const a = extractBlocks(after).map((x) => `${x.key}\u0000${x.body}`);
  const missing = b.filter((x) => !a.includes(x));
  const added = a.filter((x) => !b.includes(x));
  const msgs: string[] = [];
  if (missing.length || added.length) {
    msgs.push(`Generated blocks changed by hand (${(missing.concat(added)).map((x) => x.split('\u0000')[0]).join(', ')}). Edit tools/data/*.json and run the writer, or let the cages rewrite the block.`);
  }
  const be = (before.match(/BEGIN GENERATED:/g) || []).length;
  const ae = (after.match(/BEGIN GENERATED:/g) || []).length;
  const eb = (before.match(/END GENERATED:/g) || []).length;
  const ea = (after.match(/END GENERATED:/g) || []).length;
  if (be !== ae || eb !== ea) msgs.push('BEGIN/END GENERATED markers were added or removed.');
  return msgs;
}

function serialize(obj: any): string {
  return JSON.stringify(obj, null, 2) + '\n';
}

export { specs, inspect, fieldSpecs, getPath, setPath, coerce, validateRecord, validateCross, validateProse, refOptions, context, serialize, labelize, inferType, ID_RE };