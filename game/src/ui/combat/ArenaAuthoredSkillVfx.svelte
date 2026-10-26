<script lang="ts">
  import { authoredVfxCell, authoredVfxFor, authoredVfxFrame, authoredVfxSize, spatialVfxMatrix, spatialProjectileWidth, spatialVfxClipPath } from './arena-authored-vfx';
  import type { VfxFootprint } from './arena-vfx-space';
  type Point = {x:number;y:number};
  let { id, age, duration, ground, source, point, flightProgress, windupProgress, preImpact = false, strikeCount = 1, baseSize, areaDiameter, area, reducedMotion = false, looping = false }: {
    id: string; age: number; duration: number; ground: Point;
    baseSize: number; areaDiameter?: number; area?: VfxFootprint; reducedMotion?: boolean;
    source?: Point; point?: Point; flightProgress?: number; windupProgress?:number; preImpact?:boolean; strikeCount?:number; looping?:boolean;
  } = $props();
  const preset = $derived(authoredVfxFor(id));
  const field = $derived(!!preset?.spatial && preset.spatial.composition !== 'projectile-component');
  const alphaFilterId = $props.id();
  const alphaTable = $derived(Array.from({length:256},(_,i) => i <= (preset?.alphaDiscard ?? 8) ? 0 : i/255).join(' '));
  const projectile = $derived(preset?.delivery === 'projectile' && !!source && !!point);
  const progress = $derived(Math.max(0, Math.min(1, flightProgress ?? (age + .26) / .26)));
  const flying = $derived(projectile && age < 0);
  const anticipating = $derived(!!preset?.delivery && !projectile && preImpact && age < 0);
  const position = $derived.by(() => {
    if (flying && source && point) return {x:source.x+(point.x-source.x)*progress,y:source.y+(point.y-source.y)*progress};
    if (preset?.origin === 'caster' && source) return preset.delivery === 'ground' || preset.groundOrigin ? {x:source.x,y:source.y+58} : source;
    if (preset?.delivery === 'ground' || !preset?.delivery) return ground;
    return point ?? ground;
  });
  const rotation = $derived(preset?.orient && source && point && (flying || preset.delivery === 'melee')
    ? Math.atan2(point.y-source.y,point.x-source.x)*180/Math.PI : 0);
  const frame = $derived.by(() => {
    if (!preset) return 0;
    if (looping) return reducedMotion ? preset.loop[0] : preset.loop[0] + Math.floor(Math.max(0, age) * 1000 / preset.frameMs) % (preset.loop[1] - preset.loop[0] + 1);
    if (anticipating) return preset.opening[0] + Math.min(preset.opening[1]-preset.opening[0], Math.floor(Math.max(0, Math.min(1, windupProgress ?? 1)) * (preset.opening[1]-preset.opening[0]+1)));
    if (!projectile) return authoredVfxFrame(preset, age, duration, reducedMotion, strikeCount);
    if (reducedMotion) return flying ? preset.loop[0] + Math.floor((preset.loop[1]-preset.loop[0])/2) : preset.exit[0];
    if (flying) {
      const range = progress < .18 ? preset.opening : preset.loop;
      const phase = progress < .18 ? progress/.18 : (progress-.18)/.82;
      return range[0]+Math.min(range[1]-range[0],Math.floor(phase*(range[1]-range[0]+1)));
    }
    const phase = Math.min(.999999, Math.max(0, age)/Math.max(.001,duration));
    return preset.exit[0]+Math.floor((phase*Math.max(1,strikeCount)%1)*(preset.exit[1]-preset.exit[0]+1));
  });
  const cell = $derived(preset ? authoredVfxCell(preset, frame) : undefined);
  const size = $derived(preset ? (preset.spatial?.composition === 'projectile-component' ? spatialProjectileWidth(preset) : authoredVfxSize(baseSize, preset.delivery === 'ground' || preset.groundOrigin || !preset.delivery ? areaDiameter : undefined)) / (preset.contentWidthRatio ?? 1) : 0);
  const matrix = $derived(preset && field && area ? spatialVfxMatrix(preset,frame,area) : undefined);
  const clip = $derived(field && area ? spatialVfxClipPath(area) : undefined);
  const height = $derived(preset?.virtualWidth && preset.virtualHeight ? size * preset.virtualHeight / preset.virtualWidth : size);
  const anchorX = $derived(preset ? projectile && !flying ? preset.impactAnchorX ?? preset.anchorX ?? .5 : preset.anchorX ?? .5 : .5);
  const anchorY = $derived(preset ? projectile && !flying ? preset.impactAnchorY ?? preset.anchorY : preset.anchorY : .5);
  const visibleFlight = $derived(projectile && (flightProgress !== undefined ? flightProgress > 0 : age >= -.26));
  const opacity = $derived(looping || flying || anticipating ? 1 : Math.max(0, Math.min(1, (age+.025) / .025, (duration - age) / .08)));
  const returnProgress = $derived(Math.max(0, Math.min(1, (age / Math.max(.001, duration) - 2/3) * 3)));
  const flightCopies = $derived(id === 'attack.ice_lance' && flying && !reducedMotion ? Math.max(1, Math.floor(strikeCount)) : 1);
</script>

{#snippet atlasImage()}
  {#if preset && cell}
    {#if preset.virtualWidth && preset.virtualHeight}
      <svg x={cell.offsetX} y={cell.offsetY} width={cell.width} height={cell.height} viewBox={cell.viewBox} overflow="hidden">
        <image href={preset.src} width={cell.imageWidth} height={cell.imageHeight} filter={`url(#${alphaFilterId})`} />
      </svg>
    {:else}
      <image href={preset.src} width={cell.imageWidth} height={cell.imageHeight} />
    {/if}
  {/if}
{/snippet}

{#if preset && cell && (looping || (age >= 0 || visibleFlight || anticipating) && age <= duration) && opacity > 0}
  <defs>
    <filter id={alphaFilterId} filterUnits="userSpaceOnUse" x={cell.sourceX} y={cell.sourceY} width={cell.width} height={cell.height} color-interpolation-filters="sRGB">
      <feComponentTransfer><feFuncA type="discrete" tableValues={alphaTable} /></feComponentTransfer>
    </filter>
  </defs>
  {#if clip}<defs><clipPath id={`${alphaFilterId}-area`}><path d={clip} /></clipPath></defs>{/if}
  {#if matrix && preset.virtualWidth && preset.virtualHeight}
    <g clip-path={clip ? `url(#${alphaFilterId}-area)` : undefined}>
    <g transform={`matrix(${matrix.join(' ')})`} opacity={opacity} data-authored-vfx={id} data-authored-frame={frame} data-vfx-version="spatial-v2">
      <svg width={preset.virtualWidth} height={preset.virtualHeight} viewBox={`0 0 ${preset.virtualWidth} ${preset.virtualHeight}`} overflow="hidden" aria-hidden="true">
        {@render atlasImage()}
      </svg>
    </g>
    </g>
  {:else}
  {#each Array.from({length:flightCopies},(_,i)=>i) as copy}
  {@const lateral = (copy-(flightCopies-1)/2)*14}
  <g transform={`translate(${position.x-Math.sin(rotation*Math.PI/180)*lateral} ${position.y+Math.cos(rotation*Math.PI/180)*lateral}) rotate(${rotation})`} opacity={looping ? 1 : reducedMotion ? Math.max(0, Math.min(1, (duration - age) / .12)) : opacity}
    data-authored-vfx={id} data-authored-frame={frame}>
    <svg x={-size * anchorX} y={-height * anchorY} width={size} {height} viewBox={preset.virtualWidth && preset.virtualHeight ? `0 0 ${preset.virtualWidth} ${preset.virtualHeight}` : cell.viewBox}
      preserveAspectRatio="xMidYMid meet" overflow="hidden" aria-hidden="true">
      {@render atlasImage()}
    </svg>
  </g>
  {/each}
  {/if}
  {#if id === 'attack.reap' && source && point && !reducedMotion && returnProgress > 0 && returnProgress < 1}
    <g transform={`translate(${point.x+(source.x-point.x)*returnProgress} ${point.y+(source.y-point.y)*returnProgress-Math.sin(returnProgress*Math.PI)*28})`} opacity={(1-returnProgress)*.75} data-authored-return="reap">
      <svg x={-size*.32*anchorX} y={-height*.32*anchorY} width={size*.32} height={height*.32}
        viewBox={preset.virtualWidth && preset.virtualHeight ? `0 0 ${preset.virtualWidth} ${preset.virtualHeight}` : cell.viewBox} overflow="hidden" aria-hidden="true">
        {@render atlasImage()}
      </svg>
    </g>
  {/if}
{/if}
