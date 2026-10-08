/**
 * The keyboard map.
 *
 * Bindings are client settings, not character state: one map serves all three save slots, and a save file
 * never carries a key. `keybinds` is stored as a *sparse override*, so an action added after a player has
 * bound something keeps its own binding and the new action simply arrives with its default.
 *
 * A token is the canonical name of one press: modifiers in `Ctrl+Alt+Shift+Meta` order, then the base key
 * with letters lowercased (`'a'`, `'Shift+2'`, `'Space'`, `'Escape'`). The same shape is what the settings
 * screen records and what the dispatcher looks up, so a binding can never be stored in a form the handler
 * cannot match.
 */

export type KeyGroup = 'screen' | 'map' | 'field' | 'warehouse';

export interface Keybind {
  id: string;
  /** the words the settings list prints */
  label: string;
  group: KeyGroup;
  def: string;
  /** the screen or control this key stands in for, so the list can name what it opens */
  where: string;
}

export const KEYGROUP_LABEL: Record<KeyGroup, string> = {
  screen: 'Screens',
  map: 'The map',
  field: 'The field',
  warehouse: 'Stash and bag',
};

/**
 * `screen.*` ids are the rail tabs, so opening a screen is one press from anywhere. The digit keys follow
 * the rail's own order — the tab prints its number on it — and the letter keys go to the screens a player
 * reaches for less often than the ones in front of them. The warehouse has no tab: it is the bag's other
 * side, so its key opens that screen on that side.
 */
export const KEYBINDS: Keybind[] = [
  { id: 'screen.field', label: 'Back to the field', group: 'screen', def: 'Escape', where: 'anywhere' },
  { id: 'screen.map', label: 'Map', group: 'screen', def: '1', where: 'rail' },
  { id: 'screen.bag', label: 'Bags — the side that serves where you stand', group: 'screen', def: '2', where: 'rail' },
  { id: 'screen.town', label: 'Town — the settlement you stand in', group: 'screen', def: '3', where: 'rail' },
  { id: 'screen.market', label: 'Market — buy and sell', group: 'screen', def: '4', where: 'town' },
  { id: 'screen.forge', label: 'Forge — enhance a piece', group: 'screen', def: '5', where: 'town' },
  { id: 'screen.craft', label: 'Craft house — stones on the mods', group: 'screen', def: '6', where: 'town' },
  { id: 'screen.skills', label: 'Skills and the cast order', group: 'screen', def: '7', where: 'rail' },
  { id: 'screen.tree', label: 'Passive tree', group: 'screen', def: '8', where: 'rail' },
  { id: 'screen.desk', label: 'Settlement desk — board, standing, collector', group: 'screen', def: 'd', where: 'rail' },
  { id: 'screen.farm', label: 'Farm and alchemy', group: 'screen', def: 'f', where: 'rail' },
  { id: 'screen.save', label: 'Save, backups and settings', group: 'screen', def: 's', where: 'rail' },
  { id: 'screen.keys', label: 'Keyboard settings', group: 'screen', def: 'k', where: 'rail' },
  { id: 'sheet.open', label: 'Character sheet', group: 'screen', def: 'c', where: 'action bar' },

  { id: 'game.pause', label: 'Pause or resume the clock', group: 'field', def: 'Space', where: 'the field' },
  { id: 'game.tick', label: 'Step one second while paused', group: 'field', def: 'Shift+Space', where: 'the field' },

  { id: 'map.zoom.in', label: 'Zoom the sheet in', group: 'map', def: '+', where: 'map focus' },
  { id: 'map.zoom.out', label: 'Zoom the sheet out', group: 'map', def: '-', where: 'map focus' },
  { id: 'map.zoom.reset', label: 'Reset the sheet view', group: 'map', def: '0', where: 'map focus' },
  { id: 'map.view.next', label: 'Next sheet view — terrain, band, gate', group: 'map', def: 'v', where: 'map focus' },
  { id: 'map.walk', label: 'Show or hide the walk graph', group: 'map', def: 'w', where: 'map focus' },
  { id: 'map.ids', label: 'Show or hide the cell ids', group: 'map', def: 'i', where: 'map focus' },
  { id: 'map.centre', label: 'Centre on where you stand', group: 'map', def: 'z', where: 'map focus' },

  { id: 'screen.stash', label: 'Bags, opened on the stash', group: 'warehouse', def: 'b', where: 'bags' },
  { id: 'equip.best', label: 'Put on the best gear you carry', group: 'warehouse', def: 'q', where: 'bags or town' },
  { id: 'stash.tab.next', label: 'Next stash tab', group: 'warehouse', def: 'n', where: 'the stash' },
  { id: 'stash.tab.prev', label: 'Previous stash tab', group: 'warehouse', def: 'm', where: 'the stash' },
  { id: 'warehouse.stash.all', label: 'Stash every unlocked piece from the pile', group: 'warehouse', def: 'e', where: 'the stash' },
  { id: 'warehouse.take.all', label: 'Take back every unlocked piece of the open tab', group: 'warehouse', def: 'Shift+e', where: 'the stash' },
];

export const DEFAULT_BINDS: Record<string, string> = Object.fromEntries(
  KEYBINDS.map((b) => [b.id, b.def]),
);

const MOD_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;

/** A press has modifiers in one order only, so a stored binding and a live event can never disagree. */
function modsOf(ev: KeyboardEvent): string[] {
  return MOD_ORDER.filter((m) => ev[(m.toLowerCase() + 'Key') as 'ctrlKey']);
}

/** A single press, named the same way whether it came from an event or from the stored table. */
export function tokenOf(ev: KeyboardEvent): string {
  let base = ev.key;
  if (base === ' ') base = 'Space';
  else if (base.length === 1) base = base.toLowerCase();
  // a shifted digit or punctuation pair is the glyph the player sees on the board, so the token names
  // that glyph rather than the unshifted one underneath it
  if (base === '=' && ev.shiftKey) base = '+';
  const mods = modsOf(ev).filter((m) => m !== 'Shift');
  return [...mods, base].join('+');
}

/** A modifier-only press is a hand reaching for a chord, not a key of its own. */
export function isModifierKey(ev: KeyboardEvent): boolean {
  return ['Control', 'Alt', 'Shift', 'Meta', 'OS'].includes(ev.key);
}

/** What the player reads on a key cap: the symbols they see on the board, not the internal token. */
export function formatKey(token: string): string {
  return token
    .split('+')
    .map((part) => ({ Ctrl: 'Ctrl', Alt: 'Alt', Shift: '⇧', Meta: '⌘', Space: 'Space', Escape: 'Esc', Enter: '↵' } as Record<string, string>)[part] || part.toUpperCase())
    .join(' ');
}

/** An action's own binding, or its default — the merge that makes the stored override sparse. */
export function bindTable(over: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const b of KEYBINDS) out[b.id] = over[b.id] || DEFAULT_BINDS[b.id] || b.def;
  return out;
}

/** Which action this press belongs to. The table is bound action → key, so the scan is the short way round. */
export function actionFor(binds: Record<string, string>, token: string): string | null {
  for (const id of Object.keys(binds)) if (binds[id] === token) return id;
  return null;
}

/** Two actions on one key: the settings screen says so rather than letting one silently win. */
export function conflicts(binds: Record<string, string>): Record<string, string[]> {
  const byToken: Record<string, string[]> = {};
  for (const [id, token] of Object.entries(binds)) (byToken[token] ||= []).push(id);
  return Object.fromEntries(Object.entries(byToken).filter(([, ids]) => ids.length > 1));
}

/**
 * A key press meant for the game only when the hand is not already typing. An open field owns its own
 * characters, so the dispatcher stands down over an editable element — and a screen full of number fields
 * is exactly where a stray bound key would cost real state.
 */
export function isTypingTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n || !n.tagName) return false;
  return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable;
}
