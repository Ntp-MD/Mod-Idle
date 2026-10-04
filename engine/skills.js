/**
 * The skill model — one home for the roster calculator.
 *
 * `tools/skills.js --calc`, `tools/report.js` and the client all read these functions, so a
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
  magic: ['rod', 'wand', 'staff', 'book'],
};

export function createSkillModel(SKILLS, E) {
  const F = (SKILLS.meta && SKILLS.meta.formula) || {};
  const LEVEL_STEP = F.level_step_pct != null ? F.level_step_pct : 1.5;
  const CAST_REF = F.cast_reference || { cdr_pct: 50, ladder_pct: 30 };
  const SX = E.skill_xp;

  const byId = {};
  for (const s of SKILLS.skills) byId[s.id] = s;

  /** "10% (AoE ×1.5)" → 10. */
  function manaPct(skill) {
    const m = String(skill.mana || '').match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? Number(m[1]) : null;
  }

  /**
   * The finished hit a press multiplies (D-070 · B5): two bases only, and Element folds into the
   * magic one rather than becoming a third.
   */
  function basisOf(skill, { phys, magic, elem, align }) {
    return skill.basis === 'magic' ? (magic || 0) + (elem || 0) * ((align || 0) / 100) : (phys || 0);
  }

  /**
   * press = final_pct × basis(built from the caller's own lines) × (1 + (skill_level − 1) × 1.5%).
   * `final_pct` is the level-1 fraction the row states, so a fresh skill presses exactly what its
   * row says and the level ramp is the only growth (D-070: K_SKILL and the stat/power split are gone).
   */
  function perPress(skill, { phys, magic, elem, align, level }) {
    if (skill.final_pct == null || skill.basis == null) return null;
    const basis = basisOf(skill, { phys, magic, elem, align });
    return (skill.final_pct / 100) * basis * (1 + Math.max(0, (level || 1) - 1) * LEVEL_STEP / 100);
  }

  /** A phys-basis press can crit; a magic-basis one cannot (D-070 pin 1). */
  const critsOnBasis = (skill) => skill.basis !== 'magic';

  /** cooldown = base_cd × (1 − ladder/100) × (1 − cdr/100) — ladder always applies first. */
  function effCd(cd, cdrPct, ladderPct) {
    return cd * (1 - (cdrPct || 0) / 100) * (1 - (ladderPct || 0) / 100);
  }

  /** Ladder % off the number of duplicates poured into this skill's own ladder. */
  function ladderPct(duplicates) {
    let left = duplicates, pct = 0;
    for (const rung of LADDER) {
      if (left < rung.cost) break;
      left -= rung.cost; pct = rung.cdr;
    }
    return pct;
  }

  const ladderCostToStep = (step) => LADDER.slice(0, step).reduce((s, l) => s + l.cost, 0);
  const LADDER_MAX_DUPLICATES = ladderCostToStep(LADDER.length);

  /** XP is per kill, never per press (`engine.json` skill_xp). */
  const skillLevel = (xp) => Math.min(SX.level_cap, Math.floor(xp / SX.xp_per_step) + 1);
  const skillXpForLevel = (level) => (level - 1) * SX.xp_per_step;

  /**
   * Weapon type → skill group (`skill-pool.md` "Weapon groups", following equipment-weapon.md).
   * `engine.json` `weapons` rows merge several weapon types onto one tempo (a staff and a spear
   * share an aspd band), so a rolled Base name can name more than one group. The first type named
   * in the Base governs the group — the merged row is an aspd band, not a weapon type.
   */
  function weaponGroupOf(weaponName) {
    const n = String(weaponName || '').toLowerCase();
    let best = { index: -1, group: null };
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
  const groupBonus = (skill, weaponName) =>
    !skill.group || skill.group === 'all' || skill.group === weaponGroupOf(weaponName) ? 1 + GROUP_BONUS : 1;

  /** Held-weapon Mastery: +0.5% skill damage per level from L5, max +8% (`equipment-weapon.md`). */
  const masteryBonus = (masteryLevel) =>
    1 + Math.min(8, Math.max(0, masteryLevel >= 5 ? (masteryLevel - 4) * 0.5 : 0)) / 100;

  function row(skill, opts) {
    const cdr = opts.cdrPct != null ? opts.cdrPct : CAST_REF.cdr_pct;
    const ladder = opts.ladderPct != null ? opts.ladderPct : CAST_REF.ladder_pct;
    const ec = effCd(skill.cd, cdr, ladder);
    const pps = ec > 0 ? 1 / ec : null;
    const mp = manaPct(skill);
    return {
      skill,
      cd: skill.cd,
      effCd: ec,
      pressesPerSec: pps,
      manaPct: mp,
      manaPerSecPct: pps != null && mp != null ? pps * mp : null,
      damage: opts.phys != null || opts.magic != null ? perPress(skill, opts) : null,
    };
  }

  /** Aura reservations come from `reserve_tiers`; the set may not reserve the whole pool. */
  const reservePct = (tier) => (SKILLS.reserve_tiers[tier] || { pct: 0 }).pct;
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
   * Every value here is the row's own number — `tools/lib/roster.js` S11 fails if one of them is
   * not printed in that row's `effect` sentence.
   */
  function aggregateEffects(rows) {
    const add = {}, mult = {}, conditional = [], targetAdd = {}, targetMult = {};
    for (const s of rows || []) {
      for (const e of s.effects || []) {
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
    // what the per-Element pool (D-090) and the status store (D-094) made expressible
    'leech', 'elemental_power', 'burn_stacks', 'poison_stacks', 'bleed_chance', 'poison_hold_sec',
    'execute_threshold_pct', 'execute_damage', 'damage_per_dodge_pct', 'resistance_pierce_pct', 'global_speed',
    // a strip of the mob's own Elemental resistance, in percentage points (B8 · D-099)
    'mob_elemental_resistance_pct',
    // D-102 (B9 close-out): the magnitudes the last prose rows state
    'mob_elemental_damage_taken_pct', 'hits', 'hit_pct', 'stop_sec',
    'missing_hp_pct_for_max', 'damage_at_missing_hp', 'dodge_charges', 'dodge_charges_per_levels',
    'dodge_charges_cap', 'spread_targets'];
  const EFFECT_OPS = ['add_pct', 'add_flat', 'mult'];
  const EFFECT_SUBJECTS = ['self', 'target'];
  /**
   * The mechanic words a row may state that are not magnitudes — each one has a reader in the client,
   * and `tools/lib/roster.js` S14 fails if a row invents a word nothing spends.
   */
  const EFFECT_RULES = ['ignores_dodge', 'every_target', 'guaranteed_status', 'bypasses_control_cap',
    'status_immunity', 'cleanses_on_cast', 'es_recharge_immediate', 'cleanses_status'];
  /** Rows whose mechanic is already carried by another column, so no number is missing. */
  const MODELLED_BY = ['targets', 'element'];
  /**
   * The lines that only take effect in a state the status store can actually write
   * (`mobStatus.ts`), so a conditional effect can never key on something nothing inflicts.
   */
  const EFFECT_CONDITIONS = ['chilled'];

  return {
    SKILLS, byId, LEVEL_STEP, CAST_REF, LADDER, CONVERSION, WEAPON_GROUPS,
    aggregateEffects, EFFECT_STATS, EFFECT_OPS, EFFECT_SUBJECTS, EFFECT_CONDITIONS, EFFECT_RULES, MODELLED_BY,
    PRESETS, presetCount, mainPreset,
    LADDER_MAX_DUPLICATES, RESERVATION_LIMIT, GROUP_BONUS,
    manaPct, basisOf, perPress, critsOnBasis, effCd, ladderPct, ladderCostToStep, skillLevel, skillXpForLevel,
    weaponGroupOf, groupBonus, masteryBonus, row, reservePct,
    all: () => SKILLS.skills,
    of: (type) => SKILLS.skills.filter((s) => s.type === type),
  };
}
