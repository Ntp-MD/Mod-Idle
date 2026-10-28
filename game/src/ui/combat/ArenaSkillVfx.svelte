<script lang="ts">
  import { sm } from '../../engine/client';
  import ArenaSkillVfxBody from './ArenaSkillVfxBody.svelte';
  import ArenaFxSprite from './ArenaFxSprite.svelte';
  import ArenaVfxField from './ArenaVfxField.svelte';
  import ArenaVfxShape from './ArenaVfxShape.svelte';
  import type { VfxFootprint, VfxTiming } from './arena-vfx-space';
  import { ACTIVE_VFX, activeVfxDuration, activeVfxElement, activeVfxMechanics, activeVfxPlaybackDuration, activeVfxResolvedHits } from './arena-active-vfx';
  import { authoredVfxFor } from './arena-authored-vfx';

  type Point = {x:number; y:number};
  let { id, shape, age:providedAge, source, point, ground, sourceGround, cast, element, layer = 'front', area, timing, flightProgressOverride, visualSeed = 0, allowComponents = true,
    targets, spreadTargets = [], consumed = 0, charges, cleansed = 0, critical = false, reducedMotion = false, chainFrom }: {
    allowComponents?:boolean; visualSeed?:number; id:string; shape:string; age:number; source:Point; point:Point; ground:Point; sourceGround?:Point; cast:boolean;
    element?:string; layer?:'ground'|'front'; area?:VfxFootprint; timing?:VfxTiming; flightProgressOverride?:number; targets?:Point[]; spreadTargets?:Point[]; consumed?:number; charges?:number; cleansed?:number; critical?:boolean; reducedMotion?:boolean; chainFrom?:string;
  } = $props();
  const age = $derived(timing ? timing.nowSec-(shape === 'whirlwind' ? timing.releasedAtSec : timing.impactAtSec) : providedAge);
  const charging = $derived(!!timing && timing.nowSec>=timing.startedAtSec && timing.nowSec<timing.releasedAtSec);
  const channelAge = $derived(timing ? timing.nowSec-timing.releasedAtSec : providedAge);
  const preImpact = $derived(!!timing && timing.nowSec>=timing.startedAtSec && timing.nowSec<timing.impactAtSec);
  const windup = $derived(timing ? Math.max(0,Math.min(1,(timing.nowSec-timing.startedAtSec)/Math.max(.001,timing.releasedAtSec-timing.startedAtSec))) : 0);
  const flightProgress = $derived(flightProgressOverride ?? (timing ? Math.max(0,Math.min(1,(timing.nowSec-timing.releasedAtSec)/Math.max(.001,timing.impactAtSec-timing.releasedAtSec))) : undefined));
  const mechanics = $derived(activeVfxMechanics(sm.byId[id]));
  const displayElement = $derived(activeVfxElement(id,element));
  const authored = $derived(shape === 'whirlwind' ? undefined : authoredVfxFor(id));
  const footprint = $derived(cast && !!sm.byId[id]?.targets?.includes('/') && !!targets?.length);
  const fields = $derived(!authored && cast && footprint && !['groundSlam','cleave','venomFan','whirlwind'].includes(shape));
  const centers = $derived(cast && id.startsWith('curse.') && targets?.length === 0 ? []
    : authored && cast ? [area?.center ?? ground]
    : fields ? targets ?? [ground] : [ground]);
  const repeats = $derived(activeVfxResolvedHits(sm.byId[id], cast));
  const strikeDuration = $derived(activeVfxPlaybackDuration(shape,sm.byId[id],id));
  const chargeCount = $derived(charges ?? sm.byId[id]?.effects?.find((effect:any) => ['dodge_charges','block_charges'].includes(effect.stat))?.value ?? 0);
  const visibleCast = $derived(!(cast && sm.byId[id]?.type === 'attack' && targets?.length === 0 && !area));
  const fieldScale = $derived(area && ['cleave','groundSlam'].includes(shape)
    ? area.diameter/(ACTIVE_VFX[shape].size*(shape==='groundSlam'?2.2:1)) : 1);
</script>

{#if visibleCast}
<g data-skill-target-count={centers.length} data-skill-hit-count={mechanics.hits}>
  {#if cast && layer==='ground' && area && shape !== 'whirlwind'}
    {#if area.shape === 'line'}
      <ArenaVfxShape {area} age={preImpact ? Math.max(0, windup*.25) : Math.max(0, age)} element={displayElement} {reducedMotion} />
    {:else if !authored && area.shape === 'cone'}
      <ArenaVfxShape {area} age={preImpact ? windup*.25 : age} element={displayElement} {reducedMotion} />
    {:else if !authored}
      <ArenaVfxField {area} age={preImpact ? windup*.25 : age} element={displayElement} art={ACTIVE_VFX[shape].ground}
        sustained={['storm','ward'].includes(ACTIVE_VFX[shape].family)} charging={preImpact} {reducedMotion} />
    {/if}
  {/if}
  {#if !authored && cast && layer==='front' && charging}
    <ArenaFxSprite art="spiral-1572" age={windup*.32} x={source.x} y={source.y} width={38+windup*36} element={displayElement} opacity={.25+windup*.55} {reducedMotion} />
  {/if}
  {#each centers as target, index}
    {#if !(cast && layer==='ground' && area) || authored?.spatial?.layer === 'ground' || shape === 'whirlwind'}
      {#each Array.from({length:repeats},(_,i)=>i) as hit}
        <ArenaSkillVfxBody {id} {shape} {visualSeed} {allowComponents} age={age-hit*.14-(fields ? index*.055 : 0)-(!authored && cast && consumed>0 ? .18 : 0)} {source}
          point={fields ? {x:target.x,y:target.y-48} : point} ground={target} casterGround={sourceGround} {cast} element={displayElement} {layer}
          durationOverride={strikeDuration} authoredAreaDiameter={area?.diameter} {critical} {flightProgress}
          windupProgress={timing ? windup : undefined} {preImpact} {charging} {channelAge}
          strikeCount={mechanics.hits} sizeScale={fieldScale*((fields && centers.length>1 ? .72 : 1)+Math.min(.3,consumed*.03))}
          {area} {reducedMotion} {chainFrom} />
      {/each}
    {/if}
    {#if !authored && cast && index===0 && shape === 'aftershock' && age < activeVfxDuration(shape,sm.byId[id])}
      <ArenaFxSprite art="stack-214" age={age} x={source.x} y={source.y+12} width={82} height={112} element="earth" loop={true} {reducedMotion} />
    {/if}
  {/each}
  {#if !authored && layer === 'front' && cast && age >= 0}
    {#if age < 1.1}
      {#each Array.from({length:chargeCount},(_,i)=>i) as charge}
        {@const phase = charge/chargeCount*Math.PI*2+(reducedMotion?0:age*1.8)}
        <ArenaFxSprite art={shape==='earthWall'?'shard-1472':'orb/3c'} {age}
          x={source.x+Math.cos(phase)*60} y={source.y+Math.sin(phase)*32}
          width={shape==='earthWall'?34:25} element={shape==='earthWall'?'earth':'cold'} loop={true} {reducedMotion} />
      {/each}
    {/if}
    {#if !authored && ['carnage','reap'].includes(shape) && (targets === undefined || targets.length > 0) && age > .18 && age < .65}
      {#each [0,1,2] as strand}
        {@const returnTime = Math.max(0,Math.min(1,(age-.18-strand*.04)/.32))}
        <ArenaFxSprite art="spark-1066" {age} x={point.x+(source.x-point.x)*returnTime}
          y={point.y+(source.y-point.y)*returnTime-Math.sin(returnTime*Math.PI)*(15+strand*8)}
          width={24} element="fire" loop={true} {reducedMotion} />
      {/each}
    {/if}
    {#each spreadTargets as target, index}
      {@const travel = Math.max(0,Math.min(1,(age-.12-index*.07)/.26))}
      {#if age >= .12+index*.07 && travel < 1}
        <ArenaFxSprite art="orb/3b" age={age} x={point.x+(target.x-point.x)*travel}
          y={point.y+(target.y-48-point.y)*travel-Math.sin(travel*Math.PI)*24}
          width={38} element="poison" loop={true} {reducedMotion} />
      {:else if travel === 1}
        <ArenaFxSprite art="smoke-1075" age={age-.38-index*.07} x={target.x} y={target.y-48}
          width={70} element="poison" {reducedMotion} />
      {/if}
    {/each}
    {#each Array.from({length:cleansed},(_,i)=>i) as cleared}
      {@const a=cleared*2.4}
      <ArenaFxSprite art="shard-1472" age={Math.max(0,age-.03)} x={source.x+Math.cos(a)*age*90}
        y={source.y+Math.sin(a)*age*42} width={22} element="cold" {reducedMotion} />
    {/each}
    {#each Array.from({length:consumed},(_,i)=>i) as stack}
      {@const phase = stack*2.4}
      {@const radius = reducedMotion ? 18 : Math.max(0,1-age/.25)*75}
      {#if age < .3}
        <ArenaFxSprite art="spark-1066" age={age} x={point.x+Math.cos(phase)*radius}
          y={point.y+Math.sin(phase)*radius*.6} width={25} {element} loop={true} {reducedMotion} />
      {/if}
    {/each}
  {/if}
</g>
{/if}
