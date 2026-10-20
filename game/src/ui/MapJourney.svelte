<script lang="ts">
  import { E, eng } from '../engine/client';
  import type { GameState } from '../sim/types';
  import { ownerOf } from '../sim/road';
  import { settlementById } from '../sim/town';
  import { mapKnowledge, trailSites, trailSiteKind } from '../sim/map-exploration';
  let { state, writable, onSelect, onStart, onStop, onClear, onMove } : {
    state: GameState; writable: boolean;
    onSelect: (hex: { q: number; r: number }) => void;
    onStart: () => void; onStop: () => void; onClear: () => void;
    onMove: (index: number, direction: -1 | 1) => void;
  } = $props();
  const sites = $derived(trailSites.filter(site => mapKnowledge(state, site) !== 'unknown'));
  const known = $derived(new Set([...(state.mapJournal?.scouted || []), ...(state.mapJournal?.visited || [])]).size);
  const activityName = (kind?: string) => kind ? ({ mine: 'Mining', grove: 'Woodcutting', fish: 'Fishing' } as Record<string, string>)[kind] || kind : '';
</script>

<details class="map-tools-section" name="map-tools-sections" open>
  <summary>Journey · {state.patrol.stops.length ? `${state.patrol.stops.length} stops` : `${known} known blocks`}</summary>
  <div class="map-journey">
    <p class="text-note">{state.mapJournal?.visited.length || 0} explored · {known} known. Approach landmarks to scout their roster and supplies.</p>
    {#if state.fieldwork.camp}
      <button class="btn btn-quiet" type="button" onclick={() => onSelect(state.fieldwork.camp!.cell)}>Locate Field Camp{state.fieldwork.action ? ` · ${activityName(state.fieldwork.action.kind)}` : ''}</button>
    {/if}
    {#if state.autoReturn.phase !== 'idle'}<p class="text-accent">Auto-Return · {state.autoReturn.phase === 'to-stop' ? 'resuming Patrol' : state.autoReturn.phase === 'waiting' ? 'waiting for online travel' : 'returning to town'}</p>{/if}
    <ol class="journey-stops" aria-label="Patrol itinerary">
      {#each state.patrol.stops as stop, i}
        <li class:active={state.patrol.active && state.patrol.index === i}>
          <button class="btn btn-flat stop-name" type="button" onclick={() => onSelect(stop.cell)} aria-label={`Locate Patrol stop ${i + 1}`}>
            <b>{i + 1}</b><span>{eng.zoneById(stop.zone).subzones?.[stop.subzone]?.name || 'Subzone'}
              {#if state.patrol.active && state.patrol.index === i}<small>{state.patrol.groupsCleared}/{E.road.patrol.groups_per_stop} groups</small>{/if}
            </span>
          </button>
          <button class="btn btn-flat stop-move" type="button" aria-label={`Move stop ${i + 1} earlier`} disabled={!writable || state.patrol.active || !!state.walk || i === 0} onclick={() => onMove(i, -1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 10 4-4 4 4" /></svg></button>
          <button class="btn btn-flat stop-move" type="button" aria-label={`Move stop ${i + 1} later`} disabled={!writable || state.patrol.active || !!state.walk || i === state.patrol.stops.length - 1} onclick={() => onMove(i, 1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></button>
        </li>
      {/each}
    </ol>
    {#if !state.patrol.stops.length}<p class="text-note">Select a subzone on the board and add a Patrol stop to plan your trip.</p>{/if}
    {#if state.patrol.active}
      <button class="btn btn-quiet" type="button" onclick={onStop} disabled={!writable}>Stop Patrol</button>
    {:else if state.patrol.stops.length}
      <button class="btn btn-gold" type="button" onclick={onStart} disabled={!writable || !!state.walk || state.phase === 'camp' || state.patrol.stops.length < E.road.patrol.min_stops}>Start Patrol</button>
      <button class="btn btn-quiet" type="button" onclick={onClear} disabled={!writable || !!state.walk}>Clear itinerary</button>
    {/if}
    <p class="text-note">Walking and route changes run online. Offline hunting stays at the current stop.</p>
    {#if sites.length}
      <details>
        <summary>Discovered trail sites · {sites.length}</summary>
        <div class="journey-sites">
          {#each sites as site}<button class="btn btn-flat" type="button" onclick={() => onSelect(site)}>{trailSiteKind(site).name} · {settlementById(ownerOf(site).id)?.name}{state.mapJournal?.claimedSites.includes(site.id) ? ' · explored' : ''}</button>{/each}
        </div>
      </details>
    {/if}
  </div>
</details>

<style>
  .map-journey, .journey-sites, .journey-stops { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .map-journey { padding-block: var(--spacing-sm); }
  .map-journey p { margin: 0; line-height: 1.4; }
  .journey-stops { padding: 0; margin: 0; list-style: none; }
  .journey-stops li { display: flex; align-items: center; gap: var(--spacing-xs); }
  .stop-name { display: flex; align-items: center; text-align: left; gap: var(--spacing-sm); flex: 1; min-width: 0; }
  .stop-name span { display: flex; flex-direction: column; overflow-wrap: anywhere; }
  .active .stop-name { color: var(--gold); }
  .stop-move svg { width: var(--icon-label); height: var(--icon-label); fill: none; stroke: currentColor; stroke-width: 1.5; }
  .journey-sites button { text-align: left; }
</style>
