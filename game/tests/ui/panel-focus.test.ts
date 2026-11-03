import { describe, expect, it } from 'vitest';
import { choosePanelFocus } from '../../src/ui/hud/panel-focus';

describe('panel focus hand-off', () => {
  const base = { topDialog: false, openerInTop: false, openerUsable: false, fallbackUsable: false };

  it('returns to a live opener when no dialog is left', () => {
    expect(choosePanelFocus({ ...base, openerUsable: true })).toBe('opener');
  });

  it('uses the fallback when the opener expired and no dialog is left', () => {
    expect(choosePanelFocus({ ...base, fallbackUsable: true })).toBe('fallback');
  });

  it('keeps focus in the remaining top dialog instead of a new dialog behind it', () => {
    expect(choosePanelFocus({ ...base, topDialog: true, openerUsable: true })).toBe('top');
  });

  it('returns to an opener that lives inside the remaining top dialog', () => {
    expect(choosePanelFocus({ ...base, topDialog: true, openerInTop: true, openerUsable: true })).toBe('opener-in-top');
  });

  it('does not focus an unusable opener inside the top dialog', () => {
    expect(choosePanelFocus({ ...base, topDialog: true, openerInTop: true })).toBe('top');
  });

  it('does nothing when every target is gone', () => {
    expect(choosePanelFocus(base)).toBeNull();
  });
});
