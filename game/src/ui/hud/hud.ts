import { E, eng } from '../../engine/client';
import type { GameState } from '@sim/core/types';
import type { Snapshot } from '../../state/save';

/**
 * The field HUD's own pure reads.
 *
 * These lived inside `App.svelte`, where the same rule was written in markup and could only be checked
 * by looking at the field. Nothing here keeps state or touches the DOM: each is a function of the
 * game state and the data, so the away report, a spawn's field label and a backup's caption are all
 * assertions a test can make.
 */

/**
 * Pure report counters live in app/progress-report.ts (plan phase-4 policy-report);
 * field labels, mechanic/spawn words stay here.
 */

/**
 * Field label: the fixed level-band form, with Elite/Boss kept as separate ranks. Drop variants remain
 * a loot identity and do not change the form's Core or name. A named boss reads its own name.
 */
export function fieldLabel(m: { species: string; speciesId?: string; kind: string; variant?: string; formName?: string }): string {
  const fl = E.mob.field_labels;
  if (m.kind.startsWith('Boss') || m.kind.startsWith('Unique')) return `${m.kind.replace(/^Boss · /, '').replace(/^Unique · /, '')}${fl.boss.suffix}`;
  if (m.formName) return m.kind === 'Elite' ? `${m.formName}${fl.elite.suffix}` : m.formName;
  if (m.variant) return m.variant;
  return `${m.species}${m.kind === 'Elite' ? fl.elite.suffix : fl.normal.suffix}`;
}

/** Backup caption helper lives in app/progress-report.ts (describeSnap). */

/**
 * What a spawn/**
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
