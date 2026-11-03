<script lang="ts">
  import type { VfxFrameGrid } from './catalog';

  let { src, frame, index, x = 0, y = 0, width = '100%', height = '100%' }: {
    src: string; frame: VfxFrameGrid; index: number;
    x?: number; y?: number; width?: number | string; height?: number | string;
  } = $props();

  const rect = $derived(frame.sourceFrames?.[index]?.rect
    ?? [(index % frame.columns) * frame.width, Math.floor(index / frame.columns) * frame.height, frame.width, frame.height]);
  const offset = $derived(frame.sourceFrames?.[index]);
</script>

<svg class="atlas-frame" {x} {y} {width} {height} aria-hidden="true"
  viewBox={`0 0 ${frame.virtualWidth ?? frame.width} ${frame.virtualHeight ?? frame.height}`} preserveAspectRatio="none"
  data-atlas-frame={index}>
  <svg x={offset?.offsetX ?? 0} y={offset?.offsetY ?? 0} width={rect[2]} height={rect[3]}
    viewBox={rect.join(' ')} preserveAspectRatio="none">
    <image href={src} width={frame.textureWidth ?? frame.width * frame.columns}
      height={frame.textureHeight ?? frame.height * (frame.rows ?? Math.ceil(frame.count / frame.columns))} />
  </svg>
</svg>

<style>
  .atlas-frame, .atlas-frame > svg { overflow: hidden; }
</style>
