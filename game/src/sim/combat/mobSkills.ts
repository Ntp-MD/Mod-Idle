import { E, MS } from '../../engine/client';
import { attackRangeGeometry } from '../../../../engine/attack-range.ts';
import type { AttackRangeGeometry } from '../../../../engine/attack-range.ts';
import type { MobCastProfile, MobSkillRow } from '../../../../engine/types';
import type { Mob } from '../core/types';

const BY_ID = new Map(MS.skills.map((row) => [row.id, row]));
const MAX_KIT = MS.meta.max_kit;

export function mobSkillById(id: string): MobSkillRow | undefined {
  return BY_ID.get(id);
}

/**
 * The one legacy adapter, used only if a strike row predates explicit cast authoring. The data
 * cage refuses such rows; it maps the body's line to the same ordinary profiles the basics use.
 */
export function mobCastProfile(row: MobSkillRow, mob: Mob): MobCastProfile {
  if (row.cast) return row.cast;
  return mob.line === 'stand-off'
    ? {
      delivery: 'projectile',
      range: { basis: 'center', meters: E.combat_arena.range.ranged },
      windup_sec: Number(row.cast_sec || 0), recovery_sec: 0.2,
      projectile_speed_mps: 12, hit_radius_m: 0.35,
    }
    : {
      delivery: 'melee',
      range: { basis: 'body-edge', meters: E.combat_arena.normal_attack.profiles.melee.range.meters },
      windup_sec: Number(row.cast_sec || 0), recovery_sec: 0.2,
    };
}

function bodyRadius(mob: Mob): number {
  const entry = (E.mob.sizes as { id: string; radius_m?: number }[] | undefined)
    ?.find((size) => size.id === (mob.readsAs || 'medium'));
  return entry?.radius_m ?? E.combat_arena.player_radius_m;
}

/** Authored cast reach as a maximum centre distance for the real bodies. */
export function mobStrikeRange(row: MobSkillRow, mob: Mob,
  targetRadius = E.combat_arena.player_radius_m): number {
  const cast = mobCastProfile(row, mob);
  return attackRangeGeometry(cast.range, { selfRadius: bodyRadius(mob), targetRadius }, 0, 100,
    E.combat_arena.normal_attack.contact_clearance_m).maxCenterDistance;
}

/** Release/contact geometry for one mob cast against the body's actual feet. */
export function mobCastGeometry(row: MobSkillRow, mob: Mob, selfRadius: number, targetRadius: number,
  distance: number): AttackRangeGeometry {
  const cast = mobCastProfile(row, mob);
  return attackRangeGeometry(cast.range, { selfRadius, targetRadius }, distance, 100,
    E.combat_arena.normal_attack.contact_clearance_m);
}

/**
 * Resolve one spawn's kit by override, never by merging layers: a unique uses its own list or falls
 * back down the same ladder, a boss uses its own list, a variant may replace its species list, and a
 * species list is the floor. The cap is applied here so no caller can exceed it.
 */
export function resolveMobKit(
  rank: string,
  speciesId: string,
  variantName?: string | null,
  fixedName?: string | null,
): string[] {
  const kits = MS.kits;
  const pick = (list?: string[]) => (list ? list : undefined);
  const ids = rank === 'unique' && fixedName
    ? pick(kits.uniques[fixedName]) ?? pick(kits.bosses[fixedName]) ?? pick(kits.species[speciesId])
    : rank === 'boss' && fixedName
      ? pick(kits.bosses[fixedName]) ?? pick(kits.species[speciesId])
      : (variantName ? pick(kits.variants[variantName]) : undefined) ?? pick(kits.species[speciesId]);
  const seen = new Set<string>();
  return (ids || []).filter((id) => {
    if (seen.has(id) || !BY_ID.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, MAX_KIT);
}

/** A strike row only answers inside its authored HP window; ungated rows answer always. */
export function rowPhaseAllows(row: MobSkillRow, mob: Mob): boolean {
  const gate = row.phase;
  if (!gate) return true;
  const frac = mob.hpMax > 0 ? mob.hp / mob.hpMax * 100 : 100;
  if (gate.hpBelowPct != null && !(frac <= gate.hpBelowPct + 1e-9)) return false;
  if (gate.hpAbovePct != null && !(frac >= gate.hpAbovePct - 1e-9)) return false;
  return true;
}

/** Encounter phase of one body: how many of its kit's HP gates it has crossed (0 is the opening). */
export function mobPhase(mob: Mob, rows: readonly MobSkillRow[]): number {
  const frac = mob.hpMax > 0 ? mob.hp / mob.hpMax * 100 : 100;
  const thresholds = new Set<number>();
  for (const row of rows) if (row.phase?.hpBelowPct != null) thresholds.add(row.phase.hpBelowPct);
  let phase = 0;
  for (const threshold of [...thresholds].sort((a, b) => b - a))
    if (frac <= threshold + 1e-9) phase++;
  return phase;
}

/** The first strike in kit order whose cooldown has elapsed; auras are passive and never picked. */
export function readyMobSkill(mob: Mob, atUs: number, usable: (row: MobSkillRow) => boolean = () => true): MobSkillRow | undefined {
  for (const id of mob.skillIds || []) {
    const row = BY_ID.get(id);
    if (!row || row.mode !== 'strike') continue;
    if (!rowPhaseAllows(row, mob)) continue;
    if ((mob.skillReadyAtUs?.[id] ?? 0) <= atUs && usable(row)) return row;
  }
  return undefined;
}

export function markMobSkillUsed(mob: Mob, row: MobSkillRow, atUs: number, unitsPerSec: number): void {
  const readyAt = atUs + Math.max(0, row.cd || 0) * unitsPerSec;
  (mob.skillReadyAtUs ||= {})[row.id] = readyAt;
}

/**
 * Plan the strike each already-scheduled action will use this tick. The plan is a copy of the live
 * cooldowns, so a second action in the same window sees the first one's spend. It lets the field raise
 * a cast beat `cast_sec` before the swing without opening a second action clock.
 */
export function planMobSkills(mob: Mob, timesUs: number[], unitsPerSec: number): Map<number, MobSkillRow> {
  const ready: Record<string, number> = { ...(mob.skillReadyAtUs || {}) };
  const plan = new Map<number, MobSkillRow>();
  for (const atUs of timesUs) {
    for (const id of mob.skillIds || []) {
      const row = BY_ID.get(id);
      if (!row || row.mode !== 'strike') continue;
      if (!rowPhaseAllows(row, mob)) continue;
      if ((ready[id] ?? 0) <= atUs) {
        plan.set(atUs, row);
        ready[id] = atUs + Math.max(0, row.cd || 0) * unitsPerSec;
        break;
      }
    }
  }
  return plan;
}

/**
 * Recompute every body's aura-adjusted reads from living engaged sources. Each stat is strongest-wins
 * across sources, so duplicate copies never stack; a source that dies stops contributing on the next
 * tick because only the living are read. Non-engaged bodies stay at their base values.
 */
export function applyMobAuras(group: Mob[], engaged: Mob[], inRange?: (sourceId: string, targetId: string) => boolean): void {
  const living = engaged.filter((mob) => mob.hp > 0);
  for (const mob of group) {
    mob.effArmour = mob.armour;
    mob.effRes = mob.res;
    mob.effResByElement = mob.resByElement ? { ...mob.resByElement } : undefined;
    mob.auraDamageMult = 1;
    mob.auraSpeedMult = 1;
    mob.auraSources = [];
  }
  for (const target of living) {
    let armourPct = 0;
    let resistPct = 0;
    const sources: { id: string; sourceId: string }[] = [];
    for (const source of living) {
      for (const id of source.skillIds || []) {
        const row = BY_ID.get(id);
        if (!row || row.mode !== 'aura') continue;
        if (row.scope === 'line' && source.line !== target.line) continue;
        if (inRange && !inRange(source.id, target.id)) continue;
        for (const [stat, value] of Object.entries(row.effects || {})) {
          if (!(value > 0)) continue;
          if (stat === 'armour_pct') armourPct = Math.max(armourPct, value);
          else if (stat === 'resist_pct') resistPct = Math.max(resistPct, value);
        }
        if (!sources.some((entry) => entry.id === id && entry.sourceId === source.id)) {
          sources.push({ id, sourceId: source.id });
        }
      }
    }
    target.effArmour = target.armour * (1 + armourPct / 100);
    target.effRes = Math.min(E.caps.elem_res, target.res + resistPct);
    if (target.resByElement) {
      const map: Record<string, number> = {};
      for (const [el, res] of Object.entries(target.resByElement)) {
        map[el] = Math.min(E.caps.elem_res, res + resistPct);
      }
      target.effResByElement = map;
    }
    target.auraSources = sources;
  }
}
