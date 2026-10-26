<script lang="ts">
  import ArenaAuthoredSkillVfx from './ArenaAuthoredSkillVfx.svelte';
  import type { VfxFootprint } from './arena-vfx-space';

  let { id, age, footprint, reducedMotion = false }: {
    id: string; age: number; footprint: VfxFootprint; reducedMotion?: boolean;
  } = $props();
  const clipId = $props.id();
  const colours: Record<string, string> = {
    wraith_of_fury: '#df654a', clarity: '#8dcfff', haste: '#ebbd60', vitality: '#94bb66',
    herald_of_ash: '#e88343', herald_of_frost: '#a6e0ff', herald_of_lightning: '#eadf86',
    ember_conversion: '#ef9052', rime_conversion: '#9edcff', storm_conversion: '#d9d880',
    cast_on_crit: '#d8b1e8', cast_on_damage_taken: '#c0b5db', rimbo_form: '#9fc9e1',
    elemental_fury: '#b999d2', trinity_form: '#dfcf9c', grace: '#dce5ed',
    iron_guard: '#a5afb8', energy_guard: '#76d9db',
  };
  const colour = $derived(colours[id.split('.')[1]] ?? '#dce5ed');
  const turn = $derived(reducedMotion ? 0 : age * 22 % 360);
</script>

<g data-ground-aura={id} transform={`matrix(${footprint.basisX.x} ${footprint.basisX.y} ${footprint.basisY.x} ${footprint.basisY.y} ${footprint.center.x} ${footprint.center.y})`} style:color={colour}>
  <defs>
    <clipPath id={clipId}>
      <path d="M1 0a1 1 0 1 0-2 0a1 1 0 1 0 2 0M.66 0a.66.66 0 1 1-1.32 0a.66.66 0 1 1 1.32 0" clip-rule="evenodd" />
    </clipPath>
  </defs>
  <circle r=".96" class="aura-contrast" />
  <circle r=".96" class="aura-rim" />
  <circle r=".7" class="aura-inner" />
  <g clip-path={`url(#${clipId})`}>
    <circle r="1" class="aura-bed" />
    <ArenaAuthoredSkillVfx {id} {age} duration={1} source={{x:0,y:0}} ground={{x:0,y:0}} baseSize={1.5} looping={true} {reducedMotion} />
  </g>
  <circle r=".96" class="aura-highlight" />
  <circle r=".84" class="aura-orbit" transform={`rotate(${turn})`} />
</g>

<style>
  .aura-rim, .aura-inner, .aura-orbit, .aura-contrast, .aura-highlight { fill: none; stroke: currentColor; }
  .aura-contrast { stroke: #111b1e; stroke-width: .12; opacity: .7; }
  .aura-bed { fill: currentColor; opacity: .16; }
  .aura-rim { stroke-width: .065; }
  .aura-highlight { stroke: color-mix(in srgb, currentColor 40%, white); stroke-width: .018; opacity: .85; }
  .aura-inner { stroke-width: .035; opacity: .8; }
  .aura-orbit { stroke-width: .08; stroke-dasharray: .38 .5 .12 .76; }
</style>
