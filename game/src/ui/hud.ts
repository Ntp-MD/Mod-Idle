import { E, eng } from '../engine/client';
import type { GameState } from '../sim/types';
import type { Snapshot } from '../state/save';

/**
 * The field HUD's own pure reads.
 *
 * These lived inside `App.svelte`, where the same rule was written in markup and could only be checked
 * by looking at the field. Nothing here keeps state or touches the DOM: each is a function of the
 * game state and the data, so the away report, a spawn's field label and a backup's caption are all
 * assertions a test can make.
 */

/** The counters the away report diffs, so it shows the absence rather than a lifetime total. */
export function snapCounters(s: GameState) {
  return {
    kills: s.counters.kills, drops: s.counters.drops, junk: s.counters.junk, gold: s.counters.gold,
    stones: Object.values(s.counters.stones).reduce((a, b) => a + b, 0),
    level: s.player.level, quality: eng.zoneById(s.zone).quality,
  };
}

export type Snap = ReturnType<typeof snapCounters>;

export interface AwayReport {
  mins: number; secs: number; capped: boolean;
  kills: number; drops: number; junk: number; gold: number; stones: number; levels: number;
  quality: string;
}

/** What the away window paid: the difference between the snapshot taken before it and the state now. */
export function buildAwayReport(before: Snap, mins: number, secs: number, capped: boolean, s: GameState): AwayReport {
  const a = snapCounters(s);
  return {
    mins, secs, capped,
    kills: a.kills - before.kills, drops: a.drops - before.drops, junk: a.junk - before.junk,
    gold: a.gold - before.gold, stones: a.stones - before.stones, levels: a.level - before.level,
    quality: a.quality,
  };
}

/**
 * §11 field label: the ladder rung this spawn rolled (`mob.variants`), which is what its drop table
 * keys on — a body tier no longer implies the name, since the three normal rungs are their own roll
 * and a two-body species would otherwise never field one of them. A named boss reads its own name.
 */
export function fieldLabel(m: { species: string; speciesId?: string; kind: string; variant?: string }): string {
  const fl = E.mob.field_labels;
  if (m.kind.startsWith('Boss')) return `${m.kind.replace(/^Boss · /, '')}${fl.boss.suffix}`;
  if (m.variant) return m.variant;
  const ladder = m.speciesId ? (E.mob.variants as Record<string, string[]>)[m.speciesId] : null;
  return ladder ? ladder[0] : `${m.species.toLowerCase()}${m.kind === 'Elite' ? fl.elite.suffix : fl.normal.suffix}`;
}

/** One backup's caption, in the words the panel prints. */
export const describeSnap = (shot?: Snapshot): string =>
  shot ? `${shot.reason} at ${Math.round(shot.clockSec / 60)} min` : '—';
