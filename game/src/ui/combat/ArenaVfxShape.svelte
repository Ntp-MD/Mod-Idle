<script lang="ts">
  import { projectArenaPoint } from './combat-arena-view';
  import type { VfxFootprint } from './arena-vfx-space';
  let { area, age, element = 'physical', reducedMotion = false }: {
    area: VfxFootprint; age: number; element?: string; reducedMotion?: boolean;
  } = $props();
  const point = (x: number, y: number) => projectArenaPoint({ x, y });
  const path = $derived.by(() => {
    const center = area.worldCenter ?? { x: 0, y: 0 };
    const direction = area.directionRad ?? 0;
    const reach = area.lengthM ?? 0;
    const dir = { x: Math.cos(direction), y: Math.sin(direction) };
    const perp = { x: -dir.y, y: dir.x };
    if (area.shape === 'line') {
      const half = (area.widthM ?? 0) / 2;
      const corners = [
        { x: center.x + perp.x * half, y: center.y + perp.y * half },
        { x: center.x + dir.x * reach + perp.x * half, y: center.y + dir.y * reach + perp.y * half },
        { x: center.x + dir.x * reach - perp.x * half, y: center.y + dir.y * reach - perp.y * half },
        { x: center.x - perp.x * half, y: center.y - perp.y * half },
      ].map((corner) => point(corner.x, corner.y));
      return corners.map((corner, index) => `${index === 0 ? 'M' : 'L'}${corner.x.toFixed(1)} ${corner.y.toFixed(1)}`).join(' ') + ' Z';
    }
    const halfAngle = Math.max(1, Math.min(180, area.angleDeg ?? 90)) * Math.PI / 360;
    const steps = reducedMotion ? 10 : 18;
    const arc: { x: number; y: number }[] = [];
    for (let step = 0; step <= steps; step++) {
      const angle = direction - halfAngle + (halfAngle * 2 * step) / steps;
      arc.push(point(center.x + Math.cos(angle) * reach, center.y + Math.sin(angle) * reach));
    }
    const hub = point(center.x, center.y);
    return `M${hub.x.toFixed(1)} ${hub.y.toFixed(1)} ` +
      arc.map((corner) => `L${corner.x.toFixed(1)} ${corner.y.toFixed(1)}`).join(' ') + ' Z';
  });
  const onset = $derived(Math.min(1, Math.max(0, age) * 10));
  const fade = $derived(Math.max(0, 1 - Math.max(0, age) / .8) * .55);
</script>

{#if age >= 0 && path}
  <g data-vfx-shape={area.shape} data-vfx-direction={area.directionRad} style:color={`var(--fx-${element},currentColor)`}>
    <path d={path} fill="currentColor" fill-opacity={fade * .28} stroke="currentColor"
      stroke-opacity={onset * fade} stroke-width="2" vector-effect="non-scaling-stroke" />
  </g>
{/if}
