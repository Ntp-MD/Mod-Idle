import { eng } from '../../engine/client';
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

export function buildPushReport(state: GameState, character: Character, pack: Mob[]): PushReport | null {
  if (!pack.length) return null;
  const threat = pack.reduce((worst, mob) => (mob.ps > worst.ps ? mob : worst), pack[0]);
  const element = threat.innate?.[0] || null;
  const resistance = element
    ? Math.min(character.resCap ?? 100, character.resistance + (character.resByElement?.[element] || 0))
    : 0;
  const gap = threat.level - state.player.level;
  const elemental = threat.damage !== 'physical';
  const advice: string[] = [];

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
    advice: advice.slice(0, 2),
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
