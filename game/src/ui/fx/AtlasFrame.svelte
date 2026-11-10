<script lang="ts">
  import type { VfxFrameGrid } from './catalog';
  import { reportVfxAssetFailure } from './vfx-assets.svelte';
  import { vfxPaletteTables, type VfxPaletteId } from './palettes';

  let { src, frame, index, x = 0, y = 0, width = '100%', height = '100%', palette }: {
    src: string; frame: VfxFrameGrid; index: number;
    x?: number; y?: number; width?: number | string; height?: number | string;
    palette?: VfxPaletteId;
  } = $props();
  const filterId = $props.id();
  const tables = $derived(palette ? vfxPaletteTables(palette) : null);

  function onImageError() {
    reportVfxAssetFailure(src);
  }

  const rect = $derived(frame.sourceFrames?.[index]?.rect
    ?? [(index % frame.columns) * frame.width, Math.floor(index / frame.columns) * frame.height, frame.width, frame.height]);
  const offset = $derived(frame.sourceFrames?.[index]);
</script>

<svg class="atlas-frame" {x} {y} {width} {height} aria-hidden="true"
  viewBox={`0 0 ${frame.virtualWidth ?? frame.width} ${frame.virtualHeight ?? frame.height}`} preserveAspectRatio="none"
  data-atlas-frame={index}>
  {#if tables}
    <defs><filter id={filterId} x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncR type="table" tableValues={tables[0]} />
        <feFuncG type="table" tableValues={tables[1]} />
        <feFuncB type="table" tableValues={tables[2]} />
      </feComponentTransfer>
    </filter></defs>
  {/if}
  <svg x={offset?.offsetX ?? 0} y={offset?.offsetY ?? 0} width={rect[2]} height={rect[3]}
    viewBox={rect.join(' ')} preserveAspectRatio="none">
    <image href={src} onerror={onImageError} filter={tables ? `url(#${filterId})` : undefined} width={frame.textureWidth ?? frame.width * frame.columns}
      height={frame.textureHeight ?? frame.height * (frame.rows ?? Math.ceil(frame.count / frame.columns))} />
  </svg>
</svg>

<style>
  .atlas-frame, .atlas-frame > svg { overflow: hidden; }
</style>
