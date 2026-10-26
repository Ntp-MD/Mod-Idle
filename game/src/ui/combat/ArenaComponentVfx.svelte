<script lang="ts">
  import { authoredComponentSites, authoredComponentPose, authoredCompositionDuration, authoredVfxCell, type AuthoredComposition, type AuthoredComponent, type AuthoredComponentSite } from './arena-authored-vfx';
  import { projectArenaVector } from './combat-arena-view';
  import type { VfxFootprint } from './arena-vfx-space';
  let { composition, area, age, seed = 0, site, siteIndex = 0, showFootprint = true, reducedMotion = false, onAssetError }: {
    composition: AuthoredComposition; area: VfxFootprint; age: number; seed?: number;
    reducedMotion?: boolean; onAssetError: (component: AuthoredComponent) => void;
    site?: AuthoredComponentSite; siteIndex?: number; showFootprint?: boolean;
  } = $props();
  const prefix = $props.id();
  const sites = $derived(site ? [site] : authoredComponentSites(composition, area, seed).sort((a, b) => a.y - b.y));
  const duration = $derived(authoredCompositionDuration(composition));
  const meter = Math.hypot(...Object.values(projectArenaVector({ x: 1, y: 0 })));
  const alphaTable = Array.from({ length: 256 }, (_, i) => i <= 8 ? 0 : i / 255).join(' ');
  function frameOf(component: AuthoredComponent, phase: number) {
    const count = component.art.frames!.length;
    if (component.role === 'impact') return reducedMotion ? Math.floor(count * .6)
      : Math.min(count - 1, component.art.loop[0] + Math.floor(Math.max(0, age) * 1000 / component.art.frameMs));
    return reducedMotion ? Math.floor(count / 4) : (Math.floor(Math.max(0, age + 1) * 1000 / component.art.frameMs) + phase) % count;
  }
</script>

{#if age >= -.7 && age < duration}
  <g data-authored-composition={composition.version} data-authored-vfx={composition.skillId}>
    {#if showFootprint}
    <g transform={`matrix(${area.basisX.x} ${area.basisX.y} ${area.basisY.x} ${area.basisY.y} ${area.center.x} ${area.center.y})`}>
      <circle r="1" fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="1" vector-effect="non-scaling-stroke" />
    </g>
    {/if}
    <defs>
      <filter id={`${prefix}-alpha`} color-interpolation-filters="sRGB">
        <feComponentTransfer><feFuncA type="discrete" tableValues={alphaTable} /></feComponentTransfer>
      </filter>
    </defs>
    {#each sites as landing, index}
      {@const pose = authoredComponentPose(composition, landing, age, reducedMotion)}
      {#each composition.components as component}
        {#if (component.role === 'impact' && age >= 0) || (component.role !== 'impact' && pose.falling)}
          {@const art = component.art}
          {@const frame = frameOf(component, landing.phase)}
          {@const cell = authoredVfxCell(art, frame)}
          {@const scale = component.sizeM * meter / ((component.sizeAxis === 'height' ? art.contentHeightRatio! * art.virtualHeight! : art.contentWidthRatio! * art.virtualWidth!))}
          {@const opacity = component.role === 'impact' ? Math.min(1, Math.max(0, (duration - age) / .22)) * (reducedMotion ? .4 : .75) : 1}
          <g transform={`translate(${pose.position.x} ${pose.position.y}) rotate(${component.role === 'impact' ? 0 : pose.rotation}) scale(${scale}) translate(${-art.anchorX! * art.virtualWidth!} ${-art.anchorY * art.virtualHeight!})`}
            {opacity} data-vfx-component={component.key} data-vfx-site={site ? siteIndex : index} data-authored-frame={frame}>
            <svg x={cell.offsetX} y={cell.offsetY} width={cell.width} height={cell.height} viewBox={cell.viewBox} overflow="hidden" aria-hidden="true">
              <image href={art.src} width={cell.imageWidth} height={cell.imageHeight} filter={`url(#${prefix}-alpha)`} onerror={() => onAssetError(component)} />
            </svg>
          </g>
        {/if}
      {/each}
    {/each}
  </g>
{/if}
