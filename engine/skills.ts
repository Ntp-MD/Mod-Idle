/**
 * The skill model — one home for the roster calculator.
 *
 * `tools/skills.ts --calc` and the client both read these functions, so a
 * cooldown or a per-press figure the player sees is the one the cage publishes
 * (`skill-pool.md` · `skill-pool-system.md`).
 */

/** Duplicate → ladder cooldown reduction (`skill-pool-system.md` "Duplicates → ladder"). */
export const LADDER = [
  { step: 1, cdr: 5, cost: 1 }, { step: 2, cdr: 10, cost: 1 }, { step: 3, cdr: 15, cost: 2 },
  { step: 4, cdr: 20, cost: 2 }, { step: 5, cdr: 25, cost: 3 }, { step: 6, cdr: 30, cost: 3 },
];
/** Any 2 duplicates convert into 1 of a chosen skill (`skill-pool-system.md`). */
export const CONVERSION = 2;

/** Weapon type → skill group (`skill-pool.md` "Weapon groups"). */
export const WEAPON_GROUPS = {
  melee: ['sword', 'axe', 'dagger', 'mace', 'spear', 'two-handed sword', 'two-handed axe'],
  ranged: ['bow', 'crossbow'],
  magic: ['wand', 'staff', 'book'],
};

import type { EngineData, SkillRow, SkillsData } from './types.ts';

/**
 * The two damage ladders (the PoE shape, owner ruling): `Attack damage %` scales the attack ladder —
 * a weapon's own swing and a phys-basis press — and `Spell damage %` scales the spell ladder — a
 * magic-basis press and a magic weapon's bolt. Each bucket adds only inside itself, the pair never
 * crosses, and no Core attributes change: this multiplies what the ladder already deals. A magic-basis press
 * carries its Element share inside the press, so the spell half of the pair scales it too; a swing's
 * Element pools stay outside the attack bucket, because the swing's Element is not the attack.
 */
export const ladderMult = (basis: string, attackPct = 0, spellPct = 0) =>
  1 + ((basis === 'magic' ? spellPct : attackPct) || 0) / 100;

export function createSkillModel(SKILLS: SkillsData, E: EngineData) {
  const F = (SKILLS.meta && SKILLS.meta.formula) || {};
  /**
   * The per-level table: one row per skill level, carrying the multiplier a press and an effect
   * carry at that level. It is the only home of the ramp — a row states its level-1 numbers and the
   * table says what they climb to, so "what does this skill do at level N" is a read, never a formula
   * buried in code. `special_level_effects` names the effect stats that already spend skill level
   * their own way (Energy Absorb interpolates base→cap, Ghost Dance counts a charge per N levels) and
   * must not be scaled a second time.
   */
  const LEVEL_ROWS: { level: number; damage_pct: number; effect_pct: number; buff_effect_pct?: number }[] =
    (F.skill_levels && F.skill_levels.rows) || [{ level: 1, damage_pct: 100, effect_pct: 100, buff_effect_pct: 100 }];
  const LEVEL_SPECIALS: string[] = ((F.skill_levels && F.skill_levels.special_level_effects) || []).map(String);
  const LEVEL_CAP = LEVEL_ROWS[LEVEL_ROWS.length - 1].level;
  /** The step the first two rows state — what the tables and the tests print as `LEVEL_STEP`. */
  const LEVEL_STEP = LEVEL_ROWS.length > 1 ? Math.round((LEVEL_ROWS[1].damage_pct - LEVEL_ROWS[0].damage_pct) * 100) / 100 : 0;
  const rowAt = (level?: number) => LEVEL_ROWS[Math.max(0, Math.min(LEVEL_CAP, Math.floor(level || 1)) - 1)];
  /** The multiplier a press carries at a level, in percent. */
  const damagePct = (level?: number) => rowAt(level).damage_pct;
  /** The multiplier an effect carries at a level, in percent. */
  const effectPct = (level?: number) => rowAt(level).effect_pct;
  /**
   * The multiplier a buff's or an aura's effect carries, in percent, from its own column. Both open at
   * their whole value — the number a row stores is what a fresh drop gives — and climb to a higher cap
   * than every other effect rides, so levelling a buff or an aura is worth the kills it costs. Whole
   * numbers only, so a page printing the rung reads as a percentage and never as a fraction.
   */
  const buffEffectPct = (level?: number) => rowAt(level).buff_effect_pct ?? effectPct(level);
  /**
   * A row's effects at a level. The stored `value` is the level-1 number and it climbs on the table — a
   * buff or an aura on its own column, everything else on `effect_pct`; a `special_level_effects` stat is
   * handed back untouched, because its own mechanism is the ramp.
   *
   * A multiplier climbs on its DISTANCE from 1, never on the ratio itself: ×1.15 at 180% is ×1.27, not
   * ×2.07, and a ×0.90 that shrinks incoming damage becomes ×0.82 — a stronger cut, not a bigger hit.
   * A buff's or an aura's added value is rounded to a whole number (owner rule), so a printed rung reads
   * as a percentage and never as a fraction.
   */
  function effectsAt(skill: SkillRow, level?: number) {
    const buff = skill.type === 'buff' || skill.type === 'aura';
    const scale = (buff ? buffEffectPct(level) : effectPct(level)) / 100;
    return (skill.effects || []).map((e) => {
      if (LEVEL_SPECIALS.includes(e.stat)) return { ...e };
      if (e.op === 'mult') return { ...e, value: e.value >= 1 ? 1 + (e.value - 1) * scale : 1 - (1 - e.value) * scale };
      return { ...e, value: buff ? Math.round(e.value * scale) : e.value * scale };
    });
  }
  /** The existing cost step applies to each typed Mana or HP flat price, separate from damage. */
  const COST_LEVEL_STEP = F.mana_level_step_pct != null ? F.mana_level_step_pct : 5;
  /** Kept as the existing public name for the source-data key and its readers. */
  const MANA_LEVEL_STEP = COST_LEVEL_STEP;
  /**
   * The pool the row prices were set against — the level-1 caster's own pool, derived from the same
   * terms `maxManaOf` builds it from, so it cannot drift from the pool model. It is a basis for
   * reading a cost, never a term of one: the bar buys casts, not a cheaper press.
   */
  const MANA_REF_POOL = E.level_gain.mana_base
    + E.stat.base * E.K.K_INT_MP;
  const CAST_REF = F.cast_reference || { cdr_pct: 50, ladder_pct: 30 };
  const SX = E.skill_xp;

  const byId: Record<string, SkillRow> = {};
  for (const s of SKILLS.skills) byId[s.id] = s;

  /**
   * The price is a typed number of mana units and the unit word is part of the number: `21 flat`
   * prices 21 units. The match is anchored, so a bare `21`, a missing field, or a share of the pool is
   * a parse failure rather than a zero — a cost that silently reads as 0 would make the skill free.
   * `tools/lib/roster.ts` S15 is the other half of the guard.
   */
  function manaSpec(skill: SkillRow): number | null {
    const m = String(skill.mana == null ? '' : skill.mana).match(/^(\d+(?:\.\d+)?)\s*flat(?![A-Za-z])/);
    return m ? Number(m[1]) : null;
  }

  /** Flat HP units paid from the caster's current pool; it is an alternative to, never a second cost beside, Mana. */
  function hpCostSpec(skill: SkillRow): number | null {
    const m = String(skill.hp_cost == null ? '' : skill.hp_cost).match(/^(\d+(?:\.\d+)?)\s*flat(?![A-Za-z])/);
    return m ? Number(m[1]) : null;
  }

  /**
   * What the row costs, in mana units: the typed price grown only by skill level on
   * `MANA_LEVEL_STEP`, steeper than the damage ramp so a maxed rotation costs more. The pool sets
   * nothing — a bigger bar buys more casts, never a cheaper press — so an aura that reserves a share
   * of it changes what is there to spend, never the price of the spend. The AoE premium is
   * `engine.json` `aoe.mana_mult`, charged once on a press that lands on more than one target.
   */
  function manaCostOf(skill: SkillRow, { skillLevel = 1, aoe = false }: { skillLevel?: number; aoe?: boolean } = {}) {
    const value = manaSpec(skill);
    if (value == null) throw new Error(`skill ${skill.id || '(unnamed)'} has no readable mana cost: ${JSON.stringify(skill.mana)}`);
    const aoeMult = aoe ? (E.aoe ? E.aoe.mana_mult : 1.5) : 1;
    return value * (1 + Math.max(0, skillLevel - 1) * COST_LEVEL_STEP / 100) * aoeMult;
  }

  /** HP prices use the same level ladder but remain flat pool units, not a share of Max HP. */
  function hpCostOf(skill: SkillRow, { skillLevel = 1 }: { skillLevel?: number } = {}) {
    const value = hpCostSpec(skill);
    if (value == null) throw new Error(`skill ${skill.id || '(unnamed)'} has no readable HP cost: ${JSON.stringify(skill.hp_cost)}`);
    return value * (1 + Math.max(0, skillLevel - 1) * COST_LEVEL_STEP / 100);
  }

  /** One paid resource per active row. Mana keeps its AoE premium; HP is paid as the row's flat amount. */
  function costOf(skill: SkillRow, opts: { skillLevel?: number; aoe?: boolean } = {}) {
    if (skill.mana != null && skill.hp_cost != null) throw new Error(`skill ${skill.id || '(unnamed)'} cannot charge both Mana and HP`);
    if (skill.hp_cost != null) return { resource: 'hp' as const, amount: hpCostOf(skill, opts) };
    return { resource: 'mana' as const, amount: manaCostOf(skill, opts) };
  }

  /**
   * The finished hit a press multiplies (B5): two bases only, and Element folds into the
   * magic one rather than becoming a third.
   */
  function basisOf(skill: SkillRow, { phys, magic, elem, align }: { phys?: number; magic?: number; elem?: number; align?: number }) {
    return skill.basis === 'magic' ? (magic || 0) + (elem || 0) * ((align || 0) / 100) : (phys || 0);
  }

  /**
   * press = (base_flat + (eff/100) × power + (max_hp_pct/100) × caster Max HP) × damage_pct(level)/100 × ladder bucket —
   * the HP term is optional. The PoE shape still gives the row its own flat damage at skill level 1 plus its stated share
   * of the added power line, so gear scales a row by its
   * effectiveness instead of by a percentage of the finished hit. The level multiplier is read from the
   * per-level table, so a press at any level is a read of `meta.formula.skill_levels`. The last factor is
   * the character's own damage bucket (`Attack damage %` / `Spell damage %`), chosen by the row's basis.
   */
  function perPress(skill: SkillRow, { phys, magic, elem, align, maxHp, level, attackPct, spellPct }: { phys?: number; magic?: number; elem?: number; align?: number; maxHp?: number; level?: number; attackPct?: number; spellPct?: number }) {
    if (skill.base_flat == null || skill.eff == null || skill.basis == null) return null;
    const power = basisOf(skill, { phys, magic, elem, align });
    const hpPower = ((skill.max_hp_pct || 0) / 100) * (maxHp || 0);
    return (skill.base_flat + (skill.eff / 100) * power + hpPower) * (damagePct(level) / 100) * ladderMult(skill.basis, attackPct, spellPct);
  }

  /** A phys-basis press can crit; a magic-basis one cannot (pin 1). */
  const critsOnBasis = (skill: SkillRow) => skill.basis !== 'magic';

  /** cooldown = base_cd × (1 − ladder/100) × (1 − cdr/100) — ladder always applies first. */
  function effCd(cd: number, cdrPct?: number, ladderPct?: number) {
    return cd * (1 - (cdrPct || 0) / 100) * (1 - (ladderPct || 0) / 100);
  }

  /** Ladder % off the number of duplicates poured into this skill's own ladder. */
  function ladderPct(duplicates: number) {
    let left = duplicates, pct = 0;
    for (const rung of LADDER) {
      if (left < rung.cost) break;
      left -= rung.cost; pct = rung.cdr;
    }
    return pct;
  }

  const ladderCostToStep = (step: number) => LADDER.slice(0, step).reduce((s, l) => s + l.cost, 0);
  const LADDER_MAX_DUPLICATES = ladderCostToStep(LADDER.length);

  /** XP is per kill, never per press (`engine.json` skill_xp). */
  const skillLevel = (xp: number) => Math.min(SX.level_cap, Math.floor(xp / SX.xp_per_step) + 1);
  const skillXpForLevel = (level: number) => (level - 1) * SX.xp_per_step;

  /** Resolve a weapon's group from its Base name. */
  function weaponGroupOf(weaponName: string) {
    const n = String(weaponName || '').toLowerCase();
    let best: { index: number; group: string | null } = { index: -1, group: null };
    for (const [group, types] of Object.entries(WEAPON_GROUPS)) {
      for (const t of types) {
        const i = n.indexOf(t);
        if (i >= 0 && (best.index < 0 || i < best.index)) best = { index: i, group };
      }
    }
    return best.group;
  }

  /** A matching weapon group grants +25% skill damage (`skill-pool.md`). */
  const GROUP_BONUS = 0.25;
  const groupBonus = (skill: SkillRow, weaponName: string) =>
    !skill.group || skill.group === 'all' || skill.group === weaponGroupOf(weaponName) ? 1 + GROUP_BONUS : 1;
  /**
   * The weapon a row is BOUND to, as a family token matched against the Base's own name — `axe` covers
   * both one-handed and two-handed, `sword` both swords, `bow` both bow and crossbow. Only the arrow
   * rows carry one (firing solely while a bow or a crossbow is held); every other row is open to any
   * weapon and answers only its group bonus.
   */
  function weaponFits(skill: SkillRow, weaponName: string): boolean {
    const w = (skill as any).weapon;
    return !w || String(weaponName || '').toLowerCase().includes(String(w).toLowerCase());
  }

  function weaponMatches(skill: SkillRow, weaponName: string): boolean {
    if (!weaponName || weaponName === 'bare hand') return false;
    if ((skill as any).weapon) return weaponFits(skill, weaponName);
    const group = (skill as any).group;
    return !group || group === 'all' || group === weaponGroupOf(weaponName);
  }

  function row(skill: SkillRow, opts: { cdrPct?: number; ladderPct?: number; phys?: number; magic?: number; elem?: number; align?: number; maxHp?: number; level?: number; attackPct?: number; spellPct?: number }) {
    const cdr = opts.cdrPct != null ? opts.cdrPct : CAST_REF.cdr_pct;
    const ladder = opts.ladderPct != null ? opts.ladderPct : CAST_REF.ladder_pct;
    const ec = effCd(skill.cd!, cdr, ladder);
    const pps = ec > 0 ? 1 / ec : null;
    return {
      skill,
      cd: skill.cd,
      effCd: ec,
      pressesPerSec: pps,
      damage: opts.phys != null || opts.magic != null ? perPress(skill, opts) : null,
    };
  }

  /** Aura reservations come from `reserve_tiers`; the set may not reserve the whole pool. */
  const reservePct = (tier: string) => (SKILLS.reserve_tiers[tier] || { pct: 0 }).pct;
  const RESERVATION_LIMIT = SKILLS.meta.reservation.max_pct;

  /** Loadout presets: six sets, one main, chosen by zone, cooldowns survive a Push. */
  const PRESETS = E.presets || { sets: 6, main_index: 0 };
  const presetCount = PRESETS.sets;
  const mainPreset = PRESETS.main_index;

  /**
   * Fold a set of skill rows into the numbers one character carries. `add_pct` and `add_flat`
   * both land in the additive bucket (the stat itself decides whether a number is a percent or a
   * flat value, exactly as the gear lines do), and `mult` compounds. **A line written on a target
   * never enters the character's own sheet**: it comes back in `target`, because Rimbo Form's mob
   * slow and Elemental Fury's mob res cut are bought by the aura but spent on the mob.
   * Every value here is the row's own number — `tools/lib/roster.ts` S11 fails if one of them is
   * not printed in that row's `effect` sentence. Pass `levelOf` to fold the rows at the skill levels
   * the character actually holds; without it every row folds at level 1, which is what the roster
   * gates and the tables read.
   */
  function aggregateEffects(rows?: SkillRow[], levelOf?: (row: SkillRow) => number) {
    const add: Record<string, number> = {}, mult: Record<string, number> = {}, conditional: any[] = [], targetAdd: Record<string, number> = {}, targetMult: Record<string, number> = {};
    for (const s of rows || []) {
      for (const e of levelOf ? effectsAt(s, levelOf(s)) : (s.effects || [])) {
        // an Elemental line names the Element it feeds, so the key carries it
        const key = e.element ? `${e.stat}:${e.element}` : e.stat;
        const inAdd = e.subject === 'target' ? targetAdd : add;
        const inMult = e.subject === 'target' ? targetMult : mult;
        if (e.condition) { conditional.push({ key, op: e.op, value: e.value, condition: e.condition, subject: e.subject || 'self' }); continue; }
        if (e.op === 'mult') inMult[key] = (inMult[key] || 1) * e.value;
        else {
          inAdd[key] = (inAdd[key] || 0) + e.value;
          // a Cap stated by the same sentence rides along as `<stat>~cap`
          if (e.cap != null) inAdd[`${key}~cap`] = Math.min(inAdd[`${key}~cap`] ?? Infinity, e.cap);
        }
      }
    }
    return { add, mult, conditional, target: { add: targetAdd, mult: targetMult } };
  }

  const EFFECT_STATS = ['attack_speed', 'mana_regen', 'hp_regen', 'evasion', 'armour', 'energy_shield',
    'physical_power', 'elemental_alignment', 'elemental_resistance', 'damage_taken', 'heal_per_sec', 'heal_instant',
    // the target-side set: what a curse writes on the mob it lands on
    'damage_dealt', 'accuracy', 'crit_chance',
    // what the per-Element pool and the status store made expressible
    'leech', 'elemental_power', 'burn_stacks', 'poison_stacks', 'mark_stacks', 'bleed_chance', 'stun_chance', 'poison_hold_sec',
    // conversion: a percent of the finished physical share routed into the named Element before
    // mitigation (`draft/convert-damage.md` · `convertDamageOf`)
    'damage_conversion',
    'execute_threshold_pct', 'execute_damage', 'damage_per_evasion_pct', 'resistance_pierce_pct', 'global_speed',
    // a strip of the mob's own Elemental resistance, in percentage points (B8)
    'mob_elemental_resistance_pct',
    // (B9 close-out): the magnitudes the last prose rows state
    'mob_elemental_damage_taken_pct', 'hits', 'hit_pct', 'stop_sec',
    // the trigger auras (`cast_on_crit` · `cast_on_damage_taken`): their own clock and the price they
    // put on the press they fire — the mana the trigger charges and the damage it scales
    'trigger_cd_sec', 'cast_mana_mult', 'cast_damage_mult',
    'missing_hp_pct_for_max', 'damage_at_missing_hp', 'dodge_charges', 'dodge_charges_per_levels',
    'dodge_charges_cap', 'spread_targets',
    // Earth Wall: a charge pool that BLOCKS instead of dodging — same shape as the dodge pair above,
    // one cut per charge rather than one hit deleted
    'block_charges', 'block_charges_per_levels', 'block_charges_cap',
    // Sand Storm: a lingering earth line the row itself applies (seconds and damage a second), and
    // Earth Splitter's share of the target's own maximum pool
    'dot_dps', 'dot_sec', 'max_hp_pct_damage',
    // Energy Absorb: the share of an incoming hit converted to Energy Shield, base and Cap
    'es_absorb_pct', 'es_absorb_cap'];
  const EFFECT_OPS = ['add_pct', 'add_flat', 'mult'];
  const EFFECT_SUBJECTS = ['self', 'target'];
  /**
   * The mechanic words a row may state that are not magnitudes — each one has a reader in the client,
   * and `tools/lib/roster.ts` S14 fails if a row invents a word nothing spends.
   */
  const EFFECT_RULES = ['ignores_dodge', 'every_target', 'guaranteed_status', 'bypasses_control_cap',
    'status_immunity', 'cleanses_on_cast', 'es_recharge_immediate', 'cleanses_status',
    // a press that folds its own row onto the character sheet for the row's `duration` (Reap)
    'self_window',
    // the trigger auras: the event that fires the first ready slot in the cast order
    'cast_on_crit', 'cast_on_damage_taken'];
  /** Rows whose mechanic is already carried by another column, so no number is missing. */
  const MODELLED_BY = ['targets', 'element'];
  /**
   * The lines that only take effect in a state the status store can actually write
   * (`mobStatus.ts`), so a conditional effect can never key on something nothing inflicts.
   */
  const EFFECT_CONDITIONS = ['chilled'];

  return {
    SKILLS, byId, LEVEL_STEP, CAST_REF, LADDER, CONVERSION, WEAPON_GROUPS,
    LEVEL_ROWS, LEVEL_CAP, damagePct, effectPct, buffEffectPct, effectsAt,
    COST_LEVEL_STEP, MANA_LEVEL_STEP, MANA_REF_POOL,
    aggregateEffects, EFFECT_STATS, EFFECT_OPS, EFFECT_SUBJECTS, EFFECT_CONDITIONS, EFFECT_RULES, MODELLED_BY,
    PRESETS, presetCount, mainPreset,
    LADDER_MAX_DUPLICATES, RESERVATION_LIMIT, GROUP_BONUS,
    manaSpec, manaCostOf, hpCostSpec, hpCostOf, costOf, basisOf, perPress, critsOnBasis, effCd, ladderPct, ladderCostToStep, skillLevel, skillXpForLevel,
    weaponGroupOf, groupBonus, weaponFits, weaponMatches, row, reservePct,
    all: () => SKILLS.skills,
    of: (type: string) => SKILLS.skills.filter((s) => s.type === type),
    /**
     * The attack ladder's floor: what a magic weapon's `bolt` is worth, as a share of the finished
     * hit. A caster's filler is a press on the attack clock with no mana and no cooldown, so this is
     * the number that keeps it from being a downgrade on a full swing (HugePatch §14c). It lives in
     * `engine.json` `weapon_size_mult.bolt_share_pct` now — the roster no longer states a percentage
     * of a hit, since a press is its own flat plus an effectiveness.
     */
    ladderFloorPct: () => (E.weapon_size_mult && E.weapon_size_mult.bolt_share_pct) || 100,
  };
}
