import { describe, expect, it } from 'vitest';
import { moveAimPoint, resolveArenaPick } from '../../src/ui/combat/arena-picking';
import { combatEffectLevel, sceneCombatEvents } from '../../src/ui/combat/combat-presentation';

const point = { x: 4, y: 6 };

describe('F35 — one picking priority below the HUD', () => {
  it('lets the HUD keep its own event, then an armed skill, then a target, then inspect, then ground', () => {
    expect(resolveArenaPick({ hud: true, armedSkill: true, actorId: 'mob', point }).kind).toBe('hud');
    expect(resolveArenaPick({ armedSkill: true, actorId: 'mob', point }))
      .toEqual({ kind: 'armed-skill', actorId: 'mob', point });
    expect(resolveArenaPick({ actorId: 'mob', point })).toEqual({ kind: 'target', actorId: 'mob' });
    expect(resolveArenaPick({ actorId: 'mob', inspect: true, point })).toEqual({ kind: 'inspect', actorId: 'mob' });
    expect(resolveArenaPick({ point })).toEqual({ kind: 'ground', point });
  });

  it('keeps a click on empty ground as a move even when a target is focused', () => {
    expect(resolveArenaPick({ actorIsTarget: true, point })).toEqual({ kind: 'ground', point });
  });
});

describe('F43 — keyboard aim', () => {
  it('steps the reticle a half metre and clamps it to the arena', () => {
    expect(moveAimPoint({ x: 1, y: 1 }, 'east')).toEqual({ x: 1.5, y: 1 });
    expect(moveAimPoint({ x: 1, y: 1 }, 'north')).toEqual({ x: 1, y: 0.5 });
    expect(moveAimPoint({ x: 0.2, y: 0.2 }, 'west', 0.5, { width: 50, height: 32 }))
      .toEqual({ x: 0, y: 0.2 });
    expect(moveAimPoint({ x: 49.9, y: 31.9 }, 'east', 0.5, { width: 50, height: 32 }))
      .toEqual({ x: 50, y: 31.9 });
  });

});

const fx = (over: Record<string, unknown>) => ({
  id: 1, sec: 1, kind: 'hit', side: 'field', colour: '#fff', text: '1', ...over,
}) as never;

describe('F14 — quality reaches every presentation path', () => {
  it('resolves Auto from speed and honors an explicit choice', () => {
    expect(combatEffectLevel('auto', 1)).toBe('full');
    expect(combatEffectLevel('auto', 4)).toBe('reduced');
    expect(combatEffectLevel('minimal', 1)).toBe('minimal');
    expect(combatEffectLevel('full', 8)).toBe('full');
  });

  it('keeps threat reads out of the cosmetic event list in Minimal', () => {
    const events = [
      fx({ id: 1, kind: 'hit', side: 'field', via: 'swing', text: '12', value: 12 }),
      fx({ id: 2, kind: 'taken', side: 'self', text: '20', value: 20 }),
    ];
    expect(sceneCombatEvents(events, 1, 'minimal')).toEqual([]);
    expect(sceneCombatEvents(events, 1, 'full')).toHaveLength(2);
  });
});
