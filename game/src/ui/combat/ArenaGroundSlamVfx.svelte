<script lang="ts">
  import {
    GROUND_SLAM_VFX_DURATION, SLAM_CHIPS, SLAM_CRACKS, SLAM_CORE, SLAM_MOTES, SLAM_PUFFS,
    SLAM_RING_INNER, SLAM_RING_OUTER, SLAM_RING_SECOND, SLAM_RIM, SLAM_SHARDS, SLAM_SPLINTERS,
    groundSlamMatrix, groundSlamSpace, slamChipState, slamMoteState, slamPuffState, slamShardState, slamTimeline,
  } from './arena-ground-slam-vfx';
  import type { VfxFootprint } from './arena-vfx-space';

  let { elapsed, windup = 0, cast = true, layer, origin, area, reducedMotion = false }: {
    elapsed: number; windup?: number; cast?: boolean; layer: 'ground' | 'front';
    origin: {x:number; y:number}; area?: VfxFootprint; reducedMotion?: boolean;
  } = $props();
  const uid = $props.id();
  const compact = $derived(!cast);
  const timeline = $derived(slamTimeline(elapsed, cast ? windup : 0, reducedMotion));
  const space = $derived(groundSlamSpace(origin, area, compact));
  const matrix = $derived(groundSlamMatrix(space));
  const radius = $derived(Math.hypot(space.basisX.x, space.basisX.y));
  const cracks = $derived(compact ? SLAM_CRACKS.filter((_, index) => index % 2 === 0) : SLAM_CRACKS);
  const puffs = $derived(compact ? SLAM_PUFFS.slice(0, 7) : SLAM_PUFFS);
  const shards = $derived(compact ? SLAM_SHARDS.slice(0, 5) : SLAM_SHARDS);
  const chips = $derived(compact ? SLAM_CHIPS.slice(0, 6) : SLAM_CHIPS);
</script>

{#if elapsed >= 0 && elapsed <= GROUND_SLAM_VFX_DURATION}
  <defs>
    <radialGradient id={`${uid}-core`}>
      <stop offset="0" stop-color="#fff2cc" stop-opacity=".95" />
      <stop offset=".42" stop-color="#dda354" stop-opacity=".62" />
      <stop offset="1" stop-color="#8a5a2b" stop-opacity="0" />
    </radialGradient>
    <radialGradient id={`${uid}-dust`}>
      <stop offset="0" stop-color="#d3b184" stop-opacity=".58" />
      <stop offset=".55" stop-color="#9a7446" stop-opacity=".28" />
      <stop offset="1" stop-color="#654526" stop-opacity="0" />
    </radialGradient>
    <radialGradient id={`${uid}-crater`}>
      <stop offset="0" stop-color="#160d06" stop-opacity=".78" />
      <stop offset=".62" stop-color="#372112" stop-opacity=".66" />
      <stop offset="1" stop-color="#6b4525" stop-opacity="0" />
    </radialGradient>
  </defs>

  {#if layer === 'ground'}
    <g transform={matrix} opacity={timeline.fade} data-ground-slam-vfx={cast ? 'cast' : 'hit'} data-ground-slam-layer="ground">
      {#if cast && !timeline.started}
        <circle r={.44 - .12 * timeline.charge} class="slam-gather-ring" opacity={.55 * timeline.charge} />
        <circle r=".5" fill={`url(#${uid}-dust)`} opacity={.16 * timeline.charge} />
        {#if !reducedMotion}
          {#each SLAM_MOTES as mote}
            {@const state = slamMoteState(mote, timeline.charge)}
            <polygon points={`0 ${-state.size} ${state.size * .78} ${state.size * .58} ${-state.size * .78} ${state.size * .58}`}
              transform={`translate(${state.x} ${state.y})`} class="slam-mote" opacity={state.opacity} />
          {/each}
        {/if}
      {/if}

      {#if timeline.started}
        {#each puffs as puff}
          {@const state = slamPuffState(puff, timeline.u, reducedMotion)}
          <circle cx={state.x} cy={state.y} r={state.size} fill={`url(#${uid}-dust)`} opacity={state.opacity} />
        {/each}

        <circle r=".32" fill={`url(#${uid}-crater)`} />
        <path d={SLAM_RIM} class="slam-crater-rim" opacity={.8 * timeline.cracks} />

        {#each cracks as crack}
          <path d={crack} pathLength="1" class="slam-crack-dark" stroke-dashoffset={1 - timeline.cracks} />
        {/each}
        {#each cracks as crack}
          <path d={crack} pathLength="1" class="slam-crack-glow" stroke-dashoffset={1 - timeline.cracks} />
        {/each}

        <g transform={`scale(${.22 + 1.02 * timeline.wave})`} opacity={.9 * (1 - timeline.wave * .55)}>
          <path d={SLAM_RING_OUTER} class="slam-wave-earth" />
          <path d={SLAM_RING_OUTER} class="slam-wave-hot" />
        </g>
        <g transform={`scale(${.16 + 1.05 * timeline.wave2})`} opacity={.55 * (1 - timeline.wave2)}>
          <path d={SLAM_RING_SECOND} class="slam-wave-second" />
        </g>
        <g transform={`scale(${.3 + .7 * timeline.wave})`} opacity={.3 * (1 - timeline.wave)}>
          <path d={SLAM_RING_INNER} class="slam-wave-inner" />
        </g>

        <path d={SLAM_CORE} class="slam-impact-core" transform={`scale(${.45 + 1.45 * timeline.flash})`} opacity={timeline.flash} />
        <path d={SLAM_SPLINTERS} class="slam-splinters" opacity={timeline.flash} />
        <circle r=".48" fill={`url(#${uid}-core)`} opacity={timeline.flash * .8} />
      {/if}
    </g>
  {:else}
    <g opacity={timeline.fade} data-ground-slam-vfx={cast ? 'cast' : 'hit'} data-ground-slam-layer="front">
      {#if timeline.started}
        <ellipse cx={space.center.x} cy={space.center.y - radius * .18 * timeline.dust}
          rx={radius * (.22 + .34 * timeline.dust)} ry={radius * (.1 + .18 * timeline.dust)}
          fill={`url(#${uid}-dust)`} opacity={.22 * (1 - timeline.u / GROUND_SLAM_VFX_DURATION)} />
        <ellipse cx={space.center.x} cy={space.center.y - radius * .36 * timeline.dust}
          rx={radius * (.12 + .22 * timeline.dust)} ry={radius * (.08 + .2 * timeline.dust)}
          fill={`url(#${uid}-dust)`} opacity={.16 * (1 - timeline.u / GROUND_SLAM_VFX_DURATION)} />

        {#each shards as shard}
          {@const state = slamShardState(shard, timeline.u, space, reducedMotion)}
          {#if state}
            <g transform={`translate(${state.x} ${state.y}) rotate(${state.rotation}) scale(${state.scale * (compact ? 1.7 : 1)})`} opacity={state.opacity}>
              <path d={shard.polygon} class="slam-shard" />
              <path d={shard.facet} class="slam-shard-facet" />
            </g>
          {/if}
        {/each}
        {#each chips as chip}
          {@const state = slamChipState(chip, timeline.u, space, reducedMotion)}
          {#if state}
            <circle cx={state.x} cy={state.y} r={state.size} class="slam-chip" opacity={state.opacity} />
          {/if}
        {/each}
      {/if}
    </g>
  {/if}
{/if}

<style>
  .slam-gather-ring { fill:none; stroke:#d8ad6d; stroke-width:.012; stroke-dasharray:.07 .05; }
  .slam-mote { fill:#e0b064; }
  .slam-crater-rim { fill:none; stroke:#c08a4c; stroke-width:.022; stroke-linecap:round; }
  .slam-crack-dark { fill:none; stroke:#2b1a0d; stroke-width:.038; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:1; }
  .slam-crack-glow { fill:none; stroke:#f0c078; stroke-width:.012; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:1; mix-blend-mode:screen; }
  .slam-wave-earth { fill:none; stroke:#4a2f18; stroke-width:.055; stroke-linejoin:round; }
  .slam-wave-hot { fill:none; stroke:#ffdca2; stroke-width:.015; stroke-linejoin:round; mix-blend-mode:screen; }
  .slam-wave-second { fill:none; stroke:#b9813f; stroke-width:.024; stroke-linejoin:round; }
  .slam-wave-inner { fill:none; stroke:#8a5c2f; stroke-width:.02; stroke-linejoin:round; }
  .slam-impact-core { fill:#ffe9b8; stroke:#fff4d2; stroke-width:.012; mix-blend-mode:screen; }
  .slam-splinters { fill:none; stroke:#fff1c4; stroke-width:.013; stroke-linecap:round; mix-blend-mode:screen; }
  .slam-shard { fill:#4a301a; stroke:#e7bb7e; stroke-width:.06; stroke-linejoin:round; }
  .slam-shard-facet { fill:#a87b45; stroke:none; }
  .slam-chip { fill:#c79a5e; }
</style>
