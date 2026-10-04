import { eng, loot, E, STAT_KEYS, BASES } from '../engine/client';
import { mastery, weaponByName } from './mastery';
import { weaponWeightOf } from './drop';
import type { Item, ModLine } from './types';
import type { StatKey } from '../engine/client';

/** Mod id → the character line it feeds. The ids are the mods.json rows; nothing is typed here. */
const PCT_LINE: Record<string, string> = {
  physical_power: 'physPct',
  magic_power: 'magicPct',
  attack_speed: 'aspdPct',
  accuracy: 'accPct',
  critical_chance: 'critPct',
  critical_damage: 'critDmgPct',
  max_hp: 'hpPct',
  max_mana: 'manaPct',
  max_energy_shield_pct: 'esPct',
  life_regen_pct: 'hpRegenPct',
  mana_regen_pct: 'manaRegenPct',
  elemental_power: 'elemPct',
  elemental_resistance: 'resPct',
  all_resistance_pct: 'allResPct',
  elemental_alignment: 'alignPct',
  cooldown_reduction: 'cdrPct',
  armour_pct: 'armourPct',
  evasion_pct: 'evasionPct',
  perfect_dodge_pct: 'pdodgePct',
  status_resistance_pct: 'statusResPct',
};
const FLAT_LINE: Record<string, string> = {
  physical_power_flat: 'physFlat',
  magic_power_flat: 'magicFlat',
  elemental_power_flat: 'elemFlat',
  armour_flat: 'armourFlat',
  evasion_flat: 'evasionFlat',
  energy_shield_flat: 'esFlat',
  max_hp_flat: 'hpFlat',
  max_mana_flat: 'manaFlat',
  life_regen_flat: 'hpRegenFlat',
  mana_regen_flat: 'manaRegenFlat',
};

export const SLOT_COUNT = E.stat.item_slots as number;

export interface StatLine {
  stat: StatKey;
  flat: number;
  pct: number;
}

export interface Lines {
  [key: string]: any;
  statBy: Record<StatKey, { flat: number; pct: number }>;
}

export function emptyGear(): (Item | null)[] {
  return new Array(SLOT_COUNT).fill(null);
}

export function sumLines(gear: (Item | null)[]): Lines {
  const acc: Lines = { statBy: {} } as Lines;
  for (const key of Object.values(PCT_LINE)) acc[key] = 0;
  for (const key of Object.values(FLAT_LINE)) acc[key] = 0;
  acc.elemBy = {} as Record<string, { flat: number; pct: number }>;
  for (const k of STAT_KEYS) acc.statBy[k] = { flat: 0, pct: 0 };
  for (const item of gear) {
    // a Broken piece is kept but counts as nothing: unequippable, stats 0, still at its level
    if (!item || item.broken) continue;
    // the Gear Mod is the piece's own inherent line and its school comes from the Base, not from a
    // roll (`item-base.md` · D-104); a Base with no school — every weapon, belt, ring, amulet, cape,
    // off hand — has nothing for +N to raise
    const school = (BASES.bases.find((b: any) => b.name === item.base) as any)?.school;
    if (item.gearMod && school && FLAT_LINE[school]) acc[FLAT_LINE[school]] += item.gearMod;
    for (const line of item.lines) {
      const stat = (line as any).stat as StatKey | undefined;
      if (line.id === 'stat_mod_flat' && stat) acc.statBy[stat].flat += line.value;
            else if (PCT_LINE[line.id]) acc[PCT_LINE[line.id]] += line.value;
      else if (FLAT_LINE[line.id]) acc[FLAT_LINE[line.id]] += line.value;
      // and an Elemental line also feeds its own Element's pool, the way a PoE item carries one
      // element per added-damage line (owner ruling, D-089)
      if (line.element && (line.id === 'elemental_power_flat' || line.id === 'elemental_power')) {
        const bucket = acc.elemBy[line.element] || (acc.elemBy[line.element] = { flat: 0, pct: 0 });
        if (line.id === 'elemental_power_flat') bucket.flat += line.value;
        else bucket.pct += line.value;
      }
    }
  }
  return acc;
}

export interface Character {
  level: number;
  core: Record<StatKey, number>;
  weaponName: string;
  weaponAspd: number;
  /** The Element the held weapon carries, from its own Elemental line, or null for none. */
  weaponElement: string | null;
  aspd: number;
  hitsPerSec: number;
  phys: number;
  magic: number;
  elem: number;
  /** Elemental power per Element, from the lines that carry one. Empty when nothing does. */
  elemByElement: Record<string, number>;
  accuracy: number;
  /** The Dex half of Evasion, as a rating — rolled against whichever mob is attacking (D-112). */
  evasion: number;
  /** Agi's half of Evasion, in percentage points added after that roll (30 Agi = 1). */
  evasionFromAgi: number;
  /**
   * Evasion read against the reference attacker (mean species · Medium body · tier ×1), so a row
   * that scales off avoidance has one stable sheet number to read — the same snapshot the
   * dodge table used to print. Against the mob actually attacking, the roll is recomputed.
   */
  evasionChance: number;
  armour: number;
  es: number;
  esRegen: number;
  maxHp: number;
  hpRegen: number;
  maxMana: number;
  manaRegen: number;
  critPool: number;
  critChance: number;
  critDmg: number;
  perfectDodge: number;
  alignment: number;
  resistance: number;
  /** Extra percentage points of resistance against one named Element (Trinity Form · D-102). */
  resByElement: Record<string, number>;
  /** A post-cap multiplier on the character's own clock — Haste, and nothing else (D-102). */
  globalSpeed: number;
  /** The multiplier a buff puts on incoming damage (Berserker takes more, Iron Will less). */
  damageTaken: number;
  /** % cut on the 20% status proc — the owner's Status Alignment resistance Mod line. */
  statusResist: number;
  /** % of just-dealt damage recovered on a landed hit; 0 unless a skill grants it. */
  leechPct: number;
  cdr: number;
  weightCap: number;
  weightUsed: number;
  encumbrance: number;
  /** Mastery level of the weapon being held; it moves weight and skill damage, never DPS. */
  weaponMastery: number;
  lines: Lines;
}

export interface Carried {
  potions?: number;
  condensed?: number;
  herbs?: number;
}

/** Everything carried that weighs: the worn pieces plus consumables (formula-utility.md §11). */
export function weightOfCarry(gear: (Item | null)[], carried: Carried = {}, heldMasteryLevel = 0): number {
  // Mastery lightens the held weapon only, up to -20% of its own weight
  const worn = gear.reduce((t, g) => t + (g?.slot === 'main hand'
    ? mastery.weaponWeight(g?.weight || 0, heldMasteryLevel)
    : (g?.weight || 0)), 0);
  return worn
    + (carried.potions || 0) * E.potions.weight
    + (carried.condensed || 0) * E.potions.condensed.weight
    + (carried.herbs || 0) * E.inventory.unit_weight.herb;
}

/**
 * The whole character sheet, built with the shared engine and nothing else.
 * A Stat Mod feeds its stat as flat then %, the same shape `ceilStat` uses for the 816 ceiling.
 */
/** The additive / multiplicative shape `engine/skills.js` `aggregateEffects` returns. */
export interface EffectFold {
  add: Record<string, number>;
  mult: Record<string, number>;
  /** Lines the row writes on a target rather than on us; the mob reads them, the sheet never does. */
  target?: { add: Record<string, number>; mult: Record<string, number> };
}

const m = (t: EffectFold, k: string) => t.mult[k] ?? 1;
const a = (t: EffectFold, k: string) => t.add[k] ?? 0;

export function buildCharacter(
  level: number,
  gear: (Item | null)[],
  carried: Carried = {},
  heldMasteryLevel = 0,
  effects: EffectFold = { add: {}, mult: {} },
): Character {
  const lines = sumLines(gear);
  const core = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    core[k] = (eng.statAt(level) + lines.statBy[k].flat) * (1 + lines.statBy[k].pct / 100);
  }
  const mainHand = gear.find((g) => g && g.slot === 'main hand') || null;
  // a weapon's Element is a stored line on the piece, not a property of the 12 types:
  // `equipment-weapon.md` carries no Element column, and `crafting.md` forbids locking one
  const weaponElement = mainHand ? (mainHand.lines.find((l) => l.element)?.element ?? null) : null;
  // the K_ELEM base belongs to the piece's own Element; each added line belongs to the Element it
  // carries, so a two-Element weapon is split and a one-Element one reads exactly as it did before
  const elemFromGear = (core.int * E.K.K_ELEM + lines.elemFlat) * (1 + lines.elemPct / 100);
  // a Herald adds flat damage of one named Element *on top of* what the gear already carries (D-096),
  // so it joins that Element's pool, lifts the total, and leaves every other pool as it was
  const herald: Record<string, number> = {};
  for (const [key, v] of Object.entries(effects.add || {})) {
    if (!key.startsWith('elemental_power:')) continue;
    const el = key.split(':')[1];
    herald[el] = (herald[el] || 0) + v * (1 + lines.elemPct / 100);
  }
  const elemTotal = elemFromGear + Object.values(herald).reduce((t, v) => t + v, 0);
  const elemByElement: Record<string, number> = {};
  for (const [el, bucket] of Object.entries((lines.elemBy || {}) as Record<string, { flat: number; pct: number }>)) {
    const base = el === weaponElement ? core.int * E.K.K_ELEM : 0;
    elemByElement[el] = (base + bucket.flat) * (1 + (lines.elemPct + bucket.pct) / 100);
  }
  // anything no line names keeps the rest of the pool unattributed, and is never countered either way
  const named = Object.values(elemByElement).reduce((a2, b2) => a2 + b2, 0);
  if (elemFromGear - named !== 0) elemByElement[''] = elemFromGear - named;
  for (const [el, v] of Object.entries(herald)) elemByElement[el] = (elemByElement[el] || 0) + v;
  // Trinity Form names the Elements it hardens against, so each one gets its own resistance line
  // (D-090's per-Element pools, spent on the incoming half by element · D-102)
  const resByElement: Record<string, number> = {};
  for (const [key, v] of Object.entries(effects.add || {})) {
    if (!key.startsWith('elemental_resistance:')) continue;
    resByElement[key.split(':')[1]] = (resByElement[key.split(':')[1]] || 0) + v;
  }
  // the 12 weapon types carry their own aspd; the merged rows in engine.json are an aspd band
  const weaponAspd = mainHand
    ? (weaponByName(mainHand.base)?.weapon_aspd ?? mainHand.weaponAspd ?? 1.2)
    : 1.2;
  const used = weightOfCarry(gear, carried, heldMasteryLevel);
  const burden = eng.encumbranceOf(used, core.str);
  const aspd = eng.aspdOf(core.agi, weaponAspd, lines.aspdPct + a(effects, 'attack_speed'))
    * m(effects, 'attack_speed') * (1 - burden);
  const critPool = eng.critPool(core.lck, lines.critPct);

  return {
    level,
    core,
    weaponName: mainHand ? mainHand.base : 'bare hand',
    weaponAspd,
    weaponElement,
    aspd,
    hitsPerSec: eng.hitsPerSec(aspd),
    phys: eng.physOf(core.str, lines.physFlat, lines.physPct + a(effects, 'physical_power'), weaponAspd)
      * m(effects, 'physical_power'),
    magic: eng.magicOf(core.int, lines.magicFlat, lines.magicPct, weaponAspd),
    elemByElement,
    elem: elemTotal,
    accuracy: eng.playerAccuracy(core.dex, lines.accPct),
    evasion: eng.evasionRating(core.dex, lines.evasionFlat, lines.evasionPct) + a(effects, 'evasion'),
    evasionFromAgi: eng.agilityEvasion(core.agi),
    evasionChance: eng.evasionChance(
      eng.evasionRating(core.dex, lines.evasionFlat, lines.evasionPct) + a(effects, 'evasion'),
      eng.agilityEvasion(core.agi),
      eng.refAttackerAcc(level),
    ),
    armour: (eng.armourOf(core.str) + lines.armourFlat + a(effects, 'armour')) * m(effects, 'armour')
      * (1 + lines.armourPct / 100),
    es: eng.maxEsOf(core.int, lines.esFlat + a(effects, 'energy_shield'), lines.esPct),
    esRegen: eng.esRegenOf(core.int),
    maxHp: eng.maxHpOf(core.vit, level, lines.hpPct, lines.hpFlat),
    // the regen lines multiply the stat's own regen — the engine already carries the % argument, so
    // a buff and a Mod line feed the same formula rather than each doing their own arithmetic
    hpRegen: eng.hpRegenOf(core.vit, lines.hpRegenPct + a(effects, 'hp_regen'), lines.hpRegenFlat),
    maxMana: eng.maxManaOf(core.int, level, lines.manaPct, lines.manaFlat),
    manaRegen: eng.manaRegenOf(core.int, lines.manaRegenPct + a(effects, 'mana_regen'), lines.manaRegenFlat),
    critPool,
    critChance: eng.critChanceOf(critPool),
    critDmg: eng.critDmgOf(critPool, lines.critDmgPct),
    perfectDodge: eng.perfectDodgeChance(core.lck, lines.pdodgePct),
    alignment: eng.alignmentOf(core.dex, lines.alignPct + a(effects, 'elemental_alignment'), m(effects, 'elemental_alignment')),
    // All Resistance lifts every Element at once, so it joins the same line the per-Element Mods feed
    // and the one Cap still binds the total (D-110)
    resistance: eng.resistanceOf(core.vit, lines.resPct + lines.allResPct, m(effects, 'elemental_resistance')),
    /** Extra resistance against one named Element, from an aura that names it (D-102). */
    resByElement,
    /** Haste's post-cap clock multiplier on cooldowns; attack speed carries its own share. */
    globalSpeed: m(effects, 'global_speed'),
    /** Berserker's leech, and the leech mark on a target pays, as a % of damage dealt. */
    leechPct: a(effects, 'leech'),
    /** What the skills currently up add to incoming damage — a buff can make you hurt more. */
    damageTaken: m(effects, 'damage_taken'),
    /**
     * Cut on the status proc, % (the owner's Status Alignment resistance line). It reads against
     * the 20% per landed hit in combat.md §5 — the one gear answer to statuses, since Holy veil
     * is a timed buff rather than a line.
     */
    statusResist: lines.statusResPct,
    cdr: eng.cdrOf(core.wis, lines.cdrPct),
    weightCap: eng.weightCapacityOf(core.str),
    weightUsed: used,
    encumbrance: burden,
    weaponMastery: heldMasteryLevel,
    lines,
  };
}

/** mods.json display name → Mod id, the same lookup tools/loot.js uses. */
export function modIdByName(name: string): string {
  const n = name.trim().toLowerCase();
  const hit = Object.keys(loot.NAME_OF).find((id: string) => {
    const full = String(loot.NAME_OF[id]).toLowerCase();
    return n === full || n === full.replace(/\s+(flat|%)$/, '');
  });
  if (!hit) throw new Error(`engine.json opening names a Mod that mods.json does not carry: ${name}`);
  return hit;
}

/**
 * The minute-one weapon, read straight out of engine.json `opening`. It weighs what its type says it
 * weighs — the same column a dropped weapon is priced from — otherwise the opening character carries
 * a sword for free and the aspd tax (`formula.md` section 11) never bites the build it exists for.
 */
export function openingGear(): (Item | null)[] {
  const gear = emptyGear();
  const g = (E.opening.gear as any[])[0];
  const lines: ModLine[] = Object.entries(g.mods).map(([name, value]) => ({
    id: modIdByName(name),
    value: Number(value),
  }));
  gear[0] = {
    slot: g.slot, base: g.base, rarity: 'Common', quality: g.quality, tier: `T${g.tier}`, lines,
    weight: weaponWeightOf(g.base, g.slot),
  };
  return gear;
}
