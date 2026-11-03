<script lang="ts">
  import { onDestroy } from 'svelte';
  import { actorAction, actorArt, actorBeats, actorImpactMs, actorPrepareMs, actorProfile, actorReaction } from './combat-actor';
  import { combatMotionWeight, combatTempo, type CombatEffectLevel } from './combat-presentation';
  import type { Character } from '@sim/core/player';
  import type { FxEvent, Mob } from '@sim/core/types';

  let { ring, c, mob, opponents = [], speed = 1, effectLevel = 'auto' }: { ring: FxEvent[]; c: Character; mob?: Mob; opponents?: Mob[]; speed?: number; effectLevel?: CombatEffectLevel } = $props();
  const profile = $derived(actorProfile(mob));
  const beats = $derived(actorBeats(ring, mob));
  const art = $derived(actorArt(mob));
  let host = $state<HTMLDivElement | null>(null);
  let actionNode = $state<HTMLDivElement | null>(null);
  let reactionNode = $state<HTMLDivElement | null>(null);
  let actionAnimation: Animation | null = null;
  let reactionAnimation: Animation | null = null;
  let lastAction = -1;
  let lastReaction = -1;

  function vector(event: FxEvent) {
    const field = host?.closest('.field');
    const target = mob ? field?.querySelector<HTMLElement>('.combat-player-slot [data-combat-anchor]')
      : Array.from(field?.querySelectorAll<HTMLElement>('.mob') || [])
        .find((node) => node.dataset.mobId === (event.mobId || event.byId))?.querySelector<HTMLElement>('[data-combat-anchor]');
    if (!target || !host) return { x: 0, y: mob ? 1 : -1 };
    const from = host.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const dx = to.left + to.width / 2 - from.left - from.width / 2;
    const dy = to.top + to.height / 2 - from.top - from.height / 2;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  }

  $effect(() => {
    const event = beats.action;
    const node = actionNode;
    const body = profile;
    const character = c;
    const enemy = mob;
    const playbackSpeed = speed;
    const effects = effectLevel;
    if (effects === 'minimal') {
      actionAnimation?.cancel();
      lastAction = event?.id ?? lastAction;
      return;
    }
    if (!event || !node || event.id === lastAction) return;
    const frame = requestAnimationFrame(() => {
      if (!node.isConnected) return;
      lastAction = event.id;
      actionAnimation?.cancel();
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return;
      const action = actorAction(event, character, enemy);
      const direction = vector(event);
      const prepareMs = action === 'prepare' ? actorPrepareMs(event) : 0;
      if (action === 'prepare' && !prepareMs) return;
      const support = action === 'support';
      const spell = action === 'magic' || support;
      const weight = combatMotionWeight(event, playbackSpeed, effects);
      const reach = (spell ? -5 : action === 'ranged' ? -8 : body.reach) * weight;
      const x = direction.x * reach;
      const y = direction.y * reach;
      const turn = Math.sign(direction.x || (enemy ? -1 : 1));
      const frames = action === 'prepare' ? [
        { transform: 'translate(0, 0) scale(1)', offset: 0 },
        { transform: `translate(${-direction.x * 5 * weight}px, ${-direction.y * 5 * weight}px) rotate(${-turn * 3 * weight}deg) scale(${1 + .035 * weight})`, offset: .65 },
        { transform: 'translate(0, 0) scale(1)', offset: 1 },
      ] : spell ? [
        { transform: 'translate(0, 0) scale(1)', offset: 0 },
        { transform: `translate(0, ${-6 * weight}px) scale(${1 + .025 * weight})`, offset: .28 },
        { transform: `translate(${x}px, ${y - 3 * weight}px) scale(${1 + .045 * weight})`, offset: .52 },
        { transform: 'translate(0, 0) scale(1)', offset: 1 },
      ] : [
        { transform: 'translate(0, 0) rotate(0) scale(1)', offset: 0 },
        { transform: `translate(${-x * .24}px, ${-y * .24}px) rotate(${-turn * (body.boss ? 5 : 3) * weight}deg) scale(${1 - .03 * weight})`, offset: body.boss ? .3 : .18 },
        { transform: `translate(${x}px, ${y}px) rotate(${turn * 3 * weight}deg) scale(${1 + .025 * weight})`, offset: body.boss ? .5 : .4 },
        { transform: `translate(${x * .35}px, ${y * .35}px) rotate(0) scale(1)`, offset: .66 },
        { transform: 'translate(0, 0) rotate(0) scale(1)', offset: 1 },
      ];
      actionAnimation = node.animate(frames, {
        // This is an acknowledgement of a received cast, not a forecast of unresolved damage.
        duration: (prepareMs ? Math.min(prepareMs, 350) : spell ? Math.max(350, body.attackMs) : body.attackMs) / combatTempo(playbackSpeed),
        easing: 'cubic-bezier(.16, 1, .3, 1)',
      });
    });
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    const event = beats.reaction;
    const node = reactionNode;
    const body = profile;
    const playbackSpeed = speed;
    const effects = effectLevel;
    if (effects === 'minimal') {
      reactionAnimation?.cancel();
      lastReaction = event?.id ?? lastReaction;
      return;
    }
    const contactDelay = event ? actorImpactMs(event, c, mob ? undefined : opponents.find((enemy) => enemy.id === event.byId), playbackSpeed) : 0;
    if (!event || !node || event.id === lastReaction) return;
    const frame = requestAnimationFrame(() => {
      if (!node.isConnected) return;
      lastReaction = event.id;
      reactionAnimation?.cancel();
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const reaction = actorReaction(event);
      const direction = vector(event);
      const weight = combatMotionWeight(event, playbackSpeed, effects);
      const recoil = body.recoil * (event.crit ? 1.35 : 1) * weight;
      const x = reaction === 'dodge' ? (mob ? -1 : 1) * 13 * weight : -direction.x * recoil;
      const y = reaction === 'dodge' ? 0 : -direction.y * recoil;
      const frames = reduced ? [
        { opacity: 1, offset: 0 }, { opacity: .66, offset: .25 }, { opacity: 1, offset: 1 },
      ] : [
        { transform: 'translate(0, 0) rotate(0)', filter: 'brightness(1)', offset: 0 },
        { transform: `translate(${x}px, ${y}px) rotate(${reaction === 'hit' ? (mob ? -2 : 2) * weight : 0}deg)`, filter: `brightness(${reaction === 'hit' ? 1 + .65 * weight : 1.2})`, offset: .18 },
        { transform: `translate(${-x * .3}px, ${-y * .3}px) rotate(0)`, filter: 'brightness(1.08)', offset: .48 },
        { transform: 'translate(0, 0) rotate(0)', filter: 'brightness(1)', offset: 1 },
      ];
      reactionAnimation = node.animate(frames, { delay: reduced ? 0 : contactDelay, duration: (reaction === 'dodge' ? 300 : body.boss ? 320 : 250) / combatTempo(playbackSpeed), easing: 'cubic-bezier(.16, 1, .3, 1)' });
    });
    return () => cancelAnimationFrame(frame);
  });

  onDestroy(() => {
    actionAnimation?.cancel();
    reactionAnimation?.cancel();
  });
</script>

<div class="combat-actor" class:player={!mob} class:boss={profile.boss} class:icon-art={art?.icon}
     data-actor-size={profile.size} data-actor-side={mob ? 'field' : 'self'} bind:this={host} aria-hidden="true">
  <span class="actor-shadow"></span>
  <div class="actor-scale" style={`--body-height:${profile.height}`}>
    <div class="actor-action" bind:this={actionNode}>
      <div class="actor-body" bind:this={reactionNode} data-combat-anchor>
        {#if art}
          <svg class="actor-image" viewBox={art.viewBox} preserveAspectRatio={art.icon ? 'xMidYMid meet' : 'xMidYMax meet'} focusable="false">
            <image href={art.href} width={art.imageWidth} height={art.imageHeight} />
          </svg>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .combat-actor { position: relative; width: 100%; height: 100%; min-width: 0; pointer-events: none; isolation: isolate; }
  .actor-shadow { position: absolute; left: 18%; right: 18%; bottom: 0; height: 10%; border-radius: 50%; background: rgba(3, 5, 8, .62); filter: blur(5px); transform: translateY(3px); }
  .player .actor-shadow { left: 26%; right: 26%; }
  .actor-scale { position: absolute; inset: auto 0 0; height: calc(100% * var(--body-height)); }
  .actor-action, .actor-body { width: 100%; height: 100%; transform-origin: 50% 90%; }
  .actor-body { display: flex; align-items: flex-end; justify-content: center; }
  .actor-image { display: block; width: 100%; height: 100%; overflow: hidden; filter: drop-shadow(0 4px 4px rgba(0, 0, 0, .36)); user-select: none; }
  .icon-art .actor-shadow { display: none; }
  .icon-art .actor-scale { height: calc(100% * var(--body-height) * .72); }
  .icon-art .actor-image { opacity: .9; filter: drop-shadow(0 0 7px rgba(227, 233, 242, .16)); }
  @media (prefers-reduced-motion: reduce) {
    .actor-action, .actor-body { transform: none !important; }
  }
</style>
