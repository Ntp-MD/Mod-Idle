import { describe, expect, it } from 'vitest';
import { actionFor, bindTable, conflicts, DEFAULT_BINDS, formatKey, keyContextOf, wasdVector } from '../../src/ui/hud/keybinds';

describe('keyboard binding labels', () => {
  it('keeps plus visible as a key instead of treating it only as a separator', () => {
    expect(DEFAULT_BINDS['map.zoom.in']).toBe('+');
    expect(formatKey(DEFAULT_BINDS['map.zoom.in'])).toBe('+');
    expect(formatKey('Ctrl++')).toBe('Ctrl +');
    expect(actionFor(bindTable(), '+')).toBe('map.zoom.in');
  });
});

describe('context-aware keys — one digit, two jobs', () => {
  it('routes arena digits to skill slots and field digits to screens', () => {
    const binds = bindTable();
    expect(actionFor(binds, '1', 'arena')).toBe('arena.slot.1');
    expect(actionFor(binds, '8', 'arena')).toBe('arena.slot.8');
    expect(actionFor(binds, '1', 'global')).toBe('screen.map');
    expect(actionFor(binds, '1')).toBe('screen.map');
  });

  it('falls back to the global table for keys the arena does not bind', () => {
    const binds = bindTable();
    expect(actionFor(binds, 'x', 'arena')).toBe('arena.cast');
    expect(actionFor(binds, 't', 'arena')).toBe('arena.focus');
  });

  it('treats cross-context twins as one press each, not a conflict', () => {
    expect(keyContextOf('arena.slot.1')).toBe('arena');
    expect(keyContextOf('screen.map')).toBe('global');
    expect(Object.keys(conflicts(bindTable()))).not.toContain('1');
    expect(conflicts({ a: 'q', b: 'q' })).toEqual({ q: ['a', 'b'] });
  });
});

describe('WASD walk vector — orders only, the sim owns the feet', () => {
  it('aims one step along the held keys', () => {
    expect(wasdVector(new Set(['arena.move.north']))).toEqual({ x: 0, y: -1 });
    expect(wasdVector(new Set(['arena.move.east']))).toEqual({ x: 1, y: 0 });
  });

  it('cancels opposites and holds diagonals at full pace', () => {
    expect(wasdVector(new Set(['arena.move.north', 'arena.move.south']))).toBeNull();
    expect(wasdVector(new Set(['arena.move.west', 'arena.move.east']))).toBeNull();
    const diag = wasdVector(new Set(['arena.move.north', 'arena.move.east']));
    expect(diag).not.toBeNull();
    expect(Math.hypot(diag!.x, diag!.y)).toBeCloseTo(1, 10);
  });

  it('routes WASD tokens to walk orders in the arena only', () => {
    const binds = bindTable();
    expect(actionFor(binds, 'w', 'arena')).toBe('arena.move.north');
    expect(actionFor(binds, 'a', 'arena')).toBe('arena.move.west');
    expect(actionFor(binds, 'w', 'global')).not.toBe('arena.move.north');
  });
});
