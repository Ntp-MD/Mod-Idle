import { eng } from '../../engine/client';
import { mobSkillById } from '../combat/mobSkills';
import type { Character } from './player';
import type { GameState, Mob } from './types';

/**
 * The Push report: what hit the character, how prepared the sheet was for it, and the one change
 * worth making before the next attempt. It reads the pack that was on the field at the Push and the
 * same Character sheet every hit was mitigated against, so the recap cannot disagree with combat.
 */
export interface PushReport {
  name: string;
  kind: string;
  level: number;
  damage: string;
  element: string | null;
  resistance: number;
  maxHp: number;
  maxEs: number;
  armour: number;
  evasion: number;
  advice: string[];
}

const nameOf = (mob: Mob): string => {
  if (mob.kind.startsWith('Boss') || mob.kind.startsWith('Unique')) {
    return mob.kind.replace(/^(Boss|Unique) · /, '');
  }
  return mob.formName || mob.variant || mob.species;
};

/** The refusal reason worth fixing, with its fix — the most common last-word wins. */
function refusalFix(refusals: { reason?: string }[]): string | null {
  const counts = new Map<string, number>();
  for (const receipt of refusals) {
    const reason = receipt.reason ?? 'unknown';
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
  if (!top) return null;
  if (top === 'recovery') return 'Hold the next press half a beat — commands died inside recovery.';
  if (top === 'out of range') return 'Close in or lengthen reach — presses died out of range.';
  if (top === 'unreachable') return 'Aim reachable ground — the order could not walk there.';
  if (top === 'unknown skill') return 'A slotted skill is missing — check the bar.';
  if (top === 'target lost') return 'The target died mid-cast — pin a living body.';
  return `Answer the refused commands (${top}).`;
}

/** One change before the next attempt, chosen from what actually happened. */
function oneAction(
  state: GameState,
  character: Character,
  fatal: { mobId: string; species: string; value: number; atSec: number; skillId?: string } | undefined,
  refusals: { reason?: string }[],
): string | null {
  if (fatal?.skillId && mobSkillById(fatal.skillId)?.heavy) {
    return state.autoAvoidOff
      ? 'Turn on auto-avoid: the killing blow was a telegraphed heavy landing.'
      : 'The killing blow was a telegraphed heavy landing — leave its circle before impact.';
  }
  const fix = refusalFix(refusals);
  if (fix) return fix;
  if (character.maxMana > 0 && state.player.mana <= character.maxMana * 0.15) {
    return 'Hold Mana for the next press — the pool was empty at the Push.';
  }
  return null;
}

export function buildPushReport(state: GameState, character: Character, pack: Mob[]): PushReport | null {
  if (!pack.length) return null;
  // The report names the blow that actually took the last HP when it is recent; the highest-PS
  // body in the pack is only the fallback, because a bystander is not a cause.
  const fatal = state.lastFatalHit && state.clockSec - state.lastFatalHit.atSec <= 2
    ? state.lastFatalHit : undefined;
  const blamed = fatal ? pack.find((mob) => mob.id === fatal.mobId) : undefined;
  const threat = blamed ?? pack.reduce((worst, mob) => (mob.ps > worst.ps ? mob : worst), pack[0]);
  const element = threat.innate?.[0] || null;
  const resistance = element
    ? Math.min(character.resCap ?? 100, character.resistance + (character.resByElement?.[element] || 0))
    : 0;
  const gap = threat.level - state.player.level;
  const elemental = threat.damage !== 'physical';
  const advice: string[] = [];

  // F26 — one actionable change, ranked by the event graph: a telegraphed landing first, then
  // the most common refused command, then an empty pool. Static matchup advice follows.
  const refusals = (state.combatReceipts ?? []).filter((receipt) => receipt.status === 'rejected'
    && typeof receipt.atSec === 'number' && state.clockSec - receipt.atSec <= 5);
  const action = oneAction(state, character, fatal, refusals);
  if (action) advice.push(action);
  if (fatal) advice.push(`The killing blow came from ${fatal.species} for ${eng.fmt(fatal.value)}.`);
  // What the player asked for and did not get is part of the cause, not a footnote.
  if (refusals.length) {
    advice.push(`${refusals.length} command${refusals.length > 1 ? 's were' : ' was'} refused before the Push — last: ${refusals[refusals.length - 1].reason}.`);
  }
  if (gap >= 3) advice.push(`${nameOf(threat)} is ${gap} levels above you — step back a zone.`);
  if (elemental && element && resistance < 50) advice.push(`Raise ${element} resistance (${Math.round(resistance)}%).`);
  if (threat.damage === 'physical') {
    advice.push(`Physical hits answer Armour ${eng.fmt(character.armour)} and Evasion ${eng.fmt(character.evasion)}.`);
  } else if (threat.damage === 'magic') {
    advice.push('Magic hits ignore Armour; resistance and Max HP are the answer.');
  } else {
    advice.push('Mixed hits need both Armour and Elemental resistance.');
  }

  return {
    name: nameOf(threat),
    kind: threat.kind,
    level: threat.level,
    damage: threat.damage,
    element,
    resistance,
    maxHp: character.maxHp,
    maxEs: character.es,
    armour: character.armour,
    evasion: character.evasion,
    advice: advice.slice(0, 2 + (fatal ? 1 : 0) + (refusals.length ? 1 : 0) + (action ? 1 : 0)),
  };
}

export function pushReportLines(report: PushReport | null): string[] {
  if (!report) return [];
  const element = report.element ? ` · ${report.element}` : '';
  const resistance = report.element && report.damage !== 'physical'
    ? ` · your ${report.element} resistance ${Math.round(report.resistance)}%` : '';
  return [
    `Push report — ${report.name} (${report.kind} Lv ${report.level} · ${report.damage}${element})${resistance} · HP ${eng.fmt(report.maxHp)} · ES ${eng.fmt(report.maxEs)}`,
    ...(report.advice.length ? [`Push report — ${report.advice.join(' ')}`] : []),
  ];
}
