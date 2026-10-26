import { E, MS } from '../engine/client';
import type { MobSkillRow } from '../../../engine/types';
import type { Mob } from './types';

const BY_ID = new Map(MS.skills.map((row) => [row.id, row]));
const MAX_KIT = MS.meta.max_kit;

export function mobSkillById(id: string): MobSkillRow | undefined {
  return BY_ID.get(id);
}

/** The reach a strike's authored role claims; `any` keeps the body's ordinary reach. */
export function mobStrikeRange(row: MobSkillRow, mob: Mob): number {
  if (row.role === 'front') return E.combat_arena.range.melee;
  if (row.role === 'stand-off') return E.combat_arena.range.ranged;
  return mob.line === 'stand-off' ? E.combat_arena.range.ranged : E.combat_arena.range.melee;
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

/** The first strike in kit order whose cooldown has elapsed; auras are passive and never picked. */
export function readyMobSkill(mob: Mob, atUs: number): MobSkillRow | undefined {
  for (const id of mob.skillIds || []) {
    const row = BY_ID.get(id);
    if (!row || row.mode !== 'strike') continue;
    if ((mob.skillReadyAtUs?.[id] ?? 0) <= atUs) return row;
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
