<script lang="ts">
  import ArenaFxSprite from './ArenaFxSprite.svelte';
  import ArenaVfxAtmosphere from './ArenaVfxAtmosphere.svelte';
  import ArenaAuthoredSkillVfx from './ArenaAuthoredSkillVfx.svelte';
  import ArenaWhirlwindVfx from './ArenaWhirlwindVfx.svelte';
  import { ACTIVE_VFX } from './arena-active-vfx';
  import { authoredVfxFor } from './arena-authored-vfx';
  import type { VfxFootprint } from './arena-vfx-space';
  let { id, shape, age, visualSeed = 0, allowComponents = true, source, point, ground, cast, element = 'physical', layer = 'front', strikeCount = 1, sizeScale = 1, durationOverride, authoredAreaDiameter, critical = false, flightProgress, windupProgress, preImpact = false, charging = false, channelAge = age, area, reducedMotion = false, chainFrom }: {
    allowComponents?:boolean; visualSeed?:number; id: string; shape: string; age: number; source: {x:number;y:number}; point: {x:number;y:number};
    ground: {x:number;y:number}; cast: boolean; element?: string; layer?: 'ground' | 'front'; strikeCount?:number; sizeScale?:number; durationOverride?:number; authoredAreaDiameter?:number; critical?:boolean; flightProgress?:number; windupProgress?:number; preImpact?:boolean; charging?:boolean; channelAge?:number; area?:VfxFootprint; reducedMotion?: boolean; chainFrom?: string;
  } = $props();
  const recipe = $derived(ACTIVE_VFX[shape] ? {...ACTIVE_VFX[shape],size:ACTIVE_VFX[shape].size*sizeScale,duration:durationOverride ?? ACTIVE_VFX[shape].duration} : undefined);
  const authored = $derived(authoredVfxFor(id));
  const inWindow = $derived((age >= -.26 || (cast && preImpact && (authored || shape === 'whirlwind')) || (authored?.delivery === 'projectile' && age < 0 && flightProgress !== undefined && flightProgress > 0)) && age <= (recipe?.duration ?? 0));
  const self = $derived(id.startsWith('buff.') || id.startsWith('heal.') || shape === 'whirlwind' || shape === 'cleave' || shape === 'groundSlam');
  const center = $derived(self ? source : point);
  const floor = $derived(self ? {x:source.x, y:source.y + 58} : ground);
  const angle = $derived(Math.atan2(point.y - source.y, point.x - source.x) * 180 / Math.PI);
  const progress = $derived(flightProgress ?? Math.max(0, Math.min(1, (age + .26) / .26)));
  const envelope = $derived(authored && cast ? 1 : recipe ? Math.max(0, Math.min(1, (age + .04) * 16, (recipe.duration - age) * 5)) : 0);
  const lightId = $props.id();
  const opening = $derived(reducedMotion ? .25 : Math.max(0, 1 - Math.max(0, age) / .22));
  const sustain = $derived(recipe && ['storm', 'ward', 'heal'].includes(recipe.family));
  type Piece = { art: string; age: number; x: number; y: number; width: number; height?: number; rotation?: number; opacity?: number; loop?: boolean; element?: string };
  const pieces = $derived.by(() => {
    if (!recipe) return [];
    const result: Piece[] = [];
    if (authored && cast) return result;
    const add = (art: string, time: number, x: number, y: number, width: number, extra: Partial<Piece> = {}) => {
      if (time >= 0) result.push({art, age:time, x,y,width, ...extra});
    };
    const family = recipe.family;
    const area = ['storm','rain','quake','nova'].includes(family);
    if (layer === 'ground') {
      if (recipe.ground && age >= 0 && cast && (area || self)) {
        const expand = reducedMotion ? 1 : .5 + Math.min(1, age * 5) * .5;
        add(recipe.ground, age, floor.x, floor.y, recipe.size * expand, {height:recipe.size * .36 * expand, opacity:.5, loop:family === 'storm' || family === 'ward'});
      }
      if (cast && area && age >= 0 && age < .55) {
        const spread = reducedMotion ? 1 : .35 + age * 2.5;
        add('ring-1338', age * 1.4, floor.x, floor.y, recipe.size * spread, {height:recipe.size * spread * .32, opacity:.65 * (1-age/.55)});
      }
      if (cast && (family === 'storm' || family === 'ward')) {
        add('ring-320', age, floor.x, floor.y, recipe.size * .85, {height:recipe.size * .27, loop:true,opacity:.55});
      }
      return result;
    }
    if (age < 0) {
      if (!cast && family === 'projectile' && !reducedMotion) {
        const x = source.x + (point.x-source.x)*progress;
        const y = source.y + (point.y-source.y)*progress;
        for (let i=5;i>=1;i--) add(recipe.art, .08, x-Math.cos(angle*Math.PI/180)*i*14, y-Math.sin(angle*Math.PI/180)*i*14, recipe.size*(1-i*.13), {rotation:angle,opacity:.21-i*.025,loop:true});
        add(recipe.art, age+.26, x,y,recipe.size,{rotation:angle,loop:true});
        add('spark-1066', age+.26, x,y,recipe.size*.65,{element:'physical',loop:true,opacity:.65});
      }
      return result;
    }
    // Cast markers own fields and self effects; hit markers own contact and projectiles.
    if (cast && !area && !self && family !== 'curse' && family !== 'fan' && family !== 'impact') {
      add('spiral-1572', age*1.6, source.x, source.y, 64, {opacity:.55});
      add('spark-1066', age*1.5, source.x, source.y, 32, {element:'physical',opacity:.8});
      return result;
    }
    if(cast && family==='impact') {
      add('spiral-1572',age*1.4,source.x,source.y,58,{opacity:.4});
      return result;
    }
    if (!cast && (area || self || family === 'curse')) {
      if (!self || id.startsWith('attack.')) add(recipe.impact, age, point.x,point.y,46,{opacity:.75});
      return result;
    }
    if (family === 'storm') {
      const build = reducedMotion ? 1 : .72 + Math.min(1,age/.18)*.28;
      const height = recipe.size * 1.16 * build;
      // A bright interior, a readable outer funnel and low wind share one grounded foot.
      add(recipe.art,age,floor.x,floor.y-height*.48,recipe.size*.94*build,{height,loop:true,opacity:.88});
      if(shape==='firestorm') {
        add('column-78',age+.12,floor.x,floor.y-height*.29,recipe.size*.34,{height:height*.6,loop:true,opacity:.62});
        add('flame-114',age+.12,floor.x,floor.y-height*.34,recipe.size*.28,{height:height*.55,loop:true,opacity:.62});
        add('wave-1251',age,floor.x,floor.y-14,recipe.size*1.13,{height:recipe.size*.36,loop:true,opacity:.8});
      }
      add('smoke-1428',Math.max(0,age-.12)*.7,floor.x,floor.y-height*.7,recipe.size*.9,{opacity:.16});
    } else if (family === 'rain') {
      const arrows = shape === 'arrowShower';
      for(let i=0;i<(arrows ? strikeCount : 18);i++) {
        const elapsed=age-i*(arrows ? .15 : .045), phase=i*2.4;
        const x=arrows ? floor.x+(i-(strikeCount-1)/2)*7 : floor.x+Math.cos(phase)*recipe.size*.54;
        const y=arrows ? floor.y : floor.y+Math.sin(phase)*recipe.size*.23;
        if(!arrows && elapsed>=0 && elapsed<.32) add(recipe.art,elapsed,x+(reducedMotion?0:30*(1-elapsed/.32)),y-(reducedMotion?40:155*(1-elapsed/.32))-18,43,{rotation:25,opacity:.9});
        if(elapsed>=.28 && elapsed<.7) add(recipe.impact,(elapsed-.28)*1.5,x,y-8,48,{opacity:.85});
      }
      if(shape==='blizzard') add('wave-1251',age,floor.x,floor.y-18,recipe.size*1.3,{height:recipe.size*.38,loop:true,opacity:.3});
    } else if(family === 'projectile') {
      add(recipe.impact,age*1.2,point.x,point.y,shape==='fireball'?108:shape==='headshot'?recipe.size:recipe.size*.75);
      add('spark-1066',age*1.8,point.x,point.y,74,{element:'physical',opacity:.85});
      if(shape==='fireball') add('smoke-1428',age-.13,point.x,point.y-18,105,{opacity:.27});
      if(critical) add('burst-862',age*.85,point.x,point.y,recipe.size*1.18,{opacity:.85});
    } else if(family === 'slash' || family === 'thrust') {
      const contact = shape==='cleave' ? source : point;
      const sweep=reducedMotion?0:Math.max(0,1-age/.24);
      add(recipe.art,age,contact.x-Math.cos(angle*Math.PI/180)*18,contact.y,recipe.size,{height:family==='thrust'?recipe.size*.45:recipe.size,rotation:angle+(recipe.turn??0)-sweep*(family==='slash'?28:0)});
      add(recipe.art,age+.07,contact.x-Math.cos(angle*Math.PI/180)*12,contact.y,recipe.size*.8,{height:recipe.size*(family==='thrust' ? .22 : .7),rotation:angle+(recipe.turn??0),element:'physical',opacity:.5});
      add(recipe.impact,age*1.5,contact.x,contact.y,65,{opacity:.9});
    } else if(family === 'quake') {
      if(shape==='groundSlam') {
        const pulse=reducedMotion?1:.5+Math.min(1,age*.9);
        add(recipe.ground ?? 'ring-1712',age,floor.x,floor.y,recipe.size*2.2*pulse,{height:recipe.size*.62*pulse,opacity:.85});
        for(let i=0;i<7;i++) {
          const a=i*Math.PI/3.5,r=reducedMotion?recipe.size*.45:age*175;
          add(recipe.impact,age-i*.025,floor.x+Math.cos(a)*r,floor.y+Math.sin(a)*r*.45,42,{opacity:.8});
        }
      } else if(shape==='earthSplitter') {
        add('wave-1617',age*1.4,point.x,point.y-8,recipe.size*1.6,{height:recipe.size*.7,rotation:80});
        add('burst-926',age,point.x,point.y,recipe.size*1.25,{opacity:.9});
        for(let i=0;i<8;i++) {
          const a=i*Math.PI/4,r=reducedMotion?recipe.size*.4:age*110;
          add('shard-1472',age-i*.025,point.x+Math.cos(a)*r,point.y+Math.sin(a)*r*.4,28,{rotation:i*45,opacity:.75});
        }
      } else if(shape==='earthShock') {
        const expand=reducedMotion?1:.35+Math.min(1,age/.28)*.65;
        add('ring-1712',age*1.25,point.x,floor.y,recipe.size*1.75*expand,{height:recipe.size*.48*expand,opacity:.9});
        add(recipe.art,age,point.x,floor.y-12,recipe.size*.8,{height:recipe.size*.55});
      } else if(shape==='aftershock') {
        add(recipe.art,age,point.x,floor.y-10,recipe.size,{height:recipe.size*.65});
        add('ring-1338',age,point.x,floor.y,recipe.size*1.35,{height:recipe.size*.38,opacity:.65});
      } else {
      for(let i=0;i<5;i++) {
        const t=i/4, time=age-i*.07;
        add(recipe.art,time,source.x+(floor.x-source.x)*t,source.y+58+(floor.y-source.y-58)*t-10,recipe.size*(.45+t*.4),{height:recipe.size*.65});
        add('smoke-1428',time-.06,source.x+(floor.x-source.x)*t,source.y+58+(floor.y-source.y-58)*t-18,recipe.size*.6,{opacity:.3});
        if(shape==='aftershock') add(recipe.impact,time-.3,source.x+(floor.x-source.x)*t,floor.y-12,60);
      }
      }
    } else if(family === 'nova') {
      const expand=reducedMotion?1:.45+Math.min(1,age*5)*.75;
      add(recipe.art,age*1.15,center.x,center.y,recipe.size*expand);
      add('spark-1066',age*1.8,center.x,center.y,recipe.size*.7,{element:'physical',opacity:.85});
      add('ring-1338',age*1.2,center.x,center.y,recipe.size*expand*1.25,{opacity:.65});
    } else if(family === 'ward') {
      add(recipe.art,age,source.x,floor.y-recipe.size*.44,recipe.size,{height:recipe.size*1.1,loop:true,opacity:.48+opening*.32});
      if(age<.7) add('ring-1338',age*1.2,source.x,source.y,recipe.size*.8,{opacity:Math.max(0,1-age/.7)*.5,element:'physical'});
      if(shape==='absorb') for(let i=0;i<6;i++) {
        const a=i*Math.PI/3,r=reducedMotion?25:Math.max(0,1-age/.65)*90;
        add(recipe.impact,age,source.x+Math.cos(a)*r,source.y+Math.sin(a)*r*.6,24,{loop:true});
      }
    } else if(family === 'heal') {
      const pulse = shape==='heal' ? age%1 : age;
      add(recipe.art,pulse,source.x,source.y-(reducedMotion?0:Math.min(pulse,.6)*25),recipe.size,{height:shape==='greaterHeal'?recipe.size*1.3:recipe.size});
      add('column-104',pulse,source.x,floor.y-65,recipe.size*.42,{height:155,opacity:shape==='heal' ? .14 : .27,element:'physical'});
      for(let i=0;i<9;i++) add(recipe.impact,pulse-i*.055,source.x+Math.sin(i*2.4)*recipe.size*.38,source.y+40-(reducedMotion?0:pulse*(55+i*8)),18+i%3*6,{opacity:.8,element:i%3===0?'physical':'poison'});
    } else if(family === 'curse') {
      add(recipe.art,age,point.x,shape==='cripple'?floor.y-12:point.y-28,recipe.size,{height:shape==='venomBind'?recipe.size*1.2:recipe.size,rotation:shape==='expose'?(reducedMotion?0:age*70):0});
      add(recipe.impact,age+.1,point.x,point.y,65,{opacity:.4});
      for(let i=0;i<5;i++) {
        const a=i*Math.PI*.4,r=reducedMotion?35:Math.max(12,1-age/.5)*recipe.size*.6;
        add('spark-1054',age+i*.08,point.x+Math.cos(a)*r,point.y+Math.sin(a)*r*.65,25,{loop:true,opacity:.65});
      }
    } else if(family === 'fan') {
      if(cast) {
        for(let i=-3;i<=3;i++) {
          const a=(angle+i*16)*Math.PI/180,reach=reducedMotion?75:Math.min(1,age/.28)*recipe.size;
          add('orb/3b',age-i*.025,source.x+Math.cos(a)*reach,source.y+Math.sin(a)*reach,26,{loop:true,element:'poison',opacity:.8});
        }
      } else {
        add(recipe.impact,age,point.x,point.y,62,{opacity:.8});
      }
    } else if(family !== 'lightning') {
      if(family === 'impact') {
        const impactY=point.y-(shape==='skullCrack'?34:8);
        add(recipe.art,age*1.2,point.x,impactY,shape==='frostbite'?recipe.size*.82:recipe.size);
        add(recipe.impact,age*.85,point.x,impactY,shape==='frostbite'?60:recipe.size*.65,{opacity:.85});
        if(critical) add('burst-862',age*.8,point.x,impactY,recipe.size*1.18,{opacity:.8});
        if(shape==='boneBreaker') for(let i=0;i<7;i++) {
          const a=i*Math.PI/3.5,r=reducedMotion?30:age*140;
          add('shard-1350',age-i*.02,point.x+Math.cos(a)*r,impactY+Math.sin(a)*r*.65,30,{rotation:i*51,opacity:.8});
        }
      } else {
      add(recipe.art,age*1.3,point.x,point.y-(shape==='skullCrack'?34:0),recipe.size,{rotation:angle+(recipe.turn??0)});
      add('spark-1066',age*2,point.x,point.y,recipe.size*.65,{element:'physical',opacity:.9});
      }
    }
    return result;
  });
  const boltPath = $derived.by(() => {
    const start = shape === 'thunder' ? {x:point.x-18,y:point.y-230} : source;
    return Array.from({length:9},(_,i)=>{
      const t=i/8, jitter=i===0||i===8?0:Math.sin(i*11+(reducedMotion?0:Math.floor(age*24)))*13;
      return `${i?'L':'M'}${start.x+(point.x-start.x)*t+jitter} ${start.y+(point.y-start.y)*t-jitter*.4}`;
    }).join(' ');
  });
</script>

{#if recipe && inWindow && (!authored || cast || shape === 'chainLightning')}
  <g data-active-skill-vfx={id} data-vfx-family={recipe.family} data-chain-from={chainFrom ?? undefined} opacity={age < 0 ? 1 : envelope}>
    {#if layer === 'ground' && cast && age >= 0 && !authored && shape !== 'whirlwind'}
      <defs>
        <radialGradient id={lightId}>
          <stop offset="0" stop-color="currentColor" stop-opacity=".8" />
          <stop offset=".45" stop-color="currentColor" stop-opacity=".3" />
          <stop offset="1" stop-color="currentColor" stop-opacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={floor.x} cy={floor.y} rx={recipe.size*(sustain ? .72 : .55)} ry={recipe.size*.24}
        fill={`url(#${lightId})`} opacity={sustain ? .45 : .45*opening} />
    {/if}
    {#if shape === 'whirlwind'}
      <ArenaWhirlwindVfx age={channelAge} {source} {point} {ground} {cast} {area} duration={recipe.duration} strikes={strikeCount}
        {charging} windup={windupProgress ?? 0} {critical} {layer} showCasterVortex={false} {reducedMotion} />
    {/if}
    {#if layer === 'front' && recipe.family === 'projectile' && !cast && age < 0 && ['piercingShot','headshot','pierceVeil','acidArrow'].includes(shape) && !reducedMotion}
      {@const flight=progress}
      {@const px=source.x+(point.x-source.x)*flight}
      {@const py=source.y+(point.y-source.y)*flight}
      <g transform={`translate(${px} ${py}) rotate(${angle})`} class="arrow-flight">
        <path d="M-52 0H18M6-9 20 0 6 9M-45-5-38 0-45 5" class="arrow-edge" />
        <path d="M-52 0H18M6-9 20 0 6 9M-45-5-38 0-45 5" class="arrow-shaft" />
        <ArenaFxSprite art={recipe.art} age={Math.max(0,age+.24)} x={8} y={0} width={38} {element} loop={true} {reducedMotion} />
      </g>
    {/if}
    {#if !authored && layer === 'front' && shape === 'arrowShower' && cast && age >= 0 && age < 1.05}
      {#each Array.from({length:strikeCount},(_,i)=>i) as arrow}
        {@const t=Math.max(0,Math.min(1,(age-arrow*.15)/.34))}
        {@const x=point.x+(arrow-(strikeCount-1)/2)*24}
        {@const y=point.y-48-178*(1-t)}
        {#if age>=arrow*.15}
          <g transform={`translate(${x} ${y}) rotate(78)`} class="arrow-flight">
            <path d="M-36 0H17M5-8 19 0 5 8M-31-5-24 0-31 5" class="arrow-edge" />
            <path d="M-36 0H17M5-8 19 0 5 8M-31-5-24 0-31 5" class="arrow-shaft" />
          </g>
        {/if}
      {/each}
    {/if}
    {#if layer === 'front' && recipe.family === 'lightning' && !cast && age >= 0 && age < (shape==='overload' ? .11 : .24)}
      <path d={boltPath} class="bolt-aura" />
      <path d={boltPath} class="bolt-edge" /><path d={boltPath} class="bolt-core" />
      {#each [-1, 1] as branch}
        <path d={`M${point.x} ${point.y} l${branch*35} -32 ${branch*-15} -10 ${branch*34} -28`} class="bolt-branch" />
      {/each}
      <ArenaFxSprite art={recipe.impact} {age} x={point.x} y={point.y} width={recipe.size*.7} {element} {reducedMotion} />
      <ArenaFxSprite art="spark-1066" age={age*1.5} x={point.x} y={point.y} width={recipe.size} element="physical" {reducedMotion} />
    {/if}
    {#if layer==='front' && !authored && shape !== 'whirlwind'}
      <ArenaVfxAtmosphere {age} family={recipe.family} {element} {source} {point} ground={floor} size={recipe.size}
        {cast} {self} {critical} {reducedMotion} />
    {/if}
    {#if authored && cast}
      {#if layer === (authored.spatial?.layer ?? 'front')}
        <ArenaAuthoredSkillVfx {id} {age} {visualSeed} {allowComponents} {source} {point} {flightProgress} {windupProgress} {preImpact} {strikeCount} duration={recipe.duration} ground={floor} baseSize={recipe.size} areaDiameter={authoredAreaDiameter} {area} {reducedMotion} />
      {/if}
    {:else if shape !== 'whirlwind'}
      {#each pieces as piece}
        <ArenaFxSprite {...piece} element={piece.element ?? (self && id.startsWith('heal.') ? 'poison' : element)} {reducedMotion} />
      {/each}
    {/if}
  </g>
{/if}

<style>
  .arrow-edge { fill:none; stroke:#715832; stroke-width:5; stroke-linecap:round; stroke-linejoin:round; opacity:.8; }
  .arrow-shaft { fill:none; stroke:#fff4dc; stroke-width:2.1; stroke-linecap:round; }
  .bolt-aura { fill:none; stroke:currentColor; stroke-width:18; stroke-linejoin:bevel; opacity:.12; }
  .bolt-edge { fill:none; stroke:currentColor; stroke-width:7; stroke-linejoin:bevel; opacity:.55; }
  .bolt-core { fill:none; stroke:#f2fcff; stroke-width:2; stroke-linejoin:bevel; }
  .bolt-branch { fill:none; stroke:#d6f7ff; stroke-width:1.5; opacity:.8; }
</style>
