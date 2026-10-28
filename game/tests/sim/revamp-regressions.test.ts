import { describe, expect, it } from 'vitest';
import { byFrontLine } from '@sim/core/roster-order';
import { newGame } from '@sim/core/game';
import { createCombatArena } from '@sim/combat/combat-arena';
import { planAutoAvoid } from '@sim/combat/auto-avoid';
import { KEYBINDS, bindTable, conflicts, tokenOf } from '../../src/ui/hud/keybinds';

type Mods = Partial<Record<'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey', boolean>>;
const press = (key: string, mods: Mods = {}) =>
  ({ key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods }) as unknown as KeyboardEvent;

/** What the player presses to produce a stored token, so the round trip can be tested. */
function pressForToken(token: string): KeyboardEvent {
  if (token === '+') return press('=', { shiftKey: true });
  const parts = token.split('+');
  const base = parts.pop()!;
  const mods: Mods = {};
  for (const part of parts) mods[`${part.toLowerCase()}Key` as keyof Mods] = true;
  return press(base === 'Space' ? ' ' : base, mods);
}

describe('F42 — the roster comparator is a total order', () => {
  it('orders front before back and keeps equal lines equal', () => {
    expect(byFrontLine({ line: 'front' }, { line: 'back' })).toBeLessThan(0);
    expect(byFrontLine({ line: 'back' }, { line: 'front' })).toBeGreaterThan(0);
    expect(byFrontLine({ line: 'front' }, { line: 'front' })).toBe(0);
    expect(byFrontLine({ line: 'back' }, { line: 'back' })).toBe(0);
  });

  it('sorts stably within one line instead of reversing it', () => {
    const bodies = [
      { line: 'back', id: 'b1' }, { line: 'front', id: 'f1' },
      { line: 'back', id: 'b2' }, { line: 'front', id: 'f2' },
    ];
    expect([...bodies].sort(byFrontLine).map((body) => body.id)).toEqual(['f1', 'f2', 'b1', 'b2']);
  });
});

describe('F03 — every default binding is reachable', () => {
  it('holds no two actions on one token', () => {
    expect(conflicts(bindTable())).toEqual({});
  });

  it('round-trips every default token through the key tokenizer', () => {
    const unreachable = KEYBINDS
      .map((bind) => bind.def)
      .filter((token) => tokenOf(pressForToken(token)) !== token);
    expect(unreachable).toEqual([]);
  });
});

describe('F05 — auto-avoid measures the remaining escape, not the whole circle', () => {
  it('steps out when the player is already inside the circle and time covers the gap', () => {
    const state = newGame();
    const arena = createCombatArena();
    // centre 1.45 m away, damage radius 1.5 m + body 0.25 m; 0.2 s at player speed clears the edge
    Object.assign(arena.player, { x: 11.45, y: 10 });
    arena.mobFlights.push({
      actionId: 11, mobId: 'm1', mob: {} as never, source: { x: 10, y: 10 },
      destination: { x: 10, y: 10 }, position: { x: 10, y: 10 },
      releaseAtUs: 0, impactAtUs: 200_000, speedMps: 5, radiusM: 0.25,
      skillId: 'mob.earth.boulder-toss', kind: 'ground' as const, impactRadiusM: 1.5,
    } as never);
    const plan = planAutoAvoid(arena, state, 0, 1_000_000);
    expect(plan).not.toBeNull();
    if (!plan) return;
    const fromCentre = Math.hypot(plan.x - 10, plan.y - 10);
    expect(fromCentre).toBeGreaterThan(1.5);
  });
});
