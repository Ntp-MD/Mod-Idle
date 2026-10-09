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

/** Weapon type → skill group (`skill-pool.md` "Weapon groups", following equipment-weapon.md). */
export const WEAPON_GROUPS = {
  melee: ['sword', 'axe', 'dagger', 'mace', 'spear', 'two-handed sword', 'two-handed axe'],
  ranged: ['bow', 'crossbow'],
  magic: ['wand', 'staff', 'book'],
};

import type { EngineData, SkillRow, SkillsData } from './types.ts';

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
  const LEVEL_ROWS: { level: number; damage_pct: number; effect_pct: number }[] =
    (F.skill_levels && F.skill_levels.rows) || [{ level: 1, damage_pct: 100, effect_pct: 100 }];
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
   * A row's effects at a level. The stored `value` is the level-1 number and it climbs on the table;
   * a `special_level_effects` stat is handed back untouched, because its own mechanism is the ramp.
   */
  function effectsAt(skill: SkillRow, level?: number) {
    const scale = effectPct(level) / 100;
    return (skill.effects || []).map((e) => (LEVEL_SPECIALS.includes(e.stat) ? { ...e } : { ...e, value: e.value * scale }));
  }
  /** A flat mana cost climbs on its own step, steeper than the damage ramp. */
  const MANA_LEVEL_STEP = F.mana_level_step_pct != null ? F.mana_level_step_pct : 5;
  /** How much of the pool's growth a flat cost takes on, so Int and Max Mana gear still price it. */
  const MANA_POOL_EXPONENT = F.mana_pool_exponent != null ? F.mana_pool_exponent : 0.5;
  /**
   * The pool a flat cost is quoted against — the level-1 caster's own pool, derived from the same
   * terms `maxManaOf` builds it from, so it cannot drift from the pool model.
   */
  const MANA_REF_POOL = E.level_gain.mana_base
    + E.stat.base * E.K.K_INT_MP;
  const MANA_REF_LEVEL = F.mana_reference_level != null ? F.mana_reference_level : 1;
  const CAST_REF = F.cast_reference || { cdr_pct: 50, ladder_pct: 30 };
  const SX = E.skill_xp;

  const byId: Record<string, SkillRow> = {};
  for (const s of SKILLS.skills) byId[s.id] = s;

  /** A mana cost in either of its two forms: `10% (AoE ×1.5)` → pct 10 · `14 flat` → flat 14. */
  const MANA_UNITS = { pct: '%', flat: 'flat' } as const;
  type ManaKind = keyof typeof MANA_UNITS;

  /**
   * The unit is part of the number and the match is anchored, so a bare `14` or a missing field is
   * a parse failure rather than a zero — a cost that silently reads as 0 would make the skill free
   *. `tools/lib/roster.ts` S15 is the other half of the guard.
   */
  function manaSpec(skill: SkillRow): { kind: ManaKind; value: number } | null {
    const m = String(skill.mana == null ? '' : skill.mana).match(/^(\d+(?:\.\d+)?)\s*(%|flat)(?![A-Za-z])/);
    if (!m) return null;
    return { kind: (m[2] === '%' ? 'pct' : 'flat') as ManaKind, value: Number(m[1]) };
  }

  /**
   * What the row costs right now, in absolute pool units. A percentage charges the usable pool and
   * is unchanged from before; a flat row charges its own units, grown by skill level on
   * `MANA_LEVEL_STEP` and by the pool's growth on `MANA_POOL_EXPONENT`, so Int and Max Mana gear
   * raise the price instead of only widening the bar. Auras reserve a share of the pool but never
   * discount a cost, so the pool-growth term reads `maxMana`, not `usableMana`.
   */
  function manaCostOf(
    skill: SkillRow,
    { skillLevel = 1, maxMana, usableMana, aoe = false }:
      { skillLevel?: number; maxMana: number; usableMana?: number; aoe?: boolean },
  ) {
    const spec = manaSpec(skill);
    if (!spec) throw new Error(`skill ${skill.id || '(unnamed)'} has no readable mana cost: ${JSON.stringify(skill.mana)}`);
    const aoeMult = aoe ? (E.aoe ? E.aoe.mana_mult : 1.5) : 1;
    if (spec.kind === 'pct') {
      const base = usableMana != null ? usableMana : maxMana;
      return (base * spec.value / 100) * aoeMult;
    }
    const byLevel = 1 + Math.max(0, skillLevel - 1) * MANA_LEVEL_STEP / 100;
    const byPool = Math.pow(maxMana / MANA_REF_POOL, MANA_POOL_EXPONENT);
    return spec.value * byLevel * byPool * aoeMult;
  }

  /**
   * The finished hit a press multiplies (B5): two bases only, and Element folds into the
   * magic one rather than becoming a third.
   */
  function basisOf(skill: SkillRow, { phys, magic, elem, align }: { phys?: number; magic?: number; elem?: number; align?: number }) {
    return skill.basis === 'magic' ? (magic || 0) + (elem || 0) * ((align || 0) / 100) : (phys || 0);
  }

  /**
   * press = (base_flat + (eff/100) × power) × damage_pct(level)/100 — the PoE shape: the row's own flat
   * damage at skill level 1 plus its stated share of the added power line, so gear scales a row by its
   * effectiveness instead of by a percentage of the finished hit. The level multiplier is read from the
   * per-level table, so a press at any level is a read of `meta.formula.skill_levels`.
   */
  function perPress(skill: SkillRow, { phys, magic, elem, align, level }: { phys?: number; magic?: number; elem?: number; align?: number; level?: number }) {
    if (skill.base_flat == null || skill.eff == null || skill.basis == null) return null;
    const power = basisOf(skill, { phys, magic, elem, align });
    return (skill.base_flat + (skill.eff / 100) * power) * (damagePct(level) / 100);
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

  /**
   * Weapon type → skill group (`skill-pool.md` "Weapon groups", following equipment-weapon.md).
   * `engine.json` `weapons` rows merge several weapon types onto one tempo (a staff and a spear
   * share an aspd band), so a rolled Base name can name more than one group. The first type named
   * in the Base governs the group — the merged row is an aspd band, not a weapon type.
   */
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

  /** Held-weapon Mastery: +0.5% skill damage per level from L5, max +8% (`equipment-weapon.md`). */
  const masteryBonus = (masteryLevel: number) =>
    1 + Math.min(8, Math.max(0, masteryLevel >= 5 ? (masteryLevel - 4) * 0.5 : 0)) / 100;

  function row(skill: SkillRow, opts: { cdrPct?: number; ladderPct?: number; phys?: number; magic?: number; elem?: number; align?: number; level?: number }) {
    const cdr = opts.cdrPct != null ? opts.cdrPct : CAST_REF.cdr_pct;
    const ladder = opts.ladderPct != null ? opts.ladderPct : CAST_REF.ladder_pct;
    const ec = effCd(skill.cd!, cdr, ladder);
    const pps = ec > 0 ? 1 / ec : null;
    const ms = manaSpec(skill);
    const mp = ms && ms.kind === 'pct' ? ms.value : null;
    return {
      skill,
      cd: skill.cd,
      effCd: ec,
      pressesPerSec: pps,
      manaKind: ms ? ms.kind : null,
      manaValue: ms ? ms.value : null,
      manaPct: mp,
      manaPerSecPct: pps != null && mp != null ? pps * mp : null,
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
    'leech', 'elemental_power', 'burn_stacks', 'poison_stacks', 'mark_stacks', 'bleed_chance', 'poison_hold_sec',
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
    LEVEL_ROWS, LEVEL_CAP, damagePct, effectPct, effectsAt,
    MANA_LEVEL_STEP, MANA_POOL_EXPONENT, MANA_REF_POOL, MANA_REF_LEVEL, MANA_UNITS,
    aggregateEffects, EFFECT_STATS, EFFECT_OPS, EFFECT_SUBJECTS, EFFECT_CONDITIONS, EFFECT_RULES, MODELLED_BY,
    PRESETS, presetCount, mainPreset,
    LADDER_MAX_DUPLICATES, RESERVATION_LIMIT, GROUP_BONUS,
    manaSpec, manaCostOf, basisOf, perPress, critsOnBasis, effCd, ladderPct, ladderCostToStep, skillLevel, skillXpForLevel,
    weaponGroupOf, groupBonus, masteryBonus, row, reservePct,
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
