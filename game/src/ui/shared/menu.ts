/**
 * One verb a slot offers on a right-click. The list is built by the caller — the panel that knows what
 * the piece is and where the character is standing — and drawn by `SlotMenu.svelte`, so the menu itself
 * carries no rules about items.
 */
export interface MenuItem {
  label: string;
  /** a short second line: what the verb costs, or what it does, in the player's own units */
  hint?: string;
  disabled?: boolean;
  /** a verb that spends or destroys: drawn in the damage ink */
  danger?: boolean;
  onpick: () => void;
}
