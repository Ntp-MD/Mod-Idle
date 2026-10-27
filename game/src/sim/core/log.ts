import type { GameState } from './types';

/** The log is the HUD's run record: newest first, capped at 60 lines. */
export function push(s: GameState, text: string) {
  s.log.unshift({ sec: s.clockSec, text });
  if (s.log.length > 60) s.log.length = 60;
}
