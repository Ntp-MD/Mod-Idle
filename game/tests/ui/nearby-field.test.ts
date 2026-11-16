import { describe, expect, it } from 'vitest';
import type { CombatArenaActor, CombatArenaFrame } from '@sim/combat/combat-arena';
import type { FxEvent } from '@sim/core/types';
import { nearbyDistanceLabel, nearbyFieldMobs, offViewCue } from '../../src/ui/combat/nearby-field';
import { mobFixture } from '../fixtures/mobFixture';

const actor = (id: string, x: number, y: number, hp = 100): CombatArenaActor => ({
  id, x, y, facing: 0, moving: false, radiusM: 0.25, hp, hpMax: 100,
});

const frameWith = (player: { x: number; y: number }, mobs: CombatArenaActor[]): CombatArenaFrame => ({
  atUs: 1,
  player: actor('player', player.x, player.y),
  mobs: Object.fromEntries(mobs.map((entry) => [entry.id, entry])),
  bodies: [],
});

const fx = (id: number, kind: FxEvent['kind'], mobId?: string): FxEvent => ({
  id, kind, mobId, sec: 1, atUs: 1_000_000, text: '', colour: '',
});

describe('nearby presentation window', () => {
  const mobs = [
    mobFixture({ id: 'near', hp: 80 }),
    mobFixture({ id: 'edge', hp: 80 }),
    mobFixture({ id: 'far', hp: 80 }),
  ];

  it('filters on the unrounded centre distance, strictly below 10 m', () => {
    const frame = frameWith({ x: 0, y: 0 }, [actor('near', 3, 4), actor('edge', 9.999, 0), actor('far', 10, 0)]);
    expect(nearbyFieldMobs(mobs, frame).map((view) => view.id)).toEqual(['near', 'edge']);
  });

  it('keeps the simulation group order as bodies move', () => {
    const frame = frameWith({ x: 0, y: 0 }, [actor('far', 1, 0), actor('near', 9, 0), actor('edge', 2, 0)]);
    expect(nearbyFieldMobs(mobs, frame).map((view) => view.id)).toEqual(['near', 'edge', 'far']);
  });

  it('drops dead bodies and bodies absent from the sampled frame', () => {
    const frame = frameWith({ x: 0, y: 0 }, [actor('near', 1, 0, 0), actor('edge', 2, 0)]);
    expect(nearbyFieldMobs(mobs, frame).map((view) => view.id)).toEqual(['edge']);
  });

  it('never prints a just-under-10 m distance as 10.0 m', () => {
    expect(nearbyDistanceLabel(9.999)).toBe('< 10 m');
    expect(nearbyDistanceLabel(9.94)).toBe('9.9 m');
    expect(nearbyDistanceLabel(4.32)).toBe('4.3 m');
  });

  it('cues only real actions on hidden bodies, with no identity or distance', () => {
    const visible = new Set(['near']);
    const ring = [fx(1, 'hit', 'near'), fx(2, 'cast', 'hidden'), fx(3, 'drop', 'hidden')];
    expect(offViewCue(ring, visible)).toBe('An unseen enemy cast a skill.');
    expect(offViewCue([fx(4, 'kill', 'hidden')], visible)).toBe('An enemy fell beyond the nearby field.');
    expect(offViewCue([fx(5, 'hit', 'near')], visible)).toBeNull();
  });
});
