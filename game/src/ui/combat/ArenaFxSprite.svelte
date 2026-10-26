<script lang="ts">
  import { activeVfxFrame } from './arena-active-vfx';
  let { art, age, x = 0, y = 0, width = 100, height = width, rotation = 0, opacity = 1,
    element = 'physical', loop = false, reducedMotion = false }: {
    art: string; age: number; x?: number; y?: number; width?: number; height?: number;
    rotation?: number; opacity?: number; element?: string; loop?: boolean; reducedMotion?: boolean;
  } = $props();
  const frame = $derived(activeVfxFrame(art, age, element, loop, reducedMotion));
  const filterId = $props.id();
</script>

{#if age >= 0 && opacity > 0}
  <g class="fx-sprite" transform={`translate(${x} ${y}) rotate(${rotation})`} opacity={opacity}>
    <svg x={-width / 2} y={-height / 2} {width} {height} viewBox={frame.viewBox} overflow="hidden" aria-hidden="true" preserveAspectRatio="none">
      {#if frame.sheet.kind === 'cylinder'}
        <defs>
          <filter id={filterId} color-interpolation-filters="sRGB">
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  4 4 4 1 -1" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
      {/if}
      <image href={frame.sheet.url} width={frame.sheet.cellWidth * frame.sheet.frames} height={frame.sheet.cellHeight * frame.sheet.rows}
        filter={frame.sheet.kind === 'cylinder' ? `url(#${filterId})` : undefined} />
    </svg>
  </g>
{/if}

<style>
  /* Light sheets add to the arena rather than covering it with opaque pixels. */
  .fx-sprite { mix-blend-mode: screen; }
</style>
