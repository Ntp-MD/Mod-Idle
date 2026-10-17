import { describe, expect, it } from 'vitest';
import { actionFor, bindTable, DEFAULT_BINDS, formatKey } from '../src/ui/keybinds';

describe('keyboard binding labels', () => {
  it('keeps plus visible as a key instead of treating it only as a separator', () => {
    expect(DEFAULT_BINDS['map.zoom.in']).toBe('+');
    expect(formatKey(DEFAULT_BINDS['map.zoom.in'])).toBe('+');
    expect(formatKey('Ctrl++')).toBe('Ctrl +');
    expect(actionFor(bindTable(), '+')).toBe('map.zoom.in');
  });
});
