<script lang="ts">
  import { ARENA_CAMERA, ARENA_VIEW, projectArenaPoint, type ArenaViewSize } from '../../presentation/arena-camera';
  import type { ArenaArt } from './arena/arena-art';

  let { camera, material, width = ARENA_VIEW.width, height = ARENA_VIEW.height, view = ARENA_VIEW }: {
    camera: { x: number; y: number }; material: ArenaArt['background']; width?: number; height?: number;
    view?: ArenaViewSize;
  } = $props();
  const instanceId = $props.id();
  const patternId = `${instanceId}-ground`;
  const origin = projectArenaPoint({ x: 0, y: 0 });
  const { a, b, c, d } = ARENA_CAMERA.projection;
  const transform = `matrix(${a} ${b} ${c} ${d} ${origin.x} ${origin.y})`;
</script>

<!-- The parent follows the world. This viewport-sized surface samples a world-anchored material. -->
<svg class="arena-ground" viewBox={`${camera.x} ${camera.y} ${view.width} ${view.height}`}
  preserveAspectRatio="none" aria-hidden="true" data-world-ground data-ground-material={material.id}
  style:left={`${camera.x * width / view.width}px`} style:top={`${camera.y * height / view.height}px`}
  style:width={`${width}px`} style:height={`${height}px`}>
  <defs>
    <pattern id={patternId} patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse"
      width={material.tileSizeM} height={material.tileSizeM} patternTransform={transform}>
      <image href={material.href} x="0" y="0" width={material.tileSizeM} height={material.tileSizeM}
        preserveAspectRatio="none" />
    </pattern>
  </defs>
  <rect x={camera.x} y={camera.y} width={view.width} height={view.height}
    fill={`url(#${patternId})`} />
</svg>

<style>
  .arena-ground { position: absolute; display: block; overflow: hidden; user-select: none; pointer-events: none; }
</style>
