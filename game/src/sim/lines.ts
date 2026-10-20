/**
 * The sheet's line tables — which `mods.json` line feeds which character bucket.
 *
 * This lives apart from `player.ts` so the passive-tree cage (`tools/tree.ts`) can check that every
 * node it gates grants a line the character sheet actually acts on. A line that is in neither table
 * contributes nothing, and a node that grants one is a silent no-op: it costs a point and moves
 * nothing. The tables are the sheet's own, read from one place.
 */

/** Mod id → the character line it feeds. The ids are the mods.json rows; nothing is typed here. */
export const PCT_LINE: Record<string, string> = {
  physical_power: 'physPct',
  magic_power: 'magicPct',
  attack_speed: 'aspdPct',
  accuracy: 'accPct',
  critical_chance: 'critPct',
  critical_damage: 'critDmgPct',
  max_hp: 'hpPct',
  max_mana: 'manaPct',
  max_energy_shield_pct: 'esPct',
  energy_shield_regen: 'esRegenPct',
  life_regen_pct: 'hpRegenPct',
  mana_regen_pct: 'manaRegenPct',
  elemental_power: 'elemPct',
  elemental_resistance: 'resPct',
  all_resistance_pct: 'allResPct',
  elemental_resistance_cap_pct: 'resCapPct',
  elemental_alignment: 'alignPct',
  attack_damage_pct: 'attackDamagePct',
  spell_damage_pct: 'spellDamagePct',
  cooldown_reduction: 'cdrPct',
  armour_pct: 'armourPct',
  evasion_pct: 'evasionPct',
  perfect_dodge_pct: 'pdodgePct',
  status_resistance_pct: 'statusResPct',
  // the four line-1 Frame Mods (item-base.md): block, penetration and the two chances
  block_chance: 'blockPct',
  armour_pen: 'armourPenPct',
  bleed_chance: 'bleedChancePct',
  stun_chance: 'stunChancePct',
};

export const FLAT_LINE: Record<string, string> = {
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

/** The one line the sheet folds outside the two tables: it feeds every Core attribute at once. */
export const ALL_STAT_LINE = 'all_stat_flat';
/**
 * The baked-stat line. A piece carries the stat it rolled at drop; the tree cannot roll one, so a tree
 * line of this kind feeds every Core attribute - the same reading as the all-stat line.
 */
export const STAT_MOD_LINE = 'stat_mod_flat';

/** Every line id the character sheet acts on — the two tables plus the all-stat line. */
export const SHEET_LINES: ReadonlySet<string> = new Set([
  ...Object.keys(PCT_LINE),
  ...Object.keys(FLAT_LINE),
  ALL_STAT_LINE,
  STAT_MOD_LINE,
]);
