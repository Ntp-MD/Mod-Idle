<script lang="ts">
  import type { CombatArena, CombatArenaFrame } from '@sim/combat/combat-arena';
  import { ARENA_VIEW } from './combat-arena-view';
  import { skillActionGeometry, skillAimGeometry, type SkillAimGeometry } from './skill-geometry';

  let { arena, frame, atUs, aim = null }: {
    arena: CombatArena; frame: CombatArenaFrame; atUs: number; aim?: SkillAimGeometry | null;
  } = $props();
  const marks = $derived([
    ...arena.actions.flatMap(action => {
      const mark = skillActionGeometry(action, frame, atUs, arena.unitsPerSec);
      return mark && (!aim || action.skillId !== aim.skillId || action.actorId !== 'player') ? [mark] : [];
    }),
    ...(aim ? [skillAimGeometry(aim)].filter(mark => mark != null) : []),
  ]);
  // This small extrusion is presentation depth only; gameplay footprints remain on the ground.
  const displayHeight = 12;
</script>

<svg class="skill-geometry-layer" viewBox={`0 0 ${ARENA_VIEW.width} ${ARENA_VIEW.height}`}
  preserveAspectRatio="none" aria-hidden="true" data-skill-geometry-layer>
  {#each marks as mark (mark.key)}
    <g class="skill-geometry" class:incoming={mark.incoming} class:invalid={!mark.valid}
      class:aim={mark.phase === 'Aim'} class:impact={mark.phase === 'Impact'}
      data-skill-id={mark.skillId} data-skill-phase={mark.phase.toLowerCase()} data-skill-shape={mark.area.shape ?? (mark.area.radiusM > 0 ? 'circle' : 'single')}>
      {#if mark.range}<path class="skill-range" d={mark.range} />{/if}
      <path class="skill-footprint" d={mark.footprint} />
      <g class="skill-height" transform={`translate(0 ${-displayHeight})`}><path d={mark.footprint} /></g>
      {#each mark.vertices.filter((_, index) => index % Math.max(1, Math.floor(mark.vertices.length / 4)) === 0).slice(0, 4) as point}
        <line class="skill-height" x1={point.x} y1={point.y} x2={point.x} y2={point.y - displayHeight} />
      {/each}
      <line class="skill-direction" x1={mark.direction.from.x} y1={mark.direction.from.y} x2={mark.direction.to.x} y2={mark.direction.to.y} />
      <path class="skill-direction-tip" d="M-8-5 0 0-8 5" transform={`translate(${mark.direction.to.x} ${mark.direction.to.y}) rotate(${Math.atan2(mark.direction.to.y-mark.direction.from.y, mark.direction.to.x-mark.direction.from.x)*180/Math.PI})`} />
      <path class="skill-target" d="M-6 0H6M0-6V6" transform={`translate(${mark.direction.to.x} ${mark.direction.to.y})`} />
      {#each mark.paths as path (path.index)}
        <line class="skill-payload" class:blocked={path.blocked} data-skill-payload={path.index}
          x1={path.from.x} y1={path.from.y} x2={path.to.x} y2={path.to.y} />
      {/each}
      <text class="skill-name" x={mark.label.x} y={mark.label.y}>{mark.name} · {mark.phase}</text>
      <text class="skill-dimensions" x={mark.label.x} y={mark.label.y + 16}>{mark.dimensions}</text>
    </g>
  {/each}
</svg>

<style>
  .skill-geometry-layer { position: absolute; inset: 0; z-index: 4; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .skill-geometry { color: var(--es-lit); fill: none; stroke-linejoin: round; }
  .skill-geometry.incoming { color: var(--alarm); }
  .skill-geometry.aim { color: var(--gold-lit); }
  .skill-geometry.invalid { color: var(--hp-lit); }
  .skill-range { stroke: currentColor; stroke-width: 1; stroke-dasharray: 7 6; opacity: .55; }
  .skill-footprint { stroke: currentColor; stroke-width: 2; fill: color-mix(in srgb, currentColor 9%, transparent); }
  .skill-height { stroke: currentColor; stroke-width: 1; opacity: .5; }
  .skill-height path { fill: none; }
  .skill-direction, .skill-payload { stroke: currentColor; stroke-width: 1.5; stroke-dasharray: 4 4; opacity: .75; }
  .skill-payload.blocked { stroke: var(--hp-lit); }
  .skill-target, .skill-direction-tip { stroke: currentColor; stroke-width: 2; }
  .skill-name, .skill-dimensions { text-anchor: middle; paint-order: stroke; stroke: var(--ground); stroke-width: 4; stroke-linejoin: round; font-family: var(--ui); }
  .skill-name { fill: var(--text); font-size: 15px; font-weight: 650; }
  .skill-dimensions { fill: currentColor; font-size: 12px; font-variant-numeric: tabular-nums; }
  .impact .skill-footprint { stroke-width: 3; }
</style>
