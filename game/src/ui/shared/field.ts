import { EFFECT_LABEL } from '@sim/combat/skills';
import { statusLabel } from '@sim/combat/mobStatus';
import type { GameState } from '@sim/core/types';

/**
 * The field's own reads, in words and in bar geometry.
 *
 * These lived in `App.svelte` beside the markup that prints them, so the only way to check them was to
 * look at the screen. Nothing here draws: a bar's style, a curse's sentence and a status's sentence are
 * functions of the state, which is what lets them be asserted in a test and shared by any component
 * that needs them.
 */

/**
 * A fill's own style: how far it reaches, and the fraction it reached so the bar's colour can be
 * stretched over the whole track rather than squeezed into the fill. A near-empty bar therefore
 * shows the hot end of its own ramp — the state is read from across the field, not only from the digit.
 */
export function bar(value: number, max: number): string {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return `--fill:${pct / 100};--w:${pct / 100}`;
}

/** What a curse has written on one mob, in words and with the seconds left on each line. */
export function curseWords(s: GameState, id: string): string {
  const lines = s.curses[id];
  if (!lines) return '';
  return Object.values(lines)
    .map((l: any) => `${EFFECT_LABEL[l.stat] || l.stat} ${l.value > 0 ? '+' : ''}${l.value}%` +
      `${l.condition ? ` while ${l.condition}` : ''} · ${l.secLeft}s left`)
    .join(' · ');
}

/** What the character has put on one mob: the DoT and debuff lines, with stacks and seconds. */
export function statusWords(s: GameState, id: string): string {
  const m = s.mobStatus[id];
  if (!m) return '';
  return Object.entries(m.statuses as Record<string, any>)
    .filter(([, l]) => l.stacks > 0 || l.secLeft > 0)
    .map(([name, l]) => statusLabel(name)
      + (l.stacks > 1 ? ' ×' + l.stacks : '')
      + (l.secLeft > 0 && l.secLeft < 90 ? ' ' + l.secLeft + 's' : ''))
    .join(' · ');
}
