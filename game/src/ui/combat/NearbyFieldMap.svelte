<script lang="ts">
  import { characterIcon, mobIcon } from '../../icon';
  import { fieldLabel } from '../hud/hud';
  import { nearbyDistanceLabel, NEARBY_RADIUS_M, type NearbyMobView } from './nearby-field';

  let {
    player, views, focusId = null, aimSkill = null, onFocus, onGroundCommand,
  }: {
    player: { x: number; y: number };
    views: NearbyMobView[];
    focusId?: string | null;
    /** When an aim is armed, a ground click casts there instead of walking. */
    aimSkill?: string | null;
    onFocus: (mobId: string) => void;
    onGroundCommand: (point: { x: number; y: number }) => void;
  } = $props();

  const playerMark = characterIcon();
  /** Percent of the half-view: 10 m reaches the edge, north is up. */
  const markerStyle = (view: NearbyMobView) =>
    `left:${50 + ((view.actor.x - player.x) / NEARBY_RADIUS_M) * 50}%;top:${50 + ((view.actor.y - player.y) / NEARBY_RADIUS_M) * 50}%`;

  function groundClick(event: MouseEvent) {
    const face = event.currentTarget;
    if (!(face instanceof HTMLDivElement) || event.target !== face) return;
    const box = face.getBoundingClientRect();
    const dx = ((event.clientX - box.left) / box.width - 0.5) * 2 * NEARBY_RADIUS_M;
    const dy = ((event.clientY - box.top) / box.height - 0.5) * 2 * NEARBY_RADIUS_M;
    onGroundCommand({ x: player.x + dx, y: player.y + dy });
  }
</script>

<section class="nearby-map surface-hud" aria-label="Nearby field, within 10 metres">
  <header>
    <span class="text-heading">Nearby field</span>
    <span class="text-dim">{views.length} · &lt; 10 m</span>
  </header>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="map-face" role="presentation" onclick={groundClick}
       aria-label={aimSkill ? 'Click ground to cast the aimed skill' : 'Click ground to walk there'}>
    <span class="ring"></span>
    <span class="axis north">N</span>
    <span class="player-mark" style={`left:50%;top:50%`} title="You">
      <span class="icon-mask" style={`--glyph:url('${playerMark}')`}></span>
    </span>
    {#each views as view (view.id)}
      <button class="mob-mark" class:focused={focusId === view.id} style={markerStyle(view)} type="button"
              onclick={() => onFocus(view.id)}
              aria-label={`Focus ${fieldLabel(view.mob)}, ${nearbyDistanceLabel(view.distanceM)}`}
              title={`${fieldLabel(view.mob)} · ${nearbyDistanceLabel(view.distanceM)}`}>
        <span class="icon-mask" style={`--glyph:url('${mobIcon(view.mob.species)}')`}></span>
      </button>
    {/each}
  </div>
  <p class="text-note map-hint">{aimSkill ? 'Click ground to cast · markers focus a target' : 'Click ground to move · markers focus a target'}</p>
</section>

<style>
  .nearby-map { width: 100%; max-width: 13rem; display: grid; gap: var(--spacing-xs); padding: var(--spacing-sm); }
  header { display: flex; justify-content: space-between; align-items: baseline; gap: var(--spacing-xs); font-size: var(--font-xs); }
  .map-face { position: relative; width: 100%; aspect-ratio: 1; overflow: hidden; cursor: crosshair;
    border: 1px solid var(--edge); border-radius: var(--radius-card);
    background: radial-gradient(circle at 50% 50%, var(--glass), var(--inset)); }
  .ring { position: absolute; inset: 25%; border: 1px dashed color-mix(in srgb, var(--edge) 70%, transparent);
    border-radius: 50%; pointer-events: none; }
  .axis { position: absolute; left: 50%; translate: -50% 0; color: var(--dim); font-size: var(--font-3xs); pointer-events: none; }
  .axis.north { top: 2px; }
  .player-mark, .mob-mark { position: absolute; display: grid; place-items: center; translate: -50% -50%;
    width: var(--icon-card); height: var(--icon-card); border: 1px solid var(--edge); border-radius: 50%;
    background: var(--hud-face); color: var(--text); }
  .player-mark { z-index: 2; border-color: var(--gold); color: var(--gold-lit); pointer-events: none; }
  .mob-mark { z-index: 3; padding: 0; cursor: pointer; color: var(--alarm); }
  .mob-mark:hover, .mob-mark:focus-visible { color: var(--gold-lit); border-color: var(--gold); background: var(--hud-face); }
  .mob-mark.focused { border-color: var(--gold-lit); box-shadow: 0 0 0 2px color-mix(in srgb, var(--gold) 45%, transparent); }
  .map-hint { margin: 0; font-size: var(--font-3xs); }
</style>
