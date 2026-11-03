<script lang="ts">
  import { E } from '../../engine/client';
  import type { GameState } from '@sim/core/types';
  import { ownerOf } from '@sim/world/road';
  import { settlementById } from '@sim/town/town';
  import { mapKnowledge, trailSites, trailSiteKind } from '@sim/world/map-exploration';
  import type { CampEncounterAction, CampEncounterPolicy } from '@sim/world/camp-encounters';
  let { state, writable, expanded = $bindable(false), onSelect, onEncounter, onPolicy } : {
    state: GameState; writable: boolean;
    expanded?: boolean;
    onSelect: (hex: { q: number; r: number }) => void;
    onEncounter: (id: number, action: CampEncounterAction) => void;
    onPolicy: (policy: CampEncounterPolicy) => void;
  } = $props();
  const sites = $derived(trailSites(state).filter(site => mapKnowledge(state, site) !== 'unknown'));
  const known = $derived(new Set([...(state.mapJournal?.scouted || []), ...(state.mapJournal?.visited || [])]).size);
  const activityName = (kind?: string) => kind ? ({ mine: 'Mining', grove: 'Woodcutting', fish: 'Fishing' } as Record<string, string>)[kind] || kind : '';
  const encounter = $derived(state.fieldwork.campEncounters.active);
  const encounterName = $derived(encounter ? ({ sounds: 'A noise nearby', prowler: 'A Mob approaches', traveler: 'A traveler at Camp', nest: 'A nest near the worksite', discovered: 'Your Camp was found' } as const)[encounter.kind] : '');
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
    return [];
  });
</script>

<details class="map-tools-section" bind:open={expanded}>
  <summary>Journey tools · {known} known blocks</summary>
  <div class="map-journey">
    <p class="text-note">{state.mapJournal?.visited.length || 0} explored · {known} known. Approach landmarks to scout their roster and supplies.</p>
    <p class="text-note">The loop: hunt for drops and materials → deliver or sell at a settlement → improve gear and tree → continue from the pinned goal.</p>
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
    <p class="text-note">Walking runs online.</p>
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
  .map-journey, .journey-sites { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .map-journey { padding-block: var(--spacing-sm); }
.camp-policy { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); }
.camp-encounter { display: grid; gap: var(--tile-gap); padding: var(--tile-pad); }
.camp-encounter h3, .camp-encounter p { margin: 0; }
.camp-encounter-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
  .map-journey p { margin: 0; line-height: 1.4; }
  .journey-sites button { text-align: left; }
</style>
