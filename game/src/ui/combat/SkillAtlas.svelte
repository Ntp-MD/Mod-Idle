<script lang="ts">
  import type { VfxAtlas } from '../fx/catalog';
  import AtlasFrame from '../fx/AtlasFrame.svelte';
  import { atlasFrameIndex, atlasOpacity, skillArtPlacement, billboardMatrixForFrame, groundAtlasMatrixForFrame, tetherMatrixForFrame } from './arena-skill-art';
  import type { CombatArenaFrame } from '@sim/combat/combat-arena';
  import { ARENA_REF_PX_PER_M } from '../../presentation/arena-camera';
  import { matrixAttribute } from '../../presentation/view-transform';
  import type { FieldViewFrame } from '../../presentation/arena-view-frame';
  import type { SkillGeometry, SkillGeometryScreen } from './skill-geometry';
  import { skillRainDrops } from './meteor-rain';
  import { componentInstances, componentScale } from './component-placement';

  let { mark, screen, frame, atlas, actors, reducedMotion = false }: {
    mark: SkillGeometry; screen: SkillGeometryScreen; frame: FieldViewFrame;
    atlas: VfxAtlas; reducedMotion?: boolean;
    actors?: CombatArenaFrame;
  } = $props();
  const clipId = $props.id();

  // Reduced motion keeps the authored silhouette and contact while freezing its animation.
  const still = $derived(reducedMotion ? { ...mark, phaseElapsedSec: 0 } : mark);
  const index = $derived(reducedMotion && atlas.posterFrame != null ? atlas.posterFrame : atlasFrameIndex(still, atlas));
  const opacity = $derived(atlasOpacity(mark, atlas));
  const placement = $derived(skillArtPlacement(mark, atlas, frame, screen, actors));
  const instances = $derived(componentInstances(mark, atlas, reducedMotion));
  const expansion = $derived(componentScale(mark, atlas, reducedMotion));
  const tether = $derived(atlas.placement?.kind === 'tether' ? tetherMatrixForFrame(mark, atlas, frame, actors) : null);
  const rain = $derived(skillRainDrops(atlas.delaySec ? { ...mark, phaseElapsedSec: Math.max(0, mark.phaseElapsedSec - atlas.delaySec) } : mark, frame, atlas, reducedMotion));
  const groundTransform = $derived(atlas.projection === 'ground'
    ? (groundAtlasMatrixForFrame(mark, atlas, frame, reducedMotion) ?? null) : null);
  const chainPaths = $derived(mark.chainHop ? screen.paths : []);
  // Chain shape is a world effect: jitter in model metres scales with the
  // frame instead of saturating on a fixed screen-pixel cap. Stroke width
  // stays a CSS readability floor (fixed px) — labels' owner, not a hitbox.
  const CHAIN_JITTER_MAX_M = 12 / ARENA_REF_PX_PER_M;
  function boltPath(from: { x: number; y: number }, to: { x: number; y: number }, seed: number) {
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.max(1, Math.hypot(dx, dy));
    const cssPerM = frame.renderable ? frame.cssPixelsPerMeter : ARENA_REF_PX_PER_M;
    const worldLen = length / Math.max(1, cssPerM);
    return Array.from({ length: 13 }, (_, index) => {
      const t = index / 12;
      const worldOffset = index === 0 || index === 12 ? 0
        : Math.sin(index * 2.7 + seed * 1.9) * Math.min(CHAIN_JITTER_MAX_M, worldLen * .07);
      const offset = worldOffset * cssPerM;
      return `${index ? 'L' : 'M'}${from.x + dx * t - dy / length * offset} ${from.y + dy * t + dx / length * offset}`;
    }).join(' ');
  }
</script>

{#if opacity > 0 && (mark.phase === 'Travel' || mark.phase === 'Impact' && mark.phaseElapsedSec < .16)}
  {#each chainPaths as path (path.index)}
    {@const d = boltPath(path.from, path.to, path.index)}
    <g data-skill-chain-hop={path.index} opacity={mark.phase === 'Impact' ? Math.max(0, 1 - mark.phaseElapsedSec / .16) : 1}>
      <path class="chain-glow" {d} />
      <path class="chain-core" {d} />
    </g>
  {/each}
{/if}
{#if atlas.projection === 'ground' && opacity > 0 && groundTransform}
  <g clip-path={`url(#${clipId})`}>
    <defs><clipPath id={clipId}><path d={screen.footprint} /></clipPath></defs>
    <g data-skill-art={mark.skillId} data-skill-ground-shader data-vfx-scale={expansion} data-skill-art-phase={mark.phase.toLowerCase()}
      transform={matrixAttribute(groundTransform)} {opacity}>
      <AtlasFrame src={atlas.src} frame={atlas} palette={atlas.palette} {index} x={0} y={0}
        width={atlas.virtualWidth ?? atlas.width} height={atlas.virtualHeight ?? atlas.height} />
    </g>
  </g>
{:else if atlas.placement?.kind === 'tether'}
  {#if opacity > 0 && tether}
    <g data-skill-art={mark.skillId} data-skill-art-phase={mark.phase.toLowerCase()}
      data-skill-tether transform={matrixAttribute(tether)} {opacity}>
      <AtlasFrame src={atlas.src} frame={atlas} palette={atlas.palette} {index} x={0} y={0}
        width={atlas.virtualWidth ?? atlas.width} height={atlas.virtualHeight ?? atlas.height} />
    </g>
  {/if}
{:else if atlas.rainDurationSec && opacity > 0}
  <g data-skill-art={mark.skillId} data-skill-rain data-skill-art-phase={mark.phase.toLowerCase()} style:color={mark.colour}>
    {#each rain as drop (drop.id)}
      <g data-rain-drop={drop.id} opacity={drop.opacity}>
        {#if drop.impactProgress != null}
          <circle class="rain-impact-ring" data-rain-impact cx={drop.x} cy={drop.y}
            transform={frame.renderable ? matrixAttribute(frame.worldToViewport) : undefined}
            r={drop.size * (.1 + .1 * drop.impactProgress)}
            opacity={Math.max(0, 1 - drop.impactProgress * 2)} />
        {/if}
        {#if drop.fragments.length}
          {#each drop.fragments as shard (shard.index + ':' + shard.rotationDeg)}
            <g opacity={1 - (drop.impactProgress ?? 0)} transform={`${matrixAttribute(billboardMatrixForFrame(shard, frame)!)} rotate(${shard.rotationDeg})`}>
              <AtlasFrame src={atlas.src} frame={atlas} palette={atlas.palette} index={shard.index}
                x={-shard.size * .5} y={-shard.size * .5}
                width={shard.size} height={shard.size} />
            </g>
          {/each}
        {:else}
          <g transform={`${matrixAttribute(billboardMatrixForFrame(drop, frame)!)} rotate(${drop.rotationDeg})`}>
            <AtlasFrame src={atlas.src} frame={atlas} palette={atlas.palette} index={drop.index}
              x={-drop.size * .5} y={-drop.size * (atlas.rainPhase === 'Field' ? .5 : .78)}
              width={drop.size} height={drop.size} />
          </g>
        {/if}
      </g>
    {/each}
  </g>
{:else if opacity > 0 && placement && (!mark.chainHop || mark.phase === 'Impact')}
  {#each instances as instance, instanceIndex (instanceIndex)}
    {@const localMark = { ...mark, phaseElapsedSec: instance.elapsedSec }}
    {@const localOpacity = atlasOpacity(localMark, atlas)}
    {@const localIndex = reducedMotion && atlas.posterFrame != null ? atlas.posterFrame
      : atlasFrameIndex(reducedMotion ? { ...localMark, phaseElapsedSec: 0 } : localMark, atlas)}
    {@const transform = billboardMatrixForFrame({ x: placement.cx + instance.dx, y: placement.cy + instance.dy }, frame)}
    {#if localOpacity > 0}
      <g data-skill-art={mark.skillId} data-skill-art-phase={mark.phase.toLowerCase()} opacity={localOpacity}
        data-vfx-instance={instanceIndex} data-vfx-offset={`${instance.dx},${instance.dy}`}
        transform={transform ? `${matrixAttribute(transform)} rotate(${placement.rotateDeg + instance.rotationDeg}) scale(${placement.mirror ? -expansion : expansion} ${expansion})` : undefined}>
        <AtlasFrame src={atlas.src} frame={atlas} palette={atlas.palette} index={localIndex}
          x={-placement.anchorX * placement.width} y={-placement.anchorY * placement.height}
          width={placement.width} height={placement.height} />
      </g>
    {/if}
  {/each}
{/if}

<style>
  .chain-glow, .chain-core { fill: none; stroke-linejoin: round; stroke-linecap: round; }
  .chain-glow { stroke: #658bff; stroke-width: 11; opacity: .35; }
  .chain-core { stroke: #d6faff; stroke-width: 2.5; }
  .rain-impact-ring { fill: none; stroke: currentColor; stroke-width: 5; vector-effect: non-scaling-stroke; }
</style>
