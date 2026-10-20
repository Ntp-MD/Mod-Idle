import { eng, loot, E, STAT_KEYS, BASES, BASE_BY_NAME } from '../engine/client';
import { mastery } from './mastery';
import { weaponWeightOf } from './drop';
import type { Item, ModLine } from './types';
import { tree } from '../engine/client';
import type { StatKey } from '../engine/client';
import type { LifeSkillBonus } from '../../../engine/life-skills.ts';
// The sheet's line tables live apart (`sim/lines.ts`) so the passive-tree cage can check that every
// node grants a line the character sheet actually acts on.
import { PCT_LINE, FLAT_LINE } from './lines.ts';

export const SLOT_COUNT = E.stat.item_slots as number;

export interface Lines {
  [key: string]: any;
  statBy: Record<StatKey, { flat: number; pct: number }>;
  /** Elemental resistance lines that name an Element — fire does not top up cold */
  resBy: Record<string, number>;
}

export function emptyGear(): (Item | null)[] {
  return new Array(SLOT_COUNT).fill(null);
}

export function sumLines(gear: (Item | null)[], extra?: { id: string; value: number; stat?: string }[]): Lines {
  const acc: Lines = { statBy: {} } as Lines;
  for (const key of Object.values(PCT_LINE)) acc[key] = 0;
  for (const key of Object.values(FLAT_LINE)) acc[key] = 0;
  acc.elemBy = {} as Record<string, { flat: number; pct: number }>;
  acc.resBy = {};
  for (const k of STAT_KEYS) acc.statBy[k] = { flat: 0, pct: 0 };
  // the passive tree is a second line source (`engine/tree.ts`): it feeds the same buckets gear does,
  // so a bought rank moves the same number the piece would have
  for (const part of extra || []) {
    if (part.id === 'all_stat_flat') for (const k of STAT_KEYS) acc.statBy[k].flat += part.value;
    // a piece carries the stat it rolled at drop; a tree line carries none, so it feeds every Core
    // attribute — the tree cannot pick one, and a stat line that did nothing would be a silent no-op
    else if (part.id === 'stat_mod_flat') {
      if (part.stat) acc.statBy[part.stat as StatKey].flat += part.value;
      else for (const k of STAT_KEYS) acc.statBy[k].flat += part.value;
    }
    else if (PCT_LINE[part.id]) acc[PCT_LINE[part.id]] += part.value;
    else if (FLAT_LINE[part.id]) acc[FLAT_LINE[part.id]] += part.value;
  }
  for (const item of gear) {
    // a Broken piece is kept but counts as nothing: unequippable, stats 0, still at its level
    if (!item || item.broken) continue;
    // the Gear Mod is the piece's own inherent line and its school comes from the Base, not from a
    // roll (`item-base.md`); a Base with no school — every weapon, belt, ring, amulet, cape,
    // off hand — has nothing for +N to raise
    const school = BASE_BY_NAME.get(item.base)?.school;
    if (item.gearMod && school && FLAT_LINE[school]) acc[FLAT_LINE[school]] += item.gearMod;
    for (const line of item.lines) {
      // a Frame Mod line carries its extra Mods on the same line (`item-base.md`), so each part
      // feeds its own bucket
      for (const part of [line, ...((line.extra as any[]) || [])]) {
        // The cap unlock belongs exclusively to passive ranks, including for imported gear.
        if (part.id === 'elemental_resistance_cap_pct') continue;
        const stat = (part as any).stat as StatKey | undefined;
        const partElement = (part as any).element || line.element;
        if (part.id === 'stat_mod_flat' && stat) acc.statBy[stat].flat += part.value;
        // a resistance line that names its Element hardens that Element alone (owner ruling)
        else if (part.id === 'elemental_resistance' && partElement) acc.resBy[partElement] = (acc.resBy[partElement] || 0) + part.value;
        else if (part.id === 'all_stat_flat') for (const k of STAT_KEYS) acc.statBy[k].flat += part.value;
        else if (PCT_LINE[part.id]) acc[PCT_LINE[part.id]] += part.value;
        else if (FLAT_LINE[part.id]) acc[FLAT_LINE[part.id]] += part.value;
      }
      // and an Elemental line also feeds its own Element's pool, the way a PoE item carries one
      // element per added-damage line (owner ruling)
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
  /** `Attack damage %`: the bucket on the attack ladder — a swing and a phys-basis press. */
  attackDamage: number;
  /** `Spell damage %`: the bucket on the spell ladder — a magic-basis press and a magic weapon's bolt. */
  spellDamage: number;
  elem: number;
  /** Elemental power per Element, from the lines that carry one. Empty when nothing does. */
  elemByElement: Record<string, number>;
  /** Per-Element conversion percent, from the conversion aura rows (`damage_conversion:<element>`). */
  conversion: Record<string, number>;
  accuracy: number;
  /** Agi plus the gear Evasion lines, as a rating — rolled against whichever mob is attacking. */
  evasion: number;
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
  /** The shield's own avoidance layer: a blocked hit is deleted outright. */
  block: number;
  /** Cut on the mob's armour ratio, from the crossbow's Frame Mod line. */
  armourPen: number;
  /** Chance to bleed on a landed hit, from the axe's Frame Mod line. */
  bleedChance: number;
  /** Chance to stun on a landed hit, Alignment × K_STUN_PER_ALIGN + the mace's line (C10). */
  stunChance: number;
  alignment: number;
  resistance: number;
  /** The resistance Cap in force on this character: the published one, plus the tree's unlock. */
  resCap: number;
  /** Vit's Stun Recovery: the share of a shock's stop it buys back (item 5 · `K_VIT_STUNREC`). */
  stunRecovery: number;
  /** Extra percentage points of resistance against one named Element (Trinity Form). */
  resByElement: Record<string, number>;
  /** A post-cap multiplier on the character's own clock — Haste, and nothing else. */
  globalSpeed: number;
  /** The multiplier a buff puts on incoming damage (Berserker takes more, Iron Will less). */
  damageTaken: number;
  /** % cut on the status proc AND crowd control (stun/stop) — the Status Alignment resistance Mod. */
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
  materials?: number;
  food?: number;
  /** The carried pieces' own weights: a kept piece rides against the capacity until worn or stashed. */
  bagWeight?: number;
}

/** Everything carried that weighs: the worn pieces, the kept pieces in the bag, and consumables (formula-utility.md §11). */
export function weightOfCarry(gear: (Item | null)[], carried: Carried = {}, heldMasteryLevel = 0): number {
  // Mastery lightens the held weapon only, up to -20% of its own weight
  const worn = gear.reduce((t, g) => t + (g?.slot === 'main hand'
    ? mastery.weaponWeight(g?.weight || 0, heldMasteryLevel)
    : (g?.weight || 0)), 0);
  return worn
    + (carried.bagWeight || 0)
    + (carried.potions || 0) * E.potions.weight
    + (carried.condensed || 0) * E.potions.condensed.weight
    + (carried.herbs || 0) * E.inventory.unit_weight.herb
    + (carried.materials || 0) * E.inventory.unit_weight.material
    + (carried.food || 0) * E.inventory.unit_weight.food;
}

/**
 * The whole character sheet, built with the shared engine and nothing else.
 * A Stat Mod feeds its stat as flat then %, the same shape `ceilStat` uses for the 816 ceiling.
 */
/** The additive / multiplicative shape `engine/skills.ts` `aggregateEffects` returns. */
export interface EffectFold {
  add: Record<string, number>;
  mult: Record<string, number>;
  /** Lines the row writes on a target rather than on us; the mob reads them, the sheet never does. */
  target?: { add: Record<string, number>; mult: Record<string, number> };
}

const m = (t: EffectFold, k: string) => t.mult[k] ?? 1;
const a = (t: EffectFold, k: string) => t.add[k] ?? 0;

/**
 * The rules a set of bought ranks carries, applied to the folded sheet.
 *
 * A keystone's drawback (D4) takes a named line away, and the removal lands after the gear and the
 * tree have both folded — so the line is gone from the whole sheet, not only from the tree's share.
 * A keystone may also raise a named Cap, and that rides the same line the sheet already reads.
 */
export function applyTreeRules(
  lines: Lines,
  rules: { kind: string; target: string; value?: number }[] = [],
): Lines {
  for (const rule of rules) {
    if (rule.kind === 'remove') {
      if (PCT_LINE[rule.target]) lines[PCT_LINE[rule.target]] = 0;
      if (FLAT_LINE[rule.target]) lines[FLAT_LINE[rule.target]] = 0;
    } else if (rule.kind === 'cap_unlock') {
      if (PCT_LINE[rule.target]) lines[PCT_LINE[rule.target]] += rule.value ?? 0;
      if (FLAT_LINE[rule.target]) lines[FLAT_LINE[rule.target]] += rule.value ?? 0;
    }
  }
  return lines;
}

/**
 * The per-Element conversion the sheet routes: the aura rows' `damage_conversion:<element>` and the
 * tree's own conversion rules, in one place.
 */
export function conversionOf(
  effects: EffectFold,
  rules: { kind: string; target: string; value?: number }[] = [],
): Record<string, number> {
  const conversion: Record<string, number> = {};
  for (const [key, v] of Object.entries(effects.add || {})) {
    if (!key.startsWith('damage_conversion:')) continue;
    const el = key.split(':')[1];
    conversion[el] = (conversion[el] || 0) + v;
  }
  for (const rule of rules) {
    if (rule.kind !== 'convert') continue;
    conversion[rule.target] = (conversion[rule.target] || 0) + (rule.value ?? 0);
  }
  return conversion;
}

export function buildCharacter(
  level: number,
  gear: (Item | null)[],
  carried: Carried = {},
  heldMasteryLevel = 0,
  effects: EffectFold = { add: {}, mult: {} },
  points?: Record<StatKey, number>,
  treeRanks?: Record<string, number>,
  life: LifeSkillBonus = {},
): Character {
  const mainHand = gear.find((g) => g && !g.broken && g.slot === 'main hand') || null;
  // the tree's own lines: the bought ranks' grants and the lines its threshold clusters have earned
  const treeLines = tree ? tree.linesOf(treeRanks, mainHand?.base || '') : [];
  const treeRules = tree ? tree.rulesOf(treeRanks) : [];
  const treeClusters = tree ? tree.clusterState(treeRanks).grants : [];
  const lines = sumLines(gear, [...treeLines, ...treeClusters]);
  // a keystone's rules land on the folded sheet: a drawback takes the line away, a Cap raise lifts it
  applyTreeRules(lines, treeRules);
  const core = {} as Record<StatKey, number>;
  // With no allocation given, fall back to the REFERENCE even-split line — the build every published
  // number and every test is measured against. The client passes the player's own `points`.
  const refPts = eng.pointsAt(level) / STAT_KEYS.length;
  for (const k of STAT_KEYS) {
    const spent = points ? (points[k] ?? 0) : refPts;
    core[k] = (eng.statOf(spent) + lines.statBy[k].flat) * (1 + lines.statBy[k].pct / 100);
  }
  // a weapon's Element is a stored line on the piece, not a property of the weapon types:
  // `equipment-weapon.md` carries no Element column, and `crafting.md` forbids locking one
  const weaponElement = mainHand ? (mainHand.lines.find((l) => l.element)?.element ?? null) : null;
  // a Herald adds flat damage of one named Element *on top of* what the gear already carries,
  // so it joins that Element's pool, lifts the total, and leaves every other pool as it was
  const herald: Record<string, number> = {};
  for (const [key, v] of Object.entries(effects.add || {})) {
    if (!key.startsWith('elemental_power:')) continue;
    const el = key.split(':')[1];
    herald[el] = (herald[el] || 0) + v;
  }
  // conversion (draft/convert-damage.md): the aura rows' `damage_conversion:<element>` fold into a
  // per-Element percent, the same `stat:element` key shape the Herald bonus reads — the swing and the
  // physical-basis press route their physical share through it, a magic-basis press never does. A
  // keystone may route the same way.
  const conversion = conversionOf(effects, treeRules);
  // the elemental pools: the engine owns the rule (DECISIONS: per Element, the flat pool plus
  // `Int x K_ELEM` for the weapon's own Element, scaled by the shared and Element-specific percents)
  const elemPower = eng.elementalPowerOf({
    intCore: core.int,
    weaponElement,
    flat: lines.elemFlat,
    pct: lines.elemPct,
    byElement: (lines.elemBy || {}) as Record<string, { flat: number; pct: number }>,
    herald,
  });
  // Trinity Form names the Elements it hardens against, so each one gets its own resistance line
  // (per-Element pools, spent on the incoming half by element)
  const resByElement: Record<string, number> = {};
  for (const [key, v] of Object.entries(effects.add || {})) {
    if (!key.startsWith('elemental_resistance:')) continue;
    resByElement[key.split(':')[1]] = (resByElement[key.split(':')[1]] || 0) + v;
  }
  // gear lines that named their Element join the same per-Element pool
  for (const [el, v] of Object.entries(lines.resBy || {})) resByElement[el] = (resByElement[el] || 0) + v;
  // The engine row gives each named type its attack tempo.
  const aspdDefault = E.build.weapon_aspd_default;
  const weaponStats = mainHand ? E.weapons.find((weapon: any) => weapon.name === mainHand.base) : null;
  const weaponAspd = mainHand
    ? (weaponStats?.weapon_aspd ?? mainHand.weaponAspd ?? aspdDefault)
    : aspdDefault;
  const used = weightOfCarry(gear, carried, heldMasteryLevel);
  const burden = eng.encumbranceOf(used, core.str);
  // the Cap is applied LAST (docs/DECISIONS.md): after the aspd Mod band inside the
  // formula, after a multiplicative aspd buff (Haste's ×1.15) and after the weight tax — so no
  // build passes 5 hits/sec, which is the clock rule the whole game is priced against
  const aspd = eng.capAspd(
    eng.aspdOf(core.agi, weaponAspd, lines.aspdPct + a(effects, 'attack_speed'))
    * m(effects, 'attack_speed') * (1 - burden));
  const critPool = eng.critPool(core.lck, lines.critPct);
  // Alignment gates the mob-side status and feeds the mace's stun chance, so it is computed once
  const alignment = eng.alignmentOf(core.dex, lines.alignPct + a(effects, 'elemental_alignment'), m(effects, 'elemental_alignment'));

  return {
    level,
    core,
    weaponName: mainHand ? mainHand.base : 'bare hand',
    weaponAspd,
    weaponElement,
    aspd,
    hitsPerSec: eng.hitsPerSec(aspd),
    phys: eng.physOf(core.str, lines.physFlat, lines.physPct + a(effects, 'physical_power'), weaponAspd, mainHand?.base)
      * m(effects, 'physical_power'),
    magic: eng.magicOf(core.int, lines.magicFlat, lines.magicPct, weaponAspd, mainHand?.base),
    attackDamage: lines.attackDamagePct,
    spellDamage: lines.spellDamagePct,
    elemByElement: elemPower.byElement,
    elem: elemPower.total,
    /** Per-Element conversion percent, from the conversion aura rows (empty when none is up). */
    conversion,
    accuracy: eng.playerAccuracy(core.dex, lines.accPct + (life.accuracy_pct || 0)),
    evasion: eng.evasionRating(core.agi, lines.evasionFlat, lines.evasionPct + (life.evasion_pct || 0)) + a(effects, 'evasion'),
    evasionChance: eng.evasionChance(
      eng.evasionRating(core.agi, lines.evasionFlat, lines.evasionPct + (life.evasion_pct || 0)) + a(effects, 'evasion'),
      eng.refAttackerAcc(level),
    ),
    armour: (eng.armourOf(core.str) + lines.armourFlat + a(effects, 'armour')) * m(effects, 'armour')
      * (1 + (lines.armourPct + (life.armour_pct || 0)) / 100),
    es: eng.maxEsOf(lines.esFlat + a(effects, 'energy_shield'), lines.esPct, core.wis),
    // ES regen is `regen_pct`% of the max pool per second; a Mod line or an `es_regen` skill/passive
    // amplifies it, both feeding the one `ampPct` argument the engine already carries.
    esRegen: eng.esRegenOf(eng.maxEsOf(lines.esFlat + a(effects, 'energy_shield'), lines.esPct, core.wis), lines.esRegenPct + a(effects, 'es_regen')),
    maxHp: eng.maxHpOf(core.vit, level, lines.hpPct, lines.hpFlat),
    // the regen lines multiply the stat's own regen — the engine already carries the % argument, so
    // a buff and a Mod line feed the same formula rather than each doing their own arithmetic
    hpRegen: eng.hpRegenOf(core.vit, lines.hpRegenPct + a(effects, 'hp_regen') + (life.hp_regen_pct || 0), lines.hpRegenFlat),
    maxMana: eng.maxManaOf(core.int, level, lines.manaPct, lines.manaFlat),
    manaRegen: eng.manaRegenOf(core.int, lines.manaRegenPct + a(effects, 'mana_regen') + (life.mana_regen_pct || 0), lines.manaRegenFlat),
    critPool,
    critChance: eng.critChanceOf(critPool),
    critDmg: eng.critDmgOf(critPool, lines.critDmgPct),
    perfectDodge: eng.perfectDodgeChance(core.lck, lines.pdodgePct),
    block: eng.blockChance(lines.blockPct),
    armourPen: lines.armourPenPct + (life.armour_pen || 0),
    bleedChance: lines.bleedChancePct,
    stunChance: eng.stunChanceFrom(alignment, lines.stunChancePct),
    alignment,
    // All Resistance lifts every Element at once, so it joins the same line the per-Element Mods feed
    // and the one Cap still binds the total — unless the tree bought the unlock, which raises that Cap
    resistance: eng.resistanceOf(lines.resPct + lines.allResPct, m(effects, 'elemental_resistance'), lines.resCapPct),
    resCap: eng.elemResCapOf(lines.resCapPct),
    stunRecovery: eng.stunRecoveryOf(core.vit),
    /** Extra resistance against one named Element, from an aura that names it. */
    resByElement,
    /** Haste's post-cap clock multiplier on cooldowns; attack speed carries its own share. */
    globalSpeed: m(effects, 'global_speed'),
    /** Berserker's leech, and the leech mark on a target pays, as a % of damage dealt. */
    leechPct: a(effects, 'leech'),
    /** What the skills currently up add to incoming damage — a buff can make you hurt more. */
    damageTaken: m(effects, 'damage_taken'),
    /**
     * Cut on the status proc AND crowd control, % (the Status Alignment resistance line). It reads
     * against the 20% per landed hit in combat.md §5 and the stun/stop those carry (§5b) — the one
     * gear answer to being debuffed or locked out, since Holy veil is a timed buff, not a line.
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

/**
 * Minute one: the whole starting set, read straight out of engine.json `opening`. The data names a frame
 * per slot (the main hand names a weapon type, which is what a drop records as its base) and the client
 * derives each piece's one line with the engine's own floor rule — the same `frameModAtFloor` a
 * pre-skeleton save restore calls — so no value is typed twice and the set cannot drift from the curve it
 * is priced against. It weighs what its frames say they weigh, or the opening character would carry a set
 * for free and the aspd tax (`formula.md` section 11) would never bite the build it exists for.
 */
export function openingGear(): (Item | null)[] {
  const gear = emptyGear();
  const ilvl = E.opening.level as number;
  const taken = new Set<number>();
  for (const g of E.opening.gear as any[]) {
    const q = loot.BAND_LABEL.indexOf(g.quality);
    const frame = BASES.bases.find((b: any) => b.name === g.base && b.slot === g.slot) || null;
    const weapon = frame ? null : BASES.weapons.find((w: any) => w.name === g.base) || null;
    if (!frame && !weapon) continue;
    // every slot is filled, and the two ring entries take the two ring slots
    const at = loot.SLOTS.findIndex((s: string, i: number) => s === g.slot && !taken.has(i));
    if (at < 0) continue;
    taken.add(at);
    gear[at] = {
      slot: g.slot,
      base: frame ? frame.name : weapon!.name,
      ilvl,
      quality: g.quality,
      tier: `T${g.tier}`,
      lines: loot.frameModAtFloor(BASES, g.slot, frame, weapon, ilvl, q),
      weight: frame ? frame.weight : weaponWeightOf(weapon!.name, 'main hand'),
    };
  }
  return gear;
}
