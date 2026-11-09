<script lang="ts">
  import type { VfxAtlas } from '../fx/catalog';
  import AtlasFrame from '../fx/AtlasFrame.svelte';
  import { atlasFrameIndex, atlasOpacity, skillArtPlacement, groundDecalMatrixForFrame, GROUND_CANVAS_PX } from './arena-skill-art';
  import { ARENA_REF_PX_PER_M } from '../../presentation/arena-camera';
  import { matrixAttribute } from '../../presentation/view-transform';
  import type { FieldViewFrame } from '../../presentation/arena-view-frame';
  import type { SkillGeometry, SkillGeometryScreen } from './skill-geometry';
  import { skillRainDrops } from './meteor-rain';

  let { mark, screen, frame, atlas, reducedMotion = false }: {
    mark: SkillGeometry; screen: SkillGeometryScreen; frame: FieldViewFrame;
    atlas: VfxAtlas; reducedMotion?: boolean;
  } = $props();

  // Reduced motion keeps the authored silhouette and contact while freezing its animation.
  const still = $derived(reducedMotion ? { ...mark, phaseElapsedSec: 0 } : mark);
  const index = $derived(atlasFrameIndex(still, atlas));
  const opacity = $derived(atlasOpacity(mark, atlas));
  const placement = $derived(skillArtPlacement(mark, atlas, frame, screen));
  const rain = $derived(skillRainDrops(mark, frame, atlas, reducedMotion));
  const groundTransform = $derived(atlas.projection === 'ground'
    ? (groundDecalMatrixForFrame(screen.center,
      mark.area.radiusM, frame, GROUND_CANVAS_PX, atlas.content?.widthRatio ?? 1) ?? null) : null);
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
  <g data-skill-art={mark.skillId} data-skill-ground-shader data-skill-art-phase={mark.phase.toLowerCase()}
    transform={matrixAttribute(groundTransform)} {opacity}>
    <AtlasFrame src={atlas.src} frame={atlas} {index} x={0} y={0} width={2048} height={2048} />
  </g>
{:else if atlas.rainDurationSec}
  <g data-skill-art={mark.skillId} data-skill-rain data-skill-art-phase={mark.phase.toLowerCase()} style:color={mark.colour}
    transform={frame.renderable ? matrixAttribute(frame.worldToViewport) : undefined}>
    {#each rain as drop (drop.id)}
      <g data-rain-drop={drop.id} opacity={drop.opacity}>
        {#if drop.impactProgress != null}
          <circle class="rain-impact-ring" data-rain-impact cx={drop.x} cy={drop.y}
            r={drop.size * (.1 + .1 * drop.impactProgress)}
            opacity={Math.max(0, 1 - drop.impactProgress * 2)} />
        {/if}
        {#if drop.fragments.length}
          {#each drop.fragments as shard (shard.index + ':' + shard.rotationDeg)}
            <g opacity={1 - (drop.impactProgress ?? 0)} transform={`rotate(${shard.rotationDeg} ${shard.x} ${shard.y})`}>
              <AtlasFrame src={atlas.src} frame={atlas} index={shard.index}
                x={shard.x - shard.size * .5} y={shard.y - shard.size * .5}
                width={shard.size} height={shard.size} />
            </g>
          {/each}
        {:else}
          <g transform={drop.rotationDeg ? `rotate(${drop.rotationDeg} ${drop.x} ${drop.y})` : undefined}>
            <AtlasFrame src={atlas.src} frame={atlas} index={drop.index}
              x={drop.x - drop.size * .5} y={drop.y - drop.size * (atlas.rainPhase === 'Field' ? .5 : .78)}
              width={drop.size} height={drop.size} />
          </g>
        {/if}
      </g>
    {/each}
  </g>
{:else if opacity > 0 && placement && (!mark.chainHop || mark.phase === 'Impact')}
  <g data-skill-art={mark.skillId} data-skill-art-phase={mark.phase.toLowerCase()} opacity={opacity}
    transform={frame.renderable ? `${matrixAttribute(frame.worldToViewport)} translate(${placement.cx} ${placement.cy}) rotate(${placement.rotateDeg}) scale(${placement.mirror ? -1 : 1} 1)` : undefined}>
    <AtlasFrame src={atlas.src} frame={atlas} {index}
      x={-placement.anchorX * placement.width} y={-placement.anchorY * placement.height}
      width={placement.width} height={placement.height} />
  </g>
{/if}

<style>
  .chain-glow, .chain-core { fill: none; stroke-linejoin: round; stroke-linecap: round; }
  .chain-glow { stroke: #658bff; stroke-width: 11; opacity: .35; }
  .chain-core { stroke: #d6faff; stroke-width: 2.5; }
  .rain-impact-ring { fill: none; stroke: currentColor; stroke-width: 5; vector-effect: non-scaling-stroke; }
</style>
