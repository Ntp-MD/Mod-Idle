import { describe, expect, it } from 'vitest';
import { targetsInSkillArea } from '@engine/skill-actions.ts';
import { skillAreaSnapshot } from '@engine/skill-area.ts';
import type { SkillAreaDefinition } from '@engine/types.ts';
import { unprojectArenaPoint } from '../../src/presentation/arena-camera';
import { groundShapePath, projectVfxFootprint } from '../../src/ui/combat/arena-vfx-space';

type Point = { x: number; y: number };
const caster = { x: 25, y: 16 };
const body = (id: string, x: number, y: number) => ({ id, x, y, radiusM: 0 });

/** Parse the projected `M/L…Z` path back into world meters through the inverse camera. */
function worldPath(path: string): Point[] {
  return [...path.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)]
    .map((match) => unprojectArenaPoint({ x: Number(match[1]), y: Number(match[2]) }));
}
const near = (a: number, b: number, tolerance = 0.08): boolean => Math.abs(a - b) <= tolerance;

const line: SkillAreaDefinition = { origin: 'caster', radius_m: 0, shape: 'line', length_m: 6, width_m: 1.2 };
const cone: SkillAreaDefinition = { origin: 'caster', radius_m: 4, shape: 'cone', angle_deg: 120 };
const circle: SkillAreaDefinition = { origin: 'target', radius_m: 3 };
const self: SkillAreaDefinition = { origin: 'caster', radius_m: 2.5 };

describe('the drawn skill footprint is the hit footprint', () => {
  it('draws the line rectangle the hit test uses', () => {
    const area = skillAreaSnapshot(line, caster, { x: caster.x + 6, y: caster.y }, '');
    expect(area.shape).toBe('line');
    expect(area.widthM).toBe(1.2);
    const corners = worldPath(groundShapePath(area));
    expect(corners).toHaveLength(4);
    const expected = [
      { x: caster.x, y: caster.y - 0.6 }, { x: caster.x + 6, y: caster.y - 0.6 },
      { x: caster.x + 6, y: caster.y + 0.6 }, { x: caster.x, y: caster.y + 0.6 },
    ];
    for (const [index, corner] of corners.entries()) {
      expect(near(corner.x, expected[index].x)).toBe(true);
      expect(near(corner.y, expected[index].y)).toBe(true);
    }
    expect(targetsInSkillArea(area, [body('inside', caster.x + 3, caster.y + 0.5)])).toHaveLength(1);
    expect(targetsInSkillArea(area, [body('wide', caster.x + 3, caster.y + 0.7)])).toHaveLength(0);
    expect(targetsInSkillArea(area, [body('behind', caster.x - 0.2, caster.y)])).toHaveLength(0);
  });

  it('draws the cone wedge the hit test uses', () => {
    const area = skillAreaSnapshot(cone, caster, { x: caster.x + 4, y: caster.y }, '');
    expect(area.angleDeg).toBe(120);
    const points = worldPath(groundShapePath(area));
    expect(near(points[0].x, caster.x) && near(points[0].y, caster.y)).toBe(true);
    for (const point of points.slice(1)) {
      expect(near(Math.hypot(point.x - caster.x, point.y - caster.y), 4)).toBe(true);
      const angle = Math.atan2(point.y - caster.y, point.x - caster.x);
      expect(Math.abs(angle)).toBeLessThanOrEqual(Math.PI / 3 + 1e-3);
    }
    const edge = (Math.PI / 3 - 0.02);
    expect(targetsInSkillArea(area, [body('inside', caster.x + Math.cos(edge) * 3, caster.y + Math.sin(edge) * 3)])).toHaveLength(1);
    expect(targetsInSkillArea(area, [body('outside', caster.x + Math.cos(Math.PI / 3 + 0.02) * 3, caster.y + Math.sin(Math.PI / 3 + 0.02) * 3)])).toHaveLength(0);
  });

  it('draws a target circle on the aimed point and a self circle on the caster', () => {
    const aimed = skillAreaSnapshot(circle, caster, { x: 30, y: 18 }, '');
    expect(aimed.center).toEqual({ x: 30, y: 18 });
    for (const point of worldPath(groundShapePath(aimed))) {
      expect(near(Math.hypot(point.x - 30, point.y - 18), 3)).toBe(true);
    }
    const around = skillAreaSnapshot(self, caster, { x: 30, y: 18 }, '');
    expect(around.center).toEqual(caster);
    expect(targetsInSkillArea(around, [body('near', caster.x + 2, caster.y)])).toHaveLength(1);
    expect(targetsInSkillArea(around, [body('far', caster.x + 2.6, caster.y)])).toHaveLength(0);
  });

  it('hands the authored VFX footprint the same direction, width and reach', () => {
    const area = skillAreaSnapshot(cone, caster, { x: caster.x + 4, y: caster.y }, '');
    const footprint = projectVfxFootprint(area)!;
    expect(footprint.shape).toBe('cone');
    expect(footprint.directionRad).toBeCloseTo(area.directionRad!, 9);
    expect(footprint.lengthM).toBe(4);
    expect(footprint.worldCenter).toEqual(area.center);
    const strip = projectVfxFootprint(skillAreaSnapshot(line, caster, { x: caster.x + 6, y: caster.y }, ''))!;
    expect(strip.shape).toBe('line');
    expect(strip.widthM).toBe(1.2);
    expect(strip.lengthM).toBe(6);
  });
});
