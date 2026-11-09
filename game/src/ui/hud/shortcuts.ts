/**
 * The fixed keyboard map.
 *
 * Shortcuts are part of the client's accessibility, not player state: one static table serves every
 * save, and there is no remapping screen to store or migrate. A token is the canonical name of one
 * press — modifiers in `Ctrl+Alt+Shift+Meta` order, then the base key with letters lowercased
 * (`'a'`, `'Shift+2'`, `'Space'`, `'Escape'`).
 */
export type KeyContext = 'global' | 'arena';

/** Where a shortcut answers: `global` everywhere, `arena` only with the arena command bar up. */
export interface Shortcut {
  id: string;
  token: string;
  context?: KeyContext;
}

/**
 * `screen.*` ids are the screens the rail and the bar carry, so opening one is one press from
 * anywhere. The digit keys follow a fixed screen order. The same digit can cast a skill slot in an
 * arena fight and open a screen out of one; that is one context per press, never a conflict.
 */
export const SHORTCUTS: Shortcut[] = [
  { id: 'screen.field', token: 'Escape' },
  { id: 'screen.map', token: '1' },
  { id: 'screen.bag', token: '2' },
  { id: 'screen.town', token: '3' },
  { id: 'screen.market', token: '4' },
  { id: 'screen.forge', token: '5' },
  { id: 'screen.craft', token: '6' },
  { id: 'screen.skills', token: '7' },
  { id: 'screen.tree', token: '8' },
  { id: 'screen.desk', token: 'd' },
  { id: 'screen.farm', token: 'f' },
  { id: 'screen.camp', token: 'g' },
  { id: 'screen.save', token: 's' },
  { id: 'screen.combat', token: 'h' },
  { id: 'sheet.open', token: 'c' },

  { id: 'game.pause', token: 'Space' },
  { id: 'arena.focus', token: 't' },
  { id: 'arena.focus.clear', token: 'Shift+t' },
  { id: 'arena.aim', token: 'r' },
  { id: 'arena.cast', token: 'x' },
  { id: 'arena.slot.1', token: '1', context: 'arena' },
  { id: 'arena.slot.2', token: '2', context: 'arena' },
  { id: 'arena.slot.3', token: '3', context: 'arena' },
  { id: 'arena.slot.4', token: '4', context: 'arena' },
  { id: 'arena.slot.5', token: '5', context: 'arena' },
  { id: 'arena.slot.6', token: '6', context: 'arena' },
  { id: 'arena.slot.7', token: '7', context: 'arena' },
  { id: 'arena.slot.8', token: '8', context: 'arena' },
  { id: 'arena.aim.north', token: 'ArrowUp', context: 'arena' },
  { id: 'arena.aim.south', token: 'ArrowDown', context: 'arena' },
  { id: 'arena.aim.west', token: 'ArrowLeft', context: 'arena' },
  { id: 'arena.aim.east', token: 'ArrowRight', context: 'arena' },
  { id: 'arena.aim.confirm', token: 'Enter', context: 'arena' },
  { id: 'arena.move.north', token: 'w', context: 'arena' },
  { id: 'arena.move.south', token: 's', context: 'arena' },
  { id: 'arena.move.west', token: 'a', context: 'arena' },
  { id: 'arena.move.east', token: 'd', context: 'arena' },

  { id: 'item.1', token: 'F1' },
  { id: 'item.2', token: 'F2' },
  { id: 'item.3', token: 'F3' },
  { id: 'item.4', token: 'F4' },
  { id: 'item.5', token: 'F5' },
  { id: 'item.6', token: 'F6' },
  { id: 'item.7', token: 'F7' },

  { id: 'map.zoom.in', token: '+' },
  { id: 'map.zoom.out', token: '-' },
  { id: 'map.zoom.reset', token: '0' },
  { id: 'map.view.next', token: 'v' },
  { id: 'map.walk', token: 'w' },
  { id: 'map.ids', token: 'i' },
  { id: 'map.centre', token: 'z' },

  { id: 'screen.stash', token: 'b' },
  { id: 'equip.best', token: 'q' },
  { id: 'stash.tab.next', token: 'n' },
  { id: 'stash.tab.prev', token: 'm' },
  { id: 'warehouse.stash.all', token: 'e' },
  { id: 'warehouse.take.all', token: 'Shift+e' },
];

/** The token a static action answers to, or an empty string for an action with no shortcut. */
export const SHORTCUT_TOKENS: Record<string, string> = Object.fromEntries(
  SHORTCUTS.map((shortcut) => [shortcut.id, shortcut.token]),
);

/** A held-direction set reduced to one ground step: opposites cancel, diagonals hold their
 *  bearing at full pace. WASD streams orders through key repeat; the sim still owns the feet. */
export function wasdVector(held: ReadonlySet<string>): { x: number; y: number } | null {
  let x = 0, y = 0;
  if (held.has('arena.move.west')) x -= 1;
  if (held.has('arena.move.east')) x += 1;
  if (held.has('arena.move.north')) y -= 1;
  if (held.has('arena.move.south')) y += 1;
  if (x === 0 && y === 0) return null;
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

const MOD_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;

/** A press has modifiers in one order only, so a stored token and a live event can never disagree. */
function modsOf(ev: KeyboardEvent): string[] {
  return MOD_ORDER.filter((m) => ev[(m.toLowerCase() + 'Key') as 'ctrlKey']);
}

/** A single press, named the same way whether it came from an event or from the static table. */
export function tokenOf(ev: KeyboardEvent): string {
  let base = ev.key;
  if (base === ' ') base = 'Space';
  else if (base.length === 1) base = base.toLowerCase();
  // a shifted digit or punctuation pair is the glyph the player sees on the board, so the token names
  // that glyph rather than the unshifted one underneath it
  if (base === '=' && ev.shiftKey) base = '+';
  // a shifted glyph already carries the Shift, but a shifted letter does not: Shift+T must stay
  // distinguishable from T or a chord shortcut can never be reached
  const letter = /^[a-z]$/.test(base);
  const mods = modsOf(ev).filter((m) => !(m === 'Shift' && !letter));
  return [...mods, base].join('+');
}

/** A modifier-only press is a hand reaching for a chord, not a key of its own. */
export function isModifierKey(ev: KeyboardEvent): boolean {
  return ['Control', 'Alt', 'Shift', 'Meta', 'OS'].includes(ev.key);
}

/** What the player reads on a key cap: the symbols they see on the board, not the internal token. */
export function formatKey(token: string): string {
  const plusBase = token === '+' || token.endsWith('++');
  const parts = plusBase
    ? [...(token === '+' ? [] : token.slice(0, -2).split('+')), '+']
    : token.split('+');
  return parts
    .map((part) => ({ Ctrl: 'Ctrl', Alt: 'Alt', Shift: '⇧', Meta: '⌘', Space: 'Space', Escape: 'Esc', Enter: '↵' } as Record<string, string>)[part] || part.toUpperCase())
    .join(' ');
}

/**
 * Which action this press belongs to, in this context. An arena shortcut wins in the arena;
 * everywhere else (and for keys the arena does not bind) the global table answers, so the
 * same digit can cast slot 1 in a fight and still open the map out of one.
 */
export function actionFor(token: string, context: KeyContext = 'global'): string | null {
  let fallback: string | null = null;
  for (const shortcut of SHORTCUTS) {
    if (shortcut.token !== token) continue;
    const where = shortcut.context ?? 'global';
    if (where === context) return shortcut.id;
    if (where === 'global') fallback ??= shortcut.id;
  }
  return fallback;
}

/**
 * A key press meant for the game only when the hand is not already typing. An open field owns its own
 * characters, so the dispatcher stands down over an editable element — and a screen full of number fields
 * is exactly where a stray shortcut would cost real state.
 */
export function isTypingTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n || !n.tagName) return false;
  return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable;
}
