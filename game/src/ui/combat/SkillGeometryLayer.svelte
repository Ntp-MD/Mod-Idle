<script lang="ts">
  import type { CombatArena, CombatArenaFrame } from '@sim/combat/combat-arena';
  import { ARENA_VIEW, type ArenaViewSize } from './combat-arena-view';
  import type { SkillAimGeometry, SkillGeometry } from './skill-geometry';
  import { projectArenaVector } from '../../presentation/arena-camera';
  import { atlasImpactDuration, groundDecalMatrix, matrixAttribute, skillArtFor } from './arena-skill-art';
  import { skillActionGeometry, skillAimGeometry, skillPayloadArtGeometry } from './skill-geometry';
  import { activeAuraGeometry } from './skill-aura-geometry';
  import { supportEventGeometry } from './skill-support-geometry';
  import type { SkillState } from '@sim/combat/skills';
  import ArenaSkillVfxStage from './ArenaSkillVfxStage.svelte';
  import SkillAtlas from './SkillAtlas.svelte';

  import type { VfxAtlas } from '../fx/catalog';

  const DECAL_PX = 2048;
  type ArtView = {
    atlas?: VfxAtlas;
    decal?: string;
    decalTransform?: string;
    decalOpacity?: number;
    burst?: { href: string; size: number; x: number; y: number } | null;
  } | null;

  /** Map a raster decal's square canvas through the arena ground basis and anchor it at the centre. */
  function artFor(mark: SkillGeometry): ArtView {
    const art = skillArtFor(mark.skillId);
    if (!art) return null;
    if (art.atlas) {
      return { atlas: art.atlas };
    }
    const reach = mark.area.lengthM ?? mark.area.radiusM;
    if (!(reach > 0)) return null;
    const bx = projectArenaVector({ x: reach, y: 0 });
    const burstSize = Math.hypot(bx.x, bx.y) * 2 * (art.burstWidth ?? 1.25);
    return {
      decal: art.decal,
      decalTransform: matrixAttribute(groundDecalMatrix(mark.center, reach, DECAL_PX)),
      decalOpacity: art.decalOpacity,
      burst: art.burst
        ? { href: art.burst, size: burstSize, x: mark.center.x - burstSize / 2, y: mark.center.y - burstSize }
        : null,
    };
  }

  let { arena, frame, atUs, aim = null, inspect = false, view = ARENA_VIEW, reducedMotion = false,
    releasePoints = {}, bodySizes = {}, skills }: {
    arena: CombatArena; frame: CombatArenaFrame; atUs: number; aim?: SkillAimGeometry | null; inspect?: boolean;
    view?: ArenaViewSize; reducedMotion?: boolean; releasePoints?: Record<string, { x: number; y: number }>;
    bodySizes?: Record<string, { width: number; height: number }>;
    skills?: SkillState;
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
        const atlas = skillArtFor(action.skillId ?? '')?.atlas;
        const mark = skillActionGeometry(action, frame, atUs, arena.unitsPerSec,
          nextImpacts.get(action.id), view, releasePoints, bodySizes,
          Math.max(atlas?.rainDurationSec ?? 0, atlas ? atlasImpactDuration(atlas) : 0));
        return mark ? [mark] : [];
      }),
      ...(aim ? [skillAimGeometry(aim, view, releasePoints.player, bodySizes.player)].filter(mark => mark != null) : []),
    ];
  });
  const artMarks = $derived.by(() => {
    const actions = new Map(arena.actions.map(action => [`action-${action.id}`, action]));
    return [
      ...marks.flatMap(mark => {
        const action = actions.get(mark.key);
        const atlas = skillArtFor(mark.skillId)?.atlas;
        return action && atlas ? skillPayloadArtGeometry(mark, action, atUs, arena.unitsPerSec,
          atlasImpactDuration(atlas), arena.flights) : [mark];
      }),
      ...(skills ? activeAuraGeometry(skills, frame, atUs, arena.unitsPerSec, view, bodySizes.player) : []),
      ...supportEventGeometry(arena.feedback ?? [], arena, frame, atUs, view, bodySizes.player),
    ];
  });
  const phaseLabel = (phase: string) => phase === 'Windup' ? 'Casting' : phase === 'Travel' ? 'Landing' : phase;
</script>

<svg class="skill-geometry-layer" viewBox={`0 0 ${view.width} ${view.height}`}
  preserveAspectRatio="none" aria-hidden="true" data-skill-geometry-layer>
  {#each marks as mark (mark.key)}
    {@const art = artFor(mark)}
    <g class="skill-geometry" class:incoming={mark.incoming} class:invalid={!mark.valid}
      class:aim={mark.phase === 'Aim'} class:impact={mark.phase === 'Impact'}
      style={`--skill-element:${mark.colour}`}
      data-skill-id={mark.skillId} data-skill-element={mark.element} data-skill-phase={mark.phase.toLowerCase()} data-skill-progress={mark.progress.toFixed(3)} data-skill-shape={mark.area.shape ?? (mark.area.radiusM > 0 ? 'circle' : 'single')}>
      {#if art && !art.atlas}
        <clipPath id={`skill-art-${mark.key}`}><path d={mark.footprint} /></clipPath>
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
          transform={`translate(${mark.center.x} ${mark.center.y})`}>
          <circle r="4.5" />
          <path d="M-8 0H8M0-8V8" />
        </g>
      {/if}
      {#if mark.phase === 'Aim' && mark.range}<path class="skill-range-shadow" d={mark.range} /><path class="skill-range" d={mark.range} />{/if}
      {#if !art?.atlas || art.atlas.rainDurationSec || inspect || mark.phase === 'Aim' || mark.phase === 'Windup'}
        <path class="skill-outline-shadow" d={mark.footprint} />
        <path class="skill-footprint" d={mark.footprint} />
        <path class="skill-inner" d={mark.innerFootprint} />
        {#each mark.vertices.filter((_, index) => index % Math.max(1, Math.floor(mark.vertices.length / 8)) === 0).slice(0, 8) as point}
          <line class="skill-rune" x1={mark.center.x + (point.x - mark.center.x) * .9}
            y1={mark.center.y + (point.y - mark.center.y) * .9} x2={point.x} y2={point.y} />
        {/each}
      {/if}
      {#if mark.phase === 'Windup' || mark.phase === 'Travel'}
        <g transform={`translate(${mark.center.x} ${mark.center.y}) scale(${Math.max(.02, mark.progress)}) translate(${-mark.center.x} ${-mark.center.y})`}>
          <path class="skill-arrival-fill" d={mark.footprint} />
        </g>
        <path class="skill-arrival-edge" d={mark.footprint} pathLength="1" stroke-dasharray={`${mark.progress} 1`} />
      {/if}
      {#if !art?.atlas}<ArenaSkillVfxStage {mark} {reducedMotion} />{/if}
      {#if mark.phase === 'Aim' || inspect}
        <line class="skill-direction" x1={mark.direction.from.x} y1={mark.direction.from.y} x2={mark.direction.to.x} y2={mark.direction.to.y} />
        <path class="skill-target" d="M-9 0H9M0-9V9" transform={`translate(${mark.direction.to.x} ${mark.direction.to.y})`} />
      {/if}
      {#if inspect}
        {#each mark.paths as path (path.index)}
          <line class="skill-payload" class:blocked={path.blocked} data-skill-payload={path.index}
            x1={path.from.x} y1={path.from.y} x2={path.to.x} y2={path.to.y} />
        {/each}
      {/if}
    </g>
  {/each}
</svg>

<svg class="skill-art-layer" viewBox={`0 0 ${view.width} ${view.height}`}
  preserveAspectRatio="none" aria-hidden="true" data-skill-art-layer>
  {#each artMarks as mark (mark.key)}
    {@const art = skillArtFor(mark.skillId)}
    {#each (art?.atlases ?? (art?.atlas ? [art.atlas] : [])) as atlas (atlas.src)}
      <g opacity={atlas.opacity ?? 1} data-skill-art-source={atlas.src}>
        <SkillAtlas {mark} {atlas} {reducedMotion} />
      </g>
    {/each}
  {/each}
</svg>

<svg class="skill-geometry-labels" viewBox={`0 0 ${view.width} ${view.height}`}
  preserveAspectRatio="none" aria-hidden="true" data-skill-geometry-labels>
  {#each marks as mark (`label-${mark.key}`)}
    <g class="skill-geometry" class:incoming={mark.incoming} class:invalid={!mark.valid} class:aim={mark.phase === 'Aim'}
      style={`--skill-element:${mark.colour}`} data-skill-element={mark.element}>
      <rect class="skill-label-bg" x={mark.label.x - mark.labelWidth / 2} y={mark.label.y - 18}
        width={mark.labelWidth} height={inspect ? 36 : 28} rx="3" />
      <text class="skill-name" x={mark.label.x} y={mark.label.y - (inspect ? 3 : 0)}>{mark.name} · {mark.valid ? phaseLabel(mark.phase) : 'Blocked'}{mark.remainingSec != null ? ` ${mark.remainingSec.toFixed(1)}s` : ''}</text>
      {#if inspect}<text class="skill-dimensions" x={mark.label.x} y={mark.label.y + 12}>{mark.dimensions}</text>{/if}
    </g>
  {/each}
</svg>

<style>
  /* World layers ride the camera transform, so their boxes sit off-viewport: only the
     arena clips, never these boxes, or skill circles are cut at the layer edge. */
  .skill-geometry-layer { position: absolute; inset: 0; z-index: 4; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .skill-art-layer { position: absolute; inset: 0; z-index: 1100; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
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
