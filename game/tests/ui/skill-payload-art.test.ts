import { describe, expect, it } from 'vitest';
import { createCombatArena, type CombatArenaAction } from '@sim/combat/combat-arena';
import { projectSkillGeometry, skillActionGeometry, skillPayloadGeometry } from '../../src/ui/combat/skill-geometry';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { fieldPointM } from '../../src/presentation/view-transform';
import type { CombatFlight } from '@sim/combat/combat-actions';

const units = 1_000_000;
const BODY_M = { width: 60 / 140, height: 132 / 140 };
function fixture(skillId = 'attack.double_strafe') {
  const arena = createCombatArena();
  const action: CombatArenaAction = {
    id: 1, kind: 'cast', actorId: 'player', skillId, targetId: 'target',
    x: 0, y: 0, targetX: 4, targetY: 0, atUs: 0, endsAtUs: 4 * units,
    area: { origin: 'target', radiusM: 0, center: { x: 4, y: 0 } },
    timing: { delivery: 'projectile', startedAtUs: 0, releaseAtUs: units,
      impactAtUs: 2 * units, recoveryUntilUs: 3 * units },
    payloads: [0, 1, 2].map(index => ({ index, source: { x: 0, y: 0 }, destination: { x: 4, y: index },
      releaseAtUs: units + index * units / 2, plannedImpactAtUs: 2 * units + index * units / 2 })),
  };
  return { arena, action };
}
const frameFor = () => createFieldViewFrame({
  sceneKey: 'test', atUs: 0,
  viewportCss: { width: 1920, height: 1080 },
  focusM: fieldPointM(0, 0), worldScale: 1,
});
function marks(action: CombatArenaAction, arena: ReturnType<typeof createCombatArena>, time: number) {
  return skillPayloadGeometry(skillActionGeometry(action, arena, time, units)!, action, time, units, .4);
}
describe('committed payload art', () => {
  it('shows only released shots, with independent flight progress and anchors', () => {
    const { action, arena } = fixture();
    const result = marks(action, arena, 1.75 * units);
    expect(result).toHaveLength(2);
    expect(result.map(mark => mark.progress)).toEqual([.75, .25]);
    expect(result.map(mark => mark.target.y)).toEqual([0, 1]);
    expect(new Set(result.map(mark => mark.key)).size).toBe(2);
  });
  it('restarts contact frames on each receipt and never moves later shots onto an earlier interceptor', () => {
    const { action, arena } = fixture();
    Object.assign(action.payloads![0], { impactAtUs: 1.8 * units, contact: { x: 2, y: .4 } });
    const result = marks(action, arena, 2.1 * units);
    expect(result.map(mark => mark.phase)).toEqual(['Impact', 'Travel', 'Travel']);
    expect(result[0].phaseElapsedSec).toBe(.3);
    expect(result[0].area.center).toEqual({ x: 2, y: .4 });
    expect(result[1].area.center).toEqual({ x: 4, y: 1 });
    expect(marks(action, arena, 2.3 * units).map(mark => mark.key)).not.toContain(result[0].key);
  });
  it('removes a cancelled shot at its terminal receipt without a fake impact', () => {
    const { action, arena } = fixture();
    Object.assign(action.payloads![0], { impactAtUs: 1.8 * units, cancelReason: 'target-lost' });
    expect(marks(action, arena, 1.7 * units)).toHaveLength(2);
    expect(marks(action, arena, 1.9 * units).map(mark => mark.key)).toEqual(['action-1-payload-1']);
  });
  it('uses actual chain-hop origins and destinations, without drawing future hops', () => {
    const frame = frameFor();
    const { action, arena } = fixture('attack.chain_lightning');
    action.payloads = [
      { index: 0, source: { x: 0, y: 0 }, destination: { x: 2, y: 0 }, releaseAtUs: units, plannedImpactAtUs: units },
      { index: 1, source: { x: 2, y: 0 }, destination: { x: 3, y: 1 }, releaseAtUs: units, plannedImpactAtUs: 1.08 * units },
    ];
    const before = JSON.stringify(action);
    const result = marks(action, arena, 1.04 * units);
    expect(result).toHaveLength(2);
    const hop = result[1];
    expect(hop.chainHop).toBe(true);
    expect(hop.progress).toBe(.5);
    // World hop spans stay in metres; the frame adapter lifts both ends to body centres.
    expect(hop.paths[0].from).toEqual({ x: 2, y: 0 });
    expect(hop.paths[0].to).toEqual(hop.vfxAim.groundImpactM);
    const screen = projectSkillGeometry(hop, frame)!;
    expect(screen.paths[0].to).toEqual(screen.vfxAim.impact);
    expect(screen.paths[0].from.y).toBeLessThan(screen.paths[0].to.y + 1);
    expect(JSON.stringify(action)).toBe(before);
  });
  it('keeps the single casting mark before release', () => {
    const { action, arena } = fixture();
    expect(marks(action, arena, .5 * units).map(mark => mark.key)).toEqual(['action-1']);
  });
  it('follows a homing flight sample without mutating its immutable launch receipt', () => {
    const frame = frameFor();
    const { action, arena } = fixture();
    const before = JSON.stringify(action);
    const atUs = 1.75 * units;
    const live = { actionId: action.id, impactIndex: 0, homing: true,
      position: { x: 2, y: 1 }, destination: { x: 4, y: 2 },
      lastCheckedAtUs: 1.5 * units, timing: { impactAtUs: 2 * units } } as CombatFlight;
    const base = skillActionGeometry(action, arena, atUs, units)!;
    const result = skillPayloadGeometry(base, action, atUs, units, .4, [live])[0];
    // World release follows the sampled flight position; the adapter lifts it to body centre.
    expect(result.vfxAim.releaseM).toEqual({ x: 3, y: 1.5 });
    expect(result.vfxAim.groundImpactM).toEqual({ x: 4, y: 2 });
    const screen = projectSkillGeometry(result, frame)!;
    expect(screen.vfxAim.release.y).toBeLessThan(screen.vfxAim.groundImpact.y);
    expect(JSON.stringify(action)).toBe(before);
  });
});
