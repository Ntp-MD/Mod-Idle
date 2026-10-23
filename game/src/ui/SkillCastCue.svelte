<script lang="ts">
  import { sm } from '../engine/client';
  import { skillIcon } from '../icon';
  import type { FxEvent } from '../sim/types';
  import Icon from './Icon.svelte';

  let { ring }: { ring: FxEvent[] } = $props();

  // A cast owns one cue. Its damage, healing and status events never repeat the announcement.
  const casts = $derived(ring.filter((event) => event.side === 'self' && event.skillId
    && (event.kind === 'cast' || event.kind === 'buff')).slice(0, 3));
</script>

<div class="skill-cast-cues" aria-hidden="true">
  {#each casts as event, lane (event.id)}
    {@const skill = sm.byId[event.skillId!]}
    <span class="skill-cast-cue" style={`--cast-colour:${event.colour}; --cast-lane:${lane}`}>
      <span class="cast-icon"><Icon src={skillIcon(event.skillId!, skill?.type)} /></span>
      <span class="cast-name">{skill?.name || event.text}</span>
    </span>
  {/each}
</div>

<style>
  .skill-cast-cues {
    --cast-height: calc(var(--icon-label) + 12px);
    position: absolute;
    left: 0;
    bottom: calc(100% + var(--spacing-xs));
    z-index: var(--z-label);
    width: 100%;
    height: 0;
    pointer-events: none;
  }

  .skill-cast-cue {
    position: absolute;
    left: 0;
    bottom: 0;
    translate: 0 calc(-1 * var(--cast-lane) * (var(--cast-height) + var(--spacing-xs)));
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    width: 100%;
    min-width: 0;
    height: var(--cast-height);
    padding: 3px var(--spacing-xs) 3px 3px;
    box-sizing: border-box;
    border: 1px solid color-mix(in srgb, var(--cast-colour) 42%, var(--hud-edge));
    border-radius: 3px;
    background: var(--hud-face);
    box-shadow: var(--shadow-soft), inset 2px 0 var(--cast-colour);
    color: var(--text);
    opacity: 0;
    animation: cast-cue 1.2s var(--ease-out) both;
    transition: translate var(--motion-fast) var(--ease-out);
  }

  .cast-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: calc(var(--icon-label) + 4px);
    height: calc(var(--icon-label) + 4px);
    border: 1px solid color-mix(in srgb, var(--gold) 22%, transparent);
    background: var(--inset);
  }

  .cast-name {
    overflow: hidden;
    font-size: var(--font-xs);
    font-weight: 600;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @keyframes cast-cue {
    0% { opacity: 0; transform: translateY(5px); }
    12%, 68% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-5px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .skill-cast-cue {
      animation-name: cast-cue-reduced;
      transition: none;
    }

    @keyframes cast-cue-reduced {
      0%, 100% { opacity: 0; }
      12%, 68% { opacity: 1; }
    }
  }
</style>
