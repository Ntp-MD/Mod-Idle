<script lang="ts">
  import type { FieldViewFrame } from '../../presentation/arena-view-frame';
  import { matrixAttribute } from '../../presentation/view-transform';
  import type { ArenaArt } from './arena/arena-art';

  let { frame, material }: {
    frame: FieldViewFrame; material: ArenaArt['background'];
  } = $props();
  const instanceId = $props.id();
  const patternId = `${instanceId}-ground`;
</script>

{#if frame.renderable}
<svg class="arena-ground" viewBox={`0 0 ${frame.viewportCss.width} ${frame.viewportCss.height}`}
  preserveAspectRatio="none" aria-hidden="true" data-world-ground data-ground-material={material.id}
  data-ground-ppm={frame.cssPixelsPerMeter}>
  <defs>
    <pattern id={patternId} patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse"
      width={material.tileSizeM} height={material.tileSizeM} patternTransform={matrixAttribute(frame.worldToViewport)}>
      <image href={material.href} x="0" y="0" width={material.tileSizeM} height={material.tileSizeM}
        preserveAspectRatio="none" />
    </pattern>
  </defs>
  <rect x="0" y="0" width={frame.viewportCss.width} height={frame.viewportCss.height}
    fill={`url(#${patternId})`} />
</svg>
{/if}

<style>
  .arena-ground { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: hidden; user-select: none; pointer-events: none; }
</style>
