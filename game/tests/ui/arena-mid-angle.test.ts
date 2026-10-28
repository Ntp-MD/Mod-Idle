import { describe, expect, it } from 'vitest';
import { arenaFacingIndex, arenaScreenAngleFor, ARENA_DIRECTIONS } from '../../src/presentation/arena-camera';
import { groundShapePath } from '../../src/ui/combat/arena-vfx-space';
import { projectArenaPoint } from '../../src/ui/combat/combat-arena-view';
import { skillAreaSnapshot } from '@engine/skill-area.ts';
import { sm } from '../../src/engine/client';

const STEP = Math.PI / 4;
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

function points(path: string) {
  return [...path.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
}

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

  it('keeps the canonical piercing line exact at 16 angles, not snapped to the actor bins', () => {
    const piercing = sm.byId['attack.piercing_shot'];
    expect(piercing.area).toMatchObject({ shape: 'line', length_m: 5.2, width_m: .75 });
    const length = piercing.area?.length_m ?? 0;
    const half = (piercing.area?.width_m ?? 0) / 2;
    const line = { origin: 'caster' as const, radius_m: 0, shape: 'line' as const, length_m: length, width_m: half * 2 };
    const seen = new Set<string>();
    for (let index = 0; index < 16; index++) {
      const direction = index * STEP / 2;
      const caster = { x: 9, y: 6 };
      const aim = { x: caster.x + Math.cos(direction) * length, y: caster.y + Math.sin(direction) * length };
      const area = skillAreaSnapshot(line, caster, aim, 'a');
      const path = groundShapePath(area);
      seen.add(path);
      const actual = points(path);
      const corners = [
        { lateral: -half, forward: 0 }, { lateral: -half, forward: length },
        { lateral: half, forward: length }, { lateral: half, forward: 0 },
      ];
      corners.forEach((corner, cornerIndex) => {
        const expected = projectArenaPoint({
          x: caster.x - corner.lateral * Math.sin(direction) + corner.forward * Math.cos(direction),
          y: caster.y + corner.lateral * Math.cos(direction) + corner.forward * Math.sin(direction),
        });
        expect(actual[cornerIndex].x).toBeCloseTo(expected.x, 0);
        expect(actual[cornerIndex].y).toBeCloseTo(expected.y, 0);
      });
    }
    expect(seen.size).toBe(16);
  });

  it('keeps the canonical cleave 120-degree edges exact at 16 angles', () => {
    const cleave = sm.byId['attack.cleave'];
    expect(cleave.area).toMatchObject({ shape: 'cone', angle_deg: 120, radius_m: 2.1 });
    const reach = cleave.area?.radius_m ?? 0;
    const cone = { origin: 'caster' as const, radius_m: reach, shape: 'cone' as const, angle_deg: 120 };
    const seen = new Set<string>();
    for (let index = 0; index < 16; index++) {
      const direction = index * STEP / 2;
      const caster = { x: 9, y: 6 };
      const aim = { x: caster.x + Math.cos(direction) * reach, y: caster.y + Math.sin(direction) * reach };
      const area = skillAreaSnapshot(cone, caster, aim, 'a');
      const path = groundShapePath(area);
      seen.add(path);
      const actual = points(path);
      for (const [position, offset] of [[1, -Math.PI / 3], [actual.length - 1, Math.PI / 3]] as const) {
        const expected = projectArenaPoint({
          x: caster.x + Math.cos(direction + offset) * reach,
          y: caster.y + Math.sin(direction + offset) * reach,
        });
        expect(actual[position].x).toBeCloseTo(expected.x, 0);
        expect(actual[position].y).toBeCloseTo(expected.y, 0);
      }
    }
    expect(seen.size).toBe(16);
  });
});
