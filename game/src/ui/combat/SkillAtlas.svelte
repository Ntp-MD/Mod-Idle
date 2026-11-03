<script lang="ts">
  import type { VfxAtlas } from '../fx/catalog';
  import AtlasFrame from '../fx/AtlasFrame.svelte';
  import { atlasFrameIndex, atlasOpacity, skillArtPlacement, groundDecalMatrix, matrixAttribute } from './arena-skill-art';
  import type { SkillGeometry } from './skill-geometry';
  import { skillRainDrops } from './meteor-rain';

  let { mark, atlas, reducedMotion = false }: {
    mark: SkillGeometry; atlas: VfxAtlas; reducedMotion?: boolean;
  } = $props();

  // Reduced motion keeps the authored silhouette and contact while freezing its animation.
  const still = $derived(reducedMotion ? { ...mark, phaseElapsedSec: 0 } : mark);
  const index = $derived(atlasFrameIndex(still, atlas));
  const opacity = $derived(atlasOpacity(mark, atlas));
  const placement = $derived(skillArtPlacement(mark, atlas));
  const rain = $derived(skillRainDrops(mark, atlas, reducedMotion));
  const groundTransform = $derived(atlas.projection === 'ground'
    ? matrixAttribute(groundDecalMatrix(mark.center,
      mark.area.radiusM, 2048, atlas.content?.widthRatio ?? 1)) : '');
  const chainPaths = $derived(mark.chainHop ? mark.paths : []);
  function boltPath(from: { x: number; y: number }, to: { x: number; y: number }, seed: number) {
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.max(1, Math.hypot(dx, dy));
    return Array.from({ length: 13 }, (_, index) => {
      const t = index / 12;
      const offset = index === 0 || index === 12 ? 0
        : Math.sin(index * 2.7 + seed * 1.9) * Math.min(12, length * .07);
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
{#if atlas.projection === 'ground' && opacity > 0}
  <g data-skill-art={mark.skillId} data-skill-ground-shader data-skill-art-phase={mark.phase.toLowerCase()}
    transform={groundTransform} {opacity}>
    <AtlasFrame src={atlas.src} frame={atlas} {index} x={0} y={0} width={2048} height={2048} />
  </g>
{:else if atlas.rainDurationSec}
  <g data-skill-art={mark.skillId} data-skill-rain data-skill-art-phase={mark.phase.toLowerCase()}>
    {#each rain as drop (drop.id)}
      <g data-rain-drop={drop.id} opacity={drop.opacity}>
        {#if drop.impactProgress != null}
          <ellipse class="ice-impact-ring" data-ice-impact cx={drop.x} cy={drop.y}
            rx={drop.size * (.1 + .1 * drop.impactProgress)} ry={drop.size * (.04 + .05 * drop.impactProgress)}
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
{:else if opacity > 0 && (!mark.chainHop || mark.phase === 'Impact')}
  <g data-skill-art={mark.skillId} data-skill-art-phase={mark.phase.toLowerCase()} opacity={opacity}
    transform={`translate(${placement.cx} ${placement.cy}) rotate(${placement.rotateDeg}) scale(${placement.mirror ? -1 : 1} 1)`}>
    <AtlasFrame src={atlas.src} frame={atlas} {index}
      x={-placement.anchorX * placement.width} y={-placement.anchorY * placement.height}
      width={placement.width} height={placement.height} />
  </g>
{/if}

<style>
  .chain-glow, .chain-core { fill: none; stroke-linejoin: round; stroke-linecap: round; }
  .chain-glow { stroke: #658bff; stroke-width: 11; opacity: .35; }
  .chain-core { stroke: #d6faff; stroke-width: 2.5; }
  .ice-impact-ring { fill: none; stroke: #c9f7ff; stroke-width: 5; vector-effect: non-scaling-stroke; }
</style>
