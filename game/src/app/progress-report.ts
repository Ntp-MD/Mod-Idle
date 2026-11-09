import { eng } from '../engine/client';
import type { GameState } from '@sim/core/types';
import type { Snapshot } from '../state/save';

/**
 * Pure progress report (plan phase-4 policy-report).
 * snapCounters/buildAwayReport and their report types + the session-used
 * describeSnap helper live here as a pure app module. Runtime dependencies
 * stay in engine/sim; persistence DTO imports are type-only. HUD-only reads
 * (field labels, mechanic/spawn words) stay in ui/hud/hud.ts.
 */

/** The counters the away report diffs, so it shows the absence rather than a lifetime total. */
export function snapCounters(s: GameState) {
  return {
    kills: s.counters.kills, drops: s.counters.drops, junk: s.counters.junk, gold: s.counters.gold,
    stones: Object.values(s.counters.stones).reduce((a, b) => a + b, 0),
    level: s.player.level, quality: eng.zoneById(s.zone).quality,
    skills: { ...s.skills.owned }, treePoints: s.player.treePoints,
    attainment: s.player.attainmentPoints ?? 0,
  };
}

export type Snap = ReturnType<typeof snapCounters>;

export interface AwayReport {
  mins: number; secs: number; capped: boolean;
  kills: number; drops: number; junk: number; gold: number; stones: number; levels: number;
  quality: string;
  newSkills: string[];
  skillCopies: number;
  treePoints: number;
  attainment: number;
}

/** What the away window paid: the difference between the snapshot taken before it and the state now. */
export function buildAwayReport(before: Snap, mins: number, secs: number, capped: boolean, s: GameState): AwayReport {
  const a = snapCounters(s);
  return {
    mins, secs, capped,
    kills: a.kills - before.kills, drops: a.drops - before.drops, junk: a.junk - before.junk,
    gold: a.gold - before.gold, stones: a.stones - before.stones, levels: a.level - before.level,
    quality: a.quality,
    newSkills: Object.keys(a.skills).filter(id => !Object.hasOwn(before.skills, id)),
    skillCopies: Object.entries(a.skills).reduce((sum, [id, copies]) => sum + Math.max(0,
      copies - (Object.hasOwn(before.skills, id) ? before.skills[id] : -1)), 0),
    treePoints: Math.max(0, a.treePoints - before.treePoints),
    attainment: Math.max(0, a.attainment - before.attainment),
  };
}

/** One backup's caption, in the words the panel prints. */
export const describeSnap = (shot?: Snapshot): string =>
  shot ? `${shot.reason} at ${Math.round(shot.clockSec / 60)} min` : '—';
