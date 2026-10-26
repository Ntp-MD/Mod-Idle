<script lang="ts">
  import { sm } from '../../engine/client';
  import { skillIcon } from '../../icon';
  import type { FxEvent, Mob } from '../../sim/core/types';
  import Icon from '../shared/Icon.svelte';
  import { mobSkillById } from '../../sim/combat/mobSkills';
  import { fieldLabel } from '../hud/hud';
  import { combatCastCues, combatEffectLevel, type CombatEffectLevel } from './combat-presentation';

  let { ring, mob, speed = 1, effectLevel = 'auto' }: { ring: FxEvent[]; mob?: Mob; speed?: number; effectLevel?: CombatEffectLevel } = $props();
  const effects = $derived(combatEffectLevel(effectLevel, speed));

  // A cast owns one cue. Its damage, healing and status events never repeat the announcement.
  // A mob cue reports an event already received; it never pretends to count down to future damage.
  const casts = $derived(combatCastCues(ring.filter((event) => event.skillId && (mob
    ? event.side === 'field' && event.mobId === mob.id && event.kind === 'cast'
    : event.side === 'self' && (event.kind === 'cast' || event.kind === 'buff'))), speed, effectLevel));
</script>

<div class="skill-cast-cues" class:enemy={!!mob} class:calm={effects !== 'full'} class:minimal={effects === 'minimal'} class:boss={mob?.kind.startsWith('Boss')} aria-hidden="true">
  {#each casts as event, lane (event.id)}
    {@const skill = mob ? mobSkillById(event.skillId!) : sm.byId[event.skillId!]}
    <span class="skill-cast-cue" style={`--cast-colour:${event.colour}; --cast-lane:${lane}`}>
      <span class="cast-icon"><Icon src={skillIcon(event.skillId!, mob ? 'attack' : sm.byId[event.skillId!]?.type)} /></span>
      <span class="cast-name"><strong>{skill?.name || event.text}{#if event.count > 1} ×{event.count}{/if}</strong>{#if mob}<small>{fieldLabel(mob)} · {skill?.element || 'physical'}</small>{/if}</span>
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
  .skill-cast-cues.enemy { --cast-height: calc(var(--icon-label) + 24px); top: 0; bottom: auto; }
  .enemy .skill-cast-cue { top: 0; bottom: auto; translate: 0 calc(var(--cast-lane) * (var(--cast-height) + var(--spacing-xs))); }
  .boss .skill-cast-cue { border-color: var(--boss-ink); }
  .calm .skill-cast-cue { animation-name: cast-cue-reduced; transition: none; }
  .minimal .skill-cast-cue { opacity: 1; animation: none; transition: none; }

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
    display: grid;
    min-width: 0;
    overflow: hidden;
    font-size: var(--font-xs);
    font-weight: 600;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cast-name strong { overflow: hidden; text-overflow: ellipsis; font: inherit; }
  .cast-name small { overflow: hidden; text-overflow: ellipsis; font-size: var(--font-3xs); color: var(--gold-lit); line-height: 1.3; }

  @keyframes cast-cue {
    0% { opacity: 0; transform: translateY(5px); }
    12%, 68% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-5px); }
  }
  @keyframes cast-cue-reduced {
    0%, 100% { opacity: 0; }
    12%, 68% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .skill-cast-cue {
      animation-name: cast-cue-reduced;
      transition: none;
    }

  }
</style>
