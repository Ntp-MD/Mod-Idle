<script lang="ts">
  import ArenaFxSprite from './ArenaFxSprite.svelte';
  let { age, family, element, source, point, ground, size, cast, self, critical = false, reducedMotion = false }: {
    age:number; family:string; element:string; source:{x:number;y:number}; point:{x:number;y:number};
    ground:{x:number;y:number}; size:number; cast:boolean; self:boolean; critical?:boolean; reducedMotion?:boolean;
  } = $props();
  const glowId = $props.id();
  const area = $derived(['storm','rain','quake','nova'].includes(family));
  const primary = $derived(cast ? area || self || family==='fan' || family==='curse' : !area && !self && family!=='curse' && family!=='fan');
  const center = $derived(self ? source : point);
  const hot = $derived(element==='fire' || element==='lightning');
  const material = $derived(element==='earth' ? 'shard-1472' : element==='cold' ? 'shard-1350' : element==='poison' ? 'orb/3b' : 'spark-1054');
  const count = $derived(reducedMotion ? 3 : critical ? 12 : 8);
  const directional = $derived(['slash','thrust','projectile'].includes(family));
  const angle = $derived(Math.atan2(point.y-source.y,point.x-source.x));
  const flash = $derived(Math.max(0,1-age/.14));
</script>

{#if primary && age >= 0}
  <g class="atmosphere" aria-hidden="true">
    <defs>
      <radialGradient id={glowId}>
        <stop offset="0" stop-color={hot ? '#fff6ce' : '#effcff'} stop-opacity=".95" />
        <stop offset=".22" stop-color="currentColor" stop-opacity=".62" />
        <stop offset="1" stop-color="currentColor" stop-opacity="0" />
      </radialGradient>
    </defs>
    {#if age < .14 && family!=='ward' && family!=='heal' && family!=='curse'}
      <ellipse cx={center.x} cy={center.y} rx={size*.48} ry={size*.34} fill={`url(#${glowId})`} opacity={flash*(critical ? .85 : .6)} />
    {/if}
    {#if family === 'storm'}
      {#each Array.from({length:count},(_,i)=>i) as i}
        {@const life=reducedMotion ? i/count : (age*.8+i/count)%1}
        {@const phase=i*2.4+(reducedMotion?0:age*6.5)}
        {@const radius=size*(.08+life*.31)}
        <ArenaFxSprite art={material} age={life*.28} x={ground.x+Math.cos(phase)*radius}
          y={ground.y-Math.sin(phase)*radius*.3-life*size*.95} width={7+life*10}
          height={hot?15+life*10:12+life*8} rotation={phase*180/Math.PI} opacity={Math.sin(life*Math.PI)*.8} {element} {reducedMotion} />
      {/each}
    {:else if age < .62 && !['ward','heal','curse','rain','fan'].includes(family)}
      {#each Array.from({length:count},(_,i)=>i) as i}
        {@const t=Math.max(0,age-i*.009)}
        {@const a=directional ? angle+(i/(count-1)-.5)*1.5 : i*2.4}
        {@const velocity=(.65+(i%4)*.15)*size*1.4}
        {@const x=center.x+(reducedMotion?Math.cos(a)*15:Math.cos(a)*velocity*t)}
        {@const y=center.y+(reducedMotion?Math.sin(a)*10:Math.sin(a)*velocity*t*.55-velocity*t*.48+250*t*t)}
        <ArenaFxSprite art={material} age={t*.75} {x} {y} width={element==='earth'?17:10+i%3*3}
          height={element==='earth'?20:5+i%3*2} rotation={a*180/Math.PI+(reducedMotion?0:t*130)}
          opacity={Math.max(0,1-t/.55)*.9} {element} {reducedMotion} />
      {/each}
    {/if}
    {#if element === 'fire' && age > .1 && age < .85 && family!=='storm'}
      <ArenaFxSprite art="smoke-1428" age={(age-.1)*.65} x={center.x} y={center.y-(reducedMotion?12:age*35)}
        width={size*(.65+Math.min(.4,age*.5))} opacity={Math.max(0,1-age/.85)*.24} element="earth" {reducedMotion} />
    {/if}
  </g>
{/if}

<style>
  .atmosphere { pointer-events:none; mix-blend-mode:screen; }
</style>
