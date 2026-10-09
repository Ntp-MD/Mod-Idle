/**
 * The shared engine math — one home for every formula in ModWorld.
 *
 * Both consumers call this file and nothing else:
 *   · the cages (`tools/*.js`) compare its output against the numbers the docs publish
 *   · the game (`game/src`) runs its tick with the same functions
 *
 * It is a factory over the parsed `tools/data/engine.json`: no fs, no doc reads, no Node
 * builtins, so it runs unchanged in a browser. A formula that exists here and beside it is
 * the same defect as a number typed twice (AGENTS.md §3, Techstack.md "The one rule").
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

  // ---- core stat line: levels grant POINTS, and `statAt` is the reference even-split line 

  const REF_STATS = 7;
  /** Stat points earned by a level: `5 x (min(L,100)-1) + 2 x max(0, min(L,190)-100)`. */
  const pointsAt = (level: number) =>
    S.points_per_level * (Math.min(level, S.paragon_from - 1) - 1)
    + S.paragon_points_per_level * Math.max(0, Math.min(level, S.level_cap) - (S.paragon_from - 1));
  const treePointsAt = (level: number) => Math.max(0, Math.min(level, S.level_cap) - 1) * S.tree_points_per_level;
  /** A stat's value from the points spent into it: `base + points x point_value`. */
  const statOf = (points: number) => S.base + points * S.point_value;
  /** The REFERENCE build: a level's points split evenly over the 7 stats. Every published number
   *  (and mob_HP) is priced against THIS line, not the player's own allocation. */
  const statAt = (level: number) => statOf(pointsAt(level) / REF_STATS);
  const statWithItems = (n: number) => statAt(S.level_cap) + S.core_flat_max * n;
  const ceilStat = (items: number, split: boolean) => {
    const n = split ? items / 2 : items;
    return statAt(S.level_cap) + S.core_flat_max * n;
  };

  const CEIL = Math.round(ceilStat(S.item_slots, false) * 100) / 100;   // reference line, thirteen items on one stat
  const SPLIT = Math.round(ceilStat(S.item_slots, true) * 10) / 10;      // thirteen items split two ways
  const FORCED_SPLIT = (statAt(S.level_cap) + S.core_flat_max * S.item_slots) * 1;
  /** The ceiling the K values are actually set on: ALL points AND all items in one stat. */
  const FOCUSED_CEIL = Math.round((statOf(pointsAt(S.level_cap)) + S.core_flat_max * S.item_slots) * 100) / 100;

  // ---- derived ceilings (cages group B)

  const DERIVED: Record<string, number> = {
    phys: (CEIL * K.K_STR + M.phys_flat_main_hand) * (1 + M.phys_pct_main_hand / 100),
    hp: (LG.hp_base + CEIL * K.K_VIT_HP + LG.hp_per_level * (S.level_cap - 1)) * (1 + M.hp_pct_per_item * LG.hp_pct_mod_slots / 100),
    mana: LG.mana_base + CEIL * K.K_INT_MP + LG.mp_per_level * (S.level_cap - 1),
    mana_regen: CEIL * K.K_INT_MREGEN,
    crit: CEIL * K.K_LCK_CRIT + M.crit_pct_main_hand,
    // Elemental resistance is a gear line (owner ruling): no Core stat feeds it, so the raw row
    // is zero by construction and everything the build can hold comes off the Mod items.
    res_raw: 0,
    res_three: M.res_pct_per_item * LG.res_mod_items,
    align_raw: CEIL * K.K_DEX_ALIGN,
    align_path: CEIL * K.K_DEX_ALIGN + M.align_pct_per_item * 2,
    cdr_raw: CEIL * K.K_WIS_CDR,
    cdr_four: CEIL * K.K_WIS_CDR * (1 + (M.cdr_pct_per_item * LG.cdr_mod_items + LG.cdr_buff_pct) / 100),
    accuracy: CEIL * K.K_DEX_ACC * (1 + M.accuracy_pct / 100),
    weight: LG.weight_base + CEIL * K.K_STR_WEIGHT,
    drop_mult: 1 + CEIL * K.K_LCK_DROP,
  };
  DERIVED.pool_regen_sec = DERIVED.mana / DERIVED.mana_regen;

  // ---- the two reference builds a skill press is printed against (formula.md section 0)
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

  // ---- mob evasion: the species Dex line, not a level number (one static HP table)

  // A mob's own stat block (`mob.stat`), deliberately NOT the player's line. It is FLAT now:
  // one base the species vector multiplies, no level term, so two mobs of a level can be nothing alike.
  const MSTAT = E.mob.stat;
  const mobStat = () => MSTAT.base;
  /**
   * The mob's fixed Core stat block: the one flat base through the species vector, with no level term
   * (owner ruling — a Goblin is the same body at level 1 and at level 180; only HP, PS and XP climb).
   * Exported so a view reads the seven numbers instead of multiplying the vector a second time.
   */
  const mobStatsOf = (speciesId: string): Record<string, number> => {
    const sp = speciesById(speciesId)?.stats || {};
    return Object.fromEntries(Object.keys(sp).map((k) => [k, r2(mobStat() * sp[k])]));
  };

  // the zone's average body factor: mob_HP(L) is the zone's AVERAGE mob, so group entries divide by it
  const speciesById = (id: string): any | undefined => (E.mob.species as any[]).find((x) => x.id === id);
  /**
   * The zone cast derived from the single source (`mob.species[].zones`): every species id
   * placed in the zone, sorted. `mob.zones[].subzones[].races` is presentation only and must
   * read back equal to this list (cage X53) — runtime code reads this, never the subzones.
   */
  const racesInZone = (zoneId: number): string[] =>
    (E.mob.species as any[]).filter((sp) => (sp.zones || []).includes(zoneId)).map((sp) => sp.id).sort();
  const sizeById = (id: string): MobSize | undefined => E.mob.sizes.find((x) => x.id === id);
  const sizeOr1 = (id: string): MobSize => sizeById(id) || { id, name: id, hp: 1, ps: 1, evasion: 1 };
  const zoneBodyFactorCache = new Map<number, number>();
  function zoneBodyFactor(zoneId: number) {
    const cached = zoneBodyFactorCache.get(zoneId);
    if (cached !== undefined) return cached;
    const cast = E.mob.species.filter((sp) => sp.zones.includes(zoneId));
    let w = 0, sum = 0;
    for (const sp of cast) for (const sid of sp.sizes) {
      const weight = E.mob.spawn_weights[sid] || 0;
      if (!weight) continue;
      w += weight; sum += weight * sizeOr1(sid).hp;
    }
    const factor = w ? sum / w : 1;
    zoneBodyFactorCache.set(zoneId, factor);
    return factor;
  }

  const sizeMult = (id: string) => (id === 'elite' ? E.mob.elite.evasion : (sizeOr1(id).evasion));
  const mobEvasion = (level: number, dexMult = 1, body = 'medium') =>
    Math.min(CAP.evasion, mobStat() * dexMult * K.K_EVASION * sizeMult(body));
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
   * What a mob's own defences remove from one of our hits (B8). The mob carries an Armour line
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
   * Sunder, Elemental Fury, or a pierce on the hit itself (Nether Orb). It cannot take the line below
   * zero, so a −20 on a mob sitting at 9.5% opens it fully rather than amplifying damage.
   *
   * `element` is the Element half of the hit. A number uses the mob's headline `res`; a per-Element
   * map uses `mob.resByElement` (the race profile, X54) so a race that shrugs fire and fears cold
   * answers a fire-and-cold swing on each pool separately.
   */
  function mitigateMobHit(mob: any, nonElement: number, element: number | Record<string, number>, armourCutFraction = 0, resOffset = 0) {
    const non = nonElement * (1 - mobArmourCut(mob.armour, nonElement, armourCutFraction));
    if (typeof element === 'number') {
      const res = Math.max(0, (mob.res || 0) + resOffset);
      return non + element * (1 - mobResCut(res));
    }
    let el = 0;
    for (const [name, dmg] of Object.entries(element)) {
      const base = (mob.resByElement && mob.resByElement[name] != null) ? mob.resByElement[name] : (mob.res || 0);
      el += dmg * (1 - mobResCut(Math.max(0, base + resOffset)));
    }
    return non + el;
  }

  /**
   * Conversion (owner ruling · `draft/convert-damage.md`): take a percent of the finished PHYSICAL
   * share and route it into a named Element BEFORE mitigation, so the converted half answers
   * Elemental resistance instead of Armour. `pctByElement` is the per-Element conversion the sheet
   * folds out of the aura rows (`damage_conversion:<element>`). The summed percent is capped at the
   * whole hit — overflow is wasted, never a multiplier — and every Element's share is a percent of the
   * SAME base, so two rows cannot each take a quarter of what the first left. Returns the share that
   * stayed physical and the converted per-Element share, both still unmitigated; the caller merges the
   * converted share into its own Element pools and mitigates each half on its own line. Pure over the
   * numbers it is handed.
   */
  const convertDamageOf = (physical: number, pctByElement: Record<string, number>) => {
    const byElement: Record<string, number> = {};
    const base = physical > 0 ? physical : 0;
    let budget = 100;
    for (const [el, pct] of Object.entries(pctByElement || {})) {
      if (!(pct > 0) || !(budget > 0)) continue;
      const take = Math.min(pct, budget);
      byElement[el] = (byElement[el] || 0) + base * (take / 100);
      budget -= take;
    }
    const converted = Object.values(byElement).reduce((t, v) => t + v, 0);
    return { physical: base - converted, byElement };
  };

  // ---- Energy Shield: the caster's second pool, worn on gear rather than spent from a stat
  DERIVED.es_pool = M.energy_shield_flat_t1 * (1 + M.max_energy_shield_pct / 100);
  DERIVED.es_regen = DERIVED.es_pool * ES.regen_pct / 100;
  DERIVED.es_recover_sec = 100 / ES.regen_pct;
  DERIVED.es_cast_hp = LG.hp_base + statAt(S.level_cap) * K.K_VIT_HP + LG.hp_per_level * (S.level_cap - 1);
  DERIVED.es_share_of_hp = DERIVED.es_pool / DERIVED.es_cast_hp;

  // ---- mob curve: HP is a static published table per zone edge; the damage line divides back out of it
  // mob_HP(L) is read off mob.zones[].hp, never priced from player DPS · mob_PS(L) = typicalDPS(L) ÷ K

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
  // 91-100 sit past the spawn cap (90) and run to the published cap anchor. The table is static:
  // typical_gear_DPS(L) is read back out of it, and mob_PS(L) is derived from the same line, never
  // typed beside it (X37).
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

  // a mob accuracy is its own Dex line: stat_c x species.dex x K_DEX_ACC x accuracy tier
  const mobAcc = (Lv: number, dexMult: number, tier: number) => mobStat() * dexMult * K.K_DEX_ACC * tier;
  // A mob's own dodge is contested by the accuracy of the player attacking it, the same opposed shape X20 uses
  // for the player side. Reference attacker = a same-level player with no Dex investment.
  const refAttackerAcc = (Lv: number) => statAt(Lv) * K.K_DEX_ACC * (1 + M.accuracy_pct / 100);
  // The dodge roll itself stays a chance bounded by 100: no build and no mob can make itself
  // untouchable, which is the same rule as the Evasion Cap one line up.
  const mobDodge = (agiRate: number, Lv: number) => Math.min(100, (agiRate / (agiRate + refAttackerAcc(Lv))) * 100);
  const damageSplit = (tag: string) => E.mob.damage_split[tag];

  // ---- a mob's own damage power (owner ruling, option B): the species Base plus a Core Stat
  // bonus, read off the SAME tag that splits its hit (`damage_split`: physical → Str, magic → Int,
  // mixed → both halves). The zone mean divides it out below, so mob_PS stays the published curve
  // for the zone's AVERAGE mob and only the species actually in front of the player moves the number.
  const speciesPowerStatOf = (sp: any) => {
    const [wPhys, wMagic] = damageSplit(sp.damage);
    return K.K_MOB_PS_STAT * (wPhys * mobStat() * sp.stats.str + wMagic * mobStat() * sp.stats.int);
  };
  const speciesPowerOf = (sp: any) => sp.power_base + speciesPowerStatOf(sp);
  // The zone's average species power: the same weighted mean `zoneBodyFactor` takes for HP, so a
  // species entry divides its own power by this and the zone's mean stays exactly 1 by construction.
  const zonePowerCache = new Map<number, number>();
  function zonePowerFactor(zoneId: number) {
    const cached = zonePowerCache.get(zoneId);
    if (cached !== undefined) return cached;
    const cast = E.mob.species.filter((sp) => sp.zones.includes(zoneId));
    let w = 0, sum = 0;
    for (const sp of cast) for (const sid of sp.sizes) {
      const weight = E.mob.spawn_weights[sid] || 0;
      if (!weight) continue;
      w += weight; sum += weight * speciesPowerOf(sp);
    }
    const factor = w ? sum / w : 1;
    zonePowerCache.set(zoneId, factor);
    return factor;
  }
  /** The PS multiplier one species carries in its zone: its own power over the zone mean. */
  const speciesPsMult = (zoneId: number, speciesId: string) => {
    const sp = speciesById(speciesId);
    return sp ? speciesPowerOf(sp) / zonePowerFactor(zoneId) : 1;
  };

  // ---- race resistance: each species tilts its Vit line by Element (mob.resist_rules · X54).
  // The five multipliers average 1.00, so the published res column stays the Vit line and the
  // profile only decides which Element a build should bring against a given race.
  const speciesResMult = (sp: any, el: string) => (sp.resist ? (sp.resist[el] ?? 1) : 1);
  /** The headline res (the mean of the profile) - the number the roster's res column prints. */
  const mobResOf = (sp: any) => Math.min(CAP.elem_res, mobStat() * sp.stats.vit * K.K_MOB_RES);
  /** Per-Element res: the profile applied before the same Cap the player obeys. */
  const mobResByElementOf = (sp: any) => {
    const out: Record<string, number> = {};
    for (const el of E.elements.order) out[el] = Math.min(CAP.elem_res, mobStat() * sp.stats.vit * K.K_MOB_RES * speciesResMult(sp, el));
    return out;
  };

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
  // The Cap is a CLOCK rule (core-stats.md · formula.md): it binds the FINAL figure, so it is
  // applied LAST — after the aspd Mod band inside the parentheses, after a multiplicative aspd
  // buff, and after the weight tax — by `capAspd` at the character sheet. No build passes
  // `CAP.aspd` (~5 hits/sec), which is what makes Haste's ×1.15 clamp instead of stack past it.
  const aspdOf = (agi: number, weaponAspd: number, aspdPct = 0) =>
    weaponAspd * (100 + (agi - S.base) * K.K_AGI_ASPD + aspdPct);
  const capAspd = (aspd: number) => Math.min(CAP.aspd, aspd);
  const hitsPerSec = (aspd: number) => capAspd(aspd) / 100;

  const weaponMult = (weaponAspd: number) => 1.2 / weaponAspd;
  const physOf = (str: number, flat: number, pct: number, weaponAspd: number) => (str * K.K_STR + flat) * (1 + pct / 100) * weaponMult(weaponAspd);
  const magicOf = (int: number, flat: number, pct: number, weaponAspd: number) => (int * K.K_INT + flat) * (1 + pct / 100) * weaponMult(weaponAspd);

  // Evasion is ONE layer. The Dex rating runs the PoE entropy roll against the
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
  // a mob dodging our swing keeps its own thin opposed roll off its Agi (X24).
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
   * Block is its own avoidance layer (it overrules "one avoidance layer" for the
   * block path only; evasion keeps its Cap). It is a flat percentage the shield's Frame Mod line
   * prints, rolled last in the incoming order, OPEN-ENDED (no Cap, owner ruling). A blocked hit is
   * NOT deleted — it is cut by a flat `armour / 10` (owner ruling, provisional; applied in mobSwing).
   */
  const blockChance = (pct: number) => Math.max(0, pct || 0);   // no Cap (owner ruling)
  /**
   * Armour penetration is a cut on the mob's armour ratio, taken where that ratio is built (the
   * crossbow's Frame Mod line). It cannot take the cut below zero, so over-penetration is wasted
   * rather than a damage amplifier — the same shape `mobResCut`'s `resOffset` has.
   */
  const armourPenCut = (pct: number) => Math.min(1, Math.max(0, (pct || 0) / 100));
  /**
   * Chance to stun = the lightning line `elements.md` publishes (Alignment × K_STUN_PER_ALIGN) plus
   * the mace's `Chance to stun %` gear line. OPEN-ENDED — no Cap (owner ruling); the two sources sum.
   */
  const stunChanceFrom = (alignment: number, gearPct = 0) =>
    Math.max(0, alignment * K.K_STUN_PER_ALIGN + (gearPct || 0));   // no Cap (owner ruling)
  /**
   * Chance to bleed = the axe's `Chance to bleed %` line, plus Lacerate's published proc
   * (`K_BLEED_CHANCE`) while that curse is up. It is a probability, so it is bounded at 100%.
   */
  const bleedChanceFrom = (lacerateUp: boolean, gearPct = 0) =>
    Math.min(100, (lacerateUp ? K.K_BLEED_CHANCE * 100 : 0) + (gearPct || 0));

  const critPool = (lck: number, pct = 0) => lck * K.K_LCK_CRIT + pct;
  const critChanceOf = (pool: number) => Math.min(pool, K.K_CRIT_CAP);
  const critDmgOf = (pool: number, dmgPct = 0) => 100 + dmgPct + (pool - critChanceOf(pool)) * K.K_CRIT_OVERFLOW;

  // ---- the two published reference builds, and the TTK the loot engine is priced at 
  // The REFERENCE build is the even split the whole design is written against: every stat gets the
  // level-cap reference line plus its share of the 13 items (points / 7, items / 7). The FOCUSED
  // build puts every point AND every item in one stat. Both swing the reference weapon with no skill
  // list. `loot.ttk_per_mob_sec` in the data is `REFERENCE.ttk`: mob_HP at the anchor level divided by
  // the reference DPS times the skill multiplier, so the kill rates, the loot bands and the timeline
  // follow the build the docs actually publish instead of a retired ceiling.
  const REF_WEAPON = E.weapons.find((w) => /one-handed/.test(w.name)) || E.weapons[0];
  const buildLine = (stat: number, weaponAspd: number) => {
    const phys = physOf(stat, M.phys_flat_main_hand, M.phys_pct_main_hand, weaponAspd);
    const aspd = capAspd(aspdOf(stat, weaponAspd, M.aspd_pct));
    const pool = critPool(stat);
    const crit = critChanceOf(pool);
    const critDmg = critDmgOf(pool, M.crit_damage_mod_pct);
    const hit = hitVs(stat, MOB_EVASION_REF) / 100;
    const dps = phys * (aspd / 100) * hit * (1 + (crit / 100) * (critDmg / 100 - 1));
    return { stat, phys, aspd, crit, critDmg, hit, dps };
  };
  const REF_STAT = statAt(S.level_cap) + (S.core_flat_max * S.item_slots) / REF_STATS;
  const FOCUS_STAT = statOf(pointsAt(S.level_cap)) + S.core_flat_max * S.item_slots;
  const REF_LINE = buildLine(REF_STAT, REF_WEAPON.weapon_aspd);
  const FOCUS_LINE = buildLine(FOCUS_STAT, REF_WEAPON.weapon_aspd);
  const ANCHOR_LEVEL = 100;
  const REFERENCE = {
    weapon: REF_WEAPON.name,
    anchorLevel: ANCHOR_LEVEL,
    stat: REF_STAT,
    focusedStat: FOCUS_STAT,
    line: REF_LINE,
    focused: FOCUS_LINE,
    dpsWithSkill: REF_LINE.dps * skillF(ANCHOR_LEVEL),
    ttk: mobHpAt(ANCHOR_LEVEL) / (REF_LINE.dps * skillF(ANCHOR_LEVEL)),
    focusedTtk: mobHpAt(ANCHOR_LEVEL) / (FOCUS_LINE.dps * skillF(ANCHOR_LEVEL)),
  };


  const maxHpOf = (vit: number, level: number, pct = 0, flat = 0) => (LG.hp_base + vit * K.K_VIT_HP + LG.hp_per_level * (level - 1) + flat) * (1 + pct / 100);
  const hpRegenOf = (vit: number, pct = 0, flat = 0) => vit * K.K_VIT_REGEN * (1 + pct / 100) + flat;
  const maxManaOf = (int: number, level: number, pct = 0, flat = 0) => (LG.mana_base + int * K.K_INT_MP + LG.mp_per_level * (level - 1) + flat) * (1 + pct / 100);
  const manaRegenOf = (int: number, pct = 0, flat = 0) => int * K.K_INT_MREGEN * (1 + pct / 100) + flat;
  // Energy Shield is a gear pool (owner ruling): the Mod rows are the whole of it, and the regen is
  // `regen_pct`% of the max pool per second, which an `es_regen` skill, Mod or passive amplifies.
  const maxEsOf = (flat = 0, pct = 0) => flat * (1 + pct / 100);
  const esRegenOf = (pool: number, ampPct = 0) => pool * (ES.regen_pct / 100) * (1 + ampPct / 100);
  const cdrOf = (wis: number, pctTotal = 0) => Math.min(CAP.cdr, (wis * K.K_WIS_CDR) * (1 + pctTotal / 100));
  // the trailing multiplier is where a skill that scales the finished stat lands (Warcry's
  // "alignment and Elemental resistance x1.20"); the Cap still applies after it
  // Elemental Alignment has NO Cap (owner ruling): it is the Dex-derived status gate and Element
  // multiplier, left open-ended. The defensive `Status Alignment resistance %` is a separate Mod line.
  const alignmentOf = (dex: number, flat = 0, mult = 1) => (dex * K.K_DEX_ALIGN + flat) * mult;
  // Elemental resistance is a gear line (owner ruling): no Core stat feeds it, so the Mod rows
  // are the whole of it and the Cap is the only thing that stops it.
  const resistanceOf = (pct = 0, mult = 1) => Math.min(CAP.elem_res, pct * mult);
  /**
   * Stun Recovery (the owner's `owner/idea-gameplay.md` item 5): Vit buys back part of a shock's stop,
   * so a 1 sec stun with 50% recovery leaves half a second. `K_VIT_STUNREC` is derived from that very
   * example rather than picked — it is set so a single-stat Vit build at the ceiling lands on 50%,
   * which leaves the reference build (Vit at the level-only line) on ~12%. 100% is the natural bound:
   * recovery cannot take more than the whole duration.
   */
  const stunRecoveryOf = (vit: number) => Math.min(100, Math.max(0, vit * K.K_VIT_STUNREC));
  /** The stop a shock actually costs: the published `status.shock.stop_sec`, cut by the recovery. */
  const stunStopSec = (vit: number, stopSec: number) => stopSec * (1 - stunRecoveryOf(vit) / 100);
  const weightCapacityOf = (str: number) => LG.weight_base + str * K.K_STR_WEIGHT;

  // ---- carried weight (formula-utility.md §11): the tax is a slowdown, never a slot lock
  // encumbrance = min((used − capacity) / capacity, 0.50) · aspd ×= (1 − encumbrance)
  const encumbranceOf = (weightUsed: number, str: number) => {
    const cap = weightCapacityOf(str);
    if (cap <= 0) return CAP.weight_overload;
    return Math.min(CAP.weight_overload, Math.max(0, (weightUsed - cap) / cap));
  };
  const aspdEncumbered = (agi: number, weaponAspd: number, aspdPct: number, weightUsed: number, str: number) =>
    capAspd(aspdOf(agi, weaponAspd, aspdPct) * (1 - encumbranceOf(weightUsed, str)));
  // Item quality weighs more too: the same ×1.3 the doc applies to values (bases.json carries the
  // multiplier next to the Base weights, so it is passed in rather than repeated here).
  const weightAtQuality = (baseWeight: number, q: number, mult: number) => baseWeight * Math.pow(mult, q);

  /**
   * What a held weapon weighs: the column `equipment-weapon.md` publishes, imported into
   * `bases.json`, with the off-hand rule `mod-pool.md` states (×`dual_wield_weight_mult` of its own
   * type). The table is passed in because `engine/` holds rules, not a second copy of the data —
   * the client and the cages call this one function.
   */
  const weaponWeightOf = (bases: BasesData | undefined, name: string, slot = 'main hand') => {
    const w = (bases?.weapons || []).find((x) => String(x.name).toLowerCase() === String(name || '').toLowerCase());
    if (!w || !(w.weight > 0)) return 0;
    return slot === 'off hand' ? w.weight * (bases!.dual_wield_weight_mult ?? 1) : w.weight;
  };

  /**
   * Weapon × body class (HugePatch section 12): the shape of the fight, not a stat. Each
   * weapon carries a three-column ladder in `bases.json` — one favoured size, one disfavoured, flat
   * where the weapon has no opinion — and the sword sits at 1.00 across all three so the reference row
   * moves no zone price. A boss is not a size: it declares which column it reads (`mob.sizes.boss.
   * reads_as`, overridable per boss). The table is passed in because `engine/` holds rules, not a
   * second copy of the data.
   */
  const sizeMultOf = (ladder: Record<string, any> | undefined, weaponName: string, bodyLabel: string) => {
    const want = String(weaponName || '').toLowerCase();
    const key = Object.keys(ladder || {}).find((k) => k.toLowerCase() === want);
    const m = key ? (ladder as any)[key]?.[bodyLabel] : undefined;
    return typeof m === 'number' && m > 0 ? m : 1;
  };
  /**
   * `weapon.basic_attack` (HugePatch §14c): **a magic weapon has no swing, it has a bolt.** Read off
   * the weapon's own damage line rather than a second field, so a wand cannot be a bolt in one file
   * and a swing in another. The bolt is a press on the ATTACK clock — no mana, no cooldown — worth the
   * attack ladder's floor (`ladderFloorPct`), so a caster never idles on an empty bar and the bar can
   * carry real cooldowns instead of being padded with filler rows.
   */
  const basicAttackOf = (bases: BasesData | undefined, weaponName: string) => {
    const w = (bases?.weapons || []).find((x) => String(x.name).toLowerCase() === String(weaponName || '').toLowerCase());
    return w && (w as any).damage === 'magic' ? 'bolt' : 'swing';
  };

  /**
   * Apply that ladder to an already-mitigated hit. Only the **physical share** of the hit moves: a
   * caster's spells are not the weapon arguing with a body, so magic damage is exempt and a staff's
   * own swing is not. It lands AFTER mitigation on purpose — putting it before the armour ratio would
   * multiply the cut as well and collapse a disfavoured weapon to about a third.
   */
  const applySizeMult = (mitigated: number, physShare: number, sizeMult: number) =>
    mitigated * (1 - Math.min(1, Math.max(0, physShare)) * (1 - sizeMult));


  // ---- item level (item-level.md)
  // The band ladder is the whole rule now that Rarity is gone: a band's floor IS the band below it, so
  // `floorOf` reads the ladder instead of a floor/ceiling table, and `floorLevelOf` is the level a band
  // starts at — which is what an offline drop is limited to (save.md · loot.md section 7).
  const QUALITY_INDEX: Record<string, number> = { low: 0, mid: 1, high: 2 };
  const qualityIndexOf = (band: string) => QUALITY_INDEX[band] ?? 0;
  const spanOf = (band: string) => (E.item_level.spans || [])[qualityIndexOf(band)] || { band, from: 1, to: 1 };
  const floorOf = (band: string) => (E.item_level.spans || [])[Math.max(0, qualityIndexOf(band) - 1)]?.band || band;
  const floorLevelOf = (band: string) => spanOf(band).from;

  // ---- loot bands (loot.md §2)

  const lckOf = (band: string) => (L.bands[band].lck_level === 'ceiling' ? CEIL : statAt(L.bands[band].lck_level as number));
  const dropChance = (band: string) => L.base_drop_chance * (1 + lckOf(band) * K.K_LCK_DROP);
  const killsDerived = (band: string) => (3600 / (L.bands[band].group_mobs * L.ttk_per_mob_sec + L.group_spawn_sec)) * L.bands[band].group_mobs;

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
  // The plateau: past `plateau_from` the bar is one flat XP value, the step out of `plateau_step_at`.
  // The bar a player watches is XP, so that is where the plateau is stated — and the kills it takes at
  // those levels are derived from it, because a higher level pays more per kill.
  const plateauXp = () => { const at = X.plateau_step_at ?? S.mob_level_cap; return killsToLevel(at) * X.per_kill_mob_level * Math.min(at, S.mob_level_cap); };
  const onPlateau = (level: number) => X.plateau_from != null && level >= X.plateau_from;
  const xpToNext = (level: number) => (onPlateau(level) ? plateauXp() : killsToLevel(level) * X.per_kill_mob_level * Math.min(level, S.mob_level_cap));
  const xpPerKill = (mobLevel: number) => X.per_kill_mob_level * mobLevel;

  const BAND: Record<string, any> = {};
  for (const b of BAND_KEYS) {
    // F3 is derived from the ROUNDED F2 the doc prints, so the published table closes: kills/hr ×
    // the printed drop chance is the drops/hr to the last digit. Reading the raw chance instead let
    // a 0.05% rounding flip a kill x chance product by one and broke X5 (re-base).
    const dropPct = r1(dropChance(b) * 100);
    // kills/hr is DERIVED from the cycle (TTK per mob, the group it fields, the gap between groups),
    // never published: the design states what a kill pays, not what an hour holds (AGENTS.md — no time
    // limit, no play-length target). Every figure below is the same number it always was.
    const kph = Math.round(killsDerived(b));
    const drops = Math.round(kph * (dropPct / 100));
    BAND[b] = {
      kills_derived: kph,
      group_mobs: L.bands[b].group_mobs,
      lck: Math.round(lckOf(b)),
      lck_mult: r2(1 + lckOf(b) * K.K_LCK_DROP),
      drop_chance_pct: dropPct,
      drops_per_hr: drops,
      upgrades_per_hr: L.bands[b].upgrades_per_hr,
      junk_per_hr: drops - L.bands[b].upgrades_per_hr,
      band_kills: b === 'high_full_lck' ? 0 : undefined,
    };
  }
  // ---- the progression checkpoints, DERIVED from the XP curve (`xp.kills_anchors`)
  // One home: the curve owns how many kills a level costs, and every checkpoint is that curve's own
  // integral — a level's cost divided by what the cast of that level actually pays (an elite is worth
  // `elite_mult` and the boss clock adds its share). Nothing here is typed a second time, so a curve
  // re-shape moves the checkpoints, the bands and the town budgets together.
  const CHECKPOINT_LEVELS = [10, 30, 60, 90, 100, 120, 150, 180, 190];
  const bandOfLevel = (lv: number) => (lv <= 30 ? 'low' : lv <= 60 ? 'mid' : 'high');
  const xpMix = (kph: number) => {
    const elite = L.elite_spawn_chance;
    const bossShare = L.boss_per_hour / kph;
    return (1 - elite - bossShare) + elite * X.elite_mult + bossShare * X.boss_mult;
  };
  const CHECKPOINTS_KILLS: Record<string, number> = {};
  {
    // A checkpoint is the XP it takes to REACH that level, so it sums the steps into 1..L-1 — the step
    // out of the checkpoint itself is post-completion work and belongs to no checkpoint.
    let cum = 0;
    for (let lv = 1; lv <= S.level_cap; lv++) {
      if (CHECKPOINT_LEVELS.includes(lv)) CHECKPOINTS_KILLS[`level_${lv}`] = Math.round(cum);
      cum += (xpToNext(lv) / (X.per_kill_mob_level * Math.min(lv, S.mob_level_cap))) / xpMix(BAND[bandOfLevel(lv)].kills_derived);
    }
  }
  // a band is a COUNT of kills between two checkpoints, never a stretch of hours: how long a band
  // takes is the player's own pace (AGENTS.md — no time limit, no play-length target).
  BAND.low.band_kills = CHECKPOINTS_KILLS.level_30;
  BAND.mid.band_kills = CHECKPOINTS_KILLS.level_60 - CHECKPOINTS_KILLS.level_30;
  BAND.high.band_kills = CHECKPOINTS_KILLS.level_90 - CHECKPOINTS_KILLS.level_60;
  const PUSH_KILLS_91_100 = CHECKPOINTS_KILLS.level_100 - CHECKPOINTS_KILLS.level_90;
  // ---- a settlement's budget, DERIVED from the same curve
  // Every settlement owns one zone, a zone is ten levels, and the last one also absorbs the stretch
  // past the eighteenth zone up to the level cap — so the budgets ARE the run's slices and they sum to
  // the completion total by construction. Nothing is typed twice: a curve re-shape moves them.
  const SETTLEMENT_BUDGET_KILLS: Record<number, number> = {};
  {
    const span = (z: number): [number, number] => [10 * (z - 1) + 1, z === ZONES.length ? S.level_cap : 10 * z];
    for (const z of ZONES) {
      const [from, to] = span(z.id);
      // the slice is the cost of its own levels: the steps INTO from..to, same convention as a checkpoint
      let cum = 0;
      for (let lv = from; lv <= to; lv++) {
        if (lv - 1 < 1) continue; // level 1 is where the run starts: there is no step into it
        cum += (xpToNext(lv - 1) / (X.per_kill_mob_level * Math.min(lv - 1, S.mob_level_cap))) / xpMix(BAND[bandOfLevel(lv - 1)].kills_derived);
      }
      SETTLEMENT_BUDGET_KILLS[z.id] = Math.round(cum);
    }
  }

  const goldPerMinute = (b: string) => Math.round((BAND[b].junk_per_hr / 60) * Math.pow(10, TS.round_rate_to_decimals)) / Math.pow(10, TS.round_rate_to_decimals);
  /**
   * A town price in gold: `m` is minutes of the band's own junk income and the charge runs at the
   * band that sells it (`town.json meta.unit`). One home for the multiplication, so the town cage,
   * the wiki and the client cannot each carry their own copy of it.
   */
  const goldPrice = (m: number, b: string) => Math.round(m * goldPerMinute(b) + 1e-9);

  // Stone income per hour, by band — the same three expressions the STONE block prints for high.
  const rerollValueStonesPerHr = (band: string) => Math.round(BAND[band].junk_per_hr / C.reroll_value_stones_per_use);
  const tierStonesPerHr = (band: string) => Math.round(BAND[band].kills_derived * L.elite_spawn_chance * L.elite_tier_stones) + L.boss_per_hour * L.boss_tier_stones;
  const addStonesPerHr = (band: string) => r2(BAND[band].kills_derived * L.elite_spawn_chance * L.elite_add_stone_chance + L.boss_per_hour * L.boss_add_stones);

  // ---- the three craft stones the ladder costs but the loot table did not pay
  // crafting.md says Quality stone comes "monsters → elites → bosses by step", Repair "elite / boss
  // only" and Corrupt "boss only, rarest"; the rates live in `loot.*_stone_sources` and every hour
  // figure below is divided out of them, so the doc never holds a second copy of one.
  const QS = L.quality_stone_sources, RS = L.repair_stone_sources, CS = L.corrupt_stone_sources;
  const qualityStonesPerHr = (band: string) => r2(
    BAND[band].kills_derived * QS.monster_quality_chance! +
    BAND[band].kills_derived * L.elite_spawn_chance * QS.elite_quality_chance! +
    L.boss_per_hour * QS.boss_quality_stones!,
  );
  const repairStonesPerHr = (band: string) => r2(
    BAND[band].kills_derived * L.elite_spawn_chance * RS.elite_repair_chance! +
    L.boss_per_hour * RS.boss_repair_stones!,
  );
  const corruptStonesPerHr = (band: string) => r2(L.boss_per_hour * CS.boss_corrupt_chance!);
  // The two whole-piece stones: Polish takes the Replace stone's Boss gate and half its Elite chance,
  // Reforge is bosses only on half the Corrupt stone's chance (`loot.polish_stone_sources` / `reforge_stone_sources`).
  // Rebirth is the third: bosses only, one stone when the boss pays, on half the Reforge stone's chance again.
  const PS = L.polish_stone_sources, FS = L.reforge_stone_sources, REB = L.rebirth_stone_sources;
  const polishStonesPerHr = (band: string) => r2(
    BAND[band].kills_derived * L.elite_spawn_chance * PS.elite_polish_chance +
    L.boss_per_hour * PS.boss_polish_chance * PS.boss_polish_stones,
  );
  const reforgeStonesPerHr = (band: string) => r2(L.boss_per_hour * FS.boss_reforge_chance);
  const rebirthStonesPerHr = (band: string) => r2(L.boss_per_hour * REB.boss_rebirth_chance * REB.boss_rebirth_stones);
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
  // the two whole-piece stones: one press takes one piece, so a set is twelve presses. The per-line
  // path above (`polish_hours_full_set`, paid in Value stones) stays what it always was.
  STONE.polish_stones_per_hr = polishStonesPerHr('high');
  STONE.polish_presses_full_set = C.ascend_items_per_set;
  STONE.polish_stones_full_set = C.ascend_items_per_set * C.polish_stones_per_use;
  STONE.polish_stone_hours_full_set = r1(STONE.polish_stones_full_set / STONE.polish_stones_per_hr);
  STONE.reforge_stones_per_hr = reforgeStonesPerHr('high');
  STONE.reforge_gambles_full_set = C.ascend_items_per_set;
  STONE.reforge_hours_full_set = r1((C.ascend_items_per_set * C.reforge_stones_per_use) / STONE.reforge_stones_per_hr);
  // A Rebirth press is the whole Unbound set, so the set is what the rate buys.
  STONE.rebirth_stones_per_hr = rebirthStonesPerHr('high');
  STONE.rebirth_hours_per_press = r1(C.rebirth_stones_per_use / STONE.rebirth_stones_per_hr * 3600);

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

  // ---- the full mob roster: every legal zone × species × body entry, plus Elite and Boss

  function mobRoster() {
    const out: any[] = [];
    for (const z of ZONES) {
      const [lFrom, lTo] = z.levels;
      const edge = mobStat();
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
            ps: psEdge * size.ps / bf * speciesPsMult(z.id, sp.id), bodyFactor: bf,
            acc: mobAcc(lTo, sp.stats.dex, sp.accuracy_mult),
            ev: edge * sp.stats.dex * K.K_EVASION * size.evasion,
            armour: edge * sp.stats.str * K.K_ARMOUR,
            res: edge * sp.stats.vit * K.K_MOB_RES, resist: sp.resist,
            align: edge * sp.stats.dex * K.K_DEX_ALIGN,
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
            hpFrom: z.hp[0] * el.hp, hpTo: z.hp[1] * el.hp, ps: psEdge * el.ps * speciesPsMult(z.id, sp.id),
            acc: mobAcc(lTo, sp.stats.dex, sp.accuracy_mult),
            ev: edge * sp.stats.dex * K.K_EVASION * el.evasion,
            armour: edge * sp.stats.str * K.K_ARMOUR,
            res: edge * sp.stats.vit * K.K_MOB_RES, resist: sp.resist,
            align: edge * sp.stats.dex * K.K_DEX_ALIGN, crit: edge * sp.stats.lck * K.K_LCK_CRIT,
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
        hpFrom: z.hp[0] * bz.hp, hpTo: z.hp[1] * bz.hp, ps: psEdge * bz.ps * speciesPsMult(z.id, bs.id),
        acc: mobAcc(lTo, bs.stats.dex, bs.accuracy_mult),
        ev: edge * bs.stats.dex * K.K_EVASION * bz.evasion,
        armour: edge * bs.stats.str * K.K_ARMOUR,
        res: edge * bs.stats.vit * K.K_MOB_RES, resist: bs.resist,
        align: edge * bs.stats.dex * K.K_DEX_ALIGN, crit: edge * bs.stats.lck * K.K_LCK_CRIT,
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
    const ps = mobPsAt(lv) * size.ps / bf * speciesPsMult(zoneId, sp.id);
    return {
      speciesId: sp.id, species: sp.name, zone: zoneId, zoneName: z.name, level: lv,
      body: size.id, kind: size.name, readsAs: size.reads_as || size.id,
      innate: sp.element_bias.filter((e) => z.elements.includes(e)),
      weapon: sp.carries_weapon, damage: sp.damage, accuracy_mult: sp.accuracy_mult,
      hp, ps,
      acc: mobAcc(lv, sp.stats.dex, sp.accuracy_mult),
      evasion: mobEvasion(lv, sp.stats.dex, size.id),
      // the mob's own FLAT stat line, and the same Cap the player obeys on every percentage it carries
      armour: armourOf(mobStat() * sp.stats.str),
      res: mobResOf(sp),
      resByElement: mobResByElementOf(sp),
      resist: sp.resist,
      align: mobStat() * sp.stats.dex * K.K_DEX_ALIGN,
      dodgeRate: mobStat() * sp.stats.agi * K.K_MOB_DODGE,
      xp: xpPerKill(lv),
    };
  }

  return {
    E, S, K, M, LG, L, C, TS, ES, CAP, CURVE, X,
    BANDS, BAND_KEYS, BAND, CEIL, SPLIT, FORCED_SPLIT, FOCUSED_CEIL, DERIVED, REF, REFERENCE, WEAPONS, STONE, LCK_BOUND,
    statAt, statWithItems, ceilStat, pointsAt, treePointsAt, statOf,
    // mob curve
    mobHpAt, typicalDpsAt, mobPsAt, typicalDps, mobPs, skillF, MOB_HP_ANCHORS,
    speciesPowerOf, speciesPowerStatOf, zonePowerFactor, speciesPsMult,
    ZONES, zoneById, finalZoneId, winTarget, sizeById, speciesById, mobStat, mobStatsOf, racesInZone, zoneBodyFactor, mobEvasion, mobAcc, mobDodge, refAttackerAcc,
    speciesResMult, mobResOf, mobResByElementOf,
  evasionChance, evasionRating, agilityEvasion,
    MEAN_SPECIES_DEX, MOB_EVASION_REF, SPECIES_EVASION, sizeMult, damageSplit, mobRoster, spawnAt,
    // player lines
    aspdOf, capAspd, hitsPerSec, weaponMult, physOf, magicOf, playerAccuracy, hitVs, hitChance,
    dodgeRate, dodgeChance, perfectDodgeChance, blockChance, armourPenCut, stunChanceFrom, bleedChanceFrom,
    critPool, critChanceOf, critDmgOf,
    maxHpOf, hpRegenOf, maxManaOf, manaRegenOf, maxEsOf, esRegenOf, cdrOf,
    alignmentOf, resistanceOf, stunRecoveryOf, stunStopSec, weightCapacityOf, encumbranceOf, aspdEncumbered, weightAtQuality,
    armourOf, armourReduce, mobArmourCut, mobResCut, mitigateMobHit, convertDamageOf, agiForCap,
    weaponWeightOf, sizeMultOf, applySizeMult, basicAttackOf,
    // loot + xp
    lckOf, dropChance, killsDerived, goldPerMinute, goldPrice, killsToLevel, xpToNext, xpPerKill, CHECKPOINTS_KILLS, PUSH_KILLS_91_100, SETTLEMENT_BUDGET_KILLS,
    floorOf, qualityIndexOf, spanOf, floorLevelOf,
    rerollValueStonesPerHr, tierStonesPerHr, addStonesPerHr, qualityStonesPerHr, repairStonesPerHr, corruptStonesPerHr,
    polishStonesPerHr, reforgeStonesPerHr, rebirthStonesPerHr,
    stonesForMinutes, taskPayout,
    // formatting
    r1, r2, fmt,
  };
}

export { BANDS, BAND_KEYS, r1, r2, fmt };
