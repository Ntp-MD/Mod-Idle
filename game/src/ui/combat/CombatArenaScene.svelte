<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import SkillGeometryLayer from './SkillGeometryLayer.svelte';
  import ArenaGround from './ArenaGround.svelte';
  import { arenaGroundForField } from './arena/arena-ground-materials';
  import type { ArenaGroundMaterial } from './arena/arena-ground-materials';
  import CombatCastBar from './CombatCastBar.svelte';
  import { createCombatFeedbackCache, compactCombatFeedback, feedbackPriority, indexActorHits, type CombatFeedbackPop } from './combat-feedback';
  import { E, sm } from '../../engine/client';
  import { actionStyleFor, ACTOR_DEPTH_MIN, actorDepthRanks, actorReleaseWorld, actorVisibleInFrame, bodyEnvelopeM, buildActorView, compareActorGround, createActorBodyCache, FEEDBACK_RISE_PX_PER_SEC, FEEDBACK_WINDOW_SEC, sortActorViews, REF_PX_PER_M } from './arena-actor-view';
  import { ARENA_DEFAULT_BODY_RADIUS_M, ARENA_GLIDE_MS } from '../../presentation/arena-camera';
  import { skillAreaSnapshot } from '@engine/skill-area';
  import { isClear } from '@engine/navigation';
  import { mobSkillById } from '@sim/combat/mobSkills';
  import type { Character } from '@sim/core/player';
  import type { FxEvent, GameState, Mob } from '@sim/core/types';
  import { arenaDistance, arenaSkillRange, arenaTarget, attackGeometryFor, mobAttackProfile, sampleCombatArena, type CombatArena, type CombatArenaActor } from '@sim/combat/combat-arena';
  import { arenaArtForSpecies, type ArenaCharacterArt } from './arena/arena-art';
  import { equippedPlayerArt } from './arena/arena-equipped-player';
  import { actorArt, actorProfile } from './combat-actor';
  import { activeSkillVfx as stagedSkillVfx } from './arena-skill-vfx';
  import { aoePulseMs, groundDistance } from './arena-space';
  import { ARENA_VIEW, arenaActorAction, arenaCameraOffset, arenaEventTiming, arenaFlightProgress, arenaFlightWindow, arenaIncomingHazards, arenaFieldNote, createArenaGait, createArenaPlaybackClock, describeArenaTarget, projectArenaPoint, type ArenaTargetRead } from './combat-arena-view';
  import { clampWorldScale, createFieldViewFrame, followFieldViewFrame, type FieldViewFrame } from '../../presentation/arena-view-frame';
  import { applyViewportToWorld, composeAffine, fieldPointM, matrixAttribute, viewportPointPx } from '../../presentation/view-transform';
  import { fieldLabel } from '../hud/hud';
  import { combatEffectLevel, type CombatEffectLevel } from './combat-presentation';
  import { resolveArenaPick } from './arena-picking';
  import { resolveAnimation, shippedAnimationManifest } from './animation/manifest';

  let { arena, s, c, ring, speed = 1, paused = false, spritePreviewSpecies = null, spritePreviewVariant = null, aoePreview = false, iconActors = false, groundMaterialOverride = null,
    focusId = null, aimSkill = null, inspect = false, effectLevel = 'auto', keyboardAim = null, zoom = 1, vfxMode = 'auto', frame = null,
    onReviewPause, onReviewStep, onInspectEnemy, onFocusEnemy, onGroundCommand, onAimPoint, onVitals, onTargetRead, onStageCss }: {
    arena: CombatArena; s: GameState; c: Character; ring: FxEvent[]; speed?: number; paused?: boolean; vfxMode?: 'auto' | 'base';
    groundMaterialOverride?: ArenaGroundMaterial | null;
    spritePreviewSpecies?: string | null;
    spritePreviewVariant?: { speciesId: string; variantId: string } | null;
    aoePreview?: boolean;
    /** Draw every body as its white icon instead of the authored character atlas. */
    iconActors?: boolean;
    focusId?: string | null;
    /** The one skill whose cast range and footprint are being aimed right now. */
    aimSkill?: string | null;
    /** Full / Reduced / Minimal, or Auto from playback speed. Threat telegraphs survive all three. */
    effectLevel?: CombatEffectLevel;
    /** Combat zoom: 1 shows the authored frame, 0.5 sees twice as far. Presentation only. */
    zoom?: number;
    /** Host intent: validated scale, viewport and identity; focus follows the displayed player sample. */
    frame?: FieldViewFrame | null;
    /** Stage size echo so the app can build the frame for the painted pixels. */
    onStageCss?: (size: { width: number; height: number }) => void;
    /** Keyboard aim reticle; a pointer move writes the same world point through `onAimPoint`. */
    keyboardAim?: { x: number; y: number } | null;
    onAimPoint?: (point: { x: number; y: number }) => void;
    inspect?: boolean;
    onReviewPause?: () => void;
    onReviewStep?: () => void;
    onInspectEnemy?: (mob: Mob) => void;
    onFocusEnemy?: (mob: Mob) => void;
    /** A deliberate local move order in arena meters, clamped to the field bounds. */
    onGroundCommand?: (point: { x: number; y: number }, holdToken?: string) => void;
    onVitals?: (vitals: { hp: number; es: number; mana: number }) => void;
    /** The persistent target read for the HUD bar — identity, kind, offscreen bearing and range. */
    onTargetRead?: (read: ArenaTargetRead | null) => void;
  } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let heldAimClick = false;
  let stage = $state({ width: ARENA_VIEW.width, height: ARENA_VIEW.height });
  let lastStageCss = { width: 0, height: 0 };
  let playhead = $state(0);
  let reviewAt = $state<number | null>(null);
  let reviewPlaying = $state(false);
  let reviewWall = 0;
  let motionReview = $state<'system' | 'full' | 'reduced'>('system');
  let showAiLog = $state(false);
  const spriteClipPrefix = $props.id();
  let systemReducedMotion = $state(false);
  // All actors sharing a broken atlas switch together, without retrying it every render frame.
  const failedArt = new SvelteSet<ArenaCharacterArt>();
  /** Decoded sprite bytes by sheet href: the icon fallback stays until its sprite is ready. */
  const loadedSprites = new SvelteSet<string>();
  const quality = $derived(combatEffectLevel(effectLevel, speed));
  const reducedMotion = $derived((inspect && motionReview !== 'system' ? motionReview === 'reduced' : systemReducedMotion)
    || quality !== 'full');
  const effectsCalm = $derived(quality !== 'full');
  const cachedFeedback = createCombatFeedbackCache();
  const feedback = $derived.by(() => {
    void playhead;
    return cachedFeedback(arena.feedback?.length ? arena.feedback : ring, arena.unitsPerSec);
  });
  const actorHits = $derived(indexActorHits(feedback, playhead, arena.unitsPerSec));
  let reviewArt = $state<ArenaCharacterArt | null>(null);
  const playerArt = equippedPlayerArt;
  let aimPointer = $state<{ x: number; y: number } | null>(null);
  const gait = createArenaGait();
  const playbackTime = createArenaPlaybackClock();
  /** Memoized WP2 models: normalize once per art, reuse across scale/zoom/skin. */
  const bodyCache = createActorBodyCache();
  let previousVitals = '';
  /** Dev inspection reads the same sampled frame and geometry the sim used, never a near copy. */
  const inspectRows = $derived.by(() => {
    if (!inspect || !showAiLog) return [];
    const frame = sampleCombatArena(arena, playhead);
    return s.group.map((mob) => {
      const actor = frame.mobs[mob.id];
      if (!actor) return { id: mob.id, label: mob.species, state: 'gone', reason: 'not in frame',
        center: 0, edge: 0, max: 0, stop: 0, engaged: false, timing: '—' };
      const geometry = attackGeometryFor(mobAttackProfile(mob), actor.radiusM ?? .25,
        frame.player.radiusM ?? .25, arenaDistance(actor, frame.player));
      const timing = actor.action?.timing;
      const preparing = timing ? playhead < timing.releaseAtUs : false;
      const recovering = timing ? playhead >= timing.releaseAtUs && playhead < timing.recoveryUntilUs : false;
      const engaged = !!s.field?.engagementIds.includes(mob.id);
      const state = !engaged ? 'idle'
        : recovering ? 'recovering'
          : geometry.inRange ? 'in-range' : 'out-of-range';
      const reason = state === 'idle' ? 'field idle'
        : state === 'recovering' ? 'action owns feet'
          : state === 'out-of-range' ? 'approach'
            : preparing ? 'windup' : 'in stop band';
      return {
        id: mob.id, label: mob.species, state, reason,
        center: geometry.centerDistance, edge: geometry.edgeGap,
        max: geometry.maxCenterDistance, stop: geometry.stopCenterDistance,
        engaged,
        timing: timing
          ? `${(timing.startedAtUs / arena.unitsPerSec).toFixed(2)} / ${(timing.releaseAtUs / arena.unitsPerSec).toFixed(2)} / ${(timing.impactAtUs / arena.unitsPerSec).toFixed(2)}`
          : '—',
      };
    });
  });
  function seekArena(atUs: number) {
    onReviewPause?.();
    reviewPlaying = false;
    reviewAt = Math.max(arena.frames[0]?.atUs ?? 0, Math.min(arena.nowUs, atUs));
    playhead = reviewAt;
  }
  $effect(() => { if (!paused) { reviewAt = null; reviewPlaying = false; } });
  const sampled = $derived(sampleCombatArena(arena, playhead));
  const groundMaterial = $derived.by(() => { void playhead; return groundMaterialOverride ?? arenaGroundForField(s); });
  const player = $derived(sampled.player);
  /** Displayed scale glides toward the target scale (~140 ms) so slider steps
   *  never pop; focus stays exact on the interpolated player (never lagged).
   *  Reduced motion snaps instantly. */
  const targetScale = $derived(frame?.renderable ? frame.worldScale : clampWorldScale(zoom));
  let displayedScale = $state(untrack(() => targetScale));
  /** Camera and actors share the interpolated playhead, never different simulation ticks. */
  const painted: FieldViewFrame = $derived.by(() => {
    const focus = fieldPointM(player.x, player.y);
    if (frame) {
      if (!frame.renderable) return followFieldViewFrame(frame, playhead, focus);
      if (displayedScale === frame.worldScale) return followFieldViewFrame(frame, playhead, focus);
      const host = createFieldViewFrame({
        sceneKey: frame.sceneKey, atUs: playhead,
        viewportCss: frame.viewportCss, focusM: focus, worldScale: displayedScale,
        viewportToClient: composeAffine(frame.worldToClient, frame.viewportToWorld),
      });
      return followFieldViewFrame(host, playhead, focus);
    }
    return createFieldViewFrame({
      sceneKey: 'combat-arena:fallback',
      atUs: playhead,
      viewportCss: stage,
      focusM: focus,
      worldScale: displayedScale,
    });
  });
  /** Ref-space dims for the remaining ref-space paint children
   *  (effects layer and target read).
   *  Actor placement/sizing, release/feedback anchors, culling and the whole skill
   *  layer use `painted` + the WP2 body model; only the ref-space SVG children above
   *  still read `view`/`scale`. The fence is derived from the single frame (scale from
   *  worldScale, camera from the frame focus) and the agreement test in
   *  combat-arena-view.test.ts pins both projections to the same screen pixel at
   *  0.5–2x — one effective transform, no duplicate scale owner. Removing the fence
   *  means moving those SVG viewBoxes (not just their points) onto the frame. */
  const view = $derived(painted.renderable
    ? { width: ARENA_VIEW.width / painted.worldScale,
      height: ARENA_VIEW.width / painted.worldScale * (painted.viewportCss.height / painted.viewportCss.width) }
    : { width: ARENA_VIEW.width, height: ARENA_VIEW.height });
  // Zoom changes world pixels; actor depth must stay below the atlas and feedback layers.
  const scale = $derived(stage.height > 0 ? stage.height / view.height : 1);
  const automaticTargetId = $derived(arenaTarget({
    player, mobs: sampled.mobs, nav: arena.nav, targetPriority: arena.targetPriority,
  }, s.group)?.id ?? null);
  /** The action or decision that owns the highlight, never a detached renderer acquisition. */
  const committedTargetId = $derived.by(() => {
    const action = arenaActorAction(arena, sampled.player, playhead);
    const id = action?.targetId ?? sampled.intent?.targetId;
    return id && id !== 'player' ? id : undefined;
  });
  const targetId = $derived(committedTargetId
    ? sampled.mobs[committedTargetId]?.hp > 0 ? committedTargetId : undefined
    : focusId && sampled.mobs[focusId]?.hp > 0 ? focusId : automaticTargetId ?? undefined);
  const focusTargetId = $derived(focusId && focusId !== targetId && sampled.mobs[focusId]?.hp > 0
    ? focusId : null);
  const selectedGroundActor = $derived(targetId ? sampled.mobs[targetId] : undefined);
  const focusedGroundActor = $derived(focusTargetId ? sampled.mobs[focusTargetId] : undefined);
  const GROUND_MARKER_RADIUS_RATIO = 1.5;
  const camera = $derived(painted.renderable ? arenaCameraOffset(painted.focusM, view) : arenaCameraOffset(player, view));
  /** F37 — one named read for the bar: committed strike, requested focus, or the next body,
   *  with an offscreen bearing so a focus that leaves the view stays readable. */
  const targetRead = $derived(describeArenaTarget({
    mobs: sampled.mobs, player, committedId: committedTargetId, focusId, nextId: automaticTargetId,
    camera, view,
  }));
  let lastTargetKey = '';
  $effect(() => {
    const read = targetRead;
    const key = read
      ? `${read.id}|${read.kind}|${read.offscreen}|${Math.round(read.bearingDeg / 10)}|${Math.round(read.rangeM * 2)}`
      : 'none';
    if (key === lastTargetKey) return;
    lastTargetKey = key;
    onTargetRead?.(read);
  });
  const cameraTransform = $derived(`translate(${-camera.x * stage.width / view.width}px,${-camera.y * scale}px)`);
  /** Wrapper cancellation: actor feet are viewport CSS; the translated camera div adds this back. */
  const camCssX = $derived(camera.x * stage.width / view.width);
  const camCssY = $derived(camera.y * scale);
  /** A13 — a new field/load/replay (new sceneKey) drops per-instance caches, never reusing effects.
   *  Seek/zoom/skin keep the key and reuse everything. The key is a primitive $derived so the
   *  effect below does not refire when the frame object is rebuilt for a tick or a zoom step. */
  const sceneInstanceKey = $derived(painted.sceneKey);
  let lastSceneInstanceKey = '';
  $effect(() => {
    const key = sceneInstanceKey;
    if (key === lastSceneInstanceKey) return;
    lastSceneInstanceKey = key;
    bodyCache.clear();
    gait.clear();
    failedArt.clear();
    // A new field/load/replay snaps the scale: no glide from the old scene.
    displayedScale = targetScale;
    // Loaded image URLs outlive a scene change; the browser will not re-fire load
    // for an unchanged image element after its scene identity changes.
    reviewAt = null;
  });
  // Dev-only calibration rings: one arena unit is one meter, drawn through the ground projection.
  const aoePreviewRings = $derived(aoePreview ? [1, 2, 3] : []);
  // Every body stands on its own ground: one subtle ring per living actor, sized by the
  // sim's body radius through the same projection VFX footprints use — the footprint an
  // AoE circle tests against, drawn where the body actually is.
  const bodyRings = $derived(
    [sampled.player, ...Object.values(sampled.mobs)]
      .filter((actor) => actor.hp > 0 && (actor.radiusM ?? 0) > 0)
      .map((actor) => ({ id: actor.id, x: actor.x, y: actor.y, radiusM: actor.radiusM }))
  );
  const aimDefinition = $derived(aimSkill ? sm.byId[aimSkill] : undefined);
  const aimRange = $derived(aimSkill ? arenaSkillRange(aimSkill) : 0);
  const aimPoint = $derived.by(() => {
    if (!aimSkill || !aimDefinition) return undefined;
    const focus = targetId ? sampled.mobs[targetId] : undefined;
    const self = ['buff', 'heal', 'aura'].includes(aimDefinition.type ?? '');
    return self ? player : keyboardAim ?? aimPointer ?? focus ?? player;
  });
  const aimArea = $derived.by(() => {
    if (!aimSkill || !aimDefinition || !aimPoint) return undefined;
    const self = ['buff', 'heal', 'aura'].includes(aimDefinition.type ?? '');
    return skillAreaSnapshot(self ? { origin: 'caster', radius_m: 0 }
      : aimDefinition.action?.kind === 'chain-strike' ? { origin: 'target', radius_m: 0 }
      : aimDefinition.area ?? { origin: 'target' as const, radius_m: 0 },
      player, aimPoint, targetId ?? '', player.facing);
  });
  const aimTargetName = $derived.by(() => {
    if (!aimSkill || ['buff', 'heal', 'aura'].includes(aimDefinition?.type ?? '')) return 'You';
    const target = targetId ? sampled.mobs[targetId]?.mob : undefined;
    return target ? `${target.species} ${target.level}` : 'Ground';
  });
  const aimValid = $derived.by(() => {
    if (!aimSkill || !aimArea || !aimPoint) return false;
    // The release guard rejects unstandable placements, including caster-origin bearings.
    if (arena.nav && !isClear(arena.nav, aimPoint, 0)) return false;
    if (aimDefinition?.area?.origin === 'caster') return true;
    if (!Number.isFinite(aimRange)) return true;
    return groundDistance(player, aimArea.center) <= aimRange + 1e-7;
  });
  // In-flight incoming shots own their telegraph: the committed span at the playhead, never the
  // caster's pose (F38). Ground shots draw their landing circle; projectiles draw their head.
  const hazardMarks = $derived(arenaIncomingHazards(arena, playhead)
    .filter(hazard => playhead >= hazard.releaseAtUs));
  const fieldNote = $derived(arenaFieldNote(s));
  $effect(() => {
    const ids = new Set(['player', ...Object.keys(sampled.mobs)]);
    gait.retain(ids);
  });

  /** Pointer uses the inverse of the painted frame: container offset converts once, here. */
  function pointerWorld(event: PointerEvent | MouseEvent): { x: number; y: number } | undefined {
    if (!host || !painted.renderable) return undefined;
    const rect = host.getBoundingClientRect();
    const point = applyViewportToWorld(painted.viewportToWorld,
      viewportPointPx(event.clientX - rect.left, event.clientY - rect.top));
    // The sim insets every body by its footprint, so a ground order aims where the body can stand.
    const radius = player.radiusM ?? 0.25;
    return {
      x: Math.max(radius, Math.min(arena.bounds.width - radius, point.x)),
      y: Math.max(radius, Math.min(arena.bounds.height - radius, point.y)),
    };
  }

  function skillColour(id: string) {
    const element = sm.byId[id]?.element || mobSkillById(id)?.element;
    return (E.elements.colour as Record<string, string>)[element ?? 'physical'] || '#d8d1bc';
  }

  function skillName(id?: string) {
    return (id && (sm.byId[id]?.name || mobSkillById(id)?.name)) || '';
  }

  function damageLabel(text: string | undefined, crit = false) {
    return text ? `${text}${crit ? '!' : ''}` : '';
  }

  $effect(() => {
    if (!arena.frames.length) return;
    const vitals = { hp: player.hp, es: player.es ?? s.player.es, mana: player.mana ?? s.player.mana };
    const key = `${vitals.hp}:${vitals.es}:${vitals.mana}`;
    if (key !== previousVitals) { previousVitals = key; onVitals?.(vitals); }
  });

  const reviewModules: Record<string, () => Promise<ArenaCharacterArt>> = {
    'spear-goblin': async () => {
      const path = '../dev/arena-art/arena-art-spear-goblin-review.ts';
      return (await import(/* @vite-ignore */ path)).spearGoblinReviewArt;
    },
    'stone-golem': async () => {
      const path = '../dev/arena-art/arena-art-golem-review.ts';
      return (await import(/* @vite-ignore */ path)).golemReviewArt;
    },
    'little-demon': async () => {
      const path = '../dev/arena-art/arena-art-imp-review.ts';
      return (await import(/* @vite-ignore */ path)).impReviewArt;
    },
    'skeleton-sword': async () => {
      const path = '../dev/arena-art/arena-art-skeleton-sword-review.ts';
      return (await import(/* @vite-ignore */ path)).skeletonSwordReviewArt;
    },
    'skeleton-bone': async () => {
      const path = '../dev/arena-art/arena-art-skeleton-bone-review.ts';
      return (await import(/* @vite-ignore */ path)).skeletonBoneReviewArt;
    },
    'crypt-wraith': async () => {
      const path = '../dev/arena-art/arena-art-crypt-wraith-review.ts';
      return (await import(/* @vite-ignore */ path)).cryptWraithReviewArt;
    },
    'shadow-wolf': async () => {
      const path = '../dev/arena-art/arena-art-shadow-wolf-review.ts';
      return (await import(/* @vite-ignore */ path)).shadowWolfReviewArt;
    },
    'eclipse-wisp': async () => {
      const path = '../dev/arena-art/arena-art-eclipse-wisp-review.ts';
      return (await import(/* @vite-ignore */ path)).eclipseWispReviewArt;
    },
    'pixiblop-spider': async () => {
      const path = '../dev/arena-art/arena-art-pixiblop-spider-review.ts';
      return (await import(/* @vite-ignore */ path)).pixiblopSpiderReviewArt;
    },
  };

  $effect(() => {
    const load = import.meta.env.DEV && spritePreviewVariant
      ? async () => {
        const path = '../dev/arena-art/arena-art-mob-drafts-review.ts';
        return (await import(/* @vite-ignore */ path)).loadMobDraftReviewArt(spritePreviewVariant.speciesId, spritePreviewVariant.variantId);
      }
      : import.meta.env.DEV && spritePreviewSpecies ? reviewModules[spritePreviewSpecies] : undefined;
    if (!load) { reviewArt = null; return; }
    let current = true;
    load().then(art => { if (current) reviewArt = art; }).catch(() => { if (current) reviewArt = null; });
    return () => { current = false; };
  });

  onMount(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => { systemReducedMotion = query.matches; };
    motion();
    query.addEventListener('change', motion);
    const resize = new ResizeObserver(([entry]) => {
      stage = { width: entry.contentRect.width, height: entry.contentRect.height };
      if (stage.width !== lastStageCss.width || stage.height !== lastStageCss.height) {
        lastStageCss = { ...stage };
        onStageCss?.(lastStageCss);
      }
    });
    if (host) resize.observe(host);
    playhead = playbackTime(arena, performance.now(), speed, paused);
    displayedScale = targetScale;
    let frame = 0;
    let lastWall = 0;
    const advance = (wall: number) => {
      if (reviewPlaying && reviewAt != null) {
        if (!document.hidden) reviewAt = Math.min(arena.nowUs, reviewAt + Math.max(0, wall - reviewWall) * arena.unitsPerSec * speed / 1000);
        reviewWall = wall;
        if (reviewAt >= arena.nowUs) reviewPlaying = false;
      }
      const liveAt = playbackTime(arena, wall, speed, paused);
      playhead = reviewAt ?? liveAt;
      // Glide the displayed scale toward its target; reduced motion snaps.
      const dt = lastWall === 0 ? 16.7 : Math.min(100, Math.max(0, wall - lastWall));
      lastWall = wall;
      if (reducedMotion || displayedScale === targetScale) {
        if (displayedScale !== targetScale) displayedScale = targetScale;
      } else {
        const k = 1 - Math.exp(-dt / ARENA_GLIDE_MS);
        displayedScale = Math.abs(targetScale - displayedScale) < 0.0005
          ? targetScale : displayedScale + (targetScale - displayedScale) * k;
      }
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); query.removeEventListener('change', motion); };
  });

  /** One body identity for the WP2 model: sim footprint plus presentation size class. */
  function bodyFor(actor: CombatArenaActor): { assetId: string; radiusM: number; bodySize: string } {
    const bodySize = actor.id === 'player' ? 'player' : actorProfile(actor.mob).size;
    const assetId = actor.id === 'player'
      ? `player.${sm.weaponGroupOf(c.weaponName) === 'ranged' ? 'ranged' : sm.weaponGroupOf(c.weaponName) === 'magic' ? 'magic' : 'melee'}`
      : `species.${actor.mob?.speciesId ?? 'unknown'}`;
    return { assetId, radiusM: actor.radiusM ?? ARENA_DEFAULT_BODY_RADIUS_M, bodySize };
  }

  /** All actors with cached body metadata — built before culling so lifts never jump on re-entry. */
  const actorEntries = $derived.by(() => {
    return [player, ...Object.values(sampled.mobs), ...sampled.bodies].map((actor) => {
      const art = artFor(actor);
      const spec = bodyFor(actor);
      const body = bodyCache.modelFor(art, spec);
      return { actor, art, spec, body };
    });
  });
  /** World-metre body envelopes from the shared model; the skill layer converts once via the frame. */
  const bodyModels = $derived.by(() => {
    const models: Record<string, { width: number; height: number }> = {};
    for (const entry of actorEntries) {
      models[entry.actor.id] = bodyEnvelopeM(entry.body);
    }
    return models;
  });
  /** Neutral attachment lift from the model envelope (visible or culled), never the runtime-cell padding. */
  function bodyLift(id: string | undefined, share: number, fallback: number): number {
    const model = id ? bodyModels[id] : undefined;
    // bodyEnvelopeM is reference height; visible views correct by bodyScale in buildActorView
    // but the model height is the stable off-screen read — both stay in model metres.
    return model ? model.height * share * REF_PX_PER_M : fallback;
  }
  const actors = $derived.by(() => {
    // Cull on the projected draw bounds (BodyVisual.drawBoundsM), never a centre point
    // alone and never a live DOM measurement. Player/target/focus always stay.
    return actorEntries
      .filter((entry) => actorVisibleInFrame(painted, entry.actor,
        entry.actor.id === 'player' || entry.actor.id === targetId || entry.actor.id === focusTargetId,
        entry.body.drawBoundsM))
      .map(({ actor, art, spec, body }) => buildActorView({ arena, actor, art,
        body,
        assetId: spec.assetId, radiusM: spec.radiusM, bodySize: spec.bodySize,
        fallback: actorArt(actor.mob), frame: painted, atUs: playhead,
        gaitSample: gait.sample(arena, actor.id, playhead),
        actorHits, reducedMotion,
        playerCtx: actor.id === 'player' ? { state: s, character: c } : null }))
      .sort((a, b) => compareActorGround(a, b));
  });
  const actorViews = $derived(new Map(actors.map((view) => [view.actor.id, view])));
  const depthRanks = $derived(actorDepthRanks(actors));
  /** Authored hand/weapon sockets in world metres: effect release anchors ride the sprite, not the feet. */
  const releasePointsWorld = $derived.by(() => {
    const points: Record<string, { x: number; y: number }> = {};
    for (const view of actors) {
      const release = actorReleaseWorld(view);
      if (release) points[view.actor.id] = release;
    }
    return points;
  });

  const animationManifest = shippedAnimationManifest(E.mob.species as { id: string }[]);
  /** The one identity → rig/sprite lookup; the label reports the sprite name it actually draws. */
  function animationSource(actor: CombatArenaActor): string {
    const identity = actor.id === 'player'
      ? `player.${sm.weaponGroupOf(c.weaponName) === 'ranged' ? 'ranged' : sm.weaponGroupOf(c.weaponName) === 'magic' ? 'magic' : 'melee'}`
      : `species.${actor.mob?.speciesId ?? 'unknown'}`;
    const resolved = resolveAnimation(animationManifest, identity);
    return resolved.kind === 'rig' ? resolved.model : resolved.fallback;
  }

  function artFor(actor: CombatArenaActor): ArenaCharacterArt | null {
    if (iconActors) return null;
    if (actor.id === 'player') return failedArt.has(playerArt) ? null : playerArt;
    const speciesId = actor.mob?.speciesId;
    // Other field spawns can remain present while reviewing a named variant.
    const art = spritePreviewSpecies && reviewArt && actor.mob
      && (!spritePreviewVariant || speciesId === spritePreviewVariant.speciesId)
      ? reviewArt : arenaArtForSpecies(speciesId, spritePreviewSpecies && !spritePreviewVariant ? undefined : actor.mob?.variant);
    return art && !failedArt.has(art) ? art : null;
  }

  function eventTime(event: FxEvent) { return event.atUs ?? event.sec * arena.unitsPerSec; }
  const effects = $derived(compactCombatFeedback(feedback
    .filter((event) => ['hit', 'taken', 'block', 'heal', 'buff', 'drop', 'cast'].includes(event.kind))
    .filter(event => {
      if (event.kind === 'cast') return true;
      const age = (playhead - eventTime(event)) / arena.unitsPerSec;
      return age <= FEEDBACK_WINDOW_SEC && age >= (event.skillId ? 0 : -.26);
    })
    .sort((a,b) => feedbackPriority(a) - feedbackPriority(b) || eventTime(b) - eventTime(a)),
    quality === 'minimal' ? 32 : 64)
    .map(event => effectView(event))
    .filter((mark) => mark != null)
    // Minimal keeps the reads that explain a threat — damage taken, a block, a cast — and drops
    // the cosmetic trails. Threat rings and cast bars live outside this list and never fade.
    .filter((mark) => quality !== 'minimal'
      || ['taken', 'block', 'cast'].includes(mark.event.kind) || mark.event.kind === 'hit' && !!mark.event.skillId));

  function effectView(event: CombatFeedbackPop) {
    const atUs = eventTime(event);
    const age = (playhead - atUs) / arena.unitsPerSec;
    if (event.displayCount > 1 && event.hitIndex == null && age < 0) return null;
    const cast = event.kind === 'cast' && !!event.skillId;
    if (event.kind === 'cast' && !cast) return null;
    const incoming = event.kind === 'taken' || (event.kind === 'block' && event.side === 'self');
    const sourceId = incoming ? event.byId : event.kind === 'cast' && event.side === 'field' ? event.mobId : 'player';
    const linkedAction = event.actionId != null ? arena.actions.find(action => action.id === event.actionId) : undefined;
    const skillAction = linkedAction ?? arena.actions.find((a) => a.actorId === sourceId && !!event.skillId
      && a.skillId === event.skillId && Math.abs(a.atUs - atUs) < 2);
    const targetActorId = event.kind === 'cast'
      ? ['heal', 'buff'].includes(sm.byId[event.skillId || '']?.type ?? '') ? 'player' : skillAction?.targetId ?? (sourceId === 'player' ? targetId : 'player')
      : incoming || event.side === 'self' ? 'player' : event.mobId;
    const action = linkedAction ?? (arena.actions.find((a) => a.actorId === sourceId && Math.abs(a.atUs - atUs) < 2
      && (!targetActorId || !a.targetId || a.targetId === targetActorId)
      && (event.skillId ? a.skillId === event.skillId : event.via === 'swing' ? a.kind === 'swing' : true)) || skillAction);
    if (cast && action?.cancelledAtUs != null && playhead >= action.cancelledAtUs) return null;
    const baseTiming = arenaEventTiming(event, arena) ?? action?.timing;
    const timing = cast && baseTiming ? {
      startedAtSec: baseTiming.startedAtUs / arena.unitsPerSec,
      releasedAtSec: baseTiming.releaseAtUs / arena.unitsPerSec,
      impactAtSec: baseTiming.impactAtUs / arena.unitsPerSec,
      nowSec: playhead / arena.unitsPerSec,
    } : undefined;
    if (cast) {
      if (baseTiming && playhead < baseTiming.startedAtUs) return null;
      if ((timing ? playhead / arena.unitsPerSec - timing.impactAtSec : age) > .3) return null;
    } else if (age < -.26 || age > FEEDBACK_WINDOW_SEC) return null;
    const target = targetActorId === 'player' ? player : sampled.mobs[targetActorId || ''] || sampled.bodies.find((body) => body.id === targetActorId)
      || arena.bodies.find((body) => body.id === targetActorId);
    const actionTarget = action?.targetX != null && action.targetY != null ? { x: action.targetX, y: action.targetY } : undefined;
    const targetPoint = target ?? event.point ?? actionTarget;
    if (!targetPoint) return null;
    const sourceActor = sourceId === 'player' ? player : sampled.mobs[sourceId || '']
      || sampled.bodies.find((body) => body.id === sourceId) || arena.bodies.find((body) => body.id === sourceId);
    const point = projectArenaPoint(actionTarget && action?.targetId === targetActorId ? actionTarget : targetPoint);
    const source = projectArenaPoint(action ? { x: action.x, y: action.y } : sourceActor || target!);
    const kind = event.kind === 'heal' || event.kind === 'buff' || event.kind === 'drop' ? event.kind
      : event.kind === 'block' ? /block/i.test(event.text) ? 'block' : 'dodge'
      : action ? actionStyleFor(action, sourceActor?.mob, sourceActor?.id === 'player' ? { character: c } : null) : 'status';
    const flight = !!action?.ranged && event.via !== 'dot' && event.kind !== 'cast';
    const flightWindow = arenaFlightWindow(action?.timing ?? baseTiming, arena.unitsPerSec);
    const progress = arenaFlightProgress(playhead, flightWindow, age);
    const targetLift = bodyLift(targetActorId, .52, 48);
    const sourceLift = bodyLift(sourceActor?.id ?? 'player', .6, 58);
    const pointY = point.y - targetLift;
    const sourceY = source.y - sourceLift;
    const damage = event.hpDamage != null || event.esDamage != null
      ? (event.hpDamage ?? 0) + (event.esDamage ?? 0) : event.value ?? 0;
    return { key: event.displayKey, event, age, timing, kind, telegraph: cast,
      displayIndex: event.displayIndex, displayCount: event.displayCount,
      collapsedCount: event.collapsedCount, text: event.text, value: event.value,
      point: { x: point.x, y: pointY }, ground: point, source: { x: source.x, y: sourceY }, sourceGround: source, flight,
      projectile: { x: source.x + (point.x - source.x) * progress, y: sourceY + (pointY - sourceY) * progress - Math.sin(progress * Math.PI) * (kind === 'arrow' ? 18 : 5) },
      angle: Math.atan2(pointY - sourceY, point.x - source.x) * 180 / Math.PI,
      opacity: age < 0 ? 1 : Math.max(0, 1 - age / .5),
      popOpacity: age < 0 ? 0 : Math.min(1, age / .035) * Math.max(0, 1 - age / FEEDBACK_WINDOW_SEC),
      rise: reducedMotion ? 0 : Math.max(0, age) * FEEDBACK_RISE_PX_PER_SEC,
    };
  }
</script>

<div class="combat-arena" class:reduced-motion={reducedMotion} class:fast={speed >= 4} bind:this={host}
  data-combat-arena data-arena-time={Math.round(playhead)} data-frame-renderable={painted.renderable} aria-label="Live combat arena">
  {#if painted.renderable}
  {#if inspect && import.meta.env.DEV}
    <div class="arena-review" aria-label="Arena animation inspection">
      <button type="button" onclick={() => { onReviewStep?.(); seekArena(arena.nowUs); }}>Advance simulation 1s</button>
      <button type="button" aria-pressed={reviewPlaying} onclick={() => {
        onReviewPause?.(); reviewAt ??= playhead; reviewWall = performance.now(); reviewPlaying = !reviewPlaying;
      }}>{reviewPlaying ? 'Hold window' : 'Play window'}</button>
      <button type="button" onclick={() => seekArena(playhead - arena.unitsPerSec * .05)}>Previous frame</button>
      <input type="range" aria-label="Arena animation time" min={arena.frames[0]?.atUs ?? 0} max={arena.nowUs}
        step={Math.max(1, arena.unitsPerSec / 1000)} value={playhead}
        oninput={(event) => seekArena(Number(event.currentTarget.value))} />
      <button type="button" onclick={() => seekArena(playhead + arena.unitsPerSec * .05)}>Next frame</button>
      <button type="button" aria-pressed={showAiLog} onclick={() => (showAiLog = !showAiLog)}>{showAiLog ? 'Hide AI log' : 'Show AI log'}</button>
      <input type="number" aria-label="Arena time in seconds" min={(arena.frames[0]?.atUs ?? 0) / arena.unitsPerSec}
        max={arena.nowUs / arena.unitsPerSec} step=".01" value={(playhead / arena.unitsPerSec).toFixed(3)}
        oninput={(event) => seekArena(Number(event.currentTarget.value) * arena.unitsPerSec)} />
      <select aria-label="Arena motion preview" bind:value={motionReview}>
        <option value="system">System motion</option><option value="full">Full motion</option><option value="reduced">Reduced motion</option>
      </select>
      <output aria-label="Arena effect timing">{effects.filter(mark => mark.event.kind === 'cast').slice(0, 1).map(mark => `${mark.event.text}: ${mark.timing?.startedAtSec.toFixed(3)} / ${mark.timing?.releasedAtSec.toFixed(3)} / ${mark.timing?.impactAtSec.toFixed(3)}`).join(' ')}</output>
      {#if inspectRows.length}
        <div class="arena-inspect-geometry" aria-label="Body range and AI inspection">
          <span class="inspect-head">player {arena.player.x.toFixed(2)}, {arena.player.y.toFixed(2)} · start/release/impact s</span>
          {#each inspectRows as row (row.id)}
            <span data-ai-state={row.state}>
              <b>{row.label}</b> · {row.state} · d {row.center.toFixed(2)} · edge {row.edge.toFixed(2)} · max {row.max.toFixed(2)} · stop {row.stop.toFixed(2)} · {row.engaged ? 'engaged' : 'idle'} · {row.timing} · {row.reason}
            </span>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  {#if onGroundCommand}
    <button class="arena-ground-command" type="button" tabindex="-1"
      aria-label={aimSkill ? 'Confirm the aimed skill at this ground point' : 'Issue a local move order at this ground point'}
      onpointermove={(event) => {
        if (!aimSkill) return;
        aimPointer = pointerWorld(event) ?? null;
        if (aimPointer) onAimPoint?.(aimPointer);
      }}
      onpointerleave={() => { aimPointer = null; }}
      onpointerdown={(event) => {
        if (!aimSkill || sm.byId[aimSkill]?.action?.kind !== 'ray-channel') return;
        const point = pointerWorld(event);
        if (!point) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        heldAimClick = true;
        onGroundCommand(point, `pointer:${event.pointerId}`);
      }}
      onclick={(event) => {
        if (heldAimClick) { heldAimClick = false; return; }
        const point = pointerWorld(event);
        if (point) onGroundCommand(point);
      }}></button>
  {/if}
  <div class="arena-light" aria-hidden="true"></div>
  <div class="arena-vignette" aria-hidden="true"></div>

  <div class="arena-camera" style:transform={cameraTransform}>
  <!-- Ground and all ground marks consume the same painted frame as skills and input. -->
  <div style="position:absolute;inset:0;pointer-events:none" style:transform={`translate(${camCssX}px, ${camCssY}px)`}>
    <ArenaGround frame={painted} material={groundMaterial} />
    <svg class="arena-ground-fx" viewBox={`0 0 ${painted.viewportCss.width} ${painted.viewportCss.height}`} preserveAspectRatio="none" aria-hidden="true"
         style={`--aoe-ms:${aoePulseMs(speed)}ms`}>
      <g transform={matrixAttribute(painted.worldToViewport)}>
        {#each aoePreviewRings as radiusM (radiusM)}
          <circle class="aoe-ring" data-aoe-radius={radiusM} cx={player.x} cy={player.y} r={radiusM} />
        {/each}
        {#if aoePreviewRings.length}<circle class="aoe-center" cx={player.x} cy={player.y} r={3.5 / painted.cssPixelsPerMeter} />{/if}
        {#each bodyRings as ring (ring.id)}
          <circle class="body-ring" cx={ring.x} cy={ring.y} r={ring.radiusM} />
        {/each}
        {#if selectedGroundActor && selectedGroundActor.hp > 0}
          <circle class="target-ground" data-target-ground data-ground-actor={selectedGroundActor.id} cx={selectedGroundActor.x} cy={selectedGroundActor.y}
            r={selectedGroundActor.radiusM * GROUND_MARKER_RADIUS_RATIO} pathLength="1" />
        {/if}
        {#if focusedGroundActor && focusedGroundActor.hp > 0}
          <circle class="focus-ground" data-focus-ground data-ground-actor={focusedGroundActor.id} cx={focusedGroundActor.x} cy={focusedGroundActor.y}
            r={focusedGroundActor.radiusM * GROUND_MARKER_RADIUS_RATIO} pathLength="1" />
        {/if}
        {#each hazardMarks as hazard (hazard.actionId)}
          {#if hazard.kind === 'ground' && hazard.radiusM > 0}
            <circle class="aoe-ring hazard-ring" data-hazard-action={hazard.actionId}
              data-hazard-heavy={mobSkillById(hazard.skillId ?? '')?.heavy ? 'true' : 'false'}
              cx={hazard.destX} cy={hazard.destY} r={hazard.radiusM} />
          {/if}
        {/each}
      </g>
    </svg>
  </div>

  <!-- Frame-painted skill layer: cancel the camera-div translate once (same fenced
    adapter as the actors' camCss offset) so frame-viewport content is not shifted twice. -->
  <div style="position:absolute;inset:0;pointer-events:none" style:transform={`translate(${camCssX}px, ${camCssY}px)`}>
  <SkillGeometryLayer {arena} frame={sampled} atUs={playhead} viewFrame={painted} inspect={inspect && showAiLog}
    {reducedMotion} releaseWorld={releasePointsWorld} bodyModels={bodyModels} skills={s.skills} {vfxMode}
    aim={aimSkill && aimArea ? { skillId: aimSkill, area: aimArea, source: player, rangeM: aimRange, valid: aimValid, targetName: aimTargetName } : null} />
  </div>
  {#each actors as view (view.actor.id)}
    {@const animationSourceName = !view.sheet || !loadedSprites.has(view.standaloneFrame?.href ?? view.sheet.href) ? 'icon' : animationSource(view.actor)}
    {@const sheetHref = view.sheet ? (view.standaloneFrame?.href ?? view.sheet.href) : null}
    <div class="arena-actor" class:hero={view.actor.id === 'player'} class:dead={view.actor.diedAtUs != null}
      class:target={targetId === view.actor.id} class:moving={view.actor.moving}
      data-arena-actor={view.actor.id} data-moving={view.actor.moving} data-action={view.action?.kind || 'idle'} data-animation={view.clipName} data-animation-source={animationSourceName} data-threat={view.threat ? 'true' : undefined}
      style:left={`${view.x + camCssX}px`} style:top={`${view.y + camCssY}px`} style:z-index={depthRanks.get(view.actor.id) ?? ACTOR_DEPTH_MIN}
      style:opacity={view.opacity} style={`--actor-height:${view.nameplateHeight}px;--actor-width:${view.width}px;--shadow-width:${view.shadowCss}px`}>
      <span class="foot-shadow" aria-hidden="true"></span>
      {#if view.threat}<span class="arena-threat" aria-hidden="true">!</span>{/if}
      <div class="arena-body" style:width={`${view.width}px`} style:height={`${view.height}px`}
        style:left={`${-view.width * view.anchor.x}px`} style:top={`${-view.height * view.anchor.y}px`}
        style:transform-origin={`${view.anchor.x * 100}% ${view.anchor.y * 100}%`}
        style:transform={`translate(${view.bodyX}px, ${view.bodyY}px) rotate(${view.deadRotation}deg) scale(${view.bodyScale})`} style:filter={`brightness(${view.brightness})`}>
        {#if view.sheet}
          {#if sheetHref && !loadedSprites.has(sheetHref) && view.fallback}
            <svg class="arena-sprite painted arena-sprite-pending" class:face-left={Math.cos(view.actor.facing) < 0} viewBox={view.fallback.viewBox} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
              <image href={view.fallback.href} width={view.fallback.imageWidth} height={view.fallback.imageHeight} />
            </svg>
          {/if}
          <svg class="arena-sprite" class:pixel-art={view.art?.pixelArt} class:mirror={view.mirror} viewBox={view.frame} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {#each view.equipmentLayers as layer, index (`${layer.kind}-${index}`)}
              <g transform={layer.transform}>
                <svg x="0" y="0" width={layer.imageWidth} height={layer.imageHeight}
                  viewBox={`0 0 ${layer.imageWidth} ${layer.imageHeight}`} preserveAspectRatio="none">
                  <defs>
                    <clipPath id={`${spriteClipPrefix}-equipment-${view.actor.id}-${index}`} clipPathUnits="userSpaceOnUse">
                      <rect x={layer.clipBounds[0]} y={layer.clipBounds[1]}
                        width={layer.clipBounds[2]-layer.clipBounds[0]} height={layer.clipBounds[3]-layer.clipBounds[1]} />
                    </clipPath>
                  </defs>
                  <image href={layer.href} width={layer.imageWidth} height={layer.imageHeight}
                    onerror={() => { if (view.art) failedArt.add(view.art); }}
                    clip-path={`url(#${spriteClipPrefix}-equipment-${view.actor.id}-${index})`} />
                </svg>
              </g>
            {/each}
            {#if view.sourceFrame}
              <defs>
                <clipPath id={`${spriteClipPrefix}-${view.actor.id}`} clipPathUnits="userSpaceOnUse">
                  <rect x={view.sourceFrame.offsetX} y={view.sourceFrame.offsetY} width={view.sourceFrame.width} height={view.sourceFrame.height} />
                </clipPath>
              </defs>
              <image href={view.standaloneFrame?.href ?? view.sheet.href}
                onload={() => { if (sheetHref) loadedSprites.add(sheetHref); }}
                onerror={() => { if (view.art) failedArt.add(view.art); }}
                x={view.sourceFrame.offsetX-view.sourceFrame.x} y={view.sourceFrame.offsetY-view.sourceFrame.y}
                width={view.standaloneFrame?.imageWidth ?? view.sheet.imageWidth ?? view.sheet.frameWidth * view.sheet.columns}
                height={view.standaloneFrame?.imageHeight ?? view.sheet.imageHeight ?? view.sheet.frameHeight * view.sheet.rows}
                clip-path={`url(#${spriteClipPrefix}-${view.actor.id})`} />
            {:else}
              <image href={view.standaloneFrame?.href ?? view.sheet.href}
                onload={() => { if (sheetHref) loadedSprites.add(sheetHref); }}
                onerror={() => { if (view.art) failedArt.add(view.art); }}
                width={view.standaloneFrame?.imageWidth ?? view.sheet.imageWidth ?? view.sheet.frameWidth * view.sheet.columns}
                height={view.standaloneFrame?.imageHeight ?? view.sheet.imageHeight ?? view.sheet.frameHeight * view.sheet.rows} />
            {/if}
          </svg>
        {:else if view.fallback}
          <svg class="arena-sprite painted" class:face-left={Math.cos(view.actor.facing) < 0} viewBox={view.fallback.viewBox} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
            <image href={view.fallback.href} width={view.fallback.imageWidth} height={view.fallback.imageHeight} />
          </svg>
        {/if}
      </div>
      {#if view.actor.mob && view.actor.diedAtUs == null}
        <button class="arena-inspect" type="button"
          onpointerdown={(event) => {
            if (event.altKey || !aimSkill || sm.byId[aimSkill]?.action?.kind !== 'ray-channel') return;
            event.currentTarget.setPointerCapture(event.pointerId);
            heldAimClick = true;
            onGroundCommand?.({ x: view.actor.x, y: view.actor.y }, `pointer:${event.pointerId}`);
          }} onclick={(event) => {
          if (heldAimClick) { heldAimClick = false; return; }
          // HUD owns its own events; below it the arena's priority is armed skill → target →
          // inspect → ground. Alt is the explicit inspect modifier, so a plain press can commit.
          const pick = resolveArenaPick({
            armedSkill: !!aimSkill,
            actorId: view.actor.id,
            inspect: event.altKey,
            actorIsTarget: targetId === view.actor.id,
            point: { x: view.actor.x, y: view.actor.y },
          });
          if (pick.kind === 'armed-skill') onGroundCommand?.(pick.point);
          else if (pick.kind === 'target') onFocusEnemy?.(view.actor.mob!);
          else if (pick.kind === 'inspect') onInspectEnemy?.(view.actor.mob!);
        }}
          aria-current={targetId === view.actor.id ? 'true' : undefined}
          aria-label={`Inspect ${fieldLabel(view.actor.mob)}, level ${view.actor.mob.level}, ${Math.ceil(view.actor.hp)} of ${Math.ceil(view.actor.hpMax)} health${view.statuses.length ? `, ${view.statuses.map((status) => `${status.label}${status.stacks > 1 ? ` ${status.stacks} stacks` : ''}`).join(', ')}` : ''}${onFocusEnemy ? ', click to focus this enemy' : ''}${onInspectEnemy ? ', Alt-click to inspect' : ''}`}
          style:width={`${Math.max(58, view.hitboxWidth)}px`} style:height={`${view.nameplateHeight}px`}>
          <span class="arena-name">{fieldLabel(view.actor.mob)} <small>{view.actor.mob.level}</small></span>
          <span class="arena-health" aria-hidden="true"><span style:width={`${Math.max(0, Math.min(100, view.actor.hp / view.actor.hpMax * 100))}%`}></span></span>
          {#if targetId === view.actor.id}<span class="target-tick" aria-hidden="true"></span>{/if}
        </button>
      {/if}
      {#if view.statuses.length && view.actor.diedAtUs == null}
        <span class="arena-statuses" role="img" aria-label={view.statuses.map((status) => `${status.label}${status.stacks > 1 ? ` ${status.stacks} stacks` : ''}${status.secLeft ? ` ${status.secLeft} seconds` : ''}`).join(', ')}>
          {#each view.statuses as status (status.name)}
            <span class="arena-status" style:color={status.colour} title={`${status.label}${status.stacks > 1 ? ` · ${status.stacks} stacks` : ''}${status.secLeft ? ` · ${status.secLeft}s` : ''}`}>
              <span class="icon-mask" style={`--glyph:url(${status.icon})`}></span>
              {#if status.stacks > 1}<small>{status.stacks}</small>{/if}
            </span>
          {/each}
        </span>
      {/if}
      {#if view.castProgress && view.cue && view.actor.diedAtUs == null}
        <div class="arena-cast" style:bottom={`${view.castLiftCss}px`}>
          <CombatCastBar cast={view.castProgress} name={view.cue.name ?? view.castProgress.skillId} />
        </div>
      {/if}
    </div>
  {/each}

  <svg class="arena-effects" viewBox={`0 0 ${view.width} ${view.height}`} preserveAspectRatio="none" aria-hidden="true">
    {#each effects as mark (mark.key)}
      {#if mark}
        <g class="arena-effect" class:critical={mark.event.crit} style:color={mark.event.skillId ? skillColour(mark.event.skillId) : mark.event.colour}>
          {#if quality !== 'minimal' && mark.flight && !mark.event.skillId && mark.age < 0 && !reducedMotion}
            <g transform={`translate(${mark.projectile.x} ${mark.projectile.y}) rotate(${mark.angle})`}>
              {#if mark.kind === 'arrow'}
                <path class="arrow-trail" d="M-36 0H8M2-4 10 0 2 4M-28-3-23 0-28 3" />
              {:else if mark.kind === 'lightning'}
                <path class="bolt-trail" d="M-48 0-29-5-23 3-10-4 0 0" /><circle class="projectile-core" r="4" />
              {:else}
                <path class="projectile-tail" d="M-38 0Q-16-8 5 0Q-16 8-38 0" /><circle class="projectile-core" r={mark.kind === 'fire' ? 6 : 4} />
              {/if}
            </g>
          {/if}
          {#if quality !== 'minimal' && mark.age >= 0 && mark.age <= .45 && !['drop', 'status', 'dodge'].includes(mark.kind) && mark.event.kind !== 'cast'
            && !(mark.event.skillId && stagedSkillVfx(mark.event.skillId))}
            <g class="arena-impact" transform={`translate(${mark.point.x} ${mark.point.y}) scale(${reducedMotion ? .75 : .7 + mark.age * 1.15})`} opacity={mark.opacity}>
              {#if mark.kind === 'slash'}
                <path class="slash-edge" d="M-45 26Q-10-32 45-30Q10-19-27 25Z" /><path class="slash-core" d="M-37 23Q-4-19 39-27Q5-9-26 24Z" />
              {:else if mark.kind === 'block'}
                <path class="block-arc" d="M-15-32Q-36 0-15 32M-8-27Q-26 0-8 27" />
              {:else if mark.kind === 'heal' || mark.kind === 'buff'}
                <path class="heal-rays" d="M-14 12V-15M0 17V-23M14 12V-15" />
              {:else if mark.kind === 'cold'}
                <path class="ice-hit" d="M-22 24-8-26 1 13 16-35 22 21Z" />
              {:else if mark.kind === 'lightning'}
                <path class="lightning-hit" d="M-8-39 8-15-3-11 14 14 3 12 13 39-13 7-1 8-17-17-6-16Z" />
              {:else if mark.kind === 'earth'}
                <path class="earth-hit" d="M-30 24-21-5-6-13 5 12 17-22 28-15 36 24Z" />
              {:else}
                <path class="spark-hit" d="M0-28 6-8 25-15 11 0 30 9 8 9 10 29-2 13-21 26-13 7-31 0-10-5-14-25-2-11Z" />
              {/if}
              {#if !reducedMotion && !['heal', 'buff', 'block'].includes(mark.kind)}
                {#each [-125, -70, 12, 68, 146] as angle}
                  <path class="contact-spark" transform={`rotate(${angle + mark.event.id % 25}) translate(0 ${-18 - mark.age * 55})`} d="M0-7 1 0-1 5-2 0Z" />
                {/each}
              {/if}
            </g>
          {/if}
          {#if mark.kind === 'drop' && mark.age >= 0}
            <g transform={`translate(${mark.ground.x + 13} ${mark.ground.y + 3})`} opacity={Math.min(1, mark.age * 12) * Math.max(0, 1 - mark.age / 1.7)}>
              <ellipse class="loot-shadow" rx="9" ry="3" /><path class="loot-glint" d="M0-19 2-3 10 0 2 3 0 15-2 3-10 0-2-3Z" /><path class="loot-shard" d="M-4 0 0-5 5 0 0 4Z" />
            </g>
          {:else if mark.event.value != null || mark.kind === 'block'}
            <text class="arena-number" class:incoming={mark.event.kind === 'taken'} class:defence={mark.kind === 'block' || mark.kind === 'dodge'}
              data-hit-event={mark.event.id} data-hit-index={mark.displayIndex} data-hit-count={mark.displayCount}
              data-hit-value={mark.value} data-feedback-at-us={eventTime(mark.event)}
              x={mark.point.x + (mark.displayCount > 1 ? -24 + ((mark.displayIndex - 1) % 8) * 8 : (mark.event.id % 3 - 1) * 20)}
              y={mark.point.y - 48 - mark.rise * (mark.displayCount > 1 ? .4 : 1)
                - (mark.displayCount > 1 ? ((mark.displayIndex - 1) % 8) * (mark.event.crit ? 40 : 32) : 0)} opacity={mark.popOpacity}>
              {damageLabel(mark.text, !!mark.event.crit)}
              {#if mark.displayCount > 1 || mark.collapsedCount}
                <tspan class="arena-hit-count" dx="5" dy="-7">{mark.collapsedCount ? `×${mark.collapsedCount}` : `${mark.displayIndex}/${mark.displayCount}`}</tspan>
              {/if}
            </text>
          {/if}
        </g>
      {/if}
    {/each}
    {#each hazardMarks as hazard (hazard.actionId)}
      {#if hazard.kind !== 'ground' || hazard.radiusM <= 0}
        {@const head = projectArenaPoint({ x: hazard.x, y: hazard.y })}
        <circle class="projectile-core" data-hazard-action={hazard.actionId} cx={head.x} cy={head.y} r="4" />
      {/if}
    {/each}
  </svg>
  </div>
  {/if}
  {#if fieldNote}
    <p class="arena-rest" class:arena-camp={fieldNote.camp} role={fieldNote.camp ? 'status' : undefined}>{fieldNote.text}</p>
  {/if}
</div>

<style>
  .arena-review { position: absolute; z-index: 5000; top: 4px; left: 30%; display: flex; align-items: center; gap: var(--spacing-xs); padding: var(--spacing-xs); background: var(--panel); color: var(--text); pointer-events: auto; font-size: var(--font-3xs); }
  .arena-review input[type='range'] { width: 170px; }
  .arena-review input[type='number'] { width: 80px; }
  .arena-inspect-geometry { position: absolute; top: 100%; left: 0; display: grid; gap: 2px; width: max-content; max-width: 72vw; max-height: 38vh; overflow: auto; padding: var(--spacing-xs); border: 1px solid var(--line); background: var(--panel); color: var(--text); font-family: var(--font-mono, monospace); font-size: var(--font-3xs); white-space: nowrap; }
  .arena-inspect-geometry [data-ai-state='in-range'] { color: var(--es); }
  .arena-inspect-geometry [data-ai-state='out-of-range'], .arena-inspect-geometry [data-ai-state='gone'] { color: var(--dim); }
  .arena-inspect-geometry [data-ai-state='blocked-contact'] { color: var(--es-lit); }
  .arena-inspect-geometry .inspect-head { color: var(--dim); }
  .combat-arena { position: absolute; inset: 0; overflow: hidden; isolation: isolate; pointer-events: none; color: var(--text); background: #202c27; }
  .arena-camera { position:absolute; inset:0; pointer-events:none; isolation:isolate; }
  .arena-ground-command { position: absolute; inset: 0; z-index: 0; padding: 0; border: 0; background: transparent; cursor: crosshair; pointer-events: auto; }
  .arena-ground-command:focus-visible { outline: 2px solid var(--focus); outline-offset: -4px; }
  .arena-light { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(115deg, rgba(229, 228, 160, .055), transparent 48%); mix-blend-mode: screen; }
  .arena-vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 54% 44%, transparent 25%, rgba(8, 14, 16, .12) 62%, rgba(5, 10, 12, .56) 100%); }
  .arena-ground-fx { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .aoe-ring { fill: none; stroke: var(--gold-lit); stroke-width: 1.1; opacity: .35; vector-effect: non-scaling-stroke; animation: aoe-breathe var(--aoe-ms, 1600ms) ease-in-out infinite alternate; }
  .aoe-ring[data-aoe-radius="1"] { stroke: var(--es-lit); }
  .aoe-ring[data-aoe-radius="2"] { stroke: var(--gold-lit); }
  .aoe-ring[data-aoe-radius="3"] { stroke: var(--hp-lit); }
  .aoe-ring.hazard-ring { stroke: var(--hp-lit); opacity: .5; }
  .aoe-ring.hazard-ring[data-hazard-heavy="false"] { stroke-dasharray: 5 4; opacity: .3; }
  .aoe-center { fill: var(--gold-lit); opacity: .75; }
  .body-ring { fill: none; stroke: currentColor; stroke-width: 1; opacity: .16; vector-effect: non-scaling-stroke; }
  @keyframes aoe-breathe { from { opacity: .2; } to { opacity: .6; } }
  .reduced-motion .aoe-ring { animation: none; opacity: .45; }
  .arena-actor { position: absolute; width: 0; height: 0; }
  .foot-shadow { position: absolute; left: calc(var(--shadow-width) * -.5); top: -1px; width: var(--shadow-width); height: calc(var(--shadow-width) * .24); border-radius: 50%; background: rgba(7, 12, 9, .58); filter: blur(3px); transform: rotate(-12deg); }
  .hero .foot-shadow { height: calc(var(--shadow-width) * .2); }
  .arena-body { position: absolute; transform-origin: 50% 88%; }
  .arena-sprite { display: block; width: 100%; height: 100%; overflow: hidden; filter: drop-shadow(2px 4px 3px rgba(7, 14, 10, .36)); }
  .arena-sprite-pending { position: absolute; inset: 0; }
  .arena-sprite.pixel-art { image-rendering: pixelated; }
  .arena-sprite.mirror { transform: scaleX(-1); }
  .painted.face-left { transform: scaleX(-1); }
  .dead .arena-sprite { filter: saturate(.65) brightness(.65) drop-shadow(2px 3px 2px rgba(7, 14, 10, .3)); }
  .target-ground, .focus-ground { fill: none; vector-effect: non-scaling-stroke; filter: drop-shadow(0 1px 1px #263322); }
  .target-ground { stroke: var(--gold-lit); stroke-width: 1.7; stroke-dasharray: .18 .07; opacity: .9; }
  .focus-ground { stroke: var(--es-lit); stroke-width: 1.5; stroke-dasharray: .03 .22; opacity: .8; }
  .arena-inspect { position: absolute; bottom: -6px; left: 0; translate: -50% 0; padding: 0; border: 0; border-radius: 2px; outline-offset: 5px; background: transparent; color: var(--text); cursor: pointer; pointer-events: auto; }
  .arena-inspect:hover, .arena-inspect:focus-visible { background: transparent; }
  .arena-inspect:focus-visible { outline: none; }
  .arena-inspect:focus-visible .arena-name { outline: 2px solid var(--focus); outline-offset: 2px; }
  .arena-health { position: absolute; bottom: calc(100% + 2px); left: 50%; translate: -50% 0; width: 44px; height: 4px; padding: 1px; box-sizing: content-box; border-radius: 2px; background: rgba(7, 12, 10, .85); box-shadow: 0 2px 4px rgba(0, 0, 0, .3); }
  .arena-health > span { display: block; height: 100%; background: #c8674d; border-radius: 1px; }
  .target .arena-health > span { background: var(--hp-lit); }
  .arena-name { position: absolute; bottom: calc(100% + 13px); left: 50%; translate: -50% 0; width: max-content; max-width: 190px; padding: 2px 5px; border-radius: 2px; background: rgba(9, 16, 13, .86); color: #f2eedb; opacity: 0; font: 600 12px/1.3 var(--ui); white-space: nowrap; text-shadow: 0 2px 3px rgba(0, 0, 0, .7); }
  .arena-name small { color: #c5cba9; font-size: 10px; }
  .target .arena-name, .arena-inspect:hover .arena-name, .arena-inspect:focus-visible .arena-name { opacity: 1; }
  .arena-threat { position: absolute; left: 50%; translate: -50% 0; bottom: calc(var(--actor-height) + 6px); display: grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; background: rgba(120, 28, 20, .9); color: #ffe9c9; font: 700 11px/1 var(--ui); box-shadow: 0 0 6px rgba(255, 92, 64, .55); }
  .target-tick { position: absolute; left: 50%; bottom: calc(100% + 34px); translate: -50% 0; width: 0; height: 0; border: 3px solid transparent; border-top-color: var(--gold-lit); }
  .arena-statuses { position: absolute; left: 30px; bottom: calc(var(--actor-height) - 7px); display: flex; gap: 3px; width: max-content; }
  .arena-status { position: relative; display: grid; place-items: center; width: 17px; height: 17px; border-radius: 2px; background: rgba(7, 15, 11, .86); }
  .arena-status > .icon-mask { width: 13px; height: 13px; }
  .arena-status small { position: absolute; right: -3px; bottom: -4px; color: #faf1cf; font: 600 9px/1 var(--ui); text-shadow: 0 1px 2px #101c14; }
  .arena-cast { position: absolute; left: 0; translate: -50% 0; width: max-content; }
  .arena-effects { position: absolute; inset: 0; z-index: 1200; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .arena-effect { fill: currentColor; }
  .projectile-tail { opacity: .6; }
  .projectile-core { fill: #fff4cf; filter: drop-shadow(0 0 4px currentColor); }
  .arrow-trail { fill: none; stroke: #f3e4b4; stroke-width: 1.6; stroke-linecap: round; }
  .bolt-trail { fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; }
  .slash-edge { opacity: .68; }
  .slash-core { fill: #fff2d1; opacity: .85; }
  .block-arc { fill: none; stroke: #d0e6ed; stroke-width: 3; }
  .heal-rays { fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; }
  .ice-hit { opacity: .9; stroke: #e1faff; stroke-width: 1; }
  .lightning-hit { fill: #f4f0cf; stroke: currentColor; stroke-width: 1; }
  .earth-hit { opacity: .8; stroke: #d6ccb2; stroke-width: .7; }
  .spark-hit { opacity: .65; }
  .contact-spark { fill: #ffeac1; }
  .loot-shadow { fill: rgba(8, 13, 8, .65); }
  .loot-glint { fill: #f4d994; opacity: .8; }
  .loot-shard { fill: #fff4cb; }
  .arena-number { fill: #f7edce; stroke: #162117; stroke-width: 3px; paint-order: stroke; font: 600 22px/1 var(--ui); font-variant-numeric: tabular-nums; text-anchor: middle; }
  .critical .arena-number { fill: #ffe1a1; font-size: 29px; font-weight: 750; }
  .arena-number.incoming { fill: #ffb09a; font-size: 20px; }
  .arena-number.defence { fill: #d1e3e7; font-size: 13px; font-weight: 600; }
  .arena-hit-count { fill: var(--gold-lit); font: 600 11px var(--ui); }
  .arena-rest { position: absolute; left: 54%; top: 64%; translate: -50% 0; margin: 0; color: #dae0c4; font: 14px/1.4 var(--ui); text-shadow: 0 2px 3px #12201a; }
  .arena-camp { padding: 5px 11px; border: 1px solid color-mix(in srgb, var(--gold-lit) 42%, transparent); border-radius: 2px; background: rgba(8, 14, 11, .82); color: var(--gold-lit); font-weight: 600; white-space: nowrap; }
  @media (prefers-reduced-motion: reduce) { .arena-body { transform: none !important; } }
</style>
