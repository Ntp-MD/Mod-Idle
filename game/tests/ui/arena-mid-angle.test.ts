import { describe, expect, it } from 'vitest';
import { arenaFacingIndex, arenaScreenAngleFor, ARENA_DIRECTIONS } from '../../src/presentation/arena-camera';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { applyWorldToViewport, fieldPointM } from '../../src/presentation/view-transform';
import { groundShapeWorldPoints } from '../../src/ui/combat/arena-vfx-space';
import { skillAreaSnapshot } from '@engine/skill-area.ts';

const STEP = Math.PI / 4;
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

const frameFor = () => {
  const frame = createFieldViewFrame({
    sceneKey: 'mid-angle', atUs: 0,
    viewportCss: { width: 1920, height: 1080 },
    focusM: fieldPointM(9, 6), worldScale: 1,
  });
  if (!frame.renderable) throw new Error('frame must render');
  return frame;
};

describe('mid-angle presentation', () => {
  it('keeps the 8-bin actor row inside half a screen step for 16 sampled facings', () => {
    for (let index = 0; index < 16; index++) {
      const facing = index * STEP / 2 + 0.017;
      const row = arenaFacingIndex(facing);
      const screen = arenaScreenAngleFor({ x: Math.cos(facing), y: Math.sin(facing) });
      const error = Math.abs(wrap(screen - row * STEP));
      expect(ARENA_DIRECTIONS[row]).toBeDefined();
      expect(error).toBeLessThanOrEqual(STEP / 2 + 1e-9);
    }
  });

  it('keeps line geometry exact at sampled angles', () => {
    const frame = frameFor();
    const project = (point: { x: number; y: number }) =>
      applyWorldToViewport(frame.worldToViewport, fieldPointM(point.x, point.y));
    const length = 5;
    const half = 0.5;
    const line = { origin: 'caster' as const, radius_m: 0, shape: 'line' as const, length_m: length, width_m: half * 2 };
    const seen = new Set<string>();
    for (let index = 0; index < 16; index++) {
      const direction = index * STEP / 2;
      const caster = { x: 9, y: 6 };
      const aim = { x: caster.x + Math.cos(direction) * length, y: caster.y + Math.sin(direction) * length };
      const area = skillAreaSnapshot(line, caster, aim, 'a');
      const actual = groundShapeWorldPoints(area);
      seen.add(JSON.stringify(actual));
      const corners = [
        { lateral: -half, forward: 0 }, { lateral: -half, forward: length },
        { lateral: half, forward: length }, { lateral: half, forward: 0 },
      ];
      corners.forEach((corner, cornerIndex) => {
        const expectedWorld = {
          x: caster.x - corner.lateral * Math.sin(direction) + corner.forward * Math.cos(direction),
          y: caster.y + corner.lateral * Math.cos(direction) + corner.forward * Math.sin(direction),
        };
        expect(actual[cornerIndex].x).toBeCloseTo(expectedWorld.x, 9);
        expect(actual[cornerIndex].y).toBeCloseTo(expectedWorld.y, 9);
        // The painted frame projects the same world corners 1:1.
        const painted = project(actual[cornerIndex]);
        const ref = project(expectedWorld);
        expect(painted.x).toBeCloseTo(ref.x, 9);
        expect(painted.y).toBeCloseTo(ref.y, 9);
      });
    }
    expect(seen.size).toBe(16);
  });

  it('keeps cone edges exact at sampled angles', () => {
    const reach = 2.1;
    const cone = { origin: 'caster' as const, radius_m: reach, shape: 'cone' as const, angle_deg: 120 };
    const seen = new Set<string>();
    for (let index = 0; index < 16; index++) {
      const direction = index * STEP / 2;
      const caster = { x: 9, y: 6 };
      const aim = { x: caster.x + Math.cos(direction) * reach, y: caster.y + Math.sin(direction) * reach };
      const area = skillAreaSnapshot(cone, caster, aim, 'a');
      const actual = groundShapeWorldPoints(area);
      seen.add(JSON.stringify(actual));
      for (const [position, offset] of [[1, -Math.PI / 3], [actual.length - 1, Math.PI / 3]] as const) {
        const expectedWorld = {
          x: caster.x + Math.cos(direction + offset) * reach,
          y: caster.y + Math.sin(direction + offset) * reach,
        };
        expect(actual[position].x).toBeCloseTo(expectedWorld.x, 9);
        expect(actual[position].y).toBeCloseTo(expectedWorld.y, 9);
      }
    }
    expect(seen.size).toBe(16);
  });
});
