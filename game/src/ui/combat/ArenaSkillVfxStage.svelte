<script lang="ts">
  import { projectArenaPoint } from '../../presentation/arena-camera';
  import { activeSkillVfx } from './arena-skill-vfx';
  import { sampleVfxOffset } from './arena-vfx-space';
  import type { SkillGeometry } from './skill-geometry';

  /**
   * Staged per-skill VFX for the live arena, drawn from the committed cast geometry.
   *
   * Every ground position is a world offset pushed through the arena projection, so shapes land
   * on the camera's skewed ground plane exactly like the footprint telegraph; upright particles
   * anchor at a projected ground point and rise along screen-vertical, which is the one direction
   * the oblique camera keeps vertical. Sizes come from the spec's metres; the only conversion is
   * `VFX_LIFT_PX_PER_M` for height, matching the body-lift convention (48 px at 0.52 m).
   */
  export const VFX_LIFT_PX_PER_M = 92;

  let { mark, reducedMotion = false }: { mark: SkillGeometry; reducedMotion?: boolean } = $props();

  const spec = $derived(activeSkillVfx(mark.skillId, mark.incoming));

  const seedOf = (key: string) => [...key].reduce((acc, ch) => Math.imul(acc, 31) + ch.charCodeAt(0) | 0, 7);
  const rngOf = (seed: number) => () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  type Piece = {
    index: number; x: number; y: number; size: number; delay: number;
    /** Outward ground drift in screen px, and the upright rise in px. */
    dx: number; dy: number; rise: number; spin: number;
  };

  const world = (offset: { x: number; y: number }) =>
    projectArenaPoint({ x: mark.area.center.x + offset.x, y: mark.area.center.y + offset.y });

  /** The body/ground point the VFX stage treats as the hit anchor. */
  const anchor = $derived(mark.vfxAim.bodyImpact ? mark.vfxAim.impact : mark.center);
  const bodyLift = $derived(mark.vfxAim.bodyImpact ? Math.max(0, mark.center.y - mark.vfxAim.impact.y) : 0);

  /** Footprint reach in world metres; single-target casts still get a body-sized plane. */
  const reachM = $derived(Math.max(mark.area.radiusM, mark.area.lengthM ?? 0, .55));

  /** Field motifs (meteor/snow/lightning/sand): seeded ambient bodies inside the committed footprint. */
  const fieldAmbient = $derived.by(() => {
    const s = spec;
    if (!s || s.form !== 'field' || (mark.phase !== 'Field' && mark.phase !== 'Impact')) return [] as { index: number; x: number; y: number; size: number; kind: string; delay: number }[];
    const count = s.fieldStyle === 'snow' ? 8 : s.fieldStyle === 'sand' ? 8 : 4;
    const rng = rngOf(seedOf(`${mark.key}-field`));
    const out: { index: number; x: number; y: number; size: number; kind: string; delay: number }[] = [];
    for (let index = 0; index < count; index++) {
      const point = world(sampleVfxOffset(mark.area, rng));
      const kind = s.fieldStyle ?? 'meteor';
      out.push({ index, x: point.x, y: point.y, size: kind === 'snow' ? 1.4 + rng() * 2 : kind === 'sand' ? 1.8 + rng() * 2.4 : 2.6 + rng() * 3.2, kind, delay: rng() * 900 });
    }
    return out;
  });

  /** Support cues: heal body pulse (--good-lit), buff ward pulse (--es-lit), curse body pulse (element/--curse). */
  const supportCue = $derived.by(() => {
    const s = spec;
    if (!s || (s.cue !== 'heal' && s.cue !== 'ward' && s.cue !== 'curse' && s.cue !== 'aura')) return null;
    const colour = s.cue === 'aura' ? null : (s.element && s.element !== 'physical' ? null : (s.cue === 'heal' ? 'var(--good-lit)' : s.cue === 'ward' ? 'var(--es-lit)' : 'var(--curse)'));
    return { cue: s.cue, colour };
  });

  /** Projectile silhouettes keep the travel angle readable instead of drawing a round blob. */
  const projectileShape = (family: string) => {
    switch (family) {
      case 'fire': return 'M-9 0C-5-5 3-5 10 0C3 5-5 5-9 0Z';
      case 'cold': return 'M-9 0L-2-4L10 0L-2 4Z';
      case 'lightning': return 'M-9 0L-2-3L-3 1L8 0L-2 3L-1-1Z';
      case 'earth': return 'M-8-2L-2-4L9-1L5 3L-4 3Z';
      case 'poison': return 'M-8 0C-4-4 3-4 8 0C3 4-4 4-8 0Z';
      case 'chaos': return 'M-9 0L0-5L9 0L0 5Z';
      default: return 'M-9 0L5-3L10 0L5 3Z';
    }
  };

  const ground = $derived.by(() => {
    const specV = spec;
    if (!specV) return { burst: [] as Piece[], debris: [] as Piece[], gather: [] as Piece[], loop: [] as Piece[], volley: [] as Piece[] };
    const rng = rngOf(seedOf(mark.key));
    const burst: Piece[] = [];
    const debris: Piece[] = [];
    const gather: Piece[] = [];
    const loop: Piece[] = [];
    const volley: Piece[] = [];
    const spreadM = specV.form === 'cleave' || specV.form === 'cone'
      ? reachM : specV.radiusM > 0 ? specV.radiusM : .55;
    const sample = () => sampleVfxOffset(mark.area, rng);
    const lift = () => bodyLift * (.35 + rng() * .65);
    // Impact scatter follows the committed footprint: cones fan forward, lines run along their
    // own axis, circles stay radial. Body hits lift the scatter onto the body instead of the feet.
    for (let index = 0; index < specV.particles.burst; index++) {
      const point = world(sample());
      if (bodyLift > 0) point.y -= lift();
      burst.push({ index, x: point.x, y: point.y, size: 3.2 + rng() * 4, delay: rng() * 90,
        dx: (point.x - anchor.x) * .42, dy: (point.y - anchor.y) * .42, rise: -6 - rng() * 16, spin: rng() * 360 });
    }
    // Debris rests where it lands (no outward drift), then sinks.
    for (let index = 0; index < specV.particles.ground; index++) {
      const point = world(sample());
      debris.push({ index, x: point.x, y: point.y, size: 2.6 + rng() * 4.2, delay: 140 + rng() * 220,
        dx: 0, dy: 0, rise: 0, spin: rng() * 360 });
    }
    // Windup gather rides the ground ring and converges on the aim anchor while the cast charges.
    const gatherM = Math.max(.9, spreadM * .8);
    for (let index = 0; index < specV.particles.gather; index++) {
      const angle = index / Math.max(1, specV.particles.gather) * Math.PI * 2 + rng() * .5;
      const point = world({ x: Math.cos(angle) * gatherM, y: Math.sin(angle) * gatherM });
      gather.push({ index, x: point.x, y: point.y, size: 1.8 + rng() * 2.2, delay: index * 45,
        dx: anchor.x - point.x, dy: anchor.y - point.y, rise: -10 - rng() * 14, spin: rng() * 360 });
    }
    // Sustained loop bodies live inside the footprint for fields and channels.
    for (let index = 0; index < specV.particles.loop; index++) {
      const point = world(sample());
      loop.push({ index, x: point.x, y: point.y, size: 2 + rng() * 3.2, delay: rng() * 1600,
        dx: 0, dy: 0, rise: -(24 + rng() * 46), spin: rng() * 360 });
    }
    // Volley sprites land on seeded points inside the committed area, lifted to body centre.
    const volleyCount = specV.form === 'volley' ? Math.max(5, Math.min(10, specV.particles.loop || 8)) : 0;
    for (let index = 0; index < volleyCount; index++) {
      const point = world(sample());
      if (bodyLift > 0) point.y -= lift();
      volley.push({ index, x: point.x, y: point.y, size: 3 + rng() * 2, delay: index * 55,
        dx: 0, dy: 0, rise: 0, spin: 0 });
    }
    return { burst, debris, gather, loop, volley };
  });

  const travel = $derived.by(() => {
    const specV = spec;
    if (!specV || mark.phase !== 'Travel' || (!specV.projectile && !specV.lob)) return null;
    // Projectiles leave the hand/weapon-height release point, not the caster's feet.
    const from = mark.vfxAim.release;
    const to = specV.form === 'volley' ? ground.volley : [{ x: mark.vfxAim.impact.x, y: mark.vfxAim.impact.y, size: 3, delay: 0, dx: 0, dy: 0, rise: 0, spin: 0, index: 0 }];
    const progress = Math.max(0, Math.min(1, mark.progress));
    const apex = specV.lob ? specV.apexM * VFX_LIFT_PX_PER_M : specV.heightM * .35 * VFX_LIFT_PX_PER_M;
    const trailCount = specV.particles.trail;
    const sprites = to.map((end, index) => {
      const local = Math.max(0, progress - (specV.form === 'volley' ? end.delay / 900 : 0));
      const t = Math.max(0, Math.min(1, local));
      const trail: { x: number; y: number }[] = [];
      for (let step = 1; step <= trailCount; step++) {
        const back = Math.max(0, t - step * .055);
        trail.push({
          x: from.x + (end.x - from.x) * back,
          y: from.y + (end.y - from.y) * back - Math.sin(back * Math.PI) * apex,
        });
      }
      const dx = end.x - from.x;
      const dy = end.y - from.y - Math.sin(t * Math.PI) * apex;
      const tangent = Math.atan2(dy, dx) * 180 / Math.PI;
      return {
        index,
        x: from.x + dx * t,
        y: from.y + (end.y - from.y) * t - Math.sin(t * Math.PI) * apex,
        trail,
        angle: specV.lob ? tangent : Math.atan2(end.y - from.y, end.x - from.x) * 180 / Math.PI,
        size: specV.form === 'volley' ? end.size : specV.family === 'fire' || specV.family === 'earth' ? 5 : 3.6,
        shape: projectileShape(specV.family),
      };
    });
    return { sprites, lob: specV.lob, family: specV.family };
  });

  /** Channel blades sweep the caster ring; field bodies fall inside the footprint. */
  const spinning = $derived(spec && (spec.form === 'channel' || spec.form === 'nova' && spec.particles.loop > 0));

  const boltColumn = $derived.by(() => {
    if (!spec || spec.form !== 'skybolt' && !(spec.form === 'sigil' && mark.phase === 'Impact')) return null;
    const rng = rngOf(seedOf(mark.key) ^ 0x9e37);
    const height = spec.heightM * VFX_LIFT_PX_PER_M;
    const stops = 7;
    const points = Array.from({ length: stops }, (_, index) => {
      const frac = index / (stops - 1);
      const jitter = index === 0 || index === stops - 1 ? 0 : (rng() - .5) * 16;
      return `${(mark.vfxAim.groundImpact.x + jitter).toFixed(1)} ${(mark.vfxAim.groundImpact.y - height * frac).toFixed(1)}`;
    });
    return { points, width: Math.max(3, Math.min(9, 3 + spec.radiusM * 2)) };
  });
</script>

{#if spec}
  <g class="skill-vfx-stage" class:no-motion={reducedMotion} data-vfx-form={spec.form} data-vfx-family={spec.family}>
    {#if mark.phase === 'Windup'}
      {#each ground.gather as piece (piece.index)}
        <g class="vfx-gather" style={`--p:${mark.progress}; --gx:${piece.dx}px; --gy:${piece.dy}px; --rise:${piece.rise}px; animation-delay:${piece.delay}ms`}>
          <path d="M0-{piece.size} {piece.size} 0 0 {piece.size}-{piece.size} 0Z" transform={`translate(${piece.x} ${piece.y})`} />
        </g>
      {/each}
    {/if}
    {#if travel}
      {#each travel.sprites as sprite (sprite.index)}
        <g class={`vfx-sprite vfx-${travel.family}`}>
          <polyline class="vfx-sprite-trail" points={sprite.trail.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} />
          <circle class="vfx-sprite-core" cx={sprite.x} cy={sprite.y} r={(sprite.size ?? 4.2) * .62} />
          <g transform={`translate(${sprite.x} ${sprite.y}) rotate(${sprite.angle}) scale(${Math.max(.7, (sprite.size ?? 4.2) / 4.2)})`}>
            <path class="vfx-projectile" d={sprite.shape} />
          </g>
          {#if travel.lob}<ellipse class="vfx-sprite-shadow" cx={sprite.x} cy={mark.vfxAim.groundImpact.y + (sprite.y - mark.vfxAim.groundImpact.y) * -.08} rx="5" ry="2" />{/if}
        </g>
      {/each}
    {/if}
    {#if mark.phase === 'Field' && fieldAmbient.length}
      {#if spec.fieldStyle === 'snow'}
        {#each fieldAmbient as piece (piece.index)}
          <circle class="vfx-field-snow" cx={piece.x} cy={piece.y + mark.progress * 30} r={piece.size} style={`animation-delay:${piece.delay}ms`} />
        {/each}
      {/if}
      {#if spec.fieldStyle === 'meteor'}
        {#each fieldAmbient as piece (piece.index)}
          <rect class="vfx-field-rock" x={piece.x} y={piece.y - 26} width={piece.size} height={piece.size} rx={piece.size / 2} style={`animation-delay:${piece.delay}ms`} />
        {/each}
      {/if}
      {#if spec.fieldStyle === 'lightning'}
        {#each fieldAmbient as piece (piece.index)}
          <line class="vfx-field-spark" x1={piece.x} y1={piece.y} x2={piece.x} y2={piece.y - 26} style={`animation-delay:${piece.delay}ms`} />
        {/each}
      {/if}
      {#if spec.fieldStyle === 'sand'}
        {#each fieldAmbient as piece (piece.index)}
          <ellipse class="vfx-field-dust" cx={piece.x} cy={piece.y} rx={piece.size * 1.6} ry={piece.size * .6} style={`animation-delay:${piece.delay}ms`} />
        {/each}
      {/if}
    {/if}
    {#if supportCue && (mark.phase === 'Impact' || mark.phase === 'Field')}
      <circle class="vfx-support-cue vfx-support-{supportCue.cue}" cx={anchor.x} cy={anchor.y}
        r={supportCue.cue === 'aura' ? reachM * 52 : reachM * 20}
        data-vfx-cue={supportCue.cue} style={supportCue.colour ? `--cue:${supportCue.colour}` : undefined} />
    {/if}
    {#if mark.phase === 'Impact'}
      <path class="vfx-shock" d={mark.footprint} />
      {#if spec.form === 'nova' || spec.form === 'sigil'}
        <path class="vfx-shock vfx-shock-late" d={mark.innerFootprint} />
      {/if}
      {#if spec.form === 'line' || spec.form === 'cone' || spec.form === 'cleave'}
        <path class="vfx-sweep" d={mark.footprint} pathLength="1" style={`--p:${Math.max(.2, mark.progress)}`} />
      {/if}
      {#each ground.burst as piece (piece.index)}
        <g class="vfx-burst" style={`--dx:${piece.dx}px; --dy:${piece.dy}px; --rise:${piece.rise}px; animation-delay:${piece.delay}ms`}>
          <path d={`M0-${piece.size} ${piece.size * .8} 0 0 ${piece.size}-${piece.size * .8} 0Z`}
            transform={`translate(${piece.x} ${piece.y}) rotate(${piece.spin})`} />
        </g>
      {/each}
    {/if}
    {#if mark.phase === 'Channel' && spec.form === 'line'}
      <path class="vfx-channel-beam" d={mark.footprint} />
    {/if}
    {#if mark.phase === 'Impact' || mark.phase === 'Field' || mark.phase === 'Channel'}
      {#each ground.debris as piece (piece.index)}
        <path class={`vfx-debris vfx-${spec.family}`} style={`animation-delay:${piece.delay}ms`}
          d={`M0-${piece.size} ${piece.size} 0 0 ${piece.size * .7}-${piece.size} 0Z`}
          transform={`translate(${piece.x} ${piece.y}) rotate(${piece.spin})`} />
      {/each}
    {/if}
    {#if mark.phase === 'Impact' || mark.phase === 'Field'}
      {#each ground.loop as piece (piece.index)}
        <g class="vfx-loop-body" style={`--rise:${piece.rise}px; animation-delay:${piece.delay}ms`}>
          <circle cx={piece.x} cy={piece.y} r={piece.size * .5} />
        </g>
      {/each}
    {/if}
    {#if mark.phase === 'Impact' || mark.phase === 'Field'}
      {#if ground.loop.length === 0 && spec.particles.embers > 0}
        {#each Array.from({ length: spec.particles.embers }, (_, index) => index) as emberIndex (emberIndex)}
          <circle class="vfx-ember" cx={anchor.x} cy={anchor.y} r={1.6 + emberIndex % 3}
            style={`--drift:${((emberIndex % 5) - 2) * 7}px; --rise:-${Math.round(spec.heightM * VFX_LIFT_PX_PER_M * (.45 + (emberIndex % 4) * .18))}px; animation-delay:${emberIndex * 55}ms`} />
        {/each}
      {/if}
    {/if}
    {#if boltColumn}
      <g class="vfx-column">
        <polyline class="vfx-column-core" points={boltColumn.points.join(' ')} />
        <polyline class="vfx-column-glow" points={boltColumn.points.join(' ')} />
        <ellipse class="vfx-column-flash" cx={mark.vfxAim.groundImpact.x} cy={mark.vfxAim.groundImpact.y} rx={boltColumn.width * 3} ry={boltColumn.width * 1.2} />
      </g>
    {/if}
    {#if spinning && (mark.phase === 'Channel' || mark.phase === 'Impact' || mark.phase === 'Field')}
      <g class={`vfx-spin ${spec.form === 'channel' ? 'vfx-spin-channel' : ''}`}>
        {#each [0, 120, 240] as blade (blade)}
          <path class="vfx-blade" d={`M${reachM * 46} 0A${reachM * 46} ${reachM * 34} 0 0 1 ${reachM * 23} ${reachM * 34}`}
            transform={`translate(${mark.center.x} ${mark.center.y}) rotate(${blade})`} style={`animation-delay:${blade * 60}ms`} />
        {/each}
      </g>
    {/if}
    {#if spec.form === 'volley' && mark.phase === 'Impact'}
      {#each ground.volley as piece (piece.index)}
        <circle class="vfx-volley-hit" cx={piece.x} cy={piece.y} r={piece.size} style={`animation-delay:${piece.delay}ms`} />
      {/each}
    {/if}
  </g>
{/if}

<style>
  .vfx-support-cue { fill: none; stroke: var(--cue, currentColor); stroke-width: 3; opacity: .85; pointer-events: none; vector-effect: non-scaling-stroke; }
  .vfx-support-aura { stroke-width: 1.5; opacity: .6; animation: vfx-aura 1800ms ease-in-out infinite; }
  @keyframes vfx-aura { 0%, 100% { opacity: .55; } 50% { opacity: .8; } }
  .vfx-field-snow { fill: #eaf6ff; opacity: .8; animation: vfx-snow 1400ms linear infinite; }
  @keyframes vfx-snow { 0% { transform: translateY(-6px); opacity: 0; } 20% { opacity: .85; } 100% { transform: translateY(26px); opacity: 0; } }
  .vfx-field-rock { fill: currentColor; stroke: #fff1ca; stroke-width: .6; opacity: .9; animation: vfx-rock 1100ms ease-in infinite; }
  @keyframes vfx-rock { 0% { transform: translateY(-34px) scale(.7); opacity: 0; } 30% { opacity: .95; } 100% { transform: translateY(8px) scale(1.1); opacity: 0; } }
  .vfx-field-spark { stroke: currentColor; stroke-width: 2; stroke-linecap: round; opacity: .9; animation: vfx-spark 700ms steps(2, end) infinite; }
  @keyframes vfx-spark { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
  .vfx-field-dust { fill: currentColor; opacity: .5; animation: vfx-dust 1600ms ease-in-out infinite alternate; }
  @keyframes vfx-dust { 0% { transform: translateX(-4px); opacity: .3; } 100% { transform: translateX(4px); opacity: .6; } }
  .skill-vfx-stage { color: var(--skill-element, var(--es-lit)); pointer-events: none; }
  .skill-vfx-stage path, .skill-vfx-stage circle, .skill-vfx-stage polyline, .skill-vfx-stage ellipse { vector-effect: non-scaling-stroke; }
  .vfx-gather { fill: currentColor; opacity: 0; animation: vfx-gather 340ms linear infinite; }
  .vfx-gather path { transform-box: fill-box; }
  @keyframes vfx-gather {
    0% { opacity: 0; translate: calc(var(--gx) * .2) calc(var(--gy) * .2 + var(--rise)); }
    25% { opacity: .85; }
    100% { opacity: 0; translate: calc(var(--gx) * var(--p)) calc(var(--gy) * var(--p)); }
  }
  .vfx-sprite-trail { fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; opacity: .55; }
  .vfx-sprite-core { fill: currentColor; stroke: #fff1ca; stroke-width: 1.2; filter: drop-shadow(0 0 4px currentColor); opacity: .85; }
  .vfx-projectile { fill: currentColor; stroke: #fff1ca; stroke-width: 1.1; stroke-linejoin: round; filter: drop-shadow(0 0 4px currentColor); }
  .vfx-sprite-shadow { fill: rgba(8, 14, 11, .5); }
  .vfx-sweep { fill: none; stroke: currentColor; stroke-width: 3; stroke-dasharray: .16 .84; stroke-linecap: round; opacity: .9; animation: vfx-sweep 420ms ease-out both; }
  .vfx-channel-beam { fill: currentColor; fill-opacity: .18; stroke: currentColor; stroke-width: 2; opacity: .9; }
  @keyframes vfx-sweep { 0% { opacity: 0; stroke-dashoffset: 1; } 28% { opacity: .95; } 100% { opacity: 0; stroke-dashoffset: 0; } }
  .vfx-shock { fill: none; stroke: currentColor; stroke-width: 3; opacity: 0; transform-box: fill-box; transform-origin: center; animation: vfx-shock 460ms ease-out both; }
  .vfx-shock-late { animation-delay: 120ms; stroke-width: 2; }
  @keyframes vfx-shock { 0% { opacity: .9; transform: scale(.72); } 100% { opacity: 0; transform: scale(1.28); } }
  .vfx-burst { fill: currentColor; opacity: 0; filter: drop-shadow(0 0 3px currentColor); animation: vfx-burst 440ms cubic-bezier(.16, 1, .3, 1) both; }
  @keyframes vfx-burst {
    0% { opacity: .95; translate: 0 0; }
    100% { opacity: 0; translate: var(--dx) calc(var(--dy) + var(--rise)); }
  }
  .vfx-debris { fill: currentColor; stroke: color-mix(in srgb, currentColor 60%, #fff1ca); stroke-width: .8; opacity: 0; animation: vfx-debris 900ms ease-out both; }
  @keyframes vfx-debris { 0% { opacity: 0; } 14% { opacity: .9; } 70% { opacity: .75; } 100% { opacity: 0; } }
  .vfx-loop-body { fill: currentColor; opacity: .8; animation: vfx-loop 1500ms ease-in-out infinite; }
  @keyframes vfx-loop {
    0% { opacity: 0; transform: translateY(calc(var(--rise, -30px) * -.4)); }
    30% { opacity: .85; }
    100% { opacity: 0; transform: translateY(var(--rise, -30px)); }
  }
  .vfx-ember { fill: currentColor; opacity: 0; animation: vfx-ember 620ms ease-out both; }
  @keyframes vfx-ember {
    0% { opacity: .95; translate: 0 4px; }
    100% { opacity: 0; translate: var(--drift, 0px) var(--rise, -80px); }
  }
  .vfx-column-core { fill: none; stroke: currentColor; stroke-width: var(--column-w, 6); stroke-linejoin: round; filter: drop-shadow(0 0 6px currentColor); animation: vfx-column 360ms steps(2, end) both; }
  .vfx-column-glow { fill: none; stroke: #fff1ca; stroke-width: 2; opacity: .85; animation: vfx-column 360ms steps(2, end) both; }
  .vfx-column-flash { fill: currentColor; opacity: 0; animation: vfx-column-flash 420ms ease-out both; }
  @keyframes vfx-column { 0% { opacity: 0; } 18%, 55% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes vfx-column-flash { 0% { opacity: .8; } 100% { opacity: 0; } }
  .vfx-spin { animation: vfx-spin 900ms linear infinite; transform-box: view-box; }
  .vfx-spin-channel { animation-duration: 620ms; }
  .vfx-blade { fill: none; stroke: currentColor; stroke-width: 3.2; stroke-linecap: round; opacity: .8; }
  @keyframes vfx-spin { from { rotate: 0deg; } to { rotate: 360deg; } }
  .vfx-volley-hit { fill: currentColor; stroke: #fff1ca; stroke-width: 1; opacity: 0; animation: vfx-volley 420ms ease-out both; }
  @keyframes vfx-volley { 0% { opacity: .9; } 100% { opacity: 0; transform: scale(1.7); } }
  .no-motion .vfx-support-aura, .no-motion .vfx-field-snow, .no-motion .vfx-field-rock, .no-motion .vfx-field-spark, .no-motion .vfx-field-dust { animation: none; }
  @media (prefers-reduced-motion: reduce) {
    .vfx-support-aura, .vfx-field-snow, .vfx-field-rock, .vfx-field-spark, .vfx-field-dust { animation: none; }
  }
  .no-motion .vfx-gather, .no-motion .vfx-loop-body, .no-motion .vfx-spin { animation: none; }
  .no-motion .vfx-gather, .no-motion .vfx-loop-body { opacity: .5; }
  .no-motion .vfx-burst { animation-duration: 1ms; opacity: .6; }
  @media (prefers-reduced-motion: reduce) {
    .vfx-gather, .vfx-loop-body, .vfx-spin { animation: none; }
    .vfx-burst { animation-duration: 1ms; }
  }
</style>
