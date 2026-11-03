import { describe, expect, it } from 'vitest';
import { actionFor, formatKey, SHORTCUTS, SHORTCUT_TOKENS, tokenOf, wasdVector } from '../../src/ui/hud/shortcuts';

type Mods = Partial<Record<'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey', boolean>>;
const press = (key: string, mods: Mods = {}) =>
  ({ key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods }) as unknown as KeyboardEvent;
function pressForToken(token: string): KeyboardEvent {
  if (token === '+') return press('=', { shiftKey: true });
  const parts = token.split('+');
  const base = parts.pop()!;
  const mods: Mods = {};
  for (const part of parts) mods[`${part.toLowerCase()}Key` as keyof Mods] = true;
  return press(base === 'Space' ? ' ' : base, mods);
}

describe('the fixed keyboard map', () => {
  it('keeps plus visible as a key instead of treating it only as a separator', () => {
    expect(SHORTCUT_TOKENS['map.zoom.in']).toBe('+');
    expect(formatKey(SHORTCUT_TOKENS['map.zoom.in'])).toBe('+');
    expect(formatKey('Ctrl++')).toBe('Ctrl +');
    expect(actionFor('+')).toBe('map.zoom.in');
  });

  it('round-trips every shortcut token through the tokenizer', () => {
    const unreachable = SHORTCUTS
      .map((shortcut) => shortcut.token)
      .filter((token) => tokenOf(pressForToken(token)) !== token);
    expect(unreachable).toEqual([]);
  });

  it('holds one action per token in each context', () => {
    const seen = new Set<string>();
    for (const shortcut of SHORTCUTS) {
      const key = `${shortcut.context ?? 'global'}:${shortcut.token}`;
      expect(seen.has(key), `${key} is assigned twice`).toBe(false);
      seen.add(key);
    }
  });
});

describe('context-aware shortcuts — one digit, two jobs', () => {
  it('routes arena digits to skill slots and field digits to screens', () => {
    expect(actionFor('1', 'arena')).toBe('arena.slot.1');
    expect(actionFor('8', 'arena')).toBe('arena.slot.8');
    expect(actionFor('1', 'global')).toBe('screen.map');
    expect(actionFor('1')).toBe('screen.map');
  });

  it('falls back to the global table for keys the arena does not bind', () => {
    expect(actionFor('x', 'arena')).toBe('arena.cast');
    expect(actionFor('t', 'arena')).toBe('arena.focus');
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
    expect(actionFor('w', 'arena')).toBe('arena.move.north');
    expect(actionFor('a', 'arena')).toBe('arena.move.west');
    expect(actionFor('w', 'global')).not.toBe('arena.move.north');
  });
});
