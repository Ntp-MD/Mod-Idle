import { describe, expect, it } from 'vitest';
import { approachPoint, clipForPhase, DUEL_CLIPS, exchangeTimeline } from '../../src/ui/dev/three-duel';

describe('three-duel beat table — the clip contract a browser check then watches', () => {
  it('names the committed Quaternius clips', () => {
    expect(DUEL_CLIPS).toEqual({
      idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Punch', hit: 'HitReact', death: 'Death',
    });
    expect(clipForPhase('attack')).toBe('attack');
    expect(clipForPhase('hit')).toBe('hit');
    expect(clipForPhase('dead')).toBe('death');
    expect(clipForPhase('walk')).toBe('walk');
    expect(clipForPhase('idle')).toBe('idle');
  });

  it('orders windup before release before recovery on one exchange', () => {
    const beats = exchangeTimeline({ windupSec: 0.35, releaseSec: 0.6, recoverySec: 1.1 });
    expect(beats.map((b) => b.kind)).toEqual(['windup', 'release', 'recover', 'done']);
    expect(beats[1].at).toBe(0.6);
    expect(beats[2].at).toBe(1.1);
  });

  it('clamps a release that precedes its windup', () => {
    const beats = exchangeTimeline({ windupSec: 0.5, releaseSec: 0.1, recoverySec: 0.4 });
    expect(beats[1].at).toBe(0.5);
    expect(beats[2].at).toBe(0.5);
  });

  it('walks to the goal without passing it', () => {
    const mid = approachPoint({ x: 0, z: 0 }, { x: 10, z: 0 }, 3, 1);
    expect(mid.x).toBeCloseTo(3, 9);
    expect(mid.arrived).toBe(false);
    const end = approachPoint({ x: 9.9, z: 0 }, { x: 10, z: 0 }, 3, 1);
    expect(end).toEqual({ x: 10, z: 0, arrived: true });
  });
});
