import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ArenaGround from '../../src/ui/combat/ArenaGround.svelte';
import CombatArenaScene from '../../src/ui/combat/CombatArenaScene.svelte';
import { arenaArt } from '../../src/ui/combat/arena/arena-art';
import { arenaGroundForField, arenaGroundMaterials } from '../../src/ui/combat/arena/arena-ground-materials';
import { ARENA_CAMERA, ARENA_VIEW, arenaZoomView, projectArenaPoint, projectArenaVector, unprojectArenaPoint } from '../../src/presentation/arena-camera';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { applyWorldToViewport, applyWorldVector, fieldPointM, fieldVectorM, isUniformScale } from '../../src/presentation/view-transform';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame } from '@sim/core/game';

const groundFrame = (focus = { x: 25, y: 16 }, worldScale = 1, viewportCss = ARENA_VIEW) =>
  createFieldViewFrame({ sceneKey: 'test:ground', atUs: 0, viewportCss,
    focusM: fieldPointM(focus.x, focus.y), worldScale });

describe('world-projected arena ground', () => {
  it('uses one dynamic scale for both screen axes, actors and world radii', () => {
    const viewport = { width: 1920, height: 946 };
    const radius = Math.hypot(...Object.values(projectArenaVector({ x: 3, y: 0 })));
    for (const worldScale of [.5, .75, 1, 1.5, 2]) {
      const view = arenaZoomView(worldScale, viewport);
      const scale = viewport.width / view.width;
      expect(viewport.height / view.height).toBeCloseTo(scale, 10);
      const actorWidth = 70 * worldScale;
      expect(radius * scale / actorWidth).toBeCloseTo(6, 10);
      expect(actorWidth).toBeCloseTo(70 * worldScale, 10);
    }
    expect(arenaZoomView(1, { width: 0, height: 0 })).toEqual(ARENA_VIEW);
  });

  it('keeps north up and applies the camera elevation to the ground axes', () => {
    const right = projectArenaVector({ x: 1, y: 0 }), down = projectArenaVector({ x: 0, y: 1 });
    expect(right.y).toBe(0);
    expect(down.x).toBe(0);
    expect(down.y / right.x).toBeCloseTo(ARENA_CAMERA.projection.d / ARENA_CAMERA.projection.a, 8);
    expect(right.x).toBeGreaterThan(0);
    const world = { x: 13.25, y: 17.125 };
    const roundTrip = unprojectArenaPoint(projectArenaPoint(world));
    expect(roundTrip.x).toBeCloseTo(world.x, 8);
    expect(roundTrip.y).toBeCloseTo(world.y, 8);
  });
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
      const body = render(ArenaGround, { props: { frame: groundFrame(), material } }).body;
      expect(body).toContain(`data-ground-material="${material.id}"`);
      expect(body).toContain(material.href);
      expect(body.match(/<image\b/g)).toHaveLength(1);
      expect(body).toContain('patternTransform="matrix(');
    }
  });

  it('uses the exact actor/skill projection for an unprojected surface image', () => {
    for (const scale of [.25, .5, 1, 2]) {
      const frame = groundFrame({ x: 23.4, y: 16.2256 }, scale, { width: 1377.5, height: 756.25 });
      if (!frame.renderable) throw new Error('Expected a visible frame');
      const body = render(ArenaGround, { props: { frame, material: arenaArt.background } }).body;
      const [a, b, c, d, e, f] = body.match(/patternTransform="matrix\(([^)]+)\)"/)![1].split(/\s+/).map(Number);
      for (const world of [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 8 }, { x: 50, y: 32.0513 }]) {
        const expected = applyWorldToViewport(frame.worldToViewport, fieldPointM(world.x, world.y));
        expect(a * world.x + c * world.y + e).toBeCloseTo(expected.x, 8);
        expect(b * world.x + d * world.y + f).toBeCloseTo(expected.y, 8);
      }
      expect(body).toContain('patternUnits="userSpaceOnUse"');
      expect(body).toContain(arenaArt.background.href);
    }
  });

  it('covers the displayed camera window at every field edge without stretching a world-size painting', () => {
    for (const player of [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 0, y: 32.0513 }, { x: 50, y: 32.0513 }]) {
      const frame = groundFrame(player);
      if (!frame.renderable) throw new Error('Expected a visible frame');
      const body = render(ArenaGround, { props: { frame, material: arenaArt.background } }).body;
      const box = body.match(/viewBox="([^"]+)"/)![1].split(/\s+/).map(Number);
      expect(box).toEqual([0, 0, ARENA_VIEW.width, ARENA_VIEW.height]);
      expect(body).toContain('x="0" y="0" width="1920" height="1080"');
      const projected = applyWorldToViewport(frame.worldToViewport, fieldPointM(player.x, player.y));
      expect(projected.x).toBeCloseTo(frame.anchorCss.x, 8);
      expect(projected.y).toBeCloseTo(frame.anchorCss.y, 8);
      expect(body.match(/<image\b/g)).toHaveLength(1);
    }
  });
});

describe('field view frame shared scale (WP1 A2-A3)', () => {
  it('keeps the 0.5 m actor to 3 m area ratio at 6 across the allowed scales', () => {
    for (const scale of [0.5, 0.75, 1, 1.5, 2]) {
      const frame = createFieldViewFrame({
        sceneKey: 'test:ground', atUs: 0,
        viewportCss: { width: 1920, height: 946 },
        focusM: fieldPointM(25, 16), worldScale: scale,
      });
      expect(frame.renderable).toBe(true);
      if (!frame.renderable) continue;
      expect(frame.cssPixelsPerMeter).toBeCloseTo(140 * scale, 10);
      expect(isUniformScale(frame.worldToViewport)).toBe(false);
      const actor = applyWorldVector(frame.worldToViewport, fieldVectorM(0.5, 0));
      const area = applyWorldVector(frame.worldToViewport, fieldVectorM(3, 0));
      expect(Math.hypot(area.x, area.y) / Math.hypot(actor.x, actor.y)).toBeCloseTo(6, 8);
      // The shared zoom preserves the camera elevation independently of stage aspect.
      expect(frame.worldToViewport.d / frame.worldToViewport.a).toBeCloseTo(ARENA_CAMERA.projection.d / ARENA_CAMERA.projection.a, 8);
      expect(frame.worldToViewport.b).toBe(0);
      expect(frame.worldToViewport.c).toBe(0);
    }
  });

  it('leaves a hidden view unpainted without pausing the simulation', () => {
    const state = newGame(42), arena = createCombatArena();
    const c = characterSheet(state);
    syncCombatArena(arena, state, 0, 1_000_000, c.maxHp);
    const hidden = createFieldViewFrame({
      sceneKey: 'test:hidden', atUs: 0,
      viewportCss: { width: 0, height: 1080 },
      focusM: fieldPointM(25, 16), worldScale: 1,
    });
    expect(hidden.renderable).toBe(false);
    const body = render(CombatArenaScene, { props: { arena, s: state, c, ring: [], iconActors: true, frame: hidden } }).body;
    expect(body).toContain('data-frame-renderable="false"');
    expect(body).not.toContain('data-world-ground');
    expect(body).not.toContain('data-arena-actor');
    expect(body).not.toContain('arena-ground-command');
    // A live frame paints the same ground and bodies the camera used to own.
    const live = createFieldViewFrame({
      sceneKey: 'test:live', atUs: 0,
      viewportCss: { width: 1920, height: 1080 },
      focusM: fieldPointM(arena.player.x, arena.player.y), worldScale: 0.75,
    });
    const painted = render(CombatArenaScene, { props: { arena, s: state, c, ring: [], iconActors: true, frame: live } }).body;
    expect(painted).toContain('data-frame-renderable="true"');
    expect(painted).toContain('data-world-ground');
    expect(painted).toContain('data-arena-actor="player"');
  });
});
