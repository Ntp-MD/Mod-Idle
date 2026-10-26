<script lang="ts">
  import { onMount } from 'svelte';
  import ArenaSkillVfx from './ArenaSkillVfx.svelte';
  import ArenaGroundAura from './ArenaGroundAura.svelte';
  import { authoredVfxFor } from './arena-authored-vfx';
  import { groundAuraFootprint, projectVfxFootprint } from './arena-vfx-space';
  import { ACTIVE_VFX, activeVfxElement, activeVfxMechanics, activeVfxPlaybackDuration } from './arena-active-vfx';
  import { E, sm } from '../../engine/client';
  import { elementIcon, skillIcon } from '../../icon';
  import { statusLabel } from '../../sim/mobStatus';
  import { mobSkillById } from '../../sim/mobSkills';
  import type { Character } from '../../sim/player';
  import type { FxEvent, GameState, Mob } from '../../sim/types';
  import { sampleCombatArena, type CombatArena, type CombatArenaActor, type CombatArenaAction } from '../../sim/combat-arena';
  import { arenaArt, arenaArtForSpecies, type ArenaCharacterArt, type ArenaSpriteSheet } from './arena/arena-art';
  import { auraFxFor, skillFxFor } from './arena-skill-effects';
  import { actorArt, actorProfile } from './combat-actor';
  import { arenaMobShape, arenaSkillShape } from '../fx';
  import { aoePulseMs, groundCirclePath } from './arena-space';
  import { ARENA_VIEW, arenaActorAction, arenaActorPixelScale, arenaCameraOffset, arenaAttackElapsedMs, arenaDirection, arenaEventTiming, arenaFieldNote, arenaPlaybackTime, arenaRangedShots, arenaSpriteFrame, arenaSpriteIndex, projectArenaPoint, unprojectArenaPoint } from './combat-arena-view';
  import ArenaFxSprite from './ArenaFxSprite.svelte';
  import { fieldLabel } from '../hud/hud';

  let { arena, s, c, ring, speed = 1, paused = false, spritePreviewSpecies = null, spritePreviewVariant = null, aoePreview = false,
    focusId = null, onInspectEnemy, onFocusEnemy, onGroundCommand, onVitals }: {
    arena: CombatArena; s: GameState; c: Character; ring: FxEvent[]; speed?: number; paused?: boolean;
    spritePreviewSpecies?: string | null;
    spritePreviewVariant?: { speciesId: string; variantId: string } | null;
    aoePreview?: boolean;
    focusId?: string | null;
    onInspectEnemy?: (mob: Mob) => void;
    onFocusEnemy?: (mob: Mob) => void;
    /** A deliberate local move order in arena meters, clamped to the field bounds. */
    onGroundCommand?: (point: { x: number; y: number }) => void;
    onVitals?: (vitals: { hp: number; es: number; mana: number }) => void;
  } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let stage = $state({ width: ARENA_VIEW.width, height: ARENA_VIEW.height });
  let playhead = $state(0);
  const spriteClipPrefix = $props.id();
  let reducedMotion = $state(false);
  let reviewArt = $state<ArenaCharacterArt | null>(null);
  let anchorNow = 0;
  let anchorWall = 0;
  let anchorSpeed = 1;
  let frozenAt: number | null = null;
  let previousVitals = '';
  const scale = $derived(stage.height / ARENA_VIEW.height);
  const sampled = $derived(sampleCombatArena(arena, playhead));
  const player = $derived(sampled.player);
  const targetId = $derived(focusId && sampled.mobs[focusId]?.hp > 0 ? focusId
    : Object.values(sampled.mobs).filter((actor) => actor.hp > 0)
      .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0]?.id);
  const camera = $derived(arenaCameraOffset(player,sampled.mobs[targetId ?? '']));
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
      .map((actor) => ({ id: actor.id, path: groundCirclePath({ x: actor.x, y: actor.y }, actor.radiusM ?? 0.45, 20) }))
  );
  const aoePreviewCenter = $derived(projectArenaPoint({ x: player.x, y: player.y }));
  const fieldNote = $derived(arenaFieldNote(s));

  function skillColour(id: string) {
    const element = sm.byId[id]?.element || mobSkillById(id)?.element;
    const artElement = activeVfxElement(id, element);
    return (E.elements.colour as Record<string, string>)[artElement] || '#d8d1bc';
  }

  function actorSkillEffects(actor: CombatArenaActor, dead: boolean) {
    if (dead) return { auras: [], buffs: [], curses: [] };
    const auras = actor.id === 'player'
      ? Object.entries(s.skills.auras || {}).filter(([, active]) => active).map(([id]) => id)
      : (actor.mob?.skillIds || []).filter((id) => mobSkillById(id)?.mode === 'aura');
    const buffs = actor.id === 'player'
      ? Object.entries(s.skills.buffUp || {}).filter(([id, left]) => left > 0 && !!sm.byId[id]).map(([id]) => id)
      : [];
    const curses = actor.mob
      ? Object.values(s.curses[actor.mob.id] || {}).filter((line) => line.secLeft > 0 && !!line.from).map((line) => line.from!)
      : [];
    const visuals = (ids: string[], auraOnly = false) => ids.flatMap((id) => {
      if (!auraOnly && authoredVfxFor(id)) return [];
      const fx = auraOnly ? auraFxFor(id) : skillFxFor(id);
      return fx ? [{ id, path: fx.path, colour: skillColour(id) }] : [];
    });
    return { auras: visuals(auras, true), buffs: visuals(buffs), curses: visuals(curses) };
  }

  $effect(() => {
    const now = arena.nowUs;
    const isPaused = paused;
    const wall = performance.now();
    if (now !== anchorNow) {
      anchorNow = now;
      anchorWall = wall;
      frozenAt = null;
    } else if (speed !== anchorSpeed && !isPaused) {
      anchorWall = wall - Math.max(0, playhead - (now - arena.unitsPerSec)) / (arena.unitsPerSec * speed) * 1000;
    }
    anchorSpeed = speed;
    if (isPaused) frozenAt ??= playhead;
    else if (frozenAt != null) {
      anchorWall = wall - Math.max(0, frozenAt - (now - arena.unitsPerSec)) / (arena.unitsPerSec * speed) * 1000;
      frozenAt = null;
    }
  });

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
    const motion = () => { reducedMotion = query.matches; };
    motion();
    query.addEventListener('change', motion);
    const resize = new ResizeObserver(([entry]) => { stage = { width: entry.contentRect.width, height: entry.contentRect.height }; });
    if (host) resize.observe(host);
    anchorNow = arena.nowUs;
    anchorWall = performance.now();
    playhead = Math.max(0, anchorNow - arena.unitsPerSec);
    let frame = 0;
    const advance = (wall: number) => {
      playhead = frozenAt ?? arenaPlaybackTime(anchorNow, arena.unitsPerSec, wall - anchorWall, speed, paused);
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); query.removeEventListener('change', motion); };
  });

  const actors = $derived([player, ...Object.values(sampled.mobs), ...sampled.bodies]
    .map((actor) => actorView(actor))
    .sort((a, b) => a.ground.y - b.ground.y || a.actor.id.localeCompare(b.actor.id)));

  function artFor(actor: CombatArenaActor): ArenaCharacterArt | null {
    if (actor.id === 'player') return arenaArt.hero;
    const speciesId = actor.mob?.speciesId;
    // A preview encounter spawns one species, so its loaded sheet owns every body on the field.
    if (spritePreviewSpecies && reviewArt && actor.mob) return reviewArt;
    return arenaArtForSpecies(speciesId, spritePreviewSpecies && !spritePreviewVariant ? undefined : actor.mob?.variant);
  }

  /** The union of every authored frame in runtime-cell units. */
  function artExtent(art: ArenaCharacterArt | null) {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const clip of Object.values(art?.clips ?? {})) {
      for (const sheet of Object.values(clip ?? {})) {
        for (const frame of sheet?.sourceFrames ?? []) {
          left = Math.min(left, frame.offsetX);
          top = Math.min(top, frame.offsetY);
          right = Math.max(right, frame.offsetX + frame.width);
          bottom = Math.max(bottom, frame.offsetY + frame.height);
        }
      }
    }
    return Number.isFinite(left) ? { left, top, right, bottom } : null;
  }

  /** A source crop kept inside the runtime cell and the image, so it cannot pull in a neighbour
   *  frame (repeat) or be clipped by the cell edge (cut). */
  function containedFrame(sheet: ArenaSpriteSheet | undefined, index: number) {
    const frame = sheet?.sourceFrames?.[index];
    if (!frame) return undefined;
    const imageWidth = sheet.imageWidth ?? sheet.frameWidth * sheet.columns;
    const imageHeight = sheet.imageHeight ?? sheet.frameHeight * sheet.rows;
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
    const sheetFor = (clip: ArenaCharacterArt['clips']['idle'] | undefined) => clip?.[arenaDirection(actor.facing, clip)];
    const dead = actor.diedAtUs != null;
    const action = dead ? undefined : arenaActorAction(arena, actor, playhead, art?.clips.attack);
    const attackSheet = sheetFor(art?.clips.attack);
    const deathSheet = sheetFor(art?.clips.death);
    const hitSheet = sheetFor(art?.clips.hit);
    const hitDurationMs = hitSheet ? hitSheet.frames * hitSheet.frameMs : 0;
    const hit = ring.find((event) => {
      if (!((actor.id === 'player' && event.kind === 'taken') || (event.mobId === actor.id && event.kind === 'hit'))) return false;
      const damage = event.hpDamage != null || event.esDamage != null ? (event.hpDamage ?? 0) + (event.esDamage ?? 0) : event.value ?? 0;
      const elapsedMs = (playhead - eventTime(event)) / arena.unitsPerSec * 1000;
      return damage > 0 && elapsedMs >= 0 && elapsedMs < Math.max(160, hitDurationMs);
    });
    const hitElapsedMs = hit ? (playhead - eventTime(hit)) / arena.unitsPerSec * 1000 : 0;
    // Keep anticipation/contact visible; an actual hit may interrupt attack recovery.
    const showHit = hit && hitElapsedMs < hitDurationMs
      && (!action || playhead >= action.atUs + (attackSheet?.frameMs ?? 100) / 1000 * arena.unitsPerSec);
    const clipName = dead ? deathSheet ? 'death' : 'idle'
      : showHit ? 'hit' : action ? 'attack' : actor.moving ? 'walk' : 'idle';
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
    const extent = artExtent(art);
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
    const attackElapsedMs = action ? arenaAttackElapsedMs(action, playhead, arena.unitsPerSec, attackSheet) : 0;
    const attackDurationMs = attackSheet ? attackSheet.frames * attackSheet.frameMs : 520;
    const attackPhase = action ? Math.max(0, Math.min(1, attackElapsedMs / attackDurationMs)) : 0;
    const direction = action?.targetX != null && action?.targetY != null
      ? projectArenaPoint({ x: action.targetX, y: action.targetY }) : ground;
    const angle = Math.atan2(direction.y - ground.y, direction.x - ground.x);
    const reach = reducedMotion || !action || clipName !== 'attack' ? 0 : Math.sin(attackPhase * Math.PI) * (actionStyle(action, actor.mob) === 'slash' ? 8 : -3);
    const cue = action?.skillId ? (actor.mob ? mobSkillById(action.skillId) : sm.byId[action.skillId]) : null;
    const statuses = Object.entries(actor.statuses || {}).filter(([, line]) => line.stacks > 0 || line.secLeft > 0).map(([name, line]) => {
      const element = Object.entries(E.elements.status_of as Record<string, string>).find(([, status]) => status === name)?.[0] || 'physical';
      return { name, stacks: line.stacks, label: statusLabel(name), icon: elementIcon(element),
        colour: (E.elements.colour as Record<string, string>)[element] || E.elements.physical_colour };
    });
    const elapsedMs = clipName === 'death' ? age * 1000 : clipName === 'hit' ? hitElapsedMs
      : action ? attackElapsedMs : playhead / arena.unitsPerSec * 1000;
    const frameIndex = sheet ? arenaSpriteIndex(sheet, elapsedMs, reducedMotion, clipName === 'death') : 0;
    // Tight-crop sheets index one authored rect per frame; an overrun must clamp to that list, never
    // fall back to a cell crop that would pull neighbouring frames into view.
    const sourceFrame = sheet?.sourceFrames?.length
      ? containedFrame(sheet, Math.min(frameIndex, sheet.sourceFrames.length - 1))
      : undefined;
    const skillEffects = actorSkillEffects(actor, dead);
    return { actor, ground, action, art, sheet, anchor, fallback, height, width, nameplateHeight, hitboxWidth, age, cue, statuses, clipName, sourceFrame, mirror: Boolean(sheet?.mirror), ...skillEffects,
      frame: sourceFrame && sheet ? `0 0 ${sheet.frameWidth} ${sheet.frameHeight}`
        : sheet ? arenaSpriteFrame(sheet, elapsedMs, reducedMotion, clipName === 'death') : '',
      x: art?.pixelArt ? Math.round(ground.x / ARENA_VIEW.width * stage.width) : ground.x / ARENA_VIEW.width * stage.width,
      y: art?.pixelArt ? Math.round(ground.y * scale) : ground.y * scale,
      bodyX: art?.pixelArt ? Math.round(Math.cos(angle) * reach * scale) : Math.cos(angle) * reach * scale,
      bodyY: art?.pixelArt ? Math.round(Math.sin(angle) * reach * scale) : Math.sin(angle) * reach * scale,
      brightness: hit && hitElapsedMs < 160 ? 1.6 : 1,
      opacity: actor.diedAtUs == null || actor.id === 'player' ? 1 : Math.max(0, 1 - age / 1.7),
      deadRotation: actor.diedAtUs == null || deathSheet || reducedMotion ? 0 : Math.min(1, age / .32) * (Math.cos(actor.facing) < 0 ? -78 : 78),
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
  // The shared number ring holds only 24 events. Long status visuals keep their own transient clock.
  const retainedCasts = new Map<number,FxEvent>();
  let longCasts = $state<FxEvent[]>([]);
  let lastFxClock = 0;
  let lastFxAction = 0;
  $effect(() => {
    let changed = false;
    if (arena.nowUs < lastFxClock || arena.actionSeq < lastFxAction) { retainedCasts.clear(); changed = true; }
    lastFxClock = arena.nowUs; lastFxAction = arena.actionSeq;
    for (const event of ring) {
      const definition = skillFxFor(event.skillId);
      if (event.kind === 'cast' && definition && sm.byId[event.skillId ?? '']
        && activeVfxPlaybackDuration(definition.shape,sm.byId[event.skillId!],event.skillId) > 2 && !retainedCasts.has(event.id)) {
        retainedCasts.set(event.id,event); changed = true;
      }
    }
    for (const [id,event] of retainedCasts) {
      const definition = skillFxFor(event.skillId)!;
      const impactAtUs = arenaEventTiming(event, arena)?.impactAtUs ?? eventTime(event);
      if ((playhead-impactAtUs)/arena.unitsPerSec > activeVfxPlaybackDuration(definition.shape,sm.byId[event.skillId!],event.skillId)) {
        retainedCasts.delete(id); changed = true;
      }
    }
    if (changed) longCasts = [...retainedCasts.values()];
  });
  const effects = $derived([...ring,...longCasts.filter(event => !ring.some(current => current.id === event.id))]
    .filter((event) => ['hit', 'taken', 'block', 'heal', 'buff', 'drop', 'cast'].includes(event.kind))
    .map((event) => effectView(event))
    .filter((mark) => mark != null)
    .sort((a,b) => Number(b.event.kind === 'cast' && b.activeFx)-Number(a.event.kind === 'cast' && a.activeFx))
    .slice(0, speed >= 4 ? 8 : 14));
  const rangedShots = $derived(arenaRangedShots(arena, playhead).map((shot) => {
    const ground = projectArenaPoint({ x: shot.x, y: shot.y });
    return { ...shot, ground, art: shot.element ? 'orb/3a' : 'wave-1224', colour: shot.element ?? 'physical' };
  }));

  function effectView(event: FxEvent) {
    const atUs = eventTime(event);
    const age = (playhead - atUs) / arena.unitsPerSec;
    const skillFx = skillFxFor(event.skillId);
    const activeFx = !!event.skillId && !!sm.byId[event.skillId] && sm.byId[event.skillId].type !== 'aura' && event.via !== 'dot' && !!skillFx && !!ACTIVE_VFX[skillFx.shape];
    const stormFx = activeFx && ['firestorm', 'blizzard', 'sandStorm', 'whirlwind'].includes(skillFx!.shape);
    const castVisual = event.kind === 'cast' && !!skillFx;
    if (event.kind === 'cast' && !castVisual) return null;
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
    const castTiming = arenaEventTiming(event, arena) ?? action?.timing;
    const timing = activeFx && castTiming ? {
      startedAtSec: castTiming.startedAtUs / arena.unitsPerSec,
      releasedAtSec: castTiming.releaseAtUs / arena.unitsPerSec,
      impactAtSec: castTiming.impactAtUs / arena.unitsPerSec,
      nowSec: playhead / arena.unitsPerSec,
    } : undefined;
    const vfxAge = timing ? timing.nowSec - timing.impactAtSec
      : age - (activeFx && event.kind === 'hit' && event.via === 'cast' && skillFx?.projectile ? .24 : 0);
    const presentationAge = timing ? vfxAge : age;
    if ((timing ? playhead < castTiming!.startedAtUs : age < -.26)
      || presentationAge > (event.kind === 'drop' ? 1.7 : activeFx ? Math.max(.72, activeVfxPlaybackDuration(skillFx!.shape,sm.byId[event.skillId!],event.skillId) + (activeVfxMechanics(sm.byId[event.skillId!]).hits-1)*.43) : .72)) return null;
    const target = targetActorId === 'player' ? player : sampled.mobs[targetActorId || ''] || sampled.bodies.find((body) => body.id === targetActorId)
      || arena.bodies.find((body) => body.id === targetActorId);
    const actionTarget = action?.targetX != null && action.targetY != null ? { x: action.targetX, y: action.targetY } : undefined;
    const targetPoint = target || actionTarget;
    if (!targetPoint) return null;
    const sourceActor = sourceId === 'player' ? player : sampled.mobs[sourceId || '']
      || sampled.bodies.find((body) => body.id === sourceId) || arena.bodies.find((body) => body.id === sourceId);
    const point = projectArenaPoint(actionTarget && action?.targetId === targetActorId ? actionTarget : targetPoint);
    let source = projectArenaPoint(action && castTiming ? {x:action.x,y:action.y} : activeFx && (event.skillId?.startsWith('buff.') || event.skillId?.startsWith('heal.') || skillFx?.shape === 'whirlwind')
      ? sourceActor || target! : action ? { x: action.x, y: action.y } : sourceActor || target!);
    if (activeFx && skillFx?.shape === 'chainLightning' && event.kind === 'hit') {
      const prior = ring.filter(other => other.kind === 'hit' && other.skillId === event.skillId && other.id < event.id && Math.abs(eventTime(other) - atUs) < 2).sort((a,b) => b.id-a.id)[0];
      const previousTarget = prior?.mobId ? sampled.mobs[prior.mobId] || sampled.bodies.find(body => body.id === prior.mobId) : undefined;
      if (previousTarget) source = projectArenaPoint(previousTarget);
    }
    const castArea = event.skillOutcome?.area ?? action?.area;
    const vfxArea = castArea ? projectVfxFootprint(castArea) : undefined;
    const relatedHits = ring.filter(other => other.kind === 'hit' && other.via === 'cast' && other.skillId === event.skillId
      && (event.actionId != null ? other.actionId === event.actionId : Math.abs(eventTime(other)-atUs) < 2));
    const resolveGround = (id:string) => {
      const actor = sampled.mobs[id] || sampled.bodies.find(body => body.id === id) || arena.bodies.find(body => body.id === id);
      return actor ? projectArenaPoint(actor) : undefined;
    };
    const resolvedIds = event.skillOutcome?.targets ?? [...new Set(relatedHits.map(hit => hit.mobId).filter((id):id is string => !!id))];
    const targets = resolvedIds.map(resolveGround).filter((position):position is {x:number;y:number} => !!position);
    const spreadTargets = (event.skillOutcome?.spread ?? []).flatMap(spread => spread.to).map(resolveGround).filter((position):position is {x:number;y:number} => !!position);
    const consumed = (event.skillOutcome?.consumed ?? []).reduce((total,status) => total+status.stacks,0);
    const kind = event.kind === 'heal' || event.kind === 'buff' || event.kind === 'drop' ? event.kind
      : event.kind === 'block' ? /block/i.test(event.text) ? 'block' : 'dodge'
      : action ? actionStyle(action, sourceActor?.mob) : 'status';
    const flight = !!action && (skillFx?.projectile || (!skillFx && !['slash', 'block', 'dodge', 'status', 'heal', 'buff', 'drop'].includes(kind)))
      && event.via !== 'dot' && event.kind !== 'cast';
    const progress = Math.max(0, Math.min(1, (age + .24) / .24));
    return { event, age, vfxAge, timing, vfxArea, kind, skillFx, activeFx, stormFx, targets, spreadTargets, consumed, castTargetFx: event.kind === 'cast' && sm.byId[event.skillId || '']?.type === 'curse',
      point: { x: point.x, y: point.y - 48 }, ground: point, source: { x: source.x, y: source.y - 58 }, flight,
      projectile: { x: source.x + (point.x - source.x) * progress, y: source.y - 58 + (point.y - source.y + 10) * progress - Math.sin(progress * Math.PI) * (kind === 'arrow' ? 18 : 5) },
      skillProjectile: { x: source.x + (point.x - source.x) * progress, y: source.y - 58 + (point.y - source.y + 10) * progress - Math.sin(progress * Math.PI) * 12 },
      angle: Math.atan2(point.y - source.y + 10, point.x - source.x) * 180 / Math.PI,
      opacity: age < 0 ? 1 : Math.max(0, 1 - age / .5),
      popOpacity: vfxAge < 0 ? 0 : Math.min(1, vfxAge / .035) * Math.max(0, 1 - vfxAge / .72),
      rise: reducedMotion ? 0 : Math.max(0, age) * 43,
    };
  }
</script>

<div class="combat-arena" class:reduced-motion={reducedMotion} class:fast={speed >= 4} bind:this={host}
  data-combat-arena data-arena-time={Math.round(playhead)} aria-label="Live combat arena">
  <img class="arena-ground" src={arenaArt.background.href} alt="" aria-hidden="true" draggable="false" />
  {#if onGroundCommand}
    <button class="arena-ground-command" type="button" tabindex="-1"
      aria-label="Issue a local move order at this ground point"
      onclick={(event) => {
        if (!host) return;
        const rect = host.getBoundingClientRect();
        const view = {
          x: (event.clientX - rect.left) / rect.width * ARENA_VIEW.width + camera.x,
          y: (event.clientY - rect.top) / rect.height * ARENA_VIEW.height + camera.y,
        };
        const point = unprojectArenaPoint(view);
        onGroundCommand({
          x: Math.max(0, Math.min(arena.bounds.width, point.x)),
          y: Math.max(0, Math.min(arena.bounds.height, point.y)),
        });
      }}></button>
  {/if}
  <div class="arena-light" aria-hidden="true"></div>
  <div class="arena-vignette" aria-hidden="true"></div>

  <div class="arena-camera" style:transform={`translate(${-camera.x*stage.width/ARENA_VIEW.width}px,${-camera.y*scale}px)`}>

  {#if aoePreviewRings.length}
    <svg class="arena-ground-fx" viewBox={`0 0 ${ARENA_VIEW.width} ${ARENA_VIEW.height}`} preserveAspectRatio="none" aria-hidden="true"
         style={`--aoe-ms:${aoePulseMs(speed)}ms`}>
      {#each aoePreviewRings as ring (ring.radiusM)}
        <path class="aoe-ring" data-aoe-radius={ring.radiusM} d={ring.path} />
      {/each}
      <circle class="aoe-center" cx={aoePreviewCenter.x} cy={aoePreviewCenter.y} r="3.5" />
    </svg>
  {/if}

  <svg class="arena-ground-fx" viewBox={`0 0 ${ARENA_VIEW.width} ${ARENA_VIEW.height}`} preserveAspectRatio="none" aria-hidden="true">
    {#each actors as view (view.actor.id)}
      {#each view.auras.filter(aura => !!authoredVfxFor(aura.id)) as aura, index (aura.id)}
        <ArenaGroundAura id={aura.id} age={playhead / arena.unitsPerSec} footprint={groundAuraFootprint(view.ground,72+index*5)} {reducedMotion} />
      {/each}
    {/each}
    {#each bodyRings as ring (ring.id)}
      <path class="body-ring" d={ring.path} />
    {/each}
    {#each rangedShots as shot (shot.id)}
      <g transform={`translate(${shot.ground.x} ${shot.ground.y - 48}) rotate(${shot.angle})`}>
        <ArenaFxSprite art={shot.art} age={0} x={0} y={0} width={shot.element ? 30 : 42} element={shot.colour} loop={true} {reducedMotion} />
      </g>
    {/each}
    {#each effects as mark (mark.event.id)}
      {#if mark?.activeFx && mark.skillFx}
        <g style:color={mark.activeFx && mark.event.skillId ? skillColour(mark.event.skillId) : mark.event.colour}>
          <ArenaSkillVfx id={mark.event.skillId!} element={sm.byId[mark.event.skillId!]?.element} shape={mark.skillFx.shape} age={mark.vfxAge} timing={mark.timing} source={mark.source} point={mark.point} ground={mark.ground} cast={mark.event.kind === 'cast'} area={mark.vfxArea} targets={mark.targets} spreadTargets={mark.spreadTargets} consumed={mark.consumed} charges={mark.event.skillOutcome?.charges} cleansed={mark.event.skillOutcome?.cleansed} critical={!!mark.event.crit} layer="ground" {reducedMotion} />
        </g>
      {/if}
    {/each}
  </svg>

  {#each actors as view (view.actor.id)}
    <div class="arena-actor" class:hero={view.actor.id === 'player'} class:dead={view.actor.diedAtUs != null}
      class:target={targetId === view.actor.id} class:moving={view.actor.moving}
      data-arena-actor={view.actor.id} data-moving={view.actor.moving} data-action={view.action?.kind || 'idle'} data-animation={view.clipName}
      style:left={`${view.x}px`} style:top={`${view.y}px`} style:z-index={Math.max(1,Math.round(view.ground.y-camera.y))}
      style:opacity={view.opacity} style={`--actor-height:${view.nameplateHeight}px;--actor-width:${view.width}px;--shadow-width:${view.shadow * scale}px`}>
      <span class="foot-shadow" aria-hidden="true"></span>
      {#if targetId === view.actor.id && view.actor.diedAtUs == null}
        <svg class="target-ground" viewBox="0 0 100 40" aria-hidden="true"><path d="M6 17Q12 7 31 5M69 5Q88 7 94 17M94 23Q88 33 69 35M31 35Q12 33 6 23" /></svg>
      {/if}
      <div class="arena-body" style:width={`${view.width}px`} style:height={`${view.height}px`}
        style:left={`${-view.width * view.anchor.x}px`} style:top={`${-view.height * view.anchor.y}px`}
        style:transform-origin={`${view.anchor.x * 100}% ${view.anchor.y * 100}%`}
        style:transform={`translate(${view.bodyX}px, ${view.bodyY}px) rotate(${view.deadRotation}deg)`} style:filter={`brightness(${view.brightness})`}>
        {#if view.sheet}
          <svg class="arena-sprite" class:pixel-art={view.art?.pixelArt} class:mirror={view.mirror} viewBox={view.frame} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {#if view.sourceFrame}
              <defs>
                <clipPath id={`${spriteClipPrefix}-${view.actor.id}`} clipPathUnits="userSpaceOnUse">
                  <rect x={view.sourceFrame.offsetX} y={view.sourceFrame.offsetY} width={view.sourceFrame.width} height={view.sourceFrame.height} />
                </clipPath>
              </defs>
              <image href={view.sheet.href}
                x={view.sourceFrame.offsetX-view.sourceFrame.x} y={view.sourceFrame.offsetY-view.sourceFrame.y}
                width={view.sheet.imageWidth ?? view.sheet.frameWidth * view.sheet.columns} height={view.sheet.imageHeight ?? view.sheet.frameHeight * view.sheet.rows}
                clip-path={`url(#${spriteClipPrefix}-${view.actor.id})`} />
            {:else}
              <image href={view.sheet.href} width={view.sheet.imageWidth ?? view.sheet.frameWidth * view.sheet.columns} height={view.sheet.imageHeight ?? view.sheet.frameHeight * view.sheet.rows} />
            {/if}
          </svg>
        {:else if view.fallback}
          <svg class="arena-sprite painted" class:face-left={Math.cos(view.actor.facing) < 0} viewBox={view.fallback.viewBox} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
            <image href={view.fallback.href} width={view.fallback.imageWidth} height={view.fallback.imageHeight} />
          </svg>
        {/if}
      </div>
      {#each view.auras.filter(aura => !authoredVfxFor(aura.id)) as aura, index (`aura-${aura.id}`)}
        <svg class="actor-aura" viewBox="-48 -48 96 96" aria-hidden="true" style:color={aura.colour} style:animation-delay={`${index * -.7}s`}>
          <path d={aura.path} />
        </svg>
      {/each}
      {#each [...view.buffs, ...view.curses] as mark, index (`${mark.id}-${index}`)}
        <svg class="actor-skill-mark" class:curse={view.curses.includes(mark)} viewBox="-40 -40 80 80" aria-hidden="true"
          style:color={mark.colour} style:left={`${18 + index * 14}px`}>
          <path d={mark.path} />
        </svg>
      {/each}
      {#if view.actor.mob && view.actor.diedAtUs == null}
        <button class="arena-inspect" type="button" onclick={(event) => {
          if (event.shiftKey && onFocusEnemy) { onFocusEnemy(view.actor.mob!); return; }
          onInspectEnemy?.(view.actor.mob!);
        }}
          aria-current={targetId === view.actor.id ? 'true' : undefined}
          aria-label={`Inspect ${fieldLabel(view.actor.mob)}, level ${view.actor.mob.level}, ${Math.ceil(view.actor.hp)} of ${Math.ceil(view.actor.hpMax)} health${view.statuses.length ? `, ${view.statuses.map((status) => `${status.label}${status.stacks > 1 ? ` ${status.stacks} stacks` : ''}`).join(', ')}` : ''}${onFocusEnemy ? ', Shift-click to focus this enemy' : ''}`}
          style:width={`${Math.max(58, view.hitboxWidth)}px`} style:height={`${view.nameplateHeight}px`}>
          <span class="arena-name">{fieldLabel(view.actor.mob)} <small>{view.actor.mob.level}</small></span>
          <span class="arena-health" aria-hidden="true"><span style:width={`${Math.max(0, Math.min(100, view.actor.hp / view.actor.hpMax * 100))}%`}></span></span>
          {#if targetId === view.actor.id}<span class="target-tick" aria-hidden="true"></span>{/if}
        </button>
      {/if}
      {#if view.statuses.length && view.actor.diedAtUs == null}
        <span class="arena-statuses" role="img" aria-label={view.statuses.map((status) => status.label).join(', ')}>
          {#each view.statuses as status (status.name)}
            <span class="arena-status" style:color={status.colour} title={`${status.label}${status.stacks > 1 ? ` · ${status.stacks} stacks` : ''}`}>
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
        </span>
      {/if}
    </div>
  {/each}

  <svg class="arena-effects" viewBox={`0 0 ${ARENA_VIEW.width} ${ARENA_VIEW.height}`} preserveAspectRatio="none" aria-hidden="true">
    {#each effects as mark (mark.event.id)}
      {#if mark}
        <g class="arena-effect" class:critical={mark.event.crit} style:color={mark.activeFx && mark.event.skillId ? skillColour(mark.event.skillId) : mark.event.colour}>
          {#if mark.activeFx && mark.skillFx}
            <ArenaSkillVfx id={mark.event.skillId!} element={sm.byId[mark.event.skillId!]?.element} shape={mark.skillFx.shape} age={mark.vfxAge} timing={mark.timing} source={mark.source} point={mark.point} ground={mark.ground} cast={mark.event.kind === 'cast'} area={mark.vfxArea} targets={mark.targets} spreadTargets={mark.spreadTargets} consumed={mark.consumed} charges={mark.event.skillOutcome?.charges} cleansed={mark.event.skillOutcome?.cleansed} critical={!!mark.event.crit} {reducedMotion} />
          {/if}
          {#if mark.flight && !mark.activeFx && !mark.stormFx && mark.age < 0 && !reducedMotion}
            <g transform={`translate(${mark.skillFx ? mark.skillProjectile.x : mark.projectile.x} ${mark.skillFx ? mark.skillProjectile.y : mark.projectile.y}) rotate(${mark.angle})`}>
              {#if mark.skillFx}
                <path class="skill-fx-projectile" d={mark.skillFx.projectilePath} />
              {:else if mark.kind === 'arrow'}
                <path class="arrow-trail" d="M-36 0H8M2-4 10 0 2 4M-28-3-23 0-28 3" />
              {:else if mark.kind === 'lightning'}
                <path class="bolt-trail" d="M-48 0-29-5-23 3-10-4 0 0" /><circle class="projectile-core" r="4" />
              {:else}
                <path class="projectile-tail" d="M-38 0Q-16-8 5 0Q-16 8-38 0" /><circle class="projectile-core" r={mark.kind === 'fire' ? 6 : 4} />
              {/if}
            </g>
          {/if}
          {#if !mark.activeFx && mark.event.kind === 'cast' && mark.skillFx && mark.age >= -.26 && mark.age <= .45}
            <g class="skill-fx-pose" transform={`translate(${mark.source.x} ${mark.source.y}) scale(${reducedMotion ? .35 : .25 + Math.max(0, mark.age) * .35})`} opacity={mark.opacity}>
              <path d={mark.skillFx.posePath} />
            </g>
          {/if}
          {#if !mark.activeFx && mark.age >= 0 && mark.age <= .45 && (mark.castTargetFx || (mark.event.kind !== 'cast' && !['drop', 'status', 'dodge'].includes(mark.kind)))}
            <g class="arena-impact" transform={`translate(${mark.point.x} ${mark.point.y}) scale(${reducedMotion ? .75 : .7 + mark.age * 1.15})`} opacity={mark.opacity}>
              {#if mark.skillFx}
                {#each Array.from({ length: mark.skillFx.pulses ?? 1 }, (_, index) => index) as pulse}
                  {@const pulseAge = mark.age - pulse * .12}
                  {#if pulseAge >= 0 && pulseAge <= .45}
                    <path class="skill-fx-impact" d={mark.skillFx.path} opacity={reducedMotion ? .9 : Math.max(0, 1 - pulseAge / .45)}
                      transform={`scale(${.72 + pulseAge * 1.2})`} />
                  {/if}
                {/each}
              {:else if mark.kind === 'slash'}
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
              {mark.event.crit ? `${mark.event.text}!` : mark.event.text}
            </text>
          {/if}
        </g>
      {/if}
    {/each}
  </svg>
  </div>
  {#if fieldNote}
    <p class="arena-rest" class:arena-camp={fieldNote.camp} role={fieldNote.camp ? 'status' : undefined}>{fieldNote.text}</p>
  {/if}
</div>

<style>
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
  .aoe-center { fill: var(--gold-lit); opacity: .75; }
  .body-ring { fill: none; stroke: currentColor; stroke-width: 1; opacity: .16; vector-effect: non-scaling-stroke; }
  @keyframes aoe-breathe { from { opacity: .2; } to { opacity: .6; } }
  .reduced-motion .aoe-ring { animation: none; opacity: .45; }
  .arena-actor { position: absolute; width: 0; height: 0; }
  .foot-shadow { position: absolute; left: calc(var(--shadow-width) * -.5); top: -1px; width: var(--shadow-width); height: calc(var(--shadow-width) * .24); border-radius: 50%; background: rgba(7, 12, 9, .58); filter: blur(3px); transform: rotate(-12deg); }
  .hero .foot-shadow { height: calc(var(--shadow-width) * .2); }
  .actor-aura, .actor-skill-mark { position: absolute; overflow: visible; pointer-events: none; }
  .actor-aura { left: -48px; top: -205px; width: 96px; height: 96px; opacity: .52; filter: drop-shadow(0 0 4px currentColor); }
  .actor-aura path { fill: none; stroke: currentColor; stroke-width: 2.5; stroke-dasharray: 5 3; stroke-linejoin: round; animation: aura-turn 8s linear infinite; }
  .actor-skill-mark { left: 18px; top: -125px; width: 28px; height: 28px; opacity: .76; filter: drop-shadow(0 0 3px currentColor); }
  .actor-skill-mark path { fill: currentColor; stroke: rgba(255, 246, 218, .8); stroke-width: 1.5; stroke-linejoin: round; }
  .actor-skill-mark.curse { top: -153px; width: 25px; height: 25px; opacity: .9; }
  .arena-body { position: absolute; transform-origin: 50% 88%; }
  .arena-sprite { display: block; width: 100%; height: 100%; overflow: hidden; filter: drop-shadow(2px 4px 3px rgba(7, 14, 10, .36)); }
  .arena-sprite.pixel-art { image-rendering: pixelated; }
  .arena-sprite.mirror { transform: scaleX(-1); }
  .painted.face-left { transform: scaleX(-1); }
  .dead .arena-sprite { filter: saturate(.65) brightness(.65) drop-shadow(2px 3px 2px rgba(7, 14, 10, .3)); }
  .target-ground { position: absolute; width: 78px; height: 31px; left: -39px; top: -13px; color: var(--gold-lit); opacity: .9; }
  .target-ground path { fill: none; stroke: currentColor; stroke-width: 1.7; filter: drop-shadow(0 1px 1px #263322); }
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
  .target-tick { position: absolute; left: 50%; bottom: calc(100% + 34px); translate: -50% 0; width: 0; height: 0; border: 3px solid transparent; border-top-color: var(--gold-lit); }
  .arena-statuses { position: absolute; left: 30px; bottom: calc(var(--actor-height) - 7px); display: flex; gap: 3px; width: max-content; }
  .arena-status { position: relative; display: grid; place-items: center; width: 17px; height: 17px; border-radius: 2px; background: rgba(7, 15, 11, .86); }
  .arena-status > .icon-mask { width: 13px; height: 13px; }
  .arena-status small { position: absolute; right: -3px; bottom: -4px; color: #faf1cf; font: 600 9px/1 var(--ui); text-shadow: 0 1px 2px #101c14; }
  .arena-cast { position: absolute; left: 0; translate: -50% 0; display: flex; align-items: center; gap: 6px; width: max-content; max-width: 185px; color: var(--gold-lit); font: 600 11px/1.2 var(--ui); text-shadow: 0 2px 3px #0a100d; }
  .arena-cast > .icon-mask { flex: none; width: 21px; height: 21px; filter: drop-shadow(0 2px 2px #0a100d); }
  .arena-cast > span:last-child { padding: 3px 5px; border-radius: 2px; background: rgba(8, 15, 13, .82); }
  .arena-effects { position: absolute; inset: 0; z-index: 1200; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .arena-effect { fill: currentColor; }
  .skill-fx-projectile { fill: currentColor; stroke: #fff0c6; stroke-width: 1.3; stroke-linejoin: round; filter: drop-shadow(0 0 5px currentColor); }
  .skill-fx-impact { fill: currentColor; stroke: #fff1ca; stroke-width: 1.8; stroke-linejoin: round; filter: drop-shadow(0 0 4px currentColor); }
  .skill-fx-pose { fill: currentColor; stroke: #fff0c6; stroke-width: 2; stroke-linejoin: round; opacity: .82; filter: drop-shadow(0 0 5px currentColor); }
  @keyframes aura-turn { to { rotate: 1turn; } }
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
  @media (prefers-reduced-motion: reduce) { .arena-body { transform: none !important; } .actor-aura path { animation: none; } }
</style>
