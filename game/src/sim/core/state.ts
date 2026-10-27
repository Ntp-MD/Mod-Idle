import { E, eng, STAT_KEYS, tree, type StatKey } from '../../engine/client';
import { bundleOf } from '../../../../engine/keystones.ts';
import type { GameState } from './types';
import { buildCharacter } from './player';
import { weaponByName, masteryLevel } from './mastery';
import { effectsActive, usableHp } from '../combat/skills';
import { withHunger, withMeal, lifeSkillBonuses } from '../world/fieldwork';

/**
 * The character line: the sheet a tick, the HUD and a price all read, plus the pool clamp that
 * follows a tick. No flow lives here — no tick, no reward, no town step — so this module is safe to
 * import from any sim domain without forming a cycle.
 */

/** the held weapon's base name, for the read that names what is in hand */
export function heldWeaponName(s: GameState): string | null {
  const main = s.gear.find((g) => g && !g.broken && g.slot === 'main hand');
  const w = main ? weaponByName(main.base) : null;
  return w ? w.name : null;
}

/** What the character carries besides gear: potions, condensed bottles and herbs all weigh. */
export function carried(s: GameState) {
  const bottles = Object.values(s.farm.potions).reduce((a: number, b: number) => a + b, 0);
  const condensed = Object.values(s.farm.condensed).reduce((a: number, b: number) => a + b, 0);
  const herbs = Object.values(s.farm.herbs).reduce((a: number, b: number) => a + b, 0);
  const materials = Object.values(s.fieldwork.materials).reduce((a: number, b: number) => a + b, 0);
  const food = Object.values(s.fieldwork.foods).reduce((a: number, b: number) => a + b, 0);
  // the kept pieces ride on the back: each weighs what its Base says, against the same capacity
  const bagWeight = s.bag.reduce((t, g) => t + (g?.weight || 0), 0);
  return { potions: bottles, condensed, herbs, materials, food, bagWeight };
}

/** The current character used by the HUD and live combat, including active skill effects. */
export function characterSheet(s: GameState, effects = effectsActive(s.skills, tree.keystoneBundles(s.player.treeRanks))) {
  return withHunger(withMeal(buildCharacter(s.player.level, s.gear, carried(s), masteryLevel(s, heldWeaponName(s)),
    effects, s.player.points, s.player.treeRanks, lifeSkillBonuses(s)), s), s);
}

/** A fresh character has spent no points: the sheet starts empty and grants on level-up. */
export const ZERO_POINTS = (): Record<StatKey, number> =>
  Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<StatKey, number>;

/**
 * Spend banked points on the least-invested Core attributes — the REFERENCE allocation the published
 * numbers (and `mob_HP`) are priced against. Choosing by current totals carries the remainder across
 * 5-point level grants, instead of restarting at Strength and starving the last stats every level.
 */
export function spendReference(s: GameState): void {
  const p = s.player;
  while (p.statPoints > 0) {
    const next = STAT_KEYS.reduce((least, k) => p.points[k] < p.points[least] ? k : least, STAT_KEYS[0]);
    p.points[next]++;
    p.statPoints--;
  }
}

/**
 * Jump a headless character to `level` with exactly the stat points that level grants, spent evenly.
 * a level grants points rather than stats, so a test that assigns `.level` alone leaves
 * the character at its level-1 line; this is the test-facing form of the level-up path in `tick`.
 */
export function setLevel(s: GameState, level: number): void {
  s.player.level = level;
  const spent = STAT_KEYS.reduce((a, k) => a + s.player.points[k], 0);
  s.player.statPoints = Math.max(0, eng.pointsAt(level) - spent);
  // the same shortcut has to bank the tree points the level is worth, or a character placed at a level
  // holds none and the tree cannot be touched at all
  const qEarned = s.player.questTreePointsEarned ?? 0;
  const spentTree = tree.pointsSpentByCurrency(s.player.treeRanks).tree ?? 0;
  s.player.treePoints = Math.max(0, tree.pointsAt(level, E.stat.level_cap) + qEarned - spentTree);
  spendReference(s);
}

/**
 * Re-read the pools against the sheet the tick ended on. A tick can move a pool's ceiling after the
 * opening clamp — equipping a piece drops the `Max Mana %` line it replaced, a spent point raises
 * Int — so the bar is bounded again here, otherwise it reads above what the character now holds.
 */
export function clampPools(s: GameState): void {
  const c = characterSheet(s);
  const debt52 = bundleOf(c.keystones, 'mana-debt');
  s.player.mana = Math.min(debt52 ? s.player.mana : Math.max(0, s.player.mana), c.maxMana);
  s.player.es = Math.min(Math.max(0, s.player.es), c.es);
  s.player.hp = Math.min(s.player.hp, usableHp(c, s.skills));
}
