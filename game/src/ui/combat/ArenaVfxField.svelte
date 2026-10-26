<script lang="ts">
  import ArenaFxSprite from './ArenaFxSprite.svelte';
  import { activeVfxSheet } from './arena-active-vfx';
  import type { VfxFootprint } from './arena-vfx-space';
  let { area, age, element, art = 'ring-1712', sustained = false, charging = false, reducedMotion = false }: {
    area:VfxFootprint; age:number; element:string; art?:string; sustained?:boolean; charging?:boolean; reducedMotion?:boolean;
  } = $props();
  const lightId = $props.id();
  const fieldArt = $derived(activeVfxSheet(art).kind==='cylinder' ? 'ring-1712' : art);
  const matrix = $derived(`matrix(${area.basisX.x} ${area.basisX.y} ${area.basisY.x} ${area.basisY.y} ${area.center.x} ${area.center.y})`);
  const onset = $derived(Math.min(1,Math.max(0,age)*10));
  const fade = $derived(charging ? .18 : sustained ? .42 : Math.max(0,1-age/.65)*.65);
  const spread = $derived(reducedMotion ? .92 : .2+Math.min(1,age/.35)*.8);
</script>

{#if age >= 0}
  <g transform={matrix} opacity={onset} data-vfx-footprint>
    <defs>
      <radialGradient id={lightId}>
        <stop offset="0" stop-color="currentColor" stop-opacity=".48" />
        <stop offset=".55" stop-color="currentColor" stop-opacity=".22" />
        <stop offset="1" stop-color="currentColor" stop-opacity="0" />
      </radialGradient>
    </defs>
    <circle class="field-light" r="1.06" fill={`url(#${lightId})`} opacity={fade} />
    <ArenaFxSprite art={fieldArt} age={age} width={charging ? 1.95 : 2*spread} height={charging ? 1.95 : 2*spread} {element} loop={sustained} opacity={charging ? .18 : sustained ? .35 : Math.max(0,1-age/.75)*.7} {reducedMotion} />
    {#if age < .5}
      <circle r={spread} fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" opacity={Math.max(0,1-age/.5)*.5} />
    {/if}
  </g>
{/if}

<style>
  .field-light { mix-blend-mode:screen; }
</style>
