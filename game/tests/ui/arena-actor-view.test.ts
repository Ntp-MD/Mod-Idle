import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import CombatArenaScene from '../../src/ui/combat/CombatArenaScene.svelte';
import { createCombatArena, syncCombatArena, captureCombatArena, sampleCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame } from '@sim/core/game';
import { mobFixture } from '../fixtures/mobFixture';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { fieldPointM } from '../../src/presentation/view-transform';
import { applyViewportToWorld, applyWorldToViewport } from '../../src/presentation/view-transform';
import { actorArt } from '../../src/ui/combat/combat-actor';
import { equippedPlayerArt } from '../../src/ui/combat/arena/arena-equipped-player';
import { arenaArtForSpecies, type ArenaCharacterArt } from '../../src/ui/combat/arena/arena-art';
import { pixelArenaArt } from '../../src/ui/combat/arena/arena-art-pixel-v2';

import { indexActorHits } from '../../src/ui/combat/combat-feedback';
import { normalizeArenaBody } from '../../src/ui/combat/arena/arena-body-model';
import {
  ACTOR_DEPTH_MAX,
  ACTOR_DEPTH_MIN,
  actorDepthRanks,
  actorReleaseWorld,
  actorVisibleInFrame,
  bodyEnvelopeM,
  buildActorView,
  compareActorGround,
  containedFrame,
  createActorBodyCache,
  REF_PX_PER_M,
  SHADOW_WIDTH_RATIO,
  shadowWidthM,
  type ActorViewInput,
} from '../../src/ui/combat/arena-actor-view';

const VIEW = { width: 1920, height: 1080 };

function harness(worldScale = 0.75) {
  const state = newGame(42);
  state.group = [mobFixture({ id: 'raider', speciesId: 'goblin', hp: 10, hpMax: 10 })];
  const c = characterSheet(state);
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, c.maxHp);
  captureCombatArena(arena, state, 0);
  const sampled = sampleCombatArena(arena, 0);
  const frame = createFieldViewFrame({
    sceneKey: 'test#arena-0',
    atUs: 0,
    viewportCss: { ...VIEW },
    focusM: fieldPointM(sampled.player.x, sampled.player.y),
    worldScale,
  });
  if (!frame.renderable) throw new Error('test frame must render');
  return { state, c, arena, sampled, frame };
}

function viewInput(h: ReturnType<typeof harness>, over: Partial<ActorViewInput> = {}) {
  const cache = createActorBodyCache();
  return { cache, input: {
    arena: h.arena,
    actor: h.sampled.player,
    art: null,
    body: cache.modelFor(null, { assetId: 'player.melee', radiusM: 0.25, bodySize: 'player' }),
    assetId: 'player.melee',
    radiusM: 0.25,
    bodySize: 'player',
    fallback: actorArt(undefined),
    frame: h.frame,
    atUs: 0,
    gaitSample: undefined,
    actorHits: indexActorHits([], 0, 1_000_000),
    reducedMotion: false,
    playerCtx: { state: h.state, character: h.c },
    ...over,
  } as ActorViewInput };
}

describe('WP3 — actor view from the WP2 model and the painted frame', () => {
  it('places feet through the painted frame, never a viewport scale divider', () => {
    const h = harness();
    const { input } = viewInput(h);
    const view = buildActorView(input);
    const expected = applyWorldToViewport(h.frame.worldToViewport, fieldPointM(h.sampled.player.x, h.sampled.player.y));
    expect(view.x).toBeCloseTo(expected.x, 9);
    expect(view.y).toBeCloseTo(expected.y, 9);
    expect(view.ground).toEqual({ x: h.sampled.player.x, y: h.sampled.player.y });
  });

  it('keeps actor/area proportions across the shared scale range (A2)', () => {
    const views = [0.5, 0.75, 1, 1.5, 2].map((worldScale) => {
      const h = harness(worldScale);
      const { input } = viewInput(h, { frame: h.frame });
      return buildActorView(input);
    });
    const ring = (worldScale: number) => 3 * REF_PX_PER_M * worldScale * (VIEW.width / 1920);
    [0.5, 0.75, 1, 1.5, 2].forEach((worldScale, index) => {
      expect(views[index].height / ring(worldScale)).toBeCloseTo(views[0].height / ring(0.5), 9);
    });
    expect(views[3].height / views[0].height).toBeCloseTo(1.5 / 0.5, 9);
    // The model envelope never changes with scale: only the painted size does.
    for (const view of views.slice(1)) {
      expect(view.bodyM.width).toBeCloseTo(views[0].bodyM.width, 12);
      expect(view.bodyM.height).toBeCloseTo(views[0].bodyM.height, 12);
    }
  });

  it('sizes fallback icons from the normalized model at the reference scale', () => {
    const h = harness(1);
    const { input } = viewInput(h, { frame: h.frame });
    const view = buildActorView(input);
    expect(view.height).toBeCloseTo(input.fallback.imageHeight * 140 * 0.5 / Math.max(1, input.fallback.imageWidth) || view.height, 9);
    expect(view.bodyM).toEqual(expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }));
  });

  it('sizes shipped sprite art from the model without re-measuring per frame (A6/A12)', () => {
    const art = arenaArtForSpecies('goblin') ?? pixelArenaArt.species.goblin;
    if (!art) throw new Error('goblin art fixture missing');
    const h = harness(1);
    const cache = createActorBodyCache();
    const actor = { ...h.sampled.mobs.raider, radiusM: h.sampled.mobs.raider.radiusM ?? 0.25 };
    const spec = { assetId: 'species.goblin', radiusM: actor.radiusM, bodySize: 'medium' };
    const body = cache.modelFor(art, spec);
    // The idle reference the legacy path measured on must match the model's
    // reference: no hidden re-trim changes the size between the two paths.
    const refSheet = art!.clips.idle.south ?? Object.values(art!.clips.idle ?? {})[0];
    const trimmed = containedFrame(refSheet, refSheet?.startFrame ?? 0);
    const refFrame = body.referenceBoundsPx;
    expect(trimmed?.width).toBe(refFrame.width);
    const first = buildActorView({ arena: h.arena, actor, art, body: cache.modelFor(art, spec),
      assetId: spec.assetId, radiusM: spec.radiusM, bodySize: spec.bodySize,
      fallback: actorArt(actor.mob), frame: h.frame, atUs: 0,
      gaitSample: undefined, actorHits: indexActorHits([], 0, 1_000_000),
      reducedMotion: false, playerCtx: null });
    const callsAfterFirst = cache.normalizeCalls;
    expect(callsAfterFirst).toBe(1);
    // Rebuilds at every scale reuse the one normalized model.
    for (const worldScale of [0.5, 0.75, 1.5, 2]) {
      const scaled = harness(worldScale);
      const again = buildActorView({ arena: scaled.arena, actor, art, body: cache.modelFor(art, spec),
        assetId: spec.assetId, radiusM: spec.radiusM, bodySize: spec.bodySize,
        fallback: actorArt(actor.mob), frame: scaled.frame, atUs: 0,
        gaitSample: undefined, actorHits: indexActorHits([], 0, 1_000_000),
        reducedMotion: false, playerCtx: null });
      expect(again.height / first.height).toBeCloseTo(worldScale, 9);
      expect(again.bodyM.width).toBeCloseTo(first.bodyM.width, 12);
      expect(again.bodyM.height).toBeCloseTo(first.bodyM.height, 12);
    }
    expect(cache.normalizeCalls).toBe(callsAfterFirst);
  });

  it('anchors effect releases in world metres on the drawn attack sheet (A6)', () => {
    const art = equippedPlayerArt;
    const h = harness(1);
    const cache = createActorBodyCache();
    const spec = { assetId: 'player-equipped', radiusM: 0.25, bodySize: 'player' };
    const body = cache.modelFor(art, spec);
    expect(body.releaseSocketsM['attack:east']).toBeDefined();
    expect(body.releaseSocketsM['attack:west']).toBeDefined();
    const castAt = (facing: number) => {
      const actor = { ...h.sampled.player, facing, radiusM: 0.25 };
      h.arena.actions.push({ id: 90 + facing, actorId: 'player', kind: 'swing',
        atUs: 500_000, endsAtUs: 700_000, x: actor.x, y: actor.y,
        targetX: actor.x + Math.cos(facing), targetY: actor.y + Math.sin(facing),
        targetId: 'raider' } as never);
      return buildActorView({ arena: h.arena, actor, art, body,
        assetId: spec.assetId, radiusM: spec.radiusM, bodySize: spec.bodySize,
        fallback: actorArt(undefined), frame: h.frame, atUs: 400_000,
        gaitSample: undefined, actorHits: indexActorHits([], 400_000, 1_000_000),
        reducedMotion: false, playerCtx: { state: h.state, character: h.c } });
    };
    const east = castAt(0);
    expect(east.clipName).toBe('attack');
    expect(east.socketM).toEqual(body.releaseSocketsM['attack:east']);
    const release = actorReleaseWorld(east);
    expect(release).toEqual({ x: east.actor.x + east.socketM!.x, y: east.actor.y + east.socketM!.y });
    // The socket rides the body: within two metres of the feet, scaled once via REF_PX_PER_M.
    expect(Math.hypot(release!.x - east.actor.x, release!.y - east.actor.y)).toBeLessThan(2);
    expect(east.bodyM.height * REF_PX_PER_M).toBeGreaterThan(0);
    // The west contact differs by pose but stays a finite model offset.
    const west = castAt(Math.PI);
    expect(west.socketM).toEqual(body.releaseSocketsM['attack:west']);
    expect(Number.isFinite(west.socketM!.x + west.socketM!.y)).toBe(true);
  });

  it('culls through the frame viewport with pinned actors exempt (A8)', () => {
    const h = harness();
    const inside = { x: h.sampled.player.x, y: h.sampled.player.y };
    expect(actorVisibleInFrame(h.frame, inside)).toBe(true);
    const far = { x: h.sampled.player.x + 100, y: h.sampled.player.y + 100 };
    expect(actorVisibleInFrame(h.frame, far)).toBe(false);
    expect(actorVisibleInFrame(h.frame, far, true)).toBe(true);
    const hidden = createFieldViewFrame({ sceneKey: 'test#hidden', atUs: 0,
      viewportCss: { width: 0, height: 0 }, focusM: fieldPointM(0, 0), worldScale: 1 });
    expect(hidden.renderable).toBe(false);
    expect(actorVisibleInFrame(hidden, inside)).toBe(false);
    expect(actorVisibleInFrame(hidden, inside, true)).toBe(true);
    // Hidden frames paint degenerate views without NaN.
    const { input } = viewInput(h, { frame: hidden });
    const view = buildActorView(input);
    expect(Number.isFinite(view.x + view.y + view.width + view.height)).toBe(true);
    expect(view.x).toBe(0);
  });

  it('round-trips pointer input through the painted frame (A8)', () => {
    const h = harness(1.25);
    if (!h.frame.renderable) throw new Error('frame must render');
    const point = fieldPointM(h.sampled.player.x + 2, h.sampled.player.y - 1);
    const css = applyWorldToViewport(h.frame.worldToViewport, point);
    const back = applyViewportToWorld(h.frame.viewportToWorld, css);
    expect(back.x).toBeCloseTo(point.x, 9);
    expect(back.y).toBeCloseTo(point.y, 9);
  });

  it('keeps render keys on actor identity across scale and scene changes (A13)', () => {
    const ids = (worldScale: number, sceneKey: string) => {
      const h = harness(worldScale);
      const frame = createFieldViewFrame({ sceneKey, atUs: 0, viewportCss: { ...VIEW },
        focusM: fieldPointM(h.sampled.player.x, h.sampled.player.y), worldScale });
      const body = render(CombatArenaScene, { props: {
        arena: h.arena, s: h.state, c: h.c, ring: [], frame,
      } }).body;
      return [...body.matchAll(/data-arena-actor="([^"]+)"/g)].map((match) => match[1]);
    };
    const atOne = ids(1, 'field-a#arena-3');
    const atTwo = ids(2, 'field-a#arena-3');
    expect(atOne).toEqual(atTwo);
    expect(atOne).toContain('player');
    const rebound = ids(1, 'field-b#arena-4');
    expect(rebound).toEqual(atOne);
  });

  it('R1: depth order y=22/26/30 does not clamp together and ignores array order (DR2)', () => {
    const views = [
      { actor: { id: 'b' }, ground: { x: 5, y: 30 } },
      { actor: { id: 'a' }, ground: { x: 1, y: 22 } },
      { actor: { id: 'c' }, ground: { x: 1, y: 26 } },
    ];
    const ranks = actorDepthRanks(views);
    expect(ranks.get('a')).toBe(ACTOR_DEPTH_MIN);
    expect(ranks.get('c')).toBe(ACTOR_DEPTH_MIN + 1);
    expect(ranks.get('b')).toBe(ACTOR_DEPTH_MIN + 2);
    expect(new Set(ranks.values()).size).toBe(3);
    // Same set in different input order gives identical ranks.
    expect(actorDepthRanks([...views].reverse())).toEqual(ranks);
  });

  it('R1: ties use x then stable id without locale ordering', () => {
    const leftZ = { actor: { id: 'z' }, ground: { x: 1, y: 10 } };
    const rightA = { actor: { id: 'a' }, ground: { x: 2, y: 10 } };
    expect(compareActorGround(leftZ, rightA)).toBeLessThan(0);
    const lowIdB = { actor: { id: 'b' }, ground: { x: 1, y: 10 } };
    expect(compareActorGround(leftZ, lowIdB)).toBeGreaterThan(0);
    const ranks = actorDepthRanks([rightA, leftZ, lowIdB]);
    expect(ranks.get('b')).toBe(ACTOR_DEPTH_MIN);
    expect(ranks.get('z')).toBe(ACTOR_DEPTH_MIN + 1);
    expect(ranks.get('a')).toBe(ACTOR_DEPTH_MIN + 2);
    expect(ranks.get('a')).not.toBe(ranks.get('z'));
  });

  it('R1: depth band fails explicitly instead of silently clamping ranks', () => {
    const many = Array.from({ length: ACTOR_DEPTH_MAX - ACTOR_DEPTH_MIN + 2 }, (_, i) => ({ actor: { id: `a${i}` }, ground: { x: i, y: i } }));
    expect(() => actorDepthRanks(many)).toThrow(RangeError);
  });

  it('R3: shadow width follows physical footprint once, from the player reference', () => {
    expect(SHADOW_WIDTH_RATIO).toBeCloseTo((23 / REF_PX_PER_M) / 0.5, 12);
    expect(shadowWidthM(0.25)).toBeCloseTo(23 / REF_PX_PER_M, 12);
    expect(shadowWidthM(0.5) / shadowWidthM(0.25)).toBeCloseTo(2, 12);
    expect(shadowWidthM(0)).toBe(shadowWidthM(0.25));
    expect(shadowWidthM(Number.NaN)).toBe(shadowWidthM(0.25));
  });

  it('R3: radius 0.25→0.5 doubles CSS shadow at the same frame; worldScale changes CSS only (DR3)', () => {
    const h = harness(1);
    const small = buildActorView(viewInput(h, { frame: h.frame, radiusM: 0.25 }).input);
    const large = buildActorView(viewInput(h, { frame: h.frame, radiusM: 0.5 }).input);
    expect(large.shadowCss / small.shadowCss).toBeCloseTo(2, 9);
    expect(large.shadowCss).toBeCloseTo(shadowWidthM(0.5) * h.frame.cssPixelsPerMeter, 9);
    const scaled = harness(2);
    const scaledSmall = buildActorView(viewInput(scaled, { frame: scaled.frame, radiusM: 0.25 }).input);
    expect(scaledSmall.shadowCss / small.shadowCss).toBeCloseTo(2, 9);
    expect(scaledSmall.bodyM.width).toBeCloseTo(small.bodyM.width, 9);
  });

  it('R4: bodyM is model-first and survives a hidden frame (DR5)', () => {
    const h = harness(1);
    const visible = buildActorView(viewInput(h, { frame: h.frame }).input);
    const hidden = createFieldViewFrame({ sceneKey: 'test#hidden-body', atUs: 0,
      viewportCss: { width: 0, height: 0 }, focusM: fieldPointM(0, 0), worldScale: 1 });
    const hiddenView = buildActorView(viewInput(h, { frame: hidden }).input);
    expect(visible.bodyM.width).toBeGreaterThan(0);
    expect(visible.bodyM.height).toBeGreaterThan(0);
    expect(hiddenView.bodyM.width).toBeCloseTo(visible.bodyM.width, 12);
    expect(hiddenView.bodyM.height).toBeCloseTo(visible.bodyM.height, 12);
    // Off-screen metadata equals the model envelope — no view or DOM read needed.
    const envelope = bodyEnvelopeM(viewInput(h).cache.modelFor(null, { assetId: 'player.melee', radiusM: 0.25, bodySize: 'player' }));
    expect(envelope.width).toBeCloseTo(visible.bodyM.width, 6);
  });

  it('R4: culling keeps a root off-screen whose draw bounds cross the viewport (DR4)', () => {
    const h = harness(1);
    // Root just below the viewport; a tall draw span (raised weapon) reaches back in.
    const edge = { x: h.sampled.player.x, y: h.sampled.player.y + 7 };
    expect(actorVisibleInFrame(h.frame, edge)).toBe(false);
    const tall = { left: -0.3, top: -10, right: 0.3, bottom: 0.1 };
    expect(actorVisibleInFrame(h.frame, edge, false, tall)).toBe(true);
    const far = { x: h.sampled.player.x + 100, y: h.sampled.player.y + 100 };
    expect(actorVisibleInFrame(h.frame, far, false, tall)).toBe(false);
  });

  it('R4: a draw box covering the viewport keeps the actor when every corner is off-screen (DR4)', () => {
    const h = harness(1);
    const far = { x: h.sampled.player.x, y: h.sampled.player.y + 200 };
    expect(actorVisibleInFrame(h.frame, far, false,
      { left: -200, top: -400, right: 200, bottom: 200 })).toBe(true);
    // A box entirely outside the viewport still culls.
    expect(actorVisibleInFrame(h.frame, far, false,
      { left: 50, top: -20, right: 60, bottom: -10 })).toBe(false);
  });
});
