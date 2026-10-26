<script lang="ts">
  import type { VfxFootprint } from './arena-vfx-space';
  import { whirlwindBlades, whirlwindDust, whirlwindFade, whirlwindRibbon, whirlwindRounds, whirlwindSize, whirlwindSpin } from './arena-whirlwind';

  type Point = {x:number; y:number};
  let { age, source, point, ground, cast, area, duration, strikes = 3, charging = false, windup = 0,
    reducedMotion = false, critical = false, layer = 'front' }: {
    age:number; source:Point; point:Point; ground:Point; cast:boolean; area?:VfxFootprint;
    duration:number; strikes?:number; charging?:boolean; windup?:number; reducedMotion?:boolean;
    critical?:boolean; layer?:'ground'|'front';
  } = $props();
  const id = $props.id();
  const total = $derived(Math.max(.2, duration));
  const rounds = $derived(Math.max(1, Math.round(strikes)));
  const floor = $derived({x:source.x, y:source.y+58});
  const width = $derived(whirlwindSize(area?.diameter));
  const height = $derived(width*1.12);
  const spin = $derived(whirlwindSpin(Math.max(0, age), total, rounds, reducedMotion));
  const fade = $derived(whirlwindFade(age, total));
  const ribbons = $derived(Array.from({length:4},(_,index)=>whirlwindRibbon(width,height,spin,index,4)));
  const blades = $derived(whirlwindBlades(width,height,spin,rounds));
  const dust = $derived(whirlwindDust(width,Math.max(0,age),reducedMotion));
  const beats = $derived(whirlwindRounds(age,total,rounds));
  const areaMatrix = $derived(area ? `matrix(${area.basisX.x} ${area.basisX.y} ${area.basisY.x} ${area.basisY.y} ${area.center.x} ${area.center.y})` : '');
  const chargeRibbon = $derived(whirlwindRibbon(width*.62,height*.5,reducedMotion?0:windup*Math.PI*3,0,3));
  const baseY = $derived(ground.y-point.y);
  const arc = (radius:number) => `M${-radius} 0 A${radius} ${radius*.62} 0 0 1 ${radius} 0`;
</script>

{#if cast && layer === 'ground' && area}
  <g transform={areaMatrix} class="whirlwind" data-whirlwind-ground opacity={charging ? .3+windup*.35 : Math.min(1,fade*1.2)}>
    <defs>
      <radialGradient id={`${id}-field`}>
        <stop offset="0" stop-color="currentColor" stop-opacity=".34" />
        <stop offset=".62" stop-color="currentColor" stop-opacity=".13" />
        <stop offset="1" stop-color="currentColor" stop-opacity="0" />
      </radialGradient>
    </defs>
    <circle r="1.08" fill={`url(#${id}-field)`} />
    <circle class="ring" r=".98" stroke-dasharray=".17 .09" stroke-dashoffset={reducedMotion?0:-age*.8} opacity=".55" />
    <circle class="ring" r=".72" stroke-dasharray=".11 .1" stroke-dashoffset={reducedMotion?0:age*1.1} opacity=".38" />
    <circle class="ring" r=".42" stroke-dasharray=".08 .13" stroke-dashoffset={reducedMotion?0:-age*1.6} opacity=".3" />
    {#each Array.from({length:8},(_,index)=>index) as tick}
      {@const angle = tick/8*Math.PI*2+(reducedMotion?0:age*.7)}
      <path class="tick" d={`M${Math.cos(angle)*.78} ${Math.sin(angle)*.78} L${Math.cos(angle)*1.03} ${Math.sin(angle)*1.03}`} opacity=".4" />
    {/each}
  </g>
{/if}

{#if cast && charging && layer === 'front'}
  <g transform={`translate(${floor.x} ${floor.y})`} class="whirlwind" opacity={.25+windup*.45} data-whirlwind-charge>
    <ellipse rx={width*(.12+windup*.16)} ry={width*(.04+windup*.05)} fill="none" stroke="currentColor"
      stroke-width="1.4" stroke-dasharray="10 8" stroke-dashoffset={-windup*36} opacity=".7" />
    <path d={chargeRibbon.fill} fill="currentColor" opacity=".28" />
    <path d={chargeRibbon.core} fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".5" />
  </g>
{/if}

{#if cast && layer === 'front' && age >= 0}
  <g transform={`translate(${floor.x} ${floor.y})`} class="whirlwind" opacity={fade} data-whirlwind-cast data-whirlwind-rounds={rounds}>
    <defs>
      <radialGradient id={`${id}-base`}>
        <stop offset="0" stop-color="currentColor" stop-opacity=".3" />
        <stop offset=".58" stop-color="currentColor" stop-opacity=".11" />
        <stop offset="1" stop-color="currentColor" stop-opacity="0" />
      </radialGradient>
      {#each ribbons as _, index}
        <linearGradient id={`${id}-ribbon-${index}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={-height}>
          <stop offset="0" stop-color="currentColor" stop-opacity=".05" />
          <stop offset=".28" stop-color="currentColor" stop-opacity=".36" />
          <stop offset=".68" stop-color="currentColor" stop-opacity=".74" />
          <stop offset="1" stop-color="currentColor" stop-opacity=".1" />
        </linearGradient>
      {/each}
    </defs>
    <ellipse rx={width*.56} ry={width*.17} fill={`url(#${id}-base)`} />
    <ellipse class="ring" rx={width*.5} ry={width*.15} stroke-dasharray={`${width*.11} ${width*.07}`} stroke-dashoffset={reducedMotion?0:-age*width*.7} opacity=".52" />
    <ellipse class="ring" rx={width*.36} ry={width*.11} stroke-dasharray={`${width*.07} ${width*.08}`} stroke-dashoffset={reducedMotion?0:age*width*1.05} opacity=".34" />
    {#each ribbons as ribbon, index}
      <path d={ribbon.fill} fill={`url(#${id}-ribbon-${index})`} opacity={.78-index*.06} />
      <path d={ribbon.core} fill="none" stroke="#f2fbff" stroke-width="1.05" stroke-linecap="round" opacity=".26" />
    {/each}
    {#each blades as blade}
      <g transform={`translate(${blade.x} ${blade.y}) rotate(${blade.rotation})`} opacity={blade.opacity}>
        <path class="blade-glow" d={arc(blade.radius)} />
        <path class="blade" d={arc(blade.radius)} />
        <path class="blade-core" d={arc(blade.radius)} stroke-dasharray={`${blade.radius*.9} ${blade.radius*2.4}`} stroke-dashoffset={-blade.radius*.35} />
      </g>
    {/each}
    <path class="gust" d={`M${-width*.09} 0 C${-width*.3} ${-height*.3} ${width*.02} ${-height*.58} ${-width*.04} ${-height*.94}`} />
    <path class="gust" d={`M${width*.13} 0 C${width*.02} ${-height*.26} ${-width*.16} ${-height*.55} ${width*.06} ${-height*.88}`} opacity=".6" />
    {#each dust as speck}
      <path d="M0-2 1.5 0 0 2-1.5 0Z" fill="currentColor" opacity={speck.opacity}
        transform={`translate(${speck.x.toFixed(2)} ${speck.y.toFixed(2)}) scale(${(speck.size/2).toFixed(2)})`} />
    {/each}
    {#if critical}<circle r={width*.2} fill="none" stroke="#f2fbff" stroke-width="1.5" stroke-dasharray="6 10" opacity=".55" />{/if}
  </g>
{/if}

{#if !cast && layer === 'front' && age >= 0}
  <g transform={`translate(${point.x} ${point.y})`} class="whirlwind" data-whirlwind-hit>
    {#each reducedMotion ? beats.slice(0,1) : beats as beat}
      {@const progress = reducedMotion ? Math.max(0,Math.min(1,Math.max(0,age)/total)) : beat.progress}
      {@const rotation = reducedMotion ? beat.index*26 : beat.index*72+progress*54}
      {@const radius = 34+beat.index*4+progress*26}
      {#if reducedMotion || (beat.local >= 0 && progress < 1)}
        <g opacity={Math.max(0,1-progress)}>
          {#if critical && progress < .24}<circle r={radius*.72} fill="currentColor" opacity={.32*(1-progress/.24)} />{/if}
          {#if progress < .18}<circle r={radius*.5} fill="none" stroke="#f2fbff" stroke-width="2" opacity={.7*(1-progress/.18)} />{/if}
          <g transform={`rotate(${rotation})`}>
            <path class="cut-glow" d={arc(radius)} />
            <path class="cut" d={arc(radius)} />
            <path class="cut-core" d={arc(radius*.74)} transform="rotate(118)" />
          </g>
          <g transform={`rotate(${rotation-74})`} opacity=".55">
            <path class="cut" d={arc(radius*.88)} />
          </g>
          <ellipse class="hit-ring" cy={baseY} rx={16+progress*30} ry={5+progress*10} opacity={.55*(1-progress)} />
          {#each Array.from({length:7},(_,index)=>index) as shard}
            {@const shardAngle = beat.index*1.37+shard/7*Math.PI*2+progress*.9}
            {@const distance = 14+progress*(22+shard*2.6)}
            <path d="M0-2.2 1.5 0 0 2.2-1.5 0Z" fill="currentColor" opacity={(1-progress)*(.3+shard*.04)}
              transform={`translate(${(Math.cos(shardAngle)*distance).toFixed(2)} ${(baseY-6+Math.sin(shardAngle)*distance*.45-progress*9).toFixed(2)}) rotate(${(shardAngle*180/Math.PI).toFixed(1)})`} />
          {/each}
          <path class="hit-gust" d={`M0 ${baseY-14} C${radius*.5} ${baseY-30} ${-radius*.4} ${baseY-42} ${radius*.12} ${baseY-58}`} opacity={(1-progress)*.5} />
        </g>
      {/if}
    {/each}
  </g>
{/if}

<style>
  .whirlwind { pointer-events: none; mix-blend-mode: screen; }
  .ring, .tick, .gust, .hit-gust { fill: none; stroke: currentColor; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .ring { stroke-width: 1.35; }
  .tick { stroke-width: 1.2; }
  .gust { stroke-width: 1.4; opacity: .16; }
  .hit-gust { stroke-width: 1.2; opacity: .4; }
  .blade-glow { fill: none; stroke: currentColor; stroke-width: 7; stroke-linecap: round; opacity: .15; }
  .blade { fill: none; stroke: currentColor; stroke-width: 2.3; stroke-linecap: round; opacity: .76; }
  .blade-core { fill: none; stroke: #f2fbff; stroke-width: 1.05; stroke-linecap: round; opacity: .82; }
  .cut-glow { fill: none; stroke: currentColor; stroke-width: 9; stroke-linecap: round; opacity: .14; }
  .cut { fill: none; stroke: currentColor; stroke-width: 2.8; stroke-linecap: round; opacity: .8; }
  .cut-core { fill: none; stroke: #f7fdff; stroke-width: 1.2; stroke-linecap: round; opacity: .9; }
  .hit-ring { fill: none; stroke: currentColor; stroke-width: 1.3; stroke-dasharray: 5 4; stroke-linecap: round; }
</style>
