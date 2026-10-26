import { E, eng } from '../../engine/client';
import type { GameState } from '../../sim/core/types';
import type { Snapshot } from '../../state/save';

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

/**
 * Field label: the fixed level-band form, with Elite/Boss kept as separate ranks. Drop variants remain
 * a loot identity and do not change the form's Core or name. A named boss reads its own name.
 */
export function fieldLabel(m: { species: string; speciesId?: string; kind: string; variant?: string; formName?: string }): string {
  const fl = E.mob.field_labels;
  if (m.kind.startsWith('Boss') || m.kind.startsWith('Unique')) return `${m.kind.replace(/^Boss · /, '').replace(/^Unique · /, '')}${fl.boss.suffix}`;
  if (m.formName) return m.kind === 'Elite' ? `${m.formName}${fl.elite.suffix}` : m.formName;
  if (m.variant) return m.variant;
  const ladder = m.speciesId ? (E.mob.variants as Record<string, { name: string }[]>)[m.speciesId] : null;
  return ladder?.length ? ladder[0].name : `${m.species.toLowerCase()}${m.kind === 'Elite' ? fl.elite.suffix : fl.normal.suffix}`;
}

/** One backup's caption, in the words the panel prints. */
export const describeSnap = (shot?: Snapshot): string =>
  shot ? `${shot.reason} at ${Math.round(shot.clockSec / 60)} min` : '—';

/**
 * What a spawn's trait mechanics read like on the card. The words and their assembly are the engine's
 * (`mob.trait_mechanics[].word`), so the card, the travel panel and the wiki cannot disagree.
 */
export const mechanicWords = (m: { mechanics?: Record<string, string | boolean> | null }): string[] =>
  eng.mechanicWordsOf(m.mechanics);

/** What standing on one side of a settlement rolls, in the words the travel card prints. */
export function sideSpawnWords(spawn?: { group?: string; elite_pct?: number; pack?: string } | null): string[] {
  if (!spawn) return [];
  return [`${spawn.group} a pack`, `${spawn.elite_pct}% elite`, eng.packWordOf(spawn.pack)];
}
