<script lang="ts">
  import { untrack } from 'svelte';
  import { sm } from '../../engine/client';
  import { castForHit } from './plate';
  import { fieldShape } from '../fx';
  import { skillFxFor } from './arena-skill-effects';
  import { mobSkillById } from '../../sim/mobSkills';
  import { actorImpactMs } from './combat-actor';
  import { combatEffectLevel, importantCombatEvent, sceneCombatEvents, type CombatEffectLevel } from './combat-presentation';
  import type { FxEvent, Mob } from '../../sim/types';
  import type { Character } from '../../sim/player';

  let { ring, c, plates, speed = 1, effectLevel = 'auto' }: { ring: FxEvent[]; c: Character; plates: Mob[]; speed?: number; effectLevel?: CombatEffectLevel } = $props();
  const effects = $derived(combatEffectLevel(effectLevel, speed));
  type Point = { x: number; y: number };
  type Anchor = { point: Point; ground: Point; radius: number };
  type Mark = {
    event: FxEvent; source: Point; target: Point; radius: number;
    shape: string; flight: boolean; lightning: string; ground: number; contactMs: number;
    skillFx: ReturnType<typeof skillFxFor>;
  };
  let layer = $state<HTMLDivElement | null>(null);
  let marks = $state<Mark[]>([]);
  let size = $state({ width: 1, height: 1 });
  const mobAnchors = new Map<string, Anchor>();
  const seenEvents = new Set<number>();

  function actorAnchor(actor: Element, bounds: DOMRect): Anchor {
    const body = actor.querySelector('[data-combat-anchor]');
    const rect = (body || actor.querySelector('.portrait') || actor).getBoundingClientRect();
    const x = rect.left + rect.width / 2 - bounds.left;
    return {
      point: { x, y: rect.top + rect.height * (body ? .45 : .5) - bounds.top },
      ground: { x, y: rect.bottom - bounds.top },
      radius: Math.min(86, Math.max(28, Math.min(rect.width, rect.height) * (body ? .52 : .8))),
    };
  }

  function rememberMobs(host: HTMLElement) {
    const bounds = host.getBoundingClientRect();
    for (const mob of Array.from(host.closest('.field')?.querySelectorAll<HTMLElement>('.mob') || [])) {
      mobAnchors.set(mob.dataset.mobId!, actorAnchor(mob, bounds));
    }
  }

  // A lethal hit removes the card in the same update. Keep its last visible position.
  $effect.pre(() => {
    void ring;
    void plates;
    if (effects !== 'minimal' && layer) rememberMobs(layer);
  });

  const events = $derived(sceneCombatEvents(ring, speed, effectLevel));

  function shapeOf(event: FxEvent, mob?: Mob): string {
    const skillId = event.skillId || castForHit(ring, event)?.skillId;
    return fieldShape(event, {
      mob,
      skill: skillId ? sm.byId[skillId] : null,
      mobSkill: event.skillId ? mobSkillById(event.skillId) : undefined,
      weaponGroup: sm.weaponGroupOf(c.weaponName) || 'melee',
      weaponElement: c.weaponElement,
    });
  }

  // Capture anchors once per event. An older effect must not chase the next card lunge.
  $effect(() => {
    const pending = events;
    const currentRing = ring;
    if (effects === 'minimal') {
      marks = [];
      seenEvents.clear();
      for (const event of currentRing) seenEvents.add(event.id);
      return;
    }
    const mobs = new Map(plates.map((mob) => [mob.id, mob]));
    const host = layer;
    if (!host) return;
    const previous = untrack(() => new Map(marks.map((mark) => [mark.event.id, mark])));
    const frame = requestAnimationFrame(() => {
      if (!host.isConnected) return;
      const field = host.closest<HTMLElement>('.field');
      const player = field?.querySelector<HTMLElement>('.player-card');
      if (!field || !player) return;
      const bounds = host.getBoundingClientRect();
      rememberMobs(host);
      const retainedIds = new Set([...mobs.keys(), ...pending.map((event) => event.mobId || event.byId)]);
      for (const id of mobAnchors.keys()) if (!retainedIds.has(id)) mobAnchors.delete(id);
      const playerAnchor = actorAnchor(player, bounds);
      const playerPoint = playerAnchor.point;
      size = { width: bounds.width, height: bounds.height };
      marks = pending.flatMap((event): Mark[] => {
        const known = previous.get(event.id);
        if (known) return [known];
        // Changing density never resurrects an older contact that was deliberately omitted.
        if (seenEvents.has(event.id)) return [];
        const mobId = event.mobId || event.byId || '';
        const mob = mobAnchors.get(mobId);
        const mobData = mobs.get(mobId);
        const incoming = event.side === 'self';
        if (!incoming && !mob) return [];
        const source = incoming ? (mob?.point || playerPoint) : playerPoint;
        const target = incoming ? playerPoint : mob!.point;
        const shape = shapeOf(event, mobData);
        const skillId = event.skillId || castForHit(ring, event)?.skillId;
        const skillFx = skillFxFor(skillId);
        const mobSkill = event.skillId ? mobSkillById(event.skillId) : undefined;
        const flight = (event.kind === 'hit' && (!!skillFx?.projectile || !['slash', 'earth'].includes(shape))) ||
          (event.kind === 'taken' && !!mob && (mobSkill?.role === 'stand-off' || (!mobSkill && mobData?.damage === 'magic')));
        const weight = mobData?.readsAs === 'large' ? 1.18 : mobData?.readsAs === 'small' ? .86 : 1;
        const radius = incoming ? playerAnchor.radius * (event.kind === 'taken' ? weight : 1) : mob!.radius;
        const ground = ((incoming ? playerAnchor.ground.y : mob!.ground.y) - target.y) * 60 / radius;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const length = Math.hypot(dx, dy) || 1;
        const lightning = Array.from({ length: 9 }, (_, index) => {
          const t = index / 8;
          const bend = index === 0 || index === 8 ? 0 : (index % 2 ? 1 : -1) * Math.min(20, length * .07);
          return `${source.x + dx * t - dy / length * bend},${source.y + dy * t + dx / length * bend}`;
        }).join(' ');
        return [{ event, source, target, radius, shape, flight, lightning, ground, skillFx, contactMs: actorImpactMs(event, c, incoming ? mobData : undefined, speed) }];
      });
      seenEvents.clear();
      for (const event of currentRing) seenEvents.add(event.id);
    });
    return () => cancelAnimationFrame(frame);
  });
</script>

<div class="combat-scene-effects" class:calm={effects === 'reduced'} class:reduced={effectLevel === 'reduced'} bind:this={layer} aria-hidden="true">
  <svg viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none">
    {#each marks as mark (mark.event.id)}
      <g class="combat-effect" class:critical={mark.event.crit} class:important={importantCombatEvent(mark.event)} class:has-flight={mark.flight}
         data-effect={mark.shape} data-skill-id={mark.event.skillId || ''} data-event-id={mark.event.id} style={`--impact-delay:${mark.contactMs}ms; --fx:${mark.shape === 'heal' ? 'var(--good-lit)' : mark.shape === 'block' ? 'var(--es-lit)' : mark.event.colour}`}>
        {#if mark.flight}
          {#if mark.skillFx?.projectile}
            <g class="skill-projectile" style={`--sx:${mark.source.x}px;--sy:${mark.source.y}px;--tx:${mark.target.x}px;--ty:${mark.target.y}px;--flight-ms:${Math.max(120, mark.contactMs)}ms`}>
              <path d={mark.skillFx.projectilePath} />
            </g>
          {:else if mark.shape === 'lightning'}
            <polyline class="lightning-trail" points={mark.lightning} />
            <polyline class="lightning-core" points={mark.lightning} />
          {:else}
            <line class="flight-trail" x1={mark.source.x} y1={mark.source.y} x2={mark.target.x} y2={mark.target.y} pathLength="1" />
            <line class="flight-core" x1={mark.source.x} y1={mark.source.y} x2={mark.target.x} y2={mark.target.y} pathLength="1" />
          {/if}
        {/if}
        <g transform={`translate(${mark.target.x} ${mark.target.y}) scale(${mark.radius / 60})`}>
          <g class="impact">
            {#if mark.skillFx}
              <path class="skill-fx-impact" d={mark.skillFx.path} />
            {:else if mark.shape === 'slash'}
              <path class="slash-edge" d="M-55 38 Q-9-45 57-35 Q9-29-30 31Z" />
              <path class="slash-core" d="M-45 35 Q3-22 54-34 Q8-16-20 27Z" />
              {#if mark.event.crit}<path class="slash-echo" d="M-48 8 Q7 42 52-21" />{/if}
            {:else if mark.shape === 'block'}
              <path class="shield" d="M0-37 29-24 25 11Q19 31 0 40Q-19 31-25 11L-29-24Z" />
              <path class="shield-ridge" d="M0-26V27M-18-15 0-22 18-15" />
            {:else if mark.shape === 'dodge'}
              <path class="dodge-streak" d="M-38-17H16M-23-1H38M-38 15H5" />
            {:else if mark.shape === 'heal' || mark.shape === 'ward'}
              <ellipse class="ground-ring" cx="0" cy={mark.ground} rx="39" ry="14" />
              {#each [-22, 0, 22] as x, index}
                <g transform={`translate(0 ${mark.ground - 30})`}>
                  <path class="rising-mote" style={`--delay:${index * 65}ms`} d={`M${x - 4} 8h8v-8h8v-8h-8v-8h-8v8h-8v8h8Z`} />
                </g>
              {/each}
              {#if mark.shape === 'ward'}<path class="ward" d="M-31 18V-19L0-37 31-19V18L0 37Z" />{/if}
            {:else if mark.shape === 'cold'}
              {#each [0, 60, 120] as angle}
                <path class="ice-shard" transform={`rotate(${angle})`} d="M0-46 7-9 0 35-7-9Z" />
              {/each}
            {:else if mark.shape === 'earth'}
              <g transform={`translate(0 ${mark.ground - 22})`}>
                <ellipse class="ground-ring" cx="0" cy="22" rx="46" ry="17" />
                <path class="rock" d="M-36 20-26-12-12-19 0 10 15-30 29-24 40 20Z" />
              </g>
            {:else if mark.shape === 'poison'}
              {#each [-22, 0, 22] as x, index}
                <path class="venom" style={`--delay:${index * 35}ms`} transform={`translate(${x} ${index % 2 * 14})`} d="M0-29Q-21-6-7 4Q8 14 13 0Q17-10 0-29Z" />
              {/each}
            {:else if mark.shape === 'chaos'}
              <path class="rift" d="M-20-39 11-19-5 0 23 13 0 41 8 12-18-2-1-20Z" />
              <ellipse class="rift-ring" rx="34" ry="39" />
            {:else}
              <path class="impact-star" d="M0-38 8-12 30-25 16-4 41 6 14 12 23 34 2 20-13 39-13 14-38 18-20-3-36-21-9-13Z" />
              {#if mark.shape === 'fire'}
                <path class="flame" d="M-18 24Q-39-3-8-36Q-12-12 4-16Q22-26 16-41Q47-1 20 27Q28 3 9-3Q13 21-3 29Z" />
              {/if}
            {/if}
            {#if !['heal', 'ward', 'dodge'].includes(mark.shape)}
              <circle class="impact-ring" r="25" />
              <circle class="impact-flash" r={mark.event.crit ? 15 : 9} />
              {#each [0, 60, 120, 180, 240, 300] as angle, index}
                <g transform={`rotate(${angle + mark.event.id % 25})`}>
                  <path class="fragment" style={`--reach:${index % 2 ? 49 : 64}px`} d="M-2-10 2-10 3-20-3-18Z" />
                </g>
              {/each}
            {/if}
          </g>
        </g>
      </g>
    {/each}
  </svg>
</div>

<style>
  .combat-scene-effects { position: absolute; inset: 0; z-index: var(--z-highlight); pointer-events: none; overflow: hidden; }
  svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .combat-effect { --impact-delay: 0ms; color: var(--fx); }
  .combat-effect.has-flight { --impact-delay: 170ms; }
  .skill-projectile { fill: currentColor; stroke: #fff0c6; stroke-width: 1.3; stroke-linejoin: round; filter: drop-shadow(0 0 5px currentColor); animation: skill-projectile var(--flight-ms, 320ms) linear both; }
  .skill-fx-impact { fill: currentColor; stroke: #fff1ca; stroke-width: 1.8; stroke-linejoin: round; filter: drop-shadow(0 0 4px currentColor); }
  @keyframes skill-projectile {
    0% { transform: translate(var(--sx), var(--sy)) scale(.55); opacity: 0; }
    12% { opacity: 1; }
    86% { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 1; }
    100% { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 0; }
  }
  .impact { opacity: 0; animation: impact-life 480ms var(--impact-delay) linear both; }
  .critical .impact { animation-duration: 580ms; }
  .impact-ring { fill: none; stroke: currentColor; stroke-width: 1.5; transform-origin: 0 0; animation: ring-expand 380ms var(--impact-delay) ease-out both; }
  .impact-flash { fill: var(--text); animation: flash-out 150ms var(--impact-delay) ease-out both; }
  .impact-star { fill: currentColor; opacity: .65; }
  .critical .impact-star { transform: scale(1.25); }
  .calm .combat-effect:not(.important) { opacity: .45; }
  .calm .combat-effect:not(.important) .fragment,
  .calm .combat-effect:not(.important) .impact-flash,
  .calm .combat-effect:not(.important) .impact-ring { display: none; }
  .reduced .fragment, .reduced .impact-flash, .reduced .impact-ring,
  .reduced .flight-trail, .reduced .flight-core, .reduced .lightning-trail, .reduced .lightning-core { display: none; }
  .reduced .skill-projectile { display: none; }
  .reduced .rising-mote, .reduced .dodge-streak, .reduced .venom { animation: none; }
  .slash-edge { fill: currentColor; }
  .slash-core { fill: var(--text); }
  .slash-echo { fill: none; stroke: currentColor; stroke-width: 3; }
  .fragment { fill: currentColor; animation: scatter 400ms var(--impact-delay) cubic-bezier(.16, 1, .3, 1) both; }
  .flight-trail, .flight-core { fill: none; stroke: currentColor; stroke-linecap: round; stroke-dasharray: .12 1; animation: flight var(--impact-delay) ease-in both; }
  .flight-trail { stroke-width: 7; opacity: .45; }
  .flight-core { stroke: var(--text); stroke-width: 2; }
  .lightning-trail, .lightning-core { fill: none; stroke: currentColor; stroke-linejoin: bevel; animation: lightning 290ms steps(2, end) both; }
  .lightning-trail { stroke-width: 7; opacity: .4; }
  .lightning-core { stroke-width: 2; stroke: var(--text); }
  .shield { fill: color-mix(in srgb, var(--fx) 15%, transparent); stroke: currentColor; stroke-width: 3; }
  .shield-ridge { fill: none; stroke: var(--text); stroke-width: 2; }
  .dodge-streak { fill: none; stroke: currentColor; stroke-width: 3; animation: evade 300ms ease-out both; }
  .ground-ring { fill: none; stroke: currentColor; stroke-width: 2; }
  .rising-mote { fill: currentColor; animation: rise 560ms var(--delay) ease-out both; }
  .ward { fill: none; stroke: currentColor; stroke-width: 1.5; }
  .ice-shard { fill: color-mix(in srgb, var(--fx) 60%, var(--text)); stroke: currentColor; stroke-width: 1; }
  .rock { fill: currentColor; stroke: var(--text); stroke-width: 1; }
  .venom { fill: currentColor; animation: poison-drop 400ms var(--delay) ease-in both; }
  .rift { fill: currentColor; stroke: var(--text); stroke-width: 1; }
  .rift-ring { fill: none; stroke: currentColor; stroke-width: 2; stroke-dasharray: 12 13; }
  .flame { fill: currentColor; }
  @keyframes impact-life { 0% { opacity: 0; } 12%, 40% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes flash-out { 0% { opacity: .95; } 100% { opacity: 0; } }
  @keyframes ring-expand { from { transform: scale(.4); opacity: .9; } to { transform: scale(1.9); opacity: 0; } }
  @keyframes scatter { from { transform: translateY(0); opacity: 1; } to { transform: translateY(calc(-1 * var(--reach))); opacity: 0; } }
  @keyframes flight { 0% { stroke-dashoffset: .12; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { stroke-dashoffset: -1; opacity: 0; } }
  @keyframes lightning { 0% { opacity: 0; } 18%, 48% { opacity: 1; } 32%, 64% { opacity: .2; } 100% { opacity: 0; } }
  @keyframes rise { 0% { transform: translateY(22px); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-28px); opacity: 0; } }
  @keyframes evade { from { transform: translateX(-12px); } to { transform: translateX(12px); } }
  @keyframes poison-drop { from { translate: 0 -16px; } to { translate: 0 12px; } }
  @media (prefers-reduced-motion: reduce) {
    .flight-trail, .flight-core, .lightning-trail, .lightning-core, .fragment { display: none; }
    .combat-effect { --impact-delay: 0ms !important; }
    .impact, .critical .impact { animation: impact-life 380ms linear both; }
    .impact-ring, .rising-mote, .dodge-streak, .venom { animation: none; }
    .impact-ring { opacity: .6; }
  }
</style>
