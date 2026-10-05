/**
 * The shared engine math — one home for every formula in ModWorld.
 *
 * Both consumers call this file and nothing else:
 *   · the cages (`tools/*.js`) compare its output against the numbers the docs publish
 *   · the game (`game/src`) runs its tick with the same functions
 *
 * It is a factory over the parsed `tools/data/engine.json`: no fs, no doc reads, no Node
 * builtins, so it runs unchanged in a browser. A formula that exists here and beside it is
 * the same defect as a number typed twice (AGENT.md §3, Techstack.md "The one rule").
 */

import type { BasesData, EngineData, MobSize, Rng } from './types.ts';

const BANDS = ['low', 'mid', 'high'];
const BAND_KEYS = ['low', 'mid', 'high', 'high_full_lck'];

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const fmt = (x: number, d = 0) => (d
  ? Number(x).toFixed(d)
  : Math.round(x)).toLocaleString('en-US', d ? { minimumFractionDigits: d, maximumFractionDigits: d } : undefined);

export function createEngine(E: EngineData) {
  const S = E.stat;
  const K = E.K;
  const M = E.mod_max;
  const LG = E.level_gain;
  const L = E.loot;
  const C = E.craft;
  const TS = E.town_shared;
  const ES = E.energy_shield;
  const CAP = E.caps;

  // ---- core stat line: every stat is the same Base + per-level ramp (core-stats.md)

  const statAt = (level: number) => S.base + S.per_level * (level - 1);
  // a stat fed by `n` items, each carrying one Stat Mod flat + one Stat Mod %
  const statWithItems = (n: number) => statAt(S.level_cap) + S.core_flat_max * n;
  const ceilStat = (items: number, split: boolean) => {
    const n = split ? items / 2 : items;
    return statAt(S.level_cap) + S.core_flat_max * n;
  };

  const CEIL = Math.round(ceilStat(S.item_slots, false) * 100) / 100;   // thirteen items on one stat
  const SPLIT = Math.round(ceilStat(S.item_slots, true) * 10) / 10;      // thirteen items split two ways
  const FORCED_SPLIT = (statAt(S.level_cap) + S.core_flat_max * S.item_slots) * 1; // 535

  // ---- derived ceilings (cages group B)

  const DERIVED: Record<string, number> = {
    phys: (CEIL * K.K_STR + M.phys_flat_main_hand) * (1 + M.phys_pct_main_hand / 100),
    hp: (LG.hp_base + CEIL * K.K_VIT_HP + LG.hp_per_level * (S.level_cap - 1)) * (1 + M.hp_pct_per_item * LG.hp_pct_mod_slots / 100),
    mana: LG.mana_base + CEIL * K.K_INT_MP + LG.mp_per_level * (S.level_cap - 1),
    mana_regen: CEIL * K.K_INT_MREGEN,
    crit: CEIL * K.K_LCK_CRIT + M.crit_pct_main_hand,
    res_raw: CEIL * K.K_VIT_RES,
    res_three: CEIL * K.K_VIT_RES * (1 + (M.res_pct_per_item * LG.res_mod_items) / 100),
    align_raw: CEIL * K.K_DEX_ALIGN,
    align_path: CEIL * K.K_DEX_ALIGN + M.align_pct_per_item * 2,
    cdr_raw: CEIL * K.K_WIS_CDR,
    cdr_four: CEIL * K.K_WIS_CDR * (1 + (M.cdr_pct_per_item * LG.cdr_mod_items + LG.cdr_buff_pct) / 100),
    accuracy: CEIL * K.K_DEX_ACC * (1 + M.accuracy_pct / 100),
    weight: LG.weight_base + CEIL * K.K_STR_WEIGHT,
    drop_mult: 1 + CEIL * K.K_LCK_DROP,
  };
  DERIVED.pool_regen_sec = DERIVED.mana / DERIVED.mana_regen;

  // ---- the two reference builds a skill press is printed against (formula.md section 0 · D-070)
  // The same shape the published glass row uses: 13 items in one Core stat, the other stats at
  // level-only 210, sword `weapon_mult` 1.0, and the main hand's two Mod slots spent on that build's
  // power line. `basis magic` is the magic line plus the Element line through Alignment, because a
  // press reads the finished hit rather than dipping into the stats again.
  const REF_LEVEL_ONLY = statAt(S.level_cap);
  const REF_ALIGN = REF_LEVEL_ONLY * K.K_DEX_ALIGN;
  const REF = {
    glass: { phys: DERIVED.phys, magic: REF_LEVEL_ONLY * K.K_INT, elem: REF_LEVEL_ONLY * K.K_ELEM, align: REF_ALIGN },
    caster: {
      phys: REF_LEVEL_ONLY * K.K_STR,
      magic: (CEIL * K.K_INT + M.magic_flat_main_hand) * (1 + M.magic_pct_main_hand / 100),
      elem: CEIL * K.K_ELEM,
      align: REF_ALIGN,
    },
  };

  // ---- mob evasion: the species Dex line, not a level number (D-019 · D1 step 1)

  // the zone's average body factor: mob_HP(L) is the zone's AVERAGE mob, so group entries divide by it
  const sizeById = (id: string): MobSize | undefined => E.mob.sizes.find((x) => x.id === id);
  const sizeOr1 = (id: string): MobSize => sizeById(id) || { id, name: id, hp: 1, ps: 1, evasion: 1 };
  function zoneBodyFactor(zoneId: number) {
    const cast = E.mob.species.filter((sp) => sp.zones.includes(zoneId));
    let w = 0, sum = 0;
    for (const sp of cast) for (const sid of sp.sizes) {
      const weight = E.mob.spawn_weights[sid] || 0;
      if (!weight) continue;
      w += weight; sum += weight * sizeOr1(sid).hp;
    }
    return w ? sum / w : 1;
  }

  const sizeMult = (id: string) => (id === 'elite' ? E.mob.elite.evasion : (sizeOr1(id).evasion));
  const mobEvasion = (level: number, dexMult = 1, body = 'medium') => statAt(level) * dexMult * K.K_EVASION * sizeMult(body);
  const MEAN_SPECIES_DEX = E.mob.species.reduce((t, r) => t + r.stats.dex, 0) / E.mob.species.length;
  // The reference mob is the mean species vector on a Medium body — a real average of the roster,
  // not an imaginary x1.00 lineage. It is what every published hit-chance anchor is measured against.
  const MOB_EVASION_REF = mobEvasion(S.level_cap, MEAN_SPECIES_DEX);
  const SPECIES_EVASION = E.mob.species.map((r) => ({ name: r.name, dex: r.stats.dex, evasion: mobEvasion(S.level_cap, r.stats.dex) }));

  DERIVED.mob_evasion_ref = MOB_EVASION_REF;
  DERIVED.hit_chance = DERIVED.accuracy / (DERIVED.accuracy + MOB_EVASION_REF);

  // ---- armour: Str line both sides, PoE diminishing ratio (core-stats.md · combat.md §2 step 5)

  const armourOf = (str: number) => str * K.K_ARMOUR;
  const armourReduce = (armour: number, rawPhysical: number) => armour / (armour + K.armour_divisor * rawPhysical);
  DERIVED.armour_ceil = armourOf(CEIL);

  /**
   * What a mob's own defences remove from one of our hits (D-099 · B8). The mob carries an Armour line
   * from its Str and an Elemental resistance from its Vit in `mob-roster.md`, so the two halves of our
   * hit are answered separately, exactly as the incoming order answers theirs: the non-Element part
   * (physical and spell) meets the same PoE armour ratio, and only the Element part meets resistance.
   * Chill's `armour_cut` is applied to the armour before the ratio, and a raw hit of zero takes no cut
   * so the ratio cannot divide by nothing.
   */
  const mobArmourCut = (armour: number, rawNonElement: number, cutFraction = 0) => {
    if (!(armour > 0) || !(rawNonElement > 0)) return 0;
    return armourReduce(armour * Math.max(0, 1 - cutFraction), rawNonElement);
  };
  /** Resistance is a percentage on the mob's own Vit line, held by the same Cap ours is. */
  const mobResCut = (res: number) => (res > 0 ? Math.min(CAP.elem_res, res) / 100 : 0);
  /**
   * `resOffset` is in percentage points and comes from the lines that strip a target's resistance —
   * Sunder, Elemental Fury, or a pierce on the hit itself (Void Lance). It cannot take the line below
   * zero, so a −20 on a mob sitting at 9.5% opens it fully rather than amplifying damage.
   */
  function mitigateMobHit(mob: any, nonElement: number, element: number, armourCutFraction = 0, resOffset = 0) {
    const res = Math.max(0, (mob.res || 0) + resOffset);
    return (
      nonElement * (1 - mobArmourCut(mob.armour, nonElement, armourCutFraction)) +
      element * (1 - mobResCut(res))
    );
  }

  // ---- Energy Shield: the caster's second pool (D-026)
  DERIVED.es_pool = CEIL * K.K_INT_ES;
  DERIVED.es_regen = CEIL * K.K_INT_ESREGEN;
  DERIVED.es_recover_sec = DERIVED.es_pool / DERIVED.es_regen;
  DERIVED.es_cast_hp = LG.hp_base + statAt(S.level_cap) * K.K_VIT_HP + LG.hp_per_level * (S.level_cap - 1);
  DERIVED.es_share_of_hp = DERIVED.es_pool / DERIVED.es_cast_hp;

  // ---- mob curve: HP is published per zone edge, and the damage line divides back out of it
  // mob_HP(L) = typical_gear_DPS(L) × tree(L) × skill(L)   ·   mob_PS(L) = typical_gear_DPS(L ÷ 27 (checks.md D1/D2)

  const CURVE = E.mob.curve;
  const skillF = (Lv: number) => 1 + CURVE.skill_per_level * Lv;
  const typicalDps = (hpAt: number, Lv: number) => hpAt / skillF(Lv);
  const mobPs = (hpAt: number, Lv: number) => typicalDps(hpAt, Lv) / K.mob_damage_divisor;
  const ZONES = E.mob.zones;
  const zoneById = (id: number) => ZONES.find((z) => z.id === id);

  // concept.md sets the win condition on the last zone in the list, so its id is read, never typed
  const finalZoneId = () => ZONES[ZONES.length - 1].id;

  /**
   * The completion gate as data: the final zone's boss, killed inside one spawn while never being
   * Pushed (concept.md). Its HP is the same curve `mobRoster` and the client's spawn both use, so
   * the number the player reads is the number the fight actually rolls.
   */
  function winTarget() {
    const id = finalZoneId();
    const z = zoneById(id)!;
    const boss = E.mob.bosses.find((b) => b.zone === id);
    const level = z.levels[1];
    const size = sizeOr1('boss');
    return {
      zone: id,
      zoneName: z.name,
      name: boss ? boss.name : `Zone ${id} boss`,
      level,
      hp: mobHpAt(level) * size.hp,
    };
  }

  // mob_HP(L): a mob spawns at the attacker's level clamped into its zone range, so the curve is
  // anchored at every zone edge (mob.zones[].hp) and interpolated linearly inside a zone. Levels
  // 91-100 sit past the spawn cap (90) and run to the published cap anchor. typical_gear_DPS(L) is
  // read back out of that curve, and mob_PS(L) is derived from the same line, never typed beside it
  // (checks.md D1/D2 · X37).
  const MOB_HP_ANCHORS = (() => {
    const a: { level: number; hp: number }[] = [];
    for (const z of ZONES) { a.push({ level: z.levels[0], hp: z.hp[0] }); a.push({ level: z.levels[1], hp: z.hp[1] }); }
    a.push({ level: S.level_cap, hp: CURVE.hp_at_player_level_cap });
    return a.sort((x, y) => x.level - y.level);
  })();
  function mobHpAt(Lv: number) {
    const first = MOB_HP_ANCHORS[0], last = MOB_HP_ANCHORS[MOB_HP_ANCHORS.length - 1];
    const lv = Math.min(Math.max(Lv, first.level), last.level);
    for (let i = 1; i < MOB_HP_ANCHORS.length; i++) {
      const a = MOB_HP_ANCHORS[i - 1], b = MOB_HP_ANCHORS[i];
      if (lv <= b.level) return a.hp + ((lv - a.level) / (b.level - a.level)) * (b.hp - a.hp);
    }
    return last.hp;
  }
  const typicalDpsAt = (Lv: number) => mobHpAt(Lv) / skillF(Lv);
  const mobPsAt = (Lv: number) => typicalDpsAt(Lv) / K.mob_damage_divisor;

  // a mob accuracy is its own Dex line (D-019): stat_c x species.dex x K_DEX_ACC x accuracy tier
  const mobAcc = (Lv: number, dexMult: number, tier: number) => statAt(Lv) * dexMult * K.K_DEX_ACC * tier;
  // A mob's own dodge is contested by the accuracy of the player attacking it, the same opposed shape X20 uses
  // for the player side. Reference attacker = a same-level player with no Dex investment.
  const refAttackerAcc = (Lv: number) => statAt(Lv) * K.K_DEX_ACC * (1 + M.accuracy_pct / 100);
  const mobDodge = (agiRate: number, Lv: number) => (agiRate / (agiRate + refAttackerAcc(Lv))) * 100;
  const damageSplit = (tag: string) => E.mob.damage_split[tag];

  DERIVED.zone9_boss_physical = mobPs(zoneById(9)!.hp[1], 90) * sizeOr1('boss').ps / 2;
  DERIVED.armour_vs_zone9_boss = armourReduce(DERIVED.armour_ceil, DERIVED.zone9_boss_physical);
  DERIVED.armour_vs_zone9_trash = armourReduce(DERIVED.armour_ceil, mobPs(zoneById(9)!.hp[1], 90) / 2);

  // ---- player-side combat lines (formula-offense.md · formula-defense.md · formula-utility.md)
  // Every one of these is the doc formula, and the game calls exactly these.

  // player accuracy at a given Dex. The default carries the max Accuracy % Mod, which is what
  // every published anchor assumes; the game passes the % its own items actually rolled.
  const playerAccuracy = (dex: number, accPct = M.accuracy_pct) => dex * K.K_DEX_ACC * (1 + accPct / 100);
  // the one entropy roll both sides use (PoE shape): attacker accuracy vs defender evasion
  const hitChance = (accuracy: number, evasion: number) => accuracy / (accuracy + evasion);
  const hitVs = (dex: number, evasion: number) => hitChance(playerAccuracy(dex), evasion) * 100;
  DERIVED.ref_build_hit_pct = hitVs(statAt(S.level_cap), MOB_EVASION_REF);
  DERIVED.crit_chance = Math.min(DERIVED.crit, K.K_CRIT_CAP);
  DERIVED.crit_overflow = (DERIVED.crit - DERIVED.crit_chance) * K.K_CRIT_OVERFLOW;
  DERIVED.crit_dmg = 100 + M.crit_damage_mod_pct + DERIVED.crit_overflow;
  DERIVED.pdogge_rate = CEIL * K.K_LCK_PDOGE;
  DERIVED.perfect_dodge = DERIVED.pdogge_rate / (DERIVED.pdogge_rate + K.K_PDOGE) * 100;

  // ---- weapon aspd: Agi needed to reach the Cap with the max aspd Mod

  const agiForCap = (weaponAspd: number) =>
    Math.round((CAP.aspd / weaponAspd - 100 - M.aspd_pct) / K.K_AGI_ASPD + S.base);

  const WEAPONS = E.weapons.map((w) => ({
    ...w,
    weapon_mult: r2(1.2 / w.weapon_aspd),
    agi_to_cap: agiForCap(w.weapon_aspd),
    reachable: agiForCap(w.weapon_aspd) <= CEIL,
  }));

  // aspd = weapon_aspd × (100 + (agi − Base) × K_AGI_ASPD + aspd_pct) · hits/sec = aspd / 100
  const aspdOf = (agi: number, weaponAspd: number, aspdPct = 0) =>
    Math.min(CAP.aspd, weaponAspd * (100 + (agi - S.base) * K.K_AGI_ASPD + aspdPct));
  const hitsPerSec = (aspd: number) => aspd / 100;

  const weaponMult = (weaponAspd: number) => 1.2 / weaponAspd;
  const physOf = (str: number, flat: number, pct: number, weaponAspd: number) => (str * K.K_STR + flat) * (1 + pct / 100) * weaponMult(weaponAspd);
  const magicOf = (int: number, flat: number, pct: number, weaponAspd: number) => (int * K.K_INT + flat) * (1 + pct / 100) * weaponMult(weaponAspd);

  // Evasion is ONE layer (D-112). The Dex rating runs the PoE entropy roll against the
  // attacker's accuracy; Agi then adds flat percentage points on top — 30 Agi = 1 point —
  // and the Cap 80 binds the sum, so an accurate mob still decides how much of it lands.
  const evasionChance = (rating: number, agiPoints = 0, attackerAccuracy = 1) => {
    const roll = (1 - attackerAccuracy / (attackerAccuracy + rating)) * 100;
    return Math.min(CAP.evasion, roll + agiPoints);
  };
  /** The Dex half on its own, for the sheets that print the rating rather than the chance. */
  const evasionRating = (dex: number, flat = 0, pct = 0) => (dex * K.K_EVASION + flat) * (1 + pct / 100);
  /** Agi's share, in percentage points — 30 Agi = 1 (K_AGI_EVAS = 1/30). */
  const agilityEvasion = (agi: number) => agi * K.K_AGI_EVAS;
  // a mob dodging our swing keeps its own thin opposed roll off its Agi (D-024 · X24).
  // `K_MOB_DODGE` is the mob-side K only — the player's Agi buys Evasion points above.
  const dodgeRate = (agi: number) => agi * K.K_MOB_DODGE;
  const dodgeChance = (rate: number, attackerAccuracy: number) => (rate / (rate + attackerAccuracy)) * 100;
  // perfect dodge is a ratio on the Lck line; `pct` scales that line so a Mod can lift it.
  // The Cap binds first, so the % can never push a build past `caps.perfect_dodge`.
  const perfectDodgeChance = (lck: number, pct = 0) => {
    const rate = lck * K.K_LCK_PDOGE * (1 + pct / 100);
    return Math.min(CAP.perfect_dodge, rate / (rate + K.K_PDOGE) * 100);
  };

  /**
   * Block is its own avoidance layer (D-123 · it overrules D-112's "one avoidance layer" for the
   * block path only; evasion keeps its Cap). It is a flat percentage the shield's Base Mod line
   * prints, rolled last in the incoming order, and bounded by `caps.block` — which the shield's own
   * T1 line plus the quality ladder reaches, so the Cap is a ceiling rather than a wall (X43).
   */
  const blockChance = (pct: number) => Math.min(CAP.block, Math.max(0, pct || 0));
  /**
   * Armour penetration is a cut on the mob's armour ratio, taken where that ratio is built (the
   * crossbow's Base Mod line). It cannot take the cut below zero, so over-penetration is wasted
   * rather than a damage amplifier — the same shape `mobResCut`'s `resOffset` has.
   */
  const armourPenCut = (pct: number) => Math.min(1, Math.max(0, (pct || 0) / 100));
  /**
   * Chance to stun = the lightning line `elements.md` publishes (Alignment × K_STUN_PER_ALIGN) plus
   * the mace's `Chance to stun %` gear line, held by `caps.stun` (C10). Alignment alone lands at
   * 10.5, so the Cap only binds once gear adds its points.
   */
  const stunChanceFrom = (alignment: number, gearPct = 0) =>
    Math.min(CAP.stun, alignment * K.K_STUN_PER_ALIGN + (gearPct || 0));
  /**
   * Chance to bleed = the axe's `Chance to bleed %` line, plus Lacerate's published proc
   * (`K_BLEED_CHANCE`) while that curse is up. It is a probability, so it is bounded at 100%.
   */
  const bleedChanceFrom = (lacerateUp: boolean, gearPct = 0) =>
    Math.min(100, (lacerateUp ? K.K_BLEED_CHANCE * 100 : 0) + (gearPct || 0));

  const critPool = (lck: number, pct = 0) => lck * K.K_LCK_CRIT + pct;
  const critChanceOf = (pool: number) => Math.min(pool, K.K_CRIT_CAP);
  const critDmgOf = (pool: number, dmgPct = 0) => 100 + dmgPct + (pool - critChanceOf(pool)) * K.K_CRIT_OVERFLOW;

  const maxHpOf = (vit: number, level: number, pct = 0, flat = 0) => (LG.hp_base + vit * K.K_VIT_HP + LG.hp_per_level * (level - 1) + flat) * (1 + pct / 100);
  const hpRegenOf = (vit: number, pct = 0, flat = 0) => vit * K.K_VIT_REGEN * (1 + pct / 100) + flat;
  const maxManaOf = (int: number, level: number, pct = 0, flat = 0) => (LG.mana_base + int * K.K_INT_MP + LG.mp_per_level * (level - 1) + flat) * (1 + pct / 100);
  const manaRegenOf = (int: number, pct = 0, flat = 0) => int * K.K_INT_MREGEN * (1 + pct / 100) + flat;
  const maxEsOf = (int: number, flat = 0, pct = 0) => (int * K.K_INT_ES + flat) * (1 + pct / 100);
  const esRegenOf = (int: number) => int * K.K_INT_ESREGEN;
  const cdrOf = (wis: number, pctTotal = 0) => Math.min(CAP.cdr, (wis * K.K_WIS_CDR) * (1 + pctTotal / 100));
  // the trailing multiplier is where a skill that scales the finished stat lands (Warcry's
  // "alignment and Elemental resistance x1.20"); the Cap still applies after it
  const alignmentOf = (dex: number, flat = 0, mult = 1) => Math.min(CAP.alignment, (dex * K.K_DEX_ALIGN + flat) * mult);
  const resistanceOf = (vit: number, pct = 0, mult = 1) => Math.min(CAP.elem_res, vit * K.K_VIT_RES * (1 + pct / 100) * mult);
  const weightCapacityOf = (str: number) => LG.weight_base + str * K.K_STR_WEIGHT;

  // ---- carried weight (formula-utility.md §11): the tax is a slowdown, never a slot lock
  // encumbrance = min((used − capacity) / capacity, 0.50) · aspd ×= (1 − encumbrance)
  const encumbranceOf = (weightUsed: number, str: number) => {
    const cap = weightCapacityOf(str);
    if (cap <= 0) return CAP.weight_overload;
    return Math.min(CAP.weight_overload, Math.max(0, (weightUsed - cap) / cap));
  };
  const aspdEncumbered = (agi: number, weaponAspd: number, aspdPct: number, weightUsed: number, str: number) =>
    aspdOf(agi, weaponAspd, aspdPct) * (1 - encumbranceOf(weightUsed, str));
  // Item quality weighs more too: the same ×1.3 the doc applies to values (bases.json carries the
  // multiplier next to the Base weights, so it is passed in rather than repeated here).
  const weightAtQuality = (baseWeight: number, q: number, mult: number) => baseWeight * Math.pow(mult, q);

  /**
   * What a held weapon weighs: the column `equipment-weapon.md` publishes, imported into
   * `bases.json`, with the off-hand rule `mod-pool.md` states (×`dual_wield_weight_mult` of its own
   * type). The table is passed in because `engine/` holds rules, not a second copy of the data —
   * the client and the cages call this one function (D-101 · D-108).
   */
  const weaponWeightOf = (bases: BasesData | undefined, name: string, slot = 'main hand') => {
    const w = (bases?.weapons || []).find((x) => String(x.name).toLowerCase() === String(name || '').toLowerCase());
    if (!w || !(w.weight > 0)) return 0;
    return slot === 'off hand' ? w.weight * (bases!.dual_wield_weight_mult ?? 1) : w.weight;
  };

  // ---- drop-source floor and ceiling (item-rarity.md · save.md offline rule)
  const QUALITY_INDEX: Record<string, number> = { low: 0, mid: 1, high: 2 };
  const floorOf = (band: string) => (E.rarity.floor_ceiling[band] || { floor: 'low' }).floor;
  const ceilingOf = (band: string) => (E.rarity.floor_ceiling[band] || { ceiling: 'low' }).ceiling;
  const qualityIndexOf = (band: string) => QUALITY_INDEX[band] ?? 0;

  // ---- loot bands (loot.md §2)

  const lckOf = (band: string) => (L.bands[band].lck_level === 'ceiling' ? CEIL : statAt(L.bands[band].lck_level as number));
  const dropChance = (band: string) => L.base_drop_chance * (1 + lckOf(band) * K.K_LCK_DROP);
  const killsDerived = (band: string) => (3600 / (L.bands[band].group_mobs * L.ttk_per_mob_sec + L.group_spawn_sec)) * L.bands[band].group_mobs;

  const BAND: Record<string, any> = {};
  for (const b of BAND_KEYS) {
    const drops = Math.round(L.bands[b].kills_per_hr_published * dropChance(b));
    BAND[b] = {
      kills_per_hr: L.bands[b].kills_per_hr_published,
      kills_derived: Math.round(killsDerived(b)),
      group_mobs: L.bands[b].group_mobs,
      lck: Math.round(lckOf(b)),
      lck_mult: r2(1 + lckOf(b) * K.K_LCK_DROP),
      drop_chance_pct: r1(dropChance(b) * 100),
      drops_per_hr: drops,
      upgrades_per_hr: L.bands[b].upgrades_per_hr,
      junk_per_hr: drops - L.bands[b].upgrades_per_hr,
      band_hours: b === 'high_full_lck' ? 0 : undefined,
    };
  }
  BAND.low.band_hours = L.timeline_checkpoints_hr.level_30;
  BAND.mid.band_hours = r1(L.timeline_checkpoints_hr.level_60 - L.timeline_checkpoints_hr.level_30);
  BAND.high.band_hours = r1(L.timeline_checkpoints_hr.level_90 - L.timeline_checkpoints_hr.level_60);

  const goldPerMinute = (b: string) => Math.round((BAND[b].junk_per_hr / 60) * Math.pow(10, TS.round_rate_to_decimals)) / Math.pow(10, TS.round_rate_to_decimals);

  // Stone income per hour, by band — the same three expressions the STONE block prints for high.
  const rerollValueStonesPerHr = (band: string) => Math.round(BAND[band].junk_per_hr / C.reroll_value_stones_per_use);
  const tierStonesPerHr = (band: string) => Math.round(L.bands[band].kills_per_hr_published * L.elite_spawn_chance * L.elite_tier_stones) + L.boss_per_hour * L.boss_tier_stones;
  const addStonesPerHr = (band: string) => r2(L.bands[band].kills_per_hr_published * L.elite_spawn_chance * L.elite_add_stone_chance + L.boss_per_hour * L.boss_add_stones);

  // ---- the three craft stones the ladder costs but the loot table did not pay (harness/todo.md B21 · D-100)
  // crafting.md says Quality Stone comes "monsters → elites → bosses by step", Repair "elite / boss
  // only" and Corrupt "boss only, rarest"; the rates live in `loot.*_stone_sources` and every hour
  // figure below is divided out of them, so the doc never holds a second copy of one.
  const QS = L.quality_stone_sources, RS = L.repair_stone_sources, CS = L.corrupt_stone_sources;
  const qualityStonesPerHr = (band: string) => r2(
    BAND[band].kills_per_hr * QS.monster_quality_chance! +
    BAND[band].kills_per_hr * L.elite_spawn_chance * QS.elite_quality_chance! +
    L.boss_per_hour * QS.boss_quality_stones!,
  );
  const repairStonesPerHr = (band: string) => r2(
    BAND[band].kills_per_hr * L.elite_spawn_chance * RS.elite_repair_chance! +
    L.boss_per_hour * RS.boss_repair_stones!,
  );
  const corruptStonesPerHr = (band: string) => r2(L.boss_per_hour * CS.boss_corrupt_chance!);
  /** One piece climbing +1..+15, and a set of twelve. The boss third alone is the deep grind. */
  const upgradeStonesPerPiece = C.upgrade_costs.reduce((t, n) => t + n, 0);
  const upgradeStonesFullSet = upgradeStonesPerPiece * C.ascend_items_per_set;
  const bossThirdPerSet = C.upgrade_costs.slice(C.upgrade_breaks_from - 1).reduce((t, n) => t + n, 0) * C.ascend_items_per_set;

  const STONE: Record<string, number> = {
    reroll_uses_per_hr: rerollValueStonesPerHr('high'),
    tier_stones_per_hr: tierStonesPerHr('high'),
    add_stones_per_hr: addStonesPerHr('high'),
  };
  STONE.refines_per_hr = r2(STONE.tier_stones_per_hr / C.refine_stones_per_use);
  STONE.refine_casts_full_set = Math.round(C.ascend_items_per_set * C.refine_slots_per_item * C.refine_steps);
  STONE.refine_hours_full_set = r1(STONE.refine_casts_full_set / STONE.refines_per_hr);
  STONE.polish_hours_full_set = r2(C.polish_casts_per_full_set / STONE.reroll_uses_per_hr);
  // Ascend costs 1 Add + 8 tier stones, so whichever stone is scarcer sets the pace
  STONE.ascend_per_hr = r2(Math.min(STONE.add_stones_per_hr / C.ascend_add_stones, STONE.tier_stones_per_hr / C.ascend_tier_stones));
  STONE.ascend_hours_full_set = r1(C.ascend_items_per_set / STONE.ascend_per_hr);
  STONE.add_hours_full_set = r1(C.ascend_items_per_set / STONE.add_stones_per_hr);
  STONE.tier_hours_full_set = r1((C.ascend_items_per_set * C.refine_slots_per_item * C.refine_steps * C.refine_stones_per_use) / STONE.tier_stones_per_hr);
  // the Quality ladder: the pool pays for a whole set, and the boss third alone is what an
  // endgame piece really waits on
  STONE.quality_stones_per_hr = qualityStonesPerHr('high');
  STONE.upgrade_stones_per_piece = upgradeStonesPerPiece;
  STONE.upgrade_stones_full_set = upgradeStonesFullSet;
  STONE.upgrade_hours_full_set = r1(upgradeStonesFullSet / STONE.quality_stones_per_hr);
  STONE.upgrade_boss_third_hours = r1(bossThirdPerSet / (L.boss_per_hour * QS.boss_quality_stones!));
  STONE.repair_stones_per_hr = repairStonesPerHr('high');
  STONE.corrupt_stones_per_hr = corruptStonesPerHr('high');
  STONE.corrupt_gambles_full_set = C.ascend_items_per_set;

  const LCK_BOUND = r2(BAND.high_full_lck.junk_per_hr / BAND.high.junk_per_hr);

  /** A task pays a slice of the band's own stone income (`tasks.md` "~15 min of §5 income"). */
  const stonesForMinutes = (band: string, minutes: number) => ({
    reroll_value: r2(rerollValueStonesPerHr(band) * minutes / 60),
    tier: r2(tierStonesPerHr(band) * minutes / 60),
    add: r2(addStonesPerHr(band) * minutes / 60),
  });
  // A payout is handed over by hand, so it is whole stones; the hourly rates above stay expected values.
  const taskPayout = (band: string, minutes: number) => {
    const s = stonesForMinutes(band, minutes);
    return { reroll_value: Math.round(s.reroll_value), tier: Math.round(s.tier), add: Math.round(s.add) };
  };

  // ---- XP (world.md § Levelling · the same curve tools/timeline.ts publishes)

  const X = E.xp;
  const ANCHORS = Object.keys(X.kills_anchors).map(Number).sort((a, b) => a - b);
  function killsToLevel(level: number) {
    if (X.kills_anchors[level] != null) return X.kills_anchors[level];
    for (const [a, b] of ANCHORS.slice(0, -1).map((lv, i) => [lv, ANCHORS[i + 1]])) {
      if (level > a && level < b) return X.kills_anchors[a] + (X.kills_anchors[b] - X.kills_anchors[a]) * (level - a) / (b - a);
    }
    return X.kills_anchors[ANCHORS[ANCHORS.length - 1]];
  }
  const xpToNext = (level: number) => killsToLevel(level) * X.per_kill_mob_level * Math.min(level, S.mob_level_cap);
  const xpPerKill = (mobLevel: number) => X.per_kill_mob_level * mobLevel;

  // ---- the full mob roster: every legal zone × species × body entry, plus Elite and Boss

  function mobRoster() {
    const out: any[] = [];
    for (const z of ZONES) {
      const [lFrom, lTo] = z.levels;
      const edge = statAt(lTo);
      const psEdge = mobPs(z.hp[1], lTo);
      for (const sp of E.mob.species) {
        if (!sp.zones.includes(z.id)) continue;
        const innate = sp.element_bias.filter((e) => z.elements.includes(e));
        const bf = zoneBodyFactor(z.id);
        for (const size of sp.sizes.map((sid) => sizeById(sid)!)) {
          out.push({
            id: `z${z.id}_${sp.id}_${size.id}`, zone: z.id, zoneName: z.name, levels: [lFrom, lTo],
            kind: size.name, species: sp.name, speciesId: sp.id, innate, weapon: sp.carries_weapon,
            hpFrom: z.hp[0] * size.hp / bf, hpTo: z.hp[1] * size.hp / bf,
            ps: psEdge * size.ps / bf, bodyFactor: bf,
            acc: mobAcc(lTo, sp.stats.dex, sp.accuracy_mult),
            ev: edge * sp.stats.dex * K.K_EVASION * size.evasion,
            armour: edge * sp.stats.str * K.K_ARMOUR,
            res: edge * sp.stats.vit * K.K_VIT_RES,
            align: Math.min(CAP.alignment, edge * sp.stats.dex * K.K_DEX_ALIGN),
            crit: edge * sp.stats.lck * K.K_LCK_CRIT,
            dodge: mobDodge(edge * sp.stats.agi * K.K_MOB_DODGE, lTo),
            damage: sp.damage,
            xpFrom: X.per_kill_mob_level * lFrom, xpTo: X.per_kill_mob_level * lTo,
            group: size.id === 'small' || size.id === 'medium' ? z.group : 'alone',
          });
        }
        if (sp.sizes.includes('large')) {
          const el = E.mob.elite;
          out.push({
            id: `z${z.id}_${sp.id}_elite`, zone: z.id, zoneName: z.name, levels: [lFrom, lTo],
            kind: el.name, species: sp.name, speciesId: sp.id, innate, weapon: sp.carries_weapon,
            hpFrom: z.hp[0] * el.hp, hpTo: z.hp[1] * el.hp, ps: psEdge * el.ps,
            acc: mobAcc(lTo, sp.stats.dex, sp.accuracy_mult),
            ev: edge * sp.stats.dex * K.K_EVASION * el.evasion,
            armour: edge * sp.stats.str * K.K_ARMOUR,
            res: edge * sp.stats.vit * K.K_VIT_RES,
            align: Math.min(CAP.alignment, edge * sp.stats.dex * K.K_DEX_ALIGN), crit: edge * sp.stats.lck * K.K_LCK_CRIT,
            dodge: mobDodge(edge * sp.stats.agi * K.K_MOB_DODGE, lTo),
            damage: sp.damage,
            xpFrom: X.per_kill_mob_level * lFrom * X.elite_mult, xpTo: X.per_kill_mob_level * lTo * X.elite_mult, group: 'alone',
          });
        }
      }
      const boss = E.mob.bosses.find((b) => b.zone === z.id)!;
      const bs = E.mob.species.find((r) => r.id === boss.species)!;
      const bz = sizeById('boss')!;
      out.push({
        id: `z${z.id}_boss`, zone: z.id, zoneName: z.name, levels: [lFrom, lTo],
        kind: `${bz.name} · ${boss.name}`, species: bs.name, speciesId: bs.id,
        innate: bs.element_bias.filter((e) => z.elements.includes(e)), weapon: bs.carries_weapon,
        hpFrom: z.hp[0] * bz.hp, hpTo: z.hp[1] * bz.hp, ps: psEdge * bz.ps,
        acc: mobAcc(lTo, bs.stats.dex, bs.accuracy_mult),
        ev: edge * bs.stats.dex * K.K_EVASION * bz.evasion,
        armour: edge * bs.stats.str * K.K_ARMOUR,
        res: edge * bs.stats.vit * K.K_VIT_RES,
        align: Math.min(CAP.alignment, edge * bs.stats.dex * K.K_DEX_ALIGN), crit: edge * bs.stats.lck * K.K_LCK_CRIT,
        dodge: mobDodge(edge * bs.stats.agi * K.K_MOB_DODGE, lTo),
        damage: bs.damage,
        xpFrom: X.per_kill_mob_level * lFrom * X.boss_mult, xpTo: X.per_kill_mob_level * lTo * X.boss_mult, group: 'alone',
      });
    }
    return out;
  }

  // ---- the mob that actually spawns: a mob is at the attacker's level, clamped to its zone
  // (engine.json mob.level_rule), so a spawn is a roster entry resolved at one level.

  function spawnAt(zoneId: number, level: number, bodyId = 'medium', speciesId: string | null = null) {
    const z = zoneById(zoneId)!;
    const lv = Math.min(Math.max(level, z.levels[0]), z.levels[1]);
    const candidates = E.mob.species.filter((sp) => sp.zones.includes(zoneId) && (!speciesId || sp.id === speciesId));
    const sp = candidates.length
      ? candidates[Math.min(candidates.length - 1, speciesId ? 0 : 0)]
      : E.mob.species[0];
    const size = sizeById(bodyId) || sizeById('medium')!;
    const bf = zoneBodyFactor(zoneId);
    const hp = mobHpAt(lv) * size.hp / bf;
    const ps = mobPsAt(lv) * size.ps / bf;
    return {
      speciesId: sp.id, species: sp.name, zone: zoneId, zoneName: z.name, level: lv,
      body: size.id, kind: size.name, innate: sp.element_bias.filter((e) => z.elements.includes(e)),
      weapon: sp.carries_weapon, damage: sp.damage, accuracy_mult: sp.accuracy_mult,
      hp, ps,
      acc: mobAcc(lv, sp.stats.dex, sp.accuracy_mult),
      evasion: mobEvasion(lv, sp.stats.dex, size.id),
      armour: armourOf(statAt(lv) * sp.stats.str),
      res: statAt(lv) * sp.stats.vit * K.K_VIT_RES,
      dodgeRate: statAt(lv) * sp.stats.agi * K.K_MOB_DODGE,
      xp: xpPerKill(lv),
    };
  }

  return {
    E, S, K, M, LG, L, C, TS, ES, CAP, CURVE, X,
    BANDS, BAND_KEYS, BAND, CEIL, SPLIT, FORCED_SPLIT, DERIVED, REF, WEAPONS, STONE, LCK_BOUND,
    statAt, statWithItems, ceilStat,
    // mob curve
    mobHpAt, typicalDpsAt, mobPsAt, typicalDps, mobPs, skillF, MOB_HP_ANCHORS,
    ZONES, zoneById, finalZoneId, winTarget, sizeById, zoneBodyFactor, mobEvasion, mobAcc, mobDodge, refAttackerAcc,
  evasionChance, evasionRating, agilityEvasion,
    MEAN_SPECIES_DEX, MOB_EVASION_REF, SPECIES_EVASION, sizeMult, damageSplit, mobRoster, spawnAt,
    // player lines
    aspdOf, hitsPerSec, weaponMult, physOf, magicOf, playerAccuracy, hitVs, hitChance,
    dodgeRate, dodgeChance, perfectDodgeChance, blockChance, armourPenCut, stunChanceFrom, bleedChanceFrom,
    critPool, critChanceOf, critDmgOf,
    maxHpOf, hpRegenOf, maxManaOf, manaRegenOf, maxEsOf, esRegenOf, cdrOf,
    alignmentOf, resistanceOf, weightCapacityOf, encumbranceOf, aspdEncumbered, weightAtQuality,
    armourOf, armourReduce, mobArmourCut, mobResCut, mitigateMobHit, agiForCap,
    weaponWeightOf,
    // loot + xp
    lckOf, dropChance, killsDerived, goldPerMinute, killsToLevel, xpToNext, xpPerKill,
    floorOf, ceilingOf, qualityIndexOf,
    rerollValueStonesPerHr, tierStonesPerHr, addStonesPerHr, qualityStonesPerHr, repairStonesPerHr, corruptStonesPerHr,
    stonesForMinutes, taskPayout,
    // formatting
    r1, r2, fmt,
  };
}

export { BANDS, BAND_KEYS, r1, r2, fmt };
