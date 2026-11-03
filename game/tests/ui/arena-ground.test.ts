import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ArenaGround from '../../src/ui/combat/ArenaGround.svelte';
import { arenaArt } from '../../src/ui/combat/arena/arena-art';
import { arenaGroundForField, arenaGroundMaterials } from '../../src/ui/combat/arena/arena-ground-materials';
import { ARENA_VIEW, arenaCameraOffset, projectArenaPoint, projectArenaVector } from '../../src/presentation/arena-camera';

describe('world-projected arena ground', () => {
  it.each([
    [1, 0, 'meadow'], [2, 0, 'mountain'], [2, 2, 'snow'], [3, 1, 'marsh'],
    [4, 0, 'desert'], [4, 1, 'tomb'], [8, 0, 'cave'], [9, 2, 'volcanic'],
    [11, 2, 'rift'], [12, 1, 'volcanic'], [13, 1, 'ruins'], [15, 0, 'coast'], [16, 1, 'forest'],
  ] as const)('selects zone %i subzone %i as %s from authored environment', (zone, sub, expected) => {
    const state = { zone, cell: { q: 0, r: 0, sub, site: null }, dungeon: null };
    expect(arenaGroundForField(state).id).toBe(expected);
    expect(state.cell.sub).toBe(sub);
  });

  it('uses standing terrain on bare ground and retains one projected texture for every family', () => {
    const state = { zone: 1, cell: { q: 0, r: 0, sub: null, site: null, terrain: 'marsh' }, dungeon: null };
    expect(arenaGroundForField(state)).toBe(arenaGroundMaterials.marsh);
    for (const material of Object.values(arenaGroundMaterials)) {
      const body = render(ArenaGround, { props: { camera: { x: 0, y: 0 }, material } }).body;
      expect(body).toContain(`data-ground-material="${material.id}"`);
      expect(body).toContain(material.href);
      expect(body.match(/<image\b/g)).toHaveLength(1);
      expect(body).toContain('patternTransform="matrix(');
    }
  });

  it('uses the exact actor/skill projection for an unprojected surface image', () => {
    const camera = arenaCameraOffset({ x: 23.4, y: 16.2256 });
    const body = render(ArenaGround, { props: { camera, material: arenaArt.background } }).body;
    const matrix = body.match(/patternTransform="matrix\(([^)]+)\)"/)![1].split(/\s+/).map(Number);
    const [a, b, c, d, e, f] = matrix;
    for (const world of [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 8 }, { x: 50, y: 32.0513 }]) {
      const expected = projectArenaPoint(world);
      expect(a * world.x + c * world.y + e).toBeCloseTo(expected.x, 8);
      expect(b * world.x + d * world.y + f).toBeCloseTo(expected.y, 8);
    }
    const tileStep = projectArenaVector({ x: arenaArt.background.tileSizeM, y: 0 });
    expect(a * arenaArt.background.tileSizeM).toBeCloseTo(tileStep.x, 8);
    expect(b * arenaArt.background.tileSizeM).toBeCloseTo(tileStep.y, 8);
    expect(body).toContain('patternUnits="userSpaceOnUse"');
    expect(body).toContain(arenaArt.background.href);
  });

  it('covers the displayed camera window at every field edge without stretching a world-size painting', () => {
    for (const player of [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 0, y: 32.0513 }, { x: 50, y: 32.0513 }]) {
      const camera = arenaCameraOffset(player);
      const body = render(ArenaGround, { props: { camera, material: arenaArt.background } }).body;
      const box = body.match(/viewBox="([^"]+)"/)![1].split(/\s+/).map(Number);
      expect(box).toEqual([camera.x, camera.y, ARENA_VIEW.width, ARENA_VIEW.height]);
      expect(body).toContain(`x="${camera.x}" y="${camera.y}" width="1920" height="1080"`);
      const projected = projectArenaPoint(player);
      expect(projected.x - box[0]).toBeCloseTo(ARENA_VIEW.width / 2, 8);
      expect(projected.y - box[1]).toBeCloseTo(ARENA_VIEW.height / 2, 8);
      expect(body.match(/<image\b/g)).toHaveLength(1);
    }
  });
});
