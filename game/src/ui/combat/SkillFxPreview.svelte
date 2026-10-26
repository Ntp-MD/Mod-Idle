<script lang="ts">
  import { onMount } from 'svelte';
  import ArenaSkillVfx from './ArenaSkillVfx.svelte';
  import ArenaGroundAura from './ArenaGroundAura.svelte';
  import { authoredVfxFor } from './arena-authored-vfx';
  import { ACTIVE_VFX, activeVfxMechanics, activeVfxElement, activeVfxPlaybackDuration } from './arena-active-vfx';
  import { E, sm } from '../../engine/client';
  import type { VfxFootprint } from './arena-vfx-space';
  import { groundAuraFootprint } from './arena-vfx-space';
  import { auraFxFor, skillFxFor } from './arena-skill-effects';

  let { id, height = 92, inspect = false }: { id: string; height?: number; inspect?: boolean } = $props();
  let age = $state(-.55);
  let reducedMotion = $state(false);
  let previewPaused = $state(false);
  let previewHost = $state<HTMLDivElement | null>(null);
  let previewElapsed = 0;
  function replay() { previewElapsed=0; age=-.55; previewPaused=false; }
  function seek(next: number) { previewPaused=true; age=next; previewElapsed=(next+.55)*1000; }
  onMount(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion = media.matches; };
    update(); media.addEventListener('change', update);
    let frame = 0; let previous = performance.now(); let visible = true;
    const observer = new IntersectionObserver(entries => { visible=entries[0]?.isIntersecting ?? false; });
    if(previewHost) observer.observe(previewHost);
    const tick = (now: number) => {
      if(visible && !document.hidden && !previewPaused) { previewElapsed+=Math.min(100,now-previous); age=(previewElapsed%cycleMs)/1000-.55; }
      previous=now; frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); media.removeEventListener('change', update); };
  });
  const skill = $derived(sm.byId[id]);
  const fx = $derived(skillFxFor(id));
  const authored = $derived(authoredVfxFor(id));
  const playbackSec = $derived(activeVfxPlaybackDuration(fx?.shape ?? '', skill, id));
  const cycleMs = $derived(skill?.type === 'aura' && authored ? authored.frameMs * (authored.loop[1] - authored.loop[0] + 1) : Math.max(2600,(playbackSec+.8)*1000));
  const aura = $derived(auraFxFor(id));
  const colour = $derived((E.elements.colour as Record<string,string>)[activeVfxElement(id,skill?.element)] || 'var(--gold-lit)');
  const mechanics = $derived(activeVfxMechanics(skill));
  const prepared = $derived(skill?.effects?.find((effect:any) => effect.stat === 'consume_status'));
  const spreads = $derived(skill?.effects?.find((effect:any) => effect.stat === 'spread_status')?.value ?? 0);
  const casterArea = $derived(skill?.area?.origin === 'caster');
  const fieldCenter = $derived({x:casterArea?280:400,y:casterArea?278:268});
  const fieldRadius = $derived(Math.min(135,Math.max(50,(skill?.area?.radius_m ?? 0)*45)));
  const areaShape = $derived(skill?.area?.shape);
  const directional = $derived(areaShape === 'line' || areaShape === 'cone');
  const previewShape = $derived.by(() => {
    if (!skill || !directional) return '';
    const origin = { ...fieldCenter };
    let target = previewTargets[0] ?? origin;
    if (Math.hypot(target.x - origin.x, target.y - origin.y) < 1) target = { x: origin.x + 150, y: origin.y - 26 };
    const direction = Math.atan2(target.y - origin.y, target.x - origin.x);
    const dir = { x: Math.cos(direction), y: Math.sin(direction) };
    const perp = { x: -dir.y, y: dir.x };
    if (areaShape === 'line') {
      const reach = (skill.area?.length_m ?? skill.cast?.range_m ?? 0) * 45;
      const half = Math.max(3, (skill.area?.width_m ?? 0.75) * 45 / 2);
      const corners = [
        { x: origin.x + perp.x * half, y: origin.y + perp.y * half },
        { x: origin.x + dir.x * reach + perp.x * half, y: origin.y + dir.y * reach + perp.y * half },
        { x: origin.x + dir.x * reach - perp.x * half, y: origin.y + dir.y * reach - perp.y * half },
        { x: origin.x - perp.x * half, y: origin.y - perp.y * half },
      ];
      return corners.map((corner, index) => `${index === 0 ? 'M' : 'L'}${corner.x.toFixed(1)} ${corner.y.toFixed(1)}`).join(' ') + ' Z';
    }
    const reach = fieldRadius;
    const halfAngle = Math.max(1, Math.min(180, skill.area?.angle_deg ?? 90)) * Math.PI / 360;
    const arc = Array.from({ length: 19 }, (_, step) => {
      const angle = direction - halfAngle + (halfAngle * 2 * step) / 18;
      return { x: origin.x + Math.cos(angle) * reach, y: origin.y + Math.sin(angle) * reach };
    });
    return `M${origin.x} ${origin.y} ` + arc.map((corner) => `L${corner.x.toFixed(1)} ${corner.y.toFixed(1)}`).join(' ') + ' Z';
  });
  const previewArea = $derived<VfxFootprint | undefined>((skill?.area?.radius_m ?? 0) > 0 ? {
    center:fieldCenter,basisX:{x:fieldRadius,y:-fieldRadius*.19},basisY:{x:fieldRadius*.22,y:fieldRadius*.7},diameter:fieldRadius*2,
    ...(areaShape === 'cone' ? {shape:'cone' as const,lengthM:skill?.area?.radius_m,angleDeg:skill?.area?.angle_deg,directionRad:0} : {}),
  } : undefined);
  const previewTargets = $derived(mechanics.targets > 1 ? [-2.5,-.6,1.5].slice(0,mechanics.targets).map(angle=>({x:fieldCenter.x+Math.cos(angle)*fieldRadius*.72,y:fieldCenter.y+Math.sin(angle)*fieldRadius*.48})) : [fieldCenter]);
  const previewSpread = $derived([{x:300,y:250},{x:490,y:285}].slice(0,spreads));
  const kind = $derived(skill?.type || 'attack');
  const selfCast = $derived(kind === 'buff' || kind === 'heal' || kind === 'aura');
  const projectile = $derived((skill?.cast ? skill.cast.delivery === 'projectile' : Boolean(fx?.projectile)) && !selfCast);
  const castX = $derived(selfCast ? 90 : 40);
  const targetX = $derived(selfCast ? 90 : 140);
</script>

{#if skill && fx}
  <div class="skill-fx-preview" bind:this={previewHost} data-skill-id={id} data-skill-fx={fx.shape} data-self-cast={selfCast} style={`--fx:${colour};--fx-height:${height}px`}>
    <header><span>Effect preview</span><small>{kind}{skill.element ? ` · ${skill.element}` : ''}</small></header>
    <div class="fx-controls">
      <button type="button" onclick={replay} aria-label={`Replay ${skill.name} effect`}>Replay</button>
      <button type="button" aria-pressed={previewPaused} onclick={() => previewPaused=!previewPaused}>{previewPaused ? 'Play' : 'Pause'}</button>
    </div>
    {#if inspect && kind !== 'aura'}
      <div class="fx-inspector" aria-label={`${skill.name} animation inspection`}>
        <button type="button" onclick={() => seek(-.38)}>Windup</button>
        {#if projectile}<button type="button" onclick={() => seek(-.12)}>Flight</button>{/if}
        <button type="button" onclick={() => seek(.12)}>Impact</button>
        <button type="button" onclick={() => seek(playbackSec*.9)}>Fade</button>
        <input type="range" aria-label={`${skill.name} animation time`} min="-.55" max={cycleMs/1000-.55} step=".01" value={age}
          oninput={(event) => seek(Number(event.currentTarget.value))} />
        <output aria-label="Time relative to impact">{age.toFixed(2)}s</output>
      </div>
    {/if}
    {#if kind !== 'aura' && ACTIVE_VFX[fx.shape]}
      {@const source = {x:selfCast || casterArea ? 280 : 85, y:220}}
      {@const point = {x:previewTargets[0].x,y:previewTargets[0].y-48}}
      {@const ground = previewTargets[0]}
      {@const timing = {startedAtSec:-.55,releasedAtSec:-.24,impactAtSec:0,nowSec:age}}
      <svg viewBox={inspect ? '0 0 560 440' : '0 0 560 340'} role="img" aria-label={`${skill.name} ARPG effect preview`} style:color={colour}>
        <ArenaSkillVfx {id} shape={fx.shape} {age} {source} {point} {ground} cast={true} area={previewArea} {timing} targets={previewTargets} spreadTargets={previewSpread} consumed={prepared?.cap ?? 0} element={skill.element} layer="ground" {reducedMotion} />
        {#if previewShape}<path class="fx-area-shape" d={previewShape} data-area-shape={areaShape} />{/if}
        <ellipse class="fx-caster" cx={source.x} cy="278" rx="18" ry="6" />
        {#if !selfCast}
          {#each previewTargets as target}<ellipse class="fx-target" cx={target.x} cy={target.y} rx="18" ry="6" />{/each}
        {/if}
        <ArenaSkillVfx {id} shape={fx.shape} {age} {source} {point} {ground} cast={true} area={previewArea} {timing} targets={previewTargets} spreadTargets={previewSpread} consumed={prepared?.cap ?? 0} element={skill.element} {reducedMotion} />
        {#each previewTargets as target, index}
          <ArenaSkillVfx {id} shape={fx.shape} {age}
            source={fx.shape === 'chainLightning' && index > 0 ? {x:previewTargets[index-1].x,y:previewTargets[index-1].y-48} : source}
            point={{x:target.x,y:target.y-48}} ground={target} cast={false} {timing} element={skill.element} {reducedMotion} />
        {/each}
      </svg>
    {:else}
    <svg viewBox="0 0 180 100" role="img" aria-label={`${skill.name} effect preview`}>
      <line class="fx-ground" x1="16" y1="82" x2="164" y2="82" />
      {#if kind === 'aura'}
        {#if authoredVfxFor(id)}
          <ArenaGroundAura {id} age={Math.max(0, age + .55)} footprint={groundAuraFootprint({x:90,y:74},48)} {reducedMotion} />
        {:else}
        <g class="fx-aura-wrap" transform="translate(90 54)">
          <path class="fx-aura" d={aura?.path ?? fx.path} />
        </g>
        {/if}
      {:else}
        <circle class="fx-caster" cx={castX} cy="78" r="5" />
        {#if !selfCast}<circle class="fx-target" cx={targetX} cy="78" r="5" />{/if}
        <g transform={`translate(${castX} 78)`}>
          <g class="fx-pose"><path d={fx.posePath} /></g>
        </g>
        {#if projectile}
          <g transform={`translate(${castX} 78)`}>
            <g class="fx-flight"><path d={fx.projectilePath} /></g>
          </g>
        {/if}
        <g transform={`translate(${targetX} 78)`}>
          <g class="fx-impact-wrap"><path class="fx-impact" d={fx.path} /></g>
        </g>
      {/if}
    </svg>
    {/if}
    {#if prepared}<p>Prepared target: {prepared.cap} {prepared.status} stacks</p>{/if}
    <p>{kind === 'aura' ? 'Aura field' : projectile ? 'Cast → projectile → impact' : 'Cast → impact'} · loops</p>
  </div>
{/if}

<style>
  .fx-inspector { display:flex; align-items:center; gap:var(--spacing-xs); flex-wrap:wrap; font-size:var(--font-3xs); }
  .fx-inspector input { width:10rem; }
  .fx-inspector output { min-width:4em; font-variant-numeric:tabular-nums; color:var(--dim); }
  .skill-fx-preview {
    display: grid; gap: 4px; padding: 8px;
    border: 1px solid var(--line); border-radius: var(--radius-card);
    background: linear-gradient(180deg, var(--inset), color-mix(in srgb, var(--panel) 88%, var(--inset)));
  }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: var(--dim); font-size: var(--font-3xs); letter-spacing: .08em; text-transform: uppercase; }
  .fx-controls { display:flex; gap:var(--spacing-xs); }
  .fx-controls button { padding:2px 8px; border:1px solid var(--line); border-radius:var(--radius-card); background:var(--inset); color:var(--dim); font:inherit; font-size:var(--font-3xs); cursor:pointer; }
  .fx-controls button:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
  header small { color: var(--fx); font-family: var(--num); letter-spacing: .04em; }
  svg { display: block; width: 100%; height: var(--fx-height, 92px); overflow: visible; }
  p { margin: 0; color: var(--dim); font-size: var(--font-3xs); }
  .fx-ground { stroke: var(--line); stroke-dasharray: 2 4; }
  .fx-area-shape { fill: var(--fx); fill-opacity: .16; stroke: var(--fx); stroke-opacity: .65;
    stroke-width: 1.5; vector-effect: non-scaling-stroke; pointer-events: none; }
  .fx-caster, .fx-target { fill: var(--dim); opacity: .5; }
  .fx-pose, .fx-flight, .fx-impact-wrap, .fx-aura-wrap { transform-box: fill-box; transform-origin: center; }
  .fx-pose path { fill: none; stroke: var(--fx); stroke-width: 2; filter: drop-shadow(0 0 4px var(--fx)); }
  .fx-flight path { fill: var(--fx); stroke: #fff4cf; stroke-width: 1; filter: drop-shadow(0 0 5px var(--fx)); }
  .fx-impact { fill: var(--fx); stroke: #fff1ca; stroke-width: 1.2; filter: drop-shadow(0 0 4px var(--fx)); }
  .fx-aura { fill: none; stroke: var(--fx); stroke-width: 1.6; stroke-dasharray: 4 3; filter: drop-shadow(0 0 4px var(--fx)); }
  .fx-pose { animation: fx-pose 2.4s ease-out infinite; }
  .fx-flight { animation: fx-flight 2.4s linear infinite; }
  .fx-impact-wrap { animation: fx-impact 2.4s ease-out infinite; }
  .fx-aura-wrap { animation: fx-aura 6s linear infinite; }
  @keyframes fx-pose {
    0%, 8% { opacity: 0; transform: scale(.82); }
    14%, 32% { opacity: 1; transform: scale(1); }
    45%, 100% { opacity: 0; transform: scale(1); }
  }
  @keyframes fx-flight {
    0%, 20% { opacity: 0; transform: translateX(0); }
    25% { opacity: 1; }
    55% { opacity: 1; transform: translateX(100px); }
    62%, 100% { opacity: 0; transform: translateX(100px); }
  }
  @keyframes fx-impact {
    0%, 52% { opacity: 0; transform: scale(.6); }
    58% { opacity: 1; transform: scale(1.08); }
    70% { opacity: .9; transform: scale(1.2); }
    82%, 100% { opacity: 0; transform: scale(1.25); }
  }
  @keyframes fx-aura { to { rotate: 1turn; } }
  @media (prefers-reduced-motion: reduce) {
    .fx-pose, .fx-flight, .fx-impact-wrap, .fx-aura-wrap { animation: none; opacity: .85; }
    .fx-flight { display: none; }
  }
</style>
