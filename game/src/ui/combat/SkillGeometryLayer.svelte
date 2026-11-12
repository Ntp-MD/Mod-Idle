<script lang="ts">
  import type { CombatArena, CombatArenaFrame } from '@sim/combat/combat-arena';
  import { ARENA_VIEW } from '../../presentation/arena-camera';
  import { createFieldViewFrame, type FieldViewFrame } from '../../presentation/arena-view-frame';
  import { fieldPointM } from '../../presentation/view-transform';
  import type { SkillAimGeometry, SkillGeometry, BodyModelM } from './skill-geometry';
  import { atlasOpacity, directionalAtlasFor, groundDecalMatrixForFrame, resolveVfxPresentation, skillArtFor, vfxPresentationTailSec, type SkillVfxMode } from './arena-skill-art';
  import { matrixAttribute } from '../../presentation/view-transform';
  import { projectSkillGeometry, skillActionGeometry, skillAimGeometry, skillPayloadGeometry } from './skill-geometry';
  import { activeAuraGeometry } from './skill-aura-geometry';
  import { supportEventGeometry } from './skill-support-geometry';
  import { vfxArtCandidates } from '../fx/catalog';
  import { ensureVfxAssets } from '../fx/vfx-assets.svelte';
  import type { SkillState } from '@sim/combat/skills';
  import ArenaSkillVfxStage from './ArenaSkillVfxStage.svelte';
  import SkillAtlas from './SkillAtlas.svelte';

  import type { VfxAtlas } from '../fx/catalog';

  const DECAL_PX = 2048;
  type ArtView = {
    atlas?: VfxAtlas;
    atlases?: VfxAtlas[];
    decal?: string;
    decalTransform?: string;
    decalOpacity?: number;
    burst?: { href: string; size: number; x: number; y: number } | null;
  } | null;

  /** Map a raster decal's square canvas through the frame's uniform ground basis. */
  function artFor(mark: SkillGeometry, screen: { center: { x: number; y: number } }, frame: FieldViewFrame): ArtView {
    const art = skillArtFor(mark.skillId, vfxMode);
    if (!art) return null;
    if (art.atlas) {
      return { atlas: art.atlas, atlases: art.atlases };
    }
    if (!frame.renderable) return null;
    const reach = mark.area.lengthM ?? mark.area.radiusM;
    if (!(reach > 0)) return null;
    const burstSize = reach * frame.cssPixelsPerMeter * 2 * (art.burstWidth ?? 1.25);
    const matrix = groundDecalMatrixForFrame(screen.center, reach, frame, DECAL_PX);
    return {
      decal: art.decal,
      decalTransform: matrix ? matrixAttribute(matrix) : undefined,
      decalOpacity: art.decalOpacity,
      burst: art.burst
        ? { href: art.burst, size: burstSize, x: screen.center.x - burstSize / 2, y: screen.center.y - burstSize }
        : null,
    };
  }

  let { arena, frame, viewFrame = null, atUs, aim = null, inspect = false,
    reducedMotion = false, releaseWorld = {}, bodyModels = {}, skills, vfxMode = 'auto' }: {
    arena: CombatArena; frame: CombatArenaFrame; atUs: number; aim?: SkillAimGeometry | null; inspect?: boolean;
    /** Painted frame that owns the world→viewport transform (single scale owner). */
    viewFrame?: FieldViewFrame | null;
    reducedMotion?: boolean;
    /** Authored hand sockets in world metres (from the shared body model). */
    releaseWorld?: Record<string, { x: number; y: number }>;
    /** Body envelopes in model metres (from the shared body model). */
    bodyModels?: Record<string, BodyModelM>;
    skills?: SkillState;
    vfxMode?: SkillVfxMode;
  } = $props();
  const marks = $derived.by(() => {
    // The arena is raw. Read the render clock even when its action list starts empty;
    // otherwise the first automatic cast never subscribes this layer to future frames.
    void atUs;
    const nextImpacts = new Map<number, number>();
    for (const flight of [...arena.flights, ...arena.mobFlights]) {
      const impact = 'timing' in flight ? flight.timing.impactAtUs : flight.impactAtUs;
      if (impact > atUs && impact < (nextImpacts.get(flight.actionId) ?? Infinity)) nextImpacts.set(flight.actionId, impact);
    }
    for (const action of arena.actions) for (const payload of action.payloads ?? []) {
      const impact = payload.impactAtUs ?? payload.plannedImpactAtUs;
      if (impact > atUs && impact < (nextImpacts.get(action.id) ?? Infinity)) nextImpacts.set(action.id, impact);
    }
    return [
      ...arena.actions.flatMap(action => {
        const mark = skillActionGeometry(action, frame, atUs, arena.unitsPerSec,
          nextImpacts.get(action.id),
          { ...(releaseWorld[action.actorId] ? { releaseM: releaseWorld[action.actorId] } : {}),
            ...(bodyModels[action.actorId] ? { bodyM: bodyModels[action.actorId] } : {}) },
          vfxPresentationTailSec(action.skillId ?? ''));
        return mark ? [mark] : [];
      }),
      ...(aim ? [skillAimGeometry(aim,
        { ...(releaseWorld.player ? { releaseM: releaseWorld.player } : {}),
          ...(bodyModels.player ? { bodyM: bodyModels.player } : {}) })].filter(mark => mark != null) : []),
    ];
  });
  /** Painted frame: the caller's intent wins; isolated mounts fall back to a
   *  default renderable frame so world marks still project (tests/specs). An
   *  explicitly hidden frame paints nothing. */
  const effectiveFrame = $derived.by((): FieldViewFrame => {
    if (viewFrame) return viewFrame;
    const focus = aim?.source ?? marks[0]?.source ?? { x: 0, y: 0 };
    return createFieldViewFrame({
      sceneKey: 'skill-layer:fallback', atUs,
      viewportCss: { ...ARENA_VIEW },
      focusM: fieldPointM(focus.x, focus.y), worldScale: 1,
    });
  });
  const viewport = $derived(effectiveFrame.renderable
    ? effectiveFrame.viewportCss : { width: 0, height: 0 });
  /** World marks projected once per painted frame; screens carry every SVG string. */
  const screens = $derived.by(() => {
    if (!effectiveFrame.renderable) return new Map<string, ReturnType<typeof projectSkillGeometry>>();
    return new Map(marks.map(mark => [mark.key, projectSkillGeometry(mark, effectiveFrame)]));
  });
  const screenOf = (mark: SkillGeometry) => screens.get(mark.key);
  // Support receipts have no cast action; preload their art alongside cast/payload art.
  $effect(() => {
    const ids = new Set<string>();
    for (const mark of artMarks) ids.add(mark.skillId);
    if (skills) for (const [id, on] of Object.entries(skills.auras ?? {})) if (on) ids.add(id);
    const sources: string[] = [];
    for (const id of ids) for (const c of vfxArtCandidates(id)) sources.push(...c.sources);
    if (sources.length) ensureVfxAssets(sources);
  });
  const artMarks = $derived.by(() => {
    if (!effectiveFrame.renderable) return [] as SkillGeometry[];
    const actions = new Map(arena.actions.map(action => [`action-${action.id}`, action]));
    const payloads = marks.flatMap(mark => {
      const action = actions.get(mark.key);
      return action ? skillPayloadGeometry(mark, action, atUs, arena.unitsPerSec,
        vfxPresentationTailSec(mark.skillId), arena.flights) : [mark];
    });
    let auras = skills ? activeAuraGeometry(skills, frame, atUs, arena.unitsPerSec, bodyModels.player) : [];
    // Aggregate unskinned aura halos per actor; representative = lowest skill id. Halos stop on off/push/ownership loss (handled by the producers).
    const baseAuras = new Map<string, SkillGeometry>();
    const kept: SkillGeometry[] = [];
    for (const aura of auras) {
      const pres = resolveVfxPresentation(aura.skillId, vfxMode);
      if (pres.kind !== 'skin') { kept.push(aura); continue; }
      const key = `base-aura:${aura.actorId ?? 'player'}`;
      const cur = baseAuras.get(key);
      if (!cur || String(aura.skillId) < String(cur.skillId)) baseAuras.set(key, aura);
    }
    for (const aura of baseAuras.values()) kept.push({ ...aura, key: `base-aura:${aura.actorId ?? 'player'}` });
    return [
      ...payloads,
      ...kept,
      ...supportEventGeometry(arena.feedback ?? [], arena, frame, atUs, bodyModels.player),
    ];
  });
  const artScreens = $derived.by(() => {
    if (!effectiveFrame.renderable) return new Map<string, ReturnType<typeof projectSkillGeometry>>();
    return new Map(artMarks.map(mark => [mark.key, projectSkillGeometry(mark, effectiveFrame)]));
  });
  const artScreenOf = (mark: SkillGeometry) => artScreens.get(mark.key);
  const phaseLabel = (phase: string) => phase === 'Windup' ? 'Casting' : phase === 'Travel' ? 'Landing' : phase;
</script>

<svg class="skill-geometry-layer" viewBox={`0 0 ${viewport.width} ${viewport.height}`}
  preserveAspectRatio="none" aria-hidden="true" data-skill-geometry-layer>
  {#each marks as mark (mark.key)}
    {@const screen = screenOf(mark)}
    {@const art = screen && effectiveFrame.renderable ? artFor(mark, screen, effectiveFrame) : null}
    {@const phaseArt = (art?.atlases ?? (art?.atlas ? [art.atlas] : [])).some(atlas => atlasOpacity(mark, atlas) > 0)}
    {#if screen}
    <g class="skill-geometry" class:incoming={mark.incoming} class:invalid={!mark.valid}
      class:aim={mark.phase === 'Aim'} class:impact={mark.phase === 'Impact'}
      style={`--skill-element:${mark.colour}`}
      data-vfx-renderer={resolveVfxPresentation(mark.skillId, vfxMode).kind}
      data-vfx-base-reason={resolveVfxPresentation(mark.skillId, vfxMode).kind === 'base' ? (resolveVfxPresentation(mark.skillId, vfxMode) as any).reason : ''}
      data-skill-id={mark.skillId} data-skill-action={mark.key} data-skill-element={mark.element} data-skill-phase={mark.phase.toLowerCase()} data-skill-progress={mark.progress.toFixed(3)} data-skill-shape={mark.area.shape ?? (mark.area.radiusM > 0 ? 'circle' : 'single')}>
      {#if art && !art.atlas}
        <clipPath id={`skill-art-${mark.key}`}><path d={screen.footprint} /></clipPath>
        <image class="skill-art-decal" href={art.decal} width={DECAL_PX} height={DECAL_PX}
          transform={art.decalTransform} clip-path={`url(#skill-art-${mark.key})`}
          style={`--decal-opacity:${(art.decalOpacity ?? .9) * (mark.phase === 'Impact' ? 1 : .78)}`} />
        {#if art.burst && mark.phase === 'Impact'}
          <image class="skill-art-burst" href={art.burst.href} x={art.burst.x} y={art.burst.y}
            width={art.burst.size} height={art.burst.size} />
        {/if}
      {/if}
      {#if (mark.area.radiusM ?? 0) > 0}
        <g class="skill-aoe-center" data-skill-aoe-center
          transform={`translate(${screen.center.x} ${screen.center.y})`}>
          <circle r="4.5" />
          <path d="M-8 0H8M0-8V8" />
        </g>
      {/if}
      {#if mark.phase === 'Aim' && screen.rangePath}<path class="skill-range-shadow" d={screen.rangePath} /><path class="skill-range" d={screen.rangePath} />{/if}
      {#if !phaseArt || art?.atlas?.rainDurationSec || inspect || mark.phase === 'Aim' || mark.phase === 'Windup'}
        <path class="skill-outline-shadow" d={screen.footprint} />
        <path class="skill-footprint" d={screen.footprint} />
        <path class="skill-inner" d={screen.innerFootprint} />
        {#each screen.vertices.filter((_, index) => index % Math.max(1, Math.floor(screen.vertices.length / 8)) === 0).slice(0, 8) as point}
          <line class="skill-rune" x1={screen.center.x + (point.x - screen.center.x) * .9}
            y1={screen.center.y + (point.y - screen.center.y) * .9} x2={point.x} y2={point.y} />
        {/each}
      {/if}
      {#if mark.phase === 'Windup' || mark.phase === 'Travel'}
        <g transform={`translate(${screen.center.x} ${screen.center.y}) scale(${Math.max(.02, mark.progress)}) translate(${-screen.center.x} ${-screen.center.y})`}>
          <path class="skill-arrival-fill" d={screen.footprint} />
        </g>
        <path class="skill-arrival-edge" d={screen.footprint} pathLength="1" stroke-dasharray={`${mark.progress} 1`} />
      {/if}
      {#if !phaseArt && effectiveFrame.renderable}<ArenaSkillVfxStage {mark} screen={screen} frame={effectiveFrame} {reducedMotion} />{/if}
      {#if mark.phase === 'Aim' || inspect}
        <line class="skill-direction" x1={screen.direction.from.x} y1={screen.direction.from.y} x2={screen.direction.to.x} y2={screen.direction.to.y} />
        <path class="skill-target" d="M-9 0H9M0-9V9" transform={`translate(${screen.direction.to.x} ${screen.direction.to.y})`} />
      {/if}
      {#if inspect}
        {#each screen.paths as path (path.index)}
          <line class="skill-payload" class:blocked={path.blocked} data-skill-payload={path.index}
            x1={path.from.x} y1={path.from.y} x2={path.to.x} y2={path.to.y} />
        {/each}
      {/if}
    </g>
    {/if}
  {/each}
</svg>

{#each ['ground', 'upright'] as plane}
<svg class={plane === 'ground' ? 'skill-ground-layer' : 'skill-art-layer'} viewBox={`0 0 ${viewport.width} ${viewport.height}`}
  preserveAspectRatio="none" aria-hidden="true" data-skill-art-layer>
  {#each artMarks as mark (mark.key)}
    {@const screen = artScreenOf(mark)}
    {@const pres = resolveVfxPresentation(mark.skillId, vfxMode)}
    {@const art = pres.kind === 'skin' ? pres.art : undefined}
    {#if screen && effectiveFrame.renderable}
    {#each (art?.atlases ?? (art?.atlas ? [art.atlas] : [])).map(atlas => directionalAtlasFor(mark, atlas, effectiveFrame))
      .filter((atlas): atlas is VfxAtlas => !!atlas && (atlas.projection === 'ground') === (plane === 'ground')) as atlas, layerIndex (atlas.id ?? `${layerIndex}:${atlas.src}`)}
      <g opacity={atlas.opacity ?? 1} data-skill-art-source={atlas.src} data-skill-action={mark.key} data-vfx-layer={atlas.id ?? layerIndex}
        data-vfx-renderer="skin" data-vfx-version={pres.kind === 'skin' ? pres.versionId : ''}
        data-vfx-base-reason={pres.kind === 'base' ? pres.reason : ''}>
        <SkillAtlas {mark} screen={screen} frame={effectiveFrame} actors={frame} {atlas} {reducedMotion} />
      </g>
    {/each}
    {/if}
  {/each}
</svg>

{/each}

<svg class="skill-geometry-labels" viewBox={`0 0 ${viewport.width} ${viewport.height}`}
  preserveAspectRatio="none" aria-hidden="true" data-skill-geometry-labels>
  {#each marks as mark (`label-${mark.key}`)}
    {@const screen = screenOf(mark)}
    {#if screen}
    <g class="skill-geometry" class:incoming={mark.incoming} class:invalid={!mark.valid} class:aim={mark.phase === 'Aim'}
      style={`--skill-element:${mark.colour}`} data-skill-element={mark.element}>
      <rect class="skill-label-bg" x={screen.label.x - screen.labelWidth / 2} y={screen.label.y - 18}
        width={screen.labelWidth} height={inspect ? 36 : 28} rx="3" />
      <text class="skill-name" x={screen.label.x} y={screen.label.y - (inspect ? 3 : 0)}>{mark.name} · {mark.valid ? phaseLabel(mark.phase) : 'Blocked'}{mark.remainingSec != null ? ` ${mark.remainingSec.toFixed(1)}s` : ''}</text>
      {#if inspect}<text class="skill-dimensions" x={screen.label.x} y={screen.label.y + 12}>{mark.dimensions}</text>{/if}
    </g>
    {/if}
  {/each}
</svg>

<style>
  /* World layers ride the frame transform: their boxes sit off-viewport only when hidden. */
  .skill-geometry-layer { position: absolute; inset: 0; z-index: 4; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .skill-art-layer { position: absolute; inset: 0; z-index: 1100; width: 100%; height: 100%; overflow: visible; pointer-events: none; isolation: isolate; }
  .skill-ground-layer { position: absolute; inset: 0; z-index: 3; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .skill-geometry-labels { position: absolute; inset: 0; z-index: 1201; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  /* The footprint takes the cast's own Element; invalid is the only semantic override left. */
  .skill-geometry { color: var(--skill-element, var(--es-lit)); fill: none; stroke-linejoin: round; }
  .skill-geometry.invalid { color: var(--alarm); }
  .skill-outline-shadow, .skill-range-shadow { stroke: var(--ground); stroke-width: 7; opacity: .78; vector-effect: non-scaling-stroke; }
  .skill-range-shadow { stroke-width: 4; opacity: .6; }
  .skill-range { stroke: currentColor; stroke-width: 1.5; stroke-dasharray: 7 7; opacity: .7; vector-effect: non-scaling-stroke; }
  .skill-footprint { stroke: currentColor; stroke-width: 3; fill: color-mix(in srgb, currentColor 13%, transparent); vector-effect: non-scaling-stroke; }
  .skill-inner { stroke: currentColor; stroke-width: 1; opacity: .85; vector-effect: non-scaling-stroke; }
  .skill-arrival-fill { stroke: none; fill: currentColor; opacity: .17; }
  .skill-arrival-edge { stroke: currentColor; stroke-width: 5; opacity: .95; vector-effect: non-scaling-stroke; }
  .skill-rune { stroke: currentColor; stroke-width: 3; vector-effect: non-scaling-stroke; }
  .incoming .skill-footprint, .invalid .skill-footprint { stroke-dasharray: 12 5; }
  .skill-direction, .skill-payload { stroke: currentColor; stroke-width: 1.5; stroke-dasharray: 4 4; opacity: .75; }
  .skill-payload.blocked { stroke: var(--hp-lit); }
  .skill-target { stroke: currentColor; stroke-width: 2; }
  .skill-label-bg { fill: var(--ground); fill-opacity: .92; stroke: currentColor; stroke-opacity: .6; stroke-width: 1; }
  .skill-name, .skill-dimensions { text-anchor: middle; font-family: var(--ui); }
  .skill-name { fill: currentColor; font-size: 14px; font-weight: 650; }
  .skill-dimensions { fill: var(--text); font-size: 12px; font-variant-numeric: tabular-nums; }
  .impact .skill-footprint { stroke-width: 5; fill-opacity: .25; }
  /* The raster layers sit under the code-drawn outline; the footprint still clips the decal. */
  .skill-art-decal { opacity: var(--decal-opacity, .9); animation: skill-decal-in 220ms var(--ease-out, ease-out) both; }
  .skill-aoe-center { color: currentColor; fill: none; stroke: currentColor; stroke-width: 1.5; opacity: .7; vector-effect: non-scaling-stroke; }
  .skill-aoe-center circle { fill: color-mix(in srgb, currentColor 18%, transparent); }
  .skill-art-burst {
    transform-box: fill-box; transform-origin: 50% 100%; pointer-events: none;
    animation: skill-burst 620ms cubic-bezier(.16, 1, .3, 1) both;
  }
  @keyframes skill-decal-in { from { opacity: 0; } to { opacity: var(--decal-opacity, .9); } }
  @keyframes skill-burst {
    0% { opacity: 0; transform: translateY(18px) scale(.62); }
    16% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-26px) scale(1.02); }
  }
  @media (prefers-reduced-motion: reduce) {
    .skill-art-decal, .skill-art-burst { animation: none; }
    .skill-art-burst { opacity: .9; }
  }
</style>
