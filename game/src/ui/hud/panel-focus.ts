/** Choose the focus hand-off after a dialog closes, without touching the DOM. */
export type PanelFocusChoice = 'opener-in-top' | 'top' | 'opener' | 'fallback' | null;

export function choosePanelFocus(input: {
  topDialog: boolean;
  openerInTop: boolean;
  openerUsable: boolean;
  fallbackUsable: boolean;
}): PanelFocusChoice {
  if (input.topDialog) return input.openerInTop && input.openerUsable ? 'opener-in-top' : 'top';
  if (input.openerUsable) return 'opener';
  return input.fallbackUsable ? 'fallback' : null;
}
