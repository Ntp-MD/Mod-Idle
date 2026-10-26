<script lang="ts">
  import { E, eng } from '../../engine/client';
  import type { GameState } from '../../sim/types';
  import { ownerOf } from '../../sim/road';
  import { settlementById } from '../../sim/town';
  import { mapKnowledge, trailSites, trailSiteKind } from '../../sim/map-exploration';
  import type { CampEncounterAction, CampEncounterPolicy } from '../../sim/camp-encounters';
  import chevronUp from '../../icon/ui/chevron-up.png';
  import chevronDown from '../../icon/ui/chevron-down.png';
  let { state, writable, expanded = $bindable(false), onSelect, onStart, onStop, onClear, onMove, onEncounter, onPolicy, onRepeat, onAutoReturn } : {
    state: GameState; writable: boolean;
    expanded?: boolean;
    onSelect: (hex: { q: number; r: number }) => void;
    onStart: () => void; onStop: () => void; onClear: () => void;
    onMove: (index: number, direction: -1 | 1) => void;
    onEncounter: (id: number, action: CampEncounterAction) => void;
    onPolicy: (policy: CampEncounterPolicy) => void;
    onRepeat: (repeat: boolean) => void;
    onAutoReturn: (enabled: boolean) => void;
  } = $props();
  const sites = $derived(trailSites(state).filter(site => mapKnowledge(state, site) !== 'unknown'));
  const known = $derived(new Set([...(state.mapJournal?.scouted || []), ...(state.mapJournal?.visited || [])]).size);
  const activityName = (kind?: string) => kind ? ({ mine: 'Mining', grove: 'Woodcutting', fish: 'Fishing' } as Record<string, string>)[kind] || kind : '';
  const encounter = $derived(state.fieldwork.campEncounters.active);
  const encounterName = $derived(encounter ? ({ sounds: 'A sound nearby', prowler: 'A Mob approaches', traveler: 'A traveler at Camp', nest: 'A nest near the worksite', herd: 'Herd tracks', injured: 'An injured traveler', discovered: 'Your Camp was found' } as const)[encounter.kind] : '');
  const encounterActions = $derived.by((): { label: string; action: CampEncounterAction; disabled?: boolean }[] => {
    if (!encounter || encounter.stage === 'combat') return [];
    if (encounter.kind === 'sounds') return encounter.stage === 'warning'
      ? [{ label: 'Investigate', action: 'investigate' }, { label: 'Stay quiet', action: 'quiet' }]
      : [{ label: 'Fight', action: 'fight' }, { label: 'Withdraw', action: 'quiet' }];
    if (encounter.kind === 'prowler') return [
      { label: 'Fight', action: 'fight' }, { label: 'Secure supplies', action: 'secure' },
    ];
    if (encounter.kind === 'discovered') return [
      { label: 'Fight', action: 'fight' }, { label: 'Shelter', action: 'shelter' },
    ];
    if (encounter.kind === 'nest') return [
      { label: 'Clear the nest', action: 'fight' }, { label: 'Wait it out', action: 'pause' },
    ];
    if (encounter.kind === 'traveler') return [
      { label: 'Listen to local news', action: 'listen' },
      { label: 'Trade food for ore', action: 'trade-ore', disabled: !(encounter.payload.materials as string[] || []).includes('ore') },
      { label: 'Trade food for timber', action: 'trade-timber', disabled: !(encounter.payload.materials as string[] || []).includes('timber') },
      { label: 'Decline', action: 'decline' },
    ];
    if (encounter.kind === 'herd') return [{ label: 'Follow the tracks', action: 'follow' }, { label: 'Let them pass', action: 'dismiss' }];
    return [
      { label: `Help with ${encounter.payload.foodAmount} provisions`, action: 'help-food', disabled: !encounter.payload.foodId || (state.fieldwork.foods[String(encounter.payload.foodId)] || 0) < Number(encounter.payload.foodAmount) },
      { label: `Give ${encounter.payload.potionName || 'an HP draught'}`, action: 'help-potion', disabled: !encounter.payload.potionName || (state.farm.potions[String(encounter.payload.potionName)] || 0) < Number(encounter.payload.potionAmount) },
      { label: 'Decline', action: 'decline' },
    ];
  });
</script>

<details class="map-tools-section" bind:open={expanded}>
  <summary>Journey tools · {state.patrol.stops.length ? `${state.patrol.stops.length} stops` : `${known} known blocks`}</summary>
  <div class="map-journey">
    <p class="text-note">{state.mapJournal?.visited.length || 0} explored · {known} known. Approach landmarks to scout their roster and supplies.</p>
    <p class="text-note">The loop: hunt for drops and materials → deliver or sell at a settlement → improve gear and tree → continue from the pinned goal or Patrol.</p>
    {#if state.fieldwork.camp}
      <button class="btn btn-quiet" type="button" onclick={() => onSelect(state.fieldwork.camp!.cell)}>Locate Field Camp{state.fieldwork.action ? ` · ${activityName(state.fieldwork.action.kind)}` : ''}</button>
      <label class="camp-policy">When Camp is threatened
        <select aria-label="Camp threat policy" value={state.fieldwork.campEncounters.policy} disabled={!writable}
          onchange={(event) => onPolicy(event.currentTarget.value as CampEncounterPolicy)}>
          <option value="avoid">Avoid fights</option><option value="defend">Defend Camp</option><option value="engage">Engage early</option>
        </select>
      </label>
    {/if}
    {#if encounter}
      <section class="camp-encounter card-read" aria-label="Camp encounter" aria-live="polite">
        <h3>{encounterName}</h3>
        <p>{encounter.stage === 'warning' ? `Warning · ${encounter.warningSec}s · ${state.fieldwork.campEncounters.policy} policy`
          : encounter.stage === 'choice' ? `Choose before the threat reaches Camp · ${encounter.choiceSec}s`
            : `Fighting · ${encounter.participantIds.length} group members`}</p>
        {#if encounter.kind === 'traveler'}<p>Offer: {encounter.payload.foodAmount} regional provisions for ore or timber.</p>{/if}
        {#if encounter.kind === 'sounds' && encounter.stage === 'choice'}
          <p>Tracks reveal {E.mob.species.find((sp: any) => sp.id === encounter!.payload.species)?.name || 'a nearby Species'}.</p>
        {/if}
        {#if encounter.kind === 'herd'}<p>Tracks lead toward a known Expedition subzone. Following starts an ordinary hunt.</p>{/if}
        {#if encounter.kind === 'injured'}<p>Helping earns {encounter.payload.credit} Standing progress for {encounter.payload.settlementId}.</p>{/if}
        {#if encounter.stage === 'combat'}<p>Stay or use the ordinary retreat controls. Any rewards already earned are kept.</p>
        {:else}<div class="camp-encounter-actions">
          {#each encounterActions as option}
            <button class="btn btn-quiet" type="button" disabled={!writable || option.disabled}
              onclick={() => onEncounter(encounter!.id, option.action)}>{option.label}</button>
          {/each}
        </div>{/if}
      </section>
    {:else if state.fieldwork.campEncounters.recap}
      <p class="text-note" aria-live="polite">{state.fieldwork.campEncounters.recap}</p>
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
          <button class="btn btn-flat stop-move" type="button" aria-label={`Move stop ${i + 1} earlier`} disabled={!writable || state.patrol.active || !!state.walk || i === 0} onclick={() => onMove(i, -1)}><span class="icon-mask" style={`--glyph:url(${chevronUp})`} aria-hidden="true"></span></button>
          <button class="btn btn-flat stop-move" type="button" aria-label={`Move stop ${i + 1} later`} disabled={!writable || state.patrol.active || !!state.walk || i === state.patrol.stops.length - 1} onclick={() => onMove(i, 1)}><span class="icon-mask" style={`--glyph:url(${chevronDown})`} aria-hidden="true"></span></button>
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
    <label class="journey-setting"><input type="checkbox" checked={state.patrol.repeat} disabled={!writable || state.patrol.active}
      onchange={(event) => onRepeat(event.currentTarget.checked)} /> Repeat Patrol</label>
    <label class="journey-setting"><input type="checkbox" checked={state.autoReturn.enabled} disabled={!writable}
      onchange={(event) => onAutoReturn(event.currentTarget.checked)} /> Auto-Return at {E.road.patrol.auto_return_threshold_pct}% bag</label>
    <p class="text-note">Auto-Return stashes unlocked gear, then resumes Patrol.</p>
    <p class="text-note">Walking and route changes run online. Offline hunting stays at the current stop.</p>
    {#if sites.length}
      <details>
        <summary>Discovered trail sites · {sites.length}</summary>
        <div class="journey-sites">
          {#each sites as site}<button class="btn btn-flat" type="button" onclick={() => onSelect(site)}>{trailSiteKind(site).name} · {settlementById(ownerOf(site).id)?.name} · {Math.ceil(site.remainingSec / 60)}m left{state.mapJournal?.claimedSites.includes(site.id) ? ' · explored' : ''}</button>{/each}
        </div>
      </details>
    {/if}
  </div>
</details>

<style>
  .map-tools-section { min-width: 0; border-top: 1px solid var(--edge); }
  .map-tools-section > summary { padding-block: var(--spacing-sm); cursor: pointer; font-size: var(--font-xs); font-weight: 600; }
  .map-journey, .journey-sites, .journey-stops { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .map-journey { padding-block: var(--spacing-sm); }
.camp-policy { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); }
.camp-encounter { display: grid; gap: var(--tile-gap); padding: var(--tile-pad); }
.camp-encounter h3, .camp-encounter p { margin: 0; }
.camp-encounter-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
  .map-journey p { margin: 0; line-height: 1.4; }
  .journey-stops { padding: 0; margin: 0; list-style: none; }
  .journey-stops li { display: flex; align-items: center; gap: var(--spacing-xs); }
  .stop-name { display: flex; align-items: center; text-align: left; gap: var(--spacing-sm); flex: 1; min-width: 0; }
  .stop-name span { display: flex; flex-direction: column; overflow-wrap: anywhere; }
  .active .stop-name { color: var(--gold); }
  .journey-sites button { text-align: left; }
  .journey-setting { display: flex; align-items: flex-start; gap: var(--spacing-xs); }
</style>
