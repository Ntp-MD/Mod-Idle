<script lang="ts">
  import { onMount } from 'svelte';
  import SkillGeometryLayer from './SkillGeometryLayer.svelte';
  import { E, sm } from '../../engine/client';
  import { skillAreaSnapshot } from '@engine/skill-area';
  import { elementIcon, skillIcon } from '../../icon';
  import { statusLabel } from '@sim/combat/mobStatus';
  import { mobSkillById } from '@sim/combat/mobSkills';
  import type { Character } from '@sim/core/player';
  import type { FxEvent, GameState, Mob } from '@sim/core/types';
  import { arenaDistance, arenaSkillRange, attackGeometryFor, mobAttackProfile, sampleCombatArena, type CombatArena, type CombatArenaActor, type CombatArenaAction } from '@sim/combat/combat-arena';
  import { arenaArt, arenaArtExtent, arenaArtForSpecies, type ArenaCharacterArt, type ArenaSpriteSheet } from './arena/arena-art';
  import { equippedPlayerArt, playerEquipmentLayers, playerSkillContactPose, type ArenaEquipmentLayer } from './arena/arena-equipped-player';
  import { actorArt, actorProfile } from './combat-actor';
  import { arenaMobShape, arenaSkillShape } from '../fx';
  import { aoePulseMs, groundCirclePath, groundDistance } from './arena-space';
  import { ARENA_VIEW, arenaActionPose, arenaActorAction, arenaActorPixelScale, arenaCameraOffset, arenaCastCharge, arenaEventTiming, arenaFlightProgress, arenaFlightWindow, arenaIncomingHazards, arenaNearestTarget, arenaFacingSector, arenaFieldNote, arenaPhaseOffset, arenaScreenAngleFor, arenaSheetDirection, arenaSpriteFrame, arenaSpriteIndex, createArenaGait, createArenaPlaybackClock, describeArenaTarget, projectArenaPoint, unprojectArenaPoint, type ArenaTargetRead } from './combat-arena-view';
  import { fieldLabel } from '../hud/hud';
  import { ARENA_DIRECTIONS, arenaGroundBounds } from '../../presentation/arena-camera';
  import { combatEffectLevel, type CombatEffectLevel } from './combat-presentation';
  import { resolveArenaPick } from './arena-picking';
  import { resolveAnimation, shippedAnimationManifest } from './animation/manifest';

  let { arena, s, c, ring, speed = 1, paused = false, spritePreviewSpecies = null, spritePreviewVariant = null, aoePreview = false, iconActors = false,
    focusId = null, aimSkill = null, inspect = false, effectLevel = 'auto', keyboardAim = null,
    onReviewPause, onReviewStep, onInspectEnemy, onFocusEnemy, onGroundCommand, onAimPoint, onVitals, onTargetRead }: {
    arena: CombatArena; s: GameState; c: Character; ring: FxEvent[]; speed?: number; paused?: boolean;
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
    /** Keyboard aim reticle; a pointer move writes the same world point through `onAimPoint`. */
    keyboardAim?: { x: number; y: number } | null;
    onAimPoint?: (point: { x: number; y: number }) => void;
    inspect?: boolean;
    onReviewPause?: () => void;
    onReviewStep?: () => void;
    onInspectEnemy?: (mob: Mob) => void;
    onFocusEnemy?: (mob: Mob) => void;
    /** A deliberate local move order in arena meters, clamped to the field bounds. */
    onGroundCommand?: (point: { x: number; y: number }) => void;
    onVitals?: (vitals: { hp: number; es: number; mana: number }) => void;
    /** The persistent target read for the HUD bar — identity, kind, offscreen bearing and range. */
    onTargetRead?: (read: ArenaTargetRead | null) => void;
  } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let stage = $state({ width: ARENA_VIEW.width, height: ARENA_VIEW.height });
  let playhead = $state(0);
  let reviewAt = $state<number | null>(null);
  let reviewPlaying = $state(false);
  let reviewWall = 0;
  let motionReview = $state<'system' | 'full' | 'reduced'>('system');
  let showAiLog = $state(false);
  const spriteClipPrefix = $props.id();
  let systemReducedMotion = $state(false);
  const quality = $derived(combatEffectLevel(effectLevel, speed));
  const reducedMotion = $derived((inspect && motionReview !== 'system' ? motionReview === 'reduced' : systemReducedMotion)
    || quality !== 'full');
  const effectsCalm = $derived(quality !== 'full');
  let reviewArt = $state<ArenaCharacterArt | null>(null);
  const playerArt = equippedPlayerArt;
  let aimPointer = $state<{ x: number; y: number } | null>(null);
  const gait = createArenaGait();
  const playbackTime = createArenaPlaybackClock();
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
  const scale = $derived(stage.height / ARENA_VIEW.height);
  const sampled = $derived(sampleCombatArena(arena, playhead));
  const player = $derived(sampled.player);
  const nearestTargetId = $derived(arenaNearestTarget(sampled.mobs, player));
  /** The action or decision that owns the highlight, never a detached renderer acquisition. */
  const committedTargetId = $derived.by(() => {
    const action = arenaActorAction(arena, sampled.player, playhead);
    const id = action?.targetId ?? sampled.intent?.targetId;
    return id && id !== 'player' ? id : undefined;
  });
  const targetId = $derived(committedTargetId
    ? sampled.mobs[committedTargetId]?.hp > 0 ? committedTargetId : undefined
    : focusId && sampled.mobs[focusId]?.hp > 0 ? focusId : nearestTargetId);
  const focusTargetId = $derived(focusId && focusId !== targetId && sampled.mobs[focusId]?.hp > 0
    ? focusId : null);
  const camera = $derived(arenaCameraOffset(player));
  /** F37 — one named read for the bar: committed strike, requested focus, or the next body,
   *  with an offscreen bearing so a focus that leaves the view stays readable. */
  const targetRead = $derived(describeArenaTarget({
    mobs: sampled.mobs, player, committedId: committedTargetId, focusId, camera, view: ARENA_VIEW,
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
  const cameraTransform = $derived(`translate(${-camera.x * stage.width / ARENA_VIEW.width}px,${-camera.y * scale}px)`);
  // Pad the ground beyond its reachable camera coverage so no edge shows a missing strip.
  const groundBounds = $derived.by(() => {
    const bounds = arenaGroundBounds(arena.bounds);
    const pad = 220;
    return { left: bounds.left - pad, top: bounds.top - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 };
  });
  // Dev-only calibration rings: one arena unit is one meter, drawn through the ground projection.
  const aoePreviewRings = $derived(aoePreview
    ? [1, 2, 3].map((radiusM) => ({ radiusM, path: groundCirclePath({ x: player.x, y: player.y }, radiusM, 48) }))
    : []);
  // Every body stands on its own ground: one subtle ring per living actor, sized by the
  // sim's body radius through the same projection VFX footprints use — the footprint an
  // AoE circle tests against, drawn where the body actually is.
  const bodyRings = $derived(
    [sampled.player, ...Object.values(sampled.mobs)]
      .filter((actor) => actor.hp > 0 && (actor.radiusM ?? 0) > 0)
      .map((actor) => ({ id: actor.id, path: groundCirclePath({ x: actor.x, y: actor.y }, actor.radiusM ?? 0.25, 20) }))
  );
  const aimDefinition = $derived(aimSkill ? sm.byId[aimSkill] : undefined);
  const aimRange = $derived(aimSkill ? arenaSkillRange(aimSkill) : 0);
  const aimArea = $derived.by(() => {
    if (!aimSkill || !aimDefinition) return undefined;
    const focus = targetId ? sampled.mobs[targetId] : undefined;
    const self = ['buff', 'heal', 'aura'].includes(aimDefinition.type ?? '');
    const point = self ? player : keyboardAim ?? aimPointer ?? focus ?? player;
    return skillAreaSnapshot(self ? { origin: 'caster', radius_m: 0 }
      : aimDefinition.action?.kind === 'chain-strike' ? { origin: 'target', radius_m: 0 }
      : aimDefinition.area ?? { origin: 'target' as const, radius_m: 0 },
      player, point, targetId ?? '', player.facing);
  });
  const aimValid = $derived.by(() => {
    if (!aimSkill || !aimArea) return false;
    if (aimDefinition?.area?.origin === 'caster') return true;
    if (!Number.isFinite(aimRange)) return true;
    return groundDistance(player, aimArea.center) <= aimRange + 1e-7;
  });
  const aoePreviewCenter = $derived(projectArenaPoint({ x: player.x, y: player.y }));
  // In-flight incoming shots own their telegraph: the committed span at the playhead, never the
  // caster's pose (F38). Ground shots draw their landing circle; projectiles draw their head.
  const hazardMarks = $derived(arenaIncomingHazards(arena, playhead).filter(hazard => !hazard.skillId));
  const fieldNote = $derived(arenaFieldNote(s));
  $effect(() => {
    const ids = new Set(['player', ...Object.keys(sampled.mobs)]);
    gait.retain(ids);
  });

  function pointerWorld(event: PointerEvent | MouseEvent): { x: number; y: number } | undefined {
    if (!host) return undefined;
    const rect = host.getBoundingClientRect();
    const view = {
      x: (event.clientX - rect.left) / rect.width * ARENA_VIEW.width + camera.x,
      y: (event.clientY - rect.top) / rect.height * ARENA_VIEW.height + camera.y,
    };
    const point = unprojectArenaPoint(view);
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
    imp: async () => {
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
    const resize = new ResizeObserver(([entry]) => { stage = { width: entry.contentRect.width, height: entry.contentRect.height }; });
    if (host) resize.observe(host);
    playhead = playbackTime(arena, performance.now(), speed, paused);
    let frame = 0;
    const advance = (wall: number) => {
      if (reviewPlaying && reviewAt != null) {
        if (!document.hidden) reviewAt = Math.min(arena.nowUs, reviewAt + Math.max(0, wall - reviewWall) * arena.unitsPerSec * speed / 1000);
        reviewWall = wall;
        if (reviewAt >= arena.nowUs) reviewPlaying = false;
      }
      const liveAt = playbackTime(arena, wall, speed, paused);
      playhead = reviewAt ?? liveAt;
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); query.removeEventListener('change', motion); };
  });

  const actors = $derived.by(() => {
    const all = [player, ...Object.values(sampled.mobs), ...sampled.bodies]
      .map((actor) => actorView(actor))
      .sort((a, b) => a.ground.y - b.ground.y || a.actor.id.localeCompare(b.actor.id));
    // Viewport culling with a label margin: a body whose feet and nameplate are outside the
    // stage cannot paint anything, so it is not built. The target and the focused body always
    // stay, even at the edge, because their medallions carry the read.
    const camX = camera.x * stage.width / ARENA_VIEW.width;
    const camY = camera.y * scale;
    const marginX = 220, marginY = 320;
    return all.filter((view) => view.actor.id === 'player'
      || view.actor.id === targetId || view.actor.id === focusTargetId
      || (view.x - camX > -marginX && view.x - camX < stage.width + marginX
        && view.y - camY > -marginY && view.y - camY < stage.height + marginY));
  });
  const actorViews = $derived(new Map(actors.map((view) => [view.actor.id, view])));
  /** Neutral attachment fallback uses visible body height, not transparent runtime-cell padding. */
  function bodyLift(id: string | undefined, share: number, fallback: number): number {
    const view = id ? actorViews.get(id) : undefined;
    return view ? view.bodyHeight * share : fallback;
  }

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
    if (actor.id === 'player') return playerArt;
    const speciesId = actor.mob?.speciesId;
    // A preview encounter spawns one species, so its loaded sheet owns every body on the field.
    if (spritePreviewSpecies && reviewArt && actor.mob) return reviewArt;
    return arenaArtForSpecies(speciesId, spritePreviewSpecies && !spritePreviewVariant ? undefined : actor.mob?.variant);
  }

  /** A source crop kept inside the runtime cell and the image, so it cannot pull in a neighbour
   *  frame (repeat) or be clipped by the cell edge (cut). */
  function containedFrame(sheet: ArenaSpriteSheet | undefined, index: number, standalone = sheet?.frameImages?.[index]) {
    const frame = standalone?.sourceFrame ?? sheet?.sourceFrames?.[index];
    if (!frame || !sheet) return undefined;
    const imageWidth = standalone?.imageWidth ?? sheet?.imageWidth ?? sheet!.frameWidth * sheet!.columns;
    const imageHeight = standalone?.imageHeight ?? sheet?.imageHeight ?? sheet!.frameHeight * sheet!.rows;
    let x = frame.x, y = frame.y, width = frame.width, height = frame.height;
    let offsetX = frame.offsetX, offsetY = frame.offsetY;
    if (offsetX < 0) { x -= offsetX; width += offsetX; offsetX = 0; }
    if (offsetY < 0) { y -= offsetY; height += offsetY; offsetY = 0; }
    width = Math.max(1, Math.min(width, sheet.frameWidth - offsetX, imageWidth - x));
    height = Math.max(1, Math.min(height, sheet.frameHeight - offsetY, imageHeight - y));
    return { ...frame, x, y, width, height, offsetX, offsetY };
  }

  function playerDeathTime() {
    let diedAtUs: number | undefined;
    for (const frame of arena.frames) {
      if (frame.atUs > playhead) break;
      if (frame.player.hp > 0) diedAtUs = undefined;
      else diedAtUs ??= frame.atUs;
    }
    return diedAtUs;
  }

  function actorView(sampledActor: CombatArenaActor & { diedAtUs?: number }) {
    const actor = sampledActor.id === 'player' && sampledActor.hp <= 0 && sampledActor.hpMax > 0
      ? { ...sampledActor, diedAtUs: playerDeathTime() } : sampledActor;
    const ground = projectArenaPoint(actor);
    const art = artFor(actor);
    // One nominal projected sector per actor; each clip then falls back to the sheets it owns.
    const nominal = arenaFacingSector(actor.facing,
      actor.facingSector == null ? undefined : ARENA_DIRECTIONS[actor.facingSector]);
    const sheetFor = (clip: ArenaCharacterArt['clips']['idle'] | undefined) =>
      clip?.[arenaSheetDirection(nominal, clip)];
    const dead = actor.diedAtUs != null;
    const action = dead ? undefined : arenaActorAction(arena, actor, playhead, art?.clips.attack);
    const attackSheet = sheetFor(art?.clips.attack);
    const pose = action ? arenaActionPose(action, playhead, arena.unitsPerSec, attackSheet) : undefined;
    const gaitSample = actor.diedAtUs == null ? gait.sample(arena, actor.id, playhead) : undefined;
    // A stopped actor holds its last foot beat briefly instead of snapping to idle mid-step.
    const settle = !actor.moving && !!gaitSample
      && playhead - gaitSample.lastMovedAtUs < 90 * arena.unitsPerSec / 1000;
    const deathSheet = sheetFor(art?.clips.death);
    const hitSheet = sheetFor(art?.clips.hit);
    const hitDurationMs = hitSheet ? hitSheet.frames * hitSheet.frameMs : 0;
    const hit = ring.filter((event) => {
      if (!((actor.id === 'player' && event.kind === 'taken') || (event.mobId === actor.id && event.kind === 'hit'))) return false;
      const damage = event.hpDamage != null || event.esDamage != null ? (event.hpDamage ?? 0) + (event.esDamage ?? 0) : event.value ?? 0;
      const elapsedMs = (playhead - eventTime(event)) / arena.unitsPerSec * 1000;
      return damage > 0 && elapsedMs >= 0 && elapsedMs < Math.max(160, hitDurationMs);
    }).sort((a, b) => {
      const damage = (event: FxEvent) => event.hpDamage != null || event.esDamage != null
        ? (event.hpDamage ?? 0) + (event.esDamage ?? 0) : event.value ?? 0;
      return damage(b) - damage(a) || b.id - a.id;
    })[0];
    const hitElapsedMs = hit ? (playhead - eventTime(hit)) / arena.unitsPerSec * 1000 : 0;
    // A light reaction may replace recovery, but never protected preparation, release or contact.
    const showHit = hit && hitElapsedMs < hitDurationMs
      && (!pose || pose.phase === 'recovery');
    const clipName = dead ? deathSheet ? 'death' : 'idle'
      : showHit ? 'hit' : pose ? 'attack' : actor.moving || settle ? 'walk' : 'idle';
    const sheet = sheetFor(art?.clips[clipName]) ?? sheetFor(art?.clips.idle);
    const anchor = sheet?.anchor ?? (sheet ? art?.anchor : null) ?? { x: .5, y: 1 };
    const fallback = actorArt(actor.mob);
    const depth = .94 + Math.max(0, Math.min(1, (ground.y - 300) / 500)) * .14;
    const targetHeight = art?.displayHeight ?? (actorProfile(actor.mob).boss ? 166 : 132) * actorProfile(actor.mob).height;
    const projectedHeight = targetHeight * depth * scale;
    // Keep the half-meter idle footprint stable through movement and camera depth.
    const restSheet = sheetFor(art?.clips.idle) ?? sheet;
    const restFrame = containedFrame(restSheet, restSheet?.startFrame ?? 0);
    const referenceSheet=art?.clips.idle.south ?? Object.values(art?.clips.idle ?? {})[0] ?? restSheet;
    const bodyReference=containedFrame(referenceSheet,referenceSheet?.startFrame ?? 0) ?? restFrame;
    const restAnchor = restSheet?.anchor ?? art?.anchor ?? anchor;
    // Clips have different cell heights (an attack raises a fist, a death flattens the body).
    // Measuring on the idle silhouette keeps the creature the same size when the clip changes.
    const pixelScale = art?.pixelArt && restSheet && bodyReference
      ? arenaActorPixelScale(bodyReference.width,scale) : null;
    const height = pixelScale != null && sheet ? pixelScale * sheet.frameHeight : projectedHeight;
    const width = height * (sheet ? sheet.frameWidth / sheet.frameHeight : 1.05);
    // The nameplate rides above the tallest authored frame, not the idle pose, so an attack or a
    // raised weapon never grows through the plate.
    const extent = arenaArtExtent(art);
    const artTop = extent?.top ?? restFrame?.offsetY ?? 0;
    const nameplateHeight = pixelScale != null && restSheet
      ? (restAnchor.y * restSheet.frameHeight - artTop) * pixelScale
      : restSheet
        ? (restAnchor.y * restSheet.frameHeight - artTop) * height / restSheet.frameHeight
        : height;
    // One frame for both: the plate and the click target cover every authored frame, so a raised
    // weapon or a wide attack can never stick outside the hitbox.
    const anchorX = restAnchor.x * (restSheet?.frameWidth ?? 0);
    const artReach = extent && restSheet
      ? Math.max(anchorX - extent.left, extent.right - anchorX)
      : (restFrame?.width ?? width) / 2;
    const hitboxWidth = restSheet
      ? Math.max(58, artReach * 2 * (pixelScale ?? height / restSheet.frameHeight))
      : width * .75;
    const age = actor.diedAtUs == null ? 0 : Math.max(0, (playhead - actor.diedAtUs) / arena.unitsPerSec);
    const attackElapsedMs = pose?.elapsedMs ?? 0;
    const attackDurationMs = attackSheet ? attackSheet.frames * attackSheet.frameMs : 520;
    const impactMs = attackSheet?.impactMs ?? 340;
    const direction = action?.targetX != null && action?.targetY != null
      ? projectArenaPoint({ x: action.targetX, y: action.targetY }) : ground;
    const angle = Math.atan2(direction.y - ground.y, direction.x - ground.x);
    // The lunge belongs to the active strike, not to the walk, the preparation or a held channel.
    const lunge = pose?.phase === 'contact' ? 1
      : pose?.phase === 'recovery' && !action?.channel
        ? Math.max(0, 1 - (attackElapsedMs - impactMs) / Math.max(1, attackDurationMs - impactMs))
        : 0;
    const reach = art?.pixelArt || reducedMotion || !pose || clipName !== 'attack'
      ? 0 : lunge * (actionStyle(action!, actor.mob) === 'slash' ? 8 : -3);
    const cue = action?.skillId ? (actor.mob ? mobSkillById(action.skillId) : sm.byId[action.skillId]) : null;
    const statuses = Object.entries(actor.statuses || {}).filter(([, line]) => line.stacks > 0 || line.secLeft > 0).map(([name, line]) => {
      const element = Object.entries(E.elements.status_of as Record<string, string>).find(([, status]) => status === name)?.[0] || 'physical';
      return { name, stacks: line.stacks, secLeft: Math.max(0, Math.ceil(line.secLeft)), label: statusLabel(name), icon: elementIcon(element),
        colour: (E.elements.colour as Record<string, string>)[element] || E.elements.physical_colour };
    });
    // Walk phase comes from voluntary distance; idle keeps a stable per-actor offset.
    const walkSheet = sheetFor(art?.clips.walk);
    const walkCycleMs = walkSheet ? walkSheet.frames * walkSheet.frameMs : 0;
    const idleCycleMs = restSheet ? restSheet.frames * restSheet.frameMs : 1000;
    const walkPhase = clipName === 'walk' && gaitSample ? gaitSample.phase : 0;
    const idleOffset = arenaPhaseOffset(actor.id) * idleCycleMs;
    const elapsedMs = clipName === 'death' ? age * 1000 : clipName === 'hit' ? hitElapsedMs
      : pose ? attackElapsedMs
      : clipName === 'walk' && walkCycleMs > 0 ? walkPhase * walkCycleMs
      : playhead / arena.unitsPerSec * 1000 + idleOffset;
    const frameIndex = sheet ? arenaSpriteIndex(sheet, elapsedMs, reducedMotion, clipName === 'death') : 0;
    const skillContactPose = actor.id === 'player' && pose?.phase === 'contact' && action?.skillId
      ? playerSkillContactPose(s, c, action.skillId, nominal) : undefined;
    const standaloneFrame = skillContactPose ?? sheet?.frameImages?.[frameIndex];
    // Tight-crop sheets index one authored rect per frame; an overrun must clamp to that list, never
    // fall back to a cell crop that would pull neighbouring frames into view.
    const sourceFrameCount = standaloneFrame ? sheet?.frameImages?.length ?? 0 : sheet?.sourceFrames?.length ?? 0;
    const sourceFrame = sourceFrameCount
      ? containedFrame(sheet, Math.min(frameIndex, sourceFrameCount - 1), standaloneFrame)
      : undefined;
    // Generated attack poses can fill much more of the fixed canvas than the idle sprite.
    // Normalize their visible body height against this direction's idle pose, pivoting at the feet.
    const bodyScale = actor.id === 'player' && art?.pixelArt && clipName === 'attack' && restFrame?.height && sourceFrame?.height
      ? restFrame.height / sourceFrame.height : 1;
    const equipmentLayers: ArenaEquipmentLayer[] = actor.id === 'player' && standaloneFrame && !standaloneFrame.equipmentBaked
      ? playerEquipmentLayers({ state: s, character: c, frame: standaloneFrame,
        bodyHeight: restFrame?.height ?? 0, clip: clipName, phase: pose?.phase, facing: actor.facing })
      : [];
    // A basic swing already leaving the mob is the one tell the cast bar never covers.
    const threat = !!action && action.kind === 'swing' && !action.skillId && action.targetId === 'player'
      && (action.timing ? playhead < action.timing.impactAtUs : playhead < action.endsAtUs);
    return { actor, ground, action, threat, art, sheet, standaloneFrame, equipmentLayers, anchor, fallback, height, width, bodyScale,
      walkPhase, sourceHitElapsedMs: showHit ? hitElapsedMs : undefined,
      castFraction: arenaCastCharge(action?.timing, playhead),
      bodyHeight: restFrame ? restFrame.height * (pixelScale ?? height / (sheet?.frameHeight ?? 1)) : height,
      nameplateHeight, hitboxWidth, age, cue, statuses, clipName, sourceFrame, mirror: Boolean(sheet?.mirror),
      frame: sourceFrame && sheet ? `0 0 ${sheet.frameWidth} ${sheet.frameHeight}`
        : sheet ? arenaSpriteFrame(sheet, elapsedMs, reducedMotion, clipName === 'death') : '',
      x: art?.pixelArt ? Math.round(ground.x / ARENA_VIEW.width * stage.width) : ground.x / ARENA_VIEW.width * stage.width,
      y: art?.pixelArt ? Math.round(ground.y * scale) : ground.y * scale,
      bodyX: art?.pixelArt ? Math.round(Math.cos(angle) * reach * scale) : Math.cos(angle) * reach * scale,
      bodyY: art?.pixelArt ? Math.round(Math.sin(angle) * reach * scale) : Math.sin(angle) * reach * scale,
      brightness: hit && hitElapsedMs < 160 ? 1.6 : 1,
      opacity: actor.diedAtUs == null || actor.id === 'player' ? 1 : Math.max(0, 1 - age / 1.7),
      deadRotation: actor.diedAtUs == null || deathSheet || reducedMotion ? 0
        : Math.min(1, age / .32) * (Math.cos(arenaScreenAngleFor({ x: Math.cos(actor.facing), y: Math.sin(actor.facing) })) < 0 ? -78 : 78),
      shadow: actor.mob ? actorProfile(actor.mob).boss ? 47 : 29 : 23,
    };
  }

  function actionStyle(action: CombatArenaAction, mob?: Mob) {
    if (mob) {
      const skill = action.skillId ? mobSkillById(action.skillId) : null;
      return arenaMobShape(skill, mob);
    }
    const skill = action.skillId ? sm.byId[action.skillId] : null;
    return arenaSkillShape(skill, sm.weaponGroupOf(c.weaponName), c.weaponElement);
  }

  function eventTime(event: FxEvent) { return event.atUs ?? event.sec * arena.unitsPerSec; }
  const effects = $derived(ring
    .filter((event) => ['hit', 'taken', 'block', 'heal', 'buff', 'drop', 'cast'].includes(event.kind))
    .map((event) => effectView(event))
    .filter((mark) => mark != null)
    // Minimal keeps the reads that explain a threat — damage taken, a block, a cast — and drops
    // the cosmetic trails. Threat rings and cast bars live outside this list and never fade.
    .filter((mark) => quality !== 'minimal'
      || ['taken', 'block', 'cast'].includes(mark.event.kind))
    .sort((a,b) => Number(b.event.kind === 'cast')-Number(a.event.kind === 'cast'))
    .slice(0, quality === 'minimal' ? 6 : speed >= 4 ? 8 : 14));

  function effectView(event: FxEvent) {
    const atUs = eventTime(event);
    const age = (playhead - atUs) / arena.unitsPerSec;
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
    } else if (age < -.26 || age > .72) return null;
    const target = targetActorId === 'player' ? player : sampled.mobs[targetActorId || ''] || sampled.bodies.find((body) => body.id === targetActorId)
      || arena.bodies.find((body) => body.id === targetActorId);
    const actionTarget = action?.targetX != null && action.targetY != null ? { x: action.targetX, y: action.targetY } : undefined;
    const targetPoint = target ?? actionTarget;
    if (!targetPoint) return null;
    const sourceActor = sourceId === 'player' ? player : sampled.mobs[sourceId || '']
      || sampled.bodies.find((body) => body.id === sourceId) || arena.bodies.find((body) => body.id === sourceId);
    const point = projectArenaPoint(actionTarget && action?.targetId === targetActorId ? actionTarget : targetPoint);
    const source = projectArenaPoint(action ? { x: action.x, y: action.y } : sourceActor || target!);
    const kind = event.kind === 'heal' || event.kind === 'buff' || event.kind === 'drop' ? event.kind
      : event.kind === 'block' ? /block/i.test(event.text) ? 'block' : 'dodge'
      : action ? actionStyle(action, sourceActor?.mob) : 'status';
    const flight = !!action?.ranged && event.via !== 'dot' && event.kind !== 'cast';
    const flightWindow = arenaFlightWindow(action?.timing ?? baseTiming, arena.unitsPerSec);
    const progress = arenaFlightProgress(playhead, flightWindow, age);
    const targetLift = bodyLift(targetActorId, .52, 48);
    const sourceLift = bodyLift(sourceActor?.id ?? 'player', .6, 58);
    const pointY = point.y - targetLift;
    const sourceY = source.y - sourceLift;
    return { key: String(event.id), event, age, timing, kind, telegraph: cast,
      point: { x: point.x, y: pointY }, ground: point, source: { x: source.x, y: sourceY }, sourceGround: source, flight,
      projectile: { x: source.x + (point.x - source.x) * progress, y: sourceY + (pointY - sourceY) * progress - Math.sin(progress * Math.PI) * (kind === 'arrow' ? 18 : 5) },
      angle: Math.atan2(pointY - sourceY, point.x - source.x) * 180 / Math.PI,
      opacity: age < 0 ? 1 : Math.max(0, 1 - age / .5),
      popOpacity: age < 0 ? 0 : Math.min(1, age / .035) * Math.max(0, 1 - age / .72),
      rise: reducedMotion ? 0 : Math.max(0, age) * 43,
    };
  }
</script>

<div class="combat-arena" class:reduced-motion={reducedMotion} class:fast={speed >= 4} bind:this={host}
  data-combat-arena data-arena-time={Math.round(playhead)} aria-label="Live combat arena">
  {#if inspect && import.meta.env.DEV}
    <div class="arena-review" aria-label="Arena animation inspection">
      <button type="button" onclick={onReviewStep}>Advance simulation 1s</button>
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
  <div class="arena-camera arena-ground-world" style:transform={cameraTransform}>
    <img class="arena-ground" src={arenaArt.background.href} alt="" aria-hidden="true" draggable="false"
      style:left={`${groundBounds.left * stage.width / ARENA_VIEW.width}px`}
      style:top={`${groundBounds.top * scale}px`}
      style:width={`${groundBounds.width * stage.width / ARENA_VIEW.width}px`}
      style:height={`${groundBounds.height * scale}px`} />
  </div>
  {#if onGroundCommand}
    <button class="arena-ground-command" type="button" tabindex="-1"
      aria-label={aimSkill ? 'Confirm the aimed skill at this ground point' : 'Issue a local move order at this ground point'}
      onpointermove={(event) => {
        if (!aimSkill) return;
        aimPointer = pointerWorld(event) ?? null;
        if (aimPointer) onAimPoint?.(aimPointer);
      }}
      onpointerleave={() => { aimPointer = null; }}
      onclick={(event) => {
        const point = pointerWorld(event);
        if (point) onGroundCommand(point);
      }}></button>
  {/if}
  <div class="arena-light" aria-hidden="true"></div>
  <div class="arena-vignette" aria-hidden="true"></div>

  <div class="arena-camera" style:transform={cameraTransform}>

  {#if aoePreviewRings.length}
    <svg class="arena-ground-fx" viewBox={`0 0 ${ARENA_VIEW.width} ${ARENA_VIEW.height}`} preserveAspectRatio="none" aria-hidden="true"
         style={`--aoe-ms:${aoePulseMs(speed)}ms`}>
      {#each aoePreviewRings as ring (ring.radiusM)}
        <path class="aoe-ring" data-aoe-radius={ring.radiusM} d={ring.path} />
      {/each}
      <circle class="aoe-center" cx={aoePreviewCenter.x} cy={aoePreviewCenter.y} r="3.5" />
    </svg>
  {/if}

  <SkillGeometryLayer {arena} frame={sampled} atUs={playhead}
    aim={aimSkill && aimArea ? { skillId: aimSkill, area: aimArea, source: player, rangeM: aimRange, valid: aimValid } : null} />
  <svg class="arena-ground-fx" viewBox={`0 0 ${ARENA_VIEW.width} ${ARENA_VIEW.height}`} preserveAspectRatio="none" aria-hidden="true">
    {#each bodyRings as ring (ring.id)}
      <path class="body-ring" d={ring.path} />
    {/each}
  </svg>

  {#each actors as view (view.actor.id)}
    {@const animationSourceName = iconActors ? 'icon' : animationSource(view.actor)}
    <div class="arena-actor" class:hero={view.actor.id === 'player'} class:dead={view.actor.diedAtUs != null}
      class:target={targetId === view.actor.id} class:moving={view.actor.moving}
      data-arena-actor={view.actor.id} data-moving={view.actor.moving} data-action={view.action?.kind || 'idle'} data-animation={view.clipName} data-animation-source={animationSourceName} data-threat={view.threat ? 'true' : undefined}
      style:left={`${view.x}px`} style:top={`${view.y}px`} style:z-index={Math.max(1, Math.round(view.ground.y - camera.y))}
      style:opacity={view.opacity} style={`--actor-height:${view.nameplateHeight}px;--actor-width:${view.width}px;--shadow-width:${view.shadow * scale}px`}>
      <span class="foot-shadow" aria-hidden="true"></span>
      {#if view.threat}<span class="arena-threat" aria-hidden="true">!</span>{/if}
      {#if targetId === view.actor.id && view.actor.diedAtUs == null}
        <svg class="target-ground" viewBox="0 0 100 40" aria-hidden="true"><path d="M6 17Q12 7 31 5M69 5Q88 7 94 17M94 23Q88 33 69 35M31 35Q12 33 6 23" /></svg>
      {/if}
      {#if focusTargetId === view.actor.id && view.actor.diedAtUs == null}
        <svg class="focus-ground" viewBox="0 0 100 40" aria-hidden="true"><path d="M50 2v7M50 31v7M14 20h7M79 20h7" /></svg>
      {/if}
      <div class="arena-body" style:width={`${view.width}px`} style:height={`${view.height}px`}
        style:left={`${-view.width * view.anchor.x}px`} style:top={`${-view.height * view.anchor.y}px`}
        style:transform-origin={`${view.anchor.x * 100}% ${view.anchor.y * 100}%`}
        style:transform={`translate(${view.bodyX}px, ${view.bodyY}px) rotate(${view.deadRotation}deg) scale(${view.bodyScale})`} style:filter={`brightness(${view.brightness})`}>
        {#if view.sheet}
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
                x={view.sourceFrame.offsetX-view.sourceFrame.x} y={view.sourceFrame.offsetY-view.sourceFrame.y}
                width={view.standaloneFrame?.imageWidth ?? view.sheet.imageWidth ?? view.sheet.frameWidth * view.sheet.columns}
                height={view.standaloneFrame?.imageHeight ?? view.sheet.imageHeight ?? view.sheet.frameHeight * view.sheet.rows}
                clip-path={`url(#${spriteClipPrefix}-${view.actor.id})`} />
            {:else}
              <image href={view.standaloneFrame?.href ?? view.sheet.href}
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
        <button class="arena-inspect" type="button" onclick={(event) => {
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
      {#if view.action?.skillId && view.cue && view.actor.diedAtUs == null}
        <span class="arena-cast" style:bottom={`${view.nameplateHeight + 16 * scale}px`} title={view.cue.name} aria-hidden="true">
          <span class="icon-mask" style={`--glyph:url(${skillIcon(view.action.skillId, view.actor.mob ? 'attack' : sm.byId[view.action.skillId]?.type)})`}></span>
          <span>{view.cue.name}</span>
          {#if view.castFraction != null}
            <span class="arena-cast-bar" aria-hidden="true"><span style:width={`${Math.round(view.castFraction * 100)}%`}></span></span>
          {/if}
        </span>
      {/if}
    </div>
  {/each}

  <svg class="arena-effects" viewBox={`0 0 ${ARENA_VIEW.width} ${ARENA_VIEW.height}`} preserveAspectRatio="none" aria-hidden="true">
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
          {#if quality !== 'minimal' && !mark.event.skillId && mark.age >= 0 && mark.age <= .45 && !['drop', 'status', 'dodge'].includes(mark.kind)}
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
          {:else if mark.event.value || mark.kind === 'block'}
            <text class="arena-number" class:incoming={mark.event.kind === 'taken'} class:defence={mark.kind === 'block' || mark.kind === 'dodge'}
              x={mark.point.x + (mark.event.id % 3 - 1) * 12} y={mark.point.y - 48 - mark.rise} opacity={mark.popOpacity}>
              {damageLabel(mark.event.text, !!mark.event.crit)}
            </text>
          {/if}
        </g>
      {/if}
    {/each}
    {#each hazardMarks as hazard (hazard.actionId)}
      {#if hazard.kind === 'ground' && hazard.radiusM > 0}
        <path class="aoe-ring hazard-ring" data-hazard-action={hazard.actionId}
          data-hazard-heavy={mobSkillById(hazard.skillId ?? '')?.heavy ? 'true' : 'false'}
          d={groundCirclePath({ x: hazard.destX, y: hazard.destY }, hazard.radiusM, 40)} />
      {:else}
        {@const head = projectArenaPoint({ x: hazard.x, y: hazard.y })}
        <circle class="projectile-core" data-hazard-action={hazard.actionId} cx={head.x} cy={head.y} r="4" />
      {/if}
    {/each}
  </svg>
  </div>
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
  .arena-ground { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; user-select: none; }
  .arena-ground-command { position: absolute; inset: 0; z-index: 0; padding: 0; border: 0; background: transparent; cursor: crosshair; pointer-events: auto; }
  .arena-ground-command:focus-visible { outline: 2px solid var(--focus); outline-offset: -4px; }
  .arena-light { position: absolute; inset: 0; background: linear-gradient(115deg, rgba(229, 228, 160, .055), transparent 48%); mix-blend-mode: screen; }
  .arena-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at 54% 44%, transparent 25%, rgba(8, 14, 16, .12) 62%, rgba(5, 10, 12, .56) 100%); }
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
  .arena-sprite.pixel-art { image-rendering: pixelated; }
  .arena-sprite.mirror { transform: scaleX(-1); }
  .painted.face-left { transform: scaleX(-1); }
  .dead .arena-sprite { filter: saturate(.65) brightness(.65) drop-shadow(2px 3px 2px rgba(7, 14, 10, .3)); }
  .target-ground { position: absolute; width: 78px; height: 31px; left: -39px; top: -13px; color: var(--gold-lit); opacity: .9; }
  .target-ground path { fill: none; stroke: currentColor; stroke-width: 1.7; filter: drop-shadow(0 1px 1px #263322); }
  .focus-ground { position: absolute; width: 92px; height: 37px; left: -46px; top: -17px; color: var(--es-lit); opacity: .8; }
  .focus-ground path { fill: none; stroke: currentColor; stroke-width: 1.5; filter: drop-shadow(0 1px 1px #263322); }
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
  .arena-cast { position: absolute; left: 0; translate: -50% 0; display: flex; align-items: center; gap: 6px; width: max-content; max-width: 185px; color: var(--gold-lit); font: 600 11px/1.2 var(--ui); text-shadow: 0 2px 3px #0a100d; }
  .arena-cast > .icon-mask { flex: none; width: 21px; height: 21px; filter: drop-shadow(0 2px 2px #0a100d); }
  .arena-cast > span:last-child { padding: 3px 5px; border-radius: 2px; background: rgba(8, 15, 13, .82); }
  .arena-cast-bar { position: absolute; left: 27px; right: 0; bottom: -5px; height: 2px; border-radius: 1px; background: rgba(8, 15, 13, .85); overflow: hidden; }
  .arena-cast-bar > span { display: block; height: 100%; background: var(--gold-lit); }
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
  .fast .arena-cast > span:last-child { display: none; }
  .arena-rest { position: absolute; left: 54%; top: 64%; translate: -50% 0; margin: 0; color: #dae0c4; font: 14px/1.4 var(--ui); text-shadow: 0 2px 3px #12201a; }
  .arena-camp { padding: 5px 11px; border: 1px solid color-mix(in srgb, var(--gold-lit) 42%, transparent); border-radius: 2px; background: rgba(8, 14, 11, .82); color: var(--gold-lit); font-weight: 600; white-space: nowrap; }
  @media (prefers-reduced-motion: reduce) { .arena-body { transform: none !important; } }
</style>
